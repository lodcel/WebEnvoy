import { ensureFingerprintRuntimeContext } from "../shared/fingerprint-profile.js";
import { installFingerprintRuntimeViaMainWorld, verifyFingerprintRuntimeViaMainWorld } from "./content-script-main-world.js";
const AUDIO_PATCH_EPSILON = 1e-12;
const FINGERPRINT_PROBE_TIMEOUT_MS = 1_500;
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asString = (value) => typeof value === "string" && value.length > 0 ? value : null;
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const withFingerprintProbeTimeout = async (promise, fallback) => await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
        if (settled) {
            return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(value);
    };
    const timer = setTimeout(() => finish(fallback), FINGERPRINT_PROBE_TIMEOUT_MS);
    promise.then(finish).catch(() => finish(fallback));
});
const cloneFingerprintRuntimeContextWithInjection = (runtime, injection) => injection
    ? {
        ...runtime,
        injection: JSON.parse(JSON.stringify(injection))
    }
    : { ...runtime };
const resolveAttestedFingerprintRuntimeContext = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const injection = asRecord(record.injection);
    const direct = ensureFingerprintRuntimeContext(record);
    if (direct) {
        return cloneFingerprintRuntimeContextWithInjection(direct, injection);
    }
    const sanitized = { ...record };
    delete sanitized.injection;
    const normalized = ensureFingerprintRuntimeContext(sanitized);
    return normalized ? cloneFingerprintRuntimeContextWithInjection(normalized, injection) : null;
};
const resolveFingerprintContextFromCommandParams = (commandParams) => asRecord(commandParams.fingerprint_context) ?? asRecord(commandParams.fingerprint_runtime) ?? null;
export const resolveFingerprintContextFromMessage = (message) => {
    const direct = resolveAttestedFingerprintRuntimeContext(message.fingerprintContext ?? null);
    if (direct) {
        return direct;
    }
    const fallback = resolveAttestedFingerprintRuntimeContext(resolveFingerprintContextFromCommandParams(message.commandParams));
    return fallback ?? null;
};
const resolveRequiredFingerprintPatches = (fingerprintRuntime) => asStringArray(asRecord(fingerprintRuntime.fingerprint_patch_manifest)?.required_patches);
export const buildFailedFingerprintInjectionContext = (fingerprintRuntime, errorMessage) => {
    const requiredPatches = resolveRequiredFingerprintPatches(fingerprintRuntime);
    return {
        ...fingerprintRuntime,
        injection: {
            installed: false,
            required_patches: requiredPatches,
            missing_required_patches: requiredPatches,
            error: errorMessage
        }
    };
};
export const hasInstalledFingerprintInjection = (fingerprintRuntime) => {
    const existingInjection = asRecord(fingerprintRuntime.injection);
    return (existingInjection?.installed === true &&
        asStringArray(existingInjection.missing_required_patches).length === 0);
};
export const resolveMissingRequiredFingerprintPatches = (fingerprintRuntime) => {
    const injection = asRecord(fingerprintRuntime.injection);
    const requiredPatches = asStringArray(injection?.required_patches);
    const missingRequiredPatches = asStringArray(injection?.missing_required_patches);
    if (missingRequiredPatches.length > 0) {
        return missingRequiredPatches;
    }
    if (injection?.installed === true) {
        return [];
    }
    return requiredPatches;
};
export const summarizeFingerprintRuntimeContext = (fingerprintRuntime) => {
    if (!fingerprintRuntime) {
        return null;
    }
    const record = fingerprintRuntime;
    const execution = asRecord(record.execution);
    const injection = asRecord(record.injection);
    return {
        profile: asString(record.profile),
        source: asString(record.source),
        execution: execution
            ? {
                live_allowed: execution.live_allowed === true,
                live_decision: asString(execution.live_decision),
                allowed_execution_modes: asStringArray(execution.allowed_execution_modes),
                reason_codes: asStringArray(execution.reason_codes)
            }
            : null,
        injection: injection
            ? {
                installed: injection.installed === true,
                source: asString(injection.source),
                required_patches: asStringArray(injection.required_patches),
                missing_required_patches: asStringArray(injection.missing_required_patches),
                error: asString(injection.error)
            }
            : null
    };
};
export const resolveFingerprintContextForContract = (message) => resolveFingerprintContextFromMessage({
    commandParams: message.commandParams,
    fingerprintContext: message.fingerprintContext
});
const probeAudioFirstSample = async () => {
    const offlineAudioCtor = typeof window.OfflineAudioContext === "function"
        ? window.OfflineAudioContext
        : typeof window
            .webkitOfflineAudioContext === "function"
            ? window
                .webkitOfflineAudioContext ?? null
            : null;
    if (!offlineAudioCtor) {
        return null;
    }
    try {
        const offlineAudioContext = new offlineAudioCtor(1, 256, 44_100);
        const renderedBuffer = await withFingerprintProbeTimeout(offlineAudioContext.startRendering(), null);
        if (!renderedBuffer || typeof renderedBuffer.getChannelData !== "function") {
            return null;
        }
        const channelData = renderedBuffer.getChannelData(0);
        if (!channelData || typeof channelData.length !== "number" || channelData.length < 1) {
            return null;
        }
        const firstSample = Number(channelData[0]);
        return Number.isFinite(firstSample) ? firstSample : null;
    }
    catch {
        return null;
    }
};
const probeBatteryApi = async () => {
    const getBattery = window.navigator
        .getBattery;
    if (typeof getBattery !== "function") {
        return false;
    }
    try {
        const battery = asRecord(await withFingerprintProbeTimeout(getBattery(), null));
        return typeof battery?.level === "number" && typeof battery?.charging === "boolean";
    }
    catch {
        return false;
    }
};
const probeNavigatorPlugins = () => {
    const plugins = window.navigator.plugins;
    return (typeof plugins === "object" &&
        plugins !== null &&
        typeof plugins.length === "number" &&
        Number(plugins.length) > 0);
};
const probeNavigatorMimeTypes = () => {
    const mimeTypes = window.navigator.mimeTypes;
    return (typeof mimeTypes === "object" &&
        mimeTypes !== null &&
        typeof mimeTypes.length === "number" &&
        Number(mimeTypes.length) > 0);
};
const verifyFingerprintInstallResult = async (input) => {
    const requiredPatches = resolveRequiredFingerprintPatches(input.fingerprintRuntime);
    const reportedAppliedPatches = asStringArray(input.installResult?.applied_patches);
    const mainWorldVerification = requiredPatches.includes("battery")
        ? asRecord(await verifyFingerprintRuntimeViaMainWorld().catch(() => null))
        : null;
    const appliedPatches = [];
    const missingRequiredPatches = [];
    const probeDetails = {};
    if (requiredPatches.includes("audio_context")) {
        const postInstallAudioSample = await probeAudioFirstSample();
        const audioPatched = reportedAppliedPatches.includes("audio_context") ||
            (postInstallAudioSample !== null &&
                (input.preInstallAudioSample === null ||
                    Math.abs(postInstallAudioSample - input.preInstallAudioSample) > AUDIO_PATCH_EPSILON));
        probeDetails.audio_context = {
            pre_install_first_sample: input.preInstallAudioSample,
            post_install_first_sample: postInstallAudioSample,
            verified: audioPatched
        };
        if (audioPatched) {
            appliedPatches.push("audio_context");
        }
        else {
            missingRequiredPatches.push("audio_context");
        }
    }
    if (requiredPatches.includes("battery")) {
        const isolatedWorldBatteryPatched = await probeBatteryApi();
        const mainWorldBatteryPatched = mainWorldVerification?.has_get_battery === true;
        const batteryPatched = isolatedWorldBatteryPatched || mainWorldBatteryPatched;
        probeDetails.battery = {
            verified: batteryPatched,
            isolated_world_verified: isolatedWorldBatteryPatched,
            main_world_verified: mainWorldBatteryPatched,
            reported_applied: reportedAppliedPatches.includes("battery")
        };
        if (batteryPatched) {
            appliedPatches.push("battery");
        }
        else {
            missingRequiredPatches.push("battery");
        }
    }
    if (requiredPatches.includes("navigator_plugins")) {
        const pluginsPatched = probeNavigatorPlugins();
        probeDetails.navigator_plugins = { verified: pluginsPatched };
        if (pluginsPatched) {
            appliedPatches.push("navigator_plugins");
        }
        else {
            missingRequiredPatches.push("navigator_plugins");
        }
    }
    if (requiredPatches.includes("navigator_mime_types")) {
        const mimeTypesPatched = probeNavigatorMimeTypes();
        probeDetails.navigator_mime_types = { verified: mimeTypesPatched };
        if (mimeTypesPatched) {
            appliedPatches.push("navigator_mime_types");
        }
        else {
            missingRequiredPatches.push("navigator_mime_types");
        }
    }
    for (const patchName of requiredPatches) {
        if (!appliedPatches.includes(patchName) && !missingRequiredPatches.includes(patchName)) {
            missingRequiredPatches.push(patchName);
        }
    }
    return {
        ...(input.installResult ?? {}),
        installed: missingRequiredPatches.length === 0,
        required_patches: requiredPatches,
        applied_patches: appliedPatches,
        missing_required_patches: missingRequiredPatches,
        verification: {
            channel: "isolated_world_probes",
            probes: probeDetails
        }
    };
};
export const installFingerprintRuntimeWithVerification = async (fingerprintRuntime) => {
    const requiredPatches = resolveRequiredFingerprintPatches(fingerprintRuntime);
    const preInstallAudioSample = requiredPatches.includes("audio_context")
        ? await probeAudioFirstSample()
        : null;
    const installResult = await installFingerprintRuntimeViaMainWorld(fingerprintRuntime);
    return await verifyFingerprintInstallResult({
        fingerprintRuntime,
        installResult: asRecord(installResult),
        preInstallAudioSample
    });
};
