import { describe, expect, it } from "vitest";

import { NativeBridgePendingForwardState } from "../extension/native-bridge-pending-forward-state.js";
import { NativeBridgeRecoveryState } from "../extension/native-bridge-recovery-state.js";
import type {
  NativeBridgeRequest,
  NativeBridgeResponse,
  NativeBridgeState,
  PendingForward
} from "../extension/native-bridge-protocol.js";

const createRequest = (id: string, timeoutMs = 100): NativeBridgeRequest => ({
  id,
  method: "bridge.forward",
  profile: "profile-a",
  params: {
    session_id: "nm-session-001",
    run_id: id,
    command: "runtime.ping",
    command_params: {}
  },
  timeout_ms: timeoutMs
});

const createPending = (
  id: string,
  overrides?: Partial<PendingForward>
): PendingForward => ({
  request: createRequest(id),
  timeout: setTimeout(() => undefined, 10_000),
  ...overrides
});

describe("extension native bridge pending forward state", () => {
  it("emits error responses with relay path and gate payload", () => {
    const state = new NativeBridgePendingForwardState();
    const emitted: NativeBridgeResponse[] = [];
    state.register(
      "pending-forward-001",
      createPending("pending-forward-001", {
        gatePayload: {
          gate_outcome: {
            gate_decision: "blocked"
          }
        }
      })
    );

    state.fail(
      "pending-forward-001",
      { code: "ERR_TRANSPORT_TIMEOUT", message: "content script forward timed out" },
      (message) => emitted.push(message)
    );

    expect(emitted).toEqual([
      {
        id: "pending-forward-001",
        status: "error",
        summary: {
          relay_path: "host>background>content-script>background>host"
        },
        payload: {
          gate_outcome: {
            gate_decision: "blocked"
          }
        },
        error: {
          code: "ERR_TRANSPORT_TIMEOUT",
          message: "content script forward timed out"
        }
      }
    ]);
    expect(state.take("pending-forward-001")).toBeNull();
  });

  it("suppresses host responses when pending forward opts out", () => {
    const state = new NativeBridgePendingForwardState();
    const emitted: NativeBridgeResponse[] = [];
    state.register(
      "pending-forward-suppressed-001",
      createPending("pending-forward-suppressed-001", {
        suppressHostResponse: true
      })
    );

    state.fail(
      "pending-forward-suppressed-001",
      { code: "ERR_TRANSPORT_DISCONNECTED", message: "native messaging disconnected" },
      (message) => emitted.push(message)
    );

    expect(emitted).toEqual([]);
    expect(state.take("pending-forward-suppressed-001")).toBeNull();
  });

  it("drains all pending forwards on failAll", () => {
    const state = new NativeBridgePendingForwardState();
    const emitted: NativeBridgeResponse[] = [];
    state.register("pending-forward-a", createPending("pending-forward-a"));
    state.register("pending-forward-b", createPending("pending-forward-b"));

    state.failAll(
      { code: "ERR_TRANSPORT_DISCONNECTED", message: "native messaging disconnected" },
      (message) => emitted.push(message)
    );

    expect(emitted.map((message) => message.id)).toEqual([
      "pending-forward-a",
      "pending-forward-b"
    ]);
    expect(state.take("pending-forward-a")).toBeNull();
    expect(state.take("pending-forward-b")).toBeNull();
  });
});

describe("extension native bridge recovery state", () => {
  const createRecoveryState = (
    input?: {
      getState?: () => NativeBridgeState;
      emitted?: NativeBridgeResponse[];
      maxQueued?: number;
      forwardTimeoutMs?: number;
    }
  ) => {
    const emitted = input?.emitted ?? [];
    const state = new NativeBridgeRecoveryState(
      {
        getState: input?.getState ?? (() => "recovering"),
        emit: (message) => emitted.push(message)
      },
      { forwardTimeoutMs: input?.forwardTimeoutMs ?? 100 },
      input?.maxQueued
    );
    return { state, emitted };
  };

  it("queues forwards during recovery and dispatches them only when ready", async () => {
    let bridgeState: NativeBridgeState = "recovering";
    const { state, emitted } = createRecoveryState({
      getState: () => bridgeState
    });
    const dispatched: NativeBridgeRequest[] = [];
    state.queueForward(createRequest("recovering-forward-001"));

    await state.replayQueuedForwards(async (request) => {
      dispatched.push(request);
    });
    expect(dispatched).toEqual([]);
    expect(emitted).toEqual([]);

    bridgeState = "ready";
    await state.replayQueuedForwards(async (request) => {
      dispatched.push(request);
    });

    expect(dispatched.map((request) => request.id)).toEqual(["recovering-forward-001"]);
    expect(emitted).toEqual([]);
  });

  it("expires queued forwards with transport timeout", () => {
    const { state, emitted } = createRecoveryState();
    state.queueForward(createRequest("recovery-timeout-001", 1));

    state.expireQueuedForwards(Date.now() + 2);

    expect(emitted).toEqual([
      {
        id: "recovery-timeout-001",
        status: "error",
        summary: {
          relay_path: "host>background>content-script>background>host"
        },
        error: {
          code: "ERR_TRANSPORT_TIMEOUT",
          message: "forward request timed out during recovery"
        }
      }
    ]);
  });

  it("fails closed when the recovery queue is full", () => {
    const { state, emitted } = createRecoveryState({ maxQueued: 1 });
    state.queueForward(createRequest("queued-forward-001"));

    state.queueForward(createRequest("queued-forward-002"));

    expect(emitted).toEqual([
      {
        id: "queued-forward-002",
        status: "error",
        summary: {
          relay_path: "host>background>content-script>background>host"
        },
        error: {
          code: "ERR_TRANSPORT_DISCONNECTED",
          message: "recovery queue exhausted (1)"
        }
      }
    ]);
  });
});
