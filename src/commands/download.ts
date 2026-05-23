import { CliError } from "../core/errors.js";
import {
  buildAbilityValidationSeedForDownloadRequest,
  buildDownloadValidationExecutionResultForContract,
  buildDownloadLandedResultSummaryForContract,
  buildDownloadPrepareResultSummaryForContract,
  buildDownloadTriggeredResultSummaryForContract,
  materializeCandidateAbilityFromDownloadSeedForContract,
  parseDownloadBrowserExecutionResultForContract,
  parseDownloadCapabilityEnvelopeForContract,
  parseDownloadFailureReasonForContract,
  parseDownloadResultSummaryForContract,
  parseDownloadTriggerModeForContract,
  type DownloadCapabilityEnvelope,
  type DownloadBrowserTarget,
  type MaterializedDownloadCandidateAbility
} from "../core/download-ability.js";
import type { CommandDefinition, JsonObject, RuntimeContext } from "../core/types.js";
import {
  NativeMessagingBridge,
  NativeMessagingTransportError
} from "../runtime/native-messaging/bridge.js";
import { NativeHostBridgeTransport } from "../runtime/native-messaging/host.js";
import { createLoopbackNativeBridgeTransport } from "../runtime/native-messaging/loopback.js";
import { landBrowserDownloadArtifactForContract } from "../runtime/download-landing.js";
import {
  runAbilityReplayForContract,
  runAbilityValidationForContract
} from "./ability.js";

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const hasOwn = (value: JsonObject, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const invalidDownloadCommandInput = (
  reason: string,
  abilityId = "download.prepare"
): CliError =>
  new CliError("ERR_CLI_INVALID_ARGS", "Download command input invalid", {
    details: {
      ability_id: abilityId,
      stage: "input_validation",
      reason
    }
  });

const parseParams = (
  value: JsonObject
): {
  envelope: DownloadCapabilityEnvelope;
  candidateSeed: unknown;
} => {
  const envelope = parseDownloadCapabilityEnvelopeForContract(value);
  if (!Object.prototype.hasOwnProperty.call(value, "candidate_shell_seed")) {
    throw invalidDownloadCommandInput("CANDIDATE_SHELL_SEED_MISSING", envelope.input.ability_ref);
  }
  if (Object.prototype.hasOwnProperty.call(value, "download_result_summary")) {
    throw invalidDownloadCommandInput(
      "DOWNLOAD_RESULT_SUMMARY_INPUT_UNSUPPORTED",
      envelope.input.ability_ref
    );
  }
  return {
    envelope,
    candidateSeed: value.candidate_shell_seed
  };
};

const assertCandidateMatchesRequest = (
  envelope: DownloadCapabilityEnvelope,
  materialized: MaterializedDownloadCandidateAbility
): void => {
  const descriptor = materialized.candidate_ability_descriptor;
  if (descriptor.ability_id !== envelope.input.ability_ref) {
    throw invalidDownloadCommandInput("CANDIDATE_ABILITY_REF_MISMATCH", envelope.input.ability_ref);
  }
  if (descriptor.ability_kind !== "download") {
    throw invalidDownloadCommandInput("CANDIDATE_ABILITY_KIND_MISMATCH", envelope.input.ability_ref);
  }
  if (!descriptor.execution_layer_support.includes(envelope.input.requested_execution_layer)) {
    throw invalidDownloadCommandInput(
      "CANDIDATE_EXECUTION_LAYER_UNSUPPORTED",
      envelope.input.ability_ref
    );
  }
};

const resolveRuntimeBridge = (): NativeMessagingBridge => {
  if (process.env.WEBENVOY_NATIVE_TRANSPORT === "loopback") {
    return new NativeMessagingBridge({
      transport: createLoopbackNativeBridgeTransport()
    });
  }

  return new NativeMessagingBridge({
    transport: new NativeHostBridgeTransport()
  });
};

const stripBrowserArtifactFromDownloadTarget = (
  target: DownloadBrowserTarget
): Omit<DownloadBrowserTarget, "browser_artifact"> => {
  const { browser_artifact: _browserArtifact, ...safeTarget } = target;
  return safeTarget;
};

const parseDownloadValidationBridgeParams = (
  params: JsonObject,
  requestKey: "ability_validation_request" | "ability_replay_request",
  commandName: "download.validate" | "download.replay"
): {
  bridgeParams: JsonObject;
  projectionSource: "download_result_summary" | "download_failure_reason";
} => {
  const seed = asObject(params.ability_validation_seed);
  const candidateDescriptor =
    params.candidate_ability_descriptor ?? seed?.candidate_ability_descriptor;
  const candidateRegistry =
    params.candidate_ability_contract_registry ?? seed?.candidate_ability_contract_registry;
  const request = params[requestKey] ?? seed?.[requestKey];
  if (!candidateDescriptor) {
    throw invalidDownloadCommandInput("CANDIDATE_ABILITY_DESCRIPTOR_MISSING", commandName);
  }
  if (!candidateRegistry) {
    throw invalidDownloadCommandInput("CANDIDATE_ABILITY_CONTRACT_REGISTRY_MISSING", commandName);
  }
  if (!request) {
    throw invalidDownloadCommandInput(`${requestKey.toUpperCase()}_MISSING`, commandName);
  }
  if (hasOwn(params, "execution_result")) {
    throw invalidDownloadCommandInput(
      "DOWNLOAD_VALIDATION_EXECUTION_RESULT_OVERRIDE_UNSUPPORTED",
      commandName
    );
  }
  const hasDownloadResultSummary = hasOwn(params, "download_result_summary");
  const hasDownloadFailureReason = hasOwn(params, "download_failure_reason");
  if (hasDownloadResultSummary === hasDownloadFailureReason) {
    throw invalidDownloadCommandInput(
      hasDownloadResultSummary
        ? "DOWNLOAD_VALIDATION_RESULT_AMBIGUOUS"
        : "DOWNLOAD_VALIDATION_RESULT_MISSING",
      commandName
    );
  }
  const downloadResultSummary = hasDownloadResultSummary
    ? parseDownloadResultSummaryForContract(params.download_result_summary, commandName)
    : undefined;
  const failureReason = hasDownloadFailureReason
    ? parseDownloadFailureReasonForContract(params.download_failure_reason, commandName)
    : undefined;
  return {
    bridgeParams: {
      candidate_ability_descriptor: candidateDescriptor,
      candidate_ability_contract_registry: candidateRegistry,
      [requestKey]: request,
      execution_result: buildDownloadValidationExecutionResultForContract({
        downloadResultSummary,
        failureReason
      })
    },
    projectionSource: hasDownloadResultSummary ? "download_result_summary" : "download_failure_reason"
  };
};

const downloadPrepare = async (context: RuntimeContext): Promise<JsonObject> => {
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

const downloadTrigger = async (context: RuntimeContext): Promise<JsonObject> => {
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

  let bridge: NativeMessagingBridge | null = null;
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

    const browserResult = parseDownloadBrowserExecutionResultForContract(
      bridgeResult.payload.download_browser_result ?? bridgeResult.payload,
      envelope.input.ability_ref
    );
    if (!browserResult.success) {
      const reason = parseDownloadFailureReasonForContract(
        browserResult.failure_reason,
        envelope.input.ability_ref
      );
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

    if (browserResult.download_target.browser_artifact) {
      const landed = await landBrowserDownloadArtifactForContract({
        cwd: context.cwd,
        runId: context.run_id,
        request: envelope.input,
        target: browserResult.download_target
      });
      const downloadResultSummary = buildDownloadLandedResultSummaryForContract({
        runId: context.run_id,
        target: browserResult.download_target,
        resolvedOutputPath: landed.resolvedOutputPath,
        savedArtifactRefs: landed.savedArtifactRefs,
        sizeBytes: landed.sizeBytes,
        checksumSha256: landed.checksumSha256,
        fileNameHint: landed.fileName
      });
      return {
        capability_result: {
          ability_id: envelope.ability.id,
          layer: envelope.ability.layer,
          action: "download",
          outcome: "success",
          data_ref: downloadResultSummary.download_ref,
          download_result_summary: downloadResultSummary
        },
        download_target: stripBrowserArtifactFromDownloadTarget(browserResult.download_target),
        trigger_audit: browserResult.trigger_audit,
        download_file_audit: landed.audit,
        ...materialized,
        ability_validation_seed: buildAbilityValidationSeedForDownloadRequest({
          request: envelope.input,
          materialized,
          validationExecutionBoundary: "seed_only_until_fr0021_750"
        }),
        relay_path: bridgeResult.relay_path,
        download_execution_boundary: "browser_target_trigger_and_cli_landing_fr0021_749",
        file_landing_boundary: "executed_in_fr0021_749",
        validation_execution_boundary: "seed_only_until_fr0021_750"
      };
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
      download_target: stripBrowserArtifactFromDownloadTarget(browserResult.download_target),
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
  } catch (error) {
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
  } finally {
    await bridge?.close().catch(() => undefined);
  }
};

const downloadValidate = async (context: RuntimeContext): Promise<JsonObject> => {
  const params = asObject(context.params);
  if (!params) {
    throw invalidDownloadCommandInput("PARAMS_INVALID");
  }
  const { bridgeParams, projectionSource } = parseDownloadValidationBridgeParams(
    params,
    "ability_validation_request",
    "download.validate"
  );
  const validationResult = await runAbilityValidationForContract(context, bridgeParams);
  return {
    ...validationResult,
    download_validation_projection: {
      source: projectionSource,
      execution_result: bridgeParams.execution_result
    },
    validation_execution_boundary: "executed_in_fr0021_750"
  };
};

const downloadReplay = async (context: RuntimeContext): Promise<JsonObject> => {
  const params = asObject(context.params);
  if (!params) {
    throw invalidDownloadCommandInput("PARAMS_INVALID");
  }
  const { bridgeParams, projectionSource } = parseDownloadValidationBridgeParams(
    params,
    "ability_replay_request",
    "download.replay"
  );
  const replayResult = await runAbilityReplayForContract(context, bridgeParams);
  return {
    ...replayResult,
    download_validation_projection: {
      source: projectionSource,
      execution_result: bridgeParams.execution_result
    },
    validation_execution_boundary: "executed_in_fr0021_750"
  };
};

export const downloadCommands = (): CommandDefinition[] => [
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
  },
  {
    name: "download.validate",
    status: "implemented",
    requiresProfile: false,
    handler: downloadValidate
  },
  {
    name: "download.replay",
    status: "implemented",
    requiresProfile: false,
    handler: downloadReplay
  }
];
