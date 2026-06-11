import { describe, expect, it } from "vitest";

import {
  evaluateXhsCloseoutEvidenceBoundary,
  XHS_CLOSEOUT_EVIDENCE_CONTRACT_VERSION,
  XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS,
  XHS_CLOSEOUT_REQUIRED_ROUTE_FIELDS
} from "../xhs-closeout-evidence-boundary.js";

const createdAt = "2026-06-11T00:00:00Z";

const baseRouteEvidence = (): Record<string, unknown> => ({
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
  run_id: "run-xhs-closeout-boundary-001",
  artifact_identity: "artifact:xhs-closeout:run-xhs-closeout-boundary-001:round-1",
  profile_ref: "profile-ref:xhs:redacted",
  session_id: "session-ref:xhs:redacted",
  target_tab_id: 42,
  page_url: "https://www.xiaohongshu.com/explore/note-closeout-001",
  action_ref: "read",
  observed_at: 1_780_000_000_000,
  captured_at: 1_780_000_000_000,
  consumed_template: {
    route_evidence_class: "passive_api_capture",
    source_kind: "page_request",
    template_identity: "captured:run-xhs-closeout-boundary-001:detail:shape:1780000000000",
    profile_ref: "profile-ref:xhs:redacted",
    session_id: "session-ref:xhs:redacted",
    target_tab_id: 42,
    run_id: "run-xhs-closeout-boundary-001",
    action_ref: "read",
    page_url: "https://www.xiaohongshu.com/explore/note-closeout-001",
    observed_at: 1_780_000_000_000,
    captured_at: 1_780_000_000_000,
    freshness_window_ms: 300_000,
    template_age_ms: 0,
    page_context_namespace: "xhs.detail:profile-ref:xhs:redacted:42",
    shape_key: "xhs.detail:POST:/api/sns/web/v1/feed:note-closeout-001"
  },
  provider_requirement_refs: [
    "FR-0061.xhs_driver_provider_requirements.v1/xhs.detail.read"
  ]
});

const evidenceRef = (kind: string, overrides: Record<string, unknown> = {}) => ({
  evidence_ref_id: `ev-${kind}`,
  kind,
  ref: `${kind}:xhs:redacted`,
  source: kind === "provider_contract_ref" ? "provider_contract" : "runtime_admission",
  status: "available",
  collected_at: createdAt,
  freshness: "current_pr_head",
  sensitivity: kind === "provider_contract_ref" || kind === "launch_envelope_ref" ? "public" : "sensitive",
  redaction_state: kind === "provider_contract_ref" || kind === "launch_envelope_ref" ? "not_required" : "redacted",
  artifact_identity: kind === "closeout_artifact_ref" ? "artifact:xhs-closeout:run-xhs-closeout-boundary-001:round-1" : null,
  ...overrides
});

const baseProviderEvidenceRecord = (): Record<string, unknown> => ({
  identity: {
    provider_evidence_record_id: "per-xhs-closeout-boundary-001",
    provider_evidence_contract_version: "v1",
    run_id: "run-xhs-closeout-boundary-001",
    command_ref: "xhs.detail",
    created_at: createdAt,
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
    selection_evidence_refs: ["ev-provider_contract_ref"]
  },
  evidence_refs: XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS.map((kind) => evidenceRef(kind)),
  closeout_plan: {
    required_evidence_kinds: [...XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS],
    required_freshness: "current_pr_head",
    minimum_attestation_level: "runtime_attested",
    coverage_status: "complete",
    blocking_reasons: [],
    missing_evidence: [],
    redaction_gaps: [],
    next_required_gates: ["route_evidence_evaluator"],
    closeout_decision: "allow"
  }
});

