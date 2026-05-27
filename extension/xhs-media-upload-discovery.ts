export type UploadPathEvidence = {
  scenario: "image_upload";
  route_role: "primary" | "fallback";
  path_kind: "page" | "api";
  entry_type: "file_input" | "dropzone" | "upload_api";
  file_injection: "data_transfer" | "native_picker_bridge" | "api_direct" | "candidate";
  trigger_events: string[];
  progress_signals: string[];
  failure_signals: string[];
  evidence_status: "success" | "failed" | "candidate";
  evidence_maturity: "observed_once" | "reproduced_multi_round" | "admission_ready";
  notes: string;
};

export type FileSelectionBoundary = {
  file_bytes_read: false;
  native_picker_opened: false;
  data_transfer_injected: false;
  real_upload_attempted: false;
  submit_attempted: false;
  publish_attempted: false;
  allowed_modes: ["dry_run", "recon"];
};

export type ControlledUploadArtifactIdentity = {
  upload_artifact_id: string;
  source_media_ref: string;
  source_media_digest: string;
  source_media_kind: "image" | "video" | "mixed";
  platform_staging_ref: string | null;
  page_preview_locator: string | null;
  accepted_by_platform: boolean;
  visible_in_editor: boolean;
  captured_at: string;
};

export type ControlledUploadNonPublishEvidence = {
  schema_version: "fr-0032.controlled_upload_path.v1";
  non_publish_validation: true;
  run_id: string;
  profile_ref: string | null;
  target_tab_id: number | null;
  page_url: string;
  upload_artifact_identity: ControlledUploadArtifactIdentity | null;
  file_selection_boundary: FileSelectionBoundary;
  stop_signal: null;
  submitted: false;
  published: false;
};

export type ControlledUploadNonPublishEvaluation = {
  schema_version: "fr-0032.controlled_upload_evaluation.v1";
  decision: "EVIDENCE_PRESENT" | "EVIDENCE_MISSING" | "BOUNDARY_VIOLATION";
  upload_success: boolean;
  full_live_write_success: false;
  non_publish_validation: true;
  entry_gate_evaluated: false;
  runtime_evaluator_required_for_entry_gate: true;
  non_publish_evidence_status: "EVIDENCE_PRESENT" | "EVIDENCE_MISSING";
  blockers: Array<{
    blocker_code:
      | "UPLOAD_ARTIFACT_IDENTITY_MISSING"
      | "SUBMIT_NOT_RUN"
      | "PUBLISH_NOT_RUN";
    message: string;
  }>;
  limitations: Array<{
    limitation_code:
      | "REAL_UPLOAD_NOT_ATTEMPTED"
      | "EDITOR_PREVIEW_NOT_ASSERTED"
      | "ENTRY_GATE_NOT_EVALUATED";
    message: string;
  }>;
  later_write_actions_blocked: boolean;
  cleanup_required: boolean;
};

export type MediaUploadDiscoveryResult = {
  discovery_action: "media_upload_path";
  target_page: "creator_publish_tab";
  upload_path_catalog: UploadPathEvidence[];
  file_selection_boundary: FileSelectionBoundary;
  controlled_upload_evidence: ControlledUploadNonPublishEvidence | null;
  controlled_upload_evaluation: ControlledUploadNonPublishEvaluation;
  submitted: false;
  published: false;
  out_of_scope_actions: string[];
};

const DEFAULT_PROGRESS_SIGNALS = ["preview_visible", "uploading", "upload_done"];
const DEFAULT_FAILURE_SIGNALS = [
  "entry_missing",
  "type_rejected",
  "size_rejected",
  "upload_failed",
  "risk_blocked",
  "upload_injection_blocked"
];

const toArray = <T>(value: Iterable<T>): T[] => Array.from(value);

const sanitizeArtifactPart = (value: string): string =>
  value.replace(/[^A-Za-z0-9._:-]+/gu, "_").slice(0, 96);

const describeFileInput = (input: HTMLInputElement): string => {
  const attributes = [
    input.accept ? `accept=${input.accept}` : null,
    input.multiple ? "multiple=true" : "multiple=false",
    input.disabled ? "disabled=true" : "disabled=false",
    input.hidden ? "hidden=true" : null,
    input.offsetParent === null ? "visible=false" : "visible=true"
  ].filter((item): item is string => item !== null);
  return attributes.join("; ");
};

