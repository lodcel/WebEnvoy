import type { JsonRecord } from "./xhs-search-types.js";
import type {
  ControlledUploadArtifactIdentity,
  MediaUploadDiscoveryResult
} from "./xhs-media-upload-discovery.js";

export type XhsControlledLiveWriteInput = {
  live_write_attempt_id: string;
  source_media_ref: string;
  source_media_digest: string;
  source_media_kind: "image" | "video" | "mixed";
  publish_visibility_scope: "private_or_self_visible" | "limited_test_visibility" | "public_visible";
  cleanup_policy_ref: string;
  run_id: string;
  profile_ref: string | null;
  target_tab_id: number | null;
  page_url: string;
  latest_head_sha?: string | null;
};

export type XhsControlledLiveWriteResult = {
  live_write_action: "controlled_upload_submit_publish";
  target_page: "creator_publish_tab";
  live_write_evidence: JsonRecord;
  live_write_evaluation: JsonRecord;
  uploaded: boolean;
  submitted: boolean;
  published: boolean;
  cleanup_attempted: boolean;
  out_of_scope_actions: string[];
};

type UploadBlockedInput = {
  blockerCode: string;
  blockerMessage: string;
  detailsRef: string;
  requiredRecoveryAction: string;
};

const FR0032_FIXTURE_IMAGE_A_REF = "media-ref/fr-0032/fixture-image-a";
const FR0032_FIXTURE_IMAGE_A_DIGEST =
  "sha256:4b5c5c92cec3b23e6a294fc0eea43234ef5126c5a64f4c6c531ac8430ab0b844";
const FR0032_FIXTURE_IMAGE_A_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const nowIso = (): string => new Date().toISOString();

const sourceMediaKind = (value: string): "image" | "video" | "mixed" =>
  value === "video" || value === "mixed" ? value : "image";

const sha256DigestForBytes = async (bytes: Uint8Array): Promise<string | null> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return null;
  }
  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = await subtle.digest("SHA-256", digestInput);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
};

const decodeBase64Bytes = (value: string): Uint8Array | null => {
  if (typeof atob !== "function") {
    return null;
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const findUploadFileInput = (): HTMLInputElement | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
  return (
    inputs.find((input) => !input.disabled && /image|\*/iu.test(input.accept || "image/*")) ??
    inputs.find((input) => !input.disabled) ??
    null
  );
};

const isVisibleElement = (element: Element): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) !== 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
};

const findEditorPreviewLocator = (): string | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  const preview = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        'img[src^="blob:"]',
        'img[src^="data:image/"]',
        '[class*="preview" i] img',
        '[class*="upload" i] img',
        '[class*="cover" i] img'
      ].join(",")
    )
  ).find(isVisibleElement);
  if (!preview) {
    return null;
  }
  if (preview.id) {
    return `#${preview.id}`;
  }
  const className = Array.from(preview.classList).find((item) => item.trim().length > 0);
  return className ? `${preview.tagName.toLowerCase()}.${className}` : preview.tagName.toLowerCase();
};

