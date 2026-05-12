import { resolveMainWorldEventNamesForSecret } from "./content-script-handler.js";
import { BackgroundRelay as ExtractedBackgroundRelay } from "./background-relay.js";
import { BackgroundRuntimeTrustState } from "./background-runtime-trust-state.js";
import { NativeBridgePendingForwardState } from "./native-bridge-pending-forward-state.js";
import { NativeBridgeRecoveryState } from "./native-bridge-recovery-state.js";
import { WRITE_INTERACTION_TIER, APPROVAL_CHECK_KEYS, EXECUTION_MODES, buildRiskTransitionAudit, buildUnifiedRiskStateOutput, getIssueActionMatrixEntry, isApprovalRecordComplete, resolveIssueScope as resolveSharedIssueScope, resolveRiskState as resolveSharedRiskState } from "../shared/risk-state.js";
import { ensureFingerprintRuntimeContext } from "../shared/fingerprint-profile.js";
import { buildXhsGatePolicyState, buildIssue209PostGateArtifacts, collectXhsCommandGateReasons, evaluateXhsGate, collectXhsMatrixGateReasons, finalizeXhsGateOutcome, resolveXhsGateApprovalId, resolveXhsGateDecisionId, resolveXhsActionType, resolveXhsExecutionMode, normalizeXhsApprovalRecord } from "../shared/xhs-gate.js";
import { ExtensionContractError, validateXhsCommandInputForExtension } from "./xhs-command-contract.js";
import { createPageContextNamespace, SEARCH_ENDPOINT } from "./xhs-search-types.js";
const DETAIL_ENDPOINT = "/api/sns/web/v1/feed";
const USER_HOME_ENDPOINT = "/api/sns/web/v1/user/otherinfo";
const defaultForwardTimeoutMs = 3_000;
const defaultHandshakeTimeoutMs = 30_000;
const defaultNativeHostName = "com.webenvoy.host";
const bridgeProtocol = "webenvoy.native-bridge.v1";
const debuggerProtocolVersion = "1.3";
const MAIN_WORLD_BRIDGE_PROBE_NAMESPACE = "webenvoy.main_world.bridge_probe.v1";
const STAGED_EXTENSION_BOOTSTRAP_SCRIPT_PATH = "build/__webenvoy_fingerprint_bootstrap.js";
const XHS_MAIN_WORLD_REQUEST_PATH_ALLOWLIST = new Set([
    SEARCH_ENDPOINT,
    DETAIL_ENDPOINT,
    USER_HOME_ENDPOINT
]);
const passiveCaptureSensitiveHeaderNames = new Set([
    "authorization",
    "cookie",
    "proxy-authorization",
    "set-cookie",
    "x-s",
    "x-s-common",
    "x-t"
]);
const passiveCaptureRedactedHeaderValue = "[redacted]";
const editorInputDebuggerProbeWaitMs = 150;
const xhsTargetRestoreNavigationTimeoutMs = 5_000;
const xhsTargetRestoreNavigationPollMs = 100;
const xhsOpenResultCardNavigationTimeoutMs = 5_000;
const xhsForwardResponseSafetyMs = 5_000;
const xhsPreForwardStageTimeoutMs = 5_000;
const xhsStaleRestoreBindingLeaseMaxAgeMs = 120_000;
const editorInputDebuggerEntryLabels = ["新的创作"];
const editorInputSelectors = [
    'div.tiptap.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"].tiptap.ProseMirror',
    '[contenteditable="true"].ProseMirror',
    '[contenteditable="true"][data-lexical-editor="true"]'
];
const xhsSearchInputSelectors = [
    'input[type="search"]',
    'input[class*="search"]',
    'input[placeholder*="搜索"]',
    'input[placeholder*="search" i]',
    'input:not([type="hidden"])'
];
const reserveXhsForwardResponseSafetyMs = (timeoutMs) => timeoutMs > xhsForwardResponseSafetyMs
    ? Math.max(1, timeoutMs - xhsForwardResponseSafetyMs)
    : timeoutMs;
const redactPassiveCaptureHeaders = (headers) => Object.fromEntries(Object.entries(headers).map(([key, value]) => [
    key,
    passiveCaptureSensitiveHeaderNames.has(key.toLowerCase())
        ? passiveCaptureRedactedHeaderValue
        : value
]));
const xhsSearchButtonSelectors = [
    'button[type="submit"]',
    'button[class*="search" i]',
    '[role="button"][class*="search" i]',
    '[aria-label*="搜索"]',
    '[aria-label*="search" i]',
    '[title*="搜索"]',
    '[title*="search" i]',
    '[class*="search-icon" i]',
    '[class*="searchIcon" i]',
    '[class*="search-btn" i]'
];
const readTimeoutMs = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }
    if (value < 1) {
        return null;
    }
    return Math.floor(value);
};
const hashMainWorldBridgeProbeSecret = (value) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `mwprobe_${(hash >>> 0).toString(36)}`;
};
const XHS_READ_DOMAIN = "www.xiaohongshu.com";
const XHS_WRITE_DOMAIN = "creator.xiaohongshu.com";
const XHS_READ_API_DOMAIN = "edith.xiaohongshu.com";
const XHS_DOMAIN_ALLOWLIST = new Set([XHS_READ_DOMAIN, XHS_WRITE_DOMAIN]);
const XHS_MAIN_WORLD_REQUEST_DOMAIN_ALLOWLIST = new Set([
    XHS_READ_DOMAIN,
    XHS_WRITE_DOMAIN,
    XHS_READ_API_DOMAIN
]);
const isXhsSearchResultDetailPath = (pathname) => /^\/search_result\/[^/?#]+/u.test(pathname);
const isXhsDetailLikePath = (pathname) => pathname.startsWith("/explore/") ||
    pathname.startsWith("/discovery/item/") ||
    isXhsSearchResultDetailPath(pathname);
const isXhsMainWorldRequestHostAllowed = (input) => {
    if (!XHS_MAIN_WORLD_REQUEST_DOMAIN_ALLOWLIST.has(input.requestHost)) {
        return false;
    }
    return input.requestHost !== XHS_READ_API_DOMAIN || input.senderHost === XHS_READ_DOMAIN;
};
const STARTUP_TRUST_ALLOWLIST_URLS = [`*://${XHS_READ_DOMAIN}/*`, `*://${XHS_WRITE_DOMAIN}/*`];
const XHS_ACTION_TYPES = new Set(["read", "write", "irreversible_write"]);
const XHS_EXECUTION_MODES = new Set(EXECUTION_MODES);
const XHS_LIVE_EXECUTION_MODES = new Set([
    "live_read_limited",
    "live_read_high_risk",
    "live_write"
]);
const XHS_GATE_COMMANDS = new Set(["xhs.search", "xhs.detail", "xhs.user_home"]);
const XHS_REQUIRED_APPROVAL_CHECKS = APPROVAL_CHECK_KEYS;
const XHS_WRITE_APPROVAL_REQUIREMENTS = [
    "approval_record_approved_true",
    "approval_record_approver_present",
    "approval_record_approved_at_present",
    "approval_record_checks_all_true"
];
const XHS_READ_EXECUTION_POLICY = {
    default_mode: "dry_run",
    allowed_modes: ["dry_run", "recon", "live_read_limited", "live_read_high_risk"],
    blocked_actions: ["expand_new_live_surface_without_gate"],
    live_entry_requirements: [
        "gate_input_risk_state_limited_or_allowed",
        "audit_admission_evidence_present",
        "audit_admission_checks_all_true",
        "risk_state_checked",
        "target_domain_confirmed",
        "target_tab_confirmed",
        "target_page_confirmed",
        "action_type_confirmed",
        "approval_admission_evidence_approved_true",
        "approval_admission_evidence_approver_present",
        "approval_admission_evidence_approved_at_present",
        "approval_admission_evidence_checks_all_true"
    ]
};
const XHS_SCOPE_CONTEXT = {
    platform: "xhs",
    read_domain: XHS_READ_DOMAIN,
    write_domain: XHS_WRITE_DOMAIN,
    domain_mixing_forbidden: true
};
const XHS_GATE_CONTRACT_MARKERS = {
    conditional_actions: "conditional_actions",
    recovery_requirements: "recovery_requirements",
    session_rhythm_policy: "session_rhythm_policy",
    session_rhythm: "session_rhythm"
};
const STARTUP_TRUST_SOURCE = "extension_bootstrap_context";
const XHS_PLUGIN_GATE_OWNERSHIP = {
    background_gate: ["target_domain_check", "target_tab_check", "mode_gate", "risk_state_gate"],
    content_script_gate: ["page_context_check", "action_tier_check"],
    main_world_gate: ["signed_call_scope_check"],
    cli_role: "request_and_result_shell_only"
};
const resolvePreferredXhsReadPage = (command, targetPage) => {
    if (targetPage === "search_result_tab" || targetPage === "explore_detail_tab" || targetPage === "profile_tab") {
        return targetPage;
    }
    if (command === "xhs.detail") {
        return "explore_detail_tab";
    }
    if (command === "xhs.user_home") {
        return "profile_tab";
    }
    if (command === "xhs.search") {
        return "search_result_tab";
    }
    return null;
};
const isXhsReadTargetPage = (value) => value === "search_result_tab" || value === "explore_detail_tab" || value === "profile_tab";
const resolveRequestedXhsResourceId = (command, commandParams) => {
    const explicitTargetResourceId = resolveRuntimeBootstrapRequestedXhsResourceId(commandParams, resolvePreferredXhsReadPage(command, asNonEmptyString(commandParams.target_page)));
    if (explicitTargetResourceId) {
        return explicitTargetResourceId;
    }
    const input = asRecord(commandParams.input);
    if (command === "xhs.detail") {
        return asNonEmptyString(input?.note_id);
    }
    if (command === "xhs.user_home") {
        return asNonEmptyString(input?.user_id);
    }
    return null;
};
const resolveRuntimeBootstrapRequestedXhsResourceId = (commandParams, preferredPage) => {
    if (preferredPage !== "explore_detail_tab" && preferredPage !== "profile_tab") {
        return null;
    }
    const options = asRecord(commandParams.options);
    return asNonEmptyString(commandParams.target_resource_id ?? options?.target_resource_id);
};
const isAllowedTargetPageForXhsReadCommand = (command, targetPage) => {
    if (!targetPage) {
        return true;
    }
    if (command === "xhs.detail") {
        return targetPage === "explore_detail_tab";
    }
    if (command === "xhs.user_home") {
        return targetPage === "profile_tab";
    }
    return true;
};
const validateXhsCommandInputContract = (command, commandParams) => {
    const ability = asRecord(commandParams.ability);
    const input = asRecord(commandParams.input);
    const options = asRecord(commandParams.options) ?? {};
    if (!ability || !input) {
        return;
    }
    validateXhsCommandInputForExtension({
        command,
        abilityId: asNonEmptyString(ability.id) ?? "unknown",
        abilityAction: (asNonEmptyString(ability.action) ?? "read"),
        payload: input,
        options
    });
};
const tabMatchesRequestedXhsResource = (tab, preferredPage, resourceId) => {
    if (!preferredPage || !resourceId) {
        return false;
    }
    const url = typeof tab.url === "string" ? tab.url : "";
    const parsed = parseUrl(url);
    if (!parsed) {
        return false;
    }
    const currentResourceId = parsed.pathname.split("/").filter((segment) => segment.length > 0).pop() ?? null;
    if (preferredPage === "explore_detail_tab") {
        return isXhsDetailLikePath(parsed.pathname) && currentResourceId === resourceId;
    }
    if (preferredPage === "profile_tab") {
        return parsed.pathname.startsWith("/user/profile/") && currentResourceId === resourceId;
    }
    return false;
};
const scoreXhsTab = (tab, preferredPage) => {
    const url = typeof tab.url === "string" ? tab.url : "";
    const parsed = parseUrl(url);
    const pathname = parsed?.pathname ?? "";
    const page = isXhsSearchResultDetailPath(pathname)
        ? "explore_detail_tab"
        : url.includes("/search_result")
            ? "search_result_tab"
            : isXhsDetailLikePath(pathname)
                ? "explore_detail_tab"
                : url.includes("/user/profile/")
                    ? "profile_tab"
                    : "other";
    if (preferredPage && page === preferredPage) {
        return 0;
    }
    if (page === "search_result_tab") {
        return 1;
    }
    if (page === "explore_detail_tab") {
        return 2;
    }
    if (page === "profile_tab") {
        return 3;
    }
    return 4;
};
const scoreXhsRuntimeSurfaceTab = (tab) => {
    const url = typeof tab.url === "string" ? tab.url : "";
    if (url.includes("creator.xiaohongshu.com/publish/publish")) {
        return 0;
    }
    if (url.includes("creator.xiaohongshu.com/")) {
        return 1;
    }
    if (url.includes("www.xiaohongshu.com/")) {
        return 2;
    }
    return 3;
};
const resolveRuntimeBootstrapReadTargetTabId = async (chromeApi, preferredPage, requestedResourceId) => {
    return await resolvePreferredXhsReadTargetTabId(chromeApi, preferredPage, requestedResourceId);
};
const resolvePreferredXhsReadTargetTabId = async (chromeApi, preferredPage, requestedResourceId) => {
    const xhsUrlPatterns = [
        "*://www.xiaohongshu.com/*",
        "*://edith.xiaohongshu.com/*",
        "*://*.xiaohongshu.com/*"
    ];
    const queryAllWindowTabs = async () => {
        try {
            return await chromeApi.tabs.query({
                url: xhsUrlPatterns
            });
        }
        catch {
            return [];
        }
    };
    let currentWindowTabs = [];
    try {
        currentWindowTabs = await chromeApi.tabs.query({
            currentWindow: true,
            url: xhsUrlPatterns
        });
    }
    catch {
        currentWindowTabs = [];
    }
    let allWindowTabs = null;
    const resolveAllWindowTabs = async () => {
        if (allWindowTabs) {
            return allWindowTabs;
        }
        allWindowTabs = await queryAllWindowTabs();
        return allWindowTabs;
    };
    let xhsTabs = currentWindowTabs;
    if (currentWindowTabs.length === 0) {
        xhsTabs = await resolveAllWindowTabs();
    }
    if (requestedResourceId && preferredPage) {
        const globalResourceBoundTabs = (await resolveAllWindowTabs()).filter((tab) => tabMatchesRequestedXhsResource(tab, preferredPage, requestedResourceId));
        if (globalResourceBoundTabs.length !== 1) {
            return null;
        }
        return typeof globalResourceBoundTabs[0]?.id === "number" ? globalResourceBoundTabs[0].id : null;
    }
    let preferredTabs = preferredPage !== null
        ? xhsTabs.filter((tab) => scoreXhsTab(tab, preferredPage) === 0)
        : xhsTabs;
    if (preferredPage === "search_result_tab" &&
        preferredTabs.length === 0 &&
        currentWindowTabs.length > 0) {
        const globalTabs = await resolveAllWindowTabs();
        preferredTabs = globalTabs.filter((tab) => scoreXhsTab(tab, preferredPage) === 0);
        xhsTabs = globalTabs;
    }
    if (preferredPage !== null && preferredTabs.length === 0) {
        return null;
    }
    const ranked = preferredTabs
        .filter((tab) => typeof tab.id === "number")
        .sort((left, right) => {
        const scoreDiff = scoreXhsTab(left, preferredPage) - scoreXhsTab(right, preferredPage);
        if (scoreDiff !== 0) {
            return scoreDiff;
        }
        if (left.active === right.active) {
            return 0;
        }
        return left.active ? -1 : 1;
    });
    const candidate = ranked[0];
    return typeof candidate?.id === "number" ? candidate.id : null;
};
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const resolveFingerprintContext = (commandParams) => {
    const direct = resolveAttestedFingerprintRuntimeContext(commandParams.fingerprint_context) ??
        resolveAttestedFingerprintRuntimeContext(commandParams.fingerprint_runtime);
    const context = direct;
    return context ? { ...context } : null;
};
const resolveAttestedFingerprintRuntimeContext = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const injection = asRecord(record.injection);
    const cloneWithInjection = (runtime) => injection
        ? {
            ...runtime,
            injection: JSON.parse(JSON.stringify(injection))
        }
        : { ...runtime };
    const direct = ensureFingerprintRuntimeContext(record);
    if (direct) {
        return cloneWithInjection(direct);
    }
    const sanitized = { ...record };
    delete sanitized.injection;
    const normalized = ensureFingerprintRuntimeContext(sanitized);
    if (normalized) {
        return cloneWithInjection(normalized);
    }
    return null;
};
const hasSuccessfulExecutionAttestation = (payload) => {
    const startupTrust = asRecord(payload.startup_fingerprint_trust);
    if (startupTrust?.bootstrap_attested === true) {
        return true;
    }
    const fingerprintRuntime = asRecord(payload.fingerprint_runtime);
    const injection = asRecord(fingerprintRuntime?.injection);
    if (!injection || injection.installed !== true) {
        return false;
    }
    return asStringArray(injection.missing_required_patches).length === 0;
};
const asNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const asInteger = (value) => typeof value === "number" && Number.isInteger(value) ? value : null;
const asBoolean = (value) => value === true;
const asOptionalBoolean = (value) => {
    if (value === true) {
        return true;
    }
    if (value === false) {
        return false;
    }
    return null;
};
const cloneAdmissionContext = (admissionContext) => {
    const normalizedAdmissionContext = asRecord(admissionContext);
    if (!normalizedAdmissionContext) {
        return null;
    }
    const approvalEvidence = asRecord(normalizedAdmissionContext.approval_admission_evidence);
    const auditEvidence = asRecord(normalizedAdmissionContext.audit_admission_evidence);
    return {
        ...(approvalEvidence ? { approval_admission_evidence: { ...approvalEvidence } } : {}),
        ...(auditEvidence ? { audit_admission_evidence: { ...auditEvidence } } : {})
    };
};
const bindAdmissionContextToRequest = (input) => {
    const admissionContext = cloneAdmissionContext(input.admissionContext);
    if (!admissionContext) {
        return null;
    }
    const sessionId = asNonEmptyString(input.sessionId);
    if (!sessionId) {
        return admissionContext;
    }
    const approvalEvidence = asRecord(admissionContext.approval_admission_evidence);
    const auditEvidence = asRecord(admissionContext.audit_admission_evidence);
    return {
        ...(approvalEvidence
            ? {
                approval_admission_evidence: {
                    ...approvalEvidence,
                    session_id: sessionId
                }
            }
            : {}),
        ...(auditEvidence
            ? {
                audit_admission_evidence: {
                    ...auditEvidence,
                    session_id: sessionId
                }
            }
            : {})
    };
};
const normalizeIssue209AdmissionDraft = (admissionDraft) => {
    const draft = asRecord(admissionDraft);
    if (!draft) {
        return null;
    }
    if (draft.kind === "missing") {
        return { kind: "missing" };
    }
    if (draft.kind !== "draft" && draft.kind !== "explicit_context" && draft.kind !== "derived_draft") {
        return null;
    }
    const admissionContext = cloneAdmissionContext(asRecord(draft.admission_context));
    if (!admissionContext) {
        return null;
    }
    return {
        kind: "draft",
        admission_context: admissionContext
    };
};
const bindXhsCommandParamsToSession = (input) => {
    const sessionId = asNonEmptyString(input.sessionId);
    if (!sessionId) {
        return input.commandParams;
    }
    const normalized = { ...input.commandParams };
    const normalizedOptions = asRecord(input.commandParams.options)
        ? { ...asRecord(input.commandParams.options) }
        : null;
    const admissionContext = bindAdmissionContextToRequest({
        admissionContext: asRecord(input.commandParams.admission_context) ??
            asRecord(normalizedOptions?.admission_context),
        sessionId
    });
    if (admissionContext) {
        normalized.admission_context = admissionContext;
        if (normalizedOptions) {
            normalizedOptions.admission_context = admissionContext;
        }
        else {
            normalized.options = {
                admission_context: admissionContext
            };
        }
    }
    if (normalizedOptions) {
        normalized.options = normalizedOptions;
    }
    return normalized;
};
const emitCliInvalidArgs = (emit, request, error) => {
    emit({
        id: request.id,
        status: "error",
        summary: {
            relay_path: "host>background"
        },
        payload: error.details ? { details: error.details } : undefined,
        error: {
            code: error.code,
            message: error.message
        }
    });
};
const parseUrl = (value, base) => {
    try {
        return base ? new URL(value, base) : new URL(value);
    }
    catch {
        return null;
    }
};
const buildXhsSearchResultUrl = (query) => {
    const url = new URL("/search_result", `https://${XHS_READ_DOMAIN}`);
    url.searchParams.set("keyword", query);
    url.searchParams.set("type", "51");
    return url.toString();
};
const normalizeXhsRestoreSearchUrl = (value) => {
    if (!value) {
        return null;
    }
    const url = parseUrl(value);
    if (!url || url.protocol !== "https:" || url.hostname !== XHS_READ_DOMAIN) {
        return null;
    }
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (pathname !== "/search_result") {
        return null;
    }
    const normalized = new URL("/search_result", `https://${XHS_READ_DOMAIN}`);
    const entries = Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey));
    for (const [key, entryValue] of entries) {
        normalized.searchParams.append(key, entryValue);
    }
    return normalized.toString();
};
const xhsRestoreSearchUrlsMatch = (observedUrl, targetUrl) => {
    const observed = normalizeXhsRestoreSearchUrl(observedUrl);
    const target = normalizeXhsRestoreSearchUrl(targetUrl);
    return observed !== null && target !== null && observed === target;
};
const buildObservedRuntimeInstanceId = (input) => `${input.sessionId}:${input.runId}:${input.runtimeContextId}`;
const isRestoreTargetTabNotFoundError = (error) => {
    const message = error instanceof Error ? error.message : String(error);
    return /(?:no tab with id|tab not found)/i.test(message);
};
const isRestoreSafetyGateAllowed = (value, profile, runId, sessionId, targetDomain, targetPage, targetTabId, targetUrl, actionRef) => {
    const rhythmState = asNonEmptyString(value?.xhs_closeout_rhythm_state);
    const recoveryProbeWindow = value?.recovery_probe_window === true;
    const runtimeContextId = asNonEmptyString(value?.runtime_context_id);
    const directRuntimeReady = value?.identity_binding_state === "bound" &&
        value.transport_state === "ready" &&
        value.bootstrap_state === "ready" &&
        value.runtime_readiness === "ready";
    const attachedRuntimeReady = value?.restore_runtime_attach_state === "attached_existing_runtime" &&
        value.identity_binding_state === "bound" &&
        value.transport_state === "ready";
    const staleBootstrapSameRuntimeReady = value?.restore_runtime_attach_state === "stale_bootstrap_same_runtime" &&
        value.stale_bootstrap_recovery === true &&
        value.managed_target_tab_id === targetTabId &&
        value.target_tab_continuity === "stale_bootstrap_current_managed_tab" &&
        value.identity_binding_state === "bound" &&
        value.transport_state === "ready" &&
        value.bootstrap_state === "stale" &&
        (value.runtime_readiness === "blocked" || value.runtime_readiness === "recoverable");
    const validationAllowsRestore = staleBootstrapSameRuntimeReady
        ? value?.anti_detection_validation_ready === true
        : recoveryProbeWindow || value?.anti_detection_validation_ready === true;
    return (value?.source === "cli_persisted_runtime_gate" &&
        value.profile_ref === profile &&
        value.run_id === runId &&
        runtimeContextId !== null &&
        value.session_id === sessionId &&
        value.target_domain === targetDomain &&
        value.target_page === targetPage &&
        value.target_tab_id === targetTabId &&
        value.target_url === targetUrl &&
        value.action_ref === actionRef &&
        value.account_safety_state === "clear" &&
        value.official_runtime_ready === true &&
        (directRuntimeReady || attachedRuntimeReady || staleBootstrapSameRuntimeReady) &&
        value.execution_surface === "real_browser" &&
        value.headless === false &&
        (rhythmState === "not_required" ||
            rhythmState === "single_probe_passed" ||
            rhythmState === "single_probe_required") &&
        validationAllowsRestore);
};
const isManagedTabBindingGateAllowed = (value, profile, runId, sessionId, targetDomain, targetPage, targetTabId, actionRef) => profile !== null &&
    value?.source === "cli_persisted_runtime_gate" &&
    value.purpose === "xhs_closeout_validation_source" &&
    value.profile_ref === profile &&
    value.run_id === runId &&
    value.session_id === sessionId &&
    value.target_domain === targetDomain &&
    value.target_page === targetPage &&
    value.target_tab_id === targetTabId &&
    value.action_ref === actionRef &&
    value.active_fetch_performed === false &&
    value.closeout_bundle_entered === false;
const buildChromeUrlPatternForDomain = (value) => {
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
        return null;
    }
    const parsed = parseUrl(`https://${normalized}/`);
    if (!parsed || parsed.hostname !== normalized) {
        return null;
    }
    return `*://${normalized}/*`;
};
const classifyXhsPage = (url, domain) => {
    const parsed = parseUrl(url);
    if (!parsed) {
        return "unknown_tab";
    }
    const pathname = parsed.pathname;
    if (domain === XHS_READ_DOMAIN) {
        if (isXhsSearchResultDetailPath(pathname)) {
            return "explore_detail_tab";
        }
        if (pathname.includes("/search_result")) {
            return "search_result_tab";
        }
        if (isXhsDetailLikePath(pathname)) {
            return "explore_detail_tab";
        }
        if (pathname.includes("/user/profile/")) {
            return "profile_tab";
        }
        if (pathname.includes("/home")) {
            return "home_tab";
        }
        return "read_unknown_tab";
    }
    if (pathname.includes("/publish")) {
        return "creator_publish_tab";
    }
    return "creator_home_tab";
};
const isCreatorArticlePublishPage = (url, domain) => {
    if (domain !== XHS_WRITE_DOMAIN) {
        return false;
    }
    const parsed = parseUrl(url);
    if (!parsed || !parsed.pathname.includes("/publish")) {
        return false;
    }
    return parsed.searchParams.get("target") === "article";
};
const xhsGateReasonMessage = (reason) => {
    const mapping = {
        REQUESTED_EXECUTION_MODE_NOT_EXPLICIT: "requested_execution_mode must be explicit",
        LIVE_EXECUTION_MODE_BLOCKED_BY_BACKGROUND_GATE: "live execution mode is blocked by background target gate",
        ISSUE_ACTION_BLOCKED_BY_STATE_MATRIX: "requested action is blocked by issue/state matrix",
        ISSUE_ACTION_MATRIX_BLOCKED: "requested action is blocked by issue/state matrix",
        TARGET_DOMAIN_NOT_EXPLICIT: "target domain must be explicit",
        TARGET_DOMAIN_OUT_OF_SCOPE: "target domain is out of xhs read/write scope",
        TARGET_TAB_NOT_EXPLICIT: "target tab is not explicit",
        TARGET_PAGE_NOT_EXPLICIT: "target page is not explicit",
        ACTION_DOMAIN_MISMATCH: "read action cannot target write domain",
        EXECUTION_MODE_UNSUPPORTED_FOR_COMMAND: "execution mode is unsupported for xhs read commands",
        EDITOR_INPUT_VALIDATION_REQUIRED: "issue_208 live_write requires editor_input validation scope",
        TARGET_PAGE_ARTICLE_REQUIRED: "issue_208 editor_input only supports article publish target",
        WRITE_EXECUTION_GATE_ONLY: "write gate approved but execution remains gate-only",
        RISK_STATE_PAUSED: "risk state paused blocks live read",
        RISK_STATE_LIMITED: "risk state limited blocks high-risk live read",
        MANUAL_CONFIRMATION_MISSING: "manual confirmation is required for live mode",
        APPROVAL_CHECKS_INCOMPLETE: "approval checks are incomplete",
        AUDIT_RECORD_MISSING: "audit admission evidence is required for live mode",
        LIMITED_READ_ROLLOUT_NOT_READY: "limited read rollout readiness is not satisfied",
        FINGERPRINT_CONTEXT_MISSING: "fingerprint context is required for live execution",
        FINGERPRINT_CONTEXT_UNTRUSTED: "fingerprint context is not trusted for current run/profile",
        TARGET_TAB_NOT_FOUND: "target tab is unavailable",
        TARGET_DOMAIN_MISMATCH: "target tab domain does not match target_domain",
        TARGET_PAGE_MISMATCH: "target tab page does not match target_page",
        TARGET_PAGE_CONTEXT_UNRESOLVED: "target page context could not be resolved",
        TARGET_TAB_URL_INVALID: "target tab url is invalid",
        FINGERPRINT_EXECUTION_BLOCKED: "fingerprint runtime blocks live execution for this profile"
    };
    return mapping[reason] ?? "xhs target gate blocked";
};
const parseRequestedExecutionMode = (value) => typeof value === "string" && XHS_EXECUTION_MODES.has(value)
    ? value
    : null;
const parseActionType = (value) => typeof value === "string" && XHS_ACTION_TYPES.has(value)
    ? value
    : null;
const resolveRiskState = (value) => resolveSharedRiskState(value);
const resolveIssueScope = (value) => resolveSharedIssueScope(value);
const normalizeApprovalRecord = (value) => {
    const approval = asRecord(value);
    const checks = asRecord(approval?.checks);
    return {
        approved: asBoolean(approval?.approved),
        approver: asNonEmptyString(approval?.approver),
        approved_at: asNonEmptyString(approval?.approved_at),
        checks: Object.fromEntries(XHS_REQUIRED_APPROVAL_CHECKS.map((key) => [key, asBoolean(checks?.[key])]))
    };
};
const resolveIssueActionMatrixEntry = (issueScope, state) => {
    return getIssueActionMatrixEntry(issueScope, state);
};
const resolveWriteMatrixDecision = (output, state) => output.decisions.find((entry) => entry.state === state) ?? {
    state,
    decision: "blocked",
    requires: []
};
const resolveApprovalRequirementGaps = (requirements, approvalRecord) => {
    const gaps = [];
    for (const requirement of requirements) {
        if (requirement === "approval_record_approved_true") {
            if (!approvalRecord.approved) {
                gaps.push(requirement);
            }
            continue;
        }
        if (requirement === "approval_record_approver_present") {
            if (!approvalRecord.approver) {
                gaps.push(requirement);
            }
            continue;
        }
        if (requirement === "approval_record_approved_at_present") {
            if (!approvalRecord.approved_at) {
                gaps.push(requirement);
            }
            continue;
        }
        if (requirement === "approval_record_checks_all_true") {
            const allChecksComplete = XHS_REQUIRED_APPROVAL_CHECKS.every((key) => approvalRecord.checks[key]);
            if (!allChecksComplete) {
                gaps.push(requirement);
            }
            continue;
        }
        gaps.push(requirement);
    }
    return gaps;
};
const resolveBlockedFallbackMode = (requestedExecutionMode, riskState) => requestedExecutionMode === "recon"
    ? "recon"
    : requestedExecutionMode === "live_write"
        ? "dry_run"
        : riskState === "limited"
            ? "recon"
            : "dry_run";
