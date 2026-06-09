export type ServiceWorkerCodeIdentityComparisonResult =
  | "match"
  | "observed_stale"
  | "observed_unknown"
  | "expected_identity_missing"
  | "observed_identity_missing"
  | "redaction_invalid"
  | "source_conflict";

export type ServiceWorkerLifecycleState =
  | "active_worker_observed"
  | "disk_script_cache_observed"
  | "registration_only"
  | "unavailable"
  | "source_missing"
  | "redaction_invalid";

export type ProviderDoctorCheckStatus = "pass" | "warn" | "fail" | "not_applicable" | "unknown";
export type ProviderDoctorCheckSeverity = "info" | "warning" | "error" | "fatal";
export type ProviderDoctorCheckBlocking = "none" | "capability_blocking" | "provider_blocking";

export interface ProviderDoctorEvidenceRef {
  kind: "extension_state_ref" | "doctor_artifact_ref";
  ref: string;
  status: "available" | "partial" | "unavailable" | "not_applicable";
  collected_at: string;
  sensitivity: "internal" | "sensitive";
}

export interface ProviderDoctorDiagnostic {
  code: string;
  observed: string | null;
  expected: string | null;
  remediation_hint: string | null;
}

export interface ProviderDoctorExtensionLoadCheck {
  check_id: "official_chrome_persistent_service_worker_freshness";
  category: "extension_load";
  status: ProviderDoctorCheckStatus;
  severity: ProviderDoctorCheckSeverity;
  blocking: ProviderDoctorCheckBlocking;
  capability_id: "N/A";
  summary: string;
  diagnostics: ProviderDoctorDiagnostic;
  evidence_refs: ProviderDoctorEvidenceRef[];
}

export interface ServiceWorkerCodeIdentityObservation {
  expected_extension_bundle_identity_locator: string | null;
  observed_active_service_worker_script_identity_locator: string | null;
  expected_bundle_digest_locator: string | null;
  observed_service_worker_code_digest_locator: string | null;
  background_service_worker_cache_identity_locator: string | null;
  background_service_worker_cache_digest_locator: string | null;
  active_worker_lifecycle_state: ServiceWorkerLifecycleState;
  freshness_comparison_result: ServiceWorkerCodeIdentityComparisonResult;
  remediation_hint: string | null;
  evidence_refs: ProviderDoctorEvidenceRef[];
  provider_doctor_extension_load_check: ProviderDoctorExtensionLoadCheck;
}

export interface ServiceWorkerCodeIdentityObservationInput {
  extensionId: string;
  expectedExtensionBundleIdentityLocator: string | null;
  observedActiveServiceWorkerScriptIdentityLocator: string | null;
  expectedBundleDigestLocator: string | null;
  observedServiceWorkerCodeDigestLocator: string | null;
  backgroundServiceWorkerCacheIdentityLocator?: string | null;
  backgroundServiceWorkerCacheDigestLocator?: string | null;
  activeWorkerLifecycleState: ServiceWorkerLifecycleState;
  observedAt?: string | null;
  remediationHint?: string | null;
  sourceConflict?: boolean;
  rawPathDenylist?: readonly (string | null | undefined)[];
}

const RAW_PATH_PATTERNS = [
  /(^|:)\/(?:Users|private|tmp|var|home)\//u,
  /^[A-Za-z]:[\\/]/u,
  /\\Users\\/u
];

const locatorHasRawPath = (locator: string, denylist: readonly string[]): boolean => {
  if (RAW_PATH_PATTERNS.some((pattern) => pattern.test(locator))) {
    return true;
  }
  return denylist.some((rawPath) => rawPath.length > 0 && locator.includes(rawPath));
};

const buildEvidenceRefs = (input: {
  extensionId: string;
  observedAt: string;
  status: ProviderDoctorEvidenceRef["status"];
}): ProviderDoctorEvidenceRef[] => [
  {
    kind: "extension_state_ref",
    ref: `provider-health/official-chrome.persistent/extension/${input.extensionId}/service-worker-code-identity`,
    status: input.status,
    collected_at: input.observedAt,
    sensitivity: "sensitive"
  },
  {
    kind: "doctor_artifact_ref",
    ref: `doctor-artifact/official-chrome.persistent/service-worker-freshness/${input.extensionId}`,
    status: input.status,
    collected_at: input.observedAt,
    sensitivity: "internal"
  }
];

const comparisonDiagnosticCode = (
  comparison: ServiceWorkerCodeIdentityComparisonResult
): string => {
  switch (comparison) {
    case "match":
      return "service_worker_fresh";
    case "observed_stale":
      return "service_worker_stale";
    case "observed_unknown":
      return "service_worker_identity_unknown";
    case "expected_identity_missing":
      return "service_worker_expected_identity_missing";
    case "observed_identity_missing":
      return "service_worker_observed_identity_missing";
    case "redaction_invalid":
      return "service_worker_evidence_redaction_invalid";
    case "source_conflict":
      return "service_worker_source_conflict";
  }
};

