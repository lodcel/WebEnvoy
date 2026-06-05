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
  applyXhsControlledLiveWriteContinuationTimeout,
  applyXhsControlledPublishResultIdentityCapture,
  applyXhsControlledPublishResultIdentityCaptureStatus,
  applyXhsControlledUploadPlatformCapture,
  applyXhsControlledUploadPlatformCaptureStatus,
  buildXhsControlledLiveWriteUploadBlockedResult,
  buildXhsControlledLiveWriteFromDiscovery,
  decodeXhsControlledUploadNetworkResponseBody,
  extractXhsControlledPublishResultIdentityCapture,
  extractXhsControlledUploadPlatformCapture,
  finalizeXhsControlledPublishResultIdentityCapture,
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
      upload_artifact_id: "upload-artifact/fr-0032/test",
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

it("extracts a trusted post-submit publish result identity from a platform response", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        note_id: "64b7d8ef000000001f03981",
        visibility_scope: "private_or_self_visible"
      }
    }
  });

  expect(capture).toMatchObject({
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    publish_visibility_scope: "private_or_self_visible",
    publish_visibility_proof_locator: "$.data",
    url: "https://creator.xiaohongshu.com/api/creator/publish/result"
  });
});

it("does not bind adjacent visibility fields to an unrelated publish identity candidate", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        result: {
          note_id: "64b7d8ef000000001f03981"
        },
        visibility_scope: "private_or_self_visible"
      }
    }
  });

  expect(capture).toMatchObject({
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    publish_visibility_scope: null,
    publish_visibility_proof_locator: null
  });
});

it("does not treat boolean or numeric visibility values as private publish proof", () => {
  for (const visibilityValue of [false, 0]) {
    const capture = extractXhsControlledPublishResultIdentityCapture({
      url: "https://creator.xiaohongshu.com/api/creator/publish/result",
      method: "POST",
      status: 200,
      captured_at: "2026-06-03T00:00:00.000Z",
      body: {
        code: 0,
        data: {
          note_id: "64b7d8ef000000001f03981",
          visibility_scope: visibilityValue
        }
      }
    });

    expect(capture).toMatchObject({
      note_id: "64b7d8ef000000001f03981",
      publish_visibility_scope: null,
      publish_visibility_proof_locator: null
    });
  }
});

it("does not accept a generic creator publish page URL as publish result identity", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        creator_result_url: "https://creator.xiaohongshu.com/publish/publish",
        visibility_scope: "private_or_self_visible"
      }
    }
  });

  expect(capture).toBeNull();
});

it("does not accept mixed publish result identity candidates even when one candidate has bound visibility proof", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        previous: {
          note_id: "64b7d8ef000000001f03980"
        },
        result: {
          note_id: "64b7d8ef000000001f03981",
          visibility_scope: "private_or_self_visible"
        }
      }
    }
  });

  expect(capture).toBeNull();
});

it("accepts equivalent note id and published url candidates for the same publish result", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        note_id: "64b7d8ef000000001f03981",
        published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
        visibility_scope: "private_or_self_visible"
      }
    }
  });

  expect(capture).toMatchObject({
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    publish_visibility_scope: "private_or_self_visible",
    publish_visibility_proof_locator: "$.data"
  });
});

it("does not accept ambiguous publish identity candidates from a platform response", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://www.xiaohongshu.com/api/sns/web/v1/search/notes",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        items: [
          { note_id: "64b7d8ef000000001f03981" },
          { note_id: "64b7d8ef000000001f03982" }
        ]
      }
    }
  });

  expect(capture).toBeNull();
});

it("does not accept publish-adjacent endpoint note ids as controlled publish result identity", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/creator/publish/status",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        note_id: "64b7d8ef000000001f03981"
      }
    }
  });

  expect(capture).toBeNull();
});

it("does not accept search response note ids as controlled publish result identity", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://www.xiaohongshu.com/api/sns/web/v1/search/notes",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        items: [
          { note_id: "64b7d8ef000000001f03981" }
        ]
      }
    }
  });

  expect(capture).toBeNull();
});

it("does not promote an internal publish record without a verifiable note identity", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        publish_id: "publish-task-64b7d8ef000000001f03981"
      }
    }
  });

  expect(capture).toBeNull();
});

it("extracts a trusted private platform publish record from the creator submit response", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/galaxy/creator/note/user/post",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:00.000Z",
    body: {
      code: 0,
      data: {
        publish_id: "publish-task-64b7d8ef000000001f03981",
        visible_type: "仅自己可见"
      }
    }
  });

  expect(capture).toMatchObject({
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "platform_publish_record",
    note_id: null,
    published_url: null,
    creator_result_url: null,
    platform_record_ref: "publish-task-64b7d8ef000000001f03981",
    publish_visibility_scope: "private_or_self_visible",
    publish_visibility_proof_locator: "$.data",
    url: "https://creator.xiaohongshu.com/api/galaxy/creator/note/user/post"
  });
});

it("extracts a trusted post-submit note id from the v2 creator submit response shape", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/galaxy/v2/creator/note/user/post",
    method: "POST",
    status: 200,
    captured_at: "2026-06-04T22:07:14.000Z",
    body: {
      success: true,
      data: {
        id: "64b7d8ef000000001f03981",
        publish_id: "publish-task-64b7d8ef000000001f03981",
        status: "submitted"
      }
    }
  });

  expect(capture).toMatchObject({
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    publish_visibility_scope: null,
    publish_visibility_proof_locator: null,
    url: "https://creator.xiaohongshu.com/api/galaxy/v2/creator/note/user/post"
  });
});

it("does not observe creator submit publish result identity from GET responses", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/galaxy/v2/creator/note/user/post",
    method: "GET",
    status: 200,
    captured_at: "2026-06-04T22:07:14.000Z",
    body: {
      success: true,
      data: {
        id: "64b7d8ef000000001f03981"
      }
    }
  });

  expect(capture).toBeNull();
});

it("does not recursively treat nested generic ids as post-submit note ids", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/galaxy/v2/creator/note/user/post",
    method: "POST",
    status: 200,
    captured_at: "2026-06-04T22:07:14.000Z",
    body: {
      success: true,
      data: {
        media: {
          id: "64b7d8ef000000001f03981"
        },
        user: {
          id: "64b7d8ef000000001f03982"
        }
      }
    }
  });

  expect(capture).toBeNull();
});

it("extracts an unbound platform publish record only from creator submit endpoints", () => {
  const capture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/galaxy/v2/creator/note/user/post",
    method: "POST",
    status: 200,
    captured_at: "2026-06-04T22:07:14.000Z",
    body: {
      success: true,
      data: {
        publish_id: "publish-task-64b7d8ef000000001f03981"
      }
    }
  });

  expect(capture).toMatchObject({
    result_kind: "platform_publish_record",
    note_id: null,
    published_url: null,
    platform_record_ref: "publish-task-64b7d8ef000000001f03981",
    publish_visibility_scope: null,
    publish_visibility_proof_locator: null
  });

  const adjacentCapture = extractXhsControlledPublishResultIdentityCapture({
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-04T22:07:14.000Z",
    body: {
      success: true,
      data: {
        publish_id: "publish-task-64b7d8ef000000001f03981"
      }
    }
  });

  expect(adjacentCapture).toBeNull();
});

it("records publish identity capture without advancing closeout state when debugger captures a trusted post-submit note id", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-983-platform-identity",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      scope: {
        platform: "xhs",
        target_domain: "creator.xiaohongshu.com",
        target_page: "creator_publish_tab",
        browser_channel: "Google Chrome stable",
        execution_surface: "real_browser",
        requested_execution_mode: "live_write",
        profile_ref: "profile-a",
        target_tab_id: 32,
        probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
        run_id: "run-xhs-issue-983-platform-identity",
        artifact_identity: "upload-artifact/fr-0032/platform-identity"
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/platform-identity",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/test-record",
        page_preview_locator: "img.img",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T00:00:00.000Z",
        preview_diagnostics: null
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/live-write-attempt/fr-0032/run-xhs-issue-983-platform-identity",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-03T00:00:01.000Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: {}
      },
      risk_signals: [
        {
          kind: "publish_identity_missing"
        }
      ],
      stop_signal: {
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      },
      residual_record: {
        reason: "identity_missing_after_publish"
      },
      created_at: "2026-06-03T00:00:02.000Z",
      updated_at: "2026-06-03T00:00:02.000Z"
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: true,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: [
        {
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity",
          message: "Controlled publish did not produce a verifiable publish result identity."
        }
      ]
    }
  } as const;

  const result = applyXhsControlledPublishResultIdentityCapture(baseResult, {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    creator_result_url: null,
    platform_record_ref: null,
    publish_visibility_scope: "private_or_self_visible",
    publish_visibility_proof_locator: "$.data",
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:03.000Z"
  });

  expect(result.live_write_evaluation).toMatchObject({
    decision: "NO_GO",
    full_live_write_success: false,
    upload_success: true,
    submit_success: true,
    publish_success: false,
    cleanup_success: false,
    blockers: [
      expect.objectContaining({
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
      })
    ]
  });
  expect(result.live_write_evidence).toMatchObject({
    execution_phase: "publish_identity",
    publish_result_identity: null,
    publish_result_identity_capture: expect.objectContaining({
      result_kind: "note_id",
      note_id: "64b7d8ef000000001f03981",
      published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
      publish_visibility_scope: "private_or_self_visible",
      url: "https://creator.xiaohongshu.com/api/creator/publish/result"
    }),
    cleanup_result: expect.objectContaining({
      cleanup_action: "no_safe_cleanup_action",
      cleanup_outcome: "cleanup_blocked"
    }),
    risk_signals: [
      expect.objectContaining({
        kind: "publish_identity_missing"
      })
    ],
    stop_signal: expect.objectContaining({
      blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
    }),
    residual_record: expect.objectContaining({
      reason: "identity_missing_after_publish"
    })
  });
  expect(result.published).toBe(false);
});

it("classifies missing background publish identity capture with precise diagnostics", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-1073-capture-status",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      scope: {
        platform: "xhs",
        target_domain: "creator.xiaohongshu.com",
        target_page: "creator_publish_tab",
        browser_channel: "Google Chrome stable",
        execution_surface: "real_browser",
        requested_execution_mode: "live_write",
        profile_ref: "profile-a",
        target_tab_id: 32,
        probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
        run_id: "run-xhs-issue-1073-capture-status",
        artifact_identity: "upload-artifact/fr-0032/capture-status"
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/capture-status",
        accepted_by_platform: true
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/live-write-attempt/fr-0032/run-xhs-issue-1073-capture-status",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-03T00:00:01.000Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked"
      },
      risk_signals: [
        {
          kind: "publish_identity_missing"
        }
      ],
      stop_signal: {
        stopped_step: "publish_identity",
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      },
      residual_record: {
        reason: "identity_missing_after_publish"
      },
      created_at: "2026-06-03T00:00:02.000Z",
      updated_at: "2026-06-03T00:00:02.000Z"
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: true,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: [
        {
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity",
          message: "background identity capture pending"
        }
      ]
    }
  } as const;

  const result = applyXhsControlledPublishResultIdentityCaptureStatus(baseResult, {
    attempted: true,
    status: "timeout",
    reason: "response_identity_missing",
    blocker_code: "PUBLISH_IDENTITY_CAPTURE_RESPONSE_IDENTITY_MISSING",
    recorded_at: "2026-06-03T00:00:04.000Z",
    observed_requests: [
      {
        host: "creator.xiaohongshu.com",
        path: "/api/creator/publish/result",
        method: "POST",
        status: 200,
        reason: "response_identity_missing"
      }
    ]
  });

  expect(result.live_write_evaluation).toMatchObject({
    decision: "NO_GO",
    blockers: [
      expect.objectContaining({
        blocker_code: "PUBLISH_IDENTITY_CAPTURE_RESPONSE_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      })
    ]
  });
  expect(result.live_write_evidence).toMatchObject({
    publish_result_identity: null,
    publish_result_identity_capture_status: expect.objectContaining({
      blocker_code: "PUBLISH_IDENTITY_CAPTURE_RESPONSE_IDENTITY_MISSING",
      observed_requests: [
        expect.objectContaining({
          path: "/api/creator/publish/result",
          reason: "response_identity_missing"
        })
      ]
    }),
    stop_classification: expect.objectContaining({
      publish_identity_capture_blocker_code: "PUBLISH_IDENTITY_CAPTURE_RESPONSE_IDENTITY_MISSING"
    }),
    stop_signal: expect.objectContaining({
      blocker_code: "PUBLISH_IDENTITY_CAPTURE_RESPONSE_IDENTITY_MISSING",
      diagnostics: expect.objectContaining({
        publish_result_identity_capture_status: expect.objectContaining({
          reason: "response_identity_missing"
        })
      })
    })
  });
  expect(result.published).toBe(false);
});

it("promotes trusted publish result identity capture into formal closeout when pending identity blocker prerequisites are satisfied", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-1009-platform-identity",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      scope: {
        platform: "xhs",
        target_domain: "creator.xiaohongshu.com",
        target_page: "creator_publish_tab",
        browser_channel: "Google Chrome stable",
        execution_surface: "real_browser",
        requested_execution_mode: "live_write",
        profile_ref: "profile-a",
        target_tab_id: 32,
        run_id: "run-xhs-issue-1009-platform-identity",
        artifact_identity: "upload-artifact/fr-0032/platform-identity"
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/platform-identity",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/test-record",
        page_preview_locator: "img.img",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T00:00:00.000Z",
        preview_diagnostics: null
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/live-write-attempt/fr-0032/run-xhs-issue-1009-platform-identity",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-03T00:00:01.000Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: {}
      },
      risk_signals: [
        {
          kind: "publish_identity_missing"
        }
      ],
      stop_signal: {
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      },
      residual_record: {
        reason: "identity_missing_after_publish"
      },
      created_at: "2026-06-03T00:00:02.000Z",
      updated_at: "2026-06-03T00:00:02.000Z"
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: true,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: [
        {
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity",
          message: "Controlled publish did not produce a verifiable publish result identity."
        }
      ]
    }
  } as const;

  const result = finalizeXhsControlledPublishResultIdentityCapture(baseResult, {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    creator_result_url: null,
    platform_record_ref: null,
    publish_visibility_scope: "private_or_self_visible",
    publish_visibility_proof_locator: "$.data",
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:03.000Z"
  });

  expect(result).toMatchObject({
    uploaded: true,
    submitted: true,
    published: true,
    cleanup_attempted: true,
    live_write_evaluation: {
      decision: "GO",
      full_live_write_success: true,
      upload_success: true,
      submit_success: true,
      publish_success: true,
      cleanup_success: true,
      later_write_actions_blocked: false,
      cleanup_required: false,
      blockers: []
    }
  });
  expect(result.live_write_evidence).toMatchObject({
    execution_phase: "closed",
    publish_result_identity_capture: expect.objectContaining({
      note_id: "64b7d8ef000000001f03981",
      publish_visibility_proof_locator: "$.data"
    }),
    publish_result_identity: expect.objectContaining({
      schema_version: "fr-0032.publish_result_identity.v1",
      publish_result_id:
        "publish-result/fr-0032/live-write-attempt/fr-0032/run-xhs-issue-1009-platform-identity",
      source_upload_artifact_id: "upload-artifact/fr-0032/platform-identity",
      submit_action_ref:
        "submit/fr-0032/live-write-attempt/fr-0032/run-xhs-issue-1009-platform-identity",
      result_kind: "note_id",
      note_id: "64b7d8ef000000001f03981",
      published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
      publish_visibility_scope: "private_or_self_visible",
      success_signal: expect.objectContaining({
        signal_source: "platform_response",
        signal_locator: "https://creator.xiaohongshu.com/api/creator/publish/result",
        platform_message: "trusted platform publish result identity captured"
      }),
      verification_state: "verified"
    }),
    cleanup_result: expect.objectContaining({
      cleanup_action: "hide_published_result",
      cleanup_outcome: "hidden",
      residual_record: null
    }),
    risk_signals: [],
    stop_signal: null,
    residual_record: null,
    stop_classification: null
  });
});

it("finalizes background identity capture from a trusted private platform publish record", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-1038-platform-record",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      scope: {
        platform: "xhs",
        target_domain: "creator.xiaohongshu.com",
        target_page: "creator_publish_tab",
        browser_channel: "Google Chrome stable",
        execution_surface: "real_browser",
        requested_execution_mode: "live_write",
        profile_ref: "profile-a",
        target_tab_id: 32,
        probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
        run_id: "run-xhs-issue-1038-platform-record",
        artifact_identity: "upload-artifact/fr-0032/platform-record"
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/platform-record",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/test-record",
        page_preview_locator: "img.img",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T00:00:00.000Z",
        preview_diagnostics: null
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/live-write-attempt/fr-0032/run-xhs-issue-1038-platform-record",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-03T00:00:01.000Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: {}
      },
      risk_signals: [{ kind: "publish_identity_missing" }],
      stop_signal: {
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      },
      residual_record: {
        reason: "identity_missing_after_publish"
      },
      created_at: "2026-06-03T00:00:02.000Z",
      updated_at: "2026-06-03T00:00:02.000Z"
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: true,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: [
        {
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity",
          message: "background identity capture pending"
        }
      ]
    }
  } as const;

  const result = finalizeXhsControlledPublishResultIdentityCapture(baseResult, {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "platform_publish_record",
    note_id: null,
    published_url: null,
    creator_result_url: null,
    platform_record_ref: "publish-task-64b7d8ef000000001f03981",
    publish_visibility_scope: "private_or_self_visible",
    publish_visibility_proof_locator: "$.data",
    url: "https://creator.xiaohongshu.com/api/galaxy/creator/note/user/post",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:03.000Z"
  });

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
    execution_phase: "closed",
    publish_result_identity: expect.objectContaining({
      result_kind: "platform_publish_record",
      note_id: null,
      published_url: null,
      platform_record_ref: "publish-task-64b7d8ef000000001f03981",
      publish_visibility_scope: "private_or_self_visible",
      verification_state: "verified"
    }),
    cleanup_result: expect.objectContaining({
      cleanup_action: "hide_published_result",
      cleanup_outcome: "hidden",
      residual_record: null
    }),
    risk_signals: [],
    stop_signal: null,
    residual_record: null
  });
});

