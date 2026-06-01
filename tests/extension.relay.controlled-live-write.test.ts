import { describe, expect, it, vi } from "vitest";
import {
  asRecord,
  BackgroundRelay,
  completeIssue208ApprovalRecord,
  ContentScriptHandler,
  waitForResponse
} from "./extension.relay.shared.js";
import { resolveContentCommandDeadlineMsForContract } from "../extension/content-script-handler.js";
import { resolveXhsControlledUploadPlatformCaptureTimeoutMs } from "../extension/xhs-controlled-upload-platform-capture.js";
import {
  applyXhsControlledUploadPlatformCapture,
  applyXhsControlledUploadPlatformCaptureStatus,
  buildXhsControlledLiveWriteUploadBlockedResult,
  buildXhsControlledLiveWriteFromDiscovery,
  decodeXhsControlledUploadNetworkResponseBody,
  extractXhsControlledUploadPlatformCapture,
  isXhsControlledUploadPlatformCaptureUrl,
  performXhsControlledLiveWriteWithApprovedSourceMedia,
  summarizeXhsControlledUploadObservedRequest
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

it("lets controlled upload platform capture use the live write deadline instead of a short fixed cap", () => {
  expect(resolveXhsControlledUploadPlatformCaptureTimeoutMs(55_000)).toBe(55_000);
  expect(resolveXhsControlledUploadPlatformCaptureTimeoutMs(90_000)).toBe(60_000);
  expect(resolveXhsControlledUploadPlatformCaptureTimeoutMs(0)).toBe(1);
});

it("lets controlled live write keep a long content deadline before native timeout", () => {
  expect(
    resolveContentCommandDeadlineMsForContract(114_000, {
      controlled_live_write: true,
      requested_execution_mode: "live_write"
    })
  ).toBe(109_000);
  expect(
    resolveContentCommandDeadlineMsForContract(234_000, {
      controlled_live_write: true,
      requested_execution_mode: "live_write"
    })
  ).toBe(229_000);
  expect(resolveContentCommandDeadlineMsForContract(114_000, {})).toBe(20_000);
});

it("promotes upload evidence when Chrome debugger captures an explicit platform staging ref", () => {
  const result = buildXhsControlledLiveWriteUploadBlockedResult(
    {
      live_write_attempt_id: "fr0032-attempt-debugger-upload-ref",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-898-debugger-upload-ref",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test"
    },
    {
      blockerCode: "UPLOAD_ACCEPTANCE_UNVERIFIED",
      blockerMessage:
        "Controlled live upload observed an editor preview, but platform upload acceptance is not independently verified.",
      detailsRef: "upload_acceptance_unverified",
      requiredRecoveryAction:
        "collect platform-returned upload acceptance evidence before submit/publish"
    },
    {
      upload_artifact_id: "upload-artifact/fr0032-test",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      platform_staging_ref: null,
      page_preview_locator: "img.img",
      accepted_by_platform: false,
      visible_in_editor: true,
      captured_at: "2026-05-30T00:00:00.000Z"
    }
  );

  const promoted = applyXhsControlledUploadPlatformCapture(result, {
    source: "chrome_debugger_network",
    platform_staging_ref: "image_id:platform-image-123",
    url: "https://creator.xiaohongshu.com/api/media/upload",
    method: "POST",
    status: 200,
    captured_at: "2026-05-30T00:00:01.000Z"
  });

  expect(promoted.uploaded).toBe(true);
  expect(promoted.live_write_evaluation).toMatchObject({
    upload_success: true,
    submit_success: false,
    cleanup_required: true,
    blockers: [
      expect.objectContaining({
        blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
        blocker_layer: "submit"
      })
    ]
  });
  expect(promoted.live_write_evidence).toMatchObject({
    execution_phase: "submit",
    upload_artifact_identity: expect.objectContaining({
      accepted_by_platform: true,
      platform_staging_ref: "image_id:platform-image-123"
    }),
    platform_upload_acceptance_capture: expect.objectContaining({
      source: "chrome_debugger_network",
      status: 200
    }),
    stop_signal: expect.objectContaining({
      stopped_step: "submit",
      blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE"
    })
  });
});

it("requires editor-visible upload evidence before promoting object transport staging refs", () => {
  const result = buildXhsControlledLiveWriteUploadBlockedResult(
    {
      live_write_attempt_id: "fr0032-attempt-object-upload-without-preview",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-911-object-upload-without-preview",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test"
    },
    {
      blockerCode: "UPLOAD_ACCEPTANCE_UNVERIFIED",
      blockerMessage:
        "Controlled live upload observed an editor preview, but platform upload acceptance is not independently verified.",
      detailsRef: "upload_acceptance_unverified",
      requiredRecoveryAction:
        "collect platform-returned upload acceptance evidence before submit/publish"
    },
    {
      upload_artifact_id: "upload-artifact/fr0032-object-no-preview",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      platform_staging_ref: null,
      page_preview_locator: null,
      accepted_by_platform: false,
      visible_in_editor: false,
      captured_at: "2026-05-30T00:00:00.000Z"
    }
  );

  const promoted = applyXhsControlledUploadPlatformCapture(result, {
    source: "chrome_debugger_network",
    evidence_basis: "object_upload_transport_2xx",
    platform_staging_ref:
      "object_upload:ros-upload-d4.xhscdn.com/spectrum/XbAJSnnddgqFkj8Nst9wiMCtHGGO9a3Rp4vxdqzli0PBySQ",
    url: "https://ros-upload-d4.xhscdn.com/spectrum/XbAJSnnddgqFkj8Nst9wiMCtHGGO9a3Rp4vxdqzli0PBySQ",
    method: "PUT",
    status: 200,
    captured_at: "2026-05-30T00:00:01.000Z"
  });

  expect(promoted.uploaded).toBe(false);
  expect(promoted.live_write_evidence).toMatchObject({
    upload_artifact_identity: expect.objectContaining({
      accepted_by_platform: false,
      platform_staging_ref: null,
      visible_in_editor: false
    })
  });
});

it("records debugger upload capture status without promoting upload success", () => {
  const result = buildXhsControlledLiveWriteUploadBlockedResult(
    {
      live_write_attempt_id: "fr0032-attempt-debugger-upload-timeout",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-898-debugger-upload-timeout",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test"
    },
    {
      blockerCode: "UPLOAD_ACCEPTANCE_UNVERIFIED",
      blockerMessage:
        "Controlled live upload observed an editor preview, but platform upload acceptance is not independently verified.",
      detailsRef: "upload_acceptance_unverified",
      requiredRecoveryAction:
        "collect platform-returned upload acceptance evidence before submit/publish"
    }
  );

  const annotated = applyXhsControlledUploadPlatformCaptureStatus(result, {
    attempted: true,
    status: "timeout",
    reason: "no_platform_upload_acceptance_response_captured",
    recorded_at: "2026-05-30T00:00:01.000Z",
    observed_requests: [
      {
        method: "POST",
        host: "creator.xiaohongshu.com",
        path: "/api/media/upload",
        capture_candidate: true,
        status: 200,
        body_kind: "object",
        top_level_keys: ["success", "data"],
        body_values_recorded: false,
        body_recording_policy: "shape_only",
        rejection_reason: "trusted_platform_ref_missing"
      }
    ]
  });

  expect(annotated.uploaded).toBe(false);
  expect(annotated.live_write_evaluation).toMatchObject({
    upload_success: false,
    blockers: [
      expect.objectContaining({
        blocker_code: "UPLOAD_ACCEPTANCE_UNVERIFIED"
      })
    ]
  });
  expect(annotated.live_write_evidence).toMatchObject({
    platform_upload_acceptance_capture_status: {
      attempted: true,
      status: "timeout",
      reason: "no_platform_upload_acceptance_response_captured",
      observed_requests: [
        expect.objectContaining({
          path: "/api/media/upload",
          rejection_reason: "trusted_platform_ref_missing"
        })
      ]
    }
  });
});

it("continues from accepted upload artifact through private submit publish cleanup", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  class TestElement {
    id = "";
    tagName = "BUTTON";
    className = "";
    classList = [] as string[];
    textContent = "";
    clicked = false;
    getAttribute = (name: string) => {
      if (name === "class") {
        return this.className;
      }
      return null;
    };
    getBoundingClientRect = () => ({ width: 80, height: 32 });
    click = () => {
      this.clicked = true;
    };
  }
  const visibility = new TestElement();
  visibility.className = "visibility-private";
  visibility.classList = ["visibility-private"];
  visibility.textContent = "仅自己可见";
  const submit = new TestElement();
  submit.className = "publish-submit";
  submit.classList = ["publish-submit"];
  submit.textContent = "发布";
  const documentElement = new TestElement();
  documentElement.tagName = "HTML";
  documentElement.textContent = "发布成功";
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image"
  };
  submit.click = () => {
    submit.clicked = true;
    locationState.href = "https://creator.xiaohongshu.com/publish/success/64b7d8ef000000001f03abcd";
  };
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: locationState }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement,
      querySelectorAll: (selector: string) => {
        if (selector.includes("visibility") || selector.includes("privacy") || selector.includes("permission")) {
          return [visibility];
        }
        if (selector.includes("publish") || selector.includes("submit") || selector.includes("button")) {
          return [submit];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-resume-accepted-upload",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-924-resume-accepted-upload",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/resume",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/abc123abc123abc123abc123abc123abc123",
        page_preview_locator: "img.preview-image",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-05-30T20:16:08.000Z"
      }
    });

    expect(visibility.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "GO",
      full_live_write_success: true,
      upload_success: true,
      submit_success: true,
      publish_success: true,
      cleanup_success: true
    });
    expect(result.live_write_evidence).toMatchObject({
      execution_phase: "closed",
      submit_evidence: expect.objectContaining({
        submit_result_state: "accepted"
      }),
      publish_result_identity: expect.objectContaining({
        verification_state: "verified",
        note_id: "64b7d8ef000000001f03abcd",
        publish_visibility_scope: "private_or_self_visible"
      }),
      cleanup_result: expect.objectContaining({
        cleanup_action: "hide_published_result",
        cleanup_outcome: "hidden"
      }),
      risk_signals: [],
      stop_signal: null
    });
  } finally {
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
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
});

