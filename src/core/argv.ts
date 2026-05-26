import { CliError } from "./errors.js";
import type { JsonObject, ParsedCliInput } from "./types.js";

const COMMAND_SEGMENT_PATTERN = /^[a-z][a-z0-9_-]*$/;
const COMMAND_MAX_SEGMENTS = 3;
const COMMAND_MAX_LENGTH = 96;
const REGISTERED_MULTI_SEGMENT_COMMANDS = new Set([
  "xhs.creator_publish.admit",
  "xhs.editor_input.validate",
  "xhs.editor_text.write",
  "xhs.media_upload.discover"
]);
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;

const parseParams = (raw: string): JsonObject => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError("ERR_CLI_INVALID_ARGS", "--params 必须是 JSON 对象字符串");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliError("ERR_CLI_INVALID_ARGS", "--params 必须是 JSON 对象字符串");
  }

  return parsed as JsonObject;
};

const requireOptionValue = (argv: string[], index: number, optionName: string): string => {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new CliError("ERR_CLI_INVALID_ARGS", `${optionName} 缺少参数值`);
  }

  return value;
};

const assertCommand = (command: string): void => {
  const segments = command.split(".");
  if (
    command.length > COMMAND_MAX_LENGTH ||
    segments.length < 2 ||
    segments.length > COMMAND_MAX_SEGMENTS ||
    segments.some((segment) => !COMMAND_SEGMENT_PATTERN.test(segment))
  ) {
    throw new CliError(
      "ERR_CLI_INVALID_ARGS",
      "命令格式非法，必须是 runtime.<verb>、<platform>.<verb> 或 <platform>.<scope>.<verb>"
    );
  }

  if (segments.length === 3 && !REGISTERED_MULTI_SEGMENT_COMMANDS.has(command)) {
    throw new CliError("ERR_CLI_INVALID_ARGS", "三段命令必须是已注册的受控命令");
  }
};

export const isValidRunId = (runId: string): boolean => RUN_ID_PATTERN.test(runId);

export const getCommandHint = (argv: string[]): string =>
  argv[0] && !argv[0].startsWith("--") ? argv[0] : "runtime.invalid";

export const getRunIdHint = (argv: string[]): string | null => {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--run-id") {
      return argv[i + 1] ?? null;
    }
  }

  return null;
};

export const parseArgv = (argv: string[]): ParsedCliInput => {
  if (argv.length === 0) {
    throw new CliError("ERR_CLI_INVALID_ARGS", "<command> 是必填位置参数");
  }

  const command = argv[0];

  if (command.startsWith("--")) {
    throw new CliError("ERR_CLI_INVALID_ARGS", "<command> 必须是第一个位置参数");
  }

  assertCommand(command);

  let params: JsonObject = {};
  let profile: string | null = null;
  let runId: string | null = null;
  let paramsSeen = false;

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith("--")) {
      throw new CliError("ERR_CLI_INVALID_ARGS", `无法识别的位置参数: ${token}`);
    }

    if (token === "--params") {
      if (paramsSeen) {
        throw new CliError("ERR_CLI_INVALID_ARGS", "--params 不允许重复");
      }
      const value = requireOptionValue(argv, i, "--params");
      params = parseParams(value);
      paramsSeen = true;
      i += 1;
      continue;
    }

    if (token === "--profile") {
      if (profile !== null) {
        throw new CliError("ERR_CLI_INVALID_ARGS", "--profile 不允许重复");
      }
      profile = requireOptionValue(argv, i, "--profile");
      i += 1;
      continue;
    }

    if (token === "--run-id") {
      if (runId !== null) {
        throw new CliError("ERR_CLI_INVALID_ARGS", "--run-id 不允许重复");
      }
      const value = requireOptionValue(argv, i, "--run-id");
      if (!isValidRunId(value)) {
        throw new CliError("ERR_CLI_INVALID_ARGS", "--run-id 格式非法");
      }
      runId = value;
      i += 1;
      continue;
    }

    throw new CliError("ERR_CLI_INVALID_ARGS", `未知参数: ${token}`);
  }

  return {
    command,
    params,
    profile,
    runId
  };
};