it("finalizes trusted background identity when the same controlled flow already proved private visibility", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-1071-unbound-identity",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      stop_classification: {
        publish_visibility_scope: "private_or_self_visible"
      },
      scope: {
        profile_ref: "profile-a",
        target_tab_id: 32,
        run_id: "run-xhs-issue-1071-unbound-identity"
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/unbound-identity",
        accepted_by_platform: true
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/unbound-identity",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-04T22:07:13.802Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        proof_locator: "div.custom-option",
        residual_record: {
          visibility_scope: "private_or_self_visible"
        }
      },
      risk_signals: [{ kind: "publish_identity_missing" }],
      stop_signal: {
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      },
      residual_record: {
        reason: "identity_missing_after_publish",
        visibility_scope: "private_or_self_visible"
      }
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      blockers: [
        {
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity"
        }
      ]
    }
  } as const;

  const result = finalizeXhsControlledPublishResultIdentityCapture(baseResult, {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    creator_result_url: null,
    platform_record_ref: null,
    publish_visibility_scope: null,
    publish_visibility_proof_locator: null,
    url: "https://creator.xiaohongshu.com/api/galaxy/v2/creator/note/user/post",
    method: "POST",
    status: 200,
    captured_at: "2026-06-04T22:07:14.000Z"
  });

  expect(result.live_write_evaluation).toMatchObject({
    decision: "GO",
    publish_success: true,
    cleanup_success: true,
    blockers: []
  });
  expect(result.live_write_evidence).toMatchObject({
    execution_phase: "closed",
    publish_result_identity_capture: expect.objectContaining({
      note_id: "64b7d8ef000000001f03981",
      publish_visibility_scope: null
    }),
    publish_result_identity: expect.objectContaining({
      result_kind: "note_id",
      note_id: "64b7d8ef000000001f03981",
      publish_visibility_scope: "private_or_self_visible",
      verification_state: "verified"
    }),
    cleanup_result: expect.objectContaining({
      cleanup_action: "hide_published_result",
      cleanup_outcome: "hidden",
      proof_locator: "div.custom-option",
      residual_record: null
    }),
    risk_signals: [],
    stop_signal: null,
    residual_record: null
  });
});

it("does not promote publish identity evidence without private visibility proof", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-983-platform-identity-no-visibility",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      scope: {
        profile_ref: "profile-a",
        target_tab_id: 32,
        run_id: "run-xhs-issue-983-platform-identity-no-visibility"
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/platform-identity-no-visibility",
        accepted_by_platform: true
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/no-visibility",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-03T00:00:01.000Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: {}
      },
      risk_signals: [{ kind: "publish_identity_missing" }],
      stop_signal: {
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      },
      residual_record: {
        reason: "identity_missing_after_publish"
      }
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      blockers: [
        {
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity"
        }
      ]
    }
  } as const;

  const result = finalizeXhsControlledPublishResultIdentityCapture(baseResult, {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    creator_result_url: null,
    platform_record_ref: null,
    publish_visibility_scope: null,
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:03.000Z"
  });

  expect(result.live_write_evaluation).toMatchObject({
    decision: "NO_GO",
    blockers: [
      expect.objectContaining({
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
      })
    ]
  });
  expect(result.live_write_evidence.publish_result_identity).toBeNull();
  expect(result.live_write_evidence.cleanup_result).toMatchObject({
    cleanup_action: "no_safe_cleanup_action",
    cleanup_outcome: "cleanup_blocked"
  });
});

it("does not finalize publish identity capture when the active blocker is not publish identity missing", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-1009-non-target-blocker",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      scope: {
        profile_ref: "profile-a",
        target_tab_id: 32,
        run_id: "run-xhs-issue-1009-non-target-blocker"
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/non-target-blocker",
        accepted_by_platform: true
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/non-target-blocker",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-03T00:00:01.000Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: {}
      },
      risk_signals: [{ kind: "submit_failure" }],
      stop_signal: {
        blocker_code: "SUBMIT_CONTINUATION_TIMEOUT",
        blocker_layer: "runtime-channel"
      },
      residual_record: {
        reason: "submit_timeout"
      }
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      blockers: [
        {
          blocker_code: "SUBMIT_CONTINUATION_TIMEOUT",
          blocker_layer: "runtime-channel"
        }
      ]
    }
  } as const;

  const result = finalizeXhsControlledPublishResultIdentityCapture(baseResult, {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    creator_result_url: null,
    platform_record_ref: null,
    publish_visibility_scope: "private_or_self_visible",
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:03.000Z"
  });

  expect(result.live_write_evaluation).toMatchObject({
    decision: "NO_GO",
    blockers: [
      expect.objectContaining({
        blocker_code: "SUBMIT_CONTINUATION_TIMEOUT"
      })
    ]
  });
  expect(result.live_write_evidence).toMatchObject({
    publish_result_identity: null,
    cleanup_result: expect.objectContaining({
      cleanup_action: "no_safe_cleanup_action",
      cleanup_outcome: "cleanup_blocked"
    }),
    stop_signal: expect.objectContaining({
      blocker_code: "SUBMIT_CONTINUATION_TIMEOUT"
    })
  });
  expect(result.live_write_evidence.publish_result_identity_capture).toBeUndefined();
  expect(result.published).toBe(false);
});

it("does not finalize publish identity capture when formal identity binding fields are missing", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-1009-missing-binding",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      scope: {
        target_tab_id: 32
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/missing-binding",
        accepted_by_platform: true
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/missing-binding",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-03T00:00:01.000Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: {}
      },
      risk_signals: [{ kind: "publish_identity_missing" }],
      stop_signal: {
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      },
      residual_record: {
        reason: "identity_missing_after_publish"
      }
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      blockers: [
        {
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity"
        }
      ]
    }
  } as const;

  const result = finalizeXhsControlledPublishResultIdentityCapture(baseResult, {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    creator_result_url: null,
    platform_record_ref: null,
    publish_visibility_scope: "private_or_self_visible",
    publish_visibility_proof_locator: "$.data",
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:03.000Z"
  });

  expect(result.live_write_evaluation).toMatchObject({
    decision: "NO_GO",
    blockers: [
      expect.objectContaining({
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
      })
    ]
  });
  expect(result.live_write_evidence).toMatchObject({
    publish_result_identity: null,
    publish_result_identity_capture: expect.objectContaining({
      note_id: "64b7d8ef000000001f03981",
      publish_visibility_proof_locator: "$.data"
    })
  });
  expect(result.published).toBe(false);
});

it("does not finalize publish identity capture captured before the current submit evidence", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-1009-pre-submit-capture",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      scope: {
        profile_ref: "profile-a",
        target_tab_id: 32,
        run_id: "run-xhs-issue-1009-pre-submit-capture"
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/pre-submit-capture",
        accepted_by_platform: true
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/pre-submit-capture",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-03T00:00:02.000Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: {}
      },
      risk_signals: [{ kind: "publish_identity_missing" }],
      stop_signal: {
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      },
      residual_record: {
        reason: "identity_missing_after_publish"
      }
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      blockers: [
        {
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity"
        }
      ]
    }
  } as const;

  const result = finalizeXhsControlledPublishResultIdentityCapture(baseResult, {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    creator_result_url: null,
    platform_record_ref: null,
    publish_visibility_scope: "private_or_self_visible",
    publish_visibility_proof_locator: "$.data",
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:01.000Z"
  });

  expect(result.live_write_evaluation).toMatchObject({
    decision: "NO_GO",
    blockers: [
      expect.objectContaining({
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
      })
    ]
  });
  expect(result.live_write_evidence).toMatchObject({
    publish_result_identity: null,
    publish_result_identity_capture: expect.objectContaining({
      note_id: "64b7d8ef000000001f03981"
    })
  });
  expect(result.published).toBe(false);
});

it("does not finalize publish identity capture when other blockers or risk signals remain", () => {
  const baseResult = {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    uploaded: true,
    submitted: true,
    published: false,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"],
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: "live-write-attempt/fr-0032/run-xhs-issue-1009-mixed-blockers",
      canonical_issue_ref: "#835",
      execution_phase: "publish_identity",
      scope: {
        profile_ref: "profile-a",
        target_tab_id: 32,
        run_id: "run-xhs-issue-1009-mixed-blockers"
      },
      upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/mixed-blockers",
        accepted_by_platform: true
      },
      submit_evidence: {
        submit_action_ref: "submit/fr-0032/mixed-blockers",
        submit_locator: "div.publish-video",
        submitted_at: "2026-06-03T00:00:01.000Z",
        submit_result_state: "accepted",
        platform_message: null
      },
      publish_result_identity: null,
      cleanup_result: {
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: {}
      },
      risk_signals: [
        { kind: "publish_identity_missing" },
        { kind: "cleanup_failure", severity: "blocking" }
      ],
      stop_signal: {
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        blocker_layer: "published_identity"
      },
      residual_record: {
        reason: "identity_missing_after_publish"
      }
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      blockers: [
        {
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity"
        },
        {
          blocker_code: "CLEANUP_PROOF_MISSING",
          blocker_layer: "cleanup"
        }
      ]
    }
  } as const;

  const result = finalizeXhsControlledPublishResultIdentityCapture(baseResult, {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    result_kind: "note_id",
    note_id: "64b7d8ef000000001f03981",
    published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
    creator_result_url: null,
    platform_record_ref: null,
    publish_visibility_scope: "private_or_self_visible",
    url: "https://creator.xiaohongshu.com/api/creator/publish/result",
    method: "POST",
    status: 200,
    captured_at: "2026-06-03T00:00:03.000Z"
  });

  expect(result.live_write_evaluation).toMatchObject({
    decision: "NO_GO",
    blockers: [
      expect.objectContaining({
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
      }),
      expect.objectContaining({
        blocker_code: "CLEANUP_PROOF_MISSING"
      })
    ]
  });
  expect(result.live_write_evidence).toMatchObject({
    publish_result_identity: null,
    publish_result_identity_capture: expect.objectContaining({
      note_id: "64b7d8ef000000001f03981"
    }),
    risk_signals: [
      expect.objectContaining({ kind: "publish_identity_missing" }),
      expect.objectContaining({ kind: "cleanup_failure" })
    ],
    cleanup_result: expect.objectContaining({
      cleanup_action: "no_safe_cleanup_action",
      cleanup_outcome: "cleanup_blocked"
    })
  });
  expect(result.published).toBe(false);
});

