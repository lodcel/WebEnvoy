import { describe, expect, it } from "vitest";

import {
  buildAbilityHealthViewForContract,
  buildLatestValidationForContract,
  buildReplayInputSnapshotRefForContract,
  parseAbilityReplayRequestForContract,
  parseAbilityValidationRequestForContract,
  assertReplayInputSnapshotMatchesScopeForContract
} from "../ability-validation.js";
import type {
  CandidateAbilityDescriptor,
  CandidateAbilityKind,
  CandidateExecutionLayer
} from "../candidate-ability.js";
import type { JsonObject } from "../types.js";

const contractRef = (
  abilityId: string,
  kind: "input" | "output" | "error",
  major = 1
): string => `cad::${abilityId}::${kind}::v${major}`;

const createDescriptor = (input?: {
  abilityId?: string;
  abilityKind?: CandidateAbilityKind;
  layers?: CandidateExecutionLayer[];
  inputContractRef?: string;
}): CandidateAbilityDescriptor => {
  const abilityId = input?.abilityId ?? "generic.page.read.v1";
  return {
    ability_id: abilityId,
    display_name: "Generic page read",
    ability_kind: input?.abilityKind ?? "read",
    entrypoint: "l2.first_usable",
    platform_scope: {
      platform_family: "generic_web",
      site_pattern: "https://example.com/*"
    },
    execution_layer_support: input?.layers ?? ["L2"],
    input_contract_ref: input?.inputContractRef ?? contractRef(abilityId, "input"),
    output_contract_ref: contractRef(abilityId, "output"),
    error_contract_ref: contractRef(abilityId, "error"),
    capture_origin: "l2_first_usable_sample",
    candidate_status: "candidate_ready",
    capture_run_id: "run-capture-001",
    capture_profile: "profile/default",
    captured_at: "2026-05-22T06:30:00.000Z"
  };
};

const expectInputError = (
  callback: () => unknown,
  abilityId: string,
  reason: string
): void => {
  try {
    callback();
    throw new Error("expected callback to throw");
  } catch (error) {
    expect(error).toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: {
        ability_id: abilityId,
        stage: "input_validation",
        reason
      }
    });
  }
};

const validationRequest = (overrides: JsonObject = {}): JsonObject => ({
  ability_ref: "generic.page.read.v1",
  validation_mode: "smoke_validation",
  profile_ref: "profile/default",
  requested_execution_layer: "L2",
  expected_capability_kind: "read",
  smoke_input: {
    url: "https://example.com"
  },
  ...overrides
});

