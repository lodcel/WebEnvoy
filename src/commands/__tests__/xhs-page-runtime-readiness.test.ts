import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../../core/types.js";
import { executeCommand } from "../../core/router.js";
import { createCommandRegistry } from "../index.js";
import {
  buildXhsDriverRuntimeBindingForContract,
  buildXhsPageRuntimeReadinessForContract,
  declareXhsDriverProviderRequirementsForContract
} from "../xhs.js";

const collectObjectKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => [key, ...collectObjectKeys(child)]);
  }
  return [];
};

describe("XHS page/runtime readiness contract", () => {
  it("keeps page readiness, runtime readiness and provider admission as separate fail-closed checks", () => {
    const providerRequirements = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.detail",
      ability: {
        id: "xhs.note.detail.v1",
        layer: "L3",
        action: "read"
      },
      requestedExecutionMode: "live_read_limited"
    });
    const runtimeBindingBoundary = buildXhsDriverRuntimeBindingForContract({
      command: "xhs.detail",
      ability: {
        id: "xhs.note.detail.v1",
        layer: "L3",
        action: "read"
      },
      runId: "run-1162-page-runtime-ready-001",
      operationId: "request-1162-page-runtime-ready-001",
      targetDomain: "www.xiaohongshu.com",
      targetTabId: 32,
      targetPage: "explore_detail_tab",
      requestedExecutionMode: "live_read_limited",
      providerRequirements
    });

    const readiness = buildXhsPageRuntimeReadinessForContract({
      command: "xhs.detail",
      runId: "run-1162-page-runtime-ready-001",
      requestedExecutionMode: "live_read_limited",
      runtimeBindingBoundary,
      providerRequirements,
      runtimeStatus: {
        runtimeReadiness: "ready",
        executionSurface: "real_browser",
        headless: false
      },
      providerAdmissionResult: {
        decision: "allow",
        provider_requirement_refs: providerRequirements?.provider_requirement_refs
      }
    });

    expect(readiness).toMatchObject({
      owner_ref: "#1162",
      runtime_binding_ref: "FR-0061.xhs_runtime_binding.v1/run-1162-page-runtime-ready-001/detail",
      target_binding_snapshot_ref:
        "FR-0063.target_binding_snapshot.v1/run-1162-page-runtime-ready-001/detail",
      page_readiness: {
        status: "blocked",
        source: "target_binding_snapshot",
        target_binding_state: "candidate_found",
        blocking_reasons: expect.arrayContaining(["target_binding_not_bound"])
      },
      runtime_readiness: {
        status: "ready",
        source: "official_chrome_runtime_readiness"
      },
      provider_admission_readiness: {
        status: "ready",
        source: "provider_admission_result",
        blocking_reasons: []
      },
      overall_readiness: "blocked",
      gate_decision: "deny"
    });
    expect(readiness?.provider_admission_readiness).not.toMatchObject({
      blocking_reasons: expect.arrayContaining(["provider_requirement_refs_not_attested"])
    });
    expect(readiness?.blocking_reasons).toEqual(
      expect.arrayContaining([
        "page:target_binding_not_bound",
        "page:dom_observation_missing",
        "page:runtime_state_missing",
        "page:extension_bridge_missing"
      ])
    );
    expect(JSON.stringify(readiness)).not.toContain("live_write_commit");
    expect(collectObjectKeys(readiness)).not.toEqual(
      expect.arrayContaining([
        "normalized",
        "syvert_resource_type",
        "syvert_error_code",
        "publish_result",
        "jsonrpc_method"
      ])
    );
  });

  it.each(["pending", "recoverable", "unknown"] as const)(
    "keeps overall readiness blocked when one dimension is blocked and runtime is %s",
    (runtimeReadiness) => {
      const providerRequirements = declareXhsDriverProviderRequirementsForContract({
        command: "xhs.detail",
        ability: {
          id: "xhs.note.detail.v1",
          layer: "L3",
          action: "read"
        },
        requestedExecutionMode: "live_read_limited"
      });
      const runtimeBindingBoundary = buildXhsDriverRuntimeBindingForContract({
        command: "xhs.detail",
        ability: {
          id: "xhs.note.detail.v1",
          layer: "L3",
          action: "read"
        },
        runId: `run-1162-blocked-precedence-${runtimeReadiness}`,
        operationId: `request-1162-blocked-precedence-${runtimeReadiness}`,
        targetDomain: "www.xiaohongshu.com",
        targetTabId: 32,
        targetPage: "explore_detail_tab",
        requestedExecutionMode: "live_read_limited",
        providerRequirements
      });

      const readiness = buildXhsPageRuntimeReadinessForContract({
        command: "xhs.detail",
        runId: `run-1162-blocked-precedence-${runtimeReadiness}`,
        requestedExecutionMode: "live_read_limited",
        runtimeBindingBoundary,
        providerRequirements,
        runtimeStatus: {
          runtimeReadiness,
          executionSurface: "real_browser",
          headless: false
        },
        providerAdmissionResult: {
          admission_decision: "allowed",
          provider_requirement_refs: providerRequirements?.provider_requirement_refs
        }
      });

      expect(readiness).toMatchObject({
        page_readiness: {
          status: "blocked"
        },
        runtime_readiness: {
          status: runtimeReadiness
        },
        provider_admission_readiness: {
          status: "ready"
        },
        overall_readiness: "blocked",
        gate_decision: "deny"
      });
      expect(readiness?.blocking_reasons).toEqual(
        expect.arrayContaining(["page:target_binding_not_bound"])
      );
    }
  );

  it("does not treat provider requirement declarations as provider admission pass evidence", () => {
    const providerRequirements = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.search",
      ability: {
        id: "xhs.note.search.v1",
        layer: "L3",
        action: "read"
      },
      requestedExecutionMode: "live_read_high_risk"
    });
    const runtimeBindingBoundary = buildXhsDriverRuntimeBindingForContract({
      command: "xhs.search",
      ability: {
        id: "xhs.note.search.v1",
        layer: "L3",
        action: "read"
      },
      runId: "run-1162-provider-admission-001",
      operationId: "request-1162-provider-admission-001",
      targetDomain: "www.xiaohongshu.com",
      targetTabId: 32,
      targetPage: "search_result_tab",
      requestedExecutionMode: "live_read_high_risk",
      providerRequirements
    });

    const readiness = buildXhsPageRuntimeReadinessForContract({
      command: "xhs.search",
      runId: "run-1162-provider-admission-001",
      requestedExecutionMode: "live_read_high_risk",
      runtimeBindingBoundary,
      providerRequirements,
      runtimeStatus: {
        runtimeReadiness: "ready",
        executionSurface: "real_browser",
        headless: false
      }
    });

    expect(readiness?.provider_admission_readiness).toMatchObject({
      status: "blocked",
      blocking_reasons: expect.arrayContaining([
        "provider_admission_result_missing",
        "provider_admission_not_allowed",
        "provider_requirement_refs_not_attested"
      ])
    });
    expect(readiness?.non_proofs).toEqual(
      expect.arrayContaining([
        "provider_requirement_declaration_does_not_prove_provider_admission",
        "runtime_binding_declaration_does_not_prove_runtime_ready"
      ])
    );
  });

  it("keeps allowed provider admission blocked when provider requirement refs are not attested", () => {
    const providerRequirements = declareXhsDriverProviderRequirementsForContract({
      command: "xhs.detail",
      ability: {
        id: "xhs.note.detail.v1",
        layer: "L3",
        action: "read"
      },
      requestedExecutionMode: "live_read_limited"
    });
    const runtimeBindingBoundary = buildXhsDriverRuntimeBindingForContract({
      command: "xhs.detail",
      ability: {
        id: "xhs.note.detail.v1",
        layer: "L3",
        action: "read"
      },
      runId: "run-1162-provider-admission-no-refs-001",
      operationId: "request-1162-provider-admission-no-refs-001",
      targetDomain: "www.xiaohongshu.com",
      targetTabId: 32,
      targetPage: "explore_detail_tab",
      requestedExecutionMode: "live_read_limited",
      providerRequirements
    });

    const readiness = buildXhsPageRuntimeReadinessForContract({
      command: "xhs.detail",
      runId: "run-1162-provider-admission-no-refs-001",
      requestedExecutionMode: "live_read_limited",
      runtimeBindingBoundary,
      providerRequirements,
      runtimeStatus: {
        runtimeReadiness: "ready",
        executionSurface: "real_browser",
        headless: false
      },
      providerAdmissionResult: {
        admission_decision: "allowed"
      }
    });

    expect(readiness?.provider_admission_readiness).toMatchObject({
      status: "blocked",
      admission_decision: "allowed",
      blocking_reasons: ["provider_requirement_refs_not_attested"]
    });
    expect(readiness?.blocking_reasons).toContain(
      "provider:provider_requirement_refs_not_attested"
    );
    expect(readiness?.blocking_reasons).not.toContain("provider:provider_admission_not_allowed");
  });

  it("attaches page/runtime readiness fields to read command summaries without ready claims", async () => {
    const previousFixtureSuccess = process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS;
    process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS = "1";

    try {
      const result = await executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.search",
          profile: "profile-1162-readiness-summary-001",
          run_id: "run-1162-readiness-summary-001",
          params: {
            ability: {
              id: "xhs.note.search.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              query: "readiness"
            },
            options: {
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "search_result_tab",
              requested_execution_mode: "dry_run",
              fixture_success: true
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(result.summary).toMatchObject({
        page_runtime_readiness_ref:
          "issue-1162.xhs_page_runtime_readiness.v1/run-1162-readiness-summary-001",
        xhs_page_runtime_readiness: {
          owner_ref: "#1162",
          page_readiness: {
            status: "not_required"
          },
          runtime_readiness: {
            status: "not_required"
          },
          provider_admission_readiness: {
            status: "blocked"
          },
          overall_readiness: "blocked",
          gate_decision: "deny"
        },
        page_runtime_readiness_decision: "deny"
      });
      expect(result.summary.xhs_runtime_binding).toMatchObject({
        binding_status: "declared"
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

  it("ignores caller-controlled provider admission options when building command readiness", async () => {
    const previousFixtureSuccess = process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS;
    process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS = "1";

    try {
      const result = await executeCommand(
        {
          cwd: "/tmp/webenvoy",
          command: "xhs.search",
          profile: "profile-1162-caller-admission-option-001",
          run_id: "run-1162-caller-admission-option-001",
          params: {
            ability: {
              id: "xhs.note.search.v1",
              layer: "L3",
              action: "read"
            },
            input: {
              query: "caller controlled readiness"
            },
            options: {
              target_domain: "www.xiaohongshu.com",
              target_tab_id: 32,
              target_page: "search_result_tab",
              requested_execution_mode: "dry_run",
              fixture_success: true,
              xhs_provider_admission_result: {
                admission_decision: "allowed",
                decision: "allow",
                provider_requirement_refs: ["FR-0061.xhs_provider_requirement.official_chrome_runtime"]
              }
            }
          }
        } as RuntimeContext,
        createCommandRegistry()
      );

      expect(result.summary).toMatchObject({
        xhs_page_runtime_readiness: {
          page_readiness: {
            status: "not_required"
          },
          runtime_readiness: {
            status: "not_required"
          },
          provider_admission_readiness: {
            status: "blocked",
            blocking_reasons: expect.arrayContaining([
              "provider_admission_result_missing",
              "provider_admission_not_allowed",
              "provider_requirement_refs_not_attested"
            ])
          },
          overall_readiness: "blocked",
          gate_decision: "deny"
        },
        page_runtime_readiness_decision: "deny"
      });
      expect(result.summary.page_runtime_readiness_blocking_reasons).toEqual(
        expect.arrayContaining([
          "provider:provider_admission_result_missing",
          "provider:provider_admission_not_allowed",
          "provider:provider_requirement_refs_not_attested"
        ])
      );
    } finally {
      if (previousFixtureSuccess === undefined) {
        delete process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS;
      } else {
        process.env.WEBENVOY_ALLOW_FIXTURE_SUCCESS = previousFixtureSuccess;
      }
    }
  });
});
