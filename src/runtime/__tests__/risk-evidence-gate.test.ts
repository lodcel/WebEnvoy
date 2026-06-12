import { describe, expect, it } from "vitest";

import {
  evaluateRiskEvidenceConsumerGate
} from "../../../shared/risk-evidence-gate.js";

const acceptedRiskEvidence = () => ({
  schema_version: "webenvoy-risk-evidence-boundary.v1",
  risk_state: "accepted",
  decision: "allow_input_to_1188",
  blocking_reasons: [],
  risk_evidence_ref: "risk-evidence://current-head/run-001",
  evidence_refs_consumed: ["provider-boundary://fr-0069", "runtime-binding://run-001"],
  evaluated_at: "2026-06-12T09:50:00.000Z",
  downstream_owner: "#1188"
});

const acceptedBehaviorBaselineHint = () => ({
  schema_version: "webenvoy-behavior-baseline-hint.v1",
  target_fr_ref: "FR-0022",
  validation_scope: "cross_layer_baseline",
  assessment_ref: "behavior-assessment://current-head/run-001",
  baseline_ref: "platform-behavior-baseline://xhs/www/read/v1",
  baseline_state: "ready",
  drift_level: "low",
  decision_hint: "allow_read_only",
  confidence: 0.82,
  profile_ref: "xhs_001",
  target_domain: "www.xiaohongshu.com",
  browser_channel: "Google Chrome stable",
  execution_surface: "real_browser",
  effective_execution_mode: "live_read_high_risk",
  probe_bundle_ref: "probe-bundle://fr-0022/xhs-read",
  goal_kind: "read",
  reseed_required: false,
  evidence_refs_consumed: ["platform-behavior-signal-batch://run-001"],
  assessed_at: "2026-06-12T09:51:00.000Z"
});

const acceptedWriteBehaviorBaselineHint = () => ({
  ...acceptedBehaviorBaselineHint(),
  baseline_ref: "platform-behavior-baseline://xhs/www/write/v1",
  decision_hint: "no_additional_restriction",
  effective_execution_mode: "live_write",
  goal_kind: "write"
});

const acceptedBehaviorBaselineScope = () => ({
  profile_ref: "xhs_001",
  target_domain: "www.xiaohongshu.com",
  requested_execution_mode: "live_read_high_risk",
  effective_execution_mode: "live_read_high_risk",
  probe_bundle_ref: "probe-bundle://fr-0022/xhs-read",
  goal_kind: "read"
});

const learningConservativeBehaviorBaselineHint = () => ({
  ...acceptedBehaviorBaselineHint(),
  baseline_ref: null,
  baseline_state: "learning",
  drift_level: "medium",
  decision_hint: "hold_live_write",
  effective_execution_mode: "recon",
  goal_kind: "write"
});

const unseededReadBehaviorBaselineHint = () => ({
  ...acceptedBehaviorBaselineHint(),
  baseline_ref: null,
  baseline_state: "unseeded",
  drift_level: "medium",
  decision_hint: "allow_read_only",
  effective_execution_mode: "recon"
});

const degradedCriticalBehaviorBaselineHint = () => ({
  ...acceptedBehaviorBaselineHint(),
  baseline_state: "degraded",
  drift_level: "critical",
  decision_hint: "require_manual_review",
  effective_execution_mode: "recon"
});

const reseedBehaviorBaselineHint = () => ({
  ...degradedCriticalBehaviorBaselineHint(),
  decision_hint: "require_reseed",
  reseed_required: true
});

