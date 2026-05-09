import type { BridgeRequestEnvelope, BridgeResponseEnvelope } from "./protocol.js";

export type HostMessage =
  | { kind: "request"; envelope: BridgeRequestEnvelope }
  | { kind: "response"; envelope: BridgeResponseEnvelope };

export type ContentForwardMessage = {
  kind: "forward";
  id: string;
  command: string;
  commandParams: Record<string, unknown>;
  runId: string;
  sessionId: string;
  profile: string;
};

export type ContentResultMessage = {
  kind: "result";
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: { code: string; message: string };
};

export type ContentMessage = ContentForwardMessage | ContentResultMessage;
