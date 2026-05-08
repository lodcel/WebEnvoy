import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CommandDefinition, CommandExecutionResult, JsonObject, RuntimeContext } from "../core/types.js";
import { CliError } from "../core/errors.js";
import { mapCapabilitySummaryForContract } from "../core/capability-output.js";
import {
  NativeMessagingBridge,
  NativeMessagingTransportError
} from "../runtime/native-messaging/bridge.js";
import { NativeHostBridgeTransport } from "../runtime/native-messaging/host.js";
import { createLoopbackNativeBridgeTransport } from "../runtime/native-messaging/loopback.js";
import { buildLoopbackAuditRecord } from "../runtime/native-messaging/loopback-gate-audit.js";
import { buildLoopbackGate } from "../runtime/native-messaging/loopback-gate.js";
import { buildLoopbackGatePayload } from "../runtime/native-messaging/loopback-gate-payload.js";
import { appendFingerprintContext, buildFingerprintContextForMeta } from "../runtime/fingerprint-runtime.js";
import {
  classifyCloseoutHardStopRisk,
  type CloseoutHardStopRiskClassification,
  type CloseoutHardStopRiskReason
} from "../runtime/closeout-hard-stop-risk.js";
import {
  evaluateCloseoutEvidence,
  type EvaluateCloseoutEvidenceInput
} from "../runtime/closeout-evidence-evaluator.js";
import { verifyCloseoutCanonicalExecutionAudit } from "../runtime/closeout-canonical-execution-audit-verifier.js";
import { ProfileStore } from "../runtime/profile-store.js";
import {
  isAccountSafetyReason,
  toAccountSafetyStatus,
  type AccountSafetyReason
} from "../runtime/account-safety.js";
import {
  toSessionRhythmStatusView,
  toXhsCloseoutRhythmStatus
} from "../runtime/xhs-closeout-rhythm.js";
import { ProfileRuntimeService } from "../runtime/profile-runtime.js";
import { resolveRuntimeProfileRoot } from "../runtime/worktree-root.js";
import {
  readXhsCloseoutValidationGateView,
  resolveXhsCloseoutReadinessBaselineExecutionMode,
  toXhsCloseoutValidationGateJson,
  type XhsCloseoutValidationGateView
} from "../runtime/anti-detection-validation.js";
import {
  RuntimeStoreError,
  SQLiteRuntimeStore,
  resolveRuntimeStorePath
} from "../runtime/store/sqlite-runtime-store.js";
import { prepareOfficialChromeRuntime } from "../runtime/official-chrome-runtime.js";
import { buildOfficialChromeRuntimeStatusParams } from "../runtime/official-chrome-runtime.js";
import {
  AbilityRef,
  AbilityAction,
  AbilityEnvelope,
  buildCapabilityResult,
  ISSUE209_INTERNAL_ADMISSION_DRAFT_KEY,
  normalizeGateOptionsForContract,
  parseAbilityEnvelopeForContract,
  parseDetailInputForContract,
  parseSearchInputForContract,
  parseUserHomeInputForContract,
  prepareIssue209LiveReadEnvelopeForContract,
  XhsExecutionMode
} from "./xhs-input.js";

type AbilityLayer = "L3" | "L2" | "L1";
type AbilityActionName = AbilityAction;

export { buildOfficialChromeRuntimeStatusParams } from "../runtime/official-chrome-runtime.js";
export { normalizeGateOptionsForContract } from "./xhs-input.js";

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const WEBENVOY_RUNTIME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const resolveGitHeadForCwd = (cwd: string): { root: string; head: string } | null => {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  if (result.status !== 0) {
    return null;
  }
  const [root, head] = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!root || !head) {
    return null;
  }
  return { root, head };
};

const isWebEnvoyCheckoutRoot = (root: string): boolean => {
  try {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      name?: unknown;
    };
    return packageJson.name === "@webenvoy/cli";
  } catch {
    return false;
  }
};

const resolvePackageGitHeadForCwd = (cwd: string): string | null => {
  let current = resolve(cwd);
  while (true) {
    try {
      const packageJson = JSON.parse(readFileSync(resolve(current, "package.json"), "utf8")) as {
        gitHead?: unknown;
        name?: unknown;
      };
      const gitHead = asString(packageJson.gitHead);
      if (packageJson.name === "@webenvoy/cli" && gitHead !== null) {
        return gitHead;
      }
    } catch {
      // Keep walking toward the filesystem root; packaged dist may not sit at cwd.
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

const asPositiveInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

export const resolveForwardTimeoutMsForContract = (params: JsonObject): number | null =>
  asPositiveInteger(params.timeout_ms);

const toSessionRhythmIdPart = (value: string): string =>
  value.replace(/[^A-Za-z0-9._-]+/gu, "_");

const buildSessionRhythmCompatibilityRefsForRuntime = async (input: {
  cwd: string;
  profile: string | null;
  runId: string;
  sessionId: string;
  profileMeta: Awaited<ReturnType<ProfileStore["readMeta"]>> | null;
  gate: ReturnType<typeof normalizeGateOptionsForContract>;
}): Promise<JsonObject | null> => {
  if (!input.profile) {
    return null;
  }
  let store: SQLiteRuntimeStore | null = null;
  try {
    store = new SQLiteRuntimeStore(resolveRuntimeStorePath(input.cwd));
    const issueScope = asString(input.gate.options.issue_scope) ?? "issue_209";
    const persisted = await store.getSessionRhythmStatusView({
      profile: input.profile,
      platform: "xhs",
      issueScope,
      sessionId: input.sessionId,
      runId: input.runId
    });
    const shouldWriteCurrentDecision =
      !!persisted ||
      !!input.profileMeta?.xhsCloseoutRhythm ||
      input.profileMeta?.accountSafety?.state === "account_risk_blocked";
    if (!shouldWriteCurrentDecision) {
      return null;
    }
    const currentView = toSessionRhythmStatusView({
      profile: input.profile,
      rhythm: input.profileMeta?.xhsCloseoutRhythm,
      accountSafety: input.profileMeta?.accountSafety,
      issueScope,
      sessionId: input.sessionId,
      sourceRunId: input.runId,
      effectiveExecutionMode: input.gate.requestedExecutionMode
    });
    const currentWindowState = asObject(currentView.session_rhythm_window_state);
    const currentEvent = asObject(currentView.session_rhythm_event);
    const currentDecision = asObject(currentView.session_rhythm_decision);
    const persistedWindowState = persisted?.window_state;
    const persistedEvent = persisted?.event;
    const persistedDecision = persisted?.decision;
    const windowId =
      asString(persistedWindowState?.window_id) ?? asString(currentWindowState?.window_id);
    const windowStateForRecord = persistedWindowState ?? currentWindowState;
    const eventForRecord = persistedEvent ?? currentEvent;
    const decisionForRecord = persistedDecision ?? currentDecision;
    if (!windowId || !windowStateForRecord || !eventForRecord || !decisionForRecord) {
      return null;
    }
    const liveRunPendingExecutionAudit = isLiveXhsExecutionMode(input.gate.requestedExecutionMode);
    const currentSourceKey = toSessionRhythmIdPart(input.runId);
    const currentEventId = `rhythm_evt_preflight_${currentSourceKey}`;
    const currentDecisionId = `rhythm_decision_preflight_${currentSourceKey}`;
    await store.recordSessionRhythmStatusView({
      profile: input.profile,
      platform: "xhs",
      issueScope,
      windowState: {
        ...windowStateForRecord,
        window_id: windowId,
        last_event_id: asString(persistedWindowState?.last_event_id) ?? currentEventId,
        source_run_id: asString(persistedWindowState?.source_run_id) ?? input.runId
      },
      event: {
        ...eventForRecord,
        event_id: asString(persistedEvent?.event_id) ?? currentEventId,
        session_id: asString(persistedEvent?.session_id) ?? input.sessionId,
        window_id: windowId,
        source_audit_event_id: asString(persistedEvent?.source_audit_event_id)
      },
      decision: {
        ...decisionForRecord,
        decision_id: currentDecisionId,
        window_id: windowId,
        run_id: input.runId,
        session_id: input.sessionId,
        profile: input.profile,
        current_phase:
          asString(windowStateForRecord.current_phase) ??
          asString(decisionForRecord.current_phase) ??
          "warmup",
        current_risk_state:
          asString(windowStateForRecord.risk_state) ??
          asString(decisionForRecord.current_risk_state) ??
          "paused",
        next_phase:
          asString(windowStateForRecord.current_phase) ??
          asString(decisionForRecord.next_phase) ??
          "warmup",
        next_risk_state:
          asString(windowStateForRecord.risk_state) ??
          asString(decisionForRecord.next_risk_state) ??
          "paused",
        effective_execution_mode: input.gate.requestedExecutionMode,
        decision: liveRunPendingExecutionAudit
          ? "deferred"
          : (asString(decisionForRecord.decision) ?? "blocked"),
        reason_codes: liveRunPendingExecutionAudit
          ? ["XHS_LIVE_ADMISSION_PENDING_EXECUTION_AUDIT"]
          : Array.isArray(decisionForRecord.reason_codes)
            ? decisionForRecord.reason_codes
            : [],
        requires: liveRunPendingExecutionAudit
          ? ["execution_audit_appended"]
          : Array.isArray(decisionForRecord.requires)
            ? decisionForRecord.requires
            : []
      }
    });
    const current = await store.getSessionRhythmStatusView({
      profile: input.profile,
      platform: "xhs",
      issueScope,
      sessionId: input.sessionId,
      runId: input.runId
    });
    const currentWindowId = asString(current?.window_state.window_id);
    const currentDecisionIdFromStore =
      asString(current?.decision.run_id) === input.runId
        ? asString(current?.decision.decision_id)
        : null;
    if (currentWindowId || currentDecisionIdFromStore) {
      return {
        ...(currentWindowId ? { __session_rhythm_window_id: currentWindowId } : {}),
        ...(currentDecisionIdFromStore
          ? { __session_rhythm_decision_id: currentDecisionIdFromStore }
          : {})
      };
    }
  } catch (error) {
    if (error instanceof RuntimeStoreError) {
      throw new CliError("ERR_RUNTIME_UNAVAILABLE", `运行记录存储失败: ${error.code}`, {
        retryable: error.code !== "ERR_RUNTIME_STORE_SCHEMA_MISMATCH",
        cause: error
      });
    }
    throw error;
  } finally {
    try {
      store?.close();
    } catch {
      // Compatibility refs are best-effort read-only after the query finishes.
    }
  }
  return null;
};

const readPersistedSessionRhythmBlockStatus = async (input: {
  cwd: string;
  profile: string | null;
  issueScope: string | null;
  profileMeta: Awaited<ReturnType<ProfileStore["readMeta"]>> | null;
}): Promise<JsonObject | null> => {
  if (!input.profile) {
    return null;
  }
  let store: SQLiteRuntimeStore | null = null;
  try {
    store = new SQLiteRuntimeStore(resolveRuntimeStorePath(input.cwd));
    const persisted = await store.getSessionRhythmStatusView({
      profile: input.profile,
      platform: "xhs",
      issueScope: input.issueScope ?? "issue_209"
    });
    const windowState = persisted?.window_state;
    const persistedDecision = persisted?.decision;
    const persistedDecisionValue = asString(persistedDecision?.decision);
    const event = persisted?.event;
    const profileRhythmState = asString(input.profileMeta?.xhsCloseoutRhythm?.state);
    const persistedPhase = asString(windowState?.current_phase);
    const fallbackAllowed = !profileRhythmState || profileRhythmState === "not_required";
    if (
      fallbackAllowed &&
      (persistedPhase === "recovery_probe" || persistedPhase === "warmup")
    ) {
      return {
        state: "single_probe_required",
        cooldown_until: asString(windowState?.cooldown_until),
        operator_confirmed_at: null,
        single_probe_required: true,
        single_probe_passed_at: null,
        probe_run_id: asString(windowState?.source_run_id),
        full_bundle_blocked: true,
        reason_codes:
          Array.isArray(persistedDecision?.reason_codes) &&
          persistedDecision.reason_codes.every((reason) => typeof reason === "string")
            ? persistedDecision.reason_codes
            : [
                asString(event?.reason) ??
                  asString(windowState?.last_event_id) ??
                  "PERSISTED_SESSION_RHYTHM_RECOVERY_REQUIRED"
              ]
      };
    }
    if (
      persistedPhase !== "cooldown" &&
      asString(windowState?.risk_state) !== "paused"
    ) {
      if (
        persistedDecisionValue === "deferred" &&
        fallbackAllowed
      ) {
        const reasonCodes =
          Array.isArray(persistedDecision?.reason_codes) &&
          persistedDecision.reason_codes.every((reason) => typeof reason === "string")
            ? persistedDecision.reason_codes
            : [
                asString(event?.reason) ??
                  asString(windowState?.last_event_id) ??
                  "XHS_RECOVERY_SINGLE_PROBE_PASSED"
              ];
        return {
          state: "single_probe_passed",
          cooldown_until: asString(windowState?.cooldown_until),
          operator_confirmed_at: null,
          single_probe_required: false,
          single_probe_passed_at:
            asString(persistedDecision?.decided_at) ?? asString(event?.recorded_at),
          probe_run_id:
            asString(persistedDecision?.run_id) ?? asString(windowState?.source_run_id),
          full_bundle_blocked: true,
          reason_codes: reasonCodes
        };
      }
      if (
        persistedDecisionValue &&
        persistedDecisionValue !== "allowed" &&
        fallbackAllowed
      ) {
        return {
          state: "operator_confirmation_required",
          cooldown_until: null,
          operator_confirmed_at: null,
          single_probe_required: true,
          single_probe_passed_at: null,
          probe_run_id: null,
          full_bundle_blocked: true,
          reason_codes:
            Array.isArray(persistedDecision?.reason_codes) &&
            persistedDecision.reason_codes.every((reason) => typeof reason === "string")
              ? persistedDecision.reason_codes
              : [
                  asString(event?.reason) ??
                    asString(windowState?.last_event_id) ??
                    "PERSISTED_SESSION_RHYTHM_BLOCKED"
                ]
        };
      }
      return null;
    }
    const cooldownUntil = asString(windowState?.cooldown_until);
    const operatorConfirmedAt = asString(input.profileMeta?.xhsCloseoutRhythm?.operatorConfirmedAt);
    if (
      operatorConfirmedAt &&
      (!cooldownUntil || Date.parse(cooldownUntil) <= Date.now())
    ) {
      return null;
    }
    return {
      state: "cooldown",
      cooldown_until: cooldownUntil,
      operator_confirmed_at: null,
      single_probe_required: true,
      single_probe_passed_at: null,
      probe_run_id: null,
      full_bundle_blocked: true,
      reason_codes: [
        asString(event?.reason) ??
          asString(windowState?.last_event_id) ??
          "PERSISTED_SESSION_RHYTHM_PAUSED"
      ]
    };
  } catch (error) {
    if (error instanceof RuntimeStoreError) {
      throw new CliError("ERR_RUNTIME_UNAVAILABLE", `运行记录存储失败: ${error.code}`, {
        retryable: error.code !== "ERR_RUNTIME_STORE_SCHEMA_MISMATCH",
        cause: error
      });
    }
    throw error;
  } finally {
    try {
      store?.close();
    } catch {
      // Read-only preflight best-effort close.
    }
  }
};

const asInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
};

const hasOwn = (record: Record<string, unknown> | undefined | null, key: string): boolean =>
  !!record && Object.prototype.hasOwnProperty.call(record, key);

const LIVE_XHS_EXECUTION_MODES = new Set<XhsExecutionMode>([
  "live_read_limited",
  "live_read_high_risk",
  "live_write"
]);

const isLiveXhsExecutionMode = (mode: XhsExecutionMode): boolean =>
  LIVE_XHS_EXECUTION_MODES.has(mode);

const isLiveXhsReadExecutionMode = (mode: XhsExecutionMode): boolean =>
  mode === "live_read_limited" || mode === "live_read_high_risk";

const XHS_CLOSEOUT_ROUTE_EVIDENCE_ABILITY_IDS = new Set<string>([
  "xhs.note.search.v1",
  "xhs.note.detail.v1",
  "xhs.user.home.v1"
]);

const ACCOUNT_SAFETY_REASON_ALIASES: Record<string, AccountSafetyReason> = {
  SESSION_EXPIRED: "SESSION_EXPIRED",
  XHS_LOGIN_REQUIRED: "XHS_LOGIN_REQUIRED",
  LOGIN_REQUIRED: "XHS_LOGIN_REQUIRED",
  ACCOUNT_ABNORMAL: "ACCOUNT_ABNORMAL",
  XHS_ACCOUNT_RISK_PAGE: "XHS_ACCOUNT_RISK_PAGE",
  CAPTCHA_REQUIRED: "CAPTCHA_REQUIRED",
  SECURITY_REDIRECT: "XHS_ACCOUNT_RISK_PAGE",
  BROWSER_ENV_ABNORMAL: "BROWSER_ENV_ABNORMAL"
};

const normalizeAccountSafetyReason = (value: unknown): AccountSafetyReason | null => {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().toUpperCase();
  const mapped = ACCOUNT_SAFETY_REASON_ALIASES[normalized];
  return mapped && isAccountSafetyReason(mapped) ? mapped : null;
};

const closeoutRiskReasonToAccountSafetyReason = (
  reason: CloseoutHardStopRiskReason | null
): AccountSafetyReason | null => {
  if (reason === null) {
    return null;
  }
  const mapped = ACCOUNT_SAFETY_REASON_ALIASES[reason] ?? reason;
  return isAccountSafetyReason(mapped) ? mapped : null;
};

const pickCanonicalSummaryField = (
  payload: Record<string, unknown>,
  key: "request_admission_result" | "execution_audit"
): JsonObject | null | undefined => {
  const summary = asObject(payload.summary);
  const summaryValue = hasOwn(summary ?? undefined, key) ? summary?.[key] : undefined;
  if (payload[key] === null) {
    const summaryObject = asObject(summaryValue);
    if (summaryObject) {
      return summaryObject;
    }
  }
  const value = hasOwn(payload, key)
    ? payload[key]
    : hasOwn(summary ?? undefined, key)
      ? summaryValue
      : undefined;
  if (!hasOwn(payload, key) && !hasOwn(summary ?? undefined, key)) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return asObject(value) ?? undefined;
};

const hasExplicitCloseoutEvidencePayloadMarker = (
  record: JsonObject | null | undefined
): boolean =>
  hasUsableIndependentCloseoutEvidencePayload(record) ||
  hasOwn(record, "closeout_route_evidence");

const hasIndependentCloseoutEvidencePayloadMarker = (
  record: JsonObject | null | undefined
): boolean =>
  hasOwn(record, "closeout_evidence_input") ||
  hasOwn(record, "closeout_evidence_expected") ||
  hasOwn(record, "closeout_evidence_rounds");

const hasUsableIndependentCloseoutEvidencePayload = (
  record: JsonObject | null | undefined
): boolean => {
  const closeoutEvidenceInput = asObject(record?.closeout_evidence_input);
  return (
    (closeoutEvidenceInput !== null &&
      (asObject(closeoutEvidenceInput.expected) !== null ||
        asObject(closeoutEvidenceInput.evidence) !== null ||
        toCloseoutEvidenceRoundRecords(closeoutEvidenceInput.evidence_rounds) !== null)) ||
    asObject(record?.closeout_evidence_expected) !== null ||
    toCloseoutEvidenceRoundRecords(record?.closeout_evidence_rounds) !== null
  );
};

const hasCompleteIndependentCloseoutEvidencePayload = (
  record: JsonObject | null | undefined
): boolean => {
  const closeoutEvidenceInput = asObject(record?.closeout_evidence_input);
  const hasExpected =
    asObject(closeoutEvidenceInput?.expected) !== null ||
    asObject(record?.closeout_evidence_expected) !== null;
  const hasRounds =
    toCloseoutEvidenceRoundRecords(closeoutEvidenceInput?.evidence_rounds) !== null ||
    toCloseoutEvidenceRoundRecords(record?.closeout_evidence_rounds) !== null;
  return hasExpected && hasRounds;
};

const hasExplicitCloseoutProductionAuditMarker = (record: JsonObject | null | undefined): boolean =>
  record?.closeout_audit_required === true ||
  hasOwn(record, "closeout_readiness") ||
  (asObject(record?.closeout_evidence_evaluation) !== null &&
    (!hasIndependentCloseoutEvidencePayloadMarker(record) ||
      asObject(record?.request_admission_result) !== null ||
      asObject(record?.execution_audit) !== null));

const CLOSEOUT_EVIDENCE_SUMMARY_FIELDS = [
  "closeout_evidence_input",
  "closeout_evidence_expected",
  "closeout_evidence_rounds",
  "closeout_route_evidence",
  "route_evidence"
] as const;

const CLOSEOUT_BINDING_FIELD_KEYS = new Set([
  "latest_head_sha",
  "run_id",
  "artifact_identity",
  "artifact_identities",
  "profile_ref",
  "target_tab_id",
  "page_url",
  "action_ref"
]);

const isSparseCloseoutSummaryField = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  const object = asObject(value);
  if (object === null) {
    return false;
  }
  const values = Object.values(object);
  return (
    values.length === 0 ||
    values.every(
      (item) =>
        item === null ||
        item === undefined ||
        isSparseCloseoutSummaryField(item)
    )
  );
};

const scoreCloseoutSummaryFieldQuality = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + scoreCloseoutSummaryFieldQuality(item), 0);
  }
  const object = asObject(value);
  if (object === null) {
    return 1;
  }
  return Object.values(object).reduce<number>(
    (total, item) => total + scoreCloseoutSummaryFieldQuality(item),
    0
  );
};

