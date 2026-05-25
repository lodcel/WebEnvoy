import { describe, expect, it } from "vitest";

import {
  buildLayer2EventChainPlan,
  buildLayer2InteractionEvidence,
  buildLayer2RhythmPlan,
  buildLayer2ScheduledEventChain,
  buildXhsSearchLayer2InteractionEvidence,
  dispatchLayer2ScheduledEventChain,
  getLayer2EventChainPolicies,
  resolveLayer2RhythmTiming
} from "../extension/layer2-humanized-events.js";

class Layer2MockDispatchTarget extends EventTarget {
  value = "";
  focused = false;
  blurred = false;
  readonly dispatched: string[] = [];

  constructor(private readonly failingEvents: string[] = []) {
    super();
  }

  focus() {
    this.focused = true;
  }

  blur() {
    this.blurred = true;
  }

  dispatchEvent(event: Event): boolean {
    this.dispatched.push(event.type);
    if (this.failingEvents.includes(event.type)) {
      return false;
    }
    return super.dispatchEvent(event);
  }
}

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

  it("builds a scheduled keyboard event chain with rhythm steps attached to input events", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "keyboard_input",
      executionApplied: true,
      settledWaitResult: "settled"
    });
    const schedule = buildLayer2ScheduledEventChain(evidence, { text: "ok!" });

    expect(schedule).toMatchObject({
      action_kind: "keyboard_input",
      selected_path: "real_input",
      event_chain: "keyboard_input",
      completion_signal: ["dom_settled", "framework_value_updated"],
      requires_settled_wait: true,
      blocked_by: null
    });
    expect(schedule.scheduled_events.map((event) => event.event_ref)).toEqual([
      "focus",
      "keydown",
      "input",
      "keyup",
      "change",
      "blur"
    ]);
    expect(schedule.scheduled_events).toContainEqual(
      expect.objectContaining({
        sequence_index: 2,
        event_ref: "input",
        required: true,
        rhythm_steps: [
          expect.objectContaining({ step_kind: "typing_delay" }),
          expect.objectContaining({ step_kind: "typing_delay" }),
          expect.objectContaining({ step_kind: "punctuation_pause" }),
          expect.objectContaining({ step_kind: "long_pause" })
        ]
      })
    );
  });

  it("builds a scheduled click event chain with hover and click rhythm attached to event refs", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "click",
      executionApplied: true,
      settledWaitResult: "settled"
    });
    const schedule = buildLayer2ScheduledEventChain(evidence);

    expect(schedule.scheduled_events.map((event) => event.event_ref)).toEqual([
      "mousemove",
      "mouseover",
      "mousedown",
      "mouseup",
      "click"
    ]);
    expect(schedule.scheduled_events).toContainEqual(
      expect.objectContaining({
        event_ref: "mouseover",
        rhythm_steps: [expect.objectContaining({ step_kind: "hover_confirm" })]
      })
    );
    expect(schedule.scheduled_events).toContainEqual(
      expect.objectContaining({
        event_ref: "click",
        rhythm_steps: [expect.objectContaining({ step_kind: "click_jitter" })]
      })
    );
  });

  it("keeps blocked scheduled event chains non-executable", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "composition_input",
      writeInteractionTierName: "irreversible_write",
      executionApplied: true
    });
    const schedule = buildLayer2ScheduledEventChain(evidence, { text: "blocked" });

    expect(schedule).toMatchObject({
      action_kind: "composition_input",
      selected_path: "blocked",
      event_chain: "composition_input",
      scheduled_events: [],
      completion_signal: [],
      requires_settled_wait: false,
      blocked_by: "FR-0011.write_interaction_tier"
    });
  });

  it("dispatches the keyboard input event chain and applies text without session state", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "keyboard_input",
      executionApplied: true,
      settledWaitResult: "settled"
    });
    const schedule = buildLayer2ScheduledEventChain(evidence, { text: "hello" });
    const target = new Layer2MockDispatchTarget();
    const result = dispatchLayer2ScheduledEventChain(target, schedule, { text: "hello" });

    expect(target.focused).toBe(true);
    expect(target.blurred).toBe(true);
    expect(target.value).toBe("hello");
    expect(target.dispatched).toEqual(["focus", "keydown", "input", "keyup", "change", "blur"]);
    expect(result).toMatchObject({
      action_kind: "keyboard_input",
      selected_path: "real_input",
      event_chain: "keyboard_input",
      dispatched_events: ["focus", "keydown", "input", "keyup", "change", "blur"],
      required_events_applied: ["focus", "keydown", "input", "keyup", "change", "blur"],
      text_applied: "hello",
      blocked_by: null
    });
  });

  it("dispatches composition input with composition lifecycle before input finalize", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "composition_input",
      executionApplied: true,
      settledWaitResult: "settled"
    });
    const schedule = buildLayer2ScheduledEventChain(evidence, { text: "中文" });
    const target = new Layer2MockDispatchTarget();
    const result = dispatchLayer2ScheduledEventChain(target, schedule, { text: "中文" });

    expect(target.value).toBe("中文");
    expect(target.dispatched).toEqual([
      "focus",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "input",
      "change",
      "blur"
    ]);
    expect(result.required_events_applied).toEqual([
      "focus",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "input",
      "change",
      "blur"
    ]);
  });

  it("dispatches hover and click through the scheduled pointer chain", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "click",
      executionApplied: true,
      settledWaitResult: "settled"
    });
    const schedule = buildLayer2ScheduledEventChain(evidence);
    const target = new Layer2MockDispatchTarget();
    const result = dispatchLayer2ScheduledEventChain(target, schedule);

    expect(target.dispatched).toEqual(["mousemove", "mouseover", "mousedown", "mouseup", "click"]);
    expect(result.required_events_applied).toEqual([
      "mousemove",
      "mouseover",
      "mousedown",
      "mouseup",
      "click"
    ]);
  });

  it("dispatches focus/blur acquisition as its own chain", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "focus",
      executionApplied: true,
      settledWaitResult: "settled"
    });
    const schedule = buildLayer2ScheduledEventChain(evidence);
    const target = new Layer2MockDispatchTarget();
    const result = dispatchLayer2ScheduledEventChain(target, schedule);

    expect(target.focused).toBe(true);
    expect(target.dispatched).toEqual(["focus"]);
    expect(result.required_events_applied).toEqual(["focus"]);
  });

  it("dispatches scroll with bounded default delta and optional window scroll hook", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "scroll",
      executionApplied: true,
      settledWaitResult: "settled"
    });
    const schedule = buildLayer2ScheduledEventChain(evidence, { scrollSegmentCount: 1 });
    const target = new Layer2MockDispatchTarget();
    const scrollCalls: Array<{ top: number; left: number; behavior: "auto" }> = [];
    const result = dispatchLayer2ScheduledEventChain(target, schedule, {
      windowLike: {
        scrollBy: (options) => {
          scrollCalls.push(options);
        }
      }
    });

    expect(target.dispatched).toEqual(["wheel", "scroll"]);
    expect(scrollCalls).toEqual([{ top: 120, left: 0, behavior: "auto" }]);
    expect(result).toMatchObject({
      action_kind: "scroll",
      dispatched_events: ["wheel", "scroll"],
      required_events_applied: ["wheel", "scroll"],
      scroll_delta_applied: 120,
      blocked_by: null
    });
  });

  it("does not dispatch blocked scheduled event chains", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "keyboard_input",
      writeInteractionTierName: "irreversible_write",
      executionApplied: true
    });
    const schedule = buildLayer2ScheduledEventChain(evidence, { text: "blocked" });
    const target = new Layer2MockDispatchTarget();
    const result = dispatchLayer2ScheduledEventChain(target, schedule, { text: "blocked" });

    expect(target.dispatched).toEqual([]);
    expect(target.value).toBe("");
    expect(result).toMatchObject({
      dispatched_events: [],
      required_events_applied: [],
      skipped_events: [],
      text_applied: null,
      blocked_by: "FR-0011.write_interaction_tier"
    });
  });

  it("reports required event dispatch failures without marking them applied", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "click",
      executionApplied: true,
      settledWaitResult: "settled"
    });
    const schedule = buildLayer2ScheduledEventChain(evidence);
    const target = new Layer2MockDispatchTarget(["mouseover"]);
    const result = dispatchLayer2ScheduledEventChain(target, schedule);

    expect(target.dispatched).toEqual(["mousemove", "mouseover", "mousedown", "mouseup", "click"]);
    expect(result.dispatched_events).toEqual(["mousemove", "mousedown", "mouseup", "click"]);
    expect(result.required_events_applied).toEqual(["mousemove", "mousedown", "mouseup", "click"]);
    expect(result.skipped_events).toEqual(["mouseover"]);
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

  it("builds input rhythm steps with punctuation and bounded long-pause probability", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "keyboard_input",
      executionApplied: true
    });
    const plan = buildLayer2RhythmPlan(evidence, { text: "hi!" });

    expect(plan).toMatchObject({
      action_kind: "keyboard_input",
      selected_path: "real_input",
      rhythm_profile: "default_layer2",
      blocked_by: null
    });
    expect(plan.steps).toEqual([
      {
        step_kind: "typing_delay",
        event_ref: "input",
        delay_ms: { min: 60, max: 220 },
        offset_px: null,
        delta_px: null,
        probability: null
      },
      {
        step_kind: "typing_delay",
        event_ref: "input",
        delay_ms: { min: 60, max: 220 },
        offset_px: null,
        delta_px: null,
        probability: null
      },
      {
        step_kind: "punctuation_pause",
        event_ref: "input",
        delay_ms: { min: 108, max: 396 },
        offset_px: null,
        delta_px: null,
        probability: null
      },
      {
        step_kind: "long_pause",
        event_ref: "input",
        delay_ms: { min: 180, max: 660 },
        offset_px: null,
        delta_px: null,
        probability: 0.08
      }
    ]);
  });

  it("builds composition input rhythm steps from text", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "composition_input",
      executionApplied: true
    });
    const plan = buildLayer2RhythmPlan(evidence, { text: "中。" });

    expect(plan).toMatchObject({
      action_kind: "composition_input",
      selected_path: "mixed_input",
      rhythm_profile: "default_layer2",
      blocked_by: null
    });
    expect(plan.steps.map((step) => step.step_kind)).toEqual([
      "typing_delay",
      "punctuation_pause",
      "long_pause"
    ]);
  });

  it("does not build empty typing rhythm steps when text is missing", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "keyboard_input",
      executionApplied: true
    });
    const plans = [
      buildLayer2RhythmPlan(evidence),
      buildLayer2RhythmPlan(evidence, { text: "" }),
      buildLayer2RhythmPlan(evidence, { text: null })
    ];

    for (const plan of plans) {
      expect(plan).toMatchObject({
        action_kind: "keyboard_input",
        selected_path: "real_input",
        rhythm_profile: "default_layer2",
        blocked_by: null
      });
      expect(plan.steps).toEqual([]);
    }
  });

  it("builds hover and click rhythm steps without session state", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "click",
      executionApplied: true
    });
    const plan = buildLayer2RhythmPlan(evidence);

    expect(plan.steps).toEqual([
      {
        step_kind: "hover_confirm",
        event_ref: "mouseover",
        delay_ms: { min: 80, max: 200 },
        offset_px: null,
        delta_px: null,
        probability: null
      },
      {
        step_kind: "click_jitter",
        event_ref: "click",
        delay_ms: null,
        offset_px: { min: 2, max: 8 },
        delta_px: null,
        probability: null
      }
    ]);
  });

  it("builds hover-only rhythm steps without click jitter", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "hover",
      executionApplied: true
    });
    const plan = buildLayer2RhythmPlan(evidence);

    expect(plan).toMatchObject({
      action_kind: "hover",
      selected_path: "real_input",
      rhythm_profile: "default_layer2",
      blocked_by: null
    });
    expect(plan.steps).toEqual([
      {
        step_kind: "hover_confirm",
        event_ref: "mouseover",
        delay_ms: { min: 80, max: 200 },
        offset_px: null,
        delta_px: null,
        probability: null
      }
    ]);
  });

  it("builds scroll segments and optional lookback rhythm steps", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "scroll",
      executionApplied: true
    });
    const plan = buildLayer2RhythmPlan(evidence, {
      scrollSegmentCount: 2,
      includeLookback: true
    });

    expect(plan.steps).toEqual([
      {
        step_kind: "scroll_segment",
        event_ref: "wheel",
        delay_ms: null,
        offset_px: null,
        delta_px: { min: 120, max: 480 },
        probability: null
      },
      {
        step_kind: "scroll_segment",
        event_ref: "wheel",
        delay_ms: null,
        offset_px: null,
        delta_px: { min: 120, max: 480 },
        probability: null
      },
      {
        step_kind: "lookback",
        event_ref: "wheel",
        delay_ms: null,
        offset_px: null,
        delta_px: { min: -480, max: -120 },
        probability: 0.12
      }
    ]);
  });

  it("clamps scroll segment counts to the layer2 rhythm plan bounds", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "scroll",
      executionApplied: true
    });

    expect(buildLayer2RhythmPlan(evidence, { scrollSegmentCount: -10 }).steps).toHaveLength(1);
    expect(buildLayer2RhythmPlan(evidence, { scrollSegmentCount: Number.NaN }).steps).toHaveLength(1);
    expect(buildLayer2RhythmPlan(evidence, { scrollSegmentCount: 12 }).steps).toHaveLength(8);
  });

  it("does not build rhythm steps for blocked layer2 plans", () => {
    const evidence = buildLayer2InteractionEvidence({
      actionKind: "keyboard_input",
      executionApplied: false
    });
    const plan = buildLayer2RhythmPlan(evidence, { text: "blocked" });

    expect(plan).toMatchObject({
      action_kind: "keyboard_input",
      selected_path: "blocked",
      steps: [],
      blocked_by: "FR-0013.gate_only_probe_no_event_chain"
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
