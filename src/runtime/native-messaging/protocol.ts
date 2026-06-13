import type { CommandEnvelopeV2, ErrorV2 } from "../../core/command-envelope-v2.js";
import type { ErrorCode } from "../../core/errors.js";
import type { JsonObject } from "../../core/types.js";
import type { Diagnosis } from "../diagnostics.js";
import type { FailureSite } from "../observability.js";
import type { ObservabilityPayload } from "../observability.js";

export const BRIDGE_PROTOCOL = "webenvoy.native-bridge.v1";
export const DEFAULT_TRANSPORT_TIMEOUT_MS = 30_000;

export type BridgeMethod = "bridge.open" | "bridge.forward" | "__ping__";

export interface BridgeRequestEnvelope {
  id: string;
  method: BridgeMethod;
  profile: string | null;
  params: Record<string, unknown>;
  timeout_ms?: number;
}

export interface BridgeResponseSuccessEnvelope {
  id: string;
  status: "success";
  summary: Record<string, unknown>;
  payload?: Record<string, unknown>;
  command_envelope_v2?: CommandEnvelopeV2;
  error: null;
}

export interface BridgeResponseErrorEnvelope {
  id: string;
  status: "error";
  summary: Record<string, unknown>;
  payload?: Record<string, unknown>;
  command_envelope_v2?: CommandEnvelopeV2;
  error: {
    code: string;
    message: string;
  };
}

export type BridgeResponseEnvelope =
  | BridgeResponseSuccessEnvelope
  | BridgeResponseErrorEnvelope;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isKnownMethod = (value: unknown): value is BridgeMethod =>
  value === "bridge.open" || value === "bridge.forward" || value === "__ping__";

const EMPTY_OBSERVABILITY: ObservabilityPayload = {
  coverage: "unavailable",
  request_evidence: "none",
  truncation: {
    truncated: false,
    fields: []
  },
  page_state: null,
  key_requests: [],
  failure_site: null
};

const isoNow = (): string => new Date().toISOString();

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const MAX_PARITY_VIEW_KEYS = 16;
const MAX_PARITY_STRING_LENGTH = 256;
const MAX_DIAGNOSIS_EVIDENCE_ITEMS = 4;
const MAX_DIAGNOSIS_EVIDENCE_SUMMARY_LENGTH = 256;
const MAX_OBSERVABILITY_REQUESTS = 10;
const MAX_OBSERVABILITY_TITLE_LENGTH = 120;
const MAX_OBSERVABILITY_FAILURE_SUMMARY_LENGTH = 160;
const MAX_OBSERVABILITY_REQUEST_REASON_LENGTH = 120;
const MAX_OBSERVABILITY_FAILURE_TARGET_LENGTH = 160;
const REDACTED = "[REDACTED]";

const resolveCommandRunId = (request: BridgeRequestEnvelope): string =>
  asString(request.params.run_id) ?? request.id;

const resolveCommandName = (request: BridgeRequestEnvelope): string =>
  asString(request.params.command) ?? "runtime.ping";

const CLI_ERROR_EXIT_CODE: Record<string, ErrorV2["exit_code"]> = {
  ERR_CLI_INVALID_ARGS: 2,
  ERR_CLI_UNKNOWN_COMMAND: 3,
  ERR_CLI_NOT_IMPLEMENTED: 4,
  ERR_PROVIDER_UNAVAILABLE: 5,
  ERR_RISK_GATE_DENIED: 7,
  ERR_CLOSEOUT_FAILED: 8,
  ERR_SCHEMA_EVIDENCE_FAILED: 9,
  ERR_RUNTIME_UNAVAILABLE: 5,
  ERR_RUNTIME_BOOTSTRAP_PENDING: 5,
  ERR_RUNTIME_BOOTSTRAP_TRANSPORT_NOT_CONNECTED: 5,
  ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED: 5,
  ERR_RUNTIME_BOOTSTRAP_ACK_TIMEOUT: 5,
  ERR_RUNTIME_BOOTSTRAP_ACK_STALE: 5,
  ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH: 5,
  ERR_RUNTIME_READY_SIGNAL_CONFLICT: 5,
  ERR_RUNTIME_IDENTITY_NOT_BOUND: 5,
  ERR_RUNTIME_IDENTITY_MISMATCH: 5,
  ERR_EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED: 5,
  ERR_EXECUTION_FAILED: 6,
  ERR_PROFILE_INVALID: 5,
  ERR_PROFILE_LOCKED: 5,
  ERR_PROFILE_OWNER_CONFLICT: 5,
  ERR_PROFILE_META_CORRUPT: 5,
  ERR_PROFILE_PROXY_CONFLICT: 5,
  ERR_BROWSER_LAUNCH_FAILED: 5,
  ERR_PROFILE_STATE_CONFLICT: 5
};

