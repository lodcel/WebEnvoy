import type { JsonObject } from "../core/types.js";

export type CloseoutCanonicalExecutionAuditDecision = "PASS" | "FAIL";

export type CloseoutCanonicalExecutionAuditBlockerLayer =
  | "success_summary"
  | "failure_details"
  | "canonical_consistency"
  | "observability_boundary";

export type CloseoutCanonicalExecutionAuditBlockerCode =
  | "missing_closeout_response"
  | "missing_success_summary"
  | "missing_success_request_admission_result"
  | "invalid_success_request_admission_result"
  | "missing_success_execution_audit"
  | "invalid_success_execution_audit"
  | "success_canonical_mismatch"
  | "success_consumed_inputs_mismatch"
  | "success_compatibility_refs_mismatch"
  | "missing_failure_details"
  | "invalid_failure_request_admission_result"
  | "missing_failure_execution_audit"
  | "invalid_failure_execution_audit"
  | "failure_execution_audit_mismatch"
  | "failure_canonical_mismatch"
  | "failure_consumed_inputs_mismatch"
  | "failure_compatibility_refs_mismatch"
  | "success_gate_run_mismatch"
  | "failure_gate_run_mismatch"
  | "execution_audit_in_observability";

export interface CloseoutCanonicalExecutionAuditVerifierInput {
  expectedRunId?: unknown;
  success?: {
    summary?: unknown;
    observability?: unknown;
  } | null;
  failure?: {
    error?: {
      details?: unknown;
    } | null;
    details?: unknown;
    payload?: unknown;
    observability?: unknown;
  } | null;
}

