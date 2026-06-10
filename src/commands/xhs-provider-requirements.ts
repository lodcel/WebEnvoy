import type { AbilityAction, AbilityLayer, AbilityRef, XhsExecutionMode } from "./xhs-input.js";

export type XhsProviderRuntimeRequirement =
  | "profile_binding"
  | "extension_binding"
  | "native_messaging"
  | "target_tab"
  | "real_browser"
  | "headless_forbidden"
  | "runtime_bootstrap_ready"
  | "provider_doctor_passed";

export type XhsProviderRequiredAction = "read" | "diagnose" | "write_admit";
export type XhsProviderSupportState =
  | "statically_verified"
  | "health_checked"
  | "runtime_attested"
  | "runtime_observed"
  | "live_evidence_attested";
export type XhsLiveWriteCapabilityLevel =
  | "read_only"
  | "write_admit"
  | "write_prepare"
  | "live_write_commit";
export type XhsLiveWriteCapabilityGateInput = {
  taxonomy_version: "v1";
  requested_capability_level: XhsLiveWriteCapabilityLevel;
  maximum_capability_level: XhsLiveWriteCapabilityLevel;
  minimum_required_level: XhsLiveWriteCapabilityLevel;
  capability_owner: "#1179";
  workflow_ref: "xhs.creator_publish.admit";
  target_scope_ref: "xhs.creator_publish.admit:creator.xiaohongshu.com/creator_publish_tab";
  provider_requirement_ref: string;
  operator_unlock_ref: null;
  default_commit_lock_ref: null;
  account_safety_ref: string | null;
  runtime_target_binding_ref: null;
  anti_detection_gate_ref: null;
  live_evidence_gate_ref: null;
  evidence_refs: string[];
};

export type XhsDriverProviderRequirementDeclaration = {
  declaration_id: string;
  declaration_version: "v1";
  driver_contract_ref: "FR-0061.xhs_driver_contract.v1";
  provider_requirement_ref: string;
  ability_scope: {
    command: string;
    ability_id: string;
    ability_layer: AbilityLayer;
    ability_action: AbilityAction;
  };
  required_runtime_requirements: XhsProviderRuntimeRequirement[];
  required_actions: XhsProviderRequiredAction[];
  required_execution_layers: AbilityLayer[];
  minimum_support_state: XhsProviderSupportState;
  provider_contract_refs: Array<"FR-0033.browser_provider_contract.v1">;
  capability_verification_ref: "FR-0035.provider_capability_verification_model.v1";
  evidence_policy_refs: Array<
    "FR-0040.provider_evidence_record.v1" | "FR-0041.evidence_redaction_policy.v1"
  >;
  applies_to_execution_modes: XhsExecutionMode[];
  provider_requirement_refs: string[];
  fail_closed_reasons: string[];
  non_proofs: string[];
  downstream_slice_refs: string[];
  live_write_capability_gate_input?: XhsLiveWriteCapabilityGateInput;
  profile_manifest_provider_allowlist_ref?: "FR-0065.profile_manifest_provider_allowlist.v1";
  account_safety_gate_ref?: "FR-0066.account_safety_gate.v1";
  required_secret_kinds?: string[];
  default_live_write_commit_lock?: "locked";
};

