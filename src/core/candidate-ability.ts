import { CliError } from "./errors.js";
import type { JsonObject } from "./types.js";

export type CandidateAbilityKind = "read" | "write" | "download";
export type CandidateExecutionLayer = "L3" | "L2" | "L1";
export type CandidateContractKind = "input" | "output" | "error";
export type CandidateCaptureOrigin =
  | "l3_adapter_sample"
  | "l2_first_usable_sample"
  | "l1_fallback_sample";
export type CandidateStatus = "draft_candidate" | "candidate_ready";

export interface CandidateAbilityDescriptor {
  ability_id: string;
  display_name: string;
  ability_kind: CandidateAbilityKind;
  entrypoint: string;
  platform_scope: {
    platform_family: string;
    site_pattern?: string;
  };
  execution_layer_support: CandidateExecutionLayer[];
  input_contract_ref: string;
  output_contract_ref: string;
  error_contract_ref: string;
  capture_origin: CandidateCaptureOrigin;
  candidate_status: CandidateStatus;
  capture_run_id: string;
  capture_profile: string;
  seed_replay_input_ref?: string;
  capture_artifact_refs?: string[];
  captured_at: string;
}

export interface CandidateAbilityContractRegistryEntry {
  contract_ref: string;
  contract_kind: CandidateContractKind;
  contract_body: JsonObject;
}

export interface CandidateAbilityContractRegistry {
  ability_id: string;
  entries: CandidateAbilityContractRegistryEntry[];
}

export interface CandidateAbilityInvocation {
  ability: {
    id: string;
    layer: CandidateExecutionLayer;
    action: CandidateAbilityKind;
  };
  input: JsonObject;
  options?: JsonObject;
}

export interface CandidateAbilityContractRefParts {
  contract_ref: string;
  ability_id: string;
  contract_kind: CandidateContractKind;
  major_version: number;
}

export interface ResolvedCandidateAbilityContracts {
  input: CandidateAbilityContractRegistryEntry;
  output: CandidateAbilityContractRegistryEntry;
  error: CandidateAbilityContractRegistryEntry;
}

const ABILITY_KINDS = new Set<CandidateAbilityKind>(["read", "write", "download"]);
const EXECUTION_LAYERS = new Set<CandidateExecutionLayer>(["L3", "L2", "L1"]);
const CONTRACT_KINDS = new Set<CandidateContractKind>(["input", "output", "error"]);
const CAPTURE_ORIGINS = new Set<CandidateCaptureOrigin>([
  "l3_adapter_sample",
  "l2_first_usable_sample",
  "l1_fallback_sample"
]);
const CANDIDATE_STATUSES = new Set<CandidateStatus>(["draft_candidate", "candidate_ready"]);
const CAPTURE_ORIGIN_LAYER: Record<CandidateCaptureOrigin, CandidateExecutionLayer> = {
  l3_adapter_sample: "L3",
  l2_first_usable_sample: "L2",
  l1_fallback_sample: "L1"
};
const CONTRACT_REF_PATTERN = /^cad::([^:]+)::(input|output|error)::v([1-9][0-9]*)$/;
const PLATFORM_FAMILY_PATTERN = /^[a-z][a-z0-9_]*$/;

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const cloneJsonObject = (value: JsonObject): JsonObject =>
  JSON.parse(JSON.stringify(value)) as JsonObject;