const readXhsGateParam = (commandParams, key) => {
    if (Object.prototype.hasOwnProperty.call(commandParams, key)) {
        return commandParams[key];
    }
    return asRecord(commandParams.options)?.[key];
};
const XHS_FORWARD_OPTION_KEYS = [
    "issue_scope",
    "target_domain",
    "target_tab_id",
    "target_page",
    "action_type",
    "requested_execution_mode",
    "risk_state",
    "validation_action",
    "validation_text",
    "editor_focus_attestation",
    "approval_record",
    "audit_record",
    "admission_context",
    "upstream_authorization_request",
    "__legacy_requested_execution_mode",
    "__runtime_profile_ref",
    "__runtime_latest_head_sha",
    "__anonymous_isolation_verified",
    "target_site_logged_in",
    "approval",
    "limited_read_rollout_ready_true",
    "xhs_recovery_probe",
    "timeout_ms",
    "simulate_result",
    "x_s_common"
];
const normalizeXhsSearchCommandParams = (commandParams, resolvedTargetTabId) => {
    const normalized = {
        ...commandParams
    };
    const optionParams = asRecord(commandParams.options);
    const normalizedOptions = optionParams ? { ...optionParams } : {};
    for (const key of XHS_FORWARD_OPTION_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(normalizedOptions, key) &&
            Object.prototype.hasOwnProperty.call(commandParams, key)) {
            normalizedOptions[key] = commandParams[key];
        }
    }
    if (typeof resolvedTargetTabId === "number" && Number.isInteger(resolvedTargetTabId)) {
        normalized.target_tab_id = resolvedTargetTabId;
        normalizedOptions.target_tab_id = resolvedTargetTabId;
    }
    if (Object.keys(normalizedOptions).length > 0) {
        normalized.options = normalizedOptions;
    }
    return normalized;
};
const applyCanonicalXhsForwardCommandParams = (input) => {
    const normalized = { ...input.commandParams };
    const optionParams = asRecord(input.commandParams.options);
    const normalizedOptions = optionParams ? { ...optionParams } : {};
    if (input.requestedExecutionMode !== null) {
        normalized.requested_execution_mode = input.requestedExecutionMode;
        normalizedOptions.requested_execution_mode = input.requestedExecutionMode;
    }
    if (input.legacyRequestedExecutionMode !== null) {
        normalized.__legacy_requested_execution_mode = input.legacyRequestedExecutionMode;
        normalizedOptions.__legacy_requested_execution_mode = input.legacyRequestedExecutionMode;
    }
    if (input.upstreamAuthorizationRequest !== null) {
        normalized.upstream_authorization_request = input.upstreamAuthorizationRequest;
        normalizedOptions.upstream_authorization_request = input.upstreamAuthorizationRequest;
    }
    if (input.approvalRecord) {
        const clonedApprovalRecord = {
            ...input.approvalRecord,
            checks: { ...input.approvalRecord.checks }
        };
        normalized.approval_record = clonedApprovalRecord;
        normalizedOptions.approval_record = clonedApprovalRecord;
    }
    if (input.admissionContext) {
        const clonedAdmissionContext = cloneAdmissionContext(input.admissionContext);
        if (clonedAdmissionContext) {
            normalized.admission_context = clonedAdmissionContext;
            normalizedOptions.admission_context = clonedAdmissionContext;
        }
    }
    if (Object.keys(normalizedOptions).length > 0) {
        normalized.options = normalizedOptions;
    }
    return normalized;
};
const resolveDispatchXhsForwardState = (command, commandParams) => {
    const optionParams = asRecord(commandParams.options);
    const readParam = (key) => {
        if (Object.prototype.hasOwnProperty.call(commandParams, key)) {
            return commandParams[key];
        }
        return optionParams?.[key];
    };
    const validationAction = asNonEmptyString(readParam("validation_action"));
    const issueScope = asNonEmptyString(readParam("issue_scope"));
    const requestedExecutionMode = parseRequestedExecutionMode(readParam("requested_execution_mode"));
    return {
        validationAction,
        issueScope,
        requestedExecutionMode,
        issue208EditorInputValidation: XHS_GATE_COMMANDS.has(command) &&
            issueScope === "issue_208" &&
            requestedExecutionMode === "live_write" &&
            validationAction === "editor_input",
        requestedFingerprintContext: resolveFingerprintContext(commandParams)
    };
};
const resolveXhsGateCommandInput = (input) => {
    const commandParams = normalizeXhsSearchCommandParams(input);
    const abilityParams = asRecord(commandParams.ability);
    const optionParams = asRecord(commandParams.options);
    const readGateParam = (key) => {
        if (Object.prototype.hasOwnProperty.call(commandParams, key)) {
            return commandParams[key];
        }
        return optionParams?.[key];
    };
    return {
        commandParams,
        gateInvocationId: asNonEmptyString(commandParams.gate_invocation_id),
        targetDomain: asNonEmptyString(readGateParam("target_domain")),
        targetTabId: asInteger(readGateParam("target_tab_id")),
        targetPage: asNonEmptyString(readGateParam("target_page")),
        issueScope: resolveIssueScope(readGateParam("issue_scope")),
        riskState: resolveRiskState(readGateParam("risk_state")),
        actionType: resolveXhsActionType(readGateParam("action_type")),
        abilityActionType: resolveXhsActionType(abilityParams?.action),
        requestedExecutionMode: resolveXhsExecutionMode(readGateParam("requested_execution_mode")),
        approvalRecord: normalizeXhsApprovalRecord(readGateParam("approval_record") ?? readGateParam("approval")),
        auditRecord: asRecord(readGateParam("audit_record")),
        admissionContext: asRecord(readGateParam("admission_context")),
        admissionDraft: asRecord(readGateParam("__issue209_admission_draft")),
        upstreamAuthorizationRequest: asRecord(readGateParam("upstream_authorization_request")),
        legacyRequestedExecutionMode: resolveXhsExecutionMode(readGateParam("__legacy_requested_execution_mode")),
        runtimeProfileRef: asNonEmptyString(readGateParam("__runtime_profile_ref")),
        sessionRhythmWindowId: asNonEmptyString(readGateParam("__session_rhythm_window_id")),
        sessionRhythmDecisionId: asNonEmptyString(readGateParam("__session_rhythm_decision_id")),
        anonymousIsolationVerified: asOptionalBoolean(readGateParam("__anonymous_isolation_verified")),
        targetSiteLoggedIn: asOptionalBoolean(readGateParam("target_site_logged_in")),
        limitedReadRolloutReadyTrue: readGateParam("limited_read_rollout_ready_true") === true,
        validationAction: asNonEmptyString(readGateParam("validation_action")),
        requestedFingerprintContext: resolveFingerprintContext(commandParams)
    };
};
const shouldDeferAnonymousCanonicalGateDiagnostics = (input) => {
    const resourceBinding = asRecord(input.upstreamAuthorizationRequest?.resource_binding);
    return (resourceBinding?.resource_kind === "anonymous_context" &&
        (input.anonymousIsolationVerified === null || input.targetSiteLoggedIn === null));
};
const bindIssue209AdmissionArtifactsToRequest = (input) => {
    const isIssue209LiveRead = input.issueScope === "issue_209" &&
        (input.requestedExecutionMode === "live_read_limited" ||
            input.requestedExecutionMode === "live_read_high_risk");
    if (!isIssue209LiveRead) {
        return bindAdmissionContextToRequest({
            admissionContext: input.admissionContext,
            sessionId: input.sessionId
        });
    }
    const explicitAdmissionContext = bindAdmissionContextToRequest({
        admissionContext: input.admissionContext,
        sessionId: input.sessionId
    });
    if (explicitAdmissionContext) {
        return explicitAdmissionContext;
    }
    const normalizedDraft = normalizeIssue209AdmissionDraft(input.admissionDraft);
    if (!normalizedDraft || normalizedDraft.kind === "missing") {
        return null;
    }
    return bindAdmissionContextToRequest({
        admissionContext: asRecord(normalizedDraft.admission_context),
        sessionId: input.sessionId
    });
};
const resolveBridgeRequestGateDecisionId = (request) => {
    const runId = String(request.params.run_id ?? request.id);
    const commandParams = asRecord(request.params.command_params);
    const optionParams = asRecord(commandParams?.options);
    const readGateParam = (key) => {
        if (commandParams && Object.prototype.hasOwnProperty.call(commandParams, key)) {
            return commandParams[key];
        }
        return optionParams?.[key];
    };
    return resolveXhsGateDecisionId({
        runId,
        requestId: request.id,
        commandRequestId: commandParams?.request_id,
        gateInvocationId: asNonEmptyString(commandParams?.gate_invocation_id),
        issueScope: readGateParam("issue_scope"),
        requestedExecutionMode: readGateParam("requested_execution_mode")
    });
};
const buildCanonicalGateAuditArtifacts = (input) => {
    const commandParams = asRecord(input.request.params.command_params);
    const canonicalGate = evaluateXhsGate({
        issueScope: input.issueScope,
        riskState: input.riskState,
        targetDomain: input.targetDomain,
        targetTabId: input.targetTabId,
        targetPage: input.targetPage,
        actualTargetDomain: input.actualTargetDomain,
        actualTargetTabId: input.actualTargetTabId,
        actualTargetPage: input.actualTargetPage,
        actualTargetUrl: input.actualTargetUrl,
        requireActualTargetPage: true,
        actionType: input.actionType,
        abilityActionType: input.abilityActionType,
        requestedExecutionMode: input.requestedExecutionMode,
        legacyRequestedExecutionMode: input.legacyRequestedExecutionMode,
        runtimeProfileRef: input.runtimeProfileRef,
        sessionRhythmWindowId: input.sessionRhythmWindowId,
        sessionRhythmDecisionId: input.sessionRhythmDecisionId,
        upstreamAuthorizationRequest: input.upstreamAuthorizationRequest,
        ...(input.anonymousIsolationVerified !== null
            ? { anonymousIsolationVerified: input.anonymousIsolationVerified }
            : {}),
        ...(input.targetSiteLoggedIn !== null ? { targetSiteLoggedIn: input.targetSiteLoggedIn } : {}),
        runId: String(input.request.params.run_id ?? input.request.id),
        sessionId: String(input.request.params.session_id ?? "nm-session-001"),
        requestId: input.request.id,
        commandRequestId: commandParams?.request_id,
        gateInvocationId: input.gateInvocationId,
        approvalRecord: input.approvalRecord,
        auditRecord: input.auditRecord,
        admissionContext: input.admissionContext,
        limitedReadRolloutReadyTrue: input.limitedReadRolloutReadyTrue,
        decisionId: resolveBridgeRequestGateDecisionId(input.request),
        approvalId: resolveGatePayloadApprovalId({
            approvalActive: input.requestedExecutionMode === "live_read_limited" ||
                input.requestedExecutionMode === "live_read_high_risk" ||
                input.requestedExecutionMode === "live_write",
            approvalRecord: input.approvalRecord,
            decisionId: resolveBridgeRequestGateDecisionId(input.request),
            issueScope: input.issueScope,
            requestedExecutionMode: input.requestedExecutionMode,
            gateInvocationId: input.gateInvocationId ?? asNonEmptyString(commandParams?.gate_invocation_id)
        }),
        issue208EditorInputValidation: input.issue208EditorInputValidation,
        treatMissingEditorValidationAsUnsupported: true
    });
    if (shouldDeferAnonymousCanonicalGateDiagnostics({
        upstreamAuthorizationRequest: input.upstreamAuthorizationRequest,
        anonymousIsolationVerified: input.anonymousIsolationVerified,
        targetSiteLoggedIn: input.targetSiteLoggedIn
    })) {
        return {
            ...canonicalGate,
            request_admission_result: null,
            execution_audit: null
        };
    }
    return canonicalGate;
};
const resolveGateOnlyPageState = (gateInput, scopeContext) => {
    const targetPage = asNonEmptyString(gateInput.target_page);
    const targetDomain = asNonEmptyString(gateInput.target_domain) ??
        asNonEmptyString(scopeContext.write_domain) ??
        asNonEmptyString(scopeContext.read_domain);
    if (!targetPage || !targetDomain) {
        return null;
    }
    return {
        page_kind: targetPage === "creator_publish_tab"
            ? "compose"
            : targetPage === "explore_detail_tab"
                ? "detail"
                : targetPage === "profile_tab"
                    ? "user_home"
                    : targetPage,
        url: targetPage === "creator_publish_tab"
            ? `https://${targetDomain}/publish/publish`
            : targetPage === "search_result_tab"
                ? `https://${targetDomain}/search_result`
                : targetPage === "explore_detail_tab"
                    ? `https://${targetDomain}/explore/note-id`
                    : targetPage === "profile_tab"
                        ? `https://${targetDomain}/user/profile/user-id`
                        : `https://${targetDomain}/`,
        title: targetPage === "creator_publish_tab"
            ? "Creator Publish"
            : targetPage === "explore_detail_tab"
                ? "Detail"
                : targetPage === "profile_tab"
                    ? "User Home"
                    : "Search Result",
        ready_state: "complete"
    };
};
const buildGateOnlyObservability = (gatePayload) => {
    const gateInput = asRecord(gatePayload.gate_input) ?? {};
    const gateOutcome = asRecord(gatePayload.gate_outcome) ?? {};
    const scopeContext = asRecord(gatePayload.scope_context) ?? {};
    const gateReasons = asStringArray(gateOutcome.gate_reasons);
    return {
        page_state: resolveGateOnlyPageState(gateInput, scopeContext),
        key_requests: [],
        failure_site: gateOutcome.gate_decision === "blocked"
            ? {
                stage: "execution",
                component: "gate",
                target: asNonEmptyString(gateInput.target_page) ??
                    asNonEmptyString(gateInput.target_domain) ??
                    "issue_208_gate_only",
                summary: gateReasons[0] ?? "gate blocked"
            }
            : null
    };
};
const resolveGatePayloadApprovalId = (input) => {
    if (input.issueScope === "issue_209" &&
        (input.requestedExecutionMode === "live_read_limited" ||
            input.requestedExecutionMode === "live_read_high_risk")) {
        return resolveXhsGateApprovalId({
            decisionId: input.decisionId,
            gateInvocationId: input.gateInvocationId,
            issueScope: input.issueScope,
            requestedExecutionMode: input.requestedExecutionMode
        });
    }
    if (!input.approvalActive || !isApprovalRecordComplete(input.approvalRecord)) {
        return null;
    }
    const approvalDecisionId = asNonEmptyString(input.approvalRecord.decision_id);
    if (approvalDecisionId && approvalDecisionId !== input.decisionId) {
        return resolveXhsGateApprovalId({
            decisionId: input.decisionId,
            approvalRecord: {
                ...input.approvalRecord,
                decision_id: input.decisionId,
                approval_id: null
            }
        });
    }
    return resolveXhsGateApprovalId({
        decisionId: input.decisionId,
        approvalRecord: input.approvalRecord,
        approvalId: input.approvalRecord.approval_id
    });
};
const isIssue209LiveReadPayload = (input) => input.issueScope === "issue_209" &&
    (input.requestedExecutionMode === "live_read_limited" ||
        input.requestedExecutionMode === "live_read_high_risk");
