import { describe, expect, it } from "vitest";

import { parseAbilityValidationRequestForContract } from "../ability-validation.js";
import {
  buildAbilityValidationSeedForDownloadRequest,
  buildDownloadPrepareResultSummaryForContract,
  buildDownloadTriggeredResultSummaryForContract,
  materializeCandidateAbilityFromDownloadSeedForContract,
  parseDownloadBrowserExecutionResultForContract,
  parseDownloadCapabilityEnvelopeForContract,
  parseDownloadFailureReasonForContract,
  parseDownloadResultSummaryForContract,
  parseDownloadTriggerModeForContract
} from "../download-ability.js";
import type { CandidateExecutionLayer } from "../candidate-ability.js";
import type { JsonObject } from "../types.js";

const contractRef = (
  abilityId: string,
  kind: "input" | "output" | "error"
): string => `cad::${abilityId}::${kind}::v1`;

const createRequest = (downloadSource: JsonObject = {
  source_kind: "direct_url",
  target_url: "https://example.com/report.pdf"
}): JsonObject => ({
  ability_ref: "generic.file.download.v1",
  download_source: downloadSource,
  profile_ref: "profile/default",
  download_goal: "single_file",
  output_policy: {
    destination_root: "exports/reports",
    file_name_policy: "preserve_source_name",
    conflict_policy: "rename_with_suffix"
  },
  requested_execution_layer: "L2"
});

const createEnvelope = (overrides: JsonObject = {}): JsonObject => ({
  ability: {
    id: "generic.file.download.v1",
    layer: "L2",
    action: "download"
  },
  input: createRequest(),
  ...overrides
});

const createRegistryEntries = (abilityId: string): JsonObject[] => [
  {
    contract_ref: contractRef(abilityId, "input"),
    contract_kind: "input",
    contract_body: {
      type: "object",
      required: ["download_source", "output_policy"]
    }
  },
  {
    contract_ref: contractRef(abilityId, "output"),
    contract_kind: "output",
    contract_body: {
      type: "object",
      required: ["download_result_summary"]
    }
  },
  {
    contract_ref: contractRef(abilityId, "error"),
    contract_kind: "error",
    contract_body: {
      type: "object",
      required: ["reason"]
    }
  }
];

const createCandidateSeed = (input?: {
  abilityId?: string;
  layers?: CandidateExecutionLayer[];
  entries?: JsonObject[];
  overrides?: JsonObject;
}): JsonObject => {
  const abilityId = input?.abilityId ?? "generic.file.download.v1";
  return {
    ability_id: abilityId,
    display_name: "Generic file download",
    ability_kind: "download",
    entrypoint: "download.prepare",
    platform_scope: {
      platform_family: "generic_web",
      site_pattern: "https://example.com/*"
    },
    execution_layer_support: input?.layers ?? ["L2", "L3"],
    input_contract_ref: contractRef(abilityId, "input"),
    output_contract_ref: contractRef(abilityId, "output"),
    error_contract_ref: contractRef(abilityId, "error"),
    capture_origin: "l2_first_usable_sample",
    capture_run_id: "run-download-capture-001",
    capture_profile: "profile/default",
    capture_artifact_refs: ["artifact://download/candidate"],
    captured_at: "2026-05-23T00:00:00.000Z",
    candidate_status: "draft_candidate",
    contract_registry_seed: {
      ability_id: abilityId,
      entries: input?.entries ?? createRegistryEntries(abilityId)
    },
    ...(input?.overrides ?? {})
  };
};

const expectInputError = (
  callback: () => unknown,
  abilityId: string,
  reason: string
): void => {
  try {
    callback();
    throw new Error("expected callback to throw");
  } catch (error) {
    expect(error).toMatchObject({
      code: "ERR_CLI_INVALID_ARGS",
      details: {
        ability_id: abilityId,
        stage: "input_validation",
        reason
      }
    });
  }
};

