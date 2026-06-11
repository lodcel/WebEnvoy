import { describe, expect, it, vi } from "vitest";

import { executeXhsDetail } from "../extension/xhs-detail.js";
import { executeXhsSearch } from "../extension/xhs-search.js";
import type {
  SearchExecutionResult,
  XhsSearchEnvironment,
  XhsSearchOptions
} from "../extension/xhs-search-types.js";
import { executeXhsUserHome } from "../extension/xhs-user-home.js";

type ReadCommand = "xhs.search" | "xhs.detail" | "xhs.user_home";
type RouteBucket = "search" | "detail" | "user_home";
type MatrixCase = {
  command: ReadCommand;
  abilityId: string;
  routeBucket: RouteBucket;
  targetPage: "search_result_tab" | "explore_detail_tab" | "profile_tab";
  targetPageClass: "search_tab" | "explore_detail_tab" | "profile_tab";
  href: string;
  params: Record<string, unknown>;
  expectedProviderRequirementRef: string;
  execute: (
    input: Record<string, unknown>,
    env: XhsSearchEnvironment
  ) => Promise<SearchExecutionResult>;
};

const READ_COMMAND_CASES: MatrixCase[] = [
  {
    command: "xhs.search",
    abilityId: "xhs.note.search.v1",
    routeBucket: "search",
    targetPage: "search_result_tab",
    targetPageClass: "search_tab",
    href: "https://www.xiaohongshu.com/search_result?keyword=matrix",
    params: {
      query: "matrix"
    },
    expectedProviderRequirementRef: "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read",
    execute: (input, env) => executeXhsSearch(input as Parameters<typeof executeXhsSearch>[0], env)
  },
  {
    command: "xhs.detail",
    abilityId: "xhs.note.detail.v1",
    routeBucket: "detail",
    targetPage: "explore_detail_tab",
    targetPageClass: "explore_detail_tab",
    href: "https://www.xiaohongshu.com/explore/note-matrix-001",
    params: {
      note_id: "note-matrix-001"
    },
    expectedProviderRequirementRef: "FR-0061.xhs_driver_provider_requirements.v1/xhs.detail.read",
    execute: (input, env) => executeXhsDetail(input as Parameters<typeof executeXhsDetail>[0], env)
  },
  {
    command: "xhs.user_home",
    abilityId: "xhs.user.home.v1",
    routeBucket: "user_home",
    targetPage: "profile_tab",
    targetPageClass: "profile_tab",
    href: "https://www.xiaohongshu.com/user/profile/user-matrix-001",
    params: {
      user_id: "user-matrix-001"
    },
    expectedProviderRequirementRef:
      "FR-0061.xhs_driver_provider_requirements.v1/xhs.user_home.read",
    execute: (input, env) =>
      executeXhsUserHome(input as Parameters<typeof executeXhsUserHome>[0], env)
  }
];

const createApprovalRecord = () => ({
  approved: true,
  approver: "qa-reviewer",
  approved_at: "2026-06-11T08:00:00Z",
  checks: {
    target_domain_confirmed: true,
    target_tab_confirmed: true,
    target_page_confirmed: true,
    risk_state_checked: true,
    action_type_confirmed: true
  }
});

const createAdmissionContext = (matrixCase: MatrixCase, runId: string) => ({
  approval_admission_evidence: {
    approval_admission_ref: `approval_admission_${runId}`,
    run_id: runId,
    session_id: "nm-session-matrix",
    issue_scope: "issue_209",
    target_domain: "www.xiaohongshu.com",
    target_tab_id: 32,
    target_page: matrixCase.targetPage,
    action_type: "read",
    requested_execution_mode: "live_read_high_risk",
    approved: true,
    approver: "qa-reviewer",
    approved_at: "2026-06-11T08:00:00Z",
    checks: createApprovalRecord().checks,
    recorded_at: "2026-06-11T08:00:00Z"
  },
  audit_admission_evidence: {
    audit_admission_ref: `audit_admission_${runId}`,
    run_id: runId,
    session_id: "nm-session-matrix",
    issue_scope: "issue_209",
    target_domain: "www.xiaohongshu.com",
    target_tab_id: 32,
    target_page: matrixCase.targetPage,
    action_type: "read",
    requested_execution_mode: "live_read_high_risk",
    risk_state: "allowed",
    audited_checks: createApprovalRecord().checks,
    recorded_at: "2026-06-11T08:00:30Z"
  }
});

