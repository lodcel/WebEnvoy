import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  BROWSER_CONTROL_FILENAME,
  EXTENSION_BOOTSTRAP_FILENAME,
  EXTENSION_BOOTSTRAP_SCRIPT_FILENAME,
  EXTENSION_STAGING_DIRNAME,
  BROWSER_STATE_FILENAME,
  BrowserLaunchError,
  launchBrowser,
  resolvePreferredBrowserCandidates,
  resolvePreferredBrowserVersionTruthSource,
  resolveBrowserVersionOutputForFingerprint,
  shutdownBrowserSession
} from "../browser-launcher.js";
import {
  acquireBrowserEnvTestLock,
  releaseBrowserEnvTestLock
} from "./browser-env-test-lock.js";

const tempDirs: string[] = [];
let browserPathBeforeTest: string | undefined;
let browserMockLogBeforeTest: string | undefined;
let browserMockVersionBeforeTest: string | undefined;
let realChromeBinBeforeTest: string | undefined;
let realBrowserPathBeforeTest: string | undefined;
let browserVersionBeforeTest: string | undefined;
let browserForceLaunchServicesBeforeTest: string | undefined;
let openPathBeforeTest: string | undefined;
let pathBeforeTest: string | undefined;
let platformBeforeTest: NodeJS.Platform;
const createFingerprintRuntimeContext = () => ({
  profile: "launch-audit-profile",
  source: "profile_meta" as const,
  fingerprint_profile_bundle: {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.7680.154 Safari/537.36",
    hardwareConcurrency: 8,
    deviceMemory: 8,
    screen: {
      width: 1440,
      height: 900,
      colorDepth: 30,
      pixelDepth: 30
    },
    battery: {
      level: 0.73,
      charging: false
    },
    timezone: "Asia/Shanghai",
    audioNoiseSeed: 0.000047231,
    canvasNoiseSeed: 0.000083154,
    environment: {
      os_family: "macos",
      os_version: "15.0",
      arch: "arm64"
    }
  },
  fingerprint_patch_manifest: {
    profile: "launch-audit-profile",
    manifest_version: "1",
    required_patches: ["audio_context", "battery"],
    optional_patches: ["navigator_connection"],
    field_dependencies: {
      audio_context: ["audioNoiseSeed"],
      battery: ["battery.level", "battery.charging"]
    },
    unsupported_reason_codes: []
  },
  fingerprint_consistency_check: {
    profile: "launch-audit-profile",
    expected_environment: {
      os_family: "macos",
      os_version: "15.0",
      arch: "arm64"
    },
    actual_environment: {
      os_family: "macos",
      os_version: "15.0",
      arch: "arm64"
    },
    decision: "match" as const,
    reason_codes: []
  },
  execution: {
    live_allowed: true,
    live_decision: "allowed" as const,
    allowed_execution_modes: ["dry_run", "recon", "live_read_limited"],
    reason_codes: []
  }
});
const restoreEnv = (
  key:
    | "WEBENVOY_BROWSER_PATH"
    | "WEBENVOY_BROWSER_MOCK_LOG"
    | "WEBENVOY_BROWSER_MOCK_VERSION"
    | "WEBENVOY_REAL_CHROME_BIN"
    | "WEBENVOY_REAL_BROWSER_PATH"
    | "WEBENVOY_BROWSER_VERSION"
    | "WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES"
    | "WEBENVOY_OPEN_PATH",
  value: string | undefined
): void => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

const createMockBrowserExecutable = async (
  versionOutput: string = "Chromium 146.0.0.0"
): Promise<{ scriptPath: string; logPath: string }> => {
  const dir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-"));
  tempDirs.push(dir);
  const scriptPath = join(dir, "mock-browser.mjs");
  const logPath = join(dir, "launch.log");
  await writeFile(
    scriptPath,
    `#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
const logPath = process.env.WEBENVOY_BROWSER_MOCK_LOG;
if (process.argv.includes("--version")) {
  console.log(${JSON.stringify(versionOutput)});
  process.exit(0);
}
let profileDir = "";
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--user-data-dir=")) {
    profileDir = arg.slice("--user-data-dir=".length);
  }
}
if (profileDir) {
  mkdirSync(profileDir + "/Default", { recursive: true });
  writeFileSync(profileDir + "/Local State", "{}");
  writeFileSync(profileDir + "/Default/Preferences", "{}");
}
if (logPath) {
  appendFileSync(logPath, JSON.stringify({ args: process.argv.slice(2) }) + "\\n");
}
setInterval(() => {}, 1000);
`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);
  return { scriptPath, logPath };
};

const createCrashBrowserExecutable = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-crash-"));
  tempDirs.push(dir);
  const scriptPath = join(dir, "crash-browser.mjs");
  await writeFile(
    scriptPath,
    `#!/usr/bin/env node
setTimeout(() => process.exit(0), 50);
`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);
  return scriptPath;
};

const createMockOpenExecutable = async (
  options?: { skipProfileMarkers?: boolean; childOwnsProfileLock?: boolean }
): Promise<{ scriptPath: string; logPath: string }> => {
  const dir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-"));
  tempDirs.push(dir);
  const scriptPath = join(dir, "mock-open.mjs");
  const logPath = join(dir, "open.log");
  await writeFile(
    scriptPath,
    `#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
const logPath = process.env.WEBENVOY_BROWSER_MOCK_LOG;
const argv = process.argv.slice(2);
if (logPath) {
  appendFileSync(logPath, JSON.stringify({ args: argv }) + "\\n");
}
const argsIndex = argv.indexOf("--args");
const browserArgs = argsIndex >= 0 ? argv.slice(argsIndex + 1) : [];
let profileDir = "";
for (const arg of browserArgs) {
  if (arg.startsWith("--user-data-dir=")) {
    profileDir = arg.slice("--user-data-dir=".length);
  }
}
if (profileDir && ${JSON.stringify(options?.childOwnsProfileLock === true)}) {
  const child = spawn(process.execPath, ["-e", ${JSON.stringify(`
const { existsSync, mkdirSync, symlinkSync, writeFileSync } = require("node:fs");
const profileDir = process.env.WEBENVOY_MOCK_PROFILE_DIR;
mkdirSync(profileDir + "/Default", { recursive: true });
writeFileSync(profileDir + "/Local State", "{}");
writeFileSync(profileDir + "/Default/Preferences", "{}");
const singletonLock = profileDir + "/SingletonLock";
if (!existsSync(singletonLock)) {
  symlinkSync("mockhost-" + process.pid, singletonLock);
}
setInterval(() => {}, 1000);
`)}], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, WEBENVOY_MOCK_PROFILE_DIR: profileDir }
  });
  child.unref();
  process.exit(0);
}
if (profileDir) {
  mkdirSync(profileDir + "/Default", { recursive: true });
  if (!${JSON.stringify(options?.skipProfileMarkers === true)}) {
    writeFileSync(profileDir + "/Local State", "{}");
    writeFileSync(profileDir + "/Default/Preferences", "{}");
  }
  const singletonLock = profileDir + "/SingletonLock";
  if (!existsSync(singletonLock)) {
    symlinkSync("mockhost-" + process.pid, singletonLock);
  }
}
setInterval(() => {}, 1000);
`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);
  return { scriptPath, logPath };
};

const createHangingMockOpenExecutable = async (): Promise<{ scriptPath: string; logPath: string }> => {
  const dir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-hanging-"));
  tempDirs.push(dir);
  const scriptPath = join(dir, "mock-open-hanging.mjs");
  const logPath = join(dir, "open.log");
  await writeFile(
    scriptPath,
    `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const logPath = process.env.WEBENVOY_BROWSER_MOCK_LOG;
const argv = process.argv.slice(2);
if (logPath) {
  appendFileSync(logPath, JSON.stringify({ args: argv, pid: process.pid }) + "\\n");
}
setInterval(() => {}, 1000);
`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);
  return { scriptPath, logPath };
};

