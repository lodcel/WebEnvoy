import {
  BRIDGE_PROTOCOL,
  ensureBridgeRequestEnvelope,
  type BridgeRequestEnvelope,
  type BridgeResponseEnvelope
} from "./protocol.js";
import type { NativeBridgeTransport } from "./transport.js";
import { buildLoopbackGate } from "./loopback-gate.js";
import { buildLoopbackAuditRecord } from "./loopback-gate-audit.js";
import { buildLoopbackGatePayload } from "./loopback-gate-payload.js";
import { resolveXhsGateDecisionId } from "../../../shared/xhs-gate.js";

type HostMessage =
  | { kind: "request"; envelope: BridgeRequestEnvelope }
  | { kind: "response"; envelope: BridgeResponseEnvelope };

type ContentMessage =
  | {
      kind: "forward";
      id: string;
      command: string;
      commandParams: Record<string, unknown>;
      runId: string;
      sessionId: string;
      profile: string;
    }
  | {
      kind: "result";
      id: string;
      ok: boolean;
      payload?: Record<string, unknown>;
      error?: { code: string; message: string };
    };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

const LOOPBACK_MEDIA_UPLOAD_CAPTURED_AT = "2026-03-23T10:00:00.000Z";

const buildLoopbackMediaUploadDiscovery = (input: Record<string, unknown> = {}): Record<string, unknown> => {
  const fileSelectionBoundary = {
    file_bytes_read: false,
    native_picker_opened: false,
    data_transfer_injected: false,
    real_upload_attempted: false,
    submit_attempted: false,
    publish_attempted: false,
    allowed_modes: ["dry_run", "recon"]
  };
  const sourceMediaRef = asString(input.source_media_ref);
  const sourceMediaDigest = asString(input.source_media_digest);
  const sourceMediaKind = asString(input.source_media_kind);
  const hasArtifactIdentity =
    sourceMediaRef !== null &&
    sourceMediaDigest !== null &&
    (sourceMediaKind === "image" || sourceMediaKind === "video" || sourceMediaKind === "mixed");
  const controlledUploadEvidence = hasArtifactIdentity
    ? {
        schema_version: "fr-0032.controlled_upload_path.v1",
        non_publish_validation: true,
        run_id: asString(input.run_id) ?? "unknown-run",
        profile_ref: asString(input.profile_ref),
        target_tab_id: asInteger(input.target_tab_id),
        page_url: asString(input.page_url) ?? "https://creator.xiaohongshu.com/publish/publish",
        upload_artifact_identity: {
          upload_artifact_id: `upload-artifact/fr-0032/${asString(input.run_id) ?? "unknown-run"}/${sourceMediaDigest.replace(/[^A-Za-z0-9._-]/gu, "_")}`,
          source_media_ref: sourceMediaRef,
          source_media_digest: sourceMediaDigest,
          source_media_kind: sourceMediaKind,
          platform_staging_ref: null,
          page_preview_locator: "file_input",
          accepted_by_platform: false,
          visible_in_editor: false,
          captured_at: LOOPBACK_MEDIA_UPLOAD_CAPTURED_AT
        },
        file_selection_boundary: fileSelectionBoundary,
        stop_signal: null,
        submitted: false,
        published: false
      }
    : null;

  return {
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
      failure_signals: [
        "entry_missing",
        "type_rejected",
        "size_rejected",
        "upload_failed",
        "risk_blocked",
        "upload_injection_blocked"
      ],
      evidence_status: "candidate",
      evidence_maturity: "observed_once",
      notes: "loopback dry_run/recon only; no file bytes read and no upload attempted"
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
      notes: "fallback candidate only; not promoted to primary and not called during #755"
    }
    ],
    file_selection_boundary: fileSelectionBoundary,
    controlled_upload_evidence: controlledUploadEvidence,
    controlled_upload_evaluation: {
      schema_version: "fr-0032.controlled_upload_evaluation.v1",
      decision: controlledUploadEvidence ? "EVIDENCE_PRESENT" : "EVIDENCE_MISSING",
      upload_success: false,
      full_live_write_success: false,
      non_publish_validation: true,
      entry_gate_evaluated: false,
      runtime_evaluator_required_for_entry_gate: true,
      non_publish_evidence_status: controlledUploadEvidence ? "EVIDENCE_PRESENT" : "EVIDENCE_MISSING",
      later_write_actions_blocked: false,
      cleanup_required: false,
      limitations: controlledUploadEvidence
        ? [
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
          ]
        : [],
      blockers: controlledUploadEvidence
        ? []
        : [
            {
              blocker_code: "UPLOAD_ARTIFACT_IDENTITY_MISSING",
              message: "dry_run/recon upload evidence requires source_media_ref, source_media_digest and source_media_kind"
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
  };
};

const XHS_EDITOR_INPUT_VALIDATE_COMMAND = "xhs.editor_input.validate";
const XHS_EDITOR_TEXT_WRITE_COMMAND = "xhs.editor_text.write";
const XHS_MEDIA_UPLOAD_DISCOVER_COMMAND = "xhs.media_upload.discover";
const XHS_CREATOR_PUBLISH_ADMIT_COMMAND = "xhs.creator_publish.admit";
const XHS_CONTROLLED_LIVE_WRITE_COMMAND = "xhs.creator_publish.controlled_live_write";
const XHS_READ_COMMANDS = new Set(["xhs.search", "xhs.detail", "xhs.user_home"]);
const XHS_READ_COMMAND_DEFAULT_ABILITY_IDS: Record<string, string> = {
  "xhs.search": "xhs.note.search.v1",
  "xhs.detail": "xhs.note.detail.v1",
  "xhs.user_home": "xhs.user.home.v1"
};
const XHS_GATE_COMMANDS = new Set([
  ...XHS_READ_COMMANDS,
  XHS_EDITOR_INPUT_VALIDATE_COMMAND,
  XHS_EDITOR_TEXT_WRITE_COMMAND,
  XHS_MEDIA_UPLOAD_DISCOVER_COMMAND,
  XHS_CREATOR_PUBLISH_ADMIT_COMMAND,
  XHS_CONTROLLED_LIVE_WRITE_COMMAND
]);
const XHS_GATE_COMMAND_DEFAULT_ABILITY_IDS: Record<string, string> = {
  ...XHS_READ_COMMAND_DEFAULT_ABILITY_IDS,
  [XHS_EDITOR_INPUT_VALIDATE_COMMAND]: "xhs.editor.input.v1",
  [XHS_EDITOR_TEXT_WRITE_COMMAND]: "xhs.editor.input.v1",
  [XHS_MEDIA_UPLOAD_DISCOVER_COMMAND]: "xhs.creator.publish.v1",
  [XHS_CREATOR_PUBLISH_ADMIT_COMMAND]: "xhs.creator.publish.v1",
  [XHS_CONTROLLED_LIVE_WRITE_COMMAND]: "xhs.creator.publish.v1"
};
type XhsReadCommand = keyof typeof XHS_READ_COMMAND_DEFAULT_ABILITY_IDS;
const XHS_READ_COMMAND_SPECS: Record<
  XhsReadCommand,
  {
    abilityId: string;
    pageKind: "search" | "detail" | "profile";
    pageUrl: string;
    pageTitle: string;
    requestMethod: "GET" | "POST";
    requestUrl: string;
    dataRefKey: "query" | "note_id" | "user_id";
    successDataRef: (input: Record<string, unknown>) => Record<string, unknown>;
    failureSummary: string;
  }
> = {
  "xhs.search": {
    abilityId: "xhs.note.search.v1",
    pageKind: "search",
    pageUrl: "https://www.xiaohongshu.com/search_result",
    pageTitle: "Search Result",
    requestMethod: "POST",
    requestUrl: "/api/sns/web/v1/search/notes",
    dataRefKey: "query",
    successDataRef: (input) => ({
      query: String(input.query ?? ""),
      search_id: "loopback-search-id"
    }),
    failureSummary: "网关调用失败，当前上下文不足以完成搜索请求"
  },
  "xhs.detail": {
    abilityId: "xhs.note.detail.v1",
    pageKind: "detail",
    pageUrl: "https://www.xiaohongshu.com/explore/loopback-note",
    pageTitle: "Note Detail",
    requestMethod: "POST",
    requestUrl: "/api/sns/web/v1/feed",
    dataRefKey: "note_id",
    successDataRef: (input) => ({
      note_id: String(input.note_id ?? ""),
      note_title: "loopback-note-title"
    }),
    failureSummary: "网关调用失败，当前上下文不足以完成详情读取请求"
  },
  "xhs.user_home": {
    abilityId: "xhs.user.home.v1",
    pageKind: "profile",
    pageUrl: "https://www.xiaohongshu.com/user/profile/loopback-user",
    pageTitle: "User Home",
    requestMethod: "GET",
    requestUrl: "/api/sns/web/v1/user_posted",
    dataRefKey: "user_id",
    successDataRef: (input) => ({
      user_id: String(input.user_id ?? ""),
      profile_id: "loopback-profile-id"
    }),
    failureSummary: "网关调用失败，当前上下文不足以完成主页读取请求"
  }
};

const resolveApprovalRecord = (
  options: Record<string, unknown>
): Record<string, unknown> | null => asRecord(options.approval_record) ?? asRecord(options.approval);

const buildLoopbackXhsGateBundle = (input: {
  options: Record<string, unknown>;
  abilityAction: string | null;
  runId: string;
  requestId: string;
  commandRequestId?: unknown;
  gateInvocationId?: unknown;
  sessionId: string;
  profile: string;
}): {
  consumerGateResult: Record<string, unknown>;
  payload: Record<string, unknown>;
} => {
  const decisionId = resolveXhsGateDecisionId({
    runId: input.runId,
    requestId: input.requestId,
    commandRequestId: input.commandRequestId,
    gateInvocationId: asString(input.gateInvocationId),
    issueScope: input.options.issue_scope,
    requestedExecutionMode: input.options.requested_execution_mode
  });
  const gate = buildLoopbackGate(
    input.options,
    input.abilityAction,
    {
      runId: input.runId,
      requestId: input.requestId,
      commandRequestId: asString(input.commandRequestId) ?? undefined,
      sessionId: input.sessionId,
      gateInvocationId: asString(input.gateInvocationId) ?? undefined,
      decisionId
    }
  );
  const auditRecord = buildLoopbackAuditRecord({
    runId: input.runId,
    sessionId: input.sessionId,
    profile: input.profile,
    gate
  });
  return {
    consumerGateResult: gate.consumerGateResult,
    payload: buildLoopbackGatePayload({
      runId: input.runId,
      sessionId: input.sessionId,
      profile: input.profile,
      gate,
      auditRecord
    })
  };
};

const toLoopbackProfileRef = (profile: string): string =>
  profile.startsWith("profile/") ? profile : `profile/${profile}`;

const buildLoopbackXhsSearchPageUrl = (query: string): string => {
  const url = new URL("https://www.xiaohongshu.com/search_result");
  if (query.length > 0) {
    url.searchParams.set("keyword", query);
  }
  return url.toString();
};

const resolveLoopbackXhsSearchActionRef = (options: Record<string, unknown>): string =>
  options.search_action_ref === "action/xhs.search/submit_enter"
    ? "action/xhs.search/submit_enter"
    : "action/xhs.search/submit_query";

const buildLoopbackXhsSearchPassiveApiContractSummaryFields = (input: {
  runId: string;
  profile: string;
  query: string;
  options: Record<string, unknown>;
  requestUrl: string;
}): Record<string, unknown> => {
  const actionRef = resolveLoopbackXhsSearchActionRef(input.options);
  const pageUrl = buildLoopbackXhsSearchPageUrl(input.query);
  const profileRef = toLoopbackProfileRef(
    asString(input.options.__runtime_profile_ref) ?? input.profile
  );
  const targetTabId = asInteger(input.options.target_tab_id);

  return {
    route_evidence: {
      route: "xhs.search.api",
      route_role: "primary",
      path_kind: "api",
      evidence_status: "success",
      evidence_class: "passive_api_capture",
      profile_ref: profileRef,
      target_tab_id: targetTabId,
      page_url: pageUrl,
      run_id: input.runId,
      action_ref: actionRef
    },
    request_context: {
      status: "exact_hit",
      request_id: "req-loopback-001",
      method: "POST",
      request_url: input.requestUrl,
      query: input.query,
      profile_ref: profileRef,
      target_tab_id: targetTabId,
      page_url: pageUrl,
      run_id: input.runId,
      action_ref: actionRef
    }
  };
};

class InMemoryPort<TMessage> {
  #listeners = new Set<(message: TMessage) => void>();
  #peer: InMemoryPort<TMessage> | null = null;

  connect(peer: InMemoryPort<TMessage>): void {
    this.#peer = peer;
  }

  onMessage(listener: (message: TMessage) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  postMessage(message: TMessage): void {
    const peer = this.#peer;
    if (!peer) {
      return;
    }

    queueMicrotask(() => {
      for (const listener of peer.#listeners) {
        listener(message);
      }
    });
  }
}

const createPortPair = <TMessage>(): [InMemoryPort<TMessage>, InMemoryPort<TMessage>] => {
  const left = new InMemoryPort<TMessage>();
  const right = new InMemoryPort<TMessage>();
  left.connect(right);
  right.connect(left);
  return [left, right];
};

class InMemoryContentScriptRuntime {
  static readonly BOOTSTRAP_ATTEST_DELAY_MS = 10;

  #bootstrapContext: {
    runId: string;
    runtimeContextId: string;
    profile: string;
    version: string;
    attested: boolean;
  } | null = null;

  constructor(
    private readonly port: InMemoryPort<ContentMessage>
  ) {
    this.port.onMessage((message) => {
      if (message.kind !== "forward") {
        return;
      }

      this.port.postMessage(this.handleForward(message));
    });
  }

  private handleForward(message: Extract<ContentMessage, { kind: "forward" }>): ContentMessage {
    if (message.command === "runtime.ping") {
      return {
        kind: "result",
        id: message.id,
        ok: true,
        payload: {
          message: "pong",
          runtime_bootstrap_attested: this.#bootstrapContext?.attested === true
        }
      };
    }

    if (message.command === "runtime.bootstrap") {
      const commandParams = asRecord(message.commandParams) ?? {};
      const version = asString(commandParams.version);
      const runId = asString(commandParams.run_id);
      const runtimeContextId = asString(commandParams.runtime_context_id);
      const profile = asString(commandParams.profile);
      const fingerprintRuntime = asRecord(commandParams.fingerprint_runtime);
      const fingerprintPatchManifest = asRecord(commandParams.fingerprint_patch_manifest);
      const mainWorldSecret = asString(commandParams.main_world_secret);

      if (
        !version ||
        !runId ||
        !runtimeContextId ||
        !profile ||
        !fingerprintRuntime ||
        !fingerprintPatchManifest ||
        !mainWorldSecret
      ) {
        return {
          kind: "result",
          id: message.id,
          ok: false,
          error: {
            code: "ERR_RUNTIME_READY_SIGNAL_CONFLICT",
            message: "invalid runtime bootstrap envelope"
          }
        };
      }

      const currentBootstrapContext = this.#bootstrapContext;
      if (
        currentBootstrapContext &&
        currentBootstrapContext.attested &&
        currentBootstrapContext.version === version &&
        currentBootstrapContext.runId === runId &&
        currentBootstrapContext.runtimeContextId === runtimeContextId &&
        currentBootstrapContext.profile === profile
      ) {
        return {
          kind: "result",
          id: message.id,
          ok: true,
          payload: {
            method: "runtime.bootstrap.ack",
            result: {
              version,
              run_id: runId,
              runtime_context_id: runtimeContextId,
              profile,
              status: "ready"
            },
            runtime_bootstrap_attested: true
          }
        };
      }

      this.#bootstrapContext = {
        version,
        runId,
        runtimeContextId,
        profile,
        attested: false
      };
      setTimeout(() => {
        const bootstrapContext = this.#bootstrapContext;
        if (
          bootstrapContext &&
          bootstrapContext.runId === runId &&
          bootstrapContext.runtimeContextId === runtimeContextId &&
          bootstrapContext.profile === profile
        ) {
          this.#bootstrapContext = {
            ...bootstrapContext,
            attested: true
          };
        }
      }, InMemoryContentScriptRuntime.BOOTSTRAP_ATTEST_DELAY_MS);

      return {
        kind: "result",
        id: message.id,
        ok: false,
        error: {
          code: "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED",
          message: "runtime bootstrap 尚未获得执行面确认"
        }
      };
    }

    if (message.command === "runtime.readiness") {
      const commandParams = asRecord(message.commandParams) ?? {};
      const runId = asString(commandParams.run_id);
      const runtimeContextId = asString(commandParams.runtime_context_id);

      let bootstrapState: "not_started" | "pending" | "ready" | "stale" = "not_started";
      if (this.#bootstrapContext) {
        bootstrapState =
          runId === this.#bootstrapContext.runId &&
          runtimeContextId === this.#bootstrapContext.runtimeContextId
            ? (this.#bootstrapContext.attested ? "ready" : "pending")
            : "stale";
      }

      return {
        kind: "result",
        id: message.id,
        ok: true,
        payload: {
          transport_state: "ready",
          bootstrap_state: bootstrapState
        }
      };
    }

    if (
      message.command === XHS_EDITOR_INPUT_VALIDATE_COMMAND ||
      message.command === XHS_EDITOR_TEXT_WRITE_COMMAND
    ) {
      return this.handleXhsEditorInputValidate(message);
    }

    if (message.command === XHS_MEDIA_UPLOAD_DISCOVER_COMMAND) {
      return this.handleXhsMediaUploadDiscovery(message);
    }

    if (XHS_READ_COMMANDS.has(message.command)) {
      return this.handleXhsRead(message);
    }

    return {
      kind: "result",
      id: message.id,
      ok: true,
      payload: {
        message: "pong"
      }
    };
  }

  private handleXhsEditorInputValidate(
    message: Extract<ContentMessage, { kind: "forward" }>
  ): ContentMessage {
    const ability =
      typeof message.commandParams.ability === "object" && message.commandParams.ability !== null
        ? (message.commandParams.ability as Record<string, unknown>)
        : {};
    const options =
      typeof message.commandParams.options === "object" && message.commandParams.options !== null
        ? (message.commandParams.options as Record<string, unknown>)
        : {};
    const gateBundle = buildLoopbackXhsGateBundle({
      options,
      abilityAction: asString(ability.action),
      runId: message.runId,
      requestId: message.id,
      commandRequestId: message.commandParams.request_id,
      gateInvocationId: message.commandParams.gate_invocation_id,
      sessionId: message.sessionId,
      profile: message.profile
    });
    const consumerGateResult = gateBundle.consumerGateResult;
    const accountSafetyGateResult = asRecord(options.account_safety_gate_result);
    const editorInputFailureSignals = Array.isArray(consumerGateResult.gate_reasons)
      ? consumerGateResult.gate_reasons.map((reason) => String(reason))
      : ["EXECUTION_MODE_GATE_BLOCKED"];
    const interactionResult = {
      validation_action: "editor_input",
      target_page: "creator_publish_tab",
      focus_confirmed: false,
      preserved_after_blur: false,
      success_signals: [],
      failure_signals:
        consumerGateResult.gate_decision === "blocked"
          ? editorInputFailureSignals
          : ["EDITOR_INPUT_VALIDATION_REQUIRED"],
      minimum_replay: ["focus_editor", "type_short_text", "blur_or_reobserve"],
      out_of_scope_actions: ["image_upload", "submit", "publish_confirm"]
    };
    const validationText =
      typeof options.validation_text === "string" && options.validation_text.trim().length > 0
        ? options.validation_text.trim()
        : "WebEnvoy editor_input validation";
    const textWriteResult =
      options.editor_text_write === true
        ? {
            ...interactionResult,
            write_action: "editor_text_write",
            input_text: validationText,
            submitted: false,
            published: false
          }
        : null;

    if (consumerGateResult.gate_decision === "blocked") {
      return {
        kind: "result",
        id: message.id,
        ok: false,
        error: {
          code: "ERR_EXECUTION_FAILED",
          message: `执行模式门禁阻断了当前 ${message.command} 请求`
        },
        payload: {
          details: {
            ability_id: String(ability.id ?? "xhs.editor.input.v1"),
            stage: "execution",
            reason: "EXECUTION_MODE_GATE_BLOCKED",
            ...(accountSafetyGateResult
              ? { account_safety_gate_result: accountSafetyGateResult }
              : {}),
            ...interactionResult
          },
          ...gateBundle.payload,
          ...(textWriteResult ? { text_write_result: textWriteResult } : {})
        }
      };
    }

    if (
      consumerGateResult.effective_execution_mode === "dry_run" ||
      consumerGateResult.effective_execution_mode === "recon"
    ) {
      return {
        kind: "result",
        id: message.id,
        ok: true,
        payload: {
          summary: {
            capability_result: {
              ability_id: String(ability.id ?? "xhs.editor.input.v1"),
              layer: String(ability.layer ?? "L3"),
              action: String(consumerGateResult.action_type ?? ability.action ?? "write"),
              outcome: "partial",
              data_ref: {
                validation_action: "editor_input"
              },
              metrics: {
                count: 0
              }
            },
            ...gateBundle.payload,
            interaction_result: interactionResult,
            ...(textWriteResult ? { text_write_result: textWriteResult } : {})
          },
          observability: {
            page_state: {
              page_kind: "compose",
              url: "https://creator.xiaohongshu.com/publish/publish",
              title: "Creator Publish",
              ready_state: "complete",
              observation_status: "complete"
            },
            key_requests: [],
            failure_site: null
          }
        }
      };
    }

    return {
      kind: "result",
      id: message.id,
      ok: false,
      payload: {
        details: {
          ability_id: String(ability.id ?? "xhs.editor.input.v1"),
          stage: "execution",
          reason: "EDITOR_INPUT_VALIDATION_REQUIRED",
          ...interactionResult,
          consumer_gate_result: gateBundle.payload.consumer_gate_result,
          request_admission_result: gateBundle.payload.request_admission_result,
          execution_audit: gateBundle.payload.execution_audit,
          approval_record: gateBundle.payload.approval_record,
          audit_record: gateBundle.payload.audit_record
        },
        ...gateBundle.payload,
        summary: {
          capability_result: {
            ability_id: String(ability.id ?? "xhs.editor.input.v1"),
            layer: String(ability.layer ?? "L3"),
            action: String(consumerGateResult.action_type ?? ability.action ?? "write"),
            outcome: "blocked",
            data_ref: {
              validation_action: "editor_input"
            },
            metrics: {
              duration_ms: 12
            }
          },
          ...gateBundle.payload,
          interaction_result: interactionResult
        },
        observability: {
          page_state: {
            page_kind: "compose",
            url: "https://creator.xiaohongshu.com/publish/publish",
            title: "Creator Publish",
            ready_state: "complete",
            observation_status: "complete"
          },
          key_requests: [],
          failure_site: {
            stage: "execution",
            component: "page",
            target: "editor_input",
            summary: "loopback transport cannot attest controlled editor_input validation"
          }
        }
      },
      error: {
        code: "ERR_EXECUTION_FAILED",
        message: `editor_input validation requires a controlled execution surface: ${validationText}`
      }
    };
  }

  private handleXhsMediaUploadDiscovery(
    message: Extract<ContentMessage, { kind: "forward" }>
  ): ContentMessage {
    const ability =
      typeof message.commandParams.ability === "object" && message.commandParams.ability !== null
        ? (message.commandParams.ability as Record<string, unknown>)
        : {};
    const options =
      typeof message.commandParams.options === "object" && message.commandParams.options !== null
        ? (message.commandParams.options as Record<string, unknown>)
        : {};
    const gateBundle = buildLoopbackXhsGateBundle({
      options,
      abilityAction: asString(ability.action),
      runId: message.runId,
      requestId: message.id,
      commandRequestId: message.commandParams.request_id,
      gateInvocationId: message.commandParams.gate_invocation_id,
      sessionId: message.sessionId,
      profile: message.profile
    });
    const consumerGateResult = gateBundle.consumerGateResult;
    const input = asRecord(message.commandParams.input) ?? {};
    const mediaUploadDiscovery = buildLoopbackMediaUploadDiscovery({
      ...input,
      run_id: message.runId,
      profile_ref: message.profile,
      target_tab_id: options.target_tab_id,
      page_url: "https://creator.xiaohongshu.com/publish/publish"
    });

    if (consumerGateResult.gate_decision === "blocked") {
      const accountSafetyGateResult = asRecord(options.account_safety_gate_result);
      return {
        kind: "result",
        id: message.id,
        ok: false,
        error: {
          code: "ERR_EXECUTION_FAILED",
          message: `执行模式门禁阻断了当前 ${message.command} 请求`
        },
        payload: {
          details: {
            ability_id: String(ability.id ?? "xhs.creator.publish.v1"),
            stage: "execution",
            reason: "EXECUTION_MODE_GATE_BLOCKED",
            ...(accountSafetyGateResult
              ? { account_safety_gate_result: accountSafetyGateResult }
              : {}),
            discovery_action: "media_upload_path",
            target_page: "creator_publish_tab",
            failure_signals: consumerGateResult.gate_reasons
          },
          ...gateBundle.payload,
          media_upload_discovery: mediaUploadDiscovery
        }
      };
    }

    return {
      kind: "result",
      id: message.id,
      ok: true,
      payload: {
        summary: {
          capability_result: {
            ability_id: String(ability.id ?? "xhs.creator.publish.v1"),
            layer: String(ability.layer ?? "L3"),
            action: String(consumerGateResult.action_type ?? ability.action ?? "write"),
            outcome: "partial",
            data_ref: {
              target_page: "creator_publish_tab",
              discovery_action: "media_upload_path"
            },
            metrics: {
              count: 0
            }
          },
          ...gateBundle.payload,
          media_upload_discovery: mediaUploadDiscovery,
          upload_path_catalog: mediaUploadDiscovery.upload_path_catalog,
          controlled_upload_evidence: mediaUploadDiscovery.controlled_upload_evidence,
          controlled_upload_evaluation: mediaUploadDiscovery.controlled_upload_evaluation
        },
        observability: {
          page_state: {
            page_kind: "compose",
            url: "https://creator.xiaohongshu.com/publish/publish",
            title: "Creator Publish",
            ready_state: "complete",
            observation_status: "complete"
          },
          key_requests: [],
          failure_site: null
        }
      }
    };
  }

  private handleXhsRead(message: Extract<ContentMessage, { kind: "forward" }>): ContentMessage {
    const command = message.command as XhsReadCommand;
    const spec = XHS_READ_COMMAND_SPECS[command];
    const simulated =
      typeof message.commandParams.options === "object" &&
      message.commandParams.options !== null &&
      typeof (message.commandParams.options as Record<string, unknown>).simulate_result === "string"
        ? String((message.commandParams.options as Record<string, unknown>).simulate_result)
        : "success";
    const ability =
      typeof message.commandParams.ability === "object" && message.commandParams.ability !== null
        ? (message.commandParams.ability as Record<string, unknown>)
        : {};
    const input =
      typeof message.commandParams.input === "object" && message.commandParams.input !== null
        ? (message.commandParams.input as Record<string, unknown>)
        : {};
    const options =
      typeof message.commandParams.options === "object" && message.commandParams.options !== null
        ? (message.commandParams.options as Record<string, unknown>)
        : {};
    const gateBundle = buildLoopbackXhsGateBundle({
      options,
      abilityAction: asString(ability.action),
      runId: message.runId,
      requestId: message.id,
      commandRequestId: message.commandParams.request_id,
      gateInvocationId: message.commandParams.gate_invocation_id,
      sessionId: message.sessionId,
      profile: message.profile
    });
    const consumerGateResult = gateBundle.consumerGateResult;
    const successObservability = {
      page_state: {
        page_kind: spec.pageKind,
        url: spec.pageUrl,
        title: spec.pageTitle,
        ready_state: "complete",
        observation_status: "complete"
      },
      key_requests: [],
      failure_site: null
    };
    const buildSuccessfulResult = (
      capabilityResult: unknown,
      overrides?: {
        key_requests?: Array<Record<string, unknown>>;
        summary?: Record<string, unknown>;
      }
    ) => ({
      kind: "result" as const,
      id: message.id,
      ok: true,
      payload: {
        summary:
          capabilityResult === undefined
            ? {
                ...(overrides?.summary ?? {}),
                ...gateBundle.payload
              }
            : {
                capability_result: capabilityResult,
                ...(overrides?.summary ?? {}),
                ...gateBundle.payload
              },
        observability: {
          ...successObservability,
          ...(overrides?.key_requests ? { key_requests: overrides.key_requests } : {})
        }
      }
    });
    if (consumerGateResult.gate_decision === "blocked") {
      const isEditorInputValidation = options.validation_action === "editor_input";
      const accountSafetyGateResult = asRecord(options.account_safety_gate_result);
      const editorInputFailureSignals = Array.isArray(consumerGateResult.gate_reasons)
        ? consumerGateResult.gate_reasons.map((reason) => String(reason))
        : ["EXECUTION_MODE_GATE_BLOCKED"];
      return {
        kind: "result",
        id: message.id,
        ok: false,
        error: {
          code: "ERR_EXECUTION_FAILED",
          message: `执行模式门禁阻断了当前 ${command} 请求`
        },
        payload: {
          details: {
            ability_id: String(ability.id ?? spec.abilityId),
            stage: "execution",
            reason: "EXECUTION_MODE_GATE_BLOCKED",
            ...(accountSafetyGateResult
              ? { account_safety_gate_result: accountSafetyGateResult }
              : {}),
            ...(isEditorInputValidation
              ? {
                  validation_action: "editor_input",
                  target_page: "creator_publish_tab",
                  focus_confirmed: false,
                  preserved_after_blur: false,
                  failure_signals: editorInputFailureSignals,
                  minimum_replay: ["focus_editor", "type_short_text", "blur_or_reobserve"],
                  out_of_scope_actions: ["image_upload", "submit", "publish_confirm"]
                }
              : {})
          },
          ...gateBundle.payload
        }
      };
    }
    if (
      consumerGateResult.effective_execution_mode === "dry_run" ||
      consumerGateResult.effective_execution_mode === "recon"
    ) {
      if (options.xhs_recovery_probe === true && simulated === "account_abnormal") {
        return buildSuccessfulResult(
          {
            ability_id: String(ability.id ?? spec.abilityId),
            layer: String(ability.layer ?? "L3"),
            action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
            outcome: "partial",
            data_ref: {
              [spec.dataRefKey]: String(input[spec.dataRefKey] ?? "")
            },
            metrics: {
              count: 0
            }
          },
          {
            key_requests: [
              {
                failure_reason: "ACCOUNT_ABNORMAL",
                status_code: 461
              }
            ]
          }
        );
      }
      return buildSuccessfulResult({
        ability_id: String(ability.id ?? spec.abilityId),
        layer: String(ability.layer ?? "L3"),
        action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
        outcome: "partial",
        data_ref: {
          [spec.dataRefKey]: String(input[spec.dataRefKey] ?? "")
        },
        metrics: {
          count: 0
        }
      });
    }

    if (
      consumerGateResult.effective_execution_mode === "live_write" &&
      options.validation_action === "editor_input"
    ) {
      const validationText =
        typeof options.validation_text === "string" && options.validation_text.trim().length > 0
          ? options.validation_text.trim()
          : "WebEnvoy editor_input validation";
      const interactionResult = {
        validation_action: "editor_input",
        target_page: "creator_publish_tab",
        focus_confirmed: false,
        preserved_after_blur: false,
        success_signals: [],
        failure_signals: ["EDITOR_INPUT_VALIDATION_REQUIRED"],
        minimum_replay: ["focus_editor", "type_short_text", "blur_or_reobserve"],
        out_of_scope_actions: ["image_upload", "submit", "publish_confirm"]
      };
      return {
        kind: "result",
        id: message.id,
        ok: false,
        payload: {
          details: {
            ability_id: String(ability.id ?? "xhs.issue208.editor_input"),
            stage: "execution",
            reason: "EDITOR_INPUT_VALIDATION_REQUIRED",
            ...interactionResult,
            consumer_gate_result: gateBundle.payload.consumer_gate_result,
            request_admission_result: gateBundle.payload.request_admission_result,
            execution_audit: gateBundle.payload.execution_audit,
            approval_record: gateBundle.payload.approval_record,
            audit_record: gateBundle.payload.audit_record
          },
          ...gateBundle.payload,
          summary: {
            capability_result: {
              ability_id: String(ability.id ?? "xhs.issue208.editor_input"),
              layer: String(ability.layer ?? "L3"),
              action: String(consumerGateResult.action_type ?? ability.action ?? "write"),
              outcome: "blocked",
              data_ref: {
                validation_action: "editor_input"
              },
              metrics: {
                duration_ms: 12
              }
            },
            ...gateBundle.payload,
            interaction_result: interactionResult
          },
          observability: {
            page_state: {
              page_kind: "compose",
              url: "https://creator.xiaohongshu.com/publish/publish",
              title: "Creator Publish",
              ready_state: "complete",
              observation_status: "complete"
            },
            key_requests: [],
            failure_site: {
              stage: "execution",
              component: "page",
              target: "editor_input",
              summary: "loopback transport cannot attest controlled editor_input validation"
            }
          }
        },
        error: {
          code: "ERR_EXECUTION_FAILED",
          message: `editor_input validation requires a controlled execution surface: ${validationText}`
        }
      };
    }

    if (simulated === "missing_capability_result") {
      return buildSuccessfulResult(undefined);
    }

    if (simulated === "capability_result_not_object") {
      return buildSuccessfulResult("invalid");
    }

    if (simulated === "capability_result_missing_layer") {
      return buildSuccessfulResult({
        ability_id: String(ability.id ?? spec.abilityId),
        action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
        outcome: "success"
      });
    }

    if (simulated === "capability_result_invalid_outcome") {
      return buildSuccessfulResult({
        ability_id: String(ability.id ?? spec.abilityId),
        layer: String(ability.layer ?? "L3"),
        action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
        outcome: "blocked"
      });
    }

    if (simulated === "success") {
      const successSummary =
        command === "xhs.search"
          && options.xhs_search_passive_readiness_contract === true
          ? buildLoopbackXhsSearchPassiveApiContractSummaryFields({
              runId: message.runId,
              profile: message.profile,
              query: String(input.query ?? ""),
              options,
              requestUrl: spec.requestUrl
            })
          : undefined;
      return buildSuccessfulResult(
        {
          ability_id: String(ability.id ?? spec.abilityId),
          layer: String(ability.layer ?? "L3"),
          action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
          outcome: "success",
          data_ref: spec.successDataRef(input),
          metrics: {
            count: 2,
            duration_ms: 12
          }
        },
        {
          ...(successSummary ? { summary: successSummary } : {}),
          key_requests: [
            {
              request_id: "req-loopback-001",
              stage: "request",
              method: spec.requestMethod,
              url: spec.requestUrl,
              outcome: "completed",
              status_code: 200
            }
          ]
        }
      );
    }

    return {
      kind: "result",
      id: message.id,
      ok: false,
      error: {
        code: "ERR_EXECUTION_FAILED",
          message:
            simulated === "login_required"
              ? `登录态缺失，无法执行 ${command}`
              : simulated === "account_abnormal"
              ? "账号异常，平台拒绝当前请求"
              : simulated === "browser_env_abnormal"
                ? "浏览器环境异常，平台拒绝当前请求"
                : simulated === "captcha_required"
                  ? "平台要求额外人机验证，无法继续执行"
                  : simulated === "classifier_only_account_abnormal"
                    ? `${command} 接口返回了未识别的失败响应`
                  : simulated === "classifier_account_abnormal_with_generic_diagnosis"
                    ? `${command} 接口返回了未识别的失败响应`
                  : simulated === "stale_account_safety_with_current_captcha"
                    ? `${command} 接口返回了当前人机验证阻断`
                  : simulated === "generic_api_warning"
                    ? `${command} 接口返回了未识别的失败响应`
                    : simulated === "request_context_missing_with_humanized_action"
                      ? "当前页面现场缺少可复用的搜索请求模板"
                    : simulated === "signature_entry_missing"
                      ? "页面签名入口不可用"
                      : spec.failureSummary
      },
      payload: {
        details: {
          ability_id: String(ability.id ?? spec.abilityId),
          stage: "execution",
          reason:
            simulated === "login_required"
              ? "SESSION_EXPIRED"
              : simulated === "account_abnormal"
                ? "ACCOUNT_ABNORMAL"
                : simulated === "browser_env_abnormal"
                  ? "BROWSER_ENV_ABNORMAL"
                  : simulated === "captcha_required"
                  ? "CAPTCHA_REQUIRED"
                  : simulated === "classifier_only_account_abnormal"
                    ? "TARGET_API_RESPONSE_INVALID"
                  : simulated === "classifier_account_abnormal_with_generic_diagnosis"
                    ? "TARGET_API_RESPONSE_INVALID"
                  : simulated === "stale_account_safety_with_current_captcha"
                    ? "TARGET_API_RESPONSE_INVALID"
                  : simulated === "generic_api_warning"
                    ? "TARGET_API_RESPONSE_INVALID"
                    : simulated === "request_context_missing_with_humanized_action"
                      ? "REQUEST_CONTEXT_MISSING"
                    : simulated === "signature_entry_missing"
                      ? "SIGNATURE_ENTRY_MISSING"
                      : "GATEWAY_INVOKER_FAILED",
          ...(simulated === "request_context_missing_with_humanized_action"
            ? {
                humanized_action: {
                  evidence_class: "humanized_action",
                  action_kind: "keyboard_input",
                  debugger_action: {
                    attempted: true,
                    ok: false,
                    error: {
                      code: "ERR_XHS_SEARCH_DEBUGGER_FAILED",
                      message: "chrome.debugger attach failed: another debugger is already attached"
                    }
                  }
                }
              }
            : {}),
          ...(simulated === "stale_account_safety_with_current_captcha"
            ? {
                account_safety: {
                  state: "account_risk_blocked",
                  reason: "SESSION_EXPIRED",
                  source_run_id: "run-stale-account-safety-source-001"
                }
              }
            : {})
        },
        ...gateBundle.payload,
        observability: {
          page_state: {
            page_kind: simulated === "login_required" ? "login" : spec.pageKind,
            url:
              simulated === "login_required"
                ? "https://www.xiaohongshu.com/login"
                : spec.pageUrl,
            title: spec.pageTitle,
            ready_state: "complete",
            observation_status: "complete"
          },
          key_requests:
            simulated === "signature_entry_missing"
              ? []
              : simulated === "stale_account_safety_with_current_captcha"
                ? [
                    {
                      request_id: "req-loopback-generic-001",
                      stage: "request",
                      method: spec.requestMethod,
                      url: spec.requestUrl,
                      outcome: "failed",
                      status_code: 500,
                      failure_reason: "request_context_missing"
                    },
                    {
                      request_id: "req-loopback-captcha-002",
                      stage: "request",
                      method: spec.requestMethod,
                      url: spec.requestUrl,
                      outcome: "failed",
                      status_code: 429,
                      failure_reason: "request_context_missing"
                    }
                  ]
                : [
                  {
                    request_id: "req-loopback-001",
                    stage: "request",
                    method: spec.requestMethod,
                    url: spec.requestUrl,
                    outcome: "failed",
                    status_code:
                      simulated === "account_abnormal"
                        ? 461
                        : simulated === "browser_env_abnormal"
                          ? 200
                          : simulated === "captcha_required"
                            ? 429
                            : simulated === "classifier_only_account_abnormal"
                              ? 400
                            : simulated === "classifier_account_abnormal_with_generic_diagnosis"
                              ? 400
                            : simulated === "generic_api_warning"
                              ? 400
                            : simulated === "gateway_invoker_failed"
                              ? 500
                              : undefined,
                    failure_reason:
                      simulated === "classifier_only_account_abnormal"
                      || simulated === "classifier_account_abnormal_with_generic_diagnosis"
                        ? "request_context_missing"
                        : simulated === "request_context_missing_with_humanized_action"
                          ? "request_context_missing"
                        : simulated
                  }
                ],
          failure_site: {
            stage: simulated === "signature_entry_missing" ? "action" : "request",
            component: simulated === "signature_entry_missing" ? "page" : "network",
            target:
              simulated === "signature_entry_missing"
                ? "window._webmsxyw"
                : spec.requestUrl,
            summary:
              simulated === "classifier_only_account_abnormal"
              || simulated === "classifier_account_abnormal_with_generic_diagnosis"
                ? "Account abnormal. Switch account and retry."
                : simulated === "request_context_missing_with_humanized_action"
                  ? "当前页面现场缺少可复用的搜索请求模板"
                : simulated
          }
        },
        diagnosis: {
          category: simulated === "signature_entry_missing" ? "page_changed" : "request_failed",
          stage: simulated === "signature_entry_missing" ? "action" : "request",
          component: simulated === "signature_entry_missing" ? "page" : "network",
          failure_site: {
            stage: simulated === "signature_entry_missing" ? "action" : "request",
            component: simulated === "signature_entry_missing" ? "page" : "network",
            target:
              simulated === "signature_entry_missing"
                ? "window._webmsxyw"
                : spec.requestUrl,
            summary:
              simulated === "classifier_only_account_abnormal"
              || simulated === "classifier_account_abnormal_with_generic_diagnosis"
                ? "Account abnormal. Switch account and retry."
                : simulated === "request_context_missing_with_humanized_action"
                  ? "当前页面现场缺少可复用的搜索请求模板"
                : simulated
          },
          evidence: [
            simulated === "classifier_only_account_abnormal"
              ? "unclassified upstream failure"
              : simulated === "classifier_account_abnormal_with_generic_diagnosis"
                ? "SESSION_EXPIRED"
              : simulated === "request_context_missing_with_humanized_action"
                ? "debugger_action_error_message=chrome.debugger attach failed: another debugger is already attached"
              : simulated
          ]
        }
      }
    };
  }
}

