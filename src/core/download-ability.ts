import { CliError } from "./errors.js";
import {
  parseCandidateAbilityDescriptorForContract,
  resolveCandidateAbilityContractsForContract,
  type CandidateAbilityContractRegistry,
  type CandidateAbilityContractRegistryEntry,
  type CandidateAbilityDescriptor,
  type CandidateExecutionLayer
} from "./candidate-ability.js";
import type { JsonObject } from "./types.js";

export type DownloadSource =
  | {
      source_kind: "direct_url";
      target_url: string;
    }
  | {
      source_kind: "page_blob";
      blob_locator: string;
      blob_url?: string;
      page_context_hint?: string;
    }
  | {
      source_kind: "page_derived";
      derive_mode: "export_flow" | "runtime_resolve";
      trigger_hint?: string;
      page_context_hint?: string;
    };

export type DownloadGoal = "single_file" | "single_media_asset";
export type DownloadConflictPolicy =
  | "fail_if_exists"
  | "rename_with_suffix"
  | "replace_existing";
export type DownloadResultState = "downloaded" | "partial";
export type DownloadFailureReason =
  | "SOURCE_UNAVAILABLE"
  | "AUTH_OR_SESSION_REQUIRED"
  | "WRITE_BLOCKED"
  | "RUNTIME_ERROR";

export interface OutputPolicy {
  destination_root: string;
  file_name_policy: string;
  conflict_policy: DownloadConflictPolicy;
}

export interface DownloadAbilityRequest {
  ability_ref: string;
  download_source: DownloadSource;
  profile_ref: string;
  download_goal: DownloadGoal;
  output_policy: OutputPolicy;
  requested_execution_layer: CandidateExecutionLayer;
}

export interface DownloadResultSummary {
  download_ref: string;
  result_state: DownloadResultState;
  saved_artifact_refs?: string[];
  resolved_output_path?: string;
  source_url?: string;
  file_name_hint?: string;
  content_descriptor: {
    content_kind: string;
    mime_type: string;
    size_bytes?: number;
    checksum_sha256?: string;
  };
}

export interface DownloadCapabilityEnvelope {
  ability: {
    id: string;
    layer: CandidateExecutionLayer;
    action: "download";
  };
  input: DownloadAbilityRequest;
  options?: JsonObject;
}

export interface DownloadCandidateShellSeed {
  ability_id: string;
  display_name: string;
  ability_kind: "download";
  entrypoint: string;
  platform_scope: CandidateAbilityDescriptor["platform_scope"];
  execution_layer_support: CandidateExecutionLayer[];
  input_contract_ref: string;
  output_contract_ref: string;
  error_contract_ref: string;
  capture_origin: CandidateAbilityDescriptor["capture_origin"];
  capture_run_id: string;
  capture_profile: string;
  capture_artifact_refs?: string[];
  captured_at: string;
  candidate_status: CandidateAbilityDescriptor["candidate_status"];
  contract_registry_seed: {
    ability_id: string;
    entries: CandidateAbilityContractRegistryEntry[];
  };
}

export interface MaterializedDownloadCandidateAbility {
  candidate_ability_descriptor: CandidateAbilityDescriptor;
  candidate_ability_contract_registry: CandidateAbilityContractRegistry;
}

export type DownloadTriggerMode = "resolve_only" | "dispatch_click";
export type DownloadTriggerStatus = "resolved" | "triggered";

export interface DownloadBrowserTarget {
  target_ref: string;
  source_kind: DownloadSource["source_kind"];
  source_url: string;
  file_name_hint?: string;
  content_descriptor: DownloadResultSummary["content_descriptor"];
  browser_artifact?: {
    content_base64: string;
    artifact_ref?: string;
  };
  trigger_status: DownloadTriggerStatus;
  trigger_mode: DownloadTriggerMode;
  trigger_surface: "direct_url" | "dom_anchor" | "dom_button" | "blob_locator";
}

export interface DownloadBrowserExecutionResult {
  success: boolean;
  download_target?: DownloadBrowserTarget;
  failure_reason?: DownloadFailureReason;
  trigger_audit?: JsonObject;
}