const hasOwn = (value: JsonObject, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const invalidCandidateAbilityInput = (
  reason: string,
  abilityId = "unknown"
): CliError =>
  new CliError("ERR_CLI_INVALID_ARGS", "Candidate ability input invalid", {
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
    throw invalidCandidateAbilityInput(reason, abilityId);
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
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidCandidateAbilityInput(reason, abilityId);
  }
  return value.trim();
};

const parseOptionalStringArray = (
  source: JsonObject,
  key: string,
  reason: string,
  abilityId: string
): string[] | undefined => {
  if (!hasOwn(source, key) || source[key] === undefined) {
    return undefined;
  }
  const value = source[key];
  if (!Array.isArray(value)) {
    throw invalidCandidateAbilityInput(reason, abilityId);
  }
  const normalized = value.map((item) =>
    typeof item === "string" ? item.trim() : ""
  );
  if (normalized.some((item) => item.length === 0)) {
    throw invalidCandidateAbilityInput(reason, abilityId);
  }
  return normalized;
};

const parsePlatformScope = (
  value: unknown,
  abilityId: string
): CandidateAbilityDescriptor["platform_scope"] => {
  const object = asObject(value);
  if (!object) {
    throw invalidCandidateAbilityInput("PLATFORM_SCOPE_INVALID", abilityId);
  }
  const platformFamily = parseRequiredString(
    object,
    "platform_family",
    "PLATFORM_FAMILY_INVALID",
    abilityId
  );
  if (!PLATFORM_FAMILY_PATTERN.test(platformFamily)) {
    throw invalidCandidateAbilityInput("PLATFORM_FAMILY_INVALID", abilityId);
  }
  const sitePattern = parseOptionalString(
    object,
    "site_pattern",
    "SITE_PATTERN_INVALID",
    abilityId
  );
  return {
    platform_family: platformFamily,
    ...(sitePattern ? { site_pattern: sitePattern } : {})
  };
};

const parseExecutionLayerSupport = (
  value: unknown,
  abilityId: string
): CandidateExecutionLayer[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidCandidateAbilityInput("EXECUTION_LAYER_SUPPORT_INVALID", abilityId);
  }

  const layers: CandidateExecutionLayer[] = [];
  const seen = new Set<CandidateExecutionLayer>();
  for (const item of value) {
    if (typeof item !== "string" || !EXECUTION_LAYERS.has(item as CandidateExecutionLayer)) {
      throw invalidCandidateAbilityInput("EXECUTION_LAYER_SUPPORT_INVALID", abilityId);
    }
    const layer = item as CandidateExecutionLayer;
    if (seen.has(layer)) {
      throw invalidCandidateAbilityInput("EXECUTION_LAYER_SUPPORT_DUPLICATE", abilityId);
    }
    seen.add(layer);
    layers.push(layer);
  }
  return layers;
};

export const parseCandidateAbilityContractRefForContract = (
  contractRef: unknown,
  abilityId: string,
  expectedKind: CandidateContractKind
): CandidateAbilityContractRefParts => {
  if (typeof contractRef !== "string" || contractRef.trim().length === 0) {
    throw invalidCandidateAbilityInput("CONTRACT_REF_INVALID", abilityId);
  }

  const normalizedRef = contractRef.trim();
  const match = CONTRACT_REF_PATTERN.exec(normalizedRef);
  if (!match) {
    throw invalidCandidateAbilityInput("CONTRACT_REF_INVALID", abilityId);
  }

  const [, ownerAbilityId, contractKind, majorVersion] = match;
  if (ownerAbilityId !== abilityId) {
    throw invalidCandidateAbilityInput("CONTRACT_REF_OWNER_MISMATCH", abilityId);
  }
  if (contractKind !== expectedKind) {
    throw invalidCandidateAbilityInput("CONTRACT_KIND_MISMATCH", abilityId);
  }

  return {
    contract_ref: normalizedRef,
    ability_id: ownerAbilityId,
    contract_kind: contractKind as CandidateContractKind,
    major_version: Number(majorVersion)
  };
};

