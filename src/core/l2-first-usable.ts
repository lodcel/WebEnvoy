import { CliError } from "./errors.js";
import {
  parseCandidateAbilityDescriptorForContract,
  resolveCandidateAbilityContractsForContract,
  type CandidateAbilityContractRegistry,
  type CandidateAbilityContractRegistryEntry,
  type CandidateAbilityDescriptor
} from "./candidate-ability.js";
import type { JsonObject } from "./types.js";

export type L2RiskState = "paused" | "limited" | "allowed";
export type L2AllowedAction =
  | "navigate"
  | "locate"
  | "reveal_only_click"
  | "extract"
  | "wait_settled";
export type L2ClickKind =
  | "expand_or_collapse"
  | "switch_content_tab"
  | "open_detail_view"
  | "load_more_or_paginate";
export type L2FallbackReason =
  | "insufficient_semantic_structure"
  | "target_not_located"
  | "state_not_settled";
export type L2RecommendedStrategy =
  | "visual_reacquire"
  | "visual_state_check"
  | "visual_then_physical_act";

export interface L2RiskGateContext {
  run_id: string;
  session_id?: string;
  profile: string;
  target_domain: string;
  target_tab_id: number;
  target_page: string;
  risk_state: L2RiskState;
}

export interface L2FirstUsableRequest {
  target_url: string;
  goal_kind: "read";
  interaction_safety_class: "pure_read";
  goal_hint?: string;
  risk_gate_context: L2RiskGateContext;
  allowed_actions: L2AllowedAction[];
}

export interface FirstUsableTraceStep {
  step_id: string;
  action: string;
  target_hint: string;
  result: string;
}

export type L2InteractionTraceStep =
  | {
      action: "navigate" | "locate" | "extract" | "wait_settled";
      target_ref: string;
      settled: boolean;
      interaction_semantics: "neutral";
    }
  | {
      action: "click";
      target_ref: string;
      settled: boolean;
      interaction_semantics: "reveal_only_click";
      click_kind: L2ClickKind;
    };

export interface L1FallbackPayload {
  fallback_goal: "read";
  fallback_reason: L2FallbackReason;
  recommended_strategy: L2RecommendedStrategy;
}

export interface CandidateShellSeed {
  ability_id: string;
  display_name: string;
  ability_kind: "read";
  entrypoint: string;
  platform_scope: {
    platform_family: string;
    site_pattern?: string;
  };
  execution_layer_support: ["L2"];
  input_contract_ref: string;
  output_contract_ref: string;
  error_contract_ref: string;
  capture_origin: "l2_first_usable_sample";
  capture_run_id: string;
  capture_profile: string;
  capture_artifact_refs?: string[];
  captured_at: string;
  candidate_status: "draft_candidate";
  contract_registry_seed: {
    ability_id: string;
    entries: CandidateAbilityContractRegistryEntry[];
  };
}

export type L2FirstUsableResult =
  | {
      success: true;
      result_summary: JsonObject;
      first_usable_trace: FirstUsableTraceStep[];
      interaction_trace: L2InteractionTraceStep[];
      capture_hints: JsonObject;
      candidate_shell_seed: CandidateShellSeed;
    }
  | {
      success: false;
      failure_class: "risk_gate_blocked";
      result_summary?: JsonObject;
      first_usable_trace?: FirstUsableTraceStep[];
      interaction_trace?: L2InteractionTraceStep[];
      capture_hints?: JsonObject;
    }
  | {
      success: false;
      failure_class: "requires_l1_fallback";
      l1_fallback_payload: L1FallbackPayload;
      result_summary?: JsonObject;
      first_usable_trace?: FirstUsableTraceStep[];
      interaction_trace?: L2InteractionTraceStep[];
      capture_hints?: JsonObject;
    };

export interface MaterializedL2CandidateAbility {
  candidate_ability_descriptor: CandidateAbilityDescriptor;
  candidate_ability_contract_registry: CandidateAbilityContractRegistry;
}

