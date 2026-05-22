import { describe, expect, it } from "vitest";

import {
  buildCandidateAbilityInvocationForContract,
  parseCandidateAbilityDescriptorForContract,
  resolveCandidateAbilityContractsForContract,
  validateCandidateAbilityInvocationForContract,
  type CandidateAbilityDescriptor,
  type CandidateAbilityKind,
  type CandidateCaptureOrigin,
  type CandidateExecutionLayer
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
  captureOrigin?: CandidateCaptureOrigin;
  platformFamily?: string;
  extra?: JsonObject;
}): JsonObject => {
  const abilityId = input?.abilityId ?? "xhs.note.search.v1";
  return {
    ability_id: abilityId,
    display_name: "Search notes",
    ability_kind: input?.abilityKind ?? "read",
    entrypoint: abilityId.startsWith("generic.") ? "l2.first_usable" : "xhs.search",
    platform_scope: {
      platform_family: input?.platformFamily ?? "xiaohongshu",
      site_pattern: "https://www.xiaohongshu.com/*"
    },
    execution_layer_support: input?.layers ?? ["L3"],
    input_contract_ref: contractRef(abilityId, "input"),
    output_contract_ref: contractRef(abilityId, "output"),
    error_contract_ref: contractRef(abilityId, "error"),
    capture_origin: input?.captureOrigin ?? "l3_adapter_sample",
    candidate_status: "candidate_ready",
    capture_run_id: "run-fr0017-capture-001",
    capture_profile: "profile/xhs-account-001",
    captured_at: "2026-05-22T06:30:00.000Z",
    ...(input?.extra ?? {})
  };
};

