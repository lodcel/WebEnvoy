import { CliError } from "../core/errors.js";
import {
  buildAbilityValidationSeedForDownloadRequest,
  buildDownloadPrepareResultSummaryForContract,
  materializeCandidateAbilityFromDownloadSeedForContract,
  parseDownloadCapabilityEnvelopeForContract,
  parseDownloadResultSummaryForContract,
  type DownloadCapabilityEnvelope,
  type MaterializedDownloadCandidateAbility
} from "../core/download-ability.js";
import type { CommandDefinition, JsonObject, RuntimeContext } from "../core/types.js";

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

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
  projectedSummary: unknown;
} => {
  const envelope = parseDownloadCapabilityEnvelopeForContract(value);
  if (!Object.prototype.hasOwnProperty.call(value, "candidate_shell_seed")) {
    throw invalidDownloadCommandInput("CANDIDATE_SHELL_SEED_MISSING", envelope.input.ability_ref);
  }
  return {
    envelope,
    candidateSeed: value.candidate_shell_seed,
    projectedSummary: value.download_result_summary
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

const downloadPrepare = async (context: RuntimeContext): Promise<JsonObject> => {
  const params = asObject(context.params);
  if (!params) {
    throw invalidDownloadCommandInput("PARAMS_INVALID");
  }

  const { envelope, candidateSeed, projectedSummary } = parseParams(params);
  if (context.profile !== envelope.input.profile_ref) {
    throw invalidDownloadCommandInput("PROFILE_MISMATCH", envelope.input.ability_ref);
  }
  const materialized = materializeCandidateAbilityFromDownloadSeedForContract(candidateSeed);
  assertCandidateMatchesRequest(envelope, materialized);

  const downloadResultSummary =
    projectedSummary === undefined
      ? buildDownloadPrepareResultSummaryForContract({
          runId: context.run_id,
          request: envelope.input
        })
      : parseDownloadResultSummaryForContract(projectedSummary, envelope.input.ability_ref);
  const outcome =
    downloadResultSummary.result_state === "downloaded" ? "success" : "partial";

  return {
    capability_result: {
      ability_id: envelope.ability.id,
      layer: envelope.ability.layer,
      action: "download",
      outcome,
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

export const downloadCommands = (): CommandDefinition[] => [
  {
    name: "download.prepare",
    status: "implemented",
    requiresProfile: true,
    handler: downloadPrepare
  }
];
