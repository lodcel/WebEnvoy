import type {
  NativeBridgeRequest as BridgeRequest,
  NativeBridgeResponse as BridgeResponse
} from "./native-bridge-protocol.js";

type BridgeCommandHandler = (request: BridgeRequest) => Promise<void> | void;

export interface BackgroundCommandDispatchHandlers {
  emit(message: BridgeResponse): void;
  dispatchForward(request: BridgeRequest): Promise<void>;
  isXhsGateCommand(command: string): boolean;
  handleRuntimeBootstrap: BridgeCommandHandler;
  handleRuntimeTabs: BridgeCommandHandler;
  handleRuntimeRestoreXhsTarget: BridgeCommandHandler;
  handleRuntimeReloadTab: BridgeCommandHandler;
  handleRuntimeXhsDebugPageState: BridgeCommandHandler;
  handleRuntimeXhsCaptureUserHomeContext: BridgeCommandHandler;
  handleRuntimeXhsDebugMainWorldRoundtrip: BridgeCommandHandler;
  handleRuntimeXhsOpenResultCard: BridgeCommandHandler;
  handleRuntimeXhsDebugResultTargets: BridgeCommandHandler;
  handleRuntimeMainWorldProbe: BridgeCommandHandler;
  handleRuntimeTrustedFingerprintProbe: BridgeCommandHandler;
  handleRuntimeReadiness: BridgeCommandHandler;
}

export const dispatchBackgroundBridgeCommand = async (
  request: BridgeRequest,
  handlers: BackgroundCommandDispatchHandlers
): Promise<void> => {
  const command = String(request.params.command ?? "");

  if (command === "runtime.bootstrap") {
    await handlers.handleRuntimeBootstrap(request);
    return;
  }
  if (command === "runtime.tabs") {
    await handlers.handleRuntimeTabs(request);
    return;
  }
  if (command === "runtime.restore_xhs_target") {
    await handlers.handleRuntimeRestoreXhsTarget(request);
    return;
  }
  if (command === "runtime.reload_tab") {
    await handlers.handleRuntimeReloadTab(request);
    return;
  }
  if (command === "runtime.xhs_debug_page_state") {
    await handlers.handleRuntimeXhsDebugPageState(request);
    return;
  }
  if (command === "runtime.xhs_capture_user_home_context") {
    await handlers.handleRuntimeXhsCaptureUserHomeContext(request);
    return;
  }
  if (command === "runtime.xhs_debug_main_world_roundtrip") {
    await handlers.handleRuntimeXhsDebugMainWorldRoundtrip(request);
    return;
  }
  if (command === "runtime.xhs_open_result_card") {
    await handlers.handleRuntimeXhsOpenResultCard(request);
    return;
  }
  if (command === "runtime.xhs_debug_result_targets") {
    await handlers.handleRuntimeXhsDebugResultTargets(request);
    return;
  }
  if (command === "runtime.main_world_probe") {
    await handlers.handleRuntimeMainWorldProbe(request);
    return;
  }
  if (command === "runtime.trusted_fingerprint_probe") {
    await handlers.handleRuntimeTrustedFingerprintProbe(request);
    return;
  }
  if (command === "runtime.readiness") {
    await handlers.handleRuntimeReadiness(request);
    return;
  }

  try {
    await handlers.dispatchForward(request);
  } catch (error) {
    emitBackgroundForwardException(request, command, error, handlers);
  }
};

const emitBackgroundForwardException = (
  request: BridgeRequest,
  command: string,
  error: unknown,
  handlers: BackgroundCommandDispatchHandlers
): void => {
  const failureMessage = error instanceof Error ? error.message : String(error);
  const failureName =
    error instanceof Error && typeof error.name === "string" && error.name.length > 0
      ? error.name
      : "Error";
  const xhsCommand = handlers.isXhsGateCommand(command);
  handlers.emit({
    id: request.id,
    status: "error",
    summary: {
      relay_path: "host>background>content-script>background>host"
    },
    payload: xhsCommand
      ? {
          details: {
            stage: "execution",
            reason: "BACKGROUND_FORWARD_EXCEPTION",
            forward_failure_stage: "background_dispatch_exception",
            error_name: failureName
          },
          diagnosis: {
            category: "runtime_unavailable",
            stage: "runtime",
            component: "background",
            failure_site: {
              stage: "runtime",
              component: "background",
              target: command,
              summary: failureMessage
            },
            evidence: [`background_forward_exception=${failureName}`]
          }
        }
      : undefined,
    error: {
      code: xhsCommand ? "ERR_EXECUTION_FAILED" : "ERR_TRANSPORT_FORWARD_FAILED",
      message: failureMessage
    }
  });
};
