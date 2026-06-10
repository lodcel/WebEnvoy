import type { JsonObject } from "../core/types.js";
import type { XhsExecutionMode } from "./xhs-input.js";
import type { XhsDriverProviderRequirementDeclaration } from "./xhs-provider-requirements.js";
import type { XhsDriverRuntimeBindingBoundary } from "./xhs-runtime-binding.js";

type ReadinessStatus = "ready" | "blocked" | "pending" | "recoverable" | "unknown" | "not_required";
type OverallReadiness = "ready" | "blocked" | "pending" | "unknown";

export type XhsPageRuntimeReadinessContract = {
  readiness_contract_ref: string;
  readiness_contract_version: "v1";
  owner_ref: "#1162";
  command: string;
  run_id: string;
  requested_execution_mode: XhsExecutionMode;
  runtime_binding_ref: string;
  target_binding_snapshot_ref: string;
  provider_requirement_refs: string[];
  page_readiness: JsonObject;
  runtime_readiness: JsonObject;
  provider_admission_readiness: JsonObject;
  overall_readiness: OverallReadiness;
  gate_decision: "allow" | "deny";
  blocking_reasons: string[];
  non_proofs: string[];
  downstream_slice_refs: string[];
};

const READINESS_NON_PROOFS = [
  "target_binding_snapshot_does_not_prove_page_ready",
  "runtime_binding_declaration_does_not_prove_runtime_ready",
  "provider_requirement_declaration_does_not_prove_provider_admission",
  "provider_requirement_declaration_does_not_prove_provider_capability_allowed",
  "page_runtime_readiness_does_not_prove_signed_continuity",
  "page_runtime_readiness_does_not_prove_live_evidence_accepted",
  "page_runtime_readiness_does_not_enable_write",
  "page_runtime_readiness_does_not_prove_syvert_normalized_result_complete"
];

const isRuntimeReadinessRequired = (mode: XhsExecutionMode): boolean =>
  mode === "recon" || mode === "live_read_limited" || mode === "live_read_high_risk";

const isPageReadinessRequired = (mode: XhsExecutionMode): boolean =>
  mode === "recon" || mode === "live_read_limited" || mode === "live_read_high_risk";

const asObject = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const dedupe = (items: string[]): string[] =>
  items.filter((item, index, list) => list.indexOf(item) === index);

const statusIsPassing = (status: ReadinessStatus): boolean =>
  status === "ready" || status === "not_required";

const buildPageReadiness = (input: {
  runtimeBindingBoundary: XhsDriverRuntimeBindingBoundary;
  requestedExecutionMode: XhsExecutionMode;
}): JsonObject & { status: ReadinessStatus; blocking_reasons: string[] } => {
  const targetBindingSnapshot = asObject(input.runtimeBindingBoundary.target_binding_snapshot);
  const evidenceRefs = asObject(targetBindingSnapshot?.evidence_refs);
  const required = isPageReadinessRequired(input.requestedExecutionMode);
  const state = asString(targetBindingSnapshot?.state) ?? "unknown";
  const freshnessScope = asString(targetBindingSnapshot?.freshness_scope) ?? "unknown";
  const snapshotBlockingReasons = asStringArray(targetBindingSnapshot?.blocking_reasons);
  const missingEvidenceReasons = required
    ? [
        ...(asString(evidenceRefs?.dom_observation_ref) ? [] : ["dom_observation_missing"]),
        ...(asString(evidenceRefs?.runtime_state_ref) ? [] : ["runtime_state_missing"]),
        ...(asString(evidenceRefs?.extension_bridge_ref) ? [] : ["extension_bridge_missing"])
      ]
    : [];
  const blockingReasons = dedupe([
    ...(required && state !== "bound" ? ["target_binding_not_bound"] : []),
    ...(required && freshnessScope !== "current_run" ? ["target_binding_not_current_run"] : []),
    ...snapshotBlockingReasons,
    ...missingEvidenceReasons
  ]);
  const status: ReadinessStatus = !required
    ? "not_required"
    : blockingReasons.length === 0
      ? "ready"
      : "blocked";

  return {
    status,
    required,
    source: "target_binding_snapshot",
    target_binding_state: state,
    target_binding_freshness_scope: freshnessScope,
    evidence_refs: evidenceRefs ?? {},
    blocking_reasons: blockingReasons
  };
};