const EXECUTION_LAYERS = new Set<CandidateExecutionLayer>(["L3", "L2", "L1"]);
const DOWNLOAD_GOALS = new Set<DownloadGoal>(["single_file", "single_media_asset"]);
const CONFLICT_POLICIES = new Set<DownloadConflictPolicy>([
  "fail_if_exists",
  "rename_with_suffix",
  "replace_existing"
]);
const FAILURE_REASONS = new Set<DownloadFailureReason>([
  "SOURCE_UNAVAILABLE",
  "AUTH_OR_SESSION_REQUIRED",
  "WRITE_BLOCKED",
  "RUNTIME_ERROR"
]);
const TRIGGER_MODES = new Set<DownloadTriggerMode>(["resolve_only", "dispatch_click"]);
const TRIGGER_STATUSES = new Set<DownloadTriggerStatus>(["resolved", "triggered"]);
const TRIGGER_SURFACES = new Set<DownloadBrowserTarget["trigger_surface"]>([
  "direct_url",
  "dom_anchor",
  "dom_button",
  "blob_locator"
]);

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const cloneJsonObject = (value: JsonObject): JsonObject =>
  JSON.parse(JSON.stringify(value)) as JsonObject;

const hasOwn = (value: JsonObject, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const invalidDownloadInput = (reason: string, abilityId = "download.prepare"): CliError =>
  new CliError("ERR_CLI_INVALID_ARGS", "Download ability input invalid", {
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
  abilityId: string
): string => {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidDownloadInput(reason, abilityId);
  }
  return value.trim();
};

const parseOptionalString = (
  source: JsonObject,
  key: string,
  reason: string,
  abilityId: string
): string | undefined => {
  if (!hasOwn(source, key) || source[key] === undefined) {
    return undefined;
  }
  return parseRequiredString(source, key, reason, abilityId);
};

const parseStringArray = (
  value: unknown,
  reason: string,
  abilityId: string
): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw invalidDownloadInput(reason, abilityId);
  }
  const normalized = value.map((item) =>
    typeof item === "string" ? item.trim() : ""
  );
  if (normalized.some((item) => item.length === 0)) {
    throw invalidDownloadInput(reason, abilityId);
  }
  return normalized;
};

const parseExecutionLayer = (
  value: unknown,
  reason: string,
  abilityId: string
): CandidateExecutionLayer => {
  if (typeof value !== "string" || !EXECUTION_LAYERS.has(value as CandidateExecutionLayer)) {
    throw invalidDownloadInput(reason, abilityId);
  }
  return value as CandidateExecutionLayer;
};

const parseUrlString = (value: unknown, reason: string, abilityId: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidDownloadInput(reason, abilityId);
  }
  const normalized = value.trim();
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported direct download url protocol");
    }
  } catch {
    throw invalidDownloadInput(reason, abilityId);
  }
  return normalized;
};

const normalizeDestinationRoot = (value: string, abilityId: string): string => {
  const raw = value.trim();
  if (
    raw.length === 0 ||
    raw.includes("\0") ||
    raw.startsWith("/") ||
    raw.startsWith("\\") ||
    raw.startsWith("//") ||
    raw.startsWith("\\\\") ||
    /^~(?:$|[/\\])/u.test(raw) ||
    /^[A-Za-z]:/u.test(raw)
  ) {
    throw invalidDownloadInput("DESTINATION_ROOT_INVALID", abilityId);
  }

  const parts = raw.split(/[\\/]+/u).filter((part) => part.length > 0 && part !== ".");
  if (parts.some((part) => part === "..")) {
    throw invalidDownloadInput("DESTINATION_ROOT_INVALID", abilityId);
  }
  return parts.length > 0 ? parts.join("/") : ".";
};

