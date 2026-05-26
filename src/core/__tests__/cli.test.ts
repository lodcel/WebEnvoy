import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../../cli.js";

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
  const cwd = await mkdtemp(join(tmpdir(), "webenvoy-cli-command-"));
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

describe("runCli command registration", () => {
  it.each(["unknown.test", "xhs.creator_publish.fake"])(
    "rejects unregistered command %s after syntax parsing",
    async (command) => {
      const cwd = await createTempCwd();
      const stdout = captureStdout();

      const code = await runCli([command], {
        cwd,
        stdout: stdout.stream
      });

      expect(code).toBe(3);
      expect(JSON.parse(stdout.read())).toMatchObject({
        command,
        status: "error",
        error: {
          code: "ERR_CLI_UNKNOWN_COMMAND"
        }
      });
    }
  );
});