export interface CloseoutCanonicalExecutionAuditVerifierResult {
  decision: CloseoutCanonicalExecutionAuditDecision;
  passed: boolean;
  blockers: Array<{
    blocker_code: CloseoutCanonicalExecutionAuditBlockerCode;
    blocker_layer: CloseoutCanonicalExecutionAuditBlockerLayer;
    message: string;
    path: string;
  }>;
  success: {
    checked: boolean;
    has_summary: boolean;
    has_request_admission_result: boolean;
    has_execution_audit: boolean;
    request_ref: string | null;
    admission_decision: string | null;
    audit_ref: string | null;
  };
  failure: {
    checked: boolean;
    details_path: "error.details" | "details" | "payload.details" | null;
    has_details: boolean;
    has_execution_audit: boolean;
    audit_ref: string | null;
    canonical_source_path: string | null;
  };
  observability: {
    success_leak_paths: string[];
    failure_leak_paths: string[];
  };
}

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isNonEmptyStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => asNonEmptyString(item) !== null);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const hasOwn = (value: JsonObject | null | undefined, key: string): boolean =>
  !!value && Object.prototype.hasOwnProperty.call(value, key);

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const object = asObject(value);
  if (object) {
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const sameJson = (left: unknown, right: unknown): boolean => stableJson(left) === stableJson(right);

const blocker = (
  blockerCode: CloseoutCanonicalExecutionAuditBlockerCode,
  blockerLayer: CloseoutCanonicalExecutionAuditBlockerLayer,
  path: string,
  message: string
): CloseoutCanonicalExecutionAuditVerifierResult["blockers"][number] => ({
  blocker_code: blockerCode,
  blocker_layer: blockerLayer,
  path,
  message
});

const hasCanonicalConsumedInputs = (value: JsonObject | null): boolean =>
  value !== null &&
  asNonEmptyString(value.action_request_ref) !== null &&
  asNonEmptyString(value.resource_binding_ref) !== null &&
  asNonEmptyString(value.authorization_grant_ref) !== null &&
  asNonEmptyString(value.runtime_target_ref) !== null;

const hasOptionalBlockedAdmissionRef = (value: unknown, decision: unknown): boolean =>
  decision === "blocked" ? value === null || asNonEmptyString(value) !== null : asNonEmptyString(value) !== null;

const hasCanonicalAdmissionDerivedRefs = (
  value: JsonObject | null,
  decision: unknown
): boolean =>
  value !== null &&
  asNonEmptyString(value.gate_input_ref) !== null &&
  hasOptionalBlockedAdmissionRef(value?.approval_admission_ref, decision) &&
  hasOptionalBlockedAdmissionRef(value?.audit_admission_ref, decision);

const hasCanonicalAdmissionDecisionInvariants = (value: JsonObject): boolean =>
  value.runtime_target_match !== false &&
  value.grant_match !== false &&
  value.anonymous_isolation_ok !== false
    ? true
    : value.admission_decision === "blocked";

const isCanonicalRequestAdmissionResult = (value: JsonObject | null): value is JsonObject =>
  value !== null &&
  asNonEmptyString(value.request_ref) !== null &&
  (value.admission_decision === "allowed" ||
    value.admission_decision === "blocked" ||
    value.admission_decision === "deferred") &&
  asNonEmptyString(value.normalized_action_type) !== null &&
  (value.normalized_resource_kind === "anonymous_context" ||
    value.normalized_resource_kind === "profile_session") &&
  isBoolean(value.runtime_target_match) &&
  isBoolean(value.grant_match) &&
  isBoolean(value.anonymous_isolation_ok) &&
  asNonEmptyString(value.effective_runtime_mode) !== null &&
  isNonEmptyStringArray(value.reason_codes) &&
  hasCanonicalAdmissionDecisionInvariants(value) &&
  hasCanonicalAdmissionDerivedRefs(asObject(value.derived_from), value.admission_decision);

const hasNullableCompatibilityRef = (value: JsonObject, key: string): boolean =>
  hasOwn(value, key) && (value[key] === null || asNonEmptyString(value[key]) !== null);

const hasCanonicalCompatibilityRefs = (
  value: JsonObject | null,
  decision: unknown
): boolean =>
  value !== null &&
  asNonEmptyString(value.gate_run_id) !== null &&
  hasOptionalBlockedAdmissionRef(value.approval_admission_ref, decision) &&
  hasOptionalBlockedAdmissionRef(value.audit_admission_ref, decision) &&
  hasNullableCompatibilityRef(value, "approval_record_ref") &&
  hasNullableCompatibilityRef(value, "audit_record_ref") &&
  hasNullableCompatibilityRef(value, "session_rhythm_window_id") &&
  hasNullableCompatibilityRef(value, "session_rhythm_decision_id");

const isCanonicalExecutionAudit = (value: JsonObject | null): value is JsonObject => {
  const consumedInputs = asObject(value?.consumed_inputs);
  const compatibilityRefs = asObject(value?.compatibility_refs);

  return (
    value !== null &&
    asNonEmptyString(value.audit_ref) !== null &&
    asNonEmptyString(value.request_ref) !== null &&
    hasCanonicalConsumedInputs(consumedInputs) &&
    hasCanonicalCompatibilityRefs(compatibilityRefs, value.request_admission_decision) &&
    (value.request_admission_decision === "allowed" ||
      value.request_admission_decision === "blocked" ||
      value.request_admission_decision === "deferred") &&
    isNonEmptyStringArray(value.risk_signals) &&
    asNonEmptyString(value.recorded_at) !== null
  );
};

const requestAdmissionMatchesExecutionAudit = (
  requestAdmissionResult: JsonObject,
  executionAudit: JsonObject
): boolean =>
  asNonEmptyString(requestAdmissionResult.request_ref) ===
    asNonEmptyString(executionAudit.request_ref) &&
  asNonEmptyString(requestAdmissionResult.admission_decision) ===
    asNonEmptyString(executionAudit.request_admission_decision);

const consumedInputsMatchAdmissionRefs = (
  requestAdmissionResult: JsonObject,
  executionAudit: JsonObject
): boolean => {
  const derivedFrom = asObject(requestAdmissionResult.derived_from);
  const consumedInputs = asObject(executionAudit.consumed_inputs);
  const requestRef = asNonEmptyString(requestAdmissionResult.request_ref);
  const expectedActionRequestRef = asNonEmptyString(derivedFrom?.action_request_ref);
  const expectedResourceBindingRef = asNonEmptyString(derivedFrom?.resource_binding_ref);
  const expectedAuthorizationGrantRef = asNonEmptyString(derivedFrom?.authorization_grant_ref);
  const expectedRuntimeTargetRef = asNonEmptyString(derivedFrom?.runtime_target_ref);

  return (
    requestRef === asNonEmptyString(consumedInputs?.action_request_ref) &&
    (expectedActionRequestRef === null || expectedActionRequestRef === requestRef) &&
    (expectedResourceBindingRef === null ||
      expectedResourceBindingRef === asNonEmptyString(consumedInputs?.resource_binding_ref)) &&
    (expectedAuthorizationGrantRef === null ||
      expectedAuthorizationGrantRef ===
        asNonEmptyString(consumedInputs?.authorization_grant_ref)) &&
    (expectedRuntimeTargetRef === null ||
      expectedRuntimeTargetRef === asNonEmptyString(consumedInputs?.runtime_target_ref))
  );
};

const optionalAdmissionCompatibilityRefMatches = (
  expected: unknown,
  observed: unknown,
  decision: unknown
): boolean => {
  const expectedRef = asNonEmptyString(expected);
  if (expectedRef === null) {
    return decision === "blocked" && expected === null && observed === null;
  }
  if (decision === "blocked" && observed === null) {
    return true;
  }
  return expectedRef === asNonEmptyString(observed);
};

const compatibilityRefsMatchAdmissionRefs = (
  requestAdmissionResult: JsonObject,
  executionAudit: JsonObject
): boolean => {
  const derivedFrom = asObject(requestAdmissionResult.derived_from);
  const compatibilityRefs = asObject(executionAudit.compatibility_refs);
  const decision = executionAudit.request_admission_decision;

  return (
    optionalAdmissionCompatibilityRefMatches(
      derivedFrom?.approval_admission_ref,
      compatibilityRefs?.approval_admission_ref,
      decision
    ) &&
    optionalAdmissionCompatibilityRefMatches(
      derivedFrom?.audit_admission_ref,
      compatibilityRefs?.audit_admission_ref,
      decision
    )
  );
};

const gateRunMatchesAdmissionGateInput = (
  requestAdmissionResult: JsonObject,
  executionAudit: JsonObject
): boolean => {
  const derivedFrom = asObject(requestAdmissionResult.derived_from);
  const compatibilityRefs = asObject(executionAudit.compatibility_refs);
  return (
    asNonEmptyString(derivedFrom?.gate_input_ref) ===
    asNonEmptyString(compatibilityRefs?.gate_run_id)
  );
};

const gateRefsMatchExpectedRunId = (
  requestAdmissionResult: JsonObject,
  executionAudit: JsonObject,
  expectedRunId: string | null
): boolean => {
  if (expectedRunId === null) {
    return true;
  }
  const derivedFrom = asObject(requestAdmissionResult.derived_from);
  const compatibilityRefs = asObject(executionAudit.compatibility_refs);
  return (
    asNonEmptyString(derivedFrom?.gate_input_ref) === expectedRunId &&
    asNonEmptyString(compatibilityRefs?.gate_run_id) === expectedRunId
  );
};

const auditGateRunMatchesExpectedRunId = (
  executionAudit: JsonObject,
  expectedRunId: string | null
): boolean => {
  if (expectedRunId === null) {
    return true;
  }
  const compatibilityRefs = asObject(executionAudit.compatibility_refs);
  return asNonEmptyString(compatibilityRefs?.gate_run_id) === expectedRunId;
};

const findExecutionAuditKeys = (value: unknown, path: string): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findExecutionAuditKeys(item, `${path}[${index}]`));
  }

  const object = asObject(value);
  if (!object) {
    return [];
  }

  return Object.keys(object).flatMap((key) => {
    const nextPath = `${path}.${key}`;
    const nested = findExecutionAuditKeys(object[key], nextPath);
    return key === "execution_audit" ? [nextPath, ...nested] : nested;
  });
};

