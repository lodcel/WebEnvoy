import { describe, expect, it } from "vitest";
import { asRecord, BackgroundRelay, ContentScriptHandler, waitForResponse } from "./extension.relay.shared.js";

const mediaUploadOptions = {
  issue_scope: "issue_755",
  target_domain: "creator.xiaohongshu.com",
  target_tab_id: 32,
  target_page: "creator_publish_tab",
  action_type: "write",
  requested_execution_mode: "recon",
  discovery_action: "media_upload_path",
  risk_state: "allowed"
} as const;

const createRelay = () => {
  const contentScript = new ContentScriptHandler({
    xhsEnv: {
      now: () => 1_000,
      randomId: () => "relay-media-upload-discovery-id",
      getLocationHref: () => "https://creator.xiaohongshu.com/publish/publish",
      getDocumentTitle: () => "Creator Publish",
      getReadyState: () => "complete",
      getCookie: () => "a1=valid;",
      callSignature: async () => {
        throw new Error("media upload discovery should not request signatures");
      },
      fetchJson: async () => {
        throw new Error("media upload discovery should not hit live fetch");
      },
      performMediaUploadDiscovery: async () => ({
        discovery_action: "media_upload_path",
        target_page: "creator_publish_tab",
        upload_path_catalog: [
          {
            scenario: "image_upload",
            route_role: "primary",
            path_kind: "page",
            entry_type: "file_input",
            file_injection: "data_transfer",
            trigger_events: ["change", "input"],
            progress_signals: ["preview_visible", "uploading", "upload_done"],
            failure_signals: ["type_rejected", "size_rejected", "upload_failed", "risk_blocked"],
            evidence_status: "candidate",
            evidence_maturity: "observed_once",
            notes: "test dry_run/recon only; no file bytes uploaded"
          },
          {
            scenario: "image_upload",
            route_role: "fallback",
            path_kind: "api",
            entry_type: "upload_api",
            file_injection: "api_direct",
            trigger_events: [],
            progress_signals: [],
            failure_signals: ["signature_entry_missing", "request_context_missing", "risk_blocked"],
            evidence_status: "candidate",
            evidence_maturity: "observed_once",
            notes: "fallback candidate only"
          }
        ],
        file_selection_boundary: {
          file_bytes_read: false,
          native_picker_opened: false,
          data_transfer_injected: false,
          real_upload_attempted: false,
          allowed_modes: ["dry_run", "recon"]
        },
        submitted: false,
        published: false,
        out_of_scope_actions: [
          "file_picker_open",
          "file_bytes_read",
          "data_transfer_injection",
          "submit",
          "publish_confirm"
        ]
      })
    }
  });
  return new BackgroundRelay(contentScript, { forwardTimeoutMs: 200 });
};

describe("extension background relay / media upload discovery", () => {
  it("returns upload path catalog in recon without opening picker or uploading files", async () => {
    const relay = createRelay();
    const responsePromise = waitForResponse(relay);
    relay.onNativeRequest({
      id: "forward-xhs-issue-755-media-upload-discovery-001",
      method: "bridge.forward",
      params: {
        session_id: "nm-session-001",
        run_id: "run-xhs-issue-755-media-upload-discovery-001",
        command: "xhs.media_upload.discover",
        command_params: {
          ability: {
            id: "xhs.creator.publish.v1",
            layer: "L3",
            action: "write"
          },
          input: {},
          options: mediaUploadOptions
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
        target_page: "creator_publish_tab",
        discovery_action: "media_upload_path"
      }
    });
    expect(summary.consumer_gate_result).toMatchObject({
      issue_scope: "issue_755",
      target_domain: "creator.xiaohongshu.com",
      target_tab_id: 32,
      target_page: "creator_publish_tab",
      requested_execution_mode: "recon",
      gate_decision: "allowed"
    });
    const mediaUploadDiscovery = asRecord(summary.media_upload_discovery);
    expect(mediaUploadDiscovery).toMatchObject({
      discovery_action: "media_upload_path",
      target_page: "creator_publish_tab",
      submitted: false,
      published: false
    });
    expect(mediaUploadDiscovery?.file_selection_boundary).toMatchObject({
      file_bytes_read: false,
      native_picker_opened: false,
      data_transfer_injected: false,
      real_upload_attempted: false
    });
    expect(summary.upload_path_catalog).toEqual(mediaUploadDiscovery?.upload_path_catalog);
  });
});