const discoverFileInputEvidence = (): UploadPathEvidence | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  const fileInputs = toArray(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
  if (fileInputs.length === 0) {
    return null;
  }
  const enabledInput = fileInputs.find((input) => !input.disabled) ?? fileInputs[0];
  return {
    scenario: "image_upload",
    route_role: "primary",
    path_kind: "page",
    entry_type: "file_input",
    file_injection: "data_transfer",
    trigger_events: ["change", "input"],
    progress_signals: DEFAULT_PROGRESS_SIGNALS,
    failure_signals: DEFAULT_FAILURE_SIGNALS,
    evidence_status: enabledInput?.disabled ? "failed" : "candidate",
    evidence_maturity: "observed_once",
    notes: `dry_run/recon only; no file bytes read; candidates=${fileInputs.length}; ${enabledInput ? describeFileInput(enabledInput) : "file input unavailable"}`
  };
};

const discoverDropzoneEvidence = (): UploadPathEvidence | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  const dropzones = toArray(
    document.querySelectorAll<HTMLElement>(
      [
        '[data-testid*="upload" i]',
        '[class*="upload" i]',
        '[class*="drop" i]',
        '[aria-label*="上传" i]',
        '[aria-label*="upload" i]'
      ].join(",")
    )
  );
  if (dropzones.length === 0) {
    return null;
  }
  return {
    scenario: "image_upload",
    route_role: "primary",
    path_kind: "page",
    entry_type: "dropzone",
    file_injection: "data_transfer",
    trigger_events: ["dragenter", "dragover", "drop"],
    progress_signals: DEFAULT_PROGRESS_SIGNALS,
    failure_signals: DEFAULT_FAILURE_SIGNALS,
    evidence_status: "candidate",
    evidence_maturity: "observed_once",
    notes: `dry_run/recon only; dropzone candidates=${dropzones.length}; data_transfer injection remains blocked`
  };
};

const buildFileSelectionBoundary = (): FileSelectionBoundary => ({
  file_bytes_read: false,
  native_picker_opened: false,
  data_transfer_injected: false,
  real_upload_attempted: false,
  submit_attempted: false,
  publish_attempted: false,
  allowed_modes: ["dry_run", "recon"]
});

const buildControlledUploadEvidence = (input: {
  source_media_ref?: string;
  source_media_digest?: string;
  source_media_kind?: "image" | "video" | "mixed" | string;
  run_id?: string;
  profile_ref?: string | null;
  target_tab_id?: number | null;
  page_url?: string;
  page_preview_locator: string | null;
  file_selection_boundary: FileSelectionBoundary;
}): ControlledUploadNonPublishEvidence | null => {
  if (!input.source_media_ref || !input.source_media_digest || !input.source_media_kind) {
    return null;
  }
  if (
    input.source_media_kind !== "image" &&
    input.source_media_kind !== "video" &&
    input.source_media_kind !== "mixed"
  ) {
    return null;
  }
  const digestPart = sanitizeArtifactPart(input.source_media_digest);
  return {
    schema_version: "fr-0032.controlled_upload_path.v1",
    non_publish_validation: true,
    run_id: input.run_id ?? "unknown-run",
    profile_ref: input.profile_ref ?? null,
    target_tab_id: input.target_tab_id ?? null,
    page_url: input.page_url ?? "",
    upload_artifact_identity: {
      upload_artifact_id: `upload-artifact/fr-0032/${sanitizeArtifactPart(input.run_id ?? "unknown-run")}/${digestPart}`,
      source_media_ref: input.source_media_ref,
      source_media_digest: input.source_media_digest,
      source_media_kind: input.source_media_kind,
      platform_staging_ref: null,
      page_preview_locator: input.page_preview_locator,
      accepted_by_platform: false,
      visible_in_editor: false,
      captured_at: new Date().toISOString()
    },
    file_selection_boundary: input.file_selection_boundary,
    stop_signal: null,
    submitted: false,
    published: false
  };
};