it("preserves accepted upload evidence when submit continuation times out", () => {
  const result = buildXhsControlledLiveWriteUploadBlockedResult(
    {
      live_write_attempt_id: "fr0032-attempt-continuation-timeout",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-963-continuation-timeout",
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
      upload_artifact_id: "upload-artifact/fr-0032/continuation-timeout",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/timeout",
      page_preview_locator: "img.preview-image",
      accepted_by_platform: true,
      visible_in_editor: true,
      captured_at: "2026-06-02T05:45:00.000Z"
    }
  );

  const timedOut = applyXhsControlledLiveWriteContinuationTimeout(result, {
    continuationKey:
      "nm-session-001:run-xhs-issue-963-continuation-timeout:32:fr0032-attempt-continuation-timeout:upload-artifact/fr-0032/continuation-timeout:xhs.creator_publish.controlled_live_write",
    reason: "CONTENT_SCRIPT_FORWARD_TIMEOUT"
  });

  expect(timedOut.live_write_evaluation).toMatchObject({
    decision: "NO_GO",
    upload_success: true,
    submit_success: false,
    cleanup_required: true,
    blockers: [
      expect.objectContaining({
        blocker_code: "SUBMIT_CONTINUATION_TIMEOUT",
        blocker_layer: "runtime-channel"
      })
    ]
  });
  expect(timedOut.live_write_evidence).toMatchObject({
    execution_phase: "submit",
    upload_artifact_identity: expect.objectContaining({
      upload_artifact_id: "upload-artifact/fr-0032/continuation-timeout",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      accepted_by_platform: true,
      visible_in_editor: true
    }),
    stop_signal: expect.objectContaining({
      stopped_step: "submit",
      blocker_code: "SUBMIT_CONTINUATION_TIMEOUT",
      cleanup_required: true,
      required_recovery_action:
        "rerun controlled submit/publish with the accepted_upload_artifact_identity from this evidence"
    }),
    stop_classification: expect.objectContaining({
      stop_reason: "submit_continuation_timeout",
      background_upload_capture_continuation: expect.objectContaining({
        attempted: true,
        failure_reason: "CONTENT_SCRIPT_FORWARD_TIMEOUT"
      })
    })
  });
  expect(timedOut).toMatchObject({
    uploaded: true,
    submitted: false,
    published: false,
    cleanup_attempted: false
  });
  expect(timedOut.live_write_evaluation).toMatchObject({
    publish_success: false,
    cleanup_success: false,
    later_write_actions_blocked: true
  });
  expect(timedOut.live_write_evidence.stop_signal).toMatchObject({
    later_write_actions_blocked: true,
    cleanup_required: true,
    required_recovery_action:
      "rerun controlled submit/publish with the accepted_upload_artifact_identity from this evidence"
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
      upload_artifact_id: "upload-artifact/fr-0032/object-no-preview",
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

it("blocks accepted upload resume when artifact source media does not match current request", async () => {
  const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
    live_write_attempt_id: "fr0032-attempt-resume-mismatched-upload",
    source_media_ref: "media-ref/fr-0032/fixture-image-a",
    source_media_digest:
      "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
    source_media_kind: "image",
    publish_visibility_scope: "private_or_self_visible",
    cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
    run_id: "run-xhs-issue-1006-resume-mismatched-upload",
    profile_ref: "profile-a",
    target_tab_id: 32,
    page_url: "https://creator.xiaohongshu.com/publish/publish",
    latest_head_sha: "head-test",
    accepted_upload_artifact_identity: {
      upload_artifact_id: "upload-artifact/fr-0032/run-xhs-issue-1006-resume/3ed47d9dd37e",
      source_media_ref: "media-ref/fr-0032/fixture-image-b",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      platform_staging_ref:
        "object_upload:ros-upload-d4.xhscdn.com/spectrum/ResumeFixtureRefOnlyNoRealUrl",
      page_preview_locator: "div.publish-page-content-media",
      accepted_by_platform: true,
      visible_in_editor: true,
      captured_at: "2026-06-03T00:00:00.000Z",
      preview_diagnostics: null
    }
  });

  expect(result.live_write_evaluation).toMatchObject({
    decision: "NO_GO",
    upload_success: false,
    submit_success: false,
    publish_success: false,
    later_write_actions_blocked: true,
    blockers: [
      expect.objectContaining({
        blocker_code: "ACCEPTED_UPLOAD_ARTIFACT_RESUME_INVALID",
        blocker_layer: "upload"
      })
    ]
  });
  expect(result.live_write_evidence).toMatchObject({
    execution_phase: "upload",
    stop_classification: expect.objectContaining({
      stop_reason: "accepted_upload_artifact_source_ref_mismatch"
    }),
    upload_artifact_identity: expect.objectContaining({
      accepted_by_platform: true,
      visible_in_editor: true
    }),
    submit_evidence: null,
    publish_result_identity: null
  });
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
    visibilityTrigger.textContent = "仅自己可见";
    settingRow.textContent = "可见权限 仅自己可见";
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
    visibilityTrigger.textContent = "仅自己可见";
    settingRow.textContent = "可见权限 仅自己可见";
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
    selectorContainer.textContent = "仅自己可见";
    publicValueText.textContent = "仅自己可见";
    settingRow.textContent = "可见权限 仅自己可见";
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
    activeSelector.textContent = "仅我可见";
    activePublicValue.textContent = "仅我可见";
    activeRow.textContent = "可见权限 仅我可见";
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

it("opens a plain public visibility value when semantic visibility classes are absent", async () => {
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
  const settingRow = new TestElement();
  settingRow.className = "publish-setting-row data-v-plain";
  settingRow.textContent = "公开可见";
  const decoyPublicText = new TestElement();
  decoyPublicText.tagName = "SPAN";
  decoyPublicText.className = "data-v-tooltip";
  decoyPublicText.classList = ["data-v-tooltip"];
  decoyPublicText.textContent = "公开可见";
  decoyPublicText.click = () => {
    decoyPublicText.clicked = true;
    clickOrder.push("decoy-public-text");
  };
  const publicValue = new TestElement();
  publicValue.tagName = "SPAN";
  publicValue.className = "data-v-plain";
  publicValue.classList = ["data-v-plain"];
  publicValue.textContent = "公开可见";
  let privateOptionVisible = false;
  const clickOrder: string[] = [];
  publicValue.click = () => {
    publicValue.clicked = true;
    privateOptionVisible = true;
    clickOrder.push("public-value");
  };
  const privateOption = new TestElement();
  privateOption.tagName = "LI";
  privateOption.className = "data-v-option";
  privateOption.classList = ["data-v-option"];
  privateOption.textContent = "仅自己可见";
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
  publicValue.parentElement = settingRow;
  settingRow.children = [publicValue];
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
        if (selector.includes("dropdown") || selector.includes("item") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("div") || selector.includes("span") || /(^|,)p($|,)/u.test(selector)) {
          return [decoyPublicText, publicValue];
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
      live_write_attempt_id: "fr0032-attempt-plain-public-visibility-value",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-plain-public-visibility-value",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/plain-public-visibility-value",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/plain-public-visibility-value",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-01T00:00:00.000Z"
      }
    });

    expect(decoyPublicText.clicked).toBe(false);
    expect(publicValue.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["public-value", "private-option", "submit"]);
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

it("opens readonly input public visibility value inside a visibility setting row", async () => {
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
    value = "";
    clicked = false;
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    getAttribute = (name: string) => {
      if (name === "class") {
        return this.className;
      }
      if (name === "value") {
        return this.value || null;
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
  settingRow.className = "data-v-04842b33";
  const visibilityLabel = new TestElement();
  visibilityLabel.className = "data-v-04842b33";
  visibilityLabel.textContent = "可见范围";
  const publicValueInput = new TestElement();
  publicValueInput.tagName = "INPUT";
  publicValueInput.className = "data-v-04842b33";
  publicValueInput.classList = ["data-v-04842b33"];
  publicValueInput.value = "公开可见";
  let privateOptionVisible = false;
  const clickOrder: string[] = [];
  publicValueInput.click = () => {
    publicValueInput.clicked = true;
    privateOptionVisible = true;
    clickOrder.push("public-input");
  };
  const privateOption = new TestElement();
  privateOption.tagName = "DIV";
  privateOption.className = "data-v-popper-item";
  privateOption.classList = ["data-v-popper-item"];
  privateOption.textContent = "仅自己可见";
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
  visibilityLabel.parentElement = settingRow;
  publicValueInput.parentElement = settingRow;
  settingRow.children = [visibilityLabel, publicValueInput];
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
        if (selector.includes("dropdown") || selector.includes("popper") || selector.includes("item")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        if (selector.includes("label") || selector.includes("visibility") || selector.includes("permission")) {
          return [visibilityLabel];
        }
        if (selector.includes("input")) {
          return [publicValueInput];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-readonly-input-public-visibility-value",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-readonly-input-public-visibility-value",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/readonly-input-public-visibility-value",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/readonly-input-public-visibility-value",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-01T00:00:00.000Z"
      }
    });

    expect(publicValueInput.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["public-input", "private-option", "submit"]);
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

it("scrolls before giving up when visibility controls mount below the initial editor viewport", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  const originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList = [] as string[];
    textContent = "";
    clicked = false;
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    scrollTop = 0;
    getAttribute = (name: string) => (name === "class" ? this.className : null);
    getBoundingClientRect = () => ({ width: 128, height: 32 });
    querySelectorAll = () => this.children;
    scrollBy = () => {
      this.scrollTop += 480;
    };
    click = () => {
      this.clicked = true;
    };
  }
  const outerPublishRoot = new TestElement();
  outerPublishRoot.className = "publish-page";
  const editorContainer = new TestElement();
  editorContainer.className = "publish-page-content";
  const settingRow = new TestElement();
  settingRow.className = "publish-setting-row";
  const visibilityLabel = new TestElement();
  visibilityLabel.className = "form-label";
  visibilityLabel.textContent = "可见范围";
  const visibilityTrigger = new TestElement();
  visibilityTrigger.className = "reds-select-selector";
  visibilityTrigger.textContent = "公开可见";
  let privateOptionVisible = false;
  let scrollCount = 0;
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
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };
  const documentElement = new TestElement();
  documentElement.tagName = "HTML";
  const body = new TestElement();
  body.tagName = "BODY";
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image"
  };
  visibilityLabel.parentElement = settingRow;
  visibilityTrigger.parentElement = settingRow;
  settingRow.children = [visibilityLabel, visibilityTrigger];
  editorContainer.parentElement = outerPublishRoot;
  editorContainer.children = [settingRow];
  outerPublishRoot.children = [editorContainer];
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
    value: {
      innerHeight: 900,
      location: locationState
    }
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: locationState
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body,
      documentElement,
      scrollingElement: documentElement,
      querySelector: (selector: string) => {
        if (selector.includes("publish-page") || selector.includes("publish-content")) {
          return editorContainer;
        }
        return null;
      },
      querySelectorAll: (selector: string) => {
        scrollCount = editorContainer.scrollTop;
        if (selector.includes("publish") || selector.includes("content") || selector.includes("container")) {
          return [editorContainer];
        }
        if (editorContainer.scrollTop === 0) {
          if (selector.includes("button")) {
            return [submit];
          }
          return [];
        }
        if (selector.includes("dropdown") || selector.includes("item") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("label") || selector.includes("visibility") || selector.includes("permission")) {
          return [visibilityLabel];
        }
        if (selector.includes("select") || selector.includes("value") || selector.includes("current")) {
          return [visibilityTrigger];
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
      live_write_attempt_id: "fr0032-attempt-lazy-visibility-after-scroll",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-lazy-visibility-after-scroll",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/lazy-visibility-after-scroll",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/lazy-visibility-after-scroll",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-01T00:00:00.000Z"
      }
    });

    expect(editorContainer.scrollTop).toBeGreaterThan(0);
    expect(visibilityTrigger.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["trigger", "private-option", "submit"]);
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
    if (originalLocationDescriptor) {
      Object.defineProperty(globalThis, "location", originalLocationDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "location");
    }
  }
});

it("scrolls publish editor containers when window scrolling does not mount visibility controls", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  const originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList = [] as string[];
    textContent = "";
    clicked = false;
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    scrollTop = 0;
    getAttribute = (name: string) => (name === "class" ? this.className : null);
    getBoundingClientRect = () => ({ width: 128, height: 32 });
    querySelectorAll = () => this.children;
    scrollBy = () => {
      this.scrollTop += 480;
    };
    click = () => {
      this.clicked = true;
    };
  }
  const outerPublishRoot = new TestElement();
  outerPublishRoot.className = "publish-page";
  const editorContainer = new TestElement();
  editorContainer.className = "publish-page-content";
  const settingRow = new TestElement();
  settingRow.className = "publish-setting-row";
  const visibilityLabel = new TestElement();
  visibilityLabel.className = "form-label";
  visibilityLabel.textContent = "可见范围";
  const visibilityTrigger = new TestElement();
  visibilityTrigger.className = "reds-select-selector";
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
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };
  const documentElement = new TestElement();
  documentElement.tagName = "HTML";
  const body = new TestElement();
  body.tagName = "BODY";
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image"
  };
  visibilityLabel.parentElement = settingRow;
  visibilityTrigger.parentElement = settingRow;
  settingRow.children = [visibilityLabel, visibilityTrigger];
  editorContainer.parentElement = outerPublishRoot;
  editorContainer.children = [settingRow];
  outerPublishRoot.children = [editorContainer];
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
    value: {
      innerHeight: 900,
      location: locationState
    }
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: locationState
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body,
      documentElement,
      scrollingElement: documentElement,
      querySelector: (selector: string) => {
        if (selector.includes("publish-page") || selector.includes("publish-content")) {
          return editorContainer;
        }
        return null;
      },
      querySelectorAll: (selector: string) => {
        const containerScrolled = editorContainer.scrollTop > 0;
        if (selector.includes("publish") || selector.includes("editor") || selector.includes("content") || selector.includes("container")) {
          return [outerPublishRoot, editorContainer];
        }
        if (!containerScrolled) {
          if (selector.includes("button")) {
            return [submit];
          }
          return [];
        }
        if (selector.includes("dropdown") || selector.includes("item") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("label") || selector.includes("visibility") || selector.includes("permission")) {
          return [visibilityLabel];
        }
        if (selector.includes("select") || selector.includes("value") || selector.includes("current")) {
          return [visibilityTrigger];
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
      live_write_attempt_id: "fr0032-attempt-container-lazy-visibility-after-scroll",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-container-lazy-visibility-after-scroll",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/container-lazy-visibility-after-scroll",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/container-lazy-visibility-after-scroll",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-01T00:00:00.000Z"
      }
    });

    expect(editorContainer.scrollTop).toBeGreaterThan(0);
    expect(outerPublishRoot.scrollTop).toBe(0);
    expect(visibilityTrigger.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["trigger", "private-option", "submit"]);
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
    if (originalLocationDescriptor) {
      Object.defineProperty(globalThis, "location", originalLocationDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "location");
    }
  }
});

it("falls back to document scrolling when the publish editor root does not move", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  const originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList = [] as string[];
    textContent = "";
    clicked = false;
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    scrollTop = 0;
    getAttribute = (name: string) => (name === "class" ? this.className : null);
    getBoundingClientRect = () => ({ width: 128, height: 32 });
    querySelectorAll = () => this.children;
    scrollBy = ({ top }: { top: number }) => {
      this.scrollTop += top;
    };
    click = () => {
      this.clicked = true;
    };
  }
  const outerPublishRoot = new TestElement();
  outerPublishRoot.className = "publish-page";
  const editorContainer = new TestElement();
  editorContainer.className = "publish-page-content";
  editorContainer.scrollBy = () => {
    editorContainer.scrollTop = 0;
  };
  const settingRow = new TestElement();
  settingRow.className = "publish-setting-row";
  const visibilityLabel = new TestElement();
  visibilityLabel.className = "form-label";
  visibilityLabel.textContent = "可见范围";
  const visibilityTrigger = new TestElement();
  visibilityTrigger.className = "reds-select-selector";
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
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };
  const documentElement = new TestElement();
  documentElement.tagName = "HTML";
  const body = new TestElement();
  body.tagName = "BODY";
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image"
  };
  visibilityLabel.parentElement = settingRow;
  visibilityTrigger.parentElement = settingRow;
  settingRow.children = [visibilityLabel, visibilityTrigger];
  editorContainer.parentElement = outerPublishRoot;
  editorContainer.children = [settingRow];
  outerPublishRoot.children = [editorContainer];
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
    value: {
      innerHeight: 900,
      location: locationState,
      scrollY: 0,
      scrollBy({ top }: { top: number }) {
        this.scrollY += top;
      }
    }
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: locationState
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body,
      documentElement,
      scrollingElement: documentElement,
      querySelector: (selector: string) => {
        if (selector.includes("publish-page") || selector.includes("publish-content")) {
          return editorContainer;
        }
        return null;
      },
      querySelectorAll: (selector: string) => {
        const documentScrolled = documentElement.scrollTop > 0;
        if (selector.includes("publish") || selector.includes("content") || selector.includes("container")) {
          return [outerPublishRoot, editorContainer];
        }
        if (!documentScrolled) {
          if (selector.includes("button")) {
            return [submit];
          }
          return [];
        }
        if (selector.includes("dropdown") || selector.includes("item") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("label") || selector.includes("visibility") || selector.includes("permission")) {
          return [visibilityLabel];
        }
        if (selector.includes("select") || selector.includes("value") || selector.includes("current")) {
          return [visibilityTrigger];
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
      live_write_attempt_id: "fr0032-attempt-document-scroll-visibility-after-static-root",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-document-scroll-visibility",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/document-scroll-visibility",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/document-scroll-visibility",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-01T00:00:00.000Z"
      }
    });

    expect(editorContainer.scrollTop).toBe(0);
    expect(documentElement.scrollTop).toBeGreaterThan(0);
    expect(visibilityTrigger.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["trigger", "private-option", "submit"]);
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
    if (originalLocationDescriptor) {
      Object.defineProperty(globalThis, "location", originalLocationDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "location");
    }
  }
});

it("finds visibility triggers from deep explicit setting rows", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
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
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
    click = () => {
      this.clicked = true;
    };
  }
  const settingRow = new TestElement();
  settingRow.className = "publish-setting-row";
  const formItem = new TestElement();
  formItem.className = "form-item";
  const fieldContent = new TestElement();
  fieldContent.className = "field-content";
  const labelColumn = new TestElement();
  labelColumn.className = "label-column";
  const labelWrap = new TestElement();
  labelWrap.className = "label-wrap";
  const visibilityLabel = new TestElement();
  visibilityLabel.className = "form-label";
  visibilityLabel.textContent = "可见性";
  const valueColumn = new TestElement();
  valueColumn.className = "value-column";
  const visibilityTrigger = new TestElement();
  visibilityTrigger.className = "plain-public-value";
  visibilityTrigger.textContent = "公开";
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
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };
  visibilityLabel.parentElement = labelWrap;
  labelWrap.parentElement = labelColumn;
  labelColumn.parentElement = fieldContent;
  fieldContent.parentElement = formItem;
  formItem.parentElement = settingRow;
  visibilityTrigger.parentElement = valueColumn;
  valueColumn.parentElement = settingRow;
  labelWrap.children = [visibilityLabel];
  labelColumn.children = [labelWrap];
  fieldContent.children = [labelColumn];
  formItem.children = [fieldContent];
  valueColumn.children = [visibilityTrigger];
  settingRow.children = [formItem, valueColumn];
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
        if (selector.includes("dropdown") || selector.includes("item") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("label") || selector.includes("visibility") || selector.includes("permission")) {
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
      live_write_attempt_id: "fr0032-attempt-deep-visibility-setting-row",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-deep-visibility-setting-row",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/deep-visibility-setting-row",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/deep-visibility-setting-row",
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
  }
});

it("opens publish settings disclosures before resolving private visibility controls", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
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
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
    click = () => {
      this.clicked = true;
    };
  }
  const clickOrder: string[] = [];
  let settingsOpen = false;
  let privateOptionVisible = false;
  const settingsDisclosure = new TestElement();
  settingsDisclosure.tagName = "BUTTON";
  settingsDisclosure.className = "publish-settings-collapse";
  settingsDisclosure.classList = ["publish-settings-collapse"];
  settingsDisclosure.textContent = "发布设置";
  settingsDisclosure.click = () => {
    settingsDisclosure.clicked = true;
    settingsOpen = true;
    clickOrder.push("settings");
  };
  const settingRow = new TestElement();
  settingRow.className = "publish-setting-row";
  const visibilityLabel = new TestElement();
  visibilityLabel.className = "setting-label";
  visibilityLabel.textContent = "谁可以查看";
  const visibilityTrigger = new TestElement();
  visibilityTrigger.className = "setting-value reds-select";
  visibilityTrigger.textContent = "公开";
  visibilityTrigger.click = () => {
    visibilityTrigger.clicked = true;
    privateOptionVisible = true;
    clickOrder.push("trigger");
  };
  visibilityLabel.parentElement = settingRow;
  visibilityTrigger.parentElement = settingRow;
  settingRow.children = [visibilityLabel, visibilityTrigger];
  const privateOption = new TestElement();
  privateOption.tagName = "LI";
  privateOption.className = "reds-select-option";
  privateOption.classList = ["reds-select-option"];
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
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };
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
        if (selector.includes("dropdown") || selector.includes("option") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (
          selector.includes("aria-expanded") ||
          selector.includes("collapse") ||
          selector.includes("advanced") ||
          selector.includes("more")
        ) {
          return [settingsDisclosure];
        }
        if (selector.includes("label") || selector.includes("permission") || selector.includes("visibility")) {
          return settingsOpen ? [visibilityLabel] : [];
        }
        if (selector.includes("button")) {
          return settingsOpen ? [settingsDisclosure, submit] : [settingsDisclosure, submit];
        }
        if (selector.includes("setting") || selector.includes("select")) {
          return settingsOpen
            ? [settingsDisclosure, settingRow, visibilityTrigger, submit]
            : [settingsDisclosure, submit];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-settings-disclosure-private-visibility",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-settings-disclosure-private-visibility",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/settings-disclosure-private-visibility",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/settings-disclosure",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-01T00:00:00.000Z"
      }
    });

    expect(settingsDisclosure.clicked).toBe(true);
    expect(visibilityTrigger.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["settings", "trigger", "private-option", "submit"]);
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
  }
});

it("opens creator d-select visibility controls inside publish settings when label text is not detectable", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;
  const originalChromeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  class TestMouseEvent extends Event {
    constructor(type: string, init?: EventInit) {
      super(type, { bubbles: init?.bubbles, cancelable: init?.cancelable });
    }
  }
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
      if (name === "tabindex" && this.className.includes("d-select-wrapper")) {
        return "0";
      }
      return null;
    };
    getBoundingClientRect = () => ({ left: 40, top: 80, width: 128, height: 32 });
    dispatchEvent = (event: Event) => {
      if ((this.className.includes("d-select") || this.className === "wrapper") && event.type === "mousedown") {
        privateOptionVisible = true;
        clickOrder.push("visibility-select");
      }
      return true;
    };
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
    click = () => {
      this.clicked = true;
    };
  }
  const clickOrder: string[] = [];
  let privateOptionVisible = false;
  const publishSettingsContent = new TestElement();
  publishSettingsContent.className = "publish-page-content-setting-content";
  const wrapper = new TestElement();
  wrapper.className = "wrapper";
  const selectWrapper = new TestElement();
  selectWrapper.className = "d-select-wrapper d-inline-block custom-select-44";
  const select = new TestElement();
  select.className = "d-select --color-text-title --color-bg-fill";
  const selectGrid = new TestElement();
  selectGrid.className = "d-grid d-select-main d-select-main-prefix-indicator";
  const selectContent = new TestElement();
  selectContent.className = "d-select-content";
  selectContent.textContent = "粉丝可见";
  selectWrapper.click = () => {
    selectWrapper.clicked = true;
    privateOptionVisible = true;
    clickOrder.push("visibility-select");
  };
  select.parentElement = selectWrapper;
  selectGrid.parentElement = select;
  selectContent.parentElement = selectGrid;
  selectGrid.children = [selectContent];
  select.children = [selectGrid];
  selectWrapper.children = [select];
  selectWrapper.parentElement = wrapper;
  wrapper.children = [selectWrapper];
  wrapper.parentElement = publishSettingsContent;
  publishSettingsContent.children = [wrapper];
  const privateOption = new TestElement();
  privateOption.tagName = "LI";
  privateOption.className = "d-select-option";
  privateOption.classList = ["d-select-option"];
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
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelectorAll: (selector: string) => {
        if (selector.includes("dropdown") || selector.includes("option") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("d-select") || selector.includes("select") || selector.includes("tabindex")) {
          return [selectWrapper];
        }
        if (selector.includes("publish") || selector.includes("submit") || selector.includes("button")) {
          return [publishSettingsContent, submit];
        }
        return [];
      }
    }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: undefined
  });
  Reflect.deleteProperty(globalThis, "chrome");
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-d-select-visibility-without-label",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-986-d-select-visibility-without-label",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/d-select-visibility-without-label",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/d-select-visibility",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T20:00:01.725Z"
      }
    });

    expect(privateOptionVisible).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["visibility-select", "private-option", "submit"]);
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
    if (originalChromeDescriptor) {
      Object.defineProperty(globalThis, "chrome", originalChromeDescriptor);
    }
  }
}, 10_000);