it("opens visibility selector before choosing the private publish option", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  class TestElement {
    id = "";
    tagName = "BUTTON";
    className = "";
    classList = [] as string[];
    textContent = "";
    clicked = false;
    getAttribute = (name: string) => {
      if (name === "class") {
        return this.className;
      }
      if (name === "role") {
        return "button";
      }
      return null;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    click = () => {
      this.clicked = true;
    };
  }
  const visibilityTrigger = new TestElement();
  visibilityTrigger.className = "publish-setting";
  visibilityTrigger.classList = ["publish-setting"];
  visibilityTrigger.textContent = "公开";
  let privateOptionVisible = false;
  visibilityTrigger.click = () => {
    visibilityTrigger.clicked = true;
    privateOptionVisible = true;
  };
  const privateOption = new TestElement();
  privateOption.className = "visibility-option";
  privateOption.classList = ["visibility-option"];
  privateOption.textContent = "仅自己可见";
  const submit = new TestElement();
  submit.tagName = "BUTTON";
  submit.className = "publish-submit";
  submit.classList = ["publish-submit"];
  submit.textContent = "发布";
  const documentElement = new TestElement();
  documentElement.tagName = "HTML";
  documentElement.textContent = "发布成功";
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image"
  };
  submit.click = () => {
    submit.clicked = true;
    locationState.href = "https://creator.xiaohongshu.com/publish/success/64b7d8ef000000001f03abce";
  };
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: locationState }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement,
      querySelectorAll: (selector: string) => {
        if (selector.includes("visibility") || selector.includes("privacy") || selector.includes("permission")) {
          return privateOptionVisible ? [visibilityTrigger, privateOption] : [visibilityTrigger];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        if (selector.includes("publish") || selector.includes("submit")) {
          return privateOptionVisible ? [visibilityTrigger, privateOption, submit] : [visibilityTrigger, submit];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-open-private-visibility-selector",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-open-private-visibility-selector",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/private-selector",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/private-selector",
        page_preview_locator: "img.preview-image",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-05-30T20:16:08.000Z"
      }
    });

    expect(visibilityTrigger.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "GO",
      full_live_write_success: true,
      submit_success: true,
      publish_success: true
    });
  } finally {
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
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
});

it("opens public visibility value from an explicit visibility setting row", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList = [] as string[];
    textContent = "";
    clicked = false;
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    queryCount = 0;
    getAttribute = (name: string) => {
      if (name === "class") {
        return this.className;
      }
      if (name === "role" && this.className === "plain-current-value") {
        return "button";
      }
      return null;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      this.queryCount += 1;
      return this.children;
    };
    click = () => {
      this.clicked = true;
    };
  }
  const settingRow = new TestElement();
  settingRow.className = "publish-form-row";
  const visibilityLabel = new TestElement();
  visibilityLabel.className = "form-label";
  visibilityLabel.textContent = "可见范围";
  const visibilityTrigger = new TestElement();
  visibilityTrigger.className = "plain-current-value";
  visibilityTrigger.textContent = "公开";
  let privateOptionVisible = false;
  let privateOptionQueriedBeforeTrigger = false;
  const clickOrder: string[] = [];
  visibilityTrigger.click = () => {
    visibilityTrigger.clicked = true;
    clickOrder.push("trigger");
    privateOptionVisible = true;
  };
  const privateOption = new TestElement();
  privateOption.className = "visibility-option";
  privateOption.classList = ["visibility-option"];
  privateOption.textContent = "仅自己可见";
  privateOption.click = () => {
    privateOption.clicked = true;
    clickOrder.push("private-option");
  };
  const submit = new TestElement();
  submit.tagName = "BUTTON";
  submit.className = "publish-submit";
  submit.classList = ["publish-submit"];
  submit.textContent = "发布";
  const documentElement = new TestElement();
  documentElement.tagName = "HTML";
  documentElement.textContent = "发布成功";
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image"
  };
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
    locationState.href = "https://creator.xiaohongshu.com/publish/success/64b7d8ef000000001f03abce";
  };
  visibilityLabel.parentElement = settingRow;
  visibilityTrigger.parentElement = settingRow;
  settingRow.children = [visibilityLabel, visibilityTrigger];
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: locationState }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement,
      querySelectorAll: (selector: string) => {
        if (selector.includes("span,p")) {
          return [visibilityLabel];
        }
        if (
          (selector.includes("visibility") || selector.includes("privacy") || selector.includes("permission"))
        ) {
          if (!visibilityTrigger.clicked) {
            privateOptionQueriedBeforeTrigger = true;
            return [];
          }
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("label") || selector.includes("setting") || selector.includes("scope")) {
          return [visibilityLabel];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-explicit-visibility-row",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-explicit-visibility-row",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/explicit-visibility-row",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/explicit-visibility-row",
        page_preview_locator: "img.preview-image",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-05-30T20:16:08.000Z"
      }
    });

    expect(settingRow.queryCount).toBeGreaterThan(0);
    expect(privateOptionQueriedBeforeTrigger).toBe(true);
    expect(visibilityTrigger.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["trigger", "private-option", "submit"]);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "GO",
      full_live_write_success: true,
      submit_success: true,
      publish_success: true
    });
  } finally {
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
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
});

