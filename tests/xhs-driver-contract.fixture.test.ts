import { describe, expect, it } from "vitest";

import { xhsDriverContractFixtures } from "./fixtures/xhs-driver-contract-fixtures.js";

const sensitiveLeakPatterns = [/\/Users\//, /C:\\Users\\/i, /cookie/i, /token/i, /secret/i, /api[_-]?key/i];
const outOfScopePatterns = [/syvert/i, /normalized/i, /live_write/i, /creator\.xiaohongshu\.com/i];

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
};

describe("xhs driver contract fixtures for #1165", () => {
  it("locks success, fallback and fail-closed fixture snippets to WebEnvoy-local read scope", () => {
    const strings = collectStrings(xhsDriverContractFixtures);

    expect(xhsDriverContractFixtures.success.summary.route_evidence).toMatchObject({
      route_role: "primary",
      path_kind: "api",
      route_evidence_class: "active_api_fetch_fallback"
    });
    expect(xhsDriverContractFixtures.fallback.summary.route_evidence).toMatchObject({
      evidence_class: "page_state_fallback",
      page_kind: "user_home"
    });
    expect(xhsDriverContractFixtures.bindingFailure.request_admission_result).toMatchObject({
      admission_decision: "blocked"
    });
    expect(xhsDriverContractFixtures.bindingFailure.xhs_page_runtime_readiness).toMatchObject({
      owner_ref: "#1162",
      page_readiness: {
        status: "blocked"
      },
      provider_admission_readiness: {
        status: "blocked"
      },
      gate_decision: "deny"
    });
    expect(xhsDriverContractFixtures.providerCapabilityFailure.active_api_fetch_fallback_gate.reason_codes).toEqual(
      expect.arrayContaining([
        "FINGERPRINT_VALIDATION_NOT_READY",
        "RUNTIME_ATTESTATION_REQUIRED",
        "EXECUTION_SURFACE_NOT_REAL_BROWSER",
        "HEADLESS_NOT_FALSE"
      ])
    );
    expect(xhsDriverContractFixtures.providerCapabilityFailure.provider_admission_readiness).toMatchObject({
      status: "blocked",
      source: "provider_admission_result"
    });

    for (const pattern of sensitiveLeakPatterns) {
      expect(strings.some((value) => pattern.test(value))).toBe(false);
    }
    for (const pattern of outOfScopePatterns) {
      expect(strings.some((value) => pattern.test(value))).toBe(false);
    }
  });
});
