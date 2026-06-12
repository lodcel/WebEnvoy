const PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION =
  "webenvoy-platform-behavior-assessment-risk-hint.v1";
const PLATFORM_BEHAVIOR_TARGET_FR_REF = "FR-0022";
const PLATFORM_BEHAVIOR_VALIDATION_SCOPE = "cross_layer_baseline";

const BROWSER_CHANNEL = "Google Chrome stable";
const EXECUTION_SURFACE = "real_browser";
const GOAL_KINDS = new Set(["read", "write"]);
const BASELINE_STATES = new Set(["unseeded", "learning", "ready", "degraded"]);
const DRIFT_LEVELS = new Set(["none", "low", "medium", "high", "critical"]);
const DECISION_HINTS = new Set([
  "allow_read_only",
  "no_additional_restriction",
  "hold_live_write",
  "require_manual_review",
  "require_reseed"
]);
const HIGH_DRIFT_DECISION_HINTS = new Set([
  "hold_live_write",
  "require_manual_review",
  "require_reseed"
]);
const RESEED_DECISION_HINTS = new Set(["require_manual_review", "require_reseed"]);
const EXECUTION_MODES = new Set([
  "dry_run",
  "recon",
  "live_read_limited",
  "live_read_high_risk",
  "live_write"
]);
const REQUIRED_EXPECTED_SCOPE_KEYS = [
  "profile_ref",
  "platform",
  "target_domain",
  "browser_channel",
  "execution_surface",
  "effective_execution_mode",
  "probe_bundle_ref",
  "goal_kind"
];
const ACTION_TYPES = new Set([
  "navigate",
  "locate",
  "click",
  "extract",
  "wait_settled",
  "type",
  "submit",
  "confirm",
  "publish",
  "purchase",
  "dispatch",
  "bind"
]);
const READ_SAFE_ACTION_TYPES = new Set([
  "navigate",
  "locate",
  "click",
  "extract",
  "wait_settled"
]);
const CLICK_KINDS = new Set([
  "expand_or_collapse",
  "switch_content_tab",
  "open_detail_view",
  "load_more_or_paginate"
]);

const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const hasPresentField = (record, key) =>
  Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined;

const asString = (value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const asNumber = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const asIsoTimestamp = (value) => {
  const timestamp = asString(value);
  if (!timestamp) {
    return null;
  }
  return Number.isNaN(Date.parse(timestamp)) ? null : timestamp;
};

const asStringArray = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim().length > 0)
    : null;

const pushReason = (target, reason) => {
  if (reason && !target.includes(reason)) {
    target.push(reason);
  }
};

const resolveRawAssessment = (record) => {
  if (hasPresentField(record, "platformBehaviorAssessment")) {
    return record.platformBehaviorAssessment;
  }
  return record.platform_behavior_assessment;
};

const resolveRawContext = (record) => {
  if (hasPresentField(record, "platformBehaviorAssessmentContext")) {
    return record.platformBehaviorAssessmentContext;
  }
  if (hasPresentField(record, "platform_behavior_assessment_context")) {
    return record.platform_behavior_assessment_context;
  }
  if (hasPresentField(record, "platformBehaviorContext")) {
    return record.platformBehaviorContext;
  }
  return record.platform_behavior_context;
};

const resolveExpectedScope = (record) => {
  if (hasPresentField(record, "expectedPlatformBehaviorScope")) {
    return record.expectedPlatformBehaviorScope;
  }
  return record.expected_platform_behavior_scope;
};

const isRequired = (record) =>
  record.required === true ||
  record.platformBehaviorAssessmentRequired === true ||
  record.platform_behavior_assessment_required === true ||
  hasPresentField(record, "platformBehaviorAssessment") ||
  hasPresentField(record, "platform_behavior_assessment");

const normalizeContext = (value, reasons) => {
  const context = asRecord(value);
  if (!context) {
    pushReason(reasons, "platform_behavior_context_missing");
    return {
      target_fr_ref: null,
      validation_scope: null
    };
  }

  const targetFrRef = asString(context.target_fr_ref);
  const validationScope = asString(context.validation_scope);
  if (targetFrRef !== PLATFORM_BEHAVIOR_TARGET_FR_REF) {
    pushReason(reasons, "platform_behavior_target_fr_mismatch");
  }
  if (validationScope !== PLATFORM_BEHAVIOR_VALIDATION_SCOPE) {
    pushReason(reasons, "platform_behavior_validation_scope_mismatch");
  }
  if (hasPresentField(context, "issue_scope")) {
    pushReason(reasons, "platform_behavior_issue_scope_not_allowed");
  }

  return {
    target_fr_ref: targetFrRef,
    validation_scope: validationScope
  };
};

