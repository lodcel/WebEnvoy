import path from "node:path";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";

import { describe, expect, it } from "vitest";

import {
  createBridgeForwardRequest,
  createBridgeOpenRequest,
  createHeartbeatRequest
} from "../protocol.js";
import {
  NativeHostBridgeTransport,
  PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME,
  parseNativeHostCommand
} from "../host.js";

describe("native host bridge transport classification", () => {
  it("parses quoted native host command with spaces", () => {
    const parsed = parseNativeHostCommand(
      `"${process.execPath}" "/tmp/mock folder/native-host.mjs" --mode smoke`
    );
    expect(parsed).toEqual({
      file: process.execPath,
      args: ["/tmp/mock folder/native-host.mjs", "--mode", "smoke"]
    });
  });

  it("rejects empty native host command", () => {
    expect(parseNativeHostCommand("   ")).toBeNull();
  });

  it("classifies open without configured native host command as handshake failed", async () => {
    const transport = new NativeHostBridgeTransport(null);
    const startedAt = Date.now();
    await expect(
      transport.open(
        createBridgeOpenRequest({
          id: "open-invalid-001",
          profile: "profile-a",
          timeoutMs: 100
        })
      )
    ).rejects.toMatchObject({
      transportCode: "ERR_TRANSPORT_HANDSHAKE_FAILED"
    });
    expect(Date.now() - startedAt).toBeLessThan(250);
  });

  it("classifies forward without configured native host command as disconnected", async () => {
    const transport = new NativeHostBridgeTransport(null);

    await expect(
      transport.forward(
        createBridgeForwardRequest({
          id: "forward-invalid-001",
          profile: "profile-a",
          sessionId: "nm-session-001",
          runId: "run-forward-invalid-001",
          command: "runtime.ping",
          commandParams: {},
          cwd: "/tmp",
          timeoutMs: 100
        })
      )
    ).rejects.toMatchObject({
      transportCode: "ERR_TRANSPORT_DISCONNECTED"
    });
  });

  it("waits for a persistent extension profile socket before falling back to spawned host", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-delayed-profile-socket-");
    const profile = "xhs_delayed_socket";
    const profileDir = path.join(baseDir, ".webenvoy", "profiles", profile);
    const socketPath = path.join(profileDir, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const previousCwd = process.cwd();
    const previousWait = process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS;
    const previousPoll = process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_POLL_MS;
    await mkdir(profileDir, { recursive: true });

    const server = createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length < 4) {
          return;
        }
        const frameLength = buffer.readUInt32LE(0);
        const frameEnd = 4 + frameLength;
        if (buffer.length < frameEnd) {
          return;
        }
        const frame = buffer.subarray(4, frameEnd);
        const request = JSON.parse(frame.toString("utf8")) as {
          id: string;
        };
        const payload = {
          id: request.id,
          status: "success",
          summary: {
            protocol: "webenvoy.native-bridge.v1",
            session_id: "nm-session-delayed-socket",
            state: "ready"
          },
          error: null
        };
        const body = Buffer.from(JSON.stringify(payload), "utf8");
        const header = Buffer.alloc(4);
        header.writeUInt32LE(body.length, 0);
        socket.end(Buffer.concat([header, body]));
      });
    });

    try {
      process.chdir(baseDir);
      process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS = "500";
      process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_POLL_MS = "20";
      setTimeout(() => {
        server.listen(socketPath);
      }, 80);
      const transport = new NativeHostBridgeTransport(null, {
        waitForProfileSocketOnOpen: true
      });

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-delayed-profile-socket-001",
            profile,
            timeoutMs: 1_000
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          session_id: "nm-session-delayed-socket"
        }
      });
      expect(transport.currentTransportProof()).toMatchObject({
        surface: "profile_socket",
        spawned_host_configured: false
      });
      expect(transport.currentTransportProof().socket_path).toMatch(
        /webenvoy-host-delayed-profile-socket-.+\/\.webenvoy\/profiles\/xhs_delayed_socket\/nm\.sock$/u
      );
      expect(transport.currentTransportProof().attempted_socket_paths?.some((candidate) =>
        /webenvoy-host-delayed-profile-socket-.+\/\.webenvoy\/profiles\/xhs_delayed_socket\/nm\.sock$/u.test(candidate)
      )).toBe(true);
      expect(transport.currentTransportProof().socket_wait_ms).toBeGreaterThan(0);
    } finally {
      process.chdir(previousCwd);
      if (previousWait === undefined) {
        delete process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS;
      } else {
        process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS = previousWait;
      }
      if (previousPoll === undefined) {
        delete process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_POLL_MS;
      } else {
        process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_POLL_MS = previousPoll;
      }
      server.close();
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("does not wait for a missing profile socket when spawned host is configured", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-spawn-no-socket-wait-");
    const mockNativeHostPath = path.resolve(
      path.join(import.meta.dirname, "../../../../tests/fixtures/native-host-mock.mjs")
    );
    const hostCommand = `"${process.execPath}" "${mockNativeHostPath}"`;
    const previousCwd = process.cwd();
    const previousWait = process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS;
    const transport = new NativeHostBridgeTransport(hostCommand);

    try {
      process.chdir(baseDir);
      process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS = "1000";
      const startedAt = Date.now();

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-spawn-without-profile-socket-001",
            profile: "xhs_spawn_without_socket",
            timeoutMs: 1_500
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          state: "ready"
        }
      });

      expect(Date.now() - startedAt).toBeLessThan(900);
      expect(transport.currentTransportProof()).toMatchObject({
        surface: "spawned_host",
        spawned_host_configured: true
      });
    } finally {
      await transport.close();
      process.chdir(previousCwd);
      if (previousWait === undefined) {
        delete process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS;
      } else {
        process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS = previousWait;
      }
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("requires a profile socket for persistent admission even when spawned host is configured", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-admission-requires-socket-");
    const mockNativeHostPath = path.resolve(
      path.join(import.meta.dirname, "../../../../tests/fixtures/native-host-mock.mjs")
    );
    const hostCommand = `"${process.execPath}" "${mockNativeHostPath}"`;
    const previousCwd = process.cwd();
    const previousWait = process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS;
    const transport = new NativeHostBridgeTransport(hostCommand, {
      waitForProfileSocketOnOpen: true
    });

    try {
      process.chdir(baseDir);
      process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS = "100";

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-admission-requires-profile-socket-001",
            profile: "xhs_admission_without_socket",
            timeoutMs: 500
          })
        )
      ).rejects.toMatchObject({
        transportCode: "ERR_TRANSPORT_HANDSHAKE_FAILED"
      });
      expect(transport.currentTransportProof()).toMatchObject({
        surface: "unknown",
        socket_wait_ms: 100
      });
      expect(transport.currentTransportProof().spawned_host_configured).not.toBe(true);
    } finally {
      await transport.close();
      process.chdir(previousCwd);
      if (previousWait === undefined) {
        delete process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS;
      } else {
        process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET_WAIT_MS = previousWait;
      }
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("classifies open response timeout as timeout error", async () => {
    const mockNativeHostPath = path.resolve(
      path.join(import.meta.dirname, "../../../../tests/fixtures/native-host-mock.mjs")
    );
    const hostCommand = `"${process.execPath}" "${mockNativeHostPath}"`;
    const previousMode = process.env.WEBENVOY_NATIVE_HOST_MODE;
    process.env.WEBENVOY_NATIVE_HOST_MODE = "drop-open";

    try {
      const transport = new NativeHostBridgeTransport(hostCommand);
      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-timeout-001",
            profile: "profile-a",
            timeoutMs: 50
          })
        )
      ).rejects.toMatchObject({
        transportCode: "ERR_TRANSPORT_TIMEOUT"
      });
    } finally {
      if (previousMode === undefined) {
        delete process.env.WEBENVOY_NATIVE_HOST_MODE;
      } else {
        process.env.WEBENVOY_NATIVE_HOST_MODE = previousMode;
      }
    }
  });

  it("does not fall back to spawned host when profile socket is unavailable", async () => {
    const mockNativeHostPath = path.resolve(
      path.join(import.meta.dirname, "../../../../tests/fixtures/native-host-mock.mjs")
    );
    const hostCommand = `"${process.execPath}" "${mockNativeHostPath}"`;
    const transport = new NativeHostBridgeTransport(hostCommand, {
      socketPath: `/tmp/webenvoy-missing-socket-${Date.now()}.sock`
    });

    await expect(
      transport.open(
        createBridgeOpenRequest({
          id: "open-socket-required-001",
          profile: "xhs_208_probe",
          timeoutMs: 80
        })
      )
    ).rejects.toMatchObject({
      transportCode: "ERR_TRANSPORT_HANDSHAKE_FAILED"
    });
  });

  it("prefers profile socket over spawned host when official socket bridge is available", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-socket-");
    const profile = "xhs_208_probe";
    const profileDir = path.join(baseDir, ".webenvoy", "profiles", profile);
    const socketPath = path.join(profileDir, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const previousCwd = process.cwd();
    const requests: Array<{ method: string; command?: string }> = [];
    await mkdir(profileDir, { recursive: true });

    const server = createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length < 4) {
          return;
        }
        const frameLength = buffer.readUInt32LE(0);
        const frameEnd = 4 + frameLength;
        if (buffer.length < frameEnd) {
          return;
        }
        const frame = buffer.subarray(4, frameEnd);
        const request = JSON.parse(frame.toString("utf8")) as {
          id: string;
          method: string;
          params: { command?: string; session_id?: string };
        };
        requests.push({
          method: request.method,
          command: request.params.command
        });
        const payload =
          request.method === "bridge.open"
            ? {
                id: request.id,
                status: "success",
                summary: {
                  protocol: "webenvoy.native-bridge.v1",
                  session_id: "nm-session-socket",
                  state: "ready"
                },
                error: null
              }
            : request.method === "__ping__"
              ? {
                  id: request.id,
                  status: "success",
                  summary: {
                    session_id: request.params.session_id ?? "nm-session-socket"
                  },
                  error: null
                }
              : {
                  id: request.id,
                  status: "success",
                  summary: {
                    session_id: request.params.session_id ?? "nm-session-socket",
                    run_id: "run-socket-001",
                    command: request.params.command ?? "runtime.ping",
                    relay_path: "host>background>content-script>background>host"
                  },
                  payload: {
                    message: "pong"
                  },
                  error: null
                };
        const body = Buffer.from(JSON.stringify(payload), "utf8");
        const header = Buffer.alloc(4);
        header.writeUInt32LE(body.length, 0);
        socket.end(Buffer.concat([header, body]));
      });
    });

    try {
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));
      process.chdir(baseDir);
      const transport = new NativeHostBridgeTransport(`"${process.execPath}" "/tmp/does-not-exist.mjs"`);

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-socket-auto-001",
            profile,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          session_id: "nm-session-socket"
        }
      });

      await expect(
        transport.heartbeat({
          id: "hb-socket-auto-001",
          method: "__ping__",
          profile: null,
          params: {
            session_id: "nm-session-socket"
          },
          timeout_ms: 100
        })
      ).resolves.toMatchObject({
        status: "success"
      });

      await expect(
        transport.forward(
          createBridgeForwardRequest({
            id: "forward-socket-auto-001",
            profile,
            sessionId: "nm-session-socket",
            runId: "run-socket-001",
            command: "runtime.ping",
            commandParams: {},
            cwd: baseDir,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        payload: {
          message: "pong"
        }
      });

      expect(requests).toEqual([
        { method: "bridge.open", command: undefined },
        { method: "__ping__", command: undefined },
        { method: "bridge.forward", command: "runtime.ping" }
      ]);
    } finally {
      process.chdir(previousCwd);
      server.close();
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("keeps the profile socket open long enough to receive a delayed structured response", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-socket-delayed-response-");
    const profile = "xhs_208_probe";
    const profileDir = path.join(baseDir, ".webenvoy", "profiles", profile);
    const socketPath = path.join(profileDir, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const previousCwd = process.cwd();
    await mkdir(profileDir, { recursive: true });

    const server = createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length < 4) {
          return;
        }
        const frameLength = buffer.readUInt32LE(0);
        const frameEnd = 4 + frameLength;
        if (buffer.length < frameEnd) {
          return;
        }
        const frame = buffer.subarray(4, frameEnd);
        const request = JSON.parse(frame.toString("utf8")) as {
          id: string;
          method: string;
          params: { command?: string; session_id?: string };
        };
        const payload = {
          id: request.id,
          status: "success",
          summary: {
            session_id: request.params.session_id ?? "nm-session-delayed",
            run_id: "run-delayed-socket-001",
            command: request.params.command ?? "runtime.ping",
            relay_path: "host>background>content-script>background>host"
          },
          payload: {
            message: "delayed-pong"
          },
          error: null
        };
        const body = Buffer.from(JSON.stringify(payload), "utf8");
        const header = Buffer.alloc(4);
        header.writeUInt32LE(body.length, 0);
        setTimeout(() => {
          socket.end(Buffer.concat([header, body]));
        }, 1_150);
      });
    });

    try {
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));
      process.chdir(baseDir);
      const transport = new NativeHostBridgeTransport(`"${process.execPath}" "/tmp/does-not-exist.mjs"`);

      await expect(
        transport.forward(
          createBridgeForwardRequest({
            id: "forward-socket-delayed-response-001",
            profile,
            sessionId: "nm-session-delayed",
            runId: "run-delayed-socket-001",
            command: "runtime.ping",
            commandParams: {},
            cwd: baseDir,
            timeoutMs: 1_100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        payload: {
          message: "delayed-pong"
        }
      });
    } finally {
      process.chdir(previousCwd);
      server.close();
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("does not reuse a previous profile socket when opening a different profile", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-profile-switch-");
    const profileA = "xhs_profile_a";
    const profileB = "xhs_profile_b";
    const profileADir = path.join(baseDir, ".webenvoy", "profiles", profileA);
    const profileBDir = path.join(baseDir, ".webenvoy", "profiles", profileB);
    const profileASocketPath = path.join(profileADir, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const profileBSocketPath = path.join(profileBDir, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const previousCwd = process.cwd();
    const requestsA: Array<{ method: string; profile: string | null }> = [];
    const requestsB: Array<{ method: string; profile: string | null }> = [];
    await mkdir(profileADir, { recursive: true });
    await mkdir(profileBDir, { recursive: true });

    const createSocketServer = (
      requests: Array<{ method: string; profile: string | null }>,
      sessionId: string
    ) =>
      createServer((socket) => {
        let buffer = Buffer.alloc(0);
        socket.on("data", (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          if (buffer.length < 4) {
            return;
          }
          const frameLength = buffer.readUInt32LE(0);
          const frameEnd = 4 + frameLength;
          if (buffer.length < frameEnd) {
            return;
          }
          const frame = buffer.subarray(4, frameEnd);
          const request = JSON.parse(frame.toString("utf8")) as {
            id: string;
            method: string;
            profile: string | null;
          };
          requests.push({
            method: request.method,
            profile: request.profile
          });
          const payload = {
            id: request.id,
            status: "success",
            summary: {
              protocol: "webenvoy.native-bridge.v1",
              session_id: sessionId,
              state: "ready"
            },
            error: null
          };
          const body = Buffer.from(JSON.stringify(payload), "utf8");
          const header = Buffer.alloc(4);
          header.writeUInt32LE(body.length, 0);
          socket.end(Buffer.concat([header, body]));
        });
      });

    const serverA = createSocketServer(requestsA, "nm-session-a");
    const serverB = createSocketServer(requestsB, "nm-session-b");

    try {
      await new Promise<void>((resolve) => serverA.listen(profileASocketPath, resolve));
      await new Promise<void>((resolve) => serverB.listen(profileBSocketPath, resolve));
      process.chdir(baseDir);
      const transport = new NativeHostBridgeTransport(`"${process.execPath}" "/tmp/does-not-exist.mjs"`);

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-profile-switch-a-001",
            profile: profileA,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          session_id: "nm-session-a"
        }
      });

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-profile-switch-b-001",
            profile: profileB,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          session_id: "nm-session-b"
        }
      });

      expect(requestsA).toEqual([{ method: "bridge.open", profile: profileA }]);
      expect(requestsB).toEqual([{ method: "bridge.open", profile: profileB }]);
    } finally {
      process.chdir(previousCwd);
      serverA.close();
      serverB.close();
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("falls back to the bootstrap root socket when profile-specific socket is unavailable", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-bootstrap-socket-");
    const profile = "xhs_208_probe";
    const profileRoot = path.join(baseDir, ".webenvoy", "profiles");
    const socketPath = path.join(profileRoot, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const previousCwd = process.cwd();
    const requests: Array<{ method: string; profile: string | null; command?: string }> = [];
    await mkdir(profileRoot, { recursive: true });

    const server = createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length < 4) {
          return;
        }
        const frameLength = buffer.readUInt32LE(0);
        const frameEnd = 4 + frameLength;
        if (buffer.length < frameEnd) {
          return;
        }
        const frame = buffer.subarray(4, frameEnd);
        const request = JSON.parse(frame.toString("utf8")) as {
          id: string;
          method: string;
          profile: string | null;
          params: { command?: string; session_id?: string };
        };
        requests.push({
          method: request.method,
          profile: request.profile,
          command: request.params.command
        });
        const payload =
          request.method === "bridge.open"
            ? {
                id: request.id,
                status: "success",
                summary: {
                  protocol: "webenvoy.native-bridge.v1",
                  session_id: "nm-session-bootstrap",
                  state: "ready"
                },
                error: null
              }
            : {
                id: request.id,
                status: "success",
                summary: {
                  session_id: request.params.session_id ?? "nm-session-bootstrap",
                  run_id: "run-bootstrap-socket-001",
                  command: request.params.command ?? "runtime.ping",
                  relay_path: "host>background>content-script>background>host"
                },
                payload: {
                  message: "pong"
                },
                error: null
              };
        const body = Buffer.from(JSON.stringify(payload), "utf8");
        const header = Buffer.alloc(4);
        header.writeUInt32LE(body.length, 0);
        socket.end(Buffer.concat([header, body]));
      });
    });

    try {
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));
      process.chdir(baseDir);
      const transport = new NativeHostBridgeTransport(`"${process.execPath}" "/tmp/does-not-exist.mjs"`);

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-bootstrap-socket-001",
            profile,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          session_id: "nm-session-bootstrap"
        }
      });

      await expect(
        transport.forward(
          createBridgeForwardRequest({
            id: "forward-bootstrap-socket-001",
            profile,
            sessionId: "nm-session-bootstrap",
            runId: "run-bootstrap-socket-001",
            command: "runtime.ping",
            commandParams: {},
            cwd: baseDir,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        payload: {
          message: "pong"
        }
      });

      expect(requests).toEqual([
        { method: "bridge.open", profile, command: undefined },
        { method: "bridge.forward", profile, command: "runtime.ping" }
      ]);
    } finally {
      process.chdir(previousCwd);
      server.close();
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("falls back to the root socket when a previously promoted profile socket disappears", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-profile-socket-disappears-");
    const profile = "xhs_208_probe";
    const profileRoot = path.join(baseDir, ".webenvoy", "profiles");
    const profileDir = path.join(profileRoot, profile);
    const rootSocketPath = path.join(profileRoot, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const profileSocketPath = path.join(profileDir, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const previousCwd = process.cwd();
    const rootRequests: Array<{ method: string; profile: string | null; command?: string }> = [];
    const profileRequests: Array<{ method: string; profile: string | null; command?: string }> = [];
    await mkdir(profileDir, { recursive: true });

    const writeResponse = (
      socket: Parameters<Parameters<typeof createServer>[0]>[0],
      request: { id: string; method: string; params: { command?: string; session_id?: string } },
      sessionId: string
    ) => {
      const payload =
        request.method === "bridge.open"
          ? {
              id: request.id,
              status: "success",
              summary: {
                protocol: "webenvoy.native-bridge.v1",
                session_id: sessionId,
                state: "ready"
              },
              error: null
            }
          : {
              id: request.id,
              status: "success",
              summary: {
                session_id: request.params.session_id ?? sessionId,
                run_id: "run-profile-disappears-001",
                command: request.params.command ?? "runtime.ping",
                relay_path: "host>background>content-script>background>host"
              },
              payload: {
                message: "pong"
              },
              error: null
            };
      const body = Buffer.from(JSON.stringify(payload), "utf8");
      const header = Buffer.alloc(4);
      header.writeUInt32LE(body.length, 0);
      socket.end(Buffer.concat([header, body]));
    };

    const createSocketServerFor = (
      requests: Array<{ method: string; profile: string | null; command?: string }>,
      sessionId: string
    ) =>
      createServer((socket) => {
        let buffer = Buffer.alloc(0);
        socket.on("data", (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          if (buffer.length < 4) {
            return;
          }
          const frameLength = buffer.readUInt32LE(0);
          const frameEnd = 4 + frameLength;
          if (buffer.length < frameEnd) {
            return;
          }
          const frame = buffer.subarray(4, frameEnd);
          const request = JSON.parse(frame.toString("utf8")) as {
            id: string;
            method: string;
            profile: string | null;
            params: { command?: string; session_id?: string };
          };
          requests.push({
            method: request.method,
            profile: request.profile,
            command: request.params.command
          });
          writeResponse(socket, request, sessionId);
        });
      });

    const rootServer = createSocketServerFor(rootRequests, "nm-session-root");
    const profileServer = createSocketServerFor(profileRequests, "nm-session-profile");

    try {
      await new Promise<void>((resolve) => rootServer.listen(rootSocketPath, resolve));
      await new Promise<void>((resolve) => profileServer.listen(profileSocketPath, resolve));
      process.chdir(baseDir);
      const transport = new NativeHostBridgeTransport(`"${process.execPath}" "/tmp/does-not-exist.mjs"`);

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-profile-disappears-001",
            profile,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          session_id: "nm-session-profile"
        }
      });

      profileServer.close();
      await rm(profileSocketPath, { force: true });

      await expect(
        transport.forward(
          createBridgeForwardRequest({
            id: "forward-profile-disappears-001",
            profile,
            sessionId: "nm-session-profile",
            runId: "run-profile-disappears-001",
            command: "runtime.ping",
            commandParams: {},
            cwd: baseDir,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        payload: {
          message: "pong"
        }
      });

      expect(profileRequests).toEqual([
        { method: "bridge.open", profile, command: undefined }
      ]);
      expect(rootRequests).toEqual([
        { method: "bridge.forward", profile, command: "runtime.ping" }
      ]);
    } finally {
      process.chdir(previousCwd);
      rootServer.close();
      profileServer.close();
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("keeps the active profile socket ahead of the root socket for profileless heartbeats", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-profileless-heartbeat-");
    const profile = "xhs_208_probe";
    const profileRoot = path.join(baseDir, ".webenvoy", "profiles");
    const profileDir = path.join(profileRoot, profile);
    const rootSocketPath = path.join(profileRoot, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const profileSocketPath = path.join(profileDir, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const previousCwd = process.cwd();
    const rootRequests: Array<{ method: string; profile: string | null; command?: string }> = [];
    const profileRequests: Array<{ method: string; profile: string | null; command?: string }> = [];
    await mkdir(profileDir, { recursive: true });

    const writeResponse = (
      socket: Parameters<Parameters<typeof createServer>[0]>[0],
      request: { id: string; method: string; profile: string | null; params: { command?: string; session_id?: string } },
      sessionId: string
    ) => {
      const payload =
        request.method === "bridge.open"
          ? {
              id: request.id,
              status: "success",
              summary: {
                protocol: "webenvoy.native-bridge.v1",
                session_id: sessionId,
                state: "ready"
              },
              error: null
            }
          : {
              id: request.id,
              status: "success",
              summary: {
                session_id: request.params.session_id ?? sessionId
              },
              error: null
            };
      const body = Buffer.from(JSON.stringify(payload), "utf8");
      const header = Buffer.alloc(4);
      header.writeUInt32LE(body.length, 0);
      socket.end(Buffer.concat([header, body]));
    };

    const createSocketServerFor = (
      requests: Array<{ method: string; profile: string | null; command?: string }>,
      sessionId: string
    ) =>
      createServer((socket) => {
        let buffer = Buffer.alloc(0);
        socket.on("data", (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          if (buffer.length < 4) {
            return;
          }
          const frameLength = buffer.readUInt32LE(0);
          const frameEnd = 4 + frameLength;
          if (buffer.length < frameEnd) {
            return;
          }
          const frame = buffer.subarray(4, frameEnd);
          const request = JSON.parse(frame.toString("utf8")) as {
            id: string;
            method: string;
            profile: string | null;
            params: { command?: string; session_id?: string };
          };
          requests.push({
            method: request.method,
            profile: request.profile,
            command: request.params.command
          });
          writeResponse(socket, request, sessionId);
        });
      });

    const rootServer = createSocketServerFor(rootRequests, "nm-session-root");
    const profileServer = createSocketServerFor(profileRequests, "nm-session-profile");

    try {
      await new Promise<void>((resolve) => rootServer.listen(rootSocketPath, resolve));
      await new Promise<void>((resolve) => profileServer.listen(profileSocketPath, resolve));
      process.chdir(baseDir);
      const transport = new NativeHostBridgeTransport(`"${process.execPath}" "/tmp/does-not-exist.mjs"`);

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-profileless-heartbeat-001",
            profile,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          session_id: "nm-session-profile"
        }
      });

      await expect(
        transport.heartbeat(
          createHeartbeatRequest({
            id: "heartbeat-profileless-001",
            sessionId: "nm-session-profile"
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          session_id: "nm-session-profile"
        }
      });

      expect(profileRequests).toEqual([
        { method: "bridge.open", profile, command: undefined },
        { method: "__ping__", profile: null, command: undefined }
      ]);
      expect(rootRequests).toEqual([]);
    } finally {
      process.chdir(previousCwd);
      rootServer.close();
      profileServer.close();
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("promotes from bootstrap root socket to a profile-specific socket after handshake", async () => {
    const baseDir = await mkdtemp("/tmp/webenvoy-host-bootstrap-promote-");
    const profile = "xhs_208_probe";
    const profileRoot = path.join(baseDir, ".webenvoy", "profiles");
    const profileDir = path.join(profileRoot, profile);
    const rootSocketPath = path.join(profileRoot, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const profileSocketPath = path.join(profileDir, PROFILE_NATIVE_BRIDGE_SOCKET_FILENAME);
    const previousCwd = process.cwd();
    const rootRequests: Array<{ method: string; profile: string | null }> = [];
    const profileRequests: Array<{ method: string; profile: string | null; command?: string }> = [];
    await mkdir(profileRoot, { recursive: true });

    const profileServer = createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length < 4) {
          return;
        }
        const frameLength = buffer.readUInt32LE(0);
        const frameEnd = 4 + frameLength;
        if (buffer.length < frameEnd) {
          return;
        }
        const frame = buffer.subarray(4, frameEnd);
        const request = JSON.parse(frame.toString("utf8")) as {
          id: string;
          method: string;
          profile: string | null;
          params: { command?: string; session_id?: string };
        };
        profileRequests.push({
          method: request.method,
          profile: request.profile,
          command: request.params.command
        });
        const payload =
          request.method === "__ping__"
            ? {
                id: request.id,
                status: "success",
                summary: {
                  session_id: request.params.session_id ?? "nm-session-profile"
                },
                error: null
              }
            : {
                id: request.id,
                status: "success",
                summary: {
                  session_id: request.params.session_id ?? "nm-session-profile",
                  run_id: "run-profile-socket-001",
                  command: request.params.command ?? "runtime.ping",
                  relay_path: "host>background>content-script>background>host"
                },
                payload: {
                  message: "pong"
                },
                error: null
              };
        const body = Buffer.from(JSON.stringify(payload), "utf8");
        const header = Buffer.alloc(4);
        header.writeUInt32LE(body.length, 0);
        socket.end(Buffer.concat([header, body]));
      });
    });

    const rootServer = createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length < 4) {
          return;
        }
        const frameLength = buffer.readUInt32LE(0);
        const frameEnd = 4 + frameLength;
        if (buffer.length < frameEnd) {
          return;
        }
        const frame = buffer.subarray(4, frameEnd);
        const request = JSON.parse(frame.toString("utf8")) as {
          id: string;
          method: string;
          profile: string | null;
        };
        rootRequests.push({
          method: request.method,
          profile: request.profile
        });
        void (async () => {
          await mkdir(profileDir, { recursive: true });
          await new Promise<void>((resolve) => profileServer.listen(profileSocketPath, resolve));
          rootServer.close();
          await rm(rootSocketPath, { force: true });
          const payload = {
            id: request.id,
            status: "success",
            summary: {
              protocol: "webenvoy.native-bridge.v1",
              session_id: "nm-session-profile",
              state: "ready"
            },
            error: null
          };
          const body = Buffer.from(JSON.stringify(payload), "utf8");
          const header = Buffer.alloc(4);
          header.writeUInt32LE(body.length, 0);
          socket.end(Buffer.concat([header, body]));
        })();
      });
    });

    try {
      await new Promise<void>((resolve) => rootServer.listen(rootSocketPath, resolve));
      process.chdir(baseDir);
      const transport = new NativeHostBridgeTransport(`"${process.execPath}" "/tmp/does-not-exist.mjs"`);

      await expect(
        transport.open(
          createBridgeOpenRequest({
            id: "open-bootstrap-promote-001",
            profile,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        summary: {
          session_id: "nm-session-profile"
        }
      });

      await expect(
        transport.heartbeat({
          id: "hb-bootstrap-promote-001",
          method: "__ping__",
          profile: null,
          params: {
            session_id: "nm-session-profile"
          },
          timeout_ms: 100
        })
      ).resolves.toMatchObject({
        status: "success"
      });

      await expect(
        transport.forward(
          createBridgeForwardRequest({
            id: "forward-bootstrap-promote-001",
            profile,
            sessionId: "nm-session-profile",
            runId: "run-bootstrap-promote-001",
            command: "runtime.ping",
            commandParams: {},
            cwd: baseDir,
            timeoutMs: 100
          })
        )
      ).resolves.toMatchObject({
        status: "success",
        payload: {
          message: "pong"
        }
      });

      expect(rootRequests).toEqual([{ method: "bridge.open", profile }]);
      expect(profileRequests).toEqual([
        { method: "__ping__", profile: null, command: undefined },
        { method: "bridge.forward", profile, command: "runtime.ping" }
      ]);
    } finally {
      process.chdir(previousCwd);
      rootServer.close();
      profileServer.close();
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});