const createRegistry = (descriptor: JsonObject, entries?: JsonObject[]): JsonObject => {
  const abilityId = descriptor.ability_id as string;
  return {
    ability_id: abilityId,
    entries:
      entries ??
      [
        {
          contract_ref: descriptor.input_contract_ref,
          contract_kind: "input",
          contract_body: {
            type: "object",
            required: ["query"]
          }
        },
        {
          contract_ref: descriptor.output_contract_ref,
          contract_kind: "output",
          contract_body: {
            type: "object",
            required: ["items"]
          }
        },
        {
          contract_ref: descriptor.error_contract_ref,
          contract_kind: "error",
          contract_body: {
            type: "object",
            required: ["reason"]
          }
        }
      ]
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

describe("candidate ability shell", () => {
  it("accepts an L3-shaped descriptor and resolves registry contracts", () => {
    const descriptorFixture = createDescriptor();
    const registryFixture = createRegistry(descriptorFixture);

    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorFixture);
    const resolved = resolveCandidateAbilityContractsForContract(descriptor, registryFixture);
    const invocation = buildCandidateAbilityInvocationForContract(
      descriptor,
      "L3",
      { query: "camping" },
      { timeout_ms: 30000 }
    );

    expect(descriptor).toMatchObject({
      ability_id: "xhs.note.search.v1",
      ability_kind: "read",
      execution_layer_support: ["L3"],
      capture_origin: "l3_adapter_sample"
    });
    expect(resolved.input.contract_ref).toBe(contractRef("xhs.note.search.v1", "input"));
    expect(resolved.output.contract_kind).toBe("output");
    expect(resolved.error.contract_body).toEqual({
      type: "object",
      required: ["reason"]
    });
    expect(invocation).toEqual({
      ability: {
        id: "xhs.note.search.v1",
        layer: "L3",
        action: "read"
      },
      input: { query: "camping" },
      options: { timeout_ms: 30000 }
    });
  });

  it("accepts an L2-shaped descriptor through the same model", () => {
    const descriptorFixture = createDescriptor({
      abilityId: "generic.page.read.v1",
      layers: ["L2"],
      captureOrigin: "l2_first_usable_sample",
      platformFamily: "generic_web",
      extra: {
        display_name: "Generic page read",
        seed_replay_input_ref: "replay_input_snapshot/generic-page-read/001"
      }
    });
    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorFixture);
    const registryFixture = createRegistry(descriptorFixture);
    const invocation = validateCandidateAbilityInvocationForContract(descriptor, {
      ability: {
        id: "generic.page.read.v1",
        layer: "L2",
        action: "read"
      },
      input: {
        url: "https://example.com"
      }
    });

    expect(resolveCandidateAbilityContractsForContract(descriptor, registryFixture)).toMatchObject({
      input: { contract_kind: "input" },
      output: { contract_kind: "output" },
      error: { contract_kind: "error" }
    });
    expect(descriptor.seed_replay_input_ref).toBe("replay_input_snapshot/generic-page-read/001");
    expect(descriptor).not.toHaveProperty("health_state");
    expect(descriptor).not.toHaveProperty("replay_validation");
    expect(invocation.ability).toEqual({
      id: "generic.page.read.v1",
      layer: "L2",
      action: "read"
    });
  });

  it("maps read, write, and download descriptors into FR-0007 invocation actions", () => {
    const cases: Array<{
      abilityId: string;
      abilityKind: CandidateAbilityKind;
      input: JsonObject;
    }> = [
      {
        abilityId: "xhs.note.search.v1",
        abilityKind: "read",
        input: { query: "camping" }
      },
      {
        abilityId: "xhs.editor.input.v1",
        abilityKind: "write",
        input: { text: "draft content" }
      },
      {
        abilityId: "generic.download.file.v1",
        abilityKind: "download",
        input: { href: "https://example.com/file.pdf" }
      }
    ];

    for (const item of cases) {
      const descriptor = parseCandidateAbilityDescriptorForContract(
        createDescriptor({
          abilityId: item.abilityId,
          abilityKind: item.abilityKind
        })
      );

      expect(
        buildCandidateAbilityInvocationForContract(descriptor, "L3", item.input).ability
      ).toEqual({
        id: item.abilityId,
        layer: "L3",
        action: item.abilityKind
      });
    }
  });

  it("rejects missing registry input", () => {
    const descriptor = parseCandidateAbilityDescriptorForContract(createDescriptor());

    expectInputError(
      () => resolveCandidateAbilityContractsForContract(descriptor, undefined),
      "xhs.note.search.v1",
      "CONTRACT_REGISTRY_MISSING"
    );
  });

  it("rejects unresolved registry contract refs", () => {
    const descriptorFixture = createDescriptor();
    const registryFixture = createRegistry(descriptorFixture, [
      {
        contract_ref: descriptorFixture.input_contract_ref,
        contract_kind: "input",
        contract_body: { type: "object" }
      },
      {
        contract_ref: descriptorFixture.error_contract_ref,
        contract_kind: "error",
        contract_body: { type: "object" }
      }
    ]);
    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorFixture);

    expectInputError(
      () => resolveCandidateAbilityContractsForContract(descriptor, registryFixture),
      "xhs.note.search.v1",
      "CONTRACT_REF_UNRESOLVED"
    );
  });

  it("rejects duplicate registry contract refs", () => {
    const descriptorFixture = createDescriptor();
    const registryFixture = createRegistry(descriptorFixture, [
      {
        contract_ref: descriptorFixture.input_contract_ref,
        contract_kind: "input",
        contract_body: { type: "object" }
      },
      {
        contract_ref: descriptorFixture.input_contract_ref,
        contract_kind: "input",
        contract_body: { type: "object" }
      }
    ]);
    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorFixture);

    expectInputError(
      () => resolveCandidateAbilityContractsForContract(descriptor, registryFixture),
      "xhs.note.search.v1",
      "CONTRACT_REF_DUPLICATE"
    );
  });

  it("rejects registry contract kind mismatch", () => {
    const descriptorFixture = createDescriptor();
    const registryFixture = createRegistry(descriptorFixture, [
      {
        contract_ref: descriptorFixture.input_contract_ref,
        contract_kind: "output",
        contract_body: { type: "object" }
      }
    ]);
    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorFixture);

    expectInputError(
      () => resolveCandidateAbilityContractsForContract(descriptor, registryFixture),
      "xhs.note.search.v1",
      "CONTRACT_KIND_MISMATCH"
    );
  });

  it("rejects registry owner mismatch", () => {
    const descriptorFixture = createDescriptor();
    const registryFixture = {
      ...createRegistry(descriptorFixture),
      ability_id: "generic.page.read.v1"
    };
    const descriptor = parseCandidateAbilityDescriptorForContract(descriptorFixture);

    expectInputError(
      () => resolveCandidateAbilityContractsForContract(descriptor, registryFixture),
      "xhs.note.search.v1",
      "CONTRACT_REGISTRY_OWNER_MISMATCH"
    );
  });

  it("rejects descriptor contract refs owned by another ability", () => {
    const descriptorFixture = createDescriptor({
      extra: {
        input_contract_ref: contractRef("generic.page.read.v1", "input")
      }
    });

    expectInputError(
      () => parseCandidateAbilityDescriptorForContract(descriptorFixture),
      "xhs.note.search.v1",
      "CONTRACT_REF_OWNER_MISMATCH"
    );
  });

  it("rejects invocation layers outside descriptor support", () => {
    const descriptor = parseCandidateAbilityDescriptorForContract(createDescriptor());

    expectInputError(
      () =>
        validateCandidateAbilityInvocationForContract(descriptor, {
          ability: {
            id: "xhs.note.search.v1",
            layer: "L2",
            action: "read"
          },
          input: { query: "camping" }
        }),
      "xhs.note.search.v1",
      "INVOCATION_LAYER_UNSUPPORTED"
    );
  });

  it("rejects invocation action mismatch", () => {
    const descriptor = parseCandidateAbilityDescriptorForContract(createDescriptor());

    expectInputError(
      () =>
        validateCandidateAbilityInvocationForContract(descriptor, {
          ability: {
            id: "xhs.note.search.v1",
            layer: "L3",
            action: "write"
          },
          input: { query: "camping" }
        }),
      "xhs.note.search.v1",
      "INVOCATION_ACTION_MISMATCH"
    );
  });

  it("rejects invocation ability id mismatch", () => {
    const descriptor = parseCandidateAbilityDescriptorForContract(createDescriptor());

    expectInputError(
      () =>
        validateCandidateAbilityInvocationForContract(descriptor, {
          ability: {
            id: "xhs.note.detail.v1",
            layer: "L3",
            action: "read"
          },
          input: { query: "camping" }
        }),
      "xhs.note.search.v1",
      "INVOCATION_ABILITY_ID_MISMATCH"
    );
  });

  it("rejects capture origins that do not match supported execution layers", () => {
    expectInputError(
      () =>
        parseCandidateAbilityDescriptorForContract(
          createDescriptor({
            layers: ["L2"],
            captureOrigin: "l3_adapter_sample"
          })
        ),
      "xhs.note.search.v1",
      "CAPTURE_ORIGIN_LAYER_UNSUPPORTED"
    );
  });
});
