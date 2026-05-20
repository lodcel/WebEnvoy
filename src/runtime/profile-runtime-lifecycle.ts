import { join } from "node:path";

import { BROWSER_STATE_FILENAME } from "./browser-launcher.js";
import type { BrowserInstanceStateSnapshot } from "./profile-access.js";
import type { ProfileLock } from "./profile-lock.js";
import type { ProfileState } from "./profile-state.js";
import { buildRuntimeBootstrapContextId } from "./runtime-bootstrap.js";
import type { RuntimeReadinessSnapshot } from "./runtime-readiness.js";

export interface BrowserInstanceStateRecord extends Record<string, unknown> {
  runId: string;
  controllerPid: number;
  browserPid: number;
  headless?: boolean;
  executionSurface?: "headless_browser" | "real_browser";
  launchSurface?: "direct_spawn" | "macos_launchservices";
  processOwnership?: "owned_child" | "external_persistent_app";
}

export interface RuntimeLifecycleFileReader {
  readFile(path: string, encoding: "utf8"): Promise<string>;
}

export type RuntimeTakeoverMode =
  | "ready_attach"
  | "recoverable_rebind"
  | "stale_bootstrap_rebind";

export interface RuntimeTakeoverEvidenceRecord {
  mode: RuntimeTakeoverMode | null;
  attachableReadyRuntime: boolean;
  orphanRecoverable: boolean;
  staleBootstrapRecoverable: boolean;
  freshness: "fresh" | "stale";
  identityBound: boolean;
  ownerConflictFree: boolean;
  controllerBrowserContinuity: boolean;
  transportBootstrapViable: boolean;
  observedRunId: string;
  observedRuntimeSessionId: string | null;
  observedRuntimeInstanceId: string | null;
  runtimeContextId: string | null;
  requestRunId: string | null;
  requestRuntimeContextId: string | null;
  managedTargetTabId: number | null;
  managedTargetDomain: string | null;
  managedTargetPage: string | null;
  targetTabContinuity: string | null;
  takeoverEvidenceObservedAt: string | null;
}

const asInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const isIsoTimestampAtOrAfter = (value: unknown, floor: unknown): boolean => {
  if (typeof value !== "string" || typeof floor !== "string") {
    return false;
  }
  const valueMs = Date.parse(value);
  const floorMs = Date.parse(floor);
  return Number.isFinite(valueMs) && Number.isFinite(floorMs) && valueMs >= floorMs;
};

const buildObservedRuntimeInstanceId = (input: {
  sessionId: string;
  runId: string;
  runtimeContextId: string;
}): string => `${input.sessionId}:${input.runId}:${input.runtimeContextId}`;

const hasVerifiedBootstrapAttestation = (readiness: RuntimeReadinessSnapshot): boolean => {
  if (readiness.bootstrapState === "ready") {
    return true;
  }
  if (readiness.bootstrapState !== "failed") {
    return false;
  }
  const code = readiness.details?.code as string | undefined;
  return (
    code === undefined ||
    code === "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH" ||
    code === "ERR_RUNTIME_READY_SIGNAL_CONFLICT"
  );
};

const hasVerifiedReadyRuntimeSignal = (readiness: RuntimeReadinessSnapshot): boolean =>
  readiness.identityBindingState === "bound" &&
  readiness.transportState === "ready" &&
  hasVerifiedBootstrapAttestation(readiness) &&
  ((readiness.details?.code as string | undefined) !== "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH") &&
  ((readiness.details?.code as string | undefined) !== "ERR_RUNTIME_READY_SIGNAL_CONFLICT");

export const canAttachReadyRuntime = (input: {
  healthyLock: boolean;
  profileState: ProfileState;
  pinnedControllerPid: number | null | undefined;
  readiness: RuntimeReadinessSnapshot;
}): boolean =>
  input.healthyLock &&
  input.profileState === "ready" &&
  Number.isInteger(input.pinnedControllerPid) &&
  hasVerifiedReadyRuntimeSignal(input.readiness);