const mapComparisonToDoctorCheck = (input: {
  comparison: ServiceWorkerCodeIdentityComparisonResult;
  expectedDigest: string | null;
  observedDigest: string | null;
  remediationHint: string | null;
  evidenceRefs: ProviderDoctorEvidenceRef[];
}): ProviderDoctorExtensionLoadCheck => {
  let status: ProviderDoctorCheckStatus = "unknown";
  let severity: ProviderDoctorCheckSeverity = "error";
  let blocking: ProviderDoctorCheckBlocking = "provider_blocking";
  let summary = "official Chrome persistent extension Service Worker code identity is unknown";

  if (input.comparison === "match") {
    status = "pass";
    severity = "info";
    blocking = "none";
    summary = "official Chrome persistent extension Service Worker code identity matches expected bundle";
  } else if (input.comparison === "expected_identity_missing") {
    status = "fail";
    severity = "fatal";
    summary = "official Chrome persistent extension expected bundle identity is missing";
  } else if (
    input.comparison === "observed_stale" ||
    input.comparison === "redaction_invalid" ||
    input.comparison === "source_conflict"
  ) {
    status = "fail";
    severity = "error";
    summary = "official Chrome persistent extension Service Worker code identity is not admissible";
  }

  return {
    check_id: "official_chrome_persistent_service_worker_freshness",
    category: "extension_load",
    status,
    severity,
    blocking,
    capability_id: "N/A",
    summary,
    diagnostics: {
      code: comparisonDiagnosticCode(input.comparison),
      observed: input.observedDigest,
      expected: input.expectedDigest,
      remediation_hint: input.remediationHint
    },
    evidence_refs: input.evidenceRefs
  };
};

export const evaluateServiceWorkerCodeIdentityObservation = (
  input: ServiceWorkerCodeIdentityObservationInput
): ServiceWorkerCodeIdentityObservation => {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const rawPathDenylist = input.rawPathDenylist
    ?.filter((value): value is string => typeof value === "string" && value.length > 0) ?? [];
  const locators = [
    input.expectedExtensionBundleIdentityLocator,
    input.observedActiveServiceWorkerScriptIdentityLocator,
    input.expectedBundleDigestLocator,
    input.observedServiceWorkerCodeDigestLocator,
    input.backgroundServiceWorkerCacheIdentityLocator,
    input.backgroundServiceWorkerCacheDigestLocator
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const redactionInvalid = locators.some((locator) =>
    locatorHasRawPath(locator, rawPathDenylist)
  );

  let comparison: ServiceWorkerCodeIdentityComparisonResult;
  if (redactionInvalid) {
    comparison = "redaction_invalid";
  } else if (
    !input.expectedExtensionBundleIdentityLocator ||
    !input.expectedBundleDigestLocator
  ) {
    comparison = "expected_identity_missing";
  } else if (
    !input.observedActiveServiceWorkerScriptIdentityLocator ||
    !input.observedServiceWorkerCodeDigestLocator
  ) {
    comparison = "observed_identity_missing";
  } else if (input.activeWorkerLifecycleState !== "active_worker_observed") {
    comparison = "observed_unknown";
  } else if (input.sourceConflict === true) {
    comparison = "source_conflict";
  } else {
    comparison =
      input.expectedBundleDigestLocator === input.observedServiceWorkerCodeDigestLocator
        ? "match"
        : "observed_stale";
  }

  const evidenceStatus: ProviderDoctorEvidenceRef["status"] =
    comparison === "match"
      ? "available"
      : comparison === "observed_unknown" || comparison === "observed_identity_missing"
        ? "unavailable"
        : "partial";
  const evidenceRefs = buildEvidenceRefs({
    extensionId: input.extensionId,
    observedAt,
    status: evidenceStatus
  });
  const lifecycleState = redactionInvalid
    ? "redaction_invalid"
    : input.activeWorkerLifecycleState;

  return {
    expected_extension_bundle_identity_locator: input.expectedExtensionBundleIdentityLocator,
    observed_active_service_worker_script_identity_locator:
      input.observedActiveServiceWorkerScriptIdentityLocator,
    expected_bundle_digest_locator: input.expectedBundleDigestLocator,
    observed_service_worker_code_digest_locator: input.observedServiceWorkerCodeDigestLocator,
    background_service_worker_cache_identity_locator:
      input.backgroundServiceWorkerCacheIdentityLocator ?? null,
    background_service_worker_cache_digest_locator:
      input.backgroundServiceWorkerCacheDigestLocator ?? null,
    active_worker_lifecycle_state: lifecycleState,
    freshness_comparison_result: comparison,
    remediation_hint: input.remediationHint ?? null,
    evidence_refs: evidenceRefs,
    provider_doctor_extension_load_check: mapComparisonToDoctorCheck({
      comparison,
      expectedDigest: input.expectedBundleDigestLocator,
      observedDigest: input.observedServiceWorkerCodeDigestLocator,
      remediationHint: input.remediationHint ?? null,
      evidenceRefs
    })
  };
};
