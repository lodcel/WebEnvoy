export type PlatformBehaviorAssessmentGateDecision =
  | "not_required"
  | "allow_input_to_provider_runtime_decision"
  | "blocked";

export interface PlatformBehaviorAssessmentGateInput {
  required?: boolean;
  platformBehaviorAssessmentRequired?: boolean;
  platform_behavior_assessment_required?: boolean;
  platformBehaviorAssessment?: unknown;
  platform_behavior_assessment?: unknown;
  platformBehaviorAssessmentContext?: unknown;
  platform_behavior_assessment_context?: unknown;
  platformBehaviorContext?: unknown;
  platform_behavior_context?: unknown;
  expectedPlatformBehaviorScope?: unknown;
  expected_platform_behavior_scope?: unknown;
  asOf?: unknown;
  as_of?: unknown;
  freshnessWindowMs?: unknown;
  freshness_window_ms?: unknown;
}

export interface PlatformBehaviorAssessmentGateResult {
  required: boolean;
  accepted_risk_hint: boolean;
  read_write_allow_proof: false;
  account_safety_clearance: false;
  gate_override_proof: false;
  decision: PlatformBehaviorAssessmentGateDecision;
  gate_reasons: string[];
  schema_version: string;
  target_fr_ref: string | null;
  validation_scope: string | null;
  assessment_id: string | null;
  decision_hint: string | null;
  baseline_state: string | null;
  drift_level: string | null;
  reseed_required: boolean;
  evidence_refs_consumed: string[];
  assessed_at: string | null;
}

export declare const PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION: "webenvoy-platform-behavior-assessment-risk-hint.v1";
export declare const PLATFORM_BEHAVIOR_TARGET_FR_REF: "FR-0022";
export declare const PLATFORM_BEHAVIOR_VALIDATION_SCOPE: "cross_layer_baseline";
export declare const isPlatformBehaviorAssessmentGateRequired: (
  input?: PlatformBehaviorAssessmentGateInput
) => boolean;
export declare const evaluatePlatformBehaviorAssessmentGate: (
  input?: PlatformBehaviorAssessmentGateInput
) => PlatformBehaviorAssessmentGateResult;