const parseOutputPolicy = (value: unknown, abilityId: string): OutputPolicy => {
  const object = asObject(value);
  if (!object) {
    throw invalidDownloadInput("OUTPUT_POLICY_INVALID", abilityId);
  }
  const destinationRoot = normalizeDestinationRoot(
    parseRequiredString(object, "destination_root", "DESTINATION_ROOT_INVALID", abilityId),
    abilityId
  );
  const fileNamePolicy = parseRequiredString(
    object,
    "file_name_policy",
    "FILE_NAME_POLICY_INVALID",
    abilityId
  );
  const conflictPolicy = parseRequiredString(
    object,
    "conflict_policy",
    "CONFLICT_POLICY_INVALID",
    abilityId
  );
  if (!CONFLICT_POLICIES.has(conflictPolicy as DownloadConflictPolicy)) {
    throw invalidDownloadInput("CONFLICT_POLICY_INVALID", abilityId);
  }
  return {
    destination_root: destinationRoot,
    file_name_policy: fileNamePolicy,
    conflict_policy: conflictPolicy as DownloadConflictPolicy
  };
};

const parseDownloadSource = (value: unknown, abilityId: string): DownloadSource => {
  const object = asObject(value);
  if (!object) {
    throw invalidDownloadInput("DOWNLOAD_SOURCE_INVALID", abilityId);
  }
  const sourceKind = parseRequiredString(
    object,
    "source_kind",
    "DOWNLOAD_SOURCE_KIND_INVALID",
    abilityId
  );
  if (sourceKind === "direct_url") {
    return {
      source_kind: "direct_url",
      target_url: parseUrlString(object.target_url, "TARGET_URL_INVALID", abilityId)
    };
  }
  if (sourceKind === "page_blob") {
    const blobUrl = parseOptionalString(object, "blob_url", "BLOB_URL_INVALID", abilityId);
    const pageContextHint = parseOptionalString(
      object,
      "page_context_hint",
      "PAGE_CONTEXT_HINT_INVALID",
      abilityId
    );
    return {
      source_kind: "page_blob",
      blob_locator: parseRequiredString(
        object,
        "blob_locator",
        "BLOB_LOCATOR_INVALID",
        abilityId
      ),
      ...(blobUrl ? { blob_url: blobUrl } : {}),
      ...(pageContextHint ? { page_context_hint: pageContextHint } : {})
    };
  }
  if (sourceKind === "page_derived") {
    const deriveMode = parseRequiredString(
      object,
      "derive_mode",
      "DERIVE_MODE_INVALID",
      abilityId
    );
    if (deriveMode !== "export_flow" && deriveMode !== "runtime_resolve") {
      throw invalidDownloadInput("DERIVE_MODE_INVALID", abilityId);
    }
    const triggerHint = parseOptionalString(
      object,
      "trigger_hint",
      "TRIGGER_HINT_INVALID",
      abilityId
    );
    const pageContextHint = parseOptionalString(
      object,
      "page_context_hint",
      "PAGE_CONTEXT_HINT_INVALID",
      abilityId
    );
    if (!triggerHint && !pageContextHint) {
      throw invalidDownloadInput("PAGE_DERIVED_HINT_MISSING", abilityId);
    }
    return {
      source_kind: "page_derived",
      derive_mode: deriveMode,
      ...(triggerHint ? { trigger_hint: triggerHint } : {}),
      ...(pageContextHint ? { page_context_hint: pageContextHint } : {})
    };
  }
  throw invalidDownloadInput("DOWNLOAD_SOURCE_KIND_INVALID", abilityId);
};

export const parseDownloadAbilityRequestForContract = (
  value: unknown
): DownloadAbilityRequest => {
  const object = asObject(value);
  if (!object) {
    throw invalidDownloadInput("DOWNLOAD_ABILITY_REQUEST_INVALID");
  }
  const abilityRef = parseRequiredString(object, "ability_ref", "ABILITY_REF_INVALID", "unknown");
  const requestedExecutionLayer = parseExecutionLayer(
    object.requested_execution_layer,
    "REQUESTED_EXECUTION_LAYER_INVALID",
    abilityRef
  );
  const downloadGoal = parseRequiredString(
    object,
    "download_goal",
    "DOWNLOAD_GOAL_INVALID",
    abilityRef
  );
  if (!DOWNLOAD_GOALS.has(downloadGoal as DownloadGoal)) {
    throw invalidDownloadInput("DOWNLOAD_GOAL_INVALID", abilityRef);
  }
  return {
    ability_ref: abilityRef,
    download_source: parseDownloadSource(object.download_source, abilityRef),
    profile_ref: parseRequiredString(object, "profile_ref", "PROFILE_REF_INVALID", abilityRef),
    download_goal: downloadGoal as DownloadGoal,
    output_policy: parseOutputPolicy(object.output_policy, abilityRef),
    requested_execution_layer: requestedExecutionLayer
  };
};

