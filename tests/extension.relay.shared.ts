import { describe, expect, it } from "vitest";

import { BackgroundRelay } from "../extension/background.js";
import { ContentScriptHandler } from "../extension/content-script-handler.js";

export type BridgeResponse = {
  id: string;
  status: "success" | "error";
  summary: Record<string, unknown>;
  payload?: Record<string, unknown>;
  error: null | { code: string; message: string };
};

export const waitForResponse = (relay: BackgroundRelay, timeoutMs = 500): Promise<BridgeResponse> =>
  new Promise((resolve, reject) => {
    const off = relay.onNativeMessage((message) => {
      off();
      clearTimeout(timer);
      resolve(message);
    });
    const timer = setTimeout(() => {
      off();
      reject(new Error("did not receive relay response in time"));
    }, timeoutMs);
  });

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const resolveWriteInteractionTier = (payload: Record<string, unknown>): string | null => {
  const direct = payload.write_interaction_tier;
  if (typeof direct === "string") {
    return direct;
  }
  const consumerGateResult = asRecord(payload.consumer_gate_result);
  if (typeof consumerGateResult?.write_interaction_tier === "string") {
    return consumerGateResult.write_interaction_tier;
  }
  const writeActionMatrix = asRecord(payload.write_action_matrix);
  if (typeof writeActionMatrix?.write_interaction_tier === "string") {
    return writeActionMatrix.write_interaction_tier;
  }
  const writeActionMatrixDecisions = asRecord(payload.write_action_matrix_decisions);
  if (typeof writeActionMatrixDecisions?.write_interaction_tier === "string") {
    return writeActionMatrixDecisions.write_interaction_tier;
  }
  return null;
};

export const completeIssue208ApprovalRecord = {
  approved: true,
  approver: "qa-reviewer",
  approved_at: "2026-03-23T10:00:00Z",
  checks: {
    target_domain_confirmed: true,
    target_tab_confirmed: true,
    target_page_confirmed: true,
    risk_state_checked: true,
    action_type_confirmed: true
  }
} as const;

export const createApprovedReadAdmissionContext = (input?: {
  run_id?: string;
  request_id?: string;
  session_id?: string;
  decision_id?: string;
  approval_id?: string;
  target_tab_id?: number;
  target_page?: string;
  requested_execution_mode?: "live_read_limited" | "live_read_high_risk";
  risk_state?: "limited" | "allowed";
}) => {
  const runId = input?.run_id ?? "run-relay-001";
  const requestId = input?.request_id;
  const decisionId = input?.decision_id;
  const approvalId = input?.approval_id;
  const refSuffix = requestId ? `${runId}_${requestId}` : runId;
  return ({
  approval_admission_evidence: {
    approval_admission_ref: `approval_admission_${refSuffix}`,
    ...(decisionId ? { decision_id: decisionId } : {}),
    ...(approvalId ? { approval_id: approvalId } : {}),
    ...(requestId ? { request_id: requestId } : {}),
    run_id: runId,
    session_id: input?.session_id ?? "nm-session-001",
    issue_scope: "issue_209",
    target_domain: "www.xiaohongshu.com",
    target_tab_id: input?.target_tab_id ?? 32,
    target_page: input?.target_page ?? "search_result_tab",
    action_type: "read",
    requested_execution_mode: input?.requested_execution_mode ?? "live_read_high_risk",
    approved: true,
    approver: "reviewer-a",
    approved_at: "2026-03-23T08:00:00Z",
    checks: {
      target_domain_confirmed: true,
      target_tab_confirmed: true,
      target_page_confirmed: true,
      risk_state_checked: true,
      action_type_confirmed: true
    },
    recorded_at: "2026-03-23T08:00:00Z"
  },
  audit_admission_evidence: {
    audit_admission_ref: `audit_admission_${refSuffix}`,
    ...(decisionId ? { decision_id: decisionId } : {}),
    ...(approvalId ? { approval_id: approvalId } : {}),
    ...(requestId ? { request_id: requestId } : {}),
    run_id: runId,
    session_id: input?.session_id ?? "nm-session-001",
    issue_scope: "issue_209",
    target_domain: "www.xiaohongshu.com",
    target_tab_id: input?.target_tab_id ?? 32,
    target_page: input?.target_page ?? "search_result_tab",
    action_type: "read",
    requested_execution_mode: input?.requested_execution_mode ?? "live_read_high_risk",
    risk_state: input?.risk_state ?? "allowed",
    audited_checks: {
      target_domain_confirmed: true,
      target_tab_confirmed: true,
      target_page_confirmed: true,
      risk_state_checked: true,
      action_type_confirmed: true
    },
    recorded_at: "2026-03-23T08:00:30Z"
  }
} as const);
};

