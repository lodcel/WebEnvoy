import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "../core/errors.js";
import { mapCapabilitySummaryForContract } from "../core/capability-output.js";
import { NativeMessagingBridge, NativeMessagingTransportError } from "../runtime/native-messaging/bridge.js";
import { NativeHostBridgeTransport } from "../runtime/native-messaging/host.js";
import { createLoopbackNativeBridgeTransport } from "../runtime/native-messaging/loopback.js";
import { buildLoopbackAuditRecord } from "../runtime/native-messaging/loopback-gate-audit.js";
import { buildLoopbackGate } from "../runtime/native-messaging/loopback-gate.js";
import { buildLoopbackGatePayload } from "../runtime/native-messaging/loopback-gate-payload.js";
import { appendFingerprintContext, buildFingerprintContextForMeta } from "../runtime/fingerprint-runtime.js";
import { classifyCloseoutHardStopRisk } from "../runtime/closeout-hard-stop-risk.js";
import { evaluateCloseoutEvidence } from "../runtime/closeout-evidence-evaluator.js";
import { verifyCloseoutCanonicalExecutionAudit } from "../runtime/closeout-canonical-execution-audit-verifier.js";
import { ProfileStore } from "../runtime/profile-store.js";
import { isAccountSafetyReason, toAccountSafetyStatus } from "../runtime/account-safety.js";
import { toSessionRhythmStatusView, toXhsCloseoutRhythmStatus } from "../runtime/xhs-closeout-rhythm.js";
import { ProfileRuntimeService } from "../runtime/profile-runtime.js";
import { resolveRuntimeProfileRoot } from "../runtime/worktree-root.js";
import { readXhsCloseoutValidationGateView, resolveXhsCloseoutReadinessBaselineExecutionMode, toXhsCloseoutValidationGateJson } from "../runtime/anti-detection-validation.js";
import { RuntimeStoreError, SQLiteRuntimeStore, resolveRuntimeStorePath } from "../runtime/store/sqlite-runtime-store.js";
import { prepareOfficialChromeRuntime } from "../runtime/official-chrome-runtime.js";
import { buildCapabilityResult, ISSUE209_INTERNAL_ADMISSION_DRAFT_KEY, normalizeGateOptionsForContract, parseAbilityEnvelopeForContract, parseCreatorPublishAdmissionInputForContract, parseDetailInputForContract, parseEditorTextWriteInputForContract, parseEditorInputValidateInputForContract, parseMediaUploadDiscoveryInputForContract, parseSearchInputForContract, parseUserHomeInputForContract, prepareIssue209LiveReadEnvelopeForContract } from "./xhs-input.js";
const XHS_EDITOR_INPUT_VALIDATE_COMMAND = "xhs.editor_input.validate";
const XHS_EDITOR_TEXT_WRITE_COMMAND = "xhs.editor_text.write";
const XHS_EDITOR_INPUT_ABILITY_ID = "xhs.editor.input.v1";
const XHS_CREATOR_PUBLISH_ABILITY_ID = "xhs.creator.publish.v1";
const XHS_CREATOR_PUBLISH_ADMIT_COMMAND = "xhs.creator_publish.admit";
const XHS_MEDIA_UPLOAD_DISCOVER_COMMAND = "xhs.media_upload.discover";
export { buildOfficialChromeRuntimeStatusParams } from "../runtime/official-chrome-runtime.js";
export { normalizeGateOptionsForContract } from "./xhs-input.js";
const asObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const XHS_CREATOR_PUBLISH_ABILITY = {
    id: XHS_CREATOR_PUBLISH_ABILITY_ID,
    layer: "L3",
    action: "write"
};
const XHS_EDITOR_INPUT_ABILITY = {
    id: XHS_EDITOR_INPUT_ABILITY_ID,
    layer: "L3",
    action: "write"
};
// editor_text.write is the controlled #208 editor_input text-write path.
const XHS_EDITOR_TEXT_WRITE_ABILITY = {
    id: XHS_EDITOR_INPUT_ABILITY_ID,
    layer: "L3",
    action: "write"
};
const XHS_MEDIA_UPLOAD_DISCOVER_ABILITY = {
    id: XHS_CREATOR_PUBLISH_ABILITY_ID,
    layer: "L3",
    action: "write"
};
const DEDICATED_XHS_SHORTHAND_OPTION_KEYS = new Set([
    "target_domain",
    "target_tab_id",
    "target_page",
    "requested_execution_mode",
    "risk_state",
    "issue_scope",
    "action_type",
    "validation_action",
    "editor_text_write",
    "discovery_action",
    "approval_record",
    "fixture_success"
]);
const DEDICATED_XHS_SHORTHAND_PASSTHROUGH_KEYS = new Set([
    "request_id",
    "gate_invocation_id"
]);
const DEDICATED_XHS_FULL_ENVELOPE_KEYS = new Set([
    "action_request",
    "resource_binding",
    "authorization_grant",
    "runtime_target"
]);
const dedicatedXhsInputError = (message, ability, details) => {
    const errorDetails = {
        ability_id: ability.id,
        stage: "input_validation",
        ...details
    };
    return new CliError("ERR_CLI_INVALID_ARGS", message, {
        details: errorDetails
    });
};
const assertDedicatedXhsShorthandOptions = (options, ability) => {
    const unknownKeys = Object.keys(options).filter((key) => !DEDICATED_XHS_SHORTHAND_OPTION_KEYS.has(key));
    if (unknownKeys.length > 0) {
        throw dedicatedXhsInputError("XHS dedicated command shorthand option invalid", ability, {
            reason: "DEDICATED_OPTION_UNKNOWN",
            unknown_keys: unknownKeys
        });
    }
};
const normalizeDedicatedXhsCommandParams = (params, ability) => {
    const explicitAbility = asObject(params.ability);
    if (explicitAbility) {
        if (asString(explicitAbility.id) !== ability.id ||
            asString(explicitAbility.layer) !== ability.layer ||
            asString(explicitAbility.action) !== ability.action) {
            throw dedicatedXhsInputError("XHS dedicated command ability mismatch", ability, {
                reason: "DEDICATED_ABILITY_MISMATCH",
                expected_ability: ability,
                actual_ability: explicitAbility
            });
        }
        return params;
    }
    const input = asObject(params.input) ?? {};
    const explicitOptions = asObject(params.options) ?? {};
    assertDedicatedXhsShorthandOptions(explicitOptions, ability);
    const options = {};
    const passthrough = {};
    for (const [key, value] of Object.entries(params)) {
        if (key === "input" || key === "options") {
            continue;
        }
        if (DEDICATED_XHS_SHORTHAND_PASSTHROUGH_KEYS.has(key)) {
            passthrough[key] = value;
            continue;
        }
        if (DEDICATED_XHS_FULL_ENVELOPE_KEYS.has(key)) {
            throw dedicatedXhsInputError("XHS dedicated command shorthand object requires ability envelope", ability, {
                reason: "DEDICATED_OBJECT_REQUIRES_ABILITY",
                object_key: key
            });
        }
        if (DEDICATED_XHS_SHORTHAND_OPTION_KEYS.has(key)) {
            options[key] = value;
            continue;
        }
        throw dedicatedXhsInputError("XHS dedicated command shorthand option invalid", ability, {
            reason: "DEDICATED_OPTION_UNKNOWN",
            unknown_keys: [key]
        });
    }
    const mergedOptions = {
        ...options,
        ...explicitOptions
    };
    assertDedicatedXhsShorthandOptions(mergedOptions, ability);
    return {
        ability: { ...ability },
        input,
        options: mergedOptions,
        ...passthrough
    };
};
const WEBENVOY_RUNTIME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const resolveGitHeadForCwd = (cwd) => {
    const result = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
    });
    if (result.status !== 0) {
        return null;
    }
    const [root, head] = result.stdout
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (!root || !head) {
        return null;
    }
    return { root, head };
};
const isWebEnvoyCheckoutRoot = (root) => {
    try {
        const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
        return packageJson.name === "@webenvoy/cli";
    }
    catch {
        return false;
    }
};
const isWebEnvoySourceCheckoutRoot = (root) => isWebEnvoyCheckoutRoot(root) && existsSync(resolve(root, "src", "commands", "xhs-runtime.ts"));
const resolvePackageGitHeadForCwd = (cwd) => {
    let current = resolve(cwd);
    while (true) {
        try {
            const packageJson = JSON.parse(readFileSync(resolve(current, "package.json"), "utf8"));
            const gitHead = asString(packageJson.gitHead);
            if (packageJson.name === "@webenvoy/cli" && gitHead !== null) {
                return gitHead;
            }
        }
        catch {
            // Keep walking toward the filesystem root; packaged dist may not sit at cwd.
        }
        const parent = dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
};
const resolveRuntimeBuildMetadataHeadForCwd = (cwd) => {
    let current = resolve(cwd);
    while (true) {
        for (const metadataPath of [
            resolve(current, "dist", "runtime-build-metadata.json"),
            resolve(current, "runtime-build-metadata.json")
        ]) {
            try {
                const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
                const gitHead = asString(metadata.gitHead);
                if (metadata.name === "@webenvoy/cli" && gitHead !== null) {
                    return gitHead;
                }
            }
            catch {
                // Keep walking toward the filesystem root; dist-only runtime metadata is optional.
            }
        }
        const parent = dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
};
const asPositiveInteger = (value) => typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
export const resolveForwardTimeoutMsForContract = (params) => asPositiveInteger(params.timeout_ms);
const toSessionRhythmIdPart = (value) => value.replace(/[^A-Za-z0-9._-]+/gu, "_");
const SESSION_RHYTHM_STORE_ISSUE_SCOPES = new Set(["issue_208", "issue_209", "issue_753", "issue_755"]);
const resolveSessionRhythmStoreIssueScope = (issueScope) => {
    return issueScope && SESSION_RHYTHM_STORE_ISSUE_SCOPES.has(issueScope) ? issueScope : null;
};
const buildSessionRhythmAdmissionForRuntime = async (input) => {
    const issueScope = resolveSessionRhythmStoreIssueScope(input.issueScope ?? "issue_209");
    if (!input.profile || !issueScope) {
        return null;
    }
    let store = null;
    try {
        store = new SQLiteRuntimeStore(resolveRuntimeStorePath(input.cwd));
        const persisted = await store.getSessionRhythmStatusView({
            profile: input.profile,
            platform: "xhs",
            issueScope,
            sessionId: input.sessionId,
            runId: input.runId
        });
        const shouldWriteCurrentDecision = !!persisted ||
            !!input.profileMeta?.xhsCloseoutRhythm ||
            input.profileMeta?.accountSafety?.state === "account_risk_blocked";
        if (!shouldWriteCurrentDecision) {
            return null;
        }
        const currentView = toSessionRhythmStatusView({
            profile: input.profile,
            rhythm: input.profileMeta?.xhsCloseoutRhythm,
            accountSafety: input.profileMeta?.accountSafety,
            issueScope,
            sessionId: input.sessionId,
            sourceRunId: input.runId,
            effectiveExecutionMode: input.gate.requestedExecutionMode
        });
        const currentWindowState = asObject(currentView.session_rhythm_window_state);
        const currentEvent = asObject(currentView.session_rhythm_event);
        const currentDecision = asObject(currentView.session_rhythm_decision);
        const persistedWindowState = persisted?.window_state;
        const persistedEvent = persisted?.event;
        const persistedDecision = persisted?.decision;
        const windowId = asString(persistedWindowState?.window_id) ?? asString(currentWindowState?.window_id);
        const windowStateForRecord = persistedWindowState ?? currentWindowState;
        const eventForRecord = persistedEvent ?? currentEvent;
        const decisionForRecord = persistedDecision ?? currentDecision;
        if (!windowId || !windowStateForRecord || !eventForRecord || !decisionForRecord) {
            return null;
        }
        const liveRunPendingExecutionAudit = isLiveXhsExecutionMode(input.gate.requestedExecutionMode);
        const currentSourceKey = toSessionRhythmIdPart(input.runId);
        const currentEventId = `rhythm_evt_preflight_${currentSourceKey}`;
        const currentDecisionId = `rhythm_decision_preflight_${currentSourceKey}`;
        const admissionDecision = {
            ...decisionForRecord,
            decision_id: currentDecisionId,
            window_id: windowId,
            run_id: input.runId,
            session_id: input.sessionId,
            profile: input.profile,
            current_phase: asString(windowStateForRecord.current_phase) ??
                asString(decisionForRecord.current_phase) ??
                "warmup",
            current_risk_state: asString(windowStateForRecord.risk_state) ??
                asString(decisionForRecord.current_risk_state) ??
                "paused",
            next_phase: asString(windowStateForRecord.current_phase) ??
                asString(decisionForRecord.next_phase) ??
                "warmup",
            next_risk_state: asString(windowStateForRecord.risk_state) ??
                asString(decisionForRecord.next_risk_state) ??
                "paused",
            effective_execution_mode: input.gate.requestedExecutionMode,
            decision: liveRunPendingExecutionAudit
                ? "deferred"
                : (asString(decisionForRecord.decision) ?? "blocked"),
            reason_codes: liveRunPendingExecutionAudit
                ? ["XHS_LIVE_ADMISSION_PENDING_EXECUTION_AUDIT"]
                : Array.isArray(decisionForRecord.reason_codes)
                    ? decisionForRecord.reason_codes
                    : [],
            requires: liveRunPendingExecutionAudit
                ? ["execution_audit_appended"]
                : Array.isArray(decisionForRecord.requires)
                    ? decisionForRecord.requires
                    : []
        };
        await store.recordSessionRhythmStatusView({
            profile: input.profile,
            platform: "xhs",
            issueScope,
            windowState: {
                ...windowStateForRecord,
                window_id: windowId,
                last_event_id: asString(persistedWindowState?.last_event_id) ?? currentEventId,
                source_run_id: asString(persistedWindowState?.source_run_id) ?? input.runId
            },
            event: {
                ...eventForRecord,
                event_id: asString(persistedEvent?.event_id) ?? currentEventId,
                session_id: asString(persistedEvent?.session_id) ?? input.sessionId,
                window_id: windowId,
                source_audit_event_id: asString(persistedEvent?.source_audit_event_id)
            },
            decision: admissionDecision
        });
        const current = await store.getSessionRhythmStatusView({
            profile: input.profile,
            platform: "xhs",
            issueScope,
            sessionId: input.sessionId,
            runId: input.runId
        });
        const currentWindowId = asString(current?.window_state.window_id);
        const currentDecisionIdFromStore = asString(current?.decision.run_id) === input.runId
            ? asString(current?.decision.decision_id)
            : null;
        if (currentWindowId || currentDecisionIdFromStore) {
            return {
                ...(currentWindowId ? { __session_rhythm_window_id: currentWindowId } : {}),
                ...(currentDecisionIdFromStore
                    ? { __session_rhythm_decision_id: currentDecisionIdFromStore }
                    : {})
            };
        }
    }
    catch (error) {
        if (error instanceof RuntimeStoreError) {
            throw new CliError("ERR_RUNTIME_UNAVAILABLE", `运行记录存储失败: ${error.code}`, {
                retryable: error.code !== "ERR_RUNTIME_STORE_SCHEMA_MISMATCH",
                cause: error
            });
        }
        throw error;
    }
    finally {
        try {
            store?.close();
        }
        catch {
            // Rhythm admission is best-effort after the write/query finishes.
        }
    }
    return null;
};
const readPersistedSessionRhythmBlockStatus = async (input) => {
    const issueScope = resolveSessionRhythmStoreIssueScope(input.issueScope ?? "issue_209");
    if (!input.profile || !issueScope) {
        return null;
    }
    let store = null;
    try {
        store = new SQLiteRuntimeStore(resolveRuntimeStorePath(input.cwd));
        const persisted = await store.getSessionRhythmStatusView({
            profile: input.profile,
            platform: "xhs",
            issueScope
        });
        const windowState = persisted?.window_state;
        const persistedDecision = persisted?.decision;
        const persistedDecisionValue = asString(persistedDecision?.decision);
        const event = persisted?.event;
        const profileRhythmState = asString(input.profileMeta?.xhsCloseoutRhythm?.state);
        const persistedPhase = asString(windowState?.current_phase);
        const fallbackAllowed = !profileRhythmState || profileRhythmState === "not_required";
        if (fallbackAllowed &&
            (persistedPhase === "recovery_probe" || persistedPhase === "warmup")) {
            return {
                state: "single_probe_required",
                cooldown_until: asString(windowState?.cooldown_until),
                operator_confirmed_at: null,
                single_probe_required: true,
                single_probe_passed_at: null,
                probe_run_id: asString(windowState?.source_run_id),
                full_bundle_blocked: true,
                reason_codes: Array.isArray(persistedDecision?.reason_codes) &&
                    persistedDecision.reason_codes.every((reason) => typeof reason === "string")
                    ? persistedDecision.reason_codes
                    : [
                        asString(event?.reason) ??
                            asString(windowState?.last_event_id) ??
                            "PERSISTED_SESSION_RHYTHM_RECOVERY_REQUIRED"
                    ]
            };
        }
        if (persistedPhase !== "cooldown" &&
            asString(windowState?.risk_state) !== "paused") {
            if (persistedDecisionValue === "deferred" &&
                fallbackAllowed) {
                const reasonCodes = Array.isArray(persistedDecision?.reason_codes) &&
                    persistedDecision.reason_codes.every((reason) => typeof reason === "string")
                    ? persistedDecision.reason_codes
                    : [
                        asString(event?.reason) ??
                            asString(windowState?.last_event_id) ??
                            "XHS_RECOVERY_SINGLE_PROBE_PASSED"
                    ];
                return {
                    state: "single_probe_passed",
                    cooldown_until: asString(windowState?.cooldown_until),
                    operator_confirmed_at: null,
                    single_probe_required: false,
                    single_probe_passed_at: asString(persistedDecision?.decided_at) ?? asString(event?.recorded_at),
                    probe_run_id: asString(persistedDecision?.run_id) ?? asString(windowState?.source_run_id),
                    full_bundle_blocked: true,
                    reason_codes: reasonCodes
                };
            }
            if (persistedDecisionValue &&
                persistedDecisionValue !== "allowed" &&
                fallbackAllowed) {
                return {
                    state: "operator_confirmation_required",
                    cooldown_until: null,
                    operator_confirmed_at: null,
                    single_probe_required: true,
                    single_probe_passed_at: null,
                    probe_run_id: null,
                    full_bundle_blocked: true,
                    reason_codes: Array.isArray(persistedDecision?.reason_codes) &&
                        persistedDecision.reason_codes.every((reason) => typeof reason === "string")
                        ? persistedDecision.reason_codes
                        : [
                            asString(event?.reason) ??
                                asString(windowState?.last_event_id) ??
                                "PERSISTED_SESSION_RHYTHM_BLOCKED"
                        ]
                };
            }
            return null;
        }
        const cooldownUntil = asString(windowState?.cooldown_until);
        const operatorConfirmedAt = asString(input.profileMeta?.xhsCloseoutRhythm?.operatorConfirmedAt);
        if (operatorConfirmedAt &&
            (!cooldownUntil || Date.parse(cooldownUntil) <= Date.now())) {
            return null;
        }
        return {
            state: "cooldown",
            cooldown_until: cooldownUntil,
            operator_confirmed_at: null,
            single_probe_required: true,
            single_probe_passed_at: null,
            probe_run_id: null,
            full_bundle_blocked: true,
            reason_codes: [
                asString(event?.reason) ??
                    asString(windowState?.last_event_id) ??
                    "PERSISTED_SESSION_RHYTHM_PAUSED"
            ]
        };
    }
    catch (error) {
        if (error instanceof RuntimeStoreError) {
            throw new CliError("ERR_RUNTIME_UNAVAILABLE", `运行记录存储失败: ${error.code}`, {
                retryable: error.code !== "ERR_RUNTIME_STORE_SCHEMA_MISMATCH",
                cause: error
            });
        }
        throw error;
    }
    finally {
        try {
            store?.close();
        }
        catch {
            // Read-only preflight best-effort close.
        }
    }
};
const asInteger = (value) => {
    if (typeof value === "number" && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : null;
    }
    return null;
};
const hasOwn = (record, key) => !!record && Object.prototype.hasOwnProperty.call(record, key);
const LIVE_XHS_EXECUTION_MODES = new Set([
    "live_read_limited",
    "live_read_high_risk",
    "live_write"
]);
const isLiveXhsExecutionMode = (mode) => LIVE_XHS_EXECUTION_MODES.has(mode);
const isLiveXhsReadExecutionMode = (mode) => mode === "live_read_limited" || mode === "live_read_high_risk";
const isLegacyXhsSearchEditorInputValidation = (input) => input.command === "xhs.search" &&
    input.ability.action === "write" &&
    asString(input.options.issue_scope) === "issue_208" &&
    asString(input.options.validation_action) === "editor_input";
const buildXhsCommandAliasDiagnostics = (input) => {
    if (!isLegacyXhsSearchEditorInputValidation(input)) {
        return null;
    }
    return {
        status: "deprecated_alias",
        source_command: "xhs.search",
        source_ability_id: input.ability.id,
        canonical_command: XHS_EDITOR_INPUT_VALIDATE_COMMAND,
        canonical_ability_id: XHS_EDITOR_INPUT_ABILITY_ID,
        validation_action: "editor_input",
        issue_scope: "issue_208",
        replacement: {
            command: XHS_EDITOR_INPUT_VALIDATE_COMMAND,
            ability_id: XHS_EDITOR_INPUT_ABILITY_ID
        },
        migration_hint: "Use xhs.editor_input.validate with ability.id=xhs.editor.input.v1; keep target and admission options unchanged."
    };
};
const mergeCommandAliasDiagnosticsIntoPayload = (payload, diagnostics) => {
    if (!diagnostics) {
        return;
    }
    const details = asObject(payload.details);
    payload.command_alias_diagnostics = diagnostics;
    payload.details = {
        ...(details ?? {}),
        command_alias_diagnostics: diagnostics
    };
};
const attachCommandAliasDiagnosticsToResult = (result, diagnostics) => {
    if (!diagnostics) {
        return result;
    }
    return {
        ...result,
        summary: {
            ...result.summary,
            command_alias_diagnostics: diagnostics
        }
    };
};
const XHS_CLOSEOUT_ROUTE_EVIDENCE_ABILITY_IDS = new Set([
    "xhs.note.search.v1",
    "xhs.search.notes.v1",
    "xhs.note.detail.v1",
    "xhs.user.home.v1"
]);
const ACCOUNT_SAFETY_REASON_ALIASES = {
    SESSION_EXPIRED: "SESSION_EXPIRED",
    XHS_LOGIN_REQUIRED: "XHS_LOGIN_REQUIRED",
    LOGIN_REQUIRED: "XHS_LOGIN_REQUIRED",
    ACCOUNT_ABNORMAL: "ACCOUNT_ABNORMAL",
    XHS_ACCOUNT_RISK_PAGE: "XHS_ACCOUNT_RISK_PAGE",
    CAPTCHA_REQUIRED: "CAPTCHA_REQUIRED",
    SECURITY_REDIRECT: "XHS_ACCOUNT_RISK_PAGE",
    BROWSER_ENV_ABNORMAL: "BROWSER_ENV_ABNORMAL"
};
const normalizeAccountSafetyReason = (value) => {
    const raw = asString(value);
    if (!raw) {
        return null;
    }
    const normalized = raw.trim().toUpperCase();
    const mapped = ACCOUNT_SAFETY_REASON_ALIASES[normalized];
    return mapped && isAccountSafetyReason(mapped) ? mapped : null;
};
const closeoutRiskReasonToAccountSafetyReason = (reason) => {
    if (reason === null) {
        return null;
    }
    const mapped = ACCOUNT_SAFETY_REASON_ALIASES[reason] ?? reason;
    return isAccountSafetyReason(mapped) ? mapped : null;
};
const pickCanonicalSummaryField = (payload, key) => {
    const summary = asObject(payload.summary);
    const summaryValue = hasOwn(summary ?? undefined, key) ? summary?.[key] : undefined;
    if (payload[key] === null) {
        const summaryObject = asObject(summaryValue);
        if (summaryObject) {
            return summaryObject;
        }
    }
    const value = hasOwn(payload, key)
        ? payload[key]
        : hasOwn(summary ?? undefined, key)
            ? summaryValue
            : undefined;
    if (!hasOwn(payload, key) && !hasOwn(summary ?? undefined, key)) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return asObject(value) ?? undefined;
};
const hasExplicitCloseoutEvidencePayloadMarker = (record) => hasUsableIndependentCloseoutEvidencePayload(record) ||
    hasOwn(record, "closeout_route_evidence");
const hasIndependentCloseoutEvidencePayloadMarker = (record) => (hasOwn(record, "closeout_evidence_input") && record?.closeout_evidence_input !== null) ||
    (hasOwn(record, "closeout_evidence_expected") && record?.closeout_evidence_expected !== null) ||
    (hasOwn(record, "closeout_evidence_rounds") && record?.closeout_evidence_rounds !== null);
const hasUsableIndependentCloseoutEvidencePayload = (record) => {
    const closeoutEvidenceInput = asObject(record?.closeout_evidence_input);
    return ((closeoutEvidenceInput !== null &&
        (asObject(closeoutEvidenceInput.expected) !== null ||
            asObject(closeoutEvidenceInput.evidence) !== null ||
            toCloseoutEvidenceRoundRecords(closeoutEvidenceInput.evidence_rounds) !== null)) ||
        asObject(record?.closeout_evidence_expected) !== null ||
        toCloseoutEvidenceRoundRecords(record?.closeout_evidence_rounds) !== null);
};
const hasExplicitCloseoutProductionAuditMarker = (record) => record?.closeout_audit_required === true ||
    hasOwn(record, "closeout_readiness") ||
    (asString(asObject(record?.closeout_evidence_evaluation)?.evaluator) !== null &&
        !hasIndependentCloseoutEvidencePayloadMarker(record)) ||
    (asObject(record?.closeout_evidence_evaluation) !== null &&
        (asObject(record?.request_admission_result) !== null ||
            asObject(record?.execution_audit) !== null));
const CLOSEOUT_EVIDENCE_SUMMARY_FIELDS = [
    "closeout_evidence_input",
    "closeout_evidence_expected",
    "closeout_evidence_rounds",
    "closeout_route_evidence",
    "route_evidence"
];
const CLOSEOUT_BINDING_FIELD_KEYS = new Set([
    "latest_head_sha",
    "run_id",
    "artifact_identity",
    "artifact_identities",
    "profile_ref",
    "target_tab_id",
    "page_url",
    "action_ref"
]);
const isSparseCloseoutSummaryField = (value) => {
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    const object = asObject(value);
    if (object === null) {
        return false;
    }
    const values = Object.values(object);
    return (values.length === 0 ||
        values.every((item) => item === null ||
            item === undefined ||
            isSparseCloseoutSummaryField(item)));
};
const scoreCloseoutSummaryFieldQuality = (value) => {
    if (value === null || value === undefined) {
        return 0;
    }
    if (Array.isArray(value)) {
        return value.reduce((total, item) => total + scoreCloseoutSummaryFieldQuality(item), 0);
    }
    const object = asObject(value);
    if (object === null) {
        return 1;
    }
    return Object.values(object).reduce((total, item) => total + scoreCloseoutSummaryFieldQuality(item), 0);
};
const isRicherCloseoutSummaryField = (rootValue, summaryValue) => {
    if (summaryValue === null || summaryValue === undefined || isSparseCloseoutSummaryField(summaryValue)) {
        return false;
    }
    if (isSparseCloseoutSummaryField(rootValue)) {
        return true;
    }
    if (Array.isArray(summaryValue)) {
        if (!Array.isArray(rootValue) || summaryValue.length > rootValue.length) {
            return true;
        }
        return (summaryValue.length === rootValue.length &&
            scoreCloseoutSummaryFieldQuality(summaryValue) > scoreCloseoutSummaryFieldQuality(rootValue));
    }
    const rootObject = asObject(rootValue);
    const summaryObject = asObject(summaryValue);
    if (!rootObject || !summaryObject) {
        return false;
    }
    return Object.entries(summaryObject).some(([key, value]) => {
        if (value === null || value === undefined || isSparseCloseoutSummaryField(value)) {
            return false;
        }
        if (!hasOwn(rootObject, key)) {
            return true;
        }
        return isRicherCloseoutSummaryField(rootObject[key], value);
    });
};
const pickCloseoutSummaryFieldValue = (rootValue, summaryValue) => {
    if (summaryValue !== null &&
        summaryValue !== undefined &&
        (rootValue === undefined ||
            rootValue === null ||
            isSparseCloseoutSummaryField(rootValue) ||
            isRicherCloseoutSummaryField(rootValue, summaryValue))) {
        return summaryValue;
    }
    return rootValue;
};
const toCloseoutRoundSemanticKey = (value) => {
    const record = asObject(value);
    if (!record) {
        return `raw:${JSON.stringify(value)}`;
    }
    const artifactIdentity = asString(record.artifact_identity ?? record.artifact_ref);
    if (artifactIdentity !== null) {
        return `artifact:${artifactIdentity}`;
    }
    const roundId = asString(record.round_id ?? record.round_ref);
    if (roundId !== null) {
        return `round:${roundId}`;
    }
    const routeParts = [
        record.route_name,
        record.route_role,
        record.path_kind,
        record.evidence_status,
        record.evidence_class,
        record.head_sha,
        record.run_id,
        record.profile_ref,
        record.target_tab_id,
        record.page_url,
        record.action_ref
    ]
        .map((part) => (typeof part === "number" ? String(part) : asString(part)))
        .filter((part) => part !== null);
    return routeParts.length > 0 ? `route:${routeParts.join("\u0000")}` : `raw:${JSON.stringify(value)}`;
};
const mergeCloseoutEvidenceRoundRecordValues = (rootValue, summaryValue, options = {}) => {
    const rootRounds = Array.isArray(rootValue) && rootValue.length > 0 ? rootValue : [];
    const summaryRounds = Array.isArray(summaryValue) && summaryValue.length > 0 ? summaryValue : [];
    if (rootRounds.length === 0 && summaryRounds.length === 0) {
        return null;
    }
    const rootRoundsForMerge = options.dropSparseRootRounds
        ? rootRounds.filter((round) => !isSparseCloseoutSummaryField(round))
        : rootRounds;
    const byRoundKey = new Map();
    for (const round of [...rootRoundsForMerge, ...summaryRounds]) {
        const key = toCloseoutRoundSemanticKey(round);
        const existing = byRoundKey.get(key);
        if (existing === undefined ||
            scoreCloseoutSummaryFieldQuality(round) > scoreCloseoutSummaryFieldQuality(existing)) {
            byRoundKey.set(key, round);
        }
    }
    return [...byRoundKey.values()];
};
const mergeCloseoutArrayValues = (rootValue, summaryValue) => {
    if (!Array.isArray(rootValue) || !Array.isArray(summaryValue)) {
        return null;
    }
    if (rootValue.length === 0 && summaryValue.length === 0) {
        return null;
    }
    if (rootValue.length === 0) {
        return summaryValue;
    }
    if (summaryValue.length === 0) {
        return rootValue;
    }
    if (isRicherCloseoutSummaryField(rootValue, summaryValue)) {
        return summaryValue;
    }
    const seen = new Set();
    return [...rootValue, ...summaryValue].filter((item) => {
        const key = typeof item === "string" ? item : JSON.stringify(item);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};
const mergeCloseoutSummaryObjectField = (rootValue, summaryValue, options = {}) => {
    const rootObject = asObject(rootValue);
    const summaryObject = asObject(summaryValue);
    if (!rootObject || !summaryObject) {
        return null;
    }
    const merged = {};
    for (const [key, value] of Object.entries(rootObject)) {
        if (value !== null && value !== undefined && !isSparseCloseoutSummaryField(value)) {
            merged[key] = value;
        }
    }
    for (const key of Object.keys(summaryObject)) {
        const rootField = hasOwn(rootObject, key) ? rootObject[key] : undefined;
        const summaryField = summaryObject[key];
        if (options.preferSummaryBindings !== false &&
            CLOSEOUT_BINDING_FIELD_KEYS.has(key) &&
            summaryField !== null &&
            summaryField !== undefined &&
            !isSparseCloseoutSummaryField(summaryField)) {
            merged[key] = summaryField;
            continue;
        }
        if (key === "evidence_rounds") {
            const mergedRounds = mergeCloseoutEvidenceRoundRecordValues(rootField, summaryField, {
                dropSparseRootRounds: true
            });
            if (mergedRounds) {
                merged[key] = mergedRounds;
                continue;
            }
        }
        const mergedArray = mergeCloseoutArrayValues(rootField, summaryField);
        if (mergedArray) {
            merged[key] = mergedArray;
            continue;
        }
        const mergedObject = mergeCloseoutSummaryObjectField(rootField, summaryField, options);
        if (mergedObject) {
            merged[key] = mergedObject;
            continue;
        }
        const picked = pickCloseoutSummaryFieldValue(rootField, summaryField);
        if (picked !== undefined) {
            merged[key] = picked;
        }
    }
    return merged;
};
const mergeCloseoutEvidenceInputSummaryField = (rootValue, summaryValue) => {
    return mergeCloseoutSummaryObjectField(rootValue, summaryValue, {
        preferSummaryBindings: false
    });
};
export const pickXhsCloseoutEvidenceSummaryFieldsForContract = (payload) => {
    const summary = asObject(payload.summary);
    const picked = {};
    for (const key of CLOSEOUT_EVIDENCE_SUMMARY_FIELDS) {
        if (key === "closeout_evidence_input" && hasOwn(payload, key) && hasOwn(summary ?? undefined, key)) {
            const mergedInput = mergeCloseoutEvidenceInputSummaryField(payload[key], summary?.[key]);
            if (mergedInput) {
                picked[key] = mergedInput;
                continue;
            }
        }
        if (key === "closeout_evidence_rounds" && hasOwn(payload, key) && hasOwn(summary ?? undefined, key)) {
            const mergedRounds = mergeCloseoutEvidenceRoundRecordValues(payload[key], summary?.[key], {
                dropSparseRootRounds: true
            });
            if (mergedRounds) {
                picked[key] = mergedRounds;
                continue;
            }
        }
        if ((key === "closeout_evidence_expected" ||
            key === "closeout_route_evidence" ||
            key === "route_evidence") &&
            hasOwn(payload, key) &&
            hasOwn(summary ?? undefined, key)) {
            const mergedObject = mergeCloseoutSummaryObjectField(payload[key], summary?.[key], {
                preferSummaryBindings: false
            });
            if (mergedObject) {
                picked[key] = mergedObject;
                continue;
            }
        }
        if (hasOwn(payload, key) && hasOwn(summary ?? undefined, key)) {
            const mergedObject = mergeCloseoutSummaryObjectField(payload[key], summary?.[key]);
            if (mergedObject) {
                picked[key] = mergedObject;
                continue;
            }
        }
        if (hasOwn(payload, key) &&
            hasOwn(summary ?? undefined, key) &&
            summary?.[key] !== null &&
            summary?.[key] !== undefined &&
            (isSparseCloseoutSummaryField(payload[key]) ||
                isRicherCloseoutSummaryField(payload[key], summary[key]))) {
            picked[key] = summary[key];
            continue;
        }
        if (hasOwn(payload, key) && payload[key] !== null && payload[key] !== undefined) {
            picked[key] = payload[key];
            continue;
        }
        if (hasOwn(payload, key) && payload[key] === null) {
            if (hasOwn(summary ?? undefined, key) && summary?.[key] !== null && summary?.[key] !== undefined) {
                picked[key] = summary[key];
                continue;
            }
            picked[key] = null;
            continue;
        }
        if (hasOwn(summary ?? undefined, key)) {
            picked[key] = summary?.[key];
        }
    }
    return picked;
};
const includeCallerCloseoutEvidenceFieldsForRuntime = (payload, options) => {
    const nextPayload = { ...payload };
    const summary = asObject(payload.summary);
    for (const key of CLOSEOUT_EVIDENCE_SUMMARY_FIELDS) {
        if (key === "closeout_route_evidence" || key === "route_evidence") {
            continue;
        }
        const bridgeAlreadyProvidedField = hasOwn(payload, key) ||
            (hasOwn(summary ?? undefined, key) &&
                summary?.[key] !== null &&
                summary?.[key] !== undefined &&
                !isSparseCloseoutSummaryField(summary?.[key]));
        if (bridgeAlreadyProvidedField &&
            (key === "closeout_evidence_input" ||
                key === "closeout_evidence_expected" ||
                key === "closeout_evidence_rounds")) {
            continue;
        }
        if (hasOwn(options, key) && options[key] !== null && options[key] !== undefined) {
            nextPayload[key] = options[key];
        }
    }
    return nextPayload;
};
export const mergeXhsCloseoutEvidenceSummaryFieldsForRuntimeContract = (payload, options) => pickXhsCloseoutEvidenceSummaryFieldsForContract(includeCallerCloseoutEvidenceFieldsForRuntime(payload, options));
const isCloseoutPrimaryApiSuccessRoute = (record) => {
    const routeRole = asString(record?.route_role);
    const pathKind = asString(record?.path_kind);
    const evidenceStatus = asString(record?.evidence_status);
    return routeRole === "primary" && pathKind === "api" && evidenceStatus === "success";
};
const asStringArray = (value) => Array.isArray(value)
    ? value
        .map((item) => asString(item))
        .filter((item) => item !== null)
    : null;
const normalizeCloseoutProfileRef = (value) => {
    const profileRef = asString(value);
    if (profileRef === null) {
        return null;
    }
    return profileRef.startsWith("profile/") ? profileRef : `profile/${profileRef}`;
};
const toCloseoutEvidenceExpected = (record) => {
    if (!record) {
        return null;
    }
    return {
        latest_head_sha: asString(record.latest_head_sha),
        run_id: asString(record.run_id),
        artifact_identity: asString(record.artifact_identity ?? record.artifact_ref),
        artifact_identities: asStringArray(record.artifact_identities),
        profile_ref: normalizeCloseoutProfileRef(asString(record.profile_ref)),
        target_tab_id: asInteger(record.target_tab_id),
        page_url: asString(record.page_url),
        action_ref: asString(record.action_ref)
    };
};
const toCloseoutEvidenceRound = (record) => {
    if (!record) {
        return null;
    }
    return {
        route_role: asString(record.route_role),
        path_kind: asString(record.path_kind),
        evidence_status: asString(record.evidence_status),
        evidence_class: asString(record.evidence_class ?? record.route_evidence_class),
        reproduced_multi_round: record.reproduced_multi_round === true,
        head_sha: asString(record.head_sha),
        run_id: asString(record.run_id),
        artifact_identity: asString(record.artifact_identity ?? record.artifact_ref),
        profile_ref: normalizeCloseoutProfileRef(asString(record.profile_ref)),
        target_tab_id: asInteger(record.target_tab_id),
        page_url: asString(record.page_url),
        action_ref: asString(record.action_ref)
    };
};
const selectCloseoutEvidenceRound = (expected, roundRecords) => {
    if (!roundRecords) {
        return null;
    }
    let firstCompleteRound = null;
    for (const roundRecord of roundRecords) {
        const round = toCloseoutEvidenceRound(asObject(roundRecord));
        if (!isCompleteCloseoutEvidenceRound(round)) {
            continue;
        }
        firstCompleteRound ??= round;
        if (closeoutEvidenceMatchesExpected(expected, round)) {
            return round;
        }
    }
    return firstCompleteRound;
};
const isCompleteCloseoutEvidenceExpected = (expected) => !!expected &&
    expected.latest_head_sha !== null &&
    expected.run_id !== null &&
    (expected.artifact_identity !== null ||
        (Array.isArray(expected.artifact_identities) && expected.artifact_identities.length > 0)) &&
    expected.profile_ref !== null &&
    expected.target_tab_id !== null &&
    expected.page_url !== null &&
    expected.action_ref !== null;
const isCompleteCloseoutEvidenceRound = (evidence) => !!evidence &&
    evidence.route_role !== null &&
    evidence.path_kind !== null &&
    evidence.evidence_status !== null &&
    evidence.evidence_class !== null &&
    evidence.head_sha !== null &&
    evidence.run_id !== null &&
    evidence.artifact_identity !== null &&
    evidence.profile_ref !== null &&
    evidence.target_tab_id !== null &&
    evidence.page_url !== null &&
    evidence.action_ref !== null;
const closeoutEvidenceMatchesExpected = (expected, evidence) => {
    if (!isCompleteCloseoutEvidenceExpected(expected) || !isCompleteCloseoutEvidenceRound(evidence)) {
        return false;
    }
    const expectedArtifactIdentities = Array.isArray(expected.artifact_identities) && expected.artifact_identities.length > 0
        ? expected.artifact_identities
        : expected.artifact_identity === null
            ? []
            : [expected.artifact_identity];
    const observedArtifactIdentity = asString(evidence.artifact_identity);
    return (expected.latest_head_sha === evidence.head_sha &&
        expected.run_id === evidence.run_id &&
        observedArtifactIdentity !== null &&
        expectedArtifactIdentities.includes(observedArtifactIdentity) &&
        expected.profile_ref === evidence.profile_ref &&
        expected.target_tab_id === evidence.target_tab_id &&
        expected.page_url === evidence.page_url &&
        expected.action_ref === evidence.action_ref);
};
const fillMissingTrustedExpectedBinding = (expected, trusted) => {
    if (!expected) {
        return null;
    }
    return {
        ...expected,
        latest_head_sha: expected.latest_head_sha ?? asString(trusted?.latestHeadSha),
        run_id: expected.run_id ?? asString(trusted?.runId),
        profile_ref: expected.profile_ref ?? normalizeCloseoutProfileRef(trusted?.profileRef),
        target_tab_id: expected.target_tab_id ?? asInteger(trusted?.targetTabId)
    };
};
export const resolveXhsCloseoutRuntimeLatestHeadShaForContract = (cwd) => {
    const envHeadSha = asString(process.env.WEBENVOY_CLOSEOUT_LATEST_HEAD_SHA);
    if (envHeadSha !== null) {
        return envHeadSha;
    }
    const packageEnvHeadSha = asString(process.env.WEBENVOY_RUNTIME_LATEST_HEAD_SHA);
    if (packageEnvHeadSha !== null) {
        return packageEnvHeadSha;
    }
    const cwdGitHead = resolveGitHeadForCwd(cwd);
    const runtimeGitHead = resolveGitHeadForCwd(WEBENVOY_RUNTIME_ROOT);
    if (cwdGitHead &&
        runtimeGitHead &&
        cwdGitHead.root === runtimeGitHead.root &&
        isWebEnvoySourceCheckoutRoot(runtimeGitHead.root)) {
        return cwdGitHead.head;
    }
    if (runtimeGitHead && isWebEnvoySourceCheckoutRoot(runtimeGitHead.root)) {
        return runtimeGitHead.head;
    }
    const runtimeBuildMetadataHead = resolveRuntimeBuildMetadataHeadForCwd(WEBENVOY_RUNTIME_ROOT);
    if (runtimeBuildMetadataHead !== null) {
        return runtimeBuildMetadataHead;
    }
    const runtimePackageHead = resolvePackageGitHeadForCwd(WEBENVOY_RUNTIME_ROOT);
    if (runtimePackageHead !== null) {
        return runtimePackageHead;
    }
    if (cwdGitHead && isWebEnvoyCheckoutRoot(cwdGitHead.root)) {
        return cwdGitHead.head;
    }
    const cwdBuildMetadataHead = resolveRuntimeBuildMetadataHeadForCwd(cwd);
    if (cwdBuildMetadataHead !== null) {
        return cwdBuildMetadataHead;
    }
    const cwdPackageHead = resolvePackageGitHeadForCwd(cwd);
    if (cwdPackageHead !== null) {
        return cwdPackageHead;
    }
    if (runtimeGitHead && isWebEnvoyCheckoutRoot(runtimeGitHead.root)) {
        return runtimeGitHead.head;
    }
    return null;
};
export const buildXhsCloseoutEvidenceTrustedBindingForContract = (input) => {
    const requiresCloseoutEvidenceEvaluation = requiresCloseoutEvidenceEvaluationForRuntime(input.summary);
    const runtimeLatestHeadSha = requiresCloseoutEvidenceEvaluation
        ? resolveXhsCloseoutRuntimeLatestHeadShaForContract(input.cwd)
        : null;
    return {
        ...(requiresCloseoutEvidenceEvaluation ? { requiresLatestHeadSha: true } : {}),
        ...(requiresCloseoutEvidenceEvaluation && runtimeLatestHeadSha !== null
            ? { latestHeadSha: runtimeLatestHeadSha }
            : {}),
        runId: input.runId,
        profileRef: normalizeCloseoutProfileRef(input.profileRef),
        targetTabId: input.targetTabId
    };
};
const toCloseoutEvidenceRoundRecords = (records) => {
    if (!Array.isArray(records)) {
        return null;
    }
    return records;
};
const hasCloseoutEvidenceRoundRecords = (records) => Array.isArray(records) && records.length > 0;
const unionCloseoutEvidenceRoundRecords = (...recordGroups) => {
    return mergeCloseoutEvidenceRoundRecordValues(recordGroups[0] ?? [], recordGroups.slice(1).flatMap((recordGroup) => recordGroup ?? []));
};
const buildCloseoutEvidenceInputForRuntime = (summary, trustedExpectedBinding) => {
    const explicitInput = asObject(summary.closeout_evidence_input);
    const routeEvidence = asObject(summary.closeout_route_evidence) ?? asObject(summary.route_evidence);
    const routeEvidenceRequiresCloseout = isCloseoutPrimaryApiSuccessRoute(routeEvidence);
    const explicitRoundRecords = toCloseoutEvidenceRoundRecords(explicitInput?.evidence_rounds);
    const summaryRoundRecords = toCloseoutEvidenceRoundRecords(summary.closeout_evidence_rounds);
    const hasDeterministicRoundSource = hasCloseoutEvidenceRoundRecords(explicitRoundRecords) ||
        hasCloseoutEvidenceRoundRecords(summaryRoundRecords);
    const deterministicRoundRecords = unionCloseoutEvidenceRoundRecords(explicitRoundRecords, summaryRoundRecords);
    const routeEvidenceRound = toCloseoutEvidenceRound(routeEvidence);
    const routeRoundRecords = hasDeterministicRoundSource
        ? null
        : unionCloseoutEvidenceRoundRecords(routeEvidenceRound ? [routeEvidenceRound] : null, toCloseoutEvidenceRoundRecords(routeEvidence?.evidence_rounds));
    const roundRecords = deterministicRoundRecords ?? routeRoundRecords;
    const trustedExpectedBindingInput = {
        ...(trustedExpectedBinding ?? {})
    };
    const explicitExpectedCandidate = toCloseoutEvidenceExpected(asObject(explicitInput?.expected));
    const summaryExpectedCandidate = toCloseoutEvidenceExpected(asObject(summary.closeout_evidence_expected));
    const explicitExpectedCandidateWithTrustedRun = fillMissingTrustedExpectedBinding(explicitExpectedCandidate, trustedExpectedBindingInput);
    const summaryExpectedCandidateWithTrustedRun = fillMissingTrustedExpectedBinding(summaryExpectedCandidate, trustedExpectedBindingInput);
    const explicitExpected = isCompleteCloseoutEvidenceExpected(explicitExpectedCandidateWithTrustedRun)
        ? explicitExpectedCandidateWithTrustedRun
        : null;
    const summaryExpected = isCompleteCloseoutEvidenceExpected(summaryExpectedCandidateWithTrustedRun)
        ? summaryExpectedCandidateWithTrustedRun
        : null;
    const expected = explicitExpected ?? summaryExpected;
    const explicitExpectedBinding = explicitExpected !== null || summaryExpected !== null;
    const effectiveExpected = expected !== null &&
        hasDeterministicRoundSource &&
        (!Array.isArray(expected.artifact_identities) || expected.artifact_identities.length === 0) &&
        expected.artifact_identity !== null
        ? {
            ...expected,
            artifact_identities: [expected.artifact_identity]
        }
        : expected;
    const routeEvidenceCanProvideRound = routeEvidenceRequiresCloseout &&
        roundRecords !== null &&
        isCompleteCloseoutEvidenceExpected(effectiveExpected) &&
        closeoutEvidenceMatchesExpected(effectiveExpected, routeEvidenceRound);
    const selectedEvidenceRound = selectCloseoutEvidenceRound(effectiveExpected, roundRecords);
    const firstParsedEvidenceRound = roundRecords
        ? toCloseoutEvidenceRound(asObject(roundRecords[0]) ?? {})
        : null;
    const firstEvidenceRoundCanProvideRound = roundRecords !== null &&
        isCompleteCloseoutEvidenceExpected(effectiveExpected) &&
        isCompleteCloseoutEvidenceRound(selectedEvidenceRound);
    const deterministicRoundsCanProvideEvidence = firstEvidenceRoundCanProvideRound && (roundRecords?.length ?? 0) >= 2;
    const canonicalEvidenceRoundCanProvideRound = firstEvidenceRoundCanProvideRound &&
        effectiveExpected !== null &&
        selectedEvidenceRound !== null &&
        effectiveExpected.artifact_identity !== null &&
        selectedEvidenceRound.artifact_identity === effectiveExpected.artifact_identity;
    const explicitEvidenceCandidate = toCloseoutEvidenceRound(asObject(explicitInput?.evidence));
    const explicitEvidence = isCompleteCloseoutEvidenceRound(explicitEvidenceCandidate)
        ? explicitEvidenceCandidate
        : null;
    const evidence = explicitEvidence ??
        (deterministicRoundsCanProvideEvidence && canonicalEvidenceRoundCanProvideRound
            ? selectedEvidenceRound
            : null) ??
        (expected?.artifact_identity === null && deterministicRoundsCanProvideEvidence
            ? selectedEvidenceRound
            : null) ??
        (routeEvidenceCanProvideRound ? routeEvidenceRound : null) ??
        (explicitExpectedBinding && deterministicRoundsCanProvideEvidence ? selectedEvidenceRound : null) ??
        (firstEvidenceRoundCanProvideRound ? selectedEvidenceRound : null) ??
        explicitEvidence ??
        (roundRecords !== null ? firstParsedEvidenceRound : null);
    if (!effectiveExpected || !evidence) {
        return null;
    }
    const evidenceRounds = roundRecords
        ? []
        : null;
    if (roundRecords && evidenceRounds) {
        for (const roundRecord of roundRecords) {
            const round = toCloseoutEvidenceRound(asObject(roundRecord) ?? {});
            if (!round) {
                return null;
            }
            evidenceRounds.push(round);
        }
    }
    return {
        expected: effectiveExpected,
        evidence,
        ...(evidenceRounds ? { evidence_rounds: evidenceRounds } : {})
    };
};
const requiresCloseoutEvidenceEvaluationForRuntime = (summary) => {
    if (hasUsableIndependentCloseoutEvidencePayload(summary)) {
        return true;
    }
    const routeEvidence = asObject(summary.closeout_route_evidence) ?? asObject(summary.route_evidence);
    return (hasExplicitCloseoutProductionAuditMarker(summary) &&
        isCloseoutPrimaryApiSuccessRoute(routeEvidence));
};
const isLegacyCloseoutEvidenceEvaluationCompatOnly = (summary, evaluation) => !hasIndependentCloseoutEvidencePayloadMarker(summary) &&
    evaluation.blockers.length === 1 &&
    evaluation.blockers.some((blockerItem) => blockerItem.blocker_code === "missing_multi_round_evidence");
const missingCloseoutEvidenceEvaluation = () => ({
    decision: "FAIL",
    passed: false,
    blockers: [
        {
            blocker_code: "missing_multi_round_evidence",
            blocker_layer: "route",
            message: "closeout evidence input is missing or cannot be parsed"
        }
    ],
    evaluated_route: "unknown_route:unknown_path:unknown_class:unknown_status",
    route_role: null,
    path_kind: null,
    evidence_status: null,
    evidence_class: null,
    reproduced_multi_round: false,
    freshness: {
        latest_head_available: false,
        latest_head_matches: false,
        run_matches: false,
        artifact_matches: false,
        expected_latest_head_sha: null,
        observed_head_sha: null,
        expected_run_id: null,
        observed_run_id: null,
        expected_artifact_identity: null,
        expected_artifact_identities: [],
        accepted_artifact_identities: [],
        observed_artifact_identity: null
    },
    bindings: {
        profile_bound: false,
        tab_bound: false,
        page_bound: false,
        action_bound: false,
        expected_profile_ref: null,
        observed_profile_ref: null,
        expected_target_tab_id: null,
        observed_target_tab_id: null,
        expected_page_url: null,
        observed_page_url: null,
        expected_action_ref: null,
        observed_action_ref: null
    },
    multi_round: {
        accepted_round_count: 0,
        unique_artifact_count: 0,
        expected_artifact_observed: false
    }
});
export const evaluateXhsCloseoutEvidenceForContract = (summary, options) => {
    const input = buildCloseoutEvidenceInputForRuntime(summary, options);
    if (input) {
        return applyTrustedExpectedBindingCheck(evaluateCloseoutEvidence(input), options);
    }
    return requiresCloseoutEvidenceEvaluationForRuntime(summary)
        ? missingCloseoutEvidenceEvaluation()
        : null;
};
const applyTrustedExpectedBindingCheck = (evaluation, trusted) => {
    const blockers = [...evaluation.blockers];
    const trustedLatestHeadSha = asString(trusted?.latestHeadSha);
    const requiresTrustedLatestHeadSha = trusted?.requiresLatestHeadSha === true;
    const trustedRunId = asString(trusted?.runId);
    const trustedProfileRef = normalizeCloseoutProfileRef(trusted?.profileRef);
    const trustedTargetTabId = asInteger(trusted?.targetTabId);
    let freshness = evaluation.freshness;
    let bindings = evaluation.bindings;
    if (requiresTrustedLatestHeadSha && trustedLatestHeadSha === null) {
        freshness = {
            ...freshness,
            latest_head_available: false,
            latest_head_matches: false
        };
        pushUniqueCloseoutEvaluationBlocker(blockers, closeoutEvaluationBlocker("missing_latest_head", "freshness", "closeout runtime head must be resolved before evaluating production evidence"));
    }
    else if (trustedLatestHeadSha !== null &&
        evaluation.freshness.expected_latest_head_sha !== trustedLatestHeadSha) {
        freshness = {
            ...freshness,
            latest_head_matches: false
        };
        pushUniqueCloseoutEvaluationBlocker(blockers, closeoutEvaluationBlocker("stale_head", "freshness", "closeout expected head must match the runtime head"));
    }
    if (trustedRunId !== null && evaluation.freshness.expected_run_id !== trustedRunId) {
        freshness = {
            ...freshness,
            run_matches: false
        };
        pushUniqueCloseoutEvaluationBlocker(blockers, closeoutEvaluationBlocker("stale_run", "freshness", "closeout expected run must match the runtime run"));
    }
    if (trustedProfileRef !== null && evaluation.bindings.expected_profile_ref !== trustedProfileRef) {
        bindings = {
            ...bindings,
            profile_bound: false
        };
        pushUniqueCloseoutEvaluationBlocker(blockers, closeoutEvaluationBlocker("missing_profile_binding", "binding", "closeout expected profile must match the runtime profile"));
    }
    if (trustedTargetTabId !== null &&
        evaluation.bindings.expected_target_tab_id !== trustedTargetTabId) {
        bindings = {
            ...bindings,
            tab_bound: false
        };
        pushUniqueCloseoutEvaluationBlocker(blockers, closeoutEvaluationBlocker("missing_tab_binding", "binding", "closeout expected tab must match the runtime target tab"));
    }
    if (blockers.length === evaluation.blockers.length) {
        return evaluation;
    }
    return {
        ...evaluation,
        decision: "FAIL",
        passed: false,
        blockers,
        freshness,
        bindings
    };
};
const closeoutEvaluationBlocker = (blocker_code, blocker_layer, message) => ({
    blocker_code,
    blocker_layer,
    message
});
const pushUniqueCloseoutEvaluationBlocker = (blockers, nextBlocker) => {
    if (blockers.some((existingBlocker) => existingBlocker.blocker_code === nextBlocker.blocker_code)) {
        return;
    }
    blockers.push(nextBlocker);
};
const assertCloseoutEvidenceForRuntime = (ability, trustedExpectedBinding, summary) => {
    const evaluation = evaluateXhsCloseoutEvidenceForContract(summary, trustedExpectedBinding);
    if (!evaluation) {
        return;
    }
    summary.closeout_evidence_evaluation = evaluation;
    if (evaluation.passed) {
        return;
    }
    if (isLegacyCloseoutEvidenceEvaluationCompatOnly(summary, evaluation)) {
        summary.closeout_evidence_compat_mode = "legacy_route_evidence_non_blocking";
        return;
    }
    throw new CliError("ERR_EXECUTION_FAILED", "XHS closeout evidence evaluation invalid", {
        retryable: false,
        details: {
            ability_id: ability.id,
            stage: "execution",
            reason: "CLOSEOUT_EVIDENCE_EVALUATION_INVALID",
            run_id: trustedExpectedBinding.runId,
            closeout_evidence_evaluation: evaluation,
            ...(asObject(summary.execution_audit) ? { execution_audit: summary.execution_audit } : {})
        }
    });
};
const isXhsLiveRouteEvidenceForCloseoutAudit = (record) => isCloseoutPrimaryApiSuccessRoute(record) ||
    asString(record?.route_evidence_class) === "passive_api_capture" ||
    asString(record?.evidence_class) === "passive_api_capture";
const hasCloseoutRouteEvaluationMarker = (record) => {
    if (asString(asObject(record?.closeout_evidence_evaluation)?.evaluator) !== null &&
        !hasIndependentCloseoutEvidencePayloadMarker(record)) {
        return true;
    }
    if (isCloseoutPrimaryApiSuccessRoute(record) &&
        (hasOwn(record, "closeout_evidence") || hasOwn(record, "closeout_evidence_evaluation"))) {
        return true;
    }
    const routeEvidenceEvaluation = asObject(record?.route_evidence_evaluation);
    if (isCloseoutPrimaryApiSuccessRoute(routeEvidenceEvaluation)) {
        return true;
    }
    const routeEvidence = asObject(record?.closeout_route_evidence) ?? asObject(record?.route_evidence);
    return (hasExplicitCloseoutProductionAuditMarker(record) &&
        isCloseoutPrimaryApiSuccessRoute(routeEvidence));
};
export const requiresCanonicalExecutionAuditForContract = (input) => {
    const payload = asObject(input.payload);
    const summary = asObject(input.summary) ?? asObject(payload?.summary);
    const details = asObject(input.details);
    return [payload, summary, details].some((record) => hasExplicitCloseoutProductionAuditMarker(record) || hasCloseoutRouteEvaluationMarker(record));
};
export const shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract = (input) => {
    const summary = asObject(input.summary);
    const closeoutRouteEvidence = asObject(summary?.closeout_route_evidence);
    const legacyRouteEvidence = asObject(summary?.route_evidence);
    return (XHS_CLOSEOUT_ROUTE_EVIDENCE_ABILITY_IDS.has(input.abilityId) &&
        isLiveXhsReadExecutionMode(input.requestedExecutionMode) &&
        (isXhsLiveRouteEvidenceForCloseoutAudit(closeoutRouteEvidence) ||
            isXhsLiveRouteEvidenceForCloseoutAudit(legacyRouteEvidence)));
};
export const requiresCloseoutAuditForXhsBridgeSummaryForContract = (input) => {
    const summary = asObject(input.summary);
    return (hasExplicitCloseoutProductionAuditMarker(summary) ||
        shouldRequireCloseoutAuditForXhsLiveRouteEvidenceForContract({
            abilityId: input.abilityId,
            requestedExecutionMode: input.requestedExecutionMode,
            summary
        }));
};
const markCloseoutAuditRequiredForXhsLiveRouteEvidence = (input) => {
    const closeoutEvidenceSummaryFields = pickXhsCloseoutEvidenceSummaryFieldsForContract(input.payload);
    const summary = asObject(input.payload.summary);
    const mergedSummary = {
        ...(summary ?? {}),
        ...closeoutEvidenceSummaryFields
    };
    if (!requiresCloseoutAuditForXhsBridgeSummaryForContract({
        abilityId: input.abilityId,
        requestedExecutionMode: input.requestedExecutionMode,
        summary: mergedSummary
    })) {
        return;
    }
    if (summary) {
        Object.assign(summary, closeoutEvidenceSummaryFields);
        summary.closeout_audit_required = true;
        return;
    }
    input.payload.summary = {
        ...closeoutEvidenceSummaryFields,
        closeout_audit_required: true
    };
};
const markCloseoutAuditRequired = (payload) => {
    const summary = asObject(payload.summary);
    if (summary) {
        summary.closeout_audit_required = true;
        return;
    }
    payload.summary = {
        closeout_audit_required: true
    };
};
const markCloseoutAuditRequiredWhenCanonicalAuditExists = (payload) => {
    if (!asObject(payload.execution_audit) && !asObject(asObject(payload.summary)?.execution_audit)) {
        return;
    }
    markCloseoutAuditRequired(payload);
};
const copyCloseoutCanonicalAuditIntoFailureDetails = (payload, details) => {
    if (asObject(details.execution_audit)) {
        return;
    }
    const canonicalAudit = asObject(payload.execution_audit) ?? asObject(asObject(payload.summary)?.execution_audit);
    if (canonicalAudit) {
        details.execution_audit = canonicalAudit;
    }
};
const hasFailureCanonicalAuditSurface = (payload, details) => asObject(payload.request_admission_result) !== null ||
    asObject(asObject(payload.summary)?.request_admission_result) !== null ||
    asObject(details.request_admission_result) !== null ||
    asObject(payload.execution_audit) !== null ||
    asObject(asObject(payload.summary)?.execution_audit) !== null ||
    asObject(details.execution_audit) !== null ||
    payload.closeout_audit_required === true ||
    details.closeout_audit_required === true ||
    asObject(payload.summary)?.closeout_audit_required === true;
const assertCloseoutCanonicalExecutionAuditForRuntime = (ability, expectedRunId, input) => {
    const result = "success" in input
        ? verifyCloseoutCanonicalExecutionAudit({
            expectedRunId,
            success: {
                summary: input.success.summary,
                observability: input.success.observability
            }
        })
        : verifyCloseoutCanonicalExecutionAudit({
            expectedRunId,
            failure: {
                error: {
                    details: input.failure.details ?? null
                },
                payload: input.failure.payload,
                observability: input.failure.observability
            }
        });
    if (result.passed) {
        return;
    }
    throw new CliError("ERR_EXECUTION_FAILED", "XHS closeout canonical execution audit invalid", {
        retryable: false,
        details: {
            ability_id: ability.id,
            stage: "execution",
            reason: "CLOSEOUT_CANONICAL_EXECUTION_AUDIT_INVALID",
            closeout_canonical_execution_audit: result,
            ...("success" in input && asObject(input.success.summary)?.closeout_evidence_evaluation
                ? {
                    closeout_evidence_evaluation: asObject(input.success.summary)
                        ?.closeout_evidence_evaluation
                }
                : {}),
            ...("success" in input && asObject(input.success.summary)?.closeout_evidence_compat_mode
                ? {
                    closeout_evidence_compat_mode: asObject(input.success.summary)
                        ?.closeout_evidence_compat_mode
                }
                : {})
        }
    });
};
const isTransportFailureCode = (code) => code === "ERR_TRANSPORT_HANDSHAKE_FAILED" ||
    code === "ERR_TRANSPORT_TIMEOUT" ||
    code === "ERR_TRANSPORT_DISCONNECTED" ||
    code === "ERR_TRANSPORT_FORWARD_FAILED" ||
    code === "ERR_TRANSPORT_NOT_READY";
const resolveRuntimeBridge = () => {
    if (process.env.WEBENVOY_NATIVE_TRANSPORT === "loopback") {
        return new NativeMessagingBridge({
            transport: createLoopbackNativeBridgeTransport()
        });
    }
    return new NativeMessagingBridge({
        transport: new NativeHostBridgeTransport()
    });
};
const asObservabilityInput = (value) => {
    const object = asObject(value);
    return object ?? undefined;
};
const asDiagnosisInput = (value) => {
    const object = asObject(value);
    return object ?? undefined;
};
const pickGateErrorDetails = (payload, details) => {
    const detailKeys = [
        "validation_action",
        "target_page",
        "editor_locator",
        "input_text",
        "before_text",
        "visible_text",
        "post_blur_text",
        "focus_confirmed",
        "preserved_after_blur",
        "success_signals",
        "failure_signals",
        "minimum_replay",
        "out_of_scope_actions",
        "execution_failure",
        "humanized_action",
        "scope_context",
        "gate_input",
        "gate_outcome",
        "read_execution_policy",
        "issue_action_matrix",
        "write_interaction_tier",
        "write_action_matrix_decisions",
        "consumer_gate_result",
        "closeout_audit_required",
        "closeout_evidence_evaluation",
        "closeout_evidence_compat_mode",
        "closeout_readiness",
        "closeout_route_evidence",
        "route_evidence_evaluation",
        "request_admission_result",
        "execution_audit",
        "approval_record",
        "audit_record",
        "risk_state_output",
        "account_safety",
        "xhs_closeout_rhythm",
        "anti_detection_validation_view",
        "runtime_stop",
        "command_alias_diagnostics",
        "status_code",
        "platform_code"
    ];
    const picked = {};
    const hasOwn = (record, key) => !!record && Object.prototype.hasOwnProperty.call(record, key);
    for (const key of detailKeys) {
        if ((key === "execution_audit" || key === "request_admission_result") && payload[key] === null) {
            const detailsObject = asObject(details?.[key]);
            if (detailsObject) {
                picked[key] = detailsObject;
                continue;
            }
        }
        const value = hasOwn(payload, key)
            ? payload[key]
            : hasOwn(details ?? undefined, key)
                ? details?.[key]
                : undefined;
        if (!hasOwn(payload, key) && !hasOwn(details ?? undefined, key)) {
            continue;
        }
        if (value === null) {
            picked[key] = null;
            continue;
        }
        const object = asObject(value);
        if (object) {
            picked[key] = object;
            continue;
        }
        if (Array.isArray(value)) {
            picked[key] = value;
            continue;
        }
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            picked[key] = value;
        }
    }
    return picked;
};
const pickCloseoutHardStopResponseBody = (payload, details) => asObject(details?.response_body) ??
    asObject(details?.response) ??
    asObject(payload.response_body) ??
    asObject(payload.response);
const pickCloseoutHardStopPageSurface = (input) => {
    const pageState = asObject(input.observability?.page_state);
    const pageSurface = asObject(input.details?.page_surface) ??
        asObject(input.payload.page_surface) ??
        asObject(input.observability?.page_surface);
    const overlay = asObject(pageSurface?.overlay) ??
        asObject(input.details?.account_safety_overlay) ??
        asObject(input.payload.account_safety_overlay) ??
        asObject(input.observability?.account_safety_overlay);
    return {
        url: input.details?.page_url ??
            pageSurface?.url ??
            pageSurface?.href ??
            pageState?.url,
        title: pageSurface?.title ?? pageState?.title,
        bodyText: pageSurface?.body_text ?? pageSurface?.bodyText,
        overlay: overlay
            ? {
                selector: overlay.selector,
                text: overlay.text
            }
            : null
    };
};
const pickCloseoutHardStopFailureSignals = (payload, details, observability, diagnosis) => {
    const signals = [];
    const pushStructuredSignals = (record) => {
        if (!record) {
            return;
        }
        if (Array.isArray(record.failure_signals)) {
            signals.push(...record.failure_signals);
        }
    };
    pushStructuredSignals(asObject(payload));
    pushStructuredSignals(details);
    if (Array.isArray(observability?.key_requests)) {
        for (const item of observability.key_requests) {
            const request = asObject(item);
            if (!request) {
                continue;
            }
            const normalizedReason = normalizeAccountSafetyReason(request.failure_reason);
            signals.push(normalizedReason ?? request.failure_reason);
        }
    }
    const failureSite = asObject(observability?.failure_site);
    if (failureSite) {
        const normalizedSummary = normalizeAccountSafetyReason(failureSite.summary);
        signals.push(normalizedSummary ?? failureSite.summary);
    }
    const diagnosisFailureSite = asObject(diagnosis?.failure_site);
    if (diagnosisFailureSite) {
        const normalizedSummary = normalizeAccountSafetyReason(diagnosisFailureSite.summary);
        signals.push(normalizedSummary ?? diagnosisFailureSite.summary);
    }
    if (Array.isArray(diagnosis?.evidence)) {
        for (const item of diagnosis.evidence) {
            const normalizedEvidence = normalizeAccountSafetyReason(item);
            signals.push(normalizedEvidence ?? item);
        }
    }
    return signals.filter((item) => asString(item) !== null);
};
const pickCloseoutHardStopApiResponses = (observability) => {
    if (!Array.isArray(observability?.key_requests)) {
        return [];
    }
    return observability.key_requests.flatMap((item) => {
        const request = asObject(item);
        if (!request) {
            return [];
        }
        return [
            {
                statusCode: request.status_code,
                platformCode: request.platform_code,
                responseBody: request.response_body ?? request.response ?? request.body,
                fallbackMessage: request.failure_reason
            }
        ];
    });
};
const classifyCloseoutHardStopRiskForPayload = (payload) => {
    const details = asObject(payload.details);
    const observability = asObject(payload.observability);
    const diagnosis = asObject(payload.diagnosis);
    const accountSafety = asObject(details?.account_safety) ?? asObject(payload.account_safety);
    const currentRunId = asString(asObject(payload.gate_input)?.run_id) ??
        asString(asObject(details?.gate_input)?.run_id) ??
        asString(asObject(payload.audit_record)?.run_id);
    const accountSafetySourceRunId = asString(accountSafety?.source_run_id) ?? asString(accountSafety?.sourceRunId);
    return classifyCloseoutHardStopRisk({
        reason: details?.reason,
        statusCode: details?.status_code,
        platformCode: details?.platform_code,
        responseBody: pickCloseoutHardStopResponseBody(payload, details),
        apiResponses: pickCloseoutHardStopApiResponses(observability),
        accountSafety,
        accountSafetyFresh: accountSafetySourceRunId !== null &&
            currentRunId !== null &&
            accountSafetySourceRunId === currentRunId,
        observabilitySignals: pickCloseoutHardStopFailureSignals(payload, details, observability, diagnosis),
        pageSurface: pickCloseoutHardStopPageSurface({
            payload,
            details,
            observability
        })
    });
};
const buildCloseoutHardStopFailureSite = (closeoutHardStopRisk, existing) => ({
    ...(existing ?? {}),
    stage: asString(existing?.stage) ?? "execution",
    component: asString(existing?.component) ??
        (closeoutHardStopRisk.source === "api_response"
            ? "network"
            : closeoutHardStopRisk.source === "page_surface"
                ? "page"
                : "runtime"),
    target: asString(existing?.target) ??
        closeoutHardStopRisk.evidence.page_url ??
        closeoutHardStopRisk.evidence.message ??
        "xhs.closeout_hard_stop_risk",
    summary: closeoutHardStopRisk.reason ?? "XHS_HARD_STOP_RISK"
});
const augmentCloseoutHardStopObservability = (value, closeoutHardStopRisk) => {
    const observability = asObject(value);
    if (!closeoutHardStopRisk.hard_stop) {
        return asObservabilityInput(value);
    }
    return {
        ...(observability ?? {}),
        failure_site: buildCloseoutHardStopFailureSite(closeoutHardStopRisk, asObject(observability?.failure_site))
    };
};
const augmentCloseoutHardStopDiagnosis = (value, closeoutHardStopRisk) => {
    const diagnosis = asObject(value);
    if (!closeoutHardStopRisk.hard_stop) {
        return asDiagnosisInput(value);
    }
    const evidence = Array.isArray(diagnosis?.evidence)
        ? diagnosis.evidence.filter((item) => typeof item === "string")
        : [];
    return {
        ...(diagnosis ?? {}),
        category: "request_failed",
        stage: asString(diagnosis?.stage) ?? "execution",
        component: asString(diagnosis?.component) ?? "runtime",
        failure_site: buildCloseoutHardStopFailureSite(closeoutHardStopRisk, asObject(diagnosis?.failure_site)),
        evidence: [
            closeoutHardStopRisk.reason ?? "XHS_HARD_STOP_RISK",
            closeoutHardStopRisk.risk_class ?? "hard_stop",
            ...evidence
        ].filter((item, index, list) => list.indexOf(item) === index)
    };
};
const toCliExecutionError = (ability, payload, fallbackMessage, expectedRunId, closeoutRuntimeBinding) => {
    const details = asObject(payload.details);
    const pickedDetails = pickGateErrorDetails(payload, details);
    let closeoutEvidenceEvaluationForDetails;
    let closeoutEvidenceCompatModeForDetails;
    if (closeoutRuntimeBinding) {
        const closeoutEvidenceSummaryFields = pickXhsCloseoutEvidenceSummaryFieldsForContract(payload);
        const requestAdmissionResult = pickCanonicalSummaryField(payload, "request_admission_result");
        const executionAudit = pickCanonicalSummaryField(payload, "execution_audit");
        const mergedSummary = {
            ...(asObject(payload.summary) ?? {}),
            ...closeoutEvidenceSummaryFields
        };
        if (requiresCloseoutEvidenceEvaluationForRuntime(mergedSummary)) {
            const summary = mapCapabilitySummaryForContract(ability.id, {
                ...mergedSummary,
                ...(asObject(payload.consumer_gate_result)
                    ? { consumer_gate_result: asObject(payload.consumer_gate_result) }
                    : {}),
                ...(requestAdmissionResult !== undefined
                    ? { request_admission_result: requestAdmissionResult }
                    : {}),
                ...(executionAudit !== undefined ? { execution_audit: executionAudit } : {})
            });
            assertCloseoutEvidenceForRuntime(ability, buildXhsCloseoutEvidenceTrustedBindingForContract({
                cwd: closeoutRuntimeBinding.cwd,
                runId: expectedRunId,
                profileRef: closeoutRuntimeBinding.profileRef,
                targetTabId: closeoutRuntimeBinding.targetTabId,
                summary
            }), summary);
            if (asObject(summary.closeout_evidence_evaluation)) {
                closeoutEvidenceEvaluationForDetails = summary.closeout_evidence_evaluation;
            }
            if (asString(summary.closeout_evidence_compat_mode)) {
                closeoutEvidenceCompatModeForDetails = summary.closeout_evidence_compat_mode;
            }
        }
    }
    const requiresFailureCanonicalAudit = requiresCanonicalExecutionAuditForContract({ payload, details: pickedDetails }) ||
        (asObject(closeoutEvidenceEvaluationForDetails) !== null &&
            hasFailureCanonicalAuditSurface(payload, pickedDetails));
    if (requiresFailureCanonicalAudit) {
        if (asObject(closeoutEvidenceEvaluationForDetails)) {
            pickedDetails.closeout_evidence_evaluation = closeoutEvidenceEvaluationForDetails;
        }
        if (asString(closeoutEvidenceCompatModeForDetails)) {
            pickedDetails.closeout_evidence_compat_mode = closeoutEvidenceCompatModeForDetails;
        }
        copyCloseoutCanonicalAuditIntoFailureDetails(payload, pickedDetails);
        assertCloseoutCanonicalExecutionAuditForRuntime(ability, expectedRunId, {
            failure: {
                payload,
                details: pickedDetails,
                observability: payload.observability
            }
        });
    }
    if (asObject(closeoutEvidenceEvaluationForDetails)) {
        pickedDetails.closeout_evidence_evaluation = closeoutEvidenceEvaluationForDetails;
    }
    if (asString(closeoutEvidenceCompatModeForDetails)) {
        pickedDetails.closeout_evidence_compat_mode = closeoutEvidenceCompatModeForDetails;
    }
    const closeoutHardStopRisk = classifyCloseoutHardStopRiskForPayload(payload);
    const reason = typeof details?.reason === "string" && details.reason.trim().length > 0
        ? details.reason.trim()
        : "TARGET_API_RESPONSE_INVALID";
    const consumerGateResult = asObject(payload.consumer_gate_result);
    return new CliError("ERR_EXECUTION_FAILED", fallbackMessage, {
        retryable: payload.retryable === true,
        details: {
            ability_id: ability.id,
            stage: details?.stage === "input_validation" ||
                details?.stage === "output_mapping" ||
                details?.stage === "execution"
                ? details.stage
                : "execution",
            reason,
            ...(closeoutHardStopRisk.hard_stop
                ? { closeout_hard_stop_risk: closeoutHardStopRisk }
                : {}),
            ...(consumerGateResult ?? {}),
            ...pickedDetails
        },
        observability: augmentCloseoutHardStopObservability(payload.observability, closeoutHardStopRisk),
        diagnosis: augmentCloseoutHardStopDiagnosis(payload.diagnosis, closeoutHardStopRisk)
    });
};
const toTransportCliError = (error, ability) => new CliError("ERR_RUNTIME_UNAVAILABLE", `通信链路不可用: ${error.code}`, {
    retryable: error.retryable,
    cause: error,
    details: {
        ability_id: ability.id,
        stage: "execution",
        reason: error.code
    }
});
const firstRecord = (value) => {
    if (!Array.isArray(value)) {
        return null;
    }
    for (const item of value) {
        const record = asObject(item);
        if (record) {
            return record;
        }
    }
    return null;
};
const resolveNestedObject = (record, key) => asObject(record?.[key]);
const resolveAccountSafetySignal = (payload, fallback) => {
    const details = asObject(payload.details);
    const observability = asObject(payload.observability);
    const pageState = resolveNestedObject(observability, "page_state");
    const keyRequest = firstRecord(observability?.key_requests);
    const gateInput = asObject(payload.gate_input) ?? asObject(details?.gate_input);
    const consumerGateResult = asObject(payload.consumer_gate_result);
    const auditRecord = asObject(payload.audit_record);
    const diagnosis = asObject(payload.diagnosis);
    const diagnosisEvidence = Array.isArray(diagnosis?.evidence) ? diagnosis?.evidence : [];
    const closeoutHardStopRisk = classifyCloseoutHardStopRiskForPayload(payload);
    const reason = normalizeAccountSafetyReason(details?.reason) ??
        closeoutRiskReasonToAccountSafetyReason(closeoutHardStopRisk.reason) ??
        normalizeAccountSafetyReason(keyRequest?.failure_reason) ??
        normalizeAccountSafetyReason(diagnosisEvidence.find((item) => normalizeAccountSafetyReason(item))) ??
        (() => {
            const statusCode = asInteger(details?.status_code) ?? asInteger(keyRequest?.status_code);
            const platformCode = asInteger(details?.platform_code);
            if (statusCode === 401) {
                return "SESSION_EXPIRED";
            }
            if (statusCode === 429) {
                return "CAPTCHA_REQUIRED";
            }
            if (statusCode === 461 || platformCode === 300011) {
                return "ACCOUNT_ABNORMAL";
            }
            if (platformCode === 300015) {
                return "BROWSER_ENV_ABNORMAL";
            }
            return null;
        })();
    if (!reason) {
        return null;
    }
    const targetTabId = asInteger(details?.target_tab_id) ??
        asInteger(consumerGateResult?.target_tab_id) ??
        asInteger(gateInput?.target_tab_id) ??
        asInteger(auditRecord?.target_tab_id) ??
        fallback.targetTabId;
    return {
        reason,
        sourceCommand: fallback.command,
        targetDomain: asString(details?.target_domain) ??
            asString(consumerGateResult?.target_domain) ??
            asString(gateInput?.target_domain) ??
            asString(auditRecord?.target_domain) ??
            fallback.targetDomain,
        targetTabId,
        pageUrl: asString(details?.page_url) ??
            closeoutHardStopRisk.evidence.page_url ??
            asString(pageState?.url) ??
            fallback.targetPage,
        statusCode: asInteger(details?.status_code) ??
            closeoutHardStopRisk.evidence.status_code ??
            asInteger(keyRequest?.status_code),
        platformCode: asInteger(details?.platform_code) ?? closeoutHardStopRisk.evidence.platform_code
    };
};
const mergeAccountSafetyIntoFailurePayload = (payload, accountSafety, xhsCloseoutRhythm, runtimeStop) => {
    const details = asObject(payload.details) ?? {};
    const accountSafetyReason = asString(accountSafety.reason);
    payload.details = {
        ...details,
        ...(!asString(details.reason) && accountSafetyReason ? { reason: accountSafetyReason } : {}),
        account_safety: accountSafety,
        ...(xhsCloseoutRhythm ? { xhs_closeout_rhythm: xhsCloseoutRhythm } : {}),
        ...(runtimeStop ? { runtime_stop: runtimeStop } : {})
    };
    payload.account_safety = accountSafety;
    if (xhsCloseoutRhythm) {
        payload.xhs_closeout_rhythm = xhsCloseoutRhythm;
    }
    if (runtimeStop) {
        payload.runtime_stop = runtimeStop;
    }
};
const isXhsRecoveryProbe = (input) => input.command === "xhs.search" &&
    input.ability.id === "xhs.note.search.v1" &&
    input.options.xhs_recovery_probe === true;
const isXhsLiveReadBaselineGateCommand = (input) => (input.command === "xhs.search" ||
    input.command === "xhs.detail" ||
    input.command === "xhs.user_home") &&
    isLiveXhsReadExecutionMode(input.requestedExecutionMode);
const shouldReturnInProcessGateOnlyResult = (input) => input.requestedExecutionMode === "dry_run" &&
    asString(process.env.WEBENVOY_NATIVE_TRANSPORT) === null;
const buildInProcessGateOnlyResult = (input) => {
    const profile = input.context.profile ?? "gate_only_profile";
    const sessionId = `gate-only-${input.context.run_id}`;
    const { __anonymous_isolation_verified: anonymousIsolationVerified, target_site_logged_in: targetSiteLoggedIn, ...preparedGateOptions } = input.preparedIssue209LiveRead.options;
    const gateOptions = {
        ...preparedGateOptions,
        ...(typeof anonymousIsolationVerified === "boolean"
            ? { __anonymous_isolation_verified: anonymousIsolationVerified }
            : {}),
        ...(typeof targetSiteLoggedIn === "boolean"
            ? { target_site_logged_in: targetSiteLoggedIn }
            : {}),
        ...(typeof input.context.profile === "string"
            ? { __runtime_profile_ref: input.context.profile }
            : {})
    };
    const gateBundle = buildLoopbackGate(gateOptions, input.envelope.ability.action, {
        runId: input.context.run_id,
        requestId: input.envelope.requestId ?? undefined,
        commandRequestId: input.preparedIssue209LiveRead.commandRequestId ?? undefined,
        sessionId,
        profile,
        gateInvocationId: input.preparedIssue209LiveRead.gateInvocationId ?? undefined
    });
    const auditRecord = buildLoopbackAuditRecord({
        runId: input.context.run_id,
        sessionId,
        profile,
        gate: gateBundle
    });
    auditRecord.recorded_at = new Date().toISOString();
    const payload = buildLoopbackGatePayload({
        runId: input.context.run_id,
        sessionId,
        profile,
        gate: gateBundle,
        auditRecord
    });
    if (gateBundle.consumerGateResult.gate_decision === "blocked") {
        payload.details = {
            ability_id: input.envelope.ability.id,
            stage: "execution",
            reason: "EXECUTION_MODE_GATE_BLOCKED"
        };
        throw toCliExecutionError(input.envelope.ability, payload, `执行模式门禁阻断了当前 ${input.context.command} 请求`, input.context.run_id);
    }
    const dataRefValue = typeof input.parsedInput[input.dataRefKey] === "string"
        ? String(input.parsedInput[input.dataRefKey])
        : "";
    const summary = mapCapabilitySummaryForContract(input.envelope.ability.id, {
        ...buildCapabilityResult(input.envelope.ability, {
            data_ref: dataRefValue ? { [input.dataRefKey]: dataRefValue } : {},
            metrics: {
                count: 0
            }
        }),
        ...payload,
        session_id: sessionId,
        requested_execution_mode: input.gate.requestedExecutionMode,
        ...(typeof anonymousIsolationVerified === "boolean"
            ? { __anonymous_isolation_verified: anonymousIsolationVerified }
            : {}),
        ...(typeof targetSiteLoggedIn === "boolean"
            ? { target_site_logged_in: targetSiteLoggedIn }
            : {})
    });
    return {
        summary,
        observability: asObservabilityInput(payload.observability)
    };
};
const shouldReturnExplicitCloseoutEvidenceResult = (input) => (input.command === "xhs.detail" || input.command === "xhs.user_home") &&
    isLiveXhsReadExecutionMode(input.requestedExecutionMode) &&
    input.options.closeout_audit_required === true &&
    asObject(input.options.closeout_evidence_expected) !== null &&
    hasCloseoutEvidenceRoundRecords(toCloseoutEvidenceRoundRecords(input.options.closeout_evidence_rounds));
const buildExplicitCloseoutEvidenceResult = (input) => {
    const profile = input.context.profile ?? "unknown";
    const gateBundle = buildLoopbackGate(input.runtimeGateOptions, input.envelope.ability.action, {
        runId: input.context.run_id,
        requestId: input.envelope.requestId ?? undefined,
        commandRequestId: input.preparedIssue209LiveRead.commandRequestId ?? undefined,
        sessionId: input.sessionId,
        profile,
        gateInvocationId: input.preparedIssue209LiveRead.gateInvocationId ?? undefined
    });
    const auditRecord = buildLoopbackAuditRecord({
        runId: input.context.run_id,
        sessionId: input.sessionId,
        profile,
        gate: gateBundle
    });
    auditRecord.recorded_at = new Date().toISOString();
    const gatePayload = buildLoopbackGatePayload({
        runId: input.context.run_id,
        sessionId: input.sessionId,
        profile,
        gate: gateBundle,
        auditRecord
    });
    const dataRefValue = typeof input.parsedInput[input.dataRefKey] === "string"
        ? String(input.parsedInput[input.dataRefKey])
        : "";
    const closeoutEvidenceSummaryFields = mergeXhsCloseoutEvidenceSummaryFieldsForRuntimeContract(gatePayload, input.runtimeGateOptions);
    const summary = mapCapabilitySummaryForContract(input.envelope.ability.id, {
        ...buildCapabilityResult(input.envelope.ability, {
            data_ref: dataRefValue ? { [input.dataRefKey]: dataRefValue } : {},
            metrics: {
                count: 0
            }
        }),
        ...gatePayload,
        ...closeoutEvidenceSummaryFields,
        session_id: input.sessionId,
        requested_execution_mode: input.gate.requestedExecutionMode,
        closeout_audit_required: true,
        explicit_closeout_evidence_only: true
    });
    assertCloseoutEvidenceForRuntime(input.envelope.ability, buildXhsCloseoutEvidenceTrustedBindingForContract({
        cwd: input.context.cwd,
        runId: input.context.run_id,
        profileRef: input.context.profile,
        targetTabId: input.gate.targetTabId,
        summary
    }), summary);
    if (requiresCanonicalExecutionAuditForContract({ payload: gatePayload, summary })) {
        assertCloseoutCanonicalExecutionAuditForRuntime(input.envelope.ability, input.context.run_id, {
            success: {
                summary,
                observability: gatePayload.observability
            }
        });
    }
    return {
        summary,
        observability: asObservabilityInput(gatePayload.observability)
    };
};
const assertXhsLivePreflightAllowsCommand = (input) => {
    const recoveryProbe = isXhsRecoveryProbe(input);
    const xhsLiveReadBaselineGate = isXhsLiveReadBaselineGateCommand(input);
    const rhythmState = asString(input.xhsCloseoutRhythm.state);
    const fullBundleBlocked = input.xhsCloseoutRhythm.full_bundle_blocked === true;
    const singleProbeRequired = input.xhsCloseoutRhythm.single_probe_required === true;
    const probeRunId = asString(input.xhsCloseoutRhythm.probe_run_id);
    const accountSafetyClear = input.accountSafety.state === "clear";
    if (recoveryProbe &&
        input.requestedExecutionMode === "recon" &&
        rhythmState === "single_probe_required" &&
        accountSafetyClear &&
        probeRunId === null) {
        return;
    }
    if (!recoveryProbe &&
        xhsLiveReadBaselineGate &&
        accountSafetyClear &&
        rhythmState === "single_probe_passed" &&
        input.antiDetectionValidationView?.all_required_ready === true) {
        return;
    }
    if (!recoveryProbe &&
        isLiveXhsExecutionMode(input.requestedExecutionMode) &&
        accountSafetyClear &&
        rhythmState === "not_required") {
        return;
    }
    if (!recoveryProbe &&
        !xhsLiveReadBaselineGate &&
        isLiveXhsExecutionMode(input.requestedExecutionMode) &&
        accountSafetyClear &&
        rhythmState === "single_probe_passed" &&
        input.antiDetectionValidationView?.all_required_ready === true) {
        return;
    }
    const blockReason = input.accountSafety.state === "account_risk_blocked"
        ? "ACCOUNT_RISK_BLOCKED"
        : recoveryProbe && input.requestedExecutionMode !== "recon"
            ? "XHS_RECOVERY_PROBE_MODE_INVALID"
            : !recoveryProbe && isLiveXhsExecutionMode(input.requestedExecutionMode) && rhythmState === "single_probe_passed"
                ? "ANTI_DETECTION_VALIDATION_BASELINE_BLOCKED"
                : fullBundleBlocked || singleProbeRequired
                    ? "XHS_CLOSEOUT_RHYTHM_BLOCKED"
                    : "XHS_CLOSEOUT_RHYTHM_UNAVAILABLE";
    const issueScope = asString(input.options.issue_scope) ?? "issue_209";
    const actionType = asString(input.options.action_type) ?? input.ability.action;
    const reasonCodes = Array.isArray(input.xhsCloseoutRhythm.reason_codes) &&
        input.xhsCloseoutRhythm.reason_codes.every((reason) => typeof reason === "string")
        ? input.xhsCloseoutRhythm.reason_codes
        : [blockReason];
    const admissionRequires = blockReason === "ANTI_DETECTION_VALIDATION_BASELINE_BLOCKED"
        ? ["anti_detection_validation_baseline_ready"]
        : ["session_rhythm_window_not_ready"];
    const preflightHardStopRisk = classifyCloseoutHardStopRisk({
        statusCode: input.accountSafety.status_code ?? input.accountSafety.statusCode,
        platformCode: input.accountSafety.platform_code ?? input.accountSafety.platformCode,
        accountSafety: input.accountSafety,
        accountSafetyFresh: true
    });
    throw new CliError("ERR_EXECUTION_FAILED", "XHS account-safety gate blocked current live command", {
        retryable: false,
        details: {
            ability_id: input.ability.id,
            stage: "execution",
            reason: blockReason,
            session_rhythm_admission_summary: {
                decision: "blocked",
                reason_codes: reasonCodes,
                requires: admissionRequires,
                requested_execution_mode: input.requestedExecutionMode,
                action_type: actionType,
                issue_scope: issueScope,
                risk_state: asString(input.options.risk_state) ?? "paused"
            },
            account_safety: input.accountSafety,
            xhs_closeout_rhythm: input.xhsCloseoutRhythm,
            ...(preflightHardStopRisk.hard_stop
                ? { closeout_hard_stop_risk: preflightHardStopRisk }
                : {}),
            ...(input.antiDetectionValidationView
                ? {
                    anti_detection_validation_view: toXhsCloseoutValidationGateJson(input.antiDetectionValidationView)
                }
                : {})
        }
    });
};
const recordXhsRecoveryProbeFailure = async (input) => {
    const failureStatus = await input.profileRuntime.markXhsCloseoutSingleProbeFailed({
        cwd: input.cwd,
        profile: input.profile,
        runId: input.runId,
        params: {},
        reasonCode: input.reasonCode
    });
    const xhsCloseoutRhythm = asObject(failureStatus.xhs_closeout_rhythm);
    const accountSafetyRecord = asObject(failureStatus.account_safety_record);
    const xhsCloseoutRhythmRecord = asObject(failureStatus.xhs_closeout_rhythm_record);
    const storeIssueScope = resolveSessionRhythmStoreIssueScope(input.issueScope);
    if (!storeIssueScope) {
        return {
            ...(xhsCloseoutRhythm ?? {}),
            session_rhythm_status_view_skipped_reason: input.issueScope
                ? "issue_scope_unsupported"
                : "issue_scope_missing"
        };
    }
    const recoveryRhythmView = toSessionRhythmStatusView({
        profile: input.profile,
        rhythm: xhsCloseoutRhythmRecord ?? undefined,
        accountSafety: accountSafetyRecord ?? undefined,
        issueScope: storeIssueScope,
        sessionId: input.sessionId,
        sourceRunId: input.runId,
        effectiveExecutionMode: input.effectiveExecutionMode ?? "recon",
        eventTypeOverride: "recovery_probe_failed",
        eventReasonOverride: input.reasonCode ?? "XHS_RECOVERY_SINGLE_PROBE_FAILED"
    });
    const windowState = asObject(recoveryRhythmView.session_rhythm_window_state);
    const event = asObject(recoveryRhythmView.session_rhythm_event);
    const decision = asObject(recoveryRhythmView.session_rhythm_decision);
    if (windowState && event && decision) {
        let store = null;
        try {
            store = new SQLiteRuntimeStore(resolveRuntimeStorePath(input.cwd));
            await store.recordSessionRhythmStatusView({
                profile: input.profile,
                platform: "xhs",
                issueScope: storeIssueScope,
                windowState,
                event,
                decision
            });
        }
        catch (error) {
            return {
                ...(xhsCloseoutRhythm ?? {}),
                session_rhythm_status_view_skipped_reason: "sqlite_write_failed",
                session_rhythm_status_view_skip_error_code: error instanceof RuntimeStoreError ? error.code : "UNKNOWN"
            };
        }
        finally {
            try {
                store?.close();
            }
            catch {
                // Recovery probe failure payload must keep the original account-safety error stable.
            }
        }
    }
    return xhsCloseoutRhythm;
};
const prepareXhsOfficialChromeRuntime = async (context, ability, requestedExecutionMode, bridge, fingerprintContext, gate, readStatus) => {
    return await prepareOfficialChromeRuntime({
        context,
        consumerId: ability.id,
        requestedExecutionMode,
        bridge,
        fingerprintContext,
        bootstrapTargetTabId: gate.targetTabId,
        bootstrapTargetDomain: gate.targetDomain,
        bootstrapTargetPage: gate.targetPage,
        bootstrapTargetResourceId: gate.targetResourceId ?? null,
        readStatus
    });
};
export const ensureOfficialChromeRuntimeReady = async (context, ability, requestedExecutionMode, bridge, fingerprintContext, gate, readStatus) => {
    await prepareXhsOfficialChromeRuntime(context, ability, requestedExecutionMode, bridge, fingerprintContext, gate, readStatus);
};
const resolveBootstrapTargetResourceId = (command, parsedInput) => {
    if (command === "xhs.detail") {
        return typeof parsedInput.note_id === "string" && parsedInput.note_id.trim().length > 0
            ? parsedInput.note_id.trim()
            : null;
    }
    if (command === "xhs.user_home") {
        return typeof parsedInput.user_id === "string" && parsedInput.user_id.trim().length > 0
            ? parsedInput.user_id.trim()
            : null;
    }
    return null;
};
const buildActiveApiFetchFallbackRuntimeAttestation = (input) => {
    const runtimeReadiness = asString(input.status?.runtimeReadiness ?? input.status?.runtime_readiness);
    const executionSurface = asString(input.status?.executionSurface ?? input.status?.execution_surface);
    const headless = typeof input.status?.headless === "boolean" ? input.status.headless : null;
    if (!runtimeReadiness || !executionSurface || headless === null) {
        return null;
    }
    return {
        source: "official_chrome_runtime_readiness",
        runtime_readiness: runtimeReadiness,
        profile_ref: input.context.profile ?? null,
        session_id: input.sessionId,
        run_id: input.context.run_id,
        execution_surface: executionSurface,
        headless,
        observed_at: new Date().toISOString()
    };
};
const injectActiveApiFetchFallbackRuntimeAttestation = (input) => {
    const activeFallback = asObject(input.options.active_api_fetch_fallback);
    if (!activeFallback) {
        return input.options;
    }
    const { fingerprint_validation_state: _fingerprintValidationState, execution_surface: _executionSurface, headless: _headless, runtime_attestation: _runtimeAttestation, fingerprint_attestation: _fingerprintAttestation, ...activeFallbackRest } = activeFallback;
    return {
        ...input.options,
        active_api_fetch_fallback: {
            ...activeFallbackRest,
            ...(input.attestation ? { runtime_attestation: input.attestation } : {})
        }
    };
};
const xhsSearch = async (context) => {
    return xhsReadCommand(context, {
        fixtureDataRefKey: "query",
        parseInput: (envelope, gate) => parseSearchInputForContract(envelope.input, envelope.ability.id, gate.options, envelope.ability.action)
    });
};
const xhsEditorInputValidate = async (context) => {
    return xhsReadCommand({
        ...context,
        params: normalizeDedicatedXhsCommandParams(context.params, XHS_EDITOR_INPUT_ABILITY)
    }, {
        fixtureDataRefKey: "validation_action",
        parseInput: () => parseEditorInputValidateInputForContract()
    });
};
const xhsEditorTextWrite = async (context) => {
    return xhsReadCommand({
        ...context,
        params: normalizeDedicatedXhsCommandParams(context.params, XHS_EDITOR_TEXT_WRITE_ABILITY)
    }, {
        fixtureDataRefKey: "validation_action",
        parseInput: (envelope) => parseEditorTextWriteInputForContract(envelope.input, envelope.ability.id)
    });
};
const xhsCreatorPublishAdmit = async (context) => {
    return xhsReadCommand({
        ...context,
        params: normalizeDedicatedXhsCommandParams(context.params, XHS_CREATOR_PUBLISH_ABILITY)
    }, {
        fixtureDataRefKey: "target_page",
        parseInput: () => parseCreatorPublishAdmissionInputForContract()
    });
};
const xhsMediaUploadDiscover = async (context) => {
    return xhsReadCommand({
        ...context,
        params: normalizeDedicatedXhsCommandParams(context.params, XHS_MEDIA_UPLOAD_DISCOVER_ABILITY)
    }, {
        fixtureDataRefKey: "target_page",
        parseInput: () => parseMediaUploadDiscoveryInputForContract()
    });
};
const xhsDetail = async (context) => {
    return xhsReadCommand(context, {
        fixtureDataRefKey: "note_id",
        parseInput: (envelope) => parseDetailInputForContract(envelope.input, envelope.ability.id)
    });
};
const xhsUserHome = async (context) => {
    return xhsReadCommand(context, {
        fixtureDataRefKey: "user_id",
        parseInput: (envelope) => parseUserHomeInputForContract(envelope.input, envelope.ability.id)
    });
};
const xhsReadCommand = async (context, inputConfig) => {
    const envelope = parseAbilityEnvelopeForContract(context.params);
    const gate = normalizeGateOptionsForContract(envelope.options, envelope.ability.id, {
        command: context.command,
        abilityAction: envelope.ability.action,
        runtimeProfile: context.profile ?? null,
        upstreamAuthorization: envelope.upstreamAuthorization
    });
    const explicitIssueScope = asString(envelope.options.issue_scope);
    const parsedInput = inputConfig.parseInput(envelope, gate);
    const commandAliasDiagnostics = buildXhsCommandAliasDiagnostics({
        command: context.command,
        ability: envelope.ability,
        options: gate.options
    });
    if (process.env.NODE_ENV === "test" &&
        process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS === "1" &&
        gate.options.fixture_success === true) {
        const dataRefValue = typeof parsedInput[inputConfig.fixtureDataRefKey] === "string"
            ? String(parsedInput[inputConfig.fixtureDataRefKey])
            : null;
        return {
            summary: mapCapabilitySummaryForContract(envelope.ability.id, buildCapabilityResult(envelope.ability, {
                data_ref: dataRefValue ? { [inputConfig.fixtureDataRefKey]: dataRefValue } : {},
                metrics: {
                    count: 0
                }
            }))
        };
    }
    if (envelope.input.force_bad_output === true) {
        return {
            summary: mapCapabilitySummaryForContract(envelope.ability.id, {})
        };
    }
    const profileStore = new ProfileStore(resolveRuntimeProfileRoot(context.cwd));
    let profileMeta = context.profile ? await profileStore.readMeta(context.profile) : null;
    const accountSafetyStatus = toAccountSafetyStatus(profileMeta?.accountSafety);
    const profileReadiness = {
        profile: context.profile ?? null,
        profile_state: profileMeta?.profileState ?? "missing",
        ready: profileMeta?.profileState === "ready"
    };
    const accountReadiness = {
        ...accountSafetyStatus,
        ready: accountSafetyStatus.state === "clear" && accountSafetyStatus.live_commands_blocked !== true
    };
    const creatorPublishAdmissionGateReasons = context.command === XHS_CREATOR_PUBLISH_ADMIT_COMMAND
        ? [
            ...(profileReadiness.ready ? [] : ["PROFILE_NOT_READY"]),
            ...(accountReadiness.ready ? [] : ["ACCOUNT_SAFETY_NOT_READY"])
        ]
        : [];
    let xhsCloseoutRhythmStatus = toXhsCloseoutRhythmStatus({
        rhythm: profileMeta?.xhsCloseoutRhythm,
        accountSafety: profileMeta?.accountSafety
    });
    xhsCloseoutRhythmStatus =
        (await readPersistedSessionRhythmBlockStatus({
            cwd: context.cwd,
            profile: context.profile,
            issueScope: explicitIssueScope,
            profileMeta
        })) ?? xhsCloseoutRhythmStatus;
    const profileRuntime = new ProfileRuntimeService();
    const recoveryProbeRequested = isXhsRecoveryProbe({
        command: context.command,
        ability: envelope.ability,
        options: gate.options
    });
    const liveXhsCommandRequested = isLiveXhsExecutionMode(gate.requestedExecutionMode);
    const reconXhsCommandRequested = gate.requestedExecutionMode === "recon";
    const xhsLiveReadBaselineGateRequested = isXhsLiveReadBaselineGateCommand({
        command: context.command,
        options: gate.options,
        requestedExecutionMode: gate.requestedExecutionMode
    });
    const sessionRhythmGateApplies = context.command !== XHS_EDITOR_INPUT_VALIDATE_COMMAND;
    const closeoutValidationReadinessApplies = context.command !== XHS_EDITOR_INPUT_VALIDATE_COMMAND;
    const accountSafetyBlockedLiveCommand = accountSafetyStatus.state === "account_risk_blocked" &&
        (liveXhsCommandRequested || recoveryProbeRequested);
    let antiDetectionValidationGate = null;
    if (context.profile &&
        sessionRhythmGateApplies &&
        (liveXhsCommandRequested || recoveryProbeRequested || accountSafetyBlockedLiveCommand)) {
        const rhythmState = asString(xhsCloseoutRhythmStatus.state);
        const shouldRunRhythmGate = recoveryProbeRequested ||
            liveXhsCommandRequested ||
            accountSafetyBlockedLiveCommand ||
            (rhythmState !== null && rhythmState !== "not_required");
        if (shouldRunRhythmGate) {
            if (!recoveryProbeRequested &&
                liveXhsCommandRequested &&
                closeoutValidationReadinessApplies &&
                rhythmState === "single_probe_passed") {
                let store = null;
                try {
                    store = new SQLiteRuntimeStore(resolveRuntimeStorePath(context.cwd));
                    antiDetectionValidationGate = await readXhsCloseoutValidationGateView({
                        store,
                        profile: context.profile,
                        effectiveExecutionMode: resolveXhsCloseoutReadinessBaselineExecutionMode(gate.requestedExecutionMode)
                    });
                }
                catch (error) {
                    if (error instanceof RuntimeStoreError) {
                        if (error.code === "ERR_RUNTIME_STORE_INVALID_INPUT") {
                            throw new CliError("ERR_CLI_INVALID_ARGS", "XHS 反检测验证查询参数不合法", {
                                details: {
                                    ability_id: envelope.ability.id,
                                    stage: "input_validation",
                                    reason: "ANTI_DETECTION_VALIDATION_QUERY_INVALID_INPUT"
                                }
                            });
                        }
                        throw new CliError("ERR_RUNTIME_UNAVAILABLE", `运行记录存储失败: ${error.code}`, {
                            retryable: error.code !== "ERR_RUNTIME_STORE_SCHEMA_MISMATCH",
                            cause: error
                        });
                    }
                    throw error;
                }
                finally {
                    try {
                        store?.close();
                    }
                    catch {
                        // Read-only preflight best-effort close.
                    }
                }
            }
            assertXhsLivePreflightAllowsCommand({
                command: context.command,
                ability: envelope.ability,
                accountSafety: accountSafetyStatus,
                xhsCloseoutRhythm: xhsCloseoutRhythmStatus,
                antiDetectionValidationView: antiDetectionValidationGate,
                options: gate.options,
                requestedExecutionMode: gate.requestedExecutionMode
            });
        }
    }
    try {
        const preparedIssue209LiveRead = prepareIssue209LiveReadEnvelopeForContract({
            options: gate.options,
            requestId: envelope.requestId,
            gateInvocationId: envelope.gateInvocationId,
            runId: context.run_id
        });
        if (context.command !== XHS_CREATOR_PUBLISH_ADMIT_COMMAND &&
            context.command !== XHS_MEDIA_UPLOAD_DISCOVER_COMMAND &&
            shouldReturnInProcessGateOnlyResult({
                requestedExecutionMode: gate.requestedExecutionMode
            })) {
            return attachCommandAliasDiagnosticsToResult(buildInProcessGateOnlyResult({
                context,
                envelope,
                gate,
                parsedInput,
                preparedIssue209LiveRead,
                dataRefKey: inputConfig.fixtureDataRefKey
            }), commandAliasDiagnostics);
        }
        const bridge = resolveRuntimeBridge();
        const fingerprintContext = buildFingerprintContextForMeta(context.profile ?? "unknown", profileMeta, {
            requestedExecutionMode: gate.requestedExecutionMode
        });
        let officialChromeRuntimeStatus = null;
        if (liveXhsCommandRequested || recoveryProbeRequested || reconXhsCommandRequested) {
            officialChromeRuntimeStatus = await prepareXhsOfficialChromeRuntime(context, envelope.ability, gate.requestedExecutionMode, bridge, fingerprintContext, {
                ...gate,
                targetResourceId: resolveBootstrapTargetResourceId(context.command, parsedInput)
            });
        }
        const bridgeSessionId = await bridge.ensureSession({
            profile: context.profile
        });
        if (context.profile && recoveryProbeRequested) {
            await profileRuntime.claimXhsCloseoutSingleProbe({
                cwd: context.cwd,
                profile: context.profile,
                runId: context.run_id,
                params: {}
            });
            profileMeta = await profileStore.readMeta(context.profile);
        }
        const transportIsLoopback = process.env.WEBENVOY_NATIVE_TRANSPORT === "loopback";
        const { __anonymous_isolation_verified: anonymousIsolationVerified, target_site_logged_in: targetSiteLoggedIn, ...preparedGateOptions } = preparedIssue209LiveRead.options;
        const sessionRhythmAdmission = sessionRhythmGateApplies
            ? await buildSessionRhythmAdmissionForRuntime({
                cwd: context.cwd,
                profile: context.profile,
                runId: context.run_id,
                sessionId: bridgeSessionId,
                profileMeta,
                gate,
                issueScope: explicitIssueScope
            })
            : null;
        const forwardTimeoutMs = resolveForwardTimeoutMsForContract(context.params);
        const runtimeGateOptions = {
            ...injectActiveApiFetchFallbackRuntimeAttestation({
                options: preparedGateOptions,
                attestation: buildActiveApiFetchFallbackRuntimeAttestation({
                    status: officialChromeRuntimeStatus,
                    context,
                    sessionId: bridgeSessionId
                })
            }),
            ...(sessionRhythmAdmission ?? {}),
            ...(transportIsLoopback && typeof anonymousIsolationVerified === "boolean"
                ? { __anonymous_isolation_verified: anonymousIsolationVerified }
                : {}),
            ...(transportIsLoopback && typeof targetSiteLoggedIn === "boolean"
                ? { target_site_logged_in: targetSiteLoggedIn }
                : {}),
            ...(gate.options.closeout_evidence_evaluation === true
                ? {
                    __runtime_latest_head_sha: resolveXhsCloseoutRuntimeLatestHeadShaForContract(context.cwd)
                }
                : {}),
            ...(context.command === XHS_EDITOR_TEXT_WRITE_COMMAND && typeof parsedInput.text === "string"
                ? {
                    validation_text: parsedInput.text,
                    editor_text_write: true
                }
                : {}),
            ...(context.command === XHS_CREATOR_PUBLISH_ADMIT_COMMAND
                ? {
                    profile_readiness: profileReadiness,
                    account_readiness: accountReadiness,
                    admission_gate_reasons: creatorPublishAdmissionGateReasons
                }
                : {}),
            ...(typeof context.profile === "string" ? { __runtime_profile_ref: context.profile } : {})
        };
        const commandParams = appendFingerprintContext({
            ...(forwardTimeoutMs ? { timeout_ms: forwardTimeoutMs } : {}),
            ...(preparedIssue209LiveRead.commandRequestId
                ? { request_id: preparedIssue209LiveRead.commandRequestId }
                : {}),
            ...(preparedIssue209LiveRead.gateInvocationId
                ? { gate_invocation_id: preparedIssue209LiveRead.gateInvocationId }
                : {}),
            ...(preparedIssue209LiveRead.admissionDraft
                ? {
                    [ISSUE209_INTERNAL_ADMISSION_DRAFT_KEY]: preparedIssue209LiveRead.admissionDraft
                }
                : {}),
            target_domain: gate.targetDomain,
            target_tab_id: gate.targetTabId,
            target_page: gate.targetPage,
            requested_execution_mode: gate.requestedExecutionMode,
            ability: envelope.ability,
            input: parsedInput,
            options: runtimeGateOptions,
            session_id: bridgeSessionId
        }, fingerprintContext);
        const bridgeResult = await bridge.runCommand({
            runId: context.run_id,
            profile: context.profile,
            cwd: context.cwd,
            command: context.command,
            params: commandParams
        });
        if (!bridgeResult.ok) {
            const accountSafetySignal = context.profile && (isLiveXhsExecutionMode(gate.requestedExecutionMode) || recoveryProbeRequested)
                ? resolveAccountSafetySignal(bridgeResult.payload, {
                    command: context.command,
                    targetDomain: gate.targetDomain,
                    targetTabId: gate.targetTabId,
                    targetPage: gate.targetPage
                })
                : null;
            if (accountSafetySignal && context.profile) {
                const accountSafetyResult = await profileRuntime.markAccountSafetyBlocked({
                    cwd: context.cwd,
                    profile: context.profile,
                    runId: context.run_id,
                    params: {},
                    signal: accountSafetySignal
                });
                const accountSafety = asObject(accountSafetyResult.account_safety);
                const xhsCloseoutRhythm = recoveryProbeRequested
                    ? await recordXhsRecoveryProbeFailure({
                        cwd: context.cwd,
                        profile: context.profile,
                        runId: context.run_id,
                        sessionId: bridgeSessionId,
                        issueScope: explicitIssueScope,
                        effectiveExecutionMode: gate.requestedExecutionMode,
                        reasonCode: accountSafetySignal.reason,
                        profileRuntime
                    })
                    : asObject(accountSafetyResult.xhs_closeout_rhythm);
                const runtimeStop = asObject(accountSafetyResult.runtime_stop);
                if (accountSafety) {
                    mergeAccountSafetyIntoFailurePayload(bridgeResult.payload, accountSafety, xhsCloseoutRhythm, runtimeStop);
                }
            }
            markCloseoutAuditRequiredForXhsLiveRouteEvidence({
                abilityId: envelope.ability.id,
                requestedExecutionMode: gate.requestedExecutionMode,
                payload: bridgeResult.payload
            });
            mergeCommandAliasDiagnosticsIntoPayload(bridgeResult.payload, commandAliasDiagnostics);
            throw toCliExecutionError(envelope.ability, bridgeResult.payload, bridgeResult.error.message, context.run_id, {
                cwd: context.cwd,
                profileRef: context.profile,
                targetTabId: gate.targetTabId
            });
        }
        const recoveryProbeRiskSignal = context.profile && recoveryProbeRequested
            ? resolveAccountSafetySignal(bridgeResult.payload, {
                command: context.command,
                targetDomain: gate.targetDomain,
                targetTabId: gate.targetTabId,
                targetPage: gate.targetPage
            })
            : null;
        if (recoveryProbeRiskSignal && context.profile) {
            const accountSafetyResult = await profileRuntime.markAccountSafetyBlocked({
                cwd: context.cwd,
                profile: context.profile,
                runId: context.run_id,
                params: {},
                signal: recoveryProbeRiskSignal
            });
            const accountSafety = asObject(accountSafetyResult.account_safety);
            const xhsCloseoutRhythm = await recordXhsRecoveryProbeFailure({
                cwd: context.cwd,
                profile: context.profile,
                runId: context.run_id,
                sessionId: bridgeSessionId,
                issueScope: explicitIssueScope,
                effectiveExecutionMode: gate.requestedExecutionMode,
                reasonCode: recoveryProbeRiskSignal.reason,
                profileRuntime
            });
            const runtimeStop = asObject(accountSafetyResult.runtime_stop);
            if (accountSafety) {
                mergeAccountSafetyIntoFailurePayload(bridgeResult.payload, accountSafety, xhsCloseoutRhythm, runtimeStop);
            }
            markCloseoutAuditRequiredWhenCanonicalAuditExists(bridgeResult.payload);
            throw toCliExecutionError(envelope.ability, bridgeResult.payload, "XHS recovery probe detected account-safety risk", context.run_id, {
                cwd: context.cwd,
                profileRef: context.profile,
                targetTabId: gate.targetTabId
            });
        }
        const consumerGateResult = asObject(bridgeResult.payload.consumer_gate_result);
        const requestAdmissionResult = pickCanonicalSummaryField(bridgeResult.payload, "request_admission_result");
        const executionAudit = pickCanonicalSummaryField(bridgeResult.payload, "execution_audit");
        const closeoutEvidenceSummaryFields = mergeXhsCloseoutEvidenceSummaryFieldsForRuntimeContract(bridgeResult.payload, gate.options);
        const mergedBridgeSummary = {
            ...(asObject(bridgeResult.payload.summary) ?? {}),
            ...closeoutEvidenceSummaryFields
        };
        const closeoutAuditRequired = requiresCloseoutAuditForXhsBridgeSummaryForContract({
            abilityId: envelope.ability.id,
            requestedExecutionMode: gate.requestedExecutionMode,
            summary: mergedBridgeSummary
        });
        const bridgeSummaryForMapping = { ...mergedBridgeSummary };
        delete bridgeSummaryForMapping.closeout_audit_required;
        const summary = mapCapabilitySummaryForContract(envelope.ability.id, {
            ...bridgeSummaryForMapping,
            session_id: bridgeSessionId,
            requested_execution_mode: gate.requestedExecutionMode,
            ...(closeoutAuditRequired ? { closeout_audit_required: true } : {}),
            ...(consumerGateResult ? { consumer_gate_result: consumerGateResult } : {}),
            ...(requestAdmissionResult !== undefined
                ? { request_admission_result: requestAdmissionResult }
                : {}),
            ...(executionAudit !== undefined ? { execution_audit: executionAudit } : {})
        });
        assertCloseoutEvidenceForRuntime(envelope.ability, buildXhsCloseoutEvidenceTrustedBindingForContract({
            cwd: context.cwd,
            runId: context.run_id,
            profileRef: context.profile,
            targetTabId: gate.targetTabId,
            summary
        }), summary);
        if (requiresCanonicalExecutionAuditForContract({ payload: bridgeResult.payload, summary })) {
            assertCloseoutCanonicalExecutionAuditForRuntime(envelope.ability, context.run_id, {
                success: {
                    summary,
                    observability: bridgeResult.payload.observability
                }
            });
        }
        if (context.profile &&
            recoveryProbeRequested) {
            const recoveryStatus = await profileRuntime.markXhsCloseoutSingleProbePassed({
                cwd: context.cwd,
                profile: context.profile,
                runId: context.run_id,
                params: {}
            });
            const xhsCloseoutRhythm = asObject(recoveryStatus.xhs_closeout_rhythm);
            if (xhsCloseoutRhythm) {
                summary.xhs_closeout_rhythm = xhsCloseoutRhythm;
            }
            const profileStore = new ProfileStore(resolveRuntimeProfileRoot(context.cwd));
            const latestMeta = await profileStore.readMeta(context.profile, { mode: "readonly" });
            const recoveryStoreIssueScope = resolveSessionRhythmStoreIssueScope(explicitIssueScope ?? "issue_209");
            const recoveryRhythmView = recoveryStoreIssueScope
                ? toSessionRhythmStatusView({
                    profile: context.profile,
                    rhythm: latestMeta?.xhsCloseoutRhythm,
                    accountSafety: latestMeta?.accountSafety,
                    issueScope: recoveryStoreIssueScope,
                    sessionId: bridgeSessionId,
                    sourceRunId: context.run_id,
                    effectiveExecutionMode: gate.requestedExecutionMode
                })
                : null;
            const windowState = asObject(recoveryRhythmView?.session_rhythm_window_state);
            const event = asObject(recoveryRhythmView?.session_rhythm_event);
            const decision = asObject(recoveryRhythmView?.session_rhythm_decision);
            if (windowState && event && decision && recoveryStoreIssueScope) {
                const store = new SQLiteRuntimeStore(resolveRuntimeStorePath(context.cwd));
                try {
                    await store.recordSessionRhythmStatusView({
                        profile: context.profile,
                        platform: "xhs",
                        issueScope: recoveryStoreIssueScope,
                        windowState,
                        event,
                        decision
                    });
                }
                finally {
                    store.close();
                }
            }
        }
        return attachCommandAliasDiagnosticsToResult({
            summary,
            observability: asObservabilityInput(bridgeResult.payload.observability)
        }, commandAliasDiagnostics);
    }
    catch (error) {
        if (error instanceof NativeMessagingTransportError) {
            throw toTransportCliError(error, envelope.ability);
        }
        throw error;
    }
};
export const xhsCommands = () => [
    {
        name: "xhs.search",
        status: "implemented",
        requiresProfile: true,
        handler: xhsSearch
    },
    {
        name: XHS_EDITOR_INPUT_VALIDATE_COMMAND,
        status: "implemented",
        requiresProfile: true,
        handler: xhsEditorInputValidate
    },
    {
        name: XHS_EDITOR_TEXT_WRITE_COMMAND,
        status: "implemented",
        requiresProfile: true,
        handler: xhsEditorTextWrite
    },
    {
        name: XHS_CREATOR_PUBLISH_ADMIT_COMMAND,
        status: "implemented",
        requiresProfile: true,
        handler: xhsCreatorPublishAdmit
    },
    {
        name: XHS_MEDIA_UPLOAD_DISCOVER_COMMAND,
        status: "implemented",
        requiresProfile: true,
        handler: xhsMediaUploadDiscover
    },
    {
        name: "xhs.detail",
        status: "implemented",
        requiresProfile: true,
        handler: xhsDetail
    },
    {
        name: "xhs.user_home",
        status: "implemented",
        requiresProfile: true,
        handler: xhsUserHome
    }
];