const isCliErrorCode = (value: string): boolean =>
  Object.prototype.hasOwnProperty.call(CLI_ERROR_EXIT_CODE, value);

const isNonRetryableIdentityErrorCode = (code: string): boolean =>
  code === "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH" ||
  code === "ERR_RUNTIME_IDENTITY_MISMATCH";

const isProviderUnavailableFamilyErrorCode = (code: string): boolean =>
  code === "ERR_PROVIDER_UNAVAILABLE" ||
  code === "ERR_RUNTIME_UNAVAILABLE" ||
  code === "ERR_RUNTIME_READY_SIGNAL_CONFLICT" ||
  code === "ERR_RUNTIME_IDENTITY_NOT_BOUND" ||
  code === "ERR_EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED" ||
  code === "ERR_BROWSER_LAUNCH_FAILED" ||
  code.startsWith("ERR_RUNTIME_BOOTSTRAP_");

const retryableForProfileErrorCode = (code: string): boolean =>
  code === "ERR_PROFILE_LOCKED";

const retryableForCliErrorCode = (code: string): boolean => {
  if (isNonRetryableIdentityErrorCode(code)) {
    return false;
  }

  if (isProviderUnavailableFamilyErrorCode(code)) {
    return true;
  }

  if (code.startsWith("ERR_PROFILE_")) {
    return retryableForProfileErrorCode(code);
  }

  return false;
};

const bridgeErrorToCliError = (
  error: BridgeResponseErrorEnvelope["error"]
): {
  code: ErrorCode;
  retryable: boolean;
  originalCode: string;
} => {
  if (isCliErrorCode(error.code)) {
    return {
      code: error.code as ErrorCode,
      retryable: retryableForCliErrorCode(error.code),
      originalCode: error.code
    };
  }

  return {
    code: "ERR_RUNTIME_UNAVAILABLE",
    retryable: error.code === "ERR_TRANSPORT_TIMEOUT",
    originalCode: error.code
  };
};

const bridgeErrorCategoryByDiagnosis: Record<Diagnosis["category"], ErrorV2["category"]> = {
  execution_interrupted: "runtime",
  page_changed: "page",
  request_failed: "request",
  runtime_unavailable: "runtime",
  unknown: "unknown"
};

const categoryForCliError = (
  code: ErrorCode,
  diagnosis: Diagnosis | null
): ErrorV2["category"] => {
  if (code === "ERR_PROVIDER_UNAVAILABLE") {
    return "environment";
  }
  if (code === "ERR_RISK_GATE_DENIED") {
    return "risk";
  }
  if (code === "ERR_CLOSEOUT_FAILED" || code === "ERR_SCHEMA_EVIDENCE_FAILED") {
    return "evidence";
  }
  if (code.startsWith("ERR_CLI_")) {
    return "cli";
  }
  if (code.startsWith("ERR_PROFILE_")) {
    return "account";
  }
  if (
    code.startsWith("ERR_RUNTIME_") ||
    code.startsWith("ERR_BROWSER_") ||
    code.startsWith("ERR_EXTENSION_")
  ) {
    return "runtime";
  }
  if (diagnosis) {
    return bridgeErrorCategoryByDiagnosis[diagnosis.category];
  }
  return "unknown";
};