const resolveFailureDetails = (
  failure: NonNullable<CloseoutCanonicalExecutionAuditVerifierInput["failure"]>
): {
  path: CloseoutCanonicalExecutionAuditVerifierResult["failure"]["details_path"];
  details: JsonObject | null;
} => {
  const errorDetails = asObject(failure.error?.details);
  if (errorDetails) {
    return { path: "error.details", details: errorDetails };
  }

  const directDetails = asObject(failure.details);
  if (directDetails) {
    return { path: "details", details: directDetails };
  }

  const payloadDetails = asObject(asObject(failure.payload)?.details);
  if (payloadDetails) {
    return { path: "payload.details", details: payloadDetails };
  }

  return { path: null, details: null };
};

const resolveFailureCanonicalAudit = (
  failure: NonNullable<CloseoutCanonicalExecutionAuditVerifierInput["failure"]>
): { path: string | null; executionAudit: JsonObject | null } => {
  const payload = asObject(failure.payload);
  const payloadAudit = asObject(payload?.execution_audit);
  if (payloadAudit) {
    return { path: "payload.execution_audit", executionAudit: payloadAudit };
  }

  const summaryAudit = asObject(asObject(payload?.summary)?.execution_audit);
  if (summaryAudit) {
    return { path: "payload.summary.execution_audit", executionAudit: summaryAudit };
  }

  return { path: null, executionAudit: null };
};

