import { describe, expect, it, vi } from "vitest";

import { executeXhsDetail } from "../extension/xhs-detail.js";
import { executeXhsUserHome } from "../extension/xhs-user-home.js";
import type { XhsSearchEnvironment, XhsSearchOptions } from "../extension/xhs-search-types.js";

const DETAIL_ENDPOINT = "/api/sns/web/v1/feed";
const USER_HOME_ENDPOINT = "/api/sns/web/v1/user_posted";

const createApprovalRecord = () => ({
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
});

const createAuditRecord = () => ({
  event_id: "audit-live-read-fallback-001",
  issue_scope: "issue_209",
  target_domain: "www.xiaohongshu.com",
  target_tab_id: 32,
  target_page: "search_result_tab",
  action_type: "read",
  requested_execution_mode: "live_read_high_risk",
  gate_decision: "allowed",
  recorded_at: "2026-03-23T10:00:30Z"
});

const createApprovedReadAdmissionContext = (input: {
  runId: string;
  requestId?: string;
  targetTabId?: number;
  targetPage: string;
  requestedExecutionMode?: "live_read_high_risk" | "live_read_limited";
  riskState?: "allowed" | "limited";
}) => {
  const requestId = input.requestId;
  const refSuffix = requestId ? `${input.runId}_${requestId}` : input.runId;
  return ({
  approval_admission_evidence: {
    approval_admission_ref: `approval_admission_${refSuffix}`,
    ...(requestId ? { request_id: requestId } : {}),
    run_id: input.runId,
    session_id: "nm-session-001",
    issue_scope: "issue_209",
    target_domain: "www.xiaohongshu.com",
    target_tab_id: input.targetTabId ?? 32,
    target_page: input.targetPage,
    action_type: "read",
    requested_execution_mode: input.requestedExecutionMode ?? "live_read_high_risk",
    approved: true,
    approver: "qa-reviewer",
    approved_at: "2026-03-23T10:00:00Z",
    checks: {
      target_domain_confirmed: true,
      target_tab_confirmed: true,
      target_page_confirmed: true,
      risk_state_checked: true,
      action_type_confirmed: true
    },
    recorded_at: "2026-03-23T10:00:00Z"
  },
  audit_admission_evidence: {
    audit_admission_ref: `audit_admission_${refSuffix}`,
    ...(requestId ? { request_id: requestId } : {}),
    run_id: input.runId,
    session_id: "nm-session-001",
    issue_scope: "issue_209",
    target_domain: "www.xiaohongshu.com",
    target_tab_id: input.targetTabId ?? 32,
    target_page: input.targetPage,
    action_type: "read",
    requested_execution_mode: input.requestedExecutionMode ?? "live_read_high_risk",
    risk_state: input.riskState ?? "allowed",
    audited_checks: {
      target_domain_confirmed: true,
      target_tab_confirmed: true,
      target_page_confirmed: true,
      risk_state_checked: true,
      action_type_confirmed: true
    },
    recorded_at: "2026-03-23T10:00:30Z"
  }
});
};

const createActiveFallbackGate = (runId: string = "run-live-read-fallback-001") => ({
  enabled: true,
  account_safety_state: "clear",
  rhythm_state: "allowed",
  fingerprint_validation_state: "ready",
  runtime_attestation: {
    source: "official_chrome_runtime_readiness",
    runtime_readiness: "ready",
    profile_ref: "xhs_001",
    session_id: "nm-session-001",
    run_id: runId,
    execution_surface: "real_browser",
    headless: false
  },
  fingerprint_attestation: {
    source: "content_script_fingerprint_runtime",
    validation_state: "ready",
    profile_ref: "xhs_001",
    missing_required_patches: []
  }
});

const createLiveReadOptions = (overrides?: Partial<XhsSearchOptions>): XhsSearchOptions => ({
  issue_scope: "issue_209",
  target_domain: "www.xiaohongshu.com",
  target_tab_id: 32,
  target_page: "search_result_tab",
  actual_target_domain: "www.xiaohongshu.com",
  actual_target_tab_id: 32,
  actual_target_page: "search_result_tab",
  action_type: "read",
  requested_execution_mode: "live_read_high_risk",
  risk_state: "allowed",
  approval_record: createApprovalRecord(),
  audit_record: createAuditRecord(),
  active_api_fetch_fallback: createActiveFallbackGate(),
  ...overrides
});

const createAdmittedLiveReadOptions = (input: {
  runId: string;
  targetPage: "explore_detail_tab" | "profile_tab";
  overrides?: Partial<XhsSearchOptions>;
}): XhsSearchOptions => {
  const providerAwareReadPathOptions =
    input.targetPage === "explore_detail_tab"
      ? createProviderAwareDetailReadPathOptions(input.runId)
      : createProviderAwareUserHomeReadPathOptions(input.runId);

  return createLiveReadOptions({
    target_page: input.targetPage,
    actual_target_page: input.targetPage,
    ...providerAwareReadPathOptions,
    active_api_fetch_fallback: createActiveFallbackGate(input.runId),
    admission_context: createApprovedReadAdmissionContext({
      runId: input.runId,
      targetPage: input.targetPage,
      requestedExecutionMode:
        input.overrides?.requested_execution_mode === "live_read_limited"
          ? "live_read_limited"
          : "live_read_high_risk",
      riskState: input.overrides?.risk_state === "limited" ? "limited" : "allowed"
    }),
    ...(input.overrides ?? {})
  });
};

