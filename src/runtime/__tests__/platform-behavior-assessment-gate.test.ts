import { describe, expect, it } from "vitest";

import {
  evaluatePlatformBehaviorAssessmentGate
} from "../../../shared/platform-behavior-assessment-gate.js";

const context = () => ({
  target_fr_ref: "FR-0022",
  validation_scope: "cross_layer_baseline"
});

const readyWriteAssessment = (overrides: Record<string, unknown> = {}) => ({
  assessment_id: "platform-assess-001",
  profile_ref: "profile-xhs-001",
  platform: "xhs",
  target_domain: "creator.xiaohongshu.com",
  browser_channel: "Google Chrome stable",
  execution_surface: "real_browser",
  requested_execution_mode: "live_write",
  effective_execution_mode: "live_write",
  probe_bundle_ref: "probe-bundle-fr0022-001",
  goal_kind: "write",
  runtime_context_id: "runtime-context-001",
  baseline_ref: "l4-baseline-xhs-creator-write-001",
  baseline_state: "ready",
  drift_level: "low",
  action_type: "type",
  threshold_config_snapshot_ref: "threshold-fr0022-001",
  decision_hint: "no_additional_restriction",
  confidence: 0.82,
  evidence_refs: ["platform-signal-batch://batch-001"],
  assessed_at: "2026-06-12T10:00:00.000Z",
  model_version: "platform-behavior-assessor.v1",
  reseed_required: false,
  ...overrides
});

const expectedScope = () => ({
  profile_ref: "profile-xhs-001",
  platform: "xhs",
  target_domain: "creator.xiaohongshu.com",
  browser_channel: "Google Chrome stable",
  execution_surface: "real_browser",
  requested_execution_mode: "live_write",
  effective_execution_mode: "live_write",
  probe_bundle_ref: "probe-bundle-fr0022-001",
  goal_kind: "write"
});

const readAssessment = (overrides: Record<string, unknown> = {}) =>
  readyWriteAssessment({
    assessment_id: "platform-assess-read-001",
    target_domain: "www.xiaohongshu.com",
    requested_execution_mode: "dry_run",
    effective_execution_mode: "dry_run",
    goal_kind: "read",
    baseline_ref: "l4-baseline-xhs-read-001",
    baseline_state: "ready",
    drift_level: "low",
    action_type: "extract",
    interaction_semantics: undefined,
    click_kind: undefined,
    decision_hint: "allow_read_only",
    reseed_required: false,
    ...overrides
  });

const readExpectedScope = () => ({
  ...expectedScope(),
  target_domain: "www.xiaohongshu.com",
  requested_execution_mode: "dry_run",
  effective_execution_mode: "dry_run",
  goal_kind: "read"
});

const freshInputs = () => ({
  as_of: "2026-06-12T10:03:00.000Z",
  freshness_window_ms: 5 * 60 * 1000
});

