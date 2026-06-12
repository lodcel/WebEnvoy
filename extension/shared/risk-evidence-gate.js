const RISK_EVIDENCE_STATES = new Set([
  "accepted",
  "blocked",
  "unclassified",
  "missing",
  "stale",
  "scope_mismatch",
  "redaction_invalid",
  "provider_private_boundary_violation"
]);

const RISK_EVIDENCE_DECISIONS = new Set(["allow_input_to_1188", "deny", "defer"]);
const RISK_EVIDENCE_SCHEMA_VERSION = "webenvoy-risk-evidence-boundary.v1";
const RISK_EVIDENCE_DOWNSTREAM_OWNER = "#1188";
const BEHAVIOR_BASELINE_HINT_SCHEMA_VERSION = "webenvoy-behavior-baseline-hint.v1";

const BEHAVIOR_BASELINE_HINT_BASELINE_STATES = new Set([
  "unseeded",
  "learning",
  "ready",
  "degraded"
]);
const BEHAVIOR_BASELINE_HINT_DRIFT_LEVELS = new Set([
  "none",
  "low",
  "medium",
  "high",
  "critical"
]);
const BEHAVIOR_BASELINE_HINT_DECISIONS = new Set([
  "allow_read_only",
  "no_additional_restriction",
  "hold_live_write",
  "require_manual_review",
  "require_reseed"
]);
const BEHAVIOR_BASELINE_HINT_GOAL_KINDS = new Set(["read", "write"]);
const BEHAVIOR_BASELINE_HINT_EXECUTION_MODES = new Set([
  "dry_run",
  "recon",
  "live_read_limited",
  "live_read_high_risk",
  "live_write"
]);
const BEHAVIOR_BASELINE_HINT_ALLOWED_KEYS = new Set([
  "schema_version",
  "target_fr_ref",
  "validation_scope",
  "assessment_ref",
  "baseline_ref",
  "baseline_state",
  "drift_level",
  "decision_hint",
  "confidence",
  "profile_ref",
  "target_domain",
  "browser_channel",
  "execution_surface",
  "effective_execution_mode",
  "probe_bundle_ref",
  "goal_kind",
  "reseed_required",
  "evidence_refs_consumed",
  "assessed_at"
]);
const BEHAVIOR_BASELINE_HINT_FORBIDDEN_ACCOUNT_OPS_KEYS = new Set([
  "account_health_score",
  "account_pool_ref",
  "account_rotation_policy_ref",
  "account_cooldown_policy_ref",
  "persona_ref",
  "behavior_persona_ref",
  "operator_schedule_ref",
  "long_term_profile_score"
]);
const RISK_HINT_INPUTS = new Set(["session_rhythm_evidence"]);

const RISK_EVIDENCE_NON_PROOFS = new Set([
  "provider_stealth_declared",
  "provider_contract_present",
  "provider_descriptor_present",
  "provider_capability_matrix_present",
  "provider_registry_row_present",
  "provider_doctor_pass",
  "provider_health_pass",
  "runtime_ping",
  "runtime_bootstrap_ack",
  "fingerprint_seed_ref_present",
  "private_patch_ref_present",
  "account_safety_issue_closed",
  "operator_unlock_present",
  "default_lock_present",
  "live_evidence_gate_present",
  "historical_artifact",
  "same_head_historical_artifact",
  "post_merge_evidence",
  "stub_or_fake_host",
  "control_plane_only_signal",
  "dry_run_only_output",
  "spec_sample_or_fixture",
  "manual_disposition_present",
  "session_rhythm_detector_specific_stealth",
  "detector_specific_stealth",
  "cloakbrowser_as_core",
  "browser_patching",
  "default_live_write_commit",
  "account_operations",
  "issue_835_recovery"
]);

