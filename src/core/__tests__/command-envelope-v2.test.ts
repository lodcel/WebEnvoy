import { describe, expect, it } from "vitest";

import { mapCurrentCliResponseToCommandEnvelopeV2 } from "../command-envelope-v2.js";
import type { ErrorResponse, SuccessResponse } from "../types.js";

describe("Command Envelope v2 current CLI mapping", () => {
  it("maps current v1 success summary into data and keeps operational compatibility fields", () => {
    const response: SuccessResponse = {
      run_id: "run-1134-success",
      command: "xhs.search",
      status: "success",
      summary: {
        items: [{ id: "note-1", title: "result" }],
        count: 1
      },
      observability: {
        coverage: "complete",
        request_evidence: "available",
        truncation: {
          truncated: false,
          fields: []
        },
        page_state: {
          page_kind: "search",
          url: "https://www.xiaohongshu.com/search_result",
          title: "Search",
          ready_state: "complete",
          observation_status: "complete"
        },
        key_requests: [
          {
            request_id: "search-api-1",
            stage: "request",
            method: "GET",
            url: "https://www.xiaohongshu.com/api/sns/web/v1/search/notes",
            outcome: "success",
            status_code: 200,
            request_class: "primary_api"
          }
        ],
        failure_site: null
      },
      timestamp: "2026-06-07T00:00:00.000Z"
    };

    const envelope = mapCurrentCliResponseToCommandEnvelopeV2(response);

    expect(envelope).toMatchObject({
      ok: true,
      command: "xhs.search",
      run_id: "run-1134-success",
      data: response.summary,
      operational: {
        compat: {
          output_version: "v2",
          compatible_with: "fr-0001.v1",
          v1_status: "success",
          v1_summary: response.summary
        },
        observability: response.observability,
        timestamps: {
          completed_at: "2026-06-07T00:00:00.000Z"
        }
      },
      warnings: [],
      errors: []
    });
    expect(envelope.evidence).toEqual([
      {
        kind: "route_evidence",
        ref: "run:run-1134-success:observability:key_request:1:search-api-1",
        status: "available",
        produced_by_run_id: "run-1134-success",
        summary: "GET https://www.xiaohongshu.com/api/sns/web/v1/search/notes outcome=success status=200"
      }
    ]);
    expect(envelope.data).not.toHaveProperty("normalized");
    expect(envelope.data).not.toHaveProperty("raw");
    expect(envelope.operational).not.toHaveProperty("normalized");
    expect(envelope.evidence[0]).not.toHaveProperty("body");
  });

  it("keeps duplicate key request evidence refs distinct and discloses partial evidence", () => {
    const response: SuccessResponse = {
      run_id: "run-1134-partial",
      command: "runtime.status",
      status: "success",
      summary: {
        runtime_state: "ready"
      },
      observability: {
        coverage: "complete",
        request_evidence: "available",
        truncation: {
          truncated: false,
          fields: []
        },
        page_state: {
          page_kind: "runtime",
          url: "about:blank",
          title: "Runtime",
          ready_state: "complete",
          observation_status: "complete"
        },
        key_requests: [
          {
            request_id: "unknown",
            stage: "request",
            method: "GET",
            url: "/runtime/status",
            outcome: "unknown"
          },
          {
            request_id: "unknown",
            stage: "request",
            method: "GET",
            url: "/runtime/readiness",
            outcome: "unknown"
          }
        ],
        failure_site: null
      },
      timestamp: "2026-06-07T00:00:30.000Z"
    };

    const envelope = mapCurrentCliResponseToCommandEnvelopeV2(response);

    expect(envelope.ok).toBe(true);
    expect(envelope.evidence).toMatchObject([
      {
        ref: "run:run-1134-partial:observability:key_request:1:unknown",
        status: "partial"
      },
      {
        ref: "run:run-1134-partial:observability:key_request:2:unknown",
        status: "partial"
      }
    ]);
    expect(new Set(envelope.evidence.map((item) => item.ref)).size).toBe(2);
    expect(envelope.operational.limits).toEqual([
      {
        limit_ref: "evidence.partial.run:run-1134-partial:observability:key_request:1:unknown",
        kind: "partial_observation",
        affected_path: "evidence[*].status",
        reason: "evidence ref run:run-1134-partial:observability:key_request:1:unknown is partial"
      },
      {
        limit_ref: "evidence.partial.run:run-1134-partial:observability:key_request:2:unknown",
        kind: "partial_observation",
        affected_path: "evidence[*].status",
        reason: "evidence ref run:run-1134-partial:observability:key_request:2:unknown is partial"
      }
    ]);
    expect(envelope.warnings).toEqual([
      {
        code: "WARN_EVIDENCE_PARTIAL",
        message:
          "Evidence is partial; retry may collect fuller diagnostics if the command context is still valid",
        severity: "warning",
        related_limit_ref: "evidence.partial.run:run-1134-partial:observability:key_request:1:unknown",
        related_evidence_ref: "run:run-1134-partial:observability:key_request:1:unknown"
      },
      {
        code: "WARN_EVIDENCE_PARTIAL",
        message:
          "Evidence is partial; retry may collect fuller diagnostics if the command context is still valid",
        severity: "warning",
        related_limit_ref: "evidence.partial.run:run-1134-partial:observability:key_request:2:unknown",
        related_evidence_ref: "run:run-1134-partial:observability:key_request:2:unknown"
      }
    ]);
    expect(JSON.stringify(envelope.warnings)).not.toContain("https://");
    expect(envelope.warnings[0]).not.toHaveProperty("retryable");
    expect(envelope.warnings[0]).not.toHaveProperty("redacted_details");
  });

  it("maps current v1 error diagnosis into operational diagnosis and primary errors", () => {
    const response: ErrorResponse = {
      run_id: "run-1134-error",
      command: "runtime.status",
      status: "error",
      error: {
        code: "ERR_RUNTIME_UNAVAILABLE",
        message: "runtime unavailable",
        retryable: true,
        diagnosis: {
          category: "runtime_unavailable",
          stage: "runtime",
          component: "native-messaging",
          failure_site: {
            stage: "runtime",
            component: "native-messaging",
            target: "host",
            summary: "native host did not answer"
          },
          evidence: ["host ping timed out"]
        }
      },
      observability: {
        coverage: "partial",
        request_evidence: "none",
        truncation: {
          truncated: true,
          fields: ["failure_site.summary"]
        },
        page_state: null,
        key_requests: [],
        failure_site: {
          stage: "runtime",
          component: "native-messaging",
          target: "host",
          summary: "native host did not answer"
        }
      },
      timestamp: "2026-06-07T00:01:00.000Z"
    };

    const envelope = mapCurrentCliResponseToCommandEnvelopeV2(response);

    expect(envelope.ok).toBe(false);
    expect(envelope.data).toEqual({});
    expect(envelope.errors).toEqual([
      {
        code: "ERR_RUNTIME_UNAVAILABLE",
        message: "runtime unavailable",
        retryable: true,
        category: "runtime",
        family: "provider_unavailable",
        exit_code: 5,
        diagnosis: response.error.diagnosis,
        related_evidence_refs: [
          "run:run-1134-error:observability:failure_site",
          "run:run-1134-error:diagnosis:evidence:1"
        ]
      }
    ]);
    expect(envelope.operational).toMatchObject({
      compat: {
        output_version: "v2",
        compatible_with: "fr-0001.v1",
        v1_status: "error",
        v1_error: {
          code: "ERR_RUNTIME_UNAVAILABLE",
          message: "runtime unavailable",
          retryable: true
        }
      },
      observability: response.observability,
      diagnosis: {
        availability: "available",
        primary_error_index: 0,
        classification: "runtime_unavailable",
        failure_site: response.error.diagnosis.failure_site,
        evidence_refs: ["run:run-1134-error:diagnosis:evidence:1"],
        summary: "native host did not answer"
      },
      timestamps: {
        completed_at: "2026-06-07T00:01:00.000Z"
      },
      limits: [
        {
          limit_ref: "observability.truncation.failure_site.summary",
          kind: "truncation",
          affected_path: "operational.observability.failure_site.summary",
          reason: "current v1 observability payload reports this field as truncated"
        },
        {
          limit_ref: "observability.coverage.partial",
          kind: "partial_observation",
          affected_path: "operational.observability",
          reason: "current v1 observability payload reports partial coverage"
        }
      ]
    });
    expect(envelope.evidence).toEqual([
      {
        kind: "runtime_diagnostic",
        ref: "run:run-1134-error:observability:failure_site",
        status: "available",
        produced_by_run_id: "run-1134-error",
        summary: "native host did not answer"
      },
      {
        kind: "runtime_diagnostic",
        ref: "run:run-1134-error:diagnosis:evidence:1",
        status: "available",
        produced_by_run_id: "run-1134-error",
        summary: "host ping timed out"
      }
    ]);
    expect(envelope.warnings).toEqual([]);
    expect(envelope.errors[0]).toMatchObject({
      code: "ERR_RUNTIME_UNAVAILABLE",
      retryable: true
    });
  });
});
