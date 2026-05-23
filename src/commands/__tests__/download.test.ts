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
  const cwd = await mkdtemp(join(tmpdir(), "webenvoy-download-command-"));
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

const contractRef = (
  abilityId: string,
  kind: "input" | "output" | "error"
): string => `cad::${abilityId}::${kind}::v1`;

const candidateSeed = (abilityId = "generic.file.download.v1"): JsonObject => ({
  ability_id: abilityId,
  display_name: "Generic file download",
  ability_kind: "download",
  entrypoint: "download.prepare",
  platform_scope: {
    platform_family: "generic_web",
    site_pattern: "https://example.com/*"
  },
  execution_layer_support: ["L2", "L3"],
  input_contract_ref: contractRef(abilityId, "input"),
  output_contract_ref: contractRef(abilityId, "output"),
  error_contract_ref: contractRef(abilityId, "error"),
  capture_origin: "l2_first_usable_sample",
  capture_run_id: "run-download-capture",
  capture_profile: "profile/default",
  capture_artifact_refs: ["artifact://download/candidate"],
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
          required: ["download_source", "output_policy"]
        }
      },
      {
        contract_ref: contractRef(abilityId, "output"),
        contract_kind: "output",
        contract_body: {
          type: "object",
          required: ["download_result_summary"]
        }
      },
      {
        contract_ref: contractRef(abilityId, "error"),
        contract_kind: "error",
        contract_body: {
          type: "object",
          required: ["reason"]
        }
      }
    ]
  }
});

const downloadParams = (overrides: JsonObject = {}): JsonObject => ({
  ability: {
    id: "generic.file.download.v1",
    layer: "L2",
    action: "download"
  },
  input: {
    ability_ref: "generic.file.download.v1",
    download_source: {
      source_kind: "page_derived",
      derive_mode: "export_flow",
      trigger_hint: "click export"
    },
    profile_ref: "profile/default",
    download_goal: "single_file",
    output_policy: {
      destination_root: "exports/reports",
      file_name_policy: "preserve_source_name",
      conflict_policy: "rename_with_suffix"
    },
    requested_execution_layer: "L2"
  },
  candidate_shell_seed: candidateSeed(),
  ...overrides
});