const resolveApprovedFixtureMediaFile = async (
  input: XhsControlledLiveWriteInput
): Promise<File | UploadBlockedInput> => {
  if (input.source_media_ref !== FR0032_FIXTURE_IMAGE_A_REF) {
    return {
      blockerCode: "SOURCE_MEDIA_RESOLVER_UNAVAILABLE",
      blockerMessage:
        "Controlled live write cannot resolve the requested source media ref without an approved resolver.",
      detailsRef: "source_media_ref_not_approved",
      requiredRecoveryAction:
        "register the source media ref in the FR-0032 approved source media resolver"
    };
  }
  if (input.source_media_digest !== FR0032_FIXTURE_IMAGE_A_DIGEST) {
    return {
      blockerCode: "SOURCE_MEDIA_DIGEST_MISMATCH",
      blockerMessage:
        "Controlled live write cannot upload because the requested source media digest does not match the approved fixture.",
      detailsRef: "source_media_digest_mismatch",
      requiredRecoveryAction:
        "rerun with the approved fixture digest for media-ref/fr-0032/fixture-image-a"
    };
  }
  if (input.source_media_kind !== "image") {
    return {
      blockerCode: "SOURCE_MEDIA_KIND_UNSUPPORTED",
      blockerMessage: "Controlled live write currently supports only the approved FR-0032 image fixture.",
      detailsRef: "source_media_kind_unsupported",
      requiredRecoveryAction: "provide an approved image source media ref before controlled upload"
    };
  }
  if (typeof File !== "function") {
    return {
      blockerCode: "FILE_CONSTRUCTOR_UNAVAILABLE",
      blockerMessage: "Controlled live write cannot construct the approved media File in this execution surface.",
      detailsRef: "file_constructor_unavailable",
      requiredRecoveryAction: "run controlled upload in a browser surface that supports File construction"
    };
  }
  const bytes = decodeBase64Bytes(FR0032_FIXTURE_IMAGE_A_BASE64);
  if (!bytes) {
    return {
      blockerCode: "SOURCE_MEDIA_DECODE_UNAVAILABLE",
      blockerMessage: "Controlled live write cannot decode the approved fixture media bytes.",
      detailsRef: "source_media_decode_unavailable",
      requiredRecoveryAction: "run controlled upload in a browser surface that supports base64 media decoding"
    };
  }
  const actualDigest = await sha256DigestForBytes(bytes);
  if (!actualDigest) {
    return {
      blockerCode: "SOURCE_MEDIA_DIGEST_VERIFIER_UNAVAILABLE",
      blockerMessage: "Controlled live write cannot verify the approved fixture digest in this execution surface.",
      detailsRef: "source_media_digest_verifier_unavailable",
      requiredRecoveryAction: "run controlled upload in a browser surface that supports Web Crypto digest verification"
    };
  }
  if (actualDigest !== FR0032_FIXTURE_IMAGE_A_DIGEST) {
    return {
      blockerCode: "SOURCE_MEDIA_FIXTURE_DIGEST_DRIFT",
      blockerMessage:
        "Controlled live write cannot upload because the embedded approved fixture bytes no longer match the approved digest.",
      detailsRef: "source_media_fixture_digest_drift",
      requiredRecoveryAction: "restore the approved fixture bytes or update the approved digest through FR-0032 review"
    };
  }
  const mediaBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(mediaBuffer).set(bytes);
  return new File([mediaBuffer], "fr-0032-fixture-image-a.png", {
    type: "image/png",
    lastModified: 0
  });
};

const dispatchFileInputUpload = (input: HTMLInputElement, file: File): UploadBlockedInput | null => {
  if (typeof DataTransfer === "undefined") {
    return {
      blockerCode: "DATA_TRANSFER_UNAVAILABLE",
      blockerMessage: "Controlled live upload cannot continue because DataTransfer is unavailable.",
      detailsRef: "data_transfer_unavailable",
      requiredRecoveryAction: "run controlled upload in a browser surface that supports DataTransfer"
    };
  }
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return null;
  } catch {
    return {
      blockerCode: "FILE_INPUT_ASSIGNMENT_FAILED",
      blockerMessage: "Controlled live upload cannot assign the approved media file to the page input.",
      detailsRef: "file_input_assignment_failed",
      requiredRecoveryAction:
        "provide a page-compatible controlled upload executor for the current creator UI"
    };
  }
};