class InMemoryBackgroundRelay {
  #pendingForward = new Map<
    string,
    {
      request: BridgeRequestEnvelope;
      gatePayload?: Record<string, unknown>;
    }
  >();
  #sessionId = "nm-session-001";

  constructor(
    private readonly hostPort: InMemoryPort<HostMessage>,
    private readonly contentPort: InMemoryPort<ContentMessage>,
    private readonly relayPath: string
  ) {
    this.hostPort.onMessage((message) => {
      if (message.kind !== "request") {
        return;
      }

      this.handleHostRequest(message.envelope);
    });

    this.contentPort.onMessage((message) => {
      if (message.kind !== "result") {
        return;
      }

      this.handleContentResult(message);
    });
  }

  private handleHostRequest(request: BridgeRequestEnvelope): void {
    ensureBridgeRequestEnvelope(request);

    if (request.method === "bridge.open") {
      this.hostPort.postMessage({
        kind: "response",
        envelope: {
          id: request.id,
          status: "success",
          summary: {
            protocol: BRIDGE_PROTOCOL,
            session_id: this.#sessionId,
            state: "ready",
            relay_path: this.relayPath
          },
          error: null
        }
      });
      return;
    }

    if (request.method === "__ping__") {
      this.hostPort.postMessage({
        kind: "response",
        envelope: {
          id: request.id,
          status: "success",
          summary: {
            session_id: this.#sessionId,
            relay_path: this.relayPath
          },
          error: null
        }
      });
      return;
    }

    if (request.method === "bridge.forward") {
      const command = String(request.params.command ?? "");
      const commandParams =
        typeof request.params.command_params === "object" && request.params.command_params !== null
          ? (request.params.command_params as Record<string, unknown>)
          : {};
      const runId = String(request.params.run_id ?? request.id);
      const sessionId = String(request.params.session_id ?? this.#sessionId);
      const profile = String(request.profile ?? "loopback_profile");
      let gatePayload: Record<string, unknown> | undefined;

      if (XHS_GATE_COMMANDS.has(command)) {
        const ability =
          typeof commandParams.ability === "object" && commandParams.ability !== null
            ? (commandParams.ability as Record<string, unknown>)
            : {};
        const options =
          typeof commandParams.options === "object" && commandParams.options !== null
            ? (commandParams.options as Record<string, unknown>)
            : {};
        const gateBundle = buildLoopbackXhsGateBundle({
          options,
          abilityAction: asString(ability.action),
          runId,
          requestId: request.id,
          commandRequestId: commandParams.request_id,
          gateInvocationId: commandParams.gate_invocation_id,
          sessionId,
          profile: "loopback_profile"
        });
        gatePayload = gateBundle.payload;
        if (gateBundle.consumerGateResult.gate_decision === "blocked") {
          const isEditorInputValidation = options.validation_action === "editor_input";
          const accountSafetyGateResult = asRecord(options.account_safety_gate_result);
          const editorInputFailureSignals = Array.isArray(gateBundle.consumerGateResult.gate_reasons)
            ? gateBundle.consumerGateResult.gate_reasons.map((reason) => String(reason))
            : ["EXECUTION_MODE_GATE_BLOCKED"];
          const input = asRecord(commandParams.input) ?? {};
          const validationText =
            typeof options.validation_text === "string" && options.validation_text.trim().length > 0
              ? options.validation_text.trim()
              : String(input.text ?? "");
          const textWriteResult =
            command === XHS_EDITOR_TEXT_WRITE_COMMAND && options.editor_text_write === true
              ? {
                  validation_action: "editor_input",
                  write_action: "editor_text_write",
                  target_page: "creator_publish_tab",
                  input_text: validationText,
                  focus_confirmed: false,
                  preserved_after_blur: false,
                  success_signals: [],
                  failure_signals: editorInputFailureSignals,
                  minimum_replay: ["focus_editor", "type_short_text", "blur_or_reobserve"],
                  out_of_scope_actions: ["image_upload", "submit", "publish_confirm"],
                  submitted: false,
                  published: false
                }
              : null;
          this.hostPort.postMessage({
            kind: "response",
            envelope: {
              id: request.id,
              status: "error",
              summary: {
                relay_path: this.relayPath
              },
              payload: {
                details: {
                  ability_id: String(
                    ability.id ??
                      XHS_GATE_COMMAND_DEFAULT_ABILITY_IDS[command] ??
                      "xhs.note.search.v1"
                  ),
                  stage: "execution",
                  reason: "EXECUTION_MODE_GATE_BLOCKED",
                  ...(accountSafetyGateResult
                    ? { account_safety_gate_result: accountSafetyGateResult }
                    : {}),
                  ...(isEditorInputValidation
                    ? {
                        validation_action: "editor_input",
                        target_page: "creator_publish_tab",
                        focus_confirmed: false,
                        preserved_after_blur: false,
                        failure_signals: editorInputFailureSignals,
                        minimum_replay: ["focus_editor", "type_short_text", "blur_or_reobserve"],
                        out_of_scope_actions: ["image_upload", "submit", "publish_confirm"]
                      }
                    : {})
                },
                ...gatePayload,
                ...(textWriteResult ? { text_write_result: textWriteResult } : {})
              },
              error: {
                code: "ERR_EXECUTION_FAILED",
                message: `执行模式门禁阻断了当前 ${command} 请求`
              }
            }
          });
          return;
        }
      }

      if (command === "xhs.interact") {
        this.hostPort.postMessage({
          kind: "response",
          envelope: {
            id: request.id,
            status: "error",
            summary: {},
            error: {
              code: "ERR_TRANSPORT_FORWARD_FAILED",
              message: "unsupported command"
            }
          }
        });
        return;
      }

      this.#pendingForward.set(request.id, { request, gatePayload });
      this.contentPort.postMessage({
        kind: "forward",
        id: request.id,
        command,
        commandParams,
        runId,
        sessionId,
        profile
      });
      return;
    }

    this.hostPort.postMessage({
      kind: "response",
      envelope: {
        id: request.id,
        status: "error",
        summary: {},
        error: {
          code: "ERR_TRANSPORT_FORWARD_FAILED",
          message: `unknown method: ${request.method}`
        }
      }
    });
  }

  private handleContentResult(result: Extract<ContentMessage, { kind: "result" }>): void {
    const pending = this.#pendingForward.get(result.id);
    if (!pending) {
      return;
    }
    this.#pendingForward.delete(result.id);

    const request = pending.request;
    const payload =
      typeof result.payload === "object" && result.payload !== null
        ? { ...(result.payload as Record<string, unknown>) }
        : {};
    const summary =
      typeof payload.summary === "object" && payload.summary !== null
        ? (payload.summary as Record<string, unknown>)
        : null;
    if (pending.gatePayload) {
      for (const [key, value] of Object.entries(pending.gatePayload)) {
        const hasInPayload = Object.prototype.hasOwnProperty.call(payload, key);
        const hasInSummary =
          summary !== null && Object.prototype.hasOwnProperty.call(summary, key);
        if (!hasInPayload && !hasInSummary) {
          if (summary !== null) {
            summary[key] = value;
          } else {
            payload[key] = value;
          }
        }
      }
    }

    if (!result.ok) {
      this.hostPort.postMessage({
        kind: "response",
        envelope: {
          id: request.id,
          status: "error",
          summary: {
            relay_path: this.relayPath
          },
          payload,
          error: result.error ?? {
            code: "ERR_TRANSPORT_FORWARD_FAILED",
            message: "content script failed"
          }
        }
      });
      return;
    }

    this.hostPort.postMessage({
      kind: "response",
      envelope: {
        id: request.id,
        status: "success",
        summary: {
          session_id: String(request.params.session_id ?? this.#sessionId),
          run_id: String(request.params.run_id ?? request.id),
          command: String(request.params.command ?? "runtime.ping"),
          relay_path: this.relayPath
        },
        payload,
        error: null
      }
    });
  }
}

class InMemoryHostTransport implements NativeBridgeTransport {
  #pending = new Map<
    string,
    {
      resolve: (response: BridgeResponseEnvelope) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(private readonly hostPort: InMemoryPort<HostMessage>) {
    this.hostPort.onMessage((message) => {
      if (message.kind !== "response") {
        return;
      }

      const pending = this.#pending.get(message.envelope.id);
      if (!pending) {
        return;
      }

      this.#pending.delete(message.envelope.id);
      pending.resolve(message.envelope);
    });
  }

  open(request: BridgeRequestEnvelope): Promise<BridgeResponseEnvelope> {
    return this.request(request);
  }

  forward(request: BridgeRequestEnvelope): Promise<BridgeResponseEnvelope> {
    return this.request(request);
  }

  heartbeat(request: BridgeRequestEnvelope): Promise<BridgeResponseEnvelope> {
    return this.request(request);
  }

  private request(request: BridgeRequestEnvelope): Promise<BridgeResponseEnvelope> {
    ensureBridgeRequestEnvelope(request);
    return new Promise<BridgeResponseEnvelope>((resolve, reject) => {
      this.#pending.set(request.id, { resolve, reject });
      this.hostPort.postMessage({
        kind: "request",
        envelope: request
      });
    });
  }
}

export const createInMemoryLoopbackTransport = (relayPath: string): NativeBridgeTransport => {
  const [hostPort, backgroundHostPort] = createPortPair<HostMessage>();
  const [backgroundContentPort, contentPort] = createPortPair<ContentMessage>();

  new InMemoryContentScriptRuntime(contentPort);
  new InMemoryBackgroundRelay(backgroundHostPort, backgroundContentPort, relayPath);

  return new InMemoryHostTransport(hostPort);
};
