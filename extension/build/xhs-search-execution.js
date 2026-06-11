import { createPageContextNamespace, createSearchRequestShape, SEARCH_ENDPOINT, serializeSearchRequestShape } from "./xhs-search-types.js";
import { createAuditRecord, createGateOnlySuccess, resolveGate } from "./xhs-search-gate.js";
import { buildEditorInputEvidence, classifyXhsAccountSafetySurface, containsCookie, createDiagnosis, createFailure, createObservability, inferFailure, isTrustedEditorInputValidation, parseCount, resolveSimulatedResult, resolveRiskStateOutput } from "./xhs-search-telemetry.js";
import { buildXhsMediaUploadDiscoveryResult } from "./xhs-media-upload-discovery.js";
import { buildXhsControlledLiveWriteUnavailableResult } from "./xhs-controlled-live-write.js";
import { buildXhsSearchLayer2InteractionEvidence } from "./layer2-humanized-events.js";
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asInteger = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
};
const REQUEST_CONTEXT_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_CONTEXT_WAIT_MAX_MS = 15_000;
const REQUEST_CONTEXT_WAIT_RETRY_MS = 250;
const REQUEST_CONTEXT_FORWARD_DEADLINE_SAFETY_MS = 6_000;
const CLOSEOUT_PROVENANCE_BIND_FRESH_WINDOW_MS = 30_000;
const asString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const toIsoString = (value) => new Date(value).toISOString();
const buildSearchPassiveApiCaptureArtifactIdentity = (input) => [
    "xhs.search.passive_api_capture",
    input.runId,
    input.pageContextNamespace,
    input.shapeKey,
    String(input.capturedAt)
].join(":");
const buildPassiveApiCaptureEvidenceDiagnostic = (routeEvidence) => ({
    evidence_class: "passive_api_capture",
    evidence_role: "diagnostic",
    route_role: "supporting",
    path_kind: "api",
    source_kind: "page_request",
    current_page_natural_request: true,
    synthetic_replay: false,
    live_closeout_evidence: false,
    syvert_normalized_output: false,
    request_payload_included: false,
    response_payload_included: false,
    redaction_state: "payload_omitted",
    route: routeEvidence.route,
    method: routeEvidence.method,
    endpoint: routeEvidence.endpoint,
    request_url: routeEvidence.request_url,
    status_code: routeEvidence.status_code,
    run_id: routeEvidence.run_id,
    profile_ref: routeEvidence.profile_ref,
    session_id: routeEvidence.session_id,
    target_tab_id: routeEvidence.target_tab_id,
    page_url: routeEvidence.page_url,
    action_ref: routeEvidence.action_ref,
    observed_at: routeEvidence.observed_at,
    captured_at: routeEvidence.captured_at,
    page_context_namespace: routeEvidence.page_context_namespace,
    shape_key: routeEvidence.shape_key,
    artifact_identity: routeEvidence.artifact_identity
});
const withPassiveApiCaptureEvidenceDiagnostic = (routeEvidence) => ({
    passive_api_capture_evidence: buildPassiveApiCaptureEvidenceDiagnostic(routeEvidence)
});
const normalizeSearchQueryText = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.normalize("NFKC").trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
};
const isCurrentSearchPageForQuery = (href, query) => {
    const expectedQuery = normalizeSearchQueryText(query);
    if (!expectedQuery) {
        return false;
    }
    try {
        const url = new URL(href);
        if (url.hostname !== "www.xiaohongshu.com" || !url.pathname.includes("/search_result")) {
            return false;
        }
        return normalizeSearchQueryText(url.searchParams.get("keyword")) === expectedQuery;
    }
    catch {
        return false;
    }
};
const pickFirstString = (record, keys) => {
    for (const key of keys) {
        const value = asString(record[key]);
        if (value) {
            return value;
        }
    }
    return null;
};
const normalizeXhsUrl = (value) => {
    if (!value) {
        return null;
    }
    try {
        return new URL(value, "https://www.xiaohongshu.com").toString();
    }
    catch {
        return value;
    }
};
const isXhsNoteCardUrl = (value) => {
    if (!value) {
        return false;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        return (url.hostname === "www.xiaohongshu.com" &&
            (url.pathname.startsWith("/explore/") || url.pathname.startsWith("/discovery/item/")));
    }
    catch {
        return false;
    }
};
const isXhsUserProfileUrl = (value) => {
    if (!value) {
        return false;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        return url.hostname === "www.xiaohongshu.com" && url.pathname.startsWith("/user/profile/");
    }
    catch {
        return false;
    }
};
const parseXsecFromUrl = (value) => {
    if (!value) {
        return {
            xsec_token: null,
            xsec_source: null
        };
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        return {
            xsec_token: asString(url.searchParams.get("xsec_token")),
            xsec_source: asString(url.searchParams.get("xsec_source"))
        };
    }
    catch {
        return {
            xsec_token: null,
            xsec_source: null
        };
    }
};
const buildXhsContinuityUrl = (input) => {
    if (!input.id || !input.xsecToken) {
        return null;
    }
    const path = input.kind === "note"
        ? `/explore/${encodeURIComponent(input.id)}`
        : `/user/profile/${encodeURIComponent(input.id)}`;
    const url = new URL(path, "https://www.xiaohongshu.com");
    url.searchParams.set("xsec_token", input.xsecToken);
    if (input.xsecSource) {
        url.searchParams.set("xsec_source", input.xsecSource);
    }
    return url.toString();
};
const collectSearchDomCards = (value, seen = new Set()) => {
    const record = asRecord(value);
    if (record) {
        if (seen.has(record)) {
            return [];
        }
        seen.add(record);
        const userRecord = asRecord(record.user) ?? asRecord(record.author);
        const noteCardRecord = asRecord(record.note_card) ?? asRecord(record.noteCard);
        const hasKnownSearchCardShape = noteCardRecord !== null ||
            "display_title" in record ||
            "displayTitle" in record ||
            "interact_info" in record ||
            "cover" in record ||
            "image_list" in record ||
            "video_info" in record;
        const noteCardUserRecord = asRecord(noteCardRecord?.user) ?? asRecord(noteCardRecord?.author) ?? null;
        const noteId = pickFirstString(record, ["note_id", "noteId", "id"]) ??
            (noteCardRecord ? pickFirstString(noteCardRecord, ["note_id", "noteId", "id"]) : null);
        const userId = pickFirstString(record, ["user_id", "userId"]) ??
            (userRecord ? pickFirstString(userRecord, ["user_id", "userId", "id"]) : null) ??
            (noteCardUserRecord ? pickFirstString(noteCardUserRecord, ["user_id", "userId", "id"]) : null);
        const rawDetailUrl = normalizeXhsUrl(pickFirstString(record, ["detail_url", "detailUrl", "note_url", "noteUrl", "href", "url", "link"]) ??
            (noteCardRecord
                ? pickFirstString(noteCardRecord, ["detail_url", "detailUrl", "note_url", "noteUrl", "href", "url", "link"])
                : null));
        const rawUserHomeUrl = normalizeXhsUrl(pickFirstString(record, ["user_home_url", "userHomeUrl", "author_url", "authorUrl", "user_url", "userUrl"]) ??
            (userRecord ? pickFirstString(userRecord, ["user_home_url", "userHomeUrl", "url", "link"]) : null) ??
            (noteCardUserRecord
                ? pickFirstString(noteCardUserRecord, ["user_home_url", "userHomeUrl", "url", "link"])
                : null));
        const parsedDetail = parseXsecFromUrl(rawDetailUrl);
        const parsedUser = parseXsecFromUrl(rawUserHomeUrl);
        const xsecToken = pickFirstString(record, ["xsec_token", "xsecToken"]) ??
            (noteCardRecord ? pickFirstString(noteCardRecord, ["xsec_token", "xsecToken"]) : null) ??
            parsedDetail.xsec_token ??
            parsedUser.xsec_token;
        const xsecSource = pickFirstString(record, ["xsec_source", "xsecSource"]) ??
            (noteCardRecord ? pickFirstString(noteCardRecord, ["xsec_source", "xsecSource"]) : null) ??
            parsedDetail.xsec_source ??
            parsedUser.xsec_source;
        const detailUrl = isXhsNoteCardUrl(rawDetailUrl)
            ? rawDetailUrl
            : hasKnownSearchCardShape
                ? buildXhsContinuityUrl({
                    kind: "note",
                    id: noteId,
                    xsecToken,
                    xsecSource
                })
                : null;
        const userHomeUrl = isXhsUserProfileUrl(rawUserHomeUrl)
            ? rawUserHomeUrl
            : hasKnownSearchCardShape
                ? buildXhsContinuityUrl({
                    kind: "user",
                    id: userId,
                    xsecToken,
                    xsecSource
                })
                : null;
        const card = {
            title: pickFirstString(record, ["title", "display_title", "displayTitle", "desc"]) ??
                (noteCardRecord ? pickFirstString(noteCardRecord, ["title", "display_title", "displayTitle"]) : null),
            note_id: noteId,
            user_id: userId,
            detail_url: detailUrl,
            user_home_url: userHomeUrl,
            xsec_token: xsecToken,
            xsec_source: xsecSource
        };
        const hasCardSignal = card.detail_url !== null || card.user_home_url !== null;
        return [
            ...(hasCardSignal ? [card] : []),
            ...Object.values(record).flatMap((entry) => collectSearchDomCards(entry, seen))
        ];
    }
    if (Array.isArray(value)) {
        return value.flatMap((entry) => collectSearchDomCards(entry, seen));
    }
    return [];
};
const resolveSearchDomExtraction = async (env) => {
    const state = (typeof env.readPageStateRoot === "function" ? await env.readPageStateRoot().catch(() => null) : null) ??
        (typeof env.getPageStateRoot === "function" ? env.getPageStateRoot() : null);
    const stateCards = collectSearchDomCards(state);
    if (stateCards.length > 0) {
        return {
            extraction_layer: "hydration_state",
            extraction_locator: "window.__INITIAL_STATE__",
            cards: stateCards
        };
    }
    const domState = typeof env.readSearchDomState === "function" ? await env.readSearchDomState().catch(() => null) : null;
    const domStateRecord = asRecord(domState);
    const domCards = collectSearchDomCards(domStateRecord?.cards ?? domState);
    if (domCards.length > 0) {
        return {
            extraction_layer: domStateRecord?.extraction_layer === "script_json" ? "script_json" : "dom_selector",
            extraction_locator: asString(domStateRecord?.extraction_locator) ??
                (domStateRecord?.extraction_layer === "script_json"
                    ? "script[type='application/json']"
                    : ".search-result-container"),
            cards: domCards
        };
    }
    return null;
};
const buildSearchTargetContinuity = (cards) => cards.map((card) => ({
    target_url: card.detail_url ?? card.user_home_url,
    note_id: card.note_id,
    user_id: card.user_id,
    detail_url: card.detail_url,
    user_home_url: card.user_home_url,
    xsec_token: card.xsec_token,
    xsec_source: card.xsec_source,
    token_presence: card.xsec_token && card.xsec_token.trim().length > 0
        ? "present"
        : card.xsec_token === ""
            ? "empty"
            : "missing",
    source_route: "xhs.search"
}));
const buildSearchDomPageStateFallbackEvidence = (input) => ({
    evidence_class: "dom_state_extraction",
    evidence_role: "diagnostic",
    route_role: "supporting",
    path_kind: input.extraction.extraction_layer === "hydration_state" ? "page_state" : "dom",
    source_kind: input.extraction.extraction_layer,
    evidence_status: "success",
    fallback_used: true,
    fallback_reason: input.fallbackReason,
    confidence: {
        level: "medium",
        basis: "current search page matched requested query and exposed reusable card continuity signals"
    },
    limits: {
        passive_api_capture_evidence: false,
        live_closeout_evidence: false,
        provider_aware_closeout_boundary: false,
        syvert_normalized_output: false,
        request_payload_included: false,
        response_payload_included: false,
        browser_live_claim: false
    },
    provenance: {
        command: "xhs.search",
        page_kind: "search",
        page_url: input.pageUrl,
        run_id: input.runId,
        profile_ref: input.profileRef,
        session_id: input.sessionId,
        target_tab_id: input.targetTabId,
        action_ref: input.actionRef,
        extraction_locator: input.extraction.extraction_locator,
        extracted_at: input.extractedAt,
        data_ref: {
            query: input.query
        }
    }
});
const performSearchPassiveAction = async (input, env) => {
    if (typeof env.performSearchPassiveAction !== "function") {
        return null;
    }
    try {
        return asRecord(await env.performSearchPassiveAction({
            query: input.params.query,
            pageUrl: env.getLocationHref(),
            runId: input.executionContext.runId,
            actionRef: input.executionContext.gateInvocationId ?? input.executionContext.runId,
            timeoutMs: Math.min(typeof input.options.timeout_ms === "number" &&
                Number.isFinite(input.options.timeout_ms) &&
                input.options.timeout_ms > 0
                ? Math.floor(input.options.timeout_ms)
                : 6_000, 12_000),
            debuggerActionAllowed: input.options.closeout_evidence_evaluation === true ||
                input.options.closeout_audit_required === true
        }));
    }
    catch (error) {
        return {
            evidence_class: "humanized_action",
            action_kind: "passive_action_diagnostic",
            action_ref: input.executionContext.gateInvocationId ?? input.executionContext.runId,
            run_id: input.executionContext.runId,
            page_url: env.getLocationHref(),
            query: input.params.query,
            failed_before_evidence: true,
            error: error instanceof Error ? error.message : String(error)
        };
    }
};
const withExecutionAuditInFailurePayload = (result, executionAudit) => {
    if (result.ok) {
        return result;
    }
    return {
        ...result,
        payload: {
            ...result.payload,
            execution_audit: executionAudit
        }
    };
};
const withLayer2InteractionInSuccessPayload = (result, layer2Interaction) => {
    if (!result.ok || !layer2Interaction) {
        return result;
    }
    const summary = asRecord(result.payload.summary);
    if (!summary) {
        return result;
    }
    return {
        ...result,
        payload: {
            ...result.payload,
            summary: {
                ...summary,
                layer2_interaction: layer2Interaction
            }
        }
    };
};
const withLayer2InteractionInPayload = (result, layer2Interaction) => {
    if (!layer2Interaction) {
        return result;
    }
    return {
        ...result,
        payload: {
            ...result.payload,
            layer2_interaction: layer2Interaction
        }
    };
};
const serializeCanonicalShape = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const shape = createSearchRequestShape({
        keyword: record.keyword,
        page: record.page,
        page_size: record.page_size,
        limit: record.limit,
        sort: record.sort,
        note_type: record.note_type
    });
    return shape ? serializeSearchRequestShape(shape) : null;
};
const layer2InteractionSummary = (layer2Interaction) => layer2Interaction ? { layer2_interaction: layer2Interaction } : {};
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const asRecordArray = (value) => Array.isArray(value)
    ? value.filter((item) => asRecord(item) !== null)
    : [];