const isBrowserFile = (value: File | UploadBlockedInput): value is File =>
  typeof File === "function" && value instanceof File;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const buildXhsControlledLiveWriteUnavailableResult = (
  input: XhsControlledLiveWriteInput
): XhsControlledLiveWriteResult => {
  const timestamp = nowIso();
  const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
  const stopSignalId = `stop/fr-0032/${input.live_write_attempt_id}/executor-unavailable`;
  const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
  const stopSignal = {
    schema_version: "fr-0032.live_write_stop_signal.v1",
    stop_signal_id: stopSignalId,
    live_write_attempt_id: input.live_write_attempt_id,
    run_id: input.run_id,
    profile_ref: input.profile_ref ?? "unknown",
    target_tab_id: input.target_tab_id ?? 0,
    stopped_at: timestamp,
    stopped_step: "upload",
    blocker_layer: "upload",
    blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
    severity: "blocking",
    later_write_actions_blocked: true,
    cleanup_required: false,
    cleanup_result_id: null,
    residual_record_id: null,
    required_recovery_action: "provide a page executor that can safely perform controlled media upload before submit/publish",
    evidence_ref: evidenceRef
  };
  const liveWriteEvidence = {
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
      profile_ref: input.profile_ref ?? "unknown",
      target_tab_id: input.target_tab_id ?? 0,
      probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
      run_id: input.run_id,
      artifact_identity: uploadArtifactId
    },
    entry_gate: null,
    stop_classification: {
      category: "capability_gap",
      evaluation_state: "not_evaluated",
      not_evaluated_reason: "controlled_live_write_executor_unavailable",
      latest_head_sha: input.latest_head_sha ?? null,
      publish_visibility_scope: input.publish_visibility_scope,
      cleanup_policy_ref: input.cleanup_policy_ref
    },
    upload_artifact_identity: {
      upload_artifact_id: uploadArtifactId,
      source_media_ref: input.source_media_ref,
      source_media_digest: input.source_media_digest,
      source_media_kind: sourceMediaKind(input.source_media_kind),
      platform_staging_ref: null,
      page_preview_locator: null,
      accepted_by_platform: false,
      visible_in_editor: false,
      captured_at: timestamp
    },
    submit_evidence: null,
    publish_result_identity: null,
    cleanup_result: null,
    risk_signals: [
      {
        risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/upload-unavailable`,
        detected_at: timestamp,
        source: "upload",
        kind: "upload_failure",
        severity: "blocking",
        details_ref: "controlled_live_write_executor_unavailable"
      }
    ],
    stop_signal: stopSignal,
    residual_record: null,
    created_at: timestamp,
    updated_at: timestamp
  };
  return {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    live_write_evidence: liveWriteEvidence,
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
          blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
          blocker_layer: "upload",
          message: "No trusted page executor is available for controlled upload, so submit/publish are blocked."
        }
      ]
    },
    uploaded: false,
    submitted: false,
    published: false,
    cleanup_attempted: false,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
  };
};

export const buildXhsControlledLiveWriteUploadBlockedResult = (
  input: XhsControlledLiveWriteInput,
  reason: UploadBlockedInput,
  uploadArtifact?: ControlledUploadArtifactIdentity | null
): XhsControlledLiveWriteResult => {
  const timestamp = nowIso();
  const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
  const stopSignalId = `stop/fr-0032/${input.live_write_attempt_id}/upload-blocked`;
  const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
  const stopSignal = {
    schema_version: "fr-0032.live_write_stop_signal.v1",
    stop_signal_id: stopSignalId,
    live_write_attempt_id: input.live_write_attempt_id,
    run_id: input.run_id,
    profile_ref: input.profile_ref ?? "unknown",
    target_tab_id: input.target_tab_id ?? 0,
    stopped_at: timestamp,
    stopped_step: "upload",
    blocker_layer: "upload",
    blocker_code: reason.blockerCode,
    severity: "blocking",
    later_write_actions_blocked: true,
    cleanup_required: false,
    cleanup_result_id: null,
    residual_record_id: null,
    required_recovery_action: reason.requiredRecoveryAction,
    evidence_ref: evidenceRef
  };
  const liveWriteEvidence = {
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
      profile_ref: input.profile_ref ?? "unknown",
      target_tab_id: input.target_tab_id ?? 0,
      probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
      run_id: input.run_id,
      artifact_identity: uploadArtifactId
    },
    entry_gate: null,
    stop_classification: {
      category: "upload_blocked",
      evaluation_state: "stopped",
      stop_reason: reason.detailsRef,
      latest_head_sha: input.latest_head_sha ?? null,
      publish_visibility_scope: input.publish_visibility_scope,
      cleanup_policy_ref: input.cleanup_policy_ref
    },
    upload_artifact_identity: uploadArtifact ?? {
      upload_artifact_id: uploadArtifactId,
      source_media_ref: input.source_media_ref,
      source_media_digest: input.source_media_digest,
      source_media_kind: sourceMediaKind(input.source_media_kind),
      platform_staging_ref: null,
      page_preview_locator: null,
      accepted_by_platform: false,
      visible_in_editor: false,
      captured_at: timestamp
    },
    submit_evidence: null,
    publish_result_identity: null,
    cleanup_result: null,
    risk_signals: [
      {
        risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/upload-blocked`,
        detected_at: timestamp,
        source: "upload",
        kind: "upload_failure",
        severity: "blocking",
        details_ref: reason.detailsRef
      }
    ],
    stop_signal: stopSignal,
    residual_record: null,
    created_at: timestamp,
    updated_at: timestamp
  };
  return {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    live_write_evidence: liveWriteEvidence,
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
          blocker_code: reason.blockerCode,
          blocker_layer: "upload",
          message: reason.blockerMessage
        }
      ]
    },
    uploaded: false,
    submitted: false,
    published: false,
    cleanup_attempted: false,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
  };
};

