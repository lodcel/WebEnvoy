import { describe, expect, it } from "vitest";

import {
  evaluateCloseoutRequiredHeadersMatrix,
  type EvaluateCloseoutRequiredHeadersMatrixInput
} from "../closeout-required-headers-matrix.js";

const baseInput = (): EvaluateCloseoutRequiredHeadersMatrixInput => ({
  matrix: {
    routes: [
      {
        route_id: "xhs.search",
        required_headers: ["X-S", "X-T", "Cookie"],
        minimality_evidence: [
          {
            header_name: "X-S",
            proof_kind: "negative_omission_probe",
            result: "blocked_or_failed",
            artifact_ref: "artifact://search/missing-x-s"
          },
          {
            header_name: "X-T",
            proof_kind: "negative_omission_probe",
            result: "blocked_or_failed",
            artifact_ref: "artifact://search/missing-x-t"
          },
          {
            header_name: "Cookie",
            proof_kind: "contracted_platform_requirement",
            result: "contracted_required",
            artifact_ref: "artifact://search/cookie-contract"
          }
        ]
      },
      {
        route_id: "xhs.detail",
        required_headers: ["X-S", "X-T", "Referer"],
        minimality_evidence: [
          {
            header_name: "X-S",
            proof_kind: "negative_omission_probe",
            result: "blocked_or_failed",
            artifact_ref: "artifact://detail/missing-x-s"
          },
          {
            header_name: "X-T",
            proof_kind: "negative_omission_probe",
            result: "blocked_or_failed",
            artifact_ref: "artifact://detail/missing-x-t"
          },
          {
            header_name: "Referer",
            proof_kind: "contracted_platform_requirement",
            result: "contracted_required",
            artifact_ref: "artifact://detail/referer-contract"
          }
        ]
      },
      {
        route_id: "xhs.user_home",
        required_headers: ["X-S", "X-T", "User-Agent"],
        minimality_evidence: [
          {
            header_name: "X-S",
            proof_kind: "negative_omission_probe",
            result: "blocked_or_failed",
            artifact_ref: "artifact://user-home/missing-x-s"
          },
          {
            header_name: "X-T",
            proof_kind: "negative_omission_probe",
            result: "blocked_or_failed",
            artifact_ref: "artifact://user-home/missing-x-t"
          },
          {
            header_name: "User-Agent",
            proof_kind: "contracted_platform_requirement",
            result: "contracted_required",
            artifact_ref: "artifact://user-home/user-agent-contract"
          }
        ]
      }
    ]
  },
  observed_routes: [
    {
      route_id: "xhs.search",
      headers: {
        "x-s": "redacted-search-xs",
        "X-T": "redacted-search-xt",
        COOKIE: "redacted-search-cookie"
      }
    },
    {
      route_id: "xhs.detail",
      headers: {
        "X-S": "redacted-detail-xs",
        "x-t": "redacted-detail-xt",
        referer: "https://www.xiaohongshu.com/explore/redacted"
      }
    },
    {
      route_id: "xhs.user_home",
      headers: {
        "x-s": "redacted-user-xs",
        "x-t": "redacted-user-xt",
        "user-agent": "Mozilla/5.0 redacted"
      }
    }
  ]
});

const expectNoHeaderValueLeak = (result: unknown): void => {
  expect(JSON.stringify(result)).not.toContain("redacted-search-xs");
  expect(JSON.stringify(result)).not.toContain("redacted-detail-xt");
  expect(JSON.stringify(result)).not.toContain("Mozilla/5.0 redacted");
};

