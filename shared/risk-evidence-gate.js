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
  "manual_disposition_present"
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
  manual_disposition_present: "manual_disposition_not_accepted"
};

const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const asString = (value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const asStringArray = (value) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];

const pushReason = (target, reason) => {
  if (reason && !target.includes(reason)) {
    target.push(reason);
  }
};

const normalizeNonProofs = (value) =>
  asStringArray(value).filter((item) => RISK_EVIDENCE_NON_PROOFS.has(item));

const normalizeBlockingReasons = (value) => asStringArray(value);

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
  downstream_owner: input.downstreamOwner
});

export const isRiskEvidenceGateRequired = (input = {}) => {
  const record = asRecord(input);
  if (!record) {
    return false;
  }
  return (
    record.required === true ||
    record.riskEvidenceRequired === true ||
    record.risk_evidence_required === true ||
    asRecord(record.riskEvidenceGateResult) !== null ||
    asRecord(record.risk_evidence_gate_result) !== null ||
    normalizeNonProofs(record.nonProofsObserved).length > 0 ||
    normalizeNonProofs(record.non_proofs_observed).length > 0 ||
    normalizeNonProofs(record.nonProofs).length > 0 ||
    normalizeNonProofs(record.non_proofs).length > 0
  );
};

export const evaluateRiskEvidenceConsumerGate = (input = {}) => {
  const record = asRecord(input) ?? {};
  const riskEvidenceGateResult =
    asRecord(record.riskEvidenceGateResult) ?? asRecord(record.risk_evidence_gate_result);
  const nonProofsObserved = [
    ...normalizeNonProofs(record.nonProofsObserved),
    ...normalizeNonProofs(record.non_proofs_observed),
    ...normalizeNonProofs(record.nonProofs),
    ...normalizeNonProofs(record.non_proofs)
  ].filter((item, index, items) => items.indexOf(item) === index);
  const required = isRiskEvidenceGateRequired(record);

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
      downstream_owner: "none"
    };
  }

  if (!riskEvidenceGateResult) {
    return buildBlockedResult({
      required,
      gateReasons:
        nonProofsObserved.length > 0
          ? collectNonProofBlockingReasons(nonProofsObserved)
          : ["risk_evidence_missing"],
      riskEvidenceState: "missing",
      riskEvidenceDecision: null,
      nonProofsObserved,
      riskEvidenceRef: null,
      evidenceRefsConsumed: [],
      downstreamOwner: "none"
    });
  }

  const riskEvidenceState = asString(riskEvidenceGateResult.risk_state);
  const riskEvidenceDecision = asString(riskEvidenceGateResult.decision);
  const riskEvidenceRef = asString(riskEvidenceGateResult.risk_evidence_ref);
  const evidenceRefsConsumed = asStringArray(riskEvidenceGateResult.evidence_refs_consumed);
  const downstreamOwner = asString(riskEvidenceGateResult.downstream_owner) ?? "none";
  const blockingReasons = normalizeBlockingReasons(riskEvidenceGateResult.blocking_reasons);
  const gateReasons = [];

  if (!RISK_EVIDENCE_STATES.has(riskEvidenceState)) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  if (!RISK_EVIDENCE_DECISIONS.has(riskEvidenceDecision)) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  for (const reason of blockingReasons) {
    pushReason(
      gateReasons,
      RISK_EVIDENCE_BLOCKING_REASONS.has(reason) ? reason : "risk_evidence_unclassified"
    );
  }

  if (riskEvidenceState && riskEvidenceState !== "accepted") {
    pushReason(gateReasons, STATE_REASON_MAP[riskEvidenceState] ?? "risk_evidence_unclassified");
  }
  if (riskEvidenceDecision !== "allow_input_to_1188") {
    pushReason(gateReasons, blockingReasons.length > 0 ? null : "risk_evidence_unclassified");
  }
  if (riskEvidenceState === "accepted" && riskEvidenceDecision === "allow_input_to_1188") {
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
    downstream_owner: downstreamOwner
  };
};

export {
  RISK_EVIDENCE_BLOCKING_REASONS,
  RISK_EVIDENCE_DECISIONS,
  RISK_EVIDENCE_NON_PROOFS,
  RISK_EVIDENCE_STATES
};
