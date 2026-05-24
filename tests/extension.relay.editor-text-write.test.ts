import { describe, expect, it } from "vitest";
import {
  asRecord,
  BackgroundRelay,
  completeIssue208ApprovalRecord,
  ContentScriptHandler,
  waitForResponse
} from "./extension.relay.shared.js";

const createRelay = () => {
  const contentScript = new ContentScriptHandler({
    xhsEnv: {
      now: () => 1_000,
      randomId: () => "relay-editor-text-write-id",
      getLocationHref: () => "https://creator.xiaohongshu.com/publish/publish?target=article",
      getDocumentTitle: () => "Creator Publish",
      getReadyState: () => "complete",
      getCookie: () => "a1=valid;",
      callSignature: async () => {
        throw new Error("editor text write should not request signatures");
      },
      fetchJson: async () => {
        throw new Error("editor text write should not hit live fetch");
      },
      performEditorInputValidation: async (input) => ({
        ok: true,
        mode: "controlled_editor_input_validation",
        attestation: "controlled_real_interaction",
        editor_locator: "div.tiptap.ProseMirror",
        input_text: input.text,
        before_text: "",
        visible_text: input.text,
        post_blur_text: input.text,
        focus_confirmed: true,
        focus_attestation_source: "chrome_debugger",
        focus_attestation_reason: null,
        preserved_after_blur: true,
        success_signals: [
          "editor_focus_attested",
          "text_visible",
          "text_persisted_after_blur"
        ],
        failure_signals: [],
        minimum_replay: ["focus_editor", "type_short_text", "blur_or_reobserve"]
      })
    }
  });
  return new BackgroundRelay(contentScript, { forwardTimeoutMs: 200 });
};

describe("extension background relay / editor text write", () => {
  it("returns controlled focus and preservation proof without upload submit or publish actions", async () => {
    const relay = createRelay();
    const responsePromise = waitForResponse(relay);
    relay.onNativeRequest({
      id: "forward-xhs-issue-754-text-write-001",
      method: "bridge.forward",
      params: {
        session_id: "nm-session-001",
        run_id: "run-xhs-issue-754-text-write-001",
        command: "xhs.editor_text.write",
        command_params: {
          ability: {
            id: "xhs.editor.input.v1",
            layer: "L3",
            action: "write"
          },
          input: {
            text: "WebEnvoy #754 text"
          },
          options: {
            issue_scope: "issue_208",
            target_domain: "creator.xiaohongshu.com",
            target_tab_id: 32,
            target_page: "creator_publish_tab",
            action_type: "write",
            requested_execution_mode: "live_write",
            validation_action: "editor_input",
            editor_text_write: true,
            risk_state: "allowed",
            approval_record: completeIssue208ApprovalRecord,
            editor_focus_attestation: {
              source: "chrome_debugger",
              target_tab_id: 32,
              editable_state: "already_ready",
              focus_confirmed: true,
              entry_button_locator: null,
              editor_locator: "div.tiptap.ProseMirror"
            }
          }
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
    const textWriteResult = asRecord(summary.text_write_result);
    expect(textWriteResult).toMatchObject({
      write_action: "editor_text_write",
      input_text: "WebEnvoy #754 text",
      focus_confirmed: true,
      preserved_after_blur: true,
      out_of_scope_actions: ["image_upload", "submit", "publish_confirm"],
      submitted: false,
      published: false
    });
    expect(summary.capability_result).toMatchObject({
      ability_id: "xhs.editor.input.v1",
      action: "write",
      outcome: "success",
      data_ref: {
        validation_action: "editor_input"
      }
    });
  });
});