const familyForCliError = (code: ErrorCode): ErrorV2["family"] => {
  if (
    code === "ERR_CLI_INVALID_ARGS" ||
    code === "ERR_CLI_UNKNOWN_COMMAND" ||
    code === "ERR_CLI_NOT_IMPLEMENTED"
  ) {
    return "validation";
  }
  if (code === "ERR_RISK_GATE_DENIED") {
    return "risk_gate_denied";
  }
  if (code === "ERR_CLOSEOUT_FAILED") {
    return "closeout_failure";
  }
  if (code === "ERR_SCHEMA_EVIDENCE_FAILED") {
    return "schema_evidence_failure";
  }
  if (code === "ERR_EXECUTION_FAILED") {
    return "runtime_failure";
  }
  return "provider_unavailable";
};

const boundedString = (value: string): string =>
  value.length > MAX_PARITY_STRING_LENGTH
    ? `${value.slice(0, MAX_PARITY_STRING_LENGTH)}...`
    : value;

const sanitizeFreeText = (value: string): string =>
  value
    .replace(/\bauthorization\s*:\s*[^\n\r]+/gi, `authorization: ${REDACTED}`)
    .replace(/\bcookie\s*:\s*[^\n\r]+/gi, `cookie: ${REDACTED}`)
    .replace(
      /([?&])(token|access_token|id_token|refresh_token|signature|sig|auth|code)=([^&#\s]+)/gi,
      (_match, prefix: string, key: string) => `${prefix}${key}=${REDACTED}`
    )
    .replace(
      /\b(token|access_token|id_token|refresh_token|signature|sig|auth|code)\s*=\s*([^&\s,;]+)/gi,
      (_match, key: string) => `${key}=${REDACTED}`
    )
    .replace(
      /\b(token|access_token|id_token|refresh_token|signature|sig|auth|code)\s*:\s*([^\s,;]+)/gi,
      (_match, key: string) => `${key}: ${REDACTED}`
    );

const truncateString = (
  value: string,
  maxLength: number
): {
  value: string;
  truncated: boolean;
} => {
  if (value.length <= maxLength) {
    return {
      value,
      truncated: false
    };
  }
  return {
    value: value.slice(0, maxLength),
    truncated: true
  };
};

const nonEmptyString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

const stripQueryAndFragment = (value: string): string => {
  const noFragment = value.split("#", 1)[0];
  return noFragment.split("?", 1)[0] ?? noFragment;
};

const sanitizeUrl = (value: unknown): string => {
  const normalized = nonEmptyString(value, "");
  if (normalized.length === 0) {
    return "";
  }

  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(normalized);
  if (!isAbsolute) {
    return stripQueryAndFragment(normalized);
  }

  try {
    const parsed = new URL(normalized);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return stripQueryAndFragment(normalized);
  }
};

const sanitizeFailureTarget = (value: unknown): string => {
  const normalized = nonEmptyString(value, "unknown");
  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(normalized);
  const isPathLike =
    normalized.startsWith("/") || normalized.startsWith("./") || normalized.startsWith("../");

  if (isAbsolute || isPathLike) {
    return sanitizeUrl(normalized) || "unknown";
  }
  if (normalized.includes("?")) {
    return normalized.split("?", 1)[0] ?? normalized;
  }
  return normalized;
};

type ObservabilityTruncationField = ObservabilityPayload["truncation"]["fields"][number];

const pushUniqueTruncationField = (
  fields: ObservabilityTruncationField[],
  field: ObservabilityTruncationField
): void => {
  if (!fields.includes(field)) {
    fields.push(field);
  }
};

const boundedDiagnosisEvidenceSummary = (
  value: string
): {
  value: string;
  redacted: boolean;
  truncated: boolean;
} => {
  const sanitized = sanitizeFreeText(value.trim());
  if (sanitized.length <= MAX_DIAGNOSIS_EVIDENCE_SUMMARY_LENGTH) {
    return {
      value: sanitized,
      redacted: sanitized !== value.trim(),
      truncated: false
    };
  }
  return {
    value: sanitized.slice(0, MAX_DIAGNOSIS_EVIDENCE_SUMMARY_LENGTH),
    redacted: sanitized !== value.trim(),
    truncated: true
  };
};

const boundedParityValue = (value: unknown): unknown => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return boundedString(value);
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      item_count: value.length
    };
  }

  const object = asObject(value);
  if (object) {
    const keys = Object.keys(object).sort();
    return {
      type: "object",
      key_count: keys.length,
      keys: keys.slice(0, MAX_PARITY_VIEW_KEYS),
      keys_truncated: keys.length > MAX_PARITY_VIEW_KEYS
    };
  }

  return String(value);
};

