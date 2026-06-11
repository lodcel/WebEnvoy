export const XHS_CLOSEOUT_EVIDENCE_CONTRACT_VERSION = "xhs_closeout_evidence_boundary.v1";

export const XHS_CLOSEOUT_PROVIDER_EVIDENCE_BASE_REFS = [
  "FR-0033.browser_provider_contract.v1",
  "FR-0037.launch_envelope.v1"
] as const;

export const XHS_CLOSEOUT_REQUIRED_ROUTE_FIELDS = [
  "route_role",
  "path_kind",
  "evidence_status",
  "evidence_class",
  "route_evidence_class",
  "method",
  "endpoint",
  "status_code",
  "head_sha",
  "run_id",
  "artifact_identity",
  "profile_ref",
  "session_id",
  "target_tab_id",
  "page_url",
  "action_ref",
  "consumed_template"
] as const;

export const XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS = [
  "provider_contract_ref",
  "launch_envelope_ref",
  "profile_binding_ref",
  "extension_binding_ref",
  "native_messaging_binding_ref",
  "runtime_observation_ref",
  "closeout_artifact_ref"
] as const;

export type XhsCloseoutOperation = "xhs.search" | "xhs.detail" | "xhs.user_home";

export type XhsCloseoutEvidenceBoundaryBlockerCode =
  | "invalid_operation"
  | "missing_route_evidence"
  | "unsupported_route_evidence_class"
  | "missing_route_field"
  | "missing_route_timestamp"
  | "missing_provider_evidence_record"
  | "provider_evidence_contract_version_mismatch"
  | "provider_evidence_scope_invalid"
  | "provider_evidence_base_ref_missing"
  | "provider_evidence_closeout_denied"
  | "provider_evidence_kind_missing"
  | "provider_evidence_ref_unavailable"
  | "provider_evidence_freshness_stale"
  | "provider_evidence_redaction_invalid"
  | "raw_sensitive_value_detected";

export type XhsCloseoutEvidenceBoundaryBlockerLayer =
  | "route"
  | "provider_evidence"
  | "redaction";

export interface XhsCloseoutEvidenceBoundaryInput {
  operation: XhsCloseoutOperation | string | null;
  route_evidence: Record<string, unknown> | null;
  provider_evidence_record: Record<string, unknown> | null;
}

export interface XhsCloseoutEvidenceBoundaryEvaluation {
  contract_version: typeof XHS_CLOSEOUT_EVIDENCE_CONTRACT_VERSION;
  valid: boolean;
  operation: string | null;
  route_evidence_class: string | null;
  provider_evidence_scope: string | null;
  missing_route_fields: string[];
  missing_provider_evidence_kinds: string[];
  redaction_gaps: string[];
  forbidden_disclosures: string[];
  blockers: Array<{
    blocker_code: XhsCloseoutEvidenceBoundaryBlockerCode;
    blocker_layer: XhsCloseoutEvidenceBoundaryBlockerLayer;
    field: string | null;
    message: string;
  }>;
}

const allowedOperations = new Set<string>(["xhs.search", "xhs.detail", "xhs.user_home"]);
const allowedRouteEvidenceClass = "passive_api_capture";
const acceptableFreshness = new Set<string>(["current_pr_head", "current_launch", "current_record"]);
const redactedStates = new Set<string>(["redacted", "not_required"]);
const sensitiveStates = new Set<string>(["sensitive", "secret"]);
const invalidRedactionStates = new Set<string>(["redaction_required", "policy_missing", "invalid"]);
const redactedValuePattern = /^(?:\[redacted\]|<redacted(?::[^>]+)?>|.*:redacted)$/iu;
const rawPrivatePathPatterns = [
  /\/Users\/[^/\s]+/u,
  /\/home\/[^/\s]+/u,
  /C:\\Users\\/iu,
  /\/private\/var\//iu
];
const rawSecretValuePatterns = [
  /xsec_token=/iu,
  /(?:^|[;&\s])a1=[^;&\s]+/iu,
  /web_session=[^;&\s]+/iu,
  /authorization:\s*bearer\s+\S+/iu,
  /cookie:\s*\S+/iu,
  /x-s-common/i,
  /api[_-]?key\s*[:=]\s*\S+/iu
];
const secretKeyPattern = /(?:^|\.)(?:cookie|authorization|xsec_token|token|api[_-]?key|secret|x-s|x-t|x-s-common)(?:$|\.)/iu;
const forbiddenRawPayloadPathPattern = /(?:^|\.)(?:request|response)\.(?:headers|body)(?:$|\.)/iu;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hasValue = (value: unknown): boolean => {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

const isRedactedValue = (value: string): boolean => redactedValuePattern.test(value.trim());

const blocker = (
  blocker_code: XhsCloseoutEvidenceBoundaryBlockerCode,
  blocker_layer: XhsCloseoutEvidenceBoundaryBlockerLayer,
  field: string | null,
  message: string
): XhsCloseoutEvidenceBoundaryEvaluation["blockers"][number] => ({
  blocker_code,
  blocker_layer,
  field,
  message
});

const collectStringDisclosures = (
  value: unknown,
  path: string,
  disclosures: string[]
): void => {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0 || isRedactedValue(normalized)) {
      return;
    }
    if (
      secretKeyPattern.test(path) ||
      forbiddenRawPayloadPathPattern.test(path) ||
      rawPrivatePathPatterns.some((pattern) => pattern.test(normalized)) ||
      rawSecretValuePatterns.some((pattern) => pattern.test(normalized))
    ) {
      disclosures.push(path);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStringDisclosures(item, `${path}[${index}]`, disclosures));
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }
  for (const [key, nested] of Object.entries(record)) {
    collectStringDisclosures(nested, path.length > 0 ? `${path}.${key}` : key, disclosures);
  }
};