const buildIssue209GatePayloadArtifacts = (input) => {
    if (!isIssue209LiveReadPayload(input)) {
        return null;
    }
    const issue209Gate = {
        gate_input: {
            issue_scope: "issue_209",
            target_domain: input.targetDomain,
            target_tab_id: input.targetTabId,
            target_page: input.targetPage,
            action_type: input.actionType,
            requested_execution_mode: input.requestedExecutionMode,
            risk_state: input.riskState,
            admission_context: cloneAdmissionContext(input.admissionContext ?? null)
        },
        gate_outcome: {
            decision_id: input.decisionId,
            effective_execution_mode: input.effectiveExecutionMode,
            gate_decision: input.gateDecision,
            gate_reasons: input.gateReasons,
            requires_manual_confirmation: input.requiresManualConfirmation
        },
        consumer_gate_result: {
            issue_scope: "issue_209",
            target_domain: input.targetDomain,
            target_tab_id: input.targetTabId,
            target_page: input.targetPage,
            action_type: input.actionType,
            requested_execution_mode: input.requestedExecutionMode,
            effective_execution_mode: input.effectiveExecutionMode,
            gate_decision: input.gateDecision,
            gate_reasons: input.gateReasons,
            write_interaction_tier: input.writeActionMatrixDecisions?.write_interaction_tier ?? null
        },
        approval_record: {
            ...input.approvalRecord,
            approval_id: input.approvalRecord.approval_id ?? null,
            decision_id: input.approvalRecord.decision_id ?? null
        },
        write_action_matrix_decisions: input.writeActionMatrixDecisions
    };
    const artifacts = buildIssue209PostGateArtifacts({
        runId: input.runId,
        sessionId: input.sessionId,
        profile: input.profile,
        gate: issue209Gate,
        now: () => Date.now()
    });
    return {
        approvalRecord: artifacts.approval_record,
        auditRecord: artifacts.audit_record
    };
};
const createBridgeXhsGateOnlyPayload = (request, gatePayload) => {
    const commandParams = asRecord(request.params.command_params) ?? {};
    const ability = asRecord(commandParams.ability) ?? {};
    const input = asRecord(commandParams.input) ?? {};
    const consumerGateResult = asRecord(gatePayload.consumer_gate_result) ?? {};
    const command = typeof request.params.command === "string" ? request.params.command : null;
    let normalizedInput = input;
    if (command && XHS_GATE_COMMANDS.has(command)) {
        try {
            normalizedInput = validateXhsCommandInputForExtension({
                command,
                abilityId: asNonEmptyString(ability.id) ?? "unknown",
                abilityAction: (asNonEmptyString(ability.action) ?? "read"),
                payload: input,
                options: asRecord(commandParams.options) ?? {}
            });
        }
        catch {
            normalizedInput = input;
        }
    }
    const dataRef = command === "xhs.detail"
        ? {
            note_id: String(normalizedInput.note_id ?? "")
        }
        : command === "xhs.user_home"
            ? {
                user_id: String(normalizedInput.user_id ?? "")
            }
            : {
                query: String(normalizedInput.query ?? "")
            };
    const capabilityResult = {
        ability_id: String(ability.id ?? "xhs.note.search.v1"),
        layer: String(ability.layer ?? "L3"),
        action: String(consumerGateResult.action_type ?? "read"),
        outcome: "partial",
        data_ref: dataRef,
        metrics: {
            count: 0
        }
    };
    return {
        summary: {
            capability_result: capabilityResult,
            ...gatePayload
        },
        observability: buildGateOnlyObservability(gatePayload)
    };
};
const createRelayXhsGatePayload = (input) => {
    const recordedAt = new Date().toISOString();
    const runId = String(input.request.params.run_id ?? input.request.id);
    const sessionId = String(input.request.params.session_id ?? "nm-session-001");
    const profile = typeof input.request.profile === "string" ? input.request.profile : null;
    const decisionId = resolveBridgeRequestGateDecisionId(input.request);
    const approvalActive = input.gateDecision === "allowed" &&
        (input.effectiveExecutionMode === "live_read_limited" ||
            input.effectiveExecutionMode === "live_read_high_risk" ||
            input.effectiveExecutionMode === "live_write");
    const approvalId = resolveGatePayloadApprovalId({
        approvalActive,
        approvalRecord: input.approvalRecord,
        decisionId,
        issueScope: input.issueScope,
        requestedExecutionMode: input.requestedExecutionMode,
        gateInvocationId: asNonEmptyString(asRecord(input.request.params.command_params)?.gate_invocation_id)
    });
    const issue209Artifacts = buildIssue209GatePayloadArtifacts({
        runId,
        sessionId,
        profile,
        decisionId,
        issueScope: input.issueScope,
        riskState: input.riskState,
        targetDomain: input.targetDomain,
        targetTabId: input.targetTabId,
        targetPage: input.targetPage,
        actionType: input.actionType,
        requestedExecutionMode: input.requestedExecutionMode,
        effectiveExecutionMode: input.effectiveExecutionMode,
        gateDecision: input.gateDecision,
        gateReasons: input.gateReasons,
        requiresManualConfirmation: input.requiresManualConfirmation,
        approvalRecord: input.approvalRecord,
        admissionContext: input.admissionContext,
        consumerGateResult: input.consumerGateResult,
        writeActionMatrixDecisions: input.writeActionMatrixDecisions
    });
    const approvalRecord = issue209Artifacts?.approvalRecord ?? {
        ...input.approvalRecord,
        approval_id: approvalId,
        decision_id: decisionId
    };
    const auditRecord = issue209Artifacts?.auditRecord ?? {
        event_id: `relay_gate_${input.request.id}`,
        decision_id: decisionId,
        approval_id: approvalId,
        run_id: runId,
        session_id: sessionId,
        profile,
        issue_scope: input.issueScope,
        risk_state: input.riskState,
        target_domain: input.targetDomain,
        target_tab_id: input.targetTabId,
        target_page: input.targetPage,
        action_type: input.actionType,
        requested_execution_mode: input.requestedExecutionMode,
        effective_execution_mode: input.effectiveExecutionMode,
        gate_decision: input.gateDecision,
        gate_reasons: input.gateReasons,
        approver: approvalRecord.approver,
        approved_at: approvalRecord.approved_at,
        recorded_at: recordedAt,
        risk_signal: input.riskState !== "allowed",
        recovery_signal: false,
        session_rhythm_state: "normal",
        cooldown_until: null,
        recovery_started_at: null
    };
    return {
        plugin_gate_ownership: XHS_PLUGIN_GATE_OWNERSHIP,
        scope_context: XHS_SCOPE_CONTEXT,
        read_execution_policy: XHS_READ_EXECUTION_POLICY,
        gate_input: {
            run_id: runId,
            session_id: sessionId,
            profile,
            issue_scope: input.issueScope,
            target_domain: input.targetDomain,
            target_tab_id: input.targetTabId,
            target_page: input.targetPage,
            action_type: input.actionType,
            requested_execution_mode: input.requestedExecutionMode,
            risk_state: input.riskState,
            admission_context: input.admissionContext ?? null,
            fingerprint_gate_decision: "allowed"
        },
        gate_outcome: {
            decision_id: decisionId,
            effective_execution_mode: input.effectiveExecutionMode,
            gate_decision: input.gateDecision,
            gate_reasons: input.gateReasons,
            requires_manual_confirmation: input.requiresManualConfirmation,
            fingerprint_gate_decision: "allowed"
        },
        consumer_gate_result: input.consumerGateResult,
        approval_record: approvalRecord,
        issue_action_matrix: input.issueScope !== null
            ? resolveIssueActionMatrixEntry(input.issueScope, input.riskState)
            : null,
        write_interaction_tier: WRITE_INTERACTION_TIER,
        write_action_matrix_decisions: input.writeActionMatrixDecisions,
        ...(input.writeGateOnlyDecision
            ? { write_gate_only_decision: input.writeGateOnlyDecision }
            : {}),
        observability: buildGateOnlyObservability({
            gate_input: {
                target_domain: input.targetDomain,
                target_page: input.targetPage
            },
            gate_outcome: {
                gate_decision: input.gateDecision,
                gate_reasons: input.gateReasons
            },
            scope_context: XHS_SCOPE_CONTEXT
        }),
        audit_record: auditRecord
    };
};
const createBackgroundXhsGatePayload = (input) => {
    const runId = String(input.request.params.run_id ?? input.request.id);
    const sessionId = String(input.request.params.session_id ?? "nm-session-001");
    const profile = typeof input.request.profile === "string" ? input.request.profile : null;
    const recordedAt = new Date().toISOString();
    const decisionId = resolveBridgeRequestGateDecisionId(input.request);
    const approvalActive = input.gateDecision === "allowed" &&
        (input.effectiveExecutionMode === "live_read_limited" ||
            input.effectiveExecutionMode === "live_read_high_risk" ||
            input.effectiveExecutionMode === "live_write");
    const approvalId = resolveGatePayloadApprovalId({
        approvalActive,
        approvalRecord: input.approvalRecord,
        decisionId,
        issueScope: input.issueScope,
        requestedExecutionMode: input.requestedExecutionMode,
        gateInvocationId: asNonEmptyString(asRecord(input.request.params.command_params)?.gate_invocation_id)
    });
    const issue209Artifacts = buildIssue209GatePayloadArtifacts({
        runId,
        sessionId,
        profile,
        decisionId,
        issueScope: input.issueScope,
        riskState: input.riskState,
        targetDomain: input.targetDomain,
        targetTabId: input.targetTabId,
        targetPage: input.targetPage,
        actionType: input.actionType,
        requestedExecutionMode: input.requestedExecutionMode,
        effectiveExecutionMode: input.effectiveExecutionMode,
        gateDecision: input.gateDecision,
        gateReasons: input.gateReasons,
        requiresManualConfirmation: input.requiresManualConfirmation,
        approvalRecord: input.approvalRecord,
        admissionContext: input.admissionContext,
        consumerGateResult: input.consumerGateResult,
        writeActionMatrixDecisions: input.writeActionMatrixDecisions
    });
    const approvalRecord = issue209Artifacts?.approvalRecord ?? {
        ...input.approvalRecord,
        approval_id: approvalId,
        decision_id: decisionId
    };
    const auditRecord = issue209Artifacts?.auditRecord ?? {
        event_id: `bg_gate_${input.request.id}`,
        decision_id: decisionId,
        approval_id: approvalId,
        run_id: runId,
        session_id: sessionId,
        profile,
        issue_scope: input.issueScope,
        risk_state: input.riskState,
        target_domain: input.targetDomain,
        target_tab_id: input.targetTabId,
        target_page: input.targetPage,
        action_type: input.actionType,
        requested_execution_mode: input.requestedExecutionMode,
        effective_execution_mode: input.effectiveExecutionMode,
        gate_decision: input.gateDecision,
        gate_reasons: input.gateReasons,
        approver: approvalRecord.approver,
        approved_at: approvalRecord.approved_at,
        write_interaction_tier: input.writeActionMatrixDecisions?.write_interaction_tier ?? null,
        write_matrix_decision: input.writeMatrixDecision?.decision ?? null,
        recorded_at: recordedAt,
        next_state: input.riskTransitionAudit.next_state,
        transition_trigger: input.riskTransitionAudit.trigger
    };
    return {
        plugin_gate_ownership: XHS_PLUGIN_GATE_OWNERSHIP,
        scope_context: XHS_SCOPE_CONTEXT,
        read_execution_policy: XHS_READ_EXECUTION_POLICY,
        gate_input: {
            run_id: runId,
            session_id: sessionId,
            profile,
            issue_scope: input.issueScope,
            target_domain: input.targetDomain,
            target_tab_id: input.targetTabId,
            target_page: input.targetPage,
            action_type: input.actionType,
            requested_execution_mode: input.requestedExecutionMode,
            risk_state: input.riskState,
            admission_context: input.admissionContext ?? null,
            fingerprint_gate_decision: input.fingerprintGateDecision
        },
        gate_outcome: {
            decision_id: decisionId,
            effective_execution_mode: input.effectiveExecutionMode,
            gate_decision: input.gateDecision,
            gate_reasons: input.gateReasons,
            requires_manual_confirmation: input.requiresManualConfirmation,
            fingerprint_gate_decision: input.fingerprintGateDecision
        },
        fingerprint_execution: input.fingerprintExecution ? { ...input.fingerprintExecution } : null,
        consumer_gate_result: input.consumerGateResult,
        request_admission_result: input.requestAdmissionResult,
        approval_record: approvalRecord,
        issue_action_matrix: input.issueScope !== null
            ? resolveIssueActionMatrixEntry(input.issueScope, input.resolvedRiskState)
            : null,
        write_interaction_tier: WRITE_INTERACTION_TIER,
        write_action_matrix_decisions: input.writeActionMatrixDecisions,
        ...(input.writeGateOnlyDecision ? { write_gate_only_decision: input.writeGateOnlyDecision } : {}),
        risk_state_output: buildUnifiedRiskStateOutput(input.resolvedRiskState, {
            auditRecords: [auditRecord],
            now: asNonEmptyString(auditRecord.recorded_at) ?? recordedAt
        }),
        audit_record: auditRecord,
        execution_audit: input.executionAudit,
        risk_transition_audit: input.riskTransitionAudit
    };
};
const serializeFingerprintRuntimeContext = (fingerprintRuntime) => {
    const record = { ...fingerprintRuntime };
    delete record.injection;
    return JSON.stringify(record);
};
const hasInstalledFingerprintInjection = (fingerprintRuntime) => {
    if (!fingerprintRuntime) {
        return false;
    }
    const injection = asRecord(fingerprintRuntime.injection);
    return (injection?.installed === true &&
        asStringArray(injection.missing_required_patches).length === 0);
};
const isFingerprintRuntimeContextEquivalent = (left, right) => serializeFingerprintRuntimeContext(left) === serializeFingerprintRuntimeContext(right);
const TRUST_INVALIDATION_COMMANDS = new Set(["runtime.stop", "runtime.start", "runtime.login"]);
// Trust must come from startup trust bound to an allowlist page, not generic bridge commands.
const TRUST_PRIMING_COMMANDS = new Set(["runtime.ping"]);
export class BackgroundRelay extends ExtractedBackgroundRelay {
    constructor(contentScript, options) {
        super(contentScript, {
            ...options,
            readTimeoutMs,
            resolveFingerprintContext
        });
    }
}
class ChromeBackgroundBridge {
    chromeApi;
    options;
    #port = null;
    #pendingState = new NativeBridgePendingForwardState();
    #runtimeTrustState = new BackgroundRuntimeTrustState({
        serializeFingerprintRuntimeContext
    });
    #staleRestoreBindingLeases = new Map();
    #pendingMainWorldBridgeEnsures = new Map();
    #recoveryState;
    #heartbeatTimer = null;
    #heartbeatTimeout = null;
    #handshakeTimeout = null;
    #recoveryTimer = null;
    #recoveryDeadlineMs = null;
    #pendingHeartbeatId = null;
    #pendingHandshakeId = null;
    #sessionId = "nm-session-001";
    #heartbeatSeq = 0;
    #handshakeSeq = 0;
    #missedHeartbeatCount = 0;
    #state = "connecting";
    constructor(chromeApi, options) {
        this.chromeApi = chromeApi;
        this.options = options;
        this.#recoveryState = new NativeBridgeRecoveryState({
            getState: () => this.#state,
            emit: (message) => {
                this.#emit(message);
            }
        }, options);
    }
    start() {
        this.#connectNativePort();
        this.chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (this.#isXhsSignRequestMessage(message)) {
                void this.#handleXhsSignRequest(message, sender, sendResponse);
                return true;
            }
            if (this.#isXhsSearchDebuggerActionMessage(message)) {
                void this.#handleXhsSearchDebuggerAction(message, sender, sendResponse);
                return true;
            }
            if (this.#isXhsMainWorldRequestMessage(message)) {
                void this.#handleXhsMainWorldRequest(message, sender, sendResponse);
                return true;
            }
            this.#onContentScriptResult(message, sender);
            return undefined;
        });
        this.chromeApi.runtime.onInstalled?.addListener(() => this.#connectNativePort());
        this.chromeApi.runtime.onStartup?.addListener(() => this.#connectNativePort());
    }
    #connectNativePort() {
        if (this.#port && this.#state !== "recovering" && this.#state !== "disconnected") {
            return;
        }
        if (this.#port) {
            this.#disposeCurrentPort();
        }
        const hostName = this.options?.nativeHostName ?? defaultNativeHostName;
        const port = this.chromeApi.runtime.connectNative(hostName);
        this.#port = port;
        this.#state = "connecting";
        this.#missedHeartbeatCount = 0;
        this.#pendingHeartbeatId = null;
        this.#clearHeartbeatTimeout();
        this.#clearHandshakeTimeout();
        this.#pendingHandshakeId = null;
        port.onMessage.addListener((message) => {
            if (this.#port !== port) {
                return;
            }
            void this.#onNativeMessage(message);
        });
        port.onDisconnect.addListener(() => {
            if (this.#port !== port) {
                return;
            }
            const lastErrorMessage = typeof this.chromeApi.runtime.lastError?.message === "string" &&
                this.chromeApi.runtime.lastError.message.trim().length > 0
                ? this.chromeApi.runtime.lastError.message.trim()
                : null;
            this.#handleDisconnect(lastErrorMessage
                ? `native messaging disconnected: ${lastErrorMessage}`
                : "native messaging disconnected");
        });
        this.#sendHandshakeOpen(port);
    }
    #sendHandshakeOpen(port) {
        const timeoutMs = this.options?.handshakeTimeoutMs ?? defaultHandshakeTimeoutMs;
        const request = {
            id: this.#nextHandshakeId(),
            method: "bridge.open",
            profile: null,
            params: {
                protocol: bridgeProtocol,
                capabilities: ["relay", "heartbeat"]
            },
            timeout_ms: timeoutMs
        };
        this.#pendingHandshakeId = request.id;
        port.postMessage(request);
        this.#clearHandshakeTimeout();
        this.#handshakeTimeout = setTimeout(() => {
            if (this.#port !== port || this.#pendingHandshakeId !== request.id) {
                return;
            }
            this.#pendingHandshakeId = null;
            this.#handleDisconnect("handshake timeout");
        }, timeoutMs);
    }
    #startHeartbeatLoop() {
        if (this.#heartbeatTimer) {
            return;
        }
        const intervalMs = this.options?.heartbeatIntervalMs ?? 20_000;
        this.#heartbeatTimer = setInterval(() => {
            this.#sendHeartbeat();
        }, intervalMs);
    }
    #sendHeartbeat() {
        if (!this.#port || this.#state !== "ready") {
            return;
        }
        if (this.#pendingHeartbeatId) {
            return;
        }
        const timeoutMs = this.options?.heartbeatTimeoutMs ?? 5_000;
        const heartbeat = {
            id: this.#nextHeartbeatId(),
            method: "__ping__",
            profile: null,
            params: {
                session_id: this.#sessionId,
                timestamp: new Date().toISOString()
            },
            timeout_ms: timeoutMs
        };
        this.#pendingHeartbeatId = heartbeat.id;
        this.#port.postMessage(heartbeat);
        this.#clearHeartbeatTimeout();
        this.#heartbeatTimeout = setTimeout(() => {
            if (!this.#pendingHeartbeatId) {
                return;
            }
            this.#pendingHeartbeatId = null;
            this.#missedHeartbeatCount += 1;
            const maxMissed = this.options?.maxMissedHeartbeats ?? 2;
            if (this.#missedHeartbeatCount >= maxMissed) {
                this.#handleDisconnect("heartbeat timeout");
            }
        }, timeoutMs);
    }
    #stopHeartbeatLoop() {
        if (this.#heartbeatTimer) {
            clearInterval(this.#heartbeatTimer);
            this.#heartbeatTimer = null;
        }
        this.#clearHeartbeatTimeout();
        this.#pendingHeartbeatId = null;
        this.#missedHeartbeatCount = 0;
    }
    #handleDisconnect(message) {
        this.#stopHeartbeatLoop();
        this.#clearHandshakeTimeout();
        this.#pendingHandshakeId = null;
        this.#clearTrustedFingerprintContexts();
        this.#clearRuntimeBootstrapStates();
        this.#failAllPending({
            code: "ERR_TRANSPORT_DISCONNECTED",
            message
        });
        this.#disposeCurrentPort();
        this.#enterRecovery();
    }
    async #onNativeMessage(message) {
        const handshakeResponse = message;
        if (handshakeResponse &&
            typeof handshakeResponse.id === "string" &&
            handshakeResponse.id === this.#pendingHandshakeId &&
            (handshakeResponse.status === "success" || handshakeResponse.status === "error")) {
            this.#onHandshakeResponse(handshakeResponse);
            return;
        }
        const heartbeatAck = message;
        if (heartbeatAck &&
            typeof heartbeatAck.id === "string" &&
            heartbeatAck.id === this.#pendingHeartbeatId &&
            (heartbeatAck.method === "__ping__" ||
                heartbeatAck.method === "__pong__" ||
                heartbeatAck.status === "success")) {
            this.#pendingHeartbeatId = null;
            this.#missedHeartbeatCount = 0;
            this.#clearHeartbeatTimeout();
            return;
        }
        const request = message;
        await this.#onNativeRequest(request);
    }
    #onHandshakeResponse(response) {
        this.#clearHandshakeTimeout();
        this.#pendingHandshakeId = null;
        if (response.status !== "success") {
            const message = response.error?.message ?? "handshake failed";
            this.#handleDisconnect(`handshake failed: ${message}`);
            return;
        }
        const protocol = typeof response.summary.protocol === "string" ? response.summary.protocol : null;
        if (protocol !== bridgeProtocol) {
            this.#handleDisconnect(`incompatible protocol: ${protocol ?? "unknown"}`);
            return;
        }
        const prevSessionId = this.#sessionId;
        const sessionId = typeof response.summary.session_id === "string" && response.summary.session_id.length > 0
            ? response.summary.session_id
            : this.#sessionId;
        this.#sessionId = sessionId;
        if (sessionId !== prevSessionId) {
            this.#clearTrustedFingerprintContexts();
            this.#clearRuntimeBootstrapStates();
        }
        this.#state = "ready";
        this.#recoveryDeadlineMs = null;
        this.#stopRecoveryLoop();
        this.#startHeartbeatLoop();
        void this.#recoveryState.replayQueuedForwards((request, deadlineMs) => this.#dispatchForward(request, deadlineMs));
    }
    #clearHeartbeatTimeout() {
        if (!this.#heartbeatTimeout) {
            return;
        }
        clearTimeout(this.#heartbeatTimeout);
        this.#heartbeatTimeout = null;
    }
    #clearHandshakeTimeout() {
        if (!this.#handshakeTimeout) {
            return;
        }
        clearTimeout(this.#handshakeTimeout);
        this.#handshakeTimeout = null;
    }
    #disposeCurrentPort() {
        const current = this.#port;
        this.#port = null;
        if (!current) {
            return;
        }
        try {
            current.disconnect?.();
        }
        catch {
            // ignore teardown errors from stale ports
        }
    }
    #enterRecovery() {
        const recoveryWindowMs = this.options?.recoveryWindowMs ?? 30_000;
        this.#state = "recovering";
        this.#recoveryDeadlineMs = Date.now() + recoveryWindowMs;
        this.#startRecoveryLoop();
    }
    #startRecoveryLoop() {
        const retryIntervalMs = this.options?.recoveryRetryIntervalMs ?? 1_000;
        if (this.#recoveryTimer) {
            return;
        }
        const tick = () => {
            if (this.#state !== "recovering" && this.#state !== "connecting") {
                return;
            }
            this.#recoveryState.expireQueuedForwards(Date.now());
            const deadline = this.#recoveryDeadlineMs;
            if (deadline !== null && Date.now() >= deadline) {
                this.#state = "disconnected";
                this.#recoveryDeadlineMs = null;
                this.#recoveryState.failRecoveryQueue("recovery window exhausted");
                this.#stopRecoveryLoop();
                return;
            }
            this.#connectNativePort();
        };
        tick();
        this.#recoveryTimer = setInterval(tick, retryIntervalMs);
    }
    #stopRecoveryLoop() {
        if (!this.#recoveryTimer) {
            return;
        }
        clearInterval(this.#recoveryTimer);
        this.#recoveryTimer = null;
    }
    #nextHeartbeatId() {
        this.#heartbeatSeq += 1;
        return `bg-hb-${this.#heartbeatSeq.toString().padStart(4, "0")}`;
    }
    #nextHandshakeId() {
        this.#handshakeSeq += 1;
        return `bg-open-${this.#handshakeSeq.toString().padStart(4, "0")}`;
    }
    #clearTrustedFingerprintContexts() {
        this.#runtimeTrustState.clearTrustedContexts();
        this.#staleRestoreBindingLeases.clear();
    }
    #clearRuntimeBootstrapStates() {
        this.#runtimeTrustState.clearRuntimeBootstrapStates();
        this.#staleRestoreBindingLeases.clear();
    }
    #clearRuntimeBootstrapStateByProfile(profile) {
        this.#runtimeTrustState.clearRuntimeBootstrapStateByProfile(profile);
        this.#clearStaleRestoreBindingLeasesByProfile(profile);
    }
    #clearTrustedFingerprintContextBySession(profile, sessionId) {
        this.#runtimeTrustState.clearTrustedContextBySession(profile, sessionId);
        this.#staleRestoreBindingLeases.delete(this.#buildStaleRestoreBindingLeaseKey(profile, sessionId));
    }
    #clearTrustedFingerprintContextsByProfile(profile) {
        this.#runtimeTrustState.clearTrustedContextsByProfile(profile);
        this.#clearStaleRestoreBindingLeasesByProfile(profile);
    }
    #buildStaleRestoreBindingLeaseKey(profile, sessionId) {
        return `${profile}::${sessionId}`;
    }
    #clearStaleRestoreBindingLeasesByProfile(profile) {
        const prefix = `${profile}::`;
        for (const key of this.#staleRestoreBindingLeases.keys()) {
            if (key.startsWith(prefix)) {
                this.#staleRestoreBindingLeases.delete(key);
            }
        }
    }
    #upsertStaleRestoreBindingLease(profile, lease) {
        this.#staleRestoreBindingLeases.set(this.#buildStaleRestoreBindingLeaseKey(profile, lease.sessionId), lease);
    }
    #getStaleRestoreBindingLease(profile, sessionId) {
        const key = this.#buildStaleRestoreBindingLeaseKey(profile, sessionId);
        const lease = this.#staleRestoreBindingLeases.get(key) ?? null;
        if (!lease) {
            return null;
        }
        if (Date.now() - lease.issuedAtMs > xhsStaleRestoreBindingLeaseMaxAgeMs) {
            this.#staleRestoreBindingLeases.delete(key);
            return null;
        }
        return lease;
    }
    #invalidateTrustedFingerprintContextForCommand(request, command) {
        if (!TRUST_INVALIDATION_COMMANDS.has(command)) {
            return;
        }
        const profile = asNonEmptyString(request.profile);
        const sessionId = asNonEmptyString(request.params.session_id) ?? this.#sessionId;
        if (command === "runtime.stop") {
            if (profile) {
                this.#clearTrustedFingerprintContextBySession(profile, sessionId);
                return;
            }
            this.#clearTrustedFingerprintContexts();
            return;
        }
        if (profile) {
            this.#clearTrustedFingerprintContextsByProfile(profile);
            this.#clearRuntimeBootstrapStateByProfile(profile);
            return;
        }
        this.#clearTrustedFingerprintContexts();
        this.#clearRuntimeBootstrapStates();
    }
    #rememberTrustedFingerprintContext(request, payload, ok) {
        if (!ok) {
            return;
        }
        const command = String(request.params.command ?? "");
        if (!TRUST_PRIMING_COMMANDS.has(command)) {
            return;
        }
        const profile = asNonEmptyString(request.profile);
        if (!profile) {
            return;
        }
        if (!hasSuccessfulExecutionAttestation(payload)) {
            return;
        }
        const fingerprintRuntime = resolveAttestedFingerprintRuntimeContext(payload.fingerprint_runtime ?? null);
        if (!fingerprintRuntime) {
            return;
        }
        if (fingerprintRuntime.profile !== profile) {
            return;
        }
        const sessionId = asNonEmptyString(request.params.session_id) ?? this.#sessionId;
        const bootstrap = this.#runtimeTrustState.getBootstrap(profile);
        const canPrimeFromBootstrap = command === "runtime.ping" &&
            !!bootstrap &&
            bootstrap.sessionId === sessionId &&
            (bootstrap.status === "pending" || bootstrap.status === "ready") &&
            bootstrap.serializedFingerprintRuntime === serializeFingerprintRuntimeContext(fingerprintRuntime);
        if (!canPrimeFromBootstrap) {
            return;
        }
        const sourceBinding = this.#resolveRequestTargetBinding(request);
        this.#promoteRuntimeBootstrapStateFromExecutionSignal(profile, sessionId, fingerprintRuntime, asNonEmptyString(request.params.run_id) ?? bootstrap?.runId ?? null, bootstrap?.runtimeContextId ?? null, sourceBinding);
        if (!sourceBinding) {
            return;
        }
        this.#upsertTrustedFingerprintContext(profile, sessionId, fingerprintRuntime, {
            sourceTabId: sourceBinding.tabId,
            sourceDomain: sourceBinding.domain,
            sourcePage: sourceBinding.page,
            runId: bootstrap?.runId ?? null,
            runtimeContextId: bootstrap?.runtimeContextId ?? null
        });
    }
    async #resolveStartupTrustSenderBinding(sender) {
        const tabId = asInteger(sender.tab?.id);
        if (tabId === null) {
            return null;
        }
        const senderUrl = asNonEmptyString(sender.tab?.url ?? sender.url);
        if (senderUrl) {
            const parsedSenderUrl = parseUrl(senderUrl);
            if (!parsedSenderUrl || !XHS_DOMAIN_ALLOWLIST.has(parsedSenderUrl.hostname)) {
                return null;
            }
            return {
                tabId,
                domain: parsedSenderUrl.hostname,
                page: classifyXhsPage(senderUrl, parsedSenderUrl.hostname)
            };
        }
        const allowlistTabs = await this.chromeApi.tabs.query({
            url: STARTUP_TRUST_ALLOWLIST_URLS
        });
        const senderTab = allowlistTabs.find((tab) => tab.id === tabId);
        const senderTabUrl = typeof senderTab?.url === "string" ? senderTab.url : "";
        const parsedTabUrl = parseUrl(senderTabUrl);
        if (!parsedTabUrl || !XHS_DOMAIN_ALLOWLIST.has(parsedTabUrl.hostname)) {
            return null;
        }
        return {
            tabId,
            domain: parsedTabUrl.hostname,
            page: classifyXhsPage(senderTabUrl, parsedTabUrl.hostname)
        };
    }
    #resolveRequestTargetBinding(request) {
        const commandParams = asRecord(request.params.command_params) ?? {};
        const options = asRecord(commandParams.options);
        const readTarget = (key) => Object.prototype.hasOwnProperty.call(commandParams, key)
            ? commandParams[key]
            : options?.[key];
        const targetTabId = asInteger(readTarget("target_tab_id"));
        const targetDomain = asNonEmptyString(readTarget("target_domain"));
        const targetPage = asNonEmptyString(readTarget("target_page"));
        if (targetTabId === null || !targetDomain || !XHS_DOMAIN_ALLOWLIST.has(targetDomain)) {
            return null;
        }
        return {
            tabId: targetTabId,
            domain: targetDomain,
            page: targetPage
        };
    }
    #doesStrictTargetBindingMatch(requestTargetBinding, storedTarget, options = {}) {
        const storedSourcePage = asNonEmptyString(storedTarget.sourcePage);
        if (storedTarget.sourceTabId === null &&
            storedTarget.sourceDomain === null &&
            storedSourcePage === null) {
            return requestTargetBinding === null;
        }
        if (storedTarget.sourceTabId === null || storedTarget.sourceDomain === null) {
            return false;
        }
        if (requestTargetBinding === null ||
            requestTargetBinding.tabId !== storedTarget.sourceTabId ||
            requestTargetBinding.domain !== storedTarget.sourceDomain) {
            return false;
        }
        if (options.requirePage === true) {
            if (requestTargetBinding.page === null) {
                return false;
            }
            if (storedSourcePage === null) {
                return options.allowMissingStoredPage === true;
            }
            return requestTargetBinding.page === storedSourcePage;
        }
        return true;
    }
    async #rememberStartupTrustedFingerprintContext(payload, sender) {
        const startupTrust = asRecord(payload.startup_fingerprint_trust);
        if (!startupTrust) {
            return;
        }
        const trustSource = asNonEmptyString(startupTrust.trust_source ?? startupTrust.source);
        if (trustSource !== STARTUP_TRUST_SOURCE) {
            return;
        }
        if (startupTrust.bootstrap_attested !== true) {
            return;
        }
        if (startupTrust.main_world_result_used_for_trust === true) {
            return;
        }
        const profile = asNonEmptyString(startupTrust.profile);
        if (!profile) {
            return;
        }
        const fingerprintRuntime = ensureFingerprintRuntimeContext(startupTrust.fingerprint_runtime ?? null);
        if (!fingerprintRuntime || fingerprintRuntime.profile !== profile) {
            return;
        }
        const explicitSessionId = asNonEmptyString(startupTrust.session_id ?? startupTrust.sessionId);
        if (!explicitSessionId || explicitSessionId !== this.#sessionId) {
            return;
        }
        const senderBinding = await this.#resolveStartupTrustSenderBinding(sender);
        if (hasInstalledFingerprintInjection(fingerprintRuntime)) {
            this.#promoteRuntimeBootstrapStateFromExecutionSignal(profile, explicitSessionId, fingerprintRuntime, asNonEmptyString(startupTrust.run_id ?? null), asNonEmptyString(startupTrust.runtime_context_id ?? null), senderBinding);
        }
        if (!senderBinding) {
            return;
        }
        this.#upsertTrustedFingerprintContext(profile, explicitSessionId, fingerprintRuntime, {
            sourceTabId: senderBinding.tabId,
            sourceDomain: senderBinding.domain,
            sourcePage: senderBinding.page,
            runId: asNonEmptyString(startupTrust.run_id ?? null),
            runtimeContextId: asNonEmptyString(startupTrust.runtime_context_id ?? null)
        });
    }
    #normalizeTrustedFingerprintRuntime(fingerprintRuntime) {
        const injection = asRecord(fingerprintRuntime.injection);
        return {
            profile: fingerprintRuntime.profile,
            source: fingerprintRuntime.source,
            fingerprint_profile_bundle: fingerprintRuntime.fingerprint_profile_bundle
                ? JSON.parse(JSON.stringify(fingerprintRuntime.fingerprint_profile_bundle))
                : null,
            fingerprint_patch_manifest: fingerprintRuntime.fingerprint_patch_manifest
                ? JSON.parse(JSON.stringify(fingerprintRuntime.fingerprint_patch_manifest))
                : null,
            fingerprint_consistency_check: JSON.parse(JSON.stringify(fingerprintRuntime.fingerprint_consistency_check)),
            execution: JSON.parse(JSON.stringify(fingerprintRuntime.execution)),
            ...(injection ? { injection: JSON.parse(JSON.stringify(injection)) } : {})
        };
    }
    #upsertTrustedFingerprintContext(profile, sessionId, fingerprintRuntime, source) {
        this.#runtimeTrustState.upsertTrusted(profile, sessionId, this.#normalizeTrustedFingerprintRuntime(fingerprintRuntime), source);
    }
    #promoteRuntimeBootstrapStateFromExecutionSignal(profile, sessionId, fingerprintRuntime, signalRunId, signalRuntimeContextId, sourceBinding) {
        const bootstrap = this.#runtimeTrustState.getBootstrap(profile);
        if (!bootstrap) {
            return;
        }
        if (bootstrap.sessionId !== sessionId || bootstrap.status !== "pending") {
            return;
        }
        if (!signalRunId || bootstrap.runId !== signalRunId) {
            return;
        }
        if (!signalRuntimeContextId || bootstrap.runtimeContextId !== signalRuntimeContextId) {
            return;
        }
        if (bootstrap.serializedFingerprintRuntime !== serializeFingerprintRuntimeContext(fingerprintRuntime)) {
            bootstrap.status = "failed";
            bootstrap.updatedAt = new Date().toISOString();
            this.#runtimeTrustState.setBootstrap(profile, bootstrap);
            return;
        }
        if (sourceBinding) {
            bootstrap.sourceTabId = sourceBinding.tabId;
            bootstrap.sourceDomain = sourceBinding.domain;
            bootstrap.sourcePage = sourceBinding.page;
        }
        bootstrap.status = "ready";
        bootstrap.updatedAt = new Date().toISOString();
        this.#runtimeTrustState.setBootstrap(profile, bootstrap);
    }
    #resolveTrustedFingerprintContext(request) {
        const profile = asNonEmptyString(request.profile);
        if (!profile) {
            return null;
        }
        const sessionId = asNonEmptyString(request.params.session_id) ?? this.#sessionId;
        const trusted = this.#runtimeTrustState.getTrusted(profile, sessionId);
        if (!trusted) {
            return null;
        }
        if (trusted.sessionId !== this.#sessionId) {
            this.#runtimeTrustState.clearTrustedContextBySession(profile, sessionId);
            return null;
        }
        return trusted;
    }
    #resolveReadyBootstrapFingerprintContext(request, requestedFingerprintContext) {
        if (!requestedFingerprintContext) {
            return null;
        }
        const profile = asNonEmptyString(request.profile);
        const runId = asNonEmptyString(request.params.run_id);
        const sessionId = asNonEmptyString(request.params.session_id) ?? this.#sessionId;
        if (!profile || !runId || !sessionId) {
            return null;
        }
        const bootstrap = this.#runtimeTrustState.getBootstrap(profile);
        if (!bootstrap) {
            return null;
        }
        if (bootstrap.sessionId !== sessionId ||
            bootstrap.runId !== runId ||
            bootstrap.status !== "ready" ||
            !this.#doesStrictTargetBindingMatch(this.#resolveRequestTargetBinding(request), bootstrap) ||
            bootstrap.serializedFingerprintRuntime !==
                serializeFingerprintRuntimeContext(requestedFingerprintContext)) {
            return null;
        }
        return { ...requestedFingerprintContext };
    }
    #resolveValidatedTrustedFingerprintContext(request, requestedFingerprintContext) {
        const readyBootstrapFingerprintContext = this.#resolveReadyBootstrapFingerprintContext(request, requestedFingerprintContext);
        const trustedEntry = this.#resolveTrustedFingerprintContext(request);
        if (!trustedEntry) {
            return readyBootstrapFingerprintContext;
        }
        const trusted = trustedEntry.fingerprintRuntime;
        if (requestedFingerprintContext &&
            !isFingerprintRuntimeContextEquivalent(trusted, requestedFingerprintContext)) {
            const profile = asNonEmptyString(request.profile);
            if (profile) {
                const sessionId = asNonEmptyString(request.params.session_id) ?? this.#sessionId;
                this.#clearTrustedFingerprintContextBySession(profile, sessionId);
            }
            else {
                this.#clearTrustedFingerprintContexts();
            }
            return null;
        }
        if (!this.#doesStrictTargetBindingMatch(this.#resolveRequestTargetBinding(request), trustedEntry)) {
            return null;
        }
        return { ...trusted };
    }
    async #onNativeRequest(request) {
        if (request.method === "bridge.open") {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {},
                error: {
                    code: "ERR_TRANSPORT_HANDSHAKE_FAILED",
                    message: "bridge.open must be initiated by extension/background"
                }
            });
            return;
        }
        if (request.method === "__ping__") {
            this.#emit({
                id: request.id,
                status: "success",
                summary: {
                    session_id: String(request.params.session_id ?? "nm-session-001")
                },
                error: null
            });
            return;
        }
        if (request.method !== "bridge.forward") {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {},
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: `unsupported method: ${request.method}`
                }
            });
            return;
        }
        if (this.#state !== "ready") {
            if (this.#isRecoveryWindowOpen()) {
                this.#enqueueRecoveryForward(request);
                return;
            }
            const code = this.#state === "disconnected" ? "ERR_TRANSPORT_DISCONNECTED" : "ERR_TRANSPORT_NOT_READY";
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                error: {
                    code,
                    message: code === "ERR_TRANSPORT_DISCONNECTED"
                        ? "native messaging disconnected"
                        : "native bridge is not ready"
                }
            });
            return;
        }
        const command = String(request.params.command ?? "");
        if (command === "runtime.bootstrap") {
            await this.#handleRuntimeBootstrap(request);
            return;
        }
        if (command === "runtime.tabs") {
            await this.#handleRuntimeTabs(request);
            return;
        }
        if (command === "runtime.restore_xhs_target") {
            await this.#handleRuntimeRestoreXhsTarget(request);
            return;
        }
        if (command === "runtime.reload_tab") {
            await this.#handleRuntimeReloadTab(request);
            return;
        }
        if (command === "runtime.xhs_debug_page_state") {
            await this.#handleRuntimeXhsDebugPageState(request);
            return;
        }
        if (command === "runtime.xhs_capture_user_home_context") {
            await this.#handleRuntimeXhsCaptureUserHomeContext(request);
            return;
        }
        if (command === "runtime.xhs_debug_main_world_roundtrip") {
            await this.#handleRuntimeXhsDebugMainWorldRoundtrip(request);
            return;
        }
        if (command === "runtime.xhs_open_result_card") {
            await this.#handleRuntimeXhsOpenResultCard(request);
            return;
        }
        if (command === "runtime.xhs_debug_result_targets") {
            await this.#handleRuntimeXhsDebugResultTargets(request);
            return;
        }
        if (command === "runtime.main_world_probe") {
            await this.#handleRuntimeMainWorldProbe(request);
            return;
        }
        if (command === "runtime.trusted_fingerprint_probe") {
            this.#handleRuntimeTrustedFingerprintProbe(request);
            return;
        }
        if (command === "runtime.readiness") {
            await this.#handleRuntimeReadiness(request);
            return;
        }
        try {
            await this.#dispatchForward(request);
        }
        catch (error) {
            const failureMessage = error instanceof Error ? error.message : String(error);
            const failureName = error instanceof Error && typeof error.name === "string" && error.name.length > 0
                ? error.name
                : "Error";
            const xhsCommand = XHS_GATE_COMMANDS.has(command);
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                payload: xhsCommand
                    ? {
                        details: {
                            stage: "execution",
                            reason: "BACKGROUND_FORWARD_EXCEPTION",
                            forward_failure_stage: "background_dispatch_exception",
                            error_name: failureName
                        },
                        diagnosis: {
                            category: "runtime_unavailable",
                            stage: "runtime",
                            component: "background",
                            failure_site: {
                                stage: "runtime",
                                component: "background",
                                target: command,
                                summary: failureMessage
                            },
                            evidence: [`background_forward_exception=${failureName}`]
                        }
                    }
                    : undefined,
                error: {
                    code: xhsCommand ? "ERR_EXECUTION_FAILED" : "ERR_TRANSPORT_FORWARD_FAILED",
                    message: failureMessage
                }
            });
        }
    }
    async #handleRuntimeBootstrap(request) {
        const commandParams = asRecord(request.params.command_params) ?? {};
        const version = asNonEmptyString(commandParams.version);
        const runId = asNonEmptyString(commandParams.run_id);
        const runtimeContextId = asNonEmptyString(commandParams.runtime_context_id);
        const profile = asNonEmptyString(commandParams.profile);
        const fingerprintRuntime = ensureFingerprintRuntimeContext(commandParams.fingerprint_runtime ?? null);
        const fingerprintPatchManifest = asRecord(commandParams.fingerprint_patch_manifest);
        const mainWorldSecret = asNonEmptyString(commandParams.main_world_secret);
        const requestRunId = asNonEmptyString(request.params.run_id);
        const requestProfile = asNonEmptyString(request.profile);
        const requestSessionId = asNonEmptyString(request.params.session_id) ?? this.#sessionId;
        const requestTargetBinding = this.#resolveRequestTargetBinding(request);
        if (!version ||
            version !== "v1" ||
            !runId ||
            !runtimeContextId ||
            !profile ||
            !fingerprintRuntime ||
            !fingerprintPatchManifest ||
            !mainWorldSecret) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_RUNTIME_READY_SIGNAL_CONFLICT",
                    message: "invalid runtime bootstrap envelope"
                }
            });
            return;
        }
        if (!requestProfile || requestProfile !== profile) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH",
                    message: "runtime bootstrap profile 与当前请求 profile 不一致"
                }
            });
            return;
        }
        if (requestRunId && requestRunId !== runId) {
            this.#runtimeTrustState.setBootstrap(profile, {
                version,
                runId,
                runtimeContextId,
                profile,
                sessionId: requestSessionId,
                status: "stale",
                mainWorldSecret,
                serializedFingerprintRuntime: serializeFingerprintRuntimeContext(fingerprintRuntime),
                sourceTabId: requestTargetBinding?.tabId ?? null,
                sourceDomain: requestTargetBinding?.domain ?? null,
                sourcePage: requestTargetBinding?.page ?? null,
                updatedAt: new Date().toISOString()
            });
            this.#emit({
                id: request.id,
                status: "success",
                summary: {
                    session_id: this.#sessionId,
                    run_id: requestRunId,
                    command: "runtime.bootstrap",
                    profile,
                    relay_path: "host>background"
                },
                payload: {
                    method: "runtime.bootstrap.ack",
                    result: {
                        version,
                        run_id: runId,
                        runtime_context_id: runtimeContextId,
                        profile,
                        status: "stale"
                    }
                },
                error: null
            });
            return;
        }
        const serializedFingerprintRuntime = serializeFingerprintRuntimeContext(fingerprintRuntime);
        const currentBootstrapState = this.#runtimeTrustState.getBootstrap(profile);
        const bootstrapReadyFromState = !!currentBootstrapState &&
            currentBootstrapState.sessionId === requestSessionId &&
            currentBootstrapState.status === "ready" &&
            currentBootstrapState.version === version &&
            currentBootstrapState.runId === runId &&
            currentBootstrapState.runtimeContextId === runtimeContextId &&
            this.#doesStrictTargetBindingMatch(requestTargetBinding, currentBootstrapState, {
                requirePage: requestTargetBinding?.page != null,
                allowMissingStoredPage: true
            }) &&
            currentBootstrapState.serializedFingerprintRuntime === serializedFingerprintRuntime;
        const trusted = this.#runtimeTrustState.getTrusted(profile, requestSessionId);
        const trustedHasInstalledInjection = hasInstalledFingerprintInjection(trusted?.fingerprintRuntime ?? null);
        const trustedMatchesBootstrap = !!trusted &&
            trusted.sessionId === requestSessionId &&
            trusted.runId === runId &&
            trusted.runtimeContextId === runtimeContextId &&
            this.#doesStrictTargetBindingMatch(requestTargetBinding, trusted, {
                requirePage: requestTargetBinding?.page != null,
                allowMissingStoredPage: true
            }) &&
            trustedHasInstalledInjection;
        const bootstrapReadyFromTrusted = trustedMatchesBootstrap &&
            trusted.serializedFingerprintRuntime === serializedFingerprintRuntime;
        try {
            await this.#prepareRuntimeBootstrapRequestContextCapture(request, commandParams);
        }
        catch {
            // Keep bootstrap attestation independent from request-context capture preparation.
        }
        if (bootstrapReadyFromState && trustedMatchesBootstrap || bootstrapReadyFromTrusted) {
            this.#runtimeTrustState.setBootstrap(profile, {
                version,
                runId,
                runtimeContextId,
                profile,
                sessionId: requestSessionId,
                status: "ready",
                mainWorldSecret,
                serializedFingerprintRuntime,
                sourceTabId: trusted?.sourceTabId ??
                    requestTargetBinding?.tabId ??
                    currentBootstrapState?.sourceTabId ??
                    null,
                sourceDomain: trusted?.sourceDomain ??
                    requestTargetBinding?.domain ??
                    currentBootstrapState?.sourceDomain ??
                    null,
                sourcePage: trusted?.sourcePage ??
                    requestTargetBinding?.page ??
                    currentBootstrapState?.sourcePage ??
                    null,
                updatedAt: new Date().toISOString()
            });
            this.#emit({
                id: request.id,
                status: "success",
                summary: {
                    session_id: this.#sessionId,
                    run_id: requestRunId ?? request.id,
                    command: "runtime.bootstrap",
                    profile,
                    relay_path: "host>background"
                },
                payload: {
                    method: "runtime.bootstrap.ack",
                    result: {
                        version,
                        run_id: runId,
                        runtime_context_id: runtimeContextId,
                        profile,
                        status: "ready"
                    },
                    ...(trustedMatchesBootstrap
                        ? {
                            runtime_bootstrap_attested: true,
                            fingerprint_runtime: trusted?.fingerprintRuntime ?? null
                        }
                        : {})
                },
                error: null
            });
            return;
        }
        this.#runtimeTrustState.setBootstrap(profile, {
            version,
            runId,
            runtimeContextId,
            profile,
            sessionId: requestSessionId,
            status: "pending",
            mainWorldSecret,
            serializedFingerprintRuntime,
            sourceTabId: requestTargetBinding?.tabId ?? null,
            sourceDomain: requestTargetBinding?.domain ?? null,
            sourcePage: requestTargetBinding?.page ?? null,
            updatedAt: new Date().toISOString()
        });
        // Keep the request pending until the execution surface returns an explicit bootstrap ack
        // or the normal forward timeout resolves it.
        void this.#dispatchForward(request);
        return;
    }
    async #handleRuntimeTabs(request) {
        const commandParams = asRecord(request.params.command_params) ?? {};
        const currentWindowOnly = commandParams.current_window_only !== false;
        const rawUrlPatterns = Array.isArray(commandParams.url_patterns)
            ? commandParams.url_patterns.filter((entry) => typeof entry === "string")
            : [];
        try {
            const tabs = await this.chromeApi.tabs.query({
                ...(currentWindowOnly ? { currentWindow: true } : {}),
                ...(rawUrlPatterns.length > 0 ? { url: rawUrlPatterns } : {})
            });
            this.#emit({
                id: request.id,
                status: "success",
                summary: {
                    session_id: String(request.params.session_id ?? this.#sessionId),
                    run_id: String(request.params.run_id ?? request.id),
                    command: "runtime.tabs",
                    relay_path: "host>background"
                },
                payload: {
                    tabs: tabs.map((tab) => ({
                        tab_id: typeof tab.id === "number" ? tab.id : null,
                        active: tab.active === true,
                        url: typeof tab.url === "string" ? tab.url : null
                    }))
                },
                error: null
            });
        }
        catch (error) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
    async #resolveTabById(tabId) {
        if (this.chromeApi.tabs.get) {
            return await this.chromeApi.tabs.get(tabId);
        }
        const tabs = await this.chromeApi.tabs.query({});
        return tabs.find((tab) => tab.id === tabId) ?? null;
    }
    async #waitForRestoredTargetNavigation(input) {
        const deadline = Date.now() + Math.max(1, input.timeoutMs);
        let lastObservedUrl = null;
        let lastObservedStatus = null;
        while (true) {
            let tab = null;
            try {
                tab = await this.#resolveTabById(input.tabId);
            }
            catch (error) {
                const targetNotFound = this.chromeApi.tabs.get ? isRestoreTargetTabNotFoundError(error) : false;
                return {
                    ok: false,
                    reason: targetNotFound ? "TARGET_RESTORE_TARGET_TAB_NOT_FOUND" : "TARGET_RESTORE_TAB_QUERY_FAILED",
                    message: error instanceof Error ? error.message : String(error),
                    details: {
                        requested_target_tab_id: input.tabId,
                        target_url: input.targetUrl
                    }
                };
            }
            if (!tab || tab.id !== input.tabId) {
                return {
                    ok: false,
                    reason: "TARGET_RESTORE_TARGET_TAB_NOT_FOUND",
                    message: "runtime.restore_xhs_target could not confirm target_tab_id after navigation",
                    details: {
                        requested_target_tab_id: input.tabId,
                        resolved_target_tab_id: tab?.id ?? null,
                        target_url: input.targetUrl
                    }
                };
            }
            lastObservedUrl = typeof tab.url === "string" ? tab.url : null;
            lastObservedStatus = typeof tab.status === "string" ? tab.status : null;
            if (xhsRestoreSearchUrlsMatch(lastObservedUrl, input.targetUrl) && lastObservedStatus === "complete") {
                return { ok: true, tab };
            }
            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) {
                return {
                    ok: false,
                    reason: "TARGET_RESTORE_NAVIGATION_NOT_READY",
                    message: "runtime.restore_xhs_target target tab did not reach the requested URL before timeout",
                    details: {
                        requested_target_tab_id: input.tabId,
                        target_url: input.targetUrl,
                        observed_url: lastObservedUrl,
                        observed_status: lastObservedStatus
                    }
                };
            }
            await this.#sleep(Math.min(xhsTargetRestoreNavigationPollMs, remainingMs));
        }
    }
    async #handleRuntimeRestoreXhsTarget(request) {
        const commandParams = asRecord(request.params.command_params) ?? {};
        const targetDomain = asNonEmptyString(commandParams.target_domain);
        const targetPage = asNonEmptyString(commandParams.target_page);
        const targetTabId = asInteger(commandParams.target_tab_id);
        const query = asNonEmptyString(commandParams.query);
        const forceReload = commandParams.force_reload === true;
        const actionRef = asNonEmptyString(commandParams.action_ref) ??
            asNonEmptyString(commandParams.gate_invocation_id) ??
            asNonEmptyString(request.params.run_id) ??
            request.id;
        const runId = String(request.params.run_id ?? request.id);
        const sessionId = String(request.params.session_id ?? this.#sessionId);
        const profile = typeof request.profile === "string" ? request.profile : null;
        const fail = (reason, message, extra) => {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.restore_xhs_target",
                    profile,
                    relay_path: "host>background"
                },
                payload: {
                    details: {
                        stage: "execution",
                        reason,
                        target_domain: targetDomain,
                        target_page: targetPage,
                        target_tab_id: targetTabId,
                        active_fetch_performed: false,
                        closeout_bundle_entered: false,
                        ...(extra ?? {})
                    }
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message
                }
            });
        };
        if (!profile) {
            fail("TARGET_RESTORE_PROFILE_REQUIRED", "runtime.restore_xhs_target requires a managed profile");
            return;
        }
        if (targetDomain !== XHS_READ_DOMAIN || targetPage !== "search_result_tab" || !query) {
            fail("TARGET_RESTORE_INPUT_INVALID", "runtime.restore_xhs_target requires XHS search_result target and query");
            return;
        }
        if (targetTabId === null) {
            fail("TARGET_RESTORE_TARGET_TAB_REQUIRED", "runtime.restore_xhs_target requires target_tab_id");
            return;
        }
        const targetUrl = buildXhsSearchResultUrl(query);
        const restoreSafetyGate = asRecord(commandParams.restore_safety_gate);
        if (!isRestoreSafetyGateAllowed(restoreSafetyGate, profile, runId, sessionId, targetDomain, targetPage, targetTabId, targetUrl, actionRef)) {
            fail("TARGET_RESTORE_SAFETY_GATE_BLOCKED", "runtime.restore_xhs_target requires a current restore safety gate");
            return;
        }
        let explicitTarget = null;
        try {
            explicitTarget = await this.#resolveTabById(targetTabId);
        }
        catch (error) {
            const targetNotFound = this.chromeApi.tabs.get ? isRestoreTargetTabNotFoundError(error) : false;
            fail(targetNotFound ? "TARGET_RESTORE_TARGET_TAB_NOT_FOUND" : "TARGET_RESTORE_TAB_QUERY_FAILED", error instanceof Error ? error.message : String(error), { requested_target_tab_id: targetTabId });
            return;
        }
        if (!explicitTarget) {
            fail("TARGET_RESTORE_TARGET_TAB_NOT_FOUND", "runtime.restore_xhs_target could not find target_tab_id", {
                requested_target_tab_id: targetTabId
            });
            return;
        }
        if (explicitTarget.id !== targetTabId) {
            fail("TARGET_RESTORE_TARGET_TAB_NOT_FOUND", "runtime.restore_xhs_target resolved a different tab id", {
                requested_target_tab_id: targetTabId,
                resolved_target_tab_id: explicitTarget.id ?? null
            });
            return;
        }
        const sourceTab = explicitTarget;
        const previousUrl = typeof sourceTab?.url === "string" ? sourceTab.url : null;
        if (typeof sourceTab.id !== "number") {
            fail("TARGET_TAB_ID_UNAVAILABLE", "target tab id is unavailable", {
                requested_target_tab_id: targetTabId,
                target_url: targetUrl
            });
            return;
        }
        const bootstrap = this.#runtimeTrustState.getBootstrap(profile);
        const trusted = this.#runtimeTrustState.getTrusted(profile, sessionId);
        const staleBootstrapRecovery = restoreSafetyGate?.restore_runtime_attach_state === "stale_bootstrap_same_runtime" &&
            restoreSafetyGate.stale_bootstrap_recovery === true &&
            restoreSafetyGate.anti_detection_validation_ready === true &&
            restoreSafetyGate.profile_ref === profile &&
            restoreSafetyGate.session_id === sessionId &&
            restoreSafetyGate.run_id === runId &&
            restoreSafetyGate.target_tab_id === sourceTab.id &&
            restoreSafetyGate.managed_target_tab_id === sourceTab.id &&
            restoreSafetyGate.target_tab_continuity === "stale_bootstrap_current_managed_tab" &&
            restoreSafetyGate.target_domain === targetDomain &&
            restoreSafetyGate.target_page === targetPage;
        const bootstrapBindsTarget = !!bootstrap &&
            (bootstrap.status === "pending" || bootstrap.status === "ready") &&
            bootstrap.sessionId === sessionId &&
            bootstrap.sourceTabId === sourceTab.id &&
            bootstrap.sourceDomain === targetDomain;
        const trustedBindsTarget = !!trusted &&
            trusted.sessionId === sessionId &&
            trusted.sourceTabId === sourceTab.id &&
            trusted.sourceDomain === targetDomain;
        const staleRestoreLease = this.#getStaleRestoreBindingLease(profile, sessionId);
        const staleRestoreLeaseBindsTarget = !!staleRestoreLease &&
            staleRestoreLease.runId === runId &&
            staleRestoreLease.runtimeContextId === restoreSafetyGate?.runtime_context_id &&
            staleRestoreLease.targetTabId === sourceTab.id &&
            staleRestoreLease.targetDomain === targetDomain &&
            staleRestoreLease.targetPage === targetPage;
        const staleBootstrapRecoveryBindsTarget = staleBootstrapRecovery &&
            staleRestoreLeaseBindsTarget &&
            restoreSafetyGate?.managed_target_tab_id === sourceTab.id;
        if (!bootstrapBindsTarget && !trustedBindsTarget && !staleBootstrapRecoveryBindsTarget) {
            fail("TARGET_RESTORE_MANAGED_TAB_NOT_BOUND", "runtime.restore_xhs_target requires a current managed tab binding", {
                requested_target_tab_id: targetTabId,
                bootstrap_session_id: bootstrap?.sessionId ?? null,
                bootstrap_run_id: bootstrap?.runId ?? null,
                bootstrap_runtime_context_id: bootstrap?.runtimeContextId ?? null,
                bootstrap_source_tab_id: bootstrap?.sourceTabId ?? null,
                bootstrap_source_domain: bootstrap?.sourceDomain ?? null,
                trusted_source_tab_id: trusted?.sourceTabId ?? null,
                trusted_source_domain: trusted?.sourceDomain ?? null
            });
            return;
        }
        let restoredTab = sourceTab;
        let restoreAction;
        if (xhsRestoreSearchUrlsMatch(previousUrl, targetUrl) && !forceReload) {
            restoreAction = "already_matching";
        }
        else {
            if (!this.chromeApi.tabs.update) {
                fail("TARGET_RESTORE_UNAVAILABLE", "chrome.tabs.update is unavailable");
                return;
            }
            try {
                restoredTab = await this.chromeApi.tabs.update(sourceTab.id, {
                    url: targetUrl,
                    active: true
                });
                restoreAction = xhsRestoreSearchUrlsMatch(previousUrl, targetUrl)
                    ? "reload_matching_tab"
                    : "navigate_existing_tab";
            }
            catch (error) {
                fail(forceReload && xhsRestoreSearchUrlsMatch(previousUrl, targetUrl)
                    ? "TARGET_RESTORE_RELOAD_FAILED"
                    : "TARGET_RESTORE_NAVIGATION_FAILED", error instanceof Error ? error.message : String(error), { previous_url: previousUrl, target_url: targetUrl });
                return;
            }
        }
        const navigationResult = await this.#waitForRestoredTargetNavigation({
            tabId: sourceTab.id,
            targetUrl,
            timeoutMs: xhsTargetRestoreNavigationTimeoutMs
        });
        if (!navigationResult.ok) {
            fail(navigationResult.reason, navigationResult.message, {
                ...navigationResult.details,
                previous_url: previousUrl
            });
            return;
        }
        restoredTab = navigationResult.tab;
        const restoredTabId = typeof restoredTab?.id === "number"
            ? restoredTab.id
            : typeof sourceTab?.id === "number"
                ? sourceTab.id
                : null;
        if (restoredTabId === null) {
            fail("TARGET_TAB_ID_UNAVAILABLE", "restored target tab id is unavailable", {
                target_url: targetUrl
            });
            return;
        }
        const restoredAt = new Date().toISOString();
        this.#emit({
            id: request.id,
            status: "success",
            summary: {
                session_id: String(request.params.session_id ?? this.#sessionId),
                run_id: runId,
                command: "runtime.restore_xhs_target",
                profile,
                tab_id: restoredTabId,
                relay_path: "host>background"
            },
            payload: {
                target_tab_id: restoredTabId,
                target_url: targetUrl,
                restore_evidence: {
                    evidence_class: "target_tab_restoration",
                    profile_ref: profile,
                    session_id: sessionId,
                    target_tab_id: restoredTabId,
                    target_domain: targetDomain,
                    target_page: targetPage,
                    page_url: targetUrl,
                    previous_url: previousUrl,
                    requested_target_tab_id: targetTabId,
                    run_id: runId,
                    action_ref: actionRef,
                    restore_action: restoreAction,
                    restored_at: restoredAt,
                    safety_scope: "webenvoy_managed_runtime",
                    active_fetch_performed: false,
                    closeout_bundle_entered: false
                }
            },
            error: null
        });
    }
    async #handleRuntimeReloadTab(request) {
        const tabId = await this.#resolveTargetTabId(request);
        if (!tabId) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "runtime.reload_tab requires resolvable target_tab_id"
                }
            });
            return;
        }
        if (!this.chromeApi.scripting?.executeScript) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "chrome.scripting.executeScript is unavailable"
                }
            });
            return;
        }
        try {
            const results = await this.chromeApi.scripting.executeScript({
                target: { tabId },
                world: "MAIN",
                func: () => {
                    const href = location.href;
                    setTimeout(() => {
                        location.reload();
                    }, 0);
                    return {
                        href,
                        reload_scheduled: true
                    };
                }
            });
            this.#emit({
                id: request.id,
                status: "success",
                summary: {
                    session_id: String(request.params.session_id ?? this.#sessionId),
                    run_id: String(request.params.run_id ?? request.id),
                    command: "runtime.reload_tab",
                    profile: typeof request.profile === "string" ? request.profile : null,
                    tab_id: tabId,
                    relay_path: "host>background>main-world>background>host"
                },
                payload: {
                    target_tab_id: tabId,
                    result: Array.isArray(results) ? (results[0]?.result ?? null) : null
                },
                error: null
            });
        }
        catch (error) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background>main-world>background>host"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
    #parseXhsDetailNoteIdFromUrl(value) {
        if (!value) {
            return null;
        }
        try {
            const parsed = new URL(value);
            const match = parsed.pathname.match(/^\/(?:explore|discovery\/item|search_result)\/([^/?#]+)/u);
            return match?.[1] ? decodeURIComponent(match[1]) : null;
        }
        catch {
            return null;
        }
    }
    #matchesXhsDetailTarget(tab, noteId, targetUrl) {
        const url = typeof tab?.url === "string" ? tab.url : null;
        if (!url) {
            return false;
        }
        try {
            const parsed = new URL(url);
            if (parsed.hostname !== XHS_READ_DOMAIN) {
                return false;
            }
            if (!isXhsDetailLikePath(parsed.pathname)) {
                return false;
            }
            if (noteId) {
                return this.#parseXhsDetailNoteIdFromUrl(url) === noteId;
            }
            const target = new URL(targetUrl);
            return parsed.pathname === target.pathname;
        }
        catch {
            return false;
        }
    }
    #isGenericXhsExploreUrl(value) {
        if (!value) {
            return false;
        }
        try {
            const parsed = new URL(value);
            return parsed.hostname === XHS_READ_DOMAIN && parsed.pathname === "/explore";
        }
        catch {
            return false;
        }
    }
    async #probeXhsSearchResultCardTarget(input) {
        const executeScript = this.chromeApi.scripting?.executeScript;
        if (!executeScript) {
            return null;
        }
        try {
            const results = await executeScript({
                target: { tabId: input.tabId },
                world: "ISOLATED",
                func: (noteId, detailUrl, title, desiredXsecSource) => {
                    const preferredNoteId = typeof noteId === "string" && noteId.length > 0 ? noteId : null;
                    const preferredDetailUrl = typeof detailUrl === "string" && detailUrl.length > 0 ? detailUrl : null;
                    const preferredTitle = typeof title === "string" && title.length > 0 ? title : null;
                    const xsecSource = typeof desiredXsecSource === "string" && desiredXsecSource.length > 0
                        ? desiredXsecSource
                        : "pc_search";
                    const isUsable = (value) => {
                        if (!(value instanceof HTMLAnchorElement)) {
                            return null;
                        }
                        const rect = value.getBoundingClientRect();
                        const style = window.getComputedStyle(value);
                        if (value.hidden === true ||
                            rect.width <= 0 ||
                            rect.height <= 0 ||
                            style.visibility === "hidden" ||
                            style.display === "none") {
                            return null;
                        }
                        return value;
                    };
                    const isVisibleElement = (value) => {
                        if (!(value instanceof HTMLElement)) {
                            return null;
                        }
                        const rect = value.getBoundingClientRect();
                        const style = window.getComputedStyle(value);
                        if (value.hidden === true ||
                            rect.width <= 0 ||
                            rect.height <= 0 ||
                            style.visibility === "hidden" ||
                            style.display === "none") {
                            return null;
                        }
                        return value;
                    };
                    const buildLocator = (element) => {
                        if (typeof element.id === "string" && element.id.length > 0) {
                            return `#${element.id}`;
                        }
                        const className = typeof element.className === "string"
                            ? element.className
                                .split(/\s+/)
                                .map((token) => token.trim())
                                .filter((token) => token.length > 0)
                                .slice(0, 2)
                                .join(".")
                            : "";
                        if (className) {
                            return `${element.tagName.toLowerCase()}.${className}`;
                        }
                        return element.tagName.toLowerCase();
                    };
                    const buildTargetKey = (element) => {
                        const segments = [];
                        let current = element;
                        while (current) {
                            const parent = current.parentElement;
                            const tagName = current.tagName.toLowerCase();
                            if (!parent) {
                                segments.unshift(current.id ? `${tagName}#${current.id}` : tagName);
                                break;
                            }
                            const siblings = Array.from(parent.children).filter((candidate) => candidate instanceof HTMLElement && candidate.tagName === current?.tagName);
                            const position = siblings.indexOf(current) + 1;
                            const idSegment = current.id ? `#${current.id}` : "";
                            segments.unshift(`${tagName}${idSegment}:nth-of-type(${position})`);
                            current = parent;
                        }
                        return segments.join(" > ");
                    };
                    const isClickableElement = (element) => {
                        if (!element) {
                            return false;
                        }
                        const role = element.getAttribute("role");
                        const tabIndex = typeof element.tabIndex === "number" ? element.tabIndex : -1;
                        const style = window.getComputedStyle(element);
                        return (element instanceof HTMLAnchorElement ||
                            element instanceof HTMLButtonElement ||
                            role === "link" ||
                            role === "button" ||
                            typeof element.onclick === "function" ||
                            element.hasAttribute("onclick") ||
                            tabIndex >= 0 ||
                            style.cursor === "pointer");
                    };
                    const resolveInteractiveTarget = (element) => {
                        if (!element) {
                            return null;
                        }
                        const interactiveDescendant = Array.from(element.querySelectorAll('a, button, [role="link"], [role="button"], [tabindex]'))
                            .map((entry) => isVisibleElement(entry))
                            .find((entry) => entry !== null && isClickableElement(entry));
                        if (interactiveDescendant) {
                            return interactiveDescendant;
                        }
                        let current = element;
                        while (current) {
                            if (isClickableElement(current)) {
                                return current;
                            }
                            current = current.parentElement;
                        }
                        return element;
                    };
                    const parseNoteId = (href) => {
                        try {
                            const parsed = new URL(href, location.href);
                            const match = parsed.pathname.match(/^\/(?:explore|discovery\/item|search_result)\/([^/?#]+)/u);
                            return match?.[1] ? decodeURIComponent(match[1]) : null;
                        }
                        catch {
                            return null;
                        }
                    };
                    const normalizeTargetUrl = (href) => {
                        try {
                            const parsed = new URL(href, location.href);
                            if (parsed.hostname === "www.xiaohongshu.com" && parsed.pathname.startsWith("/search_result/")) {
                                if (!parsed.searchParams.get("xsec_source")) {
                                    parsed.searchParams.set("xsec_source", xsecSource);
                                }
                                return parsed.toString();
                            }
                            if (parsed.hostname !== "www.xiaohongshu.com" ||
                                (!parsed.pathname.startsWith("/explore/") &&
                                    !parsed.pathname.startsWith("/discovery/item/"))) {
                                return null;
                            }
                            if (!parsed.searchParams.get("xsec_source")) {
                                parsed.searchParams.set("xsec_source", xsecSource);
                            }
                            return parsed.toString();
                        }
                        catch {
                            return null;
                        }
                    };
                    const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"], a[href*="/discovery/item/"], a[href*="/search_result/"]'))
                        .map((entry) => isUsable(entry))
                        .filter((entry) => entry !== null);
                    const preferredDetailPath = preferredDetailUrl
                        ? (() => {
                            try {
                                return new URL(preferredDetailUrl, location.href).pathname;
                            }
                            catch {
                                return null;
                            }
                        })()
                        : null;
                    const anchor = anchors.find((candidate) => {
                        const href = candidate.href;
                        const noteIdFromHref = parseNoteId(href);
                        if (preferredNoteId &&
                            (noteIdFromHref === preferredNoteId || href.includes(`/${preferredNoteId}`))) {
                            return true;
                        }
                        if (preferredDetailPath) {
                            try {
                                return new URL(href, location.href).pathname === preferredDetailPath;
                            }
                            catch {
                                return false;
                            }
                        }
                        return false;
                    }) ?? null;
                    const resolveAttributeFallback = () => {
                        const targetUrl = normalizeTargetUrl(preferredDetailUrl ?? "");
                        if ((!preferredNoteId && !preferredDetailPath) || !targetUrl) {
                            return null;
                        }
                        const candidates = Array.from(document.querySelectorAll("a, div, article, section, li, span, p"))
                            .map((entry) => isVisibleElement(entry))
                            .filter((entry) => entry !== null);
                        const match = candidates.find((entry) => {
                            const attrValues = [
                                entry.getAttribute("href"),
                                entry.getAttribute("data-id"),
                                entry.getAttribute("data-note-id"),
                                entry.getAttribute("data-noteid"),
                                entry.getAttribute("id"),
                                entry.getAttribute("data-href"),
                                entry.getAttribute("data-url"),
                                entry.outerHTML
                            ]
                                .filter((value) => typeof value === "string" && value.length > 0)
                                .join(" ");
                            if (preferredNoteId && attrValues.includes(preferredNoteId)) {
                                return true;
                            }
                            if (preferredDetailPath && attrValues.includes(preferredDetailPath)) {
                                return true;
                            }
                            return false;
                        });
                        if (!match) {
                            return null;
                        }
                        const clickable = resolveInteractiveTarget(isVisibleElement(match.closest('a, [role="link"], button, [class*="note"], [class*="card"], article, section, li, div')) ?? match) ?? match;
                        return {
                            element: clickable,
                            targetUrl,
                            noteId: parseNoteId(targetUrl),
                            originalHref: preferredDetailUrl
                        };
                    };
                    if (!anchor) {
                        const attributeFallback = resolveAttributeFallback();
                        if (attributeFallback) {
                            const rect = attributeFallback.element.getBoundingClientRect();
                            return {
                                locator: buildLocator(attributeFallback.element),
                                targetKey: buildTargetKey(attributeFallback.element),
                                centerX: Math.round(rect.left + rect.width / 2),
                                centerY: Math.round(rect.top + rect.height / 2),
                                originalHref: attributeFallback.originalHref,
                                targetUrl: attributeFallback.targetUrl,
                                noteId: attributeFallback.noteId
                            };
                        }
                        return null;
                    }
                    const rect = anchor.getBoundingClientRect();
                    const originalHref = anchor.href || null;
                    const targetUrl = normalizeTargetUrl(originalHref ?? "");
                    if (!targetUrl) {
                        return null;
                    }
                    anchor.setAttribute("href", targetUrl);
                    anchor.setAttribute("target", "_self");
                    return {
                        locator: buildLocator(anchor),
                        targetKey: buildTargetKey(anchor),
                        centerX: Math.round(rect.left + rect.width / 2),
                        centerY: Math.round(rect.top + rect.height / 2),
                        originalHref,
                        targetUrl,
                        noteId: parseNoteId(targetUrl)
                    };
                },
                args: [input.noteId, input.detailUrl, input.title, input.desiredXsecSource]
            });
            const record = asRecord(results[0]?.result ?? null);
            const target = this.#parseEditorInputProbeTarget(record);
            const targetUrl = asNonEmptyString(record?.targetUrl);
            if (!target || !targetUrl) {
                return null;
            }
            return {
                ...target,
                originalHref: asNonEmptyString(record?.originalHref),
                targetUrl,
                noteId: asNonEmptyString(record?.noteId)
            };
        }
        catch {
            return null;
        }
    }
    async #probeXhsSearchResultDebugCandidates(tabId) {
        const executeScript = this.chromeApi.scripting?.executeScript;
        if (!executeScript) {
            return [];
        }
        try {
            const results = await executeScript({
                target: { tabId },
                world: "ISOLATED",
                func: () => {
                    const isVisibleElement = (value) => {
                        if (!(value instanceof HTMLElement)) {
                            return null;
                        }
                        const rect = value.getBoundingClientRect();
                        const style = window.getComputedStyle(value);
                        if (value.hidden === true ||
                            rect.width <= 0 ||
                            rect.height <= 0 ||
                            style.visibility === "hidden" ||
                            style.display === "none") {
                            return null;
                        }
                        return value;
                    };
                    const buildLocator = (element) => {
                        if (typeof element.id === "string" && element.id.length > 0) {
                            return `#${element.id}`;
                        }
                        const className = typeof element.className === "string"
                            ? element.className
                                .split(/\s+/)
                                .map((token) => token.trim())
                                .filter((token) => token.length > 0)
                                .slice(0, 2)
                                .join(".")
                            : "";
                        if (className) {
                            return `${element.tagName.toLowerCase()}.${className}`;
                        }
                        return element.tagName.toLowerCase();
                    };
                    const buildTargetKey = (element) => {
                        const segments = [];
                        let current = element;
                        while (current) {
                            const parent = current.parentElement;
                            const tagName = current.tagName.toLowerCase();
                            if (!parent) {
                                segments.unshift(current.id ? `${tagName}#${current.id}` : tagName);
                                break;
                            }
                            const siblings = Array.from(parent.children).filter((candidate) => candidate instanceof HTMLElement && candidate.tagName === current?.tagName);
                            const position = siblings.indexOf(current) + 1;
                            const idSegment = current.id ? `#${current.id}` : "";
                            segments.unshift(`${tagName}${idSegment}:nth-of-type(${position})`);
                            current = parent;
                        }
                        return segments.join(" > ");
                    };
                    const parseNoteId = (href) => {
                        if (!href) {
                            return null;
                        }
                        try {
                            const parsed = new URL(href, location.href);
                            const match = parsed.pathname.match(/^\/(?:explore|discovery\/item|search_result)\/([^/?#]+)/u);
                            return match?.[1] ? decodeURIComponent(match[1]) : null;
                        }
                        catch {
                            return null;
                        }
                    };
                    const candidates = Array.from(document.querySelectorAll("a, button, [role='link'], [role='button'], [class*='note'], [class*='card'], article, section, li"))
                        .map((entry) => isVisibleElement(entry))
                        .filter((entry) => entry !== null)
                        .slice(0, 120)
                        .map((entry) => {
                        const rect = entry.getBoundingClientRect();
                        const root = entry.closest('[class*="note"], [class*="card"], article, section, li') ??
                            entry.parentElement;
                        return {
                            locator: buildLocator(entry),
                            targetKey: buildTargetKey(entry),
                            centerX: Math.round(rect.left + rect.width / 2),
                            centerY: Math.round(rect.top + rect.height / 2),
                            tagName: entry.tagName.toLowerCase(),
                            titleText: (entry.innerText ?? entry.textContent ?? "").trim() || null,
                            href: entry instanceof HTMLAnchorElement ? entry.href || null : entry.getAttribute("href"),
                            noteId: parseNoteId(entry instanceof HTMLAnchorElement ? entry.href || null : entry.getAttribute("href")),
                            rootLocator: root instanceof HTMLElement ? buildLocator(root) : null,
                            rootTargetKey: root instanceof HTMLElement ? buildTargetKey(root) : null
                        };
                    });
                    return candidates;
                }
            });
            const items = Array.isArray(results[0]?.result) ? results[0].result : [];
            return items
                .map((item) => {
                const record = asRecord(item);
                const target = this.#parseEditorInputProbeTarget(record);
                if (!record || !target) {
                    return null;
                }
                return {
                    ...target,
                    tagName: asNonEmptyString(record.tagName) ?? "unknown",
                    titleText: asNonEmptyString(record.titleText),
                    href: asNonEmptyString(record.href),
                    noteId: asNonEmptyString(record.noteId),
                    rootLocator: asNonEmptyString(record.rootLocator),
                    rootTargetKey: asNonEmptyString(record.rootTargetKey)
                };
            })
                .filter((item) => item !== null);
        }
        catch {
            return [];
        }
    }
    async #handleRuntimeXhsDebugResultTargets(request) {
        const commandParams = asRecord(request.params.command_params) ?? {};
        const tabId = asInteger(commandParams.target_tab_id);
        const profile = typeof request.profile === "string" ? request.profile : null;
        const runId = String(request.params.run_id ?? request.id);
        const sessionId = String(request.params.session_id ?? this.#sessionId);
        if (!profile || tabId === null) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_debug_result_targets",
                    profile,
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "runtime.xhs_debug_result_targets requires profile and target_tab_id"
                }
            });
            return;
        }
        const candidates = await this.#probeXhsSearchResultDebugCandidates(tabId);
        this.#emit({
            id: request.id,
            status: "success",
            summary: {
                session_id: sessionId,
                run_id: runId,
                command: "runtime.xhs_debug_result_targets",
                profile,
                tab_id: tabId,
                relay_path: "host>background"
            },
            payload: {
                target_tab_id: tabId,
                candidates
            },
            error: null
        });
    }
    async #handleRuntimeXhsDebugMainWorldRoundtrip(request) {
        const commandParams = asRecord(request.params.command_params) ?? {};
        const tabId = asInteger(commandParams.target_tab_id);
        const profile = typeof request.profile === "string" ? request.profile : null;
        const runId = String(request.params.run_id ?? request.id);
        const sessionId = String(request.params.session_id ?? this.#sessionId);
        const fingerprintRuntime = asRecord(commandParams.fingerprint_runtime) ?? {};
        const mainWorldSecret = asNonEmptyString(commandParams.main_world_secret) ??
            `issue650-debug-main-world-${runId}`;
        if (!profile || tabId === null || !this.chromeApi.scripting?.executeScript) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_debug_main_world_roundtrip",
                    profile,
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "runtime.xhs_debug_main_world_roundtrip requires profile and target_tab_id"
                }
            });
            return;
        }
        const { requestEvent, resultEvent, namespaceEvent } = resolveMainWorldEventNamesForSecret(mainWorldSecret);
        try {
            await this.#ensureMainWorldBridgeInjected(request, tabId);
            const results = await this.chromeApi.scripting.executeScript({
                target: { tabId },
                world: "ISOLATED",
                func: async (requestEventName, resultEventName, namespaceEventName, runtime) => {
                    const requestEvent = typeof requestEventName === "string" ? requestEventName : "";
                    const resultEvent = typeof resultEventName === "string" ? resultEventName : "";
                    const namespaceEvent = typeof namespaceEventName === "string" ? namespaceEventName : "";
                    if (!requestEvent || !resultEvent || !namespaceEvent) {
                        return {
                            ok: false,
                            reason: "INVALID_EVENT_CHANNEL",
                            details: {
                                requestEvent,
                                resultEvent,
                                namespaceEvent
                            }
                        };
                    }
                    const requestId = `mwprobe-${Date.now()}`;
                    return await new Promise((resolve) => {
                        let settled = false;
                        const finish = (value) => {
                            if (settled) {
                                return;
                            }
                            settled = true;
                            clearTimeout(timer);
                            window.removeEventListener(resultEvent, onResult);
                            resolve(value);
                        };
                        const onResult = (event) => {
                            const detail = event.detail ?? null;
                            finish({
                                ok: true,
                                detail
                            });
                        };
                        const timer = setTimeout(() => {
                            finish({
                                ok: false,
                                reason: "MAIN_WORLD_RESULT_TIMEOUT"
                            });
                        }, 2_000);
                        window.addEventListener(resultEvent, onResult);
                        window.dispatchEvent(new CustomEvent("__mw_bootstrap__", {
                            detail: {
                                request_event: requestEvent,
                                result_event: resultEvent,
                                namespace_event: namespaceEvent
                            }
                        }));
                        window.dispatchEvent(new CustomEvent(requestEvent, {
                            detail: {
                                id: requestId,
                                type: "fingerprint-install",
                                payload: {
                                    fingerprint_runtime: runtime
                                }
                            }
                        }));
                    });
                },
                args: [requestEvent, resultEvent, namespaceEvent, fingerprintRuntime]
            });
            const result = asRecord(results[0]?.result) ?? null;
            this.#emit({
                id: request.id,
                status: "success",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_debug_main_world_roundtrip",
                    profile,
                    tab_id: tabId,
                    relay_path: "host>background>isolated-world>background>host"
                },
                payload: {
                    target_tab_id: tabId,
                    request_event: requestEvent,
                    result_event: resultEvent,
                    namespace_event: namespaceEvent,
                    result
                },
                error: null
            });
        }
        catch (error) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_debug_main_world_roundtrip",
                    profile,
                    tab_id: tabId,
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
    async #handleRuntimeXhsDebugPageState(request) {
        const commandParams = asRecord(request.params.command_params) ?? {};
        const tabId = asInteger(commandParams.target_tab_id);
        const profile = typeof request.profile === "string" ? request.profile : null;
        const runId = String(request.params.run_id ?? request.id);
        const sessionId = String(request.params.session_id ?? this.#sessionId);
        if (!profile || tabId === null || !this.chromeApi.scripting?.executeScript) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_debug_page_state",
                    profile,
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "runtime.xhs_debug_page_state requires profile and target_tab_id"
                }
            });
            return;
        }
        try {
            const results = await this.chromeApi.scripting.executeScript({
                target: { tabId },
                world: "MAIN",
                func: () => {
                    const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
                        ? value
                        : null;
                    const root = asRecord(window.__INITIAL_STATE__);
                    const note = asRecord(root?.note);
                    const noteDetailMap = asRecord(note?.noteDetailMap);
                    const user = asRecord(root?.user);
                    return {
                        href: location.href,
                        title: document.title,
                        has_initial_state: root !== null,
                        top_level_keys: root ? Object.keys(root).slice(0, 50) : [],
                        note_detail_map_keys: noteDetailMap ? Object.keys(noteDetailMap).slice(0, 20) : [],
                        has_note_detail_map: noteDetailMap !== null,
                        note_detail_map_size: noteDetailMap ? Object.keys(noteDetailMap).length : 0,
                        user_keys: user ? Object.keys(user).slice(0, 30) : [],
                        has_user_root: user !== null,
                        has_board_root: asRecord(root?.board) !== null
                    };
                }
            });
            this.#emit({
                id: request.id,
                status: "success",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_debug_page_state",
                    profile,
                    tab_id: tabId,
                    relay_path: "host>background>main-world>background>host"
                },
                payload: {
                    target_tab_id: tabId,
                    page_state: asRecord(results[0]?.result) ?? null
                },
                error: null
            });
        }
        catch (error) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_debug_page_state",
                    profile,
                    tab_id: tabId,
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
    async #handleRuntimeXhsCaptureUserHomeContext(request) {
        const commandParams = asRecord(request.params.command_params) ?? {};
        const targetDomain = asNonEmptyString(commandParams.target_domain);
        const targetPage = asNonEmptyString(commandParams.target_page);
        const targetTabId = asInteger(commandParams.target_tab_id);
        const userId = asNonEmptyString(commandParams.user_id);
        const captureConsumerActionRef = asNonEmptyString(commandParams.captured_action_ref) ?? "read";
        const runId = String(request.params.run_id ?? request.id);
        const sessionId = String(request.params.session_id ?? this.#sessionId);
        const profile = typeof request.profile === "string" ? request.profile : null;
        const fail = (reason, message, extra) => {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_capture_user_home_context",
                    profile,
                    relay_path: "host>background"
                },
                payload: {
                    details: {
                        stage: "execution",
                        reason,
                        target_domain: targetDomain,
                        target_page: targetPage,
                        target_tab_id: targetTabId,
                        user_id: userId,
                        ...(extra ?? {})
                    }
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message
                }
            });
        };
        if (!profile) {
            fail("USER_HOME_CAPTURE_PROFILE_REQUIRED", "runtime.xhs_capture_user_home_context requires a managed profile");
            return;
        }
        if (targetDomain !== XHS_READ_DOMAIN ||
            targetPage !== "profile_tab" ||
            targetTabId === null ||
            !userId) {
            fail("USER_HOME_CAPTURE_INPUT_INVALID", "runtime.xhs_capture_user_home_context requires XHS profile_tab target, target_tab_id, and user_id");
            return;
        }
        const tab = await this.#resolveTabById(targetTabId).catch(() => null);
        const tabUrl = typeof tab?.url === "string" ? tab.url : null;
        const parsedTabUrl = tabUrl ? parseUrl(tabUrl) : null;
        if (!tab ||
            typeof tab.id !== "number" ||
            !parsedTabUrl ||
            parsedTabUrl.hostname !== XHS_READ_DOMAIN ||
            !parsedTabUrl.pathname.startsWith(`/user/profile/${userId}`)) {
            fail("USER_HOME_CAPTURE_TARGET_MISMATCH", "target tab is not the requested XHS profile page", {
                page_url: tabUrl
            });
            return;
        }
        const bootstrap = this.#runtimeTrustState.getBootstrap(profile);
        const trusted = this.#runtimeTrustState.getTrusted(profile, sessionId);
        const bootstrapBindsTarget = !!bootstrap &&
            (bootstrap.status === "pending" || bootstrap.status === "ready") &&
            bootstrap.sessionId === sessionId &&
            bootstrap.runId === runId &&
            bootstrap.sourceTabId === tab.id &&
            bootstrap.sourceDomain === targetDomain &&
            bootstrap.sourcePage === targetPage;
        const trustedBindsTarget = !!trusted &&
            trusted.sessionId === sessionId &&
            trusted.runId === runId &&
            trusted.sourceTabId === tab.id &&
            trusted.sourceDomain === targetDomain &&
            trusted.sourcePage === targetPage;
        if (!bootstrapBindsTarget && !trustedBindsTarget) {
            fail("USER_HOME_CAPTURE_MANAGED_TAB_NOT_BOUND", "runtime.xhs_capture_user_home_context requires a current managed profile tab binding", {
                bootstrap_source_tab_id: bootstrap?.sourceTabId ?? null,
                bootstrap_source_domain: bootstrap?.sourceDomain ?? null,
                bootstrap_source_page: bootstrap?.sourcePage ?? null,
                bootstrap_run_id: bootstrap?.runId ?? null,
                trusted_source_tab_id: trusted?.sourceTabId ?? null,
                trusted_source_domain: trusted?.sourceDomain ?? null,
                trusted_source_page: trusted?.sourcePage ?? null,
                trusted_run_id: trusted?.runId ?? null
            });
            return;
        }
        const debuggerApi = this.chromeApi.debugger;
        if (!debuggerApi) {
            fail("USER_HOME_CAPTURE_DEBUGGER_UNAVAILABLE", "chrome.debugger is unavailable");
            return;
        }
        const captureTimeoutMs = readTimeoutMs(request.timeout_ms) ?? 10_000;
        let debuggerAttached = false;
        try {
            await debuggerApi.attach({ tabId: tab.id }, debuggerProtocolVersion);
            debuggerAttached = true;
            await debuggerApi.sendCommand({ tabId: tab.id }, "Network.enable");
            const capture = this.#waitForXhsUserHomeDebuggerNetworkCapture(tab.id, userId, captureTimeoutMs);
            await debuggerApi.sendCommand({ tabId: tab.id }, "Page.reload", { ignoreCache: true });
            const artifact = await capture;
            if (!artifact) {
                fail("USER_HOME_CAPTURE_CONTEXT_MISSING", "runtime.xhs_capture_user_home_context did not observe user_home API request", { page_url: tabUrl });
                return;
            }
            const shape = {
                command: "xhs.user_home",
                method: "GET",
                pathname: USER_HOME_ENDPOINT,
                user_id: userId
            };
            const capturedAt = asInteger(artifact.captured_at) ?? Date.now();
            const pageContextNamespace = createPageContextNamespace(tabUrl ?? "");
            const boundArtifact = {
                ...artifact,
                path: USER_HOME_ENDPOINT,
                page_context_namespace: pageContextNamespace,
                shape_key: JSON.stringify(shape),
                shape,
                profile_ref: profile,
                session_id: sessionId,
                target_tab_id: tab.id,
                run_id: runId,
                action_ref: captureConsumerActionRef,
                page_url: tabUrl,
                referrer: tabUrl,
                template_identity: `captured:${runId}:${pageContextNamespace}:${JSON.stringify(shape)}:${capturedAt}`
            };
            this.#emit({
                id: request.id,
                status: "success",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_capture_user_home_context",
                    profile,
                    tab_id: tab.id,
                    relay_path: "host>background"
                },
                payload: {
                    target_tab_id: tab.id,
                    target_page: "profile_tab",
                    target_url: tabUrl,
                    captured_request_context_artifact: boundArtifact
                },
                error: null
            });
        }
        catch (error) {
            fail("USER_HOME_CAPTURE_FAILED", error instanceof Error ? error.message : String(error), { page_url: tabUrl });
        }
        finally {
            if (debuggerAttached) {
                await debuggerApi.detach({ tabId: tab.id }).catch(() => undefined);
            }
        }
    }
    async #waitForXhsOpenResultCardNavigation(input) {
        const deadline = Date.now() + Math.max(1, input.timeoutMs);
        let lastObservedUrl = null;
        let lastObservedStatus = null;
        while (true) {
            try {
                const sourceTab = await this.#resolveTabById(input.sourceTabId);
                lastObservedUrl = typeof sourceTab?.url === "string" ? sourceTab.url : null;
                lastObservedStatus = typeof sourceTab?.status === "string" ? sourceTab.status : null;
                if (sourceTab &&
                    this.#matchesXhsDetailTarget(sourceTab, input.noteId, input.targetUrl) &&
                    lastObservedStatus === "complete") {
                    return { ok: true, tab: sourceTab };
                }
            }
            catch {
                // Continue with broader tab resolution below.
            }
            try {
                const tabs = await this.chromeApi.tabs.query({});
                const matched = tabs.find((tab) => this.#matchesXhsDetailTarget(tab, input.noteId, input.targetUrl) &&
                    tab.active === true &&
                    tab.status === "complete") ??
                    tabs.find((tab) => this.#matchesXhsDetailTarget(tab, input.noteId, input.targetUrl) &&
                        tab.status === "complete") ??
                    null;
                if (matched) {
                    return { ok: true, tab: matched };
                }
            }
            catch (error) {
                return {
                    ok: false,
                    reason: "RESULT_CARD_TARGET_QUERY_FAILED",
                    message: error instanceof Error ? error.message : String(error),
                    details: {
                        source_tab_id: input.sourceTabId,
                        target_url: input.targetUrl
                    }
                };
            }
            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) {
                return {
                    ok: false,
                    reason: "RESULT_CARD_NAVIGATION_NOT_READY",
                    message: "runtime.xhs_open_result_card target tab did not reach detail page before timeout",
                    details: {
                        source_tab_id: input.sourceTabId,
                        target_url: input.targetUrl,
                        observed_url: lastObservedUrl,
                        observed_status: lastObservedStatus
                    }
                };
            }
            await this.#sleep(Math.min(xhsTargetRestoreNavigationPollMs, remainingMs));
        }
    }
    async #handleRuntimeXhsOpenResultCard(request) {
        const commandParams = asRecord(request.params.command_params) ?? {};
        const targetDomain = asNonEmptyString(commandParams.target_domain);
        const targetPage = asNonEmptyString(commandParams.target_page);
        const targetTabId = asInteger(commandParams.target_tab_id);
        const noteId = asNonEmptyString(commandParams.note_id);
        const detailUrl = asNonEmptyString(commandParams.detail_url);
        const title = asNonEmptyString(commandParams.title);
        const xsecSource = asNonEmptyString(commandParams.xsec_source) ?? "pc_search";
        const actionRef = asNonEmptyString(commandParams.action_ref) ??
            asNonEmptyString(commandParams.gate_invocation_id) ??
            "action/xhs.search/open_result_card";
        const detailConsumerActionRef = asNonEmptyString(commandParams.captured_action_ref) ?? "read";
        const runId = String(request.params.run_id ?? request.id);
        const sessionId = String(request.params.session_id ?? this.#sessionId);
        const profile = typeof request.profile === "string" ? request.profile : null;
        const fail = (reason, message, extra) => {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    session_id: sessionId,
                    run_id: runId,
                    command: "runtime.xhs_open_result_card",
                    profile,
                    relay_path: "host>background"
                },
                payload: {
                    details: {
                        stage: "execution",
                        reason,
                        target_domain: targetDomain,
                        target_page: targetPage,
                        target_tab_id: targetTabId,
                        note_id: noteId,
                        detail_url: detailUrl,
                        title,
                        ...(extra ?? {})
                    }
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message
                }
            });
        };
        if (!profile) {
            fail("RESULT_CARD_PROFILE_REQUIRED", "runtime.xhs_open_result_card requires a managed profile");
            return;
        }
        if (targetDomain !== XHS_READ_DOMAIN || targetPage !== "search_result_tab" || targetTabId === null) {
            fail("RESULT_CARD_INPUT_INVALID", "runtime.xhs_open_result_card requires XHS search_result target and target_tab_id");
            return;
        }
        let sourceTab = null;
        try {
            sourceTab = await this.#resolveTabById(targetTabId);
        }
        catch (error) {
            fail("RESULT_CARD_SOURCE_TAB_QUERY_FAILED", error instanceof Error ? error.message : String(error), { requested_target_tab_id: targetTabId });
            return;
        }
        if (!sourceTab || typeof sourceTab.id !== "number") {
            fail("RESULT_CARD_SOURCE_TAB_NOT_FOUND", "runtime.xhs_open_result_card could not find target_tab_id", {
                requested_target_tab_id: targetTabId
            });
            return;
        }
        const sourceTabId = sourceTab.id;
        const bootstrap = this.#runtimeTrustState.getBootstrap(profile);
        const trusted = this.#runtimeTrustState.getTrusted(profile, sessionId);
        const bootstrapBindsTarget = !!bootstrap &&
            (bootstrap.status === "pending" || bootstrap.status === "ready") &&
            bootstrap.sessionId === sessionId &&
            bootstrap.runId === runId &&
            bootstrap.sourceTabId === sourceTabId &&
            bootstrap.sourceDomain === targetDomain &&
            bootstrap.sourcePage === targetPage;
        const trustedBindsTarget = !!trusted &&
            trusted.sessionId === sessionId &&
            trusted.runId === runId &&
            trusted.sourceTabId === sourceTabId &&
            trusted.sourceDomain === targetDomain &&
            trusted.sourcePage === targetPage;
        if (!bootstrapBindsTarget && !trustedBindsTarget) {
            fail("RESULT_CARD_MANAGED_TAB_NOT_BOUND", "runtime.xhs_open_result_card requires a current managed tab binding", {
                requested_target_tab_id: targetTabId,
                bootstrap_source_tab_id: bootstrap?.sourceTabId ?? null,
                bootstrap_source_domain: bootstrap?.sourceDomain ?? null,
                bootstrap_source_page: bootstrap?.sourcePage ?? null,
                bootstrap_run_id: bootstrap?.runId ?? null,
                trusted_source_tab_id: trusted?.sourceTabId ?? null,
                trusted_source_domain: trusted?.sourceDomain ?? null,
                trusted_source_page: trusted?.sourcePage ?? null,
                trusted_run_id: trusted?.runId ?? null
            });
            return;
        }
        const sourceUrl = typeof sourceTab.url === "string" ? sourceTab.url : null;
        if (!xhsRestoreSearchUrlsMatch(sourceUrl, sourceUrl ?? "")) {
            fail("RESULT_CARD_SOURCE_PAGE_MISMATCH", "runtime.xhs_open_result_card requires search_result page", {
                page_url: sourceUrl
            });
            return;
        }
        const target = await this.#probeXhsSearchResultCardTarget({
            tabId: sourceTabId,
            noteId,
            detailUrl,
            title,
            desiredXsecSource: xsecSource
        });
        if (!target) {
            fail("RESULT_CARD_TARGET_NOT_FOUND", "runtime.xhs_open_result_card could not resolve a result card target");
            return;
        }
        const debuggerApi = this.chromeApi.debugger;
        let debuggerAttached = false;
        const detachDebugger = async () => {
            if (!debuggerApi || !debuggerAttached) {
                return;
            }
            try {
                await debuggerApi.detach({ tabId: sourceTabId });
            }
            catch {
                // Best-effort detach; keep primary failure semantics.
            }
            finally {
                debuggerAttached = false;
            }
        };
        let capturedRequestContextArtifact = null;
        let detailNetworkCapture = null;
        if (debuggerApi && noteId) {
            try {
                await debuggerApi.attach({ tabId: sourceTab.id }, debuggerProtocolVersion);
                debuggerAttached = true;
                try {
                    await debuggerApi.sendCommand({ tabId: sourceTab.id }, "Network.enable");
                    detailNetworkCapture = this.#waitForXhsDetailDebuggerNetworkCapture(sourceTab.id, noteId, xhsOpenResultCardNavigationTimeoutMs);
                }
                catch {
                    detailNetworkCapture = null;
                }
            }
            catch {
                detailNetworkCapture = null;
            }
        }
        const domClickSucceeded = await this.#dispatchXhsResultCardDomClick(sourceTab.id, target);
        if (!domClickSucceeded) {
            if (!debuggerApi) {
                fail("RESULT_CARD_DEBUGGER_UNAVAILABLE", "chrome.debugger is unavailable");
                return;
            }
            try {
                if (!detailNetworkCapture && !debuggerAttached) {
                    await debuggerApi.attach({ tabId: sourceTab.id }, debuggerProtocolVersion);
                    debuggerAttached = true;
                    try {
                        await debuggerApi.sendCommand({ tabId: sourceTab.id }, "Network.enable");
                        detailNetworkCapture = this.#waitForXhsDetailDebuggerNetworkCapture(sourceTab.id, noteId ?? "", xhsOpenResultCardNavigationTimeoutMs);
                    }
                    catch {
                        detailNetworkCapture = null;
                    }
                }
                await this.#dispatchEditorInputDebuggerClick(sourceTab.id, target);
            }
            catch (error) {
                await detachDebugger();
                fail("RESULT_CARD_CLICK_FAILED", error instanceof Error ? error.message : String(error), {
                    target_url: target.targetUrl,
                    result_card_locator: target.locator,
                    result_card_target_key: target.targetKey
                });
                return;
            }
        }
        const navigation = await this.#waitForXhsOpenResultCardNavigation({
            sourceTabId: sourceTab.id,
            noteId: target.noteId,
            targetUrl: target.targetUrl,
            timeoutMs: xhsOpenResultCardNavigationTimeoutMs
        });
        let resolvedNavigation = navigation;
        if (!resolvedNavigation.ok &&
            resolvedNavigation.reason === "RESULT_CARD_NAVIGATION_NOT_READY" &&
            this.#isGenericXhsExploreUrl(asNonEmptyString(resolvedNavigation.details.observed_url))) {
            if (!this.chromeApi.tabs.update) {
                await detachDebugger();
                fail("RESULT_CARD_FOLLOWUP_NAVIGATION_UNAVAILABLE", "chrome.tabs.update is unavailable", {
                    ...resolvedNavigation.details,
                    target_url: target.targetUrl
                });
                return;
            }
            try {
                await this.chromeApi.tabs.update(sourceTab.id, {
                    url: target.targetUrl,
                    active: true
                });
            }
            catch (error) {
                await detachDebugger();
                fail("RESULT_CARD_FOLLOWUP_NAVIGATION_FAILED", error instanceof Error ? error.message : String(error), {
                    ...resolvedNavigation.details,
                    target_url: target.targetUrl
                });
                return;
            }
            resolvedNavigation = await this.#waitForXhsOpenResultCardNavigation({
                sourceTabId: sourceTab.id,
                noteId: target.noteId,
                targetUrl: target.targetUrl,
                timeoutMs: xhsOpenResultCardNavigationTimeoutMs
            });
        }
        if (!resolvedNavigation.ok) {
            await detachDebugger();
            fail(resolvedNavigation.reason, resolvedNavigation.message, resolvedNavigation.details);
            return;
        }
        if (detailNetworkCapture) {
            capturedRequestContextArtifact = await detailNetworkCapture.catch(() => null);
        }
        await detachDebugger();
        const resolvedTargetTabId = typeof resolvedNavigation.tab.id === "number"
            ? resolvedNavigation.tab.id
            : sourceTab.id;
        if (capturedRequestContextArtifact && resolvedTargetTabId !== sourceTab.id) {
            capturedRequestContextArtifact = null;
        }
        if (capturedRequestContextArtifact) {
            const capturedAt = asInteger(capturedRequestContextArtifact.captured_at) ?? Date.now();
            const pageContextNamespace = createPageContextNamespace(target.targetUrl);
            const shape = {
                command: "xhs.detail",
                method: "POST",
                pathname: DETAIL_ENDPOINT,
                note_id: target.noteId
            };
            capturedRequestContextArtifact = {
                ...capturedRequestContextArtifact,
                path: DETAIL_ENDPOINT,
                page_context_namespace: pageContextNamespace,
                shape_key: JSON.stringify(shape),
                shape,
                profile_ref: profile,
                session_id: sessionId,
                target_tab_id: resolvedTargetTabId,
                run_id: runId,
                action_ref: detailConsumerActionRef,
                page_url: target.targetUrl,
                referrer: target.targetUrl,
                template_identity: `captured:${runId}:${pageContextNamespace}:${JSON.stringify(shape)}:${capturedAt}`
            };
        }
        this.#emit({
            id: request.id,
            status: "success",
            summary: {
                session_id: sessionId,
                run_id: runId,
                command: "runtime.xhs_open_result_card",
                profile,
                tab_id: resolvedTargetTabId,
                relay_path: "host>background"
            },
            payload: {
                target_tab_id: resolvedTargetTabId,
                target_page: "explore_detail_tab",
                target_url: target.targetUrl,
                result_card_open_evidence: {
                    action_ref: actionRef,
                    source_tab_id: sourceTab.id,
                    target_tab_id: resolvedTargetTabId,
                    source_page_url: sourceUrl,
                    target_page_url: target.targetUrl,
                    note_id: target.noteId,
                    original_href: target.originalHref,
                    xsec_source: xsecSource,
                    result_card_locator: target.locator,
                    result_card_target_key: target.targetKey
                },
                captured_request_context_artifact: capturedRequestContextArtifact
            },
            error: null
        });
    }
    async #handleRuntimeMainWorldProbe(request) {
        const tabId = await this.#resolveTargetTabId(request);
        const commandParams = asRecord(request.params.command_params) ?? {};
        const mainWorldSecret = asNonEmptyString(commandParams.main_world_secret);
        const fingerprintRuntime = asRecord(commandParams.fingerprint_runtime);
        const targetDomain = asNonEmptyString(commandParams.target_domain);
        const targetPage = asNonEmptyString(commandParams.target_page);
        const actionRef = asNonEmptyString(commandParams.action_ref) ??
            asNonEmptyString(commandParams.gate_invocation_id) ??
            String(request.params.run_id ?? request.id);
        const profile = typeof request.profile === "string" ? request.profile : null;
        const runId = String(request.params.run_id ?? request.id);
        const sessionId = String(request.params.session_id ?? this.#sessionId);
        const managedTabBindingGate = asRecord(commandParams.managed_tab_binding_gate);
        if (!tabId || !mainWorldSecret) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_RUNTIME_READY_SIGNAL_CONFLICT",
                    message: "runtime.main_world_probe requires target_tab_id and main_world_secret"
                }
            });
            return;
        }
        if (managedTabBindingGate) {
            const gateAllowed = isManagedTabBindingGateAllowed(managedTabBindingGate, profile, runId, sessionId, targetDomain, targetPage, tabId, actionRef);
            const bootstrap = profile ? this.#runtimeTrustState.getBootstrap(profile) : null;
            const trusted = profile ? this.#runtimeTrustState.getTrusted(profile, sessionId) : null;
            const bootstrapBindsTarget = !!bootstrap &&
                (bootstrap.status === "pending" || bootstrap.status === "ready") &&
                bootstrap.sessionId === sessionId &&
                bootstrap.runId === runId &&
                bootstrap.sourceTabId === tabId &&
                bootstrap.sourceDomain === targetDomain;
            const trustedBindsTarget = !!trusted &&
                trusted.sessionId === sessionId &&
                trusted.runId === runId &&
                trusted.sourceTabId === tabId &&
                trusted.sourceDomain === targetDomain;
            if (!gateAllowed || (!bootstrapBindsTarget && !trustedBindsTarget)) {
                this.#emit({
                    id: request.id,
                    status: "error",
                    summary: {
                        session_id: sessionId,
                        run_id: runId,
                        command: "runtime.main_world_probe",
                        profile,
                        tab_id: tabId,
                        relay_path: "host>background"
                    },
                    payload: {
                        details: {
                            stage: "execution",
                            reason: "XHS_CLOSEOUT_VALIDATION_SOURCE_MANAGED_TAB_NOT_BOUND",
                            target_domain: targetDomain,
                            target_page: targetPage,
                            target_tab_id: tabId,
                            action_ref: actionRef,
                            bootstrap_source_tab_id: bootstrap?.sourceTabId ?? null,
                            bootstrap_source_domain: bootstrap?.sourceDomain ?? null,
                            bootstrap_run_id: bootstrap?.runId ?? null,
                            trusted_source_tab_id: trusted?.sourceTabId ?? null,
                            trusted_source_domain: trusted?.sourceDomain ?? null,
                            trusted_run_id: trusted?.runId ?? null,
                            active_fetch_performed: false,
                            closeout_bundle_entered: false
                        }
                    },
                    error: {
                        code: "ERR_TRANSPORT_FORWARD_FAILED",
                        message: "runtime.main_world_probe requires a current managed tab binding"
                    }
                });
                return;
            }
        }
        if (!this.chromeApi.scripting?.executeScript) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "chrome.scripting.executeScript is unavailable"
                }
            });
            return;
        }
        const { requestEvent, resultEvent, namespaceEvent } = resolveMainWorldEventNamesForSecret(mainWorldSecret);
        try {
            const results = await this.chromeApi.scripting.executeScript({
                target: { tabId },
                world: "MAIN",
                func: async (requestEventName, resultEventName, namespaceEventName, fingerprintRuntimePayload) => {
                    const MAIN_WORLD_EVENT_BOOTSTRAP = "__mw_bootstrap__";
                    const requestEvent = typeof requestEventName === "string" ? requestEventName : "";
                    const resultEvent = typeof resultEventName === "string" ? resultEventName : "";
                    const namespaceEvent = typeof namespaceEventName === "string" ? namespaceEventName : "";
                    const state = {
                        ready_state: document.readyState,
                        href: location.href,
                        plugins_length: typeof navigator.plugins?.length === "number" ? navigator.plugins.length : null,
                        mime_types_length: typeof navigator.mimeTypes?.length === "number" ? navigator.mimeTypes.length : null,
                        has_get_battery: typeof navigator.getBattery === "function"
                    };
                    if (!requestEvent || !resultEvent || !namespaceEvent) {
                        return {
                            ...state,
                            probe_response_received: false,
                            error: "invalid probe event names"
                        };
                    }
                    return await new Promise((resolve) => {
                        let settled = false;
                        const timer = setTimeout(() => {
                            if (settled) {
                                return;
                            }
                            settled = true;
                            window.removeEventListener(resultEvent, onResult);
                            resolve({
                                ...state,
                                probe_response_received: false,
                                error: "main world probe timeout"
                            });
                        }, 1_500);
                        const onResult = (event) => {
                            if (settled) {
                                return;
                            }
                            settled = true;
                            clearTimeout(timer);
                            window.removeEventListener(resultEvent, onResult);
                            const detail = typeof event.detail === "object" &&
                                event.detail !== null
                                ? event.detail
                                : null;
                            resolve({
                                ...state,
                                probe_response_received: true,
                                probe_result: detail
                            });
                        };
                        window.addEventListener(resultEvent, onResult);
                        window.dispatchEvent(new CustomEvent(MAIN_WORLD_EVENT_BOOTSTRAP, {
                            detail: {
                                request_event: requestEvent,
                                result_event: resultEvent,
                                namespace_event: namespaceEvent
                            }
                        }));
                        window.dispatchEvent(new CustomEvent(requestEvent, {
                            detail: {
                                id: `probe-${Date.now()}`,
                                type: "fingerprint-install",
                                payload: {
                                    fingerprint_runtime: typeof fingerprintRuntimePayload === "object" &&
                                        fingerprintRuntimePayload !== null
                                        ? fingerprintRuntimePayload
                                        : null
                                }
                            }
                        }));
                    });
                },
                args: [requestEvent, resultEvent, namespaceEvent, fingerprintRuntime]
            });
            const payload = Array.isArray(results) && results.length > 0
                ? results[0]?.result
                : undefined;
            this.#emit({
                id: request.id,
                status: "success",
                summary: {
                    session_id: String(request.params.session_id ?? this.#sessionId),
                    run_id: String(request.params.run_id ?? request.id),
                    command: "runtime.main_world_probe",
                    profile: typeof request.profile === "string" ? request.profile : null,
                    tab_id: tabId,
                    relay_path: "host>background>main-world>background>host"
                },
                payload: {
                    target_tab_id: tabId,
                    request_event: requestEvent,
                    result_event: resultEvent,
                    browser_attestation: {
                        source: "chrome_scripting_main_world",
                        execution_surface: "real_browser",
                        extension_surface: "background_service_worker",
                        run_id: runId,
                        session_id: sessionId,
                        profile,
                        target_domain: targetDomain,
                        target_page: targetPage,
                        target_tab_id: tabId,
                        action_ref: actionRef,
                        request_event: requestEvent,
                        result_event: resultEvent
                    },
                    ...(payload ? { probe: payload } : {})
                },
                error: null
            });
        }
        catch (error) {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background>main-world>background>host"
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
    #handleRuntimeTrustedFingerprintProbe(request) {
        const profile = asNonEmptyString(request.profile);
        const sessionId = asNonEmptyString(request.params.session_id) ?? this.#sessionId;
        const bootstrap = profile ? this.#runtimeTrustState.getBootstrap(profile) : null;
        const sourceBinding = this.#resolveRequestTargetBinding(request);
        const trusted = profile !== null
            ? this.#runtimeTrustState.getTrusted(profile, sessionId)
            : null;
        const profileEntries = profile === null
            ? []
            : this.#runtimeTrustState.listTrustedByProfile(profile)
                .map(([key, entry]) => ({
                key,
                session_id: entry.sessionId,
                run_id: entry.runId,
                runtime_context_id: entry.runtimeContextId,
                source_tab_id: entry.sourceTabId,
                source_domain: entry.sourceDomain
            }));
        this.#emit({
            id: request.id,
            status: "success",
            summary: {
                session_id: sessionId,
                run_id: String(request.params.run_id ?? request.id),
                command: "runtime.trusted_fingerprint_probe",
                profile,
                relay_path: "host>background"
            },
            payload: {
                trusted_context_present: trusted !== null,
                trusted_context: trusted
                    ? {
                        session_id: trusted.sessionId,
                        run_id: trusted.runId,
                        runtime_context_id: trusted.runtimeContextId,
                        source_tab_id: trusted.sourceTabId,
                        source_domain: trusted.sourceDomain,
                        fingerprint_runtime: trusted.fingerprintRuntime
                    }
                    : null,
                debug: {
                    background_session_id: this.#sessionId,
                    request_session_id: sessionId,
                    resolved_request_target_binding: sourceBinding
                        ? {
                            tab_id: sourceBinding.tabId,
                            domain: sourceBinding.domain,
                            page: sourceBinding.page
                        }
                        : null,
                    bootstrap_state: bootstrap
                        ? {
                            session_id: bootstrap.sessionId,
                            run_id: bootstrap.runId,
                            runtime_context_id: bootstrap.runtimeContextId,
                            status: bootstrap.status
                        }
                        : null,
                    profile_entries: profileEntries
                }
            },
            error: null
        });
    }
    async #handleRuntimeReadiness(request) {
        const profile = asNonEmptyString(request.profile);
        const bootstrap = profile ? this.#runtimeTrustState.getBootstrap(profile) : null;
        const trusted = profile ? this.#runtimeTrustState.getTrusted(profile, this.#sessionId) : null;
        const requestRunId = asNonEmptyString(request.params.run_id);
        const readinessCommandParams = asRecord(request.params.command_params) ?? {};
        const requestRuntimeContextId = asNonEmptyString(readinessCommandParams.runtime_context_id);
        const sessionMatches = !!bootstrap && bootstrap.sessionId === this.#sessionId;
        const runMatches = !!bootstrap && !!requestRunId && bootstrap.runId === requestRunId;
        const runtimeContextMatches = !!bootstrap &&
            (!requestRuntimeContextId || bootstrap.runtimeContextId === requestRuntimeContextId);
        const { binding: requestTargetBinding, requested: targetBindingRequested } = await this.#resolveRuntimeReadinessTargetBinding(request);
        const observedTargetBindingMatches = targetBindingRequested && requestTargetBinding
            ? await this.#doesObservedTabMatchRuntimeTargetBinding(requestTargetBinding)
            : false;
        const bootstrapTargetBindingMatches = !!bootstrap &&
            this.#doesStrictTargetBindingMatch(requestTargetBinding, bootstrap, {
                requirePage: true,
                allowMissingStoredPage: true
            });
        const trustedTargetBindingMatches = !!trusted &&
            trusted.sessionId === this.#sessionId &&
            (!bootstrap || trusted.runId === bootstrap.runId) &&
            (!bootstrap || trusted.runtimeContextId === bootstrap.runtimeContextId) &&
            this.#doesStrictTargetBindingMatch(requestTargetBinding, trusted, {
                requirePage: true,
                allowMissingStoredPage: true
            });
        const targetBindingMatches = !targetBindingRequested ||
            bootstrapTargetBindingMatches ||
            trustedTargetBindingMatches ||
            observedTargetBindingMatches;
        const bootstrapState = bootstrap === null
            ? "not_started"
            : sessionMatches && runMatches && runtimeContextMatches
                ? targetBindingMatches
                    ? bootstrap.status
                    : bootstrap.status === "ready"
                        ? "pending"
                        : bootstrap.status
                : "stale";
        const managedTargetTabId = targetBindingRequested && targetBindingMatches && typeof bootstrap?.sourceTabId === "number"
            ? bootstrap.sourceTabId
            : targetBindingRequested && targetBindingMatches && typeof trusted?.sourceTabId === "number"
                ? trusted.sourceTabId
                : targetBindingRequested && targetBindingMatches && observedTargetBindingMatches
                    ? requestTargetBinding?.tabId ?? null
                    : null;
        const managedTargetDomain = targetBindingRequested && targetBindingMatches && typeof bootstrap?.sourceDomain === "string"
            ? bootstrap.sourceDomain
            : targetBindingRequested && targetBindingMatches && typeof trusted?.sourceDomain === "string"
                ? trusted.sourceDomain
                : targetBindingRequested && targetBindingMatches && observedTargetBindingMatches
                    ? requestTargetBinding?.domain ?? null
                    : null;
        const managedTargetPage = targetBindingRequested && targetBindingMatches && requestTargetBinding?.page
            ? requestTargetBinding.page
            : null;
        const targetTabContinuity = managedTargetTabId !== null && managedTargetDomain !== null && managedTargetPage !== null
            ? "runtime_trust_state"
            : null;
        const observedRuntimeSessionId = targetTabContinuity === "runtime_trust_state" && bootstrap ? this.#sessionId : null;
        const observedRuntimeInstanceId = targetTabContinuity === "runtime_trust_state" && bootstrap
            ? buildObservedRuntimeInstanceId({
                sessionId: this.#sessionId,
                runId: bootstrap.runId,
                runtimeContextId: bootstrap.runtimeContextId
            })
            : null;
        const takeoverEvidenceObservedAt = targetTabContinuity === "runtime_trust_state" ? new Date().toISOString() : null;
        if (profile &&
            requestRunId &&
            requestRuntimeContextId &&
            managedTargetTabId !== null &&
            managedTargetDomain !== null &&
            managedTargetPage !== null &&
            observedRuntimeSessionId !== null &&
            observedRuntimeInstanceId !== null &&
            targetTabContinuity === "runtime_trust_state") {
            this.#upsertStaleRestoreBindingLease(profile, {
                sessionId: this.#sessionId,
                runId: requestRunId,
                runtimeContextId: requestRuntimeContextId,
                targetTabId: managedTargetTabId,
                targetDomain: managedTargetDomain,
                targetPage: managedTargetPage,
                observedRuntimeSessionId,
                observedRuntimeInstanceId,
                issuedAtMs: Date.now()
            });
        }
        else if (profile) {
            this.#staleRestoreBindingLeases.delete(this.#buildStaleRestoreBindingLeaseKey(profile, this.#sessionId));
        }
        this.#emit({
            id: request.id,
            status: "success",
            summary: {
                session_id: this.#sessionId,
                run_id: String(request.params.run_id ?? request.id),
                command: "runtime.readiness",
                profile,
                relay_path: "host>background"
            },
            payload: {
                profile,
                bootstrap_state: bootstrapState,
                run_id: bootstrap?.runId ?? null,
                runtime_context_id: bootstrap?.runtimeContextId ?? null,
                version: bootstrap?.version ?? null,
                managed_target_tab_id: managedTargetTabId,
                managed_target_domain: managedTargetDomain,
                managed_target_page: managedTargetPage,
                target_tab_continuity: targetTabContinuity,
                observed_runtime_session_id: observedRuntimeSessionId,
                observed_runtime_instance_id: observedRuntimeInstanceId,
                takeover_evidence_observed_at: takeoverEvidenceObservedAt,
                transport_state: "ready"
            },
            error: null
        });
    }
    async #doesObservedTabMatchRuntimeTargetBinding(requestTargetBinding) {
        if (!this.chromeApi.tabs?.get) {
            return false;
        }
        try {
            const tab = await this.chromeApi.tabs.get(requestTargetBinding.tabId);
            const tabUrl = typeof tab.url === "string" ? tab.url : "";
            const parsed = parseUrl(tabUrl);
            if (!parsed || parsed.hostname !== requestTargetBinding.domain) {
                return false;
            }
            if (requestTargetBinding.page === "search_result_tab") {
                return parsed.pathname.includes("/search_result");
            }
            return requestTargetBinding.page === null;
        }
        catch {
            return false;
        }
    }
    async #resolveRuntimeReadinessTargetBinding(request) {
        const explicitBinding = this.#resolveRequestTargetBinding(request);
        if (explicitBinding) {
            return {
                binding: explicitBinding,
                requested: true
            };
        }
        const commandParams = asRecord(request.params.command_params) ?? {};
        const options = asRecord(commandParams.options);
        const readTarget = (key) => Object.prototype.hasOwnProperty.call(commandParams, key)
            ? commandParams[key]
            : options?.[key];
        const targetDomain = asNonEmptyString(readTarget("target_domain"));
        const targetPage = asNonEmptyString(readTarget("target_page"));
        const preferredPage = resolvePreferredXhsReadPage("runtime.bootstrap", targetPage);
        if (!targetDomain || !XHS_DOMAIN_ALLOWLIST.has(targetDomain) || !preferredPage) {
            return {
                binding: null,
                requested: false
            };
        }
        const requestedResourceId = resolveRuntimeBootstrapRequestedXhsResourceId(commandParams, preferredPage);
        const targetTabId = await resolveRuntimeBootstrapReadTargetTabId(this.chromeApi, preferredPage, requestedResourceId);
        if (targetTabId === null) {
            return {
                binding: null,
                requested: true
            };
        }
        return {
            binding: {
                tabId: targetTabId,
                domain: targetDomain,
                page: preferredPage
            },
            requested: true
        };
    }
    async #handleRuntimeBootstrapForwardResult(input) {
        const profile = asNonEmptyString(input.request.profile);
        const bootstrap = profile ? this.#runtimeTrustState.getBootstrap(profile) : null;
        const ackResult = asRecord(input.payload.result);
        const ackVersion = asNonEmptyString(ackResult?.version);
        const ackRunId = asNonEmptyString(ackResult?.run_id);
        const ackRuntimeContextId = asNonEmptyString(ackResult?.runtime_context_id);
        const ackProfile = asNonEmptyString(ackResult?.profile);
        const ackStatus = asNonEmptyString(ackResult?.status);
        if (input.result.ok !== true) {
            if (bootstrap && profile) {
                bootstrap.status = "pending";
                bootstrap.updatedAt = new Date().toISOString();
                this.#runtimeTrustState.setBootstrap(profile, bootstrap);
            }
            if (input.suppressHostResponse) {
                return;
            }
            this.#emit({
                id: input.request.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                payload: input.payload,
                error: input.result.error ?? {
                    code: "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED",
                    message: "runtime bootstrap 尚未获得执行面确认"
                }
            });
            return;
        }
        if (!bootstrap || !profile || !ackVersion || !ackRunId || !ackRuntimeContextId || !ackProfile || !ackStatus) {
            if (input.suppressHostResponse) {
                return;
            }
            this.#emit({
                id: input.request.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                payload: input.payload,
                error: {
                    code: "ERR_RUNTIME_READY_SIGNAL_CONFLICT",
                    message: "runtime bootstrap ack 与当前运行上下文不一致"
                }
            });
            return;
        }
        const isContextMatch = ackVersion === bootstrap.version &&
            ackRunId === bootstrap.runId &&
            ackRuntimeContextId === bootstrap.runtimeContextId &&
            ackProfile === bootstrap.profile;
        const ackExecutionAttested = hasSuccessfulExecutionAttestation(input.payload);
        const requestTargetBinding = this.#resolveRequestTargetBinding(input.request);
        const senderBinding = await this.#resolveStartupTrustSenderBinding(input.sender);
        if (requestTargetBinding &&
            !this.#doesStrictTargetBindingMatch(requestTargetBinding, {
                sourceTabId: senderBinding?.tabId ?? null,
                sourceDomain: senderBinding?.domain ?? null,
                sourcePage: senderBinding?.page ?? null
            }, {
                requirePage: requestTargetBinding.page !== null
            })) {
            bootstrap.status = "failed";
            bootstrap.updatedAt = new Date().toISOString();
            this.#runtimeTrustState.setBootstrap(profile, bootstrap);
            if (input.suppressHostResponse) {
                return;
            }
            this.#emit({
                id: input.request.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                payload: input.payload,
                error: {
                    code: "ERR_RUNTIME_READY_SIGNAL_CONFLICT",
                    message: "runtime bootstrap ack target_page 与当前执行 tab 不一致"
                }
            });
            return;
        }
        if (!isContextMatch || !ackExecutionAttested || (ackStatus !== "ready" && ackStatus !== "stale")) {
            bootstrap.status = "failed";
            bootstrap.updatedAt = new Date().toISOString();
            this.#runtimeTrustState.setBootstrap(profile, bootstrap);
            if (input.suppressHostResponse) {
                return;
            }
            this.#emit({
                id: input.request.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                payload: input.payload,
                error: {
                    code: "ERR_RUNTIME_READY_SIGNAL_CONFLICT",
                    message: "runtime bootstrap ack 与当前运行上下文不一致"
                }
            });
            return;
        }
        const sourceBinding = senderBinding ?? requestTargetBinding;
        if (ackStatus === "stale") {
            if (sourceBinding) {
                bootstrap.sourceTabId = sourceBinding.tabId;
                bootstrap.sourceDomain = sourceBinding.domain;
                bootstrap.sourcePage = sourceBinding.page;
            }
            bootstrap.status = "stale";
            bootstrap.updatedAt = new Date().toISOString();
            this.#runtimeTrustState.setBootstrap(profile, bootstrap);
            if (input.suppressHostResponse) {
                return;
            }
            this.#emit({
                id: input.request.id,
                status: "success",
                summary: {
                    session_id: String(input.request.params.session_id ?? "nm-session-001"),
                    run_id: String(input.request.params.run_id ?? input.request.id),
                    command: String(input.request.params.command ?? "runtime.bootstrap"),
                    profile,
                    cwd: String(input.request.params.cwd ?? ""),
                    tab_id: input.sender.tab?.id ?? null,
                    relay_path: "host>background>content-script>background>host"
                },
                payload: input.payload,
                error: null
            });
            return;
        }
        if (sourceBinding) {
            bootstrap.sourceTabId = sourceBinding.tabId;
            bootstrap.sourceDomain = sourceBinding.domain;
            bootstrap.sourcePage = sourceBinding.page;
        }
        bootstrap.status = "ready";
        bootstrap.updatedAt = new Date().toISOString();
        this.#runtimeTrustState.setBootstrap(profile, bootstrap);
        const attestedFingerprintRuntime = resolveAttestedFingerprintRuntimeContext(input.payload.fingerprint_runtime ?? null);
        if (attestedFingerprintRuntime &&
            attestedFingerprintRuntime.profile === profile &&
            sourceBinding) {
            this.#upsertTrustedFingerprintContext(profile, bootstrap.sessionId, attestedFingerprintRuntime, {
                sourceTabId: sourceBinding.tabId,
                sourceDomain: sourceBinding.domain,
                sourcePage: sourceBinding.page,
                runId: bootstrap.runId,
                runtimeContextId: bootstrap.runtimeContextId
            });
        }
        if (input.suppressHostResponse) {
            return;
        }
        this.#emit({
            id: input.request.id,
            status: "success",
            summary: {
                session_id: String(input.request.params.session_id ?? "nm-session-001"),
                run_id: String(input.request.params.run_id ?? input.request.id),
                command: String(input.request.params.command ?? "runtime.bootstrap"),
                profile,
                cwd: String(input.request.params.cwd ?? ""),
                tab_id: input.sender.tab?.id ?? null,
                relay_path: "host>background>content-script>background>host"
            },
            payload: input.payload,
            error: null
        });
    }
    #isRecoveryWindowOpen() {
        const deadline = this.#recoveryDeadlineMs;
        return deadline !== null && Date.now() < deadline;
    }
    #enqueueRecoveryForward(request) {
        this.#recoveryState.queueForward(request);
    }
    async #dispatchForward(request, deadlineMs, options) {
        const requestDeadlineMs = deadlineMs ?? Date.now() + this.#resolveForwardTimeoutMs(request);
        const suppressHostResponse = options?.suppressHostResponse === true;
        const command = String(request.params.command ?? "");
        let dispatchRequest = request;
        if (command === "xhs.interact") {
            this.#emit({
                id: request.id,
                status: "error",
                summary: {},
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "unsupported command"
                }
            });
            return;
        }
        this.#invalidateTrustedFingerprintContextForCommand(request, command);
        const rawCommandParams = typeof request.params.command_params === "object" && request.params.command_params !== null
            ? request.params.command_params
            : {};
        let commandParams = XHS_GATE_COMMANDS.has(command)
            ? normalizeXhsSearchCommandParams(rawCommandParams)
            : rawCommandParams;
        const activeSessionId = asNonEmptyString(this.#sessionId) ?? asNonEmptyString(request.params.session_id);
        if (activeSessionId) {
            dispatchRequest = {
                ...request,
                params: {
                    ...request.params,
                    session_id: activeSessionId
                }
            };
            if (XHS_GATE_COMMANDS.has(command)) {
                commandParams = bindXhsCommandParamsToSession({
                    commandParams,
                    sessionId: activeSessionId
                });
                dispatchRequest = {
                    ...dispatchRequest,
                    params: {
                        ...dispatchRequest.params,
                        command_params: commandParams
                    }
                };
            }
        }
        if (XHS_GATE_COMMANDS.has(command)) {
            try {
                validateXhsCommandInputContract(command, commandParams);
            }
            catch (error) {
                if (error instanceof ExtensionContractError && error.code === "ERR_CLI_INVALID_ARGS") {
                    emitCliInvalidArgs(this.#emit.bind(this), request, error);
                    return;
                }
                throw error;
            }
        }
        let xhsForwardState = resolveDispatchXhsForwardState(command, commandParams);
        let requestedFingerprintContext = xhsForwardState.requestedFingerprintContext;
        let forwardFingerprintContext = requestedFingerprintContext;
        let tabId;
        let consumerGateResult;
        let gatePayload;
        const runXhsPreForwardStage = async (stage, operation) => {
            const remainingMs = requestDeadlineMs - Date.now();
            if (!XHS_GATE_COMMANDS.has(command) || remainingMs <= 0) {
                return operation;
            }
            const timeoutMs = Math.max(1, Math.min(xhsPreForwardStageTimeoutMs, remainingMs));
            let timeout = null;
            try {
                return await Promise.race([
                    operation,
                    new Promise((resolve) => {
                        timeout = setTimeout(() => resolve(null), timeoutMs);
                    })
                ]);
            }
            finally {
                if (timeout) {
                    clearTimeout(timeout);
                }
            }
        };
        const emitXhsPreForwardTimeout = (stage) => {
            if (suppressHostResponse) {
                return;
            }
            this.#emit({
                id: dispatchRequest.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                payload: {
                    ...(gatePayload ? { ...gatePayload } : {}),
                    details: {
                        ...(asRecord(gatePayload?.details) ?? {}),
                        stage: "execution",
                        reason: "CONTENT_SCRIPT_FORWARD_TIMEOUT",
                        forward_failure_stage: stage,
                        target_domain: consumerGateResult?.target_domain ?? null,
                        target_tab_id: consumerGateResult?.target_tab_id ?? null,
                        target_page: consumerGateResult?.target_page ?? null,
                        timeout_ms: xhsPreForwardStageTimeoutMs,
                        native_timeout_ms: Math.max(1, Math.floor(requestDeadlineMs - Date.now()))
                    },
                    diagnosis: {
                        category: "runtime_unavailable",
                        stage: "runtime",
                        component: "background",
                        failure_site: {
                            stage: "runtime",
                            component: "background",
                            target: command,
                            summary: `${stage} did not finish before the native bridge deadline`
                        },
                        evidence: [`xhs_pre_forward_stage=${stage}`]
                    }
                },
                error: {
                    code: "ERR_EXECUTION_FAILED",
                    message: `${stage} did not finish before the native bridge deadline`
                }
            });
        };
        if (XHS_GATE_COMMANDS.has(command)) {
            const gateResult = await runXhsPreForwardStage("xhs_target_gate", this.#evaluateXhsTargetGate({
                ...dispatchRequest,
                params: {
                    ...dispatchRequest.params,
                    command_params: commandParams
                }
            }));
            if (gateResult === null) {
                emitXhsPreForwardTimeout("xhs_target_gate");
                return;
            }
            consumerGateResult = gateResult.consumerGateResult;
            gatePayload = gateResult.gatePayload;
            if (!gateResult.allowed || (!gateResult.targetTabId && !gateResult.gateOnly)) {
                const gateFailureReason = gateResult.consumerGateResult.gate_reasons[0] ?? "TARGET_TAB_NOT_EXPLICIT";
                const existingDetails = asRecord(gateResult.gatePayload.details) ?? {};
                this.#emit({
                    id: dispatchRequest.id,
                    status: "error",
                    summary: {
                        relay_path: "host>background>content-script>background>host"
                    },
                    payload: {
                        ...gateResult.gatePayload,
                        details: {
                            ...existingDetails,
                            stage: "execution",
                            reason: gateFailureReason,
                            forward_failure_stage: "gate_target_resolve",
                            target_domain: gateResult.consumerGateResult.target_domain,
                            target_tab_id: gateResult.consumerGateResult.target_tab_id,
                            target_page: gateResult.consumerGateResult.target_page
                        }
                    },
                    error: {
                        code: "ERR_TRANSPORT_FORWARD_FAILED",
                        message: gateResult.errorMessage
                    }
                });
                return;
            }
            if (gateResult.gateOnly) {
                this.#emit({
                    id: dispatchRequest.id,
                    status: "success",
                    summary: {
                        session_id: String(dispatchRequest.params.session_id ?? "nm-session-001"),
                        run_id: String(dispatchRequest.params.run_id ?? dispatchRequest.id),
                        command,
                        profile: typeof dispatchRequest.profile === "string" ? dispatchRequest.profile : null,
                        cwd: String(dispatchRequest.params.cwd ?? ""),
                        tab_id: null,
                        relay_path: "host>background"
                    },
                    payload: createBridgeXhsGateOnlyPayload(dispatchRequest, gateResult.gatePayload),
                    error: null
                });
                return;
            }
            tabId = gateResult.targetTabId;
            commandParams = gateResult.forwardCommandParams;
            dispatchRequest = {
                ...dispatchRequest,
                params: {
                    ...dispatchRequest.params,
                    command_params: commandParams
                }
            };
            xhsForwardState = resolveDispatchXhsForwardState(command, commandParams);
            requestedFingerprintContext = xhsForwardState.requestedFingerprintContext;
            forwardFingerprintContext =
                this.#resolveValidatedTrustedFingerprintContext({
                    ...dispatchRequest,
                    params: {
                        ...dispatchRequest.params,
                        command_params: commandParams
                    }
                }, requestedFingerprintContext) ?? requestedFingerprintContext;
        }
        else {
            tabId = await this.#resolveTargetTabId(dispatchRequest);
        }
        if (!tabId) {
            if (suppressHostResponse) {
                return;
            }
            this.#emit({
                id: dispatchRequest.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                payload: {
                    details: {
                        stage: "execution",
                        reason: "TARGET_TAB_UNAVAILABLE",
                        forward_failure_stage: "target_tab_resolve"
                    }
                },
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "target tab is unavailable"
                }
            });
            return;
        }
        const readyBootstrapMainWorldSecret = this.#resolveReadyBootstrapMainWorldSecret(dispatchRequest, command);
        if (readyBootstrapMainWorldSecret) {
            commandParams = {
                ...commandParams,
                main_world_secret: readyBootstrapMainWorldSecret
            };
            dispatchRequest = {
                ...dispatchRequest,
                params: {
                    ...dispatchRequest.params,
                    command_params: commandParams
                }
            };
        }
        if (this.#shouldEnsureMainWorldBridge(command, xhsForwardState.requestedExecutionMode)) {
            try {
                const injected = await runXhsPreForwardStage("main_world_bridge_injection", this.#ensureMainWorldBridgeInjected(dispatchRequest, tabId).then(() => true));
                if (injected === null) {
                    emitXhsPreForwardTimeout("main_world_bridge_injection");
                    return;
                }
            }
            catch (error) {
                if (suppressHostResponse) {
                    return;
                }
                this.#emit({
                    id: dispatchRequest.id,
                    status: "error",
                    summary: {
                        relay_path: "host>background>main-world>background>host"
                    },
                    error: {
                        code: "ERR_TRANSPORT_FORWARD_FAILED",
                        message: error instanceof Error ? error.message : "main world bridge injection failed"
                    }
                });
                return;
            }
        }
        if (XHS_GATE_COMMANDS.has(command)) {
            try {
                const injected = await runXhsPreForwardStage("content_script_injection", this.#ensureContentScriptInjected(tabId).then(() => true));
                if (injected === null) {
                    emitXhsPreForwardTimeout("content_script_injection");
                    return;
                }
            }
            catch (error) {
                if (suppressHostResponse) {
                    return;
                }
                this.#emit({
                    id: dispatchRequest.id,
                    status: "error",
                    summary: {
                        relay_path: "host>background>content-script>background>host"
                    },
                    error: {
                        code: "ERR_TRANSPORT_FORWARD_FAILED",
                        message: error instanceof Error ? error.message : "content script injection failed"
                    }
                });
                return;
            }
        }
        if (xhsForwardState.issue208EditorInputValidation) {
            const editorFocusAttestation = await runXhsPreForwardStage("editor_focus_attestation", this.#buildEditorInputFocusAttestation(tabId));
            if (editorFocusAttestation === null) {
                emitXhsPreForwardTimeout("editor_focus_attestation");
                return;
            }
            commandParams = this.#injectEditorFocusAttestation(commandParams, editorFocusAttestation);
            dispatchRequest = {
                ...dispatchRequest,
                params: {
                    ...dispatchRequest.params,
                    command_params: commandParams
                }
            };
        }
        const timeoutMs = requestDeadlineMs - Date.now();
        if (timeoutMs <= 0) {
            if (suppressHostResponse) {
                return;
            }
            this.#emit({
                id: dispatchRequest.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                error: {
                    code: "ERR_TRANSPORT_TIMEOUT",
                    message: "forward request timed out during recovery"
                }
            });
            return;
        }
        const forwardTimeoutMs = Math.max(1, Math.floor(timeoutMs));
        const pendingTimeoutMs = XHS_GATE_COMMANDS.has(command) || command === "runtime.bootstrap"
            ? reserveXhsForwardResponseSafetyMs(forwardTimeoutMs)
            : forwardTimeoutMs;
        const timeoutError = command === "runtime.bootstrap"
            ? {
                code: "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED",
                message: "runtime bootstrap 尚未获得执行面确认"
            }
            : {
                code: "ERR_TRANSPORT_TIMEOUT",
                message: "content script forward timed out"
            };
        const timeout = setTimeout(() => {
            if (!XHS_GATE_COMMANDS.has(command)) {
                this.#failPending(dispatchRequest.id, {
                    code: timeoutError.code,
                    message: timeoutError.message
                });
                return;
            }
            const pending = this.#pendingState.take(dispatchRequest.id);
            if (!pending || pending.suppressHostResponse === true) {
                return;
            }
            this.#emit({
                id: dispatchRequest.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                payload: {
                    ...(pending.gatePayload ? { ...pending.gatePayload } : {}),
                    details: {
                        ...(asRecord(pending.gatePayload?.details) ?? {}),
                        stage: "execution",
                        reason: "CONTENT_SCRIPT_FORWARD_TIMEOUT",
                        forward_failure_stage: "content_script_forward_timeout",
                        target_domain: consumerGateResult?.target_domain ?? null,
                        target_tab_id: consumerGateResult?.target_tab_id ?? tabId,
                        target_page: consumerGateResult?.target_page ?? null,
                        timeout_ms: pendingTimeoutMs,
                        native_timeout_ms: forwardTimeoutMs
                    },
                    diagnosis: {
                        category: "runtime_unavailable",
                        stage: "runtime",
                        component: "content-script",
                        failure_site: {
                            stage: "runtime",
                            component: "content-script",
                            target: command,
                            summary: "content script did not return before the native bridge deadline"
                        },
                        evidence: [
                            `content_script_forward_timeout_ms=${pendingTimeoutMs}`,
                            `native_forward_timeout_ms=${forwardTimeoutMs}`
                        ]
                    }
                },
                error: {
                    code: "ERR_EXECUTION_FAILED",
                    message: "content script did not return before the native bridge deadline"
                }
            });
        }, pendingTimeoutMs);
        this.#pendingState.register(dispatchRequest.id, {
            request: dispatchRequest,
            timeout,
            consumerGateResult,
            gatePayload,
            suppressHostResponse
        });
        const forward = {
            kind: "forward",
            id: dispatchRequest.id,
            runId: String(dispatchRequest.params.run_id ?? dispatchRequest.id),
            tabId,
            profile: typeof dispatchRequest.profile === "string" ? dispatchRequest.profile : null,
            cwd: String(dispatchRequest.params.cwd ?? ""),
            timeoutMs: forwardTimeoutMs,
            command: String(dispatchRequest.params.command ?? ""),
            params: typeof dispatchRequest.params === "object" && dispatchRequest.params !== null
                ? { ...dispatchRequest.params }
                : {},
            commandParams,
            fingerprintContext: forwardFingerprintContext
        };
        const dispatchFailurePayload = command === "runtime.bootstrap"
            ? {
                details: {
                    stage: "execution",
                    reason: "TARGET_TAB_DISPATCH_FAILED",
                    forward_failure_stage: "content_dispatch",
                    target_tab_id: tabId
                }
            }
            : undefined;
        try {
            await this.#sendMessageWithContentScriptRecovery(tabId, forward, dispatchRequest);
        }
        catch (error) {
            if (dispatchFailurePayload && !gatePayload) {
                const existing = this.#pendingState.take(dispatchRequest.id);
                if (!existing || existing.suppressHostResponse === true) {
                    return;
                }
                this.#emit({
                    id: dispatchRequest.id,
                    status: "error",
                    summary: {
                        relay_path: "host>background>content-script>background>host"
                    },
                    payload: dispatchFailurePayload,
                    error: {
                        code: "ERR_TRANSPORT_FORWARD_FAILED",
                        message: error instanceof Error ? error.message : "content script dispatch failed"
                    }
                });
                return;
            }
            this.#failPending(dispatchRequest.id, {
                code: "ERR_TRANSPORT_FORWARD_FAILED",
                message: error instanceof Error ? error.message : "content script dispatch failed"
            });
        }
    }
    #injectEditorFocusAttestation(commandParams, attestation) {
        const normalized = {
            ...commandParams,
            editor_focus_attestation: attestation
        };
        const optionParams = asRecord(commandParams.options);
        const normalizedOptions = optionParams ? { ...optionParams } : {};
        normalizedOptions.editor_focus_attestation = attestation;
        normalized.options = normalizedOptions;
        return normalized;
    }
    #buildEditorInputFocusAttestationRecord(input) {
        return {
            source: "chrome_debugger",
            target_tab_id: input.tabId,
            editable_state: input.editableState,
            focus_confirmed: input.focusConfirmed,
            entry_button_locator: input.entryButton?.locator ?? null,
            entry_button_target_key: input.entryButton?.targetKey ?? null,
            editor_locator: input.editor?.locator ?? null,
            editor_target_key: input.editor?.targetKey ?? null,
            failure_reason: input.failureReason
        };
    }
    #buildEditorInputFailureAttestation(tabId, failureReason, input) {
        return this.#buildEditorInputFocusAttestationRecord({
            tabId,
            editableState: input?.editableState ?? "already_ready",
            entryButton: input?.entryButton ?? null,
            editor: input?.editor ?? null,
            focusConfirmed: false,
            failureReason
        });
    }
    #buildEditorInputSuccessAttestation(tabId, input) {
        return this.#buildEditorInputFocusAttestationRecord({
            tabId,
            editableState: input.editableState,
            entryButton: input.entryButton,
            editor: input.editor,
            focusConfirmed: true,
            failureReason: null
        });
    }
    async #attachEditorInputDebugger(tabId) {
        const debuggerApi = this.chromeApi.debugger;
        if (!debuggerApi) {
            return false;
        }
        try {
            await debuggerApi.attach({ tabId }, debuggerProtocolVersion);
            return true;
        }
        catch {
            return false;
        }
    }
    async #resolveEditorInputAttestationAfterAttach(tabId, input) {
        const { editableState } = input;
        let entryButton = input.entryButton;
        let editor = input.editor;
        if (!editor) {
            return this.#buildEditorInputFailureAttestation(tabId, "EDITOR_ENTRY_NOT_VISIBLE", {
                editableState,
                entryButton,
                editor
            });
        }
        await this.#dispatchEditorInputDebuggerClick(tabId, editor);
        await this.#sleep(50);
        const finalProbe = await this.#probeEditorInputTargets(tabId);
        const focusConfirmed = finalProbe?.editorFocused === true;
        const finalEditor = finalProbe?.editor ?? editor;
        if (!focusConfirmed) {
            return this.#buildEditorInputFailureAttestation(tabId, "EDITOR_FOCUS_NOT_ATTESTED", {
                editableState,
                entryButton,
                editor: finalEditor
            });
        }
        return this.#buildEditorInputSuccessAttestation(tabId, {
            editableState,
            entryButton,
            editor: finalEditor
        });
    }
    async #buildEditorInputFocusAttestation(tabId) {
        const debuggerApi = this.chromeApi.debugger;
        const initialProbe = await this.#probeEditorInputTargets(tabId);
        if (!initialProbe) {
            return this.#buildEditorInputFailureAttestation(tabId, "DEBUGGER_INTERACTION_FAILED");
        }
        let entryButton = initialProbe.entryButton;
        const editor = initialProbe.editor;
        let editableState = "already_ready";
        const attached = await this.#attachEditorInputDebugger(tabId);
        if (!attached) {
            return this.#buildEditorInputFailureAttestation(tabId, "DEBUGGER_ATTACH_FAILED", {
                entryButton,
                editor
            });
        }
        try {
            if (!editor) {
                if (!entryButton) {
                    return this.#buildEditorInputFailureAttestation(tabId, "EDITOR_ENTRY_NOT_VISIBLE", {
                        entryButton,
                        editor
                    });
                }
                await this.#dispatchEditorInputDebuggerClick(tabId, entryButton);
                await this.#sleep(editorInputDebuggerProbeWaitMs);
                const postEntryProbe = await this.#probeEditorInputTargets(tabId);
                if (!postEntryProbe?.editor) {
                    return this.#buildEditorInputFailureAttestation(tabId, "EDITOR_ENTRY_NOT_VISIBLE", {
                        entryButton,
                        editor
                    });
                }
                editableState = "entered";
                entryButton = postEntryProbe.entryButton ?? entryButton;
                return await this.#resolveEditorInputAttestationAfterAttach(tabId, {
                    editableState,
                    entryButton,
                    editor: postEntryProbe.editor
                });
            }
            return await this.#resolveEditorInputAttestationAfterAttach(tabId, {
                editableState,
                entryButton,
                editor
            });
        }
        catch {
            return this.#buildEditorInputFailureAttestation(tabId, "DEBUGGER_INTERACTION_FAILED", {
                editableState,
                entryButton,
                editor
            });
        }
        finally {
            if (attached) {
                try {
                    await debuggerApi?.detach({ tabId });
                }
                catch {
                    // Swallow detach errors to avoid overriding primary failure semantics.
                }
            }
        }
    }
    async #probeEditorInputTargets(tabId) {
        const executeScript = this.chromeApi.scripting?.executeScript;
        if (!executeScript) {
            return null;
        }
        try {
            const results = await executeScript({
                target: { tabId },
                world: "ISOLATED",
                func: (entryLabels, selectors) => {
                    const labels = Array.isArray(entryLabels)
                        ? entryLabels.filter((item) => typeof item === "string")
                        : [];
                    const editorSelectors = Array.isArray(selectors)
                        ? selectors.filter((item) => typeof item === "string")
                        : [];
                    const asVisibleElement = (value) => {
                        if (!(value instanceof HTMLElement)) {
                            return null;
                        }
                        const rect = value.getBoundingClientRect();
                        const style = window.getComputedStyle(value);
                        if (rect.width <= 0 ||
                            rect.height <= 0 ||
                            style.visibility === "hidden" ||
                            style.display === "none") {
                            return null;
                        }
                        return value;
                    };
                    const buildLocator = (element) => {
                        if (typeof element.id === "string" && element.id.length > 0) {
                            return `#${element.id}`;
                        }
                        const className = typeof element.className === "string"
                            ? element.className
                                .split(/\s+/)
                                .map((token) => token.trim())
                                .filter((token) => token.length > 0)
                                .slice(0, 2)
                                .join(".")
                            : "";
                        if (className) {
                            return `${element.tagName.toLowerCase()}.${className}`;
                        }
                        return element.tagName.toLowerCase();
                    };
                    const buildTargetKey = (element) => {
                        const segments = [];
                        let current = element;
                        while (current) {
                            const parent = current.parentElement;
                            const tagName = current.tagName.toLowerCase();
                            if (!parent) {
                                segments.unshift(current.id ? `${tagName}#${current.id}` : tagName);
                                break;
                            }
                            const siblings = Array.from(parent.children).filter((candidate) => candidate instanceof HTMLElement && candidate.tagName === current?.tagName);
                            const position = siblings.indexOf(current) + 1;
                            const idSegment = current.id ? `#${current.id}` : "";
                            segments.unshift(`${tagName}${idSegment}:nth-of-type(${position})`);
                            current = parent;
                        }
                        return segments.join(" > ");
                    };
                    const toTarget = (element) => {
                        if (!element) {
                            return null;
                        }
                        const rect = element.getBoundingClientRect();
                        return {
                            locator: buildLocator(element),
                            targetKey: buildTargetKey(element),
                            centerX: Math.round(rect.left + rect.width / 2),
                            centerY: Math.round(rect.top + rect.height / 2)
                        };
                    };
                    const buttons = Array.from(document.querySelectorAll("button, [role='button']"))
                        .map((entry) => asVisibleElement(entry))
                        .filter((entry) => entry !== null);
                    let entryButton = null;
                    for (const button of buttons) {
                        const text = button.innerText?.trim() ?? button.textContent?.trim() ?? "";
                        if (labels.some((label) => text.includes(label))) {
                            entryButton = button;
                            break;
                        }
                    }
                    let editor = null;
                    for (const selector of editorSelectors) {
                        const candidates = Array.from(document.querySelectorAll(selector))
                            .map((entry) => asVisibleElement(entry))
                            .filter((entry) => entry !== null);
                        if (candidates.length > 0) {
                            const active = document.activeElement;
                            const activeCandidate = active instanceof Element
                                ? candidates.find((candidate) => candidate === active || candidate.contains(active)) ?? null
                                : null;
                            if (activeCandidate) {
                                editor = activeCandidate;
                            }
                            else if (candidates.length === 1) {
                                editor = candidates[0];
                            }
                            else {
                                editor = null;
                            }
                            break;
                        }
                    }
                    const active = document.activeElement;
                    const editorFocused = editor !== null &&
                        (active === editor ||
                            (active instanceof Element && editor.contains(active)));
                    return {
                        entryButton: toTarget(entryButton),
                        editor: toTarget(editor),
                        editorFocused
                    };
                },
                args: [[...editorInputDebuggerEntryLabels], [...editorInputSelectors]]
            });
            return this.#parseEditorInputProbeResult(results[0]?.result ?? null);
        }
        catch {
            return null;
        }
    }
    #parseEditorInputProbeResult(value) {
        const record = asRecord(value);
        if (!record) {
            return null;
        }
        return {
            entryButton: this.#parseEditorInputProbeTarget(record.entryButton),
            editor: this.#parseEditorInputProbeTarget(record.editor),
            editorFocused: record.editorFocused === true
        };
    }
    #parseEditorInputProbeTarget(value) {
        const record = asRecord(value);
        if (!record) {
            return null;
        }
        const locator = asNonEmptyString(record.locator);
        const targetKey = asNonEmptyString(record.targetKey);
        const centerX = typeof record.centerX === "number" ? record.centerX : null;
        const centerY = typeof record.centerY === "number" ? record.centerY : null;
        if (!locator ||
            !targetKey ||
            centerX === null ||
            centerY === null ||
            !Number.isFinite(centerX) ||
            !Number.isFinite(centerY)) {
            return null;
        }
        return {
            locator,
            targetKey,
            centerX,
            centerY
        };
    }
    async #dispatchEditorInputDebuggerClick(tabId, target) {
        const debuggerApi = this.chromeApi.debugger;
        if (!debuggerApi) {
            throw new Error("chrome.debugger is unavailable");
        }
        await debuggerApi.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x: target.centerX,
            y: target.centerY,
            button: "left",
            buttons: 0
        });
        await debuggerApi.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
            type: "mousePressed",
            x: target.centerX,
            y: target.centerY,
            button: "left",
            buttons: 1,
            clickCount: 1
        });
        await debuggerApi.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: target.centerX,
            y: target.centerY,
            button: "left",
            buttons: 0,
            clickCount: 1
        });
    }
    async #dispatchXhsResultCardDomClick(tabId, target) {
        const executeScript = this.chromeApi.scripting?.executeScript;
        if (!executeScript) {
            return false;
        }
        try {
            const results = await executeScript({
                target: { tabId },
                world: "ISOLATED",
                func: (targetKey, targetUrl) => {
                    const key = typeof targetKey === "string" && targetKey.length > 0 ? targetKey : null;
                    const href = typeof targetUrl === "string" && targetUrl.length > 0 ? targetUrl : null;
                    if (!key || !href) {
                        return false;
                    }
                    const element = document.querySelector(key);
                    if (!(element instanceof HTMLElement)) {
                        return false;
                    }
                    const anchor = element instanceof HTMLAnchorElement
                        ? element
                        : element.closest("a") instanceof HTMLAnchorElement
                            ? element.closest("a")
                            : null;
                    if (anchor) {
                        anchor.href = href;
                        anchor.target = "_self";
                    }
                    element.scrollIntoView?.({ block: "center", inline: "center" });
                    const dispatch = (type) => element.dispatchEvent(new MouseEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        composed: true,
                        view: window
                    }));
                    element.focus?.();
                    dispatch("mouseover");
                    dispatch("mousedown");
                    dispatch("mouseup");
                    dispatch("click");
                    return true;
                },
                args: [target.targetKey, target.targetUrl]
            });
            return results[0]?.result === true;
        }
        catch {
            return false;
        }
    }
    async #probeXhsSearchTargets(tabId) {
        const executeScript = this.chromeApi.scripting?.executeScript;
        if (!executeScript) {
            return null;
        }
        try {
            const results = await executeScript({
                target: { tabId },
                world: "ISOLATED",
                func: (inputSelectors, buttonSelectors) => {
                    const inputSelectorList = Array.isArray(inputSelectors)
                        ? inputSelectors.filter((item) => typeof item === "string")
                        : [];
                    const buttonSelectorList = Array.isArray(buttonSelectors)
                        ? buttonSelectors.filter((item) => typeof item === "string")
                        : [];
                    const isUsable = (value) => {
                        if (!(value instanceof HTMLElement)) {
                            return null;
                        }
                        const rect = value.getBoundingClientRect();
                        const style = window.getComputedStyle(value);
                        const disabled = value.disabled === true;
                        if (disabled ||
                            value.hidden === true ||
                            rect.width <= 0 ||
                            rect.height <= 0 ||
                            style.visibility === "hidden" ||
                            style.display === "none") {
                            return null;
                        }
                        return value;
                    };
                    const buildLocator = (element) => {
                        if (typeof element.id === "string" && element.id.length > 0) {
                            return `#${element.id}`;
                        }
                        const className = typeof element.className === "string"
                            ? element.className
                                .split(/\s+/)
                                .map((token) => token.trim())
                                .filter((token) => token.length > 0)
                                .slice(0, 2)
                                .join(".")
                            : "";
                        if (className) {
                            return `${element.tagName.toLowerCase()}.${className}`;
                        }
                        return element.tagName.toLowerCase();
                    };
                    const buildTargetKey = (element) => {
                        const segments = [];
                        let current = element;
                        while (current) {
                            const parent = current.parentElement;
                            const tagName = current.tagName.toLowerCase();
                            if (!parent) {
                                segments.unshift(current.id ? `${tagName}#${current.id}` : tagName);
                                break;
                            }
                            const siblings = Array.from(parent.children).filter((candidate) => candidate instanceof HTMLElement && candidate.tagName === current?.tagName);
                            const position = siblings.indexOf(current) + 1;
                            const idSegment = current.id ? `#${current.id}` : "";
                            segments.unshift(`${tagName}${idSegment}:nth-of-type(${position})`);
                            current = parent;
                        }
                        return segments.join(" > ");
                    };
                    const toTarget = (element) => {
                        if (!element) {
                            return null;
                        }
                        const rect = element.getBoundingClientRect();
                        return {
                            locator: buildLocator(element),
                            targetKey: buildTargetKey(element),
                            centerX: Math.round(rect.left + rect.width / 2),
                            centerY: Math.round(rect.top + rect.height / 2)
                        };
                    };
                    const findFirst = (selectors) => {
                        for (const selector of selectors) {
                            const candidate = Array.from(document.querySelectorAll(selector))
                                .map((entry) => isUsable(entry))
                                .find((entry) => entry !== null);
                            if (candidate) {
                                return candidate;
                            }
                        }
                        return null;
                    };
                    const input = findFirst(inputSelectorList);
                    const inputRoot = input?.closest('[class*="search" i], [role="search"], header, nav, form') ??
                        input?.parentElement ??
                        document;
                    const scopedButton = Array.from(inputRoot.querySelectorAll(buttonSelectorList.join(",")))
                        .map((entry) => isUsable(entry))
                        .find((entry) => entry !== null);
                    const button = scopedButton ?? findFirst(buttonSelectorList);
                    return {
                        input: toTarget(input),
                        button: toTarget(button)
                    };
                },
                args: [[...xhsSearchInputSelectors], [...xhsSearchButtonSelectors]]
            });
            const record = asRecord(results[0]?.result ?? null);
            if (!record) {
                return null;
            }
            return {
                input: this.#parseEditorInputProbeTarget(record.input),
                button: this.#parseEditorInputProbeTarget(record.button)
            };
        }
        catch {
            return null;
        }
    }
    async #selectXhsSearchInputText(tabId) {
        const executeScript = this.chromeApi.scripting?.executeScript;
        if (!executeScript) {
            return false;
        }
        try {
            const results = await executeScript({
                target: { tabId },
                world: "ISOLATED",
                func: (inputSelectors) => {
                    const inputSelectorList = Array.isArray(inputSelectors)
                        ? inputSelectors.filter((item) => typeof item === "string")
                        : [];
                    for (const selector of inputSelectorList) {
                        const input = Array.from(document.querySelectorAll(selector)).find((candidate) => candidate instanceof HTMLInputElement);
                        if (!input) {
                            continue;
                        }
                        input.focus();
                        input.select?.();
                        input.setSelectionRange?.(0, input.value.length);
                        return true;
                    }
                    return false;
                },
                args: [[...xhsSearchInputSelectors]]
            });
            return results[0]?.result === true;
        }
        catch {
            return false;
        }
    }
    #waitForXhsSearchDebuggerNetworkCapture(tabId, query, timeoutMs) {
        const debuggerApi = this.chromeApi.debugger;
        const onEvent = debuggerApi?.onEvent;
        if (!debuggerApi || !onEvent) {
            return Promise.resolve(null);
        }
        const pending = new Map();
        const parseBody = (value) => {
            if (typeof value !== "string" || value.length === 0) {
                return null;
            }
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        };
        const parseHeaderRecord = (value) => {
            const record = asRecord(value);
            if (!record) {
                return {};
            }
            return Object.fromEntries(Object.entries(record)
                .filter((entry) => typeof entry[1] === "string" || typeof entry[1] === "number")
                .map(([key, value]) => [key, String(value)]));
        };
        const isSearchEndpoint = (url) => {
            try {
                const parsed = new URL(url);
                return parsed.hostname === XHS_READ_API_DOMAIN && parsed.pathname === SEARCH_ENDPOINT;
            }
            catch {
                return false;
            }
        };
        const bodyMatchesQuery = (body) => {
            const record = asRecord(body);
            return asNonEmptyString(record?.keyword) === query;
        };
        return new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                try {
                    onEvent.removeListener(listener);
                }
                catch {
                    // Listener removal best effort.
                }
                resolve(value);
            };
            const timeout = setTimeout(() => finish(null), Math.max(1, timeoutMs));
            const listener = (source, method, params) => {
                if (settled || source.tabId !== tabId || !params) {
                    return;
                }
                const requestId = asNonEmptyString(params.requestId);
                if (!requestId) {
                    return;
                }
                if (method === "Network.requestWillBeSent") {
                    const request = asRecord(params.request);
                    const url = asNonEmptyString(request?.url);
                    const requestMethod = asNonEmptyString(request?.method);
                    if (!url || requestMethod !== "POST" || !isSearchEndpoint(url)) {
                        return;
                    }
                    const requestBody = parseBody(request?.postData);
                    if (!bodyMatchesQuery(requestBody)) {
                        return;
                    }
                    pending.set(requestId, {
                        url,
                        method: requestMethod,
                        requestHeaders: parseHeaderRecord(request?.headers),
                        requestBody,
                        status: null,
                        responseHeaders: {},
                        capturedAt: Date.now()
                    });
                    return;
                }
                if (method === "Network.responseReceived") {
                    const entry = pending.get(requestId);
                    if (!entry) {
                        return;
                    }
                    const response = asRecord(params.response);
                    entry.status = typeof response?.status === "number" ? response.status : null;
                    entry.responseHeaders = parseHeaderRecord(response?.headers);
                    return;
                }
                if (method === "Network.loadingFinished") {
                    const entry = pending.get(requestId);
                    if (!entry || entry.status === null) {
                        return;
                    }
                    void (async () => {
                        try {
                            const bodyResult = asRecord(await debuggerApi.sendCommand({ tabId }, "Network.getResponseBody", { requestId }));
                            const rawBody = asNonEmptyString(bodyResult?.body);
                            const responseBody = bodyResult?.base64Encoded === true && rawBody
                                ? parseBody(atob(rawBody))
                                : parseBody(rawBody);
                            finish({
                                source: "chrome_debugger_network",
                                route_evidence_class: "passive_api_capture",
                                url: entry.url,
                                method: entry.method,
                                status: entry.status,
                                request: {
                                    headers: redactPassiveCaptureHeaders(entry.requestHeaders),
                                    body: entry.requestBody
                                },
                                response: {
                                    headers: redactPassiveCaptureHeaders(entry.responseHeaders),
                                    body: responseBody
                                },
                                captured_at: entry.capturedAt,
                                observed_at: Date.now()
                            });
                        }
                        catch {
                            finish(null);
                        }
                    })();
                }
            };
            onEvent.addListener(listener);
        });
    }
    #waitForXhsDetailDebuggerNetworkCapture(tabId, noteId, timeoutMs) {
        const debuggerApi = this.chromeApi.debugger;
        const onEvent = debuggerApi?.onEvent;
        if (!debuggerApi || !onEvent) {
            return Promise.resolve(null);
        }
        const pending = new Map();
        const parseBody = (value) => {
            if (typeof value !== "string" || value.length === 0) {
                return null;
            }
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        };
        const parseHeaderRecord = (value) => {
            const record = asRecord(value);
            if (!record) {
                return {};
            }
            return Object.fromEntries(Object.entries(record)
                .filter((entry) => typeof entry[1] === "string" || typeof entry[1] === "number")
                .map(([key, value]) => [key, String(value)]));
        };
        const headerValue = (headers, key) => {
            const matched = Object.entries(headers).find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
            return matched && matched[1].trim().length > 0 ? matched[1].trim() : null;
        };
        const isDetailEndpoint = (url) => {
            try {
                const parsed = new URL(url);
                return parsed.hostname === XHS_READ_API_DOMAIN && parsed.pathname === DETAIL_ENDPOINT;
            }
            catch {
                return false;
            }
        };
        const bodyMatchesNoteId = (body) => {
            const record = asRecord(body);
            return asNonEmptyString(record?.source_note_id) === noteId;
        };
        return new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                try {
                    onEvent.removeListener(listener);
                }
                catch {
                    // Best-effort listener removal.
                }
                resolve(value);
            };
            const timeout = setTimeout(() => finish(null), Math.max(1, timeoutMs));
            const listener = (source, method, params) => {
                if (settled || source.tabId !== tabId || !params) {
                    return;
                }
                const requestId = asNonEmptyString(params.requestId);
                if (!requestId) {
                    return;
                }
                if (method === "Network.requestWillBeSent") {
                    const request = asRecord(params.request);
                    const url = asNonEmptyString(request?.url);
                    const requestMethod = asNonEmptyString(request?.method);
                    if (!url || requestMethod !== "POST" || !isDetailEndpoint(url)) {
                        return;
                    }
                    const requestBody = parseBody(request?.postData);
                    if (!bodyMatchesNoteId(requestBody)) {
                        return;
                    }
                    pending.set(requestId, {
                        url,
                        method: requestMethod,
                        requestHeaders: parseHeaderRecord(request?.headers),
                        requestBody,
                        status: null,
                        responseHeaders: {},
                        capturedAt: Date.now()
                    });
                    return;
                }
                if (method === "Network.responseReceived") {
                    const entry = pending.get(requestId);
                    if (!entry) {
                        return;
                    }
                    const response = asRecord(params.response);
                    entry.status = typeof response?.status === "number" ? response.status : null;
                    entry.responseHeaders = parseHeaderRecord(response?.headers);
                    return;
                }
                if (method === "Network.loadingFinished") {
                    const entry = pending.get(requestId);
                    if (!entry || entry.status === null) {
                        return;
                    }
                    void (async () => {
                        try {
                            const bodyResult = asRecord(await debuggerApi.sendCommand({ tabId }, "Network.getResponseBody", { requestId }));
                            const rawBody = asNonEmptyString(bodyResult?.body);
                            const responseBody = bodyResult?.base64Encoded === true && rawBody
                                ? parseBody(atob(rawBody))
                                : parseBody(rawBody);
                            finish({
                                route_evidence_class: "passive_api_capture",
                                source_kind: "page_request",
                                method: entry.method,
                                url: entry.url,
                                referrer: headerValue(entry.requestHeaders, "referer"),
                                request: {
                                    headers: redactPassiveCaptureHeaders(entry.requestHeaders),
                                    body: entry.requestBody
                                },
                                response: {
                                    headers: redactPassiveCaptureHeaders(entry.responseHeaders),
                                    body: responseBody
                                },
                                status: entry.status,
                                captured_at: entry.capturedAt,
                                observed_at: Date.now()
                            });
                        }
                        catch {
                            finish(null);
                        }
                    })();
                }
            };
            onEvent.addListener(listener);
        });
    }
    #waitForXhsUserHomeDebuggerNetworkCapture(tabId, userId, timeoutMs) {
        const debuggerApi = this.chromeApi.debugger;
        const onEvent = debuggerApi?.onEvent;
        if (!debuggerApi || !onEvent) {
            return Promise.resolve(null);
        }
        const pending = new Map();
        const parseBody = (value) => {
            if (typeof value !== "string" || value.length === 0) {
                return null;
            }
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        };
        const parseHeaderRecord = (value) => {
            const record = asRecord(value);
            if (!record) {
                return {};
            }
            return Object.fromEntries(Object.entries(record)
                .filter((entry) => typeof entry[1] === "string" || typeof entry[1] === "number")
                .map(([key, value]) => [key, String(value)]));
        };
        const headerValue = (headers, key) => {
            const matched = Object.entries(headers).find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
            return matched && matched[1].trim().length > 0 ? matched[1].trim() : null;
        };
        const isUserHomeEndpoint = (url) => {
            try {
                const parsed = new URL(url);
                if (parsed.hostname !== XHS_READ_API_DOMAIN || parsed.pathname !== USER_HOME_ENDPOINT) {
                    return false;
                }
                return (parsed.searchParams.get("user_id") === userId ||
                    parsed.searchParams.get("target_user_id") === userId);
            }
            catch {
                return false;
            }
        };
        return new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                try {
                    onEvent.removeListener(listener);
                }
                catch {
                    // Best-effort listener removal.
                }
                resolve(value);
            };
            const timeout = setTimeout(() => finish(null), Math.max(1, timeoutMs));
            const listener = (source, method, params) => {
                if (settled || source.tabId !== tabId || !params) {
                    return;
                }
                const requestId = asNonEmptyString(params.requestId);
                if (!requestId) {
                    return;
                }
                if (method === "Network.requestWillBeSent") {
                    const request = asRecord(params.request);
                    const url = asNonEmptyString(request?.url);
                    const requestMethod = asNonEmptyString(request?.method);
                    if (!url || requestMethod !== "GET" || !isUserHomeEndpoint(url)) {
                        return;
                    }
                    pending.set(requestId, {
                        url,
                        method: requestMethod,
                        requestHeaders: parseHeaderRecord(request?.headers),
                        status: null,
                        responseHeaders: {},
                        capturedAt: Date.now()
                    });
                    return;
                }
                if (method === "Network.responseReceived") {
                    const entry = pending.get(requestId);
                    if (!entry) {
                        return;
                    }
                    const response = asRecord(params.response);
                    entry.status = typeof response?.status === "number" ? response.status : null;
                    entry.responseHeaders = parseHeaderRecord(response?.headers);
                    return;
                }
                if (method === "Network.loadingFinished") {
                    const entry = pending.get(requestId);
                    if (!entry || entry.status === null) {
                        return;
                    }
                    void (async () => {
                        try {
                            const bodyResult = asRecord(await debuggerApi.sendCommand({ tabId }, "Network.getResponseBody", { requestId }));
                            const rawBody = asNonEmptyString(bodyResult?.body);
                            const responseBody = bodyResult?.base64Encoded === true && rawBody
                                ? parseBody(atob(rawBody))
                                : parseBody(rawBody);
                            finish({
                                route_evidence_class: "passive_api_capture",
                                source_kind: "page_request",
                                method: entry.method,
                                url: entry.url,
                                referrer: headerValue(entry.requestHeaders, "referer"),
                                request: {
                                    headers: redactPassiveCaptureHeaders(entry.requestHeaders),
                                    body: null
                                },
                                response: {
                                    headers: redactPassiveCaptureHeaders(entry.responseHeaders),
                                    body: responseBody
                                },
                                status: entry.status,
                                captured_at: entry.capturedAt,
                                observed_at: Date.now()
                            });
                        }
                        catch {
                            finish(null);
                        }
                    })();
                }
            };
            onEvent.addListener(listener);
        });
    }
    async #dispatchXhsSearchDebuggerAction(tabId, input) {
        const query = asNonEmptyString(input.query);
        if (!query) {
            throw new Error("xhs search query is required");
        }
        const debuggerApi = this.chromeApi.debugger;
        if (!debuggerApi) {
            throw new Error("chrome.debugger is unavailable");
        }
        const actionMode = input.action_mode === "page_reload" ? "page_reload" : "input_submit";
        const targets = actionMode === "page_reload" ? null : await this.#probeXhsSearchTargets(tabId);
        try {
            await debuggerApi.attach({ tabId }, debuggerProtocolVersion);
        }
        catch (error) {
            throw new Error(`chrome.debugger attach failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        try {
            let networkCapture = this.#waitForXhsSearchDebuggerNetworkCapture(tabId, query, 5_000);
            try {
                await debuggerApi.sendCommand({ tabId }, "Network.enable");
            }
            catch {
                // Network capture is diagnostic/passive evidence; keep the primary action path available.
            }
            let submitTriggered = "debugger_page_reload";
            let debuggerActionError = null;
            if (actionMode === "page_reload") {
                try {
                    await debuggerApi.sendCommand({ tabId }, "Page.reload", { ignoreCache: true });
                }
                catch (error) {
                    debuggerActionError = error instanceof Error ? error.message : String(error);
                }
            }
            else if (targets?.input) {
                try {
                    await this.#dispatchEditorInputDebuggerClick(tabId, targets.input);
                    await this.#sleep(60);
                    await this.#selectXhsSearchInputText(tabId);
                    await this.#sleep(30);
                    await debuggerApi.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
                        type: "rawKeyDown",
                        key: "Backspace",
                        code: "Backspace",
                        windowsVirtualKeyCode: 8,
                        nativeVirtualKeyCode: 8
                    });
                    await debuggerApi.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
                        type: "keyUp",
                        key: "Backspace",
                        code: "Backspace",
                        windowsVirtualKeyCode: 8,
                        nativeVirtualKeyCode: 8
                    });
                    await this.#sleep(80);
                    await debuggerApi.sendCommand({ tabId }, "Input.insertText", { text: query });
                    await this.#sleep(80);
                    await debuggerApi.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
                        type: "rawKeyDown",
                        key: "Enter",
                        code: "Enter",
                        windowsVirtualKeyCode: 13,
                        nativeVirtualKeyCode: 13
                    });
                    await debuggerApi.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
                        type: "keyUp",
                        key: "Enter",
                        code: "Enter",
                        windowsVirtualKeyCode: 13,
                        nativeVirtualKeyCode: 13
                    });
                    submitTriggered = targets.button
                        ? "debugger_enter_key_and_button_click"
                        : "debugger_enter_key";
                    if (targets.button) {
                        await this.#sleep(80);
                        await this.#dispatchEditorInputDebuggerClick(tabId, targets.button);
                    }
                }
                catch (error) {
                    debuggerActionError = error instanceof Error ? error.message : String(error);
                }
            }
            else {
                try {
                    await debuggerApi.sendCommand({ tabId }, "Page.reload", { ignoreCache: true });
                }
                catch (error) {
                    debuggerActionError = error instanceof Error ? error.message : String(error);
                }
            }
            let debuggerNetworkContext = await networkCapture;
            let reloadFallbackTriggered = false;
            let reloadFallbackError = null;
            if (!debuggerNetworkContext && actionMode === "page_reload") {
                reloadFallbackTriggered = true;
                networkCapture = this.#waitForXhsSearchDebuggerNetworkCapture(tabId, query, 8_000);
                try {
                    await debuggerApi.sendCommand({ tabId }, "Page.reload", { ignoreCache: true });
                }
                catch (error) {
                    reloadFallbackError = error instanceof Error ? error.message : String(error);
                }
                debuggerNetworkContext = await networkCapture;
            }
            return {
                source: "chrome_debugger",
                target_tab_id: tabId,
                query,
                run_id: asNonEmptyString(input.run_id),
                action_ref: asNonEmptyString(input.action_ref),
                requested_action_mode: actionMode,
                search_input_locator: targets?.input?.locator ?? null,
                search_input_target_key: targets?.input?.targetKey ?? null,
                search_button_locator: targets?.button?.locator ?? null,
                search_button_target_key: targets?.button?.targetKey ?? null,
                input_reset_before_insert: Boolean(targets?.input),
                submit_triggered: submitTriggered,
                debugger_action_error: debuggerActionError,
                reload_fallback_triggered: reloadFallbackTriggered,
                reload_fallback_error: reloadFallbackError,
                debugger_network_context: debuggerNetworkContext
            };
        }
        finally {
            try {
                await debuggerApi.detach({ tabId });
            }
            catch {
                // Keep primary failure semantics if detach races with Chrome.
            }
        }
    }
    async #sleep(timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    }
    #appendGateReason(target, reason) {
        const gateReasons = asStringArray(target.gate_reasons);
        if (!gateReasons.includes(reason)) {
            gateReasons.push(reason);
        }
        target.gate_reasons = gateReasons;
    }
    #backfillExecutionFailureIntoGatePayload(gatePayload, payload) {
        const details = asRecord(payload.details);
        if (!details) {
            return false;
        }
        const stage = asNonEmptyString(details.stage);
        const reason = asNonEmptyString(details.reason);
        if (stage !== "execution" || !reason) {
            return false;
        }
        const requestedExecutionMode = asNonEmptyString(details.requested_execution_mode);
        const missingRequiredPatches = asStringArray(details.missing_required_patches);
        const executionFailure = {
            stage,
            reason,
            ...(requestedExecutionMode ? { requested_execution_mode: requestedExecutionMode } : {}),
            ...(missingRequiredPatches.length > 0
                ? { missing_required_patches: [...missingRequiredPatches] }
                : {})
        };
        const humanizedAction = asRecord(details.humanized_action);
        if (humanizedAction) {
            executionFailure.humanized_action = humanizedAction;
        }
        const isFingerprintFailure = reason.startsWith("FINGERPRINT_");
        const gateOutcome = asRecord(gatePayload.gate_outcome);
        if (gateOutcome) {
            gateOutcome.gate_decision = "blocked";
            this.#appendGateReason(gateOutcome, reason);
            gateOutcome.execution_failure = { ...executionFailure };
            if (isFingerprintFailure) {
                gateOutcome.fingerprint_gate_decision = "blocked";
            }
        }
        const consumerGateResult = asRecord(gatePayload.consumer_gate_result);
        if (consumerGateResult) {
            consumerGateResult.gate_decision = "blocked";
            this.#appendGateReason(consumerGateResult, reason);
            consumerGateResult.execution_failure = { ...executionFailure };
            if (isFingerprintFailure) {
                consumerGateResult.fingerprint_gate_decision = "blocked";
                const reasonCodes = asStringArray(consumerGateResult.fingerprint_reason_codes);
                if (!reasonCodes.includes(reason)) {
                    reasonCodes.push(reason);
                }
                consumerGateResult.fingerprint_reason_codes = reasonCodes;
            }
        }
        if (isFingerprintFailure) {
            const runtime = asRecord(payload.fingerprint_runtime);
            const runtimeExecution = asRecord(runtime?.execution);
            const fingerprintExecution = runtimeExecution
                ? { ...runtimeExecution }
                : asRecord(gatePayload.fingerprint_execution)
                    ? { ...asRecord(gatePayload.fingerprint_execution) }
                    : null;
            if (fingerprintExecution) {
                fingerprintExecution.live_allowed = false;
                fingerprintExecution.live_decision = "dry_run_only";
                const allowedModes = asStringArray(fingerprintExecution.allowed_execution_modes);
                const fallbackModes = allowedModes.filter((mode) => mode === "dry_run" || mode === "recon");
                fingerprintExecution.allowed_execution_modes =
                    fallbackModes.length > 0 ? fallbackModes : ["dry_run"];
                const reasonCodes = asStringArray(fingerprintExecution.reason_codes);
                if (!reasonCodes.includes(reason)) {
                    reasonCodes.push(reason);
                }
                fingerprintExecution.reason_codes = reasonCodes;
                fingerprintExecution.execution_failure = { ...executionFailure };
                if (missingRequiredPatches.length > 0) {
                    fingerprintExecution.missing_required_patches = [...missingRequiredPatches];
                }
                gatePayload.fingerprint_execution = fingerprintExecution;
            }
        }
        const auditRecord = asRecord(gatePayload.audit_record);
        if (auditRecord) {
            auditRecord.gate_decision = "blocked";
            this.#appendGateReason(auditRecord, reason);
            auditRecord.execution_failure = { ...executionFailure };
        }
        return true;
    }
    async #evaluateXhsTargetGate(request) {
        const command = String(request.params.command ?? "");
        const { commandParams, targetDomain, targetTabId: initialTargetTabId, targetPage, issueScope, riskState, actionType, abilityActionType, requestedExecutionMode, approvalRecord, auditRecord, admissionContext, admissionDraft, upstreamAuthorizationRequest, legacyRequestedExecutionMode, runtimeProfileRef, sessionRhythmWindowId, sessionRhythmDecisionId, anonymousIsolationVerified, targetSiteLoggedIn, gateInvocationId, limitedReadRolloutReadyTrue, validationAction, requestedFingerprintContext } = resolveXhsGateCommandInput(asRecord(request.params.command_params) ?? {});
        let fingerprintExecution = requestedFingerprintContext?.execution ?? null;
        let fingerprintReasonCodes = (Array.isArray(fingerprintExecution?.reason_codes) ? fingerprintExecution.reason_codes : []).filter((code) => typeof code === "string");
        let targetTabId = initialTargetTabId;
        let fingerprintContextMissing = false;
        let fingerprintContextUntrusted = false;
        let fingerprintLiveBlocked = false;
        let fingerprintGateDecision = "allowed";
        let resolvedFingerprintReasonCodes = [...fingerprintReasonCodes];
        const gateReasons = [];
        let actualTargetDomain = null;
        let actualTargetTabId = null;
        let actualTargetPage = null;
        let actualTargetUrl = null;
        let writeGateOnlyApprovalDecision = null;
        let writeGateOnlyEligible = false;
        const requestRunId = String(request.params.run_id ?? request.id);
        const gateState = buildXhsGatePolicyState({
            issueScope,
            riskState,
            actionType,
            requestedExecutionMode,
            upstreamAuthorizationRequest,
            legacyRequestedExecutionMode,
            limitedReadRolloutReadyTrue
        });
        const canonicalIssueScope = gateState.issueScope;
        const canonicalRiskState = gateState.riskState;
        const canonicalActionType = gateState.actionType;
        const canonicalRequestedExecutionMode = gateState.requestedExecutionMode;
        const canonicalLegacyRequestedExecutionMode = gateState.legacyRequestedExecutionMode;
        const canonicalUpstreamAuthorizationRequest = gateState.upstreamAuthorizationRequest;
        const issue208EditorInputValidation = targetPage === "creator_publish_tab" &&
            canonicalRequestedExecutionMode === "live_write" &&
            validationAction === "editor_input";
        const requestedLiveMode = canonicalRequestedExecutionMode !== null &&
            XHS_LIVE_EXECUTION_MODES.has(canonicalRequestedExecutionMode);
        const gateDecisionId = resolveXhsGateDecisionId({
            runId: requestRunId,
            requestId: request.id,
            commandRequestId: commandParams.request_id,
            gateInvocationId,
            issueScope: canonicalIssueScope,
            requestedExecutionMode: canonicalRequestedExecutionMode
        });
        const expectedApprovalId = resolveGatePayloadApprovalId({
            approvalActive: requestedLiveMode,
            approvalRecord,
            decisionId: gateDecisionId,
            issueScope: canonicalIssueScope,
            requestedExecutionMode: canonicalRequestedExecutionMode,
            gateInvocationId
        });
        const pushReason = (reason) => {
            if (!gateReasons.includes(reason)) {
                gateReasons.push(reason);
            }
        };
        if (targetTabId === null && !issue208EditorInputValidation) {
            targetTabId = await this.#resolveTargetTabId({
                ...request,
                params: {
                    ...request.params,
                    command_params: commandParams
                }
            });
        }
        const requestSessionId = String(request.params.session_id ?? this.#sessionId);
        const boundAdmissionContext = bindIssue209AdmissionArtifactsToRequest({
            issueScope: canonicalIssueScope,
            requestedExecutionMode: canonicalRequestedExecutionMode,
            admissionContext,
            admissionDraft,
            sessionId: requestSessionId
        });
        collectXhsCommandGateReasons({
            gateReasons,
            actionType: canonicalActionType,
            requestedExecutionMode: canonicalRequestedExecutionMode,
            abilityAction: abilityActionType,
            targetDomain,
            targetTabId,
            targetPage,
            issue208WriteGateOnly: gateState.issue208WriteGateOnly,
            issue208EditorInputValidation,
            treatMissingEditorValidationAsUnsupported: true
        });
        if (!isAllowedTargetPageForXhsReadCommand(command, targetPage)) {
            pushReason("TARGET_PAGE_MISMATCH");
        }
        const matrixResolution = collectXhsMatrixGateReasons({
            gateReasons,
            state: gateState,
            decisionId: gateDecisionId,
            expectedApprovalId,
            runId: requestRunId,
            sessionId: requestSessionId,
            approvalRecord,
            auditRecord,
            admissionContext: boundAdmissionContext,
            targetDomain,
            targetTabId,
            targetPage,
            issue208EditorInputValidation
        });
        writeGateOnlyEligible = matrixResolution.writeGateOnlyEligible;
        writeGateOnlyApprovalDecision = matrixResolution.writeGateOnlyApprovalDecision;
        const canonicalApprovalRecord = matrixResolution.approvalRecord;
        const canonicalAdmissionContext = matrixResolution.admissionContext;
        const resolvedTargetDomainForLookup = targetDomain !== null && XHS_DOMAIN_ALLOWLIST.has(targetDomain) ? targetDomain : null;
        const actualTargetQueryPattern = resolvedTargetDomainForLookup !== null
            ? buildChromeUrlPatternForDomain(resolvedTargetDomainForLookup)
            : null;
        const shouldResolveActualTargetContext = actualTargetQueryPattern !== null &&
            targetTabId !== null &&
            targetPage &&
            (gateReasons.length === 0 || requestedLiveMode);
        if (shouldResolveActualTargetContext && resolvedTargetDomainForLookup) {
            try {
                const domainTabs = await this.chromeApi.tabs.query({
                    url: actualTargetQueryPattern
                });
                const targetTab = domainTabs.find((tab) => tab.id === targetTabId);
                if (!targetTab) {
                    pushReason("TARGET_TAB_NOT_FOUND");
                }
                else {
                    const tabUrl = typeof targetTab.url === "string" ? targetTab.url : "";
                    const parsed = parseUrl(tabUrl);
                    if (!parsed) {
                        pushReason("TARGET_TAB_URL_INVALID");
                    }
                    else {
                        actualTargetDomain = parsed.hostname;
                        actualTargetTabId = targetTabId;
                        actualTargetUrl = tabUrl;
                        if (parsed.hostname !== resolvedTargetDomainForLookup) {
                            pushReason("TARGET_DOMAIN_MISMATCH");
                        }
                        const actualPage = classifyXhsPage(tabUrl, resolvedTargetDomainForLookup);
                        actualTargetPage = actualPage;
                        if (actualPage !== targetPage) {
                            pushReason("TARGET_PAGE_MISMATCH");
                        }
                        if (issue208EditorInputValidation &&
                            !isCreatorArticlePublishPage(tabUrl, resolvedTargetDomainForLookup)) {
                            pushReason("TARGET_PAGE_ARTICLE_REQUIRED");
                        }
                    }
                }
            }
            catch {
                if (gateReasons.length === 0) {
                    pushReason("TARGET_PAGE_CONTEXT_UNRESOLVED");
                }
            }
        }
        const legacyAdmissionOnlyBlockedBeforeFingerprint = canonicalIssueScope === "issue_209" &&
            (canonicalRequestedExecutionMode === "live_read_limited" ||
                canonicalRequestedExecutionMode === "live_read_high_risk") &&
            gateReasons.length > 0 &&
            gateReasons.every((reason) => reason === "MANUAL_CONFIRMATION_MISSING" ||
                reason === "APPROVAL_CHECKS_INCOMPLETE" ||
                reason === "AUDIT_RECORD_MISSING");
        const shouldEvaluateTrustedFingerprintGate = requestedLiveMode &&
            (!gateState.issue208WriteGateOnly || writeGateOnlyEligible) &&
            (gateReasons.length === 0 || legacyAdmissionOnlyBlockedBeforeFingerprint);
        let fingerprintGateEvaluated = false;
        if (shouldEvaluateTrustedFingerprintGate) {
            fingerprintGateEvaluated = true;
            const trustedGateRequest = {
                ...request,
                params: {
                    ...request.params,
                    command_params: normalizeXhsSearchCommandParams(commandParams, targetTabId)
                }
            };
            const trustedFingerprintContext = this.#resolveValidatedTrustedFingerprintContext(trustedGateRequest, requestedFingerprintContext);
            fingerprintExecution = trustedFingerprintContext?.execution ?? null;
            fingerprintReasonCodes = (Array.isArray(fingerprintExecution?.reason_codes) ? fingerprintExecution.reason_codes : []).filter((code) => typeof code === "string");
            if (fingerprintExecution === null) {
                fingerprintContextMissing = requestedFingerprintContext === null;
                fingerprintContextUntrusted = requestedFingerprintContext !== null;
                fingerprintExecution = null;
                if (fingerprintContextMissing) {
                    pushReason("FINGERPRINT_CONTEXT_MISSING");
                    resolvedFingerprintReasonCodes = ["FINGERPRINT_CONTEXT_MISSING"];
                }
                else {
                    pushReason("FINGERPRINT_CONTEXT_UNTRUSTED");
                    resolvedFingerprintReasonCodes = ["FINGERPRINT_CONTEXT_UNTRUSTED"];
                }
                pushReason("FINGERPRINT_EXECUTION_BLOCKED");
            }
            else if (canonicalRequestedExecutionMode !== null &&
                (fingerprintExecution.live_allowed !== true ||
                    fingerprintExecution.live_decision === "dry_run_only" ||
                    !fingerprintExecution.allowed_execution_modes.includes(canonicalRequestedExecutionMode))) {
                fingerprintLiveBlocked = true;
                pushReason("FINGERPRINT_EXECUTION_BLOCKED");
                resolvedFingerprintReasonCodes = [...fingerprintReasonCodes];
            }
            else {
                resolvedFingerprintReasonCodes = [...fingerprintReasonCodes];
            }
            fingerprintGateDecision =
                fingerprintContextMissing || fingerprintContextUntrusted || fingerprintLiveBlocked
                    ? "blocked"
                    : "allowed";
        }
        if (gateState.issue208WriteGateOnly) {
            if (!gateReasons.includes(gateState.writeTierReason)) {
                gateReasons.push(gateState.writeTierReason);
            }
        }
        const finalizedGate = finalizeXhsGateOutcome({
            gateReasons,
            state: gateState,
            writeGateOnlyEligible,
            nonBlockingReasons: [gateState.writeTierReason]
        });
        const resolvedEffectiveExecutionMode = finalizedGate.effectiveExecutionMode ?? gateState.fallbackMode;
        const baseForwardCommandParams = applyCanonicalXhsForwardCommandParams({
            commandParams: normalizeXhsSearchCommandParams(commandParams, targetTabId),
            requestedExecutionMode: canonicalRequestedExecutionMode,
            legacyRequestedExecutionMode: canonicalLegacyRequestedExecutionMode,
            upstreamAuthorizationRequest: canonicalUpstreamAuthorizationRequest
        });
        const canonicalGateRequest = {
            ...request,
            params: {
                ...request.params,
                command_params: baseForwardCommandParams
            }
        };
        const sharedCanonicalGate = buildCanonicalGateAuditArtifacts({
            request: canonicalGateRequest,
            issueScope: canonicalIssueScope,
            riskState: canonicalRiskState,
            targetDomain,
            targetTabId,
            targetPage,
            actualTargetDomain,
            actualTargetTabId,
            actualTargetPage,
            actualTargetUrl,
            actionType: canonicalActionType,
            abilityActionType,
            requestedExecutionMode: canonicalRequestedExecutionMode,
            legacyRequestedExecutionMode: canonicalLegacyRequestedExecutionMode,
            runtimeProfileRef,
            sessionRhythmWindowId,
            sessionRhythmDecisionId,
            upstreamAuthorizationRequest: canonicalUpstreamAuthorizationRequest,
            anonymousIsolationVerified,
            targetSiteLoggedIn,
            approvalRecord: canonicalApprovalRecord,
            auditRecord,
            admissionContext: canonicalAdmissionContext,
            limitedReadRolloutReadyTrue,
            gateInvocationId,
            issue208EditorInputValidation
        });
        const canonicalRequestAdmissionResult = asRecord(sharedCanonicalGate.request_admission_result);
        const canonicalExecutionAudit = asRecord(sharedCanonicalGate.execution_audit);
        const canonicalConsumerGateResult = asRecord(sharedCanonicalGate.consumer_gate_result);
        const legacyAdmissionOnlyBlocked = finalizedGate.gateDecision === "blocked" && legacyAdmissionOnlyBlockedBeforeFingerprint;
        const canAdoptCanonicalLiveAdmission = canonicalIssueScope === "issue_209" &&
            (canonicalRequestedExecutionMode === "live_read_limited" ||
                canonicalRequestedExecutionMode === "live_read_high_risk") &&
            fingerprintGateEvaluated &&
            fingerprintGateDecision === "allowed" &&
            canonicalRequestAdmissionResult?.admission_decision === "allowed" &&
            canonicalConsumerGateResult?.gate_decision === "allowed" &&
            legacyAdmissionOnlyBlocked;
        const adoptedGateDecision = canAdoptCanonicalLiveAdmission
            ? "allowed"
            : finalizedGate.gateDecision;
        const adoptedEffectiveExecutionMode = canAdoptCanonicalLiveAdmission &&
            (canonicalRequestedExecutionMode === "live_read_limited" ||
                canonicalRequestedExecutionMode === "live_read_high_risk")
            ? canonicalRequestedExecutionMode
            : resolvedEffectiveExecutionMode;
        const adoptedGateReasons = canAdoptCanonicalLiveAdmission
            ? asStringArray(canonicalConsumerGateResult?.gate_reasons)
            : finalizedGate.gateReasons;
        const adoptedAllowed = adoptedGateDecision === "allowed";
        const sharedCanonicalApprovalRecord = normalizeXhsApprovalRecord(asRecord(sharedCanonicalGate.approval_record));
        const canonicalApprovalPayloadRecord = canAdoptCanonicalLiveAdmission && sharedCanonicalApprovalRecord
            ? {
                ...sharedCanonicalApprovalRecord,
                checks: { ...sharedCanonicalApprovalRecord.checks }
            }
            : {
                ...canonicalApprovalRecord,
                checks: { ...canonicalApprovalRecord.checks }
            };
        const forwardCommandParams = applyCanonicalXhsForwardCommandParams({
            commandParams: baseForwardCommandParams,
            requestedExecutionMode: canonicalRequestedExecutionMode,
            legacyRequestedExecutionMode: canonicalLegacyRequestedExecutionMode,
            upstreamAuthorizationRequest: canonicalUpstreamAuthorizationRequest,
            approvalRecord: canonicalApprovalPayloadRecord,
            admissionContext: canonicalAdmissionContext
        });
        const requiresManualConfirmation = !gateState.issue208WriteGateOnly &&
            (canonicalRequestedExecutionMode === "live_read_limited" ||
                canonicalRequestedExecutionMode === "live_read_high_risk" ||
                canonicalRequestedExecutionMode === "live_write");
        const consumerGateResult = {
            issue_scope: canonicalIssueScope,
            target_domain: targetDomain,
            target_tab_id: targetTabId,
            target_page: targetPage,
            action_type: canonicalActionType,
            requested_execution_mode: canonicalRequestedExecutionMode,
            effective_execution_mode: adoptedEffectiveExecutionMode,
            gate_decision: adoptedGateDecision,
            gate_reasons: adoptedGateReasons,
            fingerprint_gate_decision: fingerprintGateDecision,
            fingerprint_reason_codes: resolvedFingerprintReasonCodes,
            write_interaction_tier: gateState.writeActionMatrixDecisions?.write_interaction_tier ?? null
        };
        const runId = requestRunId;
        const sessionId = requestSessionId;
        const profile = typeof request.profile === "string" ? request.profile : null;
        const recordedAt = new Date().toISOString();
        const gateAuditSeed = {
            event_id: `bg_gate_${request.id}`,
            run_id: runId,
            session_id: sessionId,
            profile,
            issue_scope: canonicalIssueScope,
            risk_state: canonicalRiskState,
            target_domain: targetDomain,
            target_tab_id: targetTabId,
            target_page: targetPage,
            action_type: canonicalActionType,
            requested_execution_mode: canonicalRequestedExecutionMode,
            effective_execution_mode: adoptedEffectiveExecutionMode,
            gate_decision: adoptedGateDecision,
            gate_reasons: adoptedGateReasons,
            approver: canonicalApprovalPayloadRecord.approver,
            approved_at: canonicalApprovalPayloadRecord.approved_at,
            write_interaction_tier: gateState.writeActionMatrixDecisions?.write_interaction_tier ?? null,
            write_matrix_decision: gateState.writeMatrixDecision?.decision ?? null,
            recorded_at: recordedAt
        };
        const riskTransitionAudit = buildRiskTransitionAudit({
            runId,
            sessionId,
            issueScope: canonicalIssueScope,
            prevState: canonicalRiskState,
            decision: adoptedGateDecision,
            gateReasons: adoptedGateReasons,
            requestedExecutionMode: canonicalRequestedExecutionMode,
            approvalRecord: canonicalApprovalPayloadRecord,
            auditRecords: [gateAuditSeed],
            now: gateAuditSeed.recorded_at
        });
        const resolvedRiskState = resolveSharedRiskState(riskTransitionAudit.next_state);
        const gatePayload = createBackgroundXhsGatePayload({
            request: canonicalGateRequest,
            issueScope: canonicalIssueScope,
            riskState: canonicalRiskState,
            resolvedRiskState,
            targetDomain,
            targetTabId,
            targetPage,
            actionType: canonicalActionType,
            requestedExecutionMode: canonicalRequestedExecutionMode,
            effectiveExecutionMode: adoptedEffectiveExecutionMode,
            gateDecision: adoptedGateDecision,
            gateReasons: adoptedGateReasons,
            requiresManualConfirmation,
            fingerprintGateDecision,
            fingerprintExecution,
            consumerGateResult,
            approvalRecord: canonicalApprovalPayloadRecord,
            requestAdmissionResult: canonicalRequestAdmissionResult,
            executionAudit: canonicalExecutionAudit,
            admissionContext: canonicalAdmissionContext,
            writeActionMatrixDecisions: gateState.writeActionMatrixDecisions,
            writeMatrixDecision: gateState.writeMatrixDecision,
            writeGateOnlyDecision: writeGateOnlyApprovalDecision,
            riskTransitionAudit
        });
        return {
            allowed: adoptedAllowed,
            targetTabId: adoptedAllowed ? targetTabId : null,
            errorMessage: adoptedAllowed
                ? ""
                : xhsGateReasonMessage(adoptedGateReasons[0] ?? "TARGET_TAB_NOT_EXPLICIT"),
            gateOnly: adoptedAllowed && gateState.issue208WriteGateOnly && !writeGateOnlyEligible,
            forwardCommandParams,
            consumerGateResult,
            gatePayload
        };
    }
    #resolveForwardTimeoutMs(request) {
        return (readTimeoutMs(request.timeout_ms) ??
            this.options?.forwardTimeoutMs ??
            defaultForwardTimeoutMs);
    }
    #isXhsSignRequestMessage(message) {
        const record = asRecord(message);
        return (record?.kind === "xhs-sign-request" &&
            typeof record.uri === "string" &&
            record.uri.length > 0 &&
            asRecord(record.body) !== null);
    }
    #isXhsSearchDebuggerActionMessage(message) {
        const record = asRecord(message);
        if (record?.kind !== "xhs-search-debugger-action") {
            return false;
        }
        if (asNonEmptyString(record.query) === null) {
            return false;
        }
        if (record.run_id !== undefined && asNonEmptyString(record.run_id) === null) {
            return false;
        }
        if (record.action_ref !== undefined && asNonEmptyString(record.action_ref) === null) {
            return false;
        }
        if (record.timeout_ms !== undefined && readTimeoutMs(record.timeout_ms) === null) {
            return false;
        }
        if (record.action_mode !== undefined &&
            record.action_mode !== "page_reload" &&
            record.action_mode !== "input_submit") {
            return false;
        }
        return true;
    }
    #isXhsMainWorldRequestMessage(message) {
        const record = asRecord(message);
        if (record?.kind !== "xhs-main-world-request" ||
            typeof record.url !== "string" ||
            (record.method !== "POST" && record.method !== "GET") ||
            asRecord(record.headers) === null) {
            return false;
        }
        if (record.body !== undefined && typeof record.body !== "string") {
            return false;
        }
        if (record.timeout_ms !== undefined && readTimeoutMs(record.timeout_ms) === null) {
            return false;
        }
        if (record.referrer !== undefined && asNonEmptyString(record.referrer) === null) {
            return false;
        }
        if (record.referrerPolicy !== undefined && asNonEmptyString(record.referrerPolicy) === null) {
            return false;
        }
        return true;
    }
    async #executeXhsSignInMainWorld(tabId, uri, body) {
        if (!this.chromeApi.scripting?.executeScript) {
            throw new Error("chrome.scripting.executeScript is unavailable");
        }
        const results = await this.chromeApi.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: (inputUri, inputBody) => {
                const signatureFn = window._webmsxyw;
                if (typeof signatureFn !== "function") {
                    throw new Error("window._webmsxyw is not available");
                }
                if (typeof inputUri !== "string" || inputUri.length === 0) {
                    throw new Error("xhs-sign requires uri");
                }
                const result = signatureFn(inputUri, typeof inputBody === "object" && inputBody !== null ? inputBody : {});
                const xSignature = typeof result?.["X-s"] === "string" ? result["X-s"] : null;
                const xTimestamp = result?.["X-t"];
                if (!xSignature || (typeof xTimestamp !== "string" && typeof xTimestamp !== "number")) {
                    throw new Error("xhs-sign result is invalid");
                }
                return {
                    "X-s": xSignature,
                    "X-t": xTimestamp
                };
            },
            args: [uri, body]
        });
        const first = Array.isArray(results) ? results[0] : null;
        const signature = asRecord(first?.result);
        if (!signature ||
            typeof signature["X-s"] !== "string" ||
            (typeof signature["X-t"] !== "string" && typeof signature["X-t"] !== "number")) {
            throw new Error("xhs-sign result is invalid");
        }
        return {
            "X-s": signature["X-s"],
            "X-t": signature["X-t"]
        };
    }
    async #executeXhsRequestInMainWorld(tabId, input) {
        if (!this.chromeApi.scripting?.executeScript) {
            throw new Error("chrome.scripting.executeScript is unavailable");
        }
        const syntheticRequestHeader = "x-webenvoy-synthetic-request";
        const sanitizedHeaders = Object.fromEntries(Object.entries(input.headers).filter((entry) => typeof entry[1] === "string" &&
            entry[0].trim().toLowerCase() !== syntheticRequestHeader));
        const results = await this.chromeApi.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: async (requestUrl, requestMethod, requestHeaders, requestBody, requestTimeoutMs, requestReferrer, requestReferrerPolicy) => {
                const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
                    ? value
                    : null;
                const headersRecord = asRecord(requestHeaders) ?? {};
                const syntheticRequestHeader = "x-webenvoy-synthetic-request";
                const headers = Object.fromEntries(Object.entries(headersRecord).filter((entry) => typeof entry[1] === "string" &&
                    entry[0].trim().toLowerCase() !== syntheticRequestHeader));
                const syntheticRequestSymbol = Symbol.for("webenvoy.main_world.synthetic_request.v1");
                const timeoutMs = typeof requestTimeoutMs === "number" && Number.isFinite(requestTimeoutMs)
                    ? Math.max(1, Math.trunc(requestTimeoutMs))
                    : 5_000;
                const controller = new AbortController();
                const timer = setTimeout(() => {
                    controller.abort();
                }, timeoutMs);
                try {
                    const request = new Request(String(requestUrl), {
                        method: requestMethod === "GET" ? "GET" : "POST",
                        headers,
                        credentials: "include",
                        ...(typeof requestBody === "string" ? { body: requestBody } : {}),
                        ...(typeof requestReferrer === "string" ? { referrer: requestReferrer } : {}),
                        ...(typeof requestReferrerPolicy === "string"
                            ? { referrerPolicy: requestReferrerPolicy }
                            : {}),
                        signal: controller.signal
                    });
                    Object.defineProperty(request, syntheticRequestSymbol, {
                        configurable: true,
                        enumerable: false,
                        value: true
                    });
                    const response = await fetch(request);
                    const text = await response.text();
                    let body = null;
                    if (text.length > 0) {
                        try {
                            body = JSON.parse(text);
                        }
                        catch {
                            body = { message: text };
                        }
                    }
                    return {
                        status: response.status,
                        body
                    };
                }
                finally {
                    clearTimeout(timer);
                }
            },
            args: [
                input.url,
                input.method,
                sanitizedHeaders,
                input.body,
                input.timeoutMs,
                input.referrer,
                input.referrerPolicy
            ]
        });
        const first = Array.isArray(results) ? results[0] : null;
        const response = asRecord(first?.result);
        const status = typeof response?.status === "number" ? response.status : null;
        if (status === null || !Number.isFinite(status)) {
            throw new Error("main-world request returned invalid status");
        }
        return {
            status,
            body: response?.body ?? null
        };
    }
    async #handleXhsSignRequest(message, sender, sendResponse) {
        const tabId = asInteger(sender.tab?.id);
        const senderUrl = asNonEmptyString(sender.tab?.url);
        const parsedSenderUrl = senderUrl ? parseUrl(senderUrl) : null;
        if (tabId === null || !parsedSenderUrl || !XHS_DOMAIN_ALLOWLIST.has(parsedSenderUrl.hostname)) {
            sendResponse({
                ok: false,
                error: {
                    code: "ERR_XHS_SIGN_FORBIDDEN",
                    message: "xhs-sign request is out of allowlist scope"
                }
            });
            return;
        }
        try {
            const result = await this.#executeXhsSignInMainWorld(tabId, message.uri, message.body);
            sendResponse({
                ok: true,
                result
            });
        }
        catch (error) {
            sendResponse({
                ok: false,
                error: {
                    code: "ERR_XHS_SIGN_FAILED",
                    message: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
    async #handleXhsSearchDebuggerAction(message, sender, sendResponse) {
        const tabId = asInteger(sender.tab?.id);
        const senderUrl = asNonEmptyString(sender.tab?.url);
        const parsedSenderUrl = senderUrl ? parseUrl(senderUrl) : null;
        if (tabId === null || !parsedSenderUrl || parsedSenderUrl.hostname !== "www.xiaohongshu.com") {
            sendResponse({
                ok: false,
                error: {
                    code: "ERR_XHS_SEARCH_DEBUGGER_FORBIDDEN",
                    message: "xhs search debugger action is out of allowlist scope"
                }
            });
            return;
        }
        try {
            const timeoutMs = Math.min(readTimeoutMs(message.timeout_ms) ?? 12_000, 12_000);
            const result = await Promise.race([
                this.#dispatchXhsSearchDebuggerAction(tabId, message),
                new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`xhs search debugger action timed out after ${timeoutMs}ms`));
                    }, timeoutMs);
                })
            ]);
            sendResponse({
                ok: true,
                result
            });
        }
        catch (error) {
            sendResponse({
                ok: false,
                error: {
                    code: "ERR_XHS_SEARCH_DEBUGGER_FAILED",
                    message: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
    async #handleXhsMainWorldRequest(message, sender, sendResponse) {
        const tabId = asInteger(sender.tab?.id);
        const senderUrl = asNonEmptyString(sender.tab?.url);
        const parsedSenderUrl = senderUrl ? parseUrl(senderUrl) : null;
        const parsedRequestUrl = parsedSenderUrl ? parseUrl(message.url, parsedSenderUrl) : parseUrl(message.url);
        if (tabId === null ||
            !parsedSenderUrl ||
            !parsedRequestUrl ||
            !XHS_DOMAIN_ALLOWLIST.has(parsedSenderUrl.hostname) ||
            !isXhsMainWorldRequestHostAllowed({
                senderHost: parsedSenderUrl.hostname,
                requestHost: parsedRequestUrl.hostname
            }) ||
            !XHS_MAIN_WORLD_REQUEST_PATH_ALLOWLIST.has(parsedRequestUrl.pathname)) {
            sendResponse({
                ok: false,
                error: {
                    code: "ERR_XHS_MAIN_WORLD_REQUEST_FORBIDDEN",
                    message: "xhs main-world request is out of allowlist scope"
                }
            });
            return;
        }
        try {
            const result = await this.#executeXhsRequestInMainWorld(tabId, {
                url: parsedRequestUrl.toString(),
                method: message.method,
                headers: message.headers,
                ...(typeof message.body === "string" ? { body: message.body } : {}),
                timeoutMs: readTimeoutMs(message.timeout_ms) ?? 5_000,
                ...(typeof message.referrer === "string" ? { referrer: message.referrer } : {}),
                ...(typeof message.referrerPolicy === "string"
                    ? { referrerPolicy: message.referrerPolicy }
                    : {})
            });
            sendResponse({
                ok: true,
                result
            });
        }
        catch (error) {
            sendResponse({
                ok: false,
                error: {
                    code: "ERR_XHS_MAIN_WORLD_REQUEST_FAILED",
                    message: error instanceof Error ? error.message : String(error),
                    ...(error instanceof Error && typeof error.name === "string" && error.name.length > 0
                        ? { name: error.name }
                        : {})
                }
            });
        }
    }
    #onContentScriptResult(message, sender) {
        const result = message;
        if (!result || result.kind !== "result" || typeof result.id !== "string") {
            return;
        }
        const payload = typeof result.payload === "object" && result.payload !== null
            ? { ...result.payload }
            : {};
        const pending = this.#pendingState.take(result.id);
        if (!pending) {
            void this.#rememberStartupTrustedFingerprintContext(payload, sender);
            return;
        }
        const request = pending.request;
        const suppressHostResponse = pending.suppressHostResponse === true;
        const command = String(request.params.command ?? "");
        if (command === "runtime.bootstrap") {
            void this.#handleRuntimeBootstrapForwardResult({
                request,
                result,
                payload,
                sender,
                suppressHostResponse
            });
            return;
        }
        this.#rememberTrustedFingerprintContext(request, payload, result.ok === true);
        const backfilledExecutionFailure = pending.gatePayload
            ? this.#backfillExecutionFailureIntoGatePayload(pending.gatePayload, payload)
            : false;
        const summary = typeof payload.summary === "object" && payload.summary !== null
            ? payload.summary
            : null;
        if (pending.gatePayload && backfilledExecutionFailure) {
            // Ensure gate/audit trace fields reflect the final blocked decision without clobbering
            // the content-script canonical request-time result.
            for (const key of [
                "gate_outcome",
                "consumer_gate_result",
                "audit_record",
                "fingerprint_execution"
            ]) {
                if (!Object.prototype.hasOwnProperty.call(pending.gatePayload, key)) {
                    continue;
                }
                const value = pending.gatePayload[key];
                payload[key] = value;
                if (summary !== null) {
                    summary[key] = value;
                }
            }
        }
        if (pending.gatePayload) {
            for (const [key, value] of Object.entries(pending.gatePayload)) {
                const hasInPayload = Object.prototype.hasOwnProperty.call(payload, key);
                const hasInSummary = summary !== null && Object.prototype.hasOwnProperty.call(summary, key);
                if (!hasInPayload && !hasInSummary) {
                    if (summary !== null) {
                        summary[key] = value;
                    }
                    else {
                        payload[key] = value;
                    }
                }
            }
        }
        else if (pending.consumerGateResult &&
            !Object.prototype.hasOwnProperty.call(payload, "consumer_gate_result") &&
            !(summary !== null && Object.prototype.hasOwnProperty.call(summary, "consumer_gate_result"))) {
            payload.consumer_gate_result = pending.consumerGateResult;
        }
        if (result.ok !== true) {
            if (suppressHostResponse) {
                return;
            }
            this.#emit({
                id: request.id,
                status: "error",
                summary: {
                    relay_path: "host>background>content-script>background>host"
                },
                payload,
                error: result.error ?? {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "content script failed"
                }
            });
            return;
        }
        if (suppressHostResponse) {
            return;
        }
        const senderTabId = typeof sender.tab?.id === "number" ? sender.tab.id : null;
        this.#emit({
            id: request.id,
            status: "success",
            summary: {
                session_id: String(request.params.session_id ?? "nm-session-001"),
                run_id: String(request.params.run_id ?? request.id),
                command: String(request.params.command ?? "runtime.ping"),
                profile: typeof request.profile === "string" ? request.profile : null,
                cwd: String(request.params.cwd ?? ""),
                tab_id: sender.tab?.id ?? null,
                relay_path: "host>background>content-script>background>host"
            },
            payload: {
                ...payload,
                ...(senderTabId !== null ? { target_tab_id: senderTabId } : {})
            },
            error: null
        });
    }
    async #resolveTargetTabId(request) {
        if (typeof request.params.tab_id === "number" && Number.isInteger(request.params.tab_id)) {
            return request.params.tab_id;
        }
        const commandParams = typeof request.params.command_params === "object" && request.params.command_params !== null
            ? request.params.command_params
            : {};
        if (typeof commandParams.target_tab_id === "number" &&
            Number.isInteger(commandParams.target_tab_id)) {
            return commandParams.target_tab_id;
        }
        const options = typeof commandParams.options === "object" && commandParams.options !== null
            ? commandParams.options
            : {};
        if (typeof options.target_tab_id === "number" && Number.isInteger(options.target_tab_id)) {
            return options.target_tab_id;
        }
        const command = String(request.params.command ?? "");
        if (command === "runtime.ping" || command === "runtime.bootstrap") {
            const runtimeBootstrapTargetPage = asNonEmptyString(commandParams.target_page);
            const preferredRuntimeBootstrapReadPage = resolvePreferredXhsReadPage(command, runtimeBootstrapTargetPage);
            const runtimeBootstrapRequestedResourceId = command === "runtime.bootstrap"
                ? resolveRuntimeBootstrapRequestedXhsResourceId(commandParams, preferredRuntimeBootstrapReadPage)
                : null;
            if (command === "runtime.bootstrap" &&
                isXhsReadTargetPage(runtimeBootstrapTargetPage) &&
                preferredRuntimeBootstrapReadPage) {
                const runtimeBootstrapReadTabId = await resolveRuntimeBootstrapReadTargetTabId(this.chromeApi, preferredRuntimeBootstrapReadPage, runtimeBootstrapRequestedResourceId);
                if (runtimeBootstrapReadTabId !== null) {
                    return runtimeBootstrapReadTabId;
                }
                return null;
            }
            let runtimeSurfaceTabs = [];
            try {
                runtimeSurfaceTabs = await this.chromeApi.tabs.query({
                    url: ["*://creator.xiaohongshu.com/*", "*://www.xiaohongshu.com/*"]
                });
            }
            catch {
                runtimeSurfaceTabs = [];
            }
            const ranked = runtimeSurfaceTabs
                .filter((tab) => typeof tab.id === "number")
                .sort((left, right) => {
                const scoreDiff = scoreXhsRuntimeSurfaceTab(left) - scoreXhsRuntimeSurfaceTab(right);
                if (scoreDiff !== 0) {
                    return scoreDiff;
                }
                if (left.active === right.active) {
                    return 0;
                }
                return left.active ? -1 : 1;
            });
            const candidate = ranked[0];
            return typeof candidate?.id === "number" ? candidate.id : null;
        }
        if (XHS_GATE_COMMANDS.has(command)) {
            const rawCommandParams = typeof request.params.command_params === "object" && request.params.command_params !== null
                ? request.params.command_params
                : {};
            const requestedResourceId = resolveRequestedXhsResourceId(command, rawCommandParams);
            const preferredPage = resolvePreferredXhsReadPage(command, resolveXhsGateCommandInput(rawCommandParams).targetPage);
            return await resolvePreferredXhsReadTargetTabId(this.chromeApi, preferredPage, requestedResourceId);
        }
        let tabs = [];
        try {
            tabs = await this.chromeApi.tabs.query({
                active: true,
                currentWindow: true
            });
        }
        catch {
            tabs = [];
        }
        const first = tabs[0];
        return typeof first?.id === "number" ? first.id : null;
    }
    #failPending(id, error) {
        this.#pendingState.fail(id, error, (payload) => {
            this.#emit(payload);
        });
    }
    #failAllPending(error) {
        this.#pendingState.failAll(error, (payload) => {
            this.#emit(payload);
        });
    }
    async #resolveAllowlistedTabDomain(tabId) {
        const tabs = await this.chromeApi.tabs.query({
            url: STARTUP_TRUST_ALLOWLIST_URLS
        });
        const targetTab = tabs.find((tab) => tab.id === tabId);
        const tabUrl = typeof targetTab?.url === "string" ? targetTab.url : "";
        const parsed = parseUrl(tabUrl);
        if (!parsed || !XHS_DOMAIN_ALLOWLIST.has(parsed.hostname)) {
            return null;
        }
        return parsed.hostname;
    }
    async #ensureContentScriptInjected(tabId) {
        if (!this.chromeApi.scripting?.executeScript) {
            return;
        }
        await this.chromeApi.scripting.executeScript({
            target: { tabId },
            world: "ISOLATED",
            files: ["build/content-script.js"]
        });
    }
    async #prepareRuntimeBootstrapRequestContextCapture(request, commandParams) {
        if (!isXhsReadTargetPage(commandParams.target_page)) {
            return;
        }
        const targetTabId = await this.#resolveTargetTabId(request);
        if (targetTabId === null) {
            return;
        }
        await this.#ensureMainWorldBridgeInjected(request, targetTabId);
        await this.#ensureContentScriptInjected(targetTabId);
    }
    async #ensureMainWorldBridgeInjected(request, tabId) {
        const existingEnsure = this.#pendingMainWorldBridgeEnsures.get(tabId);
        if (existingEnsure) {
            await existingEnsure;
            return;
        }
        const ensurePromise = this.#ensureMainWorldBridgeInjectedInternal(request, tabId);
        this.#pendingMainWorldBridgeEnsures.set(tabId, ensurePromise);
        try {
            await ensurePromise;
        }
        finally {
            if (this.#pendingMainWorldBridgeEnsures.get(tabId) === ensurePromise) {
                this.#pendingMainWorldBridgeEnsures.delete(tabId);
            }
        }
    }
    async #ensureMainWorldBridgeInjectedInternal(request, tabId) {
        if (!this.chromeApi.scripting?.executeScript) {
            return;
        }
        const forceReinjectForStagedExtension = this.#shouldForceStagedMainWorldBridgeReinject();
        const probeSecret = this.#resolveMainWorldBridgeProbeSecret(request);
        if (!forceReinjectForStagedExtension &&
            probeSecret &&
            await this.#isMainWorldBridgeInstalled(tabId, probeSecret)) {
            return;
        }
        await this.chromeApi.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            files: ["build/main-world-bridge.js"]
        });
    }
    #shouldForceStagedMainWorldBridgeReinject() {
        const manifest = this.chromeApi.runtime.getManifest?.();
        const contentScripts = Array.isArray(manifest?.content_scripts) ? manifest.content_scripts : [];
        return contentScripts.some((entry) => Array.isArray(entry?.js) && entry.js.includes(STAGED_EXTENSION_BOOTSTRAP_SCRIPT_PATH));
    }
    #resolveMainWorldBridgeProbeSecret(request) {
        const profile = asNonEmptyString(request.profile);
        if (!profile) {
            return null;
        }
        const requestRunId = asNonEmptyString(request.params.run_id);
        if (!requestRunId) {
            return null;
        }
        const requestSessionId = asNonEmptyString(request.params.session_id) ?? this.#sessionId;
        const command = asNonEmptyString(request.params.command) ?? "bridge.forward";
        return hashMainWorldBridgeProbeSecret([
            MAIN_WORLD_BRIDGE_PROBE_NAMESPACE,
            profile,
            requestSessionId,
            requestRunId,
            command
        ].join("|"));
    }
    async #isMainWorldBridgeInstalled(tabId, mainWorldSecret) {
        if (!this.chromeApi.scripting?.executeScript) {
            return false;
        }
        const { requestEvent, resultEvent, namespaceEvent } = resolveMainWorldEventNamesForSecret(mainWorldSecret);
        const probe = await this.chromeApi.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: async (requestEventName, resultEventName, namespaceEventName) => {
                const MAIN_WORLD_EVENT_BOOTSTRAP = "__mw_bootstrap__";
                const requestEvent = typeof requestEventName === "string" ? requestEventName : "";
                const resultEvent = typeof resultEventName === "string" ? resultEventName : "";
                const namespaceEvent = typeof namespaceEventName === "string" ? namespaceEventName : "";
                if (!requestEvent || !resultEvent || !namespaceEvent) {
                    return false;
                }
                return await new Promise((resolve) => {
                    let settled = false;
                    const onResult = () => {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        clearTimeout(timer);
                        window.removeEventListener(resultEvent, onResult);
                        resolve(true);
                    };
                    const timer = setTimeout(() => {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        window.removeEventListener(resultEvent, onResult);
                        resolve(false);
                    }, 1_500);
                    window.addEventListener(resultEvent, onResult);
                    window.dispatchEvent(new CustomEvent(MAIN_WORLD_EVENT_BOOTSTRAP, {
                        detail: {
                            request_event: requestEvent,
                            result_event: resultEvent,
                            namespace_event: namespaceEvent
                        }
                    }));
                    window.dispatchEvent(new CustomEvent(requestEvent, {
                        detail: {
                            id: `probe-${Date.now()}`,
                            type: "fingerprint-install",
                            payload: {}
                        }
                    }));
                });
            },
            args: [requestEvent, resultEvent, namespaceEvent]
        });
        return probe[0]?.result === true;
    }
    #shouldEnsureMainWorldBridge(command, requestedExecutionMode) {
        void requestedExecutionMode;
        return command === "runtime.bootstrap" || XHS_GATE_COMMANDS.has(command);
    }
    #resolveReadyBootstrapMainWorldSecret(request, command) {
        if (!XHS_GATE_COMMANDS.has(command)) {
            return null;
        }
        const profile = asNonEmptyString(request.profile);
        const runId = asNonEmptyString(request.params.run_id);
        const sessionId = asNonEmptyString(request.params.session_id) ?? this.#sessionId;
        if (!profile || !runId || !sessionId) {
            return null;
        }
        const bootstrap = this.#runtimeTrustState.getBootstrap(profile);
        if (!bootstrap) {
            return null;
        }
        if (bootstrap.sessionId !== sessionId ||
            bootstrap.runId !== runId ||
            bootstrap.status !== "ready" ||
            !this.#doesStrictTargetBindingMatch(this.#resolveRequestTargetBinding(request), bootstrap)) {
            return null;
        }
        return asNonEmptyString(bootstrap.mainWorldSecret);
    }
    async #sendMessageWithContentScriptRecovery(tabId, forward, request) {
        try {
            await this.chromeApi.tabs.sendMessage(tabId, forward);
            return;
        }
        catch (initialError) {
            try {
                if (this.#shouldEnsureMainWorldBridge(forward.command, null)) {
                    await this.#ensureMainWorldBridgeInjected(request, tabId);
                }
                await this.#ensureContentScriptInjected(tabId);
            }
            catch (recoveryError) {
                const initialMessage = initialError instanceof Error ? initialError.message : String(initialError);
                const recoveryMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
                throw new Error(`content script recovery failed: ${recoveryMessage}; initial dispatch error: ${initialMessage}`);
            }
            await this.chromeApi.tabs.sendMessage(tabId, forward);
        }
    }
    #emit(message) {
        this.#port?.postMessage(message);
    }
}
export const startChromeBackgroundBridge = (chromeApi, options) => {
    void XHS_GATE_CONTRACT_MARKERS;
    const bridge = new ChromeBackgroundBridge(chromeApi, options);
    bridge.start();
};
const chromeApi = globalThis.chrome;
if (chromeApi?.runtime?.connectNative) {
    startChromeBackgroundBridge(chromeApi);
}
