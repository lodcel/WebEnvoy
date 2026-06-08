const fixtureTimestamp = "2026-06-07T00:00:00Z";
const providerId = "generic-local-contract-provider";
const capabilityId = "generic-l2-page-read";
const contractRef = `provider-contract:${providerId}:v1`;
const launchEnvelopeRef = `launch-envelope:${providerId}:read:v1`;
const officialChromeProviderId = "official-chrome.persistent";
const officialChromeCapabilityId = "browser-runtime.launch";
const officialChromeContractRef = `provider-contract:${officialChromeProviderId}:v1`;
const officialChromeLaunchEnvelopeRef = "launch-envelope:official-chrome.persistent:runtime:v1";
const officialChromeDescriptorRef =
  "docs/dev/specs/FR-0043-official-chrome-persistent-descriptor/spec.md";
const officialChromeCapabilityMatrixRef =
  "docs/dev/specs/FR-0044-official-chrome-capability-matrix/spec.md";

export const providerContractFixtures = {
  validGenericProviderContract: {
    provider_identity: {
      provider_id: providerId,
      provider_family: "custom_provider",
      provider_version: "fixture-v1",
      contract_version: "v1",
      distribution_channel: "local_adapter",
      implementation_owner: "webenvoy_core"
    },
    provider_mode: "core_managed",
    browser_engine: {
      engine_family: "chromium",
      browser_channel: "Generic Chromium compatible",
      browser_version_range: ">=120",
      headless_policy: "allowed_for_dev_only",
      extension_binding_support: "supported",
      profile_binding_support: "supported"
    },
    automation_transport: {
      transport_kind: "extension_bridge",
      transport_owner: "webenvoy_core",
      command_surface: ["runtime_control", "page_automation", "diagnostics", "artifact_passthrough"],
      attach_model: "launch",
      native_messaging_support: "none",
      cdp_support: "none",
      playwright_support: "none"
    },
    capabilities: [
      {
        capability_id: capabilityId,
        capability_kind: "page_automation",
        supported_execution_layers: ["L2"],
        supported_actions: ["read", "diagnose"],
        runtime_requirements: ["profile_binding", "target_tab", "runtime_bootstrap_ready"],
        evidence_outputs: ["runtime_health", "doctor_report", "artifact_ref_passthrough", "runtime_attestation"],
        risk_constraints: ["read_only"],
        verification_level: "static_checked",
        limitations: []
      }
    ],
    verification: {
      provider_level: "static_checked",
      capability_levels: {
        [capabilityId]: "static_checked"
      },
      verified_at: fixtureTimestamp,
      evidence_refs: [`contract-fixture:${providerId}:static-check`]
    },
    limitations: []
  },
  unknownLimitationProviderContract: {
    provider_identity: {
      provider_id: "generic-local-provider-with-unknown-limitation",
      provider_family: "custom_provider",
      provider_version: "fixture-v1",
      contract_version: "v1",
      distribution_channel: "local_adapter",
      implementation_owner: "webenvoy_core"
    },
    provider_mode: "core_managed",
    browser_engine: {
      engine_family: "chromium",
      browser_channel: "Generic Chromium compatible",
      browser_version_range: ">=120",
      headless_policy: "unknown",
      extension_binding_support: "unknown",
      profile_binding_support: "unknown"
    },
    automation_transport: {
      transport_kind: "extension_bridge",
      transport_owner: "webenvoy_core",
      command_surface: ["page_automation"],
      attach_model: "launch",
      native_messaging_support: "unknown",
      cdp_support: "unknown",
      playwright_support: "unknown"
    },
    capabilities: [
      {
        capability_id: capabilityId,
        capability_kind: "page_automation",
        supported_execution_layers: ["L2"],
        supported_actions: ["read"],
        runtime_requirements: ["profile_binding"],
        evidence_outputs: ["runtime_health"],
        risk_constraints: ["read_only"],
        verification_level: "declared_only",
        limitations: ["unknown"]
      }
    ],
    verification: {
      provider_level: "declared_only",
      capability_levels: {
        [capabilityId]: "declared_only"
      }
    },
    limitations: ["unknown"]
  }
} as const;

export const providerRegistryFixtures = {
  validGenericRegistry: {
    registry_id: "webenvoy-generic-provider-fixture-registry",
    registry_version: "v1",
    contract_ref: "FR-0033.browser_provider_contract.v1",
    owner: "webenvoy_core_provider_runtime",
    entries: [
      {
        entry_id: "local-generic-contract-provider",
        provider_id: providerId,
        provider_class: "custom_local",
        contract_ref: contractRef,
        contract_snapshot: providerContractFixtures.validGenericProviderContract,
        registry_status: "static_checked",
        default_eligibility: "eligible",
        priority: 100,
        locator: {
          locator_kind: "local_adapter",
          locator_ref: "webenvoy.providers.generic_local_contract_provider"
        },
        selection_tags: ["local_adapter", "generic_contract_fixture", "l2_read"],
        constraints: {
          requires_contract_version: "FR-0033.browser_provider_contract.v1",
          requires_registry_status: ["static_checked"],
          minimum_verification_level: "static_checked",
          disallowed_limitations: ["unknown", "diagnostic_only"],
          requires_opt_in: false,
          out_of_scope_actions: [
            "provider_doctor",
            "runtime_launch",
            "live_runtime_behavior",
            "cloakbrowser_as_core",
            "syvert_normalized_result"
          ]
        }
      }
    ]
  },
  declaredOnlyRegistryEntry: {
    entry_id: "local-generic-declared-only-provider",
    provider_id: providerContractFixtures.unknownLimitationProviderContract.provider_identity.provider_id,
    provider_class: "custom_local",
    contract_ref: "provider-contract:generic-local-provider-with-unknown-limitation:v1",
    contract_snapshot: providerContractFixtures.unknownLimitationProviderContract,
    registry_status: "declared",
    default_eligibility: "not_eligible",
    priority: 200,
    locator: {
      locator_kind: "local_adapter",
      locator_ref: "webenvoy.providers.generic_declared_only"
    },
    selection_tags: ["generic_contract_fixture", "blocked"],
    constraints: {
      requires_contract_version: "FR-0033.browser_provider_contract.v1",
      requires_registry_status: ["static_checked"],
      minimum_verification_level: "static_checked",
      disallowed_limitations: ["unknown", "diagnostic_only"],
      requires_opt_in: true,
      out_of_scope_actions: ["provider_selection", "runtime_launch", "live_runtime_behavior"]
    }
  }
} as const;

export const providerCapabilityVerificationFixtures = {
  defaultDecisionPolicy: {
    default_business_minimum_support_state: "statically_verified",
    diagnostic_minimum_support_state: "health_checked",
    runtime_requirement_minimum_support_state: "runtime_attested",
    runtime_observation_minimum_support_state: "runtime_observed",
    live_evidence_minimum_support_state: "live_evidence_attested",
    allow_declared_only_for_business: false,
    allow_defer_for_business: false,
    fail_closed_on_blocking_reasons: true,
    fail_closed_on_unknown_limitation: true,
    fail_closed_on_invalid_or_stale_evidence_ref: true,
    degraded_state_policy: "explicit_only",
    manual_review_policy: "confirm_existing_evidence_only"
  },
  staticReadAllowedRecord: {
    provider_id: providerId,
    contract_version: "v1",
    capability_id: capabilityId,
    requested_capability_ref: `consumer:generic-read:${capabilityId}`,
    required_actions: ["read"],
    required_execution_layers: ["L2"],
    required_runtime_requirements: [],
    declared_capability_ref: `browser_provider_contract.capabilities[${capabilityId}]`,
    verification_sources: [
      {
        kind: "provider_declaration",
        status: "passed",
        scope: "capability",
        evidence_ref: contractRef
      },
      {
        kind: "static_contract_check",
        status: "passed",
        scope: "capability",
        evidence_ref: "schema-fixture:provider-contract-v1"
      }
    ],
    support_state: "statically_verified",
    decision: "allow",
    blocking_reasons: [],
    evidence_refs: [
      {
        kind: "contract_ref",
        ref: contractRef,
        source: "provider_declaration",
        scope: "capability"
      }
    ]
  },
  runtimeRequirementMissingRecord: {
    provider_id: providerId,
    contract_version: "v1",
    capability_id: capabilityId,
    requested_capability_ref: `consumer:generic-runtime-read:${capabilityId}`,
    required_actions: ["read"],
    required_execution_layers: ["L2"],
    required_runtime_requirements: ["profile_binding", "target_tab", "runtime_bootstrap_ready"],
    declared_capability_ref: `browser_provider_contract.capabilities[${capabilityId}]`,
    verification_sources: [
      {
        kind: "provider_declaration",
        status: "passed",
        scope: "capability",
        evidence_ref: contractRef
      },
      {
        kind: "static_contract_check",
        status: "passed",
        scope: "capability",
        evidence_ref: "schema-fixture:provider-contract-v1"
      },
      {
        kind: "runtime_attestation",
        status: "missing",
        scope: "runtime"
      }
    ],
    support_state: "blocked",
    decision: "deny",
    blocking_reasons: ["runtime_requirement_missing", "verification_source_missing"],
    evidence_refs: [
      {
        kind: "contract_ref",
        ref: contractRef,
        source: "provider_declaration",
        scope: "capability"
      }
    ]
  },
  unknownLimitationBlockedRecord: {
    provider_id: providerContractFixtures.unknownLimitationProviderContract.provider_identity.provider_id,
    contract_version: "v1",
    capability_id: capabilityId,
    requested_capability_ref: `consumer:generic-read:${capabilityId}`,
    required_actions: ["read"],
    required_execution_layers: ["L2"],
    required_runtime_requirements: ["profile_binding"],
    declared_capability_ref: `browser_provider_contract.capabilities[${capabilityId}]`,
    verification_sources: [
      {
        kind: "provider_declaration",
        status: "passed",
        scope: "capability",
        evidence_ref: "provider-contract:generic-local-provider-with-unknown-limitation:v1"
      }
    ],
    support_state: "blocked",
    decision: "deny",
    blocking_reasons: ["unknown_limitation"],
    evidence_refs: [
      {
        kind: "contract_ref",
        ref: "provider-contract:generic-local-provider-with-unknown-limitation:v1",
        source: "provider_declaration",
        scope: "capability"
      }
    ]
  }
} as const;

