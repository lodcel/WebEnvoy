import type { JsonObject } from "../core/types.js";
import {
  evaluateRiskEvidenceConsumerGate,
  type RiskEvidenceConsumerResult
} from "../../shared/risk-evidence-gate.js";
import type {
  CloseoutRuntimeBlockerCode,
  CloseoutRuntimeReadinessPreflight
} from "./closeout-runtime-readiness.js";

export type CloseoutGateDecision = "GO" | "NO_GO";

export type CloseoutGateBlockerLayer =
  | "profile_binding"
  | "account_safety"
  | "rhythm"
  | "target_binding"
  | "runtime_readiness"
  | "anti_detection_validation"
  | "risk_evidence";

export type CloseoutGateBlockerCode =
  | "managed_profile_mismatch"
  | "account_safety_not_clear"
  | "xhs_closeout_rhythm_blocked"
  | "target_mismatch"
  | "execution_surface_blocked"
  | "runtime_recovery_required"
  | "anti_detection_validation_baseline_blocked"
  | CloseoutRuntimeBlockerCode;

export interface CloseoutGateAggregator {
  decision: CloseoutGateDecision;
  blocker: {
    blocker_layer: CloseoutGateBlockerLayer;
    blocker_code: CloseoutGateBlockerCode;
    required_recovery_action: string;
  } | null;
  gate_state: {
    profile_ref: string | null;
    run_id: string | null;
    requested_execution_mode: string | null;
    identity_preflight_mode: string | null;
    account_safety_state: string | null;
    xhs_closeout_rhythm_state: string | null;
    anti_detection_validation_ready: boolean;
    anti_detection_missing_target_fr_refs: string[];
    runtime_decision: CloseoutRuntimeReadinessPreflight["decision"];
    runtime_recovery_mode: CloseoutRuntimeReadinessPreflight["recovery_mode"];
    target_binding_state: CloseoutRuntimeReadinessPreflight["target_binding"]["state"];
    execution_surface: string | null;
    headless: boolean | null;
    risk_evidence_consumer_gate: RiskEvidenceConsumerResult | null;
  };
}

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const hasOwn = (record: JsonObject, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const blocker = (
  blockerLayer: CloseoutGateBlockerLayer,
  blockerCode: CloseoutGateBlockerCode,
  requiredRecoveryAction: string
): CloseoutGateAggregator["blocker"] => ({
  blocker_layer: blockerLayer,
  blocker_code: blockerCode,
  required_recovery_action: requiredRecoveryAction
});

const isCloseoutRhythmAllowed = (rhythmState: string | null): boolean =>
  rhythmState === "not_required" || rhythmState === "single_probe_passed";

const resolveBehaviorBaselineGoalKind = (params: JsonObject): "read" | "write" | null => {
  const explicitGoalKind = asString(params.goal_kind);
  if (explicitGoalKind === "read" || explicitGoalKind === "write") {
    return explicitGoalKind;
  }
  const actionType = asString(params.action_type);
  if (actionType === "write" || actionType === "irreversible_write") {
    return "write";
  }
  if (actionType === "read") {
    return "read";
  }
  return asString(params.requested_execution_mode) === "live_write" ? "write" : "read";
};

const resolveBehaviorBaselineProbeBundleRef = (
  params: JsonObject,
  goalKind: "read" | "write" | null
): string | null => {
  const explicit =
    asString(params.behavior_baseline_probe_bundle_ref) ?? asString(params.probe_bundle_ref);
  if (explicit) {
    return explicit;
  }
  if (goalKind === "write") {
    return "probe-bundle://fr-0022/xhs-write";
  }
  if (goalKind === "read") {
    return "probe-bundle://fr-0022/xhs-read";
  }
  return null;
};

export const buildCloseoutGateAggregator = (input: {
  status: JsonObject;
  runtimePreflight: CloseoutRuntimeReadinessPreflight;
  antiDetectionValidationView?: JsonObject | null;
  params?: JsonObject | null;
}): CloseoutGateAggregator => {
  const status = input.status;
  const params = input.params ?? {};
  const identityPreflight = asObject(status.identityPreflight);
  const accountSafety = asObject(status.account_safety);
  const closeoutRhythm = asObject(status.xhs_closeout_rhythm);
  const validationView = input.antiDetectionValidationView ?? null;
  const rawRiskEvidenceGateResult = hasOwn(params, "risk_evidence_gate_result")
    ? params.risk_evidence_gate_result
    : hasOwn(status, "risk_evidence_gate_result")
      ? status.risk_evidence_gate_result
      : status.riskEvidenceGateResult;
  const rawNonProofsObserved = hasOwn(params, "non_proofs_observed")
    ? params.non_proofs_observed
    : hasOwn(status, "non_proofs_observed")
      ? status.non_proofs_observed
      : status.non_proofs;
  const rawBehaviorBaselineHint = hasOwn(params, "behavior_baseline_hint")
    ? params.behavior_baseline_hint
    : hasOwn(status, "behavior_baseline_hint")
      ? status.behavior_baseline_hint
      : status.behaviorBaselineHint;
  const behaviorBaselineGoalKind = resolveBehaviorBaselineGoalKind(params);
  const closeoutTargetDomain =
    asString(params.target_domain) ??
    asString(params.requested_target_domain) ??
    input.runtimePreflight.target_binding.managed_target_domain ??
    input.runtimePreflight.target_binding.requested_target_domain;
  const riskEvidenceConsumerGate = evaluateRiskEvidenceConsumerGate({
    riskEvidenceRequired:
      params.risk_evidence_required === true || params.closeout_risk_evidence_required === true,
    risk_evidence_gate_result: rawRiskEvidenceGateResult,
    behavior_baseline_hint_required:
      params.behavior_baseline_hint_required === true ||
      params.closeout_behavior_baseline_hint_required === true,
    behavior_baseline_hint: rawBehaviorBaselineHint,
    behavior_baseline_scope: {
      profile_ref: asString(status.profile),
      target_domain: closeoutTargetDomain,
      requested_execution_mode: asString(params.requested_execution_mode),
      effective_execution_mode:
        asString(params.effective_execution_mode) ?? asString(params.requested_execution_mode),
      probe_bundle_ref: resolveBehaviorBaselineProbeBundleRef(params, behaviorBaselineGoalKind),
      goal_kind: behaviorBaselineGoalKind
    },
    non_proofs_observed: rawNonProofsObserved
  });
  const identityPreflightMode = asString(identityPreflight?.mode);
  const accountSafetyState = asString(accountSafety?.state);
  const rhythmState = asString(closeoutRhythm?.state);
  const validationReady = validationView?.all_required_ready === true;
  const gateState: CloseoutGateAggregator["gate_state"] = {
    profile_ref: asString(status.profile),
    run_id: asString(status.runId),
    requested_execution_mode: asString(params.requested_execution_mode),
    identity_preflight_mode: identityPreflightMode,
    account_safety_state: accountSafetyState,
    xhs_closeout_rhythm_state: rhythmState,
    anti_detection_validation_ready: validationReady,
    anti_detection_missing_target_fr_refs: asStringArray(
      validationView?.missing_target_fr_refs
    ),
    runtime_decision: input.runtimePreflight.decision,
    runtime_recovery_mode: input.runtimePreflight.recovery_mode,
    target_binding_state: input.runtimePreflight.target_binding.state,
    execution_surface: input.runtimePreflight.runtime_status.execution_surface,
    headless: input.runtimePreflight.runtime_status.headless,
    risk_evidence_consumer_gate: riskEvidenceConsumerGate.required
      ? riskEvidenceConsumerGate
      : null
  };

  if (identityPreflightMode !== "official_chrome_persistent_extension") {
    return {
      decision: "NO_GO",
      blocker: blocker(
        "profile_binding",
        "managed_profile_mismatch",
        "bind_webenvoy_managed_official_chrome_profile"
      ),
      gate_state: gateState
    };
  }

  if (accountSafetyState !== "clear") {
    return {
      decision: "NO_GO",
      blocker: blocker(
        "account_safety",
        "account_safety_not_clear",
        "hard_stop_and_restore_account_safety_clear_state"
      ),
      gate_state: gateState
    };
  }

  if (!isCloseoutRhythmAllowed(rhythmState)) {
    return {
      decision: "NO_GO",
      blocker: blocker(
        "rhythm",
        "xhs_closeout_rhythm_blocked",
        "wait_for_or_complete_allowed_closeout_rhythm_window"
      ),
      gate_state: gateState
    };
  }

  if (input.runtimePreflight.target_binding.state !== "verified") {
    return {
      decision: "NO_GO",
      blocker: blocker(
        "target_binding",
        "target_mismatch",
        "restore_or_rebind_managed_target_tab"
      ),
      gate_state: gateState
    };
  }

  if (
    input.runtimePreflight.runtime_status.execution_surface !== "real_browser" ||
    input.runtimePreflight.runtime_status.headless !== false
  ) {
    return {
      decision: "NO_GO",
      blocker: blocker(
        "runtime_readiness",
        "execution_surface_blocked",
        "restart_official_chrome_real_browser_headful"
      ),
      gate_state: gateState
    };
  }

  if (input.runtimePreflight.decision === "RECOVERABLE") {
    return {
      decision: "NO_GO",
      blocker: blocker(
        "runtime_readiness",
        "runtime_recovery_required",
        "recover_runtime_then_rerun_closeout_gate"
      ),
      gate_state: gateState
    };
  }

  if (input.runtimePreflight.decision !== "GO") {
    const runtimeBlockerCode = input.runtimePreflight.blocker?.blocker_code ?? "runtime_not_ready";
    return {
      decision: "NO_GO",
      blocker: blocker(
        "runtime_readiness",
        runtimeBlockerCode,
        input.runtimePreflight.blocker?.required_recovery_action ??
          "start_or_restore_official_chrome_runtime"
      ),
      gate_state: gateState
    };
  }

  if (!validationReady) {
    return {
      decision: "NO_GO",
      blocker: blocker(
        "anti_detection_validation",
        "anti_detection_validation_baseline_blocked",
        "complete_fr_0012_fr_0013_fr_0014_validation_baseline"
      ),
      gate_state: gateState
    };
  }

  if (riskEvidenceConsumerGate.decision === "blocked") {
    return {
      decision: "NO_GO",
      blocker: blocker(
        "risk_evidence",
        (riskEvidenceConsumerGate.gate_reasons[0] ??
          "risk_evidence_unclassified") as CloseoutGateBlockerCode,
        "provide_current_scope_fr_0070_risk_evidence_for_1188"
      ),
      gate_state: gateState
    };
  }

  return {
    decision: "GO",
    blocker: null,
    gate_state: gateState
  };
};