it("uses the trusted post-upload d-select wrapper for visibility debugger activation", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;
  const originalChromeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  class TestMouseEvent extends Event {
    constructor(type: string, init?: EventInit) {
      super(type, init);
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    textContent = "";
    clicked = false;
    scrolled = false;
    getAttribute = (name: string) => {
      if (name === "class") {
        return this.className;
      }
      if (name === "tabindex" && this.className.includes("d-select-wrapper")) {
        return "0";
      }
      return null;
    };
    getBoundingClientRect = () => ({ left: 48, top: 720, width: 160, height: 36 });
    dispatchEvent = () => true;
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
    scrollIntoView = () => {
      this.scrolled = true;
    };
    click = () => {
      this.clicked = true;
    };
  }
  const clickOrder: string[] = [];
  const debuggerRequests: Array<Record<string, unknown>> = [];
  let privateOptionVisible = false;
  const publishSettingsContent = new TestElement();
  publishSettingsContent.className = "publish-page-content-setting-content";
  publishSettingsContent.classList = ["publish-page-content-setting-content"];
  const selectWrapper = new TestElement();
  selectWrapper.className = "d-select-wrapper d-inline-block custom-select-44";
  selectWrapper.classList = ["d-select-wrapper", "d-inline-block", "custom-select-44"];
  selectWrapper.textContent = "公开可见";
  const select = new TestElement();
  select.className = "d-select --color-text-title --color-bg-fill";
  select.classList = ["d-select", "--color-text-title", "--color-bg-fill"];
  const selectContent = new TestElement();
  selectContent.className = "d-select-content";
  selectContent.classList = ["d-select-content"];
  selectContent.textContent = "公开可见";
  selectContent.click = () => {
    selectContent.clicked = true;
    clickOrder.push("inner-content-click");
  };
  selectContent.parentElement = select;
  select.children = [selectContent];
  select.parentElement = selectWrapper;
  selectWrapper.children = [select];
  selectWrapper.parentElement = publishSettingsContent;
  publishSettingsContent.children = [selectWrapper];
  const privateOption = new TestElement();
  privateOption.tagName = "LI";
  privateOption.className = "d-select-option";
  privateOption.classList = ["d-select-option"];
  privateOption.textContent = "仅自己可见";
  privateOption.click = () => {
    privateOption.clicked = true;
    selectWrapper.textContent = "仅自己可见";
    selectContent.textContent = "仅自己可见";
    clickOrder.push("private-option");
  };
  const submit = new TestElement();
  submit.tagName = "BUTTON";
  submit.className = "publish-submit";
  submit.classList = ["publish-submit"];
  submit.textContent = "发布";
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      elementFromPoint: () => selectContent,
      querySelectorAll: (selector: string) => {
        if (selector.includes("dropdown") || selector.includes("option") || selector.includes(" li")) {
          return privateOptionVisible ? [privateOption] : [];
        }
        if (selector.includes("d-select") || selector.includes("select") || selector.includes("tabindex")) {
          return [selectWrapper];
        }
        if (selector.includes("publish") || selector.includes("submit") || selector.includes("button")) {
          return [publishSettingsContent, submit];
        }
        return [];
      }
    }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: undefined
  });
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      runtime: {
        sendMessage: (message: Record<string, unknown>, callback?: (response: { ok: boolean }) => void) => {
          debuggerRequests.push(message);
          if (String(message.locator).includes("d-select-wrapper")) {
            privateOptionVisible = true;
            clickOrder.push("debugger-wrapper-click");
          }
          callback?.({ ok: true });
        }
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-wrapper-debugger-visibility",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1069-wrapper-debugger-visibility",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/wrapper-debugger-visibility",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/wrapper-debugger",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T21:22:05.472Z"
      }
    });

    expect(debuggerRequests).toHaveLength(1);
    expect(debuggerRequests[0]).toMatchObject({
      kind: "xhs-controlled-live-write-visibility-debugger-click",
      locator: "div.d-select-wrapper",
      run_id: "run-xhs-issue-1069-wrapper-debugger-visibility"
    });
    expect(selectWrapper.scrolled).toBe(true);
    expect(selectContent.clicked).toBe(false);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toEqual(["debugger-wrapper-click", "private-option", "submit"]);
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
    if (originalChromeDescriptor) {
      Object.defineProperty(globalThis, "chrome", originalChromeDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "chrome");
    }
  }
}, 10_000);

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

it("uses a visible custom publish button as the submit control", async () => {
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
    getBoundingClientRect = () => ({ width: 96, height: 32 });
    click = () => {
      this.clicked = true;
    };
  }
  const privateOption = new TestElement();
  privateOption.className = "visibility-option";
  privateOption.classList = ["visibility-option"];
  privateOption.textContent = "仅自己可见";
  const submit = new TestElement();
  submit.className = "d-button publish-btn";
  submit.classList = ["d-button", "publish-btn"];
  submit.textContent = "发布";
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
        if (selector.includes('class*="publish"') || selector.includes('class*="button"')) {
          return [submit];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-custom-submit-button",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-979-custom-submit-button",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/custom-submit-button",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/custom-submit-button",
        page_preview_locator: "img.preview-image",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T15:20:00.000Z"
      }
    });

    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      submit_success: true,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity"
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

it("does not treat role button alone as a safe custom submit control", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    textContent = "";
    role: string | null = null;
    clicked = false;
    getAttribute = (name: string) => {
      if (name === "class") {
        return this.className;
      }
      if (name === "role") {
        return this.role;
      }
      return null;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    click = () => {
      this.clicked = true;
    };
  }
  const privateOption = new TestElement();
  privateOption.className = "visibility-option";
  privateOption.classList = ["visibility-option"];
  privateOption.textContent = "仅自己可见";
  const roleOnlyPublishContainer = new TestElement();
  roleOnlyPublishContainer.role = "button";
  roleOnlyPublishContainer.className = "toolbar-action";
  roleOnlyPublishContainer.classList = ["toolbar-action"];
  roleOnlyPublishContainer.textContent = "发布";
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
        if (selector.includes('role="button"')) {
          return [roleOnlyPublishContainer];
        }
        return [];
      }
    }
  });
  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-role-button-alone-not-clicked",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-979-role-button-alone-not-clicked",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/role-button-alone",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/role-button-alone",
        page_preview_locator: "img.preview-image",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T15:40:00.000Z"
      }
    });

    expect(privateOption.clicked).toBe(true);
    expect(roleOnlyPublishContainer.clicked).toBe(false);
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
          blocker_code: expect.stringMatching(/PUBLISH_VISIBILITY_(?:D_SELECT_TRIGGER_NOT_ACTIVATED|PORTAL_OPTION_NOT_SELECTED|OPTION_SELECTION_FAILED)/u),
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
        blocker_code: expect.stringMatching(/PUBLISH_VISIBILITY_(?:D_SELECT_TRIGGER_NOT_ACTIVATED|PORTAL_OPTION_NOT_SELECTED|OPTION_SELECTION_FAILED)/u),
        cleanup_required: true,
        diagnostics: expect.objectContaining({
          schema_version: "fr-0032.visibility_locator_diagnostics.v1",
          values_recorded: false,
          candidate_count: expect.any(Number),
          candidates: expect.any(Array)
        })
      }),
      blocker_diagnostics: expect.objectContaining({
        recording_policy: "attribute_names_signal_flags_and_lengths_only"
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

it("prioritizes post-upload editor visibility diagnostics over early sidebar containers", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    disabled = false;
    textContent: string;
    attributes: Record<string, string>;
    clicked = false;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    click = () => {
      this.clicked = true;
    };
  }
  const sidebarCandidates = Array.from({ length: 45 }, (_, index) => {
    return new TestElement(index === 0 ? "首页 笔记 数据" : "菜单", {
      class: `d-menu-item sidebar-${index}`
    });
  });
  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content editor-form"
  });
  const visibilityRow = new TestElement("可见范围 公开", {
    class: "publish-visibility-row setting-row"
  });
  const visibilityValue = new TestElement("公开", {
    class: "publish-visibility-current d-select"
  });
  visibilityRow.parentElement = editorRoot;
  visibilityValue.parentElement = visibilityRow;
  const elements = [...sidebarCandidates, editorRoot, visibilityRow, visibilityValue];

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
      documentElement: editorRoot,
      querySelectorAll: () => elements
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-prioritized-visibility-diagnostics",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-prioritized-visibility-diagnostics",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/prioritized-diagnostics",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/prioritized-diagnostics",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T00:00:00.000Z"
      }
    });

    const diagnostics = asRecord(asRecord(result.live_write_evidence.stop_signal)?.diagnostics);
    const candidates = diagnostics?.candidates as Array<Record<string, unknown>>;
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      blockers: [
        expect.objectContaining({
          blocker_code: expect.stringMatching(/PUBLISH_VISIBILITY_(?:D_SELECT_TRIGGER_NOT_ACTIVATED|PORTAL_OPTION_NOT_SELECTED|OPTION_SELECTION_FAILED)/u)
        })
      ]
    });
    expect(diagnostics).toMatchObject({
      candidate_count: elements.length,
      sampled_candidate_count: 40
    });
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locator: "div.publish-visibility-row",
          source_index: 46,
          public_visibility_signal: true,
          visibility_structural_signal: true
        })
      ])
    );
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

it("bounds visibility diagnostics on large creator DOMs so live write returns a structured blocker", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "diagnostic-item";
    classList = ["diagnostic-item"];
    parentElement = null;
    disabled = false;
    textContent: string;
    attributes: Record<string, string>;
    constructor(index: number) {
      this.textContent = `diagnostic candidate ${index}`;
      this.attributes = { class: `diagnostic-item item-${index}` };
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    getBoundingClientRect = () => ({ width: 100, height: 24 });
  }
  const elements = Array.from({ length: 1_000 }, (_, index) => new TestElement(index));
  let styleCallCount = 0;

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => {
      styleCallCount += 1;
      return { display: "block", visibility: "visible", opacity: "1" };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: elements[0],
      querySelectorAll: (selector: string) => {
        if (selector.includes('[class*="item" i]')) {
          return elements;
        }
        return [];
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-large-visibility-diagnostics",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-963-large-visibility-diagnostics",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/large-diagnostics",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/large-diagnostics",
        page_preview_locator: "div.preview-image",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T00:00:00.000Z"
      }
    });

    const diagnostics = asRecord(asRecord(result.live_write_evidence.stop_signal)?.diagnostics);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      blockers: [
        expect.objectContaining({
          blocker_code: expect.stringMatching(/PUBLISH_VISIBILITY_(?:D_SELECT_TRIGGER_NOT_ACTIVATED|PORTAL_OPTION_NOT_SELECTED|OPTION_SELECTION_FAILED)/u)
        })
      ]
    });
    expect(diagnostics).toMatchObject({
      candidate_count: elements.length,
      scanned_candidate_count: 300,
      scan_truncated: true,
      scan_limit: 300,
      sampled_candidate_count: 40
    });
    expect(styleCallCount).toBeLessThan(elements.length);
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
        upload_artifact_id: "upload-artifact/fr-0032/accepted",
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

