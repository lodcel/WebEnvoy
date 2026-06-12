import { describe, expect, it } from "vitest";

import {
  buildAccountSafetyGateResult,
  buildBlockedAccountSafetyRecord,
  buildClearAccountSafetyRecord,
  type AccountSafetyEvidenceRefsV1,
  type AccountSafetyGateScopeV1,
  type AccountSafetyStateRecordV1
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

const liveWriteCommitScope: AccountSafetyGateScopeV1 = {
  ...scope,
  capability_level: "live_write_commit",
  operator_unlock_ref: "FR-0064.operator_unlock/redacted-current-scope"
};

const liveWriteCommitEvidenceRefs: AccountSafetyEvidenceRefsV1 = {
  ...evidenceRefs,
  operator_unlock_ref: "FR-0064.operator_unlock/redacted-current-scope",
  default_commit_lock_ref: "FR-0068.default_commit_lock/redacted-current-scope",
  live_evidence_gate_ref: "FR-0032.live_evidence_gate/redacted-current-scope"
};

const clearStateRecord = (
  overrides: Partial<Omit<AccountSafetyStateRecordV1, "scope" | "evidence_refs">> & {
    scope?: Partial<AccountSafetyGateScopeV1>;
    evidence_refs?: Partial<AccountSafetyEvidenceRefsV1>;
  } = {}
): AccountSafetyStateRecordV1 => {
  const { scope: scopeOverrides, evidence_refs: evidenceRefOverrides, ...recordOverrides } = overrides;
  return {
    schema_version: "account-safety-gate.v1",
    safety_state_id: "account-safety-state/current-clear",
    canonical_issue_ref: "#1176",
    scope: {
      ...scope,
      ...scopeOverrides
    },
    state: "clear",
    signal_classes: [],
    evidence_refs: {
      ...evidenceRefs,
      ...evidenceRefOverrides
    },
    checked_at: "2026-06-12T00:00:00.000Z",
    expires_at: "2026-06-12T00:30:00.000Z",
    redaction_state: "redacted",
    ...recordOverrides
  } as AccountSafetyStateRecordV1;
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

  it("allows only the account safety lane for a current FR-0066 exact-scope clear state record", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: clearStateRecord(),
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      gate_status: "clear",
      decision: "allow",
      blocking_reasons: [],
      downstream_owner: "none",
      account_safety_ref: "account-safety-state/current-clear",
      evidence_refs_consumed: expect.arrayContaining([
        evidenceRefs.safety_check_ref,
        evidenceRefs.freshness_ref,
        evidenceRefs.target_binding_ref,
        evidenceRefs.risk_disposition_ref
      ])
    });
  });

  it("allows live_write_commit only with current exact-scope commit refs", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "live_write_commit",
        requestedScope: liveWriteCommitScope,
        accountSafetyRecord: clearStateRecord({
          scope: liveWriteCommitScope,
          evidence_refs: liveWriteCommitEvidenceRefs
        }),
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs: liveWriteCommitEvidenceRefs
      })
    ).toMatchObject({
      gate_status: "clear",
      decision: "allow",
      blocking_reasons: [],
      evidence_refs_consumed: expect.arrayContaining([
        liveWriteCommitEvidenceRefs.operator_unlock_ref,
        liveWriteCommitEvidenceRefs.default_commit_lock_ref,
        liveWriteCommitEvidenceRefs.live_evidence_gate_ref
      ])
    });
  });

  it.each([
    {
      name: "requested operator unlock ref",
      requestedScope: { ...liveWriteCommitScope, operator_unlock_ref: null },
      evidenceRefs: liveWriteCommitEvidenceRefs,
      record: clearStateRecord({
        scope: liveWriteCommitScope,
        evidence_refs: liveWriteCommitEvidenceRefs
      })
    },
    {
      name: "state record operator unlock ref",
      requestedScope: liveWriteCommitScope,
      evidenceRefs: liveWriteCommitEvidenceRefs,
      record: clearStateRecord({
        scope: { ...liveWriteCommitScope, operator_unlock_ref: null },
        evidence_refs: liveWriteCommitEvidenceRefs
      })
    },
    {
      name: "default commit lock ref",
      requestedScope: liveWriteCommitScope,
      evidenceRefs: {
        ...liveWriteCommitEvidenceRefs,
        default_commit_lock_ref: undefined as unknown as string
      },
      record: clearStateRecord({
        scope: liveWriteCommitScope,
        evidence_refs: liveWriteCommitEvidenceRefs
      })
    },
    {
      name: "live evidence gate ref",
      requestedScope: liveWriteCommitScope,
      evidenceRefs: {
        ...liveWriteCommitEvidenceRefs,
        live_evidence_gate_ref: undefined as unknown as string
      },
      record: clearStateRecord({
        scope: liveWriteCommitScope,
        evidence_refs: liveWriteCommitEvidenceRefs
      })
    }
  ] as const)("fails live_write_commit closed when $name is missing", ({ requestedScope, evidenceRefs, record }) => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "live_write_commit",
        requestedScope,
        accountSafetyRecord: record,
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      decision: "deny",
      blocking_reasons: expect.arrayContaining(["safety_evidence_missing"])
    });
  });

  it("fails live_write_commit closed when commit refs drift", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "live_write_commit",
        requestedScope: liveWriteCommitScope,
        accountSafetyRecord: clearStateRecord({
          scope: {
            ...liveWriteCommitScope,
            operator_unlock_ref: "FR-0064.operator_unlock/other-scope"
          },
          evidence_refs: {
            ...liveWriteCommitEvidenceRefs,
            default_commit_lock_ref: "FR-0068.default_commit_lock/other-scope"
          }
        }),
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs: liveWriteCommitEvidenceRefs
      })
    ).toMatchObject({
      decision: "deny",
      blocking_reasons: expect.arrayContaining(["account_safety_scope_mismatch"])
    });
  });

  it("does not allow from a legacy clear profile record without a current FR-0066 state record", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: buildClearAccountSafetyRecord(),
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      gate_status: "unknown",
      decision: "deny",
      blocking_reasons: ["historical_or_stale_evidence"]
    });
  });

  it("fails closed when current state record freshness is missing", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: clearStateRecord({
          checked_at: undefined as unknown as string
        }),
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      gate_status: "unknown",
      decision: "deny",
      blocking_reasons: ["safety_evidence_missing"]
    });
  });

  it("fails closed when the current state record freshness ref is missing", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: clearStateRecord({
          evidence_refs: {
            freshness_ref: undefined as unknown as string
          }
        }),
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      gate_status: "unknown",
      decision: "deny",
      blocking_reasons: ["safety_evidence_missing"]
    });
  });

  it("fails closed when current state record freshness is stale", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: clearStateRecord({
          expires_at: "2026-06-12T00:05:00.000Z"
        }),
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      gate_status: "stale",
      decision: "deny",
      blocking_reasons: expect.arrayContaining([
        "account_safety_stale",
        "safety_evidence_stale"
      ])
    });
  });

  it("fails closed when current state record redaction is invalid", () => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: clearStateRecord({
          redaction_state: "policy_missing"
        }),
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      gate_status: "redaction_invalid",
      decision: "deny",
      blocking_reasons: ["safety_evidence_redaction_invalid"]
    });
  });

  it.each([
    {
      name: "head drift",
      record: clearStateRecord({ scope: { head_sha: "head-drift" } }),
      reason: "account_safety_head_mismatch"
    },
    {
      name: "run drift",
      record: clearStateRecord({ scope: { run_id: "run-drift" } }),
      reason: "account_safety_run_mismatch"
    },
    {
      name: "profile drift",
      record: clearStateRecord({ scope: { profile_ref: "profile:other" } }),
      reason: "account_safety_scope_mismatch"
    },
    {
      name: "browser drift",
      record: clearStateRecord({ scope: { browser_channel: "Chromium test channel" } }),
      reason: "account_safety_scope_mismatch"
    },
    {
      name: "target domain drift",
      record: clearStateRecord({ scope: { target_domain: "www.xiaohongshu.com" } }),
      reason: "account_safety_scope_mismatch"
    },
    {
      name: "target page drift",
      record: clearStateRecord({ scope: { target_page: "search_result_tab" } }),
      reason: "account_safety_scope_mismatch"
    },
    {
      name: "provider drift",
      record: clearStateRecord({ scope: { provider_requirement_ref: "issue-1179/provider-drift" } }),
      reason: "account_safety_scope_mismatch"
    },
    {
      name: "runtime binding drift",
      record: clearStateRecord({ scope: { runtime_target_binding_ref: "target-binding/drift" } }),
      reason: "account_safety_scope_mismatch"
    }
  ] as const)("fails closed on current state record $name", ({ record, reason }) => {
    expect(
      buildAccountSafetyGateResult({
        requestedCapabilityLevel: "write_prepare",
        requestedScope: scope,
        accountSafetyRecord: record,
        evaluatedAt: "2026-06-12T00:10:00.000Z",
        evidenceRefs
      })
    ).toMatchObject({
      decision: "deny",
      blocking_reasons: expect.arrayContaining([reason])
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
