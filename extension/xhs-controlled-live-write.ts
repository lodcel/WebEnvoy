import type { JsonRecord } from "./xhs-search-types.js";
import type {
  ControlledUploadArtifactIdentity,
  EditorPreviewAttributeDiagnostics,
  EditorPreviewDiagnostics,
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
  accepted_upload_artifact_identity?: ControlledUploadArtifactIdentity | null;
  background_upload_capture_continuation?: boolean;
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

export type XhsControlledUploadPlatformCapture = {
  source: "chrome_debugger_network";
  platform_staging_ref: string;
  evidence_basis?: "trusted_platform_response_body" | "object_upload_transport_2xx";
  url: string;
  method: string;
  status: number;
  captured_at: string;
};

export type XhsControlledUploadPlatformCaptureStatus = {
  attempted: true;
  status: "not_started" | "started" | "timeout";
  reason: string | null;
  recorded_at: string;
  observed_requests?: JsonRecord[];
};

export type XhsControlledPublishResultIdentityCapture = {
  source: "chrome_debugger_network";
  evidence_basis: "trusted_platform_response_body";
  result_kind: "note_id" | "published_url" | "creator_result_page" | "platform_publish_record";
  note_id: string | null;
  published_url: string | null;
  creator_result_url: string | null;
  platform_record_ref: string | null;
  publish_visibility_scope: "private_or_self_visible" | null;
  publish_visibility_proof_locator?: string | null;
  url: string;
  method: string;
  status: number;
  captured_at: string;
};

export type XhsControlledPublishResultIdentityCaptureFailureCode =
  | "PUBLISH_IDENTITY_CAPTURE_NOT_STARTED"
  | "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_NOT_OBSERVED"
  | "PUBLISH_IDENTITY_CAPTURE_DIAGNOSTIC_EVENTS_NOT_RECORDED"
  | "PUBLISH_ACTION_NETWORK_NOT_OBSERVED"
  | "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_UNTRUSTED"
  | "PUBLISH_IDENTITY_CAPTURE_RESPONSE_BODY_UNREADABLE"
  | "PUBLISH_IDENTITY_CAPTURE_RESPONSE_IDENTITY_MISSING"
  | "PUBLISH_IDENTITY_CAPTURE_TIMED_OUT";

export type XhsControlledPublishResultIdentityCaptureStatus = {
  attempted: true;
  status: "not_started" | "started" | "timeout";
  reason: string | null;
  blocker_code: XhsControlledPublishResultIdentityCaptureFailureCode | null;
  recorded_at: string;
  observed_requests?: JsonRecord[];
  network_event_count?: number;
  ignored_request_count?: number;
};

export const resolveXhsControlledPublishIdentityCaptureTimeoutClassificationForContract = (input: {
  observedRequestCount: number;
  trustedEndpointObserved: boolean;
  trustedFailureBlockerCode?: XhsControlledPublishResultIdentityCaptureFailureCode | null;
  trustedFailureReason?: string | null;
  adjacentFailureBlockerCode?: XhsControlledPublishResultIdentityCaptureFailureCode | null;
  adjacentFailureReason?: string | null;
  networkRequestEventCount?: number;
  ignoredRequestCount?: number;
  fallbackBlockerCode: XhsControlledPublishResultIdentityCaptureFailureCode | null;
  fallbackReason: string;
}): {
  blocker_code: XhsControlledPublishResultIdentityCaptureFailureCode | null;
  reason: string;
} => {
  if (input.observedRequestCount <= 0) {
    if (typeof input.networkRequestEventCount === "number" && input.networkRequestEventCount <= 0) {
      return {
        blocker_code: "PUBLISH_ACTION_NETWORK_NOT_OBSERVED",
        reason: "post_submit_network_event_not_observed"
      };
    }
    if (typeof input.networkRequestEventCount === "number" && input.networkRequestEventCount > 0) {
      return {
        blocker_code: "PUBLISH_IDENTITY_CAPTURE_DIAGNOSTIC_EVENTS_NOT_RECORDED",
        reason: "post_submit_network_events_filtered_without_diagnostics"
      };
    }
    return {
      blocker_code: "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_NOT_OBSERVED",
      reason: input.fallbackReason
    };
  }
  if (
    input.trustedEndpointObserved !== true &&
    !input.adjacentFailureBlockerCode &&
    typeof input.ignoredRequestCount === "number" &&
    input.ignoredRequestCount > 0
  ) {
    return {
      blocker_code: "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_NOT_OBSERVED",
      reason: "only_outside_publish_identity_diagnostic_scope"
    };
  }
  return {
    blocker_code:
      input.trustedFailureBlockerCode ??
      (!input.trustedEndpointObserved ? input.adjacentFailureBlockerCode : null) ??
      input.fallbackBlockerCode,
    reason:
      input.trustedFailureReason ??
      (!input.trustedEndpointObserved ? input.adjacentFailureReason : null) ??
      input.fallbackReason
  };
};

export type XhsControlledUploadNetworkResponseInput = {
  url: string;
  method: string;
  status: number;
  body: unknown;
  captured_at: string;
};

export type XhsControlledUploadNetworkBodyInput = {
  body: unknown;
  base64Encoded?: unknown;
  maxBodyBytes?: number;
};

type UploadBlockedInput = {
  blockerCode: string;
  blockerMessage: string;
  detailsRef: string;
  requiredRecoveryAction: string;
};

type SubmitEvidence = {
  submit_action_ref: string;
  submit_locator: string;
  submitted_at: string;
  submit_result_state: "accepted" | "platform_validation_error" | "blocked_by_risk" | "unknown";
  platform_message: string | null;
};

type PublishActionActivationResult = {
  activated: boolean;
  signal: string | null;
  href: string | null;
  controlDisabled: boolean;
  controlBusy: boolean;
};

type PublishResultIdentity = {
  schema_version: "fr-0032.publish_result_identity.v1";
  publish_result_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  target_domain: "creator.xiaohongshu.com";
  target_page: "creator_publish_tab";
  source_upload_artifact_id: string;
  submit_action_ref: string;
  result_kind: "note_id" | "published_url" | "creator_result_page" | "platform_publish_record";
  note_id: string | null;
  published_url: string | null;
  creator_result_url: string | null;
  platform_record_ref: string | null;
  publish_visibility_scope: XhsControlledLiveWriteInput["publish_visibility_scope"];
  success_signal: {
    signal_source: "platform_response" | "creator_result_page" | "current_page_state" | "followup_page_verification";
    signal_locator: string;
    platform_message: string | null;
    observed_at: string;
  };
  captured_at: string;
  verification_state: "verified" | "identity_missing" | "ambiguous" | "blocked";
};

type StepBlockedInput = {
  blockerCode: string;
  blockerMessage: string;
  detailsRef: string;
  requiredRecoveryAction: string;
  stoppedStep: "submit" | "publish" | "publish_identity";
  blockerLayer: "submit" | "publish" | "published_identity";
  riskKind: "submit_failure" | "publish_identity_missing";
  cleanupRequired: boolean;
  diagnostics?: JsonRecord | null;
};

type VisibilitySelectionBlockerCode =
  | "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED"
  | "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED"
  | "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED";

type VisibilityControlSelectionResult = {
  selectedOption: HTMLElement | null;
  blockerCode: VisibilitySelectionBlockerCode | null;
  detailsRef: string | null;
  openedDropdown: boolean;
  triggerCount: number;
  optionLocator: string | null;
  debuggerClick: JsonRecord | null;
};

type XhsControlledVisibilityDebuggerClickMessage = {
  kind: "xhs-controlled-live-write-visibility-debugger-click";
  locator: string;
  center_x: number;
  center_y: number;
  run_id: string;
  action_ref: string;
  timeout_ms?: number;
};

type XhsControlledVisibilityDebuggerClickResponse = {
  ok: boolean;
  result?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};

type XhsControlledPublishDebuggerClickMessage = {
  kind: "xhs-controlled-live-write-publish-debugger-click";
  locator: string;
  center_x: number;
  center_y: number;
  run_id: string;
  action_ref: string;
  timeout_ms?: number;
};

type XhsControlledPublishDebuggerClickResponse = {
  ok: boolean;
  result?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};

const visibilitySelectionSuccess = (
  selectedOption: HTMLElement,
  openedDropdown: boolean,
  triggerCount: number,
  debuggerClick: JsonRecord | null = null
): VisibilityControlSelectionResult => ({
  selectedOption,
  blockerCode: null,
  detailsRef: null,
  openedDropdown,
  triggerCount,
  optionLocator: locatorForElement(selectedOption),
  debuggerClick
});

const visibilitySelectionBlocked = (
  blockerCode: VisibilitySelectionBlockerCode,
  detailsRef: string,
  openedDropdown: boolean,
  triggerCount: number,
  debuggerClick: JsonRecord | null = null
): VisibilityControlSelectionResult => ({
  selectedOption: null,
  blockerCode,
  detailsRef,
  openedDropdown,
  triggerCount,
  optionLocator: null,
  debuggerClick
});

const elementCenterCoordinates = (element: HTMLElement): { centerX: number; centerY: number } | null => {
  const rect = element.getBoundingClientRect();
  const width = Number.isFinite(rect.width) ? rect.width : 0;
  const height = Number.isFinite(rect.height) ? rect.height : 0;
  if (width <= 0 || height <= 0) {
    return null;
  }
  const left = Number.isFinite(rect.left) ? rect.left : 0;
  const top = Number.isFinite(rect.top) ? rect.top : 0;
  return {
    centerX: Math.max(0, Math.floor(left + width / 2)),
    centerY: Math.max(0, Math.floor(top + height / 2))
  };
};

const requestVisibilityDebuggerClickViaExtension = async (input: {
  target: HTMLElement;
  runId: string;
  actionRef: string;
  timeoutMs?: number;
}): Promise<XhsControlledVisibilityDebuggerClickResponse> => {
  const runtime = (globalThis as {
    chrome?: {
      runtime?: {
        sendMessage?: (
          message: XhsControlledVisibilityDebuggerClickMessage,
          callback?: (response?: XhsControlledVisibilityDebuggerClickResponse) => void
        ) => Promise<XhsControlledVisibilityDebuggerClickResponse | undefined> | void;
        lastError?: { message?: string };
      };
    };
  }).chrome?.runtime;
  const sendMessage = runtime?.sendMessage;
  if (!sendMessage) {
    return {
      ok: false,
      error: {
        code: "ERR_XHS_VISIBILITY_DEBUGGER_UNAVAILABLE",
        message: "extension runtime.sendMessage is unavailable"
      }
    };
  }
  if (typeof input.target.scrollIntoView === "function") {
    try {
      input.target.scrollIntoView({ block: "center", inline: "nearest" });
      await sleep(100);
    } catch {
      // Best-effort positioning before CDP mouse input; geometry validation below remains authoritative.
    }
  }
  const coordinates = elementCenterCoordinates(input.target);
  if (!coordinates) {
    return {
      ok: false,
      error: {
        code: "ERR_XHS_VISIBILITY_DEBUGGER_TARGET_GEOMETRY_MISSING",
        message: "visibility debugger click target geometry is unavailable"
      }
    };
  }
  const request: XhsControlledVisibilityDebuggerClickMessage = {
    kind: "xhs-controlled-live-write-visibility-debugger-click",
    locator: locatorForElement(input.target),
    center_x: coordinates.centerX,
    center_y: coordinates.centerY,
    run_id: input.runId,
    action_ref: input.actionRef,
    ...(typeof input.timeoutMs === "number" ? { timeout_ms: input.timeoutMs } : {})
  };
  try {
    return await new Promise<XhsControlledVisibilityDebuggerClickResponse>((resolve, reject) => {
      let settled = false;
      const timeoutMs =
        typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
          ? Math.floor(input.timeoutMs)
          : 3_000;
      const resolveOnce = (message: XhsControlledVisibilityDebuggerClickResponse): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(message);
      };
      const rejectOnce = (error: unknown): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(() => {
        resolveOnce({
          ok: false,
          error: {
            code: "ERR_XHS_VISIBILITY_DEBUGGER_TIMEOUT",
            message: `visibility debugger click timed out after ${timeoutMs}ms`
          }
        });
      }, timeoutMs);
      try {
        const maybePromise = sendMessage(request, (message?: XhsControlledVisibilityDebuggerClickResponse) => {
          const lastError = (globalThis as {
            chrome?: { runtime?: { lastError?: { message?: string } } };
          }).chrome?.runtime?.lastError;
          if (lastError?.message) {
            resolveOnce({
              ok: false,
              error: {
                code: "ERR_XHS_VISIBILITY_DEBUGGER_FAILED",
                message: lastError.message
              }
            });
            return;
          }
          resolveOnce(
            message ?? {
              ok: false,
              error: {
                code: "ERR_XHS_VISIBILITY_DEBUGGER_FAILED",
                message: "response missing"
              }
            }
          );
        });
        if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
          void (maybePromise as Promise<XhsControlledVisibilityDebuggerClickResponse | undefined>)
            .then((message) => {
              if (message) {
                resolveOnce(message);
              }
            })
            .catch((error) => {
              rejectOnce(error);
            });
        }
      } catch (error) {
        rejectOnce(error);
      }
    });
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "ERR_XHS_VISIBILITY_DEBUGGER_FAILED",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
};

const requestPublishDebuggerClickViaExtension = async (input: {
  target: HTMLElement;
  runId: string;
  actionRef: string;
  timeoutMs?: number;
}): Promise<XhsControlledPublishDebuggerClickResponse> => {
  const runtime = (globalThis as {
    chrome?: {
      runtime?: {
        sendMessage?: (
          message: XhsControlledPublishDebuggerClickMessage,
          callback?: (response?: XhsControlledPublishDebuggerClickResponse) => void
        ) => Promise<XhsControlledPublishDebuggerClickResponse | undefined> | void;
        lastError?: { message?: string };
      };
    };
  }).chrome?.runtime;
  const sendMessage = runtime?.sendMessage;
  if (!sendMessage) {
    return {
      ok: false,
      error: {
        code: "ERR_XHS_PUBLISH_DEBUGGER_UNAVAILABLE",
        message: "extension runtime.sendMessage is unavailable"
      }
    };
  }
  if (typeof input.target.scrollIntoView === "function") {
    try {
      input.target.scrollIntoView({ block: "center", inline: "nearest" });
      await sleep(100);
    } catch {
      // Best-effort positioning before CDP mouse input; geometry validation below remains authoritative.
    }
  }
  const coordinates = elementCenterCoordinates(input.target);
  if (!coordinates) {
    return {
      ok: false,
      error: {
        code: "ERR_XHS_PUBLISH_DEBUGGER_TARGET_GEOMETRY_MISSING",
        message: "publish debugger click target geometry is unavailable"
      }
    };
  }
  const request: XhsControlledPublishDebuggerClickMessage = {
    kind: "xhs-controlled-live-write-publish-debugger-click",
    locator: locatorForElement(input.target),
    center_x: coordinates.centerX,
    center_y: coordinates.centerY,
    run_id: input.runId,
    action_ref: input.actionRef,
    ...(typeof input.timeoutMs === "number" ? { timeout_ms: input.timeoutMs } : {})
  };
  try {
    return await new Promise<XhsControlledPublishDebuggerClickResponse>((resolve, reject) => {
      let settled = false;
      const timeoutMs =
        typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
          ? Math.floor(input.timeoutMs)
          : 3_000;
      const resolveOnce = (message: XhsControlledPublishDebuggerClickResponse): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(message);
      };
      const rejectOnce = (error: unknown): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(() => {
        resolveOnce({
          ok: false,
          error: {
            code: "ERR_XHS_PUBLISH_DEBUGGER_TIMEOUT",
            message: `publish debugger click timed out after ${timeoutMs}ms`
          }
        });
      }, timeoutMs);
      try {
        const maybePromise = sendMessage(request, (message?: XhsControlledPublishDebuggerClickResponse) => {
          const lastError = (globalThis as {
            chrome?: { runtime?: { lastError?: { message?: string } } };
          }).chrome?.runtime?.lastError;
          if (lastError?.message) {
            resolveOnce({
              ok: false,
              error: {
                code: "ERR_XHS_PUBLISH_DEBUGGER_FAILED",
                message: lastError.message
              }
            });
            return;
          }
          resolveOnce(
            message ?? {
              ok: false,
              error: {
                code: "ERR_XHS_PUBLISH_DEBUGGER_FAILED",
                message: "response missing"
              }
            }
          );
        });
        if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
          void (maybePromise as Promise<XhsControlledPublishDebuggerClickResponse | undefined>)
            .then((message) => {
              if (message) {
                resolveOnce(message);
              }
            })
            .catch((error) => {
              rejectOnce(error);
            });
        }
      } catch (error) {
        rejectOnce(error);
      }
    });
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "ERR_XHS_PUBLISH_DEBUGGER_FAILED",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
};

const FR0032_FIXTURE_IMAGE_A_REF = "media-ref/fr-0032/fixture-image-a";
const FR0032_FIXTURE_IMAGE_A_DIGEST =
  "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18";
const FR0032_FIXTURE_IMAGE_A_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAG5ElEQVR42u3WMQ0AAAjAMGQhB//BA5jgo0cN7Fp01gAAv4QIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAHBnAVzllrXr0ZtlAAAAAElFTkSuQmCC";

const nowIso = (): string => new Date().toISOString();

const asPlainRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const xhsControlledUploadCaptureDefaultMaxBodyBytes = 256_000;
const xhsControlledUploadSignalPattern =
  /(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu;
const xhsControlledUploadCredentialEndpointPattern =
  /(?:^|[/_.-])(?:permit|token|credential|policy|sign|sts)(?:$|[/_.-])/iu;

const isXhsControlledObjectUploadTransportHost = (host: string): boolean =>
  /^ros-upload(?:-[a-z0-9]+)?\.(?:xiaohongshu\.com|xhscdn\.com)$/iu.test(host);

const isXhsControlledUploadDiagnosticWriteHost = (host: string): boolean =>
  host === "creator.xiaohongshu.com" ||
  host === "edith.xiaohongshu.com" ||
  host === "upload.xiaohongshu.com" ||
  isXhsControlledObjectUploadTransportHost(host);

const xhsControlledUploadPlatformEndpointAllowlist = [
  {
    host: "creator.xiaohongshu.com",
    path:
      /^\/(?:api|web_api)\/.*(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu
  },
  {
    host: "edith.xiaohongshu.com",
    path:
      /^\/api\/.*(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu
  },
  {
    host: "upload.xiaohongshu.com",
    path:
      /^\/.*(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu
  }
] as const;

export const isXhsControlledUploadPlatformCaptureUrl = (
  url: string,
  method: string
): boolean => {
  if (!/^(POST|PUT|PATCH)$/iu.test(method)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (xhsControlledUploadCredentialEndpointPattern.test(parsed.pathname)) {
      return false;
    }
    if (method.toUpperCase() === "PUT" && objectUploadTransportStagingRef(url)) {
      return true;
    }
    return xhsControlledUploadPlatformEndpointAllowlist.some(
      (entry) => parsed.hostname === entry.host && entry.path.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

export const summarizeXhsControlledUploadObservedRequest = (
  url: string,
  method: string
): JsonRecord | null => {
  if (!/^(POST|PUT|PATCH)$/iu.test(method)) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const isKnownHost =
      parsed.hostname.endsWith("xiaohongshu.com") || parsed.hostname.endsWith("xhscdn.com");
    const objectUploadTransport = isXhsControlledObjectUploadTransportHost(parsed.hostname);
    const diagnosticWriteHost = isXhsControlledUploadDiagnosticWriteHost(parsed.hostname);
    const uploadLikeHost = parsed.hostname.includes("upload");
    const uploadLikePath = xhsControlledUploadSignalPattern.test(parsed.pathname);
    const credentialEndpoint = xhsControlledUploadCredentialEndpointPattern.test(parsed.pathname);
    if (
      !isKnownHost ||
      (
        !diagnosticWriteHost &&
        !objectUploadTransport &&
        !uploadLikeHost &&
        !uploadLikePath &&
        !credentialEndpoint
      )
    ) {
      return null;
    }
    const captureCandidate = isXhsControlledUploadPlatformCaptureUrl(url, method);
    return {
      method,
      host: parsed.hostname,
      path: parsed.pathname,
      capture_candidate: captureCandidate,
      rejection_reason: captureCandidate
        ? null
        : objectUploadTransport
          ? "object_upload_transport_not_platform_acceptance"
          : credentialEndpoint
            ? "credential_endpoint_not_platform_acceptance"
            : diagnosticWriteHost
              ? "xhs_write_request_not_upload_signal"
              : "url_not_allowlisted"
    };
  } catch {
    return null;
  }
};

export const parseXhsControlledUploadNetworkResponseBody = (
  value: unknown,
  maxBodyBytes = xhsControlledUploadCaptureDefaultMaxBodyBytes
): unknown => {
  if (typeof value !== "string" || value.length === 0 || value.length > maxBodyBytes) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

export const decodeXhsControlledUploadNetworkResponseBody = (
  input: XhsControlledUploadNetworkBodyInput
): unknown => {
  const maxBodyBytes = input.maxBodyBytes ?? xhsControlledUploadCaptureDefaultMaxBodyBytes;
  if (typeof input.body !== "string" || input.body.length === 0) {
    return null;
  }
  if (input.body.length > maxBodyBytes) {
    return null;
  }
  if (input.base64Encoded === true) {
    if (typeof atob !== "function") {
      return null;
    }
    try {
      const decoded = atob(input.body);
      return parseXhsControlledUploadNetworkResponseBody(decoded, maxBodyBytes);
    } catch {
      return null;
    }
  }
  return parseXhsControlledUploadNetworkResponseBody(input.body, maxBodyBytes);
};

const trustedPlatformRefKeys = new Set([
  "upload_id",
  "uploadId",
  "media_id",
  "mediaId",
  "material_id",
  "materialId",
  "asset_id",
  "assetId",
  "file_id",
  "fileId",
  "fileid",
  "image_file_id",
  "imageFileId",
  "oss_id",
  "ossId",
  "image_id",
  "imageId"
]);

const normalizePlatformRefValue = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const normalized = String(value).trim();
  if (
    normalized.length < 6 ||
    normalized.length > 256 ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:") ||
    /^https?:\/\//iu.test(normalized)
  ) {
    return null;
  }
  return normalized;
};

const normalizeTrustedNoteIdValue = (value: unknown): string | null => {
  const normalized = normalizePlatformRefValue(value);
  if (!normalized || normalized.length < 8 || normalized.length > 64) {
    return null;
  }
  return normalized;
};

const findTrustedPlatformStagingRef = (value: unknown): string | null => {
  if (typeof value === "string") {
    for (const key of trustedPlatformRefKeys) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const match = new RegExp(`["']${escapedKey}["']\\s*:\\s*["']([^"']{6,256})["']`, "u").exec(value);
      const normalizedValue = normalizePlatformRefValue(match?.[1]);
      if (normalizedValue) {
        return `${key}:${normalizedValue}`;
      }
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findTrustedPlatformStagingRef(item);
      if (nested) {
        return nested;
      }
    }
    return null;
  }
  const record = asPlainRecord(value);
  if (!record) {
    return null;
  }
  for (const [key, item] of Object.entries(record)) {
    const normalizedValue = normalizePlatformRefValue(item);
    if (trustedPlatformRefKeys.has(key) && normalizedValue) {
      return `${key}:${normalizedValue}`;
    }
  }
  for (const item of Object.values(record)) {
    const nested = findTrustedPlatformStagingRef(item);
    if (nested) {
      return nested;
    }
  }
  return null;
};

const objectUploadTransportStagingRef = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (!isXhsControlledObjectUploadTransportHost(parsed.hostname)) {
      return null;
    }
    const path = parsed.pathname.trim();
    if (!/^\/spectrum\/[A-Za-z0-9_-]{32,256}$/u.test(path)) {
      return null;
    }
    return `object_upload:${parsed.hostname}${path}`;
  } catch {
    return null;
  }
};

export const extractXhsControlledUploadPlatformCapture = (
  input: XhsControlledUploadNetworkResponseInput
): XhsControlledUploadPlatformCapture | null => {
  if (
    input.status < 200 ||
    input.status >= 300 ||
    !isXhsControlledUploadPlatformCaptureUrl(input.url, input.method)
  ) {
    return null;
  }
  const objectUploadStagingRef = objectUploadTransportStagingRef(input.url);
  if (objectUploadStagingRef) {
    return {
      source: "chrome_debugger_network",
      platform_staging_ref: objectUploadStagingRef,
      evidence_basis: "object_upload_transport_2xx",
      url: input.url,
      method: input.method,
      status: input.status,
      captured_at: input.captured_at
    };
  }
  const platformStagingRef = findTrustedPlatformStagingRef(input.body);
  if (!platformStagingRef) {
    return null;
  }
  return {
    source: "chrome_debugger_network",
    platform_staging_ref: platformStagingRef,
    evidence_basis: "trusted_platform_response_body",
    url: input.url,
    method: input.method,
    status: input.status,
    captured_at: input.captured_at
  };
};

const trustedPublishResultEndpointPattern =
  /^\/(?:api|web_api)\/(?:creator\/publish\/result|galaxy\/(?:v\d+\/)?creator\/note\/user\/(?:post|publish))(?:[/?#]|$)/iu;

const trustedCreatorSubmitPublishEndpointPattern =
  /^\/(?:api|web_api)\/galaxy\/(?:v\d+\/)?creator\/note\/user\/(?:post|publish)(?:[/?#]|$)/iu;

const trustedCreatorSnsSubmitPublishEndpointPattern =
  /^\/api\/sns\/web\/v1\/note\/commit(?:[/?#]|$)/iu;

const noteIdFromTrustedHrefValue = (href: string): string | null => {
  const match =
    /[?&](?:note_id|noteId|source_note_id)=([A-Za-z0-9_-]{8,64})(?:&|$)/u.exec(href) ??
    /\/(?:explore|notes?|note|publish\/success)\/([A-Za-z0-9_-]{8,64})(?:[/?#]|$)/u.exec(href);
  return match?.[1] ?? null;
};

export const isXhsControlledPublishResultIdentityCaptureUrl = (url: string, method: string): boolean => {
  if (!/^(GET|POST)$/iu.test(method)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "creator.xiaohongshu.com") {
      return false;
    }
    if (
      trustedCreatorSubmitPublishEndpointPattern.test(parsed.pathname) ||
      trustedCreatorSnsSubmitPublishEndpointPattern.test(parsed.pathname)
    ) {
      return /^POST$/iu.test(method);
    }
    return trustedPublishResultEndpointPattern.test(parsed.pathname);
  } catch {
    return false;
  }
};

export const isXhsControlledPublishIdentityAdjacentWriteRequestUrl = (
  url: string,
  method: string
): boolean => {
  if (!/^(POST|PUT|PATCH)$/iu.test(method)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "creator.xiaohongshu.com") {
      return false;
    }
    return (
      /^\/(?:api|web_api)\//iu.test(parsed.pathname) &&
      /(?:creator|publish|note|sns|galaxy)/iu.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

export const isXhsControlledPublishIdentityDiagnosticRequestUrl = (
  url: string,
  method: string
): boolean => {
  if (!/^(GET|POST|PUT|PATCH)$/iu.test(method)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "creator.xiaohongshu.com" &&
      /^\/(?:api|web_api)\//iu.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

export const isXhsControlledPublishIdentityIgnoredDiagnosticRequestUrl = (
  url: string,
  method: string
): boolean => {
  if (!/^(GET|POST|PUT|PATCH)$/iu.test(method)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return (
      /(?:^|\.)xiaohongshu\.com$/iu.test(parsed.hostname) ||
      /(?:^|\.)xhscdn\.com$/iu.test(parsed.hostname)
    );
  } catch {
    return false;
  }
};

const isXhsControlledCreatorSubmitPublishCaptureUrl = (url: string, method: string): boolean => {
  if (!/^(GET|POST)$/iu.test(method)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "creator.xiaohongshu.com" &&
      (
        trustedCreatorSubmitPublishEndpointPattern.test(parsed.pathname) ||
        trustedCreatorSnsSubmitPublishEndpointPattern.test(parsed.pathname)
      )
    );
  } catch {
    return false;
  }
};

const noteIdFromTrustedPublishedUrl = (value: unknown): { noteId: string; url: string } | null => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const raw = value.trim();
  const maybeUrl = /^https?:\/\//iu.test(raw)
    ? raw
    : `https://www.xiaohongshu.com${raw.startsWith("/") ? raw : `/${raw}`}`;
  try {
    const parsed = new URL(maybeUrl);
    if (parsed.hostname !== "www.xiaohongshu.com") {
      return null;
    }
    const noteId = noteIdFromTrustedHrefValue(parsed.toString());
    return noteId ? { noteId, url: parsed.toString() } : null;
  } catch {
    return null;
  }
};

type PublishResultIdentityCaptureFields = Pick<
  XhsControlledPublishResultIdentityCapture,
  "result_kind" | "note_id" | "published_url" | "creator_result_url" | "platform_record_ref"
>;

const normalizeTrustedPublishVisibilityScope = (
  value: unknown
): XhsControlledPublishResultIdentityCapture["publish_visibility_scope"] => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (
    normalized === "private_or_self_visible" ||
    normalized === "private" ||
    normalized === "self" ||
    normalized === "self_visible" ||
    normalized === "only_me" ||
    normalized === "only_self" ||
    normalized === "one_self" ||
    normalized.includes("仅自己可见") ||
    normalized.includes("仅自己") ||
    normalized.includes("自己可见")
  ) {
    return "private_or_self_visible";
  }
  return null;
};

const trustedPublishVisibilityScopeKeys = new Set([
  "publish_visibility_scope",
  "publishVisibilityScope",
  "visibility_scope",
  "visibilityScope",
  "permission_scope",
  "permissionScope",
  "privacy_scope",
  "privacyScope",
  "visibility",
  "permission",
  "privacy",
  "visible_type",
  "visibleType",
  "permission_type",
  "permissionType"
]);

const findDirectTrustedPublishVisibilityScope = (
  record: JsonRecord
): XhsControlledPublishResultIdentityCapture["publish_visibility_scope"] => {
  for (const [key, nestedValue] of Object.entries(record)) {
    if (!trustedPublishVisibilityScopeKeys.has(key)) {
      continue;
    }
    const scope = normalizeTrustedPublishVisibilityScope(nestedValue);
    if (scope) {
      return scope;
    }
  }
  return null;
};

const normalizeTrustedPlatformPublishRecordRef = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9:_./-]{8,160}$/u.test(normalized)) {
    return null;
  }
  return normalized;
};

const findDirectTrustedPublishResultIdentity = (
  record: JsonRecord,
  allowUnboundPlatformRecordRef = false
): PublishResultIdentityCaptureFields | null => {
  for (const key of ["note_id", "noteId", "source_note_id", "sourceNoteId"]) {
    const noteId = normalizeTrustedNoteIdValue(record[key]);
    if (noteId) {
      return {
        result_kind: "note_id",
        note_id: noteId,
        published_url: `https://www.xiaohongshu.com/explore/${noteId}`,
        creator_result_url: null,
        platform_record_ref: null
      };
    }
  }
  for (const key of ["published_url", "publishedUrl", "note_url", "noteUrl", "detail_url", "detailUrl", "url", "href"]) {
    const published = noteIdFromTrustedPublishedUrl(record[key]);
    if (published) {
      return {
        result_kind: "published_url",
        note_id: published.noteId,
        published_url: published.url,
        creator_result_url: null,
        platform_record_ref: null
      };
    }
  }
  if (
    allowUnboundPlatformRecordRef ||
    findDirectTrustedPublishVisibilityScope(record) === "private_or_self_visible"
  ) {
    for (const key of [
      "platform_record_ref",
      "platformRecordRef",
      "publish_id",
      "publishId",
      "publish_record_id",
      "publishRecordId",
      "publish_task_id",
      "publishTaskId",
      "task_id",
      "taskId"
    ]) {
      const platformRecordRef = normalizeTrustedPlatformPublishRecordRef(record[key]);
      if (platformRecordRef) {
        return {
          result_kind: "platform_publish_record",
          note_id: null,
          published_url: null,
          creator_result_url: null,
          platform_record_ref: platformRecordRef
        };
      }
    }
  }
  return null;
};

const findTrustedCreatorSubmitDataIdIdentity = (
  value: unknown
): PublishResultIdentityCaptureFields | null => {
  const root = asPlainRecord(value);
  const data = asPlainRecord(root?.data);
  if (!data) {
    return null;
  }
  const noteId = normalizeTrustedNoteIdValue(data.id);
  if (!noteId) {
    return null;
  }
  return {
    result_kind: "note_id",
    note_id: noteId,
    published_url: `https://www.xiaohongshu.com/explore/${noteId}`,
    creator_result_url: null,
    platform_record_ref: null
  };
};

const samePublishResultIdentityCaptureFields = (
  left: PublishResultIdentityCaptureFields,
  right: PublishResultIdentityCaptureFields
): boolean => {
  const identityKey = (value: PublishResultIdentityCaptureFields): string => {
    if (value.note_id) {
      return `note:${value.note_id}`;
    }
    const published = noteIdFromTrustedPublishedUrl(value.published_url);
    if (published) {
      return `note:${published.noteId}`;
    }
    if (value.creator_result_url) {
      const noteId = noteIdFromTrustedHrefValue(value.creator_result_url);
      return noteId ? `note:${noteId}` : `creator_result_url:${value.creator_result_url}`;
    }
    if (value.platform_record_ref) {
      return `platform_record_ref:${value.platform_record_ref}`;
    }
    return "missing";
  };
  return identityKey(left) === identityKey(right);
};

const collectTrustedPublishResultIdentities = (
  value: unknown,
  output: PublishResultIdentityCaptureFields[],
  allowUnboundPlatformRecordRef = false,
  seen = new Set<object>()
): void => {
  if (typeof value === "string") {
    const published = noteIdFromTrustedPublishedUrl(value);
    if (published) {
      output.push({
        result_kind: "published_url",
        note_id: published.noteId,
        published_url: published.url,
        creator_result_url: null,
        platform_record_ref: null
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTrustedPublishResultIdentities(item, output, allowUnboundPlatformRecordRef, seen);
    }
    return;
  }
  const record = asPlainRecord(value);
  if (!record || seen.has(record)) {
    return;
  }
  seen.add(record);
  const directIdentity = findDirectTrustedPublishResultIdentity(record, allowUnboundPlatformRecordRef);
  if (directIdentity) {
    output.push(directIdentity);
  }
  for (const item of Object.values(record)) {
    collectTrustedPublishResultIdentities(item, output, allowUnboundPlatformRecordRef, seen);
  }
};

const resolveUniqueTrustedPublishResultIdentity = (
  value: unknown,
  allowUnboundPlatformRecordRef = false
): PublishResultIdentityCaptureFields | null => {
  const resolveUniqueIdentity = (
    identities: PublishResultIdentityCaptureFields[]
  ): PublishResultIdentityCaptureFields | null => {
    let match: PublishResultIdentityCaptureFields | null = null;
    for (const identity of identities) {
      if (!match) {
        match = identity;
        continue;
      }
      if (!samePublishResultIdentityCaptureFields(match, identity)) {
        return null;
      }
    }
    return match;
  };
  const primaryIdentities: PublishResultIdentityCaptureFields[] = [];
  const submitDataIdIdentity = allowUnboundPlatformRecordRef
    ? findTrustedCreatorSubmitDataIdIdentity(value)
    : null;
  if (submitDataIdIdentity) {
    primaryIdentities.push(submitDataIdIdentity);
  }
  collectTrustedPublishResultIdentities(value, primaryIdentities, false);
  const primaryMatch = resolveUniqueIdentity(primaryIdentities);
  if (primaryMatch || primaryIdentities.length > 0) {
    return primaryMatch;
  }
  if (!allowUnboundPlatformRecordRef) {
    return null;
  }
  const fallbackIdentities: PublishResultIdentityCaptureFields[] = [];
  collectTrustedPublishResultIdentities(value, fallbackIdentities, true);
  return resolveUniqueIdentity(fallbackIdentities);
};

const findTrustedPublishVisibilityScope = (
  value: unknown,
  seen = new Set<object>()
): XhsControlledPublishResultIdentityCapture["publish_visibility_scope"] => {
  if (Array.isArray(value)) {
    let match: XhsControlledPublishResultIdentityCapture["publish_visibility_scope"] = null;
    for (const item of value) {
      const nested = findTrustedPublishVisibilityScope(item, seen);
      if (!nested) {
        continue;
      }
      if (match && match !== nested) {
        return null;
      }
      match = nested;
    }
    return match;
  }
  const record = asPlainRecord(value);
  if (!record || seen.has(record)) {
    return null;
  }
  seen.add(record);
  for (const [key, nestedValue] of Object.entries(record)) {
    if (!trustedPublishVisibilityScopeKeys.has(key)) {
      continue;
    }
    const scope = normalizeTrustedPublishVisibilityScope(nestedValue);
    if (scope) {
      return scope;
    }
  }
  for (const item of Object.values(record)) {
    const nested = findTrustedPublishVisibilityScope(item, seen);
    if (nested) {
      return nested;
    }
  }
  return null;
};

type BoundPublishResultIdentityCaptureFields = PublishResultIdentityCaptureFields & {
  publish_visibility_scope: "private_or_self_visible";
  publish_visibility_proof_locator: string;
};

const findTrustedBoundPublishResultIdentity = (
  value: unknown,
  locator = "$",
  seen = new Set<object>()
): BoundPublishResultIdentityCaptureFields | null => {
  if (Array.isArray(value)) {
    let match: BoundPublishResultIdentityCaptureFields | null = null;
    for (let index = 0; index < value.length; index += 1) {
      const nested = findTrustedBoundPublishResultIdentity(value[index], `${locator}[${index}]`, seen);
      if (!nested) {
        continue;
      }
      if (match && JSON.stringify(match) !== JSON.stringify(nested)) {
        return null;
      }
      match = nested;
    }
    return match;
  }
  const record = asPlainRecord(value);
  if (!record || seen.has(record)) {
    return null;
  }
  seen.add(record);
  const directIdentity = findDirectTrustedPublishResultIdentity(record);
  const directVisibilityScope = findDirectTrustedPublishVisibilityScope(record);
  if (directIdentity && directVisibilityScope === "private_or_self_visible") {
    return {
      ...directIdentity,
      publish_visibility_scope: directVisibilityScope,
      publish_visibility_proof_locator: locator
    };
  }
  let match: BoundPublishResultIdentityCaptureFields | null = null;
  for (const [key, item] of Object.entries(record)) {
    const nested = findTrustedBoundPublishResultIdentity(item, `${locator}.${key}`, seen);
    if (!nested) {
      continue;
    }
    if (match && JSON.stringify(match) !== JSON.stringify(nested)) {
      return null;
    }
    match = nested;
  }
  return match;
};

export const extractXhsControlledPublishResultIdentityCapture = (
  input: XhsControlledUploadNetworkResponseInput
): XhsControlledPublishResultIdentityCapture | null => {
  if (
    input.status < 200 ||
    input.status >= 300 ||
    !isXhsControlledPublishResultIdentityCaptureUrl(input.url, input.method)
  ) {
    return null;
  }
  const identity = resolveUniqueTrustedPublishResultIdentity(
    input.body,
    isXhsControlledCreatorSubmitPublishCaptureUrl(input.url, input.method)
  );
  if (!identity) {
    return null;
  }
  const boundIdentity = findTrustedBoundPublishResultIdentity(input.body);
  if (boundIdentity && !samePublishResultIdentityCaptureFields(identity, boundIdentity)) {
    return null;
  }
  const publishVisibilityScope = boundIdentity?.publish_visibility_scope ?? null;
  return {
    source: "chrome_debugger_network",
    evidence_basis: "trusted_platform_response_body",
    ...identity,
    publish_visibility_scope: publishVisibilityScope,
    publish_visibility_proof_locator: boundIdentity?.publish_visibility_proof_locator ?? null,
    url: input.url,
    method: input.method,
    status: input.status,
    captured_at: input.captured_at
  };
};

export const summarizeXhsControlledPublishIdentityObservedRequest = (
  input: {
    url: string;
    method: string;
    status?: number | null;
    reason?: string | null;
    captureCandidate?: boolean;
    rejectionReason?: string | null;
  }
): JsonRecord => {
  const output: JsonRecord = {
    method: input.method,
    status: typeof input.status === "number" ? input.status : null,
    reason: input.reason ?? null
  };
  if (typeof input.captureCandidate === "boolean") {
    output.capture_candidate = input.captureCandidate;
  }
  if (input.rejectionReason) {
    output.rejection_reason = input.rejectionReason;
    output.body_values_recorded = false;
    output.body_recording_policy = "shape_only";
  }
  try {
    const parsed = new URL(input.url);
    output.host = parsed.hostname;
    output.path = parsed.pathname;
  } catch {
    output.host = "unparseable";
    output.path = "unparseable";
  }
  return output;
};

const sourceMediaKind = (value: string): "image" | "video" | "mixed" =>
  value === "video" || value === "mixed" ? value : "image";

const acceptedUploadArtifactResumeBlockedInput = (
  detailsRef: string
): UploadBlockedInput => ({
  blockerCode: "ACCEPTED_UPLOAD_ARTIFACT_RESUME_INVALID",
  blockerMessage:
    "Controlled submit/publish resume requires a current accepted upload artifact identity bound to this request.",
  detailsRef,
  requiredRecoveryAction:
    "provide a current accepted_upload_artifact_identity matching source media, profile, target and latest-head lineage before submit/publish resume"
});

const validateAcceptedUploadArtifactResume = (
  input: XhsControlledLiveWriteInput,
  artifact: ControlledUploadArtifactIdentity
): UploadBlockedInput | null => {
  const artifactRecord = asPlainRecord(artifact) ?? {};
  if (!/^upload-artifact\/fr-0032\//u.test(artifact.upload_artifact_id)) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_id_invalid");
  }
  if (artifact.source_media_ref !== input.source_media_ref) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_source_ref_mismatch");
  }
  if (artifact.source_media_digest !== input.source_media_digest) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_digest_mismatch");
  }
  if (artifact.source_media_kind !== sourceMediaKind(input.source_media_kind)) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_kind_mismatch");
  }
  if (artifact.accepted_by_platform !== true || artifact.visible_in_editor !== true) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_not_ready");
  }
  if (typeof artifact.captured_at !== "string" || artifact.captured_at.trim().length === 0) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_captured_at_invalid");
  }
  if (!Object.prototype.hasOwnProperty.call(artifactRecord, "platform_staging_ref")) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_platform_ref_missing");
  }
  if (
    artifact.platform_staging_ref !== null &&
    (typeof artifact.platform_staging_ref !== "string" ||
      artifact.platform_staging_ref.trim().length === 0)
  ) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_platform_ref_invalid");
  }
  const artifactProfileRef = artifactRecord.profile_ref;
  if (
    typeof artifactProfileRef === "string" &&
    input.profile_ref !== null &&
    artifactProfileRef !== input.profile_ref
  ) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_profile_mismatch");
  }
  const artifactTargetTabId = artifactRecord.target_tab_id;
  if (
    typeof artifactTargetTabId === "number" &&
    Number.isInteger(artifactTargetTabId) &&
    input.target_tab_id !== null &&
    artifactTargetTabId !== input.target_tab_id
  ) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_target_tab_mismatch");
  }
  const artifactTargetPage = artifactRecord.target_page;
  if (typeof artifactTargetPage === "string" && artifactTargetPage !== "creator_publish_tab") {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_target_page_mismatch");
  }
  const artifactLatestHeadSha = artifactRecord.latest_head_sha;
  if (
    typeof artifactLatestHeadSha === "string" &&
    typeof input.latest_head_sha === "string" &&
    input.latest_head_sha.length > 0 &&
    artifactLatestHeadSha !== input.latest_head_sha
  ) {
    return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_head_mismatch");
  }
  return null;
};

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

const imageAcceptTokenPattern = /(^|\W)(image\/|\*\/\*|\*|\.jpe?g|\.png|\.webp|\.gif|\.bmp|\.heic|\.heif)(\W|$)/iu;

const acceptsImageMedia = (accept: string | null | undefined): boolean => {
  const normalized = (accept ?? "").trim();
  if (normalized.length === 0) {
    return false;
  }
  return normalized
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .some((token) => imageAcceptTokenPattern.test(token));
};

const collectUploadFileInputs = (): HTMLInputElement[] => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
};