const boundedParityObject = (value: JsonObject): JsonObject => {
  const entries = Object.entries(value);
  const bounded: JsonObject = {};
  for (const [key, item] of entries.slice(0, MAX_PARITY_VIEW_KEYS)) {
    bounded[key] = boundedParityValue(item);
  }
  if (entries.length > MAX_PARITY_VIEW_KEYS) {
    bounded.parity_view_truncated = true;
    bounded.parity_view_original_key_count = entries.length;
  }
  return bounded;
};

const buildSuccessParityData = (response: BridgeResponseSuccessEnvelope): JsonObject => {
  const data = boundedParityObject(response.summary);
  const payload = asObject(response.payload);
  if (!payload) {
    return data;
  }

  const payloadKeys = Object.keys(payload).sort();
  return {
    ...data,
    payload_present: true,
    payload_key_count: payloadKeys.length,
    payload_keys: payloadKeys.slice(0, MAX_PARITY_VIEW_KEYS),
    payload_keys_truncated: payloadKeys.length > MAX_PARITY_VIEW_KEYS
  };
};

const isFailureSite = (value: unknown): value is FailureSite => {
  const site = asObject(value);
  if (!site) {
    return false;
  }
  return (
    typeof site.stage === "string" &&
    typeof site.component === "string" &&
    typeof site.target === "string" &&
    typeof site.summary === "string"
  );
};

const isDiagnosisCategory = (value: unknown): value is Diagnosis["category"] =>
  value === "page_changed" ||
  value === "request_failed" ||
  value === "execution_interrupted" ||
  value === "runtime_unavailable" ||
  value === "unknown";

const asDiagnosis = (value: unknown): Diagnosis | null => {
  const diagnosis = asObject(value);
  const failureSite = isFailureSite(diagnosis?.failure_site)
    ? diagnosis.failure_site
    : null;
  if (
    !failureSite ||
    !isDiagnosisCategory(diagnosis?.category) ||
    typeof diagnosis.stage !== "string" ||
    typeof diagnosis.component !== "string"
  ) {
    return null;
  }

  const evidence = Array.isArray(diagnosis.evidence)
    ? diagnosis.evidence.filter((item): item is string => typeof item === "string")
    : [];

  return {
    category: diagnosis.category,
    stage: diagnosis.stage,
    component: diagnosis.component,
    failure_site: failureSite,
    evidence
  };
};

const diagnosisFromBridgeErrorPayload = (
  response: BridgeResponseErrorEnvelope
): Diagnosis | null => {
  const payload = asObject(response.payload);
  const details = asObject(payload?.details);
  const nestedError = asObject(payload?.error);
  return (
    asDiagnosis(payload?.diagnosis) ??
    asDiagnosis(details?.diagnosis) ??
    asDiagnosis(nestedError?.diagnosis)
  );
};

const normalizeObservabilityPageState = (
  value: unknown
): ObservabilityPayload["page_state"] => {
  const pageState = asObject(value);
  if (!pageState) {
    return null;
  }

  const pageKind = nonEmptyString(pageState.page_kind, "");
  const url = sanitizeUrl(pageState.url);
  const titleRaw = nonEmptyString(pageState.title, "");
  const readyState = nonEmptyString(pageState.ready_state, "");
  const title = truncateString(
    titleRaw.length > 0 ? titleRaw : "unknown",
    MAX_OBSERVABILITY_TITLE_LENGTH
  );
  const partialObservable =
    pageKind.length === 0 || url.length === 0 || titleRaw.length === 0 || readyState.length === 0;

  return {
    page_kind: pageKind.length > 0 ? pageKind : "unknown",
    url: url.length > 0 ? url : "about:blank",
    title: title.value,
    ready_state: readyState.length > 0 ? readyState : "unknown",
    observation_status: partialObservable ? "partial" : "complete",
    ...(partialObservable ? { partial_observable: true } : {}),
    ...((title.truncated || pageState.title_truncated === true) ? { title_truncated: true } : {})
  };
};

