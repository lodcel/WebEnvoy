import type { JsonObject } from "../core/types.js";

export type XhsDetailSignedContinuityReadinessDecision = "PASS" | "FAIL";

export type XhsDetailSignedContinuityReadinessBlockerCode =
  | "missing_contract_payload"
  | "missing_success_summary"
  | "missing_success_signed_continuity"
  | "invalid_success_route_evidence"
  | "invalid_success_consumed_template"
  | "invalid_success_source_route"
  | "invalid_success_xsec_source"
  | "invalid_success_token_presence"
  | "missing_success_xsec_token"
  | "invalid_success_detail_url"
  | "missing_failure_details"
  | "missing_failure_request_context_result"
  | "signed_reason_misclassified"
  | "request_context_reason_misclassified"
  | "missing_failure_signed_continuity";

export type XhsDetailSignedContinuityReadinessBlockerLayer =
  | "success_summary"
  | "failure_details"
  | "classification";

export interface EvaluateXhsDetailSignedContinuityReadinessInput {
  expected: {
    note_id: unknown;
    source_route?: unknown;
    xsec_source?: unknown;
  };
  success?: {
    summary?: unknown;
  } | null;
  failure?: {
    error?: {
      details?: unknown;
    } | null;
    details?: unknown;
    payload?: unknown;
  } | null;
}

export interface XhsDetailSignedContinuityReadinessEvaluation {
  decision: XhsDetailSignedContinuityReadinessDecision;
  passed: boolean;
  blockers: Array<{
    blocker_code: XhsDetailSignedContinuityReadinessBlockerCode;
    blocker_layer: XhsDetailSignedContinuityReadinessBlockerLayer;
    message: string;
    path: string;
  }>;
  observed: {
    outcome: "success" | "signed_continuity_invalid" | "request_context_missing" | "unknown";
    details_path: "error.details" | "details" | "payload.details" | null;
    request_context_result: string | null;
    reason: string | null;
    source_route: string | null;
    xsec_source: string | null;
    token_presence: string | null;
    detail_url: string | null;
    route_evidence_class: string | null;
    consumed_template_route_evidence_class: string | null;
  };
}

const SIGNED_CONTINUITY_REASONS = new Set([
  "XSEC_TOKEN_MISSING",
  "XSEC_TOKEN_EMPTY",
  "XSEC_TOKEN_STALE",
  "XSEC_SOURCE_MISMATCH",
  "SECURITY_REDIRECT"
]);

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

const blocker = (
  blockerCode: XhsDetailSignedContinuityReadinessBlockerCode,
  blockerLayer: XhsDetailSignedContinuityReadinessBlockerLayer,
  path: string,
  message: string
): XhsDetailSignedContinuityReadinessEvaluation["blockers"][number] => ({
  blocker_code: blockerCode,
  blocker_layer: blockerLayer,
  path,
  message
});

const resolveFailureDetails = (input: {
  error?: { details?: unknown } | null;
  details?: unknown;
  payload?: unknown;
}): { path: "error.details" | "details" | "payload.details" | null; value: JsonObject | null } => {
  const errorDetails = asObject(asObject(input.error)?.details);
  if (errorDetails !== null) {
    return { path: "error.details", value: errorDetails };
  }
  const details = asObject(input.details);
  if (details !== null) {
    return { path: "details", value: details };
  }
  const payloadDetails = asObject(asObject(input.payload)?.details);
  if (payloadDetails !== null) {
    return { path: "payload.details", value: payloadDetails };
  }
  return { path: null, value: null };
};

const isExpectedDetailUrl = (value: unknown, noteId: string | null): boolean => {
  const detailUrl = asString(value);
  if (detailUrl === null || noteId === null) {
    return false;
  }
  try {
    const url = new URL(detailUrl, "https://www.xiaohongshu.com");
    return (
      url.hostname === "www.xiaohongshu.com" &&
      (url.pathname === `/explore/${noteId}` || url.pathname === `/discovery/item/${noteId}`)
    );
  } catch {
    return false;
  }
};

