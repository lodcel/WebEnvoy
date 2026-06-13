import { describe, expect, it } from "vitest";

import {
  BRIDGE_PROTOCOL,
  createBridgeForwardRequest,
  createBridgeOpenRequest,
  createHeartbeatRequest,
  ensureBridgeRequestEnvelope,
  withBridgeCommandEnvelopeV2
} from "../protocol.js";

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
});
