import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../../core/types.js";
import { executeCommand } from "../../core/router.js";
import { createCommandRegistry } from "../index.js";
import { buildXhsDriverRuntimeBindingForContract } from "../xhs.js";

const collectObjectKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => [key, ...collectObjectKeys(child)]);
  }
  return [];
};

describe("XHS runtime binding extraction", () => {
  it("builds a driver-owned runtime and target binding boundary for read commands", () => {
    const boundary = buildXhsDriverRuntimeBindingForContract({
      command: "xhs.detail",
      ability: {
        id: "xhs.note.detail.v1",
        layer: "L3",
        action: "read"
      },
      runId: "run-1159-runtime-binding-001",
      operationId: "request-1159-runtime-binding-001",
      targetDomain: "www.xiaohongshu.com",
      targetTabId: 32,
      targetPage: "explore_detail_tab",
      requestedExecutionMode: "live_read_limited",
      providerRequirements: null
    });

    expect(boundary).toMatchObject({
      runtime_binding_ref: "FR-0061.xhs_runtime_binding.v1/run-1159-runtime-binding-001/detail",
      target_binding_snapshot_ref:
        "FR-0063.target_binding_snapshot.v1/run-1159-runtime-binding-001/detail",
      xhs_runtime_binding: {
        target_domain: "www.xiaohongshu.com",
        target_page: "explore_detail_tab",
        target_tab_ref: "target-tab-ref:run-1159-runtime-binding-001:32",
        execution_mode: "read",
        runtime_provider_ref: "FR-0033.browser_provider_contract.v1",
        binding_freshness: "current_run",
        binding_status: "declared"
      },
      target_binding_snapshot: {
        state: "candidate_found",
        route_bucket: "detail",
        run_id: "run-1159-runtime-binding-001",
        operation_id: "request-1159-runtime-binding-001",
        freshness_scope: "current_run",
        blocking_reasons: [
          "dom_observation_missing",
          "runtime_state_missing",
          "extension_bridge_missing"
        ],
        downstream_handoff: {
          page_runtime_ready_required: true,
          signed_continuity_required: true,
          live_evidence_required: false,
          owner_refs: ["#1162", "#1171"]
        }
      },
      downstream_slice_refs: expect.arrayContaining(["#1162", "#1171", "#1166", "#1167", "#1168"])
    });
    expect(boundary?.target_binding_snapshot.non_proofs).toEqual(
      expect.arrayContaining([
        "page_ready",
        "runtime_ready",
        "signed_continuity",
        "read_success",
        "live_evidence_accepted",
        "provider_capability_allowed",
        "write_enabled"
      ])
    );
    expect(JSON.stringify(boundary)).not.toContain("live_write_commit");
    expect(collectObjectKeys(boundary)).not.toEqual(
      expect.arrayContaining([
        "normalized",
        "syvert_resource_type",
        "syvert_error_code",
        "publish_result",
        "jsonrpc_method"
      ])
    );
  });

  it("keeps non-read commands out of the FR-0061 runtime binding surface", () => {
    const boundary = buildXhsDriverRuntimeBindingForContract({
      command: "xhs.creator_publish.controlled_live_write",
      ability: {
        id: "xhs.creator.publish.v1",
        layer: "L3",
        action: "write"
      },
      runId: "run-1159-runtime-binding-write-001",
      operationId: "request-1159-runtime-binding-write-001",
      targetDomain: "creator.xiaohongshu.com",
      targetTabId: 32,
      targetPage: "creator_publish_tab",
      requestedExecutionMode: "live_write",
      providerRequirements: null
    });

    expect(boundary).toBeNull();
  });

  it("accepts the legacy search_result_tab input name while emitting the FR-0061 search_tab class", () => {
    const boundary = buildXhsDriverRuntimeBindingForContract({
      command: "xhs.search",
      ability: {
        id: "xhs.note.search.v1",
        layer: "L3",
        action: "read"
      },
      runId: "run-1159-runtime-binding-search-001",
      operationId: "request-1159-runtime-binding-search-001",
      targetDomain: "www.xiaohongshu.com",
      targetTabId: 32,
      targetPage: "search_result_tab",
      requestedExecutionMode: "recon",
      providerRequirements: null
    });

    expect(boundary).toMatchObject({
      xhs_runtime_binding: {
        target_page: "search_tab",
        execution_mode: "diagnose"
      },
      target_binding_snapshot: {
        state: "candidate_found",
        target_scope: {
          target_page_class: "search_tab"
        },
        blocking_reasons: [
          "dom_observation_missing",
          "runtime_state_missing",
          "extension_bridge_missing"
        ]
      }
    });
  });

  it("attaches runtime binding refs to read command summaries without live claims", async () => {
    const previousFixtureSuccess = process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS;
    process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS = "1";

    try {
      const result = await executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.detail",
          profile: "profile-1159-runtime-binding-001",
          run_id: "run-1159-runtime-binding-summary-001",
          params: {
            ability: {
              id: "xhs.note.detail.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              note_id: "note-1159-runtime-binding"
            },
            options: {
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "explore_detail_tab",
              requested_execution_mode: "dry_run",
              fixture_success: true
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(result.summary).toMatchObject({
        runtime_binding_ref:
          "FR-0061.xhs_runtime_binding.v1/run-1159-runtime-binding-summary-001/detail",
        target_binding_snapshot_ref:
          "FR-0063.target_binding_snapshot.v1/run-1159-runtime-binding-summary-001/detail",
        xhs_runtime_binding: {
          target_domain: "www.xiaohongshu.com",
          target_page: "explore_detail_tab",
          execution_mode: "diagnose",
          binding_status: "declared"
        },
        target_binding_snapshot: {
          state: "candidate_found",
          route_bucket: "detail"
        }
      });
      expect(result.summary.xhs_runtime_binding).not.toMatchObject({
        binding_status: "ready"
      });
    } finally {
      if (previousFixtureSuccess === undefined) {
        delete process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS;
      } else {
        process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS = previousFixtureSuccess;
      }
    }
  });
});
