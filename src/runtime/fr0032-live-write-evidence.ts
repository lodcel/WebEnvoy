import {
  type Fr0032UploadArtifactIdentity,
  type Fr0032UploadEntryGate
} from "./fr0032-controlled-upload-evidence.js";

export type Fr0032LiveWriteDecision = "PASS" | "NO_GO";
export type Fr0032LiveWriteAttemptState =
  | "initialized"
  | "uploaded"
  | "submitted"
  | "published"
  | "cleanup_started"
  | "closed"
  | "stopped"
  | "failed";
export type Fr0032PublishVisibilityScope =
  | "private_or_self_visible"
  | "limited_test_visibility"
  | "public_visible"
  | "unknown";

export type Fr0032LiveWriteBlockerCode =
  | "ENTRY_GATE_NOT_GO"
  | "UPLOAD_ARTIFACT_MISSING"
  | "UPLOAD_NOT_ACCEPTED"
  | "SUBMIT_EVIDENCE_MISSING"
  | "SUBMIT_NOT_ACCEPTED"
  | "SUBMIT_BLOCKED_BY_RISK"
  | "PUBLISH_RESULT_IDENTITY_MISSING"
  | "PUBLISH_VISIBILITY_UNKNOWN"
  | "PUBLISH_RESULT_NOT_VERIFIED"
  | "CLEANUP_RESULT_MISSING"
  | "RESIDUAL_RECORD_REQUIRED"
  | "RISK_SIGNAL_BLOCKING"
  | "STOP_SIGNAL_REQUIRED";

export type Fr0032LiveWriteStopCode =
  | "SPEC_REVIEW_NOT_PASSED"
  | "READMISSION_GO_STALE"
  | "RUNTIME_NOT_READY"
  | "IDENTITY_BINDING_NOT_BOUND"
  | "TARGET_BINDING_NOT_VERIFIED"
  | "ACCOUNT_SAFETY_NOT_CLEAR"
  | "VALIDATION_ROWS_NOT_READY"
  | "PUBLISH_VISIBILITY_NOT_SELECTED"
  | "UPLOAD_ARTIFACT_MISSING"
  | "UPLOAD_PLATFORM_REJECTED"
  | "SUBMIT_PLATFORM_VALIDATION_ERROR"
  | "PUBLISH_BLOCKED"
  | "PUBLISH_RESULT_IDENTITY_MISSING"
  | "CAPTCHA_REQUIRED"
  | "SECURITY_REDIRECT"
  | "BROWSER_ENV_ABNORMAL"
  | "CLEANUP_FAILED"
  | "RESIDUAL_RECORD_REQUIRED";

export type Fr0032LiveWriteRiskKind =
  | "account_safety"
  | "captcha_required"
  | "login_required"
  | "security_redirect"
  | "browser_env_abnormal"
  | "rate_limit"
  | "content_policy"
  | "upload_failure"
  | "submit_failure"
  | "publish_identity_missing"
  | "cleanup_failure";

export interface Fr0032SubmitEvidence {
  submit_action_ref: string;
  submit_locator: string;
  submitted_at: string;
  submit_result_state:
    | "accepted"
    | "platform_validation_error"
    | "blocked_by_risk"
    | "unknown";
  platform_message: string | null;
}

export interface Fr0032PublishSuccessSignal {
  signal_source:
    | "platform_response"
    | "creator_result_page"
    | "current_page_state"
    | "followup_page_verification";
  signal_locator: string;
  platform_message: string | null;
  observed_at: string;
}

export interface Fr0032PublishResultIdentity {
  schema_version: "fr-0032.publish_result_identity.v1";
  publish_result_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  target_domain: "creator.xiaohongshu.com";
  target_page: "creator_publish_tab";
  source_upload_artifact_id: string;
  submit_action_ref: string;
  result_kind:
    | "note_id"
    | "published_url"
    | "creator_result_page"
    | "platform_publish_record";
  note_id: string | null;
  published_url: string | null;
  creator_result_url: string | null;
  platform_record_ref: string | null;
  publish_visibility_scope: Fr0032PublishVisibilityScope;
  success_signal: Fr0032PublishSuccessSignal;
  captured_at: string;
  verification_state: "verified" | "identity_missing" | "ambiguous" | "blocked";
}

