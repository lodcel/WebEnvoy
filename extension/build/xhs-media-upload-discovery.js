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
export const buildXhsMediaUploadDiscoveryResult = () => {
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
    return {
        discovery_action: "media_upload_path",
        target_page: "creator_publish_tab",
        upload_path_catalog: [pageFailure, ...pageEvidence.slice(1), fallbackApi],
        file_selection_boundary: {
            file_bytes_read: false,
            native_picker_opened: false,
            data_transfer_injected: false,
            real_upload_attempted: false,
            allowed_modes: ["dry_run", "recon"]
        },
        submitted: false,
        published: false,
        out_of_scope_actions: ["file_picker_open", "file_bytes_read", "data_transfer_injection", "submit", "publish_confirm"]
    };
};