const findUploadFileInput = (inputs: HTMLInputElement[]): HTMLInputElement | null => {
  return inputs.find((input) => !input.disabled && acceptsImageMedia(input.accept)) ?? null;
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

const textContentOf = (element: Element): string =>
  (element.textContent ?? "").trim().replace(/\s+/g, " ");

const formControlValueSignal = (element: Element): string =>
  [
    getElementAttribute(element, "value"),
    "value" in element && typeof element.value === "string" ? element.value : null,
    getElementAttribute(element, "placeholder")
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

const elementTextSignal = (element: Element): string =>
  [
    getElementAttribute(element, "data-testid"),
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    getElementAttribute(element, "role"),
    getElementAttribute(element, "class"),
    formControlValueSignal(element),
    textContentOf(element)
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

const elementDisplayedTextSignal = (element: Element): string =>
  [
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    formControlValueSignal(element),
    textContentOf(element)
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

const elementDescendantDisplayedTextSignal = (element: Element): string => {
  if (typeof element.querySelectorAll !== "function") {
    return "";
  }
  return Array.from(element.querySelectorAll("*"))
    .map((descendant) => elementDisplayedTextSignal(descendant))
    .filter((value) => value.trim().length > 0)
    .slice(0, 6)
    .join(" ");
};

const elementVisibleTextSignal = (element: Element): string =>
  [
    elementDisplayedTextSignal(element),
    elementDescendantDisplayedTextSignal(element)
  ]
    .filter((value) => value.trim().length > 0)
    .join(" ");

const isDisabledElement = (element: HTMLElement): boolean =>
  (element as HTMLButtonElement).disabled === true ||
  getElementAttribute(element, "aria-disabled") === "true" ||
  getElementAttribute(element, "disabled") !== null;

const findVisibleElementMatchingText = (
  selector: string,
  include: RegExp,
  exclude?: RegExp
): HTMLElement | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  return (
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
      const signal = elementTextSignal(element);
      return (
        isVisibleElement(element) &&
        !isDisabledElement(element) &&
        include.test(signal) &&
        !(exclude?.test(signal) ?? false)
      );
    }) ?? null
  );
};

const imageModeTextPattern = /上传图文|图文|图片|image|photo/iu;
const imageModeHrefPattern = /(?:[?&]target=image(?:&|$)|target%3Dimage)/iu;
const nonImageModeTextPattern = /上传视频|视频|video/iu;

const imageModeSignalForElement = (element: HTMLElement): string =>
  [
    getElementAttribute(element, "href"),
    getElementAttribute(element, "data-testid"),
    getElementAttribute(element, "data-test"),
    getElementAttribute(element, "data-target"),
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    getElementAttribute(element, "role"),
    getElementAttribute(element, "class"),
    textContentOf(element)
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

const imageModeCandidateScore = (element: HTMLElement): number => {
  const signal = imageModeSignalForElement(element);
  const href = getElementAttribute(element, "href") ?? "";
  const text = textContentOf(element);
  const exactImageModeSignal =
    imageModeTextPattern.test(signal) && !nonImageModeTextPattern.test(signal);
  const mixedImageVideoContainer =
    imageModeTextPattern.test(signal) && nonImageModeTextPattern.test(signal);
  const textLengthPenalty = Math.min(Math.floor(text.length / 12), 8);
  if (imageModeHrefPattern.test(href)) {
    return 0;
  }
  if (element.getAttribute("role") === "tab" && exactImageModeSignal) {
    return 1 + textLengthPenalty;
  }
  if (element.tagName.toUpperCase() === "BUTTON" && exactImageModeSignal) {
    return 2 + textLengthPenalty;
  }
  if (exactImageModeSignal) {
    return 3 + textLengthPenalty;
  }
  return mixedImageVideoContainer ? 20 + textLengthPenalty : 30 + textLengthPenalty;
};

const selectImagePublishMode = async (): Promise<void> => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return;
  }
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        'a[href*="target=image" i]',
        '[href*="target=image" i]',
        '[data-target*="image" i]',
        '[data-testid*="image" i]',
        '[data-testid*="photo" i]',
        '[data-testid*="图文" i]',
        '[aria-label*="图文" i]',
        '[aria-label*="图片" i]',
        '[title*="图文" i]',
        '[title*="图片" i]',
        "button",
        '[role="tab"]',
        '[role="menuitem"]',
        '[class*="tab" i]',
        '[class*="publish" i]'
      ].join(",")
    )
  );
  const imageMode = candidates
    .filter((element) => {
      const signal = imageModeSignalForElement(element);
      return isVisibleElement(element) && imageModeTextPattern.test(signal) && typeof element.click === "function";
    })
    .sort((left, right) => imageModeCandidateScore(left) - imageModeCandidateScore(right))[0];
  if (!imageMode) {
    return;
  }
  imageMode.click();
  await sleep(800);
};

const uploadIntentTextPattern = /上传|图片|图文|素材|拖拽|点击上传|upload|image|media|photo/iu;
const nonUploadClassPattern = /dropdown|drop-down|drop_shadow|drop-shadow|backdrop/iu;

const hasUploadIntentSignal = (element: HTMLElement): boolean => {
  const signalText = [
    element.getAttribute("data-testid"),
    element.getAttribute("data-test"),
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.className,
    textContentOf(element)
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  return uploadIntentTextPattern.test(signalText) && !nonUploadClassPattern.test(signalText);
};

const isPotentialDropzoneTarget = (element: HTMLElement): boolean =>
  !["IMG", "VIDEO", "SVG", "CANVAS"].includes(element.tagName.toUpperCase());

const findUploadDropzone = (): HTMLElement | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        '[data-testid*="upload" i]',
        '[class*="upload" i]',
        '[aria-label*="上传" i]',
        '[aria-label*="upload" i]',
        '[title*="上传" i]',
        '[title*="upload" i]'
      ].join(",")
    )
  );
  return (
    candidates.find(
      (element) => isPotentialDropzoneTarget(element) && isVisibleElement(element) && hasUploadIntentSignal(element)
    ) ?? null
  );
};

type EditorPreviewEvidence = {
  locator: string;
  platformStagingRef: string | null;
  acceptedByPlatform: boolean;
  diagnostics: EditorPreviewDiagnostics;
};

const uploadPlaceholderPattern = /upload[-_ ]?icon|upload[-_ ]?btn|placeholder|empty|add[-_ ]?(image|photo|media)|点击上传|上传图片|upload image|upload photo/iu;
const uploadCompleteTextPattern = /上传完成|上传成功|上传完毕|处理完成|已上传|upload(ed)? complete|upload(ed)? success|done|complete/iu;
const uploadPendingTextPattern = /上传中|处理中|加载中|转码中|uploading|processing|loading|progress/iu;
const uploadFailureTextPattern = /上传失败|上传错误|重新上传|upload failed|upload error|retry upload/iu;
const platformStagingAttributeNames = [
  "data-upload-id",
  "data-media-id",
  "data-material-id",
  "data-asset-id",
  "data-file-id",
  "data-oss-id",
  "data-image-id"
] as const;

const locatorForElement = (element: Element): string => {
  if (element.id) {
    return `#${element.id}`;
  }
  const className = Array.from(element.classList ?? []).find((item) => item.trim().length > 0);
  return className ? `${element.tagName.toLowerCase()}.${className}` : element.tagName.toLowerCase();
};

const getElementAttribute = (element: Element, name: string): string | null =>
  typeof element.getAttribute === "function" ? element.getAttribute(name) : null;

const signalTextForElement = (element: Element): string =>
  [
    element.id,
    getElementAttribute(element, "class"),
    getElementAttribute(element, "style"),
    getElementAttribute(element, "src"),
    getElementAttribute(element, "alt"),
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    element instanceof HTMLElement ? getComputedStyle(element).backgroundImage : null,
    textContentOf(element)
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

const isUploadPlaceholderPreview = (element: Element): boolean =>
  uploadPlaceholderPattern.test(signalTextForElement(element));

const ancestorSignalTextForElement = (element: Element, maxDepth = 3): string => {
  const parts = [signalTextForElement(element)];
  let current = element.parentElement;
  let depth = 0;
  while (current && depth < maxDepth) {
    parts.push(signalTextForElement(current));
    current = current.parentElement;
    depth += 1;
  }
  return parts.join(" ");
};

const platformStagingRefForElementOnly = (element: Element): string | null => {
  for (const attributeName of platformStagingAttributeNames) {
    const value = getElementAttribute(element, attributeName);
    if (!value) {
      continue;
    }
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.startsWith("blob:") || normalized.startsWith("data:")) {
      continue;
    }
    return `${attributeName}:${normalized}`;
  }
  return null;
};

const platformStagingRefForElement = (element: Element, maxDepth = 3): string | null => {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth <= maxDepth) {
    const stagingRef = platformStagingRefForElementOnly(current);
    if (stagingRef) {
      return stagingRef;
    }
    current = current.parentElement;
    depth += 1;
  }
  return null;
};

const srcKindForElement = (element: Element): EditorPreviewAttributeDiagnostics["src_kind"] => {
  const src = getElementAttribute(element, "src") ?? getElementAttribute(element, "poster");
  if (!src) {
    return null;
  }
  if (src.startsWith("blob:")) {
    return "blob";
  }
  if (src.startsWith("data:")) {
    return "data";
  }
  if (/^https?:\/\//iu.test(src)) {
    return "remote";
  }
  return "other";
};

const attributeNamesForElement = (element: Element): string[] => {
  const attributes = element.attributes;
  if (!attributes) {
    return [];
  }
  const names: string[] = [];
  for (let index = 0; index < attributes.length; index += 1) {
    const attribute = attributes.item(index);
    if (attribute?.name) {
      names.push(attribute.name);
    }
  }
  return names.sort();
};

const previewAttributeDiagnosticsForElement = (
  element: Element,
  depth: number
): EditorPreviewAttributeDiagnostics => {
  const attributeNames = attributeNamesForElement(element);
  return {
    depth,
    tag_name: element.tagName.toLowerCase(),
    locator: locatorForElement(element),
    attribute_names: attributeNames.slice(0, 40),
    data_attribute_names: attributeNames.filter((name) => name.startsWith("data-")).slice(0, 40),
    platform_ref_attribute_names: platformStagingAttributeNames.filter(
      (attributeName) => getElementAttribute(element, attributeName) !== null
    ),
    src_kind: srcKindForElement(element),
    has_upload_completion_signal: hasUploadCompletionSignal(element),
    has_upload_pending_signal: uploadPendingTextPattern.test(ancestorSignalTextForElement(element, 0)),
    has_upload_failure_signal: uploadFailureTextPattern.test(ancestorSignalTextForElement(element, 0))
  };
};

const previewDiagnosticsForElement = (element: Element, maxDepth = 3): EditorPreviewDiagnostics => {
  const chain: EditorPreviewAttributeDiagnostics[] = [];
  let current: Element | null = element;
  let depth = 0;
  while (current && depth <= maxDepth) {
    chain.push(previewAttributeDiagnosticsForElement(current, depth));
    current = current.parentElement;
    depth += 1;
  }
  return {
    schema_version: "fr-0032.preview_dom_diagnostics.v1",
    values_recorded: false,
    recording_policy: "attribute_names_and_signal_flags_only",
    preview_chain: chain
  };
};

const hasUploadCompletionSignal = (element: Element): boolean => {
  const text = ancestorSignalTextForElement(element);
  return (
    uploadCompleteTextPattern.test(text) &&
    !uploadPendingTextPattern.test(text) &&
    !uploadFailureTextPattern.test(text)
  );
};

const evidenceForPreviewElement = (preview: Element): EditorPreviewEvidence => {
  const hasCompletionSignal = hasUploadCompletionSignal(preview);
  const platformStagingRef = hasCompletionSignal ? platformStagingRefForElement(preview) : null;
  return {
    locator: locatorForElement(preview),
    platformStagingRef,
    acceptedByPlatform: platformStagingRef !== null,
    diagnostics: previewDiagnosticsForElement(preview)
  };
};

const editorPreviewSelector = [
  'img[src^="blob:"]',
  'img[src^="data:image/"]',
  'img[src^="http://"]',
  'img[src^="https://"]',
  'video[src^="blob:"]',
  'video[src^="http://"]',
  'video[src^="https://"]',
  '[class*="preview" i] img',
  '[class*="cover" i] img',
  '[class*="media" i] img',
  '[style*="background-image" i]',
  '[class*="preview" i]',
  '[class*="cover" i]',
  '[class*="media" i]'
].join(",");

const previewSignatureForElement = (element: Element): string =>
  [
    element.tagName.toLowerCase(),
    locatorForElement(element),
    getElementAttribute(element, "src") ?? "",
    getElementAttribute(element, "style") ?? "",
    getElementAttribute(element, "data-upload-id") ?? "",
    getElementAttribute(element, "data-media-id") ?? "",
    getElementAttribute(element, "data-material-id") ?? "",
    getElementAttribute(element, "data-asset-id") ?? "",
    getElementAttribute(element, "data-file-id") ?? "",
    getElementAttribute(element, "data-oss-id") ?? ""
  ].join("|");

const collectEditorPreviewSignatures = (): Set<string> => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return new Set();
  }
  return new Set(
    Array.from(document.querySelectorAll<HTMLElement>(editorPreviewSelector))
      .filter((element) => isVisibleElement(element) && !isUploadPlaceholderPreview(element))
      .map(previewSignatureForElement)
  );
};

const findEditorPreviewEvidence = (previousSignatures: Set<string>): EditorPreviewEvidence | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  const preview = Array.from(
    document.querySelectorAll<HTMLElement>(editorPreviewSelector)
  ).find(
    (element) =>
      isVisibleElement(element) &&
      !isUploadPlaceholderPreview(element) &&
      !previousSignatures.has(previewSignatureForElement(element))
  );
  if (!preview) {
    return null;
  }
  return evidenceForPreviewElement(preview);
};

const waitForEditorPreviewEvidence = async (
  previousSignatures: Set<string>,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
  } = {}
): Promise<EditorPreviewEvidence | null> => {
  const isExtensionBrowserSurface =
    typeof window !== "undefined" &&
    typeof window.document !== "undefined" &&
    "chrome" in globalThis;
  const timeoutMs = options.timeoutMs ?? (isExtensionBrowserSurface ? 10_000 : 50);
  const intervalMs = options.intervalMs ?? (isExtensionBrowserSurface ? 500 : 10);
  const deadline = Date.now() + timeoutMs;
  let latestVisiblePreview: EditorPreviewEvidence | null = null;
  do {
    const previewEvidence = findEditorPreviewEvidence(previousSignatures);
    if (previewEvidence) {
      latestVisiblePreview = previewEvidence;
      if (previewEvidence.acceptedByPlatform) {
        return previewEvidence;
      }
    }
    if (Date.now() >= deadline) {
      break;
    }
    await sleep(intervalMs);
  } while (true);
  return latestVisiblePreview;
};

const uploadPreviewWaitOptions = (
  stage: "file_input" | "dropzone"
): { timeoutMs?: number; intervalMs?: number } => {
  const isExtensionBrowserSurface =
    typeof window !== "undefined" &&
    typeof window.document !== "undefined" &&
    "chrome" in globalThis;
  if (!isExtensionBrowserSurface) {
    return {};
  }
  return {
    timeoutMs: stage === "file_input" ? 8_000 : 3_000,
    intervalMs: 500
  };
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

const createControlledDragEvent = (
  type: "dragenter" | "dragover" | "drop",
  transfer: DataTransfer
): Event => {
  if (typeof DragEvent === "function") {
    return new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer
    });
  }
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: transfer
  });
  return event;
};