const ALLOWED_ACTIONS = new Set<L2AllowedAction>([
  "navigate",
  "locate",
  "reveal_only_click",
  "extract",
  "wait_settled"
]);
const RISK_STATES = new Set<L2RiskState>(["paused", "limited", "allowed"]);
const CLICK_KINDS = new Set<L2ClickKind>([
  "expand_or_collapse",
  "switch_content_tab",
  "open_detail_view",
  "load_more_or_paginate"
]);
const FALLBACK_REASONS = new Set<L2FallbackReason>([
  "insufficient_semantic_structure",
  "target_not_located",
  "state_not_settled"
]);
const RECOMMENDED_STRATEGIES = new Set<L2RecommendedStrategy>([
  "visual_reacquire",
  "visual_state_check",
  "visual_then_physical_act"
]);

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const hasOwn = (value: JsonObject, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const cloneJsonObject = (value: JsonObject): JsonObject =>
  JSON.parse(JSON.stringify(value)) as JsonObject;

const invalidL2Input = (reason: string, abilityId = "l2.first_usable"): CliError =>
  new CliError("ERR_CLI_INVALID_ARGS", "L2 first usable input invalid", {
    details: {
      ability_id: abilityId,
      stage: "input_validation",
      reason
    }
  });

const parseRequiredString = (
  source: JsonObject,
  key: string,
  reason: string,
  abilityId = "l2.first_usable"
): string => {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidL2Input(reason, abilityId);
  }
  return value.trim();
};

const parseOptionalString = (
  source: JsonObject,
  key: string,
  reason: string,
  abilityId = "l2.first_usable"
): string | undefined => {
  if (!hasOwn(source, key) || source[key] === undefined) {
    return undefined;
  }
  return parseRequiredString(source, key, reason, abilityId);
};

const parseRiskGateContext = (value: unknown): L2RiskGateContext => {
  const object = asObject(value);
  if (!object) {
    throw invalidL2Input("RISK_GATE_CONTEXT_INVALID");
  }
  const runId = parseRequiredString(object, "run_id", "RISK_RUN_ID_INVALID");
  const sessionId = parseOptionalString(object, "session_id", "RISK_SESSION_ID_INVALID");
  const profile = parseRequiredString(object, "profile", "RISK_PROFILE_INVALID");
  const targetDomain = parseRequiredString(object, "target_domain", "TARGET_DOMAIN_INVALID");
  const targetTabId = object.target_tab_id;
  if (typeof targetTabId !== "number" || !Number.isInteger(targetTabId)) {
    throw invalidL2Input("TARGET_TAB_ID_INVALID");
  }
  const targetPage = parseRequiredString(object, "target_page", "TARGET_PAGE_INVALID");
  const riskState = parseRequiredString(object, "risk_state", "RISK_STATE_INVALID");
  if (!RISK_STATES.has(riskState as L2RiskState)) {
    throw invalidL2Input("RISK_STATE_INVALID");
  }
  return {
    run_id: runId,
    ...(sessionId ? { session_id: sessionId } : {}),
    profile,
    target_domain: targetDomain,
    target_tab_id: targetTabId,
    target_page: targetPage,
    risk_state: riskState as L2RiskState
  };
};

const parseAllowedActions = (value: unknown): L2AllowedAction[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidL2Input("ALLOWED_ACTIONS_INVALID");
  }
  const seen = new Set<L2AllowedAction>();
  const parsed: L2AllowedAction[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !ALLOWED_ACTIONS.has(item as L2AllowedAction)) {
      throw invalidL2Input("ALLOWED_ACTIONS_INVALID");
    }
    const action = item as L2AllowedAction;
    if (seen.has(action)) {
      throw invalidL2Input("ALLOWED_ACTIONS_DUPLICATE");
    }
    seen.add(action);
    parsed.push(action);
  }
  if (!seen.has("extract")) {
    throw invalidL2Input("ALLOWED_ACTIONS_EXTRACT_REQUIRED");
  }
  return parsed;
};

const assertTargetUrlMatchesDomain = (targetUrl: string, targetDomain: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw invalidL2Input("TARGET_URL_INVALID");
  }
  if (parsed.hostname !== targetDomain) {
    throw invalidL2Input("TARGET_URL_DOMAIN_MISMATCH");
  }
};

