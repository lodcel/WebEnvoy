import { describe, expect, it } from "vitest";

import {
  evaluateFr0032LiveWriteEvidence,
  redactFr0032LiveWriteEvidence,
  type EvaluateFr0032LiveWriteEvidenceInput,
  type Fr0032CleanupRollbackProof,
  type Fr0032LiveWriteRiskSignal,
  type Fr0032LiveWriteStopSignal,
  type Fr0032PublishResultIdentity,
  type Fr0032ResidualRecord
} from "../fr0032-live-write-evidence.js";

const basePublishIdentity = (): Fr0032PublishResultIdentity => ({
  schema_version: "fr-0032.publish_result_identity.v1",
  publish_result_id: "publish-result/fr-0032/run-846/result-001",
  live_write_attempt_id: "live-write-attempt/fr-0032/run-846",
  run_id: "run-846",
  profile_ref: "profile/xhs_001",
  target_tab_id: 1201,
  target_domain: "creator.xiaohongshu.com",
  target_page: "creator_publish_tab",
  source_upload_artifact_id: "upload-artifact/fr-0032/run-846/source-digest-a",
  submit_action_ref: "submit-action/fr-0032/run-846/submit-001",
  result_kind: "published_url",
  note_id: null,
  published_url: "https://www.xiaohongshu.com/explore/fr0032-test-note",
  creator_result_url: null,
  platform_record_ref: null,
  publish_visibility_scope: "private_or_self_visible",
  success_signal: {
    signal_source: "creator_result_page",
    signal_locator: "creator-result-card[data-note-id='fr0032-test-note']",
    platform_message: "Published",
    observed_at: "2026-05-28T00:03:00.000Z"
  },
  captured_at: "2026-05-28T00:03:01.000Z",
  verification_state: "verified"
});

const baseCleanup = (
  publishIdentity: Fr0032PublishResultIdentity | null = basePublishIdentity()
): Fr0032CleanupRollbackProof => ({
  schema_version: "fr-0032.cleanup_rollback_proof.v1",
  cleanup_result_id: "cleanup/fr-0032/run-846/cleanup-001",
  live_write_attempt_id: "live-write-attempt/fr-0032/run-846",
  run_id: "run-846",
  profile_ref: "profile/xhs_001",
  target_tab_id: 1201,
  publish_result_identity: publishIdentity,
  cleanup_policy_ref: "cleanup-policy/fr-0032/private-delete-or-hide-v1",
  cleanup_action: "delete_published_result",
  cleanup_outcome: "deleted",
  proof_locator: "creator-result-card[data-note-id='fr0032-test-note'] .deleted-state",
  platform_message: "Deleted",
  attempted_at: "2026-05-28T00:04:00.000Z",
  completed_at: "2026-05-28T00:04:10.000Z",
  residual_record: null
});

const baseResidualRecord = (): Fr0032ResidualRecord => ({
  residual_record_id: "residual/fr-0032/run-846/residual-001",
  live_write_attempt_id: "live-write-attempt/fr-0032/run-846",
  publish_result_id: "publish-result/fr-0032/run-846/result-001",
  visibility_scope: "private_or_self_visible",
  external_visibility_may_remain: false,
  residual_locator: "creator-result-card[data-note-id='fr0032-test-note']",
  reason: "cleanup_failed",
  required_followup: "manual creator center verification before retry",
  recorded_at: "2026-05-28T00:05:00.000Z"
});

const baseInput = (): EvaluateFr0032LiveWriteEvidenceInput => {
  const publishIdentity = basePublishIdentity();

  return {
    entry_gate: {
      spec_review_state: "passed",
      latest_head_sha: "56314489e637dbfce5f79c137e44fb9b63eb9a19",
      readmission_decision: "GO",
      runtime_readiness: "ready",
      identity_binding_state: "bound",
      target_binding_state: "verified",
      account_safety_state: "clear",
      validation_rows_state: "ready_verified_no_drift",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "cleanup-policy/fr-0032/private-delete-or-hide-v1"
    },
    upload_artifact_identity: {
      upload_artifact_id: "upload-artifact/fr-0032/run-846/source-digest-a",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      source_media_kind: "image",
      platform_staging_ref: "staging/editor-preview/0",
      page_preview_locator: "input[type=file] -> preview[0]",
      accepted_by_platform: true,
      visible_in_editor: true,
      captured_at: "2026-05-28T00:01:00.000Z"
    },
    submit_evidence: {
      submit_action_ref: "submit-action/fr-0032/run-846/submit-001",
      submit_locator: "button[data-testid='publish-submit']",
      submitted_at: "2026-05-28T00:02:00.000Z",
      submit_result_state: "accepted",
      platform_message: "Accepted"
    },
    publish_result_identity: publishIdentity,
    cleanup_result: baseCleanup(publishIdentity),
    risk_signals: [],
    stop_signal: null,
    residual_record: null
  };
};

const blockingRiskSignal = (): Fr0032LiveWriteRiskSignal => ({
  risk_signal_id: "risk/fr-0032/run-846/captcha",
  detected_at: "2026-05-28T00:02:10.000Z",
  source: "submit",
  kind: "captcha_required",
  severity: "blocking",
  details_ref: "artifact/fr-0032/run-846/risk/captcha"
});

const blockingStopSignal = (): Fr0032LiveWriteStopSignal => ({
  schema_version: "fr-0032.live_write_stop_signal.v1",
  stop_signal_id: "stop/fr-0032/run-846/captcha",
  live_write_attempt_id: "live-write-attempt/fr-0032/run-846",
  run_id: "run-846",
  profile_ref: "profile/xhs_001",
  target_tab_id: 1201,
  stopped_at: "2026-05-28T00:02:11.000Z",
  stopped_step: "submit",
  blocker_layer: "risk_policy",
  blocker_code: "CAPTCHA_REQUIRED",
  severity: "blocking",
  later_write_actions_blocked: true,
  cleanup_required: true,
  cleanup_result_id: "cleanup/fr-0032/run-846/cleanup-001",
  residual_record_id: null,
  required_recovery_action: "stop live write attempt and rerun entry gate after account safety check",
  evidence_ref: "artifact/fr-0032/run-846/risk/captcha"
});

