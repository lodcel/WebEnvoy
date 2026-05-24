import { buildLoopbackGate } from "./loopback-gate.js";
import { buildLoopbackAuditRecord } from "./loopback-gate-audit.js";
import { buildLoopbackGatePayload } from "./loopback-gate-payload.js";
import { CliError } from "../../core/errors.js";
import { parseXhsCommandInputForContract } from "../../commands/xhs-input.js";
import { resolveXhsGateDecisionId } from "../../../shared/xhs-gate.js";
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const asInteger = (value) => typeof value === "number" && Number.isInteger(value) ? value : null;
const XHS_GATED_COMMANDS = new Set([
    "xhs.search",
    "xhs.editor_input.validate",
    "xhs.detail",
    "xhs.user_home"
]);
const L2_ALLOWED_ACTIONS = new Set([
    "navigate",
    "locate",
    "reveal_only_click",
    "extract",
    "wait_settled"
]);
const toLoopbackProfileRef = (profile) => profile.startsWith("profile/") ? profile : `profile/${profile}`;
const normalizeL2AbilitySegment = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "page";
const contractRefForL2Ability = (abilityId, kind) => `cad::${abilityId}::${kind}::v1`;
const buildLoopbackL2CandidateShellSeed = (input) => {
    const parsedUrl = new URL(input.targetUrl);
    const inputRef = contractRefForL2Ability(input.abilityId, "input");
    const outputRef = contractRefForL2Ability(input.abilityId, "output");
    const errorRef = contractRefForL2Ability(input.abilityId, "error");
    return {
        ability_id: input.abilityId,
        display_name: `Generic read ${parsedUrl.hostname}`,
        ability_kind: "read",
        entrypoint: "l2.first_usable",
        platform_scope: {
            platform_family: "generic_web",
            site_pattern: parsedUrl.hostname
        },
        execution_layer_support: ["L2"],
        input_contract_ref: inputRef,
        output_contract_ref: outputRef,
        error_contract_ref: errorRef,
        capture_origin: "l2_first_usable_sample",
        capture_run_id: input.runId,
        capture_profile: input.profile,
        capture_artifact_refs: [`loopback-l2-first-usable://${input.runId}`],
        captured_at: input.capturedAt,
        candidate_status: "draft_candidate",
        contract_registry_seed: {
            ability_id: input.abilityId,
            entries: [
                {
                    contract_ref: inputRef,
                    contract_kind: "input",
                    contract_body: {
                        type: "object",
                        required: ["target_url", "goal_kind", "risk_gate_context", "allowed_actions"]
                    }
                },
                {
                    contract_ref: outputRef,
                    contract_kind: "output",
                    contract_body: {
                        type: "object",
                        required: ["page_url", "title", "text_excerpt", "structure"]
                    }
                },
                {
                    contract_ref: errorRef,
                    contract_kind: "error",
                    contract_body: {
                        type: "object",
                        required: ["failure_class"]
                    }
                }
            ]
        }
    };
};
const buildLoopbackXhsSearchPageUrl = (query) => {
    const url = new URL("https://www.xiaohongshu.com/search_result");
    if (query.length > 0) {
        url.searchParams.set("keyword", query);
    }
    return url.toString();
};
const resolveLoopbackXhsSearchActionRef = (options) => options.search_action_ref === "action/xhs.search/submit_enter"
    ? "action/xhs.search/submit_enter"
    : "action/xhs.search/submit_query";
