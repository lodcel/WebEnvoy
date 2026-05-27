import { describe, expect, it } from "vitest";

import {
  evaluateFr0032LiveWriteEvidence,
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
      residual_record_required: false,
      full_live_write_success: false,
      blockers: []
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
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "RISK_SIGNAL_BLOCKING" })
      ])
    });
    expect(evaluateFr0032LiveWriteEvidence(input).blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ blocker_code: "STOP_SIGNAL_REQUIRED" })])
    );
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
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "SUBMIT_NOT_ACCEPTED" }),
        expect.objectContaining({ blocker_code: "SUBMIT_BLOCKED_BY_RISK" })
      ])
    });
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
      residual_record_required: false,
      blockers: []
    });
  });
});