const resolveFailureRequestAdmissionResult = (
  failure: NonNullable<CloseoutCanonicalExecutionAuditVerifierInput["failure"]>
): { path: string | null; requestAdmissionResult: JsonObject | null } => {
  const payload = asObject(failure.payload);
  const payloadRequestAdmissionResult = asObject(payload?.request_admission_result);
  if (payloadRequestAdmissionResult) {
    return {
      path: "payload.request_admission_result",
      requestAdmissionResult: payloadRequestAdmissionResult
    };
  }

  const summaryRequestAdmissionResult = asObject(asObject(payload?.summary)?.request_admission_result);
  if (summaryRequestAdmissionResult) {
    return {
      path: "payload.summary.request_admission_result",
      requestAdmissionResult: summaryRequestAdmissionResult
    };
  }

  const detailsRequestAdmissionResult = asObject(asObject(failure.details)?.request_admission_result);
  if (detailsRequestAdmissionResult) {
    return {
      path: "details.request_admission_result",
      requestAdmissionResult: detailsRequestAdmissionResult
    };
  }

  const errorRequestAdmissionResult = asObject(
    asObject(failure.error?.details)?.request_admission_result
  );
  if (errorRequestAdmissionResult) {
    return {
      path: "error.details.request_admission_result",
      requestAdmissionResult: errorRequestAdmissionResult
    };
  }

  return { path: null, requestAdmissionResult: null };
};

