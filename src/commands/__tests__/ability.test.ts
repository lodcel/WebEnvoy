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
  const cwd = await mkdtemp(join(tmpdir(), "webenvoy-ability-command-"));
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

const contractRef = (
  abilityId: string,
  kind: "input" | "output" | "error"
): string => `cad::${abilityId}::${kind}::v1`;

const descriptor = {
  ability_id: "generic.page.read.v1",
  display_name: "Generic page read",
  ability_kind: "read",
  entrypoint: "l2.first_usable",
  platform_scope: {
    platform_family: "generic_web"
  },
  execution_layer_support: ["L2"],
  input_contract_ref: contractRef("generic.page.read.v1", "input"),
  output_contract_ref: contractRef("generic.page.read.v1", "output"),
  error_contract_ref: contractRef("generic.page.read.v1", "error"),
  capture_origin: "l2_first_usable_sample",
  candidate_status: "candidate_ready",
  capture_run_id: "run-capture",
  capture_profile: "profile/default",
  captured_at: "2026-05-22T00:00:00.000Z"
};

const registry = {
  ability_id: "generic.page.read.v1",
  entries: [
    {
      contract_ref: contractRef("generic.page.read.v1", "input"),
      contract_kind: "input",
      contract_body: {
        type: "object",
        required: ["url"]
      }
    },
    {
      contract_ref: contractRef("generic.page.read.v1", "output"),
      contract_kind: "output",
      contract_body: {
        type: "object",
        required: ["title"]
      }
    },
    {
      contract_ref: contractRef("generic.page.read.v1", "error"),
      contract_kind: "error",
      contract_body: {
        type: "object",
        required: ["reason"]
      }
    }
  ]
};

const parseJsonLine = (value: string): JsonObject => JSON.parse(value.trim()) as JsonObject;

