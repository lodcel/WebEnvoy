import { describe, expect, it } from "vitest";

import {
  buildLayer2EventChainPlan,
  buildLayer2InteractionEvidence,
  buildXhsSearchLayer2InteractionEvidence,
  getLayer2EventChainPolicies,
  resolveLayer2RhythmTiming
} from "../extension/layer2-humanized-events.js";

describe("FR-0013 layer2 humanized events", () => {
  it("builds default keyboard interaction evidence with stable contract objects", () => {
    const evidence = buildLayer2InteractionEvidence({ actionKind: "keyboard_input" });

    expect(evidence.event_strategy_profile).toMatchObject({
      action_kind: "keyboard_input",
      preferred_path: "real_input",
      fallback_path: "synthetic_chain",
      requires_focus: true,
      requires_settled_wait: true
    });
    expect(evidence.event_chain_policy).toMatchObject({
      chain_name: "keyboard_input",
      action_kind: "keyboard_input",
      required_events: expect.arrayContaining(["focus", "keydown", "input", "keyup"])
    });
    expect(evidence.rhythm_profile).toMatchObject({
      profile_name: "default_layer2",
      typing_delay_min_ms: 60,
      typing_delay_max_ms: 220
    });
    expect(evidence.strategy_selection).toMatchObject({
      selected_path: "real_input",
      event_chain: "keyboard_input",
      rhythm_profile: "default_layer2",
      blocked_by: null
    });
    expect(evidence.execution_trace).toMatchObject({
      action_kind: "keyboard_input",
      selected_path: "real_input",
      settled_wait_applied: true,
      settled_wait_result: "timeout",
      failure_category: null
    });
  });

  it("records settled only when the caller supplies an observed wait result", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "keyboard_input",
      settledWaitResult: "settled"
    });

    expect(evidence.execution_trace).toMatchObject({
      action_kind: "keyboard_input",
      settled_wait_applied: true,
      settled_wait_result: "settled"
    });
  });

  it("blocks irreversible writes through FR-0011 tier input", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "composition_input",
      writeInteractionTierName: "irreversible_write"
    });

    expect(evidence.strategy_selection).toMatchObject({
      selected_path: "blocked",
      blocked_by: "FR-0011.write_interaction_tier"
    });
    expect(evidence.execution_trace).toMatchObject({
      selected_path: "blocked",
      settled_wait_applied: false,
      settled_wait_result: "skipped",
      failure_category: "blocked_by_fr0011"
    });
  });

  it("marks gate-only xhs recovery recon probes as not executed", () => {
    const evidence = buildXhsSearchLayer2InteractionEvidence({
      requestedExecutionMode: "recon",
      recoveryProbe: true
    });

    expect(evidence.strategy_selection).toMatchObject({
      action_kind: "scroll",
      selected_path: "blocked",
      event_chain: "scroll_segment",
      blocked_by: "FR-0013.gate_only_probe_no_event_chain"
    });
    expect(evidence.execution_trace).toMatchObject({
      selected_path: "blocked",
      settled_wait_applied: false,
      settled_wait_result: "skipped",
      failure_category: null
    });
  });

  it("includes the frozen change/blur finalize chain policy", () => {
    expect(getLayer2EventChainPolicies()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chain_name: "change_blur_finalize",
          action_kind: "keyboard_input",
          required_events: ["change", "blur"],
          completion_signal: expect.arrayContaining(["framework_value_finalized"])
        })
      ])
    );
  });

  it("builds an executable keyboard event-chain plan from selected strategy", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "keyboard_input",
      settledWaitResult: "settled"
    });
    const plan = buildLayer2EventChainPlan(evidence);

    expect(plan).toMatchObject({
      action_kind: "keyboard_input",
      selected_path: "real_input",
      event_chain: "keyboard_input",
      blocked_by: null,
      requires_settled_wait: true,
      settled_wait_result: "settled",
      completion_signal: ["dom_settled", "framework_value_updated"],
      required_steps: ["focus", "keydown", "input", "keyup", "change", "blur"]
    });
  });

  it("keeps blocked event-chain plans non-executable", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "composition_input",
      writeInteractionTierName: "irreversible_write",
      executionApplied: true
    });
    const plan = buildLayer2EventChainPlan(evidence);

    expect(plan).toMatchObject({
      action_kind: "composition_input",
      selected_path: "blocked",
      event_chain: "composition_input",
      blocked_by: "FR-0011.write_interaction_tier",
      requires_settled_wait: false,
      settled_wait_result: "skipped",
      required_steps: [],
      optional_steps: []
    });
  });

  it("resolves deterministic rhythm timing ranges without session state", () => {
    const evidence = buildLayer2InteractionEvidence({ actionKind: "scroll" });
    const timing = resolveLayer2RhythmTiming(evidence);

    expect(timing).toMatchObject({
      action_kind: "scroll",
      rhythm_profile: "default_layer2",
      hover_confirm_ms: null,
      typing_delay_ms: null,
      scroll_segment_px: {
        min: 120,
        max: 480
      },
      lookback_probability: 0.12
    });
  });

  it("does not emit layer2 evidence for generic xhs recon without recovery probe marker", () => {
    const evidence = buildXhsSearchLayer2InteractionEvidence({
      requestedExecutionMode: "recon",
      recoveryProbe: false
    });

    expect(evidence).toBeNull();
  });

  it("does not emit layer2 evidence for xhs live API replay", () => {
    const evidence = buildXhsSearchLayer2InteractionEvidence({
      requestedExecutionMode: "live_read_high_risk",
      recoveryProbe: false
    });

    expect(evidence).toBeNull();
  });

  it("does not emit recovery evidence for non-recon modes even when marked as recovery probe", () => {
    const evidence = buildXhsSearchLayer2InteractionEvidence({
      requestedExecutionMode: "live_read_high_risk",
      recoveryProbe: true
    });

    expect(evidence).toBeNull();
  });

  it("builds xhs search layer2 evidence from observed passive keyboard action", () => {
    const evidence = buildXhsSearchLayer2InteractionEvidence({
      requestedExecutionMode: "live_read_limited",
      recoveryProbe: false,
      humanizedActionKind: "keyboard_input",
      settledWaitResult: "settled",
      executionApplied: true
    });

    expect(evidence?.strategy_selection).toMatchObject({
      action_kind: "keyboard_input",
      selected_path: "real_input",
      event_chain: "keyboard_input",
      blocked_by: null
    });
    expect(evidence?.execution_trace).toMatchObject({
      action_kind: "keyboard_input",
      selected_path: "real_input",
      settled_wait_applied: true,
      settled_wait_result: "settled",
      failure_category: null
    });
  });

  it("does not mark xhs search passive action evidence as applied by default", () => {
    const evidence = buildXhsSearchLayer2InteractionEvidence({
      requestedExecutionMode: "live_read_limited",
      recoveryProbe: false,
      humanizedActionKind: "keyboard_input"
    });

    expect(evidence?.strategy_selection).toMatchObject({
      action_kind: "keyboard_input",
      selected_path: "blocked",
      blocked_by: "FR-0013.gate_only_probe_no_event_chain"
    });
    expect(evidence?.execution_trace).toMatchObject({
      selected_path: "blocked",
      settled_wait_applied: false,
      settled_wait_result: "skipped"
    });
  });

  it("maps observed hover click actions to click strategy without changing gate truth", () => {
    const evidence = buildXhsSearchLayer2InteractionEvidence({
      requestedExecutionMode: "live_read_limited",
      recoveryProbe: false,
      humanizedActionKind: "hover_click",
      settledWaitResult: "settled",
      executionApplied: true
    });

    expect(evidence?.event_strategy_profile).toMatchObject({
      action_kind: "click",
      requires_hover_confirm: true
    });
    expect(evidence?.strategy_selection).toMatchObject({
      selected_path: "real_input",
      event_chain: "hover_click"
    });
  });

  it("does not emit xhs search layer2 evidence for unknown passive action kinds", () => {
    const evidence = buildXhsSearchLayer2InteractionEvidence({
      requestedExecutionMode: "live_read_limited",
      recoveryProbe: false,
      humanizedActionKind: "existing_passive_exact_hit",
      executionApplied: true
    });

    expect(evidence).toBeNull();
  });
});
