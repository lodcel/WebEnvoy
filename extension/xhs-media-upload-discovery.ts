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
  preview_diagnostics: EditorPreviewDiagnostics | null;
};

export type EditorPreviewAttributeDiagnostics = {
  depth: number;
  tag_name: string;
  locator: string;
  attribute_names: string[];
  data_attribute_names: string[];
  platform_ref_attribute_names: string[];
  src_kind: "blob" | "data" | "remote" | "other" | null;
  has_upload_completion_signal: boolean;
  has_upload_pending_signal: boolean;
  has_upload_failure_signal: boolean;
};

export type EditorPreviewDiagnostics = {
  schema_version: "fr-0032.preview_dom_diagnostics.v1";
  values_recorded: false;
  recording_policy: "attribute_names_and_signal_flags_only";
  preview_chain: EditorPreviewAttributeDiagnostics[];
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

export type CreatorPublishControlRole =
  | "private_visibility"
  | "submit_or_next"
  | "publish_or_confirm"
  | "error_or_toast"
  | "cleanup_or_abandon";

export type CreatorPublishControlReconCandidate = {
  role: CreatorPublishControlRole;
  locator: string;
  tag_name: string;
  attribute_names: string[];
  class_tokens: string[];
  visible: boolean;
  disabled: boolean;
  text_signal_length: number;
  signal_flags: {
    private_visibility: boolean;
    public_visibility: boolean;
    submit_or_next: boolean;
    publish_or_confirm: boolean;
    error_or_toast: boolean;
    cleanup_or_abandon: boolean;
  };
};

export type CreatorPublishControlReconMatrixItem = {
  role: CreatorPublishControlRole;
  required_for_live_write: boolean;
  status: "ready" | "missing" | "ambiguous" | "disabled" | "hidden";
  candidate_count: number;
  selected_locator: string | null;
  candidates: CreatorPublishControlReconCandidate[];
};

export type CreatorPublishControlReconBlocker = {
  blocker_code:
    | "PRIVATE_VISIBILITY_CONTROL_MISSING"
    | "PRIVATE_VISIBILITY_CONTROL_AMBIGUOUS"
    | "PRIVATE_VISIBILITY_CONTROL_DISABLED"
    | "PRIVATE_VISIBILITY_CONTROL_HIDDEN"
    | "SUBMIT_OR_NEXT_CONTROL_MISSING"
    | "SUBMIT_OR_NEXT_CONTROL_AMBIGUOUS"
    | "SUBMIT_OR_NEXT_CONTROL_DISABLED"
    | "SUBMIT_OR_NEXT_CONTROL_HIDDEN"
    | "PUBLISH_OR_CONFIRM_CONTROL_MISSING"
    | "PUBLISH_OR_CONFIRM_CONTROL_AMBIGUOUS"
    | "PUBLISH_OR_CONFIRM_CONTROL_DISABLED"
    | "PUBLISH_OR_CONFIRM_CONTROL_HIDDEN"
    | "ERROR_OR_TOAST_CONTROL_MISSING"
    | "ERROR_OR_TOAST_CONTROL_AMBIGUOUS"
    | "ERROR_OR_TOAST_CONTROL_DISABLED"
    | "ERROR_OR_TOAST_CONTROL_HIDDEN"
    | "CLEANUP_OR_ABANDON_CONTROL_MISSING"
    | "CLEANUP_OR_ABANDON_CONTROL_AMBIGUOUS"
    | "CLEANUP_OR_ABANDON_CONTROL_DISABLED"
    | "CLEANUP_OR_ABANDON_CONTROL_HIDDEN";
  blocker_layer: "creator_publish_controls_recon";
  role: CreatorPublishControlRole;
  message: string;
  required_recovery_action: string;
};

export type CreatorPublishControlsRecon = {
  schema_version: "fr-0032.creator_publish_controls_recon.v1";
  no_write: true;
  target_page: "creator_publish_tab";
  page_url: string;
  collected_at: string;
  recording_policy: "locator_attributes_flags_and_lengths_only";
  controls: CreatorPublishControlReconMatrixItem[];
  blocker_candidates: CreatorPublishControlReconBlocker[];
  file_selection_boundary: FileSelectionBoundary;
};

export type MediaUploadDiscoveryResult = {
  discovery_action: "media_upload_path";
  target_page: "creator_publish_tab";
  upload_path_catalog: UploadPathEvidence[];
  creator_publish_controls_recon: CreatorPublishControlsRecon;
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
const creatorPublishControlRoles = [
  "private_visibility",
  "submit_or_next",
  "publish_or_confirm",
  "error_or_toast",
  "cleanup_or_abandon"
] as const satisfies readonly CreatorPublishControlRole[];
const requiredCreatorPublishControlRoles = new Set<CreatorPublishControlRole>([
  "private_visibility",
  "submit_or_next",
  "publish_or_confirm",
  "error_or_toast",
  "cleanup_or_abandon"
]);
const privateVisibilityPattern = /私密|仅自己|仅我|自己可见|private|only\s*me|self/iu;
const publicVisibilityPattern = /公开|所有人|public|everyone/iu;
const submitOrNextPattern = /下一步|继续|完成|next|continue|submit/iu;
const publishOrConfirmPattern = /发布|确认发布|publish|post|confirm/iu;
const errorOrToastPattern = /toast|notice|alert|error|warning|错误|失败|提示|校验|验证/iu;
const cleanupOrAbandonPattern = /删除|移除|撤回|取消|放弃|清空|delete|remove|rollback|cancel|abandon|discard/iu;
const creatorPublishControlsSelector = [
  "button",
  "label",
  "input",
  "textarea",
  "select",
  "summary",
  "[role='button']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='option']",
  "[role='menuitem']",
  "[role='menuitemradio']",
  "[role='radio']",
  "[role='alert']",
  "[role='status']",
  "[class*='select' i]",
  "[class*='dropdown' i]",
  "[class*='visibility' i]",
  "[class*='privacy' i]",
  "[class*='permission' i]",
  "[class*='submit' i]",
  "[class*='publish' i]",
  "[class*='button' i]",
  "[class*='toast' i]",
  "[class*='notice' i]",
  "[class*='error' i]",
  "[class*='delete' i]",
  "[class*='remove' i]",
  "[class*='cancel' i]"
].join(",");

const toArray = <T>(value: Iterable<T>): T[] => Array.from(value);

const sanitizeArtifactPart = (value: string): string =>
  value.replace(/[^A-Za-z0-9._:-]+/gu, "_").slice(0, 96);

const attr = (element: Element, name: string): string | null => {
  if (typeof element.getAttribute !== "function") {
    return null;
  }
  const value = element.getAttribute(name);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const elementTextSignal = (element: Element): string =>
  [
    "textContent" in element && typeof element.textContent === "string" ? element.textContent : "",
    attr(element, "aria-label"),
    attr(element, "title"),
    attr(element, "placeholder"),
    attr(element, "value")
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

const attributeNames = (element: Element): string[] =>
  typeof element.getAttributeNames === "function" ? element.getAttributeNames().slice(0, 16) : [];

const classTokens = (element: Element): string[] => {
  const className = attr(element, "class");
  return className ? className.split(/\s+/u).filter(Boolean).slice(0, 8) : [];
};

const locatorFor = (element: Element): string => {
  const tagName = element.tagName.toLowerCase();
  const id = attr(element, "id");
  if (id) {
    return `${tagName}#${id}`;
  }
  const testId = attr(element, "data-testid") ?? attr(element, "data-test");
  if (testId) {
    return `${tagName}[data-testid="${testId.slice(0, 80)}"]`;
  }
  const role = attr(element, "role");
  const className = classTokens(element).slice(0, 3).join(".");
  if (className) {
    return `${tagName}.${className}`;
  }
  return role ? `${tagName}[role="${role}"]` : tagName;
};

const isElementVisible = (element: Element): boolean => {
  const html = element as HTMLElement;
  if (attr(element, "hidden") !== null || attr(element, "aria-hidden") === "true") {
    return false;
  }
  const computedStyle =
    typeof globalThis.getComputedStyle === "function" ? globalThis.getComputedStyle(html) : null;
  if (
    computedStyle &&
    (computedStyle.display === "none" ||
      computedStyle.visibility === "hidden" ||
      computedStyle.visibility === "collapse" ||
      computedStyle.opacity === "0")
  ) {
    return false;
  }
  if (typeof html.getClientRects === "function" && html.getClientRects().length === 0) {
    return false;
  }
  if (typeof html.offsetParent !== "undefined" && html.offsetParent === null) {
    const style = attr(element, "style") ?? "";
    return !/display\s*:\s*none|visibility\s*:\s*hidden/iu.test(style);
  }
  return true;
};

const isElementDisabled = (element: Element): boolean =>
  attr(element, "disabled") !== null ||
  attr(element, "aria-disabled") === "true" ||
  attr(element, "data-disabled") === "true";

const signalFlags = (signal: string): CreatorPublishControlReconCandidate["signal_flags"] => ({
  private_visibility: privateVisibilityPattern.test(signal),
  public_visibility: publicVisibilityPattern.test(signal),
  submit_or_next: submitOrNextPattern.test(signal),
  publish_or_confirm: publishOrConfirmPattern.test(signal),
  error_or_toast: errorOrToastPattern.test(signal),
  cleanup_or_abandon: cleanupOrAbandonPattern.test(signal)
});

const candidateMatchesRole = (
  role: CreatorPublishControlRole,
  flags: CreatorPublishControlReconCandidate["signal_flags"]
): boolean => {
  if (role === "private_visibility") {
    return flags.private_visibility;
  }
  return flags[role];
};

const isActionablePrivateVisibilityCandidate = (candidate: CreatorPublishControlReconCandidate): boolean =>
  candidate.visible &&
  !candidate.disabled &&
  candidate.signal_flags.private_visibility &&
  !candidate.signal_flags.public_visibility;

const actionableCandidatesForRole = (
  role: CreatorPublishControlRole,
  candidates: CreatorPublishControlReconCandidate[]
): CreatorPublishControlReconCandidate[] =>
  role === "private_visibility"
    ? candidates.filter(isActionablePrivateVisibilityCandidate)
    : candidates.filter((candidate) => candidate.visible && !candidate.disabled);

const classifyControlStatus = (
  role: CreatorPublishControlRole,
  candidates: CreatorPublishControlReconCandidate[]
): CreatorPublishControlReconMatrixItem["status"] => {
  if (candidates.length === 0) {
    return "missing";
  }
  const actionable = actionableCandidatesForRole(role, candidates);
  if (actionable.length === 0) {
    if (role === "private_visibility" && candidates.some((candidate) => candidate.visible && !candidate.disabled)) {
      return "ambiguous";
    }
    return candidates.some((candidate) => !candidate.visible) ? "hidden" : "disabled";
  }
  return actionable.length === 1 ? "ready" : "ambiguous";
};

const blockerForControl = (
  item: CreatorPublishControlReconMatrixItem
): CreatorPublishControlReconBlocker | null => {
  if (item.status === "ready") {
    return null;
  }
  const role = item.role;
  const prefix =
    role === "private_visibility"
      ? "PRIVATE_VISIBILITY_CONTROL"
      : role === "submit_or_next"
        ? "SUBMIT_OR_NEXT_CONTROL"
        : role === "publish_or_confirm"
          ? "PUBLISH_OR_CONFIRM_CONTROL"
          : role === "error_or_toast"
            ? "ERROR_OR_TOAST_CONTROL"
            : "CLEANUP_OR_ABANDON_CONTROL";
  const suffix =
    item.status === "ambiguous"
      ? "AMBIGUOUS"
      : item.status === "disabled"
        ? "DISABLED"
        : item.status === "hidden"
          ? "HIDDEN"
          : "MISSING";
  return {
    blocker_code: `${prefix}_${suffix}` as CreatorPublishControlReconBlocker["blocker_code"],
    blocker_layer: "creator_publish_controls_recon",
    role,
    message: `${role} recon status is ${item.status}; controlled live write must not proceed blindly.`,
    required_recovery_action: "refresh XHS creator publish control locator coverage before controlled upload/submit/publish"
  };
};

const buildCreatorPublishControlsRecon = (
  fileSelectionBoundary: FileSelectionBoundary,
  pageUrl = ""
): CreatorPublishControlsRecon => {
  const collectedAt = new Date().toISOString();
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    const controls = creatorPublishControlRoles.map((role) => ({
      role,
      required_for_live_write: requiredCreatorPublishControlRoles.has(role),
      status: "missing" as const,
      candidate_count: 0,
      selected_locator: null,
      candidates: []
    }));
    return {
      schema_version: "fr-0032.creator_publish_controls_recon.v1",
      no_write: true,
      target_page: "creator_publish_tab",
      page_url: pageUrl,
      collected_at: collectedAt,
      recording_policy: "locator_attributes_flags_and_lengths_only",
      controls,
      blocker_candidates: controls.map(blockerForControl).filter((item): item is CreatorPublishControlReconBlocker => item !== null),
      file_selection_boundary: fileSelectionBoundary
    };
  }
  const elements = toArray(document.querySelectorAll<Element>(creatorPublishControlsSelector));
  const controls = creatorPublishControlRoles.map((role) => {
    const candidates = elements
      .map((element): CreatorPublishControlReconCandidate | null => {
        const signal = elementTextSignal(element);
        const flags = signalFlags(`${signal} ${attr(element, "class") ?? ""} ${attr(element, "role") ?? ""}`);
        if (!candidateMatchesRole(role, flags)) {
          return null;
        }
        return {
          role,
          locator: locatorFor(element),
          tag_name: element.tagName.toLowerCase(),
          attribute_names: attributeNames(element),
          class_tokens: classTokens(element),
          visible: isElementVisible(element),
          disabled: isElementDisabled(element),
          text_signal_length: signal.length,
          signal_flags: flags
        };
      })
      .filter((item): item is CreatorPublishControlReconCandidate => item !== null)
      .slice(0, 12);
    const status = classifyControlStatus(role, candidates);
    const selected = actionableCandidatesForRole(role, candidates)[0] ?? null;
    return {
      role,
      required_for_live_write: requiredCreatorPublishControlRoles.has(role),
      status,
      candidate_count: candidates.length,
      selected_locator: status === "ready" ? selected?.locator ?? null : null,
      candidates
    };
  });
  return {
    schema_version: "fr-0032.creator_publish_controls_recon.v1",
    no_write: true,
    target_page: "creator_publish_tab",
    page_url: pageUrl,
    collected_at: collectedAt,
    recording_policy: "locator_attributes_flags_and_lengths_only",
    controls,
    blocker_candidates: controls.map(blockerForControl).filter((item): item is CreatorPublishControlReconBlocker => item !== null),
    file_selection_boundary: fileSelectionBoundary
  };
};

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
      captured_at: new Date().toISOString(),
      preview_diagnostics: null
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
  const controlsRecon = buildCreatorPublishControlsRecon(fileSelectionBoundary, input.page_url ?? "");
  return {
    discovery_action: "media_upload_path",
    target_page: "creator_publish_tab",
    upload_path_catalog: [pageFailure, ...pageEvidence.slice(1), fallbackApi],
    creator_publish_controls_recon: controlsRecon,
    file_selection_boundary: fileSelectionBoundary,
    controlled_upload_evidence: controlledUploadEvidence,
    controlled_upload_evaluation: evaluateControlledUploadEvidence(controlledUploadEvidence),
    submitted: false,
    published: false,
    out_of_scope_actions: ["file_picker_open", "file_bytes_read", "data_transfer_injection", "submit", "publish_confirm"]
  };
};