it("keeps accepted upload continuation partial when submit succeeds without publish identity", async () => {
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
      documentElement: new TestElement("发布中"),
      querySelectorAll: () => [visibility, submit]
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-accepted-upload-submit-partial",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1007-submit-partial",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/accepted-submit-partial",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/test-partial",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(visibility.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result).toMatchObject({
      uploaded: true,
      submitted: true,
      published: false,
      cleanup_attempted: true
    });
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: true,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity"
        })
      ]
    });
    expect(result.live_write_evidence).toMatchObject({
      execution_phase: "publish_identity",
      upload_artifact_identity: expect.objectContaining({
        upload_artifact_id: "upload-artifact/fr-0032/accepted-submit-partial",
        accepted_by_platform: true,
        visible_in_editor: true
      }),
      submit_evidence: expect.objectContaining({
        submit_result_state: "accepted"
      }),
      publish_result_identity: null,
      cleanup_result: expect.objectContaining({
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked"
      }),
      stop_signal: expect.objectContaining({
        stopped_step: "publish_identity",
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        required_recovery_action:
          "capture note_id, published URL, creator result URL, or platform record before closeout"
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

it("continues accepted upload resume from upload stage before selecting private visibility", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalLocation = globalThis.location;
  const originalWindow = globalThis.window;

  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    disabled = false;
    textContent: string;
    clicked = false;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
  }

  let continued = false;
  const locationState = {
    href: "https://creator.xiaohongshu.com/publish/publish?target=image"
  };
  const uploadWrapper = new TestElement("上传图片 下一步", {
    class: "upload-wrapper publish-page-content-media"
  });
  const nextButton = new TestElement("下一步", {
    tagName: "BUTTON",
    class: "d-button d-button-default custom-button"
  });
  nextButton.parentElement = uploadWrapper;
  nextButton.click = () => {
    nextButton.clicked = true;
    continued = true;
  };
  const visibility = new TestElement("仅自己可见", {
    class: "visibility-private"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-submit"
  });
  submit.click = () => {
    submit.clicked = true;
    locationState.href = "https://creator.xiaohongshu.com/publish/success?note_id=fr0032resume1020";
  };
  const documentElement = new TestElement("发布成功", {
    tagName: "HTML"
  });

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: locationState
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
          return continued ? [visibility] : [];
        }
        if (selector.includes("button")) {
          return continued ? [submit] : [nextButton];
        }
        if (selector.includes("publish") || selector.includes("submit")) {
          return continued ? [submit] : [];
        }
        return continued ? [visibility, submit] : [uploadWrapper, nextButton];
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-accepted-upload-resume-upload-stage",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1020-upload-stage-continuation",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue-1020-upload-stage",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/issue-1020-upload-stage",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(nextButton.clicked).toBe(true);
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
      publish_result_identity: expect.objectContaining({
        note_id: "fr0032resume1020",
        publish_visibility_scope: "private_or_self_visible",
        verification_state: "verified"
      }),
      cleanup_result: expect.objectContaining({
        cleanup_action: "hide_published_result",
        cleanup_outcome: "hidden"
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

it("bounds accepted upload resume visibility probing after upload-stage continuation", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-03T20:57:16.000Z"));

  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalLocation = globalThis.location;
  const originalWindow = globalThis.window;

  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    disabled = false;
    textContent: string;
    clicked = false;
    attributeMap: Record<string, string>;
    attributes: { length: number; item: (index: number) => { name: string; value: string } | null };
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributeMap = attributes;
      const attributeEntries = Object.entries(attributes);
      this.attributes = {
        length: attributeEntries.length,
        item: (index: number) => {
          const entry = attributeEntries[index];
          return entry ? { name: entry[0], value: entry[1] } : null;
        }
      };
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributeMap[name] ?? null;
    }
    getAttributeNames() {
      return Object.keys(this.attributeMap);
    }
    querySelectorAll() {
      return [];
    }
    dispatchEvent() {
      return true;
    }
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
  }

  let continued = false;
  const uploadWrapper = new TestElement("上传图片 下一步", {
    class: "upload-wrapper publish-page-content-media"
  });
  const nextButton = new TestElement("下一步", {
    tagName: "BUTTON",
    class: "d-button d-button-default custom-button"
  });
  nextButton.parentElement = uploadWrapper;
  nextButton.click = () => {
    nextButton.clicked = true;
    continued = true;
  };
  const visibilityTriggers = Array.from({ length: 12 }, (_, index) => new TestElement("公开", {
    tagName: "DIV",
    class: `publish-page-content-setting visibility-select trigger-${index}`
  }));
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-submit"
  });
  const documentElement = new TestElement("发布页", {
    tagName: "HTML"
  });

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { href: "https://creator.xiaohongshu.com/publish/publish?target=image" }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: globalThis.location }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement,
      querySelectorAll: (selector: string) => {
        if (selector.includes("next") || selector.includes("continue")) {
          return continued ? [] : [nextButton];
        }
        if (selector.includes("button")) {
          return continued ? [submit] : [nextButton];
        }
        if (
          selector.includes("visibility") ||
          selector.includes("privacy") ||
          selector.includes("permission") ||
          selector.includes("select") ||
          selector.includes("dropdown") ||
          selector.includes("scope") ||
          selector.includes("range")
        ) {
          return visibilityTriggers;
        }
        return continued ? visibilityTriggers : [uploadWrapper, nextButton, ...visibilityTriggers];
      }
    }
  });

  try {
    const resultPromise = performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-accepted-upload-resume-bounded-visibility",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1029-bounded-resume-visibility",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue-1029-bounded-resume",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/issue-1029-bounded-resume",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T20:57:16.000Z",
        preview_diagnostics: null
      }
    });
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await resultPromise;
    expect(nextButton.clicked).toBe(true);
    expect(visibilityTriggers.filter((trigger) => trigger.clicked)).toHaveLength(4);
    expect(submit.clicked).toBe(false);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
      submit_success: false,
      publish_success: false,
      cleanup_required: true,
      blockers: [
        expect.objectContaining({
          blocker_code: expect.stringMatching(/PUBLISH_VISIBILITY_(?:D_SELECT_TRIGGER_NOT_ACTIVATED|PORTAL_OPTION_NOT_SELECTED|OPTION_SELECTION_FAILED)/u),
          blocker_layer: "publish"
        })
      ]
    });
    expect(result.live_write_evidence).toMatchObject({
      execution_phase: "publish",
      upload_artifact_identity: expect.objectContaining({
        upload_artifact_id: "upload-artifact/fr-0032/issue-1029-bounded-resume",
        accepted_by_platform: true,
        visible_in_editor: true
      }),
      submit_evidence: null,
      cleanup_result: expect.objectContaining({
        cleanup_action: "abandon_unpublished_upload"
      }),
      stop_signal: expect.objectContaining({
        stopped_step: "publish",
        blocker_code: expect.stringMatching(/PUBLISH_VISIBILITY_(?:D_SELECT_TRIGGER_NOT_ACTIVATED|PORTAL_OPTION_NOT_SELECTED|OPTION_SELECTION_FAILED)/u)
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
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: originalLocation
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
    vi.useRealTimers();
  }
});

it("defers publish identity cleanup to background capture during automatic continuation", async () => {
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
      documentElement: new TestElement("发布中"),
      querySelectorAll: () => [visibility, submit]
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-background-continuation-submit",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-989-background-continuation",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      background_upload_capture_continuation: true,
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/background-continuation",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref:
          "object_upload:ros-upload.xiaohongshu.com/spectrum/background-continuation",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(visibility.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result).toMatchObject({
      uploaded: true,
      submitted: true,
      published: false,
      cleanup_attempted: true
    });
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      submit_success: true,
      publish_success: false,
      cleanup_required: true,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity"
        })
      ]
    });
    expect(result.live_write_evidence).toMatchObject({
      execution_phase: "publish_identity",
      cleanup_result: expect.objectContaining({
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: expect.objectContaining({
          residual_record_id:
            "residual/fr-0032/fr0032-attempt-background-continuation-submit/background-identity-pending",
          reason: "identity_missing_after_publish",
          required_followup: "merge background publish identity capture before final closeout"
        }),
        platform_message:
          "submit accepted; background publish identity capture remains authoritative"
      }),
      stop_signal: expect.objectContaining({
        stopped_step: "publish_identity",
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        residual_record_id:
          "residual/fr-0032/fr0032-attempt-background-continuation-submit/background-identity-pending",
        required_recovery_action: "merge background publish identity capture before final closeout"
      }),
      residual_record: expect.objectContaining({
        reason: "identity_missing_after_publish",
        external_visibility_may_remain: false
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

it("returns accepted-upload resume publish identity stop before extension navigation timeout", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalLocation = globalThis.location;
  const originalWindow = globalThis.window;
  const originalChromeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "chrome");

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
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: { runtime: { id: "extension-id" } }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: new TestElement("发布中"),
      querySelectorAll: () => [visibility, submit]
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-direct-resume-extension-surface",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1024-direct-resume",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/direct-resume-extension-surface",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref:
          "object_upload:ros-upload.xiaohongshu.com/spectrum/direct-resume-extension-surface",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T17:30:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(visibility.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result).toMatchObject({
      uploaded: true,
      submitted: true,
      published: false,
      cleanup_attempted: true
    });
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      submit_success: true,
      publish_success: false,
      cleanup_required: true,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
          blocker_layer: "published_identity"
        })
      ]
    });
    expect(result.live_write_evidence).toMatchObject({
      execution_phase: "publish_identity",
      cleanup_result: expect.objectContaining({
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        residual_record: expect.objectContaining({
          residual_record_id:
            "residual/fr-0032/fr0032-attempt-direct-resume-extension-surface/resume-identity-pending",
          required_followup:
            "capture publish result identity after accepted-upload resume before final closeout"
        })
      }),
      stop_signal: expect.objectContaining({
        stopped_step: "publish_identity",
        blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
        residual_record_id:
          "residual/fr-0032/fr0032-attempt-direct-resume-extension-surface/resume-identity-pending",
        required_recovery_action:
          "capture publish result identity after accepted-upload resume before final closeout"
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
    if (originalChromeDescriptor) {
      Object.defineProperty(globalThis, "chrome", originalChromeDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "chrome");
    }
  }
});

it("captures publish result identity from a current-page note link when creator URL does not change", async () => {
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
    tagName = "DIV";
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
    }
    getBoundingClientRect = () => ({ width: 120, height: 32 });
  }
  const visibility = new TestElement("仅自己可见");
  const submit = new TestElement("发布");
  submit.tagName = "BUTTON";
  const publishRecord = new TestElement("发布成功 查看笔记", {
    href: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981"
  });
  publishRecord.tagName = "A";
  const documentElement = new TestElement("");
  let publishRecordVisible = false;
  submit.click = () => {
    submit.clicked = true;
    publishRecordVisible = true;
  };

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
      documentElement,
      querySelectorAll: () => [
        visibility,
        submit,
        ...(publishRecordVisible ? [publishRecord] : [])
      ]
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-current-page-publish-record",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-981-current-page-record",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/current-page-record",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/test-record",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T00:00:00.000Z",
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
    expect(result.live_write_evidence.publish_result_identity).toMatchObject({
      result_kind: "note_id",
      note_id: "64b7d8ef000000001f03981",
      published_url: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03981",
      creator_result_url: null,
      platform_record_ref: null,
      verification_state: "verified",
      success_signal: expect.objectContaining({
        signal_source: "current_page_state",
        signal_locator: "a",
        platform_message: "publish success text observed"
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

it("ignores unrelated and pre-existing page note links when publish success has no bound result identity", async () => {
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
    tagName = "DIV";
    classList: string[] = [];
    parentElement = null;
    disabled = false;
    textContent: string;
    attributes: Record<string, string>;
    clicked = false;
    hidden = false;
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
    }
    getBoundingClientRect = () => ({ width: 120, height: 32 });
  }
  const visibility = new TestElement("仅自己可见");
  const submit = new TestElement("发布");
  submit.tagName = "BUTTON";
  const unrelatedNoteLink = new TestElement("历史笔记", {
    href: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03abcd"
  });
  unrelatedNoteLink.tagName = "A";
  const oldSuccessRecord = new TestElement("发布成功 历史笔记", {
    href: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03abcd"
  });
  oldSuccessRecord.tagName = "A";
  const rerenderedOldSuccessRecord = new TestElement("发布成功 历史笔记", {
    href: "https://www.xiaohongshu.com/explore/64b7d8ef000000001f03abcd"
  });
  rerenderedOldSuccessRecord.tagName = "SECTION";
  const successToast = new TestElement("发布成功");
  const documentElement = new TestElement("");
  let successToastVisible = false;
  submit.click = () => {
    submit.clicked = true;
    successToastVisible = true;
    documentElement.textContent = "发布成功";
  };

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
    value: (element: TestElement) => ({
      display: element.hidden ? "none" : "block",
      visibility: element.hidden ? "hidden" : "visible",
      opacity: element.hidden ? "0" : "1"
    })
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
      documentElement,
      querySelectorAll: () => [
        visibility,
        submit,
        unrelatedNoteLink,
        successToastVisible ? rerenderedOldSuccessRecord : oldSuccessRecord,
        ...(successToastVisible ? [successToast] : [])
      ]
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-unrelated-note-link",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-981-unrelated-note-link",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/unrelated-note-link",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/test-unrelated-link",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(visibility.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: true,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
        })
      ]
    });
    expect(result.live_write_evidence.publish_result_identity).toBeNull();
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

it("opens XHS permission-card select with pointer events before selecting private visibility", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      if (this.className.includes("permission-card-select") && event.type === "mousedown") {
        opened = true;
      }
      return true;
    }
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
  }

  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-settings"
  });
  const permissionWrapper = new TestElement("可见范围 公开", {
    class: "permission-card-wrapper"
  });
  const permissionSelect = new TestElement("公开", {
    class: "d-select-wrapper d-inline-block permission-card-select custom-select-44"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "d-select-option d-select-item"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });
  permissionWrapper.parentElement = editorRoot;
  permissionSelect.parentElement = permissionWrapper;
  privateOption.parentElement = editorRoot;
  submit.parentElement = editorRoot;

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: () =>
        opened
          ? [editorRoot, permissionWrapper, permissionSelect, privateOption, submit]
          : [editorRoot, permissionWrapper, permissionSelect, submit]
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-permission-card-select-pointer",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-permission-card-select-pointer",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/permission-card-select-pointer",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/permission-card-select",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(opened).toBe(true);
    expect(permissionSelect.dispatched).toEqual([
      "pointerdown",
      "mousedown",
      "mouseup",
      "pointerup",
      "keydown",
      "keyup",
      "keydown",
      "keyup"
    ]);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: true,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
        })
      ]
    });
    expect(result.live_write_evidence.publish_result_identity).toBeNull();
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
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("opens nested permission-card select when the outer wrapper is the only top-level trigger", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      if (this.className.includes("permission-card-select") && event.type === "mousedown") {
        opened = true;
      }
      return true;
    }
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-settings"
  });
  const permissionWrapper = new TestElement("可见范围 公开", {
    class: "permission-card-wrapper"
  });
  const permissionSelect = new TestElement("公开", {
    class: "d-select-wrapper d-inline-block permission-card-select custom-select-44"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "d-select-option d-select-item"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });
  permissionWrapper.parentElement = editorRoot;
  permissionSelect.parentElement = permissionWrapper;
  permissionWrapper.children = [permissionSelect];
  privateOption.parentElement = editorRoot;
  submit.parentElement = editorRoot;

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (opened && (selector.includes("option") || selector.includes("dropdown") || selector.includes("select"))) {
          return [privateOption, submit];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        return [permissionWrapper];
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-nested-permission-card-select",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-nested-permission-card-select",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/nested-permission-card-select",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/nested-permission-card-select",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(opened).toBe(true);
    expect(permissionSelect.dispatched).toEqual([
      "pointerdown",
      "mousedown",
      "mouseup",
      "pointerup",
      "keydown",
      "keyup",
      "keydown",
      "keyup"
    ]);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("opens XHS d-select visibility dropdown with keyboard activation when pointer activation does not reveal options", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    focused = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      if (this.className === "d-select" && event.type === "keydown") {
        opened = true;
      }
      return true;
    }
    focus = () => {
      this.focused = true;
    };
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-settings"
  });
  const permissionWrapper = new TestElement("可见范围 公开", {
    class: "permission-card-wrapper"
  });
  const permissionSelect = new TestElement("公开", {
    class: "d-select-wrapper d-inline-block permission-card-select custom-select-44"
  });
  const dSelect = new TestElement("公开", {
    class: "d-select"
  });
  const dSelectContent = new TestElement("公开", {
    class: "d-select-content"
  });
  const dGrid = new TestElement("公开", {
    class: "d-grid"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "d-select-dropdown-item d-select-option"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });
  permissionWrapper.parentElement = editorRoot;
  permissionSelect.parentElement = permissionWrapper;
  dSelect.parentElement = permissionSelect;
  dSelectContent.parentElement = dSelect;
  dGrid.parentElement = dSelectContent;
  permissionWrapper.children = [permissionSelect];
  permissionSelect.children = [dSelect];
  dSelect.children = [dSelectContent];
  dSelectContent.children = [dGrid];
  privateOption.parentElement = editorRoot;
  submit.parentElement = editorRoot;

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (opened && (selector.includes("option") || selector.includes("dropdown") || selector.includes("select"))) {
          return [privateOption, submit];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        return [permissionWrapper];
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-d-select-keyboard-open",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-d-select-keyboard-open",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/d-select-keyboard-open",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/d-select-keyboard-open",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(opened).toBe(true);
    expect(dSelect.focused).toBe(true);
    expect(dSelect.dispatched).toEqual([
      "pointerover",
      "mouseover",
      "pointermove",
      "mousemove",
      "pointerdown",
      "mousedown",
      "pointerup",
      "mouseup",
      "keydown",
      "keyup",
      "keydown",
      "keyup"
    ]);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("prioritizes post-upload XHS d-select visibility trigger before generic setting containers", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      if (this.className.includes("d-select-wrapper") && event.type === "mousedown") {
        opened = true;
      }
      return true;
    }
    focus = () => undefined;
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-content-extra"
  });
  const genericSettings = Array.from({ length: 6 }, (_, index) => new TestElement(`发布设置 ${index}`, {
    class: "publish-page-content-setting-content"
  }));
  const wrapper = new TestElement("公开", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const dSelect = new TestElement("公开", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const dGrid = new TestElement("公开", {
    class: "d-grid d-select-main d-select-main-prefix-indicator"
  });
  const dText = new TestElement("公开", {
    class: "d-text d-select-placeholder d-text-ellipsis d-text-nowrap"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "d-select-option d-select-item"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });
  for (const element of genericSettings) {
    element.parentElement = editorRoot;
  }
  wrapper.parentElement = editorRoot;
  dSelect.parentElement = wrapper;
  dGrid.parentElement = dSelect;
  dText.parentElement = dGrid;
  wrapper.children = [dSelect];
  dSelect.children = [dGrid];
  dGrid.children = [dText];
  privateOption.parentElement = editorRoot;
  submit.parentElement = editorRoot;

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (opened && (selector.includes("option") || selector.includes("dropdown") || selector.includes("select"))) {
          return [privateOption, submit];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        if (selector.includes("[tabindex]")) {
          return [wrapper];
        }
        if (selector.includes("setting") || selector.includes("select")) {
          return [...genericSettings, wrapper, dSelect, dGrid, dText];
        }
        return [...genericSettings, wrapper];
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1036-prioritized-d-select",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1036-prioritized-d-select",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1036-prioritized-d-select",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1036-d-select",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(genericSettings.filter((element) => element.clicked)).toHaveLength(0);
    expect(wrapper.dispatched).toContain("mousedown");
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("prioritizes XHS d-select before generic public visibility setting candidates under bounded continuation", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      if (this.className.includes("d-select-wrapper") && event.type === "mousedown") {
        opened = true;
      }
      return true;
    }
    focus = () => undefined;
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-content-extra"
  });
  const genericPublicSettings = Array.from({ length: 583 }, (_, index) => new TestElement(`可见范围 公开 ${index}`, {
    class: "publish-page-content-setting-content generic-select-control",
    tabindex: "0"
  }));
  const wrapper = new TestElement("公开", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const dSelect = new TestElement("公开", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const dGrid = new TestElement("公开", {
    class: "d-grid d-select-main d-select-main-prefix-indicator"
  });
  const dText = new TestElement("公开", {
    class: "d-text d-select-placeholder d-text-ellipsis d-text-nowrap"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "d-select-option d-select-item"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });
  for (const element of genericPublicSettings) {
    element.parentElement = editorRoot;
  }
  wrapper.parentElement = editorRoot;
  dSelect.parentElement = wrapper;
  dGrid.parentElement = dSelect;
  dText.parentElement = dGrid;
  wrapper.children = [dSelect];
  dSelect.children = [dGrid];
  dGrid.children = [dText];
  privateOption.parentElement = editorRoot;
  submit.parentElement = editorRoot;

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (opened && (selector.includes("option") || selector.includes("dropdown") || selector.includes("select"))) {
          return [privateOption, submit];
        }
        if (selector.includes("button")) {
          return [submit];
        }
        if (selector.includes("[tabindex]") && selector.includes("select")) {
          return [...genericPublicSettings, wrapper, dSelect, dGrid, dText];
        }
        if (selector.includes("[tabindex]")) {
          return [...genericPublicSettings, wrapper];
        }
        if (selector.includes("setting") || selector.includes("select")) {
          return [...genericPublicSettings, wrapper, dSelect, dGrid, dText];
        }
        return [...genericPublicSettings, wrapper];
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1040-d-select-before-generic-public-settings",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1040-d-select-before-generic-public-settings",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1040-d-select-before-generic",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1040-d-select",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(genericPublicSettings.filter((element) => element.clicked).length).toBeLessThanOrEqual(1);
    expect(wrapper.dispatched).toContain("mousedown");
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("opens ancestor d-button when the public visibility value is rendered in a nested d-text span", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      if (this.className.includes("d-button") && event.type === "mousedown") {
        opened = true;
      }
      return true;
    }
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-settings"
  });
  const visibilityRow = new TestElement("可见范围 公开", {
    class: "publish-page-content-setting"
  });
  const button = new TestElement("公开", {
    tagName: "BUTTON",
    class: "d-button d-button-default d-button-with-content"
  });
  const buttonContent = new TestElement("公开", {
    class: "d-button-content"
  });
  const publicText = new TestElement("公开", {
    class: "d-text --color-current d-text-nowrap"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "d-text d-select-option"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });
  visibilityRow.parentElement = editorRoot;
  button.parentElement = visibilityRow;
  buttonContent.parentElement = button;
  publicText.parentElement = buttonContent;
  button.children = [buttonContent];
  buttonContent.children = [publicText];
  privateOption.parentElement = editorRoot;
  submit.parentElement = editorRoot;

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (opened && (selector.includes("option") || selector.includes("dropdown") || selector.includes("select"))) {
          return [privateOption];
        }
        if (selector.includes("button")) {
          return [button, submit];
        }
        if (selector.includes("span")) {
          return [publicText];
        }
        if (selector.includes("setting") || selector.includes("visibility") || selector.includes("permission")) {
          return [visibilityRow];
        }
        return [button];
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-d-button-nested-d-text-visibility",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-d-button-nested-d-text-visibility",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/d-button-nested-d-text-visibility",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/d-button-nested-d-text",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-03T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(opened).toBe(true);
    expect(button.dispatched).toEqual([
      "pointerdown",
      "mousedown",
      "mouseup",
      "pointerup"
    ]);
    expect(button.clicked).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("opens the XHS d-select portal and selects the private option from the #1042 fixture shape", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  const clickOrder: string[] = [];
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      if ((this.className.includes("d-select-wrapper") || this.className.includes("d-select")) && event.type === "mousedown") {
        opened = true;
        clickOrder.push("trigger");
      }
      return true;
    }
    click = () => {
      this.clicked = true;
      if (this.className.includes("custom-option")) {
        dSelectWrapper.textContent = "仅自己可见";
        dSelect.textContent = "仅自己可见";
        dGrid.textContent = "仅自己可见";
        dText.textContent = "仅自己可见";
        clickOrder.push("private-option");
      }
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const publicVisibilityWithSeparators = "公\u200b开\u200b可\u200b见";
  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-content-extra"
  });
  const contentTypeDeclarationSelect = new TestElement("添加内容类型声明", {
    class: "d-select-wrapper d-inline-block content-type-declaration-select"
  });
  const settingContent = new TestElement(`可见范围 ${publicVisibilityWithSeparators}`, {
    class: "publish-page-content-setting-content"
  });
  const localWrapper = new TestElement(publicVisibilityWithSeparators, {
    class: "wrapper"
  });
  const dSelectWrapper = new TestElement(publicVisibilityWithSeparators, {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const dSelect = new TestElement(publicVisibilityWithSeparators, {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const dGrid = new TestElement(publicVisibilityWithSeparators, {
    class: "d-grid d-select-main d-select-main-prefix-indicator --color-text-title"
  });
  const dText = new TestElement(publicVisibilityWithSeparators, {
    class: "d-text d-select-placeholder d-text-ellipsis d-text-nowrap"
  });
  const portal = new TestElement("仅自己可见", {
    class: "d-popover d-popover-default d-dropdown"
  });
  const dropdownWrapper = new TestElement("仅自己可见", {
    class: "d-dropdown-wrapper"
  });
  const dropdownContent = new TestElement("仅自己可见", {
    class: "d-dropdown-content"
  });
  const optionsWrapper = new TestElement("仅自己可见", {
    class: "d-options-wrapper"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const optionName = new TestElement("仅自己可见", {
    class: "name"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });

  contentTypeDeclarationSelect.parentElement = editorRoot;
  settingContent.parentElement = editorRoot;
  localWrapper.parentElement = settingContent;
  dSelectWrapper.parentElement = localWrapper;
  dSelect.parentElement = dSelectWrapper;
  dGrid.parentElement = dSelect;
  dText.parentElement = dGrid;
  portal.parentElement = editorRoot;
  dropdownWrapper.parentElement = portal;
  dropdownContent.parentElement = dropdownWrapper;
  optionsWrapper.parentElement = dropdownContent;
  privateOption.parentElement = optionsWrapper;
  optionName.parentElement = privateOption;
  submit.parentElement = editorRoot;
  editorRoot.children = [contentTypeDeclarationSelect, settingContent, portal, submit];
  settingContent.children = [localWrapper];
  localWrapper.children = [dSelectWrapper];
  dSelectWrapper.children = [dSelect];
  dSelect.children = [dGrid];
  dGrid.children = [dText];
  portal.children = [dropdownWrapper];
  dropdownWrapper.children = [dropdownContent];
  dropdownContent.children = [optionsWrapper];
  optionsWrapper.children = [privateOption];
  privateOption.children = [optionName];
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };

  const allElements = [
    editorRoot,
    contentTypeDeclarationSelect,
    settingContent,
    localWrapper,
    dSelectWrapper,
    dSelect,
    dGrid,
    dText,
    portal,
    dropdownWrapper,
    dropdownContent,
    optionsWrapper,
    privateOption,
    optionName,
    submit
  ];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => {
      const isDropdownElement =
        element === portal ||
        element === dropdownWrapper ||
        element === dropdownContent ||
        element === optionsWrapper ||
        element === privateOption ||
        element === optionName;
      return {
        display: isDropdownElement && !opened ? "none" : "block",
        visibility: isDropdownElement && !opened ? "hidden" : "visible",
        opacity: isDropdownElement && !opened ? "0" : "1"
      };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1046-d-select-portal-fixture",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1046-d-select-portal-fixture",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1046-d-select-portal-fixture",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1046-d-select",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(opened).toBe(true);
    expect(contentTypeDeclarationSelect.clicked).toBe(false);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toContain("trigger");
    expect(clickOrder).toContain("private-option");
    expect(clickOrder).toContain("submit");
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("opens post-upload XHS d-select when only the real inner target receives pointer metadata", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  const clickOrder: string[] = [];
  class TestMouseEvent extends Event {
    button: number | undefined;
    buttons: number | undefined;
    clientX: number | undefined;
    clientY: number | undefined;
    constructor(type: string, init?: MouseEventInit) {
      super(type, { bubbles: init?.bubbles, cancelable: init?.cancelable });
      this.button = init?.button;
      this.buttons = init?.buttons;
      this.clientX = init?.clientX;
      this.clientY = init?.clientY;
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      const mouseEvent = event as TestMouseEvent;
      if (
        this.className.includes("d-select-main") &&
        event.type === "mousedown" &&
        mouseEvent.button === 0 &&
        mouseEvent.buttons === 1 &&
        typeof mouseEvent.clientX === "number" &&
        mouseEvent.clientX > 0 &&
        typeof mouseEvent.clientY === "number" &&
        mouseEvent.clientY > 0
      ) {
        opened = true;
        clickOrder.push("inner-pointer-target");
      }
      if (this.className.includes("d-select-main") && event.type === "click") {
        opened = false;
        clickOrder.push("inner-toggle-click-closed");
      }
      return true;
    }
    focus = () => undefined;
    click = () => {
      this.clicked = true;
      if (this.className.includes("d-select-main")) {
        opened = false;
        clickOrder.push("inner-native-click-closed");
      }
      if (this.className.includes("custom-option")) {
        dSelectWrapper.textContent = "仅自己可见";
        dSelect.textContent = "仅自己可见";
        dSelectMain.textContent = "仅自己可见";
        dText.textContent = "仅自己可见";
        clickOrder.push("private-option");
      }
    };
    getBoundingClientRect = () => ({ left: 40, top: 80, width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置", {
    class: "publish-page-content-content-extra"
  });
  const settingContent = new TestElement("发布设置项", {
    class: "publish-page-content-setting-content"
  });
  const localWrapper = new TestElement("当前选项", {
    class: "wrapper"
  });
  const dSelectWrapper = new TestElement("当前选项", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const dSelect = new TestElement("当前选项", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const dSelectMain = new TestElement("当前选项", {
    class: "d-select-main d-select-main-prefix-indicator --color-text-title"
  });
  const dText = new TestElement("当前选项", {
    class: "d-text d-select-placeholder d-text-ellipsis d-text-nowrap"
  });
  const portal = new TestElement("仅自己可见", {
    class: "d-popover d-popover-default d-dropdown"
  });
  const dropdownWrapper = new TestElement("仅自己可见", {
    class: "d-dropdown-wrapper"
  });
  const dropdownContent = new TestElement("仅自己可见", {
    class: "d-dropdown-content"
  });
  const optionsWrapper = new TestElement("仅自己可见", {
    class: "d-options-wrapper"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const optionName = new TestElement("仅自己可见", {
    class: "name"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });

  settingContent.parentElement = editorRoot;
  localWrapper.parentElement = settingContent;
  dSelectWrapper.parentElement = localWrapper;
  dSelect.parentElement = dSelectWrapper;
  dSelectMain.parentElement = dSelect;
  dText.parentElement = dSelectMain;
  portal.parentElement = editorRoot;
  dropdownWrapper.parentElement = portal;
  dropdownContent.parentElement = dropdownWrapper;
  optionsWrapper.parentElement = dropdownContent;
  privateOption.parentElement = optionsWrapper;
  optionName.parentElement = privateOption;
  submit.parentElement = editorRoot;
  editorRoot.children = [settingContent, portal, submit];
  settingContent.children = [localWrapper];
  localWrapper.children = [dSelectWrapper];
  dSelectWrapper.children = [dSelect];
  dSelect.children = [dSelectMain];
  dSelectMain.children = [dText];
  portal.children = [dropdownWrapper];
  dropdownWrapper.children = [dropdownContent];
  dropdownContent.children = [optionsWrapper];
  optionsWrapper.children = [privateOption];
  privateOption.children = [optionName];
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };

  const allElements = [
    editorRoot,
    settingContent,
    localWrapper,
    dSelectWrapper,
    dSelect,
    dSelectMain,
    dText,
    portal,
    dropdownWrapper,
    dropdownContent,
    optionsWrapper,
    privateOption,
    optionName,
    submit
  ];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => {
      const isDropdownElement =
        element === portal ||
        element === dropdownWrapper ||
        element === dropdownContent ||
        element === optionsWrapper ||
        element === privateOption ||
        element === optionName;
      return {
        display: isDropdownElement && !opened ? "none" : "block",
        visibility: isDropdownElement && !opened ? "hidden" : "visible",
        opacity: isDropdownElement && !opened ? "0" : "1"
      };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1052-d-select-inner-pointer-target",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1052-d-select-inner-pointer-target",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1052-d-select-inner-pointer",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1052-d-select-inner",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(opened).toBe(true);
    expect(clickOrder).toContain("inner-pointer-target");
    expect(clickOrder).not.toContain("inner-toggle-click-closed");
    expect(clickOrder).not.toContain("inner-native-click-closed");
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("opens post-upload XHS d-select with native click fallback when pointer and keyboard do not reveal options", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  const clickOrder: string[] = [];
  class TestMouseEvent extends Event {
    constructor(type: string, init?: MouseEventInit) {
      super(type, { bubbles: init?.bubbles, cancelable: init?.cancelable });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      return true;
    }
    focus = () => undefined;
    click = () => {
      this.clicked = true;
      if (this.className.includes("d-select-wrapper")) {
        opened = true;
        clickOrder.push("wrapper-native-click-opened");
      }
      if (this.className.includes("custom-option")) {
        dSelectWrapper.textContent = "仅自己可见";
        dSelect.textContent = "仅自己可见";
        dSelectMain.textContent = "仅自己可见";
        dText.textContent = "仅自己可见";
        clickOrder.push("private-option");
      }
    };
    getBoundingClientRect = () => ({ left: 40, top: 80, width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置", {
    class: "publish-page-content-content-extra"
  });
  const genericSettings = Array.from({ length: 6 }, (_, index) => new TestElement(`发布设置 ${index}`, {
    class: "publish-page-content-setting-content generic-setting",
    tabindex: "0"
  }));
  const settingContent = new TestElement("发布设置项", {
    class: "publish-page-content-setting-content"
  });
  const localWrapper = new TestElement("当前选项", {
    class: "wrapper"
  });
  const dSelectWrapper = new TestElement("公开可见", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0",
    lass: "legacy-platform-typo"
  });
  const dSelect = new TestElement("公开可见", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const dSelectMain = new TestElement("公开可见", {
    class: "d-grid d-select-main d-select-main-prefix-indicator --color-text-title"
  });
  const dPrefix = new TestElement("", {
    class: "d-select-prefix --color-text-description"
  });
  const dText = new TestElement("公开可见", {
    class: "d-text d-select-placeholder d-text-ellipsis d-text-nowrap"
  });
  const dSuffix = new TestElement("", {
    class: "d-select-suffix --color-text-description d-select-suffix-indicator"
  });
  const portal = new TestElement("仅自己可见", {
    class: "d-popover d-popover-default d-dropdown"
  });
  const dropdownWrapper = new TestElement("仅自己可见", {
    class: "d-dropdown-wrapper"
  });
  const dropdownContent = new TestElement("仅自己可见", {
    class: "d-dropdown-content"
  });
  const optionsWrapper = new TestElement("仅自己可见", {
    class: "d-options-wrapper"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const optionName = new TestElement("仅自己可见", {
    class: "name"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });

  for (const element of genericSettings) {
    element.parentElement = editorRoot;
  }
  settingContent.parentElement = editorRoot;
  localWrapper.parentElement = settingContent;
  dSelectWrapper.parentElement = localWrapper;
  dSelect.parentElement = dSelectWrapper;
  dSelectMain.parentElement = dSelect;
  dPrefix.parentElement = dSelectMain;
  dText.parentElement = dSelectMain;
  dSuffix.parentElement = dSelectMain;
  portal.parentElement = editorRoot;
  dropdownWrapper.parentElement = portal;
  dropdownContent.parentElement = dropdownWrapper;
  optionsWrapper.parentElement = dropdownContent;
  privateOption.parentElement = optionsWrapper;
  optionName.parentElement = privateOption;
  submit.parentElement = editorRoot;
  editorRoot.children = [...genericSettings, settingContent, portal, submit];
  settingContent.children = [localWrapper];
  localWrapper.children = [dSelectWrapper];
  dSelectWrapper.children = [dSelect];
  dSelect.children = [dSelectMain];
  dSelectMain.children = [dPrefix, dText, dSuffix];
  portal.children = [dropdownWrapper];
  dropdownWrapper.children = [dropdownContent];
  dropdownContent.children = [optionsWrapper];
  optionsWrapper.children = [privateOption];
  privateOption.children = [optionName];
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };

  const allElements = [
    editorRoot,
    ...genericSettings,
    settingContent,
    localWrapper,
    dSelectWrapper,
    dSelect,
    dSelectMain,
    dPrefix,
    dText,
    dSuffix,
    portal,
    dropdownWrapper,
    dropdownContent,
    optionsWrapper,
    privateOption,
    optionName,
    submit
  ];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => {
      const isDropdownElement =
        element === portal ||
        element === dropdownWrapper ||
        element === dropdownContent ||
        element === optionsWrapper ||
        element === privateOption ||
        element === optionName;
      return {
        display: isDropdownElement && !opened ? "none" : "block",
        visibility: isDropdownElement && !opened ? "hidden" : "visible",
        opacity: isDropdownElement && !opened ? "0" : "1"
      };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1059-d-select-native-click-fallback",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1059-d-select-native-click-fallback",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1059-native-click-fallback",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1059-click-fallback",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(genericSettings.filter((element) => element.clicked)).toHaveLength(0);
    expect(clickOrder).toContain("wrapper-native-click-opened");
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("opens post-upload XHS d-select through the structural suffix icon target when wrapper clicks do not open", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  const clickOrder: string[] = [];
  class TestMouseEvent extends Event {
    constructor(type: string, init?: MouseEventInit) {
      super(type, { bubbles: init?.bubbles, cancelable: init?.cancelable });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      return true;
    }
    focus = () => undefined;
    click = () => {
      this.clicked = true;
      if (this.className.includes("d-select-suffix-icon")) {
        opened = true;
        clickOrder.push("suffix-icon-opened");
      } else if (
        this.className.includes("d-select-wrapper") ||
        this.className.includes("d-select-main") ||
        this.className.includes("d-select-suffix")
      ) {
        clickOrder.push("non-opening-d-select-click");
      }
      if (this.className.includes("custom-option")) {
        dSelectWrapper.textContent = "仅自己可见";
        dSelect.textContent = "仅自己可见";
        dSelectMain.textContent = "仅自己可见";
        dText.textContent = "仅自己可见";
        clickOrder.push("private-option");
      }
    };
    getBoundingClientRect = () => ({ left: 40, top: 80, width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置", {
    class: "publish-page-content-content-extra"
  });
  const settingContent = new TestElement("发布设置项", {
    class: "publish-page-content-setting-content"
  });
  const localWrapper = new TestElement("当前选项", {
    class: "wrapper"
  });
  const dSelectWrapper = new TestElement("公开可见", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0",
    lass: "legacy-platform-typo"
  });
  const dSelect = new TestElement("公开可见", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const dSelectMain = new TestElement("公开可见", {
    class: "d-grid d-select-main d-select-main-prefix-indicator --color-text-title"
  });
  const dText = new TestElement("公开可见", {
    class: "d-text d-select-placeholder d-text-ellipsis d-text-nowrap"
  });
  const dSuffix = new TestElement("", {
    class: "d-select-suffix --color-text-description d-select-suffix-indicator"
  });
  const suffixIcon = new TestElement("", {
    tagName: "SVG",
    class: "d-select-suffix-icon"
  });
  const portal = new TestElement("仅自己可见", {
    class: "d-popover d-popover-default d-dropdown"
  });
  const dropdownWrapper = new TestElement("仅自己可见", {
    class: "d-dropdown-wrapper"
  });
  const dropdownContent = new TestElement("仅自己可见", {
    class: "d-dropdown-content"
  });
  const optionsWrapper = new TestElement("仅自己可见", {
    class: "d-options-wrapper"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const optionName = new TestElement("仅自己可见", {
    class: "name"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });

  settingContent.parentElement = editorRoot;
  localWrapper.parentElement = settingContent;
  dSelectWrapper.parentElement = localWrapper;
  dSelect.parentElement = dSelectWrapper;
  dSelectMain.parentElement = dSelect;
  dText.parentElement = dSelectMain;
  dSuffix.parentElement = dSelectMain;
  suffixIcon.parentElement = dSuffix;
  portal.parentElement = editorRoot;
  dropdownWrapper.parentElement = portal;
  dropdownContent.parentElement = dropdownWrapper;
  optionsWrapper.parentElement = dropdownContent;
  privateOption.parentElement = optionsWrapper;
  optionName.parentElement = privateOption;
  submit.parentElement = editorRoot;
  editorRoot.children = [settingContent, portal, submit];
  settingContent.children = [localWrapper];
  localWrapper.children = [dSelectWrapper];
  dSelectWrapper.children = [dSelect];
  dSelect.children = [dSelectMain];
  dSelectMain.children = [dText, dSuffix];
  dSuffix.children = [suffixIcon];
  portal.children = [dropdownWrapper];
  dropdownWrapper.children = [dropdownContent];
  dropdownContent.children = [optionsWrapper];
  optionsWrapper.children = [privateOption];
  privateOption.children = [optionName];
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };

  const allElements = [
    editorRoot,
    settingContent,
    localWrapper,
    dSelectWrapper,
    dSelect,
    dSelectMain,
    dText,
    dSuffix,
    suffixIcon,
    portal,
    dropdownWrapper,
    dropdownContent,
    optionsWrapper,
    privateOption,
    optionName,
    submit
  ];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => {
      const isDropdownElement =
        element === portal ||
        element === dropdownWrapper ||
        element === dropdownContent ||
        element === optionsWrapper ||
        element === privateOption ||
        element === optionName;
      return {
        display: isDropdownElement && !opened ? "none" : "block",
        visibility: isDropdownElement && !opened ? "hidden" : "visible",
        opacity: isDropdownElement && !opened ? "0" : "1"
      };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1061-d-select-suffix-icon-target",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1061-d-select-suffix-icon-target",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1061-suffix-icon",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1061-suffix-icon",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(clickOrder).toContain("non-opening-d-select-click");
    expect(clickOrder).toContain("suffix-icon-opened");
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("opens post-upload XHS d-select through the center hit-test target when selector targets do not open", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  const activationOrder: string[] = [];
  class TestMouseEvent extends Event {
    constructor(type: string, init?: MouseEventInit) {
      super(type, { bubbles: init?.bubbles, cancelable: init?.cancelable });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      if (this === hitTarget && (event.type === "mousedown" || event.type === "click")) {
        opened = true;
        activationOrder.push(`hit-${event.type}`);
      } else if (
        (this.className.includes("d-select-wrapper") ||
          this.className.includes("d-select-main") ||
          this.className.includes("d-select-suffix") ||
          this.className.includes("d-select-suffix-icon")) &&
        (event.type === "mousedown" || event.type === "click")
      ) {
        activationOrder.push(`non-opening-${event.type}`);
      }
      return true;
    }
    focus = () => undefined;
    click = () => {
      this.clicked = true;
      if (this === hitTarget) {
        opened = true;
        activationOrder.push("hit-native-click");
      }
      if (this.className.includes("custom-option")) {
        dSelectWrapper.textContent = "仅自己可见";
        dSelect.textContent = "仅自己可见";
        dSelectMain.textContent = "仅自己可见";
        dText.textContent = "仅自己可见";
        activationOrder.push("private-option");
      }
    };
    getBoundingClientRect = () => ({ left: 40, top: 80, width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置", {
    class: "publish-page-content-content-extra"
  });
  const settingContent = new TestElement("发布设置项", {
    class: "publish-page-content-setting-content"
  });
  const localWrapper = new TestElement("当前选项", {
    class: "wrapper"
  });
  const dSelectWrapper = new TestElement("公开可见", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const dSelect = new TestElement("公开可见", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const dSelectMain = new TestElement("公开可见", {
    class: "d-grid d-select-main d-select-main-prefix-indicator --color-text-title"
  });
  const dText = new TestElement("公开可见", {
    class: "d-text d-select-placeholder d-text-ellipsis d-text-nowrap"
  });
  const hitTarget = new TestElement("公开可见", {
    class: "platform-generated-current-value"
  });
  const dSuffix = new TestElement("", {
    class: "d-select-suffix --color-text-description d-select-suffix-indicator"
  });
  const suffixIcon = new TestElement("", {
    tagName: "SVG",
    class: "d-select-suffix-icon"
  });
  const portal = new TestElement("仅自己可见", {
    class: "d-popover d-popover-default d-dropdown"
  });
  const dropdownWrapper = new TestElement("仅自己可见", {
    class: "d-dropdown-wrapper"
  });
  const optionsWrapper = new TestElement("仅自己可见", {
    class: "d-options-wrapper"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const optionName = new TestElement("仅自己可见", {
    class: "name"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });

  settingContent.parentElement = editorRoot;
  localWrapper.parentElement = settingContent;
  dSelectWrapper.parentElement = localWrapper;
  dSelect.parentElement = dSelectWrapper;
  dSelectMain.parentElement = dSelect;
  dText.parentElement = dSelectMain;
  hitTarget.parentElement = dSelectMain;
  dSuffix.parentElement = dSelectMain;
  suffixIcon.parentElement = dSuffix;
  portal.parentElement = editorRoot;
  dropdownWrapper.parentElement = portal;
  optionsWrapper.parentElement = dropdownWrapper;
  privateOption.parentElement = optionsWrapper;
  optionName.parentElement = privateOption;
  submit.parentElement = editorRoot;
  editorRoot.children = [settingContent, portal, submit];
  settingContent.children = [localWrapper];
  localWrapper.children = [dSelectWrapper];
  dSelectWrapper.children = [dSelect];
  dSelect.children = [dSelectMain];
  dSelectMain.children = [dText, hitTarget, dSuffix];
  dSuffix.children = [suffixIcon];
  portal.children = [dropdownWrapper];
  dropdownWrapper.children = [optionsWrapper];
  optionsWrapper.children = [privateOption];
  privateOption.children = [optionName];
  submit.click = () => {
    submit.clicked = true;
    activationOrder.push("submit");
  };

  const allElements = [
    editorRoot,
    settingContent,
    localWrapper,
    dSelectWrapper,
    dSelect,
    dSelectMain,
    dText,
    hitTarget,
    dSuffix,
    suffixIcon,
    portal,
    dropdownWrapper,
    optionsWrapper,
    privateOption,
    optionName,
    submit
  ];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => {
      const isDropdownElement =
        element === portal ||
        element === dropdownWrapper ||
        element === optionsWrapper ||
        element === privateOption ||
        element === optionName;
      return {
        display: isDropdownElement && !opened ? "none" : "block",
        visibility: isDropdownElement && !opened ? "hidden" : "visible",
        opacity: isDropdownElement && !opened ? "0" : "1"
      };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      elementFromPoint: () => hitTarget,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1065-d-select-center-hit-test",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1065-center-hit-test",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1065-center-hit-test",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1065-hit-test",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(activationOrder).toContain("hit-mousedown");
    expect(opened).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("waits for delayed post-upload XHS d-select portal mounting before declaring trigger activation failed", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  let mountScheduled = false;
  class TestMouseEvent extends Event {
    constructor(type: string, init?: MouseEventInit) {
      super(type, { bubbles: init?.bubbles, cancelable: init?.cancelable });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      if (this.className.includes("d-select-wrapper") && event.type === "mousedown" && !mountScheduled) {
        mountScheduled = true;
        setTimeout(() => {
          opened = true;
        }, 650);
      }
      return true;
    }
    focus = () => undefined;
    click = () => {
      this.clicked = true;
      if (this.className.includes("custom-option")) {
        dSelectWrapper.textContent = "仅自己可见";
        dSelect.textContent = "仅自己可见";
        dText.textContent = "仅自己可见";
      }
    };
    getBoundingClientRect = () => ({ left: 40, top: 80, width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置", { class: "publish-page-content-content-extra" });
  const settingContent = new TestElement("发布设置项", { class: "publish-page-content-setting-content" });
  const localWrapper = new TestElement("当前选项", { class: "wrapper" });
  const dSelectWrapper = new TestElement("公开可见", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const dSelect = new TestElement("公开可见", { class: "d-select --color-text-title --color-bg-fill" });
  const dText = new TestElement("公开可见", {
    class: "d-text d-select-placeholder d-text-ellipsis d-text-nowrap"
  });
  const portal = new TestElement("仅自己可见", { class: "d-popover d-popover-default d-dropdown" });
  const dropdownWrapper = new TestElement("仅自己可见", { class: "d-dropdown-wrapper" });
  const optionsWrapper = new TestElement("仅自己可见", { class: "d-options-wrapper" });
  const privateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const optionName = new TestElement("仅自己可见", { class: "name" });
  const submit = new TestElement("发布", { tagName: "BUTTON", class: "publish-button" });

  settingContent.parentElement = editorRoot;
  localWrapper.parentElement = settingContent;
  dSelectWrapper.parentElement = localWrapper;
  dSelect.parentElement = dSelectWrapper;
  dText.parentElement = dSelect;
  portal.parentElement = editorRoot;
  dropdownWrapper.parentElement = portal;
  optionsWrapper.parentElement = dropdownWrapper;
  privateOption.parentElement = optionsWrapper;
  optionName.parentElement = privateOption;
  submit.parentElement = editorRoot;
  editorRoot.children = [settingContent, portal, submit];
  settingContent.children = [localWrapper];
  localWrapper.children = [dSelectWrapper];
  dSelectWrapper.children = [dSelect];
  dSelect.children = [dText];
  portal.children = [dropdownWrapper];
  dropdownWrapper.children = [optionsWrapper];
  optionsWrapper.children = [privateOption];
  privateOption.children = [optionName];
  submit.click = () => {
    submit.clicked = true;
  };

  const allElements = [
    editorRoot,
    settingContent,
    localWrapper,
    dSelectWrapper,
    dSelect,
    dText,
    portal,
    dropdownWrapper,
    optionsWrapper,
    privateOption,
    optionName,
    submit
  ];

  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: TestElement });
  Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: TestMouseEvent });
  Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: TestMouseEvent });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => {
      const isDropdownElement =
        element === portal ||
        element === dropdownWrapper ||
        element === optionsWrapper ||
        element === privateOption ||
        element === optionName;
      return {
        display: isDropdownElement && !opened ? "none" : "block",
        visibility: isDropdownElement && !opened ? "hidden" : "visible",
        opacity: isDropdownElement && !opened ? "0" : "1"
      };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1063-delayed-d-select-portal",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1063-delayed-d-select-portal",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1063-delayed-d-select-portal",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1063-delayed",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(opened).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
      submit_success: true,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING"
        })
      ]
    });
  } finally {
    Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
    Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: originalHTMLElement });
    Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: originalGetComputedStyle });
    Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: originalMouseEvent });
    Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: originalPointerEvent });
  }
});

it("uses the post-upload d-select structural fallback when public visibility text is not readable", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  const clickOrder: string[] = [];
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      if (this.className.includes("d-select") && event.type === "mousedown") {
        opened = true;
        clickOrder.push(this.className.includes("d-select-wrapper") ? "wrapper-trigger" : "nested-trigger");
      }
      return true;
    }
    click = () => {
      this.clicked = true;
      if (this.className.includes("custom-option")) {
        dSelectWrapper.textContent = "仅自己可见";
        dSelect.textContent = "仅自己可见";
        dGrid.textContent = "仅自己可见";
        dText.textContent = "仅自己可见";
        clickOrder.push("private-option");
      }
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置", {
    class: "publish-page-content-content-extra"
  });
  const settingContent = new TestElement("发布设置项", {
    class: "publish-page-content-setting-content"
  });
  const localWrapper = new TestElement("当前选项", {
    class: "wrapper"
  });
  const dSelectWrapper = new TestElement("当前选项", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const dSelect = new TestElement("当前选项", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const dGrid = new TestElement("当前选项", {
    class: "d-grid d-select-main d-select-main-prefix-indicator --color-text-title"
  });
  const dText = new TestElement("当前选项", {
    class: "d-text d-select-placeholder d-text-ellipsis d-text-nowrap"
  });
  const portal = new TestElement("仅自己可见", {
    class: "d-popover d-popover-default d-dropdown"
  });
  const dropdownWrapper = new TestElement("仅自己可见", {
    class: "d-dropdown-wrapper"
  });
  const optionsWrapper = new TestElement("仅自己可见", {
    class: "d-options-wrapper"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const optionName = new TestElement("仅自己可见", {
    class: "name"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });

  settingContent.parentElement = editorRoot;
  localWrapper.parentElement = settingContent;
  dSelectWrapper.parentElement = localWrapper;
  dSelect.parentElement = dSelectWrapper;
  dGrid.parentElement = dSelect;
  dText.parentElement = dGrid;
  portal.parentElement = editorRoot;
  dropdownWrapper.parentElement = portal;
  optionsWrapper.parentElement = dropdownWrapper;
  privateOption.parentElement = optionsWrapper;
  optionName.parentElement = privateOption;
  submit.parentElement = editorRoot;
  editorRoot.children = [settingContent, portal, submit];
  settingContent.children = [localWrapper];
  localWrapper.children = [dSelectWrapper];
  dSelectWrapper.children = [dSelect];
  dSelect.children = [dGrid];
  dGrid.children = [dText];
  portal.children = [dropdownWrapper];
  dropdownWrapper.children = [optionsWrapper];
  optionsWrapper.children = [privateOption];
  privateOption.children = [optionName];
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };

  const allElements = [
    editorRoot,
    settingContent,
    localWrapper,
    dSelectWrapper,
    dSelect,
    dGrid,
    dText,
    portal,
    dropdownWrapper,
    optionsWrapper,
    privateOption,
    optionName,
    submit
  ];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => {
      const isDropdownElement =
        element === portal ||
        element === dropdownWrapper ||
        element === optionsWrapper ||
        element === privateOption ||
        element === optionName;
      return {
        display: isDropdownElement && !opened ? "none" : "block",
        visibility: isDropdownElement && !opened ? "hidden" : "visible",
        opacity: isDropdownElement && !opened ? "0" : "1"
      };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1049-structural-fallback",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1049-structural-fallback",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1049-structural-fallback",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1049-structural",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(opened).toBe(true);
    expect(clickOrder.some((entry) => entry === "wrapper-trigger" || entry === "nested-trigger")).toBe(true);
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(true);
    expect(clickOrder).toContain("private-option");
    expect(clickOrder).toContain("submit");
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("stops before submit when the XHS d-select option click does not update the visibility trigger", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  let opened = false;
  const clickOrder: string[] = [];
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      if ((this.className.includes("d-select-wrapper") || this.className.includes("d-select")) && event.type === "mousedown") {
        opened = true;
        clickOrder.push("trigger");
      }
      return true;
    }
    click = () => {
      this.clicked = true;
      if (this.className.includes("custom-option")) {
        clickOrder.push("private-option");
      }
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-content-extra"
  });
  const settingContent = new TestElement("可见范围 公开", {
    class: "publish-page-content-setting-content"
  });
  const dSelectWrapper = new TestElement("公开可见", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const dSelect = new TestElement("公开可见", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const portal = new TestElement("仅自己可见", {
    class: "d-popover d-popover-default d-dropdown"
  });
  const dropdownWrapper = new TestElement("仅自己可见", {
    class: "d-dropdown-wrapper"
  });
  const optionsWrapper = new TestElement("仅自己可见", {
    class: "d-options-wrapper"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const optionName = new TestElement("仅自己可见", {
    class: "name"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });

  settingContent.parentElement = editorRoot;
  dSelectWrapper.parentElement = settingContent;
  dSelect.parentElement = dSelectWrapper;
  portal.parentElement = editorRoot;
  dropdownWrapper.parentElement = portal;
  optionsWrapper.parentElement = dropdownWrapper;
  privateOption.parentElement = optionsWrapper;
  optionName.parentElement = privateOption;
  submit.parentElement = editorRoot;
  editorRoot.children = [settingContent, portal, submit];
  settingContent.children = [dSelectWrapper];
  dSelectWrapper.children = [dSelect];
  portal.children = [dropdownWrapper];
  dropdownWrapper.children = [optionsWrapper];
  optionsWrapper.children = [privateOption];
  privateOption.children = [optionName];
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };

  const allElements = [
    editorRoot,
    settingContent,
    dSelectWrapper,
    dSelect,
    portal,
    dropdownWrapper,
    optionsWrapper,
    privateOption,
    optionName,
    submit
  ];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => {
      const isDropdownElement =
        element === portal ||
        element === dropdownWrapper ||
        element === optionsWrapper ||
        element === privateOption ||
        element === optionName;
      return {
        display: isDropdownElement && !opened ? "none" : "block",
        visibility: isDropdownElement && !opened ? "hidden" : "visible",
        opacity: isDropdownElement && !opened ? "0" : "1"
      };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1046-d-select-option-click-not-confirmed",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1046-d-select-option-click-not-confirmed",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1046-d-select-option-click-not-confirmed",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1046-d-select-unconfirmed",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(opened).toBe(true);
    expect(clickOrder).toContain("trigger");
    expect(privateOption.clicked).toBe(true);
    expect(submit.clicked).toBe(false);
    expect(clickOrder).toContain("trigger");
    expect(clickOrder).toContain("private-option");
    expect(clickOrder).not.toContain("submit");
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
      submit_success: false,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED"
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("uses a controlled debugger click when trusted XHS visibility d-select DOM activation does not open the portal", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;
  const originalChrome = (globalThis as { chrome?: unknown }).chrome;

  const debuggerRequests: Record<string, unknown>[] = [];
  let opened = false;
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent() {
      return true;
    }
    click = () => {
      this.clicked = true;
      if (this.className.includes("custom-option")) {
        dSelectWrapper.textContent = "仅自己可见";
      }
    };
    getBoundingClientRect = () => ({ left: 260, top: 600, width: 160, height: 36 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置 公开可见", {
    class: "publish-page-content-content-extra"
  });
  const settingContent = new TestElement("可见范围 公开", {
    class: "publish-page-content-setting-content"
  });
  const dSelectWrapper = new TestElement("公开可见", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const dSelect = new TestElement("公开可见", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const portal = new TestElement("仅自己可见", {
    class: "d-popover d-popover-default d-dropdown"
  });
  const dropdownWrapper = new TestElement("仅自己可见", {
    class: "d-dropdown-wrapper"
  });
  const optionsWrapper = new TestElement("仅自己可见", {
    class: "d-options-wrapper"
  });
  const privateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const optionName = new TestElement("仅自己可见", {
    class: "name"
  });

  settingContent.parentElement = editorRoot;
  dSelectWrapper.parentElement = settingContent;
  dSelect.parentElement = dSelectWrapper;
  portal.parentElement = editorRoot;
  dropdownWrapper.parentElement = portal;
  optionsWrapper.parentElement = dropdownWrapper;
  privateOption.parentElement = optionsWrapper;
  optionName.parentElement = privateOption;
  editorRoot.children = [settingContent, portal];
  settingContent.children = [dSelectWrapper];
  dSelectWrapper.children = [dSelect];
  portal.children = [dropdownWrapper];
  dropdownWrapper.children = [optionsWrapper];
  optionsWrapper.children = [privateOption];
  privateOption.children = [optionName];
  const allElements = [
    editorRoot,
    settingContent,
    dSelectWrapper,
    dSelect,
    portal,
    dropdownWrapper,
    optionsWrapper,
    privateOption,
    optionName
  ];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => {
      const isDropdownElement =
        element === portal ||
        element === dropdownWrapper ||
        element === optionsWrapper ||
        element === privateOption ||
        element === optionName;
      return {
        display: isDropdownElement && !opened ? "none" : "block",
        visibility: isDropdownElement && !opened ? "hidden" : "visible",
        opacity: isDropdownElement && !opened ? "0" : "1"
      };
    }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [];
        }
        return allElements;
      }
    }
  });
  (globalThis as {
    chrome?: {
      runtime?: {
        sendMessage?: (
          message: Record<string, unknown>,
          callback?: (response?: Record<string, unknown>) => void
        ) => void;
      };
    };
  }).chrome = {
    runtime: {
      sendMessage: (message, callback) => {
        debuggerRequests.push(message);
        if (message.kind === "xhs-controlled-live-write-visibility-debugger-click") {
          opened = true;
          callback?.({
            ok: true,
            result: {
              action: "controlled_live_write_visibility_click",
              target_tab_id: 32
            }
          });
          return;
        }
        callback?.({
          ok: false,
          error: {
            code: "ERR_UNEXPECTED_MESSAGE",
            message: "unexpected message"
          }
        });
      }
    }
  };

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1067-d-select-debugger-click",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1067-d-select-debugger-click",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1067-d-select-debugger-click",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1067-d-select-debugger-click",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(debuggerRequests).toEqual([
      expect.objectContaining({
        kind: "xhs-controlled-live-write-visibility-debugger-click",
        locator: "div.d-select-wrapper",
        center_x: 340,
        center_y: 618,
        run_id: "run-xhs-issue-1067-d-select-debugger-click",
        action_ref: "fr-0032/publish_visibility/d-select-trigger"
      })
    ]);
    expect(privateOption.clicked).toBe(true);
    expect(dSelectWrapper.textContent).toBe("仅自己可见");
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
      submit_success: false,
      publish_success: false
    });
    expect(JSON.stringify(result.live_write_evaluation)).not.toContain(
      "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED"
    );
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
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
    (globalThis as { chrome?: unknown }).chrome = originalChrome;
  }
});

it("does not activate the content type declaration d-select when visibility d-select is absent", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  const clickOrder: string[] = [];
  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      if (this.className.includes("content-type-declaration-select") && event.type === "mousedown") {
        this.clicked = true;
        clickOrder.push("content-type-declaration");
      }
      return true;
    }
    click = () => {
      this.clicked = true;
      if (this.className.includes("content-type-declaration-select")) {
        clickOrder.push("content-type-declaration");
      }
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => {
      const descendants: TestElement[] = [];
      const visit = (element: TestElement) => {
        for (const child of element.children) {
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    };
  }

  const editorRoot = new TestElement("发布设置 添加内容类型声明 地址 群组", {
    class: "publish-page-content-content-extra"
  });
  const contentTypeDeclarationSelect = new TestElement("添加内容类型声明", {
    class: "d-select-wrapper d-inline-block content-type-declaration-select",
    tabindex: "0"
  });
  const declarationSelect = new TestElement("添加内容类型声明", {
    class: "d-select --color-text-title --color-bg-fill"
  });
  const addressSelect = new TestElement("地址", {
    class: "d-select-wrapper d-inline-block address-card-select custom-select-44",
    tabindex: "0"
  });
  const groupSelect = new TestElement("群组", {
    class: "d-select-wrapper d-inline-block group-card-select custom-select-44",
    tabindex: "0"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });

  contentTypeDeclarationSelect.parentElement = editorRoot;
  declarationSelect.parentElement = contentTypeDeclarationSelect;
  addressSelect.parentElement = editorRoot;
  groupSelect.parentElement = editorRoot;
  submit.parentElement = editorRoot;
  editorRoot.children = [contentTypeDeclarationSelect, addressSelect, groupSelect, submit];
  contentTypeDeclarationSelect.children = [declarationSelect];
  submit.click = () => {
    submit.clicked = true;
    clickOrder.push("submit");
  };

  const allElements = [editorRoot, contentTypeDeclarationSelect, declarationSelect, addressSelect, groupSelect, submit];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1046-content-type-declaration-not-visibility",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1046-content-type-declaration-not-visibility",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1046-content-type-declaration-not-visibility",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1046-content-type",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(contentTypeDeclarationSelect.clicked).toBe(false);
    expect(addressSelect.clicked).toBe(false);
    expect(groupSelect.clicked).toBe(false);
    expect(submit.clicked).toBe(false);
    expect(clickOrder).toEqual([]);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
      submit_success: false,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED"
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
    });
  }
});

it("does not treat a hidden pre-mounted private option as an opened visibility dropdown", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;

  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    children: TestElement[] = [];
    disabled = false;
    clicked = false;
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
    querySelectorAll = () => this.children;
  }

  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-content-extra"
  });
  const visibilityTrigger = new TestElement("公开可见", {
    class: "d-select-wrapper d-inline-block custom-select-44",
    tabindex: "0"
  });
  const hiddenPrivateOption = new TestElement("仅自己可见", {
    class: "custom-option --color-bg-fill-light --color-text-title"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });
  visibilityTrigger.parentElement = editorRoot;
  hiddenPrivateOption.parentElement = editorRoot;
  submit.parentElement = editorRoot;
  editorRoot.children = [visibilityTrigger, hiddenPrivateOption, submit];
  const allElements = [editorRoot, visibilityTrigger, hiddenPrivateOption, submit];

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: TestElement) => ({
      display: element === hiddenPrivateOption ? "none" : "block",
      visibility: element === hiddenPrivateOption ? "hidden" : "visible",
      opacity: element === hiddenPrivateOption ? "0" : "1"
    })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: (selector: string) => {
        if (
          selector.includes("button") &&
          !selector.includes("select") &&
          !selector.includes("dropdown") &&
          !selector.includes("option") &&
          !selector.includes("visibility") &&
          !selector.includes("privacy") &&
          !selector.includes("permission")
        ) {
          return [submit];
        }
        return allElements;
      }
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-issue1046-hidden-premounted-private-option",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-1046-hidden-premounted-private-option",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/issue1046-hidden-premounted-private-option",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/issue1046-hidden-private-option",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-04T00:00:00.000Z",
        preview_diagnostics: null
      },
      background_upload_capture_continuation: true
    });

    expect(submit.clicked).toBe(false);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
      submit_success: false,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED"
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

it("stops before submit when permission-card activation never reveals a private option", async () => {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMouseEvent = globalThis.MouseEvent;
  const originalPointerEvent = globalThis.PointerEvent;

  class TestMouseEvent extends Event {
    constructor(type: string) {
      super(type, { bubbles: true, cancelable: true });
    }
  }
  class TestElement {
    id = "";
    tagName = "DIV";
    className = "";
    classList: string[] = [];
    parentElement: TestElement | null = null;
    disabled = false;
    clicked = false;
    dispatched: string[] = [];
    textContent: string;
    attributes: Record<string, string>;
    constructor(text: string, attributes: Record<string, string> = {}) {
      this.textContent = text;
      this.attributes = attributes;
      this.className = attributes.class ?? "";
      this.classList = this.className.split(/\s+/u).filter((item) => item.length > 0);
      this.id = attributes.id ?? "";
      this.tagName = attributes.tagName ?? "DIV";
    }
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
    dispatchEvent(event: Event) {
      this.dispatched.push(event.type);
      return true;
    }
    click = () => {
      this.clicked = true;
    };
    getBoundingClientRect = () => ({ width: 120, height: 32 });
  }

  const editorRoot = new TestElement("发布设置 可见范围 公开", {
    class: "publish-page-content-settings"
  });
  const permissionWrapper = new TestElement("可见范围 公开", {
    class: "permission-card-wrapper"
  });
  const permissionSelect = new TestElement("公开", {
    class: "d-select-wrapper d-inline-block permission-card-select custom-select-44"
  });
  const submit = new TestElement("发布", {
    tagName: "BUTTON",
    class: "publish-button"
  });
  permissionWrapper.parentElement = editorRoot;
  permissionSelect.parentElement = permissionWrapper;
  submit.parentElement = editorRoot;

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestElement
  });
  Object.defineProperty(globalThis, "MouseEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: TestMouseEvent
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ display: "block", visibility: "visible", opacity: "1" })
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: editorRoot,
      querySelectorAll: () => [editorRoot, permissionWrapper, permissionSelect, submit]
    }
  });

  try {
    const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
      live_write_attempt_id: "fr0032-attempt-permission-card-select-no-private-option",
      source_media_ref: "media-ref/fr-0032/fixture-image-a",
      source_media_digest:
        "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
      source_media_kind: "image",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      run_id: "run-xhs-issue-929-permission-card-select-no-private-option",
      profile_ref: "profile-a",
      target_tab_id: 32,
      page_url: "https://creator.xiaohongshu.com/publish/publish",
      latest_head_sha: "head-test",
      accepted_upload_artifact_identity: {
        upload_artifact_id: "upload-artifact/fr-0032/permission-card-select-no-private-option",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        platform_staging_ref: "object_upload:ros-upload-d4.xhscdn.com/spectrum/permission-card-select",
        page_preview_locator: "div.publish-page-content-media",
        accepted_by_platform: true,
        visible_in_editor: true,
        captured_at: "2026-06-02T00:00:00.000Z",
        preview_diagnostics: null
      }
    });

    expect(permissionSelect.dispatched).toEqual([
      "pointerdown",
      "mousedown",
      "mouseup",
      "pointerup",
      "keydown",
      "keyup",
      "keydown",
      "keyup"
    ]);
    expect(permissionSelect.clicked).toBe(true);
    expect(submit.clicked).toBe(false);
    expect(result.live_write_evaluation).toMatchObject({
      decision: "NO_GO",
      upload_success: true,
      submit_success: false,
      publish_success: false,
      blockers: [
        expect.objectContaining({
          blocker_code: "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED"
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
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: originalMouseEvent
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      configurable: true,
      value: originalPointerEvent
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
        upload_artifact_id: "upload-artifact/fr-0032/accepted",
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
          blocker_code: expect.stringMatching(/PUBLISH_VISIBILITY_(?:D_SELECT_TRIGGER_NOT_ACTIVATED|PORTAL_OPTION_NOT_SELECTED|OPTION_SELECTION_FAILED)/u),
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
            artifact_identity: "upload-artifact/fr-0032/test"
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
  it("preserves background upload continuation policy fields for the controlled executor", async () => {
    const observedInputs: unknown[] = [];
    const contentScript = new ContentScriptHandler({
      xhsEnv: {
        now: () => 1_000,
        randomId: () => "relay-controlled-live-write-continuation-id",
        getLocationHref: () => "https://creator.xiaohongshu.com/publish/publish",
        getDocumentTitle: () => "Creator Publish",
        getReadyState: () => "complete",
        getCookie: () => "a1=valid;",
        callSignature: async () => {
          throw new Error("controlled live write continuation should not request signatures");
        },
        fetchJson: async () => {
          throw new Error("controlled live write continuation should not hit live fetch");
        },
        performControlledLiveWrite: async (input) => {
          observedInputs.push(input);
          return {
            live_write_action: "controlled_upload_submit_publish",
            target_page: "creator_publish_tab",
            live_write_evidence: {
              schema_version: "fr-0032.live_write_evidence.v1",
              live_write_attempt_id: input.live_write_attempt_id,
              canonical_issue_ref: "#835",
              execution_phase: "publish_identity",
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
                artifact_identity: "upload-artifact/fr-0032/continuation"
              },
              upload_artifact_identity: input.accepted_upload_artifact_identity,
              submit_evidence: {
                submit_action_ref: `submit/fr-0032/${input.live_write_attempt_id}`,
                submit_locator: "button.publish-submit",
                submitted_at: "2026-06-03T13:23:25.000Z",
                submit_result_state: "accepted",
                platform_message: null
              },
              publish_result_identity: null,
              cleanup_result: null,
              risk_signals: [],
              stop_signal: {
                schema_version: "fr-0032.live_write_stop_signal.v1",
                stop_signal_id: `stop/fr-0032/${input.live_write_attempt_id}/identity-pending`,
                live_write_attempt_id: input.live_write_attempt_id,
                run_id: input.run_id,
                profile_ref: input.profile_ref ?? "profile-a",
                target_tab_id: input.target_tab_id ?? 32,
                stopped_at: "2026-06-03T13:23:25.000Z",
                stopped_step: "publish_identity",
                blocker_layer: "published_identity",
                blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
                severity: "blocking",
                later_write_actions_blocked: true,
                cleanup_required: true,
                cleanup_result_id: null,
                residual_record_id: null,
                required_recovery_action: "merge background publish identity capture before final closeout",
                evidence_ref: `live_write_evidence/${input.live_write_attempt_id}`
              },
              residual_record: null,
              created_at: "2026-06-03T13:23:25.000Z",
              updated_at: "2026-06-03T13:23:25.000Z"
            },
            live_write_evaluation: {
              schema_version: "fr-0032.live_write_evaluation.v1",
              decision: "NO_GO",
              full_live_write_success: false,
              upload_success: true,
              submit_success: true,
              publish_success: false,
              cleanup_success: false,
              later_write_actions_blocked: true,
              cleanup_required: true,
              blockers: [
                {
                  blocker_code: "PUBLISH_RESULT_IDENTITY_MISSING",
                  blocker_layer: "published_identity",
                  message: "background identity capture pending"
                }
              ]
            },
            uploaded: true,
            submitted: true,
            published: false,
            cleanup_attempted: false,
            out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
          };
        }
      }
    });
    const responsePromise = new Promise<Record<string, unknown>>((resolve) => {
      const off = contentScript.onResult((message) => {
        off();
        resolve(message as unknown as Record<string, unknown>);
      });
    });
    contentScript.onBackgroundMessage({
      kind: "forward",
      id: "forward-xhs-issue-989-controlled-live-write-continuation-001",
      runId: "run-xhs-issue-989-controlled-live-write-continuation-001",
      tabId: 32,
      profile: "profile-a",
      cwd: "/workspace/WebEnvoy",
      timeoutMs: 30_000,
      command: "xhs.creator_publish.controlled_live_write",
      params: {},
      commandParams: {
        ability: {
          id: "xhs.creator.publish.v1",
          layer: "L3",
          action: "write"
        },
        input: {
          live_write_attempt_id: "fr0032-attempt-continuation-policy",
          source_media_ref: "media-ref/fr-0032/fixture-image-a",
          source_media_digest:
            "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
          source_media_kind: "image",
          __background_upload_capture_continuation: true,
          accepted_upload_artifact_identity: {
            upload_artifact_id: "upload-artifact/fr-0032/continuation-policy",
            source_media_ref: "media-ref/fr-0032/fixture-image-a",
            source_media_digest:
              "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
            source_media_kind: "image",
            platform_staging_ref: "object_upload:ros-upload.xiaohongshu.com/spectrum/continuation-policy",
            page_preview_locator: "div.publish-page-content-media",
            accepted_by_platform: true,
            visible_in_editor: true,
            captured_at: "2026-06-03T13:23:25.000Z"
          }
        },
        options: {
          ...controlledLiveOptions,
          __runtime_latest_head_sha: "321560851c9a71a2ba39c1107e102b187111e48e",
          __runtime_profile_ref: "xhs_001"
        }
      }
    });

    const response = await responsePromise;
    expect(response).toMatchObject({
      kind: "result",
      ok: true
    });
    expect(observedInputs).toHaveLength(1);
    expect(observedInputs[0]).toMatchObject({
      live_write_attempt_id: "fr0032-attempt-continuation-policy",
      publish_visibility_scope: "private_or_self_visible",
      cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
      background_upload_capture_continuation: true,
      run_id: "run-xhs-issue-989-controlled-live-write-continuation-001",
      profile_ref: "xhs_001",
      target_tab_id: 32,
      latest_head_sha: "321560851c9a71a2ba39c1107e102b187111e48e",
      accepted_upload_artifact_identity: expect.objectContaining({
        upload_artifact_id: "upload-artifact/fr-0032/continuation-policy",
        accepted_by_platform: true,
        visible_in_editor: true
      })
    });
  });

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
            blocker_code: expect.stringMatching(/PUBLISH_VISIBILITY_(?:D_SELECT_TRIGGER_NOT_ACTIVATED|PORTAL_OPTION_NOT_SELECTED|OPTION_SELECTION_FAILED)/u),
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

  it("prefers a concrete image tab over a broad publish container when selecting image mode", async () => {
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
      getBoundingClientRect = () => ({ width: 96, height: 32 });
    }
    class BroadPublishContainer extends TestElement {
      className = "publish-container";
      classList = ["publish-container"];
      textContent = "上传视频 上传图文";
      click = () => {
        broadContainerClicked = true;
      };
    }
    class ConcreteImageTab extends TestElement {
      className = "tab-item";
      classList = ["tab-item"];
      textContent = "上传图文";
      click = () => {
        imageTabClicked = true;
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
          return "blob:https://creator.xiaohongshu.com/fr0032-image-tab";
        }
        return null;
      };
    }
    let broadContainerClicked = false;
    let imageTabClicked = false;
    let fileInputDispatched = false;
    const broadContainer = new BroadPublishContainer();
    const imageTab = new ConcreteImageTab();
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
          if (selector.includes("target=image") || selector.includes("tab") || selector.includes("publish")) {
            return [broadContainer, imageTab];
          }
          if (selector === 'input[type="file"]') {
            return imageTabClicked ? [imageInput] : [];
          }
          return fileInputDispatched ? [preview] : [];
        }
      }
    });
    try {
      const result = await performXhsControlledLiveWriteWithApprovedSourceMedia({
        live_write_attempt_id: "fr0032-attempt-concrete-image-tab",
        source_media_ref: "media-ref/fr-0032/fixture-image-a",
        source_media_digest:
          "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18",
        source_media_kind: "image",
        publish_visibility_scope: "private_or_self_visible",
        cleanup_policy_ref: "fr0032-cleanup-policy/delete-or-residual",
        run_id: "run-xhs-issue-904-concrete-image-tab",
        profile_ref: "profile-a",
        target_tab_id: 32,
        page_url: "https://creator.xiaohongshu.com/publish/publish",
        latest_head_sha: "head-test"
      });

      expect(broadContainerClicked).toBe(false);
      expect(imageTabClicked).toBe(true);
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