const createAuditRecord = (matrixCase: MatrixCase, runId: string) => ({
  event_id: `audit-${runId}`,
  issue_scope: "issue_209",
  target_domain: "www.xiaohongshu.com",
  target_tab_id: 32,
  target_page: matrixCase.targetPage,
  action_type: "read",
  requested_execution_mode: "live_read_high_risk",
  gate_decision: "allowed",
  recorded_at: "2026-06-11T08:00:30Z"
});

const createProviderAwareReadPathOptions = (matrixCase: MatrixCase, runId: string) => ({
  xhs_driver_provider_requirements: {
    declaration_id: `xhs-driver-provider-requirements:${matrixCase.command}:read:v1`,
    declaration_version: "v1",
    provider_requirement_ref: matrixCase.expectedProviderRequirementRef,
    provider_requirement_refs: [matrixCase.expectedProviderRequirementRef],
    ability_scope: {
      command: matrixCase.command,
      ability_id: matrixCase.abilityId,
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
  provider_requirement_refs: [matrixCase.expectedProviderRequirementRef],
  runtime_binding_ref: `FR-0061.xhs_runtime_binding.v1/${runId}/${matrixCase.routeBucket}`,
  target_binding_snapshot_ref: `FR-0063.target_binding_snapshot.v1/${runId}/${matrixCase.routeBucket}`,
  xhs_runtime_binding: {
    target_domain: "www.xiaohongshu.com",
    target_page: matrixCase.targetPageClass,
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
      target_page_class: matrixCase.targetPageClass
    },
    route_bucket: matrixCase.routeBucket,
    freshness_scope: "current_run",
    evidence_refs: {
      candidate_ref: `FR-0063.target_binding_candidate.v1/${runId}/${matrixCase.routeBucket}`,
      url_match_ref: `FR-0063.target_binding_url_match.v1/${runId}/${matrixCase.routeBucket}`,
      dom_observation_ref: `FR-0063.target_binding_dom_observation.v1/${runId}/${matrixCase.routeBucket}`,
      runtime_state_ref: `FR-0063.target_binding_runtime_state.v1/${runId}/${matrixCase.routeBucket}`,
      extension_bridge_ref: `FR-0063.target_binding_extension_bridge.v1/${runId}/${matrixCase.routeBucket}`,
      transition_refs: [`target-binding-transition:${runId}:${matrixCase.routeBucket}:bound`],
      evidence_status: "complete",
      evidence_completeness: "complete",
      redaction_state: "redacted",
      source_owner: "#1161"
    },
    blocking_reasons: []
  },
  target_binding_transition_evidence: [
    {
      transition_id: `target-binding-transition:${runId}:${matrixCase.routeBucket}:bound`,
      from_state: "candidate_found",
      to_state: "bound"
    }
  ],
  downstream_slice_refs: ["#1162", "#1166", "#1167", "#1168"],
  non_proofs: ["syvert_normalized_result_complete", "write_enabled"],
  page_runtime_readiness_ref: `issue-1162.xhs_page_runtime_readiness.v1/${runId}`,
  xhs_page_runtime_readiness: {
    owner_ref: "#1162",
    command: matrixCase.command,
    run_id: runId,
    page_readiness: {
      status: "ready",
      required: true,
      blocking_reasons: []
    },
    runtime_readiness: {
      status: "ready",
      required: true,
      source: "official_chrome_runtime_readiness",
      blocking_reasons: []
    },
    provider_admission_readiness: {
      status: "ready",
      required: true,
      source: "provider_admission_result",
      blocking_reasons: []
    },
    overall_readiness: "ready",
    gate_decision: "allow"
  },
  page_runtime_readiness_decision: "allow",
  page_runtime_readiness_blocking_reasons: []
});

const createAdmittedLiveReadOptions = (
  matrixCase: MatrixCase,
  runId: string,
  overrides?: Partial<XhsSearchOptions>
): XhsSearchOptions =>
  ({
    issue_scope: "issue_209",
    target_domain: "www.xiaohongshu.com",
    target_tab_id: 32,
    target_page: matrixCase.targetPage,
    actual_target_domain: "www.xiaohongshu.com",
    actual_target_tab_id: 32,
    actual_target_page: matrixCase.targetPage,
    action_type: "read",
    requested_execution_mode: "live_read_high_risk",
    risk_state: "allowed",
    approval: createApprovalRecord(),
    approval_record: createApprovalRecord(),
    admission_context: createAdmissionContext(matrixCase, runId),
    audit_record: createAuditRecord(matrixCase, runId),
    ...createProviderAwareReadPathOptions(matrixCase, runId),
    ...(overrides ?? {})
  }) as XhsSearchOptions;

const createEnvironment = (
  matrixCase: MatrixCase,
  input?: Partial<XhsSearchEnvironment>
): XhsSearchEnvironment => ({
  now: () => 1_710_000_000_000,
  randomId: () => "matrix-req-001",
  getLocationHref: () => matrixCase.href,
  getDocumentTitle: () => "XHS matrix",
  getReadyState: () => "complete",
  getCookie: () => "a1=session-cookie",
  callSignature: async () => ({ "X-s": "signature", "X-t": "1710000000" }),
  fetchJson: async () => ({ status: 200, body: { code: 0 } }),
  ...input
});

const executeMatrixCase = async (
  matrixCase: MatrixCase,
  input: {
    runId: string;
    options?: Partial<XhsSearchOptions>;
    env?: Partial<XhsSearchEnvironment>;
  }
) => {
  const callSignature = vi.fn(async () => ({ "X-s": "signature", "X-t": "1710000000" }));
  const fetchJson = vi.fn(async () => ({ status: 200, body: { code: 0 } }));
  const env = createEnvironment(matrixCase, {
    callSignature,
    fetchJson,
    ...(input.env ?? {})
  });
  const result = await matrixCase.execute(
    {
      abilityId: matrixCase.abilityId,
      abilityLayer: "L3",
      abilityAction: "read",
      params: matrixCase.params,
      options: createAdmittedLiveReadOptions(matrixCase, input.runId, input.options),
      executionContext: {
        runId: input.runId,
        sessionId: "nm-session-matrix",
        profile: "xhs_001",
        requestId: `request-${input.runId}`,
        gateInvocationId: `issue209-gate-${input.runId}`
      }
    },
    env
  );

  return { result, callSignature, fetchJson };
};

const expectProviderAwareBlock = (
  result: SearchExecutionResult,
  expectedReasons: string[]
): void => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected provider-aware read path block");
  }
  expect(result.error).toMatchObject({
    code: "ERR_EXECUTION_FAILED"
  });
  expect(result.payload.details).toMatchObject({
    reason: "PROVIDER_AWARE_READINESS_DENIED",
    blocking_reasons: expect.arrayContaining(expectedReasons)
  });
  expect(result.payload.provider_aware_read_path_gate).toMatchObject({
    gate_decision: "blocked",
    live_execution_continued: false,
    effective_execution_mode: null,
    blocking_reasons: expect.arrayContaining(expectedReasons)
  });
  expect(result.payload.consumer_gate_result).toMatchObject({
    gate_decision: "blocked",
    effective_execution_mode: null,
    gate_reasons: expect.arrayContaining([
      "PROVIDER_AWARE_READINESS_DENIED",
      "PROVIDER_AWARE_LIVE_READ_NOT_CONTINUED"
    ])
  });
  expect(result.payload.summary).toBeUndefined();
};

