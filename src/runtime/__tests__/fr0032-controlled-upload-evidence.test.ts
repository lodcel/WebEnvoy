import { describe, expect, it } from "vitest";

import {
  evaluateFr0032ControlledUploadEvidence,
  type EvaluateFr0032ControlledUploadInput
} from "../fr0032-controlled-upload-evidence.js";

const baseInput = (): EvaluateFr0032ControlledUploadInput => ({
  entry_gate: {
    spec_review_state: "passed",
    latest_head_sha: "f0a6aec32e7f5731886e82740df772b88820ea4c",
    readmission_decision: "GO",
    runtime_readiness: "ready",
    identity_binding_state: "bound",
    target_binding_state: "verified",
    account_safety_state: "clear",
    validation_rows_state: "ready_verified_no_drift",
    publish_visibility_scope: "private_or_self_visible",
    cleanup_policy_ref: "cleanup-policy/fr-0032/non-publish-upload-v1"
  },
  upload_artifact_identity: {
    upload_artifact_id: "upload-artifact/fr-0032/run-845-upload-001/source-digest-a",
    source_media_ref: "media-ref/fr-0032/fixture-image-a",
    source_media_digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    source_media_kind: "image",
    platform_staging_ref: "staging/editor-preview/0",
    page_preview_locator: "input[type=file] -> preview[0]",
    accepted_by_platform: true,
    visible_in_editor: true,
    captured_at: "2026-05-28T00:00:00.000Z"
  },
  risk_signals: [],
  submit_attempted: false,
  publish_attempted: false
});

describe("FR-0032 controlled upload evidence evaluator", () => {
  it("passes upload-only non-publish validation without claiming full live write success", () => {
    expect(evaluateFr0032ControlledUploadEvidence(baseInput())).toMatchObject({
      decision: "PASS",
      upload_success: true,
      full_live_write_success: false,
      non_publish_validation: true,
      later_write_actions_blocked: false,
      cleanup_required: false,
      blockers: []
    });
  });

  it("returns NO_GO when the entry gate is missing or stale", () => {
    const input = baseInput();
    input.entry_gate.readmission_decision = "STALE";

    expect(evaluateFr0032ControlledUploadEvidence(input)).toMatchObject({
      decision: "NO_GO",
      upload_success: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "ENTRY_GATE_NOT_GO" })
      ])
    });
  });

  it("does not treat page state as upload success without upload artifact identity", () => {
    const input = baseInput();
    input.upload_artifact_identity = null;

    expect(evaluateFr0032ControlledUploadEvidence(input)).toMatchObject({
      decision: "NO_GO",
      upload_success: false,
      full_live_write_success: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "UPLOAD_ARTIFACT_IDENTITY_MISSING" })
      ])
    });
  });

  it("keeps upload-only evidence from becoming a submit or publish success", () => {
    const input = baseInput();
    input.submit_attempted = true;
    input.publish_attempted = true;

    expect(evaluateFr0032ControlledUploadEvidence(input)).toMatchObject({
      decision: "NO_GO",
      upload_success: false,
      full_live_write_success: false,
      later_write_actions_blocked: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "SUBMIT_NOT_RUN" }),
        expect.objectContaining({ blocker_code: "PUBLISH_NOT_RUN" })
      ])
    });
  });

  it("stops later write actions and requires cleanup handling after account safety risk", () => {
    const input = baseInput();
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/upload/account-safety",
        detected_at: "2026-05-28T00:00:01.000Z",
        source: "upload",
        kind: "account_safety",
        severity: "blocking",
        details_ref: "artifact/fr-0032/upload-risk/account-safety"
      }
    ];

    expect(evaluateFr0032ControlledUploadEvidence(input)).toMatchObject({
      decision: "NO_GO",
      upload_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "ACCOUNT_SAFETY_SIGNAL" })
      ])
    });
  });

  it("keeps later write actions blocked when a blocking risk signal exists even if submit was attempted", () => {
    const input = baseInput();
    input.submit_attempted = true;
    input.risk_signals = [
      {
        risk_signal_id: "risk/fr-0032/upload/captcha",
        detected_at: "2026-05-28T00:00:02.000Z",
        source: "page_observation",
        kind: "captcha_required",
        severity: "blocking",
        details_ref: "artifact/fr-0032/upload-risk/captcha"
      }
    ];

    expect(evaluateFr0032ControlledUploadEvidence(input)).toMatchObject({
      decision: "NO_GO",
      upload_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "SUBMIT_NOT_RUN" }),
        expect.objectContaining({ blocker_code: "RISK_SIGNAL_BLOCKING" })
      ])
    });
  });
});