const normalizeObservabilityKeyRequest = (
  value: JsonObject
): ObservabilityPayload["key_requests"][number] => {
  const request: ObservabilityPayload["key_requests"][number] = {
    request_id: nonEmptyString(value.request_id, "unknown"),
    stage: nonEmptyString(value.stage, "unknown"),
    method: nonEmptyString(value.method, "UNKNOWN").toUpperCase(),
    url: sanitizeUrl(value.url) || "/",
    outcome: nonEmptyString(value.outcome, "unknown")
  };

  if (typeof value.status_code === "number") {
    request.status_code = value.status_code;
  }

  const failureReason = nonEmptyString(value.failure_reason, "");
  if (failureReason.length > 0) {
    const truncated = truncateString(
      sanitizeFreeText(failureReason),
      MAX_OBSERVABILITY_REQUEST_REASON_LENGTH
    );
    request.failure_reason = truncated.value;
    if (truncated.truncated || value.failure_reason_truncated === true) {
      request.failure_reason_truncated = true;
    }
  }

  const requestClass = nonEmptyString(value.request_class, "");
  if (requestClass.length > 0) {
    request.request_class = requestClass;
  }

  return request;
};

const normalizeObservabilityKeyRequests = (
  value: unknown
): ObservabilityPayload["key_requests"] => {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => asObject(item))
    .filter((item): item is JsonObject => item !== null)
    .slice(0, MAX_OBSERVABILITY_REQUESTS)
    .map((item) => normalizeObservabilityKeyRequest(item));
};

const normalizeObservabilityFailureSite = (
  value: unknown
): ObservabilityPayload["failure_site"] => {
  const failureSite = asObject(value);
  if (!failureSite) {
    return null;
  }

  const target = truncateString(
    sanitizeFailureTarget(failureSite.target),
    MAX_OBSERVABILITY_FAILURE_TARGET_LENGTH
  );
  const summary = truncateString(
    sanitizeFreeText(nonEmptyString(failureSite.summary, "unknown")),
    MAX_OBSERVABILITY_FAILURE_SUMMARY_LENGTH
  );

  return {
    stage: nonEmptyString(failureSite.stage, "unknown"),
    component: nonEmptyString(failureSite.component, "unknown"),
    target: target.value,
    ...((target.truncated || failureSite.target_truncated === true)
      ? { target_truncated: true }
      : {}),
    summary: summary.value,
    ...((summary.truncated || failureSite.summary_truncated === true)
      ? { summary_truncated: true }
      : {})
  };
};

const buildBridgeObservabilityPayload = (value: JsonObject): ObservabilityPayload => {
  const truncationFields: ObservabilityTruncationField[] = [];
  const originalRequests = Array.isArray(value.key_requests) ? value.key_requests : [];
  const keyRequests = normalizeObservabilityKeyRequests(value.key_requests);
  if (originalRequests.length > MAX_OBSERVABILITY_REQUESTS) {
    pushUniqueTruncationField(truncationFields, "key_requests");
  }
  if (keyRequests.some((item) => item.failure_reason_truncated === true)) {
    pushUniqueTruncationField(truncationFields, "key_requests[].failure_reason");
  }

  const pageState = normalizeObservabilityPageState(value.page_state);
  if (pageState?.title_truncated) {
    pushUniqueTruncationField(truncationFields, "page_state.title");
  }

  const failureSite = normalizeObservabilityFailureSite(value.failure_site);
  if (failureSite?.target_truncated) {
    pushUniqueTruncationField(truncationFields, "failure_site.target");
  }
  if (failureSite?.summary_truncated) {
    pushUniqueTruncationField(truncationFields, "failure_site.summary");
  }

  const hasSupplementalEvidence = keyRequests.length > 0 || failureSite !== null;
  const coverage: ObservabilityPayload["coverage"] =
    pageState === null
      ? hasSupplementalEvidence
        ? "partial"
        : "unavailable"
      : pageState.partial_observable
        ? "partial"
        : "complete";

  return {
    coverage,
    request_evidence: keyRequests.length > 0 ? "available" : "none",
    truncation: {
      truncated: truncationFields.length > 0,
      fields: truncationFields
    },
    page_state: pageState,
    key_requests: keyRequests,
    failure_site: failureSite
  };
};