const isRicherCloseoutSummaryField = (rootValue: unknown, summaryValue: unknown): boolean => {
  if (summaryValue === null || summaryValue === undefined || isSparseCloseoutSummaryField(summaryValue)) {
    return false;
  }
  if (isSparseCloseoutSummaryField(rootValue)) {
    return true;
  }
  if (Array.isArray(summaryValue)) {
    if (!Array.isArray(rootValue) || summaryValue.length > rootValue.length) {
      return true;
    }
    return (
      summaryValue.length === rootValue.length &&
      scoreCloseoutSummaryFieldQuality(summaryValue) > scoreCloseoutSummaryFieldQuality(rootValue)
    );
  }
  const rootObject = asObject(rootValue);
  const summaryObject = asObject(summaryValue);
  if (!rootObject || !summaryObject) {
    return false;
  }
  return Object.entries(summaryObject).some(([key, value]) => {
    if (value === null || value === undefined || isSparseCloseoutSummaryField(value)) {
      return false;
    }
    if (!hasOwn(rootObject, key)) {
      return true;
    }
    return isRicherCloseoutSummaryField(rootObject[key], value);
  });
};

const pickCloseoutSummaryFieldValue = (rootValue: unknown, summaryValue: unknown): unknown => {
  if (
    summaryValue !== null &&
    summaryValue !== undefined &&
    (rootValue === undefined ||
      rootValue === null ||
      isSparseCloseoutSummaryField(rootValue) ||
      isRicherCloseoutSummaryField(rootValue, summaryValue))
  ) {
    return summaryValue;
  }
  return rootValue;
};

const mergeCloseoutEvidenceRoundRecordValues = (
  rootValue: unknown,
  summaryValue: unknown
): unknown[] | null => {
  const rootRounds = Array.isArray(rootValue) && rootValue.length > 0 ? rootValue : [];
  const summaryRounds = Array.isArray(summaryValue) && summaryValue.length > 0 ? summaryValue : [];
  if (rootRounds.length === 0 && summaryRounds.length === 0) {
    return null;
  }
  return [...rootRounds, ...summaryRounds];
};

