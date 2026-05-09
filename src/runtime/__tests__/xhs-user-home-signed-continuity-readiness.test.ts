import { describe, expect, it } from "vitest";

import { evaluateXhsUserHomeSignedContinuityReadinessForContract } from "../xhs-user-home-signed-continuity-readiness.js";

const expected = {
  user_id: "user-home-001"
};

const successSummary = {
  capability_result: {
    outcome: "success"
  },
  route_evidence: {
    route_evidence_class: "active_api_fetch_fallback",
    consumed_template: {
      route_evidence_class: "passive_api_capture"
    }
  },
  signed_continuity: {
    user_home_url:
      "https://www.xiaohongshu.com/user/profile/user-home-001?xsec_token=token-001&xsec_source=pc_search",
    target_url:
      "https://www.xiaohongshu.com/user/profile/user-home-001?xsec_token=token-001&xsec_source=pc_search",
    source_route: "xhs.search",
    xsec_source: "pc_search",
    token_presence: "present",
    xsec_token: "token-001"
  }
};

describe("evaluateXhsUserHomeSignedContinuityReadinessForContract", () => {
  it("passes when user_home success consumes search-origin signed continuity through active fallback", () => {
    expect(
      evaluateXhsUserHomeSignedContinuityReadinessForContract({
        expected,
        summary: successSummary
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      observed: {
        route_evidence_class: "active_api_fetch_fallback",
        consumed_template_route_evidence_class: "passive_api_capture",
        source_route: "xhs.search",
        xsec_source: "pc_search",
        token_presence: "present",
        xsec_token_present: true,
        matched_user_id: expected.user_id
      }
    });
  });

  it("passes when fail-closed details classify signed continuity failures with signed reasons", () => {
    expect(
      evaluateXhsUserHomeSignedContinuityReadinessForContract({
        expected,
        summary: {
          details: {
            reason: "XSEC_TOKEN_STALE",
            request_context_result: "signed_continuity_invalid",
            signed_continuity: {
              user_home_url:
                "https://www.xiaohongshu.com/user/profile/user-home-001?xsec_token=token-001&xsec_source=pc_search",
              source_route: "xhs.search",
              xsec_source: "pc_search",
              token_presence: "present",
              xsec_token: "token-001"
            }
          }
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      observed: {
        request_context_result: "signed_continuity_invalid",
        failure_reason: "XSEC_TOKEN_STALE"
      }
    });
  });

  it("passes when request_context_missing uses a non-signed failure reason", () => {
    expect(
      evaluateXhsUserHomeSignedContinuityReadinessForContract({
        expected,
        summary: {
          details: {
            reason: "REQUEST_CONTEXT_MISSING",
            request_context_result: "request_context_missing"
          }
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      observed: {
        request_context_result: "request_context_missing",
        failure_reason: "REQUEST_CONTEXT_MISSING"
      }
    });
  });

  it("fails when request_context_missing is misclassified with a signed continuity reason", () => {
    expect(
      evaluateXhsUserHomeSignedContinuityReadinessForContract({
        expected,
        summary: {
          details: {
            reason: "XSEC_TOKEN_EMPTY",
            request_context_result: "request_context_missing"
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "request_context_missing_reused_signed_reason"
        })
      ])
    });
  });

  it("fails when success claims user_home readiness with a non-search signed source", () => {
    expect(
      evaluateXhsUserHomeSignedContinuityReadinessForContract({
        expected,
        summary: {
          ...successSummary,
          signed_continuity: {
            ...successSummary.signed_continuity,
            source_route: "xhs.detail",
            xsec_source: "pc_note"
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "signed_continuity_source_route_mismatch"
        }),
        expect.objectContaining({
          blocker_code: "signed_continuity_xsec_source_mismatch"
        })
      ])
    });
  });

  it("fails when active fallback does not disclose a passive consumed template", () => {
    expect(
      evaluateXhsUserHomeSignedContinuityReadinessForContract({
        expected,
        summary: {
          ...successSummary,
          route_evidence: {
            route_evidence_class: "active_api_fetch_fallback",
            consumed_template: {
              route_evidence_class: "active_api_fetch_fallback"
            }
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "consumed_template_not_passive_api_capture"
        })
      ])
    });
  });

  it("fails when success only carries a whitespace xsec_token", () => {
    expect(
      evaluateXhsUserHomeSignedContinuityReadinessForContract({
        expected,
        summary: {
          ...successSummary,
          signed_continuity: {
            ...successSummary.signed_continuity,
            xsec_token: "   "
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "signed_continuity_xsec_token_missing"
        })
      ])
    });
  });

  it("fails when success points at a non-canonical user_home host", () => {
    expect(
      evaluateXhsUserHomeSignedContinuityReadinessForContract({
        expected,
        summary: {
          ...successSummary,
          signed_continuity: {
            ...successSummary.signed_continuity,
            user_home_url:
              "https://example.com/user/profile/user-home-001?xsec_token=token-001&xsec_source=pc_search",
            target_url:
              "https://example.com/user/profile/user-home-001?xsec_token=token-001&xsec_source=pc_search"
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "signed_continuity_user_home_mismatch"
        })
      ])
    });
  });
});