export interface Fr0032ResidualRecord {
  residual_record_id: string;
  live_write_attempt_id: string;
  publish_result_id: string | null;
  visibility_scope: Fr0032PublishVisibilityScope;
  external_visibility_may_remain: boolean;
  residual_locator: string | null;
  reason:
    | "cleanup_failed"
    | "cleanup_blocked"
    | "rollback_not_supported"
    | "unsafe_to_cleanup"
    | "identity_missing_after_publish";
  required_followup: string;
  recorded_at: string;
}

export interface Fr0032CleanupRollbackProof {
  schema_version: "fr-0032.cleanup_rollback_proof.v1";
  cleanup_result_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  publish_result_identity: Fr0032PublishResultIdentity | null;
  cleanup_policy_ref: string;
  cleanup_action:
    | "delete_published_result"
    | "hide_published_result"
    | "remove_draft"
    | "abandon_unpublished_upload"
    | "no_safe_cleanup_action";
  cleanup_outcome:
    | "deleted"
    | "hidden"
    | "draft_removed"
    | "rollback_not_supported"
    | "cleanup_blocked"
    | "cleanup_failed"
    | "not_needed";
  proof_locator: string | null;
  platform_message: string | null;
  attempted_at: string;
  completed_at: string | null;
  residual_record: Fr0032ResidualRecord | null;
}

export interface Fr0032LiveWriteRiskSignal {
  risk_signal_id: string;
  detected_at: string;
  source:
    | "runtime.status"
    | "runtime.audit"
    | "page_observation"
    | "upload"
    | "submit"
    | "publish"
    | "cleanup";
  kind: Fr0032LiveWriteRiskKind;
  severity: "info" | "warning" | "blocking";
  details_ref: string;
}

export interface Fr0032LiveWriteStopSignal {
  schema_version: "fr-0032.live_write_stop_signal.v1";
  stop_signal_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  stopped_at: string;
  stopped_step:
    | "entry_gate"
    | "upload"
    | "submit"
    | "publish"
    | "publish_identity"
    | "cleanup"
    | "closeout";
  blocker_layer:
    | "spec_review"
    | "profile_runtime"
    | "identity_binding"
    | "target_binding"
    | "account_safety"
    | "anti_detection_validation"
    | "upload"
    | "submit"
    | "publish"
    | "published_identity"
    | "cleanup"
    | "risk_policy";
  blocker_code: Fr0032LiveWriteStopCode;
  severity: "warning" | "blocking";
  later_write_actions_blocked: boolean;
  cleanup_required: boolean;
  cleanup_result_id: string | null;
  residual_record_id: string | null;
  required_recovery_action: string;
  evidence_ref: string;
}

export interface EvaluateFr0032LiveWriteEvidenceInput {
  entry_gate: Fr0032UploadEntryGate;
  upload_artifact_identity: Fr0032UploadArtifactIdentity | null;
  submit_evidence: Fr0032SubmitEvidence | null;
  publish_result_identity: Fr0032PublishResultIdentity | null;
  cleanup_result: Fr0032CleanupRollbackProof | null;
  risk_signals?: Fr0032LiveWriteRiskSignal[] | null;
  stop_signal?: Fr0032LiveWriteStopSignal | null;
  residual_record?: Fr0032ResidualRecord | null;
}

export interface Fr0032LiveWriteEvaluation {
  decision: Fr0032LiveWriteDecision;
  derived_attempt_state: Fr0032LiveWriteAttemptState;
  submit_gate_open: boolean;
  publish_gate_open: boolean;
  cleanup_gate_open: boolean;
  upload_success: boolean;
  submit_success: boolean;
  publish_success: boolean;
  cleanup_satisfied: boolean;
  cleanup_success: boolean;
  success_with_residual: boolean;
  full_live_write_success: boolean;
  later_write_actions_blocked: boolean;
  cleanup_required: boolean;
  residual_record_required: boolean;
  blockers: Array<{
    blocker_code: Fr0032LiveWriteBlockerCode;
    message: string;
  }>;
}

const pushBlocker = (
  blockers: Fr0032LiveWriteEvaluation["blockers"],
  blocker_code: Fr0032LiveWriteBlockerCode,
  message: string
): void => {
  if (blockers.some((blocker) => blocker.blocker_code === blocker_code)) {
    return;
  }
  blockers.push({ blocker_code, message });
};

