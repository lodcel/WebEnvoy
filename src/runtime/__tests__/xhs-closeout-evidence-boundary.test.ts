import { describe, expect, it } from "vitest";

import {
  evaluateXhsCloseoutEvidenceBoundary,
  XHS_CLOSEOUT_EVIDENCE_CONTRACT_VERSION,
  XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS,
  XHS_CLOSEOUT_REQUIRED_ROUTE_FIELDS
} from "../xhs-closeout-evidence-boundary.js";

const createdAt = "2026-06-11T00:00:00Z";
const currentPrHeadSha = "head-xhs-closeout-boundary-current-001";
const staleMergeBaseHeadSha = "898b8b4015ac5644d3971b72dc67d9a90436363a";

const routeShapeByOperation = {
  "xhs.search": {
    route: "xhs.search.api",
    method: "POST",
    endpoint: "/api/sns/web/v1/search/notes",
    page_url: "https://www.xiaohongshu.com/search_result?keyword=closeout",
    shape_key: "xhs.search:POST:/api/sns/web/v1/search/notes:closeout"
  },
  "xhs.detail": {
    route: "xhs.detail.api",
    method: "POST",
    endpoint: "/api/sns/web/v1/feed",
    page_url: "https://www.xiaohongshu.com/explore/note-closeout-001",
    shape_key: "xhs.detail:POST:/api/sns/web/v1/feed:note-closeout-001"
  },
  "xhs.user_home": {
    route: "xhs.user_home.api",
    method: "GET",
    endpoint: "/api/sns/web/v1/user_posted",
    page_url: "https://www.xiaohongshu.com/user/profile/user-closeout-001",
    shape_key: "xhs.user_home:GET:/api/sns/web/v1/user_posted:user-closeout-001"
  }
} as const;

const baseRouteEvidence = (
  operation: keyof typeof routeShapeByOperation = "xhs.detail"
): Record<string, unknown> => ({
  route: routeShapeByOperation[operation].route,
  route_role: "primary",
  path_kind: "api",
  evidence_status: "success",
  evidence_class: "passive_api_capture",
  route_evidence_class: "passive_api_capture",
  source_kind: "page_request",
  method: routeShapeByOperation[operation].method,
  endpoint: routeShapeByOperation[operation].endpoint,
  request_url: routeShapeByOperation[operation].endpoint,
  status_code: 200,
  head_sha: currentPrHeadSha,
  run_id: "run-xhs-closeout-boundary-001",
  artifact_identity: "artifact:xhs-closeout:run-xhs-closeout-boundary-001:round-1",
  profile_ref: "profile-ref:xhs:redacted",
  session_id: "session-ref:xhs:redacted",
  target_tab_id: 42,
  page_url: routeShapeByOperation[operation].page_url,
  action_ref: "read",
  observed_at: 1_780_000_000_000,
  captured_at: 1_780_000_000_000,
  consumed_template: {
    route_evidence_class: "passive_api_capture",
    source_kind: "page_request",
    template_identity: "captured:run-xhs-closeout-boundary-001:detail:shape:1780000000000",
    profile_ref: "profile-ref:xhs:redacted",
    session_id: "session-ref:xhs:redacted",
    target_tab_id: 42,
    run_id: "run-xhs-closeout-boundary-001",
    action_ref: "read",
    page_url: routeShapeByOperation[operation].page_url,
    observed_at: 1_780_000_000_000,
    captured_at: 1_780_000_000_000,
    freshness_window_ms: 300_000,
    template_age_ms: 0,
    page_context_namespace: `${operation}:profile-ref:xhs:redacted:42`,
    shape_key: routeShapeByOperation[operation].shape_key
  },
  provider_requirement_refs: [
    `FR-0061.xhs_driver_provider_requirements.v1/${operation}.read`
  ]
});

const evidenceRef = (
  kind: string,
  overrides: Record<string, unknown> = {},
  artifactIdentity = "artifact:xhs-closeout:run-xhs-closeout-boundary-001:round-1"
) => ({
  evidence_ref_id: `ev-${kind}`,
  kind,
  ref: `${kind}:xhs:redacted`,
  source: kind === "provider_contract_ref" ? "provider_contract" : "runtime_admission",
  status: "available",
  collected_at: createdAt,
  freshness: "current_pr_head",
  sensitivity: kind === "provider_contract_ref" || kind === "launch_envelope_ref" ? "public" : "sensitive",
  redaction_state: kind === "provider_contract_ref" || kind === "launch_envelope_ref" ? "not_required" : "redacted",
  artifact_identity: kind === "closeout_artifact_ref" ? artifactIdentity : null,
  ...overrides
});