describe("FR-0070 risk evidence consumer gate", () => {
  it("accepts current-scope risk evidence only as #1188 input, not read/write allow proof", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence()
      })
    ).toMatchObject({
      required: true,
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      gate_reasons: [],
      risk_evidence_state: "accepted",
      risk_evidence_decision: "allow_input_to_1188"
    });
  });

  it("accepts session rhythm evidence only as a risk hint carrier for the consumer gate", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: {
          ...acceptedRiskEvidence(),
          evidence_refs_consumed: [
            "provider-boundary://fr-0069",
            "session-rhythm://FR-0014/window/rhythm_win_profile_issue_209",
            "session-rhythm://FR-0014/decision/rhythm_decision_run_001"
          ],
          risk_hints_consumed: ["session_rhythm_evidence"]
        }
      })
    ).toMatchObject({
      required: true,
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      risk_hints_consumed: ["session_rhythm_evidence"],
      evidence_refs_consumed: expect.arrayContaining([
        "session-rhythm://FR-0014/window/rhythm_win_profile_issue_209",
        "session-rhythm://FR-0014/decision/rhythm_decision_run_001"
      ])
    });
  });

  it("accepts behavior baseline hint only as bounded evidence with no read/write allow proof", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: acceptedBehaviorBaselineHint()
      })
    ).toMatchObject({
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      behavior_baseline_hint_accepted: true,
      behavior_baseline_hint: {
        schema_version: "webenvoy-behavior-baseline-hint.v1",
        target_fr_ref: "FR-0022",
        validation_scope: "cross_layer_baseline",
        decision_hint: "allow_read_only",
        profile_ref: "xhs_001",
        target_domain: "www.xiaohongshu.com"
      }
    });
  });

  it("accepts a behavior baseline hint only when it matches the current gate scope", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: acceptedBehaviorBaselineHint(),
        behavior_baseline_scope: acceptedBehaviorBaselineScope()
      })
    ).toMatchObject({
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      behavior_baseline_hint_accepted: true,
      behavior_baseline_hint: {
        profile_ref: "xhs_001",
        target_domain: "www.xiaohongshu.com",
        effective_execution_mode: "live_read_high_risk",
        probe_bundle_ref: "probe-bundle://fr-0022/xhs-read",
        goal_kind: "read"
      }
    });
  });

  it.each([
    ["profile_ref", { profile_ref: "xhs_other" }],
    ["target_domain", { target_domain: "creator.xiaohongshu.com" }],
    ["effective_execution_mode", { effective_execution_mode: "dry_run" }],
    ["probe_bundle_ref", { probe_bundle_ref: "probe-bundle://fr-0022/xhs-write" }],
    ["goal_kind", { goal_kind: "write" }]
  ])("fails closed when behavior baseline hint mismatches current %s", (_field, scopeOverride) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: acceptedBehaviorBaselineHint(),
        behavior_baseline_scope: {
          ...acceptedBehaviorBaselineScope(),
          ...scopeOverride
        }
      })
    ).toMatchObject({
      accepted_risk_input: false,
      read_write_allow_proof: false,
      decision: "blocked",
      gate_reasons: expect.arrayContaining(["risk_evidence_scope_mismatch"]),
      behavior_baseline_hint_accepted: false,
      behavior_baseline_hint: null
    });
  });

  it("does not let a valid behavior baseline hint replace accepted risk evidence", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        behavior_baseline_hint: acceptedBehaviorBaselineHint()
      })
    ).toMatchObject({
      accepted_risk_input: false,
      read_write_allow_proof: false,
      decision: "blocked",
      gate_reasons: ["risk_evidence_missing"],
      behavior_baseline_hint_accepted: true
    });
  });

  it("fails closed when behavior baseline hint is required but absent", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint_required: true
      })
    ).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: ["behavior_baseline_required"],
      behavior_baseline_hint_accepted: false
    });
  });

  it("fails closed when a ready behavior baseline hint lacks baseline_ref", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: {
          ...acceptedBehaviorBaselineHint(),
          baseline_ref: null
        }
      })
    ).toMatchObject({
      accepted_risk_input: false,
      read_write_allow_proof: false,
      decision: "blocked",
      gate_reasons: expect.arrayContaining(["behavior_baseline_required"]),
      behavior_baseline_hint_accepted: false,
      behavior_baseline_hint: null
    });
  });

  it.each([
    ["missing", { baseline_ref: undefined }],
    ["null", { baseline_ref: null }],
    ["empty", { baseline_ref: " " }]
  ])(
    "fails closed when ready write no-additional-restriction behavior baseline hint has %s baseline_ref",
    (_caseName, override) => {
      expect(
        evaluateRiskEvidenceConsumerGate({
          risk_evidence_gate_result: acceptedRiskEvidence(),
          behavior_baseline_hint: {
            ...acceptedWriteBehaviorBaselineHint(),
            ...override
          }
        })
      ).toMatchObject({
        accepted_risk_input: false,
        read_write_allow_proof: false,
        decision: "blocked",
        gate_reasons: expect.arrayContaining(["behavior_baseline_required"]),
        behavior_baseline_hint_accepted: false,
        behavior_baseline_hint: null
      });
    }
  );

  it("accepts ready write no-additional-restriction behavior hint with baseline_ref only as bounded risk input", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: acceptedWriteBehaviorBaselineHint()
      })
    ).toMatchObject({
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      behavior_baseline_hint_accepted: true,
      behavior_baseline_hint: {
        baseline_ref: "platform-behavior-baseline://xhs/www/write/v1",
        baseline_state: "ready",
        decision_hint: "no_additional_restriction",
        goal_kind: "write"
      }
    });
  });

  it("allows learning conservative behavior hint without baseline_ref without claiming write clearance", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: learningConservativeBehaviorBaselineHint()
      })
    ).toMatchObject({
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      behavior_baseline_hint_accepted: true,
      behavior_baseline_hint: {
        baseline_ref: null,
        baseline_state: "learning",
        decision_hint: "hold_live_write",
        goal_kind: "write"
      }
    });
  });

  it("allows unseeded read assessment without baseline_ref only as bounded read-only evidence", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: unseededReadBehaviorBaselineHint()
      })
    ).toMatchObject({
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      behavior_baseline_hint_accepted: true,
      behavior_baseline_hint: {
        baseline_ref: null,
        baseline_state: "unseeded",
        decision_hint: "allow_read_only",
        goal_kind: "read"
      }
    });
  });

  it("accepts high-drift degraded behavior hint only when it converges to a conservative decision", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: degradedCriticalBehaviorBaselineHint()
      })
    ).toMatchObject({
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      behavior_baseline_hint_accepted: true,
      behavior_baseline_hint: {
        baseline_state: "degraded",
        drift_level: "critical",
        decision_hint: "require_manual_review"
      }
    });
  });

  it("accepts reseed-required behavior hint only as conservative bounded evidence", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: reseedBehaviorBaselineHint()
      })
    ).toMatchObject({
      accepted_risk_input: true,
      read_write_allow_proof: false,
      decision: "allow_input_to_consumer_gate",
      behavior_baseline_hint_accepted: true,
      behavior_baseline_hint: {
        baseline_state: "degraded",
        drift_level: "critical",
        decision_hint: "require_reseed",
        reseed_required: true
      }
    });
  });

  it.each([
    [
      "critical drift with non-conservative read allowance",
      { drift_level: "critical", decision_hint: "allow_read_only" }
    ],
    [
      "high drift with no additional write restriction",
      {
        goal_kind: "write",
        effective_execution_mode: "live_write",
        baseline_ref: "platform-behavior-baseline://xhs/www/write/v1",
        drift_level: "high",
        decision_hint: "no_additional_restriction"
      }
    ],
    [
      "write goal with read-only allowance",
      {
        goal_kind: "write",
        effective_execution_mode: "live_write",
        baseline_ref: "platform-behavior-baseline://xhs/www/write/v1",
        decision_hint: "allow_read_only"
      }
    ],
    [
      "learning write goal with read-only allowance",
      {
        ...learningConservativeBehaviorBaselineHint(),
        decision_hint: "allow_read_only"
      }
    ],
    [
      "degraded baseline with read-only allowance",
      {
        baseline_state: "degraded",
        drift_level: "medium",
        decision_hint: "allow_read_only",
        effective_execution_mode: "recon"
      }
    ],
    [
      "reseed-required baseline still claiming ready",
      {
        decision_hint: "require_reseed",
        reseed_required: true
      }
    ],
    [
      "reseed-required baseline with hold-only decision",
      {
        baseline_state: "degraded",
        drift_level: "critical",
        decision_hint: "hold_live_write",
        reseed_required: true,
        effective_execution_mode: "recon"
      }
    ]
  ])("fails closed for forbidden behavior baseline decision matrix: %s", (_caseName, override) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: {
          ...acceptedBehaviorBaselineHint(),
          ...override
        }
      })
    ).toMatchObject({
      accepted_risk_input: false,
      read_write_allow_proof: false,
      decision: "blocked",
      gate_reasons: expect.arrayContaining(["risk_evidence_scope_mismatch"]),
      behavior_baseline_hint_accepted: false,
      behavior_baseline_hint: null
    });
  });

  it.each([
    ["unknown hint", ["detector_specific_session_rhythm"]],
    ["malformed hint entry", [{ source: "session_rhythm_evidence" }]],
    ["non-array hints", "session_rhythm_evidence"]
  ])("fails closed for %s in risk_hints_consumed", (_caseName, riskHintsConsumed) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: {
          ...acceptedRiskEvidence(),
          risk_hints_consumed: riskHintsConsumed
        }
      })
    ).toMatchObject({
      required: true,
      accepted_risk_input: false,
      read_write_allow_proof: false,
      decision: "blocked",
      gate_reasons: ["risk_evidence_unclassified"]
    });
  });

  it.each([
    [
      "mis-scoped target",
      { target_fr_ref: "#238" },
      "risk_evidence_scope_mismatch"
    ],
    [
      "stub execution surface",
      { execution_surface: "stub" },
      "stub_or_fake_host_evidence"
    ],
    [
      "missing evidence refs",
      { evidence_refs_consumed: [] },
      "behavior_baseline_required"
    ],
    [
      "write-style non-restriction on a read baseline",
      { decision_hint: "no_additional_restriction" },
      "risk_evidence_scope_mismatch"
    ],
    [
      "account operations field",
      { account_health_score: 98 },
      "risk_evidence_scope_mismatch"
    ]
  ])("fails closed for behavior baseline hint %s", (_caseName, override, expectedReason) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: acceptedRiskEvidence(),
        behavior_baseline_hint: {
          ...acceptedBehaviorBaselineHint(),
          ...override
        }
      })
    ).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: expect.arrayContaining([expectedReason]),
      behavior_baseline_hint_accepted: false,
      behavior_baseline_hint: null
    });
  });

  it("fails closed when required risk evidence is missing", () => {
    expect(evaluateRiskEvidenceConsumerGate({ risk_evidence_required: true })).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: ["risk_evidence_missing"],
      risk_evidence_state: "missing"
    });
  });

  it("fails closed for unknown state, decision, and blocking reason", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: {
          risk_state: "maybe",
          decision: "allow",
          blocking_reasons: ["unknown_reason"],
          risk_evidence_ref: "risk-evidence://invalid",
          evidence_refs_consumed: ["provider-boundary://fr-0069"],
          downstream_owner: "#1188"
        }
      })
    ).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: ["risk_evidence_unclassified"]
    });
  });

  it.each([
    ["stale", "risk_evidence_head_mismatch", "risk_evidence_head_mismatch"],
    ["scope_mismatch", "risk_evidence_profile_mismatch", "risk_evidence_profile_mismatch"],
    ["scope_mismatch", "risk_evidence_page_mismatch", "risk_evidence_page_mismatch"],
    ["scope_mismatch", "risk_evidence_provider_mismatch", "risk_evidence_provider_mismatch"],
    ["redaction_invalid", "risk_evidence_redaction_invalid", "risk_evidence_redaction_invalid"],
    [
      "provider_private_boundary_violation",
      "provider_private_patch_disclosed",
      "provider_private_patch_disclosed"
    ]
  ])("fails closed for %s / %s", (riskState, blocker, expectedReason) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: {
          risk_state: riskState,
          decision: "deny",
          blocking_reasons: [blocker],
          risk_evidence_ref: "risk-evidence://blocked",
          evidence_refs_consumed: ["provider-boundary://fr-0069"],
          downstream_owner: "#1188"
        }
      }).gate_reasons
    ).toEqual(expect.arrayContaining([expectedReason]));
  });

  it.each([
    ["provider_doctor_pass", "provider_stealth_non_proof"],
    ["runtime_ping", "control_plane_only_signal"],
    ["runtime_bootstrap_ack", "control_plane_only_signal"],
    ["historical_artifact", "historical_or_stale_evidence"],
    ["same_head_historical_artifact", "historical_or_stale_evidence"],
    ["stub_or_fake_host", "stub_or_fake_host_evidence"],
    ["manual_disposition_present", "manual_disposition_not_accepted"],
    ["account_safety_issue_closed", "account_safety_required"],
    ["session_rhythm_detector_specific_stealth", "provider_stealth_non_proof"],
    ["detector_specific_stealth", "provider_stealth_non_proof"],
    ["cloakbrowser_as_core", "provider_stealth_non_proof"],
    ["browser_patching", "provider_stealth_non_proof"],
    ["default_live_write_commit", "default_lock_required"],
    ["account_operations", "account_safety_required"],
    ["issue_835_recovery", "risk_evidence_scope_mismatch"]
  ])("does not accept %s as proof", (nonProof, expectedReason) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        non_proofs_observed: [nonProof]
      })
    ).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: [expectedReason],
      read_write_allow_proof: false
    });
  });

  it.each([
    ["unknown string", ["runtime_bootstrap_ack_typo"]],
    ["malformed array entry", [{ source: "runtime_ping" }]],
    ["non-array value", "runtime_bootstrap_ack_typo"]
  ])("fails closed for %s in non_proofs_observed", (_caseName, nonProofsObserved) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        non_proofs_observed: nonProofsObserved
      })
    ).toMatchObject({
      required: true,
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: ["risk_evidence_unclassified"]
    });
  });

  it("does not accept allow_input_to_1188 when evidence refs are absent", () => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: {
          ...acceptedRiskEvidence(),
          risk_evidence_ref: null,
          evidence_refs_consumed: []
        }
      })
    ).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: ["risk_evidence_missing"]
    });
  });

  it.each([
    ["schema_version", { schema_version: "unknown.v1" }],
    ["evaluated_at", { evaluated_at: "not-a-timestamp" }],
    ["downstream_owner", { downstream_owner: "none" }]
  ])("fails closed when accepted payload has malformed %s", (_field, override) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: {
          ...acceptedRiskEvidence(),
          ...override
        }
      })
    ).toMatchObject({
      accepted_risk_input: false,
      decision: "blocked"
    });
  });

  it.each([
    ["schema_version", { schema_version: undefined }, "risk_evidence_unclassified"],
    ["evaluated_at", { evaluated_at: undefined }, "risk_evidence_unclassified"],
    ["downstream_owner", { downstream_owner: undefined }, "downstream_owner_required"]
  ])("fails closed when accepted payload is missing %s", (_field, override, expectedReason) => {
    const payload = {
      ...acceptedRiskEvidence(),
      ...override
    };
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) {
        delete (payload as Record<string, unknown>)[key];
      }
    }

    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: payload
      }).gate_reasons
    ).toEqual(expect.arrayContaining([expectedReason]));
  });

  it.each([
    ["missing blocking_reasons", { blocking_reasons: undefined }],
    ["non-array blocking_reasons", { blocking_reasons: "risk_evidence_run_mismatch" }],
    ["malformed blocking_reasons entry", { blocking_reasons: [{}] }],
    ["unknown blocking_reasons entry", { blocking_reasons: ["unknown_reason"] }]
  ])("fails closed when accepted payload has %s", (_caseName, override) => {
    const payload = {
      ...acceptedRiskEvidence(),
      ...override
    };
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) {
        delete (payload as Record<string, unknown>)[key];
      }
    }

    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result: payload
      })
    ).toMatchObject({
      required: true,
      accepted_risk_input: false,
      decision: "blocked",
      gate_reasons: expect.arrayContaining(["risk_evidence_unclassified"])
    });
  });

  it.each([
    ["non-array evidence refs", { evidence_refs_consumed: "runtime-binding://run-001" }],
    ["malformed evidence refs entry", { evidence_refs_consumed: [{}] }],
    ["malformed risk evidence result", "risk-evidence://current-head/run-001"]
  ])("fails closed for malformed accepted evidence shape: %s", (_caseName, payload) => {
    expect(
      evaluateRiskEvidenceConsumerGate({
        risk_evidence_gate_result:
          typeof payload === "string"
            ? payload
            : {
                ...acceptedRiskEvidence(),
                ...payload
              }
      }).gate_reasons
    ).toEqual(expect.arrayContaining(["risk_evidence_unclassified"]));
  });
});
