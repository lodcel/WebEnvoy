const SIGNED_CONTINUITY_FAILURE_REASONS = new Set([
    "XSEC_TOKEN_MISSING",
    "XSEC_TOKEN_EMPTY",
    "XSEC_TOKEN_STALE",
    "XSEC_SOURCE_MISMATCH",
    "SECURITY_REDIRECT"
]);
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
const pushUniqueBlocker = (blockers, blocker_code, blocker_layer, message) => {
    if (blockers.some((blocker) => blocker.blocker_code === blocker_code)) {
        return;
    }
    blockers.push({ blocker_code, blocker_layer, message });
};
const resolveMatchedUserId = (value) => {
    if (value === null) {
        return null;
    }
    try {
        const url = new URL(value);
        if (url.hostname !== "www.xiaohongshu.com") {
            return null;
        }
        const match = /^\/user\/profile\/([^/?#]+)/.exec(url.pathname);
        return match?.[1] ?? null;
    }
    catch {
        const match = /\/user\/profile\/([^/?#]+)/.exec(value);
        return match?.[1] ?? null;
    }
};
const validateSuccessSummary = (input) => {
    if (input.routeEvidence === null) {
        pushUniqueBlocker(input.blockers, "missing_route_evidence", "route_evidence", "xhs.user_home success readiness requires route_evidence");
    }
    else {
        const routeEvidenceClass = asString(input.routeEvidence.route_evidence_class ?? input.routeEvidence.evidence_class);
        if (routeEvidenceClass !== "active_api_fetch_fallback") {
            pushUniqueBlocker(input.blockers, "route_evidence_not_active_api_fetch_fallback", "route_evidence", "xhs.user_home success must be emitted through active_api_fetch_fallback");
        }
        const consumedTemplate = asObject(input.routeEvidence.consumed_template);
        if (consumedTemplate === null) {
            pushUniqueBlocker(input.blockers, "missing_consumed_template", "route_evidence", "xhs.user_home success must expose the consumed passive template");
        }
        else {
            const consumedTemplateClass = asString(consumedTemplate.route_evidence_class ?? consumedTemplate.evidence_class);
            if (consumedTemplateClass !== "passive_api_capture") {
                pushUniqueBlocker(input.blockers, "consumed_template_not_passive_api_capture", "route_evidence", "xhs.user_home success must consume a passive_api_capture template");
            }
        }
    }
    if (input.signedContinuity === null) {
        pushUniqueBlocker(input.blockers, "missing_signed_continuity", "signed_continuity", "xhs.user_home success must surface signed continuity evidence");
        return;
    }
    const tokenPresence = asString(input.signedContinuity.token_presence);
    const xsecToken = asString(input.signedContinuity.xsec_token);
    const sourceRoute = asString(input.signedContinuity.source_route);
    const xsecSource = asString(input.signedContinuity.xsec_source);
    const userHomeUrl = asString(input.signedContinuity.user_home_url ?? input.signedContinuity.target_url);
    const matchedUserId = resolveMatchedUserId(userHomeUrl);
    if (tokenPresence !== "present") {
        pushUniqueBlocker(input.blockers, "signed_continuity_token_presence_invalid", "signed_continuity", "xhs.user_home success requires token_presence=present");
    }
    if (xsecToken === null || xsecToken.length === 0) {
        pushUniqueBlocker(input.blockers, "signed_continuity_xsec_token_missing", "signed_continuity", "xhs.user_home success requires a non-empty xsec_token");
    }
    if (sourceRoute !== "xhs.search") {
        pushUniqueBlocker(input.blockers, "signed_continuity_source_route_mismatch", "signed_continuity", "xhs.user_home only accepts signed continuity sourced from xhs.search");
    }
    if (xsecSource !== "pc_search") {
        pushUniqueBlocker(input.blockers, "signed_continuity_xsec_source_mismatch", "signed_continuity", "xhs.user_home only accepts xsec_source=pc_search");
    }
    if (input.expectedUserId === null || matchedUserId !== input.expectedUserId) {
        pushUniqueBlocker(input.blockers, "signed_continuity_user_home_mismatch", "signed_continuity", "xhs.user_home success must target the expected user_home_url");
    }
};
export const evaluateXhsUserHomeSignedContinuityReadinessForContract = (input) => {
    const summary = asObject(input.summary);
    const details = asObject(summary?.details);
    const capabilityResult = asObject(summary?.capability_result);
    const routeEvidence = asObject(summary?.route_evidence);
    const signedContinuity = asObject(summary?.signed_continuity) ??
        asObject(routeEvidence?.signed_continuity) ??
        asObject(details?.signed_continuity);
    const outcome = asString(capabilityResult?.outcome);
    const requestContextResult = asString(details?.request_context_result);
    const failureReason = asString(details?.reason);
    const expectedUserId = asString(input.expected.user_id);
    const userHomeUrl = asString(signedContinuity?.user_home_url ?? signedContinuity?.target_url);
    const matchedUserId = resolveMatchedUserId(userHomeUrl);
    const blockers = [];
    if (outcome === "success") {
        validateSuccessSummary({
            blockers,
            routeEvidence,
            signedContinuity,
            expectedUserId
        });
    }
    else if (requestContextResult === "signed_continuity_invalid") {
        if (failureReason === null) {
            pushUniqueBlocker(blockers, "missing_failure_reason", "classification", "signed_continuity_invalid must expose a failure reason");
        }
        else if (!SIGNED_CONTINUITY_FAILURE_REASONS.has(failureReason)) {
            pushUniqueBlocker(blockers, "signed_failure_reason_invalid", "classification", "signed_continuity_invalid only accepts signed continuity failure reasons");
        }
    }
    else if (requestContextResult === "request_context_missing") {
        if (failureReason === null) {
            pushUniqueBlocker(blockers, "missing_failure_reason", "classification", "request_context_missing must expose a failure reason");
        }
        else if (SIGNED_CONTINUITY_FAILURE_REASONS.has(failureReason)) {
            pushUniqueBlocker(blockers, "request_context_missing_reused_signed_reason", "classification", "request_context_missing must not reuse signed continuity failure reasons");
        }
    }
    else {
        pushUniqueBlocker(blockers, summary === null ? "unsupported_result_shape" : "request_context_result_invalid", "summary", "summary must describe either a success outcome or a supported fail-closed request_context_result");
    }
    return {
        decision: blockers.length === 0 ? "PASS" : "FAIL",
        passed: blockers.length === 0,
        blockers,
        observed: {
            outcome,
            request_context_result: requestContextResult,
            failure_reason: failureReason,
            route_evidence_class: asString(routeEvidence?.route_evidence_class ?? routeEvidence?.evidence_class),
            consumed_template_route_evidence_class: asString(asObject(routeEvidence?.consumed_template)?.route_evidence_class ??
                asObject(routeEvidence?.consumed_template)?.evidence_class),
            source_route: asString(signedContinuity?.source_route),
            xsec_source: asString(signedContinuity?.xsec_source),
            token_presence: asString(signedContinuity?.token_presence),
            xsec_token_present: typeof signedContinuity?.xsec_token === "string" && signedContinuity.xsec_token.length > 0,
            user_home_url: userHomeUrl,
            matched_user_id: matchedUserId
        }
    };
};
