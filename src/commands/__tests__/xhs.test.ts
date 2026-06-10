import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildOfficialChromeRuntimeStatusParams,
  buildXhsCloseoutEvidenceTrustedBindingForContract,
  ensureOfficialChromeRuntimeReady,
  evaluateXhsCloseoutEvidenceForContract,
  evaluateXhsSearchPrimaryPassiveApiReadinessForContract,
  mergeXhsCloseoutEvidenceSummaryFieldsForRuntimeContract,
  normalizeGateOptionsForContract,
  pickXhsCloseoutEvidenceSummaryFieldsForContract,
  requiresCloseoutAuditForXhsBridgeSummaryForContract,
  requiresCanonicalExecutionAuditForContract,
  resolveForwardTimeoutMsForContract,
  resolveXhsCommandForwardTimeoutMsForContract,
  resolveXhsCloseoutRuntimeLatestHeadShaForContract,
  shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract
} from "../xhs.js";
import { executeCommand } from "../../core/router.js";
import { createCommandRegistry } from "../index.js";
import { NativeMessagingBridge } from "../../runtime/native-messaging/bridge.js";
import { FR0032_APPROVED_FIXTURE_IMAGE_A_DIGEST } from "../../../shared/fr0032-approved-source-media.js";
import { createLoopbackNativeBridgeTransport } from "../../runtime/native-messaging/loopback.js";
import { ProfileStore } from "../../runtime/profile-store.js";
import {
  SQLiteRuntimeStore,
  resolveRuntimeStorePath,
  type GateAuditRecord
} from "../../runtime/store/sqlite-runtime-store.js";
import {
  persistXhsCloseoutValidationSignals,
  persistXhsCloseoutValidationSourceEvidence,
  persistXhsCloseoutValidationSourceSamples
} from "../../runtime/anti-detection-validation.js";
import {
  buildSessionRhythmFormalView,
  markXhsCloseoutSingleProbeFailed,
  toSessionRhythmStatusView
} from "../../runtime/xhs-closeout-rhythm.js";
import type { RuntimeContext } from "../../core/types.js";

type DatabaseSyncCtor = new (path: string) => {
  prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
  close: () => void;
};

const ISSUE209_APPROVAL_CHECKS = {
  target_domain_confirmed: true,
  target_tab_confirmed: true,
  target_page_confirmed: true,
  risk_state_checked: true,
  action_type_confirmed: true
};

let xhsCloseoutValidationSeedSequence = 0;

const createApprovedAnonymousReadAdmissionContext = (runId: string, requestId: string) => ({
  approval_admission_evidence: {
    approval_admission_ref: `approval_admission_${runId}_${requestId}`,
    run_id: runId,
    session_id: "nm-session-001",
    issue_scope: "issue_209",
    target_domain: "www.xiaohongshu.com",
    target_tab_id: 32,
    target_page: "explore_detail_tab",
    action_type: "read",
    requested_execution_mode: "live_read_high_risk",
    approved: true,
    approver: "qa-reviewer",
    approved_at: "2026-03-23T10:00:00Z",
    checks: ISSUE209_APPROVAL_CHECKS,
    recorded_at: "2026-03-23T10:00:00Z"
  },
  audit_admission_evidence: {
    audit_admission_ref: `audit_admission_${runId}_${requestId}`,
    run_id: runId,
    session_id: "nm-session-001",
    issue_scope: "issue_209",
    target_domain: "www.xiaohongshu.com",
    target_tab_id: 32,
    target_page: "explore_detail_tab",
    action_type: "read",
    requested_execution_mode: "live_read_high_risk",
    risk_state: "allowed",
    audited_checks: ISSUE209_APPROVAL_CHECKS,
    recorded_at: "2026-03-23T10:00:30Z"
  }
});

const createIssue209FormalApprovalRecord = (decisionId: string, approvalId: string) => ({
  decision_id: decisionId,
  approval_id: approvalId,
  approved: true,
  approver: "mcontheway",
  approved_at: "2026-04-23T14:17:30Z",
  checks: ISSUE209_APPROVAL_CHECKS
});

const createIssue209FormalAuditRecord = (
  requestId: string,
  decisionId: string,
  approvalId: string
) => ({
  event_id: `gate_evt_${decisionId}`,
  decision_id: decisionId,
  approval_id: approvalId,
  request_id: requestId,
  issue_scope: "issue_209",
  target_domain: "www.xiaohongshu.com",
  target_tab_id: 32,
  target_page: "search_result_tab",
  action_type: "read",
  requested_execution_mode: "live_read_high_risk",
  risk_state: "allowed",
  gate_decision: "allowed",
  audited_checks: ISSUE209_APPROVAL_CHECKS,
  recorded_at: "2026-04-23T14:17:31Z"
});

const createApprovedIssue835LiveWriteAdmissionContext = (input: {
  runId: string;
  targetTabId: number;
}) => ({
  approval_admission_evidence: {
    approval_admission_ref: `approval_admission_${input.runId}`,
    run_id: input.runId,
    issue_scope: "issue_835",
    target_domain: "creator.xiaohongshu.com",
    target_tab_id: input.targetTabId,
    target_page: "creator_publish_tab",
    action_type: "write",
    requested_execution_mode: "live_write",
    approved: true,
    approver: "mcontheway",
    approved_at: "2026-06-04T13:40:00.000Z",
    checks: {
      target_domain_confirmed: true,
      target_tab_confirmed: true,
      target_page_confirmed: true,
      risk_state_checked: true,
      action_type_confirmed: true
    },
    recorded_at: "2026-06-04T13:40:00.000Z"
  },
  audit_admission_evidence: {
    audit_admission_ref: `audit_admission_${input.runId}`,
    run_id: input.runId,
    issue_scope: "issue_835",
    target_domain: "creator.xiaohongshu.com",
    target_tab_id: input.targetTabId,
    target_page: "creator_publish_tab",
    action_type: "write",
    requested_execution_mode: "live_write",
    risk_state: "allowed",
    audited_checks: {
      target_domain_confirmed: true,
      target_tab_confirmed: true,
      target_page_confirmed: true,
      risk_state_checked: true,
      action_type_confirmed: true
    },
    recorded_at: "2026-06-04T13:41:00.000Z"
  }
});

const seedXhsCloseoutReady = async (input: {
  cwd: string;
  profile: string;
  effectiveExecutionMode?: "live_read_high_risk" | "live_read_limited" | "live_write";
  validationTargetDomain?: "www.xiaohongshu.com" | "creator.xiaohongshu.com";
  validationTargetPage?: "search_result_tab" | "creator_publish_tab";
  validationEvidenceMode?: "live_read_high_risk" | "live_write";
  validationProbeBundleRef?:
    | "probe-bundle/xhs-closeout-min-v1"
    | "probe-bundle/xhs-creator-live-write-admission-v1";
}) => {
  const effectiveExecutionMode = input.effectiveExecutionMode ?? "live_read_high_risk";
  const validationTargetDomain = input.validationTargetDomain ?? "www.xiaohongshu.com";
  const validationTargetPage = input.validationTargetPage ?? "search_result_tab";
  const validationEvidenceMode = input.validationEvidenceMode ?? "live_read_high_risk";
  const validationProbeBundleRef =
    input.validationProbeBundleRef ?? "probe-bundle/xhs-closeout-min-v1";
  const profileStore = new ProfileStore(join(input.cwd, ".webenvoy", "profiles"));
  const meta =
    (await profileStore.readMeta(input.profile, { mode: "readonly" }).catch(() => null)) ??
    (await profileStore.initializeMeta(input.profile, "2026-04-25T10:00:00.000Z", {
      allowUnsupportedExtensionBrowser: true
    }));
  await profileStore.writeMeta(input.profile, {
    ...meta,
    accountSafety: {
      state: "clear",
      platform: null,
      reason: null,
      observedAt: null,
      cooldownUntil: null,
      sourceRunId: null,
      sourceCommand: null,
      targetDomain: null,
      targetTabId: null,
      pageUrl: null,
      statusCode: null,
      platformCode: null
    },
    xhsCloseoutRhythm: {
      state: "single_probe_passed",
      cooldownUntil: "2000-01-01T00:30:00.000Z",
      operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
      singleProbeRequired: false,
      singleProbePassedAt: "2026-04-25T10:40:00.000Z",
      probeRunId: `run-${input.profile}-recovery-probe`,
      fullBundleBlocked: true,
      reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_PASSED", "ANTI_DETECTION_BASELINE_REQUIRED"]
    }
  });

  const store = new SQLiteRuntimeStore(resolveRuntimeStorePath(input.cwd));
  try {
    xhsCloseoutValidationSeedSequence += 1;
    const validationRunId = `run-${input.profile}-xhs-closeout-validation-${process.pid}-${xhsCloseoutValidationSeedSequence}`;
    const validationSignals = {
      layer1_consistency: {
        browser_returned_evidence: {
          source: "main_world",
          target_domain: validationTargetDomain,
          target_page: validationTargetPage,
          requested_execution_mode: validationEvidenceMode,
          probe_bundle_ref: validationProbeBundleRef
        },
        fingerprint_runtime: {
          fingerprint_profile_bundle_ref: "fingerprint-bundle/xhs-closeout",
          fingerprint_patch_manifest: {
            required_patches: ["audio_context", "battery", "navigator_plugins", "navigator_mime_types"]
          },
          injection: {
            installed: true,
            required_patches: ["audio_context", "battery", "navigator_plugins", "navigator_mime_types"],
            missing_required_patches: [],
            source: "main_world"
          }
        }
      },
      layer2_interaction: {
        browser_returned_evidence: {
          source: "main_world",
          target_domain: validationTargetDomain,
          target_page: validationTargetPage,
          requested_execution_mode: validationEvidenceMode,
          probe_bundle_ref: validationProbeBundleRef
        },
        event_strategy_profile: {
          action_kind: "scroll",
          preferred_path: "real_input"
        },
        event_chain_policy: {
          chain_name: "scroll_segment",
          required_events: ["wheel", "scroll"]
        },
        rhythm_profile: {
          profile_name: "default_layer2",
          scroll_segment_min_px: 120,
          scroll_segment_max_px: 480,
          source_run_id: validationRunId
        },
        strategy_selection: {
          action_kind: "scroll",
          selected_path: "real_input"
        },
        execution_trace: {
          action_kind: "scroll",
          selected_path: "real_input",
          settled_wait_result: "settled",
          action_ref: `action-${validationRunId}`,
          session_id: "nm-session-001",
          target_tab_id: 32
        }
      },
      layer3_session_rhythm: {
        browser_returned_evidence: {
          source: "execution_audit",
          target_domain: validationTargetDomain,
          target_page: validationTargetPage,
          requested_execution_mode: validationEvidenceMode,
          probe_bundle_ref: validationProbeBundleRef
        },
        session_rhythm_window_id: `rhythm_win_${input.profile}_issue_209`,
        session_rhythm_decision_id: `rhythm_decision_${input.profile}_single_probe`,
        escalation: "recon_probe_to_live_admission"
      }
    };
    if (validationTargetDomain === "creator.xiaohongshu.com") {
      const sourceAudit: GateAuditRecord = {
        event_id: `gate_evt_${validationRunId}`,
        decision_id: `gate_decision_${validationRunId}`,
        approval_id: `gate_approval_${validationRunId}`,
        run_id: validationRunId,
        session_id: "nm-session-001",
        profile: input.profile,
        issue_scope: "issue_835",
        risk_state: "allowed",
        next_state: "allowed",
        transition_trigger: "gate_evaluation",
        target_domain: validationTargetDomain,
        target_tab_id: 32,
        target_page: validationTargetPage,
        action_type: "write",
        action_ref: `action-${validationRunId}`,
        requested_execution_mode: validationEvidenceMode,
        effective_execution_mode: validationEvidenceMode,
        gate_decision: "allowed",
        gate_reasons: ["XHS_CREATOR_LIVE_WRITE_VALIDATION_SOURCE_APPROVED"],
        approver: "runtime.xhs_closeout_validation_source",
        approved_at: "2026-04-25T10:45:00.000Z",
        recorded_at: "2026-04-25T10:45:00.000Z",
        created_at: "2026-04-25T10:45:00.000Z"
      };
      const samples = await persistXhsCloseoutValidationSourceEvidence({
        store,
        profile: input.profile,
        effectiveExecutionMode,
        targetDomain: validationTargetDomain,
        targetPage: validationTargetPage,
        sourceRunId: validationRunId,
        observedAt: "2026-04-25T10:45:00.000Z",
        sourceAudit,
        actionRef: `action-${validationRunId}`,
        signals: validationSignals,
        artifactRefs: [`artifact/xhs-creator-live-write-validation-source/${validationRunId}`]
      });
      await persistXhsCloseoutValidationSourceSamples({
        store,
        profile: input.profile,
        effectiveExecutionMode,
        targetDomain: validationTargetDomain,
        targetPage: validationTargetPage,
        validationRunId: `${validationRunId}-view`,
        observedAt: "2026-04-25T10:45:05.000Z",
        sourceRunId: validationRunId,
        sourceSamples: samples
      });
      return;
    }
    await persistXhsCloseoutValidationSignals({
      store,
      profile: input.profile,
      effectiveExecutionMode,
      targetDomain: validationTargetDomain,
      runId: validationRunId,
      observedAt: "2026-04-25T10:45:00.000Z",
      signals: validationSignals
    });
  } finally {
    store.close();
  }
};

