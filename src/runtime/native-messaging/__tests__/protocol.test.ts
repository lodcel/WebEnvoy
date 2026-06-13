import { describe, expect, it } from "vitest";

import { mapCurrentCliResponseToCommandEnvelopeV2 } from "../../../core/command-envelope-v2.js";
import type { ErrorResponse } from "../../../core/types.js";
import type { Diagnosis } from "../../diagnostics.js";
import type { ObservabilityPayload } from "../../observability.js";
import {
  BRIDGE_PROTOCOL,
  createBridgeForwardRequest,
  createBridgeOpenRequest,
  createHeartbeatRequest,
  ensureBridgeRequestEnvelope,
  withBridgeCommandEnvelopeV2
} from "../protocol.js";

const emptyObservability: ObservabilityPayload = {
  coverage: "unavailable",
  request_evidence: "none",
  truncation: {
    truncated: false,
    fields: []
  },
  page_state: null,
  key_requests: [],
  failure_site: null
};

const createDiagnosis = (category: Diagnosis["category"]): Diagnosis => ({
  category,
  stage:
    category === "page_changed"
      ? "page"
      : category === "request_failed"
        ? "request"
        : "runtime",
  component:
    category === "page_changed"
      ? "dom"
      : category === "request_failed"
        ? "network"
        : "runtime",
  failure_site: {
    stage:
      category === "page_changed"
        ? "page"
        : category === "request_failed"
          ? "request"
          : "runtime",
    component:
      category === "page_changed"
        ? "dom"
        : category === "request_failed"
          ? "network"
          : "runtime",
    target: `${category}-target`,
    summary: `${category} summary`
  },
  evidence: [`${category} evidence`]
});

const createForwardRequest = (input?: {
  id?: string;
  runId?: string;
  command?: string;
}) =>
  createBridgeForwardRequest({
    id: input?.id ?? "forward-error-parity-001",
    profile: "profile-a",
    sessionId: "nm-session-001",
    runId: input?.runId ?? "run-forward-error-parity-001",
    command: input?.command ?? "xhs.search",
    commandParams: {},
    cwd: "/tmp",
    timeoutMs: 1234
  });

const supportedCliErrorCodes = [
  "ERR_CLI_INVALID_ARGS",
  "ERR_CLI_UNKNOWN_COMMAND",
  "ERR_CLI_NOT_IMPLEMENTED",
  "ERR_PROVIDER_UNAVAILABLE",
  "ERR_RISK_GATE_DENIED",
  "ERR_CLOSEOUT_FAILED",
  "ERR_SCHEMA_EVIDENCE_FAILED",
  "ERR_RUNTIME_UNAVAILABLE",
  "ERR_RUNTIME_BOOTSTRAP_PENDING",
  "ERR_RUNTIME_BOOTSTRAP_TRANSPORT_NOT_CONNECTED",
  "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED",
  "ERR_RUNTIME_BOOTSTRAP_ACK_TIMEOUT",
  "ERR_RUNTIME_BOOTSTRAP_ACK_STALE",
  "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH",
  "ERR_RUNTIME_READY_SIGNAL_CONFLICT",
  "ERR_RUNTIME_IDENTITY_NOT_BOUND",
  "ERR_RUNTIME_IDENTITY_MISMATCH",
  "ERR_EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED",
  "ERR_EXECUTION_FAILED",
  "ERR_PROFILE_INVALID",
  "ERR_PROFILE_LOCKED",
  "ERR_PROFILE_OWNER_CONFLICT",
  "ERR_PROFILE_META_CORRUPT",
  "ERR_PROFILE_PROXY_CONFLICT",
  "ERR_BROWSER_LAUNCH_FAILED",
  "ERR_PROFILE_STATE_CONFLICT"
] as const;