const mergeCloseoutArrayValues = (rootValue: unknown, summaryValue: unknown): unknown[] | null => {
  if (!Array.isArray(rootValue) || !Array.isArray(summaryValue)) {
    return null;
  }
  if (rootValue.length === 0 && summaryValue.length === 0) {
    return null;
  }
  if (rootValue.length === 0) {
    return summaryValue;
  }
  if (summaryValue.length === 0) {
    return rootValue;
  }
  if (isRicherCloseoutSummaryField(rootValue, summaryValue)) {
    return summaryValue;
  }
  const seen = new Set<string>();
  return [...rootValue, ...summaryValue].filter((item) => {
    const key = typeof item === "string" ? item : JSON.stringify(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const mergeCloseoutSummaryObjectField = (
  rootValue: unknown,
  summaryValue: unknown,
  options: { preferSummaryBindings?: boolean } = {}
): JsonObject | null => {
  const rootObject = asObject(rootValue);
  const summaryObject = asObject(summaryValue);
  if (!rootObject || !summaryObject) {
    return null;
  }
  const merged: JsonObject = {};
  for (const [key, value] of Object.entries(rootObject)) {
    if (value !== null && value !== undefined && !isSparseCloseoutSummaryField(value)) {
      merged[key] = value;
    }
  }
  for (const key of Object.keys(summaryObject)) {
    const rootField = hasOwn(rootObject, key) ? rootObject[key] : undefined;
    const summaryField = summaryObject[key];
    if (
      options.preferSummaryBindings !== false &&
      CLOSEOUT_BINDING_FIELD_KEYS.has(key) &&
      summaryField !== null &&
      summaryField !== undefined &&
      !isSparseCloseoutSummaryField(summaryField)
    ) {
      merged[key] = summaryField;
      continue;
    }
    if (key === "evidence_rounds") {
      const mergedRounds = mergeCloseoutEvidenceRoundRecordValues(rootField, summaryField);
      if (mergedRounds) {
        merged[key] = mergedRounds;
        continue;
      }
    }
    const mergedArray = mergeCloseoutArrayValues(rootField, summaryField);
    if (mergedArray) {
      merged[key] = mergedArray;
      continue;
    }
    const mergedObject = mergeCloseoutSummaryObjectField(rootField, summaryField, options);
    if (mergedObject) {
      merged[key] = mergedObject;
      continue;
    }
    const picked = pickCloseoutSummaryFieldValue(rootField, summaryField);
    if (picked !== undefined) {
      merged[key] = picked;
    }
  }
  return merged;
};

const mergeCloseoutEvidenceInputSummaryField = (
  rootValue: unknown,
  summaryValue: unknown
): JsonObject | null => {
  return mergeCloseoutSummaryObjectField(rootValue, summaryValue, {
    preferSummaryBindings: false
  });
};

export const pickXhsCloseoutEvidenceSummaryFieldsForContract = (payload: JsonObject): JsonObject => {
  const summary = asObject(payload.summary);
  const picked: JsonObject = {};
  for (const key of CLOSEOUT_EVIDENCE_SUMMARY_FIELDS) {
    if (key === "closeout_evidence_input" && hasOwn(payload, key) && hasOwn(summary ?? undefined, key)) {
      const mergedInput = mergeCloseoutEvidenceInputSummaryField(payload[key], summary?.[key]);
      if (mergedInput) {
        picked[key] = mergedInput;
        continue;
      }
    }
    if (key === "closeout_evidence_rounds" && hasOwn(payload, key) && hasOwn(summary ?? undefined, key)) {
      const mergedRounds = mergeCloseoutArrayValues(payload[key], summary?.[key]);
      if (mergedRounds) {
        picked[key] = mergedRounds;
        continue;
      }
    }
    if (hasOwn(payload, key) && hasOwn(summary ?? undefined, key)) {
      const mergedObject = mergeCloseoutSummaryObjectField(payload[key], summary?.[key]);
      if (mergedObject) {
        picked[key] = mergedObject;
        continue;
      }
    }
    if (
      hasOwn(payload, key) &&
      hasOwn(summary ?? undefined, key) &&
      summary?.[key] !== null &&
      summary?.[key] !== undefined &&
      (isSparseCloseoutSummaryField(payload[key]) ||
        isRicherCloseoutSummaryField(payload[key], summary[key]))
    ) {
      picked[key] = summary[key];
      continue;
    }
    if (hasOwn(payload, key) && payload[key] !== null && payload[key] !== undefined) {
      picked[key] = payload[key];
      continue;
    }
    if (hasOwn(payload, key) && payload[key] === null) {
      if (hasOwn(summary ?? undefined, key) && summary?.[key] !== null && summary?.[key] !== undefined) {
        picked[key] = summary[key];
        continue;
      }
      picked[key] = null;
      continue;
    }
    if (hasOwn(summary ?? undefined, key)) {
      picked[key] = summary?.[key];
    }
  }
  return picked;
};

const isCloseoutPrimaryApiSuccessRoute = (record: JsonObject | null | undefined): boolean => {
  const routeRole = asString(record?.route_role);
  const pathKind = asString(record?.path_kind);
  const evidenceStatus = asString(record?.evidence_status);
  return routeRole === "primary" && pathKind === "api" && evidenceStatus === "success";
};

const asStringArray = (value: unknown): string[] | null =>
  Array.isArray(value)
    ? value
        .map((item) => asString(item))
        .filter((item): item is string => item !== null)
    : null;

const normalizeCloseoutProfileRef = (value: string | null | undefined): string | null => {
  const profileRef = asString(value);
  if (profileRef === null) {
    return null;
  }
  return profileRef.startsWith("profile/") ? profileRef : `profile/${profileRef}`;
};

const toCloseoutEvidenceExpected = (
  record: JsonObject | null | undefined
): EvaluateCloseoutEvidenceInput["expected"] | null => {
  if (!record) {
    return null;
  }
  return {
    latest_head_sha: asString(record.latest_head_sha),
    run_id: asString(record.run_id),
    artifact_identity: asString(record.artifact_identity),
    artifact_identities: asStringArray(record.artifact_identities),
    profile_ref: normalizeCloseoutProfileRef(asString(record.profile_ref)),
    target_tab_id: asInteger(record.target_tab_id),
    page_url: asString(record.page_url),
    action_ref: asString(record.action_ref)
  };
};

const toCloseoutEvidenceRound = (
  record: JsonObject | null | undefined
): EvaluateCloseoutEvidenceInput["evidence"] | null => {
  if (!record) {
    return null;
  }
  return {
    route_role: asString(record.route_role),
    path_kind: asString(record.path_kind),
    evidence_status: asString(record.evidence_status),
    evidence_class: asString(record.evidence_class ?? record.route_evidence_class),
    reproduced_multi_round: record.reproduced_multi_round === true,
    head_sha: asString(record.head_sha),
    run_id: asString(record.run_id),
    artifact_identity: asString(record.artifact_identity),
    profile_ref: normalizeCloseoutProfileRef(asString(record.profile_ref)),
    target_tab_id: asInteger(record.target_tab_id),
    page_url: asString(record.page_url),
    action_ref: asString(record.action_ref)
  };
};

const selectCloseoutEvidenceRound = (
  expected: EvaluateCloseoutEvidenceInput["expected"] | null,
  roundRecords: unknown[] | null
): EvaluateCloseoutEvidenceInput["evidence"] | null => {
  if (!roundRecords) {
    return null;
  }
  let firstCompleteRound: EvaluateCloseoutEvidenceInput["evidence"] | null = null;
  for (const roundRecord of roundRecords) {
    const round = toCloseoutEvidenceRound(asObject(roundRecord));
    if (!isCompleteCloseoutEvidenceRound(round)) {
      continue;
    }
    firstCompleteRound ??= round;
    if (closeoutEvidenceMatchesExpected(expected, round)) {
      return round;
    }
  }
  return firstCompleteRound;
};

const isCompleteCloseoutEvidenceExpected = (
  expected: EvaluateCloseoutEvidenceInput["expected"] | null
): expected is EvaluateCloseoutEvidenceInput["expected"] =>
  !!expected &&
  expected.latest_head_sha !== null &&
  expected.run_id !== null &&
  (expected.artifact_identity !== null ||
    (Array.isArray(expected.artifact_identities) && expected.artifact_identities.length > 0)) &&
  expected.profile_ref !== null &&
  expected.target_tab_id !== null &&
  expected.page_url !== null &&
  expected.action_ref !== null;

const isCompleteCloseoutEvidenceRound = (
  evidence: EvaluateCloseoutEvidenceInput["evidence"] | null
): evidence is EvaluateCloseoutEvidenceInput["evidence"] =>
  !!evidence &&
  evidence.route_role !== null &&
  evidence.path_kind !== null &&
  evidence.evidence_status !== null &&
  evidence.evidence_class !== null &&
  evidence.head_sha !== null &&
  evidence.run_id !== null &&
  evidence.artifact_identity !== null &&
  evidence.profile_ref !== null &&
  evidence.target_tab_id !== null &&
    evidence.page_url !== null &&
    evidence.action_ref !== null;

const closeoutEvidenceMatchesExpected = (
  expected: EvaluateCloseoutEvidenceInput["expected"] | null,
  evidence: EvaluateCloseoutEvidenceInput["evidence"] | null
): boolean => {
  if (!isCompleteCloseoutEvidenceExpected(expected) || !isCompleteCloseoutEvidenceRound(evidence)) {
    return false;
  }
  const expectedArtifactIdentities =
    Array.isArray(expected.artifact_identities) && expected.artifact_identities.length > 0
      ? expected.artifact_identities
      : expected.artifact_identity === null
        ? []
        : [expected.artifact_identity];
  const observedArtifactIdentity = asString(evidence.artifact_identity);
  return (
    expected.latest_head_sha === evidence.head_sha &&
    expected.run_id === evidence.run_id &&
    observedArtifactIdentity !== null &&
    expectedArtifactIdentities.includes(observedArtifactIdentity) &&
    expected.profile_ref === evidence.profile_ref &&
    expected.target_tab_id === evidence.target_tab_id &&
    expected.page_url === evidence.page_url &&
    expected.action_ref === evidence.action_ref
  );
};

const fillMissingTrustedExpectedBinding = (
  expected: EvaluateCloseoutEvidenceInput["expected"] | null,
  trusted?: CloseoutEvidenceTrustedExpectedBinding | null
): EvaluateCloseoutEvidenceInput["expected"] | null => {
  if (!expected) {
    return null;
  }
  return {
    ...expected,
    latest_head_sha: expected.latest_head_sha ?? asString(trusted?.latestHeadSha),
    run_id: expected.run_id ?? asString(trusted?.runId),
    profile_ref: expected.profile_ref ?? normalizeCloseoutProfileRef(trusted?.profileRef),
    target_tab_id: expected.target_tab_id ?? asInteger(trusted?.targetTabId)
  };
};

interface CloseoutEvidenceTrustedExpectedBinding {
  latestHeadSha?: string | null;
  runId?: string | null;
  profileRef?: string | null;
  targetTabId?: number | null;
}

export const resolveXhsCloseoutRuntimeLatestHeadShaForContract = (cwd: string): string | null => {
  const envHeadSha = asString(process.env.WEBENVOY_CLOSEOUT_LATEST_HEAD_SHA);
  if (envHeadSha !== null) {
    return envHeadSha;
  }
  const packageEnvHeadSha =
    asString(process.env.WEBENVOY_RUNTIME_LATEST_HEAD_SHA) ??
    asString(process.env.npm_package_gitHead);
  if (packageEnvHeadSha !== null) {
    return packageEnvHeadSha;
  }
  const cwdPackageHead = resolvePackageGitHeadForCwd(cwd);
  if (cwdPackageHead !== null) {
    return cwdPackageHead;
  }
  const runtimePackageHead = resolvePackageGitHeadForCwd(WEBENVOY_RUNTIME_ROOT);
  if (runtimePackageHead !== null) {
    return runtimePackageHead;
  }
  const cwdGitHead = resolveGitHeadForCwd(cwd);
  if (cwdGitHead && isWebEnvoyCheckoutRoot(cwdGitHead.root)) {
    return cwdGitHead.head;
  }
  const runtimeGitHead = resolveGitHeadForCwd(WEBENVOY_RUNTIME_ROOT);
  return runtimeGitHead?.head ?? null;
};

export const buildXhsCloseoutEvidenceTrustedBindingForContract = (input: {
  cwd: string;
  runId: string;
  profileRef?: string | null;
  targetTabId?: number | null;
  summary: JsonObject;
}): CloseoutEvidenceTrustedExpectedBinding => {
  const requiresCloseoutEvidenceEvaluation = requiresCloseoutEvidenceEvaluationForRuntime(input.summary);
  const latestHeadSha = requiresCloseoutEvidenceEvaluation
    ? resolveXhsCloseoutRuntimeLatestHeadShaForContract(input.cwd)
    : null;
  return {
    ...(requiresCloseoutEvidenceEvaluation && latestHeadSha !== null ? { latestHeadSha } : {}),
    runId: input.runId,
    profileRef: normalizeCloseoutProfileRef(input.profileRef),
    targetTabId: input.targetTabId
  };
};

const toCloseoutEvidenceRoundRecords = (records: unknown): unknown[] | null => {
  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }
  return records;
};

const unionCloseoutEvidenceRoundRecords = (
  ...recordGroups: Array<unknown[] | null>
): unknown[] | null => {
  const records = recordGroups.flatMap((recordGroup) => recordGroup ?? []);
  return records.length > 0 ? records : null;
};

const buildCloseoutEvidenceInputForRuntime = (
  summary: JsonObject,
  trustedExpectedBinding?: CloseoutEvidenceTrustedExpectedBinding | null
): EvaluateCloseoutEvidenceInput | null => {
  const explicitInput = asObject(summary.closeout_evidence_input);
  const routeEvidence =
    asObject(summary.closeout_route_evidence) ?? asObject(summary.route_evidence);
  const routeEvidenceRequiresCloseout = isCloseoutPrimaryApiSuccessRoute(routeEvidence);
  const explicitRoundRecords = toCloseoutEvidenceRoundRecords(explicitInput?.evidence_rounds);
  const summaryRoundRecords = toCloseoutEvidenceRoundRecords(summary.closeout_evidence_rounds);
  const routeRoundRecords = toCloseoutEvidenceRoundRecords(routeEvidence?.evidence_rounds);
  const roundRecords = unionCloseoutEvidenceRoundRecords(
    explicitRoundRecords,
    summaryRoundRecords,
    routeRoundRecords
  );
  const routeEvidenceRound = toCloseoutEvidenceRound(routeEvidence);
  const trustedExpectedBindingInput = {
    ...(trustedExpectedBinding ?? {})
  };
  const explicitExpectedCandidate = toCloseoutEvidenceExpected(asObject(explicitInput?.expected));
  const summaryExpectedCandidate = toCloseoutEvidenceExpected(
    asObject(summary.closeout_evidence_expected)
  );
  const explicitExpectedCandidateWithTrustedRun = fillMissingTrustedExpectedBinding(
    explicitExpectedCandidate,
    trustedExpectedBindingInput
  );
  const summaryExpectedCandidateWithTrustedRun = fillMissingTrustedExpectedBinding(
    summaryExpectedCandidate,
    trustedExpectedBindingInput
  );
  const explicitExpected = isCompleteCloseoutEvidenceExpected(explicitExpectedCandidateWithTrustedRun)
    ? explicitExpectedCandidateWithTrustedRun
    : null;
  const summaryExpected = isCompleteCloseoutEvidenceExpected(summaryExpectedCandidateWithTrustedRun)
    ? summaryExpectedCandidateWithTrustedRun
    : null;
  const expected = explicitExpected ?? summaryExpected;
  const explicitExpectedBinding = explicitExpected !== null || summaryExpected !== null;
  const routeEvidenceCanProvideRound =
    routeEvidenceRequiresCloseout &&
    roundRecords !== null &&
    isCompleteCloseoutEvidenceExpected(expected) &&
    closeoutEvidenceMatchesExpected(expected, routeEvidenceRound);
  const selectedEvidenceRound = selectCloseoutEvidenceRound(expected, roundRecords);
  const firstParsedEvidenceRound = roundRecords
    ? toCloseoutEvidenceRound(asObject(roundRecords[0]) ?? {})
    : null;
  const firstEvidenceRoundCanProvideRound =
    roundRecords !== null &&
    isCompleteCloseoutEvidenceExpected(expected) &&
    isCompleteCloseoutEvidenceRound(selectedEvidenceRound);
  const deterministicRoundsCanProvideEvidence =
    firstEvidenceRoundCanProvideRound && (roundRecords?.length ?? 0) >= 2;
  const canonicalEvidenceRoundCanProvideRound =
    firstEvidenceRoundCanProvideRound &&
    expected !== null &&
    selectedEvidenceRound !== null &&
    expected.artifact_identity !== null &&
    selectedEvidenceRound.artifact_identity === expected.artifact_identity;
  const explicitEvidenceCandidate = toCloseoutEvidenceRound(asObject(explicitInput?.evidence));
  const explicitEvidence = isCompleteCloseoutEvidenceRound(explicitEvidenceCandidate)
    ? explicitEvidenceCandidate
    : null;
  const evidence =
    explicitEvidence ??
    (deterministicRoundsCanProvideEvidence && canonicalEvidenceRoundCanProvideRound
      ? selectedEvidenceRound
      : null) ??
    (expected?.artifact_identity === null && deterministicRoundsCanProvideEvidence
      ? selectedEvidenceRound
      : null) ??
    (routeEvidenceCanProvideRound ? routeEvidenceRound : null) ??
    (explicitExpectedBinding && deterministicRoundsCanProvideEvidence ? selectedEvidenceRound : null) ??
    (firstEvidenceRoundCanProvideRound ? selectedEvidenceRound : null) ??
    explicitEvidence ??
    (roundRecords !== null ? firstParsedEvidenceRound : null);
  if (!expected || !evidence) {
    return null;
  }

  const evidenceRounds: EvaluateCloseoutEvidenceInput["evidence"][] | null = roundRecords
    ? []
    : null;
  if (roundRecords && evidenceRounds) {
    for (const roundRecord of roundRecords) {
      const round = toCloseoutEvidenceRound(asObject(roundRecord) ?? {});
      if (!round) {
        return null;
      }
      evidenceRounds.push(round);
    }
  }

  return {
    expected,
    evidence,
    ...(evidenceRounds ? { evidence_rounds: evidenceRounds } : {})
  };
};

const requiresCloseoutEvidenceEvaluationForRuntime = (summary: JsonObject): boolean => {
  if (hasUsableIndependentCloseoutEvidencePayload(summary)) {
    return true;
  }
  const routeEvidence =
    asObject(summary.closeout_route_evidence) ?? asObject(summary.route_evidence);
  return (
    hasExplicitCloseoutProductionAuditMarker(summary) &&
    isCloseoutPrimaryApiSuccessRoute(routeEvidence)
  );
};

const isLegacyCloseoutEvidenceEvaluationCompatOnly = (
  summary: JsonObject,
  evaluation: ReturnType<typeof evaluateCloseoutEvidence>
): boolean =>
  !hasCompleteIndependentCloseoutEvidencePayload(summary) &&
  evaluation.blockers.some(
    (blockerItem) => blockerItem.blocker_code === "missing_multi_round_evidence"
  );

const missingCloseoutEvidenceEvaluation = (): ReturnType<typeof evaluateCloseoutEvidence> => ({
  decision: "FAIL",
  passed: false,
  blockers: [
    {
      blocker_code: "missing_multi_round_evidence",
      blocker_layer: "route",
      message: "closeout evidence input is missing or cannot be parsed"
    }
  ],
  evaluated_route: "unknown_route:unknown_path:unknown_class:unknown_status",
  route_role: null,
  path_kind: null,
  evidence_status: null,
  evidence_class: null,
  reproduced_multi_round: false,
  freshness: {
    latest_head_available: false,
    latest_head_matches: false,
    run_matches: false,
    artifact_matches: false,
    expected_latest_head_sha: null,
    observed_head_sha: null,
    expected_run_id: null,
    observed_run_id: null,
    expected_artifact_identity: null,
    expected_artifact_identities: [],
    accepted_artifact_identities: [],
    observed_artifact_identity: null
  },
  bindings: {
    profile_bound: false,
    tab_bound: false,
    page_bound: false,
    action_bound: false,
    expected_profile_ref: null,
    observed_profile_ref: null,
    expected_target_tab_id: null,
    observed_target_tab_id: null,
    expected_page_url: null,
    observed_page_url: null,
    expected_action_ref: null,
    observed_action_ref: null
  },
  multi_round: {
    accepted_round_count: 0,
    unique_artifact_count: 0,
    expected_artifact_observed: false
  }
});

export const evaluateXhsCloseoutEvidenceForContract = (
  summary: JsonObject,
  options?: CloseoutEvidenceTrustedExpectedBinding
): ReturnType<typeof evaluateCloseoutEvidence> | null => {
  const input = buildCloseoutEvidenceInputForRuntime(summary, options);
  if (input) {
    return applyTrustedExpectedBindingCheck(evaluateCloseoutEvidence(input), options);
  }
  return requiresCloseoutEvidenceEvaluationForRuntime(summary)
    ? missingCloseoutEvidenceEvaluation()
    : null;
};

const applyTrustedExpectedBindingCheck = (
  evaluation: ReturnType<typeof evaluateCloseoutEvidence>,
  trusted?: CloseoutEvidenceTrustedExpectedBinding | null
): ReturnType<typeof evaluateCloseoutEvidence> => {
  const blockers = [...evaluation.blockers];
  const trustedLatestHeadSha = asString(trusted?.latestHeadSha);
  const trustedRunId = asString(trusted?.runId);
  const trustedProfileRef = normalizeCloseoutProfileRef(trusted?.profileRef);
  const trustedTargetTabId = asInteger(trusted?.targetTabId);
  let freshness = evaluation.freshness;
  let bindings = evaluation.bindings;

  if (
    trustedLatestHeadSha !== null &&
    evaluation.freshness.expected_latest_head_sha !== trustedLatestHeadSha
  ) {
    freshness = {
      ...freshness,
      latest_head_matches: false
    };
    pushUniqueCloseoutEvaluationBlocker(
      blockers,
      closeoutEvaluationBlocker(
        "stale_head",
        "freshness",
        "closeout expected head must match the runtime head"
      )
    );
  }

  if (trustedRunId !== null && evaluation.freshness.expected_run_id !== trustedRunId) {
    freshness = {
      ...freshness,
      run_matches: false
    };
    pushUniqueCloseoutEvaluationBlocker(
      blockers,
      closeoutEvaluationBlocker(
        "stale_run",
        "freshness",
        "closeout expected run must match the runtime run"
      )
    );
  }

  if (trustedProfileRef !== null && evaluation.bindings.expected_profile_ref !== trustedProfileRef) {
    bindings = {
      ...bindings,
      profile_bound: false
    };
    pushUniqueCloseoutEvaluationBlocker(
      blockers,
      closeoutEvaluationBlocker(
        "missing_profile_binding",
        "binding",
        "closeout expected profile must match the runtime profile"
      )
    );
  }

  if (
    trustedTargetTabId !== null &&
    evaluation.bindings.expected_target_tab_id !== trustedTargetTabId
  ) {
    bindings = {
      ...bindings,
      tab_bound: false
    };
    pushUniqueCloseoutEvaluationBlocker(
      blockers,
      closeoutEvaluationBlocker(
        "missing_tab_binding",
        "binding",
        "closeout expected tab must match the runtime target tab"
      )
    );
  }

  if (blockers.length === evaluation.blockers.length) {
    return evaluation;
  }

  return {
    ...evaluation,
    decision: "FAIL",
    passed: false,
    blockers,
    freshness,
    bindings
  };
};

const closeoutEvaluationBlocker = (
  blocker_code: ReturnType<typeof evaluateCloseoutEvidence>["blockers"][number]["blocker_code"],
  blocker_layer: ReturnType<typeof evaluateCloseoutEvidence>["blockers"][number]["blocker_layer"],
  message: string
): ReturnType<typeof evaluateCloseoutEvidence>["blockers"][number] => ({
  blocker_code,
  blocker_layer,
  message
});

const pushUniqueCloseoutEvaluationBlocker = (
  blockers: ReturnType<typeof evaluateCloseoutEvidence>["blockers"],
  nextBlocker: ReturnType<typeof evaluateCloseoutEvidence>["blockers"][number]
): void => {
  if (blockers.some((existingBlocker) => existingBlocker.blocker_code === nextBlocker.blocker_code)) {
    return;
  }
  blockers.push(nextBlocker);
};

const assertCloseoutEvidenceForRuntime = (
  ability: AbilityRef,
  trustedExpectedBinding: CloseoutEvidenceTrustedExpectedBinding,
  summary: JsonObject
): void => {
  const evaluation = evaluateXhsCloseoutEvidenceForContract(summary, trustedExpectedBinding);
  if (!evaluation) {
    return;
  }
  summary.closeout_evidence_evaluation = evaluation;
  if (evaluation.passed) {
    return;
  }
  if (isLegacyCloseoutEvidenceEvaluationCompatOnly(summary, evaluation)) {
    summary.closeout_evidence_compat_mode = "legacy_route_evidence_non_blocking";
    return;
  }
  throw new CliError("ERR_EXECUTION_FAILED", "XHS closeout evidence evaluation invalid", {
    retryable: false,
    details: {
      ability_id: ability.id,
      stage: "execution",
      reason: "CLOSEOUT_EVIDENCE_EVALUATION_INVALID",
      run_id: trustedExpectedBinding.runId,
      closeout_evidence_evaluation: evaluation,
      ...(asObject(summary.execution_audit) ? { execution_audit: summary.execution_audit } : {})
    }
  });
};

const isXhsLiveRouteEvidenceForCloseoutAudit = (
  record: JsonObject | null | undefined
): boolean =>
  isCloseoutPrimaryApiSuccessRoute(record) ||
  asString(record?.route_evidence_class) === "passive_api_capture" ||
  asString(record?.evidence_class) === "passive_api_capture";

const hasCloseoutRouteEvaluationMarker = (record: JsonObject | null | undefined): boolean => {
  if (
    asObject(record?.closeout_evidence_evaluation) &&
    !hasIndependentCloseoutEvidencePayloadMarker(record)
  ) {
    return true;
  }

  if (
    isCloseoutPrimaryApiSuccessRoute(record) &&
    (hasOwn(record, "closeout_evidence") || hasOwn(record, "closeout_evidence_evaluation"))
  ) {
    return true;
  }

  const routeEvidenceEvaluation = asObject(record?.route_evidence_evaluation);
  if (isCloseoutPrimaryApiSuccessRoute(routeEvidenceEvaluation)) {
    return true;
  }

  const routeEvidence =
    asObject(record?.closeout_route_evidence) ?? asObject(record?.route_evidence);
  return (
    hasExplicitCloseoutProductionAuditMarker(record) &&
    isCloseoutPrimaryApiSuccessRoute(routeEvidence)
  );
};

export const requiresCanonicalExecutionAuditForContract = (input: {
  payload?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  details?: JsonObject | null;
}): boolean => {
  const payload = asObject(input.payload);
  const summary = asObject(input.summary) ?? asObject(payload?.summary);
  const details = asObject(input.details);
  return [payload, summary, details].some(
    (record) => hasExplicitCloseoutProductionAuditMarker(record) || hasCloseoutRouteEvaluationMarker(record)
  );
};

export const shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract = (input: {
  abilityId: string;
  requestedExecutionMode: XhsExecutionMode;
  summary?: Record<string, unknown> | null;
}): boolean => {
  const summary = asObject(input.summary);
  const closeoutRouteEvidence = asObject(summary?.closeout_route_evidence);
  const legacyRouteEvidence = asObject(summary?.route_evidence);
  return (
    XHS_CLOSEOUT_ROUTE_EVIDENCE_ABILITY_IDS.has(input.abilityId) &&
    isLiveXhsReadExecutionMode(input.requestedExecutionMode) &&
    (isXhsLiveRouteEvidenceForCloseoutAudit(closeoutRouteEvidence) ||
      isXhsLiveRouteEvidenceForCloseoutAudit(legacyRouteEvidence))
  );
};

export const requiresCloseoutAuditForXhsBridgeSummaryForContract = (input: {
  abilityId: string;
  requestedExecutionMode: XhsExecutionMode;
  summary?: Record<string, unknown> | null;
}): boolean => {
  const summary = asObject(input.summary);
  return (
    hasExplicitCloseoutProductionAuditMarker(summary) ||
    shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
      abilityId: input.abilityId,
      requestedExecutionMode: input.requestedExecutionMode,
      summary
    })
  );
};

const markCloseoutAuditRequiredForXhsLiveRouteEvidence = (input: {
  abilityId: string;
  requestedExecutionMode: XhsExecutionMode;
  payload: JsonObject;
}): void => {
  const closeoutEvidenceSummaryFields = pickXhsCloseoutEvidenceSummaryFieldsForContract(
    input.payload
  );
  const summary = asObject(input.payload.summary);
  const mergedSummary = {
    ...(summary ?? {}),
    ...closeoutEvidenceSummaryFields
  };
  if (
    !requiresCloseoutAuditForXhsBridgeSummaryForContract({
      abilityId: input.abilityId,
      requestedExecutionMode: input.requestedExecutionMode,
      summary: mergedSummary
    })
  ) {
    return;
  }
  if (summary) {
    Object.assign(summary, closeoutEvidenceSummaryFields);
    summary.closeout_audit_required = true;
    return;
  }
  input.payload.summary = {
    ...closeoutEvidenceSummaryFields,
    closeout_audit_required: true
  };
};

const markCloseoutAuditRequired = (payload: JsonObject): void => {
  const summary = asObject(payload.summary);
  if (summary) {
    summary.closeout_audit_required = true;
    return;
  }
  payload.summary = {
    closeout_audit_required: true
  };
};

const markCloseoutAuditRequiredWhenCanonicalAuditExists = (payload: JsonObject): void => {
  if (!asObject(payload.execution_audit) && !asObject(asObject(payload.summary)?.execution_audit)) {
    return;
  }
  markCloseoutAuditRequired(payload);
};

const copyCloseoutCanonicalAuditIntoFailureDetails = (
  payload: Record<string, unknown>,
  details: JsonObject
): void => {
  if (asObject(details.execution_audit)) {
    return;
  }
  const canonicalAudit =
    asObject(payload.execution_audit) ?? asObject(asObject(payload.summary)?.execution_audit);
  if (canonicalAudit) {
    details.execution_audit = canonicalAudit;
  }
};

const assertCloseoutCanonicalExecutionAuditForRuntime = (
  ability: AbilityRef,
  expectedRunId: string,
  input:
    | {
        success: {
          summary: unknown;
          observability?: unknown;
        };
      }
    | {
        failure: {
          payload: Record<string, unknown>;
          details?: JsonObject | null;
          observability?: unknown;
        };
      }
): void => {
  const result =
    "success" in input
      ? verifyCloseoutCanonicalExecutionAudit({
          expectedRunId,
          success: {
            summary: input.success.summary,
            observability: input.success.observability
          }
        })
      : verifyCloseoutCanonicalExecutionAudit({
          expectedRunId,
          failure: {
            error: {
              details: input.failure.details ?? null
            },
            payload: input.failure.payload,
            observability: input.failure.observability
          }
        });
  if (result.passed) {
    return;
  }
  throw new CliError("ERR_EXECUTION_FAILED", "XHS closeout canonical execution audit invalid", {
    retryable: false,
    details: {
      ability_id: ability.id,
      stage: "execution",
      reason: "CLOSEOUT_CANONICAL_EXECUTION_AUDIT_INVALID",
      closeout_canonical_execution_audit: result,
      ...("success" in input && asObject(input.success.summary)?.closeout_evidence_evaluation
        ? {
            closeout_evidence_evaluation: asObject(input.success.summary)
              ?.closeout_evidence_evaluation
          }
        : {}),
      ...("success" in input && asObject(input.success.summary)?.closeout_evidence_compat_mode
        ? {
            closeout_evidence_compat_mode: asObject(input.success.summary)
              ?.closeout_evidence_compat_mode
          }
        : {})
    }
  });
};

const isTransportFailureCode = (code: unknown): code is string =>
  code === "ERR_TRANSPORT_HANDSHAKE_FAILED" ||
  code === "ERR_TRANSPORT_TIMEOUT" ||
  code === "ERR_TRANSPORT_DISCONNECTED" ||
  code === "ERR_TRANSPORT_FORWARD_FAILED" ||
  code === "ERR_TRANSPORT_NOT_READY";

const resolveRuntimeBridge = (): NativeMessagingBridge => {
  if (process.env.WEBENVOY_NATIVE_TRANSPORT === "loopback") {
    return new NativeMessagingBridge({
      transport: createLoopbackNativeBridgeTransport()
    });
  }

  return new NativeMessagingBridge({
    transport: new NativeHostBridgeTransport()
  });
};

const asObservabilityInput = (value: unknown): CommandExecutionResult["observability"] => {
  const object = asObject(value);
  return object ?? undefined;
};

const asDiagnosisInput = (value: unknown): CliError["diagnosis"] => {
  const object = asObject(value);
  return object ?? undefined;
};

const pickGateErrorDetails = (
  payload: Record<string, unknown>,
  details?: JsonObject | null
): JsonObject => {
  const detailKeys = [
    "validation_action",
    "target_page",
    "editor_locator",
    "input_text",
    "before_text",
    "visible_text",
    "post_blur_text",
    "focus_confirmed",
    "preserved_after_blur",
    "success_signals",
    "failure_signals",
    "minimum_replay",
    "out_of_scope_actions",
    "execution_failure",
    "scope_context",
    "gate_input",
    "gate_outcome",
    "read_execution_policy",
    "issue_action_matrix",
    "write_interaction_tier",
    "write_action_matrix_decisions",
    "consumer_gate_result",
    "closeout_audit_required",
    "closeout_evidence_evaluation",
    "closeout_evidence_compat_mode",
    "closeout_readiness",
    "closeout_route_evidence",
    "route_evidence_evaluation",
    "request_admission_result",
    "execution_audit",
    "approval_record",
    "audit_record",
    "risk_state_output",
    "account_safety",
    "xhs_closeout_rhythm",
    "anti_detection_validation_view",
    "runtime_stop",
    "status_code",
    "platform_code"
  ] as const;
  const picked: JsonObject = {};
  const hasOwn = (record: Record<string, unknown> | undefined | null, key: string): boolean =>
    !!record && Object.prototype.hasOwnProperty.call(record, key);
  for (const key of detailKeys) {
    if ((key === "execution_audit" || key === "request_admission_result") && payload[key] === null) {
      const detailsObject = asObject(details?.[key]);
      if (detailsObject) {
        picked[key] = detailsObject;
        continue;
      }
    }
    const value = hasOwn(payload, key)
      ? payload[key]
      : hasOwn(details ?? undefined, key)
        ? details?.[key]
        : undefined;
    if (!hasOwn(payload, key) && !hasOwn(details ?? undefined, key)) {
      continue;
    }
    if (value === null) {
      picked[key] = null;
      continue;
    }
    const object = asObject(value);
    if (object) {
      picked[key] = object;
      continue;
    }
    if (Array.isArray(value)) {
      picked[key] = value;
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      picked[key] = value;
    }
  }
  return picked;
};

const pickCloseoutHardStopResponseBody = (
  payload: Record<string, unknown>,
  details: JsonObject | null
): JsonObject | null =>
  asObject(details?.response_body) ??
  asObject(details?.response) ??
  asObject(payload.response_body) ??
  asObject(payload.response);

const pickCloseoutHardStopPageSurface = (input: {
  payload: Record<string, unknown>;
  details: JsonObject | null;
  observability: JsonObject | null;
}): {
  url?: unknown;
  title?: unknown;
  bodyText?: unknown;
  overlay?: {
    selector?: unknown;
    text?: unknown;
  } | null;
} => {
  const pageState = asObject(input.observability?.page_state);
  const pageSurface =
    asObject(input.details?.page_surface) ??
    asObject(input.payload.page_surface) ??
    asObject(input.observability?.page_surface);
  const overlay =
    asObject(pageSurface?.overlay) ??
    asObject(input.details?.account_safety_overlay) ??
    asObject(input.payload.account_safety_overlay) ??
    asObject(input.observability?.account_safety_overlay);
  return {
    url:
      input.details?.page_url ??
      pageSurface?.url ??
      pageSurface?.href ??
      pageState?.url,
    title: pageSurface?.title ?? pageState?.title,
    bodyText: pageSurface?.body_text ?? pageSurface?.bodyText,
    overlay: overlay
      ? {
          selector: overlay.selector,
          text: overlay.text
        }
      : null
  };
};

const pickCloseoutHardStopFailureSignals = (
  payload: Record<string, unknown>,
  details: JsonObject | null,
  observability: JsonObject | null,
  diagnosis: JsonObject | null
): unknown[] => {
  const signals: unknown[] = [];
  const pushStructuredSignals = (record: JsonObject | null): void => {
    if (!record) {
      return;
    }
    if (Array.isArray(record.failure_signals)) {
      signals.push(...record.failure_signals);
    }
  };
  pushStructuredSignals(asObject(payload));
  pushStructuredSignals(details);
  if (Array.isArray(observability?.key_requests)) {
    for (const item of observability.key_requests) {
      const request = asObject(item);
      if (!request) {
        continue;
      }
      const normalizedReason = normalizeAccountSafetyReason(request.failure_reason);
      signals.push(normalizedReason ?? request.failure_reason);
    }
  }
  const failureSite = asObject(observability?.failure_site);
  if (failureSite) {
    const normalizedSummary = normalizeAccountSafetyReason(failureSite.summary);
    signals.push(normalizedSummary ?? failureSite.summary);
  }
  const diagnosisFailureSite = asObject(diagnosis?.failure_site);
  if (diagnosisFailureSite) {
    const normalizedSummary = normalizeAccountSafetyReason(diagnosisFailureSite.summary);
    signals.push(normalizedSummary ?? diagnosisFailureSite.summary);
  }
  if (Array.isArray(diagnosis?.evidence)) {
    for (const item of diagnosis.evidence) {
      const normalizedEvidence = normalizeAccountSafetyReason(item);
      signals.push(normalizedEvidence ?? item);
    }
  }
  return signals.filter((item) => asString(item) !== null);
};

const pickCloseoutHardStopApiResponses = (
  observability: JsonObject | null
): Array<{
  statusCode?: unknown;
  platformCode?: unknown;
  responseBody?: unknown;
  fallbackMessage?: unknown;
}> => {
  if (!Array.isArray(observability?.key_requests)) {
    return [];
  }
  return observability.key_requests.flatMap((item) => {
    const request = asObject(item);
    if (!request) {
      return [];
    }
    return [
      {
        statusCode: request.status_code,
        platformCode: request.platform_code,
        responseBody: request.response_body ?? request.response ?? request.body,
        fallbackMessage: request.failure_reason
      }
    ];
  });
};

const classifyCloseoutHardStopRiskForPayload = (
  payload: Record<string, unknown>
): CloseoutHardStopRiskClassification => {
  const details = asObject(payload.details);
  const observability = asObject(payload.observability);
  const diagnosis = asObject(payload.diagnosis);
  const accountSafety = asObject(details?.account_safety) ?? asObject(payload.account_safety);
  const currentRunId =
    asString(asObject(payload.gate_input)?.run_id) ??
    asString(asObject(details?.gate_input)?.run_id) ??
    asString(asObject(payload.audit_record)?.run_id);
  const accountSafetySourceRunId =
    asString(accountSafety?.source_run_id) ?? asString(accountSafety?.sourceRunId);
  return classifyCloseoutHardStopRisk({
    reason: details?.reason,
    statusCode: details?.status_code,
    platformCode: details?.platform_code,
    responseBody: pickCloseoutHardStopResponseBody(payload, details),
    apiResponses: pickCloseoutHardStopApiResponses(observability),
    accountSafety,
    accountSafetyFresh:
      accountSafetySourceRunId !== null &&
      currentRunId !== null &&
      accountSafetySourceRunId === currentRunId,
    observabilitySignals: pickCloseoutHardStopFailureSignals(payload, details, observability, diagnosis),
    pageSurface: pickCloseoutHardStopPageSurface({
      payload,
      details,
      observability
    })
  });
};

const buildCloseoutHardStopFailureSite = (
  closeoutHardStopRisk: CloseoutHardStopRiskClassification,
  existing?: JsonObject | null
): JsonObject => ({
  ...(existing ?? {}),
  stage: asString(existing?.stage) ?? "execution",
  component:
    asString(existing?.component) ??
    (closeoutHardStopRisk.source === "api_response"
      ? "network"
      : closeoutHardStopRisk.source === "page_surface"
        ? "page"
        : "runtime"),
  target:
    asString(existing?.target) ??
    closeoutHardStopRisk.evidence.page_url ??
    closeoutHardStopRisk.evidence.message ??
    "xhs.closeout_hard_stop_risk",
  summary: closeoutHardStopRisk.reason ?? "XHS_HARD_STOP_RISK"
});

const augmentCloseoutHardStopObservability = (
  value: unknown,
  closeoutHardStopRisk: CloseoutHardStopRiskClassification
): CommandExecutionResult["observability"] => {
  const observability = asObject(value);
  if (!closeoutHardStopRisk.hard_stop) {
    return asObservabilityInput(value);
  }
  return {
    ...(observability ?? {}),
    failure_site: buildCloseoutHardStopFailureSite(
      closeoutHardStopRisk,
      asObject(observability?.failure_site)
    )
  };
};

const augmentCloseoutHardStopDiagnosis = (
  value: unknown,
  closeoutHardStopRisk: CloseoutHardStopRiskClassification
): CliError["diagnosis"] => {
  const diagnosis = asObject(value);
  if (!closeoutHardStopRisk.hard_stop) {
    return asDiagnosisInput(value);
  }
  const evidence = Array.isArray(diagnosis?.evidence)
    ? diagnosis.evidence.filter((item): item is string => typeof item === "string")
    : [];
  return {
    ...(diagnosis ?? {}),
    category: "request_failed",
    stage: asString(diagnosis?.stage) ?? "execution",
    component: asString(diagnosis?.component) ?? "runtime",
    failure_site: buildCloseoutHardStopFailureSite(
      closeoutHardStopRisk,
      asObject(diagnosis?.failure_site)
    ),
    evidence: [
      closeoutHardStopRisk.reason ?? "XHS_HARD_STOP_RISK",
      closeoutHardStopRisk.risk_class ?? "hard_stop",
      ...evidence
    ].filter((item, index, list) => list.indexOf(item) === index)
  };
};

const toCliExecutionError = (
  ability: AbilityRef,
  payload: Record<string, unknown>,
  fallbackMessage: string,
  expectedRunId: string
): CliError => {
  const details = asObject(payload.details);
  const pickedDetails = pickGateErrorDetails(payload, details);
  if (requiresCanonicalExecutionAuditForContract({ payload, details: pickedDetails })) {
    copyCloseoutCanonicalAuditIntoFailureDetails(payload, pickedDetails);
    assertCloseoutCanonicalExecutionAuditForRuntime(
      ability,
      expectedRunId,
      {
        failure: {
          payload,
          details: pickedDetails,
          observability: payload.observability
        }
      }
    );
  }
  const closeoutHardStopRisk = classifyCloseoutHardStopRiskForPayload(payload);
  const reason =
    typeof details?.reason === "string" && details.reason.trim().length > 0
      ? details.reason.trim()
      : "TARGET_API_RESPONSE_INVALID";
  const consumerGateResult = asObject(payload.consumer_gate_result);

  return new CliError("ERR_EXECUTION_FAILED", fallbackMessage, {
    retryable: payload.retryable === true,
    details: {
      ability_id: ability.id,
      stage:
        details?.stage === "input_validation" ||
        details?.stage === "output_mapping" ||
        details?.stage === "execution"
          ? details.stage
          : "execution",
      reason,
      ...(closeoutHardStopRisk.hard_stop
        ? { closeout_hard_stop_risk: closeoutHardStopRisk }
        : {}),
      ...(consumerGateResult ?? {}),
      ...pickedDetails
    },
    observability: augmentCloseoutHardStopObservability(payload.observability, closeoutHardStopRisk),
    diagnosis: augmentCloseoutHardStopDiagnosis(payload.diagnosis, closeoutHardStopRisk)
  });
};

const toTransportCliError = (error: NativeMessagingTransportError, ability: AbilityRef): CliError =>
  new CliError("ERR_RUNTIME_UNAVAILABLE", `通信链路不可用: ${error.code}`, {
    retryable: error.retryable,
    cause: error,
    details: {
      ability_id: ability.id,
      stage: "execution",
      reason: error.code
    }
  });

const firstRecord = (value: unknown): JsonObject | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  for (const item of value) {
    const record = asObject(item);
    if (record) {
      return record;
    }
  }
  return null;
};

