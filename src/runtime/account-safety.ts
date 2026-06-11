import type { JsonObject } from "../core/types.js";

export type AccountSafetyState = "clear" | "account_risk_blocked";
export type AccountSafetyPlatform = "xhs";
export type AccountSafetyReason =
  | "SESSION_EXPIRED"
  | "XHS_LOGIN_REQUIRED"
  | "ACCOUNT_ABNORMAL"
  | "XHS_ACCOUNT_RISK_PAGE"
  | "CAPTCHA_REQUIRED"
  | "BROWSER_ENV_ABNORMAL";

export type AccountSafetyGateCapabilityLevel =
  | "write_admit"
  | "write_prepare"
  | "live_write_commit";
export type AccountSafetyGateStatus =
  | "not_applicable"
  | "clear"
  | "unknown"
  | "blocked"
  | "stale"
  | "redaction_invalid"
  | "requires_operator_attention";
export type AccountSafetyGateDecision = "allow" | "deny" | "defer";
export type AccountSafetyGateDownstreamOwner =
  | "#1179"
  | "#1180"
  | "#1211"
  | "runtime_owner"
  | "operator_owner"
  | "live_evidence_owner"
  | "none";
export type AccountSafetySignalClassV1 =
  | "login_required"
  | "captcha_required"
  | "security_redirect"
  | "account_restricted"
  | "account_verification_required"
  | "rate_limited"
  | "browser_environment_abnormal"
  | "profile_concurrency_conflict"
  | "session_integrity_unknown"
  | "previous_residual_unresolved"
  | "cleanup_or_rollback_pending"
  | "account_identifier_redaction_invalid"
  | "safety_evidence_stale";
export type AccountSafetyBlockingReasonV1 =
  | "account_safety_state_missing"
  | "account_safety_unknown"
  | "account_safety_blocked"
  | "account_safety_stale"
  | "account_safety_scope_mismatch"
  | "account_safety_head_mismatch"
  | "account_safety_run_mismatch"
  | "login_required"
  | "captcha_required"
  | "security_redirect"
  | "account_restricted"
  | "account_verification_required"
  | "rate_limited"
  | "browser_environment_abnormal"
  | "profile_concurrency_conflict"
  | "session_integrity_unknown"
  | "previous_residual_unresolved"
  | "cleanup_or_rollback_pending"
  | "safety_evidence_missing"
  | "safety_evidence_stale"
  | "safety_evidence_redaction_invalid"
  | "stub_or_fake_host_evidence"
  | "control_plane_only_signal"
  | "historical_or_stale_evidence"
  | "operator_attention_required"
  | "downstream_owner_required";

export interface AccountSafetyGateScopeV1 {
  schema_version: "account-safety-gate.v1";
  capability_level: AccountSafetyGateCapabilityLevel;
  workflow_ref: string;
  target_domain: string;
  target_page: string;
  profile_ref: string;
  browser_channel: string;
  execution_surface: "real_browser";
  provider_requirement_ref: string | null;
  runtime_target_binding_ref: string | null;
  operator_unlock_ref: string | null;
  head_sha: string;
  run_id: string | null;
  evaluation_context_ref: string;
}

export interface AccountSafetyEvidenceRefsV1 {
  safety_check_ref: string;
  profile_ref: string;
  runtime_status_ref: string;
  target_binding_ref: string;
  signal_scan_ref: string;
  redaction_policy_ref: string;
  freshness_ref: string;
  risk_disposition_ref: string;
  operator_unlock_ref?: string;
  default_commit_lock_ref?: string;
  live_evidence_gate_ref?: string;
}

export interface AccountSafetyGateResultV1 {
  schema_version: "account-safety-gate.v1";
  gate_status: AccountSafetyGateStatus;
  decision: AccountSafetyGateDecision;
  blocking_reasons: AccountSafetyBlockingReasonV1[];
  account_safety_ref: string | null;
  evidence_refs_consumed: string[];
  evaluated_at: string;
  downstream_owner: AccountSafetyGateDownstreamOwner;
}

export interface AccountSafetyRecord {
  state: AccountSafetyState;
  platform: AccountSafetyPlatform | null;
  reason: AccountSafetyReason | null;
  observedAt: string | null;
  cooldownUntil: string | null;
  sourceRunId: string | null;
  sourceCommand: string | null;
  targetDomain: string | null;
  targetTabId: number | null;
  pageUrl: string | null;
  statusCode: number | null;
  platformCode: number | null;
}

export interface AccountSafetyGateEvaluationInput {
  requestedCapabilityLevel: AccountSafetyGateCapabilityLevel;
  requestedScope: AccountSafetyGateScopeV1;
  accountSafetyRecord: unknown;
  evaluatedAt: string;
  evidenceRefs: AccountSafetyEvidenceRefsV1;
  downstreamOwner?: AccountSafetyGateDownstreamOwner;
}