const normalizeAssessment = (value, reasons) => {
  const assessment = asRecord(value);
  if (!assessment) {
    pushReason(reasons, "platform_behavior_assessment_missing");
    return null;
  }

  if (hasPresentField(assessment, "issue_scope")) {
    pushReason(reasons, "platform_behavior_issue_scope_not_allowed");
  }

  const normalized = {
    assessment_id: asString(assessment.assessment_id),
    profile_ref: asString(assessment.profile_ref),
    platform: asString(assessment.platform),
    target_domain: asString(assessment.target_domain),
    browser_channel: asString(assessment.browser_channel),
    execution_surface: asString(assessment.execution_surface),
    effective_execution_mode: asString(assessment.effective_execution_mode),
    requested_execution_mode: asString(assessment.requested_execution_mode),
    probe_bundle_ref: asString(assessment.probe_bundle_ref),
    goal_kind: asString(assessment.goal_kind),
    runtime_context_id: asString(assessment.runtime_context_id),
    baseline_ref: asString(assessment.baseline_ref),
    baseline_state: asString(assessment.baseline_state),
    drift_level: asString(assessment.drift_level),
    action_type: asString(assessment.action_type),
    interaction_semantics: asString(assessment.interaction_semantics),
    click_kind: asString(assessment.click_kind),
    threshold_config_snapshot_ref: asString(assessment.threshold_config_snapshot_ref),
    decision_hint: asString(assessment.decision_hint),
    confidence: asNumber(assessment.confidence),
    evidence_refs: asStringArray(assessment.evidence_refs),
    assessed_at: asIsoTimestamp(assessment.assessed_at ?? assessment.assessedAt),
    model_version: asString(assessment.model_version),
    reseed_required: assessment.reseed_required === true
  };

  const requiredStringFields = [
    "assessment_id",
    "profile_ref",
    "platform",
    "target_domain",
    "browser_channel",
    "execution_surface",
    "effective_execution_mode",
    "requested_execution_mode",
    "probe_bundle_ref",
    "goal_kind",
    "runtime_context_id",
    "baseline_state",
    "drift_level",
    "action_type",
    "threshold_config_snapshot_ref",
    "decision_hint",
    "assessed_at",
    "model_version"
  ];
  for (const field of requiredStringFields) {
    if (!normalized[field]) {
      pushReason(reasons, "platform_behavior_assessment_malformed");
    }
  }

  if (normalized.browser_channel !== BROWSER_CHANNEL) {
    pushReason(reasons, "platform_behavior_browser_channel_mismatch");
  }
  if (normalized.execution_surface !== EXECUTION_SURFACE) {
    pushReason(reasons, "platform_behavior_execution_surface_mismatch");
  }
  if (!EXECUTION_MODES.has(normalized.effective_execution_mode)) {
    pushReason(reasons, "platform_behavior_execution_mode_mismatch");
  }
  if (!EXECUTION_MODES.has(normalized.requested_execution_mode)) {
    pushReason(reasons, "platform_behavior_execution_mode_mismatch");
  }
  if (!GOAL_KINDS.has(normalized.goal_kind)) {
    pushReason(reasons, "platform_behavior_goal_kind_mismatch");
  }
  if (!BASELINE_STATES.has(normalized.baseline_state)) {
    pushReason(reasons, "platform_behavior_baseline_state_unclassified");
  }
  if (!DRIFT_LEVELS.has(normalized.drift_level)) {
    pushReason(reasons, "platform_behavior_drift_level_unclassified");
  }
  if (!DECISION_HINTS.has(normalized.decision_hint)) {
    pushReason(reasons, "platform_behavior_decision_hint_unclassified");
  }
  if (!ACTION_TYPES.has(normalized.action_type)) {
    pushReason(reasons, "platform_behavior_action_type_unclassified");
  }
  if (normalized.confidence === null || normalized.confidence < 0 || normalized.confidence > 1) {
    pushReason(reasons, "platform_behavior_assessment_malformed");
  }
  if (!Array.isArray(normalized.evidence_refs) || normalized.evidence_refs.length === 0) {
    pushReason(reasons, "platform_behavior_evidence_refs_missing");
  }
  if (normalized.action_type === "click") {
    if (normalized.interaction_semantics !== "reveal_only_click") {
      pushReason(reasons, "platform_behavior_click_semantics_missing");
    }
    if (!CLICK_KINDS.has(normalized.click_kind)) {
      pushReason(reasons, "platform_behavior_click_kind_missing");
    }
  }
  if (
    normalized.decision_hint === "no_additional_restriction" &&
    (normalized.goal_kind !== "write" ||
      normalized.baseline_state !== "ready" ||
      normalized.reseed_required ||
      !["none", "low"].includes(normalized.drift_level))
  ) {
    pushReason(reasons, "platform_behavior_non_restriction_hint_invalid");
  }
  if (
    !normalized.baseline_ref &&
    !isBaselineRefOptionalColdStartOrLearningAssessment(normalized)
  ) {
    pushReason(reasons, "platform_behavior_baseline_ref_missing");
  }

  return normalized;
};

