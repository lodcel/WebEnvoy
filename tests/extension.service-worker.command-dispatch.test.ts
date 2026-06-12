import { describe, expect, it, vi } from "vitest";

import {
  createChromeApi,
  createMockPort,
  createXhsCommandParams,
  asRecord,
  respondHandshake,
  startChromeBackgroundBridge,
  waitForBridgeTurn,
  waitForPostedMessage
} from "./extension.service-worker.shared.js";

const acceptedRiskEvidenceGateResult = () => ({
  schema_version: "webenvoy-risk-evidence-boundary.v1",
  risk_state: "accepted",
  decision: "allow_input_to_1188",
  blocking_reasons: [],
  evaluated_at: "2026-06-12T10:00:00Z",
  downstream_owner: "#1188",
  risk_evidence_ref: "risk-evidence://fr-0070/run-sw-risk-evidence-top-level/accepted",
  evidence_refs_consumed: ["risk-evidence://fr-0070/evidence/run-sw-risk-evidence-top-level"]
});

const acceptedBehaviorBaselineHint = () => ({
  schema_version: "webenvoy-behavior-baseline-hint.v1",
  target_fr_ref: "FR-0022",
  validation_scope: "cross_layer_baseline",
  assessment_ref: "behavior-assessment://service-worker/current-head/run-001",
  baseline_ref: "platform-behavior-baseline://xhs/www/read/v1",
  baseline_state: "ready",
  drift_level: "low",
  decision_hint: "allow_read_only",
  confidence: 0.82,
  profile_ref: "profile-a",
  target_domain: "www.xiaohongshu.com",
  browser_channel: "Google Chrome stable",
  execution_surface: "real_browser",
  effective_execution_mode: "dry_run",
  probe_bundle_ref: "probe-bundle://fr-0022/xhs-read",
  goal_kind: "read",
  reseed_required: false,
  evidence_refs_consumed: ["platform-behavior-signal-batch://run-001"],
  assessed_at: "2026-06-12T09:51:00.000Z"
});

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

  it("forwards top-level #1188 risk evidence command params through background XHS options", async () => {
    const firstPort = createMockPort();
    const { chromeApi } = createChromeApi([firstPort]);
    chromeApi.tabs.query.mockImplementation(async () => [
      {
        id: 32,
        url: "https://www.xiaohongshu.com/search_result?keyword=露营",
        active: true
      }
    ]);

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await waitForBridgeTurn();

    const riskEvidenceGateResult = acceptedRiskEvidenceGateResult();
    firstPort.onMessageListeners[0]?.({
      id: "run-command-dispatch-risk-evidence-top-level-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-risk-evidence-top-level-001",
        command: "xhs.search",
        command_params: createXhsCommandParams({
          run_id: "run-command-dispatch-risk-evidence-top-level-001",
          risk_state: "allowed",
          risk_evidence_required: true,
          risk_evidence_gate_result: riskEvidenceGateResult,
          non_proofs_observed: []
        }),
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await vi.waitFor(() => {
      expect(chromeApi.tabs.sendMessage).toHaveBeenCalledWith(
        32,
        expect.objectContaining({
          id: "run-command-dispatch-risk-evidence-top-level-001",
          command: "xhs.search",
          commandParams: expect.objectContaining({
            risk_evidence_required: true,
            risk_evidence_gate_result: riskEvidenceGateResult,
            non_proofs_observed: [],
            options: expect.objectContaining({
              risk_evidence_required: true,
              risk_evidence_gate_result: riskEvidenceGateResult,
              non_proofs_observed: []
            })
          })
        })
      );
    });
  });

  it("forwards top-level behavior baseline hint command params through background XHS options", async () => {
    const firstPort = createMockPort();
    const { chromeApi } = createChromeApi([firstPort]);
    chromeApi.tabs.query.mockImplementation(async () => [
      {
        id: 32,
        url: "https://www.xiaohongshu.com/search_result?keyword=露营",
        active: true
      }
    ]);

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await waitForBridgeTurn();

    const riskEvidenceGateResult = acceptedRiskEvidenceGateResult();
    const behaviorBaselineHint = acceptedBehaviorBaselineHint();
    firstPort.onMessageListeners[0]?.({
      id: "run-command-dispatch-behavior-baseline-top-level-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-behavior-baseline-top-level-001",
        command: "xhs.search",
        command_params: createXhsCommandParams({
          run_id: "run-command-dispatch-behavior-baseline-top-level-001",
          risk_state: "allowed",
          risk_evidence_required: true,
          risk_evidence_gate_result: riskEvidenceGateResult,
          behavior_baseline_hint_required: true,
          behavior_baseline_hint: behaviorBaselineHint
        }),
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await vi.waitFor(() => {
      expect(chromeApi.tabs.sendMessage).toHaveBeenCalledWith(
        32,
        expect.objectContaining({
          id: "run-command-dispatch-behavior-baseline-top-level-001",
          command: "xhs.search",
          commandParams: expect.objectContaining({
            behavior_baseline_hint_required: true,
            behavior_baseline_hint: behaviorBaselineHint,
            options: expect.objectContaining({
              behavior_baseline_hint_required: true,
              behavior_baseline_hint: behaviorBaselineHint
            })
          })
        })
      );
    });
  });

  it("fails closed when top-level #1188 non-proof command params are unknown", async () => {
    const firstPort = createMockPort();
    const { chromeApi } = createChromeApi([firstPort]);
    chromeApi.tabs.query.mockImplementation(async () => [
      {
        id: 32,
        url: "https://www.xiaohongshu.com/search_result?keyword=露营",
        active: true
      }
    ]);

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await waitForBridgeTurn();

    firstPort.onMessageListeners[0]?.({
      id: "run-command-dispatch-risk-evidence-unknown-non-proof-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-risk-evidence-unknown-non-proof-001",
        command: "xhs.search",
        command_params: createXhsCommandParams({
          run_id: "run-command-dispatch-risk-evidence-unknown-non-proof-001",
          risk_state: "allowed",
          non_proofs_observed: ["runtime_bootstrap_ack_typo", { source: "runtime_ping" }]
        }),
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await waitForPostedMessage(firstPort.postMessage, {
      id: "run-command-dispatch-risk-evidence-unknown-non-proof-001",
      status: "error",
      payload: expect.objectContaining({
        consumer_gate_result: expect.objectContaining({
          gate_decision: "blocked",
          gate_reasons: expect.arrayContaining(["risk_evidence_unclassified"])
        })
      })
    });
    expect(chromeApi.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("fails closed when top-level #1188 accepted risk evidence payload is malformed", async () => {
    const firstPort = createMockPort();
    const { chromeApi } = createChromeApi([firstPort]);
    chromeApi.tabs.query.mockImplementation(async () => [
      {
        id: 32,
        url: "https://www.xiaohongshu.com/search_result?keyword=露营",
        active: true
      }
    ]);

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await waitForBridgeTurn();

    const malformedRiskEvidence = acceptedRiskEvidenceGateResult() as Record<string, unknown>;
    delete malformedRiskEvidence.blocking_reasons;
    firstPort.onMessageListeners[0]?.({
      id: "run-command-dispatch-risk-evidence-malformed-accepted-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-risk-evidence-malformed-accepted-001",
        command: "xhs.search",
        command_params: createXhsCommandParams({
          run_id: "run-command-dispatch-risk-evidence-malformed-accepted-001",
          risk_state: "allowed",
          risk_evidence_required: true,
          risk_evidence_gate_result: malformedRiskEvidence
        }),
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await waitForPostedMessage(firstPort.postMessage, {
      id: "run-command-dispatch-risk-evidence-malformed-accepted-001",
      status: "error",
      payload: expect.objectContaining({
        consumer_gate_result: expect.objectContaining({
          gate_decision: "blocked",
          gate_reasons: expect.arrayContaining(["risk_evidence_unclassified"])
        })
      })
    });
    const payload = asRecord(
      firstPort.postMessage.mock.calls.find(
        (call) =>
          (call[0] as { id?: string }).id ===
          "run-command-dispatch-risk-evidence-malformed-accepted-001"
      )?.[0]
    )?.payload;
    const consumerGateResult = asRecord(payload?.consumer_gate_result);
    expect(asRecord(consumerGateResult?.risk_evidence_consumer_gate)).toMatchObject({
      required: true,
      accepted_risk_input: false,
      decision: "blocked"
    });
    expect(chromeApi.tabs.sendMessage).not.toHaveBeenCalled();
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