it("selects a private option rendered as a plain dropdown item after opening visibility", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList = [] as string[];
    textContent = "";
    clicked = false;
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    getAttribute = (name: string) => {
      if (name === "class") {
        return this.className;
      }
      return null;
    };
    getBoundingClientRect = () => ({ width: 128, height: 32 });
    querySelectorAll = () => this.children;
    click = () => {
      this.clicked = true;
    };
  }
  const settingRow = new TestElement();
  settingRow.className = "publish-setting-row";
  const visibilityLabel = new TestElement();
  visibilityLabel.className = "label";
  visibilityLabel.textContent = "可见权限";
  const visibilityTrigger = new TestElement();
  visibilityTrigger.className = "current-value";
  visibilityTrigger.textContent = "公开可见";
  let privateOptionVisible = false;
  const clickOrder: string[] = [];
  visibilityTrigger.click = () => {
    visibilityTrigger.clicked = true;
    privateOptionVisible = true;
    clickOrder.push("trigger");
  };
  const privateOption = new TestElement();
  privateOption.tagName = "LI";
  privateOption.className = "reds-dropdown-item";
  privateOption.classList = ["reds-dropdown-item"];
  privateOption.textContent = "仅自己可见";
  privateOption.click = () => {
    privateOption.clicked = true;
    clickOrder.push("private-option");
  };
  const submit = new TestElement();
  submit.tagName = "BUTTON";
  submit.textContent = "发布";
  const documentElement = new TestElement();
  documentElement.tagName = "HTML";
  documentElement.textContent = "发布成功";
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image"
  };
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
    locationState.href = "https://creator.xiaohongshu.com/publish/success/64b7d8ef000000001f03abce";
  };
  visibilityLabel.parentElement = settingRow;
  visibilityTrigger.parentElement = settingRow;
  settingRow.children = [visibilityLabel, visibilityTrigger];
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: locationState }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement,
      querySelectorAll: (selector: string) => {
        if (selector.includes("label") || selector.includes("permission") || selector.includes("visibility")) {
          return [visibilityLabel];
        }
        if (selector.includes("value") || selector.includes("current")) {
          return [visibilityTrigger];
        }
        if (selector.includes("dropdown") || selector.includes("item") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-plain-dropdown-private-option",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-plain-dropdown-private-option",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/plain-dropdown-private-option",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/plain-dropdown-private-option",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-01T00:00:00.000Z"
      }
    });

    expect(visibilityTrigger.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["trigger", "private-option", "submit"]);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "GO",
      full_live_write_success: true,
      submit_success: true,
      publish_success: true
    });
  } finally {
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
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
});

it("clicks the nearest visibility selector container when the public value text is not actionable", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList = [] as string[];
    textContent = "";
    clicked = false;
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    getAttribute = (name: string) => {
      if (name === "class") {
        return this.className;
      }
      return null;
    };
    getBoundingClientRect = () => ({ width: 128, height: 32 });
    querySelectorAll = () => this.children;
    click = () => {
      this.clicked = true;
    };
  }
  const settingRow = new TestElement();
  settingRow.className = "publish-setting-row";
  const visibilityLabel = new TestElement();
  visibilityLabel.className = "form-label";
  visibilityLabel.textContent = "可见权限";
  const selectorContainer = new TestElement();
  selectorContainer.className = "reds-select-selector";
  const publicValueText = new TestElement();
  publicValueText.className = "plain-text";
  publicValueText.textContent = "公开可见";
  let privateOptionVisible = false;
  const clickOrder: string[] = [];
  publicValueText.click = () => {
    publicValueText.clicked = true;
    clickOrder.push("public-value-text");
  };
  selectorContainer.click = () => {
    selectorContainer.clicked = true;
    privateOptionVisible = true;
    clickOrder.push("selector-container");
  };
  const privateOption = new TestElement();
  privateOption.tagName = "LI";
  privateOption.className = "reds-dropdown-item";
  privateOption.classList = ["reds-dropdown-item"];
  privateOption.textContent = "仅自己可见";
  privateOption.click = () => {
    privateOption.clicked = true;
    clickOrder.push("private-option");
  };
  const submit = new TestElement();
  submit.tagName = "BUTTON";
  submit.textContent = "发布";
  const documentElement = new TestElement();
  documentElement.tagName = "HTML";
  documentElement.textContent = "";
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image"
  };
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };
  visibilityLabel.parentElement = settingRow;
  selectorContainer.parentElement = settingRow;
  publicValueText.parentElement = selectorContainer;
  selectorContainer.children = [publicValueText];
  settingRow.children = [visibilityLabel, selectorContainer];
  settingRow.querySelectorAll = () => [visibilityLabel, selectorContainer, publicValueText];
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: locationState }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement,
      querySelectorAll: (selector: string) => {
        if (selector.includes("label") || selector.includes("permission") || selector.includes("visibility")) {
          return [visibilityLabel];
        }
        if (selector.includes("dropdown") || selector.includes("item") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("value") || selector.includes("current") || selector.includes("span")) {
          return [publicValueText];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-visibility-clickable-ancestor",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-visibility-clickable-ancestor",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/visibility-clickable-ancestor",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/visibility-clickable-ancestor",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-01T00:00:00.000Z"
      }
    });

    expect(publicValueText.clicked).toBe(false);
    expect(selectorContainer.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["selector-container", "private-option", "submit"]);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      submit_success: true,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
        })
      ]
    });
  } finally {
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
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
});

it("tries the next visibility selector when an earlier public value does not open private options", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList = [] as string[];
    textContent = "";
    clicked = false;
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    getAttribute = (name: string) => (name === "class" ? this.className : null);
    getBoundingClientRect = () => ({ width: 128, height: 32 });
    querySelectorAll = () => this.children;
    click = () => {
      this.clicked = true;
    };
  }
  const staleRow = new TestElement();
  staleRow.className = "publish-setting-row";
  const staleLabel = new TestElement();
  staleLabel.textContent = "可见范围";
  const stalePublicValue = new TestElement();
  stalePublicValue.className = "plain-current-value";
  stalePublicValue.textContent = "公开可见";
  const activeRow = new TestElement();
  activeRow.className = "publish-setting-row";
  const activeLabel = new TestElement();
  activeLabel.textContent = "可见权限";
  const activeSelector = new TestElement();
  activeSelector.className = "reds-select-selector";
  activeSelector.textContent = "公开可见";
  const activePublicValue = new TestElement();
  activePublicValue.textContent = "公开可见";
  let privateOptionVisible = false;
  const clickOrder: string[] = [];
  stalePublicValue.click = () => {
    stalePublicValue.clicked = true;
    clickOrder.push("stale-public-value");
  };
  activeSelector.click = () => {
    activeSelector.clicked = true;
    privateOptionVisible = true;
    clickOrder.push("active-selector");
  };
  const privateOption = new TestElement();
  privateOption.tagName = "LI";
  privateOption.className = "reds-dropdown-item";
  privateOption.classList = ["reds-dropdown-item"];
  privateOption.textContent = "仅我可见";
  privateOption.click = () => {
    privateOption.clicked = true;
    clickOrder.push("private-option");
  };
  const submit = new TestElement();
  submit.tagName = "BUTTON";
  submit.textContent = "发布";
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };
  const documentElement = new TestElement();
  documentElement.tagName = "HTML";
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image"
  };
  staleLabel.parentElement = staleRow;
  stalePublicValue.parentElement = staleRow;
  staleRow.children = [staleLabel, stalePublicValue];
  activeLabel.parentElement = activeRow;
  activeSelector.parentElement = activeRow;
  activePublicValue.parentElement = activeSelector;
  activeSelector.children = [activePublicValue];
  activeRow.children = [activeLabel, activeSelector];
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: locationState }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement,
      querySelectorAll: (selector: string) => {
        if (selector.includes("label") || selector.includes("permission") || selector.includes("visibility")) {
          return [staleLabel, activeLabel];
        }
        if (selector.includes("dropdown") || selector.includes("item") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        return [stalePublicValue, activeSelector, activePublicValue];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-visibility-next-selector",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-next-visibility-selector",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/next-visibility-selector",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/next-visibility-selector",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-01T00:00:00.000Z"
      }
    });

    expect(stalePublicValue.clicked).toBe(true);
    expect(activeSelector.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["stale-public-value", "active-selector", "private-option", "submit"]);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      submit_success: true,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
        })
      ]
    });
  } finally {
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
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
});

