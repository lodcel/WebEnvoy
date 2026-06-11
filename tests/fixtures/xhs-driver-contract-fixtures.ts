export const xhsDriverContractFixtures = {
  success: {
    summary: {
      capability_result: {
        ability_id: "xhs.note.detail.v1"
      },
      route_evidence: {
        route_role: "primary",
        path_kind: "api",
        evidence_status: "success",
        route_evidence_class: "active_api_fetch_fallback",
        consumed_template: {
          route_evidence_class: "passive_api_capture",
          template_identity: "/api/sns/web/v1/feed"
        }
      },
      execution_audit: null
    }
  },
  fallback: {
    summary: {
      route_evidence: {
        evidence_class: "page_state_fallback",
        fallback_reason: "REQUEST_CONTEXT_MISSING",
        page_kind: "user_home"
      }
    },
    observability: {
      page_state: {
        fallback_used: true
      }
    },
    key_request: {
      stage: "page_state_fallback",
      outcome: "completed",
      fallback_reason: "REQUEST_CONTEXT_MISSING"
    }
  },
  bindingFailure: {
    error: {
      code: "ERR_EXECUTION_FAILED"
    },
    details: {
      reason: "EXECUTION_MODE_GATE_BLOCKED"
    },
    xhs_page_runtime_readiness: {
      owner_ref: "#1162",
      page_readiness: {
        status: "blocked",
        source: "target_binding_snapshot",
        blocking_reasons: ["target_binding_not_bound"]
      },
      runtime_readiness: {
        status: "not_required",
        source: "execution_mode",
        blocking_reasons: []
      },
      provider_admission_readiness: {
        status: "blocked",
        source: "provider_admission_result",
        blocking_reasons: ["provider_admission_result_missing"]
      },
      overall_readiness: "blocked",
      gate_decision: "deny"
    },
    request_admission_result: {
      admission_decision: "blocked"
    },
    execution_audit: null
  },
  providerCapabilityFailure: {
    error: {
      code: "ERR_EXECUTION_FAILED"
    },
    details: {
      reason: "ACTIVE_API_FETCH_FALLBACK_GATE_BLOCKED"
    },
    active_api_fetch_fallback_gate: {
      reason_codes: [
        "FINGERPRINT_VALIDATION_NOT_READY",
        "RUNTIME_ATTESTATION_REQUIRED",
        "EXECUTION_SURFACE_NOT_REAL_BROWSER",
        "HEADLESS_NOT_FALSE"
      ]
    },
    provider_admission_readiness: {
      status: "blocked",
      source: "provider_admission_result",
      blocking_reasons: [
        "provider_admission_not_allowed",
        "provider_requirement_refs_not_attested"
      ]
    }
  },
  closeoutEvidenceBoundary: {
    contract_version: "xhs_closeout_evidence_boundary.v1",
    owner_ref: "#1164",
    operation: "xhs.detail",
    redaction_policy_ref: "FR-0041.evidence_redaction_policy.v1",
    route_evidence: {
      route: "xhs.detail.api",
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      route_evidence_class: "passive_api_capture",
      source_kind: "page_request",
      method: "POST",
      endpoint: "/api/sns/web/v1/feed",
      request_url: "/api/sns/web/v1/feed",
      status_code: 200,
      head_sha: "898b8b4015ac5644d3971b72dc67d9a90436363a",
      run_id: "run-xhs-closeout-boundary-fixture-001",
      artifact_identity: "artifact:xhs-closeout:run-xhs-closeout-boundary-fixture-001:round-1",
      profile_ref: "profile-ref:xhs:redacted",
      session_id: "session-ref:xhs:redacted",
      target_tab_id: 42,
      page_url: "https://www.xiaohongshu.com/explore/note-closeout-fixture-001",
      action_ref: "read",
      observed_at: 1780000000000,
      captured_at: 1780000000000,
      consumed_template: {
        route_evidence_class: "passive_api_capture",
        source_kind: "page_request",
        template_identity: "captured:run-xhs-closeout-boundary-fixture-001:detail:shape:1780000000000",
        profile_ref: "profile-ref:xhs:redacted",
        session_id: "session-ref:xhs:redacted",
        target_tab_id: 42,
        run_id: "run-xhs-closeout-boundary-fixture-001",
        action_ref: "read",
        page_url: "https://www.xiaohongshu.com/explore/note-closeout-fixture-001",
        observed_at: 1780000000000,
        captured_at: 1780000000000,
        freshness_window_ms: 300000,
        template_age_ms: 0,
        page_context_namespace: "xhs.detail:profile-ref:xhs:redacted:42",
        shape_key: "xhs.detail:POST:/api/sns/web/v1/feed:note-closeout-fixture-001"
      }
    },
    provider_evidence_record: {
      identity: {
        provider_evidence_record_id: "per-xhs-closeout-boundary-fixture-001",
        provider_evidence_contract_version: "v1",
        run_id: "run-xhs-closeout-boundary-fixture-001",
        command_ref: "xhs.detail",
        created_at: "2026-06-11T00:00:00Z",
        evidence_scope: "capability_closeout",
        base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"]
      },
      selected_provider: {
        provider_id: "official-chrome.persistent",
        provider_contract_ref: "provider-contract:official-chrome.persistent:v1",
        provider_contract_version: "v1",
        provider_mode: "core_managed",
        provider_class_ref: "registry-entry:official-chrome.persistent",
        selection_reason: "explicit_request",
        selection_source: "launch_envelope",
        selection_evidence_refs: ["ev-provider-contract"]
      },
      evidence_refs: [
        {
          evidence_ref_id: "ev-provider-contract",
          kind: "provider_contract_ref",
          ref: "provider-contract:official-chrome.persistent:v1",
          source: "provider_contract",
          status: "available",
          collected_at: "2026-06-11T00:00:00Z",
          freshness: "current_pr_head",
          sensitivity: "public",
          redaction_state: "not_required",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-launch-envelope",
          kind: "launch_envelope_ref",
          ref: "launch-envelope:xhs-detail:redacted",
          source: "launch_envelope",
          status: "available",
          collected_at: "2026-06-11T00:00:00Z",
          freshness: "current_pr_head",
          sensitivity: "public",
          redaction_state: "not_required",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-profile-binding",
          kind: "profile_binding_ref",
          ref: "profile-ref:xhs:redacted",
          source: "runtime_admission",
          status: "available",
          collected_at: "2026-06-11T00:00:00Z",
          freshness: "current_pr_head",
          sensitivity: "sensitive",
          redaction_state: "redacted",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-extension-binding",
          kind: "extension_binding_ref",
          ref: "extension-binding-ref:xhs:redacted",
          source: "runtime_admission",
          status: "available",
          collected_at: "2026-06-11T00:00:00Z",
          freshness: "current_pr_head",
          sensitivity: "sensitive",
          redaction_state: "redacted",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-native-messaging-binding",
          kind: "native_messaging_binding_ref",
          ref: "native-messaging-binding-ref:xhs:redacted",
          source: "runtime_admission",
          status: "available",
          collected_at: "2026-06-11T00:00:00Z",
          freshness: "current_pr_head",
          sensitivity: "sensitive",
          redaction_state: "redacted",
          artifact_identity: null
        },
        {
          evidence_ref_id: "ev-runtime-observation",
          kind: "runtime_observation_ref",
          ref: "runtime-observation:xhs:redacted",
          source: "runtime_observation",
          status: "available",
          collected_at: "2026-06-11T00:00:00Z",
          freshness: "current_pr_head",
          sensitivity: "internal",
          redaction_state: "redacted",
          artifact_identity: "artifact:xhs-runtime-observation:run-xhs-closeout-boundary-fixture-001"
        },
        {
          evidence_ref_id: "ev-closeout-artifact",
          kind: "closeout_artifact_ref",
          ref: "artifact:xhs-closeout:run-xhs-closeout-boundary-fixture-001:round-1",
          source: "runtime_observation",
          status: "available",
          collected_at: "2026-06-11T00:00:00Z",
          freshness: "current_pr_head",
          sensitivity: "internal",
          redaction_state: "redacted",
          artifact_identity: "artifact:xhs-closeout:run-xhs-closeout-boundary-fixture-001:round-1"
        }
      ],
      closeout_plan: {
        required_evidence_kinds: [
          "provider_contract_ref",
          "launch_envelope_ref",
          "profile_binding_ref",
          "extension_binding_ref",
          "native_messaging_binding_ref",
          "runtime_observation_ref",
          "closeout_artifact_ref"
        ],
        required_freshness: "current_pr_head",
        minimum_attestation_level: "runtime_attested",
        coverage_status: "complete",
        blocking_reasons: [],
        missing_evidence: [],
        redaction_gaps: [],
        next_required_gates: ["route_evidence_evaluator"],
        closeout_decision: "allow"
      }
    }
  }
} as const;