function createProviderAwareDetailReadPathOptions(runId: string) {
  return {
    xhs_driver_provider_requirements: {
      declaration_id: "xhs-driver-provider-requirements:xhs.detail:read:v1",
      declaration_version: "v1",
      provider_requirement_ref: "FR-0061.xhs_driver_provider_requirements.v1/xhs.detail.read",
      provider_requirement_refs: ["FR-0061.xhs_driver_provider_requirements.v1/xhs.detail.read"],
      ability_scope: {
        command: "xhs.detail",
        ability_id: "xhs.note.detail.v1",
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
    provider_requirement_refs: ["FR-0061.xhs_driver_provider_requirements.v1/xhs.detail.read"],
    runtime_binding_ref: `FR-0061.xhs_runtime_binding.v1/${runId}/detail`,
    target_binding_snapshot_ref: `FR-0063.target_binding_snapshot.v1/${runId}/detail`,
    xhs_runtime_binding: {
      target_domain: "www.xiaohongshu.com",
      target_page: "explore_detail_tab",
      execution_mode: "read",
      binding_freshness: "current_run",
      binding_status: "declared"
    },
    target_binding_snapshot: {
      snapshot_version: "v1",
      state: "bound",
      run_id: runId,
      target_scope: {
        target_domain: "www.xiaohongshu.com",
        target_page_class: "explore_detail_tab"
      },
      route_bucket: "detail",
      freshness_scope: "current_run",
      evidence_refs: {
        candidate_ref: `FR-0063.target_binding_candidate.v1/${runId}/detail`,
        url_match_ref: `FR-0063.target_binding_url_match.v1/${runId}/detail`,
        dom_observation_ref: `FR-0063.target_binding_dom_observation.v1/${runId}/detail`,
        runtime_state_ref: `FR-0063.target_binding_runtime_state.v1/${runId}/detail`,
        extension_bridge_ref: `FR-0063.target_binding_extension_bridge.v1/${runId}/detail`,
        transition_refs: [`target-binding-transition:${runId}:detail:bound`],
        evidence_status: "complete",
        evidence_completeness: "complete",
        redaction_state: "redacted",
        source_owner: "#1161"
      },
      blocking_reasons: []
    },
    target_binding_transition_evidence: [
      {
        transition_id: `target-binding-transition:${runId}:detail:bound`,
        from_state: "candidate_found",
        to_state: "bound"
      }
    ],
    downstream_slice_refs: ["#1162", "#1166", "#1167", "#1168"],
    non_proofs: ["syvert_normalized_result_complete", "write_enabled"],
    page_runtime_readiness_ref: `issue-1162.xhs_page_runtime_readiness.v1/${runId}`,
    xhs_page_runtime_readiness: {
      owner_ref: "#1162",
      command: "xhs.detail",
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
  } as const;
}

function createProviderAwareUserHomeReadPathOptions(runId: string) {
  return {
    xhs_driver_provider_requirements: {
      declaration_id: "xhs-driver-provider-requirements:xhs.user_home:read:v1",
      declaration_version: "v1",
      provider_requirement_ref: "FR-0061.xhs_driver_provider_requirements.v1/xhs.user_home.read",
      provider_requirement_refs: ["FR-0061.xhs_driver_provider_requirements.v1/xhs.user_home.read"],
      ability_scope: {
        command: "xhs.user_home",
        ability_id: "xhs.user.home.v1",
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
    provider_requirement_refs: ["FR-0061.xhs_driver_provider_requirements.v1/xhs.user_home.read"],
    runtime_binding_ref: `FR-0061.xhs_runtime_binding.v1/${runId}/user_home`,
    target_binding_snapshot_ref: `FR-0063.target_binding_snapshot.v1/${runId}/user_home`,
    xhs_runtime_binding: {
      target_domain: "www.xiaohongshu.com",
      target_page: "profile_tab",
      execution_mode: "read",
      binding_freshness: "current_run",
      binding_status: "declared"
    },
    target_binding_snapshot: {
      snapshot_version: "v1",
      state: "bound",
      run_id: runId,
      target_scope: {
        target_domain: "www.xiaohongshu.com",
        target_page_class: "profile_tab"
      },
      route_bucket: "user_home",
      freshness_scope: "current_run",
      evidence_refs: {
        candidate_ref: `FR-0063.target_binding_candidate.v1/${runId}/user_home`,
        url_match_ref: `FR-0063.target_binding_url_match.v1/${runId}/user_home`,
        dom_observation_ref: `FR-0063.target_binding_dom_observation.v1/${runId}/user_home`,
        runtime_state_ref: `FR-0063.target_binding_runtime_state.v1/${runId}/user_home`,
        extension_bridge_ref: `FR-0063.target_binding_extension_bridge.v1/${runId}/user_home`,
        transition_refs: [`target-binding-transition:${runId}:user_home:bound`],
        evidence_status: "complete",
        evidence_completeness: "complete",
        redaction_state: "redacted",
        source_owner: "#1161"
      },
      blocking_reasons: []
    },
    target_binding_transition_evidence: [
      {
        transition_id: `target-binding-transition:${runId}:user_home:bound`,
        from_state: "candidate_found",
        to_state: "bound"
      }
    ],
    downstream_slice_refs: ["#1162", "#1166", "#1167", "#1168"],
    non_proofs: ["syvert_normalized_result_complete", "write_enabled"],
    page_runtime_readiness_ref: `issue-1162.xhs_page_runtime_readiness.v1/${runId}`,
    xhs_page_runtime_readiness: {
      owner_ref: "#1162",
      command: "xhs.user_home",
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
  } as const;
}

const createEnvironment = (overrides?: Partial<XhsSearchEnvironment>): XhsSearchEnvironment => ({
  now: () => 1_000,
  randomId: () => "req-001",
  getLocationHref: () => "https://www.xiaohongshu.com/search_result?keyword=test",
  getDocumentTitle: () => "XHS",
  getReadyState: () => "complete",
  getCookie: () => "a1=cookie-token",
  getPageStateRoot: () => null,
  readPageStateRoot: async () => null,
  callSignature: async () => ({ "X-s": "sig", "X-t": "1710000000" }),
  fetchJson: async () => ({ status: 200, body: { code: 0 } }),
  ...overrides
});

const createDetailRequestContext = (
  noteId: string,
  overrides?: Record<string, unknown>
): Record<string, unknown> => ({
  route_evidence_class: "passive_api_capture",
  source_kind: "page_request",
  transport: "fetch",
  method: "POST",
  path: DETAIL_ENDPOINT,
  url: `https://www.xiaohongshu.com${DETAIL_ENDPOINT}`,
  status: 200,
  captured_at: 1_710_000_000_000,
  page_context_namespace: "xhs.detail",
  shape_key: JSON.stringify({
    command: "xhs.detail",
    method: "POST",
    pathname: DETAIL_ENDPOINT,
    note_id: noteId
  }),
  shape: {
    command: "xhs.detail",
    method: "POST",
    pathname: DETAIL_ENDPOINT,
    note_id: noteId
  },
  request: {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json;charset=utf-8",
      "X-S-Common": "{\"detailId\":\"captured-detail-id\"}"
    },
    body: {
      source_note_id: noteId
    }
  },
  response: {
    headers: {},
    body: {
      code: 0,
      data: {
        note: {
          noteId
        }
      }
    }
  },
  referrer: `https://www.xiaohongshu.com/explore/${noteId}?xsec_token=token-${noteId}&xsec_source=pc_search`,
  ...(overrides ?? {})
});

const createUserHomeRequestContext = (
  userId: string,
  overrides?: Record<string, unknown>
): Record<string, unknown> => ({
  route_evidence_class: "passive_api_capture",
  source_kind: "page_request",
  transport: "fetch",
  method: "GET",
  path: USER_HOME_ENDPOINT,
  url: `https://www.xiaohongshu.com${USER_HOME_ENDPOINT}?user_id=${userId}`,
  status: 200,
  captured_at: 1_710_000_000_000,
  page_context_namespace: "xhs.user_home",
  shape_key: JSON.stringify({
    command: "xhs.user_home",
    method: "GET",
    pathname: USER_HOME_ENDPOINT,
    user_id: userId
  }),
  shape: {
    command: "xhs.user_home",
    method: "GET",
    pathname: USER_HOME_ENDPOINT,
    user_id: userId
  },
  request: {
    headers: {
      Accept: "application/json, text/plain, */*",
      "X-S-Common": "{\"userId\":\"captured-user-id\"}"
    },
    body: null
  },
  response: {
    headers: {},
    body: {
      code: 0,
      data: {
        user: {
          userId
        }
      }
    }
  },
  referrer: `https://www.xiaohongshu.com/user/profile/${userId}?xsec_token=token-${userId}&xsec_source=pc_search`,
  ...(overrides ?? {})
});

const bindArtifactForLookup = (
  artifact: Record<string, unknown> | null,
  input: Parameters<NonNullable<XhsSearchEnvironment["readCapturedRequestContext"]>>[0]
): Record<string, unknown> | null => {
  if (!artifact) {
    return artifact;
  }
  return {
    ...artifact,
    profile_ref: artifact.profile_ref ?? input.profile_ref,
    session_id: artifact.session_id ?? input.session_id,
    target_tab_id: artifact.target_tab_id ?? input.target_tab_id,
    run_id: artifact.run_id ?? input.run_id,
    action_ref: artifact.action_ref ?? input.action_ref,
    page_url: artifact.page_url ?? input.page_url
  };
};

const createRequestContextReader = (
  artifact: Record<string, unknown>
): NonNullable<XhsSearchEnvironment["readCapturedRequestContext"]> =>
  (async (input) =>
    bindArtifactForLookup(artifact, input) as never) as NonNullable<XhsSearchEnvironment["readCapturedRequestContext"]>;

const createFallbackExecutionContext = (runId: string) => ({
  runId,
  sessionId: "nm-session-001",
  profile: "xhs_001",
  gateInvocationId: `issue209-gate-${runId}-fallback-001`
});

describe("xhs read execution fallback", () => {
  it("blocks xhs.detail when provider-aware readiness denies the read path", async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error("provider-aware detail block should not continue to live fetch");
    });
    const runId = "run-detail-provider-aware-denied-001";

    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-provider-denied-001"
        },
        options: createAdmittedLiveReadOptions({
          runId,
          targetPage: "explore_detail_tab",
          overrides: {
            ...createProviderAwareDetailReadPathOptions(runId),
            target_binding_snapshot: {
              ...createProviderAwareDetailReadPathOptions(runId).target_binding_snapshot,
              state: "candidate_found",
              evidence_refs: undefined,
              blocking_reasons: ["target_binding_not_bound"]
            },
            xhs_page_runtime_readiness: {
              ...createProviderAwareDetailReadPathOptions(runId).xhs_page_runtime_readiness,
              page_readiness: {
                status: "blocked",
                required: true,
                blocking_reasons: ["target_binding_not_bound"]
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
          }
        }),
        executionContext: createFallbackExecutionContext(runId)
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-provider-denied-001",
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.details).toMatchObject({
      reason: "PROVIDER_AWARE_READINESS_DENIED",
      blocking_reasons: expect.arrayContaining([
        "target_binding:target_binding_not_bound",
        "provider:provider_requirement_refs_not_attested",
        "page_runtime_gate:deny",
        "page_runtime_readiness_decision:deny"
      ])
    });
    expect(result.payload).toMatchObject({
      provider_aware_read_path_gate: {
        gate_decision: "blocked",
        live_execution_continued: false,
        effective_execution_mode: null,
        blocking_reasons: expect.arrayContaining([
          "target_binding:target_binding_not_bound",
          "provider:provider_requirement_refs_not_attested"
        ])
      },
      provider_requirement_refs: [
        "FR-0061.xhs_driver_provider_requirements.v1/xhs.detail.read"
      ],
      runtime_binding_ref: `FR-0061.xhs_runtime_binding.v1/${runId}/detail`,
      target_binding_snapshot_ref: `FR-0063.target_binding_snapshot.v1/${runId}/detail`
    });
    expect(result.payload.consumer_gate_result).toMatchObject({
      gate_decision: "blocked",
      effective_execution_mode: null,
      gate_reasons: expect.arrayContaining([
        "PROVIDER_AWARE_READINESS_DENIED",
        "PROVIDER_AWARE_LIVE_READ_NOT_CONTINUED"
      ])
    });
  });

  it("blocks xhs.detail simulated success when provider-aware readiness denies the read path", async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error("provider-aware detail block should not continue to simulated live success");
    });
    const runId = "run-detail-provider-aware-simulated-denied-001";
    const providerAwareOptions = createProviderAwareDetailReadPathOptions(runId);

    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-provider-simulated-denied-001"
        },
        options: createAdmittedLiveReadOptions({
          runId,
          targetPage: "explore_detail_tab",
          overrides: {
            ...providerAwareOptions,
            simulate_result: "success",
            target_binding_snapshot: {
              ...providerAwareOptions.target_binding_snapshot,
              state: "candidate_found",
              evidence_refs: undefined,
              blocking_reasons: ["target_binding_not_bound"]
            },
            xhs_page_runtime_readiness: {
              ...providerAwareOptions.xhs_page_runtime_readiness,
              page_readiness: {
                status: "blocked",
                required: true,
                blocking_reasons: ["target_binding_not_bound"]
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
          }
        }),
        executionContext: createFallbackExecutionContext(runId)
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/explore/note-provider-simulated-denied-001",
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.details).toMatchObject({
      reason: "PROVIDER_AWARE_READINESS_DENIED",
      blocking_reasons: expect.arrayContaining([
        "target_binding:target_binding_not_bound",
        "provider:provider_requirement_refs_not_attested",
        "page_runtime_gate:deny",
        "page_runtime_readiness_decision:deny"
      ])
    });
    expect(result.payload).toMatchObject({
      provider_aware_read_path_gate: {
        gate_decision: "blocked",
        live_execution_continued: false,
        effective_execution_mode: null,
        blocking_reasons: expect.arrayContaining([
          "target_binding:target_binding_not_bound",
          "provider:provider_requirement_refs_not_attested"
        ])
      }
    });
    expect(result.payload.summary?.capability_result).toBeUndefined();
  });

  it("blocks xhs.detail when provider-aware evidence is scoped to xhs.search", async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error("search-scoped provider evidence should not continue to detail fetch");
    });
    const runId = "run-detail-provider-aware-search-scope-001";

    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-provider-search-scope-001"
        },
        options: createAdmittedLiveReadOptions({
          runId,
          targetPage: "explore_detail_tab",
          overrides: {
            ...createProviderAwareDetailReadPathOptions(runId),
            xhs_driver_provider_requirements: {
              ...createProviderAwareDetailReadPathOptions(runId).xhs_driver_provider_requirements,
              provider_requirement_ref:
                "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read",
              provider_requirement_refs: [
                "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read"
              ],
              ability_scope: {
                command: "xhs.search",
                ability_id: "xhs.note.search.v1",
                ability_layer: "L3",
                ability_action: "read"
              }
            },
            provider_requirement_refs: [
              "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read"
            ],
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
              ...createProviderAwareDetailReadPathOptions(runId).target_binding_snapshot,
              target_scope: {
                target_domain: "www.xiaohongshu.com",
                target_page_class: "search_tab"
              },
              route_bucket: "search"
            },
            xhs_page_runtime_readiness: {
              ...createProviderAwareDetailReadPathOptions(runId).xhs_page_runtime_readiness,
              command: "xhs.search"
            }
          }
        }),
        executionContext: createFallbackExecutionContext(runId)
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-provider-search-scope-001",
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.details).toMatchObject({
      reason: "PROVIDER_AWARE_READINESS_DENIED",
      blocking_reasons: expect.arrayContaining([
        "provider_requirement_ref_mismatch",
        "provider_requirement_scope_mismatch",
        "runtime_binding_ref_mismatch",
        "runtime_binding_scope_mismatch",
        "target_binding_ref_route:search",
        "target_binding_scope_mismatch",
        "page_runtime_readiness_command_mismatch"
      ])
    });
  });

  it("blocks xhs.user_home when provider-aware readiness denies the read path", async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error("provider-aware user_home block should not continue to live fetch");
    });
    const runId = "run-user-provider-aware-denied-001";
    const providerAwareOptions = createProviderAwareUserHomeReadPathOptions(runId);

    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-provider-denied-001"
        },
        options: createAdmittedLiveReadOptions({
          runId,
          targetPage: "profile_tab",
          overrides: {
            ...providerAwareOptions,
            target_binding_snapshot: {
              ...providerAwareOptions.target_binding_snapshot,
              state: "candidate_found",
              evidence_refs: undefined,
              blocking_reasons: ["target_binding_not_bound"]
            },
            xhs_page_runtime_readiness: {
              ...providerAwareOptions.xhs_page_runtime_readiness,
              page_readiness: {
                status: "blocked",
                required: true,
                blocking_reasons: ["target_binding_not_bound"]
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
          }
        }),
        executionContext: createFallbackExecutionContext(runId)
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/user/profile/user-provider-denied-001",
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.details).toMatchObject({
      reason: "PROVIDER_AWARE_READINESS_DENIED",
      blocking_reasons: expect.arrayContaining([
        "target_binding:target_binding_not_bound",
        "provider:provider_requirement_refs_not_attested",
        "page_runtime_gate:deny",
        "page_runtime_readiness_decision:deny"
      ])
    });
    expect(result.payload).toMatchObject({
      provider_aware_read_path_gate: {
        gate_decision: "blocked",
        live_execution_continued: false,
        effective_execution_mode: null,
        blocking_reasons: expect.arrayContaining([
          "target_binding:target_binding_not_bound",
          "provider:provider_requirement_refs_not_attested"
        ])
      },
      provider_requirement_refs: [
        "FR-0061.xhs_driver_provider_requirements.v1/xhs.user_home.read"
      ],
      runtime_binding_ref: `FR-0061.xhs_runtime_binding.v1/${runId}/user_home`,
      target_binding_snapshot_ref: `FR-0063.target_binding_snapshot.v1/${runId}/user_home`
    });
    expect(result.payload.consumer_gate_result).toMatchObject({
      gate_decision: "blocked",
      effective_execution_mode: null,
      gate_reasons: expect.arrayContaining([
        "PROVIDER_AWARE_READINESS_DENIED",
        "PROVIDER_AWARE_LIVE_READ_NOT_CONTINUED"
      ])
    });
  });

  it("blocks xhs.user_home simulated success when provider-aware readiness denies the read path", async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error("provider-aware user_home block should not continue to simulated live success");
    });
    const runId = "run-user-provider-aware-simulated-denied-001";
    const providerAwareOptions = createProviderAwareUserHomeReadPathOptions(runId);

    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-provider-simulated-denied-001"
        },
        options: createAdmittedLiveReadOptions({
          runId,
          targetPage: "profile_tab",
          overrides: {
            ...providerAwareOptions,
            simulate_result: "success",
            target_binding_snapshot: {
              ...providerAwareOptions.target_binding_snapshot,
              state: "candidate_found",
              evidence_refs: undefined,
              blocking_reasons: ["target_binding_not_bound"]
            },
            xhs_page_runtime_readiness: {
              ...providerAwareOptions.xhs_page_runtime_readiness,
              page_readiness: {
                status: "blocked",
                required: true,
                blocking_reasons: ["target_binding_not_bound"]
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
          }
        }),
        executionContext: createFallbackExecutionContext(runId)
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/user/profile/user-provider-simulated-denied-001",
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.details).toMatchObject({
      reason: "PROVIDER_AWARE_READINESS_DENIED",
      blocking_reasons: expect.arrayContaining([
        "target_binding:target_binding_not_bound",
        "provider:provider_requirement_refs_not_attested",
        "page_runtime_gate:deny",
        "page_runtime_readiness_decision:deny"
      ])
    });
    expect(result.payload).toMatchObject({
      provider_aware_read_path_gate: {
        gate_decision: "blocked",
        live_execution_continued: false,
        effective_execution_mode: null,
        blocking_reasons: expect.arrayContaining([
          "target_binding:target_binding_not_bound",
          "provider:provider_requirement_refs_not_attested"
        ])
      }
    });
    expect(result.payload.summary?.capability_result).toBeUndefined();
  });

  it("blocks xhs.user_home when provider-aware evidence is scoped to xhs.detail", async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error("detail-scoped provider evidence should not continue to user_home fetch");
    });
    const runId = "run-user-provider-aware-detail-scope-001";
    const providerAwareOptions = createProviderAwareUserHomeReadPathOptions(runId);
    const detailProviderAwareOptions = createProviderAwareDetailReadPathOptions(runId);

    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-provider-detail-scope-001"
        },
        options: createAdmittedLiveReadOptions({
          runId,
          targetPage: "profile_tab",
          overrides: {
            ...providerAwareOptions,
            xhs_driver_provider_requirements:
              detailProviderAwareOptions.xhs_driver_provider_requirements,
            provider_requirement_refs: detailProviderAwareOptions.provider_requirement_refs,
            runtime_binding_ref: `FR-0061.xhs_runtime_binding.v1/${runId}/detail`,
            target_binding_snapshot_ref: `FR-0063.target_binding_snapshot.v1/${runId}/detail`,
            xhs_runtime_binding: {
              target_domain: "www.xiaohongshu.com",
              target_page: "explore_detail_tab",
              execution_mode: "read",
              binding_freshness: "current_run",
              binding_status: "declared"
            },
            target_binding_snapshot: {
              ...providerAwareOptions.target_binding_snapshot,
              target_scope: {
                target_domain: "www.xiaohongshu.com",
                target_page_class: "explore_detail_tab"
              },
              route_bucket: "detail"
            },
            xhs_page_runtime_readiness: {
              ...providerAwareOptions.xhs_page_runtime_readiness,
              command: "xhs.detail"
            }
          }
        }),
        executionContext: createFallbackExecutionContext(runId)
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/user/profile/user-provider-detail-scope-001",
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.details).toMatchObject({
      reason: "PROVIDER_AWARE_READINESS_DENIED",
      blocking_reasons: expect.arrayContaining([
        "provider_requirement_ref_mismatch",
        "provider_requirement_scope_mismatch",
        "runtime_binding_ref_mismatch",
        "runtime_binding_scope_mismatch",
        "target_binding_ref_route:detail",
        "target_binding_scope_mismatch",
        "page_runtime_readiness_command_mismatch"
      ])
    });
  });

  it("classifies login modal pages before request-context lookup", async () => {
    const readCapturedRequestContext = vi.fn(async () => null);
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));

    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-login-modal-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-login-modal-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-login-modal-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-login-modal-001",
        getDocumentTitle: () => "小红书 - 你的生活兴趣社区",
        getBodyText: () => "登录后推荐更懂你的笔记 扫码登录 输入手机号",
        getAccountSafetyOverlay: () => ({
          source: "dom_overlay",
          selector: '.login-modal',
          text: "登录后推荐更懂你的笔记 可用小红书或微信扫码 输入手机号"
        }),
        readCapturedRequestContext,
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected login modal failure");
    }
    expect(result.payload.details).toMatchObject({
      reason: "XHS_LOGIN_REQUIRED",
      page_url: "https://www.xiaohongshu.com/explore/note-login-modal-001"
    });
    expect(result.payload.diagnosis).toMatchObject({
      category: "page_changed",
      failure_site: {
        target: "xhs.account_safety_surface"
      }
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual([]);
    expect(readCapturedRequestContext).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("keeps captcha overlay diagnosis as page_changed before request-context lookup", async () => {
    const readCapturedRequestContext = vi.fn(async () => null);
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));

    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-captcha-overlay-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-captcha-overlay-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-captcha-overlay-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-captcha-overlay-001",
        getDocumentTitle: () => "小红书 - 你的生活兴趣社区",
        getAccountSafetyOverlay: () => ({
          source: "dom_overlay",
          selector: ".captcha-container",
          text: "请完成验证 拖动滑块"
        }),
        readCapturedRequestContext,
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected captcha overlay failure");
    }
    expect(result.payload.details).toMatchObject({
      reason: "CAPTCHA_REQUIRED"
    });
    expect(result.payload.diagnosis).toMatchObject({
      category: "page_changed",
      stage: "action",
      component: "page",
      failure_site: {
        target: "xhs.account_safety_surface"
      }
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual([]);
    expect(readCapturedRequestContext).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("blocks active api fetch fallback when explicit fallback gate approval is missing", async () => {
    const callSignature = vi.fn(async () => ({ "X-s": "sig", "X-t": "1710000000" }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: { code: 0, data: { note: { noteId: "note-no-active-gate-001" } } }
    }));

    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-no-active-gate-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-no-active-gate-001",
          targetPage: "explore_detail_tab",
          overrides: {
            active_api_fetch_fallback: undefined
          }
        }),
        executionContext: createFallbackExecutionContext("run-detail-no-active-gate-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-no-active-gate-001",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-no-active-gate-001")
        )
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected active fallback gate failure");
    }
    expect(result.payload.details).toMatchObject({
      reason: "ACTIVE_API_FETCH_FALLBACK_GATE_BLOCKED",
      active_api_fetch_fallback_gate: {
        gate_decision: "blocked",
        route_evidence_class: "active_api_fetch_fallback",
        reason_codes: expect.arrayContaining(["ACTIVE_API_FETCH_FALLBACK_NOT_APPROVED"])
      }
    });
    expect(result.payload.observability).toMatchObject({
      failure_site: {
        target: "xhs.active_api_fetch_fallback_gate"
      }
    });
    expect(callSignature).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
  });

	  it("blocks active api fetch fallback unless account, rhythm, fingerprint, real browser, and headless gates are all clear", async () => {
	    const callSignature = vi.fn(async () => ({ "X-s": "sig", "X-t": "1710000000" }));
	    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: { code: 0, data: { user: { userId: "user-active-block-001" } } }
    }));

    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-active-block-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-active-block-001",
          targetPage: "profile_tab",
          overrides: {
            active_api_fetch_fallback: {
              enabled: true,
              account_safety_state: "clear",
              rhythm_state: "cooldown",
              fingerprint_validation_state: "ready",
              execution_surface: "real_browser",
              headless: true
            }
          }
        }),
        executionContext: createFallbackExecutionContext("run-user-active-block-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-active-block-001",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-active-block-001")
        )
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected active fallback gate failure");
    }
    expect(result.payload.details).toMatchObject({
      reason: "ACTIVE_API_FETCH_FALLBACK_GATE_BLOCKED",
      active_api_fetch_fallback_gate: {
        reason_codes: expect.arrayContaining(["RHYTHM_NOT_ALLOWED", "HEADLESS_NOT_FALSE"])
      }
    });
	    expect(callSignature).not.toHaveBeenCalled();
	    expect(fetchJson).not.toHaveBeenCalled();
	  });

	  it("blocks active api fetch fallback when browser surface is only caller self-attested", async () => {
	    const callSignature = vi.fn(async () => ({ "X-s": "sig", "X-t": "1710000000" }));
	    const fetchJson = vi.fn(async () => ({
	      status: 200,
	      body: { code: 0, data: { note: { note_id: "note-self-attested-001" } } }
	    }));

	    const result = await executeXhsDetail(
	      {
	        abilityId: "xhs.note.detail.v1",
	        abilityLayer: "L3",
	        abilityAction: "read",
	        params: {
	          note_id: "note-self-attested-001"
	        },
	        options: createAdmittedLiveReadOptions({
	          runId: "run-detail-self-attested-001",
	          targetPage: "explore_detail_tab",
	          overrides: {
	            active_api_fetch_fallback: {
	              enabled: true,
	              account_safety_state: "clear",
	              rhythm_state: "allowed",
	              fingerprint_validation_state: "ready",
	              execution_surface: "real_browser",
	              headless: false
	            }
	          }
	        }),
	        executionContext: createFallbackExecutionContext("run-detail-self-attested-001")
	      },
	      createEnvironment({
	        getLocationHref: () =>
	          "https://www.xiaohongshu.com/explore/note-self-attested-001",
	        callSignature,
	        fetchJson,
	        readCapturedRequestContext: createRequestContextReader(
	          createDetailRequestContext("note-self-attested-001")
	        )
	      })
	    );

	    expect(result.ok).toBe(false);
	    if (result.ok) {
	      throw new Error("expected active fallback gate failure");
	    }
	    expect(result.payload.details).toMatchObject({
	      reason: "ACTIVE_API_FETCH_FALLBACK_GATE_BLOCKED",
	      active_api_fetch_fallback_gate: {
	        reason_codes: expect.arrayContaining([
	          "FINGERPRINT_VALIDATION_NOT_READY",
	          "RUNTIME_ATTESTATION_REQUIRED",
	          "EXECUTION_SURFACE_NOT_REAL_BROWSER",
	          "HEADLESS_NOT_FALSE"
	        ])
	      }
	    });
	    expect(callSignature).not.toHaveBeenCalled();
	    expect(fetchJson).not.toHaveBeenCalled();
	  });

  it("returns detail success only when the api payload contains the requested note object", async () => {
    const callSignature = vi.fn(async () => ({
      "X-s": "sig",
      "X-t": "1710000000"
    }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        data: {
          note: {
            noteId: "note-success-001",
            title: "target note"
          }
        }
      }
    }));
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-success-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-success-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-success-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-success-001",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-success-001")
        )
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected detail success");
    }
    expect(result.payload.summary).toMatchObject({
      capability_result: {
        ability_id: "xhs.note.detail.v1",
        outcome: "success",
        data_ref: {
          note_id: "note-success-001"
        }
      },
      route_evidence: {
        gate_decision: "allowed",
        route_evidence_class: "active_api_fetch_fallback",
        consumed_template: {
          route_evidence_class: "passive_api_capture"
        }
      }
    });
    expect(result.payload.observability).toMatchObject({
      failure_site: null
    });
    expect(result.payload).not.toHaveProperty("diagnosis");
    expect(callSignature).toHaveBeenCalledWith("/api/sns/web/v1/feed", {
      source_note_id: "note-success-001"
    });
    expect(fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://edith.xiaohongshu.com/api/sns/web/v1/feed"
      })
    );
  });

  it("does not reuse redacted passive capture headers in active api fetch fallback", async () => {
    const callSignature = vi.fn(async () => ({
      "X-s": "signature",
      "X-t": "timestamp"
    }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        data: {
          note: {
            noteId: "note-redacted-001"
          }
        }
      }
    }));
    const context = createDetailRequestContext("note-redacted-001");
    const request = context.request as Record<string, unknown>;
    request.headers = {
      Accept: "[redacted]",
      "Content-Type": "[redacted]",
      "X-S-Common": "[redacted]"
    };

    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-redacted-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-redacted-headers-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-redacted-headers-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-redacted-001",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(context)
      })
    );

    expect(result.ok).toBe(true);
    const forwardedHeaders = (fetchJson.mock.calls[0]?.[0] as { headers?: Record<string, string> })
      ?.headers;
    expect(forwardedHeaders).toMatchObject({
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json;charset=utf-8"
    });
    expect(forwardedHeaders?.["X-S-Common"]).not.toBe("[redacted]");
  });

  it("uses passive captured detail response as formal closeout route evidence", async () => {
    const callSignature = vi.fn(async () => ({ "X-s": "sig", "X-t": "1710000000" }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        data: {
          note: {
            note_id: "note-closeout-001"
          }
        }
      }
    }));
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-closeout-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-closeout-001",
          targetPage: "explore_detail_tab",
          overrides: {
            closeout_evidence_evaluation: true,
            __runtime_latest_head_sha: "head-detail-closeout-001"
          }
        }),
        executionContext: createFallbackExecutionContext("run-detail-closeout-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-closeout-001",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-closeout-001", {
            observed_at: 1_710_000_000_000
          })
        )
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected detail passive closeout success");
    }
    expect(callSignature).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.summary.route_evidence).toMatchObject({
      route: "xhs.detail.api",
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      route_evidence_class: "passive_api_capture",
      source_kind: "page_request",
      head_sha: "head-detail-closeout-001",
      run_id: "run-detail-closeout-001",
      artifact_identity: expect.stringContaining("xhs.detail"),
      profile_ref: "xhs_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore/note-closeout-001",
      action_ref: "read"
    });
  });

  it("keeps passive detail closeout valid when the signed search_result URL canonicalizes to explore", async () => {
    const callSignature = vi.fn(async () => ({ "X-s": "sig", "X-t": "1710000000" }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        data: {
          note: {
            note_id: "note-canonical-closeout-001"
          }
        }
      }
    }));
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-canonical-closeout-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-canonical-closeout-001",
          targetPage: "explore_detail_tab",
          overrides: {
            closeout_evidence_evaluation: true,
            __runtime_latest_head_sha: "head-detail-canonical-closeout-001"
          }
        }),
        executionContext: createFallbackExecutionContext("run-detail-canonical-closeout-001")
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/explore/note-canonical-closeout-001",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-canonical-closeout-001", {
            observed_at: 1_710_000_000_000,
            page_url:
              "https://www.xiaohongshu.com/search_result/note-canonical-closeout-001?xsec_token=token-note-canonical-closeout-001&xsec_source=pc_search",
            referrer:
              "https://www.xiaohongshu.com/search_result/note-canonical-closeout-001?xsec_token=token-note-canonical-closeout-001&xsec_source=pc_search"
          })
        )
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected canonicalized detail passive closeout success");
    }
    expect(callSignature).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.summary.route_evidence).toMatchObject({
      route: "xhs.detail.api",
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      route_evidence_class: "passive_api_capture",
      head_sha: "head-detail-canonical-closeout-001",
      run_id: "run-detail-canonical-closeout-001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore/note-canonical-closeout-001",
      action_ref: "read",
      passive_api_capture_closeout_gate: {
        gate_decision: "allowed",
        reason_codes: []
      }
    });
  });

  it("returns user_home success only when the api payload contains the requested user object", async () => {
    const callSignature = vi.fn(async () => ({
      "X-s": "sig",
      "X-t": "1710000000"
    }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        data: {
          user: {
            userId: "user-success-001",
            nickname: "target user"
          }
        }
      }
    }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-success-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-success-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-success-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-success-001",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-success-001")
        )
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected user_home success");
    }
    expect(result.payload.summary).toMatchObject({
      capability_result: {
        ability_id: "xhs.user.home.v1",
        outcome: "success",
        data_ref: {
          user_id: "user-success-001"
        }
      }
    });
    expect(result.payload.observability).toMatchObject({
      failure_site: null
    });
    expect(result.payload).not.toHaveProperty("diagnosis");
    expect(callSignature).toHaveBeenCalledWith(
      `${USER_HOME_ENDPOINT}?user_id=user-success-001`,
      {}
    );
    expect(fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `https://edith.xiaohongshu.com${USER_HOME_ENDPOINT}?user_id=user-success-001`
      })
    );
  });

  it("uses passive captured user_home response as formal closeout route evidence", async () => {
    const callSignature = vi.fn(async () => ({ "X-s": "sig", "X-t": "1710000000" }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        data: {
          user: {
            userId: "user-closeout-001"
          }
        }
      }
    }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-closeout-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-closeout-001",
          targetPage: "profile_tab",
          overrides: {
            closeout_evidence_evaluation: true,
            __runtime_latest_head_sha: "head-user-closeout-001"
          }
        }),
        executionContext: createFallbackExecutionContext("run-user-closeout-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-closeout-001",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-closeout-001", {
            observed_at: 1_710_000_000_000,
            response: {
              headers: {},
              body: {
                code: 0,
                data: {
                  notes: [
                    {
                      note_id: "note-user-closeout-001",
                      user: {
                        user_id: "user-closeout-001",
                        nickname: "closeout user"
                      }
                    }
                  ]
                }
              }
            }
          })
        )
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected user_home passive closeout success");
    }
    expect(callSignature).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.summary.route_evidence).toMatchObject({
      route: "xhs.user_home.api",
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      route_evidence_class: "passive_api_capture",
      source_kind: "page_request",
      head_sha: "head-user-closeout-001",
      run_id: "run-user-closeout-001",
      artifact_identity: expect.stringContaining("xhs.user_home"),
      profile_ref: "xhs_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/user/profile/user-closeout-001",
      action_ref: "read"
    });
    expect(result.payload.summary.closeout_route_evidence).toMatchObject(
      result.payload.summary.route_evidence as Record<string, unknown>
    );
  });

  it("keeps passive user_home closeout valid for the same profile page across signed URL token changes", async () => {
    const callSignature = vi.fn(async () => ({ "X-s": "sig", "X-t": "1710000000" }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        data: {
          user: {
            userId: "user-closeout-token-001"
          }
        }
      }
    }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-closeout-token-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-closeout-token-001",
          targetPage: "profile_tab",
          overrides: {
            closeout_evidence_evaluation: true,
            __runtime_latest_head_sha: "head-user-closeout-token-001"
          }
        }),
        executionContext: createFallbackExecutionContext("run-user-closeout-token-001")
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/user/profile/user-closeout-token-001?xsec_token=current-token&xsec_source=pc_search",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-closeout-token-001", {
            observed_at: 1_710_000_000_000,
            page_url:
              "https://www.xiaohongshu.com/user/profile/user-closeout-token-001?xsec_token=captured-token&xsec_source=pc_search",
            referrer:
              "https://www.xiaohongshu.com/user/profile/user-closeout-token-001?xsec_token=captured-token&xsec_source=pc_search",
            response: {
              headers: {},
              body: {
                code: 0,
                data: {
                  notes: [
                    {
                      note_id: "note-user-closeout-token-001",
                      user: {
                        user_id: "user-closeout-token-001"
                      }
                    }
                  ]
                }
              }
            }
          })
        )
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected user_home passive closeout success across token changes");
    }
    expect(callSignature).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
    expect(result.payload.summary.route_evidence).toMatchObject({
      route: "xhs.user_home.api",
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      passive_api_capture_closeout_gate: {
        gate_decision: "allowed",
        reason_codes: []
      }
    });
  });

  it("fails closed when passive user_home closeout is bound to a different profile page", async () => {
    const callSignature = vi.fn(async () => ({ "X-s": "sig", "X-t": "1710000000" }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        data: {
          user: {
            userId: "user-closeout-binding-001"
          }
        }
      }
    }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-closeout-binding-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-closeout-binding-001",
          targetPage: "profile_tab",
          overrides: {
            closeout_evidence_evaluation: true,
            __runtime_latest_head_sha: "head-user-closeout-binding-001"
          }
        }),
        executionContext: createFallbackExecutionContext("run-user-closeout-binding-001")
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/user/profile/user-closeout-wrong-001?xsec_token=current-token&xsec_source=pc_search",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-closeout-binding-001", {
            observed_at: 1_710_000_000_000,
            page_url:
              "https://www.xiaohongshu.com/user/profile/user-closeout-binding-001?xsec_token=captured-token&xsec_source=pc_search",
            referrer:
              "https://www.xiaohongshu.com/user/profile/user-closeout-binding-001?xsec_token=captured-token&xsec_source=pc_search",
            response: {
              headers: {},
              body: {
                code: 0,
                data: {
                  notes: [
                    {
                      note_id: "note-user-closeout-binding-001",
                      user: {
                        user_id: "user-closeout-binding-001"
                      }
                    }
                  ]
                }
              }
            }
          })
        )
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected user_home passive closeout page mismatch to fail closed");
    }
    expect(result.payload.details).toMatchObject({
      reason: "PASSIVE_API_CAPTURE_CLOSEOUT_GATE_BLOCKED",
      passive_api_capture_closeout_gate: {
        gate_decision: "blocked",
        reason_codes: expect.arrayContaining(["PASSIVE_CAPTURE_PAGE_MISMATCH"])
      }
    });
    expect(callSignature).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("blocks passive closeout success when captured user_home artifact is not bound to the current run", async () => {
    const callSignature = vi.fn(async () => ({ "X-s": "sig", "X-t": "1710000000" }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        data: {
          user: {
            userId: "user-closeout-mismatch-001"
          }
        }
      }
    }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-closeout-mismatch-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-closeout-current-001",
          targetPage: "profile_tab",
          overrides: {
            closeout_evidence_evaluation: true,
            __runtime_latest_head_sha: "head-user-closeout-current-001"
          }
        }),
        executionContext: createFallbackExecutionContext("run-user-closeout-current-001")
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/user/profile/user-closeout-mismatch-001",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-closeout-mismatch-001", {
            run_id: "run-user-closeout-stale-001",
            observed_at: 1_710_000_000_000
          })
        )
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected stale passive closeout artifact to fail closed");
    }
    expect(result.payload.details).toMatchObject({
      reason: "PASSIVE_API_CAPTURE_CLOSEOUT_GATE_BLOCKED",
      passive_api_capture_closeout_gate: {
        gate_decision: "blocked",
        reason_codes: expect.arrayContaining(["PASSIVE_CAPTURE_RUN_MISMATCH"])
      }
    });
    expect(callSignature).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("accepts wrapped detail payloads when the requested note is nested under note_card", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-wrapped-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-wrapped-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-wrapped-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-wrapped-001",
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-wrapped-001")
        ),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 0,
            data: {
              items: [
                {
                  note_card: {
                    noteId: "note-wrapped-001",
                    title: "wrapped note"
                  }
                }
              ]
            }
          }
        })
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected wrapped detail success");
    }
    expect(result.payload.summary).toMatchObject({
      capability_result: {
        outcome: "success",
        data_ref: {
          note_id: "note-wrapped-001"
        }
      }
    });
  });

  it("accepts nested user_home payloads when the requested user id is inside user.basicInfo", async () => {
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-nested-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-nested-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-nested-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-nested-001",
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-nested-001")
        ),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 0,
            data: {
              user: {
                basicInfo: {
                  userId: "user-nested-001"
                },
                nickname: "nested user"
              }
            }
          }
        })
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected nested user_home success");
    }
    expect(result.payload.summary).toMatchObject({
      capability_result: {
        outcome: "success",
        data_ref: {
          user_id: "user-nested-001"
        }
      }
    });
  });

  it("accepts user_posted payloads when the requested user id is inside notes[].user", async () => {
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-posted-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-posted-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-posted-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-posted-001",
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-posted-001")
        ),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 0,
            data: {
              notes: [
                {
                  note_id: "note-user-posted-001",
                  user: {
                    user_id: "user-posted-001",
                    nickname: "posted user"
                  }
                }
              ]
            }
          }
        })
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected user_posted user_home success");
    }
    expect(result.payload.summary).toMatchObject({
      capability_result: {
        outcome: "success",
        data_ref: {
          user_id: "user-posted-001"
        }
      }
    });
  });

  it("accepts empty user_posted payloads when signed continuity proves the requested profile", async () => {
    const callSignature = vi.fn(async () => ({
      "X-s": "sig",
      "X-t": "1710000000"
    }));
    const fetchJson = vi.fn(async () => ({
      status: 200,
      body: {
        code: 0,
        success: true,
        data: {
          notes: [],
          has_more: false,
          cursor: ""
        }
      }
    }));

    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-empty-posted-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-empty-posted-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-empty-posted-001")
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/user/profile/user-empty-posted-001?xsec_token=token-user-empty-posted-001&xsec_source=pc_search",
        callSignature,
        fetchJson,
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-empty-posted-001")
        )
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected empty user_posted user_home success");
    }
    expect(result.payload.summary).toMatchObject({
      capability_result: {
        outcome: "success",
        data_ref: {
          user_id: "user-empty-posted-001"
        }
      },
      signed_continuity: {
        token_presence: "present",
        user_home_url:
          "https://www.xiaohongshu.com/user/profile/user-empty-posted-001?xsec_token=token-user-empty-posted-001&xsec_source=pc_search"
      }
    });
    expect(callSignature).toHaveBeenCalled();
    expect(fetchJson).toHaveBeenCalled();
  });

  it("keeps detail execution failed when api success payload does not contain requested note", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-missing-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-target-missing-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-target-missing-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-missing-001",
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-missing-001")
        ),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 0,
            data: {
              items: [
                {
                  noteId: "different-note"
                }
              ]
            }
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected detail target-missing failure");
    }
    expect(result.error).toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      message: "xhs.detail 接口返回成功但未包含目标数据"
    });
    expect(result.payload.diagnosis).toMatchObject({
      failure_site: {
        target: "/api/sns/web/v1/feed"
      }
    });
  });

  it("keeps user_home execution failed when api success payload does not contain requested user", async () => {
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-missing-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-target-missing-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-target-missing-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-missing-001",
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-missing-001")
        ),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 0,
            data: {
              user: {
                userId: "different-user"
              }
            }
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected user target-missing failure");
    }
    expect(result.error).toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      message: "xhs.user_home 接口返回成功但未包含目标数据"
    });
    expect(result.payload.diagnosis).toMatchObject({
      failure_site: {
        target: USER_HOME_ENDPOINT
      }
    });
  });

  it("keeps user_home execution failed when api success payload only exposes a bare id", async () => {
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-bare-id-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-bare-id-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-bare-id-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-bare-id-001",
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-bare-id-001")
        ),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 0,
            data: {
              user: {
                id: "user-bare-id-001",
                nickname: "bare id only"
              }
            }
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected user bare-id failure");
    }
    expect(result.error).toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      message: "xhs.user_home 接口返回成功但未包含目标数据"
    });
    expect(result.payload.diagnosis).toMatchObject({
      failure_site: {
        target: USER_HOME_ENDPOINT
      }
    });
  });

  it("does not treat metadata note id as detail success evidence", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-metadata-only-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-metadata-only-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-metadata-only-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-metadata-only-001",
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-metadata-only-001")
        ),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 0,
            data: {
              items: [
                {
                  noteId: "different-note",
                  title: "other note"
                }
              ],
              metadata: {
                current_note_id: "note-metadata-only-001"
              }
            }
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected detail metadata-only failure");
    }
    expect(result.error.message).toBe("xhs.detail 接口返回成功但未包含目标数据");
  });

  it("keeps detail execution failed when the api success payload only exposes a bare id", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-bare-id-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-bare-id-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-bare-id-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-bare-id-001",
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-bare-id-001")
        ),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 0,
            data: {
              id: "note-bare-id-001",
              title: "bare id only"
            }
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected detail bare-id failure");
    }
    expect(result.error).toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      message: "xhs.detail 接口返回成功但未包含目标数据"
    });
  });

  it("uses detail page-state fallback when request context is missing but page state still proves the requested note", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-fallback-target-missing-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-fallback-target-missing-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-fallback-target-missing-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-fallback-target-missing-001",
        readPageStateRoot: async () => ({
          note: {
            noteDetailMap: {
              "note-fallback-target-missing-001": {
                noteId: "note-fallback-target-missing-001"
              }
            }
          }
        }),
        fetchJson
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected detail fallback success envelope");
    }
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "REQUEST_CONTEXT_MISSING",
      page_kind: "detail"
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("uses detail page-state fallback when request-context lookup errors but page state still proves the requested note", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-read-error-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-read-error-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-read-error-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-read-error-001",
        readCapturedRequestContext: vi.fn(async () => {
          throw new Error("bridge unavailable");
        }),
        readPageStateRoot: async () => ({
          note: {
            noteDetailMap: {
              "note-read-error-001": {
                noteId: "note-read-error-001"
              }
            }
          }
        }),
        fetchJson
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected detail read-error fallback success");
    }
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "REQUEST_CONTEXT_READ_FAILED",
      page_kind: "detail"
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual([
      expect.objectContaining({
        stage: "page_state_fallback",
        outcome: "completed",
        fallback_reason: "REQUEST_CONTEXT_READ_FAILED"
      })
    ]);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("blocks CAPTCHA_REQUIRED instead of converting it into detail page-state fallback", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-fallback-rejected-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-fallback-rejected-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-fallback-rejected-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-fallback-rejected-001",
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-fallback-rejected-001", {
            template_ready: false,
            rejection_reason: "failed_request_rejected",
            request_status: {
              completion: "failed",
              http_status: 429
            },
            response: {
              headers: {},
              body: {
                code: 429001,
                msg: "captcha required"
              }
            }
          })
        ),
        readPageStateRoot: async () => ({
          note: {
            noteDetailMap: {
              "note-fallback-rejected-001": {
                noteId: "note-fallback-rejected-001"
              }
            }
          }
        }),
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected detail captcha failure envelope");
    }
    expect(result.error).toMatchObject({ code: "ERR_EXECUTION_FAILED" });
    expect(result.payload.details).toMatchObject({
      reason: "CAPTCHA_REQUIRED",
      status_code: 429,
      platform_code: 429001
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "request",
          outcome: "failed",
          status_code: 429,
          failure_reason: "CAPTCHA_REQUIRED"
        })
      ])
    );
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("classifies detail backend rejected-source diagnosis as request_failed without page fallback", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-rejected-no-fallback-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-rejected-no-fallback-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-rejected-no-fallback-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-rejected-no-fallback-001",
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-rejected-no-fallback-001", {
            template_ready: false,
            rejection_reason: "failed_request_rejected",
            request_status: {
              completion: "failed",
              http_status: 429
            },
            response: {
              headers: {},
              body: {
                code: 429001,
                msg: "captcha required"
              }
            }
          })
        ),
        readPageStateRoot: async () => null,
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected detail rejected-context failure envelope");
    }
    expect(result.payload.details).toMatchObject({
      reason: "CAPTCHA_REQUIRED",
      request_context_lookup_state: "rejected_source",
      request_context_miss_reason: "CAPTCHA_REQUIRED"
    });
    expect(result.payload.diagnosis).toMatchObject({
      category: "request_failed",
      failure_site: {
        component: "network",
        target: "/api/sns/web/v1/feed"
      }
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("does not treat metadata user id as user_home success evidence", async () => {
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-metadata-only-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-metadata-only-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-metadata-only-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-metadata-only-001",
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-metadata-only-001")
        ),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 0,
            data: {
              user: {
                userId: "different-user",
                nickname: "other user"
              },
              metadata: {
                owner_user_id: "user-metadata-only-001"
              }
            }
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected user_home metadata-only failure");
    }
    expect(result.error.message).toBe("xhs.user_home 接口返回成功但未包含目标数据");
  });

  it("uses user_home page-state fallback when request context is missing but page state still proves the requested user", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-fallback-target-missing-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-fallback-target-missing-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-fallback-target-missing-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-fallback-target-missing-001",
        readPageStateRoot: async () => ({
          user: {
            userId: "user-fallback-target-missing-001",
            nickname: "target user"
          }
        }),
        fetchJson
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected user_home fallback success envelope");
    }
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "REQUEST_CONTEXT_MISSING",
      page_kind: "user_home"
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual([
      expect.objectContaining({
        stage: "page_state_fallback",
        outcome: "completed",
        fallback_reason: "REQUEST_CONTEXT_MISSING"
      })
    ]);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("does not use user_home page-state fallback when page state only exposes root.user metadata", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-fallback-metadata-only-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-fallback-metadata-only-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-fallback-metadata-only-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-fallback-metadata-only-001",
        readPageStateRoot: async () => ({
          user: {
            userId: "user-fallback-metadata-only-001"
          }
        }),
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected user_home metadata-only request-context failure");
    }
    expect((result.payload.observability as Record<string, unknown>).page_state).not.toHaveProperty(
      "fallback_used"
    );
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual([]);
    expect(result.payload.details).toMatchObject({
      reason: "REQUEST_CONTEXT_MISSING",
      request_context_result: "request_context_missing",
      request_context_lookup_state: "miss",
      request_context_miss_reason: "template_missing"
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("uses user_home page-state fallback when request-context lookup errors but page state still proves the requested user", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-read-error-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-read-error-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-read-error-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-read-error-001",
        readCapturedRequestContext: vi.fn(async () => {
          throw new Error("bridge unavailable");
        }),
        readPageStateRoot: async () => ({
          user: {
            basic_info: {
              user_id: "user-read-error-001"
            }
          },
          board: {},
          note: {}
        }),
        fetchJson
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected user_home read-error fallback success");
    }
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "REQUEST_CONTEXT_READ_FAILED",
      page_kind: "user_home"
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual([
      expect.objectContaining({
        stage: "page_state_fallback",
        outcome: "completed",
        fallback_reason: "REQUEST_CONTEXT_READ_FAILED"
      })
    ]);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("preserves GATEWAY_INVOKER_FAILED during user_home page-state fallback for rejected exact-hit request context", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-fallback-rejected-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-fallback-rejected-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-fallback-rejected-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-fallback-rejected-001",
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-fallback-rejected-001", {
            template_ready: false,
            rejection_reason: "failed_request_rejected",
            request_status: {
              completion: "failed",
              http_status: 500
            },
            response: {
              headers: {},
              body: {
                code: 500100,
                msg: "create invoker failed"
              }
            }
          })
        ),
        readPageStateRoot: async () => ({
          user: {
            userId: "user-fallback-rejected-001"
          },
          board: {},
          note: {}
        }),
        fetchJson
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected user_home rejected-context fallback success envelope");
    }
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "GATEWAY_INVOKER_FAILED",
      page_kind: "user_home"
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "request",
          outcome: "failed",
          status_code: 500,
          failure_reason: "GATEWAY_INVOKER_FAILED"
        }),
        expect.objectContaining({
          stage: "page_state_fallback",
          outcome: "completed",
          fallback_reason: "GATEWAY_INVOKER_FAILED"
        })
      ])
    );
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("classifies user_home backend rejected-source diagnosis as request_failed without page fallback", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-rejected-no-fallback-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-rejected-no-fallback-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-rejected-no-fallback-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-rejected-no-fallback-001",
        readCapturedRequestContext: createRequestContextReader(
          createUserHomeRequestContext("user-rejected-no-fallback-001", {
            template_ready: false,
            rejection_reason: "failed_request_rejected",
            request_status: {
              completion: "failed",
              http_status: 500
            },
            response: {
              headers: {},
              body: {
                code: 500100,
                msg: "create invoker failed"
              }
            }
          })
        ),
        readPageStateRoot: async () => null,
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected user_home rejected-context failure envelope");
    }
    expect(result.payload.details).toMatchObject({
      reason: "GATEWAY_INVOKER_FAILED",
      request_context_lookup_state: "rejected_source",
      request_context_miss_reason: "GATEWAY_INVOKER_FAILED"
    });
    expect(result.payload.diagnosis).toMatchObject({
      category: "request_failed",
      failure_site: {
        component: "network",
        target: USER_HOME_ENDPOINT
      }
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("preserves account-abnormal status diagnostics for rejected detail request contexts", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-rejected-account-abnormal-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-rejected-account-abnormal-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-rejected-account-abnormal-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-rejected-account-abnormal-001",
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-rejected-account-abnormal-001", {
            template_ready: false,
            rejection_reason: "failed_request_rejected",
            request_status: {
              completion: "failed",
              http_status: 461
            },
            response: {
              headers: {},
              body: {
                code: 300011,
                msg: "account abnormal"
              }
            }
          })
        ),
        readPageStateRoot: async () => ({
          note: {
            noteDetailMap: {
              "note-rejected-account-abnormal-001": {
                noteId: "note-rejected-account-abnormal-001"
              }
            }
          }
        }),
        fetchJson
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected detail account-abnormal failure envelope");
    }
    expect(result.payload.details).toMatchObject({
      reason: "ACCOUNT_ABNORMAL",
      status_code: 461,
      platform_code: 300011
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "request",
          outcome: "failed",
          status_code: 461,
          failure_reason: "ACCOUNT_ABNORMAL"
        })
      ])
    );
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("uses user_home page-state fallback when page state only proves the requested user via basic_info.user_id", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-fallback-basic-info-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-fallback-basic-info-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-fallback-basic-info-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-fallback-basic-info-001",
        readPageStateRoot: async () => ({
          user: {
            basic_info: {
              user_id: "user-fallback-basic-info-001"
            }
          },
          board: {},
          note: {}
        }),
        fetchJson
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected user_home basic_info fallback success envelope");
    }
    expect(result.payload.summary.capability_result).toMatchObject({
      outcome: "success",
      data_ref: {
        user_id: "user-fallback-basic-info-001"
      }
    });
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "REQUEST_CONTEXT_MISSING",
      page_kind: "user_home"
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("uses user_home DOM fallback when request context is missing but the target profile page is readable", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "6505e12400000000120058d2"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-dom-fallback-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-dom-fallback-001")
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/user/profile/6505e12400000000120058d2?xsec_token=token-001",
        getDocumentTitle: () => "白巧a - 小红书",
        getBodyText: () => "白巧a 小红书号 关注 粉丝 获赞与收藏 笔记 收藏",
        getPageStateRoot: () => null,
        readPageStateRoot: async () => null,
        fetchJson
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected user_home DOM fallback success envelope");
    }
    expect(result.payload.summary.capability_result).toMatchObject({
      outcome: "success",
      data_ref: {
        user_id: "6505e12400000000120058d2"
      }
    });
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "REQUEST_CONTEXT_MISSING",
      page_kind: "user_home"
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("does not use user_home DOM fallback when a readable profile URL shows a login surface", async () => {
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-dom-login-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-dom-login-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-dom-login-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-dom-login-001",
        getDocumentTitle: () => "白巧a - 小红书",
        getBodyText: () => "登录后查看更多内容 扫码登录 输入手机号",
        getPageStateRoot: () => null,
        readPageStateRoot: async () => null
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected user_home DOM fallback to stay closed");
    }
    expect(result.payload.details).toMatchObject({
      reason: "REQUEST_CONTEXT_MISSING"
    });
  });

  it("blocks detail account-abnormal api failures even when note state is still present", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-fallback-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-fallback-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-001",
        getPageStateRoot: () => null,
        readCapturedRequestContext: createRequestContextReader(createDetailRequestContext("note-001")),
        readPageStateRoot: async () => ({
          note: {
            noteDetailMap: {
              "note-001": {
                noteId: "note-001"
              }
            }
          }
        }),
        fetchJson: async () => ({
          status: 461,
          body: {
            code: "300011",
            msg: "account abnormal"
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected detail account-abnormal api failure envelope");
    }
    expect(result.payload.details).toMatchObject({
      reason: "ACCOUNT_ABNORMAL",
      status_code: 461,
      platform_code: 300011
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "request",
          outcome: "failed",
          failure_reason: "ACCOUNT_ABNORMAL"
        })
      ])
    );
  });

  it("uses detail DOM fallback when feed api returns gateway failure after the target note page is open", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-dom-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-dom-fallback-001",
          targetPage: "explore_detail_tab",
          overrides: {
            upstream_authorization_request: {
              action_request: {
                request_ref: "upstream_req_detail_dom_001",
                action_name: "xhs.read_note_detail",
                action_category: "read",
                requested_at: "2026-05-11T10:00:00.000Z"
              },
              resource_binding: {
                binding_ref: "binding_detail_dom_001",
                resource_kind: "profile_session",
                profile_ref: "xhs_001"
              },
              authorization_grant: {
                grant_ref: "grant_detail_dom_001",
                allowed_actions: ["xhs.read_note_detail"],
                binding_scope: {
                  allowed_resource_kinds: ["profile_session"],
                  allowed_profile_refs: ["xhs_001"]
                },
                target_scope: {
                  allowed_domains: ["www.xiaohongshu.com"],
                  allowed_pages: ["explore_detail_tab"]
                },
                approval_refs: ["approval_admission_run-detail-dom-fallback-001"],
                audit_refs: ["audit_admission_run-detail-dom-fallback-001"],
                resource_state_snapshot: "active",
                granted_at: "2026-05-11T10:00:00.000Z"
              },
              runtime_target: {
                target_ref: "target_detail_dom_001",
                domain: "www.xiaohongshu.com",
                page: "explore_detail_tab",
                tab_id: 32,
                url:
                  "https://www.xiaohongshu.com/search_result/note-dom-001?xsec_token=token-001&xsec_source=pc_search"
              }
            }
          }
        }),
        executionContext: createFallbackExecutionContext("run-detail-dom-fallback-001")
      },
      createEnvironment({
        getLocationHref: () =>
          "https://www.xiaohongshu.com/explore/note-dom-001?xsec_token=token-001&xsec_source=pc_search",
        getDocumentTitle: () => "无敌无敌爱的冷白皮！ - 小红书",
        getBodyText: () => "无敌无敌爱的冷白皮！ 作者 正文 评论",
        getPageStateRoot: () => null,
        readPageStateRoot: async () => null,
        readCapturedRequestContext: createRequestContextReader(createDetailRequestContext("note-dom-001")),
        fetchJson: async () => ({
          status: 500,
          body: {
            code: -1,
            msg: "网关调用失败"
          }
        })
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected detail DOM fallback success envelope");
    }
    expect(result.payload.summary.capability_result).toMatchObject({
      outcome: "success",
      data_ref: {
        note_id: "note-dom-001"
      }
    });
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "GATEWAY_INVOKER_FAILED",
      page_kind: "detail"
    });
    expect(result.payload.summary.request_admission_result).toMatchObject({
      admission_decision: "allowed",
      runtime_target_match: true
    });
  });

  it("blocks user_home env-abnormal api failures instead of converting them into page-state fallback", async () => {
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-fallback-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-fallback-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-001",
        getPageStateRoot: () => null,
        readCapturedRequestContext: createRequestContextReader(createUserHomeRequestContext("user-001")),
        readPageStateRoot: async () => ({
          user: {
            userId: "user-001"
          },
          board: {},
          note: {}
        }),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: "300015",
            msg: "browser environment abnormal"
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected user_home env-abnormal failure envelope");
    }
    expect(result.error).toMatchObject({ code: "ERR_EXECUTION_FAILED" });
    expect(result.payload.details).toMatchObject({
      reason: "BROWSER_ENV_ABNORMAL",
      status_code: 200,
      platform_code: 300015
    });
  });

  it("does not classify generic read api frequency warnings as account-risk pages", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-generic-warning-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-generic-warning-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-generic-warning-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-generic-warning-001",
        getPageStateRoot: () => null,
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-generic-warning-001")
        ),
        readPageStateRoot: async () => null,
        fetchJson: async () => ({
          status: 400,
          body: {
            code: -1,
            msg: "操作频繁，请稍后再试"
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected detail generic warning failure envelope");
    }
    expect(result.error).toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      message: "xhs.detail 接口返回了未识别的失败响应"
    });
    expect(result.payload.details).toMatchObject({
      reason: "TARGET_API_RESPONSE_INVALID",
      status_code: 400
    });
    expect(result.payload.observability).toMatchObject({
      key_requests: [
        expect.objectContaining({
          failure_reason: "TARGET_API_RESPONSE_INVALID"
        })
      ]
    });
  });

  it("does not classify bare read api 429 responses as account-risk without captcha evidence", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-generic-429-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-generic-429-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-generic-429-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-generic-429-001",
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-generic-429-001")
        ),
        readPageStateRoot: async () => null,
        fetchJson: async () => ({
          status: 429,
          body: {
            code: -1,
            msg: "操作频繁，请稍后再试"
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected generic 429 failure envelope");
    }
    expect(result.payload.details).toMatchObject({
      reason: "TARGET_API_RESPONSE_INVALID",
      status_code: 429
    });
    expect(result.payload.diagnosis).toMatchObject({
      category: "request_failed",
      failure_site: {
        target: "/api/sns/web/v1/feed"
      }
    });
  });

  it("uses detail page-state fallback when signature entry is unavailable but note state is still present", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-signature-fallback-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-signature-fallback-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-signature-fallback-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-signature-fallback-001",
        readCapturedRequestContext: createRequestContextReader(
          createDetailRequestContext("note-signature-fallback-001")
        ),
        readPageStateRoot: async () => ({
          note: {
            noteDetailMap: {
              "note-signature-fallback-001": {
                noteId: "note-signature-fallback-001"
              }
            }
          }
        }),
        callSignature: async () => {
          throw new Error("window._webmsxyw is not a function");
        }
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected signature fallback success envelope");
    }
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "SIGNATURE_ENTRY_MISSING",
      page_kind: "detail"
    });
    expect((result.payload.observability as Record<string, unknown>).key_requests).toEqual([
      expect.objectContaining({
        stage: "page_state_fallback",
        outcome: "completed",
        fallback_reason: "SIGNATURE_ENTRY_MISSING"
      })
    ]);
  });

  it("projects simulated signature-entry failures with page-change semantics for xhs.detail", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-simulated-signature-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-simulated-signature-001",
          targetPage: "explore_detail_tab",
          overrides: {
            simulate_result: "signature_entry_missing"
          }
        }),
        executionContext: createFallbackExecutionContext("run-detail-simulated-signature-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-simulated-signature-001"
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected simulated signature-entry failure");
    }
    expect(result.error).toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      message: "页面签名入口不可用"
    });
    expect(result.payload.details).toMatchObject({
      reason: "SIGNATURE_ENTRY_MISSING"
    });
    expect(result.payload.diagnosis).toMatchObject({
      category: "page_changed",
      failure_site: {
        target: "window._webmsxyw"
      }
    });
  });

  it("keeps simulated read failures bound to the real audit run/session/profile", async () => {
    const runId = "run-detail-simulated-failure-001";
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-simulated-failure-001"
        },
        options: createAdmittedLiveReadOptions({
          runId,
          targetPage: "explore_detail_tab",
          overrides: {
            simulate_result: "gateway_invoker_failed"
          }
        }),
        executionContext: createFallbackExecutionContext(runId)
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-simulated-failure-001"
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected simulated read failure");
    }
    expect(result.payload.gate_input).toMatchObject({
      run_id: runId,
      session_id: "nm-session-001",
      profile: "xhs_001"
    });
    expect(result.payload.audit_record).toMatchObject({
      run_id: runId,
      session_id: "nm-session-001",
      profile: "xhs_001"
    });
  });

  it("keeps detail execution failed when api fails and no fallback page state exists", async () => {
    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-404"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-no-fallback-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-no-fallback-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/explore/note-404",
        readCapturedRequestContext: createRequestContextReader(createDetailRequestContext("note-404")),
        fetchJson: async () => ({
          status: 500,
          body: {
            msg: "create invoker failed"
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected detail execution failure");
    }
    expect(result.error).toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      message: "网关调用失败，当前上下文不足以完成 xhs.detail 请求"
    });
  });

  it("falls back to sync page-state hook when request context is missing and readPageStateRoot is absent", async () => {
    const environment = createEnvironment({
      readPageStateRoot: undefined,
      getLocationHref: () => "https://www.xiaohongshu.com/explore/note-sync-001",
      getPageStateRoot: () => ({
        note: {
          noteDetailMap: {
            "note-sync-001": {
              noteId: "note-sync-001"
            }
          }
        }
      })
    });

    const result = await executeXhsDetail(
      {
        abilityId: "xhs.note.detail.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          note_id: "note-sync-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-detail-sync-fallback-001",
          targetPage: "explore_detail_tab"
        }),
        executionContext: createFallbackExecutionContext("run-detail-sync-fallback-001")
      },
      environment
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected sync fallback success envelope");
    }
    expect(result.payload.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      fallback_reason: "REQUEST_CONTEXT_MISSING",
      page_kind: "detail"
    });
  });

  it("keeps user_home execution failed when page-state user identity does not match requested user_id", async () => {
    const result = await executeXhsUserHome(
      {
        abilityId: "xhs.user.home.v1",
        abilityLayer: "L3",
        abilityAction: "read",
        params: {
          user_id: "user-001"
        },
        options: createAdmittedLiveReadOptions({
          runId: "run-user-mismatch-001",
          targetPage: "profile_tab"
        }),
        executionContext: createFallbackExecutionContext("run-user-mismatch-001")
      },
      createEnvironment({
        getLocationHref: () => "https://www.xiaohongshu.com/user/profile/user-001",
        getPageStateRoot: () => null,
        readCapturedRequestContext: createRequestContextReader(createUserHomeRequestContext("user-001")),
        readPageStateRoot: async () => ({
          user: {
            userId: "user-999"
          },
          board: {},
          note: {}
        }),
        fetchJson: async () => ({
          status: 200,
          body: {
            code: 300015,
            msg: "browser environment abnormal"
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected user_home execution failure");
    }
    expect(result.error).toMatchObject({
      code: "ERR_EXECUTION_FAILED",
      message: "浏览器环境异常，平台拒绝当前请求"
    });
  });
});