const createSchemaMismatchRuntimeStore = async (cwd: string): Promise<void> => {
  const require = createRequire(import.meta.url);
  const sqliteModule = require("node:sqlite") as { DatabaseSync?: DatabaseSyncCtor };
  if (typeof sqliteModule.DatabaseSync !== "function") {
    throw new Error("node:sqlite DatabaseSync unavailable");
  }
  await mkdir(join(cwd, ".webenvoy", "runtime"), { recursive: true });
  const db = new sqliteModule.DatabaseSync(resolveRuntimeStorePath(cwd));
  try {
    db.prepare("CREATE TABLE runtime_store_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
    db.prepare("INSERT INTO runtime_store_meta(key, value) VALUES('schema_version', ?)").run("999");
  } finally {
    db.close();
  }
};

describe("buildSessionRhythmFormalView", () => {
  it("keeps shared session rhythm status view compatible with the issue_209 default", () => {
    expect(
      toSessionRhythmStatusView({
        profile: "xhs_missing_issue_scope_profile",
        rhythm: {
          state: "single_probe_passed",
          cooldownUntil: null,
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: false,
          singleProbePassedAt: "2026-04-25T10:50:00.000Z",
          probeRunId: "run-missing-scope-default-probe",
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_PASSED"]
        },
        sessionId: "nm-session-missing-scope-default"
      })
    ).toMatchObject({
      issue_scope: "issue_209",
      session_rhythm_window_state: expect.objectContaining({
        window_id: "rhythm_win_xhs_missing_issue_scope_profile_issue_209"
      })
    });
  });

  it("keeps historical recovery-probe failure reasons from overriding current account risk events", () => {
    const rhythm = {
      state: "cooldown" as const,
      cooldownUntil: "2026-04-25T11:20:00.000Z",
      operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
      singleProbeRequired: true,
      singleProbePassedAt: null,
      probeRunId: "run-old-recovery-probe",
      fullBundleBlocked: true,
      reasonCodes: [
        "XHS_RECOVERY_SINGLE_PROBE_FAILED",
        "XHS_CLOSEOUT_COOLDOWN_EXTENDED",
        "ACCOUNT_ABNORMAL",
        "ACCOUNT_RISK_BLOCKED"
      ]
    };
    const accountSafety = {
      state: "account_risk_blocked" as const,
      platform: "xhs",
      reason: "ACCOUNT_ABNORMAL" as const,
      observedAt: "2026-04-25T10:50:00.000Z",
      cooldownUntil: "2026-04-25T11:20:00.000Z",
      sourceRunId: "run-current-risk",
      sourceCommand: "xhs.search",
      targetDomain: "www.xiaohongshu.com",
      targetTabId: 33,
      pageUrl: "https://www.xiaohongshu.com/search_result",
      statusCode: null,
      platformCode: null
    };

    expect(
      buildSessionRhythmFormalView({
        profile: "xhs_risk_priority_profile",
        rhythm,
        accountSafety,
        issueScope: "issue_209",
        sessionId: "nm-session-risk-priority",
        sourceRunId: "run-current-risk",
        now: new Date("2026-04-25T10:51:00.000Z")
      }).event
    ).toMatchObject({
      event_id: "rhythm_evt_run-current-risk",
      event_type: "risk_signal",
      reason: "XHS_CLOSEOUT_COOLDOWN_ACTIVE"
    });
    expect(
      buildSessionRhythmFormalView({
        profile: "xhs_risk_priority_profile",
        rhythm,
        accountSafety,
        issueScope: "issue_209",
        sessionId: "nm-session-risk-priority",
        sourceRunId: "run-current-risk",
        now: new Date("2026-04-25T10:51:00.000Z")
      }).decision
    ).toMatchObject({
      decision_id: "rhythm_decision_run-current-risk",
      run_id: "run-current-risk"
    });

    expect(
      buildSessionRhythmFormalView({
        profile: "xhs_risk_priority_profile",
        rhythm,
        accountSafety,
        issueScope: "issue_209",
        sessionId: "nm-session-risk-priority",
        sourceRunId: "run-old-recovery-probe",
        eventTypeOverride: "recovery_probe_failed",
        eventReasonOverride: "ACCOUNT_ABNORMAL",
        now: new Date("2026-04-25T10:51:00.000Z")
      }).event
    ).toMatchObject({
      event_type: "recovery_probe_failed",
      reason: "ACCOUNT_ABNORMAL"
    });
  });

  it("keeps recovery failure reason codes bounded while preserving the latest failure reason", () => {
    const record = markXhsCloseoutSingleProbeFailed({
      current: {
        state: "single_probe_required",
        cooldownUntil: null,
        operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
        singleProbeRequired: true,
        singleProbePassedAt: null,
        probeRunId: null,
        fullBundleBlocked: true,
        reasonCodes: Array.from({ length: 40 }, (_, index) => `HISTORICAL_REASON_${index}`)
      },
      failedAt: "2026-04-25T10:50:00.000Z",
      probeRunId: "run-bounded-recovery-probe",
      reasonCode: "ACCOUNT_ABNORMAL"
    });

    expect(record.reasonCodes.length).toBeLessThanOrEqual(24);
    expect(record.reasonCodes).toEqual(
      expect.arrayContaining([
        "XHS_RECOVERY_SINGLE_PROBE_FAILED",
        "XHS_CLOSEOUT_COOLDOWN_EXTENDED",
        "ACCOUNT_ABNORMAL"
      ])
    );
    expect(record.reasonCodes).not.toContain("HISTORICAL_REASON_0");
  });

  it("preserves the latest duplicate recovery failure reason for formal event overrides", () => {
    const record = markXhsCloseoutSingleProbeFailed({
      current: {
        state: "single_probe_required",
        cooldownUntil: null,
        operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
        singleProbeRequired: true,
        singleProbePassedAt: null,
        probeRunId: null,
        fullBundleBlocked: true,
        reasonCodes: [
          "ACCOUNT_ABNORMAL",
          ...Array.from({ length: 40 }, (_, index) => `HISTORICAL_REASON_${index}`)
        ]
      },
      failedAt: "2026-04-25T10:50:00.000Z",
      probeRunId: "run-duplicate-recovery-probe",
      reasonCode: "ACCOUNT_ABNORMAL"
    });

    expect(record.reasonCodes.length).toBeLessThanOrEqual(24);
    expect(record.reasonCodes).toContain("ACCOUNT_ABNORMAL");
    expect(
      toSessionRhythmStatusView({
        profile: "xhs_duplicate_reason_profile",
        rhythm: record,
        issueScope: "issue_209",
        sessionId: "nm-session-duplicate-reason",
        sourceRunId: "run-duplicate-recovery-probe",
        eventTypeOverride: "recovery_probe_failed",
        eventReasonOverride: "ACCOUNT_ABNORMAL",
        now: new Date("2026-04-25T10:51:00.000Z")
      })
    ).toMatchObject({
      latest_reason: "ACCOUNT_ABNORMAL",
      session_rhythm_event: expect.objectContaining({
        event_type: "recovery_probe_failed",
        reason: "ACCOUNT_ABNORMAL"
      })
    });
  });

  it("uses an explicit event reason override even when the reason is diagnostic-only", () => {
    expect(
      toSessionRhythmStatusView({
        profile: "xhs_diagnostic_reason_profile",
        rhythm: {
          state: "cooldown",
          cooldownUntil: "2026-04-25T11:20:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: "run-diagnostic-recovery-probe",
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_FAILED", "XHS_CLOSEOUT_COOLDOWN_EXTENDED"]
        },
        issueScope: "issue_209",
        sessionId: "nm-session-diagnostic-reason",
        eventTypeOverride: "recovery_probe_failed",
        eventReasonOverride: "ACCOUNT_ABNORMAL",
        now: new Date("2026-04-25T10:51:00.000Z")
      })
    ).toMatchObject({
      latest_reason: "ACCOUNT_ABNORMAL",
      session_rhythm_event: expect.objectContaining({
        reason: "ACCOUNT_ABNORMAL"
      })
    });
  });
});

describe("ensureOfficialChromeRuntimeReady", () => {
  it("does not forward persistent extension identity into runtime.status params", () => {
    expect(
      buildOfficialChromeRuntimeStatusParams(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_ready_profile",
          run_id: "run-xhs-ready-identity-001",
          command: "xhs.search",
          params: {
            persistentExtensionIdentity: {
              extensionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              manifestPath: "/tmp/native-host-manifest.json"
            }
          }
        },
        "live_read_high_risk"
      )
    ).toEqual({
      requested_execution_mode: "live_read_high_risk"
    });
  });

  it("delivers runtime.bootstrap before allowing official Chrome execution to proceed", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "ready",
        identityBindingState: "bound",
        bootstrapState: "ready",
        transportState: "ready",
        lockHeld: true
      });
    const bridge = {
      runCommand: vi.fn(async (request: { params: { runtime_context_id: string } }) => ({
        ok: true,
        payload: {
          result: {
            version: "v1",
            run_id: "run-xhs-ready-001",
            runtime_context_id: request.params.runtime_context_id,
            profile: "official_ready_profile",
            status: "ready"
          }
        },
        error: null
      }))
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_ready_profile",
          run_id: "run-xhs-ready-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).resolves.toBeUndefined();

    expect(readStatus).toHaveBeenCalledTimes(2);
    expect(bridge.runCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        command: "runtime.bootstrap",
        params: expect.objectContaining({
          version: "v1",
          run_id: "run-xhs-ready-001",
          profile: "official_ready_profile",
          target_tab_id: 32
        })
      })
    );
    const bootstrapCommand = bridge.runCommand.mock.calls[0]?.[0];
    expect(bootstrapCommand.params.runtime_context_id).toEqual(expect.any(String));
    expect(bootstrapCommand.params.main_world_secret).toEqual(expect.any(String));
  });

  it("skips re-bootstrap when official Chrome runtime already reports ready", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "ready",
        identityBindingState: "bound",
        bootstrapState: "ready",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "ready",
        identityBindingState: "bound",
        bootstrapState: "ready",
        transportState: "ready",
        lockHeld: true
      });
    const bridge = {
      runCommand: vi.fn(async (request: { params: { runtime_context_id: string } }) => ({
        ok: true,
        payload: {
          result: {
            version: "v1",
            run_id: "run-xhs-live-ready-rebootstrap-001",
            runtime_context_id: request.params.runtime_context_id,
            profile: "official_live_ready_profile",
            status: "ready"
          }
        },
        error: null
      }))
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_live_ready_profile",
          run_id: "run-xhs-live-ready-rebootstrap-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).resolves.toBeUndefined();

    expect(bridge.runCommand).not.toHaveBeenCalled();
  });

  it("keeps caller fingerprint runtime when runtime is already ready", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "ready",
        identityBindingState: "bound",
        bootstrapState: "ready",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "ready",
        identityBindingState: "bound",
        bootstrapState: "ready",
        transportState: "ready",
        lockHeld: true
      });
    const bridge = {
      runCommand: vi.fn(async (request: { params: { runtime_context_id: string } }) => ({
        ok: true,
        payload: {
          result: {
            version: "v1",
            run_id: "run-xhs-live-ready-attested-001",
            runtime_context_id: request.params.runtime_context_id,
            profile: "official_live_ready_attested_profile",
            status: "ready"
          },
          fingerprint_runtime: {
            fingerprint_profile_bundle: {
              id: "bundle-attested"
            },
            fingerprint_patch_manifest: {
              runtime_id: "runtime-attested"
            },
            injection: {
              installed: true,
              channel: "main_world"
            }
          }
        },
        error: null
      }))
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_live_ready_attested_profile",
          run_id: "run-xhs-live-ready-attested-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_write",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "creator.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "creator_publish_tab",
          options: {
            requested_execution_mode: "live_write"
          }
        } as never,
        readStatus
      )
    ).resolves.toBeUndefined();
    expect(bridge.runCommand).not.toHaveBeenCalled();
  });

  it("re-bootstrap current run when readiness reports stale bootstrap state", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "blocked",
        identityBindingState: "bound",
        bootstrapState: "stale",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "ready",
        identityBindingState: "bound",
        bootstrapState: "ready",
        transportState: "ready",
        lockHeld: true
      });
    const bridge = {
      runCommand: vi.fn(async (request: { params: { runtime_context_id: string } }) => ({
        ok: true,
        payload: {
          result: {
            version: "v1",
            run_id: "run-xhs-stale-bootstrap-001",
            runtime_context_id: request.params.runtime_context_id,
            profile: "official_stale_bootstrap_profile",
            status: "ready"
          }
        },
        error: null
      }))
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_stale_bootstrap_profile",
          run_id: "run-xhs-stale-bootstrap-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).resolves.toBeUndefined();

    expect(readStatus).toHaveBeenCalledTimes(2);
    expect(bridge.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "runtime.bootstrap",
        params: expect.objectContaining({
          run_id: "run-xhs-stale-bootstrap-001",
          profile: "official_stale_bootstrap_profile"
        })
      })
    );
  });

  it("reuses the same runtime_context_id across same-run bootstrap retries", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      });
    const bridge = {
      runCommand: vi.fn(async (request: { command: string; params: { runtime_context_id: string } }) => {
        if (request.command === "runtime.bootstrap") {
          return {
            ok: true,
            payload: {
              result: {
                version: "v1",
                run_id: "run-xhs-retry-001",
                runtime_context_id: request.params.runtime_context_id,
                profile: "official_retry_profile",
                status: "ready"
              }
            },
            error: null
          };
        }
        if (request.command === "runtime.readiness") {
          return {
            ok: true,
            payload: {
              transport_state: "ready",
              bootstrap_state: "pending"
            },
            error: null
          };
        }
        throw new Error(`unexpected command: ${request.command}`);
      })
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_retry_profile",
          run_id: "run-xhs-retry-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).rejects.toMatchObject({
      code: "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED"
    });

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_retry_profile",
          run_id: "run-xhs-retry-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).rejects.toMatchObject({
      code: "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED"
    });

    const bootstrapContexts = bridge.runCommand.mock.calls
      .filter(([request]) => request.command === "runtime.bootstrap")
      .map(([request]) => request.params.runtime_context_id);

    expect(bootstrapContexts).toHaveLength(2);
    expect(bootstrapContexts[0]).toBe(bootstrapContexts[1]);
  });

  it("waits for bridge readiness when runtime.bootstrap is initially not delivered", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      });
    const bridge = {
      runCommand: vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          error: {
            code: "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED",
            message: "runtime bootstrap 尚未获得执行面确认"
          }
        })
        .mockResolvedValueOnce({
          ok: true,
          payload: {
            transport_state: "ready",
            bootstrap_state: "pending"
          },
          error: null
        })
        .mockResolvedValueOnce({
          ok: true,
          payload: {
            transport_state: "ready",
            bootstrap_state: "ready"
          },
          error: null
        })
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_first_command_profile",
          run_id: "run-xhs-first-command-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).resolves.toBeUndefined();

    expect(bridge.runCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        command: "runtime.bootstrap"
      })
    );
    expect(bridge.runCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        command: "runtime.ping",
        params: expect.objectContaining({
          fingerprint_runtime: expect.objectContaining({
            fingerprint_profile_bundle: null
          }),
          target_domain: "www.xiaohongshu.com",
          target_tab_id: 32,
          target_page: "search_result_tab"
        })
      })
    );
    expect(bridge.runCommand).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        command: "runtime.readiness"
      })
    );
  });

  it("keeps runtime gated when lock is lost before the final official Chrome gate", async () => {
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "pending",
        identityBindingState: "bound",
        bootstrapState: "pending",
        transportState: "ready",
        lockHeld: true
      })
      .mockResolvedValueOnce({
        identityPreflight: {
          mode: "official_chrome_persistent_extension"
        },
        runtimeReadiness: "blocked",
        identityBindingState: "bound",
        bootstrapState: "ready",
        transportState: "ready",
        lockHeld: false
      });
    const bridge = {
      runCommand: vi.fn(async (request: { params: { runtime_context_id: string } }) => ({
        ok: true,
        payload: {
          result: {
            version: "v1",
            run_id: "run-xhs-missing-transport-001",
            runtime_context_id: request.params.runtime_context_id,
            profile: "official_missing_transport_state_profile",
            status: "ready"
          }
        },
        error: null
      }))
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_missing_transport_state_profile",
          run_id: "run-xhs-missing-transport-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).rejects.toMatchObject({
      code: "ERR_PROFILE_LOCKED",
      details: expect.objectContaining({
        runtime_readiness: "blocked",
        bootstrap_state: "ready",
        transport_state: "ready",
        lock_held: false,
        reason: "ERR_PROFILE_LOCKED"
      })
    });
  });

  it("blocks execution bootstrap while profile is still logging_in", async () => {
    const readStatus = vi.fn(async () => ({
      identityPreflight: {
        mode: "official_chrome_persistent_extension"
      },
      profileState: "logging_in",
      confirmationRequired: true,
      runtimeReadiness: "pending",
      identityBindingState: "bound",
      bootstrapState: "pending",
      transportState: "ready",
      lockHeld: true
    }));
    const bridge = {
      runCommand: vi.fn()
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_logging_in_profile",
          run_id: "run-xhs-logging-in-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).rejects.toMatchObject({
      code: "ERR_RUNTIME_UNAVAILABLE",
      retryable: false,
      details: expect.objectContaining({
        profile_state: "logging_in",
        confirmation_required: true,
        reason: "ERR_RUNTIME_LOGIN_CONFIRMATION_REQUIRED"
      })
    });
    expect(bridge.runCommand).not.toHaveBeenCalled();
  });

  it("blocks execution bootstrap when confirmationRequired=true even if profile state is ready", async () => {
    const readStatus = vi.fn(async () => ({
      identityPreflight: {
        mode: "official_chrome_persistent_extension"
      },
      profileState: "ready",
      confirmationRequired: true,
      runtimeReadiness: "pending",
      identityBindingState: "bound",
      bootstrapState: "pending",
      transportState: "ready",
      lockHeld: true
    }));
    const bridge = {
      runCommand: vi.fn()
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_confirmation_pending_profile",
          run_id: "run-xhs-confirm-required-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).rejects.toMatchObject({
      code: "ERR_RUNTIME_UNAVAILABLE",
      retryable: false,
      details: expect.objectContaining({
        profile_state: "ready",
        confirmation_required: true,
        reason: "ERR_RUNTIME_LOGIN_CONFIRMATION_REQUIRED"
      })
    });
    expect(bridge.runCommand).not.toHaveBeenCalled();
  });

  it("surfaces missing official runtime readiness signals before execution", async () => {
    const readStatus = vi.fn(async () => ({
      identityPreflight: {
        mode: "official_chrome_persistent_extension"
      },
      profileState: "ready",
      confirmationRequired: false,
      runtimeReadiness: "recoverable",
      identityBindingState: "bound",
      bootstrapState: "not_started",
      transportState: "not_connected",
      lockHeld: true
    }));
    const bridge = {
      runCommand: vi.fn(async () => ({
        ok: true,
        payload: {
          message: "pong"
        },
        relay_path: "host>background>content-script>background>host"
      }))
    };

    await expect(
      ensureOfficialChromeRuntimeReady(
        {
          cwd: "/tmp/webenvoy",
          profile: "official_transport_not_connected_profile",
          run_id: "run-xhs-transport-not-connected-001"
        } as never,
        {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        } as never,
        "live_read_high_risk",
        bridge as never,
        {
          fingerprint_profile_bundle: null
        } as never,
        {
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          targetPage: "search_result_tab",
          options: {
            requested_execution_mode: "live_read_high_risk"
          }
        } as never,
        readStatus
      )
    ).rejects.toMatchObject({
      code: "ERR_RUNTIME_UNAVAILABLE",
      details: expect.objectContaining({
        reason: "ERR_RUNTIME_READINESS_SIGNAL_MISSING",
        relay_path: "host>background>content-script>background>host"
      })
    });
    expect(bridge.runCommand).toHaveBeenCalledTimes(1);
    expect(bridge.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "runtime.readiness"
      })
    );
  });
});