export const launchEnvelopeFixtures = {
  validGenericLaunchEnvelope: {
    identity: {
      launch_envelope_id: "launch-env-generic-read-001",
      launch_envelope_version: "v1",
      command_ref: "runtime.read",
      run_id: "run-generic-provider-fixture-001",
      created_at: fixtureTimestamp,
      requested_by: "webenvoy_cli"
    },
    provider: {
      provider_contract_ref: contractRef,
      provider_id: providerId,
      provider_contract_version: "v1",
      provider_mode: "core_managed",
      capability_refs: [capabilityId],
      minimum_verification_level: "static_checked"
    },
    profile: {
      profile_ref: "profile-ref:generic-local:redacted",
      profile_binding_mode: "required_existing",
      profile_lock_policy: "shared_read_only",
      extension_identity_required: false,
      native_host_binding_required: false,
      login_state_requirement: "not_required"
    },
    browser_mode: {
      headed: true,
      headless: false,
      execution_safety_mode: "default",
      browser_channel: "Generic Chromium compatible",
      browser_version_requirement: ">=120",
      real_browser_required: false
    },
    network: {
      proxy_policy: "direct",
      locale: "en-US",
      timezone: "UTC",
      accept_language: "en-US,en;q=0.9"
    },
    runtime_bindings: {
      extension_binding_mode: "dev_unpacked_extension",
      extension_paths: ["extension-ref:generic-local-adapter"],
      native_messaging_mode: "not_required",
      runtime_bootstrap_required: true
    },
    fingerprint: {
      seed_policy: "not_required",
      rotation_policy: "not_applicable"
    },
    evidence_requirements: {
      required_evidence_kinds: ["launch_config_snapshot", "provider_contract_ref", "profile_binding_ref"],
      minimum_attestation_level: "static_checked",
      artifact_policy: "best_effort",
      freshness_policy: "current_launch",
      failure_disclosure_required: true
    },
    admission_health_requirements: [
      {
        target: "profile_lock",
        required_state: "healthy",
        recovery_allowed: false,
        recovery_outcomes: ["new_envelope_required"]
      },
      {
        target: "runtime_bootstrap",
        required_state: "healthy",
        recovery_allowed: true,
        recovery_outcomes: ["healthy_after_recovery", "still_disconnected", "new_envelope_required"]
      }
    ],
    limitations: []
  },
  proxyUnknownBlockedEnvelope: {
    identity: {
      launch_envelope_id: "launch-env-generic-proxy-unknown-001",
      launch_envelope_version: "v1",
      command_ref: "runtime.read",
      run_id: "run-generic-provider-fixture-unknown-proxy",
      created_at: fixtureTimestamp,
      requested_by: "webenvoy_cli"
    },
    provider: {
      provider_contract_ref: contractRef,
      provider_id: providerId,
      provider_contract_version: "v1",
      provider_mode: "core_managed",
      capability_refs: [capabilityId],
      minimum_verification_level: "static_checked"
    },
    profile: {
      profile_ref: "profile-ref:generic-local:redacted",
      profile_binding_mode: "required_existing",
      profile_lock_policy: "shared_read_only",
      extension_identity_required: false,
      native_host_binding_required: false,
      login_state_requirement: "not_required"
    },
    browser_mode: {
      headed: true,
      headless: false,
      execution_safety_mode: "default",
      browser_channel: "Generic Chromium compatible",
      browser_version_requirement: ">=120",
      real_browser_required: false
    },
    network: {
      proxy_policy: "unknown"
    },
    runtime_bindings: {
      extension_binding_mode: "dev_unpacked_extension",
      extension_paths: ["extension-ref:generic-local-adapter"],
      native_messaging_mode: "not_required",
      runtime_bootstrap_required: true
    },
    fingerprint: {
      seed_policy: "not_required",
      rotation_policy: "not_applicable"
    },
    evidence_requirements: {
      required_evidence_kinds: ["launch_config_snapshot", "provider_contract_ref"],
      minimum_attestation_level: "static_checked",
      artifact_policy: "best_effort",
      freshness_policy: "current_launch",
      failure_disclosure_required: true
    },
    admission_health_requirements: [
      {
        target: "evidence_requirements",
        required_state: "healthy",
        recovery_allowed: false,
        recovery_outcomes: ["new_envelope_required"]
      }
    ],
    limitations: ["proxy_policy_unknown"]
  }
} as const;

export const providerDoctorFixtures = {
  genericDoctorReportPendingRuntimeAttestation: {
    identity: {
      doctor_report_id: "doctor-generic-provider-fixture-001",
      doctor_contract_version: "v1",
      provider_id: providerId,
      provider_contract_version: "v1",
      provider_version: "fixture-v1",
      generated_at: fixtureTimestamp,
      scope: "capability"
    },
    input_contract_ref: {
      provider_contract_spec: "FR-0033-browser-provider-contract",
      expected_binary_source: {
        source_id: "generic-local-adapter-binary",
        source_kind: "adapter_binary",
        locator_ref: "doctor-input://generic-local-provider/redacted-adapter",
        locator_sensitivity: "sensitive",
        expected_access: "exists"
      },
      capability_ids_requested: [capabilityId]
    },
    checks: [
      {
        check_id: "provider-binary",
        category: "binary",
        status: "pass",
        severity: "info",
        blocking: "none",
        capability_id: "N/A",
        summary: "Generic provider adapter locator is resolvable.",
        diagnostics: {
          code: "provider_binary_ok",
          observed: "source_id=generic-local-adapter-binary; access=exists",
          expected: "source_id=generic-local-adapter-binary; expected_access=exists"
        },
        evidence_refs: [
          {
            kind: "local_file_ref",
            ref: "doctor://doctor-generic-provider-fixture-001/provider-binary",
            status: "available",
            collected_at: fixtureTimestamp,
            sensitivity: "sensitive"
          }
        ]
      },
      {
        check_id: "browser-version",
        category: "version",
        status: "pass",
        severity: "info",
        blocking: "none",
        capability_id: "N/A",
        summary: "Generic browser version satisfies declared range.",
        diagnostics: {
          code: "browser_version_ok",
          observed: "Generic Chromium compatible >=120",
          expected: ">=120"
        },
        evidence_refs: [
          {
            kind: "command_output_ref",
            ref: "doctor://doctor-generic-provider-fixture-001/browser-version",
            status: "available",
            collected_at: fixtureTimestamp,
            sensitivity: "internal"
          }
        ]
      },
      {
        check_id: "profile-persistence",
        category: "profile_persistence",
        status: "pass",
        severity: "info",
        blocking: "none",
        capability_id: "N/A",
        summary: "Generic profile locator is persistent and redacted.",
        diagnostics: {
          code: "profile_persistence_ok",
          observed: "profile-ref:generic-local:redacted",
          expected: "profile_binding"
        },
        evidence_refs: [
          {
            kind: "profile_state_ref",
            ref: "doctor://doctor-generic-provider-fixture-001/profile-persistence",
            status: "available",
            collected_at: fixtureTimestamp,
            sensitivity: "sensitive"
          }
        ]
      },
      {
        check_id: "generic-l2-page-read-readiness",
        category: "capability_readiness",
        status: "warn",
        severity: "warning",
        blocking: "capability_blocking",
        capability_id: capabilityId,
        summary: "Static provider checks passed; runtime target tab and bootstrap evidence are still required.",
        diagnostics: {
          code: "runtime_attestation_required",
          required_runtime_requirements: ["profile_binding", "target_tab", "runtime_bootstrap_ready"],
          satisfied_runtime_requirements: ["profile_binding", "provider_doctor_passed"],
          unsatisfied_runtime_requirements: ["target_tab", "runtime_bootstrap_ready"],
          minimum_next_verification_level: "runtime_attested"
        },
        evidence_refs: [
          {
            kind: "doctor_artifact_ref",
            ref: "doctor://doctor-generic-provider-fixture-001/capability-readiness",
            status: "available",
            collected_at: fixtureTimestamp,
            sensitivity: "internal"
          }
        ]
      }
    ],
    outcome: {
      overall_status: "warn",
      provider_blocked: false,
      blocked_capabilities: [capabilityId],
      doctor_verification_level: "doctor_checked",
      next_required_gates: ["runtime_attestation"]
    }
  }
} as const;