const resolveNestedObject = (
  record: JsonObject | null | undefined,
  key: string
): JsonObject | null => asObject(record?.[key]);

const resolveAccountSafetySignal = (
  payload: Record<string, unknown>,
  fallback: {
    command: string;
    targetDomain: string | null;
    targetTabId: number | null;
    targetPage: string | null;
  }
): {
  reason: AccountSafetyReason;
  sourceCommand: string;
  targetDomain: string | null;
  targetTabId: number | null;
  pageUrl: string | null;
  statusCode: number | null;
  platformCode: number | null;
} | null => {
  const details = asObject(payload.details);
  const observability = asObject(payload.observability);
  const pageState = resolveNestedObject(observability, "page_state");
  const keyRequest = firstRecord(observability?.key_requests);
  const gateInput = asObject(payload.gate_input) ?? asObject(details?.gate_input);
  const consumerGateResult = asObject(payload.consumer_gate_result);
  const auditRecord = asObject(payload.audit_record);
  const diagnosis = asObject(payload.diagnosis);
  const diagnosisEvidence = Array.isArray(diagnosis?.evidence) ? diagnosis?.evidence : [];
  const closeoutHardStopRisk = classifyCloseoutHardStopRiskForPayload(payload);
  const reason =
    normalizeAccountSafetyReason(details?.reason) ??
    closeoutRiskReasonToAccountSafetyReason(closeoutHardStopRisk.reason) ??
    normalizeAccountSafetyReason(keyRequest?.failure_reason) ??
    normalizeAccountSafetyReason(diagnosisEvidence.find((item) => normalizeAccountSafetyReason(item))) ??
    (() => {
      const statusCode = asInteger(details?.status_code) ?? asInteger(keyRequest?.status_code);
      const platformCode = asInteger(details?.platform_code);
      if (statusCode === 401) {
        return "SESSION_EXPIRED" as const;
      }
      if (statusCode === 429) {
        return "CAPTCHA_REQUIRED" as const;
      }
      if (statusCode === 461 || platformCode === 300011) {
        return "ACCOUNT_ABNORMAL" as const;
      }
      if (platformCode === 300015) {
        return "BROWSER_ENV_ABNORMAL" as const;
      }
      return null;
    })();
  if (!reason) {
    return null;
  }
  const targetTabId =
    asInteger(details?.target_tab_id) ??
    asInteger(consumerGateResult?.target_tab_id) ??
    asInteger(gateInput?.target_tab_id) ??
    asInteger(auditRecord?.target_tab_id) ??
    fallback.targetTabId;
  return {
    reason,
    sourceCommand: fallback.command,
    targetDomain:
      asString(details?.target_domain) ??
      asString(consumerGateResult?.target_domain) ??
      asString(gateInput?.target_domain) ??
      asString(auditRecord?.target_domain) ??
      fallback.targetDomain,
    targetTabId,
    pageUrl:
      asString(details?.page_url) ??
      closeoutHardStopRisk.evidence.page_url ??
      asString(pageState?.url) ??
      fallback.targetPage,
    statusCode:
      asInteger(details?.status_code) ??
      closeoutHardStopRisk.evidence.status_code ??
      asInteger(keyRequest?.status_code),
    platformCode: asInteger(details?.platform_code) ?? closeoutHardStopRisk.evidence.platform_code
  };
};