export const parseL2FirstUsableRequestForContract = (
  value: unknown,
  runtime?: { profile?: string | null; runId?: string | null }
): L2FirstUsableRequest => {
  const source = asObject(value);
  const object = asObject(source?.l2_first_usable_request) ?? source;
  if (!object) {
    throw invalidL2Input("REQUEST_INVALID");
  }
  const targetUrl = parseRequiredString(object, "target_url", "TARGET_URL_INVALID");
  const riskGateContext = parseRiskGateContext(object.risk_gate_context);
  assertTargetUrlMatchesDomain(targetUrl, riskGateContext.target_domain);
  if (runtime?.profile !== undefined && runtime.profile !== riskGateContext.profile) {
    throw invalidL2Input("PROFILE_MISMATCH");
  }
  if (runtime?.runId !== undefined && runtime.runId !== riskGateContext.run_id) {
    throw invalidL2Input("RUN_ID_MISMATCH");
  }
  const goalKind = parseRequiredString(object, "goal_kind", "GOAL_KIND_INVALID");
  if (goalKind !== "read") {
    throw invalidL2Input("GOAL_KIND_INVALID");
  }
  const safetyClass = parseRequiredString(
    object,
    "interaction_safety_class",
    "INTERACTION_SAFETY_CLASS_INVALID"
  );
  if (safetyClass !== "pure_read") {
    throw invalidL2Input("INTERACTION_SAFETY_CLASS_INVALID");
  }
  return {
    target_url: targetUrl,
    goal_kind: "read",
    interaction_safety_class: "pure_read",
    ...(parseOptionalString(object, "goal_hint", "GOAL_HINT_INVALID")
      ? { goal_hint: parseOptionalString(object, "goal_hint", "GOAL_HINT_INVALID") }
      : {}),
    risk_gate_context: riskGateContext,
    allowed_actions: parseAllowedActions(object.allowed_actions)
  };
};

export const buildL2RiskGateBlockedResultForContract = (): L2FirstUsableResult => ({
  success: false,
  failure_class: "risk_gate_blocked"
});

export const buildL2RequiresL1FallbackResultForContract = (
  fallbackReason: L2FallbackReason,
  input?: {
    recommendedStrategy?: L2RecommendedStrategy;
    resultSummary?: JsonObject;
    firstUsableTrace?: FirstUsableTraceStep[];
    interactionTrace?: L2InteractionTraceStep[];
    captureHints?: JsonObject;
  }
): L2FirstUsableResult => {
  if (!FALLBACK_REASONS.has(fallbackReason)) {
    throw invalidL2Input("L1_FALLBACK_REASON_INVALID");
  }
  const recommendedStrategy = input?.recommendedStrategy ?? (
    fallbackReason === "target_not_located" ? "visual_reacquire" :
      fallbackReason === "state_not_settled" ? "visual_state_check" :
        "visual_state_check"
  );
  if (!RECOMMENDED_STRATEGIES.has(recommendedStrategy)) {
    throw invalidL2Input("L1_RECOMMENDED_STRATEGY_INVALID");
  }
  return {
    success: false,
    failure_class: "requires_l1_fallback",
    l1_fallback_payload: {
      fallback_goal: "read",
      fallback_reason: fallbackReason,
      recommended_strategy: recommendedStrategy
    },
    ...(input?.resultSummary ? { result_summary: cloneJsonObject(input.resultSummary) } : {}),
    ...(input?.firstUsableTrace ? { first_usable_trace: input.firstUsableTrace } : {}),
    ...(input?.interactionTrace ? { interaction_trace: input.interactionTrace } : {}),
    ...(input?.captureHints ? { capture_hints: cloneJsonObject(input.captureHints) } : {})
  };
};

const parseTraceStep = (value: unknown, abilityId: string): FirstUsableTraceStep => {
  const object = asObject(value);
  if (!object) {
    throw invalidL2Input("FIRST_USABLE_TRACE_INVALID", abilityId);
  }
  return {
    step_id: parseRequiredString(object, "step_id", "TRACE_STEP_ID_INVALID", abilityId),
    action: parseRequiredString(object, "action", "TRACE_ACTION_INVALID", abilityId),
    target_hint: parseRequiredString(object, "target_hint", "TRACE_TARGET_HINT_INVALID", abilityId),
    result: parseRequiredString(object, "result", "TRACE_RESULT_INVALID", abilityId)
  };
};

