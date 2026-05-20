import { describe, expect, it, vi } from "vitest";

import {
  createChromeApi,
  createMockPort,
  createXhsCommandParams,
  respondHandshake,
  startChromeBackgroundBridge,
  waitForBridgeTurn,
  waitForPostedMessage
} from "./extension.service-worker.shared.js";

describe("extension service worker / background command dispatch", () => {
  it("handles runtime.readiness in background without content-script forwarding", async () => {
    const firstPort = createMockPort();
    const { chromeApi } = createChromeApi([firstPort]);

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await waitForBridgeTurn();

    firstPort.onMessageListeners[0]?.({
      id: "run-command-dispatch-readiness-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-readiness-001",
        command: "runtime.readiness",
        command_params: {
          runtime_context_id: "ctx-command-dispatch-readiness-001"
        },
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 50
    });

    await waitForPostedMessage(firstPort.postMessage, {
      id: "run-command-dispatch-readiness-001",
      status: "success",
      summary: expect.objectContaining({
        command: "runtime.readiness",
        relay_path: "host>background"
      }),
      payload: expect.objectContaining({
        bootstrap_state: "not_started",
        transport_state: "ready"
      })
    });
    expect(chromeApi.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("continues forwarding content-script commands through the existing dispatch path", async () => {
    const firstPort = createMockPort();
    const { chromeApi } = createChromeApi([firstPort]);

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await waitForBridgeTurn();

    firstPort.onMessageListeners[0]?.({
      id: "run-command-dispatch-forward-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-forward-001",
        command: "runtime.ping",
        command_params: {},
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 50
    });

    await vi.waitFor(() => {
      expect(chromeApi.tabs.sendMessage).toHaveBeenCalledWith(
        11,
        expect.objectContaining({
          id: "run-command-dispatch-forward-001",
          command: "runtime.ping"
        })
      );
    });
  });

  it("keeps XHS content-script dispatch exceptions with the existing gate payload shape", async () => {
    const firstPort = createMockPort();
    const { chromeApi } = createChromeApi([firstPort]);
    chromeApi.tabs.query.mockImplementation(async () => [
      {
        id: 32,
        url: "https://www.xiaohongshu.com/search_result?keyword=露营",
        active: true
      }
    ]);
    chromeApi.tabs.sendMessage = vi.fn(async () => {
      throw new Error("content script dispatch failed");
    });

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await waitForBridgeTurn();

    firstPort.onMessageListeners[0]?.({
      id: "run-command-dispatch-xhs-exception-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-xhs-exception-001",
        command: "xhs.search",
        command_params: createXhsCommandParams({
          run_id: "run-command-dispatch-xhs-exception-001"
        }),
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await waitForPostedMessage(firstPort.postMessage, {
      id: "run-command-dispatch-xhs-exception-001",
      status: "error",
      payload: expect.objectContaining({
        consumer_gate_result: expect.objectContaining({
          gate_decision: "allowed",
          requested_execution_mode: "dry_run"
        })
      }),
      error: expect.objectContaining({
        code: "ERR_TRANSPORT_FORWARD_FAILED",
        message: "content script dispatch failed"
      })
    });
  });

  it("keeps non-XHS forward exceptions shaped as transport failures", async () => {
    const firstPort = createMockPort();
    const { chromeApi } = createChromeApi([firstPort]);
    chromeApi.tabs.sendMessage = vi.fn(async () => {
      throw new Error("content script dispatch failed");
    });

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await waitForBridgeTurn();

    firstPort.onMessageListeners[0]?.({
      id: "run-command-dispatch-transport-exception-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-transport-exception-001",
        command: "runtime.ping",
        command_params: {},
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await waitForPostedMessage(firstPort.postMessage, {
      id: "run-command-dispatch-transport-exception-001",
      status: "error",
      summary: expect.objectContaining({
        relay_path: "host>background>content-script>background>host"
      }),
      error: expect.objectContaining({
        code: "ERR_TRANSPORT_FORWARD_FAILED",
        message: "content script dispatch failed"
      })
    });
  });
});
