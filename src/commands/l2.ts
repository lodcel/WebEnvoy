import { CliError } from "../core/errors.js";
import {
  buildAbilityValidationSeedForL2Result,
  buildL2RiskGateBlockedResultForContract,
  materializeCandidateAbilityFromL2SeedForContract,
  parseL2FirstUsableRequestForContract,
  parseL2FirstUsableResultForContract
} from "../core/l2-first-usable.js";
import type { CommandDefinition, JsonObject, RuntimeContext } from "../core/types.js";
import {
  NativeMessagingBridge,
  NativeMessagingTransportError
} from "../runtime/native-messaging/bridge.js";
import { NativeHostBridgeTransport } from "../runtime/native-messaging/host.js";
import { createLoopbackNativeBridgeTransport } from "../runtime/native-messaging/loopback.js";

const resolveRuntimeBridge = (): NativeMessagingBridge => {
  if (process.env.WEBENVOY_NATIVE_TRANSPORT === "loopback") {
    return new NativeMessagingBridge({
      transport: createLoopbackNativeBridgeTransport()
    });
  }

  return new NativeMessagingBridge({
    transport: new NativeHostBridgeTransport()
  });
};

const l2FirstUsable = async (context: RuntimeContext): Promise<JsonObject> => {
  const request = parseL2FirstUsableRequestForContract(context.params, {
    profile: context.profile,
    runId: context.run_id
  });

  if (request.risk_gate_context.risk_state === "paused") {
    return {
      l2_first_usable_result: buildL2RiskGateBlockedResultForContract()
    };
  }

  let bridge: NativeMessagingBridge | null = null;
  try {
    bridge = resolveRuntimeBridge();
    const bridgeResult = await bridge.runCommand({
      runId: context.run_id,
      profile: context.profile,
      cwd: context.cwd,
      command: "l2.first_usable",
      params: {
        ...context.params,
        l2_first_usable_request: request,
        target_tab_id: request.risk_gate_context.target_tab_id,
        target_domain: request.risk_gate_context.target_domain,
        target_page: request.risk_gate_context.target_page
      }
    });

    if (!bridgeResult.ok) {
      throw new CliError("ERR_RUNTIME_UNAVAILABLE", bridgeResult.error.message, {
        retryable: bridgeResult.error.code === "ERR_TRANSPORT_TIMEOUT",
        details: {
          ability_id: "l2.first_usable",
          stage: "execution",
          reason: bridgeResult.error.code
        }
      });
    }

    const parsedResult = parseL2FirstUsableResultForContract(
      bridgeResult.payload.l2_first_usable_result ?? bridgeResult.payload,
      request
    );
    if (!parsedResult.success) {
      return {
        l2_first_usable_result: parsedResult,
        relay_path: bridgeResult.relay_path
      };
    }

    const materialized = materializeCandidateAbilityFromL2SeedForContract(
      parsedResult.candidate_shell_seed
    );
    return {
      l2_first_usable_result: parsedResult,
      ...materialized,
      ability_validation_seed: buildAbilityValidationSeedForL2Result(request, parsedResult),
      relay_path: bridgeResult.relay_path
    };
  } catch (error) {
    if (error instanceof NativeMessagingTransportError) {
      throw new CliError("ERR_RUNTIME_UNAVAILABLE", `通信链路不可用: ${error.code}`, {
        retryable: error.retryable,
        cause: error,
        details: {
          ability_id: "l2.first_usable",
          stage: "execution",
          reason: error.code
        }
      });
    }
    throw error;
  } finally {
    await bridge?.close().catch(() => undefined);
  }
};

export const l2Commands = (): CommandDefinition[] => [
  {
    name: "l2.first_usable",
    status: "implemented",
    requiresProfile: true,
    handler: l2FirstUsable
  }
];
