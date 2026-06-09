import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { repoRoot, binPath, mockBrowserPath, nativeHostMockPath, repoOwnedNativeHostEntryPath, browserStateFilename, tempDirs, resolveDatabaseSync, DatabaseSync, itWithSqlite, createRuntimeCwd, createNativeHostManifest, seedInstalledPersistentExtension, defaultRuntimeEnv, runCli, expectBundledNativeHostStarts, createNativeHostCommand, createShellWrappedNativeHostCommand, PROFILE_MODE_ROOT_PREFERRED, quoteLauncherExportValue, resolveCanonicalExpectedProfileDir, expectProfileRootOnlyLauncherContract, expectDualEnvRootPreferredLauncherContract, runGit, createGitWorktreePair, runCliAsync, parseSingleJsonLine, encodeNativeBridgeEnvelope, readSingleNativeBridgeEnvelope, asRecord, resolveCliGateEnvelope, resolveWriteInteractionTier, scopedXhsGateOptions, assertLockMissing, detectSystemChromePath, wait, runHeadlessDomProbe, realBrowserContractsEnabled, BROWSER_STATE_FILENAME, BROWSER_CONTROL_FILENAME, isPidAlive, scopedReadGateOptions, path, readFile, writeFile, mkdir, realpath, rm, stat, chmod, symlink, spawn, spawnSync, createServer, createRequire, tmpdir, resolveRuntimeStorePath, type DatabaseSyncCtor } from "./cli.contract.shared.js";
import { SQLiteRuntimeStore } from "../src/runtime/store/sqlite-runtime-store.js";
import { ACTIVE_SERVICE_WORKER_CODE_IDENTITY_OBSERVATION_FILENAME } from "../src/runtime/persistent-extension-identity-install.js";

const startOfficialReadyRuntime = async (
  runtimeCwd: string,
  profile: string,
  runId: string
): Promise<Record<string, unknown>> => {
  const extensionId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const manifestPath = await createNativeHostManifest({
    allowedOrigins: [`chrome-extension://${extensionId}/`]
  });
  const seedFreshPersistentExtension = async (): Promise<void> => {
    await seedInstalledPersistentExtension({
      cwd: runtimeCwd,
      profile,
      extensionId,
      runId
    });
    const profileDir = path.join(runtimeCwd, ".webenvoy", "profiles", profile);
    const defaultDir = path.join(profileDir, "Default");
    const extensionDir = path.join(runtimeCwd, "extension");
    const extensionBuildFile = path.join(extensionDir, "build", "background.js");
    const serviceWorkerRoot = path.join(defaultDir, "Service Worker");
    const serviceWorkerFile = path.join(
      serviceWorkerRoot,
      "ScriptCache",
      `${extensionId}-service-worker.js`
    );
    const serviceWorkerScript = "globalThis.__webenvoyBuild = 'ready';\n";
    await mkdir(path.dirname(extensionBuildFile), { recursive: true });
    await mkdir(path.dirname(serviceWorkerFile), { recursive: true });
    await writeFile(path.join(extensionDir, "manifest.json"), "{\n  \"manifest_version\": 3\n}\n");
    await writeFile(extensionBuildFile, serviceWorkerScript);
    await writeFile(serviceWorkerFile, serviceWorkerScript);
    await writeFile(
      path.join(serviceWorkerRoot, ACTIVE_SERVICE_WORKER_CODE_IDENTITY_OBSERVATION_FILENAME),
      `${JSON.stringify(
        {
          extension_id: extensionId,
          run_id: runId,
          lifecycle_state: "active_worker_observed",
          observed_active_service_worker_script_identity_locator:
            `extension-service-worker/official-chrome.persistent/${extensionId}/active/background`,
          observed_service_worker_code_digest_locator:
            `sha256:${createHash("sha256").update(serviceWorkerScript).digest("hex")}`,
          observed_at: new Date().toISOString()
        },
        null,
        2
      )}\n`
    );
    await writeFile(
      path.join(defaultDir, "Preferences"),
      `${JSON.stringify(
        {
          extensions: {
            settings: {
              [extensionId]: {
                state: 1,
                location: 4,
                path: extensionDir
              }
            }
          }
        },
        null,
        2
      )}\n`
    );
  };
  await seedFreshPersistentExtension();
  const persistentExtensionIdentity = {
    extension_id: extensionId,
    manifest_path: manifestPath
  };
  const start = runCli(
    [
      "runtime.start",
      "--profile",
      profile,
      "--run-id",
      runId,
      "--params",
      JSON.stringify({
        headless: false,
        startUrl: "https://www.xiaohongshu.com/search_result/?keyword=test&type=51",
        persistent_extension_identity: persistentExtensionIdentity
      })
    ],
    runtimeCwd,
    {
      WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
      WEBENVOY_BROWSER_MOCK_TTL: "10",
      WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
      WEBENVOY_NATIVE_HOST_MODE: "bootstrap-ack-timeout-error"
    }
  );
  expect(start.status).toBe(0);
  expect(parseSingleJsonLine(start.stdout)).toMatchObject({
    command: "runtime.start",
    status: "success",
    summary: {
      profile,
      identityBindingState: "bound",
      transportState: "ready"
    }
  });
  await seedFreshPersistentExtension();
  return persistentExtensionIdentity;
};