const buildRuntimeReadiness = (input: {
  runtimeStatus?: JsonObject | null;
  requestedExecutionMode: XhsExecutionMode;
}): JsonObject & { status: ReadinessStatus; blocking_reasons: string[] } => {
  const required = isRuntimeReadinessRequired(input.requestedExecutionMode);
  if (!required) {
    return {
      status: "not_required",
      required,
      source: "execution_mode",
      blocking_reasons: []
    };
  }

  const runtimeStatus = asObject(input.runtimeStatus);
  const runtimeReadiness = asString(
    runtimeStatus?.runtimeReadiness ?? runtimeStatus?.runtime_readiness
  );
  const executionSurface = asString(
    runtimeStatus?.executionSurface ?? runtimeStatus?.execution_surface
  );
  const headless = asBoolean(runtimeStatus?.headless);
  const blockingReasons = dedupe([
    ...(runtimeStatus ? [] : ["runtime_status_missing"]),
    ...(runtimeReadiness === "ready" ? [] : ["runtime_readiness_not_ready"]),
    ...(executionSurface === "real_browser" ? [] : ["execution_surface_not_real_browser"]),
    ...(headless === false ? [] : ["headless_not_false"])
  ]);
  const status: ReadinessStatus =
    runtimeReadiness === "pending" || runtimeReadiness === "recoverable" || runtimeReadiness === "unknown"
      ? runtimeReadiness
      : blockingReasons.length === 0
        ? "ready"
        : "blocked";

  return {
    status,
    required,
    source: "official_chrome_runtime_readiness",
    runtime_readiness: runtimeReadiness ?? "unknown",
    execution_surface: executionSurface ?? "unknown",
    headless: headless ?? "unknown",
    blocking_reasons: status === "ready" ? [] : blockingReasons
  };
};

const providerAdmissionRefsMatch = (input: {
  providerRequirementRefs: string[];
  providerAdmissionResult: JsonObject | null;
}): boolean => {
  const refs = asStringArray(
    input.providerAdmissionResult?.provider_requirement_refs ??
      input.providerAdmissionResult?.required_provider_requirement_refs
  );
  return input.providerRequirementRefs.every((ref) => refs.includes(ref));
};

const buildProviderAdmissionReadiness = (input: {
  providerRequirements?: XhsDriverProviderRequirementDeclaration | null;
  providerAdmissionResult?: JsonObject | null;
}): JsonObject & { status: ReadinessStatus; blocking_reasons: string[] } => {
  const providerRequirementRefs = input.providerRequirements?.provider_requirement_refs ?? [];
  const providerAdmissionResult = asObject(input.providerAdmissionResult);
  const admissionDecision = asString(
    providerAdmissionResult?.decision ?? providerAdmissionResult?.admission_decision
  );
  const providerRefsMatch =
    providerRequirementRefs.length > 0 &&
    providerAdmissionResult !== null &&
    providerAdmissionRefsMatch({ providerRequirementRefs, providerAdmissionResult });
  const blockingReasons = dedupe([
    ...(input.providerRequirements ? [] : ["provider_requirements_missing"]),
    ...(providerAdmissionResult ? [] : ["provider_admission_result_missing"]),
    ...(admissionDecision === "allow" || admissionDecision === "allowed"
      ? []
      : ["provider_admission_not_allowed"]),
    ...(providerRefsMatch ? [] : ["provider_requirement_refs_not_attested"])
  ]);
  const status: ReadinessStatus = blockingReasons.length === 0 ? "ready" : "blocked";

  return {
    status,
    required: true,
    source: "provider_admission_result",
    provider_requirement_refs: providerRequirementRefs,
    admission_decision: admissionDecision ?? "unknown",
    blocking_reasons: status === "ready" ? [] : blockingReasons
  };
};