export const parseCandidateAbilityDescriptorForContract = (
  value: unknown
): CandidateAbilityDescriptor => {
  const object = asObject(value);
  if (!object) {
    throw invalidCandidateAbilityInput("DESCRIPTOR_INVALID");
  }

  const abilityId = parseRequiredString(object, "ability_id", "ABILITY_ID_INVALID", "unknown");
  const displayName = parseRequiredString(
    object,
    "display_name",
    "DISPLAY_NAME_INVALID",
    abilityId
  );
  const abilityKind = parseRequiredString(
    object,
    "ability_kind",
    "ABILITY_KIND_INVALID",
    abilityId
  );
  if (!ABILITY_KINDS.has(abilityKind as CandidateAbilityKind)) {
    throw invalidCandidateAbilityInput("ABILITY_KIND_INVALID", abilityId);
  }
  const entrypoint = parseRequiredString(object, "entrypoint", "ENTRYPOINT_INVALID", abilityId);
  const platformScope = parsePlatformScope(object.platform_scope, abilityId);
  const executionLayerSupport = parseExecutionLayerSupport(
    object.execution_layer_support,
    abilityId
  );
  const inputContractRef = parseRequiredString(
    object,
    "input_contract_ref",
    "INPUT_CONTRACT_REF_INVALID",
    abilityId
  );
  const outputContractRef = parseRequiredString(
    object,
    "output_contract_ref",
    "OUTPUT_CONTRACT_REF_INVALID",
    abilityId
  );
  const errorContractRef = parseRequiredString(
    object,
    "error_contract_ref",
    "ERROR_CONTRACT_REF_INVALID",
    abilityId
  );
  parseCandidateAbilityContractRefForContract(inputContractRef, abilityId, "input");
  parseCandidateAbilityContractRefForContract(outputContractRef, abilityId, "output");
  parseCandidateAbilityContractRefForContract(errorContractRef, abilityId, "error");

  const captureOrigin = parseRequiredString(
    object,
    "capture_origin",
    "CAPTURE_ORIGIN_INVALID",
    abilityId
  );
  if (!CAPTURE_ORIGINS.has(captureOrigin as CandidateCaptureOrigin)) {
    throw invalidCandidateAbilityInput("CAPTURE_ORIGIN_INVALID", abilityId);
  }
  const requiredOriginLayer = CAPTURE_ORIGIN_LAYER[captureOrigin as CandidateCaptureOrigin];
  if (!executionLayerSupport.includes(requiredOriginLayer)) {
    throw invalidCandidateAbilityInput("CAPTURE_ORIGIN_LAYER_UNSUPPORTED", abilityId);
  }

  const candidateStatus = parseRequiredString(
    object,
    "candidate_status",
    "CANDIDATE_STATUS_INVALID",
    abilityId
  );
  if (!CANDIDATE_STATUSES.has(candidateStatus as CandidateStatus)) {
    throw invalidCandidateAbilityInput("CANDIDATE_STATUS_INVALID", abilityId);
  }

  const captureRunId = parseRequiredString(
    object,
    "capture_run_id",
    "CAPTURE_RUN_ID_INVALID",
    abilityId
  );
  const captureProfile = parseRequiredString(
    object,
    "capture_profile",
    "CAPTURE_PROFILE_INVALID",
    abilityId
  );
  const capturedAt = parseRequiredString(
    object,
    "captured_at",
    "CAPTURED_AT_INVALID",
    abilityId
  );
  const seedReplayInputRef = parseOptionalString(
    object,
    "seed_replay_input_ref",
    "SEED_REPLAY_INPUT_REF_INVALID",
    abilityId
  );
  const captureArtifactRefs = parseOptionalStringArray(
    object,
    "capture_artifact_refs",
    "CAPTURE_ARTIFACT_REFS_INVALID",
    abilityId
  );

  return {
    ability_id: abilityId,
    display_name: displayName,
    ability_kind: abilityKind as CandidateAbilityKind,
    entrypoint,
    platform_scope: platformScope,
    execution_layer_support: executionLayerSupport,
    input_contract_ref: inputContractRef,
    output_contract_ref: outputContractRef,
    error_contract_ref: errorContractRef,
    capture_origin: captureOrigin as CandidateCaptureOrigin,
    candidate_status: candidateStatus as CandidateStatus,
    capture_run_id: captureRunId,
    capture_profile: captureProfile,
    ...(seedReplayInputRef ? { seed_replay_input_ref: seedReplayInputRef } : {}),
    ...(captureArtifactRefs ? { capture_artifact_refs: captureArtifactRefs } : {}),
    captured_at: capturedAt
  };
};