const RISK_EVIDENCE_BLOCKING_REASONS = new Set([
  "risk_evidence_missing",
  "risk_evidence_unclassified",
  "risk_evidence_stale",
  "risk_evidence_scope_mismatch",
  "risk_evidence_head_mismatch",
  "risk_evidence_run_mismatch",
  "risk_evidence_profile_mismatch",
  "risk_evidence_page_mismatch",
  "risk_evidence_provider_mismatch",
  "risk_evidence_redaction_invalid",
  "provider_stealth_boundary_missing",
  "provider_stealth_boundary_unresolved",
  "provider_stealth_non_proof",
  "provider_private_patch_disclosed",
  "provider_private_patch_required_but_unverified",
  "account_safety_required",
  "account_safety_not_clear",
  "runtime_target_binding_required",
  "runtime_target_binding_not_accepted",
  "extension_native_bridge_required",
  "default_lock_required",
  "operator_unlock_required",
  "live_evidence_required",
  "behavior_baseline_required",
  "route_evidence_required",
  "closeout_audit_required",
  "stub_or_fake_host_evidence",
  "control_plane_only_signal",
  "historical_or_stale_evidence",
  "manual_disposition_required",
  "manual_disposition_not_accepted",
  "risk_hint_consumer_required",
  "downstream_owner_required"
]);

const STATE_REASON_MAP = {
  blocked: "risk_hint_consumer_required",
  unclassified: "risk_evidence_unclassified",
  missing: "risk_evidence_missing",
  stale: "risk_evidence_stale",
  scope_mismatch: "risk_evidence_scope_mismatch",
  redaction_invalid: "risk_evidence_redaction_invalid",
  provider_private_boundary_violation: "provider_private_patch_disclosed"
};

const NON_PROOF_REASON_MAP = {
  provider_stealth_declared: "provider_stealth_non_proof",
  provider_contract_present: "provider_stealth_non_proof",
  provider_descriptor_present: "provider_stealth_non_proof",
  provider_capability_matrix_present: "provider_stealth_non_proof",
  provider_registry_row_present: "provider_stealth_non_proof",
  provider_doctor_pass: "provider_stealth_non_proof",
  provider_health_pass: "provider_stealth_non_proof",
  runtime_ping: "control_plane_only_signal",
  runtime_bootstrap_ack: "control_plane_only_signal",
  fingerprint_seed_ref_present: "provider_stealth_non_proof",
  private_patch_ref_present: "provider_stealth_non_proof",
  account_safety_issue_closed: "account_safety_required",
  operator_unlock_present: "operator_unlock_required",
  default_lock_present: "default_lock_required",
  live_evidence_gate_present: "live_evidence_required",
  historical_artifact: "historical_or_stale_evidence",
  same_head_historical_artifact: "historical_or_stale_evidence",
  post_merge_evidence: "historical_or_stale_evidence",
  stub_or_fake_host: "stub_or_fake_host_evidence",
  control_plane_only_signal: "control_plane_only_signal",
  dry_run_only_output: "control_plane_only_signal",
  spec_sample_or_fixture: "historical_or_stale_evidence",
  manual_disposition_present: "manual_disposition_not_accepted",
  session_rhythm_detector_specific_stealth: "provider_stealth_non_proof",
  detector_specific_stealth: "provider_stealth_non_proof",
  cloakbrowser_as_core: "provider_stealth_non_proof",
  browser_patching: "provider_stealth_non_proof",
  default_live_write_commit: "default_lock_required",
  account_operations: "account_safety_required",
  issue_835_recovery: "risk_evidence_scope_mismatch"
};

const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const hasPresentField = (record, key) =>
  Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined;

