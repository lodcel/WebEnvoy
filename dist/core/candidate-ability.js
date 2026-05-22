import { CliError } from "./errors.js";
const ABILITY_KINDS = new Set(["read", "write", "download"]);
const EXECUTION_LAYERS = new Set(["L3", "L2", "L1"]);
const CONTRACT_KINDS = new Set(["input", "output", "error"]);
const CAPTURE_ORIGINS = new Set([
    "l3_adapter_sample",
    "l2_first_usable_sample",
    "l1_fallback_sample"
]);
const CANDIDATE_STATUSES = new Set(["draft_candidate", "candidate_ready"]);
const CAPTURE_ORIGIN_LAYER = {
    l3_adapter_sample: "L3",
    l2_first_usable_sample: "L2",
    l1_fallback_sample: "L1"
};
const CONTRACT_REF_PATTERN = /^cad::([^:]+)::(input|output|error)::v([1-9][0-9]*)$/;
const PLATFORM_FAMILY_PATTERN = /^[a-z][a-z0-9_]*$/;
const asObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const cloneJsonObject = (value) => JSON.parse(JSON.stringify(value));
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const invalidCandidateAbilityInput = (reason, abilityId = "unknown") => new CliError("ERR_CLI_INVALID_ARGS", "Candidate ability input invalid", {
    details: {
        ability_id: abilityId,
        stage: "input_validation",
        reason
    }
});
const parseRequiredString = (source, key, reason, abilityId) => {
    const value = source[key];
    if (typeof value !== "string" || value.trim().length === 0) {
        throw invalidCandidateAbilityInput(reason, abilityId);
    }
    return value.trim();
};
const parseOptionalString = (source, key, reason, abilityId) => {
    if (!hasOwn(source, key) || source[key] === undefined) {
        return undefined;
    }
    const value = source[key];
    if (typeof value !== "string" || value.trim().length === 0) {
        throw invalidCandidateAbilityInput(reason, abilityId);
    }
    return value.trim();
};
const parseOptionalStringArray = (source, key, reason, abilityId) => {
    if (!hasOwn(source, key) || source[key] === undefined) {
        return undefined;
    }
    const value = source[key];
    if (!Array.isArray(value)) {
        throw invalidCandidateAbilityInput(reason, abilityId);
    }
    const normalized = value.map((item) => typeof item === "string" ? item.trim() : "");
    if (normalized.some((item) => item.length === 0)) {
        throw invalidCandidateAbilityInput(reason, abilityId);
    }
    return normalized;
};
const parsePlatformScope = (value, abilityId) => {
    const object = asObject(value);
    if (!object) {
        throw invalidCandidateAbilityInput("PLATFORM_SCOPE_INVALID", abilityId);
    }
    const platformFamily = parseRequiredString(object, "platform_family", "PLATFORM_FAMILY_INVALID", abilityId);
    if (!PLATFORM_FAMILY_PATTERN.test(platformFamily)) {
        throw invalidCandidateAbilityInput("PLATFORM_FAMILY_INVALID", abilityId);
    }
    const sitePattern = parseOptionalString(object, "site_pattern", "SITE_PATTERN_INVALID", abilityId);
    return {
        platform_family: platformFamily,
        ...(sitePattern ? { site_pattern: sitePattern } : {})
    };
};
const parseExecutionLayerSupport = (value, abilityId) => {
    if (!Array.isArray(value) || value.length === 0) {
        throw invalidCandidateAbilityInput("EXECUTION_LAYER_SUPPORT_INVALID", abilityId);
    }
    const layers = [];
    const seen = new Set();
    for (const item of value) {
        if (typeof item !== "string" || !EXECUTION_LAYERS.has(item)) {
            throw invalidCandidateAbilityInput("EXECUTION_LAYER_SUPPORT_INVALID", abilityId);
        }
        const layer = item;
        if (seen.has(layer)) {
            throw invalidCandidateAbilityInput("EXECUTION_LAYER_SUPPORT_DUPLICATE", abilityId);
        }
        seen.add(layer);
        layers.push(layer);
    }
    return layers;
};
export const parseCandidateAbilityContractRefForContract = (contractRef, abilityId, expectedKind) => {
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
        contract_kind: contractKind,
        major_version: Number(majorVersion)
    };
};
export const parseCandidateAbilityDescriptorForContract = (value) => {
    const object = asObject(value);
    if (!object) {
        throw invalidCandidateAbilityInput("DESCRIPTOR_INVALID");
    }
    const abilityId = parseRequiredString(object, "ability_id", "ABILITY_ID_INVALID", "unknown");
    const displayName = parseRequiredString(object, "display_name", "DISPLAY_NAME_INVALID", abilityId);
    const abilityKind = parseRequiredString(object, "ability_kind", "ABILITY_KIND_INVALID", abilityId);
    if (!ABILITY_KINDS.has(abilityKind)) {
        throw invalidCandidateAbilityInput("ABILITY_KIND_INVALID", abilityId);
    }
    const entrypoint = parseRequiredString(object, "entrypoint", "ENTRYPOINT_INVALID", abilityId);
    const platformScope = parsePlatformScope(object.platform_scope, abilityId);
    const executionLayerSupport = parseExecutionLayerSupport(object.execution_layer_support, abilityId);
    const inputContractRef = parseRequiredString(object, "input_contract_ref", "INPUT_CONTRACT_REF_INVALID", abilityId);
    const outputContractRef = parseRequiredString(object, "output_contract_ref", "OUTPUT_CONTRACT_REF_INVALID", abilityId);
    const errorContractRef = parseRequiredString(object, "error_contract_ref", "ERROR_CONTRACT_REF_INVALID", abilityId);
    parseCandidateAbilityContractRefForContract(inputContractRef, abilityId, "input");
    parseCandidateAbilityContractRefForContract(outputContractRef, abilityId, "output");
    parseCandidateAbilityContractRefForContract(errorContractRef, abilityId, "error");
    const captureOrigin = parseRequiredString(object, "capture_origin", "CAPTURE_ORIGIN_INVALID", abilityId);
    if (!CAPTURE_ORIGINS.has(captureOrigin)) {
        throw invalidCandidateAbilityInput("CAPTURE_ORIGIN_INVALID", abilityId);
    }
    const requiredOriginLayer = CAPTURE_ORIGIN_LAYER[captureOrigin];
    if (!executionLayerSupport.includes(requiredOriginLayer)) {
        throw invalidCandidateAbilityInput("CAPTURE_ORIGIN_LAYER_UNSUPPORTED", abilityId);
    }
    const candidateStatus = parseRequiredString(object, "candidate_status", "CANDIDATE_STATUS_INVALID", abilityId);
    if (!CANDIDATE_STATUSES.has(candidateStatus)) {
        throw invalidCandidateAbilityInput("CANDIDATE_STATUS_INVALID", abilityId);
    }
    const captureRunId = parseRequiredString(object, "capture_run_id", "CAPTURE_RUN_ID_INVALID", abilityId);
    const captureProfile = parseRequiredString(object, "capture_profile", "CAPTURE_PROFILE_INVALID", abilityId);
    const capturedAt = parseRequiredString(object, "captured_at", "CAPTURED_AT_INVALID", abilityId);
    const seedReplayInputRef = parseOptionalString(object, "seed_replay_input_ref", "SEED_REPLAY_INPUT_REF_INVALID", abilityId);
    const captureArtifactRefs = parseOptionalStringArray(object, "capture_artifact_refs", "CAPTURE_ARTIFACT_REFS_INVALID", abilityId);
    return {
        ability_id: abilityId,
        display_name: displayName,
        ability_kind: abilityKind,
        entrypoint,
        platform_scope: platformScope,
        execution_layer_support: executionLayerSupport,
        input_contract_ref: inputContractRef,
        output_contract_ref: outputContractRef,
        error_contract_ref: errorContractRef,
        capture_origin: captureOrigin,
        candidate_status: candidateStatus,
        capture_run_id: captureRunId,
        capture_profile: captureProfile,
        ...(seedReplayInputRef ? { seed_replay_input_ref: seedReplayInputRef } : {}),
        ...(captureArtifactRefs ? { capture_artifact_refs: captureArtifactRefs } : {}),
        captured_at: capturedAt
    };
};
const parseRegistryEntry = (value, abilityId) => {
    const object = asObject(value);
    if (!object) {
        throw invalidCandidateAbilityInput("CONTRACT_REGISTRY_ENTRY_INVALID", abilityId);
    }
    const contractRef = parseRequiredString(object, "contract_ref", "CONTRACT_REF_INVALID", abilityId);
    const contractKind = parseRequiredString(object, "contract_kind", "CONTRACT_KIND_INVALID", abilityId);
    if (!CONTRACT_KINDS.has(contractKind)) {
        throw invalidCandidateAbilityInput("CONTRACT_KIND_INVALID", abilityId);
    }
    parseCandidateAbilityContractRefForContract(contractRef, abilityId, contractKind);
    const contractBody = asObject(object.contract_body);
    if (!contractBody) {
        throw invalidCandidateAbilityInput("CONTRACT_BODY_INVALID", abilityId);
    }
    return {
        contract_ref: contractRef,
        contract_kind: contractKind,
        contract_body: cloneJsonObject(contractBody)
    };
};
export const parseCandidateAbilityContractRegistryForContract = (value, expectedOwner) => {
    const expectedAbilityId = typeof expectedOwner === "string" ? expectedOwner : expectedOwner?.ability_id;
    const ownerForError = expectedAbilityId ?? "unknown";
    const object = asObject(value);
    if (!object) {
        throw invalidCandidateAbilityInput("CONTRACT_REGISTRY_MISSING", ownerForError);
    }
    const abilityId = parseRequiredString(object, "ability_id", "CONTRACT_REGISTRY_OWNER_INVALID", ownerForError);
    if (expectedAbilityId && abilityId !== expectedAbilityId) {
        throw invalidCandidateAbilityInput("CONTRACT_REGISTRY_OWNER_MISMATCH", expectedAbilityId);
    }
    if (!Array.isArray(object.entries)) {
        throw invalidCandidateAbilityInput("CONTRACT_REGISTRY_ENTRIES_INVALID", abilityId);
    }
    const seenRefs = new Set();
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
const resolveRegistryEntry = (descriptor, registry, kind) => {
    const contractRef = kind === "input"
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
export const resolveCandidateAbilityContractsForContract = (descriptorInput, registryInput) => {
    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorInput);
    const registry = parseCandidateAbilityContractRegistryForContract(registryInput, descriptor);
    return {
        input: resolveRegistryEntry(descriptor, registry, "input"),
        output: resolveRegistryEntry(descriptor, registry, "output"),
        error: resolveRegistryEntry(descriptor, registry, "error")
    };
};
export const buildCandidateAbilityInvocationForContract = (descriptorInput, requestedLayer, input, options) => {
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
export const validateCandidateAbilityInvocationForContract = (descriptorInput, invocationInput) => {
    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorInput);
    const invocation = asObject(invocationInput);
    if (!invocation) {
        throw invalidCandidateAbilityInput("INVOCATION_INVALID", descriptor.ability_id);
    }
    const ability = asObject(invocation.ability);
    if (!ability) {
        throw invalidCandidateAbilityInput("INVOCATION_ABILITY_INVALID", descriptor.ability_id);
    }
    const abilityId = parseRequiredString(ability, "id", "INVOCATION_ABILITY_ID_INVALID", descriptor.ability_id);
    if (abilityId !== descriptor.ability_id) {
        throw invalidCandidateAbilityInput("INVOCATION_ABILITY_ID_MISMATCH", descriptor.ability_id);
    }
    const layer = parseRequiredString(ability, "layer", "INVOCATION_LAYER_INVALID", descriptor.ability_id);
    if (!EXECUTION_LAYERS.has(layer)) {
        throw invalidCandidateAbilityInput("INVOCATION_LAYER_INVALID", descriptor.ability_id);
    }
    if (!descriptor.execution_layer_support.includes(layer)) {
        throw invalidCandidateAbilityInput("INVOCATION_LAYER_UNSUPPORTED", descriptor.ability_id);
    }
    const action = parseRequiredString(ability, "action", "INVOCATION_ACTION_INVALID", descriptor.ability_id);
    if (!ABILITY_KINDS.has(action)) {
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
            layer: layer,
            action: action
        },
        input: cloneJsonObject(input),
        ...(options ? { options: cloneJsonObject(options) } : {})
    };
};
