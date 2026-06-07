import { describe, expect, it } from "vitest";

import {
  launchEnvelopeFixtures,
  providerCapabilityVerificationFixtures,
  providerContractFixtureIds,
  providerContractFixtures,
  providerDoctorFixtures,
  providerEvidenceFixtures,
  providerRegistryFixtures
} from "./fixtures/provider-contract-fixtures.js";

const officialChromeProviderIds = new Set(["official-chrome-stable", "official_chrome_stable"]);
const officialChromeTags = new Set(["official_chrome", "persistent_extension"]);
const liveEvidenceKinds = new Set(["live_evidence_ref", "live_evidence"]);
const sensitiveLeakPatterns = [/\/Users\//, /C:\\Users\\/i, /cookie/i, /token/i, /secret/i, /api[_-]?key/i];

const asRecord = (value: unknown): Record<string, unknown> => {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
};

const collectStringValues = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStringValues);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStringValues);
  }

  return [];
};

const expectNoOfficialChromeFixture = (value: unknown) => {
  const strings = collectStringValues(value);

  expect(strings).not.toContain("official_chrome");
  expect(strings).not.toContain("official-chrome-stable");
  expect(strings).not.toContain("Google Chrome stable");
  expect(strings).not.toContain("persistent_profile_extension");
  expect(strings).not.toContain("com.webenvoy.native_host");
};

