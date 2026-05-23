import { describe, expect, it } from "vitest";

import { CliError } from "../errors.js";
import {
  buildAbilityValidationSeedForL2Result,
  buildL2RequiresL1FallbackResultForContract,
  buildL2RiskGateBlockedResultForContract,
  materializeCandidateAbilityFromL2SeedForContract,
  parseL2FirstUsableRequestForContract,
  parseL2FirstUsableResultForContract
} from "../l2-first-usable.js";

const contractRef = (
  abilityId: string,
  kind: "input" | "output" | "error"
): string => `cad::${abilityId}::${kind}::v1`;

const requestInput = () => ({
  target_url: "https://example.com/articles/l2",
  goal_kind: "read",
  interaction_safety_class: "pure_read",
  goal_hint: "Read the visible article summary",
  risk_gate_context: {
    run_id: "run-l2-core-001",
    profile: "profile/default",
    target_domain: "example.com",
    target_tab_id: 7,
    target_page: "article",
    risk_state: "limited"
  },
  allowed_actions: ["navigate", "locate", "extract", "wait_settled"]
});

const successResultInput = () => {
  const abilityId = "generic.example_com.articles_l2.read.v1";
  return {
    success: true,
    result_summary: {
      page_url: "https://example.com/articles/l2",
      title: "L2 Article",
      text_excerpt: "Visible article text",
      structure: {
        headings: [{ ref: "h1:1", text: "L2 Article" }],
        links: [],
        buttons: []
      }
    },
    first_usable_trace: [
      {
        step_id: "step-1",
        action: "locate",
        target_hint: "article",
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
      source: "unit_fixture",
      allowed_actions: ["navigate", "locate", "extract", "wait_settled"]
    },
    candidate_shell_seed: {
      ability_id: abilityId,
      display_name: "Generic read example.com",
      ability_kind: "read",
      entrypoint: "l2.first_usable",
      platform_scope: {
        platform_family: "generic_web",
        site_pattern: "example.com"
      },
      execution_layer_support: ["L2"],
      input_contract_ref: contractRef(abilityId, "input"),
      output_contract_ref: contractRef(abilityId, "output"),
      error_contract_ref: contractRef(abilityId, "error"),
      capture_origin: "l2_first_usable_sample",
      capture_run_id: "run-l2-core-001",
      capture_profile: "profile/default",
      capture_artifact_refs: ["l2-first-usable://run-l2-core-001"],
      captured_at: "2026-05-23T00:00:00.000Z",
      candidate_status: "draft_candidate",
      contract_registry_seed: {
        ability_id: abilityId,
        entries: [
          {
            contract_ref: contractRef(abilityId, "input"),
            contract_kind: "input",
            contract_body: {
              type: "object",
              required: ["target_url", "goal_kind", "risk_gate_context", "allowed_actions"]
            }
          },
          {
            contract_ref: contractRef(abilityId, "output"),
            contract_kind: "output",
            contract_body: {
              type: "object",
              required: ["page_url", "title", "text_excerpt", "structure"]
            }
          },
          {
            contract_ref: contractRef(abilityId, "error"),
            contract_kind: "error",
            contract_body: {
              type: "object",
              required: ["failure_class"]
            }
          }
        ]
      }
    }
  };
};

const expectInvalidReason = (run: () => unknown, reason: string) => {
  expect(run).toThrowError(CliError);
  try {
    run();
  } catch (error) {
    expect((error as CliError).details).toMatchObject({ reason });
  }
};

describe("l2 first usable contract", () => {
  it("accepts limited read-only requests and materializes candidate ability handoff", () => {
    const request = parseL2FirstUsableRequestForContract(requestInput(), {
      profile: "profile/default",
      runId: "run-l2-core-001"
    });
    expect(request.risk_gate_context.risk_state).toBe("limited");
    expect(request.allowed_actions).toContain("extract");

    const result = parseL2FirstUsableResultForContract(successResultInput(), request);
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected L2 success");
    }
    expect(result.interaction_trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "extract",
          interaction_semantics: "neutral"
        })
      ])
    );

    const materialized = materializeCandidateAbilityFromL2SeedForContract(
      result.candidate_shell_seed
    );
    expect(materialized.candidate_ability_descriptor).toMatchObject({
      ability_id: "generic.example_com.articles_l2.read.v1",
      ability_kind: "read",
      entrypoint: "l2.first_usable",
      execution_layer_support: ["L2"]
    });
    expect(materialized.candidate_ability_contract_registry.entries).toHaveLength(3);

    expect(buildAbilityValidationSeedForL2Result(request, result)).toMatchObject({
      ability_validation_request: {
        ability_ref: "generic.example_com.articles_l2.read.v1",
        validation_mode: "smoke_validation",
        profile_ref: "profile/default",
        requested_execution_layer: "L2",
        expected_capability_kind: "read"
      },
      execution_result: {
        result_state: "verified"
      }
    });
  });

  it("rejects unsafe or incomplete read requests before execution", () => {
    expectInvalidReason(
      () =>
        parseL2FirstUsableRequestForContract({
          ...requestInput(),
          allowed_actions: ["locate", "click", "extract"]
        }),
      "ALLOWED_ACTIONS_INVALID"
    );
    expectInvalidReason(
      () =>
        parseL2FirstUsableRequestForContract({
          ...requestInput(),
          allowed_actions: ["locate", "wait_settled"]
        }),
      "ALLOWED_ACTIONS_EXTRACT_REQUIRED"
    );
    expectInvalidReason(
      () =>
        parseL2FirstUsableRequestForContract({
          ...requestInput(),
          target_url: "https://other.example/articles/l2"
        }),
      "TARGET_URL_DOMAIN_MISMATCH"
    );
  });

  it("keeps paused risk gates and L1 fallback as structured failure classes", () => {
    expect(buildL2RiskGateBlockedResultForContract()).toEqual({
      success: false,
      failure_class: "risk_gate_blocked"
    });
    expect(buildL2RequiresL1FallbackResultForContract("state_not_settled")).toMatchObject({
      success: false,
      failure_class: "requires_l1_fallback",
      l1_fallback_payload: {
        fallback_goal: "read",
        fallback_reason: "state_not_settled",
        recommended_strategy: "visual_state_check"
      }
    });
  });

  it("does not accept successful output without an extract trace", () => {
    const request = parseL2FirstUsableRequestForContract(requestInput());
    expectInvalidReason(
      () =>
        parseL2FirstUsableResultForContract(
          {
            ...successResultInput(),
            interaction_trace: [
              {
                action: "locate",
                target_ref: "document",
                settled: true,
                interaction_semantics: "neutral"
              }
            ]
          },
          request
        ),
      "SUCCESS_EXTRACT_TRACE_REQUIRED"
    );
  });
});
