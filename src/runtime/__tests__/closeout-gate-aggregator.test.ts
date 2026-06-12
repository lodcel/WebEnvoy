import { describe, expect, it } from "vitest";

import {
  buildCloseoutGateAggregator,
  type CloseoutGateAggregator
} from "../closeout-gate-aggregator.js";
import type { CloseoutRuntimeReadinessPreflight } from "../closeout-runtime-readiness.js";

const readyRuntimePreflight = (): CloseoutRuntimeReadinessPreflight => ({
  decision: "GO",
  runtime_state: "ready",
  recovery_mode: "none",
  blocker: null,
  target_binding: {
    requested: true,
    state: "verified",
    requested_target_tab_id: 88,
    requested_target_domain: "www.xiaohongshu.com",
    requested_target_page: "search_result_tab",
    managed_target_tab_id: 88,
    managed_target_domain: "www.xiaohongshu.com",
    managed_target_page: "search_result_tab",
    target_tab_continuity: "runtime_trust_state"
  },
  runtime_status: {
    profile_state: "ready",
    lock_held: true,
    identity_binding_state: "bound",
    extension_service_worker_freshness_state: null,
    extension_service_worker_freshness_reason: null,
    extension_source_path: null,
    expected_extension_source_path: null,
    transport_state: "ready",
    bootstrap_state: "ready",
    runtime_readiness: "ready",
    execution_surface: "real_browser",
    headless: false
  },
  takeover_evidence: null
});

const readyStatus = () => ({
  profile: "xhs_001",
  runId: "run-closeout-gate-001",
  identityPreflight: {
    mode: "official_chrome_persistent_extension"
  },
  account_safety: {
    state: "clear"
  },
  xhs_closeout_rhythm: {
    state: "single_probe_passed"
  }
});

const readyValidationView = () => ({
  all_required_ready: true,
  missing_target_fr_refs: [],
  blocking_target_fr_refs: []
});

const buildGate = (overrides: {
  status?: Record<string, unknown>;
  runtimePreflight?: CloseoutRuntimeReadinessPreflight;
  antiDetectionValidationView?: Record<string, unknown> | null;
  params?: Record<string, unknown>;
} = {}): CloseoutGateAggregator =>
  buildCloseoutGateAggregator({
    status: {
      ...readyStatus(),
      ...(overrides.status ?? {})
    },
    runtimePreflight: overrides.runtimePreflight ?? readyRuntimePreflight(),
    antiDetectionValidationView:
      overrides.antiDetectionValidationView === undefined
        ? readyValidationView()
        : overrides.antiDetectionValidationView,
    params: {
      requested_execution_mode: "live_read_high_risk",
      ...(overrides.params ?? {})
    }
  });

const acceptedRiskEvidenceGateResult = () => ({
  schema_version: "webenvoy-risk-evidence-boundary.v1",
  risk_state: "accepted",
  decision: "allow_input_to_1188",
  blocking_reasons: [],
  risk_evidence_ref: "risk-evidence://closeout/current-head/run-001",
  evidence_refs_consumed: ["provider-boundary://fr-0069", "runtime-binding://run-001"],
  evaluated_at: "2026-06-12T09:50:00.000Z",
  downstream_owner: "#1188"
});

const acceptedBehaviorBaselineHint = () => ({
  schema_version: "webenvoy-behavior-baseline-hint.v1",
  target_fr_ref: "FR-0022",
  validation_scope: "cross_layer_baseline",
  assessment_ref: "behavior-assessment://closeout/current-head/run-001",
  baseline_ref: "platform-behavior-baseline://xhs/www/read/v1",
  baseline_state: "ready",
  drift_level: "low",
  decision_hint: "allow_read_only",
  confidence: 0.82,
  profile_ref: "xhs_001",
  target_domain: "www.xiaohongshu.com",
  browser_channel: "Google Chrome stable",
  execution_surface: "real_browser",
  effective_execution_mode: "live_read_high_risk",
  probe_bundle_ref: "probe-bundle://fr-0022/xhs-read",
  goal_kind: "read",
  reseed_required: false,
  evidence_refs_consumed: ["platform-behavior-signal-batch://run-001"],
  assessed_at: "2026-06-12T09:51:00.000Z"
});

