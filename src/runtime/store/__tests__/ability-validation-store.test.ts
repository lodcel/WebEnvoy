import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildLatestValidationForContract,
  buildReplayInputSnapshotRefForContract
} from "../../../core/ability-validation.js";
import type { CandidateAbilityDescriptor } from "../../../core/candidate-ability.js";
import {
  resolveRuntimeStorePath,
  SQLiteRuntimeStore
} from "../sqlite-runtime-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

const createStore = async (): Promise<{ cwd: string; store: SQLiteRuntimeStore }> => {
  const cwd = await mkdtemp(join(tmpdir(), "webenvoy-ability-validation-store-"));
  tempDirs.push(cwd);
  return {
    cwd,
    store: new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd))
  };
};

const contractRef = (
  abilityId: string,
  kind: "input" | "output" | "error"
): string => `cad::${abilityId}::${kind}::v1`;

const descriptor: CandidateAbilityDescriptor = {
  ability_id: "generic.page.read.v1",
  display_name: "Generic page read",
  ability_kind: "read",
  entrypoint: "l2.first_usable",
  platform_scope: {
    platform_family: "generic_web"
  },
  execution_layer_support: ["L2", "L3"],
  input_contract_ref: contractRef("generic.page.read.v1", "input"),
  output_contract_ref: contractRef("generic.page.read.v1", "output"),
  error_contract_ref: contractRef("generic.page.read.v1", "error"),
  capture_origin: "l2_first_usable_sample",
  candidate_status: "candidate_ready",
  capture_run_id: "run-capture",
  capture_profile: "profile/default",
  captured_at: "2026-05-22T00:00:00.000Z"
};

describe("ability validation runtime store", () => {
  it("persists per-mode latest records by ability/profile/layer scope", async () => {
    const { store } = await createStore();
    try {
      const smoke = buildLatestValidationForContract({
        descriptor,
        profileRef: "profile/default",
        validationMode: "smoke_validation",
        resultState: "verified",
        runId: "run-smoke",
        validatedAt: "2026-05-23T00:00:00.000Z",
        validatedExecutionLayer: "L2"
      });
      const replay = buildLatestValidationForContract({
        descriptor,
        profileRef: "profile/default",
        validationMode: "replay_validation",
        resultState: "broken",
        failureClass: "page_changed",
        runId: "run-replay",
        validatedAt: "2026-05-23T00:10:00.000Z",
        validatedExecutionLayer: "L2"
      });

      await store.upsertAbilityLatestValidation({
        abilityRef: descriptor.ability_id,
        profileRef: "profile/default",
        executionLayer: "L2",
        latestValidation: smoke
      });
      await store.upsertAbilityLatestValidation({
        abilityRef: descriptor.ability_id,
        profileRef: "profile/default",
        executionLayer: "L2",
        latestValidation: replay
      });
      await store.upsertAbilityLatestValidation({
        abilityRef: descriptor.ability_id,
        profileRef: "profile/other",
        executionLayer: "L2",
        latestValidation: {
          ...smoke,
          baseline_descriptor: {
            ...smoke.baseline_descriptor,
            profile_ref: "profile/other"
          },
          run_id: "run-other"
        }
      });

      expect(
        await store.listAbilityLatestValidations({
          abilityRef: descriptor.ability_id,
          profileRef: "profile/default",
          executionLayer: "L2"
        })
      ).toEqual([
        expect.objectContaining({ validation_mode: "smoke_validation", run_id: "run-smoke" }),
        expect.objectContaining({ validation_mode: "replay_validation", run_id: "run-replay" })
      ]);
      expect(
        await store.listAbilityLatestValidations({
          abilityRef: descriptor.ability_id,
          profileRef: "profile/other",
          executionLayer: "L2"
        })
      ).toEqual([
        expect.objectContaining({ validation_mode: "smoke_validation", run_id: "run-other" })
      ]);
    } finally {
      store.close();
    }
  });

  it("persists replay snapshots with stable replay-store payload locators", async () => {
    const { store } = await createStore();
    try {
      const snapshot = buildReplayInputSnapshotRefForContract({
        snapshotRef: "snapshot/001",
        abilityRef: descriptor.ability_id,
        profileRef: "profile/default",
        executionLayer: "L2",
        capturedInputContractRef: descriptor.input_contract_ref,
        sourceRunId: "run-smoke",
        capturedAt: "2026-05-23T00:00:00.000Z"
      });

      const inserted = await store.insertAbilityReplayInputSnapshot({
        snapshot,
        inputPayload: {
          url: "https://example.com"
        }
      });
      expect(inserted).toMatchObject({
        snapshot_ref: "snapshot/001",
        payload_locator: "replay-store://input-snapshot/snapshot%2F001",
        input_payload: {
          url: "https://example.com"
        }
      });
      expect(await store.getAbilityReplayInputSnapshot("snapshot/001")).toMatchObject({
        snapshot_ref: "snapshot/001",
        input_payload: {
          url: "https://example.com"
        }
      });
      expect(
        await store.getLatestAbilityReplayInputSnapshot({
          abilityRef: descriptor.ability_id,
          profileRef: "profile/default",
          executionLayer: "L2",
          capturedInputContractRef: descriptor.input_contract_ref
        })
      ).toMatchObject({
        snapshot_ref: "snapshot/001"
      });
      expect(
        await store.getLatestAbilityReplayInputSnapshot({
          abilityRef: descriptor.ability_id,
          profileRef: "profile/default",
          executionLayer: "L3",
          capturedInputContractRef: descriptor.input_contract_ref
        })
      ).toBeNull();
    } finally {
      store.close();
    }
  });
});