const evaluateControlledUploadEvidence = (
  evidence: ControlledUploadNonPublishEvidence | null
): ControlledUploadNonPublishEvaluation => {
  const blockers: ControlledUploadNonPublishEvaluation["blockers"] = [];
  const limitations: ControlledUploadNonPublishEvaluation["limitations"] = [];
  const artifact = evidence?.upload_artifact_identity ?? null;
  const fileSelectionBoundary =
    (evidence?.file_selection_boundary as {
      submit_attempted?: boolean;
      publish_attempted?: boolean;
    } | null) ?? null;
  if (!artifact) {
    blockers.push({
      blocker_code: "UPLOAD_ARTIFACT_IDENTITY_MISSING",
      message: "dry_run/recon upload evidence requires source_media_ref, source_media_digest and source_media_kind"
    });
  }
  if (artifact) {
    limitations.push(
      {
        limitation_code: "REAL_UPLOAD_NOT_ATTEMPTED",
        message: "dry_run/recon does not attempt real platform upload or claim platform acceptance"
      },
      {
        limitation_code: "EDITOR_PREVIEW_NOT_ASSERTED",
        message: "dry_run/recon does not inject DataTransfer or claim editor preview success"
      },
      {
        limitation_code: "ENTRY_GATE_NOT_EVALUATED",
        message: "extension dry_run/recon evidence does not evaluate FR-0032 runtime entry gate"
      }
    );
  }
  if (fileSelectionBoundary?.submit_attempted === true) {
    blockers.push({
      blocker_code: "SUBMIT_NOT_RUN",
      message: "dry_run/recon upload evidence must not submit"
    });
  }
  if (fileSelectionBoundary?.publish_attempted === true) {
    blockers.push({
      blocker_code: "PUBLISH_NOT_RUN",
      message: "dry_run/recon upload evidence must not publish"
    });
  }
  const laterWriteActionsBlocked =
    fileSelectionBoundary?.submit_attempted === true ||
    fileSelectionBoundary?.publish_attempted === true;
  return {
    schema_version: "fr-0032.controlled_upload_evaluation.v1",
    decision:
      blockers.length === 0 && artifact
        ? "EVIDENCE_PRESENT"
        : laterWriteActionsBlocked
          ? "BOUNDARY_VIOLATION"
          : "EVIDENCE_MISSING",
    upload_success: false,
    full_live_write_success: false,
    non_publish_validation: true,
    entry_gate_evaluated: false,
    runtime_evaluator_required_for_entry_gate: true,
    non_publish_evidence_status: artifact ? "EVIDENCE_PRESENT" : "EVIDENCE_MISSING",
    later_write_actions_blocked: laterWriteActionsBlocked,
    cleanup_required: artifact !== null && (blockers.length > 0 || laterWriteActionsBlocked),
    limitations,
    blockers
  };
};

export const buildXhsMediaUploadDiscoveryResult = (input: {
  source_media_ref?: string;
  source_media_digest?: string;
  source_media_kind?: "image" | "video" | "mixed" | string;
  run_id?: string;
  profile_ref?: string | null;
  target_tab_id?: number | null;
  page_url?: string;
} = {}): MediaUploadDiscoveryResult => {
  const pageEvidence = [discoverFileInputEvidence(), discoverDropzoneEvidence()].filter(
    (item): item is UploadPathEvidence => item !== null
  );
  const pageFailure: UploadPathEvidence =
    pageEvidence.length === 0
      ? {
          scenario: "image_upload",
          route_role: "primary",
          path_kind: "page",
          entry_type: "file_input",
          file_injection: "data_transfer",
          trigger_events: ["change", "input"],
          progress_signals: DEFAULT_PROGRESS_SIGNALS,
          failure_signals: DEFAULT_FAILURE_SIGNALS,
          evidence_status: "failed",
          evidence_maturity: "observed_once",
          notes: "dry_run/recon only; no file input or dropzone observed on current page"
        }
      : pageEvidence[0];
  const fileSelectionBoundary = buildFileSelectionBoundary();
  const fallbackApi: UploadPathEvidence = {
    scenario: "image_upload",
    route_role: "fallback",
    path_kind: "api",
    entry_type: "upload_api",
    file_injection: "api_direct",
    trigger_events: [],
    progress_signals: [],
    failure_signals: ["signature_entry_missing", "request_context_missing", "risk_blocked"],
    evidence_status: "candidate",
    evidence_maturity: "observed_once",
    notes: "fallback candidate only; not promoted to primary and not called during #755"
  };
  const controlledUploadEvidence = buildControlledUploadEvidence({
    ...input,
    page_preview_locator:
      pageFailure.evidence_status === "candidate" ? pageFailure.entry_type : null,
    file_selection_boundary: fileSelectionBoundary
  });
  return {
    discovery_action: "media_upload_path",
    target_page: "creator_publish_tab",
    upload_path_catalog: [pageFailure, ...pageEvidence.slice(1), fallbackApi],
    file_selection_boundary: fileSelectionBoundary,
    controlled_upload_evidence: controlledUploadEvidence,
    controlled_upload_evaluation: evaluateControlledUploadEvidence(controlledUploadEvidence),
    submitted: false,
    published: false,
    out_of_scope_actions: ["file_picker_open", "file_bytes_read", "data_transfer_injection", "submit", "publish_confirm"]
  };
};