const mergeAccountSafetyIntoFailurePayload = (
  payload: Record<string, unknown>,
  accountSafety: JsonObject,
  xhsCloseoutRhythm?: JsonObject | null,
  runtimeStop?: JsonObject | null
): void => {
  const details = asObject(payload.details) ?? {};
  const accountSafetyReason = asString(accountSafety.reason);
  payload.details = {
    ...details,
    ...(!asString(details.reason) && accountSafetyReason ? { reason: accountSafetyReason } : {}),
    account_safety: accountSafety,
    ...(xhsCloseoutRhythm ? { xhs_closeout_rhythm: xhsCloseoutRhythm } : {}),
    ...(runtimeStop ? { runtime_stop: runtimeStop } : {})
  };
  payload.account_safety = accountSafety;
  if (xhsCloseoutRhythm) {
    payload.xhs_closeout_rhythm = xhsCloseoutRhythm;
  }
  if (runtimeStop) {
    payload.runtime_stop = runtimeStop;
  }
};

const isXhsRecoveryProbe = (input: {
  command: string;
  ability: AbilityRef;
  options: JsonObject;
}): boolean =>
  input.command === "xhs.search" &&
  input.ability.id === "xhs.note.search.v1" &&
  input.options.xhs_recovery_probe === true;

const isXhsLiveReadBaselineGateCommand = (input: {
  command: string;
  options: JsonObject;
  requestedExecutionMode: XhsExecutionMode;
}): boolean =>
  (input.command === "xhs.search" ||
    input.command === "xhs.detail" ||
    input.command === "xhs.user_home") &&
  isLiveXhsReadExecutionMode(input.requestedExecutionMode);