const buildProviderAwareReadPathSummaryFields = (options) => {
    const providerRequirementRefs = asStringArray(options.provider_requirement_refs);
    const targetBindingTransitionEvidence = asRecordArray(options.target_binding_transition_evidence);
    const downstreamSliceRefs = asStringArray(options.downstream_slice_refs);
    const nonProofs = asStringArray(options.non_proofs);
    const pageRuntimeReadinessBlockingReasons = asStringArray(options.page_runtime_readiness_blocking_reasons);
    return {
        ...(asRecord(options.xhs_driver_provider_requirements)
            ? {
                xhs_driver_provider_requirements: asRecord(options.xhs_driver_provider_requirements)
            }
            : {}),
        ...(providerRequirementRefs.length > 0
            ? { provider_requirement_refs: providerRequirementRefs }
            : {}),
        ...(asString(options.runtime_binding_ref)
            ? { runtime_binding_ref: asString(options.runtime_binding_ref) }
            : {}),
        ...(asString(options.target_binding_snapshot_ref)
            ? { target_binding_snapshot_ref: asString(options.target_binding_snapshot_ref) }
            : {}),
        ...(asRecord(options.xhs_runtime_binding)
            ? { xhs_runtime_binding: asRecord(options.xhs_runtime_binding) }
            : {}),
        ...(asRecord(options.target_binding_snapshot)
            ? { target_binding_snapshot: asRecord(options.target_binding_snapshot) }
            : {}),
        ...(targetBindingTransitionEvidence.length > 0
            ? { target_binding_transition_evidence: targetBindingTransitionEvidence }
            : {}),
        ...(downstreamSliceRefs.length > 0 ? { downstream_slice_refs: downstreamSliceRefs } : {}),
        ...(nonProofs.length > 0 ? { non_proofs: nonProofs } : {}),
        ...(asString(options.page_runtime_readiness_ref)
            ? { page_runtime_readiness_ref: asString(options.page_runtime_readiness_ref) }
            : {}),
        ...(asRecord(options.xhs_page_runtime_readiness)
            ? { xhs_page_runtime_readiness: asRecord(options.xhs_page_runtime_readiness) }
            : {}),
        ...(asString(options.page_runtime_readiness_decision)
            ? { page_runtime_readiness_decision: asString(options.page_runtime_readiness_decision) }
            : {}),
        ...(pageRuntimeReadinessBlockingReasons.length > 0
            ? { page_runtime_readiness_blocking_reasons: pageRuntimeReadinessBlockingReasons }
            : {})
    };
};
const BLOCKED_READINESS_STATUSES = new Set(["blocked", "deny", "denied", "not_ready"]);
const ALLOWED_REQUIRED_READINESS_STATUSES = new Set(["ready", "not_required"]);
const DENY_READINESS_DECISIONS = new Set(["deny", "denied", "blocked", "defer", "deferred"]);
const TARGET_BINDING_ALLOWED_STATES = new Set(["bound"]);
const RUNTIME_BINDING_ALLOWED_STATUSES = new Set(["declared", "ready"]);
const RUNTIME_BINDING_CURRENT_FRESHNESS = new Set(["current_run"]);
const ALLOWED_PROVIDER_AWARE_GATE_REASONS = new Set(["LIVE_MODE_APPROVED"]);
const EXPECTED_XHS_SEARCH_PROVIDER_REQUIREMENT_REF = "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read";
const EXPECTED_XHS_SEARCH_COMMAND = "xhs.search";
const EXPECTED_XHS_SEARCH_ABILITY_ID = "xhs.note.search.v1";
const EXPECTED_XHS_SEARCH_ABILITY_LAYER = "L3";
const EXPECTED_XHS_SEARCH_ACTION = "read";
const EXPECTED_XHS_SEARCH_ROUTE_BUCKET = "search";
const EXPECTED_XHS_TARGET_DOMAIN = "www.xiaohongshu.com";
const EXPECTED_XHS_SEARCH_TARGET_PAGE_CLASS = "search_tab";
const parseTargetBindingSnapshotRef = (value) => {
    if (!value) {
        return null;
    }
    const match = /^FR-0063\.target_binding_snapshot\.v1\/([^/]+)\/([^/]+)$/.exec(value);
    if (!match) {
        return null;
    }
    return {
        runId: match[1] ?? "",
        routeBucket: match[2] ?? ""
    };
};
const parseRuntimeBindingRef = (value) => {
    if (!value) {
        return null;
    }
    const match = /^FR-0061\.xhs_runtime_binding\.v1\/([^/]+)\/([^/]+)$/.exec(value);
    if (!match) {
        return null;
    }
    return {
        runId: match[1] ?? "",
        routeBucket: match[2] ?? ""
    };
};
const parseTargetBindingEvidenceRefRunId = (value) => {
    if (!value) {
        return null;
    }
    const fr0063Match = /^FR-0063\.[^/]+\.v1\/([^/]+)\//.exec(value);
    if (fr0063Match) {
        return fr0063Match[1] ?? null;
    }
    const transitionMatch = /^target-binding-transition:([^:]+):/.exec(value);
    return transitionMatch?.[1] ?? null;
};
const isTargetBindingEvidenceRefCurrentRun = (value, activeRunId) => {
    const refRunId = parseTargetBindingEvidenceRefRunId(value);
    return !refRunId || refRunId === activeRunId;
};
const hasCurrentRunTransitionEvidence = (transitionRefs, transitionEvidence, activeRunId, reasons) => {
    let hasTransitionEvidence = false;
    for (const transitionRef of transitionRefs) {
        if (transitionRef.length === 0) {
            continue;
        }
        hasTransitionEvidence = true;
        if (!isTargetBindingEvidenceRefCurrentRun(transitionRef, activeRunId)) {
            reasons.push("target_binding_evidence_ref_mismatch");
        }
    }
    for (const transition of transitionEvidence) {
        const transitionId = asString(transition.transition_id);
        if (!transitionId) {
            continue;
        }
        hasTransitionEvidence = true;
        if (!isTargetBindingEvidenceRefCurrentRun(transitionId, activeRunId)) {
            reasons.push("target_binding_evidence_ref_mismatch");
        }
    }
    return hasTransitionEvidence;
};
const collectTargetBindingRequiredEvidenceRefBlockers = (targetBindingSnapshot, transitionEvidence, activeRunId) => {
    if (asString(targetBindingSnapshot.state) !== "bound") {
        return [];
    }
    const reasons = [];
    const evidenceRefs = asRecord(targetBindingSnapshot.evidence_refs);
    if (!evidenceRefs) {
        return [
            "target_binding_evidence_refs_missing",
            "target_binding_candidate_ref_missing",
            "target_binding_url_match_ref_missing",
            "target_binding_dom_observation_ref_missing",
            "target_binding_runtime_state_ref_missing",
            "target_binding_extension_bridge_ref_missing",
            "target_binding_transition_refs_missing"
        ];
    }
    const requiredRefs = [
        ["candidate_ref", "target_binding_candidate_ref_missing"],
        ["url_match_ref", "target_binding_url_match_ref_missing"],
        ["dom_observation_ref", "target_binding_dom_observation_ref_missing"],
        ["runtime_state_ref", "target_binding_runtime_state_ref_missing"],
        ["extension_bridge_ref", "target_binding_extension_bridge_ref_missing"]
    ];
    for (const [field, missingReason] of requiredRefs) {
        const ref = asString(evidenceRefs[field]);
        if (!ref) {
            reasons.push(missingReason);
            continue;
        }
        if (!isTargetBindingEvidenceRefCurrentRun(ref, activeRunId)) {
            reasons.push("target_binding_evidence_ref_mismatch");
        }
    }
    const transitionRefs = asStringArray(evidenceRefs.transition_refs);
    if (!hasCurrentRunTransitionEvidence(transitionRefs, transitionEvidence, activeRunId, reasons)) {
        reasons.push("target_binding_transition_refs_missing");
    }
    const redactionState = asString(evidenceRefs.redaction_state ?? targetBindingSnapshot.redaction_state);
    if (redactionState === "redaction_required" ||
        redactionState === "policy_missing" ||
        redactionState === "invalid") {
        reasons.push("target_binding_redaction_invalid");
    }
    const evidenceStatus = asString(evidenceRefs.evidence_status ?? targetBindingSnapshot.evidence_status);
    const evidenceCompleteness = asString(evidenceRefs.evidence_completeness ?? targetBindingSnapshot.evidence_completeness);
    const partial = evidenceRefs.partial ?? targetBindingSnapshot.partial;
    if (evidenceStatus === "partial" ||
        evidenceStatus === "unavailable" ||
        evidenceStatus === "unknown" ||
        evidenceStatus === "invalid" ||
        evidenceCompleteness === "partial" ||
        evidenceCompleteness === "unavailable" ||
        evidenceCompleteness === "unknown" ||
        evidenceCompleteness === "invalid" ||
        partial === true) {
        reasons.push("target_binding_evidence_partial");
    }
    const sourceOwner = asString(evidenceRefs.source_owner ?? targetBindingSnapshot.source_owner);
    if (sourceOwner &&
        sourceOwner !== "#1161" &&
        sourceOwner !== "target_binding_state_machine" &&
        sourceOwner !== "xhs_target_binding_state_machine") {
        reasons.push("target_binding_source_owner_mismatch");
    }
    return reasons;
};
const collectTargetBindingEvidenceBlockers = (targetBindingSnapshotRef, targetBindingSnapshot, pageRuntimeReadiness, transitionEvidence, activeRunId) => {
    if (!targetBindingSnapshot) {
        return [];
    }
    const reasons = [];
    const parsedRef = parseTargetBindingSnapshotRef(targetBindingSnapshotRef);
    if (targetBindingSnapshotRef && !parsedRef) {
        reasons.push("target_binding_ref_mismatch");
    }
    const freshnessScope = asString(targetBindingSnapshot.freshness_scope);
    if (!freshnessScope) {
        reasons.push("target_binding_freshness_missing");
    }
    else if (freshnessScope !== "current_run") {
        if (freshnessScope === "historical_background") {
            reasons.push("target_binding_freshness_stale");
        }
        else if (freshnessScope === "unknown") {
            reasons.push("target_binding_freshness_unknown");
        }
        else if (freshnessScope === "stale" || freshnessScope === "lost") {
            reasons.push("target_binding_freshness_stale");
        }
        reasons.push(`target_binding_freshness:${freshnessScope}`);
    }
    const snapshotRunId = asString(targetBindingSnapshot.run_id);
    const readinessRunId = asString(pageRuntimeReadiness?.run_id);
    if (!snapshotRunId) {
        reasons.push("target_binding_run_id_missing");
    }
    else if (snapshotRunId !== activeRunId) {
        reasons.push("target_binding_run_id_mismatch");
    }
    if (pageRuntimeReadiness && !readinessRunId) {
        reasons.push("page_runtime_readiness_run_id_missing");
    }
    else if (readinessRunId && readinessRunId !== activeRunId) {
        reasons.push("page_runtime_readiness_run_id_mismatch");
    }
    if (parsedRef) {
        if (parsedRef.routeBucket !== EXPECTED_XHS_SEARCH_ROUTE_BUCKET) {
            reasons.push("target_binding_ref_mismatch");
            reasons.push(`target_binding_ref_route:${parsedRef.routeBucket}`);
        }
        if (parsedRef.runId !== activeRunId) {
            reasons.push("target_binding_ref_mismatch");
        }
        if (snapshotRunId && parsedRef.runId !== snapshotRunId) {
            reasons.push("target_binding_ref_mismatch");
        }
        if (readinessRunId && parsedRef.runId !== readinessRunId) {
            reasons.push("target_binding_ref_mismatch");
        }
    }
    if (snapshotRunId && readinessRunId && snapshotRunId !== readinessRunId) {
        reasons.push("target_binding_run_id_mismatch");
    }
    const targetScope = asRecord(targetBindingSnapshot.target_scope);
    if (!targetScope) {
        reasons.push("target_binding_scope_missing");
    }
    else {
        const targetDomain = asString(targetScope.target_domain);
        const targetPageClass = asString(targetScope.target_page_class);
        if (targetDomain !== EXPECTED_XHS_TARGET_DOMAIN) {
            reasons.push("target_binding_scope_mismatch");
        }
        if (targetPageClass !== EXPECTED_XHS_SEARCH_TARGET_PAGE_CLASS) {
            reasons.push("target_binding_scope_mismatch");
        }
    }
    const routeBucket = asString(targetBindingSnapshot.route_bucket);
    if (routeBucket !== EXPECTED_XHS_SEARCH_ROUTE_BUCKET) {
        reasons.push("target_binding_scope_mismatch");
    }
    reasons.push(...collectTargetBindingRequiredEvidenceRefBlockers(targetBindingSnapshot, transitionEvidence, activeRunId));
    return reasons;
};
const collectProviderRequirementBlockers = (providerRequirements, providerRequirementRefs) => {
    if (!providerRequirements) {
        return [];
    }
    const reasons = [];
    const declarationRefs = asStringArray(providerRequirements.provider_requirement_refs);
    if (providerRequirementRefs.length === 0 || declarationRefs.length === 0) {
        return reasons;
    }
    const declarationRefSet = new Set(declarationRefs);
    if (!providerRequirementRefs.every((ref) => declarationRefSet.has(ref)) ||
        !declarationRefSet.has(EXPECTED_XHS_SEARCH_PROVIDER_REQUIREMENT_REF)) {
        reasons.push("provider_requirement_ref_mismatch");
    }
    const primaryRequirementRef = asString(providerRequirements.provider_requirement_ref);
    if (primaryRequirementRef &&
        primaryRequirementRef !== EXPECTED_XHS_SEARCH_PROVIDER_REQUIREMENT_REF) {
        reasons.push("provider_requirement_ref_mismatch");
    }
    const abilityScope = asRecord(providerRequirements.ability_scope);
    const command = asString(abilityScope?.command);
    const abilityId = asString(abilityScope?.ability_id);
    const abilityLayer = asString(abilityScope?.ability_layer);
    const action = asString(abilityScope?.ability_action);
    if (command !== EXPECTED_XHS_SEARCH_COMMAND ||
        abilityId !== EXPECTED_XHS_SEARCH_ABILITY_ID ||
        abilityLayer !== EXPECTED_XHS_SEARCH_ABILITY_LAYER ||
        action !== EXPECTED_XHS_SEARCH_ACTION) {
        reasons.push("provider_requirement_scope_mismatch");
    }
    const requiredActions = asStringArray(providerRequirements.required_actions);
    if (!requiredActions.includes(EXPECTED_XHS_SEARCH_ACTION)) {
        reasons.push("provider_requirement_scope_mismatch");
    }
    return reasons;
};
const collectRuntimeBindingBlockers = (runtimeBindingRef, runtimeBinding, activeRunId) => {
    const reasons = [];
    if (!runtimeBindingRef) {
        reasons.push("runtime_binding_ref_missing");
    }
    else {
        const parsedRuntimeBindingRef = parseRuntimeBindingRef(runtimeBindingRef);
        if (!parsedRuntimeBindingRef ||
            parsedRuntimeBindingRef.routeBucket !== EXPECTED_XHS_SEARCH_ROUTE_BUCKET ||
            parsedRuntimeBindingRef.runId !== activeRunId) {
            reasons.push("runtime_binding_ref_mismatch");
        }
    }
    if (!runtimeBinding) {
        reasons.push("runtime_binding_evidence_missing");
        return reasons;
    }
    const targetDomain = asString(runtimeBinding.target_domain);
    const targetPage = asString(runtimeBinding.target_page);
    if (targetDomain !== EXPECTED_XHS_TARGET_DOMAIN ||
        targetPage !== EXPECTED_XHS_SEARCH_TARGET_PAGE_CLASS) {
        reasons.push("runtime_binding_scope_mismatch");
    }
    const bindingStatus = asString(runtimeBinding.binding_status);
    if (!bindingStatus) {
        reasons.push("runtime_binding_status_missing");
    }
    else if (!RUNTIME_BINDING_ALLOWED_STATUSES.has(bindingStatus)) {
        reasons.push("runtime_binding_not_bound");
        reasons.push(`runtime_binding_status:${bindingStatus}`);
    }
    const bindingFreshness = asString(runtimeBinding.binding_freshness);
    if (!bindingFreshness) {
        reasons.push("runtime_binding_freshness_missing");
    }
    else if (!RUNTIME_BINDING_CURRENT_FRESHNESS.has(bindingFreshness)) {
        if (bindingFreshness === "historical_background") {
            reasons.push("runtime_binding_stale");
        }
        reasons.push(`runtime_binding_freshness:${bindingFreshness}`);
    }
    return reasons;
};
const collectReadinessDimensionBlockers = (dimension, prefix, missingReason) => {
    if (!dimension) {
        return [missingReason];
    }
    if (dimension.required === false) {
        return [];
    }
    const status = asString(dimension.status);
    const gateDecision = asString(dimension.gate_decision);
    const blockingReasons = asStringArray(dimension.blocking_reasons);
    const reasons = [];
    if (!status) {
        reasons.push(`${prefix}:status_missing`);
    }
    else if (!ALLOWED_REQUIRED_READINESS_STATUSES.has(status)) {
        reasons.push(`${prefix}:${status}`);
    }
    if (gateDecision && DENY_READINESS_DECISIONS.has(gateDecision)) {
        reasons.push(`${prefix}:${gateDecision}`);
    }
    reasons.push(...blockingReasons.map((reason) => `${prefix}:${reason}`));
    return reasons;
};
const resolveProviderAwareReadPathBlock = (options, activeRunId) => {
    const summaryFields = buildProviderAwareReadPathSummaryFields(options);
    const targetBindingSnapshot = asRecord(options.target_binding_snapshot);
    const pageRuntimeReadiness = asRecord(options.xhs_page_runtime_readiness);
    const pageReadiness = asRecord(pageRuntimeReadiness?.page_readiness);
    const runtimeReadiness = asRecord(pageRuntimeReadiness?.runtime_readiness);
    const providerAdmissionReadiness = asRecord(pageRuntimeReadiness?.provider_admission_readiness);
    const runtimeBindingRef = asString(options.runtime_binding_ref);
    const runtimeBinding = asRecord(options.xhs_runtime_binding);
    const targetBindingState = asString(targetBindingSnapshot?.state);
    const targetBindingSnapshotRef = asString(options.target_binding_snapshot_ref);
    const providerRequirements = asRecord(options.xhs_driver_provider_requirements);
    const providerRequirementRefs = asStringArray(options.provider_requirement_refs);
    const providerRequirementDeclarationRefs = asStringArray(providerRequirements?.provider_requirement_refs);
    const readinessCommand = asString(pageRuntimeReadiness?.command);
    const reasons = [
        ...(targetBindingSnapshot ? [] : ["target_binding_snapshot_missing"]),
        ...(targetBindingSnapshotRef ? [] : ["target_binding_snapshot_ref_missing"]),
        ...(providerRequirements ? [] : ["xhs_driver_provider_requirements_missing"]),
        ...(providerRequirementRefs.length > 0 && providerRequirementDeclarationRefs.length > 0
            ? []
            : ["provider_requirement_refs_missing"]),
        ...(pageRuntimeReadiness ? [] : ["page_runtime_readiness_missing"]),
        ...(readinessCommand && readinessCommand !== EXPECTED_XHS_SEARCH_COMMAND
            ? ["page_runtime_readiness_command_mismatch"]
            : []),
        ...collectTargetBindingEvidenceBlockers(targetBindingSnapshotRef, targetBindingSnapshot, pageRuntimeReadiness, asRecordArray(options.target_binding_transition_evidence), activeRunId),
        ...collectProviderRequirementBlockers(providerRequirements, providerRequirementRefs),
        ...collectRuntimeBindingBlockers(runtimeBindingRef, runtimeBinding, activeRunId),
        ...asStringArray(targetBindingSnapshot?.blocking_reasons).map((reason) => `target_binding:${reason}`),
        ...collectReadinessDimensionBlockers(pageReadiness, "page", "page_readiness_missing"),
        ...collectReadinessDimensionBlockers(runtimeReadiness, "runtime", "runtime_readiness_missing"),
        ...collectReadinessDimensionBlockers(providerAdmissionReadiness, "provider", "provider_admission_result_missing"),
        ...asStringArray(options.page_runtime_readiness_blocking_reasons)
    ];
    const overallReadiness = asString(pageRuntimeReadiness?.overall_readiness);
    const readinessGateDecision = asString(pageRuntimeReadiness?.gate_decision);
    const optionReadinessDecision = asString(options.page_runtime_readiness_decision);
    if (!TARGET_BINDING_ALLOWED_STATES.has(targetBindingState ?? "")) {
        reasons.push("target_binding:target_binding_not_bound");
        reasons.push(`target_binding_state:${targetBindingState ?? "missing"}`);
    }
    if (overallReadiness && BLOCKED_READINESS_STATUSES.has(overallReadiness)) {
        reasons.push(`overall_readiness:${overallReadiness}`);
    }
    if (readinessGateDecision && DENY_READINESS_DECISIONS.has(readinessGateDecision)) {
        reasons.push(`page_runtime_gate:${readinessGateDecision}`);
    }
    if (optionReadinessDecision && DENY_READINESS_DECISIONS.has(optionReadinessDecision)) {
        reasons.push(`page_runtime_readiness_decision:${optionReadinessDecision}`);
    }
    const uniqueReasons = Array.from(new Set(reasons));
    if (uniqueReasons.length === 0) {
        return null;
    }
    return {
        reason: "PROVIDER_AWARE_READINESS_DENIED",
        reasons: uniqueReasons,
        summaryFields
    };
};
const withoutAllowedProviderAwareGateReasons = (reasons) => reasons.filter((reason) => !ALLOWED_PROVIDER_AWARE_GATE_REASONS.has(reason));
const uniqueProviderAwareBlockReasons = (baseReasons, block) => Array.from(new Set([
    ...withoutAllowedProviderAwareGateReasons(baseReasons),
    "PROVIDER_AWARE_READINESS_DENIED",
    "PROVIDER_AWARE_LIVE_READ_NOT_CONTINUED",
    ...block.reasons
]));
const resolveBlockedNextRiskState = (current) => {
    if (current === "allowed") {
        return "limited";
    }
    if (current === "limited") {
        return "paused";
    }
    return current;
};
const isProviderAwareLiveReadGate = (gate) => gate.consumer_gate_result.action_type === "read" &&
    (gate.consumer_gate_result.effective_execution_mode === "live_read_limited" ||
        gate.consumer_gate_result.effective_execution_mode === "live_read_high_risk");