export const createIssue209GateInvocationId = (runId: string, suffix = "default") =>
  `issue209-gate-${runId}-${suffix}`;

export const approvedLiveOptions = {
  target_domain: "www.xiaohongshu.com",
  target_tab_id: 32,
  target_page: "search_result_tab",
  action_type: "read",
  requested_execution_mode: "live_read_high_risk",
  risk_state: "allowed",
  approval: {
    approved: true,
    approver: "reviewer-a",
    approved_at: "2026-03-23T08:00:00Z",
    checks: {
      target_domain_confirmed: true,
      target_tab_confirmed: true,
      target_page_confirmed: true,
      risk_state_checked: true,
      action_type_confirmed: true
    }
  }
} as const;

export const providerAwareSearchReadPathOptions = {
  xhs_driver_provider_requirements: {
    declaration_id: "xhs-driver-provider-requirements:xhs.search:read:v1",
    declaration_version: "v1",
    provider_requirement_ref: "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read",
    provider_requirement_refs: ["FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read"],
    ability_scope: {
      command: "xhs.search",
      ability_id: "xhs.note.search.v1",
      ability_layer: "L3",
      ability_action: "read"
    },
    required_actions: ["read", "diagnose"],
    non_proofs: [
      "driver_requirement_declaration_does_not_prove_provider_capability_allowed",
      "driver_requirement_declaration_does_not_prove_runtime_ready"
    ],
    downstream_slice_refs: ["#1166", "#1167", "#1168"]
  },
  provider_requirement_refs: ["FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read"],
  runtime_binding_ref: "FR-0061.xhs_runtime_binding.v1/run-xhs-live-allowed-001/search",
  target_binding_snapshot_ref:
    "FR-0063.target_binding_snapshot.v1/run-xhs-live-allowed-001/search",
  xhs_runtime_binding: {
    target_domain: "www.xiaohongshu.com",
    target_page: "search_tab",
    execution_mode: "read",
    binding_freshness: "current_run",
    binding_status: "declared"
  },
  target_binding_snapshot: {
    snapshot_version: "v1",
    state: "candidate_found",
    run_id: "run-xhs-live-allowed-001",
    target_scope: {
      target_domain: "www.xiaohongshu.com",
      target_page_class: "search_tab"
    },
    route_bucket: "search",
    freshness_scope: "current_run",
    blocking_reasons: ["target_binding_not_bound"]
  },
  target_binding_transition_evidence: [
    {
      transition_id: "target-binding-transition:run-xhs-live-allowed-001:search:candidate_found",
      from_state: "unbound",
      to_state: "candidate_found"
    }
  ],
  downstream_slice_refs: ["#1162", "#1166", "#1167", "#1168"],
  non_proofs: [
    "runtime_ready",
    "provider_capability_allowed",
    "syvert_normalized_result_complete",
    "write_enabled"
  ],
  page_runtime_readiness_ref: "issue-1162.xhs_page_runtime_readiness.v1/run-xhs-live-allowed-001",
  xhs_page_runtime_readiness: {
    owner_ref: "#1162",
    command: "xhs.search",
    run_id: "run-xhs-live-allowed-001",
    page_readiness: {
      status: "blocked",
      required: true,
      blocking_reasons: ["target_binding_not_bound"]
    },
    runtime_readiness: {
      status: "ready",
      required: true,
      source: "official_chrome_runtime_readiness"
    },
    provider_admission_readiness: {
      status: "blocked",
      required: true,
      source: "provider_admission_result",
      blocking_reasons: ["provider_requirement_refs_not_attested"]
    },
    overall_readiness: "blocked",
    gate_decision: "deny"
  },
  page_runtime_readiness_decision: "deny",
  page_runtime_readiness_blocking_reasons: [
    "page:target_binding_not_bound",
    "provider:provider_requirement_refs_not_attested"
  ]
} as const;

