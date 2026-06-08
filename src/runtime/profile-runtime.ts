import { randomUUID } from "node:crypto";
import { mkdir, lstat, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import { CliError } from "../core/errors.js";
import type { JsonObject } from "../core/types.js";
import {
  BROWSER_CONTROL_FILENAME,
  BROWSER_STATE_FILENAME,
  BrowserLaunchError,
  launchBrowser,
  shutdownBrowserSession,
  type BrowserLaunchMode,
  type BrowserLaunchResult
} from "./browser-launcher.js";
import {
  createProfileLock,
  type ProfileLock
} from "./profile-lock.js";
import {
  ProfileStore,
  type ReadMetaMode,
  type ReadMetaOptions,
  type LocalStorageSnapshot,
  type ProfileMeta,
  type PersistentExtensionBinding
} from "./profile-store.js";
import {
  inspectProfileLock,
  isLoginableProfileState,
  isRuntimeActiveProfileState,
  isStartableProfileState,
  resolveProfileAccessState,
  shouldRecoverAsDisconnected,
  type BrowserInstanceStateSnapshot,
  type LockAcquisition,
  type ProfileLockInspection
} from "./profile-access.js";
import {
  buildLocklessActiveRuntimeLock,
  buildRuntimeTakeoverEvidence,
  canAttachPendingBootstrapRuntime,
  canAttachReadyRuntime,
  canAttachStaleBootstrapRuntime,
  parseBrowserInstanceState,
  readBrowserInstanceState,
  resolveActiveBrowserInstanceState
} from "./profile-runtime-lifecycle.js";
import {
  buildIdentityPreflightError,
  runIdentityPreflight,
  type IdentityPreflightResult
} from "./persistent-extension-identity.js";
import type { ProfileState } from "./profile-state.js";
import {
  buildFingerprintContextForMeta
} from "./fingerprint-runtime.js";
import {
  buildOfficialChromeLaunchEvidenceRecord,
  type OfficialChromeLaunchEvidenceRecord
} from "./official-chrome-launch-evidence.js";
import {
  NativeMessagingBridge,
  NativeMessagingTransportError,
  type BridgeCommandResult
} from "./native-messaging/bridge.js";
import {
  buildClearAccountSafetyRecord,
  buildBlockedAccountSafetyRecord,
  toAccountSafetyStatus,
  type AccountSafetyReason
} from "./account-safety.js";
import {
  buildBlockedXhsCloseoutRhythmRecord,
  claimXhsCloseoutSingleProbe,
  markXhsCloseoutOperatorConfirmed,
  markXhsCloseoutSingleProbeFailed,
  markXhsCloseoutSingleProbePassed,
  toXhsCloseoutRhythmStatus
} from "./xhs-closeout-rhythm.js";
import { NativeHostBridgeTransport } from "./native-messaging/host.js";
import { createLoopbackNativeBridgeTransport } from "./native-messaging/loopback.js";
import { buildRuntimeBootstrapContextId } from "./runtime-bootstrap.js";
import { resolveRuntimeProfileRoot } from "./worktree-root.js";
import {
  applyProfileProxyBinding,
  beginLoginSession,
  beginStartSession,
  beginStopSession,
  buildRuntimeSession,
  markSessionReady,
  markSessionStopped
} from "./runtime-session.js";
import {
  browserStateFromProfileState,
  buildBoundlessRuntimeReadiness,
  buildNonPersistentRuntimeReadiness,
  buildRuntimeReadiness,
  buildUnlockedPersistentRuntimeReadiness,
  mapBootstrapCliErrorToReadiness,
  mapRuntimeReadinessPayload,
  mapTransportErrorToReadiness,
  type RuntimeReadinessSnapshot
} from "./runtime-readiness.js";

const PROFILE_LOCK_FILENAME = "__webenvoy_lock.json";
const LOCK_ACQUIRE_MAX_RETRIES = 6;
const STOP_LOCK_DELETE_MAX_RETRIES = 3;

const assertNotSymlinkPath = async (path: string, reason: string): Promise<void> => {
  try {
    const stat = await lstat(path);
    if (!stat.isSymbolicLink()) {
      return;
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return;
    }
    throw error;
  }

  throw new CliError("ERR_PROFILE_INVALID", "profile native host manifest path contains symlink", {
    details: {
      ability_id: "runtime.identity_preflight",
      stage: "input_validation",
      reason,
      received_path: path
    }
  });
};

const assertProfileNativeHostManifestPathSafe = async (input: {
  profileDir: string;
  manifestPath: string;
}): Promise<void> => {
  const manifestDir = dirname(input.manifestPath);
  const rel = relative(input.profileDir, manifestDir);
  const inside = rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  if (!inside) {
    throw new CliError("ERR_PROFILE_INVALID", "profile native host manifest path escapes profile dir", {
      details: {
        ability_id: "runtime.identity_preflight",
        stage: "input_validation",
        reason: "PROFILE_NATIVE_HOST_MANIFEST_OUTSIDE_PROFILE_DIR",
        profile_dir: input.profileDir,
        received_path: input.manifestPath
      }
    });
  }

  await assertNotSymlinkPath(input.profileDir, "PROFILE_DIR_SYMBOLIC_LINK");
  let current = input.profileDir;
  for (const segment of rel.split(sep).filter((entry) => entry.length > 0 && entry !== ".")) {
    current = join(current, segment);
    await assertNotSymlinkPath(current, "PROFILE_NATIVE_HOST_MANIFEST_PARENT_SYMBOLIC_LINK");
  }
  await assertNotSymlinkPath(input.manifestPath, "PROFILE_NATIVE_HOST_MANIFEST_SYMBOLIC_LINK");
};

const hasRequestedPersistentExtensionIdentity = (params: JsonObject): boolean => {
  const candidate = params.persistent_extension_identity ?? params.persistentExtensionIdentity;
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
};

const hasCompleteRuntimeTargetBinding = (params: JsonObject): boolean =>
  typeof params.target_domain === "string" &&
  params.target_domain.length > 0 &&
  typeof params.target_tab_id === "number" &&
  Number.isInteger(params.target_tab_id) &&
  typeof params.target_page === "string" &&
  params.target_page.length > 0;

const hasRuntimeBootstrapTargetHint = (params: JsonObject): boolean =>
  (typeof params.target_domain === "string" && params.target_domain.length > 0) ||
  (typeof params.target_page === "string" && params.target_page.length > 0) ||
  (typeof params.target_tab_id === "number" && Number.isInteger(params.target_tab_id)) ||
  params.requested_execution_mode === "live_write";

const requiresPersistentBootstrapSocketAdmission = (input: {
  params: JsonObject;
  identityPreflight: IdentityPreflightResult;
}): boolean =>
  input.identityPreflight.mode === "official_chrome_persistent_extension" &&
  input.identityPreflight.identityBindingState === "bound" &&
  hasRuntimeBootstrapTargetHint(input.params);

const shouldFailPersistentBootstrapTransportAdmission = (input: {
  params: JsonObject;
  identityPreflight: IdentityPreflightResult;
  readiness: RuntimeReadinessSnapshot;
}): boolean =>
  requiresPersistentBootstrapSocketAdmission(input) &&
  (input.readiness.transportState === "not_connected" ||
    input.readiness.transportState === "disconnected") &&
  hasPersistentBootstrapMissingSocketProof(input.readiness);

const hasPersistentBootstrapMissingSocketProof = (readiness: RuntimeReadinessSnapshot): boolean => {
  const details =
    typeof readiness.details === "object" && readiness.details !== null && !Array.isArray(readiness.details)
      ? readiness.details
      : {};
  const transportProof =
    typeof details.transport_proof === "object" &&
    details.transport_proof !== null &&
    !Array.isArray(details.transport_proof)
      ? (details.transport_proof as Record<string, unknown>)
      : {};
  return (
    Array.isArray(transportProof.attempted_socket_paths) &&
    transportProof.attempted_socket_paths.length > 0
  );
};

const hasCompleteStaleBootstrapRecoveryTarget = (params: JsonObject): boolean =>
  hasCompleteRuntimeTargetBinding(params) &&
  typeof params.requested_at === "string" &&
  params.requested_at.length > 0;

const OFFICIAL_CHROME_PERSISTENT_PROVIDER_CONTRACT_REF =
  "provider-contract:official-chrome.persistent:v1";

interface RuntimeActionInput {
  cwd: string;
  profile: string;
  runId: string;
  params: JsonObject;
}

const PERSISTENT_BOOTSTRAP_STARTUP_RETRY_ATTEMPTS = 20;
const PERSISTENT_BOOTSTRAP_STARTUP_RETRY_INTERVAL_MS = 500;

export interface MarkAccountSafetyBlockedInput extends RuntimeActionInput {
  signal: {
    reason: AccountSafetyReason;
    sourceCommand: string | null;
    targetDomain: string | null;
    targetTabId: number | null;
    pageUrl: string | null;
    statusCode: number | null;
    platformCode: number | null;
  };
}

export interface MarkXhsCloseoutSingleProbePassedInput extends RuntimeActionInput {}
export interface MarkXhsCloseoutSingleProbeFailedInput extends RuntimeActionInput {
  reasonCode?: string | null;
}
export interface ClaimXhsCloseoutSingleProbeInput extends RuntimeActionInput {}

interface ProfileStoreLike {
  ensureProfileDir(profileName: string): Promise<string>;
  getProfileDir(profileName: string): string;
  readMeta(profileName: string, options?: ReadMetaOptions): Promise<ProfileMeta | null>;
  initializeMeta(
    profileName: string,
    nowIso: string,
    options?: { allowUnsupportedExtensionBrowser?: boolean }
  ): Promise<ProfileMeta>;
  writeMeta(profileName: string, meta: ProfileMeta): Promise<void>;
}

interface LockFileAdapter {
  readFile(path: string, encoding: "utf8"): Promise<string>;
  writeFile(
    path: string,
    data: string,
    options?: { encoding?: "utf8"; flag?: string } | "utf8"
  ): Promise<void>;
  unlink(path: string): Promise<void>;
}

interface BrowserLauncherLike {
  launch(input: {
    command: "runtime.start" | "runtime.login";
    profileDir: string;
    proxyUrl: string | null;
    runId: string;
    params: JsonObject;
    launchMode?: BrowserLaunchMode;
    extensionBootstrap?: JsonObject | null;
  }): Promise<BrowserLaunchResult>;
  shutdown(input: {
    profileDir: string;
    controllerPid: number;
    runId: string;
  }): Promise<void>;
}

interface RuntimeBridgeLike {
  runCommand(input: {
    runId: string;
    profile: string | null;
    cwd: string;
    command: string;
    params: JsonObject;
  }): Promise<BridgeCommandResult>;
  currentTransportProof?: NativeMessagingBridge["currentTransportProof"];
}

interface RuntimeBridgeFactoryOptions {
  waitForProfileSocketOnOpen?: boolean;
}
const isoNow = (): string => new Date().toISOString();
const DEFAULT_LOCK_FILE_ADAPTER: LockFileAdapter = {
  readFile: async (path, encoding) => readFile(path, encoding),
  writeFile: async (path, data, options) => {
    if (typeof options === "string") {
      await writeFile(path, data, options);
      return;
    }
    await writeFile(path, data, options);
  },
  unlink: async (path) => unlink(path)
};

const parseProxyUrl = (params: JsonObject): string | null | undefined => {
  const value = params.proxyUrl;
  if (value === undefined || value === null) {
    return value as null | undefined;
  }
  if (typeof value !== "string") {
    throw new CliError("ERR_PROFILE_INVALID", "params.proxyUrl 必须是字符串或 null");
  }
  if (value.trim().length === 0) {
    throw new CliError("ERR_PROFILE_INVALID", "params.proxyUrl 不能为空字符串");
  }
  return value;
};

const readSessionId = (params: JsonObject): string => {
  const value = params.session_id;
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return "nm-session-001";
};

const readFingerprintMetaMode = (params: JsonObject): ReadMetaMode | undefined =>
  params.migrate_fingerprint_profile_bundle === true ? "migrate" : undefined;

const asObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mapOfficialChromeStableChannel = (
  identityPreflight: IdentityPreflightResult
): { browserChannel: string | null; browserChannelVerified: boolean } => {
  if (
    identityPreflight.mode !== "official_chrome_persistent_extension" ||
    identityPreflight.binding?.browserChannel !== "chrome" ||
    typeof identityPreflight.browserVersion !== "string" ||
    identityPreflight.browserVersion.trim().length === 0
  ) {
    return {
      browserChannel: null,
      browserChannelVerified: false
    };
  }

  return {
    browserChannel: "Google Chrome stable",
    browserChannelVerified: true
  };
};

const withOfficialChromeLaunchEvidence = (input: {
  payload: JsonObject;
  command: "runtime.start";
  runtimeInput: RuntimeActionInput;
  identityPreflight: IdentityPreflightResult;
  launchResult?: BrowserLaunchResult | null;
  persistentExtensionBinding?: PersistentExtensionBinding | null;
  nowIso: string;
}): JsonObject => {
  if (input.identityPreflight.mode !== "official_chrome_persistent_extension") {
    return input.payload;
  }

  const browserChannel = mapOfficialChromeStableChannel(input.identityPreflight);
  const runtimeStatus = {
    ...input.payload,
    runId: input.runtimeInput.runId
  };
  const providerEvidenceRecord: OfficialChromeLaunchEvidenceRecord =
    buildOfficialChromeLaunchEvidenceRecord({
      runId: input.runtimeInput.runId,
      commandRef: input.command,
      providerId: "official-chrome.persistent",
      launchEnvelopeRef: `launch-envelope:${input.command}:${input.runtimeInput.runId}:v1`,
      providerContractRef: OFFICIAL_CHROME_PERSISTENT_PROVIDER_CONTRACT_REF,
      providerContractVerified: true,
      browserChannel: browserChannel.browserChannel,
      browserChannelVerified: browserChannel.browserChannelVerified,
      browserVersion: input.identityPreflight.browserVersion,
      profileRef: `profile:${input.runtimeInput.profile}`,
      createdAt: input.nowIso,
      collectedAt: input.nowIso,
      launchResult: input.launchResult ?? null,
      runtimeStatus,
      persistentExtensionBinding:
        input.persistentExtensionBinding ?? input.identityPreflight.binding,
      networkRegionalRef:
        typeof input.payload.proxyUrl === "string" && input.payload.proxyUrl.length > 0
          ? `proxy:${input.runtimeInput.profile}`
          : null,
      fingerprintPolicyRef: "fingerprint-policy:runtime-profile"
    });

  return {
    ...input.payload,
    launch_evidence_ref: providerEvidenceRecord.identity.provider_evidence_record_id,
    provider_evidence_record: providerEvidenceRecord
  };
};

const parseLocalStorageSnapshot = (params: JsonObject): LocalStorageSnapshot | null => {
  const rawSnapshot = params.localStorageSnapshot;
  if (rawSnapshot === undefined || rawSnapshot === null) {
    return null;
  }
  if (!asObjectRecord(rawSnapshot)) {
    throw new CliError("ERR_PROFILE_INVALID", "params.localStorageSnapshot 必须是对象");
  }
  if (typeof rawSnapshot.origin !== "string" || rawSnapshot.origin.trim().length === 0) {
    throw new CliError("ERR_PROFILE_INVALID", "params.localStorageSnapshot.origin 必须是非空字符串");
  }
  const origin = rawSnapshot.origin;
  if (!Array.isArray(rawSnapshot.entries)) {
    throw new CliError("ERR_PROFILE_INVALID", "params.localStorageSnapshot.entries 必须是数组");
  }
  const entries = rawSnapshot.entries.map((entry, index) => {
    if (!asObjectRecord(entry)) {
      throw new CliError(
        "ERR_PROFILE_INVALID",
        `params.localStorageSnapshot.entries[${index}] 必须是对象`
      );
    }
    if (typeof entry.key !== "string" || typeof entry.value !== "string") {
      throw new CliError(
        "ERR_PROFILE_INVALID",
        `params.localStorageSnapshot.entries[${index}] 的 key/value 必须是字符串`
      );
    }
    return {
      key: entry.key,
      value: entry.value
    };
  });
  return {
    origin,
    entries
  };
};

const upsertLocalStorageSnapshot = (
  snapshots: LocalStorageSnapshot[],
  nextSnapshot: LocalStorageSnapshot | null
): LocalStorageSnapshot[] => {
  if (!nextSnapshot) {
    return snapshots;
  }
  const preserved = snapshots.filter((snapshot) => snapshot.origin !== nextSnapshot.origin);
  return [...preserved, nextSnapshot];
};

const buildRecoverableSessionSummary = (
  meta: Pick<ProfileMeta, "localStorageSnapshots" | "lastLoginAt"> | null
): JsonObject => {
  const snapshots = meta?.localStorageSnapshots ?? [];
  return {
    hasLocalStorageSnapshot: snapshots.length > 0,
    snapshotCount: snapshots.length,
    origins: snapshots.map((snapshot) => snapshot.origin),
    lastLoginAt: meta?.lastLoginAt ?? null
  };
};
const shouldConfirmLogin = (params: JsonObject): boolean => params.confirm === true;
const shouldConfirmAccountRecovery = (params: JsonObject): boolean =>
  params.account_recovery_confirmed === true;
const LIVE_EXECUTION_MODES = new Set(["live_read_limited", "live_read_high_risk", "live_write"]);
const XHS_TARGET_DOMAINS = new Set(["www.xiaohongshu.com", "creator.xiaohongshu.com"]);

const readRequestedExecutionMode = (params: JsonObject): string | null => {
  const mode = params.requested_execution_mode;
  return typeof mode === "string" && mode.length > 0 ? mode : null;
};

const isXhsManagedProfile = (profile: string): boolean =>
  profile === "xhs_001" || profile.startsWith("xhs_");

const isXhsUrl = (value: unknown): boolean => {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim() === "about:blank") {
    return false;
  }
  try {
    const parsed = new URL(value.trim());
    return XHS_TARGET_DOMAINS.has(parsed.hostname) || parsed.hostname.endsWith(".xiaohongshu.com");
  } catch {
    return false;
  }
};

