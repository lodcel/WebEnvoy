import { describe, expect, it } from "vitest";

import {
  buildAccountSafetyGateResult,
  buildBlockedAccountSafetyRecord,
  buildClearAccountSafetyRecord,
  type AccountSafetyEvidenceRefsV1,
  type AccountSafetyGateScopeV1
} from "../account-safety.js";

const scope: AccountSafetyGateScopeV1 = {
  schema_version: "account-safety-gate.v1",
  capability_level: "write_prepare",
  workflow_ref: "xhs.creator_publish.admit",
  target_domain: "creator.xiaohongshu.com",
  target_page: "creator_publish_tab",
  profile_ref: "profile:redacted",
  browser_channel: "Google Chrome stable",
  execution_surface: "real_browser",
  provider_requirement_ref: "issue-1179/provider",
  runtime_target_binding_ref: "target-binding/current",
  operator_unlock_ref: null,
  head_sha: "head-test",
  run_id: "run-account-safety-test",
  evaluation_context_ref: "evaluation/account-safety-test"
};

const evidenceRefs: AccountSafetyEvidenceRefsV1 = {
  safety_check_ref: "artifact/account-safety/check",
  profile_ref: "profile:redacted",
  runtime_status_ref: "artifact/runtime-status",
  target_binding_ref: "artifact/target-binding",
  signal_scan_ref: "artifact/account-safety/signals",
  redaction_policy_ref: "FR-0041.evidence_redaction_policy.v1",
  freshness_ref: "artifact/account-safety/freshness",
  risk_disposition_ref: "artifact/account-safety/risk-disposition"
};

describe("account safety gate result", () => {
  it("fails closed when the account safety state record is missing", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: null,
        evaluatedAt: "2026-06-12T00:00:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      schema_version: "account-safety-gate.v1",
      gate_status: "unknown",
      decision: "deny",
      blocking_reasons: ["account_safety_state_missing"],
      account_safety_ref: null
    });
  });

  it("maps persisted account-risk signals to FR-0066 blocking reasons", () => {
    const record = buildBlockedAccountSafetyRecord({
      reason: "CAPTCHA_REQUIRED",
      observedAt: "2026-06-12T00:00:00.000Z",
      sourceRunId: "run-risk-signal",
      sourceCommand: "xhs.search",
      targetDomain: "creator.xiaohongshu.com",
      targetTabId: 32,
      pageUrl: "https://creator.xiaohongshu.com/publish/publish",
      statusCode: 429,
      platformCode: null
    });

    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: record,
        evaluatedAt: "2026-06-12T00:01:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      gate_status: "blocked",
      decision: "deny",
      blocking_reasons: ["account_safety_blocked", "captcha_required"]
    });
  });

  it("allows only the account safety lane for an exact-scope clear record", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: buildClearAccountSafetyRecord(),
        evaluatedAt: "2026-06-12T00:00:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      gate_status: "clear",
      decision: "allow",
      blocking_reasons: [],
      downstream_owner: "none"
    });
  });

  it("fails closed when a scoped account safety record drifts to another target", () => {
    const record = buildBlockedAccountSafetyRecord({
      reason: "ACCOUNT_ABNORMAL",
      observedAt: "2026-06-12T00:00:00.000Z",
      sourceRunId: "run-risk-signal",
      sourceCommand: "xhs.search",
      targetDomain: "www.xiaohongshu.com",
      targetTabId: 32,
      pageUrl: "https://www.xiaohongshu.com/search_result?keyword=test",
      statusCode: 461,
      platformCode: 300011
    });

    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: record,
        evaluatedAt: "2026-06-12T00:00:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      gate_status: "blocked",
      decision: "deny",
      blocking_reasons: [
        "account_safety_scope_mismatch",
        "account_safety_blocked",
        "account_restricted"
      ]
    });
  });
});