export const parseDownloadCapabilityEnvelopeForContract = (
  value: unknown
): DownloadCapabilityEnvelope => {
  const object = asObject(value);
  if (!object) {
    throw invalidDownloadInput("DOWNLOAD_CAPABILITY_ENVELOPE_INVALID");
  }
  const ability = asObject(object.ability);
  if (!ability) {
    throw invalidDownloadInput("ABILITY_INVALID");
  }
  const request = parseDownloadAbilityRequestForContract(object.input);
  const abilityId = parseRequiredString(ability, "id", "ABILITY_ID_INVALID", request.ability_ref);
  if (abilityId !== request.ability_ref) {
    throw invalidDownloadInput("ABILITY_REF_MISMATCH", request.ability_ref);
  }
  const action = parseRequiredString(ability, "action", "ABILITY_ACTION_INVALID", request.ability_ref);
  if (action !== "download") {
    throw invalidDownloadInput("ABILITY_ACTION_MISMATCH", request.ability_ref);
  }
  const layer = parseExecutionLayer(ability.layer, "ABILITY_LAYER_INVALID", request.ability_ref);
  if (layer !== request.requested_execution_layer) {
    throw invalidDownloadInput("REQUESTED_EXECUTION_LAYER_MISMATCH", request.ability_ref);
  }
  const options = object.options === undefined ? undefined : asObject(object.options);
  if (object.options !== undefined && !options) {
    throw invalidDownloadInput("OPTIONS_INVALID", request.ability_ref);
  }
  return {
    ability: {
      id: abilityId,
      layer,
      action: "download"
    },
    input: request,
    ...(options ? { options: cloneJsonObject(options) } : {})
  };
};

const parseContentDescriptor = (
  value: unknown,
  abilityId: string
): DownloadResultSummary["content_descriptor"] => {
  const object = asObject(value);
  if (!object) {
    throw invalidDownloadInput("CONTENT_DESCRIPTOR_INVALID", abilityId);
  }
  const contentKind = parseRequiredString(
    object,
    "content_kind",
    "CONTENT_KIND_INVALID",
    abilityId
  );
  const mimeType = parseRequiredString(object, "mime_type", "MIME_TYPE_INVALID", abilityId);
  const sizeBytes = object.size_bytes;
  if (sizeBytes !== undefined && (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes < 0)) {
    throw invalidDownloadInput("SIZE_BYTES_INVALID", abilityId);
  }
  const checksumSha256 = object.checksum_sha256;
  if (
    checksumSha256 !== undefined &&
    (typeof checksumSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(checksumSha256))
  ) {
    throw invalidDownloadInput("CHECKSUM_SHA256_INVALID", abilityId);
  }
  return {
    content_kind: contentKind,
    mime_type: mimeType,
    ...(sizeBytes !== undefined ? { size_bytes: sizeBytes } : {}),
    ...(checksumSha256 !== undefined ? { checksum_sha256: checksumSha256 } : {})
  };
};

const parseBrowserArtifactForContract = (
  value: unknown,
  abilityId: string
): DownloadBrowserTarget["browser_artifact"] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const object = asObject(value);
  if (!object) {
    throw invalidDownloadInput("BROWSER_ARTIFACT_INVALID", abilityId);
  }
  const contentBase64 = parseRequiredString(
    object,
    "content_base64",
    "BROWSER_ARTIFACT_CONTENT_INVALID",
    abilityId
  );
  const artifactRef = parseOptionalString(
    object,
    "artifact_ref",
    "BROWSER_ARTIFACT_REF_INVALID",
    abilityId
  );
  return {
    content_base64: contentBase64,
    ...(artifactRef ? { artifact_ref: artifactRef } : {})
  };
};

