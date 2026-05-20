export type NativeBridgeMethod = "bridge.open" | "bridge.forward" | "__ping__";

export type NativeBridgeState = "connecting" | "ready" | "recovering" | "disconnected";

export type NativeBridgeError = {
  code: string;
  message: string;
};

export type NativeBridgeRequest = {
  id: string;
  method: NativeBridgeMethod;
  profile: string | null;
  params: Record<string, unknown>;
  timeout_ms?: number;
};

export type NativeBridgeResponse = {
  id: string;
  status: "success" | "error";
  summary: Record<string, unknown>;
  payload?: Record<string, unknown>;
  error: null | NativeBridgeError;
};

export type NativeMessageListener = (message: NativeBridgeResponse) => void;

export type PendingForward<
  TConsumerGateResult = Record<string, unknown>,
  TGatePayload = Record<string, unknown>
> = {
  request: NativeBridgeRequest;
  timeout: ReturnType<typeof setTimeout>;
  consumerGateResult?: TConsumerGateResult;
  gatePayload?: TGatePayload;
  suppressHostResponse?: boolean;
};