describe("normalizeGateOptionsForContract", () => {
  it("requires canonical execution audit only for explicit closeout production markers", () => {
    expect(
      requiresCanonicalExecutionAuditForContract({
        payload: {
          request_admission_result: {
            request_ref: "upstream_req_legacy",
            admission_decision: "blocked"
          },
          execution_audit: null
        }
      })
    ).toBe(false);

    expect(
      requiresCanonicalExecutionAuditForContract({
        summary: {
          closeout_audit_required: true,
          request_admission_result: {
            request_ref: "upstream_req_closeout",
            admission_decision: "allowed"
          },
          execution_audit: null
        }
      })
    ).toBe(true);

    expect(
      requiresCanonicalExecutionAuditForContract({
        summary: {
          route_evidence: {
            route_role: "primary",
            path_kind: "api",
            evidence_status: "success"
          }
        }
      })
    ).toBe(false);

    expect(
      requiresCanonicalExecutionAuditForContract({
        summary: {
          closeout_evidence_input: {
            expected: {},
            evidence: {}
          },
          closeout_evidence_rounds: []
        }
      })
    ).toBe(false);

    expect(
      requiresCanonicalExecutionAuditForContract({
        summary: {
          closeout_evidence_input: {
            expected: {},
            evidence: {}
          },
          closeout_evidence_evaluation: {
            decision: "PASS",
            passed: true
          }
        }
      })
    ).toBe(false);

    expect(
      requiresCanonicalExecutionAuditForContract({
        summary: {
          closeout_route_evidence: {
            route_role: "primary",
            path_kind: "api",
            evidence_status: "success"
          }
        }
      })
    ).toBe(false);

    expect(
      requiresCanonicalExecutionAuditForContract({
        summary: {
          closeout_evidence_evaluation: {
            evaluator: "xhs-closeout-route-evidence"
          },
          route_evidence: {
            route_role: "primary",
            path_kind: "api",
            evidence_status: "success"
          }
        }
      })
    ).toBe(true);

    expect(
      requiresCanonicalExecutionAuditForContract({
        summary: {
          closeout_evidence_evaluation: {
            evaluator: "xhs-closeout-route-evidence"
          },
          request_admission_result: {
            request_ref: "upstream_req_closeout",
            admission_decision: "allowed"
          },
          execution_audit: null
        }
      })
    ).toBe(true);

    expect(
      requiresCanonicalExecutionAuditForContract({
        details: {
          closeout_evidence_evaluation: {
            decision: "PASS",
            passed: true
          }
        }
      })
    ).toBe(false);

    expect(
      requiresCanonicalExecutionAuditForContract({
        details: {
          request_admission_result: {
            request_ref: "upstream_req_closeout",
            admission_decision: "allowed"
          },
          route_evidence_evaluation: {
            route_role: "primary",
            path_kind: "api",
            evidence_status: "success"
          }
        }
      })
    ).toBe(true);
  });

  it("marks live XHS closeout route evidence summaries as audit required", () => {
    const routeEvidenceSummary = {
      route_evidence: {
        route: "xhs.search.api",
        route_role: "primary",
        path_kind: "api",
        evidence_status: "success"
      }
    };

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: routeEvidenceSummary
      })
    ).toBe(true);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.search.notes.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: routeEvidenceSummary
      })
    ).toBe(true);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.note.detail.v1",
        requestedExecutionMode: "live_read_limited",
        summary: routeEvidenceSummary
      })
    ).toBe(true);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: {
          closeout_route_evidence: {
            route: "xhs.search.api",
            route_role: "primary",
            path_kind: "api",
            evidence_status: "success"
          }
        }
      })
    ).toBe(true);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: {
          closeout_audit_required: true,
          route_evidence: {
            route: "xhs.search.api",
            route_role: "primary",
            path_kind: "api",
            evidence_status: "success"
          }
        }
      })
    ).toBe(true);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.user.home.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: {
          route_evidence: {
            route_evidence_class: "passive_api_capture"
          }
        }
      })
    ).toBe(true);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: {
          route_evidence: {
            evidence_class: "passive_api_capture"
          }
        }
      })
    ).toBe(true);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "recon",
        summary: routeEvidenceSummary
      })
    ).toBe(false);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: {
          metrics: {
            count: 1
          }
        }
      })
    ).toBe(false);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: {
          route_evidence: {
            route: "xhs.search.api"
          }
        }
      })
    ).toBe(false);

    expect(
      shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
        abilityId: "xhs.note.unknown.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: routeEvidenceSummary
      })
    ).toBe(false);
  });

  it("keeps legacy bridge route evidence on the audit path without deterministic fields", () => {
    const routeEvidenceSummary = {
      route_evidence: {
        route: "xhs.search.api",
        route_role: "primary",
        path_kind: "api",
        evidence_status: "success"
      }
    };

    expect(
      requiresCloseoutAuditForXhsBridgeSummaryForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: routeEvidenceSummary
      })
    ).toBe(true);

    expect(
      requiresCloseoutAuditForXhsBridgeSummaryForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "live_read_high_risk",
        summary: {
          closeout_route_evidence: routeEvidenceSummary.route_evidence
        }
      })
    ).toBe(true);

    expect(
      requiresCloseoutAuditForXhsBridgeSummaryForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "recon",
        summary: routeEvidenceSummary
      })
    ).toBe(false);

    expect(
      requiresCloseoutAuditForXhsBridgeSummaryForContract({
        abilityId: "xhs.note.search.v1",
        requestedExecutionMode: "recon",
        summary: {
          closeout_evidence_input: null
        }
      })
    ).toBe(false);
  });

  it("runs deterministic closeout multi-round evaluation for explicit runtime evidence input", async () => {
    const summary = {
      closeout_evidence_input: {
        expected: {
          latest_head_sha: "head-closeout-001",
          run_id: "run-closeout-001",
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
          artifact_identities: [
            "artifact/xhs-closeout/run-closeout-001/round-1",
            "artifact/xhs-closeout/run-closeout-001/round-2"
          ],
          profile_ref: "profile/xhs_closeout_001",
          target_tab_id: 32,
          page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
          action_ref: "action/xhs.search/open_result_card"
        },
        evidence: {
          route_role: "primary",
          path_kind: "api",
          evidence_status: "success",
          evidence_class: "passive_api_capture",
          head_sha: "head-closeout-001",
          run_id: "run-closeout-001",
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
          profile_ref: "profile/xhs_closeout_001",
          target_tab_id: 32,
          page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
          action_ref: "action/xhs.search/open_result_card"
        },
        evidence_rounds: [
          {
            route_role: "primary",
            path_kind: "api",
            evidence_status: "success",
            evidence_class: "passive_api_capture",
            head_sha: "head-closeout-001",
            run_id: "run-closeout-001",
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
            profile_ref: "profile/xhs_closeout_001",
            target_tab_id: 32,
            page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
            action_ref: "action/xhs.search/open_result_card"
          },
          {
            route_role: "primary",
            path_kind: "api",
            evidence_status: "success",
            evidence_class: "passive_api_capture",
            head_sha: "head-closeout-001",
            run_id: "run-closeout-001",
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2",
            profile_ref: "profile/xhs_closeout_001",
            target_tab_id: 32,
            page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
            action_ref: "action/xhs.search/open_result_card"
          }
        ]
      }
    };

    expect(evaluateXhsCloseoutEvidenceForContract(summary)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: [],
      multi_round: {
        accepted_round_count: 2,
        unique_artifact_count: 2
      }
    });

    const runtimeTrustedBinding = buildXhsCloseoutEvidenceTrustedBindingForContract({
      cwd: process.cwd(),
      runId: "run-closeout-001",
      profileRef: "profile/xhs_closeout_001",
      targetTabId: 32,
      summary
    });
    expect(runtimeTrustedBinding.latestHeadSha).toMatch(/^[0-9a-f]{40}$/u);
    expect(runtimeTrustedBinding.requiresLatestHeadSha).toBe(true);
    expect(evaluateXhsCloseoutEvidenceForContract(summary, runtimeTrustedBinding)).toMatchObject({
      decision: "FAIL",
      passed: false,
      freshness: expect.objectContaining({
        latest_head_matches: false
      }),
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_head"
        })
      ])
    });

    const externalCwdTrustedBinding = buildXhsCloseoutEvidenceTrustedBindingForContract({
      cwd: "/tmp/webenvoy-closeout-non-git",
      runId: "run-closeout-001",
      profileRef: "profile/xhs_closeout_001",
      targetTabId: 32,
      summary
    });
    expect(externalCwdTrustedBinding.latestHeadSha).toBe(runtimeTrustedBinding.latestHeadSha);
    expect(externalCwdTrustedBinding.requiresLatestHeadSha).toBe(true);

    const previousNpmPackageGitHead = process.env.npm_package_gitHead;
    process.env.npm_package_gitHead = "caller-repository-head";
    try {
      expect(resolveXhsCloseoutRuntimeLatestHeadShaForContract("/tmp/webenvoy-closeout-non-git"))
        .toBe(runtimeTrustedBinding.latestHeadSha);
    } finally {
      if (previousNpmPackageGitHead === undefined) {
        delete process.env.npm_package_gitHead;
      } else {
        process.env.npm_package_gitHead = previousNpmPackageGitHead;
      }
    }

    const metadataRuntimeDir = await mkdtemp(join(tmpdir(), "webenvoy-runtime-metadata-"));
    try {
      await mkdir(join(metadataRuntimeDir, "dist"), { recursive: true });
      await writeFile(
        join(metadataRuntimeDir, "dist", "runtime-build-metadata.json"),
        JSON.stringify({
          name: "@webenvoy/cli",
          gitHead: "head-closeout-metadata"
        }),
        "utf8"
      );
      expect(resolveXhsCloseoutRuntimeLatestHeadShaForContract(metadataRuntimeDir))
        .toBe(runtimeTrustedBinding.latestHeadSha);
    } finally {
      await rm(metadataRuntimeDir, { recursive: true, force: true });
    }

    const metadataCheckoutDir = await mkdtemp(join(tmpdir(), "webenvoy-runtime-metadata-checkout-"));
    try {
      await mkdir(join(metadataCheckoutDir, "dist"), { recursive: true });
      await writeFile(
        join(metadataCheckoutDir, "package.json"),
        JSON.stringify({
          name: "@webenvoy/cli"
        }),
        "utf8"
      );
      await writeFile(
        join(metadataCheckoutDir, "dist", "runtime-build-metadata.json"),
        JSON.stringify({
          name: "@webenvoy/cli",
          gitHead: "head-closeout-prebuilt"
        }),
        "utf8"
      );
      await writeFile(join(metadataCheckoutDir, "tracked.txt"), "checkout-head\n", "utf8");
      for (const args of [
        ["init"],
        ["config", "user.email", "tests@example.com"],
        ["config", "user.name", "Tests"],
        ["add", "."],
        ["commit", "-m", "test checkout head"]
      ]) {
        const result = spawnSync("git", args, {
          cwd: metadataCheckoutDir,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        });
        expect(result.status, `${args.join(" ")}\n${result.stderr}`).toBe(0);
      }

      expect(resolveXhsCloseoutRuntimeLatestHeadShaForContract(metadataCheckoutDir))
        .toBe(runtimeTrustedBinding.latestHeadSha);
    } finally {
      await rm(metadataCheckoutDir, { recursive: true, force: true });
    }

    const sourceCheckoutDir = await mkdtemp(join(tmpdir(), "webenvoy-runtime-source-checkout-"));
    try {
      await mkdir(join(sourceCheckoutDir, "dist"), { recursive: true });
      await mkdir(join(sourceCheckoutDir, "src", "commands"), { recursive: true });
      await writeFile(
        join(sourceCheckoutDir, "package.json"),
        JSON.stringify({
          name: "@webenvoy/cli"
        }),
        "utf8"
      );
      await writeFile(
        join(sourceCheckoutDir, "dist", "runtime-build-metadata.json"),
        JSON.stringify({
          name: "@webenvoy/cli",
          gitHead: "head-closeout-stale-prebuilt"
        }),
        "utf8"
      );
      await writeFile(
        join(sourceCheckoutDir, "src", "commands", "xhs-runtime.ts"),
        "export const source = true;\n",
        "utf8"
      );
      for (const args of [
        ["init"],
        ["config", "user.email", "tests@example.com"],
        ["config", "user.name", "Tests"],
        ["add", "."],
        ["commit", "-m", "test source checkout head"]
      ]) {
        const result = spawnSync("git", args, {
          cwd: sourceCheckoutDir,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        });
        expect(result.status, `${args.join(" ")}\n${result.stderr}`).toBe(0);
      }
      const headResult = spawnSync("git", ["rev-parse", "HEAD"], {
        cwd: sourceCheckoutDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });
      expect(headResult.status, headResult.stderr).toBe(0);
      const sourceCheckoutHead = headResult.stdout.trim();

      expect(resolveXhsCloseoutRuntimeLatestHeadShaForContract(sourceCheckoutDir))
        .not.toBe(sourceCheckoutHead);
      expect(resolveXhsCloseoutRuntimeLatestHeadShaForContract(sourceCheckoutDir))
        .toBe(runtimeTrustedBinding.latestHeadSha);
    } finally {
      await rm(sourceCheckoutDir, { recursive: true, force: true });
    }

    expect(evaluateXhsCloseoutEvidenceForContract(summary, externalCwdTrustedBinding)).toMatchObject({
      decision: "FAIL",
      passed: false,
      freshness: expect.objectContaining({
        latest_head_matches: false
      }),
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_head"
        })
      ])
    });

    expect(
      evaluateXhsCloseoutEvidenceForContract(summary, {
        requiresLatestHeadSha: true,
        runId: "run-closeout-001",
        profileRef: "profile/xhs_closeout_001",
        targetTabId: 32
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      freshness: expect.objectContaining({
        latest_head_available: false,
        latest_head_matches: false
      }),
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_latest_head"
        })
      ])
    });

    expect(
      evaluateXhsCloseoutEvidenceForContract(summary, { runId: "run-closeout-current" })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_run"
        })
      ]),
      freshness: expect.objectContaining({
        run_matches: false,
        expected_run_id: "run-closeout-001",
        observed_run_id: "run-closeout-001"
      })
    });

    const runtimeBoundSummary = {
      closeout_evidence_input: {
        expected: {
          ...summary.closeout_evidence_input.expected,
          latest_head_sha: null,
          run_id: null,
          profile_ref: null,
          target_tab_id: null
        },
        evidence: summary.closeout_evidence_input.evidence,
        evidence_rounds: summary.closeout_evidence_input.evidence_rounds
      }
    };
    const packagedRuntimeDir = await mkdtemp(join(tmpdir(), "webenvoy-packaged-runtime-"));
    try {
      await writeFile(
        join(packagedRuntimeDir, "package.json"),
        JSON.stringify({
          name: "@webenvoy/cli",
          gitHead: "head-closeout-001"
        })
      );
      const packagedRuntimeTrustedBinding = buildXhsCloseoutEvidenceTrustedBindingForContract({
        cwd: packagedRuntimeDir,
        runId: "run-closeout-001",
        profileRef: "profile/xhs_closeout_001",
        targetTabId: 32,
        summary: runtimeBoundSummary
      });

      expect(packagedRuntimeTrustedBinding.latestHeadSha).toBe(runtimeTrustedBinding.latestHeadSha);
      expect(
        evaluateXhsCloseoutEvidenceForContract(
          runtimeBoundSummary,
          packagedRuntimeTrustedBinding
        )
      ).toMatchObject({
        decision: "FAIL",
        passed: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({
            blocker_code: "stale_head"
          })
        ])
      });
    } finally {
      await rm(packagedRuntimeDir, { recursive: true, force: true });
    }
    expect(
      evaluateXhsCloseoutEvidenceForContract(runtimeBoundSummary, {
        runId: "run-closeout-001",
        profileRef: "profile/xhs_closeout_001",
        targetTabId: 32
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });

    expect(
      evaluateXhsCloseoutEvidenceForContract(summary, {
        latestHeadSha: "head-closeout-current",
        runId: "run-closeout-001",
        profileRef: "profile/xhs_closeout_current",
        targetTabId: 44
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "stale_head" }),
        expect.objectContaining({ blocker_code: "missing_profile_binding" }),
        expect.objectContaining({ blocker_code: "missing_tab_binding" })
      ]),
      freshness: expect.objectContaining({
        latest_head_matches: false
      }),
      bindings: expect.objectContaining({
        profile_bound: false,
        tab_bound: false
      })
    });

    const runtimeProfileBoundSummary = {
      closeout_evidence_input: {
        expected: {
          ...summary.closeout_evidence_input.expected,
          profile_ref: null
        },
        evidence: summary.closeout_evidence_input.evidence,
        evidence_rounds: summary.closeout_evidence_input.evidence_rounds
      }
    };
    expect(
      evaluateXhsCloseoutEvidenceForContract(runtimeProfileBoundSummary, {
        latestHeadSha: "head-closeout-001",
        runId: "run-closeout-001",
        profileRef: "xhs_closeout_001",
        targetTabId: 32
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: []
    });
  });

  it("emits missing_multi_round_evidence for explicit runtime closeout input without deterministic rounds", () => {
    const summary = {
      closeout_evidence_input: {
        expected: {
          latest_head_sha: "head-closeout-001",
          run_id: "run-closeout-001",
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
          profile_ref: "profile/xhs_closeout_001",
          target_tab_id: 32,
          page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
          action_ref: "action/xhs.search/open_result_card"
        },
        evidence: {
          route_role: "primary",
          path_kind: "api",
          evidence_status: "success",
          evidence_class: "passive_api_capture",
          head_sha: "head-closeout-001",
          run_id: "run-closeout-001",
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
          profile_ref: "profile/xhs_closeout_001",
          target_tab_id: 32,
          page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
          action_ref: "action/xhs.search/open_result_card"
        }
      }
    };

    expect(evaluateXhsCloseoutEvidenceForContract(summary)).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("keeps explicit singleton evidence and validates it against the artifact allowlist", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const canonicalRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const siblingRound = {
      ...canonicalRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: {
          expected,
          evidence: siblingRound,
          evidence_rounds: [siblingRound, canonicalRound]
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      freshness: {
        artifact_matches: true,
        observed_artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
      },
      blockers: []
    });
  });

  it("keeps stale explicit singleton evidence on the fail-fast path", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: {
          expected,
          evidence: {
            ...firstRound,
            head_sha: "head-closeout-stale"
          },
          evidence_rounds: [firstRound, secondRound]
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      freshness: expect.objectContaining({
        observed_head_sha: "head-closeout-stale"
      }),
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_head"
        })
      ])
    });
  });

  it("accepts allowlist-only closeout expectations", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: null,
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: {
          expected,
          evidence_rounds: [firstRound, secondRound]
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("prefers deterministic rounds over stale closeout_route_evidence for allowlist expectations", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: null,
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_expected: expected,
        closeout_route_evidence: {
          ...firstRound,
          head_sha: "head-closeout-stale",
          run_id: "run-closeout-stale"
        },
        closeout_evidence_rounds: [firstRound, secondRound]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("unions deterministic closeout rounds from nested input and top-level fields", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: {
          expected,
          evidence_rounds: [firstRound]
        },
        closeout_evidence_rounds: [
          {
            ...firstRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("ignores legacy route evidence rounds when deterministic closeout rounds are present", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [firstRound, secondRound],
        route_evidence: {
          ...firstRound,
          evidence_rounds: [
            {
              ...firstRound,
              head_sha: "stale-head",
              artifact_identity: "artifact/xhs-closeout/run-closeout-stale/round-1"
            }
          ]
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("uses legacy route evidence rounds when deterministic rounds are only placeholders", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [],
        route_evidence: {
          ...firstRound,
          evidence_rounds: [firstRound, secondRound]
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("requires explicit artifact allowlists for caller-provided closeout rounds", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [
          firstRound,
          {
            ...firstRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      freshness: {
        expected_artifact_identities: ["artifact/xhs-closeout/run-closeout-001/round-1"]
      },
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        })
      ])
    });
  });

  it("counts top-level route evidence as a legacy round for singular artifact closeout", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2",
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: expected.artifact_identity
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_expected: expected,
        route_evidence: {
          ...firstRound,
          evidence_rounds: [secondRound]
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      multi_round: expect.objectContaining({
        accepted_round_count: 2,
        unique_artifact_count: 2
      }),
      blockers: []
    });
  });

  it("merges top-level closeout round arrays from root and summary", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: [firstRound],
      summary: {
        closeout_evidence_rounds: [secondRound]
      }
    });

    expect(picked).toMatchObject({
      closeout_evidence_rounds: [firstRound, secondRound]
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("merges caller closeout rounds without self-authorizing expected artifacts", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/current",
      artifact_identities: ["artifact/xhs-closeout/run-closeout-001/current"],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/search_result?keyword=closeout",
      action_ref: "action/xhs.search/query"
    };
    const previousRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/previous",
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const currentRound = {
      ...previousRound,
      artifact_identity: expected.artifact_identity
    };

    const merged = mergeXhsCloseoutEvidenceSummaryFieldsForRuntimeContract(
      {
        summary: {
          closeout_evidence_expected: expected,
          closeout_evidence_rounds: [currentRound]
        }
      },
      {
        closeout_evidence_rounds: [previousRound]
      }
    );

    expect(merged).toMatchObject({
      closeout_evidence_expected: {
        artifact_identities: ["artifact/xhs-closeout/run-closeout-001/current"]
      },
      closeout_evidence_rounds: [currentRound]
    });
    expect(evaluateXhsCloseoutEvidenceForContract(merged)).toMatchObject({
      decision: "FAIL",
      passed: false,
      reproduced_multi_round: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("keeps stale artifact rounds in deterministic evaluation", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: null,
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: {
          expected,
          evidence_rounds: [
            {
              ...firstRound,
              artifact_identity: "artifact/xhs-closeout/run-closeout-001/unrelated"
            },
            firstRound,
            secondRound
          ]
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      reproduced_multi_round: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        })
      ])
    });
  });

  it("keeps stale allowlisted rounds in deterministic evaluation", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: null,
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: {
          expected,
          evidence_rounds: [
            {
              ...firstRound,
              head_sha: "head-closeout-stale"
            },
            firstRound,
            secondRound
          ]
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_head"
        })
      ])
    });
  });

  it("falls back to complete rounds when explicit singleton evidence is incomplete", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: {
          expected,
          evidence: {
            artifact_identity: expected.artifact_identity
          },
          evidence_rounds: [
            firstRound,
            {
              ...firstRound,
              artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
            }
          ]
        }
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("runs deterministic closeout evaluation from the emitted route_evidence summary shape", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const routeEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_expected: expected,
        route_evidence: routeEvidence,
        closeout_evidence_rounds: [
          routeEvidence,
          {
            ...routeEvidence,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("does not derive route_evidence artifact allowlist from observed evidence_rounds", () => {
    const routeEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      latest_head_sha: "head-closeout-001",
      head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        route_evidence: routeEvidence,
        closeout_evidence_rounds: [
          routeEvidence,
          {
            ...routeEvidence,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("does not derive expected binding from route_evidence with top-level closeout rounds", () => {
    const routeEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      latest_head_sha: "head-closeout-001",
      head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        route_evidence: routeEvidence,
        closeout_evidence_rounds: [
          routeEvidence,
          {
            ...routeEvidence,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("does not derive expected binding from route_evidence with nested rounds", () => {
    const routeEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      latest_head_sha: "head-closeout-001",
      head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card",
      evidence_rounds: [
        {
          route_role: "primary",
          path_kind: "api",
          evidence_status: "success",
          evidence_class: "passive_api_capture",
          head_sha: "head-closeout-001",
          run_id: "run-closeout-001",
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2",
          profile_ref: "profile/xhs_closeout_001",
          target_tab_id: 32,
          page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
          action_ref: "action/xhs.search/open_result_card"
        }
      ]
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        route_evidence: routeEvidence
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("uses top-level closeout expectations with route_evidence as the observed round", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const routeEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        closeout_evidence_expected: expected,
        route_evidence: routeEvidence,
        closeout_evidence_rounds: [
          routeEvidence,
          {
            ...routeEvidence,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("prefers canonical route_evidence over sibling evidence_rounds", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const canonicalRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const siblingRound = {
      ...canonicalRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        closeout_evidence_expected: expected,
        route_evidence: canonicalRound,
        closeout_evidence_rounds: [siblingRound]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      freshness: {
        artifact_matches: true,
        observed_artifact_identity: expected.artifact_identity
      },
      blockers: []
    });
  });

  it("prefers canonical closeout rounds over sibling route_evidence", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const canonicalRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const siblingRound = {
      ...canonicalRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        closeout_evidence_expected: expected,
        route_evidence: siblingRound,
        closeout_evidence_rounds: [canonicalRound, siblingRound]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      freshness: {
        artifact_matches: true,
        observed_artifact_identity: expected.artifact_identity
      },
      blockers: []
    });
  });

  it("falls back to top-level closeout fields when nested closeout input is incomplete", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: {
          expected: null,
          evidence_rounds: []
        },
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [
          firstRound,
          {
            ...firstRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("keeps malformed nested closeout rounds instead of falling back to top-level rounds", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: {
          expected,
          evidence_rounds: [{}]
        },
        closeout_evidence_rounds: [
          firstRound,
          {
            ...firstRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "non_primary_route"
        })
      ])
    });
  });

  it("keeps nested summary closeout payloads when top-level fields are null", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_expected: null,
      closeout_evidence_rounds: null,
      summary: {
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [
          firstRound,
          {
            ...firstRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      }
    });

    expect(picked).toMatchObject({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: expect.any(Array)
    });
    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        ...picked
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("keeps richer nested summary closeout payloads when top-level fields are sparse", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_expected: {},
      closeout_evidence_rounds: [],
      route_evidence: {},
      summary: {
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [
          firstRound,
          {
            ...firstRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ],
        route_evidence: firstRound
      }
    });

    expect(picked).toMatchObject({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: expect.any(Array),
      route_evidence: firstRound
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("keeps nested summary closeout input when top-level fields are partial shells", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const closeoutEvidenceInput = {
      expected,
      evidence_rounds: [
        firstRound,
        {
          ...firstRound,
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
        }
      ]
    };
    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_input: {
        expected: {
          latest_head_sha: null,
          run_id: null
        },
        evidence: {}
      },
      summary: {
        closeout_evidence_input: closeoutEvidenceInput
      }
    });

    expect(picked).toEqual({
      closeout_evidence_input: closeoutEvidenceInput
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("keeps richer summary closeout input when root input omits rounds", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const closeoutEvidenceInput = {
      expected,
      evidence: firstRound,
      evidence_rounds: [
        firstRound,
        {
          ...firstRound,
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
        }
      ]
    };
    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_input: {
        expected,
        evidence: firstRound
      },
      summary: {
        closeout_evidence_input: closeoutEvidenceInput
      }
    });

    expect(picked).toEqual({
      closeout_evidence_input: closeoutEvidenceInput
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("merges nested summary closeout input without dropping root rounds", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const evidenceRounds = [
      firstRound,
      {
        ...firstRound,
        artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
      }
    ];

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_input: {
        evidence_rounds: evidenceRounds
      },
      summary: {
        closeout_evidence_input: {
          expected,
          evidence: firstRound
        }
      }
    });

    expect(picked).toEqual({
      closeout_evidence_input: {
        expected,
        evidence: firstRound,
        evidence_rounds: evidenceRounds
      }
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("combines split nested closeout input rounds from root and summary", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_input: {
        expected,
        evidence_rounds: [firstRound]
      },
      summary: {
        closeout_evidence_input: {
          evidence_rounds: [secondRound]
        }
      }
    });

    expect(picked).toEqual({
      closeout_evidence_input: {
        expected,
        evidence_rounds: [firstRound, secondRound]
      }
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("unions same-length closeout rounds before preferring richer summary records", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2",
      diagnostic_ref: "summary-rich-round"
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_input: {
        expected,
        evidence_rounds: [firstRound]
      },
      summary: {
        closeout_evidence_input: {
          evidence_rounds: [secondRound]
        }
      }
    });

    expect(picked).toMatchObject({
      closeout_evidence_input: {
        expected,
        evidence_rounds: [firstRound, secondRound]
      }
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("drops sparse root closeout round placeholders before merging summary rounds", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: [{}],
      summary: {
        closeout_evidence_rounds: [firstRound, secondRound]
      }
    });

    expect(picked).toMatchObject({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: [firstRound, secondRound]
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("drops sparse nested closeout round placeholders before merging summary input rounds", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_input: {
        expected,
        evidence_rounds: [{}]
      },
      summary: {
        closeout_evidence_input: {
          evidence_rounds: [firstRound, secondRound]
        }
      }
    });

    expect(picked).toMatchObject({
      closeout_evidence_input: {
        expected,
        evidence_rounds: [firstRound, secondRound]
      }
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("accepts artifact_ref aliases in deterministic closeout rounds", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_ref: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_ref: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [firstRound, secondRound]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("deduplicates duplicate nested closeout rounds by artifact identity", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_input: {
        expected,
        evidence_rounds: [
          firstRound,
          {
            artifact_identity: secondRound.artifact_identity
          }
        ]
      },
      summary: {
        closeout_evidence_input: {
          evidence_rounds: [secondRound]
        }
      }
    });

    expect(picked).toEqual({
      closeout_evidence_input: {
        expected,
        evidence_rounds: [firstRound, secondRound]
      }
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("deep-merges split closeout expected objects from root and summary", () => {
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_expected: {
        artifact_identity: firstRound.artifact_identity,
        artifact_identities: [firstRound.artifact_identity, secondRound.artifact_identity],
        page_url: firstRound.page_url,
        action_ref: firstRound.action_ref
      },
      closeout_evidence_rounds: [firstRound, secondRound],
      summary: {
        closeout_evidence_expected: {
          latest_head_sha: firstRound.head_sha,
          run_id: firstRound.run_id,
          profile_ref: firstRound.profile_ref,
          target_tab_id: firstRound.target_tab_id
        }
      }
    });

    expect(picked).toMatchObject({
      closeout_evidence_expected: {
        latest_head_sha: firstRound.head_sha,
        run_id: firstRound.run_id,
        artifact_identity: firstRound.artifact_identity,
        artifact_identities: [firstRound.artifact_identity, secondRound.artifact_identity],
        profile_ref: firstRound.profile_ref,
        target_tab_id: firstRound.target_tab_id,
        page_url: firstRound.page_url,
        action_ref: firstRound.action_ref
      }
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("preserves refreshed root closeout expected bindings over stale summary copies", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: [
        firstRound,
        {
          ...firstRound,
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
        }
      ],
      summary: {
        closeout_evidence_expected: {
          ...expected,
          latest_head_sha: "head-closeout-stale",
          run_id: "run-closeout-stale"
        }
      }
    });

    expect(picked.closeout_evidence_expected).toMatchObject(expected);
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: []
    });
  });

  it("preserves refreshed root closeout input bindings over stale summary copies", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_input: {
        expected,
        evidence_rounds: [
          firstRound,
          {
            ...firstRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      },
      summary: {
        closeout_evidence_input: {
          expected: {
            ...expected,
            artifact_identity: "artifact/xhs-closeout/run-closeout-stale/round-1",
            page_url: "https://www.xiaohongshu.com/explore?keyword=stale",
            action_ref: "action/xhs.search/stale"
          }
        }
      }
    });

    expect(picked).toMatchObject({
      closeout_evidence_input: {
        expected
      }
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: []
    });
  });

  it("prefers richer same-length summary closeout rounds over root placeholders", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const summaryRounds = [
      firstRound,
      {
        ...firstRound,
        artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
      }
    ];

    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: [{ artifact_identity: expected.artifact_identity }, {}],
      summary: {
        closeout_evidence_rounds: summaryRounds
      }
    });

    expect(picked).toMatchObject({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: summaryRounds
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("prefers runtime-bound root expected over stale summary expected", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract(
        {
          closeout_evidence_input: {
            expected: {
              artifact_identity: expected.artifact_identity,
              artifact_identities: expected.artifact_identities,
              page_url: expected.page_url,
              action_ref: expected.action_ref
            },
            evidence_rounds: [
              firstRound,
              {
                ...firstRound,
                artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
              }
            ]
          },
          closeout_evidence_expected: {
            ...expected,
            run_id: "run-closeout-stale"
          }
        },
        {
          latestHeadSha: expected.latest_head_sha,
          runId: expected.run_id,
          profileRef: "xhs_closeout_001",
          targetTabId: expected.target_tab_id
        }
      )
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("preserves explicit null closeout markers when bridge summary has no fallback payload", () => {
    const picked = pickXhsCloseoutEvidenceSummaryFieldsForContract({
      closeout_evidence_input: null,
      summary: {
        metrics: {
          count: 1
        }
      }
    });

    expect(picked).toEqual({
      closeout_evidence_input: null
    });
    expect(evaluateXhsCloseoutEvidenceForContract(picked)).toBeNull();
  });

  it("preserves top-level closeout evidence payload fields before runtime evaluation", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const routeEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const summary = {
      closeout_audit_required: true,
      ...pickXhsCloseoutEvidenceSummaryFieldsForContract({
        summary: {
          route_evidence: routeEvidence
        },
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [
          routeEvidence,
          {
            ...routeEvidence,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    };

    expect(summary).toMatchObject({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: expect.any(Array),
      route_evidence: routeEvidence
    });
    expect(evaluateXhsCloseoutEvidenceForContract(summary)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("accepts top-level deterministic closeout payloads without duplicate route_evidence", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [
          {
            ...firstRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          },
          firstRound
        ]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("keeps canonical closeout evidence ahead of closeout fields injected through gate options", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const canonicalRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondCanonicalRound = {
      ...canonicalRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
    };
    const injectedRouteEvidence = {
      ...canonicalRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/stale-route"
    };

    const merged = mergeXhsCloseoutEvidenceSummaryFieldsForRuntimeContract(
      {
        summary: {
          closeout_evidence_expected: expected,
          closeout_evidence_rounds: [canonicalRound, secondCanonicalRound],
          route_evidence: canonicalRound
        }
      },
      {
        closeout_evidence_expected: {
          latest_head_sha: "head-closeout-stale",
          run_id: "run-closeout-stale",
          artifact_identity: "artifact/xhs-closeout/run-closeout-stale/round-9",
          artifact_identities: ["artifact/xhs-closeout/run-closeout-stale/round-9"],
          profile_ref: "profile/xhs_closeout_stale",
          target_tab_id: 99,
          page_url: "https://www.xiaohongshu.com/explore?keyword=stale",
          action_ref: "action/xhs.search/stale"
        },
        closeout_evidence_rounds: [injectedRouteEvidence],
        route_evidence: injectedRouteEvidence
      }
    );

    expect(merged.closeout_evidence_expected).toMatchObject(expected);
    expect(merged.closeout_evidence_rounds).toMatchObject([canonicalRound, secondCanonicalRound]);
    expect(merged.route_evidence).toMatchObject(canonicalRound);
    expect(evaluateXhsCloseoutEvidenceForContract(merged)).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: []
    });
  });

  it("uses caller-provided explicit closeout evidence rounds when bridge summary falls back", () => {
    const expected = {
      latest_head_sha: "head-closeout-detail-001",
      run_id: "run-closeout-detail-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-detail-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-detail-001/round-1",
        "artifact/xhs-closeout/run-closeout-detail-001/round-2"
      ],
      profile_ref: "profile/xhs_001",
      target_tab_id: 1230450311,
      page_url: "https://www.xiaohongshu.com/explore/detail-closeout-001",
      action_ref: "action/xhs.detail/read_note"
    };
    const firstRound = {
      route: "xhs.detail.api",
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };
    const secondRound = {
      ...firstRound,
      artifact_identity: "artifact/xhs-closeout/run-closeout-detail-001/round-2"
    };

    const merged = mergeXhsCloseoutEvidenceSummaryFieldsForRuntimeContract(
      {
        summary: {
          source: "page_state_fallback",
          metrics: {
            count: 1
          }
        }
      },
      {
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [firstRound, secondRound]
      }
    );

    expect(merged).toMatchObject({
      closeout_evidence_expected: expected,
      closeout_evidence_rounds: [firstRound, secondRound]
    });
    expect(evaluateXhsCloseoutEvidenceForContract(merged)).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("preserves closeout route_evidence success summaries until deterministic payloads are present", () => {
    expect(
      evaluateXhsCloseoutEvidenceForContract({
        route_evidence: {
          route_role: "primary",
          path_kind: "api",
          evidence_status: "success",
          evidence_class: "passive_api_capture",
          latest_head_sha: "head-closeout-001",
          head_sha: "head-closeout-001",
          run_id: "run-closeout-001",
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
          profile_ref: "profile/xhs_closeout_001",
          target_tab_id: 32,
          page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
          action_ref: "action/xhs.search/open_result_card"
        }
      })
    ).toBeNull();
  });

  it("accepts explicit closeout_route_evidence with deterministic rounds without an audit flag", () => {
    const closeoutRouteEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      latest_head_sha: "head-closeout-001",
      head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_expected: closeoutRouteEvidence,
        closeout_route_evidence: closeoutRouteEvidence,
        closeout_evidence_rounds: [
          {
            ...closeoutRouteEvidence,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });
  });

  it("requires independent expected bindings for explicit closeout_route_evidence", () => {
    const closeoutRouteEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      latest_head_sha: "head-closeout-001",
      head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_route_evidence: closeoutRouteEvidence,
        closeout_evidence_rounds: [
          closeoutRouteEvidence,
          {
            ...closeoutRouteEvidence,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("records missing multi-round evidence for audit-required legacy route_evidence", () => {
    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        route_evidence: {
          route_role: "primary",
          path_kind: "api",
          evidence_status: "success",
          evidence_class: "passive_api_capture",
          latest_head_sha: "head-closeout-001",
          head_sha: "head-closeout-001",
          run_id: "run-closeout-001",
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
          profile_ref: "profile/xhs_closeout_001",
          target_tab_id: 32,
          page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
          action_ref: "action/xhs.search/open_result_card"
        }
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("fails closed when deterministic closeout payload fields are present but incomplete", () => {
    const routeEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      latest_head_sha: "head-closeout-001",
      head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        closeout_evidence_expected: {
          latest_head_sha: routeEvidence.latest_head_sha,
          run_id: routeEvidence.run_id
        },
        route_evidence: routeEvidence
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("fails closed when deterministic closeout round fields are explicitly empty", () => {
    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_rounds: []
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("does not treat an explicit empty artifact allowlist as legacy same-run evidence", () => {
    const expected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };
    const firstRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: expected.latest_head_sha,
      run_id: expected.run_id,
      artifact_identity: expected.artifact_identity,
      profile_ref: expected.profile_ref,
      target_tab_id: expected.target_tab_id,
      page_url: expected.page_url,
      action_ref: expected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_expected: expected,
        closeout_evidence_rounds: [
          firstRound,
          {
            ...firstRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "stale_artifact"
        }),
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("does not evaluate closeout_route_evidence without deterministic payload or audit marker", () => {
    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_route_evidence: {
          route_role: "primary",
          path_kind: "api",
          evidence_status: "success",
          evidence_class: "passive_api_capture",
          latest_head_sha: "head-closeout-001",
          head_sha: "head-closeout-001",
          run_id: "run-closeout-001",
          artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
          profile_ref: "profile/xhs_closeout_001",
          target_tab_id: 32,
          page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
          action_ref: "action/xhs.search/open_result_card"
        }
      })
    ).toBeNull();
  });

  it("does not evaluate null closeout evidence input without an audit route", () => {
    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_evidence_input: null
      })
    ).toBeNull();
  });

  it("does not truncate non-integer closeout target tab ids", () => {
    const routeEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      latest_head_sha: "head-closeout-001",
      head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32.5,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        route_evidence: routeEvidence,
        closeout_evidence_rounds: [
          routeEvidence,
          {
            ...routeEvidence,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      bindings: {
        tab_bound: false,
        expected_target_tab_id: null,
        observed_target_tab_id: null
      },
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_multi_round_evidence"
        })
      ])
    });
  });

  it("keeps malformed closeout evidence rounds in deterministic evaluation", () => {
    const routeEvidence = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      latest_head_sha: "head-closeout-001",
      head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/open_result_card"
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        closeout_evidence_expected: routeEvidence,
        route_evidence: routeEvidence,
        closeout_evidence_rounds: [
          routeEvidence,
          null,
          {
            ...routeEvidence,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "FAIL",
      passed: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "non_primary_route"
        })
      ])
    });
  });

  describe("resolveForwardTimeoutMsForContract", () => {
    it("keeps a valid top-level timeout_ms for native bridge forwarding", () => {
      expect(resolveForwardTimeoutMsForContract({ timeout_ms: 120_000 })).toBe(120_000);
    });

    it("defaults controlled live write to a longer native bridge timeout", () => {
      expect(
        resolveXhsCommandForwardTimeoutMsForContract(
          {},
          "xhs.creator_publish.controlled_live_write"
        )
      ).toBe(240_000);
    });

    it("keeps explicit timeout_ms for controlled live write when provided", () => {
      expect(
        resolveXhsCommandForwardTimeoutMsForContract(
          { timeout_ms: 70_000 },
          "xhs.creator_publish.controlled_live_write"
        )
      ).toBe(70_000);
    });

    it("rejects invalid timeout_ms values instead of forwarding ambiguous budgets", () => {
      expect(resolveForwardTimeoutMsForContract({ timeout_ms: 0 })).toBeNull();
      expect(resolveForwardTimeoutMsForContract({ timeout_ms: -1 })).toBeNull();
      expect(resolveForwardTimeoutMsForContract({ timeout_ms: 1.5 })).toBeNull();
      expect(resolveForwardTimeoutMsForContract({ timeout_ms: "120000" })).toBeNull();
      expect(resolveForwardTimeoutMsForContract({})).toBeNull();
    });
  });

  it("keeps target_tab_id mandatory for issue_208 editor_input", () => {
    try {
      normalizeGateOptionsForContract(
        {
          issue_scope: "issue_208",
          target_domain: "creator.xiaohongshu.com",
          target_page: "creator_publish_tab",
          requested_execution_mode: "live_write",
          validation_action: "editor_input"
        },
        "xhs.note.search.v1"
      );
      throw new Error("expected normalizeGateOptionsForContract to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          reason: "TARGET_TAB_ID_INVALID"
        }
      });
    }
  });

  it("keeps target_tab_id mandatory outside issue_208 editor_input validation", () => {
    try {
      normalizeGateOptionsForContract(
        {
          target_domain: "creator.xiaohongshu.com",
          target_page: "creator_publish_tab",
          requested_execution_mode: "live_write"
        },
        "xhs.note.search.v1"
      );
      throw new Error("expected normalizeGateOptionsForContract to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          reason: "TARGET_TAB_ID_INVALID"
        }
      });
    }
  });

  it("keeps target_tab_id mandatory when issue_208 editor_input is not pinned to creator_publish_tab", () => {
    try {
      normalizeGateOptionsForContract(
        {
          issue_scope: "issue_208",
          target_domain: "creator.xiaohongshu.com",
          target_page: "search_result_tab",
          requested_execution_mode: "live_write",
          validation_action: "editor_input"
        },
        "xhs.note.search.v1"
      );
      throw new Error("expected normalizeGateOptionsForContract to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          reason: "TARGET_TAB_ID_INVALID"
        }
      });
    }
  });

  it("rejects issue_208 editor_input when explicit target_tab_id is paired with a non-publish target_page", () => {
    try {
      normalizeGateOptionsForContract(
        {
          issue_scope: "issue_208",
          target_domain: "creator.xiaohongshu.com",
          target_tab_id: 32,
          target_page: "search_result_tab",
          requested_execution_mode: "live_write",
          validation_action: "editor_input"
        },
        "xhs.note.search.v1"
      );
      throw new Error("expected normalizeGateOptionsForContract to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          reason: "TARGET_PAGE_INVALID"
        }
      });
    }
  });

  it("rejects xhs.detail when target_page is not explore_detail_tab", () => {
    try {
      normalizeGateOptionsForContract(
        {
          issue_scope: "issue_209",
          target_domain: "www.xiaohongshu.com",
          target_tab_id: 32,
          target_page: "search_result_tab",
          requested_execution_mode: "dry_run"
        },
        "xhs.note.detail.v1"
      );
      throw new Error("expected normalizeGateOptionsForContract to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          reason: "TARGET_PAGE_INVALID"
        }
      });
    }
  });

  it("rejects xhs.user_home when target_page is not profile_tab", () => {
    try {
      normalizeGateOptionsForContract(
        {
          issue_scope: "issue_209",
          target_domain: "www.xiaohongshu.com",
          target_tab_id: 32,
          target_page: "search_result_tab",
          requested_execution_mode: "dry_run"
        },
        "xhs.user.home.v1"
      );
      throw new Error("expected normalizeGateOptionsForContract to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          reason: "TARGET_PAGE_INVALID"
        }
      });
    }
  });

  it("derives canonical compatibility mode from FR-0023 objects instead of stale legacy mode", () => {
    const normalized = normalizeGateOptionsForContract(
      {
        requested_execution_mode: "live_write"
      },
      "xhs.note.search.v1",
      {
        command: "xhs.search",
        abilityAction: "read",
        runtimeProfile: "profile-anon-001",
        upstreamAuthorization: {
          action_request: {
            request_ref: "upstream_req_mode_001",
            action_name: "xhs.read_search_results",
            action_category: "read"
          },
          resource_binding: {
            binding_ref: "binding_mode_001",
            resource_kind: "anonymous_context",
            profile_ref: null,
            binding_constraints: {
              anonymous_required: true,
              reuse_logged_in_context_forbidden: true
            }
          },
          authorization_grant: {
            grant_ref: "grant_mode_001",
            allowed_actions: ["xhs.read_search_results"],
            binding_scope: {
              allowed_resource_kinds: ["anonymous_context"],
              allowed_profile_refs: []
            },
            target_scope: {
              allowed_domains: ["www.xiaohongshu.com"],
              allowed_pages: ["search_result_tab"]
            },
            resource_state_snapshot: "paused"
          },
          runtime_target: {
            target_ref: "target_mode_001",
            domain: "www.xiaohongshu.com",
            page: "search_result_tab",
            tab_id: 32
          }
        } as never
      }
    );

    expect(normalized.requestedExecutionMode).toBe("dry_run");
    expect(normalized.options).toMatchObject({
      requested_execution_mode: "dry_run",
      __legacy_requested_execution_mode: "live_write"
    });
  });

  it("projects canonical live-read mode when legacy mode is omitted", () => {
    const normalized = normalizeGateOptionsForContract(
      {},
      "xhs.note.search.v1",
      {
        command: "xhs.search",
        abilityAction: "read",
        runtimeProfile: "profile-session-001",
        upstreamAuthorization: {
          action_request: {
            request_ref: "upstream_req_mode_002",
            action_name: "xhs.read_search_results",
            action_category: "read"
          },
          resource_binding: {
            binding_ref: "binding_mode_002",
            resource_kind: "profile_session",
            profile_ref: "profile-session-001"
          },
          authorization_grant: {
            grant_ref: "grant_mode_002",
            allowed_actions: ["xhs.read_search_results"],
            binding_scope: {
              allowed_resource_kinds: ["profile_session"],
              allowed_profile_refs: ["profile-session-001"]
            },
            target_scope: {
              allowed_domains: ["www.xiaohongshu.com"],
              allowed_pages: ["search_result_tab"]
            },
            resource_state_snapshot: "active",
            approval_refs: ["approval_admission_external_001"],
            audit_refs: ["audit_admission_external_001"]
          },
          runtime_target: {
            target_ref: "target_mode_002",
            domain: "www.xiaohongshu.com",
            page: "search_result_tab",
            tab_id: 32
          }
        } as never
      }
    );

    expect(normalized.requestedExecutionMode).toBe("live_read_high_risk");
    expect(normalized.options).not.toHaveProperty("__legacy_requested_execution_mode");
  });

  it("keeps canonical mode at dry_run when grant snapshot is missing", () => {
    const normalized = normalizeGateOptionsForContract(
      {},
      "xhs.note.search.v1",
      {
        command: "xhs.search",
        abilityAction: "read",
        runtimeProfile: "profile-session-001",
        upstreamAuthorization: {
          action_request: {
            request_ref: "upstream_req_mode_003",
            action_name: "xhs.read_search_results",
            action_category: "read"
          },
          resource_binding: {
            binding_ref: "binding_mode_003",
            resource_kind: "profile_session",
            profile_ref: "profile-session-001"
          },
          authorization_grant: {
            grant_ref: "grant_mode_003",
            allowed_actions: ["xhs.read_search_results"],
            binding_scope: {
              allowed_resource_kinds: ["profile_session"],
              allowed_profile_refs: ["profile-session-001"]
            },
            target_scope: {
              allowed_domains: ["www.xiaohongshu.com"],
              allowed_pages: ["search_result_tab"]
            },
            approval_refs: ["approval_admission_external_001"],
            audit_refs: ["audit_admission_external_001"]
          },
          runtime_target: {
            target_ref: "target_mode_003",
            domain: "www.xiaohongshu.com",
            page: "search_result_tab",
            tab_id: 32
          }
        } as never
      }
    );

    expect(normalized.requestedExecutionMode).toBe("dry_run");
  });

  it("blocks XHS live commands before runtime bridge when profile account_safety is blocked", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-account-safety-blocked-"));
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    delete process.env.WEBENVOY_NATIVE_TRANSPORT;
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_account_blocked_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_account_blocked_profile", {
        ...meta,
        accountSafety: {
          state: "account_risk_blocked",
          platform: "xhs",
          reason: "ACCOUNT_ABNORMAL",
          observedAt: "2026-04-25T10:01:00.000Z",
          cooldownUntil: "2026-04-25T10:31:00.000Z",
          sourceRunId: "run-account-risk-source-001",
          sourceCommand: "xhs.search",
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          pageUrl: "https://www.xiaohongshu.com/search_result?keyword=test",
          statusCode: 461,
          platformCode: 300011
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_account_blocked_profile",
            run_id: "run-account-risk-blocked-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ACCOUNT_RISK_BLOCKED",
          closeout_hard_stop_risk: expect.objectContaining({
            state: "hard_stop",
            risk_class: "account_abnormal",
            reason: "ACCOUNT_ABNORMAL",
            source: "account_safety",
            should_block_route_action: true
          }),
          account_safety: expect.objectContaining({
            state: "account_risk_blocked",
            reason: "ACCOUNT_ABNORMAL",
            live_commands_blocked: true
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("blocks non-closeout XHS live commands when profile account_safety is blocked", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-account-safety-write-blocked-"));
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_account_write_blocked_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_account_write_blocked_profile", {
        ...meta,
        accountSafety: {
          state: "account_risk_blocked",
          platform: "xhs",
          reason: "ACCOUNT_ABNORMAL",
          observedAt: "2026-04-25T10:01:00.000Z",
          cooldownUntil: "2026-04-25T10:31:00.000Z",
          sourceRunId: "run-account-risk-source-002",
          sourceCommand: "xhs.search",
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          pageUrl: "https://www.xiaohongshu.com/search_result?keyword=test",
          statusCode: 461,
          platformCode: 300011
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_account_write_blocked_profile",
            run_id: "run-account-risk-write-blocked-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "write"
              },
              input: {
                query: "露营"
              },
              options: {
                issue_scope: "issue_208",
                target_domain: "creator.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "creator_publish_tab",
                action_type: "write",
                requested_execution_mode: "live_write",
                validation_action: "editor_input",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ACCOUNT_RISK_BLOCKED",
          account_safety: expect.objectContaining({
            state: "account_risk_blocked",
            live_commands_blocked: true
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("persists account_safety blocked when an XHS live command returns an account-risk failure", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-account-safety-signal-"));
    const runId = "run-account-risk-signal-001";
    const requestId = "issue209-account-risk-signal-001";
    const gateInvocationId = "issue209-gate-account-risk-signal-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      await seedXhsCloseoutReady({ cwd, profile: "xhs_account_signal_profile" });
      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_account_signal_profile",
            run_id: runId,
            params: {
              request_id: requestId,
              gate_invocation_id: gateInvocationId,
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                simulate_result: "account_abnormal",
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed",
                approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
                audit_record: createIssue209FormalAuditRecord(requestId, decisionId, approvalId)
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ACCOUNT_ABNORMAL",
          closeout_hard_stop_risk: expect.objectContaining({
            state: "hard_stop",
            risk_class: "account_abnormal",
            reason: "ACCOUNT_ABNORMAL",
            source: "account_safety",
            should_block_route_action: true
          }),
          account_safety: expect.objectContaining({
            state: "account_risk_blocked",
            reason: "ACCOUNT_ABNORMAL",
            source_run_id: runId,
            source_command: "xhs.search",
            target_tab_id: 32,
            status_code: 461,
            live_commands_blocked: true
          }),
          runtime_stop: expect.objectContaining({
            attempted: true
          })
        }
      });

      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.readMeta("xhs_account_signal_profile");
      expect(meta?.accountSafety).toMatchObject({
        state: "account_risk_blocked",
        reason: "ACCOUNT_ABNORMAL",
        sourceRunId: runId,
        sourceCommand: "xhs.search",
        targetTabId: 32,
        statusCode: 461
      });
      expect(meta?.xhsCloseoutRhythm).toMatchObject({
        state: "cooldown",
        singleProbeRequired: true,
        fullBundleBlocked: true,
        reasonCodes: expect.arrayContaining(["ACCOUNT_ABNORMAL"])
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("persists account_safety blocked from classifier-only hard-stop evidence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-classifier-account-safety-"));
    const runId = "run-classifier-account-risk-001";
    const requestId = "issue209-classifier-account-risk-001";
    const gateInvocationId = "issue209-gate-classifier-account-risk-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      await seedXhsCloseoutReady({ cwd, profile: "xhs_classifier_account_signal_profile" });
      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_classifier_account_signal_profile",
            run_id: runId,
            params: {
              request_id: requestId,
              gate_invocation_id: gateInvocationId,
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                simulate_result: "classifier_only_account_abnormal",
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed",
                approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
                audit_record: createIssue209FormalAuditRecord(requestId, decisionId, approvalId)
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        diagnosis: {
          failure_site: expect.objectContaining({
            summary: "ACCOUNT_ABNORMAL"
          }),
          evidence: expect.arrayContaining(["ACCOUNT_ABNORMAL", "account_abnormal"])
        },
        observability: {
          failure_site: expect.objectContaining({
            summary: "ACCOUNT_ABNORMAL"
          })
        },
        details: {
          closeout_hard_stop_risk: expect.objectContaining({
            state: "hard_stop",
            risk_class: "account_abnormal",
            reason: "ACCOUNT_ABNORMAL",
            should_block_route_action: true
          }),
          account_safety: expect.objectContaining({
            state: "account_risk_blocked",
            reason: "ACCOUNT_ABNORMAL",
            source_run_id: runId,
            source_command: "xhs.search",
            target_tab_id: 32,
            live_commands_blocked: true
          })
        }
      });

      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.readMeta("xhs_classifier_account_signal_profile");
      expect(meta?.accountSafety).toMatchObject({
        state: "account_risk_blocked",
        reason: "ACCOUNT_ABNORMAL",
        sourceRunId: runId,
        sourceCommand: "xhs.search",
        targetTabId: 32
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("preserves xhs.search humanized action diagnostics in CLI error details", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-humanized-action-diagnostics-"));
    const runId = "run-humanized-action-diagnostics-001";
    const requestId = "issue209-humanized-action-diagnostics-001";
    const gateInvocationId = "issue209-gate-humanized-action-diagnostics-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      await seedXhsCloseoutReady({ cwd, profile: "xhs_humanized_action_diagnostics_profile" });
      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_humanized_action_diagnostics_profile",
            run_id: runId,
            params: {
              request_id: requestId,
              gate_invocation_id: gateInvocationId,
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                simulate_result: "request_context_missing_with_humanized_action",
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed",
                approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
                audit_record: createIssue209FormalAuditRecord(requestId, decisionId, approvalId)
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "REQUEST_CONTEXT_MISSING",
          humanized_action: {
            evidence_class: "humanized_action",
            action_kind: "keyboard_input",
            debugger_action: {
              attempted: true,
              ok: false,
              error: {
                code: "ERR_XHS_SEARCH_DEBUGGER_FAILED",
                message: "chrome.debugger attach failed: another debugger is already attached"
              }
            }
          }
        },
        diagnosis: {
          evidence: expect.arrayContaining([
            "debugger_action_error_message=chrome.debugger attach failed: another debugger is already attached"
          ])
        }
      });
    } finally {
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("prefers classifier hard-stop evidence over generic diagnosis tokens when persisting account_safety", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-classifier-diagnosis-priority-"));
    const runId = "run-classifier-diagnosis-priority-001";
    const requestId = "issue209-classifier-diagnosis-priority-001";
    const gateInvocationId = "issue209-gate-classifier-diagnosis-priority-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      await seedXhsCloseoutReady({ cwd, profile: "xhs_classifier_diagnosis_priority_profile" });
      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_classifier_diagnosis_priority_profile",
            run_id: runId,
            params: {
              request_id: requestId,
              gate_invocation_id: gateInvocationId,
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                simulate_result: "classifier_account_abnormal_with_generic_diagnosis",
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed",
                approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
                audit_record: createIssue209FormalAuditRecord(requestId, decisionId, approvalId)
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        diagnosis: {
          failure_site: expect.objectContaining({
            summary: "ACCOUNT_ABNORMAL"
          }),
          evidence: expect.arrayContaining(["ACCOUNT_ABNORMAL", "account_abnormal"])
        },
        observability: {
          failure_site: expect.objectContaining({
            summary: "ACCOUNT_ABNORMAL"
          })
        },
        details: {
          closeout_hard_stop_risk: expect.objectContaining({
            state: "hard_stop",
            risk_class: "account_abnormal",
            reason: "ACCOUNT_ABNORMAL",
            should_block_route_action: true
          }),
          account_safety: expect.objectContaining({
            state: "account_risk_blocked",
            reason: "ACCOUNT_ABNORMAL",
            source_run_id: runId,
            source_command: "xhs.search",
            target_tab_id: 32,
            live_commands_blocked: true
          })
        }
      });

      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.readMeta("xhs_classifier_diagnosis_priority_profile");
      expect(meta?.accountSafety).toMatchObject({
        state: "account_risk_blocked",
        reason: "ACCOUNT_ABNORMAL",
        sourceRunId: runId,
        sourceCommand: "xhs.search",
        targetTabId: 32
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("prefers current captcha hard-stop evidence over stale account_safety when persisting account_safety", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-stale-account-current-captcha-"));
    const runId = "run-stale-account-current-captcha-001";
    const requestId = "issue209-stale-account-current-captcha-001";
    const gateInvocationId = "issue209-gate-stale-account-current-captcha-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      await seedXhsCloseoutReady({ cwd, profile: "xhs_stale_account_current_captcha_profile" });
      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_stale_account_current_captcha_profile",
            run_id: runId,
            params: {
              request_id: requestId,
              gate_invocation_id: gateInvocationId,
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                simulate_result: "stale_account_safety_with_current_captcha",
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed",
                approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
                audit_record: createIssue209FormalAuditRecord(requestId, decisionId, approvalId)
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        diagnosis: {
          failure_site: expect.objectContaining({
            summary: "CAPTCHA_REQUIRED"
          }),
          evidence: expect.arrayContaining(["CAPTCHA_REQUIRED", "captcha_required"])
        },
        observability: {
          failure_site: expect.objectContaining({
            summary: "CAPTCHA_REQUIRED"
          })
        },
        details: {
          closeout_hard_stop_risk: expect.objectContaining({
            state: "hard_stop",
            risk_class: "captcha_required",
            reason: "CAPTCHA_REQUIRED",
            source: "account_safety",
            should_block_route_action: true
          }),
          account_safety: expect.objectContaining({
            state: "account_risk_blocked",
            reason: "CAPTCHA_REQUIRED",
            source_run_id: runId,
            source_command: "xhs.search",
            target_tab_id: 32,
            status_code: 429,
            live_commands_blocked: true
          })
        }
      });

      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.readMeta("xhs_stale_account_current_captcha_profile");
      expect(meta?.accountSafety).toMatchObject({
        state: "account_risk_blocked",
        reason: "CAPTCHA_REQUIRED",
        sourceRunId: runId,
        sourceCommand: "xhs.search",
        targetTabId: 32,
        statusCode: 429
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("blocks the XHS closeout bundle until a recovery single-probe is requested", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-blocked-"));
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_blocked_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_blocked_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: null,
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.detail",
            profile: "xhs_rhythm_blocked_profile",
            run_id: "run-rhythm-blocked-001",
            params: {
              ability: {
                id: "xhs.note.detail.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                note_id: "note-rhythm-001"
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "explore_detail_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "XHS_CLOSEOUT_RHYTHM_BLOCKED",
          xhs_closeout_rhythm: expect.objectContaining({
            state: "single_probe_required",
            full_bundle_blocked: true
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  }, 15_000);

  it("blocks XHS live reads at the validation baseline gate even when scope and caller action are wrong", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-baseline-action-omitted-"));
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_baseline_action_omitted_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_baseline_action_omitted_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_passed",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: false,
          singleProbePassedAt: "2026-04-25T10:40:00.000Z",
          probeRunId: "run-action-omitted-recovery-probe",
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_PASSED", "ANTI_DETECTION_BASELINE_REQUIRED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_baseline_action_omitted_profile",
            run_id: "run-baseline-action-omitted-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "write"
              },
              input: {
                query: "露营"
              },
              options: {
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ANTI_DETECTION_VALIDATION_BASELINE_BLOCKED"
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }, 15_000);

  it("maps validation store failures before blocking XHS live reads", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-baseline-store-failure-"));
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_baseline_store_failure_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_baseline_store_failure_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_passed",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: false,
          singleProbePassedAt: "2026-04-25T10:40:00.000Z",
          probeRunId: "run-store-failure-recovery-probe",
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_PASSED", "ANTI_DETECTION_BASELINE_REQUIRED"]
        }
      });
      await createSchemaMismatchRuntimeStore(cwd);

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_baseline_store_failure_profile",
            run_id: "run-baseline-store-failure-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_RUNTIME_UNAVAILABLE",
        retryable: false
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }, 15_000);

  it("does not apply the baseline gate to steady-state XHS live reads before recovery starts", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-steady-live-read-"));
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      await profileStore.initializeMeta(
        "xhs_steady_live_read_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_steady_live_read_profile",
            run_id: "run-steady-live-read-001",
            params: {
              request_id: "request-steady-live-read-001",
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "EXECUTION_MODE_GATE_BLOCKED",
          gate_reasons: expect.arrayContaining(["ACTION_TYPE_NOT_EXPLICIT"])
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("blocks non-closeout XHS live commands while recovery rhythm is active", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-live-write-"));
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_live_write_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_live_write_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: null,
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_rhythm_live_write_profile",
            run_id: "run-rhythm-live-write-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "write"
              },
              input: {
                query: "露营装备"
              },
              options: {
                issue_scope: "issue_208",
                target_domain: "creator.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "creator_publish_tab",
                action_type: "write",
                requested_execution_mode: "live_write",
                validation_action: "editor_input",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "XHS_CLOSEOUT_RHYTHM_BLOCKED",
          session_rhythm_admission_summary: expect.objectContaining({
            decision: "blocked",
            reason_codes: expect.arrayContaining(["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]),
            requires: ["session_rhythm_window_not_ready"],
            requested_execution_mode: "live_write",
            action_type: "write",
            issue_scope: "issue_208",
            risk_state: "allowed"
          }),
          xhs_closeout_rhythm: expect.objectContaining({
            state: "single_probe_required"
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("preserves persisted recovery-probe blocks when profile rhythm metadata is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-persisted-recovery-block-"));
    try {
      const profile = "xhs_persisted_recovery_block_profile";
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      await profileStore.initializeMeta(profile, "2026-04-25T10:00:00.000Z", {
        allowUnsupportedExtensionBrowser: true
      });
      const store = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await store.recordSessionRhythmStatusView({
          profile,
          platform: "xhs",
          issueScope: "issue_209",
          windowState: {
            window_id: `rhythm_win_${profile}_issue_209`,
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-persisted-recovery",
            current_phase: "recovery_probe",
            risk_state: "limited",
            window_started_at: "2026-04-25T10:35:00.000Z",
            window_deadline_at: "2026-04-25T10:40:00.000Z",
            cooldown_until: null,
            recovery_probe_due_at: "2026-04-25T10:40:00.000Z",
            stability_window_until: null,
            risk_signal_count: 0,
            last_event_id: "rhythm_evt_persisted_recovery_block",
            source_run_id: "run-persisted-recovery-block",
            updated_at: "2026-04-25T10:35:00.000Z"
          },
          event: {
            event_id: "rhythm_evt_persisted_recovery_block",
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-persisted-recovery",
            window_id: `rhythm_win_${profile}_issue_209`,
            event_type: "recovery_probe_started",
            phase_before: "cooldown",
            phase_after: "recovery_probe",
            risk_state_before: "paused",
            risk_state_after: "limited",
            source_audit_event_id: null,
            reason: "PERSISTED_RECOVERY_PROBE_BLOCKED",
            recorded_at: "2026-04-25T10:35:00.000Z"
          },
          decision: {
            decision_id: "rhythm_decision_persisted_recovery_block",
            window_id: `rhythm_win_${profile}_issue_209`,
            run_id: "run-persisted-recovery-block",
            session_id: "nm-session-persisted-recovery",
            profile,
            current_phase: "recovery_probe",
            current_risk_state: "limited",
            next_phase: "recovery_probe",
            next_risk_state: "limited",
            effective_execution_mode: "recon",
            decision: "blocked",
            reason_codes: ["PERSISTED_RECOVERY_PROBE_BLOCKED"],
            requires: ["operator_confirmation_required"],
            decided_at: "2026-04-25T10:35:00.000Z"
          }
        });
      } finally {
        store.close();
      }

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile,
            run_id: "run-persisted-recovery-block-current",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "XHS_CLOSEOUT_RHYTHM_BLOCKED",
          xhs_closeout_rhythm: expect.objectContaining({
            state: "single_probe_required",
            single_probe_required: true,
            reason_codes: expect.arrayContaining(["PERSISTED_RECOVERY_PROBE_BLOCKED"])
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("blocks non-closeout XHS live commands after recovery probe until validation baseline is ready", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-live-write-baseline-"));
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_live_write_baseline_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_live_write_baseline_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_passed",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: false,
          singleProbePassedAt: "2026-04-25T10:40:00.000Z",
          probeRunId: "run-live-write-baseline-recovery-probe",
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_PASSED", "ANTI_DETECTION_BASELINE_REQUIRED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_rhythm_live_write_baseline_profile",
            run_id: "run-rhythm-live-write-baseline-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "write"
              },
              input: {
                query: "露营装备"
              },
              options: {
                issue_scope: "issue_208",
                target_domain: "creator.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "creator_publish_tab",
                action_type: "write",
                requested_execution_mode: "live_write",
                validation_action: "editor_input",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ANTI_DETECTION_VALIDATION_BASELINE_BLOCKED",
          anti_detection_validation_view: expect.objectContaining({
            effective_execution_mode: "live_write",
            all_required_ready: false
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("allows a marked xhs.search recovery single-probe and records the passed probe", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-probe-"));
    const runId = "run-rhythm-probe-001";
    const requestId = "issue209-rhythm-probe-001";
    const gateInvocationId = "issue209-gate-rhythm-probe-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_probe_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_probe_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: null,
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
        }
      });
      const rhythmStore = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await rhythmStore.recordSessionRhythmStatusView({
          profile: "xhs_rhythm_probe_profile",
          platform: "xhs",
          issueScope: "issue_209",
          windowState: {
            window_id: "rhythm_win_xhs_rhythm_probe_profile_issue_209",
            profile: "xhs_rhythm_probe_profile",
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-previous",
            current_phase: "cooldown",
            risk_state: "paused",
            window_started_at: "2026-04-25T10:00:00.000Z",
            window_deadline_at: null,
            cooldown_until: null,
            recovery_probe_due_at: null,
            stability_window_until: null,
            risk_signal_count: 1,
            last_event_id: "rhythm_evt_previous_paused_no_cooldown",
            source_run_id: "run-previous-paused-no-cooldown",
            updated_at: "2026-04-25T10:00:00.000Z"
          },
          event: {
            event_id: "rhythm_evt_previous_paused_no_cooldown",
            profile: "xhs_rhythm_probe_profile",
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-previous",
            window_id: "rhythm_win_xhs_rhythm_probe_profile_issue_209",
            event_type: "risk_signal",
            phase_before: "steady",
            phase_after: "cooldown",
            risk_state_before: "limited",
            risk_state_after: "paused",
            source_audit_event_id: null,
            reason: "PERSISTED_SESSION_RHYTHM_PAUSED",
            recorded_at: "2026-04-25T10:00:00.000Z"
          },
          decision: {
            decision_id: "rhythm_decision_previous_paused_no_cooldown",
            window_id: "rhythm_win_xhs_rhythm_probe_profile_issue_209",
            run_id: "run-previous-paused-no-cooldown",
            session_id: "nm-session-previous",
            profile: "xhs_rhythm_probe_profile",
            current_phase: "cooldown",
            current_risk_state: "paused",
            next_phase: "cooldown",
            next_risk_state: "paused",
            effective_execution_mode: "recon",
            decision: "blocked",
            reason_codes: ["PERSISTED_SESSION_RHYTHM_PAUSED"],
            requires: ["operator_confirmation_required"],
            decided_at: "2026-04-25T10:00:00.000Z"
          }
        });
      } finally {
        rhythmStore.close();
      }

      const result = await executeCommand(
        {
          cwd,
          command: "xhs.search",
          profile: "xhs_rhythm_probe_profile",
          run_id: runId,
          params: {
            request_id: requestId,
            gate_invocation_id: gateInvocationId,
            ability: {
              id: "xhs.note.search.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              query: "露营"
            },
            options: {
              xhs_recovery_probe: true,
              simulate_result: "success",
              issue_scope: "issue_209",
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "search_result_tab",
              action_type: "read",
              requested_execution_mode: "recon",
              risk_state: "allowed",
              approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
              audit_record: createIssue209FormalAuditRecord(requestId, decisionId, approvalId)
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(result.summary).toMatchObject({
        capability_result: {
          ability_id: "xhs.note.search.v1",
          outcome: "partial"
        }
      });
      const persisted = await profileStore.readMeta("xhs_rhythm_probe_profile");
      expect(persisted?.xhsCloseoutRhythm).toMatchObject({
        state: "single_probe_passed",
        singleProbeRequired: false,
        probeRunId: runId,
        fullBundleBlocked: true,
        reasonCodes: expect.arrayContaining(["ANTI_DETECTION_BASELINE_REQUIRED"])
      });
      const verificationStore = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await expect(
          verificationStore.getSessionRhythmStatusView({
            profile: "xhs_rhythm_probe_profile",
            platform: "xhs",
            issueScope: "issue_209",
            runId
          })
        ).resolves.toMatchObject({
          event: {
            event_id: `rhythm_evt_${runId}`,
            event_type: "recovery_probe_passed"
          },
          decision: {
            decision_id: `rhythm_decision_${runId}`,
            decision: "deferred",
            reason_codes: expect.arrayContaining(["ANTI_DETECTION_BASELINE_REQUIRED"])
          }
        });
      } finally {
        verificationStore.close();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("blocks XHS closeout live reads when FR-0020 validation baseline is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-validation-missing-"));
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_validation_missing_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_validation_missing_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_passed",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: false,
          singleProbePassedAt: "2026-04-25T10:40:00.000Z",
          probeRunId: "run-validation-missing-probe-001",
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_PASSED", "ANTI_DETECTION_BASELINE_REQUIRED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.detail",
            profile: "xhs_validation_missing_profile",
            run_id: "run-validation-missing-001",
            params: {
              ability: {
                id: "xhs.note.detail.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                note_id: "note-validation-missing-001"
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 33,
                target_page: "explore_detail_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ANTI_DETECTION_VALIDATION_BASELINE_BLOCKED",
          anti_detection_validation_view: expect.objectContaining({
            all_required_ready: false
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("preserves persisted recovery-probe passed rhythm state before live reads", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-persisted-probe-passed-"));
    const profile = "xhs_persisted_probe_passed_profile";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(profile, "2026-04-25T10:00:00.000Z", {
        allowUnsupportedExtensionBrowser: true
      });
      await profileStore.writeMeta(profile, {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        }
      });
      const store = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await store.recordSessionRhythmStatusView({
          profile,
          platform: "xhs",
          issueScope: "issue_209",
          windowState: {
            window_id: `rhythm_win_${profile}_issue_209`,
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-persisted-probe",
            current_phase: "steady",
            risk_state: "limited",
            window_started_at: "2026-04-25T10:35:00.000Z",
            window_deadline_at: "2026-04-25T11:00:00.000Z",
            cooldown_until: null,
            recovery_probe_due_at: null,
            stability_window_until: "2026-04-25T11:00:00.000Z",
            risk_signal_count: 0,
            last_event_id: "rhythm_evt_persisted_probe_passed",
            source_run_id: "run-persisted-probe-passed",
            updated_at: "2026-04-25T10:40:00.000Z"
          },
          event: {
            event_id: "rhythm_evt_persisted_probe_passed",
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-persisted-probe",
            window_id: `rhythm_win_${profile}_issue_209`,
            event_type: "recovery_probe_passed",
            phase_before: "recovery_probe",
            phase_after: "steady",
            risk_state_before: "limited",
            risk_state_after: "limited",
            source_audit_event_id: null,
            reason: "XHS_RECOVERY_SINGLE_PROBE_PASSED",
            recorded_at: "2026-04-25T10:40:00.000Z"
          },
          decision: {
            decision_id: "rhythm_decision_persisted_probe_passed",
            window_id: `rhythm_win_${profile}_issue_209`,
            run_id: "run-persisted-probe-passed",
            session_id: "nm-session-persisted-probe",
            profile,
            current_phase: "steady",
            current_risk_state: "limited",
            next_phase: "steady",
            next_risk_state: "limited",
            effective_execution_mode: "live_read_high_risk",
            decision: "deferred",
            reason_codes: ["XHS_RECOVERY_SINGLE_PROBE_PASSED", "ANTI_DETECTION_BASELINE_REQUIRED"],
            requires: ["anti_detection_validation_view_ready"],
            decided_at: "2026-04-25T10:40:00.000Z"
          }
        });
      } finally {
        store.close();
      }

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.detail",
            profile,
            run_id: "run-persisted-probe-live-read-001",
            params: {
              ability: {
                id: "xhs.note.detail.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                note_id: "note-persisted-probe-001"
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 33,
                target_page: "explore_detail_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ANTI_DETECTION_VALIDATION_BASELINE_BLOCKED",
          xhs_closeout_rhythm: expect.objectContaining({
            state: "single_probe_passed",
            probe_run_id: "run-persisted-probe-passed"
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("blocks live reads while persisted rhythm is still in recovery probe", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-persisted-recovery-probe-"));
    const profile = "xhs_persisted_recovery_probe_profile";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(profile, "2026-04-25T10:00:00.000Z", {
        allowUnsupportedExtensionBrowser: true
      });
      await profileStore.writeMeta(profile, {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        }
      });
      const store = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await store.recordSessionRhythmStatusView({
          profile,
          platform: "xhs",
          issueScope: "issue_209",
          windowState: {
            window_id: `rhythm_win_${profile}_issue_209`,
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-persisted-recovery",
            current_phase: "recovery_probe",
            risk_state: "limited",
            window_started_at: "2026-04-25T10:35:00.000Z",
            window_deadline_at: "2026-04-25T10:55:00.000Z",
            cooldown_until: null,
            recovery_probe_due_at: "2026-04-25T10:35:00.000Z",
            stability_window_until: null,
            risk_signal_count: 0,
            last_event_id: "rhythm_evt_persisted_recovery_probe",
            source_run_id: "run-persisted-recovery-probe",
            updated_at: "2026-04-25T10:36:00.000Z"
          },
          event: {
            event_id: "rhythm_evt_persisted_recovery_probe",
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-persisted-recovery",
            window_id: `rhythm_win_${profile}_issue_209`,
            event_type: "recovery_probe_started",
            phase_before: "warmup",
            phase_after: "recovery_probe",
            risk_state_before: "limited",
            risk_state_after: "limited",
            source_audit_event_id: null,
            reason: "XHS_RECOVERY_SINGLE_PROBE_REQUIRED",
            recorded_at: "2026-04-25T10:36:00.000Z"
          },
          decision: {
            decision_id: "rhythm_decision_persisted_recovery_probe",
            window_id: `rhythm_win_${profile}_issue_209`,
            run_id: "run-persisted-recovery-probe",
            session_id: "nm-session-persisted-recovery",
            profile,
            current_phase: "recovery_probe",
            current_risk_state: "limited",
            next_phase: "recovery_probe",
            next_risk_state: "limited",
            effective_execution_mode: "recon",
            decision: "blocked",
            reason_codes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"],
            requires: ["xhs.search_recon_probe"],
            decided_at: "2026-04-25T10:36:00.000Z"
          }
        });
      } finally {
        store.close();
      }

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.detail",
            profile,
            run_id: "run-persisted-recovery-live-read-001",
            params: {
              ability: {
                id: "xhs.note.detail.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                note_id: "note-persisted-recovery-001"
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 33,
                target_page: "explore_detail_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "XHS_CLOSEOUT_RHYTHM_BLOCKED",
          xhs_closeout_rhythm: expect.objectContaining({
            state: "single_probe_required",
            single_probe_required: true,
            probe_run_id: "run-persisted-recovery-probe"
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("allows XHS closeout live reads through preflight after probe and FR-0020 baselines pass", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-validation-ready-"));
    const runId = "run-validation-ready-user-home-001";
    const requestId = "issue209-validation-ready-user-home-001";
    const gateInvocationId = "issue209-gate-validation-ready-user-home-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      await seedXhsCloseoutReady({ cwd, profile: "xhs_validation_ready_profile" });

      const result = await executeCommand(
        {
          cwd,
          command: "xhs.user_home",
          profile: "xhs_validation_ready_profile",
          run_id: runId,
          params: {
            request_id: requestId,
            gate_invocation_id: gateInvocationId,
            ability: {
              id: "xhs.user.home.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              user_id: "user-validation-ready-001"
            },
            options: {
              simulate_result: "success",
              issue_scope: "issue_209",
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 34,
              target_page: "profile_tab",
              action_type: "read",
              requested_execution_mode: "live_read_high_risk",
              risk_state: "allowed",
              approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
              audit_record: {
                ...createIssue209FormalAuditRecord(requestId, decisionId, approvalId),
                target_tab_id: 34,
                target_page: "profile_tab"
              }
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(result.summary).toMatchObject({
        gate_input: {
          session_rhythm_decision_id: `rhythm_decision_preflight_${runId}`
        },
        request_admission_result: {
          request_ref: requestId,
          admission_decision: "allowed"
        }
      });
      const verificationStore = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await expect(
          verificationStore.getSessionRhythmStatusView({
            profile: "xhs_validation_ready_profile",
            platform: "xhs",
            issueScope: "issue_209",
            runId
          })
        ).resolves.toMatchObject({
          decision: {
            decision_id: `rhythm_decision_preflight_${runId}`,
            run_id: runId,
            decision: "deferred",
            reason_codes: ["XHS_LIVE_ADMISSION_PENDING_EXECUTION_AUDIT"],
            requires: ["execution_audit_appended"]
          }
        });
      } finally {
        verificationStore.close();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("evaluates explicit user_home closeout evidence after executing the live bridge path", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-user-home-closeout-explicit-"));
    const runId = "run-user-home-explicit-closeout-001";
    const requestId = "req-user-home-explicit-closeout-001";
    const gateInvocationId = "gate-user-home-explicit-closeout-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const profile = "xhs_user_home_explicit_closeout_profile";
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    const previousLatestHead = process.env.WEBENVOY_CLOSEOUT_LATEST_HEAD_SHA;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    process.env.WEBENVOY_CLOSEOUT_LATEST_HEAD_SHA = "head-user-home-explicit-closeout-001";
    try {
      await seedXhsCloseoutReady({ cwd, profile });
      const expected = {
        latest_head_sha: "head-user-home-explicit-closeout-001",
        run_id: runId,
        artifact_identity: null,
        artifact_identities: [
          `artifact/user-home-explicit/${runId}/round-1`,
          `artifact/user-home-explicit/${runId}/round-2`
        ],
        profile_ref: `profile/${profile}`,
        target_tab_id: 35,
        page_url: "https://www.xiaohongshu.com/user/profile/user-explicit-001?xsec_source=pc_search",
        action_ref: "read"
      };
      const firstRound = {
        round_id: "user-home-r1",
        route_role: "primary",
        path_kind: "api",
        evidence_status: "success",
        evidence_class: "passive_api_capture",
        head_sha: expected.latest_head_sha,
        run_id: expected.run_id,
        artifact_identity: `artifact/user-home-explicit/${runId}/round-1`,
        profile_ref: expected.profile_ref,
        target_tab_id: expected.target_tab_id,
        page_url: expected.page_url,
        action_ref: expected.action_ref,
        artifact_log_ref: ".webenvoy/user-home-r1.json"
      };

      const result = await executeCommand(
        {
          cwd,
          command: "xhs.user_home",
          profile,
          run_id: runId,
          params: {
            request_id: requestId,
            gate_invocation_id: gateInvocationId,
            ability: {
              id: "xhs.user.home.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              user_id: "user-explicit-001"
            },
            options: {
              simulate_result: "success",
              issue_scope: "issue_209",
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 35,
              target_page: "profile_tab",
              action_type: "read",
              requested_execution_mode: "live_read_high_risk",
              risk_state: "allowed",
              approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
              audit_record: {
                ...createIssue209FormalAuditRecord(requestId, decisionId, approvalId),
                target_tab_id: 35,
                target_page: "profile_tab"
              },
              admission_context: {
                approval_admission_evidence: {
                  approval_admission_ref: `approval_admission_${runId}_${requestId}`,
                  request_id: requestId,
                  run_id: runId,
                  session_id: "nm-session-001",
                  issue_scope: "issue_209",
                  target_domain: "www.xiaohongshu.com",
                  target_tab_id: 35,
                  target_page: "profile_tab",
                  action_type: "read",
                  requested_execution_mode: "live_read_high_risk",
                  approved: true,
                  approver: "qa-reviewer",
                  approved_at: "2026-05-15T10:00:00Z",
                  checks: ISSUE209_APPROVAL_CHECKS,
                  recorded_at: "2026-05-15T10:00:00Z"
                },
                audit_admission_evidence: {
                  audit_admission_ref: `audit_admission_${runId}_${requestId}`,
                  request_id: requestId,
                  run_id: runId,
                  session_id: "nm-session-001",
                  issue_scope: "issue_209",
                  target_domain: "www.xiaohongshu.com",
                  target_tab_id: 35,
                  target_page: "profile_tab",
                  action_type: "read",
                  requested_execution_mode: "live_read_high_risk",
                  risk_state: "allowed",
                  audited_checks: ISSUE209_APPROVAL_CHECKS,
                  recorded_at: "2026-05-15T10:00:30Z"
                }
              },
              upstream_authorization_request: {
                action_request: {
                  request_ref: requestId,
                  action_name: "xhs.read_user_home",
                  action_category: "read",
                  requested_at: "2026-05-15T10:00:00Z"
                },
                resource_binding: {
                  binding_ref: `binding_${requestId}`,
                  resource_kind: "profile_session",
                  profile_ref: profile,
                  binding_constraints: {
                    anonymous_required: false,
                    reuse_logged_in_context_forbidden: false
                  }
                },
                authorization_grant: {
                  grant_ref: `grant_${requestId}`,
                  allowed_actions: ["xhs.read_user_home"],
                  binding_scope: {
                    allowed_resource_kinds: ["profile_session"],
                    allowed_profile_refs: [profile]
                  },
                  target_scope: {
                    allowed_domains: ["www.xiaohongshu.com"],
                    allowed_pages: ["profile_tab"]
                  },
                  resource_state_snapshot: "active",
                  granted_at: "2026-05-15T10:00:00Z",
                  approval_refs: [`approval_admission_${runId}_${requestId}`],
                  audit_refs: [`audit_admission_${runId}_${requestId}`]
                },
                runtime_target: {
                  target_ref: `target_${requestId}`,
                  domain: "www.xiaohongshu.com",
                  page: "profile_tab",
                  tab_id: 35
                }
              },
              closeout_audit_required: true,
              closeout_evidence_expected: expected,
              closeout_evidence_rounds: [
                firstRound,
                {
                  ...firstRound,
                  round_id: "user-home-r2",
                  artifact_identity: `artifact/user-home-explicit/${runId}/round-2`,
                  artifact_log_ref: ".webenvoy/user-home-r2.json"
                }
              ]
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(result.summary).toMatchObject({
        capability_result: {
          outcome: "success"
        },
        closeout_evidence_evaluation: {
          decision: "PASS",
          passed: true,
          reproduced_multi_round: true,
          multi_round: {
            accepted_round_count: 2,
            unique_artifact_count: 2
          }
        }
      });
      expect(result.summary.explicit_closeout_evidence_only).toBeUndefined();
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
      if (previousLatestHead === undefined) {
        delete process.env.WEBENVOY_CLOSEOUT_LATEST_HEAD_SHA;
      } else {
        process.env.WEBENVOY_CLOSEOUT_LATEST_HEAD_SHA = previousLatestHead;
      }
    }
  });

  it("allows XHS live_read_limited reads with the closeout readiness baseline", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-limited-validation-ready-"));
    const runId = "run-validation-ready-limited-search-001";
    const requestId = "issue209-validation-ready-limited-search-001";
    const gateInvocationId = "issue209-gate-validation-ready-limited-search-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      await seedXhsCloseoutReady({ cwd, profile: "xhs_validation_ready_limited_profile" });

      const result = await executeCommand(
        {
          cwd,
          command: "xhs.search",
          profile: "xhs_validation_ready_limited_profile",
          run_id: runId,
          params: {
            request_id: requestId,
            gate_invocation_id: gateInvocationId,
            ability: {
              id: "xhs.note.search.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              query: "露营"
            },
            options: {
              simulate_result: "success",
              issue_scope: "issue_209",
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "search_result_tab",
              action_type: "read",
              requested_execution_mode: "live_read_limited",
              risk_state: "limited",
              limited_read_rollout_ready_true: true,
              approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
              audit_record: {
                ...createIssue209FormalAuditRecord(requestId, decisionId, approvalId),
                requested_execution_mode: "live_read_limited",
                risk_state: "limited"
              }
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(result.summary).toMatchObject({
        gate_outcome: {
          effective_execution_mode: "live_read_limited",
          gate_decision: "allowed",
          gate_reasons: ["LIVE_MODE_APPROVED"]
        },
        request_admission_result: {
          request_ref: requestId,
          admission_decision: "allowed"
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("preserves persisted cooldown before XHS closeout live execution", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-persisted-cooldown-"));
    const profile = "xhs_persisted_cooldown_profile";
    try {
      await seedXhsCloseoutReady({ cwd, profile });
      const store = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await store.recordSessionRhythmStatusView({
          profile,
          platform: "xhs",
          issueScope: "issue_209",
          windowState: {
            window_id: `rhythm_win_${profile}_issue_209`,
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-cooldown",
            current_phase: "cooldown",
            risk_state: "paused",
            window_started_at: "2026-04-25T10:35:00.000Z",
            window_deadline_at: "2099-04-25T11:05:00.000Z",
            cooldown_until: "2099-04-25T11:05:00.000Z",
            recovery_probe_due_at: "2099-04-25T11:05:00.000Z",
            stability_window_until: null,
            risk_signal_count: 1,
            last_event_id: "rhythm_evt_persisted_cooldown",
            source_run_id: "run-persisted-cooldown-source",
            updated_at: "2026-04-25T10:35:00.000Z"
          },
          event: {
            event_id: "rhythm_evt_persisted_cooldown",
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-cooldown",
            window_id: `rhythm_win_${profile}_issue_209`,
            event_type: "risk_signal",
            phase_before: "steady",
            phase_after: "cooldown",
            risk_state_before: "limited",
            risk_state_after: "paused",
            source_audit_event_id: "gate_evt_persisted_cooldown",
            reason: "ACCOUNT_RISK_RECOVERY_REQUIRED",
            recorded_at: "2026-04-25T10:35:00.000Z"
          },
          decision: {
            decision_id: "rhythm_decision_persisted_cooldown",
            window_id: `rhythm_win_${profile}_issue_209`,
            run_id: "run-persisted-cooldown-source",
            session_id: "nm-session-cooldown",
            profile,
            current_phase: "cooldown",
            current_risk_state: "paused",
            next_phase: "cooldown",
            next_risk_state: "paused",
            effective_execution_mode: "live_read_high_risk",
            decision: "blocked",
            reason_codes: ["ACCOUNT_RISK_RECOVERY_REQUIRED"],
            requires: ["cooldown_until_elapsed"],
            decided_at: "2026-04-25T10:35:00.000Z"
          }
        });
      } finally {
        store.close();
      }

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.detail",
            profile,
            run_id: "run-persisted-cooldown-current",
            params: {
              ability: {
                id: "xhs.note.detail.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                note_id: "note-persisted-cooldown"
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 33,
                target_page: "explore_detail_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "XHS_CLOSEOUT_RHYTHM_BLOCKED",
          xhs_closeout_rhythm: expect.objectContaining({
            state: "cooldown",
            full_bundle_blocked: true
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("allows xhs.search dry_run without official Chrome runtime readiness", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-dry-run-no-runtime-readiness-"));
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    delete process.env.WEBENVOY_NATIVE_TRANSPORT;
    delete process.env.WEBENVOY_BROWSER_PATH;
    delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_dry_run_no_runtime_readiness_profile",
        "2026-04-28T01:45:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_dry_run_no_runtime_readiness_profile", {
        ...meta,
        profileState: "logging_in"
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_dry_run_no_runtime_readiness_profile",
            run_id: "run-xhs-dry-run-no-runtime-readiness-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营",
                limit: 3
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "dry_run",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).resolves.toMatchObject({
        summary: {
          session_id: "gate-only-run-xhs-dry-run-no-runtime-readiness-001",
          requested_execution_mode: "dry_run",
          consumer_gate_result: expect.objectContaining({
            effective_execution_mode: "dry_run"
          }),
          audit_record: expect.objectContaining({
            recorded_at: expect.not.stringMatching(/^2026-03-23T10:00:00/)
          }),
          risk_state_output: expect.objectContaining({
            session_rhythm: expect.objectContaining({
              last_event_at: expect.not.stringMatching(/^2026-03-23T10:00:00/)
            })
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("preserves anonymous admission signals in xhs.search dry_run gate-only mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-dry-run-anon-gate-only-"));
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    delete process.env.WEBENVOY_NATIVE_TRANSPORT;
    delete process.env.WEBENVOY_BROWSER_PATH;
    delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_dry_run_anon_gate_only_profile",
        "2026-04-28T02:45:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_dry_run_anon_gate_only_profile", {
        ...meta,
        profileState: "logging_in"
      });

      const execution = await executeCommand(
        {
          cwd,
          command: "xhs.search",
          profile: "xhs_dry_run_anon_gate_only_profile",
          run_id: "run-xhs-dry-run-anon-gate-only-001",
          params: {
            request_id: "req-xhs-dry-run-anon-gate-only-001",
            ability: {
              id: "xhs.note.search.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              query: "露营",
              limit: 3
            },
            options: {
              issue_scope: "issue_209",
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "search_result_tab",
              action_type: "read",
              requested_execution_mode: "dry_run",
              risk_state: "allowed",
              upstream_authorization_request: {
                action_request: {
                  request_ref: "upstream_req_dry_run_anon_gate_only_001",
                  action_name: "xhs.read_search_results",
                  action_category: "read"
                },
                resource_binding: {
                  binding_ref: "binding_dry_run_anon_gate_only_001",
                  resource_kind: "anonymous_context",
                  profile_ref: null,
                  binding_constraints: {
                    anonymous_required: true,
                    reuse_logged_in_context_forbidden: true
                  }
                },
                authorization_grant: {
                  grant_ref: "grant_dry_run_anon_gate_only_001",
                  allowed_actions: ["xhs.read_search_results"],
                  binding_scope: {
                    allowed_resource_kinds: ["anonymous_context"],
                    allowed_profile_refs: []
                  },
                  target_scope: {
                    allowed_domains: ["www.xiaohongshu.com"],
                    allowed_pages: ["search_result_tab"]
                  },
                  resource_state_snapshot: "paused"
                },
                runtime_target: {
                  target_ref: "target_dry_run_anon_gate_only_001",
                  domain: "www.xiaohongshu.com",
                  page: "search_result_tab",
                  tab_id: 32,
                  url: "https://www.xiaohongshu.com/search_result?keyword=%E9%9C%B2%E8%90%A5"
                }
              },
              __anonymous_isolation_verified: true,
              target_site_logged_in: false
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(execution.summary).toMatchObject({
        requested_execution_mode: "dry_run",
        __anonymous_isolation_verified: true,
        target_site_logged_in: false,
        request_admission_result: {
          admission_decision: "allowed",
          anonymous_isolation_ok: true,
          effective_runtime_mode: "dry_run"
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("does not consume the recovery probe budget when runtime readiness fails first", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-probe-readiness-"));
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    delete process.env.WEBENVOY_NATIVE_TRANSPORT;
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_probe_readiness_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_probe_readiness_profile", {
        ...meta,
        profileState: "logging_in",
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: null,
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_rhythm_probe_readiness_profile",
            run_id: "run-rhythm-probe-readiness-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                xhs_recovery_probe: true,
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "recon",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_RUNTIME_UNAVAILABLE"
      });

      const persisted = await profileStore.readMeta("xhs_rhythm_probe_readiness_profile");
      expect(persisted?.xhsCloseoutRhythm).toMatchObject({
        state: "single_probe_required",
        probeRunId: null,
        singleProbePassedAt: null
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("persists account-safety risk signals from a recovery probe failure", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-probe-risk-"));
    const runId = "run-rhythm-probe-risk-001";
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_probe_risk_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_probe_risk_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: null,
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_rhythm_probe_risk_profile",
            run_id: runId,
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                xhs_recovery_probe: true,
                simulate_result: "account_abnormal",
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "recon",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ACCOUNT_ABNORMAL",
          account_safety: expect.objectContaining({
            state: "account_risk_blocked",
            reason: "ACCOUNT_ABNORMAL",
            source_run_id: runId,
            live_commands_blocked: true
          }),
          xhs_closeout_rhythm: expect.objectContaining({
            state: "cooldown",
            full_bundle_blocked: true
          })
        }
      });

      const persisted = await profileStore.readMeta("xhs_rhythm_probe_risk_profile");
      expect(persisted?.accountSafety).toMatchObject({
        state: "account_risk_blocked",
        reason: "ACCOUNT_ABNORMAL",
        sourceRunId: runId
      });
      expect(persisted?.xhsCloseoutRhythm).toMatchObject({
        state: "cooldown",
        probeRunId: runId,
        reasonCodes: expect.arrayContaining([
          "XHS_RECOVERY_SINGLE_PROBE_FAILED",
          "XHS_CLOSEOUT_COOLDOWN_EXTENDED"
        ])
      });
      const verificationStore = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await expect(
          verificationStore.getSessionRhythmStatusView({
            profile: "xhs_rhythm_probe_risk_profile",
            platform: "xhs",
            issueScope: "issue_209",
            runId
          })
        ).resolves.toMatchObject({
          event: {
            event_id: `rhythm_evt_${runId}`,
            event_type: "recovery_probe_failed",
            reason: "ACCOUNT_ABNORMAL"
          },
          decision: {
            decision_id: `rhythm_decision_${runId}`,
            decision: "blocked",
            reason_codes: expect.arrayContaining([
              "XHS_RECOVERY_SINGLE_PROBE_FAILED",
              "XHS_CLOSEOUT_COOLDOWN_EXTENDED",
              "ACCOUNT_ABNORMAL"
            ]),
            requires: ["session_rhythm_window_not_ready"]
          }
        });
      } finally {
        verificationStore.close();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("keeps account-safety recovery probe failure stable when rhythm status persistence fails", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-probe-risk-store-fail-"));
    const runId = "run-rhythm-probe-risk-store-fail-001";
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_probe_risk_store_fail_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_probe_risk_store_fail_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: null,
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
        }
      });
      const originalRecordSessionRhythmStatusView =
        SQLiteRuntimeStore.prototype.recordSessionRhythmStatusView;
      const recordSessionRhythmStatusViewSpy = vi
        .spyOn(SQLiteRuntimeStore.prototype, "recordSessionRhythmStatusView")
        .mockImplementation(function (
          this: SQLiteRuntimeStore,
          input: Parameters<SQLiteRuntimeStore["recordSessionRhythmStatusView"]>[0]
        ) {
          if (input.event.event_type === "recovery_probe_failed") {
            return Promise.reject(new Error("simulated rhythm status write failure"));
          }
          return originalRecordSessionRhythmStatusView.call(this, input);
        });
      try {
        await expect(
          executeCommand(
            {
              cwd,
              command: "xhs.search",
              profile: "xhs_rhythm_probe_risk_store_fail_profile",
              run_id: runId,
              params: {
                ability: {
                  id: "xhs.note.search.v1",
                  layer: "L3",
                  action: "read"
                },
                input: {
                  query: "露营"
                },
                options: {
                  xhs_recovery_probe: true,
                  simulate_result: "account_abnormal",
                  issue_scope: "issue_209",
                  target_domain: "www.xiaohongshu.com",
                  target_tab_id: 32,
                  target_page: "search_result_tab",
                  action_type: "read",
                  requested_execution_mode: "recon",
                  risk_state: "allowed"
                }
              }
            } as RuntimeContext,
            createCommandRegistry()
          )
        ).rejects.toMatchObject({
          code: "ERR_EXECUTION_FAILED",
          details: {
            reason: "ACCOUNT_ABNORMAL",
            account_safety: expect.objectContaining({
              state: "account_risk_blocked",
              reason: "ACCOUNT_ABNORMAL",
              source_run_id: runId,
              live_commands_blocked: true
            }),
            xhs_closeout_rhythm: expect.objectContaining({
              state: "cooldown",
              full_bundle_blocked: true,
              session_rhythm_status_view_skipped_reason: "sqlite_write_failed"
            })
          }
        });
      } finally {
        recordSessionRhythmStatusViewSpy.mockRestore();
      }

      const persisted = await profileStore.readMeta("xhs_rhythm_probe_risk_store_fail_profile");
      expect(persisted?.xhsCloseoutRhythm).toMatchObject({
        state: "cooldown",
        probeRunId: runId,
        reasonCodes: expect.arrayContaining([
          "XHS_RECOVERY_SINGLE_PROBE_FAILED",
          "XHS_CLOSEOUT_COOLDOWN_EXTENDED",
          "ACCOUNT_ABNORMAL"
        ])
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("skips recovery probe failure rhythm status view when issue scope is not explicit", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-probe-risk-missing-scope-"));
    const runId = "run-rhythm-probe-risk-missing-scope-001";
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_probe_risk_missing_scope_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_probe_risk_missing_scope_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: null,
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_rhythm_probe_risk_missing_scope_profile",
            run_id: runId,
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                xhs_recovery_probe: true,
                simulate_result: "account_abnormal",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "recon",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ACCOUNT_ABNORMAL",
          xhs_closeout_rhythm: expect.objectContaining({
            state: "cooldown",
            session_rhythm_status_view_skipped_reason: "issue_scope_missing"
          })
        }
      });

      const verificationStore = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await expect(
          verificationStore.getSessionRhythmStatusView({
            profile: "xhs_rhythm_probe_risk_missing_scope_profile",
            platform: "xhs",
            issueScope: "issue_209",
            runId
          })
        ).resolves.toMatchObject({
          event: {
            event_type: "recovery_probe_started"
          },
          decision: {
            reason_codes: expect.not.arrayContaining([
              "XHS_RECOVERY_SINGLE_PROBE_FAILED",
              "XHS_CLOSEOUT_COOLDOWN_EXTENDED",
              "ACCOUNT_ABNORMAL"
            ])
          }
        });
      } finally {
        verificationStore.close();
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("keeps the recovery single-probe blocked until the cooldown expires", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-cooldown-"));
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_cooldown_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_cooldown_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2099-04-25T10:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: null,
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_OPERATOR_CONFIRMED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_rhythm_cooldown_profile",
            run_id: "run-rhythm-cooldown-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                xhs_recovery_probe: true,
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "recon",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "XHS_CLOSEOUT_RHYTHM_BLOCKED",
          xhs_closeout_rhythm: expect.objectContaining({
            state: "cooldown",
            cooldown_until: "2099-04-25T10:30:00.000Z",
            reason_codes: expect.arrayContaining(["XHS_CLOSEOUT_COOLDOWN_ACTIVE"])
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("keeps account-safety blocked for recovery probes until the operator clears it", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-account-block-"));
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_account_block_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_account_block_profile", {
        ...meta,
        accountSafety: {
          state: "account_risk_blocked",
          platform: "xhs",
          reason: "ACCOUNT_ABNORMAL",
          observedAt: "2026-04-25T10:00:00.000Z",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          sourceRunId: "run-risk-account-block-001",
          sourceCommand: "xhs.search",
          targetDomain: "www.xiaohongshu.com",
          targetTabId: 32,
          pageUrl: "https://www.xiaohongshu.com/search_result?keyword=test",
          statusCode: 461,
          platformCode: 300011
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: null,
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_rhythm_account_block_profile",
            run_id: "run-rhythm-account-block-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                xhs_recovery_probe: true,
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "recon",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ACCOUNT_RISK_BLOCKED",
          account_safety: expect.objectContaining({
            state: "account_risk_blocked"
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects xhs_recovery_probe when no active recovery state requires it", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-probe-invalid-"));
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      await profileStore.initializeMeta(
        "xhs_rhythm_probe_invalid_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_rhythm_probe_invalid_profile",
            run_id: "run-rhythm-probe-invalid-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                xhs_recovery_probe: true,
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "recon",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "XHS_CLOSEOUT_RHYTHM_UNAVAILABLE",
          xhs_closeout_rhythm: expect.objectContaining({
            state: "not_required"
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects a second recovery probe after the budget is already claimed", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-rhythm-probe-claimed-"));
    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(
        "xhs_rhythm_probe_claimed_profile",
        "2026-04-25T10:00:00.000Z",
        { allowUnsupportedExtensionBrowser: true }
      );
      await profileStore.writeMeta("xhs_rhythm_probe_claimed_profile", {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: {
          state: "single_probe_required",
          cooldownUntil: "2000-01-01T00:30:00.000Z",
          operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
          singleProbeRequired: true,
          singleProbePassedAt: null,
          probeRunId: "run-already-claimed-probe-001",
          fullBundleBlocked: true,
          reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_CLAIMED"]
        }
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_rhythm_probe_claimed_profile",
            run_id: "run-rhythm-probe-claimed-002",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                xhs_recovery_probe: true,
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "recon",
                risk_state: "allowed"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "XHS_CLOSEOUT_RHYTHM_BLOCKED",
          xhs_closeout_rhythm: expect.objectContaining({
            probe_run_id: "run-already-claimed-probe-001"
          })
        }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("does not persist account_safety when an XHS live command returns a generic API warning", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-account-safety-generic-"));
    const runId = "run-account-risk-generic-001";
    const requestId = "issue209-account-risk-generic-001";
    const gateInvocationId = "issue209-gate-account-risk-generic-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";
    try {
      await seedXhsCloseoutReady({ cwd, profile: "xhs_account_generic_profile" });
      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.search",
            profile: "xhs_account_generic_profile",
            run_id: runId,
            params: {
              request_id: requestId,
              gate_invocation_id: gateInvocationId,
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                query: "露营"
              },
              options: {
                simulate_result: "generic_api_warning",
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "search_result_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed",
                approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
                audit_record: createIssue209FormalAuditRecord(requestId, decisionId, approvalId)
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "TARGET_API_RESPONSE_INVALID"
        }
      });

      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.readMeta("xhs_account_generic_profile");
      expect(meta?.accountSafety).toMatchObject({
        state: "clear"
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      if (previousTransport === undefined) {
        delete process.env.WEBENVOY_NATIVE_TRANSPORT;
      } else {
        process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      }
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("preserves anonymous admission signals on the loopback runtime path and exposes request_admission_result plus execution_audit", async () => {
    const runId = "run-anon-loopback-001";
    const requestId = "req-anon-loopback-001";
    const approvalAdmissionRef = `approval_admission_${runId}_${requestId}`;
    const auditAdmissionRef = `audit_admission_${runId}_${requestId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";

    try {
      await seedXhsCloseoutReady({
        cwd: "/tmp/webenvoy",
        profile: "profile-anon-loopback-001"
      });
      const execution = await executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.detail",
          profile: "profile-anon-loopback-001",
          run_id: runId,
          params: {
            request_id: requestId,
            ability: {
              id: "xhs.note.detail.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              note_id: "abc123"
            },
            options: {
              issue_scope: "issue_209",
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "explore_detail_tab",
              action_type: "read",
              requested_execution_mode: "live_read_high_risk",
              risk_state: "allowed",
              upstream_authorization_request: {
                action_request: {
                  request_ref: "upstream_req_loopback_anon_001",
                  action_name: "xhs.read_note_detail",
                  action_category: "read"
                },
                resource_binding: {
                  binding_ref: "binding_loopback_anon_001",
                  resource_kind: "anonymous_context",
                  profile_ref: null,
                  binding_constraints: {
                    anonymous_required: true,
                    reuse_logged_in_context_forbidden: true
                  }
                },
                authorization_grant: {
                  grant_ref: "grant_loopback_anon_001",
                  allowed_actions: ["xhs.read_note_detail"],
                  binding_scope: {
                    allowed_resource_kinds: ["anonymous_context"],
                    allowed_profile_refs: []
                  },
                  target_scope: {
                    allowed_domains: ["www.xiaohongshu.com"],
                    allowed_pages: ["explore_detail_tab"]
                  },
                  resource_state_snapshot: "active",
                  approval_refs: [approvalAdmissionRef],
                  audit_refs: [auditAdmissionRef]
                },
                runtime_target: {
                  target_ref: "target_loopback_anon_001",
                  domain: "www.xiaohongshu.com",
                  page: "explore_detail_tab",
                  tab_id: 32
                }
              },
              approval_record: {
                approved: true,
                approver: "qa-reviewer",
                approved_at: "2026-03-23T10:00:00Z",
                checks: {
                  target_domain_confirmed: true,
                  target_tab_confirmed: true,
                  target_page_confirmed: true,
                  risk_state_checked: true,
                  action_type_confirmed: true
                }
              },
              admission_context: createApprovedAnonymousReadAdmissionContext(runId, requestId),
              __anonymous_isolation_verified: true,
              target_site_logged_in: false
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(execution.summary).toMatchObject({
        xhs_page_runtime_readiness: {
          provider_admission_readiness: {
            status: "ready",
            admission_decision: "allowed",
            blocking_reasons: []
          }
        },
        request_admission_result: {
          admission_decision: "allowed",
          anonymous_isolation_ok: true
        },
        execution_audit: {
          request_ref: "upstream_req_loopback_anon_001",
          request_admission_decision: "allowed",
          consumed_inputs: {
            action_request_ref: "upstream_req_loopback_anon_001",
            resource_binding_ref: "binding_loopback_anon_001",
            authorization_grant_ref: "grant_loopback_anon_001",
            runtime_target_ref: "target_loopback_anon_001"
          },
          compatibility_refs: {
            approval_admission_ref: approvalAdmissionRef,
            audit_admission_ref: auditAdmissionRef
          }
        }
      });
      expect(execution.summary.page_runtime_readiness_blocking_reasons).not.toContain(
        "provider:provider_admission_result_missing"
      );
      expect(execution.summary.page_runtime_readiness_blocking_reasons).not.toContain(
        "provider:provider_admission_not_allowed"
      );
    } finally {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("forwards unified session rhythm admission from the persisted rhythm store before profile meta fallback", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-persisted-rhythm-"));
    const profile = "profile-persisted-rhythm-refs-001";
    const runId = "run-persisted-rhythm-refs-001";
    const requestId = "req-persisted-rhythm-refs-001";
    const approvalAdmissionRef = `approval_admission_${runId}_${requestId}`;
    const auditAdmissionRef = `audit_admission_${runId}_${requestId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";

    try {
      const profileStore = new ProfileStore(join(cwd, ".webenvoy", "profiles"));
      const meta = await profileStore.initializeMeta(profile, "2026-04-25T10:00:00.000Z", {
        allowUnsupportedExtensionBrowser: true
      });
      await profileStore.writeMeta(profile, {
        ...meta,
        accountSafety: {
          state: "clear",
          platform: null,
          reason: null,
          observedAt: null,
          cooldownUntil: null,
          sourceRunId: null,
          sourceCommand: null,
          targetDomain: null,
          targetTabId: null,
          pageUrl: null,
          statusCode: null,
          platformCode: null
        },
        xhsCloseoutRhythm: undefined
      });
      const store = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        await store.recordSessionRhythmStatusView({
          profile,
          platform: "xhs",
          issueScope: "issue_209",
          windowState: {
            window_id: "rhythm_win_persisted_issue_209",
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-001",
            current_phase: "steady",
            risk_state: "limited",
            window_started_at: "2026-04-25T10:40:00.000Z",
            window_deadline_at: "2026-04-25T11:00:00.000Z",
            cooldown_until: null,
            recovery_probe_due_at: null,
            stability_window_until: "2026-04-25T11:00:00.000Z",
            risk_signal_count: 0,
            last_event_id: "rhythm_evt_persisted_refs",
            source_run_id: "run-recovery-probe-persisted",
            updated_at: "2026-04-25T10:41:00.000Z"
          },
          event: {
            event_id: "rhythm_evt_persisted_refs",
            profile,
            platform: "xhs",
            issue_scope: "issue_209",
            session_id: "nm-session-001",
            window_id: "rhythm_win_persisted_issue_209",
            event_type: "recovery_probe_passed",
            phase_before: "recovery_probe",
            phase_after: "steady",
            risk_state_before: "limited",
            risk_state_after: "limited",
            source_audit_event_id: "gate_evt_persisted_refs",
            reason: "XHS_RECOVERY_SINGLE_PROBE_PASSED",
            recorded_at: "2026-04-25T10:41:00.000Z"
          },
          decision: {
            decision_id: "rhythm_decision_persisted_refs",
            window_id: "rhythm_win_persisted_issue_209",
            run_id: "run-recovery-probe-persisted",
            session_id: "nm-session-001",
            profile,
            current_phase: "steady",
            current_risk_state: "limited",
            next_phase: "steady",
            next_risk_state: "limited",
            effective_execution_mode: "live_read_high_risk",
            decision: "allowed",
            reason_codes: ["XHS_RECOVERY_SINGLE_PROBE_PASSED"],
            requires: [],
            decided_at: "2026-04-25T10:41:00.000Z"
          }
        });
      } finally {
        store.close();
      }

      const execution = await executeCommand(
        {
          cwd,
          command: "xhs.detail",
          profile,
          run_id: runId,
          params: {
            request_id: requestId,
            ability: {
              id: "xhs.note.detail.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              note_id: "abc123"
            },
            options: {
              issue_scope: "issue_209",
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "explore_detail_tab",
              action_type: "read",
              requested_execution_mode: "live_read_high_risk",
              risk_state: "allowed",
              upstream_authorization_request: {
                action_request: {
                  request_ref: "upstream_req_persisted_refs_001",
                  action_name: "xhs.read_note_detail",
                  action_category: "read"
                },
                resource_binding: {
                  binding_ref: "binding_persisted_refs_001",
                  resource_kind: "anonymous_context",
                  profile_ref: null,
                  binding_constraints: {
                    anonymous_required: true,
                    reuse_logged_in_context_forbidden: true
                  }
                },
                authorization_grant: {
                  grant_ref: "grant_persisted_refs_001",
                  allowed_actions: ["xhs.read_note_detail"],
                  binding_scope: {
                    allowed_resource_kinds: ["anonymous_context"],
                    allowed_profile_refs: []
                  },
                  target_scope: {
                    allowed_domains: ["www.xiaohongshu.com"],
                    allowed_pages: ["explore_detail_tab"]
                  },
                  resource_state_snapshot: "active",
                  approval_refs: [approvalAdmissionRef],
                  audit_refs: [auditAdmissionRef]
                },
                runtime_target: {
                  target_ref: "target_persisted_refs_001",
                  domain: "www.xiaohongshu.com",
                  page: "explore_detail_tab",
                  tab_id: 32
                }
              },
              approval_record: {
                approved: true,
                approver: "qa-reviewer",
                approved_at: "2026-03-23T10:00:00Z",
                checks: ISSUE209_APPROVAL_CHECKS
              },
              admission_context: createApprovedAnonymousReadAdmissionContext(runId, requestId),
              __anonymous_isolation_verified: true,
              target_site_logged_in: false
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(execution.summary).toMatchObject({
        gate_input: {
          session_rhythm_window_id: "rhythm_win_persisted_issue_209",
          session_rhythm_decision_id: `rhythm_decision_preflight_${runId}`
        },
        execution_audit: {
          compatibility_refs: {
            approval_admission_ref: approvalAdmissionRef,
            audit_admission_ref: auditAdmissionRef,
            session_rhythm_window_id: "rhythm_win_persisted_issue_209",
            session_rhythm_decision_id: `rhythm_decision_preflight_${runId}`
          }
        }
      });
      const verificationStore = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
      try {
        const persistedRhythm = await verificationStore.getSessionRhythmStatusView({
          profile,
          platform: "xhs",
          issueScope: "issue_209",
          runId
        });
        expect(persistedRhythm?.decision).toMatchObject({
          decision_id: `rhythm_decision_preflight_${runId}`,
          run_id: runId,
          session_id: expect.any(String),
          effective_execution_mode: "live_read_high_risk",
          decision: "deferred",
          reason_codes: ["XHS_LIVE_ADMISSION_PENDING_EXECUTION_AUDIT"],
          requires: ["execution_audit_appended"]
        });
      } finally {
        verificationStore.close();
      }
    } finally {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("preserves explicit top-level gate_invocation_id through formal-source live reads", async () => {
    const runId = "run-formal-source-loopback-001";
    const requestId = "issue209-live-formal-source-loopback-001";
    const gateInvocationId = "issue209-gate-run-formal-source-loopback-001-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";

    try {
      await seedXhsCloseoutReady({
        cwd: "/tmp/webenvoy",
        profile: "profile-formal-source-loopback-001"
      });
      const execution = await executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.search",
          profile: "profile-formal-source-loopback-001",
          run_id: runId,
          params: {
            request_id: requestId,
            gate_invocation_id: gateInvocationId,
            ability: {
              id: "xhs.note.search.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              query: "露营"
            },
            options: {
              simulate_result: "success",
              issue_scope: "issue_209",
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "search_result_tab",
              action_type: "read",
              requested_execution_mode: "live_read_high_risk",
              risk_state: "allowed",
              approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
              audit_record: createIssue209FormalAuditRecord(requestId, decisionId, approvalId)
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(execution.summary).toMatchObject({
        gate_input: {
          admission_context: {
            approval_admission_evidence: {
              decision_id: decisionId,
              approval_id: approvalId,
              run_id: runId
            },
            audit_admission_evidence: {
              decision_id: decisionId,
              approval_id: approvalId,
              run_id: runId
            }
          }
        },
        gate_outcome: {
          decision_id: decisionId,
          gate_decision: "allowed",
          gate_reasons: ["LIVE_MODE_APPROVED"]
        },
        approval_record: {
          decision_id: decisionId,
          approval_id: approvalId,
          approved: true
        },
        audit_record: {
          decision_id: decisionId,
          approval_id: approvalId,
          gate_decision: "allowed"
        },
        request_admission_result: {
          request_ref: requestId,
          admission_decision: "allowed"
        },
        execution_audit: null
      });
    } finally {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("emits xhs.search passive API readiness contract fields on successful loopback bridge reads", async () => {
    const runId = "run-search-passive-readiness-001";
    const requestId = "issue209-live-search-passive-readiness-001";
    const gateInvocationId = "issue209-gate-run-search-passive-readiness-001-001";
    const decisionId = `gate_decision_${gateInvocationId}`;
    const approvalId = `gate_appr_${decisionId}`;
    const bridge = new NativeMessagingBridge({
      transport: createLoopbackNativeBridgeTransport()
    });

    const result = await bridge.runCommand({
      runId,
      profile: "profile-search-passive-readiness-001",
      cwd: "/tmp/webenvoy",
      command: "xhs.search",
      params: {
        request_id: requestId,
        gate_invocation_id: gateInvocationId,
        ability: {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        },
        input: {
          query: "露营装备"
        },
        options: {
          simulate_result: "success",
          issue_scope: "issue_209",
          target_domain: "www.xiaohongshu.com",
          target_tab_id: 32,
          target_page: "search_result_tab",
          action_type: "read",
          requested_execution_mode: "live_read_high_risk",
          risk_state: "allowed",
          xhs_search_passive_readiness_contract: true,
          __runtime_profile_ref: "profile-search-passive-readiness-001",
          approval_record: createIssue209FormalApprovalRecord(decisionId, approvalId),
          audit_record: createIssue209FormalAuditRecord(requestId, decisionId, approvalId)
        }
      }
    });

    expect(result.ok).toBe(true);
    const summary = result.ok ? result.payload.summary : null;

    expect(summary).toMatchObject({
      route_evidence: {
        route: "xhs.search.api",
        route_role: "primary",
        path_kind: "api",
        evidence_status: "success",
        evidence_class: "passive_api_capture",
        profile_ref: "profile/profile-search-passive-readiness-001",
        target_tab_id: 32,
        run_id: runId,
        action_ref: "action/xhs.search/submit_query"
      },
      request_context: {
        status: "exact_hit",
        query: "露营装备",
        profile_ref: "profile/profile-search-passive-readiness-001",
        target_tab_id: 32,
        run_id: runId,
        action_ref: "action/xhs.search/submit_query"
      }
    });

    const summaryObject = summary as Record<string, unknown>;
    const formalCloseoutRouteEvidence =
      summaryObject.closeout_route_evidence ?? summaryObject.route_evidence;
    expect(formalCloseoutRouteEvidence).toMatchObject({
      route: "xhs.search.api",
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      profile_ref: "profile/profile-search-passive-readiness-001",
      target_tab_id: 32,
      page_url: expect.any(String),
      run_id: runId,
      action_ref: "action/xhs.search/submit_query"
    });
    const passiveCloseoutExpected = {
      latest_head_sha: "head-closeout-001",
      run_id: "run-closeout-001",
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      artifact_identities: [
        "artifact/xhs-closeout/run-closeout-001/round-1",
        "artifact/xhs-closeout/run-closeout-001/round-2"
      ],
      profile_ref: "profile/xhs_closeout_001",
      target_tab_id: 32,
      page_url: "https://www.xiaohongshu.com/explore?keyword=closeout",
      action_ref: "action/xhs.search/submit_query"
    };
    const firstPassiveCloseoutRound = {
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      head_sha: passiveCloseoutExpected.latest_head_sha,
      run_id: passiveCloseoutExpected.run_id,
      artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-1",
      profile_ref: passiveCloseoutExpected.profile_ref,
      target_tab_id: passiveCloseoutExpected.target_tab_id,
      page_url: passiveCloseoutExpected.page_url,
      action_ref: passiveCloseoutExpected.action_ref
    };

    expect(
      evaluateXhsCloseoutEvidenceForContract({
        closeout_audit_required: true,
        closeout_evidence_expected: passiveCloseoutExpected,
        closeout_route_evidence: firstPassiveCloseoutRound,
        closeout_evidence_rounds: [
          firstPassiveCloseoutRound,
          {
            ...firstPassiveCloseoutRound,
            artifact_identity: "artifact/xhs-closeout/run-closeout-001/round-2"
          }
        ]
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      reproduced_multi_round: true,
      blockers: []
    });

    expect(
      evaluateXhsSearchPrimaryPassiveApiReadinessForContract({
        expected: {
          query: "露营装备",
          profile_ref: "profile/profile-search-passive-readiness-001",
          target_tab_id: 32,
          page_url: "https://www.xiaohongshu.com/search_result?keyword=%E9%9C%B2%E8%90%A5%E8%A3%85%E5%A4%87",
          run_id: runId,
          action_ref: "action/xhs.search/submit_query"
        },
        summary
      })
    ).toMatchObject({
      decision: "PASS",
      passed: true,
      blockers: []
    });
  });

  it("preserves explicit false anonymous admission signals on the loopback runtime path for blocked runs", async () => {
    const runId = "run-anon-loopback-blocked-001";
    const requestId = "req-anon-loopback-blocked-001";
    const approvalAdmissionRef = `approval_admission_${runId}_${requestId}`;
    const auditAdmissionRef = `audit_admission_${runId}_${requestId}`;
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";

    try {
      await seedXhsCloseoutReady({
        cwd: "/tmp/webenvoy",
        profile: "profile-anon-loopback-blocked-001"
      });
      await expect(
        executeCommand(
          {
            cwd: "/tmp/webenvoy",
            command: "xhs.detail",
            profile: "profile-anon-loopback-blocked-001",
            run_id: runId,
            params: {
              request_id: requestId,
              ability: {
                id: "xhs.note.detail.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                note_id: "abc123"
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "explore_detail_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed",
                upstream_authorization_request: {
                  action_request: {
                    request_ref: "upstream_req_loopback_anon_blocked_001",
                    action_name: "xhs.read_note_detail",
                    action_category: "read"
                  },
                  resource_binding: {
                    binding_ref: "binding_loopback_anon_blocked_001",
                    resource_kind: "anonymous_context",
                    profile_ref: null,
                    binding_constraints: {
                      anonymous_required: true,
                      reuse_logged_in_context_forbidden: true
                    }
                  },
                  authorization_grant: {
                    grant_ref: "grant_loopback_anon_blocked_001",
                    allowed_actions: ["xhs.read_note_detail"],
                    binding_scope: {
                      allowed_resource_kinds: ["anonymous_context"],
                      allowed_profile_refs: []
                    },
                    target_scope: {
                      allowed_domains: ["www.xiaohongshu.com"],
                      allowed_pages: ["explore_detail_tab"]
                    },
                    resource_state_snapshot: "active",
                    approval_refs: [approvalAdmissionRef],
                    audit_refs: [auditAdmissionRef]
                  },
                  runtime_target: {
                    target_ref: "target_loopback_anon_blocked_001",
                    domain: "www.xiaohongshu.com",
                    page: "explore_detail_tab",
                    tab_id: 32
                  }
                },
                approval_record: {
                  approved: true,
                  approver: "qa-reviewer",
                  approved_at: "2026-03-23T10:00:00Z",
                  checks: {
                    target_domain_confirmed: true,
                    target_tab_confirmed: true,
                    target_page_confirmed: true,
                    risk_state_checked: true,
                    action_type_confirmed: true
                  }
                },
                admission_context: createApprovedAnonymousReadAdmissionContext(runId, requestId),
                __anonymous_isolation_verified: false,
                target_site_logged_in: false
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: expect.objectContaining({
          request_admission_result: expect.objectContaining({
            request_ref: "upstream_req_loopback_anon_blocked_001",
            admission_decision: "blocked",
            anonymous_isolation_ok: false
          }),
          execution_audit: expect.objectContaining({
            request_ref: "upstream_req_loopback_anon_blocked_001",
            request_admission_decision: "blocked",
            consumed_inputs: expect.objectContaining({
              action_request_ref: "upstream_req_loopback_anon_blocked_001",
              resource_binding_ref: "binding_loopback_anon_blocked_001",
              authorization_grant_ref: "grant_loopback_anon_blocked_001",
              runtime_target_ref: "target_loopback_anon_blocked_001"
            }),
            compatibility_refs: expect.objectContaining({
              approval_admission_ref: approvalAdmissionRef,
              audit_admission_ref: auditAdmissionRef
            })
          })
        })
      });
    } finally {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("preserves explicit null gate diagnostics in CLI error details", async () => {
    const runId = "run-anon-loopback-unknown-001";
    const requestId = "req-anon-loopback-unknown-001";
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";

    try {
      await seedXhsCloseoutReady({
        cwd: "/tmp/webenvoy",
        profile: "profile-anon-loopback-unknown-001"
      });
      await expect(
        executeCommand(
          {
            cwd: "/tmp/webenvoy",
            command: "xhs.detail",
            profile: "profile-anon-loopback-unknown-001",
            run_id: runId,
            params: {
              request_id: requestId,
              ability: {
                id: "xhs.note.detail.v1",
                layer: "L3",
                action: "read"
              },
              input: {
                note_id: "abc123"
              },
              options: {
                issue_scope: "issue_209",
                target_domain: "www.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "explore_detail_tab",
                action_type: "read",
                requested_execution_mode: "live_read_high_risk",
                risk_state: "allowed",
                upstream_authorization_request: {
                  action_request: {
                    request_ref: "upstream_req_loopback_anon_unknown_001",
                    action_name: "xhs.read_note_detail",
                    action_category: "read"
                  },
                  resource_binding: {
                    binding_ref: "binding_loopback_anon_unknown_001",
                    resource_kind: "anonymous_context",
                    profile_ref: null,
                    binding_constraints: {
                      anonymous_required: true,
                      reuse_logged_in_context_forbidden: true
                    }
                  },
                  authorization_grant: {
                    grant_ref: "grant_loopback_anon_unknown_001",
                    allowed_actions: ["xhs.read_note_detail"],
                    binding_scope: {
                      allowed_resource_kinds: ["anonymous_context"],
                      allowed_profile_refs: []
                    },
                    target_scope: {
                      allowed_domains: ["www.xiaohongshu.com"],
                      allowed_pages: ["explore_detail_tab"]
                    },
                    resource_state_snapshot: "active",
                    approval_refs: [`approval_admission_${runId}_${requestId}`],
                    audit_refs: [`audit_admission_${runId}_${requestId}`]
                  },
                  runtime_target: {
                    target_ref: "target_loopback_anon_unknown_001",
                    domain: "www.xiaohongshu.com",
                    page: "explore_detail_tab",
                    tab_id: 32
                  }
                },
                approval_record: {
                  approved: true,
                  approver: "qa-reviewer",
                  approved_at: "2026-03-23T10:00:00Z",
                  checks: {
                    target_domain_confirmed: true,
                    target_tab_confirmed: true,
                    target_page_confirmed: true,
                    risk_state_checked: true,
                    action_type_confirmed: true
                  }
                },
                admission_context: createApprovedAnonymousReadAdmissionContext(runId, requestId)
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: expect.objectContaining({
          request_admission_result: null,
          execution_audit: null
        })
      });
    } finally {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("keeps issue_208 editor_input gate and interaction diagnostics in CLI error details", async () => {
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";

    try {
      await seedXhsCloseoutReady({
        cwd: "/tmp/webenvoy",
        profile: "profile-loopback-editor-input-001",
        effectiveExecutionMode: "live_write"
      });
      await expect(
        executeCommand(
          {
            cwd: "/tmp/webenvoy",
            command: "xhs.search",
            profile: "profile-loopback-editor-input-001",
            run_id: "run-loopback-editor-input-001",
            params: {
              ability: {
                id: "xhs.note.search.v1",
                layer: "L3",
                action: "write"
              },
              input: {
                query: "露营装备"
              },
              options: {
                issue_scope: "issue_208",
                target_domain: "creator.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "creator_publish_tab",
                action_type: "write",
                requested_execution_mode: "live_write",
                validation_action: "editor_input",
                risk_state: "allowed",
                approval_record: {
                  approved: true,
                  approver: "qa-reviewer",
                  approved_at: "2026-03-23T10:00:00Z",
                  checks: {
                    target_domain_confirmed: true,
                    target_tab_confirmed: true,
                    target_page_confirmed: true,
                    risk_state_checked: true,
                    action_type_confirmed: true
                  }
                }
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: expect.objectContaining({
          gate_reasons: expect.arrayContaining(["EXECUTION_MODE_UNSUPPORTED_FOR_COMMAND"]),
          issue_action_matrix: expect.objectContaining({
            issue_scope: "issue_208"
          }),
          write_action_matrix_decisions: expect.objectContaining({
            requested_execution_mode: "live_write",
            write_interaction_tier: "reversible_interaction"
          }),
          consumer_gate_result: expect.objectContaining({
            gate_decision: "blocked",
            requested_execution_mode: "live_write"
          }),
          request_admission_result: expect.objectContaining({
            admission_decision: "blocked"
          }),
          execution_audit: null,
          audit_record: expect.objectContaining({
            requested_execution_mode: "live_write"
          }),
          command_alias_diagnostics: expect.objectContaining({
            status: "deprecated_alias",
            source_command: "xhs.search",
            canonical_command: "xhs.editor_input.validate",
            canonical_ability_id: "xhs.editor.input.v1",
            validation_action: "editor_input"
          })
        })
      });
    } finally {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("routes xhs.editor_input.validate through the issue_208 editor_input gate without requiring query", async () => {
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";

    try {
      await seedXhsCloseoutReady({
        cwd: "/tmp/webenvoy",
        profile: "profile-loopback-editor-input-alias-001",
        effectiveExecutionMode: "live_write"
      });
      await expect(
        executeCommand(
          {
            cwd: "/tmp/webenvoy",
            command: "xhs.editor_input.validate",
            profile: "profile-loopback-editor-input-alias-001",
            run_id: "run-loopback-editor-input-alias-001",
            params: {
              ability: {
                id: "xhs.editor.input.v1",
                layer: "L3",
                action: "write"
              },
              input: {},
              options: {
                target_domain: "creator.xiaohongshu.com",
                target_tab_id: 32,
                target_page: "creator_publish_tab",
                requested_execution_mode: "live_write",
                risk_state: "allowed",
                approval_record: {
                  approved: true,
                  approver: "qa-reviewer",
                  approved_at: "2026-03-23T10:00:00Z",
                  checks: {
                    target_domain_confirmed: true,
                    target_tab_confirmed: true,
                    target_page_confirmed: true,
                    risk_state_checked: true,
                    action_type_confirmed: true
                  }
                }
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: expect.objectContaining({
          gate_reasons: expect.arrayContaining(["EXECUTION_MODE_UNSUPPORTED_FOR_COMMAND"]),
          validation_action: "editor_input",
          issue_action_matrix: expect.objectContaining({
            issue_scope: "issue_208"
          }),
          consumer_gate_result: expect.objectContaining({
            gate_decision: "blocked",
            action_type: "write",
            requested_execution_mode: "live_write"
          })
        })
      });
    } finally {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
    }
  });

  it("uses creator admission validation bundle for issue_835 controlled live write preflight", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-controlled-live-write-bundle-"));
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";

    try {
      await seedXhsCloseoutReady({
        cwd,
        profile: "profile-controlled-live-write-bundle-001",
        effectiveExecutionMode: "live_write",
        validationTargetDomain: "creator.xiaohongshu.com",
        validationTargetPage: "creator_publish_tab",
        validationEvidenceMode: "live_write",
        validationProbeBundleRef: "probe-bundle/xhs-creator-live-write-admission-v1"
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.creator_publish.controlled_live_write",
            profile: "profile-controlled-live-write-bundle-001",
            run_id: "run-controlled-live-write-bundle-001",
            params: {
              input: {
                live_write_attempt_id: "fr0032-attempt-bundle-001",
                source_media_ref: "media-ref/fr-0032/fixture-image-a",
                source_media_digest: FR0032_APPROVED_FIXTURE_IMAGE_A_DIGEST,
                source_media_kind: "image"
              },
              target_domain: "creator.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "creator_publish_tab",
              requested_execution_mode: "live_write",
              risk_state: "allowed"
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_CLI_INVALID_ARGS",
        details: expect.objectContaining({
          reason: "LIVE_WRITE_APPROVAL_ADMISSION_CONTEXT_MISSING",
          blocker_code: "LIVE_WRITE_APPROVAL_ADMISSION_CONTEXT_MISSING"
        })
      });
    } finally {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("accepts issue_835 controlled live write admission context through dedicated shorthand", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "webenvoy-xhs-controlled-live-write-shorthand-"));
    const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
    const previousBrowserPath = process.env.WEBENVOY_BROWSER_PATH;
    const previousBrowserMockVersion = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
    const runId = "run-controlled-live-write-shorthand-001";
    const targetTabId = 32;
    process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
    process.env.WEBENVOY_BROWSER_PATH = join(process.cwd(), "tests", "fixtures", "mock-browser.sh");
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Chromium 146.0.0.0";

    try {
      await seedXhsCloseoutReady({
        cwd,
        profile: "profile-controlled-live-write-shorthand-001",
        effectiveExecutionMode: "live_write",
        validationTargetDomain: "creator.xiaohongshu.com",
        validationTargetPage: "creator_publish_tab",
        validationEvidenceMode: "live_write",
        validationProbeBundleRef: "probe-bundle/xhs-creator-live-write-admission-v1"
      });

      await expect(
        executeCommand(
          {
            cwd,
            command: "xhs.creator_publish.controlled_live_write",
            profile: "profile-controlled-live-write-shorthand-001",
            run_id: runId,
            params: {
              input: {
                live_write_attempt_id: "fr0032-attempt-shorthand-001",
                source_media_ref: "media-ref/fr-0032/fixture-image-a",
                source_media_digest: FR0032_APPROVED_FIXTURE_IMAGE_A_DIGEST,
                source_media_kind: "image"
              },
              target_domain: "creator.xiaohongshu.com",
              target_tab_id: targetTabId,
              target_page: "creator_publish_tab",
              requested_execution_mode: "live_write",
              risk_state: "allowed",
              issue_scope: "issue_835",
              action_type: "write",
              controlled_live_write: true,
              confirm_live_write: true,
              publish_visibility_scope: "private_or_self_visible",
              cleanup_policy_ref: "fr0032-cleanup-policy/manual-delete-or-residual",
              admission_context: createApprovedIssue835LiveWriteAdmissionContext({
                runId,
                targetTabId
              }),
              approval_record: {
                approved: true,
                approver: "mcontheway",
                approved_at: "2026-06-04T13:40:00.000Z",
                checks: {
                  target_domain_confirmed: true,
                  target_tab_confirmed: true,
                  target_page_confirmed: true,
                  risk_state_checked: true,
                  action_type_confirmed: true
                }
              },
              audit_record: {
                event_id: "gate_evt_issue835_shorthand_001",
                issue_scope: "issue_835",
                target_domain: "creator.xiaohongshu.com",
                target_tab_id: targetTabId,
                target_page: "creator_publish_tab",
                action_type: "write",
                requested_execution_mode: "live_write",
                risk_state: "allowed",
                gate_decision: "allowed",
                audited_checks: {
                  target_domain_confirmed: true,
                  target_tab_confirmed: true,
                  target_page_confirmed: true,
                  risk_state_checked: true,
                  action_type_confirmed: true
                },
                recorded_at: "2026-06-04T13:41:00.000Z"
              }
            }
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).rejects.toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: expect.objectContaining({
          reason: "EXECUTION_MODE_GATE_BLOCKED",
          gate_input: expect.objectContaining({
            admission_context: expect.objectContaining({
              approval_admission_evidence: expect.objectContaining({
                issue_scope: "issue_835",
                run_id: runId,
                session_id: "nm-session-001"
              }),
              audit_admission_evidence: expect.objectContaining({
                issue_scope: "issue_835",
                risk_state: "allowed",
                session_id: "nm-session-001"
              })
            })
          }),
          request_admission_result: expect.objectContaining({
            derived_from: expect.objectContaining({
              approval_admission_ref: `approval_admission_${runId}`,
              audit_admission_ref: `audit_admission_${runId}`
            })
          }),
          consumer_gate_result: expect.objectContaining({
            issue_scope: "issue_835",
            requested_execution_mode: "live_write",
            effective_execution_mode: "dry_run"
          }),
          approval_record: expect.objectContaining({
            approved: true,
            approver: "mcontheway"
          }),
          audit_record: expect.objectContaining({
            issue_scope: "issue_835",
            target_domain: "creator.xiaohongshu.com",
            risk_state: "allowed"
          })
        })
      });
    } finally {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
      if (previousBrowserPath === undefined) {
        delete process.env.WEBENVOY_BROWSER_PATH;
      } else {
        process.env.WEBENVOY_BROWSER_PATH = previousBrowserPath;
      }
      if (previousBrowserMockVersion === undefined) {
        delete process.env.WEBENVOY_BROWSER_MOCK_VERSION;
      } else {
        process.env.WEBENVOY_BROWSER_MOCK_VERSION = previousBrowserMockVersion;
      }
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it.each([
    {
      command: "xhs.creator_publish.admit",
      params: {
        target_domain: "creator.xiaohongshu.com",
        target_tab_id: 32,
        target_page: "creator_publish_tab",
        requested_execution_mode: "dry_run",
        risk_state: "allowed",
        fixture_success: true
      }
    },
    {
      command: "xhs.media_upload.discover",
      params: {
        target_domain: "creator.xiaohongshu.com",
        target_tab_id: 32,
        target_page: "creator_publish_tab",
        requested_execution_mode: "recon",
        risk_state: "allowed",
        fixture_success: true
      }
    },
    {
      command: "xhs.editor_input.validate",
      params: {
        target_domain: "creator.xiaohongshu.com",
        target_tab_id: 32,
        target_page: "creator_publish_tab",
        requested_execution_mode: "live_write",
        risk_state: "allowed",
        fixture_success: true
      }
    },
    {
      command: "xhs.editor_text.write",
      params: {
        input: {
          text: "controlled editor text"
        },
        target_domain: "creator.xiaohongshu.com",
        target_tab_id: 32,
        target_page: "creator_publish_tab",
        requested_execution_mode: "live_write",
        risk_state: "allowed",
        fixture_success: true
      }
    }
  ])("accepts $command shorthand params without requiring a caller-supplied ability envelope", async ({ command, params }) => {
    const previousFixtureSuccess = process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS;
    process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS = "1";

    try {
      await expect(
        executeCommand(
          {
            cwd: "/tmp/webenvoy",
            command,
            profile: "profile-shorthand-dedicated-xhs-001",
            run_id: `run-shorthand-${command.replaceAll(".", "-")}-001`,
            params
          } as RuntimeContext,
          createCommandRegistry()
        )
      ).resolves.toHaveProperty("summary");
    } finally {
      if (previousFixtureSuccess === undefined) {
        delete process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS;
      } else {
        process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS = previousFixtureSuccess;
      }
    }
  });

  it("attaches #1179 provider requirements to xhs.creator_publish.admit fixture dry-run output", async () => {
    const previousFixtureSuccess = process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS;
    process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS = "1";

    try {
      const result = await executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.creator_publish.admit",
          profile: "profile-1179-provider-requirements-001",
          run_id: "run-1179-provider-requirements-001",
          params: {
            target_domain: "creator.xiaohongshu.com",
            target_tab_id: 32,
            target_page: "creator_publish_tab",
            requested_execution_mode: "dry_run",
            risk_state: "allowed",
            fixture_success: true
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(result).toMatchObject({
        summary: {
          provider_requirement_refs: [
            "issue-1179.xhs_creator_publish_admit_provider_requirements.v1/write_admit"
          ],
          xhs_driver_provider_requirements: {
            ability_scope: {
              command: "xhs.creator_publish.admit",
              ability_id: "xhs.creator.publish.v1",
              ability_action: "write"
            },
            required_actions: ["diagnose"],
            live_write_capability_gate_input: {
              requested_capability_level: "write_admit",
              maximum_capability_level: "write_admit",
              minimum_required_level: "write_admit"
            },
            default_live_write_commit_lock: "locked"
          }
        }
      });
      expect(result.summary.xhs_driver_provider_requirements.required_actions).not.toContain(
        "write_admit"
      );
      expect(result.summary.xhs_driver_provider_requirements).not.toHaveProperty(
        "live_write_capability_gate_result"
      );
    } finally {
      if (previousFixtureSuccess === undefined) {
        delete process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS;
      } else {
        process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS = previousFixtureSuccess;
      }
    }
  });

  it("rejects a caller-supplied ability envelope that does not match the dedicated XHS command", async () => {
    await expect(
      executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.creator_publish.admit",
          profile: "profile-dedicated-xhs-mismatch-001",
          run_id: "run-dedicated-xhs-mismatch-001",
          params: {
            ability: {
              id: "xhs.editor.input.v1",
              layer: "L3",
              action: "write"
            },
            input: {},
            options: {
              target_domain: "creator.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "creator_publish_tab",
              requested_execution_mode: "dry_run",
              risk_state: "allowed"
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      )
    ).rejects.toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: expect.objectContaining({
        reason: "DEDICATED_ABILITY_MISMATCH",
        expected_ability: expect.objectContaining({
          id: "xhs.creator.publish.v1"
        }),
        actual_ability: expect.objectContaining({
          id: "xhs.editor.input.v1"
        })
      })
    });
  });

  it("keeps xhs.editor_text.write pinned to the controlled editor_input ability", async () => {
    await expect(
      executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.editor_text.write",
          profile: "profile-dedicated-xhs-editor-text-mismatch-001",
          run_id: "run-dedicated-xhs-editor-text-mismatch-001",
          params: {
            ability: {
              id: "xhs.creator.publish.v1",
              layer: "L3",
              action: "write"
            },
            input: {
              text: "controlled editor text"
            },
            options: {
              target_domain: "creator.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "creator_publish_tab",
              requested_execution_mode: "live_write",
              risk_state: "allowed"
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      )
    ).rejects.toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: expect.objectContaining({
        reason: "DEDICATED_ABILITY_MISMATCH",
        expected_ability: expect.objectContaining({
          id: "xhs.editor.input.v1"
        }),
        actual_ability: expect.objectContaining({
          id: "xhs.creator.publish.v1"
        })
      })
    });
  });

  it("keeps xhs.media_upload.discover pinned to the creator publish ability", async () => {
    await expect(
      executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.media_upload.discover",
          profile: "profile-dedicated-xhs-media-upload-mismatch-001",
          run_id: "run-dedicated-xhs-media-upload-mismatch-001",
          params: {
            ability: {
              id: "xhs.editor.input.v1",
              layer: "L3",
              action: "write"
            },
            input: {},
            options: {
              target_domain: "creator.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "creator_publish_tab",
              requested_execution_mode: "recon",
              risk_state: "allowed"
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      )
    ).rejects.toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: expect.objectContaining({
        reason: "DEDICATED_ABILITY_MISMATCH",
        expected_ability: expect.objectContaining({
          id: "xhs.creator.publish.v1"
        }),
        actual_ability: expect.objectContaining({
          id: "xhs.editor.input.v1"
        })
      })
    });
  });

  it("rejects unknown top-level shorthand options for dedicated XHS commands", async () => {
    await expect(
      executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.creator_publish.admit",
          profile: "profile-dedicated-xhs-unknown-option-001",
          run_id: "run-dedicated-xhs-unknown-option-001",
          params: {
            target_domian: "creator.xiaohongshu.com",
            target_tab_id: 32,
            target_page: "creator_publish_tab",
            requested_execution_mode: "dry_run",
            risk_state: "allowed"
          }
        } as RuntimeContext,
        createCommandRegistry()
      )
    ).rejects.toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: expect.objectContaining({
        reason: "DEDICATED_OPTION_UNKNOWN",
        unknown_keys: ["target_domian"]
      })
    });
  });

  it("rejects unknown nested shorthand options for dedicated XHS commands", async () => {
    await expect(
      executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.creator_publish.admit",
          profile: "profile-dedicated-xhs-unknown-nested-option-001",
          run_id: "run-dedicated-xhs-unknown-nested-option-001",
          params: {
            input: {},
            options: {
              target_domian: "creator.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "creator_publish_tab",
              requested_execution_mode: "dry_run",
              risk_state: "allowed"
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      )
    ).rejects.toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: expect.objectContaining({
        reason: "DEDICATED_OPTION_UNKNOWN",
        unknown_keys: ["target_domian"]
      })
    });
  });

  it("rejects full-envelope objects in dedicated XHS shorthand params", async () => {
    await expect(
      executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.creator_publish.admit",
          profile: "profile-dedicated-xhs-full-envelope-object-001",
          run_id: "run-dedicated-xhs-full-envelope-object-001",
          params: {
            runtime_target: {
              target_ref: "target_creator_publish_001",
              domain: "creator.xiaohongshu.com",
              page: "creator_publish_tab",
              tab_id: 32
            },
            target_domain: "creator.xiaohongshu.com",
            target_tab_id: 32,
            target_page: "creator_publish_tab",
            requested_execution_mode: "dry_run",
            risk_state: "allowed"
          }
        } as RuntimeContext,
        createCommandRegistry()
      )
    ).rejects.toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: expect.objectContaining({
        reason: "DEDICATED_OBJECT_REQUIRES_ABILITY",
        object_key: "runtime_target"
      })
    });
  });

});
