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

const isRecoverableRuntimeErrorCode = (code: string): boolean => {
  if (
    code === "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH" ||
    code === "ERR_RUNTIME_IDENTITY_MISMATCH"
  ) {
    return false;
  }

  return (
    code === "ERR_RUNTIME_UNAVAILABLE" ||
    code === "ERR_RUNTIME_READY_SIGNAL_CONFLICT" ||
    code === "ERR_RUNTIME_IDENTITY_NOT_BOUND" ||
    code.startsWith("ERR_RUNTIME_BOOTSTRAP_")
  );
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
      retryable: isRecoverableRuntimeErrorCode(error.code),
      originalCode: error.code
    };
  }

  return {
    code: "ERR_RUNTIME_UNAVAILABLE",
    retryable: error.code === "ERR_TRANSPORT_TIMEOUT",
    originalCode: error.code
  };
};

const categoryForCliError = (code: ErrorCode): ErrorV2["category"] => {
  if (code === "ERR_RISK_GATE_DENIED") {
    return "risk";
  }
  if (code === "ERR_CLOSEOUT_FAILED" || code === "ERR_SCHEMA_EVIDENCE_FAILED") {
    return "evidence";
  }
  if (code === "ERR_PROVIDER_UNAVAILABLE") {
    return "environment";
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
    code.startsWith("ERR_EXTENSION_") ||
    code === "ERR_EXECUTION_FAILED"
  ) {
    return "runtime";
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

const diagnosisEvidenceRefs = (runId: string, diagnosis: Diagnosis): string[] =>
  diagnosis.evidence.map((_item, index) => `run:${runId}:bridge:diagnosis:${index + 1}`);

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
  const observability = options?.observability ?? EMPTY_OBSERVABILITY;

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
  const evidenceRefs = diagnosis ? diagnosisEvidenceRefs(runId, diagnosis) : [];
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
      diagnosis: diagnosis
        ? {
            availability: "available",
            primary_error_index: 0,
            classification: diagnosis.category,
            failure_site: diagnosis.failure_site,
            ...(evidenceRefs.length > 0 ? { evidence_refs: evidenceRefs } : {}),
            summary: diagnosis.failure_site.summary
          }
        : {
            availability: "unavailable",
            summary: "diagnosis unavailable"
          },
      timestamps: {
        completed_at: timestamp
      }
    },
    evidence: diagnosis
      ? diagnosis.evidence.map((item, index) => ({
          kind: "runtime_diagnostic",
          ref: evidenceRefs[index] ?? `run:${runId}:bridge:diagnosis:${index + 1}`,
          status: "available",
          produced_by_run_id: runId,
          summary: item
        }))
      : [],
    warnings: [],
    errors: [
      {
        code: cliError.code,
        message: response.error.message,
        retryable: cliError.retryable,
        category: categoryForCliError(cliError.code),
        family: familyForCliError(cliError.code),
        exit_code: CLI_ERROR_EXIT_CODE[cliError.code] ?? 5,
        ...(diagnosis ? { diagnosis } : {}),
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