const createFailingMockOpenExecutable = async (): Promise<{ scriptPath: string; logPath: string }> => {
  const dir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-failing-"));
  tempDirs.push(dir);
  const scriptPath = join(dir, "mock-open-failing.mjs");
  const logPath = join(dir, "open.log");
  await writeFile(
    scriptPath,
    `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const logPath = process.env.WEBENVOY_BROWSER_MOCK_LOG;
if (logPath) {
  appendFileSync(logPath, JSON.stringify({ args: process.argv.slice(2), pid: process.pid }) + "\\n");
}
process.exit(1);
`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);
  return { scriptPath, logPath };
};

const parseLaunchRecord = (launchLog: string): Record<string, unknown> => {
  const firstLine = launchLog
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ? JSON.parse(firstLine) as Record<string, unknown> : {};
};

const createFixedVersionBrowserExecutable = async (versionOutput: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-fixed-version-"));
  tempDirs.push(dir);
  const scriptPath = join(dir, "fixed-version-browser.mjs");
  await writeFile(
    scriptPath,
    `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  console.log(${JSON.stringify(versionOutput)});
  process.exit(0);
}
setInterval(() => {}, 1000);
`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);
  return scriptPath;
};

const createVersionCommand = async (
  commandName: string,
  versionOutput: string
): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-command-"));
  tempDirs.push(dir);
  const commandPath = join(dir, commandName);
  await writeFile(
    commandPath,
    `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo ${JSON.stringify(versionOutput)}
  exit 0
fi
while true; do sleep 1; done
`,
    "utf8"
  );
  await chmod(commandPath, 0o755);
  return dir;
};

const createVersionCountedBrowserExecutable = async (): Promise<{
  scriptPath: string;
  logPath: string;
}> => {
  const dir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-version-count-"));
  tempDirs.push(dir);
  const scriptPath = join(dir, "counted-browser.mjs");
  const logPath = join(dir, "version-count.log");
  await writeFile(
    scriptPath,
    `#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
const logPath = process.env.WEBENVOY_BROWSER_MOCK_LOG;
if (process.argv.includes("--version")) {
  appendFileSync(logPath, "version\\n");
  console.log("Chromium 146.0.0.0");
  process.exit(0);
}
let profileDir = "";
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--user-data-dir=")) {
    profileDir = arg.slice("--user-data-dir=".length);
  }
}
if (profileDir) {
  mkdirSync(profileDir + "/Default", { recursive: true });
  writeFileSync(profileDir + "/Local State", "{}");
  writeFileSync(profileDir + "/Default/Preferences", "{}");
}
appendFileSync(logPath, "launch\\n");
setInterval(() => {}, 1000);
`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);
  return { scriptPath, logPath };
};

const waitForLaunchLog = async (logPath: string): Promise<string> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const content = await readFile(logPath, "utf8");
      if (content.trim().length > 0) {
        return content;
      }
    } catch (error) {
      lastError = error;
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw lastError ?? new Error("mock browser launch log not written in time");
};

const parseLaunchArgs = (launchLog: string): string[] => {
  const parsed = parseLaunchRecord(launchLog) as { args?: unknown };
  return Array.isArray(parsed.args) ? (parsed.args as string[]) : [];
};

const findArgValue = (args: string[], prefix: string): string | null => {
  for (const arg of args) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return null;
};

const executeBundledDryRunSearch = async (bundlePath: string) => {
  const bundleSource = await readFile(bundlePath, "utf8");
  const context: Record<string, unknown> = {};
  context.globalThis = context;
  runInNewContext(
    `${bundleSource}\n;globalThis.__bundle_test_exports = globalThis.__webenvoy_content_script_bundle_modules;`,
    context,
    { filename: bundlePath }
  );
  const bundleExports = context.__bundle_test_exports as {
    __webenvoy_module_xhs_search?: {
      executeXhsSearch?: (input: Record<string, unknown>, env: Record<string, unknown>) => Promise<unknown>;
    };
  };
  const executeXhsSearch = bundleExports.__webenvoy_module_xhs_search?.executeXhsSearch;
  expect(executeXhsSearch).toEqual(expect.any(Function));

  return executeXhsSearch?.(
    {
      abilityId: "xhs.note.search.v1",
      abilityLayer: "L3",
      abilityAction: "read",
      params: {
        query: "露营装备"
      },
      options: {
        issue_scope: "issue_209",
        target_domain: "www.xiaohongshu.com",
        target_tab_id: 8,
        target_page: "search_result_tab",
        actual_target_domain: "www.xiaohongshu.com",
        actual_target_tab_id: 8,
        actual_target_page: "search_result_tab",
        action_type: "read",
        risk_state: "limited",
        requested_execution_mode: "dry_run"
      },
      executionContext: {
        runId: "run-staged-bundled-search-001",
        sessionId: "nm-session-staged-bundled-search-001",
        profile: "profile-a"
      }
    },
    {
      now: () => 1_710_000_000_000,
      randomId: () => "staged-bundle-req-001",
      getLocationHref: () => "https://www.xiaohongshu.com/search_result?keyword=%E9%9C%B2%E8%90%A5",
      getDocumentTitle: () => "Search Result",
      getReadyState: () => "complete"
    }
  );
};

const matchConstStringValue = (source: string, constantName: string): string | null => {
  const escapedName = constantName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matched = source.match(new RegExp(`const ${escapedName} = "([^"]+)";`));
  return matched ? matched[1] : null;
};

const MAIN_WORLD_EVENT_NAMESPACE = "webenvoy.main_world.bridge.v1";
const MAIN_WORLD_EVENT_REQUEST_PREFIX = "__mw_req__";
const MAIN_WORLD_EVENT_RESULT_PREFIX = "__mw_res__";

const hashMainWorldEventChannel = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

const resolveMainWorldEventNamesForSecret = (
  secret: string
): { requestEvent: string; resultEvent: string; namespaceEvent: string } => {
  const channel = hashMainWorldEventChannel(`${MAIN_WORLD_EVENT_NAMESPACE}|${secret}`);
  return {
    requestEvent: `${MAIN_WORLD_EVENT_REQUEST_PREFIX}${channel}`,
    resultEvent: `${MAIN_WORLD_EVENT_RESULT_PREFIX}${channel}`,
    namespaceEvent: `${"__mw_ns__"}${hashMainWorldEventChannel(
      `${MAIN_WORLD_EVENT_NAMESPACE}|namespace|${secret.trim()}`
    )}`
  };
};

const waitForExit = async (pid: number): Promise<void> => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ESRCH") {
        return;
      }
      throw error;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error(`process ${pid} did not exit in time`);
};

beforeAll(async () => {
  await acquireBrowserEnvTestLock();
}, 180_000);

beforeEach(() => {
  browserPathBeforeTest = process.env.WEBENVOY_BROWSER_PATH;
  browserMockLogBeforeTest = process.env.WEBENVOY_BROWSER_MOCK_LOG;
  browserMockVersionBeforeTest = process.env.WEBENVOY_BROWSER_MOCK_VERSION;
  realChromeBinBeforeTest = process.env.WEBENVOY_REAL_CHROME_BIN;
  realBrowserPathBeforeTest = process.env.WEBENVOY_REAL_BROWSER_PATH;
  browserVersionBeforeTest = process.env.WEBENVOY_BROWSER_VERSION;
  browserForceLaunchServicesBeforeTest = process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES;
  openPathBeforeTest = process.env.WEBENVOY_OPEN_PATH;
  pathBeforeTest = process.env.PATH;
  platformBeforeTest = process.platform;
});

