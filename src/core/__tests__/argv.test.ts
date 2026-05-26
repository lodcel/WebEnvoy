import { describe, expect, it } from "vitest";

import { createCommandRegistry } from "../../commands/index.js";
import { parseArgv } from "../argv.js";
import { CliError } from "../errors.js";

const REGISTERED_COMMANDS = createCommandRegistry().list().map((command) => command.name);

const REGISTERED_MULTI_SEGMENT_COMMANDS = REGISTERED_COMMANDS.filter(
  (command) => command.split(".").length === 3
);

describe("parseArgv", () => {
  it("parses command and options using the frozen syntax", () => {
    const parsed = parseArgv([
      "runtime.ping",
      "--params",
      '{"hello":"world"}',
      "--profile",
      "default",
      "--run-id",
      "run-20260319-0001"
    ]);

    expect(parsed).toEqual({
      command: "runtime.ping",
      params: { hello: "world" },
      profile: "default",
      runId: "run-20260319-0001"
    });
  });

  it("defaults params to empty object and optional fields to null", () => {
    const parsed = parseArgv(["runtime.help"]);

    expect(parsed).toEqual({
      command: "runtime.help",
      params: {},
      profile: null,
      runId: null
    });
  });

  it.each(REGISTERED_MULTI_SEGMENT_COMMANDS)(
    "accepts registered multi-segment platform command %s",
    (command) => {
      const parsed = parseArgv(
        [
          command,
          "--profile",
          "xhs_001",
          "--run-id",
          "issue820-dedicated-cli-001",
          "--params",
          '{"target_domain":"creator.xiaohongshu.com","target_tab_id":32,"target_page":"creator_publish_tab","requested_execution_mode":"dry_run"}'
        ],
        { registeredCommands: REGISTERED_COMMANDS }
      );

      expect(parsed).toEqual({
        command,
        params: {
          target_domain: "creator.xiaohongshu.com",
          target_tab_id: 32,
          target_page: "creator_publish_tab",
          requested_execution_mode: "dry_run"
        },
        profile: "xhs_001",
        runId: "issue820-dedicated-cli-001"
      });
    }
  );

  it("rejects commands with too many segments", () => {
    expect(() => parseArgv(["xhs.creator.publish.admit"])).toThrowError(CliError);
  });

  it.each(["a.b.c", "xhs.creator_publish.fake"])(
    "rejects unregistered multi-segment command %s",
    (command) => {
      expect(() =>
        parseArgv([command], { registeredCommands: REGISTERED_COMMANDS })
      ).toThrowError(CliError);
    }
  );

  it.each([
    "runtime",
    "runtime.",
    ".runtime.ping",
    "runtime..ping",
    "Runtime.ping",
    "xhs.creator_publish.admit.extra",
    `xhs.${"a".repeat(100)}.admit`
  ])("rejects malformed command %s", (command) => {
    expect(() => parseArgv([command])).toThrowError(CliError);
  });

  it("rejects malformed params json", () => {
    expect(() => parseArgv(["runtime.ping", "--params", "not-json"])).toThrowError(
      CliError
    );

    try {
      parseArgv(["runtime.ping", "--params", "not-json"]);
    } catch (error) {
      expect(error).toMatchObject({ code: "ERR_CLI_INVALID_ARGS" });
    }
  });

  it("rejects non-object params", () => {
    expect(() => parseArgv(["runtime.ping", "--params", "[]"])).toThrowError(CliError);
  });

  it("rejects duplicated --params", () => {
    expect(() =>
      parseArgv(["runtime.ping", "--params", "{}", "--params", "{}"])
    ).toThrowError(CliError);
  });

  it("rejects missing command", () => {
    expect(() => parseArgv([])).toThrowError(CliError);
  });

  it("rejects invalid run id format", () => {
    expect(() =>
      parseArgv(["runtime.ping", "--run-id", "bad run id with spaces"])
    ).toThrowError(CliError);
  });
});