it("does not use non-actionable publish text containers as submit controls", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    textContent = "";
    clicked = false;
    getAttribute = (name: string) => (name === "class" ? this.className : null);
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    click = () => {
      this.clicked = true;
    };
  }
  const privateOption = new TestElement();
  privateOption.className = "visibility-option";
  privateOption.classList = ["visibility-option"];
  privateOption.textContent = "仅自己可见";
  const publishContainer = new TestElement();
  publishContainer.className = "publish-panel";
  publishContainer.classList = ["publish-panel"];
  publishContainer.textContent = "发布";
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
        if (selector.includes("visibility") || selector.includes("option")) {
          return [privateOption];
        }
        if (selector.includes('class*="publish"')) {
          return [publishContainer];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-submit-container-not-clicked",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-submit-container-not-clicked",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/submit-container",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/submit-container",
        page_preview_locator: "img.preview-image",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-05-30T20:16:08.000Z"
      }
    });

    expect(publishContainer.clicked).toBe(false);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      submit_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "SUBMIT_CONTROL_MISSING",
          blocker_layer: "submit"
        })
      ]
    });
  } finally {
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

it("stops after accepted upload when private visibility control is missing", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  class TestElement {
    id = "";
    tagName = "BUTTON";
    className = "publish-submit";
    classList = ["publish-submit"];
    textContent = "发布";
    clicked = false;
    getAttribute = (name: string) => (name === "class" ? this.className : null);
    getBoundingClientRect = () => ({ width: 80, height: 32 });
    click = () => {
      this.clicked = true;
    };
  }
  const submit = new TestElement();
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
      documentElement: submit,
      querySelectorAll: (selector: string) => {
        if (selector.includes("visibility") || selector.includes("privacy") || selector.includes("permission")) {
          return [];
        }
        if (selector.includes("publish") || selector.includes("submit") || selector.includes("button")) {
          return [submit];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-missing-private-visibility",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-924-missing-private-visibility",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/missing-private",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/def123def123def123def123def123def123",
        page_preview_locator: "img.preview-image",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-05-30T20:16:08.000Z"
      }
    });

    expect(submit.clicked).toBe(false);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
      submit_success: false,
      cleanup_required: true,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_VISIBILITY_CONTROL_MISSING",
          blocker_layer: "publish"
        })
      ]
    });
    expect(result.live_write_evidence).toMatchObject({
      execution_phase: "publish",
      cleanup_result: expect.objectContaining({
        cleanup_action: "abandon_unpublished_upload",
        cleanup_outcome: "not_needed"
      }),
      stop_signal: expect.objectContaining({
        stopped_step: "publish",
        blocker_code: "PUBLISH_VISIBILITY_CONTROL_MISSING",
        cleanup_required: true
      })
    });
  } finally {
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

it("continues from an accepted upload artifact through private submit/publish cleanup", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalLocation = globalThis.location;
  const originalWindow = globalThis.window;

  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "BUTTON";
    classList: string[] = [];
    parentElement = null;
    disabled = false;
    textContent: string;
    attributes: Record<string, string>;
    clicked = false;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent() {
      return true;
    }
    click() {
      this.clicked = true;
      if (this.textContent.includes("发布")) {
        (globalThis.location as unknown as { href: string }).href =
          "https://creator.xiaohongshu.com/publish/success?note_id=fr0032note123";
      }
    }
    getBoundingClientRect = () => ({ width: 120, height: 32 });
  }
  const visibility = new TestElement("仅自己可见");
  const submit = new TestElement("发布");

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { href: "https://creator.xiaohongshu.com/publish/publish" }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: globalThis.location }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: new TestElement("发布成功"),
      querySelectorAll: () => [visibility, submit]
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-accepted-upload-submit-publish",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-924-submit-publish",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr0032-accepted",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/test",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-05-30T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(visibility.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "GO",
      full_live_write_success: true,
      upload_success: true,
      submit_success: true,
      publish_success: true,
      cleanup_success: true,
      blockers: []
    });
    expect(result.live_write_evidence).toMatchObject({
      submit_evidence: expect.objectContaining({
        submit_result_state: "accepted"
      }),
      publish_result_identity: expect.objectContaining({
        note_id: "fr0032note123",
        published_url: "https://www.xiaohongshu.com/explore/fr0032note123",
        verification_state: "verified"
      }),
      cleanup_result: expect.objectContaining({
        cleanup_action: "hide_published_result",
        cleanup_outcome: "hidden"
      }),
      risk_signals: [],
      stop_signal: null
    });
  } finally {
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: originalLocation
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
});

it("stops before submit when accepted upload exists but private visibility is unavailable", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  class TestElement {
    id = "";
    tagName = "BUTTON";
    classList: string[] = [];
    parentElement = null;
    disabled = false;
    textContent = "发布";
    getAttribute() {
      return null;
    }
    getBoundingClientRect = () => ({ width: 120, height: 32 });
  }
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
      querySelectorAll: () => [new TestElement()]
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-private-visibility-missing",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-924-private-visibility-missing",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr0032-accepted",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/test",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-05-30T00:00:00.000Z",
        preview_diagnostics: null
      }
    });
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
      submit_success: false,
      cleanup_required: true,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_VISIBILITY_CONTROL_MISSING",
          blocker_layer: "publish"
        })
      ]
    });
  } finally {
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

it("extracts trusted platform upload acceptance refs from upload responses", () => {
  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://creator.xiaohongshu.com/api/media/upload",
      method: "POST",
      status: 200,
      body: {
        success: true,
        data: {
          image_id: "platform-image-123",
          url: "https://sns-webpic-qc.xhscdn.com/20260530/fr0032.png"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toMatchObject({
    platform_staging_ref: "image_id:platform-image-123",
    source: "chrome_debugger_network"
  });

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://creator.xiaohongshu.com/api/media/upload",
      method: "POST",
      status: 200,
      body: {
        success: true,
        data: {
          url: "https://sns-webpic-qc.xhscdn.com/20260530/fr0032.png"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://creator.xiaohongshu.com/api/media/upload",
      method: "POST",
      status: 500,
      body: {
        data: {
          image_id: "platform-image-123"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://creator.xiaohongshu.com/api/media/upload",
      method: "POST",
      status: 200,
      body: '{"code":0,"data":{"image_id":"platform-image-from-text"}',
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toMatchObject({
    platform_staging_ref: "image_id:platform-image-from-text"
  });

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://sns-webpic-qc.xhscdn.com/20260530/upload/fr0032.png",
      method: "GET",
      status: 200,
      body: {
        data: {
          image_id: "platform-image-123"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://creator.xiaohongshu.com/api/media/upload",
      method: "GET",
      status: 200,
      body: {
        data: {
          image_id: "platform-image-123"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://creator.xiaohongshu.com/api/media/v1/upload/creator/permit",
      method: "POST",
      status: 200,
      body: {
        data: {
          token: "temporary-upload-token-123",
          policy: "temporary-upload-policy-123"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://creator.xiaohongshu.com/api/user/profile",
      method: "POST",
      status: 200,
      body: {
        data: {
          uploadid: "too-broad-key-123"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://creator.xiaohongshu.com/api/media/upload",
      method: "POST",
      status: 200,
      body: {
        data: {
          uploadid: "too-broad-key-123"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://upload.xiaohongshu.com/api/media/upload",
      method: "POST",
      status: 200,
      body: {
        data: {
          fileid: "platform-file-lowercase-123"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toMatchObject({
    platform_staging_ref: "fileid:platform-file-lowercase-123"
  });

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://creator.xiaohongshu.com/api/media/upload",
      method: "POST",
      status: 200,
      body: {
        data: {
          imageFileId: "platform-image-file-123"
        }
      },
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toMatchObject({
    platform_staging_ref: "imageFileId:platform-image-file-123"
  });

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://ros-upload.xiaohongshu.com/creator/20260530/fr0032-fixture.png",
      method: "GET",
      status: 200,
      body: null,
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://sns-webpic-qc.xhscdn.com/20260530/upload/fr0032.png",
      method: "PUT",
      status: 200,
      body: null,
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://ros-upload-d4.xhscdn.com/creator/20260530/fr0032-fixture.png",
      method: "POST",
      status: 204,
      body: null,
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toBeNull();
});

it("uses an explicit host/path/method allowlist before upload response body capture", () => {
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://creator.xiaohongshu.com/api/media/upload",
      "POST"
    )
  ).toBe(true);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://edith.xiaohongshu.com/api/material/image/create",
      "PUT"
    )
  ).toBe(true);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://sns-webpic-qc.xhscdn.com/20260530/upload/fr0032.png",
      "GET"
    )
  ).toBe(false);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://upload.xiaohongshu.com/api/media/upload",
      "POST"
    )
  ).toBe(true);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://upload.xiaohongshu.com/api/account/status",
      "POST"
    )
  ).toBe(false);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://ros-upload.xiaohongshu.com/creator/20260530/fr0032-fixture.png",
      "PUT"
    )
  ).toBe(false);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://ros-upload-d4.xhscdn.com/creator/20260530/fr0032-fixture.png",
      "POST"
    )
  ).toBe(false);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://ros-upload-d4.xhscdn.com/spectrum/XbAJSnnddgqFkj8Nst9wiMCtHGGO9a3Rp4vxdqzli0PBySQ",
      "PUT"
    )
  ).toBe(true);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://creator.xiaohongshu.com/api/user/profile",
      "POST"
    )
  ).toBe(false);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://creator.xiaohongshu.com/api/media/upload",
      "GET"
    )
  ).toBe(false);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://ros-upload.xiaohongshu.com/creator/20260530/fr0032-fixture.png",
      "GET"
    )
  ).toBe(false);
  expect(
    isXhsControlledUploadPlatformCaptureUrl(
      "https://sns-webpic-qc.xhscdn.com/20260530/upload/fr0032.png",
      "PUT"
    )
  ).toBe(false);
});