const withProviderAwareReadPathBlockPayload = (result, gate, auditRecord, block) => {
    if (result.ok) {
        return result;
    }
    const blockedGateReasons = uniqueProviderAwareBlockReasons(gate.consumer_gate_result.gate_reasons, block);
    const blockedConsumerGateResult = {
        ...gate.consumer_gate_result,
        effective_execution_mode: null,
        gate_decision: "blocked",
        gate_reasons: blockedGateReasons
    };
    const blockedGateOutcome = {
        ...gate.gate_outcome,
        effective_execution_mode: null,
        gate_decision: "blocked",
        gate_reasons: uniqueProviderAwareBlockReasons(gate.gate_outcome.gate_reasons, block),
        requires_manual_confirmation: false
    };
    const blockedRequestAdmissionResult = gate.request_admission_result
        ? {
            ...gate.request_admission_result,
            admission_decision: "blocked",
            effective_runtime_mode: null,
            reason_codes: uniqueProviderAwareBlockReasons([], block)
        }
        : gate.request_admission_result;
    const recordedAtMs = Date.parse(auditRecord.recorded_at);
    const cooldownBase = Number.isFinite(recordedAtMs) ? recordedAtMs : Date.now();
    const blockedAuditRecord = {
        ...auditRecord,
        effective_execution_mode: null,
        gate_decision: "blocked",
        gate_reasons: blockedGateReasons,
        risk_signal: true,
        recovery_signal: false,
        session_rhythm_state: "cooldown",
        cooldown_until: new Date(cooldownBase + 30 * 60_000).toISOString(),
        recovery_started_at: null,
        next_state: resolveBlockedNextRiskState(auditRecord.risk_state),
        transition_trigger: "provider_aware_readiness_denied"
    };
    const blockedGate = {
        ...gate,
        gate_outcome: blockedGateOutcome,
        consumer_gate_result: blockedConsumerGateResult,
        request_admission_result: blockedRequestAdmissionResult
    };
    return {
        ...result,
        payload: {
            ...result.payload,
            ...block.summaryFields,
            provider_aware_read_path_gate: {
                gate_decision: "blocked",
                reason: block.reason,
                blocking_reasons: block.reasons,
                live_execution_continued: false,
                effective_execution_mode: null
            },
            gate_outcome: blockedGateOutcome,
            consumer_gate_result: blockedConsumerGateResult,
            request_admission_result: blockedRequestAdmissionResult,
            risk_state_output: resolveRiskStateOutput(blockedGate, blockedAuditRecord),
            audit_record: blockedAuditRecord
        }
    };
};
const XHS_SEARCH_REPLAY_ORIGIN_ALLOWLIST = new Set([
    "https://www.xiaohongshu.com",
    "https://edith.xiaohongshu.com"
]);
const resolveTrustedSearchTemplateUrl = (value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:" ||
            !XHS_SEARCH_REPLAY_ORIGIN_ALLOWLIST.has(parsed.origin) ||
            parsed.pathname !== SEARCH_ENDPOINT) {
            return null;
        }
        return `${parsed.origin}${SEARCH_ENDPOINT}`;
    }
    catch {
        return null;
    }
};
const isTrustedCapturedTemplate = (template, expected) => {
    const templateRecord = asRecord(template);
    if (!templateRecord) {
        return false;
    }
    if (templateRecord.method !== "POST" ||
        templateRecord.path !== SEARCH_ENDPOINT ||
        templateRecord.page_context_namespace !== expected.pageContextNamespace ||
        templateRecord.shape_key !== expected.shapeKey) {
        return false;
    }
    const templateShape = asRecord(templateRecord.shape);
    if (templateShape?.command !== "xhs.search" ||
        templateShape?.method !== "POST" ||
        templateShape?.pathname !== SEARCH_ENDPOINT ||
        serializeCanonicalShape(templateShape) !== expected.shapeKey) {
        return false;
    }
    if (resolveTrustedSearchTemplateUrl(templateRecord.url) === null) {
        return false;
    }
    const request = asRecord(templateRecord.request);
    if (!request || !asRecord(request.headers)) {
        return false;
    }
    const response = asRecord(templateRecord.response);
    if (!response || !("body" in response)) {
        return false;
    }
    return serializeCanonicalShape(request.body) === expected.shapeKey;
};
const isTrustedRejectedObservation = (observation, expected) => {
    const observationRecord = asRecord(observation);
    if (!observationRecord) {
        return false;
    }
    if (observationRecord.method !== "POST" ||
        observationRecord.path !== SEARCH_ENDPOINT ||
        observationRecord.page_context_namespace !== expected.pageContextNamespace ||
        observationRecord.shape_key !== expected.shapeKey) {
        return false;
    }
    const reason = observationRecord.rejection_reason;
    if (reason !== "synthetic_request_rejected" &&
        reason !== "failed_request_rejected") {
        return false;
    }
    return serializeCanonicalShape(asRecord(observationRecord.shape) ?? asRecord(asRecord(observationRecord.request)?.body)) ===
        expected.shapeKey;
};
const isTransientFailedRequestObservation = (observation) => {
    const observationRecord = asRecord(observation);
    if (observationRecord?.rejection_reason !== "failed_request_rejected") {
        return false;
    }
    const requestStatus = asRecord(observationRecord.request_status);
    return requestStatus?.http_status === null;
};
const BACKEND_REJECTED_SOURCE_REASONS = new Set([
    "SESSION_EXPIRED",
    "ACCOUNT_ABNORMAL",
    "XHS_ACCOUNT_RISK_PAGE",
    "BROWSER_ENV_ABNORMAL",
    "GATEWAY_INVOKER_FAILED",
    "CAPTCHA_REQUIRED",
    "TARGET_API_RESPONSE_INVALID"
]);
const resolveRejectedSourceDetail = (observation) => {
    const observationRecord = asRecord(observation);
    const rejectionReason = observationRecord?.rejection_reason;
    if (!observationRecord || rejectionReason !== "failed_request_rejected") {
        return { reason: "synthetic_request_rejected" };
    }
    const requestStatus = asRecord(observationRecord.request_status);
    const statusCode = asInteger(requestStatus?.http_status) ?? asInteger(observationRecord.status);
    const responseBody = asRecord(asRecord(observationRecord.response)?.body);
    const platformCode = asInteger(responseBody?.code);
    const inferred = inferFailure(statusCode ?? 0, responseBody);
    if (BACKEND_REJECTED_SOURCE_REASONS.has(inferred.reason)) {
        return {
            reason: inferred.reason,
            message: inferred.message,
            ...(typeof statusCode === "number" ? { statusCode } : {}),
            ...(typeof platformCode === "number" ? { platformCode } : {})
        };
    }
    return {
        reason: "failed_request_rejected",
        ...(typeof statusCode === "number" ? { statusCode } : {}),
        ...(typeof platformCode === "number" ? { platformCode } : {})
    };
};
const isTrustedIncompatibleObservation = (observation, expected) => {
    const observationRecord = asRecord(observation);
    if (!observationRecord) {
        return false;
    }
    if (observationRecord.method !== "POST" ||
        observationRecord.path !== SEARCH_ENDPOINT ||
        observationRecord.page_context_namespace !== expected.pageContextNamespace ||
        observationRecord.shape_key === expected.shapeKey) {
        return false;
    }
    const inferredShapeKey = serializeCanonicalShape(asRecord(observationRecord.shape) ?? asRecord(asRecord(observationRecord.request)?.body));
    return inferredShapeKey !== null && inferredShapeKey === observationRecord.shape_key;
};
const waitForRequestContextRetry = async (env, ms) => {
    if (typeof env.sleep === "function") {
        await env.sleep(ms);
        return;
    }
    if (typeof setTimeout !== "function") {
        await Promise.resolve();
        return;
    }
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
const resolveRequestContextWaitMaxAttempts = (options, elapsedBeforeWaitMs = 0) => {
    const timeoutMs = typeof options.timeout_ms === "number" &&
        Number.isFinite(options.timeout_ms) &&
        options.timeout_ms > 0
        ? Math.floor(options.timeout_ms)
        : null;
    const elapsedMs = Math.max(0, Math.floor(elapsedBeforeWaitMs));
    const waitBudgetMs = timeoutMs === null
        ? REQUEST_CONTEXT_WAIT_MAX_MS
        : Math.max(0, timeoutMs - REQUEST_CONTEXT_FORWARD_DEADLINE_SAFETY_MS - elapsedMs);
    const maxWaitMs = Math.min(REQUEST_CONTEXT_WAIT_MAX_MS, waitBudgetMs);
    return Math.max(1, Math.floor(maxWaitMs / REQUEST_CONTEXT_WAIT_RETRY_MS) + 1);
};
const resolveRequestContextState = async (requestInput, env) => {
    const shape = createSearchRequestShape({
        keyword: requestInput.params.query,
        page: requestInput.params.page ?? 1,
        page_size: requestInput.params.limit ?? 20,
        sort: requestInput.params.sort ?? "general",
        note_type: requestInput.params.note_type ?? 0
    });
    const fallbackNamespace = createPageContextNamespace(env.getLocationHref());
    const readCapturedRequestContext = env.readCapturedRequestContext;
    if (!shape || !readCapturedRequestContext) {
        return {
            status: "miss",
            failureReason: "template_missing",
            pageContextNamespace: fallbackNamespace,
            shapeKey: shape ? serializeSearchRequestShape(shape) : "",
            availableShapeKeys: [],
            diagnostics: {
                lookup_unavailable: !readCapturedRequestContext,
                shape_available: Boolean(shape)
            }
        };
    }
    const shapeKey = serializeSearchRequestShape(shape);
    let pageContextNamespace = fallbackNamespace;
    const lookupOnce = async (input) => {
        let lookup = null;
        try {
            pageContextNamespace = createPageContextNamespace(env.getLocationHref());
            lookup = await readCapturedRequestContext({
                method: "POST",
                path: SEARCH_ENDPOINT,
                page_context_namespace: pageContextNamespace,
                shape_key: shapeKey,
                ...(requestInput.expectedProvenance
                    ? {
                        profile_ref: requestInput.expectedProvenance.profile_ref,
                        session_id: requestInput.expectedProvenance.session_id,
                        ...(typeof requestInput.expectedProvenance.target_tab_id === "number"
                            ? { target_tab_id: requestInput.expectedProvenance.target_tab_id }
                            : {}),
                        run_id: requestInput.expectedProvenance.run_id,
                        action_ref: requestInput.expectedProvenance.action_ref,
                        page_url: requestInput.expectedProvenance.page_url
                    }
                    : {}),
                ...(typeof requestInput.minObservedAt === "number"
                    ? { min_observed_at: requestInput.minObservedAt }
                    : {})
            });
        }
        catch {
            return {
                status: "miss",
                failureReason: "template_missing",
                pageContextNamespace,
                shapeKey,
                availableShapeKeys: [],
                diagnostics: {
                    lookup_transport_failed: true
                }
            };
        }
        pageContextNamespace = lookup?.page_context_namespace ?? pageContextNamespace;
        const availableShapeKeys = lookup?.available_shape_keys ?? [];
        const diagnostics = asRecord(lookup?.diagnostics) ?? undefined;
        const siblingShapeKeys = availableShapeKeys.filter((candidate) => candidate !== shapeKey);
        const admittedTemplate = isTrustedCapturedTemplate(lookup?.admitted_template ?? null, {
            pageContextNamespace,
            shapeKey
        })
            ? lookup?.admitted_template ?? null
            : null;
        const rejectedObservation = isTrustedRejectedObservation(lookup?.rejected_observation ?? null, {
            pageContextNamespace,
            shapeKey
        })
            ? lookup?.rejected_observation ?? null
            : null;
        const incompatibleObservation = isTrustedIncompatibleObservation(lookup?.incompatible_observation ?? null, {
            pageContextNamespace,
            shapeKey
        })
            ? lookup?.incompatible_observation ?? null
            : null;
        if (admittedTemplate && admittedTemplate.template_ready !== false) {
            const templateUrl = resolveTrustedSearchTemplateUrl(admittedTemplate.url);
            if (!templateUrl) {
                return {
                    status: "miss",
                    failureReason: "template_missing",
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys,
                    diagnostics
                };
            }
            const admittedResponseRecord = asRecord(admittedTemplate.response.body);
            const admittedBusinessCode = asInteger(admittedResponseRecord?.code);
            if (admittedTemplate.status >= 400 || admittedBusinessCode !== 0) {
                const failure = inferFailure(admittedTemplate.status, admittedTemplate.response.body);
                return {
                    status: "miss",
                    failureReason: "rejected_source",
                    detailReason: BACKEND_REJECTED_SOURCE_REASONS.has(failure.reason)
                        ? failure.reason
                        : "TARGET_API_RESPONSE_INVALID",
                    detailMessage: failure.message,
                    statusCode: admittedTemplate.status,
                    ...(admittedBusinessCode !== null ? { platformCode: admittedBusinessCode } : {}),
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys,
                    observedAt: admittedTemplate.observed_at ?? admittedTemplate.captured_at,
                    diagnostics
                };
            }
            const observedAt = admittedTemplate.observed_at ?? admittedTemplate.captured_at;
            if (env.now() - observedAt > REQUEST_CONTEXT_FRESHNESS_WINDOW_MS) {
                return {
                    status: "miss",
                    failureReason: "template_stale",
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys,
                    observedAt,
                    diagnostics
                };
            }
            return {
                status: "hit",
                template: {
                    request: {
                        url: templateUrl,
                        headers: admittedTemplate.request.headers,
                        body: admittedTemplate.request.body
                    },
                    response: {
                        body: admittedTemplate.response.body
                    },
                    referrer: typeof admittedTemplate.referrer === "string" ? admittedTemplate.referrer : null,
                    capturedAt: admittedTemplate.captured_at,
                    pageContextNamespace
                },
                pageContextNamespace,
                shapeKey
            };
        }
        if (rejectedObservation) {
            if (input?.deferTransientMisses === true &&
                isTransientFailedRequestObservation(rejectedObservation)) {
                const rejectedDetail = resolveRejectedSourceDetail(rejectedObservation);
                return {
                    status: "miss",
                    failureReason: "template_missing",
                    detailReason: rejectedDetail.reason,
                    detailMessage: rejectedDetail.message,
                    statusCode: rejectedDetail.statusCode,
                    platformCode: rejectedDetail.platformCode,
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys,
                    observedAt: rejectedObservation.observed_at ?? rejectedObservation.captured_at,
                    diagnostics
                };
            }
            const rejectedDetail = resolveRejectedSourceDetail(rejectedObservation);
            return {
                status: "miss",
                failureReason: "rejected_source",
                detailReason: rejectedDetail.reason,
                detailMessage: rejectedDetail.message,
                statusCode: rejectedDetail.statusCode,
                platformCode: rejectedDetail.platformCode,
                pageContextNamespace,
                shapeKey,
                availableShapeKeys,
                observedAt: rejectedObservation.observed_at ?? rejectedObservation.captured_at,
                diagnostics
            };
        }
        if (incompatibleObservation || siblingShapeKeys.length > 0) {
            if (input?.deferTransientMisses === true) {
                return {
                    status: "miss",
                    failureReason: "template_missing",
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys: siblingShapeKeys,
                    observedAt: incompatibleObservation?.observed_at ?? incompatibleObservation?.captured_at ?? undefined,
                    diagnostics
                };
            }
            return {
                status: "miss",
                failureReason: "shape_mismatch",
                pageContextNamespace,
                shapeKey,
                availableShapeKeys: siblingShapeKeys,
                observedAt: incompatibleObservation?.observed_at ?? incompatibleObservation?.captured_at ?? undefined,
                diagnostics
            };
        }
        return {
            status: "miss",
            failureReason: "template_missing",
            pageContextNamespace,
            shapeKey,
            availableShapeKeys,
            diagnostics
        };
    };
    const maxAttempts = requestInput.failFastOnMiss === true
        ? 1
        : resolveRequestContextWaitMaxAttempts(requestInput.options, requestInput.elapsedBeforeWaitMs);
    let lastState = await lookupOnce({
        deferTransientMisses: maxAttempts > 1
    });
    for (let attempt = 1; attempt < maxAttempts &&
        lastState.status === "miss" &&
        lastState.failureReason === "template_missing"; attempt += 1) {
        await waitForRequestContextRetry(env, REQUEST_CONTEXT_WAIT_RETRY_MS);
        lastState = await lookupOnce({
            deferTransientMisses: attempt + 1 < maxAttempts
        });
    }
    return lastState;
};
const resolveDebuggerNetworkRequestContextState = (input) => {
    const debuggerAction = asRecord(input.passiveActionEvidence?.debugger_action);
    const context = asRecord(debuggerAction?.debugger_network_context);
    if (!context || context.source !== "chrome_debugger_network") {
        return null;
    }
    const request = asRecord(context.request);
    const response = asRecord(context.response);
    const requestBody = asRecord(request?.body);
    const responseBody = asRecord(response?.body);
    const url = asString(context.url);
    const status = asInteger(context.status);
    const capturedAt = asInteger(context.captured_at) ?? input.now;
    if (!url ||
        status === null ||
        status >= 400 ||
        asString(requestBody?.keyword) !== input.query ||
        asInteger(responseBody?.code) !== 0) {
        return null;
    }
    return {
        status: "hit",
        template: {
            request: {
                url,
                headers: asRecord(request?.headers) ?? {},
                body: request?.body ?? null
            },
            response: {
                body: response?.body ?? null
            },
            referrer: input.pageUrl,
            capturedAt,
            pageContextNamespace: input.pageContextNamespace
        },
        pageContextNamespace: input.pageContextNamespace,
        shapeKey: input.shapeKey
    };
};
const describePassiveActionEvidenceForDiagnosis = (passiveActionEvidence) => {
    if (!passiveActionEvidence) {
        return ["humanized_action=null"];
    }
    const actionKind = asString(passiveActionEvidence.action_kind);
    const error = asString(passiveActionEvidence.error);
    const debuggerAction = asRecord(passiveActionEvidence.debugger_action);
    const debuggerError = asRecord(debuggerAction?.error);
    const debuggerErrorString = asString(debuggerAction?.error);
    const summarizeValue = (key) => {
        const value = passiveActionEvidence[key];
        if (typeof value === "boolean" || typeof value === "number") {
            return `${key}:${String(value)}`;
        }
        if (typeof value === "string" && value.length > 0) {
            return `${key}:${value}`;
        }
        return null;
    };
    const actionSummary = [
        "submit_triggered",
        "same_query_preflight_submit_triggered",
        "same_query_preflight_mode",
        "same_query_preflight_state_change_source",
        "same_query_search_input_refresh_source",
        "search_input_found",
        "query_matched",
        "same_query_input_matched",
        "same_query_perturbed",
        "same_query_preflight_submitted",
        "same_query_search_input_refreshed",
        "search_form_found",
        "search_button_found"
    ]
        .map((key) => summarizeValue(key))
        .filter((entry) => typeof entry === "string")
        .join(",");
    return [
        actionKind ? `humanized_action_kind=${actionKind}` : "humanized_action_kind=unknown",
        error ? `humanized_action_error=${error}` : null,
        asString(debuggerError?.code) ? `debugger_action_error_code=${asString(debuggerError?.code)}` : null,
        asString(debuggerError?.message)
            ? `debugger_action_error_message=${asString(debuggerError?.message)}`
            : null,
        debuggerErrorString ? `debugger_action_error=${debuggerErrorString}` : null,
        debuggerAction ? `debugger_action=${JSON.stringify(debuggerAction)}` : null,
        actionSummary ? `humanized_action_summary=${actionSummary}` : null,
        `humanized_action=${JSON.stringify(passiveActionEvidence)}`
    ].filter((entry) => typeof entry === "string");
};
export const executeXhsSearch = async (input, env) => {
    const executionStartedAt = env.now();
    const gate = resolveGate(input.options, input.executionContext, env.getLocationHref());
    const auditRecord = createAuditRecord(input.executionContext, gate, env);
    let layer2Interaction = buildXhsSearchLayer2InteractionEvidence({
        writeInteractionTierName: gate.write_action_matrix_decisions?.write_interaction_tier ?? null,
        requestedExecutionMode: input.options.requested_execution_mode,
        recoveryProbe: input.options.xhs_recovery_probe === true
    });
    const startedAt = env.now();
    if (gate.consumer_gate_result.gate_decision === "blocked") {
        return withLayer2InteractionInPayload(withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "执行模式门禁阻断了当前 xhs.search 请求", {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "EXECUTION_MODE_GATE_BLOCKED"
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "EXECUTION_MODE_GATE_BLOCKED",
            failureSite: {
                stage: "execution",
                component: "gate",
                target: "requested_execution_mode",
                summary: "执行模式门禁阻断"
            }
        }), createDiagnosis({
            reason: "EXECUTION_MODE_GATE_BLOCKED",
            summary: "执行模式门禁阻断"
        }), gate, auditRecord), gate.execution_audit), layer2Interaction);
    }
    if (input.options.issue_scope === "issue_755" &&
        input.options.discovery_action === "media_upload_path" &&
        input.options.target_page === "creator_publish_tab" &&
        (gate.consumer_gate_result.effective_execution_mode === "dry_run" ||
            gate.consumer_gate_result.effective_execution_mode === "recon")) {
        const mediaUploadDiscovery = env.performMediaUploadDiscovery
            ? await env.performMediaUploadDiscovery({
                source_media_ref: input.params.source_media_ref,
                source_media_digest: input.params.source_media_digest,
                source_media_kind: input.params.source_media_kind,
                run_id: input.executionContext.runId,
                profile_ref: input.options.__runtime_profile_ref ?? null,
                target_tab_id: gate.consumer_gate_result.target_tab_id,
                page_url: env.getLocationHref()
            })
            : buildXhsMediaUploadDiscoveryResult({
                source_media_ref: input.params.source_media_ref,
                source_media_digest: input.params.source_media_digest,
                source_media_kind: input.params.source_media_kind,
                run_id: input.executionContext.runId,
                profile_ref: input.options.__runtime_profile_ref ?? null,
                target_tab_id: gate.consumer_gate_result.target_tab_id,
                page_url: env.getLocationHref()
            });
        return {
            ok: true,
            payload: {
                summary: {
                    capability_result: {
                        ability_id: input.abilityId,
                        layer: input.abilityLayer,
                        action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                        outcome: "partial",
                        data_ref: {
                            target_page: "creator_publish_tab",
                            discovery_action: "media_upload_path"
                        },
                        metrics: {
                            duration_ms: Math.max(0, env.now() - startedAt)
                        }
                    },
                    scope_context: gate.scope_context,
                    gate_input: {
                        run_id: auditRecord.run_id,
                        session_id: auditRecord.session_id,
                        profile: auditRecord.profile,
                        ...gate.gate_input
                    },
                    gate_outcome: gate.gate_outcome,
                    read_execution_policy: gate.read_execution_policy,
                    issue_action_matrix: gate.issue_action_matrix,
                    write_interaction_tier: gate.write_interaction_tier,
                    write_action_matrix_decisions: gate.write_action_matrix_decisions,
                    consumer_gate_result: gate.consumer_gate_result,
                    request_admission_result: gate.request_admission_result,
                    execution_audit: gate.execution_audit,
                    approval_record: gate.approval_record,
                    risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                    audit_record: auditRecord,
                    ...layer2InteractionSummary(layer2Interaction),
                    media_upload_discovery: mediaUploadDiscovery,
                    upload_path_catalog: mediaUploadDiscovery.upload_path_catalog,
                    controlled_upload_evidence: mediaUploadDiscovery.controlled_upload_evidence,
                    controlled_upload_evaluation: mediaUploadDiscovery.controlled_upload_evaluation
                },
                observability: createObservability({
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId: `req-${env.randomId()}`,
                    outcome: "completed",
                    includeKeyRequest: false
                })
            }
        };
    }
    if (gate.consumer_gate_result.effective_execution_mode === "dry_run" ||
        gate.consumer_gate_result.effective_execution_mode === "recon") {
        return withLayer2InteractionInSuccessPayload(createGateOnlySuccess(input, gate, auditRecord, env), layer2Interaction);
    }
    if (input.options.issue_scope === "issue_835" &&
        input.options.controlled_live_write === true &&
        input.options.target_page === "creator_publish_tab" &&
        gate.consumer_gate_result.effective_execution_mode === "live_write") {
        const publishVisibilityScope = input.options.publish_visibility_scope === "private_or_self_visible" ||
            input.options.publish_visibility_scope === "limited_test_visibility" ||
            input.options.publish_visibility_scope === "public_visible"
            ? input.options.publish_visibility_scope
            : null;
        const cleanupPolicyRef = typeof input.options.cleanup_policy_ref === "string" &&
            input.options.cleanup_policy_ref.trim().length > 0
            ? input.options.cleanup_policy_ref.trim()
            : null;
        const liveWriteAttemptId = typeof input.params.live_write_attempt_id === "string" &&
            input.params.live_write_attempt_id.trim().length > 0
            ? input.params.live_write_attempt_id.trim()
            : `fr0032-attempt-${input.executionContext.runId}`;
        const sourceMediaRef = typeof input.params.source_media_ref === "string" ? input.params.source_media_ref : "";
        const sourceMediaDigest = typeof input.params.source_media_digest === "string" ? input.params.source_media_digest : "";
        const sourceMediaKind = input.params.source_media_kind === "video" || input.params.source_media_kind === "mixed"
            ? input.params.source_media_kind
            : "image";
        if (!publishVisibilityScope || !cleanupPolicyRef) {
            return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "FR-0032 controlled live write policy missing", {
                ability_id: input.abilityId,
                stage: "execution",
                reason: "FR0032_LIVE_WRITE_POLICY_MISSING"
            }, createObservability({
                href: env.getLocationHref(),
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "failed",
                failureReason: "FR0032_LIVE_WRITE_POLICY_MISSING",
                failureSite: {
                    stage: "execution",
                    component: "policy",
                    target: "publish_visibility_scope.cleanup_policy_ref",
                    summary: "FR-0032 publish visibility scope and cleanup policy are required"
                }
            }), createDiagnosis({
                reason: "FR0032_LIVE_WRITE_POLICY_MISSING",
                summary: "publish visibility scope and cleanup policy are required before live write",
                category: "request_failed"
            }), gate, auditRecord), gate.execution_audit);
        }
        const controlledLiveWriteInput = {
            live_write_attempt_id: liveWriteAttemptId,
            source_media_ref: sourceMediaRef,
            source_media_digest: sourceMediaDigest,
            source_media_kind: sourceMediaKind,
            publish_visibility_scope: publishVisibilityScope,
            cleanup_policy_ref: cleanupPolicyRef,
            run_id: input.executionContext.runId,
            profile_ref: input.options.__runtime_profile_ref ?? null,
            target_tab_id: gate.consumer_gate_result.target_tab_id,
            page_url: env.getLocationHref(),
            latest_head_sha: typeof input.options.__runtime_latest_head_sha === "string"
                ? input.options.__runtime_latest_head_sha
                : null,
            accepted_upload_artifact_identity: typeof input.params.accepted_upload_artifact_identity === "object" &&
                input.params.accepted_upload_artifact_identity !== null &&
                !Array.isArray(input.params.accepted_upload_artifact_identity)
                ? input.params.accepted_upload_artifact_identity
                : null,
            background_upload_capture_continuation: input.params.background_upload_capture_continuation === true
        };
        const controlledLiveWriteResult = env.performControlledLiveWrite
            ? await env.performControlledLiveWrite(controlledLiveWriteInput)
            : buildXhsControlledLiveWriteUnavailableResult(controlledLiveWriteInput);
        const liveWriteEvaluation = asRecord(controlledLiveWriteResult.live_write_evaluation);
        const fullLiveWriteSuccess = liveWriteEvaluation?.full_live_write_success === true;
        const outcome = fullLiveWriteSuccess ? "success" : "partial";
        return {
            ok: true,
            payload: {
                summary: {
                    capability_result: {
                        ability_id: input.abilityId,
                        layer: input.abilityLayer,
                        action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                        outcome,
                        data_ref: {
                            target_page: "creator_publish_tab",
                            live_write_attempt_id: liveWriteAttemptId
                        },
                        metrics: {
                            duration_ms: Math.max(0, env.now() - startedAt)
                        }
                    },
                    scope_context: gate.scope_context,
                    gate_input: {
                        run_id: auditRecord.run_id,
                        session_id: auditRecord.session_id,
                        profile: auditRecord.profile,
                        ...gate.gate_input
                    },
                    gate_outcome: gate.gate_outcome,
                    read_execution_policy: gate.read_execution_policy,
                    issue_action_matrix: gate.issue_action_matrix,
                    write_interaction_tier: gate.write_interaction_tier,
                    write_action_matrix_decisions: gate.write_action_matrix_decisions,
                    consumer_gate_result: gate.consumer_gate_result,
                    request_admission_result: gate.request_admission_result,
                    execution_audit: gate.execution_audit,
                    approval_record: gate.approval_record,
                    risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                    audit_record: auditRecord,
                    ...layer2InteractionSummary(layer2Interaction),
                    controlled_live_write: controlledLiveWriteResult,
                    live_write_evidence: controlledLiveWriteResult.live_write_evidence,
                    live_write_evaluation: controlledLiveWriteResult.live_write_evaluation
                },
                observability: createObservability({
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId: `req-${env.randomId()}`,
                    outcome: fullLiveWriteSuccess ? "completed" : "failed",
                    failureReason: fullLiveWriteSuccess ? undefined : "FR0032_CONTROLLED_LIVE_WRITE_INCOMPLETE",
                    includeKeyRequest: false
                })
            }
        };
    }
    if (input.options.validation_action === "editor_input" &&
        input.options.issue_scope === "issue_208" &&
        input.options.action_type === "write" &&
        input.options.requested_execution_mode === "live_write") {
        const validationText = typeof input.options.validation_text === "string" && input.options.validation_text.trim().length > 0
            ? input.options.validation_text.trim()
            : "WebEnvoy editor_input validation";
        const focusAttestation = input.options.editor_focus_attestation ?? null;
        let validationResult;
        if (env.performEditorInputValidation) {
            try {
                validationResult = await env.performEditorInputValidation({
                    text: validationText,
                    focusAttestation: focusAttestation
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "editor_input 真实验证失败", {
                    ability_id: input.abilityId,
                    stage: "execution",
                    reason: "EDITOR_INPUT_VALIDATION_FAILED",
                    validation_exception: message
                }, createObservability({
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId: `req-${env.randomId()}`,
                    outcome: "failed",
                    failureReason: message,
                    failureSite: {
                        stage: "execution",
                        component: "page",
                        target: "editor_input",
                        summary: message || "editor_input validation failed"
                    }
                }), createDiagnosis({
                    reason: "EDITOR_INPUT_VALIDATION_FAILED",
                    summary: message || "editor_input validation failed",
                    category: "page_changed"
                }), gate, auditRecord), gate.execution_audit);
            }
        }
        else {
            validationResult = {
                ok: false,
                mode: "dom_editor_input_validation",
                attestation: "dom_self_certified",
                editor_locator: null,
                input_text: validationText,
                before_text: "",
                visible_text: "",
                post_blur_text: "",
                focus_confirmed: false,
                focus_attestation_source: null,
                focus_attestation_reason: null,
                preserved_after_blur: false,
                success_signals: [],
                failure_signals: ["missing_focus_attestation", "dom_variant"],
                minimum_replay: ["enter_editable_mode", "focus_editor", "type_short_text", "blur_or_reobserve"]
            };
        }
        if (!isTrustedEditorInputValidation(validationResult)) {
            return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "editor_input 真实验证失败", {
                ability_id: input.abilityId,
                stage: "execution",
                reason: "EDITOR_INPUT_VALIDATION_FAILED",
                ...buildEditorInputEvidence(validationResult)
            }, createObservability({
                href: env.getLocationHref(),
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "failed",
                failureReason: "EDITOR_INPUT_VALIDATION_FAILED",
                failureSite: {
                    stage: "execution",
                    component: "page",
                    target: validationResult.editor_locator ?? "editor_input",
                    summary: validationResult.failure_signals[0] ?? "editor_input validation failed"
                }
            }), createDiagnosis({
                reason: "EDITOR_INPUT_VALIDATION_FAILED",
                summary: validationResult.failure_signals[0] ?? "editor_input validation failed",
                category: "page_changed"
            }), gate, auditRecord), gate.execution_audit);
        }
        const editorInputEvidence = buildEditorInputEvidence(validationResult);
        const editorTextWriteResult = input.options.editor_text_write === true
            ? {
                ...editorInputEvidence,
                write_action: "editor_text_write",
                submitted: false,
                published: false
            }
            : null;
        return {
            ok: true,
            payload: {
                summary: {
                    capability_result: {
                        ability_id: input.abilityId,
                        layer: input.abilityLayer,
                        action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                        outcome: "success",
                        data_ref: {
                            validation_action: "editor_input"
                        },
                        metrics: {
                            duration_ms: Math.max(0, env.now() - startedAt)
                        }
                    },
                    scope_context: gate.scope_context,
                    gate_input: {
                        run_id: auditRecord.run_id,
                        session_id: auditRecord.session_id,
                        profile: auditRecord.profile,
                        ...gate.gate_input
                    },
                    gate_outcome: gate.gate_outcome,
                    read_execution_policy: gate.read_execution_policy,
                    issue_action_matrix: gate.issue_action_matrix,
                    write_interaction_tier: gate.write_interaction_tier,
                    write_action_matrix_decisions: gate.write_action_matrix_decisions,
                    consumer_gate_result: gate.consumer_gate_result,
                    request_admission_result: gate.request_admission_result,
                    execution_audit: gate.execution_audit,
                    approval_record: gate.approval_record,
                    risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                    audit_record: auditRecord,
                    ...layer2InteractionSummary(layer2Interaction),
                    interaction_result: editorInputEvidence,
                    ...(editorTextWriteResult ? { text_write_result: editorTextWriteResult } : {})
                },
                observability: createObservability({
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId: `req-${env.randomId()}`,
                    outcome: "completed"
                })
            }
        };
    }
    const simulated = resolveSimulatedResult(input.options.simulate_result, input.params, input.options, env);
    if (simulated && !simulated.ok) {
        return {
            ...simulated,
            payload: {
                ...simulated.payload,
                details: {
                    ability_id: input.abilityId,
                    ...(asRecord(simulated.payload.details) ?? {})
                },
                read_execution_policy: gate.read_execution_policy,
                issue_action_matrix: gate.issue_action_matrix,
                consumer_gate_result: gate.consumer_gate_result,
                request_admission_result: gate.request_admission_result,
                execution_audit: gate.execution_audit,
                approval_record: gate.approval_record,
                audit_record: auditRecord
            }
        };
    }
    const accountSafetySurface = classifyXhsAccountSafetySurface({
        href: env.getLocationHref(),
        title: env.getDocumentTitle(),
        bodyText: env.getBodyText?.(),
        overlay: env.getAccountSafetyOverlay?.()
    });
    if (accountSafetySurface) {
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", accountSafetySurface.message, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: accountSafetySurface.reason,
            page_url: env.getLocationHref()
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: accountSafetySurface.reason,
            includeKeyRequest: false,
            failureSite: {
                stage: "action",
                component: "page",
                target: "xhs.account_safety_surface",
                summary: accountSafetySurface.message
            }
        }), createDiagnosis({
            reason: accountSafetySurface.reason,
            summary: accountSafetySurface.message,
            category: "page_changed"
        }), gate, auditRecord), gate.execution_audit);
    }
    if (!containsCookie(env.getCookie(), "a1")) {
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "登录态缺失，无法执行 xhs.search", {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "SESSION_EXPIRED"
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "SESSION_EXPIRED"
        }), createDiagnosis({
            reason: "SESSION_EXPIRED",
            summary: "登录态缺失，无法执行 xhs.search"
        }), gate, auditRecord), gate.execution_audit);
    }
    const providerAwareReadPathBlock = isProviderAwareLiveReadGate(gate)
        ? resolveProviderAwareReadPathBlock(input.options, input.executionContext.runId)
        : null;
    if (providerAwareReadPathBlock) {
        const summary = "provider-aware read path readiness denied xhs.search execution";
        return withLayer2InteractionInPayload(withProviderAwareReadPathBlockPayload(withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", summary, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: providerAwareReadPathBlock.reason,
            blocking_reasons: providerAwareReadPathBlock.reasons
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: providerAwareReadPathBlock.reason,
            includeKeyRequest: false,
            failureSite: {
                stage: "execution",
                component: "gate",
                target: "provider_aware_read_path",
                summary
            }
        }), createDiagnosis({
            reason: providerAwareReadPathBlock.reason,
            summary,
            category: "page_changed",
            evidence: providerAwareReadPathBlock.reasons
        }), gate, auditRecord), gate.execution_audit), gate, auditRecord, providerAwareReadPathBlock), layer2Interaction);
    }
    if (simulated) {
        const summary = asRecord(simulated.payload.summary) ?? {};
        const capability = asRecord(summary.capability_result) ?? {};
        capability.ability_id = input.abilityId;
        capability.layer = input.abilityLayer;
        capability.action = gate.consumer_gate_result.action_type ?? input.abilityAction;
        return {
            ok: true,
            payload: {
                ...simulated.payload,
                summary: {
                    capability_result: capability,
                    scope_context: gate.scope_context,
                    gate_input: {
                        run_id: auditRecord.run_id,
                        session_id: auditRecord.session_id,
                        profile: auditRecord.profile,
                        ...gate.gate_input
                    },
                    gate_outcome: gate.gate_outcome,
                    read_execution_policy: gate.read_execution_policy,
                    issue_action_matrix: gate.issue_action_matrix,
                    consumer_gate_result: gate.consumer_gate_result,
                    request_admission_result: gate.request_admission_result,
                    execution_audit: gate.execution_audit,
                    approval_record: gate.approval_record,
                    risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                    audit_record: auditRecord,
                    ...layer2InteractionSummary(layer2Interaction)
                }
            }
        };
    }
    const buildExpectedRequestContextProvenance = () => ({
        profile_ref: input.executionContext.profile,
        session_id: input.executionContext.sessionId,
        target_tab_id: typeof gate.consumer_gate_result.target_tab_id === "number"
            ? gate.consumer_gate_result.target_tab_id
            : null,
        run_id: input.executionContext.runId,
        action_ref: input.abilityAction,
        page_url: env.getLocationHref()
    });
    const createProvenanceUnconfirmedFailure = () => {
        const expectedProvenance = buildExpectedRequestContextProvenance();
        const summary = "当前页面现场的搜索请求来源未完成 provenance 绑定";
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", summary, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "REQUEST_CONTEXT_MISSING",
            request_context_reason: "provenance_unconfirmed",
            page_context_namespace: createPageContextNamespace(env.getLocationHref()),
            profile_ref: expectedProvenance.profile_ref,
            session_id: expectedProvenance.session_id,
            target_tab_id: expectedProvenance.target_tab_id,
            run_id: expectedProvenance.run_id,
            action_ref: expectedProvenance.action_ref,
            page_url: expectedProvenance.page_url
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "REQUEST_CONTEXT_MISSING",
            includeKeyRequest: false,
            failureSite: {
                stage: "action",
                component: "page",
                target: "captured_request_context",
                summary
            }
        }), createDiagnosis({
            reason: "REQUEST_CONTEXT_MISSING",
            summary,
            category: "page_changed"
        }), gate, auditRecord), gate.execution_audit);
    };
    const confirmCurrentRequestContextProvenance = async () => {
        if (typeof env.configureCapturedRequestContextProvenance !== "function") {
            return true;
        }
        const expectedProvenance = buildExpectedRequestContextProvenance();
        const result = await env.configureCapturedRequestContextProvenance({
            page_context_namespace: createPageContextNamespace(env.getLocationHref()),
            ...expectedProvenance,
            ...(input.options.closeout_evidence_evaluation === true ||
                input.options.closeout_audit_required === true
                ? { bind_fresh_window_ms: CLOSEOUT_PROVENANCE_BIND_FRESH_WINDOW_MS }
                : {})
        }).catch(() => null);
        const record = asRecord(result);
        return (record?.configured === true &&
            record.profile_ref === expectedProvenance.profile_ref &&
            record.session_id === expectedProvenance.session_id &&
            (expectedProvenance.target_tab_id === null ||
                record.target_tab_id === expectedProvenance.target_tab_id) &&
            record.run_id === expectedProvenance.run_id &&
            record.action_ref === expectedProvenance.action_ref &&
            record.page_url === expectedProvenance.page_url);
    };
    if (input.options.__request_context_provenance_confirmed === false) {
        return createProvenanceUnconfirmedFailure();
    }
    const payload = {
        keyword: input.params.query,
        page: input.params.page ?? 1,
        page_size: input.params.limit ?? 20,
        search_id: input.params.search_id ?? env.randomId(),
        sort: input.params.sort ?? "general",
        note_type: input.params.note_type ?? 0
    };
    if (input.options.__request_context_provenance_confirmed !== true &&
        !(await confirmCurrentRequestContextProvenance())) {
        return createProvenanceUnconfirmedFailure();
    }
    const closeoutPassiveExactHitOnly = input.options.closeout_evidence_evaluation === true ||
        input.options.closeout_audit_required === true;
    let passiveActionStartedAt = null;
    let passiveActionEvidence = null;
    let requestContextState;
    const closeoutRequestContextHits = [];
    const updateLayer2InteractionFromPassiveAction = () => {
        const actionKind = asString(passiveActionEvidence?.action_kind);
        const passiveActionError = asString(passiveActionEvidence?.error);
        const nextLayer2Interaction = buildXhsSearchLayer2InteractionEvidence({
            writeInteractionTierName: gate.write_action_matrix_decisions?.write_interaction_tier ?? null,
            requestedExecutionMode: input.options.requested_execution_mode,
            recoveryProbe: false,
            humanizedActionKind: actionKind,
            settledWaitResult: passiveActionError ? "timeout" : "settled",
            executionApplied: passiveActionEvidence !== null
        });
        if (nextLayer2Interaction) {
            layer2Interaction = nextLayer2Interaction;
        }
    };
    const rememberCloseoutRequestContextHit = (state) => {
        if (state.status !== "hit") {
            return;
        }
        const key = [
            state.pageContextNamespace,
            state.shapeKey,
            String(state.template.capturedAt)
        ].join("\n");
        if (closeoutRequestContextHits.some((candidate) => [
            candidate.pageContextNamespace,
            candidate.shapeKey,
            String(candidate.template.capturedAt)
        ].join("\n") === key)) {
            return;
        }
        closeoutRequestContextHits.push(state);
    };
    const runCloseoutPassiveRound = async () => {
        passiveActionStartedAt = env.now();
        passiveActionEvidence = await performSearchPassiveAction(input, env);
        updateLayer2InteractionFromPassiveAction();
        if (!(await confirmCurrentRequestContextProvenance())) {
            return {
                status: "miss",
                failureReason: "template_missing",
                pageContextNamespace: createPageContextNamespace(env.getLocationHref()),
                shapeKey: "",
                availableShapeKeys: [],
                diagnostics: {
                    provenance_reconfirm_failed: true
                }
            };
        }
        const state = await resolveRequestContextState({
            params: input.params,
            options: input.options,
            minObservedAt: passiveActionStartedAt,
            elapsedBeforeWaitMs: env.now() - executionStartedAt,
            expectedProvenance: buildExpectedRequestContextProvenance()
        }, env);
        const resolvedState = state.status !== "hit"
            ? resolveDebuggerNetworkRequestContextState({
                passiveActionEvidence: passiveActionEvidence
                    ? passiveActionEvidence
                    : null,
                query: input.params.query,
                pageContextNamespace: state.pageContextNamespace,
                shapeKey: state.shapeKey,
                now: env.now(),
                pageUrl: env.getLocationHref()
            }) ?? state
            : state;
        rememberCloseoutRequestContextHit(resolvedState);
        return resolvedState;
    };
    if (closeoutPassiveExactHitOnly) {
        requestContextState = await resolveRequestContextState({
            params: input.params,
            options: input.options,
            minObservedAt: null,
            elapsedBeforeWaitMs: env.now() - executionStartedAt,
            expectedProvenance: buildExpectedRequestContextProvenance(),
            failFastOnMiss: true
        }, env);
        if (requestContextState.status === "hit") {
            rememberCloseoutRequestContextHit(requestContextState);
            passiveActionEvidence = {
                evidence_class: "humanized_action",
                action_kind: "existing_passive_exact_hit",
                action_ref: input.executionContext.gateInvocationId ?? input.executionContext.runId,
                run_id: input.executionContext.runId,
                page_url: env.getLocationHref(),
                query: input.params.query,
                skipped_reason: "closeout_passive_exact_hit_already_available",
                trigger_surface: "xhs.search_result"
            };
        }
        const nextContextState = await runCloseoutPassiveRound();
        if (nextContextState.status === "hit" || requestContextState.status !== "hit") {
            requestContextState = nextContextState;
        }
        if (closeoutRequestContextHits.length === 1 && requestContextState.status === "hit") {
            const retryContextState = await runCloseoutPassiveRound();
            if (retryContextState.status === "hit" || requestContextState.status !== "hit") {
                requestContextState = retryContextState;
            }
        }
    }
    else {
        passiveActionStartedAt = env.now();
        passiveActionEvidence = await performSearchPassiveAction(input, env);
        updateLayer2InteractionFromPassiveAction();
        if (!(await confirmCurrentRequestContextProvenance())) {
            return createProvenanceUnconfirmedFailure();
        }
        requestContextState = await resolveRequestContextState({
            params: input.params,
            options: input.options,
            minObservedAt: passiveActionEvidence ? passiveActionStartedAt : null,
            elapsedBeforeWaitMs: env.now() - executionStartedAt,
            expectedProvenance: buildExpectedRequestContextProvenance()
        }, env);
    }
    if (requestContextState.status !== "hit") {
        requestContextState =
            resolveDebuggerNetworkRequestContextState({
                passiveActionEvidence: passiveActionEvidence ? passiveActionEvidence : null,
                query: input.params.query,
                pageContextNamespace: requestContextState.pageContextNamespace,
                shapeKey: requestContextState.shapeKey,
                now: env.now(),
                pageUrl: env.getLocationHref()
            }) ?? requestContextState;
    }
    if (requestContextState.status !== "hit") {
        const backendRejectedReason = requestContextState.detailReason &&
            BACKEND_REJECTED_SOURCE_REASONS.has(requestContextState.detailReason)
            ? requestContextState.detailReason
            : null;
        const reason = backendRejectedReason ??
            (requestContextState.failureReason === "shape_mismatch" ||
                requestContextState.failureReason === "rejected_source"
                ? "REQUEST_CONTEXT_INCOMPATIBLE"
                : "REQUEST_CONTEXT_MISSING");
        const summaryMap = {
            template_missing: "当前页面现场缺少可复用的搜索请求模板",
            template_stale: "当前页面现场的搜索请求模板已过期",
            shape_mismatch: "当前页面现场存在不同 shape 的搜索请求模板",
            rejected_source: "当前页面现场的搜索请求来源已被拒绝"
        };
        const summary = requestContextState.detailMessage ?? summaryMap[requestContextState.failureReason];
        const isBackendRejectedSource = backendRejectedReason !== null;
        if (requestContextState.failureReason === "rejected_source") {
            return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", summary, {
                ability_id: input.abilityId,
                stage: "execution",
                reason,
                request_context_reason: requestContextState.failureReason,
                page_context_namespace: requestContextState.pageContextNamespace,
                shape_key: requestContextState.shapeKey,
                available_shape_keys: requestContextState.availableShapeKeys,
                ...(requestContextState.diagnostics
                    ? { request_context_diagnostics: requestContextState.diagnostics }
                    : {}),
                ...(requestContextState.statusCode !== undefined
                    ? { status_code: requestContextState.statusCode }
                    : {}),
                ...(requestContextState.platformCode !== undefined
                    ? { platform_code: requestContextState.platformCode }
                    : {}),
                ...(backendRejectedReason ? { rejected_source_reason: backendRejectedReason } : {}),
                ...(requestContextState.observedAt !== undefined
                    ? { observed_at: requestContextState.observedAt }
                    : {})
            }, createObservability({
                href: env.getLocationHref(),
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "failed",
                ...(requestContextState.statusCode !== undefined
                    ? { statusCode: requestContextState.statusCode }
                    : {}),
                failureReason: reason,
                includeKeyRequest: false,
                failureSite: {
                    stage: "action",
                    component: "page",
                    target: isBackendRejectedSource ? SEARCH_ENDPOINT : "captured_request_context",
                    summary
                }
            }), createDiagnosis({
                reason,
                summary,
                category: isBackendRejectedSource ? "request_failed" : "page_changed"
            }), gate, auditRecord), gate.execution_audit);
        }
        if (!closeoutPassiveExactHitOnly) {
            const domExtraction = isCurrentSearchPageForQuery(env.getLocationHref(), input.params.query)
                ? await resolveSearchDomExtraction(env)
                : null;
            if (domExtraction) {
                const count = domExtraction.cards.length;
                const extractedAt = toIsoString(env.now());
                const targetTabId = gate.consumer_gate_result.target_tab_id;
                const actionRef = input.executionContext.gateInvocationId ?? input.executionContext.runId;
                const domPageStateFallbackEvidence = buildSearchDomPageStateFallbackEvidence({
                    extraction: domExtraction,
                    fallbackReason: requestContextState.failureReason,
                    pageUrl: env.getLocationHref(),
                    runId: input.executionContext.runId,
                    profileRef: input.executionContext.profile,
                    sessionId: input.executionContext.sessionId,
                    targetTabId,
                    actionRef,
                    query: input.params.query,
                    extractedAt
                });
                return {
                    ok: true,
                    payload: {
                        summary: {
                            capability_result: {
                                ability_id: input.abilityId,
                                layer: input.abilityLayer,
                                action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                                outcome: "success",
                                data_ref: {
                                    query: input.params.query
                                },
                                metrics: {
                                    count,
                                    duration_ms: Math.max(0, env.now() - startedAt)
                                }
                            },
                            scope_context: gate.scope_context,
                            gate_input: {
                                run_id: auditRecord.run_id,
                                session_id: auditRecord.session_id,
                                profile: auditRecord.profile,
                                ...gate.gate_input
                            },
                            gate_outcome: gate.gate_outcome,
                            read_execution_policy: gate.read_execution_policy,
                            issue_action_matrix: gate.issue_action_matrix,
                            consumer_gate_result: gate.consumer_gate_result,
                            request_admission_result: gate.request_admission_result,
                            execution_audit: gate.execution_audit,
                            approval_record: gate.approval_record,
                            risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                            audit_record: auditRecord,
                            ...buildProviderAwareReadPathSummaryFields(input.options),
                            ...layer2InteractionSummary(layer2Interaction),
                            dom_page_state_fallback_evidence: domPageStateFallbackEvidence,
                            route_evidence: {
                                ...domPageStateFallbackEvidence,
                                evidence_class: "dom_state_extraction",
                                profile_ref: input.executionContext.profile,
                                target_tab_id: targetTabId,
                                page_url: env.getLocationHref(),
                                run_id: input.executionContext.runId,
                                action_ref: actionRef,
                                extraction_layer: domExtraction.extraction_layer,
                                extraction_locator: domExtraction.extraction_locator,
                                extracted_at: extractedAt,
                                target_continuity: buildSearchTargetContinuity(domExtraction.cards),
                                risk_surface_classification: "none",
                                ...(passiveActionEvidence ? { humanized_action: passiveActionEvidence } : {}),
                                item_kind: "search_card",
                                cards: domExtraction.cards
                            },
                            request_context: {
                                status: "missing",
                                reason: requestContextState.failureReason,
                                page_context_namespace: requestContextState.pageContextNamespace,
                                shape_key: requestContextState.shapeKey,
                                available_shape_keys: requestContextState.availableShapeKeys,
                                ...(requestContextState.diagnostics
                                    ? { diagnostics: requestContextState.diagnostics }
                                    : {})
                            }
                        },
                        observability: createObservability({
                            href: env.getLocationHref(),
                            title: env.getDocumentTitle(),
                            readyState: env.getReadyState(),
                            requestId: `req-${env.randomId()}`,
                            outcome: "completed",
                            includeKeyRequest: false
                        })
                    }
                };
            }
        }
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", summary, {
            ability_id: input.abilityId,
            stage: "execution",
            reason,
            request_context_reason: requestContextState.failureReason,
            page_context_namespace: requestContextState.pageContextNamespace,
            shape_key: requestContextState.shapeKey,
            available_shape_keys: requestContextState.availableShapeKeys,
            ...(requestContextState.diagnostics
                ? { request_context_diagnostics: requestContextState.diagnostics }
                : {}),
            ...(requestContextState.detailReason
                ? { rejected_source_reason: requestContextState.detailReason }
                : {}),
            ...(typeof requestContextState.statusCode === "number"
                ? { status_code: requestContextState.statusCode }
                : {}),
            ...(typeof requestContextState.platformCode === "number"
                ? { platform_code: requestContextState.platformCode }
                : {}),
            ...(typeof requestContextState.observedAt === "number"
                ? { request_context_observed_at: requestContextState.observedAt }
                : {}),
            ...(passiveActionEvidence ? { humanized_action: passiveActionEvidence } : {})
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: reason,
            includeKeyRequest: isBackendRejectedSource,
            statusCode: requestContextState.statusCode,
            failureSite: {
                stage: isBackendRejectedSource ? "request" : "action",
                component: isBackendRejectedSource ? "network" : "page",
                target: isBackendRejectedSource ? SEARCH_ENDPOINT : "captured_request_context",
                summary
            }
        }), createDiagnosis({
            reason,
            summary,
            category: isBackendRejectedSource ? "request_failed" : "page_changed",
            evidence: [
                ...describePassiveActionEvidenceForDiagnosis(passiveActionEvidence ? passiveActionEvidence : null),
                `request_context_reason=${requestContextState.failureReason}`,
                `request_context_available_shape_key_count=${requestContextState.availableShapeKeys.length}`,
                `request_context_available_shape_keys=${requestContextState.availableShapeKeys.join("|")}`,
                `request_context_shape_key=${requestContextState.shapeKey}`
            ]
        }), gate, auditRecord), gate.execution_audit);
    }
    const headers = {
        ...requestContextState.template.request.headers
    };
    const capturedRequestBody = asRecord(requestContextState.template.request.body);
    if (!capturedRequestBody) {
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "当前页面现场缺少可复用的搜索请求模板", {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "REQUEST_CONTEXT_MISSING",
            request_context_reason: "template_missing",
            page_context_namespace: requestContextState.pageContextNamespace,
            shape_key: requestContextState.shapeKey,
            available_shape_keys: []
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "REQUEST_CONTEXT_MISSING",
            includeKeyRequest: false,
            failureSite: {
                stage: "action",
                component: "page",
                target: "captured_request_context",
                summary: "当前页面现场缺少可复用的搜索请求模板"
            }
        }), createDiagnosis({
            reason: "REQUEST_CONTEXT_MISSING",
            summary: "当前页面现场缺少可复用的搜索请求模板"
        }), gate, auditRecord), gate.execution_audit);
    }
    const passiveCards = collectSearchDomCards(requestContextState.template.response.body);
    const passiveTargetContinuity = passiveCards.length > 0
        ? buildSearchTargetContinuity(passiveCards)
        : [
            {
                target_url: env.getLocationHref(),
                xsec_token: null,
                xsec_source: null,
                token_presence: "missing",
                source_route: "xhs.search"
            }
        ];
    const count = parseCount(requestContextState.template.response.body);
    const pageUrl = env.getLocationHref();
    const capturedAt = requestContextState.template.capturedAt;
    const targetTabId = typeof input.options.actual_target_tab_id === "number"
        ? input.options.actual_target_tab_id
        : typeof input.options.target_tab_id === "number"
            ? input.options.target_tab_id
            : gate.consumer_gate_result.target_tab_id;
    const closeoutRoundHits = closeoutPassiveExactHitOnly && closeoutRequestContextHits.length > 0
        ? closeoutRequestContextHits
        : [requestContextState];
    const reproducedMultiRound = closeoutRoundHits.length >= 2;
    const routeEvidence = {
        route: "xhs.search.api",
        route_role: "primary",
        path_kind: "api",
        evidence_status: "success",
        evidence_class: "passive_api_capture",
        route_evidence_class: "passive_api_capture",
        source_kind: "page_request",
        method: "POST",
        endpoint: SEARCH_ENDPOINT,
        request_url: requestContextState.template.request.url,
        status_code: 200,
        head_sha: asString(input.options.__runtime_latest_head_sha),
        run_id: input.executionContext.runId,
        artifact_identity: buildSearchPassiveApiCaptureArtifactIdentity({
            runId: input.executionContext.runId,
            pageContextNamespace: requestContextState.pageContextNamespace,
            shapeKey: requestContextState.shapeKey,
            capturedAt
        }),
        profile_ref: input.executionContext.profile,
        session_id: input.executionContext.sessionId,
        target_tab_id: targetTabId,
        page_url: pageUrl,
        action_ref: input.abilityAction,
        observed_at: capturedAt,
        captured_at: capturedAt,
        reproduced_multi_round: reproducedMultiRound,
        page_context_namespace: requestContextState.pageContextNamespace,
        shape_key: requestContextState.shapeKey,
        ...(passiveActionEvidence ? { humanized_action: passiveActionEvidence } : {}),
        target_continuity: passiveTargetContinuity,
        ...(passiveCards.length > 0
            ? {
                item_kind: "search_card",
                cards: passiveCards
            }
            : {})
    };
    const buildCloseoutEvidenceRound = (state) => {
        const roundCapturedAt = state.template.capturedAt;
        return {
            route: routeEvidence.route,
            route_role: routeEvidence.route_role,
            path_kind: routeEvidence.path_kind,
            evidence_status: routeEvidence.evidence_status,
            evidence_class: routeEvidence.evidence_class,
            route_evidence_class: routeEvidence.route_evidence_class,
            source_kind: routeEvidence.source_kind,
            method: routeEvidence.method,
            endpoint: routeEvidence.endpoint,
            request_url: state.template.request.url,
            status_code: routeEvidence.status_code,
            latest_head_sha: routeEvidence.head_sha,
            head_sha: routeEvidence.head_sha,
            run_id: routeEvidence.run_id,
            artifact_identity: buildSearchPassiveApiCaptureArtifactIdentity({
                runId: input.executionContext.runId,
                pageContextNamespace: state.pageContextNamespace,
                shapeKey: state.shapeKey,
                capturedAt: roundCapturedAt
            }),
            profile_ref: routeEvidence.profile_ref,
            session_id: routeEvidence.session_id,
            target_tab_id: routeEvidence.target_tab_id,
            page_url: routeEvidence.page_url,
            action_ref: routeEvidence.action_ref,
            observed_at: roundCapturedAt,
            captured_at: roundCapturedAt,
            reproduced_multi_round: reproducedMultiRound
        };
    };
    const closeoutEvidenceRounds = closeoutRoundHits.map(buildCloseoutEvidenceRound);
    const closeoutArtifactIdentities = closeoutEvidenceRounds
        .map((round) => asString(round.artifact_identity))
        .filter((value) => value !== null);
    const closeoutEvidenceExpected = {
        latest_head_sha: routeEvidence.head_sha,
        run_id: routeEvidence.run_id,
        artifact_identity: routeEvidence.artifact_identity,
        artifact_identities: closeoutArtifactIdentities,
        profile_ref: routeEvidence.profile_ref,
        target_tab_id: routeEvidence.target_tab_id,
        page_url: routeEvidence.page_url,
        action_ref: routeEvidence.action_ref
    };
    return {
        ok: true,
        payload: {
            summary: {
                capability_result: {
                    ability_id: input.abilityId,
                    layer: input.abilityLayer,
                    action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                    outcome: "success",
                    data_ref: {
                        query: input.params.query,
                        search_id: typeof capturedRequestBody.search_id === "string"
                            ? capturedRequestBody.search_id
                            : payload.search_id
                    },
                    metrics: {
                        count,
                        duration_ms: Math.max(0, env.now() - startedAt)
                    }
                },
                scope_context: gate.scope_context,
                gate_input: {
                    run_id: auditRecord.run_id,
                    session_id: auditRecord.session_id,
                    profile: auditRecord.profile,
                    ...gate.gate_input
                },
                gate_outcome: gate.gate_outcome,
                read_execution_policy: gate.read_execution_policy,
                issue_action_matrix: gate.issue_action_matrix,
                consumer_gate_result: gate.consumer_gate_result,
                request_admission_result: gate.request_admission_result,
                execution_audit: gate.execution_audit,
                approval_record: gate.approval_record,
                risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                audit_record: auditRecord,
                ...buildProviderAwareReadPathSummaryFields(input.options),
                ...layer2InteractionSummary(layer2Interaction),
                ...withPassiveApiCaptureEvidenceDiagnostic(routeEvidence),
                route_evidence: routeEvidence,
                closeout_route_evidence: routeEvidence,
                closeout_evidence_expected: closeoutEvidenceExpected,
                closeout_evidence_rounds: closeoutEvidenceRounds,
                request_context: {
                    status: "exact_hit",
                    page_context_namespace: requestContextState.pageContextNamespace,
                    shape_key: requestContextState.shapeKey,
                    captured_at: capturedAt
                }
            },
            observability: createObservability({
                href: pageUrl,
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "completed",
                statusCode: 200
            })
        }
    };
};
