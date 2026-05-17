import { chmod, mkdtemp, mkdir, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildIdentityPreflightError,
  resetIdentityPreflightAdaptersForTests,
  runIdentityPreflight,
  setIdentityPreflightAdaptersForTests
} from "../persistent-extension-identity.js";
import type { ProfileMeta } from "../profile-store.js";

const EXTENSION_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DEFAULT_TIMESTAMP = "2026-03-27T00:00:00.000Z";

const createProfileMeta = (
  profileDir: string,
  overrides: Partial<Pick<ProfileMeta, "persistentExtensionBinding">> = {}
): ProfileMeta => ({
  schemaVersion: 1,
  profileName: "identity-profile",
  profileDir,
  profileState: "uninitialized",
  proxyBinding: null,
  fingerprintSeeds: {
    audioNoiseSeed: "audio-seed",
    canvasNoiseSeed: "canvas-seed"
  },
  localStorageSnapshots: [],
  createdAt: DEFAULT_TIMESTAMP,
  updatedAt: DEFAULT_TIMESTAMP,
  lastStartedAt: null,
  lastLoginAt: null,
  lastStoppedAt: null,
  lastDisconnectedAt: null,
  ...overrides
});

const writeProfileExtensionPreferences = async (input: {
  profileDir: string;
  extensionId: string;
  state?: 0 | 1;
  location?: number;
  extensionPath?: string;
}): Promise<void> => {
  const defaultDir = join(input.profileDir, "Default");
  await mkdir(defaultDir, { recursive: true });
  await writeFile(
    join(defaultDir, "Preferences"),
    `${JSON.stringify(
      {
        extensions: {
          settings: {
            [input.extensionId]: {
              ...(input.state === undefined ? {} : { state: input.state }),
              ...(input.location === undefined ? {} : { location: input.location }),
              ...(input.extensionPath === undefined ? {} : { path: input.extensionPath })
            }
          }
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
};

const writeInstalledProfileExtension = async (input: {
  profileDir: string;
  extensionId: string;
}): Promise<void> => {
  const extensionDir = join(input.profileDir, "Default", "Extensions", input.extensionId, "1.0.0");
  await mkdir(extensionDir, { recursive: true });
  await writeFile(join(extensionDir, "manifest.json"), "{\n  \"manifest_version\": 3\n}\n", "utf8");
};

const writeServiceWorkerCache = async (input: {
  profileDir: string;
  mtime: Date;
}): Promise<void> => {
  const serviceWorkerDir = join(input.profileDir, "Default", "Service Worker", "ScriptCache");
  const scriptPath = join(serviceWorkerDir, "service-worker.js");
  await mkdir(serviceWorkerDir, { recursive: true });
  await writeFile(
    scriptPath,
    `const WEBENVOY_EXTENSION_URL = "chrome-extension://${EXTENSION_ID}/build/background.js";\nself.addEventListener('install', () => undefined);\n`,
    "utf8"
  );
  await utimes(scriptPath, input.mtime, input.mtime);
  await utimes(serviceWorkerDir, input.mtime, input.mtime);
  await utimes(join(input.profileDir, "Default", "Service Worker"), input.mtime, input.mtime);
};

const createNativeHostManifest = async (input: {
  profileDir: string;
  allowedOrigins: string[];
  launcherPath?: string;
  createLauncher?: boolean;
}): Promise<string> => {
  const manifestPath = join(input.profileDir, "com.webenvoy.host.json");
  const launcherPath = input.launcherPath ?? join(input.profileDir, "mock-webenvoy-host");
  if (input.createLauncher !== false) {
    await writeFile(launcherPath, "#!/usr/bin/env bash\nexit 0\n", "utf8");
  }
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        name: "com.webenvoy.host",
        path: launcherPath,
        allowed_origins: input.allowedOrigins
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return manifestPath;
};

afterEach(() => {
  resetIdentityPreflightAdaptersForTests();
  vi.unstubAllEnvs();
});

describe("runIdentityPreflight", () => {
  it("keeps load-extension mode when launcher can still select Chromium fallback", async () => {
    const resolvePreferredBrowserVersionTruthSource = vi.fn().mockResolvedValue({
      executablePath: "/mock/chromium",
      browserVersion: "Chromium 146.0.0.0"
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource,
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(false)
    });

    const result = await runIdentityPreflight({
      params: {},
      meta: null
    });

    expect(resolvePreferredBrowserVersionTruthSource).toHaveBeenCalledTimes(1);
    expect(resolvePreferredBrowserVersionTruthSource).toHaveBeenCalledWith({});
    expect(result).toMatchObject({
      mode: "load_extension",
      browserPath: "/mock/chromium",
      browserVersion: "Chromium 146.0.0.0",
      identityBindingState: "not_applicable",
      blocking: false,
      failureReason: "IDENTITY_PREFLIGHT_NOT_REQUIRED"
    });
  });

  it("reads the Windows native host manifest path from registry when binding omits manifestPath", async () => {
    const manifestDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-registry-"));
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-"));
    const manifestPath = join(manifestDir, "com.webenvoy.host.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });

    const resolvePreferredBrowserVersionTruthSource = vi.fn().mockResolvedValue({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      browserVersion: "Google Chrome 146.0.7680.154"
    });
    const execFile = vi.fn().mockResolvedValue({
      stdout: [
        "HKEY_CURRENT_USER\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.webenvoy.host",
        `    (Default)    REG_SZ    ${manifestPath}`,
        ""
      ].join("\r\n"),
      stderr: ""
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource,
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      execFile,
      platform: () => "win32"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(execFile).toHaveBeenCalledWith(
      "reg",
      ["query", "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.webenvoy.host", "/ve"],
      { encoding: "utf8" }
    );
    expect(result).toMatchObject({
      mode: "official_chrome_persistent_extension",
      browserPath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      browserVersion: "Google Chrome 146.0.7680.154",
      identityBindingState: "bound",
      blocking: false,
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      manifestPath,
      expectedOrigin: `chrome-extension://${EXTENSION_ID}/`,
      allowedOrigins: [`chrome-extension://${EXTENSION_ID}/`]
    });
  });

  it("blocks when binding browser_channel disagrees with the resolved official Chrome channel", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-channel-"));
    const resolvePreferredBrowserVersionTruthSource = vi.fn().mockResolvedValue({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      browserVersion: "Google Chrome 146.0.7680.154"
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource,
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "win32"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          browser_channel: "chromium",
          manifest_path: "C:\\manifest.json"
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result.identityBindingState).toBe("mismatch");
    expect(result.failureReason).toBe("IDENTITY_BINDING_CONFLICT");
  });

  it("rejects invalid native_host_name from params", async () => {
    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    await expect(
      runIdentityPreflight({
        params: {
          persistent_extension_identity: {
            extension_id: EXTENSION_ID,
            native_host_name: "Com.WebEnvoy.Host"
          }
        },
        meta: null
      })
    ).rejects.toMatchObject({
      code: "ERR_PROFILE_INVALID",
      details: {
        stage: "input_validation",
        reason: "IDENTITY_BINDING_INVALID_NATIVE_HOST_NAME"
      }
    });
  });

  it("returns missing when manifest is valid but profile extension files are absent", async () => {
    const manifestDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-manifest-absent-"));
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-absent-"));
    const manifestPath = join(manifestDir, "com.webenvoy.host.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result.identityBindingState).toBe("missing");
    expect(result.failureReason).toBe("IDENTITY_BINDING_MISSING");
    expect(result.blocking).toBe(true);
  });

  it("returns missing when profile extension is disabled", async () => {
    const manifestDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-manifest-disabled-"));
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-disabled-"));
    const manifestPath = join(manifestDir, "com.webenvoy.host.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 0
    });
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result.identityBindingState).toBe("missing");
    expect(result.failureReason).toBe("IDENTITY_BINDING_MISSING");
    expect(result.blocking).toBe(true);
  });

  it("returns missing for a fresh profile when params provide binding but the extension is not installed", async () => {
    const manifestDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-manifest-fresh-"));
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-fresh-"));
    const manifestPath = join(manifestDir, "com.webenvoy.host.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: null,
      profileDir
    });

    expect(result.identityBindingState).toBe("missing");
    expect(result.failureReason).toBe("IDENTITY_BINDING_MISSING");
    expect(result.blocking).toBe(true);
  });

  it("resolves the native host manifest from browser channel defaults when binding omits manifestPath", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-scoped-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      identityBindingState: "bound",
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      manifestPath,
      manifestSource: "browser_default",
      expectedOrigin: `chrome-extension://${EXTENSION_ID}/`,
      allowedOrigins: [`chrome-extension://${EXTENSION_ID}/`]
    });
    expect(result.manifestPath?.startsWith(profileDir)).toBe(false);
  });

  it("resolves the native host manifest from an explicit discovery override when binding omits manifestPath", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-override-"));
    const manifestDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-manifest-override-"));
    const manifestPath = join(manifestDir, "com.webenvoy.host.json");
    vi.stubEnv("WEBENVOY_NATIVE_HOST_MANIFEST_DIR", manifestDir);
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      identityBindingState: "bound",
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      manifestPath,
      manifestSource: "browser_default",
      expectedOrigin: `chrome-extension://${EXTENSION_ID}/`
    });
  });

  it("surfaces install diagnostics when the registered launcher path is missing", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-missing-launcher-"));
    const manifestPath = await createNativeHostManifest({
      profileDir,
      allowedOrigins: [`chrome-extension://${EXTENSION_ID}/`],
      launcherPath: join(profileDir, "missing-launcher.sh"),
      createLauncher: false
    });
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true)
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "IDENTITY_MANIFEST_MISSING",
      installDiagnostics: {
        launcherPath: join(profileDir, "missing-launcher.sh"),
        launcherExists: false,
        bundleRuntimePath: null,
        bundleRuntimeExists: null
      }
    });
  });

  it("keeps managed explicit host_command installs usable when bundled runtime is not expected", async () => {
    const worktreeRoot = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-explicit-host-command-"));
    const profileDir = join(worktreeRoot, ".webenvoy", "profiles", "identity-profile");
    const manifestPath = join(
      worktreeRoot,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "manifests",
      "com.webenvoy.host.json"
    );
    const launcherPath = join(
      worktreeRoot,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "bin",
      "com.webenvoy.host-launcher"
    );
    const profileRoot = join(worktreeRoot, ".webenvoy", "profiles");
    const explicitHostEntryPath = join(worktreeRoot, "custom-native-host-entry.mjs");
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(launcherPath), { recursive: true });
    await writeFile(explicitHostEntryPath, "process.stdin.resume();\n", "utf8");
    await writeFile(
      launcherPath,
      `#!/usr/bin/env bash\nset -euo pipefail\nexport WEBENVOY_NATIVE_BRIDGE_PROFILE_ROOT='${profileRoot.replace(/'/g, `'\"'\"'`)}'\nexec '${process.execPath.replace(/'/g, `'\"'\"'`)}' '${explicitHostEntryPath.replace(/'/g, `'\"'\"'`)}' \"$@\"\n`,
      "utf8"
    );
    await chmod(launcherPath, 0o755);
    await writeFile(
      join(dirname(dirname(launcherPath)), "install-metadata.json"),
      `${JSON.stringify(
        {
          profile_root: profileRoot,
          bundle_runtime_expected: false
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          path: launcherPath,
          type: "stdio",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true)
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: false,
      identityBindingState: "bound",
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      installDiagnostics: {
        launcherPath,
        launcherExists: true,
        launcherExecutable: true,
        launcherProfileRoot: profileRoot,
        expectedProfileRoot: profileRoot,
        profileRootMatches: true,
        bundleRuntimeExists: null,
        legacyLauncherDetected: false
      }
    });
  });

  it("flags missing bundled runtime from a managed launcher as a broken install", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-broken-bundle-"));
    const manifestPath = join(
      profileDir,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "manifests",
      "com.webenvoy.host.json"
    );
    const launcherPath = join(
      profileDir,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "bin",
      "com.webenvoy.host-launcher"
    );
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(launcherPath), { recursive: true });
    await writeFile(launcherPath, "#!/usr/bin/env bash\nexit 0\n", "utf8");
    await chmod(launcherPath, 0o755);
    await writeFile(
      join(dirname(dirname(launcherPath)), "install-metadata.json"),
      `${JSON.stringify(
        {
          profile_root: dirname(profileDir),
          bundle_runtime_expected: true
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          path: launcherPath,
          type: "stdio",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true)
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "IDENTITY_MANIFEST_MISSING",
      installDiagnostics: {
        launcherPath,
        launcherExists: true,
        bundleRuntimePath: join(
          profileDir,
          ".webenvoy",
          "native-host-install",
          "chrome",
          "runtime",
          "native-messaging",
          "native-host-entry.js"
        ),
        bundleRuntimeExists: false
      }
    });
  });

  it("blocks managed launchers when the launcher is not executable", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-non-executable-launcher-"));
    const manifestPath = join(
      profileDir,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "manifests",
      "com.webenvoy.host.json"
    );
    const launcherPath = join(
      profileDir,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "bin",
      "com.webenvoy.host-launcher"
    );
    const runtimeRoot = join(profileDir, ".webenvoy", "native-host-install", "chrome", "runtime");
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(launcherPath), { recursive: true });
    await mkdir(join(runtimeRoot, "native-messaging"), { recursive: true });
    await writeFile(launcherPath, "#!/usr/bin/env bash\nexit 0\n", "utf8");
    await writeFile(
      join(dirname(dirname(launcherPath)), "install-metadata.json"),
      `${JSON.stringify(
        {
          profile_root: dirname(profileDir),
          bundle_runtime_expected: true
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(join(runtimeRoot, "native-messaging", "native-host-entry.js"), "process.stdin.resume();\n", "utf8");
    await writeFile(join(runtimeRoot, "native-messaging", "host.js"), "export {};\n", "utf8");
    await writeFile(join(runtimeRoot, "native-messaging", "protocol.js"), "export {};\n", "utf8");
    await writeFile(join(runtimeRoot, "worktree-root.js"), "export {};\n", "utf8");
    await writeFile(join(runtimeRoot, "package.json"), '{\n  "type": "module"\n}\n', "utf8");
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          path: launcherPath,
          type: "stdio",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true)
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "IDENTITY_MANIFEST_MISSING",
      installDiagnostics: {
        launcherPath,
        launcherExists: true,
        launcherExecutable: false,
        bundleRuntimeExists: true
      }
    });
  });

  it("blocks when the managed launcher belongs to another worktree profile root", async () => {
    const currentWorktreeRoot = await mkdtemp(join(tmpdir(), "webenvoy-native-host-current-worktree-"));
    const otherWorktreeRoot = await mkdtemp(join(tmpdir(), "webenvoy-native-host-other-worktree-"));
    const profileDir = join(currentWorktreeRoot, ".webenvoy", "profiles", "identity-profile");
    const launcherPath = join(
      otherWorktreeRoot,
      ".webenvoy",
      "native-host-install",
      "worktrees",
      "feature-other-123456789abc",
      "chrome",
      "bin",
      "com.webenvoy.host-launcher"
    );
    const manifestPath = join(profileDir, "com.webenvoy.host.json");
    await mkdir(dirname(launcherPath), { recursive: true });
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(launcherPath, "#!/usr/bin/env bash\nexit 0\n", "utf8");
    await chmod(launcherPath, 0o755);
    await writeFile(
      join(dirname(dirname(launcherPath)), "install-metadata.json"),
      `${JSON.stringify(
        {
          profile_root: join(otherWorktreeRoot, ".webenvoy", "profiles"),
          bundle_runtime_expected: true
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          path: launcherPath,
          type: "stdio",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true)
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "IDENTITY_MANIFEST_MISSING",
      installDiagnostics: {
        launcherPath,
        launcherExists: true,
        launcherProfileRoot: join(otherWorktreeRoot, ".webenvoy", "profiles"),
        expectedProfileRoot: join(currentWorktreeRoot, ".webenvoy", "profiles"),
        profileRootMatches: false,
        legacyLauncherDetected: false
      }
    });
  });

  it("blocks managed launchers when install metadata is missing", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-missing-metadata-"));
    const manifestPath = join(
      profileDir,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "manifests",
      "com.webenvoy.host.json"
    );
    const launcherPath = join(
      profileDir,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "bin",
      "com.webenvoy.host-launcher"
    );
    const runtimeRoot = join(profileDir, ".webenvoy", "native-host-install", "chrome", "runtime");
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(launcherPath), { recursive: true });
    await mkdir(join(runtimeRoot, "native-messaging"), { recursive: true });
    await writeFile(launcherPath, "#!/usr/bin/env bash\nexit 0\n", "utf8");
    await chmod(launcherPath, 0o755);
    await writeFile(join(runtimeRoot, "native-messaging", "native-host-entry.js"), "process.stdin.resume();\n", "utf8");
    await writeFile(join(runtimeRoot, "native-messaging", "host.js"), "export {};\n", "utf8");
    await writeFile(join(runtimeRoot, "native-messaging", "protocol.js"), "export {};\n", "utf8");
    await writeFile(join(runtimeRoot, "worktree-root.js"), "export {};\n", "utf8");
    await writeFile(join(runtimeRoot, "package.json"), '{\n  "type": "module"\n}\n', "utf8");
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          path: launcherPath,
          type: "stdio",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true)
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "IDENTITY_MANIFEST_MISSING",
      installDiagnostics: {
        launcherPath,
        launcherExists: true,
        launcherProfileRoot: null,
        expectedProfileRoot: dirname(profileDir),
        profileRootMatches: false,
        bundleRuntimeExists: null,
        legacyLauncherDetected: false
      }
    });
  });

  it("blocks managed launchers when bundled runtime support files are missing", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-incomplete-bundle-"));
    const manifestPath = join(
      profileDir,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "manifests",
      "com.webenvoy.host.json"
    );
    const launcherPath = join(
      profileDir,
      ".webenvoy",
      "native-host-install",
      "chrome",
      "bin",
      "com.webenvoy.host-launcher"
    );
    const runtimeRoot = join(profileDir, ".webenvoy", "native-host-install", "chrome", "runtime");
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(launcherPath), { recursive: true });
    await mkdir(join(runtimeRoot, "native-messaging"), { recursive: true });
    await writeFile(launcherPath, "#!/usr/bin/env bash\nexit 0\n", "utf8");
    await chmod(launcherPath, 0o755);
    await writeFile(
      join(dirname(dirname(launcherPath)), "install-metadata.json"),
      `${JSON.stringify(
        {
          profile_root: join(profileDir, ".webenvoy", "profiles"),
          bundle_runtime_expected: true
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(join(runtimeRoot, "native-messaging", "native-host-entry.js"), "process.stdin.resume();\n", "utf8");
    await writeFile(join(runtimeRoot, "native-messaging", "protocol.js"), "export {};\n", "utf8");
    await writeFile(join(runtimeRoot, "worktree-root.js"), "export {};\n", "utf8");
    await writeFile(join(runtimeRoot, "package.json"), '{\n  "type": "module"\n}\n', "utf8");
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          path: launcherPath,
          type: "stdio",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true)
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "IDENTITY_MANIFEST_MISSING",
      installDiagnostics: {
        launcherPath,
        launcherExists: true,
        bundleRuntimePath: join(
          profileDir,
          ".webenvoy",
          "native-host-install",
          "chrome",
          "runtime",
          "native-messaging",
          "native-host-entry.js"
        ),
        bundleRuntimeExists: false,
        legacyLauncherDetected: false
      }
    });
  });

  it("blocks legacy browser-adjacent launchers until runtime.install rewrites them", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-legacy-launcher-"));
    const manifestPath = join(profileDir, "com.webenvoy.host.json");
    const launcherPath = join(profileDir, "com.webenvoy.host-launcher");
    await writeFile(launcherPath, "#!/usr/bin/env bash\nexit 0\n", "utf8");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          path: launcherPath,
          type: "stdio",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true)
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID,
          manifest_path: manifestPath
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "IDENTITY_MANIFEST_MISSING",
      installDiagnostics: {
        launcherPath,
        launcherExists: true,
        legacyLauncherDetected: true
      }
    });
  });

  it("treats developer-mode unpacked extension path as enabled when profile Extensions dir is absent", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-unpacked-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-unpacked-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const unpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-"));
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(join(unpackedDir, "manifest.json"), "{\n  \"manifest_version\": 3\n}\n", "utf8");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: unpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      identityBindingState: "bound",
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      manifestPath,
      extensionServiceWorkerFreshness: {
        state: "unknown",
        reason: "SERVICE_WORKER_CACHE_MISSING",
        extensionPath: unpackedDir
      }
    });
  });

  it("treats an empty managed profile service worker directory as missing cache", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-empty-sw-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-empty-sw-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const unpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-empty-sw-"));
    const extensionBuildFile = join(unpackedDir, "build", "background.js");
    const emptyServiceWorkerDir = join(profileDir, "Default", "Service Worker");
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(extensionBuildFile), { recursive: true });
    await mkdir(emptyServiceWorkerDir, { recursive: true });
    await writeFile(extensionBuildFile, "globalThis.__webenvoyBuild = 'empty-sw';\n", "utf8");
    await utimes(
      emptyServiceWorkerDir,
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-04-01T00:00:00.000Z")
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: unpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: false,
      identityBindingState: "bound",
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      extensionServiceWorkerFreshness: {
        state: "unknown",
        reason: "SERVICE_WORKER_CACHE_MISSING",
        extensionPath: unpackedDir,
        serviceWorkerLatestMtimeMs: null
      }
    });
  });

  it("fails closed when managed profile service worker cache is older than unpacked extension build", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-stale-sw-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-stale-sw-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const unpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-stale-sw-"));
    const extensionBuildFile = join(unpackedDir, "build", "background.js");
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(extensionBuildFile), { recursive: true });
    await writeFile(extensionBuildFile, "globalThis.__webenvoyBuild = 'fresh';\n", "utf8");
    await utimes(
      extensionBuildFile,
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );
    await utimes(
      dirname(extensionBuildFile),
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );
    await utimes(
      unpackedDir,
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );
    await writeServiceWorkerCache({
      profileDir,
      mtime: new Date("2026-04-30T00:00:00.000Z")
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: unpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED",
      extensionServiceWorkerFreshness: {
        state: "stale",
        reason: "SERVICE_WORKER_CACHE_OLDER_THAN_EXTENSION_BUILD",
        extensionId: EXTENSION_ID,
        extensionPath: unpackedDir,
        serviceWorkerPath: join(profileDir, "Default", "Service Worker")
      }
    });
    expect(buildIdentityPreflightError(result)).toMatchObject({
      code: "ERR_EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED",
      details: {
        reason: "EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED",
        extension_service_worker_freshness_reason:
          "SERVICE_WORKER_CACHE_OLDER_THAN_EXTENSION_BUILD",
        recovery_hint: expect.stringContaining("Default/Service Worker")
      }
    });
  });

  it("fails closed for opaque stale script cache files without extension id bytes", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-opaque-sw-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-opaque-sw-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const unpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-opaque-sw-"));
    const extensionBuildFile = join(unpackedDir, "build", "background.js");
    const serviceWorkerDir = join(profileDir, "Default", "Service Worker", "ScriptCache");
    const opaqueCacheFile = join(serviceWorkerDir, "opaque-cache-entry");
    const serviceWorkerDatabaseFile = join(
      profileDir,
      "Default",
      "Service Worker",
      "Database",
      "000003.log"
    );
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(extensionBuildFile), { recursive: true });
    await mkdir(serviceWorkerDir, { recursive: true });
    await mkdir(dirname(serviceWorkerDatabaseFile), { recursive: true });
    await writeFile(extensionBuildFile, "globalThis.__webenvoyBuild = 'opaque';\n", "utf8");
    await writeFile(opaqueCacheFile, "\u0000opaque chrome script cache bytes\n", "utf8");
    await writeFile(
      serviceWorkerDatabaseFile,
      `registration_storage_key=chrome-extension://${EXTENSION_ID}/\n`,
      "utf8"
    );
    await utimes(
      extensionBuildFile,
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );
    await utimes(
      opaqueCacheFile,
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: unpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED",
      extensionServiceWorkerFreshness: {
        state: "stale",
        reason: "SERVICE_WORKER_CACHE_OLDER_THAN_EXTENSION_BUILD",
        extensionPath: unpackedDir
      }
    });
  });

  it("fails closed when unpacked extension root is symlinked to a newer build", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-symlink-sw-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-symlink-sw-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const realUnpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-real-sw-"));
    const symlinkParent = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-link-parent-"));
    const symlinkedUnpackedDir = join(symlinkParent, "extension-link");
    const extensionBuildFile = join(realUnpackedDir, "build", "background.js");
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(extensionBuildFile), { recursive: true });
    await writeFile(extensionBuildFile, "globalThis.__webenvoyBuild = 'symlinked';\n", "utf8");
    await symlink(realUnpackedDir, symlinkedUnpackedDir);
    await utimes(
      extensionBuildFile,
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );
    await writeServiceWorkerCache({
      profileDir,
      mtime: new Date("2026-04-30T00:00:00.000Z")
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: symlinkedUnpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      failureReason: "EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED",
      extensionServiceWorkerFreshness: {
        state: "stale",
        reason: "SERVICE_WORKER_CACHE_OLDER_THAN_EXTENSION_BUILD",
        extensionPath: symlinkedUnpackedDir
      }
    });
  });

  it("allows extension build and service worker cache to share the same timestamp", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-same-sw-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-same-sw-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const unpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-same-sw-"));
    const extensionBuildFile = join(unpackedDir, "build", "background.js");
    const sameTimestamp = new Date("2026-05-01T00:00:00.000Z");
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(extensionBuildFile), { recursive: true });
    await writeFile(extensionBuildFile, "globalThis.__webenvoyBuild = 'same-second';\n", "utf8");
    await utimes(extensionBuildFile, sameTimestamp, sameTimestamp);
    await utimes(dirname(extensionBuildFile), sameTimestamp, sameTimestamp);
    await utimes(unpackedDir, sameTimestamp, sameTimestamp);
    await writeServiceWorkerCache({
      profileDir,
      mtime: sameTimestamp
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: unpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: false,
      identityBindingState: "bound",
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      extensionServiceWorkerFreshness: {
        state: "fresh",
        reason: "SERVICE_WORKER_CACHE_CURRENT",
        extensionPath: unpackedDir
      }
    });
  });

  it("does not let service worker directory mtime mask stale script cache", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-dir-mtime-sw-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-dir-mtime-sw-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const unpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-dir-mtime-sw-"));
    const extensionBuildFile = join(unpackedDir, "build", "background.js");
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(extensionBuildFile), { recursive: true });
    await writeFile(extensionBuildFile, "globalThis.__webenvoyBuild = 'dir-mtime';\n", "utf8");
    await utimes(
      extensionBuildFile,
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );
    await utimes(
      dirname(extensionBuildFile),
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );
    await utimes(
      unpackedDir,
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z")
    );
    await writeServiceWorkerCache({
      profileDir,
      mtime: new Date("2026-04-30T00:00:00.000Z")
    });
    const unrelatedCacheFile = join(
      profileDir,
      "Default",
      "Service Worker",
      "ScriptCache",
      "unrelated-service-worker.js"
    );
    await writeFile(
      unrelatedCacheFile,
      "self.addEventListener('install', () => undefined);\n",
      "utf8"
    );
    await utimes(
      unrelatedCacheFile,
      new Date("2026-05-02T00:00:00.000Z"),
      new Date("2026-05-02T00:00:00.000Z")
    );
    await utimes(
      join(profileDir, "Default", "Service Worker"),
      new Date("2026-05-02T00:00:00.000Z"),
      new Date("2026-05-02T00:00:00.000Z")
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: unpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED",
      extensionServiceWorkerFreshness: {
        state: "stale",
        reason: "SERVICE_WORKER_CACHE_OLDER_THAN_EXTENSION_BUILD",
        extensionPath: unpackedDir
      }
    });
  });

  it("ignores non-bundle unpacked extension files when checking service worker freshness", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-non-bundle-sw-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-non-bundle-sw-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const unpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-non-bundle-sw-"));
    const extensionManifestPath = join(unpackedDir, "manifest.json");
    const extensionBuildFile = join(unpackedDir, "build", "background.js");
    const incidentalFile = join(unpackedDir, ".cache", "editor.log");
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(extensionBuildFile), { recursive: true });
    await mkdir(dirname(incidentalFile), { recursive: true });
    await writeFile(
      extensionManifestPath,
      `${JSON.stringify(
        {
          manifest_version: 3,
          background: {
            service_worker: "build/background.js",
            type: "module"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(extensionBuildFile, "globalThis.__webenvoyBuild = 'bundle';\n", "utf8");
    await writeFile(incidentalFile, "editor cache after build\n", "utf8");
    await utimes(
      extensionManifestPath,
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    await utimes(
      extensionBuildFile,
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    await utimes(
      incidentalFile,
      new Date("2026-05-02T00:00:00.000Z"),
      new Date("2026-05-02T00:00:00.000Z")
    );
    await writeServiceWorkerCache({
      profileDir,
      mtime: new Date("2026-05-01T00:00:00.000Z")
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: unpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: false,
      identityBindingState: "bound",
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      extensionServiceWorkerFreshness: {
        state: "fresh",
        reason: "SERVICE_WORKER_CACHE_CURRENT",
        extensionPath: unpackedDir
      }
    });
  });

  it("fails closed when any extension build output is newer than service worker script cache", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-build-output-sw-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-build-output-sw-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const unpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-build-output-sw-"));
    const extensionManifestPath = join(unpackedDir, "manifest.json");
    const extensionBuildFile = join(unpackedDir, "build", "background.js");
    const extensionDependencyFile = join(unpackedDir, "build", "background-runtime-trust.js");
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(extensionBuildFile), { recursive: true });
    await writeFile(
      extensionManifestPath,
      `${JSON.stringify(
        {
          manifest_version: 3,
          background: {
            service_worker: "build/background.js",
            type: "module"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(extensionBuildFile, "import './background-runtime-trust.js';\n", "utf8");
    await writeFile(extensionDependencyFile, "export const trust = 'newer';\n", "utf8");
    await utimes(
      extensionManifestPath,
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    await utimes(
      extensionBuildFile,
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    await utimes(
      extensionDependencyFile,
      new Date("2026-05-02T00:00:00.000Z"),
      new Date("2026-05-02T00:00:00.000Z")
    );
    await writeServiceWorkerCache({
      profileDir,
      mtime: new Date("2026-05-01T00:00:00.000Z")
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: unpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: true,
      identityBindingState: "mismatch",
      failureReason: "EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED",
      extensionServiceWorkerFreshness: {
        state: "stale",
        reason: "SERVICE_WORKER_CACHE_OLDER_THAN_EXTENSION_BUILD",
        extensionPath: unpackedDir
      }
    });
  });

  it("allows current managed profile service worker cache for unpacked extension builds", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-fresh-sw-"));
    const fakeHome = await mkdtemp(join(tmpdir(), "webenvoy-native-host-home-fresh-sw-"));
    const manifestPath = join(
      fakeHome,
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
      "com.webenvoy.host.json"
    );
    const unpackedDir = await mkdtemp(join(tmpdir(), "webenvoy-unpacked-extension-fresh-sw-"));
    const extensionBuildFile = join(unpackedDir, "build", "background.js");
    vi.stubEnv("HOME", fakeHome);
    await mkdir(dirname(manifestPath), { recursive: true });
    await mkdir(dirname(extensionBuildFile), { recursive: true });
    await writeFile(extensionBuildFile, "globalThis.__webenvoyBuild = 'current';\n", "utf8");
    await utimes(
      extensionBuildFile,
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    await utimes(
      dirname(extensionBuildFile),
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    await utimes(
      unpackedDir,
      new Date("2026-04-30T00:00:00.000Z"),
      new Date("2026-04-30T00:00:00.000Z")
    );
    await writeServiceWorkerCache({
      profileDir,
      mtime: new Date("2026-05-01T00:00:00.000Z")
    });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      location: 4,
      extensionPath: unpackedDir
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {
        persistent_extension_identity: {
          extension_id: EXTENSION_ID
        }
      },
      meta: createProfileMeta(profileDir),
      profileDir
    });

    expect(result).toMatchObject({
      blocking: false,
      identityBindingState: "bound",
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      extensionServiceWorkerFreshness: {
        state: "fresh",
        reason: "SERVICE_WORKER_CACHE_CURRENT",
        extensionPath: unpackedDir
      }
    });
  });

  it("falls back to persistent binding from profile meta when params omit identity", async () => {
    const manifestDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-manifest-meta-"));
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-meta-"));
    const manifestPath = join(manifestDir, "com.webenvoy.host.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          name: "com.webenvoy.host",
          allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProfileExtensionPreferences({
      profileDir,
      extensionId: EXTENSION_ID,
      state: 1
    });
    await writeInstalledProfileExtension({
      profileDir,
      extensionId: EXTENSION_ID
    });

    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    const result = await runIdentityPreflight({
      params: {},
      meta: createProfileMeta(profileDir, {
        persistentExtensionBinding: {
          extensionId: EXTENSION_ID,
          nativeHostName: "com.webenvoy.host",
          browserChannel: "chrome",
          manifestPath
        }
      }),
      profileDir
    });

    expect(result).toMatchObject({
      mode: "official_chrome_persistent_extension",
      identityBindingState: "bound",
      binding: {
        extensionId: EXTENSION_ID,
        nativeHostName: "com.webenvoy.host",
        browserChannel: "chrome",
        manifestPath
      },
      manifestPath,
      failureReason: "IDENTITY_PREFLIGHT_PASSED",
      blocking: false
    });
  });

  it("rejects invalid nativeHostName when reading binding from profile meta", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-native-host-profile-invalid-meta-"));
    setIdentityPreflightAdaptersForTests({
      resolvePreferredBrowserVersionTruthSource: vi.fn().mockResolvedValue({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        browserVersion: "Google Chrome 146.0.7680.154"
      }),
      isUnsupportedBrandedChromeForExtensions: vi.fn().mockReturnValue(true),
      platform: () => "darwin"
    });

    await expect(
      runIdentityPreflight({
        params: {},
        meta: createProfileMeta(profileDir, {
          persistentExtensionBinding: {
            extensionId: EXTENSION_ID,
            nativeHostName: "com..invalid",
            browserChannel: "chrome",
            manifestPath: "/tmp/native-host.json"
          }
        }),
        profileDir
      })
    ).rejects.toMatchObject({
      code: "ERR_PROFILE_INVALID",
      details: {
        stage: "input_validation",
        reason: "IDENTITY_BINDING_INVALID_NATIVE_HOST_NAME"
      }
    });
  });
});
