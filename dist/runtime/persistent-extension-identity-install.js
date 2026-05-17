import { constants as fsConstants } from "node:fs";
import { access, lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { inspectManagedNativeHostInstall } from "../install/native-host-install-root.js";
import { resolveManifestPathForChannel } from "../install/native-host-platform.js";
const EMPTY_INSTALL_DIAGNOSTICS = {
    launcherPath: null,
    launcherExists: null,
    launcherExecutable: null,
    bundleRuntimePath: null,
    bundleRuntimeExists: null,
    launcherProfileRoot: null,
    expectedProfileRoot: null,
    profileRootMatches: null,
    legacyLauncherDetected: null
};
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
export const normalizePathForComparison = (input) => {
    const normalized = resolve(input);
    return normalized.startsWith("/private/var/") ? normalized.slice("/private".length) : normalized;
};
const expandWindowsEnvVariables = (value) => value.replace(/%([^%]+)%/g, (_match, name) => process.env[name] ?? `%${name}%`);
const parseWindowsRegistryDefaultValue = (stdout) => {
    const lines = stdout.split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/^\s*\(Default\)\s+REG_\w+\s+(.+?)\s*$/);
        if (match) {
            const expanded = expandWindowsEnvVariables(match[1].trim());
            return isAbsolute(expanded) ? expanded : resolve(expanded);
        }
    }
    return null;
};
const resolveWindowsRegistryKeyForChannel = (browserChannel, nativeHostName, platform) => {
    if (platform !== "win32") {
        return null;
    }
    const keyByChannel = {
        chrome: "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts",
        chrome_beta: "HKCU\\Software\\Google\\Chrome Beta\\NativeMessagingHosts",
        chromium: "HKCU\\Software\\Chromium\\NativeMessagingHosts",
        brave: "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts",
        edge: "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts"
    };
    return `${keyByChannel[browserChannel]}\\${nativeHostName}`;
};
export const resolveManifestPathForBinding = async (binding, adapters) => {
    if (binding.manifestPath) {
        return {
            manifestPath: binding.manifestPath,
            manifestSource: "binding"
        };
    }
    if (adapters.platform() === "win32") {
        const registryKey = resolveWindowsRegistryKeyForChannel(binding.browserChannel, binding.nativeHostName, adapters.platform());
        if (registryKey) {
            try {
                const { stdout } = await adapters.execFile("reg", ["query", registryKey, "/ve"], {
                    encoding: "utf8"
                });
                const manifestPath = parseWindowsRegistryDefaultValue(stdout);
                if (manifestPath) {
                    return {
                        manifestPath,
                        manifestSource: "windows_registry"
                    };
                }
            }
            catch {
                // Registry lookup failed; caller will handle the missing path as a blocking preflight result.
            }
        }
        return {
            manifestPath: null,
            manifestSource: null
        };
    }
    return {
        manifestPath: resolveManifestPathForChannel(binding.browserChannel, binding.nativeHostName, adapters.platform()),
        manifestSource: "browser_default"
    };
};
export const readNativeHostManifest = async (manifestPath) => {
    try {
        const raw = await readFile(manifestPath, "utf8");
        const parsed = JSON.parse(raw);
        const name = asNonEmptyString(parsed.name);
        const launcherPath = asNonEmptyString(parsed.path);
        const allowedOrigins = Array.isArray(parsed.allowed_origins)
            ? parsed.allowed_origins.filter((entry) => typeof entry === "string")
            : [];
        if (!name) {
            return null;
        }
        return {
            name,
            allowed_origins: allowedOrigins,
            path: launcherPath ? (isAbsolute(launcherPath) ? launcherPath : resolve(dirname(manifestPath), launcherPath)) : null
        };
    }
    catch {
        return null;
    }
};
const readManagedInstallMetadata = async (channelRoot) => {
    try {
        const raw = await readFile(join(channelRoot, "install-metadata.json"), "utf8");
        const parsed = JSON.parse(raw);
        const profileRoot = asNonEmptyString(parsed.profile_root);
        const bundleRuntimeExpected = typeof parsed.bundle_runtime_expected === "boolean"
            ? parsed.bundle_runtime_expected
            : null;
        return {
            profileRoot: profileRoot ? normalizePathForComparison(profileRoot) : null,
            bundleRuntimeExpected
        };
    }
    catch {
        return {
            profileRoot: null,
            bundleRuntimeExpected: null
        };
    }
};
const managedBundleFilesExist = async (channelRoot) => {
    const requiredPaths = [
        join(channelRoot, "runtime", "native-messaging", "native-host-entry.js"),
        join(channelRoot, "runtime", "native-messaging", "host.js"),
        join(channelRoot, "runtime", "native-messaging", "protocol.js"),
        join(channelRoot, "runtime", "worktree-root.js"),
        join(channelRoot, "runtime", "package.json")
    ];
    try {
        await Promise.all(requiredPaths.map(async (requiredPath) => await access(requiredPath)));
        return true;
    }
    catch {
        return false;
    }
};
const inferManagedBundleExpectationFromLauncher = async (launcherPath, channelRoot) => {
    try {
        const launcherRaw = await readFile(launcherPath, "utf8");
        const bundledEntryPath = normalizePathForComparison(join(channelRoot, "runtime", "native-messaging", "native-host-entry.js"));
        return launcherRaw.includes(bundledEntryPath);
    }
    catch {
        return true;
    }
};
const managedLauncherExecutable = async (launcherPath, platform) => {
    if (platform === "win32") {
        return true;
    }
    try {
        await access(launcherPath, fsConstants.X_OK);
        return true;
    }
    catch {
        return false;
    }
};
export const resolveInstallDiagnostics = async (input) => {
    if (!input.manifest?.path) {
        return EMPTY_INSTALL_DIAGNOSTICS;
    }
    const managedInstall = inspectManagedNativeHostInstall(input.manifest.path);
    const bundleRuntimePath = managedInstall
        ? join(managedInstall.runtimeRoot, "native-messaging", "native-host-entry.js")
        : null;
    const managedInstallMetadata = managedInstall
        ? await readManagedInstallMetadata(managedInstall.channelRoot)
        : { profileRoot: null, bundleRuntimeExpected: null };
    let launcherExists = false;
    let launcherExecutable = null;
    let bundleRuntimeExists = null;
    const expectedProfileRoot = input.profileDir ? normalizePathForComparison(dirname(input.profileDir)) : null;
    const launcherProfileRoot = managedInstallMetadata.profileRoot;
    const profileRootMatches = expectedProfileRoot === null
        ? null
        : managedInstall
            ? launcherProfileRoot === expectedProfileRoot
            : launcherProfileRoot === null
                ? null
                : launcherProfileRoot === expectedProfileRoot;
    const legacyLauncherDetected = managedInstall === null &&
        input.manifestPath !== null &&
        normalizePathForComparison(dirname(input.manifest.path)) ===
            normalizePathForComparison(dirname(input.manifestPath)) &&
        input.manifest.path.endsWith(`${input.manifest.name}-launcher`);
    try {
        await access(input.manifest.path);
        launcherExists = true;
    }
    catch {
        launcherExists = false;
    }
    if (launcherExists && managedInstall) {
        launcherExecutable = await managedLauncherExecutable(input.manifest.path, input.platform);
    }
    if (bundleRuntimePath) {
        const bundleRuntimeExpected = managedInstallMetadata.bundleRuntimeExpected ??
            (managedInstall
                ? await inferManagedBundleExpectationFromLauncher(input.manifest.path, managedInstall.channelRoot)
                : null);
        bundleRuntimeExists =
            managedInstall && bundleRuntimeExpected === true
                ? await managedBundleFilesExist(managedInstall.channelRoot)
                : null;
    }
    return {
        launcherPath: input.manifest.path,
        launcherExists,
        launcherExecutable,
        bundleRuntimePath,
        bundleRuntimeExists,
        launcherProfileRoot,
        expectedProfileRoot,
        profileRootMatches,
        legacyLauncherDetected
    };
};
const readProfileExtensionStateFromPreferences = (input, extensionId) => {
    const extensions = asRecord(input.extensions);
    const settings = asRecord(extensions?.settings);
    const extensionEntry = asRecord(settings?.[extensionId]);
    if (!extensionEntry) {
        return {
            state: "missing",
            unpackedPath: null
        };
    }
    const state = extensionEntry.state;
    const unpackedPath = extensionEntry.location === 4 && asNonEmptyString(extensionEntry.path)
        ? asNonEmptyString(extensionEntry.path)
        : null;
    if (state === 1 || state === true) {
        return {
            state: "enabled",
            unpackedPath
        };
    }
    if (typeof state === "number" || typeof state === "boolean") {
        return {
            state: "disabled",
            unpackedPath
        };
    }
    return {
        state: "enabled",
        unpackedPath
    };
};
const resolveLatestMtimeMs = async (path) => {
    let latest = null;
    const rootPath = await realpath(path).catch(() => path);
    const pending = [rootPath];
    while (pending.length > 0) {
        const currentPath = pending.pop();
        if (!currentPath) {
            continue;
        }
        let stat;
        try {
            stat = await lstat(currentPath);
        }
        catch {
            continue;
        }
        if (stat.isSymbolicLink()) {
            continue;
        }
        if (!stat.isDirectory()) {
            latest = latest === null ? stat.mtimeMs : Math.max(latest, stat.mtimeMs);
            continue;
        }
        let entries;
        try {
            entries = await readdir(currentPath, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.name === "node_modules" || entry.name === ".git") {
                continue;
            }
            pending.push(join(currentPath, entry.name));
        }
    }
    return latest;
};
const resolveFileMtimeMs = async (path) => {
    try {
        const stat = await lstat(path);
        if (stat.isSymbolicLink()) {
            const resolvedPath = await realpath(path);
            const resolvedStat = await lstat(resolvedPath);
            return resolvedStat.isDirectory() ? null : resolvedStat.mtimeMs;
        }
        return stat.isDirectory() ? null : stat.mtimeMs;
    }
    catch {
        return null;
    }
};
const resolveExtensionBundleLatestMtimeMs = async (extensionPath) => {
    const manifestPath = join(extensionPath, "manifest.json");
    const buildLatestMtimeMs = await resolveLatestMtimeMs(join(extensionPath, "build"));
    const bundlePaths = new Set([manifestPath]);
    try {
        const raw = await readFile(manifestPath, "utf8");
        const manifest = asRecord(JSON.parse(raw));
        const background = manifest ? asRecord(manifest.background) : null;
        const serviceWorkerPath = background ? asNonEmptyString(background.service_worker) : null;
        if (serviceWorkerPath) {
            bundlePaths.add(join(extensionPath, serviceWorkerPath));
        }
    }
    catch {
        // Missing or invalid manifest falls back to the conventional built background bundle path.
    }
    let latest = null;
    if (buildLatestMtimeMs !== null) {
        latest = buildLatestMtimeMs;
    }
    for (const bundlePath of bundlePaths) {
        const mtimeMs = await resolveFileMtimeMs(bundlePath);
        if (mtimeMs !== null) {
            latest = latest === null ? mtimeMs : Math.max(latest, mtimeMs);
        }
    }
    return latest;
};
const isTargetServiceWorkerCacheFile = async (path, extensionId) => {
    if (path.includes(extensionId)) {
        return true;
    }
    try {
        const content = await readFile(path);
        return (content.includes(Buffer.from(extensionId)) ||
            content.includes(Buffer.from(`chrome-extension://${extensionId}`)));
    }
    catch {
        return false;
    }
};
const resolveTargetExtensionReferenceLatestMtimeMs = async (path, extensionId) => {
    let latest = null;
    const rootPath = await realpath(path).catch(() => path);
    const pending = [rootPath];
    while (pending.length > 0) {
        const currentPath = pending.pop();
        if (!currentPath) {
            continue;
        }
        let stat;
        try {
            stat = await lstat(currentPath);
        }
        catch {
            continue;
        }
        if (stat.isSymbolicLink()) {
            continue;
        }
        if (!stat.isDirectory()) {
            if (await isTargetServiceWorkerCacheFile(currentPath, extensionId)) {
                latest = latest === null ? stat.mtimeMs : Math.max(latest, stat.mtimeMs);
            }
            continue;
        }
        let entries;
        try {
            entries = await readdir(currentPath, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            pending.push(join(currentPath, entry.name));
        }
    }
    return latest;
};
const resolveTargetServiceWorkerCacheLatestMtimeMs = async (serviceWorkerPath, extensionId) => {
    let latest = null;
    const scriptCachePath = join(serviceWorkerPath, "ScriptCache");
    const rootPath = await realpath(scriptCachePath).catch(() => scriptCachePath);
    const pending = [rootPath];
    while (pending.length > 0) {
        const currentPath = pending.pop();
        if (!currentPath) {
            continue;
        }
        let stat;
        try {
            stat = await lstat(currentPath);
        }
        catch {
            continue;
        }
        if (stat.isSymbolicLink()) {
            continue;
        }
        if (!stat.isDirectory()) {
            if (await isTargetServiceWorkerCacheFile(currentPath, extensionId)) {
                latest = latest === null ? stat.mtimeMs : Math.max(latest, stat.mtimeMs);
            }
            continue;
        }
        let entries;
        try {
            entries = await readdir(currentPath, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            pending.push(join(currentPath, entry.name));
        }
    }
    if (latest !== null) {
        return latest;
    }
    return (await resolveTargetExtensionReferenceLatestMtimeMs(join(serviceWorkerPath, "Database"), extensionId)) !== null
        ? 0
        : null;
};
const resolveEnabledUnpackedPath = async (profileDir, extensionId) => {
    const preferenceCandidates = [
        join(profileDir, "Default", "Preferences"),
        join(profileDir, "Default", "Secure Preferences"),
        join(profileDir, "Secure Preferences")
    ];
    for (const preferencePath of preferenceCandidates) {
        try {
            const raw = await readFile(preferencePath, "utf8");
            const parsed = JSON.parse(raw);
            const record = asRecord(parsed);
            if (!record) {
                continue;
            }
            const preferenceState = readProfileExtensionStateFromPreferences(record, extensionId);
            if (preferenceState.state === "enabled" && preferenceState.unpackedPath) {
                return preferenceState.unpackedPath;
            }
        }
        catch {
            // ignore preference file read/parse failures and continue probing
        }
    }
    return null;
};
export const resolveProfileExtensionServiceWorkerFreshness = async (profileDir, extensionId) => {
    const serviceWorkerPath = join(profileDir, "Default", "Service Worker");
    const extensionPath = await resolveEnabledUnpackedPath(profileDir, extensionId);
    const recoveryHint = "Stop the WebEnvoy-managed runtime, refresh only this managed profile's Default/Service Worker cache, then rerun runtime.install/runtime.start; do not touch a daily Chrome profile.";
    if (!extensionPath) {
        return {
            state: "not_applicable",
            reason: "PROFILE_EXTENSION_NOT_UNPACKED",
            extensionId,
            extensionPath: null,
            extensionLatestMtimeMs: null,
            serviceWorkerPath,
            serviceWorkerLatestMtimeMs: null,
            recoveryHint: null
        };
    }
    const extensionLatestMtimeMs = await resolveExtensionBundleLatestMtimeMs(extensionPath);
    if (extensionLatestMtimeMs === null) {
        return {
            state: "unknown",
            reason: "EXTENSION_SOURCE_MTIME_UNAVAILABLE",
            extensionId,
            extensionPath,
            extensionLatestMtimeMs: null,
            serviceWorkerPath,
            serviceWorkerLatestMtimeMs: null,
            recoveryHint: null
        };
    }
    const serviceWorkerLatestMtimeMs = await resolveTargetServiceWorkerCacheLatestMtimeMs(serviceWorkerPath, extensionId);
    if (serviceWorkerLatestMtimeMs === null) {
        return {
            state: "unknown",
            reason: "SERVICE_WORKER_CACHE_MISSING",
            extensionId,
            extensionPath,
            extensionLatestMtimeMs,
            serviceWorkerPath,
            serviceWorkerLatestMtimeMs: null,
            recoveryHint: null
        };
    }
    if (extensionLatestMtimeMs > serviceWorkerLatestMtimeMs) {
        return {
            state: "stale",
            reason: "SERVICE_WORKER_CACHE_OLDER_THAN_EXTENSION_BUILD",
            extensionId,
            extensionPath,
            extensionLatestMtimeMs,
            serviceWorkerPath,
            serviceWorkerLatestMtimeMs,
            recoveryHint
        };
    }
    return {
        state: "fresh",
        reason: "SERVICE_WORKER_CACHE_CURRENT",
        extensionId,
        extensionPath,
        extensionLatestMtimeMs,
        serviceWorkerPath,
        serviceWorkerLatestMtimeMs,
        recoveryHint: null
    };
};
export const resolveProfileExtensionState = async (profileDir, extensionId) => {
    const preferenceCandidates = [
        join(profileDir, "Default", "Preferences"),
        join(profileDir, "Default", "Secure Preferences"),
        join(profileDir, "Secure Preferences")
    ];
    let foundDisabled = false;
    let enabledInPreferences = false;
    let unpackedPath = null;
    for (const preferencePath of preferenceCandidates) {
        try {
            const raw = await readFile(preferencePath, "utf8");
            const parsed = JSON.parse(raw);
            const record = asRecord(parsed);
            if (!record) {
                continue;
            }
            const preferenceState = readProfileExtensionStateFromPreferences(record, extensionId);
            if (preferenceState.state === "enabled") {
                enabledInPreferences = true;
                if (preferenceState.unpackedPath) {
                    unpackedPath = preferenceState.unpackedPath;
                }
                continue;
            }
            if (preferenceState.state === "disabled") {
                foundDisabled = true;
            }
        }
        catch {
            // ignore preference file read/parse failures and continue probing
        }
    }
    if (!enabledInPreferences) {
        return foundDisabled ? "disabled" : "missing";
    }
    if (unpackedPath) {
        try {
            await access(unpackedPath);
            return "enabled";
        }
        catch {
            return "missing";
        }
    }
    try {
        const installedVersions = await readdir(join(profileDir, "Default", "Extensions", extensionId));
        return installedVersions.length > 0 ? "enabled" : "missing";
    }
    catch {
        return "missing";
    }
};