const observabilityFromBridgePayload = (
  response: BridgeResponseEnvelope
): ObservabilityPayload => {
  const payload = asObject(response.payload);
  const observability = asObject(payload?.observability);
  return observability ? buildBridgeObservabilityPayload(observability) : EMPTY_OBSERVABILITY;
};

const boundedDiagnosisForEnvelope = (
  runId: string,
  diagnosis: Diagnosis
): {
  diagnosis: Diagnosis;
  evidenceRefs: string[];
  evidence: CommandEnvelopeV2["evidence"];
  limits: NonNullable<CommandEnvelopeV2["operational"]["limits"]>;
} => {
  const boundedEvidence = diagnosis.evidence
    .slice(0, MAX_DIAGNOSIS_EVIDENCE_ITEMS)
    .map((item) => boundedDiagnosisEvidenceSummary(item));
  const evidenceRefs = boundedEvidence.map(
    (_item, index) => `run:${runId}:bridge:diagnosis:${index + 1}`
  );
  const limits: NonNullable<CommandEnvelopeV2["operational"]["limits"]> = [];

  if (diagnosis.evidence.length > MAX_DIAGNOSIS_EVIDENCE_ITEMS) {
    limits.push({
      limit_ref: "bridge.diagnosis.evidence.count",
      kind: "truncation",
      affected_path: "errors[0].diagnosis.evidence",
      reason: "bridge diagnosis evidence exceeded the command envelope sidecar count bound"
    });
  }

  boundedEvidence.forEach((item, index) => {
    if (item.redacted) {
      limits.push({
        limit_ref: `bridge.diagnosis.evidence.${index + 1}.redaction`,
        kind: "redaction",
        affected_path: `evidence[${index}].summary`,
        reason: "bridge diagnosis evidence contained sensitive text"
      });
    }
    if (item.truncated) {
      limits.push({
        limit_ref: `bridge.diagnosis.evidence.${index + 1}.truncation`,
        kind: "truncation",
        affected_path: `evidence[${index}].summary`,
        reason: "bridge diagnosis evidence exceeded the command envelope sidecar summary bound"
      });
    }
  });

  return {
    diagnosis: {
      ...diagnosis,
      evidence: boundedEvidence.map((item) => item.value)
    },
    evidenceRefs,
    evidence: boundedEvidence.map((item, index) => ({
      kind: "runtime_diagnostic",
      ref: evidenceRefs[index] ?? `run:${runId}:bridge:diagnosis:${index + 1}`,
      status: "available",
      produced_by_run_id: runId,
      summary: item.value
    })),
    limits
  };
};

const buildCommandEnvelopeV2ForBridgeResponse = (
  request: BridgeRequestEnvelope,
  response: BridgeResponseEnvelope,
  options?: {
    timestamp?: string;
    observability?: ObservabilityPayload;
  }
): CommandEnvelopeV2 => {
  const runId = resolveCommandRunId(request);
  const command = resolveCommandName(request);
  const timestamp = options?.timestamp ?? isoNow();
  const observability = options?.observability ?? observabilityFromBridgePayload(response);

  if (response.status === "success") {
    const data = buildSuccessParityData(response);
    const compatSummary = boundedParityObject(response.summary);
    return {
      ok: true,
      command,
      run_id: runId,
      data,
      operational: {
        compat: {
          output_version: "v2",
          compatible_with: "fr-0001.v1",
          v1_status: "success",
          v1_summary: compatSummary
        },
        observability,
        timestamps: {
          completed_at: timestamp
        }
      },
      evidence: [],
      warnings: [],
      errors: []
    };
  }

  const cliError = bridgeErrorToCliError(response.error);
  const diagnosis = diagnosisFromBridgeErrorPayload(response);
  const boundedDiagnosis = diagnosis ? boundedDiagnosisForEnvelope(runId, diagnosis) : null;
  const safeDiagnosis = boundedDiagnosis?.diagnosis ?? null;
  const evidenceRefs = boundedDiagnosis?.evidenceRefs ?? [];
  const limits = boundedDiagnosis?.limits ?? [];
  const diagnosisIndex = boundedDiagnosis
    ? {
        availability: "available" as const,
        primary_error_index: 0,
        classification: boundedDiagnosis.diagnosis.category,
        failure_site: boundedDiagnosis.diagnosis.failure_site,
        ...(evidenceRefs.length > 0 ? { evidence_refs: evidenceRefs } : {}),
        summary: boundedDiagnosis.diagnosis.failure_site.summary
      }
    : {
        availability: "unavailable" as const,
        summary: "diagnosis unavailable"
      };
  return {
    ok: false,
    command,
    run_id: runId,
    data: {},
    operational: {
      compat: {
        output_version: "v2",
        compatible_with: "fr-0001.v1",
        v1_status: "error",
        v1_error: {
          code: cliError.code,
          message: response.error.message,
          retryable: cliError.retryable
        }
      },
      observability,
      diagnosis: diagnosisIndex,
      timestamps: {
        completed_at: timestamp
      },
      ...(limits.length > 0 ? { limits } : {})
    },
    evidence: boundedDiagnosis?.evidence ?? [],
    warnings: [],
    errors: [
      {
        code: cliError.code,
        message: response.error.message,
        retryable: cliError.retryable,
        category: categoryForCliError(cliError.code, safeDiagnosis),
        family: familyForCliError(cliError.code),
        exit_code: CLI_ERROR_EXIT_CODE[cliError.code] ?? 5,
        ...(safeDiagnosis ? { diagnosis: safeDiagnosis } : {}),
        ...(evidenceRefs.length > 0 ? { related_evidence_refs: evidenceRefs } : {})
      },
    ]
  };
};