export const parseDownloadResultSummaryForContract = (
  value: unknown,
  abilityId = "download.prepare"
): DownloadResultSummary => {
  const object = asObject(value);
  if (!object) {
    throw invalidDownloadInput("DOWNLOAD_RESULT_SUMMARY_INVALID", abilityId);
  }
  const downloadRef = parseRequiredString(
    object,
    "download_ref",
    "DOWNLOAD_REF_INVALID",
    abilityId
  );
  const resultState = parseRequiredString(
    object,
    "result_state",
    "RESULT_STATE_INVALID",
    abilityId
  );
  if (resultState !== "downloaded" && resultState !== "partial") {
    throw invalidDownloadInput("RESULT_STATE_INVALID", abilityId);
  }
  const savedArtifactRefs = parseStringArray(
    object.saved_artifact_refs,
    "SAVED_ARTIFACT_REFS_INVALID",
    abilityId
  );
  const resolvedOutputPath = parseOptionalString(
    object,
    "resolved_output_path",
    "RESOLVED_OUTPUT_PATH_INVALID",
    abilityId
  );
  const sourceUrl = parseOptionalString(object, "source_url", "SOURCE_URL_INVALID", abilityId);
  const fileNameHint = parseOptionalString(
    object,
    "file_name_hint",
    "FILE_NAME_HINT_INVALID",
    abilityId
  );
  if (resultState === "downloaded" && (!resolvedOutputPath || !sourceUrl || !fileNameHint)) {
    throw invalidDownloadInput("DOWNLOADED_RESULT_FIELDS_MISSING", abilityId);
  }
  if (resultState === "partial" && !resolvedOutputPath && (!savedArtifactRefs || savedArtifactRefs.length === 0)) {
    throw invalidDownloadInput("PARTIAL_RESULT_ARTIFACT_MISSING", abilityId);
  }
  return {
    download_ref: downloadRef,
    result_state: resultState as DownloadResultState,
    ...(savedArtifactRefs ? { saved_artifact_refs: savedArtifactRefs } : {}),
    ...(resolvedOutputPath ? { resolved_output_path: resolvedOutputPath } : {}),
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
    ...(fileNameHint ? { file_name_hint: fileNameHint } : {}),
    content_descriptor: parseContentDescriptor(object.content_descriptor, abilityId)
  };
};

export const parseDownloadFailureReasonForContract = (
  value: unknown,
  abilityId = "download.prepare"
): DownloadFailureReason => {
  if (typeof value !== "string" || !FAILURE_REASONS.has(value as DownloadFailureReason)) {
    throw invalidDownloadInput("DOWNLOAD_FAILURE_REASON_INVALID", abilityId);
  }
  return value as DownloadFailureReason;
};

export const parseDownloadTriggerModeForContract = (
  value: unknown,
  abilityId = "download.trigger"
): DownloadTriggerMode => {
  if (value === undefined || value === null) {
    return "resolve_only";
  }
  if (typeof value !== "string" || !TRIGGER_MODES.has(value as DownloadTriggerMode)) {
    throw invalidDownloadInput("DOWNLOAD_TRIGGER_MODE_INVALID", abilityId);
  }
  return value as DownloadTriggerMode;
};

