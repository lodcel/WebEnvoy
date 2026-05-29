import type { JsonRecord } from "./xhs-search-types.js";
import type { MediaUploadDiscoveryResult } from "./xhs-media-upload-discovery.js";

export type XhsControlledLiveWriteInput = {
  live_write_attempt_id: string;
  source_media_ref: string;
  source_media_digest: string;
  source_media_kind: "image" | "video" | "mixed";
  publish_visibility_scope: "private_or_self_visible" | "limited_test_visibility" | "public_visible";
  cleanup_policy_ref: string;
  run_id: string;
  profile_ref: string | null;
  target_tab_id: number | null;
  page_url: string;
  latest_head_sha?: string | null;
};

export type XhsControlledLiveWriteResult = {
  live_write_action: "controlled_upload_submit_publish";
  target_page: "creator_publish_tab";
  live_write_evidence: JsonRecord;
  live_write_evaluation: JsonRecord;
  uploaded: boolean;
  submitted: boolean;
  published: boolean;
  cleanup_attempted: boolean;
  out_of_scope_actions: string[];
};

type UploadBlockedInput = {
  blockerCode: string;
  blockerMessage: string;
  detailsRef: string;
  requiredRecoveryAction: string;
};

const nowIso = (): string => new Date().toISOString();

const sourceMediaKind = (value: string): "image" | "video" | "mixed" =>
  value === "video" || value === "mixed" ? value : "image";

export const buildXhsControlledLiveWriteUnavailableResult = (
  input: XhsControlledLiveWriteInput
): XhsControlledLiveWriteResult => {
  const timestamp = nowIso();
  const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
  const stopSignalId = `stop/fr-0032/${input.live_write_attempt_id}/executor-unavailable`;
  const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
  const stopSignal = {
    schema_version: "fr-0032.live_write_stop_signal.v1",
    stop_signal_id: stopSignalId,
    live_write_attempt_id: input.live_write_attempt_id,
    run_id: input.run_id,
    profile_ref: input.profile_ref ?? "unknown",
    target_tab_id: input.target_tab_id ?? 0,
    stopped_at: timestamp,
    stopped_step: "upload",
    blocker_layer: "upload",
    blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
    severity: "blocking",
    later_write_actions_blocked: true,
    cleanup_required: false,
    cleanup_result_id: null,
    residual_record_id: null,
    required_recovery_action: "provide a page executor that can safely perform controlled media upload before submit/publish",
    evidence_ref: evidenceRef
  };
  const liveWriteEvidence = {
    schema_version: "fr-0032.live_write_evidence.v1",
    live_write_attempt_id: input.live_write_attempt_id,
    canonical_issue_ref: "#835",
    execution_phase: "upload",
    scope: {
      platform: "xhs",
      target_domain: "creator.xiaohongshu.com",
      target_page: "creator_publish_tab",
      browser_channel: "Google Chrome stable",
      execution_surface: "real_browser",
      requested_execution_mode: "live_write",
      profile_ref: input.profile_ref ?? "unknown",
      target_tab_id: input.target_tab_id ?? 0,
      probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
      run_id: input.run_id,
      artifact_identity: uploadArtifactId
    },
    entry_gate: null,
    stop_classification: {
      category: "capability_gap",
      evaluation_state: "not_evaluated",
      not_evaluated_reason: "controlled_live_write_executor_unavailable",
      latest_head_sha: input.latest_head_sha ?? null,
      publish_visibility_scope: input.publish_visibility_scope,
      cleanup_policy_ref: input.cleanup_policy_ref
    },
    upload_artifact_identity: {
      upload_artifact_id: uploadArtifactId,
      source_media_ref: input.source_media_ref,
      source_media_digest: input.source_media_digest,
      source_media_kind: sourceMediaKind(input.source_media_kind),
      platform_staging_ref: null,
      page_preview_locator: null,
      accepted_by_platform: false,
      visible_in_editor: false,
      captured_at: timestamp
    },
    submit_evidence: null,
    publish_result_identity: null,
    cleanup_result: null,
    risk_signals: [
      {
        risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/upload-unavailable`,
        detected_at: timestamp,
        source: "upload",
        kind: "upload_failure",
        severity: "blocking",
        details_ref: "controlled_live_write_executor_unavailable"
      }
    ],
    stop_signal: stopSignal,
    residual_record: null,
    created_at: timestamp,
    updated_at: timestamp
  };
  return {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    live_write_evidence: liveWriteEvidence,
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: false,
      submit_success: false,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: false,
      blockers: [
        {
          blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
          blocker_layer: "upload",
          message: "No trusted page executor is available for controlled upload, so submit/publish are blocked."
        }
      ]
    },
    uploaded: false,
    submitted: false,
    published: false,
    cleanup_attempted: false,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
  };
};

export const buildXhsControlledLiveWriteUploadBlockedResult = (
  input: XhsControlledLiveWriteInput,
  reason: UploadBlockedInput
): XhsControlledLiveWriteResult => {
  const timestamp = nowIso();
  const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
  const stopSignalId = `stop/fr-0032/${input.live_write_attempt_id}/upload-blocked`;
  const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
  const stopSignal = {
    schema_version: "fr-0032.live_write_stop_signal.v1",
    stop_signal_id: stopSignalId,
    live_write_attempt_id: input.live_write_attempt_id,
    run_id: input.run_id,
    profile_ref: input.profile_ref ?? "unknown",
    target_tab_id: input.target_tab_id ?? 0,
    stopped_at: timestamp,
    stopped_step: "upload",
    blocker_layer: "upload",
    blocker_code: reason.blockerCode,
    severity: "blocking",
    later_write_actions_blocked: true,
    cleanup_required: false,
    cleanup_result_id: null,
    residual_record_id: null,
    required_recovery_action: reason.requiredRecoveryAction,
    evidence_ref: evidenceRef
  };
  const liveWriteEvidence = {
    schema_version: "fr-0032.live_write_evidence.v1",
    live_write_attempt_id: input.live_write_attempt_id,
    canonical_issue_ref: "#835",
    execution_phase: "upload",
    scope: {
      platform: "xhs",
      target_domain: "creator.xiaohongshu.com",
      target_page: "creator_publish_tab",
      browser_channel: "Google Chrome stable",
      execution_surface: "real_browser",
      requested_execution_mode: "live_write",
      profile_ref: input.profile_ref ?? "unknown",
      target_tab_id: input.target_tab_id ?? 0,
      probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
      run_id: input.run_id,
      artifact_identity: uploadArtifactId
    },
    entry_gate: null,
    stop_classification: {
      category: "upload_blocked",
      evaluation_state: "stopped",
      stop_reason: reason.detailsRef,
      latest_head_sha: input.latest_head_sha ?? null,
      publish_visibility_scope: input.publish_visibility_scope,
      cleanup_policy_ref: input.cleanup_policy_ref
    },
    upload_artifact_identity: {
      upload_artifact_id: uploadArtifactId,
      source_media_ref: input.source_media_ref,
      source_media_digest: input.source_media_digest,
      source_media_kind: sourceMediaKind(input.source_media_kind),
      platform_staging_ref: null,
      page_preview_locator: null,
      accepted_by_platform: false,
      visible_in_editor: false,
      captured_at: timestamp
    },
    submit_evidence: null,
    publish_result_identity: null,
    cleanup_result: null,
    risk_signals: [
      {
        risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/upload-blocked`,
        detected_at: timestamp,
        source: "upload",
        kind: "upload_failure",
        severity: "blocking",
        details_ref: reason.detailsRef
      }
    ],
    stop_signal: stopSignal,
    residual_record: null,
    created_at: timestamp,
    updated_at: timestamp
  };
  return {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    live_write_evidence: liveWriteEvidence,
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: false,
      submit_success: false,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: false,
      blockers: [
        {
          blocker_code: reason.blockerCode,
          blocker_layer: "upload",
          message: reason.blockerMessage
        }
      ]
    },
    uploaded: false,
    submitted: false,
    published: false,
    cleanup_attempted: false,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
  };
};

