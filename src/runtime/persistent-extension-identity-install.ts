import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { inspectManagedNativeHostInstall } from "../install/native-host-install-root.js";
import {
  resolveManifestPathForChannel,
  type BrowserChannel
} from "../install/native-host-platform.js";
import type { PersistentExtensionBinding } from "./profile-store.js";
import {
  evaluateServiceWorkerCodeIdentityObservation,
  type ServiceWorkerCodeIdentityObservation,
  type ServiceWorkerLifecycleState
} from "./service-worker-code-identity.js";
import {
  digestServiceWorkerBundleSources,
  extractRelativeModuleSpecifiers,
  normalizeServiceWorkerBundleScriptPath,
  resolveRelativeModuleScriptPath,
  type ServiceWorkerBundleSource
} from "./service-worker-bundle-digest.js";

export const ACTIVE_SERVICE_WORKER_CODE_IDENTITY_OBSERVATION_FILENAME =
  "WebEnvoyActiveServiceWorkerCodeIdentity.json";

export type ManifestSource = "binding" | "browser_default" | "windows_registry";

export interface NativeHostManifest {
  name: string;
  allowed_origins: string[];
  path: string | null;
}

interface ManagedInstallMetadata {
  profileRoot: string | null;
  bundleRuntimeExpected: boolean | null;
}

export interface IdentityPreflightInstallDiagnostics {
  launcherPath: string | null;
  launcherExists: boolean | null;
  launcherExecutable: boolean | null;
  bundleRuntimePath: string | null;
  bundleRuntimeExists: boolean | null;
  launcherProfileRoot: string | null;
  expectedProfileRoot: string | null;
  profileRootMatches: boolean | null;
  legacyLauncherDetected: boolean | null;
}

export type ProfileExtensionState = "enabled" | "disabled" | "missing";
export type ExtensionServiceWorkerFreshnessState = "fresh" | "stale" | "unknown" | "not_applicable";

type ProfileExtensionPreferencesState = {
  state: ProfileExtensionState;
  unpackedPath: string | null;
};

export interface ExtensionServiceWorkerFreshnessDiagnostics {
  state: ExtensionServiceWorkerFreshnessState;
  reason:
    | "PROFILE_EXTENSION_NOT_UNPACKED"
    | "EXTENSION_SOURCE_MTIME_UNAVAILABLE"
    | "EXTENSION_SERVICE_WORKER_SCRIPT_DIGEST_UNAVAILABLE"
    | "ACTIVE_SERVICE_WORKER_OBSERVATION_MISSING"
    | "SERVICE_WORKER_CACHE_MISSING"
    | "SERVICE_WORKER_CACHE_CURRENT"
    | "SERVICE_WORKER_CACHE_OLDER_THAN_EXTENSION_BUILD"
    | "SERVICE_WORKER_CODE_IDENTITY_MISMATCH"
    | "SERVICE_WORKER_EVIDENCE_REDACTION_INVALID";
  extensionId: string;
  extensionPath: string | null;
  extensionLatestMtimeMs: number | null;
  serviceWorkerPath: string;
  serviceWorkerLatestMtimeMs: number | null;
  codeIdentityObservation: ServiceWorkerCodeIdentityObservation | null;
  recoveryHint: string | null;
}

export interface ExtensionServiceWorkerRefreshResult {
  operation: "dry_run" | "refreshed" | "skipped" | "blocked";
  profileDir: string;
  extensionId: string;
  serviceWorkerPath: string;
  expectedServiceWorkerPath: string;
  before: ExtensionServiceWorkerFreshnessDiagnostics;
  after: ExtensionServiceWorkerFreshnessDiagnostics | null;
  removable: boolean;
  removed: boolean;
  blocker: ExtensionServiceWorkerRefreshBlocker | null;
  recoveryHint: string | null;
}

export interface ExtensionServiceWorkerRefreshBlocker {
  blocker_layer: "service_worker_cache";
  blocker_code:
    | "service_worker_path_unexpected"
    | "service_worker_path_missing"
    | "service_worker_path_symlink";
  required_recovery_action: "inspect_managed_profile_service_worker_cache";
  expected_service_worker_path: string;
  actual_service_worker_path: string;
}

export interface ActiveServiceWorkerCodeIdentityObservationRecord {
  extensionId: string;
  runId: string;
  observedActiveServiceWorkerScriptIdentityLocator: string;
  observedServiceWorkerCodeDigestLocator: string;
  observedAt: string;
}

export interface ProfileExtensionSourceRebindResult {
  operation: "rebound" | "already_current" | "missing";
  profileDir: string;
  extensionId: string;
  preferencePath: string | null;
  previousExtensionPath: string | null;
  expectedExtensionPath: string;
  updatedExtensionPath: string | null;
  protectedMacsRemoved: string[];
  serviceWorkerCacheRemoved: boolean;
}

interface ResolvedManifestPath {
  manifestPath: string | null;
  manifestSource: ManifestSource | null;
}