export const canAttachStaleBootstrapRuntime = (input: {
  profile: string;
  healthyLock: boolean;
  controlConnected: boolean;
  profileState: ProfileState;
  pinnedControllerPid: number | null | undefined;
  readiness: RuntimeReadinessSnapshot | null;
  observedRunId: string | undefined;
  targetBindingComplete: boolean;
  targetTabId: unknown;
  targetDomain: unknown;
  targetPage: unknown;
  requestedAt: unknown;
}): boolean => {
  const observedRunId = asNonEmptyString(input.observedRunId);
  const observedRuntimeSessionId = asNonEmptyString(
    input.readiness?.details?.observed_runtime_session_id
  );
  const observedRuntimeInstanceId = asNonEmptyString(
    input.readiness?.details?.observed_runtime_instance_id
  );
  const observedRuntimeContextId =
    observedRunId !== null ? buildRuntimeBootstrapContextId(input.profile, observedRunId) : null;
  const expectedObservedRuntimeInstanceId =
    observedRuntimeSessionId !== null && observedRunId !== null && observedRuntimeContextId !== null
      ? buildObservedRuntimeInstanceId({
          sessionId: observedRuntimeSessionId,
          runId: observedRunId,
          runtimeContextId: observedRuntimeContextId
        })
      : null;
  return (
    input.healthyLock &&
    input.controlConnected &&
    input.profileState === "ready" &&
    Number.isInteger(input.pinnedControllerPid) &&
    input.targetBindingComplete &&
    input.readiness?.identityBindingState === "bound" &&
    input.readiness.transportState === "ready" &&
    input.readiness.bootstrapState === "stale" &&
    asInteger(input.readiness.details?.managed_target_tab_id) === input.targetTabId &&
    asNonEmptyString(input.readiness.details?.managed_target_domain) === input.targetDomain &&
    asNonEmptyString(input.readiness.details?.managed_target_page) === input.targetPage &&
    asNonEmptyString(input.readiness.details?.runtime_context_id) === observedRuntimeContextId &&
    asNonEmptyString(input.readiness.details?.target_tab_continuity) === "runtime_trust_state" &&
    observedRuntimeInstanceId !== null &&
    observedRuntimeInstanceId === expectedObservedRuntimeInstanceId &&
    isIsoTimestampAtOrAfter(input.readiness.details?.takeover_evidence_observed_at, input.requestedAt)
  );
};

export const resolveActiveBrowserInstanceState = (input: {
  state: BrowserInstanceStateSnapshot | null;
  observedRunId: string;
  pinnedControllerPid: number | null | undefined;
  healthyLock: boolean;
}): BrowserInstanceStateSnapshot | null => {
  if (!input.healthyLock || input.state === null || input.state.runId !== input.observedRunId) {
    return null;
  }
  if (
    Number.isInteger(input.pinnedControllerPid) &&
    input.state.controllerPid !== input.pinnedControllerPid
  ) {
    return null;
  }
  return input.state;
};

export const parseBrowserInstanceState = (
  raw: string
): BrowserInstanceStateRecord | null => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.runId !== "string" ||
      !Number.isInteger(parsed.controllerPid) ||
      !Number.isInteger(parsed.browserPid)
    ) {
      return null;
    }
    return {
      ...parsed,
      runId: parsed.runId,
      controllerPid: parsed.controllerPid as number,
      browserPid: parsed.browserPid as number,
      headless: typeof parsed.headless === "boolean" ? parsed.headless : undefined,
      executionSurface:
        parsed.executionSurface === "headless_browser" ||
        parsed.executionSurface === "real_browser"
          ? parsed.executionSurface
          : undefined,
      launchSurface:
        parsed.launchSurface === "direct_spawn" ||
        parsed.launchSurface === "macos_launchservices"
          ? parsed.launchSurface
          : undefined,
      processOwnership:
        parsed.processOwnership === "owned_child" ||
        parsed.processOwnership === "external_persistent_app"
          ? parsed.processOwnership
          : undefined
    };
  } catch {
    return null;
  }
};

export const readBrowserInstanceState = async (input: {
  profileDir: string;
  fileReader: RuntimeLifecycleFileReader;
}): Promise<BrowserInstanceStateSnapshot | null> => {
  const statePath = join(input.profileDir, BROWSER_STATE_FILENAME);
  try {
    const raw = await input.fileReader.readFile(statePath, "utf8");
    const parsed = parseBrowserInstanceState(raw);
    if (parsed === null) {
      return null;
    }
    const controllerPid = parsed.controllerPid;
    const browserPid = parsed.browserPid;
    if (controllerPid <= 0 || browserPid <= 0) {
      return null;
    }
    return {
      runId: parsed.runId,
      controllerPid,
      browserPid,
      headless: typeof parsed.headless === "boolean" ? parsed.headless : undefined,
      executionSurface:
        parsed.executionSurface === "headless_browser" ||
        parsed.executionSurface === "real_browser"
          ? parsed.executionSurface
          : undefined,
      launchSurface:
        parsed.launchSurface === "direct_spawn" ||
        parsed.launchSurface === "macos_launchservices"
          ? parsed.launchSurface
          : undefined,
      processOwnership:
        parsed.processOwnership === "owned_child" ||
        parsed.processOwnership === "external_persistent_app"
          ? parsed.processOwnership
          : undefined
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }
    return null;
  }
};

export const buildLocklessActiveRuntimeLock = (input: {
  profile: string;
  lockPath: string;
  state: BrowserInstanceStateSnapshot | null;
  nowIso: string;
  isProcessAlive: (pid: number) => boolean;
}): ProfileLock | null => {
  if (
    input.state === null ||
    !input.isProcessAlive(input.state.controllerPid) ||
    !input.isProcessAlive(input.state.browserPid)
  ) {
    return null;
  }
  return {
    profileName: input.profile,
    lockPath: input.lockPath,
    ownerPid:
      input.state.processOwnership === "external_persistent_app"
        ? input.state.browserPid
        : input.state.controllerPid,
    controllerPid: input.state.controllerPid,
    controllerPidState: "live",
    ownerRunId: input.state.runId,
    acquiredAt: input.nowIso,
    lastHeartbeatAt: input.nowIso
  };
};