export const parseDownloadBrowserExecutionResultForContract = (
  value: unknown,
  abilityId = "download.trigger"
): DownloadBrowserExecutionResult => {
  const object = asObject(value);
  if (!object || typeof object.success !== "boolean") {
    throw invalidDownloadInput("DOWNLOAD_BROWSER_RESULT_INVALID", abilityId);
  }

  const triggerAudit = asObject(object.trigger_audit);
  if (!object.success) {
    return {
      success: false,
      failure_reason: parseDownloadFailureReasonForContract(object.failure_reason, abilityId),
      ...(triggerAudit ? { trigger_audit: cloneJsonObject(triggerAudit) } : {})
    };
  }

  const target = asObject(object.download_target);
  if (!target) {
    throw invalidDownloadInput("DOWNLOAD_TARGET_MISSING", abilityId);
  }
  const sourceKind = parseRequiredString(
    target,
    "source_kind",
    "DOWNLOAD_SOURCE_KIND_INVALID",
    abilityId
  ) as DownloadSource["source_kind"];
  if (sourceKind !== "direct_url" && sourceKind !== "page_blob" && sourceKind !== "page_derived") {
    throw invalidDownloadInput("DOWNLOAD_SOURCE_KIND_INVALID", abilityId);
  }
  const triggerStatus = parseRequiredString(
    target,
    "trigger_status",
    "DOWNLOAD_TRIGGER_STATUS_INVALID",
    abilityId
  ) as DownloadTriggerStatus;
  if (!TRIGGER_STATUSES.has(triggerStatus)) {
    throw invalidDownloadInput("DOWNLOAD_TRIGGER_STATUS_INVALID", abilityId);
  }
  const triggerMode = parseDownloadTriggerModeForContract(target.trigger_mode, abilityId);
  const triggerSurface = parseRequiredString(
    target,
    "trigger_surface",
    "DOWNLOAD_TRIGGER_SURFACE_INVALID",
    abilityId
  ) as DownloadBrowserTarget["trigger_surface"];
  if (!TRIGGER_SURFACES.has(triggerSurface)) {
    throw invalidDownloadInput("DOWNLOAD_TRIGGER_SURFACE_INVALID", abilityId);
  }

  const browserArtifact = parseBrowserArtifactForContract(target.browser_artifact, abilityId);
  return {
    success: true,
    download_target: {
      target_ref: parseRequiredString(target, "target_ref", "DOWNLOAD_TARGET_REF_INVALID", abilityId),
      source_kind: sourceKind,
      source_url: parseRequiredString(target, "source_url", "SOURCE_URL_INVALID", abilityId),
      ...(parseOptionalString(target, "file_name_hint", "FILE_NAME_HINT_INVALID", abilityId)
        ? {
            file_name_hint: parseOptionalString(
              target,
              "file_name_hint",
              "FILE_NAME_HINT_INVALID",
              abilityId
            )
          }
        : {}),
      content_descriptor: parseContentDescriptor(target.content_descriptor, abilityId),
      ...(browserArtifact ? { browser_artifact: browserArtifact } : {}),
      trigger_status: triggerStatus,
      trigger_mode: triggerMode,
      trigger_surface: triggerSurface
    },
    ...(triggerAudit ? { trigger_audit: cloneJsonObject(triggerAudit) } : {})
  };
};

export const materializeCandidateAbilityFromDownloadSeedForContract = (
  seed: DownloadCandidateShellSeed | unknown
): MaterializedDownloadCandidateAbility => {
  const object = asObject(seed);
  if (!object) {
    throw invalidDownloadInput("CANDIDATE_SHELL_SEED_INVALID");
  }
  const abilityId = parseRequiredString(object, "ability_id", "ABILITY_ID_INVALID", "unknown");
  const abilityKind = parseRequiredString(object, "ability_kind", "ABILITY_KIND_INVALID", abilityId);
  if (abilityKind !== "download") {
    throw invalidDownloadInput("ABILITY_KIND_INVALID", abilityId);
  }
  const descriptor = parseCandidateAbilityDescriptorForContract({
    ability_id: abilityId,
    display_name: parseRequiredString(object, "display_name", "DISPLAY_NAME_INVALID", abilityId),
    ability_kind: "download",
    entrypoint: parseRequiredString(object, "entrypoint", "ENTRYPOINT_INVALID", abilityId),
    platform_scope: object.platform_scope,
    execution_layer_support: object.execution_layer_support,
    input_contract_ref: parseRequiredString(object, "input_contract_ref", "INPUT_CONTRACT_REF_INVALID", abilityId),
    output_contract_ref: parseRequiredString(object, "output_contract_ref", "OUTPUT_CONTRACT_REF_INVALID", abilityId),
    error_contract_ref: parseRequiredString(object, "error_contract_ref", "ERROR_CONTRACT_REF_INVALID", abilityId),
    capture_origin: parseRequiredString(object, "capture_origin", "CAPTURE_ORIGIN_INVALID", abilityId),
    candidate_status: parseRequiredString(object, "candidate_status", "CANDIDATE_STATUS_INVALID", abilityId),
    capture_run_id: parseRequiredString(object, "capture_run_id", "CAPTURE_RUN_ID_INVALID", abilityId),
    capture_profile: parseRequiredString(object, "capture_profile", "CAPTURE_PROFILE_INVALID", abilityId),
    ...(Array.isArray(object.capture_artifact_refs)
      ? { capture_artifact_refs: object.capture_artifact_refs }
      : {}),
    captured_at: parseRequiredString(object, "captured_at", "CAPTURED_AT_INVALID", abilityId)
  });
  const registry = asObject(object.contract_registry_seed);
  if (!registry) {
    throw invalidDownloadInput("CONTRACT_REGISTRY_MISSING", abilityId);
  }
  const registryInput = {
    ability_id: parseRequiredString(registry, "ability_id", "CONTRACT_REGISTRY_OWNER_INVALID", abilityId),
    entries: registry.entries
  };
  resolveCandidateAbilityContractsForContract(descriptor, registryInput);
  return {
    candidate_ability_descriptor: descriptor,
    candidate_ability_contract_registry: registryInput as CandidateAbilityContractRegistry
  };
};