it("classifies 2xx ros-upload object transports as platform staging candidates", () => {
  expect(
    summarizeXhsControlledUploadObservedRequest(
      "https://ros-upload.xiaohongshu.com/spectrum/Yrtpg81qA4U9bTfi4jcmtQPKo2Kh8nQAU7M62npADlDeyCw",
      "PUT"
    )
  ).toMatchObject({
    method: "PUT",
    host: "ros-upload.xiaohongshu.com",
    path: "/spectrum/Yrtpg81qA4U9bTfi4jcmtQPKo2Kh8nQAU7M62npADlDeyCw",
    capture_candidate: true,
    rejection_reason: null
  });

  expect(
    summarizeXhsControlledUploadObservedRequest(
      "https://ros-upload-d4.xhscdn.com/spectrum/XbAJSnnddgqFkj8Nst9wiMCtHGGO9a3Rp4vxdqzli0PBySQ",
      "POST"
    )
  ).toMatchObject({
    host: "ros-upload-d4.xhscdn.com",
    capture_candidate: false,
    rejection_reason: "object_upload_transport_not_platform_acceptance"
  });

  expect(
    extractXhsControlledUploadPlatformCapture({
      url: "https://ros-upload-d4.xhscdn.com/spectrum/XbAJSnnddgqFkj8Nst9wiMCtHGGO9a3Rp4vxdqzli0PBySQ",
      method: "PUT",
      status: 200,
      body: null,
      captured_at: "2026-05-30T00:00:00.000Z"
    })
  ).toMatchObject({
    evidence_basis: "object_upload_transport_2xx",
    platform_staging_ref:
      "object_upload:ros-upload-d4.xhscdn.com/spectrum/XbAJSnnddgqFkj8Nst9wiMCtHGGO9a3Rp4vxdqzli0PBySQ"
  });

  expect(
    summarizeXhsControlledUploadObservedRequest(
      "https://upload.xiaohongshu.com/api/media/upload",
      "POST"
    )
  ).toMatchObject({
    capture_candidate: true,
    rejection_reason: null
  });

  expect(
    summarizeXhsControlledUploadObservedRequest(
      "https://creator.xiaohongshu.com/api/sns/web/v1/resource/permit",
      "POST"
    )
  ).toMatchObject({
    host: "creator.xiaohongshu.com",
    path: "/api/sns/web/v1/resource/permit",
    capture_candidate: false,
    rejection_reason: "credential_endpoint_not_platform_acceptance"
  });

  expect(
    summarizeXhsControlledUploadObservedRequest(
      "https://creator.xiaohongshu.com/api/sns/web/v1/resource/token",
      "POST"
    )
  ).toMatchObject({
    host: "creator.xiaohongshu.com",
    path: "/api/sns/web/v1/resource/token",
    capture_candidate: false,
    rejection_reason: "credential_endpoint_not_platform_acceptance"
  });

  expect(
    summarizeXhsControlledUploadObservedRequest(
      "https://creator.xiaohongshu.com/api/media/v1/upload/creator/permit",
      "POST"
    )
  ).toMatchObject({
    host: "creator.xiaohongshu.com",
    path: "/api/media/v1/upload/creator/permit",
    capture_candidate: false,
    rejection_reason: "credential_endpoint_not_platform_acceptance"
  });

  expect(
    summarizeXhsControlledUploadObservedRequest(
      "https://creator.xiaohongshu.com/api/sns/web/v1/note/commit",
      "POST"
    )
  ).toMatchObject({
    host: "creator.xiaohongshu.com",
    path: "/api/sns/web/v1/note/commit",
    capture_candidate: false,
    rejection_reason: "xhs_write_request_not_upload_signal"
  });

  expect(
    summarizeXhsControlledUploadObservedRequest(
      "https://creator.xiaohongshu.com/api/sns/web/v1/note/commit",
      "GET"
    )
  ).toBeNull();
});