const buildXhsControlledLiveWriteSubmitBlockedResult = (
  input: XhsControlledLiveWriteInput,
  discovery: MediaUploadDiscoveryResult
): XhsControlledLiveWriteResult => {
  const artifact = discovery.controlled_upload_evidence?.upload_artifact_identity ?? null;
  const result = buildXhsControlledLiveWriteUploadBlockedResult(input, {
    blockerCode: "SUBMIT_EXECUTOR_UNAVAILABLE",
    blockerMessage: "Upload evidence exists, but submit/publish executor is not available.",
    detailsRef: "submit_executor_unavailable",
    requiredRecoveryAction: "provide a submit/publish executor and cleanup policy executor before continuing after upload"
  });
  const evidence = result.live_write_evidence;
  const stopSignal = evidence.stop_signal as JsonRecord;
  return {
    ...result,
    live_write_evidence: {
      ...evidence,
      execution_phase: "submit",
      stop_classification: {
        ...(evidence.stop_classification as JsonRecord),
        category: "submit_blocked",
        stop_reason: "submit_executor_unavailable"
      },
      upload_artifact_identity: artifact,
      risk_signals: [
        {
          risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/submit-unavailable`,
          detected_at: stopSignal.stopped_at,
          source: "submit",
          kind: "submit_failure",
          severity: "blocking",
          details_ref: "submit_executor_unavailable"
        }
      ],
      stop_signal: {
        ...stopSignal,
        stop_signal_id: `stop/fr-0032/${input.live_write_attempt_id}/submit-unavailable`,
        stopped_step: "submit",
        blocker_layer: "submit",
        blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
        cleanup_required: true,
        required_recovery_action: "provide a submit/publish executor and cleanup policy executor before continuing after upload"
      },
      updated_at: stopSignal.stopped_at
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: false,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: [
        {
          blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
          blocker_layer: "submit",
          message: "Upload evidence exists, but submit/publish executor is not available."
        }
      ]
    },
    uploaded: true,
    cleanup_attempted: false
  };
};

export const buildXhsControlledLiveWriteFromDiscovery = (
  input: XhsControlledLiveWriteInput,
  discovery: MediaUploadDiscoveryResult
): XhsControlledLiveWriteResult => {
  if (discovery.controlled_upload_evidence?.upload_artifact_identity?.accepted_by_platform === true) {
    return buildXhsControlledLiveWriteSubmitBlockedResult(input, discovery);
  }
  const artifact = discovery.controlled_upload_evidence?.upload_artifact_identity ?? null;
  if (!artifact) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "UPLOAD_ARTIFACT_MISSING",
      blockerMessage: "Controlled live write cannot continue because no upload artifact identity is available.",
      detailsRef: "upload_artifact_identity_missing",
      requiredRecoveryAction: "provide a source media resolver and upload executor that can produce platform-accepted upload artifact identity"
    });
  }
  return buildXhsControlledLiveWriteUploadBlockedResult(input, {
    blockerCode: "UPLOAD_PLATFORM_REJECTED",
    blockerMessage: "Controlled live write cannot continue because recon evidence did not perform or prove platform upload acceptance.",
    detailsRef: "source_media_resolution_or_upload_acceptance_unavailable",
    requiredRecoveryAction: "provide a controlled media resolver and real upload executor before submit/publish"
  }, artifact);
};

export const performXhsControlledLiveWriteWithApprovedSourceMedia = async (
  input: XhsControlledLiveWriteInput
): Promise<XhsControlledLiveWriteResult> => {
  const resolvedFile = await resolveApprovedFixtureMediaFile(input);
  if (!isBrowserFile(resolvedFile)) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, resolvedFile);
  }
  const fileInput = findUploadFileInput();
  if (!fileInput) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "UPLOAD_ENTRY_MISSING",
      blockerMessage: "Controlled live upload cannot find an enabled file input on the creator publish page.",
      detailsRef: "upload_file_input_missing",
      requiredRecoveryAction: "restore the creator publish target page or update the XHS upload entry locator"
    });
  }
  const assignmentFailure = dispatchFileInputUpload(fileInput, resolvedFile);
  if (assignmentFailure) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, assignmentFailure);
  }
  await sleep(2_500);
  const pagePreviewLocator = findEditorPreviewLocator();
  if (!pagePreviewLocator) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "UPLOAD_PREVIEW_NOT_VISIBLE",
      blockerMessage:
        "Controlled live upload injected the approved media file, but the editor preview did not become visible.",
      detailsRef: "upload_preview_not_visible",
      requiredRecoveryAction:
        "verify the current XHS creator upload UI accepts controlled file input assignment before submit"
    });
  }
  const timestamp = nowIso();
  const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
  return buildXhsControlledLiveWriteUploadBlockedResult(input, {
    blockerCode: "UPLOAD_ACCEPTANCE_UNVERIFIED",
    blockerMessage:
      "Controlled live upload observed an editor preview, but platform upload acceptance is not independently verified.",
    detailsRef: "upload_acceptance_unverified",
    requiredRecoveryAction:
      "collect platform-returned upload acceptance evidence before submit/publish"
  }, {
    upload_artifact_id: uploadArtifactId,
    source_media_ref: input.source_media_ref,
    source_media_digest: input.source_media_digest,
    source_media_kind: input.source_media_kind,
    platform_staging_ref: null,
    page_preview_locator: pagePreviewLocator,
    accepted_by_platform: false,
    visible_in_editor: true,
    captured_at: timestamp
  });
};