export interface IdentityManifestAdapters {
  execFile: (
    file: string,
    args: readonly string[],
    options: { encoding: "utf8" }
  ) => Promise<{ stdout: string; stderr?: string }>;
  platform: () => NodeJS.Platform;
}

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

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const normalizePathForComparison = (input: string): string => {
  const normalized = resolve(input);
  return normalized.startsWith("/private/var/") ? normalized.slice("/private".length) : normalized;
};

const expandWindowsEnvVariables = (value: string): string =>
  value.replace(/%([^%]+)%/g, (_match, name: string) => process.env[name] ?? `%${name}%`);

const parseWindowsRegistryDefaultValue = (stdout: string): string | null => {
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

const resolveWindowsRegistryKeyForChannel = (
  browserChannel: BrowserChannel,
  nativeHostName: string,
  platform: NodeJS.Platform
): string | null => {
  if (platform !== "win32") {
    return null;
  }

  const keyByChannel: Record<BrowserChannel, string> = {
    chrome: "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts",
    chrome_beta: "HKCU\\Software\\Google\\Chrome Beta\\NativeMessagingHosts",
    chromium: "HKCU\\Software\\Chromium\\NativeMessagingHosts",
    brave: "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts",
    edge: "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts"
  };
  return `${keyByChannel[browserChannel]}\\${nativeHostName}`;
};

export const resolveManifestPathForBinding = async (
  binding: PersistentExtensionBinding,
  adapters: IdentityManifestAdapters
): Promise<ResolvedManifestPath> => {
  if (binding.manifestPath) {
    return {
      manifestPath: binding.manifestPath,
      manifestSource: "binding"
    };
  }

  if (adapters.platform() === "win32") {
    const registryKey = resolveWindowsRegistryKeyForChannel(
      binding.browserChannel,
      binding.nativeHostName,
      adapters.platform()
    );
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
      } catch {
        // Registry lookup failed; caller will handle the missing path as a blocking preflight result.
      }
    }
    return {
      manifestPath: null,
      manifestSource: null
    };
  }

  return {
    manifestPath: resolveManifestPathForChannel(
      binding.browserChannel,
      binding.nativeHostName,
      adapters.platform()
    ),
    manifestSource: "browser_default"
  };
};

export const readNativeHostManifest = async (
  manifestPath: string
): Promise<NativeHostManifest | null> => {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const name = asNonEmptyString(parsed.name);
    const launcherPath = asNonEmptyString(parsed.path);
    const allowedOrigins = Array.isArray(parsed.allowed_origins)
      ? parsed.allowed_origins.filter((entry): entry is string => typeof entry === "string")
      : [];
    if (!name) {
      return null;
    }
    return {
      name,
      allowed_origins: allowedOrigins,
      path: launcherPath ? (isAbsolute(launcherPath) ? launcherPath : resolve(dirname(manifestPath), launcherPath)) : null
    };
  } catch {
    return null;
  }
};

const readManagedInstallMetadata = async (
  channelRoot: string
): Promise<ManagedInstallMetadata> => {
  try {
    const raw = await readFile(join(channelRoot, "install-metadata.json"), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const profileRoot = asNonEmptyString(parsed.profile_root);
    const bundleRuntimeExpected =
      typeof parsed.bundle_runtime_expected === "boolean"
        ? parsed.bundle_runtime_expected
        : null;
    return {
      profileRoot: profileRoot ? normalizePathForComparison(profileRoot) : null,
      bundleRuntimeExpected
    };
  } catch {
    return {
      profileRoot: null,
      bundleRuntimeExpected: null
    };
  }
};

const managedBundleFilesExist = async (channelRoot: string): Promise<boolean> => {
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
  } catch {
    return false;
  }
};

const inferManagedBundleExpectationFromLauncher = async (
  launcherPath: string,
  channelRoot: string
): Promise<boolean> => {
  try {
    const launcherRaw = await readFile(launcherPath, "utf8");
    const bundledEntryPath = normalizePathForComparison(
      join(channelRoot, "runtime", "native-messaging", "native-host-entry.js")
    );
    return launcherRaw.includes(bundledEntryPath);
  } catch {
    return true;
  }
};

