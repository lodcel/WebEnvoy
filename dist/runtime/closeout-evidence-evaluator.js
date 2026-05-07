import { verifyCloseoutMultiRoundEvidence } from "./closeout-multi-round-verifier.js";
const normalizeString = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};
const matchesExpectedString = (expected, observed) => {
    const normalizedExpected = normalizeString(expected);
    const normalizedObserved = normalizeString(observed);
    return normalizedExpected !== null && normalizedObserved !== null && normalizedExpected === normalizedObserved;
};
const matchesExpectedInteger = (expected, observed) => Number.isInteger(expected) && Number.isInteger(observed) && expected === observed;
const blocker = (blocker_code, blocker_layer, message) => ({
    blocker_code,
    blocker_layer,
    message
});
const pushUniqueBlocker = (blockers, nextBlocker) => {
    if (blockers.some((existingBlocker) => existingBlocker.blocker_code === nextBlocker.blocker_code)) {
        return;
    }
    blockers.push(nextBlocker);
};
export const evaluateCloseoutEvidence = (input) => {
    const expectedLatestHeadSha = normalizeString(input.expected.latest_head_sha);
    const observedHeadSha = normalizeString(input.evidence.head_sha);
    const expectedRunId = normalizeString(input.expected.run_id);
    const observedRunId = normalizeString(input.evidence.run_id);
    const expectedArtifactIdentity = normalizeString(input.expected.artifact_identity);
    const observedArtifactIdentity = normalizeString(input.evidence.artifact_identity);
    const expectedProfileRef = normalizeString(input.expected.profile_ref);
    const observedProfileRef = normalizeString(input.evidence.profile_ref);
    const expectedPageUrl = normalizeString(input.expected.page_url);
    const observedPageUrl = normalizeString(input.evidence.page_url);
    const expectedActionRef = normalizeString(input.expected.action_ref);
    const observedActionRef = normalizeString(input.evidence.action_ref);
    const routeRole = normalizeString(input.evidence.route_role);
    const pathKind = normalizeString(input.evidence.path_kind);
    const evidenceStatus = normalizeString(input.evidence.evidence_status);
    const evidenceClass = normalizeString(input.evidence.evidence_class);
    const latestHeadAvailable = expectedLatestHeadSha !== null && observedHeadSha !== null;
    const latestHeadMatches = latestHeadAvailable && expectedLatestHeadSha === observedHeadSha;
    const runMatches = matchesExpectedString(expectedRunId, observedRunId);
    const artifactMatches = matchesExpectedString(expectedArtifactIdentity, observedArtifactIdentity);
    const profileBound = matchesExpectedString(expectedProfileRef, observedProfileRef);
    const tabBound = matchesExpectedInteger(input.expected.target_tab_id, input.evidence.target_tab_id);
    const pageBound = matchesExpectedString(expectedPageUrl, observedPageUrl);
    const actionBound = matchesExpectedString(expectedActionRef, observedActionRef);
    const multiRoundVerification = verifyCloseoutMultiRoundEvidence({
        expected: input.expected,
        evidence_rounds: input.evidence_rounds ?? [input.evidence]
    });
    const blockers = multiRoundVerification.blockers.map((multiRoundBlocker) => blocker(multiRoundBlocker.blocker_code, multiRoundBlocker.blocker_layer, multiRoundBlocker.message));
    if (routeRole !== "primary") {
        pushUniqueBlocker(blockers, blocker("non_primary_route", "route", "closeout evidence must come from the primary route"));
    }
    if (pathKind !== "api") {
        pushUniqueBlocker(blockers, blocker("non_api_path", "route", "closeout evidence must come from an API path"));
    }
    if (evidenceStatus !== "success") {
        pushUniqueBlocker(blockers, blocker("evidence_not_success", "route", "closeout evidence must report a success status"));
    }
    if (evidenceClass === "dom_state_extraction") {
        pushUniqueBlocker(blockers, blocker("dom_state_not_full_closeout", "route", "DOM or page-state extraction cannot satisfy the full closeout bar"));
    }
    if (evidenceClass === "active_api_fetch_fallback") {
        pushUniqueBlocker(blockers, blocker("active_fetch_not_admitted", "route", "active API fetch fallback is not admitted as primary closeout evidence"));
    }
    else if (evidenceClass !== "passive_api_capture" &&
        evidenceClass !== "humanized_action" &&
        evidenceClass !== "dom_state_extraction") {
        pushUniqueBlocker(blockers, blocker("unsupported_evidence_class", "route", "closeout evidence must use an admitted evidence_class"));
    }
    if (!latestHeadAvailable) {
        pushUniqueBlocker(blockers, blocker("missing_latest_head", "freshness", "latest-head closeout evidence requires both the expected and observed head sha"));
    }
    else if (!latestHeadMatches) {
        pushUniqueBlocker(blockers, blocker("stale_head", "freshness", "closeout evidence must be bound to the current latest head"));
    }
    if (!runMatches) {
        pushUniqueBlocker(blockers, blocker("stale_run", "freshness", "closeout evidence must be bound to the current run"));
    }
    if (!artifactMatches) {
        pushUniqueBlocker(blockers, blocker("stale_artifact", "freshness", "closeout evidence must be bound to the current artifact identity"));
    }
    if (!profileBound) {
        pushUniqueBlocker(blockers, blocker("missing_profile_binding", "binding", "closeout evidence must be bound to the expected profile"));
    }
    if (!tabBound) {
        pushUniqueBlocker(blockers, blocker("missing_tab_binding", "binding", "closeout evidence must be bound to the expected tab"));
    }
    if (!pageBound) {
        pushUniqueBlocker(blockers, blocker("missing_page_binding", "binding", "closeout evidence must be bound to the expected page URL"));
    }
    if (!actionBound) {
        pushUniqueBlocker(blockers, blocker("missing_action_binding", "binding", "closeout evidence must be bound to the expected action reference"));
    }
    const passed = blockers.length === 0;
    return {
        decision: passed ? "PASS" : "FAIL",
        passed,
        blockers,
        evaluated_route: [
            routeRole ?? "unknown_route",
            pathKind ?? "unknown_path",
            evidenceClass ?? "unknown_class",
            evidenceStatus ?? "unknown_status"
        ].join(":"),
        route_role: routeRole,
        path_kind: pathKind,
        evidence_status: evidenceStatus,
        evidence_class: evidenceClass,
        reproduced_multi_round: multiRoundVerification.reproduced_multi_round,
        freshness: {
            latest_head_available: latestHeadAvailable,
            latest_head_matches: latestHeadMatches,
            run_matches: runMatches,
            artifact_matches: artifactMatches,
            expected_latest_head_sha: expectedLatestHeadSha,
            observed_head_sha: observedHeadSha,
            expected_run_id: expectedRunId,
            observed_run_id: observedRunId,
            expected_artifact_identity: expectedArtifactIdentity,
            observed_artifact_identity: observedArtifactIdentity
        },
        bindings: {
            profile_bound: profileBound,
            tab_bound: tabBound,
            page_bound: pageBound,
            action_bound: actionBound,
            expected_profile_ref: expectedProfileRef,
            observed_profile_ref: observedProfileRef,
            expected_target_tab_id: input.expected.target_tab_id,
            observed_target_tab_id: input.evidence.target_tab_id,
            expected_page_url: expectedPageUrl,
            observed_page_url: observedPageUrl,
            expected_action_ref: expectedActionRef,
            observed_action_ref: observedActionRef
        },
        multi_round: {
            accepted_round_count: multiRoundVerification.accepted_round_count,
            unique_artifact_count: multiRoundVerification.unique_artifact_count,
            expected_artifact_observed: multiRoundVerification.expected_artifact_observed
        }
    };
};
