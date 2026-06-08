import { describe, expect, it } from "vitest";

import { evaluateServiceWorkerCodeIdentityObservation } from "../service-worker-code-identity.js";

const baseInput = () => ({
  extensionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  expectedExtensionBundleIdentityLocator:
    "extension-bundle/official-chrome.persistent/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/service-worker/build/background.js",
  observedActiveServiceWorkerScriptIdentityLocator:
    "extension-service-worker/official-chrome.persistent/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/script-cache/current",
  expectedBundleDigestLocator: "sha256:expected",
  observedServiceWorkerCodeDigestLocator: "sha256:expected",
  activeWorkerLifecycleState: "script_cache_observed" as const,
  observedAt: "2026-06-08T16:10:00.000Z",
  remediationHint: "refresh managed profile Service Worker cache",
  rawPathDenylist: [
    "/Users/example/WebEnvoy/extension",
    "/Users/example/.webenvoy/profiles/xhs_001/Default/Service Worker"
  ]
});

describe("service worker code identity observation", () => {
  it("maps matching expected and observed digests to a FR-0038 extension_load pass", () => {
    const observation = evaluateServiceWorkerCodeIdentityObservation(baseInput());

    expect(observation).toMatchObject({
      freshness_comparison_result: "match",
      active_worker_lifecycle_state: "script_cache_observed",
      provider_doctor_extension_load_check: {
        category: "extension_load",
        status: "pass",
        severity: "info",
        blocking: "none",
        capability_id: "N/A",
        diagnostics: {
          code: "service_worker_fresh",
          observed: "sha256:expected",
          expected: "sha256:expected"
        }
      }
    });
    expect(
      Array.isArray(observation.provider_doctor_extension_load_check.diagnostics)
    ).toBe(false);
    const legacyObservedKey = "observed" + "_value";
    const legacyExpectedKey = "expected" + "_value";
    expect(JSON.stringify(observation.provider_doctor_extension_load_check.diagnostics)).not.toContain(
      legacyObservedKey
    );
    expect(JSON.stringify(observation.provider_doctor_extension_load_check.diagnostics)).not.toContain(
      legacyExpectedKey
    );
  });

  it("fails closed when the observed service worker digest is stale", () => {
    const observation = evaluateServiceWorkerCodeIdentityObservation({
      ...baseInput(),
      observedServiceWorkerCodeDigestLocator: "sha256:stale"
    });

    expect(observation.provider_doctor_extension_load_check).toMatchObject({
      status: "fail",
      severity: "error",
      blocking: "provider_blocking",
      diagnostics: {
        code: "service_worker_stale",
        observed: "sha256:stale",
        expected: "sha256:expected"
      }
    });
  });

  it("fails closed when expected identity is missing", () => {
    const observation = evaluateServiceWorkerCodeIdentityObservation({
      ...baseInput(),
      expectedExtensionBundleIdentityLocator: null,
      expectedBundleDigestLocator: null
    });

    expect(observation).toMatchObject({
      freshness_comparison_result: "expected_identity_missing",
      provider_doctor_extension_load_check: {
        status: "fail",
        severity: "fatal",
        blocking: "provider_blocking"
      }
    });
  });

  it("reports unknown when observed service worker identity is missing", () => {
    const observation = evaluateServiceWorkerCodeIdentityObservation({
      ...baseInput(),
      observedActiveServiceWorkerScriptIdentityLocator: null,
      observedServiceWorkerCodeDigestLocator: null
    });

    expect(observation.provider_doctor_extension_load_check).toMatchObject({
      status: "unknown",
      severity: "error",
      blocking: "provider_blocking",
      diagnostics: {
        code: "service_worker_observed_identity_missing"
      }
    });
  });

  it("keeps disconnected observation channels unknown rather than pass", () => {
    const observation = evaluateServiceWorkerCodeIdentityObservation({
      ...baseInput(),
      observedActiveServiceWorkerScriptIdentityLocator: null,
      observedServiceWorkerCodeDigestLocator: null,
      activeWorkerLifecycleState: "unavailable"
    });

    expect(observation).toMatchObject({
      freshness_comparison_result: "observed_identity_missing",
      provider_doctor_extension_load_check: {
        status: "unknown",
        blocking: "provider_blocking"
      }
    });
  });

  it("fails closed when a locator leaks a raw path", () => {
    const observation = evaluateServiceWorkerCodeIdentityObservation({
      ...baseInput(),
      observedActiveServiceWorkerScriptIdentityLocator:
        "/Users/example/.webenvoy/profiles/xhs_001/Default/Service Worker/ScriptCache/worker.js"
    });

    expect(observation).toMatchObject({
      freshness_comparison_result: "redaction_invalid",
      active_worker_lifecycle_state: "redaction_invalid",
      provider_doctor_extension_load_check: {
        status: "fail",
        severity: "error",
        blocking: "provider_blocking",
        diagnostics: {
          code: "service_worker_evidence_redaction_invalid"
        }
      }
    });
  });

  it("does not put raw profile or extension paths into generated refs", () => {
    const observation = evaluateServiceWorkerCodeIdentityObservation(baseInput());
    const serialized = JSON.stringify(observation);

    expect(serialized).not.toContain("/Users/example/WebEnvoy/extension");
    expect(serialized).not.toContain("/Users/example/.webenvoy/profiles/xhs_001");
  });
});
