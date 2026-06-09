import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { CliError } from "../core/errors.js";
import type { JsonObject } from "../core/types.js";
import {
  BrowserLaunchError,
  isUnsupportedBrandedChromeForExtensions,
  resolvePreferredBrowserVersionTruthSource
} from "./browser-launcher.js";
import {
  inferPersistentExtensionBrowserChannel,
  parsePersistentExtensionBindingFromParams,
  readPersistentExtensionBindingFromMetaValue
} from "./persistent-extension-binding.js";
import {
  type IdentityPreflightInstallDiagnostics,
  type ExtensionServiceWorkerFreshnessDiagnostics,
  type IdentityManifestAdapters,
  type ManifestSource,
  readNativeHostManifest,
  resolveProfileExtensionServiceWorkerFreshness,
  resolveInstallDiagnostics,
  resolveManifestPathForBinding,
  resolveProfileExtensionState
} from "./persistent-extension-identity-install.js";
import type { ProfileMeta, PersistentExtensionBinding } from "./profile-store.js";

export type IdentityBindingState = "not_applicable" | "missing" | "bound" | "mismatch";
export type RuntimeIdentityMode = "load_extension" | "official_chrome_persistent_extension";

export interface IdentityPreflightResult {
  mode: RuntimeIdentityMode;
  browserPath: string | null;
  browserVersion: string | null;
  identityBindingState: IdentityBindingState;
  binding: PersistentExtensionBinding | null;
  manifestPath: string | null;
  manifestSource: ManifestSource | null;
  expectedOrigin: string | null;
  allowedOrigins: string[];
  installDiagnostics: IdentityPreflightInstallDiagnostics;
  extensionServiceWorkerFreshness: ExtensionServiceWorkerFreshnessDiagnostics | null;
  blocking: boolean;
  failureReason:
    | "IDENTITY_PREFLIGHT_NOT_REQUIRED"
    | "IDENTITY_PREFLIGHT_PASSED"
    | "IDENTITY_BINDING_MISSING"
    | "IDENTITY_BINDING_INVALID"
    | "IDENTITY_MANIFEST_MISSING"
    | "IDENTITY_NATIVE_HOST_NAME_MISMATCH"
    | "IDENTITY_ALLOWED_ORIGIN_MISSING"
    | "IDENTITY_BINDING_CONFLICT"
    | "EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED"
    | "EXTENSION_SERVICE_WORKER_EXPECTED_IDENTITY_MISSING"
    | "EXTENSION_SERVICE_WORKER_OBSERVATION_REQUIRED"
    | "EXTENSION_SERVICE_WORKER_IDENTITY_UNKNOWN"
    | "BOOTSTRAP_PENDING";
}

const execFileAsync = promisify(execFile);

interface IdentityPreflightAdapters extends IdentityManifestAdapters {
  resolvePreferredBrowserVersionTruthSource: typeof resolvePreferredBrowserVersionTruthSource;
  isUnsupportedBrandedChromeForExtensions: typeof isUnsupportedBrandedChromeForExtensions;
}

const DEFAULT_IDENTITY_PREFLIGHT_ADAPTERS: IdentityPreflightAdapters = {
  resolvePreferredBrowserVersionTruthSource,
  isUnsupportedBrandedChromeForExtensions,
  execFile: execFileAsync,
  platform: () => process.platform
};

