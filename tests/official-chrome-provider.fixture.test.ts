import { describe, expect, it } from "vitest";

import {
  officialChromeProviderFixtureIds,
  officialChromeProviderFixtures
} from "./fixtures/provider-contract-fixtures.js";

const sensitiveLeakPatterns = [/\/Users\//, /C:\\Users\\/i, /cookie/i, /token/i, /secret/i, /api[_-]?key/i];

describe("official Chrome provider fixtures for #1144", () => {
  it("locks official Chrome descriptor and launch envelope as provider-specific fixtures", () => {
    const contract = officialChromeProviderFixtures.contractSnapshot;
    const envelope = officialChromeProviderFixtures.launchEnvelope;
    const capability = contract.capabilities[0];

    expect(contract.provider_identity).toMatchObject({
      provider_id: officialChromeProviderFixtureIds.providerId,
      provider_family: "official_chrome",
      provider_version: "v1",
      contract_version: "v1",
      distribution_channel: "builtin"
    });
    expect(contract.provider_identity.provider_version).not.toBe("fixture-v1");
    expect(contract.provider_identity.distribution_channel).not.toBe("official_chrome_profile");
    expect(contract.browser_engine).toMatchObject({
      engine_family: "chrome",
      browser_channel: "Google Chrome stable",
      browser_version_range: "system_installed",
      headless_policy: "forbidden",
      extension_binding_support: "required",
      profile_binding_support: "required"
    });
    expect(contract.automation_transport).toMatchObject({
      transport_kind: "hybrid",
      native_messaging_support: "required",
      attach_model: "launch"
    });
    expect(capability).toMatchObject({
      capability_id: officialChromeProviderFixtureIds.capabilityId,
      capability_kind: "browser_runtime",
      supported_execution_layers: ["L3"],
      supported_actions: ["read", "diagnose"],
      verification_level: "static_checked"
    });
    expect(capability.risk_constraints).toEqual([
      "requires_latest_head_evidence",
      "requires_manual_confirmation"
    ]);
    expect(capability.limitations).toEqual(["diagnostic_only"]);
    expect(capability.risk_constraints).not.toEqual(
      expect.arrayContaining(["official_chrome_only", "persistent_profile_required", "headful_only"])
    );
    expect(capability.limitations).not.toEqual(expect.arrayContaining(["live_evidence_not_included"]));
    expect(capability.capability_kind).not.toBe("runtime_control");
    expect(capability.supported_actions).not.toEqual(expect.arrayContaining(["launch", "attach"]));
    expect(capability.runtime_requirements).toEqual([
      "profile_binding",
      "extension_binding",
      "native_messaging",
      "runtime_bootstrap_ready",
      "real_browser"
    ]);

    expect(envelope.provider).toMatchObject({
      provider_contract_ref: officialChromeProviderFixtureIds.contractRef,
      provider_id: officialChromeProviderFixtureIds.providerId,
      minimum_verification_level: "doctor_checked"
    });
    expect(envelope.profile).toMatchObject({
      profile_lock_policy: "exclusive_required",
      extension_identity_required: true,
      native_host_binding_required: true
    });
    expect(envelope.browser_mode).toMatchObject({
      headed: true,
      headless: false,
      real_browser_required: true,
      browser_channel: "Google Chrome stable",
      browser_version_requirement: "Google Chrome stable >=137"
    });
    expect(envelope.browser_mode.browser_version_requirement).not.toContain(">=125");
    expect(envelope.runtime_bindings).toMatchObject({
      extension_binding_mode: "persistent_profile_extension",
      native_messaging_mode: "required",
      runtime_bootstrap_required: true
    });
    expect(envelope.admission_health_requirements.map((item) => item.target)).toEqual([
      "extension_identity",
      "native_messaging",
      "runtime_bootstrap"
    ]);
  });

  it("locks supported, partial and fail-closed capability matrix states", () => {
    const supported = officialChromeProviderFixtures.capabilityMatrix.supported;
    const partial = officialChromeProviderFixtures.capabilityMatrix.partial;
    const failClosed = officialChromeProviderFixtures.capabilityMatrix.failClosed;

    expect(supported).toMatchObject({
      provider_id: officialChromeProviderFixtureIds.providerId,
      capability_id: officialChromeProviderFixtureIds.capabilityId,
      capability_kind: "runtime",
      supported_actions: ["launch"],
      supported_execution_layers: ["chrome_process", "persistent_profile", "playwright_cdp"],
      support_level: "statically_verified",
      decision: "defer",
      blocking_reasons: []
    });
    expect(supported.capability_kind).not.toBe("runtime_control");
    expect(supported.supported_execution_layers).not.toEqual(["L3"]);
    expect(supported.verification_sources.map((source) => source.kind)).toEqual([
      "provider_declaration",
      "static_contract_check",
      "manual_review_attestation"
    ]);
    expect(supported).not.toHaveProperty("support_state");
    expect(supported.verification_sources).not.toContainEqual(
      expect.objectContaining({ kind: "provider_health" })
    );
    expect(supported.verification_sources).not.toContainEqual(
      expect.objectContaining({ kind: "runtime_attestation" })
    );

    expect(partial).toMatchObject({
      capability_kind: "runtime",
      supported_actions: ["launch"],
      supported_execution_layers: ["chrome_process", "persistent_profile", "playwright_cdp"],
      support_level: "declared",
      support_state: "blocked",
      decision: "deny",
      blocking_reasons: ["verification_source_missing"]
    });
    expect(partial.blocking_reasons).not.toHaveLength(0);
    expect(partial.decision).not.toBe("defer");
    expect(partial.verification_sources.map((source) => source.kind)).toEqual([
      "provider_declaration",
      "static_contract_check",
      "manual_review_attestation"
    ]);
    expect(partial.verification_sources).toContainEqual(
      expect.objectContaining({
        kind: "manual_review_attestation",
        status: "partial"
      })
    );

    expect(failClosed).toMatchObject({
      capability_kind: "runtime",
      supported_actions: ["launch"],
      supported_execution_layers: ["chrome_process", "persistent_profile", "playwright_cdp"],
      support_level: "statically_verified",
      decision: "deny",
      blocking_reasons: ["runtime_requirement_missing", "verification_source_missing"]
    });
    expect(failClosed.verification_sources.map((source) => source.kind)).toEqual([
      "provider_declaration",
      "static_contract_check",
      "manual_review_attestation"
    ]);
    expect(failClosed.verification_sources).toContainEqual(
      expect.objectContaining({
        kind: "manual_review_attestation",
        status: "failed"
      })
    );
  });

  it("locks official Chrome health fixtures without redefining shared health schema", () => {
    const supported = officialChromeProviderFixtures.providerHealth.supported;
    const partial = officialChromeProviderFixtures.providerHealth.partial;
    const failClosed = officialChromeProviderFixtures.providerHealth.failClosed;
    const requiredDoctorCategories = [
      "binary",
      "version",
      "display_mode",
      "profile_persistence",
      "extension_load",
      "native_messaging",
      "capability_readiness"
    ];

    expect(supported.identity.provider_id).toBe(officialChromeProviderFixtureIds.providerId);
    expect(supported.identity.provider_version).toBe("v1");
    expect(partial.identity.provider_version).toBe("v1");
    expect(failClosed.identity.provider_version).toBe("v1");
    expect(supported.identity.provider_version).not.toBe("fixture-v1");
    expect(supported.outcome).toMatchObject({
      overall_status: "warn",
      provider_blocked: false,
      blocked_capabilities: [officialChromeProviderFixtureIds.capabilityId],
      doctor_verification_level: "doctor_checked",
      next_required_gates: ["runtime_attestation"]
    });
    expect(new Set(supported.checks.map((check) => check.category))).toEqual(
      new Set(requiredDoctorCategories)
    );
    expect(supported.outcome.overall_status).not.toBe("pass");
    expect(
      supported.checks.find((check) => check.category === "version")?.diagnostics
    ).toMatchObject({
      observed: "Google Chrome stable 137.0.0.0",
      expected: "system_installed"
    });
    expect(
      supported.checks.find((check) => check.category === "version")?.diagnostics.observed
    ).not.toContain("125");
    expect(
      supported.checks.find((check) => check.category === "capability_readiness")
    ).toMatchObject({
      status: "warn",
      blocking: "capability_blocking"
    });
    expect(
      supported.checks.find((check) => check.category === "capability_readiness")?.diagnostics
    ).toMatchObject({
      code: "capability_readiness.runtime_attestation_pending",
      minimum_next_verification_level: "runtime_attested"
    });
    expect(
      supported.checks.find((check) => check.category === "capability_readiness")?.diagnostics
        .unsatisfied_runtime_requirements
    ).toEqual(
      expect.arrayContaining([
        "extension_binding",
        "native_messaging",
        "runtime_bootstrap_ready",
        "real_browser"
      ])
    );

    expect(partial.outcome).toMatchObject({
      overall_status: "warn",
      provider_blocked: false,
      blocked_capabilities: [officialChromeProviderFixtureIds.capabilityId],
      doctor_verification_level: "doctor_checked",
      next_required_gates: ["runtime_attestation"]
    });
    expect(partial.outcome.overall_status).not.toBe("pass");
    expect(new Set(partial.checks.map((check) => check.category))).not.toEqual(
      new Set(requiredDoctorCategories)
    );

    expect(failClosed.outcome).toMatchObject({
      overall_status: "fail",
      provider_blocked: true,
      blocked_capabilities: [officialChromeProviderFixtureIds.capabilityId]
    });
    expect(failClosed.outcome.overall_status).not.toBe("pass");
    expect(failClosed.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check_id: "official_chrome_persistent_extension_identity",
          blocking: "provider_blocking"
        }),
        expect.objectContaining({
          check_id: "host_registration",
          blocking: "provider_blocking"
        }),
        expect.objectContaining({
          check_id: "official-chrome-launch-readiness",
          blocking: "capability_blocking"
        })
      ])
    );
  });

  it("locks official Chrome evidence fixtures for complete, partial and fail-closed states", () => {
    const supported = officialChromeProviderFixtures.evidence.supported.provider_evidence_record;
    const partial = officialChromeProviderFixtures.evidence.partial.provider_evidence_record;
    const failClosed = officialChromeProviderFixtures.evidence.failClosed.provider_evidence_record;

    expect(supported.selected_provider).toMatchObject({
      provider_id: officialChromeProviderFixtureIds.providerId,
      provider_contract_ref: officialChromeProviderFixtureIds.contractRef,
      selection_source: "launch_envelope"
    });
    expect(supported.launch_arguments.runtime_bindings).toMatchObject({
      extension_binding_mode: "persistent_profile_extension",
      native_messaging_mode: "required",
      runtime_bootstrap_required: true
    });
    expect(supported.closeout_plan).toMatchObject({
      coverage_status: "partial",
      blocking_reasons: ["runtime_attestation_required"],
      missing_evidence: ["runtime_attestation_ref"],
      redaction_gaps: [],
      next_required_gates: ["runtime_attestation"],
      closeout_decision: "deny"
    });
    expect(supported.closeout_plan.closeout_decision).not.toBe("allow");
    expect(supported.closeout_plan.minimum_attestation_level).toBe("runtime_attested");
    expect(supported.launch_arguments.launch_envelope_ref).toBe(officialChromeProviderFixtureIds.launchEnvelopeRef);
    expect(supported.version_evidence).toMatchObject({
      provider_version: "v1",
      browser_channel: "Google Chrome stable",
      browser_version: "Google Chrome 137.0.0.0"
    });
    expect(supported.version_evidence.provider_version).not.toBe("fixture-v1");
    expect(supported.version_evidence.browser_version).not.toContain("125");
    expect(supported.closeout_plan.required_evidence_kinds).toContain("launch_envelope_ref");
    expect(supported.evidence_refs).toContainEqual(
      expect.objectContaining({
        kind: "launch_envelope_ref",
        ref: officialChromeProviderFixtureIds.launchEnvelopeRef,
        status: "available"
      })
    );

    expect(partial.closeout_plan).toMatchObject({
      coverage_status: "partial",
      blocking_reasons: ["native_messaging_status_unready", "evidence_ref_unavailable"],
      missing_evidence: ["runtime_bootstrap_ref"],
      closeout_decision: "deny"
    });
    expect(partial.evidence_refs).toContainEqual(
      expect.objectContaining({
        kind: "native_messaging_binding_ref",
        status: "partial"
      })
    );
    expect(partial.version_evidence).toMatchObject({
      provider_version: "v1",
      browser_channel: "Google Chrome stable",
      browser_version: "Google Chrome 137.0.0.0"
    });
    expect(partial.version_evidence.provider_version).not.toBe("fixture-v1");
    expect(partial.version_evidence.browser_version).not.toContain("125");
    expect(partial.closeout_plan.closeout_decision).not.toBe("defer");

    expect(failClosed.closeout_plan).toMatchObject({
      coverage_status: "blocked",
      closeout_decision: "deny"
    });
    expect(failClosed.version_evidence.provider_version).toBe("v1");
    expect(failClosed.version_evidence.provider_version).not.toBe("fixture-v1");
    expect(failClosed.closeout_plan.blocking_reasons).toEqual(
      expect.arrayContaining([
        "provider_limitation_conflict",
        "profile_lock_unavailable",
        "extension_status_unready",
        "native_messaging_status_unready",
        "runtime_attestation_required",
        "redaction_policy_missing"
      ])
    );
    expect(failClosed.closeout_plan.missing_evidence).toEqual(
      expect.arrayContaining([
        "profile_binding_ref",
        "extension_binding_ref",
        "native_messaging_binding_ref",
        "runtime_bootstrap_ref",
        "google_chrome_stable_attestation"
      ])
    );

    for (const record of [supported, partial, failClosed]) {
      const serialized = JSON.stringify(record);
      for (const pattern of sensitiveLeakPatterns) {
        expect(serialized).not.toMatch(pattern);
      }
    }
  });
});
