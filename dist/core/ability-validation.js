import { CliError } from "./errors.js";
import { buildCandidateAbilityInvocationForContract, parseCandidateAbilityDescriptorForContract } from "./candidate-ability.js";
const EXECUTION_LAYERS = new Set(["L3", "L2", "L1"]);
const TRUST_DOMAIN_KINDS = new Set(["read", "download"]);
const VALIDATION_MODES = new Set([
    "smoke_validation",
    "replay_validation"
]);
const RESULT_STATES = new Set([
    "verified",
    "broken",
    "stale"
]);
const FAILURE_CLASSES = new Set([
    "page_changed",
    "auth_or_session_required",
    "gate_blocked",
    "environment_mismatch",
    "runtime_error"
]);
const FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const asObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const cloneJsonObject = (value) => JSON.parse(JSON.stringify(value));
const cloneStringArray = (value) => value ? [...value] : undefined;
const invalidAbilityValidationInput = (reason, abilityId = "unknown") => new CliError("ERR_CLI_INVALID_ARGS", "Ability validation input invalid", {
    details: {
        ability_id: abilityId,
        stage: "input_validation",
        reason
    }
});
const parseRequiredString = (source, key, reason, abilityId) => {
    const value = source[key];
    if (typeof value !== "string" || value.trim().length === 0) {
        throw invalidAbilityValidationInput(reason, abilityId);
    }
    return value.trim();
};
const parseOptionalString = (source, key, reason, abilityId) => {
    if (!hasOwn(source, key) || source[key] === undefined) {
        return undefined;
    }
    const value = source[key];
    if (typeof value !== "string" || value.trim().length === 0) {
        throw invalidAbilityValidationInput(reason, abilityId);
    }
    return value.trim();
};
const parseStringArray = (value, reason, abilityId) => {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw invalidAbilityValidationInput(reason, abilityId);
    }
    const normalized = value.map((item) => typeof item === "string" ? item.trim() : "");
    if (normalized.some((item) => item.length === 0)) {
        throw invalidAbilityValidationInput(reason, abilityId);
    }
    return normalized;
};
const parseExecutionLayer = (value, reason, abilityId) => {
    if (typeof value !== "string" || !EXECUTION_LAYERS.has(value)) {
        throw invalidAbilityValidationInput(reason, abilityId);
    }
    return value;
};
const parseFailureClass = (value, reason, abilityId) => {
    if (typeof value !== "string" || !FAILURE_CLASSES.has(value)) {
        throw invalidAbilityValidationInput(reason, abilityId);
    }
    return value;
};
const parseTrustDomainKind = (value, reason, abilityId) => {
    if (typeof value !== "string" || !TRUST_DOMAIN_KINDS.has(value)) {
        throw invalidAbilityValidationInput(reason, abilityId);
    }
    return value;
};
export const assertDescriptorIsInAbilityTrustDomain = (descriptorInput) => {
    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorInput);
    if (!TRUST_DOMAIN_KINDS.has(descriptor.ability_kind)) {
        throw invalidAbilityValidationInput("ABILITY_KIND_NOT_IN_TRUST_DOMAIN", descriptor.ability_id);
    }
    return descriptor;
};
const assertExpectedKindMatchesDescriptor = (descriptor, expectedKind) => {
    if (expectedKind !== descriptor.ability_kind) {
        throw invalidAbilityValidationInput("EXPECTED_CAPABILITY_KIND_MISMATCH", descriptor.ability_id);
    }
};
const assertLayerSupported = (descriptor, layer, reason) => {
    if (!descriptor.execution_layer_support.includes(layer)) {
        throw invalidAbilityValidationInput(reason, descriptor.ability_id);
    }
};
const assertAbilityRefMatchesDescriptor = (descriptor, abilityRef) => {
    if (abilityRef !== descriptor.ability_id) {
        throw invalidAbilityValidationInput("ABILITY_REF_MISMATCH", descriptor.ability_id);
    }
};
export const parseAbilityValidationRequestForContract = (descriptorInput, value) => {
    const descriptor = assertDescriptorIsInAbilityTrustDomain(descriptorInput);
    const object = asObject(value);
    if (!object) {
        throw invalidAbilityValidationInput("VALIDATION_REQUEST_INVALID", descriptor.ability_id);
    }
    const abilityRef = parseRequiredString(object, "ability_ref", "ABILITY_REF_INVALID", descriptor.ability_id);
    assertAbilityRefMatchesDescriptor(descriptor, abilityRef);
    const validationMode = parseRequiredString(object, "validation_mode", "VALIDATION_MODE_INVALID", descriptor.ability_id);
    if (validationMode !== "smoke_validation") {
        throw invalidAbilityValidationInput("VALIDATION_MODE_INVALID", descriptor.ability_id);
    }
    const profileRef = parseRequiredString(object, "profile_ref", "PROFILE_REF_INVALID", descriptor.ability_id);
    const requestedExecutionLayer = parseExecutionLayer(object.requested_execution_layer, "REQUESTED_EXECUTION_LAYER_INVALID", descriptor.ability_id);
    assertLayerSupported(descriptor, requestedExecutionLayer, "REQUESTED_EXECUTION_LAYER_UNSUPPORTED");
    const expectedCapabilityKind = parseTrustDomainKind(object.expected_capability_kind, "EXPECTED_CAPABILITY_KIND_INVALID", descriptor.ability_id);
    assertExpectedKindMatchesDescriptor(descriptor, expectedCapabilityKind);
    const smokeInput = asObject(object.smoke_input);
    if (!smokeInput) {
        throw invalidAbilityValidationInput("SMOKE_INPUT_INVALID", descriptor.ability_id);
    }
    return {
        ability_ref: abilityRef,
        validation_mode: "smoke_validation",
        profile_ref: profileRef,
        requested_execution_layer: requestedExecutionLayer,
        expected_capability_kind: expectedCapabilityKind,
        smoke_input: cloneJsonObject(smokeInput)
    };
};
export const parseAbilityReplayRequestForContract = (descriptorInput, value) => {
    const descriptor = assertDescriptorIsInAbilityTrustDomain(descriptorInput);
    const object = asObject(value);
    if (!object) {
        throw invalidAbilityValidationInput("REPLAY_REQUEST_INVALID", descriptor.ability_id);
    }
    const abilityRef = parseRequiredString(object, "ability_ref", "ABILITY_REF_INVALID", descriptor.ability_id);
    assertAbilityRefMatchesDescriptor(descriptor, abilityRef);
    const profileRef = parseRequiredString(object, "profile_ref", "PROFILE_REF_INVALID", descriptor.ability_id);
    const requestedExecutionLayer = parseExecutionLayer(object.requested_execution_layer, "REQUESTED_EXECUTION_LAYER_INVALID", descriptor.ability_id);
    assertLayerSupported(descriptor, requestedExecutionLayer, "REQUESTED_EXECUTION_LAYER_UNSUPPORTED");
    const expectedCapabilityKind = parseTrustDomainKind(object.expected_capability_kind, "EXPECTED_CAPABILITY_KIND_INVALID", descriptor.ability_id);
    assertExpectedKindMatchesDescriptor(descriptor, expectedCapabilityKind);
    const replaySource = parseRequiredString(object, "replay_source", "REPLAY_SOURCE_INVALID", descriptor.ability_id);
    if (replaySource !== "last_success_input" && replaySource !== "explicit_input_snapshot") {
        throw invalidAbilityValidationInput("REPLAY_SOURCE_INVALID", descriptor.ability_id);
    }
    const replayReason = parseRequiredString(object, "replay_reason", "REPLAY_REASON_INVALID", descriptor.ability_id);
    if (replaySource === "last_success_input") {
        if (hasOwn(object, "replay_input_ref")) {
            throw invalidAbilityValidationInput("REPLAY_INPUT_REF_UNEXPECTED", descriptor.ability_id);
        }
        return {
            ability_ref: abilityRef,
            profile_ref: profileRef,
            requested_execution_layer: requestedExecutionLayer,
            expected_capability_kind: expectedCapabilityKind,
            replay_source: "last_success_input",
            replay_reason: replayReason
        };
    }
    const replayInputRef = parseRequiredString(object, "replay_input_ref", "REPLAY_INPUT_REF_INVALID", descriptor.ability_id);
    return {
        ability_ref: abilityRef,
        profile_ref: profileRef,
        requested_execution_layer: requestedExecutionLayer,
        expected_capability_kind: expectedCapabilityKind,
        replay_source: "explicit_input_snapshot",
        replay_input_ref: replayInputRef,
        replay_reason: replayReason
    };
};
export const buildAbilityBaselineDescriptorForContract = (descriptorInput, profileRef) => {
    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorInput);
    if (typeof profileRef !== "string" || profileRef.trim().length === 0) {
        throw invalidAbilityValidationInput("PROFILE_REF_INVALID", descriptor.ability_id);
    }
    return {
        entrypoint: descriptor.entrypoint,
        input_contract_ref: descriptor.input_contract_ref,
        output_contract_ref: descriptor.output_contract_ref,
        error_contract_ref: descriptor.error_contract_ref,
        profile_ref: profileRef.trim(),
        execution_layer_support: [...descriptor.execution_layer_support]
    };
};
export const buildReplayInputPayloadLocatorForContract = (snapshotRef) => {
    if (typeof snapshotRef !== "string" || snapshotRef.trim().length === 0) {
        throw invalidAbilityValidationInput("SNAPSHOT_REF_INVALID");
    }
    return `replay-store://input-snapshot/${encodeURIComponent(snapshotRef.trim())}`;
};
export const buildReplayInputSnapshotRefForContract = (input) => {
    if (!EXECUTION_LAYERS.has(input.executionLayer)) {
        throw invalidAbilityValidationInput("SNAPSHOT_EXECUTION_LAYER_INVALID", input.abilityRef);
    }
    for (const [fieldName, value] of [
        ["snapshot_ref", input.snapshotRef],
        ["ability_ref", input.abilityRef],
        ["profile_ref", input.profileRef],
        ["captured_input_contract_ref", input.capturedInputContractRef],
        ["source_run_id", input.sourceRunId],
        ["captured_at", input.capturedAt]
    ]) {
        if (typeof value !== "string" || value.trim().length === 0) {
            throw invalidAbilityValidationInput(`${fieldName.toUpperCase()}_INVALID`, input.abilityRef);
        }
    }
    return {
        snapshot_ref: input.snapshotRef.trim(),
        ability_ref: input.abilityRef.trim(),
        profile_ref: input.profileRef.trim(),
        execution_layer: input.executionLayer,
        captured_input_contract_ref: input.capturedInputContractRef.trim(),
        source_run_id: input.sourceRunId.trim(),
        payload_locator: buildReplayInputPayloadLocatorForContract(input.snapshotRef),
        captured_at: input.capturedAt.trim()
    };
};
export const assertReplayInputSnapshotMatchesScopeForContract = (descriptorInput, snapshot, input) => {
    const descriptor = assertDescriptorIsInAbilityTrustDomain(descriptorInput);
    if (!snapshot) {
        throw invalidAbilityValidationInput("REPLAY_INPUT_SNAPSHOT_MISSING", descriptor.ability_id);
    }
    if (snapshot.ability_ref !== descriptor.ability_id) {
        throw invalidAbilityValidationInput("REPLAY_INPUT_SNAPSHOT_ABILITY_MISMATCH", descriptor.ability_id);
    }
    if (snapshot.profile_ref !== input.profileRef) {
        throw invalidAbilityValidationInput("REPLAY_INPUT_SNAPSHOT_PROFILE_MISMATCH", descriptor.ability_id);
    }
    if (snapshot.execution_layer !== input.executionLayer) {
        throw invalidAbilityValidationInput("REPLAY_INPUT_SNAPSHOT_LAYER_MISMATCH", descriptor.ability_id);
    }
    if (snapshot.captured_input_contract_ref !== descriptor.input_contract_ref) {
        throw invalidAbilityValidationInput("REPLAY_INPUT_SNAPSHOT_CONTRACT_MISMATCH", descriptor.ability_id);
    }
    if (snapshot.payload_locator !== buildReplayInputPayloadLocatorForContract(snapshot.snapshot_ref)) {
        throw invalidAbilityValidationInput("REPLAY_INPUT_SNAPSHOT_LOCATOR_INVALID", descriptor.ability_id);
    }
    return snapshot;
};
const isIsoLike = (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
export const buildLatestValidationForContract = (input) => {
    const descriptor = assertDescriptorIsInAbilityTrustDomain(input.descriptor);
    if (!VALIDATION_MODES.has(input.validationMode)) {
        throw invalidAbilityValidationInput("VALIDATION_MODE_INVALID", descriptor.ability_id);
    }
    if (input.resultState !== "verified" && input.resultState !== "broken") {
        throw invalidAbilityValidationInput("RESULT_STATE_INVALID", descriptor.ability_id);
    }
    if (typeof input.runId !== "string" || input.runId.trim().length === 0) {
        throw invalidAbilityValidationInput("RUN_ID_INVALID", descriptor.ability_id);
    }
    if (typeof input.validatedAt !== "string" || !isIsoLike(input.validatedAt)) {
        throw invalidAbilityValidationInput("VALIDATED_AT_INVALID", descriptor.ability_id);
    }
    if (!descriptor.execution_layer_support.includes(input.validatedExecutionLayer)) {
        throw invalidAbilityValidationInput("VALIDATED_EXECUTION_LAYER_UNSUPPORTED", descriptor.ability_id);
    }
    if (input.resultState === "verified" && input.failureClass) {
        throw invalidAbilityValidationInput("FAILURE_CLASS_UNEXPECTED", descriptor.ability_id);
    }
    if (input.resultState === "broken" && !input.failureClass) {
        throw invalidAbilityValidationInput("FAILURE_CLASS_REQUIRED", descriptor.ability_id);
    }
    return {
        validation_mode: input.validationMode,
        result_state: input.resultState,
        ...(input.failureClass ? { failure_class: input.failureClass } : {}),
        validated_at: input.validatedAt,
        run_id: input.runId.trim(),
        validated_execution_layer: input.validatedExecutionLayer,
        baseline_descriptor: buildAbilityBaselineDescriptorForContract(descriptor, input.profileRef),
        ...(input.artifactRefs ? { artifact_refs: [...input.artifactRefs] } : {})
    };
};
const parseLatestValidation = (value, abilityId) => {
    const object = asObject(value);
    if (!object) {
        throw invalidAbilityValidationInput("LATEST_VALIDATION_INVALID", abilityId);
    }
    const validationMode = parseRequiredString(object, "validation_mode", "VALIDATION_MODE_INVALID", abilityId);
    if (!VALIDATION_MODES.has(validationMode)) {
        throw invalidAbilityValidationInput("VALIDATION_MODE_INVALID", abilityId);
    }
    const resultState = parseRequiredString(object, "result_state", "RESULT_STATE_INVALID", abilityId);
    if (!RESULT_STATES.has(resultState)) {
        throw invalidAbilityValidationInput("RESULT_STATE_INVALID", abilityId);
    }
    const failureClass = object.failure_class === undefined
        ? undefined
        : parseFailureClass(object.failure_class, "FAILURE_CLASS_INVALID", abilityId);
    if (resultState === "verified" && failureClass) {
        throw invalidAbilityValidationInput("FAILURE_CLASS_UNEXPECTED", abilityId);
    }
    if (resultState === "broken" && !failureClass) {
        throw invalidAbilityValidationInput("FAILURE_CLASS_REQUIRED", abilityId);
    }
    const validatedAt = parseRequiredString(object, "validated_at", "VALIDATED_AT_INVALID", abilityId);
    if (!isIsoLike(validatedAt)) {
        throw invalidAbilityValidationInput("VALIDATED_AT_INVALID", abilityId);
    }
    const runId = parseRequiredString(object, "run_id", "RUN_ID_INVALID", abilityId);
    const validatedExecutionLayer = parseExecutionLayer(object.validated_execution_layer, "VALIDATED_EXECUTION_LAYER_INVALID", abilityId);
    const baseline = asObject(object.baseline_descriptor);
    if (!baseline) {
        throw invalidAbilityValidationInput("BASELINE_DESCRIPTOR_INVALID", abilityId);
    }
    const executionLayerSupport = baseline.execution_layer_support;
    if (!Array.isArray(executionLayerSupport) || executionLayerSupport.length === 0) {
        throw invalidAbilityValidationInput("BASELINE_EXECUTION_LAYER_SUPPORT_INVALID", abilityId);
    }
    const parsedSupport = executionLayerSupport.map((layer) => parseExecutionLayer(layer, "BASELINE_EXECUTION_LAYER_SUPPORT_INVALID", abilityId));
    const parsedBaseline = {
        entrypoint: parseRequiredString(baseline, "entrypoint", "BASELINE_ENTRYPOINT_INVALID", abilityId),
        input_contract_ref: parseRequiredString(baseline, "input_contract_ref", "BASELINE_INPUT_CONTRACT_REF_INVALID", abilityId),
        output_contract_ref: parseRequiredString(baseline, "output_contract_ref", "BASELINE_OUTPUT_CONTRACT_REF_INVALID", abilityId),
        error_contract_ref: parseRequiredString(baseline, "error_contract_ref", "BASELINE_ERROR_CONTRACT_REF_INVALID", abilityId),
        profile_ref: parseRequiredString(baseline, "profile_ref", "BASELINE_PROFILE_REF_INVALID", abilityId),
        execution_layer_support: parsedSupport
    };
    return {
        validation_mode: validationMode,
        result_state: resultState,
        ...(failureClass ? { failure_class: failureClass } : {}),
        validated_at: validatedAt,
        run_id: runId,
        validated_execution_layer: validatedExecutionLayer,
        baseline_descriptor: parsedBaseline,
        ...(parseStringArray(object.artifact_refs, "ARTIFACT_REFS_INVALID", abilityId)
            ? { artifact_refs: parseStringArray(object.artifact_refs, "ARTIFACT_REFS_INVALID", abilityId) }
            : {})
    };
};
const latestIsStale = (input) => {
    if (input.latest.result_state === "stale") {
        return true;
    }
    const validatedAt = Date.parse(input.latest.validated_at);
    if (Number.isNaN(validatedAt) || input.now.getTime() - validatedAt > FRESHNESS_WINDOW_MS) {
        return true;
    }
    const baseline = input.latest.baseline_descriptor;
    return (baseline.entrypoint !== input.descriptor.entrypoint ||
        baseline.input_contract_ref !== input.descriptor.input_contract_ref ||
        baseline.output_contract_ref !== input.descriptor.output_contract_ref ||
        baseline.error_contract_ref !== input.descriptor.error_contract_ref ||
        baseline.profile_ref !== input.profileRef ||
        !input.descriptor.execution_layer_support.includes(input.latest.validated_execution_layer));
};
const normalizeLatestValidationForCurrentDescriptor = (input) => {
    const latest = parseLatestValidation(input.latest, input.descriptor.ability_id);
    if (latest.validated_execution_layer !== input.executionLayer) {
        throw invalidAbilityValidationInput("VALIDATED_EXECUTION_LAYER_SCOPE_MISMATCH", input.descriptor.ability_id);
    }
    if (!latestIsStale({
        descriptor: input.descriptor,
        profileRef: input.profileRef,
        latest,
        now: input.now
    })) {
        return latest;
    }
    return {
        ...latest,
        result_state: "stale"
    };
};
const modeRank = {
    smoke_validation: 0,
    replay_validation: 1
};
export const buildAbilityHealthViewForContract = (input) => {
    const descriptor = assertDescriptorIsInAbilityTrustDomain(input.descriptor);
    if (!EXECUTION_LAYERS.has(input.executionLayer)) {
        throw invalidAbilityValidationInput("EXECUTION_LAYER_INVALID", descriptor.ability_id);
    }
    assertLayerSupported(descriptor, input.executionLayer, "EXECUTION_LAYER_UNSUPPORTED");
    if (typeof input.profileRef !== "string" || input.profileRef.trim().length === 0) {
        throw invalidAbilityValidationInput("PROFILE_REF_INVALID", descriptor.ability_id);
    }
    const profileRef = input.profileRef.trim();
    const byMode = new Map();
    for (const latest of input.latestValidations ?? []) {
        const normalized = normalizeLatestValidationForCurrentDescriptor({
            descriptor,
            profileRef,
            executionLayer: input.executionLayer,
            latest,
            now: input.now ?? new Date()
        });
        byMode.set(normalized.validation_mode, normalized);
    }
    const latestValidations = [...byMode.values()].sort((left, right) => modeRank[left.validation_mode] - modeRank[right.validation_mode]);
    const currentLatest = latestValidations.filter((latest) => latest.result_state !== "stale");
    const currentSmoke = currentLatest.find((latest) => latest.validation_mode === "smoke_validation");
    const currentReplay = currentLatest.find((latest) => latest.validation_mode === "replay_validation");
    const hasVerified = currentLatest.some((latest) => latest.result_state === "verified");
    const hasBroken = currentLatest.some((latest) => latest.result_state === "broken");
    let healthState;
    if (latestValidations.length === 0) {
        healthState = "unknown";
    }
    else if (currentLatest.length === 0) {
        healthState = "stale";
    }
    else if (hasVerified && !hasBroken) {
        healthState = "healthy";
    }
    else if (hasVerified && hasBroken) {
        healthState = "degraded";
    }
    else {
        healthState = "broken";
    }
    let validationCoverageState;
    if (currentLatest.length === 0) {
        validationCoverageState = "none";
    }
    else if (currentLatest.length === 1 &&
        currentSmoke?.result_state === "verified") {
        validationCoverageState = "smoke_only";
    }
    else if (currentLatest.length === 1 &&
        currentReplay?.result_state === "verified") {
        validationCoverageState = "replay_only";
    }
    else if (currentLatest.length === 2 &&
        currentSmoke?.result_state === "verified" &&
        currentReplay?.result_state === "verified") {
        validationCoverageState = "smoke_plus_replay";
    }
    else {
        validationCoverageState = "divergent";
    }
    const smokeReplayMismatch = validationCoverageState === "divergent" &&
        currentSmoke !== undefined &&
        currentReplay !== undefined &&
        currentSmoke.result_state !== currentReplay.result_state;
    return {
        ability_ref: descriptor.ability_id,
        profile_ref: profileRef,
        execution_layer: input.executionLayer,
        health_state: healthState,
        validation_coverage_state: validationCoverageState,
        latest_validations: latestValidations,
        ...(input.lastSuccessInputRef ? { last_success_input_ref: input.lastSuccessInputRef } : {}),
        ...(smokeReplayMismatch ? { divergence_reason: "smoke_replay_mismatch" } : {})
    };
};
export const buildAbilityInvocationForValidationContract = (input) => buildCandidateAbilityInvocationForContract(assertDescriptorIsInAbilityTrustDomain(input.descriptor), input.executionLayer, input.invocationInput);
export const classifyAbilityValidationFailureForContract = (error) => {
    if (error instanceof CliError) {
        const reason = typeof error.details?.reason === "string" ? error.details.reason : "";
        if (/PAGE|SELECTOR|CONTRACT|OUTPUT|RESULT/u.test(reason)) {
            return "page_changed";
        }
        if (/AUTH|SESSION|LOGIN/u.test(reason)) {
            return "auth_or_session_required";
        }
        if (/GATE|RISK|BLOCK/u.test(reason)) {
            return "gate_blocked";
        }
        if (/LAYER|PROFILE|ENVIRONMENT|ENTRYPOINT/u.test(reason)) {
            return "environment_mismatch";
        }
    }
    return "runtime_error";
};
export const parseAbilityFailureClassForContract = (value, abilityId = "unknown") => parseFailureClass(value, "FAILURE_CLASS_INVALID", abilityId);
export const cloneReplayInputPayloadForContract = (value, abilityId = "unknown") => {
    const object = asObject(value);
    if (!object) {
        throw invalidAbilityValidationInput("REPLAY_INPUT_PAYLOAD_INVALID", abilityId);
    }
    return cloneJsonObject(object);
};
export const cloneLatestValidationForContract = (latest) => ({
    ...latest,
    baseline_descriptor: {
        ...latest.baseline_descriptor,
        execution_layer_support: [...latest.baseline_descriptor.execution_layer_support]
    },
    ...(latest.artifact_refs ? { artifact_refs: cloneStringArray(latest.artifact_refs) } : {})
});
