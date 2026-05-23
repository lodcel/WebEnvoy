import { createHash } from "node:crypto";

import {
  buildAbilityHealthViewForContract,
  buildAbilityInvocationForValidationContract,
  buildLatestValidationForContract,
  buildReplayInputSnapshotRefForContract,
  cloneReplayInputPayloadForContract,
  parseAbilityFailureClassForContract,
  parseAbilityReplayRequestForContract,
  parseAbilityValidationRequestForContract,
  assertReplayInputSnapshotMatchesScopeForContract,
  type AbilityFailureClass,
  type AbilityValidationResultState
} from "../core/ability-validation.js";
import {
  parseCandidateAbilityDescriptorForContract,
  resolveCandidateAbilityContractsForContract,
  type CandidateAbilityDescriptor
} from "../core/candidate-ability.js";
import { CliError } from "../core/errors.js";
import type { CommandDefinition, JsonObject, RuntimeContext } from "../core/types.js";
import {
  resolveRuntimeStorePath,
  SQLiteRuntimeStore,
  type AbilityReplayInputSnapshotRecord
} from "../runtime/store/sqlite-runtime-store.js";

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const invalidAbilityCommandInput = (reason: string, abilityId = "unknown"): CliError =>
  new CliError("ERR_CLI_INVALID_ARGS", "Ability command input invalid", {
    details: {
      ability_id: abilityId,
      stage: "input_validation",
      reason
    }
  });

const parseWrapperParams = (
  params: JsonObject,
  requestKey: "ability_validation_request" | "ability_replay_request"
): {
  descriptor: CandidateAbilityDescriptor;
  registry: unknown;
  request: unknown;
  executionResult: unknown;
} => {
  const descriptor = parseCandidateAbilityDescriptorForContract(
    params.candidate_ability_descriptor
  );
  if (!params.candidate_ability_contract_registry) {
    throw invalidAbilityCommandInput("CANDIDATE_ABILITY_CONTRACT_REGISTRY_MISSING", descriptor.ability_id);
  }
  if (!params[requestKey]) {
    throw invalidAbilityCommandInput(`${requestKey.toUpperCase()}_MISSING`, descriptor.ability_id);
  }
  return {
    descriptor,
    registry: params.candidate_ability_contract_registry,
    request: params[requestKey],
    executionResult: params.execution_result
  };
};

const parseExecutionResult = (
  value: unknown,
  abilityId: string
): {
  resultState: AbilityValidationResultState;
  failureClass: AbilityFailureClass | null;
  artifactRefs: string[];
} => {
  const result = asObject(value);
  if (!result) {
    throw invalidAbilityCommandInput("EXECUTION_RESULT_MISSING", abilityId);
  }
  const rawResultState = result.result_state;
  const resultState =
    rawResultState === "verified"
      ? "verified"
      : rawResultState === "broken"
        ? "broken"
        : null;
  if (!resultState) {
    throw invalidAbilityCommandInput("EXECUTION_RESULT_STATE_INVALID", abilityId);
  }
  const failureClass =
    resultState === "broken"
      ? parseAbilityFailureClassForContract(result.failure_class, abilityId)
      : null;
  if (resultState === "verified" && result.failure_class !== undefined) {
    throw invalidAbilityCommandInput("EXECUTION_FAILURE_CLASS_UNEXPECTED", abilityId);
  }
  const artifactRefs = result.artifact_refs;
  if (artifactRefs === undefined) {
    return {
      resultState,
      failureClass,
      artifactRefs: []
    };
  }
  if (
    !Array.isArray(artifactRefs) ||
    !artifactRefs.every((item) => typeof item === "string" && item.trim().length > 0)
  ) {
    throw invalidAbilityCommandInput("EXECUTION_ARTIFACT_REFS_INVALID", abilityId);
  }
  return {
    resultState,
    failureClass,
    artifactRefs: artifactRefs.map((item) => item.trim())
  };
};