export const verifyCloseoutCanonicalExecutionAudit = (
  input: CloseoutCanonicalExecutionAuditVerifierInput
): CloseoutCanonicalExecutionAuditVerifierResult => {
  const blockers: CloseoutCanonicalExecutionAuditVerifierResult["blockers"] = [];
  const successSummary = asObject(input.success?.summary);
  const expectedRunId = asNonEmptyString(input.expectedRunId);
  const successRequestAdmissionResult = asObject(successSummary?.request_admission_result);
  const successExecutionAudit = asObject(successSummary?.execution_audit);
  const failureDetails = input.failure ? resolveFailureDetails(input.failure) : null;
  const failureDetailsExecutionAudit = asObject(failureDetails?.details?.execution_audit);
  const failureCanonicalAudit = input.failure ? resolveFailureCanonicalAudit(input.failure) : null;
  const failureRequestAdmissionResult = input.failure
    ? resolveFailureRequestAdmissionResult(input.failure)
    : null;
  const successLeakPaths = input.success
    ? findExecutionAuditKeys(input.success.observability, "success.observability")
    : [];
  const failureLeakPaths = input.failure
    ? [
        ...findExecutionAuditKeys(input.failure.observability, "failure.observability"),
        ...findExecutionAuditKeys(
          asObject(input.failure.payload)?.observability,
          "failure.payload.observability"
        )
      ]
    : [];

  if (!input.success && !input.failure) {
    blockers.push(
      blocker(
        "missing_closeout_response",
        "canonical_consistency",
        "closeout",
        "closeout canonical execution audit verifier requires a success or failure response"
      )
    );
  }

  if (input.success) {
    if (!successSummary) {
      blockers.push(
        blocker(
          "missing_success_summary",
          "success_summary",
          "success.summary",
          "closeout success response must include a summary object"
        )
      );
    }

    if (!hasOwn(successSummary, "request_admission_result")) {
      blockers.push(
        blocker(
          "missing_success_request_admission_result",
          "success_summary",
          "success.summary.request_admission_result",
          "closeout success summary must include canonical request_admission_result"
        )
      );
    } else if (!isCanonicalRequestAdmissionResult(successRequestAdmissionResult)) {
      blockers.push(
        blocker(
          "invalid_success_request_admission_result",
          "success_summary",
          "success.summary.request_admission_result",
          "closeout success request_admission_result must use the canonical shape"
        )
      );
    }

    if (!hasOwn(successSummary, "execution_audit")) {
      blockers.push(
        blocker(
          "missing_success_execution_audit",
          "success_summary",
          "success.summary.execution_audit",
          "closeout success summary must include canonical execution_audit"
        )
      );
    } else if (!isCanonicalExecutionAudit(successExecutionAudit)) {
      blockers.push(
        blocker(
          "invalid_success_execution_audit",
          "success_summary",
          "success.summary.execution_audit",
          "closeout success execution_audit must use the canonical shape"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(successRequestAdmissionResult) &&
      isCanonicalExecutionAudit(successExecutionAudit) &&
      !requestAdmissionMatchesExecutionAudit(successRequestAdmissionResult, successExecutionAudit)
    ) {
      blockers.push(
        blocker(
          "success_canonical_mismatch",
          "canonical_consistency",
          "success.summary",
          "success request_admission_result and execution_audit must describe the same admission decision"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(successRequestAdmissionResult) &&
      isCanonicalExecutionAudit(successExecutionAudit) &&
      !consumedInputsMatchAdmissionRefs(successRequestAdmissionResult, successExecutionAudit)
    ) {
      blockers.push(
        blocker(
          "success_consumed_inputs_mismatch",
          "canonical_consistency",
          "success.summary.execution_audit.consumed_inputs",
          "success execution_audit consumed_inputs must match request_admission_result derived refs"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(successRequestAdmissionResult) &&
      isCanonicalExecutionAudit(successExecutionAudit) &&
      !compatibilityRefsMatchAdmissionRefs(successRequestAdmissionResult, successExecutionAudit)
    ) {
      blockers.push(
        blocker(
          "success_compatibility_refs_mismatch",
          "canonical_consistency",
          "success.summary.execution_audit.compatibility_refs",
          "success execution_audit compatibility_refs must match request_admission_result derived refs"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(successRequestAdmissionResult) &&
      isCanonicalExecutionAudit(successExecutionAudit) &&
      !gateRunMatchesAdmissionGateInput(successRequestAdmissionResult, successExecutionAudit)
    ) {
      blockers.push(
        blocker(
          "success_gate_run_mismatch",
          "canonical_consistency",
          "success.summary.execution_audit.compatibility_refs.gate_run_id",
          "success execution_audit gate_run_id must match request_admission_result derived_from.gate_input_ref"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(successRequestAdmissionResult) &&
      isCanonicalExecutionAudit(successExecutionAudit) &&
      !gateRefsMatchExpectedRunId(successRequestAdmissionResult, successExecutionAudit, expectedRunId)
    ) {
      blockers.push(
        blocker(
          "success_gate_run_mismatch",
          "canonical_consistency",
          "success.summary.execution_audit.compatibility_refs.gate_run_id",
          "success execution_audit gate refs must match the current run id"
        )
      );
    }
  }

  if (input.failure) {
    if (!failureDetails?.details) {
      blockers.push(
        blocker(
          "missing_failure_details",
          "failure_details",
          "failure.error.details|failure.details|failure.payload.details",
          "closeout failure response must include error.details or failure details"
        )
      );
    }

    if (!failureDetailsExecutionAudit) {
      blockers.push(
        blocker(
          "missing_failure_execution_audit",
          "failure_details",
          failureDetails?.path
            ? `failure.${failureDetails.path}.execution_audit`
            : "failure.execution_audit",
          "closeout failure details must include canonical execution_audit"
        )
      );
    } else if (!isCanonicalExecutionAudit(failureDetailsExecutionAudit)) {
      blockers.push(
        blocker(
          "invalid_failure_execution_audit",
          "failure_details",
          `failure.${failureDetails?.path ?? "details"}.execution_audit`,
          "closeout failure execution_audit must use the canonical shape"
        )
      );
    }

    if (
      failureDetailsExecutionAudit &&
      !failureCanonicalAudit?.executionAudit
    ) {
      blockers.push(
        blocker(
          "failure_execution_audit_mismatch",
          "canonical_consistency",
          `failure.${failureDetails?.path ?? "details"}.execution_audit`,
          "closeout failure details.execution_audit must match a distinct canonical execution_audit source"
        )
      );
    } else if (
      failureDetailsExecutionAudit &&
      failureCanonicalAudit?.executionAudit &&
      !sameJson(failureDetailsExecutionAudit, failureCanonicalAudit.executionAudit)
    ) {
      blockers.push(
        blocker(
          "failure_execution_audit_mismatch",
          "canonical_consistency",
          `failure.${failureDetails?.path ?? "details"}.execution_audit`,
          "closeout failure details.execution_audit must match the canonical execution_audit"
        )
      );
    }

    const failureRequestAdmission = failureRequestAdmissionResult?.requestAdmissionResult ?? null;
    if (
      failureRequestAdmission !== null &&
      !isCanonicalRequestAdmissionResult(failureRequestAdmission)
    ) {
      blockers.push(
        blocker(
          "invalid_failure_request_admission_result",
          "failure_details",
          `failure.${failureRequestAdmissionResult?.path ?? "request_admission_result"}`,
          "present failure request_admission_result must use the canonical shape"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(failureRequestAdmission) &&
      isCanonicalExecutionAudit(failureDetailsExecutionAudit) &&
      !requestAdmissionMatchesExecutionAudit(failureRequestAdmission, failureDetailsExecutionAudit)
    ) {
      blockers.push(
        blocker(
          "failure_canonical_mismatch",
          "canonical_consistency",
          `failure.${failureDetails?.path ?? "details"}.execution_audit`,
          "failure request_admission_result and execution_audit must describe the same admission decision"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(failureRequestAdmission) &&
      isCanonicalExecutionAudit(failureDetailsExecutionAudit) &&
      !consumedInputsMatchAdmissionRefs(failureRequestAdmission, failureDetailsExecutionAudit)
    ) {
      blockers.push(
        blocker(
          "failure_consumed_inputs_mismatch",
          "canonical_consistency",
          `failure.${failureDetails?.path ?? "details"}.execution_audit.consumed_inputs`,
          "failure execution_audit consumed_inputs must match request_admission_result derived refs"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(failureRequestAdmission) &&
      isCanonicalExecutionAudit(failureDetailsExecutionAudit) &&
      !compatibilityRefsMatchAdmissionRefs(failureRequestAdmission, failureDetailsExecutionAudit)
    ) {
      blockers.push(
        blocker(
          "failure_compatibility_refs_mismatch",
          "canonical_consistency",
          `failure.${failureDetails?.path ?? "details"}.execution_audit.compatibility_refs`,
          "failure execution_audit compatibility_refs must match request_admission_result derived refs"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(failureRequestAdmission) &&
      isCanonicalExecutionAudit(failureDetailsExecutionAudit) &&
      !gateRunMatchesAdmissionGateInput(failureRequestAdmission, failureDetailsExecutionAudit)
    ) {
      blockers.push(
        blocker(
          "failure_gate_run_mismatch",
          "canonical_consistency",
          `failure.${failureDetails?.path ?? "details"}.execution_audit.compatibility_refs.gate_run_id`,
          "failure execution_audit gate_run_id must match request_admission_result derived_from.gate_input_ref"
        )
      );
    }

    if (
      isCanonicalRequestAdmissionResult(failureRequestAdmission) &&
      isCanonicalExecutionAudit(failureDetailsExecutionAudit) &&
      !gateRefsMatchExpectedRunId(failureRequestAdmission, failureDetailsExecutionAudit, expectedRunId)
    ) {
      blockers.push(
        blocker(
          "failure_gate_run_mismatch",
          "canonical_consistency",
          `failure.${failureDetails?.path ?? "details"}.execution_audit.compatibility_refs.gate_run_id`,
          "failure execution_audit gate refs must match the current run id"
        )
      );
    }

    if (
      !isCanonicalRequestAdmissionResult(failureRequestAdmission) &&
      isCanonicalExecutionAudit(failureDetailsExecutionAudit) &&
      !auditGateRunMatchesExpectedRunId(failureDetailsExecutionAudit, expectedRunId)
    ) {
      blockers.push(
        blocker(
          "failure_gate_run_mismatch",
          "canonical_consistency",
          `failure.${failureDetails?.path ?? "details"}.execution_audit.compatibility_refs.gate_run_id`,
          "failure execution_audit gate_run_id must match the current run id"
        )
      );
    }
  }

  for (const path of successLeakPaths) {
    blockers.push(
      blocker(
        "execution_audit_in_observability",
        "observability_boundary",
        path,
        "execution_audit must not be exposed through success observability"
      )
    );
  }

  for (const path of failureLeakPaths) {
    blockers.push(
      blocker(
        "execution_audit_in_observability",
        "observability_boundary",
        path,
        "execution_audit must not be exposed through failure observability"
      )
    );
  }

  return {
    decision: blockers.length === 0 ? "PASS" : "FAIL",
    passed: blockers.length === 0,
    blockers,
    success: {
      checked: !!input.success,
      has_summary: successSummary !== null,
      has_request_admission_result: successRequestAdmissionResult !== null,
      has_execution_audit: successExecutionAudit !== null,
      request_ref: asNonEmptyString(successRequestAdmissionResult?.request_ref),
      admission_decision: asNonEmptyString(successRequestAdmissionResult?.admission_decision),
      audit_ref: asNonEmptyString(successExecutionAudit?.audit_ref)
    },
    failure: {
      checked: !!input.failure,
      details_path: failureDetails?.path ?? null,
      has_details: failureDetails?.details !== null && failureDetails?.details !== undefined,
      has_execution_audit: failureDetailsExecutionAudit !== null,
      audit_ref: asNonEmptyString(failureDetailsExecutionAudit?.audit_ref),
      canonical_source_path: failureCanonicalAudit?.path ?? null
    },
    observability: {
      success_leak_paths: successLeakPaths,
      failure_leak_paths: failureLeakPaths
    }
  };
};
