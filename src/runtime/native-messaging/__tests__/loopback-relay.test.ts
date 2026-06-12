import { describe, expect, it } from "vitest";

import type { ContentMessage, HostMessage } from "../loopback-messages.js";
import { createPortPair } from "../loopback-port.js";
import { InMemoryBackgroundRelay } from "../loopback-relay.js";

describe("native messaging loopback relay", () => {
  it("opens the bridge with the loopback relay path", async () => {
    const [hostPort, backgroundHostPort] = createPortPair<HostMessage>();
    const [backgroundContentPort] = createPortPair<ContentMessage>();

    new InMemoryBackgroundRelay(backgroundHostPort, backgroundContentPort);

    const open = new Promise<Record<string, unknown>>((resolve) => {
      const off = hostPort.onMessage((message) => {
        if (message.kind === "response") {
          off();
          resolve(message.envelope as Record<string, unknown>);
        }
      });
    });

    hostPort.postMessage({
      kind: "request",
      envelope: {
        id: "open-001",
        method: "bridge.open",
        profile: "profile-a",
        params: {
          protocol: "webenvoy.native-bridge.v1",
          capabilities: ["relay", "heartbeat"]
        }
      }
    });

    await expect(open).resolves.toMatchObject({
      status: "success",
      summary: {
        relay_path: "host>background>content-script>background>host"
      }
    });
    await expect(open).resolves.not.toHaveProperty("command_envelope_v2");
  });

  it("evaluates xhs.editor_input.validate as a gated XHS command", async () => {
    const [hostPort, backgroundHostPort] = createPortPair<HostMessage>();
    const [backgroundContentPort] = createPortPair<ContentMessage>();

    new InMemoryBackgroundRelay(backgroundHostPort, backgroundContentPort);

    const response = new Promise<Record<string, unknown>>((resolve) => {
      const off = hostPort.onMessage((message) => {
        if (message.kind === "response") {
          off();
          resolve(message.envelope as unknown as Record<string, unknown>);
        }
      });
    });

    hostPort.postMessage({
      kind: "request",
      envelope: {
        id: "editor-input-validate-forward-001",
        method: "bridge.forward",
        profile: "profile-a",
        params: {
          command: "xhs.editor_input.validate",
          run_id: "run-editor-input-validate-forward-001",
          command_params: {
            ability: {
              id: "xhs.editor.input.v1",
              layer: "L3",
              action: "write"
            },
            input: {},
            options: {
              issue_scope: "issue_208",
              action_type: "write",
              validation_action: "editor_input",
              requested_execution_mode: "live_write",
              target_domain: "creator.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "creator_publish_tab"
            }
          }
        }
      }
    });

    await expect(response).resolves.toMatchObject({
      status: "error",
      error: {
        code: "ERR_EXECUTION_FAILED"
      },
      command_envelope_v2: {
        ok: false,
        command: "xhs.editor_input.validate",
        run_id: "run-editor-input-validate-forward-001",
        errors: [
          expect.objectContaining({
            code: "ERR_EXECUTION_FAILED",
            category: "runtime"
          })
        ]
      },
      payload: {
        details: expect.objectContaining({
          ability_id: "xhs.editor.input.v1",
          validation_action: "editor_input",
          target_page: "creator_publish_tab",
          failure_signals: expect.arrayContaining(["WRITE_INTERACTION_TIER_REVERSIBLE_INTERACTION"])
        }),
        consumer_gate_result: expect.objectContaining({
          issue_scope: "issue_208",
          action_type: "write",
          requested_execution_mode: "live_write",
          gate_decision: "blocked"
        })
      }
    });
  });
});