const asString = (value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const asIsoTimestamp = (value) => {
  const timestamp = asString(value);
  if (!timestamp) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : timestamp;
};

const classifyStringArray = (value) => {
  if (!Array.isArray(value)) {
    return {
      values: [],
      malformed: value !== undefined && value !== null
    };
  }

  const values = [];
  let malformed = false;
  for (const item of value) {
    const normalized = asString(item);
    if (normalized) {
      values.push(normalized);
    } else {
      malformed = true;
    }
  }
  return { values, malformed };
};

const asStringArray = (value) => classifyStringArray(value).values;

const pushReason = (target, reason) => {
  if (reason && !target.includes(reason)) {
    target.push(reason);
  }
};

const classifyNonProofs = (value) => {
  const classified = classifyStringArray(value);
  const reasons = [];
  for (const item of classified.values) {
    if (!RISK_EVIDENCE_NON_PROOFS.has(item)) {
      pushReason(reasons, "risk_evidence_unclassified");
    }
  }
  if (classified.malformed) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  return {
    values: classified.values,
    reasons,
    present: Array.isArray(value) || classified.malformed
  };
};

const classifyBlockingReasons = (value) => {
  const classified = classifyStringArray(value);
  const reasons = [];
  if (!Array.isArray(value)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  for (const reason of classified.values) {
    pushReason(
      reasons,
      RISK_EVIDENCE_BLOCKING_REASONS.has(reason) ? reason : "risk_evidence_unclassified"
    );
  }
  if (classified.malformed) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  return {
    values: classified.values,
    reasons,
    malformed: reasons.includes("risk_evidence_unclassified")
  };
};

const classifyRiskHints = (value) => {
  const classified = classifyStringArray(value);
  const reasons = [];
  for (const hint of classified.values) {
    if (!RISK_HINT_INPUTS.has(hint)) {
      pushReason(reasons, "risk_evidence_unclassified");
    }
  }
  if (classified.malformed) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  return {
    values: classified.values,
    reasons,
    malformed: reasons.includes("risk_evidence_unclassified")
  };
};

const collectNonProofBlockingReasons = (nonProofs) => {
  const reasons = [];
  for (const nonProof of nonProofs) {
    pushReason(reasons, NON_PROOF_REASON_MAP[nonProof] ?? "risk_evidence_unclassified");
  }
  return reasons;
};

const buildBlockedResult = (input) => ({
  required: input.required,
  accepted_risk_input: false,
  read_write_allow_proof: false,
  decision: "blocked",
  gate_reasons: input.gateReasons,
  risk_evidence_state: input.riskEvidenceState,
  risk_evidence_decision: input.riskEvidenceDecision,
  non_proofs_observed: input.nonProofsObserved,
  risk_evidence_ref: input.riskEvidenceRef,
  evidence_refs_consumed: input.evidenceRefsConsumed,
  risk_hints_consumed: input.riskHintsConsumed,
  behavior_baseline_hint_accepted: input.behaviorBaselineHintAccepted ?? false,
  behavior_baseline_hint: input.behaviorBaselineHint ?? null,
  schema_version: input.schemaVersion,
  evaluated_at: input.evaluatedAt,
  downstream_owner: input.downstreamOwner
});

const evaluateBehaviorBaselineHint = (value) => {
  if (value === undefined) {
    return {
      present: false,
      accepted: false,
      reasons: [],
      hint: null
    };
  }

  const record = asRecord(value);
  const reasons = [];
  if (!record) {
    return {
      present: true,
      accepted: false,
      reasons: ["risk_evidence_unclassified"],
      hint: null
    };
  }

  for (const key of Object.keys(record)) {
    if (BEHAVIOR_BASELINE_HINT_FORBIDDEN_ACCOUNT_OPS_KEYS.has(key)) {
      pushReason(reasons, "risk_evidence_scope_mismatch");
    } else if (!BEHAVIOR_BASELINE_HINT_ALLOWED_KEYS.has(key)) {
      pushReason(reasons, "risk_evidence_unclassified");
    }
  }

  const schemaVersion = asString(record.schema_version);
  const targetFrRef = asString(record.target_fr_ref);
  const validationScope = asString(record.validation_scope);
  const assessmentRef = asString(record.assessment_ref);
  const baselineRef = asString(record.baseline_ref);
  const baselineState = asString(record.baseline_state);
  const driftLevel = asString(record.drift_level);
  const decisionHint = asString(record.decision_hint);
  const profileRef = asString(record.profile_ref);
  const targetDomain = asString(record.target_domain);
  const browserChannel = asString(record.browser_channel);
  const executionSurface = asString(record.execution_surface);
  const effectiveExecutionMode = asString(record.effective_execution_mode);
  const probeBundleRef = asString(record.probe_bundle_ref);
  const goalKind = asString(record.goal_kind);
  const assessedAt = asIsoTimestamp(record.assessed_at);
  const evidenceRefsConsumed = asStringArray(record.evidence_refs_consumed);
  const evidenceRefsConsumedShape = classifyStringArray(record.evidence_refs_consumed);
  const confidence = typeof record.confidence === "number" ? record.confidence : null;
  const reseedRequired = typeof record.reseed_required === "boolean" ? record.reseed_required : null;

  if (schemaVersion !== BEHAVIOR_BASELINE_HINT_SCHEMA_VERSION) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (targetFrRef !== "FR-0022" || validationScope !== "cross_layer_baseline") {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (!assessmentRef || evidenceRefsConsumed.length === 0 || evidenceRefsConsumedShape.malformed) {
    pushReason(reasons, "behavior_baseline_required");
  }
  if (!assessedAt) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!profileRef || !targetDomain || !probeBundleRef) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (browserChannel !== "Google Chrome stable" || executionSurface !== "real_browser") {
    pushReason(reasons, "stub_or_fake_host_evidence");
  }
  if (!BEHAVIOR_BASELINE_HINT_EXECUTION_MODES.has(effectiveExecutionMode)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!BEHAVIOR_BASELINE_HINT_GOAL_KINDS.has(goalKind)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!BEHAVIOR_BASELINE_HINT_BASELINE_STATES.has(baselineState)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!BEHAVIOR_BASELINE_HINT_DRIFT_LEVELS.has(driftLevel)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!BEHAVIOR_BASELINE_HINT_DECISIONS.has(decisionHint)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (confidence === null || confidence < 0 || confidence > 1) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (reseedRequired === null) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (
    decisionHint === "no_additional_restriction" &&
    (goalKind !== "write" ||
      baselineState !== "ready" ||
      !["none", "low"].includes(driftLevel) ||
      reseedRequired !== false)
  ) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (reseedRequired === true && !["require_manual_review", "require_reseed"].includes(decisionHint)) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (
    (baselineState === "ready" ||
      (goalKind === "write" && decisionHint === "no_additional_restriction")) &&
    !baselineRef
  ) {
    pushReason(reasons, "behavior_baseline_required");
  }

  const hint = {
    schema_version: schemaVersion,
    target_fr_ref: targetFrRef,
    validation_scope: validationScope,
    assessment_ref: assessmentRef,
    baseline_ref: baselineRef,
    baseline_state: baselineState,
    drift_level: driftLevel,
    decision_hint: decisionHint,
    confidence,
    profile_ref: profileRef,
    target_domain: targetDomain,
    browser_channel: browserChannel,
    execution_surface: executionSurface,
    effective_execution_mode: effectiveExecutionMode,
    probe_bundle_ref: probeBundleRef,
    goal_kind: goalKind,
    reseed_required: reseedRequired,
    evidence_refs_consumed: evidenceRefsConsumed,
    assessed_at: assessedAt
  };

  return {
    present: true,
    accepted: reasons.length === 0,
    reasons,
    hint: reasons.length === 0 ? hint : null
  };
};

export const isRiskEvidenceGateRequired = (input = {}) => {
  const record = asRecord(input);
  if (!record) {
    return false;
  }
  return (
    record.required === true ||
    record.riskEvidenceRequired === true ||
    record.risk_evidence_required === true ||
    record.behaviorBaselineHintRequired === true ||
    record.behavior_baseline_hint_required === true ||
    hasPresentField(record, "riskEvidenceGateResult") ||
    hasPresentField(record, "risk_evidence_gate_result") ||
    hasPresentField(record, "behaviorBaselineHint") ||
    hasPresentField(record, "behavior_baseline_hint") ||
    classifyNonProofs(record.nonProofsObserved).present ||
    classifyNonProofs(record.non_proofs_observed).present ||
    classifyNonProofs(record.nonProofs).present ||
    classifyNonProofs(record.non_proofs).present
  );
};

export const evaluateRiskEvidenceConsumerGate = (input = {}) => {
  const record = asRecord(input) ?? {};
  const rawRiskEvidenceGateResult = hasPresentField(record, "riskEvidenceGateResult")
    ? record.riskEvidenceGateResult
    : record.risk_evidence_gate_result;
  const riskEvidenceGateResult = asRecord(rawRiskEvidenceGateResult);
  const nonProofClassifications = [
    classifyNonProofs(record.nonProofsObserved),
    classifyNonProofs(record.non_proofs_observed),
    classifyNonProofs(record.nonProofs),
    classifyNonProofs(record.non_proofs)
  ];
  const nonProofsObserved = [
    ...nonProofClassifications.flatMap((classification) => classification.values)
  ].filter((item, index, items) => items.indexOf(item) === index);
  const nonProofGateReasons = nonProofClassifications.flatMap(
    (classification) => classification.reasons
  );
  const rawBehaviorBaselineHint = hasPresentField(record, "behaviorBaselineHint")
    ? record.behaviorBaselineHint
    : record.behavior_baseline_hint;
  const behaviorBaselineHint = evaluateBehaviorBaselineHint(rawBehaviorBaselineHint);
  const behaviorBaselineHintRequired =
    record.behaviorBaselineHintRequired === true || record.behavior_baseline_hint_required === true;
  const required = isRiskEvidenceGateRequired(record);
  const riskEvidenceGateResultProvided =
    hasPresentField(record, "riskEvidenceGateResult") ||
    hasPresentField(record, "risk_evidence_gate_result");

  if (!required) {
    return {
      required: false,
      accepted_risk_input: false,
      read_write_allow_proof: false,
      decision: "not_required",
      gate_reasons: [],
      risk_evidence_state: null,
      risk_evidence_decision: null,
      non_proofs_observed: nonProofsObserved,
      risk_evidence_ref: null,
      evidence_refs_consumed: [],
      risk_hints_consumed: [],
      behavior_baseline_hint_accepted: false,
      behavior_baseline_hint: null,
      downstream_owner: "none"
    };
  }

  if (!riskEvidenceGateResult) {
    return buildBlockedResult({
      required,
      gateReasons:
        riskEvidenceGateResultProvided && rawRiskEvidenceGateResult !== null
          ? ["risk_evidence_unclassified"]
          : behaviorBaselineHintRequired && !behaviorBaselineHint.present
          ? ["behavior_baseline_required"]
          : behaviorBaselineHint.reasons.length > 0
          ? behaviorBaselineHint.reasons
          : nonProofsObserved.length > 0 || nonProofGateReasons.length > 0
          ? [...collectNonProofBlockingReasons(nonProofsObserved), ...nonProofGateReasons].filter(
              (reason, index, reasons) => reasons.indexOf(reason) === index
            )
          : ["risk_evidence_missing"],
      riskEvidenceState: "missing",
      riskEvidenceDecision: null,
      nonProofsObserved,
      riskEvidenceRef: null,
      evidenceRefsConsumed: [],
      riskHintsConsumed: [],
      behaviorBaselineHintAccepted: behaviorBaselineHint.accepted,
      behaviorBaselineHint: behaviorBaselineHint.hint,
      downstreamOwner: "none"
    });
  }

  const riskEvidenceState = asString(riskEvidenceGateResult.risk_state);
  const riskEvidenceDecision = asString(riskEvidenceGateResult.decision);
  const schemaVersion = asString(riskEvidenceGateResult.schema_version);
  const riskEvidenceRef = asString(riskEvidenceGateResult.risk_evidence_ref);
  const evidenceRefsConsumed = asStringArray(riskEvidenceGateResult.evidence_refs_consumed);
  const evidenceRefsConsumedShape = classifyStringArray(
    riskEvidenceGateResult.evidence_refs_consumed
  );
  const riskHintsConsumedShape = classifyRiskHints(riskEvidenceGateResult.risk_hints_consumed);
  const riskHintsConsumed = riskHintsConsumedShape.values;
  const evaluatedAt = asIsoTimestamp(riskEvidenceGateResult.evaluated_at);
  const downstreamOwner = asString(riskEvidenceGateResult.downstream_owner) ?? "none";
  const blockingReasonsShape = classifyBlockingReasons(riskEvidenceGateResult.blocking_reasons);
  const blockingReasons = blockingReasonsShape.values;
  const gateReasons = [];

  for (const reason of nonProofGateReasons) {
    pushReason(gateReasons, reason);
  }
  for (const reason of behaviorBaselineHint.reasons) {
    pushReason(gateReasons, reason);
  }
  if (behaviorBaselineHintRequired && !behaviorBaselineHint.present) {
    pushReason(gateReasons, "behavior_baseline_required");
  }
  if (schemaVersion !== RISK_EVIDENCE_SCHEMA_VERSION) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  if (!RISK_EVIDENCE_STATES.has(riskEvidenceState)) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  if (!RISK_EVIDENCE_DECISIONS.has(riskEvidenceDecision)) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  if (!evaluatedAt) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  if (downstreamOwner === "none") {
    pushReason(gateReasons, "downstream_owner_required");
  }
  if (evidenceRefsConsumedShape.malformed) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  for (const reason of riskHintsConsumedShape.reasons) {
    pushReason(gateReasons, reason);
  }
  for (const reason of blockingReasonsShape.reasons) {
    pushReason(gateReasons, reason);
  }

  if (riskEvidenceState && riskEvidenceState !== "accepted") {
    pushReason(gateReasons, STATE_REASON_MAP[riskEvidenceState] ?? "risk_evidence_unclassified");
  }
  if (riskEvidenceDecision !== "allow_input_to_1188") {
    pushReason(gateReasons, blockingReasons.length > 0 ? null : "risk_evidence_unclassified");
  }
  if (riskEvidenceState === "accepted" && riskEvidenceDecision === "allow_input_to_1188") {
    if (blockingReasonsShape.malformed) {
      pushReason(gateReasons, "risk_evidence_unclassified");
    }
    if (downstreamOwner !== RISK_EVIDENCE_DOWNSTREAM_OWNER) {
      pushReason(gateReasons, "downstream_owner_required");
    }
    if (blockingReasons.length > 0) {
      pushReason(gateReasons, "risk_evidence_unclassified");
    }
    if (!riskEvidenceRef || evidenceRefsConsumed.length === 0) {
      pushReason(gateReasons, "risk_evidence_missing");
    }
  }

  if (gateReasons.length > 0) {
    return buildBlockedResult({
      required,
      gateReasons,
      riskEvidenceState: riskEvidenceState ?? "unclassified",
      riskEvidenceDecision,
      nonProofsObserved,
      riskEvidenceRef,
      evidenceRefsConsumed,
      riskHintsConsumed,
      behaviorBaselineHintAccepted: behaviorBaselineHint.accepted,
      behaviorBaselineHint: behaviorBaselineHint.hint,
      schemaVersion,
      evaluatedAt,
      downstreamOwner
    });
  }

  return {
    required,
    accepted_risk_input: true,
    read_write_allow_proof: false,
    decision: "allow_input_to_consumer_gate",
    gate_reasons: [],
    risk_evidence_state: "accepted",
    risk_evidence_decision: "allow_input_to_1188",
    non_proofs_observed: nonProofsObserved,
    risk_evidence_ref: riskEvidenceRef,
    evidence_refs_consumed: evidenceRefsConsumed,
    risk_hints_consumed: riskHintsConsumed,
    behavior_baseline_hint_accepted: behaviorBaselineHint.accepted,
    behavior_baseline_hint: behaviorBaselineHint.hint,
    schema_version: schemaVersion,
    evaluated_at: evaluatedAt,
    downstream_owner: downstreamOwner
  };
};

export {
  RISK_EVIDENCE_BLOCKING_REASONS,
  RISK_EVIDENCE_DECISIONS,
  RISK_EVIDENCE_DOWNSTREAM_OWNER,
  RISK_EVIDENCE_SCHEMA_VERSION,
  BEHAVIOR_BASELINE_HINT_SCHEMA_VERSION,
  RISK_HINT_INPUTS,
  RISK_EVIDENCE_NON_PROOFS,
  RISK_EVIDENCE_STATES
};