const buildXhsControlledLiveWriteSubmitBlockedResult = (
  input: XhsControlledLiveWriteInput,
  discovery: MediaUploadDiscoveryResult
): XhsControlledLiveWriteResult => {
  const artifact = discovery.controlled_upload_evidence?.upload_artifact_identity ?? null;
  const result = buildXhsControlledLiveWriteUploadBlockedResult(input, {
    blockerCode: "SUBMIT_EXECUTOR_UNAVAILABLE",
    blockerMessage: "Upload evidence exists, but submit/publish executor is not available.",
    detailsRef: "submit_executor_unavailable",
    requiredRecoveryAction: "provide a submit/publish executor and cleanup policy executor before continuing after upload"
  });
  const evidence = result.live_write_evidence;
  const stopSignal = evidence.stop_signal as JsonRecord;
  return {
    ...result,
    live_write_evidence: {
      ...evidence,
      execution_phase: "submit",
      stop_classification: {
        ...(evidence.stop_classification as JsonRecord),
        category: "submit_blocked",
        stop_reason: "submit_executor_unavailable"
      },
      upload_artifact_identity: artifact,
      risk_signals: [
        {
          risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/submit-unavailable`,
          detected_at: stopSignal.stopped_at,
          source: "submit",
          kind: "submit_failure",
          severity: "blocking",
          details_ref: "submit_executor_unavailable"
        }
      ],
      stop_signal: {
        ...stopSignal,
        stop_signal_id: `stop/fr-0032/${input.live_write_attempt_id}/submit-unavailable`,
        stopped_step: "submit",
        blocker_layer: "submit",
        blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
        cleanup_required: true,
        required_recovery_action: "provide a submit/publish executor and cleanup policy executor before continuing after upload"
      },
      updated_at: stopSignal.stopped_at
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: false,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: [
        {
          blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
          blocker_layer: "submit",
          message: "Upload evidence exists, but submit/publish executor is not available."
        }
      ]
    },
    uploaded: true,
    cleanup_attempted: false
  };
};

export const buildXhsControlledLiveWriteFromDiscovery = (
  input: XhsControlledLiveWriteInput,
  discovery: MediaUploadDiscoveryResult
): XhsControlledLiveWriteResult => {
  if (discovery.controlled_upload_evidence?.upload_artifact_identity?.accepted_by_platform === true) {
    return buildXhsControlledLiveWriteSubmitBlockedResult(input, discovery);
  }
  const artifact = discovery.controlled_upload_evidence?.upload_artifact_identity ?? null;
  if (!artifact) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "UPLOAD_ARTIFACT_MISSING",
      blockerMessage: "Controlled live write cannot continue because no upload artifact identity is available.",
      detailsRef: "upload_artifact_identity_missing",
      requiredRecoveryAction: "provide a source media resolver and upload executor that can produce platform-accepted upload artifact identity"
    });
  }
  return buildXhsControlledLiveWriteUploadBlockedResult(input, {
    blockerCode: "UPLOAD_PLATFORM_REJECTED",
    blockerMessage: "Controlled live write cannot continue because recon evidence did not perform or prove platform upload acceptance.",
    detailsRef: "source_media_resolution_or_upload_acceptance_unavailable",
    requiredRecoveryAction: "provide a controlled media resolver and real upload executor before submit/publish"
  });
};
