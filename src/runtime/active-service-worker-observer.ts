import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  digestServiceWorkerBundleSources,
  normalizeServiceWorkerBundleScriptPath,
  type ServiceWorkerBundleSource
} from "./service-worker-bundle-digest.js";

export interface ActiveServiceWorkerCodeIdentityObservation {
  extensionId: string;
  runId: string;
  observedActiveServiceWorkerScriptIdentityLocator: string;
  observedServiceWorkerCodeDigestLocator: string;
  observedAt: string;
}

export type ActiveServiceWorkerObserverResult =
  | {
      state: "observed";
      observation: ActiveServiceWorkerCodeIdentityObservation;
    }
  | {
      state: "unavailable";
      reason:
        | "devtools_port_missing"
        | "service_worker_target_missing"
        | "service_worker_debugger_unavailable"
        | "service_worker_script_source_missing";
    };

type DevToolsTarget = {
  type?: unknown;
  url?: unknown;
  webSocketDebuggerUrl?: unknown;
};

type CdpMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
};

type CdpSend = (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const fetchJsonWithTimeout = async (url: string, timeoutMs: number): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`status=${String(response.status)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const waitForDevToolsPort = async (
  profileDir: string,
  deadlineMs: number
): Promise<number | null> => {
  const activePortPath = join(profileDir, "DevToolsActivePort");
  while (Date.now() < deadlineMs) {
    try {
      const raw = await readFile(activePortPath, "utf8");
      const [portLine] = raw.split("\n");
      const port = Number(portLine);
      if (Number.isInteger(port) && port > 0) {
        return port;
      }
    } catch {
      // Chrome writes DevToolsActivePort after the browser is ready.
    }
    await sleep(100);
  }
  return null;
};

const normalizeExtensionScriptPath = (targetUrl: string, extensionId: string): string | null => {
  const prefix = `chrome-extension://${extensionId}/`;
  if (!targetUrl.startsWith(prefix)) {
    return null;
  }
  const scriptPath = targetUrl.slice(prefix.length).split(/[?#]/u)[0] ?? "";
  return scriptPath.length > 0 ? scriptPath : null;
};

const buildObservedScriptLocator = (extensionId: string, scriptPath: string): string =>
  `extension-service-worker/official-chrome.persistent/${extensionId}/active/${scriptPath}`;

const waitForServiceWorkerTarget = async (input: {
  cdpPort: number;
  extensionId: string;
  deadlineMs: number;
}): Promise<{ wsUrl: string; scriptPath: string } | null> => {
  while (Date.now() < input.deadlineMs) {
    try {
      const payload = await fetchJsonWithTimeout(
        `http://127.0.0.1:${String(input.cdpPort)}/json/list`,
        Math.min(1_000, Math.max(1, input.deadlineMs - Date.now()))
      );
      if (Array.isArray(payload)) {
        for (const item of payload as DevToolsTarget[]) {
          if (item.type !== "service_worker") {
            continue;
          }
          if (typeof item.url !== "string" || typeof item.webSocketDebuggerUrl !== "string") {
            continue;
          }
          const scriptPath = normalizeExtensionScriptPath(item.url, input.extensionId);
          if (scriptPath) {
            return {
              wsUrl: item.webSocketDebuggerUrl,
              scriptPath
            };
          }
        }
      }
    } catch {
      // CDP target list can be briefly unavailable during startup.
    }
    await sleep(100);
  }
  return null;
};

const withCdpSession = async <T>(
  wsUrl: string,
  run: (send: CdpSend, takeEvents: () => CdpMessage[]) => Promise<T>,
  deadlineMs: number
): Promise<T> => {
  if (typeof WebSocket !== "function") {
    throw new Error("global WebSocket is unavailable; Node >= 22 is required");
  }
  const ws = new WebSocket(wsUrl);
  const events: CdpMessage[] = [];
  const pending = new Map<
    number,
    {
      resolve: (value: Record<string, unknown>) => void;
      reject: (error: Error) => void;
    }
  >();
  let nextId = 1;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("service worker CDP websocket open timeout")),
      Math.min(5_000, Math.max(1, deadlineMs - Date.now()))
    );
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("service worker CDP websocket error"));
    });
  });

  ws.addEventListener("message", (event) => {
    const data = typeof event.data === "string" ? event.data : "";
    if (data.length === 0) {
      return;
    }
    let parsed: CdpMessage | null = null;
    try {
      parsed = asRecord(JSON.parse(data)) as CdpMessage | null;
    } catch {
      return;
    }
    if (!parsed) {
      return;
    }
    if (typeof parsed.id === "number") {
      const slot = pending.get(parsed.id);
      if (!slot) {
        return;
      }
      pending.delete(parsed.id);
      if (parsed.error) {
        slot.reject(new Error(parsed.error.message ?? "CDP command failed"));
      } else {
        slot.resolve(parsed.result ?? {});
      }
      return;
    }
    events.push(parsed);
  });

  const send: CdpSend = async (method, params = {}) => {
    const id = nextId;
    nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          pending.delete(id);
          reject(new Error(`CDP ${method} timeout`));
        },
        Math.min(5_000, Math.max(1, deadlineMs - Date.now()))
      );
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
      ws.send(payload);
    });
  };

  try {
    return await run(send, () => events.splice(0, events.length));
  } finally {
    for (const slot of pending.values()) {
      slot.reject(new Error("CDP session closed"));
    }
    pending.clear();
    ws.close();
  }
};