const isBaselineRefOptionalColdStartOrLearningAssessment = (assessment) => {
  if (!["unseeded", "learning"].includes(assessment.baseline_state)) {
    return false;
  }
  if (assessment.decision_hint === "no_additional_restriction") {
    return false;
  }
  if (assessment.reseed_required || ["high", "critical"].includes(assessment.drift_level)) {
    return false;
  }
  if (assessment.goal_kind === "read") {
    return ["allow_read_only", "require_manual_review"].includes(assessment.decision_hint);
  }
  if (assessment.goal_kind === "write") {
    return ["hold_live_write", "require_manual_review"].includes(assessment.decision_hint);
  }
  return false;
};

const normalizeExpectedScope = (value, reasons) => {
  const scope = asRecord(value);
  if (!scope) {
    pushReason(reasons, "platform_behavior_expected_scope_missing");
  }
  const expectedScope = scope ?? {};
  return {
    profile_ref: asString(expectedScope.profile_ref),
    platform: asString(expectedScope.platform),
    target_domain: asString(expectedScope.target_domain),
    browser_channel: asString(expectedScope.browser_channel),
    execution_surface: asString(expectedScope.execution_surface),
    effective_execution_mode: asString(expectedScope.effective_execution_mode),
    requested_execution_mode: asString(expectedScope.requested_execution_mode),
    probe_bundle_ref: asString(expectedScope.probe_bundle_ref),
    goal_kind: asString(expectedScope.goal_kind)
  };
};

const collectScopeReasons = (assessment, expectedScope) => {
  const reasons = [];
  for (const key of REQUIRED_EXPECTED_SCOPE_KEYS) {
    if (!expectedScope[key]) {
      pushReason(reasons, `platform_behavior_expected_${key}_missing`);
    }
  }
  if (!assessment) {
    return reasons;
  }
  for (const [key, expected] of Object.entries(expectedScope)) {
    if (expected && assessment[key] !== expected) {
      pushReason(reasons, `platform_behavior_${key}_mismatch`);
    }
  }
  return reasons;
};

const collectFreshnessReasons = (assessment, record) => {
  const reasons = [];
  const rawAsOf = record.asOf ?? record.as_of;
  const rawWindowMs = record.freshnessWindowMs ?? record.freshness_window_ms;
  const hasAsOf = hasPresentField(record, "asOf") || hasPresentField(record, "as_of");
  const hasWindowMs =
    hasPresentField(record, "freshnessWindowMs") || hasPresentField(record, "freshness_window_ms");
  const asOf = asIsoTimestamp(rawAsOf);
  const windowMs = asNumber(rawWindowMs);
  if (!hasAsOf) {
    pushReason(reasons, "platform_behavior_as_of_missing");
  } else if (!asOf) {
    pushReason(reasons, "platform_behavior_as_of_invalid");
  }
  if (!hasWindowMs) {
    pushReason(reasons, "platform_behavior_freshness_window_missing");
  } else if (windowMs === null || windowMs < 0) {
    pushReason(reasons, "platform_behavior_freshness_window_invalid");
  }
  if (assessment && asOf && windowMs !== null && windowMs >= 0) {
    const assessedAtMs = Date.parse(assessment.assessed_at);
    const asOfMs = Date.parse(asOf);
    const ageMs = asOfMs - assessedAtMs;
    if (Number.isNaN(assessedAtMs) || Number.isNaN(asOfMs)) {
      pushReason(reasons, "platform_behavior_assessment_stale");
    } else if (ageMs < 0) {
      pushReason(reasons, "platform_behavior_assessment_future_dated");
    } else if (ageMs > windowMs) {
      pushReason(reasons, "platform_behavior_assessment_stale");
    }
  }
  return reasons;
};

