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
      contract_version: "v1",
      distribution_channel: "official_chrome_profile"
    });
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
      browser_channel: "Google Chrome stable"
    });
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
      decision: "defer",
      blocking_reasons: ["verification_source_missing"]
    });
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
    expect(supported.outcome).toMatchObject({
      overall_status: "pass",
      provider_blocked: false,
      doctor_verification_level: "doctor_checked",
      next_required_gates: ["runtime_attestation"]
    });
    expect(new Set(supported.checks.map((check) => check.category))).toEqual(
      new Set(requiredDoctorCategories)
    );
    expect(supported.checks.every((check) => check.status === "pass")).toBe(true);

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
      coverage_status: "complete",
      blocking_reasons: [],
      missing_evidence: [],
      redaction_gaps: [],
      closeout_decision: "allow"
    });

    expect(partial.closeout_plan).toMatchObject({
      coverage_status: "partial",
      blocking_reasons: ["native_messaging_status_unready", "evidence_ref_unavailable"],
      missing_evidence: ["runtime_bootstrap_ref"],
      closeout_decision: "defer"
    });
    expect(partial.evidence_refs).toContainEqual(
      expect.objectContaining({
        kind: "native_messaging_binding_ref",
        status: "partial"
      })
    );

    expect(failClosed.closeout_plan).toMatchObject({
      coverage_status: "blocked",
      closeout_decision: "deny"
    });
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