const toOverallReadiness = (statuses: ReadinessStatus[]): OverallReadiness => {
  if (statuses.every(statusIsPassing)) {
    return "ready";
  }
  if (statuses.some((status) => status === "pending" || status === "recoverable")) {
    return "pending";
  }
  if (statuses.some((status) => status === "unknown")) {
    return "unknown";
  }
  return "blocked";
};

export const buildXhsPageRuntimeReadinessForContract = (input: {
  command: string;
  runId: string;
  requestedExecutionMode: XhsExecutionMode;
  runtimeBindingBoundary: XhsDriverRuntimeBindingBoundary | null;
  providerRequirements?: XhsDriverProviderRequirementDeclaration | null;
  runtimeStatus?: JsonObject | null;
  providerAdmissionResult?: JsonObject | null;
}): XhsPageRuntimeReadinessContract | null => {
  if (!input.runtimeBindingBoundary) {
    return null;
  }

  const pageReadiness = buildPageReadiness({
    runtimeBindingBoundary: input.runtimeBindingBoundary,
    requestedExecutionMode: input.requestedExecutionMode
  });
  const runtimeReadiness = buildRuntimeReadiness({
    runtimeStatus: input.runtimeStatus,
    requestedExecutionMode: input.requestedExecutionMode
  });
  const providerAdmissionReadiness = buildProviderAdmissionReadiness({
    providerRequirements: input.providerRequirements,
    providerAdmissionResult: input.providerAdmissionResult
  });
  const statuses = [
    pageReadiness.status,
    runtimeReadiness.status,
    providerAdmissionReadiness.status
  ];
  const overallReadiness = toOverallReadiness(statuses);
  const blockingReasons = dedupe([
    ...pageReadiness.blocking_reasons.map((reason) => `page:${reason}`),
    ...runtimeReadiness.blocking_reasons.map((reason) => `runtime:${reason}`),
    ...providerAdmissionReadiness.blocking_reasons.map((reason) => `provider:${reason}`)
  ]);

  return {
    readiness_contract_ref: `issue-1162.xhs_page_runtime_readiness.v1/${input.runId}`,
    readiness_contract_version: "v1",
    owner_ref: "#1162",
    command: input.command,
    run_id: input.runId,
    requested_execution_mode: input.requestedExecutionMode,
    runtime_binding_ref: input.runtimeBindingBoundary.runtime_binding_ref,
    target_binding_snapshot_ref: input.runtimeBindingBoundary.target_binding_snapshot_ref,
    provider_requirement_refs: input.providerRequirements?.provider_requirement_refs ?? [],
    page_readiness: pageReadiness,
    runtime_readiness: runtimeReadiness,
    provider_admission_readiness: providerAdmissionReadiness,
    overall_readiness: overallReadiness,
    gate_decision: overallReadiness === "ready" ? "allow" : "deny",
    blocking_reasons: blockingReasons,
    non_proofs: [...READINESS_NON_PROOFS],
    downstream_slice_refs: dedupe(["#1162", ...input.runtimeBindingBoundary.downstream_slice_refs])
  };
};

export const toXhsPageRuntimeReadinessSummaryFields = (
  contract: XhsPageRuntimeReadinessContract | null
): JsonObject => {
  if (!contract) {
    return {};
  }
  return {
    page_runtime_readiness_ref: contract.readiness_contract_ref,
    xhs_page_runtime_readiness: contract,
    page_runtime_readiness_decision: contract.gate_decision,
    page_runtime_readiness_blocking_reasons: contract.blocking_reasons
  };
};
