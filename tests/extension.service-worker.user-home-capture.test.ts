import { describe, expect, it, vi } from "vitest";
import {
  asRecord,
  createChromeApi,
  createFingerprintRuntimeContext,
  createMockPort,
  respondHandshake,
  startChromeBackgroundBridge,
  waitForBridgeTurn,
  waitForPostedMessage
} from "./extension.service-worker.shared.js";

const profile = "xhs_001";
const sessionId = "nm-session-001";
const targetTabId = 44;
const userId = "6505e12400000000120058d2";
const targetUrl = `https://www.xiaohongshu.com/user/profile/${userId}?xsec_token=token-001`;
const endpointUrl = `https://edith.xiaohongshu.com/api/sns/web/v1/user/otherinfo?target_user_id=${userId}&user_id=${userId}`;

const primeProfileBootstrap = async (
  port: ReturnType<typeof createMockPort>,
  runId: string
) => {
  port.onMessageListeners[0]?.({
    id: `${runId}-bootstrap`,
    method: "bridge.forward",
    profile,
    params: {
      session_id: sessionId,
      run_id: runId,
      command: "runtime.bootstrap",
      command_params: {
        version: "v1",
        run_id: runId,
        runtime_context_id: `${runId}-ctx`,
        profile,
        target_domain: "www.xiaohongshu.com",
        target_page: "profile_tab",
        target_tab_id: targetTabId,
        fingerprint_runtime: createFingerprintRuntimeContext(),
        fingerprint_patch_manifest: {
          manifest_version: "1"
        },
        main_world_secret: `${runId}-secret`
      },
      cwd: "/workspace/WebEnvoy"
    },
    timeout_ms: 100
  });
  await waitForBridgeTurn();
};