describe("download commands", () => {
  it("prepares a download handoff without executing browser or file writes", async () => {
    const cwd = await createTempCwd();
    const stdout = captureStdout();
    const code = await runCli(
      [
        "download.prepare",
        "--run-id",
        "run-download-prepare-001",
        "--profile",
        "profile/default",
        "--params",
        JSON.stringify(downloadParams())
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
        capability_result: {
          ability_id: "generic.file.download.v1",
          layer: "L2",
          action: "download",
          outcome: "partial",
          data_ref: "download.prepare/run-download-prepare-001",
          download_result_summary: {
            result_state: "partial",
            saved_artifact_refs: [
              "download-prepare://run-download-prepare-001/candidate-handoff"
            ]
          }
        },
        candidate_ability_descriptor: {
          ability_kind: "download",
          entrypoint: "download.prepare",
          execution_layer_support: ["L2", "L3"]
        },
        ability_validation_seed: {
          ability_validation_request: {
            ability_ref: "generic.file.download.v1",
            requested_execution_layer: "L2",
            expected_capability_kind: "download"
          },
          validation_execution_boundary: "not_executed_in_fr0021_747"
        },
        download_execution_boundary: "not_executed_in_fr0021_747"
      }
    });
    const summary = payload.summary as JsonObject;
    expect(summary).not.toHaveProperty("download_result_summary");
  });

  it("rejects caller-provided download result summaries before success projection", async () => {
    const cwd = await createTempCwd();
    const stdout = captureStdout();
    const code = await runCli(
      [
        "download.prepare",
        "--run-id",
        "run-download-prepare-downloaded",
        "--profile",
        "profile/default",
        "--params",
        JSON.stringify(
          downloadParams({
            download_result_summary: {
              download_ref: "download/run-downloaded",
              result_state: "downloaded",
              resolved_output_path: "trusted-base/exports/reports/report.pdf",
              source_url: "https://example.com/report.pdf",
              file_name_hint: "report.pdf",
              content_descriptor: {
                content_kind: "file",
                mime_type: "application/pdf"
              }
            }
          })
        )
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
        details: {
          ability_id: "generic.file.download.v1",
          stage: "input_validation",
          reason: "DOWNLOAD_RESULT_SUMMARY_INPUT_UNSUPPORTED"
        }
      }
    });
  });

  it("rejects unsafe destination roots through the unified error shell", async () => {
    const cwd = await createTempCwd();
    for (const destinationRoot of ["../escape", "C:tmp"]) {
      const stdout = captureStdout();
      const params = downloadParams({
        input: {
          ...(downloadParams().input as JsonObject),
          output_policy: {
            destination_root: destinationRoot,
            file_name_policy: "preserve_source_name",
            conflict_policy: "rename_with_suffix"
          }
        }
      });
      const code = await runCli(
        [
          "download.prepare",
          "--run-id",
          `run-download-invalid-root-${destinationRoot.replace(/[^a-z0-9]/giu, "-")}`,
          "--profile",
          "profile/default",
          "--params",
          JSON.stringify(params)
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
          details: {
            ability_id: "generic.file.download.v1",
            stage: "input_validation",
            reason: "DESTINATION_ROOT_INVALID"
          }
        }
      });
    }
  });

  it("rejects ability layer and request layer mirror conflicts", async () => {
    const cwd = await createTempCwd();
    const stdout = captureStdout();
    const code = await runCli(
      [
        "download.prepare",
        "--run-id",
        "run-download-layer-mismatch",
        "--profile",
        "profile/default",
        "--params",
        JSON.stringify(
          downloadParams({
            ability: {
              id: "generic.file.download.v1",
              layer: "L3",
              action: "download"
            }
          })
        )
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
        details: {
          ability_id: "generic.file.download.v1",
          stage: "input_validation",
          reason: "REQUESTED_EXECUTION_LAYER_MISMATCH"
        }
      }
    });
  });

  it("rejects profile mismatches before candidate handoff", async () => {
    const cwd = await createTempCwd();
    const stdout = captureStdout();
    const code = await runCli(
      [
        "download.prepare",
        "--run-id",
        "run-download-profile-mismatch",
        "--profile",
        "profile/other",
        "--params",
        JSON.stringify(downloadParams())
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
        details: {
          ability_id: "generic.file.download.v1",
          stage: "input_validation",
          reason: "PROFILE_MISMATCH"
        }
      }
    });
  });

  it("triggers browser-side target resolution through loopback without landing files", async () => {
    await withLoopbackTransport(async () => {
      const cwd = await createTempCwd();
      const stdout = captureStdout();
      const code = await runCli(
        [
          "download.trigger",
          "--run-id",
          "run-download-trigger-001",
          "--profile",
          "profile/default",
          "--params",
          JSON.stringify(
            downloadParams({
              options: {
                trigger_mode: "dispatch_click",
                target_tab_id: 17,
                target_domain: "example.com",
                target_page: "export"
              }
            })
          )
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
          capability_result: {
            ability_id: "generic.file.download.v1",
            layer: "L2",
            action: "download",
            outcome: "partial",
            download_result_summary: {
              download_ref: "download.trigger/run-download-trigger-001",
              result_state: "partial",
              saved_artifact_refs: [
                "download-trigger://run-download-trigger-001/click export"
              ],
              source_url: "https://example.com/export/report.pdf",
              file_name_hint: "report.pdf"
            }
          },
          download_target: {
            source_kind: "page_derived",
            trigger_status: "triggered",
            trigger_mode: "dispatch_click",
            trigger_surface: "dom_button"
          },
          download_execution_boundary: "browser_target_trigger_only_fr0021_748",
          file_landing_boundary: "not_executed_until_fr0021_749",
          ability_validation_seed: {
            ability_validation_request: {
              expected_capability_kind: "download"
            }
          }
        }
      });
      const summary = payload.summary as JsonObject;
      const capabilityResult = summary.capability_result as JsonObject;
      const downloadSummary = capabilityResult.download_result_summary as JsonObject;
      expect(downloadSummary.result_state).toBe("partial");
      expect(downloadSummary).not.toHaveProperty("resolved_output_path");
    });
  });

  it("maps browser-side trigger failures to the unified download error shell", async () => {
    await withLoopbackTransport(async () => {
      const cwd = await createTempCwd();
      const stdout = captureStdout();
      const code = await runCli(
        [
          "download.trigger",
          "--run-id",
          "run-download-trigger-auth-required",
          "--profile",
          "profile/default",
          "--params",
          JSON.stringify(
            downloadParams({
              simulate_result: "auth_required",
              options: {
                trigger_mode: "resolve_only"
              }
            })
          )
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
          code: "ERR_EXECUTION_FAILED",
          details: {
            ability_id: "generic.file.download.v1",
            stage: "execution",
            reason: "AUTH_OR_SESSION_REQUIRED"
          }
        }
      });
    });
  });
});