const parseRegistryEntry = (
  value: unknown,
  abilityId: string
): CandidateAbilityContractRegistryEntry => {
  const object = asObject(value);
  if (!object) {
    throw invalidCandidateAbilityInput("CONTRACT_REGISTRY_ENTRY_INVALID", abilityId);
  }
  const contractRef = parseRequiredString(
    object,
    "contract_ref",
    "CONTRACT_REF_INVALID",
    abilityId
  );
  const contractKind = parseRequiredString(
    object,
    "contract_kind",
    "CONTRACT_KIND_INVALID",
    abilityId
  );
  if (!CONTRACT_KINDS.has(contractKind as CandidateContractKind)) {
    throw invalidCandidateAbilityInput("CONTRACT_KIND_INVALID", abilityId);
  }
  parseCandidateAbilityContractRefForContract(
    contractRef,
    abilityId,
    contractKind as CandidateContractKind
  );

  const contractBody = asObject(object.contract_body);
  if (!contractBody) {
    throw invalidCandidateAbilityInput("CONTRACT_BODY_INVALID", abilityId);
  }

  return {
    contract_ref: contractRef,
    contract_kind: contractKind as CandidateContractKind,
    contract_body: cloneJsonObject(contractBody)
  };
};

export const parseCandidateAbilityContractRegistryForContract = (
  value: unknown,
  expectedOwner?: CandidateAbilityDescriptor | string
): CandidateAbilityContractRegistry => {
  const expectedAbilityId =
    typeof expectedOwner === "string" ? expectedOwner : expectedOwner?.ability_id;
  const ownerForError = expectedAbilityId ?? "unknown";
  const object = asObject(value);
  if (!object) {
    throw invalidCandidateAbilityInput("CONTRACT_REGISTRY_MISSING", ownerForError);
  }

  const abilityId = parseRequiredString(
    object,
    "ability_id",
    "CONTRACT_REGISTRY_OWNER_INVALID",
    ownerForError
  );
  if (expectedAbilityId && abilityId !== expectedAbilityId) {
    throw invalidCandidateAbilityInput(
      "CONTRACT_REGISTRY_OWNER_MISMATCH",
      expectedAbilityId
    );
  }

  if (!Array.isArray(object.entries)) {
    throw invalidCandidateAbilityInput("CONTRACT_REGISTRY_ENTRIES_INVALID", abilityId);
  }

  const seenRefs = new Set<string>();
  const entries = object.entries.map((entry) => {
    const parsedEntry = parseRegistryEntry(entry, abilityId);
    if (seenRefs.has(parsedEntry.contract_ref)) {
      throw invalidCandidateAbilityInput("CONTRACT_REF_DUPLICATE", abilityId);
    }
    seenRefs.add(parsedEntry.contract_ref);
    return parsedEntry;
  });

  return {
    ability_id: abilityId,
    entries
  };
};

const resolveRegistryEntry = (
  descriptor: CandidateAbilityDescriptor,
  registry: CandidateAbilityContractRegistry,
  kind: CandidateContractKind
): CandidateAbilityContractRegistryEntry => {
  const contractRef =
    kind === "input"
      ? descriptor.input_contract_ref
      : kind === "output"
        ? descriptor.output_contract_ref
        : descriptor.error_contract_ref;
  const entry = registry.entries.find((candidate) => candidate.contract_ref === contractRef);
  if (!entry) {
    throw invalidCandidateAbilityInput("CONTRACT_REF_UNRESOLVED", descriptor.ability_id);
  }
  if (entry.contract_kind !== kind) {
    throw invalidCandidateAbilityInput("CONTRACT_KIND_MISMATCH", descriptor.ability_id);
  }
  return entry;
};

export const resolveCandidateAbilityContractsForContract = (
  descriptorInput: CandidateAbilityDescriptor | unknown,
  registryInput: CandidateAbilityContractRegistry | unknown
): ResolvedCandidateAbilityContracts => {
  const descriptor = parseCandidateAbilityDescriptorForContract(descriptorInput);
  const registry = parseCandidateAbilityContractRegistryForContract(registryInput, descriptor);

  return {
    input: resolveRegistryEntry(descriptor, registry, "input"),
    output: resolveRegistryEntry(descriptor, registry, "output"),
    error: resolveRegistryEntry(descriptor, registry, "error")
  };
};