describe("runtime.xhs_capture_user_home_context", () => {
  it("captures a bound passive user_home API artifact through debugger reload", async () => {
    const port = createMockPort();
    const {
      chromeApi,
      debuggerAttach,
      debuggerDetach,
      debuggerOnEventListeners,
      debuggerSendCommand
    } = createChromeApi([port]);
    const runId = "run-user-home-capture-001";

    chromeApi.tabs.query.mockResolvedValue([{ id: targetTabId, url: targetUrl, active: true }]);
    debuggerSendCommand.mockImplementation(async (_target, command, params) => {
      if (command === "Page.reload") {
        queueMicrotask(() => {
          for (const listener of debuggerOnEventListeners) {
            listener({ tabId: targetTabId }, "Network.requestWillBeSent", {
              requestId: "user-home-request-001",
              request: {
                method: "GET",
                url: endpointUrl,
                headers: {
                  accept: "application/json",
                  Referer: targetUrl,
                  Cookie: "xhs-session=secret",
                  "X-s": "signed-secret"
                }
              }
            });
            listener({ tabId: targetTabId }, "Network.responseReceived", {
              requestId: "user-home-request-001",
              response: {
                status: 200,
                headers: {
                  "content-type": "application/json",
                  "set-cookie": "session=secret"
                }
              }
            });
            listener({ tabId: targetTabId }, "Network.loadingFinished", {
              requestId: "user-home-request-001"
            });
          }
        });
        return {};
      }
      if (command === "Network.getResponseBody") {
        expect(params).toMatchObject({ requestId: "user-home-request-001" });
        return {
          base64Encoded: false,
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                user_id: userId,
                nickname: "closeout-user"
              }
            }
          })
        };
      }
      return {};
    });

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(port);
    await waitForBridgeTurn();
    await primeProfileBootstrap(port, runId);
    port.postMessage.mockClear();

    port.onMessageListeners[0]?.({
      id: runId,
      method: "bridge.forward",
      profile,
      params: {
        session_id: sessionId,
        run_id: runId,
        command: "runtime.xhs_capture_user_home_context",
        command_params: {
          target_domain: "www.xiaohongshu.com",
          target_page: "profile_tab",
          target_tab_id: targetTabId,
          user_id: userId,
          action_ref: "action/xhs.user_home/passive_capture"
        },
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await waitForPostedMessage(port.postMessage, {
      id: runId,
      status: "success"
    });

    expect(debuggerAttach).toHaveBeenCalledWith({ tabId: targetTabId }, "1.3");
    expect(debuggerSendCommand).toHaveBeenCalledWith({ tabId: targetTabId }, "Network.enable");
    expect(debuggerSendCommand).toHaveBeenCalledWith(
      { tabId: targetTabId },
      "Page.reload",
      { ignoreCache: true }
    );
    expect(debuggerDetach).toHaveBeenCalledWith({ tabId: targetTabId });
    const response = port.postMessage.mock.calls
      .map((call) => call[0] as { id?: string; payload?: Record<string, unknown> })
      .find((message) => message.id === runId);
    const artifact = asRecord(
      asRecord(response?.payload)?.captured_request_context_artifact
    );
    expect(artifact).toMatchObject({
      route_evidence_class: "passive_api_capture",
      source_kind: "page_request",
      method: "GET",
      path: "/api/sns/web/v1/user/otherinfo",
      profile_ref: profile,
      session_id: sessionId,
      target_tab_id: targetTabId,
      run_id: runId,
      action_ref: "read",
      page_url: targetUrl,
      referrer: targetUrl,
      template_identity: expect.stringContaining(`captured:${runId}:`),
      status: 200
    });
    expect(asRecord(asRecord(artifact?.response)?.body)).toMatchObject({
      success: true,
      data: {
        user: {
          user_id: userId
        }
      }
    });
    expect(asRecord(asRecord(artifact?.request)?.headers)).toMatchObject({
      accept: "application/json",
      Referer: targetUrl,
      Cookie: "[redacted]",
      "X-s": "[redacted]"
    });
    expect(asRecord(asRecord(artifact?.response)?.headers)).toMatchObject({
      "content-type": "application/json",
      "set-cookie": "[redacted]"
    });
  });

  it("reserves response budget before user_home passive capture waits time out", async () => {
    const port = createMockPort();
    const { chromeApi, debuggerDetach, debuggerSendCommand } = createChromeApi([port]);
    const runId = "run-user-home-capture-timeout-001";

    chromeApi.tabs.query.mockResolvedValue([{ id: targetTabId, url: targetUrl, active: true }]);
    debuggerSendCommand.mockResolvedValue({});

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(port);
    await waitForBridgeTurn();
    await primeProfileBootstrap(port, runId);
    port.postMessage.mockClear();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    try {
      port.onMessageListeners[0]?.({
        id: runId,
        method: "bridge.forward",
        profile,
        params: {
          session_id: sessionId,
          run_id: runId,
          command: "runtime.xhs_capture_user_home_context",
          command_params: {
            target_domain: "www.xiaohongshu.com",
            target_page: "profile_tab",
            target_tab_id: targetTabId,
            user_id: userId
          },
          cwd: "/workspace/WebEnvoy"
        },
        timeout_ms: 10
      });

      await waitForPostedMessage(port.postMessage, {
        id: runId,
        status: "error"
      });
      expect(setTimeoutSpy.mock.calls.some((call) => call[1] === 9)).toBe(true);
    } finally {
      setTimeoutSpy.mockRestore();
    }

    expect(debuggerSendCommand).toHaveBeenCalledWith(
      { tabId: targetTabId },
      "Page.reload",
      { ignoreCache: true }
    );
    expect(debuggerDetach).toHaveBeenCalledWith({ tabId: targetTabId });
    const response = port.postMessage.mock.calls
      .map((call) => call[0] as { id?: string; payload?: Record<string, unknown> })
      .find((message) => message.id === runId);
    expect(asRecord(asRecord(response?.payload)?.details)).toMatchObject({
      reason: "USER_HOME_CAPTURE_CONTEXT_MISSING"
    });
  });
});
