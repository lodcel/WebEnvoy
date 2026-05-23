import { CliError } from "../core/errors.js";
import { buildAbilityValidationSeedForDownloadRequest, buildDownloadPrepareResultSummaryForContract, buildDownloadTriggeredResultSummaryForContract, materializeCandidateAbilityFromDownloadSeedForContract, parseDownloadBrowserExecutionResultForContract, parseDownloadCapabilityEnvelopeForContract, parseDownloadFailureReasonForContract, parseDownloadTriggerModeForContract } from "../core/download-ability.js";
import { NativeMessagingBridge, NativeMessagingTransportError } from "../runtime/native-messaging/bridge.js";
import { NativeHostBridgeTransport } from "../runtime/native-messaging/host.js";
import { createLoopbackNativeBridgeTransport } from "../runtime/native-messaging/loopback.js";
const asObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const invalidDownloadCommandInput = (reason, abilityId = "download.prepare") => new CliError("ERR_CLI_INVALID_ARGS", "Download command input invalid", {
    details: {
        ability_id: abilityId,
        stage: "input_validation",
        reason
    }
});
const parseParams = (value) => {
    const envelope = parseDownloadCapabilityEnvelopeForContract(value);
    if (!Object.prototype.hasOwnProperty.call(value, "candidate_shell_seed")) {
        throw invalidDownloadCommandInput("CANDIDATE_SHELL_SEED_MISSING", envelope.input.ability_ref);
    }
    if (Object.prototype.hasOwnProperty.call(value, "download_result_summary")) {
        throw invalidDownloadCommandInput("DOWNLOAD_RESULT_SUMMARY_INPUT_UNSUPPORTED", envelope.input.ability_ref);
    }
    return {
        envelope,
        candidateSeed: value.candidate_shell_seed
    };
};
const assertCandidateMatchesRequest = (envelope, materialized) => {
    const descriptor = materialized.candidate_ability_descriptor;
    if (descriptor.ability_id !== envelope.input.ability_ref) {
        throw invalidDownloadCommandInput("CANDIDATE_ABILITY_REF_MISMATCH", envelope.input.ability_ref);
    }
    if (descriptor.ability_kind !== "download") {
        throw invalidDownloadCommandInput("CANDIDATE_ABILITY_KIND_MISMATCH", envelope.input.ability_ref);
    }
    if (!descriptor.execution_layer_support.includes(envelope.input.requested_execution_layer)) {
        throw invalidDownloadCommandInput("CANDIDATE_EXECUTION_LAYER_UNSUPPORTED", envelope.input.ability_ref);
    }
};
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
const downloadPrepare = async (context) => {
    const params = asObject(context.params);
    if (!params) {
        throw invalidDownloadCommandInput("PARAMS_INVALID");
    }
    const { envelope, candidateSeed } = parseParams(params);
    if (context.profile !== envelope.input.profile_ref) {
        throw invalidDownloadCommandInput("PROFILE_MISMATCH", envelope.input.ability_ref);
    }
    const materialized = materializeCandidateAbilityFromDownloadSeedForContract(candidateSeed);
    assertCandidateMatchesRequest(envelope, materialized);
    const downloadResultSummary = buildDownloadPrepareResultSummaryForContract({
        runId: context.run_id,
        request: envelope.input
    });
    return {
        capability_result: {
            ability_id: envelope.ability.id,
            layer: envelope.ability.layer,
            action: "download",
            outcome: "partial",
            data_ref: downloadResultSummary.download_ref,
            download_result_summary: downloadResultSummary
        },
        ...materialized,
        ability_validation_seed: buildAbilityValidationSeedForDownloadRequest({
            request: envelope.input,
            materialized
        }),
        download_execution_boundary: "not_executed_in_fr0021_747",
        validation_execution_boundary: "not_executed_in_fr0021_747"
    };
};
const downloadTrigger = async (context) => {
    const params = asObject(context.params);
    if (!params) {
        throw invalidDownloadCommandInput("PARAMS_INVALID");
    }
    const { envelope, candidateSeed } = parseParams(params);
    if (context.profile !== envelope.input.profile_ref) {
        throw invalidDownloadCommandInput("PROFILE_MISMATCH", envelope.input.ability_ref);
    }
    const materialized = materializeCandidateAbilityFromDownloadSeedForContract(candidateSeed);
    assertCandidateMatchesRequest(envelope, materialized);
    const options = asObject(params.options) ?? {};
    const triggerMode = parseDownloadTriggerModeForContract(options.trigger_mode, envelope.input.ability_ref);
    let bridge = null;
    try {
        bridge = resolveRuntimeBridge();
        const bridgeResult = await bridge.runCommand({
            runId: context.run_id,
            profile: context.profile,
            cwd: context.cwd,
            command: "download.trigger",
            params: {
                ...context.params,
                download_ability_request: envelope.input,
                trigger_mode: triggerMode,
                target_tab_id: options.target_tab_id,
                target_domain: options.target_domain,
                target_page: options.target_page
            }
        });
        if (!bridgeResult.ok) {
            throw new CliError("ERR_RUNTIME_UNAVAILABLE", bridgeResult.error.message, {
                retryable: bridgeResult.error.code === "ERR_TRANSPORT_TIMEOUT",
                details: {
                    ability_id: envelope.input.ability_ref,
                    stage: "execution",
                    reason: "RUNTIME_ERROR"
                }
            });
        }
        const browserResult = parseDownloadBrowserExecutionResultForContract(bridgeResult.payload.download_browser_result ?? bridgeResult.payload, envelope.input.ability_ref);
        if (!browserResult.success) {
            const reason = parseDownloadFailureReasonForContract(browserResult.failure_reason, envelope.input.ability_ref);
            throw new CliError("ERR_EXECUTION_FAILED", "Download target trigger failed", {
                retryable: reason === "RUNTIME_ERROR",
                details: {
                    ability_id: envelope.input.ability_ref,
                    stage: "execution",
                    reason
                }
            });
        }
        if (!browserResult.download_target) {
            throw invalidDownloadCommandInput("DOWNLOAD_TARGET_MISSING", envelope.input.ability_ref);
        }
        const downloadResultSummary = buildDownloadTriggeredResultSummaryForContract({
            runId: context.run_id,
            target: browserResult.download_target
        });
        return {
            capability_result: {
                ability_id: envelope.ability.id,
                layer: envelope.ability.layer,
                action: "download",
                outcome: "partial",
                data_ref: downloadResultSummary.download_ref,
                download_result_summary: downloadResultSummary
            },
            download_target: browserResult.download_target,
            trigger_audit: browserResult.trigger_audit,
            ...materialized,
            ability_validation_seed: buildAbilityValidationSeedForDownloadRequest({
                request: envelope.input,
                materialized,
                validationExecutionBoundary: "seed_only_until_fr0021_750"
            }),
            relay_path: bridgeResult.relay_path,
            download_execution_boundary: "browser_target_trigger_only_fr0021_748",
            file_landing_boundary: "not_executed_until_fr0021_749",
            validation_execution_boundary: "seed_only_until_fr0021_750"
        };
    }
    catch (error) {
        if (error instanceof NativeMessagingTransportError) {
            throw new CliError("ERR_RUNTIME_UNAVAILABLE", `通信链路不可用: ${error.code}`, {
                retryable: error.retryable,
                cause: error,
                details: {
                    ability_id: envelope.input.ability_ref,
                    stage: "execution",
                    reason: "RUNTIME_ERROR"
                }
            });
        }
        throw error;
    }
    finally {
        await bridge?.close().catch(() => undefined);
    }
};
export const downloadCommands = () => [
    {
        name: "download.prepare",
        status: "implemented",
        requiresProfile: true,
        handler: downloadPrepare
    },
    {
        name: "download.trigger",
        status: "implemented",
        requiresProfile: true,
        handler: downloadTrigger
    }
];