describe("closeout required headers matrix verifier", () => {
  it("passes all route checks with case-insensitive header names and redacted output", () => {
    const result = evaluateCloseoutRequiredHeadersMatrix(baseInput());

    expect(result).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: [],
      route_results: [
        {
          route_id: "xhs.search",
          decision: "PASS",
          passed: true,
          required_headers: ["cookie", "x-s", "x-t"],
          observed_header_names: ["cookie", "x-s", "x-t"],
          observed_browser_headers: ["cookie", "x-s", "x-t"],
          minimal_required_headers: ["cookie", "x-s", "x-t"],
          minimality_evidence_headers: ["cookie", "x-s", "x-t"],
          minimality_evidence_artifact_refs: [
            "artifact://search/cookie-contract",
            "artifact://search/missing-x-s",
            "artifact://search/missing-x-t"
          ],
          missing_headers: [],
          empty_headers: [],
          missing_minimality_evidence: [],
          blockers: []
        },
        {
          route_id: "xhs.detail",
          decision: "PASS",
          passed: true,
          required_headers: ["referer", "x-s", "x-t"],
          observed_header_names: ["referer", "x-s", "x-t"],
          observed_browser_headers: ["referer", "x-s", "x-t"],
          minimal_required_headers: ["referer", "x-s", "x-t"],
          minimality_evidence_headers: ["referer", "x-s", "x-t"],
          minimality_evidence_artifact_refs: [
            "artifact://detail/missing-x-s",
            "artifact://detail/missing-x-t",
            "artifact://detail/referer-contract"
          ]
        },
        {
          route_id: "xhs.user_home",
          decision: "PASS",
          passed: true,
          required_headers: ["user-agent", "x-s", "x-t"],
          observed_header_names: ["user-agent", "x-s", "x-t"],
          observed_browser_headers: ["user-agent", "x-s", "x-t"],
          minimal_required_headers: ["user-agent", "x-s", "x-t"],
          minimality_evidence_headers: ["user-agent", "x-s", "x-t"],
          minimality_evidence_artifact_refs: [
            "artifact://user-home/missing-x-s",
            "artifact://user-home/missing-x-t",
            "artifact://user-home/user-agent-contract"
          ]
        }
      ],
      summary: {
        matrix_present: true,
        observed_routes_present: true,
        total_routes: 3,
        passed_routes: 3,
        failed_routes: 0,
        blocker_count: 0
      },
      trace: {
        matrix_route_ids: ["xhs.detail", "xhs.search", "xhs.user_home"],
        observed_route_ids: ["xhs.detail", "xhs.search", "xhs.user_home"],
        evaluated_route_ids: ["xhs.search", "xhs.detail", "xhs.user_home"]
      }
    });
    expectNoHeaderValueLeak(result);
  });

  it("stays adapter-neutral by accepting arbitrary route identifiers", () => {
    const result = evaluateCloseoutRequiredHeadersMatrix({
      matrix: {
        routes: [
          {
            route_id: "example.inventory.lookup",
            required_headers: ["Authorization", "X-Request-Id"],
            minimality_evidence: [
              {
                header_name: "Authorization",
                proof_kind: "negative_omission_probe",
                result: "blocked_or_failed",
                artifact_ref: "artifact://inventory/missing-auth"
              },
              {
                header_name: "X-Request-Id",
                proof_kind: "contracted_platform_requirement",
                result: "contracted_required",
                artifact_ref: "artifact://inventory/request-id-contract"
              }
            ]
          }
        ]
      },
      observed_routes: [
        {
          route_id: "example.inventory.lookup",
          headers: {
            authorization: "redacted-auth",
            "x-request-id": "redacted-request"
          }
        }
      ]
    });

    expect(result).toMatchObject({
      decision: "PASS",
      passed: true,
      route_results: [
        {
          route_id: "example.inventory.lookup",
          required_headers: ["authorization", "x-request-id"]
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("redacted-auth");
    expect(JSON.stringify(result)).not.toContain("redacted-request");
    expect(JSON.stringify(result)).toContain("artifact://inventory/missing-auth");
  });

  it.each([
    {
      name: "missing matrix",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = null;
      },
      blocker_code: "missing_matrix",
      route_id: null,
      header_name: null
    },
    {
      name: "empty matrix",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = { routes: [] };
      },
      blocker_code: "empty_matrix",
      route_id: null,
      header_name: null
    },
    {
      name: "missing observed headers collection",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.observed_routes = null;
      },
      blocker_code: "missing_observed_headers",
      route_id: null,
      header_name: null
    },
    {
      name: "missing observed route",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.observed_routes = input.observed_routes?.filter(
          (route) => route.route_id !== "xhs.detail"
        ) ?? null;
      },
      blocker_code: "missing_observed_route",
      route_id: "xhs.detail",
      header_name: null
    },
    {
      name: "missing observed headers object",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.observed_routes = input.observed_routes?.map((route) =>
          route.route_id === "xhs.search" ? { ...route, headers: null } : route
        ) ?? null;
      },
      blocker_code: "missing_observed_headers",
      route_id: "xhs.search",
      header_name: null
    },
    {
      name: "missing required header",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.observed_routes = input.observed_routes?.map((route) =>
          route.route_id === "xhs.search"
            ? {
                ...route,
                headers: {
                  "x-s": "redacted-search-xs",
                  cookie: "redacted-search-cookie"
                }
              }
            : route
        ) ?? null;
      },
      blocker_code: "missing_required_header",
      route_id: "xhs.search",
      header_name: "x-t"
    },
    {
      name: "empty required header value",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.observed_routes = input.observed_routes?.map((route) =>
          route.route_id === "xhs.user_home"
            ? {
                ...route,
                headers: {
                  "x-s": "redacted-user-xs",
                  "x-t": "   ",
                  "user-agent": "Mozilla/5.0 redacted"
                }
              }
            : route
        ) ?? null;
      },
      blocker_code: "empty_required_header",
      route_id: "xhs.user_home",
      header_name: "x-t"
    },
    {
      name: "missing required header definition",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = {
          routes: [
            {
              route_id: "xhs.search",
              required_headers: [],
              minimality_evidence: []
            }
          ]
        };
      },
      blocker_code: "missing_required_header_definition",
      route_id: "xhs.search",
      header_name: null
    },
    {
      name: "missing minimality evidence",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = {
          routes: [
            {
              route_id: "xhs.search",
              required_headers: ["X-S"]
            }
          ]
        };
      },
      blocker_code: "missing_minimality_evidence",
      route_id: "xhs.search",
      header_name: null
    },
    {
      name: "minimality evidence without artifact ref",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = {
          routes: [
            {
              route_id: "xhs.search",
              required_headers: ["X-S"],
              minimality_evidence: [
                {
                  header_name: "X-S",
                  proof_kind: "negative_omission_probe",
                  result: "blocked_or_failed"
                }
              ]
            }
          ]
        };
      },
      blocker_code: "invalid_minimality_evidence",
      route_id: "xhs.search",
      header_name: null
    },
    {
      name: "mixed valid and malformed minimality evidence",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = {
          routes: [
            {
              route_id: "xhs.search",
              required_headers: ["X-S"],
              minimality_evidence: [
                {
                  header_name: "X-S",
                  proof_kind: "negative_omission_probe",
                  result: "blocked_or_failed",
                  artifact_ref: "artifact://search/missing-x-s"
                },
                {
                  header_name: "X-S",
                  proof_kind: "negative_omission_probe",
                  result: "blocked_or_failed"
                }
              ]
            }
          ]
        };
      },
      blocker_code: "invalid_minimality_evidence",
      route_id: "xhs.search",
      header_name: null
    },
    {
      name: "passive observed headers without admitted minimality evidence",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = {
          routes: [
            {
              route_id: "xhs.search",
              required_headers: ["X-S"],
              minimality_evidence: [
                {
                  header_name: "X-S",
                  proof_kind: "passive_observed_header",
                  result: "observed",
                  artifact_ref: "artifact://search/passive-only"
                }
              ]
            }
          ]
        };
      },
      blocker_code: "invalid_minimality_evidence",
      route_id: "xhs.search",
      header_name: null
    },
    {
      name: "required header missing its minimality proof",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = {
          routes: [
            {
              route_id: "xhs.search",
              required_headers: ["X-S", "X-T"],
              minimality_evidence: [
                {
                  header_name: "X-S",
                  proof_kind: "negative_omission_probe",
                  result: "blocked_or_failed",
                  artifact_ref: "artifact://search/missing-x-s"
                }
              ]
            }
          ]
        };
      },
      blocker_code: "missing_minimality_evidence",
      route_id: "xhs.search",
      header_name: "x-t"
    },
    {
      name: "blank required header name",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = {
          routes: [
            {
              route_id: "xhs.search",
              required_headers: ["X-S", " "],
              minimality_evidence: [
                {
                  header_name: "X-S",
                  proof_kind: "negative_omission_probe",
                  result: "blocked_or_failed",
                  artifact_ref: "artifact://search/missing-x-s"
                }
              ]
            }
          ]
        };
      },
      blocker_code: "missing_required_header_definition",
      route_id: "xhs.search",
      header_name: null
    },
    {
      name: "blank matrix route id",
      mutate: (input: EvaluateCloseoutRequiredHeadersMatrixInput) => {
        input.matrix = {
          routes: [
            {
              route_id: " ",
              required_headers: ["X-S"],
              minimality_evidence: [
                {
                  header_name: "X-S",
                  proof_kind: "negative_omission_probe",
                  result: "blocked_or_failed",
                  artifact_ref: "artifact://search/missing-x-s"
                }
              ]
            }
          ]
        };
      },
      blocker_code: "invalid_matrix_route",
      route_id: null,
      header_name: null
    }
  ])("fails closed for $name", ({ mutate, blocker_code, route_id, header_name }) => {
    const input = baseInput();
    mutate(input);

    const result = evaluateCloseoutRequiredHeadersMatrix(input);

    expect(result).toMatchObject({
      decision: "FAIL",
      passed: false,
      summary: {
        blocker_count: expect.any(Number)
      }
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker_code, route_id, header_name })
      ])
    );
    expect(result.summary.blocker_count).toBeGreaterThan(0);
    expectNoHeaderValueLeak(result);
  });

  it("keeps per-route and summary trace details when one route fails", () => {
    const input = baseInput();
    input.observed_routes = input.observed_routes?.map((route) =>
      route.route_id === "xhs.detail"
        ? {
            ...route,
            headers: {
              "x-s": "redacted-detail-xs",
              "x-t": "",
              referer: "https://www.xiaohongshu.com/explore/redacted"
            }
          }
        : route
    ) ?? null;

    const result = evaluateCloseoutRequiredHeadersMatrix(input);

    expect(result).toMatchObject({
      decision: "FAIL",
      passed: false,
      route_results: [
        {
          route_id: "xhs.search",
          decision: "PASS",
          passed: true
        },
        {
          route_id: "xhs.detail",
          decision: "FAIL",
          passed: false,
          empty_headers: ["x-t"],
          minimal_required_headers: ["referer", "x-s", "x-t"],
          missing_minimality_evidence: [],
          blockers: [
            expect.objectContaining({
              blocker_code: "empty_required_header",
              route_id: "xhs.detail",
              header_name: "x-t"
            })
          ]
        },
        {
          route_id: "xhs.user_home",
          decision: "PASS",
          passed: true
        }
      ],
      summary: {
        total_routes: 3,
        passed_routes: 2,
        failed_routes: 1,
        blocker_count: 1
      },
      trace: {
        evaluated_route_ids: ["xhs.search", "xhs.detail", "xhs.user_home"]
      }
    });
    expectNoHeaderValueLeak(result);
  });
});