const parseInteractionTraceStep = (value: unknown, abilityId: string): L2InteractionTraceStep => {
  const object = asObject(value);
  if (!object) {
    throw invalidL2Input("INTERACTION_TRACE_INVALID", abilityId);
  }
  const action = parseRequiredString(object, "action", "INTERACTION_ACTION_INVALID", abilityId);
  const targetRef = parseRequiredString(object, "target_ref", "INTERACTION_TARGET_REF_INVALID", abilityId);
  if (typeof object.settled !== "boolean") {
    throw invalidL2Input("INTERACTION_SETTLED_INVALID", abilityId);
  }
  const semantics = parseRequiredString(
    object,
    "interaction_semantics",
    "INTERACTION_SEMANTICS_INVALID",
    abilityId
  );
  if (action === "click") {
    if (semantics !== "reveal_only_click") {
      throw invalidL2Input("INTERACTION_CLICK_SEMANTICS_INVALID", abilityId);
    }
    const clickKind = parseRequiredString(object, "click_kind", "CLICK_KIND_INVALID", abilityId);
    if (!CLICK_KINDS.has(clickKind as L2ClickKind)) {
      throw invalidL2Input("CLICK_KIND_INVALID", abilityId);
    }
    return {
      action: "click",
      target_ref: targetRef,
      settled: object.settled,
      interaction_semantics: "reveal_only_click",
      click_kind: clickKind as L2ClickKind
    };
  }
  if (
    action !== "navigate" &&
    action !== "locate" &&
    action !== "extract" &&
    action !== "wait_settled"
  ) {
    throw invalidL2Input("INTERACTION_ACTION_INVALID", abilityId);
  }
  if (semantics !== "neutral") {
    throw invalidL2Input("INTERACTION_SEMANTICS_INVALID", abilityId);
  }
  if (hasOwn(object, "click_kind")) {
    throw invalidL2Input("CLICK_KIND_UNEXPECTED", abilityId);
  }
  return {
    action,
    target_ref: targetRef,
    settled: object.settled,
    interaction_semantics: "neutral"
  };
};

