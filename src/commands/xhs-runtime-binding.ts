import type { JsonObject } from "../core/types.js";
import type { AbilityRef, XhsExecutionMode } from "./xhs-input.js";
import type { XhsDriverProviderRequirementDeclaration } from "./xhs-provider-requirements.js";

type XhsReadCommand = "xhs.search" | "xhs.detail" | "xhs.user_home";
type XhsReadRouteBucket = "search" | "detail" | "user_home" | "unknown";
type XhsReadTargetPage = "search_tab" | "explore_detail_tab" | "profile_tab" | "unknown";
type XhsRuntimeBindingExecutionMode = "read" | "diagnose" | "unknown";
type TargetBindingState =
  | "unbound"
  | "candidate_found"
  | "url_matched"
  | "dom_ready"
  | "runtime_state_detected"
  | "extension_bridge_confirmed"
  | "bound"
  | "stale"
  | "lost";

const XHS_READ_COMMANDS: Record<
  XhsReadCommand,
  {
    abilityId: string;
    routeBucket: XhsReadRouteBucket;
    targetPage: XhsReadTargetPage;
    acceptedTargetPages: string[];
  }
> = {
  "xhs.search": {
    abilityId: "xhs.note.search.v1",
    routeBucket: "search",
    targetPage: "search_tab",
    acceptedTargetPages: ["search_tab", "search_result_tab"]
  },
  "xhs.detail": {
    abilityId: "xhs.note.detail.v1",
    routeBucket: "detail",
    targetPage: "explore_detail_tab",
    acceptedTargetPages: ["explore_detail_tab"]
  },
  "xhs.user_home": {
    abilityId: "xhs.user.home.v1",
    routeBucket: "user_home",
    targetPage: "profile_tab",
    acceptedTargetPages: ["profile_tab"]
  }
};

const XHS_TARGET_BINDING_NON_PROOFS = [
  "page_ready",
  "runtime_ready",
  "signed_continuity",
  "read_success",
  "live_evidence_accepted",
  "provider_capability_allowed",
  "write_enabled"
];

const XHS_RUNTIME_BINDING_NON_PROOFS = [
  "runtime_ready",
  "target_tab_ready",
  "live_evidence_accepted",
  "provider_capability_allowed",
  "syvert_normalized_result_complete",
  "write_enabled"
];

export type XhsDriverRuntimeBindingBoundary = {
  runtime_binding_ref: string;
  target_binding_snapshot_ref: string;
  xhs_runtime_binding: JsonObject;
  target_binding_snapshot: JsonObject;
  target_binding_transition_evidence: JsonObject[];
  provider_requirement_refs: string[];
  downstream_slice_refs: string[];
  non_proofs: string[];
};

const isXhsReadCommand = (command: string): command is XhsReadCommand =>
  command === "xhs.search" || command === "xhs.detail" || command === "xhs.user_home";

const toRuntimeExecutionMode = (
  requestedExecutionMode: XhsExecutionMode
): XhsRuntimeBindingExecutionMode =>
  requestedExecutionMode === "live_read_limited" ||
  requestedExecutionMode === "live_read_high_risk"
    ? "read"
    : requestedExecutionMode === "dry_run" || requestedExecutionMode === "recon"
      ? "diagnose"
      : "unknown";

const buildTargetCandidateRef = (runId: string, targetTabId: number | null): string | null =>
  targetTabId === null ? null : `target-tab-ref:${runId}:${targetTabId}`;

const resolveTargetBindingState = (input: {
  targetCandidateRef: string | null;
  targetDomain: string;
  targetPage: string;
  acceptedTargetPages: string[];
}): TargetBindingState => {
  if (!input.targetCandidateRef) {
    return "unbound";
  }
  if (
    input.targetDomain !== "www.xiaohongshu.com" ||
    !input.acceptedTargetPages.includes(input.targetPage)
  ) {
    return "lost";
  }
  return "candidate_found";
};

const buildBlockingReasons = (input: {
  state: TargetBindingState;
  targetDomain: string;
  targetPage: string;
  acceptedTargetPages: string[];
}): string[] => {
  if (input.state === "lost") {
    return ["url_scope_mismatch"];
  }
  if (input.state === "unbound") {
    return ["missing_candidate"];
  }
  return [
    "dom_observation_missing",
    "runtime_state_missing",
    "extension_bridge_missing",
    ...(input.targetDomain === "www.xiaohongshu.com" &&
    input.acceptedTargetPages.includes(input.targetPage)
      ? []
      : ["url_scope_mismatch"])
  ];
};

const dedupe = (items: string[]): string[] =>
  items.filter((item, index, list) => list.indexOf(item) === index);

