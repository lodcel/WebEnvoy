import { describe, expect, it } from "vitest";

import { mapCapabilitySummaryForContract } from "../capability-output.js";

describe("mapCapabilitySummaryForContract", () => {
  const abilityId = "xhs.note.search.v1";
  const expectOutputMappingFailure = (
    callback: () => unknown,
    reason: string,
    expectedAbilityId = abilityId
  ) => {
    try {
      callback();
      throw new Error("expected callback to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ERR_EXECUTION_FAILED",
        details: {
          ability_id: expectedAbilityId,
          stage: "output_mapping",
          reason
        }
      });
    }
  };

  it("keeps valid capability_result and preserves extra summary fields", () => {
    expect(
      mapCapabilitySummaryForContract(abilityId, {
        capability_result: {
          ability_id: abilityId,
          layer: "L3",
          action: "read",
          outcome: "success",
          data_ref: {
            search_id: "search-001"
          }
        },
        consumer_gate_result: {
          gate_decision: "allowed"
        }
      })
    ).toEqual({
      capability_result: {
        ability_id: abilityId,
        layer: "L3",
        action: "read",
        outcome: "success",
        data_ref: {
          search_id: "search-001"
        }
      },
      consumer_gate_result: {
        gate_decision: "allowed"
      }
    });
  });

  it("rejects summaries that omit capability_result", () => {
    expectOutputMappingFailure(() => mapCapabilitySummaryForContract(abilityId, {}), "CAPABILITY_RESULT_MISSING");
  });

  it("rejects non-object capability_result payloads", () => {
    expectOutputMappingFailure(
      () =>
        mapCapabilitySummaryForContract(abilityId, {
          capability_result: "invalid"
        }),
      "CAPABILITY_RESULT_INVALID"
    );
  });

  it("rejects capability_result objects missing required fields", () => {
    expectOutputMappingFailure(
      () =>
        mapCapabilitySummaryForContract(abilityId, {
          capability_result: {
            ability_id: abilityId,
            action: "read",
            outcome: "success"
          }
        }),
      "CAPABILITY_RESULT_LAYER_INVALID"
    );
  });

  it("rejects capability_result objects with invalid outcome", () => {
    expectOutputMappingFailure(
      () =>
        mapCapabilitySummaryForContract(abilityId, {
          capability_result: {
            ability_id: abilityId,
            layer: "L3",
            action: "read",
            outcome: "blocked"
          }
        }),
      "CAPABILITY_RESULT_OUTCOME_INVALID"
    );
  });

  it("rejects forbidden Syvert business fields in XHS read output", () => {
    expectOutputMappingFailure(
      () =>
        mapCapabilitySummaryForContract(abilityId, {
          capability_result: {
            ability_id: abilityId,
            layer: "L3",
            action: "read",
            outcome: "success",
            data_ref: {
              search_id: "search-001"
            }
          },
          evidence: {
            syvert_resource_type: "note"
          }
        }),
      "XHS_READ_OUTPUT_FORBIDDEN_FIELD"
    );
  });

  it("rejects normalized sections in XHS read output", () => {
    expectOutputMappingFailure(
      () =>
        mapCapabilitySummaryForContract("xhs.note.detail.v1", {
          capability_result: {
            ability_id: "xhs.note.detail.v1",
            layer: "L3",
            action: "read",
            outcome: "success",
            data_ref: {
              note_id: "note-001"
            }
          },
          normalized: {
            note: {
              id: "note-001"
            }
          }
        }),
      "XHS_READ_OUTPUT_FORBIDDEN_FIELD",
      "xhs.note.detail.v1"
    );
  });

  it("rejects non-FR-0061 sections in explicit XHS driver envelopes", () => {
    expectOutputMappingFailure(
      () =>
        mapCapabilitySummaryForContract("xhs.user.home.v1", {
          capability_result: {
            ability_id: "xhs.user.home.v1",
            layer: "L3",
            action: "read",
            outcome: "success",
            data_ref: {
              user_id: "user-001"
            }
          },
          xhs_driver_output: {
            raw: {},
            operational: {},
            evidence: {},
            diagnostics: {}
          }
        }),
      "XHS_READ_OUTPUT_SECTION_INVALID",
      "xhs.user.home.v1"
    );
  });

  it("does not apply the XHS read boundary to non-read output", () => {
    expect(
      mapCapabilitySummaryForContract("xhs.creator.publish.v1", {
        capability_result: {
          ability_id: "xhs.creator.publish.v1",
          layer: "L3",
          action: "write",
          outcome: "success",
          data_ref: {
            note_id: "note-001"
          }
        },
        publish_result: {
          status: "pending_review"
        }
      })
    ).toMatchObject({
      capability_result: {
        ability_id: "xhs.creator.publish.v1",
        action: "write"
      },
      publish_result: {
        status: "pending_review"
      }
    });
  });
});