describe("XHS read driver regression matrix", () => {
  it.each(READ_COMMAND_CASES)(
    "fail-closes $command when provider-aware artifacts are missing",
    async (matrixCase) => {
      const { result, callSignature, fetchJson } = await executeMatrixCase(matrixCase, {
        runId: `run-1173-missing-${matrixCase.routeBucket}`,
        options: {
          xhs_driver_provider_requirements: undefined,
          provider_requirement_refs: undefined,
          runtime_binding_ref: undefined,
          target_binding_snapshot_ref: undefined,
          xhs_runtime_binding: undefined,
          target_binding_snapshot: undefined,
          target_binding_transition_evidence: undefined,
          xhs_page_runtime_readiness: undefined,
          page_runtime_readiness_ref: undefined,
          page_runtime_readiness_decision: undefined,
          page_runtime_readiness_blocking_reasons: undefined,
          simulate_result: "success"
        }
      });

      expectProviderAwareBlock(result, [
        "target_binding_snapshot_missing",
        "target_binding_snapshot_ref_missing",
        "xhs_driver_provider_requirements_missing",
        "provider_requirement_refs_missing",
        "page_runtime_readiness_missing",
        "runtime_binding_ref_missing",
        "runtime_binding_evidence_missing",
        "page_readiness_missing",
        "runtime_readiness_missing",
        "provider_admission_result_missing"
      ]);
      expect(callSignature).not.toHaveBeenCalled();
      expect(fetchJson).not.toHaveBeenCalled();
    }
  );

  it.each(READ_COMMAND_CASES)(
    "fail-closes $command on page/runtime/provider readiness denial before simulated success",
    async (matrixCase) => {
      const runId = `run-1173-readiness-${matrixCase.routeBucket}`;
      const providerAwareOptions = createProviderAwareReadPathOptions(matrixCase, runId);
      const { result, callSignature, fetchJson } = await executeMatrixCase(matrixCase, {
        runId,
        options: {
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
            runtime_readiness: {
              status: "pending",
              required: true,
              source: "official_chrome_runtime_readiness",
              blocking_reasons: ["runtime_status_missing"]
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
            "runtime:runtime_status_missing",
            "provider:provider_requirement_refs_not_attested"
          ]
        }
      });

      expectProviderAwareBlock(result, [
        "target_binding:target_binding_not_bound",
        "target_binding_state:candidate_found",
        "page:blocked",
        "runtime:pending",
        "provider:blocked",
        "page_runtime_gate:deny",
        "page_runtime_readiness_decision:deny"
      ]);
      expect(callSignature).not.toHaveBeenCalled();
      expect(fetchJson).not.toHaveBeenCalled();
    }
  );

  it.each(READ_COMMAND_CASES)(
    "fail-closes $command on stale runtime binding and previous-run target evidence refs",
    async (matrixCase) => {
      const runId = `run-1173-stale-${matrixCase.routeBucket}`;
      const previousRunId = `previous-${runId}`;
      const providerAwareOptions = createProviderAwareReadPathOptions(matrixCase, runId);
      const previousRunOptions = createProviderAwareReadPathOptions(matrixCase, previousRunId);
      const { result, callSignature, fetchJson } = await executeMatrixCase(matrixCase, {
        runId,
        options: {
          runtime_binding_ref: previousRunOptions.runtime_binding_ref,
          xhs_runtime_binding: {
            ...providerAwareOptions.xhs_runtime_binding,
            binding_freshness: "historical_background"
          },
          target_binding_snapshot_ref: previousRunOptions.target_binding_snapshot_ref,
          target_binding_snapshot: {
            ...previousRunOptions.target_binding_snapshot,
            freshness_scope: "historical_background"
          },
          target_binding_transition_evidence:
            previousRunOptions.target_binding_transition_evidence,
          xhs_page_runtime_readiness: {
            ...providerAwareOptions.xhs_page_runtime_readiness,
            run_id: previousRunId
          }
        }
      });

      expectProviderAwareBlock(result, [
        "runtime_binding_ref_mismatch",
        "runtime_binding_stale",
        "runtime_binding_freshness:historical_background",
        "target_binding_ref_mismatch",
        "target_binding_run_id_mismatch",
        "page_runtime_readiness_run_id_mismatch",
        "target_binding_freshness_stale",
        "target_binding_freshness:historical_background",
        "target_binding_evidence_ref_mismatch"
      ]);
      expect(callSignature).not.toHaveBeenCalled();
      expect(fetchJson).not.toHaveBeenCalled();
    }
  );

  it.each(READ_COMMAND_CASES)(
    "fail-closes $command when provider and target evidence are scoped to another read route",
    async (matrixCase) => {
      const donorCase = READ_COMMAND_CASES.find((candidate) => candidate.command !== matrixCase.command);
      if (!donorCase) {
        throw new Error("missing donor read command case");
      }
      const runId = `run-1173-route-mismatch-${matrixCase.routeBucket}`;
      const donorOptions = createProviderAwareReadPathOptions(donorCase, runId);
      const { result, callSignature, fetchJson } = await executeMatrixCase(matrixCase, {
        runId,
        options: donorOptions
      });

      expectProviderAwareBlock(result, [
        "provider_requirement_ref_mismatch",
        "provider_requirement_scope_mismatch",
        "runtime_binding_ref_mismatch",
        "runtime_binding_scope_mismatch",
        `target_binding_ref_route:${donorCase.routeBucket}`,
        "target_binding_scope_mismatch"
      ]);
      expect(callSignature).not.toHaveBeenCalled();
      expect(fetchJson).not.toHaveBeenCalled();
    }
  );

  it.each(READ_COMMAND_CASES)(
    "keeps fallback evidence from replacing provider-aware readiness for $command",
    async (matrixCase) => {
      const runId = `run-1173-fallback-boundary-${matrixCase.routeBucket}`;
      const readPageStateRoot = vi.fn(async () => ({
        notes: {
          "note-matrix-001": {
            noteId: "note-matrix-001",
            title: "fallback note"
          }
        },
        basic_info: {
          user_id: "user-matrix-001"
        }
      }));
      const readSearchDomState = vi.fn(async () => ({
        cards: [
          {
            title: "fallback search card",
            note_id: "note-matrix-001",
            user_id: "user-matrix-001",
            detail_url:
              "https://www.xiaohongshu.com/explore/note-matrix-001?xsec_token=token&xsec_source=pc_search",
            user_home_url:
              "https://www.xiaohongshu.com/user/profile/user-matrix-001?xsec_token=token&xsec_source=pc_search"
          }
        ]
      }));
      const providerAwareOptions = createProviderAwareReadPathOptions(matrixCase, runId);
      const { result, callSignature, fetchJson } = await executeMatrixCase(matrixCase, {
        runId,
        options: {
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
            overall_readiness: "blocked",
            gate_decision: "deny"
          },
          page_runtime_readiness_decision: "deny",
          page_runtime_readiness_blocking_reasons: ["page:target_binding_not_bound"]
        },
        env: {
          readPageStateRoot,
          readSearchDomState
        }
      });

      expectProviderAwareBlock(result, [
        "target_binding:target_binding_not_bound",
        "page_runtime_gate:deny"
      ]);
      expect(result.payload.summary).toBeUndefined();
      expect(result.payload).not.toMatchObject({
        summary: {
          route_evidence: {
            evidence_class: "page_state_fallback"
          }
        }
      });
      expect(readPageStateRoot).not.toHaveBeenCalled();
      expect(readSearchDomState).not.toHaveBeenCalled();
      expect(callSignature).not.toHaveBeenCalled();
      expect(fetchJson).not.toHaveBeenCalled();
    }
  );
});