describe("ability commands", () => {
  it("validates a saved candidate ability and replays last success input", async () => {
    const cwd = await createTempCwd();
    const validateStdout = captureStdout();
    const validateCode = await runCli(
      [
        "ability.validate",
        "--run-id",
        "run-ability-smoke-001",
        "--params",
        JSON.stringify({
          candidate_ability_descriptor: descriptor,
          candidate_ability_contract_registry: registry,
          ability_validation_request: {
            ability_ref: "generic.page.read.v1",
            validation_mode: "smoke_validation",
            profile_ref: "profile/default",
            requested_execution_layer: "L2",
            expected_capability_kind: "read",
            smoke_input: {
              url: "https://example.com"
            }
          },
          execution_result: {
            result_state: "verified"
          }
        })
      ],
      {
        cwd,
        stdout: validateStdout.stream,
        stderr: new Writable({ write(_chunk, _encoding, callback) { callback(); } })
      }
    );
    expect(validateCode).toBe(0);
    const validatePayload = parseJsonLine(validateStdout.read());
    expect(validatePayload).toMatchObject({
      status: "success",
      summary: {
        ability_health_view: {
          ability_ref: "generic.page.read.v1",
          profile_ref: "profile/default",
          execution_layer: "L2",
          health_state: "healthy",
          validation_coverage_state: "smoke_only",
          last_success_input_ref: expect.stringContaining("run-ability-smoke-001/smoke")
        }
      }
    });

    const replayStdout = captureStdout();
    const replayCode = await runCli(
      [
        "ability.replay",
        "--run-id",
        "run-ability-replay-001",
        "--params",
        JSON.stringify({
          candidate_ability_descriptor: descriptor,
          candidate_ability_contract_registry: registry,
          ability_replay_request: {
            ability_ref: "generic.page.read.v1",
            profile_ref: "profile/default",
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
        stderr: new Writable({ write(_chunk, _encoding, callback) { callback(); } })
      }
    );
    expect(replayCode).toBe(0);
    expect(parseJsonLine(replayStdout.read())).toMatchObject({
      status: "success",
      summary: {
        ability_health_view: {
          health_state: "healthy",
          validation_coverage_state: "smoke_plus_replay",
          latest_validations: [
            expect.objectContaining({ validation_mode: "smoke_validation" }),
            expect.objectContaining({ validation_mode: "replay_validation" })
          ]
        },
        replay_input_ref: expect.stringContaining("run-ability-smoke-001/smoke")
      }
    });
  });

  it("rejects missing execution evidence before writing validation state", async () => {
    const cwd = await createTempCwd();
    const validateStdout = captureStdout();
    const validateCode = await runCli(
      [
        "ability.validate",
        "--run-id",
        "run-ability-smoke-missing-evidence",
        "--params",
        JSON.stringify({
          candidate_ability_descriptor: descriptor,
          candidate_ability_contract_registry: registry,
          ability_validation_request: {
            ability_ref: "generic.page.read.v1",
            validation_mode: "smoke_validation",
            profile_ref: "profile/default",
            requested_execution_layer: "L2",
            expected_capability_kind: "read",
            smoke_input: {
              url: "https://example.com"
            }
          }
        })
      ],
      {
        cwd,
        stdout: validateStdout.stream,
        stderr: new Writable({ write(_chunk, _encoding, callback) { callback(); } })
      }
    );
    expect(validateCode).not.toBe(0);
    expect(parseJsonLine(validateStdout.read())).toMatchObject({
      status: "error",
      error: {
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          ability_id: "generic.page.read.v1",
          reason: "EXECUTION_RESULT_MISSING"
        }
      }
    });

    const replayStdout = captureStdout();
    const replayCode = await runCli(
      [
        "ability.replay",
        "--run-id",
        "run-ability-replay-after-missing-evidence",
        "--params",
        JSON.stringify({
          candidate_ability_descriptor: descriptor,
          candidate_ability_contract_registry: registry,
          ability_replay_request: {
            ability_ref: "generic.page.read.v1",
            profile_ref: "profile/default",
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
        stderr: new Writable({ write(_chunk, _encoding, callback) { callback(); } })
      }
    );
    expect(replayCode).not.toBe(0);
    expect(parseJsonLine(replayStdout.read())).toMatchObject({
      status: "error",
      error: {
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          ability_id: "generic.page.read.v1",
          reason: "REPLAY_INPUT_SNAPSHOT_MISSING"
        }
      }
    });
  });

  it("rejects non-object execution evidence", async () => {
    const cwd = await createTempCwd();
    const stdout = captureStdout();
    const code = await runCli(
      [
        "ability.validate",
        "--run-id",
        "run-ability-smoke-invalid-evidence",
        "--params",
        JSON.stringify({
          candidate_ability_descriptor: descriptor,
          candidate_ability_contract_registry: registry,
          ability_validation_request: {
            ability_ref: "generic.page.read.v1",
            validation_mode: "smoke_validation",
            profile_ref: "profile/default",
            requested_execution_layer: "L2",
            expected_capability_kind: "read",
            smoke_input: {
              url: "https://example.com"
            }
          },
          execution_result: "verified"
        })
      ],
      {
        cwd,
        stdout: stdout.stream,
        stderr: new Writable({ write(_chunk, _encoding, callback) { callback(); } })
      }
    );
    expect(code).not.toBe(0);
    expect(parseJsonLine(stdout.read())).toMatchObject({
      status: "error",
      error: {
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          ability_id: "generic.page.read.v1",
          reason: "EXECUTION_RESULT_MISSING"
        }
      }
    });
  });

  it("rejects write descriptors before writing health views", async () => {
    const cwd = await createTempCwd();
    const stdout = captureStdout();
    const code = await runCli(
      [
        "ability.validate",
        "--run-id",
        "run-write-reject-001",
        "--params",
        JSON.stringify({
          candidate_ability_descriptor: {
            ...descriptor,
            ability_id: "generic.form.write.v1",
            ability_kind: "write",
            input_contract_ref: contractRef("generic.form.write.v1", "input"),
            output_contract_ref: contractRef("generic.form.write.v1", "output"),
            error_contract_ref: contractRef("generic.form.write.v1", "error")
          },
          candidate_ability_contract_registry: {
            ability_id: "generic.form.write.v1",
            entries: [
              {
                contract_ref: contractRef("generic.form.write.v1", "input"),
                contract_kind: "input",
                contract_body: { type: "object" }
              },
              {
                contract_ref: contractRef("generic.form.write.v1", "output"),
                contract_kind: "output",
                contract_body: { type: "object" }
              },
              {
                contract_ref: contractRef("generic.form.write.v1", "error"),
                contract_kind: "error",
                contract_body: { type: "object" }
              }
            ]
          },
          ability_validation_request: {
            ability_ref: "generic.form.write.v1",
            validation_mode: "smoke_validation",
            profile_ref: "profile/default",
            requested_execution_layer: "L2",
            expected_capability_kind: "write",
            smoke_input: {
              text: "draft"
            }
          }
        })
      ],
      {
        cwd,
        stdout: stdout.stream,
        stderr: new Writable({ write(_chunk, _encoding, callback) { callback(); } })
      }
    );
    expect(code).not.toBe(0);
    expect(parseJsonLine(stdout.read())).toMatchObject({
      status: "error",
      error: {
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          ability_id: "generic.form.write.v1",
          reason: "ABILITY_KIND_NOT_IN_TRUST_DOMAIN"
        }
      }
    });
  });
});