describe("ability validation contract", () => {
  it("accepts smoke validation for read and download descriptors", () => {
    const readDescriptor = createDescriptor();
    const downloadDescriptor = createDescriptor({
      abilityId: "generic.file.download.v1",
      abilityKind: "download"
    });

    expect(
      parseAbilityValidationRequestForContract(readDescriptor, validationRequest())
    ).toMatchObject({
      ability_ref: "generic.page.read.v1",
      requested_execution_layer: "L2",
      expected_capability_kind: "read"
    });
    expect(
      parseAbilityValidationRequestForContract(
        downloadDescriptor,
        validationRequest({
          ability_ref: "generic.file.download.v1",
          expected_capability_kind: "download"
        })
      ).expected_capability_kind
    ).toBe("download");
  });

  it("rejects kind mismatches, unsupported layers, and write trust paths", () => {
    const descriptor = createDescriptor();
    expectInputError(
      () =>
        parseAbilityValidationRequestForContract(
          descriptor,
          validationRequest({ expected_capability_kind: "download" })
        ),
      "generic.page.read.v1",
      "EXPECTED_CAPABILITY_KIND_MISMATCH"
    );
    expectInputError(
      () =>
        parseAbilityValidationRequestForContract(
          descriptor,
          validationRequest({ requested_execution_layer: "L3" })
        ),
      "generic.page.read.v1",
      "REQUESTED_EXECUTION_LAYER_UNSUPPORTED"
    );
    expectInputError(
      () =>
        parseAbilityValidationRequestForContract(
          createDescriptor({ abilityId: "generic.form.write.v1", abilityKind: "write" }),
          validationRequest({
            ability_ref: "generic.form.write.v1",
            expected_capability_kind: "write"
          })
        ),
      "generic.form.write.v1",
      "ABILITY_KIND_NOT_IN_TRUST_DOMAIN"
    );
  });

  it("resolves replay request sources without crossing profile/layer boundaries", () => {
    const descriptor = createDescriptor();
    expect(
      parseAbilityReplayRequestForContract(descriptor, {
        ability_ref: "generic.page.read.v1",
        profile_ref: "profile/default",
        requested_execution_layer: "L2",
        expected_capability_kind: "read",
        replay_source: "last_success_input",
        replay_reason: "manual_check"
      })
    ).toMatchObject({
      replay_source: "last_success_input"
    });
    expect(
      parseAbilityReplayRequestForContract(descriptor, {
        ability_ref: "generic.page.read.v1",
        profile_ref: "profile/default",
        requested_execution_layer: "L2",
        expected_capability_kind: "read",
        replay_source: "explicit_input_snapshot",
        replay_input_ref: "snapshot/001",
        replay_reason: "manual_check"
      })
    ).toMatchObject({
      replay_source: "explicit_input_snapshot",
      replay_input_ref: "snapshot/001"
    });
  });

  it("computes health and coverage states from mode latest records", () => {
    const descriptor = createDescriptor();
    const smoke = buildLatestValidationForContract({
      descriptor,
      profileRef: "profile/default",
      validationMode: "smoke_validation",
      resultState: "verified",
      runId: "run-smoke",
      validatedAt: "2026-05-23T00:00:00.000Z",
      validatedExecutionLayer: "L2"
    });
    const replayBroken = buildLatestValidationForContract({
      descriptor,
      profileRef: "profile/default",
      validationMode: "replay_validation",
      resultState: "broken",
      failureClass: "page_changed",
      runId: "run-replay",
      validatedAt: "2026-05-23T00:10:00.000Z",
      validatedExecutionLayer: "L2"
    });

    expect(
      buildAbilityHealthViewForContract({
        descriptor,
        profileRef: "profile/default",
        executionLayer: "L2",
        latestValidations: [],
        now: new Date("2026-05-23T01:00:00.000Z")
      })
    ).toMatchObject({
      health_state: "unknown",
      validation_coverage_state: "none"
    });
    expect(
      buildAbilityHealthViewForContract({
        descriptor,
        profileRef: "profile/default",
        executionLayer: "L2",
        latestValidations: [smoke],
        lastSuccessInputRef: "snapshot/smoke",
        now: new Date("2026-05-23T01:00:00.000Z")
      })
    ).toMatchObject({
      health_state: "healthy",
      validation_coverage_state: "smoke_only",
      last_success_input_ref: "snapshot/smoke"
    });
    expect(
      buildAbilityHealthViewForContract({
        descriptor,
        profileRef: "profile/default",
        executionLayer: "L2",
        latestValidations: [smoke, replayBroken],
        now: new Date("2026-05-23T01:00:00.000Z")
      })
    ).toMatchObject({
      health_state: "degraded",
      validation_coverage_state: "divergent",
      divergence_reason: "smoke_replay_mismatch"
    });
  });

  it("marks latest records stale on freshness or relevant descriptor drift only", () => {
    const descriptor = createDescriptor({ layers: ["L2"] });
    const smoke = buildLatestValidationForContract({
      descriptor,
      profileRef: "profile/default",
      validationMode: "smoke_validation",
      resultState: "verified",
      runId: "run-smoke",
      validatedAt: "2026-05-20T00:00:00.000Z",
      validatedExecutionLayer: "L2"
    });

    expect(
      buildAbilityHealthViewForContract({
        descriptor: createDescriptor({ layers: ["L2", "L3"] }),
        profileRef: "profile/default",
        executionLayer: "L2",
        latestValidations: [smoke],
        now: new Date("2026-05-23T00:00:00.000Z")
      })
    ).toMatchObject({
      health_state: "healthy",
      validation_coverage_state: "smoke_only"
    });
    expect(
      buildAbilityHealthViewForContract({
        descriptor,
        profileRef: "profile/default",
        executionLayer: "L2",
        latestValidations: [smoke],
        now: new Date("2026-05-28T00:00:01.000Z")
      })
    ).toMatchObject({
      health_state: "stale",
      validation_coverage_state: "none",
      latest_validations: [expect.objectContaining({ result_state: "stale" })]
    });
    expectInputError(
      () =>
        buildAbilityHealthViewForContract({
          descriptor: createDescriptor({ layers: ["L3"], abilityId: "generic.page.read.v1" }),
          profileRef: "profile/default",
          executionLayer: "L2",
          latestValidations: [smoke]
        }),
      "generic.page.read.v1",
      "CAPTURE_ORIGIN_LAYER_UNSUPPORTED"
    );
  });

  it("rejects replay snapshots that do not match owner, profile, layer, or input contract", () => {
    const descriptor = createDescriptor();
    const snapshot = buildReplayInputSnapshotRefForContract({
      snapshotRef: "snapshot/001",
      abilityRef: "generic.page.read.v1",
      profileRef: "profile/default",
      executionLayer: "L2",
      capturedInputContractRef: contractRef("generic.page.read.v1", "input"),
      sourceRunId: "run-smoke",
      capturedAt: "2026-05-23T00:00:00.000Z"
    });

    expect(
      assertReplayInputSnapshotMatchesScopeForContract(descriptor, snapshot, {
        profileRef: "profile/default",
        executionLayer: "L2"
      })
    ).toBe(snapshot);
    expectInputError(
      () =>
        assertReplayInputSnapshotMatchesScopeForContract(descriptor, {
          ...snapshot,
          profile_ref: "profile/other"
        }, {
          profileRef: "profile/default",
          executionLayer: "L2"
        }),
      "generic.page.read.v1",
      "REPLAY_INPUT_SNAPSHOT_PROFILE_MISMATCH"
    );
    expectInputError(
      () =>
        assertReplayInputSnapshotMatchesScopeForContract(
          createDescriptor({ inputContractRef: contractRef("generic.page.read.v1", "input", 2) }),
          snapshot,
          {
            profileRef: "profile/default",
            executionLayer: "L2"
          }
        ),
      "generic.page.read.v1",
      "REPLAY_INPUT_SNAPSHOT_CONTRACT_MISMATCH"
    );
  });
});