export const buildRuntimeTakeoverEvidence = (input: {
  profile: string;
  lockHeld: boolean;
  healthyLock: boolean;
  controlConnected: boolean;
  observedRunId: string;
  requestRunId: string;
  requestRuntimeContextId: string;
  requestedTargetTabId?: unknown;
  requestedTargetDomain?: unknown;
  requestedTargetPage?: unknown;
  readiness: RuntimeReadinessSnapshot;
  attachableReadyRuntime: boolean;
  orphanRecoverable: boolean;
  staleBootstrapRecoverable: boolean;
  pinnedControllerPid: number | null | undefined;
  browserPid: number | null;
  stateRunId: string | null;
}): RuntimeTakeoverEvidenceRecord => {
  const readinessDetails = input.readiness.details ?? {};
  const controllerBrowserContinuity =
    Number.isInteger(input.pinnedControllerPid) &&
    Number.isInteger(input.browserPid) &&
    input.stateRunId === input.observedRunId;
  const readyAttach = !input.lockHeld && input.attachableReadyRuntime;
  const recoverableRebind = !input.lockHeld && !readyAttach && input.orphanRecoverable;
  const staleBootstrapRebind =
    !input.lockHeld && !readyAttach && !recoverableRebind && input.staleBootstrapRecoverable;
  const transportBootstrapViable = staleBootstrapRebind
    ? input.readiness.transportState === "ready" && input.readiness.bootstrapState === "stale"
    : input.readiness.transportState !== "not_connected" &&
      input.readiness.bootstrapState !== "stale";
  const staleObservedRuntimeInstanceId = asNonEmptyString(
    readinessDetails.observed_runtime_instance_id
  );
  const staleObservedRuntimeSessionId = asNonEmptyString(
    readinessDetails.observed_runtime_session_id
  );
  const takeoverEvidenceObservedAt = asNonEmptyString(
    readinessDetails.takeover_evidence_observed_at
  );
  const managedTargetTabId = asInteger(readinessDetails.managed_target_tab_id);
  const managedTargetDomain = asNonEmptyString(readinessDetails.managed_target_domain);
  const targetTabContinuity = asNonEmptyString(readinessDetails.target_tab_continuity);
  const requestedTargetTabId = asInteger(input.requestedTargetTabId);
  const requestedTargetDomain = asNonEmptyString(input.requestedTargetDomain);
  const requestedTargetPage = asNonEmptyString(input.requestedTargetPage);
  const managedTargetPage =
    asNonEmptyString(readinessDetails.managed_target_page) ??
    (targetTabContinuity === "runtime_trust_state" &&
    managedTargetTabId !== null &&
    requestedTargetTabId === managedTargetTabId &&
    managedTargetDomain !== null &&
    requestedTargetDomain === managedTargetDomain &&
    requestedTargetPage !== null
      ? requestedTargetPage
      : null);

  return {
    mode: readyAttach
      ? "ready_attach"
      : recoverableRebind
        ? "recoverable_rebind"
        : staleBootstrapRebind
          ? "stale_bootstrap_rebind"
          : null,
    attachableReadyRuntime: readyAttach,
    orphanRecoverable: recoverableRebind,
    staleBootstrapRecoverable: staleBootstrapRebind,
    freshness:
      controllerBrowserContinuity && transportBootstrapViable && input.healthyLock
        ? "fresh"
        : "stale",
    identityBound: input.readiness.identityBindingState === "bound",
    ownerConflictFree:
      input.lockHeld ||
      recoverableRebind ||
      ((readyAttach || staleBootstrapRebind) && input.healthyLock && input.controlConnected),
    controllerBrowserContinuity,
    transportBootstrapViable,
    observedRunId: input.observedRunId,
    observedRuntimeSessionId: staleBootstrapRebind ? staleObservedRuntimeSessionId : null,
    observedRuntimeInstanceId: staleBootstrapRebind ? staleObservedRuntimeInstanceId : null,
    runtimeContextId:
      input.observedRunId.length > 0
        ? buildRuntimeBootstrapContextId(input.profile, input.observedRunId)
        : null,
    requestRunId: staleBootstrapRebind ? input.requestRunId : null,
    requestRuntimeContextId: staleBootstrapRebind ? input.requestRuntimeContextId : null,
    managedTargetTabId,
    managedTargetDomain,
    managedTargetPage,
    targetTabContinuity,
    takeoverEvidenceObservedAt: staleBootstrapRebind ? takeoverEvidenceObservedAt : null
  };
};
