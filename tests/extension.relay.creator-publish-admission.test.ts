import { describe, expect, it } from "vitest";
import { asRecord, waitForResponse, BackgroundRelay, ContentScriptHandler } from "./extension.relay.shared.js";

const readyProfileOptions = {
  profile_readiness: {
    profile: "profile-a",
    profile_state: "ready",
    ready: true
  },
  account_readiness: {
    state: "clear",
    live_commands_blocked: false,
    ready: true
  }
} as const;

const providerRequirementRef =
  "issue-1179.xhs_creator_publish_admit_provider_requirements.v1/write_admit";

const xhsDriverProviderRequirements = {
  declaration_id: "xhs-driver-provider-requirements:xhs.creator_publish.admit:write_admit:v1",
  declaration_version: "v1",
  provider_requirement_ref: providerRequirementRef,
  provider_requirement_refs: [providerRequirementRef],
  live_write_capability_gate_result: {
    taxonomy_version: "v1",
    requested_capability_level: "write_admit",
    effective_capability_level: "write_admit",
    gate_status: "ready_for_downstream_gate",
    decision: "allow",
    blocking_reasons: [],
    downstream_owner: "#1180",
    evidence_refs_consumed: [providerRequirementRef],
    verified_at: "N/A"
  },
  default_live_write_commit_lock: "locked"
} as const;

const creatorPublishOptions = {
  issue_scope: "issue_753",
  target_domain: "creator.xiaohongshu.com",
  target_tab_id: 32,
  target_page: "creator_publish_tab",
  action_type: "write",
  requested_execution_mode: "dry_run",
  risk_state: "allowed",
  xhs_driver_provider_requirements: xhsDriverProviderRequirements,
  provider_requirement_refs: [providerRequirementRef],
  ...readyProfileOptions
} as const;

const createRelay = () => {
  const contentScript = new ContentScriptHandler({
    xhsEnv: {
      now: () => 1_000,
      randomId: () => "relay-creator-publish-admit-id",
      getLocationHref: () => "https://creator.xiaohongshu.com/publish/publish",
      getDocumentTitle: () => "Creator Publish",
      getReadyState: () => "complete",
      getCookie: () => "a1=valid;",
      callSignature: async () => {
        throw new Error("creator publish admission should not request signatures");
      },
      fetchJson: async () => {
        throw new Error("creator publish admission should not hit live fetch");
      }
    }
  });
  return new BackgroundRelay(contentScript, { forwardTimeoutMs: 200 });
};

describe("extension background relay / creator publish admission", () => {
  it("admits creator publish target binding in dry_run without live write side effects", async () => {
    const relay = createRelay();
    const responsePromise = waitForResponse(relay);
    relay.onNativeRequest({
      id: "forward-xhs-issue-753-admit-001",
      method: "bridge.forward",
      params: {
        session_id: "nm-session-001",
        run_id: "run-xhs-issue-753-admit-001",
        command: "xhs.creator_publish.admit",
        command_params: {
          ability: {
            id: "xhs.creator.publish.v1",
            layer: "L3",
            action: "write"
          },
          input: {},
          options: creatorPublishOptions
        },
        cwd: "/workspace/WebEnvoy"
      },
      profile: "profile-a",
      timeout_ms: 200
    });

    const response = await responsePromise;
    expect(response.status).toBe("success");
    const payload = asRecord(response.payload) ?? {};
    const summary = asRecord(payload.summary) ?? {};
    expect(summary.capability_result).toMatchObject({
      ability_id: "xhs.creator.publish.v1",
      action: "write",
      outcome: "partial",
      data_ref: {
        target_page: "creator_publish_tab"
      }
    });
    expect(summary.consumer_gate_result).toMatchObject({
      issue_scope: "issue_753",
      target_domain: "creator.xiaohongshu.com",
      target_tab_id: 32,
      target_page: "creator_publish_tab",
      requested_execution_mode: "dry_run",
      gate_decision: "allowed"
    });
    const targetAdmission = asRecord(summary.target_admission);
    expect(targetAdmission).toMatchObject({
      target_domain: "creator.xiaohongshu.com",
      target_tab_id: 32,
      target_page: "creator_publish_tab",
      profile_readiness: readyProfileOptions.profile_readiness,
      account_readiness: readyProfileOptions.account_readiness,
      provider_requirement_refs: [providerRequirementRef],
      xhs_driver_provider_requirements: xhsDriverProviderRequirements,
      live_write_capability_gate_result: {
        effective_capability_level: "write_admit",
        gate_status: "ready_for_downstream_gate",
        decision: "allow"
      },
      default_live_write_commit_lock: "locked"
    });
    expect(targetAdmission?.out_of_scope_actions).toEqual([
      "editor_text_write",
      "image_upload",
      "submit",
      "publish_confirm"
    ]);
  });

  it("fails closed when profile or account readiness is not clear", async () => {
    const relay = createRelay();
    const responsePromise = waitForResponse(relay);
    relay.onNativeRequest({
      id: "forward-xhs-issue-753-not-ready-001",
      method: "bridge.forward",
      params: {
        session_id: "nm-session-001",
        run_id: "run-xhs-issue-753-not-ready-001",
        command: "xhs.creator_publish.admit",
        command_params: {
          ability: {
            id: "xhs.creator.publish.v1",
            layer: "L3",
            action: "write"
          },
          input: {},
          options: {
            ...creatorPublishOptions,
            profile_readiness: {
              profile: "profile-a",
              profile_state: "stopped",
              ready: false
            },
            account_readiness: {
              state: "account_risk_blocked",
              live_commands_blocked: true,
              ready: false
            },
            admission_gate_reasons: ["PROFILE_NOT_READY", "ACCOUNT_SAFETY_NOT_READY"]
          }
        },
        cwd: "/workspace/WebEnvoy"
      },
      profile: "profile-a",
      timeout_ms: 200
    });

    const response = await responsePromise;
    expect(response.status).toBe("error");
    expect(response.error?.code).toBe("ERR_EXECUTION_FAILED");
    const payload = asRecord(response.payload) ?? {};
    const consumerGateResult = asRecord(payload.consumer_gate_result);
    expect(consumerGateResult).toMatchObject({
      issue_scope: "issue_753",
      gate_decision: "blocked",
      effective_execution_mode: "dry_run"
    });
    expect(consumerGateResult?.gate_reasons).toEqual(
      expect.arrayContaining(["PROFILE_NOT_READY", "ACCOUNT_SAFETY_NOT_READY"])
    );
    expect(payload.execution_audit ?? null).toBeNull();
  });
});
