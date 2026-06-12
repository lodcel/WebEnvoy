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

export interface RiskEvidenceConsumerInput {
  required?: boolean;
  riskEvidenceRequired?: boolean;
  risk_evidence_required?: boolean;
  riskEvidenceGateResult?: unknown;
  risk_evidence_gate_result?: unknown;
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
  schema_version?: string | null;
  evaluated_at?: string | null;
  downstream_owner: string;
}

export declare const RISK_EVIDENCE_SCHEMA_VERSION: "webenvoy-risk-evidence-boundary.v1";
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