export const createProviderAwareSearchReadyReadPathOptions = (runId: string) => ({
  ...providerAwareSearchReadPathOptions,
  runtime_binding_ref: `FR-0061.xhs_runtime_binding.v1/${runId}/search`,
  target_binding_snapshot_ref: `FR-0063.target_binding_snapshot.v1/${runId}/search`,
  xhs_runtime_binding: {
    target_domain: "www.xiaohongshu.com",
    target_page: "search_tab",
    execution_mode: "read",
    binding_freshness: "current_run",
    binding_status: "declared"
  },
  target_binding_snapshot: {
    ...providerAwareSearchReadPathOptions.target_binding_snapshot,
    state: "bound",
    run_id: runId,
    target_scope: {
      target_domain: "www.xiaohongshu.com",
      target_page_class: "search_tab"
    },
    route_bucket: "search",
    freshness_scope: "current_run",
    evidence_refs: {
      candidate_ref: `FR-0063.target_binding_candidate.v1/${runId}/search`,
      url_match_ref: `FR-0063.target_binding_url_match.v1/${runId}/search`,
      dom_observation_ref: `FR-0063.target_binding_dom_observation.v1/${runId}/search`,
      runtime_state_ref: `FR-0063.target_binding_runtime_state.v1/${runId}/search`,
      extension_bridge_ref: `FR-0063.target_binding_extension_bridge.v1/${runId}/search`,
      transition_refs: [`target-binding-transition:${runId}:search:bound`],
      evidence_status: "complete",
      evidence_completeness: "complete",
      redaction_state: "redacted",
      source_owner: "#1161"
    },
    blocking_reasons: []
  },
  target_binding_transition_evidence: [
    {
      transition_id: `target-binding-transition:${runId}:search:bound`,
      from_state: "candidate_found",
      to_state: "bound"
    }
  ],
  non_proofs: ["syvert_normalized_result_complete", "write_enabled"],
  page_runtime_readiness_ref: `issue-1162.xhs_page_runtime_readiness.v1/${runId}`,
  xhs_page_runtime_readiness: {
    ...providerAwareSearchReadPathOptions.xhs_page_runtime_readiness,
    run_id: runId,
    page_readiness: {
      status: "ready",
      required: true
    },
    runtime_readiness: {
      status: "ready",
      required: true,
      source: "official_chrome_runtime_readiness"
    },
    provider_admission_readiness: {
      status: "ready",
      required: true,
      source: "provider_admission_result"
    },
    overall_readiness: "ready",
    gate_decision: "allow"
  },
  page_runtime_readiness_decision: "allow",
  page_runtime_readiness_blocking_reasons: []
} as const);

export const approvedLimitedLiveOptions = {
  ...approvedLiveOptions,
  requested_execution_mode: "live_read_limited",
  risk_state: "limited"
} as const;

export const approvedHighRiskLimitedOptions = {
  ...approvedLiveOptions,
  risk_state: "limited"
} as const;