describe("provider contract fixtures for #1130", () => {
  it("locks a provider-generic FR-0033 browser provider contract fixture", () => {
    const contract = providerContractFixtures.validGenericProviderContract;
    const capability = contract.capabilities[0];

    expectNoOfficialChromeFixture(contract);
    expect(contract.provider_identity).toMatchObject({
      provider_id: providerContractFixtureIds.providerId,
      provider_family: "custom_provider",
      contract_version: "v1",
      distribution_channel: "local_adapter"
    });
    expect(officialChromeProviderIds.has(contract.provider_identity.provider_id)).toBe(false);
    expect(contract.browser_engine.engine_family).toBe("chromium");
    expect(contract.browser_engine.browser_channel).toBe("Generic Chromium compatible");
    expect(contract.provider_mode).toBe("core_managed");
    expect(contract.automation_transport.transport_kind).toBe("extension_bridge");
    expect(contract.automation_transport.command_surface.length).toBeGreaterThan(0);
    expect(capability).toMatchObject({
      capability_id: providerContractFixtureIds.capabilityId,
      capability_kind: "page_automation",
      supported_execution_layers: ["L2"],
      supported_actions: ["read", "diagnose"],
      verification_level: "static_checked",
      limitations: []
    });
    expect(capability.runtime_requirements).toContain("runtime_bootstrap_ready");
    expect(contract.verification.capability_levels[providerContractFixtureIds.capabilityId]).toBe("static_checked");
    expect(contract.limitations).toEqual([]);
  });

  it("keeps FR-0033 unknown limitations as fail-closed fixture inputs", () => {
    const contract = providerContractFixtures.unknownLimitationProviderContract;
    const capability = contract.capabilities[0];
    const blockedRecord = providerCapabilityVerificationFixtures.unknownLimitationBlockedRecord;

    expectNoOfficialChromeFixture(contract);
    expect(contract.limitations).toContain("unknown");
    expect(capability.limitations).toContain("unknown");
    expect(blockedRecord).toMatchObject({
      provider_id: contract.provider_identity.provider_id,
      capability_id: capability.capability_id,
      support_state: "blocked",
      decision: "deny",
      blocking_reasons: ["unknown_limitation"]
    });
  });

  it("locks FR-0035 default decision policy and generic capability verification examples", () => {
    const policy = providerCapabilityVerificationFixtures.defaultDecisionPolicy;
    const staticRecord = providerCapabilityVerificationFixtures.staticReadAllowedRecord;
    const runtimeBlockedRecord = providerCapabilityVerificationFixtures.runtimeRequirementMissingRecord;

    expect(policy).toMatchObject({
      default_business_minimum_support_state: "statically_verified",
      runtime_requirement_minimum_support_state: "runtime_attested",
      runtime_observation_minimum_support_state: "runtime_observed",
      live_evidence_minimum_support_state: "live_evidence_attested",
      allow_declared_only_for_business: false,
      allow_defer_for_business: false,
      fail_closed_on_blocking_reasons: true,
      fail_closed_on_unknown_limitation: true,
      fail_closed_on_invalid_or_stale_evidence_ref: true,
      degraded_state_policy: "explicit_only",
      manual_review_policy: "confirm_existing_evidence_only"
    });

    expect(staticRecord).toMatchObject({
      provider_id: providerContractFixtureIds.providerId,
      contract_version: "v1",
      capability_id: providerContractFixtureIds.capabilityId,
      support_state: "statically_verified",
      decision: "allow",
      blocking_reasons: []
    });
    expect(staticRecord.declared_capability_ref).toContain(providerContractFixtureIds.capabilityId);
    expect(staticRecord.verification_sources.map((source) => source.kind)).toEqual([
      "provider_declaration",
      "static_contract_check"
    ]);

    expect(runtimeBlockedRecord).toMatchObject({
      provider_id: providerContractFixtureIds.providerId,
      support_state: "blocked",
      decision: "deny"
    });
    expect(runtimeBlockedRecord.required_runtime_requirements).toEqual([
      "profile_binding",
      "target_tab",
      "runtime_bootstrap_ready"
    ]);
    expect(runtimeBlockedRecord.blocking_reasons).toEqual([
      "runtime_requirement_missing",
      "verification_source_missing"
    ]);
    expect(runtimeBlockedRecord.verification_sources).toContainEqual(
      expect.objectContaining({
        kind: "runtime_attestation",
        status: "missing",
        scope: "runtime"
      })
    );
  });

  it("locks FR-0036 registry entries as generic contract snapshots, not runtime readiness", () => {
    const registry = providerRegistryFixtures.validGenericRegistry;
    const entry = registry.entries[0];
    const declaredOnlyEntry = providerRegistryFixtures.declaredOnlyRegistryEntry;

    expectNoOfficialChromeFixture(registry);
    expect(registry).toMatchObject({
      registry_version: "v1",
      contract_ref: "FR-0033.browser_provider_contract.v1",
      owner: "webenvoy_core_provider_runtime"
    });
    expect(entry.provider_id).toBe(entry.contract_snapshot.provider_identity.provider_id);
    expect(entry.provider_class).toBe("custom_local");
    expect(entry.registry_status).toBe("static_checked");
    expect(entry.default_eligibility).toBe("eligible");
    expect(Number.isInteger(entry.priority)).toBe(true);
    expect(entry.constraints).toMatchObject({
      requires_contract_version: "FR-0033.browser_provider_contract.v1",
      minimum_verification_level: "static_checked",
      disallowed_limitations: ["unknown", "diagnostic_only"],
      requires_opt_in: false
    });
    expect(entry.selection_tags.some((tag) => officialChromeTags.has(tag))).toBe(false);
    expect(entry.constraints.out_of_scope_actions).toEqual(
      expect.arrayContaining(["provider_doctor", "runtime_launch", "live_runtime_behavior"])
    );

    expect(declaredOnlyEntry).toMatchObject({
      registry_status: "declared",
      default_eligibility: "not_eligible"
    });
    expect(declaredOnlyEntry.constraints.requires_opt_in).toBe(true);
    expect(declaredOnlyEntry.constraints.out_of_scope_actions).toContain("provider_selection");
  });

  it("locks FR-0037 generic launch envelope references without claiming runtime readiness", () => {
    const envelope = launchEnvelopeFixtures.validGenericLaunchEnvelope;
    const blockedEnvelope = launchEnvelopeFixtures.proxyUnknownBlockedEnvelope;

    expectNoOfficialChromeFixture(envelope);
    expect(envelope.provider).toMatchObject({
      provider_contract_ref: providerContractFixtureIds.contractRef,
      provider_id: providerContractFixtureIds.providerId,
      provider_contract_version: "v1",
      provider_mode: "core_managed",
      capability_refs: [providerContractFixtureIds.capabilityId],
      minimum_verification_level: "static_checked"
    });
    expect(envelope.runtime_bindings.runtime_bootstrap_required).toBe(true);
    expect(envelope.browser_mode).toMatchObject({
      headed: true,
      headless: false,
      real_browser_required: false
    });
    expect(envelope.runtime_bindings.native_messaging_mode).toBe("not_required");
    expect(envelope.evidence_requirements.minimum_attestation_level).toBe("static_checked");
    expect(envelope.evidence_requirements.artifact_policy).toBe("best_effort");
    expect(envelope.limitations).toEqual([]);

    expect(blockedEnvelope.network.proxy_policy).toBe("unknown");
    expect(blockedEnvelope.limitations).toContain("proxy_policy_unknown");
  });

  it("locks FR-0038 doctor output below runtime attestation and keeps target-tab/bootstrap unsatisfied", () => {
    const report = providerDoctorFixtures.genericDoctorReportPendingRuntimeAttestation;
    const capabilityCheck = report.checks.find((check) => check.category === "capability_readiness");

    expectNoOfficialChromeFixture(report);
    expect(report.identity).toMatchObject({
      doctor_contract_version: "v1",
      provider_id: providerContractFixtureIds.providerId,
      provider_contract_version: "v1",
      scope: "capability"
    });
    expect(report.outcome).toMatchObject({
      overall_status: "warn",
      provider_blocked: false,
      blocked_capabilities: [providerContractFixtureIds.capabilityId],
      doctor_verification_level: "doctor_checked",
      next_required_gates: ["runtime_attestation"]
    });
    expect(report.outcome.doctor_verification_level).not.toBe("runtime_attested");
    expect(report.outcome.doctor_verification_level).not.toBe("live_evidence_attested");

    expect(capabilityCheck).toBeDefined();
    expect(capabilityCheck).toMatchObject({
      status: "warn",
      blocking: "capability_blocking",
      capability_id: providerContractFixtureIds.capabilityId
    });
    expect(capabilityCheck?.diagnostics.satisfied_runtime_requirements).toEqual([
      "profile_binding",
      "provider_doctor_passed"
    ]);
    expect(capabilityCheck?.diagnostics.satisfied_runtime_requirements).not.toContain("target_tab");
    expect(capabilityCheck?.diagnostics.satisfied_runtime_requirements).not.toContain("runtime_bootstrap_ready");
    expect(capabilityCheck?.diagnostics.unsatisfied_runtime_requirements).toEqual([
      "target_tab",
      "runtime_bootstrap_ready"
    ]);
  });

  it("locks FR-0040 evidence refs, freshness and minimum redaction hooks", () => {
    const evidenceRecord = providerEvidenceFixtures.genericLaunchAdmissionEvidenceRecord.provider_evidence_record;
    const gapRecord = providerEvidenceFixtures.redactionGapEvidenceRecord.provider_evidence_record;

    expectNoOfficialChromeFixture(evidenceRecord);
    expect(evidenceRecord.identity.base_refs).toEqual([
      "FR-0033.browser_provider_contract.v1",
      "FR-0037.launch_envelope.v1"
    ]);
    expect(evidenceRecord.selected_provider).toMatchObject({
      provider_id: providerContractFixtureIds.providerId,
      provider_contract_ref: providerContractFixtureIds.contractRef,
      provider_contract_version: "v1",
      provider_mode: "core_managed",
      selection_source: "provider_registry"
    });
    expect(evidenceRecord.launch_arguments.launch_envelope_ref).toBe(
      providerContractFixtureIds.launchEnvelopeRef
    );

    const evidenceRefs = evidenceRecord.evidence_refs.map((ref) => ref.evidence_ref_id);
    for (const sectionRef of [
      ...evidenceRecord.selected_provider.selection_evidence_refs,
      ...evidenceRecord.version_evidence.version_evidence_refs,
      ...evidenceRecord.launch_arguments.launch_argument_evidence_refs,
      ...evidenceRecord.profile_reference.profile_evidence_refs
    ]) {
      expect(evidenceRefs).toContain(sectionRef);
    }

    const sensitiveRefs = evidenceRecord.evidence_refs.filter((ref) => ref.sensitivity === "sensitive");
    expect(sensitiveRefs.length).toBeGreaterThan(0);
    for (const ref of sensitiveRefs) {
      expect(ref.redaction_state).toBe("redacted");
      for (const pattern of sensitiveLeakPatterns) {
        expect(ref.ref).not.toMatch(pattern);
      }
    }
    expect(evidenceRecord.evidence_refs.some((ref) => liveEvidenceKinds.has(ref.kind))).toBe(false);
    expect(evidenceRecord.closeout_plan).toMatchObject({
      coverage_status: "complete",
      blocking_reasons: [],
      redaction_gaps: [],
      closeout_decision: "allow"
    });
    expect(evidenceRecord.closeout_plan.next_required_gates).toEqual(["runtime_attestation"]);

    const gapRefsById = new Map(gapRecord.evidence_refs.map((ref) => [ref.evidence_ref_id, ref]));
    expect(gapRecord.closeout_plan).toMatchObject({
      coverage_status: "blocked",
      blocking_reasons: ["redaction_policy_missing"],
      redaction_gaps: ["ev-launch-snapshot"],
      closeout_decision: "deny"
    });
    for (const gapRefId of gapRecord.closeout_plan.redaction_gaps) {
      const ref = asRecord(gapRefsById.get(gapRefId));
      expect(ref.redaction_state).toBe("policy_missing");
      expect(ref.sensitivity).toBe("sensitive");
    }
  });
});
