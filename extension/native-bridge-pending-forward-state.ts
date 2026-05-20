import type {
  NativeBridgeError,
  NativeBridgeResponse,
  PendingForward
} from "./native-bridge-protocol.js";

export class NativeBridgePendingForwardState {
  #pending = new Map<string, PendingForward>();

  register(id: string, pending: PendingForward): void {
    this.#pending.set(id, pending);
  }

  take(id: string): PendingForward | null {
    const pending = this.#pending.get(id);
    if (!pending) {
      return null;
    }
    clearTimeout(pending.timeout);
    this.#pending.delete(id);
    return pending;
  }

  fail(
    id: string,
    error: NativeBridgeError,
    emit: (payload: NativeBridgeResponse) => void
  ): void {
    const pending = this.take(id);
    if (!pending || pending.suppressHostResponse) {
      return;
    }
    emit({
      id,
      status: "error",
      summary: {
        relay_path: "host>background>content-script>background>host"
      },
      ...(pending.gatePayload ? { payload: { ...pending.gatePayload } } : {}),
      error
    });
  }

  failAll(
    error: NativeBridgeError,
    emit: (payload: NativeBridgeResponse) => void
  ): void {
    for (const id of [...this.#pending.keys()]) {
      this.fail(id, error, emit);
    }
  }
}
