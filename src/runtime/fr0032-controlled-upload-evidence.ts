export type Fr0032UploadEvaluationDecision = "PASS" | "NO_GO";

export type Fr0032SourceMediaKind = "image" | "video" | "mixed";

export type Fr0032UploadBlockerCode =
  | "ENTRY_GATE_NOT_GO"
  | "UPLOAD_ARTIFACT_IDENTITY_MISSING"
  | "UPLOAD_PLATFORM_REJECTED"
  | "UPLOAD_PREVIEW_NOT_VISIBLE"
  | "SUBMIT_NOT_RUN"
  | "ACCOUNT_SAFETY_SIGNAL"
  | "RISK_SIGNAL_BLOCKING";

export type Fr0032UploadRiskKind =
  | "account_safety"
  | "captcha_required"
  | "login_required"
  | "security_redirect"
  | "browser_env_abnormal"
  | "rate_limit"
  | "content_policy"
  | "upload_failure";

export interface Fr0032UploadArtifactIdentity {
  upload_artifact_id: string;
  source_media_ref: string;
  source_media_digest: string;
  source_media_kind: Fr0032SourceMediaKind;
  platform_staging_ref: string | null;
  page_preview_locator: string | null;
  accepted_by_platform: boolean;
  visible_in_editor: boolean;
  captured_at: string;
}

export interface Fr0032UploadRiskSignal {
  risk_signal_id: string;
  detected_at: string;
  source: "runtime.status" | "runtime.audit" | "page_observation" | "upload";
  kind: Fr0032UploadRiskKind;
  severity: "info" | "warning" | "blocking";
  details_ref: string;
}

export interface Fr0032UploadEntryGate {
  spec_review_state: "passed" | "missing";
  latest_head_sha: string | null;
  readmission_decision: "GO" | "NO_GO" | "STALE" | null;
  runtime_readiness: "ready" | "not_ready" | null;
  identity_binding_state: "bound" | "missing" | "mismatch" | null;
  target_binding_state: "verified" | "missing" | "mismatch" | null;
  account_safety_state: "clear" | "blocked" | "unknown" | null;
  validation_rows_state: "ready_verified_no_drift" | "missing" | "drift" | null;
  publish_visibility_scope:
    | "private_or_self_visible"
    | "limited_test_visibility"
    | "public_visible"
    | "unknown"
    | null;
  cleanup_policy_ref: string | null;
}

export interface EvaluateFr0032ControlledUploadInput {
  entry_gate: Fr0032UploadEntryGate;
  upload_artifact_identity: Fr0032UploadArtifactIdentity | null;
  risk_signals?: Fr0032UploadRiskSignal[] | null;
  submit_attempted?: boolean | null;
}

export interface Fr0032ControlledUploadEvaluation {
  decision: Fr0032UploadEvaluationDecision;
  upload_success: boolean;
  full_live_write_success: false;
  non_publish_validation: true;
  later_write_actions_blocked: boolean;
  cleanup_required: boolean;
  blockers: Array<{
    blocker_code: Fr0032UploadBlockerCode;
    message: string;
  }>;
}

const pushBlocker = (
  blockers: Fr0032ControlledUploadEvaluation["blockers"],
  blocker_code: Fr0032UploadBlockerCode,
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

export const evaluateFr0032ControlledUploadEvidence = (
  input: EvaluateFr0032ControlledUploadInput
): Fr0032ControlledUploadEvaluation => {
  const blockers: Fr0032ControlledUploadEvaluation["blockers"] = [];
  const riskSignals = input.risk_signals ?? [];

  if (!entryGatePassed(input.entry_gate)) {
    pushBlocker(
      blockers,
      "ENTRY_GATE_NOT_GO",
      "FR-0032 upload validation requires fresh entry gate GO before any upload path can be trusted"
    );
  }

  const artifact = input.upload_artifact_identity;
  if (!artifact) {
    pushBlocker(
      blockers,
      "UPLOAD_ARTIFACT_IDENTITY_MISSING",
      "upload artifact identity is required for controlled upload success"
    );
  } else {
    if (!artifact.accepted_by_platform) {
      pushBlocker(
        blockers,
        "UPLOAD_PLATFORM_REJECTED",
        "platform must accept or stage the upload artifact"
      );
    }
    if (!artifact.visible_in_editor) {
      pushBlocker(
        blockers,
        "UPLOAD_PREVIEW_NOT_VISIBLE",
        "editor preview visibility is required for upload success"
      );
    }
  }

  if (input.submit_attempted === true) {
    pushBlocker(
      blockers,
      "SUBMIT_NOT_RUN",
      "#845 is a non-publish validation slice and must not submit or publish"
    );
  }

  for (const riskSignal of riskSignals) {
    if (riskSignal.severity !== "blocking") {
      continue;
    }
    pushBlocker(
      blockers,
      riskSignal.kind === "account_safety" ? "ACCOUNT_SAFETY_SIGNAL" : "RISK_SIGNAL_BLOCKING",
      `blocking risk signal observed during upload validation: ${riskSignal.kind}`
    );
  }

  const upload_success =
    blockers.length === 0 &&
    artifact !== null &&
    artifact.accepted_by_platform === true &&
    artifact.visible_in_editor === true;
  const laterWriteActionsBlocked = riskSignals.some(
    (riskSignal) => riskSignal.severity === "blocking"
  );

  return {
    decision: blockers.length === 0 ? "PASS" : "NO_GO",
    upload_success,
    full_live_write_success: false,
    non_publish_validation: true,
    later_write_actions_blocked: laterWriteActionsBlocked,
    cleanup_required: artifact !== null && (blockers.length > 0 || laterWriteActionsBlocked),
    blockers
  };
};