const XHS_PROVIDER_CONTRACT_REFS = ["FR-0033.browser_provider_contract.v1"] as const;
const XHS_EVIDENCE_POLICY_REFS = [
  "FR-0040.provider_evidence_record.v1",
  "FR-0041.evidence_redaction_policy.v1"
] as const;
const XHS_READ_RUNTIME_REQUIREMENTS: XhsProviderRuntimeRequirement[] = [
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
const XHS_CREATOR_PUBLISH_ADMIT_FAIL_CLOSED_REASONS = [
  ...XHS_PROVIDER_REQUIREMENT_FAIL_CLOSED_REASONS,
  "profile_manifest_missing",
  "provider_not_allowed",
  "provider_requirement_ref_missing",
  "secret_ref_missing",
  "secret_redaction_invalid",
  "account_safety_state_missing",
  "account_safety_unknown",
  "account_safety_blocked",
  "account_safety_stale",
  "runtime_target_binding_missing",
  "anti_detection_gate_missing",
  "operator_unlock_missing",
  "default_commit_lock_active",
  "live_evidence_missing",
  "capability_level_escalation_not_allowed",
  "downstream_owner_required"
];
const XHS_PROVIDER_REQUIREMENT_NON_PROOFS = [
  "driver_requirement_declaration_does_not_prove_provider_capability_allowed",
  "driver_requirement_declaration_does_not_prove_runtime_ready",
  "driver_requirement_declaration_does_not_prove_target_tab_ready",
  "driver_requirement_declaration_does_not_prove_live_evidence_accepted",
  "driver_requirement_declaration_does_not_prove_syvert_normalized_result_complete",
  "driver_requirement_declaration_does_not_enable_write"
];
const XHS_CREATOR_PUBLISH_ADMIT_NON_PROOFS = [
  ...XHS_PROVIDER_REQUIREMENT_NON_PROOFS,
  "write_admit_provider_requirement_does_not_enable_live_write_commit",
  "write_admit_provider_requirement_does_not_unlock_default_commit_lock",
  "write_admit_provider_requirement_does_not_prove_operator_unlock",
  "write_admit_provider_requirement_does_not_prove_account_safety_clear",
  "write_admit_provider_requirement_does_not_prove_runtime_target_binding",
  "write_admit_provider_requirement_does_not_prove_anti_detection_gate_pass",
  "write_admit_provider_requirement_does_not_prove_live_evidence_accepted",
  "write_admit_provider_requirement_does_not_publish_or_submit"
];
const XHS_READ_DOWNSTREAM_SLICE_REFS = ["#1166", "#1167", "#1168"];
const XHS_CREATOR_PUBLISH_ADMIT_DOWNSTREAM_SLICE_REFS = [
  "#1174",
  "#1175",
  "#1176",
  "#1178",
  "#1180",
  "#1211"
];
const XHS_CREATOR_PUBLISH_ADMIT_REQUIREMENT_REF =
  "issue-1179.xhs_creator_publish_admit_provider_requirements.v1/write_admit";
const XHS_CREATOR_PUBLISH_ADMIT_REQUIRED_SECRET_KINDS = [
  "profile_storage_secret",
  "provider_auth_secret",
  "proxy_credential",
  "fingerprint_seed",
  "native_messaging_secret",
  "extension_private_payload",
  "account_auth_material"
];

const XHS_READ_COMMAND_REQUIREMENTS: Record<string, { abilityId: string; requirementRef: string }> = {
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
const XHS_CREATOR_PUBLISH_ADMIT_COMMAND = "xhs.creator_publish.admit";
const XHS_CREATOR_PUBLISH_ABILITY_ID = "xhs.creator.publish.v1";

const isRuntimeBoundExecutionMode = (
  requestedExecutionMode: XhsExecutionMode | null | undefined
): boolean =>
  requestedExecutionMode === "recon" ||
  requestedExecutionMode === "live_read_limited" ||
  requestedExecutionMode === "live_read_high_risk" ||
  requestedExecutionMode === "live_write";

const minimumSupportStateForMode = (
  requestedExecutionMode: XhsExecutionMode | null | undefined
): XhsProviderSupportState =>
  isRuntimeBoundExecutionMode(requestedExecutionMode)
    ? "runtime_attested"
    : "statically_verified";

const modeListForRequirement = (
  requestedExecutionMode: XhsExecutionMode | null | undefined
): XhsExecutionMode[] =>
  requestedExecutionMode ? [requestedExecutionMode] : ["dry_run", "recon"];

const buildDeclaration = (input: {
  declarationId: string;
  providerRequirementRef: string;
  command: string;
  ability: AbilityRef;
  requiredRuntimeRequirements: XhsProviderRuntimeRequirement[];
  requiredActions: XhsProviderRequiredAction[];
  requiredExecutionLayers: AbilityLayer[];
  requestedExecutionMode?: XhsExecutionMode | null;
  downstreamSliceRefs: string[];
  failClosedReasons?: string[];
  nonProofs?: string[];
  liveWriteCapabilityGateInput?: XhsLiveWriteCapabilityGateInput;
  profileManifestProviderAllowlistRef?: "FR-0065.profile_manifest_provider_allowlist.v1";
  accountSafetyGateRef?: "FR-0066.account_safety_gate.v1";
  requiredSecretKinds?: string[];
  defaultLiveWriteCommitLock?: "locked";
}): XhsDriverProviderRequirementDeclaration => {
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
    required_runtime_requirements:
      minimumSupportState === "statically_verified" ? [] : [...input.requiredRuntimeRequirements],
    required_actions: [...input.requiredActions],
    required_execution_layers: [...input.requiredExecutionLayers],
    minimum_support_state: minimumSupportState,
    provider_contract_refs: [...XHS_PROVIDER_CONTRACT_REFS],
    capability_verification_ref: "FR-0035.provider_capability_verification_model.v1",
    evidence_policy_refs: [...XHS_EVIDENCE_POLICY_REFS],
    applies_to_execution_modes: modeListForRequirement(input.requestedExecutionMode),
    provider_requirement_refs: [input.providerRequirementRef],
    fail_closed_reasons: [...(input.failClosedReasons ?? XHS_PROVIDER_REQUIREMENT_FAIL_CLOSED_REASONS)],
    non_proofs: [...(input.nonProofs ?? XHS_PROVIDER_REQUIREMENT_NON_PROOFS)],
    downstream_slice_refs: [...input.downstreamSliceRefs],
    ...(input.liveWriteCapabilityGateInput
      ? { live_write_capability_gate_input: input.liveWriteCapabilityGateInput }
      : {}),
    ...(input.profileManifestProviderAllowlistRef
      ? { profile_manifest_provider_allowlist_ref: input.profileManifestProviderAllowlistRef }
      : {}),
    ...(input.accountSafetyGateRef ? { account_safety_gate_ref: input.accountSafetyGateRef } : {}),
    ...(input.requiredSecretKinds ? { required_secret_kinds: [...input.requiredSecretKinds] } : {}),
    ...(input.defaultLiveWriteCommitLock
      ? { default_live_write_commit_lock: input.defaultLiveWriteCommitLock }
      : {})
  };
};

const buildCreatorPublishAdmitCapabilityGateInput = (
  providerRequirementRef: string
): XhsLiveWriteCapabilityGateInput => ({
  taxonomy_version: "v1",
  requested_capability_level: "write_admit",
  maximum_capability_level: "write_admit",
  minimum_required_level: "write_admit",
  capability_owner: "#1179",
  workflow_ref: "xhs.creator_publish.admit",
  target_scope_ref: "xhs.creator_publish.admit:creator.xiaohongshu.com/creator_publish_tab",
  provider_requirement_ref: providerRequirementRef,
  operator_unlock_ref: null,
  default_commit_lock_ref: null,
  account_safety_ref: "FR-0066.account_safety_gate.v1/current-scope-required",
  runtime_target_binding_ref: null,
  anti_detection_gate_ref: null,
  live_evidence_gate_ref: null,
  evidence_refs: [
    "FR-0062.live_write_capability_taxonomy.v1",
    "FR-0065.profile_manifest_provider_allowlist.v1",
    "FR-0066.account_safety_gate.v1",
    providerRequirementRef
  ]
});

export const declareXhsDriverProviderRequirementsForContract = (input: {
  command: string;
  ability: AbilityRef;
  requestedExecutionMode?: XhsExecutionMode | null;
}): XhsDriverProviderRequirementDeclaration | null => {
  const readRequirement = XHS_READ_COMMAND_REQUIREMENTS[input.command];
  if (
    readRequirement &&
    input.ability.action === "read" &&
    input.ability.id === readRequirement.abilityId
  ) {
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

  if (
    input.command === XHS_CREATOR_PUBLISH_ADMIT_COMMAND &&
    input.ability.action === "write" &&
    input.ability.id === XHS_CREATOR_PUBLISH_ABILITY_ID
  ) {
    return buildDeclaration({
      declarationId: "xhs-driver-provider-requirements:xhs.creator_publish.admit:write_admit:v1",
      providerRequirementRef: XHS_CREATOR_PUBLISH_ADMIT_REQUIREMENT_REF,
      command: input.command,
      ability: input.ability,
      requiredRuntimeRequirements: XHS_READ_RUNTIME_REQUIREMENTS,
      requiredActions: ["write_admit", "diagnose"],
      requiredExecutionLayers: ["L3"],
      requestedExecutionMode: input.requestedExecutionMode,
      downstreamSliceRefs: XHS_CREATOR_PUBLISH_ADMIT_DOWNSTREAM_SLICE_REFS,
      failClosedReasons: XHS_CREATOR_PUBLISH_ADMIT_FAIL_CLOSED_REASONS,
      nonProofs: XHS_CREATOR_PUBLISH_ADMIT_NON_PROOFS,
      liveWriteCapabilityGateInput: buildCreatorPublishAdmitCapabilityGateInput(
        XHS_CREATOR_PUBLISH_ADMIT_REQUIREMENT_REF
      ),
      profileManifestProviderAllowlistRef: "FR-0065.profile_manifest_provider_allowlist.v1",
      accountSafetyGateRef: "FR-0066.account_safety_gate.v1",
      requiredSecretKinds: XHS_CREATOR_PUBLISH_ADMIT_REQUIRED_SECRET_KINDS,
      defaultLiveWriteCommitLock: "locked"
    });
  }

  return null;
};

export const requiresXhsProviderRuntimePreparationForContract = (
  declaration: XhsDriverProviderRequirementDeclaration
): boolean =>
  declaration.minimum_support_state === "runtime_attested" ||
  declaration.minimum_support_state === "runtime_observed" ||
  declaration.minimum_support_state === "live_evidence_attested";

export const requiresXhsOfficialChromeRuntimePreparationForContract = (input: {
  providerRequirements?: XhsDriverProviderRequirementDeclaration | null;
  requestedExecutionMode: XhsExecutionMode;
  recoveryProbeRequested?: boolean;
}): boolean =>
  (input.providerRequirements
    ? requiresXhsProviderRuntimePreparationForContract(input.providerRequirements)
    : false) ||
  input.recoveryProbeRequested === true ||
  isRuntimeBoundExecutionMode(input.requestedExecutionMode);
