import { describe, expect, it, vi } from "vitest";

import {
  createChromeApi,
  createFingerprintRuntimeContext,
  createMockPort,
  createXhsCommandParams,
  asRecord,
  primeTrustedFingerprintContext,
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

const platformBehaviorAssessmentContext = () => ({
  target_fr_ref: "FR-0022",
  validation_scope: "cross_layer_baseline"
});

const platformBehaviorAssessment = () => ({
  assessment_id: "platform-assess-sw-read-001",
  profile_ref: "profile-a",
  platform: "xhs",
  target_domain: "www.xiaohongshu.com",
  browser_channel: "Google Chrome stable",
  execution_surface: "real_browser",
  requested_execution_mode: "dry_run",
  effective_execution_mode: "dry_run",
  probe_bundle_ref: "probe-bundle-fr0022-sw-read-001",
  goal_kind: "read",
  runtime_context_id: "runtime-context-fr0022-sw-read-001",
  baseline_state: "learning",
  drift_level: "low",
  action_type: "click",
  interaction_semantics: "reveal_only_click",
  click_kind: "open_detail_view",
  threshold_config_snapshot_ref: "threshold-fr0022-sw-read-001",
  decision_hint: "allow_read_only",
  confidence: 0.7,
  evidence_refs: ["platform-signal-batch://sw-read-001"],
  assessed_at: "2026-06-12T10:00:00.000Z",
  model_version: "platform-behavior-assessor.v1",
  reseed_required: false
});

const expectedPlatformBehaviorScope = () => ({
  profile_ref: "profile-a",
  platform: "xhs",
  target_domain: "www.xiaohongshu.com",
  browser_channel: "Google Chrome stable",
  execution_surface: "real_browser",
  requested_execution_mode: "dry_run",
  effective_execution_mode: "dry_run",
  probe_bundle_ref: "probe-bundle-fr0022-sw-read-001",
  goal_kind: "read"
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

  it("forwards top-level FR-0022 platform drift command params through background XHS options", async () => {
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

    const assessment = platformBehaviorAssessment();
    const assessmentContext = platformBehaviorAssessmentContext();
    const expectedScope = expectedPlatformBehaviorScope();
    firstPort.onMessageListeners[0]?.({
      id: "run-command-dispatch-platform-behavior-top-level-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-platform-behavior-top-level-001",
        command: "xhs.search",
        command_params: createXhsCommandParams({
          run_id: "run-command-dispatch-platform-behavior-top-level-001",
          risk_state: "allowed",
          platform_behavior_assessment_required: true,
          platform_behavior_assessment: assessment,
          platform_behavior_assessment_context: assessmentContext,
          expected_platform_behavior_scope: expectedScope,
          platform_behavior_probe_bundle_ref: "probe-bundle-fr0022-sw-read-001",
          platform_behavior_as_of: "2026-06-12T10:03:00.000Z",
          platform_behavior_freshness_window_ms: 5 * 60 * 1000
        }),
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await vi.waitFor(() => {
      expect(chromeApi.tabs.sendMessage).toHaveBeenCalledWith(
        32,
        expect.objectContaining({
          id: "run-command-dispatch-platform-behavior-top-level-001",
          command: "xhs.search",
          commandParams: expect.objectContaining({
            platform_behavior_assessment_required: true,
            platform_behavior_assessment: assessment,
            platform_behavior_assessment_context: assessmentContext,
            expected_platform_behavior_scope: expectedScope,
            platform_behavior_probe_bundle_ref: "probe-bundle-fr0022-sw-read-001",
            platform_behavior_as_of: "2026-06-12T10:03:00.000Z",
            platform_behavior_freshness_window_ms: 5 * 60 * 1000,
            options: expect.objectContaining({
              platform_behavior_assessment_required: true,
              platform_behavior_assessment: assessment,
              platform_behavior_assessment_context: assessmentContext,
              expected_platform_behavior_scope: expectedScope,
              platform_behavior_probe_bundle_ref: "probe-bundle-fr0022-sw-read-001",
              platform_behavior_as_of: "2026-06-12T10:03:00.000Z",
              platform_behavior_freshness_window_ms: 5 * 60 * 1000
            })
          })
        })
      );
    });
  });

  it("fails closed before content dispatch when FR-0022 profile scope differs from request profile", async () => {
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
      id: "run-command-dispatch-platform-behavior-profile-mismatch-001",
      method: "bridge.forward",
      profile: "profile-b",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-platform-behavior-profile-mismatch-001",
        command: "xhs.search",
        command_params: createXhsCommandParams({
          run_id: "run-command-dispatch-platform-behavior-profile-mismatch-001",
          risk_state: "allowed",
          platform_behavior_assessment_required: true,
          platform_behavior_assessment: platformBehaviorAssessment({
            profile_ref: "profile-a"
          }),
          platform_behavior_assessment_context: platformBehaviorAssessmentContext(),
          expected_platform_behavior_scope: expectedPlatformBehaviorScope({
            profile_ref: "profile-a"
          }),
          platform_behavior_probe_bundle_ref: "probe-bundle-fr0022-sw-read-001",
          platform_behavior_as_of: "2026-06-12T10:03:00.000Z",
          platform_behavior_freshness_window_ms: 5 * 60 * 1000
        }),
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await waitForPostedMessage(firstPort.postMessage, {
      id: "run-command-dispatch-platform-behavior-profile-mismatch-001",
      status: "error",
      payload: expect.objectContaining({
        consumer_gate_result: expect.objectContaining({
          gate_decision: "blocked",
          gate_reasons: expect.arrayContaining(["platform_behavior_profile_ref_mismatch"])
        })
      })
    });
    expect(chromeApi.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("fails closed before content dispatch when FR-0022 hold_live_write targets live_write", async () => {
    const firstPort = createMockPort();
    const { chromeApi, runtimeMessageListeners } = createChromeApi([firstPort]);
    const creatorUrl = "https://creator.xiaohongshu.com/publish/publish?source=tab";
    chromeApi.tabs.query.mockImplementation(async () => [
      {
        id: 32,
        url: creatorUrl,
        active: true
      }
    ]);

    startChromeBackgroundBridge(chromeApi);
    respondHandshake(firstPort);
    await waitForBridgeTurn();

    const runId = "run-command-dispatch-platform-behavior-hold-live-write-001";
    const fingerprintContext = createFingerprintRuntimeContext({
      live_allowed: true,
      live_decision: "allowed",
      allowed_execution_modes: [
        "dry_run",
        "recon",
        "live_read_limited",
        "live_read_high_risk",
        "live_write"
      ]
    });
    await primeTrustedFingerprintContext({
      runtimeMessageListeners,
      runId,
      profile: "profile-a",
      fingerprintContext,
      tabId: 32,
      tabUrl: creatorUrl
    });

    const approvalRecord = {
      approved: true,
      approver: "qa-reviewer",
      approved_at: "2026-03-23T10:00:00.000Z",
      checks: {
        target_domain_confirmed: true,
        target_tab_confirmed: true,
        target_page_confirmed: true,
        risk_state_checked: true,
        action_type_confirmed: true
      }
    };
    firstPort.onMessageListeners[0]?.({
      id: runId,
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: runId,
        command: "xhs.creator_publish.controlled_live_write",
        command_params: createXhsCommandParams({
          issue_scope: "issue_835",
          target_domain: "creator.xiaohongshu.com",
          target_tab_id: 32,
          target_page: "creator_publish_tab",
          actual_target_domain: "creator.xiaohongshu.com",
          actual_target_tab_id: 32,
          actual_target_page: "creator_publish_tab",
          action_type: "write",
          requested_execution_mode: "live_write",
          risk_state: "allowed",
          controlled_live_write: true,
          approval_record: approvalRecord,
          fingerprint_context: fingerprintContext,
          platform_behavior_assessment_required: true,
          platform_behavior_assessment: {
            ...platformBehaviorAssessment(),
            target_domain: "creator.xiaohongshu.com",
            requested_execution_mode: "live_write",
            effective_execution_mode: "live_write",
            probe_bundle_ref: "probe-bundle-fr0022-sw-live-write-001",
            goal_kind: "write",
            baseline_ref: "l4-baseline-xhs-live-write-001",
            baseline_state: "ready",
            drift_level: "high",
            action_type: "type",
            interaction_semantics: undefined,
            click_kind: undefined,
            decision_hint: "hold_live_write"
          },
          platform_behavior_assessment_context: platformBehaviorAssessmentContext(),
          expected_platform_behavior_scope: {
            ...expectedPlatformBehaviorScope(),
            target_domain: "creator.xiaohongshu.com",
            requested_execution_mode: "live_write",
            effective_execution_mode: "live_write",
            probe_bundle_ref: "probe-bundle-fr0022-sw-live-write-001",
            goal_kind: "write"
          },
          platform_behavior_probe_bundle_ref: "probe-bundle-fr0022-sw-live-write-001",
          platform_behavior_as_of: "2026-06-12T10:03:00.000Z",
          platform_behavior_freshness_window_ms: 5 * 60 * 1000
        }),
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await waitForPostedMessage(firstPort.postMessage, {
      id: runId,
      status: "error",
      payload: expect.objectContaining({
        consumer_gate_result: expect.objectContaining({
          gate_decision: "blocked",
          effective_execution_mode: "dry_run",
          gate_reasons: expect.arrayContaining(["platform_behavior_hold_live_write"]),
          platform_behavior_assessment_gate: expect.objectContaining({
            accepted_risk_hint: true,
            read_write_allow_proof: false,
            decision_hint: "hold_live_write"
          })
        })
      })
    });
    expect(chromeApi.tabs.sendMessage).not.toHaveBeenCalled();
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

  it("fails closed before content dispatch when FR-0022 probe bundle context is missing", async () => {
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
      id: "run-command-dispatch-platform-behavior-probe-missing-001",
      method: "bridge.forward",
      profile: "profile-a",
      params: {
        session_id: "nm-session-001",
        run_id: "run-command-dispatch-platform-behavior-probe-missing-001",
        command: "xhs.search",
        command_params: createXhsCommandParams({
          run_id: "run-command-dispatch-platform-behavior-probe-missing-001",
          risk_state: "allowed",
          platform_behavior_assessment_required: true,
          platform_behavior_assessment: platformBehaviorAssessment(),
          platform_behavior_assessment_context: platformBehaviorAssessmentContext(),
          expected_platform_behavior_scope: expectedPlatformBehaviorScope(),
          platform_behavior_as_of: "2026-06-12T10:03:00.000Z",
          platform_behavior_freshness_window_ms: 5 * 60 * 1000
        }),
        cwd: "/workspace/WebEnvoy"
      },
      timeout_ms: 100
    });

    await waitForPostedMessage(firstPort.postMessage, {
      id: "run-command-dispatch-platform-behavior-probe-missing-001",
      status: "error",
      payload: expect.objectContaining({
        consumer_gate_result: expect.objectContaining({
          gate_decision: "blocked",
          gate_reasons: expect.arrayContaining([
            "platform_behavior_xhs_probe_bundle_ref_missing",
            "platform_behavior_expected_probe_bundle_ref_missing"
          ])
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
