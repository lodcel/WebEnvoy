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
];
const requiredCreatorPublishControlRoles = new Set([
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
const broadCreatorRootPattern = /(?:^|\s)(?:publish-vue-container|creator-publish-root|page-root|app-root)(?:\s|$)/iu;
const broadCreatorRootIds = new Set([
    "app",
    "CreatorPlatform",
    "page",
    "content-area",
    "creator-publish-dom"
]);
const broadCreatorContainerPattern = /(?:^|\s)(?:main-page-container|menu-container|menu-panel|list)(?:\s|$)/iu;
const publishModeNavigationPattern = /发布\s*(?:视频|图文|笔记)|(?:^|[\s_-])publish[\s_-]?(?:video|image|note)(?:$|[\s_-])/iu;
const creatorPublishControlsSelector = [
    "button",
    "a",
    "div",
    "span",
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
const toArray = (value) => Array.from(value);
const sanitizeArtifactPart = (value) => value.replace(/[^A-Za-z0-9._:-]+/gu, "_").slice(0, 96);
const attr = (element, name) => {
    if (typeof element.getAttribute !== "function") {
        return null;
    }
    const value = element.getAttribute(name);
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};
const elementTextSignal = (element) => [
    "textContent" in element && typeof element.textContent === "string" ? element.textContent : "",
    attr(element, "id"),
    attr(element, "name"),
    attr(element, "aria-label"),
    attr(element, "title"),
    attr(element, "placeholder"),
    attr(element, "value"),
    attr(element, "data-testid"),
    attr(element, "data-test"),
    attr(element, "data-role"),
    attr(element, "data-action"),
    attr(element, "data-track"),
    attr(element, "data-log-click")
]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
const attributeNames = (element) => typeof element.getAttributeNames === "function" ? element.getAttributeNames().slice(0, 16) : [];
const classTokens = (element) => {
    const className = attr(element, "class");
    return className ? className.split(/\s+/u).filter(Boolean).slice(0, 8) : [];
};
const locatorFor = (element) => {
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
const isElementVisible = (element) => {
    const html = element;
    if (attr(element, "hidden") !== null || attr(element, "aria-hidden") === "true") {
        return false;
    }
    const computedStyle = typeof globalThis.getComputedStyle === "function" ? globalThis.getComputedStyle(html) : null;
    if (computedStyle &&
        (computedStyle.display === "none" ||
            computedStyle.visibility === "hidden" ||
            computedStyle.visibility === "collapse" ||
            computedStyle.opacity === "0")) {
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
const isElementDisabled = (element) => attr(element, "disabled") !== null ||
    attr(element, "aria-disabled") === "true" ||
    attr(element, "data-disabled") === "true";
const signalFlags = (signal) => ({
    private_visibility: privateVisibilityPattern.test(signal),
    public_visibility: publicVisibilityPattern.test(signal),
    submit_or_next: submitOrNextPattern.test(signal),
    publish_or_confirm: publishOrConfirmPattern.test(signal),
    error_or_toast: errorOrToastPattern.test(signal),
    cleanup_or_abandon: cleanupOrAbandonPattern.test(signal)
});
const isBroadCreatorRootCandidate = (element, candidate) => {
    if (element.tagName.toLowerCase() !== "div") {
        return false;
    }
    const id = attr(element, "id");
    const className = attr(element, "class") ?? "";
    if (id === "web" ||
        (id !== null && broadCreatorRootIds.has(id)) ||
        broadCreatorRootPattern.test(className) ||
        broadCreatorContainerPattern.test(className)) {
        return candidate.text_signal_length > 80;
    }
    return false;
};
const hasPublishModeNavigationAncestor = (element) => typeof element.closest === "function" &&
    element.closest(".publish-video,.publish-image,.publish-note,.menu-container,.menu-panel,[data-role='publish-mode-nav']") !== null;
const isPublishModeNavigationCandidate = (role, element, signal) => {
    if (role !== "publish_or_confirm") {
        return false;
    }
    const className = attr(element, "class") ?? "";
    const roleAttr = attr(element, "role");
    const tagName = element.tagName.toLowerCase();
    const semanticActionTarget = tagName === "button" ||
        tagName === "a" ||
        tagName === "input" ||
        roleAttr === "button" ||
        roleAttr === "menuitem" ||
        /\b(?:button|submit|confirm)\b/iu.test(className);
    if (semanticActionTarget) {
        return false;
    }
    return (publishModeNavigationPattern.test(`${signal} ${className}`) ||
        hasPublishModeNavigationAncestor(element));
};
const candidateMatchesRole = (role, flags) => {
    if (role === "private_visibility") {
        return flags.private_visibility;
    }
    return flags[role];
};
const isActionablePrivateVisibilityCandidate = (candidate) => candidate.visible &&
    !candidate.disabled &&
    candidate.signal_flags.private_visibility &&
    !candidate.signal_flags.public_visibility;
const actionableCandidatesForRole = (role, candidates) => role === "private_visibility"
    ? candidates.filter(isActionablePrivateVisibilityCandidate)
    : candidates.filter((candidate) => candidate.visible && !candidate.disabled);
const classifyControlStatus = (role, candidates) => {
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
const blockerForControl = (item, options = {}) => {
    if (item.status === "ready") {
        return null;
    }
    if (options.deferMissingControls === true && item.status === "missing") {
        return null;
    }
    const role = item.role;
    const prefix = role === "private_visibility"
        ? "PRIVATE_VISIBILITY_CONTROL"
        : role === "submit_or_next"
            ? "SUBMIT_OR_NEXT_CONTROL"
            : role === "publish_or_confirm"
                ? "PUBLISH_OR_CONFIRM_CONTROL"
                : role === "error_or_toast"
                    ? "ERROR_OR_TOAST_CONTROL"
                    : "CLEANUP_OR_ABANDON_CONTROL";
    const suffix = item.status === "ambiguous"
        ? "AMBIGUOUS"
        : item.status === "disabled"
            ? "DISABLED"
            : item.status === "hidden"
                ? "HIDDEN"
                : "MISSING";
    return {
        blocker_code: `${prefix}_${suffix}`,
        blocker_layer: "creator_publish_controls_recon",
        role,
        message: `${role} recon status is ${item.status}; controlled live write must not proceed blindly.`,
        required_recovery_action: "refresh XHS creator publish control locator coverage before controlled upload/submit/publish"
    };
};
const deferredMissingForControl = (item, options = {}) => {
    if (options.deferMissingControls !== true ||
        item.status !== "missing" ||
        item.required_for_live_write !== true) {
        return null;
    }
    return {
        role: item.role,
        status: "missing",
        defer_reason: "pre_upload_upload_entry_present_no_write_boundary",
        message: `${item.role} recon status is missing before controlled upload; this gap is deferred out of blocker_candidates until post-upload controls can mount.`,
        required_recovery_action: "rerun creator publish controls recon after controlled upload reaches the editor continuation stage"
    };
};
const buildCreatorPublishControlsRecon = (fileSelectionBoundary, pageUrl = "", options = {}) => {
    const collectedAt = new Date().toISOString();
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        const controls = creatorPublishControlRoles.map((role) => ({
            role,
            required_for_live_write: requiredCreatorPublishControlRoles.has(role),
            status: "missing",
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
            blocker_candidates: controls
                .map((control) => blockerForControl(control, options))
                .filter((item) => item !== null),
            deferred_missing_control_candidates: controls
                .map((control) => deferredMissingForControl(control, options))
                .filter((item) => item !== null),
            file_selection_boundary: fileSelectionBoundary
        };
    }
    const elements = toArray(document.querySelectorAll(creatorPublishControlsSelector));
    const controls = creatorPublishControlRoles.map((role) => {
        const candidates = elements
            .map((element) => {
            const signal = elementTextSignal(element);
            const flags = signalFlags(`${signal} ${attr(element, "class") ?? ""} ${attr(element, "role") ?? ""}`);
            if (!candidateMatchesRole(role, flags)) {
                return null;
            }
            if (isPublishModeNavigationCandidate(role, element, signal)) {
                return null;
            }
            const candidate = {
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
            return isBroadCreatorRootCandidate(element, candidate) ? null : candidate;
        })
            .filter((item) => item !== null)
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
        blocker_candidates: controls
            .map((control) => blockerForControl(control, options))
            .filter((item) => item !== null),
        deferred_missing_control_candidates: controls
            .map((control) => deferredMissingForControl(control, options))
            .filter((item) => item !== null),
        file_selection_boundary: fileSelectionBoundary
    };
};
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
            captured_at: new Date().toISOString(),
            preview_diagnostics: null
        },
        file_selection_boundary: input.file_selection_boundary,
        stop_signal: null,
        submitted: false,
        published: false
    };
};
const evaluateControlledUploadEvidence = (evidence) => {
    const blockers = [];
    const limitations = [];
    const artifact = evidence?.upload_artifact_identity ?? null;
    const fileSelectionBoundary = evidence?.file_selection_boundary ?? null;
    if (!artifact) {
        blockers.push({
            blocker_code: "UPLOAD_ARTIFACT_IDENTITY_MISSING",
            message: "dry_run/recon upload evidence requires source_media_ref, source_media_digest and source_media_kind"
        });
    }
    if (artifact) {
        limitations.push({
            limitation_code: "REAL_UPLOAD_NOT_ATTEMPTED",
            message: "dry_run/recon does not attempt real platform upload or claim platform acceptance"
        }, {
            limitation_code: "EDITOR_PREVIEW_NOT_ASSERTED",
            message: "dry_run/recon does not inject DataTransfer or claim editor preview success"
        }, {
            limitation_code: "ENTRY_GATE_NOT_EVALUATED",
            message: "extension dry_run/recon evidence does not evaluate FR-0032 runtime entry gate"
        });
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
    const laterWriteActionsBlocked = fileSelectionBoundary?.submit_attempted === true ||
        fileSelectionBoundary?.publish_attempted === true;
    return {
        schema_version: "fr-0032.controlled_upload_evaluation.v1",
        decision: blockers.length === 0 && artifact
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
    const controlsRecon = buildCreatorPublishControlsRecon(fileSelectionBoundary, input.page_url ?? "", {
        deferMissingControls: pageFailure.evidence_status === "candidate" &&
            fileSelectionBoundary.file_bytes_read === false &&
            fileSelectionBoundary.real_upload_attempted === false &&
            fileSelectionBoundary.submit_attempted === false &&
            fileSelectionBoundary.publish_attempted === false
    });
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
