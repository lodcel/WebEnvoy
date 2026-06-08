import { createHash, randomUUID } from "node:crypto";

import type { JsonObject } from "../core/types.js";
import type { BrowserLaunchResult } from "./browser-launcher.js";
import type { PersistentExtensionBinding } from "./persistent-extension-binding.js";

export type OfficialChromeLaunchEvidenceProviderId =
  | "official-chrome.direct"
  | "official-chrome.persistent";

type ProviderEvidenceScope =
  | "selection"
  | "launch_admission"
  | "runtime_admission"
  | "capability_closeout"
  | "diagnostic";

type ProviderEvidenceRefKind =
  | "provider_contract_ref"
  | "registry_entry_ref"
  | "launch_envelope_ref"
  | "launch_config_snapshot"
  | "profile_binding_ref"
  | "extension_binding_ref"
  | "native_messaging_binding_ref"
  | "runtime_bootstrap_ref"
  | "browser_channel_attestation"
  | "version_attestation"
  | "provider_health_ref"
  | "runtime_observation_ref"
  | "live_evidence_ref"
  | "closeout_artifact_ref";

type ProviderEvidenceRefSource =
  | "provider_contract"
  | "provider_registry"
  | "launch_envelope"
  | "provider_doctor"
  | "runtime_admission"
  | "runtime_observation"
  | "live_evidence_gate"
  | "manual_review";

type EvidenceRefStatus = "available" | "partial" | "unavailable" | "not_applicable";
type EvidenceFreshness =
  | "current_record"
  | "current_launch"
  | "current_pr_head"
  | "historical_background"
  | "not_applicable";
type EvidenceSensitivity = "public" | "internal" | "sensitive" | "secret";
type EvidenceRedactionState =
  | "redacted"
  | "redaction_required"
  | "not_required"
  | "policy_missing"
  | "invalid";
type ProviderEvidenceBlockingReason =
  | "provider_contract_missing"
  | "provider_contract_version_mismatch"
  | "provider_selection_unproven"
  | "provider_limitation_conflict"
  | "launch_envelope_missing"
  | "launch_argument_snapshot_missing"
  | "profile_ref_missing"
  | "profile_lock_unavailable"
  | "profile_login_state_unknown"
  | "extension_binding_missing"
  | "extension_status_unready"
  | "native_messaging_binding_missing"
  | "native_messaging_status_unready"
  | "version_evidence_missing"
  | "evidence_ref_invalid"
  | "evidence_ref_unavailable"
  | "evidence_freshness_stale"
  | "redaction_policy_missing"
  | "redaction_invalid"
  | "secret_leak_detected"
  | "live_evidence_required"
  | "runtime_attestation_required"
  | "manual_review_required"
  | "source_conflict";

interface ProviderEvidenceRef {
  evidence_ref_id: string;
  kind: ProviderEvidenceRefKind;
  ref: string;
  source: ProviderEvidenceRefSource;
  status: EvidenceRefStatus;
  collected_at: string | null;
  freshness: EvidenceFreshness;
  sensitivity: EvidenceSensitivity;
  redaction_state: EvidenceRedactionState;
  artifact_identity: string | null;
}

