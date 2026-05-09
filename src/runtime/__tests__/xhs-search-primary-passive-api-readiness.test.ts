import { describe, expect, it } from "vitest";

import { evaluateXhsSearchPrimaryPassiveApiReadinessForContract } from "../xhs-search-primary-passive-api-readiness.js";

const expectedBinding = {
  query: "露营装备",
  profile_ref: "profile/xhs_closeout_001",
  target_tab_id: 32,
  page_url: "https://www.xiaohongshu.com/search_result?keyword=%E9%9C%B2%E8%90%A5%E8%A3%85%E5%A4%87",
  run_id: "run-closeout-001",
  action_ref: "action/xhs.search/submit_query"
};

const routeEvidence = {
  route: "xhs.search.api",
  route_role: "primary",
  path_kind: "api",
  evidence_status: "success",
  evidence_class: "passive_api_capture",
  profile_ref: expectedBinding.profile_ref,
  target_tab_id: expectedBinding.target_tab_id,
  page_url: expectedBinding.page_url,
  run_id: expectedBinding.run_id,
  action_ref: expectedBinding.action_ref
};

const requestContext = {
  status: "exact_hit",
  query: expectedBinding.query,
  action_ref: expectedBinding.action_ref,
  profile_ref: expectedBinding.profile_ref,
  target_tab_id: expectedBinding.target_tab_id,
  page_url: expectedBinding.page_url,
  run_id: expectedBinding.run_id
};

describe("evaluateXhsSearchPrimaryPassiveApiReadinessForContract", () => {
  it("passes when same-query passive API evidence is exact-hit and fully bound", () => {
    expect(
      evaluateXhsSearchPrimaryPassiveApiReadinessForContract({
        expected: expectedBinding,
        summary: {
          route_evidence: routeEvidence,
          request_context: requestContext
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      observed: {
        request_context_status: "exact_hit",
        route_evidence_class: "passive_api_capture",
        query: expectedBinding.query,
        action_ref: expectedBinding.action_ref
      }
    });
  });

  it("passes when the search is triggered through the Enter fallback with matching action/query", () => {
    const enterExpected = {
      ...expectedBinding,
      action_ref: "action/xhs.search/submit_enter"
    };

    expect(
      evaluateXhsSearchPrimaryPassiveApiReadinessForContract({
        expected: enterExpected,
        summary: {
          route_evidence: {
            ...routeEvidence,
            action_ref: enterExpected.action_ref
          },
          request_context: {
            ...requestContext,
            action_ref: enterExpected.action_ref
          }
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: []
    });
  });

  it("fails closed on target drift across profile, tab, page, run, query, or action", () => {
    expect(
      evaluateXhsSearchPrimaryPassiveApiReadinessForContract({
        expected: expectedBinding,
        summary: {
          route_evidence: {
            ...routeEvidence,
            profile_ref: "profile/other_profile",
            target_tab_id: 99,
            page_url: "https://www.xiaohongshu.com/search_result?keyword=%E5%B8%90%E7%AF%B7",
            run_id: "run-other-001",
            action_ref: "action/xhs.search/submit_enter"
          },
          request_context: {
            ...requestContext,
            query: "帐篷",
            action_ref: "action/xhs.search/submit_enter"
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "missing_profile_binding" }),
        expect.objectContaining({ blocker_code: "missing_tab_binding" }),
        expect.objectContaining({ blocker_code: "missing_run_binding" }),
        expect.objectContaining({ blocker_code: "missing_page_binding" }),
        expect.objectContaining({ blocker_code: "action_mismatch" }),
        expect.objectContaining({ blocker_code: "query_mismatch" })
      ])
    });
  });

  it("fails when a risk surface is present even if passive route fields look successful", () => {
    expect(
      evaluateXhsSearchPrimaryPassiveApiReadinessForContract({
        expected: expectedBinding,
        summary: {
          route_evidence: {
            ...routeEvidence,
            risk_surface_classification: "CAPTCHA_REQUIRED"
          },
          request_context: requestContext
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "risk_surface_detected" })
      ])
    });
  });

  it("fails when passive exact hit is missing or active fetch fallback is declared", () => {
    expect(
      evaluateXhsSearchPrimaryPassiveApiReadinessForContract({
        expected: expectedBinding,
        summary: {
          route_evidence: routeEvidence,
          request_context: {
            ...requestContext,
            status: "fuzzy_hit"
          },
          active_api_fetch_fallback: {
            gate: "declared"
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "request_context_not_exact_hit" }),
        expect.objectContaining({ blocker_code: "active_fetch_fallback_declared" })
      ])
    });
  });

  it("fails when the observed passive route is not the xhs.search API route", () => {
    expect(
      evaluateXhsSearchPrimaryPassiveApiReadinessForContract({
        expected: expectedBinding,
        summary: {
          route_evidence: {
            ...routeEvidence,
            route: "xhs.detail.api"
          },
          request_context: requestContext
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "non_search_route" })
      ])
    });
  });

  it("fails when route_evidence is present but route id is missing", () => {
    const malformedRouteEvidence = { ...routeEvidence };
    delete (malformedRouteEvidence as { route?: string }).route;

    expect(
      evaluateXhsSearchPrimaryPassiveApiReadinessForContract({
        expected: expectedBinding,
        summary: {
          route_evidence: malformedRouteEvidence,
          request_context: requestContext
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "missing_route_id" })
      ])
    });
  });

  it("fails when request_context binding is stale even if route_evidence still matches", () => {
    expect(
      evaluateXhsSearchPrimaryPassiveApiReadinessForContract({
        expected: expectedBinding,
        summary: {
          route_evidence: routeEvidence,
          request_context: {
            ...requestContext,
            profile_ref: "profile/other_profile",
            target_tab_id: 64,
            run_id: "run-other-001"
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "missing_profile_binding" }),
        expect.objectContaining({ blocker_code: "missing_tab_binding" }),
        expect.objectContaining({ blocker_code: "missing_run_binding" })
      ])
    });
  });
});