export const buildXhsDriverRuntimeBindingForContract = (input: {
  command: string;
  ability: AbilityRef;
  runId: string;
  operationId: string;
  targetDomain: string;
  targetTabId: number | null;
  targetPage: string;
  requestedExecutionMode: XhsExecutionMode;
  providerRequirements?: XhsDriverProviderRequirementDeclaration | null;
}): XhsDriverRuntimeBindingBoundary | null => {
  if (!isXhsReadCommand(input.command) || input.ability.action !== "read") {
    return null;
  }

  const commandSpec = XHS_READ_COMMANDS[input.command];
  if (input.ability.id !== commandSpec.abilityId) {
    return null;
  }

  const targetCandidateRef = buildTargetCandidateRef(input.runId, input.targetTabId);
  const runtimeBindingRef = `FR-0061.xhs_runtime_binding.v1/${input.runId}/${commandSpec.routeBucket}`;
  const targetBindingSnapshotRef = `FR-0063.target_binding_snapshot.v1/${input.runId}/${commandSpec.routeBucket}`;
  const state = resolveTargetBindingState({
    targetCandidateRef,
    targetDomain: input.targetDomain,
    targetPage: input.targetPage,
    acceptedTargetPages: commandSpec.acceptedTargetPages
  });
  const blockingReasons = buildBlockingReasons({
    state,
    targetDomain: input.targetDomain,
    targetPage: input.targetPage,
    acceptedTargetPages: commandSpec.acceptedTargetPages
  });
  const providerRequirementRefs = input.providerRequirements?.provider_requirement_refs ?? [];
  const downstreamSliceRefs = dedupe([
    "#1162",
    "#1171",
    ...(input.providerRequirements?.downstream_slice_refs ?? []),
    "#1166",
    "#1167",
    "#1168"
  ]);

  const transitionEvidence =
    state === "candidate_found" && targetCandidateRef
      ? [
          {
            transition_id: `target-binding-transition:${input.runId}:${commandSpec.routeBucket}:candidate_found`,
            from_state: "unbound",
            to_state: "candidate_found",
            transition_reason: "candidate_discovered",
            observed_at: "N/A",
            run_id: input.runId,
            target_candidate_ref: targetCandidateRef,
            evidence_refs: [targetCandidateRef],
            freshness_scope: "current_run",
            redaction_state: "redacted",
            source_owner: "target_binding_state_machine"
          }
        ]
      : [];

  return {
    runtime_binding_ref: runtimeBindingRef,
    target_binding_snapshot_ref: targetBindingSnapshotRef,
    xhs_runtime_binding: {
      target_domain: input.targetDomain === "www.xiaohongshu.com" ? input.targetDomain : "unknown",
      target_page: commandSpec.targetPage,
      target_tab_ref: targetCandidateRef,
      execution_mode: toRuntimeExecutionMode(input.requestedExecutionMode),
      page_context_namespace_ref: `FR-0024.xhs_page_context_namespace.v1/${commandSpec.routeBucket}`,
      runtime_provider_ref: "FR-0033.browser_provider_contract.v1",
      binding_freshness: "current_run",
      binding_status: "declared",
      non_proofs: XHS_RUNTIME_BINDING_NON_PROOFS
    },
    target_binding_snapshot: {
      snapshot_version: "v1",
      state,
      state_entered_at: "N/A",
      target_candidate_ref: targetCandidateRef,
      target_scope: {
        target_domain:
          input.targetDomain === "www.xiaohongshu.com" ? input.targetDomain : "unknown",
        target_page_class: commandSpec.targetPage
      },
      route_bucket: commandSpec.routeBucket,
      run_id: input.runId,
      operation_id: input.operationId,
      evidence_refs: {
        candidate_ref: targetCandidateRef,
        url_match_ref: null,
        dom_observation_ref: null,
        runtime_state_ref: null,
        extension_bridge_ref: null,
        transition_refs: transitionEvidence.map((evidence) => String(evidence.transition_id))
      },
      freshness_scope: "current_run",
      blocking_reasons: blockingReasons,
      non_proofs: XHS_TARGET_BINDING_NON_PROOFS,
      downstream_handoff: {
        page_runtime_ready_required: true,
        signed_continuity_required: true,
        live_evidence_required: false,
        owner_refs: ["#1162", "#1171"]
      }
    },
    target_binding_transition_evidence: transitionEvidence,
    provider_requirement_refs: providerRequirementRefs,
    downstream_slice_refs: downstreamSliceRefs,
    non_proofs: dedupe([...XHS_RUNTIME_BINDING_NON_PROOFS, ...XHS_TARGET_BINDING_NON_PROOFS])
  };
};

export const toXhsDriverRuntimeBindingSummaryFields = (
  boundary: XhsDriverRuntimeBindingBoundary | null
): JsonObject => {
  if (!boundary) {
    return {};
  }
  return {
    runtime_binding_ref: boundary.runtime_binding_ref,
    target_binding_snapshot_ref: boundary.target_binding_snapshot_ref,
    xhs_runtime_binding: boundary.xhs_runtime_binding,
    target_binding_snapshot: boundary.target_binding_snapshot,
    target_binding_transition_evidence: boundary.target_binding_transition_evidence,
    provider_requirement_refs: boundary.provider_requirement_refs,
    downstream_slice_refs: boundary.downstream_slice_refs,
    non_proofs: boundary.non_proofs
  };
};