const entryGatePassed = (entryGate: Fr0032UploadEntryGate): boolean =>
  entryGate.spec_review_state === "passed" &&
  entryGate.latest_head_sha !== null &&
  entryGate.readmission_decision === "GO" &&
  entryGate.runtime_readiness === "ready" &&
  entryGate.identity_binding_state === "bound" &&
  entryGate.target_binding_state === "verified" &&
  entryGate.account_safety_state === "clear" &&
  entryGate.validation_rows_state === "ready_verified_no_drift" &&
  entryGate.publish_visibility_scope !== null &&
  entryGate.publish_visibility_scope !== "unknown" &&
  entryGate.cleanup_policy_ref !== null;

const hasStablePublishIdentity = (identity: Fr0032PublishResultIdentity): boolean =>
  identity.note_id !== null ||
  identity.published_url !== null ||
  identity.creator_result_url !== null ||
  identity.platform_record_ref !== null;

const cleanupOutcomeClosesAttempt = (
  cleanupResult: Fr0032CleanupRollbackProof,
  residualRecord: Fr0032ResidualRecord | null
): boolean => {
  if (
    cleanupResult.cleanup_outcome === "deleted" ||
    cleanupResult.cleanup_outcome === "hidden" ||
    cleanupResult.cleanup_outcome === "draft_removed" ||
    cleanupResult.cleanup_outcome === "not_needed"
  ) {
    return true;
  }
  return residualRecord !== null || cleanupResult.residual_record !== null;
};

const cleanupOutcomeSuccessful = (cleanupResult: Fr0032CleanupRollbackProof): boolean =>
  cleanupResult.cleanup_outcome === "deleted" ||
  cleanupResult.cleanup_outcome === "hidden" ||
  cleanupResult.cleanup_outcome === "draft_removed" ||
  cleanupResult.cleanup_outcome === "not_needed";

const deriveAttemptState = (input: {
  uploadSuccess: boolean;
  submitSuccess: boolean;
  publishSuccess: boolean;
  cleanupResult: Fr0032CleanupRollbackProof | null;
  cleanupSatisfied: boolean;
  cleanupSuccess: boolean;
  hasBlockingRisk: boolean;
  residualRecordRequired: boolean;
  blockerCount: number;
}): Fr0032LiveWriteAttemptState => {
  if (input.hasBlockingRisk) {
    return "stopped";
  }
  if (input.residualRecordRequired || input.blockerCount > 0) {
    return "failed";
  }
  if (input.cleanupSatisfied && !input.cleanupSuccess) {
    return "failed";
  }
  if (input.cleanupSuccess) {
    return "closed";
  }
  if (input.cleanupResult !== null) {
    return "cleanup_started";
  }
  if (input.publishSuccess) {
    return "published";
  }
  if (input.submitSuccess) {
    return "submitted";
  }
  if (input.uploadSuccess) {
    return "uploaded";
  }
  return "initialized";
};