const shouldReturnInProcessGateOnlyResult = (input: {
  requestedExecutionMode: XhsExecutionMode;
}): boolean =>
  input.requestedExecutionMode === "dry_run" &&
  asString(process.env.WEBENVOY_NATIVE_TRANSPORT) === null;

const buildInProcessGateOnlyResult = (input: {
  context: RuntimeContext;
  envelope: AbilityEnvelope;
  gate: ReturnType<typeof normalizeGateOptionsForContract>;
  parsedInput: JsonObject;
  preparedIssue209LiveRead: ReturnType<typeof prepareIssue209LiveReadEnvelopeForContract>;
  dataRefKey: "query" | "note_id" | "user_id";
}): CommandExecutionResult => {
  const profile = input.context.profile ?? "gate_only_profile";
  const sessionId = `gate-only-${input.context.run_id}`;
  const {
    __anonymous_isolation_verified: anonymousIsolationVerified,
    target_site_logged_in: targetSiteLoggedIn,
    ...preparedGateOptions
  } = input.preparedIssue209LiveRead.options;
  const gateOptions = {
    ...preparedGateOptions,
    ...(typeof anonymousIsolationVerified === "boolean"
      ? { __anonymous_isolation_verified: anonymousIsolationVerified }
      : {}),
    ...(typeof targetSiteLoggedIn === "boolean"
      ? { target_site_logged_in: targetSiteLoggedIn }
      : {}),
    ...(typeof input.context.profile === "string"
      ? { __runtime_profile_ref: input.context.profile }
      : {})
  };
  const gateBundle = buildLoopbackGate(gateOptions, input.envelope.ability.action, {
    runId: input.context.run_id,
    requestId: input.envelope.requestId ?? undefined,
    commandRequestId: input.preparedIssue209LiveRead.commandRequestId ?? undefined,
    sessionId,
    profile,
    gateInvocationId: input.preparedIssue209LiveRead.gateInvocationId ?? undefined
  });
  const auditRecord = buildLoopbackAuditRecord({
    runId: input.context.run_id,
    sessionId,
    profile,
    gate: gateBundle
  });
  auditRecord.recorded_at = new Date().toISOString();
  const payload = buildLoopbackGatePayload({
    runId: input.context.run_id,
    sessionId,
    profile,
    gate: gateBundle,
    auditRecord
  });

  if (gateBundle.consumerGateResult.gate_decision === "blocked") {
    payload.details = {
      ability_id: input.envelope.ability.id,
      stage: "execution",
      reason: "EXECUTION_MODE_GATE_BLOCKED"
    };
    throw toCliExecutionError(
      input.envelope.ability,
      payload,
      `执行模式门禁阻断了当前 ${input.context.command} 请求`,
      input.context.run_id
    );
  }

  const dataRefValue =
    typeof input.parsedInput[input.dataRefKey] === "string"
      ? String(input.parsedInput[input.dataRefKey])
      : "";
  const summary = mapCapabilitySummaryForContract(input.envelope.ability.id, {
    ...buildCapabilityResult(input.envelope.ability, {
      data_ref: dataRefValue ? { [input.dataRefKey]: dataRefValue } : {},
      metrics: {
        count: 0
      }
    }),
    ...payload,
    session_id: sessionId,
    requested_execution_mode: input.gate.requestedExecutionMode,
    ...(typeof anonymousIsolationVerified === "boolean"
      ? { __anonymous_isolation_verified: anonymousIsolationVerified }
      : {}),
    ...(typeof targetSiteLoggedIn === "boolean"
      ? { target_site_logged_in: targetSiteLoggedIn }
      : {})
  });

  return {
    summary,
    observability: asObservabilityInput(payload.observability)
  };
};