const acceptedWriteBehaviorBaselineHint = () => ({
  ...acceptedBehaviorBaselineHint(),
  baseline_ref: "platform-behavior-baseline://xhs/www/write/v1",
  decision_hint: "no_additional_restriction",
  effective_execution_mode: "live_write",
  goal_kind: "write"
});

describe("closeout gate aggregator", () => {
  it("returns GO when profile, account, rhythm, target, runtime, and validation gates are ready", () => {
    expect(buildGate()).toMatchObject({
      decision: "GO",
      blocker: null,
      gate_state: {
        profile_ref: "xhs_001",
        account_safety_state: "clear",
        xhs_closeout_rhythm_state: "single_probe_passed",
        anti_detection_validation_ready: true,
        runtime_decision: "GO",
        target_binding_state: "verified",
        execution_surface: "real_browser",
        headless: false
      }
    });
  });

  it("requires accepted FR-0070 risk evidence when closeout risk evidence is requested", () => {
    expect(
      buildGate({
        params: {
          closeout_risk_evidence_required: true,
          risk_evidence_gate_result: acceptedRiskEvidenceGateResult()
        }
      })
    ).toMatchObject({
      decision: "GO",
      blocker: null,
      gate_state: {
        risk_evidence_consumer_gate: {
          accepted_risk_input: true,
          read_write_allow_proof: false,
          decision: "allow_input_to_consumer_gate"
        }
      }
    });
  });

  it("passes closeout behavior baseline hint through as bounded risk evidence input", () => {
    expect(
      buildGate({
        params: {
          closeout_risk_evidence_required: true,
          closeout_behavior_baseline_hint_required: true,
          risk_evidence_gate_result: acceptedRiskEvidenceGateResult(),
          behavior_baseline_hint: acceptedBehaviorBaselineHint()
        }
      })
    ).toMatchObject({
      decision: "GO",
      blocker: null,
      gate_state: {
        risk_evidence_consumer_gate: {
          accepted_risk_input: true,
          read_write_allow_proof: false,
          behavior_baseline_hint_accepted: true,
          behavior_baseline_hint: {
            decision_hint: "allow_read_only",
            target_fr_ref: "FR-0022"
          }
        }
      }
    });
  });

  it("blocks closeout when behavior baseline hint is explicitly required but missing", () => {
    expect(
      buildGate({
        params: {
          closeout_risk_evidence_required: true,
          closeout_behavior_baseline_hint_required: true,
          risk_evidence_gate_result: acceptedRiskEvidenceGateResult()
        }
      })
    ).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "risk_evidence",
        blocker_code: "behavior_baseline_required",
        required_recovery_action: "provide_current_scope_fr_0070_risk_evidence_for_1188"
      },
      gate_state: {
        risk_evidence_consumer_gate: {
          accepted_risk_input: false,
          behavior_baseline_hint_accepted: false
        }
      }
    });
  });

  it("blocks closeout when required behavior baseline hint lacks ready write baseline locator evidence", () => {
    expect(
      buildGate({
        params: {
          closeout_risk_evidence_required: true,
          closeout_behavior_baseline_hint_required: true,
          risk_evidence_gate_result: acceptedRiskEvidenceGateResult(),
          behavior_baseline_hint: {
            ...acceptedWriteBehaviorBaselineHint(),
            baseline_ref: null
          }
        }
      })
    ).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "risk_evidence",
        blocker_code: "behavior_baseline_required",
        required_recovery_action: "provide_current_scope_fr_0070_risk_evidence_for_1188"
      },
      gate_state: {
        risk_evidence_consumer_gate: {
          accepted_risk_input: false,
          behavior_baseline_hint_accepted: false,
          behavior_baseline_hint: null
        }
      }
    });
  });

  it("blocks closeout when behavior baseline hint violates the FR-0022 decision matrix", () => {
    expect(
      buildGate({
        params: {
          closeout_risk_evidence_required: true,
          closeout_behavior_baseline_hint_required: true,
          risk_evidence_gate_result: acceptedRiskEvidenceGateResult(),
          behavior_baseline_hint: {
            ...acceptedBehaviorBaselineHint(),
            drift_level: "critical",
            decision_hint: "allow_read_only"
          }
        }
      })
    ).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "risk_evidence",
        blocker_code: "risk_evidence_scope_mismatch",
        required_recovery_action: "provide_current_scope_fr_0070_risk_evidence_for_1188"
      },
      gate_state: {
        risk_evidence_consumer_gate: {
          accepted_risk_input: false,
          behavior_baseline_hint_accepted: false,
          behavior_baseline_hint: null
        }
      }
    });
  });

  it("blocks closeout when risk evidence is missing or only non-proof signals are present", () => {
    expect(
      buildGate({
        params: {
          closeout_risk_evidence_required: true,
          non_proofs_observed: ["historical_artifact", "control_plane_only_signal"]
        }
      })
    ).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "risk_evidence",
        blocker_code: "historical_or_stale_evidence",
        required_recovery_action: "provide_current_scope_fr_0070_risk_evidence_for_1188"
      },
      gate_state: {
        risk_evidence_consumer_gate: {
          accepted_risk_input: false,
          read_write_allow_proof: false
        }
      }
    });
  });

  it("blocks closeout when risk evidence non-proof signals are unknown or malformed", () => {
    expect(
      buildGate({
        params: {
          closeout_risk_evidence_required: true,
          non_proofs_observed: ["runtime_ping_typo", { source: "runtime_ping" }]
        }
      })
    ).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "risk_evidence",
        blocker_code: "risk_evidence_unclassified",
        required_recovery_action: "provide_current_scope_fr_0070_risk_evidence_for_1188"
      },
      gate_state: {
        risk_evidence_consumer_gate: {
          accepted_risk_input: false,
          read_write_allow_proof: false,
          gate_reasons: ["risk_evidence_unclassified"]
        }
      }
    });
  });

  it("blocks when account safety is not clear", () => {
    expect(
      buildGate({
        status: {
          account_safety: {
            state: "account_risk_blocked"
          }
        }
      })
    ).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "account_safety",
        blocker_code: "account_safety_not_clear",
        required_recovery_action: "hard_stop_and_restore_account_safety_clear_state"
      }
    });
  });

  it("blocks when closeout rhythm does not allow a full closeout run", () => {
    expect(
      buildGate({
        status: {
          xhs_closeout_rhythm: {
            state: "single_probe_required"
          }
        }
      })
    ).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "rhythm",
        blocker_code: "xhs_closeout_rhythm_blocked"
      }
    });
  });

  it("blocks when FR-0012/FR-0013/FR-0014 validation baseline is missing", () => {
    expect(
      buildGate({
        antiDetectionValidationView: {
          all_required_ready: false,
          missing_target_fr_refs: ["FR-0013"],
          blocking_target_fr_refs: ["FR-0013"]
        }
      })
    ).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "anti_detection_validation",
        blocker_code: "anti_detection_validation_baseline_blocked",
        required_recovery_action: "complete_fr_0012_fr_0013_fr_0014_validation_baseline"
      },
      gate_state: {
        anti_detection_missing_target_fr_refs: ["FR-0013"]
      }
    });
  });

  it("blocks when the profile is not bound to the managed official Chrome identity", () => {
    expect(
      buildGate({
        status: {
          identityPreflight: {
            mode: "repo_owned_native_host"
          }
        }
      })
    ).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "profile_binding",
        blocker_code: "managed_profile_mismatch"
      }
    });
  });

  it("blocks when requested target continuity has drifted", () => {
    const runtimePreflight = readyRuntimePreflight();
    runtimePreflight.decision = "NO_GO";
    runtimePreflight.runtime_state = "blocked";
    runtimePreflight.blocker = {
      blocker_layer: "runtime_readiness",
      blocker_code: "target_mismatch",
      required_recovery_action: "restore_or_rebind_managed_target_tab"
    };
    runtimePreflight.target_binding = {
      ...runtimePreflight.target_binding,
      state: "mismatch",
      managed_target_tab_id: 99
    };

    expect(buildGate({ runtimePreflight })).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "target_binding",
        blocker_code: "target_mismatch",
        required_recovery_action: "restore_or_rebind_managed_target_tab"
      }
    });
  });

  it("blocks when no target continuity request is bound", () => {
    const runtimePreflight = readyRuntimePreflight();
    runtimePreflight.target_binding = {
      ...runtimePreflight.target_binding,
      requested: false,
      state: "not_requested",
      requested_target_tab_id: null,
      requested_target_domain: null,
      requested_target_page: null
    };

    expect(buildGate({ runtimePreflight })).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "target_binding",
        blocker_code: "target_mismatch"
      }
    });
  });

  it("blocks recoverable runtime until recovery is completed and the gate is rerun", () => {
    const runtimePreflight = readyRuntimePreflight();
    runtimePreflight.decision = "RECOVERABLE";
    runtimePreflight.runtime_state = "recoverable";
    runtimePreflight.recovery_mode = "ready_attach";

    expect(buildGate({ runtimePreflight })).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "runtime_readiness",
        blocker_code: "runtime_recovery_required",
        required_recovery_action: "recover_runtime_then_rerun_closeout_gate"
      }
    });
  });

  it("preserves specific runtime preflight blocker codes", () => {
    const runtimePreflight = readyRuntimePreflight();
    runtimePreflight.decision = "NO_GO";
    runtimePreflight.runtime_state = "blocked";
    runtimePreflight.blocker = {
      blocker_layer: "runtime_readiness",
      blocker_code: "bootstrap_stale_unrecoverable",
      required_recovery_action: "restart_runtime_with_fresh_bootstrap"
    };

    expect(buildGate({ runtimePreflight })).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "runtime_readiness",
        blocker_code: "bootstrap_stale_unrecoverable",
        required_recovery_action: "restart_runtime_with_fresh_bootstrap"
      }
    });
  });

  it("blocks when runtime preflight reports stale extension service worker cache", () => {
    const runtimePreflight = readyRuntimePreflight();
    runtimePreflight.decision = "NO_GO";
    runtimePreflight.runtime_state = "blocked";
    runtimePreflight.blocker = {
      blocker_layer: "runtime_readiness",
      blocker_code: "extension_service_worker_stale",
      required_recovery_action: "run_runtime_refresh_extension_service_worker_then_restart_runtime"
    };
    runtimePreflight.runtime_status.extension_service_worker_freshness_state = "stale";
    runtimePreflight.runtime_status.extension_service_worker_freshness_reason =
      "SERVICE_WORKER_CACHE_OLDER_THAN_EXTENSION_BUILD";

    expect(buildGate({ runtimePreflight })).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "runtime_readiness",
        blocker_code: "extension_service_worker_stale",
        required_recovery_action: "run_runtime_refresh_extension_service_worker_then_restart_runtime"
      }
    });
  });

  it("blocks when runtime preflight reports current-worktree extension source mismatch", () => {
    const runtimePreflight = readyRuntimePreflight();
    runtimePreflight.decision = "NO_GO";
    runtimePreflight.runtime_state = "blocked";
    runtimePreflight.blocker = {
      blocker_layer: "runtime_readiness",
      blocker_code: "extension_source_mismatch",
      required_recovery_action: "reinstall_runtime_extension_from_current_worktree_then_restart_runtime"
    };
    runtimePreflight.runtime_status.extension_source_path = "/repo/old/extension";
    runtimePreflight.runtime_status.expected_extension_source_path = "/repo/current/extension";

    expect(buildGate({ runtimePreflight })).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "runtime_readiness",
        blocker_code: "extension_source_mismatch",
        required_recovery_action: "reinstall_runtime_extension_from_current_worktree_then_restart_runtime"
      }
    });
  });

  it("blocks non-real-browser or headless execution surfaces", () => {
    const runtimePreflight = readyRuntimePreflight();
    runtimePreflight.decision = "NO_GO";
    runtimePreflight.runtime_state = "blocked";
    runtimePreflight.runtime_status.execution_surface = "headless_browser";
    runtimePreflight.runtime_status.headless = true;

    expect(buildGate({ runtimePreflight })).toMatchObject({
      decision: "NO_GO",
      blocker: {
        blocker_layer: "runtime_readiness",
        blocker_code: "execution_surface_blocked",
        required_recovery_action: "restart_official_chrome_real_browser_headful"
      }
    });
  });
});