export const providerEvidenceFixtures = {
  genericLaunchAdmissionEvidenceRecord: {
    provider_evidence_record: {
      identity: {
        provider_evidence_record_id: "per-generic-launch-001",
        provider_evidence_contract_version: "v1",
        run_id: "run-generic-provider-fixture-001",
        command_ref: "runtime.read",
        created_at: fixtureTimestamp,
        evidence_scope: "launch_admission",
        base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"]
      },
      selected_provider: {
        provider_id: providerId,
        provider_contract_ref: contractRef,
        provider_contract_version: "v1",
        provider_mode: "core_managed",
        provider_class_ref: "registry-entry:local-generic-contract-provider",
        selection_reason: "default_eligible",
        selection_source: "provider_registry",
        selection_evidence_refs: ["ev-provider-contract", "ev-registry-entry"]
      },
      version_evidence: {
        provider_version: "fixture-v1",
        browser_channel: "Generic Chromium compatible",
        browser_version: "unknown",
        extension_version: "not_applicable",
        native_host_version: "not_applicable",
        contract_version: "v1",
        version_evidence_refs: ["ev-version"]
      },
      launch_arguments: {
        launch_envelope_ref: launchEnvelopeRef,
        launch_envelope_version: "v1",
        provider_launch_ref: "launch-snapshot:generic-local:redacted",
        browser_mode: {
          headed: true,
          headless: false,
          real_browser_required: false,
          browser_channel: "Generic Chromium compatible"
        },
        runtime_bindings: {
          extension_binding_mode: "dev_unpacked_extension",
          native_messaging_mode: "not_required",
          runtime_bootstrap_required: true
        },
        network_regional_ref: null,
        fingerprint_policy_ref: null,
        launch_argument_evidence_refs: ["ev-launch-snapshot"]
      },
      profile_reference: {
        profile_ref: "profile-ref:generic-local:redacted",
        profile_binding_mode: "required_existing",
        profile_lock_status: "shared_read_only",
        login_state_evidence: "not_required",
        profile_persistence_status: "persistent",
        profile_evidence_refs: ["ev-profile-binding"]
      },
      extension_status: {
        extension_required: false,
        extension_binding_mode: "dev_unpacked_extension",
        extension_id: null,
        extension_version: "not_applicable",
        extension_installation_status: "dev_unpacked",
        extension_runtime_status: "unknown",
        extension_evidence_refs: []
      },
      native_messaging_status: {
        native_messaging_required: false,
        native_host_name: null,
        native_host_manifest_ref: null,
        allowed_origin_ref: null,
        native_host_version: "not_applicable",
        native_messaging_runtime_status: "unknown",
        native_messaging_evidence_refs: []
      },
      evidence_refs: [
        {
          evidence_ref_id: "ev-provider-contract",
          kind: "provider_contract_ref",
          ref: contractRef,
          source: "provider_contract",
          status: "available",
          collected_at: null,
          freshness: "current_record",
          sensitivity: "public",
          redaction_state: "not_required",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-registry-entry",
          kind: "registry_entry_ref",
          ref: "registry-entry:local-generic-contract-provider",
          source: "provider_registry",
          status: "available",
          collected_at: null,
          freshness: "current_record",
          sensitivity: "public",
          redaction_state: "not_required",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-version",
          kind: "version_attestation",
          ref: "version-attestation:generic-local:redacted",
          source: "provider_doctor",
          status: "partial",
          collected_at: fixtureTimestamp,
          freshness: "current_record",
          sensitivity: "internal",
          redaction_state: "redacted",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-launch-snapshot",
          kind: "launch_config_snapshot",
          ref: "launch-snapshot:generic-local:redacted",
          source: "launch_envelope",
          status: "available",
          collected_at: fixtureTimestamp,
          freshness: "current_launch",
          sensitivity: "sensitive",
          redaction_state: "redacted",
          artifact_identity: "artifact:generic-local-launch-snapshot"
        },
        {
          evidence_ref_id: "ev-profile-binding",
          kind: "profile_binding_ref",
          ref: "profile-ref:generic-local:redacted",
          source: "runtime_admission",
          status: "available",
          collected_at: fixtureTimestamp,
          freshness: "current_launch",
          sensitivity: "sensitive",
          redaction_state: "redacted",
          artifact_identity: null
        }
      ],
      closeout_plan: {
        required_evidence_kinds: ["provider_contract_ref", "registry_entry_ref", "launch_config_snapshot", "profile_binding_ref"],
        required_freshness: "current_launch",
        minimum_attestation_level: "static_checked",
        coverage_status: "complete",
        blocking_reasons: [],
        missing_evidence: [],
        redaction_gaps: [],
        next_required_gates: ["runtime_attestation"],
        closeout_decision: "allow"
      }
    }
  },
  redactionGapEvidenceRecord: {
    provider_evidence_record: {
      identity: {
        provider_evidence_record_id: "per-generic-redaction-gap-001",
        provider_evidence_contract_version: "v1",
        run_id: "run-generic-redaction-gap-001",
        command_ref: "runtime.read",
        created_at: fixtureTimestamp,
        evidence_scope: "launch_admission",
        base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"]
      },
      selected_provider: {
        provider_id: providerId,
        provider_contract_ref: contractRef,
        provider_contract_version: "v1",
        provider_mode: "core_managed",
        provider_class_ref: "registry-entry:local-generic-contract-provider",
        selection_reason: "default_eligible",
        selection_source: "provider_registry",
        selection_evidence_refs: ["ev-provider-contract"]
      },
      version_evidence: {
        provider_version: "fixture-v1",
        browser_channel: "Generic Chromium compatible",
        browser_version: "unknown",
        extension_version: "not_applicable",
        native_host_version: "not_applicable",
        contract_version: "v1",
        version_evidence_refs: ["ev-version"]
      },
      launch_arguments: {
        launch_envelope_ref: launchEnvelopeRef,
        launch_envelope_version: "v1",
        provider_launch_ref: "launch-snapshot:generic-local:redacted",
        browser_mode: {
          headed: true,
          headless: false,
          real_browser_required: false,
          browser_channel: "Generic Chromium compatible"
        },
        runtime_bindings: {
          extension_binding_mode: "dev_unpacked_extension",
          native_messaging_mode: "not_required",
          runtime_bootstrap_required: true
        },
        network_regional_ref: null,
        fingerprint_policy_ref: null,
        launch_argument_evidence_refs: ["ev-launch-snapshot"]
      },
      profile_reference: {
        profile_ref: "profile-ref:generic-local:redacted",
        profile_binding_mode: "required_existing",
        profile_lock_status: "shared_read_only",
        login_state_evidence: "not_required",
        profile_persistence_status: "persistent",
        profile_evidence_refs: ["ev-profile-binding"]
      },
      extension_status: {
        extension_required: false,
        extension_binding_mode: "dev_unpacked_extension",
        extension_id: null,
        extension_version: "not_applicable",
        extension_installation_status: "dev_unpacked",
        extension_runtime_status: "unknown",
        extension_evidence_refs: []
      },
      native_messaging_status: {
        native_messaging_required: false,
        native_host_name: null,
        native_host_manifest_ref: null,
        allowed_origin_ref: null,
        native_host_version: "not_applicable",
        native_messaging_runtime_status: "unknown",
        native_messaging_evidence_refs: []
      },
      evidence_refs: [
        {
          evidence_ref_id: "ev-provider-contract",
          kind: "provider_contract_ref",
          ref: contractRef,
          source: "provider_contract",
          status: "available",
          collected_at: null,
          freshness: "current_record",
          sensitivity: "public",
          redaction_state: "not_required",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-version",
          kind: "version_attestation",
          ref: "version-attestation:generic-local:redacted",
          source: "provider_doctor",
          status: "partial",
          collected_at: fixtureTimestamp,
          freshness: "current_record",
          sensitivity: "internal",
          redaction_state: "redacted",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-launch-snapshot",
          kind: "launch_config_snapshot",
          ref: "launch-snapshot:generic-local:redacted",
          source: "launch_envelope",
          status: "available",
          collected_at: fixtureTimestamp,
          freshness: "current_launch",
          sensitivity: "sensitive",
          redaction_state: "policy_missing",
          artifact_identity: "artifact:generic-local-launch-snapshot"
        },
        {
          evidence_ref_id: "ev-profile-binding",
          kind: "profile_binding_ref",
          ref: "profile-ref:generic-local:redacted",
          source: "runtime_admission",
          status: "available",
          collected_at: fixtureTimestamp,
          freshness: "current_launch",
          sensitivity: "sensitive",
          redaction_state: "redacted",
          artifact_identity: null
        }
      ],
      closeout_plan: {
        required_evidence_kinds: ["provider_contract_ref", "launch_config_snapshot", "profile_binding_ref"],
        required_freshness: "current_launch",
        minimum_attestation_level: "static_checked",
        coverage_status: "blocked",
        blocking_reasons: ["redaction_policy_missing"],
        missing_evidence: [],
        redaction_gaps: ["ev-launch-snapshot"],
        next_required_gates: ["redaction_policy"],
        closeout_decision: "deny"
      }
    }
  }
} as const;