export interface OfficialChromeLaunchEvidenceRecord {
  identity: {
    provider_evidence_record_id: string;
    provider_evidence_contract_version: "v1";
    run_id: string;
    command_ref: string;
    created_at: string;
    evidence_scope: ProviderEvidenceScope;
    base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"];
  };
  selected_provider: {
    provider_id: OfficialChromeLaunchEvidenceProviderId;
    provider_contract_ref: string;
    provider_contract_version: "v1";
    provider_mode: "core_managed";
    provider_class_ref: string | null;
    selection_reason: "default_eligible" | "explicit_request";
    selection_source: "launch_envelope";
    selection_evidence_refs: string[];
  };
  version_evidence: {
    provider_version: string;
    browser_channel: string;
    browser_version: string;
    extension_version: string;
    native_host_version: string;
    contract_version: "v1";
    version_evidence_refs: string[];
  };
  launch_arguments: {
    launch_envelope_ref: string;
    launch_envelope_version: "v1";
    provider_launch_ref: string;
    browser_mode: {
      headed: boolean;
      headless: boolean;
      real_browser_required: boolean;
      browser_channel: string;
    };
    runtime_bindings: {
      extension_binding_mode:
        | "persistent_profile_extension"
        | "dev_unpacked_extension"
        | "not_required"
        | "unknown";
      native_messaging_mode: "required" | "supported" | "not_required" | "unknown";
      runtime_bootstrap_required: boolean;
    };
    network_regional_ref: string | null;
    fingerprint_policy_ref: string | null;
    launch_argument_evidence_refs: string[];
  };
  profile_reference: {
    profile_ref: string;
    profile_binding_mode: "required_existing" | "allow_create_for_login" | "not_required";
    profile_lock_status:
      | "locked_by_current_run"
      | "shared_read_only"
      | "unlocked"
      | "stale_or_disconnected"
      | "blocked"
      | "unknown";
    login_state_evidence: "ready" | "login_allowed" | "not_required" | "blocked" | "unknown";
    profile_persistence_status: "persistent" | "ephemeral" | "blocked" | "unknown";
    profile_evidence_refs: string[];
  };
  extension_status: {
    extension_required: boolean;
    extension_binding_mode:
      | "persistent_profile_extension"
      | "dev_unpacked_extension"
      | "not_required"
      | "unknown";
    extension_id: string | null;
    extension_version: string;
    extension_installation_status:
      | "installed_in_profile"
      | "dev_unpacked"
      | "missing"
      | "mismatch"
      | "unknown";
    extension_runtime_status: "ready" | "disconnected" | "recoverable" | "blocked" | "unknown";
    extension_evidence_refs: string[];
  };
  native_messaging_status: {
    native_messaging_required: boolean;
    native_host_name: string | null;
    native_host_manifest_ref: string | null;
    allowed_origin_ref: string | null;
    native_host_version: string;
    native_messaging_runtime_status:
      | "ready"
      | "disconnected"
      | "recoverable"
      | "blocked"
      | "unknown";
    native_messaging_evidence_refs: string[];
  };
  evidence_refs: ProviderEvidenceRef[];
  closeout_plan: {
    required_evidence_kinds: ProviderEvidenceRefKind[];
    required_freshness: "current_launch";
    minimum_attestation_level: "runtime_attested";
    coverage_status: "complete" | "partial" | "missing_required" | "blocked" | "unknown";
    blocking_reasons: ProviderEvidenceBlockingReason[];
    missing_evidence: string[];
    redaction_gaps: string[];
    next_required_gates: string[];
    closeout_decision: "allow" | "deny" | "defer";
  };
}

export interface OfficialChromeLaunchEvidenceInput {
  runId: string;
  commandRef: string;
  providerId: OfficialChromeLaunchEvidenceProviderId;
  launchEnvelopeRef: string | null;
  providerContractRef: string | null;
  providerContractVerified?: boolean | null;
  browserChannelVerified?: boolean | null;
  profileRef: string | null;
  browserChannel?: string | null;
  browserVersion?: string | null;
  providerVersion?: string | null;
  createdAt?: string | null;
  collectedAt?: string | null;
  launchResult?: BrowserLaunchResult | null;
  runtimeStatus?: JsonObject | null;
  persistentExtensionBinding?: PersistentExtensionBinding | null;
  networkRegionalRef?: string | null;
  fingerprintPolicyRef?: string | null;
}

const CURRENT_LAUNCH_REQUIRED_REFS: ProviderEvidenceRefKind[] = [
  "provider_contract_ref",
  "launch_envelope_ref",
  "launch_config_snapshot",
  "profile_binding_ref",
  "browser_channel_attestation"
];

const PERSISTENT_REQUIRED_REFS: ProviderEvidenceRefKind[] = [
  ...CURRENT_LAUNCH_REQUIRED_REFS,
  "extension_binding_ref",
  "native_messaging_binding_ref",
  "runtime_bootstrap_ref"
];

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const opaqueRef = (kind: string, value: unknown): string | null => {
  const raw = asNonEmptyString(value);
  if (!raw) {
    return null;
  }
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return `${kind}:redacted:${digest}`;
};