describe("FR-0032 live write evidence evaluator", () => {
  it("rejects publish success without stable result identity", () => {
    const input = baseInput();
    input.publish_result_identity = {
      ...basePublishIdentity(),
      note_id: null,
      published_url: null,
      creator_result_url: null,
      platform_record_ref: null
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      derived_attempt_state: "failed",
      publish_gate_open: false,
      publish_success: false,
      full_live_write_success: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING" })
      ])
    });
  });

  it("requires a residual record when cleanup fails", () => {
    const input = baseInput();
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      cleanup_outcome: "cleanup_failed",
      completed_at: null,
      residual_record: null
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      derived_attempt_state: "failed",
      cleanup_gate_open: true,
      cleanup_satisfied: false,
      residual_record_required: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "RESIDUAL_RECORD_REQUIRED" })
      ])
    });
  });

  it("classifies cleanup as not needed after an unpublished upload stop", () => {
    const input = baseInput();
    input.submit_evidence = null;
    input.publish_result_identity = null;
    input.cleanup_result = {
      ...baseCleanup(null),
      cleanup_action: "abandon_unpublished_upload",
      cleanup_outcome: "not_needed",
      proof_locator: "creator_publish_editor_unpublished_upload_only",
      platform_message: "upload abandoned before submit",
      residual_record: null
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      derived_attempt_state: "failed",
      upload_success: true,
      submit_success: false,
      publish_success: false,
      cleanup_satisfied: true,
      cleanup_success: true,
      cleanup_required: true,
      cleanup_result_id: "cleanup/fr-0032/run-846/cleanup-001",
      residual_record_id: null,
      residual_record_required: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "SUBMIT_EVIDENCE_MISSING" }),
        expect.objectContaining({ blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING" })
      ])
    });
  });

  it("accepts cleanup failure disclosure without treating residual content as full success", () => {
    const input = baseInput();
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      cleanup_outcome: "cleanup_failed",
      completed_at: null,
      residual_record: baseResidualRecord()
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "PASS",
      derived_attempt_state: "failed",
      cleanup_satisfied: true,
      cleanup_success: false,
      success_with_residual: true,
      cleanup_result_id: "cleanup/fr-0032/run-846/cleanup-001",
      residual_record_id: "residual/fr-0032/run-846/residual-001",
      residual_record_required: false,
      full_live_write_success: false,
      blockers: []
    });
  });

  it("accepts rollback unsupported disclosure with explicit residual record", () => {
    const input = baseInput();
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      cleanup_outcome: "rollback_not_supported",
      completed_at: null,
      residual_record: {
        ...baseResidualRecord(),
        reason: "rollback_not_supported"
      }
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "PASS",
      cleanup_satisfied: true,
      cleanup_success: false,
      success_with_residual: true,
      full_live_write_success: false,
      residual_record_required: false,
      blockers: []
    });
  });

  it("accepts cleanup blocked disclosure with explicit residual record", () => {
    const input = baseInput();
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      cleanup_outcome: "cleanup_blocked",
      completed_at: null,
      residual_record: {
        ...baseResidualRecord(),
        reason: "cleanup_blocked"
      }
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "PASS",
      cleanup_satisfied: true,
      cleanup_success: false,
      success_with_residual: true,
      full_live_write_success: false,
      residual_record_required: false,
      blockers: []
    });
  });

  it("fails closed when top-level and cleanup residual records disagree", () => {
    const input = baseInput();
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      cleanup_outcome: "cleanup_failed",
      completed_at: null,
      residual_record: baseResidualRecord()
    };
    input.residual_record = {
      ...baseResidualRecord(),
      residual_record_id: "residual/fr-0032/run-846/other-residual"
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      cleanup_satisfied: true,
      cleanup_success: false,
      residual_record_id: "residual/fr-0032/run-846/other-residual",
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "RESIDUAL_RECORD_REQUIRED" })
      ])
    });
  });

  it("compares residual record provenance on raw refs before redacted disclosure", () => {
    const input = baseInput();
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      cleanup_outcome: "cleanup_failed",
      completed_at: null,
      residual_record: {
        ...baseResidualRecord(),
        residual_record_id: "/Users/alice/Library/Application Support/WebEnvoy/residual cleanup.json"
      }
    };
    input.residual_record = {
      ...baseResidualRecord(),
      residual_record_id: "/Users/bob/Library/Application Support/WebEnvoy/residual top.json"
    };

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "NO_GO",
      cleanup_satisfied: true,
      cleanup_success: false,
      residual_record_id: "<redacted:path:private>",
      redaction_state: "redacted",
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "RESIDUAL_RECORD_REQUIRED" })
      ])
    });
    expect(serializedEvaluation).not.toContain("/Users/alice");
    expect(serializedEvaluation).not.toContain("/Users/bob");
    expect(serializedEvaluation).not.toContain("residual cleanup.json");
    expect(serializedEvaluation).not.toContain("residual top.json");
  });

  it("requires a stop signal and residual record when cleanup has no safe action", () => {
    const input = baseInput();
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      cleanup_action: "no_safe_cleanup_action",
      cleanup_outcome: "cleanup_blocked",
      completed_at: null,
      residual_record: null
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      derived_attempt_state: "failed",
      cleanup_satisfied: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      stop_signal_required: true,
      stop_signal_satisfied: false,
      residual_record_required: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "RESIDUAL_RECORD_REQUIRED" }),
        expect.objectContaining({ blocker_code: "STOP_SIGNAL_REQUIRED" })
      ])
    });
  });

  it("blocks later write actions and requires a stop signal for high-risk signals", () => {
    const input = baseInput();
    input.risk_signals = [blockingRiskSignal()];

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      derived_attempt_state: "stopped",
      later_write_actions_blocked: true,
      cleanup_gate_open: true,
      full_live_write_success: false,
      risk_signal_present: true,
      blocking_risk_signal_count: 1,
      stop_signal_present: false,
      stop_signal_required: true,
      stop_signal_satisfied: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "RISK_SIGNAL_BLOCKING" }),
        expect.objectContaining({ blocker_code: "STOP_SIGNAL_REQUIRED" })
      ])
    });
  });

  it("keeps blocking risk as NO_GO even when a blocking stop signal is attached", () => {
    const input = baseInput();
    input.risk_signals = [blockingRiskSignal()];
    input.stop_signal = blockingStopSignal();

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      derived_attempt_state: "stopped",
      later_write_actions_blocked: true,
      full_live_write_success: false,
      risk_signal_present: true,
      blocking_risk_signal_count: 1,
      stop_signal_id: "stop/fr-0032/run-846/captcha",
      stop_signal_present: true,
      stop_signal_required: true,
      stop_signal_satisfied: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "RISK_SIGNAL_BLOCKING" })
      ])
    });
    expect(evaluateFr0032LiveWriteEvidence(input).blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "STOP_SIGNAL_REQUIRED" })])
    );
  });

  it("fails closed when stop signal cleanup proof references are inconsistent", () => {
    const input = baseInput();
    input.risk_signals = [blockingRiskSignal()];
    input.stop_signal = {
      ...blockingStopSignal(),
      cleanup_result_id: "cleanup/fr-0032/run-846/stale-cleanup",
      residual_record_id: "residual/fr-0032/run-846/stale-residual"
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      stop_signal_required: true,
      stop_signal_satisfied: false,
      cleanup_result_id: "cleanup/fr-0032/run-846/cleanup-001",
      residual_record_id: null,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "STOP_SIGNAL_REQUIRED" })
      ])
    });
  });

  it("fails closed when an explicit publish stop signal has stale cleanup proof references", () => {
    const input = baseInput();
    input.stop_signal = {
      ...blockingStopSignal(),
      stopped_step: "publish",
      blocker_layer: "publish",
      blocker_code: "PUBLISH_BLOCKED",
      cleanup_result_id: "cleanup/fr-0032/run-846/stale-cleanup",
      residual_record_id: "residual/fr-0032/run-846/stale-residual"
    };

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      later_write_actions_blocked: true,
      stop_signal_required: false,
      stop_signal_satisfied: false,
      cleanup_result_id: "cleanup/fr-0032/run-846/cleanup-001",
      residual_record_id: null,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "STOP_SIGNAL_REQUIRED" })
      ])
    });
  });

  it("compares stop signal cleanup provenance on raw refs before redacted disclosure", () => {
    const input = baseInput();
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      cleanup_result_id: "/Users/alice/Library/Application Support/WebEnvoy/cleanup proof.json"
    };
    input.risk_signals = [blockingRiskSignal()];
    input.stop_signal = {
      ...blockingStopSignal(),
      cleanup_result_id: "/Users/bob/Library/Application Support/WebEnvoy/cleanup proof.json"
    };

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "NO_GO",
      cleanup_result_id: "<redacted:path:private>",
      stop_signal_required: true,
      stop_signal_satisfied: false,
      redaction_state: "redacted",
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "STOP_SIGNAL_REQUIRED" })
      ])
    });
    expect(serializedEvaluation).not.toContain("/Users/alice");
    expect(serializedEvaluation).not.toContain("/Users/bob");
    expect(serializedEvaluation).not.toContain("cleanup proof.json");
  });

  it("closes publish gate when submit is blocked by risk even without a separate risk signal", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      submit_result_state: "blocked_by_risk",
      platform_message: "captcha required"
    };
    input.risk_signals = [];

    expect(evaluateFr0032LiveWriteEvidence(input)).toMatchObject({
      decision: "NO_GO",
      derived_attempt_state: "failed",
      submit_success: false,
      later_write_actions_blocked: true,
      submit_gate_open: false,
      publish_gate_open: false,
      full_live_write_success: false,
      stop_signal_required: true,
      stop_signal_satisfied: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "SUBMIT_NOT_ACCEPTED" }),
        expect.objectContaining({ blocker_code: "SUBMIT_BLOCKED_BY_RISK" }),
        expect.objectContaining({ blocker_code: "STOP_SIGNAL_REQUIRED" })
      ])
    });
  });

  it("redacts raw live-write profile, path, proxy, seed and account evidence by default", () => {
    const input = baseInput();
    input.publish_result_identity = {
      ...basePublishIdentity(),
      profile_ref: "/Users/example/Library/Application Support/WebEnvoy/Profiles/xhs-private",
      published_url:
        "https://www.xiaohongshu.com/explore/fr0032-test-note?xsec_token=live-token-001",
      success_signal: {
        ...basePublishIdentity().success_signal,
        signal_locator: "account_email=operator@example.com phone=+15551234567 account_id=xhs-raw-001"
      }
    };
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "/Users/example/Pictures/private-live-write-seed.png"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      profile_ref: "profile/xhs_private_seeded",
      proof_locator: "/home/example/webenvoy/artifacts/live-write/proof.json"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/proxy",
        detected_at: "2026-05-28T00:02:10.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "proxy://user:password@proxy.example.invalid:8080"
      },
      {
        risk_signal_id: "risk/fr-0032/run-846/seed",
        detected_at: "2026-05-28T00:02:11.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "fingerprint-seed:raw-seed-value"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(6);
    expect(serialized).not.toContain("/Users/example");
    expect(serialized).not.toContain("/home/example");
    expect(serialized).not.toContain("live-token-001");
    expect(serialized).not.toContain("operator@example.com");
    expect(serialized).not.toContain("+15551234567");
    expect(serialized).not.toContain("xhs-raw-001");
    expect(serialized).not.toContain("private-live-write-seed.png");
    expect(serialized).not.toContain("user:password");
    expect(serialized).not.toContain("raw-seed-value");
    expect(serialized).toContain("profile-ref:redacted:");
    expect(serialized).toContain("<redacted:path:private>");
    expect(serialized).toContain("<redacted:path:source_media>");
    expect(serialized).toContain("<redacted:proxy_credential>");
    expect(serialized).toContain("<redacted:fingerprint_seed>");
    expect(serialized).toContain("<redacted:account_identifier>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.publish_result_identity.profile_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.upload_artifact_identity.source_media_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.1.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        })
      ])
    );
  });

  it("redacts seed and runtime-secret key-value forms with spaced separators", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message:
        "fingerprint_seed = raw-seed-001 main_world_secret = raw-main-secret bootstrap_secret : raw-bootstrap-secret seed= raw-seed-002"
    };

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(serialized).not.toContain("raw-seed-001");
    expect(serialized).not.toContain("raw-main-secret");
    expect(serialized).not.toContain("raw-bootstrap-secret");
    expect(serialized).not.toContain("raw-seed-002");
    expect(serialized).toContain("<redacted:fingerprint_seed>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "secret",
          locator_kind: "secret_handle",
          replacement: "<redacted:fingerprint_seed>"
        })
      ])
    );
  });

  it("evaluates spaced seed and runtime-secret forms without leaking raw values", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "fingerprint_seed = raw-seed-001 main_world_secret = raw-main-secret"
    };

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("raw-seed-001");
    expect(serializedEvaluation).not.toContain("raw-main-secret");
    expect(serializedEvaluation).toContain("<redacted:fingerprint_seed>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("redacts free-text phone and account identifiers by default", () => {
    const input = baseInput();
    input.publish_result_identity = {
      ...basePublishIdentity(),
      success_signal: {
        ...basePublishIdentity().success_signal,
        signal_locator:
          "contact +15551234567 for account xhs-raw-001; user id user-live-002; uid uid-live-003"
      }
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/free-text-account",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "operator phone +15557654321 workspace ws-live-004"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(2);
    expect(serialized).not.toContain("+15551234567");
    expect(serialized).not.toContain("xhs-raw-001");
    expect(serialized).not.toContain("user-live-002");
    expect(serialized).not.toContain("uid-live-003");
    expect(serialized).not.toContain("+15557654321");
    expect(serialized).not.toContain("ws-live-004");
    expect(serialized).toContain("contact <redacted:account_identifier>");
    expect(serialized).toContain("account <redacted:account_identifier>");
    expect(serialized).toContain("user id <redacted:account_identifier>");
    expect(serialized).toContain("uid <redacted:account_identifier>");
    expect(serialized).toContain("workspace <redacted:account_identifier>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.publish_result_identity.success_signal.signal_locator",
          sensitivity: "sensitive",
          locator_kind: "public_locator",
          replacement: "<redacted:account_identifier>"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "sensitive",
          locator_kind: "public_locator",
          replacement: "<redacted:account_identifier>"
        })
      ])
    );
  });

  it("evaluates against redacted live-write evidence without exposing sensitive refs", () => {
    const input = baseInput();
    input.publish_result_identity = {
      ...basePublishIdentity(),
      profile_ref: "/Users/example/Library/Application Support/WebEnvoy/Profiles/xhs-private",
      published_url:
        "https://www.xiaohongshu.com/explore/fr0032-test-note?xsec_token=live-token-001"
    };
    input.cleanup_result = baseCleanup(input.publish_result_identity);

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedFindings = JSON.stringify(evaluation.redaction_findings);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true
    });
    expect(serializedFindings).not.toContain("/Users/example");
    expect(serializedFindings).not.toContain("live-token-001");
    expect(serializedFindings).toContain("profile-ref:redacted:");
    expect(serializedFindings).toContain("<redacted:token>");
  });

  it("evaluates free-text account identifiers through default redaction without leaking raw values", () => {
    const input = baseInput();
    input.publish_result_identity = {
      ...basePublishIdentity(),
      success_signal: {
        ...basePublishIdentity().success_signal,
        signal_locator: "contact +15551234567 for account xhs-raw-001"
      }
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/free-text-account",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "user id user-live-002"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("+15551234567");
    expect(serializedEvaluation).not.toContain("xhs-raw-001");
    expect(serializedEvaluation).not.toContain("user-live-002");
    expect(serializedEvaluation).toContain("<redacted:account_identifier>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("redacts spaced account identifier key-value forms by default", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "account_id = xhs-raw-001 username = creator-42"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/spaced-account-kv",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "tenant_id = tenant-007 workspace_id = ws-raw-008"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(2);
    expect(serialized).not.toContain("xhs-raw-001");
    expect(serialized).not.toContain("creator-42");
    expect(serialized).not.toContain("tenant-007");
    expect(serialized).not.toContain("ws-raw-008");
    expect(serialized).toContain("<redacted:account_identifier>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "sensitive",
          locator_kind: "public_locator",
          replacement: "<redacted:account_identifier>"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "sensitive",
          locator_kind: "public_locator",
          replacement: "<redacted:account_identifier>"
        })
      ])
    );
  });

  it("evaluates spaced account identifier key-value forms without leaking raw values", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "account_id = xhs-raw-001"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/spaced-account-kv",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "username = creator-42 tenant_id = tenant-007"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("xhs-raw-001");
    expect(serializedEvaluation).not.toContain("creator-42");
    expect(serializedEvaluation).not.toContain("tenant-007");
    expect(serializedEvaluation).toContain("<redacted:account_identifier>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("redacts hyphenated account identifier key-value forms by default", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "account-id=xhs-raw-001 user-id = user-123"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/hyphenated-account-kv",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "tenant-id=tenant-007 workspace-id = ws-raw-008"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(serialized).not.toContain("xhs-raw-001");
    expect(serialized).not.toContain("user-123");
    expect(serialized).not.toContain("tenant-007");
    expect(serialized).not.toContain("ws-raw-008");
    expect(serialized).toContain("<redacted:account_identifier>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "sensitive",
          locator_kind: "public_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "sensitive",
          locator_kind: "public_locator"
        })
      ])
    );
  });

  it("evaluates hyphenated account identifier key-value forms without leaking raw values", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "account-id=xhs-raw-001"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/hyphenated-account-kv",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "user-id=user-123 tenant-id = tenant-007"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("xhs-raw-001");
    expect(serializedEvaluation).not.toContain("user-123");
    expect(serializedEvaluation).not.toContain("tenant-007");
    expect(serializedEvaluation).toContain("<redacted:account_identifier>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("redacts file URI private paths and URL-encoded private paths", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "file:///Users/example/Pictures/private-live-write-seed.png"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "file:///home/example/webenvoy/artifacts/live-write/proof.json"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/encoded-path",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "artifact_ref=file:%2FUsers%2Fexample%2FLibrary%2FLogs%2Fwebenvoy.log"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted).toMatchObject({
      redaction_state: "redacted"
    });
    expect(serialized).not.toContain("file:///Users/example");
    expect(serialized).not.toContain("file:///home/example");
    expect(serialized).not.toContain("%2FUsers%2Fexample");
    expect(serialized).not.toContain("private-live-write-seed.png");
    expect(serialized).not.toContain("proof.json");
    expect(serialized).not.toContain("webenvoy.log");
    expect(serialized).toContain("<redacted:path:source_media>");
    expect(serialized).toContain("<redacted:path:private>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.upload_artifact_identity.source_media_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.proof_locator",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        })
      ])
    );
  });

  it("evaluates file URI private path evidence through default redaction", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "file:///Users/example/Pictures/private-live-write-seed.png"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "file:///home/example/webenvoy/artifacts/live-write/proof.json"
    };

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedFindings = JSON.stringify(evaluation.redaction_findings);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedFindings).not.toContain("file:///Users/example");
    expect(serializedFindings).not.toContain("file:///home/example");
    expect(serializedFindings).toContain("<redacted:path:source_media>");
    expect(serializedFindings).toContain("<redacted:path:private>");
  });

  it("redacts Windows forward-slash private paths and file URI forms", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "C:/Users/alice/Pictures/Private Album/seed image.png"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "file:///C:/Users/alice/AppData/Local/WebEnvoy/proof file.json"
    };

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(serialized).not.toContain("C:/Users/alice");
    expect(serialized).not.toContain("file:///C:/Users/alice");
    expect(serialized).not.toContain("Private Album");
    expect(serialized).not.toContain("proof file.json");
    expect(serialized).toContain("<redacted:path:source_media>");
    expect(serialized).toContain("<redacted:path:private>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.upload_artifact_identity.source_media_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.proof_locator",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        })
      ])
    );
  });

  it("evaluates Windows forward-slash private paths without leaking raw values", () => {
    const input = baseInput();
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "file:///C:/Users/alice/AppData/Local/WebEnvoy/proof file.json"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/windows-forward-slash",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "artifact_ref=C:/Users/alice/Library/WebEnvoy/private proof.json"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("C:/Users/alice");
    expect(serializedEvaluation).not.toContain("file:///C:/Users/alice");
    expect(serializedEvaluation).not.toContain("proof file.json");
    expect(serializedEvaluation).not.toContain("private proof.json");
    expect(serializedEvaluation).toContain("<redacted:path:private>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("redacts runtime temp and privileged home private paths", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "/private/tmp/webenvoy/artifact secret.png"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "/tmp/webenvoy/proof artifact.json"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/runtime-private-path",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "/root/.config/webenvoy/profile"
      },
      {
        risk_signal_id: "risk/fr-0032/run-846/encoded-runtime-private-path",
        detected_at: "2026-05-28T00:02:13.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "artifact_ref=%2fprivate%2ftmp%2fwebenvoy%2fencoded%20artifact.png"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(serialized).not.toContain("/private/tmp");
    expect(serialized).not.toContain("/tmp/webenvoy");
    expect(serialized).not.toContain("/root/.config");
    expect(serialized).not.toContain("artifact secret.png");
    expect(serialized).not.toContain("proof artifact.json");
    expect(serialized).not.toContain("webenvoy/profile");
    expect(serialized).not.toContain("%2fprivate%2ftmp");
    expect(serialized).not.toContain("encoded%20artifact.png");
    expect(serialized).toContain("<redacted:path:source_media>");
    expect(serialized).toContain("<redacted:path:private>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.upload_artifact_identity.source_media_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.proof_locator",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.1.details_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        })
      ])
    );
  });

  it("evaluates runtime temp and root private paths without leaking raw values", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "/private/tmp/webenvoy/artifact secret.png"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "/tmp/webenvoy/proof artifact.json"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/root-private-path",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "/root/.config/webenvoy/profile"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("/private/tmp");
    expect(serializedEvaluation).not.toContain("/tmp/webenvoy");
    expect(serializedEvaluation).not.toContain("/root/.config");
    expect(serializedEvaluation).not.toContain("artifact secret.png");
    expect(serializedEvaluation).not.toContain("proof artifact.json");
    expect(serializedEvaluation).toContain("<redacted:path:source_media>");
    expect(serializedEvaluation).toContain("<redacted:path:private>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("fully redacts private and source media paths that contain spaces", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "/Users/alice/Pictures/Private Album/seed image.png"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "/Users/alice/Library/Application Support/WebEnvoy/proof file.json"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/encoded-spaced-path",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref:
          "artifact_ref=file:%2FUsers%2Falice%2FLibrary%2FApplication%20Support%2FWebEnvoy%2Fproof%20file.json"
      },
      {
        risk_signal_id: "risk/fr-0032/run-846/windows-spaced-path",
        detected_at: "2026-05-28T00:02:13.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "C:\\Users\\alice\\Pictures\\Private Album\\seed image.png"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(serialized).not.toContain("/Users/alice");
    expect(serialized).not.toContain("Application Support");
    expect(serialized).not.toContain("Support/WebEnvoy");
    expect(serialized).not.toContain("proof file.json");
    expect(serialized).not.toContain("Private Album");
    expect(serialized).not.toContain("seed image.png");
    expect(serialized).not.toContain("Application%20Support");
    expect(serialized).not.toContain("proof%20file.json");
    expect(serialized).not.toContain("C:\\Users\\alice");
    expect(serialized).toContain("<redacted:path:source_media>");
    expect(serialized).toContain("<redacted:path:private>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.upload_artifact_identity.source_media_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator",
          replacement: "<redacted:path:source_media>"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.proof_locator",
          sensitivity: "sensitive",
          locator_kind: "private_locator",
          replacement: "<redacted:path:private>"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator",
          replacement: "<redacted:path:private>"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.1.details_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator",
          replacement: "<redacted:path:private>"
        })
      ])
    );
  });

  it("evaluates spaced private paths through default redaction without leaking suffixes", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "/Users/alice/Pictures/Private Album/seed image.png"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "/Users/alice/Library/Application Support/WebEnvoy/proof file.json"
    };

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedFindings = JSON.stringify(evaluation.redaction_findings);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedFindings).not.toContain("Application Support");
    expect(serializedFindings).not.toContain("Support/WebEnvoy");
    expect(serializedFindings).not.toContain("proof file.json");
    expect(serializedFindings).not.toContain("Private Album");
    expect(serializedFindings).not.toContain("seed image.png");
    expect(serializedFindings).toContain("<redacted:path:source_media>");
    expect(serializedFindings).toContain("<redacted:path:private>");
  });

  it("redacts sensitive content hidden inside unsafe redacted placeholders", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "<redacted:/Users/example/Pictures/private-live-write-seed.png>"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "<redacted:/home/example/webenvoy/artifacts/live-write/proof.json>"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/disguised-proxy",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "<redacted:proxy://user:password@proxy.example.invalid:8080>"
      },
      {
        risk_signal_id: "risk/fr-0032/run-846/disguised-account",
        detected_at: "2026-05-28T00:02:13.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "<redacted:operator@example.com account_id=xhs-raw-001>"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(4);
    expect(serialized).not.toContain("/Users/example");
    expect(serialized).not.toContain("/home/example");
    expect(serialized).not.toContain("user:password");
    expect(serialized).not.toContain("operator@example.com");
    expect(serialized).not.toContain("xhs-raw-001");
    expect(serialized).toContain("<redacted:path:source_media>");
    expect(serialized).toContain("<redacted:path:private>");
    expect(serialized).toContain("<redacted:proxy_credential>");
    expect(serialized).toContain("<redacted:account_identifier>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.upload_artifact_identity.source_media_ref",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.proof_locator",
          sensitivity: "sensitive",
          locator_kind: "private_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.1.details_ref",
          sensitivity: "sensitive",
          locator_kind: "public_locator"
        })
      ])
    );
  });

  it("evaluates unsafe redacted placeholders through default redaction", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      source_media_ref: "<redacted:/Users/example/Pictures/private-live-write-seed.png>"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/disguised-proxy",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "<redacted:proxy://user:password@proxy.example.invalid:8080>"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedFindings = JSON.stringify(evaluation.redaction_findings);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(evaluation.redacted_field_count).toBeGreaterThanOrEqual(2);
    expect(serializedFindings).not.toContain("/Users/example");
    expect(serializedFindings).not.toContain("user:password");
    expect(serializedFindings).toContain("<redacted:path:source_media>");
    expect(serializedFindings).toContain("<redacted:proxy_credential>");
  });

  it("redacts common auth, cookie and api-key header secrets in free-text evidence", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "Authorization: Bearer live-auth-token-001"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "X-Api-Key: raw-api-key-001",
      platform_message: "Set-Cookie: sessionid=raw-cookie-001; HttpOnly"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/cookie",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "Cookie: xhs_session=raw-cookie-002; a1=raw-cookie-003"
      },
      {
        risk_signal_id: "risk/fr-0032/run-846/api-token",
        detected_at: "2026-05-28T00:02:13.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "API-Token: raw-api-token-001"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(5);
    expect(serialized).not.toContain("live-auth-token-001");
    expect(serialized).not.toContain("raw-api-key-001");
    expect(serialized).not.toContain("raw-cookie-001");
    expect(serialized).not.toContain("raw-cookie-002");
    expect(serialized).not.toContain("raw-cookie-003");
    expect(serialized).not.toContain("raw-api-token-001");
    expect(serialized).toContain("Authorization: Bearer <redacted:token>");
    expect(serialized).toContain("X-Api-Key: <redacted:token>");
    expect(serialized).toContain("Set-Cookie: <redacted:token>");
    expect(serialized).toContain("Cookie: <redacted:token>");
    expect(serialized).toContain("API-Token: <redacted:token>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.proof_locator",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.platform_message",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.1.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        })
      ])
    );
  });

  it("evaluates header secret evidence through default redaction without leaking raw values", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "Authorization: Bearer live-auth-token-001"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/header-secrets",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "Cookie: xhs_session=raw-cookie-002; X-Api-Key: raw-api-key-001"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedFindings = JSON.stringify(evaluation.redaction_findings);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(evaluation.redacted_field_count).toBeGreaterThanOrEqual(2);
    expect(serializedFindings).not.toContain("live-auth-token-001");
    expect(serializedFindings).not.toContain("raw-cookie-002");
    expect(serializedFindings).not.toContain("raw-api-key-001");
    expect(serializedFindings).toContain("<redacted:token>");
  });

  it("redacts JSON quoted header secrets and account identifiers", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message:
        '{"Authorization":"Bearer raw-auth-token-001","X-Api-Key":"raw-api-key-001","Cookie":"a1=raw-cookie-001","account_id":"xhs-raw-001"}'
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/quoted-log",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref:
          "{'Set-Cookie':'session=raw-cookie-002','user-id':'user-123','tenant_id':'tenant-007'}"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(2);
    expect(serialized).not.toContain("raw-auth-token-001");
    expect(serialized).not.toContain("raw-api-key-001");
    expect(serialized).not.toContain("raw-cookie-001");
    expect(serialized).not.toContain("raw-cookie-002");
    expect(serialized).not.toContain("xhs-raw-001");
    expect(serialized).not.toContain("user-123");
    expect(serialized).not.toContain("tenant-007");
    expect(serialized).toContain('\\"Authorization\\":\\"Bearer <redacted:token>\\"');
    expect(serialized).toContain('\\"X-Api-Key\\":\\"<redacted:token>\\"');
    expect(serialized).toContain('\\"Cookie\\":\\"<redacted:token>\\"');
    expect(serialized).toContain('\\"account_id\\":\\"<redacted:account_identifier>\\"');
    expect(serialized).toContain("'Set-Cookie':'<redacted:token>'");
    expect(serialized).toContain("'user-id':'<redacted:account_identifier>'");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "sensitive",
          locator_kind: "public_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "sensitive",
          locator_kind: "public_locator"
        })
      ])
    );
  });

  it("evaluates JSON quoted header and account evidence without leaking raw values", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message:
        '{"Authorization":"Bearer raw-auth-token-001","X-Api-Key":"raw-api-key-001","Cookie":"a1=raw-cookie-001","account_id":"xhs-raw-001"}'
    };

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("raw-auth-token-001");
    expect(serializedEvaluation).not.toContain("raw-api-key-001");
    expect(serializedEvaluation).not.toContain("raw-cookie-001");
    expect(serializedEvaluation).not.toContain("xhs-raw-001");
    expect(serializedEvaluation).toContain("<redacted:token>");
    expect(serializedEvaluation).toContain("<redacted:account_identifier>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("redacts JSON quoted generic secrets and unquoted account identifiers", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message:
        '{"token":"raw-token-001","access_token":"raw-access-001","secret":"raw-secret-001","password":"raw-password-001","api_key":123,"account_id":456,"user_id":789}'
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/quoted-generic-secret",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref:
          '{"x-amz-signature":"rawsig","OSSAccessKeyId":"rawosskey","tenant_id":123,"workspace-id":456}'
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(2);
    expect(serialized).not.toContain("raw-token-001");
    expect(serialized).not.toContain("raw-access-001");
    expect(serialized).not.toContain("raw-secret-001");
    expect(serialized).not.toContain("raw-password-001");
    expect(serialized).not.toContain("rawsig");
    expect(serialized).not.toContain("rawosskey");
    expect(serialized).not.toContain("456");
    expect(serialized).not.toContain("789");
    expect(serialized).toContain('\\"token\\":\\"<redacted:token>\\"');
    expect(serialized).toContain('\\"access_token\\":\\"<redacted:token>\\"');
    expect(serialized).toContain('\\"secret\\":\\"<redacted:token>\\"');
    expect(serialized).toContain('\\"password\\":\\"<redacted:token>\\"');
    expect(serialized).toContain('\\"api_key\\":<redacted:token>');
    expect(serialized).toContain('\\"account_id\\":<redacted:account_identifier>');
    expect(serialized).toContain('\\"tenant_id\\":<redacted:account_identifier>');
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "sensitive",
          locator_kind: "public_locator"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "sensitive",
          locator_kind: "public_locator"
        })
      ])
    );
  });

  it("redacts percent-encoded secret query keys", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      platform_staging_ref:
        "https://bucket.example/upload?xsec%5Ftoken=raw-xsec&access%5Ftoken=raw-access&api%5Fkey=raw-api"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator:
        "https://cdn.example/proof?x-amz%2Dsignature=rawsig&x-amz%2Dcredential=rawcred&x-amz%2Dsecurity%2Dtoken=rawsecurity"
    };

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(serialized).not.toContain("raw-xsec");
    expect(serialized).not.toContain("raw-access");
    expect(serialized).not.toContain("raw-api");
    expect(serialized).not.toContain("rawsig");
    expect(serialized).not.toContain("rawcred");
    expect(serialized).not.toContain("rawsecurity");
    expect(serialized).toContain("xsec%5Ftoken=<redacted:token>");
    expect(serialized).toContain("access%5Ftoken=<redacted:token>");
    expect(serialized).toContain("api%5Fkey=<redacted:token>");
    expect(serialized).toContain("x-amz%2Dsignature=<redacted:token>");
    expect(serialized).toContain("x-amz%2Dcredential=<redacted:token>");
    expect(serialized).toContain("x-amz%2Dsecurity%2Dtoken=<redacted:token>");
  });

  it("redacts OAuth and OIDC secret-bearing query keys", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      platform_staging_ref:
        "https://oauth.example/callback?client_secret=raw-client-secret&id_token=raw-id-token&client_assertion=raw-client-assertion"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator:
        "https://oauth.example/callback?client%5Fsecret=raw-encoded-client-secret&id%5Ftoken=raw-encoded-id-token&client%5Fassertion=raw-encoded-client-assertion"
    };

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(serialized).not.toContain("raw-client-secret");
    expect(serialized).not.toContain("raw-id-token");
    expect(serialized).not.toContain("raw-client-assertion");
    expect(serialized).not.toContain("raw-encoded-client-secret");
    expect(serialized).not.toContain("raw-encoded-id-token");
    expect(serialized).not.toContain("raw-encoded-client-assertion");
    expect(serialized).toContain("client_secret=<redacted:token>");
    expect(serialized).toContain("id_token=<redacted:token>");
    expect(serialized).toContain("client_assertion=<redacted:token>");
    expect(serialized).toContain("client%5Fsecret=<redacted:token>");
    expect(serialized).toContain("id%5Ftoken=<redacted:token>");
    expect(serialized).toContain("client%5Fassertion=<redacted:token>");
  });

  it("evaluates quoted generic secrets and encoded query keys without leaking raw values", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      platform_staging_ref:
        "https://bucket.example/upload?xsec%5Ftoken=raw-xsec&access%5Ftoken=raw-access"
    };
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: '{"token":"raw-token-001","account_id":456,"tenant_id":789}'
    };

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("raw-xsec");
    expect(serializedEvaluation).not.toContain("raw-access");
    expect(serializedEvaluation).not.toContain("raw-token-001");
    expect(serializedEvaluation).not.toContain("456");
    expect(serializedEvaluation).not.toContain("789");
    expect(serializedEvaluation).toContain("<redacted:token>");
    expect(serializedEvaluation).toContain("<redacted:account_identifier>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("evaluates OAuth and OIDC query secrets without leaking raw values", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      platform_staging_ref:
        "https://oauth.example/callback?client_secret=raw-client-secret&id_token=raw-id-token"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/oauth-query-secret",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref:
          "https://oauth.example/callback?client%5Fsecret=raw-encoded-client-secret&id%5Ftoken=raw-encoded-id-token"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("raw-client-secret");
    expect(serializedEvaluation).not.toContain("raw-id-token");
    expect(serializedEvaluation).not.toContain("raw-encoded-client-secret");
    expect(serializedEvaluation).not.toContain("raw-encoded-id-token");
    expect(serializedEvaluation).toContain("<redacted:token>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("redacts free-text token and api-key key-value secrets", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "token=raw-token-001 access_token = raw-access-token-001"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator: "api_key=raw-api-key-001 API Key: raw-spaced-api-key-001"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/token-kv",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "Auth_Token=raw-auth-token-001 token=<redacted:token>"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(3);
    expect(serialized).not.toContain("raw-token-001");
    expect(serialized).not.toContain("raw-access-token-001");
    expect(serialized).not.toContain("raw-api-key-001");
    expect(serialized).not.toContain("raw-spaced-api-key-001");
    expect(serialized).not.toContain("raw-auth-token-001");
    expect(serialized).toContain("token=<redacted:token>");
    expect(serialized).toContain("access_token = <redacted:token>");
    expect(serialized).toContain("api_key=<redacted:token>");
    expect(serialized).toContain("API Key: <redacted:token>");
    expect(serialized).toContain("Auth_Token=<redacted:token>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.proof_locator",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        })
      ])
    );
  });

  it("redacts signed upload and staging URL credential query parameters", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      platform_staging_ref:
        "https://bucket.example/upload?X-Amz-Signature=rawsig&amp;X-Amz-Credential=rawcred&amp;OSSAccessKeyId=rawkey"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator:
        "https://cdn.example/proof?Signature=rawsignature&X-Amz-Security-Token=rawsecurity"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/signed-url",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "https://oss.example/upload?AWSAccessKeyId=rawawskey&signature=rawlowercase"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(3);
    expect(serialized).not.toContain("rawsig");
    expect(serialized).not.toContain("rawcred");
    expect(serialized).not.toContain("rawkey");
    expect(serialized).not.toContain("rawsignature");
    expect(serialized).not.toContain("rawsecurity");
    expect(serialized).not.toContain("rawawskey");
    expect(serialized).not.toContain("rawlowercase");
    expect(serialized).toContain("X-Amz-Signature=<redacted:token>");
    expect(serialized).toContain("&amp;X-Amz-Credential=<redacted:token>");
    expect(serialized).toContain("&amp;OSSAccessKeyId=<redacted:token>");
    expect(serialized).toContain("Signature=<redacted:token>");
    expect(serialized).toContain("X-Amz-Security-Token=<redacted:token>");
    expect(serialized).toContain("AWSAccessKeyId=<redacted:token>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.upload_artifact_identity.platform_staging_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.proof_locator",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        })
      ])
    );
  });

  it("evaluates signed upload URL query credentials through default redaction", () => {
    const input = baseInput();
    input.upload_artifact_identity = {
      ...input.upload_artifact_identity!,
      platform_staging_ref:
        "https://bucket.example/upload?X-Amz-Signature=rawsig&amp;X-Amz-Credential=rawcred&amp;OSSAccessKeyId=rawkey"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/signed-url",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "https://cdn.example/proof?Signature=rawsignature&X-Amz-Security-Token=rawsecurity"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(evaluation.redacted_field_count).toBeGreaterThanOrEqual(2);
    expect(serializedEvaluation).not.toContain("rawsig");
    expect(serializedEvaluation).not.toContain("rawcred");
    expect(serializedEvaluation).not.toContain("rawkey");
    expect(serializedEvaluation).not.toContain("rawsignature");
    expect(serializedEvaluation).not.toContain("rawsecurity");
    expect(serializedEvaluation).toContain("<redacted:token>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("redacts raw secret suffixes appended to redacted token placeholders", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message:
        "token=<redacted:token> raw-token-001 access_token=<redacted:token>raw-access-suffix Authorization: Bearer <redacted:token> raw-auth-token-001"
    };
    input.cleanup_result = {
      ...baseCleanup(input.publish_result_identity),
      proof_locator:
        "api_key=<redacted:token>raw-api-suffix X-Api-Key: <redacted:token>raw-header-suffix"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/token-suffix",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref:
          "Set-Cookie: <redacted:token>raw-cookie-suffix; Cookie: <redacted:token>; session=raw-cookie-001"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(redacted.redacted_field_count).toBeGreaterThanOrEqual(3);
    expect(serialized).not.toContain("raw-token-001");
    expect(serialized).not.toContain("raw-access-suffix");
    expect(serialized).not.toContain("raw-auth-token-001");
    expect(serialized).not.toContain("raw-api-suffix");
    expect(serialized).not.toContain("raw-header-suffix");
    expect(serialized).not.toContain("raw-cookie-suffix");
    expect(serialized).not.toContain("raw-cookie-001");
    expect(serialized).toContain("token=<redacted:token>");
    expect(serialized).toContain("access_token=<redacted:token>");
    expect(serialized).toContain("Authorization: Bearer <redacted:token>");
    expect(serialized).toContain("api_key=<redacted:token>");
    expect(serialized).toContain("X-Api-Key: <redacted:token>");
    expect(serialized).toContain("Set-Cookie: <redacted:token>");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.cleanup_result.proof_locator",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        }),
        expect.objectContaining({
          path: "live_write_evidence.risk_signals.0.details_ref",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        })
      ])
    );
  });

  it("allows ordinary log fields after redacted authorization headers", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "Authorization: Bearer raw-auth-token-001 status=200 method=POST ok=true"
    };

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serializedRedacted = JSON.stringify(redacted.evidence);
    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedEvaluation = JSON.stringify(evaluation);

    expect(redacted.redaction_state).toBe("redacted");
    expect(serializedRedacted).not.toContain("raw-auth-token-001");
    expect(serializedRedacted).toContain("Authorization: Bearer <redacted:token>");
    expect(serializedRedacted).toContain("status=200");
    expect(serializedRedacted).toContain("method=POST");
    expect(serializedRedacted).toContain("ok=true");
    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedEvaluation).not.toContain("raw-auth-token-001");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("still redacts attached authorization suffixes before ordinary log fields", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message:
        "Authorization: Bearer <redacted:token>raw-auth-suffix status=200 method=POST"
    };

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(redacted.redaction_state).toBe("redacted");
    expect(serialized).not.toContain("raw-auth-suffix");
    expect(serialized).toContain("Authorization: Bearer <redacted:token> status=200");
    expect(serialized).toContain("method=POST");
    expect(redacted.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "live_write_evidence.submit_evidence.platform_message",
          sensitivity: "secret",
          locator_kind: "secret_handle"
        })
      ])
    );
  });

  it("keeps legitimate redacted token placeholders safe at value boundaries", () => {
    const input = baseInput();
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/redacted-token-boundaries",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref:
          "token=<redacted:token> access_token=<redacted:token> api_key=<redacted:token>; Authorization: Bearer <redacted:token> X-Api-Key: <redacted:token>; Set-Cookie: <redacted:token>; HttpOnly"
      }
    ];

    const redacted = redactFr0032LiveWriteEvidence(input);
    const serialized = JSON.stringify(redacted.evidence);

    expect(serialized).toContain("token=<redacted:token>");
    expect(serialized).toContain("access_token=<redacted:token> api_key=<redacted:token>");
    expect(serialized).toContain("Authorization: Bearer <redacted:token>");
    expect(serialized).toContain("X-Api-Key: <redacted:token>");
    expect(serialized).toContain("Set-Cookie: <redacted:token>; HttpOnly");
    expect(redacted.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "live_write_evidence.risk_signals.0.details_ref" })
      ])
    );
  });

  it("evaluates free-text token key-value secrets through default redaction", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message: "token=raw-token-001"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/token-kv",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref: "access_token=raw-access-token-001 api_key=raw-api-key-001 token=<redacted:token>"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedFindings = JSON.stringify(evaluation.redaction_findings);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(evaluation.redacted_field_count).toBeGreaterThanOrEqual(2);
    expect(serializedFindings).not.toContain("raw-token-001");
    expect(serializedFindings).not.toContain("raw-access-token-001");
    expect(serializedFindings).not.toContain("raw-api-key-001");
    expect(serializedFindings).toContain("<redacted:token>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("evaluates redacted token placeholders with raw suffixes through default redaction", () => {
    const input = baseInput();
    input.submit_evidence = {
      ...input.submit_evidence!,
      platform_message:
        "token=<redacted:token> raw-token-001 Authorization: Bearer <redacted:token> raw-auth-token-001"
    };
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/run-846/token-suffix",
        detected_at: "2026-05-28T00:02:12.000Z",
        source: "runtime.audit",
        kind: "browser_env_abnormal",
        severity: "warning",
        details_ref:
          "access_token=<redacted:token>raw-access-suffix api_key=<redacted:token>raw-api-suffix Cookie: <redacted:token>; session=raw-cookie-001"
      }
    ];

    const evaluation = evaluateFr0032LiveWriteEvidence(input);
    const serializedFindings = JSON.stringify(evaluation.redaction_findings);

    expect(evaluation).toMatchObject({
      decision: "PASS",
      redaction_state: "redacted",
      full_live_write_success: true,
      blockers: []
    });
    expect(serializedFindings).not.toContain("raw-token-001");
    expect(serializedFindings).not.toContain("raw-auth-token-001");
    expect(serializedFindings).not.toContain("raw-access-suffix");
    expect(serializedFindings).not.toContain("raw-api-suffix");
    expect(serializedFindings).not.toContain("raw-cookie-001");
    expect(serializedFindings).toContain("<redacted:token>");
    expect(evaluation.blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "REDACTION_INVALID" })])
    );
  });

  it("passes a full upload, submit, publish, evidence and cleanup success candidate", () => {
    expect(evaluateFr0032LiveWriteEvidence(baseInput())).toMatchObject({
      decision: "PASS",
      derived_attempt_state: "closed",
      submit_gate_open: true,
      publish_gate_open: true,
      cleanup_gate_open: true,
      upload_success: true,
      submit_success: true,
      publish_success: true,
      cleanup_satisfied: true,
      cleanup_success: true,
      success_with_residual: false,
      full_live_write_success: true,
      later_write_actions_blocked: false,
      cleanup_required: true,
      cleanup_result_id: "cleanup/fr-0032/run-846/cleanup-001",
      residual_record_id: null,
      residual_record_required: false,
      risk_signal_present: false,
      blocking_risk_signal_count: 0,
      stop_signal_id: null,
      stop_signal_present: false,
      stop_signal_required: false,
      stop_signal_satisfied: true,
      redaction_state: "redacted",
      redacted_field_count: 3,
      blockers: []
    });
  });
});
