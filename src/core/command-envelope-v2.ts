import type { Diagnosis, DiagnosisCategory } from "../runtime/diagnostics.js";
import type { FailureSite, ObservabilityPayload } from "../runtime/observability.js";
import type { ErrorCode } from "./errors.js";
import type { ErrorResponse, JsonObject, SuccessResponse } from "./types.js";

export type EvidenceStatusV2 = "available" | "partial" | "unavailable" | "not_applicable";

export interface EvidenceRefV2 {
  kind:
    | "artifact"
    | "log"
    | "route_evidence"
    | "runtime_diagnostic"
    | "contract_specific"
    | "not_applicable";
  ref: string;
  status: EvidenceStatusV2;
  produced_by_run_id?: string;
  collected_at?: string;
  summary?: string;
}

export interface LimitDisclosureV2 {
  limit_ref: string;
  kind: "redaction" | "truncation" | "budget_clip" | "partial_observation";
  affected_path: string;
  reason: string;
}

export interface DiagnosisIndexV2 {
  availability: "available" | "unavailable" | "not_applicable";
  primary_error_index?: number;
  classification?: string;
  failure_site?: FailureSite;
  evidence_refs?: string[];
  summary?: string;
}

export interface OperationalV2 {
  compat: {
    output_version: "v2";
    compatible_with: "fr-0001.v1";
    v1_status: "success" | "error";
    v1_summary?: JsonObject;
    v1_error?: {
      code: ErrorCode;
      message: string;
      retryable: boolean;
    };
  };
  observability: ObservabilityPayload;
  diagnosis?: DiagnosisIndexV2;
  timestamps: {
    completed_at: string;
  };
  limits?: LimitDisclosureV2[];
}

export interface ErrorV2 {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  category:
    | "cli"
    | "runtime"
    | "page"
    | "request"
    | "action"
    | "account"
    | "risk"
    | "evidence"
    | "environment"
    | "unknown";
  family:
    | "validation"
    | "risk_gate_denied"
    | "provider_unavailable"
    | "runtime_failure"
    | "closeout_failure"
    | "schema_evidence_failure";
  exit_code: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  diagnosis?: Diagnosis;
  related_evidence_refs?: string[];
}

export interface WarningV2 {
  code: "WARN_EVIDENCE_PARTIAL" | "WARN_OPERATIONAL_LIMIT";
  message: string;
  severity: "info" | "warning";
  related_evidence_ref?: string;
  related_limit_ref?: string;
}

export interface CommandEnvelopeV2 {
  ok: boolean;
  command: string;
  run_id: string;
  data: JsonObject;
  operational: OperationalV2;
  evidence: EvidenceRefV2[];
  warnings: WarningV2[];
  errors: ErrorV2[];
}

type CurrentCliResponse = SuccessResponse | ErrorResponse;

const commandErrorCategoryByDiagnosis: Record<DiagnosisCategory, ErrorV2["category"]> = {
  execution_interrupted: "runtime",
  page_changed: "page",
  request_failed: "request",
  runtime_unavailable: "runtime",
  unknown: "unknown"
};

const EXIT_CODE_BY_ERROR: Record<ErrorCode, ErrorV2["exit_code"]> = {
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

const categoryForError = (code: ErrorCode, diagnosis?: Diagnosis): ErrorV2["category"] => {
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
    return commandErrorCategoryByDiagnosis[diagnosis.category];
  }
  return "unknown";
};

