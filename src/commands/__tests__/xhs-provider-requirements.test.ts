import { describe, expect, it } from "vitest";

import {
  declareXhsDriverProviderRequirementsForContract,
  requiresXhsOfficialChromeRuntimePreparationForContract,
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

    expect(declaration).not.toBeNull();
    if (!declaration) {
      throw new Error("expected read command declaration");
    }
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
        "profile_binding",
        "extension_binding",
        "native_messaging",
        "target_tab",
        "real_browser",
        "headless_forbidden",
        "runtime_bootstrap_ready",
        "provider_doctor_passed"
      ])
    );
    const allowedRuntimeRequirements = new Set([
      "profile_binding",
      "extension_binding",
      "native_messaging",
      "target_tab",
      "real_browser",
      "headless_forbidden",
      "runtime_bootstrap_ready",
      "provider_doctor_passed"
    ]);
    expect(
      declaration.required_runtime_requirements.every((requirement) =>
        allowedRuntimeRequirements.has(requirement)
      )
    ).toBe(true);
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

    expect(declaration).not.toBeNull();
    if (!declaration) {
      throw new Error("expected dry-run read declaration");
    }
    expect(declaration.minimum_support_state).toBe("statically_verified");
    expect(declaration.applies_to_execution_modes).toEqual(["dry_run"]);
    expect(declaration.required_runtime_requirements).toEqual([]);
    expect(requiresXhsProviderRuntimePreparationForContract(declaration)).toBe(false);
  });

  it("does not declare FR-0061 provider requirements for creator/write commands", () => {
    const declaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.creator_publish.admit",
      ability: {
        id: "xhs.creator.publish.v1",
        layer: "L3",
        action: "write"
      },
      requestedExecutionMode: "live_write"
    });

    expect(declaration).toBeNull();
  });

  it("does not declare fallback provider requirement refs for other non-read commands", () => {
    const declaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.editor_text.write",
      ability: {
        id: "xhs.editor.input.v1",
        layer: "L3",
        action: "write"
      },
      requestedExecutionMode: "live_write"
    });

    expect(declaration).toBeNull();
  });

  it("keeps runtime preparation for non-read recon/live commands without FR-0061 provider refs", () => {
    const mediaReconDeclaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.media_upload.discover",
      ability: {
        id: "xhs.creator.publish.v1",
        layer: "L3",
        action: "write"
      },
      requestedExecutionMode: "recon"
    });
    const controlledLiveWriteDeclaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.creator_publish.controlled_live_write",
      ability: {
        id: "xhs.creator.publish.v1",
        layer: "L3",
        action: "write"
      },
      requestedExecutionMode: "live_write"
    });

    expect(mediaReconDeclaration).toBeNull();
    expect(controlledLiveWriteDeclaration).toBeNull();
    expect(
      requiresXhsOfficialChromeRuntimePreparationForContract({
        providerRequirements: mediaReconDeclaration,
        requestedExecutionMode: "recon"
      })
    ).toBe(true);
    expect(
      requiresXhsOfficialChromeRuntimePreparationForContract({
        providerRequirements: controlledLiveWriteDeclaration,
        requestedExecutionMode: "live_write"
      })
    ).toBe(true);
  });

  it("does not declare read provider requirements for the legacy xhs.search editor_input write alias", () => {
    const declaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.search",
      ability: {
        id: "xhs.note.search.v1",
        layer: "L3",
        action: "write"
      },
      requestedExecutionMode: "live_write"
    });

    expect(declaration).toBeNull();
  });

  it("does not declare read provider requirements for xhs.search with the editor ability id", () => {
    const declaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.search",
      ability: {
        id: "xhs.editor.input.v1",
        layer: "L3",
        action: "write"
      },
      requestedExecutionMode: "live_write"
    });

    expect(declaration).toBeNull();
  });

  it("does not declare read provider requirements for xhs.search with mismatched read ability id", () => {
    const declaration = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.search",
      ability: {
        id: "xhs.editor.input.v1",
        layer: "L3",
        action: "read"
      },
      requestedExecutionMode: "live_read_high_risk"
    });

    expect(declaration).toBeNull();
  });
});