const baseProviderEvidenceRecord = (
  operation: keyof typeof routeShapeByOperation = "xhs.detail",
  runId = "run-xhs-closeout-boundary-001",
  artifactIdentity = "artifact:xhs-closeout:run-xhs-closeout-boundary-001:round-1"
): Record<string, unknown> => ({
  identity: {
    provider_evidence_record_id: "per-xhs-closeout-boundary-001",
    provider_evidence_contract_version: "v1",
    run_id: runId,
    command_ref: operation,
    created_at: createdAt,
    evidence_scope: "capability_closeout",
    base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"]
  },
  selected_provider: {
    provider_id: "official-chrome.persistent",
    provider_contract_ref: "provider-contract:official-chrome.persistent:v1",
    provider_contract_version: "v1",
    provider_mode: "core_managed",
    provider_class_ref: "registry-entry:official-chrome.persistent",
    selection_reason: "explicit_request",
    selection_source: "launch_envelope",
    selection_evidence_refs: ["ev-provider_contract_ref"]
  },
  version_evidence: {
    provider_version: "fixture-v1",
    browser_channel: "Google Chrome stable",
    browser_version: "unknown",
    extension_version: "unknown",
    native_host_version: "unknown",
    contract_version: "v1",
    version_evidence_refs: ["ev-version_attestation"]
  },
  launch_arguments: {
    launch_envelope_ref: "launch-envelope:xhs:redacted",
    launch_envelope_version: "v1",
    provider_launch_ref: "launch-snapshot:xhs:redacted",
    browser_mode: {
      headed: true,
      headless: false,
      real_browser_required: true,
      browser_channel: "Google Chrome stable"
    },
    runtime_bindings: {
      extension_binding_mode: "persistent_profile_extension",
      native_messaging_mode: "required",
      runtime_bootstrap_required: true
    },
    network_regional_ref: null,
    fingerprint_policy_ref: null,
    launch_argument_evidence_refs: ["ev-launch_envelope_ref"]
  },
  profile_reference: {
    profile_ref: "profile-ref:xhs:redacted",
    profile_binding_mode: "required_existing",
    profile_lock_status: "locked_by_current_run",
    login_state_evidence: "ready",
    profile_persistence_status: "persistent",
    profile_evidence_refs: ["ev-profile_binding_ref"]
  },
  extension_status: {
    extension_required: true,
    extension_binding_mode: "persistent_profile_extension",
    extension_id: "abcdefghijklmnopabcdefghijklmnop",
    extension_version: "unknown",
    extension_installation_status: "installed_in_profile",
    extension_runtime_status: "ready",
    extension_evidence_refs: ["ev-extension_binding_ref"]
  },
  native_messaging_status: {
    native_messaging_required: true,
    native_host_name: "com.webenvoy.native",
    native_host_manifest_ref: "native-manifest-ref:redacted",
    allowed_origin_ref: "allowed-origin-ref:redacted",
    native_host_version: "unknown",
    native_messaging_runtime_status: "ready",
    native_messaging_evidence_refs: ["ev-native_messaging_binding_ref"]
  },
  evidence_refs: [
    ...XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS.map((kind) =>
      evidenceRef(kind, {}, artifactIdentity)
    ),
    evidenceRef("version_attestation", {
      source: "provider_doctor",
      sensitivity: "public",
      redaction_state: "not_required",
      artifact_identity: null
    })
  ],
  closeout_plan: {
    required_evidence_kinds: [...XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS],
    required_freshness: "current_pr_head",
    minimum_attestation_level: "runtime_attested",
    coverage_status: "complete",
    blocking_reasons: [],
    missing_evidence: [],
    redaction_gaps: [],
    next_required_gates: ["route_evidence_evaluator"],
    closeout_decision: "allow"
  }
});

const evaluateBoundary = (
  input: Omit<Parameters<typeof evaluateXhsCloseoutEvidenceBoundary>[0], "expected_latest_head_sha"> &
    Partial<Pick<Parameters<typeof evaluateXhsCloseoutEvidenceBoundary>[0], "expected_latest_head_sha">>
) =>
  evaluateXhsCloseoutEvidenceBoundary({
    expected_latest_head_sha: currentPrHeadSha,
    ...input
  });