const buildLoopbackXhsSearchPassiveApiContractSummaryFields = (input) => {
    const actionRef = resolveLoopbackXhsSearchActionRef(input.options);
    const pageUrl = buildLoopbackXhsSearchPageUrl(input.query);
    const profileRef = toLoopbackProfileRef(asString(input.options.__runtime_profile_ref) ?? input.profile);
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
export class InMemoryContentScriptRuntime {
    port;
    static BOOTSTRAP_ATTEST_DELAY_MS = 10;
    #bootstrapContext = null;
    constructor(port) {
        this.port = port;
        this.port.onMessage((message) => {
            if (message.kind !== "forward") {
                return;
            }
            this.port.postMessage(this.handleForward(message));
        });
    }
    handleForward(message) {
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
            if (!version ||
                !runId ||
                !runtimeContextId ||
                !profile ||
                !fingerprintRuntime ||
                !fingerprintPatchManifest ||
                !mainWorldSecret) {
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
            if (currentBootstrapContext &&
                currentBootstrapContext.attested &&
                currentBootstrapContext.version === version &&
                currentBootstrapContext.runId === runId &&
                currentBootstrapContext.runtimeContextId === runtimeContextId &&
                currentBootstrapContext.profile === profile) {
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
                if (bootstrapContext &&
                    bootstrapContext.runId === runId &&
                    bootstrapContext.runtimeContextId === runtimeContextId &&
                    bootstrapContext.profile === profile) {
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
            let bootstrapState = "not_started";
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
        if (message.command === "l2.first_usable") {
            const commandParams = asRecord(message.commandParams) ?? {};
            const request = asRecord(commandParams.l2_first_usable_request) ?? commandParams;
            const riskGateContext = asRecord(request.risk_gate_context);
            const targetUrl = asString(request.target_url);
            const riskState = asString(riskGateContext?.risk_state);
            const profile = asString(riskGateContext?.profile) ?? message.profile ?? "profile/default";
            const runId = asString(riskGateContext?.run_id) ?? message.runId;
            const allowedActions = Array.isArray(request.allowed_actions)
                ? request.allowed_actions.filter((item) => typeof item === "string")
                : [];
            const simulated = asString(commandParams.simulate_result) ?? "success";
            const resultPayload = (result) => ({
                kind: "result",
                id: message.id,
                ok: true,
                payload: {
                    l2_first_usable_result: result
                }
            });
            if (riskState === "paused") {
                return resultPayload({
                    success: false,
                    failure_class: "risk_gate_blocked"
                });
            }
            if (!targetUrl ||
                request.goal_kind !== "read" ||
                request.interaction_safety_class !== "pure_read" ||
                !allowedActions.includes("extract") ||
                allowedActions.some((action) => !L2_ALLOWED_ACTIONS.has(action))) {
                return resultPayload({
                    success: false,
                    failure_class: "requires_l1_fallback",
                    l1_fallback_payload: {
                        fallback_goal: "read",
                        fallback_reason: "target_not_located",
                        recommended_strategy: "visual_reacquire"
                    }
                });
            }
            if (simulated === "insufficient_semantic_structure" ||
                simulated === "target_not_located" ||
                simulated === "state_not_settled") {
                return resultPayload({
                    success: false,
                    failure_class: "requires_l1_fallback",
                    l1_fallback_payload: {
                        fallback_goal: "read",
                        fallback_reason: simulated,
                        recommended_strategy: simulated === "target_not_located" ? "visual_reacquire" : "visual_state_check"
                    }
                });
            }
            let parsedUrl;
            try {
                parsedUrl = new URL(targetUrl);
            }
            catch {
                return resultPayload({
                    success: false,
                    failure_class: "requires_l1_fallback",
                    l1_fallback_payload: {
                        fallback_goal: "read",
                        fallback_reason: "target_not_located",
                        recommended_strategy: "visual_reacquire"
                    }
                });
            }
            const capturedAt = "2026-05-23T00:00:00.000Z";
            const abilityId = `generic.${normalizeL2AbilitySegment(parsedUrl.hostname)}.${normalizeL2AbilitySegment(parsedUrl.pathname)}.read.v1`;
            const resultSummary = {
                page_url: targetUrl,
                target_url: targetUrl,
                title: "Loopback L2 Fixture",
                text_excerpt: "Loopback L2 first usable extracted content",
                structure: {
                    headings: [{ ref: "h1:1", text: "Loopback L2 Fixture" }],
                    links: [{ ref: "a:1", text: "Example result" }],
                    buttons: []
                }
            };
            return resultPayload({
                success: true,
                result_summary: resultSummary,
                first_usable_trace: [
                    {
                        step_id: "step-1",
                        action: "locate",
                        target_hint: parsedUrl.hostname,
                        result: "page_structure_located"
                    },
                    {
                        step_id: "step-2",
                        action: "extract",
                        target_hint: "document",
                        result: "structured_read_completed"
                    }
                ],
                interaction_trace: [
                    {
                        action: "locate",
                        target_ref: "document",
                        settled: true,
                        interaction_semantics: "neutral"
                    },
                    {
                        action: "extract",
                        target_ref: "document",
                        settled: true,
                        interaction_semantics: "neutral"
                    }
                ],
                capture_hints: {
                    source: "loopback_l2_fixture",
                    page_url: targetUrl,
                    target_domain: parsedUrl.hostname,
                    allowed_actions: allowedActions
                },
                candidate_shell_seed: buildLoopbackL2CandidateShellSeed({
                    abilityId,
                    targetUrl,
                    runId,
                    profile,
                    capturedAt
                })
            });
        }
        if (message.command === "download.trigger") {
            const commandParams = asRecord(message.commandParams) ?? {};
            const request = asRecord(commandParams.download_ability_request) ??
                asRecord(commandParams.input) ??
                {};
            const source = asRecord(request.download_source);
            const sourceKind = asString(source?.source_kind);
            const triggerMode = asString(commandParams.trigger_mode) === "dispatch_click" ? "dispatch_click" : "resolve_only";
            const resultPayload = (result) => ({
                kind: "result",
                id: message.id,
                ok: true,
                payload: {
                    download_browser_result: result
                }
            });
            if (commandParams.simulate_result === "auth_required") {
                return resultPayload({
                    success: false,
                    failure_reason: "AUTH_OR_SESSION_REQUIRED",
                    trigger_audit: {
                        run_id: message.runId,
                        source_kind: sourceKind ?? "unknown",
                        trigger_mode: triggerMode
                    }
                });
            }
            if (!sourceKind || !source) {
                return resultPayload({
                    success: false,
                    failure_reason: "SOURCE_UNAVAILABLE",
                    trigger_audit: {
                        run_id: message.runId,
                        source_kind: "unknown",
                        trigger_mode: triggerMode
                    }
                });
            }
            if (triggerMode === "dispatch_click") {
                return resultPayload({
                    success: false,
                    failure_reason: "WRITE_BLOCKED",
                    trigger_audit: {
                        run_id: message.runId,
                        source_kind: sourceKind,
                        trigger_mode: triggerMode,
                        reason: "DISPATCH_CLICK_REQUIRES_TRUSTED_INPUT_GATE",
                        download_execution_boundary: "resolve_only_until_trusted_input_gate_fr0021_748",
                        simulated_browser_surface: "loopback_content_runtime"
                    }
                });
            }
            if (sourceKind === "page_blob") {
                return resultPayload({
                    success: false,
                    failure_reason: "SOURCE_UNAVAILABLE",
                    trigger_audit: {
                        run_id: message.runId,
                        source_kind: sourceKind,
                        trigger_mode: triggerMode,
                        locator_found: false,
                        blob_url_present: Boolean(asString(source.blob_url)),
                        reason: "PAGE_BLOB_REQUIRES_BROWSER_LOCATOR_RESOLUTION",
                        simulated_browser_surface: "loopback_content_runtime"
                    }
                });
            }
            const targetUrl = sourceKind === "direct_url"
                ? asString(source.target_url)
                : "https://example.com/export/report.pdf";
            if (!targetUrl) {
                return resultPayload({
                    success: false,
                    failure_reason: "SOURCE_UNAVAILABLE",
                    trigger_audit: {
                        run_id: message.runId,
                        source_kind: sourceKind,
                        trigger_mode: triggerMode
                    }
                });
            }
            return resultPayload({
                success: true,
                download_target: {
                    target_ref: sourceKind === "page_blob"
                        ? asString(source.blob_locator) ?? "loopback-blob"
                        : sourceKind === "page_derived"
                            ? asString(source.trigger_hint) ?? "loopback-export"
                            : "direct_url",
                    source_kind: sourceKind,
                    source_url: targetUrl,
                    file_name_hint: "report.pdf",
                    content_descriptor: {
                        content_kind: "file",
                        mime_type: "application/pdf"
                    },
                    ...(commandParams.simulate_artifact_payload === "success"
                        ? {
                            browser_artifact: {
                                content_base64: Buffer.from("loopback download artifact\n", "utf8").toString("base64"),
                                artifact_ref: `loopback-browser-artifact://${message.runId}`
                            }
                        }
                        : {}),
                    trigger_status: "resolved",
                    trigger_mode: triggerMode,
                    trigger_surface: sourceKind === "direct_url"
                        ? "direct_url"
                        : "dom_button"
                },
                trigger_audit: {
                    run_id: message.runId,
                    source_kind: sourceKind,
                    trigger_mode: triggerMode,
                    simulated_browser_surface: "loopback_content_runtime"
                }
            });
        }
        if (XHS_GATED_COMMANDS.has(message.command)) {
            const simulated = typeof message.commandParams.options === "object" &&
                message.commandParams.options !== null &&
                typeof message.commandParams.options.simulate_result === "string"
                ? String(message.commandParams.options.simulate_result)
                : "success";
            const ability = typeof message.commandParams.ability === "object" && message.commandParams.ability !== null
                ? message.commandParams.ability
                : {};
            const input = typeof message.commandParams.input === "object" && message.commandParams.input !== null
                ? message.commandParams.input
                : {};
            const options = typeof message.commandParams.options === "object" && message.commandParams.options !== null
                ? message.commandParams.options
                : {};
            const decisionId = resolveXhsGateDecisionId({
                runId: message.runId,
                requestId: message.id,
                commandRequestId: message.commandParams.request_id,
                gateInvocationId: asString(message.commandParams.gate_invocation_id),
                issueScope: options.issue_scope,
                requestedExecutionMode: options.requested_execution_mode
            });
            const gate = buildLoopbackGate(options, asString(ability.action), {
                runId: message.runId,
                requestId: message.id,
                commandRequestId: asString(message.commandParams.request_id) ?? undefined,
                sessionId: message.sessionId,
                gateInvocationId: asString(message.commandParams.gate_invocation_id) ?? undefined,
                decisionId
            });
            const consumerGateResult = gate.consumerGateResult;
            const auditRecord = buildLoopbackAuditRecord({
                runId: message.runId,
                sessionId: message.sessionId,
                profile: "loopback_profile",
                gate
            });
            const gateBundle = buildLoopbackGatePayload({
                runId: message.runId,
                sessionId: message.sessionId,
                profile: "loopback_profile",
                gate,
                auditRecord
            });
            const commandName = message.command;
            let normalizedInput = input;
            try {
                normalizedInput = parseXhsCommandInputForContract({
                    command: commandName,
                    abilityId: asString(ability.id) ?? "unknown",
                    abilityAction: asString(ability.action) === "write" || asString(ability.action) === "download"
                        ? asString(ability.action)
                        : "read",
                    payload: input,
                    options
                });
            }
            catch (error) {
                if (error instanceof CliError && error.code === "ERR_CLI_INVALID_ARGS") {
                    return {
                        kind: "result",
                        id: message.id,
                        ok: false,
                        error: {
                            code: error.code,
                            message: error.message
                        },
                        payload: {
                            details: error.details
                        }
                    };
                }
                throw error;
            }
            const commandSpec = commandName === "xhs.editor_input.validate"
                ? {
                    defaultAbilityId: "xhs.editor.input.v1",
                    page_kind: "compose",
                    url: "https://creator.xiaohongshu.com/publish/publish",
                    title: "Creator Publish",
                    request_method: "POST",
                    request_url: "/web_api/sns/v2/note",
                    successDataRef: {
                        validation_action: "editor_input"
                    }
                }
                : commandName === "xhs.detail"
                    ? {
                        defaultAbilityId: "xhs.note.detail.v1",
                        page_kind: "detail",
                        url: "https://www.xiaohongshu.com/explore/note-id",
                        title: "Detail",
                        request_method: "POST",
                        request_url: "/api/sns/web/v1/feed",
                        successDataRef: {
                            note_id: String(normalizedInput.note_id ?? "")
                        }
                    }
                    : commandName === "xhs.user_home"
                        ? {
                            defaultAbilityId: "xhs.user.home.v1",
                            page_kind: "user_home",
                            url: "https://www.xiaohongshu.com/user/profile/user-id",
                            title: "User Home",
                            request_method: "GET",
                            request_url: "/api/sns/web/v1/user_posted",
                            successDataRef: {
                                user_id: String(normalizedInput.user_id ?? "")
                            }
                        }
                        : {
                            defaultAbilityId: "xhs.note.search.v1",
                            page_kind: "search",
                            url: "https://www.xiaohongshu.com/search_result",
                            title: "Search Result",
                            request_method: "POST",
                            request_url: "/api/sns/web/v1/search/notes",
                            successDataRef: {
                                query: String(normalizedInput.query ?? ""),
                                search_id: "loopback-search-id"
                            }
                        };
            const successObservability = {
                page_state: {
                    page_kind: commandSpec.page_kind,
                    url: commandSpec.url,
                    title: commandSpec.title,
                    ready_state: "complete",
                    observation_status: "complete"
                },
                key_requests: [],
                failure_site: null
            };
            const buildSuccessfulResult = (capabilityResult, overrides) => ({
                kind: "result",
                id: message.id,
                ok: true,
                payload: {
                    summary: capabilityResult === undefined
                        ? {
                            ...(overrides?.summary ?? {}),
                            ...gateBundle
                        }
                        : {
                            capability_result: capabilityResult,
                            ...(overrides?.summary ?? {}),
                            ...gateBundle
                        },
                    observability: {
                        ...successObservability,
                        ...(overrides?.key_requests ? { key_requests: overrides.key_requests } : {})
                    }
                }
            });
            if (consumerGateResult.gate_decision === "blocked") {
                const isEditorInputValidation = options.validation_action === "editor_input";
                const editorInputFailureSignals = Array.isArray(consumerGateResult.gate_reasons)
                    ? consumerGateResult.gate_reasons.map((reason) => String(reason))
                    : ["EXECUTION_MODE_GATE_BLOCKED"];
                return {
                    kind: "result",
                    id: message.id,
                    ok: false,
                    error: {
                        code: "ERR_EXECUTION_FAILED",
                        message: `执行模式门禁阻断了当前 ${commandName} 请求`
                    },
                    payload: {
                        details: {
                            ability_id: String(ability.id ?? commandSpec.defaultAbilityId),
                            stage: "execution",
                            reason: "EXECUTION_MODE_GATE_BLOCKED",
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
                        ...gateBundle
                    }
                };
            }
            if (consumerGateResult.effective_execution_mode === "dry_run" ||
                consumerGateResult.effective_execution_mode === "recon") {
                if (options.xhs_recovery_probe === true && simulated === "account_abnormal") {
                    return buildSuccessfulResult({
                        ability_id: String(ability.id ?? commandSpec.defaultAbilityId),
                        layer: String(ability.layer ?? "L3"),
                        action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
                        outcome: "partial",
                        data_ref: commandSpec.successDataRef,
                        metrics: {
                            count: 0
                        }
                    }, {
                        key_requests: [
                            {
                                failure_reason: "ACCOUNT_ABNORMAL",
                                status_code: 461
                            }
                        ]
                    });
                }
                return buildSuccessfulResult({
                    ability_id: String(ability.id ?? commandSpec.defaultAbilityId),
                    layer: String(ability.layer ?? "L3"),
                    action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
                    outcome: "partial",
                    data_ref: commandSpec.successDataRef,
                    metrics: {
                        count: 0
                    }
                });
            }
            if (consumerGateResult.effective_execution_mode === "live_write" &&
                options.validation_action === "editor_input") {
                const validationText = typeof options.validation_text === "string" && options.validation_text.trim().length > 0
                    ? options.validation_text.trim()
                    : "WebEnvoy editor_input validation";
                return {
                    kind: "result",
                    id: message.id,
                    ok: false,
                    payload: {
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
                            ...gateBundle,
                            interaction_result: {
                                validation_action: "editor_input",
                                target_page: "creator.xiaohongshu.com/publish",
                                success_signals: [],
                                failure_signals: ["EDITOR_INPUT_VALIDATION_REQUIRED"],
                                minimum_replay: ["focus_editor", "type_short_text", "blur_or_reobserve"],
                                out_of_scope_actions: ["image_upload", "submit", "publish_confirm"]
                            }
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
                    ability_id: String(ability.id ?? commandSpec.defaultAbilityId),
                    action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
                    outcome: "success"
                });
            }
            if (simulated === "capability_result_invalid_outcome") {
                return buildSuccessfulResult({
                    ability_id: String(ability.id ?? commandSpec.defaultAbilityId),
                    layer: String(ability.layer ?? "L3"),
                    action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
                    outcome: "blocked"
                });
            }
            if (simulated === "success") {
                const successSummary = commandName === "xhs.search"
                    && options.xhs_search_passive_readiness_contract === true
                    ? buildLoopbackXhsSearchPassiveApiContractSummaryFields({
                        runId: message.runId,
                        profile: message.profile,
                        query: String(normalizedInput.query ?? ""),
                        options,
                        requestUrl: commandSpec.request_url
                    })
                    : undefined;
                return buildSuccessfulResult({
                    ability_id: String(ability.id ?? commandSpec.defaultAbilityId),
                    layer: String(ability.layer ?? "L3"),
                    action: String(consumerGateResult.action_type ?? ability.action ?? "read"),
                    outcome: "success",
                    data_ref: commandSpec.successDataRef,
                    metrics: {
                        count: 1,
                        duration_ms: 12
                    }
                }, {
                    ...(successSummary ? { summary: successSummary } : {}),
                    key_requests: [
                        {
                            request_id: "req-loopback-001",
                            stage: "request",
                            method: commandSpec.request_method,
                            url: commandSpec.request_url,
                            outcome: "completed",
                            status_code: 200
                        }
                    ]
                });
            }
            return {
                kind: "result",
                id: message.id,
                ok: false,
                error: {
                    code: "ERR_EXECUTION_FAILED",
                    message: simulated === "login_required"
                        ? `登录态缺失，无法执行 ${commandName}`
                        : simulated === "account_abnormal"
                            ? "账号异常，平台拒绝当前请求"
                            : simulated === "browser_env_abnormal"
                                ? "浏览器环境异常，平台拒绝当前请求"
                                : simulated === "captcha_required"
                                    ? "平台要求额外人机验证，无法继续执行"
                                    : simulated === "classifier_only_account_abnormal"
                                        ? `${commandName} 接口返回了未识别的失败响应`
                                        : simulated === "classifier_account_abnormal_with_generic_diagnosis"
                                            ? `${commandName} 接口返回了未识别的失败响应`
                                            : simulated === "stale_account_safety_with_current_captcha"
                                                ? `${commandName} 接口返回了当前人机验证阻断`
                                                : simulated === "generic_api_warning"
                                                    ? `${commandName} 接口返回了未识别的失败响应`
                                                    : simulated === "request_context_missing_with_humanized_action"
                                                        ? "当前页面现场缺少可复用的搜索请求模板"
                                                        : simulated === "signature_entry_missing"
                                                            ? "页面签名入口不可用"
                                                            : `网关调用失败，当前上下文不足以完成 ${commandName} 请求`
                },
                payload: {
                    details: {
                        ability_id: String(ability.id ?? commandSpec.defaultAbilityId),
                        stage: "execution",
                        reason: simulated === "login_required"
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
                                                        : simulated === "signature_entry_missing"
                                                            ? "SIGNATURE_ENTRY_MISSING"
                                                            : simulated === "request_context_missing_with_humanized_action"
                                                                ? "REQUEST_CONTEXT_MISSING"
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
                    ...gateBundle,
                    observability: {
                        page_state: {
                            page_kind: simulated === "login_required" ? "login" : commandSpec.page_kind,
                            url: simulated === "login_required" ? "https://www.xiaohongshu.com/login" : commandSpec.url,
                            title: commandSpec.title,
                            ready_state: "complete",
                            observation_status: "complete"
                        },
                        key_requests: simulated === "signature_entry_missing"
                            ? []
                            : simulated === "stale_account_safety_with_current_captcha"
                                ? [
                                    {
                                        request_id: "req-loopback-generic-001",
                                        stage: "request",
                                        method: commandSpec.request_method,
                                        url: commandSpec.request_url,
                                        outcome: "failed",
                                        status_code: 500,
                                        failure_reason: "request_context_missing"
                                    },
                                    {
                                        request_id: "req-loopback-captcha-002",
                                        stage: "request",
                                        method: commandSpec.request_method,
                                        url: commandSpec.request_url,
                                        outcome: "failed",
                                        status_code: 429,
                                        failure_reason: "request_context_missing"
                                    }
                                ]
                                : [
                                    {
                                        request_id: "req-loopback-001",
                                        stage: "request",
                                        method: commandSpec.request_method,
                                        url: commandSpec.request_url,
                                        outcome: "failed",
                                        status_code: simulated === "account_abnormal"
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
                                        failure_reason: simulated === "classifier_only_account_abnormal" ||
                                            simulated === "classifier_account_abnormal_with_generic_diagnosis"
                                            ? "request_context_missing"
                                            : simulated === "request_context_missing_with_humanized_action"
                                                ? "request_context_missing"
                                                : simulated
                                    }
                                ],
                        failure_site: {
                            stage: simulated === "signature_entry_missing" ? "action" : "request",
                            component: simulated === "signature_entry_missing" ? "page" : "network",
                            target: simulated === "signature_entry_missing"
                                ? "window._webmsxyw"
                                : commandSpec.request_url,
                            summary: simulated === "classifier_only_account_abnormal" ||
                                simulated === "classifier_account_abnormal_with_generic_diagnosis"
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
                            target: simulated === "signature_entry_missing"
                                ? "window._webmsxyw"
                                : commandSpec.request_url,
                            summary: simulated === "classifier_only_account_abnormal" ||
                                simulated === "classifier_account_abnormal_with_generic_diagnosis"
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
        return {
            kind: "result",
            id: message.id,
            ok: true,
            payload: {
                message: "pong"
            }
        };
    }
}