describe("XHS closeout evidence boundary for #1164", () => {
  it("admits a provider-aware passive API capture bundle without raw sensitive values", () => {
    const evaluation = evaluateXhsCloseoutEvidenceBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation).toMatchObject({
      contract_version: XHS_CLOSEOUT_EVIDENCE_CONTRACT_VERSION,
      valid: true,
      operation: "xhs.detail",
      route_evidence_class: "passive_api_capture",
      provider_evidence_scope: "capability_closeout",
      missing_route_fields: [],
      missing_provider_evidence_kinds: [],
      redaction_gaps: [],
      forbidden_disclosures: [],
      blockers: []
    });
  });

  it("keeps the required route field set stable for the later route evidence evaluator", () => {
    expect([...XHS_CLOSEOUT_REQUIRED_ROUTE_FIELDS]).toEqual([
      "route_role",
      "path_kind",
      "evidence_status",
      "evidence_class",
      "route_evidence_class",
      "method",
      "endpoint",
      "status_code",
      "head_sha",
      "run_id",
      "artifact_identity",
      "profile_ref",
      "session_id",
      "target_tab_id",
      "page_url",
      "action_ref",
      "consumed_template"
    ]);
  });

  it("fails closed when an active API fetch fallback route is offered as closeout evidence", () => {
    const routeEvidence = baseRouteEvidence();
    routeEvidence.evidence_class = "active_api_fetch_fallback";
    routeEvidence.route_evidence_class = "active_api_fetch_fallback";

    expect(
      evaluateXhsCloseoutEvidenceBoundary({
        operation: "xhs.detail",
        route_evidence: routeEvidence,
        provider_evidence_record: baseProviderEvidenceRecord()
      })
    ).toMatchObject({
      valid: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "unsupported_route_evidence_class",
          blocker_layer: "route"
        })
      ])
    });
  });

  it("reports missing required route fields instead of treating partial driver summaries as closeout evidence", () => {
    const routeEvidence = baseRouteEvidence();
    delete routeEvidence.head_sha;
    delete routeEvidence.artifact_identity;
    delete routeEvidence.profile_ref;

    const evaluation = evaluateXhsCloseoutEvidenceBoundary({
      operation: "xhs.user_home",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.missing_route_fields).toEqual([
      "artifact_identity",
      "head_sha",
      "profile_ref"
    ]);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker_code: "missing_route_field", field: "route_evidence.head_sha" }),
        expect.objectContaining({ blocker_code: "missing_route_field", field: "route_evidence.artifact_identity" }),
        expect.objectContaining({ blocker_code: "missing_route_field", field: "route_evidence.profile_ref" })
      ])
    );
  });

  it("requires FR-0040 capability_closeout provider evidence and all XHS provider evidence refs", () => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.identity = {
      ...(providerEvidence.identity as Record<string, unknown>),
      evidence_scope: "runtime_admission"
    };
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).filter(
      (ref) => ref.kind !== "native_messaging_binding_ref"
    );

    const evaluation = evaluateXhsCloseoutEvidenceBoundary({
      operation: "xhs.search",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.provider_evidence_scope).toBe("runtime_admission");
    expect(evaluation.missing_provider_evidence_kinds).toEqual(["native_messaging_binding_ref"]);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker_code: "provider_evidence_scope_invalid" }),
        expect.objectContaining({ blocker_code: "provider_evidence_kind_missing" })
      ])
    );
  });

  it("blocks provider evidence redaction gaps from satisfying the boundary", () => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) =>
      ref.kind === "profile_binding_ref"
        ? {
            ...ref,
            ref: "/Users/example/Library/Application Support/Chrome/Profile 1",
            redaction_state: "policy_missing"
          }
        : ref
    );
    providerEvidence.closeout_plan = {
      ...(providerEvidence.closeout_plan as Record<string, unknown>),
      coverage_status: "blocked",
      blocking_reasons: ["redaction_policy_missing"],
      redaction_gaps: ["ev-profile_binding_ref"],
      closeout_decision: "deny"
    };

    const evaluation = evaluateXhsCloseoutEvidenceBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.redaction_gaps).toContain("ev-profile_binding_ref");
    expect(evaluation.forbidden_disclosures).toContain("provider_evidence_record.evidence_refs[2].ref");
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker_code: "provider_evidence_closeout_denied" }),
        expect.objectContaining({ blocker_code: "provider_evidence_redaction_invalid" }),
        expect.objectContaining({ blocker_code: "raw_sensitive_value_detected" })
      ])
    );
  });

  it("rejects raw XHS tokens, cookies, headers, and request payloads on the disclosure surface", () => {
    const routeEvidence = baseRouteEvidence();
    routeEvidence.page_url =
      "https://www.xiaohongshu.com/explore/note-closeout-001?xsec_token=raw-token";
    routeEvidence.consumed_template = {
      ...(routeEvidence.consumed_template as Record<string, unknown>),
      request: {
        headers: {
          Cookie: "a1=raw-cookie",
          "X-S-Common": "raw-common"
        },
        body: {
          api_key: "raw-key"
        }
      }
    };

    const evaluation = evaluateXhsCloseoutEvidenceBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.forbidden_disclosures).toEqual(
      expect.arrayContaining([
        "route_evidence.page_url",
        "route_evidence.consumed_template.request.headers.Cookie",
        "route_evidence.consumed_template.request.headers.X-S-Common",
        "route_evidence.consumed_template.request.body.api_key"
      ])
    );
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker_code: "raw_sensitive_value_detected" })
      ])
    );
  });
});