describe("XHS closeout evidence boundary for #1164", () => {
  it("admits a provider-aware passive API capture bundle without raw sensitive values", () => {
    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation).toMatchObject({
      contract_version: XHS_CLOSEOUT_EVIDENCE_CONTRACT_VERSION,
      valid: true,
      operation: "xhs.detail",
      route_evidence_class: "passive_api_capture",
      provider_evidence_scope: "capability_closeout",
      missing_route_fields: [],
      missing_provider_evidence_kinds: [],
      redaction_gaps: [],
      forbidden_disclosures: [],
      blockers: []
    });
  });

  it.each([
    "xhs.search",
    "xhs.detail",
    "xhs.user_home"
  ] as const)("admits %s only when passive closeout route semantics match the operation", (operation) => {
    const evaluation = evaluateBoundary({
      operation,
      route_evidence: baseRouteEvidence(operation),
      provider_evidence_record: baseProviderEvidenceRecord(operation)
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.blockers).toEqual([]);
  });

  it("documents the complete valid=true admission invariant surface", () => {
    const routeEvidence = baseRouteEvidence();
    const providerEvidence = baseProviderEvidenceRecord();
    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(true);
    expect(routeEvidence).toMatchObject({
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      route_evidence_class: "passive_api_capture",
      source_kind: "page_request",
      method: "POST",
      endpoint: "/api/sns/web/v1/feed",
      status_code: 200,
      run_id: "run-xhs-closeout-boundary-001",
      artifact_identity: "artifact:xhs-closeout:run-xhs-closeout-boundary-001:round-1"
    });
    expect(providerEvidence).toMatchObject({
      identity: {
        provider_evidence_contract_version: "v1",
        run_id: "run-xhs-closeout-boundary-001",
        command_ref: "xhs.detail",
        evidence_scope: "capability_closeout",
        base_refs: ["FR-0033.browser_provider_contract.v1", "FR-0037.launch_envelope.v1"]
      },
      launch_arguments: {
        browser_mode: {
          real_browser_required: true,
          headless: false
        },
        runtime_bindings: {
          extension_binding_mode: "persistent_profile_extension",
          native_messaging_mode: "required",
          runtime_bootstrap_required: true
        }
      },
      profile_reference: {
        profile_lock_status: "locked_by_current_run",
        login_state_evidence: "ready",
        profile_persistence_status: "persistent"
      },
      extension_status: {
        extension_required: true,
        extension_binding_mode: "persistent_profile_extension",
        extension_runtime_status: "ready"
      },
      native_messaging_status: {
        native_messaging_required: true,
        native_messaging_runtime_status: "ready"
      },
      closeout_plan: {
        required_evidence_kinds: [...XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS],
        required_freshness: "current_pr_head",
        minimum_attestation_level: "runtime_attested",
        coverage_status: "complete",
        blocking_reasons: [],
        missing_evidence: [],
        redaction_gaps: [],
        closeout_decision: "allow"
      }
    });
  });

  it.each([
    {
      requiredFreshness: "current_launch",
      refFreshness: "current_pr_head"
    },
    {
      requiredFreshness: "current_record",
      refFreshness: "current_launch"
    }
  ])("allows provider refs whose freshness is stronger than the closeout plan requires: $refFreshness >= $requiredFreshness", ({
    requiredFreshness,
    refFreshness
  }) => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.closeout_plan = {
      ...(providerEvidence.closeout_plan as Record<string, unknown>),
      required_freshness: requiredFreshness
    };
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) => ({
      ...ref,
      freshness: refFreshness
    }));

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.blockers).toEqual([]);
  });

  it("allows provider attestation stronger than runtime_attested", () => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.closeout_plan = {
      ...(providerEvidence.closeout_plan as Record<string, unknown>),
      minimum_attestation_level: "live_evidence_attested"
    };

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.blockers).toEqual([]);
  });

  it.each([
    "current_launch",
    "current_record"
  ])("rejects provider refs with weaker freshness than current_pr_head closeout requires: %s", (freshness) => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) => ({
      ...ref,
      freshness
    }));

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_freshness_stale",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.evidence_refs.ev-provider_contract_ref"
        }),
        expect.objectContaining({
          blocker_code: "provider_evidence_freshness_stale",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.evidence_refs.ev-closeout_artifact_ref"
        })
      ])
    );
  });

  it("rejects provider evidence from a different run than the route evidence", () => {
    const providerEvidence = baseProviderEvidenceRecord(
      "xhs.detail",
      "run-xhs-closeout-boundary-other"
    );

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_binding_mismatch",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.identity.run_id"
        })
      ])
    );
  });

  it("rejects provider evidence from a different command than the requested operation", () => {
    const evaluation = evaluateBoundary({
      operation: "xhs.search",
      route_evidence: baseRouteEvidence("xhs.search"),
      provider_evidence_record: baseProviderEvidenceRecord("xhs.detail")
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_binding_mismatch",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.identity.command_ref"
        })
      ])
    );
  });

  it("rejects provider closeout artifact refs that do not match the route artifact", () => {
    const providerEvidence = baseProviderEvidenceRecord(
      "xhs.detail",
      "run-xhs-closeout-boundary-001",
      "artifact:xhs-closeout:run-xhs-closeout-boundary-001:other-round"
    );

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_binding_mismatch",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.evidence_refs.closeout_artifact_ref"
        })
      ])
    );
  });

  it.each([
    "internal",
    "sensitive",
    "secret"
  ])("rejects required provider refs with non-public not_required redaction: %s", (sensitivity) => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) =>
      ref.kind === "runtime_observation_ref"
        ? {
            ...ref,
            sensitivity,
            redaction_state: "not_required"
          }
        : ref
    );

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.redaction_gaps).toContain("ev-runtime_observation_ref");
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_redaction_invalid",
          blocker_layer: "redaction",
          field: "provider_evidence_record.evidence_refs.ev-runtime_observation_ref"
        })
      ])
    );
  });

  it("allows not_required redaction only for public required provider refs", () => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) =>
      ref.kind === "runtime_observation_ref"
        ? {
            ...ref,
            sensitivity: "public",
            redaction_state: "not_required"
          }
        : ref
    );

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.redaction_gaps).toEqual([]);
    expect(evaluation.blockers).toEqual([]);
  });

  it.each([
    {
      name: "real browser is not required",
      mutate: (providerEvidence: Record<string, unknown>) => {
        ((providerEvidence.launch_arguments as Record<string, unknown>).browser_mode as Record<string, unknown>).real_browser_required = false;
      },
      field: "provider_evidence_record.launch_arguments.browser_mode.real_browser_required"
    },
    {
      name: "headless browser is allowed",
      mutate: (providerEvidence: Record<string, unknown>) => {
        ((providerEvidence.launch_arguments as Record<string, unknown>).browser_mode as Record<string, unknown>).headless = true;
      },
      field: "provider_evidence_record.launch_arguments.browser_mode.headless"
    },
    {
      name: "extension binding mode is not persistent",
      mutate: (providerEvidence: Record<string, unknown>) => {
        ((providerEvidence.launch_arguments as Record<string, unknown>).runtime_bindings as Record<string, unknown>).extension_binding_mode = "dev_unpacked_extension";
      },
      field: "provider_evidence_record.launch_arguments.runtime_bindings.extension_binding_mode"
    },
    {
      name: "native messaging mode is not required",
      mutate: (providerEvidence: Record<string, unknown>) => {
        ((providerEvidence.launch_arguments as Record<string, unknown>).runtime_bindings as Record<string, unknown>).native_messaging_mode = "not_required";
      },
      field: "provider_evidence_record.launch_arguments.runtime_bindings.native_messaging_mode"
    },
    {
      name: "runtime bootstrap is not required",
      mutate: (providerEvidence: Record<string, unknown>) => {
        ((providerEvidence.launch_arguments as Record<string, unknown>).runtime_bindings as Record<string, unknown>).runtime_bootstrap_required = false;
      },
      field: "provider_evidence_record.launch_arguments.runtime_bindings.runtime_bootstrap_required"
    },
    {
      name: "profile is not locked by current run",
      mutate: (providerEvidence: Record<string, unknown>) => {
        (providerEvidence.profile_reference as Record<string, unknown>).profile_lock_status = "shared_read_only";
      },
      field: "provider_evidence_record.profile_reference.profile_lock_status"
    },
    {
      name: "login state is not ready",
      mutate: (providerEvidence: Record<string, unknown>) => {
        (providerEvidence.profile_reference as Record<string, unknown>).login_state_evidence = "login_allowed";
      },
      field: "provider_evidence_record.profile_reference.login_state_evidence"
    },
    {
      name: "profile is ephemeral",
      mutate: (providerEvidence: Record<string, unknown>) => {
        (providerEvidence.profile_reference as Record<string, unknown>).profile_persistence_status = "ephemeral";
      },
      field: "provider_evidence_record.profile_reference.profile_persistence_status"
    },
    {
      name: "extension is not required",
      mutate: (providerEvidence: Record<string, unknown>) => {
        (providerEvidence.extension_status as Record<string, unknown>).extension_required = false;
      },
      field: "provider_evidence_record.extension_status.extension_required"
    },
    {
      name: "extension status binding mode is not persistent",
      mutate: (providerEvidence: Record<string, unknown>) => {
        (providerEvidence.extension_status as Record<string, unknown>).extension_binding_mode = "dev_unpacked_extension";
      },
      field: "provider_evidence_record.extension_status.extension_binding_mode"
    },
    {
      name: "extension runtime is not ready",
      mutate: (providerEvidence: Record<string, unknown>) => {
        (providerEvidence.extension_status as Record<string, unknown>).extension_runtime_status = "recoverable";
      },
      field: "provider_evidence_record.extension_status.extension_runtime_status"
    },
    {
      name: "native messaging is not required",
      mutate: (providerEvidence: Record<string, unknown>) => {
        (providerEvidence.native_messaging_status as Record<string, unknown>).native_messaging_required = false;
      },
      field: "provider_evidence_record.native_messaging_status.native_messaging_required"
    },
    {
      name: "native messaging runtime is not ready",
      mutate: (providerEvidence: Record<string, unknown>) => {
        (providerEvidence.native_messaging_status as Record<string, unknown>).native_messaging_runtime_status = "recoverable";
      },
      field: "provider_evidence_record.native_messaging_status.native_messaging_runtime_status"
    },
    {
      name: "minimum attestation is below runtime",
      mutate: (providerEvidence: Record<string, unknown>) => {
        (providerEvidence.closeout_plan as Record<string, unknown>).minimum_attestation_level = "doctor_checked";
      },
      field: "provider_evidence_record.closeout_plan.minimum_attestation_level"
    }
  ])("rejects provider evidence without XHS closeout readiness: $name", ({ mutate, field }) => {
    const providerEvidence = baseProviderEvidenceRecord();
    mutate(providerEvidence);

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_readiness_invalid",
          blocker_layer: "provider_evidence",
          field
        })
      ])
    );
  });

  it.each([
    "evidence_ref_id",
    "ref",
    "source",
    "collected_at",
    "sensitivity",
    "artifact_identity"
  ])("rejects required provider refs missing FR-0040 locator/provenance field: %s", (fieldName) => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) => {
      if (ref.kind !== "runtime_observation_ref") {
        return ref;
      }
      const nextRef = { ...ref };
      delete nextRef[fieldName];
      return nextRef;
    });

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field:
            fieldName === "evidence_ref_id"
              ? "provider_evidence_record.evidence_refs.unknown.evidence_ref_id"
              : `provider_evidence_record.evidence_refs.ev-runtime_observation_ref.${fieldName}`
        })
      ])
    );
  });

  it.each([
    "evidence_ref_id",
    "ref",
    "source",
    "sensitivity"
  ])("rejects required provider refs with null FR-0040 locator/provenance value field: %s", (fieldName) => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) =>
      ref.kind === "runtime_observation_ref"
        ? {
            ...ref,
            [fieldName]: null
          }
        : ref
    );

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field:
            fieldName === "evidence_ref_id"
              ? "provider_evidence_record.evidence_refs.unknown.evidence_ref_id"
              : `provider_evidence_record.evidence_refs.ev-runtime_observation_ref.${fieldName}`
        })
      ])
    );
  });

  it("allows nullable FR-0040 required ref provenance fields when they are present", () => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) =>
      ref.kind === "runtime_observation_ref"
        ? {
            ...ref,
            collected_at: null,
            artifact_identity: null
          }
        : ref
    );

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.blockers).toEqual([]);
  });

  it("rejects truncated provider evidence records as non-FR-0040 closeout evidence", () => {
    const providerEvidence = baseProviderEvidenceRecord();
    const truncatedProviderEvidence = {
      identity: providerEvidence.identity,
      evidence_refs: providerEvidence.evidence_refs,
      closeout_plan: providerEvidence.closeout_plan
    };

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: truncatedProviderEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.selected_provider"
        }),
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.version_evidence"
        }),
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.launch_arguments"
        }),
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.profile_reference"
        }),
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.extension_status"
        }),
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field: "provider_evidence_record.native_messaging_status"
        })
      ])
    );
  });

  it.each([
    "version_evidence",
    "launch_arguments",
    "profile_reference",
    "extension_status",
    "native_messaging_status"
  ])("rejects provider evidence missing FR-0040 top-level section: %s", (section) => {
    const providerEvidence = baseProviderEvidenceRecord();
    delete providerEvidence[section];

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field: `provider_evidence_record.${section}`
        })
      ])
    );
  });

  it.each([
    {
      name: "selected provider selection refs",
      section: "selected_provider",
      field: "selection_evidence_refs"
    },
    {
      name: "version evidence refs",
      section: "version_evidence",
      field: "version_evidence_refs"
    },
    {
      name: "launch argument evidence refs",
      section: "launch_arguments",
      field: "launch_argument_evidence_refs"
    },
    {
      name: "profile evidence refs",
      section: "profile_reference",
      field: "profile_evidence_refs"
    },
    {
      name: "extension evidence refs",
      section: "extension_status",
      field: "extension_evidence_refs"
    },
    {
      name: "native messaging evidence refs",
      section: "native_messaging_status",
      field: "native_messaging_evidence_refs"
    }
  ])("rejects dangling FR-0040 section evidence refs: $name", ({ section, field }) => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence[section] = {
      ...(providerEvidence[section] as Record<string, unknown>),
      [field]: ["ev-dangling-section-ref"]
    };

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_shape_invalid",
          blocker_layer: "provider_evidence",
          field: `provider_evidence_record.${section}.${field}`
        })
      ])
    );
  });

  it("keeps the required route field set stable for the later route evidence evaluator", () => {
    expect([...XHS_CLOSEOUT_REQUIRED_ROUTE_FIELDS]).toEqual([
      "route_role",
      "path_kind",
      "evidence_status",
      "evidence_class",
      "route_evidence_class",
      "source_kind",
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
    ]);
  });

  it("fails closed when an active API fetch fallback route is offered as closeout evidence", () => {
    const routeEvidence = baseRouteEvidence();
    routeEvidence.evidence_class = "active_api_fetch_fallback";
    routeEvidence.route_evidence_class = "active_api_fetch_fallback";

    expect(
      evaluateBoundary({
        operation: "xhs.detail",
        route_evidence: routeEvidence,
        provider_evidence_record: baseProviderEvidenceRecord()
      })
    ).toMatchObject({
      valid: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "unsupported_route_evidence_class",
          blocker_layer: "route"
        })
      ])
    });
  });

  it.each([
    {
      name: "route evidence class masked by passive evidence_class",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.evidence_class = "passive_api_capture";
        routeEvidence.route_evidence_class = "active_api_fetch_fallback";
      },
      field: "route_evidence.route_evidence_class"
    },
    {
      name: "evidence class masked by passive route_evidence_class",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.evidence_class = "active_api_fetch_fallback";
        routeEvidence.route_evidence_class = "passive_api_capture";
      },
      field: "route_evidence.evidence_class"
    },
    {
      name: "non-passive route_evidence_class mismatch",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.evidence_class = "passive_api_capture";
        routeEvidence.route_evidence_class = "page_state_fallback";
      },
      field: "route_evidence.route_evidence_class"
    }
  ])("fails closed for mismatched closeout route evidence class fields: $name", ({ mutate, field }) => {
    const routeEvidence = baseRouteEvidence("xhs.detail");
    mutate(routeEvidence);

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.route_evidence_class).toBe(
      typeof routeEvidence.route_evidence_class === "string"
        ? routeEvidence.route_evidence_class
        : null
    );
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "unsupported_route_evidence_class",
          blocker_layer: "route",
          field
        })
      ])
    );
  });

  it("does not report passive route_evidence_class from evidence_class fallback when the route field is missing", () => {
    const routeEvidence = baseRouteEvidence();
    delete routeEvidence.route_evidence_class;

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.route_evidence_class).toBeNull();
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "missing_route_field",
          blocker_layer: "route",
          field: "route_evidence.route_evidence_class"
        }),
        expect.objectContaining({
          blocker_code: "unsupported_route_evidence_class",
          blocker_layer: "route",
          field: "route_evidence.route_evidence_class"
        })
      ])
    );
  });

  it.each([
    {
      name: "missing outer source kind",
      mutate: (routeEvidence: Record<string, unknown>) => {
        delete routeEvidence.source_kind;
      },
      field: "route_evidence.source_kind",
      missingField: "source_kind"
    },
    {
      name: "synthetic outer source kind",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.source_kind = "synthetic_request";
      },
      field: "route_evidence.source_kind"
    },
    {
      name: "active replay outer source kind",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.source_kind = "active_api_fetch_replay";
      },
      field: "route_evidence.source_kind"
    },
    {
      name: "fallback outer source kind",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.source_kind = "page_state_fallback";
      },
      field: "route_evidence.source_kind"
    },
    {
      name: "missing consumed template source kind",
      mutate: (routeEvidence: Record<string, unknown>) => {
        const consumedTemplate = routeEvidence.consumed_template as Record<string, unknown>;
        delete consumedTemplate.source_kind;
      },
      field: "route_evidence.consumed_template.source_kind"
    },
    {
      name: "synthetic consumed template source kind",
      mutate: (routeEvidence: Record<string, unknown>) => {
        (routeEvidence.consumed_template as Record<string, unknown>).source_kind = "synthetic_request";
      },
      field: "route_evidence.consumed_template.source_kind"
    },
    {
      name: "consumed template active fallback class",
      mutate: (routeEvidence: Record<string, unknown>) => {
        (routeEvidence.consumed_template as Record<string, unknown>).route_evidence_class = "active_api_fetch_fallback";
      },
      field: "route_evidence.consumed_template.route_evidence_class"
    },
    {
      name: "missing consumed template run id",
      mutate: (routeEvidence: Record<string, unknown>) => {
        delete (routeEvidence.consumed_template as Record<string, unknown>).run_id;
      },
      field: "route_evidence.consumed_template.run_id"
    },
    {
      name: "missing consumed template profile ref",
      mutate: (routeEvidence: Record<string, unknown>) => {
        delete (routeEvidence.consumed_template as Record<string, unknown>).profile_ref;
      },
      field: "route_evidence.consumed_template.profile_ref"
    },
    {
      name: "missing consumed template session id",
      mutate: (routeEvidence: Record<string, unknown>) => {
        delete (routeEvidence.consumed_template as Record<string, unknown>).session_id;
      },
      field: "route_evidence.consumed_template.session_id"
    },
    {
      name: "missing consumed template target tab",
      mutate: (routeEvidence: Record<string, unknown>) => {
        delete (routeEvidence.consumed_template as Record<string, unknown>).target_tab_id;
      },
      field: "route_evidence.consumed_template.target_tab_id"
    },
    {
      name: "missing consumed template page url",
      mutate: (routeEvidence: Record<string, unknown>) => {
        delete (routeEvidence.consumed_template as Record<string, unknown>).page_url;
      },
      field: "route_evidence.consumed_template.page_url"
    },
    {
      name: "missing consumed template action ref",
      mutate: (routeEvidence: Record<string, unknown>) => {
        delete (routeEvidence.consumed_template as Record<string, unknown>).action_ref;
      },
      field: "route_evidence.consumed_template.action_ref"
    },
    {
      name: "consumed template from another page",
      mutate: (routeEvidence: Record<string, unknown>) => {
        (routeEvidence.consumed_template as Record<string, unknown>).page_url =
          "https://www.xiaohongshu.com/explore/another-note";
      },
      field: "route_evidence.consumed_template.page_url"
    },
    {
      name: "consumed template from another target tab",
      mutate: (routeEvidence: Record<string, unknown>) => {
        (routeEvidence.consumed_template as Record<string, unknown>).target_tab_id = 99;
      },
      field: "route_evidence.consumed_template.target_tab_id"
    },
    {
      name: "consumed template from another run",
      mutate: (routeEvidence: Record<string, unknown>) => {
        (routeEvidence.consumed_template as Record<string, unknown>).run_id = "run-xhs-closeout-boundary-other";
      },
      field: "route_evidence.consumed_template.run_id"
    },
    {
      name: "consumed template from another profile",
      mutate: (routeEvidence: Record<string, unknown>) => {
        (routeEvidence.consumed_template as Record<string, unknown>).profile_ref = "profile-ref:xhs:other";
      },
      field: "route_evidence.consumed_template.profile_ref"
    },
    {
      name: "consumed template from another session",
      mutate: (routeEvidence: Record<string, unknown>) => {
        (routeEvidence.consumed_template as Record<string, unknown>).session_id = "session-ref:xhs:other";
      },
      field: "route_evidence.consumed_template.session_id"
    },
    {
      name: "consumed template from another action",
      mutate: (routeEvidence: Record<string, unknown>) => {
        (routeEvidence.consumed_template as Record<string, unknown>).action_ref = "write";
      },
      field: "route_evidence.consumed_template.action_ref"
    }
  ])("fails closed for passive route provenance gaps: $name", ({
    mutate,
    field,
    missingField
  }) => {
    const routeEvidence = baseRouteEvidence();
    mutate(routeEvidence);

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    if (missingField !== undefined) {
      expect(evaluation.missing_route_fields).toContain(missingField);
    }
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "route_provenance_invalid",
          blocker_layer: "route",
          field
        })
      ])
    );
  });

  it("requires route evidence head_sha to match the expected latest head", () => {
    const routeEvidence = baseRouteEvidence();

    const evaluation = evaluateBoundary({
      expected_latest_head_sha: "head-xhs-closeout-boundary-next-001",
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "route_head_sha_invalid",
          blocker_layer: "route",
          field: "route_evidence.head_sha"
        })
      ])
    );
  });

  it("fails closed when expected latest head is missing", () => {
    const evaluation = evaluateBoundary({
      expected_latest_head_sha: null,
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "route_head_sha_invalid",
          blocker_layer: "route",
          field: "expected_latest_head_sha"
        })
      ])
    );
  });

  it("rejects stale merge-base route evidence heads for latest-head closeout", () => {
    const routeEvidence = baseRouteEvidence();
    routeEvidence.head_sha = staleMergeBaseHeadSha;

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "route_head_sha_invalid",
          blocker_layer: "route",
          field: "route_evidence.head_sha"
        })
      ])
    );
  });

  it.each([
    {
      name: "fallback route role",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.route_role = "fallback";
      },
      blocker_code: "route_role_invalid",
      field: "route_evidence.route_role"
    },
    {
      name: "page path kind",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.path_kind = "page";
      },
      blocker_code: "route_path_kind_invalid",
      field: "route_evidence.path_kind"
    },
    {
      name: "candidate evidence status",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.evidence_status = "candidate";
      },
      blocker_code: "route_evidence_status_invalid",
      field: "route_evidence.evidence_status"
    },
    {
      name: "non-2xx status code",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.status_code = 302;
      },
      blocker_code: "route_http_status_invalid",
      field: "route_evidence.status_code"
    },
    {
      name: "missing numeric status code semantics",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.status_code = "ok";
      },
      blocker_code: "route_http_status_invalid",
      field: "route_evidence.status_code"
    }
  ])("fails closed for semantic-invalid closeout route evidence: $name", ({ mutate, blocker_code, field }) => {
    const routeEvidence = baseRouteEvidence("xhs.detail");
    mutate(routeEvidence);

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code,
          blocker_layer: "route",
          field
        })
      ])
    );
  });

  it.each([
    {
      name: "detail operation with search endpoint",
      operation: "xhs.detail",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.route = "xhs.search.api";
        routeEvidence.endpoint = "/api/sns/web/v1/search/notes";
        routeEvidence.request_url = "/api/sns/web/v1/search/notes";
      },
      fields: ["route_evidence.route", "route_evidence.endpoint"]
    },
    {
      name: "search operation with detail page",
      operation: "xhs.search",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.page_url = "https://www.xiaohongshu.com/explore/note-closeout-001";
      },
      fields: ["route_evidence.page_url"]
    },
    {
      name: "user_home operation with POST method",
      operation: "xhs.user_home",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.method = "POST";
      },
      fields: ["route_evidence.method"]
    }
  ] as const)("fails closed when route evidence binding mismatches the operation: $name", ({
    operation,
    mutate,
    fields
  }) => {
    const routeEvidence = baseRouteEvidence(operation);
    mutate(routeEvidence);

    const evaluation = evaluateBoundary({
      operation,
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    for (const field of fields) {
      expect(evaluation.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            blocker_code: "route_binding_invalid",
            blocker_layer: "route",
            field
          })
        ])
      );
    }
  });

  it("reports missing required route fields instead of treating partial driver summaries as closeout evidence", () => {
    const routeEvidence = baseRouteEvidence();
    delete routeEvidence.head_sha;
    delete routeEvidence.artifact_identity;
    delete routeEvidence.profile_ref;

    const evaluation = evaluateBoundary({
      operation: "xhs.user_home",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.missing_route_fields).toEqual([
      "artifact_identity",
      "head_sha",
      "profile_ref"
    ]);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker_code: "missing_route_field", field: "route_evidence.head_sha" }),
        expect.objectContaining({ blocker_code: "missing_route_field", field: "route_evidence.artifact_identity" }),
        expect.objectContaining({ blocker_code: "missing_route_field", field: "route_evidence.profile_ref" })
      ])
    );
  });

  it("requires FR-0040 capability_closeout provider evidence and all XHS provider evidence refs", () => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.identity = {
      ...(providerEvidence.identity as Record<string, unknown>),
      evidence_scope: "runtime_admission"
    };
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).filter(
      (ref) => ref.kind !== "native_messaging_binding_ref"
    );

    const evaluation = evaluateBoundary({
      operation: "xhs.search",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.provider_evidence_scope).toBe("runtime_admission");
    expect(evaluation.missing_provider_evidence_kinds).toEqual(["native_messaging_binding_ref"]);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker_code: "provider_evidence_scope_invalid" }),
        expect.objectContaining({ blocker_code: "provider_evidence_kind_missing" })
      ])
    );
  });

  it.each([
    {
      name: "provider evidence contract version mismatch",
      mutate: (providerEvidence: Record<string, unknown>) => {
        providerEvidence.identity = {
          ...(providerEvidence.identity as Record<string, unknown>),
          provider_evidence_contract_version: "v0"
        };
      },
      blocker_code: "provider_evidence_contract_version_mismatch",
      field: "provider_evidence_record.identity.provider_evidence_contract_version"
    },
    {
      name: "missing FR-0033 base ref",
      mutate: (providerEvidence: Record<string, unknown>) => {
        providerEvidence.identity = {
          ...(providerEvidence.identity as Record<string, unknown>),
          base_refs: ["FR-0037.launch_envelope.v1"]
        };
      },
      blocker_code: "provider_evidence_base_ref_missing",
      field: "provider_evidence_record.identity.base_refs"
    },
    {
      name: "missing FR-0037 base ref",
      mutate: (providerEvidence: Record<string, unknown>) => {
        providerEvidence.identity = {
          ...(providerEvidence.identity as Record<string, unknown>),
          base_refs: ["FR-0033.browser_provider_contract.v1"]
        };
      },
      blocker_code: "provider_evidence_base_ref_missing",
      field: "provider_evidence_record.identity.base_refs"
    }
  ])("fails closed for provider evidence identity invariant: $name", ({
    mutate,
    blocker_code,
    field
  }) => {
    const providerEvidence = baseProviderEvidenceRecord();
    mutate(providerEvidence);

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code,
          blocker_layer: "provider_evidence",
          field
        })
      ])
    );
  });

  it("blocks provider evidence redaction gaps from satisfying the boundary", () => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) =>
      ref.kind === "profile_binding_ref"
        ? {
            ...ref,
            ref: "/Users/example/Library/Application Support/Chrome/Profile 1",
            redaction_state: "policy_missing"
          }
        : ref
    );
    providerEvidence.closeout_plan = {
      ...(providerEvidence.closeout_plan as Record<string, unknown>),
      coverage_status: "blocked",
      blocking_reasons: ["redaction_policy_missing"],
      redaction_gaps: ["ev-profile_binding_ref"],
      closeout_decision: "deny"
    };

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.redaction_gaps).toContain("ev-profile_binding_ref");
    expect(evaluation.forbidden_disclosures).toContain("provider_evidence_record.evidence_refs[2].ref");
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker_code: "provider_evidence_closeout_denied" }),
        expect.objectContaining({ blocker_code: "provider_evidence_redaction_invalid" }),
        expect.objectContaining({ blocker_code: "raw_sensitive_value_detected" })
      ])
    );
  });

  it.each([
    {
      name: "closeout decision deny",
      closeoutPlanPatch: {
        closeout_decision: "deny"
      },
      expectedRedactionGap: null
    },
    {
      name: "blocking reasons",
      closeoutPlanPatch: {
        blocking_reasons: ["runtime_attestation_missing"]
      },
      expectedRedactionGap: null
    },
    {
      name: "redaction gaps",
      closeoutPlanPatch: {
        redaction_gaps: ["ev-runtime_observation_ref"]
      },
      expectedRedactionGap: "ev-runtime_observation_ref"
    },
    {
      name: "missing evidence",
      closeoutPlanPatch: {
        missing_evidence: ["route_evidence_evaluator_attestation"]
      },
      expectedRedactionGap: null
    },
    {
      name: "partial coverage status",
      closeoutPlanPatch: {
        coverage_status: "partial"
      },
      expectedRedactionGap: null
    },
    {
      name: "required evidence kinds missing runtime observation",
      closeoutPlanPatch: {
        required_evidence_kinds: XHS_CLOSEOUT_REQUIRED_PROVIDER_EVIDENCE_KINDS.filter(
          (kind) => kind !== "runtime_observation_ref"
        )
      },
      expectedRedactionGap: null,
      expectedField: "provider_evidence_record.closeout_plan.required_evidence_kinds"
    }
  ])("fails closed for provider closeout_plan-level gaps: $name", ({
    closeoutPlanPatch,
    expectedRedactionGap,
    expectedField
  }) => {
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.closeout_plan = {
      ...(providerEvidence.closeout_plan as Record<string, unknown>),
      blocking_reasons: [],
      closeout_decision: "allow",
      ...closeoutPlanPatch
    };

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: baseRouteEvidence(),
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    if (expectedRedactionGap !== null) {
      expect(evaluation.redaction_gaps).toContain(expectedRedactionGap);
    }
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "provider_evidence_closeout_denied",
          blocker_layer: "provider_evidence",
          field: expectedField ?? "provider_evidence_record.closeout_plan"
        })
      ])
    );
  });

  it("rejects raw XHS tokens, cookies, headers, and request payloads on the disclosure surface", () => {
    const routeEvidence = baseRouteEvidence();
    routeEvidence.page_url =
      "https://www.xiaohongshu.com/explore/note-closeout-001?xsec_token=raw-token";
    routeEvidence.consumed_template = {
      ...(routeEvidence.consumed_template as Record<string, unknown>),
      request: {
        headers: {
          Cookie: "a1=raw-cookie",
          "X-S-Common": "raw-common"
        },
        body: {
          api_key: "raw-key"
        }
      }
    };

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: baseProviderEvidenceRecord()
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.forbidden_disclosures).toEqual(
      expect.arrayContaining([
        "route_evidence.page_url",
        "route_evidence.consumed_template.request.headers.Cookie",
        "route_evidence.consumed_template.request.headers.X-S-Common",
        "route_evidence.consumed_template.request.body.api_key"
      ])
    );
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker_code: "raw_sensitive_value_detected" })
      ])
    );
  });

  it("allows intentionally redacted placeholders without raw disclosure material", () => {
    const routeEvidence = baseRouteEvidence();
    routeEvidence.consumed_template = {
      ...(routeEvidence.consumed_template as Record<string, unknown>),
      request: {
        headers: {
          Cookie: "[redacted]",
          Authorization: "<redacted:authorization>"
        },
        body: {
          api_key: "<redacted:api-key>"
        }
      }
    };
    const providerEvidence = baseProviderEvidenceRecord();
    providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) =>
      ref.kind === "runtime_observation_ref"
        ? {
            ...ref,
            ref: "<redacted:runtime-observation>"
          }
        : ref
    );

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.forbidden_disclosures).toEqual([]);
    expect(evaluation.blockers).toEqual([]);
  });

  it.each([
    {
      name: "route URL token with suffix marker",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.page_url =
          "https://www.xiaohongshu.com/explore/note-closeout-001?xsec_token=raw-token:redacted";
      },
      disclosure: "route_evidence.page_url"
    },
    {
      name: "route nested cookie with bracket marker",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.consumed_template = {
          ...(routeEvidence.consumed_template as Record<string, unknown>),
          request: {
            headers: {
              Cookie: "a1=raw-cookie[redacted]"
            }
          }
        };
      },
      disclosure: "route_evidence.consumed_template.request.headers.Cookie"
    },
    {
      name: "route nested header with angle marker",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.consumed_template = {
          ...(routeEvidence.consumed_template as Record<string, unknown>),
          request: {
            headers: {
              "X-S-Common": "raw-common<redacted:x-s-common>"
            }
          }
        };
      },
      disclosure: "route_evidence.consumed_template.request.headers.X-S-Common"
    },
    {
      name: "route nested request payload with suffix marker",
      mutate: (routeEvidence: Record<string, unknown>) => {
        routeEvidence.consumed_template = {
          ...(routeEvidence.consumed_template as Record<string, unknown>),
          request: {
            body: {
              api_key: "raw-key:redacted"
            }
          }
        };
      },
      disclosure: "route_evidence.consumed_template.request.body.api_key"
    },
    {
      name: "provider evidence private path with suffix marker",
      mutateProvider: (providerEvidence: Record<string, unknown>) => {
        providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) =>
          ref.kind === "profile_binding_ref"
            ? {
                ...ref,
                ref: "/Users/alice/Library/Application Support/Chrome/Profile 1:redacted"
              }
            : ref
        );
      },
      disclosure: "provider_evidence_record.evidence_refs[2].ref"
    },
    {
      name: "provider nested array cookie with suffix marker",
      mutateProvider: (providerEvidence: Record<string, unknown>) => {
        providerEvidence.evidence_refs = (providerEvidence.evidence_refs as Record<string, unknown>[]).map((ref) =>
          ref.kind === "runtime_observation_ref"
            ? {
                ...ref,
                diagnostics: {
                  samples: ["Cookie: a1=raw-cookie:redacted"]
                }
              }
            : ref
        );
      },
      disclosure: "provider_evidence_record.evidence_refs[5].diagnostics.samples[0]"
    }
  ])("rejects raw disclosure material even when redaction markers are present: $name", ({
    mutate,
    mutateProvider,
    disclosure
  }) => {
    const routeEvidence = baseRouteEvidence();
    const providerEvidence = baseProviderEvidenceRecord();
    mutate?.(routeEvidence);
    mutateProvider?.(providerEvidence);

    const evaluation = evaluateBoundary({
      operation: "xhs.detail",
      route_evidence: routeEvidence,
      provider_evidence_record: providerEvidence
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.forbidden_disclosures).toContain(disclosure);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "raw_sensitive_value_detected",
          blocker_layer: "redaction",
          field: disclosure
        })
      ])
    );
  });
});