afterEach(async () => {
  restoreEnv("WEBENVOY_BROWSER_PATH", browserPathBeforeTest);
  restoreEnv("WEBENVOY_BROWSER_MOCK_LOG", browserMockLogBeforeTest);
  restoreEnv("WEBENVOY_BROWSER_MOCK_VERSION", browserMockVersionBeforeTest);
  restoreEnv("WEBENVOY_REAL_CHROME_BIN", realChromeBinBeforeTest);
  restoreEnv("WEBENVOY_REAL_BROWSER_PATH", realBrowserPathBeforeTest);
  restoreEnv("WEBENVOY_BROWSER_VERSION", browserVersionBeforeTest);
  restoreEnv("WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES", browserForceLaunchServicesBeforeTest);
  restoreEnv("WEBENVOY_OPEN_PATH", openPathBeforeTest);
  if (pathBeforeTest === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = pathBeforeTest;
  }
  Object.defineProperty(process, "platform", { value: platformBeforeTest });
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

afterAll(async () => {
  await releaseBrowserEnvTestLock();
}, 180_000);

describe("browser-launcher", () => {
  it("prefers official Chrome over CFT and Chromium on darwin when no explicit browser path is set", () => {
    expect(resolvePreferredBrowserCandidates("darwin", null)).toEqual([
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ]);
  });

  it("binds fingerprint browser version probe to the resolved executable path", async () => {
    const resolvedExecutable = await createFixedVersionBrowserExecutable("Chromium 146.0.0.0");
    const unrelatedExecutable = await createFixedVersionBrowserExecutable("Chromium 999.0.0.0");
    process.env.WEBENVOY_BROWSER_PATH = resolvedExecutable;
    process.env.WEBENVOY_REAL_CHROME_BIN = unrelatedExecutable;
    process.env.WEBENVOY_REAL_BROWSER_PATH = unrelatedExecutable;
    process.env.WEBENVOY_BROWSER_VERSION = "Chromium 1.0.0.0";

    const versionOutput = await resolveBrowserVersionOutputForFingerprint();
    expect(versionOutput).toBe("Chromium 146.0.0.0");
  });

  it("resolves preferred browser version truth source from an explicit named browser command", async () => {
    const commandDir = await createVersionCommand("browser-wrapper", "Chromium 146.0.0.0");
    process.env.PATH = commandDir;
    process.env.WEBENVOY_BROWSER_PATH = "browser-wrapper";

    const truthSource = await resolvePreferredBrowserVersionTruthSource();
    expect(truthSource.executablePath).toBe(join(commandDir, "browser-wrapper"));
    expect(truthSource.browserVersion).toBe("Chromium 146.0.0.0");
  });

  it("launches browser executable with profile user-data-dir args", async () => {
    const { scriptPath, logPath } = await createMockBrowserExecutable();
    const profileBaseDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-profile-"));
    tempDirs.push(profileBaseDir);
    const profileDir = join(profileBaseDir, "nested", "profile");
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: "http://127.0.0.1:8080",
      runId: "run-launcher-test-001",
      params: {}
    });
    expect(launched.browserPath).toBe(scriptPath);
    expect(launched.browserPid).toBeGreaterThan(0);
    expect(launched.controllerPid).toBeGreaterThan(0);
    expect(launched.headless).toBe(true);
    expect(launched.executionSurface).toBe("headless_browser");
    const profileStat = await stat(profileDir);
    expect(profileStat.isDirectory()).toBe(true);

    const launchLog = await waitForLaunchLog(logPath);
    const launchArgs = parseLaunchArgs(launchLog);
    expect(launchArgs).toContain(`--user-data-dir=${profileDir}`);
    expect(launchArgs).toContain("--proxy-server=http://127.0.0.1:8080");
    expect(launchArgs).toContain("about:blank");
    const disableExtensionsExcept = findArgValue(launchArgs, "--disable-extensions-except=");
    const loadExtension = findArgValue(launchArgs, "--load-extension=");
    expect(disableExtensionsExcept).toBeTruthy();
    expect(loadExtension).toBeTruthy();
    expect(disableExtensionsExcept).toBe(loadExtension);
    const browserStateRaw = await readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8");
    const browserState = JSON.parse(browserStateRaw) as Record<string, unknown>;
    expect(browserState).toMatchObject({
      runId: "run-launcher-test-001",
      headless: true,
      executionSurface: "headless_browser"
    });

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-001"
    });
    await expect(readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(join(profileDir, BROWSER_CONTROL_FILENAME), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(
      stat(join(profileDir, EXTENSION_STAGING_DIRNAME))
    ).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("does not require a second version probe on the launch path", async () => {
    const { scriptPath, logPath } = await createVersionCountedBrowserExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-single-probe-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-single-probe-001",
      params: {}
    });

    const probeLog = await readFile(logPath, "utf8");
    const lines = probeLog
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    expect(lines.filter((line) => line === "version")).toHaveLength(1);
    expect(lines.filter((line) => line === "launch")).toHaveLength(1);

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-single-probe-001"
    });
  });

  it("launches official Chrome persistent mode without staged extension flags", async () => {
    const { scriptPath, logPath } = await createMockBrowserExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-official-persistent-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 146.0.7680.154";
    delete process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES;
    delete process.env.WEBENVOY_OPEN_PATH;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-persistent-001",
      params: {},
      launchMode: "official_chrome_persistent_extension"
    });

    const launchArgs = parseLaunchArgs(await waitForLaunchLog(logPath));
    expect(findArgValue(launchArgs, "--disable-extensions-except=")).toBeNull();
    expect(findArgValue(launchArgs, "--load-extension=")).toBeNull();

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-official-persistent-001"
    });
  });

  it("launches visible official Chrome through macOS LaunchServices when requested", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createMockOpenExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-official-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-open-001",
      params: {
        headless: false,
        startUrl: "about:blank"
      },
      launchMode: "official_chrome_persistent_extension"
    });

    const openArgs = parseLaunchArgs(await waitForLaunchLog(logPath));
    expect(openArgs.slice(0, 4)).toEqual(["-n", "-a", browserPath, "--args"]);
    expect(openArgs).toContain(`--user-data-dir=${profileDir}`);
    expect(openArgs).toContain("--profile-directory=Default");
    expect(openArgs).toContain("about:blank");
    expect(openArgs).not.toContain("--headless=new");
    expect(findArgValue(openArgs, "--disable-extensions-except=")).toBeNull();
    expect(findArgValue(openArgs, "--load-extension=")).toBeNull();
    expect(launched.executionSurface).toBe("real_browser");
    expect(launched.launchSurface).toBe("macos_launchservices");
    expect(launched.processOwnership).toBe("external_persistent_app");

    const browserStateRaw = await readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8");
    expect(JSON.parse(browserStateRaw)).toMatchObject({
      launchArgs: openArgs.slice(4),
      launchSurface: "macos_launchservices",
      processOwnership: "external_persistent_app"
    });

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-official-open-001"
    });
  });

  it("reuses an existing managed LaunchServices instance instead of opening a duplicate profile window", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createMockOpenExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-reuse-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    const firstLaunch = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-open-reuse-001",
      params: {
        headless: false,
        startUrl: "about:blank"
      },
      launchMode: "official_chrome_persistent_extension"
    });
    const secondLaunch = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-open-reuse-002",
      params: {
        headless: false,
        startUrl: "about:blank"
      },
      launchMode: "official_chrome_persistent_extension"
    });

    expect(secondLaunch.browserPid).toBe(firstLaunch.browserPid);
    expect(secondLaunch.controllerPid).toBe(firstLaunch.controllerPid);
    const openLogLines = (await readFile(logPath, "utf8"))
      .split("\n")
      .filter((line) => line.trim().length > 0);
    expect(openLogLines).toHaveLength(1);
    const browserStateRaw = await readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8");
    expect(JSON.parse(browserStateRaw)).toMatchObject({
      runId: "run-launcher-test-official-open-reuse-002",
      launchSurface: "macos_launchservices",
      processOwnership: "external_persistent_app"
    });

    await shutdownBrowserSession({
      profileDir,
      controllerPid: secondLaunch.controllerPid,
      runId: "run-launcher-test-official-open-reuse-002"
    });
  });

  it("pins LaunchServices managed state to the real Chrome profile lock owner", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createMockOpenExecutable({
      childOwnsProfileLock: true
    });
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-real-pid-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-open-real-pid-001",
      params: {
        headless: false,
        startUrl: "about:blank"
      },
      launchMode: "official_chrome_persistent_extension"
    });

    const browserStateRaw = await readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8");
    const browserState = JSON.parse(browserStateRaw) as {
      browserPid: number;
      controllerPid: number;
    };
    expect(browserState.browserPid).toBe(launched.browserPid);
    expect(browserState.controllerPid).toBe(launched.controllerPid);
    expect(launched.controllerPid).not.toBe(launched.browserPid);
    expect(() => process.kill(launched.browserPid, 0)).not.toThrow();

    try {
      await shutdownBrowserSession({
        profileDir,
        controllerPid: launched.controllerPid,
        runId: "run-launcher-test-official-open-real-pid-001"
      });
    } finally {
      try {
        process.kill(launched.browserPid, "SIGTERM");
      } catch {
        // ignore cleanup failure
      }
    }
  });

  it("refuses to reuse a managed LaunchServices instance when launch args change", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createMockOpenExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-arg-drift-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    const firstLaunch = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-open-arg-drift-001",
      params: {
        headless: false,
        startUrl: "about:blank"
      },
      launchMode: "official_chrome_persistent_extension"
    });

    await expect(
      launchBrowser({
        command: "runtime.start",
        profileDir,
        proxyUrl: "http://127.0.0.1:8081",
        runId: "run-launcher-test-official-open-arg-drift-002",
        params: {
          headless: false,
          startUrl: "about:blank"
        },
        launchMode: "official_chrome_persistent_extension"
      })
    ).rejects.toMatchObject({
      name: "BrowserLaunchError",
      code: "BROWSER_LAUNCH_FAILED"
    } satisfies Partial<BrowserLaunchError>);

    const openLogLines = (await readFile(logPath, "utf8"))
      .split("\n")
      .filter((line) => line.trim().length > 0);
    expect(openLogLines).toHaveLength(1);

    await shutdownBrowserSession({
      profileDir,
      controllerPid: firstLaunch.controllerPid,
      runId: "run-launcher-test-official-open-arg-drift-001"
    });
  });

  it("refuses LaunchServices startup when a profile lock exists without managed state", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createMockOpenExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-locked-"));
    tempDirs.push(profileDir);
    await symlink("mockhost-existing", join(profileDir, "SingletonLock"));
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    await expect(
      launchBrowser({
        command: "runtime.start",
        profileDir,
        proxyUrl: null,
        runId: "run-launcher-test-official-open-locked-001",
        params: {
          headless: false,
          startUrl: "about:blank"
        },
        launchMode: "official_chrome_persistent_extension"
      })
    ).rejects.toMatchObject({
      name: "BrowserLaunchError",
      code: "BROWSER_LAUNCH_FAILED"
    } satisfies Partial<BrowserLaunchError>);
    await expect(readFile(logPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("cleans stale Chrome singleton lock files before LaunchServices startup", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createMockOpenExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-stale-lock-"));
    tempDirs.push(profileDir);
    await symlink("mockhost-999999999", join(profileDir, "SingletonLock"));
    await symlink("stale-cookie", join(profileDir, "SingletonCookie"));
    await symlink("/tmp/webenvoy-stale-socket", join(profileDir, "SingletonSocket"));
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-open-stale-lock-001",
      params: {
        headless: false,
        startUrl: "about:blank"
      },
      launchMode: "official_chrome_persistent_extension"
    });

    const openArgs = parseLaunchArgs(await waitForLaunchLog(logPath));
    expect(openArgs.slice(0, 4)).toEqual(["-n", "-a", browserPath, "--args"]);
    expect(openArgs).toContain(`--user-data-dir=${profileDir}`);

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-official-open-stale-lock-001"
    });
  });

  it("does not require fresh profile markers for official Chrome LaunchServices readiness", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createMockOpenExecutable({
      skipProfileMarkers: true
    });
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-no-markers-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-open-no-markers-001",
      params: {
        headless: false,
        startUrl: "about:blank"
      },
      launchMode: "official_chrome_persistent_extension"
    });

    expect(launched.executionSurface).toBe("real_browser");
    expect(launched.launchSurface).toBe("macos_launchservices");
    expect(launched.processOwnership).toBe("external_persistent_app");

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-official-open-no-markers-001"
    });
  }, 10_000);

  it("cleans LaunchServices supervisor state without killing the external app wrapper", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createMockOpenExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-external-stop-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-open-external-stop-001",
      params: {
        headless: false,
        startUrl: "about:blank"
      },
      launchMode: "official_chrome_persistent_extension"
    });
    expect(launched.processOwnership).toBe("external_persistent_app");

    try {
      await shutdownBrowserSession({
        profileDir,
        controllerPid: launched.controllerPid,
        runId: "run-launcher-test-official-open-external-stop-001"
      });

      expect(() => process.kill(launched.browserPid, 0)).not.toThrow();
      await expect(readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
      await expect(readFile(join(profileDir, BROWSER_CONTROL_FILENAME), "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      try {
        process.kill(launched.browserPid, "SIGTERM");
      } catch {
        // The external wrapper may have already exited in a real LaunchServices environment.
      }
    }
  });

  it("cleans a failed LaunchServices startup and terminates the temporary wrapper", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createHangingMockOpenExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-failed-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    await expect(
      launchBrowser({
        command: "runtime.start",
        profileDir,
        proxyUrl: null,
        runId: "run-launcher-test-official-open-failed-001",
        params: {
          headless: false,
          startUrl: "about:blank"
        },
        launchMode: "official_chrome_persistent_extension"
      })
    ).rejects.toMatchObject({
      name: "BrowserLaunchError",
      code: "BROWSER_LAUNCH_FAILED"
    } satisfies Partial<BrowserLaunchError>);

    const launchRecord = parseLaunchRecord(await waitForLaunchLog(logPath));
    const wrapperPid = launchRecord.pid;
    expect(typeof wrapperPid).toBe("number");
    await waitForExit(wrapperPid as number);
    await expect(readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(join(profileDir, BROWSER_CONTROL_FILENAME), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  }, 20_000);

  it("rejects promptly when LaunchServices open exits with a failure", async () => {
    const { scriptPath: browserPath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const { scriptPath: openPath, logPath } = await createFailingMockOpenExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-open-exit-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_BROWSER_FORCE_LAUNCHSERVICES = "1";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    await expect(
      launchBrowser({
        command: "runtime.start",
        profileDir,
        proxyUrl: null,
        runId: "run-launcher-test-official-open-exit-001",
        params: {
          headless: false,
          startUrl: "about:blank"
        },
        launchMode: "official_chrome_persistent_extension"
      })
    ).rejects.toMatchObject({
      name: "BrowserLaunchError",
      code: "BROWSER_LAUNCH_FAILED"
    } satisfies Partial<BrowserLaunchError>);

    await waitForLaunchLog(logPath);
    await expect(readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("launches visible macOS official Chrome app path through LaunchServices by default", async () => {
    if (platformBeforeTest !== "darwin") {
      return;
    }
    const { scriptPath: browserExecutablePath } = await createMockBrowserExecutable(
      "Google Chrome 148.0.7778.98"
    );
    const browserPath = browserExecutablePath.replace(
      /mock-browser\.mjs$/,
      "Google Chrome.app/Contents/MacOS/Google Chrome"
    );
    await mkdir(dirname(browserPath), { recursive: true });
    await symlink(browserExecutablePath, browserPath);
    const { scriptPath: openPath, logPath } = await createMockOpenExecutable();
    const profileDir = await mkdtemp(
      join(tmpdir(), "webenvoy-browser-launcher-open-official-default-")
    );
    tempDirs.push(profileDir);
    Object.defineProperty(process, "platform", { value: "darwin" });
    process.env.WEBENVOY_BROWSER_PATH = browserPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    process.env.WEBENVOY_BROWSER_MOCK_VERSION = "Google Chrome 148.0.7778.98";
    process.env.WEBENVOY_OPEN_PATH = openPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-official-open-default-001",
      params: {
        headless: false,
        startUrl: "about:blank"
      },
      launchMode: "official_chrome_persistent_extension"
    });

    const openArgs = parseLaunchArgs(await waitForLaunchLog(logPath));
    expect(openArgs.slice(0, 4)).toEqual([
      "-n",
      "-a",
      dirname(dirname(dirname(browserPath))),
      "--args"
    ]);
    expect(openArgs).toContain(`--user-data-dir=${profileDir}`);
    expect(openArgs).not.toContain("--headless=new");
    expect(launched.executionSurface).toBe("real_browser");
    expect(launched.launchSurface).toBe("macos_launchservices");
    expect(launched.processOwnership).toBe("external_persistent_app");

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-official-open-default-001"
    });
  });

  it("stages per-run extension payload and writes bootstrap file", async () => {
    const { scriptPath, logPath } = await createMockBrowserExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-extension-stage-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    const extensionBootstrap = {
      fingerprint_profile_bundle: {
        ua: "unit-test-agent"
      },
      fingerprint_patch_manifest: {
        required_patches: ["audio_context"]
      }
    };

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-extension-stage-001",
      params: {},
      extensionBootstrap
    });

    const launchArgs = parseLaunchArgs(await waitForLaunchLog(logPath));
    const stagedExtensionPath = findArgValue(launchArgs, "--load-extension=");
    expect(stagedExtensionPath).toBeTruthy();
    expect(stagedExtensionPath).toContain(EXTENSION_STAGING_DIRNAME);
    expect(stagedExtensionPath).toContain("run-launcher-test-extension-stage-001");
    const manifestRaw = await readFile(join(stagedExtensionPath as string, "manifest.json"), "utf8");
    const manifest = JSON.parse(manifestRaw) as {
      content_scripts?: Array<{ world?: string; js?: string[] }>;
    };
    const contentScripts = manifest.content_scripts ?? [];
    const mainWorldEntry = contentScripts.find((entry) => entry.world === "MAIN");
    expect(mainWorldEntry?.js).toContain("build/main-world-bridge.js");
    const isolatedWorldEntry = contentScripts.find(
      (entry) => !entry.world || entry.world === "ISOLATED"
    );
    const isolatedWorldScripts = isolatedWorldEntry?.js ?? [];
    const bootstrapIndex = isolatedWorldScripts.indexOf(
      `build/${EXTENSION_BOOTSTRAP_SCRIPT_FILENAME}`
    );
    const contentScriptIndex = isolatedWorldScripts.indexOf("build/content-script.js");
    expect(bootstrapIndex).toBeGreaterThanOrEqual(0);
    expect(contentScriptIndex).toBeGreaterThanOrEqual(0);
    expect(bootstrapIndex).toBeLessThan(contentScriptIndex);
    const bootstrapRaw = await readFile(
      join(stagedExtensionPath as string, EXTENSION_BOOTSTRAP_FILENAME),
      "utf8"
    );
    const bootstrap = JSON.parse(bootstrapRaw) as {
      schemaVersion: number;
      runId: string;
      extension_bootstrap: Record<string, unknown> | null;
    };
    expect(bootstrap.schemaVersion).toBe(1);
    expect(bootstrap.runId).toBe("run-launcher-test-extension-stage-001");
    expect(bootstrap.extension_bootstrap).toEqual(extensionBootstrap);
    const bootstrapScriptRaw = await readFile(
      join(stagedExtensionPath as string, "build", EXTENSION_BOOTSTRAP_SCRIPT_FILENAME),
      "utf8"
    );
    expect(bootstrapScriptRaw).toContain(
      'const payloadKey = "__webenvoy_fingerprint_bootstrap_payload__";'
    );
    expect(bootstrapScriptRaw).toContain("bridge_bootstrap");
    expect(bootstrapScriptRaw).toContain('"required_patches":["audio_context"]');
    expect(bootstrapScriptRaw).toContain("Object.defineProperty");
    expect(bootstrapScriptRaw).not.toContain("__webenvoy_main_world_request__");
    expect(bootstrapScriptRaw).not.toContain("dispatchEvent");
    expect(bootstrapScriptRaw).not.toContain("__webenvoy_main_world_result__");
    expect(bootstrapScriptRaw).not.toContain('"run_id"');
    expect(bootstrapScriptRaw).not.toContain("startup-fingerprint-trust:");
    expect(bootstrapScriptRaw).not.toContain("unit-test-agent");
    const bundledContentScriptRaw = await readFile(
      join(stagedExtensionPath as string, "build", "content-script.js"),
      "utf8"
    );
    const mainWorldBridgeRaw = await readFile(
      join(stagedExtensionPath as string, "build", "main-world-bridge.js"),
      "utf8"
    );
    expect(bundledContentScriptRaw).not.toContain('import { ContentScriptHandler } from');
    expect(bundledContentScriptRaw).toContain("bootstrapContentScript");
    expect(bundledContentScriptRaw).toContain("WebEnvoy staged content script bundle");
    expect(bundledContentScriptRaw).toContain("__webenvoy_module_content_script");
    const payloadKey = matchConstStringValue(
      bundledContentScriptRaw,
      "FINGERPRINT_BOOTSTRAP_PAYLOAD_KEY"
    );
    const contentFallbackSecret = matchConstStringValue(
      bundledContentScriptRaw,
      "bridgeBootstrapFallbackSecret"
    );
    const expectedRequestEvent = matchConstStringValue(
      mainWorldBridgeRaw,
      "EXPECTED_MAIN_WORLD_REQUEST_EVENT"
    );
    const expectedResultEvent = matchConstStringValue(
      mainWorldBridgeRaw,
      "EXPECTED_MAIN_WORLD_RESULT_EVENT"
    );
    const expectedNamespaceEvent = matchConstStringValue(
      mainWorldBridgeRaw,
      "EXPECTED_MAIN_WORLD_NAMESPACE_EVENT"
    );
    expect(payloadKey).toBeTruthy();
    expect(payloadKey).toBe("__webenvoy_fingerprint_bootstrap_payload__");
    expect(contentFallbackSecret).toBeTruthy();
    expect(expectedRequestEvent).toBeTruthy();
    expect(expectedResultEvent).toBeTruthy();
    expect(expectedNamespaceEvent).toBeTruthy();
    const expectedEvents = resolveMainWorldEventNamesForSecret(contentFallbackSecret as string);
    expect(expectedRequestEvent).toBe(expectedEvents.requestEvent);
    expect(expectedResultEvent).toBe(expectedEvents.resultEvent);
    expect(expectedNamespaceEvent).toBe(expectedEvents.namespaceEvent);
    expect(bundledContentScriptRaw).toContain(
      "installMainWorldEventChannelSecret(bootstrapMainWorldSecret);"
    );
    expect(bundledContentScriptRaw).toContain(
      "typeof bootstrapPayload.bridge_bootstrap === \"string\""
    );
    expect(bundledContentScriptRaw).toContain(
      "const resolvedBootstrapChannelInstalled = installMainWorldEventChannelSecret("
    );
    expect(bundledContentScriptRaw).toContain("resolvedMainWorldSecret");
    expect(bundledContentScriptRaw).not.toContain("window.postMessage(");
    await expect(
      executeBundledDryRunSearch(join(stagedExtensionPath as string, "build", "content-script.js"))
    ).resolves.toMatchObject({
      ok: true,
      payload: {
        summary: {
          capability_result: {
            ability_id: "xhs.note.search.v1",
            outcome: "partial"
          }
        }
      }
    });
    expect(mainWorldBridgeRaw).toContain(
      `const EXPECTED_MAIN_WORLD_REQUEST_EVENT = "${expectedEvents.requestEvent}";`
    );
    expect(mainWorldBridgeRaw).toContain(
      `const EXPECTED_MAIN_WORLD_RESULT_EVENT = "${expectedEvents.resultEvent}";`
    );
    expect(mainWorldBridgeRaw).toContain(
      `const EXPECTED_MAIN_WORLD_NAMESPACE_EVENT = "${expectedEvents.namespaceEvent}";`
    );
    expect(mainWorldBridgeRaw).toContain(
      `const __webenvoy_install_key = Symbol.for("webenvoy.main_world.bridge.bundle.v1:${expectedEvents.requestEvent}");`
    );
    expect(mainWorldBridgeRaw).toContain(
      "requestEvent !== EXPECTED_MAIN_WORLD_REQUEST_EVENT ||"
    );
    expect(mainWorldBridgeRaw).toContain(
      "resultEvent !== EXPECTED_MAIN_WORLD_RESULT_EVENT"
    );
    expect(mainWorldBridgeRaw).toContain(
      "namespaceEvent !== EXPECTED_MAIN_WORLD_NAMESPACE_EVENT"
    );
    expect(bootstrapScriptRaw).toContain(`const payloadKey = "${payloadKey as string}";`);
    expect(bootstrapScriptRaw).toContain(
      `"bridge_bootstrap":"${contentFallbackSecret as string}"`
    );

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-extension-stage-001"
    });
  });

  it("keeps startup trust run/session/runtime inside staged content script instead of page bootstrap", async () => {
    const { scriptPath, logPath } = await createMockBrowserExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-startup-trust-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    const extensionBootstrap = {
      run_id: "run-launcher-startup-trust-001",
      session_id: "nm-session-777",
      fingerprint_runtime: {
        profile: "profile-a",
        source: "profile_meta",
        fingerprint_patch_manifest: {
          required_patches: ["audio_context"]
        },
        fingerprint_profile_bundle: {
          ua: "unit-test-agent"
        }
      }
    };

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-startup-trust-001",
      params: {},
      extensionBootstrap
    });

    const launchArgs = parseLaunchArgs(await waitForLaunchLog(logPath));
    const stagedExtensionPath = findArgValue(launchArgs, "--load-extension=");
    expect(stagedExtensionPath).toBeTruthy();
    const bootstrapScriptRaw = await readFile(
      join(stagedExtensionPath as string, "build", EXTENSION_BOOTSTRAP_SCRIPT_FILENAME),
      "utf8"
    );
    const bundledContentScriptRaw = await readFile(
      join(stagedExtensionPath as string, "build", "content-script.js"),
      "utf8"
    );

    expect(bootstrapScriptRaw).not.toContain('"session_id":"nm-session-777"');
    expect(bootstrapScriptRaw).not.toContain('"run_id":"run-launcher-startup-trust-001"');
    expect(bootstrapScriptRaw).not.toContain("unit-test-agent");
    expect(bundledContentScriptRaw).toContain(
      'const STAGED_STARTUP_TRUST_RUN_ID = "run-launcher-startup-trust-001";'
    );
    expect(bundledContentScriptRaw).toContain(
      'const STAGED_STARTUP_TRUST_SESSION_ID = "nm-session-777";'
    );
    expect(bundledContentScriptRaw).toContain("const STAGED_STARTUP_TRUST_FINGERPRINT_RUNTIME = {");
    expect(bundledContentScriptRaw).toContain('"profile":"profile-a"');
    expect(bundledContentScriptRaw).toContain('"required_patches":["audio_context"]');

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-startup-trust-001"
    });
  });

  it("persists launch surface audit with fingerprint profile and unsupported browser surfaces", async () => {
    const { scriptPath, logPath } = await createMockBrowserExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-surface-audit-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;
    const fingerprintRuntime = createFingerprintRuntimeContext();
    const fingerprintRuntimeWithExtraFields = {
      ...fingerprintRuntime,
      unbounded_secret_blob: "SHOULD_NOT_PERSIST_IN_LAUNCH_AUDIT"
    };

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: "http://127.0.0.1:8080",
      runId: "run-launcher-surface-audit-001",
      params: {
        startUrl: "https://example.com/",
        headless: false
      },
      extensionBootstrap: {
        run_id: "run-launcher-surface-audit-001",
        fingerprint_runtime: fingerprintRuntimeWithExtraFields
      }
    });

    expect("launchSurfaceAudit" in launched).toBe(false);

    const stateRaw = await readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8");
    const state = JSON.parse(stateRaw) as { launchSurfaceAudit?: unknown };
    expect(state.launchSurfaceAudit).toMatchObject({
      schemaVersion: 1,
      namespace: "webenvoy.browser_launch_surface_audit",
      executionSurface: "real_browser",
      headless: false,
      extensionBootstrapPresent: true,
      launchArgs: {
        userDataDirMatchesProfile: true,
        profileDirectoryIsDefault: true,
        headlessFlagPresent: false,
        loadExtensionPresent: true,
        disableExtensionsExceptPresent: true
      },
      fingerprintContext: {
        present: true,
        source: "extension_bootstrap",
        profileIdentityPresent: true,
        patchManifestPresent: true,
        consistencyCheckPresent: true,
        uaPresent: true,
        timezonePresent: true,
        environmentPresent: true
      },
      mismatchSurfaces: []
    });
    expect((state.launchSurfaceAudit as { reasonCodes?: unknown }).reasonCodes).toEqual(
      expect.arrayContaining([
        "CLIENT_HINTS_NOT_AUDITED",
        "LAUNCH_ARG_NOT_CONFIGURED",
        "NETWORK_WEBRTC_NOT_AUDITED"
      ])
    );
    expect((state.launchSurfaceAudit as { reasonCodes?: unknown }).reasonCodes).not.toContain(
      "PATCH_NOT_AVAILABLE"
    );
    expect((state.launchSurfaceAudit as { unsupportedSurfaces?: unknown }).unsupportedSurfaces).toEqual(
      expect.arrayContaining([
        "ua_client_hints",
        "locale_launch_arg",
        "timezone_launch_arg",
        "network_webrtc",
        "webrtc_network"
      ])
    );
    expect((state.launchSurfaceAudit as { surfaceChecks?: unknown }).surfaceChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: "ua_client_hints",
          decision: "unsupported",
          reasonCodes: ["CLIENT_HINTS_NOT_AUDITED"]
        }),
        expect.objectContaining({
          surface: "navigator_connection",
          decision: "match",
          reasonCodes: []
        }),
        expect.objectContaining({
          surface: "timezone_locale",
          decision: "unsupported",
          reasonCodes: ["LAUNCH_ARG_NOT_CONFIGURED"]
        })
      ])
    );
    expect(JSON.stringify(state.launchSurfaceAudit)).not.toContain(profileDir);
    expect(JSON.stringify(state.launchSurfaceAudit)).not.toContain(scriptPath);
    expect(JSON.stringify(state.launchSurfaceAudit)).not.toContain("https://example.com/");
    expect(JSON.stringify(state.launchSurfaceAudit)).not.toContain("Chrome/146.0.7680.154");
    expect(JSON.stringify(state.launchSurfaceAudit)).not.toContain(
      "SHOULD_NOT_PERSIST_IN_LAUNCH_AUDIT"
    );

    await writeFile(
      join(profileDir, BROWSER_STATE_FILENAME),
      `${JSON.stringify(
        {
          ...(JSON.parse(stateRaw) as Record<string, unknown>),
          launchSurfaceAudit: {
            ...(state.launchSurfaceAudit as Record<string, unknown>),
            browserPath: scriptPath,
            profileDir,
            launchArgs: {
              ...((state.launchSurfaceAudit as { launchArgs: Record<string, unknown> })
                .launchArgs),
              startUrl: "https://example.com/"
            },
            fingerprintContext: {
              ...((state.launchSurfaceAudit as { fingerprintContext: Record<string, unknown> })
                .fingerprintContext),
              ua: fingerprintRuntime.fingerprint_profile_bundle.ua
            }
          },
          runId: "run-launcher-surface-audit-002"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const reused = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: "http://127.0.0.1:8080",
      runId: "run-launcher-surface-audit-002",
      params: {
        startUrl: "https://example.com/",
        headless: false
      },
      extensionBootstrap: {
        run_id: "run-launcher-surface-audit-002",
        fingerprint_runtime: fingerprintRuntimeWithExtraFields
      }
    });
    expect("launchSurfaceAudit" in reused).toBe(false);
    const reusedStateRaw = await readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8");
    const reusedState = JSON.parse(reusedStateRaw) as { launchSurfaceAudit?: unknown };
    expect(JSON.stringify(reusedState.launchSurfaceAudit)).not.toContain(profileDir);
    expect(JSON.stringify(reusedState.launchSurfaceAudit)).not.toContain(scriptPath);
    expect(JSON.stringify(reusedState.launchSurfaceAudit)).not.toContain("https://example.com/");
    expect(JSON.stringify(reusedState.launchSurfaceAudit)).not.toContain("Chrome/146.0.7680.154");
    expect(JSON.stringify(reusedState.launchSurfaceAudit)).not.toContain(
      "SHOULD_NOT_PERSIST_IN_LAUNCH_AUDIT"
    );
    expect((await readdir(profileDir)).filter((entry) => entry.endsWith(".tmp"))).toEqual([]);

    const legacyAudit = JSON.parse(JSON.stringify(reusedState.launchSurfaceAudit)) as Record<
      string,
      unknown
    >;
    delete legacyAudit.reasonCodes;
    if (
      typeof legacyAudit.fingerprintContext === "object" &&
      legacyAudit.fingerprintContext !== null &&
      !Array.isArray(legacyAudit.fingerprintContext)
    ) {
      delete (legacyAudit.fingerprintContext as Record<string, unknown>).profileIdentityPresent;
      delete (legacyAudit.fingerprintContext as Record<string, unknown>).patchManifestPresent;
      delete (legacyAudit.fingerprintContext as Record<string, unknown>).consistencyCheckPresent;
    }
    if (Array.isArray(legacyAudit.surfaceChecks)) {
      for (const check of legacyAudit.surfaceChecks) {
        if (typeof check === "object" && check !== null && !Array.isArray(check)) {
          delete (check as Record<string, unknown>).reasonCodes;
        }
      }
    }
    await writeFile(
      join(profileDir, BROWSER_STATE_FILENAME),
      `${JSON.stringify(
        {
          ...(JSON.parse(reusedStateRaw) as Record<string, unknown>),
          launchSurfaceAudit: legacyAudit,
          runId: "run-launcher-surface-audit-003"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const reusedWithLegacyAudit = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: "http://127.0.0.1:8080",
      runId: "run-launcher-surface-audit-003",
      params: {
        startUrl: "https://example.com/",
        headless: false
      },
      extensionBootstrap: {
        run_id: "run-launcher-surface-audit-003",
        fingerprint_runtime: fingerprintRuntimeWithExtraFields
      }
    });
    expect("launchSurfaceAudit" in reusedWithLegacyAudit).toBe(false);
    const legacyAuditStateRaw = await readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8");
    const legacyAuditState = JSON.parse(legacyAuditStateRaw) as { launchSurfaceAudit?: unknown };
    expect(legacyAuditState.launchSurfaceAudit).toMatchObject({
      fingerprintContext: {
        profileIdentityPresent: true,
        patchManifestPresent: true,
        consistencyCheckPresent: true
      },
      reasonCodes: expect.arrayContaining(["CLIENT_HINTS_NOT_AUDITED"])
    });

    await writeFile(
      join(profileDir, BROWSER_STATE_FILENAME),
      `${JSON.stringify(
        {
          ...(JSON.parse(legacyAuditStateRaw) as Record<string, unknown>),
          launchSurfaceAudit: {
            schemaVersion: 1,
            malformed: true
          },
          runId: "run-launcher-surface-audit-004"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const reusedWithInvalidAudit = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: "http://127.0.0.1:8080",
      runId: "run-launcher-surface-audit-004",
      params: {
        startUrl: "https://example.com/",
        headless: false
      },
      extensionBootstrap: {
        run_id: "run-launcher-surface-audit-004",
        fingerprint_runtime: fingerprintRuntimeWithExtraFields
      }
    });
    expect("launchSurfaceAudit" in reusedWithInvalidAudit).toBe(false);
    const invalidAuditStateRaw = await readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8");
    const invalidAuditState = JSON.parse(invalidAuditStateRaw) as { launchSurfaceAudit?: unknown };
    expect(JSON.stringify(invalidAuditState.launchSurfaceAudit)).not.toContain("malformed");

    await shutdownBrowserSession({
      profileDir,
      controllerPid: reusedWithInvalidAudit.controllerPid,
      runId: "run-launcher-surface-audit-004"
    });
  }, 10_000);

  it("records controlled launch audit reasons when fingerprint profile context is absent", async () => {
    const { scriptPath, logPath } = await createMockBrowserExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-audit-absent-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-surface-audit-absent-001",
      params: {
        headless: false
      }
    });

    const stateRaw = await readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8");
    const state = JSON.parse(stateRaw) as { launchSurfaceAudit?: unknown };
    expect(state.launchSurfaceAudit).toMatchObject({
      fingerprintContext: {
        present: false,
        source: "none",
        profileIdentityPresent: false,
        patchManifestPresent: false,
        consistencyCheckPresent: false,
        uaPresent: false,
        timezonePresent: false,
        environmentPresent: false
      },
      reasonCodes: expect.arrayContaining([
        "FINGERPRINT_CONTEXT_MISSING",
        "PATCH_NOT_AVAILABLE",
        "PROFILE_IDENTITY_MISSING"
      ])
    });
    expect((state.launchSurfaceAudit as { surfaceChecks?: unknown }).surfaceChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: "profile_binding",
          decision: "unsupported",
          reasonCodes: expect.arrayContaining([
            "FINGERPRINT_CONTEXT_MISSING",
            "PROFILE_IDENTITY_MISSING"
          ])
        }),
        expect.objectContaining({
          surface: "navigator_connection",
          decision: "unsupported",
          reasonCodes: ["FINGERPRINT_CONTEXT_MISSING", "PATCH_NOT_AVAILABLE"]
        })
      ])
    );
    expect(JSON.stringify(state.launchSurfaceAudit)).not.toContain(profileDir);
    expect(JSON.stringify(state.launchSurfaceAudit)).not.toContain(scriptPath);

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-surface-audit-absent-001"
    });
  }, 10_000);

  it("generates unique bridge secret for each staged run", async () => {
    const { scriptPath: scriptPathA, logPath: logPathA } = await createMockBrowserExecutable();
    const { scriptPath: scriptPathB, logPath: logPathB } = await createMockBrowserExecutable();
    const profileDirA = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-secret-a-"));
    const profileDirB = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-secret-b-"));
    tempDirs.push(profileDirA, profileDirB);
    process.env.WEBENVOY_BROWSER_PATH = scriptPathA;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPathA;

    const launchA = await launchBrowser({
      command: "runtime.start",
      profileDir: profileDirA,
      proxyUrl: null,
      runId: "run-launcher-test-secret-001",
      params: {}
    });
    const launchArgsA = parseLaunchArgs(await waitForLaunchLog(logPathA));
    const stagedExtensionPathA = findArgValue(launchArgsA, "--load-extension=");
    expect(stagedExtensionPathA).toBeTruthy();
    const bundledContentScriptA = await readFile(
      join(stagedExtensionPathA as string, "build", "content-script.js"),
      "utf8"
    );
    const bridgeSecretA = matchConstStringValue(
      bundledContentScriptA,
      "bridgeBootstrapFallbackSecret"
    );
    expect(bridgeSecretA).toBeTruthy();
    await shutdownBrowserSession({
      profileDir: profileDirA,
      controllerPid: launchA.controllerPid,
      runId: "run-launcher-test-secret-001"
    });

    process.env.WEBENVOY_BROWSER_PATH = scriptPathB;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPathB;
    const launchB = await launchBrowser({
      command: "runtime.start",
      profileDir: profileDirB,
      proxyUrl: null,
      runId: "run-launcher-test-secret-002",
      params: {}
    });
    const launchArgsB = parseLaunchArgs(await waitForLaunchLog(logPathB));
    const stagedExtensionPathB = findArgValue(launchArgsB, "--load-extension=");
    expect(stagedExtensionPathB).toBeTruthy();
    const bundledContentScriptB = await readFile(
      join(stagedExtensionPathB as string, "build", "content-script.js"),
      "utf8"
    );
    const bridgeSecretB = matchConstStringValue(
      bundledContentScriptB,
      "bridgeBootstrapFallbackSecret"
    );
    expect(bridgeSecretB).toBeTruthy();
    expect(bridgeSecretB).not.toBe(bridgeSecretA);
    await shutdownBrowserSession({
      profileDir: profileDirB,
      controllerPid: launchB.controllerPid,
      runId: "run-launcher-test-secret-002"
    });
  }, 10_000);

  it("rejects invalid startUrl", async () => {
    const { scriptPath } = await createMockBrowserExecutable();
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;

    await expect(
      launchBrowser({
        command: "runtime.start",
        profileDir: join(tmpdir(), "webenvoy-browser-launcher-profile-invalid"),
        proxyUrl: null,
        runId: "run-launcher-test-002",
        params: {
          startUrl: "javascript:alert(1)"
        }
      })
    ).rejects.toMatchObject({
      name: "BrowserLaunchError",
      code: "BROWSER_INVALID_ARGUMENT"
    } satisfies Partial<BrowserLaunchError>);
  });

  it("keeps runtime.login visible by default", async () => {
    const { scriptPath, logPath } = await createMockBrowserExecutable();
    const profileDir = join(tmpdir(), "webenvoy-browser-launcher-login-visible");
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;
    process.env.WEBENVOY_BROWSER_MOCK_LOG = logPath;

    const launched = await launchBrowser({
      command: "runtime.login",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-003",
      params: {
        headless: true
      }
    });

    const launchLog = await waitForLaunchLog(logPath);
    expect(launchLog).not.toContain("--headless=new");
    expect(launched.headless).toBe(false);
    expect(launched.executionSurface).toBe("real_browser");
    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-003"
    });
  });

  it("rejects request-scoped browserPath override", async () => {
    const { scriptPath } = await createMockBrowserExecutable();
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;

    await expect(
      launchBrowser({
        command: "runtime.start",
        profileDir: join(tmpdir(), "webenvoy-browser-launcher-reject-override"),
        proxyUrl: null,
        runId: "run-launcher-test-004",
        params: {
          browserPath: scriptPath
        }
      })
    ).rejects.toMatchObject({
      name: "BrowserLaunchError",
      code: "BROWSER_INVALID_ARGUMENT"
    } satisfies Partial<BrowserLaunchError>);
  });

  it("fails fast for branded Google Chrome 137+ when only WEBENVOY_BROWSER_PATH is provided", async () => {
    process.env.WEBENVOY_BROWSER_PATH =
      await createFixedVersionBrowserExecutable("Google Chrome 146.0.7680.154");

    await expect(
      launchBrowser({
        command: "runtime.start",
        profileDir: join(tmpdir(), "webenvoy-browser-launcher-branded-chrome"),
        proxyUrl: null,
        runId: "run-branded-chrome-unsupported",
        params: {}
      })
    ).rejects.toMatchObject({
      name: "BrowserLaunchError",
      code: "BROWSER_LAUNCH_FAILED"
    } satisfies Partial<BrowserLaunchError>);
  });

  it("does not false-fail ready markers on reused profile when fresh markers are written quickly", async () => {
    const { scriptPath } = await createMockBrowserExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-fast-markers-"));
    tempDirs.push(profileDir);
    await mkdir(join(profileDir, "Default"), { recursive: true });
    await writeFile(join(profileDir, "Local State"), "{\"stale\":true}", "utf8");
    await writeFile(join(profileDir, "Default", "Preferences"), "{\"stale\":true}", "utf8");
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-006",
      params: {}
    });

    expect(launched.controllerPid).toBeGreaterThan(0);
    expect(launched.browserPid).toBeGreaterThan(0);
    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-006"
    });
  });

  it("stops orphan browser directly when supervisor has already died", async () => {
    const { scriptPath } = await createMockBrowserExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-orphan-stop-"));
    tempDirs.push(profileDir);
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;

    const launched = await launchBrowser({
      command: "runtime.start",
      profileDir,
      proxyUrl: null,
      runId: "run-launcher-test-007",
      params: {}
    });

    process.kill(launched.controllerPid, "SIGKILL");
    await waitForExit(launched.controllerPid);

    await shutdownBrowserSession({
      profileDir,
      controllerPid: launched.controllerPid,
      runId: "run-launcher-test-007"
    });

    await waitForExit(launched.browserPid);
    await expect(readFile(join(profileDir, BROWSER_STATE_FILENAME), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(join(profileDir, BROWSER_CONTROL_FILENAME), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("rejects launch when existing profile markers are stale and browser exits quickly", async () => {
    const scriptPath = await createCrashBrowserExecutable();
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-browser-launcher-stale-profile-"));
    tempDirs.push(profileDir);
    await mkdir(join(profileDir, "Default"), { recursive: true });
    await writeFile(join(profileDir, "Local State"), "{}", "utf8");
    await writeFile(join(profileDir, "Default", "Preferences"), "{}", "utf8");
    process.env.WEBENVOY_BROWSER_PATH = scriptPath;

    await expect(
      launchBrowser({
        command: "runtime.start",
        profileDir,
        proxyUrl: null,
        runId: "run-launcher-test-005",
        params: {}
      })
    ).rejects.toMatchObject({
      name: "BrowserLaunchError",
      code: "BROWSER_LAUNCH_FAILED"
    } satisfies Partial<BrowserLaunchError>);
  });
});