export const evaluateFr0032LiveWriteEvidence = (
  input: EvaluateFr0032LiveWriteEvidenceInput
): Fr0032LiveWriteEvaluation => {
  const blockers: Fr0032LiveWriteEvaluation["blockers"] = [];
  const riskSignals = input.risk_signals ?? [];

  if (!entryGatePassed(input.entry_gate)) {
    pushBlocker(blockers, "ENTRY_GATE_NOT_GO", "fresh FR-0032 entry gate GO is required");
  }

  const uploadArtifact = input.upload_artifact_identity;
  if (!uploadArtifact) {
    pushBlocker(blockers, "UPLOAD_ARTIFACT_MISSING", "upload artifact identity is required");
  } else if (!uploadArtifact.accepted_by_platform || !uploadArtifact.visible_in_editor) {
    pushBlocker(
      blockers,
      "UPLOAD_NOT_ACCEPTED",
      "upload artifact must be accepted by the platform and visible in editor"
    );
  }

  const submitEvidence = input.submit_evidence;
  if (!submitEvidence) {
    pushBlocker(blockers, "SUBMIT_EVIDENCE_MISSING", "submit evidence is required");
  } else if (submitEvidence.submit_result_state !== "accepted") {
    pushBlocker(blockers, "SUBMIT_NOT_ACCEPTED", "submit result state must be accepted");
    if (submitEvidence.submit_result_state === "blocked_by_risk") {
      pushBlocker(
        blockers,
        "SUBMIT_BLOCKED_BY_RISK",
        "submit was blocked by risk and later write actions must stop"
      );
    }
  }

  const publishIdentity = input.publish_result_identity;
  if (!publishIdentity || !hasStablePublishIdentity(publishIdentity)) {
    pushBlocker(
      blockers,
      "PUBLISH_RESULT_IDENTITY_MISSING",
      "publish success requires a stable note id, URL, result page or platform record"
    );
  } else {
    if (publishIdentity.publish_visibility_scope === "unknown") {
      pushBlocker(blockers, "PUBLISH_VISIBILITY_UNKNOWN", "publish visibility scope is required");
    }
    if (publishIdentity.verification_state !== "verified") {
      pushBlocker(
        blockers,
        "PUBLISH_RESULT_NOT_VERIFIED",
        "publish result identity must be verified"
      );
    }
  }

  const cleanupResult = input.cleanup_result;
  if (!cleanupResult) {
    pushBlocker(blockers, "CLEANUP_RESULT_MISSING", "cleanup or rollback proof is required");
  }

  const residualRecord = input.residual_record ?? cleanupResult?.residual_record ?? null;
  const cleanupSatisfied =
    cleanupResult !== null && cleanupOutcomeClosesAttempt(cleanupResult, residualRecord);
  const cleanupSuccess = cleanupResult !== null && cleanupOutcomeSuccessful(cleanupResult);
  const residualRecordRequired =
    cleanupResult !== null &&
    !cleanupOutcomeClosesAttempt(cleanupResult, null) &&
    residualRecord === null;
  const successWithResidual =
    cleanupResult !== null && !cleanupOutcomeSuccessful(cleanupResult) && residualRecord !== null;

  if (residualRecordRequired) {
    pushBlocker(
      blockers,
      "RESIDUAL_RECORD_REQUIRED",
      "cleanup failure, blocked cleanup or unsupported rollback requires residual record"
    );
  }

  const hasBlockingRisk = riskSignals.some((riskSignal) => riskSignal.severity === "blocking");
  if (hasBlockingRisk) {
    pushBlocker(blockers, "RISK_SIGNAL_BLOCKING", "blocking risk signal stops live write");
    if (!input.stop_signal || input.stop_signal.severity !== "blocking") {
      pushBlocker(
        blockers,
        "STOP_SIGNAL_REQUIRED",
        "blocking risk signal requires a blocking live write stop signal"
      );
    }
  }

  const uploadSuccess =
    uploadArtifact !== null &&
    uploadArtifact.accepted_by_platform === true &&
    uploadArtifact.visible_in_editor === true;
  const submitSuccess = submitEvidence?.submit_result_state === "accepted";
  const publishSuccess =
    publishIdentity !== null &&
    publishIdentity.verification_state === "verified" &&
    publishIdentity.publish_visibility_scope !== "unknown" &&
    hasStablePublishIdentity(publishIdentity);
  const laterWriteActionsBlocked =
    hasBlockingRisk || submitEvidence?.submit_result_state === "blocked_by_risk";
  const cleanupRequired = uploadSuccess || submitSuccess || publishIdentity !== null || hasBlockingRisk;
  const submitGateOpen = blockers.length === 0 && uploadSuccess && !laterWriteActionsBlocked;
  const publishGateOpen = submitGateOpen && submitSuccess && !laterWriteActionsBlocked;
  const cleanupGateOpen = cleanupRequired;
  const derivedAttemptState = deriveAttemptState({
    uploadSuccess,
    submitSuccess,
    publishSuccess,
    cleanupResult,
    cleanupSatisfied,
    cleanupSuccess,
    hasBlockingRisk,
    residualRecordRequired,
    blockerCount: blockers.length
  });
  const fullLiveWriteSuccess =
    blockers.length === 0 &&
    uploadSuccess &&
    submitSuccess &&
    publishSuccess &&
    cleanupSuccess &&
    !laterWriteActionsBlocked;

  return {
    decision: blockers.length === 0 && !laterWriteActionsBlocked ? "PASS" : "NO_GO",
    derived_attempt_state: derivedAttemptState,
    submit_gate_open: submitGateOpen,
    publish_gate_open: publishGateOpen,
    cleanup_gate_open: cleanupGateOpen,
    upload_success: uploadSuccess,
    submit_success: submitSuccess,
    publish_success: publishSuccess,
    cleanup_satisfied: cleanupSatisfied,
    cleanup_success: cleanupSuccess,
    success_with_residual: successWithResidual,
    full_live_write_success: fullLiveWriteSuccess,
    later_write_actions_blocked: laterWriteActionsBlocked,
    cleanup_required: cleanupRequired,
    residual_record_required: residualRecordRequired,
    blockers
  };
};
