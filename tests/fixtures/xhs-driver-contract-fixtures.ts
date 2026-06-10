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
    }
  }
} as const;