export const createAttestedEditorInputValidationResult = (text: string) => ({
  ok: true,
  mode: "controlled_editor_input_validation" as const,
  attestation: "controlled_real_interaction" as const,
  editor_locator: "div.tiptap.ProseMirror",
  input_text: text,
  before_text: "",
  visible_text: text,
  post_blur_text: text,
  focus_confirmed: true,
  focus_attestation_source: "chrome_debugger",
  focus_attestation_reason: null,
  preserved_after_blur: true,
  success_signals: ["editable_state_entered", "editor_focus_attested", "text_visible", "text_persisted_after_blur"],
  failure_signals: [] as string[],
  minimum_replay: ["enter_editable_mode", "focus_editor", "type_short_text", "blur_or_reobserve"]
});

export const createCapturedSearchRequestContextReader = (input?: {
  capturedAt?: number;
  observedAt?: number;
  searchId?: string;
  referrer?: string;
  responseBody?: Record<string, unknown>;
  rejectedStatus?: number;
  rejectedBody?: Record<string, unknown>;
}) => {
  return async (lookup: {
    page_context_namespace: string;
    shape_key: string;
  }) => {
    let shape: Record<string, unknown> | null = null;
    try {
      shape = JSON.parse(lookup.shape_key) as Record<string, unknown>;
    } catch {
      shape = null;
    }
    const keyword = typeof shape?.keyword === "string" ? shape.keyword : "露营装备";
    const page = typeof shape?.page === "number" ? shape.page : 1;
    const pageSize = typeof shape?.page_size === "number" ? shape.page_size : 20;
    const sort = typeof shape?.sort === "string" ? shape.sort : "general";
    const noteType = typeof shape?.note_type === "number" ? shape.note_type : 0;
    const pageContextNamespace =
      lookup.page_context_namespace || "https://www.xiaohongshu.com/search_result";
    const commonArtifact = {
      source_kind: "page_request" as const,
      route_evidence_class: "passive_api_capture" as const,
      transport: "fetch" as const,
      method: "POST" as const,
      path: "/api/sns/web/v1/search/notes" as const,
      url: "https://www.xiaohongshu.com/api/sns/web/v1/search/notes",
      status: input?.rejectedStatus ?? 200,
      captured_at: input?.capturedAt ?? 900,
      observed_at: input?.observedAt ?? 900,
      page_context_namespace: pageContextNamespace,
      shape_key: lookup.shape_key,
      shape: {
        command: "xhs.search" as const,
        method: "POST" as const,
        pathname: "/api/sns/web/v1/search/notes" as const,
        keyword,
        page,
        page_size: pageSize,
        sort,
        note_type: noteType
      },
      referrer:
        input?.referrer ?? "https://www.xiaohongshu.com/search_result?keyword=%E9%9C%B2%E8%90%A5%E8%A3%85%E5%A4%87",
      request: {
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json;charset=utf-8",
          "X-S-Common": "{}",
          "x-s": "signed-template",
          "x-t": "1700000000"
        },
        body: {
          keyword,
          page,
          page_size: pageSize,
          search_id: input?.searchId ?? "captured-search-id",
          sort,
          note_type: noteType
        }
      },
      response: {
        headers: {
          "content-type": "application/json"
        },
        body: input?.responseBody ?? {
          code: 0,
          data: {
            items: []
          }
        }
      }
    };
    const rejectedObservation =
      input?.rejectedStatus !== undefined || input?.rejectedBody !== undefined
        ? {
            ...commonArtifact,
            status: input?.rejectedStatus ?? 0,
            rejection_reason: "failed_request_rejected" as const,
            request_status: {
              completion: "failed" as const,
              http_status: input?.rejectedStatus ?? null
            },
            response: {
              headers: {
                "content-type": "application/json"
              },
              body: input?.rejectedBody ?? {}
            }
          }
        : null;
    return {
      page_context_namespace: pageContextNamespace,
      shape_key: lookup.shape_key,
      admitted_template: rejectedObservation
        ? null
        : {
            ...commonArtifact,
            template_ready: true,
            request_status: {
              completion: "completed" as const,
              http_status: 200
            }
          },
      rejected_observation: rejectedObservation,
      incompatible_observation: null,
      available_shape_keys: [lookup.shape_key]
    };
  };
};

export { BackgroundRelay, ContentScriptHandler };
