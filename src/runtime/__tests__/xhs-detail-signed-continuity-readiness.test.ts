import { describe, expect, it } from "vitest";

import { evaluateXhsDetailSignedContinuityReadinessForContract } from "../xhs-detail-signed-continuity-readiness.js";

const expected = {
  note_id: "note-001",
  source_route: "xhs.search",
  xsec_source: "pc_search"
};

const validSignedContinuity = {
  source_url:
    "https://www.xiaohongshu.com/search_result?keyword=%E9%9C%B2%E8%90%A5",
  target_url:
    "https://www.xiaohongshu.com/explore/note-001?xsec_token=token-note-001&xsec_source=pc_search",
  detail_url:
    "https://www.xiaohongshu.com/explore/note-001?xsec_token=token-note-001&xsec_source=pc_search",
  xsec_token: "token-note-001",
  xsec_source: "pc_search",
  token_presence: "present",
  observed_at: 1710000000000,
  source_route: "xhs.search"
};

describe("evaluateXhsDetailSignedContinuityReadinessForContract", () => {
  it("passes when detail success consumes canonical search signed continuity", () => {
    expect(
      evaluateXhsDetailSignedContinuityReadinessForContract({
        expected,
        success: {
          summary: {
            signed_continuity: validSignedContinuity,
            route_evidence: {
              gate_decision: "allowed",
              route_evidence_class: "active_api_fetch_fallback",
              consumed_template: {
                route_evidence_class: "passive_api_capture"
              }
            }
          }
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      observed: {
        outcome: "success",
        source_route: "xhs.search",
        xsec_source: "pc_search",
        token_presence: "present",
        route_evidence_class: "active_api_fetch_fallback",
        consumed_template_route_evidence_class: "passive_api_capture"
      }
    });
  });

  it("passes when failure correctly classifies signed continuity invalid", () => {
    expect(
      evaluateXhsDetailSignedContinuityReadinessForContract({
        expected,
        failure: {
          error: {
            details: {
              reason: "XSEC_TOKEN_MISSING",
              request_context_result: "signed_continuity_invalid",
              signed_continuity: {
                ...validSignedContinuity,
                target_url:
                  "https://www.xiaohongshu.com/explore/note-001?xsec_source=pc_search",
                detail_url:
                  "https://www.xiaohongshu.com/explore/note-001?xsec_source=pc_search",
                xsec_token: null,
                token_presence: "missing"
              }
            }
          }
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      observed: {
        outcome: "signed_continuity_invalid",
        details_path: "error.details",
        request_context_result: "signed_continuity_invalid",
        reason: "XSEC_TOKEN_MISSING"
      }
    });
  });

  it("passes when failure correctly classifies request_context_missing", () => {
    expect(
      evaluateXhsDetailSignedContinuityReadinessForContract({
        expected,
        failure: {
          details: {
            reason: "template_missing",
            request_context_result: "request_context_missing"
          }
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      observed: {
        outcome: "request_context_missing",
        details_path: "details",
        request_context_result: "request_context_missing",
        reason: "template_missing"
      }
    });
  });

  it("fails when a signed continuity reason is downgraded to request_context_missing", () => {
    expect(
      evaluateXhsDetailSignedContinuityReadinessForContract({
        expected,
        failure: {
          details: {
            reason: "XSEC_TOKEN_STALE",
            request_context_result: "request_context_missing"
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "request_context_reason_misclassified"
        })
      ])
    });
  });

  it("fails when detail success tries to consume a non-search continuity source", () => {
    expect(
      evaluateXhsDetailSignedContinuityReadinessForContract({
        expected,
        success: {
          summary: {
            signed_continuity: {
              ...validSignedContinuity,
              source_route: "xhs.detail",
              xsec_source: "pc_note"
            },
            route_evidence: {
              gate_decision: "allowed",
              route_evidence_class: "active_api_fetch_fallback",
              consumed_template: {
                route_evidence_class: "passive_api_capture"
              }
            }
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "invalid_success_source_route" }),
        expect.objectContaining({ blocker_code: "invalid_success_xsec_source" })
      ])
    });
  });

  it("fails when detail success no longer proves a passive captured template", () => {
    expect(
      evaluateXhsDetailSignedContinuityReadinessForContract({
        expected,
        success: {
          summary: {
            signed_continuity: validSignedContinuity,
            route_evidence: {
              gate_decision: "allowed",
              route_evidence_class: "active_api_fetch_fallback",
              consumed_template: {
                route_evidence_class: "active_api_fetch_fallback"
              }
            }
          }
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "invalid_success_consumed_template"
        })
      ])
    });
  });
});
