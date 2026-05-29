import { describe, expect, it } from "vitest";
import {
  asRecord,
  BackgroundRelay,
  completeIssue208ApprovalRecord,
  ContentScriptHandler,
  waitForResponse
} from "./extension.relay.shared.js";
import {
  buildXhsControlledLiveWriteFromDiscovery,
  performXhsControlledLiveWriteWithApprovedSourceMedia
} from "../extension/xhs-controlled-live-write.js";
import { buildXhsMediaUploadDiscoveryResult } from "../extension/xhs-media-upload-discovery.js";

const controlledLiveOptions = {
  issue_scope: "issue_835",
  target_domain: "creator.xiaohongshu.com",
  target_tab_id: 32,
  target_page: "creator_publish_tab",
  action_type: "write",
  requested_execution_mode: "live_write",
  controlled_live_write: true,
  confirm_live_write: true,
  publish_visibility_scope: "private_or_self_visible",
  cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
  risk_state: "allowed",
  approval_record: completeIssue208ApprovalRecord
} as const;

const createRelay = () => {
  const contentScript = new ContentScriptHandler({
    xhsEnv: {
      now: () => 1_000,
      randomId: () => "relay-controlled-live-write-id",
      getLocationHref: () => "https://creator.xiaohongshu.com/publish/publish",
      getDocumentTitle: () => "Creator Publish",
      getReadyState: () => "complete",
      getCookie: () => "a1=valid;",
      callSignature: async () => {
        throw new Error("controlled live write should not request signatures in relay contract test");
      },
      fetchJson: async () => {
        throw new Error("controlled live write relay contract test should not hit live fetch");
      },
      performControlledLiveWrite: async (input) => ({
        live_write_action: "controlled_upload_submit_publish",
        target_page: "creator_publish_tab",
        live_write_evidence: {
          schema_version: "fr-0032.live_write_evidence.v1",
          live_write_attempt_id: input.live_write_attempt_id,
          canonical_issue_ref: "#835",
          execution_phase: "upload",
          scope: {
            platform: "xhs",
            target_domain: "creator.xiaohongshu.com",
            target_page: "creator_publish_tab",
            browser_channel: "Google Chrome stable",
            execution_surface: "real_browser",
            requested_execution_mode: "live_write",
            profile_ref: input.profile_ref ?? "profile-a",
            target_tab_id: input.target_tab_id ?? 32,
            probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
            run_id: input.run_id,
            artifact_identity: "upload-artifact/fr0032-test"
          },
          entry_gate: {
            spec_review_state: "passed",
            latest_head_sha: input.latest_head_sha ?? "head-test",
            readmission_decision: "GO",
            readmission_run_id: input.run_id,
            runtime_readiness: "ready",
            identity_binding_state: "bound",
            service_worker_freshness_state: "not_applicable",
            target_binding_state: "verified",
            account_safety_state: "clear",
            validation_rows_state: "ready_verified_no_drift",
            publish_visibility_scope: input.publish_visibility_scope,
            cleanup_policy_ref: input.cleanup_policy_ref,
            checked_at: "2026-05-28T00:00:00.000Z"
          },
          upload_artifact_identity: null,
          submit_evidence: null,
          publish_result_identity: null,
          cleanup_result: null,
          risk_signals: [],
          stop_signal: {
            schema_version: "fr-0032.live_write_stop_signal.v1",
            stop_signal_id: "stop/fr0032-test",
            live_write_attempt_id: input.live_write_attempt_id,
            run_id: input.run_id,
            profile_ref: input.profile_ref ?? "profile-a",
            target_tab_id: input.target_tab_id ?? 32,
            stopped_at: "2026-05-28T00:00:00.000Z",
            stopped_step: "upload",
            blocker_layer: "upload",
            blocker_code: "UPLOAD_PLATFORM_REJECTED",
            severity: "blocking",
            later_write_actions_blocked: true,
            cleanup_required: false,
            cleanup_result_id: null,
            residual_record_id: null,
            required_recovery_action: "test executor stopped before upload",
            evidence_ref: "live_write_evidence/fr0032-test"
          },
          residual_record: null,
          created_at: "2026-05-28T00:00:00.000Z",
          updated_at: "2026-05-28T00:00:00.000Z"
        },
        live_write_evaluation: {
          schema_version: "fr-0032.live_write_evaluation.v1",
          decision: "NO_GO",
          full_live_write_success: false,
          upload_success: false,
          submit_success: false,
          publish_success: false,
          cleanup_success: false,
          later_write_actions_blocked: true,
          cleanup_required: false,
          blockers: [
            {
              blocker_code: "UPLOAD_PLATFORM_REJECTED",
              blocker_layer: "upload",
              message: "test stopped before upload"
            }
          ]
        },
        uploaded: false,
        submitted: false,
        published: false,
        cleanup_attempted: false,
        out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
      })
    }
  });
  return new BackgroundRelay(contentScript, { forwardTimeoutMs: 200 });
};

