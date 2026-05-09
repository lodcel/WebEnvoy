import type { JsonObject } from "../core/types.js";

export type XhsSearchPrimaryPassiveApiReadinessDecision = "PASS" | "FAIL";

export type XhsSearchPrimaryPassiveApiReadinessBlockerCode =
  | "missing_route_evidence"
  | "missing_route_id"
  | "non_search_route"
  | "non_primary_route"
  | "non_api_path"
  | "evidence_not_success"
  | "unsupported_evidence_class"
  | "missing_request_context"
  | "request_context_not_exact_hit"
  | "missing_profile_binding"
  | "missing_tab_binding"
  | "missing_run_binding"
  | "missing_page_binding"
  | "missing_action_binding"
  | "query_mismatch"
  | "action_mismatch"
  | "risk_surface_detected"
  | "active_fetch_fallback_declared";

export type XhsSearchPrimaryPassiveApiReadinessBlockerLayer =
  | "route"
  | "request_context"
  | "binding"
  | "risk_surface"
  | "fallback";

export interface EvaluateXhsSearchPrimaryPassiveApiReadinessInput {
  summary: unknown;
  expected: {
    query: unknown;
    profile_ref: unknown;
    target_tab_id: unknown;
    page_url: unknown;
    run_id: unknown;
    action_ref: unknown;
  };
}

export interface XhsSearchPrimaryPassiveApiReadinessEvaluation {
  decision: XhsSearchPrimaryPassiveApiReadinessDecision;
  passed: boolean;
  blockers: Array<{
    blocker_code: XhsSearchPrimaryPassiveApiReadinessBlockerCode;
    blocker_layer: XhsSearchPrimaryPassiveApiReadinessBlockerLayer;
    message: string;
  }>;
  observed: {
    route_present: boolean;
    request_context_present: boolean;
    request_context_status: string | null;
    route_evidence_class: string | null;
    query: string | null;
    profile_ref: string | null;
    target_tab_id: number | null;
    page_url: string | null;
    run_id: string | null;
    action_ref: string | null;
    risk_surface: string | null;
    active_api_fetch_fallback_present: boolean;
  };
}

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

const normalizeProfileRef = (value: unknown): string | null => {
  const profileRef = asString(value);
  if (profileRef === null) {
    return null;
  }
  return profileRef.startsWith("profile/") ? profileRef : `profile/${profileRef}`;
};

const pushUniqueBlocker = (
  blockers: XhsSearchPrimaryPassiveApiReadinessEvaluation["blockers"],
  blocker_code: XhsSearchPrimaryPassiveApiReadinessBlockerCode,
  blocker_layer: XhsSearchPrimaryPassiveApiReadinessBlockerLayer,
  message: string
): void => {
  if (blockers.some((blocker) => blocker.blocker_code === blocker_code)) {
    return;
  }
  blockers.push({ blocker_code, blocker_layer, message });
};

const sameString = (left: unknown, right: unknown): boolean => asString(left) === asString(right);

const sameProfile = (left: unknown, right: unknown): boolean =>
  normalizeProfileRef(left) !== null && normalizeProfileRef(left) === normalizeProfileRef(right);

const sameInteger = (left: unknown, right: unknown): boolean => {
  const normalizedLeft = asInteger(left);
  const normalizedRight = asInteger(right);
  return normalizedLeft !== null && normalizedRight !== null && normalizedLeft === normalizedRight;
};

const XHS_HARD_STOP_RISK_SURFACES = new Set([
  "XHS_LOGIN_REQUIRED",
  "SESSION_EXPIRED",
  "CAPTCHA_REQUIRED",
  "XHS_ACCOUNT_RISK_PAGE",
  "ACCOUNT_ABNORMAL",
  "BROWSER_ENV_ABNORMAL",
  "SECURITY_REDIRECT",
  "XSEC_TOKEN_MISSING",
  "XSEC_TOKEN_EMPTY",
  "XSEC_TOKEN_STALE",
  "XSEC_SOURCE_MISMATCH"
]);