describe("download ability contract", () => {
  it("accepts direct_url, page_blob, and page_derived request sources", () => {
    expect(parseDownloadCapabilityEnvelopeForContract(createEnvelope()).input).toMatchObject({
      download_source: {
        source_kind: "direct_url",
        target_url: "https://example.com/report.pdf"
      }
    });
    expect(
      parseDownloadCapabilityEnvelopeForContract(
        createEnvelope({
          input: createRequest({
            source_kind: "page_blob",
            blob_locator: "window.__downloadBlob",
            blob_url: "blob:https://example.com/123",
            page_context_hint: "export modal"
          })
        })
      ).input.download_source
    ).toMatchObject({
      source_kind: "page_blob",
      blob_locator: "window.__downloadBlob"
    });
    expect(
      parseDownloadCapabilityEnvelopeForContract(
        createEnvelope({
          input: createRequest({
            source_kind: "page_derived",
            derive_mode: "export_flow",
            trigger_hint: "click export"
          })
        })
      ).input.download_source
    ).toMatchObject({
      source_kind: "page_derived",
      derive_mode: "export_flow"
    });
  });

  it("rejects layer mirror conflicts and destination roots outside trusted base", () => {
    expectInputError(
      () =>
        parseDownloadCapabilityEnvelopeForContract(
          createEnvelope({
            ability: {
              id: "generic.file.download.v1",
              layer: "L3",
              action: "download"
            }
          })
        ),
      "generic.file.download.v1",
      "REQUESTED_EXECUTION_LAYER_MISMATCH"
    );

    for (const destinationRoot of [
      "/tmp",
      "../escape",
      "~",
      "C:\\tmp",
      "C:tmp",
      "C:../escape",
      "\\\\server\\share"
    ]) {
      expectInputError(
        () =>
          parseDownloadCapabilityEnvelopeForContract(
            createEnvelope({
              input: {
                ...createRequest(),
                output_policy: {
                  destination_root: destinationRoot,
                  file_name_policy: "preserve_source_name",
                  conflict_policy: "rename_with_suffix"
                }
              }
            })
          ),
        "generic.file.download.v1",
        "DESTINATION_ROOT_INVALID"
      );
    }
  });

  it("validates downloaded and partial summary shapes", () => {
    expect(
      parseDownloadResultSummaryForContract({
        download_ref: "download/run-001",
        result_state: "downloaded",
        resolved_output_path: "trusted-base/exports/report.pdf",
        source_url: "https://example.com/report.pdf",
        file_name_hint: "report.pdf",
        saved_artifact_refs: ["artifact://download/run-001"],
        content_descriptor: {
          content_kind: "file",
          mime_type: "application/pdf",
          size_bytes: 2048
        }
      })
    ).toMatchObject({
      result_state: "downloaded",
      source_url: "https://example.com/report.pdf"
    });
    expect(
      buildDownloadPrepareResultSummaryForContract({
        runId: "run-download-prepare-001",
        request: parseDownloadCapabilityEnvelopeForContract(createEnvelope()).input
      })
    ).toMatchObject({
      result_state: "partial",
      saved_artifact_refs: ["download-prepare://run-download-prepare-001/candidate-handoff"]
    });
    expectInputError(
      () =>
        parseDownloadResultSummaryForContract({
          download_ref: "download/run-002",
          result_state: "partial",
          content_descriptor: {
            content_kind: "file",
            mime_type: "application/octet-stream"
          }
        }),
      "download.prepare",
      "PARTIAL_RESULT_ARTIFACT_MISSING"
    );
  });

  it("keeps failure reasons in the unified error details enum", () => {
    expect(parseDownloadFailureReasonForContract("SOURCE_UNAVAILABLE")).toBe(
      "SOURCE_UNAVAILABLE"
    );
    expect(parseDownloadFailureReasonForContract("AUTH_OR_SESSION_REQUIRED")).toBe(
      "AUTH_OR_SESSION_REQUIRED"
    );
    expectInputError(
      () => parseDownloadFailureReasonForContract("FAILED"),
      "download.prepare",
      "DOWNLOAD_FAILURE_REASON_INVALID"
    );
  });

  it("validates browser-side target trigger results without promoting them to downloaded", () => {
    expect(parseDownloadTriggerModeForContract(undefined)).toBe("resolve_only");
    const browserResult = parseDownloadBrowserExecutionResultForContract({
      success: true,
      download_target: {
        target_ref: "download-link",
        source_kind: "direct_url",
        source_url: "https://example.com/report.pdf",
        file_name_hint: "report.pdf",
        content_descriptor: {
          content_kind: "file",
          mime_type: "application/pdf"
        },
        trigger_status: "triggered",
        trigger_mode: "dispatch_click",
        trigger_surface: "direct_url"
      },
      trigger_audit: {
        run_id: "run-download-trigger"
      }
    });
    expect(browserResult).toMatchObject({
      success: true,
      download_target: {
        source_url: "https://example.com/report.pdf",
        trigger_status: "triggered"
      }
    });
    const summary = buildDownloadTriggeredResultSummaryForContract({
      runId: "run-download-trigger",
      target: browserResult.download_target!
    });
    expect(summary).toMatchObject({
      download_ref: "download.trigger/run-download-trigger",
      result_state: "partial",
      saved_artifact_refs: ["download-trigger://run-download-trigger/download-link"],
      source_url: "https://example.com/report.pdf",
      file_name_hint: "report.pdf"
    });
    expect(summary).not.toHaveProperty("resolved_output_path");
  });

  it("validates browser-side trigger failure classifications", () => {
    expect(
      parseDownloadBrowserExecutionResultForContract({
        success: false,
        failure_reason: "SOURCE_UNAVAILABLE",
        trigger_audit: {
          stage: "target_resolution"
        }
      })
    ).toMatchObject({
      success: false,
      failure_reason: "SOURCE_UNAVAILABLE"
    });
    expectInputError(
      () =>
        parseDownloadBrowserExecutionResultForContract({
          success: false,
          failure_reason: "FAILED"
        }),
      "download.trigger",
      "DOWNLOAD_FAILURE_REASON_INVALID"
    );
  });

  it("materializes download candidate seeds and feeds the FR-0018 trust domain boundary", () => {
    const request = parseDownloadCapabilityEnvelopeForContract(createEnvelope()).input;
    const materialized = materializeCandidateAbilityFromDownloadSeedForContract(
      createCandidateSeed()
    );
    const validationSeed = buildAbilityValidationSeedForDownloadRequest({
      request,
      materialized
    });
    const validationRequest = parseAbilityValidationRequestForContract(
      materialized.candidate_ability_descriptor,
      validationSeed.ability_validation_request
    );

    expect(materialized.candidate_ability_descriptor).toMatchObject({
      ability_id: "generic.file.download.v1",
      ability_kind: "download",
      execution_layer_support: ["L2", "L3"]
    });
    expect(validationRequest).toMatchObject({
      ability_ref: "generic.file.download.v1",
      requested_execution_layer: "L2",
      expected_capability_kind: "download"
    });
    expect(validationSeed).toMatchObject({
      validation_execution_boundary: "not_executed_in_fr0021_747"
    });
  });

  it("rejects duplicate, kind-mismatched, and unresolved download registry seeds", () => {
    const abilityId = "generic.file.download.v1";
    const entries = createRegistryEntries(abilityId);
    expectInputError(
      () =>
        materializeCandidateAbilityFromDownloadSeedForContract(
          createCandidateSeed({
            entries: [entries[0], entries[0], entries[1], entries[2]]
          })
        ),
      abilityId,
      "CONTRACT_REF_DUPLICATE"
    );
    expectInputError(
      () =>
        materializeCandidateAbilityFromDownloadSeedForContract(
          createCandidateSeed({
            entries: [
              entries[0],
              {
                ...entries[1],
                contract_ref: contractRef(abilityId, "output"),
                contract_kind: "input"
              },
              entries[2]
            ]
          })
        ),
      abilityId,
      "CONTRACT_KIND_MISMATCH"
    );
    expectInputError(
      () =>
        materializeCandidateAbilityFromDownloadSeedForContract(
          createCandidateSeed({
            entries: [entries[0], entries[2]]
          })
        ),
      abilityId,
      "CONTRACT_REF_UNRESOLVED"
    );
  });
});