export const buildCandidateAbilityInvocationForContract = (
  descriptorInput: CandidateAbilityDescriptor | unknown,
  requestedLayer: CandidateExecutionLayer,
  input: JsonObject,
  options?: JsonObject
): CandidateAbilityInvocation => {
  const descriptor = parseCandidateAbilityDescriptorForContract(descriptorInput);
  if (!EXECUTION_LAYERS.has(requestedLayer)) {
    throw invalidCandidateAbilityInput("INVOCATION_LAYER_INVALID", descriptor.ability_id);
  }
  if (!descriptor.execution_layer_support.includes(requestedLayer)) {
    throw invalidCandidateAbilityInput("INVOCATION_LAYER_UNSUPPORTED", descriptor.ability_id);
  }
  if (!asObject(input)) {
    throw invalidCandidateAbilityInput("INVOCATION_INPUT_INVALID", descriptor.ability_id);
  }
  if (options !== undefined && !asObject(options)) {
    throw invalidCandidateAbilityInput("INVOCATION_OPTIONS_INVALID", descriptor.ability_id);
  }

  return {
    ability: {
      id: descriptor.ability_id,
      layer: requestedLayer,
      action: descriptor.ability_kind
    },
    input: cloneJsonObject(input),
    ...(options ? { options: cloneJsonObject(options) } : {})
  };
};

export const validateCandidateAbilityInvocationForContract = (
  descriptorInput: CandidateAbilityDescriptor | unknown,
  invocationInput: unknown
): CandidateAbilityInvocation => {
  const descriptor = parseCandidateAbilityDescriptorForContract(descriptorInput);
  const invocation = asObject(invocationInput);
  if (!invocation) {
    throw invalidCandidateAbilityInput("INVOCATION_INVALID", descriptor.ability_id);
  }

  const ability = asObject(invocation.ability);
  if (!ability) {
    throw invalidCandidateAbilityInput("INVOCATION_ABILITY_INVALID", descriptor.ability_id);
  }
  const abilityId = parseRequiredString(
    ability,
    "id",
    "INVOCATION_ABILITY_ID_INVALID",
    descriptor.ability_id
  );
  if (abilityId !== descriptor.ability_id) {
    throw invalidCandidateAbilityInput(
      "INVOCATION_ABILITY_ID_MISMATCH",
      descriptor.ability_id
    );
  }

  const layer = parseRequiredString(
    ability,
    "layer",
    "INVOCATION_LAYER_INVALID",
    descriptor.ability_id
  );
  if (!EXECUTION_LAYERS.has(layer as CandidateExecutionLayer)) {
    throw invalidCandidateAbilityInput("INVOCATION_LAYER_INVALID", descriptor.ability_id);
  }
  if (!descriptor.execution_layer_support.includes(layer as CandidateExecutionLayer)) {
    throw invalidCandidateAbilityInput("INVOCATION_LAYER_UNSUPPORTED", descriptor.ability_id);
  }

  const action = parseRequiredString(
    ability,
    "action",
    "INVOCATION_ACTION_INVALID",
    descriptor.ability_id
  );
  if (!ABILITY_KINDS.has(action as CandidateAbilityKind)) {
    throw invalidCandidateAbilityInput("INVOCATION_ACTION_INVALID", descriptor.ability_id);
  }
  if (action !== descriptor.ability_kind) {
    throw invalidCandidateAbilityInput("INVOCATION_ACTION_MISMATCH", descriptor.ability_id);
  }

  const input = asObject(invocation.input);
  if (!input) {
    throw invalidCandidateAbilityInput("INVOCATION_INPUT_INVALID", descriptor.ability_id);
  }
  const options = invocation.options === undefined ? undefined : asObject(invocation.options);
  if (invocation.options !== undefined && !options) {
    throw invalidCandidateAbilityInput("INVOCATION_OPTIONS_INVALID", descriptor.ability_id);
  }

  return {
    ability: {
      id: abilityId,
      layer: layer as CandidateExecutionLayer,
      action: action as CandidateAbilityKind
    },
    input: cloneJsonObject(input),
    ...(options ? { options: cloneJsonObject(options) } : {})
  };
};