export interface AccountSafetyBlockedInput {
  reason: AccountSafetyReason;
  observedAt: string;
  sourceRunId: string | null;
  sourceCommand: string | null;
  targetDomain: string | null;
  targetTabId: number | null;
  pageUrl: string | null;
  statusCode: number | null;
  platformCode: number | null;
  cooldownMs?: number;
}

export const ACCOUNT_SAFETY_DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;

export const ACCOUNT_SAFETY_REASONS: readonly AccountSafetyReason[] = [
  "SESSION_EXPIRED",
  "XHS_LOGIN_REQUIRED",
  "ACCOUNT_ABNORMAL",
  "XHS_ACCOUNT_RISK_PAGE",
  "CAPTCHA_REQUIRED",
  "BROWSER_ENV_ABNORMAL"
];

const ACCOUNT_SAFETY_STATES: readonly AccountSafetyState[] = ["clear", "account_risk_blocked"];

export const isAccountSafetyReason = (value: unknown): value is AccountSafetyReason =>
  typeof value === "string" && ACCOUNT_SAFETY_REASONS.includes(value as AccountSafetyReason);

const isAccountSafetyState = (value: unknown): value is AccountSafetyState =>
  typeof value === "string" && ACCOUNT_SAFETY_STATES.includes(value as AccountSafetyState);

const isIsoTimestampOrNull = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && !Number.isNaN(Date.parse(value)));

const isIntegerOrNull = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isInteger(value));

const isStringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const asObjectRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const buildClearAccountSafetyRecord = (): AccountSafetyRecord => ({
  state: "clear",
  platform: null,
  reason: null,
  observedAt: null,
  cooldownUntil: null,
  sourceRunId: null,
  sourceCommand: null,
  targetDomain: null,
  targetTabId: null,
  pageUrl: null,
  statusCode: null,
  platformCode: null
});

export const buildBlockedAccountSafetyRecord = (input: AccountSafetyBlockedInput): AccountSafetyRecord => {
  const cooldownUntil = new Date(
    Date.parse(input.observedAt) + (input.cooldownMs ?? ACCOUNT_SAFETY_DEFAULT_COOLDOWN_MS)
  ).toISOString();
  return {
    state: "account_risk_blocked",
    platform: "xhs",
    reason: input.reason,
    observedAt: input.observedAt,
    cooldownUntil,
    sourceRunId: input.sourceRunId,
    sourceCommand: input.sourceCommand,
    targetDomain: input.targetDomain,
    targetTabId: input.targetTabId,
    pageUrl: input.pageUrl,
    statusCode: input.statusCode,
    platformCode: input.platformCode
  };
};

export function assertAccountSafetyRecordShape(value: unknown): asserts value is AccountSafetyRecord {
  const record = asObjectRecord(value);
  if (!record) {
    throw new Error("Invalid profile meta structure: accountSafety");
  }
  if (!isAccountSafetyState(record.state)) {
    throw new Error("Invalid profile meta structure: accountSafety.state");
  }
  if (record.platform !== null && record.platform !== "xhs") {
    throw new Error("Invalid profile meta structure: accountSafety.platform");
  }
  if (record.reason !== null && !isAccountSafetyReason(record.reason)) {
    throw new Error("Invalid profile meta structure: accountSafety.reason");
  }
  if (!isIsoTimestampOrNull(record.observedAt) || !isIsoTimestampOrNull(record.cooldownUntil)) {
    throw new Error("Invalid profile meta structure: accountSafety timestamps");
  }
  if (
    !isStringOrNull(record.sourceRunId) ||
    !isStringOrNull(record.sourceCommand) ||
    !isStringOrNull(record.targetDomain) ||
    !isStringOrNull(record.pageUrl)
  ) {
    throw new Error("Invalid profile meta structure: accountSafety string fields");
  }
  if (
    !isIntegerOrNull(record.targetTabId) ||
    !isIntegerOrNull(record.statusCode) ||
    !isIntegerOrNull(record.platformCode)
  ) {
    throw new Error("Invalid profile meta structure: accountSafety numeric fields");
  }
}

export const normalizeAccountSafetyRecord = (value: unknown): AccountSafetyRecord => {
  if (value === undefined || value === null) {
    return buildClearAccountSafetyRecord();
  }
  assertAccountSafetyRecordShape(value);
  return { ...(value as AccountSafetyRecord) };
};

