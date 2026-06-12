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
        transport_state: "ready"
      },
      errors: []
    });
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
  });
});