describe("extension background relay / controlled live write", () => {
  it("forwards the FR-0032 executor command and returns structured stop evidence", async () => {
    const relay = createRelay();
    const responsePromise = waitForResponse(relay);
    relay.onNativeRequest({
      id: "forward-xhs-issue-835-controlled-live-write-001",
      method: "bridge.forward",
      params: {
        session_id: "nm-session-001",
        run_id: "run-xhs-issue-835-controlled-live-write-001",
        command: "xhs.creator_publish.controlled_live_write",
        command_params: {
          ability: {
            id: "xhs.creator.publish.v1",
            layer: "L3",
            action: "write"
          },
          input: {
            live_write_attempt_id: "fr0032-attempt-relay-001",
            source_media_ref: "media-ref/fr-0032/fixture-image-a",
            source_media_digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            source_media_kind: "image"
          },
          options: controlledLiveOptions
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
        live_write_attempt_id: "fr0032-attempt-relay-001"
      }
    });
    expect(summary.consumer_gate_result).toMatchObject({
      issue_scope: "issue_835",
      target_domain: "creator.xiaohongshu.com",
      target_tab_id: 32,
      target_page: "creator_publish_tab",
      requested_execution_mode: "live_write",
      gate_decision: "allowed"
    });
    expect(summary.live_write_evidence).toMatchObject({
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "fr0032-attempt-relay-001",
      canonical_issue_ref: "#835",
      stop_signal: expect.objectContaining({
        later_write_actions_blocked: true
      })
    });
    expect(summary.live_write_evaluation).toMatchObject({
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      later_write_actions_blocked: true
    });
  });

  it("converts default upload discovery into a precise upload blocker instead of executor unavailable", () => {
    const input = {
      live_write_attempt_id: "fr0032-attempt-default-executor-001",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      source_media_kind: "image" as const,
      publish_visibility_scope: "private_or_self_visible" as const,
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-879-default-executor-001",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test"
    };
    const discovery = buildXhsMediaUploadDiscoveryResult({
      source_media_ref: input.source_media_ref,
      source_media_digest: input.source_media_digest,
      source_media_kind: input.source_media_kind,
      run_id: input.run_id,
      profile_ref: input.profile_ref,
      target_tab_id: input.target_tab_id,
      page_url: input.page_url
    });

    const result = buildXhsControlledLiveWriteFromDiscovery(input, discovery);

    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: false,
      later_write_actions_blocked: true,
      blockers: [
        expect.objectContaining({
          blocker_code: "UPLOAD_PLATFORM_REJECTED",
          blocker_layer: "upload"
        })
      ]
    });
    expect(result.live_write_evidence).toMatchObject({
      stop_classification: expect.objectContaining({
        category: "upload_blocked",
        stop_reason: "source_media_resolution_or_upload_acceptance_unavailable"
      }),
      stop_signal: expect.objectContaining({
        blocker_code: "UPLOAD_PLATFORM_REJECTED",
        later_write_actions_blocked: true
      })
    });
  });

  it("rejects approved fixture upload when the declared digest does not match", async () => {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-digest-mismatch",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-884-digest-mismatch",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test"
    });

    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "SOURCE_MEDIA_DIGEST_MISMATCH",
          blocker_layer: "upload"
        })
      ]
    });
    expect(result.live_write_evidence).toMatchObject({
      stop_classification: expect.objectContaining({
        stop_reason: "source_media_digest_mismatch"
      }),
      upload_artifact_identity: expect.objectContaining({
        accepted_by_platform: false,
        visible_in_editor: false
      })
    });
  });

  it("returns structured evidence when File construction is unavailable", async () => {
    const originalFile = globalThis.File;
    Object.defineProperty(globalThis, "File", {
      configurable: true,
      value: undefined
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-file-unavailable",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:4b5c5c92cec3b23e6a294fc0eea43234ef5126c5a64f4c6c531ac8430ab0b844",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-884-file-unavailable",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(result.live_write_evaluation).toMatchObject({
        decision: "NO_GO",
        upload_success: false,
        blockers: [
          expect.objectContaining({
            blocker_code: "FILE_CONSTRUCTOR_UNAVAILABLE",
            blocker_layer: "upload"
          })
        ]
      });
    } finally {
      Object.defineProperty(globalThis, "File", {
        configurable: true,
        value: originalFile
      });
    }
  });

  it("resolves the approved fixture without local paths but does not treat preview visibility as platform acceptance", async () => {
    const originalDataTransfer = globalThis.DataTransfer;
    const originalDocument = globalThis.document;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalGetComputedStyle = globalThis.getComputedStyle;
    class TestDataTransfer {
      #files: File[] = [];
      items = {
        add: (file: File) => {
          this.#files.push(file);
        }
      };
      get files() {
        return this.#files as unknown as FileList;
      }
    }
    class TestElement {
      id = "";
      tagName = "IMG";
      classList = ["preview-image"];
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => true
    };
    const preview = new TestElement();
    Object.defineProperty(globalThis, "DataTransfer", {
      configurable: true,
      value: TestDataTransfer
    });
    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: TestElement
    });
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: () => ({ display: "block", visibility: "visible" })
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        querySelectorAll: (selector: string) => {
          if (selector === 'input[type="file"]') {
            return [fileInput];
          }
          return [preview];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-approved-fixture",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:4b5c5c92cec3b23e6a294fc0eea43234ef5126c5a64f4c6c531ac8430ab0b844",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-884-approved-fixture",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(result.live_write_evaluation).toMatchObject({
        decision: "NO_GO",
        upload_success: false,
        submit_success: false,
        cleanup_required: false,
        blockers: [
          expect.objectContaining({
            blocker_code: "UPLOAD_ACCEPTANCE_UNVERIFIED",
            blocker_layer: "upload"
          })
        ]
      });
      expect(result.live_write_evidence).toMatchObject({
        execution_phase: "upload",
        upload_artifact_identity: expect.objectContaining({
          source_media_ref: "media-ref/fr-0032/fixture-image-a",
          source_media_digest:
            "sha256:4b5c5c92cec3b23e6a294fc0eea43234ef5126c5a64f4c6c531ac8430ab0b844",
          accepted_by_platform: false,
          visible_in_editor: true,
          page_preview_locator: "img.preview-image"
        }),
        stop_signal: expect.objectContaining({
          blocker_code: "UPLOAD_ACCEPTANCE_UNVERIFIED",
          cleanup_required: false
        })
      });
    } finally {
      Object.defineProperty(globalThis, "DataTransfer", {
        configurable: true,
        value: originalDataTransfer
      });
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument
      });
      Object.defineProperty(globalThis, "HTMLElement", {
        configurable: true,
        value: originalHTMLElement
      });
      Object.defineProperty(globalThis, "getComputedStyle", {
        configurable: true,
        value: originalGetComputedStyle
      });
    }
  });

  it("does not accept a zero-size editor preview as upload success", async () => {
    const originalDataTransfer = globalThis.DataTransfer;
    const originalDocument = globalThis.document;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalGetComputedStyle = globalThis.getComputedStyle;
    class TestDataTransfer {
      #files: File[] = [];
      items = {
        add: (file: File) => {
          this.#files.push(file);
        }
      };
      get files() {
        return this.#files as unknown as FileList;
      }
    }
    class TestElement {
      id = "";
      tagName = "IMG";
      classList = ["preview-image"];
      getBoundingClientRect = () => ({ width: 0, height: 0 });
    }
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => true
    };
    const preview = new TestElement();
    Object.defineProperty(globalThis, "DataTransfer", {
      configurable: true,
      value: TestDataTransfer
    });
    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: TestElement
    });
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: () => ({ display: "block", visibility: "visible", opacity: "1" })
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        querySelectorAll: (selector: string) => {
          if (selector === 'input[type="file"]') {
            return [fileInput];
          }
          return [preview];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-zero-preview",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:4b5c5c92cec3b23e6a294fc0eea43234ef5126c5a64f4c6c531ac8430ab0b844",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-884-zero-preview",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(result.live_write_evaluation).toMatchObject({
        decision: "NO_GO",
        upload_success: false,
        blockers: [
          expect.objectContaining({
            blocker_code: "UPLOAD_PREVIEW_NOT_VISIBLE",
            blocker_layer: "upload"
          })
        ]
      });
      expect(result.live_write_evidence).toMatchObject({
        stop_classification: expect.objectContaining({
          stop_reason: "upload_preview_not_visible"
        }),
        upload_artifact_identity: expect.objectContaining({
          accepted_by_platform: false,
          visible_in_editor: false
        })
      });
    } finally {
      Object.defineProperty(globalThis, "DataTransfer", {
        configurable: true,
        value: originalDataTransfer
      });
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument
      });
      Object.defineProperty(globalThis, "HTMLElement", {
        configurable: true,
        value: originalHTMLElement
      });
      Object.defineProperty(globalThis, "getComputedStyle", {
        configurable: true,
        value: originalGetComputedStyle
      });
    }
  });
});
