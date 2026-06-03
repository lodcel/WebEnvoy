import { describe, expect, it } from "vitest";
import { asRecord, BackgroundRelay, ContentScriptHandler, waitForResponse } from "./extension.relay.shared.js";
import { buildXhsMediaUploadDiscoveryResult } from "../extension/xhs-media-upload-discovery.js";

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
        creator_publish_controls_recon: {
          schema_version: "fr-0032.creator_publish_controls_recon.v1",
          no_write: true,
          target_page: "creator_publish_tab",
          page_url: input?.page_url ?? "",
          collected_at: "2026-05-28T00:00:00.000Z",
          recording_policy: "locator_attributes_flags_and_lengths_only",
          controls: [
            {
              role: "private_visibility",
              required_for_live_write: true,
              status: "ready",
              candidate_count: 1,
              selected_locator: "div.visibility-select",
              candidates: []
            },
            {
              role: "submit_or_next",
              required_for_live_write: true,
              status: "ready",
              candidate_count: 1,
              selected_locator: "button.next",
              candidates: []
            },
            {
              role: "publish_or_confirm",
              required_for_live_write: true,
              status: "ready",
              candidate_count: 1,
              selected_locator: "button.publish",
              candidates: []
            },
            {
              role: "error_or_toast",
              required_for_live_write: true,
              status: "ready",
              candidate_count: 1,
              selected_locator: "div.toast",
              candidates: []
            },
            {
              role: "cleanup_or_abandon",
              required_for_live_write: true,
              status: "ready",
              candidate_count: 1,
              selected_locator: "button.delete",
              candidates: []
            }
          ],
          blocker_candidates: [],
          file_selection_boundary: {
            file_bytes_read: false,
            native_picker_opened: false,
            data_transfer_injected: false,
            real_upload_attempted: false,
            submit_attempted: false,
            publish_attempted: false,
            allowed_modes: ["dry_run", "recon"]
          }
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
            captured_at: "2026-05-28T00:00:00.000Z",
            preview_diagnostics: null
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
          decision: "EVIDENCE_PRESENT",
          upload_success: false,
          full_live_write_success: false,
          non_publish_validation: true,
          entry_gate_evaluated: false,
          runtime_evaluator_required_for_entry_gate: true,
          non_publish_evidence_status: "EVIDENCE_PRESENT",
          later_write_actions_blocked: false,
          cleanup_required: false,
          limitations: [
            {
              limitation_code: "REAL_UPLOAD_NOT_ATTEMPTED",
              message: "dry_run/recon does not attempt real platform upload or claim platform acceptance"
            },
            {
              limitation_code: "EDITOR_PREVIEW_NOT_ASSERTED",
              message: "dry_run/recon does not inject DataTransfer or claim editor preview success"
            },
            {
              limitation_code: "ENTRY_GATE_NOT_EVALUATED",
              message: "extension dry_run/recon evidence does not evaluate FR-0032 runtime entry gate"
            }
          ],
          blockers: []
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
    expect(mediaUploadDiscovery?.creator_publish_controls_recon).toMatchObject({
      schema_version: "fr-0032.creator_publish_controls_recon.v1",
      no_write: true,
      blocker_candidates: []
    });
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
      visible_in_editor: false,
      preview_diagnostics: null
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
      decision: "EVIDENCE_PRESENT",
      upload_success: false,
      full_live_write_success: false,
      non_publish_validation: true,
      entry_gate_evaluated: false,
      runtime_evaluator_required_for_entry_gate: true,
      non_publish_evidence_status: "EVIDENCE_PRESENT",
      later_write_actions_blocked: false,
      cleanup_required: false,
      limitations: expect.arrayContaining([
        expect.objectContaining({ limitation_code: "REAL_UPLOAD_NOT_ATTEMPTED" }),
        expect.objectContaining({ limitation_code: "EDITOR_PREVIEW_NOT_ASSERTED" }),
        expect.objectContaining({ limitation_code: "ENTRY_GATE_NOT_EVALUATED" })
      ]),
      blockers: []
    });
  });

  it("rejects unsafe source media refs before forwarding upload discovery", async () => {
    const relay = createRelay();
    const responsePromise = waitForResponse(relay);
    relay.onNativeRequest({
      id: "forward-xhs-issue-845-controlled-upload-unsafe-ref",
      method: "bridge.forward",
      params: {
        session_id: "nm-session-001",
        run_id: "run-xhs-issue-845-controlled-upload-unsafe-ref",
        command: "xhs.media_upload.discover",
        command_params: {
          ability: {
            id: "xhs.creator.publish.v1",
            layer: "L3",
            action: "write"
          },
          input: {
            source_media_ref: "/Users/mc/private/source.png",
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
    expect(response.status).toBe("error");
    expect(response.error).toMatchObject({
      code: "ERR_CLI_INVALID_ARGS"
    });
    expect(response.payload).toMatchObject({
      details: {
        reason: "SOURCE_MEDIA_REF_INVALID"
      }
    });
  });
});

class FakeElement {
  public textContent: string;
  public offsetParent: object | null;
  private readonly visible: boolean;

  constructor(
    public tagName: string,
    text: string,
    private readonly attrs: Record<string, string> = {},
    visible = true
  ) {
    this.textContent = text;
    this.visible = visible;
    this.offsetParent = visible ? {} : null;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  getAttributeNames(): string[] {
    return Object.keys(this.attrs);
  }

  getClientRects(): Array<Record<string, number>> {
    return this.visible ? [{ height: 20, width: 80 }] : [];
  }
}

const withFakeDocument = <T>(elements: FakeElement[], callback: () => T): T => {
  const previousDocument = globalThis.document;
  const previousGetComputedStyle = globalThis.getComputedStyle;
  (globalThis as unknown as { document: unknown }).document = {
    querySelectorAll: () => elements
  };
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (element: FakeElement) => {
    const className = element.getAttribute("class") ?? "";
    if (className.split(/\s+/u).includes("stylesheet-hidden")) {
      return { display: "none", opacity: "1", visibility: "visible" };
    }
    return { display: "block", opacity: "1", visibility: "visible" };
  };
  try {
    return callback();
  } finally {
    if (previousDocument === undefined) {
      delete (globalThis as unknown as { document?: unknown }).document;
    } else {
      (globalThis as unknown as { document: unknown }).document = previousDocument;
    }
    if (previousGetComputedStyle === undefined) {
      delete (globalThis as unknown as { getComputedStyle?: unknown }).getComputedStyle;
    } else {
      globalThis.getComputedStyle = previousGetComputedStyle;
    }
  }
};

describe("xhs media upload discovery / creator publish controls recon", () => {
  it("returns no-write controls recon for d-select visibility and submit/publish controls", () => {
    const result = withFakeDocument(
      [
        new FakeElement("INPUT", "", { type: "file", accept: ".jpg,.png" }),
        new FakeElement("DIV", "仅自己可见", { class: "reds-select permission-select" }),
        new FakeElement("BUTTON", "下一步", { class: "reds-button next" }),
        new FakeElement("BUTTON", "发布", { class: "reds-button publish" }),
        new FakeElement("DIV", "", { role: "status", class: "toast notice" }),
        new FakeElement("BUTTON", "删除", { class: "delete-button" })
      ],
      () =>
        buildXhsMediaUploadDiscoveryResult({
          run_id: "run-1008-controls-recon",
          profile_ref: "xhs_001",
          target_tab_id: 32,
          page_url: "https://creator.xiaohongshu.com/publish/publish"
        })
    );

    expect(result.file_selection_boundary).toMatchObject({
      file_bytes_read: false,
      data_transfer_injected: false,
      submit_attempted: false,
      publish_attempted: false
    });
    expect(result.creator_publish_controls_recon).toMatchObject({
      schema_version: "fr-0032.creator_publish_controls_recon.v1",
      no_write: true,
      recording_policy: "locator_attributes_flags_and_lengths_only",
      blocker_candidates: []
    });
    expect(result.creator_publish_controls_recon.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "private_visibility",
          required_for_live_write: true,
          status: "ready",
          selected_locator: "div.reds-select.permission-select"
        }),
        expect.objectContaining({
          role: "submit_or_next",
          required_for_live_write: true,
          status: "ready",
          selected_locator: "button.reds-button.next"
        }),
        expect.objectContaining({
          role: "publish_or_confirm",
          required_for_live_write: true,
          status: "ready",
          selected_locator: "button.reds-button.publish"
        }),
        expect.objectContaining({
          role: "cleanup_or_abandon",
          required_for_live_write: true,
          status: "ready",
          selected_locator: "button.delete-button"
        })
      ])
    );
  });

  it("reports precise blocker candidates when required creator publish controls are missing and no upload entry is available", () => {
    const result = withFakeDocument(
      [],
      () =>
        buildXhsMediaUploadDiscoveryResult({
          run_id: "run-1008-controls-missing",
          page_url: "https://creator.xiaohongshu.com/publish/publish"
        })
    );

    expect(result.creator_publish_controls_recon.blocker_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "PRIVATE_VISIBILITY_CONTROL_MISSING",
          blocker_layer: "creator_publish_controls_recon",
          role: "private_visibility"
        }),
        expect.objectContaining({
          blocker_code: "SUBMIT_OR_NEXT_CONTROL_MISSING",
          role: "submit_or_next"
        }),
        expect.objectContaining({
          blocker_code: "PUBLISH_OR_CONFIRM_CONTROL_MISSING",
          role: "publish_or_confirm"
        }),
        expect.objectContaining({
          blocker_code: "ERROR_OR_TOAST_CONTROL_MISSING",
          role: "error_or_toast"
        }),
        expect.objectContaining({
          blocker_code: "CLEANUP_OR_ABANDON_CONTROL_MISSING",
          role: "cleanup_or_abandon"
        })
      ])
    );
  });

  it("defers missing continuation-control blockers on the pre-upload creator page", () => {
    const result = withFakeDocument(
      [
        new FakeElement("INPUT", "", { type: "file", accept: ".mp4,.mov" }),
        new FakeElement("DIV", "发布", { class: "publish-video" }),
        new FakeElement(
          "DIV",
          "上传视频 发布 笔记标题 笔记描述 添加话题 选择合集 更多创作服务平台内容占位文本用于模拟页面根节点聚合信号 发布设置 创作助手 活动入口 作品管理 数据中心 帮助中心",
          {
            id: "web",
            class: "publish-vue-container",
            systemid: "creator",
            plugins: "publish"
          }
        )
      ],
      () =>
        buildXhsMediaUploadDiscoveryResult({
          run_id: "run-1032-pre-upload-controls-deferred",
          page_url: "https://creator.xiaohongshu.com/publish/publish"
        })
    );

    expect(result.file_selection_boundary).toMatchObject({
      file_bytes_read: false,
      real_upload_attempted: false,
      submit_attempted: false,
      publish_attempted: false
    });
    expect(result.creator_publish_controls_recon.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "private_visibility",
          status: "missing",
          selected_locator: null
        }),
        expect.objectContaining({
          role: "submit_or_next",
          status: "missing",
          selected_locator: null
        }),
        expect.objectContaining({
          role: "publish_or_confirm",
          status: "ready",
          candidate_count: 1,
          selected_locator: "div.publish-video"
        }),
        expect.objectContaining({
          role: "error_or_toast",
          status: "missing",
          selected_locator: null
        }),
        expect.objectContaining({
          role: "cleanup_or_abandon",
          status: "missing",
          selected_locator: null
        })
      ])
    );
    expect(result.creator_publish_controls_recon.blocker_candidates).toEqual([]);
    expect(result.creator_publish_controls_recon.deferred_missing_control_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "private_visibility",
          status: "missing",
          defer_reason: "pre_upload_upload_entry_present_no_write_boundary"
        }),
        expect.objectContaining({
          role: "submit_or_next",
          status: "missing",
          defer_reason: "pre_upload_upload_entry_present_no_write_boundary"
        }),
        expect.objectContaining({
          role: "error_or_toast",
          status: "missing",
          defer_reason: "pre_upload_upload_entry_present_no_write_boundary"
        }),
        expect.objectContaining({
          role: "cleanup_or_abandon",
          status: "missing",
          defer_reason: "pre_upload_upload_entry_present_no_write_boundary"
        })
      ])
    );
  });

  it("reports hidden blockers for stylesheet-hidden required controls", () => {
    const result = withFakeDocument(
      [
        new FakeElement("INPUT", "", { type: "file", accept: ".jpg,.png" }),
        new FakeElement("DIV", "仅自己可见", { class: "reds-select permission-select" }),
        new FakeElement("BUTTON", "下一步", { class: "reds-button next" }),
        new FakeElement("BUTTON", "发布", { class: "reds-button publish stylesheet-hidden" }),
        new FakeElement("DIV", "", { role: "status", class: "toast notice" }),
        new FakeElement("BUTTON", "删除", { class: "delete-button" })
      ],
      () =>
        buildXhsMediaUploadDiscoveryResult({
          run_id: "run-1008-controls-stylesheet-hidden",
          page_url: "https://creator.xiaohongshu.com/publish/publish"
        })
    );

    expect(result.creator_publish_controls_recon.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "publish_or_confirm",
          status: "hidden",
          selected_locator: null
        })
      ])
    );
    expect(result.creator_publish_controls_recon.blocker_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "PUBLISH_OR_CONFIRM_CONTROL_HIDDEN",
          blocker_layer: "creator_publish_controls_recon",
          role: "publish_or_confirm"
        })
      ])
    );
  });

  it("does not mark mixed public/private visibility containers as private-ready", () => {
    const result = withFakeDocument(
      [
        new FakeElement("INPUT", "", { type: "file", accept: ".jpg,.png" }),
        new FakeElement("DIV", "公开 仅自己可见", { class: "reds-select permission-select" }),
        new FakeElement("BUTTON", "下一步", { class: "reds-button next" }),
        new FakeElement("BUTTON", "发布", { class: "reds-button publish" }),
        new FakeElement("DIV", "", { role: "status", class: "toast notice" }),
        new FakeElement("BUTTON", "删除", { class: "delete-button" })
      ],
      () =>
        buildXhsMediaUploadDiscoveryResult({
          run_id: "run-1008-controls-mixed-visibility",
          page_url: "https://creator.xiaohongshu.com/publish/publish"
        })
    );

    expect(result.creator_publish_controls_recon.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "private_visibility",
          status: "ambiguous",
          selected_locator: null,
          candidates: [
            expect.objectContaining({
              signal_flags: expect.objectContaining({
                private_visibility: true,
                public_visibility: true
              })
            })
          ]
        })
      ])
    );
    expect(result.creator_publish_controls_recon.blocker_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocker_code: "PRIVATE_VISIBILITY_CONTROL_AMBIGUOUS",
          role: "private_visibility"
        })
      ])
    );
  });
});