const assertXhsLivePreflightAllowsCommand = (input: {
  command: string;
  ability: AbilityRef;
  accountSafety: JsonObject;
  xhsCloseoutRhythm: JsonObject;
  antiDetectionValidationView?: XhsCloseoutValidationGateView | null;
  options: JsonObject;
  requestedExecutionMode: XhsExecutionMode;
}): void => {
  const recoveryProbe = isXhsRecoveryProbe(input);
  const xhsLiveReadBaselineGate = isXhsLiveReadBaselineGateCommand(input);
  const rhythmState = asString(input.xhsCloseoutRhythm.state);
  const fullBundleBlocked = input.xhsCloseoutRhythm.full_bundle_blocked === true;
  const singleProbeRequired = input.xhsCloseoutRhythm.single_probe_required === true;
  const probeRunId = asString(input.xhsCloseoutRhythm.probe_run_id);
  const accountSafetyClear = input.accountSafety.state === "clear";

  if (
    recoveryProbe &&
    input.requestedExecutionMode === "recon" &&
    rhythmState === "single_probe_required" &&
    accountSafetyClear &&
    probeRunId === null
  ) {
    return;
  }

  if (
    !recoveryProbe &&
    xhsLiveReadBaselineGate &&
    accountSafetyClear &&
    rhythmState === "single_probe_passed" &&
    input.antiDetectionValidationView?.all_required_ready === true
  ) {
    return;
  }

  if (
    !recoveryProbe &&
    isLiveXhsExecutionMode(input.requestedExecutionMode) &&
    accountSafetyClear &&
    rhythmState === "not_required"
  ) {
    return;
  }

  if (
    !recoveryProbe &&
    !xhsLiveReadBaselineGate &&
    isLiveXhsExecutionMode(input.requestedExecutionMode) &&
    accountSafetyClear &&
    rhythmState === "single_probe_passed" &&
    input.antiDetectionValidationView?.all_required_ready === true
  ) {
    return;
  }

  const blockReason =
    input.accountSafety.state === "account_risk_blocked"
      ? "ACCOUNT_RISK_BLOCKED"
      : recoveryProbe && input.requestedExecutionMode !== "recon"
        ? "XHS_RECOVERY_PROBE_MODE_INVALID"
      : !recoveryProbe && isLiveXhsExecutionMode(input.requestedExecutionMode) && rhythmState === "single_probe_passed"
        ? "ANTI_DETECTION_VALIDATION_BASELINE_BLOCKED"
      : fullBundleBlocked || singleProbeRequired
        ? "XHS_CLOSEOUT_RHYTHM_BLOCKED"
        : "XHS_CLOSEOUT_RHYTHM_UNAVAILABLE";
  const preflightHardStopRisk = classifyCloseoutHardStopRisk({
    statusCode: input.accountSafety.status_code ?? input.accountSafety.statusCode,
    platformCode: input.accountSafety.platform_code ?? input.accountSafety.platformCode,
    accountSafety: input.accountSafety,
    accountSafetyFresh: true
  });

  throw new CliError("ERR_EXECUTION_FAILED", "XHS account-safety gate blocked current live command", {
    retryable: false,
    details: {
      ability_id: input.ability.id,
      stage: "execution",
      reason: blockReason,
      account_safety: input.accountSafety,
      xhs_closeout_rhythm: input.xhsCloseoutRhythm,
      ...(preflightHardStopRisk.hard_stop
        ? { closeout_hard_stop_risk: preflightHardStopRisk }
        : {}),
      ...(input.antiDetectionValidationView
        ? {
            anti_detection_validation_view: toXhsCloseoutValidationGateJson(
              input.antiDetectionValidationView
            )
          }
        : {})
    }
  });
};

const prepareXhsOfficialChromeRuntime = async (
  context: RuntimeContext,
  ability: AbilityRef,
  requestedExecutionMode: XhsExecutionMode,
  bridge: NativeMessagingBridge,
  fingerprintContext: ReturnType<typeof buildFingerprintContextForMeta>,
  gate: ReturnType<typeof normalizeGateOptionsForContract> & {
    targetResourceId?: string | null;
  },
  readStatus?: () => Promise<JsonObject>
): Promise<JsonObject> => {
  return await prepareOfficialChromeRuntime({
    context,
    consumerId: ability.id,
    requestedExecutionMode,
    bridge,
    fingerprintContext,
    bootstrapTargetTabId: gate.targetTabId,
    bootstrapTargetDomain: gate.targetDomain,
    bootstrapTargetPage: gate.targetPage,
    bootstrapTargetResourceId: gate.targetResourceId ?? null,
    readStatus
  });
};

export const ensureOfficialChromeRuntimeReady = async (
  context: RuntimeContext,
  ability: AbilityRef,
  requestedExecutionMode: XhsExecutionMode,
  bridge: NativeMessagingBridge,
  fingerprintContext: ReturnType<typeof buildFingerprintContextForMeta>,
  gate: ReturnType<typeof normalizeGateOptionsForContract> & {
    targetResourceId?: string | null;
  },
  readStatus?: () => Promise<JsonObject>
): Promise<void> => {
  await prepareXhsOfficialChromeRuntime(
    context,
    ability,
    requestedExecutionMode,
    bridge,
    fingerprintContext,
    gate,
    readStatus
  );
};

const resolveBootstrapTargetResourceId = (
  command: string,
  parsedInput: JsonObject
): string | null => {
  if (command === "xhs.detail") {
    return typeof parsedInput.note_id === "string" && parsedInput.note_id.trim().length > 0
      ? parsedInput.note_id.trim()
      : null;
  }
  if (command === "xhs.user_home") {
    return typeof parsedInput.user_id === "string" && parsedInput.user_id.trim().length > 0
      ? parsedInput.user_id.trim()
      : null;
  }
  return null;
};

const buildActiveApiFetchFallbackRuntimeAttestation = (input: {
  status: JsonObject | null;
  context: RuntimeContext;
  sessionId: string;
}): JsonObject | null => {
  const runtimeReadiness = asString(input.status?.runtimeReadiness ?? input.status?.runtime_readiness);
  const executionSurface = asString(
    input.status?.executionSurface ?? input.status?.execution_surface
  );
  const headless = typeof input.status?.headless === "boolean" ? input.status.headless : null;
  if (!runtimeReadiness || !executionSurface || headless === null) {
    return null;
  }
  return {
    source: "official_chrome_runtime_readiness",
    runtime_readiness: runtimeReadiness,
    profile_ref: input.context.profile ?? null,
    session_id: input.sessionId,
    run_id: input.context.run_id,
    execution_surface: executionSurface,
    headless,
    observed_at: new Date().toISOString()
  };
};

const injectActiveApiFetchFallbackRuntimeAttestation = (input: {
  options: JsonObject;
  attestation: JsonObject | null;
}): JsonObject => {
  const activeFallback = asObject(input.options.active_api_fetch_fallback);
  if (!activeFallback) {
    return input.options;
  }
  const {
    fingerprint_validation_state: _fingerprintValidationState,
    execution_surface: _executionSurface,
    headless: _headless,
    runtime_attestation: _runtimeAttestation,
    fingerprint_attestation: _fingerprintAttestation,
    ...activeFallbackRest
  } = activeFallback;
  return {
    ...input.options,
    active_api_fetch_fallback: {
      ...activeFallbackRest,
      ...(input.attestation ? { runtime_attestation: input.attestation } : {})
    }
  };
};

const xhsSearch = async (context: RuntimeContext): Promise<CommandExecutionResult> => {
  return xhsReadCommand(context, {
    fixtureDataRefKey: "query",
    parseInput: (envelope, gate) =>
      parseSearchInputForContract(
        envelope.input,
        envelope.ability.id,
        gate.options,
        envelope.ability.action
      )
  });
};

const xhsDetail = async (context: RuntimeContext): Promise<CommandExecutionResult> => {
  return xhsReadCommand(context, {
    fixtureDataRefKey: "note_id",
    parseInput: (envelope) => parseDetailInputForContract(envelope.input, envelope.ability.id)
  });
};

const xhsUserHome = async (context: RuntimeContext): Promise<CommandExecutionResult> => {
  return xhsReadCommand(context, {
    fixtureDataRefKey: "user_id",
    parseInput: (envelope) => parseUserHomeInputForContract(envelope.input, envelope.ability.id)
  });
};