const getEvidenceRefs = (providerEvidenceRecord: Record<string, unknown> | null): Record<string, unknown>[] =>
  asArray(providerEvidenceRecord?.evidence_refs).filter(
    (item): item is Record<string, unknown> => asRecord(item) !== null
  );

const evaluateProviderEvidence = (
  providerEvidenceRecord: Record<string, unknown> | null,
  blockers: XhsCloseoutEvidenceBoundaryEvaluation["blockers"],
  missingProviderEvidenceKinds: string[],
  redactionGaps: string[]
): string | null => {
  if (!providerEvidenceRecord) {
    blockers.push(
      blocker(
        "missing_provider_evidence_record",
        "provider_evidence",
        "provider_evidence_record",
        "XHS closeout evidence requires an FR-0040 provider evidence record"
      )
    );
    return null;
  }

  const identity = asRecord(providerEvidenceRecord.identity);
  const providerEvidenceScope = normalizeString(identity?.evidence_scope);
  if (identity?.provider_evidence_contract_version !== "v1") {
    blockers.push(
      blocker(
        "provider_evidence_contract_version_mismatch",
        "provider_evidence",
        "provider_evidence_record.identity.provider_evidence_contract_version",
        "provider evidence must use FR-0040 contract version v1"
      )
    );
  }
  if (providerEvidenceScope !== "capability_closeout") {
    blockers.push(
      blocker(
        "provider_evidence_scope_invalid",
        "provider_evidence",
        "provider_evidence_record.identity.evidence_scope",
        "XHS operation closeout evidence must use capability_closeout scope"
      )
    );
  }

  const baseRefs = asArray(identity?.base_refs)
    .map((item) => normalizeString(item))
    .filter((item): item is string => item !== null);
  for (const requiredBaseRef of XHS_CLOSEOUT_PROVIDER_EVIDENCE_BASE_REFS) {
    if (!baseRefs.includes(requiredBaseRef)) {
      blockers.push(
        blocker(
          "provider_evidence_base_ref_missing",
          "provider_evidence",
          "provider_evidence_record.identity.base_refs",
          `provider evidence base_refs must include ${requiredBaseRef}`
        )
      );
    }
  }

  const closeoutPlan = asRecord(providerEvidenceRecord.closeout_plan);
  const closeoutDecision = normalizeString(closeoutPlan?.closeout_decision);
  const closeoutBlockingReasons = asArray(closeoutPlan?.blocking_reasons);
  const closeoutRedactionGaps = asArray(closeoutPlan?.redaction_gaps)
    .map((item) => normalizeString(item))
    .filter((item): item is string => item !== null);
  redactionGaps.push(...closeoutRedactionGaps);
  if (closeoutDecision !== "allow" || closeoutBlockingReasons.length > 0) {
    blockers.push(
      blocker(
        "provider_evidence_closeout_denied",
        "provider_evidence",
        "provider_evidence_record.closeout_plan",
        "provider evidence closeout_plan must allow the XHS operation closeout"
      )
    );
  }

  const evidenceRefs = getEvidenceRefs(providerEvidenceRecord);
  const availableKinds = new Set(
    evidenceRefs
      .filter((ref) => normalizeString(ref.status) === "available")
      .map((ref) => normalizeString(ref.kind))
      .filter((kind): kind is string => kind !== null)
  );
  for (const requiredKind of XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS) {
    if (!availableKinds.has(requiredKind)) {
      missingProviderEvidenceKinds.push(requiredKind);
      blockers.push(
        blocker(
          "provider_evidence_kind_missing",
          "provider_evidence",
          `provider_evidence_record.evidence_refs.${requiredKind}`,
          `provider evidence is missing available ${requiredKind}`
        )
      );
    }
  }

  for (const ref of evidenceRefs) {
    const field = `provider_evidence_record.evidence_refs.${normalizeString(ref.evidence_ref_id) ?? "unknown"}`;
    const status = normalizeString(ref.status);
    const freshness = normalizeString(ref.freshness);
    const sensitivity = normalizeString(ref.sensitivity);
    const redactionState = normalizeString(ref.redaction_state);
    if (status !== "available" && XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS.includes(normalizeString(ref.kind) as never)) {
      blockers.push(
        blocker(
          "provider_evidence_ref_unavailable",
          "provider_evidence",
          field,
          "required provider evidence refs must be available"
        )
      );
    }
    if (freshness === null || !acceptableFreshness.has(freshness)) {
      blockers.push(
        blocker(
          "provider_evidence_freshness_stale",
          "provider_evidence",
          field,
          "required provider evidence refs must be current for this closeout boundary"
        )
      );
    }
    if (
      redactionState === null ||
      invalidRedactionStates.has(redactionState) ||
      (sensitivity !== null && sensitiveStates.has(sensitivity) && redactionState !== "redacted") ||
      (sensitivity === "public" && !redactedStates.has(redactionState))
    ) {
      const refId = normalizeString(ref.evidence_ref_id) ?? field;
      redactionGaps.push(refId);
      blockers.push(
        blocker(
          "provider_evidence_redaction_invalid",
          "redaction",
          field,
          "provider evidence required by XHS closeout must satisfy FR-0041 redaction"
        )
      );
    }
  }

  return providerEvidenceScope;
};