let identityPreflightAdapters: IdentityPreflightAdapters = DEFAULT_IDENTITY_PREFLIGHT_ADAPTERS;
const EMPTY_INSTALL_DIAGNOSTICS: IdentityPreflightInstallDiagnostics = {
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

const isProviderBlockingServiceWorkerCodeIdentity = (
  freshness: ExtensionServiceWorkerFreshnessDiagnostics
): boolean => {
  const extensionLoadCheck =
    freshness.codeIdentityObservation?.provider_doctor_extension_load_check ?? null;
  return (
    extensionLoadCheck?.blocking === "provider_blocking" &&
    (extensionLoadCheck.status === "fail" || extensionLoadCheck.status === "unknown")
  );
};

const resolveServiceWorkerFailureReason = (
  freshness: ExtensionServiceWorkerFreshnessDiagnostics
): IdentityPreflightResult["failureReason"] => {
  const comparison =
    freshness.codeIdentityObservation?.freshness_comparison_result ?? null;
  if (freshness.state === "stale" || comparison === "observed_stale") {
    return "EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED";
  }
  if (comparison === "expected_identity_missing") {
    return "EXTENSION_SERVICE_WORKER_EXPECTED_IDENTITY_MISSING";
  }
  if (comparison === "observed_unknown") {
    return "EXTENSION_SERVICE_WORKER_IDENTITY_UNKNOWN";
  }
  if (comparison === "observed_identity_missing") {
    return "EXTENSION_SERVICE_WORKER_OBSERVATION_REQUIRED";
  }
  return "EXTENSION_SERVICE_WORKER_IDENTITY_UNKNOWN";
};

export const setIdentityPreflightAdaptersForTests = (
  overrides: Partial<IdentityPreflightAdapters>
): void => {
  identityPreflightAdapters = {
    ...DEFAULT_IDENTITY_PREFLIGHT_ADAPTERS,
    ...overrides
  };
};

export const resetIdentityPreflightAdaptersForTests = (): void => {
  identityPreflightAdapters = DEFAULT_IDENTITY_PREFLIGHT_ADAPTERS;
};

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const buildBlockingResult = (
  input: Omit<IdentityPreflightResult, "blocking">
): IdentityPreflightResult => ({
  ...input,
  blocking: true
});

export const buildIdentityPreflightError = (
  result: IdentityPreflightResult
): CliError => {
  const codeIdentityObservation = result.extensionServiceWorkerFreshness?.codeIdentityObservation ?? null;
  const details = {
    ability_id: "runtime.identity_preflight",
    stage: "execution" as const,
    reason: result.failureReason,
    identity_binding_state: result.identityBindingState,
    browser_mode: result.mode,
    browser_version: result.browserVersion,
    browser_path: result.browserPath,
    extension_id: result.binding?.extensionId ?? null,
    native_host_name: result.binding?.nativeHostName ?? null,
    browser_channel: result.binding?.browserChannel ?? null,
    manifest_path: result.manifestPath,
    manifest_source: result.manifestSource,
    expected_origin: result.expectedOrigin,
    allowed_origins: result.allowedOrigins,
    launcher_path: result.installDiagnostics.launcherPath,
    launcher_exists: result.installDiagnostics.launcherExists,
    launcher_executable: result.installDiagnostics.launcherExecutable,
    bundle_runtime_path: result.installDiagnostics.bundleRuntimePath,
    bundle_runtime_exists: result.installDiagnostics.bundleRuntimeExists,
    launcher_profile_root: result.installDiagnostics.launcherProfileRoot,
    expected_profile_root: result.installDiagnostics.expectedProfileRoot,
    profile_root_matches: result.installDiagnostics.profileRootMatches,
    legacy_launcher_detected: result.installDiagnostics.legacyLauncherDetected,
    extension_service_worker_freshness_state: result.extensionServiceWorkerFreshness?.state ?? null,
    extension_service_worker_freshness_reason: result.extensionServiceWorkerFreshness?.reason ?? null,
    extension_service_worker_extension_path: null,
    extension_service_worker_extension_mtime_ms:
      result.extensionServiceWorkerFreshness?.extensionLatestMtimeMs ?? null,
    extension_service_worker_cache_path: null,
    extension_service_worker_cache_mtime_ms:
      result.extensionServiceWorkerFreshness?.serviceWorkerLatestMtimeMs ?? null,
    extension_service_worker_code_identity: codeIdentityObservation,
    provider_doctor_extension_load_check:
      codeIdentityObservation?.provider_doctor_extension_load_check ?? null,
    extension_service_worker_expected_bundle_identity_locator:
      codeIdentityObservation?.expected_extension_bundle_identity_locator ?? null,
    extension_service_worker_observed_script_identity_locator:
      codeIdentityObservation?.observed_active_service_worker_script_identity_locator ?? null,
    extension_service_worker_expected_bundle_digest_locator:
      codeIdentityObservation?.expected_bundle_digest_locator ?? null,
    extension_service_worker_observed_code_digest_locator:
      codeIdentityObservation?.observed_service_worker_code_digest_locator ?? null,
    extension_service_worker_lifecycle_state:
      codeIdentityObservation?.active_worker_lifecycle_state ?? null,
    extension_service_worker_freshness_comparison_result:
      codeIdentityObservation?.freshness_comparison_result ?? null,
    recovery_hint: result.extensionServiceWorkerFreshness?.recoveryHint ?? null
  };

  if (result.failureReason === "EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED") {
    return new CliError(
      "ERR_EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED",
      "managed profile 的 persistent extension Service Worker 缓存早于当前 extension build，已阻止继续执行",
      { details, retryable: false }
    );
  }

  if (result.failureReason === "EXTENSION_SERVICE_WORKER_EXPECTED_IDENTITY_MISSING") {
    return new CliError(
      "ERR_RUNTIME_IDENTITY_MISMATCH",
      "official Chrome persistent extension 缺少预期 Service Worker 代码身份，已阻止继续执行",
      { details, retryable: false }
    );
  }

  if (result.failureReason === "EXTENSION_SERVICE_WORKER_OBSERVATION_REQUIRED") {
    return new CliError(
      "ERR_RUNTIME_IDENTITY_MISMATCH",
      "official Chrome persistent extension 缺少当前 active Service Worker 代码身份观测，已阻止继续执行",
      { details, retryable: false }
    );
  }

  if (result.failureReason === "EXTENSION_SERVICE_WORKER_IDENTITY_UNKNOWN") {
    return new CliError(
      "ERR_RUNTIME_IDENTITY_MISMATCH",
      "official Chrome persistent extension Service Worker 代码身份未知，已阻止继续执行",
      { details, retryable: false }
    );
  }

  if (result.failureReason === "BOOTSTRAP_PENDING") {
    return new CliError(
      "ERR_RUNTIME_BOOTSTRAP_PENDING",
      "identity preflight 已通过，但 persistent extension bootstrap 尚未实现",
      { details, retryable: false }
    );
  }

  if (result.identityBindingState === "missing") {
    return new CliError(
      "ERR_RUNTIME_IDENTITY_NOT_BOUND",
      "official Chrome persistent extension identity 未绑定，无法进入运行阶段",
      { details, retryable: false }
    );
  }

  return new CliError(
    "ERR_RUNTIME_IDENTITY_MISMATCH",
    "official Chrome persistent extension identity 不一致，已阻止继续执行",
    { details, retryable: false }
  );
};

export const runIdentityPreflight = async (input: {
  params: JsonObject;
  meta: ProfileMeta | null;
  profileDir?: string | null;
}): Promise<IdentityPreflightResult> => {
  let browserPath: string | null = null;
  let browserVersion: string | null = null;

  try {
    const truth = await identityPreflightAdapters.resolvePreferredBrowserVersionTruthSource(input.params);
    browserPath = truth.executablePath;
    browserVersion = truth.browserVersion;
  } catch (error) {
    if (!(error instanceof BrowserLaunchError)) {
      return {
        mode: "load_extension",
        browserPath: null,
        browserVersion: null,
        identityBindingState: "not_applicable",
        binding: null,
        manifestPath: null,
        manifestSource: null,
        expectedOrigin: null,
        allowedOrigins: [],
        installDiagnostics: EMPTY_INSTALL_DIAGNOSTICS,
        extensionServiceWorkerFreshness: null,
        blocking: false,
        failureReason: "IDENTITY_PREFLIGHT_NOT_REQUIRED"
      };
    }
    return {
      mode: "load_extension",
      browserPath: null,
      browserVersion: null,
      identityBindingState: "not_applicable",
      binding: null,
      manifestPath: null,
      manifestSource: null,
      expectedOrigin: null,
      allowedOrigins: [],
      installDiagnostics: EMPTY_INSTALL_DIAGNOSTICS,
      extensionServiceWorkerFreshness: null,
      blocking: false,
      failureReason: "IDENTITY_PREFLIGHT_NOT_REQUIRED"
    };
  }

  if (!identityPreflightAdapters.isUnsupportedBrandedChromeForExtensions(browserVersion)) {
    return {
      mode: "load_extension",
      browserPath,
      browserVersion,
      identityBindingState: "not_applicable",
      binding: null,
      manifestPath: null,
      manifestSource: null,
      expectedOrigin: null,
      allowedOrigins: [],
      installDiagnostics: EMPTY_INSTALL_DIAGNOSTICS,
      extensionServiceWorkerFreshness: null,
      blocking: false,
      failureReason: "IDENTITY_PREFLIGHT_NOT_REQUIRED"
    };
  }

  const binding =
    parsePersistentExtensionBindingFromParams(input.params) ??
    readPersistentExtensionBindingFromMetaValue(input.meta?.persistentExtensionBinding);
  if (!binding) {
    return buildBlockingResult({
      mode: "official_chrome_persistent_extension",
      browserPath,
      browserVersion,
      identityBindingState: "missing",
      binding: null,
      manifestPath: null,
      manifestSource: null,
      expectedOrigin: null,
      allowedOrigins: [],
      installDiagnostics: EMPTY_INSTALL_DIAGNOSTICS,
      extensionServiceWorkerFreshness: null,
      failureReason: "IDENTITY_BINDING_MISSING"
    });
  }

  const expectedOrigin = `chrome-extension://${binding.extensionId}/`;
  const profileDir =
    asNonEmptyString(input.meta?.profileDir) ?? asNonEmptyString(input.profileDir);
  const resolvedBrowserChannel = inferPersistentExtensionBrowserChannel({
    browserPath,
    browserVersion
  });
  if (resolvedBrowserChannel !== null && binding.browserChannel !== resolvedBrowserChannel) {
    return buildBlockingResult({
      mode: "official_chrome_persistent_extension",
      browserPath,
      browserVersion,
      identityBindingState: "mismatch",
      binding,
      manifestPath: binding.manifestPath,
      manifestSource: binding.manifestPath ? "binding" : null,
      expectedOrigin,
      allowedOrigins: [],
      installDiagnostics: EMPTY_INSTALL_DIAGNOSTICS,
      extensionServiceWorkerFreshness: null,
      failureReason: "IDENTITY_BINDING_CONFLICT"
    });
  }
  const manifestResolution = await resolveManifestPathForBinding(binding, {
    execFile: identityPreflightAdapters.execFile,
    platform: identityPreflightAdapters.platform
  });
  const manifestPath = manifestResolution.manifestPath;
  if (manifestPath === null) {
    return buildBlockingResult({
      mode: "official_chrome_persistent_extension",
      browserPath,
      browserVersion,
      identityBindingState: "mismatch",
      binding,
      manifestPath: null,
      manifestSource: manifestResolution.manifestSource,
      expectedOrigin,
      allowedOrigins: [],
      installDiagnostics: EMPTY_INSTALL_DIAGNOSTICS,
      extensionServiceWorkerFreshness: null,
      failureReason: "IDENTITY_MANIFEST_MISSING"
    });
  }
  const manifest = await readNativeHostManifest(manifestPath);
  const installDiagnostics = await resolveInstallDiagnostics({
    manifest,
    manifestPath,
    profileDir: profileDir ?? null,
    platform: identityPreflightAdapters.platform()
  });
  if (!manifest) {
    return buildBlockingResult({
      mode: "official_chrome_persistent_extension",
      browserPath,
      browserVersion,
      identityBindingState: "mismatch",
      binding: {
        ...binding,
        manifestPath
      },
      manifestPath,
      manifestSource: manifestResolution.manifestSource,
      expectedOrigin,
      allowedOrigins: [],
      installDiagnostics,
      extensionServiceWorkerFreshness: null,
      failureReason: "IDENTITY_MANIFEST_MISSING"
    });
  }
  const installBroken =
    installDiagnostics.launcherExists === false ||
    installDiagnostics.launcherExecutable === false ||
    installDiagnostics.legacyLauncherDetected === true ||
    installDiagnostics.profileRootMatches === false ||
    (installDiagnostics.launcherExists === true &&
      installDiagnostics.bundleRuntimePath !== null &&
      installDiagnostics.bundleRuntimeExists === false);
  if (installBroken) {
    return buildBlockingResult({
      mode: "official_chrome_persistent_extension",
      browserPath,
      browserVersion,
      identityBindingState: "mismatch",
      binding: {
        ...binding,
        manifestPath
      },
      manifestPath,
      manifestSource: manifestResolution.manifestSource,
      expectedOrigin,
      allowedOrigins: manifest.allowed_origins,
      installDiagnostics,
      extensionServiceWorkerFreshness: null,
      failureReason: "IDENTITY_MANIFEST_MISSING"
    });
  }

  if (manifest.name !== binding.nativeHostName) {
    return buildBlockingResult({
      mode: "official_chrome_persistent_extension",
      browserPath,
      browserVersion,
      identityBindingState: "mismatch",
      binding: {
        ...binding,
        manifestPath
      },
      manifestPath,
      manifestSource: manifestResolution.manifestSource,
      expectedOrigin,
      allowedOrigins: manifest.allowed_origins,
      installDiagnostics,
      extensionServiceWorkerFreshness: null,
      failureReason: "IDENTITY_NATIVE_HOST_NAME_MISMATCH"
    });
  }

  if (!manifest.allowed_origins.includes(expectedOrigin)) {
    return buildBlockingResult({
      mode: "official_chrome_persistent_extension",
      browserPath,
      browserVersion,
      identityBindingState: "mismatch",
      binding: {
        ...binding,
        manifestPath
      },
      manifestPath,
      manifestSource: manifestResolution.manifestSource,
      expectedOrigin,
      allowedOrigins: manifest.allowed_origins,
      installDiagnostics,
      extensionServiceWorkerFreshness: null,
      failureReason: "IDENTITY_ALLOWED_ORIGIN_MISSING"
    });
  }

  let extensionServiceWorkerFreshness: ExtensionServiceWorkerFreshnessDiagnostics | null = null;
  if (profileDir) {
    const extensionState = await resolveProfileExtensionState(profileDir, binding.extensionId);
    if (extensionState !== "enabled") {
      return buildBlockingResult({
        mode: "official_chrome_persistent_extension",
        browserPath,
        browserVersion,
        identityBindingState: "missing",
        binding: {
          ...binding,
          manifestPath
        },
        manifestPath,
        manifestSource: manifestResolution.manifestSource,
        expectedOrigin,
        allowedOrigins: manifest.allowed_origins,
        installDiagnostics,
        extensionServiceWorkerFreshness: null,
        failureReason: "IDENTITY_BINDING_MISSING"
      });
    }
    extensionServiceWorkerFreshness =
      await resolveProfileExtensionServiceWorkerFreshness(profileDir, binding.extensionId);
    if (
      extensionServiceWorkerFreshness.state === "stale" ||
      isProviderBlockingServiceWorkerCodeIdentity(extensionServiceWorkerFreshness)
    ) {
      return buildBlockingResult({
        mode: "official_chrome_persistent_extension",
        browserPath,
        browserVersion,
        identityBindingState: "mismatch",
        binding: {
          ...binding,
          manifestPath
        },
        manifestPath,
        manifestSource: manifestResolution.manifestSource,
        expectedOrigin,
        allowedOrigins: manifest.allowed_origins,
        installDiagnostics,
        extensionServiceWorkerFreshness,
        failureReason: resolveServiceWorkerFailureReason(extensionServiceWorkerFreshness)
      });
    }
  }

  return {
    mode: "official_chrome_persistent_extension",
    browserPath,
    browserVersion,
    identityBindingState: "bound",
    binding: {
      ...binding,
      manifestPath
    },
    manifestPath,
    manifestSource: manifestResolution.manifestSource,
    expectedOrigin,
    allowedOrigins: manifest.allowed_origins,
    installDiagnostics,
    extensionServiceWorkerFreshness,
    blocking: false,
    failureReason: "IDENTITY_PREFLIGHT_PASSED"
  };
};