const isXhsTargetDomain = (value: unknown): boolean =>
  typeof value === "string" && XHS_TARGET_DOMAINS.has(value.trim().toLowerCase());

const referencesXhsSurface = (profile: string, params: JsonObject): boolean =>
  isXhsManagedProfile(profile) ||
  isXhsTargetDomain(params.target_domain) ||
  isXhsUrl(params.startUrl);

const ensureXhsRuntimeStartVisible = (input: RuntimeActionInput): void => {
  if (!referencesXhsSurface(input.profile, input.params) || input.params.headless === false) {
    return;
  }
  throw new CliError("ERR_PROFILE_INVALID", "XHS managed live profile 禁止 headless runtime.start", {
    details: {
      ability_id: "runtime.start",
      stage: "input_validation",
      reason: "XHS_HEADLESS_RUNTIME_BLOCKED",
      profile: input.profile,
      target_domain:
        typeof input.params.target_domain === "string" ? input.params.target_domain : null,
      start_url: typeof input.params.startUrl === "string" ? input.params.startUrl : null,
      required_param: "params.headless=false"
    }
  });
};

const buildForwardTimeoutParams = (params: JsonObject): JsonObject => ({
  ...(typeof params.timeout_ms === "number" && Number.isInteger(params.timeout_ms) && params.timeout_ms > 0
    ? { timeout_ms: params.timeout_ms }
    : {})
});

const buildRuntimeTargetParams = (params: JsonObject): JsonObject => ({
  ...(typeof params.target_domain === "string" && params.target_domain.length > 0
    ? { target_domain: params.target_domain }
    : {}),
  ...(typeof params.target_tab_id === "number" && Number.isInteger(params.target_tab_id)
    ? { target_tab_id: params.target_tab_id }
    : {}),
  ...(typeof params.target_page === "string" && params.target_page.length > 0
    ? { target_page: params.target_page }
    : {}),
  ...(typeof params.target_resource_id === "string" && params.target_resource_id.length > 0
    ? { target_resource_id: params.target_resource_id }
    : {})
});

const ensureFingerprintExecutionAllowed = (
  requestedExecutionMode: string | null,
  fingerprintRuntime: ReturnType<typeof buildFingerprintContextForMeta>
): void => {
  if (!requestedExecutionMode || !LIVE_EXECUTION_MODES.has(requestedExecutionMode)) {
    return;
  }
  if (fingerprintRuntime.execution.live_allowed) {
    return;
  }
  throw new CliError(
    "ERR_PROFILE_INVALID",
    `profile 指纹一致性校验未通过，禁止 ${requestedExecutionMode}`,
    {
      details: {
        ability_id: "runtime.profile",
        stage: "input_validation",
        reason: fingerprintRuntime.execution.reason_codes[0] ?? "FINGERPRINT_RUNTIME_INCONSISTENT"
      }
    }
  );
};

type ExtensionBootstrapInput = {
  run_id: string;
  session_id: string;
  fingerprint_runtime: ReturnType<typeof buildFingerprintContextForMeta>;
};

type RuntimeBootstrapEnvelope = {
  version: "v1";
  run_id: string;
  runtime_context_id: string;
  profile: string;
  requested_at?: string;
  target_domain?: string;
  target_tab_id?: number;
  target_page?: string;
  target_resource_id?: string;
  timeout_ms?: number;
  fingerprint_runtime: ReturnType<typeof buildFingerprintContextForMeta>;
  fingerprint_patch_manifest: Record<string, unknown>;
  main_world_secret: string;
};

const buildExtensionBootstrapInput = (
  runId: string,
  sessionId: string,
  fingerprintRuntime: ReturnType<typeof buildFingerprintContextForMeta>
): ExtensionBootstrapInput => ({
  run_id: runId,
  session_id: sessionId,
  fingerprint_runtime: fingerprintRuntime
});

const buildRuntimeBootstrapEnvelope = (input: {
  profile: string;
  runId: string;
  runtimeContextId: string;
  fingerprintRuntime: ReturnType<typeof buildFingerprintContextForMeta>;
  mainWorldSecret: string;
  requestedAt?: string;
  targetDomain?: string;
  targetTabId?: number;
  targetPage?: string;
  targetResourceId?: string;
  timeout_ms?: number;
}): RuntimeBootstrapEnvelope => ({
  version: "v1",
  run_id: input.runId,
  runtime_context_id: input.runtimeContextId,
  profile: input.profile,
  ...(typeof input.requestedAt === "string" && input.requestedAt.length > 0
    ? { requested_at: input.requestedAt }
    : {}),
  ...(typeof input.targetDomain === "string" && input.targetDomain.length > 0
    ? { target_domain: input.targetDomain }
    : {}),
  ...(typeof input.targetTabId === "number" && Number.isInteger(input.targetTabId)
    ? { target_tab_id: input.targetTabId }
    : {}),
  ...(typeof input.targetPage === "string" && input.targetPage.length > 0
    ? { target_page: input.targetPage }
    : {}),
  ...(typeof input.targetResourceId === "string" && input.targetResourceId.length > 0
    ? { target_resource_id: input.targetResourceId }
    : {}),
  ...(typeof input.timeout_ms === "number" && Number.isInteger(input.timeout_ms) && input.timeout_ms > 0
    ? { timeout_ms: input.timeout_ms }
    : {}),
  fingerprint_runtime: input.fingerprintRuntime,
  fingerprint_patch_manifest: input.fingerprintRuntime.fingerprint_patch_manifest
    ? (input.fingerprintRuntime.fingerprint_patch_manifest as unknown as Record<string, unknown>)
    : {},
  main_world_secret: input.mainWorldSecret
});

const resolveDefaultRuntimeBridge = (
  options?: RuntimeBridgeFactoryOptions
): RuntimeBridgeLike => {
  if (process.env.WEBENVOY_NATIVE_TRANSPORT === "loopback") {
    return new NativeMessagingBridge({
      transport: createLoopbackNativeBridgeTransport()
    });
  }
  return new NativeMessagingBridge({
    transport: new NativeHostBridgeTransport(undefined, {
      waitForProfileSocketOnOpen: options?.waitForProfileSocketOnOpen === true
    })
  });
};

const isTransientBackfilledFingerprintBundle = (bundle: unknown): boolean => {
  if (typeof bundle !== "object" || bundle === null || Array.isArray(bundle)) {
    return false;
  }
  const legacyMigration = (bundle as { legacy_migration?: { status?: unknown } }).legacy_migration;
  return (
    typeof legacyMigration === "object" &&
    legacyMigration !== null &&
    !Array.isArray(legacyMigration) &&
    legacyMigration.status === "backfilled_from_legacy"
  );
};

const shouldBlockSessionEntryOnIdentityPreflight = (
  preflight: IdentityPreflightResult
): boolean =>
  preflight.blocking && preflight.failureReason !== "IDENTITY_BINDING_MISSING";

const shouldPersistFingerprintBundle = (
  currentMeta: ProfileMeta,
  fingerprintRuntime: ReturnType<typeof buildFingerprintContextForMeta>
): ProfileMeta["fingerprintProfileBundle"] | null => {
  const currentBundle = currentMeta.fingerprintProfileBundle;
  const nextBundle = fingerprintRuntime.fingerprint_profile_bundle;
  if (!nextBundle) {
    return currentBundle ?? null;
  }

  const isTransientLegacyBackfill =
    isTransientBackfilledFingerprintBundle(nextBundle) &&
    (!currentBundle || isTransientBackfilledFingerprintBundle(currentBundle));

  if (isTransientLegacyBackfill) {
    return null;
  }

  return nextBundle;
};

const resolvePersistentExtensionBindingForMeta = (input: {
  currentMeta: ProfileMeta;
  identityPreflight: IdentityPreflightResult;
}): PersistentExtensionBinding | null =>
  input.identityPreflight.mode === "official_chrome_persistent_extension" &&
    input.identityPreflight.binding
    ? input.identityPreflight.binding
    : (input.currentMeta.persistentExtensionBinding ?? null);

const asResultRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const mapRuntimeError = (error: unknown): CliError => {
  if (error instanceof CliError) {
    return error;
  }
  if (error instanceof BrowserLaunchError) {
    if (error.code === "BROWSER_INVALID_ARGUMENT") {
      return new CliError("ERR_PROFILE_INVALID", error.message);
    }
    return new CliError("ERR_BROWSER_LAUNCH_FAILED", error.message, {
      retryable: error.code !== "BROWSER_NOT_FOUND",
      cause: error
    });
  }
  if (error instanceof Error) {
    if (/Invalid profile name/i.test(error.message)) {
      return new CliError("ERR_PROFILE_INVALID", "profile 名称非法");
    }
    if (/Profile lock conflict/i.test(error.message)) {
      return new CliError("ERR_PROFILE_LOCKED", "profile 当前被其他运行占用", {
        retryable: true
      });
    }
    if (/Proxy binding conflict/i.test(error.message)) {
      return new CliError("ERR_PROFILE_PROXY_CONFLICT", "profile 代理绑定冲突");
    }
    if (/Invalid proxy URL|Unsupported proxy protocol/i.test(error.message)) {
      return new CliError("ERR_PROFILE_INVALID", error.message);
    }
  }
  return new CliError("ERR_RUNTIME_UNAVAILABLE", "最小会话运行时不可用", { retryable: true });
};

const buildIdentityPreflightOutput = (identityPreflight: IdentityPreflightResult) => {
  const codeIdentityObservation =
    identityPreflight.extensionServiceWorkerFreshness?.codeIdentityObservation ?? null;
  return {
    mode: identityPreflight.mode,
    binding: identityPreflight.binding,
    manifestPath: identityPreflight.manifestPath,
    manifestSource: identityPreflight.manifestSource,
    expectedOrigin: identityPreflight.expectedOrigin,
    allowedOrigins: identityPreflight.allowedOrigins,
    browserPath: identityPreflight.browserPath,
    browserVersion: identityPreflight.browserVersion,
    blocking: identityPreflight.blocking,
    failureReason: identityPreflight.failureReason,
    installDiagnostics: identityPreflight.installDiagnostics,
    extensionServiceWorkerFreshness: identityPreflight.extensionServiceWorkerFreshness,
    extension_service_worker_code_identity: codeIdentityObservation,
    provider_doctor_extension_load_check:
      codeIdentityObservation?.provider_doctor_extension_load_check ?? null
  };
};

export class ProfileRuntimeService {
  readonly #storeFactory: (cwd: string) => ProfileStoreLike;
  readonly #lockFileAdapter: LockFileAdapter;
  readonly #isProcessAlive: (pid: number) => boolean;
  readonly #browserLauncher: BrowserLauncherLike;
  readonly #bridgeFactory: (options?: RuntimeBridgeFactoryOptions) => RuntimeBridgeLike;

