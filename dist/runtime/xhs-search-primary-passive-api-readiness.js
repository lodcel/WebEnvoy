const asObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asString = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};
const asInteger = (value) => typeof value === "number" && Number.isInteger(value) ? value : null;
const normalizeProfileRef = (value) => {
    const profileRef = asString(value);
    if (profileRef === null) {
        return null;
    }
    return profileRef.startsWith("profile/") ? profileRef : `profile/${profileRef}`;
};
const pushUniqueBlocker = (blockers, blocker_code, blocker_layer, message) => {
    if (blockers.some((blocker) => blocker.blocker_code === blocker_code)) {
        return;
    }
    blockers.push({ blocker_code, blocker_layer, message });
};
const sameString = (left, right) => asString(left) === asString(right);
const sameProfile = (left, right) => normalizeProfileRef(left) !== null && normalizeProfileRef(left) === normalizeProfileRef(right);
const sameInteger = (left, right) => {
    const normalizedLeft = asInteger(left);
    const normalizedRight = asInteger(right);
    return normalizedLeft !== null && normalizedRight !== null && normalizedLeft === normalizedRight;
};
const resolveObservedRiskSurface = (summary, routeEvidence, requestContext) => asString(routeEvidence?.risk_surface_classification) ??
    asString(requestContext?.risk_surface_classification) ??
    asString(asObject(summary?.account_safety)?.reason) ??
    asString(asObject(summary?.runtime_stop)?.reason);
export const evaluateXhsSearchPrimaryPassiveApiReadinessForContract = (input) => {
    const summary = asObject(input.summary);
    const routeEvidence = asObject(summary?.route_evidence);
    const requestContext = asObject(summary?.request_context);
    const activeApiFetchFallback = asObject(summary?.active_api_fetch_fallback);
    const expected = input.expected;
    const blockers = [];
    const riskSurface = resolveObservedRiskSurface(summary, routeEvidence, requestContext);
    if (routeEvidence === null) {
        pushUniqueBlocker(blockers, "missing_route_evidence", "route", "xhs.search primary passive readiness requires route_evidence");
    }
    else {
        if (asString(routeEvidence.route_role) !== "primary") {
            pushUniqueBlocker(blockers, "non_primary_route", "route", "xhs.search route_evidence must describe the primary route");
        }
        if (asString(routeEvidence.path_kind) !== "api") {
            pushUniqueBlocker(blockers, "non_api_path", "route", "xhs.search route_evidence must be an API path");
        }
        if (asString(routeEvidence.evidence_status) !== "success") {
            pushUniqueBlocker(blockers, "evidence_not_success", "route", "xhs.search route_evidence must be successful");
        }
        if (asString(routeEvidence.evidence_class ?? routeEvidence.route_evidence_class) !==
            "passive_api_capture") {
            pushUniqueBlocker(blockers, "unsupported_evidence_class", "route", "xhs.search primary route must remain passive_api_capture");
        }
    }
    if (requestContext === null) {
        pushUniqueBlocker(blockers, "missing_request_context", "request_context", "xhs.search passive readiness requires canonical request_context");
    }
    else if (asString(requestContext.status) !== "exact_hit") {
        pushUniqueBlocker(blockers, "request_context_not_exact_hit", "request_context", "xhs.search request_context.status must be exact_hit");
    }
    if (activeApiFetchFallback !== null) {
        pushUniqueBlocker(blockers, "active_fetch_fallback_declared", "fallback", "xhs.search passive readiness must not declare active_api_fetch_fallback");
    }
    if (riskSurface !== null) {
        pushUniqueBlocker(blockers, "risk_surface_detected", "risk_surface", `xhs.search readiness is blocked by risk surface ${riskSurface}`);
    }
    const observedProfileRef = normalizeProfileRef(routeEvidence?.profile_ref) ?? normalizeProfileRef(requestContext?.profile_ref);
    const observedTargetTabId = asInteger(routeEvidence?.target_tab_id) ?? asInteger(requestContext?.target_tab_id);
    const observedPageUrl = asString(routeEvidence?.page_url) ?? asString(requestContext?.page_url);
    const observedRunId = asString(routeEvidence?.run_id) ?? asString(requestContext?.run_id);
    const observedActionRef = asString(routeEvidence?.action_ref) ?? asString(requestContext?.action_ref);
    const observedQuery = asString(requestContext?.query);
    if (!sameProfile(expected.profile_ref, observedProfileRef)) {
        pushUniqueBlocker(blockers, "missing_profile_binding", "binding", "xhs.search readiness evidence must bind the current profile_ref");
    }
    if (!sameInteger(expected.target_tab_id, observedTargetTabId)) {
        pushUniqueBlocker(blockers, "missing_tab_binding", "binding", "xhs.search readiness evidence must bind the current target_tab_id");
    }
    if (!sameString(expected.run_id, observedRunId)) {
        pushUniqueBlocker(blockers, "missing_run_binding", "binding", "xhs.search readiness evidence must bind the current run_id");
    }
    if (!sameString(expected.page_url, observedPageUrl)) {
        pushUniqueBlocker(blockers, "missing_page_binding", "binding", "xhs.search readiness evidence must bind the current page_url");
    }
    if (observedActionRef === null) {
        pushUniqueBlocker(blockers, "missing_action_binding", "binding", "xhs.search readiness evidence must bind the current action_ref");
    }
    else if (!sameString(expected.action_ref, observedActionRef)) {
        pushUniqueBlocker(blockers, "action_mismatch", "binding", "xhs.search readiness action_ref must match the current search action");
    }
    if (!sameString(expected.query, observedQuery)) {
        pushUniqueBlocker(blockers, "query_mismatch", "binding", "xhs.search request_context.query must match the current search query");
    }
    return {
        decision: blockers.length === 0 ? "PASS" : "FAIL",
        passed: blockers.length === 0,
        blockers,
        observed: {
            route_present: routeEvidence !== null,
            request_context_present: requestContext !== null,
            request_context_status: asString(requestContext?.status),
            route_evidence_class: asString(routeEvidence?.evidence_class ?? routeEvidence?.route_evidence_class),
            query: observedQuery,
            profile_ref: observedProfileRef,
            target_tab_id: observedTargetTabId,
            page_url: observedPageUrl,
            run_id: observedRunId,
            action_ref: observedActionRef,
            risk_surface: riskSurface,
            active_api_fetch_fallback_present: activeApiFetchFallback !== null
        }
    };
};