export const toAccountSafetyStatus = (value: unknown): JsonObject => {
  const record = normalizeAccountSafetyRecord(value);
  return {
    state: record.state,
    platform: record.platform,
    reason: record.reason,
    observed_at: record.observedAt,
    cooldown_until: record.cooldownUntil,
    source_run_id: record.sourceRunId,
    source_command: record.sourceCommand,
    target_domain: record.targetDomain,
    target_tab_id: record.targetTabId,
    page_url: record.pageUrl,
    status_code: record.statusCode,
    platform_code: record.platformCode,
    live_commands_blocked: record.state === "account_risk_blocked"
  };
};

const ACCOUNT_SAFETY_REASON_TO_SIGNAL_CLASS: Record<
  AccountSafetyReason,
  AccountSafetySignalClassV1
> = {
  SESSION_EXPIRED: "login_required",
  XHS_LOGIN_REQUIRED: "login_required",
  ACCOUNT_ABNORMAL: "account_restricted",
  XHS_ACCOUNT_RISK_PAGE: "security_redirect",
  CAPTCHA_REQUIRED: "captcha_required",
  BROWSER_ENV_ABNORMAL: "browser_environment_abnormal"
};

const ACCOUNT_SAFETY_REASON_TO_BLOCKING_REASON: Record<
  AccountSafetyReason,
  AccountSafetyBlockingReasonV1
> = {
  SESSION_EXPIRED: "login_required",
  XHS_LOGIN_REQUIRED: "login_required",
  ACCOUNT_ABNORMAL: "account_restricted",
  XHS_ACCOUNT_RISK_PAGE: "security_redirect",
  CAPTCHA_REQUIRED: "captcha_required",
  BROWSER_ENV_ABNORMAL: "browser_environment_abnormal"
};

const evidenceRefsConsumed = (refs: AccountSafetyEvidenceRefsV1): string[] =>
  Object.values(refs).filter((value): value is string => typeof value === "string");

const accountSafetyRefForRecord = (
  record: AccountSafetyRecord,
  scope: AccountSafetyGateScopeV1
): string =>
  [
    "account-safety",
    scope.profile_ref,
    scope.target_domain,
    scope.target_page,
    record.sourceRunId ?? scope.run_id ?? scope.evaluation_context_ref
  ]
    .map((part) => part.replace(/[^A-Za-z0-9_.:-]+/g, "_"))
    .join("/");

export const buildAccountSafetyGateResult = (
  input: AccountSafetyGateEvaluationInput
): AccountSafetyGateResultV1 => {
  const base = {
    schema_version: "account-safety-gate.v1" as const,
    evidence_refs_consumed: evidenceRefsConsumed(input.evidenceRefs),
    evaluated_at: input.evaluatedAt,
    downstream_owner: input.downstreamOwner ?? "none"
  };

  if (input.accountSafetyRecord === undefined || input.accountSafetyRecord === null) {
    return {
      ...base,
      gate_status: "unknown",
      decision: "deny",
      blocking_reasons: ["account_safety_state_missing"],
      account_safety_ref: null
    };
  }

  let record: AccountSafetyRecord;
  try {
    record = normalizeAccountSafetyRecord(input.accountSafetyRecord);
  } catch {
    return {
      ...base,
      gate_status: "unknown",
      decision: "deny",
      blocking_reasons: ["account_safety_unknown"],
      account_safety_ref: null
    };
  }

  const blockingReasons: AccountSafetyBlockingReasonV1[] = [];
  if (
    record.targetDomain !== null &&
    input.requestedScope.target_domain !== record.targetDomain
  ) {
    blockingReasons.push("account_safety_scope_mismatch");
  }

  if (record.state === "clear") {
    return {
      ...base,
      gate_status: blockingReasons.length > 0 ? "blocked" : "clear",
      decision: blockingReasons.length > 0 ? "deny" : "allow",
      blocking_reasons: blockingReasons,
      account_safety_ref: accountSafetyRefForRecord(record, input.requestedScope)
    };
  }

  const signalBlockingReason = record.reason
    ? ACCOUNT_SAFETY_REASON_TO_BLOCKING_REASON[record.reason]
    : null;
  return {
    ...base,
    gate_status: "blocked",
    decision: "deny",
    blocking_reasons: [
      ...blockingReasons,
      "account_safety_blocked",
      ...(signalBlockingReason ? [signalBlockingReason] : [])
    ],
    account_safety_ref: accountSafetyRefForRecord(record, input.requestedScope)
  };
};

export const toAccountSafetySignalClasses = (
  value: unknown
): AccountSafetySignalClassV1[] => {
  const record = normalizeAccountSafetyRecord(value);
  if (record.state === "clear" || record.reason === null) {
    return [];
  }
  return [ACCOUNT_SAFETY_REASON_TO_SIGNAL_CLASS[record.reason]];
};