const readServiceWorkerBundleSources = async (input: {
  wsUrl: string;
  extensionId: string;
  targetScriptPath: string;
  deadlineMs: number;
}): Promise<ServiceWorkerBundleSource[] | null> => {
  try {
    return await withCdpSession(
      input.wsUrl,
      async (send, takeEvents) => {
        await send("Debugger.enable");
        const scripts = new Map<string, string>();
        let lastObservedScriptAt = Date.now();
        while (
          Date.now() < input.deadlineMs &&
          (!scripts.has(input.targetScriptPath) || Date.now() - lastObservedScriptAt < 150)
        ) {
          for (const event of takeEvents()) {
            if (event.method !== "Debugger.scriptParsed") {
              continue;
            }
            const params = event.params ?? {};
            const url = typeof params.url === "string" ? params.url : "";
            const currentScriptId =
              typeof params.scriptId === "string" ? params.scriptId : null;
            const scriptPath = normalizeExtensionScriptPath(url, input.extensionId);
            const normalizedScriptPath = scriptPath
              ? normalizeServiceWorkerBundleScriptPath(scriptPath)
              : null;
            if (currentScriptId && normalizedScriptPath) {
              scripts.set(normalizedScriptPath, currentScriptId);
              lastObservedScriptAt = Date.now();
            }
          }
          await sleep(50);
        }
        if (!scripts.has(input.targetScriptPath)) {
          return null;
        }
        const sources: ServiceWorkerBundleSource[] = [];
        for (const [scriptPath, scriptId] of [...scripts.entries()].sort(([left], [right]) =>
          left.localeCompare(right)
        )) {
          const result = await send("Debugger.getScriptSource", { scriptId });
          if (typeof result.scriptSource !== "string") {
            return null;
          }
          sources.push({ scriptPath, source: result.scriptSource });
        }
        return sources;
      },
      input.deadlineMs
    );
  } catch {
    return null;
  }
};

export const observeActiveExtensionServiceWorkerCodeIdentity = async (input: {
  profileDir: string;
  extensionId: string;
  runId: string;
  timeoutMs?: number;
}): Promise<ActiveServiceWorkerObserverResult> => {
  const deadlineMs = Date.now() + (input.timeoutMs ?? 10_000);
  const cdpPort = await waitForDevToolsPort(input.profileDir, deadlineMs);
  if (!cdpPort) {
    return { state: "unavailable", reason: "devtools_port_missing" };
  }
  const target = await waitForServiceWorkerTarget({
    cdpPort,
    extensionId: input.extensionId,
    deadlineMs
  });
  if (!target) {
    return { state: "unavailable", reason: "service_worker_target_missing" };
  }
  const targetScriptPath = normalizeServiceWorkerBundleScriptPath(target.scriptPath);
  if (!targetScriptPath) {
    return { state: "unavailable", reason: "service_worker_script_source_missing" };
  }
  const sources = await readServiceWorkerBundleSources({
    wsUrl: target.wsUrl,
    extensionId: input.extensionId,
    targetScriptPath,
    deadlineMs
  });
  if (sources === null) {
    return { state: "unavailable", reason: "service_worker_script_source_missing" };
  }
  const digest = digestServiceWorkerBundleSources(sources);
  if (digest === null) {
    return { state: "unavailable", reason: "service_worker_script_source_missing" };
  }
  return {
    state: "observed",
    observation: {
      extensionId: input.extensionId,
      runId: input.runId,
      observedActiveServiceWorkerScriptIdentityLocator: buildObservedScriptLocator(
        input.extensionId,
        targetScriptPath
      ),
      observedServiceWorkerCodeDigestLocator: `sha256:${digest}`,
      observedAt: new Date().toISOString()
    }
  };
};