const expectedBridgeRetryableByCode: Record<(typeof supportedCliErrorCodes)[number], boolean> = {
  ERR_CLI_INVALID_ARGS: false,
  ERR_CLI_UNKNOWN_COMMAND: false,
  ERR_CLI_NOT_IMPLEMENTED: false,
  ERR_PROVIDER_UNAVAILABLE: true,
  ERR_RISK_GATE_DENIED: false,
  ERR_CLOSEOUT_FAILED: false,
  ERR_SCHEMA_EVIDENCE_FAILED: false,
  ERR_RUNTIME_UNAVAILABLE: true,
  ERR_RUNTIME_BOOTSTRAP_PENDING: true,
  ERR_RUNTIME_BOOTSTRAP_TRANSPORT_NOT_CONNECTED: true,
  ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED: true,
  ERR_RUNTIME_BOOTSTRAP_ACK_TIMEOUT: true,
  ERR_RUNTIME_BOOTSTRAP_ACK_STALE: true,
  ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH: false,
  ERR_RUNTIME_READY_SIGNAL_CONFLICT: true,
  ERR_RUNTIME_IDENTITY_NOT_BOUND: true,
  ERR_RUNTIME_IDENTITY_MISMATCH: false,
  ERR_EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED: true,
  ERR_EXECUTION_FAILED: false,
  ERR_PROFILE_INVALID: false,
  ERR_PROFILE_LOCKED: true,
  ERR_PROFILE_OWNER_CONFLICT: false,
  ERR_PROFILE_META_CORRUPT: false,
  ERR_PROFILE_PROXY_CONFLICT: false,
  ERR_BROWSER_LAUNCH_FAILED: true,
  ERR_PROFILE_STATE_CONFLICT: false
};

