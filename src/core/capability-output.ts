import { CliError } from "./errors.js";
import type { JsonObject } from "./types.js";

type CapabilityLayer = "L3" | "L2" | "L1";
type CapabilityAction = "read" | "write" | "download";
type CapabilityOutcome = "success" | "partial";

const CAPABILITY_LAYERS = new Set<CapabilityLayer>(["L3", "L2", "L1"]);
const CAPABILITY_ACTIONS = new Set<CapabilityAction>(["read", "write", "download"]);
const CAPABILITY_OUTCOMES = new Set<CapabilityOutcome>(["success", "partial"]);
const XHS_READ_ABILITY_IDS = new Set([
  "xhs.search.notes.v1",
  "xhs.note.search.v1",
  "xhs.note.detail.v1",
  "xhs.user.home.v1"
]);
const XHS_READ_OUTPUT_ALLOWED_ENVELOPE_SECTIONS = new Set(["raw", "operational", "evidence"]);
const XHS_READ_OUTPUT_ENVELOPE_FIELDS = new Set(["output_envelope", "xhs_driver_output"]);
const XHS_READ_OUTPUT_FORBIDDEN_FIELDS = new Set([
  "normalized",
  "syvert_resource_type",
  "syvert_error_code",
  "live_write_commit",
  "publish_result",
  "jsonrpc_method"
]);

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const invalidCapabilityOutput = (abilityId: string, reason: string): CliError =>
  new CliError("ERR_EXECUTION_FAILED", "能力输出映射失败", {
    details: {
      ability_id: abilityId,
      stage: "output_mapping",
      reason
    }
  });

const invalidXhsReadOutputBoundary = (
  abilityId: string,
  reason: string,
  details: JsonObject
): CliError =>
  new CliError("ERR_EXECUTION_FAILED", "XHS read output boundary violation", {
    details: {
      ability_id: abilityId,
      stage: "output_mapping",
      reason,
      driver_contract_ref: "FR-0061.xhs_driver_contract.v1",
      ...details
    }
  });

export const mapCapabilitySummaryForContract = (
  abilityId: string,
  summary: unknown
): JsonObject => {
  const summaryObject = asObject(summary);
  if (!summaryObject) {
    throw invalidCapabilityOutput(abilityId, "SUMMARY_INVALID");
  }

  const mappedCapabilityResult = mapCapabilityResultForContract(
    abilityId,
    summaryObject.capability_result
  );
  const mappedSummary = {
    ...summaryObject,
    capability_result: mappedCapabilityResult
  };
  assertXhsReadOutputBoundaryForContract(abilityId, mappedSummary, mappedCapabilityResult);

  return mappedSummary;
};

const mapCapabilityResultForContract = (
  abilityId: string,
  capabilityResult: unknown
): JsonObject => {
  if (capabilityResult === undefined) {
    throw invalidCapabilityOutput(abilityId, "CAPABILITY_RESULT_MISSING");
  }

  const capabilityObject = asObject(capabilityResult);
  if (!capabilityObject) {
    throw invalidCapabilityOutput(abilityId, "CAPABILITY_RESULT_INVALID");
  }

  const mappedAbilityId =
    typeof capabilityObject.ability_id === "string" && capabilityObject.ability_id.trim().length > 0
      ? capabilityObject.ability_id.trim()
      : null;
  if (!mappedAbilityId) {
    throw invalidCapabilityOutput(abilityId, "CAPABILITY_RESULT_ABILITY_ID_INVALID");
  }
  if (mappedAbilityId !== abilityId) {
    throw invalidCapabilityOutput(abilityId, "CAPABILITY_RESULT_ABILITY_ID_MISMATCH");
  }

  const layer = capabilityObject.layer;
  if (typeof layer !== "string" || !CAPABILITY_LAYERS.has(layer as CapabilityLayer)) {
    throw invalidCapabilityOutput(abilityId, "CAPABILITY_RESULT_LAYER_INVALID");
  }

  const action = capabilityObject.action;
  if (typeof action !== "string" || !CAPABILITY_ACTIONS.has(action as CapabilityAction)) {
    throw invalidCapabilityOutput(abilityId, "CAPABILITY_RESULT_ACTION_INVALID");
  }

  const outcome = capabilityObject.outcome;
  if (typeof outcome !== "string" || !CAPABILITY_OUTCOMES.has(outcome as CapabilityOutcome)) {
    throw invalidCapabilityOutput(abilityId, "CAPABILITY_RESULT_OUTCOME_INVALID");
  }

  const mapped = {
    ...capabilityObject,
    ability_id: mappedAbilityId,
    layer,
    action,
    outcome
  };

  return mapped;
};

const assertXhsReadOutputBoundaryForContract = (
  abilityId: string,
  summary: JsonObject,
  capabilityResult: JsonObject
): void => {
  if (
    !XHS_READ_ABILITY_IDS.has(abilityId)
  ) {
    return;
  }

  const violation = findXhsReadOutputBoundaryViolation(summary);
  if (violation) {
    throw invalidXhsReadOutputBoundary(abilityId, violation.reason, {
      field: violation.field,
      path: violation.path
    });
  }

  if (capabilityResult.action !== "read") {
    throw invalidXhsReadOutputBoundary(abilityId, "XHS_READ_ABILITY_ACTION_MISMATCH", {
      field: "capability_result.action",
      path: "capability_result.action"
    });
  }
};

const findXhsReadOutputBoundaryViolation = (
  value: unknown,
  path: string[] = []
): { reason: string; field: string; path: string } | null => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const violation = findXhsReadOutputBoundaryViolation(value[index], [...path, String(index)]);
      if (violation) {
        return violation;
      }
    }
    return null;
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return null;
  }

  for (const [key, child] of Object.entries(objectValue)) {
    const nextPath = [...path, key];
    if (XHS_READ_OUTPUT_FORBIDDEN_FIELDS.has(key)) {
      return {
        reason: "XHS_READ_OUTPUT_FORBIDDEN_FIELD",
        field: key,
        path: nextPath.join(".")
      };
    }

    if (XHS_READ_OUTPUT_ENVELOPE_FIELDS.has(key)) {
      const envelope = asObject(child);
      if (!envelope) {
        return {
          reason: "XHS_READ_OUTPUT_ENVELOPE_INVALID",
          field: key,
          path: nextPath.join(".")
        };
      }
      for (const section of Object.keys(envelope)) {
        if (!XHS_READ_OUTPUT_ALLOWED_ENVELOPE_SECTIONS.has(section)) {
          return {
            reason: "XHS_READ_OUTPUT_SECTION_INVALID",
            field: section,
            path: [...nextPath, section].join(".")
          };
        }
      }
    }

    const violation = findXhsReadOutputBoundaryViolation(child, nextPath);
    if (violation) {
      return violation;
    }
  }

  return null;
};
