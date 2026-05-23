import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../../cli.js";
import type { JsonObject } from "../../core/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

const createTempCwd = async (): Promise<string> => {
  const cwd = await mkdtemp(join(tmpdir(), "webenvoy-l2-command-"));
  tempDirs.push(cwd);
  return cwd;
};

const captureStdout = (): { stream: Writable; read: () => string } => {
  let output = "";
  return {
    stream: new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      }
    }),
    read: () => output
  };
};

const stderrSink = (): Writable =>
  new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });

const parseJsonLine = (value: string): JsonObject => JSON.parse(value.trim()) as JsonObject;

const withLoopbackTransport = async <T>(run: () => Promise<T>): Promise<T> => {
  const previousTransport = process.env.WEBENVOY_NATIVE_TRANSPORT;
  process.env.WEBENVOY_NATIVE_TRANSPORT = "loopback";
  try {
    return await run();
  } finally {
    if (previousTransport === undefined) {
      delete process.env.WEBENVOY_NATIVE_TRANSPORT;
    } else {
      process.env.WEBENVOY_NATIVE_TRANSPORT = previousTransport;
    }
  }
};

const l2Request = (input?: { riskState?: "paused" | "limited" | "allowed" }) => ({
  target_url: "https://example.com/articles/l2",
  goal_kind: "read",
  interaction_safety_class: "pure_read",
  goal_hint: "Read the visible article summary",
  risk_gate_context: {
    run_id: "run-l2-loopback-001",
    profile: "loopback_profile",
    target_domain: "example.com",
    target_tab_id: 17,
    target_page: "article",
    risk_state: input?.riskState ?? "limited"
  },
  allowed_actions: ["navigate", "locate", "extract", "wait_settled"]
});

describe("l2 commands", () => {
  it("runs l2.first_usable through loopback and validates the candidate ability handoff", async () => {
    await withLoopbackTransport(async () => {
      const cwd = await createTempCwd();
      const l2Stdout = captureStdout();
      const l2Code = await runCli(
        [
          "l2.first_usable",
          "--run-id",
          "run-l2-loopback-001",
          "--profile",
          "loopback_profile",
          "--params",
          JSON.stringify({
            l2_first_usable_request: l2Request()
          })
        ],
        {
          cwd,
          stdout: l2Stdout.stream,
          stderr: stderrSink()
        }
      );
      expect(l2Code).toBe(0);
      const l2Payload = parseJsonLine(l2Stdout.read());
      expect(l2Payload).toMatchObject({
        status: "success",
        summary: {
          relay_path: "host>background>content-script>background>host",
          l2_first_usable_result: {
            success: true,
            interaction_trace: [
              expect.objectContaining({ action: "locate" }),
              expect.objectContaining({
                action: "extract",
                interaction_semantics: "neutral"
              })
            ],
            candidate_shell_seed: {
              ability_kind: "read",
              entrypoint: "l2.first_usable",
              execution_layer_support: ["L2"]
            }
          },
          candidate_ability_descriptor: {
            ability_kind: "read",
            entrypoint: "l2.first_usable",
            execution_layer_support: ["L2"]
          },
          ability_validation_seed: {
            ability_validation_request: {
              requested_execution_layer: "L2",
              expected_capability_kind: "read"
            }
          }
        }
      });

      const l2Summary = l2Payload.summary as JsonObject;
      const validationSeed = l2Summary.ability_validation_seed as JsonObject;
      const validateStdout = captureStdout();
      const validateCode = await runCli(
        [
          "ability.validate",
          "--run-id",
          "run-l2-ability-validate-001",
          "--params",
          JSON.stringify(validationSeed)
        ],
        {
          cwd,
          stdout: validateStdout.stream,
          stderr: stderrSink()
        }
      );
      expect(validateCode).toBe(0);
      const validatePayload = parseJsonLine(validateStdout.read());
      const descriptor = l2Summary.candidate_ability_descriptor as JsonObject;
      const abilityId = String(descriptor.ability_id);
      expect(validatePayload).toMatchObject({
        status: "success",
        summary: {
          ability_health_view: {
            ability_ref: abilityId,
            profile_ref: "loopback_profile",
            execution_layer: "L2",
            health_state: "healthy",
            validation_coverage_state: "smoke_only"
          }
        }
      });

      const replayStdout = captureStdout();
      const replayCode = await runCli(
        [
          "ability.replay",
          "--run-id",
          "run-l2-ability-replay-001",
          "--params",
          JSON.stringify({
            candidate_ability_descriptor: descriptor,
            candidate_ability_contract_registry:
              l2Summary.candidate_ability_contract_registry,
            ability_replay_request: {
              ability_ref: abilityId,
              profile_ref: "loopback_profile",
              requested_execution_layer: "L2",
              expected_capability_kind: "read",
              replay_source: "last_success_input",
              replay_reason: "manual_check"
            },
            execution_result: {
              result_state: "verified"
            }
          })
        ],
        {
          cwd,
          stdout: replayStdout.stream,
          stderr: stderrSink()
        }
      );
      expect(replayCode).toBe(0);
      expect(parseJsonLine(replayStdout.read())).toMatchObject({
        status: "success",
        summary: {
          ability_health_view: {
            ability_ref: abilityId,
            profile_ref: "loopback_profile",
            execution_layer: "L2",
            health_state: "healthy",
            validation_coverage_state: "smoke_plus_replay"
          }
        }
      });
    });
  });

  it("returns requires_l1_fallback from loopback without candidate handoff", async () => {
    await withLoopbackTransport(async () => {
      const cwd = await createTempCwd();
      const stdout = captureStdout();
      const code = await runCli(
        [
          "l2.first_usable",
          "--run-id",
          "run-l2-loopback-001",
          "--profile",
          "loopback_profile",
          "--params",
          JSON.stringify({
            l2_first_usable_request: l2Request(),
            simulate_result: "state_not_settled"
          })
        ],
        {
          cwd,
          stdout: stdout.stream,
          stderr: stderrSink()
        }
      );
      expect(code).toBe(0);
      const payload = parseJsonLine(stdout.read());
      expect(payload).toMatchObject({
        status: "success",
        summary: {
          l2_first_usable_result: {
            success: false,
            failure_class: "requires_l1_fallback",
            l1_fallback_payload: {
              fallback_goal: "read",
              fallback_reason: "state_not_settled",
              recommended_strategy: "visual_state_check"
            }
          }
        }
      });
      const summary = payload.summary as JsonObject;
      expect(summary).not.toHaveProperty("candidate_ability_descriptor");
      expect(summary).not.toHaveProperty("candidate_ability_contract_registry");
      expect(summary).not.toHaveProperty("ability_validation_seed");
    });
  });

  it("rejects profile mismatch before native forwarding", async () => {
    await withLoopbackTransport(async () => {
      const cwd = await createTempCwd();
      const stdout = captureStdout();
      const code = await runCli(
        [
          "l2.first_usable",
          "--run-id",
          "run-l2-loopback-001",
          "--profile",
          "different_profile",
          "--params",
          JSON.stringify({
            l2_first_usable_request: l2Request()
          })
        ],
        {
          cwd,
          stdout: stdout.stream,
          stderr: stderrSink()
        }
      );
      expect(code).not.toBe(0);
      expect(parseJsonLine(stdout.read())).toMatchObject({
        status: "error",
        error: {
          code: "ERR_CLI_INVALID_ARGS",
          details: {
            reason: "PROFILE_MISMATCH"
          }
        }
      });
    });
  });
});