const parseCandidateShellSeed = (
  value: unknown,
  request: L2FirstUsableRequest
): CandidateShellSeed => {
  const object = asObject(value);
  if (!object) {
    throw invalidL2Input("CANDIDATE_SHELL_SEED_INVALID");
  }
  const abilityId = parseRequiredString(object, "ability_id", "ABILITY_ID_INVALID");
  const executionLayerSupport = object.execution_layer_support;
  if (
    !Array.isArray(executionLayerSupport) ||
    executionLayerSupport.length !== 1 ||
    executionLayerSupport[0] !== "L2"
  ) {
    throw invalidL2Input("EXECUTION_LAYER_SUPPORT_INVALID", abilityId);
  }
  const abilityKind = parseRequiredString(object, "ability_kind", "ABILITY_KIND_INVALID", abilityId);
  if (abilityKind !== request.goal_kind) {
    throw invalidL2Input("ABILITY_KIND_MISMATCH", abilityId);
  }
  const captureOrigin = parseRequiredString(object, "capture_origin", "CAPTURE_ORIGIN_INVALID", abilityId);
  if (captureOrigin !== "l2_first_usable_sample") {
    throw invalidL2Input("CAPTURE_ORIGIN_INVALID", abilityId);
  }
  const candidateStatus = parseRequiredString(
    object,
    "candidate_status",
    "CANDIDATE_STATUS_INVALID",
    abilityId
  );
  if (candidateStatus !== "draft_candidate") {
    throw invalidL2Input("CANDIDATE_STATUS_INVALID", abilityId);
  }
  const registry = asObject(object.contract_registry_seed);
  if (!registry) {
    throw invalidL2Input("CONTRACT_REGISTRY_MISSING", abilityId);
  }
  const descriptor = parseCandidateAbilityDescriptorForContract({
    ability_id: abilityId,
    display_name: parseRequiredString(object, "display_name", "DISPLAY_NAME_INVALID", abilityId),
    ability_kind: "read",
    entrypoint: parseRequiredString(object, "entrypoint", "ENTRYPOINT_INVALID", abilityId),
    platform_scope: object.platform_scope,
    execution_layer_support: ["L2"],
    input_contract_ref: parseRequiredString(object, "input_contract_ref", "INPUT_CONTRACT_REF_INVALID", abilityId),
    output_contract_ref: parseRequiredString(object, "output_contract_ref", "OUTPUT_CONTRACT_REF_INVALID", abilityId),
    error_contract_ref: parseRequiredString(object, "error_contract_ref", "ERROR_CONTRACT_REF_INVALID", abilityId),
    capture_origin: "l2_first_usable_sample",
    candidate_status: "draft_candidate",
    capture_run_id: parseRequiredString(object, "capture_run_id", "CAPTURE_RUN_ID_INVALID", abilityId),
    capture_profile: parseRequiredString(object, "capture_profile", "CAPTURE_PROFILE_INVALID", abilityId),
    ...(Array.isArray(object.capture_artifact_refs)
      ? { capture_artifact_refs: object.capture_artifact_refs }
      : {}),
    captured_at: parseRequiredString(object, "captured_at", "CAPTURED_AT_INVALID", abilityId)
  });
  const registryInput = {
    ability_id: parseRequiredString(registry, "ability_id", "CONTRACT_REGISTRY_OWNER_INVALID", abilityId),
    entries: registry.entries
  };
  resolveCandidateAbilityContractsForContract(descriptor, registryInput);
  return {
    ...descriptor,
    execution_layer_support: ["L2"],
    ability_kind: "read",
    capture_origin: "l2_first_usable_sample",
    candidate_status: "draft_candidate",
    contract_registry_seed: registryInput as CandidateShellSeed["contract_registry_seed"]
  };
};

export const parseL2FirstUsableResultForContract = (
  value: unknown,
  request: L2FirstUsableRequest
): L2FirstUsableResult => {
  const source = asObject(value);
  const object = asObject(source?.l2_first_usable_result) ?? source;
  if (!object || typeof object.success !== "boolean") {
    throw invalidL2Input("RESULT_INVALID");
  }
  if (object.success === false) {
    if (hasOwn(object, "candidate_shell_seed")) {
      throw invalidL2Input("FAILURE_CANDIDATE_SHELL_SEED_UNEXPECTED");
    }
    const failureClass = parseRequiredString(object, "failure_class", "FAILURE_CLASS_INVALID");
    const base = {
      ...(asObject(object.result_summary) ? { result_summary: cloneJsonObject(asObject(object.result_summary)!) } : {}),
      ...(Array.isArray(object.first_usable_trace)
        ? { first_usable_trace: object.first_usable_trace.map((step) => parseTraceStep(step, "l2.first_usable")) }
        : {}),
      ...(Array.isArray(object.interaction_trace)
        ? { interaction_trace: object.interaction_trace.map((step) => parseInteractionTraceStep(step, "l2.first_usable")) }
        : {}),
      ...(asObject(object.capture_hints) ? { capture_hints: cloneJsonObject(asObject(object.capture_hints)!) } : {})
    };
    if (failureClass === "risk_gate_blocked") {
      return {
        success: false,
        failure_class: "risk_gate_blocked",
        ...base
      };
    }
    if (failureClass !== "requires_l1_fallback") {
      throw invalidL2Input("FAILURE_CLASS_INVALID");
    }
    const payload = asObject(object.l1_fallback_payload);
    if (!payload) {
      throw invalidL2Input("L1_FALLBACK_PAYLOAD_MISSING");
    }
    const fallbackGoal = parseRequiredString(payload, "fallback_goal", "L1_FALLBACK_GOAL_INVALID");
    const fallbackReason = parseRequiredString(payload, "fallback_reason", "L1_FALLBACK_REASON_INVALID");
    const recommendedStrategy = parseRequiredString(
      payload,
      "recommended_strategy",
      "L1_RECOMMENDED_STRATEGY_INVALID"
    );
    if (
      fallbackGoal !== "read" ||
      !FALLBACK_REASONS.has(fallbackReason as L2FallbackReason) ||
      !RECOMMENDED_STRATEGIES.has(recommendedStrategy as L2RecommendedStrategy)
    ) {
      throw invalidL2Input("L1_FALLBACK_PAYLOAD_INVALID");
    }
    return {
      success: false,
      failure_class: "requires_l1_fallback",
      l1_fallback_payload: {
        fallback_goal: "read",
        fallback_reason: fallbackReason as L2FallbackReason,
        recommended_strategy: recommendedStrategy as L2RecommendedStrategy
      },
      ...base
    };
  }
  const resultSummary = asObject(object.result_summary);
  const captureHints = asObject(object.capture_hints);
  if (!resultSummary || !captureHints) {
    throw invalidL2Input("SUCCESS_PAYLOAD_INVALID");
  }
  if (!Array.isArray(object.first_usable_trace) || !Array.isArray(object.interaction_trace)) {
    throw invalidL2Input("SUCCESS_TRACE_INVALID");
  }
  const interactionTrace = object.interaction_trace.map((step) =>
    parseInteractionTraceStep(step, "l2.first_usable")
  );
  if (!interactionTrace.some((step) => step.action === "extract")) {
    throw invalidL2Input("SUCCESS_EXTRACT_TRACE_REQUIRED");
  }
  return {
    success: true,
    result_summary: cloneJsonObject(resultSummary),
    first_usable_trace: object.first_usable_trace.map((step) =>
      parseTraceStep(step, "l2.first_usable")
    ),
    interaction_trace: interactionTrace,
    capture_hints: cloneJsonObject(captureHints),
    candidate_shell_seed: parseCandidateShellSeed(object.candidate_shell_seed, request)
  };
};