const snapshotRefForInput = (input: {
  abilityRef: string;
  profileRef: string;
  executionLayer: string;
  runId: string;
  mode: "smoke" | "replay";
  payload: JsonObject;
}): string => {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        ability_ref: input.abilityRef,
        profile_ref: input.profileRef,
        execution_layer: input.executionLayer,
        run_id: input.runId,
        mode: input.mode,
        payload: input.payload
      })
    )
    .digest("hex")
    .slice(0, 16);
  return `replay_input_snapshot/${input.abilityRef}/${input.profileRef}/${input.executionLayer}/${input.runId}/${input.mode}/${hash}`;
};

const snapshotRecordToRef = (
  record: AbilityReplayInputSnapshotRecord
): Parameters<typeof assertReplayInputSnapshotMatchesScopeForContract>[1] => ({
  snapshot_ref: record.snapshot_ref,
  ability_ref: record.ability_ref,
  profile_ref: record.profile_ref,
  execution_layer: record.execution_layer,
  captured_input_contract_ref: record.captured_input_contract_ref,
  source_run_id: record.source_run_id,
  payload_locator: record.payload_locator,
  captured_at: record.captured_at
});

const buildHealthView = async (input: {
  store: SQLiteRuntimeStore;
  descriptor: CandidateAbilityDescriptor;
  profileRef: string;
  executionLayer: CandidateAbilityDescriptor["execution_layer_support"][number];
}) => {
  const latestValidations = await input.store.listAbilityLatestValidations({
    abilityRef: input.descriptor.ability_id,
    profileRef: input.profileRef,
    executionLayer: input.executionLayer
  });
  const latestSnapshot = await input.store.getLatestAbilityReplayInputSnapshot({
    abilityRef: input.descriptor.ability_id,
    profileRef: input.profileRef,
    executionLayer: input.executionLayer,
    capturedInputContractRef: input.descriptor.input_contract_ref
  });
  return buildAbilityHealthViewForContract({
    descriptor: input.descriptor,
    profileRef: input.profileRef,
    executionLayer: input.executionLayer,
    latestValidations,
    lastSuccessInputRef: latestSnapshot?.snapshot_ref ?? null
  });
};

const abilityValidate = async (context: RuntimeContext): Promise<JsonObject> => {
  const wrapper = parseWrapperParams(context.params, "ability_validation_request");
  resolveCandidateAbilityContractsForContract(wrapper.descriptor, wrapper.registry);
  const request = parseAbilityValidationRequestForContract(
    wrapper.descriptor,
    wrapper.request
  );
  const invocation = buildAbilityInvocationForValidationContract({
    descriptor: wrapper.descriptor,
    executionLayer: request.requested_execution_layer,
    invocationInput: request.smoke_input
  });
  const executionResult = parseExecutionResult(wrapper.executionResult, wrapper.descriptor.ability_id);
  const validatedAt = new Date().toISOString();
  let store: SQLiteRuntimeStore | null = null;
  try {
    store = new SQLiteRuntimeStore(resolveRuntimeStorePath(context.cwd));
    if (executionResult.resultState === "verified") {
      const snapshot = buildReplayInputSnapshotRefForContract({
        snapshotRef: snapshotRefForInput({
          abilityRef: request.ability_ref,
          profileRef: request.profile_ref,
          executionLayer: request.requested_execution_layer,
          runId: context.run_id,
          mode: "smoke",
          payload: request.smoke_input
        }),
        abilityRef: request.ability_ref,
        profileRef: request.profile_ref,
        executionLayer: request.requested_execution_layer,
        capturedInputContractRef: wrapper.descriptor.input_contract_ref,
        sourceRunId: context.run_id,
        capturedAt: validatedAt
      });
      await store.insertAbilityReplayInputSnapshot({
        snapshot,
        inputPayload: request.smoke_input
      });
    }
    const latest = buildLatestValidationForContract({
      descriptor: wrapper.descriptor,
      profileRef: request.profile_ref,
      validationMode: "smoke_validation",
      resultState: executionResult.resultState === "verified" ? "verified" : "broken",
      failureClass: executionResult.failureClass,
      runId: context.run_id,
      validatedAt,
      validatedExecutionLayer: request.requested_execution_layer,
      artifactRefs: executionResult.artifactRefs
    });
    await store.upsertAbilityLatestValidation({
      abilityRef: request.ability_ref,
      profileRef: request.profile_ref,
      executionLayer: request.requested_execution_layer,
      latestValidation: latest
    });
    const healthView = await buildHealthView({
      store,
      descriptor: wrapper.descriptor,
      profileRef: request.profile_ref,
      executionLayer: request.requested_execution_layer
    });
    return {
      ability_health_view: healthView,
      validation_request: request,
      candidate_ability_invocation: invocation
    };
  } finally {
    store?.close();
  }
};