const collectDecisionHintReasons = (assessment) => {
  const reasons = [];
  if (!assessment) {
    return reasons;
  }
  if (assessment.goal_kind === "read" && !READ_SAFE_ACTION_TYPES.has(assessment.action_type)) {
    pushReason(reasons, "platform_behavior_read_goal_action_type_invalid");
  }
  if (assessment.reseed_required && assessment.baseline_state === "ready") {
    pushReason(reasons, "platform_behavior_reseed_ready_baseline_invalid");
  }
  if (assessment.reseed_required && !RESEED_DECISION_HINTS.has(assessment.decision_hint)) {
    pushReason(reasons, "platform_behavior_reseed_hint_invalid");
  }
  if (["high", "critical"].includes(assessment.drift_level)) {
    if (!HIGH_DRIFT_DECISION_HINTS.has(assessment.decision_hint)) {
      pushReason(reasons, "platform_behavior_high_drift_hint_invalid");
    }
  }
  if (assessment.goal_kind === "write" && assessment.decision_hint === "allow_read_only") {
    pushReason(reasons, "platform_behavior_read_only_hint_for_write");
  }
  return reasons;
};

const buildBlockedResult = (input) => ({
  required: input.required,
  accepted_risk_hint: false,
  read_write_allow_proof: false,
  account_safety_clearance: false,
  gate_override_proof: false,
  decision: "blocked",
  gate_reasons: input.gateReasons,
  schema_version: PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION,
  target_fr_ref: input.context.target_fr_ref,
  validation_scope: input.context.validation_scope,
  assessment_id: input.assessment?.assessment_id ?? null,
  decision_hint: input.assessment?.decision_hint ?? null,
  baseline_state: input.assessment?.baseline_state ?? null,
  drift_level: input.assessment?.drift_level ?? null,
  reseed_required: input.assessment?.reseed_required ?? false,
  evidence_refs_consumed: input.assessment?.evidence_refs ?? [],
  assessed_at: input.assessment?.assessed_at ?? null
});

export const isPlatformBehaviorAssessmentGateRequired = (input = {}) => {
  const record = asRecord(input);
  return record ? isRequired(record) : false;
};

export const evaluatePlatformBehaviorAssessmentGate = (input = {}) => {
  const record = asRecord(input) ?? {};
  const required = isRequired(record);
  if (!required) {
    return {
      required: false,
      accepted_risk_hint: false,
      read_write_allow_proof: false,
      account_safety_clearance: false,
      gate_override_proof: false,
      decision: "not_required",
      gate_reasons: [],
      schema_version: PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION,
      target_fr_ref: null,
      validation_scope: null,
      assessment_id: null,
      decision_hint: null,
      baseline_state: null,
      drift_level: null,
      reseed_required: false,
      evidence_refs_consumed: [],
      assessed_at: null
    };
  }

  const gateReasons = [];
  const context = normalizeContext(resolveRawContext(record), gateReasons);
  const assessment = normalizeAssessment(resolveRawAssessment(record), gateReasons);
  const expectedScope = normalizeExpectedScope(resolveExpectedScope(record), gateReasons);
  for (const reason of collectScopeReasons(assessment, expectedScope)) {
    pushReason(gateReasons, reason);
  }
  for (const reason of collectFreshnessReasons(assessment, record)) {
    pushReason(gateReasons, reason);
  }
  const decisionHintReasons = collectDecisionHintReasons(assessment);
  for (const reason of decisionHintReasons) {
    pushReason(gateReasons, reason);
  }
  if (gateReasons.length > 0) {
    return buildBlockedResult({ required, context, assessment, gateReasons });
  }

  return {
    required,
    accepted_risk_hint: true,
    read_write_allow_proof: false,
    account_safety_clearance: false,
    gate_override_proof: false,
    decision: "allow_input_to_provider_runtime_decision",
    gate_reasons: [],
    schema_version: PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION,
    target_fr_ref: context.target_fr_ref,
    validation_scope: context.validation_scope,
    assessment_id: assessment.assessment_id,
    decision_hint: assessment.decision_hint,
    baseline_state: assessment.baseline_state,
    drift_level: assessment.drift_level,
    reseed_required: assessment.reseed_required,
    evidence_refs_consumed: assessment.evidence_refs,
    assessed_at: assessment.assessed_at
  };
};

export {
  PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION,
  PLATFORM_BEHAVIOR_TARGET_FR_REF,
  PLATFORM_BEHAVIOR_VALIDATION_SCOPE
};
