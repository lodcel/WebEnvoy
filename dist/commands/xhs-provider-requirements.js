const XHS_PROVIDER_CONTRACT_REFS = ["FR-0033.browser_provider_contract.v1"];
const XHS_EVIDENCE_POLICY_REFS = [
    "FR-0040.provider_evidence_record.v1",
    "FR-0041.evidence_redaction_policy.v1"
];
const XHS_READ_RUNTIME_REQUIREMENTS = [
    "profile_binding",
    "extension_binding",
    "native_messaging",
    "target_tab",
    "real_browser",
    "headless_forbidden",
    "runtime_bootstrap_ready",
    "provider_doctor_passed"
];
const XHS_PROVIDER_REQUIREMENT_FAIL_CLOSED_REASONS = [
    "capability_not_declared",
    "unsupported_action",
    "unsupported_execution_layer",
    "runtime_requirement_missing",
    "provider_limitation_conflict",
    "unknown_limitation",
    "diagnostic_only",
    "transport_not_attachable",
    "headless_policy_conflict",
    "no_extension_binding",
    "no_profile_binding",
    "no_native_messaging",
    "no_real_browser_attestation",
    "verification_source_missing",
    "verification_source_stale",
    "evidence_ref_invalid"
];
const XHS_PROVIDER_REQUIREMENT_NON_PROOFS = [
    "driver_requirement_declaration_does_not_prove_provider_capability_allowed",
    "driver_requirement_declaration_does_not_prove_runtime_ready",
    "driver_requirement_declaration_does_not_prove_target_tab_ready",
    "driver_requirement_declaration_does_not_prove_live_evidence_accepted",
    "driver_requirement_declaration_does_not_prove_syvert_normalized_result_complete",
    "driver_requirement_declaration_does_not_enable_write"
];
const XHS_READ_DOWNSTREAM_SLICE_REFS = ["#1166", "#1167", "#1168"];
const XHS_READ_COMMAND_REQUIREMENTS = {
    "xhs.search": {
        abilityId: "xhs.note.search.v1",
        requirementRef: "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read"
    },
    "xhs.detail": {
        abilityId: "xhs.note.detail.v1",
        requirementRef: "FR-0061.xhs_driver_provider_requirements.v1/xhs.detail.read"
    },
    "xhs.user_home": {
        abilityId: "xhs.user.home.v1",
        requirementRef: "FR-0061.xhs_driver_provider_requirements.v1/xhs.user_home.read"
    }
};
const isRuntimeBoundExecutionMode = (requestedExecutionMode) => requestedExecutionMode === "recon" ||
    requestedExecutionMode === "live_read_limited" ||
    requestedExecutionMode === "live_read_high_risk" ||
    requestedExecutionMode === "live_write";
const minimumSupportStateForMode = (requestedExecutionMode) => isRuntimeBoundExecutionMode(requestedExecutionMode)
    ? "runtime_attested"
    : "statically_verified";
const modeListForRequirement = (requestedExecutionMode) => requestedExecutionMode ? [requestedExecutionMode] : ["dry_run", "recon"];
const buildDeclaration = (input) => {
    const minimumSupportState = minimumSupportStateForMode(input.requestedExecutionMode);
    return {
        declaration_id: input.declarationId,
        declaration_version: "v1",
        driver_contract_ref: "FR-0061.xhs_driver_contract.v1",
        provider_requirement_ref: input.providerRequirementRef,
        ability_scope: {
            command: input.command,
            ability_id: input.ability.id,
            ability_layer: input.ability.layer,
            ability_action: input.ability.action
        },
        required_runtime_requirements: minimumSupportState === "statically_verified" ? [] : [...input.requiredRuntimeRequirements],
        required_actions: [...input.requiredActions],
        required_execution_layers: [...input.requiredExecutionLayers],
        minimum_support_state: minimumSupportState,
        provider_contract_refs: [...XHS_PROVIDER_CONTRACT_REFS],
        capability_verification_ref: "FR-0035.provider_capability_verification_model.v1",
        evidence_policy_refs: [...XHS_EVIDENCE_POLICY_REFS],
        applies_to_execution_modes: modeListForRequirement(input.requestedExecutionMode),
        provider_requirement_refs: [input.providerRequirementRef],
        fail_closed_reasons: [...XHS_PROVIDER_REQUIREMENT_FAIL_CLOSED_REASONS],
        non_proofs: [...XHS_PROVIDER_REQUIREMENT_NON_PROOFS],
        downstream_slice_refs: [...input.downstreamSliceRefs]
    };
};
export const declareXhsDriverProviderRequirementsForContract = (input) => {
    const readRequirement = XHS_READ_COMMAND_REQUIREMENTS[input.command];
    if (readRequirement &&
        input.ability.action === "read" &&
        input.ability.id === readRequirement.abilityId) {
        return buildDeclaration({
            declarationId: `xhs-driver-provider-requirements:${input.command}:read:v1`,
            providerRequirementRef: readRequirement.requirementRef,
            command: input.command,
            ability: input.ability,
            requiredRuntimeRequirements: XHS_READ_RUNTIME_REQUIREMENTS,
            requiredActions: ["read", "diagnose"],
            requiredExecutionLayers: ["L3"],
            requestedExecutionMode: input.requestedExecutionMode,
            downstreamSliceRefs: XHS_READ_DOWNSTREAM_SLICE_REFS
        });
    }
    return null;
};
export const requiresXhsProviderRuntimePreparationForContract = (declaration) => declaration.minimum_support_state === "runtime_attested" ||
    declaration.minimum_support_state === "runtime_observed" ||
    declaration.minimum_support_state === "live_evidence_attested";