export const officialChromeProviderFixtures = {
  contractSnapshot: {
    provider_identity: {
      provider_id: officialChromeProviderId,
      provider_family: "official_chrome",
      provider_version: "fixture-v1",
      contract_version: "v1",
      distribution_channel: "builtin",
      implementation_owner: "webenvoy_core"
    },
    provider_mode: "core_managed",
    browser_engine: {
      engine_family: "chrome",
      browser_channel: "Google Chrome stable",
      browser_version_range: "system_installed",
      headless_policy: "forbidden",
      extension_binding_support: "required",
      profile_binding_support: "required"
    },
    automation_transport: {
      transport_kind: "hybrid",
      transport_owner: "webenvoy_core",
      command_surface: ["runtime_control", "page_automation", "diagnostics", "artifact_passthrough"],
      attach_model: "launch",
      native_messaging_support: "required",
      cdp_support: "supported",
      playwright_support: "supported"
    },
    capabilities: [
      {
        capability_id: officialChromeCapabilityId,
        capability_kind: "browser_runtime",
        supported_execution_layers: ["L3"],
        supported_actions: ["read", "diagnose"],
        runtime_requirements: [
          "profile_binding",
          "extension_binding",
          "native_messaging",
          "runtime_bootstrap_ready",
          "real_browser"
        ],
        evidence_outputs: [
          "doctor_report",
          "provider_health_ref",
          "launch_admission_evidence"
        ],
        risk_constraints: ["requires_latest_head_evidence", "requires_manual_confirmation"],
        verification_level: "static_checked",
        limitations: ["diagnostic_only"]
      }
    ],
    verification: {
      provider_level: "static_checked",
      capability_levels: {
        [officialChromeCapabilityId]: "static_checked"
      },
      verified_at: fixtureTimestamp,
      evidence_refs: [
        officialChromeContractRef,
        officialChromeDescriptorRef,
        officialChromeCapabilityMatrixRef
      ]
    },
    limitations: ["diagnostic_only"]
  },
  launchEnvelope: {
    identity: {
      launch_envelope_id: "launch-env-official-chrome-runtime-001",
      launch_envelope_version: "v1",
      command_ref: "runtime.start",
      run_id: "run-official-chrome-fixture-complete-001",
      created_at: fixtureTimestamp,
      requested_by: "webenvoy_cli"
    },
    provider: {
      provider_contract_ref: officialChromeContractRef,
      provider_id: officialChromeProviderId,
      provider_contract_version: "v1",
      provider_mode: "core_managed",
      capability_refs: [officialChromeCapabilityId],
      minimum_verification_level: "doctor_checked"
    },
    profile: {
      profile_ref: "profile-ref:official-chrome:redacted",
      profile_binding_mode: "required_existing",
      profile_lock_policy: "exclusive_required",
      extension_identity_required: true,
      native_host_binding_required: true,
      login_state_requirement: "not_required"
    },
    browser_mode: {
      headed: true,
      headless: false,
      execution_safety_mode: "default",
      browser_channel: "Google Chrome stable",
      browser_version_requirement: "Google Chrome stable >=137",
      real_browser_required: true
    },
    network: {
      proxy_policy: "direct",
      locale: "en-US",
      timezone: "UTC",
      accept_language: "en-US,en;q=0.9"
    },
    runtime_bindings: {
      extension_binding_mode: "persistent_profile_extension",
      extension_paths: [],
      native_messaging_mode: "required",
      runtime_bootstrap_required: true
    },
    fingerprint: {
      seed_policy: "not_required",
      rotation_policy: "not_applicable"
    },
    evidence_requirements: {
      required_evidence_kinds: [
        "provider_contract_ref",
        "launch_config_snapshot",
        "profile_binding_ref",
        "extension_binding_ref",
        "native_messaging_binding_ref",
        "runtime_bootstrap_ref",
        "browser_channel_attestation"
      ],
      minimum_attestation_level: "doctor_checked",
      artifact_policy: "best_effort",
      freshness_policy: "current_launch",
      failure_disclosure_required: true
    },
    admission_health_requirements: [
      {
        target: "extension_identity",
        required_state: "healthy",
        recovery_allowed: false,
        recovery_outcomes: ["new_envelope_required"]
      },
      {
        target: "native_messaging",
        required_state: "healthy",
        recovery_allowed: true,
        recovery_outcomes: ["healthy_after_recovery", "still_disconnected", "new_envelope_required"]
      },
      {
        target: "runtime_bootstrap",
        required_state: "healthy",
        recovery_allowed: true,
        recovery_outcomes: ["healthy_after_recovery", "new_envelope_required"]
      }
    ],
    limitations: ["diagnostic_only"]
  },
  capabilityMatrix: {
    supported: {
      provider_id: officialChromeProviderId,
      contract_version: "v1",
      capability_id: officialChromeCapabilityId,
      requested_capability_ref: `consumer:official-chrome:${officialChromeCapabilityId}`,
      capability_kind: "runtime",
      supported_actions: ["launch"],
      supported_execution_layers: ["chrome_process", "persistent_profile", "playwright_cdp"],
      required_runtime_requirements: [
        "profile_binding",
        "extension_binding",
        "native_messaging",
        "runtime_bootstrap_ready",
        "real_browser"
      ],
      support_level: "statically_verified",
      limitations: ["diagnostic_only"],
      verification_sources: [
        {
          kind: "provider_declaration",
          status: "passed",
          scope: "capability",
          evidence_ref: officialChromeContractRef
        },
        {
          kind: "static_contract_check",
          status: "passed",
          scope: "capability",
          evidence_ref: officialChromeCapabilityMatrixRef
        },
        {
          kind: "manual_review_attestation",
          status: "passed",
          scope: "capability",
          evidence_ref: "manual-review:official-chrome-capability-matrix:supported"
        }
      ],
      evidence_ref_strategy: {
        static_descriptor_ref: officialChromeDescriptorRef,
        capability_matrix_ref: officialChromeCapabilityMatrixRef,
        health_result_ref: "doctor://official-chrome/health-complete",
        launch_evidence_ref: "launch-evidence://official-chrome/run-complete",
        fixture_ref: "tests/official-chrome-provider.fixture.test.ts"
      },
      fail_closed_policy: "deny_or_defer_on_missing_runtime_or_live_evidence",
      downstream_owner: "#1144",
      decision: "defer",
      blocking_reasons: [],
      evidence_refs: [
        {
          kind: "contract_ref",
          ref: officialChromeContractRef,
          source: "provider_declaration",
          scope: "capability"
        }
      ]
    },
    partial: {
      provider_id: officialChromeProviderId,
      contract_version: "v1",
      capability_id: officialChromeCapabilityId,
      requested_capability_ref: `consumer:official-chrome-partial:${officialChromeCapabilityId}`,
      capability_kind: "runtime",
      supported_actions: ["launch"],
      supported_execution_layers: ["chrome_process", "persistent_profile", "playwright_cdp"],
      required_runtime_requirements: [
        "profile_binding",
        "extension_binding",
        "native_messaging",
        "runtime_bootstrap_ready",
        "real_browser"
      ],
      support_level: "declared",
      limitations: ["diagnostic_only"],
      verification_sources: [
        {
          kind: "provider_declaration",
          status: "passed",
          scope: "capability",
          evidence_ref: officialChromeContractRef
        },
        {
          kind: "static_contract_check",
          status: "passed",
          scope: "capability",
          evidence_ref: officialChromeCapabilityMatrixRef
        },
        {
          kind: "manual_review_attestation",
          status: "partial",
          scope: "capability",
          evidence_ref: "manual-review:official-chrome-capability-matrix:partial"
        }
      ],
      evidence_ref_strategy: {
        static_descriptor_ref: officialChromeDescriptorRef,
        capability_matrix_ref: officialChromeCapabilityMatrixRef,
        health_result_ref: "doctor://official-chrome/health-partial",
        launch_evidence_ref: "launch-evidence://official-chrome/run-partial",
        fixture_ref: "tests/official-chrome-provider.fixture.test.ts"
      },
      fail_closed_policy: "deny_or_defer_on_missing_runtime_or_live_evidence",
      support_state: "blocked",
      decision: "deny",
      blocking_reasons: ["verification_source_missing"],
      evidence_refs: [
        {
          kind: "contract_ref",
          ref: officialChromeContractRef,
          source: "provider_declaration",
          scope: "capability"
        }
      ]
    },
    failClosed: {
      provider_id: officialChromeProviderId,
      contract_version: "v1",
      capability_id: officialChromeCapabilityId,
      requested_capability_ref: `consumer:official-chrome-blocked:${officialChromeCapabilityId}`,
      capability_kind: "runtime",
      supported_actions: ["launch"],
      supported_execution_layers: ["chrome_process", "persistent_profile", "playwright_cdp"],
      required_runtime_requirements: [
        "profile_binding",
        "extension_binding",
        "native_messaging",
        "runtime_bootstrap_ready",
        "real_browser"
      ],
      support_level: "statically_verified",
      limitations: ["diagnostic_only"],
      verification_sources: [
        {
          kind: "provider_declaration",
          status: "passed",
          scope: "capability",
          evidence_ref: officialChromeContractRef
        },
        {
          kind: "static_contract_check",
          status: "passed",
          scope: "capability",
          evidence_ref: officialChromeCapabilityMatrixRef
        },
        {
          kind: "manual_review_attestation",
          status: "failed",
          scope: "capability",
          evidence_ref: "manual-review:official-chrome-capability-matrix:blocked"
        }
      ],
      evidence_ref_strategy: {
        static_descriptor_ref: officialChromeDescriptorRef,
        capability_matrix_ref: officialChromeCapabilityMatrixRef,
        health_result_ref: "doctor://official-chrome/health-blocked",
        launch_evidence_ref: "launch-evidence://official-chrome/run-blocked",
        fixture_ref: "tests/official-chrome-provider.fixture.test.ts"
      },
      fail_closed_policy: "deny_or_defer_on_missing_runtime_or_live_evidence",
      downstream_owner: "#1144",
      decision: "deny",
      blocking_reasons: ["runtime_requirement_missing", "verification_source_missing"],
      evidence_refs: [
        {
          kind: "contract_ref",
          ref: officialChromeContractRef,
          source: "provider_declaration",
          scope: "capability"
        }
      ]
    }
  },
  providerHealth: {
    supported: {
      identity: {
        doctor_report_id: "doctor-official-chrome-complete-001",
        doctor_contract_version: "v1",
        provider_id: officialChromeProviderId,
        provider_contract_version: "v1",
        provider_version: "fixture-v1",
        generated_at: fixtureTimestamp,
        scope: "capability"
      },
      input_contract_ref: {
        provider_contract_spec: "FR-0033-browser-provider-contract",
        expected_binary_source: {
          source_id: "official-chrome-stable",
          source_kind: "browser_executable",
          locator_ref: "browser-bundle:Google Chrome stable",
          locator_sensitivity: "internal",
          expected_access: "launchable"
        },
        capability_ids_requested: [officialChromeCapabilityId]
      },
      checks: [
        {
          check_id: "official-chrome-binary-source",
          category: "binary",
          status: "pass",
          severity: "info",
          blocking: "none",
          capability_id: "N/A",
          summary: "Official Chrome stable executable is resolvable and launchable.",
          diagnostics: {
            code: "provider_binary_ok",
            observed: "source_id=official-chrome-stable; access=launchable",
            expected: "source_id=official-chrome-stable; expected_access=launchable",
            remediation_hint: "N/A"
          },
          evidence_refs: [
            {
              kind: "local_file_ref",
              ref: "doctor://official-chrome/health-complete/binary",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "internal"
            }
          ]
        },
        {
          check_id: "official-chrome-browser-version",
          category: "version",
          status: "pass",
          severity: "info",
          blocking: "none",
          capability_id: "N/A",
          summary: "Official Chrome stable version satisfies the declared system-installed requirement.",
          diagnostics: {
            code: "browser_version_ok",
            observed: "Google Chrome stable 137.0.0.0",
            expected: "system_installed",
            remediation_hint: "N/A"
          },
          evidence_refs: [
            {
              kind: "command_output_ref",
              ref: "doctor://official-chrome/health-complete/version",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "internal"
            }
          ]
        },
        {
          check_id: "official-chrome-display-mode",
          category: "display_mode",
          status: "pass",
          severity: "info",
          blocking: "none",
          capability_id: "N/A",
          summary: "Display mode is headful and satisfies the forbidden-headless policy.",
          diagnostics: {
            code: "display_mode_ok",
            observed: "headful real browser display available",
            expected: "headless forbidden; real browser required",
            remediation_hint: "N/A"
          },
          evidence_refs: [
            {
              kind: "command_output_ref",
              ref: "doctor://official-chrome/health-complete/display-mode",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "internal"
            }
          ]
        },
        {
          check_id: "official-chrome-profile-persistence",
          category: "profile_persistence",
          status: "pass",
          severity: "info",
          blocking: "none",
          capability_id: "N/A",
          summary: "Persistent profile binding is present and satisfies the required profile semantics.",
          diagnostics: {
            code: "profile_persistence_ok",
            observed: "persistent profile binding available for selected official Chrome provider",
            expected: "required persistent profile binding",
            remediation_hint: "N/A"
          },
          evidence_refs: [
            {
              kind: "profile_state_ref",
              ref: "doctor://official-chrome/health-complete/profile-persistence",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "sensitive"
            }
          ]
        },
        {
          check_id: "official_chrome_persistent_extension_identity",
          category: "extension_load",
          status: "pass",
          severity: "info",
          blocking: "none",
          capability_id: "N/A",
          summary: "Persistent extension identity matches the official Chrome binding.",
          diagnostics: {
            code: "persistent_extension_identity.healthy",
            observed: "profile-scoped stable extension identity matched",
            expected: "stable extension identity ref bound to selected profile",
            remediation_hint: "N/A"
          },
          evidence_refs: [
            {
              kind: "extension_state_ref",
              ref: "extension-binding:redacted:official-chrome",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "sensitive"
            }
          ]
        },
        {
          check_id: "native_host_identity",
          category: "native_messaging",
          status: "pass",
          severity: "info",
          blocking: "none",
          capability_id: "N/A",
          summary: "Native messaging bridge is ready.",
          diagnostics: {
            code: "native_messaging.bridge_handshake_missing".replace("_missing", "_ready"),
            observed: "bridge handshake succeeded for selected provider",
            expected: "current-run bridge handshake for official Chrome persistent provider",
            remediation_hint: "N/A"
          },
          evidence_refs: [
            {
              kind: "native_manifest_ref",
              ref: "native-manifest-ref:redacted:official-chrome",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "sensitive"
            }
          ]
        },
        {
          check_id: "official_chrome_persistent_service_worker_freshness",
          category: "extension_load",
          status: "pass",
          severity: "info",
          blocking: "none",
          capability_id: "N/A",
          summary: "Service worker freshness is within the required window.",
          diagnostics: {
            code: "service_worker_fresh",
            observed: "current service worker digest matches expected bundle identity",
            expected: "fresh service worker for selected persistent extension",
            remediation_hint: "N/A"
          },
          evidence_refs: [
            {
              kind: "extension_state_ref",
              ref: "service-worker:redacted:official-chrome",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "sensitive"
            }
          ]
        },
        {
          check_id: "official-chrome-launch-readiness",
          category: "capability_readiness",
          status: "pass",
          severity: "info",
          blocking: "none",
          capability_id: officialChromeCapabilityId,
          summary: "Static official Chrome launch prerequisites are aligned for runtime admission.",
          diagnostics: {
            code: "capability_readiness.ready_for_runtime_attestation",
            required_runtime_requirements: [
              "profile_binding",
              "extension_binding",
              "native_messaging",
              "runtime_bootstrap_ready",
              "real_browser"
            ],
            satisfied_runtime_requirements: ["profile_binding", "provider_doctor_passed"],
            unsatisfied_runtime_requirements: [
              "extension_binding",
              "native_messaging",
              "runtime_bootstrap_ready",
              "real_browser"
            ],
            minimum_next_verification_level: "runtime_attested",
            remediation_hint: "Collect runtime attestation from #1143 launch evidence before admission."
          },
          evidence_refs: [
            {
              kind: "doctor_artifact_ref",
              ref: "doctor://official-chrome/health-complete",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "internal"
            }
          ]
        }
      ],
      outcome: {
        overall_status: "pass",
        provider_blocked: false,
        blocked_capabilities: [],
        doctor_verification_level: "doctor_checked",
        next_required_gates: ["runtime_attestation"]
      }
    },
    partial: {
      identity: {
        doctor_report_id: "doctor-official-chrome-partial-001",
        doctor_contract_version: "v1",
        provider_id: officialChromeProviderId,
        provider_contract_version: "v1",
        provider_version: "fixture-v1",
        generated_at: fixtureTimestamp,
        scope: "capability"
      },
      input_contract_ref: {
        provider_contract_spec: "FR-0033-browser-provider-contract",
        expected_binary_source: {
          source_id: "official-chrome-stable",
          source_kind: "browser_executable",
          locator_ref: "browser-bundle:Google Chrome stable",
          locator_sensitivity: "internal",
          expected_access: "launchable"
        },
        capability_ids_requested: [officialChromeCapabilityId]
      },
      checks: [
        {
          check_id: "official_chrome_persistent_extension_identity",
          category: "extension_load",
          status: "pass",
          severity: "info",
          blocking: "none",
          capability_id: "N/A",
          summary: "Persistent extension identity matches the official Chrome binding.",
          diagnostics: {
            code: "persistent_extension_identity.healthy",
            observed: "profile-scoped stable extension identity matched",
            expected: "stable extension identity ref bound to selected profile",
            remediation_hint: "N/A"
          },
          evidence_refs: [
            {
              kind: "extension_state_ref",
              ref: "extension-binding:redacted:official-chrome",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "sensitive"
            }
          ]
        },
        {
          check_id: "bridge_handshake",
          category: "native_messaging",
          status: "warn",
          severity: "warning",
          blocking: "capability_blocking",
          capability_id: "N/A",
          summary: "Native messaging is recoverable but not fully ready.",
          diagnostics: {
            code: "native_messaging.socket_stale_or_disconnected",
            observed: "bridge became recoverable after stale socket detection",
            expected: "ready current-run native bridge",
            remediation_hint: "refresh native messaging bridge and recollect current-run doctor evidence"
          },
          evidence_refs: [
            {
              kind: "doctor_artifact_ref",
              ref: "doctor://official-chrome/health-partial",
              status: "partial",
              collected_at: fixtureTimestamp,
              sensitivity: "internal"
            }
          ]
        },
        {
          check_id: "official-chrome-launch-readiness",
          category: "capability_readiness",
          status: "warn",
          severity: "warning",
          blocking: "capability_blocking",
          capability_id: officialChromeCapabilityId,
          summary: "Doctor evidence exists, but runtime attestation is still missing for launch admission.",
          diagnostics: {
            code: "capability_readiness.runtime_attestation_pending",
            required_runtime_requirements: [
              "profile_binding",
              "extension_binding",
              "native_messaging",
              "runtime_bootstrap_ready",
              "real_browser"
            ],
            satisfied_runtime_requirements: ["profile_binding", "provider_doctor_passed"],
            unsatisfied_runtime_requirements: [
              "extension_binding",
              "native_messaging",
              "runtime_bootstrap_ready",
              "real_browser"
            ],
            minimum_next_verification_level: "runtime_attested",
            remediation_hint: "collect current launch evidence from #1143 before allowing runtime admission"
          },
          evidence_refs: [
            {
              kind: "doctor_artifact_ref",
              ref: "doctor://official-chrome/health-partial",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "internal"
            }
          ]
        }
      ],
      outcome: {
        overall_status: "warn",
        provider_blocked: false,
        blocked_capabilities: [officialChromeCapabilityId],
        doctor_verification_level: "doctor_checked",
        next_required_gates: ["runtime_attestation"]
      }
    },
    failClosed: {
      identity: {
        doctor_report_id: "doctor-official-chrome-blocked-001",
        doctor_contract_version: "v1",
        provider_id: officialChromeProviderId,
        provider_contract_version: "v1",
        provider_version: "fixture-v1",
        generated_at: fixtureTimestamp,
        scope: "capability"
      },
      input_contract_ref: {
        provider_contract_spec: "FR-0033-browser-provider-contract",
        expected_binary_source: {
          source_id: "official-chrome-stable",
          source_kind: "browser_executable",
          locator_ref: "browser-bundle:Google Chrome stable",
          locator_sensitivity: "internal",
          expected_access: "launchable"
        },
        capability_ids_requested: [officialChromeCapabilityId]
      },
      checks: [
        {
          check_id: "official_chrome_persistent_extension_identity",
          category: "extension_load",
          status: "fail",
          severity: "error",
          blocking: "provider_blocking",
          capability_id: "N/A",
          summary: "Persistent extension identity is missing or mismatched.",
          diagnostics: {
            code: "persistent_extension_identity.mismatch",
            observed: "no stable extension identity bound to selected profile",
            expected: "profile-scoped stable extension identity ref",
            remediation_hint: "reinstall or rebind the persistent extension before retrying"
          },
          evidence_refs: [
            {
              kind: "extension_state_ref",
              ref: "extension-binding:redacted:official-chrome",
              status: "unavailable",
              collected_at: fixtureTimestamp,
              sensitivity: "sensitive"
            }
          ]
        },
        {
          check_id: "host_registration",
          category: "native_messaging",
          status: "fail",
          severity: "error",
          blocking: "provider_blocking",
          capability_id: "N/A",
          summary: "Native messaging bridge is unavailable.",
          diagnostics: {
            code: "native_messaging.registration_missing",
            observed: "current profile has no usable host registration",
            expected: "official Chrome persistent provider host registration",
            remediation_hint: "restore native host registration and allowed origins before admission"
          },
          evidence_refs: [
            {
              kind: "native_manifest_ref",
              ref: "native-manifest-ref:redacted:official-chrome",
              status: "unavailable",
              collected_at: fixtureTimestamp,
              sensitivity: "sensitive"
            }
          ]
        },
        {
          check_id: "official_chrome_persistent_service_worker_freshness",
          category: "extension_load",
          status: "fail",
          severity: "error",
          blocking: "provider_blocking",
          capability_id: "N/A",
          summary: "Service worker freshness is stale for the selected extension identity.",
          diagnostics: {
            code: "service_worker_stale",
            observed: "stale or mismatched worker digest",
            expected: "fresh service worker for selected persistent extension",
            remediation_hint: "refresh the extension worker and recollect doctor evidence"
          },
          evidence_refs: [
            {
              kind: "extension_state_ref",
              ref: "service-worker:redacted:official-chrome",
              status: "partial",
              collected_at: fixtureTimestamp,
              sensitivity: "sensitive"
            }
          ]
        },
        {
          check_id: "official-chrome-launch-readiness",
          category: "capability_readiness",
          status: "fail",
          severity: "error",
          blocking: "capability_blocking",
          capability_id: officialChromeCapabilityId,
          summary: "Provider doctor cannot satisfy launch readiness for official Chrome persistent runtime.",
          diagnostics: {
            code: "capability_readiness.required_checks_failed",
            required_runtime_requirements: [
              "profile_binding",
              "extension_binding",
              "native_messaging",
              "runtime_bootstrap_ready",
              "real_browser"
            ],
            satisfied_runtime_requirements: [],
            unsatisfied_runtime_requirements: [
              "profile_binding",
              "extension_binding",
              "native_messaging",
              "runtime_bootstrap_ready",
              "real_browser"
            ],
            minimum_next_verification_level: "runtime_attested",
            remediation_hint: "fix provider-blocking health failures before attempting runtime admission"
          },
          evidence_refs: [
            {
              kind: "doctor_artifact_ref",
              ref: "doctor://official-chrome/health-blocked",
              status: "available",
              collected_at: fixtureTimestamp,
              sensitivity: "internal"
            }
          ]
        }
      ],
      outcome: {
        overall_status: "fail",
        provider_blocked: true,
        blocked_capabilities: [officialChromeCapabilityId],
        doctor_verification_level: "doctor_checked",
        next_required_gates: ["persistent_extension_identity", "native_messaging_health"]
      }
    }
  },
  evidence: {
    supported: {
      provider_evidence_record: {
        identity: {
          provider_evidence_record_id: "per-official-chrome-complete-001",
          provider_evidence_contract_version: "v1",
          run_id: "run-official-chrome-fixture-complete-001",
          command_ref: "runtime.start",
          created_at: fixtureTimestamp,
          evidence_scope: "launch_admission",
          base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"]
        },
        selected_provider: {
          provider_id: officialChromeProviderId,
          provider_contract_ref: officialChromeContractRef,
          provider_contract_version: "v1",
          provider_mode: "core_managed",
          provider_class_ref: "registry-entry:official-chrome.persistent",
          selection_reason: "default_eligible",
          selection_source: "launch_envelope",
          selection_evidence_refs: ["ev-provider-contract", "ev-provider-health"]
        },
        version_evidence: {
          provider_version: "fixture-v1",
          browser_channel: "Google Chrome stable",
          browser_version: "Google Chrome 137.0.0.0",
          extension_version: "1.0.0",
          native_host_version: "1.0.0",
          contract_version: "v1",
          version_evidence_refs: ["ev-channel", "ev-version"]
        },
        launch_arguments: {
          launch_envelope_ref: officialChromeLaunchEnvelopeRef,
          launch_envelope_version: "v1",
          provider_launch_ref: "launch-snapshot:official-chrome:redacted",
          browser_mode: {
            headed: true,
            headless: false,
            real_browser_required: true,
            browser_channel: "Google Chrome stable"
          },
          runtime_bindings: {
            extension_binding_mode: "persistent_profile_extension",
            native_messaging_mode: "required",
            runtime_bootstrap_required: true
          },
          network_regional_ref: null,
          fingerprint_policy_ref: null,
          launch_argument_evidence_refs: ["ev-launch-snapshot", "ev-runtime-bootstrap"]
        },
        profile_reference: {
          profile_ref: "profile-ref:official-chrome:redacted",
          profile_binding_mode: "required_existing",
          profile_lock_status: "locked_by_current_run",
          login_state_evidence: "not_required",
          profile_persistence_status: "persistent",
          profile_evidence_refs: ["ev-profile-binding"]
        },
        extension_status: {
          extension_required: true,
          extension_binding_mode: "persistent_profile_extension",
          extension_id: "abcdefghijklmnopabcdefghijklmnop",
          extension_version: "1.0.0",
          extension_installation_status: "installed_in_profile",
          extension_runtime_status: "ready",
          extension_evidence_refs: ["ev-extension-binding"]
        },
        native_messaging_status: {
          native_messaging_required: true,
          native_host_name: "com.webenvoy.host",
          native_host_manifest_ref: "native-manifest-ref:redacted:official-chrome",
          allowed_origin_ref: "allowed-origin-ref:redacted:official-chrome",
          native_host_version: "1.0.0",
          native_messaging_runtime_status: "ready",
          native_messaging_evidence_refs: ["ev-native-binding"]
        },
        evidence_refs: [
          {
            evidence_ref_id: "ev-provider-contract",
            kind: "provider_contract_ref",
            ref: officialChromeContractRef,
            source: "provider_contract",
            status: "available",
            collected_at: null,
            freshness: "current_record",
            sensitivity: "public",
            redaction_state: "not_required",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-provider-health",
            kind: "provider_health_ref",
            ref: "doctor://official-chrome/health-complete",
            source: "provider_doctor",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_record",
            sensitivity: "internal",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-channel",
            kind: "browser_channel_attestation",
            ref: "browser-channel:Google Chrome stable",
            source: "runtime_admission",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "internal",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-version",
            kind: "version_attestation",
            ref: "version-attestation:official-chrome:redacted",
            source: "runtime_admission",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "internal",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-launch-envelope",
            kind: "launch_envelope_ref",
            ref: officialChromeLaunchEnvelopeRef,
            source: "launch_envelope",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "internal",
            redaction_state: "not_required",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-launch-snapshot",
            kind: "launch_config_snapshot",
            ref: "launch-snapshot:official-chrome:redacted",
            source: "launch_envelope",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "sensitive",
            redaction_state: "redacted",
            artifact_identity: "artifact:official-chrome-launch-snapshot"
          },
          {
            evidence_ref_id: "ev-profile-binding",
            kind: "profile_binding_ref",
            ref: "profile-ref:official-chrome:redacted",
            source: "runtime_admission",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "sensitive",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-extension-binding",
            kind: "extension_binding_ref",
            ref: "extension-binding:redacted:official-chrome",
            source: "runtime_admission",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "sensitive",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-native-binding",
            kind: "native_messaging_binding_ref",
            ref: "native-binding:redacted:official-chrome",
            source: "runtime_admission",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "sensitive",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-runtime-bootstrap",
            kind: "runtime_bootstrap_ref",
            ref: "runtime-bootstrap:redacted:official-chrome",
            source: "runtime_admission",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "internal",
            redaction_state: "redacted",
            artifact_identity: null
          }
        ],
        closeout_plan: {
          required_evidence_kinds: [
            "provider_contract_ref",
            "launch_envelope_ref",
            "launch_config_snapshot",
            "profile_binding_ref",
            "extension_binding_ref",
            "native_messaging_binding_ref",
            "runtime_bootstrap_ref",
            "browser_channel_attestation"
          ],
          required_freshness: "current_launch",
          minimum_attestation_level: "runtime_attested",
          coverage_status: "complete",
          blocking_reasons: [],
          missing_evidence: [],
          redaction_gaps: [],
          next_required_gates: [],
          closeout_decision: "allow"
        }
      }
    },
    partial: {
      provider_evidence_record: {
        identity: {
          provider_evidence_record_id: "per-official-chrome-partial-001",
          provider_evidence_contract_version: "v1",
          run_id: "run-official-chrome-fixture-partial-001",
          command_ref: "runtime.start",
          created_at: fixtureTimestamp,
          evidence_scope: "launch_admission",
          base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"]
        },
        selected_provider: {
          provider_id: officialChromeProviderId,
          provider_contract_ref: officialChromeContractRef,
          provider_contract_version: "v1",
          provider_mode: "core_managed",
          provider_class_ref: "registry-entry:official-chrome.persistent",
          selection_reason: "default_eligible",
          selection_source: "launch_envelope",
          selection_evidence_refs: ["ev-provider-contract"]
        },
        version_evidence: {
          provider_version: "fixture-v1",
          browser_channel: "Google Chrome stable",
          browser_version: "Google Chrome 137.0.0.0",
          extension_version: "1.0.0",
          native_host_version: "1.0.0",
          contract_version: "v1",
          version_evidence_refs: ["ev-channel"]
        },
        launch_arguments: {
          launch_envelope_ref: officialChromeLaunchEnvelopeRef,
          launch_envelope_version: "v1",
          provider_launch_ref: "launch-snapshot:official-chrome:redacted",
          browser_mode: {
            headed: true,
            headless: false,
            real_browser_required: true,
            browser_channel: "Google Chrome stable"
          },
          runtime_bindings: {
            extension_binding_mode: "persistent_profile_extension",
            native_messaging_mode: "required",
            runtime_bootstrap_required: true
          },
          network_regional_ref: null,
          fingerprint_policy_ref: null,
          launch_argument_evidence_refs: ["ev-launch-snapshot"]
        },
        profile_reference: {
          profile_ref: "profile-ref:official-chrome:redacted",
          profile_binding_mode: "required_existing",
          profile_lock_status: "locked_by_current_run",
          login_state_evidence: "not_required",
          profile_persistence_status: "persistent",
          profile_evidence_refs: ["ev-profile-binding"]
        },
        extension_status: {
          extension_required: true,
          extension_binding_mode: "persistent_profile_extension",
          extension_id: "abcdefghijklmnopabcdefghijklmnop",
          extension_version: "1.0.0",
          extension_installation_status: "installed_in_profile",
          extension_runtime_status: "recoverable",
          extension_evidence_refs: ["ev-extension-binding"]
        },
        native_messaging_status: {
          native_messaging_required: true,
          native_host_name: "com.webenvoy.host",
          native_host_manifest_ref: "native-manifest-ref:redacted:official-chrome",
          allowed_origin_ref: "allowed-origin-ref:redacted:official-chrome",
          native_host_version: "1.0.0",
          native_messaging_runtime_status: "recoverable",
          native_messaging_evidence_refs: ["ev-native-binding"]
        },
        evidence_refs: [
          {
            evidence_ref_id: "ev-provider-contract",
            kind: "provider_contract_ref",
            ref: officialChromeContractRef,
            source: "provider_contract",
            status: "available",
            collected_at: null,
            freshness: "current_record",
            sensitivity: "public",
            redaction_state: "not_required",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-channel",
            kind: "browser_channel_attestation",
            ref: "browser-channel:Google Chrome stable",
            source: "runtime_admission",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "internal",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-launch-snapshot",
            kind: "launch_config_snapshot",
            ref: "launch-snapshot:official-chrome:redacted",
            source: "launch_envelope",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "sensitive",
            redaction_state: "redacted",
            artifact_identity: "artifact:official-chrome-launch-snapshot"
          },
          {
            evidence_ref_id: "ev-profile-binding",
            kind: "profile_binding_ref",
            ref: "profile-ref:official-chrome:redacted",
            source: "runtime_admission",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "sensitive",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-extension-binding",
            kind: "extension_binding_ref",
            ref: "extension-binding:redacted:official-chrome",
            source: "runtime_admission",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "sensitive",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-native-binding",
            kind: "native_messaging_binding_ref",
            ref: "native-binding:redacted:official-chrome",
            source: "runtime_admission",
            status: "partial",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "sensitive",
            redaction_state: "redacted",
            artifact_identity: null
          }
        ],
        closeout_plan: {
          required_evidence_kinds: [
            "provider_contract_ref",
            "launch_config_snapshot",
            "profile_binding_ref",
            "extension_binding_ref",
            "native_messaging_binding_ref",
            "runtime_bootstrap_ref",
            "browser_channel_attestation"
          ],
          required_freshness: "current_launch",
          minimum_attestation_level: "runtime_attested",
          coverage_status: "partial",
          blocking_reasons: ["native_messaging_status_unready", "evidence_ref_unavailable"],
          missing_evidence: ["runtime_bootstrap_ref"],
          redaction_gaps: [],
          next_required_gates: ["runtime_attestation", "native_messaging_health"],
          closeout_decision: "deny"
        }
      }
    },
    failClosed: {
      provider_evidence_record: {
        identity: {
          provider_evidence_record_id: "per-official-chrome-blocked-001",
          provider_evidence_contract_version: "v1",
          run_id: "run-official-chrome-fixture-blocked-001",
          command_ref: "runtime.start",
          created_at: fixtureTimestamp,
          evidence_scope: "launch_admission",
          base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"]
        },
        selected_provider: {
          provider_id: officialChromeProviderId,
          provider_contract_ref: officialChromeContractRef,
          provider_contract_version: "v1",
          provider_mode: "core_managed",
          provider_class_ref: "registry-entry:official-chrome.persistent",
          selection_reason: "default_eligible",
          selection_source: "launch_envelope",
          selection_evidence_refs: ["ev-provider-contract"]
        },
        version_evidence: {
          provider_version: "fixture-v1",
          browser_channel: "unknown",
          browser_version: "unknown",
          extension_version: "unknown",
          native_host_version: "unknown",
          contract_version: "v1",
          version_evidence_refs: ["ev-channel"]
        },
        launch_arguments: {
          launch_envelope_ref: officialChromeLaunchEnvelopeRef,
          launch_envelope_version: "v1",
          provider_launch_ref: "launch-snapshot:official-chrome:redacted",
          browser_mode: {
            headed: false,
            headless: true,
            real_browser_required: true,
            browser_channel: "Google Chrome stable"
          },
          runtime_bindings: {
            extension_binding_mode: "persistent_profile_extension",
            native_messaging_mode: "required",
            runtime_bootstrap_required: true
          },
          network_regional_ref: null,
          fingerprint_policy_ref: null,
          launch_argument_evidence_refs: ["ev-launch-snapshot"]
        },
        profile_reference: {
          profile_ref: "profile-ref:official-chrome:redacted",
          profile_binding_mode: "required_existing",
          profile_lock_status: "unlocked",
          login_state_evidence: "unknown",
          profile_persistence_status: "blocked",
          profile_evidence_refs: []
        },
        extension_status: {
          extension_required: true,
          extension_binding_mode: "persistent_profile_extension",
          extension_id: null,
          extension_version: "unknown",
          extension_installation_status: "missing",
          extension_runtime_status: "blocked",
          extension_evidence_refs: []
        },
        native_messaging_status: {
          native_messaging_required: true,
          native_host_name: "com.webenvoy.host",
          native_host_manifest_ref: null,
          allowed_origin_ref: null,
          native_host_version: "unknown",
          native_messaging_runtime_status: "blocked",
          native_messaging_evidence_refs: []
        },
        evidence_refs: [
          {
            evidence_ref_id: "ev-provider-contract",
            kind: "provider_contract_ref",
            ref: officialChromeContractRef,
            source: "provider_contract",
            status: "available",
            collected_at: null,
            freshness: "current_record",
            sensitivity: "public",
            redaction_state: "not_required",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-channel",
            kind: "browser_channel_attestation",
            ref: "browser-channel:unknown",
            source: "runtime_admission",
            status: "partial",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "internal",
            redaction_state: "redacted",
            artifact_identity: null
          },
          {
            evidence_ref_id: "ev-launch-snapshot",
            kind: "launch_config_snapshot",
            ref: "launch-snapshot:official-chrome:redacted",
            source: "launch_envelope",
            status: "available",
            collected_at: fixtureTimestamp,
            freshness: "current_launch",
            sensitivity: "sensitive",
            redaction_state: "policy_missing",
            artifact_identity: "artifact:official-chrome-launch-snapshot"
          }
        ],
        closeout_plan: {
          required_evidence_kinds: [
            "provider_contract_ref",
            "launch_config_snapshot",
            "profile_binding_ref",
            "extension_binding_ref",
            "native_messaging_binding_ref",
            "runtime_bootstrap_ref",
            "browser_channel_attestation"
          ],
          required_freshness: "current_launch",
          minimum_attestation_level: "runtime_attested",
          coverage_status: "blocked",
          blocking_reasons: [
            "provider_limitation_conflict",
            "profile_lock_unavailable",
            "extension_status_unready",
            "native_messaging_status_unready",
            "runtime_attestation_required",
            "redaction_policy_missing"
          ],
          missing_evidence: [
            "profile_binding_ref",
            "extension_binding_ref",
            "native_messaging_binding_ref",
            "runtime_bootstrap_ref",
            "google_chrome_stable_attestation"
          ],
          redaction_gaps: ["ev-launch-snapshot"],
          next_required_gates: [
            "real_browser_launch_attestation",
            "persistent_extension_identity",
            "native_messaging_health",
            "profile_lock_attestation"
          ],
          closeout_decision: "deny"
        }
      }
    }
  }
} as const;

export const providerContractFixtureIds = {
  providerId,
  capabilityId,
  contractRef,
  launchEnvelopeRef
} as const;

export const officialChromeProviderFixtureIds = {
  providerId: officialChromeProviderId,
  capabilityId: officialChromeCapabilityId,
  contractRef: officialChromeContractRef,
  launchEnvelopeRef: officialChromeLaunchEnvelopeRef
} as const;
