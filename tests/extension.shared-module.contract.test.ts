import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  APPROVAL_CHECK_KEYS,
  EXECUTION_MODES,
  WRITE_INTERACTION_TIER
} from "../extension/shared/risk-state.js";
import {
  XHS_ALLOWED_DOMAINS,
  evaluateXhsGate
} from "../extension/shared/xhs-gate.js";
import {
  DEFAULT_MIME_TYPE_DESCRIPTORS,
  DEFAULT_PLUGIN_DESCRIPTORS,
  ensureFingerprintRuntimeContext
} from "../extension/shared/fingerprint-profile.js";

const repoRoot = process.cwd();

describe("extension shared module contract", () => {
  it("exports risk-state helpers from the extension root", () => {
    expect(APPROVAL_CHECK_KEYS).toContain("target_domain_confirmed");
    expect(EXECUTION_MODES).toContain("live_write");
    expect(WRITE_INTERACTION_TIER.tiers).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "reversible_interaction" })])
    );
  });

  it("exports fingerprint helpers from the extension root", () => {
    expect(DEFAULT_PLUGIN_DESCRIPTORS.length).toBeGreaterThan(0);
    expect(DEFAULT_MIME_TYPE_DESCRIPTORS.length).toBeGreaterThan(0);
    expect(typeof ensureFingerprintRuntimeContext).toBe("function");
  });

  it("exports xhs gate helpers from the extension root", () => {
    expect(XHS_ALLOWED_DOMAINS.has("www.xiaohongshu.com")).toBe(true);
    const gate = evaluateXhsGate({
      issueScope: "issue_209",
      riskState: "allowed",
      targetDomain: "www.xiaohongshu.com",
      targetTabId: 8,
      targetPage: "search_result_tab",
      actionType: "read",
      requestedExecutionMode: "dry_run"
    });

    expect(gate.consumer_gate_result.gate_decision).toBe("allowed");
    expect(gate.approval_record.approval_id).toBeNull();
  });

  it("keeps the extension risk evidence gate copy synced from shared", () => {
    const sharedSource = readFileSync(join(repoRoot, "shared/risk-evidence-gate.js"), "utf8");
    const extensionSource = readFileSync(
      join(repoRoot, "extension/shared/risk-evidence-gate.js"),
      "utf8"
    );

    expect(extensionSource).toBe(sharedSource);
  });
});
