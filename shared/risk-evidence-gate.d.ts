export type RiskEvidenceState =
  | "accepted"
  | "blocked"
  | "unclassified"
  | "missing"
  | "stale"
  | "scope_mismatch"
  | "redaction_invalid"
  | "provider_private_boundary_violation";

export type RiskEvidenceDecision = "allow_input_to_1188" | "deny" | "defer";
export type RiskHintInput = "session_rhythm_evidence";

export type RiskEvidenceConsumerDecision =
  | "not_required"
  | "allow_input_to_consumer_gate"
  | "blocked";

export type BehaviorBaselineHintBaselineState = "unseeded" | "learning" | "ready" | "degraded";
export type BehaviorBaselineHintDriftLevel = "none" | "low" | "medium" | "high" | "critical";
export type BehaviorBaselineHintDecision =
  | "allow_read_only"
  | "no_additional_restriction"
  | "hold_live_write"
  | "require_manual_review"
  | "require_reseed";
export type BehaviorBaselineHintGoalKind = "read" | "write";
export type BehaviorBaselineHintExecutionMode =
  | "dry_run"
  | "recon"
  | "live_read_limited"
  | "live_read_high_risk"
  | "live_write";

export interface BehaviorBaselineHintV1 {
  schema_version: "webenvoy-behavior-baseline-hint.v1";
  target_fr_ref: "FR-0022";
  validation_scope: "cross_layer_baseline";
  assessment_ref: string;
  baseline_ref: string | null;
  baseline_state: BehaviorBaselineHintBaselineState;
  drift_level: BehaviorBaselineHintDriftLevel;
  decision_hint: BehaviorBaselineHintDecision;
  confidence: number;
  profile_ref: string;
  target_domain: string;
  browser_channel: "Google Chrome stable";
  execution_surface: "real_browser";
  effective_execution_mode: BehaviorBaselineHintExecutionMode;
  probe_bundle_ref: string;
  goal_kind: BehaviorBaselineHintGoalKind;
  reseed_required: boolean;
  evidence_refs_consumed: string[];
  assessed_at: string;
}

export interface RiskEvidenceGateResultLike {
  schema_version?: unknown;
  risk_state?: unknown;
  decision?: unknown;
  blocking_reasons?: unknown;
  risk_evidence_ref?: unknown;
  evidence_refs_consumed?: unknown;
  risk_hints_consumed?: unknown;
  evaluated_at?: unknown;
  downstream_owner?: unknown;
}

export interface BehaviorBaselineScopeBinding {
  profile_ref?: unknown;
  profileRef?: unknown;
  target_domain?: unknown;
  targetDomain?: unknown;
  requested_execution_mode?: unknown;
  requestedExecutionMode?: unknown;
  effective_execution_mode?: unknown;
  effectiveExecutionMode?: unknown;
  probe_bundle_ref?: unknown;
  probeBundleRef?: unknown;
  goal_kind?: unknown;
  goalKind?: unknown;
}

export interface RiskEvidenceConsumerInput {
  required?: boolean;
  riskEvidenceRequired?: boolean;
  risk_evidence_required?: boolean;
  behaviorBaselineHintRequired?: boolean;
  behavior_baseline_hint_required?: boolean;
  riskEvidenceGateResult?: unknown;
  risk_evidence_gate_result?: unknown;
  behaviorBaselineHint?: unknown;
  behavior_baseline_hint?: unknown;
  behaviorBaselineScope?: BehaviorBaselineScopeBinding | unknown;
  behavior_baseline_scope?: BehaviorBaselineScopeBinding | unknown;
  nonProofsObserved?: unknown;
  non_proofs_observed?: unknown;
  nonProofs?: unknown;
  non_proofs?: unknown;
}

export interface RiskEvidenceConsumerResult {
  required: boolean;
  accepted_risk_input: boolean;
  read_write_allow_proof: false;
  decision: RiskEvidenceConsumerDecision;
  gate_reasons: string[];
  risk_evidence_state: RiskEvidenceState | null;
  risk_evidence_decision: RiskEvidenceDecision | null;
  non_proofs_observed: string[];
  risk_evidence_ref: string | null;
  evidence_refs_consumed: string[];
  risk_hints_consumed: string[];
  behavior_baseline_hint_accepted: boolean;
  behavior_baseline_hint: BehaviorBaselineHintV1 | null;
  schema_version?: string | null;
  evaluated_at?: string | null;
  downstream_owner: string;
}

export declare const RISK_EVIDENCE_SCHEMA_VERSION: "webenvoy-risk-evidence-boundary.v1";
export declare const BEHAVIOR_BASELINE_HINT_SCHEMA_VERSION: "webenvoy-behavior-baseline-hint.v1";
export declare const RISK_EVIDENCE_DOWNSTREAM_OWNER: "#1188";
export declare const RISK_HINT_INPUTS: ReadonlySet<string>;
export declare const RISK_EVIDENCE_STATES: ReadonlySet<string>;
export declare const RISK_EVIDENCE_DECISIONS: ReadonlySet<string>;
export declare const RISK_EVIDENCE_NON_PROOFS: ReadonlySet<string>;
export declare const RISK_EVIDENCE_BLOCKING_REASONS: ReadonlySet<string>;
export declare const isRiskEvidenceGateRequired: (input?: RiskEvidenceConsumerInput) => boolean;
export declare const evaluateRiskEvidenceConsumerGate: (
  input?: RiskEvidenceConsumerInput
) => RiskEvidenceConsumerResult;