const dispatchDropzoneUpload = (dropzone: HTMLElement, file: File): UploadBlockedInput | null => {
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
    for (const eventName of ["dragenter", "dragover", "drop"] as const) {
      dropzone.dispatchEvent(createControlledDragEvent(eventName, transfer));
    }
    return null;
  } catch {
    return {
      blockerCode: "DROPZONE_UPLOAD_DISPATCH_FAILED",
      blockerMessage: "Controlled live upload cannot dispatch the approved media file to the page dropzone.",
      detailsRef: "dropzone_upload_dispatch_failed",
      requiredRecoveryAction:
        "provide a page-compatible controlled dropzone upload executor for the current creator UI"
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
      captured_at: timestamp,
      preview_diagnostics: null
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
      captured_at: timestamp,
      preview_diagnostics: null
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
  artifact: ControlledUploadArtifactIdentity | null
): XhsControlledLiveWriteResult => {
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

export const applyXhsControlledUploadPlatformCapture = (
  result: XhsControlledLiveWriteResult,
  capture: XhsControlledUploadPlatformCapture | null
): XhsControlledLiveWriteResult => {
  if (!capture) {
    return result;
  }
  const evidence = result.live_write_evidence;
  const uploadArtifact = evidence.upload_artifact_identity as ControlledUploadArtifactIdentity | null;
  if (!uploadArtifact || uploadArtifact.accepted_by_platform === true) {
    return result;
  }
  if (
    capture.evidence_basis === "object_upload_transport_2xx" &&
    (uploadArtifact.visible_in_editor !== true || !uploadArtifact.page_preview_locator)
  ) {
    return result;
  }
  const timestamp = nowIso();
  const acceptedArtifact = {
    ...uploadArtifact,
    platform_staging_ref: capture.platform_staging_ref,
    accepted_by_platform: true,
    captured_at: capture.captured_at
  };
  const stopSignal = evidence.stop_signal as JsonRecord | null;
  const nextStopSignal = stopSignal
    ? {
        ...stopSignal,
        stop_signal_id: `stop/fr-0032/${String(evidence.live_write_attempt_id ?? "unknown")}/submit-unavailable`,
        stopped_step: "submit",
        blocker_layer: "submit",
        blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
        cleanup_required: true,
        required_recovery_action:
          "provide a submit/publish executor and cleanup policy executor before continuing after upload"
      }
    : null;
  const nextEvidence = {
    ...evidence,
    execution_phase: "submit",
    stop_classification: {
      ...((evidence.stop_classification as JsonRecord | undefined) ?? {}),
      category: "submit_blocked",
      evaluation_state: "stopped",
      stop_reason: "submit_executor_unavailable"
    },
    upload_artifact_identity: acceptedArtifact,
    platform_upload_acceptance_capture: capture,
    risk_signals: [
      {
        risk_signal_id: `risk/fr-0032/${String(evidence.live_write_attempt_id ?? "unknown")}/submit-unavailable`,
        detected_at: timestamp,
        source: "submit",
        kind: "submit_failure",
        severity: "blocking",
        details_ref: "submit_executor_unavailable"
      }
    ],
    stop_signal: nextStopSignal,
    updated_at: timestamp
  };
  return {
    ...result,
    live_write_evidence: nextEvidence,
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

export const applyXhsControlledPublishResultIdentityCapture = (
  result: XhsControlledLiveWriteResult,
  capture: XhsControlledPublishResultIdentityCapture | null
): XhsControlledLiveWriteResult => {
  if (!capture) {
    return result;
  }
  const evidence = result.live_write_evidence;
  if (evidence.publish_result_identity) {
    return result;
  }
  const evaluation = result.live_write_evaluation;
  const blockers = Array.isArray(evaluation.blockers) ? evaluation.blockers : [];
  const publishIdentityMissing = blockers.some((blocker) => {
    const record = asPlainRecord(blocker);
    return (
      record?.blocker_code === "PUBLISH_RESULT_IDENTITY_MISSING" &&
      record?.blocker_layer === "published_identity"
    );
  });
  const uploadArtifact = asPlainRecord(evidence.upload_artifact_identity);
  const submitEvidence = asPlainRecord(evidence.submit_evidence);
  if (
    result.uploaded !== true ||
    result.submitted !== true ||
    publishIdentityMissing !== true ||
    !uploadArtifact ||
    !submitEvidence ||
    uploadArtifact.accepted_by_platform !== true
  ) {
    return result;
  }
  const timestamp = nowIso();
  return {
    ...result,
    live_write_evidence: {
      ...evidence,
      publish_result_identity_capture: capture,
      updated_at: timestamp
    }
  };
};

const resolvePrivatePublishVisibilityProofLocator = (
  evidence: JsonRecord,
  capture: XhsControlledPublishResultIdentityCapture
): string | null => {
  if (
    capture.publish_visibility_scope === "private_or_self_visible" &&
    typeof capture.publish_visibility_proof_locator === "string" &&
    capture.publish_visibility_proof_locator.trim().length > 0
  ) {
    return capture.publish_visibility_proof_locator.trim();
  }
  const cleanupResult = asPlainRecord(evidence.cleanup_result);
  const residualRecord =
    asPlainRecord(evidence.residual_record) ?? asPlainRecord(cleanupResult?.residual_record);
  const stopClassification = asPlainRecord(evidence.stop_classification);
  const visibilityScope =
    normalizeTrustedPublishVisibilityScope(residualRecord?.visibility_scope) ??
    normalizeTrustedPublishVisibilityScope(stopClassification?.publish_visibility_scope);
  const cleanupProofLocator =
    typeof cleanupResult?.proof_locator === "string" && cleanupResult.proof_locator.trim().length > 0
      ? cleanupResult.proof_locator.trim()
      : null;
  return visibilityScope === "private_or_self_visible" ? cleanupProofLocator : null;
};

export const finalizeXhsControlledPublishResultIdentityCapture = (
  result: XhsControlledLiveWriteResult,
  capture: XhsControlledPublishResultIdentityCapture | null
): XhsControlledLiveWriteResult => {
  const captured = applyXhsControlledPublishResultIdentityCapture(result, capture);
  if (!capture || captured.live_write_evidence.publish_result_identity) {
    return captured;
  }
  const visibilityProofLocator = resolvePrivatePublishVisibilityProofLocator(
    captured.live_write_evidence,
    capture
  );
  if (!visibilityProofLocator) {
    return captured;
  }
  const evidence = captured.live_write_evidence;
  const evaluation = captured.live_write_evaluation;
  const blockers = Array.isArray(evaluation.blockers) ? evaluation.blockers : [];
  const hasOnlyPublishIdentityMissingBlockers =
    blockers.length > 0 &&
    blockers.every((blocker) => {
      const record = asPlainRecord(blocker);
      return (
        record?.blocker_code === "PUBLISH_RESULT_IDENTITY_MISSING" &&
        record?.blocker_layer === "published_identity"
      );
    });
  const riskSignals = Array.isArray(evidence.risk_signals) ? evidence.risk_signals : [];
  const hasOnlyPublishIdentityMissingRiskSignals = riskSignals.every((riskSignal) => {
    const record = asPlainRecord(riskSignal);
    return (
      record?.kind === "publish_identity_missing" ||
      record?.blocker_code === "PUBLISH_RESULT_IDENTITY_MISSING"
    );
  });
  const uploadArtifact = asPlainRecord(evidence.upload_artifact_identity);
  const submitEvidence = asPlainRecord(evidence.submit_evidence);
  if (
    captured.uploaded !== true ||
    captured.submitted !== true ||
    hasOnlyPublishIdentityMissingBlockers !== true ||
    hasOnlyPublishIdentityMissingRiskSignals !== true ||
    !uploadArtifact ||
    !submitEvidence ||
    uploadArtifact.accepted_by_platform !== true
  ) {
    return captured;
  }
  const scope = asPlainRecord(evidence.scope);
  const nonEmptyString = (value: unknown): string | null =>
    typeof value === "string" && value.trim().length > 0 ? value : null;
  const liveWriteAttemptId = nonEmptyString(evidence.live_write_attempt_id);
  const runId = nonEmptyString(scope?.run_id);
  const profileRef = nonEmptyString(scope?.profile_ref);
  const targetTabId = scope?.target_tab_id;
  const uploadArtifactId = nonEmptyString(uploadArtifact.upload_artifact_id);
  const submitActionRef = nonEmptyString(submitEvidence.submit_action_ref);
  const submittedAt = nonEmptyString(submitEvidence.submitted_at);
  const submitCapturedAtMs = submittedAt ? Date.parse(submittedAt) : Number.NaN;
  const publishCapturedAtMs = Date.parse(capture.captured_at);
  if (
    !liveWriteAttemptId ||
    !runId ||
    !profileRef ||
    typeof targetTabId !== "number" ||
    !Number.isInteger(targetTabId) ||
    targetTabId < 0 ||
    !uploadArtifactId ||
    !submitActionRef ||
    !Number.isFinite(submitCapturedAtMs) ||
    !Number.isFinite(publishCapturedAtMs) ||
    publishCapturedAtMs < submitCapturedAtMs
  ) {
    return captured;
  }
  const previousCleanup = asPlainRecord(evidence.cleanup_result);
  const cleanupPolicyRef = String(
    previousCleanup?.cleanup_policy_ref ?? "fr0032-cleanup-policy/delete-or-residual"
  );
  const closedAt = nowIso();
  const publishIdentity: PublishResultIdentity = {
    schema_version: "fr-0032.publish_result_identity.v1",
    publish_result_id: `publish-result/fr-0032/${liveWriteAttemptId}`,
    live_write_attempt_id: liveWriteAttemptId,
    run_id: runId,
    profile_ref: profileRef,
    target_tab_id: targetTabId,
    target_domain: "creator.xiaohongshu.com",
    target_page: "creator_publish_tab",
    source_upload_artifact_id: uploadArtifactId,
    submit_action_ref: submitActionRef,
    result_kind: capture.result_kind,
    note_id: capture.note_id,
    published_url: capture.published_url,
    creator_result_url: capture.creator_result_url,
    platform_record_ref: capture.platform_record_ref,
    publish_visibility_scope: "private_or_self_visible",
    success_signal: {
      signal_source: "platform_response",
      signal_locator: capture.url,
      platform_message: "trusted platform publish result identity captured",
      observed_at: capture.captured_at
    },
    captured_at: capture.captured_at,
    verification_state: "verified"
  };
  const cleanup = {
    schema_version: "fr-0032.cleanup_rollback_proof.v1",
    cleanup_result_id: `cleanup/fr-0032/${liveWriteAttemptId}/private-visibility-background-capture`,
    live_write_attempt_id: liveWriteAttemptId,
    run_id: runId,
    profile_ref: profileRef,
    target_tab_id: targetTabId,
    publish_result_identity: publishIdentity,
    cleanup_policy_ref: cleanupPolicyRef,
    cleanup_action: "hide_published_result",
    cleanup_outcome: "hidden",
    proof_locator: visibilityProofLocator,
    platform_message:
      "publish_visibility_scope=private_or_self_visible confirmed before submit; trusted platform response captured publish identity",
    attempted_at: closedAt,
    completed_at: closedAt,
    residual_record: null
  };
  return {
    ...captured,
    live_write_evidence: {
      ...evidence,
      execution_phase: "closed",
      stop_classification: null,
      publish_result_identity_capture: capture,
      publish_result_identity: publishIdentity,
      cleanup_result: cleanup,
      risk_signals: [],
      stop_signal: null,
      residual_record: null,
      updated_at: closedAt
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "GO",
      full_live_write_success: true,
      upload_success: true,
      submit_success: true,
      publish_success: true,
      cleanup_success: true,
      later_write_actions_blocked: false,
      cleanup_required: false,
      blockers: []
    },
    published: true,
    cleanup_attempted: true
  };
};

const publishIdentityCaptureStatusMessage = (
  blockerCode: XhsControlledPublishResultIdentityCaptureFailureCode
): string => {
  switch (blockerCode) {
    case "PUBLISH_IDENTITY_CAPTURE_NOT_STARTED":
      return "Background publish identity capture did not start for the submit continuation.";
    case "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_NOT_OBSERVED":
      return "Background publish identity capture did not observe a trusted publish/result endpoint after submit.";
    case "PUBLISH_IDENTITY_CAPTURE_DIAGNOSTIC_EVENTS_NOT_RECORDED":
      return "Background publish identity capture observed post-submit network activity, but diagnostics did not retain any publish identity candidate shape.";
    case "PUBLISH_ACTION_NETWORK_NOT_OBSERVED":
      return "Controlled publish action did not produce post-submit network activity during the identity capture window.";
    case "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_UNTRUSTED":
      return "Background publish identity capture observed post-submit XHS write requests, but none matched the trusted publish/result endpoint taxonomy.";
    case "PUBLISH_IDENTITY_CAPTURE_RESPONSE_BODY_UNREADABLE":
      return "Background publish identity capture observed a trusted publish/result endpoint but could not read its response body.";
    case "PUBLISH_IDENTITY_CAPTURE_RESPONSE_IDENTITY_MISSING":
      return "Background publish identity capture observed a readable publish/result response without a trusted publish identity.";
    case "PUBLISH_IDENTITY_CAPTURE_TIMED_OUT":
      return "Background publish identity capture timed out before producing a trusted publish identity.";
  }
};

export const applyXhsControlledPublishResultIdentityCaptureStatus = (
  result: XhsControlledLiveWriteResult,
  status: XhsControlledPublishResultIdentityCaptureStatus | null
): XhsControlledLiveWriteResult => {
  if (!status?.blocker_code) {
    return result;
  }
  const evidence = result.live_write_evidence;
  if (evidence.publish_result_identity) {
    return result;
  }
  const evaluation = result.live_write_evaluation;
  const blockers = Array.isArray(evaluation.blockers) ? evaluation.blockers : [];
  const publishIdentityMissing = blockers.some((blocker) => {
    const record = asPlainRecord(blocker);
    return (
      record?.blocker_code === "PUBLISH_RESULT_IDENTITY_MISSING" &&
      record?.blocker_layer === "published_identity"
    );
  });
  if (result.uploaded !== true || result.submitted !== true || publishIdentityMissing !== true) {
    return result;
  }
  const timestamp = nowIso();
  const liveWriteAttemptId = String(evidence.live_write_attempt_id ?? "unknown");
  const message = publishIdentityCaptureStatusMessage(status.blocker_code);
  const stopSignal = asPlainRecord(evidence.stop_signal) ?? {};
  const nextStopSignal = {
    ...stopSignal,
    blocker_code: status.blocker_code,
    required_recovery_action: "fix background publish identity capture diagnostics/parser before retrying publish identity",
    diagnostics: {
      ...(asPlainRecord(stopSignal.diagnostics) ?? {}),
      publish_result_identity_capture_status: status
    }
  };
  return {
    ...result,
    live_write_evidence: {
      ...evidence,
      publish_result_identity_capture_status: status,
      stop_classification: {
        ...(asPlainRecord(evidence.stop_classification) ?? {}),
        stop_reason: status.reason ?? status.blocker_code,
        publish_identity_capture_blocker_code: status.blocker_code
      },
      risk_signals: [
        {
          risk_signal_id: `risk/fr-0032/${liveWriteAttemptId}/${status.blocker_code}`,
          detected_at: timestamp,
          source: "background_publish_identity_capture",
          kind: "publish_identity_missing",
          severity: "blocking",
          details_ref: status.reason ?? status.blocker_code,
          blocker_code: status.blocker_code
        }
      ],
      stop_signal: nextStopSignal,
      updated_at: timestamp
    },
    live_write_evaluation: {
      ...evaluation,
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
          blocker_code: status.blocker_code,
          blocker_layer: "published_identity",
          message
        }
      ]
    }
  };
};

export const applyXhsControlledLiveWriteContinuationTimeout = (
  result: XhsControlledLiveWriteResult,
  input: {
    continuationKey: string;
    reason: string;
  }
): XhsControlledLiveWriteResult => {
  const timestamp = nowIso();
  const evidence = result.live_write_evidence;
  const scope = evidence.scope as JsonRecord | undefined;
  const liveWriteAttemptId = String(evidence.live_write_attempt_id ?? "unknown");
  const stopSignal = (evidence.stop_signal as JsonRecord | null) ?? {
    schema_version: "fr-0032.live_write_stop_signal.v1",
    live_write_attempt_id: liveWriteAttemptId,
    run_id: String(scope?.run_id ?? "unknown"),
    profile_ref: String(scope?.profile_ref ?? "unknown"),
    target_tab_id: Number(scope?.target_tab_id ?? 0),
    severity: "blocking",
    cleanup_result_id: null,
    residual_record_id: null,
    evidence_ref: `live_write_evidence/${liveWriteAttemptId}`
  };
  const nextStopSignal = {
    ...stopSignal,
    stop_signal_id: `stop/fr-0032/${liveWriteAttemptId}/submit-continuation-timeout`,
    stopped_at: timestamp,
    stopped_step: "submit",
    blocker_layer: "runtime-channel",
    blocker_code: "SUBMIT_CONTINUATION_TIMEOUT",
    later_write_actions_blocked: true,
    cleanup_required: true,
    required_recovery_action:
      "rerun controlled submit/publish with the accepted_upload_artifact_identity from this evidence"
  };
  const nextEvidence = {
    ...evidence,
    execution_phase: "submit",
    stop_classification: {
      ...((evidence.stop_classification as JsonRecord | undefined) ?? {}),
      category: "submit_blocked",
      evaluation_state: "stopped",
      stop_reason: "submit_continuation_timeout",
      background_upload_capture_continuation: {
        attempted: true,
        continuation_key: input.continuationKey,
        failure_reason: input.reason,
        recorded_at: timestamp
      }
    },
    risk_signals: [
      {
        risk_signal_id: `risk/fr-0032/${liveWriteAttemptId}/submit-continuation-timeout`,
        detected_at: timestamp,
        source: "runtime-channel",
        kind: "submit_failure",
        severity: "blocking",
        details_ref: "submit_continuation_timeout"
      }
    ],
    stop_signal: nextStopSignal,
    updated_at: timestamp
  };
  return {
    ...result,
    live_write_evidence: nextEvidence,
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
          blocker_code: "SUBMIT_CONTINUATION_TIMEOUT",
          blocker_layer: "runtime-channel",
          message: "Accepted upload evidence exists, but the controlled submit/publish continuation timed out."
        }
      ]
    },
    uploaded: true,
    submitted: false,
    published: false,
    cleanup_attempted: false
  };
};

export const applyXhsControlledUploadPlatformCaptureStatus = (
  result: XhsControlledLiveWriteResult,
  status: XhsControlledUploadPlatformCaptureStatus | null
): XhsControlledLiveWriteResult => {
  if (!status) {
    return result;
  }
  const evidence = result.live_write_evidence;
  if (evidence.platform_upload_acceptance_capture) {
    return result;
  }
  return {
    ...result,
    live_write_evidence: {
      ...evidence,
      platform_upload_acceptance_capture_status: status,
      updated_at: nowIso()
    }
  };
};

export const buildXhsControlledLiveWriteFromDiscovery = (
  input: XhsControlledLiveWriteInput,
  discovery: MediaUploadDiscoveryResult
): XhsControlledLiveWriteResult => {
  if (discovery.controlled_upload_evidence?.upload_artifact_identity?.accepted_by_platform === true) {
    return buildXhsControlledLiveWriteSubmitBlockedResult(
      input,
      discovery.controlled_upload_evidence.upload_artifact_identity
    );
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

const privateVisibilityPattern =
  /仅自己可见|仅自己|自己可见|仅自己看|仅我可见|仅我|私密发布|私密|仅本人|不公开|private|only\s*me|self[-_ ]?visible/iu;
const publicVisibilityPattern = /公开|所有人|public|everyone/iu;
const visibilityTriggerPattern =
  /可见范围|可见权限|可见用户|可见性|谁可以看|谁可以查看|谁能看|谁可见|谁能见|观看权限|查看权限|浏览权限|权限设置|发布权限|内容权限|笔记权限|visibility|privacy|permission/iu;
const visibilitySettingsDisclosurePattern =
  /发布设置|高级设置|更多设置|更多选项|展开更多|设置更多|权限设置|内容权限|笔记权限|post\s*settings|publish\s*settings|advanced\s*settings|more\s*(settings|options)/iu;
const visibilityStructuralPattern =
  /visibility|privacy|permission|select|dropdown|radio|setting|scope|range|visible|viewer|audience|current|value|trigger|selector|reds-select|d-select|el-select|semi-select|ant-select/iu;
const visibilityTriggerActionPattern = /button|combobox|listbox|radio|menuitemradio|option|select|dropdown/iu;
const submitPublishPattern = /发布|提交|确认发布|publish|submit/iu;
const nonSubmitPublishPattern =
  /发布设置|高级设置|更多设置|更多选项|权限设置|内容权限|笔记权限|草稿|存为|预览|取消|返回|定时|save|draft|preview|cancel|back|schedule|post\s*settings|publish\s*settings|advanced\s*settings|more\s*(settings|options)/iu;
const publishSuccessPattern = /发布成功|发布完成|已发布|提交成功|publish(ed)?\s*(success|complete)|success/iu;
const nativeSubmitControlSelector = [
  "button",
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]'
].join(",");
const customSubmitControlSelector = [
  '[class*="submit" i]',
  '[class*="publish" i]',
  '[class*="button" i]',
  '[class*="btn" i]',
  '[data-testid*="submit" i]',
  '[data-testid*="publish" i]',
  '[data-test*="submit" i]',
  '[data-test*="publish" i]'
].join(",");
const submitControlActionSignalPattern =
  /(^|[\s_-])(submit|publish|post|confirm|btn|button)([\s_-]|$)|d-button|reds-button|semi-button|ant-btn|el-button/iu;
const submitControlContainerSignalPattern =
  /publish-(page|panel|content|container|form|wrapper|editor)|(^|[\s_-])(page|panel|content|container|form|wrapper|editor|settings)([\s_-]|$)/iu;
const publishModeNavigationPattern =
  /发布\s*(?:视频|图文|笔记)|(?:^|[\s_-])publish[\s_-]?(?:video|image|note)(?:$|[\s_-])/iu;
const publishModeNavigationSelector =
  ".publish-video,.publish-image,.publish-note,.menu-container,.menu-panel,[data-role='publish-mode-nav']";
const uploadStageContinuationPattern = /下一步|下一|继续|完成|next|continue/iu;
const uploadStageContainerPattern =
  /upload|media|material|publish-page-content-media|upload-wrapper|upload-container/iu;
const uploadStageContinuationSelector = [
  "button",
  '[role="button"]',
  '[class*="button" i]',
  '[class*="btn" i]',
  '[class*="next" i]',
  '[class*="continue" i]'
].join(",");

const normalizeVisibilitySemanticSignal = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\s\u00a0\u1680\u180e\u2000-\u200f\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]+/gu, "");

const hasPrivateVisibilitySignal = (value: string): boolean =>
  privateVisibilityPattern.test(value) || privateVisibilityPattern.test(normalizeVisibilitySemanticSignal(value));

const hasPublicVisibilitySignal = (value: string): boolean =>
  publicVisibilityPattern.test(value) || publicVisibilityPattern.test(normalizeVisibilitySemanticSignal(value));

const hasVisibilityTriggerSignal = (value: string): boolean =>
  visibilityTriggerPattern.test(value) || visibilityTriggerPattern.test(normalizeVisibilitySemanticSignal(value));

const isNativeSubmitControl = (element: HTMLElement): boolean => {
  const tagName = element.tagName.toLowerCase();
  const type = getElementAttribute(element, "type") ?? "";
  return tagName === "button" || (tagName === "input" && /button|submit/iu.test(type));
};

