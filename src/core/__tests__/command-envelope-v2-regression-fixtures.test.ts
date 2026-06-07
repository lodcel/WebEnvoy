import { describe, expect, it } from "vitest";

import { mapCurrentCliResponseToCommandEnvelopeV2 } from "../command-envelope-v2.js";
import type { ErrorCode } from "../errors.js";
import type { ErrorResponse, SuccessResponse } from "../types.js";

const completedAt = "2026-06-07T01:13:36.000Z";

const completeObservability = {
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
      request_id: "contract-fixture-1",
      stage: "request",
      method: "GET",
      url: "/contract/fixture",
      outcome: "success",
      status_code: 200,
      request_class: "contract_fixture"
    }
  ],
  failure_site: null
} satisfies SuccessResponse["observability"];

const errorObservability = (summary: string): ErrorResponse["observability"] => ({
  coverage: "partial",
  request_evidence: "none",
  truncation: {
    truncated: false,
    fields: []
  },
  page_state: null,
  key_requests: [],
  failure_site: {
    stage: "preflight",
    component: "cli",
    target: "contract-fixture",
    summary
  }
});

const errorResponse = (input: {
  runId: string;
  command: string;
  code: ErrorCode;
  message: string;
  retryable: boolean;
  diagnosisCategory?: ErrorResponse["error"]["diagnosis"]["category"];
  diagnosisStage?: string;
  diagnosisComponent?: string;
}): ErrorResponse => ({
  run_id: input.runId,
  command: input.command,
  status: "error",
  error: {
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    diagnosis: {
      category: input.diagnosisCategory ?? "unknown",
      stage: input.diagnosisStage ?? "preflight",
      component: input.diagnosisComponent ?? "cli",
      failure_site: {
        stage: input.diagnosisStage ?? "preflight",
        component: input.diagnosisComponent ?? "cli",
        target: "contract-fixture",
        summary: input.message
      },
      evidence: [`${input.code} fixture`]
    }
  },
  observability: errorObservability(input.message),
  timestamp: completedAt
});

describe("Command Envelope v2 regression fixtures for #1136", () => {
  it("locks success compatibility without adding errors or Syvert-shaped fields", () => {
    const response: SuccessResponse = {
      run_id: "run-1136-success",
      command: "runtime.status",
      status: "success",
      summary: {
        runtime_state: "ready",
        provider: "official_chrome"
      },
      observability: completeObservability,
      timestamp: completedAt
    };

    const envelope = mapCurrentCliResponseToCommandEnvelopeV2(response);

    expect(envelope).toMatchObject({
      ok: true,
      command: "runtime.status",
      run_id: "run-1136-success",
      data: response.summary,
      operational: {
        compat: {
          output_version: "v2",
          compatible_with: "fr-0001.v1",
          v1_status: "success",
          v1_summary: response.summary
        },
        timestamps: {
          completed_at: completedAt
        }
      },
      warnings: [],
      errors: []
    });
    expect(envelope.evidence).toHaveLength(1);
    expect(envelope.data).not.toHaveProperty("raw");
    expect(envelope.data).not.toHaveProperty("normalized");
  });

  it("locks validation error compatibility to FR-0039 taxonomy", () => {
    const envelope = mapCurrentCliResponseToCommandEnvelopeV2(
      errorResponse({
        runId: "run-1136-validation",
        command: "runtime.status",
        code: "ERR_CLI_INVALID_ARGS",
        message: "--params must be a JSON object",
        retryable: false
      })
    );

    expect(envelope).toMatchObject({
      ok: false,
      command: "runtime.status",
      run_id: "run-1136-validation",
      data: {},
      operational: {
        compat: {
          output_version: "v2",
          compatible_with: "fr-0001.v1",
          v1_status: "error",
          v1_error: {
            code: "ERR_CLI_INVALID_ARGS",
            message: "--params must be a JSON object",
            retryable: false
          }
        },
        diagnosis: {
          availability: "available",
          primary_error_index: 0
        },
        timestamps: {
          completed_at: completedAt
        }
      },
      errors: [
        expect.objectContaining({
          code: "ERR_CLI_INVALID_ARGS",
          retryable: false,
          category: "cli",
          family: "validation",
          exit_code: 2
        })
      ]
    });
  });

  it("locks provider unavailable compatibility before runtime execution starts", () => {
    const envelope = mapCurrentCliResponseToCommandEnvelopeV2(
      errorResponse({
        runId: "run-1136-provider",
        command: "runtime.status",
        code: "ERR_PROVIDER_UNAVAILABLE",
        message: "provider is not ready",
        retryable: true,
        diagnosisCategory: "runtime_unavailable",
        diagnosisStage: "runtime",
        diagnosisComponent: "provider"
      })
    );

    expect(envelope.errors).toEqual([
      expect.objectContaining({
        code: "ERR_PROVIDER_UNAVAILABLE",
        message: "provider is not ready",
        retryable: true,
        category: "environment",
        family: "provider_unavailable",
        exit_code: 5
      })
    ]);
    expect(envelope.operational.compat.v1_error).toEqual({
      code: "ERR_PROVIDER_UNAVAILABLE",
      message: "provider is not ready",
      retryable: true
    });
  });

  it("locks risk gate denied compatibility as a blocking risk error", () => {
    const envelope = mapCurrentCliResponseToCommandEnvelopeV2(
      errorResponse({
        runId: "run-1136-risk",
        command: "xhs.publish",
        code: "ERR_RISK_GATE_DENIED",
        message: "risk gate denied live write",
        retryable: false,
        diagnosisStage: "gate",
        diagnosisComponent: "risk"
      })
    );

    expect(envelope.ok).toBe(false);
    expect(envelope.errors).toEqual([
      expect.objectContaining({
        code: "ERR_RISK_GATE_DENIED",
        message: "risk gate denied live write",
        retryable: false,
        category: "risk",
        family: "risk_gate_denied",
        exit_code: 7
      })
    ]);
    expect(envelope.warnings).toEqual([]);
    expect(envelope.errors[0]?.code).not.toBe("ERR_EXECUTION_FAILED");
  });
});