const managedLauncherExecutable = async (
  launcherPath: string,
  platform: NodeJS.Platform
): Promise<boolean> => {
  if (platform === "win32") {
    return true;
  }
  try {
    await access(launcherPath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
};

export const resolveInstallDiagnostics = async (input: {
  manifest: NativeHostManifest | null;
  manifestPath: string | null;
  profileDir: string | null;
  platform: NodeJS.Platform;
}): Promise<IdentityPreflightInstallDiagnostics> => {
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
  let launcherExecutable: boolean | null = null;
  let bundleRuntimeExists: boolean | null = null;
  const expectedProfileRoot = input.profileDir ? normalizePathForComparison(dirname(input.profileDir)) : null;
  const launcherProfileRoot = managedInstallMetadata.profileRoot;
  const profileRootMatches =
    expectedProfileRoot === null
      ? null
      : managedInstall
        ? launcherProfileRoot === expectedProfileRoot
        : launcherProfileRoot === null
          ? null
          : launcherProfileRoot === expectedProfileRoot;
  const legacyLauncherDetected =
    managedInstall === null &&
    input.manifestPath !== null &&
    normalizePathForComparison(dirname(input.manifest.path)) ===
      normalizePathForComparison(dirname(input.manifestPath)) &&
    input.manifest.path.endsWith(`${input.manifest.name}-launcher`);
  try {
    await access(input.manifest.path);
    launcherExists = true;
  } catch {
    launcherExists = false;
  }
  if (launcherExists && managedInstall) {
    launcherExecutable = await managedLauncherExecutable(input.manifest.path, input.platform);
  }
  if (bundleRuntimePath) {
    const bundleRuntimeExpected =
      managedInstallMetadata.bundleRuntimeExpected ??
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

const readProfileExtensionStateFromPreferences = (
  input: Record<string, unknown>,
  extensionId: string
): ProfileExtensionPreferencesState => {
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
  const unpackedPath =
    extensionEntry.location === 4 && asNonEmptyString(extensionEntry.path)
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

const removeProtectedMac = (
  root: Record<string, unknown>,
  segments: readonly string[],
  removed: string[]
): void => {
  let current: Record<string, unknown> | null = root;
  for (const segment of segments.slice(0, -1)) {
    current = asRecord(current?.[segment]);
    if (!current) {
      return;
    }
  }
  const leaf = segments[segments.length - 1];
  if (leaf && Object.prototype.hasOwnProperty.call(current, leaf)) {
    delete current[leaf];
    const removedPath = segments.join(".");
    if (!removed.includes(removedPath)) {
      removed.push(removedPath);
    }
  }
};

const assertExtensionSourcePathSafe = async (input: {
  cwd: string;
  extensionPath: string;
}): Promise<string> => {
  const expectedExtensionPath = normalizePathForComparison(input.extensionPath);
  const expectedWorktreePath = normalizePathForComparison(input.cwd);
  const extensionRel = relative(expectedWorktreePath, expectedExtensionPath);
  if (extensionRel.startsWith("..") || isAbsolute(extensionRel)) {
    throw new Error("EXTENSION_SOURCE_OUTSIDE_WORKTREE");
  }
  const extensionStat = await lstat(expectedExtensionPath);
  if (extensionStat.isSymbolicLink()) {
    throw new Error("EXTENSION_SOURCE_SYMLINK");
  }
  const manifestStat = await lstat(join(expectedExtensionPath, "manifest.json"));
  if (manifestStat.isSymbolicLink()) {
    throw new Error("EXTENSION_MANIFEST_SYMLINK");
  }
  return expectedExtensionPath;
};

export const rebindManagedProfileExtensionSource = async (input: {
  cwd: string;
  profileDir: string;
  extensionId: string;
  extensionPath?: string;
  clearServiceWorkerCache?: boolean;
}): Promise<ProfileExtensionSourceRebindResult> => {
  const expectedExtensionPath = await assertExtensionSourcePathSafe({
    cwd: input.cwd,
    extensionPath: input.extensionPath ?? join(input.cwd, "extension")
  });
  const preferenceCandidates = [
    join(input.profileDir, "Default", "Preferences"),
    join(input.profileDir, "Default", "Secure Preferences"),
    join(input.profileDir, "Secure Preferences")
  ];
  const loadedPreferences: Array<{
    preferencePath: string;
    parsed: Record<string, unknown>;
    extensionEntry: Record<string, unknown> | null;
    previousState: ProfileExtensionPreferencesState;
  }> = [];

  for (const preferencePath of preferenceCandidates) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(await readFile(preferencePath, "utf8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    const extensions = asRecord(parsed.extensions);
    const settings = asRecord(extensions?.settings);
    const extensionEntry = asRecord(settings?.[input.extensionId]);
    const previousState = readProfileExtensionStateFromPreferences(parsed, input.extensionId);
    loadedPreferences.push({
      preferencePath,
      parsed,
      extensionEntry,
      previousState
    });
  }

  const primaryPreference = loadedPreferences.find((entry) => entry.previousState.state === "enabled");
  if (!primaryPreference) {
    return {
      operation: "missing",
      profileDir: input.profileDir,
      extensionId: input.extensionId,
      preferencePath: null,
      previousExtensionPath: null,
      expectedExtensionPath,
      updatedExtensionPath: null,
      protectedMacsRemoved: [],
      serviceWorkerCacheRemoved: false
    };
  }

  const protectedMacsRemoved: string[] = [];
  let preferenceUpdated = false;
  let pathUpdated = false;
  for (const preference of loadedPreferences) {
    const before = JSON.stringify(preference.parsed);
    if (
      preference.extensionEntry &&
      (preference.previousState.state === "enabled" || preference.previousState.unpackedPath !== null)
    ) {
      if (
        !preference.previousState.unpackedPath ||
        normalizePathForComparison(preference.previousState.unpackedPath) !== expectedExtensionPath
      ) {
        pathUpdated = true;
      }
      preference.extensionEntry.location = 4;
      preference.extensionEntry.path = expectedExtensionPath;
    }
    removeProtectedMac(
      preference.parsed,
      ["protection", "macs", "extensions", "settings", input.extensionId],
      protectedMacsRemoved
    );
    removeProtectedMac(
      preference.parsed,
      ["protection", "macs", "extensions", "settings_encrypted_hash", input.extensionId],
      protectedMacsRemoved
    );
    removeProtectedMac(preference.parsed, ["protection", "super_mac"], protectedMacsRemoved);
    if (JSON.stringify(preference.parsed) !== before) {
      await writeFile(preference.preferencePath, `${JSON.stringify(preference.parsed, null, 2)}\n`, "utf8");
      preferenceUpdated = true;
    }
  }

  let serviceWorkerCacheRemoved = false;
  if (input.clearServiceWorkerCache !== false && (pathUpdated || protectedMacsRemoved.length > 0)) {
    const serviceWorkerPath = join(input.profileDir, "Default", "Service Worker");
    const blocker = await resolveServiceWorkerRefreshPathBlocker(input.profileDir, serviceWorkerPath);
    if (!blocker) {
      await rm(serviceWorkerPath, { recursive: true, force: true });
      serviceWorkerCacheRemoved = true;
    }
  }

  return {
    operation: preferenceUpdated || serviceWorkerCacheRemoved ? "rebound" : "already_current",
    profileDir: input.profileDir,
    extensionId: input.extensionId,
    preferencePath: primaryPreference.preferencePath,
    previousExtensionPath: primaryPreference.previousState.unpackedPath,
    expectedExtensionPath,
    updatedExtensionPath: expectedExtensionPath,
    protectedMacsRemoved,
    serviceWorkerCacheRemoved
  };
};

const resolveLatestMtimeMs = async (path: string): Promise<number | null> => {
  let latest: number | null = null;
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
    } catch {
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
    } catch {
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

const resolveFileMtimeMs = async (path: string): Promise<number | null> => {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      const resolvedPath = await realpath(path);
      const resolvedStat = await lstat(resolvedPath);
      return resolvedStat.isDirectory() ? null : resolvedStat.mtimeMs;
    }
    return stat.isDirectory() ? null : stat.mtimeMs;
  } catch {
    return null;
  }
};

const resolveExtensionBundleLatestMtimeMs = async (extensionPath: string): Promise<number | null> => {
  const manifestPath = join(extensionPath, "manifest.json");
  const buildLatestMtimeMs = await resolveLatestMtimeMs(join(extensionPath, "build"));
  const bundlePaths = new Set<string>([manifestPath]);

  try {
    const raw = await readFile(manifestPath, "utf8");
    const manifest = asRecord(JSON.parse(raw));
    const background = manifest ? asRecord(manifest.background) : null;
    const serviceWorkerPath = background ? asNonEmptyString(background.service_worker) : null;
    if (serviceWorkerPath) {
      bundlePaths.add(join(extensionPath, serviceWorkerPath));
    }
  } catch {
    // Missing or invalid manifest falls back to the conventional built background bundle path.
  }

  let latest: number | null = null;
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

const readSafeExtensionSource = async (input: {
  extensionPath: string;
  rootRealPath: string;
  scriptRef: string;
}): Promise<ServiceWorkerBundleSource | null> => {
  const scriptPath = normalizeServiceWorkerBundleScriptPath(input.scriptRef);
  if (!scriptPath) {
    return null;
  }
  const filePath = resolve(input.extensionPath, scriptPath);
  if (!isPathInside(input.extensionPath, filePath)) {
    return null;
  }
  try {
    const stat = await lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return null;
    }
    const fileRealPath = await realpath(filePath);
    if (!isPathInside(input.rootRealPath, fileRealPath)) {
      return null;
    }
    return {
      scriptPath,
      source: await readFile(filePath, "utf8")
    };
  } catch {
    return null;
  }
};

const resolveExpectedServiceWorkerBundleDigest = async (
  extensionPath: string
): Promise<{ digest: string | null; scriptRef: string | null }> => {
  const manifestPath = join(extensionPath, "manifest.json");
  let serviceWorkerRef = "build/background.js";
  let isModule = false;
  try {
    const raw = await readFile(manifestPath, "utf8");
    const manifest = asRecord(JSON.parse(raw));
    const background = manifest ? asRecord(manifest.background) : null;
    const manifestServiceWorkerRef = background
      ? asNonEmptyString(background.service_worker)
      : null;
    if (manifestServiceWorkerRef) {
      serviceWorkerRef = manifestServiceWorkerRef;
    }
    isModule = background?.type === "module";
  } catch {
    serviceWorkerRef = "build/background.js";
    isModule = false;
  }

  const entryScriptPath = normalizeServiceWorkerBundleScriptPath(serviceWorkerRef);
  if (!entryScriptPath) {
    return {
      digest: null,
      scriptRef: serviceWorkerRef
    };
  }
  const rootRealPath = await realpath(extensionPath).catch(() => null);
  if (!rootRealPath) {
    return {
      digest: null,
      scriptRef: entryScriptPath
    };
  }

  const sources = new Map<string, ServiceWorkerBundleSource>();
  const pending = [entryScriptPath];
  while (pending.length > 0) {
    const currentScriptPath = pending.shift();
    if (!currentScriptPath) {
      continue;
    }
    if (sources.has(currentScriptPath)) {
      continue;
    }
    const source = await readSafeExtensionSource({
      extensionPath,
      rootRealPath,
      scriptRef: currentScriptPath
    });
    if (!source) {
      return {
        digest: null,
        scriptRef: entryScriptPath
      };
    }
    sources.set(currentScriptPath, source);
    if (!isModule) {
      continue;
    }
    for (const specifier of extractRelativeModuleSpecifiers(source.source)) {
      const moduleScriptPath = resolveRelativeModuleScriptPath(currentScriptPath, specifier);
      if (!moduleScriptPath) {
        return {
          digest: null,
          scriptRef: entryScriptPath
        };
      }
      if (!sources.has(moduleScriptPath)) {
        pending.push(moduleScriptPath);
      }
    }
  }

  return {
    digest: digestServiceWorkerBundleSources([...sources.values()]),
    scriptRef: entryScriptPath
  };
};

const isTargetServiceWorkerCacheFile = async (
  path: string,
  extensionId: string
): Promise<boolean> => {
  if (path.includes(extensionId)) {
    return true;
  }
  try {
    const content = await readFile(path);
    return (
      content.includes(Buffer.from(extensionId)) ||
      content.includes(Buffer.from(`chrome-extension://${extensionId}`))
    );
  } catch {
    return false;
  }
};

const resolveTargetExtensionReferenceLatestMtimeMs = async (
  path: string,
  extensionId: string
): Promise<number | null> => {
  let latest: number | null = null;
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
    } catch {
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
    } catch {
      continue;
    }
    for (const entry of entries) {
      pending.push(join(currentPath, entry.name));
    }
  }

  return latest;
};

type ResolvedServiceWorkerCacheMtime = {
  mtimeMs: number;
  source:
    | "registration_database"
    | "registration_database_with_opaque_script_cache"
    | "script_cache";
  digest: string | null;
};

type ActiveServiceWorkerCodeIdentityEvidence = {
  observedActiveServiceWorkerScriptIdentityLocator: string;
  observedServiceWorkerCodeDigestLocator: string;
  observedAt: string | null;
};

export interface ExtensionServiceWorkerFreshnessOptions {
  requiredObservationRunId?: string | null;
  requiredObservationObservedAfter?: string | null;
}

const resolveTargetServiceWorkerCacheLatestMtimeMs = async (
  serviceWorkerPath: string,
  extensionId: string
): Promise<ResolvedServiceWorkerCacheMtime | null> => {
  let latest: number | null = null;
  let opaqueLatest: number | null = null;
  const targetFiles: string[] = [];
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
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) {
      continue;
    }
    if (!stat.isDirectory()) {
      if (await isTargetServiceWorkerCacheFile(currentPath, extensionId)) {
        latest = latest === null ? stat.mtimeMs : Math.max(latest, stat.mtimeMs);
        targetFiles.push(currentPath);
      } else {
        opaqueLatest =
          opaqueLatest === null ? stat.mtimeMs : Math.max(opaqueLatest, stat.mtimeMs);
      }
      continue;
    }
    let entries;
    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      pending.push(join(currentPath, entry.name));
    }
  }

  if (latest !== null) {
    const hash = createHash("sha256");
    for (const targetFile of targetFiles.sort()) {
      hash.update(await readFile(targetFile));
    }
    return {
      mtimeMs: latest,
      source: "script_cache",
      digest: hash.digest("hex")
    };
  }
  const registrationLatestMtimeMs = await resolveTargetExtensionReferenceLatestMtimeMs(
    join(serviceWorkerPath, "Database"),
    extensionId
  );
  if (registrationLatestMtimeMs === null) {
    return null;
  }
  if (opaqueLatest !== null) {
    return {
      mtimeMs: opaqueLatest,
      source: "registration_database_with_opaque_script_cache",
      digest: null
    };
  }
  return {
    mtimeMs: registrationLatestMtimeMs,
    source: "registration_database",
    digest: null
  };
};