const hasPublishModeNavigationAncestor = (element: HTMLElement): boolean => {
  if (typeof element.closest === "function") {
    try {
      return element.closest(publishModeNavigationSelector) !== null;
    } catch {
      // Fall through to the parentElement walk for partial DOM shims.
    }
  }
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const signal = `${getElementAttribute(current, "class") ?? ""} ${getElementAttribute(current, "data-role") ?? ""}`;
    if (publishModeNavigationPattern.test(signal) || getElementAttribute(current, "data-role") === "publish-mode-nav") {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const isPublishModeNavigationSubmitControl = (element: HTMLElement, signal: string): boolean => {
  const tagName = element.tagName.toLowerCase();
  const className = getElementAttribute(element, "class") ?? "";
  const roleAttr = getElementAttribute(element, "role");
  const semanticActionTarget =
    isNativeSubmitControl(element) ||
    tagName === "a" ||
    roleAttr === "button" ||
    /\b(?:button|submit|confirm|btn)\b/iu.test(className);
  if (semanticActionTarget) {
    return false;
  }
  return publishModeNavigationPattern.test(`${signal} ${className}`) || hasPublishModeNavigationAncestor(element);
};

const isSafeSubmitPublishControl = (element: HTMLElement): boolean => {
  const signal = elementTextSignal(element);
  if (
    !isVisibleElement(element) ||
    isDisabledElement(element) ||
    !submitPublishPattern.test(signal) ||
    nonSubmitPublishPattern.test(signal) ||
    isPublishModeNavigationSubmitControl(element, signal)
  ) {
    return false;
  }
  if (isNativeSubmitControl(element)) {
    return true;
  }
  const actionSignal = [
    getElementAttribute(element, "data-testid"),
    getElementAttribute(element, "data-test"),
    getElementAttribute(element, "class")
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  const displayedText = elementDisplayedTextSignal(element).replace(/\s+/gu, "");
  return (
    displayedText.length > 0 &&
    displayedText.length <= 24 &&
    submitControlActionSignalPattern.test(actionSignal) &&
    !submitControlContainerSignalPattern.test(actionSignal)
  );
};

const findSubmitPublishControl = (): HTMLElement | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  return (
    Array.from(document.querySelectorAll<HTMLElement>(nativeSubmitControlSelector)).find(isSafeSubmitPublishControl) ??
    Array.from(document.querySelectorAll<HTMLElement>(customSubmitControlSelector)).find(isSafeSubmitPublishControl) ??
    null
  );
};

const hasUploadStageAncestor = (element: HTMLElement): boolean => {
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const signal = `${locatorForElement(current)} ${visibilityStructuralSignal(current)} ${textContentOf(current)}`;
    if (uploadStageContainerPattern.test(signal)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const isSafeUploadStageContinuationControl = (element: HTMLElement): boolean => {
  const displayedText = elementDisplayedTextSignal(element).replace(/\s+/gu, "");
  const signal = `${displayedText} ${visibilityStructuralSignal(element)}`;
  return (
    isVisibleElement(element) &&
    !isDisabledElement(element) &&
    displayedText.length > 0 &&
    displayedText.length <= 16 &&
    uploadStageContinuationPattern.test(signal) &&
    !submitPublishPattern.test(signal) &&
    !nonSubmitPublishPattern.test(signal) &&
    hasUploadStageAncestor(element) &&
    typeof element.click === "function"
  );
};

const findUploadStageContinuationControl = (): HTMLElement | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  return Array.from(document.querySelectorAll<HTMLElement>(uploadStageContinuationSelector)).find(
    isSafeUploadStageContinuationControl
  ) ?? null;
};

const continueFromAcceptedUploadStageIfNeeded = async (): Promise<boolean> => {
  const continuationControl = findUploadStageContinuationControl();
  if (!continuationControl) {
    return false;
  }
  continuationControl.click();
  await sleep(800);
  return true;
};

const uploadStageCleanupResult = (
  input: XhsControlledLiveWriteInput,
  timestamp: string,
  reason: string
): JsonRecord => ({
  schema_version: "fr-0032.cleanup_rollback_proof.v1",
  cleanup_result_id: `cleanup/fr-0032/${input.live_write_attempt_id}/upload-stage`,
  live_write_attempt_id: input.live_write_attempt_id,
  run_id: input.run_id,
  profile_ref: input.profile_ref ?? "unknown",
  target_tab_id: input.target_tab_id ?? 0,
  publish_result_identity: null,
  cleanup_policy_ref: input.cleanup_policy_ref,
  cleanup_action: "abandon_unpublished_upload",
  cleanup_outcome: "not_needed",
  proof_locator: "creator_publish_editor_unpublished_upload_only",
  platform_message: reason,
  attempted_at: timestamp,
  completed_at: timestamp,
  residual_record: null
});

const buildStepBlockedResult = (
  input: XhsControlledLiveWriteInput,
  artifact: ControlledUploadArtifactIdentity,
  reason: StepBlockedInput,
  submitEvidence: SubmitEvidence | null = null,
  cleanupResult: JsonRecord | null = null,
  residualRecord: JsonRecord | null = null
): XhsControlledLiveWriteResult => {
  const timestamp = nowIso();
  const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
  const cleanupResultId =
    cleanupResult && typeof cleanupResult.cleanup_result_id === "string" ? cleanupResult.cleanup_result_id : null;
  const residualRecordId =
    residualRecord && typeof residualRecord.residual_record_id === "string" ? residualRecord.residual_record_id : null;
  return {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: input.live_write_attempt_id,
      canonical_issue_ref: "#835",
      execution_phase: reason.stoppedStep,
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
        artifact_identity: artifact.upload_artifact_id
      },
      entry_gate: null,
      stop_classification: {
        category: `${reason.blockerLayer}_blocked`,
        evaluation_state: "stopped",
        stop_reason: reason.detailsRef,
        latest_head_sha: input.latest_head_sha ?? null,
        publish_visibility_scope: input.publish_visibility_scope,
        cleanup_policy_ref: input.cleanup_policy_ref
      },
      upload_artifact_identity: artifact,
      submit_evidence: submitEvidence,
      publish_result_identity: null,
      cleanup_result: cleanupResult,
      risk_signals: [
        {
          risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/${reason.detailsRef}`,
          detected_at: timestamp,
          source: reason.blockerLayer === "published_identity" ? "publish" : reason.blockerLayer,
          kind: reason.riskKind,
          severity: "blocking",
          details_ref: reason.detailsRef
        }
      ],
      stop_signal: {
        schema_version: "fr-0032.live_write_stop_signal.v1",
        stop_signal_id: `stop/fr-0032/${input.live_write_attempt_id}/${reason.detailsRef}`,
        live_write_attempt_id: input.live_write_attempt_id,
        run_id: input.run_id,
        profile_ref: input.profile_ref ?? "unknown",
        target_tab_id: input.target_tab_id ?? 0,
        stopped_at: timestamp,
        stopped_step: reason.stoppedStep,
        blocker_layer: reason.blockerLayer,
        blocker_code: reason.blockerCode,
        severity: "blocking",
        later_write_actions_blocked: true,
        cleanup_required: reason.cleanupRequired,
        cleanup_result_id: cleanupResultId,
        residual_record_id: residualRecordId,
        required_recovery_action: reason.requiredRecoveryAction,
        evidence_ref: evidenceRef,
        ...(reason.diagnostics ? { diagnostics: reason.diagnostics } : {})
      },
      residual_record: residualRecord,
      ...(reason.diagnostics ? { blocker_diagnostics: reason.diagnostics } : {}),
      created_at: timestamp,
      updated_at: timestamp
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: submitEvidence?.submit_result_state === "accepted",
      publish_success: false,
      cleanup_success: cleanupResult?.cleanup_outcome === "not_needed",
      later_write_actions_blocked: true,
      cleanup_required: reason.cleanupRequired,
      blockers: [
        {
          blocker_code: reason.blockerCode,
          blocker_layer: reason.blockerLayer,
          message: reason.blockerMessage
        }
      ]
    },
    uploaded: true,
    submitted: submitEvidence?.submit_result_state === "accepted",
    published: false,
    cleanup_attempted: cleanupResult !== null,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
  };
};

const visibilityControlSelector = [
  "button",
  "label",
  '[role="button"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="radio"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[class*="option" i]',
  '[class*="radio" i]',
  '[class*="visibility" i]',
  '[class*="privacy" i]',
  '[class*="permission" i]',
  "input",
  "textarea",
  '[class*="setting" i]',
  '[class*="scope" i]',
  '[class*="range" i]',
  '[class*="select" i]',
  '[class*="dropdown" i]'
].join(",");

const privateVisibilityOptionSelector = [
  visibilityControlSelector,
  '[role="menu"] *',
  '[role="listbox"] *',
  '[class*="popover" i] *',
  '[class*="dropdown" i] *',
  '[class*="select" i] *'
].join(",");

const openedPlainPrivateVisibilityOptionSelector = [
  '[role="menu"] li',
  '[role="menu"] div',
  '[role="menu"] span',
  '[class*="menu" i] li',
  '[class*="menu" i] div',
  '[class*="menu" i] span',
  '[role="listbox"] li',
  '[role="listbox"] div',
  '[role="listbox"] span',
  '[class*="popper" i] li',
  '[class*="popper" i] div',
  '[class*="popper" i] span',
  '[class*="popover" i] li',
  '[class*="popover" i] div',
  '[class*="popover" i] span',
  '[class*="portal" i] li',
  '[class*="portal" i] div',
  '[class*="portal" i] span',
  '[class*="dropdown" i]',
  '[class*="dropdown" i] li',
  '[class*="dropdown" i] div',
  '[class*="dropdown" i] span',
  '[class*="select" i]',
  '[class*="select" i] li',
  '[class*="select" i] div',
  '[class*="select" i] span',
  '[class*="option" i]',
  '[class*="item" i]'
].join(",");

const visibleVisibilityDropdownPortalSelector = [
  "div.d-popover.d-popover-default.d-dropdown",
  "div.d-dropdown-wrapper",
  "div.d-dropdown-content",
  "div.d-options-wrapper",
  '[class*="popover" i][class*="dropdown" i]',
  '[class*="dropdown" i][class*="wrapper" i]',
  '[class*="dropdown" i][class*="content" i]',
  '[class*="options" i][class*="wrapper" i]'
].join(",");

const isPrivateVisibilityOptionCandidate = (element: HTMLElement): boolean => {
  const signal = elementTextSignal(element);
  if (
    !isVisibleElement(element) ||
    isDisabledElement(element) ||
    !hasPrivateVisibilitySignal(signal) ||
    hasPublicVisibilitySignal(signal)
  ) {
    return false;
  }
  const structuralSignal = visibilityStructuralSignal(element);
  if (/d-popover|d-dropdown-wrapper|d-dropdown-content|d-options-wrapper/iu.test(structuralSignal)) {
    return false;
  }
  if (/custom-option|select-option|dropdown-item|option|menuitem|\bname\b/iu.test(structuralSignal)) {
    return true;
  }
  return typeof element.querySelectorAll !== "function" || element.querySelectorAll("*").length === 0;
};

const findPrivateVisibilityOptionFromSelector = (selector: string): HTMLElement | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isPrivateVisibilityOptionCandidate) ?? null;
};

const findPrivateVisibilityOption = (allowOpenedPlainTextOption = false): HTMLElement | null => {
  const structuredOption = findPrivateVisibilityOptionFromSelector(privateVisibilityOptionSelector);
  if (structuredOption || !allowOpenedPlainTextOption) {
    return structuredOption;
  }
  return findPrivateVisibilityOptionFromSelector(openedPlainPrivateVisibilityOptionSelector);
};

const findVisibleVisibilityDropdownPortal = (): HTMLElement | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  return Array.from(document.querySelectorAll<HTMLElement>(visibleVisibilityDropdownPortalSelector))
    .find((element) => {
      const structuralSignal = visibilityStructuralSignal(element);
      return (
        isVisibleElement(element) &&
        /d-popover|d-dropdown-wrapper|d-dropdown-content|d-options-wrapper|popover.*dropdown|dropdown.*wrapper|dropdown.*content|options.*wrapper/iu.test(
          structuralSignal
        ) &&
        !/custom-option|select-option|dropdown-item|\boption\b|menuitem|\bname\b/iu.test(structuralSignal)
      );
    }) ?? null;
};

const hasMountedPrivateVisibilityOption = (): boolean => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return false;
  }
  return Array.from(document.querySelectorAll<HTMLElement>(openedPlainPrivateVisibilityOptionSelector))
    .some((element) => {
      const signal = elementTextSignal(element);
      return (
        isVisibleElement(element) &&
        hasPrivateVisibilitySignal(signal) &&
        !hasPublicVisibilitySignal(signal) &&
        !isDisabledElement(element)
      );
    });
};

const resolvePrivateVisibilityOptionClickTarget = (element: HTMLElement): HTMLElement => {
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const structuralSignal = visibilityStructuralSignal(current);
    if (
      /custom-option|select-option|dropdown-item|option|menuitem/iu.test(structuralSignal) &&
      !/\bname\b/iu.test(structuralSignal) &&
      !/d-popover|d-dropdown-wrapper|d-dropdown-content|d-options-wrapper/iu.test(structuralSignal) &&
      typeof current.click === "function" &&
      !isDisabledElement(current)
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return element;
};

const visibilitySelectionConfirmationCandidates = (root: HTMLElement): HTMLElement[] => {
  const descendants =
    typeof root.querySelectorAll === "function"
      ? Array.from(root.querySelectorAll<HTMLElement>(visibilityControlSelector))
      : [];
  return uniqueVisibilityElements([root, ...descendants]);
};

const isVisibilitySelectionConfirmationElement = (element: HTMLElement): boolean => {
  const structuralSignal = visibilityStructuralSignal(element);
  return (
    !/d-popover|d-dropdown-wrapper|d-dropdown-content|d-options-wrapper|custom-option|select-option|dropdown-item|\boption\b|menuitem|\bname\b/iu.test(
      structuralSignal
    ) &&
    !nonVisibilitySelectContextPattern.test(structuralSignal)
  );
};

const nearestVisibilityConfirmationRoot = (element: HTMLElement): HTMLElement => {
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (isVisibilitySelectionConfirmationElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return element;
};

const hasConfirmedPrivateVisibilitySelection = (root: HTMLElement): boolean => {
  return visibilitySelectionConfirmationCandidates(root).some((element) => {
    const signal = elementDisplayedTextSignal(element);
    return (
      isVisibleElement(element) &&
      isVisibilitySelectionConfirmationElement(element) &&
      hasPrivateVisibilitySignal(signal) &&
      !hasPublicVisibilitySignal(signal)
    );
  });
};

const visibilityStructuralSignal = (element: Element): string =>
  [
    getElementAttribute(element, "data-testid"),
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    getElementAttribute(element, "role"),
    getElementAttribute(element, "class")
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

const visibilityContextSelector = [
  "label",
  "div",
  "span",
  "p",
  '[class*="label" i]',
  '[class*="title" i]',
  '[class*="setting" i]',
  '[class*="scope" i]',
  '[class*="range" i]',
  '[class*="permission" i]',
  '[class*="visibility" i]',
  '[class*="privacy" i]'
].join(",");

const visibilityContextTriggerSelector = [
  "button",
  '[role="button"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="radio"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  "label",
  "input",
  "textarea",
  "div",
  "span",
  '[class*="select" i]',
  '[class*="dropdown" i]',
  '[class*="radio" i]',
  '[class*="option" i]',
  '[class*="value" i]',
  '[class*="current" i]'
].join(",");

const plainPublicVisibilityValueSelector = [
  "button",
  "input",
  "textarea",
  '[role="button"]',
  '[role="combobox"]'
].join(",");

const plainPublicVisibilityTextValueSelector = [
  "div",
  "span",
  "p"
].join(",");

const visibilitySettingsDisclosureSelector = [
  "button",
  "summary",
  '[role="button"]',
  '[aria-expanded]',
  '[class*="setting" i]',
  '[class*="expand" i]',
  '[class*="collapse" i]',
  '[class*="more" i]',
  '[class*="advanced" i]'
].join(",");

const hasPublicVisibilityCandidate = (element: HTMLElement, context: HTMLElement): boolean => {
  if (typeof element.querySelectorAll !== "function") {
    return false;
  }
  return Array.from(element.querySelectorAll<HTMLElement>(visibilityContextTriggerSelector)).some((candidate) => {
    const signal = elementTextSignal(candidate);
    return (
      candidate !== context &&
      isVisibleElement(candidate) &&
      !isDisabledElement(candidate) &&
      hasPublicVisibilitySignal(signal) &&
      !hasPrivateVisibilitySignal(signal) &&
      !nonSubmitPublishPattern.test(signal)
    );
  });
};

const visibilityContextContainer = (element: HTMLElement): HTMLElement | null => {
  let current: HTMLElement | null = element;
  let nearestPublicCandidateContainer: HTMLElement | null = null;
  for (let depth = 0; current && depth < 8; depth += 1) {
    const currentText = textContentOf(current);
    if (hasPublicVisibilitySignal(currentText) || hasPrivateVisibilitySignal(currentText)) {
      return current;
    }
    if (!nearestPublicCandidateContainer && hasPublicVisibilityCandidate(current, element)) {
      nearestPublicCandidateContainer = current;
    }
    current = current.parentElement;
  }
  return nearestPublicCandidateContainer ?? element.parentElement;
};

const isVisibilityClickTarget = (element: HTMLElement): boolean => {
  const actionSignal = `${element.tagName.toLowerCase()} ${getElementAttribute(element, "role") ?? ""}`;
  const structuralSignal = visibilityStructuralSignal(element);
  return (
    isVisibleElement(element) &&
    !isDisabledElement(element) &&
    !nonSubmitPublishPattern.test(textContentOf(element)) &&
    (visibilityTriggerActionPattern.test(actionSignal) ||
      visibilityStructuralPattern.test(structuralSignal))
  );
};

const resolveVisibilityClickTarget = (
  element: HTMLElement,
  boundary: HTMLElement | null = null
): HTMLElement => {
  const trustedPostUploadSelectTrigger = nearestTrustedPostUploadVisibilitySelectFallbackTrigger(element);
  if (trustedPostUploadSelectTrigger !== element) {
    return trustedPostUploadSelectTrigger;
  }
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (isVisibilityClickTarget(current)) {
      return current;
    }
    if (current === boundary) {
      break;
    }
    current = current.parentElement;
  }
  return element;
};

const isShortPublicVisibilityValue = (element: HTMLElement): boolean => {
  const text = elementDisplayedTextSignal(element).replace(/\s+/gu, "");
  return (
    text.length > 0 &&
    text.length <= 12 &&
    hasPublicVisibilitySignal(text) &&
    !hasPrivateVisibilitySignal(text) &&
    !nonSubmitPublishPattern.test(text)
  );
};

const isPublishSettingsLikeContainer = (element: HTMLElement): boolean => {
  const signal = `${elementTextSignal(element)} ${visibilityStructuralSignal(element)}`;
  return (
    /publish|发布|setting|form|field|row|item|option|select|dropdown|scope|range|permission|visibility|privacy|visible|audience|viewer/iu.test(signal) ||
    hasVisibilityTriggerSignal(signal)
  );
};

const hasPlainPublicVisibilityTextContext = (element: HTMLElement): boolean => {
  let current: HTMLElement | null = element.parentElement;
  const elementSignal = elementTextSignal(element);
  for (let depth = 0; current && depth < 5; depth += 1) {
    const currentText = textContentOf(current);
    if (currentText.length > 160) {
      current = current.parentElement;
      continue;
    }
    const text = `${currentText} ${elementSignal}`;
    const signal = `${elementTextSignal(current)} ${visibilityStructuralSignal(current)}`;
    if (
      (hasVisibilityTriggerSignal(signal) || isPublishSettingsLikeContainer(current)) &&
      hasPublicVisibilitySignal(text) &&
      !hasPrivateVisibilitySignal(text) &&
      !nonSubmitPublishPattern.test(text)
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const resolvePlainPublicVisibilityClickTarget = (element: HTMLElement): HTMLElement | null => {
  const actionSignal = `${element.tagName.toLowerCase()} ${getElementAttribute(element, "role") ?? ""}`;
  if (visibilityTriggerActionPattern.test(actionSignal) && typeof element.click === "function") {
    return element;
  }
  if (!hasPlainPublicVisibilityTextContext(element)) {
    return null;
  }
  let current: HTMLElement | null = element;
  let nearestSettingsLike: HTMLElement | null = null;
  for (let depth = 0; current && depth < 6; depth += 1) {
    if (current !== element && isPublishSettingsLikeContainer(current)) {
      nearestSettingsLike = current;
    }
    if (
      current !== element &&
      visibilityTriggerActionPattern.test(`${current.tagName.toLowerCase()} ${getElementAttribute(current, "role") ?? ""}`) &&
      isVisibilityClickTarget(current)
    ) {
      return current;
    }
    if (isVisibilityClickTarget(current) && (current === element || isSelectLikeVisibilityActivationTarget(current))) {
      return current;
    }
    current = current.parentElement;
  }
  if (
    nearestSettingsLike &&
    textContentOf(nearestSettingsLike).length <= 80 &&
    isSelectLikeVisibilityActivationTarget(nearestSettingsLike)
  ) {
    return nearestSettingsLike;
  }
  if (isVisibilityClickTarget(element)) {
    return element;
  }
  return typeof element.click === "function" ? element : null;
};

const uniqueVisibilityElements = (elements: Array<HTMLElement | null>): HTMLElement[] => {
  const seen = new Set<HTMLElement>();
  return elements.filter((element): element is HTMLElement => {
    if (!element || seen.has(element)) {
      return false;
    }
    seen.add(element);
    return true;
  });
};

const visibilityDiagnosticSelector = [
  visibilityControlSelector,
  visibilityContextSelector,
  plainPublicVisibilityValueSelector,
  plainPublicVisibilityTextValueSelector,
  visibilitySettingsDisclosureSelector,
  '[class*="popper" i]',
  '[class*="popover" i]',
  '[class*="portal" i]',
  '[class*="dropdown" i]',
  '[class*="option" i]',
  '[class*="item" i]'
].join(",");

const visibilityDiagnosticScanLimit = 300;
const visibilityDiagnosticSampleLimit = 40;

const classTokensForElement = (element: Element): string[] => {
  const className = getElementAttribute(element, "class");
  if (!className) {
    return [];
  }
  return className.split(/\s+/u).filter((item) => item.trim().length > 0).slice(0, 8);
};

const visibilityDiagnosticAncestor = (element: HTMLElement): JsonRecord[] => {
  const ancestors: JsonRecord[] = [];
  let current = element.parentElement;
  for (let depth = 0; current && depth < 3; depth += 1) {
    ancestors.push({
      depth: depth + 1,
      tag_name: current.tagName.toLowerCase(),
      locator: locatorForElement(current),
      attribute_names: attributeNamesForElement(current),
      class_tokens: classTokensForElement(current)
    });
    current = current.parentElement;
  }
  return ancestors;
};

const visibilityDiagnosticCandidateScore = (element: HTMLElement, sourceIndex: number): number => {
  const fullSignal = elementTextSignal(element);
  const displayedSignal = elementDisplayedTextSignal(element);
  const structuralSignal = visibilityStructuralSignal(element);
  const locator = locatorForElement(element);
  let score = 0;

  if (hasPrivateVisibilitySignal(fullSignal)) {
    score += 120;
  }
  if (isVisibilityClickTarget(element)) {
    score += 90;
  }
  if (hasVisibilityTriggerSignal(fullSignal)) {
    score += 70;
  }
  if (visibilityStructuralPattern.test(structuralSignal)) {
    score += 55;
  }
  if (hasPublicVisibilitySignal(fullSignal) && displayedSignal.length <= 120) {
    score += 45;
  }
  if (visibilitySettingsDisclosurePattern.test(fullSignal) && displayedSignal.length <= 160) {
    score += 35;
  }
  if (
    /publish|editor|content|form|field|row|setting|scope|range|permission|visibility|privacy|select|dropdown|option|value|current/iu.test(
      `${locator} ${structuralSignal}`
    )
  ) {
    score += 30;
  }
  if (displayedSignal.length > 240) {
    score -= 80;
  } else if (displayedSignal.length > 120) {
    score -= 35;
  }
  if (/^#(?:app|page|CreatorPlatform)$/u.test(locator)) {
    score -= 100;
  }

  return score * 10_000 - sourceIndex;
};

const collectVisibilityLocatorDiagnostics = (): JsonRecord => {
  const timestamp = nowIso();
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return {
      schema_version: "fr-0032.visibility_locator_diagnostics.v1",
      values_recorded: false,
      recording_policy: "attribute_names_signal_flags_and_lengths_only",
      collected_at: timestamp,
      candidate_count: 0,
      candidates: []
    };
  }
  const matchedElements = document.querySelectorAll<HTMLElement>(visibilityDiagnosticSelector);
  const visibleCandidates: Array<{ element: HTMLElement; sourceIndex: number }> = [];
  const seen = new Set<HTMLElement>();
  const scanCount = Math.min(matchedElements.length, visibilityDiagnosticScanLimit);
  for (let index = 0; index < scanCount; index += 1) {
    const element = matchedElements[index] ?? null;
    if (
      element instanceof HTMLElement &&
      !seen.has(element) &&
      isVisibleElement(element)
    ) {
      seen.add(element);
      visibleCandidates.push({ element, sourceIndex: index });
    }
  }
  const candidates = visibleCandidates
    .map(({ element, sourceIndex }) => ({
      element,
      sourceIndex,
      score: visibilityDiagnosticCandidateScore(element, sourceIndex)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, visibilityDiagnosticSampleLimit);
  return {
    schema_version: "fr-0032.visibility_locator_diagnostics.v1",
    values_recorded: false,
    recording_policy: "attribute_names_signal_flags_and_lengths_only",
    collected_at: timestamp,
    candidate_count: matchedElements.length,
    scanned_candidate_count: scanCount,
    scan_truncated: matchedElements.length > scanCount,
    scan_limit: visibilityDiagnosticScanLimit,
    sampled_candidate_count: candidates.length,
    candidates: candidates.map(({ element, sourceIndex }, index) => {
      const fullSignal = elementTextSignal(element);
      const displayedSignal = elementDisplayedTextSignal(element);
      const structuralSignal = visibilityStructuralSignal(element);
      return {
        index,
        source_index: sourceIndex,
        tag_name: element.tagName.toLowerCase(),
        locator: locatorForElement(element),
        attribute_names: attributeNamesForElement(element),
        class_tokens: classTokensForElement(element),
        role_present: getElementAttribute(element, "role") !== null,
        has_value_attribute: getElementAttribute(element, "value") !== null,
        has_placeholder_attribute: getElementAttribute(element, "placeholder") !== null,
        displayed_signal_length: displayedSignal.length,
        full_signal_length: fullSignal.length,
        public_visibility_signal: hasPublicVisibilitySignal(fullSignal),
        private_visibility_signal: hasPrivateVisibilitySignal(fullSignal),
        visibility_trigger_signal: hasVisibilityTriggerSignal(fullSignal),
        visibility_structural_signal: visibilityStructuralPattern.test(structuralSignal),
        settings_disclosure_signal: visibilitySettingsDisclosurePattern.test(fullSignal),
        disabled: isDisabledElement(element),
        click_target: isVisibilityClickTarget(element),
        ancestor_chain: visibilityDiagnosticAncestor(element)
      };
    })
  };
};

const isVisibilitySettingsDisclosureCandidate = (element: HTMLElement): boolean => {
  const signal = `${elementTextSignal(element)} ${visibilityStructuralSignal(element)}`;
  return (
    isVisibleElement(element) &&
    !isDisabledElement(element) &&
    visibilitySettingsDisclosurePattern.test(signal) &&
    !hasPrivateVisibilitySignal(signal) &&
    !hasPublicVisibilitySignal(signal)
  );
};

const findVisibilitySettingsDisclosureTriggers = (): HTMLElement[] => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  return uniqueVisibilityElements(
    Array.from(document.querySelectorAll<HTMLElement>(visibilitySettingsDisclosureSelector)).map((element) =>
      isVisibilitySettingsDisclosureCandidate(element) ? resolveVisibilityClickTarget(element) : null
    )
  );
};

const openVisibilitySettingsDisclosure = async (): Promise<boolean> => {
  const disclosures = findVisibilitySettingsDisclosureTriggers();
  for (const disclosure of disclosures) {
    if (typeof disclosure.click !== "function") {
      continue;
    }
    disclosure.click();
    await sleep(300);
    return true;
  }
  return false;
};

const findVisibilityTriggersFromExplicitContext = (): HTMLElement[] => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  const contexts = Array.from(document.querySelectorAll<HTMLElement>(visibilityContextSelector)).filter((element) => {
    const signal = elementTextSignal(element);
    return isVisibleElement(element) && hasVisibilityTriggerSignal(signal);
  });
  return uniqueVisibilityElements(
    contexts.flatMap((context) => {
      const container = visibilityContextContainer(context);
      if (!container || typeof container.querySelectorAll !== "function") {
        return [];
      }
      const candidates = Array.from(container.querySelectorAll<HTMLElement>(visibilityContextTriggerSelector));
      return candidates.map((element) => {
        const signal = elementTextSignal(element);
        const matches =
          element !== context &&
          isVisibleElement(element) &&
          !isDisabledElement(element) &&
          hasPublicVisibilitySignal(signal) &&
          !hasPrivateVisibilitySignal(signal) &&
          !nonSubmitPublishPattern.test(signal);
        return matches ? resolveVisibilityClickTarget(element, container) : null;
      });
    })
  );
};

const likelyPublishVisibilitySelectSelector = [
  '[class*="d-select" i]',
  '[class*="reds-select" i]',
  '[class*="select" i]',
  '[role="combobox"]',
  '[tabindex]'
].join(",");

const nonVisibilitySelectContextPattern =
  /address|location|poi|place|topic|tag|relation|file-relation|travel|poi-card|address-card|group-card|content[-_ ]?type|declaration/iu;

const hasNonVisibilitySelectContext = (element: HTMLElement): boolean => {
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const signal = `${locatorForElement(current)} ${visibilityStructuralSignal(current)} ${elementDisplayedTextSignal(current)}`;
    if (nonVisibilitySelectContextPattern.test(signal)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const hasPublishSettingsAncestor = (element: HTMLElement): boolean => {
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const signal = `${locatorForElement(current)} ${visibilityStructuralSignal(current)}`;
    if (nonVisibilitySelectContextPattern.test(signal)) {
      return false;
    }
    if (
      /publish-page-content-setting|publish-page-content-content-extra|publish-settings|post-settings|setting-content|setting-row/iu.test(
        signal
      )
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const isTrustedPostUploadVisibilitySelectFallback = (element: HTMLElement): boolean => {
  if (typeof HTMLElement !== "function") {
    return false;
  }
  const structuralSignal = visibilityStructuralSignal(element);
  const displayedSignal = elementVisibleTextSignal(element).replace(/\s+/gu, "");
  return (
    isVisibleElement(element) &&
    !isDisabledElement(element) &&
    !hasNonVisibilitySelectContext(element) &&
    hasPublishSettingsAncestor(element) &&
    /custom-select-44|d-select-wrapper|\bd-select\b|d-select-main|d-select-content/iu.test(structuralSignal) &&
    displayedSignal.length > 0 &&
    displayedSignal.length <= 16 &&
    !hasPrivateVisibilitySignal(displayedSignal)
  );
};

const nearestTrustedPostUploadVisibilitySelectFallbackTrigger = (element: HTMLElement): HTMLElement => {
  let current: HTMLElement | null = element;
  let nearestTrusted = isTrustedPostUploadVisibilitySelectFallback(element) ? element : null;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const structuralSignal = visibilityStructuralSignal(current);
    if (
      isTrustedPostUploadVisibilitySelectFallback(current) &&
      /d-select-wrapper|custom-select-44|permission-card-select/iu.test(structuralSignal)
    ) {
      return current;
    }
    if (!nearestTrusted && isTrustedPostUploadVisibilitySelectFallback(current)) {
      nearestTrusted = current;
    }
    current = current.parentElement;
  }
  return nearestTrusted ?? element;
};

const publishVisibilitySelectTriggerScore = (
  element: HTMLElement,
  sourceIndex: number,
  structuralFallback = false
): number => {
  const structuralSignal = visibilityStructuralSignal(element);
  const textSignal = elementTextSignal(element);
  const displayedSignal = elementVisibleTextSignal(element).replace(/\s+/gu, "");
  let score = 0;

  if (/permission-card-select|d-select-wrapper|reds-select|custom-select/iu.test(structuralSignal)) {
    score += 120;
  } else if (/\bd-select\b|select|dropdown|combobox/iu.test(structuralSignal)) {
    score += 85;
  }
  if (/custom-select-44|d-select-wrapper/iu.test(structuralSignal) && hasPublishSettingsAncestor(element)) {
    score += 80;
  }
  if (hasPublicVisibilitySignal(textSignal) && !hasPrivateVisibilitySignal(textSignal)) {
    score += 70;
  }
  if (displayedSignal.length > 0 && displayedSignal.length <= 12) {
    score += 30;
  }
  if (hasVisibilityTriggerSignal(textSignal)) {
    score += 30;
  }
  if (/publish-page-content-setting|publish-settings|permission|visibility|privacy/iu.test(structuralSignal)) {
    score += 25;
  }
  if (structuralFallback) {
    score -= 45;
  }
  if (/address|location|poi|place|topic|tag|relation|file-relation|travel|content[-_ ]?type|declaration/iu.test(structuralSignal)) {
    score -= 120;
  }

  return score * 1_000 - sourceIndex;
};

const findLikelyPublishVisibilitySelectTriggers = (structuralFallback = false): HTMLElement[] => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(likelyPublishVisibilitySelectSelector))
    .map((element, sourceIndex) => {
      if (
        !isVisibleElement(element) ||
        isDisabledElement(element) ||
        !hasPublishSettingsAncestor(element)
      ) {
        return null;
      }
      const structuralSignal = visibilityStructuralSignal(element);
      if (!isSelectLikeVisibilityActivationTarget(element) && !/d-select|reds-select|select|dropdown/iu.test(structuralSignal)) {
        return null;
      }
      const textSignal = elementTextSignal(element);
      const semanticCandidate =
        hasPublicVisibilitySignal(textSignal) ||
        hasVisibilityTriggerSignal(textSignal) ||
        /permission-card-select/iu.test(structuralSignal);
      if (!semanticCandidate && (!structuralFallback || !isTrustedPostUploadVisibilitySelectFallback(element))) {
        return null;
      }
      const trigger =
        !hasPublicVisibilitySignal(textSignal) && isTrustedPostUploadVisibilitySelectFallback(element)
          ? nearestTrustedPostUploadVisibilitySelectFallbackTrigger(element)
          : resolveVisibilityClickTarget(element);
      return {
        element: trigger,
        score: publishVisibilitySelectTriggerScore(trigger, sourceIndex, !semanticCandidate)
      };
    })
    .filter((candidate): candidate is { element: HTMLElement; score: number } => candidate !== null)
    .sort((left, right) => right.score - left.score)
    .map(({ element }) => element);
  return uniqueVisibilityElements(candidates);
};

const findPostUploadStructuralVisibilitySelectFallbackTriggers = (): HTMLElement[] =>
  findLikelyPublishVisibilitySelectTriggers(true).filter(isTrustedPostUploadVisibilitySelectFallback);

const findVisibilityTriggers = (): HTMLElement[] => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  const explicitContextTriggers = findVisibilityTriggersFromExplicitContext();
  const directTriggers = Array.from(document.querySelectorAll<HTMLElement>(visibilityControlSelector))
    .map((element) => {
      const signal = elementTextSignal(element);
      return (
        isVisibleElement(element) &&
        !isDisabledElement(element) &&
        hasVisibilityTriggerSignal(signal) &&
        visibilityTriggerActionPattern.test(
          `${element.tagName.toLowerCase()} ${getElementAttribute(element, "role") ?? ""} ${visibilityStructuralSignal(element)}`
        ) &&
        !nonSubmitPublishPattern.test(textContentOf(element))
      )
        ? element
        : null;
    });
  const publicDefaultTriggers = Array.from(document.querySelectorAll<HTMLElement>(visibilityControlSelector)).map((element) => {
    const textSignal = elementTextSignal(element);
    const structuralSignal = visibilityStructuralSignal(element);
    const publicDefaultWithVisibilityStructure =
      hasPublicVisibilitySignal(textSignal) && visibilityStructuralPattern.test(structuralSignal);
    return publicDefaultWithVisibilityStructure &&
      isVisibleElement(element) &&
      !isDisabledElement(element) &&
      !nonSubmitPublishPattern.test(textContentOf(element))
      ? resolveVisibilityClickTarget(element)
      : null;
  });
  return uniqueVisibilityElements([
    ...explicitContextTriggers,
    ...findLikelyPublishVisibilitySelectTriggers(),
    ...publicDefaultTriggers,
    ...directTriggers,
    ...findPlainPublicVisibilityValueFallbackTriggers(),
    ...findPostUploadStructuralVisibilitySelectFallbackTriggers()
  ]);
};

const findVisibilityTriggersForSelection = (
  options: VisibilityControlSelectionOptions = {}
): HTMLElement[] => {
  const triggers = findVisibilityTriggers();
  if (typeof options.maxTriggerActivations !== "number") {
    return triggers;
  }
  const likelyTriggers = findLikelyPublishVisibilitySelectTriggers();
  const structuralFallbackTriggers = findPostUploadStructuralVisibilitySelectFallbackTriggers();
  return uniqueVisibilityElements([
    ...structuralFallbackTriggers,
    ...triggers.slice(0, 1),
    ...likelyTriggers,
    ...triggers,
  ]);
};

const findPlainPublicVisibilityValueFallbackTriggers = (): HTMLElement[] => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  const interactiveTriggers = Array.from(document.querySelectorAll<HTMLElement>(plainPublicVisibilityValueSelector));
  const textTriggers = Array.from(document.querySelectorAll<HTMLElement>(plainPublicVisibilityTextValueSelector)).filter(
    hasPlainPublicVisibilityTextContext
  );
  return uniqueVisibilityElements(
    [...interactiveTriggers, ...textTriggers].map((element) => {
      if (!isVisibleElement(element) || isDisabledElement(element) || !isShortPublicVisibilityValue(element)) {
        return null;
      }
      return resolvePlainPublicVisibilityClickTarget(element);
    })
  );
};

const visibilityActivationEventInit = (
  element: HTMLElement,
  eventName: string
): MouseEventInit & PointerEventInit => {
  const rect = element.getBoundingClientRect();
  const clientX = Math.max(0, Math.floor(rect.left + rect.width / 2));
  const clientY = Math.max(0, Math.floor(rect.top + rect.height / 2));
  const isDownEvent = /down/iu.test(eventName);
  const isMoveOrOverEvent = /move|over/iu.test(eventName);
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: typeof window !== "undefined" ? window : null,
    detail: eventName === "click" ? 1 : 0,
    button: 0,
    buttons: isDownEvent || isMoveOrOverEvent ? 1 : 0,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true
  };
};

const dispatchVisibilityActivationEvent = (element: HTMLElement, eventName: string): void => {
  if (typeof element.dispatchEvent !== "function") {
    return;
  }
  try {
    const EventCtor =
      eventName.startsWith("pointer") && typeof PointerEvent === "function"
        ? PointerEvent
        : typeof MouseEvent === "function"
          ? MouseEvent
          : Event;
    element.dispatchEvent(new EventCtor(eventName, visibilityActivationEventInit(element, eventName)));
  } catch {
    // Some test/runtime shims expose partial event constructors. The native click below remains the fallback.
  }
};

const dispatchVisibilityKeyboardActivationEvent = (
  element: HTMLElement,
  eventName: string,
  key: string
): void => {
  if (typeof element.dispatchEvent !== "function") {
    return;
  }
  try {
    const event =
      typeof KeyboardEvent === "function"
        ? new KeyboardEvent(eventName, { bubbles: true, cancelable: true, key })
        : new Event(eventName, { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
  } catch {
    // Some test/runtime shims expose partial event constructors. Pointer events and click remain the fallback.
  }
};

const isSelectLikeVisibilityActivationTarget = (element: HTMLElement): boolean => {
  const signal = `${element.tagName.toLowerCase()} ${getElementAttribute(element, "role") ?? ""} ${visibilityStructuralSignal(element)}`;
  return /combobox|listbox|select|dropdown|permission-card|d-select|reds-select|el-select|semi-select|ant-select/iu.test(signal);
};

const isXhsDSelectActivationTarget = (element: HTMLElement): boolean => {
  const signal = visibilityStructuralSignal(element);
  return (
    !/permission-card/iu.test(signal) &&
    /(^|[\s_-])d-select($|[\s_-])|d-select-wrapper|d-select-main|d-select-content|d-select-placeholder/iu.test(signal)
  );
};

const activateVisibilityTrigger = (trigger: HTMLElement): void => {
  const isXhsDSelectTarget = isXhsDSelectActivationTarget(trigger);
  const eventNames = isXhsDSelectTarget
    ? [
        "pointerover",
        "mouseover",
        "pointermove",
        "mousemove",
        "pointerdown",
        "mousedown",
        "pointerup",
        "mouseup"
      ]
    : ["pointerdown", "mousedown", "mouseup", "pointerup"];
  for (const eventName of eventNames) {
    dispatchVisibilityActivationEvent(trigger, eventName);
  }
  if (!isXhsDSelectTarget) {
    trigger.click();
  }
  if (!isSelectLikeVisibilityActivationTarget(trigger)) {
    return;
  }
  if (typeof trigger.focus === "function") {
    trigger.focus();
  }
  for (const key of ["Enter", " "]) {
    dispatchVisibilityKeyboardActivationEvent(trigger, "keydown", key);
    dispatchVisibilityKeyboardActivationEvent(trigger, "keyup", key);
  }
};

const nestedVisibilityActivationSelector = [
  '[role="button"]',
  '[role="combobox"]',
  '[class*="select" i]',
  '[class*="dropdown" i]',
  '[class*="permission" i]',
  '[class*="visibility" i]',
  '[class*="privacy" i]',
  '[class*="current" i]',
  '[class*="value" i]',
  '[class*="indicator" i]',
  '[class*="grid" i]',
  '[class*="d-select-prefix" i]',
  '[class*="d-select-main" i]',
  '[class*="d-select-content" i]',
  '[class*="d-select-placeholder" i]',
  '[class*="d-select-suffix" i]',
  '[class*="d-text" i]',
  '[tabindex]',
  "button",
  "label",
  "input",
  "svg",
  "use",
  "path",
  "i",
  "span"
].join(",");

const visibilityActivationTargetScore = (element: HTMLElement, sourceIndex: number): number => {
  const structuralSignal = visibilityStructuralSignal(element);
  const textSignal = elementTextSignal(element);
  let score = 0;
  if (/permission-card-select|d-select-wrapper|reds-select|select|dropdown/iu.test(structuralSignal)) {
    score += 90;
  }
  if (/d-select-suffix|indicator|icon|svg/iu.test(structuralSignal)) {
    score += 140;
  }
  if (hasPublicVisibilitySignal(textSignal) && !hasPrivateVisibilitySignal(textSignal)) {
    score += 40;
  }
  if (isVisibilityClickTarget(element)) {
    score += 25;
  }
  return score * 1_000 - sourceIndex;
};

const isNestedSelectLikeVisibilityActivationCandidate = (
  element: HTMLElement,
  boundary: HTMLElement
): boolean => {
  if (!isVisibleElement(element) || isDisabledElement(element)) {
    return false;
  }
  const structuralSignal = visibilityStructuralSignal(element);
  const textSignal = elementTextSignal(element);
  const boundaryAllowsStructuralFallback = isTrustedPostUploadVisibilitySelectFallback(boundary);
  const hasSelectLikeAncestor = (() => {
    let current: HTMLElement | null = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
      if (isSelectLikeVisibilityActivationTarget(current)) {
        return true;
      }
      if (current === boundary) {
        break;
      }
      current = current.parentElement;
    }
    return false;
  })();
  if (
    !visibilityStructuralPattern.test(structuralSignal) &&
    !/\b(?:d-)?grid\b/iu.test(structuralSignal) &&
    !(boundaryAllowsStructuralFallback && hasSelectLikeAncestor)
  ) {
    return false;
  }
  if (
    (!hasPublicVisibilitySignal(textSignal) && !boundaryAllowsStructuralFallback) ||
    hasPrivateVisibilitySignal(textSignal) ||
    nonSubmitPublishPattern.test(textContentOf(element))
  ) {
    return false;
  }
  return hasSelectLikeAncestor;
};

const isElementWithinVisibilityBoundary = (element: HTMLElement, boundary: HTMLElement): boolean => {
  if (element === boundary) {
    return true;
  }
  if (typeof boundary.contains === "function") {
    try {
      return boundary.contains(element);
    } catch {
      // Fall through to the parentElement walk for partial DOM shims.
    }
  }
  let current: HTMLElement | null = element.parentElement;
  for (let depth = 0; current && depth < 12; depth += 1) {
    if (current === boundary) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const resolveCenterHitTestVisibilityActivationTarget = (trigger: HTMLElement): HTMLElement | null => {
  if (
    typeof document === "undefined" ||
    typeof document.elementFromPoint !== "function" ||
    !isTrustedPostUploadVisibilitySelectFallback(trigger)
  ) {
    return null;
  }
  const rect = trigger.getBoundingClientRect();
  const width = Number.isFinite(rect.width) ? rect.width : 0;
  const height = Number.isFinite(rect.height) ? rect.height : 0;
  if (width <= 0 || height <= 0) {
    return null;
  }
  const left = Number.isFinite(rect.left) ? rect.left : 0;
  const top = Number.isFinite(rect.top) ? rect.top : 0;
  const hitElement = document.elementFromPoint(left + width / 2, top + height / 2);
  if (!(hitElement instanceof HTMLElement)) {
    return null;
  }
  if (!isElementWithinVisibilityBoundary(hitElement, trigger)) {
    return null;
  }
  if (!isVisibleElement(hitElement) || isDisabledElement(hitElement)) {
    return null;
  }
  return hitElement;
};

const resolveNestedVisibilityActivationTargets = (trigger: HTMLElement): HTMLElement[] => {
  if (typeof trigger.querySelectorAll !== "function") {
    return [trigger];
  }
  const triggerUsesStructuralFallback =
    /d-select-wrapper|custom-select-44|permission-card-select/iu.test(visibilityStructuralSignal(trigger)) ||
    (isTrustedPostUploadVisibilitySelectFallback(trigger) && !hasPublicVisibilitySignal(elementTextSignal(trigger)));
  const centerHitTestTarget = triggerUsesStructuralFallback
    ? resolveCenterHitTestVisibilityActivationTarget(trigger)
    : null;
  const nested = Array.from(trigger.querySelectorAll<HTMLElement>(nestedVisibilityActivationSelector))
    .filter((element) =>
      element instanceof HTMLElement &&
      (isVisibilityClickTarget(element) || isNestedSelectLikeVisibilityActivationCandidate(element, trigger))
    )
    .map((element, sourceIndex) => ({
      element,
      score: visibilityActivationTargetScore(element, sourceIndex)
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ element }) => element);
  return triggerUsesStructuralFallback
    ? uniqueVisibilityElements([centerHitTestTarget, trigger, ...nested])
    : uniqueVisibilityElements([...nested, trigger]);
};

type VisibilityControlSelectionOptions = {
  runId?: string;
  deadlineMs?: number;
  maxTriggerActivations?: number;
  openedOptionTimeoutMs?: number;
  boundedScrollAttempts?: number;
};

const remainingSelectionTime = (deadline: number | null): number =>
  deadline === null ? Number.POSITIVE_INFINITY : Math.max(0, deadline - Date.now());

const waitForOpenedPrivateVisibilityOption = async (
  timeoutMs: number,
  deadline: number | null = null
): Promise<HTMLElement | null> => {
  const effectiveTimeoutMs = Math.min(timeoutMs, remainingSelectionTime(deadline));
  if (effectiveTimeoutMs <= 0) {
    return null;
  }
  const effectiveDeadline = Date.now() + effectiveTimeoutMs;
  do {
    const openedPrivateOption = findPrivateVisibilityOption(true);
    if (openedPrivateOption) {
      return openedPrivateOption;
    }
    if (Date.now() >= effectiveDeadline) {
      return null;
    }
    await sleep(150);
  } while (true);
};

const visibilityDebuggerClickDiagnostics = (
  target: HTMLElement,
  response: XhsControlledVisibilityDebuggerClickResponse
): JsonRecord => ({
  attempted: true,
  target_locator: locatorForElement(target),
  target_structural_signal: visibilityStructuralSignal(target).slice(0, 160),
  response_ok: response.ok,
  ...(response.error?.code ? { error_code: response.error.code } : {}),
  ...(response.error?.message ? { error_message: response.error.message.slice(0, 160) } : {})
});

const clickFirstOpenedPrivateVisibilityOption = async (
  triggers: HTMLElement[],
  options: VisibilityControlSelectionOptions = {},
  deadline: number | null = null
): Promise<VisibilityControlSelectionResult> => {
  const openedOptionTimeoutMs = options.openedOptionTimeoutMs ?? 2_000;
  const boundedTriggers =
    typeof options.maxTriggerActivations === "number"
      ? triggers.slice(0, Math.max(0, options.maxTriggerActivations))
      : triggers;
  let openedDropdown = false;
  let lastDebuggerClick: JsonRecord | null = null;
  for (const trigger of boundedTriggers) {
    const triggerUsesTrustedPostUploadFallback =
      isTrustedPostUploadVisibilitySelectFallback(trigger) ||
      /d-select-wrapper|custom-select-44/iu.test(visibilityStructuralSignal(trigger));
    if (remainingSelectionTime(deadline) <= 0) {
      return visibilitySelectionBlocked(
        openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
        openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated",
        openedDropdown,
        boundedTriggers.length
      );
    }
    for (const activationTarget of resolveNestedVisibilityActivationTargets(trigger)) {
      if (remainingSelectionTime(deadline) <= 0) {
        return visibilitySelectionBlocked(
          openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
          openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated",
          openedDropdown,
          boundedTriggers.length
        );
      }
      if (typeof activationTarget.click !== "function") {
        continue;
      }
      activateVisibilityTrigger(activationTarget);
      openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
      const activationTargetIsXhsDSelect = isXhsDSelectActivationTarget(activationTarget);
      const activationTargetTimeoutMs = activationTargetIsXhsDSelect
        ? triggerUsesTrustedPostUploadFallback
          ? Math.min(openedOptionTimeoutMs, 600)
          : Math.min(openedOptionTimeoutMs, 180)
        : openedOptionTimeoutMs;
      const openedPrivateOption = await waitForOpenedPrivateVisibilityOption(activationTargetTimeoutMs, deadline);
      openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
      if (!openedPrivateOption && !openedDropdown && (activationTargetIsXhsDSelect || triggerUsesTrustedPostUploadFallback)) {
        if (triggerUsesTrustedPostUploadFallback && options.runId) {
          const debuggerTarget = isTrustedPostUploadVisibilitySelectFallback(trigger) ? trigger : activationTarget;
          const debuggerClick = await requestVisibilityDebuggerClickViaExtension({
            target: debuggerTarget,
            runId: options.runId,
            actionRef: "fr-0032/publish_visibility/d-select-trigger",
            timeoutMs: Math.min(openedOptionTimeoutMs, 1_500)
          });
          lastDebuggerClick = visibilityDebuggerClickDiagnostics(debuggerTarget, debuggerClick);
          if (debuggerClick.ok) {
            openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
            const debuggerOpenedPrivateOption = await waitForOpenedPrivateVisibilityOption(
              Math.min(openedOptionTimeoutMs, 1_200),
              deadline
            );
            openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
            if (debuggerOpenedPrivateOption && typeof debuggerOpenedPrivateOption.click === "function") {
              const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(debuggerOpenedPrivateOption);
              optionClickTarget.click();
              await sleep(300);
              const selectedSignal = elementTextSignal(debuggerOpenedPrivateOption);
              if (
                hasPrivateVisibilitySignal(selectedSignal) &&
                !hasPublicVisibilitySignal(selectedSignal) &&
                (!openedDropdown || hasConfirmedPrivateVisibilitySelection(trigger))
              ) {
                return visibilitySelectionSuccess(optionClickTarget, openedDropdown, boundedTriggers.length, lastDebuggerClick);
              }
              return visibilitySelectionBlocked(
                "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED",
                "publish_visibility_option_selection_failed",
                openedDropdown,
                boundedTriggers.length,
                lastDebuggerClick
              );
            }
          }
        }
        activationTarget.click();
        openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
        const clickOpenedPrivateOption = await waitForOpenedPrivateVisibilityOption(
          triggerUsesTrustedPostUploadFallback
            ? Math.min(openedOptionTimeoutMs, 600)
            : Math.min(openedOptionTimeoutMs, 320),
          deadline
        );
        openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
        if (clickOpenedPrivateOption && typeof clickOpenedPrivateOption.click === "function") {
          const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(clickOpenedPrivateOption);
          optionClickTarget.click();
          await sleep(300);
          const selectedSignal = elementTextSignal(clickOpenedPrivateOption);
          if (
            hasPrivateVisibilitySignal(selectedSignal) &&
            !hasPublicVisibilitySignal(selectedSignal) &&
            (!openedDropdown || hasConfirmedPrivateVisibilitySelection(trigger))
          ) {
            return visibilitySelectionSuccess(optionClickTarget, openedDropdown, boundedTriggers.length);
          }
          return visibilitySelectionBlocked(
            "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED",
            "publish_visibility_option_selection_failed",
            openedDropdown,
            boundedTriggers.length,
            lastDebuggerClick
          );
        }
      }
      if (openedPrivateOption && typeof openedPrivateOption.click === "function") {
        const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(openedPrivateOption);
        optionClickTarget.click();
        await sleep(300);
        const selectedSignal = elementTextSignal(openedPrivateOption);
        if (
          hasPrivateVisibilitySignal(selectedSignal) &&
          !hasPublicVisibilitySignal(selectedSignal) &&
          (!openedDropdown || hasConfirmedPrivateVisibilitySelection(trigger))
        ) {
          return visibilitySelectionSuccess(optionClickTarget, openedDropdown, boundedTriggers.length);
        }
        return visibilitySelectionBlocked(
          "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED",
          "publish_visibility_option_selection_failed",
          openedDropdown,
          boundedTriggers.length,
          lastDebuggerClick
        );
      }
    }
  }
  if (openedDropdown || hasMountedPrivateVisibilityOption()) {
    return visibilitySelectionBlocked(
      "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED",
      "publish_visibility_portal_option_not_selected",
      openedDropdown,
      boundedTriggers.length,
      lastDebuggerClick
    );
  }
  return visibilitySelectionBlocked(
    "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
    "publish_visibility_d_select_trigger_not_activated",
    false,
    boundedTriggers.length,
    lastDebuggerClick
  );
};

const selectPrivateVisibilityControl = async (
  options: VisibilityControlSelectionOptions = {}
): Promise<VisibilityControlSelectionResult> => {
  const deadline =
    typeof options.deadlineMs === "number" ? Date.now() + Math.max(0, options.deadlineMs) : null;
  const visiblePrivateOption = findPrivateVisibilityOption();
  if (visiblePrivateOption) {
    const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(visiblePrivateOption);
    optionClickTarget.click();
    await sleep(300);
    return visibilitySelectionSuccess(optionClickTarget, findVisibleVisibilityDropdownPortal() !== null, 0);
  }
  const triggers = findVisibilityTriggersForSelection(options);
  if (triggers.length > 0) {
    const openedOptionResult = await clickFirstOpenedPrivateVisibilityOption(triggers, options, deadline);
    if (openedOptionResult.selectedOption) {
      return openedOptionResult;
    }
    if (
      openedOptionResult.blockerCode === "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" ||
      openedOptionResult.blockerCode === "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED"
    ) {
      return openedOptionResult;
    }
  }
  if (remainingSelectionTime(deadline) <= 0) {
    return visibilitySelectionBlocked(
      "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
      "publish_visibility_d_select_trigger_not_activated",
      false,
      triggers.length
    );
  }
  if (await openVisibilitySettingsDisclosure()) {
    const privateOptionAfterDisclosure = findPrivateVisibilityOption();
    if (privateOptionAfterDisclosure) {
      const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(privateOptionAfterDisclosure);
      optionClickTarget.click();
      await sleep(300);
      const dropdownVisible = findVisibleVisibilityDropdownPortal() !== null;
      if (!dropdownVisible || hasConfirmedPrivateVisibilitySelection(nearestVisibilityConfirmationRoot(optionClickTarget))) {
        return visibilitySelectionSuccess(
          optionClickTarget,
          dropdownVisible,
          triggers.length
        );
      }
      return visibilitySelectionBlocked(
        "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED",
        "publish_visibility_option_selection_failed",
        dropdownVisible,
        triggers.length
      );
    }
    const triggersAfterDisclosure = findVisibilityTriggersForSelection(options);
    const openedOptionAfterDisclosureResult = await clickFirstOpenedPrivateVisibilityOption(
      triggersAfterDisclosure,
      options,
      deadline
    );
    if (openedOptionAfterDisclosureResult.selectedOption) {
      return openedOptionAfterDisclosureResult;
    }
    return openedOptionAfterDisclosureResult;
  }
  if (remainingSelectionTime(deadline) <= 0) {
    return visibilitySelectionBlocked(
      "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
      "publish_visibility_d_select_trigger_not_activated",
      false,
      triggers.length
    );
  }
  return selectPrivateVisibilityControlAfterBoundedScroll(options, deadline);
};

const scrollPublishEditorForLazyVisibilityControls = (): boolean => {
  const scrollTargets = resolvePublishEditorScrollTargets();
  if (scrollTargets.length === 0) {
    return false;
  }
  const viewportHeight =
    typeof window !== "undefined" &&
    typeof window.innerHeight === "number" && Number.isFinite(window.innerHeight)
      ? window.innerHeight
      : 800;
  const scrollDistance = Math.max(240, Math.floor(viewportHeight * 0.7));
  let scrolled = false;
  for (const scrollTarget of scrollTargets) {
    const before = scrollTarget.scrollTop;
    if (typeof scrollTarget.scrollBy === "function") {
      scrollTarget.scrollBy({ top: scrollDistance, left: 0, behavior: "instant" });
    }
    if (scrollTarget.scrollTop === before && canScrollPublishEditorElement(scrollTarget)) {
      scrollTarget.scrollTop = before + scrollDistance;
    }
    scrolled = scrollTarget.scrollTop !== before || scrolled;
  }
  if (typeof window !== "undefined" && typeof window.scrollBy === "function") {
    const beforeWindowScroll =
      typeof window.scrollY === "number" && Number.isFinite(window.scrollY)
        ? window.scrollY
        : null;
    window.scrollBy({ top: scrollDistance, left: 0, behavior: "instant" });
    const afterWindowScroll =
      typeof window.scrollY === "number" && Number.isFinite(window.scrollY)
        ? window.scrollY
        : null;
    scrolled = (beforeWindowScroll !== null && afterWindowScroll !== beforeWindowScroll) || scrolled;
  }
  return scrolled;
};

const resolvePublishEditorScrollTargets = (): HTMLElement[] => {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") {
    return [];
  }
  const href =
    typeof location !== "undefined" && typeof location.href === "string"
      ? location.href
      : typeof window !== "undefined" && typeof window.location?.href === "string"
        ? window.location.href
        : "";
  let pageUrl: URL | null = null;
  try {
    pageUrl = new URL(href);
  } catch {
    pageUrl = null;
  }
  if (pageUrl?.hostname !== "creator.xiaohongshu.com" || !pageUrl.pathname.startsWith("/publish")) {
    return [];
  }
  const editorRoots = uniqueVisibilityElements(
    Array.from(document.querySelectorAll<HTMLElement>([
      ".publish-page-content",
      '[class*="publish-content" i]',
      ".publish-page",
      '[class*="publish-page" i]',
      ".style-override-container"
    ].join(","))).filter((element) => isVisibleElement(element))
  ).sort((left, right) => publishEditorRootPriority(left) - publishEditorRootPriority(right));
  const scrollingElement =
    document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
  const documentElement =
    document.documentElement instanceof HTMLElement ? document.documentElement : null;
  const body = document.body instanceof HTMLElement ? document.body : null;
  const scrollableRoots = uniqueVisibilityElements(
    editorRoots.map((editorRoot) => findNearestScrollablePublishEditorContainer(editorRoot))
  );
  return uniqueVisibilityElements([
    ...(scrollableRoots.length > 0 ? scrollableRoots : [editorRoots[0] ?? null]),
    scrollingElement,
    documentElement,
    body
  ]);
};

const publishEditorRootPriority = (element: HTMLElement): number => {
  const classSignal = getElementAttribute(element, "class") ?? "";
  if (/publish-page-content|publish-content/iu.test(classSignal)) {
    return 0;
  }
  if (/publish-page/iu.test(classSignal)) {
    return 1;
  }
  if (/style-override-container/iu.test(classSignal)) {
    return 2;
  }
  return 3;
};

const canScrollPublishEditorElement = (element: HTMLElement): boolean => {
  const style =
    typeof getComputedStyle === "function" ? getComputedStyle(element) : null;
  const overflowY = style?.overflowY ?? "";
  const canScrollByGeometry = element.scrollHeight > element.clientHeight + 16;
  const canScrollByStyle = /auto|scroll|overlay/iu.test(overflowY);
  return canScrollByGeometry || canScrollByStyle;
};

const findNearestScrollablePublishEditorContainer = (element: HTMLElement): HTMLElement | null => {
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (canScrollPublishEditorElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const selectPrivateVisibilityControlAfterBoundedScroll = async (
  options: VisibilityControlSelectionOptions = {},
  deadline: number | null = null
): Promise<VisibilityControlSelectionResult> => {
  const maxAttempts = options.boundedScrollAttempts ?? 4;
  let openedDropdown = false;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (remainingSelectionTime(deadline) <= 0) {
      return visibilitySelectionBlocked(
        openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
        openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated",
        openedDropdown,
        0
      );
    }
    if (!scrollPublishEditorForLazyVisibilityControls()) {
      return visibilitySelectionBlocked(
        openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
        openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated",
        openedDropdown,
        0
      );
    }
    await sleep(250);
    const visiblePrivateOption = findPrivateVisibilityOption();
    if (visiblePrivateOption) {
      const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(visiblePrivateOption);
      optionClickTarget.click();
      await sleep(300);
      const dropdownVisible = findVisibleVisibilityDropdownPortal() !== null;
      if (!dropdownVisible || hasConfirmedPrivateVisibilitySelection(nearestVisibilityConfirmationRoot(optionClickTarget))) {
        return visibilitySelectionSuccess(optionClickTarget, dropdownVisible, 0);
      }
      return visibilitySelectionBlocked(
        "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED",
        "publish_visibility_option_selection_failed",
        dropdownVisible,
        0
      );
    }
    const triggers = findVisibilityTriggersForSelection(options);
    const openedOptionResult = await clickFirstOpenedPrivateVisibilityOption(triggers, options, deadline);
    openedDropdown = openedOptionResult.openedDropdown || openedDropdown;
    if (openedOptionResult.selectedOption) {
      return openedOptionResult;
    }
    if (
      openedOptionResult.blockerCode === "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" ||
      openedOptionResult.blockerCode === "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED"
    ) {
      return openedOptionResult;
    }
    if (remainingSelectionTime(deadline) <= 0) {
      return openedOptionResult;
    }
    if (await openVisibilitySettingsDisclosure()) {
      const triggersAfterDisclosure = findVisibilityTriggersForSelection(options);
      const openedOptionAfterDisclosureResult = await clickFirstOpenedPrivateVisibilityOption(
        triggersAfterDisclosure,
        options,
        deadline
      );
      openedDropdown = openedOptionAfterDisclosureResult.openedDropdown || openedDropdown;
      if (openedOptionAfterDisclosureResult.selectedOption) {
        return openedOptionAfterDisclosureResult;
      }
    }
  }
  return visibilitySelectionBlocked(
    openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
    openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated",
    openedDropdown,
    0
  );
};

const currentHref = (): string | null =>
  typeof window !== "undefined" && window.location?.href
    ? window.location.href
    : typeof location !== "undefined" && location.href
      ? location.href
      : null;

const noteIdFromHref = (href: string): string | null => {
  const match =
    /[?&](?:note_id|noteId|source_note_id)=([A-Za-z0-9_-]{8,64})(?:&|$)/u.exec(href) ??
    /\/(?:explore|notes?|note|publish\/success)\/([A-Za-z0-9_-]{8,64})(?:[/?#]|$)/u.exec(href);
  return match?.[1] ?? null;
};

const publishResultNoteIdAttributeNames = [
  "data-note-id",
  "data-noteid",
  "data-note-oid",
  "data-source-note-id"
] as const;

type PagePublishIdentityCandidate = {
  noteId: string | null;
  platformRecordRef: string | null;
  locator: string;
};

type PagePublishIdentityCandidateSnapshot = PagePublishIdentityCandidate & {
  key: string;
};

const normalizePublishResultIdentityValue = (value: string | null): string | null => {
  const normalized = value?.trim() ?? "";
  if (
    normalized.length < 6 ||
    normalized.length > 128 ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:") ||
    /^https?:\/\//iu.test(normalized) ||
    !/^[A-Za-z0-9_-]+$/u.test(normalized)
  ) {
    return null;
  }
  return normalized;
};

const publishResultIdentityCandidateSelector = [
  'a[href*="/explore/"]',
  'a[href*="/note/"]',
  'a[href*="note_id="]',
  ...publishResultNoteIdAttributeNames.map((name) => `[${name}]`)
].join(",");

const publishSuccessContainerSelector = [
  "[role='dialog']",
  "[role='alert']",
  "[role='status']",
  "[class*='success' i]",
  "[class*='result' i]",
  "[class*='publish' i]",
  "[class*='note' i]",
  "section",
  "article",
  "div"
].join(",");

const readPublishIdentityCandidateFromElement = (
  element: Element
): PagePublishIdentityCandidate | null => {
  if (!(element instanceof HTMLElement) || !isVisibleElement(element)) {
    return null;
  }
  const href = getElementAttribute(element, "href");
  const hrefNoteId = href ? noteIdFromHref(href) : null;
  if (hrefNoteId) {
    return {
      noteId: hrefNoteId,
      platformRecordRef: null,
      locator: locatorForElement(element)
    };
  }
  for (const name of publishResultNoteIdAttributeNames) {
    const noteId = normalizePublishResultIdentityValue(getElementAttribute(element, name));
    if (noteId) {
      return {
        noteId,
        platformRecordRef: null,
        locator: `${locatorForElement(element)}[${name}]`
      };
    }
  }
  return null;
};

const publishIdentityCandidateElementsIn = (container: Element): Element[] => {
  const elements = [container];
  if (typeof container.querySelectorAll === "function") {
    elements.push(...Array.from(container.querySelectorAll<Element>(publishResultIdentityCandidateSelector)));
  }
  return elements;
};

const pagePublishIdentityCandidateKey = (candidate: PagePublishIdentityCandidate): string =>
  candidate.noteId ? `note:${candidate.noteId}` : `record:${candidate.platformRecordRef ?? ""}`;

const collectPagePublishIdentityCandidates = (): PagePublishIdentityCandidateSnapshot[] => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  const successContainers = Array.from(document.querySelectorAll<Element>(publishSuccessContainerSelector))
    .filter((element) => element instanceof HTMLElement && isVisibleElement(element))
    .filter((element) => publishSuccessPattern.test(elementDisplayedTextSignal(element)))
    .filter((element) => textContentOf(element).length <= 240);
  const candidates: PagePublishIdentityCandidateSnapshot[] = [];
  for (const container of successContainers) {
    for (const element of publishIdentityCandidateElementsIn(container)) {
      const candidate = readPublishIdentityCandidateFromElement(element);
      if (candidate) {
        candidates.push({
          ...candidate,
          key: pagePublishIdentityCandidateKey(candidate)
        });
      }
    }
  }
  return candidates;
};

const findPagePublishIdentityCandidate = (
  previousCandidateKeys: Set<string>
): PagePublishIdentityCandidate | null => {
  return collectPagePublishIdentityCandidates().find(
    (candidate) => !previousCandidateKeys.has(candidate.key)
  ) ?? null;
};

const publishActionPendingPattern = /发布中|正在发布|提交中|审核中|publishing|submitting|loading/iu;

const readPublishActionActivation = (
  submitControl: HTMLElement,
  initialHref: string,
  initialDocumentText: string,
  previousPageIdentityKeys: Set<string>
): PublishActionActivationResult => {
  const href = currentHref();
  if (href && href !== initialHref) {
    return {
      activated: true,
      signal: "url_changed",
      href,
      controlDisabled: false,
      controlBusy: false
    };
  }
  if (findPagePublishIdentityCandidate(previousPageIdentityKeys)) {
    return {
      activated: true,
      signal: "page_publish_identity_candidate",
      href,
      controlDisabled: false,
      controlBusy: false
    };
  }
  const documentText =
    typeof document !== "undefined" && document.documentElement
      ? textContentOf(document.documentElement)
      : "";
  const documentTextChanged = documentText !== initialDocumentText;
  if (documentTextChanged && publishSuccessPattern.test(documentText)) {
    return {
      activated: true,
      signal: "publish_success_text",
      href,
      controlDisabled: false,
      controlBusy: false
    };
  }
  if (documentTextChanged && publishActionPendingPattern.test(documentText)) {
    return {
      activated: true,
      signal: "publish_pending_text",
      href,
      controlDisabled: false,
      controlBusy: false
    };
  }
  const controlDisabled =
    (typeof submitControl.hasAttribute === "function" && submitControl.hasAttribute("disabled")) ||
    submitControl.getAttribute("aria-disabled") === "true" ||
    (submitControl as HTMLButtonElement).disabled === true;
  const controlClassName =
    typeof submitControl.className === "string" ? submitControl.className : "";
  const controlBusy =
    submitControl.getAttribute("aria-busy") === "true" ||
    /loading|disabled|pending|submitting|publishing/iu.test(controlClassName);
  return {
    activated: controlDisabled || controlBusy,
    signal: controlDisabled ? "submit_control_disabled" : controlBusy ? "submit_control_busy" : null,
    href,
    controlDisabled,
    controlBusy
  };
};

const waitForPublishActionActivation = async (
  submitControl: HTMLElement,
  initialHref: string,
  initialDocumentText: string,
  previousPageIdentityKeys: Set<string>,
  timeoutMs: number
): Promise<PublishActionActivationResult> => {
  const deadline = Date.now() + Math.max(1, timeoutMs);
  let latest = readPublishActionActivation(
    submitControl,
    initialHref,
    initialDocumentText,
    previousPageIdentityKeys
  );
  while (!latest.activated && Date.now() < deadline) {
    await sleep(250);
    latest = readPublishActionActivation(
      submitControl,
      initialHref,
      initialDocumentText,
      previousPageIdentityKeys
    );
  }
  return latest;
};

const buildPublishIdentity = (
  input: XhsControlledLiveWriteInput,
  artifact: ControlledUploadArtifactIdentity,
  submitEvidence: SubmitEvidence,
  initialHref: string,
  successLocator: string,
  previousPageIdentityKeys: Set<string>
): PublishResultIdentity | null => {
  const href = currentHref();
  if (!href) {
    return null;
  }
  const noteId = noteIdFromHref(href);
  const successText =
    typeof document !== "undefined" &&
    document.documentElement !== null &&
    publishSuccessPattern.test(textContentOf(document.documentElement));
  const creatorResultUrl =
    href !== initialHref && /^https:\/\/creator\.xiaohongshu\.com\//iu.test(href) ? href : null;
  const pageIdentity = findPagePublishIdentityCandidate(previousPageIdentityKeys);
  const pageSuccessText = successText || pageIdentity !== null;
  const resultNoteId = noteId ?? pageIdentity?.noteId ?? null;
  const platformRecordRef = pageIdentity?.platformRecordRef ?? null;
  if (!resultNoteId && !creatorResultUrl && !platformRecordRef) {
    return null;
  }
  const timestamp = nowIso();
  const resultKind = resultNoteId
    ? "note_id"
    : creatorResultUrl
      ? "creator_result_page"
      : "platform_publish_record";
  return {
    schema_version: "fr-0032.publish_result_identity.v1",
    publish_result_id: `publish-result/fr-0032/${input.live_write_attempt_id}`,
    live_write_attempt_id: input.live_write_attempt_id,
    run_id: input.run_id,
    profile_ref: input.profile_ref ?? "unknown",
    target_tab_id: input.target_tab_id ?? 0,
    target_domain: "creator.xiaohongshu.com",
    target_page: "creator_publish_tab",
    source_upload_artifact_id: artifact.upload_artifact_id,
    submit_action_ref: submitEvidence.submit_action_ref,
    result_kind: resultKind,
    note_id: resultNoteId,
    published_url: resultNoteId ? `https://www.xiaohongshu.com/explore/${resultNoteId}` : null,
    creator_result_url: creatorResultUrl,
    platform_record_ref: platformRecordRef,
    publish_visibility_scope: input.publish_visibility_scope,
    success_signal: {
      signal_source: creatorResultUrl ? "creator_result_page" : "current_page_state",
      signal_locator: creatorResultUrl ?? pageIdentity?.locator ?? successLocator,
      platform_message: pageSuccessText ? "publish success text observed" : null,
      observed_at: timestamp
    },
    captured_at: timestamp,
    verification_state: "verified"
  };
};

const performControlledSubmitPublishCleanup = async (
  input: XhsControlledLiveWriteInput,
  artifact: ControlledUploadArtifactIdentity
): Promise<XhsControlledLiveWriteResult> => {
  const timestamp = nowIso();
  const acceptedUploadResume = input.accepted_upload_artifact_identity?.accepted_by_platform === true;
  const continuationVisibilitySelectionOptions: VisibilityControlSelectionOptions =
    input.background_upload_capture_continuation === true || acceptedUploadResume
      ? {
          runId: input.run_id,
          deadlineMs: 12_000,
          maxTriggerActivations: 4,
          openedOptionTimeoutMs: 1_200,
          boundedScrollAttempts: 2
        }
      : {};
  if (input.publish_visibility_scope !== "private_or_self_visible") {
    return buildStepBlockedResult(input, artifact, {
      blockerCode: "PUBLISH_VISIBILITY_NOT_SELECTED",
      blockerMessage: "Controlled publish only supports private_or_self_visible visibility for FR-0032.",
      detailsRef: "publish_visibility_scope_not_private",
      requiredRecoveryAction: "rerun with publish_visibility_scope=private_or_self_visible",
      stoppedStep: "publish",
      blockerLayer: "publish",
      riskKind: "submit_failure",
      cleanupRequired: true
    }, null, uploadStageCleanupResult(input, timestamp, "non-private visibility refused before submit"));
  }
  let visibilitySelection = await selectPrivateVisibilityControl(continuationVisibilitySelectionOptions);
  if (!visibilitySelection.selectedOption && await continueFromAcceptedUploadStageIfNeeded()) {
    visibilitySelection = await selectPrivateVisibilityControl(continuationVisibilitySelectionOptions);
  }
  if (!visibilitySelection.selectedOption) {
    const diagnostics = {
      ...collectVisibilityLocatorDiagnostics(),
      selection_result: {
        blocker_code: visibilitySelection.blockerCode ?? "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
        details_ref: visibilitySelection.detailsRef ?? "publish_visibility_d_select_trigger_not_activated",
        opened_dropdown: visibilitySelection.openedDropdown,
        trigger_count: visibilitySelection.triggerCount,
        option_locator: visibilitySelection.optionLocator,
        debugger_click: visibilitySelection.debuggerClick,
        observed_symptom: "PUBLISH_VISIBILITY_CONTROL_MISSING"
      }
    };
    const blockerCode = visibilitySelection.blockerCode ?? "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED";
    const detailsRef = visibilitySelection.detailsRef ?? "publish_visibility_d_select_trigger_not_activated";
    return buildStepBlockedResult(input, artifact, {
      blockerCode,
      blockerMessage:
        blockerCode === "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED"
          ? "Controlled publish did not activate the post-upload visibility d-select trigger."
          : blockerCode === "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED"
            ? "Controlled publish opened the visibility dropdown but did not select the private/self-visible option."
            : "Controlled publish found a private/self-visible option but could not confirm selection.",
      detailsRef,
      requiredRecoveryAction:
        blockerCode === "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED"
          ? "update the XHS post-upload d-select trigger locator/activation before retrying publish visibility"
          : blockerCode === "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED"
            ? "update the XHS private/self-visible option locator/click target before retrying publish visibility"
            : "update the XHS visibility option selected-state verification before retrying publish visibility",
      stoppedStep: "publish",
      blockerLayer: "publish",
      riskKind: "submit_failure",
      cleanupRequired: true,
      diagnostics
    }, null, uploadStageCleanupResult(input, timestamp, "private visibility not selected before submit"));
  }
  const selectedVisibilityOption = visibilitySelection.selectedOption;
  const submitControl = findSubmitPublishControl();
  if (!submitControl || typeof submitControl.click !== "function") {
    return buildStepBlockedResult(input, artifact, {
      blockerCode: "SUBMIT_CONTROL_MISSING",
      blockerMessage: "Controlled live write cannot find a safe submit/publish control after upload.",
      detailsRef: "submit_control_missing",
      requiredRecoveryAction: "update the XHS creator submit/publish locator before retrying",
      stoppedStep: "submit",
      blockerLayer: "submit",
      riskKind: "submit_failure",
      cleanupRequired: true
    }, null, uploadStageCleanupResult(input, nowIso(), "submit control missing before publish"));
  }
  const initialHref = currentHref() ?? input.page_url;
  const previousPageIdentityKeys = new Set(
    collectPagePublishIdentityCandidates().map((candidate) => candidate.key)
  );
  const submittedAt = nowIso();
  const initialDocumentText =
    typeof document !== "undefined" && document.documentElement
      ? textContentOf(document.documentElement)
      : "";
  const requiresPublishDebuggerClick =
    input.background_upload_capture_continuation === true && input.profile_ref === "xhs_001";
  let publishDebuggerClick: JsonRecord | null = null;
  if (requiresPublishDebuggerClick) {
    const debuggerClick = await requestPublishDebuggerClickViaExtension({
      target: submitControl,
      runId: input.run_id,
      actionRef: `fr-0032/${input.live_write_attempt_id}/publish-submit`,
      timeoutMs: 3_000
    });
    publishDebuggerClick = {
      ok: debuggerClick.ok,
      ...(debuggerClick.result ? { result: debuggerClick.result } : {}),
      ...(debuggerClick.error ? { error: debuggerClick.error } : {})
    };
    if (!debuggerClick.ok) {
      const unknownSubmitEvidence: SubmitEvidence = {
        submit_action_ref: `submit/fr-0032/${input.live_write_attempt_id}`,
        submit_locator: locatorForElement(submitControl),
        submitted_at: submittedAt,
        submit_result_state: "unknown",
        platform_message: "publish debugger click failed before submit"
      };
      return buildStepBlockedResult(input, artifact, {
        blockerCode: "PUBLISH_ACTION_ENDPOINT_NOT_OBSERVED",
        blockerMessage:
          "Controlled publish could not dispatch the final publish control through the debugger click path.",
        detailsRef: "publish_debugger_click_failed",
        requiredRecoveryAction:
          "repair the XHS final publish debugger click path before retrying publish identity capture",
        stoppedStep: "publish",
        blockerLayer: "publish",
        riskKind: "submit_failure",
        cleanupRequired: true,
        diagnostics: {
          publish_debugger_click: publishDebuggerClick,
          submit_locator: unknownSubmitEvidence.submit_locator
        }
      }, unknownSubmitEvidence, uploadStageCleanupResult(input, nowIso(), "publish debugger click failed; unpublished upload abandoned"));
    }
  } else {
    submitControl.click();
  }
  const submitEvidence: SubmitEvidence = {
    submit_action_ref: `submit/fr-0032/${input.live_write_attempt_id}`,
    submit_locator: locatorForElement(submitControl),
    submitted_at: submittedAt,
    submit_result_state: "accepted",
    platform_message: null
  };
  const isExtensionBrowserSurface = typeof window !== "undefined" && "chrome" in globalThis;
  if (input.background_upload_capture_continuation === true && input.profile_ref === "xhs_001") {
    const activation = await waitForPublishActionActivation(
      submitControl,
      initialHref,
      initialDocumentText,
      previousPageIdentityKeys,
      3_000
    );
    if (!activation.activated) {
      const unknownSubmitEvidence: SubmitEvidence = {
        ...submitEvidence,
        submit_result_state: "unknown",
        platform_message: "publish action click did not produce a local activation signal"
      };
      return buildStepBlockedResult(input, artifact, {
        blockerCode: "PUBLISH_ACTION_ENDPOINT_NOT_OBSERVED",
        blockerMessage:
          "Controlled publish clicked the publish control, but no publish activation signal or endpoint was observed.",
        detailsRef: "publish_action_endpoint_not_observed",
        requiredRecoveryAction:
          "verify the final publish button locator/click activation and require a publish endpoint, URL transition, or pending/success signal before publish identity capture",
        stoppedStep: "publish",
        blockerLayer: "publish",
        riskKind: "submit_failure",
        cleanupRequired: true,
        diagnostics: {
          publish_action_activation: activation,
          ...(publishDebuggerClick ? { publish_debugger_click: publishDebuggerClick } : {}),
          initial_href: initialHref,
          submit_locator: submitEvidence.submit_locator
        }
      }, unknownSubmitEvidence, uploadStageCleanupResult(input, nowIso(), "publish action not activated; unpublished upload abandoned"));
    }
  }
  let publishIdentity: PublishResultIdentity | null = null;
  if (input.background_upload_capture_continuation === true && input.profile_ref === "xhs_001") {
    const deadline = Date.now() + 3_000;
    do {
      publishIdentity = buildPublishIdentity(
        input,
        artifact,
        submitEvidence,
        initialHref,
        locatorForElement(selectedVisibilityOption),
        previousPageIdentityKeys
      );
      if (publishIdentity || Date.now() >= deadline) {
        break;
      }
      await sleep(500);
    } while (true);
  }
  if (input.background_upload_capture_continuation === true || (acceptedUploadResume && isExtensionBrowserSurface)) {
    const backgroundCapturePending = input.background_upload_capture_continuation === true;
    if (!publishIdentity) {
      const residual = {
        residual_record_id: `residual/fr-0032/${input.live_write_attempt_id}/${
          backgroundCapturePending ? "background-identity-pending" : "resume-identity-pending"
        }`,
        live_write_attempt_id: input.live_write_attempt_id,
        publish_result_id: null,
        visibility_scope: input.publish_visibility_scope,
        external_visibility_may_remain: false,
        residual_locator: null,
        reason: "identity_missing_after_publish",
        required_followup: backgroundCapturePending
          ? "merge background publish identity capture before final closeout"
          : "capture publish result identity after accepted-upload resume before final closeout",
        recorded_at: nowIso()
      };
      const cleanup = {
        schema_version: "fr-0032.cleanup_rollback_proof.v1",
        cleanup_result_id: `cleanup/fr-0032/${input.live_write_attempt_id}/${
          backgroundCapturePending ? "identity-pending" : "resume-identity-pending"
        }`,
        live_write_attempt_id: input.live_write_attempt_id,
        run_id: input.run_id,
        profile_ref: input.profile_ref ?? "unknown",
        target_tab_id: input.target_tab_id ?? 0,
        publish_result_identity: null,
        cleanup_policy_ref: input.cleanup_policy_ref,
        cleanup_action: "no_safe_cleanup_action",
        cleanup_outcome: "cleanup_blocked",
        proof_locator: locatorForElement(selectedVisibilityOption),
        platform_message: backgroundCapturePending
          ? "submit accepted; background publish identity capture remains authoritative"
          : "submit accepted; accepted-upload resume returned before page navigation could exceed the native bridge deadline",
        attempted_at: submittedAt,
        completed_at: null,
        residual_record: residual
      };
      return buildStepBlockedResult(input, artifact, {
        blockerCode: "PUBLISH_RESULT_IDENTITY_MISSING",
        blockerMessage: backgroundCapturePending
          ? "Controlled publish submit was accepted; background identity capture is pending."
          : "Controlled publish submit was accepted; publish result identity must be captured after accepted-upload resume.",
        detailsRef: backgroundCapturePending
          ? "background_publish_identity_capture_pending"
          : "accepted_upload_resume_publish_identity_pending",
        requiredRecoveryAction: backgroundCapturePending
          ? "merge background publish identity capture before final closeout"
          : "capture publish result identity after accepted-upload resume before final closeout",
        stoppedStep: "publish_identity",
        blockerLayer: "published_identity",
        riskKind: "publish_identity_missing",
        cleanupRequired: true
      }, submitEvidence, cleanup, residual);
    }
  }
  const deadline = Date.now() + (isExtensionBrowserSurface ? 15_000 : 50);
  if (!publishIdentity) {
    do {
      publishIdentity = buildPublishIdentity(
        input,
        artifact,
        submitEvidence,
        initialHref,
        locatorForElement(selectedVisibilityOption),
        previousPageIdentityKeys
      );
      if (publishIdentity || Date.now() >= deadline) {
        break;
      }
      await sleep(isExtensionBrowserSurface ? 500 : 10);
    } while (true);
  }
  if (!publishIdentity) {
    const residual = {
      residual_record_id: `residual/fr-0032/${input.live_write_attempt_id}/identity-missing`,
      live_write_attempt_id: input.live_write_attempt_id,
      publish_result_id: null,
      visibility_scope: input.publish_visibility_scope,
      external_visibility_may_remain: false,
      residual_locator: null,
      reason: "identity_missing_after_publish",
      required_followup: "capture note_id, creator result URL, or platform record before retrying closeout",
      recorded_at: nowIso()
    };
    const cleanup = {
      schema_version: "fr-0032.cleanup_rollback_proof.v1",
      cleanup_result_id: `cleanup/fr-0032/${input.live_write_attempt_id}/identity-missing`,
      live_write_attempt_id: input.live_write_attempt_id,
      run_id: input.run_id,
      profile_ref: input.profile_ref ?? "unknown",
      target_tab_id: input.target_tab_id ?? 0,
      publish_result_identity: null,
      cleanup_policy_ref: input.cleanup_policy_ref,
      cleanup_action: "no_safe_cleanup_action",
      cleanup_outcome: "cleanup_blocked",
      proof_locator: null,
      platform_message: "publish result identity missing after submit",
      attempted_at: nowIso(),
      completed_at: null,
      residual_record: residual
    };
    return buildStepBlockedResult(input, artifact, {
      blockerCode: "PUBLISH_RESULT_IDENTITY_MISSING",
      blockerMessage: "Controlled publish did not produce a verifiable publish result identity.",
      detailsRef: "publish_result_identity_missing",
      requiredRecoveryAction: "capture note_id, published URL, creator result URL, or platform record before closeout",
      stoppedStep: "publish_identity",
      blockerLayer: "published_identity",
      riskKind: "publish_identity_missing",
      cleanupRequired: true
    }, submitEvidence, cleanup, residual);
  }
  const closedAt = nowIso();
  const cleanup = {
    schema_version: "fr-0032.cleanup_rollback_proof.v1",
    cleanup_result_id: `cleanup/fr-0032/${input.live_write_attempt_id}/private-visibility`,
    live_write_attempt_id: input.live_write_attempt_id,
    run_id: input.run_id,
    profile_ref: input.profile_ref ?? "unknown",
    target_tab_id: input.target_tab_id ?? 0,
    publish_result_identity: publishIdentity,
    cleanup_policy_ref: input.cleanup_policy_ref,
    cleanup_action: "hide_published_result",
    cleanup_outcome: "hidden",
    proof_locator: locatorForElement(selectedVisibilityOption),
    platform_message: "publish_visibility_scope=private_or_self_visible selected before publish",
    attempted_at: closedAt,
    completed_at: closedAt,
    residual_record: null
  };
  return {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    live_write_evidence: {
      schema_version: "fr-0032.live_write_evidence.v1",
      live_write_attempt_id: input.live_write_attempt_id,
      canonical_issue_ref: "#835",
      execution_phase: "closed",
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
        artifact_identity: artifact.upload_artifact_id
      },
      entry_gate: null,
      stop_classification: null,
      upload_artifact_identity: artifact,
      submit_evidence: submitEvidence,
      publish_result_identity: publishIdentity,
      cleanup_result: cleanup,
      risk_signals: [],
      stop_signal: null,
      residual_record: null,
      created_at: timestamp,
      updated_at: closedAt
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "GO",
      full_live_write_success: true,
      upload_success: true,
      submit_success: true,
      publish_success: true,
      cleanup_success: true,
      later_write_actions_blocked: false,
      cleanup_required: false,
      blockers: []
    },
    uploaded: true,
    submitted: true,
    published: true,
    cleanup_attempted: true,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
  };
};

export const performXhsControlledLiveWriteWithApprovedSourceMedia = async (
  input: XhsControlledLiveWriteInput
): Promise<XhsControlledLiveWriteResult> => {
  if (input.accepted_upload_artifact_identity?.accepted_by_platform === true) {
    const resumeBlocker = validateAcceptedUploadArtifactResume(input, input.accepted_upload_artifact_identity);
    if (resumeBlocker) {
      return buildXhsControlledLiveWriteUploadBlockedResult(
        input,
        resumeBlocker,
        input.accepted_upload_artifact_identity
      );
    }
    return await performControlledSubmitPublishCleanup(input, input.accepted_upload_artifact_identity);
  }
  const resolvedFile = await resolveApprovedFixtureMediaFile(input);
  if (!isBrowserFile(resolvedFile)) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, resolvedFile);
  }
  if (input.source_media_kind === "image") {
    await selectImagePublishMode();
  }
  const previousPreviewSignatures = collectEditorPreviewSignatures();
  const fileInputs = collectUploadFileInputs();
  const fileInput = findUploadFileInput(fileInputs);
  const dropzone = findUploadDropzone();
  if (
    input.source_media_kind === "image" &&
    !fileInput &&
    !dropzone &&
    fileInputs.some((candidate) => !candidate.disabled)
  ) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "IMAGE_UPLOAD_ENTRY_MISSING",
      blockerMessage:
        "Controlled live upload found file inputs, but none accept the approved image fixture after selecting image publish mode.",
      detailsRef: "image_upload_entry_missing",
      requiredRecoveryAction:
        "open the creator image publish target or update the XHS image mode selector before controlled upload"
    });
  }
  if (!fileInput && !dropzone) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "UPLOAD_ENTRY_MISSING",
      blockerMessage:
        "Controlled live upload cannot find an enabled file input or visible dropzone on the creator publish page.",
      detailsRef: "upload_entry_missing",
      requiredRecoveryAction: "restore the creator publish target page or update the XHS upload entry locator"
    });
  }
  let assignmentFailure: UploadBlockedInput | null = null;
  let previewEvidence: EditorPreviewEvidence | null = null;
  if (fileInput) {
    assignmentFailure = dispatchFileInputUpload(fileInput, resolvedFile);
    if (assignmentFailure) {
      return buildXhsControlledLiveWriteUploadBlockedResult(input, assignmentFailure);
    }
    previewEvidence = await waitForEditorPreviewEvidence(
      previousPreviewSignatures,
      uploadPreviewWaitOptions("file_input")
    );
  }
  if (!previewEvidence && dropzone) {
    assignmentFailure = dispatchDropzoneUpload(dropzone, resolvedFile);
    if (assignmentFailure && !fileInput) {
      return buildXhsControlledLiveWriteUploadBlockedResult(input, assignmentFailure);
    }
    previewEvidence = await waitForEditorPreviewEvidence(
      previousPreviewSignatures,
      uploadPreviewWaitOptions("dropzone")
    );
  }
  if (!previewEvidence) {
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
  const uploadArtifact = {
    upload_artifact_id: uploadArtifactId,
    source_media_ref: input.source_media_ref,
    source_media_digest: input.source_media_digest,
    source_media_kind: input.source_media_kind,
    platform_staging_ref: previewEvidence.platformStagingRef,
    page_preview_locator: previewEvidence.locator,
    accepted_by_platform: previewEvidence.acceptedByPlatform,
    visible_in_editor: true,
    captured_at: timestamp,
    preview_diagnostics: previewEvidence.diagnostics
  };
  if (previewEvidence.acceptedByPlatform) {
    return await performControlledSubmitPublishCleanup(input, uploadArtifact);
  }
  return buildXhsControlledLiveWriteUploadBlockedResult(input, {
    blockerCode: "UPLOAD_ACCEPTANCE_UNVERIFIED",
    blockerMessage:
      "Controlled live upload observed an editor preview, but platform upload acceptance is not independently verified.",
    detailsRef: "upload_acceptance_unverified",
    requiredRecoveryAction:
      "collect platform-returned upload acceptance evidence before submit/publish"
  }, uploadArtifact);
};