const abilityReplay = async (context: RuntimeContext): Promise<JsonObject> => {
  const wrapper = parseWrapperParams(context.params, "ability_replay_request");
  resolveCandidateAbilityContractsForContract(wrapper.descriptor, wrapper.registry);
  const request = parseAbilityReplayRequestForContract(wrapper.descriptor, wrapper.request);
  const executionResult = parseExecutionResult(wrapper.executionResult, wrapper.descriptor.ability_id);
  const validatedAt = new Date().toISOString();
  let store: SQLiteRuntimeStore | null = null;
  try {
    store = new SQLiteRuntimeStore(resolveRuntimeStorePath(context.cwd));
    const sourceSnapshot =
      request.replay_source === "explicit_input_snapshot"
        ? await store.getAbilityReplayInputSnapshot(request.replay_input_ref)
        : await store.getLatestAbilityReplayInputSnapshot({
            abilityRef: request.ability_ref,
            profileRef: request.profile_ref,
            executionLayer: request.requested_execution_layer,
            capturedInputContractRef: wrapper.descriptor.input_contract_ref
          });
    const snapshotRef = assertReplayInputSnapshotMatchesScopeForContract(
      wrapper.descriptor,
      sourceSnapshot ? snapshotRecordToRef(sourceSnapshot) : null,
      {
        profileRef: request.profile_ref,
        executionLayer: request.requested_execution_layer
      }
    );
    const replayInput = cloneReplayInputPayloadForContract(
      sourceSnapshot?.input_payload,
      wrapper.descriptor.ability_id
    );
    const invocation = buildAbilityInvocationForValidationContract({
      descriptor: wrapper.descriptor,
      executionLayer: request.requested_execution_layer,
      invocationInput: replayInput
    });
    if (executionResult.resultState === "verified") {
      const refreshedSnapshot = buildReplayInputSnapshotRefForContract({
        snapshotRef: snapshotRefForInput({
          abilityRef: request.ability_ref,
          profileRef: request.profile_ref,
          executionLayer: request.requested_execution_layer,
          runId: context.run_id,
          mode: "replay",
          payload: replayInput
        }),
        abilityRef: request.ability_ref,
        profileRef: request.profile_ref,
        executionLayer: request.requested_execution_layer,
        capturedInputContractRef: wrapper.descriptor.input_contract_ref,
        sourceRunId: context.run_id,
        capturedAt: validatedAt
      });
      await store.insertAbilityReplayInputSnapshot({
        snapshot: refreshedSnapshot,
        inputPayload: replayInput
      });
    }
    const latest = buildLatestValidationForContract({
      descriptor: wrapper.descriptor,
      profileRef: request.profile_ref,
      validationMode: "replay_validation",
      resultState: executionResult.resultState === "verified" ? "verified" : "broken",
      failureClass: executionResult.failureClass,
      runId: context.run_id,
      validatedAt,
      validatedExecutionLayer: request.requested_execution_layer,
      artifactRefs: executionResult.artifactRefs
    });
    await store.upsertAbilityLatestValidation({
      abilityRef: request.ability_ref,
      profileRef: request.profile_ref,
      executionLayer: request.requested_execution_layer,
      latestValidation: latest
    });
    const healthView = await buildHealthView({
      store,
      descriptor: wrapper.descriptor,
      profileRef: request.profile_ref,
      executionLayer: request.requested_execution_layer
    });
    return {
      ability_health_view: healthView,
      replay_request: request,
      replay_input_ref: snapshotRef.snapshot_ref,
      candidate_ability_invocation: invocation
    };
  } finally {
    store?.close();
  }
};

export const abilityCommands = (): CommandDefinition[] => [
  {
    name: "ability.validate",
    status: "implemented",
    handler: abilityValidate
  },
  {
    name: "ability.replay",
    status: "implemented",
    handler: abilityReplay
  }
];
