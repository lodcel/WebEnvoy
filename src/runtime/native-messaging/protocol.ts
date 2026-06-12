import type { CommandEnvelopeV2, ErrorV2 } from "../../core/command-envelope-v2.js";
import type { ErrorCode } from "../../core/errors.js";
import type { JsonObject } from "../../core/types.js";
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
      retryable: error.code === "ERR_RUNTIME_UNAVAILABLE",
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
    const summary = asObject(response.payload) ?? response.summary;
    return {
      ok: true,
      command,
      run_id: runId,
      data: summary,
      operational: {
        compat: {
          output_version: "v2",
          compatible_with: "fr-0001.v1",
          v1_status: "success",
          v1_summary: summary
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
  const details = asObject(response.payload?.details);
  const evidenceRef = `run:${runId}:bridge:error:${cliError.originalCode}`;
  const failureSite = {
    stage: "transport",
    component: "native-messaging",
    target: command,
    summary: response.error.message
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
      observability: {
        ...observability,
        coverage: observability.coverage === "complete" ? "complete" : "partial",
        failure_site: observability.failure_site ?? failureSite
      },
      diagnosis: {
        availability: "available",
        primary_error_index: 0,
        classification: "execution_interrupted",
        failure_site: failureSite,
        evidence_refs: [evidenceRef],
        summary: response.error.message
      },
      timestamps: {
        completed_at: timestamp
      }
    },
    evidence: [
      {
        kind: "runtime_diagnostic",
        ref: evidenceRef,
        status: "available",
        produced_by_run_id: runId,
        summary: `bridge_error_code=${cliError.originalCode}`
      }
    ],
    warnings: [],
    errors: [
      {
        code: cliError.code,
        message: response.error.message,
        retryable: cliError.retryable,
        category: categoryForCliError(cliError.code),
        family: familyForCliError(cliError.code),
        exit_code: CLI_ERROR_EXIT_CODE[cliError.code] ?? 5,
        diagnosis: {
          category: "execution_interrupted",
          stage: "transport",
          component: "native-messaging",
          failure_site: failureSite,
          evidence: [
            `bridge_error_code=${cliError.originalCode}`,
            ...(details ? [`bridge_response_details_keys=${Object.keys(details).sort().join(",")}`] : [])
          ]
        },
        related_evidence_refs: [evidenceRef]
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