export const buildDownloadPrepareResultSummaryForContract = (input: {
  runId: string;
  request: DownloadAbilityRequest;
  artifactRefs?: string[];
}): DownloadResultSummary => ({
  download_ref: `download.prepare/${input.runId}`,
  result_state: "partial",
  saved_artifact_refs:
    input.artifactRefs && input.artifactRefs.length > 0
      ? [...input.artifactRefs]
      : [`download-prepare://${input.runId}/candidate-handoff`],
  content_descriptor: {
    content_kind:
      input.request.download_goal === "single_media_asset" ? "media_asset" : "file",
    mime_type: "application/octet-stream"
  }
});

export const buildDownloadTriggeredResultSummaryForContract = (input: {
  runId: string;
  target: DownloadBrowserTarget;
  artifactRefs?: string[];
}): DownloadResultSummary => ({
  download_ref: `download.trigger/${input.runId}`,
  result_state: "partial",
  saved_artifact_refs:
    input.artifactRefs && input.artifactRefs.length > 0
      ? [...input.artifactRefs]
      : [`download-trigger://${input.runId}/${input.target.target_ref}`],
  source_url: input.target.source_url,
  ...(input.target.file_name_hint ? { file_name_hint: input.target.file_name_hint } : {}),
  content_descriptor: { ...input.target.content_descriptor }
});

export const buildDownloadLandedResultSummaryForContract = (input: {
  runId: string;
  target: DownloadBrowserTarget;
  resolvedOutputPath: string;
  savedArtifactRefs: string[];
  sizeBytes: number;
  checksumSha256: string;
  fileNameHint: string;
}): DownloadResultSummary => ({
  download_ref: `download.trigger/${input.runId}`,
  result_state: "downloaded",
  saved_artifact_refs: [...input.savedArtifactRefs],
  resolved_output_path: input.resolvedOutputPath,
  source_url: input.target.source_url,
  file_name_hint: input.fileNameHint,
  content_descriptor: {
    ...input.target.content_descriptor,
    size_bytes: input.sizeBytes,
    checksum_sha256: input.checksumSha256
  }
});

export const buildAbilityValidationSeedForDownloadRequest = (input: {
  request: DownloadAbilityRequest;
  materialized: MaterializedDownloadCandidateAbility;
  validationExecutionBoundary?: string;
}): JsonObject => ({
  ...input.materialized,
  ability_validation_request: {
    ability_ref: input.request.ability_ref,
    validation_mode: "smoke_validation",
    profile_ref: input.request.profile_ref,
    requested_execution_layer: input.request.requested_execution_layer,
    expected_capability_kind: "download",
    smoke_input: cloneJsonObject(input.request as unknown as JsonObject)
  },
  validation_execution_boundary: input.validationExecutionBoundary ?? "not_executed_in_fr0021_747"
});
