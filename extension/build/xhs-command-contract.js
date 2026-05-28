export class ExtensionContractError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.name = "ExtensionContractError";
        this.code = code;
        this.details = details;
    }
}
const invalidAbilityInput = (reason, abilityId = "unknown") => new ExtensionContractError("ERR_CLI_INVALID_ARGS", "能力输入不合法", {
    ability_id: abilityId,
    stage: "input_validation",
    reason
});
const asNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const SOURCE_MEDIA_KINDS = new Set(["image", "video", "mixed"]);
const SOURCE_MEDIA_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const UNSAFE_SOURCE_MEDIA_REF_PATTERN = /^(?:file:|\/|[A-Za-z]:[\\/])/u;
const XHS_EDITOR_INPUT_VALIDATE_COMMAND = "xhs.editor_input.validate";
const XHS_EDITOR_TEXT_WRITE_COMMAND = "xhs.editor_text.write";
const XHS_EDITOR_INPUT_VALIDATE_RUNTIME_SCOPE = "issue_208";
const XHS_EDITOR_TEXT_WRITE_RUNTIME_SCOPE = "issue_208";
const XHS_CREATOR_PUBLISH_ADMIT_COMMAND = "xhs.creator_publish.admit";
const XHS_CREATOR_PUBLISH_ADMIT_RUNTIME_SCOPE = "issue_753";
const XHS_MEDIA_UPLOAD_DISCOVER_COMMAND = "xhs.media_upload.discover";
const XHS_MEDIA_UPLOAD_DISCOVER_RUNTIME_SCOPE = "issue_755";
const XHS_CONTROLLED_LIVE_WRITE_COMMAND = "xhs.creator_publish.controlled_live_write";
const XHS_CONTROLLED_LIVE_WRITE_RUNTIME_SCOPE = "issue_835";
export const validateNormalizedMediaUploadDiscoveryInput = (input, abilityId = "xhs.creator.publish.v1") => {
    const record = input;
    const sourceMediaRef = asNonEmptyString(record.source_media_ref);
    const sourceMediaDigest = asNonEmptyString(record.source_media_digest);
    const sourceMediaKind = asNonEmptyString(record.source_media_kind);
    const hasSourceMediaInput = sourceMediaRef !== null || sourceMediaDigest !== null || sourceMediaKind !== null;
    if (hasSourceMediaInput) {
        if (!sourceMediaRef || UNSAFE_SOURCE_MEDIA_REF_PATTERN.test(sourceMediaRef)) {
            throw invalidAbilityInput("SOURCE_MEDIA_REF_INVALID", abilityId);
        }
        if (!sourceMediaDigest || !SOURCE_MEDIA_DIGEST_PATTERN.test(sourceMediaDigest)) {
            throw invalidAbilityInput("SOURCE_MEDIA_DIGEST_INVALID", abilityId);
        }
        if (!sourceMediaKind || !SOURCE_MEDIA_KINDS.has(sourceMediaKind)) {
            throw invalidAbilityInput("SOURCE_MEDIA_KIND_INVALID", abilityId);
        }
    }
    return {
        target_page: "creator_publish_tab",
        discovery_action: "media_upload_path",
        ...(sourceMediaRef ? { source_media_ref: sourceMediaRef } : {}),
        ...(sourceMediaDigest ? { source_media_digest: sourceMediaDigest } : {}),
        ...(sourceMediaKind
            ? { source_media_kind: sourceMediaKind }
            : {})
    };
};
const parseSearchInput = (payload, abilityId, options, abilityAction) => {
    const issue208EditorInputValidation = abilityAction === "write" &&
        options.issue_scope === "issue_208" &&
        options.action_type === "write" &&
        options.requested_execution_mode === "live_write" &&
        options.validation_action === "editor_input";
    if (issue208EditorInputValidation) {
        return {};
    }
    const query = asNonEmptyString(payload.query);
    if (!query) {
        throw invalidAbilityInput("QUERY_MISSING", abilityId);
    }
    const normalized = {
        query
    };
    if (typeof payload.limit === "number" && Number.isFinite(payload.limit)) {
        normalized.limit = Math.max(1, Math.floor(payload.limit));
    }
    if (typeof payload.page === "number" && Number.isFinite(payload.page)) {
        normalized.page = Math.max(1, Math.floor(payload.page));
    }
    if (asNonEmptyString(payload.search_id)) {
        normalized.search_id = asNonEmptyString(payload.search_id);
    }
    if (asNonEmptyString(payload.sort)) {
        normalized.sort = asNonEmptyString(payload.sort);
    }
    if ((typeof payload.note_type === "string" && payload.note_type.trim().length > 0) ||
        typeof payload.note_type === "number") {
        normalized.note_type = payload.note_type;
    }
    return normalized;
};
export const validateXhsCommandInputForExtension = (input) => {
    if (input.command === "xhs.search") {
        return parseSearchInput(input.payload, input.abilityId, input.options, input.abilityAction);
    }
    if (input.command === XHS_EDITOR_INPUT_VALIDATE_COMMAND) {
        if (input.abilityId !== "xhs.editor.input.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_EDITOR_INPUT_VALIDATE_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.validation_action !== "editor_input") {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        return { validation_action: "editor_input" };
    }
    if (input.command === XHS_EDITOR_TEXT_WRITE_COMMAND) {
        const text = asNonEmptyString(input.payload.text);
        if (input.abilityId !== "xhs.editor.input.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_EDITOR_TEXT_WRITE_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.validation_action !== "editor_input" ||
            input.options.editor_text_write !== true ||
            !text) {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        return { text, validation_action: "editor_input" };
    }
    if (input.command === XHS_CREATOR_PUBLISH_ADMIT_COMMAND) {
        if (input.abilityId !== "xhs.creator.publish.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_CREATOR_PUBLISH_ADMIT_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.target_domain !== "creator.xiaohongshu.com" ||
            input.options.target_page !== "creator_publish_tab") {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        return { target_page: "creator_publish_tab" };
    }
    if (input.command === XHS_MEDIA_UPLOAD_DISCOVER_COMMAND) {
        if (input.abilityId !== "xhs.creator.publish.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_MEDIA_UPLOAD_DISCOVER_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.discovery_action !== "media_upload_path" ||
            input.options.target_domain !== "creator.xiaohongshu.com" ||
            input.options.target_page !== "creator_publish_tab" ||
            (input.options.requested_execution_mode !== "dry_run" &&
                input.options.requested_execution_mode !== "recon")) {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        const sourceMediaRef = asNonEmptyString(input.payload.source_media_ref);
        const sourceMediaDigest = asNonEmptyString(input.payload.source_media_digest);
        const sourceMediaKind = asNonEmptyString(input.payload.source_media_kind);
        const hasSourceMediaInput = sourceMediaRef !== null || sourceMediaDigest !== null || sourceMediaKind !== null;
        if (hasSourceMediaInput) {
            if (!sourceMediaRef || UNSAFE_SOURCE_MEDIA_REF_PATTERN.test(sourceMediaRef)) {
                throw invalidAbilityInput("SOURCE_MEDIA_REF_INVALID", input.abilityId);
            }
            if (!sourceMediaDigest || !SOURCE_MEDIA_DIGEST_PATTERN.test(sourceMediaDigest)) {
                throw invalidAbilityInput("SOURCE_MEDIA_DIGEST_INVALID", input.abilityId);
            }
            if (!sourceMediaKind || !SOURCE_MEDIA_KINDS.has(sourceMediaKind)) {
                throw invalidAbilityInput("SOURCE_MEDIA_KIND_INVALID", input.abilityId);
            }
        }
        return {
            target_page: "creator_publish_tab",
            discovery_action: "media_upload_path",
            ...(sourceMediaRef ? { source_media_ref: sourceMediaRef } : {}),
            ...(sourceMediaDigest ? { source_media_digest: sourceMediaDigest } : {}),
            ...(sourceMediaKind
                ? { source_media_kind: sourceMediaKind }
                : {})
        };
    }
    if (input.command === XHS_CONTROLLED_LIVE_WRITE_COMMAND) {
        const liveWriteAttemptId = asNonEmptyString(input.payload.live_write_attempt_id);
        const sourceMediaRef = asNonEmptyString(input.payload.source_media_ref);
        const sourceMediaDigest = asNonEmptyString(input.payload.source_media_digest);
        const sourceMediaKind = asNonEmptyString(input.payload.source_media_kind);
        if (input.abilityId !== "xhs.creator.publish.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_CONTROLLED_LIVE_WRITE_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.controlled_live_write !== true ||
            input.options.target_domain !== "creator.xiaohongshu.com" ||
            input.options.target_page !== "creator_publish_tab" ||
            input.options.requested_execution_mode !== "live_write" ||
            input.options.confirm_live_write !== true ||
            !liveWriteAttemptId ||
            !sourceMediaRef ||
            UNSAFE_SOURCE_MEDIA_REF_PATTERN.test(sourceMediaRef) ||
            !sourceMediaDigest ||
            !SOURCE_MEDIA_DIGEST_PATTERN.test(sourceMediaDigest) ||
            !sourceMediaKind ||
            !SOURCE_MEDIA_KINDS.has(sourceMediaKind)) {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        return {
            target_page: "creator_publish_tab",
            live_write_attempt_id: liveWriteAttemptId,
            source_media_ref: sourceMediaRef,
            source_media_digest: sourceMediaDigest,
            source_media_kind: sourceMediaKind
        };
    }
    if (input.command === "xhs.detail") {
        const noteId = asNonEmptyString(input.payload.note_id);
        if (!noteId) {
            throw invalidAbilityInput("NOTE_ID_MISSING", input.abilityId);
        }
        return { note_id: noteId };
    }
    if (input.command === "xhs.user_home") {
        const userId = asNonEmptyString(input.payload.user_id);
        if (!userId) {
            throw invalidAbilityInput("USER_ID_MISSING", input.abilityId);
        }
        return { user_id: userId };
    }
    throw invalidAbilityInput("ABILITY_COMMAND_UNSUPPORTED", input.abilityId);
};
