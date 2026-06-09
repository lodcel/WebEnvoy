import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { observeActiveExtensionServiceWorkerCodeIdentity } from "../active-service-worker-observer.js";
import { digestServiceWorkerBundleSources } from "../service-worker-bundle-digest.js";

const EXTENSION_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

class MockWebSocket {
  #listeners = new Map<string, ((event: { data?: string }) => void)[]>();

  constructor(_url: string) {
    queueMicrotask(() => {
      this.#emit("open", {});
    });
  }

  addEventListener(type: string, listener: (event: { data?: string }) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  send(raw: string): void {
    const request = JSON.parse(raw) as {
      id: number;
      method: string;
      params?: { scriptId?: string };
    };
    if (request.method === "Debugger.enable") {
      this.#emit("message", {
        data: JSON.stringify({ id: request.id, result: {} })
      });
      queueMicrotask(() => {
        this.#emit("message", {
          data: JSON.stringify({
            method: "Debugger.scriptParsed",
            params: {
              scriptId: "entry",
              url: `chrome-extension://${EXTENSION_ID}/build/background.js`
            }
          })
        });
        this.#emit("message", {
          data: JSON.stringify({
            method: "Debugger.scriptParsed",
            params: {
              scriptId: "module",
              url: `chrome-extension://${EXTENSION_ID}/build/module.js`
            }
          })
        });
      });
      return;
    }
    if (request.method === "Debugger.getScriptSource") {
      const source =
        request.params?.scriptId === "module"
          ? "globalThis.__webenvoyImportedModule = 'fresh';\n"
          : "import './module.js';\nglobalThis.__webenvoyBuild = 'module-entry';\n";
      this.#emit("message", {
        data: JSON.stringify({ id: request.id, result: { scriptSource: source } })
      });
    }
  }

  close(): void {
    // The observer owns the CDP session lifecycle; the mock has no resources.
  }

  #emit(type: string, event: { data?: string }): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("observeActiveExtensionServiceWorkerCodeIdentity", () => {
  it("digests the active MV3 service worker module graph instead of only the entry script", async () => {
    const profileDir = await mkdtemp(join(tmpdir(), "webenvoy-active-sw-observer-"));
    await mkdir(profileDir, { recursive: true });
    await writeFile(join(profileDir, "DevToolsActivePort"), "9234\n/devtools/browser/mock\n", "utf8");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            type: "service_worker",
            url: `chrome-extension://${EXTENSION_ID}/build/background.js`,
            webSocketDebuggerUrl: "ws://127.0.0.1:9234/devtools/service_worker/mock"
          }
        ]
      }))
    );
    vi.stubGlobal("WebSocket", MockWebSocket);

    const result = await observeActiveExtensionServiceWorkerCodeIdentity({
      profileDir,
      extensionId: EXTENSION_ID,
      runId: "run-active-module-graph-001",
      timeoutMs: 1_000
    });

    const expectedDigest = digestServiceWorkerBundleSources([
      {
        scriptPath: "build/background.js",
        source: "import './module.js';\nglobalThis.__webenvoyBuild = 'module-entry';\n"
      },
      {
        scriptPath: "build/module.js",
        source: "globalThis.__webenvoyImportedModule = 'fresh';\n"
      }
    ]);
    expect(result).toMatchObject({
      state: "observed",
      observation: {
        observedActiveServiceWorkerScriptIdentityLocator:
          `extension-service-worker/official-chrome.persistent/${EXTENSION_ID}/active/build/background.js`,
        observedServiceWorkerCodeDigestLocator: `sha256:${expectedDigest}`
      }
    });
  });
});