const digestLocator = (digest: string | null): string | null =>
  digest ? `sha256:${digest}` : null;

const resolveActiveServiceWorkerCodeIdentityEvidence = async (
  serviceWorkerPath: string,
  extensionId: string,
  options: ExtensionServiceWorkerFreshnessOptions = {}
): Promise<ActiveServiceWorkerCodeIdentityEvidence | null> => {
  const artifactPath = join(
    serviceWorkerPath,
    ACTIVE_SERVICE_WORKER_CODE_IDENTITY_OBSERVATION_FILENAME
  );
  let raw: string;
  try {
    raw = await readFile(artifactPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  if (!record) {
    return null;
  }
  if (record.extension_id !== extensionId || record.lifecycle_state !== "active_worker_observed") {
    return null;
  }
  if (
    typeof options.requiredObservationRunId === "string" &&
    options.requiredObservationRunId.length > 0 &&
    record.run_id !== options.requiredObservationRunId
  ) {
    return null;
  }
  if (typeof record.run_id !== "string" || record.run_id.trim().length === 0) {
    return null;
  }
  if (
    typeof options.requiredObservationObservedAfter === "string" &&
    options.requiredObservationObservedAfter.length > 0
  ) {
    const observedAt = asNonEmptyString(record.observed_at);
    if (!observedAt) {
      return null;
    }
    const requiredObservedAfterMs = Date.parse(options.requiredObservationObservedAfter);
    const observedAtMs = Date.parse(observedAt);
    if (
      !Number.isFinite(requiredObservedAfterMs) ||
      !Number.isFinite(observedAtMs) ||
      observedAtMs < requiredObservedAfterMs
    ) {
      return null;
    }
  }
  const observedScriptLocator = asNonEmptyString(
    record.observed_active_service_worker_script_identity_locator
  );
  const observedDigestLocator = asNonEmptyString(
    record.observed_service_worker_code_digest_locator
  );
  if (!observedScriptLocator || !observedDigestLocator) {
    return null;
  }

  return {
    observedActiveServiceWorkerScriptIdentityLocator: observedScriptLocator,
    observedServiceWorkerCodeDigestLocator: observedDigestLocator,
    observedAt: asNonEmptyString(record.observed_at)
  };
};

export const writeActiveServiceWorkerCodeIdentityObservation = async (
  profileDir: string,
  observation: ActiveServiceWorkerCodeIdentityObservationRecord
): Promise<void> => {
  const serviceWorkerPath = join(profileDir, "Default", "Service Worker");
  await mkdir(serviceWorkerPath, { recursive: true });
  const artifactPath = join(
    serviceWorkerPath,
    ACTIVE_SERVICE_WORKER_CODE_IDENTITY_OBSERVATION_FILENAME
  );
  const tempPath = `${artifactPath}.${process.pid}.${randomUUID()}.tmp`;
  const record = {
    extension_id: observation.extensionId,
    run_id: observation.runId,
    lifecycle_state: "active_worker_observed",
    observed_active_service_worker_script_identity_locator:
      observation.observedActiveServiceWorkerScriptIdentityLocator,
    observed_service_worker_code_digest_locator:
      observation.observedServiceWorkerCodeDigestLocator,
    observed_at: observation.observedAt
  };
  try {
    await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await rename(tempPath, artifactPath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
};

const buildCodeIdentityObservation = (input: {
  extensionId: string;
  extensionPath: string | null;
  serviceWorkerPath: string;
  expectedScriptRef: string | null;
  expectedScriptDigest: string | null;
  serviceWorkerCacheDigest: string | null;
  lifecycleState: ServiceWorkerLifecycleState;
  activeEvidence: ActiveServiceWorkerCodeIdentityEvidence | null;
  recoveryHint: string | null;
}): ServiceWorkerCodeIdentityObservation =>
  evaluateServiceWorkerCodeIdentityObservation({
    extensionId: input.extensionId,
    expectedExtensionBundleIdentityLocator: input.expectedScriptRef
      ? `extension-bundle/official-chrome.persistent/${input.extensionId}/service-worker/${input.expectedScriptRef}`
      : null,
    observedActiveServiceWorkerScriptIdentityLocator:
      input.activeEvidence?.observedActiveServiceWorkerScriptIdentityLocator ?? null,
    expectedBundleDigestLocator: digestLocator(input.expectedScriptDigest),
    observedServiceWorkerCodeDigestLocator:
      input.activeEvidence?.observedServiceWorkerCodeDigestLocator ?? null,
    backgroundServiceWorkerCacheIdentityLocator: input.serviceWorkerCacheDigest
      ? `extension-service-worker-cache/official-chrome.persistent/${input.extensionId}/script-cache/background`
      : null,
    backgroundServiceWorkerCacheDigestLocator: digestLocator(input.serviceWorkerCacheDigest),
    activeWorkerLifecycleState: input.activeEvidence ? "active_worker_observed" : input.lifecycleState,
    observedAt: input.activeEvidence?.observedAt ?? null,
    remediationHint: input.recoveryHint,
    rawPathDenylist: [input.extensionPath, input.serviceWorkerPath]
  });

const resolveEnabledUnpackedPath = async (
  profileDir: string,
  extensionId: string
): Promise<string | null> => {
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
    } catch {
      // ignore preference file read/parse failures and continue probing
    }
  }

  return null;
};

const isPathInside = (root: string, target: string): boolean => {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const resolveServiceWorkerRefreshPathBlocker = async (
  profileDir: string,
  serviceWorkerPath: string
): Promise<ExtensionServiceWorkerRefreshBlocker | null> => {
  const expectedServiceWorkerPath = join(profileDir, "Default", "Service Worker");
  const expectedDefaultPath = join(profileDir, "Default");
  const normalizedExpected = resolve(expectedServiceWorkerPath);
  const normalizedActual = resolve(serviceWorkerPath);
  const baseBlocker = {
    blocker_layer: "service_worker_cache" as const,
    required_recovery_action: "inspect_managed_profile_service_worker_cache" as const,
    expected_service_worker_path: expectedServiceWorkerPath,
    actual_service_worker_path: serviceWorkerPath
  };

  if (!isPathInside(join(profileDir, "Default"), serviceWorkerPath)) {
    return {
      ...baseBlocker,
      blocker_code: "service_worker_path_unexpected"
    };
  }
  if (normalizedActual !== normalizedExpected) {
    return {
      ...baseBlocker,
      blocker_code: "service_worker_path_unexpected"
    };
  }
  for (const currentPath of [profileDir, expectedDefaultPath, expectedServiceWorkerPath]) {
    const stat = await lstat(currentPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    });
    if (!stat) {
      return {
        ...baseBlocker,
        blocker_code: "service_worker_path_missing"
      };
    }
    if (stat.isSymbolicLink()) {
      return {
        ...baseBlocker,
        blocker_code: "service_worker_path_symlink"
      };
    }
  }
  const [profileRealPath, serviceWorkerRealPath] = await Promise.all([
    realpath(profileDir),
    realpath(serviceWorkerPath)
  ]);
  if (!isPathInside(profileRealPath, serviceWorkerRealPath)) {
    return {
      ...baseBlocker,
      blocker_code: "service_worker_path_unexpected"
    };
  }
  return null;
};

export const resolveProfileExtensionServiceWorkerFreshness = async (
  profileDir: string,
  extensionId: string,
  options: ExtensionServiceWorkerFreshnessOptions = {}
): Promise<ExtensionServiceWorkerFreshnessDiagnostics> => {
  const serviceWorkerPath = join(profileDir, "Default", "Service Worker");
  const extensionPath = await resolveEnabledUnpackedPath(profileDir, extensionId);
  const recoveryHint =
    "Stop the WebEnvoy-managed runtime, refresh only this managed profile's Default/Service Worker cache, then rerun runtime.install/runtime.start; do not touch a daily Chrome profile.";

  if (!extensionPath) {
    return {
      state: "not_applicable",
      reason: "PROFILE_EXTENSION_NOT_UNPACKED",
      extensionId,
      extensionPath: null,
      extensionLatestMtimeMs: null,
      serviceWorkerPath,
      serviceWorkerLatestMtimeMs: null,
      codeIdentityObservation: buildCodeIdentityObservation({
        extensionId,
        extensionPath: null,
        serviceWorkerPath,
        expectedScriptRef: null,
        expectedScriptDigest: null,
        serviceWorkerCacheDigest: null,
        lifecycleState: "source_missing",
        activeEvidence: null,
        recoveryHint: null
      }),
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
      codeIdentityObservation: buildCodeIdentityObservation({
        extensionId,
        extensionPath,
        serviceWorkerPath,
        expectedScriptRef: null,
        expectedScriptDigest: null,
        serviceWorkerCacheDigest: null,
        lifecycleState: "source_missing",
        activeEvidence: null,
        recoveryHint: null
      }),
      recoveryHint: null
    };
  }

  const expectedScript = await resolveExpectedServiceWorkerBundleDigest(extensionPath);

  const serviceWorkerCacheMtime = await resolveTargetServiceWorkerCacheLatestMtimeMs(
    serviceWorkerPath,
    extensionId
  );
  const serviceWorkerLatestMtimeMs = serviceWorkerCacheMtime?.mtimeMs ?? null;
  const lifecycleState: ServiceWorkerLifecycleState =
    serviceWorkerCacheMtime?.source === "script_cache"
      ? "disk_script_cache_observed"
      : serviceWorkerCacheMtime?.source === "registration_database" ||
          serviceWorkerCacheMtime?.source === "registration_database_with_opaque_script_cache"
        ? "registration_only"
        : "unavailable";
  const activeEvidence = await resolveActiveServiceWorkerCodeIdentityEvidence(
    serviceWorkerPath,
    extensionId,
    options
  );
  const codeIdentityObservation = buildCodeIdentityObservation({
    extensionId,
    extensionPath,
    serviceWorkerPath,
    expectedScriptRef: expectedScript.scriptRef,
    expectedScriptDigest: expectedScript.digest,
    serviceWorkerCacheDigest: serviceWorkerCacheMtime?.digest ?? null,
    lifecycleState,
    activeEvidence,
    recoveryHint
  });
  if (codeIdentityObservation.freshness_comparison_result === "redaction_invalid") {
    return {
      state: "stale",
      reason: "SERVICE_WORKER_EVIDENCE_REDACTION_INVALID",
      extensionId,
      extensionPath,
      extensionLatestMtimeMs,
      serviceWorkerPath,
      serviceWorkerLatestMtimeMs,
      codeIdentityObservation,
      recoveryHint
    };
  }
  if (codeIdentityObservation.freshness_comparison_result === "expected_identity_missing") {
    return {
      state: "unknown",
      reason: "EXTENSION_SERVICE_WORKER_SCRIPT_DIGEST_UNAVAILABLE",
      extensionId,
      extensionPath,
      extensionLatestMtimeMs,
      serviceWorkerPath,
      serviceWorkerLatestMtimeMs,
      codeIdentityObservation,
      recoveryHint: null
    };
  }
  if (codeIdentityObservation.freshness_comparison_result === "match") {
    return {
      state: "fresh",
      reason: "SERVICE_WORKER_CACHE_CURRENT",
      extensionId,
      extensionPath,
      extensionLatestMtimeMs,
      serviceWorkerPath,
      serviceWorkerLatestMtimeMs,
      codeIdentityObservation,
      recoveryHint: null
    };
  }
  if (codeIdentityObservation.freshness_comparison_result === "observed_stale") {
    return {
      state: "stale",
      reason: "SERVICE_WORKER_CODE_IDENTITY_MISMATCH",
      extensionId,
      extensionPath,
      extensionLatestMtimeMs,
      serviceWorkerPath,
      serviceWorkerLatestMtimeMs,
      codeIdentityObservation,
      recoveryHint
    };
  }
  if (serviceWorkerLatestMtimeMs === null) {
    return {
      state: "unknown",
      reason: "SERVICE_WORKER_CACHE_MISSING",
      extensionId,
      extensionPath,
      extensionLatestMtimeMs,
      serviceWorkerPath,
      serviceWorkerLatestMtimeMs: null,
      codeIdentityObservation,
      recoveryHint: null
    };
  }

  if (serviceWorkerCacheMtime?.source === "registration_database") {
    return {
      state: "unknown",
      reason: "SERVICE_WORKER_CACHE_MISSING",
      extensionId,
      extensionPath,
      extensionLatestMtimeMs,
      serviceWorkerPath,
      serviceWorkerLatestMtimeMs: null,
      codeIdentityObservation,
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
      codeIdentityObservation,
      recoveryHint
    };
  }

  if (serviceWorkerCacheMtime?.source === "registration_database_with_opaque_script_cache") {
    return {
      state: "unknown",
      reason: "SERVICE_WORKER_CACHE_MISSING",
      extensionId,
      extensionPath,
      extensionLatestMtimeMs,
      serviceWorkerPath,
      serviceWorkerLatestMtimeMs: null,
      codeIdentityObservation,
      recoveryHint: null
    };
  }

  return {
    state: "unknown",
    reason: "ACTIVE_SERVICE_WORKER_OBSERVATION_MISSING",
    extensionId,
    extensionPath,
    extensionLatestMtimeMs,
    serviceWorkerPath,
    serviceWorkerLatestMtimeMs,
    codeIdentityObservation,
    recoveryHint
  };
};

export const refreshProfileExtensionServiceWorkerCache = async (
  profileDir: string,
  extensionId: string,
  input: {
    confirm?: boolean;
  } = {}
): Promise<ExtensionServiceWorkerRefreshResult> => {
  const before = await resolveProfileExtensionServiceWorkerFreshness(profileDir, extensionId);
  const serviceWorkerPath = before.serviceWorkerPath;
  const expectedServiceWorkerPath = join(profileDir, "Default", "Service Worker");
  const shouldRemove = before.state === "stale";
  const blocker = shouldRemove
    ? await resolveServiceWorkerRefreshPathBlocker(profileDir, serviceWorkerPath)
    : null;
  const removable = shouldRemove && blocker === null;
  if (!input.confirm) {
    return {
      operation: "dry_run",
      profileDir,
      extensionId,
      serviceWorkerPath,
      expectedServiceWorkerPath,
      before,
      after: null,
      removable,
      removed: false,
      blocker,
      recoveryHint: before.recoveryHint
    };
  }
  if (blocker) {
    return {
      operation: "blocked",
      profileDir,
      extensionId,
      serviceWorkerPath,
      expectedServiceWorkerPath,
      before,
      after: null,
      removable: false,
      removed: false,
      blocker,
      recoveryHint: before.recoveryHint
    };
  }
  if (!shouldRemove) {
    return {
      operation: "skipped",
      profileDir,
      extensionId,
      serviceWorkerPath,
      expectedServiceWorkerPath,
      before,
      after: before,
      removable: false,
      removed: false,
      blocker: null,
      recoveryHint: null
    };
  }

  await rm(serviceWorkerPath, { recursive: true, force: true });
  const after = await resolveProfileExtensionServiceWorkerFreshness(profileDir, extensionId);
  return {
    operation: "refreshed",
    profileDir,
    extensionId,
    serviceWorkerPath,
    expectedServiceWorkerPath,
    before,
    after,
    removable: true,
    removed: true,
    blocker: null,
    recoveryHint: after.recoveryHint
  };
};

export const resolveProfileExtensionState = async (
  profileDir: string,
  extensionId: string
): Promise<ProfileExtensionState> => {
  const preferenceCandidates = [
    join(profileDir, "Default", "Preferences"),
    join(profileDir, "Default", "Secure Preferences"),
    join(profileDir, "Secure Preferences")
  ];

  let foundDisabled = false;
  let enabledInPreferences = false;
  let unpackedPath: string | null = null;

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
    } catch {
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
    } catch {
      return "missing";
    }
  }

  try {
    const installedVersions = await readdir(join(profileDir, "Default", "Extensions", extensionId));
    return installedVersions.length > 0 ? "enabled" : "missing";
  } catch {
    return "missing";
  }
};
