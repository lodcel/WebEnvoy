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
  | "route_role_invalid"
  | "route_path_kind_invalid"
  | "route_evidence_status_invalid"
  | "route_http_status_invalid"
  | "route_binding_invalid"
  | "missing_provider_evidence_record"
  | "provider_evidence_shape_invalid"
  | "provider_evidence_contract_version_mismatch"
  | "provider_evidence_scope_invalid"
  | "provider_evidence_base_ref_missing"
  | "provider_evidence_closeout_denied"
  | "provider_evidence_kind_missing"
  | "provider_evidence_ref_unavailable"
  | "provider_evidence_freshness_stale"
  | "provider_evidence_binding_mismatch"
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
const routeBindings: Record<
  XhsCloseoutOperation,
  {
    routes: readonly string[];
    endpoint: string;
    method: string;
    pagePathPattern: RegExp;
  }
> = {
  "xhs.search": {
    routes: ["xhs.search", "xhs.search.api"],
    endpoint: "/api/sns/web/v1/search/notes",
    method: "POST",
    pagePathPattern: /^\/search_result(?:\/)?$/u
  },
  "xhs.detail": {
    routes: ["xhs.detail", "xhs.detail.api"],
    endpoint: "/api/sns/web/v1/feed",
    method: "POST",
    pagePathPattern: /^\/explore\/[^/?#]+$/u
  },
  "xhs.user_home": {
    routes: ["xhs.user_home", "xhs.user_home.api"],
    endpoint: "/api/sns/web/v1/user_posted",
    method: "GET",
    pagePathPattern: /^\/user\/profile\/[^/?#]+$/u
  }
};
const acceptableFreshness = new Set<string>(["current_pr_head", "current_launch", "current_record"]);
const freshnessRank: Record<string, number> = {
  current_record: 1,
  current_launch: 2,
  current_pr_head: 3
};
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
const requiredProviderEvidenceRecordSections = [
  "identity",
  "selected_provider",
  "version_evidence",
  "launch_arguments",
  "profile_reference",
  "extension_status",
  "native_messaging_status",
  "evidence_refs",
  "closeout_plan"
] as const;
const requiredProviderEvidenceRecordFields: Record<string, readonly string[]> = {
  identity: [
    "provider_evidence_record_id",
    "provider_evidence_contract_version",
    "run_id",
    "command_ref",
    "created_at",
    "evidence_scope",
    "base_refs"
  ],
  selected_provider: [
    "provider_id",
    "provider_contract_ref",
    "provider_contract_version",
    "provider_mode",
    "selection_reason",
    "selection_source",
    "selection_evidence_refs"
  ],
  version_evidence: [
    "provider_version",
    "browser_channel",
    "browser_version",
    "extension_version",
    "native_host_version",
    "contract_version",
    "version_evidence_refs"
  ],
  launch_arguments: [
    "launch_envelope_ref",
    "launch_envelope_version",
    "provider_launch_ref",
    "browser_mode",
    "runtime_bindings",
    "launch_argument_evidence_refs"
  ],
  profile_reference: [
    "profile_ref",
    "profile_binding_mode",
    "profile_lock_status",
    "login_state_evidence",
    "profile_persistence_status",
    "profile_evidence_refs"
  ],
  extension_status: [
    "extension_required",
    "extension_binding_mode",
    "extension_version",
    "extension_installation_status",
    "extension_runtime_status",
    "extension_evidence_refs"
  ],
  native_messaging_status: [
    "native_messaging_required",
    "native_host_version",
    "native_messaging_runtime_status",
    "native_messaging_evidence_refs"
  ],
  closeout_plan: [
    "required_evidence_kinds",
    "required_freshness",
    "minimum_attestation_level",
    "coverage_status",
    "blocking_reasons",
    "missing_evidence",
    "redaction_gaps",
    "next_required_gates",
    "closeout_decision"
  ]
};
const providerSectionEvidenceRefFields: Record<string, readonly string[]> = {
  selected_provider: ["selection_evidence_refs"],
  version_evidence: ["version_evidence_refs"],
  launch_arguments: ["launch_argument_evidence_refs"],
  profile_reference: ["profile_evidence_refs"],
  extension_status: ["extension_evidence_refs"],
  native_messaging_status: ["native_messaging_evidence_refs"]
};

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

const hasOwnField = (record: Record<string, unknown>, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, field);

const normalizeHttpMethod = (value: unknown): string | null => {
  const method = normalizeString(value);
  return method === null ? null : method.toUpperCase();
};

const normalizeStatusCode = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  const text = normalizeString(value);
  if (text === null || !/^\d+$/u.test(text)) {
    return null;
  }
  const parsed = Number.parseInt(text, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const normalizePathname = (value: unknown): string | null => {
  const raw = normalizeString(value);
  if (raw === null) {
    return null;
  }
  try {
    return new URL(raw, "https://www.xiaohongshu.com").pathname;
  } catch {
    const [withoutQuery] = raw.split(/[?#]/u, 1);
    return withoutQuery.startsWith("/") ? withoutQuery : null;
  }
};

const normalizePageUrl = (value: unknown): URL | null => {
  const raw = normalizeString(value);
  if (raw === null) {
    return null;
  }
  try {
    return new URL(raw);
  } catch {
    return null;
  }
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

const freshnessSatisfies = (freshness: string | null, requiredFreshness: string | null): boolean => {
  if (
    freshness === null ||
    requiredFreshness === null ||
    !acceptableFreshness.has(freshness) ||
    !acceptableFreshness.has(requiredFreshness)
  ) {
    return false;
  }
  return freshnessRank[freshness] >= freshnessRank[requiredFreshness];
};

const validateProviderEvidenceShape = (
  providerEvidenceRecord: Record<string, unknown>,
  blockers: XhsCloseoutEvidenceBoundaryEvaluation["blockers"]
): void => {
  const topLevelEvidenceRefIds = new Set(
    getEvidenceRefs(providerEvidenceRecord)
      .map((ref) => normalizeString(ref.evidence_ref_id))
      .filter((refId): refId is string => refId !== null)
  );

  for (const sectionName of requiredProviderEvidenceRecordSections) {
    if (sectionName === "evidence_refs") {
      if (!Array.isArray(providerEvidenceRecord.evidence_refs)) {
        blockers.push(
          blocker(
            "provider_evidence_shape_invalid",
            "provider_evidence",
            "provider_evidence_record.evidence_refs",
            "FR-0040 provider evidence record must include evidence_refs"
          )
        );
      }
      continue;
    }

    const section = asRecord(providerEvidenceRecord[sectionName]);
    if (section === null) {
      blockers.push(
        blocker(
          "provider_evidence_shape_invalid",
          "provider_evidence",
          `provider_evidence_record.${sectionName}`,
          `FR-0040 provider evidence record must include ${sectionName}`
        )
      );
      continue;
    }

    for (const field of requiredProviderEvidenceRecordFields[sectionName] ?? []) {
      if (!hasOwnField(section, field) || !hasValue(section[field])) {
        blockers.push(
          blocker(
            "provider_evidence_shape_invalid",
            "provider_evidence",
            `provider_evidence_record.${sectionName}.${field}`,
            `FR-0040 provider evidence record is missing ${sectionName}.${field}`
          )
        );
      }
    }

    for (const evidenceRefField of providerSectionEvidenceRefFields[sectionName] ?? []) {
      const sectionRefIds = asArray(section[evidenceRefField])
        .map((item) => normalizeString(item))
        .filter((item): item is string => item !== null);
      if (sectionRefIds.length === 0) {
        blockers.push(
          blocker(
            "provider_evidence_shape_invalid",
            "provider_evidence",
            `provider_evidence_record.${sectionName}.${evidenceRefField}`,
            `FR-0040 ${sectionName}.${evidenceRefField} must reference top-level evidence_refs`
          )
        );
        continue;
      }

      for (const sectionRefId of sectionRefIds) {
        if (!topLevelEvidenceRefIds.has(sectionRefId)) {
          blockers.push(
            blocker(
              "provider_evidence_shape_invalid",
              "provider_evidence",
              `provider_evidence_record.${sectionName}.${evidenceRefField}`,
              `FR-0040 ${sectionName}.${evidenceRefField} entry ${sectionRefId} must resolve in top-level evidence_refs`
            )
          );
        }
      }
    }
  }
};

const evaluateRouteSemantics = (
  operation: string | null,
  routeEvidence: Record<string, unknown>,
  blockers: XhsCloseoutEvidenceBoundaryEvaluation["blockers"]
): void => {
  if (normalizeString(routeEvidence.route_role) !== "primary") {
    blockers.push(
      blocker(
        "route_role_invalid",
        "route",
        "route_evidence.route_role",
        "XHS closeout route evidence must describe the primary route"
      )
    );
  }

  if (normalizeString(routeEvidence.path_kind) !== "api") {
    blockers.push(
      blocker(
        "route_path_kind_invalid",
        "route",
        "route_evidence.path_kind",
        "XHS closeout route evidence must describe an API path"
      )
    );
  }

  if (normalizeString(routeEvidence.evidence_status) !== "success") {
    blockers.push(
      blocker(
        "route_evidence_status_invalid",
        "route",
        "route_evidence.evidence_status",
        "XHS closeout route evidence must report success"
      )
    );
  }

  const statusCode = normalizeStatusCode(routeEvidence.status_code);
  if (statusCode === null || statusCode < 200 || statusCode > 299) {
    blockers.push(
      blocker(
        "route_http_status_invalid",
        "route",
        "route_evidence.status_code",
        "XHS closeout route evidence must carry 2xx HTTP response semantics"
      )
    );
  }

  if (operation === null || !allowedOperations.has(operation)) {
    return;
  }

  const routeBinding = routeBindings[operation as XhsCloseoutOperation];
  const routeId = normalizeString(routeEvidence.route ?? routeEvidence.route_id);
  if (routeId === null || !routeBinding.routes.includes(routeId)) {
    blockers.push(
      blocker(
        "route_binding_invalid",
        "route",
        "route_evidence.route",
        `XHS closeout route evidence must bind ${operation} to its route id`
      )
    );
  }

  const endpointPath = normalizePathname(routeEvidence.endpoint ?? routeEvidence.request_url);
  if (endpointPath !== routeBinding.endpoint) {
    blockers.push(
      blocker(
        "route_binding_invalid",
        "route",
        "route_evidence.endpoint",
        `XHS closeout route evidence must bind ${operation} to ${routeBinding.endpoint}`
      )
    );
  }

  if (normalizeHttpMethod(routeEvidence.method) !== routeBinding.method) {
    blockers.push(
      blocker(
        "route_binding_invalid",
        "route",
        "route_evidence.method",
        `XHS closeout route evidence must bind ${operation} to ${routeBinding.method}`
      )
    );
  }

  const pageUrl = normalizePageUrl(routeEvidence.page_url);
  if (
    pageUrl === null ||
    pageUrl.hostname !== "www.xiaohongshu.com" ||
    !routeBinding.pagePathPattern.test(pageUrl.pathname)
  ) {
    blockers.push(
      blocker(
        "route_binding_invalid",
        "route",
        "route_evidence.page_url",
        `XHS closeout route evidence page_url must match the ${operation} page shape`
      )
    );
  }
};

const evaluateProviderEvidence = (
  providerEvidenceRecord: Record<string, unknown> | null,
  operation: string | null,
  routeEvidence: Record<string, unknown> | null,
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

  validateProviderEvidenceShape(providerEvidenceRecord, blockers);

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
  const requiredFreshness = normalizeString(closeoutPlan?.required_freshness);
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
  const routeRunId = normalizeString(routeEvidence?.run_id);
  const routeArtifactIdentity = normalizeString(routeEvidence?.artifact_identity);
  const providerRunId = normalizeString(identity?.run_id);
  const providerCommandRef = normalizeString(identity?.command_ref);
  if (routeRunId !== null && providerRunId !== routeRunId) {
    blockers.push(
      blocker(
        "provider_evidence_binding_mismatch",
        "provider_evidence",
        "provider_evidence_record.identity.run_id",
        "provider evidence record must bind to the same run_id as route_evidence"
      )
    );
  }
  if (operation !== null && allowedOperations.has(operation) && providerCommandRef !== operation) {
    blockers.push(
      blocker(
        "provider_evidence_binding_mismatch",
        "provider_evidence",
        "provider_evidence_record.identity.command_ref",
        "provider evidence record command_ref must bind to the requested XHS operation"
      )
    );
  }

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
    const kind = normalizeString(ref.kind);
    const requiredForCloseout =
      kind !== null && XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS.includes(kind as never);
    const status = normalizeString(ref.status);
    const freshness = normalizeString(ref.freshness);
    const sensitivity = normalizeString(ref.sensitivity);
    const redactionState = normalizeString(ref.redaction_state);
    if (!requiredForCloseout) {
      continue;
    }
    if (status !== "available") {
      blockers.push(
        blocker(
          "provider_evidence_ref_unavailable",
          "provider_evidence",
          field,
          "required provider evidence refs must be available"
        )
      );
    }
    if (!freshnessSatisfies(freshness, requiredFreshness)) {
      blockers.push(
        blocker(
          "provider_evidence_freshness_stale",
          "provider_evidence",
          field,
          "required provider evidence refs must satisfy closeout_plan.required_freshness"
        )
      );
    }
    if (
      redactionState === null ||
      invalidRedactionStates.has(redactionState) ||
      (redactionState === "not_required" && sensitivity !== "public") ||
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

  const availableCloseoutArtifactRefs = evidenceRefs.filter(
    (ref) =>
      normalizeString(ref.kind) === "closeout_artifact_ref" &&
      normalizeString(ref.status) === "available"
  );
  if (
    routeArtifactIdentity !== null &&
    availableCloseoutArtifactRefs.length > 0 &&
    !availableCloseoutArtifactRefs.some(
      (ref) =>
        normalizeString(ref.artifact_identity) === routeArtifactIdentity ||
        normalizeString(ref.ref) === routeArtifactIdentity
    )
  ) {
    blockers.push(
      blocker(
        "provider_evidence_binding_mismatch",
        "provider_evidence",
        "provider_evidence_record.evidence_refs.closeout_artifact_ref",
        "provider closeout_artifact_ref must bind to route_evidence.artifact_identity"
      )
    );
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
    const evidenceClass = normalizeString(routeEvidence.evidence_class);
    const routeEvidenceClass = normalizeString(routeEvidence.route_evidence_class);
    if (evidenceClass !== allowedRouteEvidenceClass) {
      blockers.push(
        blocker(
          "unsupported_route_evidence_class",
          "route",
          "route_evidence.evidence_class",
          "only passive_api_capture is admitted as the XHS operation closeout evidence boundary"
        )
      );
    }
    if (routeEvidenceClass !== allowedRouteEvidenceClass) {
      blockers.push(
        blocker(
          "unsupported_route_evidence_class",
          "route",
          "route_evidence.route_evidence_class",
          "only passive_api_capture route evidence is admitted as the XHS operation closeout evidence boundary"
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

    evaluateRouteSemantics(operation, routeEvidence, blockers);
  }

  const providerEvidenceScope = evaluateProviderEvidence(
    input.provider_evidence_record,
    operation,
    routeEvidence,
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