export const evaluateXhsCloseoutEvidenceBoundary = (
  input: XhsCloseoutEvidenceBoundaryInput
): XhsCloseoutEvidenceBoundaryEvaluation => {
  const blockers: XhsCloseoutEvidenceBoundaryEvaluation["blockers"] = [];
  const missingRouteFields: string[] = [];
  const missingProviderEvidenceKinds: string[] = [];
  const redactionGaps: string[] = [];
  const forbiddenDisclosures: string[] = [];
  const operation = normalizeString(input.operation);

  if (operation === null || !allowedOperations.has(operation)) {
    blockers.push(
      blocker(
        "invalid_operation",
        "route",
        "operation",
        "XHS closeout evidence operation must be xhs.search, xhs.detail, or xhs.user_home"
      )
    );
  }

  const routeEvidence = input.route_evidence;
  if (!routeEvidence) {
    blockers.push(
      blocker(
        "missing_route_evidence",
        "route",
        "route_evidence",
        "XHS closeout evidence requires a route_evidence object"
      )
    );
  } else {
    const routeEvidenceClass =
      normalizeString(routeEvidence.evidence_class) ??
      normalizeString(routeEvidence.route_evidence_class);
    if (routeEvidenceClass !== allowedRouteEvidenceClass) {
      blockers.push(
        blocker(
          "unsupported_route_evidence_class",
          "route",
          "route_evidence.evidence_class",
          "only passive_api_capture is admitted as the XHS operation closeout evidence boundary"
        )
      );
    }

    for (const requiredField of XHS_CLOSEOUT_REQUIRED_ROUTE_FIELDS) {
      if (!hasValue(routeEvidence[requiredField])) {
        missingRouteFields.push(requiredField);
        blockers.push(
          blocker(
            "missing_route_field",
            "route",
            `route_evidence.${requiredField}`,
            `route_evidence.${requiredField} is required for XHS operation closeout`
          )
        );
      }
    }

    if (!hasValue(routeEvidence.observed_at) && !hasValue(routeEvidence.captured_at)) {
      blockers.push(
        blocker(
          "missing_route_timestamp",
          "route",
          "route_evidence.observed_at",
          "route_evidence must include observed_at or captured_at"
        )
      );
    }
  }

  const providerEvidenceScope = evaluateProviderEvidence(
    input.provider_evidence_record,
    blockers,
    missingProviderEvidenceKinds,
    redactionGaps
  );

  collectStringDisclosures(routeEvidence, "route_evidence", forbiddenDisclosures);
  collectStringDisclosures(input.provider_evidence_record, "provider_evidence_record", forbiddenDisclosures);
  for (const disclosure of forbiddenDisclosures) {
    blockers.push(
      blocker(
        "raw_sensitive_value_detected",
        "redaction",
        disclosure,
        "XHS closeout evidence must not expose raw private paths, account-affine values, headers, tokens, cookies, or secrets"
      )
    );
  }

  const routeEvidenceClass =
    routeEvidence === null
      ? null
      : normalizeString(routeEvidence.evidence_class) ??
        normalizeString(routeEvidence.route_evidence_class);

  return {
    contract_version: XHS_CLOSEOUT_EVIDENCE_CONTRACT_VERSION,
    valid: blockers.length === 0,
    operation,
    route_evidence_class: routeEvidenceClass,
    provider_evidence_scope: providerEvidenceScope,
    missing_route_fields: Array.from(new Set(missingRouteFields)).sort(),
    missing_provider_evidence_kinds: Array.from(new Set(missingProviderEvidenceKinds)).sort(),
    redaction_gaps: Array.from(new Set(redactionGaps)).sort(),
    forbidden_disclosures: Array.from(new Set(forbiddenDisclosures)).sort(),
    blockers
  };
};