describe("native messaging protocol", () => {
  it("builds bridge.open with protocol version", () => {
    const request = createBridgeOpenRequest({
      id: "bridge-open-001",
      profile: "profile-a"
    });

    expect(request).toMatchObject({
      id: "bridge-open-001",
      method: "bridge.open",
      profile: "profile-a",
      timeout_ms: 30_000,
      params: {
        protocol: BRIDGE_PROTOCOL
      }
    });
  });

  it("builds bridge.forward with timeout budget", () => {
    const request = createBridgeForwardRequest({
      id: "run-001",
      profile: "profile-a",
      sessionId: "nm-session-001",
      runId: "run-001",
      command: "runtime.ping",
      commandParams: { hello: "world" },
      cwd: "/tmp",
      timeoutMs: 1234
    });

    expect(request.timeout_ms).toBe(1234);
    expect(request.params).toMatchObject({
      session_id: "nm-session-001",
      run_id: "run-001",
      command: "runtime.ping",
      command_params: { hello: "world" },
      cwd: "/tmp"
    });
  });

  it("builds heartbeat request envelope", () => {
    const request = createHeartbeatRequest({
      id: "hb-001",
      sessionId: "nm-session-001"
    });

    expect(request).toMatchObject({
      id: "hb-001",
      method: "__ping__"
    });
  });

  it("rejects invalid request envelope", () => {
    expect(() =>
      ensureBridgeRequestEnvelope({
        id: "",
        method: "bridge.unknown",
        params: {}
      })
    ).toThrowError(/invalid request envelope/i);
  });

  it("does not add command envelope v2 to bridge.open or heartbeat responses", () => {
    const request = createBridgeOpenRequest({
      id: "bridge-open-no-sidecar-001",
      profile: "profile-a"
    });
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "success",
      summary: {
        protocol: BRIDGE_PROTOCOL,
        session_id: "nm-session-001",
        state: "ready"
      },
      error: null
    });

    expect(response).not.toHaveProperty("command_envelope_v2");
  });

  it("adds command envelope v2 parity to bridge.forward success responses", () => {
    const request = createBridgeForwardRequest({
      id: "forward-success-001",
      profile: "profile-a",
      sessionId: "nm-session-001",
      runId: "run-forward-success-001",
      command: "runtime.readiness",
      commandParams: {},
      cwd: "/tmp",
      timeoutMs: 1234
    });
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "success",
      summary: {
        session_id: "nm-session-001",
        run_id: "run-forward-success-001",
        command: "runtime.readiness",
        relay_path: "host>background>content-script>background>host"
      },
      payload: {
        transport_state: "ready"
      },
      error: null
    });

    expect(response.command_envelope_v2).toMatchObject({
      ok: true,
      run_id: "run-forward-success-001",
      command: "runtime.readiness",
      data: {
        session_id: "nm-session-001",
        run_id: "run-forward-success-001",
        command: "runtime.readiness",
        relay_path: "host>background>content-script>background>host",
        payload_present: true,
        payload_key_count: 1,
        payload_keys: ["transport_state"],
        payload_keys_truncated: false
      },
      errors: []
    });
  });

  it("uses a bounded success parity view without duplicating unbounded payloads", () => {
    const request = createBridgeForwardRequest({
      id: "forward-large-success-001",
      profile: "profile-a",
      sessionId: "nm-session-001",
      runId: "run-forward-large-success-001",
      command: "runtime.readiness",
      commandParams: {},
      cwd: "/tmp",
      timeoutMs: 1234
    });
    const largePayload = {
      raw_html: "<main>" + "x".repeat(10_000) + "</main>",
      result: {
        deeply: {
          nested: "value"
        }
      }
    };
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "success",
      summary: {
        run_id: "run-forward-large-success-001",
        command: "runtime.readiness",
        relay_path: "host>background>content-script>background>host"
      },
      payload: largePayload,
      error: null
    });

    expect(response.payload).toBe(largePayload);
    expect(response.command_envelope_v2?.data).toMatchObject({
      run_id: "run-forward-large-success-001",
      command: "runtime.readiness",
      payload_present: true,
      payload_key_count: 2,
      payload_keys: ["raw_html", "result"]
    });
    expect(response.command_envelope_v2?.data).not.toHaveProperty("raw_html");
    expect(response.command_envelope_v2?.operational.compat.v1_summary).not.toHaveProperty(
      "raw_html"
    );
  });

  it("promotes bridge payload observability into command envelope v2 sidecar", () => {
    const request = createBridgeForwardRequest({
      id: "forward-observability-001",
      profile: "profile-a",
      sessionId: "nm-session-001",
      runId: "run-forward-observability-001",
      command: "xhs.search",
      commandParams: {},
      cwd: "/tmp",
      timeoutMs: 1234
    });
    const payload = {
      observability: {
        page_state: {
          page_kind: "search",
          url: "https://example.com/search?q=secret",
          title: "Search results",
          ready_state: "complete"
        },
        key_requests: [
          {
            request_id: "search-api-1",
            stage: "request",
            method: "get",
            url: "https://example.com/api/search?token=secret",
            outcome: "failed",
            status_code: 503,
            failure_reason: "authorization: Bearer SECRET"
          }
        ],
        failure_site: {
          stage: "request",
          component: "network",
          target: "https://example.com/api/search?token=secret",
          summary: "request failed with token=secret"
        }
      },
      result_count: 0
    };
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "success",
      summary: {
        run_id: "run-forward-observability-001",
        command: "xhs.search"
      },
      payload,
      error: null
    });

    expect(response.payload).toBe(payload);
    expect(response.command_envelope_v2?.operational.observability).toMatchObject({
      coverage: "complete",
      request_evidence: "available",
      page_state: {
        url: "https://example.com/search",
        title: "Search results"
      },
      key_requests: [
        {
          request_id: "search-api-1",
          method: "GET",
          url: "https://example.com/api/search",
          failure_reason: "authorization: [REDACTED]"
        }
      ],
      failure_site: {
        stage: "request",
        component: "network",
        target: "https://example.com/api/search",
        summary: "request failed with token=[REDACTED]"
      }
    });
    expect(JSON.stringify(response.command_envelope_v2?.operational.observability)).not.toContain(
      "SECRET"
    );
  });

  it("fails closed when bridge payload observability is missing or malformed", () => {
    const request = createForwardRequest({
      id: "forward-observability-fail-closed-001",
      runId: "run-forward-observability-fail-closed-001"
    });
    const cases = [
      { name: "missing", payload: undefined },
      {
        name: "not-object",
        payload: {
          observability: "not an observability object"
        }
      },
      {
        name: "malformed-fields",
        payload: {
          observability: {
            page_state: "bad page state",
            key_requests: "bad key requests",
            failure_site: "bad failure site"
          }
        }
      }
    ];

    for (const item of cases) {
      const response = withBridgeCommandEnvelopeV2(request, {
        id: `${request.id}-${item.name}`,
        status: "success",
        summary: {},
        ...(item.payload ? { payload: item.payload } : {}),
        error: null
      });

      expect(response.command_envelope_v2?.operational.observability).toEqual(emptyObservability);
    }
  });

  it("promotes bridge error payload observability without fabricating diagnosis", () => {
    const request = createForwardRequest({
      id: "forward-error-observability-001",
      runId: "run-forward-error-observability-001"
    });
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "error",
      summary: {},
      payload: {
        observability: {
          failure_site: {
            stage: "request",
            component: "network",
            target: "/api/search?token=secret",
            summary: "request failed with authorization: Bearer SECRET"
          }
        }
      },
      error: {
        code: "ERR_EXECUTION_FAILED",
        message: "request failed"
      }
    });

    expect(response.command_envelope_v2?.operational.observability).toMatchObject({
      coverage: "partial",
      request_evidence: "none",
      failure_site: {
        stage: "request",
        component: "network",
        target: "/api/search",
        summary: "request failed with authorization: [REDACTED]"
      }
    });
    expect(response.command_envelope_v2?.operational.diagnosis).toMatchObject({
      availability: "unavailable"
    });
    expect(response.command_envelope_v2?.errors[0]).not.toHaveProperty("diagnosis");
  });

  it("maps bridge.forward transport errors to CLI-compatible command envelope errors", () => {
    const request = createBridgeForwardRequest({
      id: "forward-error-001",
      profile: "profile-a",
      sessionId: "nm-session-001",
      runId: "run-forward-error-001",
      command: "runtime.tabs",
      commandParams: {},
      cwd: "/tmp",
      timeoutMs: 1234
    });
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "error",
      summary: {
        relay_path: "host>background>content-script>background>host"
      },
      error: {
        code: "ERR_TRANSPORT_TIMEOUT",
        message: "content script forward timed out"
      }
    });

    expect(response.command_envelope_v2).toMatchObject({
      ok: false,
      run_id: "run-forward-error-001",
      command: "runtime.tabs",
      data: {},
      errors: [
        {
          code: "ERR_RUNTIME_UNAVAILABLE",
          message: "content script forward timed out",
          retryable: true,
          category: "runtime"
        }
      ]
    });
    expect(response.command_envelope_v2?.operational.compat.v1_error).toMatchObject({
      code: "ERR_RUNTIME_UNAVAILABLE",
      retryable: true
    });
    expect(response.command_envelope_v2?.operational.diagnosis).toMatchObject({
      availability: "unavailable"
    });
    expect(response.command_envelope_v2?.operational.observability.failure_site).toBeNull();
    expect(response.command_envelope_v2?.errors[0]).not.toHaveProperty("diagnosis");
    expect(response.command_envelope_v2?.errors[0]).not.toHaveProperty("related_evidence_refs");
    expect(response.command_envelope_v2?.evidence).toEqual([]);
  });

  it("marks recoverable runtime bootstrap errors retryable except identity mismatch", () => {
    const request = createBridgeForwardRequest({
      id: "forward-bootstrap-error-001",
      profile: "profile-a",
      sessionId: "nm-session-001",
      runId: "run-forward-bootstrap-error-001",
      command: "runtime.bootstrap",
      commandParams: {},
      cwd: "/tmp",
      timeoutMs: 1234
    });

    for (const code of [
      "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED",
      "ERR_RUNTIME_BOOTSTRAP_ACK_TIMEOUT",
      "ERR_RUNTIME_BOOTSTRAP_ACK_STALE",
      "ERR_RUNTIME_READY_SIGNAL_CONFLICT"
    ]) {
      const response = withBridgeCommandEnvelopeV2(request, {
        id: request.id,
        status: "error",
        summary: {},
        error: {
          code,
          message: `bootstrap failed: ${code}`
        }
      });

      expect(response.command_envelope_v2?.errors[0]).toMatchObject({
        code,
        retryable: true
      });
      expect(response.command_envelope_v2?.operational.compat.v1_error).toMatchObject({
        code,
        retryable: true
      });
    }

    const identityMismatch = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "error",
      summary: {},
      error: {
        code: "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH",
        message: "bootstrap identity mismatch"
      }
    });

    expect(identityMismatch.command_envelope_v2?.errors[0]).toMatchObject({
      code: "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH",
      retryable: false
    });
  });

  it("marks provider unavailable taxonomy retryable in the sidecar and v1 compat view", () => {
    const request = createForwardRequest({
      id: "forward-provider-unavailable-retryable-001",
      runId: "run-forward-provider-unavailable-retryable-001",
      command: "runtime.status"
    });
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "error",
      summary: {},
      error: {
        code: "ERR_PROVIDER_UNAVAILABLE",
        message: "provider is not ready"
      }
    });

    expect(response.command_envelope_v2?.errors[0]).toMatchObject({
      code: "ERR_PROVIDER_UNAVAILABLE",
      retryable: true,
      category: "environment",
      family: "provider_unavailable",
      exit_code: 5
    });
    expect(response.command_envelope_v2?.operational.compat.v1_error).toEqual({
      code: "ERR_PROVIDER_UNAVAILABLE",
      message: "provider is not ready",
      retryable: true
    });
  });

  it("keeps profile retryability aligned with v1 compat semantics", () => {
    const request = createForwardRequest({
      id: "forward-profile-retryability-001",
      runId: "run-forward-profile-retryability-001",
      command: "runtime.start"
    });
    const cases = [
      ["ERR_PROFILE_LOCKED", true],
      ["ERR_PROFILE_INVALID", false],
      ["ERR_PROFILE_META_CORRUPT", false],
      ["ERR_PROFILE_PROXY_CONFLICT", false],
      ["ERR_PROFILE_OWNER_CONFLICT", false],
      ["ERR_PROFILE_STATE_CONFLICT", false]
    ] as const;

    for (const [code, retryable] of cases) {
      const response = withBridgeCommandEnvelopeV2(request, {
        id: `${request.id}-${code}`,
        status: "error",
        summary: {},
        error: {
          code,
          message: `${code} profile failure`
        }
      });

      expect(response.command_envelope_v2?.errors[0]).toMatchObject({
        code,
        retryable,
        category: "account",
        family: "provider_unavailable",
        exit_code: 5
      });
      expect(response.command_envelope_v2?.operational.compat.v1_error).toMatchObject({
        code,
        retryable
      });
    }
  });

  it("preserves existing command-level diagnosis instead of inventing transport evidence", () => {
    const request = createBridgeForwardRequest({
      id: "forward-diagnosis-error-001",
      profile: "profile-a",
      sessionId: "nm-session-001",
      runId: "run-forward-diagnosis-error-001",
      command: "xhs.search",
      commandParams: {},
      cwd: "/tmp",
      timeoutMs: 1234
    });
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "error",
      summary: {
        relay_path: "host>background>content-script>background>host"
      },
      payload: {
        diagnosis: {
          category: "page_changed",
          stage: "page",
          component: "dom",
          failure_site: {
            stage: "page",
            component: "dom",
            target: "#search",
            summary: "search box missing"
          },
          evidence: ["selector #search was not found"]
        }
      },
      error: {
        code: "ERR_EXECUTION_FAILED",
        message: "search failed"
      }
    });

    expect(response.command_envelope_v2?.operational.diagnosis).toMatchObject({
      availability: "available",
      primary_error_index: 0,
      classification: "page_changed",
      failure_site: {
        stage: "page",
        component: "dom",
        target: "#search",
        summary: "search box missing"
      },
      evidence_refs: ["run:run-forward-diagnosis-error-001:bridge:diagnosis:1"]
    });
    expect(response.command_envelope_v2?.errors[0].diagnosis).toMatchObject({
      category: "page_changed",
      stage: "page",
      component: "dom"
    });
    expect(response.command_envelope_v2?.errors[0].category).toBe("page");
    expect(response.command_envelope_v2?.errors[0].diagnosis?.failure_site).toMatchObject({
      stage: "page",
      component: "dom"
    });
    expect(response.command_envelope_v2?.evidence).toEqual([
      {
        kind: "runtime_diagnostic",
        ref: "run:run-forward-diagnosis-error-001:bridge:diagnosis:1",
        status: "available",
        produced_by_run_id: "run-forward-diagnosis-error-001",
        summary: "selector #search was not found"
      }
    ]);
  });

  it("redacts and bounds bridge diagnosis evidence before adding v2 evidence summaries", () => {
    const request = createForwardRequest({
      id: "forward-diagnosis-evidence-bounds-001",
      runId: "run-forward-diagnosis-evidence-bounds-001"
    });
    const authorizationEvidence = "authorization: Bearer SECRET";
    const cookieEvidence = "cookie: sid=raw";
    const tokenEvidence = "token=abc123 signature=deadbeef";
    const longEvidence = `long evidence ${"x".repeat(500)}`;
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "error",
      summary: {},
      payload: {
        diagnosis: {
          category: "request_failed",
          stage: "request",
          component: "network",
          failure_site: {
            stage: "request",
            component: "network",
            target: "/api/search",
            summary: "request failed"
          },
          evidence: [
            authorizationEvidence,
            cookieEvidence,
            tokenEvidence,
            longEvidence,
            "fifth evidence should be omitted"
          ]
        }
      },
      error: {
        code: "ERR_EXECUTION_FAILED",
        message: "request failed"
      }
    });
    const envelope = response.command_envelope_v2;
    const serialized = JSON.stringify(envelope);

    expect(envelope?.evidence).toHaveLength(4);
    expect(envelope?.errors[0].related_evidence_refs).toHaveLength(4);
    expect(envelope?.errors[0].diagnosis?.evidence).toHaveLength(4);
    expect(envelope?.evidence[0]?.summary).toContain("authorization: [REDACTED]");
    expect(envelope?.evidence[1]?.summary).toContain("cookie: [REDACTED]");
    expect(envelope?.evidence[2]?.summary).toContain("token=[REDACTED]");
    expect(envelope?.evidence[2]?.summary).toContain("signature=[REDACTED]");
    expect(envelope?.evidence[0]?.summary).not.toContain("SECRET");
    expect(envelope?.evidence[1]?.summary).not.toContain("abc123");
    expect(envelope?.evidence[2]?.summary).not.toContain("abc123");
    expect(envelope?.evidence[2]?.summary).not.toContain("deadbeef");
    expect(envelope?.evidence[3]?.summary.length).toBeLessThanOrEqual(256);
    expect(envelope?.evidence.map((item) => item.summary)).not.toContain(
      "fifth evidence should be omitted"
    );
    expect(envelope?.operational.limits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "redaction" }),
        expect.objectContaining({ kind: "truncation" }),
        expect.objectContaining({
          limit_ref: "bridge.diagnosis.evidence.count",
          affected_path: "errors[0].diagnosis.evidence"
        })
      ])
    );
    expect(serialized).not.toContain("Bearer SECRET");
    expect(serialized).not.toContain("sid=raw");
    expect(serialized).not.toContain("deadbeef");
    expect(serialized).not.toContain("fifth evidence should be omitted");
  });

  it("sanitizes and bounds diagnosis failure_site before sidecar exposure", () => {
    const request = createForwardRequest({
      id: "forward-diagnosis-failure-site-bounds-001",
      runId: "run-forward-diagnosis-failure-site-bounds-001"
    });
    const longTarget = `https://example.com/${"path/".repeat(60)}search?token=SECRET#fragment`;
    const longSummary = `authorization: Bearer SECRET\ncookie: sid=raw\n${"summary ".repeat(80)}`;
    const response = withBridgeCommandEnvelopeV2(request, {
      id: request.id,
      status: "error",
      summary: {},
      payload: {
        diagnosis: {
          category: "request_failed",
          stage: "request",
          component: "network",
          failure_site: {
            stage: "request",
            component: "network",
            target: longTarget,
            summary: longSummary
          },
          evidence: ["request failed"]
        }
      },
      error: {
        code: "ERR_EXECUTION_FAILED",
        message: "request failed"
      }
    });
    const envelope = response.command_envelope_v2;
    const failureSite = envelope?.errors[0].diagnosis?.failure_site;
    const serialized = JSON.stringify(envelope);

    expect(failureSite?.target).not.toContain("?");
    expect(failureSite?.target).not.toContain("#fragment");
    expect(failureSite?.target).not.toContain("SECRET");
    expect(failureSite?.target.length).toBeLessThanOrEqual(160);
    expect(failureSite?.target_truncated).toBe(true);
    expect(failureSite?.summary).toContain("authorization: [REDACTED]");
    expect(failureSite?.summary).toContain("cookie: [REDACTED]");
    expect(failureSite?.summary).not.toContain("Bearer SECRET");
    expect(failureSite?.summary).not.toContain("sid=raw");
    expect(failureSite?.summary.length).toBeLessThanOrEqual(160);
    expect(failureSite?.summary_truncated).toBe(true);
    expect(envelope?.operational.diagnosis).toMatchObject({
      availability: "available",
      failure_site: failureSite,
      summary: failureSite?.summary
    });
    expect(envelope?.operational.limits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          limit_ref: "bridge.diagnosis.failure_site.target.redaction",
          affected_path: "errors[0].diagnosis.failure_site.target"
        }),
        expect.objectContaining({
          limit_ref: "bridge.diagnosis.failure_site.target.truncation",
          affected_path: "errors[0].diagnosis.failure_site.target"
        }),
        expect.objectContaining({
          limit_ref: "bridge.diagnosis.failure_site.summary.redaction",
          affected_path: "errors[0].diagnosis.failure_site.summary"
        }),
        expect.objectContaining({
          limit_ref: "bridge.diagnosis.failure_site.summary.truncation",
          affected_path: "errors[0].diagnosis.failure_site.summary"
        })
      ])
    );
    expect(serialized).not.toContain("Bearer SECRET");
    expect(serialized).not.toContain("sid=raw");
    expect(serialized).not.toContain("token=SECRET");
    expect(serialized).not.toContain("#fragment");
  });

  it.each([
    ["page_changed", "page"],
    ["request_failed", "request"],
    ["execution_interrupted", "runtime"],
    ["runtime_unavailable", "runtime"],
    ["unknown", "unknown"]
  ] as const)(
    "matches core CLI v2 category mapping for ERR_EXECUTION_FAILED with %s diagnosis",
    (category, expectedCategory) => {
      const diagnosis = createDiagnosis(category);
      const request = createForwardRequest({
        id: `forward-${category}-diagnosis-001`,
        runId: `run-forward-${category}-diagnosis-001`
      });
      const bridgeResponse = withBridgeCommandEnvelopeV2(request, {
        id: request.id,
        status: "error",
        summary: {},
        payload: {
          diagnosis
        },
        error: {
          code: "ERR_EXECUTION_FAILED",
          message: `${category} failure`
        }
      });
      const coreResponse: ErrorResponse = {
        run_id: String(request.params.run_id),
        command: String(request.params.command),
        status: "error",
        error: {
          code: "ERR_EXECUTION_FAILED",
          message: `${category} failure`,
          retryable: false,
          diagnosis
        },
        observability: emptyObservability,
        timestamp: "2026-06-13T00:00:00.000Z"
      };
      const coreEnvelope = mapCurrentCliResponseToCommandEnvelopeV2(coreResponse);

      expect(bridgeResponse.command_envelope_v2?.errors[0]).toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        category: expectedCategory
      });
      expect(bridgeResponse.command_envelope_v2?.errors[0].category).toBe(
        coreEnvelope.errors[0]?.category
      );
      expect(bridgeResponse.command_envelope_v2?.operational.diagnosis).toMatchObject({
        availability: "available",
        classification: category,
        failure_site: diagnosis.failure_site
      });
      expect(bridgeResponse.command_envelope_v2?.errors[0].diagnosis).toEqual(diagnosis);
    }
  );

  it.each(supportedCliErrorCodes)(
    "matches core CLI v2 taxonomy mapping for supported error code %s",
    (code) => {
      const diagnosis = createDiagnosis("unknown");
      const request = createForwardRequest({
        id: `forward-${code.toLowerCase()}-category-001`,
        runId: `run-forward-${code.toLowerCase()}-category-001`
      });
      const bridgeResponse = withBridgeCommandEnvelopeV2(request, {
        id: request.id,
        status: "error",
        summary: {},
        payload: {
          diagnosis
        },
        error: {
          code,
          message: `${code} failure`
        }
      });
      const coreEnvelope = mapCurrentCliResponseToCommandEnvelopeV2({
        run_id: String(request.params.run_id),
        command: String(request.params.command),
        status: "error",
        error: {
          code,
          message: `${code} failure`,
          retryable: expectedBridgeRetryableByCode[code],
          diagnosis
        },
        observability: emptyObservability,
        timestamp: "2026-06-13T00:00:00.000Z"
      });
      const bridgeError = bridgeResponse.command_envelope_v2?.errors[0];
      const coreError = coreEnvelope.errors[0];

      expect(bridgeError).toMatchObject({
        code,
        retryable: expectedBridgeRetryableByCode[code],
        category: coreError?.category,
        family: coreError?.family,
        exit_code: coreError?.exit_code
      });
      expect(bridgeResponse.command_envelope_v2?.operational.compat.v1_error).toMatchObject({
        code,
        retryable: expectedBridgeRetryableByCode[code]
      });
    }
  );

  it("fails closed when command-level diagnosis is missing, malformed, or unsupported", () => {
    const request = createForwardRequest({
      id: "forward-fail-closed-diagnosis-001",
      runId: "run-forward-fail-closed-diagnosis-001"
    });
    const cases = [
      { name: "missing", payload: undefined },
      {
        name: "malformed",
        payload: {
          diagnosis: {
            category: "page_changed",
            failure_site: {
              stage: "page",
              component: "dom",
              summary: "missing target"
            }
          }
        }
      },
      {
        name: "unsupported",
        payload: {
          diagnosis: {
            category: "auth_failed",
            stage: "auth",
            component: "account",
            failure_site: {
              stage: "auth",
              component: "account",
              target: "profile",
              summary: "unsupported diagnosis category"
            },
            evidence: ["auth failed"]
          }
        }
      }
    ];

    for (const item of cases) {
      const response = withBridgeCommandEnvelopeV2(request, {
        id: `${request.id}-${item.name}`,
        status: "error",
        summary: {},
        ...(item.payload ? { payload: item.payload } : {}),
        error: {
          code: "ERR_EXECUTION_FAILED",
          message: `${item.name} diagnosis`
        }
      });

      expect(response.command_envelope_v2?.errors[0]).toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        category: "unknown"
      });
      expect(response.command_envelope_v2?.errors[0]).not.toHaveProperty("diagnosis");
      expect(response.command_envelope_v2?.errors[0]).not.toHaveProperty(
        "related_evidence_refs"
      );
      expect(response.command_envelope_v2?.operational.diagnosis).toMatchObject({
        availability: "unavailable"
      });
      expect(response.command_envelope_v2?.evidence).toEqual([]);
    }
  });
});