const seedReadyXhsCloseoutValidationViews = async (
  cwd: string,
  profile: string,
  options: {
    effectiveExecutionMode?: "live_read_high_risk" | "live_write";
    probeBundleRef?: string;
  } = {}
): Promise<void> => {
  const store = new SQLiteRuntimeStore(resolveRuntimeStorePath(cwd));
  const observedAt = "2026-04-30T02:00:00.000Z";
  const effectiveExecutionMode = options.effectiveExecutionMode ?? "live_read_high_risk";
  const probeBundleRef = options.probeBundleRef ?? "probe-bundle/xhs-closeout-min-v1";
  const scopes = [
    ["FR-0012", "layer1_consistency"],
    ["FR-0013", "layer2_interaction"],
    ["FR-0014", "layer3_session_rhythm"]
  ] as const;
  try {
    for (const [targetFrRef, validationScope] of scopes) {
      const requestRef = `validation-request/restore-stale/${profile}/${targetFrRef}`;
      const sampleRef = `validation-sample/restore-stale/${profile}/${targetFrRef}`;
      const baselineRef = `baseline/restore-stale/${profile}/${targetFrRef}`;
      const recordRef = `validation-record/restore-stale/${profile}/${targetFrRef}`;
      const scope = {
        targetFrRef,
        validationScope,
        profileRef: `profile/${profile}`,
        browserChannel: "Google Chrome stable" as const,
        executionSurface: "real_browser" as const,
        effectiveExecutionMode,
        probeBundleRef
      };
      await store.upsertAntiDetectionValidationRequest({
        ...scope,
        requestRef,
        sampleGoal: `restore stale bootstrap ${targetFrRef}`,
        requestedExecutionMode: effectiveExecutionMode,
        requestState: "accepted",
        requestedAt: observedAt
      });
      await store.upsertAntiDetectionValidationRequest({
        ...scope,
        requestRef,
        sampleGoal: `restore stale bootstrap ${targetFrRef}`,
        requestedExecutionMode: effectiveExecutionMode,
        requestState: "completed",
        requestedAt: observedAt
      });
      await store.insertAntiDetectionStructuredSample({
        ...scope,
        sampleRef,
        requestRef,
        runId: `run-restore-stale-validation-${targetFrRef}`,
        capturedAt: observedAt,
        structuredPayload: { target_fr_ref: targetFrRef, validation_scope: validationScope },
        artifactRefs: []
      });
      await store.insertAntiDetectionBaselineSnapshot({
        ...scope,
        baselineRef,
        signalVector: { stable: true },
        capturedAt: observedAt,
        sourceSampleRefs: [sampleRef],
        sourceRunIds: [`run-restore-stale-validation-${targetFrRef}`]
      });
      await store.insertAntiDetectionValidationRecord({
        ...scope,
        recordRef,
        requestRef,
        sampleRef,
        baselineRef,
        resultState: "verified",
        driftState: "no_drift",
        failureClass: null,
        runId: `run-restore-stale-validation-${targetFrRef}`,
        validatedAt: observedAt
      });
      await store.upsertAntiDetectionBaselineRegistryEntry({
        ...scope,
        activeBaselineRef: baselineRef,
        supersededBaselineRefs: [],
        replacementReason: "initial_seed",
        updatedAt: observedAt
      });
    }
  } finally {
    store.close();
  }
};

