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
      performMediaUploadDiscovery: async (input) => ({
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
          submit_attempted: false,
          publish_attempted: false,
          allowed_modes: ["dry_run", "recon"]
        },
        controlled_upload_evidence: {
          schema_version: "fr-0032.controlled_upload_path.v1",
          non_publish_validation: true,
          run_id: input?.run_id ?? "missing-run",
          profile_ref: input?.profile_ref ?? null,
          target_tab_id: input?.target_tab_id ?? null,
          page_url: input?.page_url ?? "",
          upload_artifact_identity: {
            upload_artifact_id: "upload-artifact/fr-0032/run-xhs-issue-845-controlled-upload-001/sha256",
            source_media_ref: input?.source_media_ref ?? "media-ref/fr-0032/fixture-image-a",
            source_media_digest:
              input?.source_media_digest ??
              "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            source_media_kind: "image",
            platform_staging_ref: null,
            page_preview_locator: "input[type=file]",
            accepted_by_platform: false,
            visible_in_editor: false,
            captured_at: "2026-05-28T00:00:00.000Z"
          },
          file_selection_boundary: {
            file_bytes_read: false,
            native_picker_opened: false,
            data_transfer_injected: false,
            real_upload_attempted: false,
            submit_attempted: false,
            publish_attempted: false,
            allowed_modes: ["dry_run", "recon"]
          },
          stop_signal: null,
          submitted: false,
          published: false
        },
        controlled_upload_evaluation: {
          schema_version: "fr-0032.controlled_upload_evaluation.v1",
          decision: "NO_GO",
          upload_success: false,
          full_live_write_success: false,
          non_publish_validation: true,
          blockers: [
            {
              blocker_code: "UPLOAD_PLATFORM_REJECTED",
              message: "dry_run/recon does not attempt real platform upload or claim platform acceptance"
            },
            {
              blocker_code: "UPLOAD_PREVIEW_NOT_VISIBLE",
              message: "dry_run/recon does not inject DataTransfer or claim editor preview success"
            }
          ]
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
      real_upload_attempted: false,
      submit_attempted: false,
      publish_attempted: false
    });
    expect(summary.upload_path_catalog).toEqual(mediaUploadDiscovery?.upload_path_catalog);
  });

  it("returns controlled upload artifact identity without file picker, DataTransfer, submit or publish", async () => {
    const relay = createRelay();
    const responsePromise = waitForResponse(relay);
    relay.onNativeRequest({
      id: "forward-xhs-issue-845-controlled-upload-001",
      method: "bridge.forward",
      params: {
        session_id: "nm-session-001",
        run_id: "run-xhs-issue-845-controlled-upload-001",
        command: "xhs.media_upload.discover",
        command_params: {
          ability: {
            id: "xhs.creator.publish.v1",
            layer: "L3",
            action: "write"
          },
          input: {
            source_media_ref: "media-ref/fr-0032/fixture-image-a",
            source_media_digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            source_media_kind: "image"
          },
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
    const controlledUploadEvidence = asRecord(summary.controlled_upload_evidence);
    expect(controlledUploadEvidence).toMatchObject({
      schema_version: "fr-0032.controlled_upload_path.v1",
      non_publish_validation: true,
      run_id: "run-xhs-issue-845-controlled-upload-001",
      submitted: false,
      published: false
    });
    expect(controlledUploadEvidence?.upload_artifact_identity).toMatchObject({
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      source_media_kind: "image",
      accepted_by_platform: false,
      visible_in_editor: false
    });
    expect(controlledUploadEvidence?.file_selection_boundary).toMatchObject({
      file_bytes_read: false,
      native_picker_opened: false,
      data_transfer_injected: false,
      real_upload_attempted: false,
      submit_attempted: false,
      publish_attempted: false
    });
    expect(summary.controlled_upload_evaluation).toMatchObject({
      schema_version: "fr-0032.controlled_upload_evaluation.v1",
      decision: "NO_GO",
      upload_success: false,
      full_live_write_success: false,
      non_publish_validation: true,
      blockers: expect.arrayContaining([
        expect.objectContaining({ blocker_code: "UPLOAD_PLATFORM_REJECTED" }),
        expect.objectContaining({ blocker_code: "UPLOAD_PREVIEW_NOT_VISIBLE" })
      ])
    });
  });
});
