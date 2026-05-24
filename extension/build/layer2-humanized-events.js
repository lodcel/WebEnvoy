const DEFAULT_RHYTHM_PROFILE = {
    profile_name: "default_layer2",
    hover_confirm_min_ms: 80,
    hover_confirm_max_ms: 200,
    click_jitter_min_px: 2,
    click_jitter_max_px: 8,
    typing_delay_min_ms: 60,
    typing_delay_max_ms: 220,
    punctuation_pause_multiplier: 1.8,
    long_pause_probability: 0.08,
    scroll_segment_min_px: 120,
    scroll_segment_max_px: 480,
    lookback_probability: 0.12
};
const STRATEGY_PROFILES = {
    click: {
        action_kind: "click",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: false,
        requires_hover_confirm: true,
        requires_settled_wait: true,
        blocked_when_tier: ["irreversible_write"]
    },
    focus: {
        action_kind: "focus",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: true,
        requires_hover_confirm: false,
        requires_settled_wait: true,
        blocked_when_tier: ["irreversible_write"]
    },
    keyboard_input: {
        action_kind: "keyboard_input",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: true,
        requires_hover_confirm: false,
        requires_settled_wait: true,
        blocked_when_tier: ["irreversible_write"]
    },
    composition_input: {
        action_kind: "composition_input",
        preferred_path: "mixed_input",
        fallback_path: "synthetic_chain",
        requires_focus: true,
        requires_hover_confirm: false,
        requires_settled_wait: true,
        blocked_when_tier: ["irreversible_write"]
    },
    hover: {
        action_kind: "hover",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: false,
        requires_hover_confirm: true,
        requires_settled_wait: false,
        blocked_when_tier: []
    },
    scroll: {
        action_kind: "scroll",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: false,
        requires_hover_confirm: false,
        requires_settled_wait: true,
        blocked_when_tier: []
    }
};
const EVENT_CHAINS = {
    click: {
        chain_name: "hover_click",
        action_kind: "click",
        required_events: ["mousemove", "mouseover", "mousedown", "mouseup", "click"],
        optional_events: ["pointermove", "pointerdown", "pointerup"],
        completion_signal: ["dom_settled"],
        requires_settled_wait: true
    },
    focus: {
        chain_name: "focus_acquire",
        action_kind: "focus",
        required_events: ["focus"],
        optional_events: ["mousedown", "mouseup", "click"],
        completion_signal: ["document_active_element_matched"],
        requires_settled_wait: true
    },
    keyboard_input: {
        chain_name: "keyboard_input",
        action_kind: "keyboard_input",
        required_events: ["focus", "keydown", "input", "keyup", "change", "blur"],
        optional_events: ["mousedown", "mouseup", "click"],
        completion_signal: ["dom_settled", "framework_value_updated"],
        requires_settled_wait: true
    },
    composition_input: {
        chain_name: "composition_input",
        action_kind: "composition_input",
        required_events: [
            "focus",
            "compositionstart",
            "compositionupdate",
            "compositionend",
            "input",
            "change",
            "blur"
        ],
        optional_events: ["mousedown", "mouseup", "click"],
        completion_signal: ["dom_settled", "framework_value_updated"],
        requires_settled_wait: true
    },
    hover: {
        chain_name: "hover_confirm",
        action_kind: "hover",
        required_events: ["mousemove", "mouseover"],
        optional_events: ["pointermove"],
        completion_signal: ["hover_confirmed"],
        requires_settled_wait: false
    },
    scroll: {
        chain_name: "scroll_segment",
        action_kind: "scroll",
        required_events: ["wheel", "scroll"],
        optional_events: ["mousemove"],
        completion_signal: ["viewport_position_changed", "dom_settled"],
        requires_settled_wait: true
    }
};
const CHANGE_BLUR_FINALIZE_CHAIN = {
    chain_name: "change_blur_finalize",
    action_kind: "keyboard_input",
    required_events: ["change", "blur"],
    optional_events: ["input"],
    completion_signal: ["framework_value_finalized", "dom_settled"],
    requires_settled_wait: true
};
const clone = (value) => JSON.parse(JSON.stringify(value));
export const getLayer2EventChainPolicies = () => [
    ...Object.values(EVENT_CHAINS).map((chain) => clone(chain)),
    clone(CHANGE_BLUR_FINALIZE_CHAIN)
];
export const buildLayer2EventChainPlan = (evidence) => {
    const selectedPath = evidence.strategy_selection.selected_path;
    const blocked = selectedPath === "blocked";
    return {
        action_kind: evidence.strategy_selection.action_kind,
        selected_path: selectedPath,
        event_chain: evidence.strategy_selection.event_chain,
        required_steps: blocked ? [] : [...evidence.event_chain_policy.required_events],
        optional_steps: blocked ? [] : [...evidence.event_chain_policy.optional_events],
        completion_signal: blocked ? [] : [...evidence.event_chain_policy.completion_signal],
        requires_settled_wait: blocked ? false : evidence.event_chain_policy.requires_settled_wait,
        settled_wait_result: blocked ? "skipped" : evidence.execution_trace.settled_wait_result,
        blocked_by: evidence.strategy_selection.blocked_by
    };
};
export const resolveLayer2RhythmTiming = (evidence) => {
    const actionKind = evidence.strategy_selection.action_kind;
    const rhythm = evidence.rhythm_profile;
    const requiresHover = evidence.event_strategy_profile.requires_hover_confirm;
    const requiresClickJitter = actionKind === "click";
    const requiresTyping = actionKind === "keyboard_input" || actionKind === "composition_input";
    const requiresScroll = actionKind === "scroll";
    return {
        action_kind: actionKind,
        rhythm_profile: rhythm.profile_name,
        hover_confirm_ms: requiresHover
            ? {
                min: rhythm.hover_confirm_min_ms,
                max: rhythm.hover_confirm_max_ms
            }
            : null,
        click_jitter_px: requiresClickJitter
            ? {
                min: rhythm.click_jitter_min_px,
                max: rhythm.click_jitter_max_px
            }
            : null,
        typing_delay_ms: requiresTyping
            ? {
                min: rhythm.typing_delay_min_ms,
                max: rhythm.typing_delay_max_ms
            }
            : null,
        scroll_segment_px: requiresScroll
            ? {
                min: rhythm.scroll_segment_min_px,
                max: rhythm.scroll_segment_max_px
            }
            : null,
        punctuation_pause_multiplier: requiresTyping ? rhythm.punctuation_pause_multiplier : null,
        long_pause_probability: requiresTyping ? rhythm.long_pause_probability : null,
        lookback_probability: requiresScroll ? rhythm.lookback_probability : null
    };
};
export const buildLayer2RhythmPlan = (evidence, input) => {
    const selectedPath = evidence.strategy_selection.selected_path;
    if (selectedPath === "blocked") {
        return {
            action_kind: evidence.strategy_selection.action_kind,
            selected_path: selectedPath,
            rhythm_profile: "default_layer2",
            steps: [],
            blocked_by: evidence.strategy_selection.blocked_by
        };
    }
    const timing = resolveLayer2RhythmTiming(evidence);
    const steps = [];
    if (timing.hover_confirm_ms) {
        steps.push({
            step_kind: "hover_confirm",
            event_ref: "mouseover",
            delay_ms: timing.hover_confirm_ms,
            offset_px: null,
            delta_px: null,
            probability: null
        });
    }
    if (timing.click_jitter_px) {
        steps.push({
            step_kind: "click_jitter",
            event_ref: "click",
            delay_ms: null,
            offset_px: timing.click_jitter_px,
            delta_px: null,
            probability: null
        });
    }
    if (timing.typing_delay_ms) {
        const text = input?.text;
        if (typeof text === "string" && text.length > 0) {
            for (const character of text) {
                const punctuationPause = isLayer2Punctuation(character);
                steps.push({
                    step_kind: punctuationPause ? "punctuation_pause" : "typing_delay",
                    event_ref: "input",
                    delay_ms: punctuationPause
                        ? scaleRange(timing.typing_delay_ms, timing.punctuation_pause_multiplier ?? 1)
                        : timing.typing_delay_ms,
                    offset_px: null,
                    delta_px: null,
                    probability: null
                });
            }
            if (timing.long_pause_probability !== null) {
                steps.push({
                    step_kind: "long_pause",
                    event_ref: "input",
                    delay_ms: scaleRange(timing.typing_delay_ms, 3),
                    offset_px: null,
                    delta_px: null,
                    probability: timing.long_pause_probability
                });
            }
        }
    }
    if (timing.scroll_segment_px) {
        const segmentCount = clampLayer2SegmentCount(input?.scrollSegmentCount ?? 1);
        for (let index = 0; index < segmentCount; index += 1) {
            steps.push({
                step_kind: "scroll_segment",
                event_ref: "wheel",
                delay_ms: null,
                offset_px: null,
                delta_px: timing.scroll_segment_px,
                probability: null
            });
        }
        if (input?.includeLookback && timing.lookback_probability !== null) {
            steps.push({
                step_kind: "lookback",
                event_ref: "wheel",
                delay_ms: null,
                offset_px: null,
                delta_px: reverseRange(timing.scroll_segment_px),
                probability: timing.lookback_probability
            });
        }
    }
    return {
        action_kind: evidence.strategy_selection.action_kind,
        selected_path: selectedPath,
        rhythm_profile: "default_layer2",
        steps,
        blocked_by: null
    };
};
export const buildLayer2InteractionEvidence = (input) => {
    const strategy = clone(STRATEGY_PROFILES[input.actionKind]);
    const chain = clone(EVENT_CHAINS[input.actionKind]);
    const rhythm = clone(DEFAULT_RHYTHM_PROFILE);
    const gateOnlyBlockedBy = input.executionApplied === false ? "FR-0013.gate_only_probe_no_event_chain" : null;
    const tierBlockedBy = input.writeInteractionTierName &&
        strategy.blocked_when_tier.includes(input.writeInteractionTierName)
        ? "FR-0011.write_interaction_tier"
        : null;
    const blockedBy = gateOnlyBlockedBy ?? tierBlockedBy;
    const selectedPath = blockedBy ? "blocked" : strategy.preferred_path;
    const settledWaitApplied = selectedPath !== "blocked" && chain.requires_settled_wait;
    const settledWaitResult = selectedPath === "blocked"
        ? "skipped"
        : settledWaitApplied
            ? input.settledWaitResult ?? "timeout"
            : "skipped";
    return {
        event_strategy_profile: strategy,
        event_chain_policy: chain,
        rhythm_profile: rhythm,
        strategy_selection: {
            action_kind: input.actionKind,
            selected_path: selectedPath,
            strategy_profile: `${input.actionKind}_default`,
            event_chain: chain.chain_name,
            rhythm_profile: rhythm.profile_name,
            fallback_reason: null,
            blocked_by: blockedBy
        },
        execution_trace: {
            action_kind: input.actionKind,
            selected_path: selectedPath,
            event_chain: chain.chain_name,
            rhythm_profile_source: input.rhythmProfileSource ?? "default",
            settled_wait_applied: settledWaitApplied,
            settled_wait_result: settledWaitResult,
            failure_category: tierBlockedBy ? "blocked_by_fr0011" : null
        }
    };
};
export const buildXhsSearchLayer2InteractionEvidence = (input) => {
    if (input.recoveryProbe && input.requestedExecutionMode === "recon") {
        return buildLayer2InteractionEvidence({
            actionKind: "scroll",
            writeInteractionTierName: input.writeInteractionTierName ?? null,
            executionApplied: input.executionApplied ?? false
        });
    }
    const actionKind = normalizeHumanizedActionKind(input.humanizedActionKind);
    if (!actionKind) {
        return null;
    }
    return buildLayer2InteractionEvidence({
        actionKind,
        writeInteractionTierName: input.writeInteractionTierName ?? null,
        settledWaitResult: input.settledWaitResult ?? "settled",
        executionApplied: input.executionApplied ?? false
    });
};
const normalizeHumanizedActionKind = (value) => {
    if (!value) {
        return null;
    }
    if (value === "keyboard_input" || value === "composition_input" || value === "scroll") {
        return value;
    }
    if (value === "hover_click") {
        return "click";
    }
    if (value === "focus_acquire") {
        return "focus";
    }
    if (value === "hover_confirm") {
        return "hover";
    }
    return null;
};
const scaleRange = (range, multiplier) => ({
    min: Math.round(range.min * multiplier),
    max: Math.round(range.max * multiplier)
});
const reverseRange = (range) => ({
    min: -range.max,
    max: -range.min
});
const clampLayer2SegmentCount = (value) => {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.max(1, Math.min(8, Math.trunc(value)));
};
const isLayer2Punctuation = (value) => /[,.!?;:，。！？；：]/u.test(value);