const launchSnapshotRef = (input: {
  providerId: OfficialChromeLaunchEvidenceProviderId;
  launchResult: BrowserLaunchResult | null | undefined;
  runId: string;
}): string => {
  if (!input.launchResult) {
    return `launch-snapshot:unavailable:${input.runId}`;
  }
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        providerId: input.providerId,
        browserPath: input.launchResult.browserPath,
        launchArgs: input.launchResult.launchArgs,
        launchSurface: input.launchResult.launchSurface,
        processOwnership: input.launchResult.processOwnership
      })
    )
    .digest("hex")
    .slice(0, 16);
  return `launch-snapshot:redacted:${digest}`;
};

const statusString = (status: JsonObject | null | undefined, key: string): string | null =>
  asNonEmptyString(status?.[key]);

const mapProfileLockStatus = (
  status: JsonObject | null | undefined
): OfficialChromeLaunchEvidenceRecord["profile_reference"]["profile_lock_status"] => {
  if (!status) {
    return "unknown";
  }
  if (status.lockHeld === true) {
    return "locked_by_current_run";
  }
  const profileState = statusString(status, "profileState");
  if (profileState === "disconnected") {
    return "stale_or_disconnected";
  }
  if (profileState === "blocked") {
    return "blocked";
  }
  if (status.lockHeld === false) {
    return "unlocked";
  }
  return "unknown";
};

const mapLoginState = (
  status: JsonObject | null | undefined
): OfficialChromeLaunchEvidenceRecord["profile_reference"]["login_state_evidence"] => {
  const profileState = statusString(status, "profileState");
  if (profileState === "ready") {
    return "ready";
  }
  if (profileState === "logging_in" || profileState === "blocked") {
    return "blocked";
  }
  return "unknown";
};

const mapExtensionInstallationStatus = (
  status: JsonObject | null | undefined,
  binding: PersistentExtensionBinding | null | undefined
): OfficialChromeLaunchEvidenceRecord["extension_status"]["extension_installation_status"] => {
  if (!binding) {
    return "missing";
  }
  const identityBindingState = statusString(status, "identityBindingState");
  if (identityBindingState === "bound") {
    return "installed_in_profile";
  }
  if (identityBindingState === "mismatch") {
    return "mismatch";
  }
  if (identityBindingState === "missing") {
    return "missing";
  }
  return "unknown";
};

const mapRuntimeStatus = (
  status: JsonObject | null | undefined
): "ready" | "disconnected" | "recoverable" | "blocked" | "unknown" => {
  const identityBindingState = statusString(status, "identityBindingState");
  if (identityBindingState === "missing" || identityBindingState === "mismatch") {
    return "blocked";
  }
  const runtimeReadiness = statusString(status, "runtimeReadiness");
  if (runtimeReadiness === "ready") {
    return "ready";
  }
  if (runtimeReadiness === "recoverable") {
    return "recoverable";
  }
  if (runtimeReadiness === "blocked") {
    return "blocked";
  }
  const transportState = statusString(status, "transportState");
  if (transportState === "disconnected") {
    return "disconnected";
  }
  return "unknown";
};

const buildEvidenceRef = (input: Omit<ProviderEvidenceRef, "evidence_ref_id"> & {
  evidence_ref_id: string;
}): ProviderEvidenceRef => input;

const findRef = (
  refs: ProviderEvidenceRef[],
  kind: ProviderEvidenceRefKind
): ProviderEvidenceRef | null => refs.find((ref) => ref.kind === kind) ?? null;

const hasInvalidRedaction = (ref: ProviderEvidenceRef): boolean =>
  ref.redaction_state === "redaction_required" ||
  ref.redaction_state === "policy_missing" ||
  ref.redaction_state === "invalid";

const isProviderContractRefMatch = (input: {
  providerId: OfficialChromeLaunchEvidenceProviderId;
  providerContractRef: string | null;
  providerContractVerified: boolean | null | undefined;
}): boolean => {
  if (input.providerContractVerified !== true || !input.providerContractRef) {
    return false;
  }
  return (
    input.providerContractRef.includes(input.providerId) &&
    input.providerContractRef.includes("v1")
  );
};