  constructor(options?: {
    storeFactory?: (cwd: string) => ProfileStoreLike;
    lockFileAdapter?: LockFileAdapter;
    isProcessAlive?: (pid: number) => boolean;
    browserLauncher?: BrowserLauncherLike;
    bridgeFactory?: (options?: RuntimeBridgeFactoryOptions) => RuntimeBridgeLike;
  }) {
    this.#storeFactory =
      options?.storeFactory ??
      ((cwd: string) => {
        return new ProfileStore(resolveRuntimeProfileRoot(cwd));
      });
    this.#lockFileAdapter = options?.lockFileAdapter ?? DEFAULT_LOCK_FILE_ADAPTER;
    this.#isProcessAlive =
      options?.isProcessAlive ??
      ((pid: number) => {
        if (!Number.isInteger(pid) || pid <= 0) {
          return false;
        }
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      });
    this.#browserLauncher = options?.browserLauncher ?? {
      launch: launchBrowser,
      shutdown: shutdownBrowserSession
    };
    this.#bridgeFactory = options?.bridgeFactory ?? ((bridgeOptions) =>
      resolveDefaultRuntimeBridge(bridgeOptions)
    );
  }

  async start(input: RuntimeActionInput): Promise<JsonObject> {
    const nowIso = isoNow();
    ensureXhsRuntimeStartVisible(input);
    const store = this.#createStore(input.cwd);
    const profileDir = this.#resolveProfileDir(store, input.profile);
    await store.ensureProfileDir(input.profile);
    const lockPath = this.#getLockPath(profileDir);
    const lockAcquireResult = await this.#acquireProfileLockAtomically({
      profileName: input.profile,
      profileDir,
      lockPath,
      runId: input.runId,
      nowIso
    });
    const keepExistingLockOnFailure =
      lockAcquireResult.acquisition === "same-owner" &&
      lockAcquireResult.lock.ownerPid !== process.pid;
    let startSucceeded = false;
    let launchedControllerPid: number | null = null;

    try {
      let existingMeta = await this.#readMeta(store, input.profile, {
        mode: readFingerprintMetaMode(input.params)
      });
      const identityPreflight = await this.#runIdentityPreflight({
        input,
        meta: existingMeta,
        profileDir
      });
      const usesPersistentIdentityMode =
        identityPreflight.mode === "official_chrome_persistent_extension";
      if (shouldBlockSessionEntryOnIdentityPreflight(identityPreflight)) {
        throw buildIdentityPreflightError(identityPreflight);
      }
      if (!existingMeta) {
        existingMeta = await store.initializeMeta(input.profile, nowIso, {
          allowUnsupportedExtensionBrowser:
            usesPersistentIdentityMode ||
            hasRequestedPersistentExtensionIdentity(input.params)
        });
      }
      let recoveredMeta =
        shouldRecoverAsDisconnected(lockAcquireResult.acquisition, existingMeta.profileState)
          ? this.#patchMeta(existingMeta, {
              profileName: input.profile,
              profileDir,
              profileState: "disconnected",
              proxyBinding: existingMeta.proxyBinding,
              fingerprintProfileBundle: existingMeta.fingerprintProfileBundle,
              updatedAt: nowIso,
              lastDisconnectedAt: nowIso
            })
          : existingMeta;
      const profileState = recoveredMeta.profileState;
      if (!isStartableProfileState(profileState)) {
        throw new CliError(
          "ERR_PROFILE_STATE_CONFLICT",
          `profile 当前状态 ${profileState} 不能直接 start`
        );
      }
      let session = buildRuntimeSession(input.profile, recoveredMeta);
      session = applyProfileProxyBinding(session, {
        requested: parseProxyUrl(input.params),
        nowIso,
        source: "runtime.start"
      });
      const requestedExecutionMode = readRequestedExecutionMode(input.params);
      const fingerprintRuntime = buildFingerprintContextForMeta(input.profile, recoveredMeta, {
        requestedExecutionMode
      });
      ensureFingerprintExecutionAllowed(requestedExecutionMode, fingerprintRuntime);
      session = beginStartSession(session, {
        runId: input.runId,
        nowIso
      });
      const browserLaunch = await this.#browserLauncher.launch({
        command: "runtime.start",
        profileDir,
        proxyUrl: session.proxyBinding?.url ?? null,
        runId: input.runId,
        params: input.params,
        launchMode: identityPreflight.mode,
        extensionBootstrap:
          identityPreflight.mode === "load_extension"
            ? buildExtensionBootstrapInput(
                input.runId,
                readSessionId(input.params),
                fingerprintRuntime
              )
            : null
      });
      launchedControllerPid = browserLaunch.controllerPid;
      await this.#updateLockOwnerPid(lockPath, input.runId, {
        ownerPid:
          browserLaunch.processOwnership === "external_persistent_app"
            ? browserLaunch.browserPid
            : browserLaunch.controllerPid,
        controllerPid: browserLaunch.controllerPid,
        nowIso
      });
      session = markSessionReady(session);
      const readiness =
        identityPreflight.identityBindingState === "bound"
          ? await this.#deliverRuntimeBootstrapForStartup({
              runtimeInput: input,
              profile: input.profile,
              fingerprintRuntime,
              identityPreflight,
              profileState: session.profileState
            })
          : await this.#readRuntimeReadiness({
              runtimeInput: input,
              lockHeld: true,
              identityPreflight,
              profileState: session.profileState
            });
      if (
        shouldFailPersistentBootstrapTransportAdmission({
          params: input.params,
          identityPreflight,
          readiness
        })
      ) {
        throw new CliError(
          "ERR_RUNTIME_BOOTSTRAP_TRANSPORT_NOT_CONNECTED",
          "official Chrome persistent extension native bridge socket was not opened",
          {
            details: {
              ability_id: "runtime.start",
              stage: "execution",
              reason: "PERSISTENT_EXTENSION_NATIVE_BRIDGE_SOCKET_NOT_OPENED",
              transport_state: readiness.transportState,
              bootstrap_state: readiness.bootstrapState,
              runtime_readiness: readiness.runtimeReadiness,
              profile: input.profile,
              target_domain:
                typeof input.params.target_domain === "string" ? input.params.target_domain : null,
              target_page:
                typeof input.params.target_page === "string" ? input.params.target_page : null,
              requested_execution_mode:
                typeof input.params.requested_execution_mode === "string"
                  ? input.params.requested_execution_mode
                  : null,
              transport_diagnostics: readiness.details ?? {}
            },
            retryable: true
          }
        );
      }

      const nextMeta = this.#patchMeta(recoveredMeta, {
        profileName: input.profile,
        profileDir,
        profileState: session.profileState,
        proxyBinding: session.proxyBinding,
        persistentExtensionBinding: resolvePersistentExtensionBindingForMeta({
          currentMeta: recoveredMeta,
          identityPreflight
        }),
        fingerprintProfileBundle: shouldPersistFingerprintBundle(recoveredMeta, fingerprintRuntime),
        updatedAt: nowIso,
        lastStartedAt: nowIso
      });
      await store.writeMeta(
        input.profile,
        nextMeta
      );

      startSucceeded = true;
      const payload: JsonObject = {
        profile: input.profile,
        profileState: session.profileState,
        browserState: browserStateFromProfileState(session.profileState, true),
        profileDir,
        proxyUrl: session.proxyBinding?.url ?? null,
        lockHeld: true,
        identityBindingState: readiness.identityBindingState,
        transportState: readiness.transportState,
        bootstrapState: readiness.bootstrapState,
        runtimeReadiness: readiness.runtimeReadiness,
        identityPreflight: buildIdentityPreflightOutput(identityPreflight),
        browserPath: browserLaunch.browserPath,
        browserPid: browserLaunch.browserPid,
        controllerPid: browserLaunch.controllerPid,
        headless: browserLaunch.headless ?? null,
        executionSurface: browserLaunch.executionSurface ?? null,
        recoverableSession: buildRecoverableSessionSummary(nextMeta),
        fingerprint_runtime: fingerprintRuntime,
        startedAt: nowIso
      };
      return withOfficialChromeLaunchEvidence({
        payload,
        command: "runtime.start",
        runtimeInput: input,
        identityPreflight,
        launchResult: browserLaunch,
        persistentExtensionBinding: nextMeta.persistentExtensionBinding ?? null,
        nowIso
      });
    } catch (error) {
      throw mapRuntimeError(error);
    } finally {
      if (!startSucceeded) {
        await this.#cleanupLaunchedBrowserOnStartFailure({
          profileDir,
          controllerPid: launchedControllerPid,
          runId: input.runId
        });
        if (!keepExistingLockOnFailure) {
          await this.#rollbackLockOnStartFailure(lockPath, input.runId);
        }
      }
    }
  }

  async login(input: RuntimeActionInput): Promise<JsonObject> {
    const nowIso = isoNow();
    const store = this.#createStore(input.cwd);
    const profileDir = this.#resolveProfileDir(store, input.profile);
    await store.ensureProfileDir(input.profile);
    const lockPath = this.#getLockPath(profileDir);
    const confirmLogin = shouldConfirmLogin(input.params);
    const confirmAccountRecovery = confirmLogin && shouldConfirmAccountRecovery(input.params);
    const lockAcquireResult = await this.#acquireProfileLockAtomically({
      profileName: input.profile,
      profileDir,
      lockPath,
      runId: input.runId,
      nowIso,
      allowDeadOwnerRecoveryForSameRun: !confirmLogin
    });
    let loginSucceeded = false;
    let keepLockOnFailure = false;
    let launchedControllerPid: number | null = null;

    try {
      let existingMeta = await this.#readMeta(store, input.profile, {
        mode: readFingerprintMetaMode(input.params)
      });
      const identityPreflight = await this.#runIdentityPreflight({
        input,
        meta: existingMeta,
        profileDir
      });
      const usesPersistentIdentityMode =
        identityPreflight.mode === "official_chrome_persistent_extension";
      if (shouldBlockSessionEntryOnIdentityPreflight(identityPreflight)) {
        throw buildIdentityPreflightError(identityPreflight);
      }
      if (!existingMeta) {
        existingMeta = await store.initializeMeta(input.profile, nowIso, {
          allowUnsupportedExtensionBrowser:
            usesPersistentIdentityMode ||
            hasRequestedPersistentExtensionIdentity(input.params)
        });
      }
      let recoveredMeta = shouldRecoverAsDisconnected(
        lockAcquireResult.acquisition,
        existingMeta.profileState
      )
        ? this.#patchMeta(existingMeta, {
            profileName: input.profile,
            profileDir,
            profileState: "disconnected",
            proxyBinding: existingMeta.proxyBinding,
            fingerprintProfileBundle: existingMeta.fingerprintProfileBundle,
            updatedAt: nowIso,
            lastDisconnectedAt: nowIso
          })
        : existingMeta;

      const profileState = recoveredMeta.profileState;
      if (!isLoginableProfileState(profileState)) {
        throw new CliError(
          "ERR_PROFILE_STATE_CONFLICT",
          `profile 当前状态 ${profileState} 不能直接 login`
        );
      }

      if (
        confirmLogin &&
        (lockAcquireResult.acquisition !== "same-owner" ||
          lockAcquireResult.lock.ownerRunId !== input.runId ||
          lockAcquireResult.lock.ownerPid === process.pid ||
          !(await this.#inspectProfileLock(lockAcquireResult.lock, profileDir)).controlConnected)
      ) {
        if (
          isRuntimeActiveProfileState(recoveredMeta.profileState) ||
          recoveredMeta.profileState === "disconnected"
        ) {
          await store.writeMeta(
            input.profile,
            this.#patchMeta(recoveredMeta, {
              profileName: input.profile,
              profileDir,
              profileState: "disconnected",
              proxyBinding: recoveredMeta.proxyBinding,
              fingerprintProfileBundle: recoveredMeta.fingerprintProfileBundle,
              updatedAt: nowIso,
              lastDisconnectedAt: nowIso
            })
          );
        }

        throw new CliError(
          "ERR_PROFILE_STATE_CONFLICT",
          "runtime.login --confirm 前检测到登录浏览器已断开，请重新执行 runtime.login",
          { retryable: true }
        );
      }

      let session = buildRuntimeSession(input.profile, recoveredMeta);
      session = applyProfileProxyBinding(session, {
        requested: parseProxyUrl(input.params),
        nowIso,
        source: "runtime.login"
      });
      const requestedExecutionMode = readRequestedExecutionMode(input.params);
      const fingerprintRuntime = buildFingerprintContextForMeta(input.profile, recoveredMeta, {
        requestedExecutionMode
      });
      ensureFingerprintExecutionAllowed(requestedExecutionMode, fingerprintRuntime);
      session = beginLoginSession(session, {
        runId: input.runId,
        nowIso
      });

      if (!confirmLogin) {
        const browserLaunch = await this.#browserLauncher.launch({
          command: "runtime.login",
          profileDir,
          proxyUrl: session.proxyBinding?.url ?? null,
          runId: input.runId,
          params: input.params,
          launchMode: identityPreflight.mode,
          extensionBootstrap:
            identityPreflight.mode === "load_extension"
              ? buildExtensionBootstrapInput(
                  input.runId,
                  readSessionId(input.params),
                  fingerprintRuntime
                )
              : null
        });
        launchedControllerPid = browserLaunch.controllerPid;
        await this.#updateLockOwnerPid(lockPath, input.runId, {
          ownerPid:
            browserLaunch.processOwnership === "external_persistent_app"
              ? browserLaunch.browserPid
              : browserLaunch.controllerPid,
          controllerPid: browserLaunch.controllerPid,
          nowIso
        });
      }

      await store.writeMeta(
        input.profile,
        this.#patchMeta(recoveredMeta, {
          profileName: input.profile,
          profileDir,
          profileState: session.profileState,
          proxyBinding: session.proxyBinding,
          persistentExtensionBinding: resolvePersistentExtensionBindingForMeta({
            currentMeta: recoveredMeta,
            identityPreflight
          }),
          fingerprintProfileBundle: shouldPersistFingerprintBundle(recoveredMeta, fingerprintRuntime),
          updatedAt: nowIso
        })
      );

      if (!confirmLogin) {
        const readiness = await this.#readRuntimeReadiness({
          runtimeInput: input,
          lockHeld: true,
          identityPreflight,
          profileState: session.profileState
        });
        loginSucceeded = true;
        keepLockOnFailure = true;
        return {
          profile: input.profile,
          profileState: session.profileState,
          browserState: browserStateFromProfileState(session.profileState, true),
          profileDir,
          proxyUrl: session.proxyBinding?.url ?? null,
          lockHeld: true,
          identityBindingState: readiness.identityBindingState,
          transportState: readiness.transportState,
          bootstrapState: readiness.bootstrapState,
          runtimeReadiness: readiness.runtimeReadiness,
          identityPreflight: buildIdentityPreflightOutput(identityPreflight),
          recoverableSession: buildRecoverableSessionSummary(recoveredMeta),
          fingerprint_runtime: fingerprintRuntime,
          confirmationRequired: true,
          confirmPath: "runtime.login --params '{\"confirm\":true}'"
        };
      }

      const localStorageSnapshot = parseLocalStorageSnapshot(input.params);
      session = markSessionReady(session);
      const readiness = identityPreflight.identityBindingState === "bound"
        ? await this.#deliverRuntimeBootstrap({
            runtimeInput: input,
            profile: input.profile,
            fingerprintRuntime,
            identityPreflight
          })
        : await this.#readRuntimeReadiness({
            runtimeInput: input,
            lockHeld: true,
            identityPreflight,
            profileState: session.profileState
          });
      const nextMetaBase = this.#patchMeta(recoveredMeta, {
        profileName: input.profile,
        profileDir,
        profileState: session.profileState,
        proxyBinding: session.proxyBinding,
        persistentExtensionBinding: resolvePersistentExtensionBindingForMeta({
          currentMeta: recoveredMeta,
          identityPreflight
        }),
        fingerprintProfileBundle: shouldPersistFingerprintBundle(recoveredMeta, fingerprintRuntime),
        updatedAt: nowIso,
        lastLoginAt: nowIso,
        localStorageSnapshots: upsertLocalStorageSnapshot(
          recoveredMeta.localStorageSnapshots,
          localStorageSnapshot
        )
      });
      const recoveryRhythmCurrent =
        recoveredMeta.xhsCloseoutRhythm ??
        (recoveredMeta.accountSafety?.state === "account_risk_blocked"
          ? buildBlockedXhsCloseoutRhythmRecord({
              cooldownUntil: recoveredMeta.accountSafety.cooldownUntil,
              reasonCode: recoveredMeta.accountSafety.reason
            })
          : undefined);
      const nextMeta: ProfileMeta = confirmAccountRecovery
        ? {
            ...nextMetaBase,
            accountSafety: buildClearAccountSafetyRecord(),
            xhsCloseoutRhythm: markXhsCloseoutOperatorConfirmed({
              current: recoveryRhythmCurrent,
              confirmedAt: nowIso
            })
          }
        : nextMetaBase;
      await store.writeMeta(
        input.profile,
        nextMeta
      );

      loginSucceeded = true;
      return {
        profile: input.profile,
        profileState: session.profileState,
        browserState: browserStateFromProfileState(session.profileState, true),
        profileDir,
        proxyUrl: session.proxyBinding?.url ?? null,
        lockHeld: true,
        identityBindingState: readiness.identityBindingState,
        transportState: readiness.transportState,
        bootstrapState: readiness.bootstrapState,
        runtimeReadiness: readiness.runtimeReadiness,
        identityPreflight: buildIdentityPreflightOutput(identityPreflight),
        recoverableSession: buildRecoverableSessionSummary(nextMeta),
        fingerprint_runtime: fingerprintRuntime,
        lastLoginAt: nowIso,
        ...(confirmAccountRecovery
          ? {
              account_safety: toAccountSafetyStatus(nextMeta.accountSafety),
              xhs_closeout_rhythm: toXhsCloseoutRhythmStatus({
                rhythm: nextMeta.xhsCloseoutRhythm,
                accountSafety: nextMeta.accountSafety
              })
            }
          : {})
      };
    } catch (error) {
      throw mapRuntimeError(error);
    } finally {
      if (!loginSucceeded && !keepLockOnFailure) {
        await this.#terminateProcess(launchedControllerPid);
        await this.#rollbackLockOnStartFailure(lockPath, input.runId);
      }
    }
  }

  async status(input: RuntimeActionInput): Promise<JsonObject> {
    const store = this.#createStore(input.cwd);
    const profileDir = this.#resolveProfileDir(store, input.profile);
    const lockPath = this.#getLockPath(profileDir);
    const meta = await this.#readMeta(store, input.profile, {
      mode: readFingerprintMetaMode(input.params) ?? "readonly"
    });
    const persistedLock = await this.#readLock(lockPath);
    const browserInstanceState = await this.#readBrowserInstanceState(profileDir);
    const lock =
      persistedLock ??
      (hasCompleteStaleBootstrapRecoveryTarget(input.params)
        ? this.#buildLocklessActiveRuntimeLock({
            profile: input.profile,
            lockPath,
            state: browserInstanceState,
            nowIso: isoNow()
          })
        : null);

    const storedProfileState: ProfileState = meta?.profileState ?? "uninitialized";
    const lockInspection =
      lock !== null ? await this.#inspectProfileLock(lock, profileDir) : null;
    const accessState = resolveProfileAccessState({
      storedProfileState,
      lockOwnerRunId: lock?.ownerRunId ?? null,
      lockInspection,
      runtimeRunId: input.runId
    });
    const pinnedControllerPid =
      typeof lock?.controllerPid === "number" ? lock.controllerPid : lock?.ownerPid;
    const activeBrowserInstanceState = resolveActiveBrowserInstanceState({
      state: browserInstanceState,
      observedRunId: accessState.observedRunId,
      pinnedControllerPid,
      healthyLock: accessState.healthyLock
    });
    const requestedExecutionMode = readRequestedExecutionMode(input.params);
    const fingerprintRuntime = buildFingerprintContextForMeta(input.profile, meta, {
      requestedExecutionMode
    });
    const identityPreflight = await runIdentityPreflight({
      params: input.params,
      meta,
      profileDir
    });
    const observedReadyAttachReadiness = await this.#readObservedRuntimeReadiness({
      runtimeInput: input,
      lockHeld: accessState.lockHeld,
      observedRunId: accessState.observedRunId,
      identityPreflight,
      profileState: accessState.profileState
    });
    const observedTargetReadiness =
      hasCompleteRuntimeTargetBinding(input.params)
        ? await this.#readObservedRuntimeReadiness({
            runtimeInput: input,
            lockHeld: accessState.lockHeld,
            observedRunId: accessState.observedRunId,
            identityPreflight,
            profileState: accessState.profileState,
            includeTargetBinding: true
          })
        : null;
    const readiness = await this.#readRuntimeReadiness({
      runtimeInput: input,
      lockHeld: accessState.lockHeld,
      observedRunId: accessState.observedRunId,
      identityPreflight,
      profileState: accessState.profileState
    });
    const attachableReadyRuntime = canAttachReadyRuntime({
      healthyLock: persistedLock === null ? false : accessState.healthyLock,
      profileState: accessState.profileState,
      pinnedControllerPid,
      readiness: observedReadyAttachReadiness ?? readiness
    });
    const staleBootstrapRecoverable = canAttachStaleBootstrapRuntime({
      profile: input.profile,
      healthyLock: accessState.healthyLock,
      controlConnected: accessState.controlConnected,
      profileState: accessState.profileState,
      pinnedControllerPid,
      readiness: observedTargetReadiness,
      observedRunId: accessState.observedRunId,
      targetBindingComplete: hasCompleteRuntimeTargetBinding(input.params),
      targetTabId: input.params.target_tab_id,
      targetDomain: input.params.target_domain,
      targetPage: input.params.target_page,
      requestedAt: input.params.requested_at
    });
    const pendingBootstrapRecoverable = canAttachPendingBootstrapRuntime({
      healthyLock: accessState.healthyLock,
      controlConnected: accessState.controlConnected,
      profileState: accessState.profileState,
      pinnedControllerPid,
      readiness: observedTargetReadiness,
      targetBindingComplete: hasCompleteRuntimeTargetBinding(input.params),
      targetTabId: input.params.target_tab_id,
      targetDomain: input.params.target_domain,
      targetPage: input.params.target_page
    });
    const attachableRecoverableRuntime =
      !accessState.lockHeld &&
      persistedLock !== null &&
      (accessState.profileState === "ready" || accessState.profileState === "disconnected") &&
      (lockInspection?.orphanRecoverable ?? false) &&
      readiness.identityBindingState === "bound" &&
      readiness.bootstrapState !== "stale" &&
      readiness.transportState !== "not_connected" &&
      readiness.runtimeReadiness === "recoverable";
    const evidenceReadiness =
      observedTargetReadiness !== null
        ? observedTargetReadiness
        : attachableReadyRuntime && observedReadyAttachReadiness !== null
          ? observedReadyAttachReadiness
          : readiness;
    const runtimeTakeoverEvidence = buildRuntimeTakeoverEvidence({
      profile: input.profile,
      lockHeld: accessState.lockHeld,
      healthyLock: accessState.healthyLock,
      controlConnected: accessState.controlConnected,
      observedRunId: accessState.observedRunId,
      requestRunId: input.runId,
      requestRuntimeContextId: buildRuntimeBootstrapContextId(input.profile, input.runId),
      requestedTargetTabId: input.params.target_tab_id,
      requestedTargetDomain: input.params.target_domain,
      requestedTargetPage: input.params.target_page,
      readiness: evidenceReadiness,
      attachableReadyRuntime,
      pendingBootstrapRecoverable,
      orphanRecoverable: attachableRecoverableRuntime,
      staleBootstrapRecoverable,
      pinnedControllerPid,
      browserPid: lockInspection?.browserPid ?? null,
      stateRunId: lockInspection?.stateRunId ?? null
    });

    return {
      profile: input.profile,
      runId: input.runId,
      profileState: accessState.profileState,
      browserState: browserStateFromProfileState(accessState.profileState, accessState.lockHeld),
      profileDir,
      proxyUrl: meta?.proxyBinding?.url ?? null,
      lockHeld: accessState.lockHeld,
      identityBindingState: readiness.identityBindingState,
      transportState: readiness.transportState,
      bootstrapState: readiness.bootstrapState,
      runtimeReadiness: readiness.runtimeReadiness,
      identityPreflight: buildIdentityPreflightOutput(identityPreflight),
      lockOwnerPid: lock?.ownerPid ?? null,
      headless: activeBrowserInstanceState?.headless ?? null,
      executionSurface: activeBrowserInstanceState?.executionSurface ?? null,
      runtimeTakeoverEvidence,
      recoverableSession: buildRecoverableSessionSummary(meta),
      account_safety: toAccountSafetyStatus(meta?.accountSafety),
      xhs_closeout_rhythm: toXhsCloseoutRhythmStatus({
        rhythm: meta?.xhsCloseoutRhythm,
        accountSafety: meta?.accountSafety
      }),
      fingerprint_runtime: fingerprintRuntime,
      updatedAt: meta?.updatedAt ?? null
    };
  }

  async attach(input: RuntimeActionInput): Promise<JsonObject> {
    const nowIso = isoNow();
    const store = this.#createStore(input.cwd);
    const profileDir = this.#resolveProfileDir(store, input.profile);
    const lockPath = this.#getLockPath(profileDir);
    const meta = await this.#readMeta(store, input.profile, {
      mode: readFingerprintMetaMode(input.params) ?? "readonly"
    });
    const storedProfileState: ProfileState = meta?.profileState ?? "uninitialized";
    const activeState =
      isRuntimeActiveProfileState(storedProfileState) || storedProfileState === "disconnected";
    if (!activeState) {
      throw new CliError(
        "ERR_PROFILE_STATE_CONFLICT",
        `profile 当前状态 ${storedProfileState} 不能接管 live runtime`,
        { retryable: true }
      );
    }

    const persistedLock = await this.#readLock(lockPath);
    const browserInstanceState = await this.#readBrowserInstanceState(profileDir);
    const lock =
      persistedLock ??
      (hasCompleteStaleBootstrapRecoveryTarget(input.params)
        ? this.#buildLocklessActiveRuntimeLock({
            profile: input.profile,
            lockPath,
            state: browserInstanceState,
            nowIso
          })
        : null);
    const lockRecoveredFromBrowserState = persistedLock === null && lock !== null;
    if (!lock) {
      throw new CliError("ERR_PROFILE_LOCKED", "profile 当前未持有可接管的 live runtime", {
        retryable: true
      });
    }

    const lockInspection = await this.#inspectProfileLock(lock, profileDir);
    const accessState = resolveProfileAccessState({
      storedProfileState,
      lockOwnerRunId: lock.ownerRunId,
      lockInspection,
      runtimeRunId: input.runId
    });
    const pinnedControllerPid =
      typeof lock.controllerPid === "number"
        ? lock.controllerPid
        : lock.ownerPid;

    const identityPreflight = await runIdentityPreflight({
      params: input.params,
      meta,
      profileDir
    });
    if (shouldBlockSessionEntryOnIdentityPreflight(identityPreflight)) {
      throw buildIdentityPreflightError(identityPreflight);
    }
    if (
      identityPreflight.mode !== "official_chrome_persistent_extension" ||
      identityPreflight.identityBindingState !== "bound"
    ) {
      throw new CliError("ERR_RUNTIME_UNAVAILABLE", "official Chrome runtime identity 未就绪，无法接管", {
        retryable: true
      });
    }

    const requestedExecutionMode = readRequestedExecutionMode(input.params);
    const fingerprintRuntime = buildFingerprintContextForMeta(input.profile, meta, {
      requestedExecutionMode
    });
    ensureFingerprintExecutionAllowed(requestedExecutionMode, fingerprintRuntime);
    const observedReadyAttachReadiness = await this.#readObservedRuntimeReadiness({
      runtimeInput: input,
      lockHeld: false,
      observedRunId: accessState.observedRunId,
      identityPreflight,
      profileState: accessState.profileState
    });
    const observedTargetReadiness =
      hasCompleteRuntimeTargetBinding(input.params)
        ? await this.#readObservedRuntimeReadiness({
            runtimeInput: input,
            lockHeld: false,
            observedRunId: accessState.observedRunId,
            identityPreflight,
            profileState: accessState.profileState,
            includeTargetBinding: true
          })
        : null;
    const preAttachReadiness = await this.#readRuntimeReadiness({
      runtimeInput: input,
      lockHeld: false,
      observedRunId: accessState.observedRunId,
      identityPreflight,
      profileState: accessState.profileState
    });
    const attachableReadyRuntime = canAttachReadyRuntime({
      healthyLock: lockRecoveredFromBrowserState ? false : accessState.healthyLock,
      profileState: accessState.profileState,
      pinnedControllerPid,
      readiness: observedReadyAttachReadiness ?? preAttachReadiness
    });
    const attachableStaleBootstrapRuntime = canAttachStaleBootstrapRuntime({
      profile: input.profile,
      healthyLock: accessState.healthyLock,
      controlConnected: accessState.controlConnected,
      profileState: accessState.profileState,
      pinnedControllerPid,
      readiness: observedTargetReadiness,
      observedRunId: accessState.observedRunId,
      targetBindingComplete: hasCompleteRuntimeTargetBinding(input.params),
      targetTabId: input.params.target_tab_id,
      targetDomain: input.params.target_domain,
      targetPage: input.params.target_page,
      requestedAt: input.params.requested_at
    });
    const attachablePendingBootstrapRuntime = canAttachPendingBootstrapRuntime({
      healthyLock: accessState.healthyLock,
      controlConnected: accessState.controlConnected,
      profileState: accessState.profileState,
      pinnedControllerPid,
      readiness: observedTargetReadiness,
      targetBindingComplete: hasCompleteRuntimeTargetBinding(input.params),
      targetTabId: input.params.target_tab_id,
      targetDomain: input.params.target_domain,
      targetPage: input.params.target_page
    });
    const attachableRecoverableRuntime =
      !lockRecoveredFromBrowserState &&
      (storedProfileState === "ready" || storedProfileState === "disconnected") &&
      lockInspection.orphanRecoverable &&
      preAttachReadiness.bootstrapState !== "stale" &&
      preAttachReadiness.transportState !== "not_connected" &&
      preAttachReadiness.runtimeReadiness === "recoverable";
    const evidenceReadiness =
      (attachableStaleBootstrapRuntime || attachablePendingBootstrapRuntime) &&
      observedTargetReadiness !== null
        ? observedTargetReadiness
        : attachableReadyRuntime && observedReadyAttachReadiness !== null
          ? observedReadyAttachReadiness
          : preAttachReadiness;
    const runtimeTakeoverEvidence = buildRuntimeTakeoverEvidence({
      profile: input.profile,
      lockHeld: false,
      healthyLock: accessState.healthyLock,
      controlConnected: accessState.controlConnected,
      observedRunId: accessState.observedRunId,
      requestRunId: input.runId,
      requestRuntimeContextId: buildRuntimeBootstrapContextId(input.profile, input.runId),
      requestedTargetTabId: input.params.target_tab_id,
      requestedTargetDomain: input.params.target_domain,
      requestedTargetPage: input.params.target_page,
      readiness: evidenceReadiness,
      attachableReadyRuntime,
      pendingBootstrapRecoverable: attachablePendingBootstrapRuntime,
      orphanRecoverable: attachableRecoverableRuntime,
      staleBootstrapRecoverable: attachableStaleBootstrapRuntime,
      pinnedControllerPid,
      browserPid: lockInspection.browserPid,
      stateRunId: lockInspection.stateRunId
    });
    if (
      !runtimeTakeoverEvidence.attachableReadyRuntime &&
      !runtimeTakeoverEvidence.pendingBootstrapRecoverable &&
      !runtimeTakeoverEvidence.orphanRecoverable &&
      !runtimeTakeoverEvidence.staleBootstrapRecoverable
    ) {
      throw new CliError("ERR_PROFILE_LOCKED", "profile 当前不存在可安全接管的 ready runtime", {
        retryable: true
      });
    }

    const takeoverMode = runtimeTakeoverEvidence.mode;
    const nextOwnerPid = takeoverMode === "recoverable_rebind" ? process.pid : lock.ownerPid;
    let attachedLock = lock;
    if (
      lock.ownerRunId !== input.runId ||
      (takeoverMode === "recoverable_rebind" && lock.ownerPid !== nextOwnerPid)
    ) {
      attachedLock = await this.#rebindActiveRuntimeOwnership({
        profileDir,
        lockPath,
        lock,
        nextRunId: input.runId,
        nextOwnerPid,
        orphanRecoverable: takeoverMode === "recoverable_rebind",
        nowIso
      });
    }
    await this.#ensureProfileScopedNativeHostManifest({
      preflight: identityPreflight,
      profileDir
    });

    let attachedProfileState: ProfileState = accessState.profileState;
    let nextMeta = meta;
    if (attachableRecoverableRuntime && meta && meta.profileState !== attachedProfileState) {
      nextMeta = this.#patchMeta(meta, {
        profileName: input.profile,
        profileDir,
        profileState: attachedProfileState,
        proxyBinding: meta.proxyBinding,
        persistentExtensionBinding: meta.persistentExtensionBinding ?? null,
        fingerprintProfileBundle: meta.fingerprintProfileBundle ?? null,
        updatedAt: nowIso,
        lastDisconnectedAt: meta.lastDisconnectedAt ?? nowIso
      });
      await store.writeMeta(input.profile, nextMeta);
    }
    const refreshTargetBootstrapOnAttach =
      (takeoverMode === "ready_attach" || takeoverMode === "pending_bootstrap_attach") &&
      hasCompleteRuntimeTargetBinding(input.params);
    const readiness =
      (takeoverMode === "stale_bootstrap_rebind" || refreshTargetBootstrapOnAttach) &&
      identityPreflight.identityBindingState === "bound"
        ? await this.#deliverRuntimeBootstrap({
            runtimeInput: input,
            profile: input.profile,
            fingerprintRuntime,
            identityPreflight
          })
        : await this.#readRuntimeReadiness({
            runtimeInput: input,
            lockHeld: true,
            identityPreflight,
            profileState: attachedProfileState
          });
    if (
      attachableRecoverableRuntime &&
      readiness.runtimeReadiness === "ready" &&
      readiness.transportState === "ready" &&
      readiness.bootstrapState === "ready"
    ) {
      attachedProfileState = "ready";
      if (nextMeta) {
        nextMeta = this.#patchMeta(nextMeta, {
          profileName: input.profile,
          profileDir,
          profileState: attachedProfileState,
          proxyBinding: nextMeta.proxyBinding,
          persistentExtensionBinding: nextMeta.persistentExtensionBinding ?? null,
          fingerprintProfileBundle: nextMeta.fingerprintProfileBundle ?? null,
          updatedAt: nowIso,
          lastDisconnectedAt: nextMeta.lastDisconnectedAt ?? nowIso
        });
        await store.writeMeta(input.profile, nextMeta);
      }
    }

    return {
      profile: input.profile,
      profileState: attachedProfileState,
      browserState: browserStateFromProfileState(attachedProfileState, true),
      profileDir,
      proxyUrl: meta?.proxyBinding?.url ?? null,
      lockHeld: true,
      identityBindingState: readiness.identityBindingState,
      transportState: readiness.transportState,
      bootstrapState: readiness.bootstrapState,
      runtimeReadiness: readiness.runtimeReadiness,
      identityPreflight: buildIdentityPreflightOutput(identityPreflight),
      lockOwnerPid: attachedLock.ownerPid,
      recoverableSession: buildRecoverableSessionSummary(nextMeta),
      fingerprint_runtime: fingerprintRuntime,
      updatedAt: nextMeta?.updatedAt ?? null
    };
  }

  async markAccountSafetyBlocked(input: MarkAccountSafetyBlockedInput): Promise<JsonObject> {
    const observedAt = isoNow();
    const store = this.#createStore(input.cwd);
    const profileDir = this.#resolveProfileDir(store, input.profile);
    await store.ensureProfileDir(input.profile);
    const existingMeta =
      await this.#readMeta(store, input.profile, { mode: "readonly" }) ??
      this.#buildMinimalProfileMeta({
        profile: input.profile,
        profileDir,
        nowIso: observedAt
      });
    const accountSafety = buildBlockedAccountSafetyRecord({
      reason: input.signal.reason,
      observedAt,
      sourceRunId: input.runId,
      sourceCommand: input.signal.sourceCommand,
      targetDomain: input.signal.targetDomain,
      targetTabId: input.signal.targetTabId,
      pageUrl: input.signal.pageUrl,
      statusCode: input.signal.statusCode,
      platformCode: input.signal.platformCode
    });
    const nextMeta: ProfileMeta = {
      ...existingMeta,
      profileName: input.profile,
      profileDir,
      accountSafety,
      xhsCloseoutRhythm: buildBlockedXhsCloseoutRhythmRecord({
        cooldownUntil: accountSafety.cooldownUntil,
        reasonCode: input.signal.reason
      }),
      updatedAt: observedAt
    };
    await store.writeMeta(input.profile, nextMeta);

    let stopAttempt: JsonObject = {
      attempted: true,
      outcome: "skipped"
    };
    try {
      const stopResult = await this.stop({
        cwd: input.cwd,
        profile: input.profile,
        runId: input.runId,
        params: {}
      });
      stopAttempt = {
        attempted: true,
        outcome: "stopped",
        profile_state: stopResult.profileState ?? null
      };
    } catch (error) {
      stopAttempt = {
        attempted: true,
        outcome: "failed",
        error_code: error instanceof CliError ? error.code : "ERR_RUNTIME_STOP_FAILED",
        message: error instanceof Error ? error.message : String(error)
      };
    }

    return {
      profile: input.profile,
      account_safety: toAccountSafetyStatus(accountSafety),
      xhs_closeout_rhythm: toXhsCloseoutRhythmStatus({
        rhythm: nextMeta.xhsCloseoutRhythm,
        accountSafety
      }),
      runtime_stop: stopAttempt
    };
  }

  async markXhsCloseoutSingleProbePassed(
    input: MarkXhsCloseoutSingleProbePassedInput
  ): Promise<JsonObject> {
    const passedAt = isoNow();
    const store = this.#createStore(input.cwd);
    const profileDir = this.#resolveProfileDir(store, input.profile);
    await store.ensureProfileDir(input.profile);
    const existingMeta =
      await this.#readMeta(store, input.profile, { mode: "readonly" }) ??
      this.#buildMinimalProfileMeta({
        profile: input.profile,
        profileDir,
        nowIso: passedAt
      });
    const xhsCloseoutRhythm = markXhsCloseoutSingleProbePassed({
      current: existingMeta.xhsCloseoutRhythm,
      passedAt,
      probeRunId: input.runId
    });
    const nextMeta: ProfileMeta = {
      ...existingMeta,
      profileName: input.profile,
      profileDir,
      xhsCloseoutRhythm,
      updatedAt: passedAt
    };
    await store.writeMeta(input.profile, nextMeta);

    return {
      profile: input.profile,
      xhs_closeout_rhythm: toXhsCloseoutRhythmStatus({
        rhythm: xhsCloseoutRhythm,
        accountSafety: nextMeta.accountSafety
      })
    };
  }

  async markXhsCloseoutSingleProbeFailed(
    input: MarkXhsCloseoutSingleProbeFailedInput
  ): Promise<JsonObject> {
    const failedAt = isoNow();
    const store = this.#createStore(input.cwd);
    const profileDir = this.#resolveProfileDir(store, input.profile);
    await store.ensureProfileDir(input.profile);
    const existingMeta =
      await this.#readMeta(store, input.profile, { mode: "readonly" }) ??
      this.#buildMinimalProfileMeta({
        profile: input.profile,
        profileDir,
        nowIso: failedAt
      });
    const xhsCloseoutRhythm = markXhsCloseoutSingleProbeFailed({
      current: existingMeta.xhsCloseoutRhythm,
      failedAt,
      probeRunId: input.runId,
      reasonCode: input.reasonCode
    });
    const nextMeta: ProfileMeta = {
      ...existingMeta,
      profileName: input.profile,
      profileDir,
      xhsCloseoutRhythm,
      updatedAt: failedAt
    };
    await store.writeMeta(input.profile, nextMeta);

    return {
      profile: input.profile,
      account_safety_record: nextMeta.accountSafety as unknown as JsonObject,
      xhs_closeout_rhythm_record: xhsCloseoutRhythm as unknown as JsonObject,
      xhs_closeout_rhythm: toXhsCloseoutRhythmStatus({
        rhythm: xhsCloseoutRhythm,
        accountSafety: nextMeta.accountSafety
      })
    };
  }

  async claimXhsCloseoutSingleProbe(input: ClaimXhsCloseoutSingleProbeInput): Promise<JsonObject> {
    const claimedAt = isoNow();
    const store = this.#createStore(input.cwd);
    const profileDir = this.#resolveProfileDir(store, input.profile);
    await store.ensureProfileDir(input.profile);
    const claimLockPath = join(profileDir, "__webenvoy_xhs_probe_claim.lock");
    try {
      await writeFile(claimLockPath, `${input.runId}\n`, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "EEXIST") {
        throw new CliError(
          "ERR_EXECUTION_FAILED",
          "XHS recovery single-probe budget is already being claimed",
          {
            retryable: false,
            details: {
              ability_id: "xhs.note.search.v1",
              stage: "execution",
              reason: "XHS_CLOSEOUT_RHYTHM_BLOCKED"
            }
          }
        );
      }
      throw error;
    }
    try {
      const existingMeta =
        await this.#readMeta(store, input.profile, { mode: "readonly" }) ??
        this.#buildMinimalProfileMeta({
          profile: input.profile,
          profileDir,
          nowIso: claimedAt
        });
      const currentStatus = toXhsCloseoutRhythmStatus({
        rhythm: existingMeta.xhsCloseoutRhythm,
        accountSafety: existingMeta.accountSafety
      });
      if (
        existingMeta.accountSafety?.state === "account_risk_blocked" ||
        currentStatus.state !== "single_probe_required" ||
        currentStatus.probe_run_id !== null
      ) {
        throw new CliError(
          "ERR_EXECUTION_FAILED",
          "XHS recovery single-probe budget is not available",
          {
            retryable: false,
            details: {
              ability_id: "xhs.note.search.v1",
              stage: "execution",
              reason:
                existingMeta.accountSafety?.state === "account_risk_blocked"
                  ? "ACCOUNT_RISK_BLOCKED"
                  : "XHS_CLOSEOUT_RHYTHM_BLOCKED",
              account_safety: toAccountSafetyStatus(existingMeta.accountSafety),
              xhs_closeout_rhythm: currentStatus
            }
          }
        );
      }
      const xhsCloseoutRhythm = claimXhsCloseoutSingleProbe({
        current: existingMeta.xhsCloseoutRhythm,
        probeRunId: input.runId
      });
      const nextMeta: ProfileMeta = {
        ...existingMeta,
        profileName: input.profile,
        profileDir,
        xhsCloseoutRhythm,
        updatedAt: claimedAt
      };
      await store.writeMeta(input.profile, nextMeta);

      return {
        profile: input.profile,
        xhs_closeout_rhythm: toXhsCloseoutRhythmStatus({
          rhythm: xhsCloseoutRhythm,
          accountSafety: nextMeta.accountSafety
        })
      };
    } finally {
      await unlink(claimLockPath).catch(() => undefined);
    }
  }

  async stop(input: RuntimeActionInput): Promise<JsonObject> {
    const nowIso = isoNow();
    const store = this.#createStore(input.cwd);
    const profileDir = this.#resolveProfileDir(store, input.profile);
    const lockPath = this.#getLockPath(profileDir);
    const existingMeta = await this.#readMeta(store, input.profile);
    const lock = await this.#readLock(lockPath);

    if (!existingMeta || !lock) {
      throw new CliError("ERR_PROFILE_STATE_CONFLICT", "profile 当前未持锁或未启动");
    }

    const lockInspection = await this.#inspectProfileLock(lock, profileDir);
    const orphanRecovered =
      lock.ownerRunId !== input.runId && lockInspection.orphanRecoverable;
    const stopOwnerRunId = orphanRecovered ? lock.ownerRunId : input.runId;

    if (lock.ownerRunId !== input.runId && !orphanRecovered) {
      throw new CliError(
        "ERR_PROFILE_OWNER_CONFLICT",
        "runtime.stop run_id 与 profile 锁所有者不一致",
        { retryable: false }
      );
    }

    let session = buildRuntimeSession(input.profile, existingMeta);
    session = {
      ...session,
      ownerRunId: stopOwnerRunId
    };
    const requestedExecutionMode = readRequestedExecutionMode(input.params);
    const fingerprintRuntime = buildFingerprintContextForMeta(input.profile, existingMeta, {
      requestedExecutionMode
    });

    try {
      const stopping = beginStopSession(session, {
        runId: stopOwnerRunId,
        nowIso
      });
      session = markSessionStopped(stopping);
    } catch (error) {
      throw mapRuntimeError(error);
    }

    const previousMeta = existingMeta;
    try {
      const browserState = await this.#readBrowserInstanceState(profileDir);
      const pinnedControllerPid =
        typeof lock.controllerPid === "number"
          ? lock.controllerPid
          : lock.ownerPid;
      const stalePinnedController = lock.controllerPidState === "stale";
      if (
        browserState &&
        (browserState.runId !== stopOwnerRunId ||
          browserState.controllerPid !== pinnedControllerPid)
      ) {
        throw new CliError("ERR_RUNTIME_UNAVAILABLE", "浏览器实例状态与当前锁所有者不一致，无法安全停止 live runtime", {
          retryable: true
        });
      }
      const shutdownControllerPid =
        !stalePinnedController
          ? pinnedControllerPid
          : browserState?.controllerPid ?? null;
      const controllerAlive =
        typeof shutdownControllerPid === "number" && this.#isProcessAlive(shutdownControllerPid);
      const browserPidAlive =
        browserState &&
        browserState.runId === stopOwnerRunId &&
        this.#isProcessAlive(browserState.browserPid);
      const browserOwnedByWebEnvoy =
        browserState?.processOwnership !== "external_persistent_app";
      if (
        stalePinnedController &&
        browserState &&
        browserPidAlive &&
        browserOwnedByWebEnvoy
      ) {
        await this.#terminateProcess(browserState.browserPid);
        await this.#deleteBrowserStateFiles(profileDir);
      } else if (
        !controllerAlive &&
        browserState &&
        browserPidAlive &&
        browserOwnedByWebEnvoy
      ) {
        await this.#terminateProcess(browserState.browserPid);
        await this.#deleteBrowserStateFiles(profileDir);
      } else if (
        browserState &&
        browserPidAlive &&
        !browserOwnedByWebEnvoy &&
        (stalePinnedController || !controllerAlive)
      ) {
        await this.#terminateProcess(browserState.browserPid);
        await this.#deleteBrowserStateFiles(profileDir);
      } else if (stalePinnedController && controllerAlive) {
        throw new CliError("ERR_RUNTIME_UNAVAILABLE", "缺少锁定的浏览器控制者，无法安全停止 live runtime", {
          retryable: true
        });
      } else if (typeof shutdownControllerPid === "number") {
        await this.#browserLauncher.shutdown({
          profileDir,
          controllerPid: shutdownControllerPid,
          runId: stopOwnerRunId
        });
        if (browserState && this.#isProcessAlive(browserState.browserPid)) {
          await this.#terminateProcess(browserState.browserPid);
        }
      } else {
        throw new CliError("ERR_RUNTIME_UNAVAILABLE", "缺少可验证的浏览器控制者，无法安全停止 live runtime", {
          retryable: true
        });
      }
      await store.writeMeta(
        input.profile,
        this.#patchMeta(existingMeta, {
          profileName: input.profile,
          profileDir,
          profileState: session.profileState,
          proxyBinding: session.proxyBinding,
          fingerprintProfileBundle: shouldPersistFingerprintBundle(existingMeta, fingerprintRuntime),
          updatedAt: nowIso,
          lastStoppedAt: nowIso
        })
      );
      await this.#deleteLockWithRetry(lockPath);
    } catch (error) {
      try {
        await store.writeMeta(input.profile, previousMeta);
      } catch (rollbackError) {
        throw new CliError("ERR_RUNTIME_UNAVAILABLE", "runtime.stop 回滚失败，profile 状态可能不一致", {
          retryable: true,
          cause: rollbackError
        });
      }
      throw mapRuntimeError(error);
    }

    return {
      profile: input.profile,
      profileState: session.profileState,
      browserState: "absent",
      profileDir,
      proxyUrl: session.proxyBinding?.url ?? null,
      lockHeld: false,
      orphanRecovered,
      recoverableSession: buildRecoverableSessionSummary(existingMeta),
      fingerprint_runtime: fingerprintRuntime,
      stoppedAt: nowIso
    };
  }

  #createStore(cwd: string): ProfileStoreLike {
    return this.#storeFactory(cwd);
  }

  #resolveProfileDir(store: ProfileStoreLike, profile: string): string {
    try {
      return store.getProfileDir(profile);
    } catch (error) {
      throw mapRuntimeError(error);
    }
  }

  #getLockPath(profileDir: string): string {
    return join(profileDir, PROFILE_LOCK_FILENAME);
  }

  async #readMeta(
    store: ProfileStoreLike,
    profile: string,
    options?: ReadMetaOptions
  ): Promise<ProfileMeta | null> {
    try {
      return await store.readMeta(profile, options);
    } catch {
      throw new CliError("ERR_PROFILE_META_CORRUPT", "profile 元数据损坏");
    }
  }

  async #readOrInitializeMeta(
    store: ProfileStoreLike,
    profile: string,
    nowIso: string,
    mode?: ReadMetaMode
  ): Promise<ProfileMeta> {
    const meta = await this.#readMeta(store, profile, mode ? { mode } : undefined);
    if (meta) {
      return meta;
    }
    return store.initializeMeta(profile, nowIso);
  }

  async #readLock(lockPath: string): Promise<ProfileLock | null> {
    try {
      const raw = await this.#lockFileAdapter.readFile(lockPath, "utf8");
      return JSON.parse(raw) as ProfileLock;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return null;
      }
      throw new CliError("ERR_PROFILE_META_CORRUPT", "profile 锁文件损坏");
    }
  }

  async #writeLock(lockPath: string, lock: ProfileLock): Promise<void> {
    await this.#lockFileAdapter.writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  }

  async #updateLockOwnerPid(
    lockPath: string,
    runId: string,
    input: {
      ownerPid: number;
      controllerPid: number;
      nowIso: string;
    }
  ): Promise<void> {
    const existing = await this.#readLock(lockPath);
    if (!existing) {
      throw new CliError("ERR_PROFILE_LOCKED", "profile 当前被其他运行占用", {
        retryable: true
      });
    }
    if (existing.ownerRunId !== runId) {
      throw new CliError("ERR_PROFILE_LOCKED", "profile 当前被其他运行占用", {
        retryable: true
      });
    }
    const updated: ProfileLock = {
      ...existing,
      ownerPid: input.ownerPid,
      controllerPid: input.controllerPid,
      controllerPidState: "live",
      lastHeartbeatAt: input.nowIso
    };
    await this.#writeLock(lockPath, updated);
  }

  async #rollbackLockOnStartFailure(lockPath: string, runId: string): Promise<void> {
    const lock = await this.#readLock(lockPath);
    if (!lock) {
      return;
    }
    if (lock.ownerRunId !== runId) {
      return;
    }
    await this.#deleteLock(lockPath);
  }

  async #cleanupLaunchedBrowserOnStartFailure(input: {
    profileDir: string;
    controllerPid: number | null;
    runId: string;
  }): Promise<void> {
    if (!Number.isInteger(input.controllerPid) || input.controllerPid === null) {
      return;
    }
    const browserState = await this.#readBrowserInstanceState(input.profileDir);
    try {
      await this.#browserLauncher.shutdown({
        profileDir: input.profileDir,
        controllerPid: input.controllerPid,
        runId: input.runId
      });
    } catch {
      await this.#terminateProcess(input.controllerPid);
    }
    if (
      browserState &&
      browserState.runId === input.runId &&
      this.#isProcessAlive(browserState.browserPid)
    ) {
      await this.#terminateProcess(browserState.browserPid);
      await this.#deleteBrowserStateFiles(input.profileDir);
    }
  }

  async #terminateProcess(pid: number | null): Promise<void> {
    if (!Number.isInteger(pid) || pid === null || pid <= 0) {
      return;
    }
    try {
      process.kill(pid, "SIGTERM");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ESRCH") {
        return;
      }
      throw error;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!this.#isProcessAlive(pid)) {
        return;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 80);
      });
    }

    if (!this.#isProcessAlive(pid)) {
      return;
    }

    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ESRCH") {
        throw error;
      }
    }
  }

  async #acquireProfileLockAtomically(input: {
    profileName: string;
    profileDir: string;
    lockPath: string;
    runId: string;
    nowIso: string;
    allowDeadOwnerRecoveryForSameRun?: boolean;
  }): Promise<{ lock: ProfileLock; acquisition: LockAcquisition }> {

    for (let attempt = 0; attempt < LOCK_ACQUIRE_MAX_RETRIES; attempt += 1) {
      const nextRequest = {
        profileName: input.profileName,
        lockPath: input.lockPath,
        ownerPid: process.pid,
        ownerRunId: input.runId,
        nowIso: input.nowIso
      };
      const nextLock = createProfileLock(nextRequest);

      try {
        await this.#lockFileAdapter.writeFile(input.lockPath, `${JSON.stringify(nextLock, null, 2)}\n`, {
          encoding: "utf8",
          flag: "wx"
        });
        return { lock: nextLock, acquisition: "new" };
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== "EEXIST") {
          throw error;
        }
      }

      const existingLock = await this.#readLock(input.lockPath);
      if (!existingLock) {
        continue;
      }

      if (existingLock.ownerRunId === input.runId) {
        const inspection = await this.#inspectProfileLock(existingLock, input.profileDir);
        if (!inspection.blocksReuse && input.allowDeadOwnerRecoveryForSameRun === false) {
          return { lock: existingLock, acquisition: "same-owner-dead" };
        }
        const ownerPid = inspection.blocksReuse ? existingLock.ownerPid : process.pid;
        const updatedLock: ProfileLock = {
          ...existingLock,
          ownerPid,
          controllerPid:
            typeof existingLock.controllerPid === "number"
              ? existingLock.controllerPid
              : existingLock.ownerPid,
          controllerPidState: existingLock.controllerPidState ?? "live",
          lastHeartbeatAt: input.nowIso
        };
        await this.#writeLock(input.lockPath, updatedLock);
        return { lock: updatedLock, acquisition: "same-owner" };
      }

      if ((await this.#inspectProfileLock(existingLock, input.profileDir)).blocksReuse) {
        throw new CliError("ERR_PROFILE_LOCKED", "profile 当前被其他运行占用", {
          retryable: true
        });
      }

      await this.#deleteLock(input.lockPath);
      try {
        await this.#lockFileAdapter.writeFile(
          input.lockPath,
          `${JSON.stringify(nextLock, null, 2)}\n`,
          {
            encoding: "utf8",
            flag: "wx"
          }
        );
        return { lock: nextLock, acquisition: "reclaimed" };
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== "EEXIST") {
          throw error;
        }
      }
    }

    throw new CliError("ERR_PROFILE_LOCKED", "profile 当前被其他运行占用", {
      retryable: true
    });
  }

  async #deleteLock(lockPath: string): Promise<void> {
    try {
      await this.#lockFileAdapter.unlink(lockPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  async #deleteLockWithRetry(lockPath: string): Promise<void> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < STOP_LOCK_DELETE_MAX_RETRIES; attempt += 1) {
      try {
        await this.#deleteLock(lockPath);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async #readBrowserInstanceState(profileDir: string): Promise<BrowserInstanceStateSnapshot | null> {
    return readBrowserInstanceState({
      profileDir,
      fileReader: this.#lockFileAdapter
    });
  }

  #buildLocklessActiveRuntimeLock(input: {
    profile: string;
    lockPath: string;
    state: BrowserInstanceStateSnapshot | null;
    nowIso: string;
  }): ProfileLock | null {
    return buildLocklessActiveRuntimeLock({
      ...input,
      isProcessAlive: this.#isProcessAlive
    });
  }

  async #rebindActiveRuntimeOwnership(input: {
    profileDir: string;
    lockPath: string;
    lock: ProfileLock;
    nextRunId: string;
    nextOwnerPid: number;
    orphanRecoverable: boolean;
    nowIso: string;
  }): Promise<ProfileLock> {
    const statePath = join(input.profileDir, BROWSER_STATE_FILENAME);
    let stateRaw: string;
    try {
      stateRaw = await this.#lockFileAdapter.readFile(statePath, "utf8");
    } catch {
      throw new CliError("ERR_RUNTIME_UNAVAILABLE", "浏览器实例状态缺失，无法安全接管 live runtime", {
        retryable: true
      });
    }
    const parsedState = parseBrowserInstanceState(stateRaw);
    const pinnedControllerPid =
      typeof input.lock.controllerPid === "number"
        ? input.lock.controllerPid
        : input.lock.ownerPid;
    if (
      parsedState === null ||
      parsedState.runId !== input.lock.ownerRunId ||
      parsedState.controllerPid !== pinnedControllerPid
    ) {
      throw new CliError("ERR_RUNTIME_UNAVAILABLE", "浏览器实例状态与当前锁所有者不一致，无法安全接管", {
        retryable: true
      });
    }

    const nextState = {
      ...parsedState,
      runId: input.nextRunId
    };
    const nextLock: ProfileLock = {
      ...input.lock,
      ownerPid: input.nextOwnerPid,
      ownerRunId: input.nextRunId,
      lastHeartbeatAt: input.nowIso
    };
    if (!input.orphanRecoverable) {
      nextLock.controllerPid = parsedState.controllerPid;
      nextLock.controllerPidState = "live";
    } else {
      nextLock.controllerPid = parsedState.controllerPid;
      nextLock.controllerPidState = "stale";
    }

    await this.#lockFileAdapter.writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
    try {
      await this.#writeLock(input.lockPath, nextLock);
    } catch (error) {
      await this.#lockFileAdapter.writeFile(statePath, stateRaw, "utf8").catch(() => undefined);
      throw error;
    }
    return nextLock;
  }

  async #inspectProfileLock(lock: ProfileLock, profileDir: string): Promise<ProfileLockInspection> {
    return inspectProfileLock({
      lock,
      browserInstanceState: await this.#readBrowserInstanceState(profileDir),
      isProcessAlive: this.#isProcessAlive
    });
  }

  async #deleteBrowserStateFiles(profileDir: string): Promise<void> {
    const statePath = join(profileDir, BROWSER_STATE_FILENAME);
    const controlPath = join(profileDir, BROWSER_CONTROL_FILENAME);
    try {
      await this.#lockFileAdapter.unlink(statePath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }
    try {
      await this.#lockFileAdapter.unlink(controlPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  #patchMeta(
    current: ProfileMeta,
    patch: {
      profileName: string;
      profileDir: string;
      profileState: ProfileState;
      proxyBinding: ProfileMeta["proxyBinding"];
      persistentExtensionBinding?: PersistentExtensionBinding | null;
      fingerprintProfileBundle?: ProfileMeta["fingerprintProfileBundle"] | null;
      updatedAt: string;
      localStorageSnapshots?: ProfileMeta["localStorageSnapshots"];
      lastStartedAt?: string;
      lastLoginAt?: string;
      lastStoppedAt?: string;
      lastDisconnectedAt?: string;
    }
  ): ProfileMeta {
    return {
      ...current,
      profileName: patch.profileName,
      profileDir: patch.profileDir,
      profileState: patch.profileState,
      proxyBinding: patch.proxyBinding,
      persistentExtensionBinding:
        patch.persistentExtensionBinding === null
          ? undefined
          : patch.persistentExtensionBinding ?? current.persistentExtensionBinding,
      fingerprintProfileBundle:
        patch.fingerprintProfileBundle === null
          ? undefined
          : patch.fingerprintProfileBundle ?? current.fingerprintProfileBundle,
      localStorageSnapshots: patch.localStorageSnapshots ?? current.localStorageSnapshots,
      updatedAt: patch.updatedAt,
      lastStartedAt: patch.lastStartedAt ?? current.lastStartedAt,
      lastLoginAt: patch.lastLoginAt ?? current.lastLoginAt,
      lastStoppedAt: patch.lastStoppedAt ?? current.lastStoppedAt,
      lastDisconnectedAt: patch.lastDisconnectedAt ?? current.lastDisconnectedAt
    };
  }

  async #deliverRuntimeBootstrap(input: {
    runtimeInput: RuntimeActionInput;
    profile: string;
    fingerprintRuntime: ReturnType<typeof buildFingerprintContextForMeta>;
    identityPreflight: IdentityPreflightResult;
  }): Promise<RuntimeReadinessSnapshot> {
    const bridge = this.#bridgeFactory({
      waitForProfileSocketOnOpen: requiresPersistentBootstrapSocketAdmission({
        params: input.runtimeInput.params,
        identityPreflight: input.identityPreflight
      })
    });
    const envelope = buildRuntimeBootstrapEnvelope({
      profile: input.profile,
      runId: input.runtimeInput.runId,
      runtimeContextId: buildRuntimeBootstrapContextId(input.profile, input.runtimeInput.runId),
      fingerprintRuntime: input.fingerprintRuntime,
      mainWorldSecret: randomUUID(),
      ...(typeof input.runtimeInput.params.requested_at === "string"
        ? { requestedAt: input.runtimeInput.params.requested_at }
        : {}),
      ...(typeof input.runtimeInput.params.target_domain === "string"
        ? { targetDomain: input.runtimeInput.params.target_domain }
        : {}),
      ...(typeof input.runtimeInput.params.target_tab_id === "number"
        ? { targetTabId: input.runtimeInput.params.target_tab_id }
        : {}),
      ...(typeof input.runtimeInput.params.target_page === "string"
        ? { targetPage: input.runtimeInput.params.target_page }
        : {}),
      ...(typeof input.runtimeInput.params.target_resource_id === "string"
        ? { targetResourceId: input.runtimeInput.params.target_resource_id }
        : {}),
      ...buildForwardTimeoutParams(input.runtimeInput.params)
    });

    try {
      const result = await bridge.runCommand({
        runId: input.runtimeInput.runId,
        profile: input.profile,
        cwd: input.runtimeInput.cwd,
        command: "runtime.bootstrap",
        params: envelope as unknown as JsonObject
      });
      if (!result.ok) {
        throw this.#buildRuntimeBootstrapCliError(result);
      }
      const payload = asResultRecord(result.payload);
      const ackResult = asResultRecord(payload?.result);
      const ackVersion = typeof ackResult?.version === "string" ? ackResult.version : null;
      const status = typeof ackResult?.status === "string" ? ackResult.status : null;
      const ackRunId = typeof ackResult?.run_id === "string" ? ackResult.run_id : null;
      const ackContextId =
        typeof ackResult?.runtime_context_id === "string" ? ackResult.runtime_context_id : null;
      const ackProfile = typeof ackResult?.profile === "string" ? ackResult.profile : null;
      if (
        status !== "ready" ||
        ackVersion !== envelope.version ||
        ackRunId !== envelope.run_id ||
        ackContextId !== envelope.runtime_context_id ||
        ackProfile !== envelope.profile
      ) {
        throw new CliError(
          status === "stale"
            ? "ERR_RUNTIME_BOOTSTRAP_ACK_STALE"
            : "ERR_RUNTIME_READY_SIGNAL_CONFLICT",
          status === "stale"
            ? "runtime bootstrap 返回了陈旧 ack"
            : "runtime bootstrap ack 与当前运行上下文不一致"
        );
      }
      return {
        identityBindingState: "bound",
        transportState: "ready",
        bootstrapState: "ready",
        runtimeReadiness: "ready",
        details: {
          runtime_context_id: envelope.runtime_context_id
        }
      };
    } catch (error) {
      if (error instanceof CliError) {
        return mapBootstrapCliErrorToReadiness(error);
      }
      if (error instanceof NativeMessagingTransportError) {
        const readiness = mapTransportErrorToReadiness(error);
        return {
          identityBindingState: "bound",
          ...readiness,
          details: {
            ...(readiness.details ?? {}),
            transport_proof: bridge.currentTransportProof?.() ?? { surface: "unknown" }
          }
        };
      }
      throw error;
    }
  }

  async #waitForPersistentBootstrapRetry(): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, PERSISTENT_BOOTSTRAP_STARTUP_RETRY_INTERVAL_MS);
    });
  }

  #shouldRetryStartupBootstrap(input: {
    runtimeInput: RuntimeActionInput;
    readiness: RuntimeReadinessSnapshot;
  }): boolean {
    if (!hasRuntimeBootstrapTargetHint(input.runtimeInput.params)) {
      return false;
    }
    if (input.readiness.identityBindingState !== "bound") {
      return false;
    }
    if (input.readiness.bootstrapState === "ready" || input.readiness.bootstrapState === "stale") {
      return false;
    }
    if (input.readiness.bootstrapState === "failed") {
      return false;
    }
    return (
      input.readiness.transportState === "not_connected" ||
      input.readiness.transportState === "ready" ||
      input.readiness.runtimeReadiness === "pending" ||
      input.readiness.runtimeReadiness === "recoverable"
    );
  }

  async #deliverRuntimeBootstrapForStartup(input: {
    runtimeInput: RuntimeActionInput;
    profile: string;
    fingerprintRuntime: ReturnType<typeof buildFingerprintContextForMeta>;
    identityPreflight: IdentityPreflightResult;
    profileState: ProfileState;
  }): Promise<RuntimeReadinessSnapshot> {
    let readiness = await this.#deliverRuntimeBootstrap({
      runtimeInput: input.runtimeInput,
      profile: input.profile,
      fingerprintRuntime: input.fingerprintRuntime,
      identityPreflight: input.identityPreflight
    });
    if (
      requiresPersistentBootstrapSocketAdmission({
        params: input.runtimeInput.params,
        identityPreflight: input.identityPreflight
      }) &&
      (readiness.transportState === "not_connected" ||
        readiness.transportState === "disconnected") &&
      hasPersistentBootstrapMissingSocketProof(readiness)
    ) {
      return readiness;
    }
    if (
      readiness.runtimeReadiness === "ready" ||
      !this.#shouldRetryStartupBootstrap({
        runtimeInput: input.runtimeInput,
        readiness
      })
    ) {
      return readiness;
    }

    for (let attempt = 0; attempt < PERSISTENT_BOOTSTRAP_STARTUP_RETRY_ATTEMPTS; attempt += 1) {
      await this.#waitForPersistentBootstrapRetry();
      const observed = await this.#readRuntimeReadiness({
        runtimeInput: input.runtimeInput,
        lockHeld: true,
        identityPreflight: input.identityPreflight,
        profileState: input.profileState
      });
      if (observed.runtimeReadiness === "ready" || observed.bootstrapState === "stale") {
        return observed;
      }
      if (observed.bootstrapState === "failed") {
        return observed;
      }
      readiness = observed;
      if (observed.transportState !== "ready") {
        continue;
      }

      readiness = await this.#deliverRuntimeBootstrap({
        runtimeInput: input.runtimeInput,
        profile: input.profile,
        fingerprintRuntime: input.fingerprintRuntime,
        identityPreflight: input.identityPreflight
      });
      if (
        readiness.runtimeReadiness === "ready" ||
        !this.#shouldRetryStartupBootstrap({
          runtimeInput: input.runtimeInput,
          readiness
        })
      ) {
        return readiness;
      }
    }

    return readiness;
  }

  async #readRuntimeReadiness(input: {
    runtimeInput: RuntimeActionInput;
    lockHeld: boolean;
    observedRunId?: string;
    identityPreflight: IdentityPreflightResult;
    profileState: ProfileState;
  }): Promise<RuntimeReadinessSnapshot> {
    const baseIdentity = input.identityPreflight.identityBindingState;
    if (input.identityPreflight.mode !== "official_chrome_persistent_extension") {
      return buildNonPersistentRuntimeReadiness({
        identityBindingState: baseIdentity,
        lockHeld: input.lockHeld,
        profileState: input.profileState
      });
    }
    if (!input.lockHeld) {
      if (
        baseIdentity === "bound" &&
        input.observedRunId &&
        (input.profileState === "ready" || input.profileState === "disconnected")
      ) {
        const readiness = await this.#readPersistentRuntimeReadiness({
          ...input,
          runtimeInput: {
            ...input.runtimeInput,
            runId: input.observedRunId
          },
          includeTargetBinding: false,
          lockHeld: true,
          observedRunId: undefined
        });
        return {
          ...readiness,
          runtimeReadiness:
            input.profileState === "disconnected"
              ? readiness.bootstrapState === "stale" ||
                readiness.transportState === "not_connected"
                ? "blocked"
                : "recoverable"
              : buildRuntimeReadiness({
                  lockHeld: false,
                  identityBindingState: readiness.identityBindingState,
                  transportState: readiness.transportState,
                  bootstrapState: readiness.bootstrapState
                })
        };
      }
      return buildUnlockedPersistentRuntimeReadiness({
        identityBindingState: baseIdentity,
        profileState: input.profileState
      });
    }
    if (baseIdentity !== "bound") {
      return buildBoundlessRuntimeReadiness({
        identityBindingState: baseIdentity,
        lockHeld: input.lockHeld
      });
    }

    return this.#readPersistentRuntimeReadiness(input);
  }

  async #readObservedRuntimeReadiness(input: {
    runtimeInput: RuntimeActionInput;
    lockHeld: boolean;
    observedRunId?: string;
    identityPreflight: IdentityPreflightResult;
    profileState: ProfileState;
    includeTargetBinding?: boolean;
  }): Promise<RuntimeReadinessSnapshot | null> {
    if (
      input.lockHeld ||
      input.identityPreflight.mode !== "official_chrome_persistent_extension" ||
      input.identityPreflight.identityBindingState !== "bound" ||
      !input.observedRunId ||
      (input.profileState !== "ready" && input.profileState !== "disconnected")
    ) {
      return null;
    }

    return this.#readPersistentRuntimeReadiness({
      ...input,
      runtimeInput: {
        ...input.runtimeInput,
        runId: input.observedRunId
      },
      includeTargetBinding: input.includeTargetBinding === true,
      lockHeld: true,
      observedRunId: undefined
    });
  }

  async #readPersistentRuntimeReadiness(input: {
    runtimeInput: RuntimeActionInput;
    lockHeld: boolean;
    observedRunId?: string;
    identityPreflight: IdentityPreflightResult;
    profileState: ProfileState;
    includeTargetBinding?: boolean;
  }): Promise<RuntimeReadinessSnapshot> {
    const baseIdentity = input.identityPreflight.identityBindingState;
    const bridge = this.#bridgeFactory();
    const runtimeContextId = buildRuntimeBootstrapContextId(
      input.runtimeInput.profile,
      input.runtimeInput.runId
    );
    try {
        const result = await bridge.runCommand({
          runId: input.runtimeInput.runId,
          profile: input.runtimeInput.profile,
          cwd: input.runtimeInput.cwd,
          command: "runtime.readiness",
          params: {
            run_id: input.runtimeInput.runId,
            runtime_context_id: runtimeContextId,
            ...buildForwardTimeoutParams(input.runtimeInput.params),
            ...(input.includeTargetBinding === false
              ? {}
              : buildRuntimeTargetParams(input.runtimeInput.params))
          } as JsonObject
        });
      if (!result.ok) {
        throw this.#buildRuntimeBootstrapCliError(result);
      }
      const payload = asResultRecord(result.payload);
      return mapRuntimeReadinessPayload({
        payload,
        identityBindingState: baseIdentity,
        lockHeld: input.lockHeld
      });
    } catch (error) {
      if (error instanceof NativeMessagingTransportError) {
        const readiness = mapTransportErrorToReadiness(error);
        return {
          identityBindingState: baseIdentity,
          ...readiness,
          details: {
            ...(readiness.details ?? {}),
            transport_proof: bridge.currentTransportProof?.() ?? { surface: "unknown" }
          }
        };
      }
      if (error instanceof CliError) {
        return mapBootstrapCliErrorToReadiness(error, baseIdentity);
      }
      throw error;
    }
  }

  #buildRuntimeBootstrapCliError(result: BridgeCommandResult): CliError {
    if (result.ok) {
      return new CliError("ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED", "runtime bootstrap 未送达");
    }
    const code = result.error.code;
    if (
      code === "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED" ||
      code === "ERR_RUNTIME_BOOTSTRAP_ACK_TIMEOUT" ||
      code === "ERR_RUNTIME_BOOTSTRAP_ACK_STALE" ||
      code === "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH" ||
      code === "ERR_RUNTIME_READY_SIGNAL_CONFLICT"
    ) {
      return new CliError(code, result.error.message, {
        retryable: code !== "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH"
      });
    }
    return new CliError("ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED", result.error.message, {
      retryable: true
    });
  }

  async #runIdentityPreflight(input: {
    input: RuntimeActionInput;
    meta: ProfileMeta | null;
    profileDir: string;
  }): Promise<IdentityPreflightResult> {
    const preflight = await runIdentityPreflight({
      params: input.input.params,
      meta: input.meta,
      profileDir: input.profileDir
    });
    await this.#ensureProfileScopedNativeHostManifest({
      preflight,
      profileDir: input.profileDir
    });
    return preflight;
  }

  async #ensureProfileScopedNativeHostManifest(input: {
    preflight: IdentityPreflightResult;
    profileDir: string;
  }): Promise<void> {
    if (
      input.preflight.mode !== "official_chrome_persistent_extension" ||
      !input.preflight.binding ||
      !input.preflight.manifestPath ||
      input.preflight.identityBindingState !== "bound"
    ) {
      return;
    }
    const sourceManifest = await readFile(input.preflight.manifestPath, "utf8");
    const profileManifestPath = join(
      input.profileDir,
      "NativeMessagingHosts",
      `${input.preflight.binding.nativeHostName}.json`
    );
    await assertProfileNativeHostManifestPathSafe({
      profileDir: input.profileDir,
      manifestPath: profileManifestPath
    });
    await mkdir(dirname(profileManifestPath), { recursive: true });
    await writeFile(profileManifestPath, sourceManifest, "utf8");
  }

  #buildMinimalProfileMeta(input: {
    profile: string;
    profileDir: string;
    nowIso: string;
  }): ProfileMeta {
    return {
      schemaVersion: 1,
      profileName: input.profile,
      profileDir: input.profileDir,
      profileState: "uninitialized",
      proxyBinding: null,
      fingerprintSeeds: {
        audioNoiseSeed: `${input.profile}-audio-seed`,
        canvasNoiseSeed: `${input.profile}-canvas-seed`
      },
      localStorageSnapshots: [],
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
      lastStartedAt: null,
      lastLoginAt: null,
      lastStoppedAt: null,
      lastDisconnectedAt: null
    };
  }
}