export const withBridgeCommandEnvelopeV2 = (
  request: BridgeRequestEnvelope,
  response: BridgeResponseEnvelope,
  options?: {
    timestamp?: string;
    observability?: ObservabilityPayload;
  }
): BridgeResponseEnvelope => {
  if (request.method !== "bridge.forward") {
    return response;
  }

  return {
    ...response,
    command_envelope_v2: buildCommandEnvelopeV2ForBridgeResponse(request, response, options)
  };
};

export const ensureBridgeRequestEnvelope: (
  input: unknown
) => asserts input is BridgeRequestEnvelope = (input: unknown) => {
  const value = input as Partial<BridgeRequestEnvelope> | null;
  const timeoutOk =
    value?.timeout_ms === undefined ||
    (typeof value.timeout_ms === "number" && Number.isFinite(value.timeout_ms) && value.timeout_ms > 0);

  if (
    !value ||
    !isNonEmptyString(value.id) ||
    !isKnownMethod(value.method) ||
    typeof value.params !== "object" ||
    value.params === null ||
    (value.profile !== null && value.profile !== undefined && typeof value.profile !== "string") ||
    !timeoutOk
  ) {
    throw new Error("invalid request envelope");
  }
};

export const createBridgeOpenRequest = (input: {
  id: string;
  profile: string | null;
  timeoutMs?: number;
}): BridgeRequestEnvelope => ({
  id: input.id,
  method: "bridge.open",
  profile: input.profile,
  timeout_ms: input.timeoutMs ?? DEFAULT_TRANSPORT_TIMEOUT_MS,
  params: {
    protocol: BRIDGE_PROTOCOL,
    capabilities: ["relay", "heartbeat"]
  }
});

export const createBridgeForwardRequest = (input: {
  id: string;
  profile: string | null;
  sessionId: string;
  runId: string;
  command: string;
  commandParams: Record<string, unknown>;
  cwd: string;
  timeoutMs: number;
}): BridgeRequestEnvelope => ({
  id: input.id,
  method: "bridge.forward",
  profile: input.profile,
  timeout_ms: input.timeoutMs,
  params: {
    session_id: input.sessionId,
    run_id: input.runId,
    command: input.command,
    command_params: input.commandParams,
    cwd: input.cwd
  }
});

export const createHeartbeatRequest = (input: {
  id: string;
  sessionId: string;
}): BridgeRequestEnvelope => ({
  id: input.id,
  method: "__ping__",
  profile: null,
  params: {
    session_id: input.sessionId,
    timestamp: new Date().toISOString()
  }
});

export const ensureBridgeSuccess = (
  response: BridgeResponseEnvelope,
  errorMessage: string
): BridgeResponseSuccessEnvelope => {
  if (response.status !== "success") {
    throw new Error(`${errorMessage}: ${response.error.code}`);
  }

  return response;
};