export const evaluateXhsDetailSignedContinuityReadinessForContract = (
  input: EvaluateXhsDetailSignedContinuityReadinessInput
): XhsDetailSignedContinuityReadinessEvaluation => {
  const blockers: XhsDetailSignedContinuityReadinessEvaluation["blockers"] = [];
  const expectedSourceRoute = asString(input.expected.source_route) ?? "xhs.search";
  const expectedXsecSource = asString(input.expected.xsec_source) ?? "pc_search";
  const expectedNoteId = asString(input.expected.note_id);
  const successSummary = asObject(input.success?.summary);
  const failureDetails = input.failure ? resolveFailureDetails(input.failure) : { path: null, value: null };

  const signedContinuity =
    asObject(successSummary?.signed_continuity) ??
    asObject(failureDetails.value?.signed_continuity);
  const routeEvidence = asObject(successSummary?.route_evidence);
  const consumedTemplate = asObject(routeEvidence?.consumed_template);
  const requestContextResult = asString(failureDetails.value?.request_context_result);
  const reason = asString(failureDetails.value?.reason);
  const sourceRoute = asString(signedContinuity?.source_route);
  const xsecSource = asString(signedContinuity?.xsec_source);
  const tokenPresence = asString(signedContinuity?.token_presence);
  const detailUrl =
    asString(signedContinuity?.detail_url) ?? asString(signedContinuity?.target_url);

  if (successSummary === null && failureDetails.value === null) {
    blockers.push(
      blocker(
        "missing_contract_payload",
        "classification",
        "input",
        "detail signed-continuity readiness requires either a success summary or failure details"
      )
    );
  }

  if (successSummary !== null) {
    if (signedContinuity === null) {
      blockers.push(
        blocker(
          "missing_success_signed_continuity",
          "success_summary",
          "success.summary.signed_continuity",
          "detail success summary must expose canonical signed_continuity"
        )
      );
    }
    if (asString(routeEvidence?.route_evidence_class) !== "active_api_fetch_fallback") {
      blockers.push(
        blocker(
          "invalid_success_route_evidence",
          "success_summary",
          "success.summary.route_evidence.route_evidence_class",
          "detail success summary must describe the admitted active_api_fetch_fallback route"
        )
      );
    }
    if (asString(routeEvidence?.gate_decision) !== "allowed") {
      blockers.push(
        blocker(
          "invalid_success_route_evidence",
          "success_summary",
          "success.summary.route_evidence.gate_decision",
          "detail success summary must show the active fallback gate as allowed"
        )
      );
    }
    if (asString(consumedTemplate?.route_evidence_class) !== "passive_api_capture") {
      blockers.push(
        blocker(
          "invalid_success_consumed_template",
          "success_summary",
          "success.summary.route_evidence.consumed_template.route_evidence_class",
          "detail success summary must prove it consumed a passive_api_capture template"
        )
      );
    }
    if (sourceRoute !== expectedSourceRoute) {
      blockers.push(
        blocker(
          "invalid_success_source_route",
          "success_summary",
          "success.summary.signed_continuity.source_route",
          "detail success summary must only consume xhs.search signed continuity"
        )
      );
    }
    if (xsecSource !== expectedXsecSource) {
      blockers.push(
        blocker(
          "invalid_success_xsec_source",
          "success_summary",
          "success.summary.signed_continuity.xsec_source",
          "detail success summary must only consume pc_search continuity"
        )
      );
    }
    if (tokenPresence !== "present") {
      blockers.push(
        blocker(
          "invalid_success_token_presence",
          "success_summary",
          "success.summary.signed_continuity.token_presence",
          "detail success summary must carry a present xsec token"
        )
      );
    }
    if (asString(signedContinuity?.xsec_token) === null) {
      blockers.push(
        blocker(
          "missing_success_xsec_token",
          "success_summary",
          "success.summary.signed_continuity.xsec_token",
          "detail success summary must keep a non-empty xsec token"
        )
      );
    }
    if (!isExpectedDetailUrl(detailUrl, expectedNoteId)) {
      blockers.push(
        blocker(
          "invalid_success_detail_url",
          "success_summary",
          "success.summary.signed_continuity.detail_url",
          "detail success summary must retain the signed detail URL for the requested note_id"
        )
      );
    }
  }

  if (input.failure) {
    if (failureDetails.value === null || failureDetails.path === null) {
      blockers.push(
        blocker(
          "missing_failure_details",
          "failure_details",
          "failure",
          "detail signed-continuity failures must expose canonical details"
        )
      );
    } else if (requestContextResult === null) {
      blockers.push(
        blocker(
          "missing_failure_request_context_result",
          "failure_details",
          `${failureDetails.path}.request_context_result`,
          "detail failure details must declare request_context_result"
        )
      );
    } else if (requestContextResult === "signed_continuity_invalid") {
      if (!SIGNED_CONTINUITY_REASONS.has(reason ?? "")) {
        blockers.push(
          blocker(
            "signed_reason_misclassified",
            "classification",
            `${failureDetails.path}.reason`,
            "signed_continuity_invalid must map to a signed continuity failure reason"
          )
        );
      }
      if (signedContinuity === null) {
        blockers.push(
          blocker(
            "missing_failure_signed_continuity",
            "failure_details",
            `${failureDetails.path}.signed_continuity`,
            "signed continuity failures must expose the canonical signed_continuity payload"
          )
        );
      }
    } else if (requestContextResult === "request_context_missing") {
      if (SIGNED_CONTINUITY_REASONS.has(reason ?? "")) {
        blockers.push(
          blocker(
            "request_context_reason_misclassified",
            "classification",
            `${failureDetails.path}.reason`,
            "request_context_missing must not reuse signed continuity failure reasons"
          )
        );
      }
    }
  }

  return {
    decision: blockers.length === 0 ? "PASS" : "FAIL",
    passed: blockers.length === 0,
    blockers,
    observed: {
      outcome:
        successSummary !== null
          ? "success"
          : requestContextResult === "signed_continuity_invalid"
            ? "signed_continuity_invalid"
            : requestContextResult === "request_context_missing"
              ? "request_context_missing"
              : "unknown",
      details_path: failureDetails.path,
      request_context_result: requestContextResult,
      reason,
      source_route: sourceRoute,
      xsec_source: xsecSource,
      token_presence: tokenPresence,
      detail_url: detailUrl,
      route_evidence_class: asString(routeEvidence?.route_evidence_class),
      consumed_template_route_evidence_class: asString(consumedTemplate?.route_evidence_class)
    }
  };
};