const normalizeHardStopRiskSurface = (value: unknown): string | null => {
  const riskSurface = asString(value);
  if (riskSurface === null || !XHS_HARD_STOP_RISK_SURFACES.has(riskSurface)) {
    return null;
  }
  return riskSurface;
};

const resolveObservedRiskSurface = (
  summary: JsonObject | null,
  routeEvidence: JsonObject | null,
  requestContext: JsonObject | null
): string | null =>
  normalizeHardStopRiskSurface(routeEvidence?.risk_surface_classification) ??
  normalizeHardStopRiskSurface(requestContext?.risk_surface_classification) ??
  normalizeHardStopRiskSurface(asObject(summary?.account_safety)?.reason) ??
  normalizeHardStopRiskSurface(asObject(summary?.runtime_stop)?.reason);

export const evaluateXhsSearchPrimaryPassiveApiReadinessForContract = (
  input: EvaluateXhsSearchPrimaryPassiveApiReadinessInput
): XhsSearchPrimaryPassiveApiReadinessEvaluation => {
  const summary = asObject(input.summary);
  const routeEvidence = asObject(summary?.route_evidence);
  const requestContext = asObject(summary?.request_context);
  const activeApiFetchFallback = asObject(summary?.active_api_fetch_fallback);
  const expected = input.expected;
  const blockers: XhsSearchPrimaryPassiveApiReadinessEvaluation["blockers"] = [];
  const riskSurface = resolveObservedRiskSurface(summary, routeEvidence, requestContext);

  if (routeEvidence === null) {
    pushUniqueBlocker(
      blockers,
      "missing_route_evidence",
      "route",
      "xhs.search primary passive readiness requires route_evidence"
    );
  } else {
    const routeId = asString(routeEvidence.route ?? routeEvidence.route_id);
    if (routeId === null) {
      pushUniqueBlocker(
        blockers,
        "missing_route_id",
        "route",
        "xhs.search readiness requires route_evidence.route or route_evidence.route_id"
      );
    } else if (routeId !== "xhs.search.api" && routeId !== "xhs.search") {
      pushUniqueBlocker(
        blockers,
        "non_search_route",
        "route",
        "xhs.search readiness only accepts the xhs.search passive API route"
      );
    }
    if (asString(routeEvidence.route_role) !== "primary") {
      pushUniqueBlocker(
        blockers,
        "non_primary_route",
        "route",
        "xhs.search route_evidence must describe the primary route"
      );
    }
    if (asString(routeEvidence.path_kind) !== "api") {
      pushUniqueBlocker(
        blockers,
        "non_api_path",
        "route",
        "xhs.search route_evidence must be an API path"
      );
    }
    if (asString(routeEvidence.evidence_status) !== "success") {
      pushUniqueBlocker(
        blockers,
        "evidence_not_success",
        "route",
        "xhs.search route_evidence must be successful"
      );
    }
    if (
      asString(routeEvidence.evidence_class ?? routeEvidence.route_evidence_class) !==
      "passive_api_capture"
    ) {
      pushUniqueBlocker(
        blockers,
        "unsupported_evidence_class",
        "route",
        "xhs.search primary route must remain passive_api_capture"
      );
    }
  }

  if (requestContext === null) {
    pushUniqueBlocker(
      blockers,
      "missing_request_context",
      "request_context",
      "xhs.search passive readiness requires canonical request_context"
    );
  } else if (asString(requestContext.status) !== "exact_hit") {
    pushUniqueBlocker(
      blockers,
      "request_context_not_exact_hit",
      "request_context",
      "xhs.search request_context.status must be exact_hit"
    );
  }

  if (activeApiFetchFallback !== null) {
    pushUniqueBlocker(
      blockers,
      "active_fetch_fallback_declared",
      "fallback",
      "xhs.search passive readiness must not declare active_api_fetch_fallback"
    );
  }

  if (riskSurface !== null) {
    pushUniqueBlocker(
      blockers,
      "risk_surface_detected",
      "risk_surface",
      `xhs.search readiness is blocked by risk surface ${riskSurface}`
    );
  }

  const routeProfileRef = normalizeProfileRef(routeEvidence?.profile_ref);
  const requestContextProfileRef = normalizeProfileRef(requestContext?.profile_ref);
  const routeTargetTabId = asInteger(routeEvidence?.target_tab_id);
  const requestContextTargetTabId = asInteger(requestContext?.target_tab_id);
  const routePageUrl = asString(routeEvidence?.page_url);
  const requestContextPageUrl = asString(requestContext?.page_url);
  const routeRunId = asString(routeEvidence?.run_id);
  const requestContextRunId = asString(requestContext?.run_id);
  const routeActionRef = asString(routeEvidence?.action_ref);
  const requestContextActionRef = asString(requestContext?.action_ref);
  const observedQuery = asString(requestContext?.query);
  const observedProfileRef = routeProfileRef ?? requestContextProfileRef;
  const observedTargetTabId = routeTargetTabId ?? requestContextTargetTabId;
  const observedPageUrl = routePageUrl ?? requestContextPageUrl;
  const observedRunId = routeRunId ?? requestContextRunId;
  const observedActionRef = routeActionRef ?? requestContextActionRef;

  if (
    (routeEvidence !== null && !sameProfile(expected.profile_ref, routeProfileRef)) ||
    (requestContext !== null && !sameProfile(expected.profile_ref, requestContextProfileRef))
  ) {
    pushUniqueBlocker(
      blockers,
      "missing_profile_binding",
      "binding",
      "xhs.search readiness evidence must bind the current profile_ref"
    );
  }
  if (
    (routeEvidence !== null && !sameInteger(expected.target_tab_id, routeTargetTabId)) ||
    (requestContext !== null && !sameInteger(expected.target_tab_id, requestContextTargetTabId))
  ) {
    pushUniqueBlocker(
      blockers,
      "missing_tab_binding",
      "binding",
      "xhs.search readiness evidence must bind the current target_tab_id"
    );
  }
  if (
    (routeEvidence !== null && !sameString(expected.run_id, routeRunId)) ||
    (requestContext !== null && !sameString(expected.run_id, requestContextRunId))
  ) {
    pushUniqueBlocker(
      blockers,
      "missing_run_binding",
      "binding",
      "xhs.search readiness evidence must bind the current run_id"
    );
  }
  if (
    (routeEvidence !== null && !sameString(expected.page_url, routePageUrl)) ||
    (requestContext !== null && !sameString(expected.page_url, requestContextPageUrl))
  ) {
    pushUniqueBlocker(
      blockers,
      "missing_page_binding",
      "binding",
      "xhs.search readiness evidence must bind the current page_url"
    );
  }
  if (routeEvidence !== null && routeActionRef === null) {
    pushUniqueBlocker(
      blockers,
      "missing_action_binding",
      "binding",
      "xhs.search readiness evidence must bind the current action_ref"
    );
  }
  if (requestContext !== null && requestContextActionRef === null) {
    pushUniqueBlocker(
      blockers,
      "missing_action_binding",
      "binding",
      "xhs.search readiness evidence must bind the current action_ref"
    );
  }
  if (
    (routeEvidence !== null && routeActionRef !== null && !sameString(expected.action_ref, routeActionRef)) ||
    (requestContext !== null &&
      requestContextActionRef !== null &&
      !sameString(expected.action_ref, requestContextActionRef))
  ) {
    pushUniqueBlocker(
      blockers,
      "action_mismatch",
      "binding",
      "xhs.search readiness action_ref must match the current search action"
    );
  }

  if (!sameString(expected.query, observedQuery)) {
    pushUniqueBlocker(
      blockers,
      "query_mismatch",
      "binding",
      "xhs.search request_context.query must match the current search query"
    );
  }

  return {
    decision: blockers.length === 0 ? "PASS" : "FAIL",
    passed: blockers.length === 0,
    blockers,
    observed: {
      route_present: routeEvidence !== null,
      request_context_present: requestContext !== null,
      request_context_status: asString(requestContext?.status),
      route_evidence_class: asString(
        routeEvidence?.evidence_class ?? routeEvidence?.route_evidence_class
      ),
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