describe("webenvoy cli contract / runtime errors and fallback", () => {
  it("requires profile for xhs.search", () => {
    const result = runCli([
      "xhs.search",
      "--params",
      JSON.stringify({
        ability: {
          id: "xhs.note.search.v1",
          layer: "L3",
          action: "read"
        },
        input: {
          query: "露营装备"
        }
      })
    ]);
    expect(result.status).toBe(2);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      command: "xhs.search",
      status: "error",
      error: {
        code: "ERR_CLI_INVALID_ARGS"
      }
    });
  });

  it("returns invalid args error with code 2", () => {
    const result = runCli(["runtime.ping", "--params", "not-json"]);
    expect(result.status).toBe(2);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      status: "error",
      error: { code: "ERR_CLI_INVALID_ARGS" }
    });
  });

  it("cleans lock when runtime.start fails by invalid proxyUrl", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profileName = "invalid_proxy_profile";
    const result = runCli(
      [
        "runtime.start",
        "--profile",
        profileName,
        "--run-id",
        "run-contract-006",
        "--params",
        '{"proxyUrl":"not-a-url"}'
      ],
      runtimeCwd
    );
    expect(result.status).toBe(5);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      command: "runtime.start",
      status: "error",
      error: { code: "ERR_PROFILE_INVALID" }
    });
    await assertLockMissing(path.join(runtimeCwd, ".webenvoy", "profiles", profileName));
  });

  it("rejects empty proxyUrl for runtime.start and runtime.login", async () => {
    const runtimeCwd = await createRuntimeCwd();

    const start = runCli(
      [
        "runtime.start",
        "--profile",
        "empty_proxy_profile",
        "--run-id",
        "run-contract-007",
        "--params",
        "{\"proxyUrl\":\"\"}"
      ],
      runtimeCwd
    );
    expect(start.status).toBe(5);
    const startBody = parseSingleJsonLine(start.stdout);
    expect(startBody).toMatchObject({
      command: "runtime.start",
      status: "error",
      error: { code: "ERR_PROFILE_INVALID" }
    });

    const login = runCli(
      [
        "runtime.login",
        "--profile",
        "empty_proxy_profile",
        "--run-id",
        "run-contract-008",
        "--params",
        "{\"proxyUrl\":\"   \"}"
      ],
      runtimeCwd
    );
    expect(login.status).toBe(5);
    const loginBody = parseSingleJsonLine(login.stdout);
    expect(loginBody).toMatchObject({
      command: "runtime.login",
      status: "error",
      error: { code: "ERR_PROFILE_INVALID" }
    });
  });

  it("rejects explicit proxyUrl:null when profile is already bound to a proxy", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const startWithProxy = runCli(
      [
        "runtime.start",
        "--profile",
        "proxy_null_conflict_profile",
        "--run-id",
        "run-contract-009",
        "--params",
        "{\"proxyUrl\":\"http://127.0.0.1:8080\"}"
      ],
      runtimeCwd
    );
    expect(startWithProxy.status).toBe(0);
    const startBody = parseSingleJsonLine(startWithProxy.stdout);
    const startSummary = startBody.summary as Record<string, unknown>;
    const profileDir = String(startSummary.profileDir);

    const stop = runCli(
      ["runtime.stop", "--profile", "proxy_null_conflict_profile", "--run-id", "run-contract-009"],
      runtimeCwd
    );
    expect(stop.status).toBe(0);

    const restartWithNull = runCli(
      [
        "runtime.start",
        "--profile",
        "proxy_null_conflict_profile",
        "--run-id",
        "run-contract-010",
        "--params",
        "{\"proxyUrl\":null}"
      ],
      runtimeCwd
    );
    expect(restartWithNull.status).toBe(5);
    const restartBody = parseSingleJsonLine(restartWithNull.stdout);
    expect(restartBody).toMatchObject({
      command: "runtime.start",
      status: "error",
      error: { code: "ERR_PROFILE_PROXY_CONFLICT" }
    });

    const metaPath = path.join(profileDir, "__webenvoy_meta.json");
    const metaRaw = await readFile(metaPath, "utf8");
    const meta = JSON.parse(metaRaw) as Record<string, unknown>;
    const proxyBinding = meta.proxyBinding as Record<string, unknown>;
    expect(proxyBinding.url).toBe("http://127.0.0.1:8080/");
  });

  it("returns runtime unavailable error with code 5", () => {
    const result = runCli([
      "runtime.ping",
      "--params",
      '{"simulate_runtime_unavailable":true}',
      "--run-id",
      "run-contract-005"
    ]);
    expect(result.status).toBe(5);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-005",
      status: "error",
      error: {
        code: "ERR_RUNTIME_UNAVAILABLE",
        retryable: true,
        diagnosis: {
          category: "runtime_unavailable",
          stage: "runtime",
          component: "cli"
        }
      },
      observability: {
        coverage: "unavailable",
        request_evidence: "none",
        page_state: null,
        key_requests: [],
        failure_site: null
      }
    });
  });

  itWithSqlite("returns structured runtime unavailable when runtime store schema mismatches", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const bootstrap = runCli(
      ["runtime.ping", "--run-id", "run-contract-005a"],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "loopback"
      }
    );
    expect(bootstrap.status).toBe(0);

    const dbPath = path.join(runtimeCwd, ".webenvoy", "runtime", "store.sqlite");
    const DatabaseSyncCtor = DatabaseSync as DatabaseSyncCtor;
    const db = new DatabaseSyncCtor(dbPath);
    db.prepare("UPDATE runtime_store_meta SET value = '999' WHERE key = 'schema_version'").run();
    db.close();

    const result = runCli(
      ["runtime.ping", "--run-id", "run-contract-005b"],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "loopback"
      }
    );
    expect(result.status).toBe(5);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-005b",
      command: "runtime.ping",
      status: "error",
      error: { code: "ERR_RUNTIME_UNAVAILABLE", retryable: false }
    });
    expect(result.stderr).not.toContain("\"type\":\"runtime_store_warning\"");
  });

  itWithSqlite("returns structured runtime unavailable when runtime store write conflicts", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const bootstrap = runCli(
      ["runtime.ping", "--run-id", "run-contract-005c-bootstrap"],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "loopback"
      }
    );
    expect(bootstrap.status).toBe(0);

    const dbPath = path.join(runtimeCwd, ".webenvoy", "runtime", "store.sqlite");
    const DatabaseSyncCtor = DatabaseSync as DatabaseSyncCtor;
    const db = new DatabaseSyncCtor(dbPath);
    db.prepare("BEGIN IMMEDIATE").run();

    try {
      const result = runCli(
        ["runtime.ping", "--run-id", "run-contract-005c"],
        runtimeCwd,
        {
          WEBENVOY_NATIVE_TRANSPORT: "loopback"
        }
      );
      expect(result.status).toBe(5);
      const body = parseSingleJsonLine(result.stdout);
      expect(body).toMatchObject({
        run_id: "run-contract-005c",
        command: "runtime.ping",
        status: "error",
        error: { code: "ERR_RUNTIME_UNAVAILABLE", retryable: true }
      });
      expect(String((body.error as Record<string, unknown>).message)).toContain(
        "ERR_RUNTIME_STORE_CONFLICT"
      );
      expect(result.stderr).not.toContain("\"type\":\"runtime_store_warning\"");
    } finally {
      db.prepare("ROLLBACK").run();
      db.close();
    }
  });

  it("keeps runtime.ping on stdio fallback for profile when official socket mode is not required", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const result = runCli(
      [
        "runtime.ping",
        "--profile",
        "profile_stdio_fallback",
        "--run-id",
        "run-contract-profile-stdio-001"
      ],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "success"
      }
    );
    expect(result.status).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-profile-stdio-001",
      command: "runtime.ping",
      status: "success"
    });
  });

  it("preserves structured target restoration failure reasons on the CLI path", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        "xhs_001",
        "--run-id",
        "run-contract-restore-target-invalid-001",
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "explore_detail_tab",
          query: "露营"
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "restore-target-input-invalid"
      }
    );
    expect(result.status).toBe(6);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-restore-target-invalid-001",
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED",
        retryable: false,
        details: {
          ability_id: "runtime.restore_xhs_target",
          stage: "execution",
          reason: "TARGET_RESTORE_INPUT_INVALID",
          target_restore_details: {
            reason: "TARGET_RESTORE_INPUT_INVALID",
            target_domain: "www.xiaohongshu.com",
            target_page: "explore_detail_tab",
            active_fetch_performed: false,
            closeout_bundle_entered: false
          }
        }
      }
    });
  }, 20_000);

  it("keeps malformed encoded profile restore targets on the structured denial path", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        "xhs_001",
        "--run-id",
        "run-contract-restore-profile-target-malformed-001",
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "profile_tab",
          target_tab_id: 44,
          target_url: "https://www.xiaohongshu.com/user/profile/%E0%A4%A"
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "restore-target-input-invalid"
      }
    );
    expect(result.status).toBe(2);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-restore-profile-target-malformed-001",
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          ability_id: "runtime.restore_xhs_target",
          stage: "input_validation",
          reason: "TARGET_RESTORE_INPUT_INVALID"
        }
      }
    });
  });

  it("maps forwarded target restoration denials to execution failed instead of runtime unavailable", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        "xhs_001",
        "--run-id",
        "run-contract-restore-target-not-found-001",
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "explore_detail_tab",
          target_tab_id: 44,
          query: "露营"
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "restore-target-not-found"
      }
    );
    expect(result.status).toBe(6);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-restore-target-not-found-001",
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED",
        retryable: false,
        details: {
          ability_id: "runtime.restore_xhs_target",
          stage: "execution",
          reason: "TARGET_RESTORE_TARGET_TAB_NOT_FOUND",
          target_restore_details: {
            reason: "TARGET_RESTORE_TARGET_TAB_NOT_FOUND",
            requested_target_tab_id: 44,
            active_fetch_performed: false,
            closeout_bundle_entered: false
          }
        }
      }
    });
  });

  it("keeps restore tab query runtime failures as runtime unavailable", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        "xhs_001",
        "--run-id",
        "run-contract-restore-target-tab-query-failed-001",
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "explore_detail_tab",
          target_tab_id: 44,
          query: "露营"
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "restore-target-tab-query-failed"
      }
    );
    expect(result.status).toBe(5);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-restore-target-tab-query-failed-001",
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_RUNTIME_UNAVAILABLE",
        retryable: true,
        details: {
          ability_id: "runtime.restore_xhs_target",
          stage: "execution",
          reason: "TARGET_RESTORE_TAB_QUERY_FAILED",
          target_restore_details: {
            reason: "TARGET_RESTORE_TAB_QUERY_FAILED",
            requested_target_tab_id: 44,
            active_fetch_performed: false,
            closeout_bundle_entered: false
          }
        }
      }
    });
  });

  it("maps unavailable restored tab ids to execution failed instead of runtime unavailable", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        "xhs_001",
        "--run-id",
        "run-contract-restore-target-tab-id-unavailable-001",
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "explore_detail_tab",
          target_tab_id: 44,
          query: "露营"
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "restore-target-tab-id-unavailable"
      }
    );
    expect(result.status).toBe(6);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-restore-target-tab-id-unavailable-001",
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED",
        retryable: false,
        details: {
          ability_id: "runtime.restore_xhs_target",
          stage: "execution",
          reason: "TARGET_TAB_ID_UNAVAILABLE",
          target_restore_details: {
            reason: "TARGET_TAB_ID_UNAVAILABLE",
            active_fetch_performed: false,
            closeout_bundle_entered: false
          }
        }
      }
    });
  });

  it("requires target_tab_id before XHS target restoration can mutate tabs", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        "xhs_001",
        "--run-id",
        "run-contract-restore-target-tab-required-001",
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          query: "露营"
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "success"
      }
    );
    expect(result.status).toBe(2);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-restore-target-tab-required-001",
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_CLI_INVALID_ARGS",
        details: {
          ability_id: "runtime.restore_xhs_target",
          stage: "input_validation",
          reason: "TARGET_RESTORE_TARGET_TAB_REQUIRED"
        }
      }
    });
  });

  it("blocks XHS target restoration before tab mutation when validation baseline is missing", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      "xhs_restore_validation_blocked",
      "run-contract-restore-validation-blocked-001"
    );
    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        "xhs_restore_validation_blocked",
        "--run-id",
        "run-contract-restore-validation-blocked-001",
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:40:00.000Z",
          query: "露营",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );
    expect(result.status).toBe(6);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-restore-validation-blocked-001",
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED",
        details: {
          ability_id: "runtime.restore_xhs_target",
          stage: "execution",
          reason: expect.stringMatching(
            /^(ANTI_DETECTION_VALIDATION_BASELINE_BLOCKED|OFFICIAL_RUNTIME_NOT_READY)$/
          ),
          account_safety: expect.objectContaining({
            state: "clear"
          }),
          xhs_closeout_rhythm: expect.objectContaining({
            state: "not_required"
          }),
          anti_detection_validation_view: expect.objectContaining({
            all_required_ready: false
          })
        }
      }
    });
  });

  it("reports closeout runtime readiness as recoverable for an attachable official Chrome runtime", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_closeout_preflight_attachable";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      "run-contract-closeout-preflight-owner-001"
    );

    const result = runCli(
      [
        "runtime.closeout_preflight",
        "--profile",
        profile,
        "--run-id",
        "run-contract-closeout-preflight-next-001",
        "--params",
        JSON.stringify({
          requested_execution_mode: "live_read_high_risk",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );

    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-closeout-preflight-next-001",
      command: "runtime.closeout_preflight",
      status: "success",
      summary: {
        closeout_runtime_readiness_preflight: {
          decision: "RECOVERABLE",
          runtime_state: "recoverable",
          recovery_mode: "ready_attach",
          blocker: null,
          runtime_status: {
            identity_binding_state: "bound",
            transport_state: "ready",
            bootstrap_state: "ready",
            execution_surface: "real_browser",
            headless: false
          }
        }
      }
    });
  });

  it("reports closeout gate as GO only when runtime, target, account, rhythm, and validation are ready", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_closeout_gate_ready";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      "run-contract-closeout-gate-owner-001"
    );
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile);

    const result = runCli(
      [
        "runtime.closeout_gate",
        "--profile",
        profile,
        "--run-id",
        "run-contract-closeout-gate-owner-001",
        "--params",
        JSON.stringify({
          requested_execution_mode: "live_read_high_risk",
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );

    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-closeout-gate-owner-001",
      command: "runtime.closeout_gate",
      status: "success",
      summary: {
        closeout_gate_aggregator: {
          decision: "GO",
          blocker: null,
          gate_state: {
            account_safety_state: "clear",
            xhs_closeout_rhythm_state: "not_required",
            anti_detection_validation_ready: true,
            anti_detection_missing_target_fr_refs: [],
            runtime_decision: "GO",
            target_binding_state: "verified",
            execution_surface: "real_browser",
            headless: false
          }
        }
      }
    });
    expect(body.summary.anti_detection_validation_view).toMatchObject({
      effective_execution_mode: "live_read_high_risk",
      probe_bundle_ref: "probe-bundle/xhs-closeout-min-v1",
      all_required_ready: true
    });
  });

  it("reports closeout gate as NO_GO when validation baseline is missing", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_closeout_gate_validation_missing";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      "run-contract-closeout-gate-validation-missing-001"
    );

    const result = runCli(
      [
        "runtime.closeout_gate",
        "--profile",
        profile,
        "--run-id",
        "run-contract-closeout-gate-validation-missing-001",
        "--params",
        JSON.stringify({
          requested_execution_mode: "live_read_high_risk",
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );

    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-closeout-gate-validation-missing-001",
      command: "runtime.closeout_gate",
      status: "success",
      summary: {
        closeout_gate_aggregator: {
          decision: "NO_GO",
          blocker: {
            blocker_layer: "anti_detection_validation",
            blocker_code: "anti_detection_validation_baseline_blocked",
            required_recovery_action: "complete_fr_0012_fr_0013_fr_0014_validation_baseline"
          },
          gate_state: {
            anti_detection_validation_ready: false,
            anti_detection_missing_target_fr_refs: ["FR-0012", "FR-0013", "FR-0014"]
          }
        }
      }
    });
    expect(body.summary.anti_detection_validation_view).toMatchObject({
      effective_execution_mode: "live_read_high_risk",
      probe_bundle_ref: "probe-bundle/xhs-closeout-min-v1",
      all_required_ready: false
    });
  });

  it("uses the FR-0031 creator live_write probe bundle for creator publish admission", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_creator_live_write_gate_validation_missing";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      "run-contract-creator-live-write-gate-001"
    );

    const result = runCli(
      [
        "runtime.closeout_gate",
        "--profile",
        profile,
        "--run-id",
        "run-contract-creator-live-write-gate-001",
        "--params",
        JSON.stringify({
          requested_execution_mode: "live_write",
          target_domain: "creator.xiaohongshu.com",
          target_page: "creator_publish_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );

    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body.summary.anti_detection_validation_view).toMatchObject({
      effective_execution_mode: "live_write",
      probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
      all_required_ready: false,
      missing_target_fr_refs: ["FR-0012", "FR-0013", "FR-0014"]
    });
    expect(body.summary.closeout_gate_aggregator).toMatchObject({
      decision: "NO_GO",
      gate_state: {
        requested_execution_mode: "live_write",
        anti_detection_validation_ready: false,
        anti_detection_missing_target_fr_refs: ["FR-0012", "FR-0013", "FR-0014"]
      }
    });
  });

  it("does not let the read closeout baseline satisfy creator live_write admission", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_creator_live_write_read_baseline_only";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      "run-contract-creator-live-write-read-baseline-only-001"
    );
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile);

    const result = runCli(
      [
        "runtime.closeout_gate",
        "--profile",
        profile,
        "--run-id",
        "run-contract-creator-live-write-read-baseline-only-001",
        "--params",
        JSON.stringify({
          requested_execution_mode: "live_write",
          target_domain: "creator.xiaohongshu.com",
          target_page: "creator_publish_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );

    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body.summary.anti_detection_validation_view).toMatchObject({
      effective_execution_mode: "live_write",
      probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
      all_required_ready: false,
      missing_target_fr_refs: ["FR-0012", "FR-0013", "FR-0014"]
    });
    expect(body.summary.closeout_gate_aggregator).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "anti_detection_validation",
        blocker_code: "anti_detection_validation_baseline_blocked"
      }
    });
  });

  it("reports creator live_write closeout gate as GO when creator validation rows are ready", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_creator_live_write_gate_ready";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      "run-contract-creator-live-write-ready-001"
    );
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile, {
      effectiveExecutionMode: "live_write",
      probeBundleRef: "probe-bundle/xhs-creator-live-write-admission-v1"
    });

    const result = runCli(
      [
        "runtime.closeout_gate",
        "--profile",
        profile,
        "--run-id",
        "run-contract-creator-live-write-ready-001",
        "--params",
        JSON.stringify({
          requested_execution_mode: "live_write",
          target_domain: "creator.xiaohongshu.com",
          target_page: "creator_publish_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );

    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body.summary.anti_detection_validation_view).toMatchObject({
      effective_execution_mode: "live_write",
      probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
      all_required_ready: true,
      missing_target_fr_refs: []
    });
    expect(body.summary.closeout_gate_aggregator).toMatchObject({
      decision: "GO",
      blocker: null,
      gate_state: {
        requested_execution_mode: "live_write",
        account_safety_state: "clear",
        anti_detection_validation_ready: true,
        anti_detection_missing_target_fr_refs: [],
        runtime_decision: "GO",
        target_binding_state: "verified",
        execution_surface: "real_browser",
        headless: false
      }
    });
  }, 20_000);

  it("reports creator live_write closeout gate as GO after attaching a fresh closeout run", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_creator_live_write_gate_attach_ready";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      "run-contract-creator-live-write-gate-owner-001"
    );
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile, {
      effectiveExecutionMode: "live_write",
      probeBundleRef: "probe-bundle/xhs-creator-live-write-admission-v1"
    });

    const result = runCli(
      [
        "runtime.closeout_gate",
        "--profile",
        profile,
        "--run-id",
        "run-contract-creator-live-write-gate-next-001",
        "--params",
        JSON.stringify({
          requested_execution_mode: "live_write",
          target_domain: "creator.xiaohongshu.com",
          target_page: "creator_publish_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );

    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body.summary.closeout_gate_aggregator).toMatchObject({
      decision: "GO",
      blocker: null,
      gate_state: {
        requested_execution_mode: "live_write",
        account_safety_state: "clear",
        anti_detection_validation_ready: true,
        runtime_decision: "GO",
        target_binding_state: "verified",
        execution_surface: "real_browser",
        headless: false
      }
    });
    expect(body.summary.closeout_runtime_readiness_preflight).toMatchObject({
      decision: "GO",
      target_binding: {
        state: "verified",
        managed_target_tab_id: 44,
        managed_target_domain: "creator.xiaohongshu.com",
        managed_target_page: "creator_publish_tab"
      }
    });
  }, 20_000);

  it("rechecks closeout gate runtime readiness after a transient current-run bootstrap pending sample", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_creator_live_write_gate_transient_pending";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      "run-contract-creator-live-write-pending-owner-001"
    );
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile, {
      effectiveExecutionMode: "live_write",
      probeBundleRef: "probe-bundle/xhs-creator-live-write-admission-v1"
    });

    const result = runCli(
      [
        "runtime.closeout_gate",
        "--profile",
        profile,
        "--run-id",
        "run-contract-creator-live-write-pending-owner-001",
        "--params",
        JSON.stringify({
          requested_execution_mode: "live_write",
          target_domain: "creator.xiaohongshu.com",
          target_page: "creator_publish_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready-pending-once-current"
      }
    );

    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body.summary.closeout_gate_aggregator).toMatchObject({
      decision: "GO",
      blocker: null,
      gate_state: {
        requested_execution_mode: "live_write",
        runtime_decision: "GO",
        target_binding_state: "verified"
      }
    });
    expect(body.summary.runtime_status).toMatchObject({
      transportState: "ready",
      bootstrapState: "ready",
      runtimeReadiness: "ready"
    });
  });

  it("allows XHS target restoration during the recovery single-probe window before validation baseline is ready", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_restore_single_probe_required";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      "run-contract-restore-single-probe-required-001"
    );
    const profileDir = path.join(runtimeCwd, ".webenvoy", "profiles", profile);
    const metaPath = path.join(profileDir, "__webenvoy_meta.json");
    const existingMeta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      metaPath,
      `${JSON.stringify(
        {
          ...existingMeta,
          schemaVersion: 1,
          profileName: profile,
          profileDir,
          accountSafety: {
            state: "clear",
            platform: null,
            reason: null,
            observedAt: null,
            cooldownUntil: null,
            sourceRunId: null,
            sourceCommand: null,
            targetDomain: null,
            targetTabId: null,
            pageUrl: null,
            statusCode: null,
            platformCode: null
          },
          xhsCloseoutRhythm: {
            state: "single_probe_required",
            cooldownUntil: "2000-01-01T00:30:00.000Z",
            operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
            singleProbeRequired: true,
            singleProbePassedAt: null,
            probeRunId: null,
            fullBundleBlocked: true,
            reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
          },
          fingerprintSeeds: {
            audioNoiseSeed: "seed-restore-single-probe-a",
            canvasNoiseSeed: "seed-restore-single-probe-c"
          },
          updatedAt: "2026-04-25T10:35:00.000Z"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const rhythmStore = new SQLiteRuntimeStore(resolveRuntimeStorePath(runtimeCwd));
    try {
      await rhythmStore.recordSessionRhythmStatusView({
        profile,
        platform: "xhs",
        issueScope: "issue_209",
        windowState: {
          window_id: `rhythm_win_${profile}_issue_209`,
          profile,
          platform: "xhs",
          issue_scope: "issue_209",
          session_id: "nm-session-restore-single-probe",
          current_phase: "warmup",
          risk_state: "paused",
          window_started_at: "2026-04-25T10:30:00.000Z",
          window_deadline_at: null,
          cooldown_until: null,
          recovery_probe_due_at: "2026-04-25T10:45:00.000Z",
          stability_window_until: null,
          risk_signal_count: 1,
          last_event_id: "rhythm_evt_restore_single_probe",
          source_run_id: "run-restore-single-probe-source",
          updated_at: "2026-04-25T10:30:00.000Z"
        },
        event: {
          event_id: "rhythm_evt_restore_single_probe",
          profile,
          platform: "xhs",
          issue_scope: "issue_209",
          session_id: "nm-session-restore-single-probe",
          window_id: `rhythm_win_${profile}_issue_209`,
          event_type: "recovery_probe_started",
          phase_before: "warmup",
          phase_after: "warmup",
          risk_state_before: "paused",
          risk_state_after: "paused",
          source_audit_event_id: null,
          reason: "RECOVERY_SINGLE_PROBE_REQUIRED",
          recorded_at: "2026-04-25T10:30:00.000Z"
        },
        decision: {
          decision_id: "rhythm_decision_restore_single_probe",
          window_id: `rhythm_win_${profile}_issue_209`,
          run_id: "run-restore-single-probe-source",
          session_id: "nm-session-restore-single-probe",
          profile,
          current_phase: "warmup",
          current_risk_state: "paused",
          next_phase: "warmup",
          next_risk_state: "paused",
          effective_execution_mode: "live_read_high_risk",
          decision: "deferred",
          reason_codes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"],
          requires: ["recovery_single_probe"],
          decided_at: "2026-04-25T10:30:00.000Z"
        }
      });
    } finally {
      rhythmStore.close();
    }

    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        profile,
        "--run-id",
        "run-contract-restore-single-probe-required-001",
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          query: "露营",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );
    expect(result.status).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-restore-single-probe-required-001",
      command: "runtime.restore_xhs_target",
      status: "success"
    });
  });

  it("blocks XHS target restoration when persisted session rhythm is still cooling down", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_restore_persisted_cooldown_blocked";
    const runId = "run-contract-restore-persisted-cooldown-blocked-001";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(runtimeCwd, profile, runId);
    const profileDir = path.join(runtimeCwd, ".webenvoy", "profiles", profile);
    const metaPath = path.join(profileDir, "__webenvoy_meta.json");
    const existingMeta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      metaPath,
      `${JSON.stringify(
        {
          ...existingMeta,
          schemaVersion: 1,
          profileName: profile,
          profileDir,
          accountSafety: {
            state: "clear",
            platform: null,
            reason: null,
            observedAt: null,
            cooldownUntil: null,
            sourceRunId: null,
            sourceCommand: null,
            targetDomain: null,
            targetTabId: null,
            pageUrl: null,
            statusCode: null,
            platformCode: null
          },
          xhsCloseoutRhythm: {
            state: "not_required",
            cooldownUntil: null,
            operatorConfirmedAt: null,
            singleProbeRequired: false,
            singleProbePassedAt: null,
            probeRunId: null,
            fullBundleBlocked: false,
            reasonCodes: []
          },
          updatedAt: "2026-04-25T10:35:00.000Z"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const rhythmStore = new SQLiteRuntimeStore(resolveRuntimeStorePath(runtimeCwd));
    try {
      await rhythmStore.recordSessionRhythmStatusView({
        profile,
        platform: "xhs",
        issueScope: "issue_209",
        windowState: {
          window_id: `rhythm_win_${profile}_issue_209`,
          profile,
          platform: "xhs",
          issue_scope: "issue_209",
          session_id: "nm-session-restore-cooldown",
          current_phase: "cooldown",
          risk_state: "paused",
          window_started_at: "2026-04-25T10:30:00.000Z",
          window_deadline_at: null,
          cooldown_until: "2099-04-25T11:00:00.000Z",
          recovery_probe_due_at: null,
          stability_window_until: null,
          risk_signal_count: 1,
          last_event_id: "rhythm_evt_restore_cooldown",
          source_run_id: "run-restore-cooldown-source",
          updated_at: "2026-04-25T10:30:00.000Z"
        },
        event: {
          event_id: "rhythm_evt_restore_cooldown",
          profile,
          platform: "xhs",
          issue_scope: "issue_209",
          session_id: "nm-session-restore-cooldown",
          window_id: `rhythm_win_${profile}_issue_209`,
          event_type: "cooldown_started",
          phase_before: "steady",
          phase_after: "cooldown",
          risk_state_before: "limited",
          risk_state_after: "paused",
          source_audit_event_id: null,
          reason: "PERSISTED_SESSION_RHYTHM_PAUSED",
          recorded_at: "2026-04-25T10:30:00.000Z"
        },
        decision: {
          decision_id: "rhythm_decision_restore_cooldown",
          window_id: `rhythm_win_${profile}_issue_209`,
          run_id: "run-restore-cooldown-source",
          session_id: "nm-session-restore-cooldown",
          profile,
          current_phase: "cooldown",
          current_risk_state: "paused",
          next_phase: "cooldown",
          next_risk_state: "paused",
          effective_execution_mode: "live_read_high_risk",
          decision: "blocked",
          reason_codes: ["PERSISTED_SESSION_RHYTHM_PAUSED"],
          requires: ["session_rhythm_window_not_ready"],
          decided_at: "2026-04-25T10:30:00.000Z"
        }
      });
    } finally {
      rhythmStore.close();
    }

    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        profile,
        "--run-id",
        runId,
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          query: "露营",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready"
      }
    );

    expect(result.status).toBe(6);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: runId,
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "XHS_CLOSEOUT_RHYTHM_BLOCKED",
          session_rhythm_status_view: expect.objectContaining({
            current_phase: "cooldown",
            current_risk_state: "paused",
            session_rhythm_decision: expect.objectContaining({
              decision_id: "rhythm_decision_restore_cooldown",
              decision: "blocked"
            })
          })
        }
      }
    });
  }, 10_000);

  it("blocks stale-bootstrap XHS target restoration during recovery probe when validation is missing", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_restore_stale_bootstrap_probe_blocked";
    const runId = "run-contract-restore-stale-bootstrap-probe-blocked-001";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(runtimeCwd, profile, runId);
    const profileDir = path.join(runtimeCwd, ".webenvoy", "profiles", profile);
    const metaPath = path.join(profileDir, "__webenvoy_meta.json");
    const existingMeta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      metaPath,
      `${JSON.stringify(
        {
          ...existingMeta,
          schemaVersion: 1,
          profileName: profile,
          profileDir,
          xhsCloseoutRhythm: {
            state: "single_probe_required",
            cooldownUntil: "2000-01-01T00:30:00.000Z",
            operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
            singleProbeRequired: true,
            singleProbePassedAt: null,
            probeRunId: null,
            fullBundleBlocked: true,
            reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
          },
          updatedAt: "2026-04-25T10:35:00.000Z"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        profile,
        "--run-id",
        runId,
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:50:00.000Z",
          query: "露营",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-stale-for-run",
        WEBENVOY_NATIVE_HOST_STALE_RUN_ID: runId
      }
    );
    expect(result.status).toBe(6);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: runId,
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "ANTI_DETECTION_VALIDATION_BASELINE_BLOCKED",
          anti_detection_validation_view: expect.objectContaining({
            all_required_ready: false
          })
        }
      }
    });
  }, 10_000);

  it("allows same-runtime XHS target restoration after stale bootstrap when validation is ready", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_restore_stale_bootstrap_ready";
    const runId = "run-contract-restore-stale-bootstrap-ready-001";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(runtimeCwd, profile, runId);
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile);

    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        profile,
        "--run-id",
        runId,
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          requested_at: "2026-04-25T10:45:00.000Z",
          query: "露营",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-stale-for-run",
        WEBENVOY_NATIVE_HOST_STALE_RUN_ID: runId
      }
    );
    expect(result.status).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: runId,
      command: "runtime.restore_xhs_target",
      status: "success"
    });
  }, 10_000);

  it("blocks stale-bootstrap XHS target restoration when requested_at is missing", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_restore_stale_bootstrap_missing_requested_at";
    const runId = "run-contract-restore-stale-bootstrap-missing-requested-at-001";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(runtimeCwd, profile, runId);
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile);

    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        profile,
        "--run-id",
        runId,
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          query: "露营",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-stale-for-run",
        WEBENVOY_NATIVE_HOST_STALE_RUN_ID: runId
      }
    );
    expect(result.status).toBe(6);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: runId,
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "OFFICIAL_RUNTIME_NOT_READY"
        }
      }
    });
  }, 10_000);

  it("attaches a fresh CLI run before restoring an already-running XHS target", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_restore_attach_ready";
    const ownerRunId = "run-contract-restore-attach-owner-001";
    const restoreRunId = "run-contract-restore-attach-next-001";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      ownerRunId
    );
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile);
    const profileDir = path.join(runtimeCwd, ".webenvoy", "profiles", profile);
    const metaPath = path.join(profileDir, "__webenvoy_meta.json");
    const existingMeta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      metaPath,
      `${JSON.stringify(
        {
          ...existingMeta,
          schemaVersion: 1,
          profileName: profile,
          profileDir,
          accountSafety: {
            state: "clear",
            platform: null,
            reason: null,
            observedAt: null,
            cooldownUntil: null,
            sourceRunId: null,
            sourceCommand: null,
            targetDomain: null,
            targetTabId: null,
            pageUrl: null,
            statusCode: null,
            platformCode: null
          },
          xhsCloseoutRhythm: {
            state: "single_probe_required",
            cooldownUntil: "2000-01-01T00:30:00.000Z",
            operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
            singleProbeRequired: true,
            singleProbePassedAt: null,
            probeRunId: null,
            fullBundleBlocked: true,
            reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
          },
          fingerprintSeeds: {
            audioNoiseSeed: "seed-restore-attach-a",
            canvasNoiseSeed: "seed-restore-attach-c"
          },
          updatedAt: "2026-04-25T10:35:00.000Z"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        profile,
        "--run-id",
        restoreRunId,
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          query: "露营",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-stale-for-run",
        WEBENVOY_NATIVE_HOST_STALE_RUN_ID: restoreRunId,
        WEBENVOY_NATIVE_HOST_REQUIRE_REQUESTED_AT: "1"
      }
    );
    expect(result.status).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: restoreRunId,
      command: "runtime.restore_xhs_target",
      status: "success"
    });
  }, 10_000);

  it("waits through a transient pending readiness sample after attaching before XHS target restoration", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_restore_attach_pending_once";
    const ownerRunId = "run-contract-restore-attach-pending-owner-001";
    const restoreRunId = "run-contract-restore-attach-pending-next-001";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      ownerRunId
    );
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile);
    const profileDir = path.join(runtimeCwd, ".webenvoy", "profiles", profile);
    const metaPath = path.join(profileDir, "__webenvoy_meta.json");
    const existingMeta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      metaPath,
      `${JSON.stringify(
        {
          ...existingMeta,
          schemaVersion: 1,
          profileName: profile,
          profileDir,
          accountSafety: {
            state: "clear",
            platform: null,
            reason: null,
            observedAt: null,
            cooldownUntil: null,
            sourceRunId: null,
            sourceCommand: null,
            targetDomain: null,
            targetTabId: null,
            pageUrl: null,
            statusCode: null,
            platformCode: null
          },
          xhsCloseoutRhythm: {
            state: "single_probe_required",
            cooldownUntil: "2000-01-01T00:30:00.000Z",
            operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
            singleProbeRequired: true,
            singleProbePassedAt: null,
            probeRunId: null,
            fullBundleBlocked: true,
            reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
          },
          fingerprintSeeds: {
            audioNoiseSeed: "seed-restore-attach-pending-a",
            canvasNoiseSeed: "seed-restore-attach-pending-c"
          },
          updatedAt: "2026-04-25T10:35:00.000Z"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        profile,
        "--run-id",
        restoreRunId,
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          query: "露营穿搭",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready-pending-once-after-attach"
      }
    );
    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: restoreRunId,
      command: "runtime.restore_xhs_target",
      status: "success"
    });
  }, 10_000);

  it("waits through a transient pending readiness sample before current-run XHS target restoration", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_restore_current_pending_once";
    const runId = "run-contract-restore-current-pending-001";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(runtimeCwd, profile, runId);
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile);
    const profileDir = path.join(runtimeCwd, ".webenvoy", "profiles", profile);
    const metaPath = path.join(profileDir, "__webenvoy_meta.json");
    const existingMeta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      metaPath,
      `${JSON.stringify(
        {
          ...existingMeta,
          schemaVersion: 1,
          profileName: profile,
          profileDir,
          accountSafety: {
            state: "clear",
            platform: null,
            reason: null,
            observedAt: null,
            cooldownUntil: null,
            sourceRunId: null,
            sourceCommand: null,
            targetDomain: null,
            targetTabId: null,
            pageUrl: null,
            statusCode: null,
            platformCode: null
          },
          xhsCloseoutRhythm: {
            state: "single_probe_passed",
            cooldownUntil: "2000-01-01T00:30:00.000Z",
            operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
            singleProbeRequired: false,
            singleProbePassedAt: "2026-04-25T10:35:10.000Z",
            probeRunId: "run-contract-restore-current-probe-001",
            fullBundleBlocked: true,
            reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_PASSED"]
          },
          fingerprintSeeds: {
            audioNoiseSeed: "seed-restore-current-pending-a",
            canvasNoiseSeed: "seed-restore-current-pending-c"
          },
          updatedAt: "2026-04-25T10:35:00.000Z"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        profile,
        "--run-id",
        runId,
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          query: "城市骑行",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready-pending-once-current"
      }
    );
    expect(result.status, result.stdout).toBe(0);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: runId,
      command: "runtime.restore_xhs_target",
      status: "success"
    });
  }, 10_000);

  it("fails closed when attached XHS target restoration never leaves pending readiness", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const profile = "xhs_restore_attach_pending_blocked";
    const ownerRunId = "run-contract-restore-attach-pending-blocked-owner-001";
    const restoreRunId = "run-contract-restore-attach-pending-blocked-next-001";
    const persistentExtensionIdentity = await startOfficialReadyRuntime(
      runtimeCwd,
      profile,
      ownerRunId
    );
    await seedReadyXhsCloseoutValidationViews(runtimeCwd, profile);
    const profileDir = path.join(runtimeCwd, ".webenvoy", "profiles", profile);
    const metaPath = path.join(profileDir, "__webenvoy_meta.json");
    const existingMeta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      metaPath,
      `${JSON.stringify(
        {
          ...existingMeta,
          schemaVersion: 1,
          profileName: profile,
          profileDir,
          accountSafety: {
            state: "clear",
            platform: null,
            reason: null,
            observedAt: null,
            cooldownUntil: null,
            sourceRunId: null,
            sourceCommand: null,
            targetDomain: null,
            targetTabId: null,
            pageUrl: null,
            statusCode: null,
            platformCode: null
          },
          xhsCloseoutRhythm: {
            state: "single_probe_required",
            cooldownUntil: "2000-01-01T00:30:00.000Z",
            operatorConfirmedAt: "2026-04-25T10:35:00.000Z",
            singleProbeRequired: true,
            singleProbePassedAt: null,
            probeRunId: null,
            fullBundleBlocked: true,
            reasonCodes: ["XHS_RECOVERY_SINGLE_PROBE_REQUIRED"]
          },
          fingerprintSeeds: {
            audioNoiseSeed: "seed-restore-attach-pending-blocked-a",
            canvasNoiseSeed: "seed-restore-attach-pending-blocked-c"
          },
          updatedAt: "2026-04-25T10:35:00.000Z"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = runCli(
      [
        "runtime.restore_xhs_target",
        "--profile",
        profile,
        "--run-id",
        restoreRunId,
        "--params",
        JSON.stringify({
          target_domain: "www.xiaohongshu.com",
          target_page: "search_result_tab",
          target_tab_id: 44,
          query: "露营穿搭",
          persistent_extension_identity: persistentExtensionIdentity
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_BROWSER_MOCK_VERSION: "Google Chrome 146.0.7680.154",
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "runtime-readiness-ready-pending-after-attach"
      }
    );
    expect(result.status, result.stdout).toBe(5);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: restoreRunId,
      command: "runtime.restore_xhs_target",
      status: "error",
      error: {
        code: "ERR_PROFILE_LOCKED"
      }
    });
  }, 10_000);

  it("keeps dry_run xhs.search on stdio fallback before official socket mode is confirmed", async () => {
    const runtimeCwd = await createRuntimeCwd();
    const result = runCli(
      [
        "xhs.search",
        "--profile",
        "profile_stdio_fallback",
        "--run-id",
        "run-contract-xhs-stdio-001",
        "--params",
        JSON.stringify({
          ability: {
            id: "xhs.note.search.v1",
            layer: "L3",
            action: "read"
          },
          input: {
            query: "露营装备"
          },
          options: {
            ...scopedXhsGateOptions
          }
        })
      ],
      runtimeCwd,
      {
        WEBENVOY_NATIVE_TRANSPORT: "native",
        WEBENVOY_NATIVE_HOST_CMD: createNativeHostCommand(nativeHostMockPath),
        WEBENVOY_NATIVE_HOST_MODE: "success"
      }
    );
    expect(result.status).toBe(6);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      run_id: "run-contract-xhs-stdio-001",
      command: "xhs.search",
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED",
        details: {
          reason: "CAPABILITY_RESULT_MISSING"
        }
      }
    });
  });

  it("returns execution failed error with code 6", () => {
    const result = runCli(["runtime.ping", "--params", '{"force_fail":true}']);
    expect(result.status).toBe(6);
    const body = parseSingleJsonLine(result.stdout);
    expect(body).toMatchObject({
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED",
        diagnosis: {
          category: "unknown",
          stage: "execution",
          component: "runtime"
        }
      },
      observability: {
        coverage: "unavailable",
        page_state: null,
        key_requests: [],
        failure_site: null
      }
    });
  });

  it("keeps stdout as single JSON object for runtime.help", () => {
    const result = runCli(["runtime.help"]);
    expect(result.status).toBe(0);
    parseSingleJsonLine(result.stdout);
  });

});
