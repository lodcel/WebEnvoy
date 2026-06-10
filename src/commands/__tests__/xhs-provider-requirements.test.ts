import { describe, expect, it } from "vitest";

import {
  declareXhsDriverProviderRequirementsForContract,
  requiresXhsProviderRuntimePreparationForContract
} from "../xhs.js";

describe("XHS provider requirement declarations", () => {
  it("declares provider-neutral read requirements for XHS read commands", () => {
    const declaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.search",
      ability: {
        id: "xhs.note.search.v1",
        layer: "L3",
        action: "read"
      },
      requestedExecutionMode: "live_read_high_risk"
    });

    expect(declaration).toMatchObject({
      declaration_version: "v1",
      driver_contract_ref: "FR-0061.xhs_driver_contract.v1",
      provider_requirement_ref: "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read",
      ability_scope: {
        command: "xhs.search",
        ability_id: "xhs.note.search.v1",
        ability_layer: "L3",
        ability_action: "read"
      },
      required_actions: ["read", "diagnose"],
      required_execution_layers: ["L3"],
      minimum_support_state: "runtime_attested",
      provider_contract_refs: ["FR-0033.browser_provider_contract.v1"],
      capability_verification_ref: "FR-0035.provider_capability_verification_model.v1",
      evidence_policy_refs: [
        "FR-0040.provider_evidence_record.v1",
        "FR-0041.evidence_redaction_policy.v1"
      ],
      provider_requirement_refs: [
        "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read"
      ],
      downstream_slice_refs: ["#1166", "#1167", "#1168"]
    });
    expect(declaration.required_runtime_requirements).toEqual(
      expect.arrayContaining([
        "browser_in_page_execution",
        "profile_binding",
        "extension_binding",
        "native_messaging",
        "target_tab_binding",
        "real_browser",
        "headless_forbidden",
        "provider_evidence_ref",
        "runtime_attestation"
      ])
    );
    expect(JSON.stringify(declaration)).not.toContain("official_chrome");
    expect(JSON.stringify(declaration)).not.toContain("CloakBrowser");
    expect(requiresXhsProviderRuntimePreparationForContract(declaration)).toBe(true);
  });

  it("keeps dry-run requirements static and does not require runtime preparation", () => {
    const declaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.detail",
      ability: {
        id: "xhs.note.detail.v1",
        layer: "L3",
        action: "read"
      },
      requestedExecutionMode: "dry_run"
    });

    expect(declaration.minimum_support_state).toBe("statically_verified");
    expect(declaration.applies_to_execution_modes).toEqual(["dry_run"]);
    expect(requiresXhsProviderRuntimePreparationForContract(declaration)).toBe(false);
  });

  it("keeps creator publish admit as diagnostic-only input for downstream live-write gates", () => {
    const declaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.creator_publish.admit",
      ability: {
        id: "xhs.creator.publish.v1",
        layer: "L3",
        action: "write"
      },
      requestedExecutionMode: "live_write"
    });

    expect(declaration).toMatchObject({
      provider_requirement_ref:
        "FR-0061.xhs_driver_provider_requirements.v1/xhs.creator_publish.admit.diagnose",
      required_actions: ["diagnose"],
      minimum_support_state: "runtime_attested",
      downstream_slice_refs: ["#1179"]
    });
    expect(declaration.required_actions).not.toContain("write");
    expect(declaration.non_proofs).toContain(
      "driver_requirement_declaration_does_not_enable_write"
    );
    expect(requiresXhsProviderRuntimePreparationForContract(declaration)).toBe(true);
  });
});