const isGoogleChromeStableAttested = (input: {
  browserChannel: string;
  browserVersion: string;
  browserChannelVerified: boolean | null | undefined;
}): boolean => {
  if (input.browserChannelVerified !== true) {
    return false;
  }
  const channel = input.browserChannel.trim().toLowerCase();
  const version = input.browserVersion.trim().toLowerCase();
  if (channel !== "google chrome stable") {
    return false;
  }
  return version.startsWith("google chrome ") && !version.includes("beta");
};

const buildCloseoutPlan = (input: {
  providerId: OfficialChromeLaunchEvidenceProviderId;
  evidenceRefs: ProviderEvidenceRef[];
  browserChannel: string;
  browserVersion: string;
  browserChannelVerified: boolean | null | undefined;
  profileRef: string | null;
  profileLockStatus: OfficialChromeLaunchEvidenceRecord["profile_reference"]["profile_lock_status"];
  launchEnvelopeRef: string | null;
  providerContractRef: string | null;
  providerContractVerified: boolean | null | undefined;
  launchResult: BrowserLaunchResult | null | undefined;
  extensionRuntimeStatus: string;
  nativeMessagingRuntimeStatus: string;
}): OfficialChromeLaunchEvidenceRecord["closeout_plan"] => {
  const requiredEvidenceKinds =
    input.providerId === "official-chrome.persistent"
      ? PERSISTENT_REQUIRED_REFS
      : CURRENT_LAUNCH_REQUIRED_REFS;
  const blockingReasons = new Set<ProviderEvidenceBlockingReason>();
  const missingEvidence = new Set<string>();
  const redactionGaps = new Set<string>();
  const nextRequiredGates = new Set<string>();

  if (!input.providerContractRef) {
    blockingReasons.add("provider_contract_missing");
    missingEvidence.add("provider_contract_ref");
  } else if (
    !isProviderContractRefMatch({
      providerId: input.providerId,
      providerContractRef: input.providerContractRef,
      providerContractVerified: input.providerContractVerified
    })
  ) {
    blockingReasons.add("provider_contract_version_mismatch");
    blockingReasons.add("source_conflict");
    nextRequiredGates.add("provider_contract_match_verification");
  }
  if (!input.launchEnvelopeRef) {
    blockingReasons.add("launch_envelope_missing");
    missingEvidence.add("launch_envelope_ref");
  }
  if (!input.profileRef) {
    blockingReasons.add("profile_ref_missing");
    missingEvidence.add("profile_ref");
  }
  if (input.browserVersion === "unknown") {
    blockingReasons.add("version_evidence_missing");
    missingEvidence.add("browser_version");
    nextRequiredGates.add("browser_version_attestation");
  }
  if (
    !isGoogleChromeStableAttested({
      browserChannel: input.browserChannel,
      browserVersion: input.browserVersion,
      browserChannelVerified: input.browserChannelVerified
    })
  ) {
    blockingReasons.add("provider_limitation_conflict");
    blockingReasons.add("runtime_attestation_required");
    missingEvidence.add("google_chrome_stable_attestation");
    nextRequiredGates.add("browser_channel_attestation");
  }
  if (input.launchResult?.headless === true) {
    blockingReasons.add("provider_limitation_conflict");
    blockingReasons.add("runtime_attestation_required");
    missingEvidence.add("real_browser_launch_evidence");
    nextRequiredGates.add("real_browser_launch_attestation");
  }
  if (input.launchResult && input.launchResult.executionSurface !== "real_browser") {
    blockingReasons.add("provider_limitation_conflict");
    blockingReasons.add("runtime_attestation_required");
    missingEvidence.add("real_browser_launch_evidence");
    nextRequiredGates.add("real_browser_launch_attestation");
  }
  if (
    input.providerId === "official-chrome.persistent" &&
    input.profileLockStatus !== "locked_by_current_run"
  ) {
    blockingReasons.add("profile_lock_unavailable");
    missingEvidence.add("profile_lock_status");
    nextRequiredGates.add("profile_lock_attestation");
  }
  if (
    input.providerId === "official-chrome.persistent" &&
    input.extensionRuntimeStatus !== "ready"
  ) {
    blockingReasons.add("extension_status_unready");
    nextRequiredGates.add("persistent_extension_identity_health");
  }
  if (
    input.providerId === "official-chrome.persistent" &&
    input.nativeMessagingRuntimeStatus !== "ready"
  ) {
    blockingReasons.add("native_messaging_status_unready");
    nextRequiredGates.add("native_messaging_health");
  }

  for (const kind of requiredEvidenceKinds) {
    const ref = findRef(input.evidenceRefs, kind);
    if (!ref) {
      blockingReasons.add("evidence_ref_unavailable");
      missingEvidence.add(kind);
      continue;
    }
    if (ref.status === "unavailable" || ref.status === "partial") {
      blockingReasons.add(
        kind === "launch_config_snapshot"
          ? "launch_argument_snapshot_missing"
          : "evidence_ref_unavailable"
      );
      missingEvidence.add(kind);
    }
    if (ref.freshness !== "current_launch" && ref.freshness !== "current_record") {
      blockingReasons.add("evidence_freshness_stale");
      missingEvidence.add(kind);
    }
    if (hasInvalidRedaction(ref)) {
      blockingReasons.add(
        ref.redaction_state === "policy_missing" ? "redaction_policy_missing" : "redaction_invalid"
      );
      redactionGaps.add(kind);
    }
  }

  const coverageStatus = blockingReasons.size === 0 ? "complete" : "partial";

  return {
    required_evidence_kinds: requiredEvidenceKinds,
    required_freshness: "current_launch",
    minimum_attestation_level: "runtime_attested",
    coverage_status: coverageStatus,
    blocking_reasons: [...blockingReasons],
    missing_evidence: [...missingEvidence],
    redaction_gaps: [...redactionGaps],
    next_required_gates: [...nextRequiredGates],
    closeout_decision: blockingReasons.size === 0 ? "allow" : "deny"
  };
};

