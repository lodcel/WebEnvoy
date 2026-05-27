const DEFAULT_PROGRESS_SIGNALS = ["preview_visible", "uploading", "upload_done"];
const DEFAULT_FAILURE_SIGNALS = [
    "entry_missing",
    "type_rejected",
    "size_rejected",
    "upload_failed",
    "risk_blocked",
    "upload_injection_blocked"
];
const toArray = (value) => Array.from(value);
const sanitizeArtifactPart = (value) => value.replace(/[^A-Za-z0-9._:-]+/gu, "_").slice(0, 96);
const describeFileInput = (input) => {
    const attributes = [
        input.accept ? `accept=${input.accept}` : null,
        input.multiple ? "multiple=true" : "multiple=false",
        input.disabled ? "disabled=true" : "disabled=false",
        input.hidden ? "hidden=true" : null,
        input.offsetParent === null ? "visible=false" : "visible=true"
    ].filter((item) => item !== null);
    return attributes.join("; ");
};
const discoverFileInputEvidence = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    const fileInputs = toArray(document.querySelectorAll('input[type="file"]'));
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
const discoverDropzoneEvidence = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    const dropzones = toArray(document.querySelectorAll([
        '[data-testid*="upload" i]',
        '[class*="upload" i]',
        '[class*="drop" i]',
        '[aria-label*="上传" i]',
        '[aria-label*="upload" i]'
    ].join(",")));
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
const buildFileSelectionBoundary = () => ({
    file_bytes_read: false,
    native_picker_opened: false,
    data_transfer_injected: false,
    real_upload_attempted: false,
    submit_attempted: false,
    publish_attempted: false,
    allowed_modes: ["dry_run", "recon"]
});
const buildControlledUploadEvidence = (input) => {
    if (!input.source_media_ref || !input.source_media_digest || !input.source_media_kind) {
        return null;
    }
    if (input.source_media_kind !== "image" &&
        input.source_media_kind !== "video" &&
        input.source_media_kind !== "mixed") {
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
const evaluateControlledUploadEvidence = (evidence) => {
    const blockers = [];
    const artifact = evidence?.upload_artifact_identity ?? null;
    if (!artifact) {
        blockers.push({
            blocker_code: "UPLOAD_ARTIFACT_IDENTITY_MISSING",
            message: "dry_run/recon upload evidence requires source_media_ref, source_media_digest and source_media_kind"
        });
    }
    else {
        if (!artifact.accepted_by_platform) {
            blockers.push({
                blocker_code: "UPLOAD_PLATFORM_REJECTED",
                message: "dry_run/recon does not attempt real platform upload or claim platform acceptance"
            });
        }
        if (!artifact.visible_in_editor) {
            blockers.push({
                blocker_code: "UPLOAD_PREVIEW_NOT_VISIBLE",
                message: "dry_run/recon does not inject DataTransfer or claim editor preview success"
            });
        }
    }
    return {
        schema_version: "fr-0032.controlled_upload_evaluation.v1",
        decision: blockers.length === 0 ? "PASS" : "NO_GO",
        upload_success: blockers.length === 0,
        full_live_write_success: false,
        non_publish_validation: true,
        blockers
    };
};
export const buildXhsMediaUploadDiscoveryResult = (input = {}) => {
    const pageEvidence = [discoverFileInputEvidence(), discoverDropzoneEvidence()].filter((item) => item !== null);
    const pageFailure = pageEvidence.length === 0
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
    const fallbackApi = {
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
        page_preview_locator: pageFailure.evidence_status === "candidate" ? pageFailure.entry_type : null,
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