describe("FR-0022 platform behavior assessment gate", () => {
  it("accepts fresh same-scope assessment only as provider/runtime risk hint input", () => {
    expect(
      evaluatePlatformBehaviorAssessmentGate({
        platform_behavior_assessment: readyWriteAssessment(),
        platform_behavior_assessment_context: context(),
        expected_platform_behavior_scope: expectedScope(),
        ...freshInputs()
      })
    ).toMatchObject({
      required: true,
      accepted_risk_hint: true,
      read_write_allow_proof: false,
      account_safety_clearance: false,
      gate_override_proof: false,
      decision: "allow_input_to_provider_runtime_decision",
      target_fr_ref: "FR-0022",
      validation_scope: "cross_layer_baseline",
      decision_hint: "no_additional_restriction",
      baseline_state: "ready",
      drift_level: "low"
    });
  });

  it("fails closed for wrong FR lane, stale assessment, and downstream scope mismatch", () => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment({
        target_domain: "www.xiaohongshu.com"
      }),
      platform_behavior_assessment_context: {
        target_fr_ref: "#238",
        validation_scope: "layer4"
      },
      expected_platform_behavior_scope: expectedScope(),
      as_of: "2026-06-12T10:10:01.000Z",
      freshness_window_ms: 60 * 1000
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false
    });
    expect(result.gate_reasons).toEqual(
      expect.arrayContaining([
        "platform_behavior_target_fr_mismatch",
        "platform_behavior_validation_scope_mismatch",
        "platform_behavior_target_domain_mismatch",
        "platform_behavior_assessment_stale"
      ])
    );
  });

  it("fails closed when required gate omits expected downstream scope", () => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment(),
      platform_behavior_assessment_context: context(),
      ...freshInputs()
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false
    });
    expect(result.gate_reasons).toEqual(
      expect.arrayContaining([
        "platform_behavior_expected_scope_missing",
        "platform_behavior_expected_profile_ref_missing",
        "platform_behavior_expected_platform_missing",
        "platform_behavior_expected_target_domain_missing",
        "platform_behavior_expected_browser_channel_missing",
        "platform_behavior_expected_execution_surface_missing",
        "platform_behavior_expected_effective_execution_mode_missing",
        "platform_behavior_expected_probe_bundle_ref_missing",
        "platform_behavior_expected_goal_kind_missing"
      ])
    );
  });

  it.each([
    ["profile_ref", "platform_behavior_expected_profile_ref_missing"],
    ["target_domain", "platform_behavior_expected_target_domain_missing"],
    ["effective_execution_mode", "platform_behavior_expected_effective_execution_mode_missing"],
    ["probe_bundle_ref", "platform_behavior_expected_probe_bundle_ref_missing"],
    ["goal_kind", "platform_behavior_expected_goal_kind_missing"]
  ])("fails closed when required expected scope omits %s", (scopeKey, expectedReason) => {
    const incompleteScope = { ...expectedScope() };
    delete incompleteScope[scopeKey as keyof typeof incompleteScope];

    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment(),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: incompleteScope,
      ...freshInputs()
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false
    });
    expect(result.gate_reasons).toContain(expectedReason);
  });

  it.each([
    ["missing as_of", {}, "platform_behavior_as_of_missing"],
    ["invalid as_of", { as_of: "not-a-date" }, "platform_behavior_as_of_invalid"],
    ["missing freshness window", { as_of: "2026-06-12T10:03:00.000Z" }, "platform_behavior_freshness_window_missing"],
    [
      "negative freshness window",
      { as_of: "2026-06-12T10:03:00.000Z", freshness_window_ms: -1 },
      "platform_behavior_freshness_window_invalid"
    ],
    [
      "non-numeric freshness window",
      { as_of: "2026-06-12T10:03:00.000Z", freshness_window_ms: "300000" },
      "platform_behavior_freshness_window_invalid"
    ]
  ])("fails closed for %s", (_name, freshnessInput, expectedReason) => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment(),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: expectedScope(),
      ...freshnessInput
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false
    });
    expect(result.gate_reasons).toContain(expectedReason);
  });

  it("fails closed when assessed_at is after as_of because future-dated evidence is not fresh", () => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment({
        assessed_at: "2026-06-12T10:04:00.000Z"
      }),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: expectedScope(),
      as_of: "2026-06-12T10:03:00.000Z",
      freshness_window_ms: 5 * 60 * 1000
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false
    });
    expect(result.gate_reasons).toContain("platform_behavior_assessment_future_dated");
  });

  it("fails closed when camel assessedAt is after camel asOf", () => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platformBehaviorAssessment: readyWriteAssessment({
        assessed_at: undefined,
        assessedAt: "2026-06-12T10:04:00.000Z"
      }),
      platformBehaviorAssessmentContext: context(),
      expectedPlatformBehaviorScope: expectedScope(),
      asOf: "2026-06-12T10:03:00.000Z",
      freshnessWindowMs: 5 * 60 * 1000
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false,
      assessed_at: "2026-06-12T10:04:00.000Z"
    });
    expect(result.gate_reasons).toContain("platform_behavior_assessment_future_dated");
  });

  it("accepts assessment exactly at the freshness window boundary because only older-than-window is stale", () => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment(),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: expectedScope(),
      as_of: "2026-06-12T10:05:00.000Z",
      freshness_window_ms: 5 * 60 * 1000
    });

    expect(result).toMatchObject({
      accepted_risk_hint: true,
      decision: "allow_input_to_provider_runtime_decision",
      read_write_allow_proof: false,
      account_safety_clearance: false,
      gate_override_proof: false
    });
    expect(result.gate_reasons).not.toContain("platform_behavior_assessment_stale");
  });

  it.each([
    [
      "stub execution surface",
      readyWriteAssessment({ execution_surface: "stub" }),
      ["platform_behavior_execution_surface_mismatch"]
    ],
    [
      "XHS issue scope in Layer 4 object",
      readyWriteAssessment({ issue_scope: "issue_209" }),
      ["platform_behavior_issue_scope_not_allowed"]
    ],
    [
      "write high drift non-restrictive hint",
      readyWriteAssessment({ drift_level: "high", decision_hint: "no_additional_restriction" }),
      [
        "platform_behavior_non_restriction_hint_invalid",
        "platform_behavior_high_drift_hint_invalid"
      ]
    ],
    [
      "missing evidence refs",
      readyWriteAssessment({ evidence_refs: [] }),
      ["platform_behavior_evidence_refs_missing"]
    ]
  ])("fails closed for %s", (_name, assessment, expectedReasons) => {
    expect(
      evaluatePlatformBehaviorAssessmentGate({
        platform_behavior_assessment: assessment,
        platform_behavior_assessment_context: context(),
        expected_platform_behavior_scope: expectedScope(),
        ...freshInputs()
      }).gate_reasons
    ).toEqual(expect.arrayContaining(expectedReasons));
  });

  it.each([
    ["read high drift allow_read_only", "read", "allow_read_only"],
    ["write high drift no_additional_restriction", "write", "no_additional_restriction"]
  ])("fails closed when %s does not converge to a conservative decision hint", (_name, goalKind, decisionHint) => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment({
        target_domain: goalKind === "read" ? "www.xiaohongshu.com" : "creator.xiaohongshu.com",
        requested_execution_mode: goalKind === "read" ? "dry_run" : "live_write",
        effective_execution_mode: goalKind === "read" ? "dry_run" : "live_write",
        goal_kind: goalKind,
        drift_level: "high",
        action_type: goalKind === "read" ? "click" : "type",
        interaction_semantics: goalKind === "read" ? "reveal_only_click" : undefined,
        click_kind: goalKind === "read" ? "open_detail_view" : undefined,
        decision_hint: decisionHint
      }),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: {
        ...expectedScope(),
        target_domain: goalKind === "read" ? "www.xiaohongshu.com" : "creator.xiaohongshu.com",
        requested_execution_mode: goalKind === "read" ? "dry_run" : "live_write",
        effective_execution_mode: goalKind === "read" ? "dry_run" : "live_write",
        goal_kind: goalKind
      },
      ...freshInputs()
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false
    });
    expect(result.gate_reasons).toContain("platform_behavior_high_drift_hint_invalid");
  });

  it.each([
    ["high drift hold_live_write", "high", "hold_live_write"],
    ["high drift require_manual_review", "high", "require_manual_review"],
    ["critical drift require_reseed", "critical", "require_reseed"]
  ])("accepts %s only as bounded non-proof risk input", (_name, driftLevel, decisionHint) => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment({
        drift_level: driftLevel,
        decision_hint: decisionHint,
        baseline_state: decisionHint === "require_reseed" ? "degraded" : "ready",
        reseed_required: decisionHint === "require_reseed"
      }),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: expectedScope(),
      ...freshInputs()
    });

    expect(result).toMatchObject({
      accepted_risk_hint: true,
      decision: "allow_input_to_provider_runtime_decision",
      read_write_allow_proof: false,
      account_safety_clearance: false,
      gate_override_proof: false,
      drift_level: driftLevel,
      decision_hint: decisionHint
    });
  });

  it.each([
    ["navigate", {}],
    ["locate", {}],
    [
      "click",
      {
        interaction_semantics: "reveal_only_click",
        click_kind: "open_detail_view"
      }
    ],
    ["extract", {}],
    ["wait_settled", {}]
  ])("accepts read goal with read-safe %s action only as bounded risk input", (actionType, actionFields) => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readAssessment({
        action_type: actionType,
        ...actionFields
      }),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: readExpectedScope(),
      ...freshInputs()
    });

    expect(result).toMatchObject({
      accepted_risk_hint: true,
      decision: "allow_input_to_provider_runtime_decision",
      read_write_allow_proof: false,
      account_safety_clearance: false,
      gate_override_proof: false
    });
  });

  it.each(["type", "submit", "confirm", "publish", "purchase", "dispatch", "bind"])(
    "fails closed when read goal carries write-like %s action",
    (actionType) => {
      const result = evaluatePlatformBehaviorAssessmentGate({
        platform_behavior_assessment: readAssessment({ action_type: actionType }),
        platform_behavior_assessment_context: context(),
        expected_platform_behavior_scope: readExpectedScope(),
        ...freshInputs()
      });

      expect(result).toMatchObject({
        accepted_risk_hint: false,
        decision: "blocked",
        read_write_allow_proof: false
      });
      expect(result.gate_reasons).toContain("platform_behavior_read_goal_action_type_invalid");
    }
  );

  it("fails closed when reseed-required assessment keeps ready baseline semantics", () => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment({
        baseline_state: "ready",
        drift_level: "critical",
        decision_hint: "require_reseed",
        reseed_required: true
      }),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: expectedScope(),
      ...freshInputs()
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false
    });
    expect(result.gate_reasons).toContain("platform_behavior_reseed_ready_baseline_invalid");
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["empty", " "]
  ])("fails closed when ready no_additional_restriction assessment has %s baseline_ref", (_name, baselineRef) => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment({ baseline_ref: baselineRef }),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: expectedScope(),
      ...freshInputs()
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false
    });
    expect(result.gate_reasons).toContain("platform_behavior_baseline_ref_missing");
  });

  it("fails closed when a learning assessment without baseline_ref claims no additional restriction", () => {
    const result = evaluatePlatformBehaviorAssessmentGate({
      platform_behavior_assessment: readyWriteAssessment({
        baseline_ref: undefined,
        baseline_state: "learning",
        decision_hint: "no_additional_restriction"
      }),
      platform_behavior_assessment_context: context(),
      expected_platform_behavior_scope: expectedScope(),
      ...freshInputs()
    });

    expect(result).toMatchObject({
      accepted_risk_hint: false,
      decision: "blocked",
      read_write_allow_proof: false
    });
    expect(result.gate_reasons).toEqual(
      expect.arrayContaining([
        "platform_behavior_non_restriction_hint_invalid",
        "platform_behavior_baseline_ref_missing"
      ])
    );
  });

  it("keeps read cold-start hints non-proof and does not require session/live evidence", () => {
    expect(
      evaluatePlatformBehaviorAssessmentGate({
        platform_behavior_assessment: readyWriteAssessment({
          assessment_id: "platform-assess-read-cold-001",
          target_domain: "www.xiaohongshu.com",
          requested_execution_mode: "dry_run",
          effective_execution_mode: "dry_run",
          goal_kind: "read",
          baseline_ref: undefined,
          baseline_state: "unseeded",
          drift_level: "none",
          action_type: "click",
          interaction_semantics: "reveal_only_click",
          click_kind: "open_detail_view",
          decision_hint: "allow_read_only",
          confidence: 0.5,
          reseed_required: false
        }),
        platform_behavior_assessment_context: context(),
        expected_platform_behavior_scope: {
          ...expectedScope(),
          target_domain: "www.xiaohongshu.com",
          requested_execution_mode: "dry_run",
          effective_execution_mode: "dry_run",
          goal_kind: "read"
        },
        ...freshInputs()
      })
    ).toMatchObject({
      accepted_risk_hint: true,
      decision: "allow_input_to_provider_runtime_decision",
      read_write_allow_proof: false,
      baseline_state: "unseeded",
      decision_hint: "allow_read_only"
    });
  });
});