const xhsReadCommand = async (
  context: RuntimeContext,
  inputConfig: {
    fixtureDataRefKey: "query" | "note_id" | "user_id";
    parseInput: (
      envelope: AbilityEnvelope,
      gate: ReturnType<typeof normalizeGateOptionsForContract>
    ) => JsonObject;
  }
): Promise<CommandExecutionResult> => {
  const envelope = parseAbilityEnvelopeForContract(context.params);
  const gate = normalizeGateOptionsForContract(envelope.options, envelope.ability.id, {
    command: context.command,
    abilityAction: envelope.ability.action,
    runtimeProfile: context.profile ?? null,
    upstreamAuthorization: envelope.upstreamAuthorization
  });
  const parsedInput = inputConfig.parseInput(envelope, gate);

  if (
    process.env.NODE_ENV === "test" &&
    process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS === "1" &&
    gate.options.fixture_success === true
  ) {
    const dataRefValue =
      typeof parsedInput[inputConfig.fixtureDataRefKey] === "string"
        ? String(parsedInput[inputConfig.fixtureDataRefKey])
        : null;
    return {
      summary: mapCapabilitySummaryForContract(
        envelope.ability.id,
        buildCapabilityResult(envelope.ability, {
          data_ref: dataRefValue ? { [inputConfig.fixtureDataRefKey]: dataRefValue } : {},
          metrics: {
            count: 0
          }
        })
      )
    };
  }

  if (envelope.input.force_bad_output === true) {
    return {
      summary: mapCapabilitySummaryForContract(envelope.ability.id, {})
    };
  }

  const profileStore = new ProfileStore(resolveRuntimeProfileRoot(context.cwd));
  let profileMeta = context.profile ? await profileStore.readMeta(context.profile) : null;
  const accountSafetyStatus = toAccountSafetyStatus(profileMeta?.accountSafety);
  let xhsCloseoutRhythmStatus = toXhsCloseoutRhythmStatus({
    rhythm: profileMeta?.xhsCloseoutRhythm,
    accountSafety: profileMeta?.accountSafety
  });
  xhsCloseoutRhythmStatus =
    (await readPersistedSessionRhythmBlockStatus({
      cwd: context.cwd,
      profile: context.profile,
      issueScope: asString(gate.options.issue_scope),
      profileMeta
    })) ?? xhsCloseoutRhythmStatus;
  const profileRuntime = new ProfileRuntimeService();
  const recoveryProbeRequested = isXhsRecoveryProbe({
    command: context.command,
    ability: envelope.ability,
    options: gate.options
  });
  const liveXhsCommandRequested = isLiveXhsExecutionMode(gate.requestedExecutionMode);
  const reconXhsCommandRequested = gate.requestedExecutionMode === "recon";
  const xhsLiveReadBaselineGateRequested = isXhsLiveReadBaselineGateCommand({
    command: context.command,
    options: gate.options,
    requestedExecutionMode: gate.requestedExecutionMode
  });
  const accountSafetyBlockedLiveCommand =
    accountSafetyStatus.state === "account_risk_blocked" &&
    (liveXhsCommandRequested || recoveryProbeRequested);
  let antiDetectionValidationGate: XhsCloseoutValidationGateView | null = null;
  if (
    context.profile &&
    (liveXhsCommandRequested || recoveryProbeRequested || accountSafetyBlockedLiveCommand)
  ) {
    const rhythmState = asString(xhsCloseoutRhythmStatus.state);
    const shouldRunRhythmGate =
      recoveryProbeRequested ||
      liveXhsCommandRequested ||
      accountSafetyBlockedLiveCommand ||
      (rhythmState !== null && rhythmState !== "not_required");
    if (shouldRunRhythmGate) {
      if (
        !recoveryProbeRequested &&
        liveXhsCommandRequested &&
        rhythmState === "single_probe_passed"
      ) {
        let store: SQLiteRuntimeStore | null = null;
        try {
          store = new SQLiteRuntimeStore(resolveRuntimeStorePath(context.cwd));
          antiDetectionValidationGate = await readXhsCloseoutValidationGateView({
            store,
            profile: context.profile,
            effectiveExecutionMode: resolveXhsCloseoutReadinessBaselineExecutionMode(
              gate.requestedExecutionMode
            )
          });
        } catch (error) {
          if (error instanceof RuntimeStoreError) {
            if (error.code === "ERR_RUNTIME_STORE_INVALID_INPUT") {
              throw new CliError("ERR_CLI_INVALID_ARGS", "XHS 反检测验证查询参数不合法", {
                details: {
                  ability_id: envelope.ability.id,
                  stage: "input_validation",
                  reason: "ANTI_DETECTION_VALIDATION_QUERY_INVALID_INPUT"
                }
              });
            }
            throw new CliError("ERR_RUNTIME_UNAVAILABLE", `运行记录存储失败: ${error.code}`, {
              retryable: error.code !== "ERR_RUNTIME_STORE_SCHEMA_MISMATCH",
              cause: error
            });
          }
          throw error;
        } finally {
          try {
            store?.close();
          } catch {
            // Read-only preflight best-effort close.
          }
        }
      }
      assertXhsLivePreflightAllowsCommand({
        command: context.command,
        ability: envelope.ability,
        accountSafety: accountSafetyStatus,
        xhsCloseoutRhythm: xhsCloseoutRhythmStatus,
        antiDetectionValidationView: antiDetectionValidationGate,
        options: gate.options,
        requestedExecutionMode: gate.requestedExecutionMode
      });
    }
  }
  try {
    const preparedIssue209LiveRead = prepareIssue209LiveReadEnvelopeForContract({
      options: gate.options,
      requestId: envelope.requestId,
      gateInvocationId: envelope.gateInvocationId,
      runId: context.run_id
    });
    if (
      shouldReturnInProcessGateOnlyResult({
        requestedExecutionMode: gate.requestedExecutionMode
      })
    ) {
      return buildInProcessGateOnlyResult({
        context,
        envelope,
        gate,
        parsedInput,
        preparedIssue209LiveRead,
        dataRefKey: inputConfig.fixtureDataRefKey
      });
    }

    const bridge = resolveRuntimeBridge();
    const fingerprintContext = buildFingerprintContextForMeta(context.profile ?? "unknown", profileMeta, {
      requestedExecutionMode: gate.requestedExecutionMode
    });
    let officialChromeRuntimeStatus: JsonObject | null = null;
    if (liveXhsCommandRequested || recoveryProbeRequested || reconXhsCommandRequested) {
      officialChromeRuntimeStatus = await prepareXhsOfficialChromeRuntime(
        context,
        envelope.ability,
        gate.requestedExecutionMode,
        bridge,
        fingerprintContext,
        {
          ...gate,
          targetResourceId: resolveBootstrapTargetResourceId(context.command, parsedInput)
        }
      );
    }
    const bridgeSessionId = await bridge.ensureSession({
      profile: context.profile
    });
    if (context.profile && recoveryProbeRequested) {
      await profileRuntime.claimXhsCloseoutSingleProbe({
        cwd: context.cwd,
        profile: context.profile,
        runId: context.run_id,
        params: {}
      });
      profileMeta = await profileStore.readMeta(context.profile);
    }
    const transportIsLoopback = process.env.WEBENVOY_NATIVE_TRANSPORT === "loopback";
    const {
      __anonymous_isolation_verified: anonymousIsolationVerified,
      target_site_logged_in: targetSiteLoggedIn,
      ...preparedGateOptions
    } = preparedIssue209LiveRead.options;
    const sessionRhythmCompatibilityRefs = await buildSessionRhythmCompatibilityRefsForRuntime({
      cwd: context.cwd,
      profile: context.profile,
      runId: context.run_id,
      sessionId: bridgeSessionId,
      profileMeta,
      gate
    });
    const forwardTimeoutMs = resolveForwardTimeoutMsForContract(context.params);
    const runtimeGateOptions = {
      ...injectActiveApiFetchFallbackRuntimeAttestation({
        options: preparedGateOptions,
        attestation: buildActiveApiFetchFallbackRuntimeAttestation({
          status: officialChromeRuntimeStatus,
          context,
          sessionId: bridgeSessionId
        })
      }),
      ...(sessionRhythmCompatibilityRefs ?? {}),
      ...(transportIsLoopback && typeof anonymousIsolationVerified === "boolean"
        ? { __anonymous_isolation_verified: anonymousIsolationVerified }
        : {}),
      ...(transportIsLoopback && typeof targetSiteLoggedIn === "boolean"
        ? { target_site_logged_in: targetSiteLoggedIn }
        : {}),
      ...(typeof context.profile === "string" ? { __runtime_profile_ref: context.profile } : {})
    };
    const commandParams = appendFingerprintContext(
      {
        ...(forwardTimeoutMs ? { timeout_ms: forwardTimeoutMs } : {}),
        ...(preparedIssue209LiveRead.commandRequestId
          ? { request_id: preparedIssue209LiveRead.commandRequestId }
          : {}),
        ...(preparedIssue209LiveRead.gateInvocationId
          ? { gate_invocation_id: preparedIssue209LiveRead.gateInvocationId }
          : {}),
        ...(preparedIssue209LiveRead.admissionDraft
          ? {
              [ISSUE209_INTERNAL_ADMISSION_DRAFT_KEY]: preparedIssue209LiveRead.admissionDraft
            }
          : {}),
        target_domain: gate.targetDomain,
        target_tab_id: gate.targetTabId,
        target_page: gate.targetPage,
        requested_execution_mode: gate.requestedExecutionMode,
        ability: envelope.ability,
        input: parsedInput,
        options: runtimeGateOptions,
        session_id: bridgeSessionId
      },
      fingerprintContext
    );
    const bridgeResult = await bridge.runCommand({
      runId: context.run_id,
      profile: context.profile,
      cwd: context.cwd,
      command: context.command,
      params: commandParams
    });

    if (!bridgeResult.ok) {
      const accountSafetySignal =
        context.profile && (isLiveXhsExecutionMode(gate.requestedExecutionMode) || recoveryProbeRequested)
          ? resolveAccountSafetySignal(bridgeResult.payload, {
              command: context.command,
              targetDomain: gate.targetDomain,
              targetTabId: gate.targetTabId,
              targetPage: gate.targetPage
            })
          : null;
      if (accountSafetySignal && context.profile) {
        const accountSafetyResult = await profileRuntime.markAccountSafetyBlocked({
          cwd: context.cwd,
          profile: context.profile,
          runId: context.run_id,
          params: {},
          signal: accountSafetySignal
        });
        const accountSafety = asObject(accountSafetyResult.account_safety);
        const xhsCloseoutRhythm = asObject(accountSafetyResult.xhs_closeout_rhythm);
        const runtimeStop = asObject(accountSafetyResult.runtime_stop);
        if (accountSafety) {
          mergeAccountSafetyIntoFailurePayload(
            bridgeResult.payload,
            accountSafety,
            xhsCloseoutRhythm,
            runtimeStop
          );
        }
      }
      markCloseoutAuditRequiredForXhsLiveRouteEvidence({
        abilityId: envelope.ability.id,
        requestedExecutionMode: gate.requestedExecutionMode,
        payload: bridgeResult.payload
      });
      throw toCliExecutionError(
        envelope.ability,
        bridgeResult.payload,
        bridgeResult.error.message,
        context.run_id
      );
    }

    const recoveryProbeRiskSignal =
      context.profile && recoveryProbeRequested
        ? resolveAccountSafetySignal(bridgeResult.payload, {
            command: context.command,
            targetDomain: gate.targetDomain,
            targetTabId: gate.targetTabId,
            targetPage: gate.targetPage
          })
        : null;
    if (recoveryProbeRiskSignal && context.profile) {
      const accountSafetyResult = await profileRuntime.markAccountSafetyBlocked({
        cwd: context.cwd,
        profile: context.profile,
        runId: context.run_id,
        params: {},
        signal: recoveryProbeRiskSignal
      });
      const accountSafety = asObject(accountSafetyResult.account_safety);
      const xhsCloseoutRhythm = asObject(accountSafetyResult.xhs_closeout_rhythm);
      const runtimeStop = asObject(accountSafetyResult.runtime_stop);
      if (accountSafety) {
        mergeAccountSafetyIntoFailurePayload(
          bridgeResult.payload,
          accountSafety,
          xhsCloseoutRhythm,
          runtimeStop
        );
      }
      markCloseoutAuditRequiredWhenCanonicalAuditExists(bridgeResult.payload);
      throw toCliExecutionError(
        envelope.ability,
        bridgeResult.payload,
        "XHS recovery probe detected account-safety risk",
        context.run_id
      );
    }

    const consumerGateResult = asObject(bridgeResult.payload.consumer_gate_result);
    const requestAdmissionResult = pickCanonicalSummaryField(
      bridgeResult.payload,
      "request_admission_result"
    );
    const executionAudit = pickCanonicalSummaryField(
      bridgeResult.payload,
      "execution_audit"
    );
    const closeoutEvidenceSummaryFields = pickXhsCloseoutEvidenceSummaryFieldsForContract(
      bridgeResult.payload
    );
    const mergedBridgeSummary = {
      ...(asObject(bridgeResult.payload.summary) ?? {}),
      ...closeoutEvidenceSummaryFields
    };
    const closeoutAuditRequired = requiresCloseoutAuditForXhsBridgeSummaryForContract({
      abilityId: envelope.ability.id,
      requestedExecutionMode: gate.requestedExecutionMode,
      summary: mergedBridgeSummary
    });
    const bridgeSummaryForMapping = { ...mergedBridgeSummary };
    delete bridgeSummaryForMapping.closeout_audit_required;
    const summary = mapCapabilitySummaryForContract(envelope.ability.id, {
      ...bridgeSummaryForMapping,
      session_id: bridgeSessionId,
      requested_execution_mode: gate.requestedExecutionMode,
      ...(closeoutAuditRequired ? { closeout_audit_required: true } : {}),
      ...(consumerGateResult ? { consumer_gate_result: consumerGateResult } : {}),
      ...(requestAdmissionResult !== undefined
        ? { request_admission_result: requestAdmissionResult }
        : {}),
      ...(executionAudit !== undefined ? { execution_audit: executionAudit } : {})
    });
    assertCloseoutEvidenceForRuntime(
      envelope.ability,
      buildXhsCloseoutEvidenceTrustedBindingForContract({
        cwd: context.cwd,
        runId: context.run_id,
        profileRef: context.profile,
        targetTabId: gate.targetTabId,
        summary
      }),
      summary
    );
    if (requiresCanonicalExecutionAuditForContract({ payload: bridgeResult.payload, summary })) {
      assertCloseoutCanonicalExecutionAuditForRuntime(
        envelope.ability,
        context.run_id,
        {
          success: {
            summary,
            observability: bridgeResult.payload.observability
          }
        }
      );
    }

    if (
      context.profile &&
      recoveryProbeRequested
    ) {
      const recoveryStatus = await profileRuntime.markXhsCloseoutSingleProbePassed({
        cwd: context.cwd,
        profile: context.profile,
        runId: context.run_id,
        params: {}
      });
      const xhsCloseoutRhythm = asObject(recoveryStatus.xhs_closeout_rhythm);
      if (xhsCloseoutRhythm) {
        summary.xhs_closeout_rhythm = xhsCloseoutRhythm;
      }
      const profileStore = new ProfileStore(resolveRuntimeProfileRoot(context.cwd));
      const latestMeta = await profileStore.readMeta(context.profile, { mode: "readonly" });
      const recoveryRhythmView = toSessionRhythmStatusView({
        profile: context.profile,
        rhythm: latestMeta?.xhsCloseoutRhythm,
        accountSafety: latestMeta?.accountSafety,
        issueScope: asString(gate.options.issue_scope) ?? "issue_209",
        sessionId: bridgeSessionId,
        sourceRunId: context.run_id,
        effectiveExecutionMode: gate.requestedExecutionMode
      });
      const windowState = asObject(recoveryRhythmView.session_rhythm_window_state);
      const event = asObject(recoveryRhythmView.session_rhythm_event);
      const decision = asObject(recoveryRhythmView.session_rhythm_decision);
      if (windowState && event && decision) {
        const store = new SQLiteRuntimeStore(resolveRuntimeStorePath(context.cwd));
        try {
          await store.recordSessionRhythmStatusView({
            profile: context.profile,
            platform: "xhs",
            issueScope: asString(gate.options.issue_scope) ?? "issue_209",
            windowState,
            event,
            decision
          });
        } finally {
          store.close();
        }
      }
    }

    return {
      summary,
      observability: asObservabilityInput(bridgeResult.payload.observability)
    };
  } catch (error) {
    if (error instanceof NativeMessagingTransportError) {
      throw toTransportCliError(error, envelope.ability);
    }
    throw error;
  }
};

export const xhsCommands = (): CommandDefinition[] => [
  {
    name: "xhs.search",
    status: "implemented",
    requiresProfile: true,
    handler: xhsSearch
  },
  {
    name: "xhs.detail",
    status: "implemented",
    requiresProfile: true,
    handler: xhsDetail
  },
  {
    name: "xhs.user_home",
    status: "implemented",
    requiresProfile: true,
    handler: xhsUserHome
  }
];
