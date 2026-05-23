import { describe, expect, it } from "vitest";
import { repoRoot, binPath, mockBrowserPath, nativeHostMockPath, repoOwnedNativeHostEntryPath, browserStateFilename, tempDirs, resolveDatabaseSync, DatabaseSync, itWithSqlite, createRuntimeCwd, createNativeHostManifest, seedInstalledPersistentExtension, defaultRuntimeEnv, runCli, expectBundledNativeHostStarts, createNativeHostCommand, createShellWrappedNativeHostCommand, PROFILE_MODE_ROOT_PREFERRED, quoteLauncherExportValue, resolveCanonicalExpectedProfileDir, expectProfileRootOnlyLauncherContract, expectDualEnvRootPreferredLauncherContract, runGit, createGitWorktreePair, runCliAsync, parseSingleJsonLine, encodeNativeBridgeEnvelope, readSingleNativeBridgeEnvelope, asRecord, resolveCliGateEnvelope, resolveWriteInteractionTier, scopedXhsGateOptions, assertLockMissing, detectSystemChromePath, wait, runHeadlessDomProbe, realBrowserContractsEnabled, BROWSER_STATE_FILENAME, BROWSER_CONTROL_FILENAME, isPidAlive, scopedReadGateOptions, path, readFile, writeFile, mkdir, realpath, rm, stat, chmod, symlink, spawn, spawnSync, createServer, createRequire, tmpdir, type DatabaseSyncCtor } from "./cli.contract.shared.js";

describe("webenvoy cli contract / runtime basics", () => {
  it("returns success json for runtime.ping", () => {
    const result = runCli(["runtime.ping", "--run-id", "run-contract-001"], {
      WEBENVOY_NATIVE_TRANSPORT: "loopback"
    });
    expect(result.status).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-001",
      command: "runtime.ping",
      status: "success",
      observability: {
        coverage: "unavailable",
        request_evidence: "none",
        page_state: null,
        key_requests: [],
        failure_site: null
      }
    });
    expect(typeof body.timestamp).toBe("string");
  }, 10_000);

  it("returns structured runtime unavailable when runtime store is unavailable", () => {
    const result = runCli(["runtime.ping", "--run-id", "run-contract-store-warning-001"], {
      WEBENVOY_NATIVE_TRANSPORT: "loopback",
      WEBENVOY_RUNTIME_STORE_FORCE_UNAVAILABLE: "1"
    });

    expect(result.status).toBe(5);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-store-warning-001",
      command: "runtime.ping",
      status: "error",
      error: {
        code: "ERR_RUNTIME_UNAVAILABLE",
        retryable: true
      }
    });
    expect(String((body.error as Record<string, unknown>).message)).toContain(
      "ERR_RUNTIME_STORE_UNAVAILABLE"
    );
    expect(result.stderr).toBe("");
  });

  it("returns unknown command error with code 3", () => {
    const result = runCli(["runtime.unknown"]);
    expect(result.status).toBe(3);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      status: "error",
      error: { code: "ERR_CLI_UNKNOWN_COMMAND" }
    });
  });

});