it("decodes bounded upload network bodies consistently with explicit string fallback", () => {
  expect(
    decodeXhsControlledUploadNetworkResponseBody({
      body: '{"code":0,"data":{"image_id":"platform-image-123"}}',
      base64Encoded: false
    })
  ).toMatchObject({
    code: 0,
    data: {
      image_id: "platform-image-123"
    }
  });
  expect(
    decodeXhsControlledUploadNetworkResponseBody({
      body: btoa('{"code":0,"data":{"image_id":"platform-image-encoded"}}'),
      base64Encoded: true
    })
  ).toMatchObject({
    data: {
      image_id: "platform-image-encoded"
    }
  });
  expect(
    decodeXhsControlledUploadNetworkResponseBody({
      body: '"image_id":"platform-image-from-fragment"',
      base64Encoded: false
    })
  ).toBe('"image_id":"platform-image-from-fragment"');
  expect(
    decodeXhsControlledUploadNetworkResponseBody({
      body: "x".repeat(33),
      maxBodyBytes: 32
    })
  ).toBeNull();
});

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
            source_media_digest: "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
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
      source_media_digest: "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
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
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
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
    let uploadDispatched = false;
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
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
          return uploadDispatched ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-approved-fixture",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
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
            "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
          accepted_by_platform: false,
          visible_in_editor: true,
          page_preview_locator: "img.preview-image",
          preview_diagnostics: expect.objectContaining({
            schema_version: "fr-0032.preview_dom_diagnostics.v1",
            values_recorded: false,
            recording_policy: "attribute_names_and_signal_flags_only",
            preview_chain: [
              expect.objectContaining({
                depth: 0,
                tag_name: "img",
                locator: "img.preview-image",
                attribute_names: [],
                src_kind: null,
                has_upload_completion_signal: false,
                has_upload_pending_signal: false,
                has_upload_failure_signal: false
              })
            ]
          })
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

  it("waits for delayed editor preview before classifying upload as preview missing", async () => {
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
      className = "preview-image";
      classList = ["preview-image"];
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return "blob:https://creator.xiaohongshu.com/fr0032-delayed-fixture";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    let uploadDispatched = false;
    let previewQueryCount = 0;
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
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
          if (!uploadDispatched) {
            return [];
          }
          previewQueryCount += 1;
          return previewQueryCount >= 3 ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-delayed-preview",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-898-delayed-preview",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(previewQueryCount).toBeGreaterThanOrEqual(1);
      expect(result.live_write_evaluation).toMatchObject({
        decision: "NO_GO",
        upload_success: false,
        blockers: [
          expect.objectContaining({
            blocker_code: "UPLOAD_ACCEPTANCE_UNVERIFIED",
            blocker_layer: "upload"
          })
        ]
      });
      expect(result.live_write_evidence).toMatchObject({
        upload_artifact_identity: expect.objectContaining({
          visible_in_editor: true,
          page_preview_locator: "img.preview-image"
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
  }, 8_000);

  it("waits past the first visible preview until ancestor platform staging and completion are both observed", async () => {
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
    let previewQueryCount = 0;
    class PreviewContainer {
      id = "";
      tagName = "DIV";
      className = "upload-card";
      classList = ["upload-card"];
      parentElement = null;
      get textContent() {
        return previewQueryCount >= 3 ? "上传完成" : "上传中";
      }
      getAttribute = (name: string) => {
        if (name === "class") {
          return "upload-card";
        }
        if (name === "data-upload-id" && previewQueryCount >= 3) {
          return "xhs-upload-fr0032-accepted";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 64, height: 64 });
    }
    class PreviewElement {
      id = "";
      tagName = "IMG";
      className = "preview-image";
      classList = ["preview-image"];
      textContent = "";
      parentElement = new PreviewContainer();
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return previewQueryCount >= 3
            ? "https://sns-webpic-qc.xhscdn.com/20260530/fr0032-fixture.png"
            : "blob:https://creator.xiaohongshu.com/fr0032-fixture";
        }
        if (name === "data-upload-id" && previewQueryCount >= 3) {
          return "xhs-upload-fr0032-accepted";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    let uploadDispatched = false;
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
    };
    const preview = new PreviewElement();
    Object.defineProperty(globalThis, "DataTransfer", {
      configurable: true,
      value: TestDataTransfer
    });
    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: PreviewElement
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
          if (!uploadDispatched) {
            return [];
          }
          previewQueryCount += 1;
          return [preview];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-delayed-upload-acceptance",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-898-delayed-upload-acceptance",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(previewQueryCount).toBeGreaterThanOrEqual(3);
      expect(result.live_write_evaluation).toMatchObject({
        decision: "NO_GO",
        upload_success: true,
        submit_success: false,
        cleanup_required: true,
        blockers: [
          expect.objectContaining({
            blocker_code: "PUBLISH_VISIBILITY_CONTROL_MISSING",
            blocker_layer: "publish"
          })
        ]
      });
      expect(result.live_write_evidence).toMatchObject({
        execution_phase: "publish",
        upload_artifact_identity: expect.objectContaining({
          accepted_by_platform: true,
          visible_in_editor: true,
          platform_staging_ref: "data-upload-id:xhs-upload-fr0032-accepted",
          page_preview_locator: "img.preview-image"
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
  }, 8_000);

  it("selects image publish mode before choosing an upload entry for the approved image fixture", async () => {
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
      tagName = "DIV";
      className = "";
      classList = [] as string[];
      textContent = "";
      getAttribute = (name: string) => {
        if (name === "class") {
          return this.className;
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 64, height: 32 });
    }
    class ImageModeTab extends TestElement {
      textContent = "上传图文";
      clicked = false;
      click = () => {
        this.clicked = true;
        imageModeSelected = true;
      };
    }
    class PreviewElement extends TestElement {
      tagName = "IMG";
      className = "preview-image";
      classList = ["preview-image"];
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return "blob:https://creator.xiaohongshu.com/fr0032-fixture";
        }
        return null;
      };
    }
    let imageModeSelected = false;
    let uploadDispatched = false;
    const videoInput = {
      accept: ".mp4,.mov",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        throw new Error("video input must not be used for image fixture");
      }
    };
    const imageInput = {
      accept: ".jpg,.jpeg,.png,.webp",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
    };
    const imageModeTab = new ImageModeTab();
    const preview = new PreviewElement();
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
            return [imageModeSelected ? imageInput : videoInput];
          }
          if (selector.includes("button") || selector.includes("tab")) {
            return [imageModeTab];
          }
          return uploadDispatched ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-select-image-mode",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-893-select-image-mode",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(imageModeTab.clicked).toBe(true);
      expect(uploadDispatched).toBe(true);
      expect(result.live_write_evidence).toMatchObject({
        upload_artifact_identity: expect.objectContaining({
          accepted_by_platform: false,
          visible_in_editor: true,
          page_preview_locator: "img.preview-image"
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

  it("falls back to a visible dropzone when only video file inputs are present", async () => {
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
      tagName = "DIV";
      className = "upload-entry";
      classList = ["upload-entry"];
      textContent = "上传";
      getAttribute = (name: string) => {
        if (name === "class") {
          return this.className;
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 64, height: 32 });
      dispatchEvent = () => true;
    }
    let videoInputTouched = false;
    let dropzoneTouched = false;
    const videoInput = {
      accept: ".mp4,.mov,.flv,.mkv",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        videoInputTouched = true;
        return true;
      }
    };
    class UploadDropzone extends TestElement {
      dispatchEvent = () => {
        dropzoneTouched = true;
        return true;
      };
    }
    class PreviewImage extends TestElement {
      tagName = "IMG";
      className = "uploaded-preview";
      classList = ["uploaded-preview"];
      textContent = "";
      getAttribute = (name: string) => {
        if (name === "class") {
          return this.className;
        }
        if (name === "src") {
          return "blob:https://creator.xiaohongshu.com/fr0032-dropzone-fallback";
        }
        return null;
      };
    }
    const dropzone = new UploadDropzone();
    const preview = new PreviewImage();
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
            return [videoInput];
          }
          if (selector.includes("img")) {
            return dropzoneTouched ? [preview] : [];
          }
          if (selector.includes("upload")) {
            return [dropzone];
          }
          return [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-video-input-rejected",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-898-video-input-rejected",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(videoInputTouched).toBe(false);
      expect(result.live_write_evaluation).toMatchObject({
        decision: "NO_GO",
        upload_success: false,
        blockers: [
          expect.objectContaining({
            blocker_code: "UPLOAD_ACCEPTANCE_UNVERIFIED",
            blocker_layer: "upload"
          })
        ]
      });
      expect(dropzoneTouched).toBe(true);
      expect(result.live_write_evidence.upload_artifact_identity).toMatchObject({
        visible_in_editor: true,
        page_preview_locator: "img.uploaded-preview"
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

  it("prefers an explicit image file input over a generic empty-accept input", async () => {
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
      className = "preview-image";
      classList = ["preview-image"];
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return "blob:https://creator.xiaohongshu.com/fr0032-fixture";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    let genericInputTouched = false;
    let imageInputTouched = false;
    const genericInput = {
      accept: "",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        genericInputTouched = true;
        return true;
      }
    };
    const imageInput = {
      accept: ".jpg,.jpeg,.png,.webp",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        imageInputTouched = true;
        return true;
      }
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
            return [genericInput, imageInput];
          }
          return imageInputTouched ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-image-input-priority",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-898-image-input-priority",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(genericInputTouched).toBe(false);
      expect(imageInputTouched).toBe(true);
      expect(result.live_write_evidence).toMatchObject({
        upload_artifact_identity: expect.objectContaining({
          visible_in_editor: true,
          page_preview_locator: "img.preview-image"
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

  it("rejects a generic empty-accept file input for the approved image fixture", async () => {
    const originalDocument = globalThis.document;
    const genericInput = {
      accept: "",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        throw new Error("generic empty-accept input must not be used for image fixture");
      }
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        querySelectorAll: (selector: string) => {
          if (selector === 'input[type="file"]') {
            return [genericInput];
          }
          return [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-empty-accept-rejected",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-898-empty-accept-rejected",
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
            blocker_code: "IMAGE_UPLOAD_ENTRY_MISSING",
            blocker_layer: "upload"
          })
        ]
      });
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument
      });
    }
  });

  it("falls back to the upload dropzone when image file input assignment produces no editor preview", async () => {
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
      tagName = "DIV";
      className = "";
      classList = [] as string[];
      textContent = "";
      getAttribute = (name: string) => {
        if (name === "class") {
          return this.className;
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 64, height: 32 });
    }
    class DropzoneElement extends TestElement {
      className = "upload-dropzone";
      classList = ["upload-dropzone"];
      textContent = "点击上传图片";
      dispatchedEvents: string[] = [];
      dispatchEvent = (event: Event) => {
        this.dispatchedEvents.push(event.type);
        dropzoneDispatched = true;
        return true;
      };
    }
    class PreviewElement extends TestElement {
      tagName = "IMG";
      className = "preview-image";
      classList = ["preview-image"];
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return "blob:https://creator.xiaohongshu.com/fr0032-dropzone-fixture";
        }
        return null;
      };
    }
    let fileInputDispatched = false;
    let dropzoneDispatched = false;
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        fileInputDispatched = true;
        return true;
      }
    };
    const dropzone = new DropzoneElement();
    const preview = new PreviewElement();
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
          if (selector.includes("upload") && !dropzoneDispatched) {
            return [dropzone];
          }
          return dropzoneDispatched ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-dropzone-fallback",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-893-dropzone-fallback",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(fileInputDispatched).toBe(true);
      expect(dropzone.dispatchedEvents).toEqual(["dragenter", "dragover", "drop"]);
      expect(result.live_write_evidence).toMatchObject({
        upload_artifact_identity: expect.objectContaining({
          accepted_by_platform: false,
          visible_in_editor: true,
          page_preview_locator: "img.preview-image"
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
  }, 8_000);

  it("selects the creator image publish target before controlled image upload", async () => {
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
      tagName = "DIV";
      className = "";
      classList = [] as string[];
      textContent = "";
      getAttribute = (name: string) => {
        if (name === "class") {
          return this.className;
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 80, height: 32 });
    }
    class ImageModeLink extends TestElement {
      tagName = "A";
      className = "publish-tab";
      classList = ["publish-tab"];
      textContent = "上传图文";
      getAttribute = (name: string) => {
        if (name === "href") {
          return "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image";
        }
        if (name === "class") {
          return this.className;
        }
        return null;
      };
      click = () => {
        imageModeSelected = true;
      };
    }
    class PreviewElement extends TestElement {
      tagName = "IMG";
      className = "preview-image";
      classList = ["preview-image"];
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return "blob:https://creator.xiaohongshu.com/fr0032-image-mode";
        }
        return null;
      };
    }
    let imageModeSelected = false;
    let fileInputDispatched = false;
    const imageModeLink = new ImageModeLink();
    const imageInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        fileInputDispatched = true;
        return true;
      }
    };
    const preview = new PreviewElement();
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
      value: () => ({ display: "block", visibility: "visible", opacity: "1", backgroundImage: "none" })
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        querySelectorAll: (selector: string) => {
          if (selector.includes("target=image") || selector.includes("role=\"tab\"")) {
            return [imageModeLink];
          }
          if (selector === 'input[type="file"]') {
            return imageModeSelected ? [imageInput] : [];
          }
          return fileInputDispatched ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-select-image-mode",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-909-select-image-mode",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(imageModeSelected).toBe(true);
      expect(fileInputDispatched).toBe(true);
      expect(result.live_write_evidence).toMatchObject({
        upload_artifact_identity: expect.objectContaining({
          visible_in_editor: true,
          page_preview_locator: "img.preview-image"
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
  }, 8_000);

  it("recognizes background-image editor previews after controlled upload", async () => {
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
      tagName = "DIV";
      className = "";
      classList = [] as string[];
      textContent = "";
      getAttribute = (name: string) => {
        if (name === "class") {
          return this.className;
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 96, height: 96 });
    }
    class BackgroundPreviewElement extends TestElement {
      className = "preview-card";
      classList = ["preview-card"];
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-card";
        }
        if (name === "style") {
          return 'background-image: url("blob:https://creator.xiaohongshu.com/fr0032-background-preview")';
        }
        return null;
      };
    }
    let uploadDispatched = false;
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
    };
    const preview = new BackgroundPreviewElement();
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
      value: () => ({
        display: "block",
        visibility: "visible",
        opacity: "1",
        backgroundImage: 'url("blob:https://creator.xiaohongshu.com/fr0032-background-preview")'
      })
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        querySelectorAll: (selector: string) => {
          if (selector === 'input[type="file"]') {
            return [fileInput];
          }
          if (selector.includes("background-image") || selector.includes("preview")) {
            return uploadDispatched ? [preview] : [];
          }
          return [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-background-preview",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-909-background-preview",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(result.live_write_evidence).toMatchObject({
        upload_artifact_identity: expect.objectContaining({
          visible_in_editor: true,
          page_preview_locator: "div.preview-card"
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
  }, 8_000);

  it("does not treat the creator upload icon as an uploaded media preview", async () => {
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
      className = "upload-icon";
      classList = ["upload-icon"];
      textContent = "";
      getAttribute = (name: string) => {
        if (name === "class") {
          return "upload-icon";
        }
        if (name === "src") {
          return "data:image/png;base64,placeholder";
        }
        if (name === "alt") {
          return "上传图片";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    let uploadDispatched = false;
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
    };
    const uploadIcon = new TestElement();
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
          return [uploadIcon];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-upload-icon-placeholder",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-893-upload-icon-placeholder",
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
        upload_artifact_identity: expect.objectContaining({
          accepted_by_platform: false,
          visible_in_editor: false,
          page_preview_locator: null
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

  it("does not treat upload completion text alone as platform acceptance", async () => {
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
      className = "preview-image";
      classList = ["preview-image"];
      textContent = "上传完成";
      parentElement = null;
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return "blob:https://creator.xiaohongshu.com/fr0032-fixture";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    let uploadDispatched = false;
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
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
          return uploadDispatched ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-upload-complete-text-only",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-893-upload-complete-text-only",
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
          accepted_by_platform: false,
          visible_in_editor: true,
          platform_staging_ref: null,
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

  it("does not treat pre-existing platform staging id as current upload acceptance", async () => {
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
      className = "preview-image";
      classList = ["preview-image"];
      textContent = "";
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return "blob:https://creator.xiaohongshu.com/existing-decoration";
        }
        if (name === "data-upload-id") {
          return "existing-upload-id";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => true
    };
    const existingPreview = new TestElement();
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
          return [existingPreview];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-existing-platform-staging-id",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-893-existing-platform-staging-id",
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

  it("does not accept a pre-existing platform staging id when the preview changes after upload", async () => {
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
    let uploadDispatched = false;
    class TestElement {
      id = "";
      tagName = "IMG";
      className = "preview-image";
      classList = ["preview-image"];
      textContent = "";
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return uploadDispatched
            ? "blob:https://creator.xiaohongshu.com/changed-after-upload"
            : "blob:https://creator.xiaohongshu.com/existing-decoration";
        }
        if (name === "data-upload-id") {
          return "existing-upload-id";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
    };
    const existingPreview = new TestElement();
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
          return [existingPreview];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-existing-platform-staging-id-changed-preview",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-893-existing-platform-staging-id-changed-preview",
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
            blocker_code: "UPLOAD_ACCEPTANCE_UNVERIFIED",
            blocker_layer: "upload"
          })
        ]
      });
      expect(result.live_write_evidence).toMatchObject({
        execution_phase: "upload",
        upload_artifact_identity: expect.objectContaining({
          accepted_by_platform: false,
          visible_in_editor: true,
          platform_staging_ref: null,
          page_preview_locator: "img.preview-image"
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

  it("does not treat a changed platform media URL alone as upload acceptance", async () => {
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
      className = "preview-image";
      classList = ["preview-image"];
      textContent = "";
      parentElement = null;
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return "https://sns-webpic-qc.xhscdn.com/20260529/fr0032-fixture.png";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    let uploadDispatched = false;
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
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
          return uploadDispatched ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-platform-staging-ref",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-893-platform-staging-ref",
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
          accepted_by_platform: false,
          visible_in_editor: true,
          platform_staging_ref: null,
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

  it("does not treat a new preview data id as independent platform acceptance", async () => {
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
      className = "preview-image";
      classList = ["preview-image"];
      textContent = "";
      parentElement = null;
      getAttribute = (name: string) => {
        if (name === "class") {
          return "preview-image";
        }
        if (name === "src") {
          return "blob:https://creator.xiaohongshu.com/fr0032-fixture";
        }
        if (name === "data-upload-id") {
          return "current-upload-id";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 32, height: 32 });
    }
    let uploadDispatched = false;
    const fileInput = {
      accept: "image/*",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        uploadDispatched = true;
        return true;
      }
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
          return uploadDispatched ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-explicit-platform-staging-id",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-893-explicit-platform-staging-id",
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
          accepted_by_platform: false,
          visible_in_editor: true,
          platform_staging_ref: null,
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

  it("returns a structured upload blocker before the extension bridge deadline when upload entries produce no preview", async () => {
    const originalDataTransfer = globalThis.DataTransfer;
    const originalDocument = globalThis.document;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalGetComputedStyle = globalThis.getComputedStyle;
    const originalWindow = globalThis.window;
    const originalChrome = (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
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
      tagName = "DIV";
      className = "upload-dropzone";
      classList = ["upload-dropzone"];
      textContent = "点击上传图片";
      getAttribute = (name: string) => {
        if (name === "class") {
          return this.className;
        }
        if (name === "aria-label") {
          return "上传图片";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 64, height: 64 });
      dispatchEvent = () => true;
    }
    let fileInputDispatchCount = 0;
    let dropzoneDispatchCount = 0;
    const fileInput = {
      accept: ".jpg,.jpeg,.png,.webp",
      disabled: false,
      files: null as FileList | null,
      dispatchEvent: () => {
        fileInputDispatchCount += 1;
        return true;
      }
    };
    class UploadDropzone extends TestElement {
      dispatchEvent = () => {
        dropzoneDispatchCount += 1;
        return true;
      };
    }
    const dropzone = new UploadDropzone();
    const fakeDocument = {
      querySelectorAll: (selector: string) => {
        if (selector === 'input[type="file"]') {
          return [fileInput];
        }
        if (selector.includes("upload")) {
          return [dropzone];
        }
        return [];
      }
    };
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
      value: fakeDocument
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { document: fakeDocument }
    });
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {}
    });
    try {
      const resultPromise = performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-extension-no-preview-time-budget",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-928-extension-no-preview-time-budget",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish?target=image",
        latest_head_sha: "head-test"
      });
      const result = await resultPromise;

      expect(fileInputDispatchCount).toBeGreaterThan(0);
      expect(dropzoneDispatchCount).toBeGreaterThan(0);
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
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow
      });
      Object.defineProperty(globalThis, "chrome", {
        configurable: true,
        value: originalChrome
      });
    }
  }, 15_000);

  it("uses a visible upload dropzone when the current creator page has no file input", async () => {
    const originalDataTransfer = globalThis.DataTransfer;
    const originalDocument = globalThis.document;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalGetComputedStyle = globalThis.getComputedStyle;
    const originalDragEvent = globalThis.DragEvent;
    const dispatchedEvents: string[] = [];
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
      tagName = "DIV";
      className = "upload-dropzone";
      classList = ["upload-dropzone"];
      textContent = "点击上传图片";
      getAttribute = (name: string) => {
        if (name === "aria-label") {
          return "上传图片";
        }
        return null;
      };
      getBoundingClientRect = () => ({ width: 64, height: 64 });
      dispatchEvent = (event: Event) => {
        dispatchedEvents.push(event.type);
        return true;
      };
    }
    class TestPreviewElement extends TestElement {
      tagName = "IMG";
      className = "preview-image";
      classList = ["preview-image"];
      textContent = "";
      getAttribute = () => null;
    }
    const dropzone = new TestElement();
    const preview = new TestPreviewElement();
    Object.defineProperty(globalThis, "DataTransfer", {
      configurable: true,
      value: TestDataTransfer
    });
    Object.defineProperty(globalThis, "DragEvent", {
      configurable: true,
      value: undefined
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
            return [];
          }
          if (selector.includes("img")) {
            return dispatchedEvents.length > 0 ? [preview] : [];
          }
          if (selector.includes("upload")) {
            return [dropzone];
          }
          return dispatchedEvents.length > 0 ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-dropzone-upload",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-891-dropzone-upload",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(dispatchedEvents).toEqual(["dragenter", "dragover", "drop"]);
      expect(result.live_write_evaluation).toMatchObject({
        decision: "NO_GO",
        blockers: [
          expect.objectContaining({
            blocker_code: "UPLOAD_ACCEPTANCE_UNVERIFIED",
            blocker_layer: "upload"
          })
        ]
      });
      expect(result.live_write_evidence).toMatchObject({
        upload_artifact_identity: expect.objectContaining({
          accepted_by_platform: false,
          visible_in_editor: true,
          page_preview_locator: "img.preview-image"
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
      Object.defineProperty(globalThis, "DragEvent", {
        configurable: true,
        value: originalDragEvent
      });
    }
  });

  it("rejects visible non-upload dropdown-like elements as upload dropzones", async () => {
    const originalDataTransfer = globalThis.DataTransfer;
    const originalDocument = globalThis.document;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalGetComputedStyle = globalThis.getComputedStyle;
    const originalDragEvent = globalThis.DragEvent;
    const dispatchedEvents: string[] = [];
    class TestDataTransfer {
      items = {
        add: () => undefined
      };
    }
    class TestElement {
      id = "";
      tagName = "DIV";
      className = "dropdown upload-menu drop-shadow";
      classList = ["dropdown", "upload-menu", "drop-shadow"];
      textContent = "更多选项";
      getAttribute = () => null;
      getBoundingClientRect = () => ({ width: 64, height: 64 });
      dispatchEvent = (event: Event) => {
        dispatchedEvents.push(event.type);
        return true;
      };
    }
    const nonUploadElement = new TestElement();
    Object.defineProperty(globalThis, "DataTransfer", {
      configurable: true,
      value: TestDataTransfer
    });
    Object.defineProperty(globalThis, "DragEvent", {
      configurable: true,
      value: undefined
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
            return [];
          }
          if (selector.includes("upload")) {
            return [nonUploadElement];
          }
          return [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-non-upload-dropzone",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-891-non-upload-dropzone",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(dispatchedEvents).toEqual([]);
      expect(result.live_write_evaluation).toMatchObject({
        decision: "NO_GO",
        blockers: [
          expect.objectContaining({
            blocker_code: "UPLOAD_ENTRY_MISSING",
            blocker_layer: "upload"
          })
        ]
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
      Object.defineProperty(globalThis, "DragEvent", {
        configurable: true,
        value: originalDragEvent
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
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
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
