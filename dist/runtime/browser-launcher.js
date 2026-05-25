import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, lstat, mkdir, readFile, readlink, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupStagedExtensions, EXTENSION_BOOTSTRAP_FILENAME, EXTENSION_BOOTSTRAP_SCRIPT_FILENAME, EXTENSION_STAGING_DIRNAME, resolveExtensionBootstrapPayload, stageExtensionForRun } from "./browser-extension-staging.js";
import { isUnsupportedBrandedChromeForExtensions, resolveBrowserExecutablePath, resolveBrowserVersionOutputForFingerprint, resolveBrowserVersionTruthSource, resolveExecutablePath, resolvePreferredBrowserCandidates, resolvePreferredBrowserVersionTruthSource } from "./browser-discovery.js";
import { BrowserLaunchError } from "./browser-launcher-shared.js";
export { BrowserLaunchError } from "./browser-launcher-shared.js";
export { EXTENSION_BOOTSTRAP_FILENAME, EXTENSION_BOOTSTRAP_SCRIPT_FILENAME, EXTENSION_STAGING_DIRNAME, isUnsupportedBrandedChromeForExtensions, resolveBrowserExecutablePath, resolveExecutablePath, resolveBrowserVersionOutputForFingerprint, resolveBrowserVersionTruthSource, resolvePreferredBrowserCandidates, resolvePreferredBrowserVersionTruthSource };
export const BROWSER_STATE_FILENAME = "__webenvoy_browser_instance.json";
export const BROWSER_CONTROL_FILENAME = "__webenvoy_browser_control.json";
const READY_WAIT_MAX_ATTEMPTS = 80;
const READY_WAIT_INTERVAL_MS = 150;
const READY_MIN_UPTIME_MS = 600;
const READY_CONFIRM_DELAY_MS = 120;
const READY_MARKER_GRANULARITY_TOLERANCE_MS = 1_000;
const SUPERVISOR_STATE_WAIT_ATTEMPTS = 40;
const SUPERVISOR_STATE_WAIT_INTERVAL_MS = 80;
const SUPERVISOR_SHUTDOWN_TIMEOUT_MS = 4_000;
const parseStartUrl = (params) => {
    const raw = params.startUrl;
    if (raw === undefined || raw === null) {
        return "about:blank";
    }
    if (typeof raw !== "string" || raw.trim().length === 0) {
        throw new BrowserLaunchError("BROWSER_INVALID_ARGUMENT", "params.startUrl 必须是非空字符串");
    }
    const normalized = raw.trim();
    if (normalized === "about:blank") {
        return normalized;
    }
    try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new BrowserLaunchError("BROWSER_INVALID_ARGUMENT", "params.startUrl 仅支持 http/https/about:blank");
        }
        return normalized;
    }
    catch (error) {
        if (error instanceof BrowserLaunchError) {
            throw error;
        }
        throw new BrowserLaunchError("BROWSER_INVALID_ARGUMENT", "params.startUrl 不是有效 URL", {
            cause: error
        });
    }
};
const pathExists = async (path) => {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
};
const pathEntryExists = async (path) => {
    try {
        await lstat(path);
        return true;
    }
    catch {
        return false;
    }
};
const isFreshReadyMarker = async (path, launchedAtMs) => {
    try {
        const markerStat = await stat(path);
        return markerStat.mtimeMs + READY_MARKER_GRANULARITY_TOLERANCE_MS >= launchedAtMs;
    }
    catch {
        return false;
    }
};
const sleep = async (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
const isProcessAlive = (pid) => {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
};
const deleteFileQuietly = async (path) => {
    try {
        await unlink(path);
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code !== "ENOENT") {
            throw error;
        }
    }
};
const waitForProcessExit = async (pid, deadlineMs) => {
    while (Date.now() < deadlineMs) {
        if (!isProcessAlive(pid)) {
            return true;
        }
        await sleep(100);
    }
    return !isProcessAlive(pid);
};
const terminateBrowserPid = async (browserPid, timeoutMs) => {
    if (!isProcessAlive(browserPid)) {
        return true;
    }
    try {
        process.kill(browserPid, "SIGTERM");
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code !== "ESRCH") {
            throw error;
        }
        return true;
    }
    const gracefulDeadline = Date.now() + timeoutMs;
    if (await waitForProcessExit(browserPid, gracefulDeadline)) {
        return true;
    }
    try {
        process.kill(browserPid, "SIGKILL");
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code !== "ESRCH") {
            throw error;
        }
        return true;
    }
    return waitForProcessExit(browserPid, Date.now() + 1_000);
};
const getBrowserInstanceArtifactPaths = (profileDir) => ({
    stateFilePath: join(profileDir, BROWSER_STATE_FILENAME),
    controlFilePath: join(profileDir, BROWSER_CONTROL_FILENAME)
});
const cleanupSupervisorArtifacts = async (profileDir) => {
    const artifactPaths = getBrowserInstanceArtifactPaths(profileDir);
    await deleteFileQuietly(artifactPaths.stateFilePath);
    await deleteFileQuietly(artifactPaths.controlFilePath);
};
const writeBrowserInstanceStateAtomic = async (stateFilePath, state) => {
    const tempStateFilePath = `${stateFilePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        await writeFile(tempStateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
        await rename(tempStateFilePath, stateFilePath);
    }
    catch (error) {
        await deleteFileQuietly(tempStateFilePath).catch(() => undefined);
        throw error;
    }
};
const CHROME_SINGLETON_FILENAMES = ["SingletonLock", "SingletonCookie", "SingletonSocket"];
const readProfileSingletonLockOwnerPid = async (profileDir) => {
    try {
        const lockTarget = await readlink(join(profileDir, "SingletonLock"));
        const match = /-(\d+)$/.exec(lockTarget.trim());
        if (!match) {
            return null;
        }
        const pid = Number.parseInt(match[1], 10);
        return Number.isInteger(pid) && pid > 0 ? pid : null;
    }
    catch {
        return null;
    }
};
const cleanupStaleProfileSingletonLock = async (profileDir) => {
    await Promise.all(CHROME_SINGLETON_FILENAMES.map((filename) => deleteFileQuietly(join(profileDir, filename))));
};
const parseBrowserInstanceState = (raw) => {
    const parsed = JSON.parse(raw);
    const launchSurfaceAudit = parsed.launchSurfaceAudit === undefined
        ? undefined
        : parseBrowserLaunchSurfaceAudit(parsed.launchSurfaceAudit);
    if (parsed.schemaVersion !== 1 ||
        typeof parsed.launchToken !== "string" ||
        typeof parsed.profileDir !== "string" ||
        typeof parsed.runId !== "string" ||
        typeof parsed.browserPath !== "string" ||
        !Number.isInteger(parsed.controllerPid) ||
        !Number.isInteger(parsed.browserPid) ||
        typeof parsed.launchedAt !== "string") {
        return null;
    }
    return {
        ...parsed,
        launchSurfaceAudit: launchSurfaceAudit ?? undefined
    };
};
const readBrowserInstanceState = async (path) => {
    try {
        const raw = await readFile(path, "utf8");
        return parseBrowserInstanceState(raw);
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code === "ENOENT") {
            return null;
        }
        return null;
    }
};
const stringArraysEqual = (left, right) => Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index]);
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const stringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const isBrowserLaunchAuditSurface = (value) => value === "profile_binding" ||
    value === "ua_profile" ||
    value === "ua_client_hints" ||
    value === "timezone_profile" ||
    value === "timezone_locale" ||
    value === "locale_launch_arg" ||
    value === "timezone_launch_arg" ||
    value === "navigator_connection" ||
    value === "network_webrtc" ||
    value === "webrtc_network";
const isBrowserLaunchAuditReasonCode = (value) => value === "CLIENT_HINTS_NOT_AUDITED" ||
    value === "FINGERPRINT_BUNDLE_FIELD_MISSING" ||
    value === "FINGERPRINT_CONTEXT_MISSING" ||
    value === "LAUNCH_ARG_NOT_CONFIGURED" ||
    value === "NETWORK_WEBRTC_NOT_AUDITED" ||
    value === "PATCH_NOT_AVAILABLE" ||
    value === "PROFILE_BINDING_MISMATCH" ||
    value === "PROFILE_IDENTITY_MISSING";
const auditSurfaceArray = (value) => Array.isArray(value) ? value.filter(isBrowserLaunchAuditSurface) : [];
const auditReasonCodeArray = (value) => Array.isArray(value) ? value.filter(isBrowserLaunchAuditReasonCode) : [];
const parseSurfaceCheck = (value) => {
    const record = asRecord(value);
    if (!record ||
        !isBrowserLaunchAuditSurface(record.surface) ||
        (record.decision !== "match" &&
            record.decision !== "mismatch" &&
            record.decision !== "unsupported")) {
        return null;
    }
    return {
        surface: record.surface,
        decision: record.decision,
        reasonCodes: auditReasonCodeArray(record.reasonCodes)
    };
};
const parseBrowserLaunchSurfaceAudit = (value) => {
    const record = asRecord(value);
    const launchArgs = asRecord(record?.launchArgs);
    const fingerprintContext = asRecord(record?.fingerprintContext);
    if (!record ||
        record.schemaVersion !== 1 ||
        record.namespace !== "webenvoy.browser_launch_surface_audit" ||
        (record.launchMode !== "load_extension" &&
            record.launchMode !== "official_chrome_persistent_extension") ||
        (record.executionSurface !== "headless_browser" && record.executionSurface !== "real_browser") ||
        typeof record.headless !== "boolean" ||
        typeof record.extensionBootstrapPresent !== "boolean" ||
        !launchArgs ||
        typeof launchArgs.userDataDirMatchesProfile !== "boolean" ||
        typeof launchArgs.profileDirectoryIsDefault !== "boolean" ||
        typeof launchArgs.headlessFlagPresent !== "boolean" ||
        typeof launchArgs.loadExtensionPresent !== "boolean" ||
        typeof launchArgs.disableExtensionsExceptPresent !== "boolean" ||
        typeof launchArgs.langPresent !== "boolean" ||
        typeof launchArgs.timezonePresent !== "boolean" ||
        !fingerprintContext ||
        typeof fingerprintContext.present !== "boolean" ||
        (fingerprintContext.source !== "input" &&
            fingerprintContext.source !== "extension_bootstrap" &&
            fingerprintContext.source !== "none") ||
        typeof fingerprintContext.uaPresent !== "boolean" ||
        typeof fingerprintContext.timezonePresent !== "boolean" ||
        typeof fingerprintContext.environmentPresent !== "boolean" ||
        !Array.isArray(record.surfaceChecks) ||
        !Array.isArray(record.unsupportedSurfaces) ||
        !Array.isArray(record.mismatchSurfaces)) {
        return null;
    }
    const surfaceChecks = record.surfaceChecks.map(parseSurfaceCheck);
    if (surfaceChecks.some((check) => check === null)) {
        return null;
    }
    return {
        schemaVersion: 1,
        namespace: "webenvoy.browser_launch_surface_audit",
        launchMode: record.launchMode,
        executionSurface: record.executionSurface,
        headless: record.headless,
        extensionBootstrapPresent: record.extensionBootstrapPresent,
        launchArgs: {
            userDataDirMatchesProfile: launchArgs.userDataDirMatchesProfile,
            profileDirectoryIsDefault: launchArgs.profileDirectoryIsDefault,
            headlessFlagPresent: launchArgs.headlessFlagPresent,
            loadExtensionPresent: launchArgs.loadExtensionPresent,
            disableExtensionsExceptPresent: launchArgs.disableExtensionsExceptPresent,
            langPresent: launchArgs.langPresent,
            timezonePresent: launchArgs.timezonePresent
        },
        fingerprintContext: {
            present: fingerprintContext.present,
            source: fingerprintContext.source,
            profileIdentityPresent: fingerprintContext.profileIdentityPresent === true,
            patchManifestPresent: fingerprintContext.patchManifestPresent === true,
            consistencyCheckPresent: fingerprintContext.consistencyCheckPresent === true,
            uaPresent: fingerprintContext.uaPresent,
            timezonePresent: fingerprintContext.timezonePresent,
            environmentPresent: fingerprintContext.environmentPresent
        },
        surfaceChecks: surfaceChecks,
        reasonCodes: auditReasonCodeArray(record.reasonCodes),
        unsupportedSurfaces: auditSurfaceArray(record.unsupportedSurfaces),
        mismatchSurfaces: auditSurfaceArray(record.mismatchSurfaces)
    };
};
const emptyFingerprintAuditContext = () => ({
    present: false,
    source: "none",
    profileIdentityPresent: false,
    patchManifestPresent: false,
    consistencyCheckPresent: false,
    uaPresent: false,
    timezoneKnown: false,
    environmentPresent: false,
    navigatorConnectionPatchPresent: false
});
const parseFingerprintAuditContext = (value, source) => {
    const runtime = asRecord(value);
    if (!runtime) {
        return emptyFingerprintAuditContext();
    }
    const bundle = asRecord(runtime.fingerprint_profile_bundle);
    const patchManifest = asRecord(runtime.fingerprint_patch_manifest);
    const requiredPatches = stringArray(patchManifest?.required_patches);
    const optionalPatches = stringArray(patchManifest?.optional_patches);
    const timezoneValue = typeof bundle?.timezone === "string" ? bundle.timezone : null;
    return {
        present: true,
        source,
        profileIdentityPresent: typeof runtime.profile === "string" && runtime.profile.length > 0,
        patchManifestPresent: patchManifest !== null,
        consistencyCheckPresent: asRecord(runtime.fingerprint_consistency_check) !== null,
        uaPresent: typeof bundle?.ua === "string" && bundle.ua.length > 0 && bundle.ua.length <= 1_024,
        timezoneKnown: timezoneValue !== null && timezoneValue !== "unknown",
        environmentPresent: asRecord(bundle?.environment) !== null,
        navigatorConnectionPatchPresent: requiredPatches.includes("navigator_connection") ||
            optionalPatches.includes("navigator_connection")
    };
};
const resolveFingerprintAuditContext = (input) => {
    if (input.fingerprintRuntime !== null) {
        return parseFingerprintAuditContext(input.fingerprintRuntime, "input");
    }
    const bootstrap = asRecord(input.extensionBootstrap);
    return parseFingerprintAuditContext(bootstrap?.fingerprint_runtime, "extension_bootstrap");
};
const findArgValue = (args, prefix) => {
    const matched = args.find((arg) => arg.startsWith(prefix));
    return matched ? matched.slice(prefix.length) : null;
};
const buildBrowserLaunchSurfaceAudit = (input) => {
    const fingerprintAudit = input.fingerprintAuditContext;
    const userDataDir = findArgValue(input.launchArgs, "--user-data-dir=");
    const profileDirectory = findArgValue(input.launchArgs, "--profile-directory=");
    const lang = findArgValue(input.launchArgs, "--lang=");
    const timezone = findArgValue(input.launchArgs, "--timezone=");
    const unsupportedSurfaces = new Set();
    const mismatchSurfaces = new Set();
    const surfaceReasonCodes = new Map();
    const addReasonCode = (surface, reasonCode) => {
        const reasonCodes = surfaceReasonCodes.get(surface) ?? new Set();
        reasonCodes.add(reasonCode);
        surfaceReasonCodes.set(surface, reasonCodes);
    };
    const addUnsupportedSurface = (surface, reasonCode) => {
        unsupportedSurfaces.add(surface);
        addReasonCode(surface, reasonCode);
    };
    const addMismatchSurface = (surface, reasonCode) => {
        mismatchSurfaces.add(surface);
        addReasonCode(surface, reasonCode);
    };
    if (userDataDir !== input.profileDir) {
        addMismatchSurface("profile_binding", "PROFILE_BINDING_MISMATCH");
    }
    if (profileDirectory !== "Default") {
        addMismatchSurface("profile_binding", "PROFILE_BINDING_MISMATCH");
    }
    if (!fingerprintAudit.present) {
        addUnsupportedSurface("profile_binding", "FINGERPRINT_CONTEXT_MISSING");
        addUnsupportedSurface("profile_binding", "PROFILE_IDENTITY_MISSING");
        addUnsupportedSurface("ua_profile", "FINGERPRINT_CONTEXT_MISSING");
        addUnsupportedSurface("timezone_profile", "FINGERPRINT_CONTEXT_MISSING");
        addUnsupportedSurface("navigator_connection", "FINGERPRINT_CONTEXT_MISSING");
    }
    else if (!fingerprintAudit.profileIdentityPresent) {
        addUnsupportedSurface("profile_binding", "PROFILE_IDENTITY_MISSING");
    }
    if (!fingerprintAudit.uaPresent) {
        addUnsupportedSurface("ua_profile", "FINGERPRINT_BUNDLE_FIELD_MISSING");
    }
    if (!fingerprintAudit.timezoneKnown) {
        addUnsupportedSurface("timezone_profile", "FINGERPRINT_BUNDLE_FIELD_MISSING");
    }
    if (lang === null) {
        addUnsupportedSurface("locale_launch_arg", "LAUNCH_ARG_NOT_CONFIGURED");
    }
    if (timezone === null) {
        addUnsupportedSurface("timezone_launch_arg", "LAUNCH_ARG_NOT_CONFIGURED");
    }
    addUnsupportedSurface("ua_client_hints", "CLIENT_HINTS_NOT_AUDITED");
    if (!fingerprintAudit.navigatorConnectionPatchPresent) {
        addUnsupportedSurface("navigator_connection", "PATCH_NOT_AVAILABLE");
    }
    addUnsupportedSurface("network_webrtc", "NETWORK_WEBRTC_NOT_AUDITED");
    addUnsupportedSurface("webrtc_network", "NETWORK_WEBRTC_NOT_AUDITED");
    const resolveDecision = (surface) => {
        if (mismatchSurfaces.has(surface)) {
            return "mismatch";
        }
        if (unsupportedSurfaces.has(surface)) {
            return "unsupported";
        }
        return "match";
    };
    const resolveReasonCodes = (surface) => [
        ...(surfaceReasonCodes.get(surface) ?? [])
    ];
    const surfaceChecks = [
        {
            surface: "profile_binding",
            decision: resolveDecision("profile_binding"),
            reasonCodes: resolveReasonCodes("profile_binding")
        },
        {
            surface: "ua_profile",
            decision: resolveDecision("ua_profile"),
            reasonCodes: resolveReasonCodes("ua_profile")
        },
        {
            surface: "ua_client_hints",
            decision: resolveDecision("ua_client_hints"),
            reasonCodes: resolveReasonCodes("ua_client_hints")
        },
        {
            surface: "timezone_profile",
            decision: resolveDecision("timezone_profile"),
            reasonCodes: resolveReasonCodes("timezone_profile")
        },
        {
            surface: "locale_launch_arg",
            decision: resolveDecision("locale_launch_arg"),
            reasonCodes: resolveReasonCodes("locale_launch_arg")
        },
        {
            surface: "timezone_launch_arg",
            decision: resolveDecision("timezone_launch_arg"),
            reasonCodes: resolveReasonCodes("timezone_launch_arg")
        },
        {
            surface: "timezone_locale",
            decision: unsupportedSurfaces.has("timezone_profile") ||
                unsupportedSurfaces.has("locale_launch_arg") ||
                unsupportedSurfaces.has("timezone_launch_arg")
                ? "unsupported"
                : "match",
            reasonCodes: [
                ...new Set([
                    ...resolveReasonCodes("timezone_profile"),
                    ...resolveReasonCodes("locale_launch_arg"),
                    ...resolveReasonCodes("timezone_launch_arg")
                ])
            ]
        },
        {
            surface: "navigator_connection",
            decision: resolveDecision("navigator_connection"),
            reasonCodes: resolveReasonCodes("navigator_connection")
        },
        {
            surface: "network_webrtc",
            decision: resolveDecision("network_webrtc"),
            reasonCodes: resolveReasonCodes("network_webrtc")
        },
        {
            surface: "webrtc_network",
            decision: resolveDecision("webrtc_network"),
            reasonCodes: resolveReasonCodes("webrtc_network")
        }
    ];
    const reasonCodes = [...new Set(surfaceChecks.flatMap((check) => check.reasonCodes))];
    return {
        schemaVersion: 1,
        namespace: "webenvoy.browser_launch_surface_audit",
        launchMode: input.launchMode,
        executionSurface: input.executionSurface,
        headless: input.headless,
        extensionBootstrapPresent: input.extensionBootstrap !== null,
        launchArgs: {
            userDataDirMatchesProfile: userDataDir === input.profileDir,
            profileDirectoryIsDefault: profileDirectory === "Default",
            headlessFlagPresent: input.launchArgs.includes("--headless=new"),
            loadExtensionPresent: findArgValue(input.launchArgs, "--load-extension=") !== null,
            disableExtensionsExceptPresent: findArgValue(input.launchArgs, "--disable-extensions-except=") !== null,
            langPresent: lang !== null,
            timezonePresent: timezone !== null
        },
        fingerprintContext: {
            present: fingerprintAudit.present,
            source: fingerprintAudit.source,
            profileIdentityPresent: fingerprintAudit.profileIdentityPresent,
            patchManifestPresent: fingerprintAudit.patchManifestPresent,
            consistencyCheckPresent: fingerprintAudit.consistencyCheckPresent,
            uaPresent: fingerprintAudit.uaPresent,
            timezonePresent: fingerprintAudit.timezoneKnown,
            environmentPresent: fingerprintAudit.environmentPresent
        },
        surfaceChecks,
        reasonCodes,
        unsupportedSurfaces: [...unsupportedSurfaces],
        mismatchSurfaces: [...mismatchSurfaces]
    };
};
const resolveSupervisorScriptPath = async () => {
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
        join(moduleDir, "browser-supervisor.js"),
        join(process.cwd(), "dist", "runtime", "browser-supervisor.js")
    ];
    for (const candidate of candidates) {
        if (await pathExists(candidate)) {
            return candidate;
        }
    }
    throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "缺少浏览器控制进程脚本 browser-supervisor.js");
};
const shouldLaunchHeadless = (params) => params.headless !== false;
const assertProcessAlive = (pid) => {
    try {
        process.kill(pid, 0);
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code === "ESRCH") {
            throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器启动后立即退出");
        }
        throw error;
    }
};
const waitForBrowserReady = async (profileDir, pid, launchedAtMs, stateFilePath, processOwnership = "owned_child", controllerPid = null) => {
    const readyMarkers = [join(profileDir, "Local State"), join(profileDir, "Default", "Preferences")];
    for (let attempt = 0; attempt < READY_WAIT_MAX_ATTEMPTS; attempt += 1) {
        let markerReady = false;
        for (const marker of readyMarkers) {
            if (await isFreshReadyMarker(marker, launchedAtMs)) {
                markerReady = true;
                break;
            }
        }
        const startupFlagReady = await isFreshReadyMarker(stateFilePath, launchedAtMs);
        if (processOwnership === "external_persistent_app") {
            if (controllerPid === null || !isProcessAlive(controllerPid)) {
                throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器控制进程在 LaunchServices 就绪前退出");
            }
            const profileLockReady = await pathEntryExists(join(profileDir, "SingletonLock"));
            if ((markerReady || (startupFlagReady && profileLockReady)) &&
                Date.now() - launchedAtMs >= READY_MIN_UPTIME_MS) {
                await sleep(READY_CONFIRM_DELAY_MS);
                if (controllerPid === null || !isProcessAlive(controllerPid)) {
                    throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器控制进程在 LaunchServices 就绪确认前退出");
                }
                return;
            }
        }
        else {
            assertProcessAlive(pid);
        }
        if (markerReady && Date.now() - launchedAtMs >= READY_MIN_UPTIME_MS) {
            await sleep(READY_CONFIRM_DELAY_MS);
            if (processOwnership === "external_persistent_app") {
                if (controllerPid === null || !isProcessAlive(controllerPid)) {
                    throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器控制进程在 LaunchServices 就绪确认前退出");
                }
            }
            else {
                assertProcessAlive(pid);
            }
            return;
        }
        await sleep(READY_WAIT_INTERVAL_MS);
    }
    throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器启动超时，未完成最小 profile 初始化");
};
const launchProcess = async (supervisorScriptPath, executablePath, args, input) => {
    const launchedAtMs = Date.now();
    const launchedAt = new Date(launchedAtMs).toISOString();
    const launchArgsBase64 = Buffer.from(JSON.stringify(args), "utf8").toString("base64");
    const child = spawn(process.execPath, [
        supervisorScriptPath,
        "--browser-path",
        executablePath,
        "--launch-args-b64",
        launchArgsBase64,
        "--state-file",
        input.stateFilePath,
        "--control-file",
        input.controlFilePath,
        "--launch-token",
        input.launchToken,
        "--profile-dir",
        input.profileDir,
        "--run-id",
        input.runId
    ], {
        detached: true,
        stdio: "ignore"
    });
    child.unref();
    const launched = await new Promise((resolve, reject) => {
        let settled = false;
        child.once("error", (error) => {
            if (settled) {
                return;
            }
            settled = true;
            reject(error);
        });
        child.once("spawn", () => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(true);
        });
        setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(false);
        }, 150);
    });
    if (!launched || typeof child.pid !== "number" || child.pid <= 0) {
        throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器启动失败，未获取到有效进程 PID");
    }
    return {
        pid: child.pid,
        launchedAt,
        launchedAtMs
    };
};
const prepareBrowserInstanceArtifacts = async (profileDir) => {
    const artifactPaths = getBrowserInstanceArtifactPaths(profileDir);
    await mkdir(profileDir, { recursive: true });
    await deleteFileQuietly(artifactPaths.stateFilePath);
    await deleteFileQuietly(artifactPaths.controlFilePath);
};
const resolveReusableBrowserInstance = async (input) => {
    const state = await readBrowserInstanceState(input.stateFilePath);
    if (!state ||
        state.profileDir !== input.profileDir ||
        state.browserPath !== input.executablePath ||
        state.headless !== input.headless ||
        state.executionSurface !== input.executionSurface ||
        !stringArraysEqual(state.launchArgs, input.launchArgs) ||
        !isProcessAlive(state.controllerPid) ||
        !isProcessAlive(state.browserPid)) {
        return null;
    }
    await writeBrowserInstanceStateAtomic(input.stateFilePath, {
        ...state,
        runId: input.runId,
        launchSurfaceAudit: input.launchSurfaceAudit
    });
    return {
        browserPath: state.browserPath,
        browserPid: state.browserPid,
        controllerPid: state.controllerPid,
        launchArgs: [...input.launchArgs],
        launchedAt: state.launchedAt,
        headless: input.headless,
        executionSurface: state.executionSurface,
        launchSurface: state.launchSurface,
        processOwnership: state.processOwnership
    };
};
const pinExternalBrowserPidFromProfileLock = async (input) => {
    if (input.fallbackState.processOwnership !== "external_persistent_app") {
        return input.fallbackState;
    }
    const ownerPid = await readProfileSingletonLockOwnerPid(input.profileDir);
    if (ownerPid === null || !isProcessAlive(ownerPid)) {
        throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "LaunchServices 启动后未能确认真实 Chrome profile 锁所有者 PID");
    }
    if (ownerPid === input.fallbackState.browserPid) {
        return input.fallbackState;
    }
    const pinnedState = {
        ...input.fallbackState,
        browserPid: ownerPid
    };
    return pinnedState;
};
const assertProfileLaunchBoundaryClear = async (profileDir) => {
    const singletonLockPath = join(profileDir, "SingletonLock");
    if (!(await pathEntryExists(singletonLockPath))) {
        return;
    }
    const ownerPid = await readProfileSingletonLockOwnerPid(profileDir);
    if (ownerPid !== null && !isProcessAlive(ownerPid)) {
        await cleanupStaleProfileSingletonLock(profileDir);
        return;
    }
    throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", `profile 已存在浏览器实例锁，拒绝再次启动以避免同一 profile 打开多个窗口: ${singletonLockPath}`);
};
const waitForBrowserInstanceState = async (input) => {
    for (let attempt = 0; attempt < SUPERVISOR_STATE_WAIT_ATTEMPTS; attempt += 1) {
        const state = await readBrowserInstanceState(input.stateFilePath);
        if (state &&
            state.launchToken === input.expectedToken &&
            state.controllerPid === input.expectedControllerPid &&
            state.browserPid > 0) {
            return state;
        }
        await sleep(SUPERVISOR_STATE_WAIT_INTERVAL_MS);
    }
    throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", `浏览器控制进程未写入可用状态: ${input.stateFilePath}`);
};
const cleanupFailedBrowserLaunch = async (input) => {
    if (input.controllerPid === null) {
        return;
    }
    const artifactPaths = getBrowserInstanceArtifactPaths(input.profileDir);
    const state = await readBrowserInstanceState(artifactPaths.stateFilePath);
    if (isProcessAlive(input.controllerPid)) {
        try {
            process.kill(input.controllerPid, "SIGTERM");
        }
        catch {
            // ignore cleanup failure
        }
    }
    if (state?.processOwnership === "external_persistent_app") {
        // LaunchServices gives us the wrapper pid, not a reliable Chrome app pid.
        // Failed startup cleanup may terminate that wrapper; successful stop paths must not.
        await terminateBrowserPid(state.browserPid, 500).catch(() => false);
        await cleanupSupervisorArtifacts(input.profileDir).catch(() => undefined);
        await cleanupStagedExtensions(input.profileDir);
    }
};
export const launchBrowser = async (input) => {
    const launchMode = input.launchMode ?? "load_extension";
    const executablePath = await resolveExecutablePath(input.params, {
        allowUnsupportedExtensionBrowser: launchMode === "official_chrome_persistent_extension"
    });
    const supervisorScriptPath = await resolveSupervisorScriptPath();
    const startUrl = parseStartUrl(input.params);
    let extensionBootstrap = null;
    const launchArgs = [
        `--user-data-dir=${input.profileDir}`,
        "--profile-directory=Default",
        "--new-window",
        "--no-first-run",
        "--no-default-browser-check"
    ];
    if (launchMode === "load_extension") {
        extensionBootstrap = resolveExtensionBootstrapPayload(input);
        const extensionStaging = await stageExtensionForRun({
            profileDir: input.profileDir,
            runId: input.runId,
            extensionBootstrap
        });
        launchArgs.push(`--disable-extensions-except=${extensionStaging.stagedExtensionDir}`, `--load-extension=${extensionStaging.stagedExtensionDir}`);
    }
    if (input.proxyUrl !== null) {
        launchArgs.push(`--proxy-server=${input.proxyUrl}`);
    }
    const shouldHeadless = input.command === "runtime.login" ? false : shouldLaunchHeadless(input.params);
    const executionSurface = shouldHeadless ? "headless_browser" : "real_browser";
    if (shouldHeadless) {
        launchArgs.push("--headless=new");
    }
    launchArgs.push(startUrl);
    const fingerprintAuditContext = resolveFingerprintAuditContext({
        extensionBootstrap,
        fingerprintRuntime: input.fingerprintRuntime ?? null
    });
    const launchSurfaceAudit = buildBrowserLaunchSurfaceAudit({
        launchMode,
        profileDir: input.profileDir,
        launchArgs,
        headless: shouldHeadless,
        executionSurface,
        extensionBootstrap,
        fingerprintAuditContext
    });
    const launchToken = randomUUID();
    const artifactPaths = getBrowserInstanceArtifactPaths(input.profileDir);
    let controllerPid = null;
    let launchSucceeded = false;
    try {
        const reusable = await resolveReusableBrowserInstance({
            profileDir: input.profileDir,
            executablePath,
            runId: input.runId,
            headless: shouldHeadless,
            executionSurface,
            launchArgs,
            launchSurfaceAudit,
            stateFilePath: artifactPaths.stateFilePath
        });
        if (reusable) {
            return reusable;
        }
        await assertProfileLaunchBoundaryClear(input.profileDir);
        await prepareBrowserInstanceArtifacts(input.profileDir);
        const launched = await launchProcess(supervisorScriptPath, executablePath, launchArgs, {
            stateFilePath: artifactPaths.stateFilePath,
            controlFilePath: artifactPaths.controlFilePath,
            launchToken,
            profileDir: input.profileDir,
            runId: input.runId
        });
        controllerPid = launched.pid;
        const state = await waitForBrowserInstanceState({
            stateFilePath: artifactPaths.stateFilePath,
            expectedToken: launchToken,
            expectedControllerPid: launched.pid
        });
        await waitForBrowserReady(input.profileDir, state.browserPid, launched.launchedAtMs, artifactPaths.stateFilePath, state.processOwnership, state.controllerPid);
        const pinnedState = await pinExternalBrowserPidFromProfileLock({
            profileDir: input.profileDir,
            fallbackState: state
        });
        const pinnedStateWithAudit = {
            ...pinnedState,
            launchSurfaceAudit
        };
        await writeBrowserInstanceStateAtomic(artifactPaths.stateFilePath, pinnedStateWithAudit);
        launchSucceeded = true;
        return {
            browserPath: executablePath,
            browserPid: pinnedStateWithAudit.browserPid,
            controllerPid: pinnedStateWithAudit.controllerPid,
            launchArgs: [...launchArgs],
            launchedAt: launched.launchedAt,
            headless: shouldHeadless,
            executionSurface,
            launchSurface: pinnedStateWithAudit.launchSurface,
            processOwnership: pinnedStateWithAudit.processOwnership
        };
    }
    catch (error) {
        await cleanupFailedBrowserLaunch({
            profileDir: input.profileDir,
            controllerPid
        });
        if (error instanceof BrowserLaunchError) {
            throw error;
        }
        throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器启动失败", {
            cause: error
        });
    }
    finally {
        if (!launchSucceeded && launchMode === "load_extension") {
            await cleanupStagedExtensions(input.profileDir);
        }
    }
};
export const shutdownBrowserSession = async (input) => {
    const timeoutMs = input.timeoutMs ?? SUPERVISOR_SHUTDOWN_TIMEOUT_MS;
    const artifactPaths = getBrowserInstanceArtifactPaths(input.profileDir);
    const state = await readBrowserInstanceState(artifactPaths.stateFilePath);
    if (!state) {
        throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器实例状态缺失，无法安全停止");
    }
    if (state.controllerPid !== input.controllerPid) {
        throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器控制进程与锁所有者不一致");
    }
    if (state.runId !== input.runId) {
        throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器实例 run_id 与 stop 请求不一致");
    }
    if (!isProcessAlive(input.controllerPid)) {
        if (state.processOwnership === "external_persistent_app") {
            await cleanupSupervisorArtifacts(input.profileDir);
            await cleanupStagedExtensions(input.profileDir);
            return;
        }
        if (await terminateBrowserPid(state.browserPid, timeoutMs)) {
            await cleanupSupervisorArtifacts(input.profileDir);
            await cleanupStagedExtensions(input.profileDir);
            return;
        }
        throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器控制进程已断开，且孤儿浏览器关闭超时");
    }
    const command = {
        action: "shutdown",
        launchToken: state.launchToken,
        requestedAt: new Date().toISOString()
    };
    await writeFile(artifactPaths.controlFilePath, `${JSON.stringify(command, null, 2)}\n`, "utf8");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const controllerAlive = isProcessAlive(input.controllerPid);
        const nextState = await readBrowserInstanceState(artifactPaths.stateFilePath);
        if (!controllerAlive && nextState === null) {
            await cleanupStagedExtensions(input.profileDir);
            return;
        }
        await sleep(100);
    }
    if (isProcessAlive(input.controllerPid)) {
        try {
            process.kill(input.controllerPid, "SIGTERM");
        }
        catch {
            // ignore signal failure
        }
    }
    const gracefulDeadline = Date.now() + 1_000;
    while (Date.now() < gracefulDeadline) {
        const controllerAlive = isProcessAlive(input.controllerPid);
        const nextState = await readBrowserInstanceState(artifactPaths.stateFilePath);
        if (!controllerAlive && nextState === null) {
            await cleanupStagedExtensions(input.profileDir);
            return;
        }
        await sleep(100);
    }
    if (state.processOwnership === "external_persistent_app") {
        await cleanupSupervisorArtifacts(input.profileDir);
        await cleanupStagedExtensions(input.profileDir);
        return;
    }
    if (await terminateBrowserPid(state.browserPid, 1_000)) {
        await cleanupSupervisorArtifacts(input.profileDir);
        await cleanupStagedExtensions(input.profileDir);
        return;
    }
    throw new BrowserLaunchError("BROWSER_LAUNCH_FAILED", "浏览器控制进程关闭超时");
};