export const buildOfficialChromeLaunchEvidenceRecord = (
  input: OfficialChromeLaunchEvidenceInput
): OfficialChromeLaunchEvidenceRecord => {
  const now = input.createdAt ?? new Date().toISOString();
  const collectedAt = input.collectedAt ?? now;
  const persistent = input.providerId === "official-chrome.persistent";
  const browserChannel = input.browserChannel ?? "Google Chrome stable";
  const browserVersion = input.browserVersion ?? "unknown";
  const browserChannelAttested = isGoogleChromeStableAttested({
    browserChannel,
    browserVersion,
    browserChannelVerified: input.browserChannelVerified
  });
  const providerVersion = input.providerVersion ?? "0.1.0";
  const profileRef = opaqueRef("profile-ref", input.profileRef);
  const launchConfigStatus: EvidenceRefStatus = input.launchResult ? "available" : "unavailable";
  const manifestRef = opaqueRef("native-manifest-ref", input.persistentExtensionBinding?.manifestPath);
  const allowedOriginRef = opaqueRef(
    "allowed-origin-ref",
    input.persistentExtensionBinding?.extensionId
  );
  const extensionRuntimeStatus = persistent
    ? mapRuntimeStatus(input.runtimeStatus)
    : "unknown";
  const nativeMessagingRuntimeStatus = persistent
    ? mapRuntimeStatus(input.runtimeStatus)
    : "unknown";
  const providerContractRef = input.providerContractRef ?? "provider-contract:missing";
  const providerContractRefVerified = isProviderContractRefMatch({
    providerId: input.providerId,
    providerContractRef: input.providerContractRef,
    providerContractVerified: input.providerContractVerified
  });
  const launchEnvelopeRef = input.launchEnvelopeRef ?? "launch-envelope:missing";
  const launchRef = launchSnapshotRef({
    providerId: input.providerId,
    launchResult: input.launchResult,
    runId: input.runId
  });
  const headless = input.launchResult?.headless === true;

  const evidenceRefs: ProviderEvidenceRef[] = [
    buildEvidenceRef({
      evidence_ref_id: "ev-provider-contract",
      kind: "provider_contract_ref",
      ref: providerContractRef,
      source: "provider_contract",
      status: providerContractRefVerified
        ? "available"
        : input.providerContractRef
          ? "partial"
          : "unavailable",
      collected_at: null,
      freshness: "current_record",
      sensitivity: "public",
      redaction_state: "not_required",
      artifact_identity: null
    }),
    buildEvidenceRef({
      evidence_ref_id: "ev-launch-envelope",
      kind: "launch_envelope_ref",
      ref: launchEnvelopeRef,
      source: "launch_envelope",
      status: input.launchEnvelopeRef ? "available" : "unavailable",
      collected_at: null,
      freshness: "current_record",
      sensitivity: "public",
      redaction_state: "not_required",
      artifact_identity: null
    }),
    buildEvidenceRef({
      evidence_ref_id: "ev-browser-channel",
      kind: "browser_channel_attestation",
      ref: `browser-channel:${browserChannel}`,
      source: "manual_review",
      status: browserChannelAttested ? "available" : "partial",
      collected_at: null,
      freshness: "current_record",
      sensitivity: "public",
      redaction_state: "not_required",
      artifact_identity: null
    }),
    buildEvidenceRef({
      evidence_ref_id: "ev-version-attestation",
      kind: "version_attestation",
      ref:
        browserVersion === "unknown"
          ? "version-attestation:browser-version:unknown"
          : `version-attestation:redacted:${createHash("sha256").update(browserVersion).digest("hex").slice(0, 16)}`,
      source: "runtime_admission",
      status: browserVersion === "unknown" ? "partial" : "available",
      collected_at: input.launchResult ? collectedAt : null,
      freshness: input.launchResult ? "current_launch" : "current_record",
      sensitivity: "internal",
      redaction_state: "redacted",
      artifact_identity: null
    }),
    buildEvidenceRef({
      evidence_ref_id: "ev-launch-snapshot",
      kind: "launch_config_snapshot",
      ref: launchRef,
      source: "runtime_admission",
      status: launchConfigStatus,
      collected_at: input.launchResult ? collectedAt : null,
      freshness: "current_launch",
      sensitivity: "sensitive",
      redaction_state: "redacted",
      artifact_identity: input.launchResult ? `artifact:${launchRef}` : null
    }),
    buildEvidenceRef({
      evidence_ref_id: "ev-profile-binding",
      kind: "profile_binding_ref",
      ref: profileRef ?? "profile-ref:missing",
      source: "runtime_admission",
      status: profileRef ? "available" : "unavailable",
      collected_at: input.runtimeStatus ? collectedAt : null,
      freshness: "current_launch",
      sensitivity: "sensitive",
      redaction_state: profileRef ? "redacted" : "redaction_required",
      artifact_identity: null
    })
  ];

  if (persistent) {
    const nativeManifestAvailable = manifestRef !== null;
    evidenceRefs.push(
      buildEvidenceRef({
        evidence_ref_id: "ev-extension-binding",
        kind: "extension_binding_ref",
        ref:
          opaqueRef("extension-binding", input.persistentExtensionBinding?.extensionId) ??
          "extension-binding:missing",
        source: "runtime_admission",
        status: input.persistentExtensionBinding ? "available" : "unavailable",
        collected_at: input.runtimeStatus ? collectedAt : null,
        freshness: "current_launch",
        sensitivity: "internal",
        redaction_state: input.persistentExtensionBinding ? "redacted" : "redaction_required",
        artifact_identity: null
      }),
      buildEvidenceRef({
        evidence_ref_id: "ev-native-binding",
        kind: "native_messaging_binding_ref",
        ref: manifestRef ?? "native-binding:missing",
        source: "runtime_admission",
        status:
          input.persistentExtensionBinding && nativeManifestAvailable
            ? "available"
            : "unavailable",
        collected_at: input.runtimeStatus ? collectedAt : null,
        freshness: "current_launch",
        sensitivity: "internal",
        redaction_state:
          input.persistentExtensionBinding && nativeManifestAvailable
            ? "redacted"
            : "redaction_required",
        artifact_identity: null
      }),
      buildEvidenceRef({
        evidence_ref_id: "ev-runtime-bootstrap",
        kind: "runtime_bootstrap_ref",
        ref:
          mapRuntimeStatus(input.runtimeStatus) === "ready"
            ? `runtime-bootstrap:${input.runId}:ready`
            : `runtime-bootstrap:${input.runId}:not-ready`,
        source: "runtime_admission",
        status: mapRuntimeStatus(input.runtimeStatus) === "ready" ? "available" : "partial",
        collected_at: input.runtimeStatus ? collectedAt : null,
        freshness: "current_launch",
        sensitivity: "internal",
        redaction_state: "redacted",
        artifact_identity: null
      })
    );
  }

  const closeoutPlan = buildCloseoutPlan({
    providerId: input.providerId,
    evidenceRefs,
    browserChannel,
    browserVersion,
    browserChannelVerified: input.browserChannelVerified,
    profileRef,
    profileLockStatus: mapProfileLockStatus(input.runtimeStatus),
    launchEnvelopeRef: input.launchEnvelopeRef,
    providerContractRef: input.providerContractRef,
    providerContractVerified: input.providerContractVerified,
    launchResult: input.launchResult,
    extensionRuntimeStatus,
    nativeMessagingRuntimeStatus
  });

  return {
    identity: {
      provider_evidence_record_id: `provider-evidence:${input.runId}:${randomUUID()}`,
      provider_evidence_contract_version: "v1",
      run_id: input.runId,
      command_ref: input.commandRef,
      created_at: now,
      evidence_scope: "launch_admission",
      base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"]
    },
    selected_provider: {
      provider_id: input.providerId,
      provider_contract_ref: providerContractRef,
      provider_contract_version: "v1",
      provider_mode: "core_managed",
      provider_class_ref: "registry-entry:official-chrome",
      selection_reason: "explicit_request",
      selection_source: "launch_envelope",
      selection_evidence_refs: ["ev-provider-contract"]
    },
    version_evidence: {
      provider_version: providerVersion,
      browser_channel: browserChannel,
      browser_version: browserVersion,
      extension_version: persistent ? "unknown" : "not_applicable",
      native_host_version: persistent ? "unknown" : "not_applicable",
      contract_version: "v1",
      version_evidence_refs: ["ev-version-attestation", "ev-browser-channel"]
    },
    launch_arguments: {
      launch_envelope_ref: launchEnvelopeRef,
      launch_envelope_version: "v1",
      provider_launch_ref: launchRef,
      browser_mode: {
        headed: !headless,
        headless,
        real_browser_required: true,
        browser_channel: browserChannel
      },
      runtime_bindings: {
        extension_binding_mode: persistent ? "persistent_profile_extension" : "not_required",
        native_messaging_mode: persistent ? "required" : "not_required",
        runtime_bootstrap_required: persistent
      },
      network_regional_ref: opaqueRef("network-regional-ref", input.networkRegionalRef),
      fingerprint_policy_ref: opaqueRef("fingerprint-policy-ref", input.fingerprintPolicyRef),
      launch_argument_evidence_refs: ["ev-launch-envelope", "ev-launch-snapshot"]
    },
    profile_reference: {
      profile_ref: profileRef ?? "profile-ref:missing",
      profile_binding_mode: persistent ? "required_existing" : "not_required",
      profile_lock_status: mapProfileLockStatus(input.runtimeStatus),
      login_state_evidence: mapLoginState(input.runtimeStatus),
      profile_persistence_status: persistent ? "persistent" : "ephemeral",
      profile_evidence_refs: ["ev-profile-binding"]
    },
    extension_status: {
      extension_required: persistent,
      extension_binding_mode: persistent ? "persistent_profile_extension" : "not_required",
      extension_id: persistent ? input.persistentExtensionBinding?.extensionId ?? null : null,
      extension_version: persistent ? "unknown" : "not_applicable",
      extension_installation_status: persistent
        ? mapExtensionInstallationStatus(input.runtimeStatus, input.persistentExtensionBinding)
        : "unknown",
      extension_runtime_status: persistent ? extensionRuntimeStatus : "unknown",
      extension_evidence_refs: persistent ? ["ev-extension-binding"] : []
    },
    native_messaging_status: {
      native_messaging_required: persistent,
      native_host_name: persistent ? input.persistentExtensionBinding?.nativeHostName ?? null : null,
      native_host_manifest_ref: persistent ? manifestRef : null,
      allowed_origin_ref: persistent ? allowedOriginRef : null,
      native_host_version: persistent ? "unknown" : "not_applicable",
      native_messaging_runtime_status: persistent ? nativeMessagingRuntimeStatus : "unknown",
      native_messaging_evidence_refs: persistent ? ["ev-native-binding"] : []
    },
    evidence_refs: evidenceRefs,
    closeout_plan: closeoutPlan
  };
};