const familyForError = (code: ErrorCode): ErrorV2["family"] => {
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
  if (
    code === "ERR_PROVIDER_UNAVAILABLE" ||
    code === "ERR_RUNTIME_UNAVAILABLE" ||
    code.startsWith("ERR_RUNTIME_BOOTSTRAP_") ||
    code.startsWith("ERR_RUNTIME_IDENTITY_") ||
    code === "ERR_RUNTIME_READY_SIGNAL_CONFLICT" ||
    code === "ERR_EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED" ||
    code.startsWith("ERR_PROFILE_") ||
    code === "ERR_BROWSER_LAUNCH_FAILED"
  ) {
    return "provider_unavailable";
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

const sanitizeRefToken = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const pushEvidence = (items: EvidenceRefV2[], item: EvidenceRefV2): void => {
  if (!items.some((existing) => existing.ref === item.ref)) {
    items.push(item);
  }
};

const evidenceFromObservability = (
  runId: string,
  observability: ObservabilityPayload
): EvidenceRefV2[] => {
  const evidence: EvidenceRefV2[] = [];

  observability.key_requests.forEach((request, index) => {
    const requestRef = sanitizeRefToken(request.request_id);
    const status = request.outcome === "unknown" ? "partial" : "available";
    const statusCode = typeof request.status_code === "number" ? ` status=${request.status_code}` : "";
    pushEvidence(evidence, {
      kind: "route_evidence",
      ref: `run:${runId}:observability:key_request:${index + 1}:${requestRef}`,
      status,
      produced_by_run_id: runId,
      summary: `${request.method} ${request.url} outcome=${request.outcome}${statusCode}`
    });
  });

  if (observability.failure_site !== null) {
    pushEvidence(evidence, {
      kind: "runtime_diagnostic",
      ref: `run:${runId}:observability:failure_site`,
      status: "available",
      produced_by_run_id: runId,
      summary: observability.failure_site.summary
    });
  }

  return evidence;
};

const diagnosisEvidenceRefs = (
  runId: string,
  diagnosis: Diagnosis | undefined,
  evidence: EvidenceRefV2[]
): string[] => {
  if (!diagnosis) {
    return [];
  }

  return diagnosis.evidence.map((item, index) => {
    const ref = `run:${runId}:diagnosis:evidence:${index + 1}`;
    pushEvidence(evidence, {
      kind: "runtime_diagnostic",
      ref,
      status: "available",
      produced_by_run_id: runId,
      summary: item
    });
    return ref;
  });
};

const limitsFromObservability = (observability: ObservabilityPayload): LimitDisclosureV2[] => {
  const limits: LimitDisclosureV2[] = observability.truncation.fields.map((field) => ({
    limit_ref: `observability.truncation.${field}`,
    kind: "truncation",
    affected_path: `operational.observability.${field}`,
    reason: "current v1 observability payload reports this field as truncated"
  }));

  if (observability.coverage === "partial") {
    limits.push({
      limit_ref: "observability.coverage.partial",
      kind: "partial_observation",
      affected_path: "operational.observability",
      reason: "current v1 observability payload reports partial coverage"
    });
  }

  return limits;
};

const limitsFromEvidence = (evidence: EvidenceRefV2[]): LimitDisclosureV2[] =>
  evidence
    .filter((item) => item.status === "partial")
    .map((item) => ({
      limit_ref: `evidence.partial.${sanitizeRefToken(item.ref)}`,
      kind: "partial_observation",
      affected_path: "evidence[*].status",
      reason: `evidence ref ${item.ref} is partial`
    }));

const severityForLimit = (limit: LimitDisclosureV2): WarningV2["severity"] =>
  limit.kind === "partial_observation" ? "warning" : "info";

const evidenceRefForLimit = (
  limit: LimitDisclosureV2,
  evidence: EvidenceRefV2[]
): string | undefined =>
  evidence.find((item) => limit.reason === `evidence ref ${item.ref} is partial`)?.ref;

const warningCodeForLimit = (
  limit: LimitDisclosureV2,
  relatedEvidenceRef: string | undefined
): WarningV2["code"] =>
  relatedEvidenceRef && limit.kind === "partial_observation"
    ? "WARN_EVIDENCE_PARTIAL"
    : "WARN_OPERATIONAL_LIMIT";

const warningMessageForLimit = (
  limit: LimitDisclosureV2,
  relatedEvidenceRef: string | undefined
): string => {
  if (relatedEvidenceRef && limit.kind === "partial_observation") {
    return "Evidence is partial; retry may collect fuller diagnostics if the command context is still valid";
  }

  if (limit.kind === "redaction") {
    return "Consumer-visible output was redacted";
  }

  if (limit.kind === "truncation") {
    return "Consumer-visible output was truncated";
  }

  if (limit.kind === "budget_clip") {
    return "Consumer-visible output was clipped by a budget limit";
  }

  return "Runtime diagnostics are partially observable";
};

const warningsFromLimits = (
  limits: LimitDisclosureV2[],
  evidence: EvidenceRefV2[]
): WarningV2[] =>
  limits.map((limit) => {
    const relatedEvidenceRef = evidenceRefForLimit(limit, evidence);

    return {
      code: warningCodeForLimit(limit, relatedEvidenceRef),
      message: warningMessageForLimit(limit, relatedEvidenceRef),
      severity: severityForLimit(limit),
      related_limit_ref: limit.limit_ref,
      ...(relatedEvidenceRef ? { related_evidence_ref: relatedEvidenceRef } : {})
    };
  });

const diagnosisIndexFromError = (
  response: ErrorResponse,
  evidenceRefs: string[]
): DiagnosisIndexV2 => ({
  availability: "available",
  primary_error_index: 0,
  classification: response.error.diagnosis.category,
  failure_site: response.error.diagnosis.failure_site,
  ...(evidenceRefs.length > 0 ? { evidence_refs: evidenceRefs } : {}),
  summary: response.error.diagnosis.failure_site.summary
});

const errorFromResponse = (
  response: ErrorResponse,
  relatedEvidenceRefs: string[]
): ErrorV2 => ({
  code: response.error.code,
  message: response.error.message,
  retryable: response.error.retryable,
  category: categoryForError(response.error.code, response.error.diagnosis),
  family: familyForError(response.error.code),
  exit_code: EXIT_CODE_BY_ERROR[response.error.code],
  diagnosis: response.error.diagnosis,
  ...(relatedEvidenceRefs.length > 0 ? { related_evidence_refs: relatedEvidenceRefs } : {})
});

export const mapCurrentCliResponseToCommandEnvelopeV2 = (
  response: CurrentCliResponse
): CommandEnvelopeV2 => {
  const evidence = evidenceFromObservability(response.run_id, response.observability);

  if (response.status === "success") {
    const limits = [
      ...limitsFromObservability(response.observability),
      ...limitsFromEvidence(evidence)
    ];
    const warnings = warningsFromLimits(limits, evidence);

    return {
      ok: true,
      command: response.command,
      run_id: response.run_id,
      data: response.summary,
      operational: {
        compat: {
          output_version: "v2",
          compatible_with: "fr-0001.v1",
          v1_status: response.status,
          v1_summary: response.summary
        },
        observability: response.observability,
        timestamps: {
          completed_at: response.timestamp
        },
        ...(limits.length > 0 ? { limits } : {})
      },
      evidence,
      warnings,
      errors: []
    };
  }

  const diagnosisRefs = diagnosisEvidenceRefs(response.run_id, response.error.diagnosis, evidence);
  const limits = [
    ...limitsFromObservability(response.observability),
    ...limitsFromEvidence(evidence)
  ];
  const warnings = warningsFromLimits(limits, evidence);
  const primaryError = errorFromResponse(
    response,
    evidence.map((item) => item.ref)
  );

  return {
    ok: false,
    command: response.command,
    run_id: response.run_id,
    data: {},
    operational: {
      compat: {
        output_version: "v2",
        compatible_with: "fr-0001.v1",
        v1_status: response.status,
        v1_error: {
          code: response.error.code,
          message: response.error.message,
          retryable: response.error.retryable
        }
      },
      observability: response.observability,
      diagnosis: diagnosisIndexFromError(response, diagnosisRefs),
      timestamps: {
        completed_at: response.timestamp
      },
      ...(limits.length > 0 ? { limits } : {})
    },
    evidence,
    warnings,
    errors: [primaryError]
  };
};