export const materializeCandidateAbilityFromL2SeedForContract = (
  seed: CandidateShellSeed
): MaterializedL2CandidateAbility => {
  const descriptor = parseCandidateAbilityDescriptorForContract({
    ability_id: seed.ability_id,
    display_name: seed.display_name,
    ability_kind: seed.ability_kind,
    entrypoint: seed.entrypoint,
    platform_scope: seed.platform_scope,
    execution_layer_support: seed.execution_layer_support,
    input_contract_ref: seed.input_contract_ref,
    output_contract_ref: seed.output_contract_ref,
    error_contract_ref: seed.error_contract_ref,
    capture_origin: seed.capture_origin,
    candidate_status: seed.candidate_status,
    capture_run_id: seed.capture_run_id,
    capture_profile: seed.capture_profile,
    ...(seed.capture_artifact_refs ? { capture_artifact_refs: seed.capture_artifact_refs } : {}),
    captured_at: seed.captured_at
  });
  const registry = seed.contract_registry_seed;
  resolveCandidateAbilityContractsForContract(descriptor, registry);
  return {
    candidate_ability_descriptor: descriptor,
    candidate_ability_contract_registry: registry
  };
};

export const buildAbilityValidationSeedForL2Result = (
  request: L2FirstUsableRequest,
  result: Extract<L2FirstUsableResult, { success: true }>
): JsonObject => {
  const materialized = materializeCandidateAbilityFromL2SeedForContract(
    result.candidate_shell_seed
  );
  return {
    ...materialized,
    ability_validation_request: {
      ability_ref: result.candidate_shell_seed.ability_id,
      validation_mode: "smoke_validation",
      profile_ref: request.risk_gate_context.profile,
      requested_execution_layer: "L2",
      expected_capability_kind: "read",
      smoke_input: cloneJsonObject({
        target_url: request.target_url,
        goal_kind: request.goal_kind,
        goal_hint: request.goal_hint ?? null,
        risk_gate_context: request.risk_gate_context,
        allowed_actions: request.allowed_actions
      })
    },
    execution_result: {
      result_state: "verified",
      artifact_refs: result.candidate_shell_seed.capture_artifact_refs ?? []
    }
  };
};
