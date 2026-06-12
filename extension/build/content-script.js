(() => {
/* WebEnvoy classic content script bundle for Chrome MV3 content_scripts. */

const __webenvoy_module_risk_state = (() => {
const RISK_STATES = ["paused", "limited", "allowed"];
const ISSUE_SCOPES = ["issue_208", "issue_209", "issue_753", "issue_755", "issue_835"];
const EXECUTION_MODES = [
  "dry_run",
  "recon",
  "live_read_limited",
  "live_read_high_risk",
  "live_write"
];
const APPROVAL_CHECK_KEYS = [
  "target_domain_confirmed",
  "target_tab_confirmed",
  "target_page_confirmed",
  "risk_state_checked",
  "action_type_confirmed"
];
const APPROVAL_EVIDENCE_REQUIREMENTS = [
  "approval_record_approved_true",
  "approval_record_approver_present",
  "approval_record_approved_at_present",
  "approval_record_checks_all_true"
];
const ISSUE_209_LIVE_READ_ADMISSION_REQUIREMENTS = [
  "gate_input_risk_state_limited_or_allowed",
  "audit_admission_evidence_present",
  "audit_admission_checks_all_true",
  "risk_state_checked",
  "target_domain_confirmed",
  "target_tab_confirmed",
  "target_page_confirmed",
  "action_type_confirmed",
  "approval_admission_evidence_approved_true",
  "approval_admission_evidence_approver_present",
  "approval_admission_evidence_approved_at_present",
  "approval_admission_evidence_checks_all_true"
];
const RISK_STATE_TRANSITIONS = [
  { from: "allowed", to: "limited", trigger: "risk_signal_detected" },
  { from: "limited", to: "paused", trigger: "account_alert_or_repeat_risk" },
  {
    from: "paused",
    to: "limited",
    trigger: "cooldown_backoff_window_passed_and_manual_approve"
  },
  {
    from: "limited",
    to: "allowed",
    trigger: "stability_window_passed_and_manual_approve"
  }
];
const ISSUE_ACTION_MATRIX = [
  {
    issue_scope: "issue_208",
    state: "paused",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_208",
    state: "limited",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "irreversible_write",
      "live_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_208",
    state: "allowed",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [
      {
        action: "reversible_interaction_with_approval",
        requires: [
          "approval_record_approved_true",
          "approval_record_approver_present",
          "approval_record_approved_at_present",
          "approval_record_checks_all_true"
        ]
      }
    ],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "irreversible_write",
      "live_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_209",
    state: "paused",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_209",
    state: "limited",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [
      {
        action: "live_read_limited",
        requires: [
          ...ISSUE_209_LIVE_READ_ADMISSION_REQUIREMENTS,
          "limited_read_rollout_ready_true",
        ]
      }
    ],
    blocked_actions: [
      "live_read_high_risk",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_209",
    state: "allowed",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [
      {
        action: "live_read_limited",
        requires: [
          ...ISSUE_209_LIVE_READ_ADMISSION_REQUIREMENTS,
          "limited_read_rollout_ready_true",
        ]
      },
      {
        action: "live_read_high_risk",
        requires: [...ISSUE_209_LIVE_READ_ADMISSION_REQUIREMENTS]
      }
    ],
    blocked_actions: ["live_write", "irreversible_write", "expand_new_live_surface_without_gate"]
  },
  {
    issue_scope: "issue_753",
    state: "paused",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_753",
    state: "limited",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_753",
    state: "allowed",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_755",
    state: "paused",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_755",
    state: "limited",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_755",
    state: "allowed",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_835",
    state: "paused",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_835",
    state: "limited",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "reversible_interaction_with_approval",
      "live_write",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  },
  {
    issue_scope: "issue_835",
    state: "allowed",
    allowed_actions: ["dry_run", "recon"],
    conditional_actions: [
      {
        action: "reversible_interaction_with_approval",
        requires: [...APPROVAL_EVIDENCE_REQUIREMENTS]
      }
    ],
    blocked_actions: [
      "live_read_limited",
      "live_read_high_risk",
      "irreversible_write",
      "expand_new_live_surface_without_gate"
    ]
  }
];
const SESSION_RHYTHM_POLICY = {
  min_action_interval_ms: 3_000,
  min_experiment_interval_ms: 30_000,
  cooldown_strategy: "exponential_backoff",
  cooldown_base_minutes: 30,
  cooldown_cap_minutes: 720,
  resume_probe_mode: "recon_only"
};
const RISK_STATE_MACHINE = {
  states: RISK_STATES,
  transitions: RISK_STATE_TRANSITIONS,
  hard_block_when_paused: ["live_read_limited", "live_read_high_risk", "live_write"]
};
const WRITE_INTERACTION_TIER = {
  tiers: [
    { name: "observe_only", live_allowed: false },
    { name: "reversible_interaction", live_allowed: "limited" },
    { name: "irreversible_write", live_allowed: false }
  ],
  synthetic_event_default: "blocked",
  upload_injection_default: "blocked"
};
const LIVE_EXECUTION_MODES = new Set(["live_read_limited", "live_read_high_risk", "live_write"]);
const ACTION_TYPES = new Set(["read", "write", "irreversible_write"]);
const RISK_SIGNAL_REASONS = new Set([
  "MANUAL_CONFIRMATION_MISSING",
  "APPROVAL_CHECKS_INCOMPLETE",
  "ISSUE_ACTION_MATRIX_BLOCKED",
  "RISK_STATE_PAUSED",
  "RISK_STATE_LIMITED"
]);

const isRiskState = (value) => typeof value === "string" && RISK_STATES.includes(value);
const resolveRiskState = (value) => (isRiskState(value) ? value : "paused");

const isIssueScope = (value) => typeof value === "string" && ISSUE_SCOPES.includes(value);
const resolveIssueScope = (value) => (isIssueScope(value) ? value : "issue_209");

const listRiskStateTransitions = () => RISK_STATE_TRANSITIONS.map((entry) => ({ ...entry }));

const listIssueActionMatrix = () =>
  ISSUE_ACTION_MATRIX.map((entry) => ({
    ...entry,
    allowed_actions: [...entry.allowed_actions],
    conditional_actions: entry.conditional_actions.map((item) => ({
      action: item.action,
      requires: [...item.requires]
    })),
    blocked_actions: [...entry.blocked_actions]
  }));

const getIssueActionMatrixEntry = (issueScope, state) => {
  const matched = ISSUE_ACTION_MATRIX.find(
    (entry) => entry.issue_scope === issueScope && entry.state === state
  );
  if (!matched) {
    return {
      issue_scope: issueScope,
      state,
      allowed_actions: ["dry_run", "recon"],
      conditional_actions: [],
      blocked_actions: ["expand_new_live_surface_without_gate"]
    };
  }
  return {
    ...matched,
    allowed_actions: [...matched.allowed_actions],
    conditional_actions: matched.conditional_actions.map((item) => ({
      action: item.action,
      requires: [...item.requires]
    })),
    blocked_actions: [...matched.blocked_actions]
  };
};

const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
const asString = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const asBoolean = (value) => value === true;
const parseTimestamp = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};
const toIsoString = (value) => {
  const parsed = parseTimestamp(value);
  return parsed === null ? null : new Date(parsed).toISOString();
};
const resolveActionType = (value) =>
  typeof value === "string" && ACTION_TYPES.has(value) ? value : "read";
const resolveExecutionMode = (value) =>
  typeof value === "string" && EXECUTION_MODES.includes(value) ? value : null;
const resolveWriteInteractionTier = (actionType, requestedExecutionMode) => {
  if (actionType === "irreversible_write") {
    return "irreversible_write";
  }
  if (actionType === "write" || requestedExecutionMode === "live_write") {
    return "reversible_interaction";
  }
  return "observe_only";
};
const resolveWriteTierMatrixAction = (tierName) => {
  if (tierName === "reversible_interaction") {
    return "reversible_interaction_with_approval";
  }
  if (tierName === "irreversible_write") {
    return "irreversible_write";
  }
  return null;
};
const resolveMatrixActionDecision = (entry, actions) => {
  if (actions.length === 0) {
    return { decision: "not_applicable", requires: [] };
  }
  if (actions.some((action) => entry.blocked_actions.includes(action))) {
    return { decision: "blocked", requires: [] };
  }
  const conditional = entry.conditional_actions.find((item) => actions.includes(item.action)) ?? null;
  if (conditional) {
    return { decision: "conditional", requires: [...conditional.requires] };
  }
  if (actions.every((action) => entry.allowed_actions.includes(action))) {
    return { decision: "allowed", requires: [] };
  }
  return { decision: "blocked", requires: [] };
};
const getWriteActionMatrixDecisions = (issueScope, actionType, requestedExecutionMode) => {
  const resolvedIssueScope = resolveIssueScope(issueScope);
  const resolvedActionType = resolveActionType(actionType);
  const resolvedRequestedExecutionMode = resolveExecutionMode(requestedExecutionMode);
  const writeInteractionTier = resolveWriteInteractionTier(
    resolvedActionType,
    resolvedRequestedExecutionMode
  );
  const writeTierMatrixAction = resolveWriteTierMatrixAction(writeInteractionTier);
  const matrixActions =
    writeTierMatrixAction !== null
      ? [writeTierMatrixAction]
      : resolvedRequestedExecutionMode !== null
        ? [resolvedRequestedExecutionMode]
        : [];

  return {
    issue_scope: resolvedIssueScope,
    action_type: resolvedActionType,
    requested_execution_mode: resolvedRequestedExecutionMode,
    write_interaction_tier: writeInteractionTier,
    matrix_actions: [...matrixActions],
    decisions: RISK_STATES.map((state) => {
      const entry = getIssueActionMatrixEntry(resolvedIssueScope, state);
      const { decision, requires } = resolveMatrixActionDecision(entry, matrixActions);
      return {
        state,
        decision,
        requires
      };
    })
  };
};
const isLiveExecutionMode = (value) =>
  typeof value === "string" && LIVE_EXECUTION_MODES.has(value);
const isApprovalRecordComplete = (approvalRecord) => {
  const record = asRecord(approvalRecord);
  const checks = asRecord(record?.checks);
  return (
    asBoolean(record?.approved) &&
    asString(record?.approver) !== null &&
    asString(record?.approved_at) !== null &&
    APPROVAL_CHECK_KEYS.every((key) => asBoolean(checks?.[key]))
  );
};
const isRiskSignalRecord = (record) => {
  if (!record) {
    return false;
  }
  if (asBoolean(record.risk_signal)) {
    return true;
  }
  if (record.gate_decision === "blocked") {
    return isLiveExecutionMode(record.requested_execution_mode);
  }
  if (!isLiveExecutionMode(record.effective_execution_mode)) {
    return false;
  }
  const reasons = Array.isArray(record.gate_reasons)
    ? record.gate_reasons.filter((item) => typeof item === "string")
    : [];
  return reasons.some((reason) => RISK_SIGNAL_REASONS.has(reason));
};
const isRecoverySignalRecord = (record) => {
  if (!record) {
    return false;
  }
  if (asBoolean(record.recovery_signal)) {
    return true;
  }
  return record.gate_decision === "allowed" && isLiveExecutionMode(record.effective_execution_mode);
};
const normalizeAuditRecords = (auditRecords) =>
  (Array.isArray(auditRecords) ? auditRecords : [])
    .map((record) => asRecord(record))
    .filter((record) => record !== null)
    .sort((left, right) => {
      const rightTime = parseTimestamp(right.recorded_at) ?? 0;
      const leftTime = parseTimestamp(left.recorded_at) ?? 0;
      return rightTime - leftTime;
    });
const buildSessionRhythmOutput = (state, options = {}) => {
  const now = parseTimestamp(options.now ?? Date.now()) ?? Date.now();
  const auditRecords = normalizeAuditRecords(options.auditRecords);
  const latestRecovery = auditRecords.find((record) => isRecoverySignalRecord(record)) ?? null;
  const riskChain = [];

  for (const record of auditRecords) {
    if (isRecoverySignalRecord(record)) {
      break;
    }
    if (isRiskSignalRecord(record)) {
      riskChain.push(record);
      continue;
    }
    if (riskChain.length > 0) {
      break;
    }
  }

  const latestRisk = riskChain[0] ?? null;
  const latestRelevant = latestRisk ?? latestRecovery ?? auditRecords[0] ?? null;
  const triggeredBy =
    latestRelevant && Array.isArray(latestRelevant.gate_reasons) && latestRelevant.gate_reasons.length > 0
      ? asString(latestRelevant.gate_reasons[0])
      : null;
  const lastEventAt = latestRelevant ? toIsoString(latestRelevant.recorded_at) : null;
  const sourceEventId = latestRelevant ? asString(latestRelevant.event_id) : null;

  if (latestRisk) {
    const riskAt = parseTimestamp(latestRisk.recorded_at) ?? now;
    const exponentialMultiplier = Math.max(0, riskChain.length - 1);
    const cooldownWindowMinutes = Math.min(
      SESSION_RHYTHM_POLICY.cooldown_base_minutes * 2 ** exponentialMultiplier,
      SESSION_RHYTHM_POLICY.cooldown_cap_minutes
    );
    const cooldownUntilMs = riskAt + cooldownWindowMinutes * 60_000;
    if (now < cooldownUntilMs) {
      return {
        state: "cooldown",
        triggered_by: triggeredBy,
        cooldown_until: new Date(cooldownUntilMs).toISOString(),
        recovery_started_at: null,
        last_event_at: lastEventAt,
        source_event_id: sourceEventId
      };
    }
    return {
      state: "recovery",
      triggered_by: triggeredBy,
      cooldown_until: new Date(cooldownUntilMs).toISOString(),
      recovery_started_at: new Date(cooldownUntilMs).toISOString(),
      last_event_at: lastEventAt,
      source_event_id: sourceEventId
    };
  }

  if (latestRecovery && state !== "allowed") {
    return {
      state: "recovery",
      triggered_by: triggeredBy,
      cooldown_until: null,
      recovery_started_at: toIsoString(latestRecovery.recorded_at),
      last_event_at: lastEventAt,
      source_event_id: sourceEventId
    };
  }

  return {
    state: "normal",
    triggered_by: triggeredBy,
    cooldown_until: null,
    recovery_started_at: null,
    last_event_at: lastEventAt,
    source_event_id: sourceEventId
  };
};

const buildRiskTransitionAudit = (input) => {
  const gateReasons = Array.isArray(input.gateReasons)
    ? input.gateReasons.filter((item) => typeof item === "string")
    : [];
  const sessionRhythm = buildSessionRhythmOutput(input.prevState, {
    auditRecords: input.auditRecords,
    now: input.now
  });
  let nextState = input.prevState;
  let trigger = "gate_evaluation";

  if (input.decision === "blocked" && isLiveExecutionMode(input.requestedExecutionMode)) {
    if (input.prevState === "allowed") {
      nextState = "limited";
      trigger = "risk_signal_detected";
    } else if (input.prevState === "limited") {
      nextState = "paused";
      trigger = "account_alert_or_repeat_risk";
    }
  } else if (
    input.prevState === "paused" &&
    sessionRhythm.state === "recovery" &&
    isApprovalRecordComplete(input.approvalRecord)
  ) {
    nextState = "limited";
    trigger = "cooldown_backoff_window_passed_and_manual_approve";
  } else if (
    input.prevState === "limited" &&
    sessionRhythm.state === "normal" &&
    isApprovalRecordComplete(input.approvalRecord)
  ) {
    nextState = "allowed";
    trigger = "stability_window_passed_and_manual_approve";
  }

  return {
    run_id: input.runId,
    session_id: input.sessionId,
    issue_scope: input.issueScope,
    prev_state: input.prevState,
    next_state: nextState,
    trigger,
    decision: input.decision,
    reason: gateReasons[0] ?? "GATE_DECISION_RECORDED",
    approver: asString(asRecord(input.approvalRecord)?.approver)
  };
};

const getRiskRecoveryRequirements = (state) => {
  switch (state) {
    case "paused":
      return [
        "cooldown_backoff_window_passed_and_manual_approve",
        "risk_state_checked",
        "audit_record_present"
      ];
    case "limited":
      return [
        "stability_window_passed_and_manual_approve",
        "risk_state_checked",
        "audit_record_present"
      ];
    case "allowed":
      return ["manual_confirmation_recorded", "target_scope_confirmed", "audit_record_present"];
    default:
      return ["audit_record_present"];
  }
};

const buildUnifiedRiskStateOutput = (state, options = {}) => ({
  current_state: state,
  session_rhythm_policy: {
    ...SESSION_RHYTHM_POLICY
  },
  session_rhythm: buildSessionRhythmOutput(state, options),
  risk_state_machine: {
    states: [...RISK_STATE_MACHINE.states],
    transitions: listRiskStateTransitions(),
    hard_block_when_paused: [...RISK_STATE_MACHINE.hard_block_when_paused]
  },
  issue_action_matrix: [
    getIssueActionMatrixEntry("issue_208", state),
    getIssueActionMatrixEntry("issue_209", state),
    getIssueActionMatrixEntry("issue_753", state),
    getIssueActionMatrixEntry("issue_755", state),
    getIssueActionMatrixEntry("issue_835", state)
  ],
  recovery_requirements: getRiskRecoveryRequirements(state)
});
return { APPROVAL_CHECK_KEYS, EXECUTION_MODES, WRITE_INTERACTION_TIER, buildRiskTransitionAudit, buildUnifiedRiskStateOutput, getWriteActionMatrixDecisions, getIssueActionMatrixEntry, resolveIssueScope, resolveRiskState };
})();
const __webenvoy_module_risk_evidence_gate = (() => {
const RISK_EVIDENCE_STATES = new Set([
  "accepted",
  "blocked",
  "unclassified",
  "missing",
  "stale",
  "scope_mismatch",
  "redaction_invalid",
  "provider_private_boundary_violation"
]);

const RISK_EVIDENCE_DECISIONS = new Set(["allow_input_to_1188", "deny", "defer"]);
const RISK_EVIDENCE_SCHEMA_VERSION = "webenvoy-risk-evidence-boundary.v1";
const RISK_EVIDENCE_DOWNSTREAM_OWNER = "#1188";
const BEHAVIOR_BASELINE_HINT_SCHEMA_VERSION = "webenvoy-behavior-baseline-hint.v1";

const BEHAVIOR_BASELINE_HINT_BASELINE_STATES = new Set([
  "unseeded",
  "learning",
  "ready",
  "degraded"
]);
const BEHAVIOR_BASELINE_HINT_DRIFT_LEVELS = new Set([
  "none",
  "low",
  "medium",
  "high",
  "critical"
]);
const BEHAVIOR_BASELINE_HINT_DECISIONS = new Set([
  "allow_read_only",
  "no_additional_restriction",
  "hold_live_write",
  "require_manual_review",
  "require_reseed"
]);
const BEHAVIOR_BASELINE_HINT_HIGH_DRIFT_DECISIONS = new Set([
  "hold_live_write",
  "require_manual_review",
  "require_reseed"
]);
const BEHAVIOR_BASELINE_HINT_RESEED_DECISIONS = new Set([
  "require_manual_review",
  "require_reseed"
]);
const BEHAVIOR_BASELINE_HINT_LEARNING_READ_DECISIONS = new Set([
  "allow_read_only",
  "require_manual_review"
]);
const BEHAVIOR_BASELINE_HINT_LEARNING_WRITE_DECISIONS = new Set([
  "hold_live_write",
  "require_manual_review"
]);
const BEHAVIOR_BASELINE_HINT_GOAL_KINDS = new Set(["read", "write"]);
const BEHAVIOR_BASELINE_HINT_EXECUTION_MODES = new Set([
  "dry_run",
  "recon",
  "live_read_limited",
  "live_read_high_risk",
  "live_write"
]);
const BEHAVIOR_BASELINE_HINT_ALLOWED_KEYS = new Set([
  "schema_version",
  "target_fr_ref",
  "validation_scope",
  "assessment_ref",
  "baseline_ref",
  "baseline_state",
  "drift_level",
  "decision_hint",
  "confidence",
  "profile_ref",
  "target_domain",
  "browser_channel",
  "execution_surface",
  "effective_execution_mode",
  "probe_bundle_ref",
  "goal_kind",
  "reseed_required",
  "evidence_refs_consumed",
  "assessed_at"
]);
const BEHAVIOR_BASELINE_HINT_FORBIDDEN_ACCOUNT_OPS_KEYS = new Set([
  "account_health_score",
  "account_pool_ref",
  "account_rotation_policy_ref",
  "account_cooldown_policy_ref",
  "persona_ref",
  "behavior_persona_ref",
  "operator_schedule_ref",
  "long_term_profile_score"
]);
const RISK_HINT_INPUTS = new Set(["session_rhythm_evidence"]);

const RISK_EVIDENCE_NON_PROOFS = new Set([
  "provider_stealth_declared",
  "provider_contract_present",
  "provider_descriptor_present",
  "provider_capability_matrix_present",
  "provider_registry_row_present",
  "provider_doctor_pass",
  "provider_health_pass",
  "runtime_ping",
  "runtime_bootstrap_ack",
  "fingerprint_seed_ref_present",
  "private_patch_ref_present",
  "account_safety_issue_closed",
  "operator_unlock_present",
  "default_lock_present",
  "live_evidence_gate_present",
  "historical_artifact",
  "same_head_historical_artifact",
  "post_merge_evidence",
  "stub_or_fake_host",
  "control_plane_only_signal",
  "dry_run_only_output",
  "spec_sample_or_fixture",
  "manual_disposition_present",
  "session_rhythm_detector_specific_stealth",
  "detector_specific_stealth",
  "cloakbrowser_as_core",
  "browser_patching",
  "default_live_write_commit",
  "account_operations",
  "issue_835_recovery"
]);

const RISK_EVIDENCE_BLOCKING_REASONS = new Set([
  "risk_evidence_missing",
  "risk_evidence_unclassified",
  "risk_evidence_stale",
  "risk_evidence_scope_mismatch",
  "risk_evidence_head_mismatch",
  "risk_evidence_run_mismatch",
  "risk_evidence_profile_mismatch",
  "risk_evidence_page_mismatch",
  "risk_evidence_provider_mismatch",
  "risk_evidence_redaction_invalid",
  "provider_stealth_boundary_missing",
  "provider_stealth_boundary_unresolved",
  "provider_stealth_non_proof",
  "provider_private_patch_disclosed",
  "provider_private_patch_required_but_unverified",
  "account_safety_required",
  "account_safety_not_clear",
  "runtime_target_binding_required",
  "runtime_target_binding_not_accepted",
  "extension_native_bridge_required",
  "default_lock_required",
  "operator_unlock_required",
  "live_evidence_required",
  "behavior_baseline_required",
  "route_evidence_required",
  "closeout_audit_required",
  "stub_or_fake_host_evidence",
  "control_plane_only_signal",
  "historical_or_stale_evidence",
  "manual_disposition_required",
  "manual_disposition_not_accepted",
  "risk_hint_consumer_required",
  "downstream_owner_required"
]);

const STATE_REASON_MAP = {
  blocked: "risk_hint_consumer_required",
  unclassified: "risk_evidence_unclassified",
  missing: "risk_evidence_missing",
  stale: "risk_evidence_stale",
  scope_mismatch: "risk_evidence_scope_mismatch",
  redaction_invalid: "risk_evidence_redaction_invalid",
  provider_private_boundary_violation: "provider_private_patch_disclosed"
};

const NON_PROOF_REASON_MAP = {
  provider_stealth_declared: "provider_stealth_non_proof",
  provider_contract_present: "provider_stealth_non_proof",
  provider_descriptor_present: "provider_stealth_non_proof",
  provider_capability_matrix_present: "provider_stealth_non_proof",
  provider_registry_row_present: "provider_stealth_non_proof",
  provider_doctor_pass: "provider_stealth_non_proof",
  provider_health_pass: "provider_stealth_non_proof",
  runtime_ping: "control_plane_only_signal",
  runtime_bootstrap_ack: "control_plane_only_signal",
  fingerprint_seed_ref_present: "provider_stealth_non_proof",
  private_patch_ref_present: "provider_stealth_non_proof",
  account_safety_issue_closed: "account_safety_required",
  operator_unlock_present: "operator_unlock_required",
  default_lock_present: "default_lock_required",
  live_evidence_gate_present: "live_evidence_required",
  historical_artifact: "historical_or_stale_evidence",
  same_head_historical_artifact: "historical_or_stale_evidence",
  post_merge_evidence: "historical_or_stale_evidence",
  stub_or_fake_host: "stub_or_fake_host_evidence",
  control_plane_only_signal: "control_plane_only_signal",
  dry_run_only_output: "control_plane_only_signal",
  spec_sample_or_fixture: "historical_or_stale_evidence",
  manual_disposition_present: "manual_disposition_not_accepted",
  session_rhythm_detector_specific_stealth: "provider_stealth_non_proof",
  detector_specific_stealth: "provider_stealth_non_proof",
  cloakbrowser_as_core: "provider_stealth_non_proof",
  browser_patching: "provider_stealth_non_proof",
  default_live_write_commit: "default_lock_required",
  account_operations: "account_safety_required",
  issue_835_recovery: "risk_evidence_scope_mismatch"
};

const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const hasPresentField = (record, key) =>
  Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined;

const asString = (value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const asIsoTimestamp = (value) => {
  const timestamp = asString(value);
  if (!timestamp) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : timestamp;
};

const classifyStringArray = (value) => {
  if (!Array.isArray(value)) {
    return {
      values: [],
      malformed: value !== undefined && value !== null
    };
  }

  const values = [];
  let malformed = false;
  for (const item of value) {
    const normalized = asString(item);
    if (normalized) {
      values.push(normalized);
    } else {
      malformed = true;
    }
  }
  return { values, malformed };
};

const asStringArray = (value) => classifyStringArray(value).values;

const pushReason = (target, reason) => {
  if (reason && !target.includes(reason)) {
    target.push(reason);
  }
};

const classifyNonProofs = (value) => {
  const classified = classifyStringArray(value);
  const reasons = [];
  for (const item of classified.values) {
    if (!RISK_EVIDENCE_NON_PROOFS.has(item)) {
      pushReason(reasons, "risk_evidence_unclassified");
    }
  }
  if (classified.malformed) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  return {
    values: classified.values,
    reasons,
    present: Array.isArray(value) || classified.malformed
  };
};

const classifyBlockingReasons = (value) => {
  const classified = classifyStringArray(value);
  const reasons = [];
  if (!Array.isArray(value)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  for (const reason of classified.values) {
    pushReason(
      reasons,
      RISK_EVIDENCE_BLOCKING_REASONS.has(reason) ? reason : "risk_evidence_unclassified"
    );
  }
  if (classified.malformed) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  return {
    values: classified.values,
    reasons,
    malformed: reasons.includes("risk_evidence_unclassified")
  };
};

const classifyRiskHints = (value) => {
  const classified = classifyStringArray(value);
  const reasons = [];
  for (const hint of classified.values) {
    if (!RISK_HINT_INPUTS.has(hint)) {
      pushReason(reasons, "risk_evidence_unclassified");
    }
  }
  if (classified.malformed) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  return {
    values: classified.values,
    reasons,
    malformed: reasons.includes("risk_evidence_unclassified")
  };
};

const collectNonProofBlockingReasons = (nonProofs) => {
  const reasons = [];
  for (const nonProof of nonProofs) {
    pushReason(reasons, NON_PROOF_REASON_MAP[nonProof] ?? "risk_evidence_unclassified");
  }
  return reasons;
};

const buildBlockedResult = (input) => ({
  required: input.required,
  accepted_risk_input: false,
  read_write_allow_proof: false,
  decision: "blocked",
  gate_reasons: input.gateReasons,
  risk_evidence_state: input.riskEvidenceState,
  risk_evidence_decision: input.riskEvidenceDecision,
  non_proofs_observed: input.nonProofsObserved,
  risk_evidence_ref: input.riskEvidenceRef,
  evidence_refs_consumed: input.evidenceRefsConsumed,
  risk_hints_consumed: input.riskHintsConsumed,
  behavior_baseline_hint_accepted: input.behaviorBaselineHintAccepted ?? false,
  behavior_baseline_hint: input.behaviorBaselineHint ?? null,
  schema_version: input.schemaVersion,
  evaluated_at: input.evaluatedAt,
  downstream_owner: input.downstreamOwner
});

const normalizeBehaviorBaselineScope = (value) => {
  const record = asRecord(value);
  if (!record) {
    return {
      profile_ref: null,
      target_domain: null,
      requested_execution_mode: null,
      effective_execution_mode: null,
      probe_bundle_ref: null,
      goal_kind: null
    };
  }
  return {
    profile_ref: asString(record.profile_ref ?? record.profileRef),
    target_domain: asString(record.target_domain ?? record.targetDomain),
    requested_execution_mode: asString(
      record.requested_execution_mode ?? record.requestedExecutionMode
    ),
    effective_execution_mode: asString(
      record.effective_execution_mode ?? record.effectiveExecutionMode
    ),
    probe_bundle_ref: asString(record.probe_bundle_ref ?? record.probeBundleRef),
    goal_kind: asString(record.goal_kind ?? record.goalKind)
  };
};

const pushBehaviorBaselineScopeMismatch = (input) => {
  if (input.expected === null || input.expected === undefined) {
    return;
  }
  if (input.actual !== input.expected) {
    pushReason(input.reasons, "risk_evidence_scope_mismatch");
  }
};

const evaluateBehaviorBaselineHint = (value, expectedScopeInput = null) => {
  if (value === undefined) {
    return {
      present: false,
      accepted: false,
      reasons: [],
      hint: null
    };
  }

  const record = asRecord(value);
  const reasons = [];
  if (!record) {
    return {
      present: true,
      accepted: false,
      reasons: ["risk_evidence_unclassified"],
      hint: null
    };
  }

  for (const key of Object.keys(record)) {
    if (BEHAVIOR_BASELINE_HINT_FORBIDDEN_ACCOUNT_OPS_KEYS.has(key)) {
      pushReason(reasons, "risk_evidence_scope_mismatch");
    } else if (!BEHAVIOR_BASELINE_HINT_ALLOWED_KEYS.has(key)) {
      pushReason(reasons, "risk_evidence_unclassified");
    }
  }

  const schemaVersion = asString(record.schema_version);
  const targetFrRef = asString(record.target_fr_ref);
  const validationScope = asString(record.validation_scope);
  const assessmentRef = asString(record.assessment_ref);
  const baselineRef = asString(record.baseline_ref);
  const baselineState = asString(record.baseline_state);
  const driftLevel = asString(record.drift_level);
  const decisionHint = asString(record.decision_hint);
  const profileRef = asString(record.profile_ref);
  const targetDomain = asString(record.target_domain);
  const browserChannel = asString(record.browser_channel);
  const executionSurface = asString(record.execution_surface);
  const effectiveExecutionMode = asString(record.effective_execution_mode);
  const probeBundleRef = asString(record.probe_bundle_ref);
  const goalKind = asString(record.goal_kind);
  const assessedAt = asIsoTimestamp(record.assessed_at);
  const evidenceRefsConsumed = asStringArray(record.evidence_refs_consumed);
  const evidenceRefsConsumedShape = classifyStringArray(record.evidence_refs_consumed);
  const confidence = typeof record.confidence === "number" ? record.confidence : null;
  const reseedRequired = typeof record.reseed_required === "boolean" ? record.reseed_required : null;

  if (schemaVersion !== BEHAVIOR_BASELINE_HINT_SCHEMA_VERSION) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (targetFrRef !== "FR-0022" || validationScope !== "cross_layer_baseline") {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (!assessmentRef || evidenceRefsConsumed.length === 0 || evidenceRefsConsumedShape.malformed) {
    pushReason(reasons, "behavior_baseline_required");
  }
  if (!assessedAt) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!profileRef || !targetDomain || !probeBundleRef) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (browserChannel !== "Google Chrome stable" || executionSurface !== "real_browser") {
    pushReason(reasons, "stub_or_fake_host_evidence");
  }
  if (!BEHAVIOR_BASELINE_HINT_EXECUTION_MODES.has(effectiveExecutionMode)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!BEHAVIOR_BASELINE_HINT_GOAL_KINDS.has(goalKind)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!BEHAVIOR_BASELINE_HINT_BASELINE_STATES.has(baselineState)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!BEHAVIOR_BASELINE_HINT_DRIFT_LEVELS.has(driftLevel)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (!BEHAVIOR_BASELINE_HINT_DECISIONS.has(decisionHint)) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (confidence === null || confidence < 0 || confidence > 1) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (reseedRequired === null) {
    pushReason(reasons, "risk_evidence_unclassified");
  }
  if (
    decisionHint === "no_additional_restriction" &&
    (goalKind !== "write" ||
      baselineState !== "ready" ||
      !["none", "low"].includes(driftLevel) ||
      reseedRequired !== false)
  ) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (reseedRequired === true && !["require_manual_review", "require_reseed"].includes(decisionHint)) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  const highDrift = driftLevel === "high" || driftLevel === "critical";
  if (highDrift && !BEHAVIOR_BASELINE_HINT_HIGH_DRIFT_DECISIONS.has(decisionHint)) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (goalKind === "write" && decisionHint === "allow_read_only") {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (baselineState === "ready" && highDrift) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (
    (baselineState === "unseeded" || baselineState === "learning") &&
    ((goalKind === "read" && !BEHAVIOR_BASELINE_HINT_LEARNING_READ_DECISIONS.has(decisionHint)) ||
      (goalKind === "write" && !BEHAVIOR_BASELINE_HINT_LEARNING_WRITE_DECISIONS.has(decisionHint)))
  ) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (
    baselineState === "degraded" &&
    !BEHAVIOR_BASELINE_HINT_HIGH_DRIFT_DECISIONS.has(decisionHint)
  ) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (
    reseedRequired === true &&
    (baselineState === "ready" || !BEHAVIOR_BASELINE_HINT_RESEED_DECISIONS.has(decisionHint))
  ) {
    pushReason(reasons, "risk_evidence_scope_mismatch");
  }
  if (
    (baselineState === "ready" ||
      (goalKind === "write" && decisionHint === "no_additional_restriction")) &&
    !baselineRef
  ) {
    pushReason(reasons, "behavior_baseline_required");
  }
  const expectedScope = normalizeBehaviorBaselineScope(expectedScopeInput);
  const expectedExecutionMode =
    expectedScope.effective_execution_mode ?? expectedScope.requested_execution_mode;
  pushBehaviorBaselineScopeMismatch({
    reasons,
    actual: profileRef,
    expected: expectedScope.profile_ref
  });
  pushBehaviorBaselineScopeMismatch({
    reasons,
    actual: targetDomain,
    expected: expectedScope.target_domain
  });
  pushBehaviorBaselineScopeMismatch({
    reasons,
    actual: effectiveExecutionMode,
    expected: expectedExecutionMode
  });
  pushBehaviorBaselineScopeMismatch({
    reasons,
    actual: probeBundleRef,
    expected: expectedScope.probe_bundle_ref
  });
  pushBehaviorBaselineScopeMismatch({
    reasons,
    actual: goalKind,
    expected: expectedScope.goal_kind
  });

  const hint = {
    schema_version: schemaVersion,
    target_fr_ref: targetFrRef,
    validation_scope: validationScope,
    assessment_ref: assessmentRef,
    baseline_ref: baselineRef,
    baseline_state: baselineState,
    drift_level: driftLevel,
    decision_hint: decisionHint,
    confidence,
    profile_ref: profileRef,
    target_domain: targetDomain,
    browser_channel: browserChannel,
    execution_surface: executionSurface,
    effective_execution_mode: effectiveExecutionMode,
    probe_bundle_ref: probeBundleRef,
    goal_kind: goalKind,
    reseed_required: reseedRequired,
    evidence_refs_consumed: evidenceRefsConsumed,
    assessed_at: assessedAt
  };

  return {
    present: true,
    accepted: reasons.length === 0,
    reasons,
    hint: reasons.length === 0 ? hint : null
  };
};

const isRiskEvidenceGateRequired = (input = {}) => {
  const record = asRecord(input);
  if (!record) {
    return false;
  }
  return (
    record.required === true ||
    record.riskEvidenceRequired === true ||
    record.risk_evidence_required === true ||
    record.behaviorBaselineHintRequired === true ||
    record.behavior_baseline_hint_required === true ||
    hasPresentField(record, "riskEvidenceGateResult") ||
    hasPresentField(record, "risk_evidence_gate_result") ||
    hasPresentField(record, "behaviorBaselineHint") ||
    hasPresentField(record, "behavior_baseline_hint") ||
    classifyNonProofs(record.nonProofsObserved).present ||
    classifyNonProofs(record.non_proofs_observed).present ||
    classifyNonProofs(record.nonProofs).present ||
    classifyNonProofs(record.non_proofs).present
  );
};

const evaluateRiskEvidenceConsumerGate = (input = {}) => {
  const record = asRecord(input) ?? {};
  const rawRiskEvidenceGateResult = hasPresentField(record, "riskEvidenceGateResult")
    ? record.riskEvidenceGateResult
    : record.risk_evidence_gate_result;
  const riskEvidenceGateResult = asRecord(rawRiskEvidenceGateResult);
  const nonProofClassifications = [
    classifyNonProofs(record.nonProofsObserved),
    classifyNonProofs(record.non_proofs_observed),
    classifyNonProofs(record.nonProofs),
    classifyNonProofs(record.non_proofs)
  ];
  const nonProofsObserved = [
    ...nonProofClassifications.flatMap((classification) => classification.values)
  ].filter((item, index, items) => items.indexOf(item) === index);
  const nonProofGateReasons = nonProofClassifications.flatMap(
    (classification) => classification.reasons
  );
  const rawBehaviorBaselineHint = hasPresentField(record, "behaviorBaselineHint")
    ? record.behaviorBaselineHint
    : record.behavior_baseline_hint;
  const rawBehaviorBaselineScope = hasPresentField(record, "behaviorBaselineScope")
    ? record.behaviorBaselineScope
    : record.behavior_baseline_scope;
  const behaviorBaselineHint = evaluateBehaviorBaselineHint(
    rawBehaviorBaselineHint,
    rawBehaviorBaselineScope
  );
  const behaviorBaselineHintRequired =
    record.behaviorBaselineHintRequired === true || record.behavior_baseline_hint_required === true;
  const required = isRiskEvidenceGateRequired(record);
  const riskEvidenceGateResultProvided =
    hasPresentField(record, "riskEvidenceGateResult") ||
    hasPresentField(record, "risk_evidence_gate_result");

  if (!required) {
    return {
      required: false,
      accepted_risk_input: false,
      read_write_allow_proof: false,
      decision: "not_required",
      gate_reasons: [],
      risk_evidence_state: null,
      risk_evidence_decision: null,
      non_proofs_observed: nonProofsObserved,
      risk_evidence_ref: null,
      evidence_refs_consumed: [],
      risk_hints_consumed: [],
      behavior_baseline_hint_accepted: false,
      behavior_baseline_hint: null,
      downstream_owner: "none"
    };
  }

  if (!riskEvidenceGateResult) {
    return buildBlockedResult({
      required,
      gateReasons:
        riskEvidenceGateResultProvided && rawRiskEvidenceGateResult !== null
          ? ["risk_evidence_unclassified"]
          : behaviorBaselineHintRequired && !behaviorBaselineHint.present
          ? ["behavior_baseline_required"]
          : behaviorBaselineHint.reasons.length > 0
          ? behaviorBaselineHint.reasons
          : nonProofsObserved.length > 0 || nonProofGateReasons.length > 0
          ? [...collectNonProofBlockingReasons(nonProofsObserved), ...nonProofGateReasons].filter(
              (reason, index, reasons) => reasons.indexOf(reason) === index
            )
          : ["risk_evidence_missing"],
      riskEvidenceState: "missing",
      riskEvidenceDecision: null,
      nonProofsObserved,
      riskEvidenceRef: null,
      evidenceRefsConsumed: [],
      riskHintsConsumed: [],
      behaviorBaselineHintAccepted: behaviorBaselineHint.accepted,
      behaviorBaselineHint: behaviorBaselineHint.hint,
      downstreamOwner: "none"
    });
  }

  const riskEvidenceState = asString(riskEvidenceGateResult.risk_state);
  const riskEvidenceDecision = asString(riskEvidenceGateResult.decision);
  const schemaVersion = asString(riskEvidenceGateResult.schema_version);
  const riskEvidenceRef = asString(riskEvidenceGateResult.risk_evidence_ref);
  const evidenceRefsConsumed = asStringArray(riskEvidenceGateResult.evidence_refs_consumed);
  const evidenceRefsConsumedShape = classifyStringArray(
    riskEvidenceGateResult.evidence_refs_consumed
  );
  const riskHintsConsumedShape = classifyRiskHints(riskEvidenceGateResult.risk_hints_consumed);
  const riskHintsConsumed = riskHintsConsumedShape.values;
  const evaluatedAt = asIsoTimestamp(riskEvidenceGateResult.evaluated_at);
  const downstreamOwner = asString(riskEvidenceGateResult.downstream_owner) ?? "none";
  const blockingReasonsShape = classifyBlockingReasons(riskEvidenceGateResult.blocking_reasons);
  const blockingReasons = blockingReasonsShape.values;
  const gateReasons = [];

  for (const reason of nonProofGateReasons) {
    pushReason(gateReasons, reason);
  }
  for (const reason of behaviorBaselineHint.reasons) {
    pushReason(gateReasons, reason);
  }
  if (behaviorBaselineHintRequired && !behaviorBaselineHint.present) {
    pushReason(gateReasons, "behavior_baseline_required");
  }
  if (schemaVersion !== RISK_EVIDENCE_SCHEMA_VERSION) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  if (!RISK_EVIDENCE_STATES.has(riskEvidenceState)) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  if (!RISK_EVIDENCE_DECISIONS.has(riskEvidenceDecision)) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  if (!evaluatedAt) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  if (downstreamOwner === "none") {
    pushReason(gateReasons, "downstream_owner_required");
  }
  if (evidenceRefsConsumedShape.malformed) {
    pushReason(gateReasons, "risk_evidence_unclassified");
  }
  for (const reason of riskHintsConsumedShape.reasons) {
    pushReason(gateReasons, reason);
  }
  for (const reason of blockingReasonsShape.reasons) {
    pushReason(gateReasons, reason);
  }

  if (riskEvidenceState && riskEvidenceState !== "accepted") {
    pushReason(gateReasons, STATE_REASON_MAP[riskEvidenceState] ?? "risk_evidence_unclassified");
  }
  if (riskEvidenceDecision !== "allow_input_to_1188") {
    pushReason(gateReasons, blockingReasons.length > 0 ? null : "risk_evidence_unclassified");
  }
  if (riskEvidenceState === "accepted" && riskEvidenceDecision === "allow_input_to_1188") {
    if (blockingReasonsShape.malformed) {
      pushReason(gateReasons, "risk_evidence_unclassified");
    }
    if (downstreamOwner !== RISK_EVIDENCE_DOWNSTREAM_OWNER) {
      pushReason(gateReasons, "downstream_owner_required");
    }
    if (blockingReasons.length > 0) {
      pushReason(gateReasons, "risk_evidence_unclassified");
    }
    if (!riskEvidenceRef || evidenceRefsConsumed.length === 0) {
      pushReason(gateReasons, "risk_evidence_missing");
    }
  }

  if (gateReasons.length > 0) {
    return buildBlockedResult({
      required,
      gateReasons,
      riskEvidenceState: riskEvidenceState ?? "unclassified",
      riskEvidenceDecision,
      nonProofsObserved,
      riskEvidenceRef,
      evidenceRefsConsumed,
      riskHintsConsumed,
      behaviorBaselineHintAccepted: behaviorBaselineHint.accepted,
      behaviorBaselineHint: behaviorBaselineHint.hint,
      schemaVersion,
      evaluatedAt,
      downstreamOwner
    });
  }

  return {
    required,
    accepted_risk_input: true,
    read_write_allow_proof: false,
    decision: "allow_input_to_consumer_gate",
    gate_reasons: [],
    risk_evidence_state: "accepted",
    risk_evidence_decision: "allow_input_to_1188",
    non_proofs_observed: nonProofsObserved,
    risk_evidence_ref: riskEvidenceRef,
    evidence_refs_consumed: evidenceRefsConsumed,
    risk_hints_consumed: riskHintsConsumed,
    behavior_baseline_hint_accepted: behaviorBaselineHint.accepted,
    behavior_baseline_hint: behaviorBaselineHint.hint,
    schema_version: schemaVersion,
    evaluated_at: evaluatedAt,
    downstream_owner: downstreamOwner
  };
};
return { evaluateRiskEvidenceConsumerGate };
})();
const __webenvoy_module_platform_behavior_assessment_gate = (() => {
const PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION =
  "webenvoy-platform-behavior-assessment-risk-hint.v1";
const PLATFORM_BEHAVIOR_TARGET_FR_REF = "FR-0022";
const PLATFORM_BEHAVIOR_VALIDATION_SCOPE = "cross_layer_baseline";

const BROWSER_CHANNEL = "Google Chrome stable";
const EXECUTION_SURFACE = "real_browser";
const GOAL_KINDS = new Set(["read", "write"]);
const BASELINE_STATES = new Set(["unseeded", "learning", "ready", "degraded"]);
const DRIFT_LEVELS = new Set(["none", "low", "medium", "high", "critical"]);
const DECISION_HINTS = new Set([
  "allow_read_only",
  "no_additional_restriction",
  "hold_live_write",
  "require_manual_review",
  "require_reseed"
]);
const HIGH_DRIFT_DECISION_HINTS = new Set([
  "hold_live_write",
  "require_manual_review",
  "require_reseed"
]);
const RESEED_DECISION_HINTS = new Set(["require_manual_review", "require_reseed"]);
const EXECUTION_MODES = new Set([
  "dry_run",
  "recon",
  "live_read_limited",
  "live_read_high_risk",
  "live_write"
]);
const REQUIRED_EXPECTED_SCOPE_KEYS = [
  "profile_ref",
  "platform",
  "target_domain",
  "browser_channel",
  "execution_surface",
  "effective_execution_mode",
  "probe_bundle_ref",
  "goal_kind"
];
const ACTION_TYPES = new Set([
  "navigate",
  "locate",
  "click",
  "extract",
  "wait_settled",
  "type",
  "submit",
  "confirm",
  "publish",
  "purchase",
  "dispatch",
  "bind"
]);
const CLICK_KINDS = new Set([
  "expand_or_collapse",
  "switch_content_tab",
  "open_detail_view",
  "load_more_or_paginate"
]);

const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const hasPresentField = (record, key) =>
  Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined;

const asString = (value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const asNumber = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const asIsoTimestamp = (value) => {
  const timestamp = asString(value);
  if (!timestamp) {
    return null;
  }
  return Number.isNaN(Date.parse(timestamp)) ? null : timestamp;
};

const asStringArray = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim().length > 0)
    : null;

const pushReason = (target, reason) => {
  if (reason && !target.includes(reason)) {
    target.push(reason);
  }
};

const resolveRawAssessment = (record) => {
  if (hasPresentField(record, "platformBehaviorAssessment")) {
    return record.platformBehaviorAssessment;
  }
  return record.platform_behavior_assessment;
};

const resolveRawContext = (record) => {
  if (hasPresentField(record, "platformBehaviorAssessmentContext")) {
    return record.platformBehaviorAssessmentContext;
  }
  if (hasPresentField(record, "platform_behavior_assessment_context")) {
    return record.platform_behavior_assessment_context;
  }
  if (hasPresentField(record, "platformBehaviorContext")) {
    return record.platformBehaviorContext;
  }
  return record.platform_behavior_context;
};

const resolveExpectedScope = (record) => {
  if (hasPresentField(record, "expectedPlatformBehaviorScope")) {
    return record.expectedPlatformBehaviorScope;
  }
  return record.expected_platform_behavior_scope;
};

const isRequired = (record) =>
  record.required === true ||
  record.platformBehaviorAssessmentRequired === true ||
  record.platform_behavior_assessment_required === true ||
  hasPresentField(record, "platformBehaviorAssessment") ||
  hasPresentField(record, "platform_behavior_assessment");

const normalizeContext = (value, reasons) => {
  const context = asRecord(value);
  if (!context) {
    pushReason(reasons, "platform_behavior_context_missing");
    return {
      target_fr_ref: null,
      validation_scope: null
    };
  }

  const targetFrRef = asString(context.target_fr_ref);
  const validationScope = asString(context.validation_scope);
  if (targetFrRef !== PLATFORM_BEHAVIOR_TARGET_FR_REF) {
    pushReason(reasons, "platform_behavior_target_fr_mismatch");
  }
  if (validationScope !== PLATFORM_BEHAVIOR_VALIDATION_SCOPE) {
    pushReason(reasons, "platform_behavior_validation_scope_mismatch");
  }
  if (hasPresentField(context, "issue_scope")) {
    pushReason(reasons, "platform_behavior_issue_scope_not_allowed");
  }

  return {
    target_fr_ref: targetFrRef,
    validation_scope: validationScope
  };
};

const normalizeAssessment = (value, reasons) => {
  const assessment = asRecord(value);
  if (!assessment) {
    pushReason(reasons, "platform_behavior_assessment_missing");
    return null;
  }

  if (hasPresentField(assessment, "issue_scope")) {
    pushReason(reasons, "platform_behavior_issue_scope_not_allowed");
  }

  const normalized = {
    assessment_id: asString(assessment.assessment_id),
    profile_ref: asString(assessment.profile_ref),
    platform: asString(assessment.platform),
    target_domain: asString(assessment.target_domain),
    browser_channel: asString(assessment.browser_channel),
    execution_surface: asString(assessment.execution_surface),
    effective_execution_mode: asString(assessment.effective_execution_mode),
    requested_execution_mode: asString(assessment.requested_execution_mode),
    probe_bundle_ref: asString(assessment.probe_bundle_ref),
    goal_kind: asString(assessment.goal_kind),
    runtime_context_id: asString(assessment.runtime_context_id),
    baseline_ref: asString(assessment.baseline_ref),
    baseline_state: asString(assessment.baseline_state),
    drift_level: asString(assessment.drift_level),
    action_type: asString(assessment.action_type),
    interaction_semantics: asString(assessment.interaction_semantics),
    click_kind: asString(assessment.click_kind),
    threshold_config_snapshot_ref: asString(assessment.threshold_config_snapshot_ref),
    decision_hint: asString(assessment.decision_hint),
    confidence: asNumber(assessment.confidence),
    evidence_refs: asStringArray(assessment.evidence_refs),
    assessed_at: asIsoTimestamp(assessment.assessed_at ?? assessment.assessedAt),
    model_version: asString(assessment.model_version),
    reseed_required: assessment.reseed_required === true
  };

  const requiredStringFields = [
    "assessment_id",
    "profile_ref",
    "platform",
    "target_domain",
    "browser_channel",
    "execution_surface",
    "effective_execution_mode",
    "requested_execution_mode",
    "probe_bundle_ref",
    "goal_kind",
    "runtime_context_id",
    "baseline_state",
    "drift_level",
    "action_type",
    "threshold_config_snapshot_ref",
    "decision_hint",
    "assessed_at",
    "model_version"
  ];
  for (const field of requiredStringFields) {
    if (!normalized[field]) {
      pushReason(reasons, "platform_behavior_assessment_malformed");
    }
  }

  if (normalized.browser_channel !== BROWSER_CHANNEL) {
    pushReason(reasons, "platform_behavior_browser_channel_mismatch");
  }
  if (normalized.execution_surface !== EXECUTION_SURFACE) {
    pushReason(reasons, "platform_behavior_execution_surface_mismatch");
  }
  if (!EXECUTION_MODES.has(normalized.effective_execution_mode)) {
    pushReason(reasons, "platform_behavior_execution_mode_mismatch");
  }
  if (!EXECUTION_MODES.has(normalized.requested_execution_mode)) {
    pushReason(reasons, "platform_behavior_execution_mode_mismatch");
  }
  if (!GOAL_KINDS.has(normalized.goal_kind)) {
    pushReason(reasons, "platform_behavior_goal_kind_mismatch");
  }
  if (!BASELINE_STATES.has(normalized.baseline_state)) {
    pushReason(reasons, "platform_behavior_baseline_state_unclassified");
  }
  if (!DRIFT_LEVELS.has(normalized.drift_level)) {
    pushReason(reasons, "platform_behavior_drift_level_unclassified");
  }
  if (!DECISION_HINTS.has(normalized.decision_hint)) {
    pushReason(reasons, "platform_behavior_decision_hint_unclassified");
  }
  if (!ACTION_TYPES.has(normalized.action_type)) {
    pushReason(reasons, "platform_behavior_action_type_unclassified");
  }
  if (normalized.confidence === null || normalized.confidence < 0 || normalized.confidence > 1) {
    pushReason(reasons, "platform_behavior_assessment_malformed");
  }
  if (!Array.isArray(normalized.evidence_refs) || normalized.evidence_refs.length === 0) {
    pushReason(reasons, "platform_behavior_evidence_refs_missing");
  }
  if (normalized.action_type === "click") {
    if (normalized.interaction_semantics !== "reveal_only_click") {
      pushReason(reasons, "platform_behavior_click_semantics_missing");
    }
    if (!CLICK_KINDS.has(normalized.click_kind)) {
      pushReason(reasons, "platform_behavior_click_kind_missing");
    }
  }
  if (
    normalized.decision_hint === "no_additional_restriction" &&
    (normalized.goal_kind !== "write" ||
      normalized.baseline_state !== "ready" ||
      normalized.reseed_required ||
      !["none", "low"].includes(normalized.drift_level))
  ) {
    pushReason(reasons, "platform_behavior_non_restriction_hint_invalid");
  }
  if (
    !normalized.baseline_ref &&
    !isBaselineRefOptionalColdStartOrLearningAssessment(normalized)
  ) {
    pushReason(reasons, "platform_behavior_baseline_ref_missing");
  }

  return normalized;
};

const isBaselineRefOptionalColdStartOrLearningAssessment = (assessment) => {
  if (!["unseeded", "learning"].includes(assessment.baseline_state)) {
    return false;
  }
  if (assessment.decision_hint === "no_additional_restriction") {
    return false;
  }
  if (assessment.reseed_required || ["high", "critical"].includes(assessment.drift_level)) {
    return false;
  }
  if (assessment.goal_kind === "read") {
    return ["allow_read_only", "require_manual_review"].includes(assessment.decision_hint);
  }
  if (assessment.goal_kind === "write") {
    return ["hold_live_write", "require_manual_review"].includes(assessment.decision_hint);
  }
  return false;
};

const normalizeExpectedScope = (value, reasons) => {
  const scope = asRecord(value);
  if (!scope) {
    pushReason(reasons, "platform_behavior_expected_scope_missing");
  }
  const expectedScope = scope ?? {};
  return {
    profile_ref: asString(expectedScope.profile_ref),
    platform: asString(expectedScope.platform),
    target_domain: asString(expectedScope.target_domain),
    browser_channel: asString(expectedScope.browser_channel),
    execution_surface: asString(expectedScope.execution_surface),
    effective_execution_mode: asString(expectedScope.effective_execution_mode),
    requested_execution_mode: asString(expectedScope.requested_execution_mode),
    probe_bundle_ref: asString(expectedScope.probe_bundle_ref),
    goal_kind: asString(expectedScope.goal_kind)
  };
};

const collectScopeReasons = (assessment, expectedScope) => {
  const reasons = [];
  for (const key of REQUIRED_EXPECTED_SCOPE_KEYS) {
    if (!expectedScope[key]) {
      pushReason(reasons, `platform_behavior_expected_${key}_missing`);
    }
  }
  if (!assessment) {
    return reasons;
  }
  for (const [key, expected] of Object.entries(expectedScope)) {
    if (expected && assessment[key] !== expected) {
      pushReason(reasons, `platform_behavior_${key}_mismatch`);
    }
  }
  return reasons;
};

const collectFreshnessReasons = (assessment, record) => {
  const reasons = [];
  const rawAsOf = record.asOf ?? record.as_of;
  const rawWindowMs = record.freshnessWindowMs ?? record.freshness_window_ms;
  const hasAsOf = hasPresentField(record, "asOf") || hasPresentField(record, "as_of");
  const hasWindowMs =
    hasPresentField(record, "freshnessWindowMs") || hasPresentField(record, "freshness_window_ms");
  const asOf = asIsoTimestamp(rawAsOf);
  const windowMs = asNumber(rawWindowMs);
  if (!hasAsOf) {
    pushReason(reasons, "platform_behavior_as_of_missing");
  } else if (!asOf) {
    pushReason(reasons, "platform_behavior_as_of_invalid");
  }
  if (!hasWindowMs) {
    pushReason(reasons, "platform_behavior_freshness_window_missing");
  } else if (windowMs === null || windowMs < 0) {
    pushReason(reasons, "platform_behavior_freshness_window_invalid");
  }
  if (assessment && asOf && windowMs !== null && windowMs >= 0) {
    const assessedAtMs = Date.parse(assessment.assessed_at);
    const asOfMs = Date.parse(asOf);
    const ageMs = asOfMs - assessedAtMs;
    if (Number.isNaN(assessedAtMs) || Number.isNaN(asOfMs)) {
      pushReason(reasons, "platform_behavior_assessment_stale");
    } else if (ageMs < 0) {
      pushReason(reasons, "platform_behavior_assessment_future_dated");
    } else if (ageMs > windowMs) {
      pushReason(reasons, "platform_behavior_assessment_stale");
    }
  }
  return reasons;
};

const collectDecisionHintReasons = (assessment) => {
  const reasons = [];
  if (!assessment) {
    return reasons;
  }
  if (assessment.reseed_required && !RESEED_DECISION_HINTS.has(assessment.decision_hint)) {
    pushReason(reasons, "platform_behavior_reseed_hint_invalid");
  }
  if (["high", "critical"].includes(assessment.drift_level)) {
    if (!HIGH_DRIFT_DECISION_HINTS.has(assessment.decision_hint)) {
      pushReason(reasons, "platform_behavior_high_drift_hint_invalid");
    }
  }
  if (assessment.goal_kind === "write" && assessment.decision_hint === "allow_read_only") {
    pushReason(reasons, "platform_behavior_read_only_hint_for_write");
  }
  return reasons;
};

const buildBlockedResult = (input) => ({
  required: input.required,
  accepted_risk_hint: false,
  read_write_allow_proof: false,
  account_safety_clearance: false,
  gate_override_proof: false,
  decision: "blocked",
  gate_reasons: input.gateReasons,
  schema_version: PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION,
  target_fr_ref: input.context.target_fr_ref,
  validation_scope: input.context.validation_scope,
  assessment_id: input.assessment?.assessment_id ?? null,
  decision_hint: input.assessment?.decision_hint ?? null,
  baseline_state: input.assessment?.baseline_state ?? null,
  drift_level: input.assessment?.drift_level ?? null,
  reseed_required: input.assessment?.reseed_required ?? false,
  evidence_refs_consumed: input.assessment?.evidence_refs ?? [],
  assessed_at: input.assessment?.assessed_at ?? null
});

const isPlatformBehaviorAssessmentGateRequired = (input = {}) => {
  const record = asRecord(input);
  return record ? isRequired(record) : false;
};

const evaluatePlatformBehaviorAssessmentGate = (input = {}) => {
  const record = asRecord(input) ?? {};
  const required = isRequired(record);
  if (!required) {
    return {
      required: false,
      accepted_risk_hint: false,
      read_write_allow_proof: false,
      account_safety_clearance: false,
      gate_override_proof: false,
      decision: "not_required",
      gate_reasons: [],
      schema_version: PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION,
      target_fr_ref: null,
      validation_scope: null,
      assessment_id: null,
      decision_hint: null,
      baseline_state: null,
      drift_level: null,
      reseed_required: false,
      evidence_refs_consumed: [],
      assessed_at: null
    };
  }

  const gateReasons = [];
  const context = normalizeContext(resolveRawContext(record), gateReasons);
  const assessment = normalizeAssessment(resolveRawAssessment(record), gateReasons);
  const expectedScope = normalizeExpectedScope(resolveExpectedScope(record), gateReasons);
  for (const reason of collectScopeReasons(assessment, expectedScope)) {
    pushReason(gateReasons, reason);
  }
  for (const reason of collectFreshnessReasons(assessment, record)) {
    pushReason(gateReasons, reason);
  }
  const decisionHintReasons = collectDecisionHintReasons(assessment);
  for (const reason of decisionHintReasons) {
    pushReason(gateReasons, reason);
  }
  if (gateReasons.length > 0) {
    return buildBlockedResult({ required, context, assessment, gateReasons });
  }

  return {
    required,
    accepted_risk_hint: true,
    read_write_allow_proof: false,
    account_safety_clearance: false,
    gate_override_proof: false,
    decision: "allow_input_to_provider_runtime_decision",
    gate_reasons: [],
    schema_version: PLATFORM_BEHAVIOR_RISK_HINT_SCHEMA_VERSION,
    target_fr_ref: context.target_fr_ref,
    validation_scope: context.validation_scope,
    assessment_id: assessment.assessment_id,
    decision_hint: assessment.decision_hint,
    baseline_state: assessment.baseline_state,
    drift_level: assessment.drift_level,
    reseed_required: assessment.reseed_required,
    evidence_refs_consumed: assessment.evidence_refs,
    assessed_at: assessment.assessed_at
  };
};
return { evaluatePlatformBehaviorAssessmentGate };
})();
const __webenvoy_module_fingerprint_profile = (() => {
const REQUIRED_PATCHES = [
  "audio_context",
  "battery",
  "navigator_plugins",
  "navigator_mime_types"
];

const OPTIONAL_PATCHES = [
  "hardware_concurrency",
  "device_memory",
  "performance_memory",
  "screen_color_depth",
  "screen_pixel_depth",
  "canvas_noise",
  "permissions_api",
  "navigator_connection"
];

const FIELD_DEPENDENCIES = {
  audio_context: ["audioNoiseSeed"],
  battery: ["battery.level", "battery.charging"],
  navigator_plugins: [],
  navigator_mime_types: [],
  hardware_concurrency: ["hardwareConcurrency"],
  device_memory: ["deviceMemory"],
  performance_memory: ["deviceMemory"],
  screen_color_depth: ["screen.colorDepth"],
  screen_pixel_depth: ["screen.pixelDepth"],
  canvas_noise: ["canvasNoiseSeed"],
  permissions_api: [],
  navigator_connection: []
};

const LIVE_EXECUTION_MODES = new Set([
  "live_read_limited",
  "live_read_high_risk",
  "live_write"
]);

const DEFAULT_PLUGIN_DESCRIPTORS = [
  {
    name: "Chrome PDF Viewer",
    filename: "internal-pdf-viewer",
    description: "Portable Document Format"
  },
  {
    name: "Chromium PDF Viewer",
    filename: "internal-pdf-viewer",
    description: "Portable Document Format"
  },
  {
    name: "Microsoft Edge PDF Viewer",
    filename: "internal-pdf-viewer",
    description: "Portable Document Format"
  },
  {
    name: "PDF Viewer",
    filename: "internal-pdf-viewer",
    description: "Portable Document Format"
  }
];

const DEFAULT_MIME_TYPE_DESCRIPTORS = [
  {
    type: "application/pdf",
    suffixes: "pdf",
    description: "Portable Document Format",
    enabledPlugin: "Chrome PDF Viewer"
  },
  {
    type: "text/pdf",
    suffixes: "pdf",
    description: "Portable Document Format",
    enabledPlugin: "Chrome PDF Viewer"
  }
];

const SCREEN_CANDIDATES = [
  { width: 1440, height: 900, colorDepth: 30, pixelDepth: 30 },
  { width: 1512, height: 982, colorDepth: 24, pixelDepth: 24 },
  { width: 1680, height: 1050, colorDepth: 24, pixelDepth: 24 },
  { width: 1728, height: 1117, colorDepth: 30, pixelDepth: 30 },
  { width: 1920, height: 1080, colorDepth: 24, pixelDepth: 24 }
];

const DEVICE_MEMORY_CANDIDATES = [4, 8, 16];

const isObjectRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizePlatform = (platform) => {
  if (platform === "darwin") {
    return "macos";
  }
  if (platform === "win32") {
    return "windows";
  }
  if (platform === "linux") {
    return "linux";
  }
  return typeof platform === "string" && platform.length > 0 ? platform : "unknown";
};

const normalizeArch = (arch) => {
  if (arch === "x64") {
    return "x64";
  }
  if (arch === "arm64") {
    return "arm64";
  }
  return typeof arch === "string" && arch.length > 0 ? arch : "unknown";
};

const normalizeOsVersion = (osFamily, rawVersion) => {
  if (typeof rawVersion !== "string" || rawVersion.length === 0) {
    return "unknown";
  }

  if (osFamily !== "macos") {
    return rawVersion;
  }

  const matched = rawVersion.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!matched) {
    return rawVersion;
  }

  const darwinMajor = Number.parseInt(matched[1], 10);
  if (!Number.isInteger(darwinMajor)) {
    return rawVersion;
  }

  // `os.release()` on macOS returns Darwin kernel versions (for example: 24.4.0),
  // while browser UA must use macOS product versions.
  if (darwinMajor >= 20) {
    return `${darwinMajor - 9}.0`;
  }
  if (darwinMajor >= 4 && darwinMajor <= 19) {
    return `10.${darwinMajor - 4}`;
  }

  return rawVersion;
};

const hashString = (value) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const stableUnit = (seed) => hashString(seed) / 0xffffffff;

const roundNumber = (value, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const selectBySeed = (seed, candidates) => candidates[hashString(seed) % candidates.length];

const extractChromeVersion = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const uaMatch = value.match(/\b(?:Chrome|Chromium)\/(\d+\.\d+\.\d+\.\d+)\b/i);
  if (uaMatch) {
    return uaMatch[1];
  }

  const binaryVersionMatch = value.match(
    /\b(?:Google Chrome|Chrome for Testing|Chromium)\s+(\d+\.\d+\.\d+\.\d+)\b/i
  );
  if (binaryVersionMatch) {
    return binaryVersionMatch[1];
  }

  return null;
};

const resolveChromeVersion = (input) => {
  const explicitVersion = extractChromeVersion(input.browserVersion);
  if (explicitVersion) {
    return explicitVersion;
  }

  if (typeof navigator !== "undefined" && typeof navigator.userAgent === "string") {
    const fromNavigator = extractChromeVersion(navigator.userAgent);
    if (fromNavigator) {
      return fromNavigator;
    }
  }

  return null;
};

const buildDefaultUserAgent = (environment, input) => {
  const archToken = environment.arch === "arm64" ? "ARM 64" : "Win64; x64";
  const linuxArchToken = environment.arch === "arm64" ? "arm64" : "x86_64";
  const chromeVersion = resolveChromeVersion(input) ?? "0.0.0.0";

  if (environment.os_family === "macos") {
    const version = String(environment.os_version ?? "14_0").replace(/\./g, "_");
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${version}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  }

  if (environment.os_family === "windows") {
    return `Mozilla/5.0 (Windows NT 10.0; ${archToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  }

  return `Mozilla/5.0 (X11; Linux ${linuxArchToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
};

const isLikelyLinuxKernelVersion = (value) =>
  typeof value === "string" &&
  /^\d+\.\d+\.\d+/.test(value);

const harmonizeExistingBundleEnvironment = (bundle, actualEnvironment) => {
  const cloned = cloneJson(bundle);
  if (!isEnvironment(cloned.environment)) {
    return cloned;
  }

  const actualOsFamily = normalizePlatform(actualEnvironment?.os_family);
  const actualOsVersion = normalizeOsVersion(actualOsFamily, actualEnvironment?.os_version ?? "unknown");
  if (
    actualOsFamily === "linux" &&
    cloned.environment.os_family === "linux" &&
    isLikelyLinuxKernelVersion(cloned.environment.os_version) &&
    actualOsVersion !== "unknown" &&
    cloned.environment.os_version !== actualOsVersion
  ) {
    cloned.environment = {
      ...cloned.environment,
      os_version: actualOsVersion
    };
  }

  return cloned;
};

const readPath = (target, path) => {
  const segments = path.split(".");
  let current = target;
  for (const segment of segments) {
    if (!isObjectRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const isEnvironment = (value) =>
  isObjectRecord(value) &&
  typeof value.os_family === "string" &&
  typeof value.os_version === "string" &&
  typeof value.arch === "string";

const isScreen = (value) =>
  isObjectRecord(value) &&
  Number.isInteger(value.width) &&
  Number.isInteger(value.height) &&
  Number.isInteger(value.colorDepth) &&
  Number.isInteger(value.pixelDepth);

const isBattery = (value) =>
  isObjectRecord(value) &&
  typeof value.charging === "boolean" &&
  typeof value.level === "number" &&
  Number.isFinite(value.level) &&
  value.level >= 0 &&
  value.level <= 1;

const isLegacyMigration = (value) =>
  isObjectRecord(value) &&
  value.status === "backfilled_from_legacy" &&
  typeof value.migrated_at === "string" &&
  value.migrated_at.length > 0 &&
  Number.isInteger(value.source_schema_version) &&
  Array.isArray(value.reason_codes) &&
  value.reason_codes.every((code) => typeof code === "string");

const isFingerprintProfileBundle = (value) =>
  isObjectRecord(value) &&
  typeof value.ua === "string" &&
  Number.isInteger(value.hardwareConcurrency) &&
  Number.isInteger(value.deviceMemory) &&
  isScreen(value.screen) &&
  isBattery(value.battery) &&
  typeof value.timezone === "string" &&
  typeof value.audioNoiseSeed === "number" &&
  Number.isFinite(value.audioNoiseSeed) &&
  typeof value.canvasNoiseSeed === "number" &&
  Number.isFinite(value.canvasNoiseSeed) &&
  isEnvironment(value.environment) &&
  (value.legacy_migration === undefined || isLegacyMigration(value.legacy_migration));

const isPatchManifest = (value) =>
  isObjectRecord(value) &&
  typeof value.profile === "string" &&
  typeof value.manifest_version === "string" &&
  Array.isArray(value.required_patches) &&
  Array.isArray(value.optional_patches) &&
  isObjectRecord(value.field_dependencies) &&
  Array.isArray(value.unsupported_reason_codes);

const isConsistencyCheck = (value) =>
  isObjectRecord(value) &&
  typeof value.profile === "string" &&
  isEnvironment(value.expected_environment) &&
  isEnvironment(value.actual_environment) &&
  (value.decision === "match" || value.decision === "mismatch") &&
  Array.isArray(value.reason_codes);

const isRuntimeContext = (value) =>
  isObjectRecord(value) &&
  typeof value.profile === "string" &&
  (value.source === "profile_meta" || value.source === "profile_missing") &&
  (value.fingerprint_profile_bundle === null || isFingerprintProfileBundle(value.fingerprint_profile_bundle)) &&
  (value.fingerprint_patch_manifest === null || isPatchManifest(value.fingerprint_patch_manifest)) &&
  isConsistencyCheck(value.fingerprint_consistency_check) &&
  isObjectRecord(value.execution) &&
  typeof value.execution.live_allowed === "boolean" &&
  (value.execution.live_decision === "allowed" || value.execution.live_decision === "dry_run_only") &&
  Array.isArray(value.execution.allowed_execution_modes) &&
  value.execution.allowed_execution_modes.every((mode) => typeof mode === "string") &&
  Array.isArray(value.execution.reason_codes) &&
  value.execution.reason_codes.every((code) => typeof code === "string");

const buildIncompleteFingerprintRuntimeContext = (input) => {
  const reasonCode = input.reasonCode;
  const actualOsFamily = normalizePlatform(input.actualEnvironment?.os_family);
  return {
    profile: input.profile,
    source: input.metaPresent ? "profile_meta" : "profile_missing",
    fingerprint_profile_bundle: null,
    fingerprint_patch_manifest: null,
    fingerprint_consistency_check: {
      profile: input.profile,
      expected_environment: {
        os_family: "unknown",
        os_version: "unknown",
        arch: "unknown"
      },
      actual_environment: {
        os_family: actualOsFamily,
        os_version: normalizeOsVersion(actualOsFamily, input.actualEnvironment?.os_version ?? "unknown"),
        arch: normalizeArch(input.actualEnvironment?.arch)
      },
      decision: "mismatch",
      reason_codes: [reasonCode]
    },
    execution: {
      live_allowed: false,
      live_decision: "dry_run_only",
      allowed_execution_modes: ["dry_run", "recon"],
      reason_codes: [reasonCode]
    }
  };
};

const buildFingerprintProfileBundle = (input) => {
  const osFamily = normalizePlatform(input.environment?.os_family);
  const environment = {
    os_family: osFamily,
    os_version: normalizeOsVersion(osFamily, input.environment?.os_version ?? "unknown"),
    arch: normalizeArch(input.environment?.arch)
  };

  const profileName = typeof input.profileName === "string" ? input.profileName : "default";
  const fingerprintSeeds = isObjectRecord(input.fingerprintSeeds) ? input.fingerprintSeeds : {};
  const audioSeedSource =
    typeof fingerprintSeeds.audioNoiseSeed === "string"
      ? fingerprintSeeds.audioNoiseSeed
      : `${profileName}-audio-seed`;
  const canvasSeedSource =
    typeof fingerprintSeeds.canvasNoiseSeed === "string"
      ? fingerprintSeeds.canvasNoiseSeed
      : `${profileName}-canvas-seed`;

  if (isFingerprintProfileBundle(input.existingBundle)) {
    return harmonizeExistingBundleEnvironment(input.existingBundle, input.environment);
  }

  const screen = selectBySeed(`${profileName}:screen`, SCREEN_CANDIDATES);
  const deviceMemory = selectBySeed(`${profileName}:device-memory`, DEVICE_MEMORY_CANDIDATES);
  const hardwareConcurrency =
    deviceMemory >= 16
      ? selectBySeed(`${profileName}:hardware`, [8, 10, 12])
      : deviceMemory >= 8
        ? selectBySeed(`${profileName}:hardware`, [8, 10])
        : selectBySeed(`${profileName}:hardware`, [4, 8]);

  return {
    ua:
      typeof input.ua === "string" && input.ua.length > 0
        ? input.ua
        : buildDefaultUserAgent(environment, input),
    hardwareConcurrency,
    deviceMemory,
    screen: cloneJson(screen),
    battery: {
      level: roundNumber(0.52 + stableUnit(`${profileName}:battery-level`) * 0.39, 4),
      charging: stableUnit(`${profileName}:battery-charging`) >= 0.5
    },
    timezone:
      typeof input.timezone === "string" && input.timezone.length > 0 ? input.timezone : "UTC",
    audioNoiseSeed: roundNumber(stableUnit(audioSeedSource) / 1_000, 9),
    canvasNoiseSeed: roundNumber(stableUnit(canvasSeedSource) / 1_000, 9),
    environment
  };
};

const markFingerprintProfileBundleAsLegacyBackfilled = (input) => {
  const bundle = buildFingerprintProfileBundle(input);
  const sourceSchemaVersion =
    Number.isInteger(input.sourceSchemaVersion) && input.sourceSchemaVersion > 0
      ? input.sourceSchemaVersion
      : 1;
  const reasonCodes =
    Array.isArray(input.reasonCodes) && input.reasonCodes.every((code) => typeof code === "string")
      ? [...new Set(input.reasonCodes)]
      : ["LEGACY_PROFILE_BUNDLE_MIGRATED"];
  return {
    ...bundle,
    legacy_migration: {
      status: "backfilled_from_legacy",
      migrated_at:
        typeof input.migratedAt === "string" && input.migratedAt.length > 0
          ? input.migratedAt
          : new Date().toISOString(),
      source_schema_version: sourceSchemaVersion,
      reason_codes: reasonCodes
    }
  };
};

const buildFingerprintPatchManifest = (input) => {
  const bundle = input.bundle;
  const unsupportedReasonCodes = [];

  for (const patchName of REQUIRED_PATCHES) {
    const dependencies = FIELD_DEPENDENCIES[patchName] ?? [];
    const missing = dependencies.filter((path) => readPath(bundle, path) === undefined);
    if (missing.length > 0) {
      unsupportedReasonCodes.push("PROFILE_FIELD_MISSING");
      break;
    }
  }

  if (isLegacyMigration(bundle.legacy_migration)) {
    unsupportedReasonCodes.push(...bundle.legacy_migration.reason_codes);
  }

  return {
    profile: input.profile,
    manifest_version: "1",
    required_patches: [...REQUIRED_PATCHES],
    optional_patches: [...OPTIONAL_PATCHES],
    field_dependencies: cloneJson(FIELD_DEPENDENCIES),
    unsupported_reason_codes: unsupportedReasonCodes
  };
};

const buildFingerprintConsistencyCheck = (input) => {
  const expected =
    input.bundle && isEnvironment(input.bundle.environment)
      ? input.bundle.environment
      : {
          os_family: "unknown",
          os_version: "unknown",
          arch: "unknown"
        };
  const actualOsFamily = normalizePlatform(input.actualEnvironment?.os_family);
  const actual = {
    os_family: actualOsFamily,
    os_version: normalizeOsVersion(actualOsFamily, input.actualEnvironment?.os_version ?? "unknown"),
    arch: normalizeArch(input.actualEnvironment?.arch)
  };
  const reasonCodes = [];

  if (!input.bundle) {
    reasonCodes.push("PROFILE_META_MISSING");
  } else {
    if (expected.os_family !== actual.os_family) {
      reasonCodes.push("OS_FAMILY_MISMATCH");
    }
    if (expected.os_version !== actual.os_version) {
      reasonCodes.push("OS_VERSION_MISMATCH");
    }
    if (expected.arch !== actual.arch) {
      reasonCodes.push("ARCH_MISMATCH");
    }
  }

  return {
    profile: input.profile,
    expected_environment: expected,
    actual_environment: actual,
    decision: reasonCodes.length === 0 ? "match" : "mismatch",
    reason_codes: reasonCodes
  };
};

const buildFingerprintRuntimeContext = (input) => {
  const profile = typeof input.profile === "string" ? input.profile : "unknown";

  if (!input.metaPresent) {
    return buildIncompleteFingerprintRuntimeContext({
      profile,
      metaPresent: false,
      actualEnvironment: input.actualEnvironment,
      reasonCode: "PROFILE_META_MISSING"
    });
  }

  if (!isFingerprintProfileBundle(input.existingBundle)) {
    return buildIncompleteFingerprintRuntimeContext({
      profile,
      metaPresent: true,
      actualEnvironment: input.actualEnvironment,
      reasonCode: "PROFILE_FIELD_MISSING"
    });
  }

  const bundle = buildFingerprintProfileBundle({
    ...input,
    existingBundle: input.existingBundle,
    environment: input.actualEnvironment
  });
  const manifest = buildFingerprintPatchManifest({
    profile,
    bundle
  });
  const consistencyCheck = buildFingerprintConsistencyCheck({
    profile,
    bundle,
    actualEnvironment: input.actualEnvironment
  });
  const reasonCodes = [
    ...manifest.unsupported_reason_codes,
    ...consistencyCheck.reason_codes
  ];
  const liveAllowed = reasonCodes.length === 0;
  const requestedExecutionMode =
    typeof input.requestedExecutionMode === "string" ? input.requestedExecutionMode : null;
  const requestedLiveMode =
    requestedExecutionMode !== null && LIVE_EXECUTION_MODES.has(requestedExecutionMode);

  return {
    profile,
    source: "profile_meta",
    fingerprint_profile_bundle: bundle,
    fingerprint_patch_manifest: manifest,
    fingerprint_consistency_check: consistencyCheck,
    execution: {
      live_allowed: liveAllowed,
      live_decision:
        liveAllowed || !requestedLiveMode ? "allowed" : "dry_run_only",
      allowed_execution_modes: liveAllowed
        ? ["dry_run", "recon", "live_read_limited", "live_read_high_risk", "live_write"]
        : ["dry_run", "recon"],
      reason_codes: reasonCodes
    }
  };
};

const ensureFingerprintRuntimeContext = (value) => {
  if (!isRuntimeContext(value)) {
    return null;
  }
  return cloneJson(value);
};
return { DEFAULT_MIME_TYPE_DESCRIPTORS, DEFAULT_PLUGIN_DESCRIPTORS, ensureFingerprintRuntimeContext };
})();
const __webenvoy_module_issue209_admission = (() => {
const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const asString = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const cloneIssue209AdmissionContext = (value) => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const approvalEvidence = asRecord(record.approval_admission_evidence);
  const auditEvidence = asRecord(record.audit_admission_evidence);

  return {
    ...(approvalEvidence ? { approval_admission_evidence: structuredClone(approvalEvidence) } : {}),
    ...(auditEvidence ? { audit_admission_evidence: structuredClone(auditEvidence) } : {})
  };
};

const normalizeIssue209AdmissionDraft = (value) => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const kind = asString(record.kind);
  if (kind === "missing") {
    return { kind };
  }

  if (kind !== "draft" && kind !== "explicit_context" && kind !== "derived_draft") {
    return null;
  }

  const admissionContext = cloneIssue209AdmissionContext(record.admission_context);
  if (!admissionContext) {
    return null;
  }

  return {
    kind: "draft",
    admission_context: admissionContext
  };
};

const createIssue209AdmissionDraft = (input) => {
  const explicitContext = cloneIssue209AdmissionContext(input?.admissionContext);
  if (explicitContext) {
    return {
      kind: "draft",
      admission_context: explicitContext
    };
  }

  return normalizeIssue209AdmissionDraft(input?.admissionDraft) ?? { kind: "missing" };
};

const bindAdmissionEvidenceToSession = (value, sessionId) => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return {
    ...structuredClone(record),
    session_id: sessionId
  };
};

const bindIssue209AdmissionToSession = (input) => {
  const draft = createIssue209AdmissionDraft(input);
  if (draft.kind === "missing") {
    return null;
  }

  const admissionContext = cloneIssue209AdmissionContext(draft.admission_context);
  if (!admissionContext) {
    return null;
  }

  const sessionId = asString(input?.sessionId);
  if (!sessionId) {
    return admissionContext;
  }

  const approvalEvidence = bindAdmissionEvidenceToSession(
    admissionContext.approval_admission_evidence,
    sessionId
  );
  const auditEvidence = bindAdmissionEvidenceToSession(
    admissionContext.audit_admission_evidence,
    sessionId
  );

  return {
    ...(approvalEvidence ? { approval_admission_evidence: approvalEvidence } : {}),
    ...(auditEvidence ? { audit_admission_evidence: auditEvidence } : {})
  };
};
return { cloneIssue209AdmissionContext, createIssue209AdmissionDraft, bindIssue209AdmissionToSession };
})();
const __webenvoy_module_issue209_identity = (() => {
const ISSUE209_LIVE_READ_EXECUTION_MODES = new Set([
  "live_read_limited",
  "live_read_high_risk"
]);

const asString = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asInteger = (value) => (typeof value === "number" && Number.isInteger(value) ? value : null);

const isIssue209LiveReadMode = (value) => ISSUE209_LIVE_READ_EXECUTION_MODES.has(asString(value));

const isIssue209LiveReadGateRequest = (input) =>
  asString(input?.issueScope) === "issue_209" && isIssue209LiveReadMode(input?.requestedExecutionMode);

const resolveIssue209LiveReadDecisionId = (input) => {
  const explicitDecisionId = asString(input?.decisionId);
  if (explicitDecisionId) {
    return explicitDecisionId;
  }

  const gateInvocationId = asString(input?.gateInvocationId);
  if (gateInvocationId) {
    return `gate_decision_${gateInvocationId}`;
  }

  throw new Error("issue_209 live-read requires gate_invocation_id");
};

const resolveIssue209LiveReadApprovalId = (input) => {
  return `gate_appr_${resolveIssue209LiveReadDecisionId(input)}`;
};

const prepareIssue209LiveReadIdentity = (input) => {
  if (!isIssue209LiveReadGateRequest(input)) {
    return null;
  }

  const decisionId = resolveIssue209LiveReadDecisionId(input);

  return {
    commandRequestId: asString(input?.commandRequestId) ?? asString(input?.requestId),
    gateInvocationId: asString(input?.gateInvocationId),
    runId: asString(input?.runId),
    sessionId: asString(input?.sessionId),
    issueScope: "issue_209",
    targetDomain: asString(input?.targetDomain),
    targetTabId: asInteger(input?.targetTabId),
    targetPage: asString(input?.targetPage),
    actionType: asString(input?.actionType),
    requestedExecutionMode: asString(input?.requestedExecutionMode),
    riskState: asString(input?.riskState),
    decisionId,
    approvalId: resolveIssue209LiveReadApprovalId({
      decisionId,
      gateInvocationId: asString(input?.gateInvocationId)
    })
  };
};
return { ISSUE209_LIVE_READ_EXECUTION_MODES, isIssue209LiveReadMode, isIssue209LiveReadGateRequest, prepareIssue209LiveReadIdentity, resolveIssue209LiveReadDecisionId, resolveIssue209LiveReadApprovalId };
})();
const __webenvoy_module_issue209_source = (() => {
const { APPROVAL_CHECK_KEYS } = __webenvoy_module_risk_state;
const {
  resolveIssue209LiveReadApprovalId,
  resolveIssue209LiveReadDecisionId
} = __webenvoy_module_issue209_identity;
const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const asString = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asInteger = (value) => (typeof value === "number" && Number.isInteger(value) ? value : null);

const asBoolean = (value) => value === true;

const cloneIssue209AdmissionContext = (value) => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const approvalEvidence = asRecord(record.approval_admission_evidence);
  const auditEvidence = asRecord(record.audit_admission_evidence);

  return {
    ...(approvalEvidence ? { approval_admission_evidence: structuredClone(approvalEvidence) } : {}),
    ...(auditEvidence ? { audit_admission_evidence: structuredClone(auditEvidence) } : {})
  };
};

const normalizeChecks = (value) => {
  const record = asRecord(value);
  return Object.fromEntries(APPROVAL_CHECK_KEYS.map((key) => [key, asBoolean(record?.[key])]));
};

const hasAllTrueChecks = (value) =>
  APPROVAL_CHECK_KEYS.every((key) => value?.[key] === true);

const normalizeApprovalAdmissionEvidence = (value) => {
  const record = asRecord(value);
  return {
    approval_admission_ref: asString(record?.approval_admission_ref),
    decision_id: asString(record?.decision_id),
    approval_id: asString(record?.approval_id),
    request_id: asString(record?.request_id),
    run_id: asString(record?.run_id),
    session_id: asString(record?.session_id),
    issue_scope: asString(record?.issue_scope),
    target_domain: asString(record?.target_domain),
    target_tab_id: asInteger(record?.target_tab_id),
    target_page: asString(record?.target_page),
    action_type: asString(record?.action_type),
    requested_execution_mode: asString(record?.requested_execution_mode),
    approved: asBoolean(record?.approved),
    approver: asString(record?.approver),
    approved_at: asString(record?.approved_at),
    checks: normalizeChecks(record?.checks),
    recorded_at: asString(record?.recorded_at)
  };
};

const normalizeAuditAdmissionEvidence = (value) => {
  const record = asRecord(value);
  return {
    audit_admission_ref: asString(record?.audit_admission_ref),
    decision_id: asString(record?.decision_id),
    approval_id: asString(record?.approval_id),
    request_id: asString(record?.request_id),
    run_id: asString(record?.run_id),
    session_id: asString(record?.session_id),
    issue_scope: asString(record?.issue_scope),
    target_domain: asString(record?.target_domain),
    target_tab_id: asInteger(record?.target_tab_id),
    target_page: asString(record?.target_page),
    action_type: asString(record?.action_type),
    requested_execution_mode: asString(record?.requested_execution_mode),
    risk_state: asString(record?.risk_state),
    audited_checks: normalizeChecks(record?.audited_checks),
    recorded_at: asString(record?.recorded_at)
  };
};

const resolveConsumedIssue209AdmissionEvidence = (value) => {
  const admissionContext = cloneIssue209AdmissionContext(value);
  const approvalEvidence = normalizeApprovalAdmissionEvidence(
    admissionContext?.approval_admission_evidence
  );
  const auditEvidence = normalizeAuditAdmissionEvidence(
    admissionContext?.audit_admission_evidence
  );

  const approvalAdmissionRef =
    approvalEvidence.approval_admission_ref &&
    approvalEvidence.recorded_at &&
    approvalEvidence.approved === true &&
    approvalEvidence.approver &&
    approvalEvidence.approved_at &&
    hasAllTrueChecks(approvalEvidence.checks)
      ? approvalEvidence.approval_admission_ref
      : null;
  const auditAdmissionRef =
    auditEvidence.audit_admission_ref &&
    auditEvidence.recorded_at &&
    hasAllTrueChecks(auditEvidence.audited_checks)
      ? auditEvidence.audit_admission_ref
      : null;

  return {
    approvalEvidence,
    auditEvidence,
    approvalAdmissionRef,
    auditAdmissionRef
  };
};

const normalizeProvidedApprovalSource = (value) => {
  const record = asRecord(value);
  return {
    decision_id: asString(record?.decision_id),
    approval_id: asString(record?.approval_id),
    approved: asBoolean(record?.approved),
    approver: asString(record?.approver),
    approved_at: asString(record?.approved_at),
    checks: normalizeChecks(record?.checks)
  };
};

const normalizeProvidedAuditSource = (value) => {
  const record = asRecord(value);
  return {
    event_id: asString(record?.event_id),
    decision_id: asString(record?.decision_id),
    approval_id: asString(record?.approval_id),
    request_id: asString(record?.request_id),
    issue_scope: asString(record?.issue_scope),
    target_domain: asString(record?.target_domain),
    target_tab_id: asInteger(record?.target_tab_id),
    target_page: asString(record?.target_page),
    action_type: asString(record?.action_type),
    requested_execution_mode: asString(record?.requested_execution_mode),
    risk_state: asString(record?.risk_state),
    gate_decision: asString(record?.gate_decision),
    audited_checks: normalizeChecks(record?.audited_checks),
    recorded_at: asString(record?.recorded_at)
  };
};

const prepareIssue209LiveReadSource = (input) => {
  const decisionId = resolveIssue209LiveReadDecisionId({
    gateInvocationId: input?.gateInvocationId
  });
  const approvalId = resolveIssue209LiveReadApprovalId({
    decisionId
  });
  const explicitAdmissionContext = cloneIssue209AdmissionContext(input?.admissionContext);

  return {
    current: {
      commandRequestId: asString(input?.commandRequestId),
      gateInvocationId: asString(input?.gateInvocationId),
      runId: asString(input?.runId),
      issueScope: "issue_209",
      targetDomain: asString(input?.targetDomain),
      targetTabId: asInteger(input?.targetTabId),
      targetPage: asString(input?.targetPage),
      actionType: asString(input?.actionType),
      requestedExecutionMode: asString(input?.requestedExecutionMode),
      riskState: asString(input?.riskState),
      decisionId,
      approvalId
    },
    explicitAdmissionContext,
    explicitApprovalEvidence: normalizeApprovalAdmissionEvidence(
      explicitAdmissionContext?.approval_admission_evidence
    ),
    explicitAuditEvidence: normalizeAuditAdmissionEvidence(
      explicitAdmissionContext?.audit_admission_evidence
    ),
    approvalSource: normalizeProvidedApprovalSource(input?.approvalRecord),
    auditSource: normalizeProvidedAuditSource(input?.auditRecord)
  };
};
return { APPROVAL_CHECK_KEYS, cloneIssue209AdmissionContext, normalizeApprovalAdmissionEvidence, normalizeAuditAdmissionEvidence, resolveConsumedIssue209AdmissionEvidence, normalizeProvidedApprovalSource, normalizeProvidedAuditSource, prepareIssue209LiveReadSource };
})();
const __webenvoy_module_issue209_source_validation = (() => {
const { APPROVAL_CHECK_KEYS } = __webenvoy_module_risk_state;
const {
  normalizeProvidedApprovalSource,
  normalizeProvidedAuditSource
} = __webenvoy_module_issue209_source;
const hasOwnNonNullValue = (record, key) =>
  Object.prototype.hasOwnProperty.call(record, key) && record[key] !== null;

const cloneChecks = (checks) =>
  Object.fromEntries(APPROVAL_CHECK_KEYS.map((key) => [key, checks?.[key] === true]));

const hasAllTrueChecks = (checks) => APPROVAL_CHECK_KEYS.every((key) => checks?.[key] === true);

const validateIssue209ApprovalSourceAgainstCurrentLinkage = (input) => {
  const current = input?.current ?? {};
  const approvalSource = normalizeProvidedApprovalSource(
    input?.approvalSource ?? input?.approvalRecord
  );
  const approvalRequirementGaps = [];
  const carriesDecisionId = hasOwnNonNullValue(approvalSource, "decision_id");
  const carriesApprovalId = hasOwnNonNullValue(approvalSource, "approval_id");

  if (approvalSource.approved !== true) {
    approvalRequirementGaps.push("approval_record_approved_true");
  }
  if (!approvalSource.approver) {
    approvalRequirementGaps.push("approval_record_approver_present");
  }
  if (!approvalSource.approved_at) {
    approvalRequirementGaps.push("approval_record_approved_at_present");
  }
  if (!hasAllTrueChecks(approvalSource.checks)) {
    approvalRequirementGaps.push("approval_record_checks_all_true");
  }

  if (carriesDecisionId !== carriesApprovalId) {
    approvalRequirementGaps.push("approval_record_linkage_invalid");
  } else if (
    carriesDecisionId &&
    carriesApprovalId &&
    (approvalSource.decision_id !== current.decisionId ||
      approvalSource.approval_id !== current.approvalId)
  ) {
    approvalRequirementGaps.push("approval_record_linkage_invalid");
  }

  return {
    approvalSource,
    approvalRecord: {
      approval_id: current.approvalId ?? null,
      decision_id: current.decisionId ?? null,
      approved: approvalSource.approved,
      approver: approvalSource.approver,
      approved_at: approvalSource.approved_at,
      checks: cloneChecks(approvalSource.checks)
    },
    approvalRequirementGaps,
    isValid: approvalRequirementGaps.length === 0
  };
};

const validateIssue209AuditSourceAgainstCurrentLinkage = (input) => {
  const current = input?.current ?? {};
  const requestIdWasExplicit = input?.requestIdWasExplicit === true;
  const auditSource = normalizeProvidedAuditSource(input?.auditSource ?? input?.auditRecord);
  const auditRequirementGaps = [];
  const carriesDecisionId = hasOwnNonNullValue(auditSource, "decision_id");
  const carriesApprovalId = hasOwnNonNullValue(auditSource, "approval_id");

  if (!auditSource.event_id) {
    auditRequirementGaps.push("audit_record_event_id_present");
  }
  if (!auditSource.recorded_at) {
    auditRequirementGaps.push("audit_record_recorded_at_present");
  }
  if (auditSource.gate_decision !== "allowed") {
    auditRequirementGaps.push("audit_record_gate_decision_allowed");
  }
  if (!hasAllTrueChecks(auditSource.audited_checks)) {
    auditRequirementGaps.push("audit_record_checks_all_true");
  }
  if (carriesDecisionId !== true || carriesApprovalId !== true) {
    auditRequirementGaps.push("audit_record_linkage_invalid");
  } else if (
    auditSource.decision_id !== current.decisionId ||
    auditSource.approval_id !== current.approvalId
  ) {
    auditRequirementGaps.push("audit_record_linkage_invalid");
  }

  if (auditSource.issue_scope !== current.issueScope) {
    auditRequirementGaps.push("audit_record_issue_scope_match");
  }
  if (auditSource.target_domain !== current.targetDomain) {
    auditRequirementGaps.push("audit_record_target_domain_match");
  }
  if (auditSource.target_tab_id !== current.targetTabId) {
    auditRequirementGaps.push("audit_record_target_tab_id_match");
  }
  if (auditSource.target_page !== current.targetPage) {
    auditRequirementGaps.push("audit_record_target_page_match");
  }
  if (auditSource.action_type !== current.actionType) {
    auditRequirementGaps.push("audit_record_action_type_match");
  }
  if (auditSource.requested_execution_mode !== current.requestedExecutionMode) {
    auditRequirementGaps.push("audit_record_requested_execution_mode_match");
  }
  if (auditSource.risk_state !== current.riskState) {
    auditRequirementGaps.push("audit_record_risk_state_match");
  }
  if (
    requestIdWasExplicit &&
    current.commandRequestId &&
    auditSource.request_id &&
    auditSource.request_id !== current.commandRequestId
  ) {
    auditRequirementGaps.push("audit_record_request_id_match");
  }

  return {
    auditSource,
    auditRecord: {
      event_id: auditSource.event_id,
      decision_id: current.decisionId ?? null,
      approval_id: current.approvalId ?? null,
      request_id: auditSource.request_id ?? null,
      issue_scope: current.issueScope ?? null,
      target_domain: current.targetDomain ?? null,
      target_tab_id: current.targetTabId ?? null,
      target_page: current.targetPage ?? null,
      action_type: current.actionType ?? null,
      requested_execution_mode: current.requestedExecutionMode ?? null,
      risk_state: current.riskState ?? null,
      gate_decision: auditSource.gate_decision,
      audited_checks: cloneChecks(auditSource.audited_checks),
      recorded_at: auditSource.recorded_at
    },
    auditRequirementGaps,
    isValid: auditRequirementGaps.length === 0
  };
};
return { validateIssue209ApprovalSourceAgainstCurrentLinkage, validateIssue209AuditSourceAgainstCurrentLinkage };
})();
const __webenvoy_module_issue209_gate = (() => {
const { APPROVAL_CHECK_KEYS } = __webenvoy_module_risk_state;
const { cloneIssue209AdmissionContext } = __webenvoy_module_issue209_admission;
const { normalizeProvidedApprovalSource } = __webenvoy_module_issue209_source;
const {
  validateIssue209ApprovalSourceAgainstCurrentLinkage,
  validateIssue209AuditSourceAgainstCurrentLinkage
} = __webenvoy_module_issue209_source_validation;
const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const asString = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asInteger = (value) => (typeof value === "number" && Number.isInteger(value) ? value : null);

const asBoolean = (value) => value === true;

const hasOwnNonNullValue = (record, key) =>
  Object.prototype.hasOwnProperty.call(record, key) && record[key] !== null;

const asStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return normalized.length === value.length ? normalized : [];
};

const pushReason = (target, reason) => {
  if (!target.includes(reason)) {
    target.push(reason);
  }
};

const hasExplicitAdmissionEvidence = (admissionContext) => {
  const approvalEvidence = asRecord(admissionContext?.approval_admission_evidence);
  const auditEvidence = asRecord(admissionContext?.audit_admission_evidence);

  const hasMeaningfulEvidence = (record) => {
    if (!record) {
      return false;
    }
    return Object.values(record).some((value) => {
      if (value === true) {
        return true;
      }
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      if (typeof value === "number") {
        return true;
      }
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return Object.values(value).some((nested) => nested === true);
      }
      return false;
    });
  };

  return hasMeaningfulEvidence(approvalEvidence) || hasMeaningfulEvidence(auditEvidence);
};

const resolveCanonicalGrantApprovedAt = (input) =>
  asString(input.state?.upstreamAuthorizationRequest?.authorization_grant?.granted_at) ??
  asString(input.state?.upstreamAuthorizationRequest?.action_request?.requested_at);

const projectRiskStateFromGrantSnapshot = (value) => {
  const normalized = asString(value);
  if (normalized === "active") {
    return "allowed";
  }
  if (normalized === "cool_down") {
    return "limited";
  }
  if (normalized === "paused") {
    return "paused";
  }
  return null;
};

const hasCanonicalGrantBackedAdmission = (input, liveRequirements) => {
  const upstream = asRecord(input.state?.upstreamAuthorizationRequest);
  const actionRequest = asRecord(upstream?.action_request);
  const resourceBinding = asRecord(upstream?.resource_binding);
  const authorizationGrant = asRecord(upstream?.authorization_grant);
  const runtimeTarget = asRecord(upstream?.runtime_target);
  const actionRequestRef = asString(actionRequest?.request_ref);
  const resourceBindingRef = asString(resourceBinding?.binding_ref);
  const authorizationGrantRef = asString(authorizationGrant?.grant_ref);
  const runtimeTargetRef = asString(runtimeTarget?.target_ref);
  const approvalRefs = asStringArray(authorizationGrant?.approval_refs);
  const auditRefs = asStringArray(authorizationGrant?.audit_refs);
  const grantActionName = asString(actionRequest?.action_name);
  const grantActionType = asString(actionRequest?.action_category);
  const grantResourceKind = asString(resourceBinding?.resource_kind);
  const grantProfileRef = asString(resourceBinding?.profile_ref);
  const grantBindingConstraints = asRecord(resourceBinding?.binding_constraints);
  const bindingScope = asRecord(authorizationGrant?.binding_scope);
  const targetScope = asRecord(authorizationGrant?.target_scope);
  const allowedActions = asStringArray(authorizationGrant?.allowed_actions);
  const grantDomain = asString(runtimeTarget?.domain);
  const grantPage = asString(runtimeTarget?.page);
  const grantTabId = asInteger(runtimeTarget?.tab_id);
  const projectedRiskState = projectRiskStateFromGrantSnapshot(
    authorizationGrant?.resource_state_snapshot
  );
  const supportsRequestedMode =
    input.state?.requestedExecutionMode === "live_read_high_risk"
      ? projectedRiskState === "allowed"
      : input.state?.requestedExecutionMode === "live_read_limited"
        ? projectedRiskState === "limited" || projectedRiskState === "allowed"
        : false;
  const grantHasExecutableBinding =
    grantResourceKind === "profile_session"
      ? grantProfileRef !== null
      : grantResourceKind === "anonymous_context"
        ? grantProfileRef === null &&
          grantBindingConstraints?.anonymous_required === true &&
          grantBindingConstraints?.reuse_logged_in_context_forbidden === true
        : false;

  return (
    liveRequirements.length > 0 &&
    input.state?.issueScope === "issue_209" &&
    input.state?.actionType === "read" &&
    (input.state?.requestedExecutionMode === "live_read_limited" ||
      input.state?.requestedExecutionMode === "live_read_high_risk") &&
    actionRequest !== null &&
    resourceBinding !== null &&
    authorizationGrant !== null &&
    runtimeTarget !== null &&
    actionRequestRef !== null &&
    resourceBindingRef !== null &&
    authorizationGrantRef !== null &&
    runtimeTargetRef !== null &&
    resolveCanonicalGrantApprovedAt(input) !== null &&
    approvalRefs.length > 0 &&
    auditRefs.length > 0 &&
    grantActionName !== null &&
    grantActionType === input.state?.actionType &&
    grantResourceKind !== null &&
    grantHasExecutableBinding &&
    grantDomain === input.targetDomain &&
    grantPage === input.targetPage &&
    grantTabId === input.targetTabId &&
    supportsRequestedMode &&
    allowedActions.includes(grantActionName) &&
    asStringArray(bindingScope?.allowed_resource_kinds).includes(grantResourceKind) &&
    (grantResourceKind !== "profile_session" ||
      asStringArray(bindingScope?.allowed_profile_refs).includes(grantProfileRef ?? "")) &&
    asStringArray(targetScope?.allowed_domains).includes(grantDomain ?? "") &&
    asStringArray(targetScope?.allowed_pages).includes(grantPage ?? "")
  );
};

const explicitAdmissionRefMatchesCurrentGrant = (grantRefs, explicitRef) => {
  const normalizedExplicitRef = asString(explicitRef);
  if (normalizedExplicitRef === null) {
    return false;
  }

  return asStringArray(grantRefs).includes(normalizedExplicitRef);
};

const normalizeApprovalAdmissionEvidence = (value) => {
  const record = asRecord(value);
  const checksRecord = asRecord(record?.checks);
  return {
    approval_admission_ref: asString(record?.approval_admission_ref),
    decision_id: asString(record?.decision_id),
    approval_id: asString(record?.approval_id),
    run_id: asString(record?.run_id),
    session_id: asString(record?.session_id),
    issue_scope: asString(record?.issue_scope),
    target_domain: asString(record?.target_domain),
    target_tab_id: asInteger(record?.target_tab_id),
    target_page: asString(record?.target_page),
    action_type: asString(record?.action_type),
    requested_execution_mode: asString(record?.requested_execution_mode),
    approved: asBoolean(record?.approved),
    approver: asString(record?.approver),
    approved_at: asString(record?.approved_at),
    checks: Object.fromEntries(
      APPROVAL_CHECK_KEYS.map((key) => [key, asBoolean(checksRecord?.[key])])
    ),
    recorded_at: asString(record?.recorded_at)
  };
};

const normalizeAuditAdmissionEvidence = (value) => {
  const record = asRecord(value);
  const checksRecord = asRecord(record?.audited_checks);
  return {
    audit_admission_ref: asString(record?.audit_admission_ref),
    decision_id: asString(record?.decision_id),
    approval_id: asString(record?.approval_id),
    run_id: asString(record?.run_id),
    session_id: asString(record?.session_id),
    issue_scope: asString(record?.issue_scope),
    target_domain: asString(record?.target_domain),
    target_tab_id: asInteger(record?.target_tab_id),
    target_page: asString(record?.target_page),
    action_type: asString(record?.action_type),
    requested_execution_mode: asString(record?.requested_execution_mode),
    risk_state: asString(record?.risk_state),
    audited_checks: Object.fromEntries(
      APPROVAL_CHECK_KEYS.map((key) => [key, asBoolean(checksRecord?.[key])])
    ),
    recorded_at: asString(record?.recorded_at)
  };
};

const buildApprovalRecordFromAdmissionEvidence = (approvalAdmissionEvidence, expected) => ({
  approval_id: expected.approvalId ?? null,
  decision_id: expected.decisionId ?? null,
  approved: approvalAdmissionEvidence.approved === true,
  approver: approvalAdmissionEvidence.approver,
  approved_at: approvalAdmissionEvidence.approved_at,
  checks: Object.fromEntries(
    APPROVAL_CHECK_KEYS.map((key) => [key, approvalAdmissionEvidence.checks[key] === true])
  )
});

const buildSyntheticApprovalRecordFromCanonicalGrant = (expected) => ({
  approval_id: expected.approvalId ?? null,
  decision_id: expected.decisionId ?? null,
  approved: true,
  approver: "authorization_grant",
  approved_at: expected.approvedAt ?? null,
  checks: Object.fromEntries(APPROVAL_CHECK_KEYS.map((key) => [key, true]))
});

const resolveIssue209ApprovalAdmissionRequirementGaps = (
  requirements,
  approvalAdmissionEvidence,
  expected
) => {
  const gaps = [];
  const carriesDecisionId = hasOwnNonNullValue(approvalAdmissionEvidence, "decision_id");
  const carriesApprovalId = hasOwnNonNullValue(approvalAdmissionEvidence, "approval_id");

  for (const requirement of requirements) {
    if (requirement === "approval_admission_evidence_approved_true") {
      if (!approvalAdmissionEvidence.approved) {
        gaps.push(requirement);
      }
      continue;
    }
    if (requirement === "approval_admission_evidence_approver_present") {
      if (!approvalAdmissionEvidence.approver) {
        gaps.push(requirement);
      }
      continue;
    }
    if (requirement === "approval_admission_evidence_approved_at_present") {
      if (!approvalAdmissionEvidence.approved_at) {
        gaps.push(requirement);
      }
      continue;
    }
    if (requirement === "approval_admission_evidence_checks_all_true") {
      const allChecksComplete = APPROVAL_CHECK_KEYS.every(
        (key) => approvalAdmissionEvidence.checks[key] === true
      );
      if (!allChecksComplete) {
        gaps.push(requirement);
      }
      continue;
    }
    if (
      requirement === "risk_state_checked" ||
      requirement === "target_domain_confirmed" ||
      requirement === "target_tab_confirmed" ||
      requirement === "target_page_confirmed" ||
      requirement === "action_type_confirmed"
    ) {
      if (approvalAdmissionEvidence.checks[requirement] !== true) {
        gaps.push(requirement);
      }
      continue;
    }
    gaps.push(requirement);
  }

  if (
    !approvalAdmissionEvidence.approval_admission_ref ||
    !approvalAdmissionEvidence.recorded_at ||
    approvalAdmissionEvidence.run_id !== expected.runId ||
    approvalAdmissionEvidence.session_id !== expected.sessionId ||
    approvalAdmissionEvidence.issue_scope !== expected.issueScope ||
    approvalAdmissionEvidence.target_domain !== expected.targetDomain ||
    approvalAdmissionEvidence.target_tab_id !== expected.targetTabId ||
    approvalAdmissionEvidence.target_page !== expected.targetPage ||
    approvalAdmissionEvidence.action_type !== expected.actionType ||
    approvalAdmissionEvidence.requested_execution_mode !== expected.requestedExecutionMode
  ) {
    gaps.push("approval_admission_evidence_present");
  }

  const linkagePresent = carriesDecisionId || carriesApprovalId;
  const linkageValid =
    linkagePresent &&
    carriesDecisionId &&
    carriesApprovalId &&
    approvalAdmissionEvidence.decision_id === expected.decisionId &&
    approvalAdmissionEvidence.approval_id === expected.approvalId;
  if (linkagePresent && !linkageValid) {
    gaps.push("approval_admission_evidence_present");
  }

  return gaps;
};

const resolveIssue209AuditAdmissionRequirementGaps = (
  auditAdmissionEvidence,
  expected,
  requirements
) => {
  const gaps = [];
  const carriesDecisionId = hasOwnNonNullValue(auditAdmissionEvidence, "decision_id");
  const carriesApprovalId = hasOwnNonNullValue(auditAdmissionEvidence, "approval_id");

  if (
    requirements.includes("audit_admission_evidence_present") &&
    (!auditAdmissionEvidence.audit_admission_ref ||
      !auditAdmissionEvidence.recorded_at ||
      auditAdmissionEvidence.run_id !== expected.runId ||
      auditAdmissionEvidence.session_id !== expected.sessionId ||
      auditAdmissionEvidence.issue_scope !== expected.issueScope ||
      auditAdmissionEvidence.target_domain !== expected.targetDomain ||
      auditAdmissionEvidence.target_tab_id !== expected.targetTabId ||
      auditAdmissionEvidence.target_page !== expected.targetPage ||
      auditAdmissionEvidence.action_type !== expected.actionType ||
      auditAdmissionEvidence.requested_execution_mode !== expected.requestedExecutionMode ||
      auditAdmissionEvidence.risk_state !== expected.riskState)
  ) {
    gaps.push("audit_admission_evidence_present");
  }

  const linkagePresent = carriesDecisionId || carriesApprovalId;
  const linkageValid =
    linkagePresent &&
    carriesDecisionId &&
    carriesApprovalId &&
    auditAdmissionEvidence.decision_id === expected.decisionId &&
    auditAdmissionEvidence.approval_id === expected.approvalId;
  if (requirements.includes("audit_admission_evidence_present") && linkagePresent && !linkageValid) {
    gaps.push("audit_admission_evidence_present");
  }

  if (requirements.includes("audit_admission_checks_all_true")) {
    const allChecksComplete = APPROVAL_CHECK_KEYS.every(
      (key) => auditAdmissionEvidence.audited_checks[key] === true
    );
    if (!allChecksComplete) {
      gaps.push("audit_admission_checks_all_true");
    }
  }

  return gaps;
};

const collectIssue209LiveReadMatrixGateReasons = (input) => {
  const gateReasons = Array.isArray(input.gateReasons) ? input.gateReasons : [];
  const admissionContext = cloneIssue209AdmissionContext(input.admissionContext);
  const approvalRecord = buildApprovalRecordFromAdmissionEvidence(
    normalizeApprovalAdmissionEvidence(admissionContext?.approval_admission_evidence),
    {
      decisionId: input.decisionId ?? null,
      approvalId: input.expectedApprovalId ?? null
    }
  );

  if (gateReasons.length === 0 && input.state.isBlockedByStateMatrix) {
    pushReason(gateReasons, `RISK_STATE_${String(input.state.riskState).toUpperCase()}`);
    pushReason(gateReasons, "ISSUE_ACTION_MATRIX_BLOCKED");
  }

  if (gateReasons.length > 0 || input.state.liveModeCanEnter !== true) {
    return {
      gateReasons,
      approvalRecord,
      admissionContext: {
        approval_admission_evidence: normalizeApprovalAdmissionEvidence(
          admissionContext?.approval_admission_evidence
        ),
        audit_admission_evidence: normalizeAuditAdmissionEvidence(
          admissionContext?.audit_admission_evidence
        )
      },
      writeGateOnlyEligible: false,
      writeGateOnlyDecision: null,
      writeGateOnlyApprovalDecision: null
    };
  }

  const conditionalRequirement =
    input.state.requestedExecutionMode === null
      ? null
      : input.state.issueActionMatrix.conditional_actions.find(
          (entry) => entry.action === input.state.requestedExecutionMode
        ) ?? null;
  const liveRequirements = conditionalRequirement?.requires ?? [];
  const approvalAdmissionEvidence = normalizeApprovalAdmissionEvidence(
    admissionContext?.approval_admission_evidence
  );
  const auditAdmissionEvidence = normalizeAuditAdmissionEvidence(
    admissionContext?.audit_admission_evidence
  );
  const approvalAdmissionRequirementGaps = resolveIssue209ApprovalAdmissionRequirementGaps(
    liveRequirements.filter(
      (requirement) =>
        requirement === "approval_admission_evidence_approved_true" ||
        requirement === "approval_admission_evidence_approver_present" ||
        requirement === "approval_admission_evidence_approved_at_present" ||
        requirement === "approval_admission_evidence_checks_all_true" ||
        requirement === "risk_state_checked" ||
        requirement === "target_domain_confirmed" ||
        requirement === "target_tab_confirmed" ||
        requirement === "target_page_confirmed" ||
        requirement === "action_type_confirmed"
    ),
    approvalAdmissionEvidence,
    {
      decisionId: input.decisionId ?? null,
      approvalId: input.expectedApprovalId ?? null,
      runId: input.runId ?? null,
      sessionId: input.sessionId ?? null,
      issueScope: input.state.issueScope,
      targetDomain: input.targetDomain ?? null,
      targetTabId: input.targetTabId ?? null,
      targetPage: input.targetPage ?? null,
      actionType: input.state.actionType,
      requestedExecutionMode: input.state.requestedExecutionMode
    }
  );
  const auditAdmissionRequirementGaps = resolveIssue209AuditAdmissionRequirementGaps(
    auditAdmissionEvidence,
    {
      decisionId: input.decisionId ?? null,
      approvalId: input.expectedApprovalId ?? null,
      runId: input.runId ?? null,
      sessionId: input.sessionId ?? null,
      issueScope: input.state.issueScope,
      targetDomain: input.targetDomain ?? null,
      targetTabId: input.targetTabId ?? null,
      targetPage: input.targetPage ?? null,
      actionType: input.state.actionType,
      requestedExecutionMode: input.state.requestedExecutionMode,
      riskState: input.state.riskState
    },
    liveRequirements
  );
  const rolloutRequirementGaps =
    liveRequirements.includes("limited_read_rollout_ready_true") &&
    input.state.limitedReadRolloutReadyTrue !== true
      ? ["limited_read_rollout_ready_true"]
      : [];
  const canonicalGrantBackedAdmission = hasCanonicalGrantBackedAdmission(input, liveRequirements);
  const explicitApprovalAlignedWithCurrentGrant =
    !canonicalGrantBackedAdmission ||
    explicitAdmissionRefMatchesCurrentGrant(
      input.state?.upstreamAuthorizationRequest?.authorization_grant?.approval_refs,
      approvalAdmissionEvidence.approval_admission_ref
    );
  const explicitAuditAlignedWithCurrentGrant =
    !canonicalGrantBackedAdmission ||
    explicitAdmissionRefMatchesCurrentGrant(
      input.state?.upstreamAuthorizationRequest?.authorization_grant?.audit_refs,
      auditAdmissionEvidence.audit_admission_ref
    );
  const explicitApprovalUsable =
    approvalAdmissionRequirementGaps.length === 0 && explicitApprovalAlignedWithCurrentGrant;
  const explicitAuditUsable =
    auditAdmissionRequirementGaps.length === 0 && explicitAuditAlignedWithCurrentGrant;
  const explicitAdmissionUsable =
    explicitApprovalUsable && explicitAuditUsable;
  const effectiveApprovalAdmissionEvidence =
    canonicalGrantBackedAdmission && !explicitApprovalUsable
      ? normalizeApprovalAdmissionEvidence(null)
      : approvalAdmissionEvidence;
  const effectiveAuditAdmissionEvidence =
    canonicalGrantBackedAdmission && !explicitAuditUsable
      ? normalizeAuditAdmissionEvidence(null)
      : auditAdmissionEvidence;
  const liveAdmissionSatisfied =
    explicitAdmissionUsable || canonicalGrantBackedAdmission;
  const canonicalApprovalRecord = explicitApprovalUsable
    ? buildApprovalRecordFromAdmissionEvidence(approvalAdmissionEvidence, {
        decisionId: input.decisionId ?? null,
        approvalId: input.expectedApprovalId ?? null
      })
    : canonicalGrantBackedAdmission
      ? buildSyntheticApprovalRecordFromCanonicalGrant({
          decisionId: input.decisionId ?? null,
          approvalId: input.expectedApprovalId ?? null,
          approvedAt: resolveCanonicalGrantApprovedAt(input)
        })
      : approvalRecord;

  if (!liveAdmissionSatisfied && approvalAdmissionRequirementGaps.length > 0) {
    pushReason(gateReasons, "MANUAL_CONFIRMATION_MISSING");
  }
  if (
    !liveAdmissionSatisfied &&
    approvalAdmissionRequirementGaps.includes("approval_admission_evidence_checks_all_true")
  ) {
    pushReason(gateReasons, "APPROVAL_CHECKS_INCOMPLETE");
  }
  if (!liveAdmissionSatisfied && auditAdmissionRequirementGaps.length > 0) {
    pushReason(gateReasons, "AUDIT_RECORD_MISSING");
  }
  if (rolloutRequirementGaps.length > 0) {
    pushReason(gateReasons, "LIMITED_READ_ROLLOUT_NOT_READY");
  }

  return {
    gateReasons,
    approvalRecord: canonicalApprovalRecord,
    admissionContext: {
      approval_admission_evidence: effectiveApprovalAdmissionEvidence,
      audit_admission_evidence: effectiveAuditAdmissionEvidence
    },
    writeGateOnlyEligible: false,
    writeGateOnlyDecision: null,
    writeGateOnlyApprovalDecision: null
  };
};
return { validateIssue209ApprovalSourceAgainstCurrentLinkage, collectIssue209LiveReadMatrixGateReasons };
})();
const __webenvoy_module_issue209_postgate_audit = (() => {
const { APPROVAL_CHECK_KEYS, buildRiskTransitionAudit } = __webenvoy_module_risk_state;
const { resolveIssue209LiveReadApprovalId } = __webenvoy_module_issue209_identity;
const { resolveConsumedIssue209AdmissionEvidence } = __webenvoy_module_issue209_source;
const clone = (value) => structuredClone(value);
const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const asString = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

const normalizeChecks = (value) => {
  const record = asRecord(value);
  return Object.fromEntries(APPROVAL_CHECK_KEYS.map((key) => [key, record?.[key] === true]));
};

const ISSUE209_LIVE_READ_MODES = new Set(["live_read_limited", "live_read_high_risk"]);
const NO_ADDITIONAL_RISK_SIGNALS = "NO_ADDITIONAL_RISK_SIGNALS";

const hasExecutionAuditInputs = (requestAdmissionResult) => {
  const derivedFrom = asRecord(requestAdmissionResult?.derived_from);
  return (
    Boolean(asString(requestAdmissionResult?.request_ref)) &&
    Boolean(asString(derivedFrom?.action_request_ref)) &&
    Boolean(asString(derivedFrom?.resource_binding_ref)) &&
    Boolean(asString(derivedFrom?.authorization_grant_ref)) &&
    Boolean(asString(derivedFrom?.runtime_target_ref))
  );
};

const hasApprovalEvidenceValidationIssue = (reasonCodes) =>
  reasonCodes.some(
    (reason) =>
      reason === "MANUAL_CONFIRMATION_MISSING" ||
      reason === "APPROVAL_CHECKS_INCOMPLETE" ||
      reason === "APPROVAL_ADMISSION_REF_OUT_OF_SCOPE"
  );

const hasAuditEvidenceValidationIssue = (reasonCodes) =>
  reasonCodes.some(
    (reason) =>
      reason === "AUDIT_RECORD_MISSING" || reason === "AUDIT_ADMISSION_REF_OUT_OF_SCOPE"
  );

const buildIssue209ExecutionAudit = (input) => {
  const requestAdmissionResult = asRecord(input.gate?.request_admission_result);
  const requestedMode = asString(input.gate?.consumer_gate_result?.requested_execution_mode);
  if (
    !requestAdmissionResult ||
    !requestedMode ||
    !ISSUE209_LIVE_READ_MODES.has(requestedMode) ||
    !hasExecutionAuditInputs(requestAdmissionResult)
  ) {
    return null;
  }

  const derivedFrom = asRecord(requestAdmissionResult.derived_from);
  const reasonCodes = asStringArray(requestAdmissionResult.reason_codes);
  const consumedEvidence = resolveConsumedIssue209AdmissionEvidence(
    input.gate?.gate_input?.admission_context
  );
  const admissionAllowed = requestAdmissionResult.admission_decision === "allowed";
  const blockedWithMatchingGrant =
    requestAdmissionResult.admission_decision === "blocked" &&
    requestAdmissionResult.grant_match === true;
  const riskSignals =
    asStringArray(input.executionAuditRiskSignals).length > 0
      ? asStringArray(input.executionAuditRiskSignals)
      : [NO_ADDITIONAL_RISK_SIGNALS];

  return {
    audit_ref: `exec_audit_${input.decisionId}`,
    request_ref: asString(requestAdmissionResult.request_ref),
    consumed_inputs: {
      action_request_ref: asString(derivedFrom?.action_request_ref),
      resource_binding_ref: asString(derivedFrom?.resource_binding_ref),
      authorization_grant_ref: asString(derivedFrom?.authorization_grant_ref),
      runtime_target_ref: asString(derivedFrom?.runtime_target_ref)
    },
    compatibility_refs: {
      gate_run_id: asString(input.runId),
      approval_admission_ref:
        (!admissionAllowed && !blockedWithMatchingGrant) ||
        hasApprovalEvidenceValidationIssue(reasonCodes)
        ? null
        : consumedEvidence.approvalAdmissionRef,
      audit_admission_ref:
        (!admissionAllowed && !blockedWithMatchingGrant) ||
        hasAuditEvidenceValidationIssue(reasonCodes)
        ? null
        : consumedEvidence.auditAdmissionRef,
      approval_record_ref: asString(input.approvalRecord?.approval_id),
      audit_record_ref: asString(input.auditRecord?.event_id),
      session_rhythm_window_id:
        asString(input.gate?.gate_input?.session_rhythm_window_id) ?? null,
      session_rhythm_decision_id: asString(input.gate?.gate_input?.session_rhythm_decision_id) ??
        null
    },
    request_admission_decision: requestAdmissionResult.admission_decision,
    risk_signals: riskSignals,
    recorded_at: input.recordedAt
  };
};

const buildIssue209PostGateArtifacts = (input) => {
  const nowValue = typeof input?.now === "function" ? input.now() : Date.now();
  const recordedAt = new Date(nowValue).toISOString();
  const gate = input.gate;
  const requestedMode = gate.consumer_gate_result.requested_execution_mode;
  const effectiveMode = gate.consumer_gate_result.effective_execution_mode;
  const liveModeRequested =
    requestedMode === "live_read_limited" || requestedMode === "live_read_high_risk";
  const approvalIssued =
    gate.consumer_gate_result.gate_decision === "allowed" &&
    (effectiveMode === "live_read_limited" || effectiveMode === "live_read_high_risk");
  const riskSignal = gate.consumer_gate_result.gate_decision === "blocked" && liveModeRequested;
  const recoverySignal =
    gate.consumer_gate_result.gate_decision === "allowed" &&
    gate.gate_input.risk_state === "limited" &&
    liveModeRequested;

  const approvalRecord = clone(gate.approval_record);
  const decisionId = gate.gate_outcome.decision_id;
  const approvalId = approvalIssued
    ? asString(gate.gate_outcome.approval_id) ??
      asString(gate.approval_record.approval_id) ??
      resolveIssue209LiveReadApprovalId({ decisionId })
    : null;
  approvalRecord.decision_id = decisionId;
  approvalRecord.approval_id = approvalId;
  const auditAdmissionEvidence = asRecord(gate.gate_input.admission_context?.audit_admission_evidence);

  const auditRecord = {
    event_id: `gate_evt_${decisionId}`,
    decision_id: decisionId,
    approval_id: approvalId,
    run_id: input.runId,
    session_id: input.sessionId,
    profile: input.profile,
    issue_scope: gate.gate_input.issue_scope,
    risk_state: gate.gate_input.risk_state,
    target_domain: gate.consumer_gate_result.target_domain,
    target_tab_id: gate.consumer_gate_result.target_tab_id,
    target_page: gate.consumer_gate_result.target_page,
    action_type: gate.consumer_gate_result.action_type,
    requested_execution_mode: requestedMode,
    effective_execution_mode: gate.consumer_gate_result.effective_execution_mode,
    gate_decision: gate.consumer_gate_result.gate_decision,
    gate_reasons: clone(gate.consumer_gate_result.gate_reasons),
    approver: approvalRecord.approver,
    approved_at: approvalRecord.approved_at,
    audited_checks: normalizeChecks(auditAdmissionEvidence?.audited_checks),
    write_interaction_tier: gate.write_action_matrix_decisions?.write_interaction_tier ?? null,
    write_action_matrix_decisions: gate.write_action_matrix_decisions
      ? clone(gate.write_action_matrix_decisions)
      : null,
    risk_signal: riskSignal,
    recovery_signal: recoverySignal,
    session_rhythm_state: riskSignal ? "cooldown" : recoverySignal ? "recovery" : "normal",
    cooldown_until: riskSignal ? new Date(nowValue + 30 * 60_000).toISOString() : null,
    recovery_started_at: recoverySignal ? recordedAt : null,
    recorded_at: recordedAt
  };

  const transitionAudit = buildRiskTransitionAudit({
    runId: input.runId,
    sessionId: input.sessionId,
    issueScope: gate.gate_input.issue_scope,
    prevState: gate.gate_input.risk_state,
    decision: gate.consumer_gate_result.gate_decision,
    gateReasons: clone(gate.consumer_gate_result.gate_reasons),
    requestedExecutionMode: gate.consumer_gate_result.requested_execution_mode,
    approvalRecord,
    auditRecords: [auditRecord],
    now: recordedAt
  });
  auditRecord.next_state = asString(transitionAudit.next_state);
  auditRecord.transition_trigger = asString(transitionAudit.trigger);
  const executionAudit = buildIssue209ExecutionAudit({
    runId: input.runId,
    gate,
    decisionId,
    approvalRecord,
    auditRecord,
    recordedAt,
    executionAuditRiskSignals: input.executionAuditRiskSignals
  });

  return {
    approval_record: approvalRecord,
    audit_record: auditRecord,
    execution_audit: executionAudit
  };
};
return { buildIssue209PostGateArtifacts };
})();
const __webenvoy_module_shared_xhs_gate = (() => {
const {
  APPROVAL_CHECK_KEYS,
  EXECUTION_MODES,
  WRITE_INTERACTION_TIER,
  getIssueActionMatrixEntry,
  getWriteActionMatrixDecisions,
  resolveIssueScope: resolveSharedIssueScope,
  resolveRiskState: resolveSharedRiskState
} = __webenvoy_module_risk_state;
const { resolveConsumedIssue209AdmissionEvidence } = __webenvoy_module_issue209_source;
const { collectIssue209LiveReadMatrixGateReasons } = __webenvoy_module_issue209_gate;
const { buildIssue209PostGateArtifacts } = __webenvoy_module_issue209_postgate_audit;
const {
  isIssue209LiveReadGateRequest,
  resolveIssue209LiveReadApprovalId
} = __webenvoy_module_issue209_identity;
const { evaluateRiskEvidenceConsumerGate } = __webenvoy_module_risk_evidence_gate;
const {
  evaluatePlatformBehaviorAssessmentGate
} = __webenvoy_module_platform_behavior_assessment_gate;
const XHS_READ_DOMAIN = "www.xiaohongshu.com";
const XHS_WRITE_DOMAIN = "creator.xiaohongshu.com";
const XHS_UPSTREAM_RESOURCE_KINDS = new Set(["anonymous_context", "profile_session"]);
const XHS_RESOURCE_STATE_SNAPSHOTS = new Set(["active", "cool_down", "paused"]);
const XHS_ALLOWED_DOMAINS = new Set([XHS_READ_DOMAIN, XHS_WRITE_DOMAIN]);
const XHS_ACTION_TYPES = new Set(["read", "write", "irreversible_write"]);
const XHS_EXECUTION_MODE_SET = new Set(EXECUTION_MODES);
const XHS_LIVE_READ_EXECUTION_MODE_SET = new Set(["live_read_limited", "live_read_high_risk"]);
const XHS_REQUIRED_APPROVAL_CHECKS = APPROVAL_CHECK_KEYS;
const XHS_REQUIRED_AUDIT_ADMISSION_CHECKS = APPROVAL_CHECK_KEYS;
const XHS_WRITE_APPROVAL_REQUIREMENTS = [
  "approval_record_approved_true",
  "approval_record_approver_present",
  "approval_record_approved_at_present",
  "approval_record_checks_all_true"
];
const XHS_SCOPE_CONTEXT = {
  platform: "xhs",
  read_domain: XHS_READ_DOMAIN,
  write_domain: XHS_WRITE_DOMAIN,
  domain_mixing_forbidden: true
};
const XHS_READ_EXECUTION_POLICY = {
  default_mode: "dry_run",
  allowed_modes: ["dry_run", "recon", "live_read_limited", "live_read_high_risk"],
  blocked_actions: ["expand_new_live_surface_without_gate"],
  live_entry_requirements: [
    "gate_input_risk_state_limited_or_allowed",
    "audit_admission_evidence_present",
    "audit_admission_checks_all_true",
    "risk_state_checked",
    "target_domain_confirmed",
    "target_tab_confirmed",
    "target_page_confirmed",
    "action_type_confirmed",
    "approval_admission_evidence_approved_true",
    "approval_admission_evidence_approver_present",
    "approval_admission_evidence_approved_at_present",
    "approval_admission_evidence_checks_all_true"
  ]
};
const EXECUTION_AUDIT_NON_RISK_REASON_CODES = new Set([
  "LIVE_MODE_APPROVED",
  "DEFAULT_MODE_DRY_RUN",
  "DEFAULT_MODE_RECON",
  "WRITE_INTERACTION_APPROVED",
  "ISSUE_208_EDITOR_INPUT_VALIDATION_APPROVED"
]);
const NO_ADDITIONAL_RISK_SIGNALS = "NO_ADDITIONAL_RISK_SIGNALS";

const asRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;

const asBoolean = (value) => value === true;

const asString = (value) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

const asInteger = (value) => (typeof value === "number" && Number.isInteger(value) ? value : null);

const asStringArray = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return normalized.length === value.length ? normalized : null;
};

const normalizeGrantRefs = (value) => asStringArray(value) ?? [];

const resolveBehaviorBaselineGoalKind = (input, state) => {
  const action = state.actionType ?? asString(input.abilityAction ?? input.abilityActionType);
  if (action === "write" || action === "irreversible_write") {
    return "write";
  }
  if (action === "read") {
    return "read";
  }
  return null;
};

const resolveBehaviorBaselineProbeBundleRef = (input, goalKind) => {
  const explicit = asString(
    input.behaviorBaselineProbeBundleRef ??
      input.behavior_baseline_probe_bundle_ref ??
      input.probeBundleRef ??
      input.probe_bundle_ref
  );
  if (explicit) {
    return explicit;
  }
  if (goalKind === "write") {
    return "probe-bundle://fr-0022/xhs-write";
  }
  if (goalKind === "read") {
    return "probe-bundle://fr-0022/xhs-read";
  }
  return null;
};

const normalizeUpstreamAuthorizationRequest = (value) => {
  const record = asRecord(value);
  const actionRequest = asRecord(record?.action_request);
  const resourceBinding = asRecord(record?.resource_binding);
  const authorizationGrant = asRecord(record?.authorization_grant);
  const runtimeTarget = asRecord(record?.runtime_target);
  const bindingScope = asRecord(authorizationGrant?.binding_scope);
  const targetScope = asRecord(authorizationGrant?.target_scope);
  const bindingConstraints = asRecord(resourceBinding?.binding_constraints);

  const resourceKind = asString(resourceBinding?.resource_kind);
  const resourceStateSnapshot = asString(authorizationGrant?.resource_state_snapshot);

  return {
    action_request: actionRequest
      ? {
          request_ref: asString(actionRequest.request_ref),
          action_name: asString(actionRequest.action_name),
          action_category: resolveXhsActionType(actionRequest.action_category),
          requested_at: asString(actionRequest.requested_at)
        }
      : null,
    resource_binding: resourceBinding
      ? {
          binding_ref: asString(resourceBinding.binding_ref),
          resource_kind:
            resourceKind && XHS_UPSTREAM_RESOURCE_KINDS.has(resourceKind) ? resourceKind : null,
          profile_ref: Object.prototype.hasOwnProperty.call(resourceBinding, "profile_ref")
            ? resourceBinding.profile_ref === null
              ? null
              : asString(resourceBinding.profile_ref)
            : undefined,
          binding_constraints: bindingConstraints
            ? {
                anonymous_required: bindingConstraints.anonymous_required === true,
                reuse_logged_in_context_forbidden:
                  bindingConstraints.reuse_logged_in_context_forbidden === true
              }
            : null
        }
      : null,
    authorization_grant: authorizationGrant
      ? {
          grant_ref: asString(authorizationGrant.grant_ref),
          allowed_actions: asStringArray(authorizationGrant.allowed_actions) ?? [],
          binding_scope: {
            allowed_resource_kinds: asStringArray(bindingScope?.allowed_resource_kinds) ?? [],
            allowed_profile_refs: asStringArray(bindingScope?.allowed_profile_refs) ?? []
          },
          target_scope: {
            allowed_domains: asStringArray(targetScope?.allowed_domains) ?? [],
            allowed_pages: asStringArray(targetScope?.allowed_pages) ?? []
          },
          approval_refs: normalizeGrantRefs(authorizationGrant.approval_refs),
          audit_refs: normalizeGrantRefs(authorizationGrant.audit_refs),
          granted_at: asString(authorizationGrant.granted_at),
          resource_state_snapshot:
            resourceStateSnapshot && XHS_RESOURCE_STATE_SNAPSHOTS.has(resourceStateSnapshot)
              ? resourceStateSnapshot
              : null
        }
      : null,
    runtime_target: runtimeTarget
      ? {
          target_ref: asString(runtimeTarget.target_ref),
          domain: asString(runtimeTarget.domain),
          page: asString(runtimeTarget.page),
          tab_id: asInteger(runtimeTarget.tab_id),
          url: asString(runtimeTarget.url)
        }
      : null
  };
};

const projectRiskStateFromSnapshot = (snapshot) => {
  if (snapshot === "active") {
    return "allowed";
  }
  if (snapshot === "cool_down") {
    return "limited";
  }
  if (snapshot === "paused") {
    return "paused";
  }
  return null;
};

const deriveCanonicalRiskState = (inputRiskState, upstream) => {
  const explicitRiskState = asString(inputRiskState);
  if (explicitRiskState) {
    return resolveXhsRiskState(explicitRiskState);
  }
  const projectedRiskState = projectRiskStateFromSnapshot(
    upstream?.authorization_grant?.resource_state_snapshot
  );
  return projectedRiskState
    ? resolveXhsRiskState(projectedRiskState)
    : resolveXhsRiskState(inputRiskState);
};

const buildSearchParamValueMap = (url) => {
  const values = new Map();
  for (const [key, value] of url.searchParams.entries()) {
    const current = values.get(key) ?? [];
    current.push(value);
    values.set(key, current);
  }
  return values;
};

const actualUrlSatisfiesExpectedQuery = (expectedUrl, actualUrl) => {
  const expectedParams = buildSearchParamValueMap(expectedUrl);
  if (expectedParams.size === 0) {
    return true;
  }

  const actualParams = buildSearchParamValueMap(actualUrl);
  for (const [key, expectedValues] of expectedParams.entries()) {
    const actualValues = [...(actualParams.get(key) ?? [])];
    if (actualValues.length < expectedValues.length) {
      return false;
    }

    for (const expectedValue of expectedValues) {
      const matchIndex = actualValues.indexOf(expectedValue);
      if (matchIndex === -1) {
        return false;
      }
      actualValues.splice(matchIndex, 1);
    }
  }

  return true;
};

const parseXhsDetailLikeNoteId = (url) => {
  if (!(url instanceof URL)) {
    return null;
  }
  const match = url.pathname.match(/^\/(?:explore|discovery\/item|search_result)\/([^/?#]+)/u);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const isXhsDetailLikeUrl = (url) => parseXhsDetailLikeNoteId(url) !== null;

const parseXhsProfileUserId = (url) => {
  if (!(url instanceof URL)) {
    return null;
  }
  const match = url.pathname.match(/^\/user\/profile\/([^/?#]+)\/?$/u);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const isXhsProfileUrl = (url) => parseXhsProfileUserId(url) !== null;

const detailLikeRuntimeTargetUrlsMatch = (expectedUrl, actualUrl) => {
  const expectedNoteId = parseXhsDetailLikeNoteId(expectedUrl);
  const actualNoteId = parseXhsDetailLikeNoteId(actualUrl);
  if (!expectedNoteId || !actualNoteId || expectedNoteId !== actualNoteId) {
    return false;
  }
  if (expectedUrl.pathname === actualUrl.pathname) {
    return actualUrlSatisfiesExpectedQuery(expectedUrl, actualUrl);
  }
  return true;
};

const profileRuntimeTargetUrlsMatch = (expectedUrl, actualUrl) => {
  const expectedUserId = parseXhsProfileUserId(expectedUrl);
  const actualUserId = parseXhsProfileUserId(actualUrl);
  return Boolean(expectedUserId && actualUserId && expectedUserId === actualUserId);
};

const matchesRuntimeTargetUrl = (input, actualTargetUrl) => {
  const runtimeTarget = input?.runtime_target;
  if (!runtimeTarget?.url || !runtimeTarget.domain || !runtimeTarget.page) {
    return true;
  }

  try {
    const parsed = new URL(runtimeTarget.url);
    if (parsed.hostname !== runtimeTarget.domain) {
      return false;
    }
    if (runtimeTarget.page === "search_result_tab") {
      if (!parsed.pathname.startsWith("/search_result")) {
        return false;
      }
    }
    if (runtimeTarget.page === "explore_detail_tab") {
      if (!isXhsDetailLikeUrl(parsed)) {
        return false;
      }
    }
    if (runtimeTarget.page === "profile_tab") {
      if (!isXhsProfileUrl(parsed)) {
        return false;
      }
    }
    if (runtimeTarget.page === "creator_publish_tab") {
      if (
        parsed.hostname !== XHS_WRITE_DOMAIN ||
        !parsed.pathname.startsWith("/publish")
      ) {
        return false;
      }
    }
    if (!actualTargetUrl) {
      return true;
    }
    const actual = new URL(actualTargetUrl);
    if (
      runtimeTarget.page === "explore_detail_tab" &&
      actual.protocol === parsed.protocol &&
      actual.hostname === parsed.hostname
    ) {
      return detailLikeRuntimeTargetUrlsMatch(parsed, actual);
    }
    if (
      runtimeTarget.page === "profile_tab" &&
      actual.protocol === parsed.protocol &&
      actual.hostname === parsed.hostname
    ) {
      return profileRuntimeTargetUrlsMatch(parsed, actual);
    }
    return (
      actual.protocol === parsed.protocol &&
      actual.hostname === parsed.hostname &&
      actual.pathname === parsed.pathname &&
      actualUrlSatisfiesExpectedQuery(parsed, actual)
    );
  } catch {
    return false;
  }
};

const deriveCanonicalRequestedExecutionMode = (input) => {
  const explicitRequestedExecutionMode = resolveXhsExecutionMode(input.requestedExecutionMode);
  const upstream = normalizeUpstreamAuthorizationRequest(
    input.upstreamAuthorizationRequest ?? input.upstream_authorization_request
  );
  const actionCategory = upstream.action_request?.action_category ?? null;
  const targetDomain = upstream.runtime_target?.domain ?? asString(input.targetDomain);

  if (!upstream.action_request || !upstream.resource_binding || !upstream.authorization_grant || !upstream.runtime_target) {
    return {
      requestedExecutionMode: explicitRequestedExecutionMode,
      upstream,
      legacyRequestedExecutionMode: resolveXhsExecutionMode(
        input.legacyRequestedExecutionMode ?? input.legacy_requested_execution_mode
      )
    };
  }

  let requestedExecutionMode = null;
  if (actionCategory === "write" || actionCategory === "irreversible_write") {
    requestedExecutionMode = "live_write";
  } else if (actionCategory === "read") {
    const hasGrantRefs =
      upstream.authorization_grant.approval_refs.length > 0 &&
      upstream.authorization_grant.audit_refs.length > 0;
    const projectedRiskState = projectRiskStateFromSnapshot(
      upstream.authorization_grant.resource_state_snapshot
    );
    if (!hasGrantRefs || targetDomain !== XHS_READ_DOMAIN) {
      requestedExecutionMode = "dry_run";
    } else if (projectedRiskState === "allowed") {
      requestedExecutionMode = "live_read_high_risk";
    } else if (projectedRiskState === "limited") {
      requestedExecutionMode = "live_read_limited";
    } else {
      requestedExecutionMode = "dry_run";
    }
  }
  let legacyRequestedExecutionMode = resolveXhsExecutionMode(
    input.legacyRequestedExecutionMode ?? input.legacy_requested_execution_mode
  );
  if (
    !legacyRequestedExecutionMode &&
    explicitRequestedExecutionMode &&
    requestedExecutionMode &&
    explicitRequestedExecutionMode !== requestedExecutionMode
  ) {
    legacyRequestedExecutionMode = explicitRequestedExecutionMode;
  }

  return {
    requestedExecutionMode: requestedExecutionMode ?? explicitRequestedExecutionMode,
    upstream,
    legacyRequestedExecutionMode
  };
};

const applyCanonicalAdmissionReasons = (input) => {
  const upstream = input.upstream;
  const runtimeProfileRef = asString(input.runtimeProfileRef);
  if (!upstream?.action_request || !upstream?.resource_binding || !upstream?.authorization_grant || !upstream?.runtime_target) {
    return;
  }
  if (
    input.legacyRequestedExecutionMode &&
    input.requestedExecutionMode &&
    input.legacyRequestedExecutionMode !== input.requestedExecutionMode
  ) {
    pushReason(input.gateReasons, "STALE_LEGACY_REQUESTED_EXECUTION_MODE");
  }

  if (!upstream.authorization_grant.allowed_actions.includes(upstream.action_request.action_name)) {
    pushReason(input.gateReasons, "ACTION_NOT_ALLOWED_BY_GRANT");
  }
  if (
    !upstream.authorization_grant.binding_scope.allowed_resource_kinds.includes(
      upstream.resource_binding.resource_kind
    )
  ) {
    pushReason(input.gateReasons, "RESOURCE_KIND_OUT_OF_SCOPE");
  }
  if (
    upstream.resource_binding.resource_kind === "profile_session" &&
    upstream.resource_binding.profile_ref &&
    !upstream.authorization_grant.binding_scope.allowed_profile_refs.includes(
      upstream.resource_binding.profile_ref
    )
  ) {
    pushReason(input.gateReasons, "PROFILE_REF_OUT_OF_SCOPE");
  }
  if (
    upstream.resource_binding.resource_kind === "profile_session" &&
    upstream.resource_binding.profile_ref &&
    runtimeProfileRef &&
    runtimeProfileRef !== upstream.resource_binding.profile_ref
  ) {
    pushReason(input.gateReasons, "PROFILE_SESSION_RUNTIME_PROFILE_MISMATCH");
  }
  if (
    !upstream.authorization_grant.target_scope.allowed_domains.includes(upstream.runtime_target.domain)
  ) {
    pushReason(input.gateReasons, "TARGET_DOMAIN_OUT_OF_SCOPE");
  }
  if (
    !upstream.authorization_grant.target_scope.allowed_pages.includes(upstream.runtime_target.page)
  ) {
    pushReason(input.gateReasons, "TARGET_PAGE_OUT_OF_SCOPE");
  }
  if (!matchesRuntimeTargetUrl(upstream, asString(input.actualTargetUrl))) {
    pushReason(input.gateReasons, "TARGET_URL_CONTEXT_MISMATCH");
  }

  if (upstream.resource_binding.resource_kind === "anonymous_context") {
    const bindingConstraints = upstream.resource_binding.binding_constraints;
    if (
      bindingConstraints?.anonymous_required !== true ||
      bindingConstraints?.reuse_logged_in_context_forbidden !== true
    ) {
      pushReason(input.gateReasons, "ANONYMOUS_BINDING_CONSTRAINTS_INVALID");
    }
    if (input.targetSiteLoggedIn) {
      pushReason(input.gateReasons, "ANONYMOUS_CONTEXT_REQUIRES_LOGGED_OUT_SITE_CONTEXT");
      return;
    }
    if (!input.anonymousIsolationVerified) {
      pushReason(input.gateReasons, "ANONYMOUS_ISOLATION_UNVERIFIED");
    }
  }

  if (
    input.issueScope === "issue_209" &&
    input.requestedExecutionMode &&
    XHS_LIVE_READ_EXECUTION_MODE_SET.has(input.requestedExecutionMode)
  ) {
    const consumedEvidence = resolveConsumedIssue209AdmissionEvidence(input.admissionContext);
    if (
      consumedEvidence.approvalAdmissionRef &&
      !upstream.authorization_grant.approval_refs.includes(consumedEvidence.approvalAdmissionRef)
    ) {
      pushReason(input.gateReasons, "APPROVAL_ADMISSION_REF_OUT_OF_SCOPE");
    }
    if (
      consumedEvidence.auditAdmissionRef &&
      !upstream.authorization_grant.audit_refs.includes(consumedEvidence.auditAdmissionRef)
    ) {
      pushReason(input.gateReasons, "AUDIT_ADMISSION_REF_OUT_OF_SCOPE");
    }
  }
};

const deriveExecutionAuditRiskSignals = (reasonCodes) => {
  const normalizedReasonCodes = asStringArray(reasonCodes) ?? [];
  const riskSignals = normalizedReasonCodes.filter(
    (reason) =>
      !EXECUTION_AUDIT_NON_RISK_REASON_CODES.has(reason) &&
      !reason.startsWith("WRITE_INTERACTION_TIER_")
  );
  return riskSignals.length > 0 ? riskSignals : [NO_ADDITIONAL_RISK_SIGNALS];
};

const firstValidGrantRef = (value) => normalizeGrantRefs(value)[0] ?? null;

const resolveCanonicalCompatibilityRefs = (input) => {
  const upstreamApprovalRef = firstValidGrantRef(input.upstream?.authorization_grant?.approval_refs);
  const upstreamAuditRef = firstValidGrantRef(input.upstream?.authorization_grant?.audit_refs);
  const admissionApprovalRef =
    input.admissionContext?.approval_admission_evidence?.approval_admission_ref ?? null;
  const admissionAuditRef =
    input.admissionContext?.audit_admission_evidence?.audit_admission_ref ?? null;
  const allowUpstreamFallback = input.allowUpstreamFallback !== false;

  return {
    approvalAdmissionRef:
      typeof admissionApprovalRef === "string" && admissionApprovalRef.length > 0
        ? admissionApprovalRef
        : allowUpstreamFallback &&
            typeof upstreamApprovalRef === "string" &&
            upstreamApprovalRef.length > 0
          ? upstreamApprovalRef
          : null,
    auditAdmissionRef:
      typeof admissionAuditRef === "string" && admissionAuditRef.length > 0
        ? admissionAuditRef
        : allowUpstreamFallback &&
            typeof upstreamAuditRef === "string" &&
            upstreamAuditRef.length > 0
          ? upstreamAuditRef
          : null
  };
};

const evaluateRequestAdmissionResult = (input) => {
  const state = input.state ?? {};
  const upstream = input.upstream;
  const requestRef = upstream?.action_request?.request_ref ?? asString(input.commandRequestId) ?? asString(input.requestId);
  const normalizedActionType = upstream?.action_request?.action_category ?? state.actionType ?? null;
  const normalizedResourceKind = upstream?.resource_binding?.resource_kind ?? null;
  const runtimeTargetMatch =
    !input.gateReasons.includes("TARGET_DOMAIN_CONTEXT_MISMATCH") &&
    !input.gateReasons.includes("TARGET_TAB_CONTEXT_MISMATCH") &&
    !input.gateReasons.includes("TARGET_PAGE_CONTEXT_UNRESOLVED") &&
    !input.gateReasons.includes("TARGET_PAGE_CONTEXT_MISMATCH") &&
    !input.gateReasons.includes("TARGET_URL_CONTEXT_MISMATCH");

  let grantMatch = true;
  if (upstream?.authorization_grant && upstream?.action_request && upstream?.resource_binding && upstream?.runtime_target) {
    const allowedActions = upstream.authorization_grant.allowed_actions;
    const allowedResourceKinds = upstream.authorization_grant.binding_scope.allowed_resource_kinds;
    const allowedProfileRefs = upstream.authorization_grant.binding_scope.allowed_profile_refs;
    const allowedDomains = upstream.authorization_grant.target_scope.allowed_domains;
    const allowedPages = upstream.authorization_grant.target_scope.allowed_pages;

    if (!allowedActions.includes(upstream.action_request.action_name)) {
      grantMatch = false;
    }
    if (!allowedResourceKinds.includes(upstream.resource_binding.resource_kind)) {
      grantMatch = false;
    }
    if (
      upstream.resource_binding.resource_kind === "profile_session" &&
      upstream.resource_binding.profile_ref &&
      !allowedProfileRefs.includes(upstream.resource_binding.profile_ref)
    ) {
      grantMatch = false;
    }
    if (!allowedDomains.includes(upstream.runtime_target.domain)) {
      grantMatch = false;
    }
    if (!allowedPages.includes(upstream.runtime_target.page)) {
      grantMatch = false;
    }
    if (
      input.gateReasons.includes("APPROVAL_ADMISSION_REF_OUT_OF_SCOPE") ||
      input.gateReasons.includes("AUDIT_ADMISSION_REF_OUT_OF_SCOPE")
    ) {
      grantMatch = false;
    }
  }
  const requiresCanonicalGrantAdmission =
    state.issueScope === "issue_209" &&
    (state.requestedExecutionMode === "live_read_limited" ||
      state.requestedExecutionMode === "live_read_high_risk");
  const explicitCompatibilityRefs = resolveCanonicalCompatibilityRefs({
    upstream,
    admissionContext: input.admissionContext,
    allowUpstreamFallback: false
  });
  const hasExplicitCompatibilityEvidence =
    explicitCompatibilityRefs.approvalAdmissionRef !== null ||
    explicitCompatibilityRefs.auditAdmissionRef !== null;
  const hasCanonicalAdmissionGaps =
    input.gateReasons.includes("MANUAL_CONFIRMATION_MISSING") ||
    input.gateReasons.includes("APPROVAL_CHECKS_INCOMPLETE") ||
    input.gateReasons.includes("AUDIT_RECORD_MISSING");
  const canUseCanonicalGrantCompatibilityFallback =
    requiresCanonicalGrantAdmission && !hasCanonicalAdmissionGaps;

  if (requiresCanonicalGrantAdmission && hasCanonicalAdmissionGaps && !hasExplicitCompatibilityEvidence) {
    grantMatch = false;
  }

  const anonymousIsolationVerified = input.anonymousIsolationVerified === true;
  const targetSiteLoggedIn = input.targetSiteLoggedIn === true;
  const anonymousBindingConstraintsOk = !input.gateReasons.includes(
    "ANONYMOUS_BINDING_CONSTRAINTS_INVALID"
  );
  const anonymousIsolationOk =
    normalizedResourceKind !== "anonymous_context"
      ? true
      : !targetSiteLoggedIn && anonymousIsolationVerified && anonymousBindingConstraintsOk;
  const compatibilityRefs = resolveCanonicalCompatibilityRefs({
    upstream,
    admissionContext: input.admissionContext,
    allowUpstreamFallback: canUseCanonicalGrantCompatibilityFallback
  });

  const admissionDecision =
    !runtimeTargetMatch || !grantMatch || !anonymousIsolationOk || input.outcome.gateDecision === "blocked"
      ? "blocked"
      : input.outcome.gateDecision === "allowed"
        ? "allowed"
        : "deferred";

  return {
    request_ref: requestRef,
    admission_decision: admissionDecision,
    normalized_action_type: normalizedActionType,
    normalized_resource_kind: normalizedResourceKind,
    runtime_target_match: runtimeTargetMatch,
    grant_match: grantMatch,
    anonymous_isolation_ok: anonymousIsolationOk,
    effective_runtime_mode: input.outcome.effectiveExecutionMode,
    reason_codes: [...input.gateReasons],
    derived_from: {
      gate_input_ref: asString(input.runId) ?? input.decisionId,
      action_request_ref: upstream?.action_request?.request_ref ?? null,
      resource_binding_ref: upstream?.resource_binding?.binding_ref ?? null,
      authorization_grant_ref: upstream?.authorization_grant?.grant_ref ?? null,
      runtime_target_ref: upstream?.runtime_target?.target_ref ?? null,
      approval_admission_ref: compatibilityRefs.approvalAdmissionRef,
      audit_admission_ref: compatibilityRefs.auditAdmissionRef
    }
  };
};

const resolveXhsGateDecisionId = (input) => {
  const explicitDecisionId = asString(input?.decisionId);
  if (explicitDecisionId) {
    return explicitDecisionId;
  }

  const gateInvocationId = asString(input?.gateInvocationId);
  if (gateInvocationId) {
    return `gate_decision_${gateInvocationId}`;
  }

  const issueScope = asString(input?.issueScope);
  const requestedExecutionMode = asString(input?.requestedExecutionMode);
  if (
    issueScope === "issue_209" &&
    requestedExecutionMode &&
    XHS_LIVE_READ_EXECUTION_MODE_SET.has(requestedExecutionMode)
  ) {
    throw new Error("issue_209 live-read requires gate_invocation_id");
  }

  const runId = asString(input?.runId);
  const requestId = asString(input?.requestId);
  if (runId && requestId) {
    return `gate_decision_${runId}_${requestId}`;
  }
  if (requestId) {
    return `gate_decision_${requestId}`;
  }
  if (runId) {
    return `gate_decision_${runId}`;
  }

  const fallbackIssueScope = asString(input?.issueScope) ?? "unknown_scope";
  const fallbackTargetPage = asString(input?.targetPage) ?? "unknown_page";
  const fallbackTargetTabId = asInteger(input?.targetTabId);
  return `gate_decision_${fallbackIssueScope}_${fallbackTargetPage}_${fallbackTargetTabId ?? "unknown_tab"}`;
};

const deriveGateDecisionId = (input) => {
  return resolveXhsGateDecisionId(input);
};

const deriveApprovalId = (input, decisionId) => {
  if (isIssue209LiveReadGateRequest(input)) {
    return resolveIssue209LiveReadApprovalId({
      decisionId,
      gateInvocationId: input.gateInvocationId
    });
  }

  const approvalRecord = normalizeXhsApprovalRecord(input.approvalRecord);
  const hasRealApproval =
    approvalRecord.approved &&
    approvalRecord.approver &&
    approvalRecord.approved_at &&
    XHS_REQUIRED_APPROVAL_CHECKS.every((key) => approvalRecord.checks[key] === true);
  if (!hasRealApproval) {
    return null;
  }

  const approvalRecordHasConflictingLinkage = hasApprovalRecordConflictingLinkage(
    approvalRecord,
    decisionId
  );
  if (approvalRecordHasConflictingLinkage) {
    return null;
  }

  const explicitApprovalId = asString(input.approvalId);
  if (explicitApprovalId && !approvalRecordHasConflictingLinkage) {
    return explicitApprovalId;
  }

  const record = asRecord(input.approvalRecord);
  const recordApprovalId = asString(record?.approval_id);
  if (recordApprovalId && approvalRecord.decision_id === decisionId) {
    return recordApprovalId;
  }

  return `gate_appr_${decisionId}`;
};

const resolveXhsGateApprovalId = (input) => {
  const decisionId = resolveXhsGateDecisionId(input);
  return deriveApprovalId(input, decisionId);
};

const pushReason = (target, reason) => {
  if (!target.includes(reason)) {
    target.push(reason);
  }
};

const hasOwnNonNullValue = (record, key) => Object.prototype.hasOwnProperty.call(record, key) && record[key] !== null;

const resolveXhsActionType = (value) =>
  typeof value === "string" && XHS_ACTION_TYPES.has(value) ? value : null;

const resolveXhsExecutionMode = (value) =>
  typeof value === "string" && XHS_EXECUTION_MODE_SET.has(value) ? value : null;

const resolveXhsRiskState = (value) => resolveSharedRiskState(value);

const resolveXhsIssueScope = (value) => resolveSharedIssueScope(value);

const deriveXhsPlatformBehaviorGoalKind = (actionType) => {
  if (actionType === "read") {
    return "read";
  }
  if (actionType === "write" || actionType === "irreversible_write") {
    return "write";
  }
  return null;
};

const resolveXhsRuntimeProfileRef = (input, state) =>
  asString(input.runtimeProfileRef ?? input.__runtime_profile_ref) ??
  state.upstreamAuthorizationRequest?.resource_binding?.profile_ref ??
  null;

const deriveXhsPlatformBehaviorExpectedScope = (input, state) => {
  const providedScope =
    asRecord(input.expectedPlatformBehaviorScope) ??
    asRecord(input.expected_platform_behavior_scope);
  const providedScopeForBinding = providedScope ? { ...providedScope } : null;
  if (providedScopeForBinding) {
    delete providedScopeForBinding.profile_ref;
  }
  const assessment =
    asRecord(input.platformBehaviorAssessment) ??
    asRecord(input.platform_behavior_assessment);
  const currentProfileRef = resolveXhsRuntimeProfileRef(input, state);
  const targetDomain =
    state.upstreamAuthorizationRequest?.runtime_target?.domain ?? asString(input.targetDomain);
  const targetPage =
    state.upstreamAuthorizationRequest?.runtime_target?.page ?? asString(input.targetPage);
  const goalKind = deriveXhsPlatformBehaviorGoalKind(state.actionType);
  const bindingReasons = [];

  if (!providedScope) {
    pushReason(bindingReasons, "platform_behavior_expected_scope_missing");
  }
  if (
    !currentProfileRef &&
    (asString(providedScope?.profile_ref) || asString(assessment?.profile_ref))
  ) {
    pushReason(bindingReasons, "platform_behavior_xhs_runtime_profile_ref_missing");
  }
  if (!targetDomain) {
    pushReason(bindingReasons, "platform_behavior_xhs_target_domain_missing");
  }
  if (!targetPage) {
    pushReason(bindingReasons, "platform_behavior_xhs_target_page_missing");
  }
  if (!state.actionType) {
    pushReason(bindingReasons, "platform_behavior_xhs_action_type_missing");
  }
  if (!state.requestedExecutionMode) {
    pushReason(bindingReasons, "platform_behavior_xhs_execution_mode_missing");
  }

  return {
    expectedScope: {
      ...(providedScopeForBinding ?? {}),
      ...(currentProfileRef ? { profile_ref: currentProfileRef } : {}),
      platform: "xhs",
      ...(targetDomain ? { target_domain: targetDomain } : {}),
      ...(state.requestedExecutionMode
        ? {
            requested_execution_mode: state.requestedExecutionMode,
            effective_execution_mode: state.requestedExecutionMode
          }
        : {}),
      ...(goalKind ? { goal_kind: goalKind } : {})
    },
    bindingReasons
  };
};

const applyPlatformBehaviorScopeBindingReasons = (gate, bindingReasons) => {
  if (!gate.required || bindingReasons.length === 0) {
    return gate;
  }
  const gateReasons = [...gate.gate_reasons];
  for (const reason of bindingReasons) {
    pushReason(gateReasons, reason);
  }
  return {
    ...gate,
    accepted_risk_hint: false,
    decision: "blocked",
    gate_reasons: gateReasons
  };
};

const collectXhsPlatformBehaviorDecisionHintGateReasons = (gate, state) => {
  if (!gate.required || gate.accepted_risk_hint !== true) {
    return [];
  }
  const reasons = [];
  if (
    gate.decision_hint === "hold_live_write" &&
    (state.requestedExecutionMode === "live_write" ||
      state.actionType === "write" ||
      state.actionType === "irreversible_write")
  ) {
    pushReason(reasons, "platform_behavior_hold_live_write");
  }
  if (gate.decision_hint === "require_manual_review") {
    pushReason(reasons, "platform_behavior_manual_review_required");
  }
  if (gate.decision_hint === "require_reseed" || gate.reseed_required === true) {
    pushReason(reasons, "platform_behavior_reseed_required");
  }
  return reasons;
};

const normalizeXhsApprovalRecord = (value) => {
  const record = asRecord(value);
  const checksRecord = asRecord(record?.checks);
  return {
    approval_id: asString(record?.approval_id),
    decision_id: asString(record?.decision_id),
    approved: asBoolean(record?.approved),
    approver: asString(record?.approver),
    approved_at: asString(record?.approved_at),
    checks: Object.fromEntries(
      XHS_REQUIRED_APPROVAL_CHECKS.map((key) => [key, asBoolean(checksRecord?.[key])])
    )
  };
};

const normalizeXhsApprovalAdmissionEvidence = (value) => {
  const record = asRecord(value);
  const checksRecord = asRecord(record?.checks);
  return {
    approval_admission_ref: asString(record?.approval_admission_ref),
    decision_id: asString(record?.decision_id),
    approval_id: asString(record?.approval_id),
    run_id: asString(record?.run_id),
    session_id: asString(record?.session_id),
    issue_scope: asString(record?.issue_scope),
    target_domain: asString(record?.target_domain),
    target_tab_id: asInteger(record?.target_tab_id),
    target_page: asString(record?.target_page),
    action_type: asString(record?.action_type),
    requested_execution_mode: asString(record?.requested_execution_mode),
    approved: asBoolean(record?.approved),
    approver: asString(record?.approver),
    approved_at: asString(record?.approved_at),
    checks: Object.fromEntries(
      XHS_REQUIRED_APPROVAL_CHECKS.map((key) => [key, asBoolean(checksRecord?.[key])])
    ),
    recorded_at: asString(record?.recorded_at)
  };
};

const normalizeXhsAuditAdmissionEvidence = (value) => {
  const record = asRecord(value);
  const checksRecord = asRecord(record?.audited_checks);
  return {
    audit_admission_ref: asString(record?.audit_admission_ref),
    decision_id: asString(record?.decision_id),
    approval_id: asString(record?.approval_id),
    run_id: asString(record?.run_id),
    session_id: asString(record?.session_id),
    issue_scope: asString(record?.issue_scope),
    target_domain: asString(record?.target_domain),
    target_tab_id: asInteger(record?.target_tab_id),
    target_page: asString(record?.target_page),
    action_type: asString(record?.action_type),
    requested_execution_mode: asString(record?.requested_execution_mode),
    risk_state: asString(record?.risk_state),
    audited_checks: Object.fromEntries(
      XHS_REQUIRED_AUDIT_ADMISSION_CHECKS.map((key) => [key, asBoolean(checksRecord?.[key])])
    ),
    recorded_at: asString(record?.recorded_at)
  };
};

const normalizeXhsAdmissionContext = (value) => {
  const record = asRecord(value);
  return {
    approval_admission_evidence: normalizeXhsApprovalAdmissionEvidence(
      record?.approval_admission_evidence
    ),
    audit_admission_evidence: normalizeXhsAuditAdmissionEvidence(record?.audit_admission_evidence)
  };
};

const resolveXhsIssueActionMatrixEntry = (issueScope, state) => {
  return getIssueActionMatrixEntry(issueScope, state);
};

const resolveXhsWriteActionMatrixDecisions = (issueScope, actionType, requestedExecutionMode) =>
  actionType === null ? null : getWriteActionMatrixDecisions(issueScope, actionType, requestedExecutionMode);

const resolveXhsWriteMatrixDecision = (output, state) =>
  output.decisions.find((entry) => entry.state === state) ?? {
    state,
    decision: "blocked",
    requires: []
  };

const resolveXhsWriteTierReason = (writeActionMatrixDecisions) =>
  writeActionMatrixDecisions === null
    ? null
    : `WRITE_INTERACTION_TIER_${writeActionMatrixDecisions.write_interaction_tier.toUpperCase()}`;

const resolveXhsApprovalRequirementGaps = (requirements, approvalRecord) => {
  const gaps = [];
  for (const requirement of requirements) {
    if (requirement === "approval_record_approved_true") {
      if (!approvalRecord.approved) {
        gaps.push(requirement);
      }
      continue;
    }
    if (requirement === "approval_record_approver_present") {
      if (!approvalRecord.approver) {
        gaps.push(requirement);
      }
      continue;
    }
    if (requirement === "approval_record_approved_at_present") {
      if (!approvalRecord.approved_at) {
        gaps.push(requirement);
      }
      continue;
    }
    if (requirement === "approval_record_checks_all_true") {
      const allChecksComplete = XHS_REQUIRED_APPROVAL_CHECKS.every((key) => approvalRecord.checks[key]);
      if (!allChecksComplete) {
        gaps.push(requirement);
      }
      continue;
    }
    gaps.push(requirement);
  }
  return gaps;
};

const resolveXhsApprovalAdmissionRequirementGaps = (
  requirements,
  approvalAdmissionEvidence,
  expected
) => {
  const gaps = [];
  const carriesDecisionId = hasOwnNonNullValue(approvalAdmissionEvidence, "decision_id");
  const carriesApprovalId = hasOwnNonNullValue(approvalAdmissionEvidence, "approval_id");
  for (const requirement of requirements) {
    if (requirement === "approval_admission_evidence_approved_true") {
      if (!approvalAdmissionEvidence.approved) {
        gaps.push(requirement);
      }
      continue;
    }
    if (requirement === "approval_admission_evidence_approver_present") {
      if (!approvalAdmissionEvidence.approver) {
        gaps.push(requirement);
      }
      continue;
    }
    if (requirement === "approval_admission_evidence_approved_at_present") {
      if (!approvalAdmissionEvidence.approved_at) {
        gaps.push(requirement);
      }
      continue;
    }
    if (requirement === "approval_admission_evidence_checks_all_true") {
      const allChecksComplete = XHS_REQUIRED_APPROVAL_CHECKS.every(
        (key) => approvalAdmissionEvidence.checks[key] === true
      );
      if (!allChecksComplete) {
        gaps.push(requirement);
      }
      continue;
    }
    if (
      requirement === "risk_state_checked" ||
      requirement === "target_domain_confirmed" ||
      requirement === "target_tab_confirmed" ||
      requirement === "target_page_confirmed" ||
      requirement === "action_type_confirmed"
    ) {
      if (approvalAdmissionEvidence.checks[requirement] !== true) {
        gaps.push(requirement);
      }
      continue;
    }
    gaps.push(requirement);
  }

  if (
    !approvalAdmissionEvidence.approval_admission_ref ||
    !approvalAdmissionEvidence.recorded_at ||
    approvalAdmissionEvidence.run_id !== expected.runId ||
    approvalAdmissionEvidence.session_id !== expected.sessionId ||
    approvalAdmissionEvidence.issue_scope !== expected.issueScope ||
    approvalAdmissionEvidence.target_domain !== expected.targetDomain ||
    approvalAdmissionEvidence.target_tab_id !== expected.targetTabId ||
    approvalAdmissionEvidence.target_page !== expected.targetPage ||
    approvalAdmissionEvidence.action_type !== expected.actionType ||
    approvalAdmissionEvidence.requested_execution_mode !== expected.requestedExecutionMode
  ) {
    gaps.push("approval_admission_evidence_present");
  }

  const linkagePresent = carriesDecisionId || carriesApprovalId;
  const linkageValid =
    linkagePresent &&
    carriesDecisionId &&
    carriesApprovalId &&
    approvalAdmissionEvidence.decision_id === expected.decisionId &&
    approvalAdmissionEvidence.approval_id === expected.approvalId;
  if (linkagePresent && !linkageValid) {
    gaps.push("approval_admission_evidence_present");
  }

  return gaps;
};

const normalizeXhsAuditRecord = (value) => {
  const record = asRecord(value);
  return {
    event_id: asString(record?.event_id),
    decision_id: asString(record?.decision_id),
    approval_id: asString(record?.approval_id),
    issue_scope: asString(record?.issue_scope),
    target_domain: asString(record?.target_domain),
    target_tab_id: asInteger(record?.target_tab_id),
    target_page: asString(record?.target_page),
    action_type: asString(record?.action_type),
    requested_execution_mode: asString(record?.requested_execution_mode),
    gate_decision: asString(record?.gate_decision),
    recorded_at: asString(record?.recorded_at)
  };
};

const resolveXhsAuditAdmissionRequirementGaps = (
  auditAdmissionEvidence,
  expected,
  requirements
) => {
  const gaps = [];
  const carriesDecisionId = hasOwnNonNullValue(auditAdmissionEvidence, "decision_id");
  const carriesApprovalId = hasOwnNonNullValue(auditAdmissionEvidence, "approval_id");
  if (
    requirements.includes("audit_admission_evidence_present") &&
    (!auditAdmissionEvidence.audit_admission_ref ||
      !auditAdmissionEvidence.recorded_at ||
      auditAdmissionEvidence.run_id !== expected.runId ||
      auditAdmissionEvidence.session_id !== expected.sessionId ||
      auditAdmissionEvidence.issue_scope !== expected.issueScope ||
      auditAdmissionEvidence.target_domain !== expected.targetDomain ||
      auditAdmissionEvidence.target_tab_id !== expected.targetTabId ||
      auditAdmissionEvidence.target_page !== expected.targetPage ||
      auditAdmissionEvidence.action_type !== expected.actionType ||
      auditAdmissionEvidence.requested_execution_mode !== expected.requestedExecutionMode ||
      auditAdmissionEvidence.risk_state !== expected.riskState)) {
    gaps.push("audit_admission_evidence_present");
  }

  const linkagePresent = carriesDecisionId || carriesApprovalId;
  const linkageValid =
    linkagePresent &&
    carriesDecisionId &&
    carriesApprovalId &&
    auditAdmissionEvidence.decision_id === expected.decisionId &&
    auditAdmissionEvidence.approval_id === expected.approvalId;
  if (requirements.includes("audit_admission_evidence_present") && linkagePresent && !linkageValid) {
    gaps.push("audit_admission_evidence_present");
  }

  if (requirements.includes("audit_admission_checks_all_true")) {
    const allChecksComplete = XHS_REQUIRED_AUDIT_ADMISSION_CHECKS.every(
      (key) => auditAdmissionEvidence.audited_checks[key] === true
    );
    if (!allChecksComplete) {
      gaps.push("audit_admission_checks_all_true");
    }
  }

  return gaps;
};
const hasApprovalRecordConflictingLinkage = (approvalRecord, decisionId) => {
  if (typeof decisionId !== "string" || decisionId.length === 0) {
    return true;
  }

  if (approvalRecord.decision_id && approvalRecord.decision_id !== decisionId) {
    return true;
  }

  return approvalRecord.approval_id !== null && approvalRecord.decision_id === null;
};

const resolveXhsFallbackMode = (requestedExecutionMode, riskState) => {
  if (requestedExecutionMode === "recon") {
    return "recon";
  }
  if (requestedExecutionMode === "live_write") {
    return "dry_run";
  }
  return riskState === "limited" ? "recon" : "dry_run";
};

const evaluateXhsGateCore = (input) => {
  const {
    requestedExecutionMode,
    upstream,
    legacyRequestedExecutionMode
  } = deriveCanonicalRequestedExecutionMode(input);
  const issueScope = resolveXhsIssueScope(input.issueScope);
  const riskState = deriveCanonicalRiskState(input.riskState, upstream);
  const actionType =
    upstream.action_request?.action_category ?? resolveXhsActionType(input.actionType);
  const targetDomain = upstream.runtime_target?.domain ?? asString(input.targetDomain);
  const targetTabId = upstream.runtime_target?.tab_id ?? asInteger(input.targetTabId);
  const targetPage = upstream.runtime_target?.page ?? asString(input.targetPage);
  const actualTargetDomain = asString(input.actualTargetDomain);
  const actualTargetTabId = asInteger(input.actualTargetTabId);
  const actualTargetPage = asString(input.actualTargetPage);
  const abilityAction = asString(input.abilityAction ?? input.abilityActionType);
  const approvalRecord = normalizeXhsApprovalRecord(input.approvalRecord);
  const admissionContext = normalizeXhsAdmissionContext(input.admissionContext);
  const issueActionMatrix = resolveXhsIssueActionMatrixEntry(issueScope, riskState);
  const writeActionMatrixDecisions = resolveXhsWriteActionMatrixDecisions(
    issueScope,
    actionType,
    requestedExecutionMode
  );
  const writeMatrixDecision =
    writeActionMatrixDecisions === null
      ? null
      : resolveXhsWriteMatrixDecision(writeActionMatrixDecisions, riskState);
  const issue208WriteGateOnly =
    issueScope === "issue_208" &&
    actionType !== null &&
    writeActionMatrixDecisions !== null &&
    writeActionMatrixDecisions.write_interaction_tier !== "observe_only";
  const issue835ControlledLiveWrite =
    issueScope === "issue_835" &&
    actionType === "write" &&
    requestedExecutionMode === "live_write" &&
    input.controlledLiveWrite === true;
  const issue208EditorInputValidation = input.issue208EditorInputValidation === true;
  const fallbackMode = resolveXhsFallbackMode(requestedExecutionMode, riskState);
  const gateReasons = [];
  const writeTierReason = resolveXhsWriteTierReason(writeActionMatrixDecisions);
  const isLiveReadMode =
    requestedExecutionMode === "live_read_limited" ||
    requestedExecutionMode === "live_read_high_risk";
  const isBlockedByStateMatrix =
    !issue208WriteGateOnly &&
    !issue835ControlledLiveWrite &&
    requestedExecutionMode !== null &&
    issueActionMatrix.blocked_actions.includes(requestedExecutionMode);
  const conditionalRequirement =
    issue208WriteGateOnly || issue835ControlledLiveWrite || requestedExecutionMode === null
      ? null
      : issueActionMatrix.conditional_actions.find((entry) => entry.action === requestedExecutionMode) ??
        null;
  const liveModeCanEnter =
    requestedExecutionMode !== null &&
    conditionalRequirement !== null &&
    isLiveReadMode;
  let writeGateOnlyEligible = false;
  let writeGateOnlyDecision = null;

  if (!targetDomain) {
    pushReason(gateReasons, "TARGET_DOMAIN_NOT_EXPLICIT");
  } else if (!XHS_ALLOWED_DOMAINS.has(targetDomain)) {
    pushReason(gateReasons, "TARGET_DOMAIN_OUT_OF_SCOPE");
  }
  if (targetTabId === null || targetTabId <= 0) {
    pushReason(gateReasons, "TARGET_TAB_NOT_EXPLICIT");
  }
  if (!targetPage) {
    pushReason(gateReasons, "TARGET_PAGE_NOT_EXPLICIT");
  }
  if (actualTargetDomain && targetDomain && actualTargetDomain !== targetDomain) {
    pushReason(gateReasons, "TARGET_DOMAIN_CONTEXT_MISMATCH");
  }
  if (actualTargetTabId !== null && targetTabId !== null && actualTargetTabId !== targetTabId) {
    pushReason(gateReasons, "TARGET_TAB_CONTEXT_MISMATCH");
  }
  if (targetPage && actualTargetPage === null && input.requireActualTargetPage === true) {
    pushReason(gateReasons, "TARGET_PAGE_CONTEXT_UNRESOLVED");
  }
  if (actualTargetPage && targetPage && actualTargetPage !== targetPage) {
    pushReason(gateReasons, "TARGET_PAGE_CONTEXT_MISMATCH");
  }
  if (!actionType) {
    pushReason(gateReasons, "ACTION_TYPE_NOT_EXPLICIT");
  }
  if (!requestedExecutionMode) {
    pushReason(gateReasons, "REQUESTED_EXECUTION_MODE_NOT_EXPLICIT");
  }
  if (abilityAction && actionType && abilityAction !== actionType) {
    pushReason(gateReasons, "ABILITY_ACTION_CONTEXT_MISMATCH");
  }
  if (requestedExecutionMode === "live_write" && actionType === "irreversible_write") {
    pushReason(gateReasons, "IRREVERSIBLE_WRITE_NOT_ALLOWED");
  }
  if (
    requestedExecutionMode === "live_write" &&
    (!issue208WriteGateOnly && !issue835ControlledLiveWrite ||
      (issue208WriteGateOnly &&
        input.treatMissingEditorValidationAsUnsupported === true &&
        !issue208EditorInputValidation))
  ) {
    pushReason(gateReasons, "EXECUTION_MODE_UNSUPPORTED_FOR_COMMAND");
  }
  if (targetDomain === XHS_WRITE_DOMAIN && actionType === "read") {
    pushReason(gateReasons, "ACTION_DOMAIN_MISMATCH");
  }
  if (targetDomain === XHS_READ_DOMAIN && actionType !== null && actionType !== "read") {
    pushReason(gateReasons, "ACTION_DOMAIN_MISMATCH");
  }

  if (gateReasons.length === 0) {
    if (isBlockedByStateMatrix) {
      if (isLiveReadMode) {
        pushReason(gateReasons, `RISK_STATE_${riskState.toUpperCase()}`);
        pushReason(gateReasons, "ISSUE_ACTION_MATRIX_BLOCKED");
      } else {
        pushReason(gateReasons, "ISSUE_ACTION_BLOCKED_BY_STATE_MATRIX");
      }
    }

    if (
      (issue208WriteGateOnly || issue835ControlledLiveWrite) &&
      actionType !== null &&
      requestedExecutionMode !== null
    ) {
      const approvalRequirementGaps = resolveXhsApprovalRequirementGaps(
        [...XHS_WRITE_APPROVAL_REQUIREMENTS],
        approvalRecord
      );
      const approvalSatisfied = approvalRequirementGaps.length === 0;
      if (
        ((issue208WriteGateOnly && issue208EditorInputValidation) || issue835ControlledLiveWrite) &&
        riskState === "allowed" &&
        approvalSatisfied
      ) {
        writeGateOnlyEligible = true;
      } else {
        if (issue208WriteGateOnly && !issue208EditorInputValidation) {
          pushReason(gateReasons, "EDITOR_INPUT_VALIDATION_REQUIRED");
        }
        if (riskState !== "allowed") {
          pushReason(gateReasons, `RISK_STATE_${riskState.toUpperCase()}`);
          pushReason(gateReasons, "ISSUE_ACTION_MATRIX_BLOCKED");
        }
        if (!approvalRecord.approved || !approvalRecord.approver || !approvalRecord.approved_at) {
          pushReason(gateReasons, "MANUAL_CONFIRMATION_MISSING");
        }
        if (
          XHS_REQUIRED_APPROVAL_CHECKS.some((key) => approvalRecord.checks[key] !== true)
        ) {
          pushReason(gateReasons, "APPROVAL_CHECKS_INCOMPLETE");
        }
      }
      writeGateOnlyDecision = {
        issue_scope: issueScope,
        state: riskState,
        write_interaction_tier: writeActionMatrixDecisions?.write_interaction_tier ?? null,
        matrix_decision: writeGateOnlyEligible ? "conditional" : "blocked",
        matrix_actions: writeActionMatrixDecisions?.matrix_actions ?? [],
        required_approval: writeGateOnlyEligible ? [...XHS_WRITE_APPROVAL_REQUIREMENTS] : [],
        approval_satisfied: approvalSatisfied,
        approval_missing_requirements: approvalRequirementGaps,
        execution_enabled: writeGateOnlyEligible
      };
    } else if (actionType && actionType !== "read") {
      if (isLiveReadMode) {
        pushReason(gateReasons, "ACTION_TYPE_MODE_MISMATCH");
      }
      pushReason(gateReasons, `RISK_STATE_${riskState.toUpperCase()}`);
      pushReason(gateReasons, "ISSUE_ACTION_MATRIX_BLOCKED");
    } else if (liveModeCanEnter) {
      if (!approvalRecord.approved || !approvalRecord.approver || !approvalRecord.approved_at) {
        pushReason(gateReasons, "MANUAL_CONFIRMATION_MISSING");
      }
      if (XHS_REQUIRED_APPROVAL_CHECKS.some((key) => approvalRecord.checks[key] !== true)) {
        pushReason(gateReasons, "APPROVAL_CHECKS_INCOMPLETE");
      }
    }
  }

  if (
    input.includeWriteInteractionTierReason === true &&
    (issue208WriteGateOnly || issue835ControlledLiveWrite)
  ) {
    pushReason(gateReasons, writeTierReason);
  }

  return {
    targetDomain,
    targetTabId,
    targetPage,
    actionType,
    requestedExecutionMode,
    legacyRequestedExecutionMode,
    upstreamAuthorizationRequest: upstream,
    issueScope,
    riskState,
    approvalRecord,
    admissionContext,
    issueActionMatrix,
    writeActionMatrixDecisions,
    writeMatrixDecision,
    issue208WriteGateOnly,
    issue835ControlledLiveWrite,
    issue208EditorInputValidation,
    writeTierReason,
    gateReasons,
    isLiveReadMode,
    isBlockedByStateMatrix,
    liveModeCanEnter,
    fallbackMode,
    writeGateOnlyEligible,
    writeGateOnlyDecision
  };
};

const finalizeXhsGateOutcome = (input) => {
  const state = input.state ?? {};
  const gateReasons = [...(Array.isArray(input.gateReasons) ? input.gateReasons : [])];
  const {
    requestedExecutionMode = state.requestedExecutionMode ?? null,
    fallbackMode = state.fallbackMode ?? "dry_run",
    issue208WriteGateOnly = state.issue208WriteGateOnly === true,
    issue835ControlledLiveWrite = state.issue835ControlledLiveWrite === true,
    actionType = state.actionType ?? null,
    writeMatrixDecision = state.writeMatrixDecision ?? null,
    writeGateOnlyEligible,
    liveModeCanEnter = state.liveModeCanEnter === true
  } = input;
  const nonBlockingReasons = Array.isArray(input.nonBlockingReasons) ? input.nonBlockingReasons : [];
  const blockingReasons = gateReasons.filter((reason) => !nonBlockingReasons.includes(reason));
  let gateDecision = "allowed";
  let effectiveExecutionMode = requestedExecutionMode;

  if (blockingReasons.length > 0) {
    gateDecision = "blocked";
    if (
      requestedExecutionMode === "live_read_limited" ||
      requestedExecutionMode === "live_read_high_risk" ||
      requestedExecutionMode === "live_write"
    ) {
      effectiveExecutionMode = fallbackMode;
    }
    return {
      allowed: gateDecision === "allowed",
      gateDecision,
      effectiveExecutionMode,
      gateReasons
    };
  }

  if (
    (issue208WriteGateOnly || issue835ControlledLiveWrite) &&
    actionType &&
    actionType !== "read" &&
    requestedExecutionMode !== null
  ) {
    if (writeGateOnlyEligible) {
      if (
        input.writeGateOnlyEligibleBehavior === "block" ||
        input.allowIssue208EligibleExecution === false ||
        input.supportsIssue208ValidatedLiveWrite === false
      ) {
        gateDecision = "blocked";
        effectiveExecutionMode = fallbackMode;
        pushReason(gateReasons, "EXECUTION_MODE_UNSUPPORTED_FOR_COMMAND");
      } else {
        gateDecision = "allowed";
        effectiveExecutionMode = requestedExecutionMode;
        pushReason(gateReasons, "WRITE_INTERACTION_APPROVED");
        pushReason(gateReasons, "ISSUE_208_EDITOR_INPUT_VALIDATION_APPROVED");
      }
    } else {
      gateDecision = "blocked";
      effectiveExecutionMode = fallbackMode;
    }
    return {
      allowed: gateDecision === "allowed",
      gateDecision,
      effectiveExecutionMode,
      gateReasons
    };
  }

  if (requestedExecutionMode === "dry_run" || requestedExecutionMode === "recon") {
    pushReason(
      gateReasons,
      requestedExecutionMode === "recon" ? "DEFAULT_MODE_RECON" : "DEFAULT_MODE_DRY_RUN"
    );
    return {
      allowed: gateDecision === "allowed",
      gateDecision,
      effectiveExecutionMode,
      gateReasons
    };
  }

  gateDecision = "blocked";
  effectiveExecutionMode = fallbackMode;
  if (liveModeCanEnter) {
    gateDecision = "allowed";
    effectiveExecutionMode = requestedExecutionMode;
    pushReason(gateReasons, "LIVE_MODE_APPROVED");
  }

  return {
    allowed: gateDecision === "allowed",
    gateDecision,
    effectiveExecutionMode,
    gateReasons
  };
};

const buildXhsGatePolicyState = (input) => {
  const {
    requestedExecutionMode,
    upstream,
    legacyRequestedExecutionMode
  } = deriveCanonicalRequestedExecutionMode(input);
  const issueScope = resolveXhsIssueScope(input.issueScope);
  const riskState = deriveCanonicalRiskState(input.riskState, upstream);
  const actionType =
    upstream.action_request?.action_category ?? resolveXhsActionType(input.actionType);
  const issueActionMatrix = resolveXhsIssueActionMatrixEntry(issueScope, riskState);
  const writeActionMatrixDecisions = resolveXhsWriteActionMatrixDecisions(
    issueScope,
    actionType,
    requestedExecutionMode
  );
  const writeMatrixDecision =
    writeActionMatrixDecisions === null
      ? null
      : resolveXhsWriteMatrixDecision(writeActionMatrixDecisions, riskState);
  const issue208WriteGateOnly =
    issueScope === "issue_208" &&
    actionType !== null &&
    writeActionMatrixDecisions !== null &&
    writeActionMatrixDecisions.write_interaction_tier !== "observe_only";
  const issue835ControlledLiveWrite =
    issueScope === "issue_835" &&
    actionType === "write" &&
    requestedExecutionMode === "live_write" &&
    input.controlledLiveWrite === true;
  const writeTierReason = resolveXhsWriteTierReason(writeActionMatrixDecisions);
  const isLiveReadMode =
    requestedExecutionMode === "live_read_limited" ||
    requestedExecutionMode === "live_read_high_risk";
  const isBlockedByStateMatrix =
    !issue208WriteGateOnly &&
    !issue835ControlledLiveWrite &&
    requestedExecutionMode !== null &&
    issueActionMatrix.blocked_actions.includes(requestedExecutionMode);
  const liveModeCanEnter =
    requestedExecutionMode !== null &&
    issueActionMatrix.conditional_actions.some((entry) => entry.action === requestedExecutionMode) &&
    isLiveReadMode;
  const limitedReadRolloutReadyTrue = input.limitedReadRolloutReadyTrue === true;

  return {
    issueScope,
    riskState,
    actionType,
    requestedExecutionMode,
    legacyRequestedExecutionMode,
    upstreamAuthorizationRequest: upstream,
    issueActionMatrix,
    writeActionMatrixDecisions,
    writeMatrixDecision,
    issue208WriteGateOnly,
    issue835ControlledLiveWrite,
    writeTierReason,
    isLiveReadMode,
    isBlockedByStateMatrix,
    liveModeCanEnter,
    limitedReadRolloutReadyTrue,
    fallbackMode: resolveXhsFallbackMode(requestedExecutionMode, riskState)
  };
};

const collectXhsCommandGateReasons = (input) => {
  const gateReasons = Array.isArray(input.gateReasons) ? input.gateReasons : [];
  const actionType = resolveXhsActionType(input.actionType);
  const requestedExecutionMode = resolveXhsExecutionMode(input.requestedExecutionMode);
  const targetDomain = asString(input.targetDomain);
  const targetTabId = asInteger(input.targetTabId);
  const targetPage = asString(input.targetPage);
  const actualTargetDomain = asString(input.actualTargetDomain);
  const actualTargetTabId = asInteger(input.actualTargetTabId);
  const actualTargetPage = asString(input.actualTargetPage);
  const abilityAction = asString(input.abilityAction ?? input.abilityActionType);

  if (!targetDomain) {
    pushReason(gateReasons, "TARGET_DOMAIN_NOT_EXPLICIT");
  } else if (!XHS_ALLOWED_DOMAINS.has(targetDomain)) {
    pushReason(gateReasons, "TARGET_DOMAIN_OUT_OF_SCOPE");
  }
  if (targetTabId === null || targetTabId <= 0) {
    pushReason(gateReasons, "TARGET_TAB_NOT_EXPLICIT");
  }
  if (!targetPage) {
    pushReason(gateReasons, "TARGET_PAGE_NOT_EXPLICIT");
  }
  if (actualTargetDomain && targetDomain && actualTargetDomain !== targetDomain) {
    pushReason(gateReasons, "TARGET_DOMAIN_CONTEXT_MISMATCH");
  }
  if (actualTargetTabId !== null && targetTabId !== null && actualTargetTabId !== targetTabId) {
    pushReason(gateReasons, "TARGET_TAB_CONTEXT_MISMATCH");
  }
  if (targetPage && actualTargetPage === null && input.requireActualTargetPage === true) {
    pushReason(gateReasons, "TARGET_PAGE_CONTEXT_UNRESOLVED");
  }
  if (actualTargetPage && targetPage && actualTargetPage !== targetPage) {
    pushReason(gateReasons, "TARGET_PAGE_CONTEXT_MISMATCH");
  }
  if (!actionType) {
    pushReason(gateReasons, "ACTION_TYPE_NOT_EXPLICIT");
  }
  if (!requestedExecutionMode) {
    pushReason(gateReasons, "REQUESTED_EXECUTION_MODE_NOT_EXPLICIT");
  }
  if (abilityAction && actionType && abilityAction !== actionType) {
    pushReason(gateReasons, "ABILITY_ACTION_CONTEXT_MISMATCH");
  }
  if (requestedExecutionMode === "live_write" && actionType === "irreversible_write") {
    pushReason(gateReasons, "IRREVERSIBLE_WRITE_NOT_ALLOWED");
  }
  if (
    requestedExecutionMode === "live_write" &&
    (!input.issue208WriteGateOnly && !input.issue835ControlledLiveWrite ||
      (input.issue208WriteGateOnly &&
        input.treatMissingEditorValidationAsUnsupported === true &&
        input.issue208EditorInputValidation !== true))
  ) {
    pushReason(gateReasons, "EXECUTION_MODE_UNSUPPORTED_FOR_COMMAND");
  }
  if (targetDomain === XHS_WRITE_DOMAIN && actionType === "read") {
    pushReason(gateReasons, "ACTION_DOMAIN_MISMATCH");
  }
  if (targetDomain === XHS_READ_DOMAIN && actionType !== null && actionType !== "read") {
    pushReason(gateReasons, "ACTION_DOMAIN_MISMATCH");
  }
  return gateReasons;
};

const collectXhsMatrixGateReasons = (input) => {
  const gateReasons = Array.isArray(input.gateReasons) ? input.gateReasons : [];
  const state = input.state;
  if (state.issueScope === "issue_209" && state.isLiveReadMode && state.actionType === "read") {
    return collectIssue209LiveReadMatrixGateReasons({
      gateReasons,
      state,
      decisionId: input.decisionId ?? null,
      expectedApprovalId: input.expectedApprovalId ?? null,
      runId: input.runId ?? null,
      sessionId: input.sessionId ?? null,
      approvalRecord: input.approvalRecord,
      auditRecord: input.auditRecord,
      admissionContext: input.admissionContext,
      targetDomain: input.targetDomain,
      targetTabId: input.targetTabId,
      targetPage: input.targetPage
    });
  }

  const approvalRecord = normalizeXhsApprovalRecord(input.approvalRecord);
  const auditRecord = normalizeXhsAuditRecord(input.auditRecord);
  const admissionContext = normalizeXhsAdmissionContext(input.admissionContext);
  const approvalRecordHasConflictingLinkage = hasApprovalRecordConflictingLinkage(
    approvalRecord,
    input.decisionId
  );
  let writeGateOnlyEligible = false;
  let writeGateOnlyDecision = null;
  const issue753CreatorPublishAdmission =
    state.issueScope === "issue_753" &&
    state.actionType === "write" &&
    (state.requestedExecutionMode === "dry_run" || state.requestedExecutionMode === "recon");
  const issue755MediaUploadDiscovery =
    state.issueScope === "issue_755" &&
    state.actionType === "write" &&
    (state.requestedExecutionMode === "dry_run" || state.requestedExecutionMode === "recon");

  if (gateReasons.length === 0) {
    if (state.isBlockedByStateMatrix) {
      if (state.isLiveReadMode) {
        pushReason(gateReasons, `RISK_STATE_${state.riskState.toUpperCase()}`);
        pushReason(gateReasons, "ISSUE_ACTION_MATRIX_BLOCKED");
      } else {
        pushReason(gateReasons, "ISSUE_ACTION_BLOCKED_BY_STATE_MATRIX");
      }
    }

    if (
      (state.issue208WriteGateOnly || state.issue835ControlledLiveWrite) &&
      state.actionType !== null &&
      state.requestedExecutionMode !== null
    ) {
      const approvalRequirementGaps = resolveXhsApprovalRequirementGaps(
        [...XHS_WRITE_APPROVAL_REQUIREMENTS],
        approvalRecord
      );
      const approvalSatisfied =
        !approvalRecordHasConflictingLinkage && approvalRequirementGaps.length === 0;
      if (
        state.writeMatrixDecision?.decision === "blocked" ||
        state.writeMatrixDecision?.decision === "not_applicable"
      ) {
        if (state.issue208WriteGateOnly && input.issue208EditorInputValidation !== true) {
          pushReason(gateReasons, "EDITOR_INPUT_VALIDATION_REQUIRED");
        }
        if (
          approvalRecordHasConflictingLinkage ||
          !approvalRecord.approved ||
          !approvalRecord.approver ||
          !approvalRecord.approved_at
        ) {
          pushReason(gateReasons, "MANUAL_CONFIRMATION_MISSING");
        }
        if (XHS_REQUIRED_APPROVAL_CHECKS.some((key) => approvalRecord.checks[key] !== true)) {
          pushReason(gateReasons, "APPROVAL_CHECKS_INCOMPLETE");
        }
        pushReason(gateReasons, `RISK_STATE_${state.riskState.toUpperCase()}`);
        pushReason(gateReasons, "ISSUE_ACTION_MATRIX_BLOCKED");
      } else if (
        (state.issue835ControlledLiveWrite || input.issue208EditorInputValidation === true) &&
        state.riskState === "allowed" &&
        approvalSatisfied
      ) {
        writeGateOnlyEligible = true;
      } else {
        if (state.issue208WriteGateOnly && input.issue208EditorInputValidation !== true) {
          pushReason(gateReasons, "EDITOR_INPUT_VALIDATION_REQUIRED");
        }
        if (state.riskState !== "allowed") {
          pushReason(gateReasons, `RISK_STATE_${state.riskState.toUpperCase()}`);
          pushReason(gateReasons, "ISSUE_ACTION_MATRIX_BLOCKED");
        }
        if (
          approvalRecordHasConflictingLinkage ||
          !approvalRecord.approved ||
          !approvalRecord.approver ||
          !approvalRecord.approved_at
        ) {
          pushReason(gateReasons, "MANUAL_CONFIRMATION_MISSING");
        }
        if (XHS_REQUIRED_APPROVAL_CHECKS.some((key) => approvalRecord.checks[key] !== true)) {
          pushReason(gateReasons, "APPROVAL_CHECKS_INCOMPLETE");
        }
      }
      writeGateOnlyDecision = {
        issue_scope: state.issueScope,
        state: state.riskState,
        write_interaction_tier: state.writeActionMatrixDecisions?.write_interaction_tier ?? null,
        matrix_decision: writeGateOnlyEligible ? "conditional" : "blocked",
        matrix_actions: state.writeActionMatrixDecisions?.matrix_actions ?? [],
        required_approval: writeGateOnlyEligible ? [...XHS_WRITE_APPROVAL_REQUIREMENTS] : [],
        approval_satisfied: approvalSatisfied,
        approval_missing_requirements: approvalRequirementGaps,
        execution_enabled: writeGateOnlyEligible
      };
    } else if (
      state.actionType &&
      state.actionType !== "read" &&
      !issue753CreatorPublishAdmission &&
      !issue755MediaUploadDiscovery &&
      !state.issue835ControlledLiveWrite
    ) {
      if (state.isLiveReadMode) {
        pushReason(gateReasons, "ACTION_TYPE_MODE_MISMATCH");
      }
      pushReason(gateReasons, `RISK_STATE_${state.riskState.toUpperCase()}`);
      pushReason(gateReasons, "ISSUE_ACTION_MATRIX_BLOCKED");
    } else if (state.liveModeCanEnter) {
      const conditionalRequirement =
        state.requestedExecutionMode === null
          ? null
          : state.issueActionMatrix.conditional_actions.find(
              (entry) => entry.action === state.requestedExecutionMode
            ) ?? null;
      const liveRequirements = conditionalRequirement?.requires ?? [];
      const approvalAdmissionRequirementGaps = resolveXhsApprovalAdmissionRequirementGaps(
        liveRequirements.filter(
          (requirement) =>
            requirement === "approval_admission_evidence_approved_true" ||
            requirement === "approval_admission_evidence_approver_present" ||
            requirement === "approval_admission_evidence_approved_at_present" ||
            requirement === "approval_admission_evidence_checks_all_true" ||
            requirement === "risk_state_checked" ||
            requirement === "target_domain_confirmed" ||
            requirement === "target_tab_confirmed" ||
            requirement === "target_page_confirmed" ||
            requirement === "action_type_confirmed"
        ),
        admissionContext.approval_admission_evidence,
        {
          decisionId: input.decisionId ?? null,
          approvalId: input.expectedApprovalId ?? null,
          runId: input.runId ?? null,
          sessionId: input.sessionId ?? null,
          issueScope: state.issueScope,
          targetDomain: input.targetDomain,
          targetTabId: input.targetTabId,
          targetPage: input.targetPage,
          actionType: state.actionType,
          requestedExecutionMode: state.requestedExecutionMode
        }
      );
      const auditAdmissionRequirementGaps = resolveXhsAuditAdmissionRequirementGaps(
        admissionContext.audit_admission_evidence,
        {
          decisionId: input.decisionId ?? null,
          approvalId: input.expectedApprovalId ?? null,
          runId: input.runId ?? null,
          sessionId: input.sessionId ?? null,
          issueScope: state.issueScope,
          targetDomain: input.targetDomain,
          targetTabId: input.targetTabId,
          targetPage: input.targetPage,
          actionType: state.actionType,
          requestedExecutionMode: state.requestedExecutionMode,
          riskState: state.riskState
        },
        liveRequirements
      );
      const rolloutRequirementGaps =
        liveRequirements.includes("limited_read_rollout_ready_true") &&
        state.limitedReadRolloutReadyTrue !== true
          ? ["limited_read_rollout_ready_true"]
          : [];
      if (
        approvalRecordHasConflictingLinkage ||
        !approvalRecord.approved ||
        !approvalRecord.approver ||
        !approvalRecord.approved_at ||
        approvalAdmissionRequirementGaps.length > 0
      ) {
        pushReason(gateReasons, "MANUAL_CONFIRMATION_MISSING");
      }
      if (XHS_REQUIRED_APPROVAL_CHECKS.some((key) => approvalRecord.checks[key] !== true)) {
        pushReason(gateReasons, "APPROVAL_CHECKS_INCOMPLETE");
      }
      if (
        approvalAdmissionRequirementGaps.includes("approval_admission_evidence_checks_all_true")
      ) {
        pushReason(gateReasons, "APPROVAL_CHECKS_INCOMPLETE");
      }
      if (
        auditAdmissionRequirementGaps.includes("audit_admission_evidence_present") ||
        auditAdmissionRequirementGaps.includes("audit_admission_checks_all_true")
      ) {
        pushReason(gateReasons, "AUDIT_RECORD_MISSING");
      }
      if (rolloutRequirementGaps.length > 0) {
        pushReason(gateReasons, "LIMITED_READ_ROLLOUT_NOT_READY");
      }
    }
  }

  return {
    gateReasons,
    approvalRecord,
    auditRecord,
    admissionContext,
    writeGateOnlyEligible,
    writeGateOnlyDecision,
    writeGateOnlyApprovalDecision: writeGateOnlyDecision
  };
};

const evaluateXhsGate = (input) => {
  const state = buildXhsGatePolicyState(input);
  const decisionId = deriveGateDecisionId(input);
  const gateReasons = Array.isArray(input.additionalGateReasons)
    ? input.additionalGateReasons.filter((reason) => typeof reason === "string")
    : [];
  const behaviorBaselineGoalKind = resolveBehaviorBaselineGoalKind(input, state);
  const riskEvidenceConsumerGate = evaluateRiskEvidenceConsumerGate({
    riskEvidenceRequired: input.riskEvidenceRequired,
    risk_evidence_required: input.risk_evidence_required,
    riskEvidenceGateResult: input.riskEvidenceGateResult,
    risk_evidence_gate_result: input.risk_evidence_gate_result,
    behaviorBaselineHintRequired: input.behaviorBaselineHintRequired,
    behavior_baseline_hint_required: input.behavior_baseline_hint_required,
    behaviorBaselineHint: input.behaviorBaselineHint,
    behavior_baseline_hint: input.behavior_baseline_hint,
    behavior_baseline_scope: {
      profile_ref: asString(input.runtimeProfileRef ?? input.__runtime_profile_ref),
      target_domain:
        asString(input.actualTargetDomain) ??
        state.upstreamAuthorizationRequest?.runtime_target?.domain ??
        asString(input.targetDomain),
      requested_execution_mode: state.requestedExecutionMode,
      effective_execution_mode: state.requestedExecutionMode,
      probe_bundle_ref: resolveBehaviorBaselineProbeBundleRef(input, behaviorBaselineGoalKind),
      goal_kind: behaviorBaselineGoalKind
    },
    nonProofsObserved: input.nonProofsObserved,
    non_proofs_observed: input.non_proofs_observed,
    nonProofs: input.nonProofs,
    non_proofs: input.non_proofs
  });
  const platformBehaviorScopeBinding = deriveXhsPlatformBehaviorExpectedScope(input, state);
  const platformBehaviorAssessmentGate = applyPlatformBehaviorScopeBindingReasons(
    evaluatePlatformBehaviorAssessmentGate({
      required: input.platformBehaviorAssessmentRequired,
      platform_behavior_assessment_required: input.platform_behavior_assessment_required,
      platformBehaviorAssessment: input.platformBehaviorAssessment,
      platform_behavior_assessment: input.platform_behavior_assessment,
      platformBehaviorAssessmentContext: input.platformBehaviorAssessmentContext,
      platform_behavior_assessment_context: input.platform_behavior_assessment_context,
      platformBehaviorContext: input.platformBehaviorContext,
      platform_behavior_context: input.platform_behavior_context,
      expected_platform_behavior_scope: platformBehaviorScopeBinding.expectedScope,
      asOf: input.platformBehaviorAsOf ?? input.platform_behavior_as_of,
      freshnessWindowMs:
        input.platformBehaviorFreshnessWindowMs ?? input.platform_behavior_freshness_window_ms
    }),
    platformBehaviorScopeBinding.bindingReasons
  );
  for (const reason of riskEvidenceConsumerGate.gate_reasons) {
    pushReason(gateReasons, reason);
  }
  for (const reason of platformBehaviorAssessmentGate.gate_reasons) {
    pushReason(gateReasons, reason);
  }
  for (const reason of collectXhsPlatformBehaviorDecisionHintGateReasons(
    platformBehaviorAssessmentGate,
    state
  )) {
    pushReason(gateReasons, reason);
  }
  const expectedApprovalId = deriveApprovalId(input, decisionId);
  collectXhsCommandGateReasons({
    gateReasons,
    actionType: state.actionType,
    requestedExecutionMode: state.requestedExecutionMode,
    abilityAction: input.abilityAction ?? input.abilityActionType,
    targetDomain:
      state.upstreamAuthorizationRequest?.runtime_target?.domain ?? input.targetDomain,
    targetTabId:
      state.upstreamAuthorizationRequest?.runtime_target?.tab_id ?? input.targetTabId,
    targetPage:
      state.upstreamAuthorizationRequest?.runtime_target?.page ?? input.targetPage,
    actualTargetDomain: input.actualTargetDomain,
    actualTargetTabId: input.actualTargetTabId,
    actualTargetPage: input.actualTargetPage,
    requireActualTargetPage: input.requireActualTargetPage,
    issue208WriteGateOnly: state.issue208WriteGateOnly,
    issue835ControlledLiveWrite: state.issue835ControlledLiveWrite,
    issue208EditorInputValidation: input.issue208EditorInputValidation === true,
    treatMissingEditorValidationAsUnsupported:
      input.treatMissingEditorValidationAsUnsupported === true,
    includeWriteInteractionTierReason: input.includeWriteInteractionTierReason === true,
    writeTierReason: state.writeTierReason
  });
  const { approvalRecord, admissionContext, writeGateOnlyEligible } = collectXhsMatrixGateReasons({
    gateReasons,
    state,
    decisionId,
    expectedApprovalId,
    runId: asString(input.runId),
    sessionId: asString(input.sessionId),
    approvalRecord: input.approvalRecord,
    auditRecord: input.auditRecord,
    admissionContext: input.admissionContext,
    targetDomain:
      state.upstreamAuthorizationRequest?.runtime_target?.domain ?? input.targetDomain,
    targetTabId:
      state.upstreamAuthorizationRequest?.runtime_target?.tab_id ?? input.targetTabId,
    targetPage:
      state.upstreamAuthorizationRequest?.runtime_target?.page ?? input.targetPage,
    issue208EditorInputValidation: input.issue208EditorInputValidation === true,
    includeWriteInteractionTierReason: input.includeWriteInteractionTierReason === true
  });
  applyCanonicalAdmissionReasons({
    gateReasons,
    upstream: state.upstreamAuthorizationRequest,
    issueScope: state.issueScope,
    requestedExecutionMode: state.requestedExecutionMode,
    legacyRequestedExecutionMode: state.legacyRequestedExecutionMode,
    runtimeProfileRef: input.runtimeProfileRef ?? input.__runtime_profile_ref,
    actualTargetUrl: input.actualTargetUrl ?? input.__actual_target_url,
    admissionContext,
    anonymousIsolationVerified:
      input.anonymousIsolationVerified === true || input.__anonymous_isolation_verified === true,
    targetSiteLoggedIn: input.targetSiteLoggedIn === true || input.target_site_logged_in === true
  });
  const approvalId = expectedApprovalId;
  approvalRecord.approval_id = approvalId;
  approvalRecord.decision_id = decisionId;
  const outcome = finalizeXhsGateOutcome({
    gateReasons,
    state,
    writeGateOnlyEligible,
    writeGateOnlyEligibleBehavior:
      input.writeGateOnlyEligibleBehavior === "block" ? "block" : "allow"
  });
  const approvalActive =
    outcome.gateDecision === "allowed" &&
    (outcome.effectiveExecutionMode === "live_read_limited" ||
      outcome.effectiveExecutionMode === "live_read_high_risk" ||
      outcome.effectiveExecutionMode === "live_write");
  if (
    input.includeWriteInteractionTierReason === true &&
    state.issue208WriteGateOnly &&
    state.writeTierReason
  ) {
    pushReason(outcome.gateReasons, state.writeTierReason);
  }
  approvalRecord.approval_id = approvalActive ? approvalId : null;
  const requestAdmissionResult = evaluateRequestAdmissionResult({
    state,
    upstream: state.upstreamAuthorizationRequest,
    requestId: input.requestId,
    commandRequestId: input.commandRequestId,
    legacyRequestedExecutionMode: state.legacyRequestedExecutionMode,
    anonymousIsolationVerified:
      input.anonymousIsolationVerified === true || input.__anonymous_isolation_verified === true,
    targetSiteLoggedIn: input.targetSiteLoggedIn === true || input.target_site_logged_in === true,
    gateReasons: outcome.gateReasons,
    outcome,
    runId: input.runId,
    decisionId,
    admissionContext
  });
  const executionAuditRiskSignals = deriveExecutionAuditRiskSignals(
    requestAdmissionResult.reason_codes
  );
  const result = {
    scope_context: { ...XHS_SCOPE_CONTEXT },
    read_execution_policy: {
      default_mode: XHS_READ_EXECUTION_POLICY.default_mode,
      allowed_modes: [...XHS_READ_EXECUTION_POLICY.allowed_modes],
      blocked_actions: [...XHS_READ_EXECUTION_POLICY.blocked_actions],
      live_entry_requirements: [...XHS_READ_EXECUTION_POLICY.live_entry_requirements]
    },
    issue_action_matrix: state.issueActionMatrix,
    write_interaction_tier: WRITE_INTERACTION_TIER,
    write_action_matrix_decisions: state.writeActionMatrixDecisions,
    gate_input: {
      issue_scope: state.issueScope,
      target_domain:
        state.upstreamAuthorizationRequest?.runtime_target?.domain ?? asString(input.targetDomain),
      target_tab_id:
        state.upstreamAuthorizationRequest?.runtime_target?.tab_id ?? asInteger(input.targetTabId),
      target_page:
        state.upstreamAuthorizationRequest?.runtime_target?.page ?? asString(input.targetPage),
      action_type: state.actionType,
      requested_execution_mode: state.requestedExecutionMode,
      risk_state: state.riskState,
      session_rhythm_window_id: asString(input.sessionRhythmWindowId ?? input.__session_rhythm_window_id),
      session_rhythm_decision_id: asString(input.sessionRhythmDecisionId ?? input.__session_rhythm_decision_id),
      admission_context: admissionContext,
      ...(riskEvidenceConsumerGate.required
        ? { risk_evidence_consumer_gate: riskEvidenceConsumerGate }
        : {}),
      ...(platformBehaviorAssessmentGate.required
        ? { platform_behavior_assessment_gate: platformBehaviorAssessmentGate }
        : {})
    },
    gate_outcome: {
      decision_id: decisionId,
      effective_execution_mode: outcome.effectiveExecutionMode,
      gate_decision: outcome.gateDecision,
      gate_reasons: outcome.gateReasons,
      requires_manual_confirmation:
        state.requestedExecutionMode === "live_read_limited" ||
        state.requestedExecutionMode === "live_read_high_risk" ||
        state.requestedExecutionMode === "live_write"
    },
    consumer_gate_result: {
      issue_scope: state.issueScope,
      target_domain:
        state.upstreamAuthorizationRequest?.runtime_target?.domain ?? asString(input.targetDomain),
      target_tab_id:
        state.upstreamAuthorizationRequest?.runtime_target?.tab_id ?? asInteger(input.targetTabId),
      target_page:
        state.upstreamAuthorizationRequest?.runtime_target?.page ?? asString(input.targetPage),
      action_type: state.actionType,
      requested_execution_mode: state.requestedExecutionMode,
      effective_execution_mode: outcome.effectiveExecutionMode,
      gate_decision: outcome.gateDecision,
      gate_reasons: outcome.gateReasons,
      write_interaction_tier: state.writeActionMatrixDecisions?.write_interaction_tier ?? null,
      ...(riskEvidenceConsumerGate.required
        ? { risk_evidence_consumer_gate: riskEvidenceConsumerGate }
        : {}),
      ...(platformBehaviorAssessmentGate.required
        ? { platform_behavior_assessment_gate: platformBehaviorAssessmentGate }
        : {})
    },
    request_admission_result: requestAdmissionResult,
    approval_record: approvalRecord,
    execution_audit: null
  };
  if (
    state.issueScope === "issue_209" &&
    state.requestedExecutionMode &&
    XHS_LIVE_READ_EXECUTION_MODE_SET.has(state.requestedExecutionMode)
  ) {
    const postGateArtifacts = buildIssue209PostGateArtifacts({
      runId: asString(input.runId),
      sessionId: asString(input.sessionId),
      profile: asString(input.profile),
      gate: result,
      executionAuditRiskSignals,
      now: typeof input.now === "function" ? input.now : undefined
    });
    result.execution_audit = postGateArtifacts.execution_audit;
    const compatibilityRefs = asRecord(result.execution_audit?.compatibility_refs);
    const derivedFrom = asRecord(requestAdmissionResult?.derived_from);
    const explicitAdmissionContext = asRecord(result.gate_input?.admission_context);
    const explicitApprovalEvidence = asRecord(explicitAdmissionContext?.approval_admission_evidence);
    const explicitAuditEvidence = asRecord(explicitAdmissionContext?.audit_admission_evidence);
    const canBackfillApprovalAdmissionRef =
      asString(explicitApprovalEvidence?.approval_admission_ref) === null;
    const canBackfillAuditAdmissionRef =
      asString(explicitAuditEvidence?.audit_admission_ref) === null;
    const shouldBackfillCanonicalCompatibilityRefs =
      requestAdmissionResult?.admission_decision === "allowed" ||
      (requestAdmissionResult?.admission_decision === "blocked" &&
        requestAdmissionResult?.grant_match === true);
    if (compatibilityRefs && derivedFrom && shouldBackfillCanonicalCompatibilityRefs) {
      if (
        canBackfillApprovalAdmissionRef &&
        compatibilityRefs.approval_admission_ref === null &&
        typeof derivedFrom.approval_admission_ref === "string" &&
        derivedFrom.approval_admission_ref.length > 0
      ) {
        compatibilityRefs.approval_admission_ref = derivedFrom.approval_admission_ref;
      }
      if (
        canBackfillAuditAdmissionRef &&
        compatibilityRefs.audit_admission_ref === null &&
        typeof derivedFrom.audit_admission_ref === "string" &&
        derivedFrom.audit_admission_ref.length > 0
      ) {
        compatibilityRefs.audit_admission_ref = derivedFrom.audit_admission_ref;
      }
    }
  }
  return result;
};
return { XHS_ALLOWED_DOMAINS, XHS_READ_DOMAIN, XHS_WRITE_DOMAIN, buildIssue209PostGateArtifacts, evaluateXhsGate, resolveXhsGateDecisionId };
})();
const __webenvoy_module_xhs_search_types = (() => {
const SEARCH_ENDPOINT = "/api/sns/web/v1/search/notes";
const DETAIL_ENDPOINT = "/api/sns/web/v1/feed";
const USER_HOME_ENDPOINT = "/api/sns/web/v1/user_posted";
const WEBENVOY_SYNTHETIC_REQUEST_HEADER = "x-webenvoy-synthetic-request";
const MAIN_WORLD_EVENT_NAMESPACE = "webenvoy.main_world.bridge.v1";
const MAIN_WORLD_PAGE_CONTEXT_NAMESPACE_EVENT_PREFIX = "__mw_ns__";
const hashMainWorldEventChannel = (value) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
};
const asInteger = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
};
const toTrimmedString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const normalizeSearchRequestShapeInput = (input) => {
    const keyword = toTrimmedString(input.keyword);
    const page = input.page === undefined ? 1 : asInteger(input.page);
    const pageSizeInput = input.page_size !== undefined ? input.page_size : input.limit !== undefined ? input.limit : 20;
    const pageSize = asInteger(pageSizeInput);
    const sort = input.sort === undefined ? "general" : toTrimmedString(input.sort);
    const noteType = input.note_type === undefined ? 0 : asInteger(input.note_type);
    if (!keyword || page === null || pageSize === null || sort === null || noteType === null) {
        return null;
    }
    return {
        keyword,
        page,
        page_size: pageSize,
        sort,
        note_type: noteType
    };
};
const createSearchRequestShape = (input) => {
    const normalized = normalizeSearchRequestShapeInput(input);
    if (!normalized) {
        return null;
    }
    return {
        command: "xhs.search",
        method: "POST",
        pathname: SEARCH_ENDPOINT,
        ...normalized
    };
};
const serializeSearchRequestShape = (shape) => JSON.stringify(shape);
const createDetailRequestShape = (input) => {
    const noteId = toTrimmedString(input.note_id ?? input.source_note_id);
    if (!noteId) {
        return null;
    }
    return {
        command: "xhs.detail",
        method: "POST",
        pathname: DETAIL_ENDPOINT,
        note_id: noteId
    };
};
const serializeDetailRequestShape = (shape) => JSON.stringify(shape);
const createUserHomeRequestShape = (input) => {
    const userId = toTrimmedString(input.user_id);
    if (!userId) {
        return null;
    }
    return {
        command: "xhs.user_home",
        method: "GET",
        pathname: USER_HOME_ENDPOINT,
        user_id: userId
    };
};
const serializeUserHomeRequestShape = (shape) => JSON.stringify(shape);
const resolveMainWorldPageContextNamespaceEventName = (secret) => `${MAIN_WORLD_PAGE_CONTEXT_NAMESPACE_EVENT_PREFIX}${hashMainWorldEventChannel(`${MAIN_WORLD_EVENT_NAMESPACE}|namespace|${secret.trim()}`)}`;
const createPageContextNamespace = (href) => {
    const normalized = href.trim();
    if (normalized.length === 0) {
        return "about:blank";
    }
    try {
        const parsed = new URL(normalized, "https://www.xiaohongshu.com/");
        const pathname = parsed.pathname.length > 0 ? parsed.pathname : "/";
        const queryIdentity = parsed.search.length > 0 ? `${pathname}${parsed.search}` : pathname;
        const documentTimeOrigin = typeof globalThis.performance?.timeOrigin === "number" &&
            Number.isFinite(globalThis.performance.timeOrigin)
            ? Math.trunc(globalThis.performance.timeOrigin)
            : null;
        return documentTimeOrigin === null
            ? `${parsed.origin}${queryIdentity}`
            : `${parsed.origin}${queryIdentity}#doc=${documentTimeOrigin}`;
    }
    catch {
        return normalized;
    }
};
const createVisitedPageContextNamespace = (href, visitSequence) => {
    const baseNamespace = createPageContextNamespace(href);
    return visitSequence > 0 ? `${baseNamespace}|visit=${visitSequence}` : baseNamespace;
};
const stripVisitedPageContextNamespace = (namespace) => {
    const visitSuffixIndex = namespace.indexOf("|visit=");
    return visitSuffixIndex >= 0 ? namespace.slice(0, visitSuffixIndex) : namespace;
};
const resolveActiveVisitedPageContextNamespace = (requestedNamespace, currentVisitedNamespace) => {
    const normalizedRequested = typeof requestedNamespace === "string" && requestedNamespace.length > 0
        ? requestedNamespace
        : null;
    const normalizedCurrentVisited = typeof currentVisitedNamespace === "string" && currentVisitedNamespace.length > 0
        ? currentVisitedNamespace
        : null;
    if (normalizedRequested &&
        normalizedCurrentVisited &&
        normalizedRequested === stripVisitedPageContextNamespace(normalizedCurrentVisited)) {
        return normalizedCurrentVisited;
    }
    return normalizedRequested ?? normalizedCurrentVisited;
};
return { DETAIL_ENDPOINT, SEARCH_ENDPOINT, USER_HOME_ENDPOINT, WEBENVOY_SYNTHETIC_REQUEST_HEADER, createPageContextNamespace, createDetailRequestShape, createSearchRequestShape, createUserHomeRequestShape, createVisitedPageContextNamespace, resolveActiveVisitedPageContextNamespace, resolveMainWorldPageContextNamespaceEventName, serializeSearchRequestShape };
})();
const __webenvoy_module_xhs_search_telemetry = (() => {
const { SEARCH_ENDPOINT } = __webenvoy_module_xhs_search_types;
const {
  buildUnifiedRiskStateOutput,
  resolveRiskState: resolveSharedRiskState
} = __webenvoy_module_risk_state;
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asArray = (value) => (Array.isArray(value) ? value : null);
const asInteger = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
};
const resolveRiskState = (value) => resolveSharedRiskState(value);
const SEARCH_FAILURE_SEMANTICS = {
    SIGNATURE_ENTRY_MISSING: {
        category: "page_changed",
        stage: "action",
        component: "page",
        target: "window._webmsxyw",
        includeKeyRequest: false
    },
    REQUEST_CONTEXT_MISSING: {
        category: "page_changed",
        stage: "action",
        component: "page",
        target: "captured_request_context",
        includeKeyRequest: false
    },
    REQUEST_CONTEXT_INCOMPATIBLE: {
        category: "page_changed",
        stage: "action",
        component: "page",
        target: "captured_request_context",
        includeKeyRequest: false
    },
    XHS_LOGIN_REQUIRED: {
        category: "page_changed",
        stage: "action",
        component: "page",
        target: "xhs.account_safety_surface",
        includeKeyRequest: false
    },
    XHS_ACCOUNT_RISK_PAGE: {
        category: "page_changed",
        stage: "action",
        component: "page",
        target: "xhs.account_safety_surface",
        includeKeyRequest: false
    },
    SESSION_EXPIRED: {
        category: "request_failed",
        stage: "request",
        component: "network",
        target: SEARCH_ENDPOINT,
        includeKeyRequest: true
    },
    ACCOUNT_ABNORMAL: {
        category: "request_failed",
        stage: "request",
        component: "network",
        target: SEARCH_ENDPOINT,
        includeKeyRequest: true
    },
    BROWSER_ENV_ABNORMAL: {
        category: "request_failed",
        stage: "request",
        component: "network",
        target: SEARCH_ENDPOINT,
        includeKeyRequest: true
    },
    GATEWAY_INVOKER_FAILED: {
        category: "request_failed",
        stage: "request",
        component: "network",
        target: SEARCH_ENDPOINT,
        includeKeyRequest: true
    },
    CAPTCHA_REQUIRED: {
        category: "request_failed",
        stage: "request",
        component: "network",
        target: SEARCH_ENDPOINT,
        includeKeyRequest: true
    }
};
const PAGE_SURFACE_ACCOUNT_SAFETY_REASONS = new Set([
    "XHS_LOGIN_REQUIRED",
    "ACCOUNT_ABNORMAL",
    "XHS_ACCOUNT_RISK_PAGE",
    "CAPTCHA_REQUIRED",
    "BROWSER_ENV_ABNORMAL"
]);
const extractUrlPath = (href) => {
    try {
        return new URL(href).pathname.toLowerCase();
    }
    catch {
        return href.split(/[?#]/u, 1)[0]?.toLowerCase() ?? "";
    }
};
const classifyPageKind = (href) => {
    const path = extractUrlPath(href);
    if (path.includes("/login")) {
        return "login";
    }
    if (href.includes("creator.xiaohongshu.com/publish")) {
        return "compose";
    }
    if (/\/search_result\/[^/?#]+/u.test(path)) {
        return "detail";
    }
    if (path.includes("/search_result")) {
        return "search";
    }
    if (path.includes("/explore/")) {
        return "detail";
    }
    return "unknown";
};
const normalizeSurfaceText = (value) => (value ?? "").replace(/\s+/gu, "");
const hasSpecificOverlaySelector = (selector) => typeof selector === "string" &&
    selector.length > 0 &&
    selector !== '[role="dialog"]' &&
    selector !== '[aria-modal="true"]';
const hasXhsAccountSafetyOverlaySignal = (value) => {
    const overlayText = normalizeSurfaceText(value);
    return ((overlayText.includes("请完成验证") &&
        (overlayText.includes("滑块") ||
            overlayText.includes("验证码") ||
            overlayText.includes("人机验证"))) ||
        (overlayText.includes("当前访问存在安全风险") &&
            (overlayText.includes("验证后继续访问") || overlayText.includes("继续访问"))) ||
        (overlayText.includes("登录后推荐更懂你的笔记") &&
            overlayText.includes("扫码") &&
            overlayText.includes("输入手机号")) ||
        overlayText.includes("账号异常") ||
        overlayText.includes("浏览器环境异常") ||
        overlayText.toLowerCase().includes("browserenvironmentabnormal"));
};
const classifyXhsAccountSafetySurface = (input) => {
    const path = extractUrlPath(input.href);
    const overlayText = hasSpecificOverlaySelector(input.overlay?.selector)
        ? normalizeSurfaceText(input.overlay?.text)
        : "";
    if (path.includes("captcha")) {
        return {
            reason: "CAPTCHA_REQUIRED",
            message: "平台要求额外人机验证，无法继续执行"
        };
    }
    if (overlayText.includes("请完成验证") &&
        (overlayText.includes("滑块") || overlayText.includes("验证码") || overlayText.includes("人机验证"))) {
        return {
            reason: "CAPTCHA_REQUIRED",
            message: "平台要求额外人机验证，无法继续执行"
        };
    }
    if (path.includes("/security") ||
        path.includes("/risk")) {
        return {
            reason: "XHS_ACCOUNT_RISK_PAGE",
            message: "当前页面命中小红书账号风险或安全验证页面"
        };
    }
    if (overlayText.includes("当前访问存在安全风险") &&
        (overlayText.includes("验证后继续访问") || overlayText.includes("继续访问"))) {
        return {
            reason: "XHS_ACCOUNT_RISK_PAGE",
            message: "当前页面命中小红书账号风险或安全验证页面"
        };
    }
    if (path.includes("/login")) {
        return {
            reason: "XHS_LOGIN_REQUIRED",
            message: "当前页面要求登录小红书，无法继续执行"
        };
    }
    if (overlayText.includes("登录后推荐更懂你的笔记") &&
        overlayText.includes("扫码") &&
        overlayText.includes("输入手机号")) {
        return {
            reason: "XHS_LOGIN_REQUIRED",
            message: "当前页面要求登录小红书，无法继续执行"
        };
    }
    if (overlayText.includes("账号异常")) {
        return {
            reason: "ACCOUNT_ABNORMAL",
            message: "账号异常，平台拒绝当前请求"
        };
    }
    if (overlayText.includes("浏览器环境异常") ||
        overlayText.toLowerCase().includes("browserenvironmentabnormal")) {
        return {
            reason: "BROWSER_ENV_ABNORMAL",
            message: "浏览器环境异常，平台拒绝当前请求"
        };
    }
    return null;
};
const resolveDiagnosisSemantics = (reason, fallbackCategory) => {
    if (fallbackCategory === "page_changed" && PAGE_SURFACE_ACCOUNT_SAFETY_REASONS.has(reason)) {
        return {
            category: "page_changed",
            stage: "action",
            component: "page",
            target: "xhs.account_safety_surface",
            includeKeyRequest: false
        };
    }
    return SEARCH_FAILURE_SEMANTICS[reason] ?? {
        category: fallbackCategory ?? "request_failed",
        stage: "request",
        component: "network",
        target: SEARCH_ENDPOINT,
        includeKeyRequest: true
    };
};
const createObservability = (input) => ({
    page_state: {
        page_kind: classifyPageKind(input.href),
        url: input.href,
        title: input.title,
        ready_state: input.readyState
    },
    key_requests: input.includeKeyRequest === false
        ? []
        : [
            {
                request_id: input.requestId,
                stage: "request",
                method: "POST",
                url: SEARCH_ENDPOINT,
                outcome: input.outcome,
                ...(typeof input.statusCode === "number" ? { status_code: input.statusCode } : {}),
                ...(input.failureReason ? { failure_reason: input.failureReason, request_class: "xhs.search" } : {})
            }
        ],
    failure_site: input.outcome === "failed"
        ? (input.failureSite ?? {
            stage: "request",
            component: "network",
            target: SEARCH_ENDPOINT,
            summary: input.failureReason ?? "request failed"
        })
        : null
});
const createDiagnosis = (input) => {
    const semantics = resolveDiagnosisSemantics(input.reason, input.category);
    return {
        category: semantics.category,
        stage: semantics.stage,
        component: semantics.component,
        failure_site: {
            stage: semantics.stage,
            component: semantics.component,
            target: semantics.target,
            summary: input.summary
        },
        evidence: [input.reason, input.summary, ...(input.evidence ?? [])]
    };
};
const createFailure = (code, message, details, observability, diagnosis, gate, auditRecord) => ({
    ok: false,
    error: {
        code,
        message
    },
    payload: {
        details,
        observability,
        diagnosis,
        ...(gate
            ? {
                scope_context: gate.scope_context,
                gate_input: {
                    run_id: auditRecord?.run_id ?? "unknown",
                    session_id: auditRecord?.session_id ?? "unknown",
                    profile: auditRecord?.profile ?? "unknown",
                    ...gate.gate_input
                },
                gate_outcome: gate.gate_outcome,
                read_execution_policy: gate.read_execution_policy,
                issue_action_matrix: gate.issue_action_matrix,
                write_interaction_tier: gate.write_interaction_tier,
                write_action_matrix_decisions: gate.write_action_matrix_decisions,
                consumer_gate_result: gate.consumer_gate_result,
                request_admission_result: gate.request_admission_result,
                approval_record: gate.approval_record,
                risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                ...(auditRecord ? { audit_record: auditRecord } : {})
            }
            : {})
    }
});
const resolveRiskStateOutput = (gate, auditRecord) => buildUnifiedRiskStateOutput(resolveRiskState(auditRecord?.next_state ?? gate.gate_input.risk_state), {
    auditRecords: auditRecord ? [auditRecord] : [],
    now: auditRecord?.recorded_at ?? Date.now()
});
const buildEditorInputEvidence = (result) => ({
    validation_action: "editor_input",
    target_page: "creator.xiaohongshu.com/publish",
    validation_mode: result.mode,
    validation_attestation: result.attestation,
    editor_locator: result.editor_locator,
    input_text: result.input_text,
    before_text: result.before_text,
    visible_text: result.visible_text,
    post_blur_text: result.post_blur_text,
    focus_confirmed: result.focus_confirmed,
    focus_attestation_source: result.focus_attestation_source,
    focus_attestation_reason: result.focus_attestation_reason,
    preserved_after_blur: result.preserved_after_blur,
    success_signals: result.success_signals,
    failure_signals: result.failure_signals,
    minimum_replay: result.minimum_replay,
    out_of_scope_actions: ["image_upload", "submit", "publish_confirm"]
});
const isTrustedEditorInputValidation = (result) => result.ok &&
    result.mode === "controlled_editor_input_validation" &&
    result.attestation === "controlled_real_interaction";
const resolveSimulatedResult = (simulated, params, options, env) => {
    if (!simulated) {
        return null;
    }
    const requestId = `req-${env.randomId()}`;
    if (simulated === "success") {
        const observability = createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId,
            outcome: "completed"
        });
        return {
            ok: true,
            payload: {
                summary: {
                    capability_result: {
                        ability_id: "xhs.note.search.v1",
                        layer: "L3",
                        action: "read",
                        outcome: "success",
                        data_ref: {
                            query: params.query,
                            search_id: params.search_id ?? "simulated-search-id"
                        },
                        metrics: {
                            count: Number(options.timeout_ms ?? 2) > 0 ? 2 : 2
                        }
                    }
                },
                observability
            }
        };
    }
    const reasonMap = {
        login_required: {
            reason: "SESSION_EXPIRED",
            message: "登录态缺失，无法执行 xhs.search"
        },
        signature_entry_missing: {
            reason: "SIGNATURE_ENTRY_MISSING",
            message: "页面签名入口不可用"
        },
        account_abnormal: {
            reason: "ACCOUNT_ABNORMAL",
            message: "账号异常，平台拒绝当前请求"
        },
        browser_env_abnormal: {
            reason: "BROWSER_ENV_ABNORMAL",
            message: "浏览器环境异常，平台拒绝当前请求"
        },
        captcha_required: {
            reason: "CAPTCHA_REQUIRED",
            message: "平台要求额外人机验证，无法继续执行"
        },
        generic_api_warning: {
            reason: "TARGET_API_RESPONSE_INVALID",
            message: "搜索接口返回了未识别的失败响应"
        },
        gateway_invoker_failed: {
            reason: "GATEWAY_INVOKER_FAILED",
            message: "网关调用失败，当前上下文不足以完成搜索请求"
        }
    };
    const mapped = reasonMap[simulated] ?? reasonMap.gateway_invoker_failed;
    const semantics = resolveDiagnosisSemantics(mapped.reason);
    const observability = createObservability({
        href: env.getLocationHref(),
        title: env.getDocumentTitle(),
        readyState: env.getReadyState(),
        requestId,
        outcome: "failed",
        statusCode: simulated === "account_abnormal"
            ? 461
            : simulated === "browser_env_abnormal"
                ? 200
                : simulated === "captcha_required"
                    ? 429
                    : simulated === "generic_api_warning"
                        ? 400
                        : simulated === "gateway_invoker_failed"
                            ? 500
                            : undefined,
        failureReason: simulated,
        includeKeyRequest: semantics.includeKeyRequest,
        failureSite: {
            stage: semantics.stage,
            component: semantics.component,
            target: semantics.target,
            summary: mapped.message
        }
    });
    return createFailure("ERR_EXECUTION_FAILED", mapped.message, {
        stage: "execution",
        reason: mapped.reason
    }, observability, createDiagnosis({
        reason: mapped.reason,
        summary: mapped.message
    }));
};
const parseCount = (body) => {
    const record = asRecord(body);
    if (!record) {
        return 0;
    }
    const data = asRecord(record.data);
    const candidateArrays = [
        asArray(record.items),
        asArray(record.notes),
        data ? asArray(data.items) : null,
        data ? asArray(data.notes) : null
    ];
    for (const candidate of candidateArrays) {
        if (candidate) {
            return candidate.length;
        }
    }
    const total = data?.total;
    return typeof total === "number" && Number.isFinite(total) ? total : 0;
};
const inferFailure = (status, body) => {
    const record = asRecord(body);
    const businessCode = asInteger(record?.code);
    const message = typeof record?.msg === "string" ? record.msg : typeof record?.message === "string" ? record.message : "";
    const normalized = `${message}`.toLowerCase();
    const hasCaptchaEvidence = normalized.includes("captcha") ||
        message.includes("验证码") ||
        message.includes("人机验证") ||
        message.includes("滑块");
    if (status === 401 || normalized.includes("login")) {
        return {
            reason: "SESSION_EXPIRED",
            message: "登录已失效，无法执行 xhs.search"
        };
    }
    if (status === 461 || businessCode === 300011) {
        return {
            reason: "ACCOUNT_ABNORMAL",
            message: "账号异常，平台拒绝当前请求"
        };
    }
    if (businessCode === 300015 || normalized.includes("browser environment abnormal")) {
        return {
            reason: "BROWSER_ENV_ABNORMAL",
            message: "浏览器环境异常，平台拒绝当前请求"
        };
    }
    if (status >= 500 || normalized.includes("create invoker failed")) {
        return {
            reason: "GATEWAY_INVOKER_FAILED",
            message: "网关调用失败，当前上下文不足以完成搜索请求"
        };
    }
    if (hasCaptchaEvidence) {
        return {
            reason: "CAPTCHA_REQUIRED",
            message: "平台要求额外人机验证，无法继续执行"
        };
    }
    return {
        reason: "TARGET_API_RESPONSE_INVALID",
        message: "搜索接口返回了未识别的失败响应"
    };
};
const inferRequestException = (error) => {
    const errorName = typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : "";
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorName === "AbortError") {
        return {
            reason: "REQUEST_TIMEOUT",
            message: "请求超时，无法完成 xhs.search",
            detail: errorMessage
        };
    }
    return {
        reason: "REQUEST_DISPATCH_FAILED",
        message: "搜索请求发送失败，无法完成 xhs.search",
        detail: errorMessage
    };
};
const resolveXsCommon = (value) => {
    if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
    }
    return "{}";
};
const containsCookie = (cookie, key) => cookie
    .split(";")
    .map((item) => item.trim())
    .some((item) => item.startsWith(`${key}=`));
return { buildEditorInputEvidence, classifyXhsAccountSafetySurface, containsCookie, createDiagnosis, createFailure, createObservability, hasXhsAccountSafetyOverlaySignal, inferFailure, inferRequestException, isTrustedEditorInputValidation, parseCount, resolveSimulatedResult, resolveRiskStateOutput, resolveXsCommon };
})();
const __webenvoy_module_xhs_search_gate = (() => {
const {
  buildRiskTransitionAudit,
  resolveIssueScope: resolveSharedIssueScope,
  resolveRiskState: resolveSharedRiskState
} = __webenvoy_module_risk_state;
const {
  evaluateXhsGate,
  resolveXhsGateDecisionId,
  XHS_READ_DOMAIN,
  XHS_WRITE_DOMAIN,
  buildIssue209PostGateArtifacts
} = __webenvoy_module_shared_xhs_gate;
const { resolveRiskStateOutput } = __webenvoy_module_xhs_search_telemetry;
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const hasOwn = (record, key) => record !== null && record !== undefined && Object.prototype.hasOwnProperty.call(record, key);
const asNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const asRecordArray = (value) => Array.isArray(value)
    ? value.filter((item) => asRecord(item) !== null)
    : [];
const asInteger = (value) => typeof value === "number" && Number.isInteger(value) ? value : null;
const asOptionalBoolean = (value) => typeof value === "boolean" ? value : null;
const resolveRiskState = (value) => resolveSharedRiskState(value);
const resolveIssueScope = (value) => resolveSharedIssueScope(value);
const isIssue208EditorInputValidation = (options) => options.issue_scope === "issue_208" &&
    options.action_type === "write" &&
    options.requested_execution_mode === "live_write" &&
    options.validation_action === "editor_input";
const shouldDeferAnonymousCanonicalGateDiagnostics = (input) => {
    const resourceBinding = asRecord(input.upstreamAuthorizationRequest?.resource_binding);
    return (resourceBinding?.resource_kind === "anonymous_context" &&
        (input.anonymousIsolationVerified === null || input.targetSiteLoggedIn === null));
};
const buildGateDecisionId = (context, options) => resolveXhsGateDecisionId({
    runId: context.runId,
    requestId: context.requestId,
    commandRequestId: context.commandRequestId,
    gateInvocationId: context.gateInvocationId,
    issueScope: options.issue_scope,
    requestedExecutionMode: options.requested_execution_mode
});
const buildGateEventId = (decisionId) => `gate_evt_${decisionId}`;
const resolveActualTargetGateReasons = (options) => {
    const gateReasons = [];
    const targetDomain = asNonEmptyString(options.target_domain);
    const targetTabId = asInteger(options.target_tab_id);
    const targetPage = asNonEmptyString(options.target_page);
    const actualTargetDomain = asNonEmptyString(options.actual_target_domain);
    const actualTargetTabId = asInteger(options.actual_target_tab_id);
    const actualTargetPage = asNonEmptyString(options.actual_target_page);
    if (actualTargetDomain && targetDomain && actualTargetDomain !== targetDomain) {
        gateReasons.push("TARGET_DOMAIN_CONTEXT_MISMATCH");
    }
    if (actualTargetTabId !== null && targetTabId !== null && actualTargetTabId !== targetTabId) {
        gateReasons.push("TARGET_TAB_CONTEXT_MISMATCH");
    }
    if (targetPage && !actualTargetPage) {
        gateReasons.push("TARGET_PAGE_CONTEXT_UNRESOLVED");
    }
    if (actualTargetPage && targetPage && actualTargetPage !== targetPage) {
        gateReasons.push("TARGET_PAGE_CONTEXT_MISMATCH");
    }
    return gateReasons;
};
const resolveGate = (options, context, actualTargetUrl) => {
    const providedApprovalRecord = (options.approval_record ?? options.approval);
    const approvalRecord = asRecord(providedApprovalRecord);
    const decisionId = buildGateDecisionId(context, options);
    const approvalId = asNonEmptyString(approvalRecord?.approval_id) ?? undefined;
    const anonymousIsolationVerified = asOptionalBoolean(options.__anonymous_isolation_verified);
    const targetSiteLoggedIn = asOptionalBoolean(options.target_site_logged_in);
    const gate = evaluateXhsGate({
        issueScope: options.issue_scope,
        riskState: options.risk_state,
        targetDomain: options.target_domain,
        targetTabId: options.target_tab_id,
        targetPage: options.target_page,
        actualTargetDomain: options.actual_target_domain,
        actualTargetTabId: options.actual_target_tab_id,
        actualTargetPage: options.actual_target_page,
        actualTargetUrl,
        requireActualTargetPage: true,
        actionType: options.action_type,
        abilityAction: options.ability_action,
        requestedExecutionMode: options.requested_execution_mode,
        legacyRequestedExecutionMode: options.__legacy_requested_execution_mode,
        runtimeProfileRef: options.__runtime_profile_ref ?? context.profile,
        sessionRhythmWindowId: options.__session_rhythm_window_id,
        sessionRhythmDecisionId: options.__session_rhythm_decision_id,
        upstreamAuthorizationRequest: options.upstream_authorization_request,
        ...(anonymousIsolationVerified !== null ? { anonymousIsolationVerified } : {}),
        ...(targetSiteLoggedIn !== null ? { targetSiteLoggedIn } : {}),
        runId: context.runId,
        sessionId: context.sessionId,
        requestId: context.requestId,
        commandRequestId: context.commandRequestId,
        gateInvocationId: context.gateInvocationId,
        approvalRecord: providedApprovalRecord,
        auditRecord: options.audit_record,
        admissionContext: options.admission_context,
        limitedReadRolloutReadyTrue: options.limited_read_rollout_ready_true === true,
        risk_evidence_required: options.risk_evidence_required === true,
        risk_evidence_gate_result: options.risk_evidence_gate_result,
        behavior_baseline_hint_required: options.behavior_baseline_hint_required === true,
        behavior_baseline_hint: options.behavior_baseline_hint,
        non_proofs_observed: options.non_proofs_observed,
        platform_behavior_assessment_required: options.platform_behavior_assessment_required === true,
        platform_behavior_assessment: options.platform_behavior_assessment,
        platform_behavior_assessment_context: options.platform_behavior_assessment_context,
        expected_platform_behavior_scope: options.expected_platform_behavior_scope,
        platform_behavior_as_of: options.platform_behavior_as_of,
        platform_behavior_freshness_window_ms: options.platform_behavior_freshness_window_ms,
        additionalGateReasons: Array.isArray(options.admission_gate_reasons)
            ? options.admission_gate_reasons.filter((reason) => typeof reason === "string")
            : [],
        decisionId,
        approvalId,
        issue208EditorInputValidation: isIssue208EditorInputValidation(options),
        controlledLiveWrite: options.controlled_live_write === true || options.issue_scope === "issue_835",
        treatMissingEditorValidationAsUnsupported: true
    });
    if (shouldDeferAnonymousCanonicalGateDiagnostics({
        upstreamAuthorizationRequest: options.upstream_authorization_request,
        anonymousIsolationVerified,
        targetSiteLoggedIn
    })) {
        return {
            ...gate,
            request_admission_result: null,
            execution_audit: null
        };
    }
    return gate;
};
const createAuditRecord = (context, gate, env) => {
    if (gate.gate_input.issue_scope === "issue_209" &&
        (gate.consumer_gate_result.requested_execution_mode === "live_read_limited" ||
            gate.consumer_gate_result.requested_execution_mode === "live_read_high_risk")) {
        const artifacts = buildIssue209PostGateArtifacts({
            runId: context.runId,
            sessionId: context.sessionId,
            profile: context.profile,
            gate: gate,
            now: () => env.now()
        });
        gate.approval_record = artifacts.approval_record;
        return artifacts.audit_record;
    }
    const recordedAt = new Date(env.now()).toISOString();
    const requestedMode = gate.consumer_gate_result.requested_execution_mode;
    const liveModeRequested = requestedMode === "live_read_limited" ||
        requestedMode === "live_read_high_risk" ||
        requestedMode === "live_write";
    const riskSignal = gate.consumer_gate_result.gate_decision === "blocked" && liveModeRequested;
    const recoverySignal = gate.consumer_gate_result.gate_decision === "allowed" &&
        gate.gate_input.risk_state === "limited" &&
        liveModeRequested;
    const auditRecord = {
        event_id: buildGateEventId(gate.gate_outcome.decision_id),
        decision_id: gate.gate_outcome.decision_id,
        approval_id: gate.approval_record.approval_id,
        run_id: context.runId,
        session_id: context.sessionId,
        profile: context.profile,
        issue_scope: gate.gate_input.issue_scope,
        risk_state: gate.gate_input.risk_state,
        target_domain: gate.consumer_gate_result.target_domain,
        target_tab_id: gate.consumer_gate_result.target_tab_id,
        target_page: gate.consumer_gate_result.target_page,
        action_type: gate.consumer_gate_result.action_type,
        requested_execution_mode: requestedMode,
        effective_execution_mode: gate.consumer_gate_result.effective_execution_mode,
        gate_decision: gate.consumer_gate_result.gate_decision,
        gate_reasons: [...gate.consumer_gate_result.gate_reasons],
        approver: gate.approval_record.approver,
        approved_at: gate.approval_record.approved_at,
        write_interaction_tier: gate.write_action_matrix_decisions?.write_interaction_tier ?? null,
        write_action_matrix_decisions: gate.write_action_matrix_decisions,
        risk_signal: riskSignal,
        recovery_signal: recoverySignal,
        session_rhythm_state: riskSignal ? "cooldown" : recoverySignal ? "recovery" : "normal",
        cooldown_until: riskSignal ? new Date(env.now() + 30 * 60_000).toISOString() : null,
        recovery_started_at: recoverySignal ? recordedAt : null,
        recorded_at: recordedAt
    };
    const transitionAudit = buildRiskTransitionAudit({
        runId: context.runId,
        sessionId: context.sessionId,
        issueScope: gate.gate_input.issue_scope,
        prevState: gate.gate_input.risk_state,
        decision: gate.consumer_gate_result.gate_decision,
        gateReasons: [...gate.consumer_gate_result.gate_reasons],
        requestedExecutionMode: gate.consumer_gate_result.requested_execution_mode,
        approvalRecord: gate.approval_record,
        auditRecords: [auditRecord],
        now: recordedAt
    });
    auditRecord.next_state = transitionAudit.next_state;
    auditRecord.transition_trigger = transitionAudit.trigger;
    return auditRecord;
};
const createGateOnlySuccess = (input, gate, auditRecord, env) => ({
    ok: true,
    payload: {
        summary: {
            capability_result: {
                ability_id: input.abilityId,
                layer: input.abilityLayer,
                action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                outcome: "partial",
                data_ref: input.params.target_page
                    ? {
                        target_page: input.params.target_page
                    }
                    : {
                        query: input.params.query
                    },
                metrics: {
                    count: 0
                }
            },
            ...(input.params.target_page
                ? {
                    target_admission: {
                        target_domain: gate.consumer_gate_result.target_domain,
                        target_tab_id: gate.consumer_gate_result.target_tab_id,
                        target_page: gate.consumer_gate_result.target_page,
                        profile_readiness: asRecord(input.options?.profile_readiness),
                        account_readiness: asRecord(input.options?.account_readiness),
                        account_safety_gate_result: asRecord(input.options?.account_safety_gate_result),
                        provider_requirement_refs: Array.isArray(input.options?.provider_requirement_refs)
                            ? input.options.provider_requirement_refs
                            : [],
                        xhs_driver_provider_requirements: asRecord(input.options?.xhs_driver_provider_requirements),
                        default_live_write_commit_lock: asRecord(input.options?.xhs_driver_provider_requirements)
                            ?.default_live_write_commit_lock ?? null,
                        out_of_scope_actions: ["editor_text_write", "image_upload", "submit", "publish_confirm"]
                    }
                }
                : {}),
            ...(asRecord(input.options?.xhs_driver_provider_requirements)
                ? {
                    xhs_driver_provider_requirements: asRecord(input.options?.xhs_driver_provider_requirements) ?? {}
                }
                : {}),
            ...(asStringArray(input.options?.provider_requirement_refs).length > 0
                ? { provider_requirement_refs: asStringArray(input.options?.provider_requirement_refs) }
                : {}),
            ...(asNonEmptyString(input.options?.runtime_binding_ref)
                ? { runtime_binding_ref: asNonEmptyString(input.options?.runtime_binding_ref) }
                : {}),
            ...(asNonEmptyString(input.options?.target_binding_snapshot_ref)
                ? {
                    target_binding_snapshot_ref: asNonEmptyString(input.options?.target_binding_snapshot_ref)
                }
                : {}),
            ...(asRecord(input.options?.xhs_runtime_binding)
                ? { xhs_runtime_binding: asRecord(input.options?.xhs_runtime_binding) ?? {} }
                : {}),
            ...(asRecord(input.options?.target_binding_snapshot)
                ? { target_binding_snapshot: asRecord(input.options?.target_binding_snapshot) ?? {} }
                : {}),
            ...(asRecordArray(input.options?.target_binding_transition_evidence).length > 0
                ? {
                    target_binding_transition_evidence: asRecordArray(input.options?.target_binding_transition_evidence)
                }
                : {}),
            ...(asStringArray(input.options?.downstream_slice_refs).length > 0
                ? { downstream_slice_refs: asStringArray(input.options?.downstream_slice_refs) }
                : {}),
            ...(input.options?.risk_evidence_required === true ? { risk_evidence_required: true } : {}),
            ...(hasOwn(input.options, "risk_evidence_gate_result")
                ? { risk_evidence_gate_result: input.options?.risk_evidence_gate_result }
                : {}),
            ...(input.options?.behavior_baseline_hint_required === true
                ? { behavior_baseline_hint_required: true }
                : {}),
            ...(hasOwn(input.options, "behavior_baseline_hint")
                ? { behavior_baseline_hint: input.options?.behavior_baseline_hint }
                : {}),
            ...(hasOwn(input.options, "non_proofs_observed")
                ? { non_proofs_observed: input.options?.non_proofs_observed }
                : {}),
            ...(input.options?.platform_behavior_assessment_required === true
                ? { platform_behavior_assessment_required: true }
                : {}),
            ...(hasOwn(input.options, "platform_behavior_assessment")
                ? { platform_behavior_assessment: input.options?.platform_behavior_assessment }
                : {}),
            ...(hasOwn(input.options, "platform_behavior_assessment_context")
                ? {
                    platform_behavior_assessment_context: input.options?.platform_behavior_assessment_context
                }
                : {}),
            ...(hasOwn(input.options, "expected_platform_behavior_scope")
                ? { expected_platform_behavior_scope: input.options?.expected_platform_behavior_scope }
                : {}),
            ...(asNonEmptyString(input.options?.platform_behavior_as_of)
                ? { platform_behavior_as_of: asNonEmptyString(input.options?.platform_behavior_as_of) }
                : {}),
            ...(typeof input.options?.platform_behavior_freshness_window_ms === "number"
                ? {
                    platform_behavior_freshness_window_ms: input.options.platform_behavior_freshness_window_ms
                }
                : {}),
            ...(asStringArray(input.options?.non_proofs).length > 0
                ? { non_proofs: asStringArray(input.options?.non_proofs) }
                : {}),
            ...(asNonEmptyString(input.options?.page_runtime_readiness_ref)
                ? { page_runtime_readiness_ref: asNonEmptyString(input.options?.page_runtime_readiness_ref) }
                : {}),
            ...(asRecord(input.options?.xhs_page_runtime_readiness)
                ? { xhs_page_runtime_readiness: asRecord(input.options?.xhs_page_runtime_readiness) ?? {} }
                : {}),
            ...(asNonEmptyString(input.options?.page_runtime_readiness_decision)
                ? {
                    page_runtime_readiness_decision: asNonEmptyString(input.options?.page_runtime_readiness_decision)
                }
                : {}),
            ...(asStringArray(input.options?.page_runtime_readiness_blocking_reasons).length > 0
                ? {
                    page_runtime_readiness_blocking_reasons: asStringArray(input.options?.page_runtime_readiness_blocking_reasons)
                }
                : {}),
            scope_context: gate.scope_context,
            gate_input: {
                run_id: auditRecord.run_id,
                session_id: auditRecord.session_id,
                profile: auditRecord.profile,
                ...gate.gate_input
            },
            gate_outcome: gate.gate_outcome,
            read_execution_policy: gate.read_execution_policy,
            issue_action_matrix: gate.issue_action_matrix,
            write_interaction_tier: gate.write_interaction_tier,
            write_action_matrix_decisions: gate.write_action_matrix_decisions,
            consumer_gate_result: gate.consumer_gate_result,
            request_admission_result: gate.request_admission_result,
            execution_audit: gate.execution_audit,
            approval_record: gate.approval_record,
            risk_state_output: resolveRiskStateOutput(gate, auditRecord),
            audit_record: auditRecord
        },
        observability: {
            page_state: {
                page_kind: env.getLocationHref().includes("/login")
                    ? "login"
                    : env.getLocationHref().includes("creator.xiaohongshu.com/publish")
                        ? "compose"
                        : env.getLocationHref().includes("/search_result")
                            ? "search"
                            : env.getLocationHref().includes("/explore/")
                                ? "detail"
                                : "unknown",
                url: env.getLocationHref(),
                title: env.getDocumentTitle(),
                ready_state: env.getReadyState()
            },
            key_requests: [],
            failure_site: null
        }
    }
});
return { createAuditRecord, createGateOnlySuccess, resolveGate };
})();
const __webenvoy_module_layer2_humanized_events = (() => {
const DEFAULT_RHYTHM_PROFILE = {
    profile_name: "default_layer2",
    hover_confirm_min_ms: 80,
    hover_confirm_max_ms: 200,
    click_jitter_min_px: 2,
    click_jitter_max_px: 8,
    typing_delay_min_ms: 60,
    typing_delay_max_ms: 220,
    punctuation_pause_multiplier: 1.8,
    long_pause_probability: 0.08,
    scroll_segment_min_px: 120,
    scroll_segment_max_px: 480,
    lookback_probability: 0.12
};
const LAYER2_BEHAVIOR_EVIDENCE_BASELINE = [
    {
        event_family: "pointer_click",
        action_kind: "click",
        required_path: "real_input",
        allowed_fallback_path: "synthetic_chain",
        required_events_or_signals: ["mousedown", "mouseup", "click", "dom_settled"],
        page_state_input: ["target_visible", "target_interactable", "occlusion_clear"],
        trace_fields: ["action_kind", "selected_path", "event_chain", "settled_wait_result"],
        test_type: ["selector_contract", "orchestrator_contract", "relay_contract"],
        downstream_issue: ["#738", "#740", "#741"]
    },
    {
        event_family: "pointer_hover",
        action_kind: "hover",
        required_path: "real_input",
        allowed_fallback_path: null,
        required_events_or_signals: ["mousemove", "mouseover", "hover_confirm"],
        page_state_input: ["target_visible", "viewport_stable"],
        trace_fields: ["action_kind", "rhythm_profile_source", "page_state_input_summary"],
        test_type: ["rhythm_contract", "content_script_contract"],
        downstream_issue: ["#738", "#741"]
    },
    {
        event_family: "focus_navigation",
        action_kind: "focus",
        required_path: "real_input",
        allowed_fallback_path: "synthetic_chain",
        required_events_or_signals: ["focus", "active_element_check"],
        page_state_input: ["target_visible", "target_interactable", "target_not_disabled"],
        trace_fields: ["action_kind", "selected_path", "failure_category"],
        test_type: ["selector_contract", "page_state_contract"],
        downstream_issue: ["#738", "#739"]
    },
    {
        event_family: "keyboard_text",
        action_kind: "keyboard_input",
        required_path: "real_input",
        allowed_fallback_path: "synthetic_chain",
        required_events_or_signals: ["keydown", "input", "keyup", "change"],
        page_state_input: ["target_focused_or_focusable", "target_not_readonly"],
        trace_fields: ["required_events_applied", "rhythm_profile_source", "settled_wait_result"],
        test_type: ["orchestrator_contract", "framework_state_contract"],
        downstream_issue: ["#738", "#739", "#740"]
    },
    {
        event_family: "composition_text",
        action_kind: "composition_input",
        required_path: "mixed_input",
        allowed_fallback_path: "synthetic_chain",
        required_events_or_signals: [
            "compositionstart",
            "compositionupdate",
            "compositionend",
            "input",
            "change",
            "blur"
        ],
        page_state_input: ["target_focused_or_focusable", "target_not_readonly"],
        trace_fields: ["event_chain", "fallback_reason", "failure_category"],
        test_type: ["chain_policy_contract", "controlled_component_contract"],
        downstream_issue: ["#738", "#739", "#740"]
    },
    {
        event_family: "scroll_viewport",
        action_kind: "scroll",
        required_path: "real_input",
        allowed_fallback_path: null,
        required_events_or_signals: ["wheel", "scroll", "viewport_position_changed"],
        page_state_input: ["viewport_stable_or_scrolling", "layout_motion"],
        trace_fields: ["rhythm_profile_source", "page_state_input_summary", "settled_wait_result"],
        test_type: ["rhythm_contract", "settle_contract"],
        downstream_issue: ["#738", "#739", "#741"]
    },
    {
        event_family: "change_blur_finalize",
        action_kind: "keyboard_input",
        required_path: "real_input",
        allowed_fallback_path: "synthetic_chain",
        required_events_or_signals: ["change", "blur", "framework_value_finalized"],
        page_state_input: ["target_focused_or_recently_edited"],
        trace_fields: ["required_events_applied", "settled_wait_result"],
        test_type: ["chain_policy_contract", "write_boundary_contract"],
        downstream_issue: ["#739", "#740", "#741"]
    }
];
const STRATEGY_PROFILES = {
    click: {
        action_kind: "click",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: false,
        requires_hover_confirm: true,
        requires_settled_wait: true,
        blocked_when_tier: ["irreversible_write"]
    },
    focus: {
        action_kind: "focus",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: true,
        requires_hover_confirm: false,
        requires_settled_wait: true,
        blocked_when_tier: ["irreversible_write"]
    },
    keyboard_input: {
        action_kind: "keyboard_input",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: true,
        requires_hover_confirm: false,
        requires_settled_wait: true,
        blocked_when_tier: ["irreversible_write"]
    },
    composition_input: {
        action_kind: "composition_input",
        preferred_path: "mixed_input",
        fallback_path: "synthetic_chain",
        requires_focus: true,
        requires_hover_confirm: false,
        requires_settled_wait: true,
        blocked_when_tier: ["irreversible_write"]
    },
    hover: {
        action_kind: "hover",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: false,
        requires_hover_confirm: true,
        requires_settled_wait: false,
        blocked_when_tier: []
    },
    scroll: {
        action_kind: "scroll",
        preferred_path: "real_input",
        fallback_path: "synthetic_chain",
        requires_focus: false,
        requires_hover_confirm: false,
        requires_settled_wait: true,
        blocked_when_tier: []
    }
};
const EVENT_CHAINS = {
    click: {
        chain_name: "hover_click",
        action_kind: "click",
        required_events: ["mousemove", "mouseover", "mousedown", "mouseup", "click"],
        optional_events: ["pointermove", "pointerdown", "pointerup"],
        completion_signal: ["dom_settled"],
        requires_settled_wait: true
    },
    focus: {
        chain_name: "focus_acquire",
        action_kind: "focus",
        required_events: ["focus"],
        optional_events: ["mousedown", "mouseup", "click"],
        completion_signal: ["document_active_element_matched"],
        requires_settled_wait: true
    },
    keyboard_input: {
        chain_name: "keyboard_input",
        action_kind: "keyboard_input",
        required_events: ["focus", "keydown", "input", "keyup", "change", "blur"],
        optional_events: ["mousedown", "mouseup", "click"],
        completion_signal: ["dom_settled", "framework_value_updated"],
        requires_settled_wait: true
    },
    composition_input: {
        chain_name: "composition_input",
        action_kind: "composition_input",
        required_events: [
            "focus",
            "compositionstart",
            "compositionupdate",
            "compositionend",
            "input",
            "change",
            "blur"
        ],
        optional_events: ["mousedown", "mouseup", "click"],
        completion_signal: ["dom_settled", "framework_value_updated"],
        requires_settled_wait: true
    },
    hover: {
        chain_name: "hover_confirm",
        action_kind: "hover",
        required_events: ["mousemove", "mouseover"],
        optional_events: ["pointermove"],
        completion_signal: ["hover_confirmed"],
        requires_settled_wait: false
    },
    scroll: {
        chain_name: "scroll_segment",
        action_kind: "scroll",
        required_events: ["wheel", "scroll"],
        optional_events: ["mousemove"],
        completion_signal: ["viewport_position_changed", "dom_settled"],
        requires_settled_wait: true
    }
};
const CHANGE_BLUR_FINALIZE_CHAIN = {
    chain_name: "change_blur_finalize",
    action_kind: "keyboard_input",
    required_events: ["change", "blur"],
    optional_events: ["input"],
    completion_signal: ["framework_value_finalized", "dom_settled"],
    requires_settled_wait: true
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const getLayer2EventChainPolicies = () => [
    ...Object.values(EVENT_CHAINS).map((chain) => clone(chain)),
    clone(CHANGE_BLUR_FINALIZE_CHAIN)
];
const getLayer2BehaviorEvidenceBaseline = () => clone(LAYER2_BEHAVIOR_EVIDENCE_BASELINE);
const buildLayer2EventChainPlan = (evidence) => {
    const selectedPath = evidence.strategy_selection.selected_path;
    const blocked = selectedPath === "blocked";
    return {
        action_kind: evidence.strategy_selection.action_kind,
        selected_path: selectedPath,
        event_chain: evidence.strategy_selection.event_chain,
        required_steps: blocked ? [] : [...evidence.event_chain_policy.required_events],
        optional_steps: blocked ? [] : [...evidence.event_chain_policy.optional_events],
        completion_signal: blocked ? [] : [...evidence.event_chain_policy.completion_signal],
        requires_settled_wait: blocked ? false : evidence.event_chain_policy.requires_settled_wait,
        settled_wait_result: blocked ? "skipped" : evidence.execution_trace.settled_wait_result,
        blocked_by: evidence.strategy_selection.blocked_by
    };
};
const resolveLayer2RhythmTiming = (evidence) => {
    const actionKind = evidence.strategy_selection.action_kind;
    const rhythm = evidence.rhythm_profile;
    const requiresHover = evidence.event_strategy_profile.requires_hover_confirm;
    const requiresClickJitter = actionKind === "click";
    const requiresTyping = actionKind === "keyboard_input" || actionKind === "composition_input";
    const requiresScroll = actionKind === "scroll";
    return {
        action_kind: actionKind,
        rhythm_profile: rhythm.profile_name,
        hover_confirm_ms: requiresHover
            ? {
                min: rhythm.hover_confirm_min_ms,
                max: rhythm.hover_confirm_max_ms
            }
            : null,
        click_jitter_px: requiresClickJitter
            ? {
                min: rhythm.click_jitter_min_px,
                max: rhythm.click_jitter_max_px
            }
            : null,
        typing_delay_ms: requiresTyping
            ? {
                min: rhythm.typing_delay_min_ms,
                max: rhythm.typing_delay_max_ms
            }
            : null,
        scroll_segment_px: requiresScroll
            ? {
                min: rhythm.scroll_segment_min_px,
                max: rhythm.scroll_segment_max_px
            }
            : null,
        punctuation_pause_multiplier: requiresTyping ? rhythm.punctuation_pause_multiplier : null,
        long_pause_probability: requiresTyping ? rhythm.long_pause_probability : null,
        lookback_probability: requiresScroll ? rhythm.lookback_probability : null
    };
};
const buildLayer2RhythmPlan = (evidence, input) => {
    const selectedPath = evidence.strategy_selection.selected_path;
    if (selectedPath === "blocked") {
        return {
            action_kind: evidence.strategy_selection.action_kind,
            selected_path: selectedPath,
            rhythm_profile: "default_layer2",
            steps: [],
            blocked_by: evidence.strategy_selection.blocked_by
        };
    }
    const timing = resolveLayer2RhythmTiming(evidence);
    const steps = [];
    if (timing.hover_confirm_ms) {
        steps.push({
            step_kind: "hover_confirm",
            event_ref: "mouseover",
            delay_ms: timing.hover_confirm_ms,
            offset_px: null,
            delta_px: null,
            probability: null
        });
    }
    if (timing.click_jitter_px) {
        steps.push({
            step_kind: "click_jitter",
            event_ref: "click",
            delay_ms: null,
            offset_px: timing.click_jitter_px,
            delta_px: null,
            probability: null
        });
    }
    if (timing.typing_delay_ms) {
        const text = input?.text;
        if (typeof text === "string" && text.length > 0) {
            for (const character of text) {
                const punctuationPause = isLayer2Punctuation(character);
                steps.push({
                    step_kind: punctuationPause ? "punctuation_pause" : "typing_delay",
                    event_ref: "input",
                    delay_ms: punctuationPause
                        ? scaleRange(timing.typing_delay_ms, timing.punctuation_pause_multiplier ?? 1)
                        : timing.typing_delay_ms,
                    offset_px: null,
                    delta_px: null,
                    probability: null
                });
            }
            if (timing.long_pause_probability !== null) {
                steps.push({
                    step_kind: "long_pause",
                    event_ref: "input",
                    delay_ms: scaleRange(timing.typing_delay_ms, 3),
                    offset_px: null,
                    delta_px: null,
                    probability: timing.long_pause_probability
                });
            }
        }
    }
    if (timing.scroll_segment_px) {
        const segmentCount = clampLayer2SegmentCount(input?.scrollSegmentCount ?? 1);
        for (let index = 0; index < segmentCount; index += 1) {
            steps.push({
                step_kind: "scroll_segment",
                event_ref: "wheel",
                delay_ms: null,
                offset_px: null,
                delta_px: timing.scroll_segment_px,
                probability: null
            });
        }
        if (input?.includeLookback && timing.lookback_probability !== null) {
            steps.push({
                step_kind: "lookback",
                event_ref: "wheel",
                delay_ms: null,
                offset_px: null,
                delta_px: reverseRange(timing.scroll_segment_px),
                probability: timing.lookback_probability
            });
        }
    }
    return {
        action_kind: evidence.strategy_selection.action_kind,
        selected_path: selectedPath,
        rhythm_profile: "default_layer2",
        steps,
        blocked_by: null
    };
};
const buildLayer2ScheduledEventChain = (evidence, input) => {
    const eventChain = buildLayer2EventChainPlan(evidence);
    if (eventChain.blocked_by) {
        return {
            action_kind: eventChain.action_kind,
            selected_path: eventChain.selected_path,
            event_chain: eventChain.event_chain,
            scheduled_events: [],
            completion_signal: [],
            requires_settled_wait: false,
            blocked_by: eventChain.blocked_by
        };
    }
    const rhythmPlan = buildLayer2RhythmPlan(evidence, input);
    const stepsByEvent = new Map();
    for (const step of rhythmPlan.steps) {
        const current = stepsByEvent.get(step.event_ref) ?? [];
        current.push(step);
        stepsByEvent.set(step.event_ref, current);
    }
    const scheduledEvents = eventChain.required_steps.flatMap((eventRef) => {
        const rhythmSteps = stepsByEvent.get(eventRef) ?? [];
        if (eventRef === "wheel" && rhythmSteps.length > 1) {
            return rhythmSteps.map((step) => ({
                sequence_index: 0,
                event_ref: eventRef,
                required: true,
                rhythm_steps: [step]
            }));
        }
        return [
            {
                sequence_index: 0,
                event_ref: eventRef,
                required: true,
                rhythm_steps: rhythmSteps
            }
        ];
    });
    const indexedScheduledEvents = scheduledEvents.map((event, index) => ({
        ...event,
        sequence_index: index
    }));
    return {
        action_kind: eventChain.action_kind,
        selected_path: eventChain.selected_path,
        event_chain: eventChain.event_chain,
        scheduled_events: indexedScheduledEvents,
        completion_signal: eventChain.completion_signal,
        requires_settled_wait: eventChain.requires_settled_wait,
        blocked_by: null
    };
};
const dispatchLayer2ScheduledEventChain = (target, schedule, input) => {
    if (schedule.blocked_by) {
        return {
            action_kind: schedule.action_kind,
            selected_path: schedule.selected_path,
            event_chain: schedule.event_chain,
            dispatched_events: [],
            required_events_applied: [],
            skipped_events: [],
            text_applied: null,
            scroll_delta_applied: null,
            blocked_by: schedule.blocked_by
        };
    }
    const dispatchedEvents = [];
    const skippedEvents = [];
    const appliedRequiredIndexes = new Set();
    const text = typeof input?.text === "string" ? input.text : null;
    const fallbackScrollDeltaY = resolveLayer2ScrollDelta(schedule.action_kind, input?.scrollDeltaY ?? null);
    const scrollDeltasApplied = [];
    const textWasApplied = text !== null && appliesLayer2Text(schedule.action_kind);
    for (const scheduledEvent of schedule.scheduled_events) {
        const eventRef = scheduledEvent.event_ref;
        const recordDispatch = (applied) => {
            if (applied) {
                dispatchedEvents.push(eventRef);
                if (scheduledEvent.required) {
                    appliedRequiredIndexes.add(scheduledEvent.sequence_index);
                }
            }
            else {
                skippedEvents.push(eventRef);
            }
        };
        if (eventRef === "focus") {
            target.focus?.();
            recordDispatch(dispatchLayer2Event(target, eventRef));
            continue;
        }
        if (eventRef === "blur") {
            target.blur?.();
            recordDispatch(dispatchLayer2Event(target, eventRef));
            continue;
        }
        if (eventRef === "input" && text !== null && appliesLayer2Text(schedule.action_kind)) {
            applyLayer2TextValue(target, text);
            recordDispatch(dispatchLayer2Event(target, eventRef, { text }));
            continue;
        }
        if (eventRef === "change" && textWasApplied) {
            recordDispatch(dispatchLayer2Event(target, eventRef));
            continue;
        }
        if ((eventRef === "wheel" || eventRef === "scroll") && fallbackScrollDeltaY !== null) {
            const scrollDeltaY = resolveLayer2ScheduledScrollDelta(scheduledEvent, fallbackScrollDeltaY);
            if (eventRef === "wheel") {
                const applied = dispatchLayer2Event(target, eventRef, { deltaY: scrollDeltaY });
                recordDispatch(applied);
                if (applied) {
                    scrollDeltasApplied.push(scrollDeltaY);
                }
            }
            else {
                input?.windowLike?.scrollBy?.({ top: scrollDeltaY, left: 0, behavior: "auto" });
                recordDispatch(dispatchLayer2Event(target, eventRef));
            }
            continue;
        }
        recordDispatch(dispatchLayer2Event(target, eventRef, { text }));
    }
    return {
        action_kind: schedule.action_kind,
        selected_path: schedule.selected_path,
        event_chain: schedule.event_chain,
        dispatched_events: dispatchedEvents,
        required_events_applied: schedule.scheduled_events
            .filter((event) => event.required && appliedRequiredIndexes.has(event.sequence_index))
            .map((event) => event.event_ref),
        skipped_events: skippedEvents,
        text_applied: textWasApplied ? text : null,
        scroll_delta_applied: scrollDeltasApplied.length > 0 ? scrollDeltasApplied : null,
        blocked_by: null
    };
};
const resolveLayer2SettleRecovery = (input) => {
    const pageState = input.pageStateInput;
    const observedSignals = normalizeLayer2ObservedSignals(input.observedSignals);
    const timeoutMs = normalizeLayer2Timeout(input.timeoutMs);
    const elapsedMs = normalizeLayer2Elapsed(input.elapsedMs);
    const targetDrifted = !pageState.target_visible ||
        !pageState.target_interactable ||
        pageState.occlusion_state === "blocked" ||
        pageState.last_chain_result === "target_drifted";
    const layoutMotionBlocking = pageState.viewport_state === "resizing" ||
        pageState.layout_motion === "animating" ||
        pageState.layout_motion === "loading";
    const timedOut = timeoutMs !== null && elapsedMs !== null && elapsedMs >= timeoutMs;
    const completionSignalsObserved = observedSignals.filter((signal) => input.completionSignal.includes(signal));
    const completionObserved = completionSignalsObserved.length > 0;
    const pageSettled = pageState.viewport_state === "stable" &&
        pageState.occlusion_state === "clear" &&
        pageState.layout_motion === "idle" &&
        pageState.last_chain_result === "settled";
    if (targetDrifted) {
        return buildLayer2SettleRecoveryResult({
            pageState,
            completionSignalsObserved,
            settledWaitApplied: false,
            settledWaitResult: "skipped",
            recoveryAction: "fail_closed",
            failureCategory: "target_drifted",
            targetDrifted,
            layoutMotionBlocking,
            timeoutMs
        });
    }
    if (layoutMotionBlocking) {
        return buildLayer2SettleRecoveryResult({
            pageState,
            completionSignalsObserved,
            settledWaitApplied: false,
            settledWaitResult: "skipped",
            recoveryAction: "reobserve",
            failureCategory: null,
            targetDrifted,
            layoutMotionBlocking,
            timeoutMs
        });
    }
    if (completionObserved || pageSettled) {
        return buildLayer2SettleRecoveryResult({
            pageState,
            completionSignalsObserved,
            settledWaitResult: "settled",
            recoveryAction: "none",
            failureCategory: null,
            targetDrifted,
            layoutMotionBlocking,
            timeoutMs
        });
    }
    return buildLayer2SettleRecoveryResult({
        pageState,
        completionSignalsObserved,
        settledWaitResult: "timeout",
        recoveryAction: timedOut ? "fail_closed" : "retry",
        failureCategory: timedOut ? "framework_state_not_updated" : null,
        targetDrifted,
        layoutMotionBlocking,
        timeoutMs
    });
};
const buildLayer2WriteBoundaryAudit = (input) => {
    const outOfScopeActions = normalizeLayer2StringList(input.outOfScopeActions);
    const appliedRequiredEvents = normalizeLayer2StringList(input.dispatchResult?.required_events_applied);
    const blockedBy = outOfScopeActions.length > 0
        ? "FR-0013.out_of_scope_action"
        : input.evidence.strategy_selection.blocked_by ?? input.dispatchResult?.blocked_by ?? null;
    const requiredEvents = resolveLayer2AuditRequiredEvents(input.evidence, input.schedule ?? null);
    const requiredEventsMissing = blockedBy !== null
        ? []
        : requiredEvents.filter((eventRef) => !appliedRequiredEvents.includes(eventRef));
    const dispatchFailureEvents = normalizeLayer2StringList(input.dispatchResult?.skipped_events);
    const dispatchFailed = requiredEventsMissing.length > 0 || dispatchFailureEvents.length > 0;
    const recoveryAction = input.settleRecoveryResult?.recovery_action ?? null;
    const boundaryDecision = blockedBy !== null
        ? "block"
        : dispatchFailed || recoveryAction === "fail_closed"
            ? "fail_closed"
            : "allow";
    const failureCategory = input.settleRecoveryResult?.failure_category ??
        input.evidence.execution_trace.failure_category ??
        (dispatchFailed ? "required_event_not_applied" : null);
    return {
        action_kind: input.evidence.strategy_selection.action_kind,
        write_interaction_tier: normalizeLayer2String(input.writeInteractionTierName),
        boundary_decision: boundaryDecision,
        blocked_by: blockedBy,
        approval_record_ref: normalizeLayer2String(input.approvalRecordRef),
        audit_record_ref: normalizeLayer2String(input.auditRecordRef),
        out_of_scope_actions: outOfScopeActions,
        synthetic_fallback_blocked: blockedBy === "FR-0011.write_interaction_tier" &&
            input.evidence.event_strategy_profile.fallback_path === "synthetic_chain",
        required_events_applied: appliedRequiredEvents,
        required_events_missing: requiredEventsMissing,
        dispatch_failure_events: dispatchFailureEvents,
        settled_wait_result: input.settleRecoveryResult?.settled_wait_result ??
            input.evidence.execution_trace.settled_wait_result,
        recovery_action: recoveryAction,
        failure_category: failureCategory,
        audit_reasons: buildLayer2WriteBoundaryAuditReasons({
            blockedBy,
            dispatchFailed,
            outOfScopeActions,
            recoveryAction,
            failureCategory
        })
    };
};
const buildLayer2InteractionEvidence = (input) => {
    const strategy = clone(STRATEGY_PROFILES[input.actionKind]);
    const chain = clone(EVENT_CHAINS[input.actionKind]);
    const rhythm = clone(DEFAULT_RHYTHM_PROFILE);
    const gateOnlyBlockedBy = input.executionApplied === false ? "FR-0013.gate_only_probe_no_event_chain" : null;
    const tierBlockedBy = input.writeInteractionTierName &&
        strategy.blocked_when_tier.includes(input.writeInteractionTierName)
        ? "FR-0011.write_interaction_tier"
        : null;
    const blockedBy = gateOnlyBlockedBy ?? tierBlockedBy;
    const selectedPath = blockedBy ? "blocked" : strategy.preferred_path;
    const settledWaitApplied = selectedPath !== "blocked" && chain.requires_settled_wait;
    const settledWaitResult = selectedPath === "blocked"
        ? "skipped"
        : settledWaitApplied
            ? input.settledWaitResult ?? "timeout"
            : "skipped";
    return {
        event_strategy_profile: strategy,
        event_chain_policy: chain,
        rhythm_profile: rhythm,
        strategy_selection: {
            action_kind: input.actionKind,
            selected_path: selectedPath,
            strategy_profile: `${input.actionKind}_default`,
            event_chain: chain.chain_name,
            rhythm_profile: rhythm.profile_name,
            fallback_reason: null,
            blocked_by: blockedBy
        },
        execution_trace: {
            action_kind: input.actionKind,
            selected_path: selectedPath,
            event_chain: chain.chain_name,
            rhythm_profile_source: input.rhythmProfileSource ?? "default",
            settled_wait_applied: settledWaitApplied,
            settled_wait_result: settledWaitResult,
            failure_category: tierBlockedBy ? "blocked_by_fr0011" : null
        }
    };
};
const buildXhsSearchLayer2InteractionEvidence = (input) => {
    if (input.recoveryProbe && input.requestedExecutionMode === "recon") {
        return buildLayer2InteractionEvidence({
            actionKind: "scroll",
            writeInteractionTierName: input.writeInteractionTierName ?? null,
            executionApplied: input.executionApplied ?? false
        });
    }
    const actionKind = normalizeHumanizedActionKind(input.humanizedActionKind);
    if (!actionKind) {
        return null;
    }
    return buildLayer2InteractionEvidence({
        actionKind,
        writeInteractionTierName: input.writeInteractionTierName ?? null,
        settledWaitResult: input.settledWaitResult ?? "settled",
        executionApplied: input.executionApplied ?? false
    });
};
const normalizeHumanizedActionKind = (value) => {
    if (!value) {
        return null;
    }
    if (value === "keyboard_input" || value === "composition_input" || value === "scroll") {
        return value;
    }
    if (value === "hover_click") {
        return "click";
    }
    if (value === "focus_acquire") {
        return "focus";
    }
    if (value === "hover_confirm") {
        return "hover";
    }
    return null;
};
const scaleRange = (range, multiplier) => ({
    min: Math.round(range.min * multiplier),
    max: Math.round(range.max * multiplier)
});
const reverseRange = (range) => ({
    min: -range.max,
    max: -range.min
});
const clampLayer2SegmentCount = (value) => {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.max(1, Math.min(8, Math.trunc(value)));
};
const isLayer2Punctuation = (value) => /[,.!?;:，。！？；：]/u.test(value);
const normalizeLayer2ObservedSignals = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length > 0) : [];
const normalizeLayer2String = (value) => typeof value === "string" && value.length > 0 ? value : null;
const normalizeLayer2StringList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length > 0) : [];
const normalizeLayer2Timeout = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
const normalizeLayer2Elapsed = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
const buildLayer2SettleRecoveryResult = (input) => ({
    settled_wait_applied: input.settledWaitApplied ?? true,
    settled_wait_result: input.settledWaitResult,
    recovery_action: input.recoveryAction,
    page_state_input_summary: summarizeLayer2PageStateInput(input.pageState),
    completion_signal_observed: input.completionSignalsObserved,
    failure_category: input.failureCategory,
    target_drifted: input.targetDrifted,
    layout_motion_blocking: input.layoutMotionBlocking,
    timeout_ms: input.timeoutMs
});
const resolveLayer2AuditRequiredEvents = (evidence, schedule) => {
    if (schedule) {
        return schedule.scheduled_events
            .filter((event) => event.required)
            .map((event) => event.event_ref);
    }
    return evidence.event_chain_policy.required_events;
};
const buildLayer2WriteBoundaryAuditReasons = (input) => {
    const reasons = [];
    if (input.blockedBy) {
        reasons.push(input.blockedBy);
    }
    if (input.outOfScopeActions.length > 0) {
        reasons.push("out_of_scope_action");
    }
    if (input.dispatchFailed) {
        reasons.push("required_event_not_applied");
    }
    if (input.recoveryAction === "fail_closed") {
        reasons.push("settle_recovery_fail_closed");
    }
    if (input.failureCategory) {
        reasons.push(input.failureCategory);
    }
    return [...new Set(reasons)];
};
const summarizeLayer2PageStateInput = (pageState) => [
    pageState.target_visible ? "target_visible" : "target_hidden",
    pageState.target_interactable ? "interactable" : "not_interactable",
    pageState.target_focused ? "focused" : "not_focused",
    pageState.target_disabled ? "disabled" : "enabled",
    pageState.target_readonly ? "readonly" : "editable",
    `viewport_${pageState.viewport_state}`,
    `occlusion_${pageState.occlusion_state}`,
    `layout_${pageState.layout_motion}`,
    `last_${pageState.last_chain_result}`
].join("_");
const appliesLayer2Text = (actionKind) => actionKind === "keyboard_input" || actionKind === "composition_input";
const applyLayer2TextValue = (target, text) => {
    if ("value" in target) {
        target.value = text;
    }
};
const resolveLayer2ScrollDelta = (actionKind, requestedDelta) => {
    if (actionKind !== "scroll") {
        return null;
    }
    if (typeof requestedDelta === "number" && Number.isFinite(requestedDelta)) {
        return Math.trunc(requestedDelta);
    }
    return DEFAULT_RHYTHM_PROFILE.scroll_segment_min_px;
};
const resolveLayer2ScheduledScrollDelta = (scheduledEvent, fallbackDelta) => {
    const rhythmDelta = scheduledEvent.rhythm_steps.find((step) => step.step_kind === "scroll_segment")?.delta_px;
    return typeof rhythmDelta?.min === "number" && Number.isFinite(rhythmDelta.min)
        ? Math.trunc(rhythmDelta.min)
        : fallbackDelta;
};
const dispatchLayer2Event = (target, eventRef, input) => target.dispatchEvent(createLayer2DomEvent(eventRef, input));
const createLayer2DomEvent = (eventRef, input) => {
    if (eventRef === "keydown" || eventRef === "keyup") {
        return createLayer2KeyboardEvent(eventRef);
    }
    if (eventRef === "compositionstart" ||
        eventRef === "compositionupdate" ||
        eventRef === "compositionend") {
        return createLayer2CompositionEvent(eventRef, input?.text ?? "");
    }
    if (eventRef === "input") {
        return createLayer2InputEvent(eventRef, input?.text ?? "");
    }
    if (eventRef === "mousemove" ||
        eventRef === "mouseover" ||
        eventRef === "mousedown" ||
        eventRef === "mouseup" ||
        eventRef === "click") {
        return createLayer2MouseEvent(eventRef);
    }
    if (eventRef === "wheel") {
        return createLayer2WheelEvent(input?.deltaY ?? DEFAULT_RHYTHM_PROFILE.scroll_segment_min_px);
    }
    return new Event(eventRef, { bubbles: true, cancelable: true });
};
const createLayer2KeyboardEvent = (type) => {
    return createLayer2EventWithFallback(type, () => typeof KeyboardEvent === "function"
        ? new KeyboardEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true
        })
        : null);
};
const createLayer2CompositionEvent = (type, text) => {
    return createLayer2EventWithFallback(type, () => typeof CompositionEvent === "function"
        ? new CompositionEvent(type, { bubbles: true, cancelable: true, data: text })
        : null, {
        data: text
    });
};
const createLayer2InputEvent = (type, text) => {
    return createLayer2EventWithFallback(type, () => typeof InputEvent === "function"
        ? new InputEvent(type, {
            bubbles: true,
            cancelable: true,
            data: text,
            inputType: "insertText"
        })
        : null, {
        data: text,
        inputType: "insertText"
    });
};
const createLayer2MouseEvent = (type) => {
    return createLayer2EventWithFallback(type, () => typeof MouseEvent === "function"
        ? new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true
        })
        : null);
};
const createLayer2WheelEvent = (deltaY) => {
    return createLayer2EventWithFallback("wheel", () => typeof WheelEvent === "function"
        ? new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY
        })
        : null, {
        deltaY
    });
};
const createLayer2EventWithFallback = (type, createSpecificEvent, fields = {}) => {
    let event = null;
    try {
        event = createSpecificEvent();
    }
    catch {
        event = null;
    }
    event ??= new Event(type, { bubbles: true, cancelable: true });
    for (const [field, value] of Object.entries(fields)) {
        if (field in event) {
            continue;
        }
        try {
            Object.defineProperty(event, field, {
                configurable: true,
                enumerable: true,
                get: () => value
            });
        }
        catch {
            // Some browser event implementations expose non-configurable fields.
        }
    }
    return event;
};
return { buildLayer2InteractionEvidence, buildLayer2RhythmPlan, buildLayer2ScheduledEventChain, buildLayer2WriteBoundaryAudit, buildXhsSearchLayer2InteractionEvidence, dispatchLayer2ScheduledEventChain, getLayer2BehaviorEvidenceBaseline, getLayer2EventChainPolicies, resolveLayer2SettleRecovery };
})();
const __webenvoy_module_xhs_controlled_live_write = (() => {
const xhsControlledPublishDebuggerClickTimeoutMs = 12_000;
const resolveXhsControlledPublishIdentityCaptureTimeoutClassificationForContract = (input) => {
    if (input.observedRequestCount <= 0) {
        if (typeof input.networkRequestEventCount === "number" && input.networkRequestEventCount <= 0) {
            return {
                blocker_code: "PUBLISH_ACTION_NETWORK_NOT_OBSERVED",
                reason: "post_submit_network_event_not_observed"
            };
        }
        if (typeof input.networkRequestEventCount === "number" && input.networkRequestEventCount > 0) {
            return {
                blocker_code: "PUBLISH_IDENTITY_CAPTURE_DIAGNOSTIC_EVENTS_NOT_RECORDED",
                reason: "post_submit_network_events_filtered_without_diagnostics"
            };
        }
        return {
            blocker_code: "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_NOT_OBSERVED",
            reason: input.fallbackReason
        };
    }
    if (input.trustedEndpointObserved !== true &&
        !input.adjacentFailureBlockerCode &&
        typeof input.ignoredRequestCount === "number" &&
        input.ignoredRequestCount > 0) {
        return {
            blocker_code: "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_NOT_OBSERVED",
            reason: "only_outside_publish_identity_diagnostic_scope"
        };
    }
    return {
        blocker_code: input.trustedFailureBlockerCode ??
            (!input.trustedEndpointObserved ? input.adjacentFailureBlockerCode : null) ??
            input.fallbackBlockerCode,
        reason: input.trustedFailureReason ??
            (!input.trustedEndpointObserved ? input.adjacentFailureReason : null) ??
            input.fallbackReason
    };
};
const visibilitySelectionSuccess = (selectedOption, openedDropdown, triggerCount, debuggerClick = null) => ({
    selectedOption,
    blockerCode: null,
    detailsRef: null,
    openedDropdown,
    triggerCount,
    optionLocator: locatorForElement(selectedOption),
    debuggerClick
});
const visibilitySelectionBlocked = (blockerCode, detailsRef, openedDropdown, triggerCount, debuggerClick = null) => ({
    selectedOption: null,
    blockerCode,
    detailsRef,
    openedDropdown,
    triggerCount,
    optionLocator: null,
    debuggerClick
});
const elementCenterCoordinates = (element) => {
    const rect = element.getBoundingClientRect();
    const width = Number.isFinite(rect.width) ? rect.width : 0;
    const height = Number.isFinite(rect.height) ? rect.height : 0;
    if (width <= 0 || height <= 0) {
        return null;
    }
    const left = Number.isFinite(rect.left) ? rect.left : 0;
    const top = Number.isFinite(rect.top) ? rect.top : 0;
    return {
        centerX: Math.max(0, Math.floor(left + width / 2)),
        centerY: Math.max(0, Math.floor(top + height / 2))
    };
};
const requestVisibilityDebuggerClickViaExtension = async (input) => {
    const runtime = globalThis.chrome?.runtime;
    const sendMessage = runtime?.sendMessage;
    if (!sendMessage) {
        return {
            ok: false,
            error: {
                code: "ERR_XHS_VISIBILITY_DEBUGGER_UNAVAILABLE",
                message: "extension runtime.sendMessage is unavailable"
            }
        };
    }
    if (typeof input.target.scrollIntoView === "function") {
        try {
            input.target.scrollIntoView({ block: "center", inline: "nearest" });
            await sleep(100);
        }
        catch {
            // Best-effort positioning before CDP mouse input; geometry validation below remains authoritative.
        }
    }
    const coordinates = elementCenterCoordinates(input.target);
    if (!coordinates) {
        return {
            ok: false,
            error: {
                code: "ERR_XHS_VISIBILITY_DEBUGGER_TARGET_GEOMETRY_MISSING",
                message: "visibility debugger click target geometry is unavailable"
            }
        };
    }
    const request = {
        kind: "xhs-controlled-live-write-visibility-debugger-click",
        locator: locatorForElement(input.target),
        center_x: coordinates.centerX,
        center_y: coordinates.centerY,
        run_id: input.runId,
        action_ref: input.actionRef,
        ...(typeof input.timeoutMs === "number" ? { timeout_ms: input.timeoutMs } : {})
    };
    try {
        return await new Promise((resolve, reject) => {
            let settled = false;
            const timeoutMs = typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
                ? Math.floor(input.timeoutMs)
                : 3_000;
            const resolveOnce = (message) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(message);
            };
            const rejectOnce = (error) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                reject(error);
            };
            const timer = setTimeout(() => {
                resolveOnce({
                    ok: false,
                    error: {
                        code: "ERR_XHS_VISIBILITY_DEBUGGER_TIMEOUT",
                        message: `visibility debugger click timed out after ${timeoutMs}ms`
                    }
                });
            }, timeoutMs);
            try {
                const maybePromise = sendMessage(request, (message) => {
                    const lastError = globalThis.chrome?.runtime?.lastError;
                    if (lastError?.message) {
                        resolveOnce({
                            ok: false,
                            error: {
                                code: "ERR_XHS_VISIBILITY_DEBUGGER_FAILED",
                                message: lastError.message
                            }
                        });
                        return;
                    }
                    resolveOnce(message ?? {
                        ok: false,
                        error: {
                            code: "ERR_XHS_VISIBILITY_DEBUGGER_FAILED",
                            message: "response missing"
                        }
                    });
                });
                if (maybePromise && typeof maybePromise.then === "function") {
                    void maybePromise
                        .then((message) => {
                        if (message) {
                            resolveOnce(message);
                        }
                    })
                        .catch((error) => {
                        rejectOnce(error);
                    });
                }
            }
            catch (error) {
                rejectOnce(error);
            }
        });
    }
    catch (error) {
        return {
            ok: false,
            error: {
                code: "ERR_XHS_VISIBILITY_DEBUGGER_FAILED",
                message: error instanceof Error ? error.message : String(error)
            }
        };
    }
};
const requestPublishDebuggerClickViaExtension = async (input) => {
    const runtime = globalThis.chrome?.runtime;
    const sendMessage = runtime?.sendMessage;
    if (!sendMessage) {
        return {
            ok: false,
            error: {
                code: "ERR_XHS_PUBLISH_DEBUGGER_UNAVAILABLE",
                message: "extension runtime.sendMessage is unavailable"
            }
        };
    }
    if (typeof input.target.scrollIntoView === "function") {
        try {
            input.target.scrollIntoView({ block: "center", inline: "nearest" });
            await sleep(100);
        }
        catch {
            // Best-effort positioning before CDP mouse input; geometry validation below remains authoritative.
        }
    }
    const coordinates = elementCenterCoordinates(input.target);
    if (!coordinates) {
        return {
            ok: false,
            error: {
                code: "ERR_XHS_PUBLISH_DEBUGGER_TARGET_GEOMETRY_MISSING",
                message: "publish debugger click target geometry is unavailable"
            }
        };
    }
    const request = {
        kind: "xhs-controlled-live-write-publish-debugger-click",
        locator: locatorForElement(input.target),
        center_x: coordinates.centerX,
        center_y: coordinates.centerY,
        run_id: input.runId,
        action_ref: input.actionRef,
        ...(typeof input.timeoutMs === "number" ? { timeout_ms: input.timeoutMs } : {})
    };
    try {
        return await new Promise((resolve, reject) => {
            let settled = false;
            const timeoutMs = typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
                ? Math.floor(input.timeoutMs)
                : 3_000;
            const resolveOnce = (message) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(message);
            };
            const rejectOnce = (error) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                reject(error);
            };
            const timer = setTimeout(() => {
                resolveOnce({
                    ok: false,
                    error: {
                        code: "ERR_XHS_PUBLISH_DEBUGGER_TIMEOUT",
                        message: `publish debugger click timed out after ${timeoutMs}ms`
                    }
                });
            }, timeoutMs);
            try {
                const maybePromise = sendMessage(request, (message) => {
                    const lastError = globalThis.chrome?.runtime?.lastError;
                    if (lastError?.message) {
                        resolveOnce({
                            ok: false,
                            error: {
                                code: "ERR_XHS_PUBLISH_DEBUGGER_FAILED",
                                message: lastError.message
                            }
                        });
                        return;
                    }
                    resolveOnce(message ?? {
                        ok: false,
                        error: {
                            code: "ERR_XHS_PUBLISH_DEBUGGER_FAILED",
                            message: "response missing"
                        }
                    });
                });
                if (maybePromise && typeof maybePromise.then === "function") {
                    void maybePromise
                        .then((message) => {
                        if (message) {
                            resolveOnce(message);
                        }
                    })
                        .catch((error) => {
                        rejectOnce(error);
                    });
                }
            }
            catch (error) {
                rejectOnce(error);
            }
        });
    }
    catch (error) {
        return {
            ok: false,
            error: {
                code: "ERR_XHS_PUBLISH_DEBUGGER_FAILED",
                message: error instanceof Error ? error.message : String(error)
            }
        };
    }
};
const FR0032_FIXTURE_IMAGE_A_REF = "media-ref/fr-0032/fixture-image-a";
const FR0032_FIXTURE_IMAGE_A_DIGEST = "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18";
const FR0032_FIXTURE_IMAGE_A_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAG5ElEQVR42u3WMQ0AAAjAMGQhB//BA5jgo0cN7Fp01gAAv4QIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAHBnAVzllrXr0ZtlAAAAAElFTkSuQmCC";
const nowIso = () => new Date().toISOString();
const asPlainRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const xhsControlledUploadCaptureDefaultMaxBodyBytes = 256_000;
const xhsControlledUploadSignalPattern = /(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu;
const xhsControlledUploadCredentialEndpointPattern = /(?:^|[/_.-])(?:permit|token|credential|policy|sign|sts)(?:$|[/_.-])/iu;
const isXhsControlledObjectUploadTransportHost = (host) => /^ros-upload(?:-[a-z0-9]+)?\.(?:xiaohongshu\.com|xhscdn\.com)$/iu.test(host);
const isXhsControlledUploadDiagnosticWriteHost = (host) => host === "creator.xiaohongshu.com" ||
    host === "edith.xiaohongshu.com" ||
    host === "upload.xiaohongshu.com" ||
    isXhsControlledObjectUploadTransportHost(host);
const xhsControlledUploadPlatformEndpointAllowlist = [
    {
        host: "creator.xiaohongshu.com",
        path: /^\/(?:api|web_api)\/.*(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu
    },
    {
        host: "edith.xiaohongshu.com",
        path: /^\/api\/.*(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu
    },
    {
        host: "upload.xiaohongshu.com",
        path: /^\/.*(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu
    }
];
const isXhsControlledUploadPlatformCaptureUrl = (url, method) => {
    if (!/^(POST|PUT|PATCH)$/iu.test(method)) {
        return false;
    }
    try {
        const parsed = new URL(url);
        if (xhsControlledUploadCredentialEndpointPattern.test(parsed.pathname)) {
            return false;
        }
        if (method.toUpperCase() === "PUT" && objectUploadTransportStagingRef(url)) {
            return true;
        }
        return xhsControlledUploadPlatformEndpointAllowlist.some((entry) => parsed.hostname === entry.host && entry.path.test(parsed.pathname));
    }
    catch {
        return false;
    }
};
const summarizeXhsControlledUploadObservedRequest = (url, method) => {
    if (!/^(POST|PUT|PATCH)$/iu.test(method)) {
        return null;
    }
    try {
        const parsed = new URL(url);
        const isKnownHost = parsed.hostname.endsWith("xiaohongshu.com") || parsed.hostname.endsWith("xhscdn.com");
        const objectUploadTransport = isXhsControlledObjectUploadTransportHost(parsed.hostname);
        const diagnosticWriteHost = isXhsControlledUploadDiagnosticWriteHost(parsed.hostname);
        const uploadLikeHost = parsed.hostname.includes("upload");
        const uploadLikePath = xhsControlledUploadSignalPattern.test(parsed.pathname);
        const credentialEndpoint = xhsControlledUploadCredentialEndpointPattern.test(parsed.pathname);
        if (!isKnownHost ||
            (!diagnosticWriteHost &&
                !objectUploadTransport &&
                !uploadLikeHost &&
                !uploadLikePath &&
                !credentialEndpoint)) {
            return null;
        }
        const captureCandidate = isXhsControlledUploadPlatformCaptureUrl(url, method);
        return {
            method,
            host: parsed.hostname,
            path: parsed.pathname,
            capture_candidate: captureCandidate,
            rejection_reason: captureCandidate
                ? null
                : objectUploadTransport
                    ? "object_upload_transport_not_platform_acceptance"
                    : credentialEndpoint
                        ? "credential_endpoint_not_platform_acceptance"
                        : diagnosticWriteHost
                            ? "xhs_write_request_not_upload_signal"
                            : "url_not_allowlisted"
        };
    }
    catch {
        return null;
    }
};
const parseXhsControlledUploadNetworkResponseBody = (value, maxBodyBytes = xhsControlledUploadCaptureDefaultMaxBodyBytes) => {
    if (typeof value !== "string" || value.length === 0 || value.length > maxBodyBytes) {
        return null;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
};
const decodeXhsControlledUploadNetworkResponseBody = (input) => {
    const maxBodyBytes = input.maxBodyBytes ?? xhsControlledUploadCaptureDefaultMaxBodyBytes;
    if (typeof input.body !== "string" || input.body.length === 0) {
        return null;
    }
    if (input.body.length > maxBodyBytes) {
        return null;
    }
    if (input.base64Encoded === true) {
        if (typeof atob !== "function") {
            return null;
        }
        try {
            const decoded = atob(input.body);
            return parseXhsControlledUploadNetworkResponseBody(decoded, maxBodyBytes);
        }
        catch {
            return null;
        }
    }
    return parseXhsControlledUploadNetworkResponseBody(input.body, maxBodyBytes);
};
const trustedPlatformRefKeys = new Set([
    "upload_id",
    "uploadId",
    "media_id",
    "mediaId",
    "material_id",
    "materialId",
    "asset_id",
    "assetId",
    "file_id",
    "fileId",
    "fileid",
    "image_file_id",
    "imageFileId",
    "oss_id",
    "ossId",
    "image_id",
    "imageId"
]);
const normalizePlatformRefValue = (value) => {
    if (typeof value !== "string" && typeof value !== "number") {
        return null;
    }
    const normalized = String(value).trim();
    if (normalized.length < 6 ||
        normalized.length > 256 ||
        normalized.startsWith("blob:") ||
        normalized.startsWith("data:") ||
        /^https?:\/\//iu.test(normalized)) {
        return null;
    }
    return normalized;
};
const normalizeTrustedNoteIdValue = (value) => {
    const normalized = normalizePlatformRefValue(value);
    if (!normalized || normalized.length < 8 || normalized.length > 64) {
        return null;
    }
    return normalized;
};
const findTrustedPlatformStagingRef = (value) => {
    if (typeof value === "string") {
        for (const key of trustedPlatformRefKeys) {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
            const match = new RegExp(`["']${escapedKey}["']\\s*:\\s*["']([^"']{6,256})["']`, "u").exec(value);
            const normalizedValue = normalizePlatformRefValue(match?.[1]);
            if (normalizedValue) {
                return `${key}:${normalizedValue}`;
            }
        }
        return null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = findTrustedPlatformStagingRef(item);
            if (nested) {
                return nested;
            }
        }
        return null;
    }
    const record = asPlainRecord(value);
    if (!record) {
        return null;
    }
    for (const [key, item] of Object.entries(record)) {
        const normalizedValue = normalizePlatformRefValue(item);
        if (trustedPlatformRefKeys.has(key) && normalizedValue) {
            return `${key}:${normalizedValue}`;
        }
    }
    for (const item of Object.values(record)) {
        const nested = findTrustedPlatformStagingRef(item);
        if (nested) {
            return nested;
        }
    }
    return null;
};
const objectUploadTransportStagingRef = (url) => {
    try {
        const parsed = new URL(url);
        if (!isXhsControlledObjectUploadTransportHost(parsed.hostname)) {
            return null;
        }
        const path = parsed.pathname.trim();
        if (!/^\/spectrum\/[A-Za-z0-9_-]{32,256}$/u.test(path)) {
            return null;
        }
        return `object_upload:${parsed.hostname}${path}`;
    }
    catch {
        return null;
    }
};
const extractXhsControlledUploadPlatformCapture = (input) => {
    if (input.status < 200 ||
        input.status >= 300 ||
        !isXhsControlledUploadPlatformCaptureUrl(input.url, input.method)) {
        return null;
    }
    const objectUploadStagingRef = objectUploadTransportStagingRef(input.url);
    if (objectUploadStagingRef) {
        return {
            source: "chrome_debugger_network",
            platform_staging_ref: objectUploadStagingRef,
            evidence_basis: "object_upload_transport_2xx",
            url: input.url,
            method: input.method,
            status: input.status,
            captured_at: input.captured_at
        };
    }
    const platformStagingRef = findTrustedPlatformStagingRef(input.body);
    if (!platformStagingRef) {
        return null;
    }
    return {
        source: "chrome_debugger_network",
        platform_staging_ref: platformStagingRef,
        evidence_basis: "trusted_platform_response_body",
        url: input.url,
        method: input.method,
        status: input.status,
        captured_at: input.captured_at
    };
};
const trustedPublishResultEndpointPattern = /^\/(?:api|web_api)\/(?:creator\/publish\/result|galaxy\/(?:v\d+\/)?creator\/note\/user\/(?:post|publish))(?:[/?#]|$)/iu;
const trustedCreatorSubmitPublishEndpointPattern = /^\/(?:api|web_api)\/galaxy\/(?:v\d+\/)?creator\/note\/user\/(?:post|publish)(?:[/?#]|$)/iu;
const trustedCreatorSnsSubmitPublishEndpointPattern = /^\/api\/sns\/web\/v1\/note\/commit(?:[/?#]|$)/iu;
const noteIdFromTrustedHrefValue = (href) => {
    const match = /[?&](?:note_id|noteId|source_note_id)=([A-Za-z0-9_-]{8,64})(?:&|$)/u.exec(href) ??
        /\/(?:explore|notes?|note|publish\/success)\/([A-Za-z0-9_-]{8,64})(?:[/?#]|$)/u.exec(href);
    return match?.[1] ?? null;
};
const isXhsControlledPublishResultIdentityCaptureUrl = (url, method) => {
    if (!/^(GET|POST)$/iu.test(method)) {
        return false;
    }
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== "creator.xiaohongshu.com") {
            return false;
        }
        if (trustedCreatorSubmitPublishEndpointPattern.test(parsed.pathname) ||
            trustedCreatorSnsSubmitPublishEndpointPattern.test(parsed.pathname)) {
            return /^POST$/iu.test(method);
        }
        return trustedPublishResultEndpointPattern.test(parsed.pathname);
    }
    catch {
        return false;
    }
};
const isXhsControlledPublishIdentityAdjacentWriteRequestUrl = (url, method) => {
    if (!/^(POST|PUT|PATCH)$/iu.test(method)) {
        return false;
    }
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== "creator.xiaohongshu.com") {
            return false;
        }
        return (/^\/(?:api|web_api)\//iu.test(parsed.pathname) &&
            /(?:creator|publish|note|sns|galaxy)/iu.test(parsed.pathname));
    }
    catch {
        return false;
    }
};
const isXhsControlledPublishIdentityDiagnosticRequestUrl = (url, method) => {
    if (!/^(GET|POST|PUT|PATCH)$/iu.test(method)) {
        return false;
    }
    try {
        const parsed = new URL(url);
        return (parsed.hostname === "creator.xiaohongshu.com" &&
            /^\/(?:api|web_api)\//iu.test(parsed.pathname));
    }
    catch {
        return false;
    }
};
const isXhsControlledPublishIdentityIgnoredDiagnosticRequestUrl = (url, method) => {
    if (!/^(GET|POST|PUT|PATCH)$/iu.test(method)) {
        return false;
    }
    try {
        const parsed = new URL(url);
        return (/(?:^|\.)xiaohongshu\.com$/iu.test(parsed.hostname) ||
            /(?:^|\.)xhscdn\.com$/iu.test(parsed.hostname));
    }
    catch {
        return false;
    }
};
const isXhsControlledCreatorSubmitPublishCaptureUrl = (url, method) => {
    if (!/^(GET|POST)$/iu.test(method)) {
        return false;
    }
    try {
        const parsed = new URL(url);
        return (parsed.hostname === "creator.xiaohongshu.com" &&
            (trustedCreatorSubmitPublishEndpointPattern.test(parsed.pathname) ||
                trustedCreatorSnsSubmitPublishEndpointPattern.test(parsed.pathname)));
    }
    catch {
        return false;
    }
};
const noteIdFromTrustedPublishedUrl = (value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }
    const raw = value.trim();
    const maybeUrl = /^https?:\/\//iu.test(raw)
        ? raw
        : `https://www.xiaohongshu.com${raw.startsWith("/") ? raw : `/${raw}`}`;
    try {
        const parsed = new URL(maybeUrl);
        if (parsed.hostname !== "www.xiaohongshu.com") {
            return null;
        }
        const noteId = noteIdFromTrustedHrefValue(parsed.toString());
        return noteId ? { noteId, url: parsed.toString() } : null;
    }
    catch {
        return null;
    }
};
const normalizeTrustedPublishVisibilityScope = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "private_or_self_visible" ||
        normalized === "private" ||
        normalized === "self" ||
        normalized === "self_visible" ||
        normalized === "only_me" ||
        normalized === "only_self" ||
        normalized === "one_self" ||
        normalized.includes("仅自己可见") ||
        normalized.includes("仅自己") ||
        normalized.includes("自己可见")) {
        return "private_or_self_visible";
    }
    return null;
};
const trustedPublishVisibilityScopeKeys = new Set([
    "publish_visibility_scope",
    "publishVisibilityScope",
    "visibility_scope",
    "visibilityScope",
    "permission_scope",
    "permissionScope",
    "privacy_scope",
    "privacyScope",
    "visibility",
    "permission",
    "privacy",
    "visible_type",
    "visibleType",
    "permission_type",
    "permissionType"
]);
const findDirectTrustedPublishVisibilityScope = (record) => {
    for (const [key, nestedValue] of Object.entries(record)) {
        if (!trustedPublishVisibilityScopeKeys.has(key)) {
            continue;
        }
        const scope = normalizeTrustedPublishVisibilityScope(nestedValue);
        if (scope) {
            return scope;
        }
    }
    return null;
};
const normalizeTrustedPlatformPublishRecordRef = (value) => {
    if (typeof value !== "string" && typeof value !== "number") {
        return null;
    }
    const normalized = String(value).trim();
    if (!/^[A-Za-z0-9:_./-]{8,160}$/u.test(normalized)) {
        return null;
    }
    return normalized;
};
const findDirectTrustedPublishResultIdentity = (record, allowUnboundPlatformRecordRef = false) => {
    for (const key of ["note_id", "noteId", "source_note_id", "sourceNoteId"]) {
        const noteId = normalizeTrustedNoteIdValue(record[key]);
        if (noteId) {
            return {
                result_kind: "note_id",
                note_id: noteId,
                published_url: `https://www.xiaohongshu.com/explore/${noteId}`,
                creator_result_url: null,
                platform_record_ref: null
            };
        }
    }
    for (const key of ["published_url", "publishedUrl", "note_url", "noteUrl", "detail_url", "detailUrl", "url", "href"]) {
        const published = noteIdFromTrustedPublishedUrl(record[key]);
        if (published) {
            return {
                result_kind: "published_url",
                note_id: published.noteId,
                published_url: published.url,
                creator_result_url: null,
                platform_record_ref: null
            };
        }
    }
    if (allowUnboundPlatformRecordRef ||
        findDirectTrustedPublishVisibilityScope(record) === "private_or_self_visible") {
        for (const key of [
            "platform_record_ref",
            "platformRecordRef",
            "publish_id",
            "publishId",
            "publish_record_id",
            "publishRecordId",
            "publish_task_id",
            "publishTaskId",
            "task_id",
            "taskId"
        ]) {
            const platformRecordRef = normalizeTrustedPlatformPublishRecordRef(record[key]);
            if (platformRecordRef) {
                return {
                    result_kind: "platform_publish_record",
                    note_id: null,
                    published_url: null,
                    creator_result_url: null,
                    platform_record_ref: platformRecordRef
                };
            }
        }
    }
    return null;
};
const findTrustedCreatorSubmitDataIdIdentity = (value) => {
    const root = asPlainRecord(value);
    const data = asPlainRecord(root?.data);
    if (!data) {
        return null;
    }
    const noteId = normalizeTrustedNoteIdValue(data.id);
    if (!noteId) {
        return null;
    }
    return {
        result_kind: "note_id",
        note_id: noteId,
        published_url: `https://www.xiaohongshu.com/explore/${noteId}`,
        creator_result_url: null,
        platform_record_ref: null
    };
};
const samePublishResultIdentityCaptureFields = (left, right) => {
    const identityKey = (value) => {
        if (value.note_id) {
            return `note:${value.note_id}`;
        }
        const published = noteIdFromTrustedPublishedUrl(value.published_url);
        if (published) {
            return `note:${published.noteId}`;
        }
        if (value.creator_result_url) {
            const noteId = noteIdFromTrustedHrefValue(value.creator_result_url);
            return noteId ? `note:${noteId}` : `creator_result_url:${value.creator_result_url}`;
        }
        if (value.platform_record_ref) {
            return `platform_record_ref:${value.platform_record_ref}`;
        }
        return "missing";
    };
    return identityKey(left) === identityKey(right);
};
const collectTrustedPublishResultIdentities = (value, output, allowUnboundPlatformRecordRef = false, seen = new Set()) => {
    if (typeof value === "string") {
        const published = noteIdFromTrustedPublishedUrl(value);
        if (published) {
            output.push({
                result_kind: "published_url",
                note_id: published.noteId,
                published_url: published.url,
                creator_result_url: null,
                platform_record_ref: null
            });
        }
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectTrustedPublishResultIdentities(item, output, allowUnboundPlatformRecordRef, seen);
        }
        return;
    }
    const record = asPlainRecord(value);
    if (!record || seen.has(record)) {
        return;
    }
    seen.add(record);
    const directIdentity = findDirectTrustedPublishResultIdentity(record, allowUnboundPlatformRecordRef);
    if (directIdentity) {
        output.push(directIdentity);
    }
    for (const item of Object.values(record)) {
        collectTrustedPublishResultIdentities(item, output, allowUnboundPlatformRecordRef, seen);
    }
};
const resolveUniqueTrustedPublishResultIdentity = (value, allowUnboundPlatformRecordRef = false) => {
    const resolveUniqueIdentity = (identities) => {
        let match = null;
        for (const identity of identities) {
            if (!match) {
                match = identity;
                continue;
            }
            if (!samePublishResultIdentityCaptureFields(match, identity)) {
                return null;
            }
        }
        return match;
    };
    const primaryIdentities = [];
    const submitDataIdIdentity = allowUnboundPlatformRecordRef
        ? findTrustedCreatorSubmitDataIdIdentity(value)
        : null;
    if (submitDataIdIdentity) {
        primaryIdentities.push(submitDataIdIdentity);
    }
    collectTrustedPublishResultIdentities(value, primaryIdentities, false);
    const primaryMatch = resolveUniqueIdentity(primaryIdentities);
    if (primaryMatch || primaryIdentities.length > 0) {
        return primaryMatch;
    }
    if (!allowUnboundPlatformRecordRef) {
        return null;
    }
    const fallbackIdentities = [];
    collectTrustedPublishResultIdentities(value, fallbackIdentities, true);
    return resolveUniqueIdentity(fallbackIdentities);
};
const findTrustedPublishVisibilityScope = (value, seen = new Set()) => {
    if (Array.isArray(value)) {
        let match = null;
        for (const item of value) {
            const nested = findTrustedPublishVisibilityScope(item, seen);
            if (!nested) {
                continue;
            }
            if (match && match !== nested) {
                return null;
            }
            match = nested;
        }
        return match;
    }
    const record = asPlainRecord(value);
    if (!record || seen.has(record)) {
        return null;
    }
    seen.add(record);
    for (const [key, nestedValue] of Object.entries(record)) {
        if (!trustedPublishVisibilityScopeKeys.has(key)) {
            continue;
        }
        const scope = normalizeTrustedPublishVisibilityScope(nestedValue);
        if (scope) {
            return scope;
        }
    }
    for (const item of Object.values(record)) {
        const nested = findTrustedPublishVisibilityScope(item, seen);
        if (nested) {
            return nested;
        }
    }
    return null;
};
const findTrustedBoundPublishResultIdentity = (value, locator = "$", seen = new Set()) => {
    if (Array.isArray(value)) {
        let match = null;
        for (let index = 0; index < value.length; index += 1) {
            const nested = findTrustedBoundPublishResultIdentity(value[index], `${locator}[${index}]`, seen);
            if (!nested) {
                continue;
            }
            if (match && JSON.stringify(match) !== JSON.stringify(nested)) {
                return null;
            }
            match = nested;
        }
        return match;
    }
    const record = asPlainRecord(value);
    if (!record || seen.has(record)) {
        return null;
    }
    seen.add(record);
    const directIdentity = findDirectTrustedPublishResultIdentity(record);
    const directVisibilityScope = findDirectTrustedPublishVisibilityScope(record);
    if (directIdentity && directVisibilityScope === "private_or_self_visible") {
        return {
            ...directIdentity,
            publish_visibility_scope: directVisibilityScope,
            publish_visibility_proof_locator: locator
        };
    }
    let match = null;
    for (const [key, item] of Object.entries(record)) {
        const nested = findTrustedBoundPublishResultIdentity(item, `${locator}.${key}`, seen);
        if (!nested) {
            continue;
        }
        if (match && JSON.stringify(match) !== JSON.stringify(nested)) {
            return null;
        }
        match = nested;
    }
    return match;
};
const extractXhsControlledPublishResultIdentityCapture = (input) => {
    if (input.status < 200 ||
        input.status >= 300 ||
        !isXhsControlledPublishResultIdentityCaptureUrl(input.url, input.method)) {
        return null;
    }
    const identity = resolveUniqueTrustedPublishResultIdentity(input.body, isXhsControlledCreatorSubmitPublishCaptureUrl(input.url, input.method));
    if (!identity) {
        return null;
    }
    const boundIdentity = findTrustedBoundPublishResultIdentity(input.body);
    if (boundIdentity && !samePublishResultIdentityCaptureFields(identity, boundIdentity)) {
        return null;
    }
    const publishVisibilityScope = boundIdentity?.publish_visibility_scope ?? null;
    return {
        source: "chrome_debugger_network",
        evidence_basis: "trusted_platform_response_body",
        ...identity,
        publish_visibility_scope: publishVisibilityScope,
        publish_visibility_proof_locator: boundIdentity?.publish_visibility_proof_locator ?? null,
        url: input.url,
        method: input.method,
        status: input.status,
        captured_at: input.captured_at
    };
};
const summarizeXhsControlledPublishIdentityObservedRequest = (input) => {
    const output = {
        method: input.method,
        status: typeof input.status === "number" ? input.status : null,
        reason: input.reason ?? null
    };
    if (typeof input.captureCandidate === "boolean") {
        output.capture_candidate = input.captureCandidate;
    }
    if (input.rejectionReason) {
        output.rejection_reason = input.rejectionReason;
        output.body_values_recorded = false;
        output.body_recording_policy = "shape_only";
    }
    try {
        const parsed = new URL(input.url);
        output.host = parsed.hostname;
        output.path = parsed.pathname;
    }
    catch {
        output.host = "unparseable";
        output.path = "unparseable";
    }
    return output;
};
const sourceMediaKind = (value) => value === "video" || value === "mixed" ? value : "image";
const acceptedUploadArtifactResumeBlockedInput = (detailsRef) => ({
    blockerCode: "ACCEPTED_UPLOAD_ARTIFACT_RESUME_INVALID",
    blockerMessage: "Controlled submit/publish resume requires a current accepted upload artifact identity bound to this request.",
    detailsRef,
    requiredRecoveryAction: "provide a current accepted_upload_artifact_identity matching source media, profile, target and latest-head lineage before submit/publish resume"
});
const validateAcceptedUploadArtifactResume = (input, artifact) => {
    const artifactRecord = asPlainRecord(artifact) ?? {};
    if (!/^upload-artifact\/fr-0032\//u.test(artifact.upload_artifact_id)) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_id_invalid");
    }
    if (artifact.source_media_ref !== input.source_media_ref) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_source_ref_mismatch");
    }
    if (artifact.source_media_digest !== input.source_media_digest) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_digest_mismatch");
    }
    if (artifact.source_media_kind !== sourceMediaKind(input.source_media_kind)) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_kind_mismatch");
    }
    if (artifact.accepted_by_platform !== true || artifact.visible_in_editor !== true) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_not_ready");
    }
    if (typeof artifact.captured_at !== "string" || artifact.captured_at.trim().length === 0) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_captured_at_invalid");
    }
    if (!Object.prototype.hasOwnProperty.call(artifactRecord, "platform_staging_ref")) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_platform_ref_missing");
    }
    if (artifact.platform_staging_ref !== null &&
        (typeof artifact.platform_staging_ref !== "string" ||
            artifact.platform_staging_ref.trim().length === 0)) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_platform_ref_invalid");
    }
    const artifactProfileRef = artifactRecord.profile_ref;
    if (typeof artifactProfileRef === "string" &&
        input.profile_ref !== null &&
        artifactProfileRef !== input.profile_ref) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_profile_mismatch");
    }
    const artifactTargetTabId = artifactRecord.target_tab_id;
    if (typeof artifactTargetTabId === "number" &&
        Number.isInteger(artifactTargetTabId) &&
        input.target_tab_id !== null &&
        artifactTargetTabId !== input.target_tab_id) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_target_tab_mismatch");
    }
    const artifactTargetPage = artifactRecord.target_page;
    if (typeof artifactTargetPage === "string" && artifactTargetPage !== "creator_publish_tab") {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_target_page_mismatch");
    }
    const artifactLatestHeadSha = artifactRecord.latest_head_sha;
    if (typeof artifactLatestHeadSha === "string" &&
        typeof input.latest_head_sha === "string" &&
        input.latest_head_sha.length > 0 &&
        artifactLatestHeadSha !== input.latest_head_sha) {
        return acceptedUploadArtifactResumeBlockedInput("accepted_upload_artifact_head_mismatch");
    }
    return null;
};
const sha256DigestForBytes = async (bytes) => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        return null;
    }
    const digestInput = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(digestInput).set(bytes);
    const digest = await subtle.digest("SHA-256", digestInput);
    const hex = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    return `sha256:${hex}`;
};
const decodeBase64Bytes = (value) => {
    if (typeof atob !== "function") {
        return null;
    }
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};
const imageAcceptTokenPattern = /(^|\W)(image\/|\*\/\*|\*|\.jpe?g|\.png|\.webp|\.gif|\.bmp|\.heic|\.heif)(\W|$)/iu;
const acceptsImageMedia = (accept) => {
    const normalized = (accept ?? "").trim();
    if (normalized.length === 0) {
        return false;
    }
    return normalized
        .split(",")
        .map((token) => token.trim().toLowerCase())
        .some((token) => imageAcceptTokenPattern.test(token));
};
const collectUploadFileInputs = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return [];
    }
    return Array.from(document.querySelectorAll('input[type="file"]'));
};
const findUploadFileInput = (inputs) => {
    return inputs.find((input) => !input.disabled && acceptsImageMedia(input.accept)) ?? null;
};
const isVisibleElement = (element) => {
    if (!(element instanceof HTMLElement)) {
        return false;
    }
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0);
};
const textContentOf = (element) => (element.textContent ?? "").trim().replace(/\s+/g, " ");
const formControlValueSignal = (element) => [
    getElementAttribute(element, "value"),
    "value" in element && typeof element.value === "string" ? element.value : null,
    getElementAttribute(element, "placeholder")
]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
const elementTextSignal = (element) => [
    getElementAttribute(element, "data-testid"),
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    getElementAttribute(element, "role"),
    getElementAttribute(element, "class"),
    formControlValueSignal(element),
    textContentOf(element)
]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
const elementDisplayedTextSignal = (element) => [
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    formControlValueSignal(element),
    textContentOf(element)
]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
const elementDescendantDisplayedTextSignal = (element) => {
    if (typeof element.querySelectorAll !== "function") {
        return "";
    }
    return Array.from(element.querySelectorAll("*"))
        .map((descendant) => elementDisplayedTextSignal(descendant))
        .filter((value) => value.trim().length > 0)
        .slice(0, 6)
        .join(" ");
};
const elementVisibleTextSignal = (element) => [
    elementDisplayedTextSignal(element),
    elementDescendantDisplayedTextSignal(element)
]
    .filter((value) => value.trim().length > 0)
    .join(" ");
const isDisabledElement = (element) => element.disabled === true ||
    getElementAttribute(element, "aria-disabled") === "true" ||
    getElementAttribute(element, "disabled") !== null;
const findVisibleElementMatchingText = (selector, include, exclude) => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    return (Array.from(document.querySelectorAll(selector)).find((element) => {
        const signal = elementTextSignal(element);
        return (isVisibleElement(element) &&
            !isDisabledElement(element) &&
            include.test(signal) &&
            !(exclude?.test(signal) ?? false));
    }) ?? null);
};
const imageModeTextPattern = /上传图文|图文|图片|image|photo/iu;
const imageModeHrefPattern = /(?:[?&]target=image(?:&|$)|target%3Dimage)/iu;
const nonImageModeTextPattern = /上传视频|视频|video/iu;
const imageModeSignalForElement = (element) => [
    getElementAttribute(element, "href"),
    getElementAttribute(element, "data-testid"),
    getElementAttribute(element, "data-test"),
    getElementAttribute(element, "data-target"),
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    getElementAttribute(element, "role"),
    getElementAttribute(element, "class"),
    textContentOf(element)
]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
const imageModeCandidateScore = (element) => {
    const signal = imageModeSignalForElement(element);
    const href = getElementAttribute(element, "href") ?? "";
    const text = textContentOf(element);
    const exactImageModeSignal = imageModeTextPattern.test(signal) && !nonImageModeTextPattern.test(signal);
    const mixedImageVideoContainer = imageModeTextPattern.test(signal) && nonImageModeTextPattern.test(signal);
    const textLengthPenalty = Math.min(Math.floor(text.length / 12), 8);
    if (imageModeHrefPattern.test(href)) {
        return 0;
    }
    if (element.getAttribute("role") === "tab" && exactImageModeSignal) {
        return 1 + textLengthPenalty;
    }
    if (element.tagName.toUpperCase() === "BUTTON" && exactImageModeSignal) {
        return 2 + textLengthPenalty;
    }
    if (exactImageModeSignal) {
        return 3 + textLengthPenalty;
    }
    return mixedImageVideoContainer ? 20 + textLengthPenalty : 30 + textLengthPenalty;
};
const selectImagePublishMode = async () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return;
    }
    const candidates = Array.from(document.querySelectorAll([
        'a[href*="target=image" i]',
        '[href*="target=image" i]',
        '[data-target*="image" i]',
        '[data-testid*="image" i]',
        '[data-testid*="photo" i]',
        '[data-testid*="图文" i]',
        '[aria-label*="图文" i]',
        '[aria-label*="图片" i]',
        '[title*="图文" i]',
        '[title*="图片" i]',
        "button",
        '[role="tab"]',
        '[role="menuitem"]',
        '[class*="tab" i]',
        '[class*="publish" i]'
    ].join(",")));
    const imageMode = candidates
        .filter((element) => {
        const signal = imageModeSignalForElement(element);
        return isVisibleElement(element) && imageModeTextPattern.test(signal) && typeof element.click === "function";
    })
        .sort((left, right) => imageModeCandidateScore(left) - imageModeCandidateScore(right))[0];
    if (!imageMode) {
        return;
    }
    imageMode.click();
    await sleep(800);
};
const uploadIntentTextPattern = /上传|图片|图文|素材|拖拽|点击上传|upload|image|media|photo/iu;
const nonUploadClassPattern = /dropdown|drop-down|drop_shadow|drop-shadow|backdrop/iu;
const hasUploadIntentSignal = (element) => {
    const signalText = [
        element.getAttribute("data-testid"),
        element.getAttribute("data-test"),
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.className,
        textContentOf(element)
    ]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join(" ");
    return uploadIntentTextPattern.test(signalText) && !nonUploadClassPattern.test(signalText);
};
const isPotentialDropzoneTarget = (element) => !["IMG", "VIDEO", "SVG", "CANVAS"].includes(element.tagName.toUpperCase());
const findUploadDropzone = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    const candidates = Array.from(document.querySelectorAll([
        '[data-testid*="upload" i]',
        '[class*="upload" i]',
        '[aria-label*="上传" i]',
        '[aria-label*="upload" i]',
        '[title*="上传" i]',
        '[title*="upload" i]'
    ].join(",")));
    return (candidates.find((element) => isPotentialDropzoneTarget(element) && isVisibleElement(element) && hasUploadIntentSignal(element)) ?? null);
};
const uploadPlaceholderPattern = /upload[-_ ]?icon|upload[-_ ]?btn|placeholder|empty|add[-_ ]?(image|photo|media)|点击上传|上传图片|upload image|upload photo/iu;
const uploadCompleteTextPattern = /上传完成|上传成功|上传完毕|处理完成|已上传|upload(ed)? complete|upload(ed)? success|done|complete/iu;
const uploadPendingTextPattern = /上传中|处理中|加载中|转码中|uploading|processing|loading|progress/iu;
const uploadFailureTextPattern = /上传失败|上传错误|重新上传|upload failed|upload error|retry upload/iu;
const platformStagingAttributeNames = [
    "data-upload-id",
    "data-media-id",
    "data-material-id",
    "data-asset-id",
    "data-file-id",
    "data-oss-id",
    "data-image-id"
];
const locatorForElement = (element) => {
    if (element.id) {
        return `#${element.id}`;
    }
    const className = Array.from(element.classList ?? []).find((item) => item.trim().length > 0);
    return className ? `${element.tagName.toLowerCase()}.${className}` : element.tagName.toLowerCase();
};
const getElementAttribute = (element, name) => typeof element.getAttribute === "function" ? element.getAttribute(name) : null;
const signalTextForElement = (element) => [
    element.id,
    getElementAttribute(element, "class"),
    getElementAttribute(element, "style"),
    getElementAttribute(element, "src"),
    getElementAttribute(element, "alt"),
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    element instanceof HTMLElement ? getComputedStyle(element).backgroundImage : null,
    textContentOf(element)
]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
const isUploadPlaceholderPreview = (element) => uploadPlaceholderPattern.test(signalTextForElement(element));
const ancestorSignalTextForElement = (element, maxDepth = 3) => {
    const parts = [signalTextForElement(element)];
    let current = element.parentElement;
    let depth = 0;
    while (current && depth < maxDepth) {
        parts.push(signalTextForElement(current));
        current = current.parentElement;
        depth += 1;
    }
    return parts.join(" ");
};
const platformStagingRefForElementOnly = (element) => {
    for (const attributeName of platformStagingAttributeNames) {
        const value = getElementAttribute(element, attributeName);
        if (!value) {
            continue;
        }
        const normalized = value.trim();
        if (normalized.length === 0 || normalized.startsWith("blob:") || normalized.startsWith("data:")) {
            continue;
        }
        return `${attributeName}:${normalized}`;
    }
    return null;
};
const platformStagingRefForElement = (element, maxDepth = 3) => {
    let current = element;
    let depth = 0;
    while (current && depth <= maxDepth) {
        const stagingRef = platformStagingRefForElementOnly(current);
        if (stagingRef) {
            return stagingRef;
        }
        current = current.parentElement;
        depth += 1;
    }
    return null;
};
const srcKindForElement = (element) => {
    const src = getElementAttribute(element, "src") ?? getElementAttribute(element, "poster");
    if (!src) {
        return null;
    }
    if (src.startsWith("blob:")) {
        return "blob";
    }
    if (src.startsWith("data:")) {
        return "data";
    }
    if (/^https?:\/\//iu.test(src)) {
        return "remote";
    }
    return "other";
};
const attributeNamesForElement = (element) => {
    const attributes = element.attributes;
    if (!attributes) {
        return [];
    }
    const names = [];
    for (let index = 0; index < attributes.length; index += 1) {
        const attribute = attributes.item(index);
        if (attribute?.name) {
            names.push(attribute.name);
        }
    }
    return names.sort();
};
const previewAttributeDiagnosticsForElement = (element, depth) => {
    const attributeNames = attributeNamesForElement(element);
    return {
        depth,
        tag_name: element.tagName.toLowerCase(),
        locator: locatorForElement(element),
        attribute_names: attributeNames.slice(0, 40),
        data_attribute_names: attributeNames.filter((name) => name.startsWith("data-")).slice(0, 40),
        platform_ref_attribute_names: platformStagingAttributeNames.filter((attributeName) => getElementAttribute(element, attributeName) !== null),
        src_kind: srcKindForElement(element),
        has_upload_completion_signal: hasUploadCompletionSignal(element),
        has_upload_pending_signal: uploadPendingTextPattern.test(ancestorSignalTextForElement(element, 0)),
        has_upload_failure_signal: uploadFailureTextPattern.test(ancestorSignalTextForElement(element, 0))
    };
};
const previewDiagnosticsForElement = (element, maxDepth = 3) => {
    const chain = [];
    let current = element;
    let depth = 0;
    while (current && depth <= maxDepth) {
        chain.push(previewAttributeDiagnosticsForElement(current, depth));
        current = current.parentElement;
        depth += 1;
    }
    return {
        schema_version: "fr-0032.preview_dom_diagnostics.v1",
        values_recorded: false,
        recording_policy: "attribute_names_and_signal_flags_only",
        preview_chain: chain
    };
};
const hasUploadCompletionSignal = (element) => {
    const text = ancestorSignalTextForElement(element);
    return (uploadCompleteTextPattern.test(text) &&
        !uploadPendingTextPattern.test(text) &&
        !uploadFailureTextPattern.test(text));
};
const evidenceForPreviewElement = (preview) => {
    const hasCompletionSignal = hasUploadCompletionSignal(preview);
    const platformStagingRef = hasCompletionSignal ? platformStagingRefForElement(preview) : null;
    return {
        locator: locatorForElement(preview),
        platformStagingRef,
        acceptedByPlatform: platformStagingRef !== null,
        diagnostics: previewDiagnosticsForElement(preview)
    };
};
const editorPreviewSelector = [
    'img[src^="blob:"]',
    'img[src^="data:image/"]',
    'img[src^="http://"]',
    'img[src^="https://"]',
    'video[src^="blob:"]',
    'video[src^="http://"]',
    'video[src^="https://"]',
    '[class*="preview" i] img',
    '[class*="cover" i] img',
    '[class*="media" i] img',
    '[style*="background-image" i]',
    '[class*="preview" i]',
    '[class*="cover" i]',
    '[class*="media" i]'
].join(",");
const previewSignatureForElement = (element) => [
    element.tagName.toLowerCase(),
    locatorForElement(element),
    getElementAttribute(element, "src") ?? "",
    getElementAttribute(element, "style") ?? "",
    getElementAttribute(element, "data-upload-id") ?? "",
    getElementAttribute(element, "data-media-id") ?? "",
    getElementAttribute(element, "data-material-id") ?? "",
    getElementAttribute(element, "data-asset-id") ?? "",
    getElementAttribute(element, "data-file-id") ?? "",
    getElementAttribute(element, "data-oss-id") ?? ""
].join("|");
const collectEditorPreviewSignatures = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return new Set();
    }
    return new Set(Array.from(document.querySelectorAll(editorPreviewSelector))
        .filter((element) => isVisibleElement(element) && !isUploadPlaceholderPreview(element))
        .map(previewSignatureForElement));
};
const findEditorPreviewEvidence = (previousSignatures) => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    const preview = Array.from(document.querySelectorAll(editorPreviewSelector)).find((element) => isVisibleElement(element) &&
        !isUploadPlaceholderPreview(element) &&
        !previousSignatures.has(previewSignatureForElement(element)));
    if (!preview) {
        return null;
    }
    return evidenceForPreviewElement(preview);
};
const waitForEditorPreviewEvidence = async (previousSignatures, options = {}) => {
    const isExtensionBrowserSurface = typeof window !== "undefined" &&
        typeof window.document !== "undefined" &&
        "chrome" in globalThis;
    const timeoutMs = options.timeoutMs ?? (isExtensionBrowserSurface ? 10_000 : 50);
    const intervalMs = options.intervalMs ?? (isExtensionBrowserSurface ? 500 : 10);
    const deadline = Date.now() + timeoutMs;
    let latestVisiblePreview = null;
    do {
        const previewEvidence = findEditorPreviewEvidence(previousSignatures);
        if (previewEvidence) {
            latestVisiblePreview = previewEvidence;
            if (previewEvidence.acceptedByPlatform) {
                return previewEvidence;
            }
        }
        if (Date.now() >= deadline) {
            break;
        }
        await sleep(intervalMs);
    } while (true);
    return latestVisiblePreview;
};
const uploadPreviewWaitOptions = (stage) => {
    const isExtensionBrowserSurface = typeof window !== "undefined" &&
        typeof window.document !== "undefined" &&
        "chrome" in globalThis;
    if (!isExtensionBrowserSurface) {
        return {};
    }
    return {
        timeoutMs: stage === "file_input" ? 8_000 : 3_000,
        intervalMs: 500
    };
};
const resolveApprovedFixtureMediaFile = async (input) => {
    if (input.source_media_ref !== FR0032_FIXTURE_IMAGE_A_REF) {
        return {
            blockerCode: "SOURCE_MEDIA_RESOLVER_UNAVAILABLE",
            blockerMessage: "Controlled live write cannot resolve the requested source media ref without an approved resolver.",
            detailsRef: "source_media_ref_not_approved",
            requiredRecoveryAction: "register the source media ref in the FR-0032 approved source media resolver"
        };
    }
    if (input.source_media_digest !== FR0032_FIXTURE_IMAGE_A_DIGEST) {
        return {
            blockerCode: "SOURCE_MEDIA_DIGEST_MISMATCH",
            blockerMessage: "Controlled live write cannot upload because the requested source media digest does not match the approved fixture.",
            detailsRef: "source_media_digest_mismatch",
            requiredRecoveryAction: "rerun with the approved fixture digest for media-ref/fr-0032/fixture-image-a"
        };
    }
    if (input.source_media_kind !== "image") {
        return {
            blockerCode: "SOURCE_MEDIA_KIND_UNSUPPORTED",
            blockerMessage: "Controlled live write currently supports only the approved FR-0032 image fixture.",
            detailsRef: "source_media_kind_unsupported",
            requiredRecoveryAction: "provide an approved image source media ref before controlled upload"
        };
    }
    if (typeof File !== "function") {
        return {
            blockerCode: "FILE_CONSTRUCTOR_UNAVAILABLE",
            blockerMessage: "Controlled live write cannot construct the approved media File in this execution surface.",
            detailsRef: "file_constructor_unavailable",
            requiredRecoveryAction: "run controlled upload in a browser surface that supports File construction"
        };
    }
    const bytes = decodeBase64Bytes(FR0032_FIXTURE_IMAGE_A_BASE64);
    if (!bytes) {
        return {
            blockerCode: "SOURCE_MEDIA_DECODE_UNAVAILABLE",
            blockerMessage: "Controlled live write cannot decode the approved fixture media bytes.",
            detailsRef: "source_media_decode_unavailable",
            requiredRecoveryAction: "run controlled upload in a browser surface that supports base64 media decoding"
        };
    }
    const actualDigest = await sha256DigestForBytes(bytes);
    if (!actualDigest) {
        return {
            blockerCode: "SOURCE_MEDIA_DIGEST_VERIFIER_UNAVAILABLE",
            blockerMessage: "Controlled live write cannot verify the approved fixture digest in this execution surface.",
            detailsRef: "source_media_digest_verifier_unavailable",
            requiredRecoveryAction: "run controlled upload in a browser surface that supports Web Crypto digest verification"
        };
    }
    if (actualDigest !== FR0032_FIXTURE_IMAGE_A_DIGEST) {
        return {
            blockerCode: "SOURCE_MEDIA_FIXTURE_DIGEST_DRIFT",
            blockerMessage: "Controlled live write cannot upload because the embedded approved fixture bytes no longer match the approved digest.",
            detailsRef: "source_media_fixture_digest_drift",
            requiredRecoveryAction: "restore the approved fixture bytes or update the approved digest through FR-0032 review"
        };
    }
    const mediaBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(mediaBuffer).set(bytes);
    return new File([mediaBuffer], "fr-0032-fixture-image-a.png", {
        type: "image/png",
        lastModified: 0
    });
};
const dispatchFileInputUpload = (input, file) => {
    if (typeof DataTransfer === "undefined") {
        return {
            blockerCode: "DATA_TRANSFER_UNAVAILABLE",
            blockerMessage: "Controlled live upload cannot continue because DataTransfer is unavailable.",
            detailsRef: "data_transfer_unavailable",
            requiredRecoveryAction: "run controlled upload in a browser surface that supports DataTransfer"
        };
    }
    try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return null;
    }
    catch {
        return {
            blockerCode: "FILE_INPUT_ASSIGNMENT_FAILED",
            blockerMessage: "Controlled live upload cannot assign the approved media file to the page input.",
            detailsRef: "file_input_assignment_failed",
            requiredRecoveryAction: "provide a page-compatible controlled upload executor for the current creator UI"
        };
    }
};
const createControlledDragEvent = (type, transfer) => {
    if (typeof DragEvent === "function") {
        return new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer
        });
    }
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
        configurable: true,
        value: transfer
    });
    return event;
};
const dispatchDropzoneUpload = (dropzone, file) => {
    if (typeof DataTransfer === "undefined") {
        return {
            blockerCode: "DATA_TRANSFER_UNAVAILABLE",
            blockerMessage: "Controlled live upload cannot continue because DataTransfer is unavailable.",
            detailsRef: "data_transfer_unavailable",
            requiredRecoveryAction: "run controlled upload in a browser surface that supports DataTransfer"
        };
    }
    try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        for (const eventName of ["dragenter", "dragover", "drop"]) {
            dropzone.dispatchEvent(createControlledDragEvent(eventName, transfer));
        }
        return null;
    }
    catch {
        return {
            blockerCode: "DROPZONE_UPLOAD_DISPATCH_FAILED",
            blockerMessage: "Controlled live upload cannot dispatch the approved media file to the page dropzone.",
            detailsRef: "dropzone_upload_dispatch_failed",
            requiredRecoveryAction: "provide a page-compatible controlled dropzone upload executor for the current creator UI"
        };
    }
};
const isBrowserFile = (value) => typeof File === "function" && value instanceof File;
const sleep = async (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
const buildXhsControlledLiveWriteUnavailableResult = (input) => {
    const timestamp = nowIso();
    const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
    const stopSignalId = `stop/fr-0032/${input.live_write_attempt_id}/executor-unavailable`;
    const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
    const stopSignal = {
        schema_version: "fr-0032.live_write_stop_signal.v1",
        stop_signal_id: stopSignalId,
        live_write_attempt_id: input.live_write_attempt_id,
        run_id: input.run_id,
        profile_ref: input.profile_ref ?? "unknown",
        target_tab_id: input.target_tab_id ?? 0,
        stopped_at: timestamp,
        stopped_step: "upload",
        blocker_layer: "upload",
        blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
        severity: "blocking",
        later_write_actions_blocked: true,
        cleanup_required: false,
        cleanup_result_id: null,
        residual_record_id: null,
        required_recovery_action: "provide a page executor that can safely perform controlled media upload before submit/publish",
        evidence_ref: evidenceRef
    };
    const liveWriteEvidence = {
        schema_version: "fr-0032.live_write_evidence.v1",
        live_write_attempt_id: input.live_write_attempt_id,
        canonical_issue_ref: "#835",
        execution_phase: "upload",
        scope: {
            platform: "xhs",
            target_domain: "creator.xiaohongshu.com",
            target_page: "creator_publish_tab",
            browser_channel: "Google Chrome stable",
            execution_surface: "real_browser",
            requested_execution_mode: "live_write",
            profile_ref: input.profile_ref ?? "unknown",
            target_tab_id: input.target_tab_id ?? 0,
            probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
            run_id: input.run_id,
            artifact_identity: uploadArtifactId
        },
        entry_gate: null,
        stop_classification: {
            category: "capability_gap",
            evaluation_state: "not_evaluated",
            not_evaluated_reason: "controlled_live_write_executor_unavailable",
            latest_head_sha: input.latest_head_sha ?? null,
            publish_visibility_scope: input.publish_visibility_scope,
            cleanup_policy_ref: input.cleanup_policy_ref
        },
        upload_artifact_identity: {
            upload_artifact_id: uploadArtifactId,
            source_media_ref: input.source_media_ref,
            source_media_digest: input.source_media_digest,
            source_media_kind: sourceMediaKind(input.source_media_kind),
            platform_staging_ref: null,
            page_preview_locator: null,
            accepted_by_platform: false,
            visible_in_editor: false,
            captured_at: timestamp,
            preview_diagnostics: null
        },
        submit_evidence: null,
        publish_result_identity: null,
        cleanup_result: null,
        risk_signals: [
            {
                risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/upload-unavailable`,
                detected_at: timestamp,
                source: "upload",
                kind: "upload_failure",
                severity: "blocking",
                details_ref: "controlled_live_write_executor_unavailable"
            }
        ],
        stop_signal: stopSignal,
        residual_record: null,
        created_at: timestamp,
        updated_at: timestamp
    };
    return {
        live_write_action: "controlled_upload_submit_publish",
        target_page: "creator_publish_tab",
        live_write_evidence: liveWriteEvidence,
        live_write_evaluation: {
            schema_version: "fr-0032.live_write_evaluation.v1",
            decision: "NO_GO",
            full_live_write_success: false,
            upload_success: false,
            submit_success: false,
            publish_success: false,
            cleanup_success: false,
            later_write_actions_blocked: true,
            cleanup_required: false,
            blockers: [
                {
                    blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
                    blocker_layer: "upload",
                    message: "No trusted page executor is available for controlled upload, so submit/publish are blocked."
                }
            ]
        },
        uploaded: false,
        submitted: false,
        published: false,
        cleanup_attempted: false,
        out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
    };
};
const buildXhsControlledLiveWriteUploadBlockedResult = (input, reason, uploadArtifact) => {
    const timestamp = nowIso();
    const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
    const stopSignalId = `stop/fr-0032/${input.live_write_attempt_id}/upload-blocked`;
    const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
    const stopSignal = {
        schema_version: "fr-0032.live_write_stop_signal.v1",
        stop_signal_id: stopSignalId,
        live_write_attempt_id: input.live_write_attempt_id,
        run_id: input.run_id,
        profile_ref: input.profile_ref ?? "unknown",
        target_tab_id: input.target_tab_id ?? 0,
        stopped_at: timestamp,
        stopped_step: "upload",
        blocker_layer: "upload",
        blocker_code: reason.blockerCode,
        severity: "blocking",
        later_write_actions_blocked: true,
        cleanup_required: false,
        cleanup_result_id: null,
        residual_record_id: null,
        required_recovery_action: reason.requiredRecoveryAction,
        evidence_ref: evidenceRef
    };
    const liveWriteEvidence = {
        schema_version: "fr-0032.live_write_evidence.v1",
        live_write_attempt_id: input.live_write_attempt_id,
        canonical_issue_ref: "#835",
        execution_phase: "upload",
        scope: {
            platform: "xhs",
            target_domain: "creator.xiaohongshu.com",
            target_page: "creator_publish_tab",
            browser_channel: "Google Chrome stable",
            execution_surface: "real_browser",
            requested_execution_mode: "live_write",
            profile_ref: input.profile_ref ?? "unknown",
            target_tab_id: input.target_tab_id ?? 0,
            probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
            run_id: input.run_id,
            artifact_identity: uploadArtifactId
        },
        entry_gate: null,
        stop_classification: {
            category: "upload_blocked",
            evaluation_state: "stopped",
            stop_reason: reason.detailsRef,
            latest_head_sha: input.latest_head_sha ?? null,
            publish_visibility_scope: input.publish_visibility_scope,
            cleanup_policy_ref: input.cleanup_policy_ref
        },
        upload_artifact_identity: uploadArtifact ?? {
            upload_artifact_id: uploadArtifactId,
            source_media_ref: input.source_media_ref,
            source_media_digest: input.source_media_digest,
            source_media_kind: sourceMediaKind(input.source_media_kind),
            platform_staging_ref: null,
            page_preview_locator: null,
            accepted_by_platform: false,
            visible_in_editor: false,
            captured_at: timestamp,
            preview_diagnostics: null
        },
        submit_evidence: null,
        publish_result_identity: null,
        cleanup_result: null,
        risk_signals: [
            {
                risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/upload-blocked`,
                detected_at: timestamp,
                source: "upload",
                kind: "upload_failure",
                severity: "blocking",
                details_ref: reason.detailsRef
            }
        ],
        stop_signal: stopSignal,
        residual_record: null,
        created_at: timestamp,
        updated_at: timestamp
    };
    return {
        live_write_action: "controlled_upload_submit_publish",
        target_page: "creator_publish_tab",
        live_write_evidence: liveWriteEvidence,
        live_write_evaluation: {
            schema_version: "fr-0032.live_write_evaluation.v1",
            decision: "NO_GO",
            full_live_write_success: false,
            upload_success: false,
            submit_success: false,
            publish_success: false,
            cleanup_success: false,
            later_write_actions_blocked: true,
            cleanup_required: false,
            blockers: [
                {
                    blocker_code: reason.blockerCode,
                    blocker_layer: "upload",
                    message: reason.blockerMessage
                }
            ]
        },
        uploaded: false,
        submitted: false,
        published: false,
        cleanup_attempted: false,
        out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
    };
};
const buildXhsControlledLiveWriteSubmitBlockedResult = (input, artifact) => {
    const result = buildXhsControlledLiveWriteUploadBlockedResult(input, {
        blockerCode: "SUBMIT_EXECUTOR_UNAVAILABLE",
        blockerMessage: "Upload evidence exists, but submit/publish executor is not available.",
        detailsRef: "submit_executor_unavailable",
        requiredRecoveryAction: "provide a submit/publish executor and cleanup policy executor before continuing after upload"
    });
    const evidence = result.live_write_evidence;
    const stopSignal = evidence.stop_signal;
    return {
        ...result,
        live_write_evidence: {
            ...evidence,
            execution_phase: "submit",
            stop_classification: {
                ...evidence.stop_classification,
                category: "submit_blocked",
                stop_reason: "submit_executor_unavailable"
            },
            upload_artifact_identity: artifact,
            risk_signals: [
                {
                    risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/submit-unavailable`,
                    detected_at: stopSignal.stopped_at,
                    source: "submit",
                    kind: "submit_failure",
                    severity: "blocking",
                    details_ref: "submit_executor_unavailable"
                }
            ],
            stop_signal: {
                ...stopSignal,
                stop_signal_id: `stop/fr-0032/${input.live_write_attempt_id}/submit-unavailable`,
                stopped_step: "submit",
                blocker_layer: "submit",
                blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
                cleanup_required: true,
                required_recovery_action: "provide a submit/publish executor and cleanup policy executor before continuing after upload"
            },
            updated_at: stopSignal.stopped_at
        },
        live_write_evaluation: {
            schema_version: "fr-0032.live_write_evaluation.v1",
            decision: "NO_GO",
            full_live_write_success: false,
            upload_success: true,
            submit_success: false,
            publish_success: false,
            cleanup_success: false,
            later_write_actions_blocked: true,
            cleanup_required: true,
            blockers: [
                {
                    blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
                    blocker_layer: "submit",
                    message: "Upload evidence exists, but submit/publish executor is not available."
                }
            ]
        },
        uploaded: true,
        cleanup_attempted: false
    };
};
const applyXhsControlledUploadPlatformCapture = (result, capture) => {
    if (!capture) {
        return result;
    }
    const evidence = result.live_write_evidence;
    const uploadArtifact = evidence.upload_artifact_identity;
    if (!uploadArtifact || uploadArtifact.accepted_by_platform === true) {
        return result;
    }
    if (capture.evidence_basis === "object_upload_transport_2xx" &&
        (uploadArtifact.visible_in_editor !== true || !uploadArtifact.page_preview_locator)) {
        return result;
    }
    const timestamp = nowIso();
    const acceptedArtifact = {
        ...uploadArtifact,
        platform_staging_ref: capture.platform_staging_ref,
        accepted_by_platform: true,
        captured_at: capture.captured_at
    };
    const stopSignal = evidence.stop_signal;
    const nextStopSignal = stopSignal
        ? {
            ...stopSignal,
            stop_signal_id: `stop/fr-0032/${String(evidence.live_write_attempt_id ?? "unknown")}/submit-unavailable`,
            stopped_step: "submit",
            blocker_layer: "submit",
            blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
            cleanup_required: true,
            required_recovery_action: "provide a submit/publish executor and cleanup policy executor before continuing after upload"
        }
        : null;
    const nextEvidence = {
        ...evidence,
        execution_phase: "submit",
        stop_classification: {
            ...(evidence.stop_classification ?? {}),
            category: "submit_blocked",
            evaluation_state: "stopped",
            stop_reason: "submit_executor_unavailable"
        },
        upload_artifact_identity: acceptedArtifact,
        platform_upload_acceptance_capture: capture,
        risk_signals: [
            {
                risk_signal_id: `risk/fr-0032/${String(evidence.live_write_attempt_id ?? "unknown")}/submit-unavailable`,
                detected_at: timestamp,
                source: "submit",
                kind: "submit_failure",
                severity: "blocking",
                details_ref: "submit_executor_unavailable"
            }
        ],
        stop_signal: nextStopSignal,
        updated_at: timestamp
    };
    return {
        ...result,
        live_write_evidence: nextEvidence,
        live_write_evaluation: {
            schema_version: "fr-0032.live_write_evaluation.v1",
            decision: "NO_GO",
            full_live_write_success: false,
            upload_success: true,
            submit_success: false,
            publish_success: false,
            cleanup_success: false,
            later_write_actions_blocked: true,
            cleanup_required: true,
            blockers: [
                {
                    blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
                    blocker_layer: "submit",
                    message: "Upload evidence exists, but submit/publish executor is not available."
                }
            ]
        },
        uploaded: true,
        cleanup_attempted: false
    };
};
const applyXhsControlledPublishResultIdentityCapture = (result, capture) => {
    if (!capture) {
        return result;
    }
    const evidence = result.live_write_evidence;
    if (evidence.publish_result_identity) {
        return result;
    }
    const evaluation = result.live_write_evaluation;
    const blockers = Array.isArray(evaluation.blockers) ? evaluation.blockers : [];
    const publishIdentityMissing = blockers.some((blocker) => {
        const record = asPlainRecord(blocker);
        return (record?.blocker_code === "PUBLISH_RESULT_IDENTITY_MISSING" &&
            record?.blocker_layer === "published_identity");
    });
    const uploadArtifact = asPlainRecord(evidence.upload_artifact_identity);
    const submitEvidence = asPlainRecord(evidence.submit_evidence);
    if (result.uploaded !== true ||
        result.submitted !== true ||
        publishIdentityMissing !== true ||
        !uploadArtifact ||
        !submitEvidence ||
        uploadArtifact.accepted_by_platform !== true) {
        return result;
    }
    const timestamp = nowIso();
    return {
        ...result,
        live_write_evidence: {
            ...evidence,
            publish_result_identity_capture: capture,
            updated_at: timestamp
        }
    };
};
const resolvePrivatePublishVisibilityProofLocator = (evidence, capture) => {
    if (capture.publish_visibility_scope === "private_or_self_visible" &&
        typeof capture.publish_visibility_proof_locator === "string" &&
        capture.publish_visibility_proof_locator.trim().length > 0) {
        return capture.publish_visibility_proof_locator.trim();
    }
    const cleanupResult = asPlainRecord(evidence.cleanup_result);
    const residualRecord = asPlainRecord(evidence.residual_record) ?? asPlainRecord(cleanupResult?.residual_record);
    const stopClassification = asPlainRecord(evidence.stop_classification);
    const visibilityScope = normalizeTrustedPublishVisibilityScope(residualRecord?.visibility_scope) ??
        normalizeTrustedPublishVisibilityScope(stopClassification?.publish_visibility_scope);
    const cleanupProofLocator = typeof cleanupResult?.proof_locator === "string" && cleanupResult.proof_locator.trim().length > 0
        ? cleanupResult.proof_locator.trim()
        : null;
    return visibilityScope === "private_or_self_visible" ? cleanupProofLocator : null;
};
const finalizeXhsControlledPublishResultIdentityCapture = (result, capture) => {
    const captured = applyXhsControlledPublishResultIdentityCapture(result, capture);
    if (!capture || captured.live_write_evidence.publish_result_identity) {
        return captured;
    }
    const visibilityProofLocator = resolvePrivatePublishVisibilityProofLocator(captured.live_write_evidence, capture);
    if (!visibilityProofLocator) {
        return captured;
    }
    const evidence = captured.live_write_evidence;
    const evaluation = captured.live_write_evaluation;
    const blockers = Array.isArray(evaluation.blockers) ? evaluation.blockers : [];
    const hasOnlyPublishIdentityMissingBlockers = blockers.length > 0 &&
        blockers.every((blocker) => {
            const record = asPlainRecord(blocker);
            return (record?.blocker_code === "PUBLISH_RESULT_IDENTITY_MISSING" &&
                record?.blocker_layer === "published_identity");
        });
    const riskSignals = Array.isArray(evidence.risk_signals) ? evidence.risk_signals : [];
    const hasOnlyPublishIdentityMissingRiskSignals = riskSignals.every((riskSignal) => {
        const record = asPlainRecord(riskSignal);
        return (record?.kind === "publish_identity_missing" ||
            record?.blocker_code === "PUBLISH_RESULT_IDENTITY_MISSING");
    });
    const uploadArtifact = asPlainRecord(evidence.upload_artifact_identity);
    const submitEvidence = asPlainRecord(evidence.submit_evidence);
    if (captured.uploaded !== true ||
        captured.submitted !== true ||
        hasOnlyPublishIdentityMissingBlockers !== true ||
        hasOnlyPublishIdentityMissingRiskSignals !== true ||
        !uploadArtifact ||
        !submitEvidence ||
        uploadArtifact.accepted_by_platform !== true) {
        return captured;
    }
    const scope = asPlainRecord(evidence.scope);
    const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0 ? value : null;
    const liveWriteAttemptId = nonEmptyString(evidence.live_write_attempt_id);
    const runId = nonEmptyString(scope?.run_id);
    const profileRef = nonEmptyString(scope?.profile_ref);
    const targetTabId = scope?.target_tab_id;
    const uploadArtifactId = nonEmptyString(uploadArtifact.upload_artifact_id);
    const submitActionRef = nonEmptyString(submitEvidence.submit_action_ref);
    const submittedAt = nonEmptyString(submitEvidence.submitted_at);
    const submitCapturedAtMs = submittedAt ? Date.parse(submittedAt) : Number.NaN;
    const publishCapturedAtMs = Date.parse(capture.captured_at);
    if (!liveWriteAttemptId ||
        !runId ||
        !profileRef ||
        typeof targetTabId !== "number" ||
        !Number.isInteger(targetTabId) ||
        targetTabId < 0 ||
        !uploadArtifactId ||
        !submitActionRef ||
        !Number.isFinite(submitCapturedAtMs) ||
        !Number.isFinite(publishCapturedAtMs) ||
        publishCapturedAtMs < submitCapturedAtMs) {
        return captured;
    }
    const previousCleanup = asPlainRecord(evidence.cleanup_result);
    const cleanupPolicyRef = String(previousCleanup?.cleanup_policy_ref ?? "fr0032-cleanup-policy/delete-or-residual");
    const closedAt = nowIso();
    const publishIdentity = {
        schema_version: "fr-0032.publish_result_identity.v1",
        publish_result_id: `publish-result/fr-0032/${liveWriteAttemptId}`,
        live_write_attempt_id: liveWriteAttemptId,
        run_id: runId,
        profile_ref: profileRef,
        target_tab_id: targetTabId,
        target_domain: "creator.xiaohongshu.com",
        target_page: "creator_publish_tab",
        source_upload_artifact_id: uploadArtifactId,
        submit_action_ref: submitActionRef,
        result_kind: capture.result_kind,
        note_id: capture.note_id,
        published_url: capture.published_url,
        creator_result_url: capture.creator_result_url,
        platform_record_ref: capture.platform_record_ref,
        publish_visibility_scope: "private_or_self_visible",
        success_signal: {
            signal_source: "platform_response",
            signal_locator: capture.url,
            platform_message: "trusted platform publish result identity captured",
            observed_at: capture.captured_at
        },
        captured_at: capture.captured_at,
        verification_state: "verified"
    };
    const cleanup = {
        schema_version: "fr-0032.cleanup_rollback_proof.v1",
        cleanup_result_id: `cleanup/fr-0032/${liveWriteAttemptId}/private-visibility-background-capture`,
        live_write_attempt_id: liveWriteAttemptId,
        run_id: runId,
        profile_ref: profileRef,
        target_tab_id: targetTabId,
        publish_result_identity: publishIdentity,
        cleanup_policy_ref: cleanupPolicyRef,
        cleanup_action: "hide_published_result",
        cleanup_outcome: "hidden",
        proof_locator: visibilityProofLocator,
        platform_message: "publish_visibility_scope=private_or_self_visible confirmed before submit; trusted platform response captured publish identity",
        attempted_at: closedAt,
        completed_at: closedAt,
        residual_record: null
    };
    return {
        ...captured,
        live_write_evidence: {
            ...evidence,
            execution_phase: "closed",
            stop_classification: null,
            publish_result_identity_capture: capture,
            publish_result_identity: publishIdentity,
            cleanup_result: cleanup,
            risk_signals: [],
            stop_signal: null,
            residual_record: null,
            updated_at: closedAt
        },
        live_write_evaluation: {
            schema_version: "fr-0032.live_write_evaluation.v1",
            decision: "GO",
            full_live_write_success: true,
            upload_success: true,
            submit_success: true,
            publish_success: true,
            cleanup_success: true,
            later_write_actions_blocked: false,
            cleanup_required: false,
            blockers: []
        },
        published: true,
        cleanup_attempted: true
    };
};
const publishIdentityCaptureStatusMessage = (blockerCode) => {
    switch (blockerCode) {
        case "PUBLISH_IDENTITY_CAPTURE_NOT_STARTED":
            return "Background publish identity capture did not start for the submit continuation.";
        case "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_NOT_OBSERVED":
            return "Background publish identity capture did not observe a trusted publish/result endpoint after submit.";
        case "PUBLISH_IDENTITY_CAPTURE_DIAGNOSTIC_EVENTS_NOT_RECORDED":
            return "Background publish identity capture observed post-submit network activity, but diagnostics did not retain any publish identity candidate shape.";
        case "PUBLISH_ACTION_NETWORK_NOT_OBSERVED":
            return "Controlled publish action did not produce post-submit network activity during the identity capture window.";
        case "PUBLISH_IDENTITY_CAPTURE_ENDPOINT_UNTRUSTED":
            return "Background publish identity capture observed post-submit XHS write requests, but none matched the trusted publish/result endpoint taxonomy.";
        case "PUBLISH_IDENTITY_CAPTURE_RESPONSE_BODY_UNREADABLE":
            return "Background publish identity capture observed a trusted publish/result endpoint but could not read its response body.";
        case "PUBLISH_IDENTITY_CAPTURE_RESPONSE_IDENTITY_MISSING":
            return "Background publish identity capture observed a readable publish/result response without a trusted publish identity.";
        case "PUBLISH_IDENTITY_CAPTURE_TIMED_OUT":
            return "Background publish identity capture timed out before producing a trusted publish identity.";
    }
};
const applyXhsControlledPublishResultIdentityCaptureStatus = (result, status) => {
    if (!status?.blocker_code) {
        return result;
    }
    const evidence = result.live_write_evidence;
    if (evidence.publish_result_identity) {
        return result;
    }
    const evaluation = result.live_write_evaluation;
    const blockers = Array.isArray(evaluation.blockers) ? evaluation.blockers : [];
    const publishIdentityMissing = blockers.some((blocker) => {
        const record = asPlainRecord(blocker);
        return (record?.blocker_code === "PUBLISH_RESULT_IDENTITY_MISSING" &&
            record?.blocker_layer === "published_identity");
    });
    if (result.uploaded !== true || result.submitted !== true || publishIdentityMissing !== true) {
        return result;
    }
    const timestamp = nowIso();
    const liveWriteAttemptId = String(evidence.live_write_attempt_id ?? "unknown");
    const message = publishIdentityCaptureStatusMessage(status.blocker_code);
    const stopSignal = asPlainRecord(evidence.stop_signal) ?? {};
    const nextStopSignal = {
        ...stopSignal,
        blocker_code: status.blocker_code,
        required_recovery_action: "fix background publish identity capture diagnostics/parser before retrying publish identity",
        diagnostics: {
            ...(asPlainRecord(stopSignal.diagnostics) ?? {}),
            publish_result_identity_capture_status: status
        }
    };
    return {
        ...result,
        live_write_evidence: {
            ...evidence,
            publish_result_identity_capture_status: status,
            stop_classification: {
                ...(asPlainRecord(evidence.stop_classification) ?? {}),
                stop_reason: status.reason ?? status.blocker_code,
                publish_identity_capture_blocker_code: status.blocker_code
            },
            risk_signals: [
                {
                    risk_signal_id: `risk/fr-0032/${liveWriteAttemptId}/${status.blocker_code}`,
                    detected_at: timestamp,
                    source: "background_publish_identity_capture",
                    kind: "publish_identity_missing",
                    severity: "blocking",
                    details_ref: status.reason ?? status.blocker_code,
                    blocker_code: status.blocker_code
                }
            ],
            stop_signal: nextStopSignal,
            updated_at: timestamp
        },
        live_write_evaluation: {
            ...evaluation,
            decision: "NO_GO",
            full_live_write_success: false,
            upload_success: true,
            submit_success: true,
            publish_success: false,
            cleanup_success: false,
            later_write_actions_blocked: true,
            cleanup_required: true,
            blockers: [
                {
                    blocker_code: status.blocker_code,
                    blocker_layer: "published_identity",
                    message
                }
            ]
        }
    };
};
const applyXhsControlledLiveWriteContinuationTimeout = (result, input) => {
    const timestamp = nowIso();
    const evidence = result.live_write_evidence;
    const scope = evidence.scope;
    const liveWriteAttemptId = String(evidence.live_write_attempt_id ?? "unknown");
    const stopSignal = evidence.stop_signal ?? {
        schema_version: "fr-0032.live_write_stop_signal.v1",
        live_write_attempt_id: liveWriteAttemptId,
        run_id: String(scope?.run_id ?? "unknown"),
        profile_ref: String(scope?.profile_ref ?? "unknown"),
        target_tab_id: Number(scope?.target_tab_id ?? 0),
        severity: "blocking",
        cleanup_result_id: null,
        residual_record_id: null,
        evidence_ref: `live_write_evidence/${liveWriteAttemptId}`
    };
    const nextStopSignal = {
        ...stopSignal,
        stop_signal_id: `stop/fr-0032/${liveWriteAttemptId}/submit-continuation-timeout`,
        stopped_at: timestamp,
        stopped_step: "submit",
        blocker_layer: "runtime-channel",
        blocker_code: "SUBMIT_CONTINUATION_TIMEOUT",
        later_write_actions_blocked: true,
        cleanup_required: true,
        required_recovery_action: "rerun controlled submit/publish with the accepted_upload_artifact_identity from this evidence"
    };
    const nextEvidence = {
        ...evidence,
        execution_phase: "submit",
        stop_classification: {
            ...(evidence.stop_classification ?? {}),
            category: "submit_blocked",
            evaluation_state: "stopped",
            stop_reason: "submit_continuation_timeout",
            background_upload_capture_continuation: {
                attempted: true,
                continuation_key: input.continuationKey,
                failure_reason: input.reason,
                recorded_at: timestamp
            }
        },
        risk_signals: [
            {
                risk_signal_id: `risk/fr-0032/${liveWriteAttemptId}/submit-continuation-timeout`,
                detected_at: timestamp,
                source: "runtime-channel",
                kind: "submit_failure",
                severity: "blocking",
                details_ref: "submit_continuation_timeout"
            }
        ],
        stop_signal: nextStopSignal,
        updated_at: timestamp
    };
    return {
        ...result,
        live_write_evidence: nextEvidence,
        live_write_evaluation: {
            schema_version: "fr-0032.live_write_evaluation.v1",
            decision: "NO_GO",
            full_live_write_success: false,
            upload_success: true,
            submit_success: false,
            publish_success: false,
            cleanup_success: false,
            later_write_actions_blocked: true,
            cleanup_required: true,
            blockers: [
                {
                    blocker_code: "SUBMIT_CONTINUATION_TIMEOUT",
                    blocker_layer: "runtime-channel",
                    message: "Accepted upload evidence exists, but the controlled submit/publish continuation timed out."
                }
            ]
        },
        uploaded: true,
        submitted: false,
        published: false,
        cleanup_attempted: false
    };
};
const applyXhsControlledUploadPlatformCaptureStatus = (result, status) => {
    if (!status) {
        return result;
    }
    const evidence = result.live_write_evidence;
    if (evidence.platform_upload_acceptance_capture) {
        return result;
    }
    return {
        ...result,
        live_write_evidence: {
            ...evidence,
            platform_upload_acceptance_capture_status: status,
            updated_at: nowIso()
        }
    };
};
const buildXhsControlledLiveWriteFromDiscovery = (input, discovery) => {
    if (discovery.controlled_upload_evidence?.upload_artifact_identity?.accepted_by_platform === true) {
        return buildXhsControlledLiveWriteSubmitBlockedResult(input, discovery.controlled_upload_evidence.upload_artifact_identity);
    }
    const artifact = discovery.controlled_upload_evidence?.upload_artifact_identity ?? null;
    if (!artifact) {
        return buildXhsControlledLiveWriteUploadBlockedResult(input, {
            blockerCode: "UPLOAD_ARTIFACT_MISSING",
            blockerMessage: "Controlled live write cannot continue because no upload artifact identity is available.",
            detailsRef: "upload_artifact_identity_missing",
            requiredRecoveryAction: "provide a source media resolver and upload executor that can produce platform-accepted upload artifact identity"
        });
    }
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
        blockerCode: "UPLOAD_PLATFORM_REJECTED",
        blockerMessage: "Controlled live write cannot continue because recon evidence did not perform or prove platform upload acceptance.",
        detailsRef: "source_media_resolution_or_upload_acceptance_unavailable",
        requiredRecoveryAction: "provide a controlled media resolver and real upload executor before submit/publish"
    }, artifact);
};
const privateVisibilityPattern = /仅自己可见|仅自己|自己可见|仅自己看|仅我可见|仅我|私密发布|私密|仅本人|不公开|private|only\s*me|self[-_ ]?visible/iu;
const publicVisibilityPattern = /公开|所有人|public|everyone/iu;
const visibilityTriggerPattern = /可见范围|可见权限|可见用户|可见性|谁可以看|谁可以查看|谁能看|谁可见|谁能见|观看权限|查看权限|浏览权限|权限设置|发布权限|内容权限|笔记权限|visibility|privacy|permission/iu;
const visibilitySettingsDisclosurePattern = /发布设置|高级设置|更多设置|更多选项|展开更多|设置更多|权限设置|内容权限|笔记权限|post\s*settings|publish\s*settings|advanced\s*settings|more\s*(settings|options)/iu;
const visibilityStructuralPattern = /visibility|privacy|permission|select|dropdown|radio|setting|scope|range|visible|viewer|audience|current|value|trigger|selector|reds-select|d-select|el-select|semi-select|ant-select/iu;
const visibilityTriggerActionPattern = /button|combobox|listbox|radio|menuitemradio|option|select|dropdown/iu;
const submitPublishPattern = /发布|提交|确认发布|publish|submit/iu;
const nonSubmitPublishPattern = /发布设置|高级设置|更多设置|更多选项|权限设置|内容权限|笔记权限|草稿|存为|预览|取消|返回|定时|save|draft|preview|cancel|back|schedule|post\s*settings|publish\s*settings|advanced\s*settings|more\s*(settings|options)/iu;
const publishSuccessPattern = /发布成功|发布完成|已发布|提交成功|publish(ed)?\s*(success|complete)|success/iu;
const nativeSubmitControlSelector = [
    "button",
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]'
].join(",");
const customSubmitControlSelector = [
    '[class*="submit" i]',
    '[class*="publish" i]',
    '[class*="button" i]',
    '[class*="btn" i]',
    '[data-testid*="submit" i]',
    '[data-testid*="publish" i]',
    '[data-test*="submit" i]',
    '[data-test*="publish" i]'
].join(",");
const submitControlActionSignalPattern = /(^|[\s_-])(submit|publish|post|confirm|btn|button)([\s_-]|$)|d-button|reds-button|semi-button|ant-btn|el-button/iu;
const submitControlContainerSignalPattern = /publish-(page|panel|content|container|form|wrapper|editor)|(^|[\s_-])(page|panel|content|container|form|wrapper|editor|settings)([\s_-]|$)/iu;
const publishModeNavigationPattern = /发布\s*(?:视频|图文|笔记)|(?:^|[\s_-])publish[\s_-]?(?:video|image|note)(?:$|[\s_-])/iu;
const publishModeNavigationSelector = ".publish-video,.publish-image,.publish-note,.menu-container,.menu-panel,[data-role='publish-mode-nav']";
const uploadStageContinuationPattern = /下一步|下一|继续|完成|next|continue/iu;
const uploadStageContainerPattern = /upload|media|material|publish-page-content-media|upload-wrapper|upload-container/iu;
const uploadStageContinuationSelector = [
    "button",
    '[role="button"]',
    '[class*="button" i]',
    '[class*="btn" i]',
    '[class*="next" i]',
    '[class*="continue" i]'
].join(",");
const normalizeVisibilitySemanticSignal = (value) => value
    .normalize("NFKC")
    .replace(/[\s\u00a0\u1680\u180e\u2000-\u200f\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]+/gu, "");
const hasPrivateVisibilitySignal = (value) => privateVisibilityPattern.test(value) || privateVisibilityPattern.test(normalizeVisibilitySemanticSignal(value));
const hasPublicVisibilitySignal = (value) => publicVisibilityPattern.test(value) || publicVisibilityPattern.test(normalizeVisibilitySemanticSignal(value));
const hasVisibilityTriggerSignal = (value) => visibilityTriggerPattern.test(value) || visibilityTriggerPattern.test(normalizeVisibilitySemanticSignal(value));
const isNativeSubmitControl = (element) => {
    const tagName = element.tagName.toLowerCase();
    const type = getElementAttribute(element, "type") ?? "";
    return tagName === "button" || (tagName === "input" && /button|submit/iu.test(type));
};
const hasPublishModeNavigationAncestor = (element) => {
    if (typeof element.closest === "function") {
        try {
            return element.closest(publishModeNavigationSelector) !== null;
        }
        catch {
            // Fall through to the parentElement walk for partial DOM shims.
        }
    }
    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
        const signal = `${getElementAttribute(current, "class") ?? ""} ${getElementAttribute(current, "data-role") ?? ""}`;
        if (publishModeNavigationPattern.test(signal) || getElementAttribute(current, "data-role") === "publish-mode-nav") {
            return true;
        }
        current = current.parentElement;
    }
    return false;
};
const isPublishModeNavigationSubmitControl = (element, signal) => {
    const tagName = element.tagName.toLowerCase();
    const className = getElementAttribute(element, "class") ?? "";
    const roleAttr = getElementAttribute(element, "role");
    const semanticActionTarget = isNativeSubmitControl(element) ||
        tagName === "a" ||
        roleAttr === "button" ||
        /\b(?:button|submit|confirm|btn)\b/iu.test(className);
    if (semanticActionTarget) {
        return false;
    }
    return publishModeNavigationPattern.test(`${signal} ${className}`) || hasPublishModeNavigationAncestor(element);
};
const isSafeSubmitPublishControl = (element) => {
    const signal = elementTextSignal(element);
    if (!isVisibleElement(element) ||
        isDisabledElement(element) ||
        !submitPublishPattern.test(signal) ||
        nonSubmitPublishPattern.test(signal) ||
        isPublishModeNavigationSubmitControl(element, signal)) {
        return false;
    }
    if (isNativeSubmitControl(element)) {
        return true;
    }
    const actionSignal = [
        getElementAttribute(element, "data-testid"),
        getElementAttribute(element, "data-test"),
        getElementAttribute(element, "class")
    ]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join(" ");
    const displayedText = elementDisplayedTextSignal(element).replace(/\s+/gu, "");
    return (displayedText.length > 0 &&
        displayedText.length <= 24 &&
        submitControlActionSignalPattern.test(actionSignal) &&
        !submitControlContainerSignalPattern.test(actionSignal));
};
const findSubmitPublishControl = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    return (Array.from(document.querySelectorAll(nativeSubmitControlSelector)).find(isSafeSubmitPublishControl) ??
        Array.from(document.querySelectorAll(customSubmitControlSelector)).find(isSafeSubmitPublishControl) ??
        null);
};
const hasUploadStageAncestor = (element) => {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
        const signal = `${locatorForElement(current)} ${visibilityStructuralSignal(current)} ${textContentOf(current)}`;
        if (uploadStageContainerPattern.test(signal)) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
};
const isSafeUploadStageContinuationControl = (element) => {
    const displayedText = elementDisplayedTextSignal(element).replace(/\s+/gu, "");
    const signal = `${displayedText} ${visibilityStructuralSignal(element)}`;
    return (isVisibleElement(element) &&
        !isDisabledElement(element) &&
        displayedText.length > 0 &&
        displayedText.length <= 16 &&
        uploadStageContinuationPattern.test(signal) &&
        !submitPublishPattern.test(signal) &&
        !nonSubmitPublishPattern.test(signal) &&
        hasUploadStageAncestor(element) &&
        typeof element.click === "function");
};
const findUploadStageContinuationControl = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    return Array.from(document.querySelectorAll(uploadStageContinuationSelector)).find(isSafeUploadStageContinuationControl) ?? null;
};
const continueFromAcceptedUploadStageIfNeeded = async () => {
    const continuationControl = findUploadStageContinuationControl();
    if (!continuationControl) {
        return false;
    }
    continuationControl.click();
    await sleep(800);
    return true;
};
const uploadStageCleanupResult = (input, timestamp, reason) => ({
    schema_version: "fr-0032.cleanup_rollback_proof.v1",
    cleanup_result_id: `cleanup/fr-0032/${input.live_write_attempt_id}/upload-stage`,
    live_write_attempt_id: input.live_write_attempt_id,
    run_id: input.run_id,
    profile_ref: input.profile_ref ?? "unknown",
    target_tab_id: input.target_tab_id ?? 0,
    publish_result_identity: null,
    cleanup_policy_ref: input.cleanup_policy_ref,
    cleanup_action: "abandon_unpublished_upload",
    cleanup_outcome: "not_needed",
    proof_locator: "creator_publish_editor_unpublished_upload_only",
    platform_message: reason,
    attempted_at: timestamp,
    completed_at: timestamp,
    residual_record: null
});
const buildStepBlockedResult = (input, artifact, reason, submitEvidence = null, cleanupResult = null, residualRecord = null) => {
    const timestamp = nowIso();
    const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
    const cleanupResultId = cleanupResult && typeof cleanupResult.cleanup_result_id === "string" ? cleanupResult.cleanup_result_id : null;
    const residualRecordId = residualRecord && typeof residualRecord.residual_record_id === "string" ? residualRecord.residual_record_id : null;
    return {
        live_write_action: "controlled_upload_submit_publish",
        target_page: "creator_publish_tab",
        live_write_evidence: {
            schema_version: "fr-0032.live_write_evidence.v1",
            live_write_attempt_id: input.live_write_attempt_id,
            canonical_issue_ref: "#835",
            execution_phase: reason.stoppedStep,
            scope: {
                platform: "xhs",
                target_domain: "creator.xiaohongshu.com",
                target_page: "creator_publish_tab",
                browser_channel: "Google Chrome stable",
                execution_surface: "real_browser",
                requested_execution_mode: "live_write",
                profile_ref: input.profile_ref ?? "unknown",
                target_tab_id: input.target_tab_id ?? 0,
                probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
                run_id: input.run_id,
                artifact_identity: artifact.upload_artifact_id
            },
            entry_gate: null,
            stop_classification: {
                category: `${reason.blockerLayer}_blocked`,
                evaluation_state: "stopped",
                stop_reason: reason.detailsRef,
                latest_head_sha: input.latest_head_sha ?? null,
                publish_visibility_scope: input.publish_visibility_scope,
                cleanup_policy_ref: input.cleanup_policy_ref
            },
            upload_artifact_identity: artifact,
            submit_evidence: submitEvidence,
            publish_result_identity: null,
            cleanup_result: cleanupResult,
            risk_signals: [
                {
                    risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/${reason.detailsRef}`,
                    detected_at: timestamp,
                    source: reason.blockerLayer === "published_identity" ? "publish" : reason.blockerLayer,
                    kind: reason.riskKind,
                    severity: "blocking",
                    details_ref: reason.detailsRef
                }
            ],
            stop_signal: {
                schema_version: "fr-0032.live_write_stop_signal.v1",
                stop_signal_id: `stop/fr-0032/${input.live_write_attempt_id}/${reason.detailsRef}`,
                live_write_attempt_id: input.live_write_attempt_id,
                run_id: input.run_id,
                profile_ref: input.profile_ref ?? "unknown",
                target_tab_id: input.target_tab_id ?? 0,
                stopped_at: timestamp,
                stopped_step: reason.stoppedStep,
                blocker_layer: reason.blockerLayer,
                blocker_code: reason.blockerCode,
                severity: "blocking",
                later_write_actions_blocked: true,
                cleanup_required: reason.cleanupRequired,
                cleanup_result_id: cleanupResultId,
                residual_record_id: residualRecordId,
                required_recovery_action: reason.requiredRecoveryAction,
                evidence_ref: evidenceRef,
                ...(reason.diagnostics ? { diagnostics: reason.diagnostics } : {})
            },
            residual_record: residualRecord,
            ...(reason.diagnostics ? { blocker_diagnostics: reason.diagnostics } : {}),
            created_at: timestamp,
            updated_at: timestamp
        },
        live_write_evaluation: {
            schema_version: "fr-0032.live_write_evaluation.v1",
            decision: "NO_GO",
            full_live_write_success: false,
            upload_success: true,
            submit_success: submitEvidence?.submit_result_state === "accepted",
            publish_success: false,
            cleanup_success: cleanupResult?.cleanup_outcome === "not_needed",
            later_write_actions_blocked: true,
            cleanup_required: reason.cleanupRequired,
            blockers: [
                {
                    blocker_code: reason.blockerCode,
                    blocker_layer: reason.blockerLayer,
                    message: reason.blockerMessage
                }
            ]
        },
        uploaded: true,
        submitted: submitEvidence?.submit_result_state === "accepted",
        published: false,
        cleanup_attempted: cleanupResult !== null,
        out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
    };
};
const visibilityControlSelector = [
    "button",
    "label",
    '[role="button"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="radio"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[class*="option" i]',
    '[class*="radio" i]',
    '[class*="visibility" i]',
    '[class*="privacy" i]',
    '[class*="permission" i]',
    "input",
    "textarea",
    '[class*="setting" i]',
    '[class*="scope" i]',
    '[class*="range" i]',
    '[class*="select" i]',
    '[class*="dropdown" i]'
].join(",");
const privateVisibilityOptionSelector = [
    visibilityControlSelector,
    '[role="menu"] *',
    '[role="listbox"] *',
    '[class*="popover" i] *',
    '[class*="dropdown" i] *',
    '[class*="select" i] *'
].join(",");
const openedPlainPrivateVisibilityOptionSelector = [
    '[role="menu"] li',
    '[role="menu"] div',
    '[role="menu"] span',
    '[class*="menu" i] li',
    '[class*="menu" i] div',
    '[class*="menu" i] span',
    '[role="listbox"] li',
    '[role="listbox"] div',
    '[role="listbox"] span',
    '[class*="popper" i] li',
    '[class*="popper" i] div',
    '[class*="popper" i] span',
    '[class*="popover" i] li',
    '[class*="popover" i] div',
    '[class*="popover" i] span',
    '[class*="portal" i] li',
    '[class*="portal" i] div',
    '[class*="portal" i] span',
    '[class*="dropdown" i]',
    '[class*="dropdown" i] li',
    '[class*="dropdown" i] div',
    '[class*="dropdown" i] span',
    '[class*="select" i]',
    '[class*="select" i] li',
    '[class*="select" i] div',
    '[class*="select" i] span',
    '[class*="option" i]',
    '[class*="item" i]'
].join(",");
const visibleVisibilityDropdownPortalSelector = [
    "div.d-popover.d-popover-default.d-dropdown",
    "div.d-dropdown-wrapper",
    "div.d-dropdown-content",
    "div.d-options-wrapper",
    '[class*="popover" i][class*="dropdown" i]',
    '[class*="dropdown" i][class*="wrapper" i]',
    '[class*="dropdown" i][class*="content" i]',
    '[class*="options" i][class*="wrapper" i]'
].join(",");
const isPrivateVisibilityOptionCandidate = (element) => {
    const signal = elementTextSignal(element);
    if (!isVisibleElement(element) ||
        isDisabledElement(element) ||
        !hasPrivateVisibilitySignal(signal) ||
        hasPublicVisibilitySignal(signal)) {
        return false;
    }
    const structuralSignal = visibilityStructuralSignal(element);
    if (/d-popover|d-dropdown-wrapper|d-dropdown-content|d-options-wrapper/iu.test(structuralSignal)) {
        return false;
    }
    if (/custom-option|select-option|dropdown-item|option|menuitem|\bname\b/iu.test(structuralSignal)) {
        return true;
    }
    return typeof element.querySelectorAll !== "function" || element.querySelectorAll("*").length === 0;
};
const findPrivateVisibilityOptionFromSelector = (selector) => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    return Array.from(document.querySelectorAll(selector)).find(isPrivateVisibilityOptionCandidate) ?? null;
};
const findPrivateVisibilityOption = (allowOpenedPlainTextOption = false) => {
    const structuredOption = findPrivateVisibilityOptionFromSelector(privateVisibilityOptionSelector);
    if (structuredOption || !allowOpenedPlainTextOption) {
        return structuredOption;
    }
    return findPrivateVisibilityOptionFromSelector(openedPlainPrivateVisibilityOptionSelector);
};
const findVisibleVisibilityDropdownPortal = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    return Array.from(document.querySelectorAll(visibleVisibilityDropdownPortalSelector))
        .find((element) => {
        const structuralSignal = visibilityStructuralSignal(element);
        return (isVisibleElement(element) &&
            /d-popover|d-dropdown-wrapper|d-dropdown-content|d-options-wrapper|popover.*dropdown|dropdown.*wrapper|dropdown.*content|options.*wrapper/iu.test(structuralSignal) &&
            !/custom-option|select-option|dropdown-item|\boption\b|menuitem|\bname\b/iu.test(structuralSignal));
    }) ?? null;
};
const hasMountedPrivateVisibilityOption = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return false;
    }
    return Array.from(document.querySelectorAll(openedPlainPrivateVisibilityOptionSelector))
        .some((element) => {
        const signal = elementTextSignal(element);
        return (isVisibleElement(element) &&
            hasPrivateVisibilitySignal(signal) &&
            !hasPublicVisibilitySignal(signal) &&
            !isDisabledElement(element));
    });
};
const resolvePrivateVisibilityOptionClickTarget = (element) => {
    let current = element;
    for (let depth = 0; current && depth < 4; depth += 1) {
        const structuralSignal = visibilityStructuralSignal(current);
        if (/custom-option|select-option|dropdown-item|option|menuitem/iu.test(structuralSignal) &&
            !/\bname\b/iu.test(structuralSignal) &&
            !/d-popover|d-dropdown-wrapper|d-dropdown-content|d-options-wrapper/iu.test(structuralSignal) &&
            typeof current.click === "function" &&
            !isDisabledElement(current)) {
            return current;
        }
        current = current.parentElement;
    }
    return element;
};
const visibilitySelectionConfirmationCandidates = (root) => {
    const descendants = typeof root.querySelectorAll === "function"
        ? Array.from(root.querySelectorAll(visibilityControlSelector))
        : [];
    return uniqueVisibilityElements([root, ...descendants]);
};
const isVisibilitySelectionConfirmationElement = (element) => {
    const structuralSignal = visibilityStructuralSignal(element);
    return (!/d-popover|d-dropdown-wrapper|d-dropdown-content|d-options-wrapper|custom-option|select-option|dropdown-item|\boption\b|menuitem|\bname\b/iu.test(structuralSignal) &&
        !nonVisibilitySelectContextPattern.test(structuralSignal));
};
const nearestVisibilityConfirmationRoot = (element) => {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
        if (isVisibilitySelectionConfirmationElement(current)) {
            return current;
        }
        current = current.parentElement;
    }
    return element;
};
const hasConfirmedPrivateVisibilitySelection = (root) => {
    return visibilitySelectionConfirmationCandidates(root).some((element) => {
        const signal = elementDisplayedTextSignal(element);
        return (isVisibleElement(element) &&
            isVisibilitySelectionConfirmationElement(element) &&
            hasPrivateVisibilitySignal(signal) &&
            !hasPublicVisibilitySignal(signal));
    });
};
const visibilityStructuralSignal = (element) => [
    getElementAttribute(element, "data-testid"),
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    getElementAttribute(element, "role"),
    getElementAttribute(element, "class")
]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
const visibilityContextSelector = [
    "label",
    "div",
    "span",
    "p",
    '[class*="label" i]',
    '[class*="title" i]',
    '[class*="setting" i]',
    '[class*="scope" i]',
    '[class*="range" i]',
    '[class*="permission" i]',
    '[class*="visibility" i]',
    '[class*="privacy" i]'
].join(",");
const visibilityContextTriggerSelector = [
    "button",
    '[role="button"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="radio"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    "label",
    "input",
    "textarea",
    "div",
    "span",
    '[class*="select" i]',
    '[class*="dropdown" i]',
    '[class*="radio" i]',
    '[class*="option" i]',
    '[class*="value" i]',
    '[class*="current" i]'
].join(",");
const plainPublicVisibilityValueSelector = [
    "button",
    "input",
    "textarea",
    '[role="button"]',
    '[role="combobox"]'
].join(",");
const plainPublicVisibilityTextValueSelector = [
    "div",
    "span",
    "p"
].join(",");
const visibilitySettingsDisclosureSelector = [
    "button",
    "summary",
    '[role="button"]',
    '[aria-expanded]',
    '[class*="setting" i]',
    '[class*="expand" i]',
    '[class*="collapse" i]',
    '[class*="more" i]',
    '[class*="advanced" i]'
].join(",");
const hasPublicVisibilityCandidate = (element, context) => {
    if (typeof element.querySelectorAll !== "function") {
        return false;
    }
    return Array.from(element.querySelectorAll(visibilityContextTriggerSelector)).some((candidate) => {
        const signal = elementTextSignal(candidate);
        return (candidate !== context &&
            isVisibleElement(candidate) &&
            !isDisabledElement(candidate) &&
            hasPublicVisibilitySignal(signal) &&
            !hasPrivateVisibilitySignal(signal) &&
            !nonSubmitPublishPattern.test(signal));
    });
};
const visibilityContextContainer = (element) => {
    let current = element;
    let nearestPublicCandidateContainer = null;
    for (let depth = 0; current && depth < 8; depth += 1) {
        const currentText = textContentOf(current);
        if (hasPublicVisibilitySignal(currentText) || hasPrivateVisibilitySignal(currentText)) {
            return current;
        }
        if (!nearestPublicCandidateContainer && hasPublicVisibilityCandidate(current, element)) {
            nearestPublicCandidateContainer = current;
        }
        current = current.parentElement;
    }
    return nearestPublicCandidateContainer ?? element.parentElement;
};
const isVisibilityClickTarget = (element) => {
    const actionSignal = `${element.tagName.toLowerCase()} ${getElementAttribute(element, "role") ?? ""}`;
    const structuralSignal = visibilityStructuralSignal(element);
    return (isVisibleElement(element) &&
        !isDisabledElement(element) &&
        !nonSubmitPublishPattern.test(textContentOf(element)) &&
        (visibilityTriggerActionPattern.test(actionSignal) ||
            visibilityStructuralPattern.test(structuralSignal)));
};
const resolveVisibilityClickTarget = (element, boundary = null) => {
    const trustedPostUploadSelectTrigger = nearestTrustedPostUploadVisibilitySelectFallbackTrigger(element);
    if (trustedPostUploadSelectTrigger !== element) {
        return trustedPostUploadSelectTrigger;
    }
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
        if (isVisibilityClickTarget(current)) {
            return current;
        }
        if (current === boundary) {
            break;
        }
        current = current.parentElement;
    }
    return element;
};
const isShortPublicVisibilityValue = (element) => {
    const text = elementDisplayedTextSignal(element).replace(/\s+/gu, "");
    return (text.length > 0 &&
        text.length <= 12 &&
        hasPublicVisibilitySignal(text) &&
        !hasPrivateVisibilitySignal(text) &&
        !nonSubmitPublishPattern.test(text));
};
const isPublishSettingsLikeContainer = (element) => {
    const signal = `${elementTextSignal(element)} ${visibilityStructuralSignal(element)}`;
    return (/publish|发布|setting|form|field|row|item|option|select|dropdown|scope|range|permission|visibility|privacy|visible|audience|viewer/iu.test(signal) ||
        hasVisibilityTriggerSignal(signal));
};
const hasPlainPublicVisibilityTextContext = (element) => {
    let current = element.parentElement;
    const elementSignal = elementTextSignal(element);
    for (let depth = 0; current && depth < 5; depth += 1) {
        const currentText = textContentOf(current);
        if (currentText.length > 160) {
            current = current.parentElement;
            continue;
        }
        const text = `${currentText} ${elementSignal}`;
        const signal = `${elementTextSignal(current)} ${visibilityStructuralSignal(current)}`;
        if ((hasVisibilityTriggerSignal(signal) || isPublishSettingsLikeContainer(current)) &&
            hasPublicVisibilitySignal(text) &&
            !hasPrivateVisibilitySignal(text) &&
            !nonSubmitPublishPattern.test(text)) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
};
const resolvePlainPublicVisibilityClickTarget = (element) => {
    const actionSignal = `${element.tagName.toLowerCase()} ${getElementAttribute(element, "role") ?? ""}`;
    if (visibilityTriggerActionPattern.test(actionSignal) && typeof element.click === "function") {
        return element;
    }
    if (!hasPlainPublicVisibilityTextContext(element)) {
        return null;
    }
    let current = element;
    let nearestSettingsLike = null;
    for (let depth = 0; current && depth < 6; depth += 1) {
        if (current !== element && isPublishSettingsLikeContainer(current)) {
            nearestSettingsLike = current;
        }
        if (current !== element &&
            visibilityTriggerActionPattern.test(`${current.tagName.toLowerCase()} ${getElementAttribute(current, "role") ?? ""}`) &&
            isVisibilityClickTarget(current)) {
            return current;
        }
        if (isVisibilityClickTarget(current) && (current === element || isSelectLikeVisibilityActivationTarget(current))) {
            return current;
        }
        current = current.parentElement;
    }
    if (nearestSettingsLike &&
        textContentOf(nearestSettingsLike).length <= 80 &&
        isSelectLikeVisibilityActivationTarget(nearestSettingsLike)) {
        return nearestSettingsLike;
    }
    if (isVisibilityClickTarget(element)) {
        return element;
    }
    return typeof element.click === "function" ? element : null;
};
const uniqueVisibilityElements = (elements) => {
    const seen = new Set();
    return elements.filter((element) => {
        if (!element || seen.has(element)) {
            return false;
        }
        seen.add(element);
        return true;
    });
};
const visibilityDiagnosticSelector = [
    visibilityControlSelector,
    visibilityContextSelector,
    plainPublicVisibilityValueSelector,
    plainPublicVisibilityTextValueSelector,
    visibilitySettingsDisclosureSelector,
    '[class*="popper" i]',
    '[class*="popover" i]',
    '[class*="portal" i]',
    '[class*="dropdown" i]',
    '[class*="option" i]',
    '[class*="item" i]'
].join(",");
const visibilityDiagnosticScanLimit = 300;
const visibilityDiagnosticSampleLimit = 40;
const classTokensForElement = (element) => {
    const className = getElementAttribute(element, "class");
    if (!className) {
        return [];
    }
    return className.split(/\s+/u).filter((item) => item.trim().length > 0).slice(0, 8);
};
const visibilityDiagnosticAncestor = (element) => {
    const ancestors = [];
    let current = element.parentElement;
    for (let depth = 0; current && depth < 3; depth += 1) {
        ancestors.push({
            depth: depth + 1,
            tag_name: current.tagName.toLowerCase(),
            locator: locatorForElement(current),
            attribute_names: attributeNamesForElement(current),
            class_tokens: classTokensForElement(current)
        });
        current = current.parentElement;
    }
    return ancestors;
};
const visibilityDiagnosticCandidateScore = (element, sourceIndex) => {
    const fullSignal = elementTextSignal(element);
    const displayedSignal = elementDisplayedTextSignal(element);
    const structuralSignal = visibilityStructuralSignal(element);
    const locator = locatorForElement(element);
    let score = 0;
    if (hasPrivateVisibilitySignal(fullSignal)) {
        score += 120;
    }
    if (isVisibilityClickTarget(element)) {
        score += 90;
    }
    if (hasVisibilityTriggerSignal(fullSignal)) {
        score += 70;
    }
    if (visibilityStructuralPattern.test(structuralSignal)) {
        score += 55;
    }
    if (hasPublicVisibilitySignal(fullSignal) && displayedSignal.length <= 120) {
        score += 45;
    }
    if (visibilitySettingsDisclosurePattern.test(fullSignal) && displayedSignal.length <= 160) {
        score += 35;
    }
    if (/publish|editor|content|form|field|row|setting|scope|range|permission|visibility|privacy|select|dropdown|option|value|current/iu.test(`${locator} ${structuralSignal}`)) {
        score += 30;
    }
    if (displayedSignal.length > 240) {
        score -= 80;
    }
    else if (displayedSignal.length > 120) {
        score -= 35;
    }
    if (/^#(?:app|page|CreatorPlatform)$/u.test(locator)) {
        score -= 100;
    }
    return score * 10_000 - sourceIndex;
};
const collectVisibilityLocatorDiagnostics = () => {
    const timestamp = nowIso();
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return {
            schema_version: "fr-0032.visibility_locator_diagnostics.v1",
            values_recorded: false,
            recording_policy: "attribute_names_signal_flags_and_lengths_only",
            collected_at: timestamp,
            candidate_count: 0,
            candidates: []
        };
    }
    const matchedElements = document.querySelectorAll(visibilityDiagnosticSelector);
    const visibleCandidates = [];
    const seen = new Set();
    const scanCount = Math.min(matchedElements.length, visibilityDiagnosticScanLimit);
    for (let index = 0; index < scanCount; index += 1) {
        const element = matchedElements[index] ?? null;
        if (element instanceof HTMLElement &&
            !seen.has(element) &&
            isVisibleElement(element)) {
            seen.add(element);
            visibleCandidates.push({ element, sourceIndex: index });
        }
    }
    const candidates = visibleCandidates
        .map(({ element, sourceIndex }) => ({
        element,
        sourceIndex,
        score: visibilityDiagnosticCandidateScore(element, sourceIndex)
    }))
        .sort((left, right) => right.score - left.score)
        .slice(0, visibilityDiagnosticSampleLimit);
    return {
        schema_version: "fr-0032.visibility_locator_diagnostics.v1",
        values_recorded: false,
        recording_policy: "attribute_names_signal_flags_and_lengths_only",
        collected_at: timestamp,
        candidate_count: matchedElements.length,
        scanned_candidate_count: scanCount,
        scan_truncated: matchedElements.length > scanCount,
        scan_limit: visibilityDiagnosticScanLimit,
        sampled_candidate_count: candidates.length,
        candidates: candidates.map(({ element, sourceIndex }, index) => {
            const fullSignal = elementTextSignal(element);
            const displayedSignal = elementDisplayedTextSignal(element);
            const structuralSignal = visibilityStructuralSignal(element);
            return {
                index,
                source_index: sourceIndex,
                tag_name: element.tagName.toLowerCase(),
                locator: locatorForElement(element),
                attribute_names: attributeNamesForElement(element),
                class_tokens: classTokensForElement(element),
                role_present: getElementAttribute(element, "role") !== null,
                has_value_attribute: getElementAttribute(element, "value") !== null,
                has_placeholder_attribute: getElementAttribute(element, "placeholder") !== null,
                displayed_signal_length: displayedSignal.length,
                full_signal_length: fullSignal.length,
                public_visibility_signal: hasPublicVisibilitySignal(fullSignal),
                private_visibility_signal: hasPrivateVisibilitySignal(fullSignal),
                visibility_trigger_signal: hasVisibilityTriggerSignal(fullSignal),
                visibility_structural_signal: visibilityStructuralPattern.test(structuralSignal),
                settings_disclosure_signal: visibilitySettingsDisclosurePattern.test(fullSignal),
                disabled: isDisabledElement(element),
                click_target: isVisibilityClickTarget(element),
                ancestor_chain: visibilityDiagnosticAncestor(element)
            };
        })
    };
};
const isVisibilitySettingsDisclosureCandidate = (element) => {
    const signal = `${elementTextSignal(element)} ${visibilityStructuralSignal(element)}`;
    return (isVisibleElement(element) &&
        !isDisabledElement(element) &&
        visibilitySettingsDisclosurePattern.test(signal) &&
        !hasPrivateVisibilitySignal(signal) &&
        !hasPublicVisibilitySignal(signal));
};
const findVisibilitySettingsDisclosureTriggers = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return [];
    }
    return uniqueVisibilityElements(Array.from(document.querySelectorAll(visibilitySettingsDisclosureSelector)).map((element) => isVisibilitySettingsDisclosureCandidate(element) ? resolveVisibilityClickTarget(element) : null));
};
const openVisibilitySettingsDisclosure = async () => {
    const disclosures = findVisibilitySettingsDisclosureTriggers();
    for (const disclosure of disclosures) {
        if (typeof disclosure.click !== "function") {
            continue;
        }
        disclosure.click();
        await sleep(300);
        return true;
    }
    return false;
};
const findVisibilityTriggersFromExplicitContext = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return [];
    }
    const contexts = Array.from(document.querySelectorAll(visibilityContextSelector)).filter((element) => {
        const signal = elementTextSignal(element);
        return isVisibleElement(element) && hasVisibilityTriggerSignal(signal);
    });
    return uniqueVisibilityElements(contexts.flatMap((context) => {
        const container = visibilityContextContainer(context);
        if (!container || typeof container.querySelectorAll !== "function") {
            return [];
        }
        const candidates = Array.from(container.querySelectorAll(visibilityContextTriggerSelector));
        return candidates.map((element) => {
            const signal = elementTextSignal(element);
            const matches = element !== context &&
                isVisibleElement(element) &&
                !isDisabledElement(element) &&
                hasPublicVisibilitySignal(signal) &&
                !hasPrivateVisibilitySignal(signal) &&
                !nonSubmitPublishPattern.test(signal);
            return matches ? resolveVisibilityClickTarget(element, container) : null;
        });
    }));
};
const likelyPublishVisibilitySelectSelector = [
    '[class*="d-select" i]',
    '[class*="reds-select" i]',
    '[class*="select" i]',
    '[role="combobox"]',
    '[tabindex]'
].join(",");
const nonVisibilitySelectContextPattern = /address|location|poi|place|topic|tag|relation|file-relation|travel|poi-card|address-card|group-card|content[-_ ]?type|declaration/iu;
const hasNonVisibilitySelectContext = (element) => {
    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
        const signal = `${locatorForElement(current)} ${visibilityStructuralSignal(current)} ${elementDisplayedTextSignal(current)}`;
        if (nonVisibilitySelectContextPattern.test(signal)) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
};
const hasPublishSettingsAncestor = (element) => {
    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
        const signal = `${locatorForElement(current)} ${visibilityStructuralSignal(current)}`;
        if (nonVisibilitySelectContextPattern.test(signal)) {
            return false;
        }
        if (/publish-page-content-setting|publish-page-content-content-extra|publish-settings|post-settings|setting-content|setting-row/iu.test(signal)) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
};
const isTrustedPostUploadVisibilitySelectFallback = (element) => {
    if (typeof HTMLElement !== "function") {
        return false;
    }
    const structuralSignal = visibilityStructuralSignal(element);
    const displayedSignal = elementVisibleTextSignal(element).replace(/\s+/gu, "");
    return (isVisibleElement(element) &&
        !isDisabledElement(element) &&
        !hasNonVisibilitySelectContext(element) &&
        hasPublishSettingsAncestor(element) &&
        /custom-select-44|d-select-wrapper|\bd-select\b|d-select-main|d-select-content/iu.test(structuralSignal) &&
        displayedSignal.length > 0 &&
        displayedSignal.length <= 16 &&
        !hasPrivateVisibilitySignal(displayedSignal));
};
const nearestTrustedPostUploadVisibilitySelectFallbackTrigger = (element) => {
    let current = element;
    let nearestTrusted = isTrustedPostUploadVisibilitySelectFallback(element) ? element : null;
    for (let depth = 0; current && depth < 5; depth += 1) {
        const structuralSignal = visibilityStructuralSignal(current);
        if (isTrustedPostUploadVisibilitySelectFallback(current) &&
            /d-select-wrapper|custom-select-44|permission-card-select/iu.test(structuralSignal)) {
            return current;
        }
        if (!nearestTrusted && isTrustedPostUploadVisibilitySelectFallback(current)) {
            nearestTrusted = current;
        }
        current = current.parentElement;
    }
    return nearestTrusted ?? element;
};
const publishVisibilitySelectTriggerScore = (element, sourceIndex, structuralFallback = false) => {
    const structuralSignal = visibilityStructuralSignal(element);
    const textSignal = elementTextSignal(element);
    const displayedSignal = elementVisibleTextSignal(element).replace(/\s+/gu, "");
    let score = 0;
    if (/permission-card-select|d-select-wrapper|reds-select|custom-select/iu.test(structuralSignal)) {
        score += 120;
    }
    else if (/\bd-select\b|select|dropdown|combobox/iu.test(structuralSignal)) {
        score += 85;
    }
    if (/custom-select-44|d-select-wrapper/iu.test(structuralSignal) && hasPublishSettingsAncestor(element)) {
        score += 80;
    }
    if (hasPublicVisibilitySignal(textSignal) && !hasPrivateVisibilitySignal(textSignal)) {
        score += 70;
    }
    if (displayedSignal.length > 0 && displayedSignal.length <= 12) {
        score += 30;
    }
    if (hasVisibilityTriggerSignal(textSignal)) {
        score += 30;
    }
    if (/publish-page-content-setting|publish-settings|permission|visibility|privacy/iu.test(structuralSignal)) {
        score += 25;
    }
    if (structuralFallback) {
        score -= 45;
    }
    if (/address|location|poi|place|topic|tag|relation|file-relation|travel|content[-_ ]?type|declaration/iu.test(structuralSignal)) {
        score -= 120;
    }
    return score * 1_000 - sourceIndex;
};
const findLikelyPublishVisibilitySelectTriggers = (structuralFallback = false) => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return [];
    }
    const candidates = Array.from(document.querySelectorAll(likelyPublishVisibilitySelectSelector))
        .map((element, sourceIndex) => {
        if (!isVisibleElement(element) ||
            isDisabledElement(element) ||
            !hasPublishSettingsAncestor(element)) {
            return null;
        }
        const structuralSignal = visibilityStructuralSignal(element);
        if (!isSelectLikeVisibilityActivationTarget(element) && !/d-select|reds-select|select|dropdown/iu.test(structuralSignal)) {
            return null;
        }
        const textSignal = elementTextSignal(element);
        const semanticCandidate = hasPublicVisibilitySignal(textSignal) ||
            hasVisibilityTriggerSignal(textSignal) ||
            /permission-card-select/iu.test(structuralSignal);
        if (!semanticCandidate && (!structuralFallback || !isTrustedPostUploadVisibilitySelectFallback(element))) {
            return null;
        }
        const trigger = !hasPublicVisibilitySignal(textSignal) && isTrustedPostUploadVisibilitySelectFallback(element)
            ? nearestTrustedPostUploadVisibilitySelectFallbackTrigger(element)
            : resolveVisibilityClickTarget(element);
        return {
            element: trigger,
            score: publishVisibilitySelectTriggerScore(trigger, sourceIndex, !semanticCandidate)
        };
    })
        .filter((candidate) => candidate !== null)
        .sort((left, right) => right.score - left.score)
        .map(({ element }) => element);
    return uniqueVisibilityElements(candidates);
};
const findPostUploadStructuralVisibilitySelectFallbackTriggers = () => findLikelyPublishVisibilitySelectTriggers(true).filter(isTrustedPostUploadVisibilitySelectFallback);
const findVisibilityTriggers = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return [];
    }
    const explicitContextTriggers = findVisibilityTriggersFromExplicitContext();
    const directTriggers = Array.from(document.querySelectorAll(visibilityControlSelector))
        .map((element) => {
        const signal = elementTextSignal(element);
        return (isVisibleElement(element) &&
            !isDisabledElement(element) &&
            hasVisibilityTriggerSignal(signal) &&
            visibilityTriggerActionPattern.test(`${element.tagName.toLowerCase()} ${getElementAttribute(element, "role") ?? ""} ${visibilityStructuralSignal(element)}`) &&
            !nonSubmitPublishPattern.test(textContentOf(element)))
            ? element
            : null;
    });
    const publicDefaultTriggers = Array.from(document.querySelectorAll(visibilityControlSelector)).map((element) => {
        const textSignal = elementTextSignal(element);
        const structuralSignal = visibilityStructuralSignal(element);
        const publicDefaultWithVisibilityStructure = hasPublicVisibilitySignal(textSignal) && visibilityStructuralPattern.test(structuralSignal);
        return publicDefaultWithVisibilityStructure &&
            isVisibleElement(element) &&
            !isDisabledElement(element) &&
            !nonSubmitPublishPattern.test(textContentOf(element))
            ? resolveVisibilityClickTarget(element)
            : null;
    });
    return uniqueVisibilityElements([
        ...explicitContextTriggers,
        ...findLikelyPublishVisibilitySelectTriggers(),
        ...publicDefaultTriggers,
        ...directTriggers,
        ...findPlainPublicVisibilityValueFallbackTriggers(),
        ...findPostUploadStructuralVisibilitySelectFallbackTriggers()
    ]);
};
const findVisibilityTriggersForSelection = (options = {}) => {
    const triggers = findVisibilityTriggers();
    if (typeof options.maxTriggerActivations !== "number") {
        return triggers;
    }
    const likelyTriggers = findLikelyPublishVisibilitySelectTriggers();
    const structuralFallbackTriggers = findPostUploadStructuralVisibilitySelectFallbackTriggers();
    return uniqueVisibilityElements([
        ...structuralFallbackTriggers,
        ...triggers.slice(0, 1),
        ...likelyTriggers,
        ...triggers,
    ]);
};
const findPlainPublicVisibilityValueFallbackTriggers = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return [];
    }
    const interactiveTriggers = Array.from(document.querySelectorAll(plainPublicVisibilityValueSelector));
    const textTriggers = Array.from(document.querySelectorAll(plainPublicVisibilityTextValueSelector)).filter(hasPlainPublicVisibilityTextContext);
    return uniqueVisibilityElements([...interactiveTriggers, ...textTriggers].map((element) => {
        if (!isVisibleElement(element) || isDisabledElement(element) || !isShortPublicVisibilityValue(element)) {
            return null;
        }
        return resolvePlainPublicVisibilityClickTarget(element);
    }));
};
const visibilityActivationEventInit = (element, eventName) => {
    const rect = element.getBoundingClientRect();
    const clientX = Math.max(0, Math.floor(rect.left + rect.width / 2));
    const clientY = Math.max(0, Math.floor(rect.top + rect.height / 2));
    const isDownEvent = /down/iu.test(eventName);
    const isMoveOrOverEvent = /move|over/iu.test(eventName);
    return {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: typeof window !== "undefined" ? window : null,
        detail: eventName === "click" ? 1 : 0,
        button: 0,
        buttons: isDownEvent || isMoveOrOverEvent ? 1 : 0,
        clientX,
        clientY,
        screenX: clientX,
        screenY: clientY,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true
    };
};
const dispatchVisibilityActivationEvent = (element, eventName) => {
    if (typeof element.dispatchEvent !== "function") {
        return;
    }
    try {
        const EventCtor = eventName.startsWith("pointer") && typeof PointerEvent === "function"
            ? PointerEvent
            : typeof MouseEvent === "function"
                ? MouseEvent
                : Event;
        element.dispatchEvent(new EventCtor(eventName, visibilityActivationEventInit(element, eventName)));
    }
    catch {
        // Some test/runtime shims expose partial event constructors. The native click below remains the fallback.
    }
};
const dispatchVisibilityKeyboardActivationEvent = (element, eventName, key) => {
    if (typeof element.dispatchEvent !== "function") {
        return;
    }
    try {
        const event = typeof KeyboardEvent === "function"
            ? new KeyboardEvent(eventName, { bubbles: true, cancelable: true, key })
            : new Event(eventName, { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
    }
    catch {
        // Some test/runtime shims expose partial event constructors. Pointer events and click remain the fallback.
    }
};
const isSelectLikeVisibilityActivationTarget = (element) => {
    const signal = `${element.tagName.toLowerCase()} ${getElementAttribute(element, "role") ?? ""} ${visibilityStructuralSignal(element)}`;
    return /combobox|listbox|select|dropdown|permission-card|d-select|reds-select|el-select|semi-select|ant-select/iu.test(signal);
};
const isXhsDSelectActivationTarget = (element) => {
    const signal = visibilityStructuralSignal(element);
    return (!/permission-card/iu.test(signal) &&
        /(^|[\s_-])d-select($|[\s_-])|d-select-wrapper|d-select-main|d-select-content|d-select-placeholder/iu.test(signal));
};
const activateVisibilityTrigger = (trigger) => {
    const isXhsDSelectTarget = isXhsDSelectActivationTarget(trigger);
    const eventNames = isXhsDSelectTarget
        ? [
            "pointerover",
            "mouseover",
            "pointermove",
            "mousemove",
            "pointerdown",
            "mousedown",
            "pointerup",
            "mouseup"
        ]
        : ["pointerdown", "mousedown", "mouseup", "pointerup"];
    for (const eventName of eventNames) {
        dispatchVisibilityActivationEvent(trigger, eventName);
    }
    if (!isXhsDSelectTarget) {
        trigger.click();
    }
    if (!isSelectLikeVisibilityActivationTarget(trigger)) {
        return;
    }
    if (typeof trigger.focus === "function") {
        trigger.focus();
    }
    for (const key of ["Enter", " "]) {
        dispatchVisibilityKeyboardActivationEvent(trigger, "keydown", key);
        dispatchVisibilityKeyboardActivationEvent(trigger, "keyup", key);
    }
};
const nestedVisibilityActivationSelector = [
    '[role="button"]',
    '[role="combobox"]',
    '[class*="select" i]',
    '[class*="dropdown" i]',
    '[class*="permission" i]',
    '[class*="visibility" i]',
    '[class*="privacy" i]',
    '[class*="current" i]',
    '[class*="value" i]',
    '[class*="indicator" i]',
    '[class*="grid" i]',
    '[class*="d-select-prefix" i]',
    '[class*="d-select-main" i]',
    '[class*="d-select-content" i]',
    '[class*="d-select-placeholder" i]',
    '[class*="d-select-suffix" i]',
    '[class*="d-text" i]',
    '[tabindex]',
    "button",
    "label",
    "input",
    "svg",
    "use",
    "path",
    "i",
    "span"
].join(",");
const visibilityActivationTargetScore = (element, sourceIndex) => {
    const structuralSignal = visibilityStructuralSignal(element);
    const textSignal = elementTextSignal(element);
    let score = 0;
    if (/permission-card-select|d-select-wrapper|reds-select|select|dropdown/iu.test(structuralSignal)) {
        score += 90;
    }
    if (/d-select-suffix|indicator|icon|svg/iu.test(structuralSignal)) {
        score += 140;
    }
    if (hasPublicVisibilitySignal(textSignal) && !hasPrivateVisibilitySignal(textSignal)) {
        score += 40;
    }
    if (isVisibilityClickTarget(element)) {
        score += 25;
    }
    return score * 1_000 - sourceIndex;
};
const isNestedSelectLikeVisibilityActivationCandidate = (element, boundary) => {
    if (!isVisibleElement(element) || isDisabledElement(element)) {
        return false;
    }
    const structuralSignal = visibilityStructuralSignal(element);
    const textSignal = elementTextSignal(element);
    const boundaryAllowsStructuralFallback = isTrustedPostUploadVisibilitySelectFallback(boundary);
    const hasSelectLikeAncestor = (() => {
        let current = element;
        for (let depth = 0; current && depth < 5; depth += 1) {
            if (isSelectLikeVisibilityActivationTarget(current)) {
                return true;
            }
            if (current === boundary) {
                break;
            }
            current = current.parentElement;
        }
        return false;
    })();
    if (!visibilityStructuralPattern.test(structuralSignal) &&
        !/\b(?:d-)?grid\b/iu.test(structuralSignal) &&
        !(boundaryAllowsStructuralFallback && hasSelectLikeAncestor)) {
        return false;
    }
    if ((!hasPublicVisibilitySignal(textSignal) && !boundaryAllowsStructuralFallback) ||
        hasPrivateVisibilitySignal(textSignal) ||
        nonSubmitPublishPattern.test(textContentOf(element))) {
        return false;
    }
    return hasSelectLikeAncestor;
};
const isElementWithinVisibilityBoundary = (element, boundary) => {
    if (element === boundary) {
        return true;
    }
    if (typeof boundary.contains === "function") {
        try {
            return boundary.contains(element);
        }
        catch {
            // Fall through to the parentElement walk for partial DOM shims.
        }
    }
    let current = element.parentElement;
    for (let depth = 0; current && depth < 12; depth += 1) {
        if (current === boundary) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
};
const resolveCenterHitTestVisibilityActivationTarget = (trigger) => {
    if (typeof document === "undefined" ||
        typeof document.elementFromPoint !== "function" ||
        !isTrustedPostUploadVisibilitySelectFallback(trigger)) {
        return null;
    }
    const rect = trigger.getBoundingClientRect();
    const width = Number.isFinite(rect.width) ? rect.width : 0;
    const height = Number.isFinite(rect.height) ? rect.height : 0;
    if (width <= 0 || height <= 0) {
        return null;
    }
    const left = Number.isFinite(rect.left) ? rect.left : 0;
    const top = Number.isFinite(rect.top) ? rect.top : 0;
    const hitElement = document.elementFromPoint(left + width / 2, top + height / 2);
    if (!(hitElement instanceof HTMLElement)) {
        return null;
    }
    if (!isElementWithinVisibilityBoundary(hitElement, trigger)) {
        return null;
    }
    if (!isVisibleElement(hitElement) || isDisabledElement(hitElement)) {
        return null;
    }
    return hitElement;
};
const resolveNestedVisibilityActivationTargets = (trigger) => {
    if (typeof trigger.querySelectorAll !== "function") {
        return [trigger];
    }
    const triggerUsesStructuralFallback = /d-select-wrapper|custom-select-44|permission-card-select/iu.test(visibilityStructuralSignal(trigger)) ||
        (isTrustedPostUploadVisibilitySelectFallback(trigger) && !hasPublicVisibilitySignal(elementTextSignal(trigger)));
    const centerHitTestTarget = triggerUsesStructuralFallback
        ? resolveCenterHitTestVisibilityActivationTarget(trigger)
        : null;
    const nested = Array.from(trigger.querySelectorAll(nestedVisibilityActivationSelector))
        .filter((element) => element instanceof HTMLElement &&
        (isVisibilityClickTarget(element) || isNestedSelectLikeVisibilityActivationCandidate(element, trigger)))
        .map((element, sourceIndex) => ({
        element,
        score: visibilityActivationTargetScore(element, sourceIndex)
    }))
        .sort((left, right) => right.score - left.score)
        .map(({ element }) => element);
    return triggerUsesStructuralFallback
        ? uniqueVisibilityElements([centerHitTestTarget, trigger, ...nested])
        : uniqueVisibilityElements([...nested, trigger]);
};
const remainingSelectionTime = (deadline) => deadline === null ? Number.POSITIVE_INFINITY : Math.max(0, deadline - Date.now());
const waitForOpenedPrivateVisibilityOption = async (timeoutMs, deadline = null) => {
    const effectiveTimeoutMs = Math.min(timeoutMs, remainingSelectionTime(deadline));
    if (effectiveTimeoutMs <= 0) {
        return null;
    }
    const effectiveDeadline = Date.now() + effectiveTimeoutMs;
    do {
        const openedPrivateOption = findPrivateVisibilityOption(true);
        if (openedPrivateOption) {
            return openedPrivateOption;
        }
        if (Date.now() >= effectiveDeadline) {
            return null;
        }
        await sleep(150);
    } while (true);
};
const visibilityDebuggerClickDiagnostics = (target, response) => ({
    attempted: true,
    target_locator: locatorForElement(target),
    target_structural_signal: visibilityStructuralSignal(target).slice(0, 160),
    response_ok: response.ok,
    ...(response.error?.code ? { error_code: response.error.code } : {}),
    ...(response.error?.message ? { error_message: response.error.message.slice(0, 160) } : {})
});
const clickFirstOpenedPrivateVisibilityOption = async (triggers, options = {}, deadline = null) => {
    const openedOptionTimeoutMs = options.openedOptionTimeoutMs ?? 2_000;
    const boundedTriggers = typeof options.maxTriggerActivations === "number"
        ? triggers.slice(0, Math.max(0, options.maxTriggerActivations))
        : triggers;
    let openedDropdown = false;
    let lastDebuggerClick = null;
    for (const trigger of boundedTriggers) {
        const triggerUsesTrustedPostUploadFallback = isTrustedPostUploadVisibilitySelectFallback(trigger) ||
            /d-select-wrapper|custom-select-44/iu.test(visibilityStructuralSignal(trigger));
        if (remainingSelectionTime(deadline) <= 0) {
            return visibilitySelectionBlocked(openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED", openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated", openedDropdown, boundedTriggers.length);
        }
        for (const activationTarget of resolveNestedVisibilityActivationTargets(trigger)) {
            if (remainingSelectionTime(deadline) <= 0) {
                return visibilitySelectionBlocked(openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED", openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated", openedDropdown, boundedTriggers.length);
            }
            if (typeof activationTarget.click !== "function") {
                continue;
            }
            activateVisibilityTrigger(activationTarget);
            openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
            const activationTargetIsXhsDSelect = isXhsDSelectActivationTarget(activationTarget);
            const activationTargetTimeoutMs = activationTargetIsXhsDSelect
                ? triggerUsesTrustedPostUploadFallback
                    ? Math.min(openedOptionTimeoutMs, 600)
                    : Math.min(openedOptionTimeoutMs, 180)
                : openedOptionTimeoutMs;
            const openedPrivateOption = await waitForOpenedPrivateVisibilityOption(activationTargetTimeoutMs, deadline);
            openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
            if (!openedPrivateOption && !openedDropdown && (activationTargetIsXhsDSelect || triggerUsesTrustedPostUploadFallback)) {
                if (triggerUsesTrustedPostUploadFallback && options.runId) {
                    const debuggerTarget = isTrustedPostUploadVisibilitySelectFallback(trigger) ? trigger : activationTarget;
                    const debuggerClick = await requestVisibilityDebuggerClickViaExtension({
                        target: debuggerTarget,
                        runId: options.runId,
                        actionRef: "fr-0032/publish_visibility/d-select-trigger",
                        timeoutMs: Math.min(openedOptionTimeoutMs, 1_500)
                    });
                    lastDebuggerClick = visibilityDebuggerClickDiagnostics(debuggerTarget, debuggerClick);
                    if (debuggerClick.ok) {
                        openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
                        const debuggerOpenedPrivateOption = await waitForOpenedPrivateVisibilityOption(Math.min(openedOptionTimeoutMs, 1_200), deadline);
                        openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
                        if (debuggerOpenedPrivateOption && typeof debuggerOpenedPrivateOption.click === "function") {
                            const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(debuggerOpenedPrivateOption);
                            optionClickTarget.click();
                            await sleep(300);
                            const selectedSignal = elementTextSignal(debuggerOpenedPrivateOption);
                            if (hasPrivateVisibilitySignal(selectedSignal) &&
                                !hasPublicVisibilitySignal(selectedSignal) &&
                                (!openedDropdown || hasConfirmedPrivateVisibilitySelection(trigger))) {
                                return visibilitySelectionSuccess(optionClickTarget, openedDropdown, boundedTriggers.length, lastDebuggerClick);
                            }
                            return visibilitySelectionBlocked("PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED", "publish_visibility_option_selection_failed", openedDropdown, boundedTriggers.length, lastDebuggerClick);
                        }
                    }
                }
                activationTarget.click();
                openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
                const clickOpenedPrivateOption = await waitForOpenedPrivateVisibilityOption(triggerUsesTrustedPostUploadFallback
                    ? Math.min(openedOptionTimeoutMs, 600)
                    : Math.min(openedOptionTimeoutMs, 320), deadline);
                openedDropdown = findVisibleVisibilityDropdownPortal() !== null || openedDropdown;
                if (clickOpenedPrivateOption && typeof clickOpenedPrivateOption.click === "function") {
                    const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(clickOpenedPrivateOption);
                    optionClickTarget.click();
                    await sleep(300);
                    const selectedSignal = elementTextSignal(clickOpenedPrivateOption);
                    if (hasPrivateVisibilitySignal(selectedSignal) &&
                        !hasPublicVisibilitySignal(selectedSignal) &&
                        (!openedDropdown || hasConfirmedPrivateVisibilitySelection(trigger))) {
                        return visibilitySelectionSuccess(optionClickTarget, openedDropdown, boundedTriggers.length);
                    }
                    return visibilitySelectionBlocked("PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED", "publish_visibility_option_selection_failed", openedDropdown, boundedTriggers.length, lastDebuggerClick);
                }
            }
            if (openedPrivateOption && typeof openedPrivateOption.click === "function") {
                const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(openedPrivateOption);
                optionClickTarget.click();
                await sleep(300);
                const selectedSignal = elementTextSignal(openedPrivateOption);
                if (hasPrivateVisibilitySignal(selectedSignal) &&
                    !hasPublicVisibilitySignal(selectedSignal) &&
                    (!openedDropdown || hasConfirmedPrivateVisibilitySelection(trigger))) {
                    return visibilitySelectionSuccess(optionClickTarget, openedDropdown, boundedTriggers.length);
                }
                return visibilitySelectionBlocked("PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED", "publish_visibility_option_selection_failed", openedDropdown, boundedTriggers.length, lastDebuggerClick);
            }
        }
    }
    if (openedDropdown || hasMountedPrivateVisibilityOption()) {
        return visibilitySelectionBlocked("PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED", "publish_visibility_portal_option_not_selected", openedDropdown, boundedTriggers.length, lastDebuggerClick);
    }
    return visibilitySelectionBlocked("PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED", "publish_visibility_d_select_trigger_not_activated", false, boundedTriggers.length, lastDebuggerClick);
};
const selectPrivateVisibilityControl = async (options = {}) => {
    const deadline = typeof options.deadlineMs === "number" ? Date.now() + Math.max(0, options.deadlineMs) : null;
    const visiblePrivateOption = findPrivateVisibilityOption();
    if (visiblePrivateOption) {
        const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(visiblePrivateOption);
        optionClickTarget.click();
        await sleep(300);
        return visibilitySelectionSuccess(optionClickTarget, findVisibleVisibilityDropdownPortal() !== null, 0);
    }
    const triggers = findVisibilityTriggersForSelection(options);
    if (triggers.length > 0) {
        const openedOptionResult = await clickFirstOpenedPrivateVisibilityOption(triggers, options, deadline);
        if (openedOptionResult.selectedOption) {
            return openedOptionResult;
        }
        if (openedOptionResult.blockerCode === "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" ||
            openedOptionResult.blockerCode === "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED") {
            return openedOptionResult;
        }
    }
    if (remainingSelectionTime(deadline) <= 0) {
        return visibilitySelectionBlocked("PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED", "publish_visibility_d_select_trigger_not_activated", false, triggers.length);
    }
    if (await openVisibilitySettingsDisclosure()) {
        const privateOptionAfterDisclosure = findPrivateVisibilityOption();
        if (privateOptionAfterDisclosure) {
            const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(privateOptionAfterDisclosure);
            optionClickTarget.click();
            await sleep(300);
            const dropdownVisible = findVisibleVisibilityDropdownPortal() !== null;
            if (!dropdownVisible || hasConfirmedPrivateVisibilitySelection(nearestVisibilityConfirmationRoot(optionClickTarget))) {
                return visibilitySelectionSuccess(optionClickTarget, dropdownVisible, triggers.length);
            }
            return visibilitySelectionBlocked("PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED", "publish_visibility_option_selection_failed", dropdownVisible, triggers.length);
        }
        const triggersAfterDisclosure = findVisibilityTriggersForSelection(options);
        const openedOptionAfterDisclosureResult = await clickFirstOpenedPrivateVisibilityOption(triggersAfterDisclosure, options, deadline);
        if (openedOptionAfterDisclosureResult.selectedOption) {
            return openedOptionAfterDisclosureResult;
        }
        return openedOptionAfterDisclosureResult;
    }
    if (remainingSelectionTime(deadline) <= 0) {
        return visibilitySelectionBlocked("PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED", "publish_visibility_d_select_trigger_not_activated", false, triggers.length);
    }
    return selectPrivateVisibilityControlAfterBoundedScroll(options, deadline);
};
const scrollPublishEditorForLazyVisibilityControls = () => {
    const scrollTargets = resolvePublishEditorScrollTargets();
    if (scrollTargets.length === 0) {
        return false;
    }
    const viewportHeight = typeof window !== "undefined" &&
        typeof window.innerHeight === "number" && Number.isFinite(window.innerHeight)
        ? window.innerHeight
        : 800;
    const scrollDistance = Math.max(240, Math.floor(viewportHeight * 0.7));
    let scrolled = false;
    for (const scrollTarget of scrollTargets) {
        const before = scrollTarget.scrollTop;
        if (typeof scrollTarget.scrollBy === "function") {
            scrollTarget.scrollBy({ top: scrollDistance, left: 0, behavior: "instant" });
        }
        if (scrollTarget.scrollTop === before && canScrollPublishEditorElement(scrollTarget)) {
            scrollTarget.scrollTop = before + scrollDistance;
        }
        scrolled = scrollTarget.scrollTop !== before || scrolled;
    }
    if (typeof window !== "undefined" && typeof window.scrollBy === "function") {
        const beforeWindowScroll = typeof window.scrollY === "number" && Number.isFinite(window.scrollY)
            ? window.scrollY
            : null;
        window.scrollBy({ top: scrollDistance, left: 0, behavior: "instant" });
        const afterWindowScroll = typeof window.scrollY === "number" && Number.isFinite(window.scrollY)
            ? window.scrollY
            : null;
        scrolled = (beforeWindowScroll !== null && afterWindowScroll !== beforeWindowScroll) || scrolled;
    }
    return scrolled;
};
const resolvePublishEditorScrollTargets = () => {
    if (typeof document === "undefined" || typeof document.querySelector !== "function") {
        return [];
    }
    const href = typeof location !== "undefined" && typeof location.href === "string"
        ? location.href
        : typeof window !== "undefined" && typeof window.location?.href === "string"
            ? window.location.href
            : "";
    let pageUrl = null;
    try {
        pageUrl = new URL(href);
    }
    catch {
        pageUrl = null;
    }
    if (pageUrl?.hostname !== "creator.xiaohongshu.com" || !pageUrl.pathname.startsWith("/publish")) {
        return [];
    }
    const editorRoots = uniqueVisibilityElements(Array.from(document.querySelectorAll([
        ".publish-page-content",
        '[class*="publish-content" i]',
        ".publish-page",
        '[class*="publish-page" i]',
        ".style-override-container"
    ].join(","))).filter((element) => isVisibleElement(element))).sort((left, right) => publishEditorRootPriority(left) - publishEditorRootPriority(right));
    const scrollingElement = document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
    const documentElement = document.documentElement instanceof HTMLElement ? document.documentElement : null;
    const body = document.body instanceof HTMLElement ? document.body : null;
    const scrollableRoots = uniqueVisibilityElements(editorRoots.map((editorRoot) => findNearestScrollablePublishEditorContainer(editorRoot)));
    return uniqueVisibilityElements([
        ...(scrollableRoots.length > 0 ? scrollableRoots : [editorRoots[0] ?? null]),
        scrollingElement,
        documentElement,
        body
    ]);
};
const publishEditorRootPriority = (element) => {
    const classSignal = getElementAttribute(element, "class") ?? "";
    if (/publish-page-content|publish-content/iu.test(classSignal)) {
        return 0;
    }
    if (/publish-page/iu.test(classSignal)) {
        return 1;
    }
    if (/style-override-container/iu.test(classSignal)) {
        return 2;
    }
    return 3;
};
const canScrollPublishEditorElement = (element) => {
    const style = typeof getComputedStyle === "function" ? getComputedStyle(element) : null;
    const overflowY = style?.overflowY ?? "";
    const canScrollByGeometry = element.scrollHeight > element.clientHeight + 16;
    const canScrollByStyle = /auto|scroll|overlay/iu.test(overflowY);
    return canScrollByGeometry || canScrollByStyle;
};
const findNearestScrollablePublishEditorContainer = (element) => {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
        if (canScrollPublishEditorElement(current)) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
};
const selectPrivateVisibilityControlAfterBoundedScroll = async (options = {}, deadline = null) => {
    const maxAttempts = options.boundedScrollAttempts ?? 4;
    let openedDropdown = false;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (remainingSelectionTime(deadline) <= 0) {
            return visibilitySelectionBlocked(openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED", openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated", openedDropdown, 0);
        }
        if (!scrollPublishEditorForLazyVisibilityControls()) {
            return visibilitySelectionBlocked(openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED", openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated", openedDropdown, 0);
        }
        await sleep(250);
        const visiblePrivateOption = findPrivateVisibilityOption();
        if (visiblePrivateOption) {
            const optionClickTarget = resolvePrivateVisibilityOptionClickTarget(visiblePrivateOption);
            optionClickTarget.click();
            await sleep(300);
            const dropdownVisible = findVisibleVisibilityDropdownPortal() !== null;
            if (!dropdownVisible || hasConfirmedPrivateVisibilitySelection(nearestVisibilityConfirmationRoot(optionClickTarget))) {
                return visibilitySelectionSuccess(optionClickTarget, dropdownVisible, 0);
            }
            return visibilitySelectionBlocked("PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED", "publish_visibility_option_selection_failed", dropdownVisible, 0);
        }
        const triggers = findVisibilityTriggersForSelection(options);
        const openedOptionResult = await clickFirstOpenedPrivateVisibilityOption(triggers, options, deadline);
        openedDropdown = openedOptionResult.openedDropdown || openedDropdown;
        if (openedOptionResult.selectedOption) {
            return openedOptionResult;
        }
        if (openedOptionResult.blockerCode === "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" ||
            openedOptionResult.blockerCode === "PUBLISH_VISIBILITY_OPTION_SELECTION_FAILED") {
            return openedOptionResult;
        }
        if (remainingSelectionTime(deadline) <= 0) {
            return openedOptionResult;
        }
        if (await openVisibilitySettingsDisclosure()) {
            const triggersAfterDisclosure = findVisibilityTriggersForSelection(options);
            const openedOptionAfterDisclosureResult = await clickFirstOpenedPrivateVisibilityOption(triggersAfterDisclosure, options, deadline);
            openedDropdown = openedOptionAfterDisclosureResult.openedDropdown || openedDropdown;
            if (openedOptionAfterDisclosureResult.selectedOption) {
                return openedOptionAfterDisclosureResult;
            }
        }
    }
    return visibilitySelectionBlocked(openedDropdown ? "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED" : "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED", openedDropdown ? "publish_visibility_portal_option_not_selected" : "publish_visibility_d_select_trigger_not_activated", openedDropdown, 0);
};
const currentHref = () => typeof window !== "undefined" && window.location?.href
    ? window.location.href
    : typeof location !== "undefined" && location.href
        ? location.href
        : null;
const noteIdFromHref = (href) => {
    const match = /[?&](?:note_id|noteId|source_note_id)=([A-Za-z0-9_-]{8,64})(?:&|$)/u.exec(href) ??
        /\/(?:explore|notes?|note|publish\/success)\/([A-Za-z0-9_-]{8,64})(?:[/?#]|$)/u.exec(href);
    return match?.[1] ?? null;
};
const publishResultNoteIdAttributeNames = [
    "data-note-id",
    "data-noteid",
    "data-note-oid",
    "data-source-note-id"
];
const normalizePublishResultIdentityValue = (value) => {
    const normalized = value?.trim() ?? "";
    if (normalized.length < 6 ||
        normalized.length > 128 ||
        normalized.startsWith("blob:") ||
        normalized.startsWith("data:") ||
        /^https?:\/\//iu.test(normalized) ||
        !/^[A-Za-z0-9_-]+$/u.test(normalized)) {
        return null;
    }
    return normalized;
};
const publishResultIdentityCandidateSelector = [
    'a[href*="/explore/"]',
    'a[href*="/note/"]',
    'a[href*="note_id="]',
    ...publishResultNoteIdAttributeNames.map((name) => `[${name}]`)
].join(",");
const publishSuccessContainerSelector = [
    "[role='dialog']",
    "[role='alert']",
    "[role='status']",
    "[class*='success' i]",
    "[class*='result' i]",
    "[class*='publish' i]",
    "[class*='note' i]",
    "section",
    "article",
    "div"
].join(",");
const readPublishIdentityCandidateFromElement = (element) => {
    if (!(element instanceof HTMLElement) || !isVisibleElement(element)) {
        return null;
    }
    const href = getElementAttribute(element, "href");
    const hrefNoteId = href ? noteIdFromHref(href) : null;
    if (hrefNoteId) {
        return {
            noteId: hrefNoteId,
            platformRecordRef: null,
            locator: locatorForElement(element)
        };
    }
    for (const name of publishResultNoteIdAttributeNames) {
        const noteId = normalizePublishResultIdentityValue(getElementAttribute(element, name));
        if (noteId) {
            return {
                noteId,
                platformRecordRef: null,
                locator: `${locatorForElement(element)}[${name}]`
            };
        }
    }
    return null;
};
const publishIdentityCandidateElementsIn = (container) => {
    const elements = [container];
    if (typeof container.querySelectorAll === "function") {
        elements.push(...Array.from(container.querySelectorAll(publishResultIdentityCandidateSelector)));
    }
    return elements;
};
const pagePublishIdentityCandidateKey = (candidate) => candidate.noteId ? `note:${candidate.noteId}` : `record:${candidate.platformRecordRef ?? ""}`;
const collectPagePublishIdentityCandidates = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return [];
    }
    const successContainers = Array.from(document.querySelectorAll(publishSuccessContainerSelector))
        .filter((element) => element instanceof HTMLElement && isVisibleElement(element))
        .filter((element) => publishSuccessPattern.test(elementDisplayedTextSignal(element)))
        .filter((element) => textContentOf(element).length <= 240);
    const candidates = [];
    for (const container of successContainers) {
        for (const element of publishIdentityCandidateElementsIn(container)) {
            const candidate = readPublishIdentityCandidateFromElement(element);
            if (candidate) {
                candidates.push({
                    ...candidate,
                    key: pagePublishIdentityCandidateKey(candidate)
                });
            }
        }
    }
    return candidates;
};
const findPagePublishIdentityCandidate = (previousCandidateKeys) => {
    return collectPagePublishIdentityCandidates().find((candidate) => !previousCandidateKeys.has(candidate.key)) ?? null;
};
const publishActionPendingPattern = /发布中|正在发布|提交中|审核中|publishing|submitting|loading/iu;
const xhsBackgroundContinuationPageIdentityWaitMs = 30_000;
const readPublishActionActivation = (submitControl, initialHref, initialDocumentText, previousPageIdentityKeys) => {
    const href = currentHref();
    if (href && href !== initialHref) {
        return {
            activated: true,
            signal: "url_changed",
            href,
            controlDisabled: false,
            controlBusy: false
        };
    }
    if (findPagePublishIdentityCandidate(previousPageIdentityKeys)) {
        return {
            activated: true,
            signal: "page_publish_identity_candidate",
            href,
            controlDisabled: false,
            controlBusy: false
        };
    }
    const documentText = typeof document !== "undefined" && document.documentElement
        ? textContentOf(document.documentElement)
        : "";
    const documentTextChanged = documentText !== initialDocumentText;
    if (documentTextChanged && publishSuccessPattern.test(documentText)) {
        return {
            activated: true,
            signal: "publish_success_text",
            href,
            controlDisabled: false,
            controlBusy: false
        };
    }
    if (documentTextChanged && publishActionPendingPattern.test(documentText)) {
        return {
            activated: true,
            signal: "publish_pending_text",
            href,
            controlDisabled: false,
            controlBusy: false
        };
    }
    const controlDisabled = (typeof submitControl.hasAttribute === "function" && submitControl.hasAttribute("disabled")) ||
        submitControl.getAttribute("aria-disabled") === "true" ||
        submitControl.disabled === true;
    const controlClassName = typeof submitControl.className === "string" ? submitControl.className : "";
    const controlBusy = submitControl.getAttribute("aria-busy") === "true" ||
        /loading|disabled|pending|submitting|publishing/iu.test(controlClassName);
    return {
        activated: controlDisabled || controlBusy,
        signal: controlDisabled ? "submit_control_disabled" : controlBusy ? "submit_control_busy" : null,
        href,
        controlDisabled,
        controlBusy
    };
};
const waitForPublishActionActivation = async (submitControl, initialHref, initialDocumentText, previousPageIdentityKeys, timeoutMs) => {
    const deadline = Date.now() + Math.max(1, timeoutMs);
    let latest = readPublishActionActivation(submitControl, initialHref, initialDocumentText, previousPageIdentityKeys);
    while (!latest.activated && Date.now() < deadline) {
        await sleep(250);
        latest = readPublishActionActivation(submitControl, initialHref, initialDocumentText, previousPageIdentityKeys);
    }
    return latest;
};
const buildPublishIdentity = (input, artifact, submitEvidence, initialHref, successLocator, previousPageIdentityKeys) => {
    const href = currentHref();
    if (!href) {
        return null;
    }
    const noteId = noteIdFromHref(href);
    const successText = typeof document !== "undefined" &&
        document.documentElement !== null &&
        publishSuccessPattern.test(textContentOf(document.documentElement));
    const creatorResultUrl = href !== initialHref && /^https:\/\/creator\.xiaohongshu\.com\//iu.test(href) ? href : null;
    const pageIdentity = findPagePublishIdentityCandidate(previousPageIdentityKeys);
    const pageSuccessText = successText || pageIdentity !== null;
    const resultNoteId = noteId ?? pageIdentity?.noteId ?? null;
    const platformRecordRef = pageIdentity?.platformRecordRef ?? null;
    if (!resultNoteId && !creatorResultUrl && !platformRecordRef) {
        return null;
    }
    const timestamp = nowIso();
    const resultKind = resultNoteId
        ? "note_id"
        : creatorResultUrl
            ? "creator_result_page"
            : "platform_publish_record";
    return {
        schema_version: "fr-0032.publish_result_identity.v1",
        publish_result_id: `publish-result/fr-0032/${input.live_write_attempt_id}`,
        live_write_attempt_id: input.live_write_attempt_id,
        run_id: input.run_id,
        profile_ref: input.profile_ref ?? "unknown",
        target_tab_id: input.target_tab_id ?? 0,
        target_domain: "creator.xiaohongshu.com",
        target_page: "creator_publish_tab",
        source_upload_artifact_id: artifact.upload_artifact_id,
        submit_action_ref: submitEvidence.submit_action_ref,
        result_kind: resultKind,
        note_id: resultNoteId,
        published_url: resultNoteId ? `https://www.xiaohongshu.com/explore/${resultNoteId}` : null,
        creator_result_url: creatorResultUrl,
        platform_record_ref: platformRecordRef,
        publish_visibility_scope: input.publish_visibility_scope,
        success_signal: {
            signal_source: creatorResultUrl ? "creator_result_page" : "current_page_state",
            signal_locator: creatorResultUrl ?? pageIdentity?.locator ?? successLocator,
            platform_message: pageSuccessText ? "publish success text observed" : null,
            observed_at: timestamp
        },
        captured_at: timestamp,
        verification_state: "verified"
    };
};
const performControlledSubmitPublishCleanup = async (input, artifact) => {
    const timestamp = nowIso();
    const acceptedUploadResume = input.accepted_upload_artifact_identity?.accepted_by_platform === true;
    const continuationVisibilitySelectionOptions = input.background_upload_capture_continuation === true || acceptedUploadResume
        ? {
            runId: input.run_id,
            deadlineMs: 12_000,
            maxTriggerActivations: 4,
            openedOptionTimeoutMs: 1_200,
            boundedScrollAttempts: 2
        }
        : {};
    if (input.publish_visibility_scope !== "private_or_self_visible") {
        return buildStepBlockedResult(input, artifact, {
            blockerCode: "PUBLISH_VISIBILITY_NOT_SELECTED",
            blockerMessage: "Controlled publish only supports private_or_self_visible visibility for FR-0032.",
            detailsRef: "publish_visibility_scope_not_private",
            requiredRecoveryAction: "rerun with publish_visibility_scope=private_or_self_visible",
            stoppedStep: "publish",
            blockerLayer: "publish",
            riskKind: "submit_failure",
            cleanupRequired: true
        }, null, uploadStageCleanupResult(input, timestamp, "non-private visibility refused before submit"));
    }
    let visibilitySelection = await selectPrivateVisibilityControl(continuationVisibilitySelectionOptions);
    if (!visibilitySelection.selectedOption && await continueFromAcceptedUploadStageIfNeeded()) {
        visibilitySelection = await selectPrivateVisibilityControl(continuationVisibilitySelectionOptions);
    }
    if (!visibilitySelection.selectedOption) {
        const diagnostics = {
            ...collectVisibilityLocatorDiagnostics(),
            selection_result: {
                blocker_code: visibilitySelection.blockerCode ?? "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED",
                details_ref: visibilitySelection.detailsRef ?? "publish_visibility_d_select_trigger_not_activated",
                opened_dropdown: visibilitySelection.openedDropdown,
                trigger_count: visibilitySelection.triggerCount,
                option_locator: visibilitySelection.optionLocator,
                debugger_click: visibilitySelection.debuggerClick,
                observed_symptom: "PUBLISH_VISIBILITY_CONTROL_MISSING"
            }
        };
        const blockerCode = visibilitySelection.blockerCode ?? "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED";
        const detailsRef = visibilitySelection.detailsRef ?? "publish_visibility_d_select_trigger_not_activated";
        return buildStepBlockedResult(input, artifact, {
            blockerCode,
            blockerMessage: blockerCode === "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED"
                ? "Controlled publish did not activate the post-upload visibility d-select trigger."
                : blockerCode === "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED"
                    ? "Controlled publish opened the visibility dropdown but did not select the private/self-visible option."
                    : "Controlled publish found a private/self-visible option but could not confirm selection.",
            detailsRef,
            requiredRecoveryAction: blockerCode === "PUBLISH_VISIBILITY_D_SELECT_TRIGGER_NOT_ACTIVATED"
                ? "update the XHS post-upload d-select trigger locator/activation before retrying publish visibility"
                : blockerCode === "PUBLISH_VISIBILITY_PORTAL_OPTION_NOT_SELECTED"
                    ? "update the XHS private/self-visible option locator/click target before retrying publish visibility"
                    : "update the XHS visibility option selected-state verification before retrying publish visibility",
            stoppedStep: "publish",
            blockerLayer: "publish",
            riskKind: "submit_failure",
            cleanupRequired: true,
            diagnostics
        }, null, uploadStageCleanupResult(input, timestamp, "private visibility not selected before submit"));
    }
    const selectedVisibilityOption = visibilitySelection.selectedOption;
    const submitControl = findSubmitPublishControl();
    if (!submitControl || typeof submitControl.click !== "function") {
        return buildStepBlockedResult(input, artifact, {
            blockerCode: "SUBMIT_CONTROL_MISSING",
            blockerMessage: "Controlled live write cannot find a safe submit/publish control after upload.",
            detailsRef: "submit_control_missing",
            requiredRecoveryAction: "update the XHS creator submit/publish locator before retrying",
            stoppedStep: "submit",
            blockerLayer: "submit",
            riskKind: "submit_failure",
            cleanupRequired: true
        }, null, uploadStageCleanupResult(input, nowIso(), "submit control missing before publish"));
    }
    const initialHref = currentHref() ?? input.page_url;
    const previousPageIdentityKeys = new Set(collectPagePublishIdentityCandidates().map((candidate) => candidate.key));
    const submittedAt = nowIso();
    const initialDocumentText = typeof document !== "undefined" && document.documentElement
        ? textContentOf(document.documentElement)
        : "";
    const requiresPublishDebuggerClick = input.background_upload_capture_continuation === true && input.profile_ref === "xhs_001";
    let publishDebuggerClick = null;
    let publishActionActivation = null;
    if (requiresPublishDebuggerClick) {
        const debuggerClick = await requestPublishDebuggerClickViaExtension({
            target: submitControl,
            runId: input.run_id,
            actionRef: `fr-0032/${input.live_write_attempt_id}/publish-submit`,
            timeoutMs: xhsControlledPublishDebuggerClickTimeoutMs
        });
        publishDebuggerClick = {
            ok: debuggerClick.ok,
            ...(debuggerClick.result ? { result: debuggerClick.result } : {}),
            ...(debuggerClick.error ? { error: debuggerClick.error } : {})
        };
        if (!debuggerClick.ok) {
            const unknownSubmitEvidence = {
                submit_action_ref: `submit/fr-0032/${input.live_write_attempt_id}`,
                submit_locator: locatorForElement(submitControl),
                submitted_at: submittedAt,
                submit_result_state: "unknown",
                platform_message: "publish debugger click failed before submit"
            };
            return buildStepBlockedResult(input, artifact, {
                blockerCode: "PUBLISH_ACTION_ENDPOINT_NOT_OBSERVED",
                blockerMessage: "Controlled publish could not dispatch the final publish control through the debugger click path.",
                detailsRef: "publish_debugger_click_failed",
                requiredRecoveryAction: "repair the XHS final publish debugger click path before retrying publish identity capture",
                stoppedStep: "publish",
                blockerLayer: "publish",
                riskKind: "submit_failure",
                cleanupRequired: true,
                diagnostics: {
                    publish_debugger_click: publishDebuggerClick,
                    submit_locator: unknownSubmitEvidence.submit_locator
                }
            }, unknownSubmitEvidence, uploadStageCleanupResult(input, nowIso(), "publish debugger click failed; unpublished upload abandoned"));
        }
    }
    else {
        submitControl.click();
    }
    const submitEvidence = {
        submit_action_ref: `submit/fr-0032/${input.live_write_attempt_id}`,
        submit_locator: locatorForElement(submitControl),
        submitted_at: submittedAt,
        submit_result_state: "accepted",
        platform_message: null
    };
    const isExtensionBrowserSurface = typeof window !== "undefined" && "chrome" in globalThis;
    if (input.background_upload_capture_continuation === true && input.profile_ref === "xhs_001") {
        const activation = await waitForPublishActionActivation(submitControl, initialHref, initialDocumentText, previousPageIdentityKeys, 3_000);
        publishActionActivation = activation;
        if (!activation.activated) {
            const unknownSubmitEvidence = {
                ...submitEvidence,
                submit_result_state: "unknown",
                platform_message: "publish action click did not produce a local activation signal"
            };
            return buildStepBlockedResult(input, artifact, {
                blockerCode: "PUBLISH_ACTION_ENDPOINT_NOT_OBSERVED",
                blockerMessage: "Controlled publish clicked the publish control, but no publish activation signal or endpoint was observed.",
                detailsRef: "publish_action_endpoint_not_observed",
                requiredRecoveryAction: "verify the final publish button locator/click activation and require a publish endpoint, URL transition, or pending/success signal before publish identity capture",
                stoppedStep: "publish",
                blockerLayer: "publish",
                riskKind: "submit_failure",
                cleanupRequired: true,
                diagnostics: {
                    publish_action_activation: activation,
                    ...(publishDebuggerClick ? { publish_debugger_click: publishDebuggerClick } : {}),
                    initial_href: initialHref,
                    submit_locator: submitEvidence.submit_locator
                }
            }, unknownSubmitEvidence, uploadStageCleanupResult(input, nowIso(), "publish action not activated; unpublished upload abandoned"));
        }
    }
    let publishIdentity = null;
    if (input.background_upload_capture_continuation === true && input.profile_ref === "xhs_001") {
        const pageLevelActivation = publishActionActivation?.signal !== "submit_control_busy" &&
            publishActionActivation?.signal !== "submit_control_disabled";
        const deadline = Date.now() + (pageLevelActivation ? xhsBackgroundContinuationPageIdentityWaitMs : 3_000);
        do {
            publishIdentity = buildPublishIdentity(input, artifact, submitEvidence, initialHref, locatorForElement(selectedVisibilityOption), previousPageIdentityKeys);
            if (publishIdentity || Date.now() >= deadline) {
                break;
            }
            await sleep(500);
        } while (true);
    }
    if (input.background_upload_capture_continuation === true || (acceptedUploadResume && isExtensionBrowserSurface)) {
        const backgroundCapturePending = input.background_upload_capture_continuation === true;
        if (!publishIdentity) {
            const residual = {
                residual_record_id: `residual/fr-0032/${input.live_write_attempt_id}/${backgroundCapturePending ? "background-identity-pending" : "resume-identity-pending"}`,
                live_write_attempt_id: input.live_write_attempt_id,
                publish_result_id: null,
                visibility_scope: input.publish_visibility_scope,
                external_visibility_may_remain: false,
                residual_locator: null,
                reason: "identity_missing_after_publish",
                required_followup: backgroundCapturePending
                    ? "merge background publish identity capture before final closeout"
                    : "capture publish result identity after accepted-upload resume before final closeout",
                recorded_at: nowIso()
            };
            const cleanup = {
                schema_version: "fr-0032.cleanup_rollback_proof.v1",
                cleanup_result_id: `cleanup/fr-0032/${input.live_write_attempt_id}/${backgroundCapturePending ? "identity-pending" : "resume-identity-pending"}`,
                live_write_attempt_id: input.live_write_attempt_id,
                run_id: input.run_id,
                profile_ref: input.profile_ref ?? "unknown",
                target_tab_id: input.target_tab_id ?? 0,
                publish_result_identity: null,
                cleanup_policy_ref: input.cleanup_policy_ref,
                cleanup_action: "no_safe_cleanup_action",
                cleanup_outcome: "cleanup_blocked",
                proof_locator: locatorForElement(selectedVisibilityOption),
                platform_message: backgroundCapturePending
                    ? "submit accepted; background publish identity capture remains authoritative"
                    : "submit accepted; accepted-upload resume returned before page navigation could exceed the native bridge deadline",
                attempted_at: submittedAt,
                completed_at: null,
                residual_record: residual
            };
            return buildStepBlockedResult(input, artifact, {
                blockerCode: "PUBLISH_RESULT_IDENTITY_MISSING",
                blockerMessage: backgroundCapturePending
                    ? "Controlled publish submit was accepted; background identity capture is pending."
                    : "Controlled publish submit was accepted; publish result identity must be captured after accepted-upload resume.",
                detailsRef: backgroundCapturePending
                    ? "background_publish_identity_capture_pending"
                    : "accepted_upload_resume_publish_identity_pending",
                requiredRecoveryAction: backgroundCapturePending
                    ? "merge background publish identity capture before final closeout"
                    : "capture publish result identity after accepted-upload resume before final closeout",
                stoppedStep: "publish_identity",
                blockerLayer: "published_identity",
                riskKind: "publish_identity_missing",
                cleanupRequired: true
            }, submitEvidence, cleanup, residual);
        }
    }
    const deadline = Date.now() + (isExtensionBrowserSurface ? 15_000 : 50);
    if (!publishIdentity) {
        do {
            publishIdentity = buildPublishIdentity(input, artifact, submitEvidence, initialHref, locatorForElement(selectedVisibilityOption), previousPageIdentityKeys);
            if (publishIdentity || Date.now() >= deadline) {
                break;
            }
            await sleep(isExtensionBrowserSurface ? 500 : 10);
        } while (true);
    }
    if (!publishIdentity) {
        const residual = {
            residual_record_id: `residual/fr-0032/${input.live_write_attempt_id}/identity-missing`,
            live_write_attempt_id: input.live_write_attempt_id,
            publish_result_id: null,
            visibility_scope: input.publish_visibility_scope,
            external_visibility_may_remain: false,
            residual_locator: null,
            reason: "identity_missing_after_publish",
            required_followup: "capture note_id, creator result URL, or platform record before retrying closeout",
            recorded_at: nowIso()
        };
        const cleanup = {
            schema_version: "fr-0032.cleanup_rollback_proof.v1",
            cleanup_result_id: `cleanup/fr-0032/${input.live_write_attempt_id}/identity-missing`,
            live_write_attempt_id: input.live_write_attempt_id,
            run_id: input.run_id,
            profile_ref: input.profile_ref ?? "unknown",
            target_tab_id: input.target_tab_id ?? 0,
            publish_result_identity: null,
            cleanup_policy_ref: input.cleanup_policy_ref,
            cleanup_action: "no_safe_cleanup_action",
            cleanup_outcome: "cleanup_blocked",
            proof_locator: null,
            platform_message: "publish result identity missing after submit",
            attempted_at: nowIso(),
            completed_at: null,
            residual_record: residual
        };
        return buildStepBlockedResult(input, artifact, {
            blockerCode: "PUBLISH_RESULT_IDENTITY_MISSING",
            blockerMessage: "Controlled publish did not produce a verifiable publish result identity.",
            detailsRef: "publish_result_identity_missing",
            requiredRecoveryAction: "capture note_id, published URL, creator result URL, or platform record before closeout",
            stoppedStep: "publish_identity",
            blockerLayer: "published_identity",
            riskKind: "publish_identity_missing",
            cleanupRequired: true
        }, submitEvidence, cleanup, residual);
    }
    const closedAt = nowIso();
    const cleanup = {
        schema_version: "fr-0032.cleanup_rollback_proof.v1",
        cleanup_result_id: `cleanup/fr-0032/${input.live_write_attempt_id}/private-visibility`,
        live_write_attempt_id: input.live_write_attempt_id,
        run_id: input.run_id,
        profile_ref: input.profile_ref ?? "unknown",
        target_tab_id: input.target_tab_id ?? 0,
        publish_result_identity: publishIdentity,
        cleanup_policy_ref: input.cleanup_policy_ref,
        cleanup_action: "hide_published_result",
        cleanup_outcome: "hidden",
        proof_locator: locatorForElement(selectedVisibilityOption),
        platform_message: "publish_visibility_scope=private_or_self_visible selected before publish",
        attempted_at: closedAt,
        completed_at: closedAt,
        residual_record: null
    };
    return {
        live_write_action: "controlled_upload_submit_publish",
        target_page: "creator_publish_tab",
        live_write_evidence: {
            schema_version: "fr-0032.live_write_evidence.v1",
            live_write_attempt_id: input.live_write_attempt_id,
            canonical_issue_ref: "#835",
            execution_phase: "closed",
            scope: {
                platform: "xhs",
                target_domain: "creator.xiaohongshu.com",
                target_page: "creator_publish_tab",
                browser_channel: "Google Chrome stable",
                execution_surface: "real_browser",
                requested_execution_mode: "live_write",
                profile_ref: input.profile_ref ?? "unknown",
                target_tab_id: input.target_tab_id ?? 0,
                probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
                run_id: input.run_id,
                artifact_identity: artifact.upload_artifact_id
            },
            entry_gate: null,
            stop_classification: null,
            upload_artifact_identity: artifact,
            submit_evidence: submitEvidence,
            publish_result_identity: publishIdentity,
            cleanup_result: cleanup,
            risk_signals: [],
            stop_signal: null,
            residual_record: null,
            created_at: timestamp,
            updated_at: closedAt
        },
        live_write_evaluation: {
            schema_version: "fr-0032.live_write_evaluation.v1",
            decision: "GO",
            full_live_write_success: true,
            upload_success: true,
            submit_success: true,
            publish_success: true,
            cleanup_success: true,
            later_write_actions_blocked: false,
            cleanup_required: false,
            blockers: []
        },
        uploaded: true,
        submitted: true,
        published: true,
        cleanup_attempted: true,
        out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
    };
};
const performXhsControlledLiveWriteWithApprovedSourceMedia = async (input) => {
    if (input.accepted_upload_artifact_identity?.accepted_by_platform === true) {
        const resumeBlocker = validateAcceptedUploadArtifactResume(input, input.accepted_upload_artifact_identity);
        if (resumeBlocker) {
            return buildXhsControlledLiveWriteUploadBlockedResult(input, resumeBlocker, input.accepted_upload_artifact_identity);
        }
        return await performControlledSubmitPublishCleanup(input, input.accepted_upload_artifact_identity);
    }
    const resolvedFile = await resolveApprovedFixtureMediaFile(input);
    if (!isBrowserFile(resolvedFile)) {
        return buildXhsControlledLiveWriteUploadBlockedResult(input, resolvedFile);
    }
    if (input.source_media_kind === "image") {
        await selectImagePublishMode();
    }
    const previousPreviewSignatures = collectEditorPreviewSignatures();
    const fileInputs = collectUploadFileInputs();
    const fileInput = findUploadFileInput(fileInputs);
    const dropzone = findUploadDropzone();
    if (input.source_media_kind === "image" &&
        !fileInput &&
        !dropzone &&
        fileInputs.some((candidate) => !candidate.disabled)) {
        return buildXhsControlledLiveWriteUploadBlockedResult(input, {
            blockerCode: "IMAGE_UPLOAD_ENTRY_MISSING",
            blockerMessage: "Controlled live upload found file inputs, but none accept the approved image fixture after selecting image publish mode.",
            detailsRef: "image_upload_entry_missing",
            requiredRecoveryAction: "open the creator image publish target or update the XHS image mode selector before controlled upload"
        });
    }
    if (!fileInput && !dropzone) {
        return buildXhsControlledLiveWriteUploadBlockedResult(input, {
            blockerCode: "UPLOAD_ENTRY_MISSING",
            blockerMessage: "Controlled live upload cannot find an enabled file input or visible dropzone on the creator publish page.",
            detailsRef: "upload_entry_missing",
            requiredRecoveryAction: "restore the creator publish target page or update the XHS upload entry locator"
        });
    }
    let assignmentFailure = null;
    let previewEvidence = null;
    if (fileInput) {
        assignmentFailure = dispatchFileInputUpload(fileInput, resolvedFile);
        if (assignmentFailure) {
            return buildXhsControlledLiveWriteUploadBlockedResult(input, assignmentFailure);
        }
        previewEvidence = await waitForEditorPreviewEvidence(previousPreviewSignatures, uploadPreviewWaitOptions("file_input"));
    }
    if (!previewEvidence && dropzone) {
        assignmentFailure = dispatchDropzoneUpload(dropzone, resolvedFile);
        if (assignmentFailure && !fileInput) {
            return buildXhsControlledLiveWriteUploadBlockedResult(input, assignmentFailure);
        }
        previewEvidence = await waitForEditorPreviewEvidence(previousPreviewSignatures, uploadPreviewWaitOptions("dropzone"));
    }
    if (!previewEvidence) {
        return buildXhsControlledLiveWriteUploadBlockedResult(input, {
            blockerCode: "UPLOAD_PREVIEW_NOT_VISIBLE",
            blockerMessage: "Controlled live upload injected the approved media file, but the editor preview did not become visible.",
            detailsRef: "upload_preview_not_visible",
            requiredRecoveryAction: "verify the current XHS creator upload UI accepts controlled file input assignment before submit"
        });
    }
    const timestamp = nowIso();
    const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
    const uploadArtifact = {
        upload_artifact_id: uploadArtifactId,
        source_media_ref: input.source_media_ref,
        source_media_digest: input.source_media_digest,
        source_media_kind: input.source_media_kind,
        platform_staging_ref: previewEvidence.platformStagingRef,
        page_preview_locator: previewEvidence.locator,
        accepted_by_platform: previewEvidence.acceptedByPlatform,
        visible_in_editor: true,
        captured_at: timestamp,
        preview_diagnostics: previewEvidence.diagnostics
    };
    if (previewEvidence.acceptedByPlatform) {
        return await performControlledSubmitPublishCleanup(input, uploadArtifact);
    }
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
        blockerCode: "UPLOAD_ACCEPTANCE_UNVERIFIED",
        blockerMessage: "Controlled live upload observed an editor preview, but platform upload acceptance is not independently verified.",
        detailsRef: "upload_acceptance_unverified",
        requiredRecoveryAction: "collect platform-returned upload acceptance evidence before submit/publish"
    }, uploadArtifact);
};
return { performXhsControlledLiveWriteWithApprovedSourceMedia, buildXhsControlledLiveWriteFromDiscovery, buildXhsControlledLiveWriteUnavailableResult, buildXhsControlledLiveWriteUploadBlockedResult };
})();
const __webenvoy_module_xhs_search_execution = (() => {
const {
  SEARCH_ENDPOINT,
  createPageContextNamespace,
  createSearchRequestShape,
  serializeSearchRequestShape
} = __webenvoy_module_xhs_search_types;
const {
  createAuditRecord,
  createGateOnlySuccess,
  resolveGate
} = __webenvoy_module_xhs_search_gate;
const {
  buildEditorInputEvidence,
  classifyXhsAccountSafetySurface,
  containsCookie,
  createDiagnosis,
  createFailure,
  createObservability,
  inferFailure,
  inferRequestException,
  isTrustedEditorInputValidation,
  parseCount,
  resolveSimulatedResult,
  resolveRiskStateOutput,
  resolveXsCommon
} = __webenvoy_module_xhs_search_telemetry;
const {
  buildXhsSearchLayer2InteractionEvidence
} = __webenvoy_module_layer2_humanized_events;
const {
  buildXhsControlledLiveWriteUnavailableResult,
  buildXhsControlledLiveWriteUploadBlockedResult
} = __webenvoy_module_xhs_controlled_live_write;
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asInteger = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
};
const REQUEST_CONTEXT_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_CONTEXT_WAIT_MAX_MS = 15_000;
const REQUEST_CONTEXT_WAIT_RETRY_MS = 250;
const REQUEST_CONTEXT_FORWARD_DEADLINE_SAFETY_MS = 6_000;
const CLOSEOUT_PROVENANCE_BIND_FRESH_WINDOW_MS = 30_000;
const asString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const toIsoString = (value) => new Date(value).toISOString();
const buildSearchPassiveApiCaptureArtifactIdentity = (input) => [
    "xhs.search.passive_api_capture",
    input.runId,
    input.pageContextNamespace,
    input.shapeKey,
    String(input.capturedAt)
].join(":");
const buildPassiveApiCaptureEvidenceDiagnostic = (routeEvidence) => ({
    evidence_class: "passive_api_capture",
    evidence_role: "diagnostic",
    route_role: "supporting",
    path_kind: "api",
    source_kind: "page_request",
    current_page_natural_request: true,
    synthetic_replay: false,
    live_closeout_evidence: false,
    syvert_normalized_output: false,
    request_payload_included: false,
    response_payload_included: false,
    redaction_state: "payload_omitted",
    route: routeEvidence.route,
    method: routeEvidence.method,
    endpoint: routeEvidence.endpoint,
    request_url: routeEvidence.request_url,
    status_code: routeEvidence.status_code,
    run_id: routeEvidence.run_id,
    profile_ref: routeEvidence.profile_ref,
    session_id: routeEvidence.session_id,
    target_tab_id: routeEvidence.target_tab_id,
    page_url: routeEvidence.page_url,
    action_ref: routeEvidence.action_ref,
    observed_at: routeEvidence.observed_at,
    captured_at: routeEvidence.captured_at,
    page_context_namespace: routeEvidence.page_context_namespace,
    shape_key: routeEvidence.shape_key,
    artifact_identity: routeEvidence.artifact_identity
});
const withPassiveApiCaptureEvidenceDiagnostic = (routeEvidence) => ({
    passive_api_capture_evidence: buildPassiveApiCaptureEvidenceDiagnostic(routeEvidence)
});
const normalizeSearchQueryText = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.normalize("NFKC").trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
};
const isCurrentSearchPageForQuery = (href, query) => {
    const expectedQuery = normalizeSearchQueryText(query);
    if (!expectedQuery) {
        return false;
    }
    try {
        const url = new URL(href);
        if (url.hostname !== "www.xiaohongshu.com" || !url.pathname.includes("/search_result")) {
            return false;
        }
        return normalizeSearchQueryText(url.searchParams.get("keyword")) === expectedQuery;
    }
    catch {
        return false;
    }
};
const pickFirstString = (record, keys) => {
    for (const key of keys) {
        const value = asString(record[key]);
        if (value) {
            return value;
        }
    }
    return null;
};
const normalizeXhsUrl = (value) => {
    if (!value) {
        return null;
    }
    try {
        return new URL(value, "https://www.xiaohongshu.com").toString();
    }
    catch {
        return value;
    }
};
const isXhsNoteCardUrl = (value) => {
    if (!value) {
        return false;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        return (url.hostname === "www.xiaohongshu.com" &&
            (url.pathname.startsWith("/explore/") || url.pathname.startsWith("/discovery/item/")));
    }
    catch {
        return false;
    }
};
const isXhsUserProfileUrl = (value) => {
    if (!value) {
        return false;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        return url.hostname === "www.xiaohongshu.com" && url.pathname.startsWith("/user/profile/");
    }
    catch {
        return false;
    }
};
const parseXsecFromUrl = (value) => {
    if (!value) {
        return {
            xsec_token: null,
            xsec_source: null
        };
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        return {
            xsec_token: asString(url.searchParams.get("xsec_token")),
            xsec_source: asString(url.searchParams.get("xsec_source"))
        };
    }
    catch {
        return {
            xsec_token: null,
            xsec_source: null
        };
    }
};
const buildXhsContinuityUrl = (input) => {
    if (!input.id || !input.xsecToken) {
        return null;
    }
    const path = input.kind === "note"
        ? `/explore/${encodeURIComponent(input.id)}`
        : `/user/profile/${encodeURIComponent(input.id)}`;
    const url = new URL(path, "https://www.xiaohongshu.com");
    url.searchParams.set("xsec_token", input.xsecToken);
    if (input.xsecSource) {
        url.searchParams.set("xsec_source", input.xsecSource);
    }
    return url.toString();
};
const collectSearchDomCards = (value, seen = new Set()) => {
    const record = asRecord(value);
    if (record) {
        if (seen.has(record)) {
            return [];
        }
        seen.add(record);
        const userRecord = asRecord(record.user) ?? asRecord(record.author);
        const noteCardRecord = asRecord(record.note_card) ?? asRecord(record.noteCard);
        const hasKnownSearchCardShape = noteCardRecord !== null ||
            "display_title" in record ||
            "displayTitle" in record ||
            "interact_info" in record ||
            "cover" in record ||
            "image_list" in record ||
            "video_info" in record;
        const noteCardUserRecord = asRecord(noteCardRecord?.user) ?? asRecord(noteCardRecord?.author) ?? null;
        const noteId = pickFirstString(record, ["note_id", "noteId", "id"]) ??
            (noteCardRecord ? pickFirstString(noteCardRecord, ["note_id", "noteId", "id"]) : null);
        const userId = pickFirstString(record, ["user_id", "userId"]) ??
            (userRecord ? pickFirstString(userRecord, ["user_id", "userId", "id"]) : null) ??
            (noteCardUserRecord ? pickFirstString(noteCardUserRecord, ["user_id", "userId", "id"]) : null);
        const rawDetailUrl = normalizeXhsUrl(pickFirstString(record, ["detail_url", "detailUrl", "note_url", "noteUrl", "href", "url", "link"]) ??
            (noteCardRecord
                ? pickFirstString(noteCardRecord, ["detail_url", "detailUrl", "note_url", "noteUrl", "href", "url", "link"])
                : null));
        const rawUserHomeUrl = normalizeXhsUrl(pickFirstString(record, ["user_home_url", "userHomeUrl", "author_url", "authorUrl", "user_url", "userUrl"]) ??
            (userRecord ? pickFirstString(userRecord, ["user_home_url", "userHomeUrl", "url", "link"]) : null) ??
            (noteCardUserRecord
                ? pickFirstString(noteCardUserRecord, ["user_home_url", "userHomeUrl", "url", "link"])
                : null));
        const parsedDetail = parseXsecFromUrl(rawDetailUrl);
        const parsedUser = parseXsecFromUrl(rawUserHomeUrl);
        const xsecToken = pickFirstString(record, ["xsec_token", "xsecToken"]) ??
            (noteCardRecord ? pickFirstString(noteCardRecord, ["xsec_token", "xsecToken"]) : null) ??
            parsedDetail.xsec_token ??
            parsedUser.xsec_token;
        const xsecSource = pickFirstString(record, ["xsec_source", "xsecSource"]) ??
            (noteCardRecord ? pickFirstString(noteCardRecord, ["xsec_source", "xsecSource"]) : null) ??
            parsedDetail.xsec_source ??
            parsedUser.xsec_source;
        const detailUrl = isXhsNoteCardUrl(rawDetailUrl)
            ? rawDetailUrl
            : hasKnownSearchCardShape
                ? buildXhsContinuityUrl({
                    kind: "note",
                    id: noteId,
                    xsecToken,
                    xsecSource
                })
                : null;
        const userHomeUrl = isXhsUserProfileUrl(rawUserHomeUrl)
            ? rawUserHomeUrl
            : hasKnownSearchCardShape
                ? buildXhsContinuityUrl({
                    kind: "user",
                    id: userId,
                    xsecToken,
                    xsecSource
                })
                : null;
        const card = {
            title: pickFirstString(record, ["title", "display_title", "displayTitle", "desc"]) ??
                (noteCardRecord ? pickFirstString(noteCardRecord, ["title", "display_title", "displayTitle"]) : null),
            note_id: noteId,
            user_id: userId,
            detail_url: detailUrl,
            user_home_url: userHomeUrl,
            xsec_token: xsecToken,
            xsec_source: xsecSource
        };
        const hasCardSignal = card.detail_url !== null || card.user_home_url !== null;
        return [
            ...(hasCardSignal ? [card] : []),
            ...Object.values(record).flatMap((entry) => collectSearchDomCards(entry, seen))
        ];
    }
    if (Array.isArray(value)) {
        return value.flatMap((entry) => collectSearchDomCards(entry, seen));
    }
    return [];
};
const resolveSearchDomExtraction = async (env) => {
    const state = (typeof env.readPageStateRoot === "function" ? await env.readPageStateRoot().catch(() => null) : null) ??
        (typeof env.getPageStateRoot === "function" ? env.getPageStateRoot() : null);
    const stateCards = collectSearchDomCards(state);
    if (stateCards.length > 0) {
        return {
            extraction_layer: "hydration_state",
            extraction_locator: "window.__INITIAL_STATE__",
            cards: stateCards
        };
    }
    const domState = typeof env.readSearchDomState === "function" ? await env.readSearchDomState().catch(() => null) : null;
    const domStateRecord = asRecord(domState);
    const domCards = collectSearchDomCards(domStateRecord?.cards ?? domState);
    if (domCards.length > 0) {
        return {
            extraction_layer: domStateRecord?.extraction_layer === "script_json" ? "script_json" : "dom_selector",
            extraction_locator: asString(domStateRecord?.extraction_locator) ??
                (domStateRecord?.extraction_layer === "script_json"
                    ? "script[type='application/json']"
                    : ".search-result-container"),
            cards: domCards
        };
    }
    return null;
};
const buildSearchTargetContinuity = (cards) => cards.map((card) => ({
    target_url: card.detail_url ?? card.user_home_url,
    note_id: card.note_id,
    user_id: card.user_id,
    detail_url: card.detail_url,
    user_home_url: card.user_home_url,
    xsec_token: card.xsec_token,
    xsec_source: card.xsec_source,
    token_presence: card.xsec_token && card.xsec_token.trim().length > 0
        ? "present"
        : card.xsec_token === ""
            ? "empty"
            : "missing",
    source_route: "xhs.search"
}));
const buildSearchDomPageStateFallbackEvidence = (input) => ({
    evidence_class: "dom_state_extraction",
    evidence_role: "diagnostic",
    route_role: "supporting",
    path_kind: input.extraction.extraction_layer === "hydration_state" ? "page_state" : "dom",
    source_kind: input.extraction.extraction_layer,
    evidence_status: "success",
    fallback_used: true,
    fallback_reason: input.fallbackReason,
    confidence: {
        level: "medium",
        basis: "current search page matched requested query and exposed reusable card continuity signals"
    },
    limits: {
        passive_api_capture_evidence: false,
        live_closeout_evidence: false,
        provider_aware_closeout_boundary: false,
        syvert_normalized_output: false,
        request_payload_included: false,
        response_payload_included: false,
        browser_live_claim: false
    },
    provenance: {
        command: "xhs.search",
        page_kind: "search",
        page_url: input.pageUrl,
        run_id: input.runId,
        profile_ref: input.profileRef,
        session_id: input.sessionId,
        target_tab_id: input.targetTabId,
        action_ref: input.actionRef,
        extraction_locator: input.extraction.extraction_locator,
        extracted_at: input.extractedAt,
        data_ref: {
            query: input.query
        }
    }
});
const performSearchPassiveAction = async (input, env) => {
    if (typeof env.performSearchPassiveAction !== "function") {
        return null;
    }
    try {
        return asRecord(await env.performSearchPassiveAction({
            query: input.params.query,
            pageUrl: env.getLocationHref(),
            runId: input.executionContext.runId,
            actionRef: input.executionContext.gateInvocationId ?? input.executionContext.runId,
            timeoutMs: Math.min(typeof input.options.timeout_ms === "number" &&
                Number.isFinite(input.options.timeout_ms) &&
                input.options.timeout_ms > 0
                ? Math.floor(input.options.timeout_ms)
                : 6_000, 12_000),
            debuggerActionAllowed: input.options.closeout_evidence_evaluation === true ||
                input.options.closeout_audit_required === true
        }));
    }
    catch (error) {
        return {
            evidence_class: "humanized_action",
            action_kind: "passive_action_diagnostic",
            action_ref: input.executionContext.gateInvocationId ?? input.executionContext.runId,
            run_id: input.executionContext.runId,
            page_url: env.getLocationHref(),
            query: input.params.query,
            failed_before_evidence: true,
            error: error instanceof Error ? error.message : String(error)
        };
    }
};
const withExecutionAuditInFailurePayload = (result, executionAudit) => {
    if (result.ok) {
        return result;
    }
    return {
        ...result,
        payload: {
            ...result.payload,
            execution_audit: executionAudit
        }
    };
};
const withLayer2InteractionInSuccessPayload = (result, layer2Interaction) => {
    if (!result.ok || !layer2Interaction) {
        return result;
    }
    const summary = asRecord(result.payload.summary);
    if (!summary) {
        return result;
    }
    return {
        ...result,
        payload: {
            ...result.payload,
            summary: {
                ...summary,
                layer2_interaction: layer2Interaction
            }
        }
    };
};
const withLayer2InteractionInPayload = (result, layer2Interaction) => {
    if (!layer2Interaction) {
        return result;
    }
    return {
        ...result,
        payload: {
            ...result.payload,
            layer2_interaction: layer2Interaction
        }
    };
};
const serializeCanonicalShape = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const shape = createSearchRequestShape({
        keyword: record.keyword,
        page: record.page,
        page_size: record.page_size,
        limit: record.limit,
        sort: record.sort,
        note_type: record.note_type
    });
    return shape ? serializeSearchRequestShape(shape) : null;
};
const layer2InteractionSummary = (layer2Interaction) => layer2Interaction ? { layer2_interaction: layer2Interaction } : {};
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const asRecordArray = (value) => Array.isArray(value)
    ? value.filter((item) => asRecord(item) !== null)
    : [];
const buildProviderAwareReadPathSummaryFields = (options) => {
    const providerRequirementRefs = asStringArray(options.provider_requirement_refs);
    const targetBindingTransitionEvidence = asRecordArray(options.target_binding_transition_evidence);
    const downstreamSliceRefs = asStringArray(options.downstream_slice_refs);
    const nonProofs = asStringArray(options.non_proofs);
    const pageRuntimeReadinessBlockingReasons = asStringArray(options.page_runtime_readiness_blocking_reasons);
    return {
        ...(asRecord(options.xhs_driver_provider_requirements)
            ? {
                xhs_driver_provider_requirements: asRecord(options.xhs_driver_provider_requirements)
            }
            : {}),
        ...(providerRequirementRefs.length > 0
            ? { provider_requirement_refs: providerRequirementRefs }
            : {}),
        ...(asString(options.runtime_binding_ref)
            ? { runtime_binding_ref: asString(options.runtime_binding_ref) }
            : {}),
        ...(asString(options.target_binding_snapshot_ref)
            ? { target_binding_snapshot_ref: asString(options.target_binding_snapshot_ref) }
            : {}),
        ...(asRecord(options.xhs_runtime_binding)
            ? { xhs_runtime_binding: asRecord(options.xhs_runtime_binding) }
            : {}),
        ...(asRecord(options.target_binding_snapshot)
            ? { target_binding_snapshot: asRecord(options.target_binding_snapshot) }
            : {}),
        ...(targetBindingTransitionEvidence.length > 0
            ? { target_binding_transition_evidence: targetBindingTransitionEvidence }
            : {}),
        ...(downstreamSliceRefs.length > 0 ? { downstream_slice_refs: downstreamSliceRefs } : {}),
        ...(nonProofs.length > 0 ? { non_proofs: nonProofs } : {}),
        ...(asString(options.page_runtime_readiness_ref)
            ? { page_runtime_readiness_ref: asString(options.page_runtime_readiness_ref) }
            : {}),
        ...(asRecord(options.xhs_page_runtime_readiness)
            ? { xhs_page_runtime_readiness: asRecord(options.xhs_page_runtime_readiness) }
            : {}),
        ...(asString(options.page_runtime_readiness_decision)
            ? { page_runtime_readiness_decision: asString(options.page_runtime_readiness_decision) }
            : {}),
        ...(pageRuntimeReadinessBlockingReasons.length > 0
            ? { page_runtime_readiness_blocking_reasons: pageRuntimeReadinessBlockingReasons }
            : {})
    };
};
const BLOCKED_READINESS_STATUSES = new Set(["blocked", "deny", "denied", "not_ready"]);
const ALLOWED_REQUIRED_READINESS_STATUSES = new Set(["ready", "not_required"]);
const DENY_READINESS_DECISIONS = new Set(["deny", "denied", "blocked", "defer", "deferred"]);
const TARGET_BINDING_ALLOWED_STATES = new Set(["bound"]);
const RUNTIME_BINDING_ALLOWED_STATUSES = new Set(["declared", "ready"]);
const RUNTIME_BINDING_CURRENT_FRESHNESS = new Set(["current_run"]);
const ALLOWED_PROVIDER_AWARE_GATE_REASONS = new Set(["LIVE_MODE_APPROVED"]);
const EXPECTED_XHS_SEARCH_PROVIDER_REQUIREMENT_REF = "FR-0061.xhs_driver_provider_requirements.v1/xhs.search.read";
const EXPECTED_XHS_SEARCH_COMMAND = "xhs.search";
const EXPECTED_XHS_SEARCH_ABILITY_ID = "xhs.note.search.v1";
const EXPECTED_XHS_SEARCH_ABILITY_LAYER = "L3";
const EXPECTED_XHS_SEARCH_ACTION = "read";
const EXPECTED_XHS_SEARCH_ROUTE_BUCKET = "search";
const EXPECTED_XHS_TARGET_DOMAIN = "www.xiaohongshu.com";
const EXPECTED_XHS_SEARCH_TARGET_PAGE_CLASS = "search_tab";
const parseTargetBindingSnapshotRef = (value) => {
    if (!value) {
        return null;
    }
    const match = /^FR-0063\.target_binding_snapshot\.v1\/([^/]+)\/([^/]+)$/.exec(value);
    if (!match) {
        return null;
    }
    return {
        runId: match[1] ?? "",
        routeBucket: match[2] ?? ""
    };
};
const parseRuntimeBindingRef = (value) => {
    if (!value) {
        return null;
    }
    const match = /^FR-0061\.xhs_runtime_binding\.v1\/([^/]+)\/([^/]+)$/.exec(value);
    if (!match) {
        return null;
    }
    return {
        runId: match[1] ?? "",
        routeBucket: match[2] ?? ""
    };
};
const parseTargetBindingEvidenceRefRunId = (value) => {
    if (!value) {
        return null;
    }
    const fr0063Match = /^FR-0063\.[^/]+\.v1\/([^/]+)\//.exec(value);
    if (fr0063Match) {
        return fr0063Match[1] ?? null;
    }
    const transitionMatch = /^target-binding-transition:([^:]+):/.exec(value);
    return transitionMatch?.[1] ?? null;
};
const isTargetBindingEvidenceRefCurrentRun = (value, activeRunId) => {
    const refRunId = parseTargetBindingEvidenceRefRunId(value);
    return !refRunId || refRunId === activeRunId;
};
const hasCurrentRunTransitionEvidence = (transitionRefs, transitionEvidence, activeRunId, reasons) => {
    let hasTransitionEvidence = false;
    for (const transitionRef of transitionRefs) {
        if (transitionRef.length === 0) {
            continue;
        }
        hasTransitionEvidence = true;
        if (!isTargetBindingEvidenceRefCurrentRun(transitionRef, activeRunId)) {
            reasons.push("target_binding_evidence_ref_mismatch");
        }
    }
    for (const transition of transitionEvidence) {
        const transitionId = asString(transition.transition_id);
        if (!transitionId) {
            continue;
        }
        hasTransitionEvidence = true;
        if (!isTargetBindingEvidenceRefCurrentRun(transitionId, activeRunId)) {
            reasons.push("target_binding_evidence_ref_mismatch");
        }
    }
    return hasTransitionEvidence;
};
const collectTargetBindingRequiredEvidenceRefBlockers = (targetBindingSnapshot, transitionEvidence, activeRunId) => {
    if (asString(targetBindingSnapshot.state) !== "bound") {
        return [];
    }
    const reasons = [];
    const evidenceRefs = asRecord(targetBindingSnapshot.evidence_refs);
    if (!evidenceRefs) {
        return [
            "target_binding_evidence_refs_missing",
            "target_binding_candidate_ref_missing",
            "target_binding_url_match_ref_missing",
            "target_binding_dom_observation_ref_missing",
            "target_binding_runtime_state_ref_missing",
            "target_binding_extension_bridge_ref_missing",
            "target_binding_transition_refs_missing"
        ];
    }
    const requiredRefs = [
        ["candidate_ref", "target_binding_candidate_ref_missing"],
        ["url_match_ref", "target_binding_url_match_ref_missing"],
        ["dom_observation_ref", "target_binding_dom_observation_ref_missing"],
        ["runtime_state_ref", "target_binding_runtime_state_ref_missing"],
        ["extension_bridge_ref", "target_binding_extension_bridge_ref_missing"]
    ];
    for (const [field, missingReason] of requiredRefs) {
        const ref = asString(evidenceRefs[field]);
        if (!ref) {
            reasons.push(missingReason);
            continue;
        }
        if (!isTargetBindingEvidenceRefCurrentRun(ref, activeRunId)) {
            reasons.push("target_binding_evidence_ref_mismatch");
        }
    }
    const transitionRefs = asStringArray(evidenceRefs.transition_refs);
    if (!hasCurrentRunTransitionEvidence(transitionRefs, transitionEvidence, activeRunId, reasons)) {
        reasons.push("target_binding_transition_refs_missing");
    }
    const redactionState = asString(evidenceRefs.redaction_state ?? targetBindingSnapshot.redaction_state);
    if (redactionState === "redaction_required" ||
        redactionState === "policy_missing" ||
        redactionState === "invalid") {
        reasons.push("target_binding_redaction_invalid");
    }
    const evidenceStatus = asString(evidenceRefs.evidence_status ?? targetBindingSnapshot.evidence_status);
    const evidenceCompleteness = asString(evidenceRefs.evidence_completeness ?? targetBindingSnapshot.evidence_completeness);
    const partial = evidenceRefs.partial ?? targetBindingSnapshot.partial;
    if (evidenceStatus === "partial" ||
        evidenceStatus === "unavailable" ||
        evidenceStatus === "unknown" ||
        evidenceStatus === "invalid" ||
        evidenceCompleteness === "partial" ||
        evidenceCompleteness === "unavailable" ||
        evidenceCompleteness === "unknown" ||
        evidenceCompleteness === "invalid" ||
        partial === true) {
        reasons.push("target_binding_evidence_partial");
    }
    const sourceOwner = asString(evidenceRefs.source_owner ?? targetBindingSnapshot.source_owner);
    if (sourceOwner &&
        sourceOwner !== "#1161" &&
        sourceOwner !== "target_binding_state_machine" &&
        sourceOwner !== "xhs_target_binding_state_machine") {
        reasons.push("target_binding_source_owner_mismatch");
    }
    return reasons;
};
const collectTargetBindingEvidenceBlockers = (targetBindingSnapshotRef, targetBindingSnapshot, pageRuntimeReadiness, transitionEvidence, activeRunId) => {
    if (!targetBindingSnapshot) {
        return [];
    }
    const reasons = [];
    const parsedRef = parseTargetBindingSnapshotRef(targetBindingSnapshotRef);
    if (targetBindingSnapshotRef && !parsedRef) {
        reasons.push("target_binding_ref_mismatch");
    }
    const freshnessScope = asString(targetBindingSnapshot.freshness_scope);
    if (!freshnessScope) {
        reasons.push("target_binding_freshness_missing");
    }
    else if (freshnessScope !== "current_run") {
        if (freshnessScope === "historical_background") {
            reasons.push("target_binding_freshness_stale");
        }
        else if (freshnessScope === "unknown") {
            reasons.push("target_binding_freshness_unknown");
        }
        else if (freshnessScope === "stale" || freshnessScope === "lost") {
            reasons.push("target_binding_freshness_stale");
        }
        reasons.push(`target_binding_freshness:${freshnessScope}`);
    }
    const snapshotRunId = asString(targetBindingSnapshot.run_id);
    const readinessRunId = asString(pageRuntimeReadiness?.run_id);
    if (!snapshotRunId) {
        reasons.push("target_binding_run_id_missing");
    }
    else if (snapshotRunId !== activeRunId) {
        reasons.push("target_binding_run_id_mismatch");
    }
    if (pageRuntimeReadiness && !readinessRunId) {
        reasons.push("page_runtime_readiness_run_id_missing");
    }
    else if (readinessRunId && readinessRunId !== activeRunId) {
        reasons.push("page_runtime_readiness_run_id_mismatch");
    }
    if (parsedRef) {
        if (parsedRef.routeBucket !== EXPECTED_XHS_SEARCH_ROUTE_BUCKET) {
            reasons.push("target_binding_ref_mismatch");
            reasons.push(`target_binding_ref_route:${parsedRef.routeBucket}`);
        }
        if (parsedRef.runId !== activeRunId) {
            reasons.push("target_binding_ref_mismatch");
        }
        if (snapshotRunId && parsedRef.runId !== snapshotRunId) {
            reasons.push("target_binding_ref_mismatch");
        }
        if (readinessRunId && parsedRef.runId !== readinessRunId) {
            reasons.push("target_binding_ref_mismatch");
        }
    }
    if (snapshotRunId && readinessRunId && snapshotRunId !== readinessRunId) {
        reasons.push("target_binding_run_id_mismatch");
    }
    const targetScope = asRecord(targetBindingSnapshot.target_scope);
    if (!targetScope) {
        reasons.push("target_binding_scope_missing");
    }
    else {
        const targetDomain = asString(targetScope.target_domain);
        const targetPageClass = asString(targetScope.target_page_class);
        if (targetDomain !== EXPECTED_XHS_TARGET_DOMAIN) {
            reasons.push("target_binding_scope_mismatch");
        }
        if (targetPageClass !== EXPECTED_XHS_SEARCH_TARGET_PAGE_CLASS) {
            reasons.push("target_binding_scope_mismatch");
        }
    }
    const routeBucket = asString(targetBindingSnapshot.route_bucket);
    if (routeBucket !== EXPECTED_XHS_SEARCH_ROUTE_BUCKET) {
        reasons.push("target_binding_scope_mismatch");
    }
    reasons.push(...collectTargetBindingRequiredEvidenceRefBlockers(targetBindingSnapshot, transitionEvidence, activeRunId));
    return reasons;
};
const collectProviderRequirementBlockers = (providerRequirements, providerRequirementRefs) => {
    if (!providerRequirements) {
        return [];
    }
    const reasons = [];
    const declarationRefs = asStringArray(providerRequirements.provider_requirement_refs);
    if (providerRequirementRefs.length === 0 || declarationRefs.length === 0) {
        return reasons;
    }
    const declarationRefSet = new Set(declarationRefs);
    if (!providerRequirementRefs.every((ref) => declarationRefSet.has(ref)) ||
        !declarationRefSet.has(EXPECTED_XHS_SEARCH_PROVIDER_REQUIREMENT_REF)) {
        reasons.push("provider_requirement_ref_mismatch");
    }
    const primaryRequirementRef = asString(providerRequirements.provider_requirement_ref);
    if (primaryRequirementRef &&
        primaryRequirementRef !== EXPECTED_XHS_SEARCH_PROVIDER_REQUIREMENT_REF) {
        reasons.push("provider_requirement_ref_mismatch");
    }
    const abilityScope = asRecord(providerRequirements.ability_scope);
    const command = asString(abilityScope?.command);
    const abilityId = asString(abilityScope?.ability_id);
    const abilityLayer = asString(abilityScope?.ability_layer);
    const action = asString(abilityScope?.ability_action);
    if (command !== EXPECTED_XHS_SEARCH_COMMAND ||
        abilityId !== EXPECTED_XHS_SEARCH_ABILITY_ID ||
        abilityLayer !== EXPECTED_XHS_SEARCH_ABILITY_LAYER ||
        action !== EXPECTED_XHS_SEARCH_ACTION) {
        reasons.push("provider_requirement_scope_mismatch");
    }
    const requiredActions = asStringArray(providerRequirements.required_actions);
    if (!requiredActions.includes(EXPECTED_XHS_SEARCH_ACTION)) {
        reasons.push("provider_requirement_scope_mismatch");
    }
    return reasons;
};
const collectRuntimeBindingBlockers = (runtimeBindingRef, runtimeBinding, activeRunId) => {
    const reasons = [];
    if (!runtimeBindingRef) {
        reasons.push("runtime_binding_ref_missing");
    }
    else {
        const parsedRuntimeBindingRef = parseRuntimeBindingRef(runtimeBindingRef);
        if (!parsedRuntimeBindingRef ||
            parsedRuntimeBindingRef.routeBucket !== EXPECTED_XHS_SEARCH_ROUTE_BUCKET ||
            parsedRuntimeBindingRef.runId !== activeRunId) {
            reasons.push("runtime_binding_ref_mismatch");
        }
    }
    if (!runtimeBinding) {
        reasons.push("runtime_binding_evidence_missing");
        return reasons;
    }
    const targetDomain = asString(runtimeBinding.target_domain);
    const targetPage = asString(runtimeBinding.target_page);
    if (targetDomain !== EXPECTED_XHS_TARGET_DOMAIN ||
        targetPage !== EXPECTED_XHS_SEARCH_TARGET_PAGE_CLASS) {
        reasons.push("runtime_binding_scope_mismatch");
    }
    const bindingStatus = asString(runtimeBinding.binding_status);
    if (!bindingStatus) {
        reasons.push("runtime_binding_status_missing");
    }
    else if (!RUNTIME_BINDING_ALLOWED_STATUSES.has(bindingStatus)) {
        reasons.push("runtime_binding_not_bound");
        reasons.push(`runtime_binding_status:${bindingStatus}`);
    }
    const bindingFreshness = asString(runtimeBinding.binding_freshness);
    if (!bindingFreshness) {
        reasons.push("runtime_binding_freshness_missing");
    }
    else if (!RUNTIME_BINDING_CURRENT_FRESHNESS.has(bindingFreshness)) {
        if (bindingFreshness === "historical_background") {
            reasons.push("runtime_binding_stale");
        }
        reasons.push(`runtime_binding_freshness:${bindingFreshness}`);
    }
    return reasons;
};
const collectReadinessDimensionBlockers = (dimension, prefix, missingReason) => {
    if (!dimension) {
        return [missingReason];
    }
    if (dimension.required === false) {
        return [];
    }
    const status = asString(dimension.status);
    const gateDecision = asString(dimension.gate_decision);
    const blockingReasons = asStringArray(dimension.blocking_reasons);
    const reasons = [];
    if (!status) {
        reasons.push(`${prefix}:status_missing`);
    }
    else if (!ALLOWED_REQUIRED_READINESS_STATUSES.has(status)) {
        reasons.push(`${prefix}:${status}`);
    }
    if (gateDecision && DENY_READINESS_DECISIONS.has(gateDecision)) {
        reasons.push(`${prefix}:${gateDecision}`);
    }
    reasons.push(...blockingReasons.map((reason) => `${prefix}:${reason}`));
    return reasons;
};
const resolveProviderAwareReadPathBlock = (options, activeRunId) => {
    const summaryFields = buildProviderAwareReadPathSummaryFields(options);
    const targetBindingSnapshot = asRecord(options.target_binding_snapshot);
    const pageRuntimeReadiness = asRecord(options.xhs_page_runtime_readiness);
    const pageReadiness = asRecord(pageRuntimeReadiness?.page_readiness);
    const runtimeReadiness = asRecord(pageRuntimeReadiness?.runtime_readiness);
    const providerAdmissionReadiness = asRecord(pageRuntimeReadiness?.provider_admission_readiness);
    const runtimeBindingRef = asString(options.runtime_binding_ref);
    const runtimeBinding = asRecord(options.xhs_runtime_binding);
    const targetBindingState = asString(targetBindingSnapshot?.state);
    const targetBindingSnapshotRef = asString(options.target_binding_snapshot_ref);
    const providerRequirements = asRecord(options.xhs_driver_provider_requirements);
    const providerRequirementRefs = asStringArray(options.provider_requirement_refs);
    const providerRequirementDeclarationRefs = asStringArray(providerRequirements?.provider_requirement_refs);
    const readinessCommand = asString(pageRuntimeReadiness?.command);
    const reasons = [
        ...(targetBindingSnapshot ? [] : ["target_binding_snapshot_missing"]),
        ...(targetBindingSnapshotRef ? [] : ["target_binding_snapshot_ref_missing"]),
        ...(providerRequirements ? [] : ["xhs_driver_provider_requirements_missing"]),
        ...(providerRequirementRefs.length > 0 && providerRequirementDeclarationRefs.length > 0
            ? []
            : ["provider_requirement_refs_missing"]),
        ...(pageRuntimeReadiness ? [] : ["page_runtime_readiness_missing"]),
        ...(readinessCommand && readinessCommand !== EXPECTED_XHS_SEARCH_COMMAND
            ? ["page_runtime_readiness_command_mismatch"]
            : []),
        ...collectTargetBindingEvidenceBlockers(targetBindingSnapshotRef, targetBindingSnapshot, pageRuntimeReadiness, asRecordArray(options.target_binding_transition_evidence), activeRunId),
        ...collectProviderRequirementBlockers(providerRequirements, providerRequirementRefs),
        ...collectRuntimeBindingBlockers(runtimeBindingRef, runtimeBinding, activeRunId),
        ...asStringArray(targetBindingSnapshot?.blocking_reasons).map((reason) => `target_binding:${reason}`),
        ...collectReadinessDimensionBlockers(pageReadiness, "page", "page_readiness_missing"),
        ...collectReadinessDimensionBlockers(runtimeReadiness, "runtime", "runtime_readiness_missing"),
        ...collectReadinessDimensionBlockers(providerAdmissionReadiness, "provider", "provider_admission_result_missing"),
        ...asStringArray(options.page_runtime_readiness_blocking_reasons)
    ];
    const overallReadiness = asString(pageRuntimeReadiness?.overall_readiness);
    const readinessGateDecision = asString(pageRuntimeReadiness?.gate_decision);
    const optionReadinessDecision = asString(options.page_runtime_readiness_decision);
    if (!TARGET_BINDING_ALLOWED_STATES.has(targetBindingState ?? "")) {
        reasons.push("target_binding:target_binding_not_bound");
        reasons.push(`target_binding_state:${targetBindingState ?? "missing"}`);
    }
    if (overallReadiness && BLOCKED_READINESS_STATUSES.has(overallReadiness)) {
        reasons.push(`overall_readiness:${overallReadiness}`);
    }
    if (readinessGateDecision && DENY_READINESS_DECISIONS.has(readinessGateDecision)) {
        reasons.push(`page_runtime_gate:${readinessGateDecision}`);
    }
    if (optionReadinessDecision && DENY_READINESS_DECISIONS.has(optionReadinessDecision)) {
        reasons.push(`page_runtime_readiness_decision:${optionReadinessDecision}`);
    }
    const uniqueReasons = Array.from(new Set(reasons));
    if (uniqueReasons.length === 0) {
        return null;
    }
    return {
        reason: "PROVIDER_AWARE_READINESS_DENIED",
        reasons: uniqueReasons,
        summaryFields
    };
};
const withoutAllowedProviderAwareGateReasons = (reasons) => reasons.filter((reason) => !ALLOWED_PROVIDER_AWARE_GATE_REASONS.has(reason));
const uniqueProviderAwareBlockReasons = (baseReasons, block) => Array.from(new Set([
    ...withoutAllowedProviderAwareGateReasons(baseReasons),
    "PROVIDER_AWARE_READINESS_DENIED",
    "PROVIDER_AWARE_LIVE_READ_NOT_CONTINUED",
    ...block.reasons
]));
const resolveBlockedNextRiskState = (current) => {
    if (current === "allowed") {
        return "limited";
    }
    if (current === "limited") {
        return "paused";
    }
    return current;
};
const isProviderAwareLiveReadGate = (gate) => gate.consumer_gate_result.action_type === "read" &&
    (gate.consumer_gate_result.effective_execution_mode === "live_read_limited" ||
        gate.consumer_gate_result.effective_execution_mode === "live_read_high_risk");
const withProviderAwareReadPathBlockPayload = (result, gate, auditRecord, block) => {
    if (result.ok) {
        return result;
    }
    const blockedGateReasons = uniqueProviderAwareBlockReasons(gate.consumer_gate_result.gate_reasons, block);
    const blockedConsumerGateResult = {
        ...gate.consumer_gate_result,
        effective_execution_mode: null,
        gate_decision: "blocked",
        gate_reasons: blockedGateReasons
    };
    const blockedGateOutcome = {
        ...gate.gate_outcome,
        effective_execution_mode: null,
        gate_decision: "blocked",
        gate_reasons: uniqueProviderAwareBlockReasons(gate.gate_outcome.gate_reasons, block),
        requires_manual_confirmation: false
    };
    const blockedRequestAdmissionResult = gate.request_admission_result
        ? {
            ...gate.request_admission_result,
            admission_decision: "blocked",
            effective_runtime_mode: null,
            reason_codes: uniqueProviderAwareBlockReasons([], block)
        }
        : gate.request_admission_result;
    const recordedAtMs = Date.parse(auditRecord.recorded_at);
    const cooldownBase = Number.isFinite(recordedAtMs) ? recordedAtMs : Date.now();
    const blockedAuditRecord = {
        ...auditRecord,
        effective_execution_mode: null,
        gate_decision: "blocked",
        gate_reasons: blockedGateReasons,
        risk_signal: true,
        recovery_signal: false,
        session_rhythm_state: "cooldown",
        cooldown_until: new Date(cooldownBase + 30 * 60_000).toISOString(),
        recovery_started_at: null,
        next_state: resolveBlockedNextRiskState(auditRecord.risk_state),
        transition_trigger: "provider_aware_readiness_denied"
    };
    const blockedGate = {
        ...gate,
        gate_outcome: blockedGateOutcome,
        consumer_gate_result: blockedConsumerGateResult,
        request_admission_result: blockedRequestAdmissionResult
    };
    return {
        ...result,
        payload: {
            ...result.payload,
            ...block.summaryFields,
            provider_aware_read_path_gate: {
                gate_decision: "blocked",
                reason: block.reason,
                blocking_reasons: block.reasons,
                live_execution_continued: false,
                effective_execution_mode: null
            },
            gate_outcome: blockedGateOutcome,
            consumer_gate_result: blockedConsumerGateResult,
            request_admission_result: blockedRequestAdmissionResult,
            risk_state_output: resolveRiskStateOutput(blockedGate, blockedAuditRecord),
            audit_record: blockedAuditRecord
        }
    };
};
const XHS_SEARCH_REPLAY_ORIGIN_ALLOWLIST = new Set([
    "https://www.xiaohongshu.com",
    "https://edith.xiaohongshu.com"
]);
const resolveTrustedSearchTemplateUrl = (value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:" ||
            !XHS_SEARCH_REPLAY_ORIGIN_ALLOWLIST.has(parsed.origin) ||
            parsed.pathname !== SEARCH_ENDPOINT) {
            return null;
        }
        return `${parsed.origin}${SEARCH_ENDPOINT}`;
    }
    catch {
        return null;
    }
};
const isTrustedCapturedTemplate = (template, expected) => {
    const templateRecord = asRecord(template);
    if (!templateRecord) {
        return false;
    }
    if (templateRecord.method !== "POST" ||
        templateRecord.path !== SEARCH_ENDPOINT ||
        templateRecord.page_context_namespace !== expected.pageContextNamespace ||
        templateRecord.shape_key !== expected.shapeKey) {
        return false;
    }
    const templateShape = asRecord(templateRecord.shape);
    if (templateShape?.command !== "xhs.search" ||
        templateShape?.method !== "POST" ||
        templateShape?.pathname !== SEARCH_ENDPOINT ||
        serializeCanonicalShape(templateShape) !== expected.shapeKey) {
        return false;
    }
    if (resolveTrustedSearchTemplateUrl(templateRecord.url) === null) {
        return false;
    }
    const request = asRecord(templateRecord.request);
    if (!request || !asRecord(request.headers)) {
        return false;
    }
    const response = asRecord(templateRecord.response);
    if (!response || !("body" in response)) {
        return false;
    }
    return serializeCanonicalShape(request.body) === expected.shapeKey;
};
const isTrustedRejectedObservation = (observation, expected) => {
    const observationRecord = asRecord(observation);
    if (!observationRecord) {
        return false;
    }
    if (observationRecord.method !== "POST" ||
        observationRecord.path !== SEARCH_ENDPOINT ||
        observationRecord.page_context_namespace !== expected.pageContextNamespace ||
        observationRecord.shape_key !== expected.shapeKey) {
        return false;
    }
    const reason = observationRecord.rejection_reason;
    if (reason !== "synthetic_request_rejected" &&
        reason !== "failed_request_rejected") {
        return false;
    }
    return serializeCanonicalShape(asRecord(observationRecord.shape) ?? asRecord(asRecord(observationRecord.request)?.body)) ===
        expected.shapeKey;
};
const isTransientFailedRequestObservation = (observation) => {
    const observationRecord = asRecord(observation);
    if (observationRecord?.rejection_reason !== "failed_request_rejected") {
        return false;
    }
    const requestStatus = asRecord(observationRecord.request_status);
    return requestStatus?.http_status === null;
};
const BACKEND_REJECTED_SOURCE_REASONS = new Set([
    "SESSION_EXPIRED",
    "ACCOUNT_ABNORMAL",
    "XHS_ACCOUNT_RISK_PAGE",
    "BROWSER_ENV_ABNORMAL",
    "GATEWAY_INVOKER_FAILED",
    "CAPTCHA_REQUIRED",
    "TARGET_API_RESPONSE_INVALID"
]);
const resolveRejectedSourceDetail = (observation) => {
    const observationRecord = asRecord(observation);
    const rejectionReason = observationRecord?.rejection_reason;
    if (!observationRecord || rejectionReason !== "failed_request_rejected") {
        return { reason: "synthetic_request_rejected" };
    }
    const requestStatus = asRecord(observationRecord.request_status);
    const statusCode = asInteger(requestStatus?.http_status) ?? asInteger(observationRecord.status);
    const responseBody = asRecord(asRecord(observationRecord.response)?.body);
    const platformCode = asInteger(responseBody?.code);
    const inferred = inferFailure(statusCode ?? 0, responseBody);
    if (BACKEND_REJECTED_SOURCE_REASONS.has(inferred.reason)) {
        return {
            reason: inferred.reason,
            message: inferred.message,
            ...(typeof statusCode === "number" ? { statusCode } : {}),
            ...(typeof platformCode === "number" ? { platformCode } : {})
        };
    }
    return {
        reason: "failed_request_rejected",
        ...(typeof statusCode === "number" ? { statusCode } : {}),
        ...(typeof platformCode === "number" ? { platformCode } : {})
    };
};
const isTrustedIncompatibleObservation = (observation, expected) => {
    const observationRecord = asRecord(observation);
    if (!observationRecord) {
        return false;
    }
    if (observationRecord.method !== "POST" ||
        observationRecord.path !== SEARCH_ENDPOINT ||
        observationRecord.page_context_namespace !== expected.pageContextNamespace ||
        observationRecord.shape_key === expected.shapeKey) {
        return false;
    }
    const inferredShapeKey = serializeCanonicalShape(asRecord(observationRecord.shape) ?? asRecord(asRecord(observationRecord.request)?.body));
    return inferredShapeKey !== null && inferredShapeKey === observationRecord.shape_key;
};
const waitForRequestContextRetry = async (env, ms) => {
    if (typeof env.sleep === "function") {
        await env.sleep(ms);
        return;
    }
    if (typeof setTimeout !== "function") {
        await Promise.resolve();
        return;
    }
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
const resolveRequestContextWaitMaxAttempts = (options, elapsedBeforeWaitMs = 0) => {
    const timeoutMs = typeof options.timeout_ms === "number" &&
        Number.isFinite(options.timeout_ms) &&
        options.timeout_ms > 0
        ? Math.floor(options.timeout_ms)
        : null;
    const elapsedMs = Math.max(0, Math.floor(elapsedBeforeWaitMs));
    const waitBudgetMs = timeoutMs === null
        ? REQUEST_CONTEXT_WAIT_MAX_MS
        : Math.max(0, timeoutMs - REQUEST_CONTEXT_FORWARD_DEADLINE_SAFETY_MS - elapsedMs);
    const maxWaitMs = Math.min(REQUEST_CONTEXT_WAIT_MAX_MS, waitBudgetMs);
    return Math.max(1, Math.floor(maxWaitMs / REQUEST_CONTEXT_WAIT_RETRY_MS) + 1);
};
const resolveRequestContextState = async (requestInput, env) => {
    const shape = createSearchRequestShape({
        keyword: requestInput.params.query,
        page: requestInput.params.page ?? 1,
        page_size: requestInput.params.limit ?? 20,
        sort: requestInput.params.sort ?? "general",
        note_type: requestInput.params.note_type ?? 0
    });
    const fallbackNamespace = createPageContextNamespace(env.getLocationHref());
    const readCapturedRequestContext = env.readCapturedRequestContext;
    if (!shape || !readCapturedRequestContext) {
        return {
            status: "miss",
            failureReason: "template_missing",
            pageContextNamespace: fallbackNamespace,
            shapeKey: shape ? serializeSearchRequestShape(shape) : "",
            availableShapeKeys: [],
            diagnostics: {
                lookup_unavailable: !readCapturedRequestContext,
                shape_available: Boolean(shape)
            }
        };
    }
    const shapeKey = serializeSearchRequestShape(shape);
    let pageContextNamespace = fallbackNamespace;
    const lookupOnce = async (input) => {
        let lookup = null;
        try {
            pageContextNamespace = createPageContextNamespace(env.getLocationHref());
            lookup = await readCapturedRequestContext({
                method: "POST",
                path: SEARCH_ENDPOINT,
                page_context_namespace: pageContextNamespace,
                shape_key: shapeKey,
                ...(requestInput.expectedProvenance
                    ? {
                        profile_ref: requestInput.expectedProvenance.profile_ref,
                        session_id: requestInput.expectedProvenance.session_id,
                        ...(typeof requestInput.expectedProvenance.target_tab_id === "number"
                            ? { target_tab_id: requestInput.expectedProvenance.target_tab_id }
                            : {}),
                        run_id: requestInput.expectedProvenance.run_id,
                        action_ref: requestInput.expectedProvenance.action_ref,
                        page_url: requestInput.expectedProvenance.page_url
                    }
                    : {}),
                ...(typeof requestInput.minObservedAt === "number"
                    ? { min_observed_at: requestInput.minObservedAt }
                    : {})
            });
        }
        catch {
            return {
                status: "miss",
                failureReason: "template_missing",
                pageContextNamespace,
                shapeKey,
                availableShapeKeys: [],
                diagnostics: {
                    lookup_transport_failed: true
                }
            };
        }
        pageContextNamespace = lookup?.page_context_namespace ?? pageContextNamespace;
        const availableShapeKeys = lookup?.available_shape_keys ?? [];
        const diagnostics = asRecord(lookup?.diagnostics) ?? undefined;
        const siblingShapeKeys = availableShapeKeys.filter((candidate) => candidate !== shapeKey);
        const admittedTemplate = isTrustedCapturedTemplate(lookup?.admitted_template ?? null, {
            pageContextNamespace,
            shapeKey
        })
            ? lookup?.admitted_template ?? null
            : null;
        const rejectedObservation = isTrustedRejectedObservation(lookup?.rejected_observation ?? null, {
            pageContextNamespace,
            shapeKey
        })
            ? lookup?.rejected_observation ?? null
            : null;
        const incompatibleObservation = isTrustedIncompatibleObservation(lookup?.incompatible_observation ?? null, {
            pageContextNamespace,
            shapeKey
        })
            ? lookup?.incompatible_observation ?? null
            : null;
        if (admittedTemplate && admittedTemplate.template_ready !== false) {
            const templateUrl = resolveTrustedSearchTemplateUrl(admittedTemplate.url);
            if (!templateUrl) {
                return {
                    status: "miss",
                    failureReason: "template_missing",
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys,
                    diagnostics
                };
            }
            const admittedResponseRecord = asRecord(admittedTemplate.response.body);
            const admittedBusinessCode = asInteger(admittedResponseRecord?.code);
            if (admittedTemplate.status >= 400 || admittedBusinessCode !== 0) {
                const failure = inferFailure(admittedTemplate.status, admittedTemplate.response.body);
                return {
                    status: "miss",
                    failureReason: "rejected_source",
                    detailReason: BACKEND_REJECTED_SOURCE_REASONS.has(failure.reason)
                        ? failure.reason
                        : "TARGET_API_RESPONSE_INVALID",
                    detailMessage: failure.message,
                    statusCode: admittedTemplate.status,
                    ...(admittedBusinessCode !== null ? { platformCode: admittedBusinessCode } : {}),
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys,
                    observedAt: admittedTemplate.observed_at ?? admittedTemplate.captured_at,
                    diagnostics
                };
            }
            const observedAt = admittedTemplate.observed_at ?? admittedTemplate.captured_at;
            if (env.now() - observedAt > REQUEST_CONTEXT_FRESHNESS_WINDOW_MS) {
                return {
                    status: "miss",
                    failureReason: "template_stale",
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys,
                    observedAt,
                    diagnostics
                };
            }
            return {
                status: "hit",
                template: {
                    request: {
                        url: templateUrl,
                        headers: admittedTemplate.request.headers,
                        body: admittedTemplate.request.body
                    },
                    response: {
                        body: admittedTemplate.response.body
                    },
                    referrer: typeof admittedTemplate.referrer === "string" ? admittedTemplate.referrer : null,
                    capturedAt: admittedTemplate.captured_at,
                    pageContextNamespace
                },
                pageContextNamespace,
                shapeKey
            };
        }
        if (rejectedObservation) {
            if (input?.deferTransientMisses === true &&
                isTransientFailedRequestObservation(rejectedObservation)) {
                const rejectedDetail = resolveRejectedSourceDetail(rejectedObservation);
                return {
                    status: "miss",
                    failureReason: "template_missing",
                    detailReason: rejectedDetail.reason,
                    detailMessage: rejectedDetail.message,
                    statusCode: rejectedDetail.statusCode,
                    platformCode: rejectedDetail.platformCode,
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys,
                    observedAt: rejectedObservation.observed_at ?? rejectedObservation.captured_at,
                    diagnostics
                };
            }
            const rejectedDetail = resolveRejectedSourceDetail(rejectedObservation);
            return {
                status: "miss",
                failureReason: "rejected_source",
                detailReason: rejectedDetail.reason,
                detailMessage: rejectedDetail.message,
                statusCode: rejectedDetail.statusCode,
                platformCode: rejectedDetail.platformCode,
                pageContextNamespace,
                shapeKey,
                availableShapeKeys,
                observedAt: rejectedObservation.observed_at ?? rejectedObservation.captured_at,
                diagnostics
            };
        }
        if (incompatibleObservation || siblingShapeKeys.length > 0) {
            if (input?.deferTransientMisses === true) {
                return {
                    status: "miss",
                    failureReason: "template_missing",
                    pageContextNamespace,
                    shapeKey,
                    availableShapeKeys: siblingShapeKeys,
                    observedAt: incompatibleObservation?.observed_at ?? incompatibleObservation?.captured_at ?? undefined,
                    diagnostics
                };
            }
            return {
                status: "miss",
                failureReason: "shape_mismatch",
                pageContextNamespace,
                shapeKey,
                availableShapeKeys: siblingShapeKeys,
                observedAt: incompatibleObservation?.observed_at ?? incompatibleObservation?.captured_at ?? undefined,
                diagnostics
            };
        }
        return {
            status: "miss",
            failureReason: "template_missing",
            pageContextNamespace,
            shapeKey,
            availableShapeKeys,
            diagnostics
        };
    };
    const maxAttempts = requestInput.failFastOnMiss === true
        ? 1
        : resolveRequestContextWaitMaxAttempts(requestInput.options, requestInput.elapsedBeforeWaitMs);
    let lastState = await lookupOnce({
        deferTransientMisses: maxAttempts > 1
    });
    for (let attempt = 1; attempt < maxAttempts &&
        lastState.status === "miss" &&
        lastState.failureReason === "template_missing"; attempt += 1) {
        await waitForRequestContextRetry(env, REQUEST_CONTEXT_WAIT_RETRY_MS);
        lastState = await lookupOnce({
            deferTransientMisses: attempt + 1 < maxAttempts
        });
    }
    return lastState;
};
const resolveDebuggerNetworkRequestContextState = (input) => {
    const debuggerAction = asRecord(input.passiveActionEvidence?.debugger_action);
    const context = asRecord(debuggerAction?.debugger_network_context);
    if (!context || context.source !== "chrome_debugger_network") {
        return null;
    }
    const request = asRecord(context.request);
    const response = asRecord(context.response);
    const requestBody = asRecord(request?.body);
    const responseBody = asRecord(response?.body);
    const url = asString(context.url);
    const status = asInteger(context.status);
    const capturedAt = asInteger(context.captured_at) ?? input.now;
    if (!url ||
        status === null ||
        status >= 400 ||
        asString(requestBody?.keyword) !== input.query ||
        asInteger(responseBody?.code) !== 0) {
        return null;
    }
    return {
        status: "hit",
        template: {
            request: {
                url,
                headers: asRecord(request?.headers) ?? {},
                body: request?.body ?? null
            },
            response: {
                body: response?.body ?? null
            },
            referrer: input.pageUrl,
            capturedAt,
            pageContextNamespace: input.pageContextNamespace
        },
        pageContextNamespace: input.pageContextNamespace,
        shapeKey: input.shapeKey
    };
};
const describePassiveActionEvidenceForDiagnosis = (passiveActionEvidence) => {
    if (!passiveActionEvidence) {
        return ["humanized_action=null"];
    }
    const actionKind = asString(passiveActionEvidence.action_kind);
    const error = asString(passiveActionEvidence.error);
    const debuggerAction = asRecord(passiveActionEvidence.debugger_action);
    const debuggerError = asRecord(debuggerAction?.error);
    const debuggerErrorString = asString(debuggerAction?.error);
    const summarizeValue = (key) => {
        const value = passiveActionEvidence[key];
        if (typeof value === "boolean" || typeof value === "number") {
            return `${key}:${String(value)}`;
        }
        if (typeof value === "string" && value.length > 0) {
            return `${key}:${value}`;
        }
        return null;
    };
    const actionSummary = [
        "submit_triggered",
        "same_query_preflight_submit_triggered",
        "same_query_preflight_mode",
        "same_query_preflight_state_change_source",
        "same_query_search_input_refresh_source",
        "search_input_found",
        "query_matched",
        "same_query_input_matched",
        "same_query_perturbed",
        "same_query_preflight_submitted",
        "same_query_search_input_refreshed",
        "search_form_found",
        "search_button_found"
    ]
        .map((key) => summarizeValue(key))
        .filter((entry) => typeof entry === "string")
        .join(",");
    return [
        actionKind ? `humanized_action_kind=${actionKind}` : "humanized_action_kind=unknown",
        error ? `humanized_action_error=${error}` : null,
        asString(debuggerError?.code) ? `debugger_action_error_code=${asString(debuggerError?.code)}` : null,
        asString(debuggerError?.message)
            ? `debugger_action_error_message=${asString(debuggerError?.message)}`
            : null,
        debuggerErrorString ? `debugger_action_error=${debuggerErrorString}` : null,
        debuggerAction ? `debugger_action=${JSON.stringify(debuggerAction)}` : null,
        actionSummary ? `humanized_action_summary=${actionSummary}` : null,
        `humanized_action=${JSON.stringify(passiveActionEvidence)}`
    ].filter((entry) => typeof entry === "string");
};
const executeXhsSearch = async (input, env) => {
    const executionStartedAt = env.now();
    const gate = resolveGate(input.options, input.executionContext, env.getLocationHref());
    const auditRecord = createAuditRecord(input.executionContext, gate, env);
    let layer2Interaction = buildXhsSearchLayer2InteractionEvidence({
        writeInteractionTierName: gate.write_action_matrix_decisions?.write_interaction_tier ?? null,
        requestedExecutionMode: input.options.requested_execution_mode,
        recoveryProbe: input.options.xhs_recovery_probe === true
    });
    const startedAt = env.now();
    if (gate.consumer_gate_result.gate_decision === "blocked") {
        return withLayer2InteractionInPayload(withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "执行模式门禁阻断了当前 xhs.search 请求", {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "EXECUTION_MODE_GATE_BLOCKED",
            ...(asRecord(input.options.account_safety_gate_result)
                ? {
                    account_safety_gate_result: asRecord(input.options.account_safety_gate_result) ?? {}
                }
                : {})
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "EXECUTION_MODE_GATE_BLOCKED",
            failureSite: {
                stage: "execution",
                component: "gate",
                target: "requested_execution_mode",
                summary: "执行模式门禁阻断"
            }
        }), createDiagnosis({
            reason: "EXECUTION_MODE_GATE_BLOCKED",
            summary: "执行模式门禁阻断"
        }), gate, auditRecord), gate.execution_audit), layer2Interaction);
    }
    if (input.options.issue_scope === "issue_755" &&
        input.options.discovery_action === "media_upload_path" &&
        input.options.target_page === "creator_publish_tab" &&
        (gate.consumer_gate_result.effective_execution_mode === "dry_run" ||
            gate.consumer_gate_result.effective_execution_mode === "recon")) {
        const mediaUploadDiscovery = env.performMediaUploadDiscovery
            ? await env.performMediaUploadDiscovery({
                source_media_ref: input.params.source_media_ref,
                source_media_digest: input.params.source_media_digest,
                source_media_kind: input.params.source_media_kind,
                run_id: input.executionContext.runId,
                profile_ref: input.options.__runtime_profile_ref ?? null,
                target_tab_id: gate.consumer_gate_result.target_tab_id,
                page_url: env.getLocationHref()
            })
            : buildXhsMediaUploadDiscoveryResult({
                source_media_ref: input.params.source_media_ref,
                source_media_digest: input.params.source_media_digest,
                source_media_kind: input.params.source_media_kind,
                run_id: input.executionContext.runId,
                profile_ref: input.options.__runtime_profile_ref ?? null,
                target_tab_id: gate.consumer_gate_result.target_tab_id,
                page_url: env.getLocationHref()
            });
        return {
            ok: true,
            payload: {
                summary: {
                    capability_result: {
                        ability_id: input.abilityId,
                        layer: input.abilityLayer,
                        action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                        outcome: "partial",
                        data_ref: {
                            target_page: "creator_publish_tab",
                            discovery_action: "media_upload_path"
                        },
                        metrics: {
                            duration_ms: Math.max(0, env.now() - startedAt)
                        }
                    },
                    scope_context: gate.scope_context,
                    gate_input: {
                        run_id: auditRecord.run_id,
                        session_id: auditRecord.session_id,
                        profile: auditRecord.profile,
                        ...gate.gate_input
                    },
                    gate_outcome: gate.gate_outcome,
                    read_execution_policy: gate.read_execution_policy,
                    issue_action_matrix: gate.issue_action_matrix,
                    write_interaction_tier: gate.write_interaction_tier,
                    write_action_matrix_decisions: gate.write_action_matrix_decisions,
                    consumer_gate_result: gate.consumer_gate_result,
                    request_admission_result: gate.request_admission_result,
                    execution_audit: gate.execution_audit,
                    approval_record: gate.approval_record,
                    risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                    audit_record: auditRecord,
                    ...layer2InteractionSummary(layer2Interaction),
                    media_upload_discovery: mediaUploadDiscovery,
                    upload_path_catalog: mediaUploadDiscovery.upload_path_catalog,
                    controlled_upload_evidence: mediaUploadDiscovery.controlled_upload_evidence,
                    controlled_upload_evaluation: mediaUploadDiscovery.controlled_upload_evaluation
                },
                observability: createObservability({
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId: `req-${env.randomId()}`,
                    outcome: "completed",
                    includeKeyRequest: false
                })
            }
        };
    }
    if (gate.consumer_gate_result.effective_execution_mode === "dry_run" ||
        gate.consumer_gate_result.effective_execution_mode === "recon") {
        return withLayer2InteractionInSuccessPayload(createGateOnlySuccess(input, gate, auditRecord, env), layer2Interaction);
    }
    if (input.options.issue_scope === "issue_835" &&
        input.options.controlled_live_write === true &&
        input.options.target_page === "creator_publish_tab" &&
        gate.consumer_gate_result.effective_execution_mode === "live_write") {
        const publishVisibilityScope = input.options.publish_visibility_scope === "private_or_self_visible" ||
            input.options.publish_visibility_scope === "limited_test_visibility" ||
            input.options.publish_visibility_scope === "public_visible"
            ? input.options.publish_visibility_scope
            : null;
        const cleanupPolicyRef = typeof input.options.cleanup_policy_ref === "string" &&
            input.options.cleanup_policy_ref.trim().length > 0
            ? input.options.cleanup_policy_ref.trim()
            : null;
        const liveWriteAttemptId = typeof input.params.live_write_attempt_id === "string" &&
            input.params.live_write_attempt_id.trim().length > 0
            ? input.params.live_write_attempt_id.trim()
            : `fr0032-attempt-${input.executionContext.runId}`;
        const sourceMediaRef = typeof input.params.source_media_ref === "string" ? input.params.source_media_ref : "";
        const sourceMediaDigest = typeof input.params.source_media_digest === "string" ? input.params.source_media_digest : "";
        const sourceMediaKind = input.params.source_media_kind === "video" || input.params.source_media_kind === "mixed"
            ? input.params.source_media_kind
            : "image";
        if (!publishVisibilityScope || !cleanupPolicyRef) {
            return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "FR-0032 controlled live write policy missing", {
                ability_id: input.abilityId,
                stage: "execution",
                reason: "FR0032_LIVE_WRITE_POLICY_MISSING"
            }, createObservability({
                href: env.getLocationHref(),
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "failed",
                failureReason: "FR0032_LIVE_WRITE_POLICY_MISSING",
                failureSite: {
                    stage: "execution",
                    component: "policy",
                    target: "publish_visibility_scope.cleanup_policy_ref",
                    summary: "FR-0032 publish visibility scope and cleanup policy are required"
                }
            }), createDiagnosis({
                reason: "FR0032_LIVE_WRITE_POLICY_MISSING",
                summary: "publish visibility scope and cleanup policy are required before live write",
                category: "request_failed"
            }), gate, auditRecord), gate.execution_audit);
        }
        const controlledLiveWriteInput = {
            live_write_attempt_id: liveWriteAttemptId,
            source_media_ref: sourceMediaRef,
            source_media_digest: sourceMediaDigest,
            source_media_kind: sourceMediaKind,
            publish_visibility_scope: publishVisibilityScope,
            cleanup_policy_ref: cleanupPolicyRef,
            run_id: input.executionContext.runId,
            profile_ref: input.options.__runtime_profile_ref ?? null,
            target_tab_id: gate.consumer_gate_result.target_tab_id,
            page_url: env.getLocationHref(),
            latest_head_sha: typeof input.options.__runtime_latest_head_sha === "string"
                ? input.options.__runtime_latest_head_sha
                : null,
            accepted_upload_artifact_identity: typeof input.params.accepted_upload_artifact_identity === "object" &&
                input.params.accepted_upload_artifact_identity !== null &&
                !Array.isArray(input.params.accepted_upload_artifact_identity)
                ? input.params.accepted_upload_artifact_identity
                : null,
            background_upload_capture_continuation: input.params.background_upload_capture_continuation === true
        };
        const controlledLiveWriteResult = env.performControlledLiveWrite
            ? await env.performControlledLiveWrite(controlledLiveWriteInput)
            : buildXhsControlledLiveWriteUnavailableResult(controlledLiveWriteInput);
        const liveWriteEvaluation = asRecord(controlledLiveWriteResult.live_write_evaluation);
        const fullLiveWriteSuccess = liveWriteEvaluation?.full_live_write_success === true;
        const outcome = fullLiveWriteSuccess ? "success" : "partial";
        return {
            ok: true,
            payload: {
                summary: {
                    capability_result: {
                        ability_id: input.abilityId,
                        layer: input.abilityLayer,
                        action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                        outcome,
                        data_ref: {
                            target_page: "creator_publish_tab",
                            live_write_attempt_id: liveWriteAttemptId
                        },
                        metrics: {
                            duration_ms: Math.max(0, env.now() - startedAt)
                        }
                    },
                    scope_context: gate.scope_context,
                    gate_input: {
                        run_id: auditRecord.run_id,
                        session_id: auditRecord.session_id,
                        profile: auditRecord.profile,
                        ...gate.gate_input
                    },
                    gate_outcome: gate.gate_outcome,
                    read_execution_policy: gate.read_execution_policy,
                    issue_action_matrix: gate.issue_action_matrix,
                    write_interaction_tier: gate.write_interaction_tier,
                    write_action_matrix_decisions: gate.write_action_matrix_decisions,
                    consumer_gate_result: gate.consumer_gate_result,
                    request_admission_result: gate.request_admission_result,
                    execution_audit: gate.execution_audit,
                    approval_record: gate.approval_record,
                    risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                    audit_record: auditRecord,
                    ...layer2InteractionSummary(layer2Interaction),
                    controlled_live_write: controlledLiveWriteResult,
                    live_write_evidence: controlledLiveWriteResult.live_write_evidence,
                    live_write_evaluation: controlledLiveWriteResult.live_write_evaluation
                },
                observability: createObservability({
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId: `req-${env.randomId()}`,
                    outcome: fullLiveWriteSuccess ? "completed" : "failed",
                    failureReason: fullLiveWriteSuccess ? undefined : "FR0032_CONTROLLED_LIVE_WRITE_INCOMPLETE",
                    includeKeyRequest: false
                })
            }
        };
    }
    if (input.options.validation_action === "editor_input" &&
        input.options.issue_scope === "issue_208" &&
        input.options.action_type === "write" &&
        input.options.requested_execution_mode === "live_write") {
        const validationText = typeof input.options.validation_text === "string" && input.options.validation_text.trim().length > 0
            ? input.options.validation_text.trim()
            : "WebEnvoy editor_input validation";
        const focusAttestation = input.options.editor_focus_attestation ?? null;
        let validationResult;
        if (env.performEditorInputValidation) {
            try {
                validationResult = await env.performEditorInputValidation({
                    text: validationText,
                    focusAttestation: focusAttestation
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "editor_input 真实验证失败", {
                    ability_id: input.abilityId,
                    stage: "execution",
                    reason: "EDITOR_INPUT_VALIDATION_FAILED",
                    validation_exception: message
                }, createObservability({
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId: `req-${env.randomId()}`,
                    outcome: "failed",
                    failureReason: message,
                    failureSite: {
                        stage: "execution",
                        component: "page",
                        target: "editor_input",
                        summary: message || "editor_input validation failed"
                    }
                }), createDiagnosis({
                    reason: "EDITOR_INPUT_VALIDATION_FAILED",
                    summary: message || "editor_input validation failed",
                    category: "page_changed"
                }), gate, auditRecord), gate.execution_audit);
            }
        }
        else {
            validationResult = {
                ok: false,
                mode: "dom_editor_input_validation",
                attestation: "dom_self_certified",
                editor_locator: null,
                input_text: validationText,
                before_text: "",
                visible_text: "",
                post_blur_text: "",
                focus_confirmed: false,
                focus_attestation_source: null,
                focus_attestation_reason: null,
                preserved_after_blur: false,
                success_signals: [],
                failure_signals: ["missing_focus_attestation", "dom_variant"],
                minimum_replay: ["enter_editable_mode", "focus_editor", "type_short_text", "blur_or_reobserve"]
            };
        }
        if (!isTrustedEditorInputValidation(validationResult)) {
            return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "editor_input 真实验证失败", {
                ability_id: input.abilityId,
                stage: "execution",
                reason: "EDITOR_INPUT_VALIDATION_FAILED",
                ...buildEditorInputEvidence(validationResult)
            }, createObservability({
                href: env.getLocationHref(),
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "failed",
                failureReason: "EDITOR_INPUT_VALIDATION_FAILED",
                failureSite: {
                    stage: "execution",
                    component: "page",
                    target: validationResult.editor_locator ?? "editor_input",
                    summary: validationResult.failure_signals[0] ?? "editor_input validation failed"
                }
            }), createDiagnosis({
                reason: "EDITOR_INPUT_VALIDATION_FAILED",
                summary: validationResult.failure_signals[0] ?? "editor_input validation failed",
                category: "page_changed"
            }), gate, auditRecord), gate.execution_audit);
        }
        const editorInputEvidence = buildEditorInputEvidence(validationResult);
        const editorTextWriteResult = input.options.editor_text_write === true
            ? {
                ...editorInputEvidence,
                write_action: "editor_text_write",
                submitted: false,
                published: false
            }
            : null;
        return {
            ok: true,
            payload: {
                summary: {
                    capability_result: {
                        ability_id: input.abilityId,
                        layer: input.abilityLayer,
                        action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                        outcome: "success",
                        data_ref: {
                            validation_action: "editor_input"
                        },
                        metrics: {
                            duration_ms: Math.max(0, env.now() - startedAt)
                        }
                    },
                    scope_context: gate.scope_context,
                    gate_input: {
                        run_id: auditRecord.run_id,
                        session_id: auditRecord.session_id,
                        profile: auditRecord.profile,
                        ...gate.gate_input
                    },
                    gate_outcome: gate.gate_outcome,
                    read_execution_policy: gate.read_execution_policy,
                    issue_action_matrix: gate.issue_action_matrix,
                    write_interaction_tier: gate.write_interaction_tier,
                    write_action_matrix_decisions: gate.write_action_matrix_decisions,
                    consumer_gate_result: gate.consumer_gate_result,
                    request_admission_result: gate.request_admission_result,
                    execution_audit: gate.execution_audit,
                    approval_record: gate.approval_record,
                    risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                    audit_record: auditRecord,
                    ...layer2InteractionSummary(layer2Interaction),
                    interaction_result: editorInputEvidence,
                    ...(editorTextWriteResult ? { text_write_result: editorTextWriteResult } : {})
                },
                observability: createObservability({
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId: `req-${env.randomId()}`,
                    outcome: "completed"
                })
            }
        };
    }
    const simulated = resolveSimulatedResult(input.options.simulate_result, input.params, input.options, env);
    if (simulated && !simulated.ok) {
        return {
            ...simulated,
            payload: {
                ...simulated.payload,
                details: {
                    ability_id: input.abilityId,
                    ...(asRecord(simulated.payload.details) ?? {})
                },
                read_execution_policy: gate.read_execution_policy,
                issue_action_matrix: gate.issue_action_matrix,
                consumer_gate_result: gate.consumer_gate_result,
                request_admission_result: gate.request_admission_result,
                execution_audit: gate.execution_audit,
                approval_record: gate.approval_record,
                audit_record: auditRecord
            }
        };
    }
    const accountSafetySurface = classifyXhsAccountSafetySurface({
        href: env.getLocationHref(),
        title: env.getDocumentTitle(),
        bodyText: env.getBodyText?.(),
        overlay: env.getAccountSafetyOverlay?.()
    });
    if (accountSafetySurface) {
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", accountSafetySurface.message, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: accountSafetySurface.reason,
            page_url: env.getLocationHref()
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: accountSafetySurface.reason,
            includeKeyRequest: false,
            failureSite: {
                stage: "action",
                component: "page",
                target: "xhs.account_safety_surface",
                summary: accountSafetySurface.message
            }
        }), createDiagnosis({
            reason: accountSafetySurface.reason,
            summary: accountSafetySurface.message,
            category: "page_changed"
        }), gate, auditRecord), gate.execution_audit);
    }
    if (!containsCookie(env.getCookie(), "a1")) {
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "登录态缺失，无法执行 xhs.search", {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "SESSION_EXPIRED"
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "SESSION_EXPIRED"
        }), createDiagnosis({
            reason: "SESSION_EXPIRED",
            summary: "登录态缺失，无法执行 xhs.search"
        }), gate, auditRecord), gate.execution_audit);
    }
    const providerAwareReadPathBlock = isProviderAwareLiveReadGate(gate)
        ? resolveProviderAwareReadPathBlock(input.options, input.executionContext.runId)
        : null;
    if (providerAwareReadPathBlock) {
        const summary = "provider-aware read path readiness denied xhs.search execution";
        return withLayer2InteractionInPayload(withProviderAwareReadPathBlockPayload(withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", summary, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: providerAwareReadPathBlock.reason,
            blocking_reasons: providerAwareReadPathBlock.reasons
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: providerAwareReadPathBlock.reason,
            includeKeyRequest: false,
            failureSite: {
                stage: "execution",
                component: "gate",
                target: "provider_aware_read_path",
                summary
            }
        }), createDiagnosis({
            reason: providerAwareReadPathBlock.reason,
            summary,
            category: "page_changed",
            evidence: providerAwareReadPathBlock.reasons
        }), gate, auditRecord), gate.execution_audit), gate, auditRecord, providerAwareReadPathBlock), layer2Interaction);
    }
    if (simulated) {
        const summary = asRecord(simulated.payload.summary) ?? {};
        const capability = asRecord(summary.capability_result) ?? {};
        capability.ability_id = input.abilityId;
        capability.layer = input.abilityLayer;
        capability.action = gate.consumer_gate_result.action_type ?? input.abilityAction;
        return {
            ok: true,
            payload: {
                ...simulated.payload,
                summary: {
                    capability_result: capability,
                    scope_context: gate.scope_context,
                    gate_input: {
                        run_id: auditRecord.run_id,
                        session_id: auditRecord.session_id,
                        profile: auditRecord.profile,
                        ...gate.gate_input
                    },
                    gate_outcome: gate.gate_outcome,
                    read_execution_policy: gate.read_execution_policy,
                    issue_action_matrix: gate.issue_action_matrix,
                    consumer_gate_result: gate.consumer_gate_result,
                    request_admission_result: gate.request_admission_result,
                    execution_audit: gate.execution_audit,
                    approval_record: gate.approval_record,
                    risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                    audit_record: auditRecord,
                    ...layer2InteractionSummary(layer2Interaction)
                }
            }
        };
    }
    const buildExpectedRequestContextProvenance = () => ({
        profile_ref: input.executionContext.profile,
        session_id: input.executionContext.sessionId,
        target_tab_id: typeof gate.consumer_gate_result.target_tab_id === "number"
            ? gate.consumer_gate_result.target_tab_id
            : null,
        run_id: input.executionContext.runId,
        action_ref: input.abilityAction,
        page_url: env.getLocationHref()
    });
    const createProvenanceUnconfirmedFailure = () => {
        const expectedProvenance = buildExpectedRequestContextProvenance();
        const summary = "当前页面现场的搜索请求来源未完成 provenance 绑定";
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", summary, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "REQUEST_CONTEXT_MISSING",
            request_context_reason: "provenance_unconfirmed",
            page_context_namespace: createPageContextNamespace(env.getLocationHref()),
            profile_ref: expectedProvenance.profile_ref,
            session_id: expectedProvenance.session_id,
            target_tab_id: expectedProvenance.target_tab_id,
            run_id: expectedProvenance.run_id,
            action_ref: expectedProvenance.action_ref,
            page_url: expectedProvenance.page_url
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "REQUEST_CONTEXT_MISSING",
            includeKeyRequest: false,
            failureSite: {
                stage: "action",
                component: "page",
                target: "captured_request_context",
                summary
            }
        }), createDiagnosis({
            reason: "REQUEST_CONTEXT_MISSING",
            summary,
            category: "page_changed"
        }), gate, auditRecord), gate.execution_audit);
    };
    const confirmCurrentRequestContextProvenance = async () => {
        if (typeof env.configureCapturedRequestContextProvenance !== "function") {
            return true;
        }
        const expectedProvenance = buildExpectedRequestContextProvenance();
        const result = await env.configureCapturedRequestContextProvenance({
            page_context_namespace: createPageContextNamespace(env.getLocationHref()),
            ...expectedProvenance,
            ...(input.options.closeout_evidence_evaluation === true ||
                input.options.closeout_audit_required === true
                ? { bind_fresh_window_ms: CLOSEOUT_PROVENANCE_BIND_FRESH_WINDOW_MS }
                : {})
        }).catch(() => null);
        const record = asRecord(result);
        return (record?.configured === true &&
            record.profile_ref === expectedProvenance.profile_ref &&
            record.session_id === expectedProvenance.session_id &&
            (expectedProvenance.target_tab_id === null ||
                record.target_tab_id === expectedProvenance.target_tab_id) &&
            record.run_id === expectedProvenance.run_id &&
            record.action_ref === expectedProvenance.action_ref &&
            record.page_url === expectedProvenance.page_url);
    };
    if (input.options.__request_context_provenance_confirmed === false) {
        return createProvenanceUnconfirmedFailure();
    }
    const payload = {
        keyword: input.params.query,
        page: input.params.page ?? 1,
        page_size: input.params.limit ?? 20,
        search_id: input.params.search_id ?? env.randomId(),
        sort: input.params.sort ?? "general",
        note_type: input.params.note_type ?? 0
    };
    if (input.options.__request_context_provenance_confirmed !== true &&
        !(await confirmCurrentRequestContextProvenance())) {
        return createProvenanceUnconfirmedFailure();
    }
    const closeoutPassiveExactHitOnly = input.options.closeout_evidence_evaluation === true ||
        input.options.closeout_audit_required === true;
    let passiveActionStartedAt = null;
    let passiveActionEvidence = null;
    let requestContextState;
    const closeoutRequestContextHits = [];
    const updateLayer2InteractionFromPassiveAction = () => {
        const actionKind = asString(passiveActionEvidence?.action_kind);
        const passiveActionError = asString(passiveActionEvidence?.error);
        const nextLayer2Interaction = buildXhsSearchLayer2InteractionEvidence({
            writeInteractionTierName: gate.write_action_matrix_decisions?.write_interaction_tier ?? null,
            requestedExecutionMode: input.options.requested_execution_mode,
            recoveryProbe: false,
            humanizedActionKind: actionKind,
            settledWaitResult: passiveActionError ? "timeout" : "settled",
            executionApplied: passiveActionEvidence !== null
        });
        if (nextLayer2Interaction) {
            layer2Interaction = nextLayer2Interaction;
        }
    };
    const rememberCloseoutRequestContextHit = (state) => {
        if (state.status !== "hit") {
            return;
        }
        const key = [
            state.pageContextNamespace,
            state.shapeKey,
            String(state.template.capturedAt)
        ].join("\n");
        if (closeoutRequestContextHits.some((candidate) => [
            candidate.pageContextNamespace,
            candidate.shapeKey,
            String(candidate.template.capturedAt)
        ].join("\n") === key)) {
            return;
        }
        closeoutRequestContextHits.push(state);
    };
    const runCloseoutPassiveRound = async () => {
        passiveActionStartedAt = env.now();
        passiveActionEvidence = await performSearchPassiveAction(input, env);
        updateLayer2InteractionFromPassiveAction();
        if (!(await confirmCurrentRequestContextProvenance())) {
            return {
                status: "miss",
                failureReason: "template_missing",
                pageContextNamespace: createPageContextNamespace(env.getLocationHref()),
                shapeKey: "",
                availableShapeKeys: [],
                diagnostics: {
                    provenance_reconfirm_failed: true
                }
            };
        }
        const state = await resolveRequestContextState({
            params: input.params,
            options: input.options,
            minObservedAt: passiveActionStartedAt,
            elapsedBeforeWaitMs: env.now() - executionStartedAt,
            expectedProvenance: buildExpectedRequestContextProvenance()
        }, env);
        const resolvedState = state.status !== "hit"
            ? resolveDebuggerNetworkRequestContextState({
                passiveActionEvidence: passiveActionEvidence
                    ? passiveActionEvidence
                    : null,
                query: input.params.query,
                pageContextNamespace: state.pageContextNamespace,
                shapeKey: state.shapeKey,
                now: env.now(),
                pageUrl: env.getLocationHref()
            }) ?? state
            : state;
        rememberCloseoutRequestContextHit(resolvedState);
        return resolvedState;
    };
    if (closeoutPassiveExactHitOnly) {
        requestContextState = await resolveRequestContextState({
            params: input.params,
            options: input.options,
            minObservedAt: null,
            elapsedBeforeWaitMs: env.now() - executionStartedAt,
            expectedProvenance: buildExpectedRequestContextProvenance(),
            failFastOnMiss: true
        }, env);
        if (requestContextState.status === "hit") {
            rememberCloseoutRequestContextHit(requestContextState);
            passiveActionEvidence = {
                evidence_class: "humanized_action",
                action_kind: "existing_passive_exact_hit",
                action_ref: input.executionContext.gateInvocationId ?? input.executionContext.runId,
                run_id: input.executionContext.runId,
                page_url: env.getLocationHref(),
                query: input.params.query,
                skipped_reason: "closeout_passive_exact_hit_already_available",
                trigger_surface: "xhs.search_result"
            };
        }
        const nextContextState = await runCloseoutPassiveRound();
        if (nextContextState.status === "hit" || requestContextState.status !== "hit") {
            requestContextState = nextContextState;
        }
        if (closeoutRequestContextHits.length === 1 && requestContextState.status === "hit") {
            const retryContextState = await runCloseoutPassiveRound();
            if (retryContextState.status === "hit" || requestContextState.status !== "hit") {
                requestContextState = retryContextState;
            }
        }
    }
    else {
        passiveActionStartedAt = env.now();
        passiveActionEvidence = await performSearchPassiveAction(input, env);
        updateLayer2InteractionFromPassiveAction();
        if (!(await confirmCurrentRequestContextProvenance())) {
            return createProvenanceUnconfirmedFailure();
        }
        requestContextState = await resolveRequestContextState({
            params: input.params,
            options: input.options,
            minObservedAt: passiveActionEvidence ? passiveActionStartedAt : null,
            elapsedBeforeWaitMs: env.now() - executionStartedAt,
            expectedProvenance: buildExpectedRequestContextProvenance()
        }, env);
    }
    if (requestContextState.status !== "hit") {
        requestContextState =
            resolveDebuggerNetworkRequestContextState({
                passiveActionEvidence: passiveActionEvidence ? passiveActionEvidence : null,
                query: input.params.query,
                pageContextNamespace: requestContextState.pageContextNamespace,
                shapeKey: requestContextState.shapeKey,
                now: env.now(),
                pageUrl: env.getLocationHref()
            }) ?? requestContextState;
    }
    if (requestContextState.status !== "hit") {
        const backendRejectedReason = requestContextState.detailReason &&
            BACKEND_REJECTED_SOURCE_REASONS.has(requestContextState.detailReason)
            ? requestContextState.detailReason
            : null;
        const reason = backendRejectedReason ??
            (requestContextState.failureReason === "shape_mismatch" ||
                requestContextState.failureReason === "rejected_source"
                ? "REQUEST_CONTEXT_INCOMPATIBLE"
                : "REQUEST_CONTEXT_MISSING");
        const summaryMap = {
            template_missing: "当前页面现场缺少可复用的搜索请求模板",
            template_stale: "当前页面现场的搜索请求模板已过期",
            shape_mismatch: "当前页面现场存在不同 shape 的搜索请求模板",
            rejected_source: "当前页面现场的搜索请求来源已被拒绝"
        };
        const summary = requestContextState.detailMessage ?? summaryMap[requestContextState.failureReason];
        const isBackendRejectedSource = backendRejectedReason !== null;
        if (requestContextState.failureReason === "rejected_source") {
            return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", summary, {
                ability_id: input.abilityId,
                stage: "execution",
                reason,
                request_context_reason: requestContextState.failureReason,
                page_context_namespace: requestContextState.pageContextNamespace,
                shape_key: requestContextState.shapeKey,
                available_shape_keys: requestContextState.availableShapeKeys,
                ...(requestContextState.diagnostics
                    ? { request_context_diagnostics: requestContextState.diagnostics }
                    : {}),
                ...(requestContextState.statusCode !== undefined
                    ? { status_code: requestContextState.statusCode }
                    : {}),
                ...(requestContextState.platformCode !== undefined
                    ? { platform_code: requestContextState.platformCode }
                    : {}),
                ...(backendRejectedReason ? { rejected_source_reason: backendRejectedReason } : {}),
                ...(requestContextState.observedAt !== undefined
                    ? { observed_at: requestContextState.observedAt }
                    : {})
            }, createObservability({
                href: env.getLocationHref(),
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "failed",
                ...(requestContextState.statusCode !== undefined
                    ? { statusCode: requestContextState.statusCode }
                    : {}),
                failureReason: reason,
                includeKeyRequest: false,
                failureSite: {
                    stage: "action",
                    component: "page",
                    target: isBackendRejectedSource ? SEARCH_ENDPOINT : "captured_request_context",
                    summary
                }
            }), createDiagnosis({
                reason,
                summary,
                category: isBackendRejectedSource ? "request_failed" : "page_changed"
            }), gate, auditRecord), gate.execution_audit);
        }
        if (!closeoutPassiveExactHitOnly) {
            const domExtraction = isCurrentSearchPageForQuery(env.getLocationHref(), input.params.query)
                ? await resolveSearchDomExtraction(env)
                : null;
            if (domExtraction) {
                const count = domExtraction.cards.length;
                const extractedAt = toIsoString(env.now());
                const targetTabId = gate.consumer_gate_result.target_tab_id;
                const actionRef = input.executionContext.gateInvocationId ?? input.executionContext.runId;
                const domPageStateFallbackEvidence = buildSearchDomPageStateFallbackEvidence({
                    extraction: domExtraction,
                    fallbackReason: requestContextState.failureReason,
                    pageUrl: env.getLocationHref(),
                    runId: input.executionContext.runId,
                    profileRef: input.executionContext.profile,
                    sessionId: input.executionContext.sessionId,
                    targetTabId,
                    actionRef,
                    query: input.params.query,
                    extractedAt
                });
                return {
                    ok: true,
                    payload: {
                        summary: {
                            capability_result: {
                                ability_id: input.abilityId,
                                layer: input.abilityLayer,
                                action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                                outcome: "success",
                                data_ref: {
                                    query: input.params.query
                                },
                                metrics: {
                                    count,
                                    duration_ms: Math.max(0, env.now() - startedAt)
                                }
                            },
                            scope_context: gate.scope_context,
                            gate_input: {
                                run_id: auditRecord.run_id,
                                session_id: auditRecord.session_id,
                                profile: auditRecord.profile,
                                ...gate.gate_input
                            },
                            gate_outcome: gate.gate_outcome,
                            read_execution_policy: gate.read_execution_policy,
                            issue_action_matrix: gate.issue_action_matrix,
                            consumer_gate_result: gate.consumer_gate_result,
                            request_admission_result: gate.request_admission_result,
                            execution_audit: gate.execution_audit,
                            approval_record: gate.approval_record,
                            risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                            audit_record: auditRecord,
                            ...buildProviderAwareReadPathSummaryFields(input.options),
                            ...layer2InteractionSummary(layer2Interaction),
                            dom_page_state_fallback_evidence: domPageStateFallbackEvidence,
                            route_evidence: {
                                ...domPageStateFallbackEvidence,
                                evidence_class: "dom_state_extraction",
                                profile_ref: input.executionContext.profile,
                                target_tab_id: targetTabId,
                                page_url: env.getLocationHref(),
                                run_id: input.executionContext.runId,
                                action_ref: actionRef,
                                extraction_layer: domExtraction.extraction_layer,
                                extraction_locator: domExtraction.extraction_locator,
                                extracted_at: extractedAt,
                                target_continuity: buildSearchTargetContinuity(domExtraction.cards),
                                risk_surface_classification: "none",
                                ...(passiveActionEvidence ? { humanized_action: passiveActionEvidence } : {}),
                                item_kind: "search_card",
                                cards: domExtraction.cards
                            },
                            request_context: {
                                status: "missing",
                                reason: requestContextState.failureReason,
                                page_context_namespace: requestContextState.pageContextNamespace,
                                shape_key: requestContextState.shapeKey,
                                available_shape_keys: requestContextState.availableShapeKeys,
                                ...(requestContextState.diagnostics
                                    ? { diagnostics: requestContextState.diagnostics }
                                    : {})
                            }
                        },
                        observability: createObservability({
                            href: env.getLocationHref(),
                            title: env.getDocumentTitle(),
                            readyState: env.getReadyState(),
                            requestId: `req-${env.randomId()}`,
                            outcome: "completed",
                            includeKeyRequest: false
                        })
                    }
                };
            }
        }
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", summary, {
            ability_id: input.abilityId,
            stage: "execution",
            reason,
            request_context_reason: requestContextState.failureReason,
            page_context_namespace: requestContextState.pageContextNamespace,
            shape_key: requestContextState.shapeKey,
            available_shape_keys: requestContextState.availableShapeKeys,
            ...(requestContextState.diagnostics
                ? { request_context_diagnostics: requestContextState.diagnostics }
                : {}),
            ...(requestContextState.detailReason
                ? { rejected_source_reason: requestContextState.detailReason }
                : {}),
            ...(typeof requestContextState.statusCode === "number"
                ? { status_code: requestContextState.statusCode }
                : {}),
            ...(typeof requestContextState.platformCode === "number"
                ? { platform_code: requestContextState.platformCode }
                : {}),
            ...(typeof requestContextState.observedAt === "number"
                ? { request_context_observed_at: requestContextState.observedAt }
                : {}),
            ...(passiveActionEvidence ? { humanized_action: passiveActionEvidence } : {})
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: reason,
            includeKeyRequest: isBackendRejectedSource,
            statusCode: requestContextState.statusCode,
            failureSite: {
                stage: isBackendRejectedSource ? "request" : "action",
                component: isBackendRejectedSource ? "network" : "page",
                target: isBackendRejectedSource ? SEARCH_ENDPOINT : "captured_request_context",
                summary
            }
        }), createDiagnosis({
            reason,
            summary,
            category: isBackendRejectedSource ? "request_failed" : "page_changed",
            evidence: [
                ...describePassiveActionEvidenceForDiagnosis(passiveActionEvidence ? passiveActionEvidence : null),
                `request_context_reason=${requestContextState.failureReason}`,
                `request_context_available_shape_key_count=${requestContextState.availableShapeKeys.length}`,
                `request_context_available_shape_keys=${requestContextState.availableShapeKeys.join("|")}`,
                `request_context_shape_key=${requestContextState.shapeKey}`
            ]
        }), gate, auditRecord), gate.execution_audit);
    }
    const headers = {
        ...requestContextState.template.request.headers
    };
    const capturedRequestBody = asRecord(requestContextState.template.request.body);
    if (!capturedRequestBody) {
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "当前页面现场缺少可复用的搜索请求模板", {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "REQUEST_CONTEXT_MISSING",
            request_context_reason: "template_missing",
            page_context_namespace: requestContextState.pageContextNamespace,
            shape_key: requestContextState.shapeKey,
            available_shape_keys: []
        }, createObservability({
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "REQUEST_CONTEXT_MISSING",
            includeKeyRequest: false,
            failureSite: {
                stage: "action",
                component: "page",
                target: "captured_request_context",
                summary: "当前页面现场缺少可复用的搜索请求模板"
            }
        }), createDiagnosis({
            reason: "REQUEST_CONTEXT_MISSING",
            summary: "当前页面现场缺少可复用的搜索请求模板"
        }), gate, auditRecord), gate.execution_audit);
    }
    const passiveCards = collectSearchDomCards(requestContextState.template.response.body);
    const passiveTargetContinuity = passiveCards.length > 0
        ? buildSearchTargetContinuity(passiveCards)
        : [
            {
                target_url: env.getLocationHref(),
                xsec_token: null,
                xsec_source: null,
                token_presence: "missing",
                source_route: "xhs.search"
            }
        ];
    const count = parseCount(requestContextState.template.response.body);
    const pageUrl = env.getLocationHref();
    const capturedAt = requestContextState.template.capturedAt;
    const targetTabId = typeof input.options.actual_target_tab_id === "number"
        ? input.options.actual_target_tab_id
        : typeof input.options.target_tab_id === "number"
            ? input.options.target_tab_id
            : gate.consumer_gate_result.target_tab_id;
    const closeoutRoundHits = closeoutPassiveExactHitOnly && closeoutRequestContextHits.length > 0
        ? closeoutRequestContextHits
        : [requestContextState];
    const reproducedMultiRound = closeoutRoundHits.length >= 2;
    const routeEvidence = {
        route: "xhs.search.api",
        route_role: "primary",
        path_kind: "api",
        evidence_status: "success",
        evidence_class: "passive_api_capture",
        route_evidence_class: "passive_api_capture",
        source_kind: "page_request",
        method: "POST",
        endpoint: SEARCH_ENDPOINT,
        request_url: requestContextState.template.request.url,
        status_code: 200,
        head_sha: asString(input.options.__runtime_latest_head_sha),
        run_id: input.executionContext.runId,
        artifact_identity: buildSearchPassiveApiCaptureArtifactIdentity({
            runId: input.executionContext.runId,
            pageContextNamespace: requestContextState.pageContextNamespace,
            shapeKey: requestContextState.shapeKey,
            capturedAt
        }),
        profile_ref: input.executionContext.profile,
        session_id: input.executionContext.sessionId,
        target_tab_id: targetTabId,
        page_url: pageUrl,
        action_ref: input.abilityAction,
        observed_at: capturedAt,
        captured_at: capturedAt,
        reproduced_multi_round: reproducedMultiRound,
        page_context_namespace: requestContextState.pageContextNamespace,
        shape_key: requestContextState.shapeKey,
        ...(passiveActionEvidence ? { humanized_action: passiveActionEvidence } : {}),
        target_continuity: passiveTargetContinuity,
        ...(passiveCards.length > 0
            ? {
                item_kind: "search_card",
                cards: passiveCards
            }
            : {})
    };
    const buildCloseoutEvidenceRound = (state) => {
        const roundCapturedAt = state.template.capturedAt;
        return {
            route: routeEvidence.route,
            route_role: routeEvidence.route_role,
            path_kind: routeEvidence.path_kind,
            evidence_status: routeEvidence.evidence_status,
            evidence_class: routeEvidence.evidence_class,
            route_evidence_class: routeEvidence.route_evidence_class,
            source_kind: routeEvidence.source_kind,
            method: routeEvidence.method,
            endpoint: routeEvidence.endpoint,
            request_url: state.template.request.url,
            status_code: routeEvidence.status_code,
            latest_head_sha: routeEvidence.head_sha,
            head_sha: routeEvidence.head_sha,
            run_id: routeEvidence.run_id,
            artifact_identity: buildSearchPassiveApiCaptureArtifactIdentity({
                runId: input.executionContext.runId,
                pageContextNamespace: state.pageContextNamespace,
                shapeKey: state.shapeKey,
                capturedAt: roundCapturedAt
            }),
            profile_ref: routeEvidence.profile_ref,
            session_id: routeEvidence.session_id,
            target_tab_id: routeEvidence.target_tab_id,
            page_url: routeEvidence.page_url,
            action_ref: routeEvidence.action_ref,
            observed_at: roundCapturedAt,
            captured_at: roundCapturedAt,
            reproduced_multi_round: reproducedMultiRound
        };
    };
    const closeoutEvidenceRounds = closeoutRoundHits.map(buildCloseoutEvidenceRound);
    const closeoutArtifactIdentities = closeoutEvidenceRounds
        .map((round) => asString(round.artifact_identity))
        .filter((value) => value !== null);
    const closeoutEvidenceExpected = {
        latest_head_sha: routeEvidence.head_sha,
        run_id: routeEvidence.run_id,
        artifact_identity: routeEvidence.artifact_identity,
        artifact_identities: closeoutArtifactIdentities,
        profile_ref: routeEvidence.profile_ref,
        target_tab_id: routeEvidence.target_tab_id,
        page_url: routeEvidence.page_url,
        action_ref: routeEvidence.action_ref
    };
    return {
        ok: true,
        payload: {
            summary: {
                capability_result: {
                    ability_id: input.abilityId,
                    layer: input.abilityLayer,
                    action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                    outcome: "success",
                    data_ref: {
                        query: input.params.query,
                        search_id: typeof capturedRequestBody.search_id === "string"
                            ? capturedRequestBody.search_id
                            : payload.search_id
                    },
                    metrics: {
                        count,
                        duration_ms: Math.max(0, env.now() - startedAt)
                    }
                },
                scope_context: gate.scope_context,
                gate_input: {
                    run_id: auditRecord.run_id,
                    session_id: auditRecord.session_id,
                    profile: auditRecord.profile,
                    ...gate.gate_input
                },
                gate_outcome: gate.gate_outcome,
                read_execution_policy: gate.read_execution_policy,
                issue_action_matrix: gate.issue_action_matrix,
                consumer_gate_result: gate.consumer_gate_result,
                request_admission_result: gate.request_admission_result,
                execution_audit: gate.execution_audit,
                approval_record: gate.approval_record,
                risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                audit_record: auditRecord,
                ...buildProviderAwareReadPathSummaryFields(input.options),
                ...layer2InteractionSummary(layer2Interaction),
                ...withPassiveApiCaptureEvidenceDiagnostic(routeEvidence),
                route_evidence: routeEvidence,
                closeout_route_evidence: routeEvidence,
                closeout_evidence_expected: closeoutEvidenceExpected,
                closeout_evidence_rounds: closeoutEvidenceRounds,
                request_context: {
                    status: "exact_hit",
                    page_context_namespace: requestContextState.pageContextNamespace,
                    shape_key: requestContextState.shapeKey,
                    captured_at: capturedAt
                }
            },
            observability: createObservability({
                href: pageUrl,
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "completed",
                statusCode: 200
            })
        }
    };
};
return { executeXhsSearch };
})();
const __webenvoy_module_xhs_search = (() => {
const { executeXhsSearch: executeXhsSearchImpl } = __webenvoy_module_xhs_search_execution;
function executeXhsSearch(...args) {
    return executeXhsSearchImpl(...args);
}
return { executeXhsSearch };
})();
const __webenvoy_module_xhs_read_execution = (() => {
const {
  createPageContextNamespace,
  createUserHomeRequestShape
} = __webenvoy_module_xhs_search_types;
const { createAuditRecord, resolveGate } = __webenvoy_module_xhs_search_gate;
const {
  classifyXhsAccountSafetySurface,
  containsCookie,
  createDiagnosis,
  createFailure,
  resolveRiskStateOutput,
  resolveXsCommon
} = __webenvoy_module_xhs_search_telemetry;
const DETAIL_ENDPOINT = "/api/sns/web/v1/feed";
const USER_HOME_ENDPOINT = "/api/sns/web/v1/user_posted";
const XHS_READ_API_ORIGIN = "https://edith.xiaohongshu.com";
const requiresSignedContinuity = (spec) => spec.command === "xhs.detail" || spec.command === "xhs.user_home";
const buildPassiveApiCaptureEvidenceDiagnostic = (input) => {
    if (input.templateEvidence.route_evidence_class !== "passive_api_capture" ||
        input.templateEvidence.source_kind !== "page_request") {
        return null;
    }
    return {
        evidence_class: "passive_api_capture",
        evidence_role: "diagnostic",
        route_role: "supporting",
        path_kind: "api",
        source_kind: "page_request",
        current_page_natural_request: true,
        synthetic_replay: false,
        live_closeout_evidence: false,
        syvert_normalized_output: false,
        request_payload_included: false,
        response_payload_included: false,
        redaction_state: "payload_omitted",
        route: `${input.spec.command}.api`,
        method: input.spec.method,
        endpoint: input.spec.endpoint,
        request_url: input.requestUrl ?? input.spec.buildSignatureUri(input.executionInput.params),
        status_code: input.responseStatus,
        run_id: input.executionInput.executionContext.runId,
        profile_ref: input.executionInput.executionContext.profile,
        session_id: input.executionInput.executionContext.sessionId,
        target_tab_id: input.targetTabId,
        page_url: input.pageUrl,
        action_ref: input.executionInput.abilityAction,
        observed_at: input.templateEvidence.observed_at,
        captured_at: input.templateEvidence.captured_at,
        page_context_namespace: input.templateEvidence.page_context_namespace,
        shape_key: input.templateEvidence.shape_key,
        artifact_identity: input.templateEvidence.template_identity
    };
};
const withPassiveApiCaptureEvidenceDiagnostic = (input) => {
    const diagnostic = buildPassiveApiCaptureEvidenceDiagnostic(input);
    return diagnostic ? { passive_api_capture_evidence: diagnostic } : {};
};
const REQUEST_CONTEXT_FRESHNESS_WINDOW_MS = 5 * 60_000;
const REQUEST_CONTEXT_WAIT_MAX_ATTEMPTS = 10;
const REQUEST_CONTEXT_WAIT_RETRY_MS = 150;
const BACKEND_REJECTED_SOURCE_REASONS = new Set([
    "XHS_LOGIN_REQUIRED",
    "SESSION_EXPIRED",
    "ACCOUNT_ABNORMAL",
    "XHS_ACCOUNT_RISK_PAGE",
    "BROWSER_ENV_ABNORMAL",
    "GATEWAY_INVOKER_FAILED",
    "CAPTCHA_REQUIRED",
    "TARGET_API_RESPONSE_INVALID"
]);
const PAGE_STATE_FALLBACK_HARD_STOP_REASONS = new Set([
    "XHS_LOGIN_REQUIRED",
    "SESSION_EXPIRED",
    "ACCOUNT_ABNORMAL",
    "XHS_ACCOUNT_RISK_PAGE",
    "BROWSER_ENV_ABNORMAL",
    "CAPTCHA_REQUIRED",
    "SECURITY_REDIRECT",
    "TARGET_API_RESPONSE_INVALID"
]);
const canUsePageStateFallbackForReason = (spec, params, pageStateRoot, reason) => !PAGE_STATE_FALLBACK_HARD_STOP_REASONS.has(reason) &&
    canUsePageStateFallback(spec, params, asRecord(pageStateRoot));
const XHS_DETAIL_SPEC = {
    command: "xhs.detail",
    endpoint: DETAIL_ENDPOINT,
    method: "POST",
    pageKind: "detail",
    requestClass: "xhs.detail",
    providerRequirementRef: "FR-0061.xhs_driver_provider_requirements.v1/xhs.detail.read",
    abilityId: "xhs.note.detail.v1",
    routeBucket: "detail",
    targetPageClass: "explore_detail_tab",
    buildPayload: (params) => ({
        source_note_id: params.note_id,
        image_formats: ["jpg", "webp", "avif"],
        extra: {
            need_body_topic: "1"
        }
    }),
    buildUrl: () => `${XHS_READ_API_ORIGIN}${DETAIL_ENDPOINT}`,
    buildSignatureUri: () => DETAIL_ENDPOINT,
    buildDataRef: (params) => ({
        note_id: params.note_id
    })
};
const XHS_USER_HOME_SPEC = {
    command: "xhs.user_home",
    endpoint: USER_HOME_ENDPOINT,
    method: "GET",
    pageKind: "user_home",
    requestClass: "xhs.user_home",
    providerRequirementRef: "FR-0061.xhs_driver_provider_requirements.v1/xhs.user_home.read",
    abilityId: "xhs.user.home.v1",
    routeBucket: "user_home",
    targetPageClass: "profile_tab",
    buildPayload: () => ({}),
    buildUrl: (params) => `${XHS_READ_API_ORIGIN}${USER_HOME_ENDPOINT}?num=30&cursor=&user_id=${encodeURIComponent(params.user_id)}`,
    buildSignatureUri: (params) => `${USER_HOME_ENDPOINT}?num=30&cursor=&user_id=${encodeURIComponent(params.user_id)}`,
    buildDataRef: (params) => ({
        user_id: params.user_id
    })
};
const READ_COMMAND_SPECS = {
    "xhs.detail": XHS_DETAIL_SPEC,
    "xhs.user_home": XHS_USER_HOME_SPEC
};
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asArray = (value) => (Array.isArray(value) ? value : null);
const asString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const asRecordArray = (value) => Array.isArray(value)
    ? value.filter((item) => asRecord(item) !== null)
    : [];
const asInteger = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
};
const parseJsonRecord = (value) => {
    if (typeof value === "string") {
        try {
            return asRecord(JSON.parse(value));
        }
        catch {
            return null;
        }
    }
    return asRecord(value);
};
const normalizeCapturedHeaders = (value) => {
    const record = asRecord(value);
    if (!record) {
        return {};
    }
    return Object.fromEntries(Object.entries(record).filter((entry) => typeof entry[1] === "string"));
};
const isRedactedCapturedHeaderValue = (value) => value.trim().toLowerCase() === "[redacted]";
const getCapturedHeader = (headers, key) => {
    const matchedEntry = Object.entries(headers).find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
    if (!matchedEntry) {
        return null;
    }
    const value = matchedEntry[1].trim();
    return value.length > 0 && !isRedactedCapturedHeaderValue(value) ? value : null;
};
const resolveCapturedArtifactHeaders = (value) => {
    const record = asRecord(value);
    if (!record) {
        return {};
    }
    const request = asRecord(record.request);
    return normalizeCapturedHeaders(record.template_headers ?? request?.headers);
};
const resolveCapturedArtifactReferrer = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    return asString(record.referrer);
};
const resolveCapturedArtifactRequestUrl = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const rawUrl = asString(record.url);
    if (rawUrl) {
        try {
            const url = new URL(rawUrl, "https://www.xiaohongshu.com");
            return `${url.pathname}${url.search}`;
        }
        catch {
            return rawUrl;
        }
    }
    return asString(record.path);
};
const resolveReadApiFetchUrl = (value) => {
    if (/^https?:\/\//iu.test(value)) {
        return value;
    }
    if (value.startsWith("/")) {
        return `${XHS_READ_API_ORIGIN}${value}`;
    }
    return value;
};
const resolveCapturedArtifactRequestBody = (value) => {
    const record = asRecord(value);
    const request = asRecord(record?.request);
    return asRecord(request?.body);
};
const resolveCapturedArtifactResponseStatus = (value) => {
    const status = resolveCapturedArtifactStatus(value).httpStatus;
    return status !== null && Number.isFinite(status) ? status : null;
};
const resolveCapturedArtifactResponseBody = (value) => {
    const record = asRecord(value);
    const response = asRecord(record?.response);
    return response?.body ?? null;
};
const resolveCapturedArtifactStatus = (value) => {
    const record = asRecord(value);
    const requestStatus = asRecord(record?.request_status);
    const sourceKind = asString(record?.source_kind);
    const httpStatus = asInteger(requestStatus?.http_status) ?? asInteger(record?.status);
    const completion = asString(requestStatus?.completion);
    const templateReady = typeof record?.template_ready === "boolean" ? record.template_ready : null;
    const explicitReason = asString(record?.rejection_reason);
    const rejectionReason = explicitReason === "synthetic_request_rejected" ||
        explicitReason === "failed_request_rejected" ||
        explicitReason === "shape_mismatch"
        ? explicitReason
        : sourceKind !== null && sourceKind !== "page_request"
            ? "synthetic_request_rejected"
            : (completion !== null && completion !== "completed") ||
                (httpStatus !== null && (httpStatus < 200 || httpStatus >= 300))
                ? "failed_request_rejected"
                : templateReady === false
                    ? "failed_request_rejected"
                    : null;
    return {
        sourceKind,
        httpStatus,
        templateReady,
        rejectionReason
    };
};
const resolveCapturedArtifactObservedAt = (value) => {
    const record = asRecord(value);
    return asInteger(record?.observed_at) ?? asInteger(record?.captured_at);
};
const isSyntheticActiveFetchBootstrapArtifact = (value) => {
    const record = asRecord(value);
    return (asString(record?.transport) === "synthetic_active_fetch_bootstrap" ||
        asString(record?.template_identity)?.startsWith("synthetic_active_fetch_bootstrap:") === true);
};
const resolveCapturedTemplateIdentity = (record, expectedShape) => {
    const explicitIdentity = asString(record?.template_identity);
    if (explicitIdentity) {
        return explicitIdentity;
    }
    const observedAt = asInteger(record?.observed_at) ?? asInteger(record?.captured_at) ?? 0;
    const namespace = asString(record?.page_context_namespace) ?? "unknown_namespace";
    const shapeKey = asString(record?.shape_key) ?? serializeReadShape(expectedShape);
    const runId = asString(record?.run_id) ?? "unknown_run";
    return `captured:${runId}:${namespace}:${shapeKey}:${observedAt}`;
};
const resolveActiveApiFetchFallbackTemplateEvidence = (artifact, expectedShape, now) => {
    const record = asRecord(artifact);
    const observedAt = resolveCapturedArtifactObservedAt(record);
    const capturedAt = asInteger(record?.captured_at);
    const freshnessWindowMs = asInteger(record?.freshness_window_ms) ?? REQUEST_CONTEXT_FRESHNESS_WINDOW_MS;
    return {
        route_evidence_class: asString(record?.route_evidence_class),
        source_kind: asString(record?.source_kind),
        template_identity: resolveCapturedTemplateIdentity(record, expectedShape),
        profile_ref: asString(record?.profile_ref),
        session_id: asString(record?.session_id),
        target_tab_id: asInteger(record?.target_tab_id),
        run_id: asString(record?.run_id),
        action_ref: asString(record?.action_ref),
        page_url: asString(record?.page_url),
        observed_at: observedAt,
        captured_at: capturedAt,
        freshness_window_ms: freshnessWindowMs,
        template_age_ms: observedAt === null ? null : Math.max(0, now - observedAt),
        page_context_namespace: asString(record?.page_context_namespace),
        shape_key: asString(record?.shape_key)
    };
};
const isCapturedArtifactStale = (value, now) => {
    const observedAt = resolveCapturedArtifactObservedAt(value);
    return observedAt === null || now - observedAt > REQUEST_CONTEXT_FRESHNESS_WINDOW_MS;
};
const resolveRejectedSourceDiagnostics = (spec, artifact) => {
    const status = resolveCapturedArtifactStatus(artifact);
    const response = asRecord(artifact.response);
    const responseBody = response?.body;
    const responseRecord = asRecord(responseBody);
    const platformCode = asInteger(responseRecord?.code);
    if (status.rejectionReason === "synthetic_request_rejected" ||
        status.rejectionReason === "shape_mismatch") {
        return {
            reason: status.rejectionReason,
            statusCode: status.httpStatus,
            platformCode
        };
    }
    if (status.rejectionReason === "failed_request_rejected") {
        const inferred = inferReadFailure(spec, status.httpStatus ?? 0, responseBody);
        if (BACKEND_REJECTED_SOURCE_REASONS.has(inferred.reason)) {
            return {
                reason: inferred.reason,
                statusCode: status.httpStatus,
                platformCode
            };
        }
        return {
            reason: "failed_request_rejected",
            statusCode: status.httpStatus,
            platformCode
        };
    }
    return {
        reason: "failed_request_rejected",
        statusCode: status.httpStatus,
        platformCode
    };
};
const resolveRejectedSourceMessage = (spec, reason) => {
    switch (reason) {
        case "XSEC_TOKEN_MISSING":
            return `当前页面现场缺少 ${spec.command} signed URL 或 xsec_token，无法继续执行`;
        case "XSEC_TOKEN_EMPTY":
            return `当前页面现场的 ${spec.command} xsec_token 为空，无法继续执行`;
        case "XSEC_TOKEN_STALE":
            return `当前页面现场的 ${spec.command} xsec_token 已过期，无法继续执行`;
        case "XSEC_SOURCE_MISMATCH":
            return `当前页面现场的 ${spec.command} xsec_source 与来源不匹配，无法继续执行`;
        case "SECURITY_REDIRECT":
            return "当前页面被安全重定向拦截，无法继续执行";
        case "SESSION_EXPIRED":
            return `登录已失效，无法执行 ${spec.command}`;
        case "XHS_LOGIN_REQUIRED":
            return "当前页面要求登录小红书，无法继续执行";
        case "ACCOUNT_ABNORMAL":
            return "账号异常，平台拒绝当前请求";
        case "XHS_ACCOUNT_RISK_PAGE":
            return "当前页面命中小红书账号风险或安全验证页面";
        case "BROWSER_ENV_ABNORMAL":
            return "浏览器环境异常，平台拒绝当前请求";
        case "GATEWAY_INVOKER_FAILED":
            return `网关调用失败，当前上下文不足以完成 ${spec.command} 请求`;
        case "CAPTCHA_REQUIRED":
            return "平台要求额外人机验证，无法继续执行";
        case "TARGET_API_RESPONSE_INVALID":
            return `${spec.command} 接口返回了未识别的失败响应`;
        default:
            return null;
    }
};
const isBackendRejectedSourceLookup = (lookupResult) => lookupResult.state === "rejected_source" &&
    (BACKEND_REJECTED_SOURCE_REASONS.has(lookupResult.reason) ||
        lookupResult.reason === "failed_request_rejected");
const SECURITY_REDIRECT_URL_PATTERN = /\/(security|captcha|verify|risk|safe|login)(\/|$)/i;
const classifySignedContinuitySourceRoute = (xsecSource) => {
    switch (xsecSource) {
        case "pc_search":
            return "xhs.search";
        case "pc_note":
            return "xhs.detail";
        case "pc_profile":
        case "pc_user":
            return "xhs.user_home";
        default:
            return "unknown";
    }
};
const isSecurityRedirectUrl = (value) => {
    if (!value) {
        return false;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        return SECURITY_REDIRECT_URL_PATTERN.test(url.pathname);
    }
    catch {
        return SECURITY_REDIRECT_URL_PATTERN.test(value);
    }
};
const resolveSignedContinuityUrl = (spec, expectedShape, value) => {
    if (!value || isSecurityRedirectUrl(value)) {
        return null;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        if (url.protocol !== "https:" || url.hostname !== "www.xiaohongshu.com") {
            return null;
        }
        if (spec.command === "xhs.detail") {
            const noteId = expectedShape.note_id;
            const expectedPaths = [
                `/explore/${noteId}`,
                `/discovery/item/${noteId}`,
                `/search_result/${noteId}`
            ];
            return expectedPaths.includes(url.pathname) ? url : null;
        }
        const userId = expectedShape.user_id;
        return url.pathname === `/user/profile/${userId}` ? url : null;
    }
    catch {
        return null;
    }
};
const resolveSignedContinuity = (spec, expectedShape, artifact) => {
    const record = asRecord(artifact);
    const referrer = resolveCapturedArtifactReferrer(record);
    const pageUrl = asString(record?.page_url);
    const url = asString(record?.url);
    const continuityCandidates = [pageUrl, referrer, url]
        .map((candidate) => resolveSignedContinuityUrl(spec, expectedShape, candidate))
        .filter((candidate) => candidate !== null);
    const signedUrl = continuityCandidates.find((candidate) => candidate.searchParams.has("xsec_token")) ??
        continuityCandidates.find((candidate) => candidate.searchParams.has("xsec_source")) ??
        continuityCandidates[0] ??
        null;
    const sourceUrl = signedUrl?.toString() ?? pageUrl ?? referrer ?? url;
    const rawToken = signedUrl?.searchParams.get("xsec_token") ?? null;
    const xsecToken = rawToken === null ? null : rawToken.trim();
    const rawSource = signedUrl?.searchParams.get("xsec_source") ?? null;
    const xsecSource = rawSource === null ? null : rawSource.trim() || null;
    const tokenPresence = rawToken === null ? "missing" : rawToken.trim().length > 0 ? "present" : "empty";
    const targetUrl = signedUrl ? signedUrl.toString() : null;
    return {
        source_url: sourceUrl,
        target_url: targetUrl,
        ...(spec.command === "xhs.detail" ? { detail_url: targetUrl } : { user_home_url: targetUrl }),
        xsec_token: xsecToken,
        xsec_source: xsecSource,
        token_presence: tokenPresence,
        observed_at: resolveCapturedArtifactObservedAt(record),
        source_route: classifySignedContinuitySourceRoute(xsecSource)
    };
};
const extractXhsDetailPageNoteId = (value) => {
    if (!value || isSecurityRedirectUrl(value)) {
        return null;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        if (url.protocol !== "https:" || url.hostname !== "www.xiaohongshu.com") {
            return null;
        }
        const match = url.pathname.match(/^\/(?:explore|search_result|discovery\/item)\/([^/?#]+)$/);
        return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
    catch {
        return null;
    }
};
const extractXhsUserHomePageUserId = (value) => {
    if (!value || isSecurityRedirectUrl(value)) {
        return null;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        if (url.protocol !== "https:" || url.hostname !== "www.xiaohongshu.com") {
            return null;
        }
        const match = url.pathname.match(/^\/user\/profile\/([^/?#]+)$/);
        return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
    catch {
        return null;
    }
};
const isSameXhsDetailPageBinding = (input) => {
    if (input.templatePageUrl === input.currentPageUrl) {
        return true;
    }
    if (input.signedContinuity.token_presence !== "present" || !input.signedContinuity.target_url) {
        return false;
    }
    const templateNoteId = extractXhsDetailPageNoteId(input.templatePageUrl);
    const currentNoteId = extractXhsDetailPageNoteId(input.currentPageUrl);
    const continuityNoteId = extractXhsDetailPageNoteId(input.signedContinuity.target_url);
    return (templateNoteId !== null &&
        currentNoteId !== null &&
        continuityNoteId !== null &&
        templateNoteId === currentNoteId &&
        templateNoteId === continuityNoteId);
};
const isSameXhsUserHomePageBinding = (input) => {
    if (input.templatePageUrl === input.currentPageUrl) {
        return true;
    }
    if (input.signedContinuity.token_presence !== "present" || !input.signedContinuity.target_url) {
        return false;
    }
    const templateUserId = extractXhsUserHomePageUserId(input.templatePageUrl);
    const currentUserId = extractXhsUserHomePageUserId(input.currentPageUrl);
    const continuityUserId = extractXhsUserHomePageUserId(input.signedContinuity.target_url);
    return (templateUserId !== null &&
        currentUserId !== null &&
        continuityUserId !== null &&
        templateUserId === currentUserId &&
        templateUserId === continuityUserId);
};
const isSameXhsReadPageBinding = (input) => input.spec.pageKind === "user_home"
    ? isSameXhsUserHomePageBinding(input)
    : isSameXhsDetailPageBinding(input);
const resolveSignedContinuityFailure = (continuity, observedAt, now, pageUrl) => {
    if (isSecurityRedirectUrl(pageUrl) || isSecurityRedirectUrl(continuity.source_url)) {
        return "SECURITY_REDIRECT";
    }
    if (!continuity.target_url) {
        return "XSEC_TOKEN_MISSING";
    }
    if (continuity.token_presence === "missing") {
        return "XSEC_TOKEN_MISSING";
    }
    if (continuity.token_presence === "empty") {
        return "XSEC_TOKEN_EMPTY";
    }
    if (continuity.source_route !== "xhs.search" || continuity.xsec_source !== "pc_search") {
        return "XSEC_SOURCE_MISMATCH";
    }
    if (observedAt === null || now - observedAt > REQUEST_CONTEXT_FRESHNESS_WINDOW_MS) {
        return "XSEC_TOKEN_STALE";
    }
    return null;
};
const waitForRequestContextRetry = async (env, ms) => {
    if (typeof env.sleep === "function") {
        await env.sleep(ms);
        return;
    }
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
const resolveExactShapeLookupArtifacts = (lookupRecord) => {
    const admittedTemplate = asRecord(lookupRecord.admitted_template);
    const rejectedObservation = asRecord(lookupRecord.rejected_observation);
    if (!admittedTemplate || !rejectedObservation) {
        return {
            admittedTemplate,
            rejectedObservation
        };
    }
    if (resolveCapturedArtifactStatus(rejectedObservation).rejectionReason === "synthetic_request_rejected") {
        return {
            admittedTemplate,
            rejectedObservation: null
        };
    }
    const admittedObservedAt = resolveCapturedArtifactObservedAt(admittedTemplate);
    const rejectedObservedAt = resolveCapturedArtifactObservedAt(rejectedObservation);
    if (rejectedObservedAt !== null &&
        (admittedObservedAt === null || rejectedObservedAt > admittedObservedAt)) {
        return {
            admittedTemplate: null,
            rejectedObservation
        };
    }
    return {
        admittedTemplate,
        rejectedObservation: null
    };
};
const parseUserIdFromUrl = (value) => {
    if (!value) {
        return null;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        return asString(url.searchParams.get("user_id"));
    }
    catch {
        return null;
    }
};
const parsePathnameFromUrl = (value) => {
    if (!value) {
        return null;
    }
    try {
        return new URL(value, "https://www.xiaohongshu.com").pathname;
    }
    catch {
        return null;
    }
};
const resolveDetailResponseNoteId = (value, preferredNoteId, options) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    let fallbackNoteId = null;
    for (const candidate of getDetailResponseCandidates(record)) {
        const candidateNoteId = asString(candidate.note_id) ?? asString(candidate.noteId);
        if (candidateNoteId) {
            if (preferredNoteId && candidateNoteId === preferredNoteId) {
                return candidateNoteId;
            }
            fallbackNoteId ??= candidateNoteId;
            continue;
        }
        if (options?.allowBareIdAlias &&
            asString(candidate.id)) {
            const bareId = asString(candidate.id);
            if (!preferredNoteId || bareId === preferredNoteId) {
                return bareId;
            }
            return bareId;
        }
    }
    return preferredNoteId ? null : fallbackNoteId;
};
const hasUserHomeResponseDataShape = (record) => [
    "nickname",
    "avatar",
    "avatar_url",
    "images",
    "follows",
    "fans",
    "basicInfo",
    "basic_info",
    "interactions"
].some((key) => key in record);
const iterateUserHomeResponseCandidates = (value) => {
    const collectCandidates = (candidate, seen = new Set()) => {
        const record = asRecord(candidate);
        if (record) {
            if (seen.has(record)) {
                return [];
            }
            seen.add(record);
            return [
                record,
                ...collectCandidates(record.basic_info, seen),
                ...collectCandidates(record.basicInfo, seen),
                ...collectCandidates(record.profile, seen),
                ...collectCandidates(record.user, seen)
            ];
        }
        if (Array.isArray(candidate)) {
            return candidate.flatMap((entry) => collectCandidates(entry, seen));
        }
        return [];
    };
    const responseRecord = asRecord(value);
    const dataRecord = asRecord(responseRecord?.data ?? value);
    if (!dataRecord) {
        return [];
    }
    return [
        ...collectCandidates(dataRecord.user),
        ...collectCandidates(dataRecord.basic_info),
        ...collectCandidates(dataRecord.basicInfo),
        ...collectCandidates(dataRecord.profile),
        ...collectCandidates(dataRecord.notes),
        ...collectCandidates(dataRecord.items),
        ...collectCandidates(dataRecord.list),
        ...collectCandidates(dataRecord.note_list),
        ...collectCandidates(dataRecord.noteList),
        ...(hasUserHomeResponseDataShape(dataRecord) ? [dataRecord] : [])
    ];
};
const resolveUserHomeResponseUserId = (value, preferredUserId) => {
    let fallbackUserId = null;
    for (const candidate of iterateUserHomeResponseCandidates(value)) {
        const userId = asString(candidate.user_id) ?? asString(candidate.userId);
        if (userId) {
            if (preferredUserId && userId === preferredUserId) {
                return userId;
            }
            fallbackUserId ??= userId;
        }
    }
    return preferredUserId ? null : fallbackUserId;
};
const isSignedContinuityBoundToUserHome = (params, continuity) => continuity?.token_presence === "present" &&
    continuity.xsec_source === "pc_search" &&
    continuity.source_route === "xhs.search" &&
    continuity.target_url !== null &&
    parseUserProfileIdFromHref(continuity.target_url) === params.user_id;
const isEmptyUserPostedSuccessForSignedUserHome = (body, params, continuity) => {
    if (!isSignedContinuityBoundToUserHome(params, continuity)) {
        return false;
    }
    const responseRecord = asRecord(body);
    const dataRecord = asRecord(responseRecord?.data ?? body);
    if (!dataRecord) {
        return false;
    }
    const businessCode = asInteger(responseRecord?.code);
    const businessSuccess = businessCode === 0 || responseRecord?.success === true;
    return (businessSuccess &&
        Array.isArray(dataRecord.notes) &&
        dataRecord.notes.length === 0 &&
        (dataRecord.has_more === false || dataRecord.hasMore === false));
};
const createDetailShape = (noteId) => ({
    command: "xhs.detail",
    method: "POST",
    pathname: DETAIL_ENDPOINT,
    note_id: noteId
});
const deriveReadShapeFromCommand = (spec, params) => spec.command === "xhs.detail"
    ? {
        command: "xhs.detail",
        method: "POST",
        pathname: DETAIL_ENDPOINT,
        note_id: params.note_id
    }
    : {
        command: "xhs.user_home",
        method: "GET",
        pathname: USER_HOME_ENDPOINT,
        user_id: params.user_id
    };
const deriveDetailShapeFromSource = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const noteId = asString(record.note_id);
    if (!noteId) {
        return null;
    }
    return createDetailShape(noteId);
};
const deriveDetailRejectedShapeFromRequestSource = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const noteId = asString(record.source_note_id);
    if (!noteId) {
        return null;
    }
    return createDetailShape(noteId);
};
const deriveUserHomeShapeFromSource = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const declaredPathname = asString(record.pathname) ?? asString(record.path) ?? parsePathnameFromUrl(asString(record.url));
    if (declaredPathname !== null && declaredPathname !== USER_HOME_ENDPOINT) {
        return null;
    }
    const userId = asString(record.user_id) ?? asString(record.userId) ?? parseUserIdFromUrl(asString(record.url));
    if (!userId) {
        return null;
    }
    return {
        command: "xhs.user_home",
        method: "GET",
        pathname: USER_HOME_ENDPOINT,
        user_id: userId
    };
};
const deriveReadShapeFromArtifact = (spec, artifact, options) => {
    if (!artifact) {
        return null;
    }
    const record = asRecord(artifact);
    if (!record) {
        return null;
    }
    const artifactStatus = resolveCapturedArtifactStatus(record);
    const explicitShape = parseJsonRecord(record.shape);
    const response = asRecord(record.response);
    if (explicitShape) {
        if (spec.command === "xhs.detail") {
            const explicitDetailShape = deriveDetailShapeFromSource(explicitShape);
            const responseDetailShape = (() => {
                const preferredNoteId = options?.preferredDetailNoteId ?? explicitDetailShape?.note_id ?? null;
                const responseNoteId = resolveDetailResponseNoteId(response?.body, preferredNoteId, {
                    allowBareIdAlias: options?.allowDetailResponseBareIdAlias
                }) ??
                    resolveDetailResponseNoteId(response?.body);
                return responseNoteId ? createDetailShape(responseNoteId) : null;
            })();
            if (explicitDetailShape &&
                responseDetailShape &&
                responseDetailShape.note_id !== explicitDetailShape.note_id) {
                return responseDetailShape;
            }
            if (options?.allowDetailRequestFallback === false) {
                return responseDetailShape;
            }
            return explicitDetailShape;
        }
        const explicitUserHomeShape = deriveUserHomeShapeFromSource(explicitShape);
        if (artifactStatus.rejectionReason && explicitUserHomeShape) {
            return explicitUserHomeShape;
        }
        const responseUserId = resolveUserHomeResponseUserId(response?.body, explicitUserHomeShape?.user_id ?? null);
        return explicitUserHomeShape &&
            responseUserId &&
            responseUserId === explicitUserHomeShape.user_id
            ? explicitUserHomeShape
            : null;
    }
    if (spec.command === "xhs.detail") {
        const noteIdFromResponse = resolveDetailResponseNoteId(response?.body, options?.preferredDetailNoteId) ??
            resolveDetailResponseNoteId(response?.body);
        if (noteIdFromResponse) {
            return createDetailShape(noteIdFromResponse);
        }
    }
    const request = asRecord(record.request);
    if (spec.command === "xhs.detail" && resolveCapturedArtifactStatus(record).rejectionReason) {
        const rejectedRequestShape = deriveDetailRejectedShapeFromRequestSource(request?.body);
        if (rejectedRequestShape) {
            return rejectedRequestShape;
        }
    }
    if (spec.command === "xhs.detail" && options?.allowDetailRequestFallback !== false) {
        return deriveDetailShapeFromSource(request?.body);
    }
    const capturedPathname = asString(record.pathname) ?? asString(record.path) ?? parsePathnameFromUrl(asString(record.url));
    const urlShape = deriveUserHomeShapeFromSource({ url: asString(record.url) });
    const requestShape = deriveUserHomeShapeFromSource({
        ...(request ?? {}),
        pathname: capturedPathname ?? undefined
    });
    const expectedUserId = urlShape?.user_id ?? requestShape?.user_id ?? null;
    if (artifactStatus.rejectionReason && expectedUserId) {
        return (createUserHomeRequestShape({
            user_id: expectedUserId
        }) ?? null);
    }
    return null;
};
const serializeReadShape = (shape) => shape.command === "xhs.detail"
    ? JSON.stringify({
        command: shape.command,
        method: shape.method,
        pathname: shape.pathname,
        note_id: shape.note_id
    })
    : JSON.stringify({
        command: shape.command,
        method: shape.method,
        pathname: shape.pathname,
        user_id: shape.user_id
    });
const resolveReadRequestContext = (spec, artifact, expectedShape, now, options) => {
    if (!artifact) {
        return {
            state: "miss",
            reason: "template_missing"
        };
    }
    const lookupRecord = asRecord(artifact);
    if (lookupRecord &&
        ("admitted_template" in lookupRecord ||
            "rejected_observation" in lookupRecord ||
            "incompatible_observation" in lookupRecord)) {
        const { admittedTemplate, rejectedObservation } = resolveExactShapeLookupArtifacts(lookupRecord);
        const incompatibleObservation = asRecord(lookupRecord.incompatible_observation);
        if (admittedTemplate) {
            return resolveReadRequestContext(spec, admittedTemplate, expectedShape, now, {
                allowDetailResponseBareIdAlias: false,
                allowDetailRequestFallback: false
            });
        }
        if (rejectedObservation) {
            const derivedShape = deriveReadShapeFromArtifact(spec, rejectedObservation, {
                preferredDetailNoteId: spec.command === "xhs.detail" ? expectedShape.note_id : null,
                allowDetailResponseBareIdAlias: true,
                allowDetailRequestFallback: true
            });
            if (derivedShape && serializeReadShape(derivedShape) !== serializeReadShape(expectedShape)) {
                return {
                    state: "incompatible",
                    reason: "shape_mismatch",
                    shape: derivedShape
                };
            }
            if (isCapturedArtifactStale(rejectedObservation, now)) {
                return {
                    state: "stale",
                    reason: "template_stale",
                    shape: derivedShape ?? expectedShape,
                    signedContinuity: derivedShape === null
                        ? null
                        : resolveSignedContinuity(spec, derivedShape, rejectedObservation)
                };
            }
            const rejectedDiagnostics = resolveRejectedSourceDiagnostics(spec, rejectedObservation);
            return {
                state: "rejected_source",
                reason: rejectedDiagnostics.reason,
                shape: derivedShape ?? expectedShape,
                statusCode: rejectedDiagnostics.statusCode,
                platformCode: rejectedDiagnostics.platformCode
            };
        }
        if (incompatibleObservation) {
            return {
                state: "incompatible",
                reason: "shape_mismatch",
                shape: deriveReadShapeFromArtifact(spec, incompatibleObservation, {
                    preferredDetailNoteId: spec.command === "xhs.detail" ? expectedShape.note_id : null,
                    allowDetailResponseBareIdAlias: true,
                    allowDetailRequestFallback: true
                })
            };
        }
        const availableShapeKeys = Array.isArray(lookupRecord.available_shape_keys)
            ? lookupRecord.available_shape_keys.filter((item) => typeof item === "string")
            : [];
        if (availableShapeKeys.some((candidateShapeKey) => candidateShapeKey !== lookupRecord.shape_key)) {
            return {
                state: "miss",
                reason: "shape_mismatch",
            };
        }
        return {
            state: "miss",
            reason: "template_missing"
        };
    }
    const derivedShape = deriveReadShapeFromArtifact(spec, artifact, {
        preferredDetailNoteId: spec.command === "xhs.detail" ? expectedShape.note_id : null,
        allowDetailResponseBareIdAlias: options?.allowDetailResponseBareIdAlias ?? false,
        allowDetailRequestFallback: spec.command === "xhs.detail" &&
            !resolveCapturedArtifactStatus(artifact).rejectionReason &&
            !isSyntheticActiveFetchBootstrapArtifact(artifact)
            ? false
            : (options?.allowDetailRequestFallback ?? true)
    });
    if (!derivedShape) {
        return {
            state: "miss",
            reason: "template_missing"
        };
    }
    const status = resolveCapturedArtifactStatus(artifact);
    if (serializeReadShape(derivedShape) !== serializeReadShape(expectedShape)) {
        return {
            state: "incompatible",
            reason: "shape_mismatch",
            shape: derivedShape
        };
    }
    if (isCapturedArtifactStale(artifact, now)) {
        return {
            state: "stale",
            reason: "template_stale",
            shape: derivedShape,
            signedContinuity: resolveSignedContinuity(spec, derivedShape, artifact)
        };
    }
    if (status.rejectionReason) {
        const rejectedDiagnostics = resolveRejectedSourceDiagnostics(spec, artifact);
        return {
            state: "rejected_source",
            reason: rejectedDiagnostics.reason,
            shape: derivedShape,
            statusCode: rejectedDiagnostics.statusCode,
            platformCode: rejectedDiagnostics.platformCode
        };
    }
    return {
        state: "hit",
        shape: derivedShape,
        headers: resolveCapturedArtifactHeaders(artifact),
        referrer: resolveCapturedArtifactReferrer(artifact),
        requestUrl: resolveCapturedArtifactRequestUrl(artifact),
        requestBody: resolveCapturedArtifactRequestBody(artifact),
        responseStatus: resolveCapturedArtifactResponseStatus(artifact),
        responseBody: resolveCapturedArtifactResponseBody(artifact),
        observedAt: resolveCapturedArtifactObservedAt(artifact),
        signedContinuity: resolveSignedContinuity(spec, expectedShape, artifact),
        templateEvidence: resolveActiveApiFetchFallbackTemplateEvidence(artifact, expectedShape, now)
    };
};
const failClosedForRequestContext = (input, env) => {
    const failureSurface = resolveRequestContextFailureSurface(input.spec, input.lookupResult);
    const backendRejectedSource = isBackendRejectedSourceLookup(input.lookupResult);
    return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", failureSurface.message, {
        ability_id: input.abilityId,
        stage: "execution",
        reason: failureSurface.reasonCode,
        request_context_result: failureSurface.resultKind,
        request_context_lookup_state: input.lookupResult.state,
        request_context_miss_reason: input.lookupResult.reason,
        request_context_shape: input.expectedShape,
        request_context_shape_key: serializeReadShape(input.expectedShape),
        ...(input.lookupResult.state === "rejected_source" &&
            typeof input.lookupResult.statusCode === "number"
            ? { status_code: input.lookupResult.statusCode }
            : {}),
        ...(input.lookupResult.state === "rejected_source" &&
            typeof input.lookupResult.platformCode === "number"
            ? { platform_code: input.lookupResult.platformCode }
            : {}),
        ...("shape" in input.lookupResult && input.lookupResult.shape
            ? { captured_request_shape: input.lookupResult.shape }
            : {})
    }, createReadObservability({
        spec: input.spec,
        href: env.getLocationHref(),
        title: env.getDocumentTitle(),
        readyState: env.getReadyState(),
        requestId: `req-${env.randomId()}`,
        outcome: "failed",
        statusCode: input.lookupResult.state === "rejected_source" ? (input.lookupResult.statusCode ?? undefined) : undefined,
        failureReason: input.lookupResult.reason,
        includeKeyRequest: input.lookupResult.state === "rejected_source" &&
            BACKEND_REJECTED_SOURCE_REASONS.has(input.lookupResult.reason),
        failureSite: {
            stage: input.lookupResult.state === "rejected_source" &&
                BACKEND_REJECTED_SOURCE_REASONS.has(input.lookupResult.reason)
                ? "request"
                : "execution",
            component: input.lookupResult.state === "rejected_source" &&
                BACKEND_REJECTED_SOURCE_REASONS.has(input.lookupResult.reason)
                ? "network"
                : "page",
            target: input.lookupResult.state === "rejected_source" &&
                BACKEND_REJECTED_SOURCE_REASONS.has(input.lookupResult.reason)
                ? input.spec.endpoint
                : "captured_request_context",
            summary: input.lookupResult.reason
        }
    }), createReadDiagnosis(input.spec, {
        reason: input.lookupResult.reason,
        summary: failureSurface.message,
        category: backendRejectedSource ? "request_failed" : "page_changed"
    }), input.gate, input.auditRecord), input.gate.execution_audit);
};
const failClosedForSignedContinuity = (input, env) => {
    const message = resolveRejectedSourceMessage(input.spec, input.reason) ??
        `当前页面现场缺少可复用的 ${input.spec.command} signed continuity`;
    return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", message, {
        ability_id: input.abilityId,
        stage: "execution",
        reason: input.reason,
        request_context_result: "signed_continuity_invalid",
        request_context_shape: input.expectedShape,
        request_context_shape_key: serializeReadShape(input.expectedShape),
        signed_continuity: input.continuity
    }, createReadObservability({
        spec: input.spec,
        href: env.getLocationHref(),
        title: env.getDocumentTitle(),
        readyState: env.getReadyState(),
        requestId: `req-${env.randomId()}`,
        outcome: "failed",
        failureReason: input.reason,
        includeKeyRequest: false,
        failureSite: {
            stage: "execution",
            component: "page",
            target: "xhs.signed_continuity",
            summary: message
        }
    }), createReadDiagnosis(input.spec, {
        reason: input.reason,
        summary: message,
        category: "page_changed"
    }), input.gate, input.auditRecord), input.gate.execution_audit);
};
const createRedirectSignedContinuity = (spec, href) => ({
    source_url: href,
    target_url: null,
    ...(spec.command === "xhs.detail" ? { detail_url: href } : { user_home_url: href }),
    xsec_token: null,
    xsec_source: null,
    token_presence: "missing",
    observed_at: null,
    source_route: "unknown"
});
const createExplicitRequestContextResult = (input) => {
    const artifact = asRecord(input.artifact);
    if (!artifact) {
        return null;
    }
    const resolved = resolveReadRequestContext(input.spec, artifact, input.expectedShape, input.env.now(), {
        allowDetailRequestFallback: true,
        allowDetailResponseBareIdAlias: true
    });
    return resolved.state === "hit" ? resolved : null;
};
const buildActiveFallbackTemplateBinding = (input) => ({
    profile_ref: input.executionContext.profile,
    session_id: input.executionContext.sessionId,
    target_tab_id: typeof input.options.actual_target_tab_id === "number" ? input.options.actual_target_tab_id : null,
    run_id: input.executionContext.runId,
    action_ref: input.abilityAction,
    page_url: input.pageUrl
});
const normalizeBindingRefSegment = (value) => encodeURIComponent(value ?? "unknown").replace(/%/g, "_");
const stripXhsUrlQuery = (value) => {
    if (!value) {
        return null;
    }
    try {
        const url = new URL(value, "https://www.xiaohongshu.com");
        url.search = "";
        url.hash = "";
        return url.toString();
    }
    catch {
        return null;
    }
};
const summarizeSignedContinuityForBinding = (continuity) => ({
    source_route: continuity.source_route,
    xsec_source: continuity.xsec_source,
    token_presence: continuity.token_presence,
    credential_value_redaction_state: continuity.token_presence === "present" ? "redacted" : "not_applicable",
    source_url_without_query: stripXhsUrlQuery(continuity.source_url),
    target_url_without_query: stripXhsUrlQuery(continuity.target_url),
    detail_url_without_query: stripXhsUrlQuery(continuity.detail_url ?? null),
    user_home_url_without_query: stripXhsUrlQuery(continuity.user_home_url ?? null),
    observed_at: continuity.observed_at
});
const buildSignedContinuityBindingEvidence = (input) => {
    const options = input.executionInput.options;
    const blockers = [];
    const targetBindingSnapshotRef = asString(options.target_binding_snapshot_ref);
    const runtimeBindingRef = asString(options.runtime_binding_ref);
    const targetBindingSnapshot = asRecord(options.target_binding_snapshot);
    const runtimeBinding = asRecord(options.xhs_runtime_binding);
    const pageRuntimeReadiness = asRecord(options.xhs_page_runtime_readiness);
    const transitionEvidence = asRecordArray(options.target_binding_transition_evidence);
    if (input.templateEvidence.route_evidence_class !== "passive_api_capture") {
        blockers.push("passive_capture_template_missing");
    }
    if (input.templateEvidence.source_kind !== "page_request") {
        blockers.push("passive_capture_source_kind_invalid");
    }
    if (input.templateEvidence.profile_ref !== asString(input.binding.profile_ref)) {
        blockers.push("profile_ref_mismatch");
    }
    if (input.templateEvidence.session_id !== asString(input.binding.session_id)) {
        blockers.push("session_id_mismatch");
    }
    if (asInteger(input.binding.target_tab_id) === null) {
        blockers.push("target_tab_id_missing");
    }
    else if (input.templateEvidence.target_tab_id !== asInteger(input.binding.target_tab_id)) {
        blockers.push("target_tab_id_mismatch");
    }
    if (input.templateEvidence.run_id !== asString(input.binding.run_id)) {
        blockers.push("run_id_mismatch");
    }
    if (input.templateEvidence.action_ref !== asString(input.binding.action_ref)) {
        blockers.push("action_ref_mismatch");
    }
    if (!isSameXhsReadPageBinding({
        spec: input.spec,
        templatePageUrl: input.templateEvidence.page_url,
        currentPageUrl: input.pageUrl,
        signedContinuity: input.signedContinuity
    })) {
        blockers.push("page_url_mismatch");
    }
    if (input.signedContinuity.token_presence !== "present" || !input.signedContinuity.target_url) {
        blockers.push("signed_continuity_missing");
    }
    if (input.signedContinuity.source_route !== "xhs.search") {
        blockers.push("signed_continuity_source_route_mismatch");
    }
    if (input.signedContinuity.xsec_source !== "pc_search") {
        blockers.push("signed_continuity_xsec_source_mismatch");
    }
    blockers.push(...collectTargetBindingEvidenceBlockers(input.spec, targetBindingSnapshotRef, targetBindingSnapshot, pageRuntimeReadiness, transitionEvidence, input.executionInput.executionContext.runId).map((reason) => `target_binding:${reason}`), ...collectRuntimeBindingBlockers(input.spec, runtimeBindingRef, runtimeBinding, input.executionInput.executionContext.runId).map((reason) => `runtime_binding:${reason}`));
    const uniqueBlockers = Array.from(new Set(blockers));
    const bindingStatus = uniqueBlockers.length === 0 ? "bound" : "blocked";
    const bindingRef = [
        "FR-1171.xhs_signed_continuity_binding.v1",
        normalizeBindingRefSegment(input.executionInput.executionContext.runId),
        input.spec.routeBucket,
        normalizeBindingRefSegment(input.templateEvidence.template_identity)
    ].join("/");
    return {
        blockers: uniqueBlockers,
        evidence: {
            binding_version: "xhs_read_signed_continuity_binding.v1",
            owner_ref: "#1171",
            command: input.spec.command,
            binding_ref: bindingRef,
            binding_status: bindingStatus,
            blocking_reasons: uniqueBlockers,
            binding_freshness: "current_run",
            local_static_binding: true,
            cryptographic_signature: "not_applicable",
            subject: {
                profile_ref: input.executionInput.executionContext.profile,
                session_id: input.executionInput.executionContext.sessionId,
                run_id: input.executionInput.executionContext.runId,
                action_ref: input.executionInput.abilityAction,
                target_tab_id: asInteger(input.binding.target_tab_id),
                page_url: input.pageUrl,
                route_bucket: input.spec.routeBucket,
                target_page_class: input.spec.targetPageClass
            },
            linked_refs: {
                runtime_binding_ref: runtimeBindingRef,
                target_binding_snapshot_ref: targetBindingSnapshotRef,
                page_runtime_readiness_ref: asString(options.page_runtime_readiness_ref),
                passive_template_ref: input.templateEvidence.template_identity
            },
            provenance: {
                route_evidence_class: input.templateEvidence.route_evidence_class,
                source_kind: input.templateEvidence.source_kind,
                artifact_identity: input.templateEvidence.template_identity,
                observed_at: input.templateEvidence.observed_at,
                captured_at: input.templateEvidence.captured_at,
                page_context_namespace: input.templateEvidence.page_context_namespace,
                shape_key: input.templateEvidence.shape_key,
                target_binding_transition_refs: asStringArray(asRecord(targetBindingSnapshot?.evidence_refs)?.transition_refs)
            },
            signed_continuity_summary: summarizeSignedContinuityForBinding(input.signedContinuity),
            non_proofs: [
                "not_live_evidence_accepted",
                "not_syvert_normalized_result",
                "not_write_enabled",
                "not_external_cryptographic_signature"
            ]
        }
    };
};
const resolveActiveApiFetchFallbackGate = (input) => {
    const options = input.executionInput.options.active_api_fetch_fallback;
    const runtimeAttestation = asRecord(options?.runtime_attestation);
    const fingerprintAttestation = asRecord(options?.fingerprint_attestation);
    const binding = buildActiveFallbackTemplateBinding({
        executionContext: input.executionInput.executionContext,
        options: input.executionInput.options,
        abilityAction: input.executionInput.abilityAction,
        pageUrl: input.env.getLocationHref()
    });
    const signedContinuityBinding = buildSignedContinuityBindingEvidence({
        spec: input.executionInput.command === "xhs.detail" ? XHS_DETAIL_SPEC : XHS_USER_HOME_SPEC,
        executionInput: input.executionInput,
        templateEvidence: input.templateEvidence,
        signedContinuity: input.signedContinuity,
        binding,
        pageUrl: input.env.getLocationHref()
    });
    const reasonCodes = [];
    if (options?.enabled !== true) {
        reasonCodes.push("ACTIVE_API_FETCH_FALLBACK_NOT_APPROVED");
    }
    if (options?.account_safety_state !== "clear") {
        reasonCodes.push("ACCOUNT_SAFETY_NOT_CLEAR");
    }
    if (options?.rhythm_state !== "allowed") {
        reasonCodes.push("RHYTHM_NOT_ALLOWED");
    }
    if (options?.fingerprint_validation_state !== "ready" ||
        fingerprintAttestation?.source !== "content_script_fingerprint_runtime" ||
        fingerprintAttestation.validation_state !== "ready") {
        reasonCodes.push("FINGERPRINT_VALIDATION_NOT_READY");
    }
    if (runtimeAttestation?.source !== "official_chrome_runtime_readiness" ||
        runtimeAttestation.runtime_readiness !== "ready") {
        reasonCodes.push("RUNTIME_ATTESTATION_REQUIRED");
    }
    if (runtimeAttestation?.profile_ref !== binding.profile_ref ||
        runtimeAttestation?.session_id !== binding.session_id ||
        runtimeAttestation?.run_id !== binding.run_id) {
        reasonCodes.push("RUNTIME_ATTESTATION_BINDING_MISMATCH");
    }
    if (runtimeAttestation?.execution_surface !== "real_browser") {
        reasonCodes.push("EXECUTION_SURFACE_NOT_REAL_BROWSER");
    }
    if (runtimeAttestation?.headless !== false) {
        reasonCodes.push("HEADLESS_NOT_FALSE");
    }
    if (input.templateEvidence.route_evidence_class !== "passive_api_capture") {
        reasonCodes.push("PASSIVE_CAPTURE_TEMPLATE_REQUIRED");
    }
    if (input.templateEvidence.source_kind !== "page_request") {
        reasonCodes.push("PAGE_REQUEST_TEMPLATE_REQUIRED");
    }
    if (input.templateEvidence.observed_at === null ||
        input.templateEvidence.template_age_ms === null ||
        input.templateEvidence.template_age_ms > input.templateEvidence.freshness_window_ms) {
        reasonCodes.push("PASSIVE_CAPTURE_TEMPLATE_NOT_FRESH");
    }
    if (input.templateEvidence.profile_ref !== binding.profile_ref) {
        reasonCodes.push("PASSIVE_CAPTURE_PROFILE_MISMATCH");
    }
    if (input.templateEvidence.session_id !== binding.session_id) {
        reasonCodes.push("PASSIVE_CAPTURE_SESSION_MISMATCH");
    }
    if (binding.target_tab_id === null) {
        reasonCodes.push("TARGET_TAB_BINDING_REQUIRED");
    }
    if (input.templateEvidence.target_tab_id !== binding.target_tab_id) {
        reasonCodes.push("PASSIVE_CAPTURE_TAB_MISMATCH");
    }
    if (input.templateEvidence.run_id !== binding.run_id) {
        reasonCodes.push("PASSIVE_CAPTURE_RUN_MISMATCH");
    }
    if (input.templateEvidence.action_ref !== binding.action_ref) {
        reasonCodes.push("PASSIVE_CAPTURE_ACTION_MISMATCH");
    }
    if (input.templateEvidence.page_url !== binding.page_url) {
        reasonCodes.push("PASSIVE_CAPTURE_PAGE_MISMATCH");
    }
    if (input.signedContinuity.token_presence !== "present" || !input.signedContinuity.target_url) {
        reasonCodes.push("SIGNED_CONTINUITY_REQUIRED");
    }
    if (signedContinuityBinding.blockers.length > 0) {
        reasonCodes.push("SIGNED_CONTINUITY_BINDING_INVALID");
    }
    if (reasonCodes.length === 0) {
        return {
            gate_decision: "allowed",
            reason_codes: [],
            route_evidence_class: "active_api_fetch_fallback",
            route_role: "primary",
            path_kind: "api",
            evidence_status: "success",
            template_binding: {
                ...binding,
                runtime_attestation: runtimeAttestation,
                fingerprint_attestation: fingerprintAttestation
            },
            consumed_template: input.templateEvidence,
            signed_continuity_binding: signedContinuityBinding.evidence
        };
    }
    return {
        gate_decision: "blocked",
        reason_codes: reasonCodes,
        route_evidence_class: "active_api_fetch_fallback",
        route_role: "primary",
        path_kind: "api",
        evidence_status: "blocked",
        template_binding: {
            ...binding,
            runtime_attestation: runtimeAttestation,
            fingerprint_attestation: fingerprintAttestation
        },
        consumed_template: input.templateEvidence,
        signed_continuity_binding: signedContinuityBinding.evidence
    };
};
const buildProviderAwareReadPathSummaryFields = (options) => {
    const providerRequirementRefs = asStringArray(options.provider_requirement_refs);
    const targetBindingTransitionEvidence = asRecordArray(options.target_binding_transition_evidence);
    const downstreamSliceRefs = asStringArray(options.downstream_slice_refs);
    const nonProofs = asStringArray(options.non_proofs);
    const pageRuntimeReadinessBlockingReasons = asStringArray(options.page_runtime_readiness_blocking_reasons);
    return {
        ...(asRecord(options.xhs_driver_provider_requirements)
            ? {
                xhs_driver_provider_requirements: asRecord(options.xhs_driver_provider_requirements)
            }
            : {}),
        ...(providerRequirementRefs.length > 0
            ? { provider_requirement_refs: providerRequirementRefs }
            : {}),
        ...(asString(options.runtime_binding_ref)
            ? { runtime_binding_ref: asString(options.runtime_binding_ref) }
            : {}),
        ...(asString(options.target_binding_snapshot_ref)
            ? { target_binding_snapshot_ref: asString(options.target_binding_snapshot_ref) }
            : {}),
        ...(asRecord(options.xhs_runtime_binding)
            ? { xhs_runtime_binding: asRecord(options.xhs_runtime_binding) }
            : {}),
        ...(asRecord(options.target_binding_snapshot)
            ? { target_binding_snapshot: asRecord(options.target_binding_snapshot) }
            : {}),
        ...(targetBindingTransitionEvidence.length > 0
            ? { target_binding_transition_evidence: targetBindingTransitionEvidence }
            : {}),
        ...(downstreamSliceRefs.length > 0 ? { downstream_slice_refs: downstreamSliceRefs } : {}),
        ...(nonProofs.length > 0 ? { non_proofs: nonProofs } : {}),
        ...(asString(options.page_runtime_readiness_ref)
            ? { page_runtime_readiness_ref: asString(options.page_runtime_readiness_ref) }
            : {}),
        ...(asRecord(options.xhs_page_runtime_readiness)
            ? { xhs_page_runtime_readiness: asRecord(options.xhs_page_runtime_readiness) }
            : {}),
        ...(asString(options.page_runtime_readiness_decision)
            ? { page_runtime_readiness_decision: asString(options.page_runtime_readiness_decision) }
            : {}),
        ...(pageRuntimeReadinessBlockingReasons.length > 0
            ? { page_runtime_readiness_blocking_reasons: pageRuntimeReadinessBlockingReasons }
            : {})
    };
};
const BLOCKED_READINESS_STATUSES = new Set(["blocked", "deny", "denied", "not_ready"]);
const ALLOWED_REQUIRED_READINESS_STATUSES = new Set(["ready", "not_required"]);
const DENY_READINESS_DECISIONS = new Set(["deny", "denied", "blocked", "defer", "deferred"]);
const TARGET_BINDING_ALLOWED_STATES = new Set(["bound"]);
const RUNTIME_BINDING_ALLOWED_STATUSES = new Set(["declared", "ready"]);
const RUNTIME_BINDING_CURRENT_FRESHNESS = new Set(["current_run"]);
const ALLOWED_PROVIDER_AWARE_GATE_REASONS = new Set(["LIVE_MODE_APPROVED"]);
const EXPECTED_XHS_ABILITY_LAYER = "L3";
const EXPECTED_XHS_READ_ACTION = "read";
const EXPECTED_XHS_TARGET_DOMAIN = "www.xiaohongshu.com";
const parseTargetBindingSnapshotRef = (value) => {
    if (!value) {
        return null;
    }
    const match = /^FR-0063\.target_binding_snapshot\.v1\/([^/]+)\/([^/]+)$/.exec(value);
    if (!match) {
        return null;
    }
    return {
        runId: match[1] ?? "",
        routeBucket: match[2] ?? ""
    };
};
const parseRuntimeBindingRef = (value) => {
    if (!value) {
        return null;
    }
    const match = /^FR-0061\.xhs_runtime_binding\.v1\/([^/]+)\/([^/]+)$/.exec(value);
    if (!match) {
        return null;
    }
    return {
        runId: match[1] ?? "",
        routeBucket: match[2] ?? ""
    };
};
const parseTargetBindingEvidenceRefRunId = (value) => {
    if (!value) {
        return null;
    }
    const fr0063Match = /^FR-0063\.[^/]+\.v1\/([^/]+)\//.exec(value);
    if (fr0063Match) {
        return fr0063Match[1] ?? null;
    }
    const transitionMatch = /^target-binding-transition:([^:]+):/.exec(value);
    return transitionMatch?.[1] ?? null;
};
const isTargetBindingEvidenceRefCurrentRun = (value, activeRunId) => {
    const refRunId = parseTargetBindingEvidenceRefRunId(value);
    return !refRunId || refRunId === activeRunId;
};
const hasCurrentRunTransitionEvidence = (transitionRefs, transitionEvidence, activeRunId, reasons) => {
    let hasTransitionEvidence = false;
    for (const transitionRef of transitionRefs) {
        if (transitionRef.length === 0) {
            continue;
        }
        hasTransitionEvidence = true;
        if (!isTargetBindingEvidenceRefCurrentRun(transitionRef, activeRunId)) {
            reasons.push("target_binding_evidence_ref_mismatch");
        }
    }
    for (const transition of transitionEvidence) {
        const transitionId = asString(transition.transition_id);
        if (!transitionId) {
            continue;
        }
        hasTransitionEvidence = true;
        if (!isTargetBindingEvidenceRefCurrentRun(transitionId, activeRunId)) {
            reasons.push("target_binding_evidence_ref_mismatch");
        }
    }
    return hasTransitionEvidence;
};
const collectTargetBindingRequiredEvidenceRefBlockers = (targetBindingSnapshot, transitionEvidence, activeRunId) => {
    if (asString(targetBindingSnapshot.state) !== "bound") {
        return [];
    }
    const reasons = [];
    const evidenceRefs = asRecord(targetBindingSnapshot.evidence_refs);
    if (!evidenceRefs) {
        return [
            "target_binding_evidence_refs_missing",
            "target_binding_candidate_ref_missing",
            "target_binding_url_match_ref_missing",
            "target_binding_dom_observation_ref_missing",
            "target_binding_runtime_state_ref_missing",
            "target_binding_extension_bridge_ref_missing",
            "target_binding_transition_refs_missing"
        ];
    }
    const requiredRefs = [
        ["candidate_ref", "target_binding_candidate_ref_missing"],
        ["url_match_ref", "target_binding_url_match_ref_missing"],
        ["dom_observation_ref", "target_binding_dom_observation_ref_missing"],
        ["runtime_state_ref", "target_binding_runtime_state_ref_missing"],
        ["extension_bridge_ref", "target_binding_extension_bridge_ref_missing"]
    ];
    for (const [field, missingReason] of requiredRefs) {
        const ref = asString(evidenceRefs[field]);
        if (!ref) {
            reasons.push(missingReason);
            continue;
        }
        if (!isTargetBindingEvidenceRefCurrentRun(ref, activeRunId)) {
            reasons.push("target_binding_evidence_ref_mismatch");
        }
    }
    const transitionRefs = asStringArray(evidenceRefs.transition_refs);
    if (!hasCurrentRunTransitionEvidence(transitionRefs, transitionEvidence, activeRunId, reasons)) {
        reasons.push("target_binding_transition_refs_missing");
    }
    const redactionState = asString(evidenceRefs.redaction_state ?? targetBindingSnapshot.redaction_state);
    if (redactionState === "redaction_required" ||
        redactionState === "policy_missing" ||
        redactionState === "invalid") {
        reasons.push("target_binding_redaction_invalid");
    }
    const evidenceStatus = asString(evidenceRefs.evidence_status ?? targetBindingSnapshot.evidence_status);
    const evidenceCompleteness = asString(evidenceRefs.evidence_completeness ?? targetBindingSnapshot.evidence_completeness);
    const partial = evidenceRefs.partial ?? targetBindingSnapshot.partial;
    if (evidenceStatus === "partial" ||
        evidenceStatus === "unavailable" ||
        evidenceStatus === "unknown" ||
        evidenceStatus === "invalid" ||
        evidenceCompleteness === "partial" ||
        evidenceCompleteness === "unavailable" ||
        evidenceCompleteness === "unknown" ||
        evidenceCompleteness === "invalid" ||
        partial === true) {
        reasons.push("target_binding_evidence_partial");
    }
    const sourceOwner = asString(evidenceRefs.source_owner ?? targetBindingSnapshot.source_owner);
    if (sourceOwner &&
        sourceOwner !== "#1161" &&
        sourceOwner !== "target_binding_state_machine" &&
        sourceOwner !== "xhs_target_binding_state_machine") {
        reasons.push("target_binding_source_owner_mismatch");
    }
    return reasons;
};
const collectTargetBindingEvidenceBlockers = (spec, targetBindingSnapshotRef, targetBindingSnapshot, pageRuntimeReadiness, transitionEvidence, activeRunId) => {
    if (!targetBindingSnapshot) {
        return [];
    }
    const reasons = [];
    const parsedRef = parseTargetBindingSnapshotRef(targetBindingSnapshotRef);
    if (targetBindingSnapshotRef && !parsedRef) {
        reasons.push("target_binding_ref_mismatch");
    }
    const freshnessScope = asString(targetBindingSnapshot.freshness_scope);
    if (!freshnessScope) {
        reasons.push("target_binding_freshness_missing");
    }
    else if (freshnessScope !== "current_run") {
        if (freshnessScope === "historical_background" ||
            freshnessScope === "stale" ||
            freshnessScope === "lost") {
            reasons.push("target_binding_freshness_stale");
        }
        else if (freshnessScope === "unknown") {
            reasons.push("target_binding_freshness_unknown");
        }
        reasons.push(`target_binding_freshness:${freshnessScope}`);
    }
    const snapshotRunId = asString(targetBindingSnapshot.run_id);
    const readinessRunId = asString(pageRuntimeReadiness?.run_id);
    if (!snapshotRunId) {
        reasons.push("target_binding_run_id_missing");
    }
    else if (snapshotRunId !== activeRunId) {
        reasons.push("target_binding_run_id_mismatch");
    }
    if (pageRuntimeReadiness && !readinessRunId) {
        reasons.push("page_runtime_readiness_run_id_missing");
    }
    else if (readinessRunId && readinessRunId !== activeRunId) {
        reasons.push("page_runtime_readiness_run_id_mismatch");
    }
    if (parsedRef) {
        if (parsedRef.routeBucket !== spec.routeBucket) {
            reasons.push("target_binding_ref_mismatch");
            reasons.push(`target_binding_ref_route:${parsedRef.routeBucket}`);
        }
        if (parsedRef.runId !== activeRunId) {
            reasons.push("target_binding_ref_mismatch");
        }
        if (snapshotRunId && parsedRef.runId !== snapshotRunId) {
            reasons.push("target_binding_ref_mismatch");
        }
        if (readinessRunId && parsedRef.runId !== readinessRunId) {
            reasons.push("target_binding_ref_mismatch");
        }
    }
    if (snapshotRunId && readinessRunId && snapshotRunId !== readinessRunId) {
        reasons.push("target_binding_run_id_mismatch");
    }
    const targetScope = asRecord(targetBindingSnapshot.target_scope);
    if (!targetScope) {
        reasons.push("target_binding_scope_missing");
    }
    else {
        const targetDomain = asString(targetScope.target_domain);
        const targetPageClass = asString(targetScope.target_page_class);
        if (targetDomain !== EXPECTED_XHS_TARGET_DOMAIN ||
            targetPageClass !== spec.targetPageClass) {
            reasons.push("target_binding_scope_mismatch");
        }
    }
    const routeBucket = asString(targetBindingSnapshot.route_bucket);
    if (routeBucket !== spec.routeBucket) {
        reasons.push("target_binding_scope_mismatch");
    }
    reasons.push(...collectTargetBindingRequiredEvidenceRefBlockers(targetBindingSnapshot, transitionEvidence, activeRunId));
    return reasons;
};
const collectProviderRequirementBlockers = (spec, providerRequirements, providerRequirementRefs) => {
    if (!providerRequirements) {
        return [];
    }
    const reasons = [];
    const declarationRefs = asStringArray(providerRequirements.provider_requirement_refs);
    if (providerRequirementRefs.length === 0 || declarationRefs.length === 0) {
        return reasons;
    }
    const declarationRefSet = new Set(declarationRefs);
    if (!providerRequirementRefs.every((ref) => declarationRefSet.has(ref)) ||
        !declarationRefSet.has(spec.providerRequirementRef)) {
        reasons.push("provider_requirement_ref_mismatch");
    }
    const primaryRequirementRef = asString(providerRequirements.provider_requirement_ref);
    if (primaryRequirementRef && primaryRequirementRef !== spec.providerRequirementRef) {
        reasons.push("provider_requirement_ref_mismatch");
    }
    const abilityScope = asRecord(providerRequirements.ability_scope);
    const command = asString(abilityScope?.command);
    const abilityId = asString(abilityScope?.ability_id);
    const abilityLayer = asString(abilityScope?.ability_layer);
    const action = asString(abilityScope?.ability_action);
    if (command !== spec.command ||
        abilityId !== spec.abilityId ||
        abilityLayer !== EXPECTED_XHS_ABILITY_LAYER ||
        action !== EXPECTED_XHS_READ_ACTION) {
        reasons.push("provider_requirement_scope_mismatch");
    }
    const requiredActions = asStringArray(providerRequirements.required_actions);
    if (!requiredActions.includes(EXPECTED_XHS_READ_ACTION)) {
        reasons.push("provider_requirement_scope_mismatch");
    }
    return reasons;
};
const collectRuntimeBindingBlockers = (spec, runtimeBindingRef, runtimeBinding, activeRunId) => {
    const reasons = [];
    if (!runtimeBindingRef) {
        reasons.push("runtime_binding_ref_missing");
    }
    else {
        const parsedRuntimeBindingRef = parseRuntimeBindingRef(runtimeBindingRef);
        if (!parsedRuntimeBindingRef ||
            parsedRuntimeBindingRef.routeBucket !== spec.routeBucket ||
            parsedRuntimeBindingRef.runId !== activeRunId) {
            reasons.push("runtime_binding_ref_mismatch");
        }
    }
    if (!runtimeBinding) {
        reasons.push("runtime_binding_evidence_missing");
        return reasons;
    }
    const targetDomain = asString(runtimeBinding.target_domain);
    const targetPage = asString(runtimeBinding.target_page);
    if (targetDomain !== EXPECTED_XHS_TARGET_DOMAIN ||
        targetPage !== spec.targetPageClass) {
        reasons.push("runtime_binding_scope_mismatch");
    }
    const bindingStatus = asString(runtimeBinding.binding_status);
    if (!bindingStatus) {
        reasons.push("runtime_binding_status_missing");
    }
    else if (!RUNTIME_BINDING_ALLOWED_STATUSES.has(bindingStatus)) {
        reasons.push("runtime_binding_not_bound");
        reasons.push(`runtime_binding_status:${bindingStatus}`);
    }
    const bindingFreshness = asString(runtimeBinding.binding_freshness);
    if (!bindingFreshness) {
        reasons.push("runtime_binding_freshness_missing");
    }
    else if (!RUNTIME_BINDING_CURRENT_FRESHNESS.has(bindingFreshness)) {
        if (bindingFreshness === "historical_background") {
            reasons.push("runtime_binding_stale");
        }
        reasons.push(`runtime_binding_freshness:${bindingFreshness}`);
    }
    return reasons;
};
const collectReadinessDimensionBlockers = (dimension, prefix, missingReason) => {
    if (!dimension) {
        return [missingReason];
    }
    if (dimension.required === false) {
        return [];
    }
    const status = asString(dimension.status);
    const gateDecision = asString(dimension.gate_decision);
    const blockingReasons = asStringArray(dimension.blocking_reasons);
    const reasons = [];
    if (!status) {
        reasons.push(`${prefix}:status_missing`);
    }
    else if (!ALLOWED_REQUIRED_READINESS_STATUSES.has(status)) {
        reasons.push(`${prefix}:${status}`);
    }
    if (gateDecision && DENY_READINESS_DECISIONS.has(gateDecision)) {
        reasons.push(`${prefix}:${gateDecision}`);
    }
    reasons.push(...blockingReasons.map((reason) => `${prefix}:${reason}`));
    return reasons;
};
const resolveProviderAwareReadPathBlock = (spec, options, activeRunId) => {
    const summaryFields = buildProviderAwareReadPathSummaryFields(options);
    const targetBindingSnapshot = asRecord(options.target_binding_snapshot);
    const pageRuntimeReadiness = asRecord(options.xhs_page_runtime_readiness);
    const pageReadiness = asRecord(pageRuntimeReadiness?.page_readiness);
    const runtimeReadiness = asRecord(pageRuntimeReadiness?.runtime_readiness);
    const providerAdmissionReadiness = asRecord(pageRuntimeReadiness?.provider_admission_readiness);
    const runtimeBindingRef = asString(options.runtime_binding_ref);
    const runtimeBinding = asRecord(options.xhs_runtime_binding);
    const targetBindingState = asString(targetBindingSnapshot?.state);
    const targetBindingSnapshotRef = asString(options.target_binding_snapshot_ref);
    const providerRequirements = asRecord(options.xhs_driver_provider_requirements);
    const providerRequirementRefs = asStringArray(options.provider_requirement_refs);
    const providerRequirementDeclarationRefs = asStringArray(providerRequirements?.provider_requirement_refs);
    const readinessCommand = asString(pageRuntimeReadiness?.command);
    const reasons = [
        ...(targetBindingSnapshot ? [] : ["target_binding_snapshot_missing"]),
        ...(targetBindingSnapshotRef ? [] : ["target_binding_snapshot_ref_missing"]),
        ...(providerRequirements ? [] : ["xhs_driver_provider_requirements_missing"]),
        ...(providerRequirementRefs.length > 0 && providerRequirementDeclarationRefs.length > 0
            ? []
            : ["provider_requirement_refs_missing"]),
        ...(pageRuntimeReadiness ? [] : ["page_runtime_readiness_missing"]),
        ...(readinessCommand && readinessCommand !== spec.command
            ? ["page_runtime_readiness_command_mismatch"]
            : []),
        ...collectTargetBindingEvidenceBlockers(spec, targetBindingSnapshotRef, targetBindingSnapshot, pageRuntimeReadiness, asRecordArray(options.target_binding_transition_evidence), activeRunId),
        ...collectProviderRequirementBlockers(spec, providerRequirements, providerRequirementRefs),
        ...collectRuntimeBindingBlockers(spec, runtimeBindingRef, runtimeBinding, activeRunId),
        ...asStringArray(targetBindingSnapshot?.blocking_reasons).map((reason) => `target_binding:${reason}`),
        ...collectReadinessDimensionBlockers(pageReadiness, "page", "page_readiness_missing"),
        ...collectReadinessDimensionBlockers(runtimeReadiness, "runtime", "runtime_readiness_missing"),
        ...collectReadinessDimensionBlockers(providerAdmissionReadiness, "provider", "provider_admission_result_missing"),
        ...asStringArray(options.page_runtime_readiness_blocking_reasons)
    ];
    const overallReadiness = asString(pageRuntimeReadiness?.overall_readiness);
    const readinessGateDecision = asString(pageRuntimeReadiness?.gate_decision);
    const optionReadinessDecision = asString(options.page_runtime_readiness_decision);
    if (!TARGET_BINDING_ALLOWED_STATES.has(targetBindingState ?? "")) {
        reasons.push("target_binding:target_binding_not_bound");
        reasons.push(`target_binding_state:${targetBindingState ?? "missing"}`);
    }
    if (overallReadiness && BLOCKED_READINESS_STATUSES.has(overallReadiness)) {
        reasons.push(`overall_readiness:${overallReadiness}`);
    }
    if (readinessGateDecision && DENY_READINESS_DECISIONS.has(readinessGateDecision)) {
        reasons.push(`page_runtime_gate:${readinessGateDecision}`);
    }
    if (optionReadinessDecision && DENY_READINESS_DECISIONS.has(optionReadinessDecision)) {
        reasons.push(`page_runtime_readiness_decision:${optionReadinessDecision}`);
    }
    const uniqueReasons = Array.from(new Set(reasons));
    if (uniqueReasons.length === 0) {
        return null;
    }
    return {
        reason: "PROVIDER_AWARE_READINESS_DENIED",
        reasons: uniqueReasons,
        summaryFields
    };
};
const withoutAllowedProviderAwareGateReasons = (reasons) => reasons.filter((reason) => !ALLOWED_PROVIDER_AWARE_GATE_REASONS.has(reason));
const uniqueProviderAwareBlockReasons = (baseReasons, block) => Array.from(new Set([
    ...withoutAllowedProviderAwareGateReasons(baseReasons),
    "PROVIDER_AWARE_READINESS_DENIED",
    "PROVIDER_AWARE_LIVE_READ_NOT_CONTINUED",
    ...block.reasons
]));
const resolveBlockedNextRiskState = (current) => {
    if (current === "allowed") {
        return "limited";
    }
    if (current === "limited") {
        return "paused";
    }
    return current;
};
const isProviderAwareLiveReadGate = (gate) => gate.consumer_gate_result.action_type === "read" &&
    (gate.consumer_gate_result.effective_execution_mode === "live_read_limited" ||
        gate.consumer_gate_result.effective_execution_mode === "live_read_high_risk");
const withProviderAwareReadPathBlockPayload = (result, gate, auditRecord, block) => {
    if (result.ok) {
        return result;
    }
    const blockedGateReasons = uniqueProviderAwareBlockReasons(gate.consumer_gate_result.gate_reasons, block);
    const blockedConsumerGateResult = {
        ...gate.consumer_gate_result,
        effective_execution_mode: null,
        gate_decision: "blocked",
        gate_reasons: blockedGateReasons
    };
    const blockedGateOutcome = {
        ...gate.gate_outcome,
        effective_execution_mode: null,
        gate_decision: "blocked",
        gate_reasons: uniqueProviderAwareBlockReasons(gate.gate_outcome.gate_reasons, block),
        requires_manual_confirmation: false
    };
    const blockedRequestAdmissionResult = gate.request_admission_result
        ? {
            ...gate.request_admission_result,
            admission_decision: "blocked",
            effective_runtime_mode: null,
            reason_codes: uniqueProviderAwareBlockReasons([], block)
        }
        : gate.request_admission_result;
    const recordedAtMs = Date.parse(auditRecord.recorded_at);
    const cooldownBase = Number.isFinite(recordedAtMs) ? recordedAtMs : Date.now();
    const blockedAuditRecord = {
        ...auditRecord,
        effective_execution_mode: null,
        gate_decision: "blocked",
        gate_reasons: blockedGateReasons,
        risk_signal: true,
        recovery_signal: false,
        session_rhythm_state: "cooldown",
        cooldown_until: new Date(cooldownBase + 30 * 60_000).toISOString(),
        recovery_started_at: null,
        next_state: resolveBlockedNextRiskState(auditRecord.risk_state),
        transition_trigger: "provider_aware_readiness_denied"
    };
    const blockedGate = {
        ...gate,
        gate_outcome: blockedGateOutcome,
        consumer_gate_result: blockedConsumerGateResult,
        request_admission_result: blockedRequestAdmissionResult
    };
    return {
        ...result,
        payload: {
            ...result.payload,
            ...block.summaryFields,
            provider_aware_read_path_gate: {
                gate_decision: "blocked",
                reason: block.reason,
                blocking_reasons: block.reasons,
                live_execution_continued: false,
                effective_execution_mode: null
            },
            gate_outcome: blockedGateOutcome,
            consumer_gate_result: blockedConsumerGateResult,
            request_admission_result: blockedRequestAdmissionResult,
            risk_state_output: resolveRiskStateOutput(blockedGate, blockedAuditRecord),
            audit_record: blockedAuditRecord
        }
    };
};
const resolvePassiveApiCaptureCloseoutGate = (input) => {
    const spec = READ_COMMAND_SPECS[input.executionInput.command];
    const binding = buildActiveFallbackTemplateBinding({
        executionContext: input.executionInput.executionContext,
        options: input.executionInput.options,
        abilityAction: input.executionInput.abilityAction,
        pageUrl: input.env.getLocationHref()
    });
    const signedContinuityBinding = buildSignedContinuityBindingEvidence({
        spec,
        executionInput: input.executionInput,
        templateEvidence: input.templateEvidence,
        signedContinuity: input.signedContinuity,
        binding,
        pageUrl: input.env.getLocationHref()
    });
    const reasonCodes = [];
    if (input.templateEvidence.route_evidence_class !== "passive_api_capture") {
        reasonCodes.push("PASSIVE_CAPTURE_TEMPLATE_REQUIRED");
    }
    if (input.templateEvidence.source_kind !== "page_request") {
        reasonCodes.push("PAGE_REQUEST_TEMPLATE_REQUIRED");
    }
    if (input.templateEvidence.observed_at === null ||
        input.templateEvidence.template_age_ms === null ||
        input.templateEvidence.template_age_ms > input.templateEvidence.freshness_window_ms) {
        reasonCodes.push("PASSIVE_CAPTURE_TEMPLATE_NOT_FRESH");
    }
    if (input.templateEvidence.profile_ref !== binding.profile_ref) {
        reasonCodes.push("PASSIVE_CAPTURE_PROFILE_MISMATCH");
    }
    if (input.templateEvidence.session_id !== binding.session_id) {
        reasonCodes.push("PASSIVE_CAPTURE_SESSION_MISMATCH");
    }
    if (binding.target_tab_id === null) {
        reasonCodes.push("TARGET_TAB_BINDING_REQUIRED");
    }
    if (input.templateEvidence.target_tab_id !== binding.target_tab_id) {
        reasonCodes.push("PASSIVE_CAPTURE_TAB_MISMATCH");
    }
    if (input.templateEvidence.run_id !== binding.run_id) {
        reasonCodes.push("PASSIVE_CAPTURE_RUN_MISMATCH");
    }
    if (input.templateEvidence.action_ref !== binding.action_ref) {
        reasonCodes.push("PASSIVE_CAPTURE_ACTION_MISMATCH");
    }
    if (!isSameXhsReadPageBinding({
        spec,
        templatePageUrl: input.templateEvidence.page_url,
        currentPageUrl: asString(binding.page_url),
        signedContinuity: input.signedContinuity
    })) {
        reasonCodes.push("PASSIVE_CAPTURE_PAGE_MISMATCH");
    }
    if (input.signedContinuity.token_presence !== "present" || !input.signedContinuity.target_url) {
        reasonCodes.push("SIGNED_CONTINUITY_REQUIRED");
    }
    if (signedContinuityBinding.blockers.length > 0) {
        reasonCodes.push("SIGNED_CONTINUITY_BINDING_INVALID");
    }
    return {
        gate_decision: reasonCodes.length === 0 ? "allowed" : "blocked",
        reason_codes: reasonCodes,
        route_evidence_class: "passive_api_capture",
        route_role: "primary",
        path_kind: "api",
        evidence_status: reasonCodes.length === 0 ? "success" : "blocked",
        template_binding: binding,
        consumed_template: input.templateEvidence,
        signed_continuity_binding: signedContinuityBinding.evidence
    };
};
const createPassiveApiCaptureSuccess = (input, spec, gate, auditRecord, env, requestContextResult, startedAt) => {
    if (input.options.closeout_evidence_evaluation !== true) {
        return null;
    }
    const template = requestContextResult.templateEvidence;
    if (template.route_evidence_class !== "passive_api_capture" ||
        template.source_kind !== "page_request" ||
        requestContextResult.responseStatus === null ||
        requestContextResult.responseStatus >= 400 ||
        !responseContainsRequestedTarget(spec, input.params, requestContextResult.responseBody, requestContextResult.signedContinuity)) {
        return null;
    }
    const passiveCaptureGate = resolvePassiveApiCaptureCloseoutGate({
        executionInput: input,
        templateEvidence: template,
        signedContinuity: requestContextResult.signedContinuity,
        env
    });
    if (passiveCaptureGate.gate_decision !== "allowed") {
        const expectedShape = deriveReadShapeFromCommand(spec, input.params);
        const message = `passive_api_capture closeout 门禁阻断了当前 ${spec.command} 请求`;
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", message, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "PASSIVE_API_CAPTURE_CLOSEOUT_GATE_BLOCKED",
            request_context_shape: expectedShape,
            request_context_shape_key: serializeReadShape(expectedShape),
            passive_api_capture_closeout_gate: passiveCaptureGate
        }, createReadObservability({
            spec,
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "PASSIVE_API_CAPTURE_CLOSEOUT_GATE_BLOCKED",
            includeKeyRequest: false,
            failureSite: {
                stage: "execution",
                component: "gate",
                target: "xhs.passive_api_capture_closeout_gate",
                summary: message
            }
        }), createReadDiagnosis(spec, {
            reason: "PASSIVE_API_CAPTURE_CLOSEOUT_GATE_BLOCKED",
            summary: message,
            category: "page_changed"
        }), gate, auditRecord), gate.execution_audit);
    }
    const pageUrl = env.getLocationHref();
    const headSha = asString(input.options.__runtime_latest_head_sha);
    const artifactIdentity = template.template_identity;
    const targetTabId = typeof input.options.actual_target_tab_id === "number"
        ? input.options.actual_target_tab_id
        : typeof input.options.target_tab_id === "number"
            ? input.options.target_tab_id
            : null;
    const routeEvidence = {
        route: `${spec.command}.api`,
        route_role: "primary",
        path_kind: "api",
        evidence_status: "success",
        evidence_class: "passive_api_capture",
        route_evidence_class: "passive_api_capture",
        source_kind: "page_request",
        method: spec.method,
        endpoint: spec.endpoint,
        request_url: requestContextResult.requestUrl ?? spec.buildSignatureUri(input.params),
        status_code: requestContextResult.responseStatus,
        head_sha: headSha,
        run_id: input.executionContext.runId,
        artifact_identity: artifactIdentity,
        profile_ref: input.executionContext.profile,
        session_id: input.executionContext.sessionId,
        target_tab_id: targetTabId,
        page_url: pageUrl,
        action_ref: input.abilityAction,
        observed_at: template.observed_at,
        captured_at: template.captured_at,
        reproduced_multi_round: false,
        passive_api_capture_closeout_gate: passiveCaptureGate,
        consumed_template: template,
        signed_continuity_binding: asRecord(passiveCaptureGate.signed_continuity_binding)
    };
    const signedContinuityBinding = asRecord(passiveCaptureGate.signed_continuity_binding);
    return {
        ok: true,
        payload: {
            summary: {
                capability_result: {
                    ability_id: input.abilityId,
                    layer: input.abilityLayer,
                    action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                    outcome: "success",
                    data_ref: spec.buildDataRef(input.params, requestContextResult.requestBody ?? {}),
                    metrics: {
                        count: 1,
                        duration_ms: Math.max(0, env.now() - startedAt)
                    }
                },
                scope_context: gate.scope_context,
                gate_input: {
                    run_id: auditRecord.run_id,
                    session_id: auditRecord.session_id,
                    profile: auditRecord.profile,
                    ...gate.gate_input
                },
                gate_outcome: gate.gate_outcome,
                read_execution_policy: gate.read_execution_policy,
                issue_action_matrix: gate.issue_action_matrix,
                consumer_gate_result: gate.consumer_gate_result,
                request_admission_result: gate.request_admission_result,
                execution_audit: gate.execution_audit,
                approval_record: gate.approval_record,
                risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                audit_record: auditRecord,
                ...buildProviderAwareReadPathSummaryFields(input.options),
                signed_continuity: requestContextResult.signedContinuity,
                ...(signedContinuityBinding
                    ? { signed_continuity_binding: signedContinuityBinding }
                    : {}),
                ...withPassiveApiCaptureEvidenceDiagnostic({
                    spec,
                    templateEvidence: template,
                    requestUrl: requestContextResult.requestUrl,
                    responseStatus: requestContextResult.responseStatus,
                    executionInput: input,
                    targetTabId,
                    pageUrl
                }),
                route_evidence: routeEvidence,
                closeout_route_evidence: routeEvidence
            },
            observability: createReadObservability({
                spec,
                href: pageUrl,
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "completed",
                statusCode: requestContextResult.responseStatus
            })
        }
    };
};
const failClosedForActiveApiFetchFallbackGate = (input, env) => {
    const message = `active_api_fetch_fallback 门禁阻断了当前 ${input.spec.command} 请求`;
    return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", message, {
        ability_id: input.abilityId,
        stage: "execution",
        reason: "ACTIVE_API_FETCH_FALLBACK_GATE_BLOCKED",
        request_context_shape: input.expectedShape,
        request_context_shape_key: serializeReadShape(input.expectedShape),
        active_api_fetch_fallback_gate: input.gateResult
    }, createReadObservability({
        spec: input.spec,
        href: env.getLocationHref(),
        title: env.getDocumentTitle(),
        readyState: env.getReadyState(),
        requestId: `req-${env.randomId()}`,
        outcome: "failed",
        failureReason: "ACTIVE_API_FETCH_FALLBACK_GATE_BLOCKED",
        includeKeyRequest: false,
        failureSite: {
            stage: "execution",
            component: "gate",
            target: "xhs.active_api_fetch_fallback_gate",
            summary: message
        }
    }), createReadDiagnosis(input.spec, {
        reason: "ACTIVE_API_FETCH_FALLBACK_GATE_BLOCKED",
        summary: message,
        category: "page_changed"
    }), input.gate, input.auditRecord), input.gate.execution_audit);
};
const resolveRequestContextFailureSurface = (spec, lookupResult) => {
    const isIncompatible = lookupResult.state === "incompatible" || lookupResult.reason === "shape_mismatch";
    if (lookupResult.state === "error") {
        return {
            resultKind: "request_context_missing",
            message: `当前页面现场请求上下文读取失败，无法继续执行 ${spec.command}`,
            reasonCode: "REQUEST_CONTEXT_READ_FAILED"
        };
    }
    const rejectedSourceMessage = lookupResult.state === "rejected_source"
        ? resolveRejectedSourceMessage(spec, lookupResult.reason)
        : null;
    const resultKind = isIncompatible ? "request_context_incompatible" : "request_context_missing";
    const message = rejectedSourceMessage ??
        (isIncompatible
            ? `当前页面现场不存在与 ${spec.command} 完全一致的请求上下文`
            : `当前页面现场缺少可复用的 ${spec.command} 请求上下文`);
    const reasonCode = rejectedSourceMessage && BACKEND_REJECTED_SOURCE_REASONS.has(lookupResult.reason)
        ? lookupResult.reason
        : isIncompatible
            ? "REQUEST_CONTEXT_INCOMPATIBLE"
            : "REQUEST_CONTEXT_MISSING";
    return {
        resultKind,
        message,
        reasonCode
    };
};
const readCapturedReadContextWithRetry = async (spec, expectedShape, env, binding) => {
    const readCapturedRequestContext = env.readCapturedRequestContext;
    if (!readCapturedRequestContext) {
        return resolveReadRequestContext(spec, null, expectedShape, env.now());
    }
    let pageContextNamespace = createPageContextNamespace(env.getLocationHref());
    const lookupOnce = async () => {
        try {
            const result = await readCapturedRequestContext({
                method: spec.method,
                path: spec.endpoint,
                page_context_namespace: pageContextNamespace,
                shape_key: serializeReadShape(expectedShape),
                ...(typeof binding?.profile_ref === "string" ? { profile_ref: binding.profile_ref } : {}),
                ...(typeof binding?.session_id === "string" ? { session_id: binding.session_id } : {}),
                ...(typeof binding?.target_tab_id === "number" ? { target_tab_id: binding.target_tab_id } : {}),
                ...(typeof binding?.run_id === "string" ? { run_id: binding.run_id } : {}),
                ...(typeof binding?.action_ref === "string" ? { action_ref: binding.action_ref } : {}),
                ...(typeof binding?.page_url === "string" ? { page_url: binding.page_url } : {})
            });
            const nextNamespace = asString(asRecord(result)?.page_context_namespace);
            if (nextNamespace) {
                pageContextNamespace = nextNamespace;
            }
            return resolveReadRequestContext(spec, result, expectedShape, env.now());
        }
        catch (error) {
            return {
                state: "error",
                reason: "request_context_read_failed",
                detail: error instanceof Error ? error.message : String(error)
            };
        }
    };
    let lastResult = await lookupOnce();
    for (let attempt = 1; attempt < REQUEST_CONTEXT_WAIT_MAX_ATTEMPTS && lastResult.state !== "hit"; attempt += 1) {
        await waitForRequestContextRetry(env, REQUEST_CONTEXT_WAIT_RETRY_MS);
        lastResult = await lookupOnce();
    }
    return lastResult;
};
const withExecutionAuditInFailurePayload = (result, executionAudit) => {
    if (result.ok) {
        return result;
    }
    return {
        ...result,
        payload: {
            ...result.payload,
            execution_audit: executionAudit
        }
    };
};
const classifyPageKind = (href, fallback) => {
    if (href.includes("/login")) {
        return "login";
    }
    if (/\/search_result\/[^/?#]+/u.test(href)) {
        return "detail";
    }
    if (href.includes("/search_result")) {
        return "search";
    }
    if (href.includes("/explore/")) {
        return "detail";
    }
    if (href.includes("/user/profile/")) {
        return "user_home";
    }
    return fallback;
};
const createReadObservability = (input) => ({
    page_state: {
        page_kind: classifyPageKind(input.href, input.spec.pageKind),
        url: input.href,
        title: input.title,
        ready_state: input.readyState
    },
    key_requests: input.includeKeyRequest === false
        ? []
        : [
            {
                request_id: input.requestId,
                stage: "request",
                method: input.spec.method,
                url: input.spec.endpoint,
                outcome: input.outcome,
                ...(typeof input.statusCode === "number" ? { status_code: input.statusCode } : {}),
                ...(input.failureReason
                    ? { failure_reason: input.failureReason, request_class: input.spec.requestClass }
                    : {})
            }
        ],
    failure_site: input.outcome === "failed"
        ? (input.failureSite ?? {
            stage: "request",
            component: "network",
            target: input.spec.endpoint,
            summary: input.failureReason ?? "request failed"
        })
        : null
});
const inferReadFailure = (spec, status, body) => {
    const record = asRecord(body);
    const businessCode = asInteger(record?.code);
    const message = typeof record?.msg === "string"
        ? record.msg
        : typeof record?.message === "string"
            ? record.message
            : "";
    const normalized = `${message}`.toLowerCase();
    const hasCaptchaEvidence = normalized.includes("captcha") ||
        message.includes("验证码") ||
        message.includes("人机验证") ||
        message.includes("滑块");
    if (status === 401 || normalized.includes("login")) {
        return {
            reason: "SESSION_EXPIRED",
            message: `登录已失效，无法执行 ${spec.command}`
        };
    }
    if (status === 461 || businessCode === 300011) {
        return {
            reason: "ACCOUNT_ABNORMAL",
            message: "账号异常，平台拒绝当前请求"
        };
    }
    if (businessCode === 300015 || normalized.includes("browser environment abnormal")) {
        return {
            reason: "BROWSER_ENV_ABNORMAL",
            message: "浏览器环境异常，平台拒绝当前请求"
        };
    }
    if (status >= 500 || normalized.includes("create invoker failed")) {
        return {
            reason: "GATEWAY_INVOKER_FAILED",
            message: `网关调用失败，当前上下文不足以完成 ${spec.command} 请求`
        };
    }
    if (hasCaptchaEvidence) {
        return {
            reason: "CAPTCHA_REQUIRED",
            message: "平台要求额外人机验证，无法继续执行"
        };
    }
    return {
        reason: "TARGET_API_RESPONSE_INVALID",
        message: `${spec.command} 接口返回了未识别的失败响应`
    };
};
const inferReadRequestException = (spec, error) => {
    const errorName = typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : "";
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorName === "AbortError") {
        return {
            reason: "REQUEST_TIMEOUT",
            message: `请求超时，无法完成 ${spec.command}`,
            detail: errorMessage
        };
    }
    return {
        reason: "REQUEST_DISPATCH_FAILED",
        message: `${spec.command} 请求发送失败，无法完成执行`,
        detail: errorMessage
    };
};
const containsTargetIdentifier = (value, target, candidateKeys) => {
    const record = asRecord(value);
    if (record) {
        for (const key of candidateKeys) {
            if (typeof record[key] === "string" && record[key] === target) {
                return true;
            }
        }
    }
    return false;
};
const collectCandidateRecords = (value) => {
    const record = asRecord(value);
    if (record) {
        return [record];
    }
    const array = asArray(value);
    if (array) {
        return array.map((entry) => asRecord(entry)).filter((entry) => entry !== null);
    }
    return [];
};
const collectNestedRecordCandidates = (value, nestedKeys, seen = new Set()) => {
    const directCandidates = collectCandidateRecords(value);
    const nestedCandidates = [];
    for (const candidate of directCandidates) {
        if (seen.has(candidate)) {
            continue;
        }
        seen.add(candidate);
        nestedCandidates.push(candidate);
        for (const key of nestedKeys) {
            nestedCandidates.push(...collectNestedRecordCandidates(candidate[key], nestedKeys, seen));
        }
    }
    return nestedCandidates;
};
const hasDetailDataShape = (record) => [
    "title",
    "desc",
    "user",
    "interact_info",
    "image_list",
    "video_info",
    "note_card",
    "note_card_list"
].some((key) => key in record);
const hasUserDataShape = (record) => [
    "nickname",
    "avatar",
    "avatar_url",
    "images",
    "follows",
    "fans",
    "basicInfo",
    "basic_info",
    "interactions"
].some((key) => key in record);
const getDetailResponseCandidates = (body) => {
    const responseRecord = asRecord(body);
    const data = responseRecord?.data ?? body;
    const dataRecord = asRecord(data);
    if (!dataRecord) {
        return [];
    }
    return [
        ...collectNestedRecordCandidates(dataRecord.note, ["note", "note_card", "current_note", "item"]),
        ...collectNestedRecordCandidates(dataRecord.note_card, ["note", "note_card", "current_note", "item"]),
        ...collectNestedRecordCandidates(dataRecord.note_card_list, [
            "note",
            "note_card",
            "current_note",
            "item"
        ]),
        ...collectNestedRecordCandidates(dataRecord.current_note, ["note", "note_card", "current_note", "item"]),
        ...collectNestedRecordCandidates(dataRecord.item, ["note", "note_card", "current_note", "item"]),
        ...collectNestedRecordCandidates(dataRecord.items, ["note", "note_card", "current_note", "item"]),
        ...collectNestedRecordCandidates(dataRecord.notes, ["note", "note_card", "current_note", "item"]),
        ...(hasDetailDataShape(dataRecord) ? [dataRecord] : [])
    ];
};
const getUserHomeResponseCandidates = (body) => {
    const responseRecord = asRecord(body);
    const data = responseRecord?.data ?? body;
    const dataRecord = asRecord(data);
    if (!dataRecord) {
        return [];
    }
    return [
        ...collectNestedRecordCandidates(dataRecord.user, ["basic_info", "basicInfo", "profile", "user"]),
        ...collectNestedRecordCandidates(dataRecord.basic_info, [
            "basic_info",
            "basicInfo",
            "profile",
            "user"
        ]),
        ...collectNestedRecordCandidates(dataRecord.basicInfo, [
            "basic_info",
            "basicInfo",
            "profile",
            "user"
        ]),
        ...collectNestedRecordCandidates(dataRecord.profile, ["basic_info", "basicInfo", "profile", "user"]),
        ...collectNestedRecordCandidates(dataRecord.notes, ["basic_info", "basicInfo", "profile", "user"]),
        ...collectNestedRecordCandidates(dataRecord.items, ["basic_info", "basicInfo", "profile", "user"]),
        ...collectNestedRecordCandidates(dataRecord.list, ["basic_info", "basicInfo", "profile", "user"]),
        ...collectNestedRecordCandidates(dataRecord.note_list, [
            "basic_info",
            "basicInfo",
            "profile",
            "user"
        ]),
        ...collectNestedRecordCandidates(dataRecord.noteList, [
            "basic_info",
            "basicInfo",
            "profile",
            "user"
        ]),
        ...(hasUserDataShape(dataRecord) ? [dataRecord] : [])
    ];
};
const responseContainsRequestedTarget = (spec, params, body, continuity) => {
    if (spec.command === "xhs.detail") {
        return getDetailResponseCandidates(body).some((candidate) => containsTargetIdentifier(candidate, params.note_id, [
            "note_id",
            "noteId"
        ]));
    }
    return getUserHomeResponseCandidates(body).some((candidate) => containsTargetIdentifier(candidate, params.user_id, [
        "user_id",
        "userId"
    ])) || isEmptyUserPostedSuccessForSignedUserHome(body, params, continuity);
};
const createReadDiagnosis = (spec, input) => {
    const diagnosis = createDiagnosis(input);
    const failureSite = asRecord(diagnosis.failure_site);
    const shouldUseEndpointTarget = (typeof failureSite?.component === "string" ? failureSite.component : null) === "network";
    return {
        ...diagnosis,
        failure_site: {
            ...(failureSite ?? {}),
            ...(shouldUseEndpointTarget ? { target: spec.endpoint } : {}),
            summary: input.summary
        }
    };
};
const hasDetailPageStateFallback = (params, root) => {
    const note = asRecord(root?.note);
    const noteDetailMap = asRecord(note?.noteDetailMap);
    return asRecord(noteDetailMap?.[params.note_id]) !== null;
};
const parseDetailLikeNoteIdFromHref = (href) => {
    try {
        const parsed = new URL(href);
        const match = parsed.pathname.match(/^\/(?:explore|discovery\/item|search_result)\/([^/?#]+)/u);
        return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
    catch {
        return null;
    }
};
const parseUserProfileIdFromHref = (href) => {
    try {
        const parsed = new URL(href);
        const match = parsed.pathname.match(/^\/user\/profile\/([^/?#]+)/u);
        return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
    catch {
        return null;
    }
};
const normalizeXhsDetailTitle = (title) => {
    const normalized = title
        .replace(/\s+-\s+小红书\s*$/u, "")
        .replace(/\s*\|\s*小红书\s*$/u, "")
        .trim();
    if (!normalized ||
        normalized === "XHS" ||
        normalized === "小红书" ||
        normalized === "小红书 - 你的生活兴趣社区") {
        return null;
    }
    return normalized;
};
const normalizeXhsUserHomeTitle = (title) => {
    const normalized = title
        .replace(/\s+-\s+小红书\s*$/u, "")
        .replace(/\s*\|\s*小红书\s*$/u, "")
        .trim();
    if (!normalized || normalized === "小红书" || normalized === "小红书 - 你的生活兴趣社区") {
        return null;
    }
    return normalized;
};
const hasBlockingPageSurface = (bodyText) => {
    const normalized = bodyText.toLowerCase();
    return (bodyText.includes("验证码") ||
        bodyText.includes("登录") ||
        bodyText.includes("安全验证") ||
        normalized.includes("captcha") ||
        normalized.includes("security"));
};
const createDetailDomPageStateRoot = (params, env) => {
    const href = env.getLocationHref();
    if (parseDetailLikeNoteIdFromHref(href) !== params.note_id) {
        return null;
    }
    if (classifyPageKind(href, "detail") !== "detail") {
        return null;
    }
    const bodyText = env.getBodyText?.() ?? "";
    const title = normalizeXhsDetailTitle(env.getDocumentTitle());
    if (!title || bodyText.trim().length === 0 || hasBlockingPageSurface(bodyText)) {
        return null;
    }
    return {
        note: {
            noteDetailMap: {
                [params.note_id]: {
                    note_id: params.note_id,
                    title,
                    page_url: href,
                    source: "detail_dom_page_state"
                }
            }
        }
    };
};
const createUserHomeDomPageStateRoot = (params, env) => {
    const href = env.getLocationHref();
    if (parseUserProfileIdFromHref(href) !== params.user_id) {
        return null;
    }
    if (classifyPageKind(href, "user_home") !== "user_home") {
        return null;
    }
    const bodyText = env.getBodyText?.() ?? "";
    const nickname = normalizeXhsUserHomeTitle(env.getDocumentTitle());
    if (!nickname || bodyText.trim().length === 0 || hasBlockingPageSurface(bodyText)) {
        return null;
    }
    return {
        user: {
            userId: params.user_id,
            basic_info: {
                user_id: params.user_id,
                nickname,
                page_url: href,
                source: "user_home_dom_page_state"
            }
        },
        board: {},
        note: {}
    };
};
const asNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const hasUserHomePageStateFallback = (params, root) => {
    const user = asRecord(root?.user);
    if (!user) {
        return false;
    }
    const candidateUserIds = [
        asNonEmptyString(user.userId),
        asNonEmptyString(user.user_id),
        asNonEmptyString(user.id),
        asNonEmptyString(asRecord(user.basic_info)?.userId),
        asNonEmptyString(asRecord(user.basic_info)?.user_id),
        asNonEmptyString(asRecord(user.basicInfo)?.userId),
        asNonEmptyString(asRecord(user.basicInfo)?.user_id),
        asNonEmptyString(asRecord(asRecord(user.profile)?.basic_info)?.userId),
        asNonEmptyString(asRecord(asRecord(user.profile)?.basic_info)?.user_id),
        asNonEmptyString(asRecord(asRecord(user.profile)?.basicInfo)?.userId),
        asNonEmptyString(asRecord(asRecord(user.profile)?.basicInfo)?.user_id),
        asNonEmptyString(asRecord(user.profile)?.userId),
        asNonEmptyString(asRecord(user.profile)?.user_id)
    ].filter((value) => value !== null);
    if (!candidateUserIds.some((userId) => userId === params.user_id)) {
        return false;
    }
    return (asRecord(root?.board) !== null ||
        asRecord(root?.note) !== null ||
        hasUserHomeResponseDataShape(user) ||
        asRecord(user.basic_info) !== null ||
        asRecord(user.basicInfo) !== null ||
        asRecord(user.profile) !== null);
};
const canUsePageStateFallback = (spec, params, root) => spec.command === "xhs.detail"
    ? hasDetailPageStateFallback(params, root)
    : hasUserHomePageStateFallback(params, root);
const buildDomPageStateFallbackEvidence = (input) => ({
    evidence_class: "page_state_fallback",
    evidence_role: "diagnostic",
    route_role: "supporting",
    path_kind: "page_state",
    source_kind: "dom_or_page_state",
    evidence_status: "success",
    fallback_used: true,
    fallback_reason: input.fallbackReason,
    confidence: {
        level: "medium",
        basis: input.spec.command === "xhs.detail"
            ? "requested note_id found in page-state note detail map"
            : "requested user_id found with profile board/note or user data page-state signals"
    },
    limits: {
        passive_api_capture_evidence: false,
        live_closeout_evidence: false,
        provider_aware_closeout_boundary: false,
        syvert_normalized_output: false,
        request_payload_included: false,
        response_payload_included: false,
        browser_live_claim: false
    },
    provenance: {
        command: input.spec.command,
        page_kind: input.spec.pageKind,
        page_url: input.pageUrl,
        run_id: input.runId,
        profile_ref: input.profileRef,
        session_id: input.sessionId,
        target_tab_id: input.targetTabId,
        action_ref: input.actionRef,
        data_ref: input.dataRef
    }
});
const createPageStateFallbackFailure = (input, spec, gate, auditRecord, env, payload, startedAt, requestFailure) => {
    const requestId = `req-${env.randomId()}`;
    const requestAttempted = requestFailure.requestAttempted !== false;
    const targetTabId = typeof input.options.actual_target_tab_id === "number"
        ? input.options.actual_target_tab_id
        : typeof input.options.target_tab_id === "number"
            ? input.options.target_tab_id
            : null;
    const domPageStateFallbackEvidence = buildDomPageStateFallbackEvidence({
        spec,
        fallbackReason: requestFailure.reason,
        pageUrl: env.getLocationHref(),
        targetTabId,
        runId: input.executionContext.runId,
        profileRef: input.executionContext.profile,
        sessionId: input.executionContext.sessionId,
        actionRef: input.executionContext.gateInvocationId ?? input.executionContext.runId,
        dataRef: spec.buildDataRef(input.params, payload)
    });
    return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", requestFailure.message, {
        ability_id: input.abilityId,
        stage: "execution",
        reason: requestFailure.reason,
        ...(typeof requestFailure.statusCode === "number" ? { status_code: requestFailure.statusCode } : {}),
        ...(typeof requestFailure.platformCode === "number" ? { platform_code: requestFailure.platformCode } : {}),
        dom_page_state_fallback_evidence: domPageStateFallbackEvidence,
        ...(requestFailure.requestContextDetails ?? {})
    }, {
        page_state: {
            page_kind: classifyPageKind(env.getLocationHref(), spec.pageKind),
            url: env.getLocationHref(),
            title: env.getDocumentTitle(),
            ready_state: env.getReadyState(),
            fallback_used: true
        },
        key_requests: [
            ...(requestAttempted
                ? [
                    {
                        request_id: requestId,
                        stage: "request",
                        method: spec.method,
                        url: spec.endpoint,
                        outcome: "failed",
                        ...(typeof requestFailure.statusCode === "number"
                            ? { status_code: requestFailure.statusCode }
                            : {}),
                        failure_reason: requestFailure.reason,
                        request_class: spec.requestClass
                    }
                ]
                : []),
            {
                request_id: `${requestId}-page-state`,
                stage: "page_state_fallback",
                method: "N/A",
                url: env.getLocationHref(),
                outcome: "completed",
                fallback_reason: requestFailure.reason,
                data_ref: spec.buildDataRef(input.params, payload),
                duration_ms: Math.max(0, env.now() - startedAt)
            }
        ],
        failure_site: requestFailure.failureSite ??
            (requestAttempted
                ? {
                    stage: "request",
                    component: "network",
                    target: spec.endpoint,
                    summary: requestFailure.message
                }
                : {
                    stage: "execution",
                    component: "page",
                    target: "captured_request_context",
                    summary: requestFailure.message
                })
    }, createReadDiagnosis(spec, {
        reason: requestFailure.reason,
        summary: requestFailure.message
    }), gate, auditRecord), gate.execution_audit);
};
const createPageStateFallbackSuccess = (input, spec, gate, auditRecord, env, payload, startedAt, fallback) => {
    const requestId = `req-${env.randomId()}`;
    const requestAttempted = fallback.requestAttempted !== false;
    const targetTabId = typeof input.options.actual_target_tab_id === "number"
        ? input.options.actual_target_tab_id
        : typeof input.options.target_tab_id === "number"
            ? input.options.target_tab_id
            : null;
    const domPageStateFallbackEvidence = buildDomPageStateFallbackEvidence({
        spec,
        fallbackReason: fallback.reason,
        pageUrl: env.getLocationHref(),
        targetTabId,
        runId: input.executionContext.runId,
        profileRef: input.executionContext.profile,
        sessionId: input.executionContext.sessionId,
        actionRef: input.executionContext.gateInvocationId ?? input.executionContext.runId,
        dataRef: spec.buildDataRef(input.params, payload)
    });
    return {
        ok: true,
        payload: {
            summary: {
                capability_result: {
                    ability_id: input.abilityId,
                    layer: input.abilityLayer,
                    action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                    outcome: "success",
                    data_ref: spec.buildDataRef(input.params, payload),
                    metrics: {
                        count: 1,
                        duration_ms: Math.max(0, env.now() - startedAt)
                    }
                },
                scope_context: gate.scope_context,
                gate_input: {
                    run_id: auditRecord.run_id,
                    session_id: auditRecord.session_id,
                    profile: auditRecord.profile,
                    ...gate.gate_input
                },
                gate_outcome: gate.gate_outcome,
                read_execution_policy: gate.read_execution_policy,
                issue_action_matrix: gate.issue_action_matrix,
                consumer_gate_result: gate.consumer_gate_result,
                request_admission_result: gate.request_admission_result,
                execution_audit: gate.execution_audit,
                approval_record: gate.approval_record,
                risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                audit_record: auditRecord,
                ...buildProviderAwareReadPathSummaryFields(input.options),
                dom_page_state_fallback_evidence: domPageStateFallbackEvidence,
                route_evidence: {
                    ...domPageStateFallbackEvidence,
                    evidence_class: "page_state_fallback",
                    fallback_reason: fallback.reason,
                    page_url: env.getLocationHref(),
                    page_kind: classifyPageKind(env.getLocationHref(), spec.pageKind),
                    target_tab_id: targetTabId
                }
            },
            observability: {
                page_state: {
                    page_kind: classifyPageKind(env.getLocationHref(), spec.pageKind),
                    url: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    ready_state: env.getReadyState(),
                    fallback_used: true
                },
                key_requests: [
                    ...(requestAttempted
                        ? [
                            {
                                request_id: requestId,
                                stage: "request",
                                method: spec.method,
                                url: spec.endpoint,
                                outcome: "failed",
                                ...(typeof fallback.statusCode === "number"
                                    ? { status_code: fallback.statusCode }
                                    : {}),
                                failure_reason: fallback.reason,
                                ...(typeof fallback.detail === "string" && fallback.detail.length > 0
                                    ? { failure_detail: fallback.detail }
                                    : {}),
                                request_class: spec.requestClass
                            }
                        ]
                        : []),
                    {
                        request_id: `${requestId}-page-state`,
                        stage: "page_state_fallback",
                        method: "N/A",
                        url: env.getLocationHref(),
                        outcome: "completed",
                        fallback_reason: fallback.reason,
                        data_ref: spec.buildDataRef(input.params, payload),
                        duration_ms: Math.max(0, env.now() - startedAt)
                    }
                ],
                failure_site: null
            }
        }
    };
};
const createGateOnlySuccess = (input, spec, gate, auditRecord, env, payload) => ({
    ok: true,
    payload: {
        summary: {
            capability_result: {
                ability_id: input.abilityId,
                layer: input.abilityLayer,
                action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                outcome: "partial",
                data_ref: spec.buildDataRef(input.params, payload),
                metrics: {
                    count: 0
                }
            },
            scope_context: gate.scope_context,
            gate_input: {
                run_id: auditRecord.run_id,
                session_id: auditRecord.session_id,
                profile: auditRecord.profile,
                ...gate.gate_input
            },
            gate_outcome: gate.gate_outcome,
            read_execution_policy: gate.read_execution_policy,
            issue_action_matrix: gate.issue_action_matrix,
            write_interaction_tier: gate.write_interaction_tier,
            write_action_matrix_decisions: gate.write_action_matrix_decisions,
            consumer_gate_result: gate.consumer_gate_result,
            request_admission_result: gate.request_admission_result,
            execution_audit: gate.execution_audit,
            approval_record: gate.approval_record,
            risk_state_output: resolveRiskStateOutput(gate, auditRecord),
            audit_record: auditRecord,
            ...buildProviderAwareReadPathSummaryFields(input.options)
        },
        observability: {
            page_state: {
                page_kind: classifyPageKind(env.getLocationHref(), spec.pageKind),
                url: env.getLocationHref(),
                title: env.getDocumentTitle(),
                ready_state: env.getReadyState()
            },
            key_requests: [],
            failure_site: null
        }
    }
});
const resolveSimulatedResult = (input, spec, payload, env, gate, auditRecord) => {
    if (!input.options.simulate_result) {
        return null;
    }
    const requestId = `req-${env.randomId()}`;
    const dataRef = spec.buildDataRef(input.params, payload);
    if (input.options.simulate_result === "success") {
        return {
            ok: true,
            payload: {
                summary: {
                    capability_result: {
                        ability_id: input.abilityId,
                        layer: input.abilityLayer,
                        action: input.abilityAction,
                        outcome: "success",
                        data_ref: dataRef,
                        metrics: {
                            count: 1
                        }
                    }
                },
                observability: createReadObservability({
                    spec,
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId,
                    outcome: "completed"
                })
            }
        };
    }
    if (input.options.simulate_result === "missing_capability_result") {
        return {
            ok: true,
            payload: {
                summary: {},
                observability: createReadObservability({
                    spec,
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId,
                    outcome: "completed"
                })
            }
        };
    }
    if (input.options.simulate_result === "capability_result_invalid_outcome") {
        return {
            ok: true,
            payload: {
                summary: {
                    capability_result: {
                        ability_id: input.abilityId,
                        layer: input.abilityLayer,
                        action: input.abilityAction,
                        outcome: "blocked",
                        data_ref: dataRef,
                        metrics: {
                            count: 1
                        }
                    }
                },
                observability: createReadObservability({
                    spec,
                    href: env.getLocationHref(),
                    title: env.getDocumentTitle(),
                    readyState: env.getReadyState(),
                    requestId,
                    outcome: "completed"
                })
            }
        };
    }
    const simulatedReasonMap = {
        signature_entry_missing: {
            reason: "SIGNATURE_ENTRY_MISSING",
            message: "页面签名入口不可用"
        },
        account_abnormal: {
            reason: "ACCOUNT_ABNORMAL",
            message: "账号异常，平台拒绝当前请求",
            statusCode: 461
        },
        browser_env_abnormal: {
            reason: "BROWSER_ENV_ABNORMAL",
            message: "浏览器环境异常，平台拒绝当前请求",
            statusCode: 200
        },
        captcha_required: {
            reason: "CAPTCHA_REQUIRED",
            message: "平台要求额外人机验证，无法继续执行",
            statusCode: 429
        },
        gateway_invoker_failed: {
            reason: "GATEWAY_INVOKER_FAILED",
            message: `网关调用失败，当前上下文不足以完成 ${spec.command} 请求`,
            statusCode: 500
        }
    };
    const mapped = simulatedReasonMap[input.options.simulate_result] ??
        inferReadFailure(spec, input.options.simulate_result === "account_abnormal" ? 461 : 500, {
            code: input.options.simulate_result === "account_abnormal" ? 300011 : undefined,
            msg: input.options.simulate_result === "browser_env_abnormal"
                ? "Browser environment abnormal"
                : input.options.simulate_result === "gateway_invoker_failed"
                    ? "create invoker failed"
                    : input.options.simulate_result
        });
    return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", mapped.message, {
        ability_id: input.abilityId,
        stage: "execution",
        reason: mapped.reason
    }, createReadObservability({
        spec,
        href: env.getLocationHref(),
        title: env.getDocumentTitle(),
        readyState: env.getReadyState(),
        requestId,
        outcome: "failed",
        ...(typeof mapped.statusCode === "number" ? { statusCode: mapped.statusCode } : {}),
        failureReason: input.options.simulate_result
    }), createReadDiagnosis(spec, {
        reason: mapped.reason,
        summary: mapped.message
    }), gate, auditRecord), gate?.execution_audit ?? null);
};
const buildHeaders = (env, options, signature, capturedHeaders) => ({
    Accept: getCapturedHeader(capturedHeaders ?? {}, "Accept") ?? "application/json, text/plain, */*",
    ...(options.target_domain === "www.xiaohongshu.com" || options.target_domain === undefined
        ? {}
        : {}),
    ...(signature
        ? {
            "X-s": String(signature["X-s"]),
            "X-t": String(signature["X-t"]),
            "X-S-Common": getCapturedHeader(capturedHeaders ?? {}, "X-S-Common") ??
                options.x_s_common ??
                resolveXsCommon(undefined),
            "x-b3-traceid": env.randomId().replace(/-/g, ""),
            "x-xray-traceid": env.randomId().replace(/-/g, "")
        }
        : {}),
    "Content-Type": getCapturedHeader(capturedHeaders ?? {}, "Content-Type") ?? "application/json;charset=utf-8"
});
const executeXhsRead = async (input, spec, env) => {
    const gate = resolveGate(input.options, input.executionContext, env.getLocationHref());
    const auditRecord = createAuditRecord(input.executionContext, gate, env);
    const startedAt = env.now();
    const builtPayload = spec.buildPayload(input.params, env);
    const resolvePageStateRoot = async () => {
        const mainWorldState = typeof env.readPageStateRoot === "function"
            ? await env.readPageStateRoot().catch(() => null)
            : null;
        const mainWorldRecord = asRecord(mainWorldState);
        if (mainWorldRecord) {
            return mainWorldRecord;
        }
        const isolatedWorldRecord = asRecord(env.getPageStateRoot?.());
        if (isolatedWorldRecord) {
            return isolatedWorldRecord;
        }
        return spec.command === "xhs.detail"
            ? createDetailDomPageStateRoot(input.params, env)
            : createUserHomeDomPageStateRoot(input.params, env);
    };
    if (gate.consumer_gate_result.gate_decision === "blocked") {
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", `执行模式门禁阻断了当前 ${spec.command} 请求`, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "EXECUTION_MODE_GATE_BLOCKED",
            ...(asRecord(input.options.account_safety_gate_result)
                ? {
                    account_safety_gate_result: asRecord(input.options.account_safety_gate_result) ?? {}
                }
                : {})
        }, createReadObservability({
            spec,
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "EXECUTION_MODE_GATE_BLOCKED",
            failureSite: {
                stage: "execution",
                component: "gate",
                target: "requested_execution_mode",
                summary: "执行模式门禁阻断"
            }
        }), createReadDiagnosis(spec, {
            reason: "EXECUTION_MODE_GATE_BLOCKED",
            summary: "执行模式门禁阻断"
        }), gate, auditRecord), gate.execution_audit);
    }
    if (gate.consumer_gate_result.effective_execution_mode === "dry_run" ||
        gate.consumer_gate_result.effective_execution_mode === "recon") {
        return createGateOnlySuccess(input, spec, gate, auditRecord, env, builtPayload);
    }
    const providerAwareReadPathBlock = isProviderAwareLiveReadGate(gate)
        ? resolveProviderAwareReadPathBlock(spec, input.options, input.executionContext.runId)
        : null;
    if (providerAwareReadPathBlock) {
        const summary = `provider-aware read path readiness denied ${spec.command} execution`;
        return withProviderAwareReadPathBlockPayload(withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", summary, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: providerAwareReadPathBlock.reason,
            blocking_reasons: providerAwareReadPathBlock.reasons
        }, createReadObservability({
            spec,
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: providerAwareReadPathBlock.reason,
            includeKeyRequest: false,
            failureSite: {
                stage: "execution",
                component: "gate",
                target: "provider_aware_read_path",
                summary
            }
        }), createReadDiagnosis(spec, {
            reason: providerAwareReadPathBlock.reason,
            summary,
            category: "page_changed"
        }), gate, auditRecord), gate.execution_audit), gate, auditRecord, providerAwareReadPathBlock);
    }
    const simulated = resolveSimulatedResult(input, spec, builtPayload, env, gate, auditRecord);
    if (simulated) {
        if (simulated.ok) {
            const summary = asRecord(simulated.payload.summary) ?? {};
            const capability = asRecord(summary.capability_result) ?? {};
            capability.ability_id = input.abilityId;
            capability.layer = input.abilityLayer;
            capability.action = gate.consumer_gate_result.action_type ?? input.abilityAction;
            return {
                ok: true,
                payload: {
                    ...simulated.payload,
                    summary: {
                        capability_result: capability,
                        scope_context: gate.scope_context,
                        gate_input: {
                            run_id: auditRecord.run_id,
                            session_id: auditRecord.session_id,
                            profile: auditRecord.profile,
                            ...gate.gate_input
                        },
                        gate_outcome: gate.gate_outcome,
                        read_execution_policy: gate.read_execution_policy,
                        issue_action_matrix: gate.issue_action_matrix,
                        consumer_gate_result: gate.consumer_gate_result,
                        request_admission_result: gate.request_admission_result,
                        execution_audit: gate.execution_audit,
                        approval_record: gate.approval_record,
                        risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                        audit_record: auditRecord
                    }
                }
            };
        }
        return {
            ...simulated,
            payload: {
                ...simulated.payload,
                read_execution_policy: gate.read_execution_policy,
                issue_action_matrix: gate.issue_action_matrix,
                consumer_gate_result: gate.consumer_gate_result,
                request_admission_result: gate.request_admission_result,
                execution_audit: gate.execution_audit,
                approval_record: gate.approval_record,
                audit_record: auditRecord
            }
        };
    }
    if (requiresSignedContinuity(spec) && isSecurityRedirectUrl(env.getLocationHref())) {
        return failClosedForSignedContinuity({
            abilityId: input.abilityId,
            spec,
            expectedShape: deriveReadShapeFromCommand(spec, input.params),
            reason: "SECURITY_REDIRECT",
            continuity: createRedirectSignedContinuity(spec, env.getLocationHref()),
            gate,
            auditRecord
        }, env);
    }
    const accountSafetySurface = classifyXhsAccountSafetySurface({
        href: env.getLocationHref(),
        title: env.getDocumentTitle(),
        bodyText: env.getBodyText?.(),
        overlay: env.getAccountSafetyOverlay?.()
    });
    if (accountSafetySurface) {
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", accountSafetySurface.message, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: accountSafetySurface.reason,
            page_url: env.getLocationHref()
        }, createReadObservability({
            spec,
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: accountSafetySurface.reason,
            includeKeyRequest: false,
            failureSite: {
                stage: "action",
                component: "page",
                target: "xhs.account_safety_surface",
                summary: accountSafetySurface.message
            }
        }), createReadDiagnosis(spec, {
            reason: accountSafetySurface.reason,
            summary: accountSafetySurface.message,
            category: "page_changed"
        }), gate, auditRecord), gate.execution_audit);
    }
    if (!containsCookie(env.getCookie(), "a1")) {
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", `登录态缺失，无法执行 ${spec.command}`, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "SESSION_EXPIRED"
        }, createReadObservability({
            spec,
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: "SESSION_EXPIRED"
        }), createReadDiagnosis(spec, {
            reason: "SESSION_EXPIRED",
            summary: `登录态缺失，无法执行 ${spec.command}`
        }), gate, auditRecord), gate.execution_audit);
    }
    const expectedShape = deriveReadShapeFromCommand(spec, input.params);
    const activeFallbackBinding = buildActiveFallbackTemplateBinding({
        executionContext: input.executionContext,
        options: input.options,
        abilityAction: input.abilityAction,
        pageUrl: env.getLocationHref()
    });
    let requestContextResult = createExplicitRequestContextResult({
        spec,
        expectedShape,
        artifact: input.options.explicit_request_context_artifact,
        env
    }) ??
        (await readCapturedReadContextWithRetry(spec, expectedShape, env, activeFallbackBinding));
    if (requestContextResult.state !== "hit") {
        if (requiresSignedContinuity(spec) &&
            requestContextResult.state === "stale" &&
            requestContextResult.signedContinuity) {
            const staleContinuityReason = resolveSignedContinuityFailure(requestContextResult.signedContinuity, requestContextResult.signedContinuity.observed_at, env.now(), env.getLocationHref()) ?? "XSEC_TOKEN_STALE";
            return failClosedForSignedContinuity({
                abilityId: input.abilityId,
                spec,
                expectedShape,
                reason: staleContinuityReason,
                continuity: requestContextResult.signedContinuity,
                gate,
                auditRecord
            }, env);
        }
        const pageStateRoot = await resolvePageStateRoot();
        const failureSurface = resolveRequestContextFailureSurface(spec, requestContextResult);
        if (canUsePageStateFallbackForReason(spec, input.params, pageStateRoot, failureSurface.reasonCode)) {
            return createPageStateFallbackSuccess(input, spec, gate, auditRecord, env, builtPayload, startedAt, {
                reason: failureSurface.reasonCode,
                message: failureSurface.message,
                statusCode: requestContextResult.state === "rejected_source" ? (requestContextResult.statusCode ?? undefined) : undefined,
                platformCode: requestContextResult.state === "rejected_source"
                    ? (requestContextResult.platformCode ?? undefined)
                    : undefined,
                requestAttempted: requestContextResult.state === "rejected_source" &&
                    BACKEND_REJECTED_SOURCE_REASONS.has(requestContextResult.reason)
            });
        }
        return failClosedForRequestContext({
            abilityId: input.abilityId,
            spec,
            expectedShape,
            lookupResult: requestContextResult,
            gate,
            auditRecord
        }, env);
    }
    const requestPayload = requestContextResult.requestBody ?? builtPayload;
    const requestUrl = requestContextResult.requestUrl ?? spec.buildUrl(input.params);
    const signatureUri = requestContextResult.requestUrl ?? spec.buildSignatureUri(input.params);
    const continuityFailure = resolveSignedContinuityFailure(requestContextResult.signedContinuity, requestContextResult.observedAt, env.now(), env.getLocationHref());
    if (continuityFailure) {
        return failClosedForSignedContinuity({
            abilityId: input.abilityId,
            spec,
            expectedShape,
            reason: continuityFailure,
            continuity: requestContextResult.signedContinuity,
            gate,
            auditRecord
        }, env);
    }
    const passiveCaptureSuccess = createPassiveApiCaptureSuccess(input, spec, gate, auditRecord, env, requestContextResult, startedAt);
    if (passiveCaptureSuccess) {
        return passiveCaptureSuccess;
    }
    const activeFallbackGate = resolveActiveApiFetchFallbackGate({
        executionInput: input,
        templateEvidence: requestContextResult.templateEvidence,
        signedContinuity: requestContextResult.signedContinuity,
        env
    });
    if (activeFallbackGate.gate_decision !== "allowed") {
        return failClosedForActiveApiFetchFallbackGate({
            abilityId: input.abilityId,
            spec,
            expectedShape,
            gateResult: activeFallbackGate,
            gate,
            auditRecord
        }, env);
    }
    let signature;
    try {
        signature = await env.callSignature(signatureUri, requestPayload);
    }
    catch (error) {
        const pageStateRoot = await resolvePageStateRoot();
        if (canUsePageStateFallbackForReason(spec, input.params, pageStateRoot, "SIGNATURE_ENTRY_MISSING")) {
            return createPageStateFallbackSuccess(input, spec, gate, auditRecord, env, requestPayload, startedAt, {
                reason: "SIGNATURE_ENTRY_MISSING",
                message: "页面签名入口不可用",
                requestAttempted: false
            });
        }
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", "页面签名入口不可用", {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "SIGNATURE_ENTRY_MISSING"
        }, createReadObservability({
            spec,
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: error instanceof Error ? error.message : String(error),
            includeKeyRequest: false,
            failureSite: {
                stage: "action",
                component: "page",
                target: "window._webmsxyw",
                summary: "页面签名入口不可用"
            }
        }), createReadDiagnosis(spec, {
            reason: "SIGNATURE_ENTRY_MISSING",
            summary: "页面签名入口不可用",
            category: "page_changed"
        }), gate, auditRecord), gate.execution_audit);
    }
    let response;
    try {
        response = await env.fetchJson({
            url: resolveReadApiFetchUrl(requestUrl),
            method: spec.method,
            headers: buildHeaders(env, input.options, signature, requestContextResult.headers),
            ...(spec.method === "POST" ? { body: JSON.stringify(requestPayload) } : {}),
            pageContextRequest: true,
            referrer: requestContextResult.referrer ?? env.getLocationHref(),
            referrerPolicy: "strict-origin-when-cross-origin",
            timeoutMs: typeof input.options.timeout_ms === "number" && Number.isFinite(input.options.timeout_ms)
                ? Math.max(1, Math.floor(input.options.timeout_ms))
                : 30_000
        });
    }
    catch (error) {
        const failure = inferReadRequestException(spec, error);
        const pageStateRoot = await resolvePageStateRoot();
        if (canUsePageStateFallbackForReason(spec, input.params, pageStateRoot, failure.reason)) {
            return createPageStateFallbackSuccess(input, spec, gate, auditRecord, env, requestPayload, startedAt, {
                reason: failure.reason,
                message: failure.message,
                detail: failure.detail
            });
        }
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", failure.message, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: failure.reason
        }, createReadObservability({
            spec,
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            failureReason: failure.detail
        }), createReadDiagnosis(spec, {
            reason: failure.reason,
            summary: failure.message
        }), gate, auditRecord), gate.execution_audit);
    }
    const responseRecord = asRecord(response.body);
    const businessCode = asInteger(responseRecord?.code);
    if (response.status >= 400 || (businessCode !== null && businessCode !== 0)) {
        const failure = inferReadFailure(spec, response.status, response.body);
        const pageStateRoot = await resolvePageStateRoot();
        if (canUsePageStateFallbackForReason(spec, input.params, pageStateRoot, failure.reason)) {
            return createPageStateFallbackSuccess(input, spec, gate, auditRecord, env, requestPayload, startedAt, {
                reason: failure.reason,
                message: failure.message,
                statusCode: response.status,
                platformCode: businessCode ?? undefined
            });
        }
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", failure.message, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: failure.reason,
            status_code: response.status,
            ...(businessCode !== null ? { platform_code: businessCode } : {})
        }, createReadObservability({
            spec,
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            statusCode: response.status,
            failureReason: failure.reason
        }), createReadDiagnosis(spec, {
            reason: failure.reason,
            summary: failure.message
        }), gate, auditRecord), gate.execution_audit);
    }
    if (!responseContainsRequestedTarget(spec, input.params, response.body, requestContextResult.signedContinuity)) {
        const pageStateRoot = await resolvePageStateRoot();
        if (canUsePageStateFallbackForReason(spec, input.params, pageStateRoot, "TARGET_DATA_NOT_FOUND")) {
            return createPageStateFallbackSuccess(input, spec, gate, auditRecord, env, requestPayload, startedAt, {
                reason: "TARGET_DATA_NOT_FOUND",
                message: `${spec.command} 接口返回成功但未包含目标数据`,
                statusCode: response.status
            });
        }
        return withExecutionAuditInFailurePayload(createFailure("ERR_EXECUTION_FAILED", `${spec.command} 接口返回成功但未包含目标数据`, {
            ability_id: input.abilityId,
            stage: "execution",
            reason: "TARGET_DATA_NOT_FOUND"
        }, createReadObservability({
            spec,
            href: env.getLocationHref(),
            title: env.getDocumentTitle(),
            readyState: env.getReadyState(),
            requestId: `req-${env.randomId()}`,
            outcome: "failed",
            statusCode: response.status,
            failureReason: "TARGET_DATA_NOT_FOUND"
        }), createReadDiagnosis(spec, {
            reason: "TARGET_DATA_NOT_FOUND",
            summary: `${spec.command} 接口返回成功但未包含目标数据`
        }), gate, auditRecord), gate.execution_audit);
    }
    return {
        ok: true,
        payload: {
            summary: {
                capability_result: {
                    ability_id: input.abilityId,
                    layer: input.abilityLayer,
                    action: gate.consumer_gate_result.action_type ?? input.abilityAction,
                    outcome: "success",
                    data_ref: spec.buildDataRef(input.params, requestPayload),
                    metrics: {
                        count: 1,
                        duration_ms: Math.max(0, env.now() - startedAt)
                    }
                },
                scope_context: gate.scope_context,
                gate_input: {
                    run_id: auditRecord.run_id,
                    session_id: auditRecord.session_id,
                    profile: auditRecord.profile,
                    ...gate.gate_input
                },
                gate_outcome: gate.gate_outcome,
                read_execution_policy: gate.read_execution_policy,
                issue_action_matrix: gate.issue_action_matrix,
                consumer_gate_result: gate.consumer_gate_result,
                request_admission_result: gate.request_admission_result,
                execution_audit: gate.execution_audit,
                approval_record: gate.approval_record,
                risk_state_output: resolveRiskStateOutput(gate, auditRecord),
                audit_record: auditRecord,
                ...buildProviderAwareReadPathSummaryFields(input.options),
                signed_continuity: requestContextResult.signedContinuity,
                signed_continuity_binding: activeFallbackGate.signed_continuity_binding,
                ...withPassiveApiCaptureEvidenceDiagnostic({
                    spec,
                    templateEvidence: requestContextResult.templateEvidence,
                    requestUrl: requestContextResult.requestUrl,
                    responseStatus: requestContextResult.responseStatus,
                    executionInput: input,
                    targetTabId: typeof input.options.actual_target_tab_id === "number"
                        ? input.options.actual_target_tab_id
                        : typeof input.options.target_tab_id === "number"
                            ? input.options.target_tab_id
                            : null,
                    pageUrl: env.getLocationHref()
                }),
                route_evidence: activeFallbackGate
            },
            observability: createReadObservability({
                spec,
                href: env.getLocationHref(),
                title: env.getDocumentTitle(),
                readyState: env.getReadyState(),
                requestId: `req-${env.randomId()}`,
                outcome: "completed",
                statusCode: response.status
            })
        }
    };
};
const executeXhsDetail = async (input, env) => executeXhsRead({
    command: "xhs.detail",
    ...input
}, READ_COMMAND_SPECS["xhs.detail"], env);
const executeXhsUserHome = async (input, env) => executeXhsRead({
    command: "xhs.user_home",
    ...input
}, READ_COMMAND_SPECS["xhs.user_home"], env);
return { executeXhsDetail, executeXhsUserHome };
})();
const __webenvoy_module_xhs_detail = (() => {
const { executeXhsDetail: executeXhsDetailImpl } = __webenvoy_module_xhs_read_execution;
function executeXhsDetail(...args) {
    return executeXhsDetailImpl(...args);
}
return { executeXhsDetail };
})();
const __webenvoy_module_xhs_user_home = (() => {
const { executeXhsUserHome: executeXhsUserHomeImpl } = __webenvoy_module_xhs_read_execution;
function executeXhsUserHome(...args) {
    return executeXhsUserHomeImpl(...args);
}
return { executeXhsUserHome };
})();
const __webenvoy_module_xhs_editor_input = (() => {
const TARGET_PAGE = "creator.xiaohongshu.com/publish";
const BASE_MINIMUM_REPLAY = ["focus_editor", "type_short_text", "blur_or_reobserve"];
const ARTICLE_EDIT_MODE_REPLAY_STEP = "enter_editable_mode";
const EDITOR_MODE_ENTRY_LABELS = ["新的创作"];
const EDITOR_MODE_ENTRY_WAIT_MS = 200;
const EDITOR_MODE_ENTRY_MAX_ATTEMPTS = 10;
const EDITOR_SELECTORS = [
    'div.tiptap.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"].tiptap.ProseMirror',
    '[contenteditable="true"].ProseMirror',
    '[contenteditable="true"][data-lexical-editor="true"]'
];
const asHTMLElement = (value) => value instanceof HTMLElement ? value : null;
const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none");
};
const buildLocator = (element) => {
    if (element.id) {
        return `#${element.id}`;
    }
    const className = typeof element.className === "string"
        ? element.className
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length > 0)
            .slice(0, 2)
            .join(".")
        : "";
    if (className) {
        return `${element.tagName.toLowerCase()}.${className}`;
    }
    return element.tagName.toLowerCase();
};
const buildTargetKey = (element) => {
    const segments = [];
    let current = element;
    while (current) {
        const parent = current.parentElement;
        const tagName = current.tagName.toLowerCase();
        if (!parent) {
            segments.unshift(current.id ? `${tagName}#${current.id}` : tagName);
            break;
        }
        const siblings = [...parent.children].filter((candidate) => candidate instanceof HTMLElement && candidate.tagName === current?.tagName);
        const position = siblings.indexOf(current) + 1;
        const idSegment = current.id ? `#${current.id}` : "";
        segments.unshift(`${tagName}${idSegment}:nth-of-type(${position})`);
        current = parent;
    }
    return segments.join(" > ");
};
const collectSearchRoots = (root) => {
    const roots = [root];
    const descendants = [...root.querySelectorAll("*")];
    for (const element of descendants) {
        if (element.shadowRoot) {
            roots.push(...collectSearchRoots(element.shadowRoot));
        }
    }
    const iframes = [...root.querySelectorAll("iframe")];
    for (const iframe of iframes) {
        try {
            const frameDocument = iframe.contentDocument;
            if (frameDocument) {
                roots.push(...collectSearchRoots(frameDocument));
            }
        }
        catch {
            continue;
        }
    }
    return roots;
};
const findEditorElements = () => {
    const seen = new Set();
    const results = [];
    const roots = collectSearchRoots(document);
    for (const selector of EDITOR_SELECTORS) {
        for (const searchRoot of roots) {
            const candidates = [...searchRoot.querySelectorAll(selector)]
                .map((entry) => asHTMLElement(entry))
                .filter((entry) => entry !== null && isVisible(entry));
            for (const candidate of candidates) {
                if (seen.has(candidate)) {
                    continue;
                }
                seen.add(candidate);
                results.push(candidate);
            }
        }
    }
    return results;
};
const readElementText = (element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return element.value;
    }
    return element.textContent?.trim() ?? "";
};
const createBubbledEvent = (type) => new Event(type, { bubbles: true });
const createBubbledInputEvent = (type, text) => {
    if (typeof InputEvent === "function") {
        try {
            return new InputEvent(type, { bubbles: true, data: text, inputType: "insertText" });
        }
        catch {
            // Fall back to a generic Event in test environments without a full InputEvent implementation.
        }
    }
    return createBubbledEvent(type);
};
const createBubbledCompositionEvent = (type, text) => {
    if (typeof CompositionEvent === "function") {
        try {
            return new CompositionEvent(type, { bubbles: true, data: text });
        }
        catch {
            // Fall back to a generic Event in test environments without a full CompositionEvent implementation.
        }
    }
    return createBubbledEvent(type);
};
const dispatchSyntheticTextInputSequence = (element, text) => {
    element.dispatchEvent(createBubbledCompositionEvent("compositionstart", text));
    element.dispatchEvent(createBubbledCompositionEvent("compositionupdate", text));
    element.dispatchEvent(createBubbledInputEvent("beforeinput", text));
    element.dispatchEvent(createBubbledCompositionEvent("compositionend", text));
    element.dispatchEvent(createBubbledInputEvent("input", text));
    element.dispatchEvent(createBubbledEvent("change"));
};
const appendTextToEditable = (element, text) => {
    const current = readElementText(element);
    const next = current.length > 0 ? `${current} ${text}` : text;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        dispatchSyntheticTextInputSequence(element, text);
        element.value = next;
        return readElementText(element).includes(text);
    }
    const selection = window.getSelection();
    if (selection) {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    let inserted = false;
    if (typeof document.execCommand === "function") {
        try {
            inserted = document.execCommand("insertText", false, current.length > 0 ? ` ${text}` : text);
        }
        catch {
            inserted = false;
        }
    }
    dispatchSyntheticTextInputSequence(element, text);
    if (!inserted) {
        return false;
    }
    return readElementText(element).includes(text);
};
const findVisibleButtonByLabels = (scope, labels) => {
    const buttons = [...scope.querySelectorAll("button, [role='button']")]
        .map((entry) => asHTMLElement(entry))
        .filter((entry) => entry !== null && isVisible(entry));
    for (const button of buttons) {
        const text = button.innerText?.trim() ?? button.textContent?.trim() ?? "";
        if (labels.some((label) => text.includes(label))) {
            return button;
        }
    }
    return null;
};
const sleep = async (timeoutMs) => {
    await new Promise((resolve) => setTimeout(resolve, timeoutMs));
};
const buildMinimumReplay = (activation) => activation === "activated"
    ? [ARTICLE_EDIT_MODE_REPLAY_STEP, ...BASE_MINIMUM_REPLAY]
    : [...BASE_MINIMUM_REPLAY];
const resolveActivationFromAttestation = (attestation) => {
    if (!attestation) {
        return "already_ready";
    }
    return attestation.editable_state === "entered" ? "activated" : "already_ready";
};
const normalizeFocusAttestationFailure = (attestation) => {
    if (!attestation) {
        return ["missing_focus_attestation"];
    }
    if (attestation.failure_reason === "EDITOR_ENTRY_NOT_VISIBLE") {
        return ["editable_state_entry_missing"];
    }
    if (attestation.failure_reason === "EDITOR_FOCUS_NOT_ATTESTED") {
        return ["editor_focus_not_attested"];
    }
    if (attestation.failure_reason === "DEBUGGER_ATTACH_FAILED") {
        return ["debugger_attach_failed", "editor_focus_not_attested"];
    }
    if (attestation.failure_reason === "DEBUGGER_INTERACTION_FAILED") {
        return ["debugger_interaction_failed", "editor_focus_not_attested"];
    }
    return ["editor_focus_not_attested"];
};
const resolveAttestedTargetBinding = (attestation, targetKey) => {
    if (!attestation || attestation.focus_confirmed !== true) {
        return { focusConfirmed: false, bindingFailureSignal: null };
    }
    if (typeof attestation.editor_target_key !== "string" || attestation.editor_target_key.length === 0) {
        return { focusConfirmed: false, bindingFailureSignal: "ambiguous_editor_target" };
    }
    return {
        focusConfirmed: attestation.editor_target_key === targetKey,
        bindingFailureSignal: attestation.editor_target_key === targetKey ? null : "ambiguous_editor_target"
    };
};
const isTargetPage = () => window.location.href.includes(TARGET_PAGE);
const isArticleTargetPage = () => {
    if (!isTargetPage()) {
        return false;
    }
    try {
        const url = new URL(window.location.href);
        return url.searchParams.get("target") === "article";
    }
    catch {
        return false;
    }
};
const enterEditableStateIfNeeded = async () => {
    if (!isArticleTargetPage()) {
        return "already_ready";
    }
    if (findEditorElements().length > 0) {
        return "already_ready";
    }
    const createButton = findVisibleButtonByLabels(document, EDITOR_MODE_ENTRY_LABELS);
    if (!createButton) {
        return "entry_missing";
    }
    createButton.click();
    for (let attempt = 0; attempt < EDITOR_MODE_ENTRY_MAX_ATTEMPTS; attempt += 1) {
        await Promise.resolve();
        await sleep(EDITOR_MODE_ENTRY_WAIT_MS);
        await Promise.resolve();
        if (findEditorElements().length > 0) {
            return "activated";
        }
    }
    return "activation_failed";
};
const performEditorInputValidation = async (input) => {
    const focusAttestation = input.focusAttestation ?? null;
    const activation = focusAttestation
        ? resolveActivationFromAttestation(focusAttestation)
        : await enterEditableStateIfNeeded();
    const editors = findEditorElements();
    const minimumReplay = buildMinimumReplay(activation);
    if (isTargetPage() && !isArticleTargetPage()) {
        return {
            ok: false,
            mode: "dom_editor_input_validation",
            attestation: "dom_self_certified",
            editor_locator: null,
            input_text: input.text,
            before_text: "",
            visible_text: "",
            post_blur_text: "",
            focus_confirmed: false,
            focus_attestation_source: focusAttestation?.source ?? null,
            focus_attestation_reason: focusAttestation?.failure_reason ?? null,
            preserved_after_blur: false,
            success_signals: [],
            failure_signals: ["target_page_article_required", "dom_variant"],
            minimum_replay: minimumReplay
        };
    }
    if (editors.length === 0) {
        const failureSignals = activation === "entry_missing"
            ? ["editable_state_entry_missing", "dom_variant"]
            : activation === "activation_failed"
                ? ["editable_state_not_entered", "dom_variant"]
                : [...normalizeFocusAttestationFailure(focusAttestation), "dom_variant"];
        return {
            ok: false,
            mode: "dom_editor_input_validation",
            attestation: "dom_self_certified",
            editor_locator: null,
            input_text: input.text,
            before_text: "",
            visible_text: "",
            post_blur_text: "",
            focus_confirmed: false,
            focus_attestation_source: focusAttestation?.source ?? null,
            focus_attestation_reason: focusAttestation?.failure_reason ?? null,
            preserved_after_blur: false,
            success_signals: [],
            failure_signals: failureSignals,
            minimum_replay: minimumReplay
        };
    }
    const normalizedPageText = document.body?.innerText ?? "";
    let bestAttempt = null;
    for (const editor of editors) {
        const beforeText = readElementText(editor);
        const locator = buildLocator(editor);
        const targetKey = buildTargetKey(editor);
        const { focusConfirmed, bindingFailureSignal } = resolveAttestedTargetBinding(focusAttestation, targetKey);
        const textInserted = focusConfirmed ? appendTextToEditable(editor, input.text) : false;
        await Promise.resolve();
        const visibleText = readElementText(editor);
        if (typeof editor.blur === "function") {
            editor.blur();
        }
        await Promise.resolve();
        const postBlurText = readElementText(editor);
        const preservedAfterBlur = postBlurText.includes(input.text);
        const successSignals = activation === "activated" ? ["editable_state_entered"] : [];
        const failureSignals = [];
        if (focusConfirmed) {
            successSignals.push("editor_focus_attested");
        }
        else {
            failureSignals.push(...normalizeFocusAttestationFailure(focusAttestation));
            if (bindingFailureSignal) {
                failureSignals.push(bindingFailureSignal);
            }
        }
        if (textInserted && visibleText.includes(input.text)) {
            successSignals.push("text_visible");
        }
        else {
            failureSignals.push("dom_variant");
        }
        if (preservedAfterBlur) {
            successSignals.push("text_persisted_after_blur");
        }
        else {
            failureSignals.push("text_reverted");
        }
        if (/风险|risk|提示|异常/u.test(normalizedPageText)) {
            failureSignals.push("risk_prompt");
        }
        const hasBlockingFailure = failureSignals.includes("text_reverted") ||
            failureSignals.includes("risk_prompt") ||
            failureSignals.includes("dom_variant");
        const controlledSuccess = focusAttestation?.source === "chrome_debugger" &&
            focusConfirmed &&
            textInserted &&
            visibleText.includes(input.text) &&
            preservedAfterBlur &&
            !hasBlockingFailure;
        const attempt = {
            ok: controlledSuccess,
            mode: controlledSuccess
                ? "controlled_editor_input_validation"
                : "dom_editor_input_validation",
            attestation: controlledSuccess ? "controlled_real_interaction" : "dom_self_certified",
            editor_locator: locator,
            input_text: input.text,
            before_text: beforeText,
            visible_text: visibleText,
            post_blur_text: postBlurText,
            focus_confirmed: focusConfirmed,
            focus_attestation_source: focusAttestation?.source ?? null,
            focus_attestation_reason: focusAttestation?.failure_reason ?? null,
            preserved_after_blur: preservedAfterBlur,
            success_signals: successSignals,
            failure_signals: failureSignals,
            minimum_replay: minimumReplay
        };
        if (attempt.ok) {
            return attempt;
        }
        if (!bestAttempt || attempt.success_signals.length > bestAttempt.success_signals.length) {
            bestAttempt = attempt;
        }
    }
    return (bestAttempt ?? {
        ok: false,
        mode: "dom_editor_input_validation",
        attestation: "dom_self_certified",
        editor_locator: null,
        input_text: input.text,
        before_text: "",
        visible_text: "",
        post_blur_text: "",
        focus_confirmed: false,
        focus_attestation_source: focusAttestation?.source ?? null,
        focus_attestation_reason: focusAttestation?.failure_reason ?? null,
        preserved_after_blur: false,
        success_signals: [],
        failure_signals: [...normalizeFocusAttestationFailure(focusAttestation), "dom_variant"],
        minimum_replay: minimumReplay
    });
};
return { performEditorInputValidation };
})();
const __webenvoy_module_xhs_media_upload_discovery = (() => {
const DEFAULT_PROGRESS_SIGNALS = ["preview_visible", "uploading", "upload_done"];
const DEFAULT_FAILURE_SIGNALS = [
    "entry_missing",
    "type_rejected",
    "size_rejected",
    "upload_failed",
    "risk_blocked",
    "upload_injection_blocked"
];
const creatorPublishControlRoles = [
    "private_visibility",
    "submit_or_next",
    "publish_or_confirm",
    "error_or_toast",
    "cleanup_or_abandon"
];
const requiredCreatorPublishControlRoles = new Set([
    "private_visibility",
    "submit_or_next",
    "publish_or_confirm",
    "error_or_toast",
    "cleanup_or_abandon"
]);
const privateVisibilityPattern = /私密|仅自己|仅我|自己可见|private|only\s*me|self/iu;
const publicVisibilityPattern = /公开|所有人|public|everyone/iu;
const submitOrNextPattern = /下一步|继续|完成|next|continue|submit/iu;
const publishOrConfirmPattern = /发布|确认发布|publish|post|confirm/iu;
const errorOrToastPattern = /toast|notice|alert|error|warning|错误|失败|提示|校验|验证/iu;
const cleanupOrAbandonPattern = /删除|移除|撤回|取消|放弃|清空|delete|remove|rollback|cancel|abandon|discard/iu;
const broadCreatorRootPattern = /(?:^|\s)(?:publish-vue-container|creator-publish-root|page-root|app-root)(?:\s|$)/iu;
const broadCreatorRootIds = new Set([
    "app",
    "CreatorPlatform",
    "page",
    "content-area",
    "creator-publish-dom"
]);
const broadCreatorContainerPattern = /(?:^|\s)(?:main-page-container|menu-container|menu-panel|list)(?:\s|$)/iu;
const publishModeNavigationPattern = /发布\s*(?:视频|图文|笔记)|(?:^|[\s_-])publish[\s_-]?(?:video|image|note)(?:$|[\s_-])/iu;
const creatorPublishControlsSelector = [
    "button",
    "a",
    "div",
    "span",
    "label",
    "input",
    "textarea",
    "select",
    "summary",
    "[role='button']",
    "[role='combobox']",
    "[role='listbox']",
    "[role='option']",
    "[role='menuitem']",
    "[role='menuitemradio']",
    "[role='radio']",
    "[role='alert']",
    "[role='status']",
    "[class*='select' i]",
    "[class*='dropdown' i]",
    "[class*='visibility' i]",
    "[class*='privacy' i]",
    "[class*='permission' i]",
    "[class*='submit' i]",
    "[class*='publish' i]",
    "[class*='button' i]",
    "[class*='toast' i]",
    "[class*='notice' i]",
    "[class*='error' i]",
    "[class*='delete' i]",
    "[class*='remove' i]",
    "[class*='cancel' i]"
].join(",");
const toArray = (value) => Array.from(value);
const sanitizeArtifactPart = (value) => value.replace(/[^A-Za-z0-9._:-]+/gu, "_").slice(0, 96);
const attr = (element, name) => {
    if (typeof element.getAttribute !== "function") {
        return null;
    }
    const value = element.getAttribute(name);
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};
const elementTextSignal = (element) => [
    "textContent" in element && typeof element.textContent === "string" ? element.textContent : "",
    attr(element, "id"),
    attr(element, "name"),
    attr(element, "aria-label"),
    attr(element, "title"),
    attr(element, "placeholder"),
    attr(element, "value"),
    attr(element, "data-testid"),
    attr(element, "data-test"),
    attr(element, "data-role"),
    attr(element, "data-action"),
    attr(element, "data-track"),
    attr(element, "data-log-click")
]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
const attributeNames = (element) => typeof element.getAttributeNames === "function" ? element.getAttributeNames().slice(0, 16) : [];
const classTokens = (element) => {
    const className = attr(element, "class");
    return className ? className.split(/\s+/u).filter(Boolean).slice(0, 8) : [];
};
const locatorFor = (element) => {
    const tagName = element.tagName.toLowerCase();
    const id = attr(element, "id");
    if (id) {
        return `${tagName}#${id}`;
    }
    const testId = attr(element, "data-testid") ?? attr(element, "data-test");
    if (testId) {
        return `${tagName}[data-testid="${testId.slice(0, 80)}"]`;
    }
    const role = attr(element, "role");
    const className = classTokens(element).slice(0, 3).join(".");
    if (className) {
        return `${tagName}.${className}`;
    }
    return role ? `${tagName}[role="${role}"]` : tagName;
};
const isElementVisible = (element) => {
    const html = element;
    if (attr(element, "hidden") !== null || attr(element, "aria-hidden") === "true") {
        return false;
    }
    const computedStyle = typeof globalThis.getComputedStyle === "function" ? globalThis.getComputedStyle(html) : null;
    if (computedStyle &&
        (computedStyle.display === "none" ||
            computedStyle.visibility === "hidden" ||
            computedStyle.visibility === "collapse" ||
            computedStyle.opacity === "0")) {
        return false;
    }
    if (typeof html.getClientRects === "function" && html.getClientRects().length === 0) {
        return false;
    }
    if (typeof html.offsetParent !== "undefined" && html.offsetParent === null) {
        const style = attr(element, "style") ?? "";
        return !/display\s*:\s*none|visibility\s*:\s*hidden/iu.test(style);
    }
    return true;
};
const isElementDisabled = (element) => attr(element, "disabled") !== null ||
    attr(element, "aria-disabled") === "true" ||
    attr(element, "data-disabled") === "true";
const signalFlags = (signal) => ({
    private_visibility: privateVisibilityPattern.test(signal),
    public_visibility: publicVisibilityPattern.test(signal),
    submit_or_next: submitOrNextPattern.test(signal),
    publish_or_confirm: publishOrConfirmPattern.test(signal),
    error_or_toast: errorOrToastPattern.test(signal),
    cleanup_or_abandon: cleanupOrAbandonPattern.test(signal)
});
const isBroadCreatorRootCandidate = (element, candidate) => {
    if (element.tagName.toLowerCase() !== "div") {
        return false;
    }
    const id = attr(element, "id");
    const className = attr(element, "class") ?? "";
    if (id === "web" ||
        (id !== null && broadCreatorRootIds.has(id)) ||
        broadCreatorRootPattern.test(className) ||
        broadCreatorContainerPattern.test(className)) {
        return candidate.text_signal_length > 80;
    }
    return false;
};
const hasPublishModeNavigationAncestor = (element) => typeof element.closest === "function" &&
    element.closest(".publish-video,.publish-image,.publish-note,.menu-container,.menu-panel,[data-role='publish-mode-nav']") !== null;
const isPublishModeNavigationCandidate = (role, element, signal) => {
    if (role !== "publish_or_confirm") {
        return false;
    }
    const className = attr(element, "class") ?? "";
    const roleAttr = attr(element, "role");
    const tagName = element.tagName.toLowerCase();
    const semanticActionTarget = tagName === "button" ||
        tagName === "a" ||
        tagName === "input" ||
        roleAttr === "button" ||
        roleAttr === "menuitem" ||
        /\b(?:button|submit|confirm)\b/iu.test(className);
    if (semanticActionTarget) {
        return false;
    }
    return (publishModeNavigationPattern.test(`${signal} ${className}`) ||
        hasPublishModeNavigationAncestor(element));
};
const candidateMatchesRole = (role, flags) => {
    if (role === "private_visibility") {
        return flags.private_visibility;
    }
    return flags[role];
};
const isActionablePrivateVisibilityCandidate = (candidate) => candidate.visible &&
    !candidate.disabled &&
    candidate.signal_flags.private_visibility &&
    !candidate.signal_flags.public_visibility;
const actionableCandidatesForRole = (role, candidates) => role === "private_visibility"
    ? candidates.filter(isActionablePrivateVisibilityCandidate)
    : candidates.filter((candidate) => candidate.visible && !candidate.disabled);
const classifyControlStatus = (role, candidates) => {
    if (candidates.length === 0) {
        return "missing";
    }
    const actionable = actionableCandidatesForRole(role, candidates);
    if (actionable.length === 0) {
        if (role === "private_visibility" && candidates.some((candidate) => candidate.visible && !candidate.disabled)) {
            return "ambiguous";
        }
        return candidates.some((candidate) => !candidate.visible) ? "hidden" : "disabled";
    }
    return actionable.length === 1 ? "ready" : "ambiguous";
};
const blockerForControl = (item, options = {}) => {
    if (item.status === "ready") {
        return null;
    }
    if (options.deferMissingControls === true && item.status === "missing") {
        return null;
    }
    const role = item.role;
    const prefix = role === "private_visibility"
        ? "PRIVATE_VISIBILITY_CONTROL"
        : role === "submit_or_next"
            ? "SUBMIT_OR_NEXT_CONTROL"
            : role === "publish_or_confirm"
                ? "PUBLISH_OR_CONFIRM_CONTROL"
                : role === "error_or_toast"
                    ? "ERROR_OR_TOAST_CONTROL"
                    : "CLEANUP_OR_ABANDON_CONTROL";
    const suffix = item.status === "ambiguous"
        ? "AMBIGUOUS"
        : item.status === "disabled"
            ? "DISABLED"
            : item.status === "hidden"
                ? "HIDDEN"
                : "MISSING";
    return {
        blocker_code: `${prefix}_${suffix}`,
        blocker_layer: "creator_publish_controls_recon",
        role,
        message: `${role} recon status is ${item.status}; controlled live write must not proceed blindly.`,
        required_recovery_action: "refresh XHS creator publish control locator coverage before controlled upload/submit/publish"
    };
};
const deferredMissingForControl = (item, options = {}) => {
    if (options.deferMissingControls !== true ||
        item.status !== "missing" ||
        item.required_for_live_write !== true) {
        return null;
    }
    return {
        role: item.role,
        status: "missing",
        defer_reason: "pre_upload_upload_entry_present_no_write_boundary",
        message: `${item.role} recon status is missing before controlled upload; this gap is deferred out of blocker_candidates until post-upload controls can mount.`,
        required_recovery_action: "rerun creator publish controls recon after controlled upload reaches the editor continuation stage"
    };
};
const buildCreatorPublishControlsRecon = (fileSelectionBoundary, pageUrl = "", options = {}) => {
    const collectedAt = new Date().toISOString();
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        const controls = creatorPublishControlRoles.map((role) => ({
            role,
            required_for_live_write: requiredCreatorPublishControlRoles.has(role),
            status: "missing",
            candidate_count: 0,
            selected_locator: null,
            candidates: []
        }));
        return {
            schema_version: "fr-0032.creator_publish_controls_recon.v1",
            no_write: true,
            target_page: "creator_publish_tab",
            page_url: pageUrl,
            collected_at: collectedAt,
            recording_policy: "locator_attributes_flags_and_lengths_only",
            controls,
            blocker_candidates: controls
                .map((control) => blockerForControl(control, options))
                .filter((item) => item !== null),
            deferred_missing_control_candidates: controls
                .map((control) => deferredMissingForControl(control, options))
                .filter((item) => item !== null),
            file_selection_boundary: fileSelectionBoundary
        };
    }
    const elements = toArray(document.querySelectorAll(creatorPublishControlsSelector));
    const controls = creatorPublishControlRoles.map((role) => {
        const candidates = elements
            .map((element) => {
            const signal = elementTextSignal(element);
            const flags = signalFlags(`${signal} ${attr(element, "class") ?? ""} ${attr(element, "role") ?? ""}`);
            if (!candidateMatchesRole(role, flags)) {
                return null;
            }
            if (isPublishModeNavigationCandidate(role, element, signal)) {
                return null;
            }
            const candidate = {
                role,
                locator: locatorFor(element),
                tag_name: element.tagName.toLowerCase(),
                attribute_names: attributeNames(element),
                class_tokens: classTokens(element),
                visible: isElementVisible(element),
                disabled: isElementDisabled(element),
                text_signal_length: signal.length,
                signal_flags: flags
            };
            return isBroadCreatorRootCandidate(element, candidate) ? null : candidate;
        })
            .filter((item) => item !== null)
            .slice(0, 12);
        const status = classifyControlStatus(role, candidates);
        const selected = actionableCandidatesForRole(role, candidates)[0] ?? null;
        return {
            role,
            required_for_live_write: requiredCreatorPublishControlRoles.has(role),
            status,
            candidate_count: candidates.length,
            selected_locator: status === "ready" ? selected?.locator ?? null : null,
            candidates
        };
    });
    return {
        schema_version: "fr-0032.creator_publish_controls_recon.v1",
        no_write: true,
        target_page: "creator_publish_tab",
        page_url: pageUrl,
        collected_at: collectedAt,
        recording_policy: "locator_attributes_flags_and_lengths_only",
        controls,
        blocker_candidates: controls
            .map((control) => blockerForControl(control, options))
            .filter((item) => item !== null),
        deferred_missing_control_candidates: controls
            .map((control) => deferredMissingForControl(control, options))
            .filter((item) => item !== null),
        file_selection_boundary: fileSelectionBoundary
    };
};
const describeFileInput = (input) => {
    const attributes = [
        input.accept ? `accept=${input.accept}` : null,
        input.multiple ? "multiple=true" : "multiple=false",
        input.disabled ? "disabled=true" : "disabled=false",
        input.hidden ? "hidden=true" : null,
        input.offsetParent === null ? "visible=false" : "visible=true"
    ].filter((item) => item !== null);
    return attributes.join("; ");
};
const discoverFileInputEvidence = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    const fileInputs = toArray(document.querySelectorAll('input[type="file"]'));
    if (fileInputs.length === 0) {
        return null;
    }
    const enabledInput = fileInputs.find((input) => !input.disabled) ?? fileInputs[0];
    return {
        scenario: "image_upload",
        route_role: "primary",
        path_kind: "page",
        entry_type: "file_input",
        file_injection: "data_transfer",
        trigger_events: ["change", "input"],
        progress_signals: DEFAULT_PROGRESS_SIGNALS,
        failure_signals: DEFAULT_FAILURE_SIGNALS,
        evidence_status: enabledInput?.disabled ? "failed" : "candidate",
        evidence_maturity: "observed_once",
        notes: `dry_run/recon only; no file bytes read; candidates=${fileInputs.length}; ${enabledInput ? describeFileInput(enabledInput) : "file input unavailable"}`
    };
};
const discoverDropzoneEvidence = () => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return null;
    }
    const dropzones = toArray(document.querySelectorAll([
        '[data-testid*="upload" i]',
        '[class*="upload" i]',
        '[class*="drop" i]',
        '[aria-label*="上传" i]',
        '[aria-label*="upload" i]'
    ].join(",")));
    if (dropzones.length === 0) {
        return null;
    }
    return {
        scenario: "image_upload",
        route_role: "primary",
        path_kind: "page",
        entry_type: "dropzone",
        file_injection: "data_transfer",
        trigger_events: ["dragenter", "dragover", "drop"],
        progress_signals: DEFAULT_PROGRESS_SIGNALS,
        failure_signals: DEFAULT_FAILURE_SIGNALS,
        evidence_status: "candidate",
        evidence_maturity: "observed_once",
        notes: `dry_run/recon only; dropzone candidates=${dropzones.length}; data_transfer injection remains blocked`
    };
};
const buildFileSelectionBoundary = () => ({
    file_bytes_read: false,
    native_picker_opened: false,
    data_transfer_injected: false,
    real_upload_attempted: false,
    submit_attempted: false,
    publish_attempted: false,
    allowed_modes: ["dry_run", "recon"]
});
const buildControlledUploadEvidence = (input) => {
    if (!input.source_media_ref || !input.source_media_digest || !input.source_media_kind) {
        return null;
    }
    if (input.source_media_kind !== "image" &&
        input.source_media_kind !== "video" &&
        input.source_media_kind !== "mixed") {
        return null;
    }
    const digestPart = sanitizeArtifactPart(input.source_media_digest);
    return {
        schema_version: "fr-0032.controlled_upload_path.v1",
        non_publish_validation: true,
        run_id: input.run_id ?? "unknown-run",
        profile_ref: input.profile_ref ?? null,
        target_tab_id: input.target_tab_id ?? null,
        page_url: input.page_url ?? "",
        upload_artifact_identity: {
            upload_artifact_id: `upload-artifact/fr-0032/${sanitizeArtifactPart(input.run_id ?? "unknown-run")}/${digestPart}`,
            source_media_ref: input.source_media_ref,
            source_media_digest: input.source_media_digest,
            source_media_kind: input.source_media_kind,
            platform_staging_ref: null,
            page_preview_locator: input.page_preview_locator,
            accepted_by_platform: false,
            visible_in_editor: false,
            captured_at: new Date().toISOString(),
            preview_diagnostics: null
        },
        file_selection_boundary: input.file_selection_boundary,
        stop_signal: null,
        submitted: false,
        published: false
    };
};
const evaluateControlledUploadEvidence = (evidence) => {
    const blockers = [];
    const limitations = [];
    const artifact = evidence?.upload_artifact_identity ?? null;
    const fileSelectionBoundary = evidence?.file_selection_boundary ?? null;
    if (!artifact) {
        blockers.push({
            blocker_code: "UPLOAD_ARTIFACT_IDENTITY_MISSING",
            message: "dry_run/recon upload evidence requires source_media_ref, source_media_digest and source_media_kind"
        });
    }
    if (artifact) {
        limitations.push({
            limitation_code: "REAL_UPLOAD_NOT_ATTEMPTED",
            message: "dry_run/recon does not attempt real platform upload or claim platform acceptance"
        }, {
            limitation_code: "EDITOR_PREVIEW_NOT_ASSERTED",
            message: "dry_run/recon does not inject DataTransfer or claim editor preview success"
        }, {
            limitation_code: "ENTRY_GATE_NOT_EVALUATED",
            message: "extension dry_run/recon evidence does not evaluate FR-0032 runtime entry gate"
        });
    }
    if (fileSelectionBoundary?.submit_attempted === true) {
        blockers.push({
            blocker_code: "SUBMIT_NOT_RUN",
            message: "dry_run/recon upload evidence must not submit"
        });
    }
    if (fileSelectionBoundary?.publish_attempted === true) {
        blockers.push({
            blocker_code: "PUBLISH_NOT_RUN",
            message: "dry_run/recon upload evidence must not publish"
        });
    }
    const laterWriteActionsBlocked = fileSelectionBoundary?.submit_attempted === true ||
        fileSelectionBoundary?.publish_attempted === true;
    return {
        schema_version: "fr-0032.controlled_upload_evaluation.v1",
        decision: blockers.length === 0 && artifact
            ? "EVIDENCE_PRESENT"
            : laterWriteActionsBlocked
                ? "BOUNDARY_VIOLATION"
                : "EVIDENCE_MISSING",
        upload_success: false,
        full_live_write_success: false,
        non_publish_validation: true,
        entry_gate_evaluated: false,
        runtime_evaluator_required_for_entry_gate: true,
        non_publish_evidence_status: artifact ? "EVIDENCE_PRESENT" : "EVIDENCE_MISSING",
        later_write_actions_blocked: laterWriteActionsBlocked,
        cleanup_required: artifact !== null && (blockers.length > 0 || laterWriteActionsBlocked),
        limitations,
        blockers
    };
};
const buildXhsMediaUploadDiscoveryResult = (input = {}) => {
    const pageEvidence = [discoverFileInputEvidence(), discoverDropzoneEvidence()].filter((item) => item !== null);
    const pageFailure = pageEvidence.length === 0
        ? {
            scenario: "image_upload",
            route_role: "primary",
            path_kind: "page",
            entry_type: "file_input",
            file_injection: "data_transfer",
            trigger_events: ["change", "input"],
            progress_signals: DEFAULT_PROGRESS_SIGNALS,
            failure_signals: DEFAULT_FAILURE_SIGNALS,
            evidence_status: "failed",
            evidence_maturity: "observed_once",
            notes: "dry_run/recon only; no file input or dropzone observed on current page"
        }
        : pageEvidence[0];
    const fileSelectionBoundary = buildFileSelectionBoundary();
    const fallbackApi = {
        scenario: "image_upload",
        route_role: "fallback",
        path_kind: "api",
        entry_type: "upload_api",
        file_injection: "api_direct",
        trigger_events: [],
        progress_signals: [],
        failure_signals: ["signature_entry_missing", "request_context_missing", "risk_blocked"],
        evidence_status: "candidate",
        evidence_maturity: "observed_once",
        notes: "fallback candidate only; not promoted to primary and not called during #755"
    };
    const controlledUploadEvidence = buildControlledUploadEvidence({
        ...input,
        page_preview_locator: pageFailure.evidence_status === "candidate" ? pageFailure.entry_type : null,
        file_selection_boundary: fileSelectionBoundary
    });
    const controlsRecon = buildCreatorPublishControlsRecon(fileSelectionBoundary, input.page_url ?? "", {
        deferMissingControls: pageFailure.evidence_status === "candidate" &&
            fileSelectionBoundary.file_bytes_read === false &&
            fileSelectionBoundary.real_upload_attempted === false &&
            fileSelectionBoundary.submit_attempted === false &&
            fileSelectionBoundary.publish_attempted === false
    });
    return {
        discovery_action: "media_upload_path",
        target_page: "creator_publish_tab",
        upload_path_catalog: [pageFailure, ...pageEvidence.slice(1), fallbackApi],
        creator_publish_controls_recon: controlsRecon,
        file_selection_boundary: fileSelectionBoundary,
        controlled_upload_evidence: controlledUploadEvidence,
        controlled_upload_evaluation: evaluateControlledUploadEvidence(controlledUploadEvidence),
        submitted: false,
        published: false,
        out_of_scope_actions: ["file_picker_open", "file_bytes_read", "data_transfer_injection", "submit", "publish_confirm"]
    };
};
return { buildXhsMediaUploadDiscoveryResult };
})();
const __webenvoy_module_xhs_command_contract = (() => {
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
class ExtensionContractError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.name = "ExtensionContractError";
        this.code = code;
        this.details = details;
    }
}
const invalidAbilityInput = (reason, abilityId = "unknown") => new ExtensionContractError("ERR_CLI_INVALID_ARGS", "能力输入不合法", {
    ability_id: abilityId,
    stage: "input_validation",
    reason
});
const asNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const SOURCE_MEDIA_KINDS = new Set(["image", "video", "mixed"]);
const SOURCE_MEDIA_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const UNSAFE_SOURCE_MEDIA_REF_PATTERN = /^(?:file:|\/|[A-Za-z]:[\\/])/u;
const XHS_EDITOR_INPUT_VALIDATE_COMMAND = "xhs.editor_input.validate";
const XHS_EDITOR_TEXT_WRITE_COMMAND = "xhs.editor_text.write";
const XHS_EDITOR_INPUT_VALIDATE_RUNTIME_SCOPE = "issue_208";
const XHS_EDITOR_TEXT_WRITE_RUNTIME_SCOPE = "issue_208";
const XHS_CREATOR_PUBLISH_ADMIT_COMMAND = "xhs.creator_publish.admit";
const XHS_CREATOR_PUBLISH_ADMIT_RUNTIME_SCOPE = "issue_753";
const XHS_MEDIA_UPLOAD_DISCOVER_COMMAND = "xhs.media_upload.discover";
const XHS_MEDIA_UPLOAD_DISCOVER_RUNTIME_SCOPE = "issue_755";
const XHS_CONTROLLED_LIVE_WRITE_COMMAND = "xhs.creator_publish.controlled_live_write";
const XHS_CONTROLLED_LIVE_WRITE_RUNTIME_SCOPE = "issue_835";
const validateNormalizedMediaUploadDiscoveryInput = (input, abilityId = "xhs.creator.publish.v1") => {
    const record = input;
    const sourceMediaRef = asNonEmptyString(record.source_media_ref);
    const sourceMediaDigest = asNonEmptyString(record.source_media_digest);
    const sourceMediaKind = asNonEmptyString(record.source_media_kind);
    const hasSourceMediaInput = sourceMediaRef !== null || sourceMediaDigest !== null || sourceMediaKind !== null;
    if (hasSourceMediaInput) {
        if (!sourceMediaRef || UNSAFE_SOURCE_MEDIA_REF_PATTERN.test(sourceMediaRef)) {
            throw invalidAbilityInput("SOURCE_MEDIA_REF_INVALID", abilityId);
        }
        if (!sourceMediaDigest || !SOURCE_MEDIA_DIGEST_PATTERN.test(sourceMediaDigest)) {
            throw invalidAbilityInput("SOURCE_MEDIA_DIGEST_INVALID", abilityId);
        }
        if (!sourceMediaKind || !SOURCE_MEDIA_KINDS.has(sourceMediaKind)) {
            throw invalidAbilityInput("SOURCE_MEDIA_KIND_INVALID", abilityId);
        }
    }
    return {
        target_page: "creator_publish_tab",
        discovery_action: "media_upload_path",
        ...(sourceMediaRef ? { source_media_ref: sourceMediaRef } : {}),
        ...(sourceMediaDigest ? { source_media_digest: sourceMediaDigest } : {}),
        ...(sourceMediaKind
            ? { source_media_kind: sourceMediaKind }
            : {})
    };
};
const parseSearchInput = (payload, abilityId, options, abilityAction) => {
    const issue208EditorInputValidation = abilityAction === "write" &&
        options.issue_scope === "issue_208" &&
        options.action_type === "write" &&
        options.requested_execution_mode === "live_write" &&
        options.validation_action === "editor_input";
    if (issue208EditorInputValidation) {
        return {};
    }
    const query = asNonEmptyString(payload.query);
    if (!query) {
        throw invalidAbilityInput("QUERY_MISSING", abilityId);
    }
    const normalized = {
        query
    };
    if (typeof payload.limit === "number" && Number.isFinite(payload.limit)) {
        normalized.limit = Math.max(1, Math.floor(payload.limit));
    }
    if (typeof payload.page === "number" && Number.isFinite(payload.page)) {
        normalized.page = Math.max(1, Math.floor(payload.page));
    }
    if (asNonEmptyString(payload.search_id)) {
        normalized.search_id = asNonEmptyString(payload.search_id);
    }
    if (asNonEmptyString(payload.sort)) {
        normalized.sort = asNonEmptyString(payload.sort);
    }
    if ((typeof payload.note_type === "string" && payload.note_type.trim().length > 0) ||
        typeof payload.note_type === "number") {
        normalized.note_type = payload.note_type;
    }
    return normalized;
};
const validateXhsCommandInputForExtension = (input) => {
    if (input.command === "xhs.search") {
        return parseSearchInput(input.payload, input.abilityId, input.options, input.abilityAction);
    }
    if (input.command === XHS_EDITOR_INPUT_VALIDATE_COMMAND) {
        if (input.abilityId !== "xhs.editor.input.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_EDITOR_INPUT_VALIDATE_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.validation_action !== "editor_input") {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        return { validation_action: "editor_input" };
    }
    if (input.command === XHS_EDITOR_TEXT_WRITE_COMMAND) {
        const text = asNonEmptyString(input.payload.text);
        if (input.abilityId !== "xhs.editor.input.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_EDITOR_TEXT_WRITE_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.validation_action !== "editor_input" ||
            input.options.editor_text_write !== true ||
            !text) {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        return { text, validation_action: "editor_input" };
    }
    if (input.command === XHS_CREATOR_PUBLISH_ADMIT_COMMAND) {
        if (input.abilityId !== "xhs.creator.publish.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_CREATOR_PUBLISH_ADMIT_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.target_domain !== "creator.xiaohongshu.com" ||
            input.options.target_page !== "creator_publish_tab") {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        return { target_page: "creator_publish_tab" };
    }
    if (input.command === XHS_MEDIA_UPLOAD_DISCOVER_COMMAND) {
        if (input.abilityId !== "xhs.creator.publish.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_MEDIA_UPLOAD_DISCOVER_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.discovery_action !== "media_upload_path" ||
            input.options.target_domain !== "creator.xiaohongshu.com" ||
            input.options.target_page !== "creator_publish_tab" ||
            (input.options.requested_execution_mode !== "dry_run" &&
                input.options.requested_execution_mode !== "recon")) {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        const sourceMediaRef = asNonEmptyString(input.payload.source_media_ref);
        const sourceMediaDigest = asNonEmptyString(input.payload.source_media_digest);
        const sourceMediaKind = asNonEmptyString(input.payload.source_media_kind);
        const hasSourceMediaInput = sourceMediaRef !== null || sourceMediaDigest !== null || sourceMediaKind !== null;
        if (hasSourceMediaInput) {
            if (!sourceMediaRef || UNSAFE_SOURCE_MEDIA_REF_PATTERN.test(sourceMediaRef)) {
                throw invalidAbilityInput("SOURCE_MEDIA_REF_INVALID", input.abilityId);
            }
            if (!sourceMediaDigest || !SOURCE_MEDIA_DIGEST_PATTERN.test(sourceMediaDigest)) {
                throw invalidAbilityInput("SOURCE_MEDIA_DIGEST_INVALID", input.abilityId);
            }
            if (!sourceMediaKind || !SOURCE_MEDIA_KINDS.has(sourceMediaKind)) {
                throw invalidAbilityInput("SOURCE_MEDIA_KIND_INVALID", input.abilityId);
            }
        }
        return {
            target_page: "creator_publish_tab",
            discovery_action: "media_upload_path",
            ...(sourceMediaRef ? { source_media_ref: sourceMediaRef } : {}),
            ...(sourceMediaDigest ? { source_media_digest: sourceMediaDigest } : {}),
            ...(sourceMediaKind
                ? { source_media_kind: sourceMediaKind }
                : {})
        };
    }
    if (input.command === XHS_CONTROLLED_LIVE_WRITE_COMMAND) {
        const liveWriteAttemptId = asNonEmptyString(input.payload.live_write_attempt_id);
        const sourceMediaRef = asNonEmptyString(input.payload.source_media_ref);
        const sourceMediaDigest = asNonEmptyString(input.payload.source_media_digest);
        const sourceMediaKind = asNonEmptyString(input.payload.source_media_kind);
        const acceptedUploadArtifactIdentity = input.payload.accepted_upload_artifact_identity === undefined
            ? undefined
            : asRecord(input.payload.accepted_upload_artifact_identity);
        if (input.abilityId !== "xhs.creator.publish.v1" ||
            input.abilityAction !== "write" ||
            input.options.issue_scope !== XHS_CONTROLLED_LIVE_WRITE_RUNTIME_SCOPE ||
            input.options.action_type !== "write" ||
            input.options.controlled_live_write !== true ||
            input.options.target_domain !== "creator.xiaohongshu.com" ||
            input.options.target_page !== "creator_publish_tab" ||
            input.options.requested_execution_mode !== "live_write" ||
            input.options.confirm_live_write !== true ||
            !liveWriteAttemptId ||
            !sourceMediaRef ||
            UNSAFE_SOURCE_MEDIA_REF_PATTERN.test(sourceMediaRef) ||
            !sourceMediaDigest ||
            !SOURCE_MEDIA_DIGEST_PATTERN.test(sourceMediaDigest) ||
            !sourceMediaKind ||
            !SOURCE_MEDIA_KINDS.has(sourceMediaKind) ||
            (input.payload.accepted_upload_artifact_identity !== undefined &&
                !acceptedUploadArtifactIdentity)) {
            throw invalidAbilityInput("ACTION_REQUEST_INVALID", input.abilityId);
        }
        return {
            target_page: "creator_publish_tab",
            live_write_attempt_id: liveWriteAttemptId,
            source_media_ref: sourceMediaRef,
            source_media_digest: sourceMediaDigest,
            source_media_kind: sourceMediaKind,
            ...(input.payload.__background_upload_capture_continuation === true
                ? { background_upload_capture_continuation: true }
                : {}),
            ...(acceptedUploadArtifactIdentity
                ? {
                    accepted_upload_artifact_identity: JSON.parse(JSON.stringify(acceptedUploadArtifactIdentity))
                }
                : {})
        };
    }
    if (input.command === "xhs.detail") {
        const noteId = asNonEmptyString(input.payload.note_id);
        if (!noteId) {
            throw invalidAbilityInput("NOTE_ID_MISSING", input.abilityId);
        }
        return { note_id: noteId };
    }
    if (input.command === "xhs.user_home") {
        const userId = asNonEmptyString(input.payload.user_id);
        if (!userId) {
            throw invalidAbilityInput("USER_ID_MISSING", input.abilityId);
        }
        return { user_id: userId };
    }
    throw invalidAbilityInput("ABILITY_COMMAND_UNSUPPORTED", input.abilityId);
};
return { ExtensionContractError, validateNormalizedMediaUploadDiscoveryInput, validateXhsCommandInputForExtension };
})();
const __webenvoy_module_content_script_main_world = (() => {
const {
  WEBENVOY_SYNTHETIC_REQUEST_HEADER,
  resolveActiveVisitedPageContextNamespace,
  resolveMainWorldPageContextNamespaceEventName
} = __webenvoy_module_xhs_search_types;
const MAIN_WORLD_EVENT_NAMESPACE = "webenvoy.main_world.bridge.v1";
const MAIN_WORLD_EVENT_REQUEST_PREFIX = "__mw_req__";
const MAIN_WORLD_EVENT_RESULT_PREFIX = "__mw_res__";
const MAIN_WORLD_EVENT_BOOTSTRAP = "__mw_bootstrap__";
const DEFAULT_MAIN_WORLD_CALL_TIMEOUT_MS = 5_000;
let mainWorldEventChannel = null;
let mainWorldResultListener = null;
let mainWorldResultListenerEventName = null;
let latestMainWorldPageContextNamespace = null;
let mainWorldPageContextNamespaceListener = null;
let mainWorldPageContextNamespaceListenerEventName = null;
const pendingMainWorldRequests = new Map();
const encodeUtf8Base64 = (value) => {
    if (typeof btoa === "function") {
        return btoa(unescape(encodeURIComponent(value)));
    }
    const bufferCtor = globalThis.Buffer;
    if (bufferCtor) {
        return bufferCtor.from(value, "utf8").toString("base64");
    }
    throw new Error("base64 encoder is unavailable");
};
const encodeMainWorldPayload = (value) => encodeUtf8Base64(JSON.stringify(value));
const hashMainWorldEventChannel = (value) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
};
const normalizeMainWorldSecret = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const createMainWorldBootstrapDetail = (secret) => {
    const names = resolveMainWorldEventNamesForSecret(secret);
    return {
        request_event: names.requestEvent,
        result_event: names.resultEvent,
        namespace_event: names.namespaceEvent
    };
};
const emitMainWorldBootstrap = (secret) => {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
        return;
    }
    window.dispatchEvent(createWindowEvent(MAIN_WORLD_EVENT_BOOTSTRAP, createMainWorldBootstrapDetail(secret)));
};
const resolveMainWorldEventNamesForSecret = (secret) => {
    const hashed = hashMainWorldEventChannel(`${MAIN_WORLD_EVENT_NAMESPACE}|${secret}`);
    return {
        requestEvent: `${MAIN_WORLD_EVENT_REQUEST_PREFIX}${hashed}`,
        resultEvent: `${MAIN_WORLD_EVENT_RESULT_PREFIX}${hashed}`,
        namespaceEvent: resolveMainWorldPageContextNamespaceEventName(secret)
    };
};
const createWindowEvent = (type, detail) => {
    const CustomEventCtor = globalThis.CustomEvent;
    if (typeof CustomEventCtor === "function") {
        return new CustomEventCtor(type, { detail });
    }
    return { type, detail };
};
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const installMainWorldPageContextNamespaceListener = (eventName) => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
        return;
    }
    if (mainWorldPageContextNamespaceListener &&
        mainWorldPageContextNamespaceListenerEventName === eventName) {
        return;
    }
    if (mainWorldPageContextNamespaceListener && mainWorldPageContextNamespaceListenerEventName) {
        try {
            window.removeEventListener(mainWorldPageContextNamespaceListenerEventName, mainWorldPageContextNamespaceListener);
        }
        catch {
            // noop in contract environments
        }
    }
    mainWorldPageContextNamespaceListener = ((event) => {
        const detail = asRecord(event.detail);
        const namespace = detail?.page_context_namespace;
        if (typeof namespace === "string" && namespace.length > 0) {
            latestMainWorldPageContextNamespace = namespace;
        }
    });
    mainWorldPageContextNamespaceListenerEventName = eventName;
    window.addEventListener(eventName, mainWorldPageContextNamespaceListener);
};
const onMainWorldResultEvent = (event) => {
    const detail = (event.detail ?? null);
    if (!detail || typeof detail.id !== "string") {
        return;
    }
    const pending = pendingMainWorldRequests.get(detail.id);
    if (!pending) {
        return;
    }
    clearTimeout(pending.timeout);
    pendingMainWorldRequests.delete(detail.id);
    if (detail.ok === true) {
        pending.resolve(detail.result);
        return;
    }
    const message = typeof detail.message === "string" ? detail.message : "main world call failed";
    const error = new Error(message);
    if (typeof detail.error_name === "string" && detail.error_name.length > 0) {
        error.name = detail.error_name;
    }
    if (typeof detail.error_code === "string" && detail.error_code.length > 0) {
        error.code = detail.error_code;
    }
    pending.reject(error);
};
const detachMainWorldResultListener = () => {
    if (!mainWorldResultListener || !mainWorldResultListenerEventName) {
        return;
    }
    try {
        window.removeEventListener(mainWorldResultListenerEventName, mainWorldResultListener);
    }
    catch {
        // noop in contract environments
    }
    mainWorldResultListener = null;
    mainWorldResultListenerEventName = null;
};
const installMainWorldEventChannelSecret = (secret) => {
    const normalizedSecret = normalizeMainWorldSecret(secret);
    if (typeof window === "undefined" ||
        typeof window.addEventListener !== "function" ||
        typeof window.dispatchEvent !== "function") {
        detachMainWorldResultListener();
        mainWorldEventChannel = null;
        return false;
    }
    if (!normalizedSecret) {
        detachMainWorldResultListener();
        mainWorldEventChannel = null;
        return false;
    }
    const names = resolveMainWorldEventNamesForSecret(normalizedSecret);
    installMainWorldPageContextNamespaceListener(names.namespaceEvent);
    if (mainWorldEventChannel?.secret === normalizedSecret &&
        mainWorldResultListenerEventName === names.resultEvent) {
        return true;
    }
    detachMainWorldResultListener();
    window.addEventListener(names.resultEvent, onMainWorldResultEvent);
    mainWorldEventChannel = {
        secret: normalizedSecret,
        requestEvent: names.requestEvent,
        resultEvent: names.resultEvent,
        namespaceEvent: names.namespaceEvent
    };
    mainWorldResultListener = onMainWorldResultEvent;
    mainWorldResultListenerEventName = names.resultEvent;
    emitMainWorldBootstrap(normalizedSecret);
    return true;
};
const resetMainWorldEventChannelForContract = () => {
    for (const pending of pendingMainWorldRequests.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("main world request reset"));
    }
    pendingMainWorldRequests.clear();
    latestMainWorldPageContextNamespace = null;
    if (mainWorldPageContextNamespaceListener &&
        mainWorldPageContextNamespaceListenerEventName &&
        typeof window !== "undefined" &&
        typeof window.removeEventListener === "function") {
        try {
            window.removeEventListener(mainWorldPageContextNamespaceListenerEventName, mainWorldPageContextNamespaceListener);
        }
        catch {
            // noop in contract environments
        }
    }
    mainWorldPageContextNamespaceListener = null;
    mainWorldPageContextNamespaceListenerEventName = null;
    detachMainWorldResultListener();
    mainWorldEventChannel = null;
};
const mainWorldCall = async (request) => {
    const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `mw-${Date.now()}`;
    return await new Promise((resolve, reject) => {
        if (!mainWorldEventChannel ||
            typeof window === "undefined" ||
            typeof window.dispatchEvent !== "function") {
            reject(new Error("main world event channel unavailable"));
            return;
        }
        emitMainWorldBootstrap(mainWorldEventChannel.secret);
        const responseTimeoutMs = DEFAULT_MAIN_WORLD_CALL_TIMEOUT_MS;
        const timeout = setTimeout(() => {
            pendingMainWorldRequests.delete(requestId);
            reject(new Error("main world event channel response timeout"));
        }, responseTimeoutMs);
        pendingMainWorldRequests.set(requestId, {
            resolve: (value) => resolve(value),
            reject,
            timeout
        });
        const requestDetail = {
            id: requestId,
            ...request
        };
        try {
            window.dispatchEvent(createWindowEvent(mainWorldEventChannel.requestEvent, requestDetail));
        }
        catch (error) {
            clearTimeout(timeout);
            pendingMainWorldRequests.delete(requestId);
            reject(error);
        }
    });
};
const installFingerprintRuntimeViaMainWorld = async (fingerprintRuntime) => await mainWorldCall({
    type: "fingerprint-install",
    payload: {
        fingerprint_runtime: fingerprintRuntime
    }
});
const verifyFingerprintRuntimeViaMainWorld = async () => await mainWorldCall({
    type: "fingerprint-verify",
    payload: {}
});
const readPageStateViaMainWorld = async () => {
    const result = await mainWorldCall({
        type: "page-state-read",
        payload: {}
    });
    return typeof result === "object" && result !== null && !Array.isArray(result)
        ? result
        : null;
};
const configureCapturedRequestContextProvenanceViaMainWorld = async (input) => {
    const result = await mainWorldCall({
        type: "captured-request-context-provenance-set",
        payload: {
            page_context_namespace: input.page_context_namespace,
            ...(typeof input.profile_ref === "string" ? { profile_ref: input.profile_ref } : {}),
            ...(typeof input.session_id === "string" ? { session_id: input.session_id } : {}),
            ...(typeof input.target_tab_id === "number" ? { target_tab_id: input.target_tab_id } : {}),
            ...(typeof input.run_id === "string" ? { run_id: input.run_id } : {}),
            ...(typeof input.action_ref === "string" ? { action_ref: input.action_ref } : {}),
            ...(typeof input.page_url === "string" ? { page_url: input.page_url } : {}),
            ...(typeof input.bind_fresh_window_ms === "number" &&
                Number.isFinite(input.bind_fresh_window_ms)
                ? { bind_fresh_window_ms: input.bind_fresh_window_ms }
                : {})
        }
    });
    return asRecord(result);
};
const asCapturedRequestContextLookupResult = (value) => {
    const record = asRecord(value);
    if (!record ||
        typeof record.page_context_namespace !== "string" ||
        typeof record.shape_key !== "string" ||
        !Array.isArray(record.available_shape_keys)) {
        return null;
    }
    return {
        page_context_namespace: record.page_context_namespace,
        shape_key: record.shape_key,
        admitted_template: asRecord(record.admitted_template),
        rejected_observation: asRecord(record.rejected_observation),
        incompatible_observation: asRecord(record.incompatible_observation),
        available_shape_keys: record.available_shape_keys.filter((item) => typeof item === "string"),
        ...(asRecord(record.diagnostics) ? { diagnostics: asRecord(record.diagnostics) ?? {} } : {})
    };
};
const readCapturedRequestContextViaMainWorld = async (input) => {
    if (mainWorldEventChannel?.namespaceEvent) {
        installMainWorldPageContextNamespaceListener(mainWorldEventChannel.namespaceEvent);
    }
    const pageContextNamespace = resolveActiveVisitedPageContextNamespace(input.page_context_namespace, latestMainWorldPageContextNamespace);
    const result = await mainWorldCall({
        type: "captured-request-context-read",
        payload: {
            method: input.method,
            path: input.path,
            ...(pageContextNamespace ? { page_context_namespace: pageContextNamespace } : {}),
            shape_key: input.shape_key,
            ...(typeof input.profile_ref === "string" ? { profile_ref: input.profile_ref } : {}),
            ...(typeof input.session_id === "string" ? { session_id: input.session_id } : {}),
            ...(typeof input.target_tab_id === "number" ? { target_tab_id: input.target_tab_id } : {}),
            ...(typeof input.run_id === "string" ? { run_id: input.run_id } : {}),
            ...(typeof input.action_ref === "string" ? { action_ref: input.action_ref } : {}),
            ...(typeof input.page_url === "string" ? { page_url: input.page_url } : {}),
            ...(typeof input.min_observed_at === "number" && Number.isFinite(input.min_observed_at)
                ? { min_observed_at: input.min_observed_at }
                : {})
        }
    });
    const normalized = asCapturedRequestContextLookupResult(result);
    if (!normalized ||
        resolveActiveVisitedPageContextNamespace(input.page_context_namespace, normalized.page_context_namespace) !== normalized.page_context_namespace ||
        normalized.shape_key !== input.shape_key) {
        return null;
    }
    if (typeof normalized.page_context_namespace === "string" &&
        normalized.page_context_namespace.length > 0) {
        latestMainWorldPageContextNamespace = normalized.page_context_namespace;
    }
    return normalized;
};
const resolveMainWorldRequestUrl = (value) => {
    const baseHref = typeof globalThis.location?.href === "string" && globalThis.location.href.length > 0
        ? globalThis.location.href
        : "https://www.xiaohongshu.com/";
    return new URL(value, baseHref).toString();
};
const requestXhsSearchJsonViaMainWorld = async (input) => {
    const runtime = globalThis.chrome?.runtime;
    const sendMessage = runtime?.sendMessage;
    if (!sendMessage) {
        throw new Error("extension runtime.sendMessage is unavailable");
    }
    const request = {
        kind: "xhs-main-world-request",
        url: resolveMainWorldRequestUrl(input.url),
        method: input.method,
        headers: input.headers,
        ...(typeof input.body === "string" ? { body: input.body } : {}),
        timeout_ms: input.timeoutMs,
        ...(typeof input.referrer === "string" ? { referrer: input.referrer } : {}),
        ...(typeof input.referrerPolicy === "string"
            ? { referrerPolicy: input.referrerPolicy }
            : {})
    };
    const response = await new Promise((resolve, reject) => {
        try {
            const maybePromise = sendMessage(request, (message) => {
                resolve(message ?? { ok: false, error: { message: "xhs main-world response missing" } });
            });
            if (maybePromise && typeof maybePromise.then === "function") {
                void maybePromise
                    .then((message) => {
                    if (message) {
                        resolve(message);
                    }
                })
                    .catch((error) => {
                    reject(error);
                });
            }
        }
        catch (error) {
            reject(error);
        }
    });
    if (!response.ok || !response.result) {
        const error = new Error(typeof response.error?.message === "string"
            ? response.error.message
            : "xhs main-world request failed");
        if (typeof response.error?.name === "string" && response.error.name.length > 0) {
            error.name = response.error.name;
        }
        throw error;
    }
    return response.result;
};
return { encodeMainWorldPayload, configureCapturedRequestContextProvenanceViaMainWorld, installFingerprintRuntimeViaMainWorld, installMainWorldEventChannelSecret, MAIN_WORLD_EVENT_BOOTSTRAP, readCapturedRequestContextViaMainWorld, readPageStateViaMainWorld, requestXhsSearchJsonViaMainWorld, resetMainWorldEventChannelForContract, resolveMainWorldEventNamesForSecret, verifyFingerprintRuntimeViaMainWorld };
})();
const __webenvoy_module_content_script_fingerprint = (() => {
const { ensureFingerprintRuntimeContext } = __webenvoy_module_fingerprint_profile;
const {
  installFingerprintRuntimeViaMainWorld,
  verifyFingerprintRuntimeViaMainWorld
} = __webenvoy_module_content_script_main_world;
const AUDIO_PATCH_EPSILON = 1e-12;
const FINGERPRINT_PROBE_TIMEOUT_MS = 1_500;
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asString = (value) => typeof value === "string" && value.length > 0 ? value : null;
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const withFingerprintProbeTimeout = async (promise, fallback) => await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
        if (settled) {
            return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(value);
    };
    const timer = setTimeout(() => finish(fallback), FINGERPRINT_PROBE_TIMEOUT_MS);
    promise.then(finish).catch(() => finish(fallback));
});
const cloneFingerprintRuntimeContextWithInjection = (runtime, injection) => injection
    ? {
        ...runtime,
        injection: JSON.parse(JSON.stringify(injection))
    }
    : { ...runtime };
const resolveAttestedFingerprintRuntimeContext = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const injection = asRecord(record.injection);
    const direct = ensureFingerprintRuntimeContext(record);
    if (direct) {
        return cloneFingerprintRuntimeContextWithInjection(direct, injection);
    }
    const sanitized = { ...record };
    delete sanitized.injection;
    const normalized = ensureFingerprintRuntimeContext(sanitized);
    return normalized ? cloneFingerprintRuntimeContextWithInjection(normalized, injection) : null;
};
const resolveFingerprintContextFromCommandParams = (commandParams) => asRecord(commandParams.fingerprint_context) ?? asRecord(commandParams.fingerprint_runtime) ?? null;
const resolveFingerprintContextFromMessage = (message) => {
    const direct = resolveAttestedFingerprintRuntimeContext(message.fingerprintContext ?? null);
    if (direct) {
        return direct;
    }
    const fallback = resolveAttestedFingerprintRuntimeContext(resolveFingerprintContextFromCommandParams(message.commandParams));
    return fallback ?? null;
};
const resolveRequiredFingerprintPatches = (fingerprintRuntime) => asStringArray(asRecord(fingerprintRuntime.fingerprint_patch_manifest)?.required_patches);
const buildFailedFingerprintInjectionContext = (fingerprintRuntime, errorMessage) => {
    const requiredPatches = resolveRequiredFingerprintPatches(fingerprintRuntime);
    return {
        ...fingerprintRuntime,
        injection: {
            installed: false,
            required_patches: requiredPatches,
            missing_required_patches: requiredPatches,
            error: errorMessage
        }
    };
};
const hasInstalledFingerprintInjection = (fingerprintRuntime) => {
    const existingInjection = asRecord(fingerprintRuntime.injection);
    return (existingInjection?.installed === true &&
        asStringArray(existingInjection.missing_required_patches).length === 0);
};
const resolveMissingRequiredFingerprintPatches = (fingerprintRuntime) => {
    const injection = asRecord(fingerprintRuntime.injection);
    const requiredPatches = asStringArray(injection?.required_patches);
    const missingRequiredPatches = asStringArray(injection?.missing_required_patches);
    if (missingRequiredPatches.length > 0) {
        return missingRequiredPatches;
    }
    if (injection?.installed === true) {
        return [];
    }
    return requiredPatches;
};
const summarizeFingerprintRuntimeContext = (fingerprintRuntime) => {
    if (!fingerprintRuntime) {
        return null;
    }
    const record = fingerprintRuntime;
    const execution = asRecord(record.execution);
    const injection = asRecord(record.injection);
    return {
        profile: asString(record.profile),
        source: asString(record.source),
        execution: execution
            ? {
                live_allowed: execution.live_allowed === true,
                live_decision: asString(execution.live_decision),
                allowed_execution_modes: asStringArray(execution.allowed_execution_modes),
                reason_codes: asStringArray(execution.reason_codes)
            }
            : null,
        injection: injection
            ? {
                installed: injection.installed === true,
                source: asString(injection.source),
                required_patches: asStringArray(injection.required_patches),
                missing_required_patches: asStringArray(injection.missing_required_patches),
                error: asString(injection.error)
            }
            : null
    };
};
const resolveFingerprintContextForContract = (message) => resolveFingerprintContextFromMessage({
    commandParams: message.commandParams,
    fingerprintContext: message.fingerprintContext
});
const probeAudioFirstSample = async () => {
    const offlineAudioCtor = typeof window.OfflineAudioContext === "function"
        ? window.OfflineAudioContext
        : typeof window
            .webkitOfflineAudioContext === "function"
            ? window
                .webkitOfflineAudioContext ?? null
            : null;
    if (!offlineAudioCtor) {
        return null;
    }
    try {
        const offlineAudioContext = new offlineAudioCtor(1, 256, 44_100);
        const renderedBuffer = await withFingerprintProbeTimeout(offlineAudioContext.startRendering(), null);
        if (!renderedBuffer || typeof renderedBuffer.getChannelData !== "function") {
            return null;
        }
        const channelData = renderedBuffer.getChannelData(0);
        if (!channelData || typeof channelData.length !== "number" || channelData.length < 1) {
            return null;
        }
        const firstSample = Number(channelData[0]);
        return Number.isFinite(firstSample) ? firstSample : null;
    }
    catch {
        return null;
    }
};
const probeBatteryApi = async () => {
    const getBattery = window.navigator
        .getBattery;
    if (typeof getBattery !== "function") {
        return false;
    }
    try {
        const battery = asRecord(await withFingerprintProbeTimeout(getBattery(), null));
        return typeof battery?.level === "number" && typeof battery?.charging === "boolean";
    }
    catch {
        return false;
    }
};
const probeNavigatorPlugins = () => {
    const plugins = window.navigator.plugins;
    return (typeof plugins === "object" &&
        plugins !== null &&
        typeof plugins.length === "number" &&
        Number(plugins.length) > 0);
};
const probeNavigatorMimeTypes = () => {
    const mimeTypes = window.navigator.mimeTypes;
    return (typeof mimeTypes === "object" &&
        mimeTypes !== null &&
        typeof mimeTypes.length === "number" &&
        Number(mimeTypes.length) > 0);
};
const verifyFingerprintInstallResult = async (input) => {
    const requiredPatches = resolveRequiredFingerprintPatches(input.fingerprintRuntime);
    const reportedAppliedPatches = asStringArray(input.installResult?.applied_patches);
    const mainWorldVerification = requiredPatches.includes("battery")
        ? asRecord(await verifyFingerprintRuntimeViaMainWorld().catch(() => null))
        : null;
    const appliedPatches = [];
    const missingRequiredPatches = [];
    const probeDetails = {};
    if (requiredPatches.includes("audio_context")) {
        const postInstallAudioSample = await probeAudioFirstSample();
        const audioPatched = reportedAppliedPatches.includes("audio_context") ||
            (postInstallAudioSample !== null &&
                (input.preInstallAudioSample === null ||
                    Math.abs(postInstallAudioSample - input.preInstallAudioSample) > AUDIO_PATCH_EPSILON));
        probeDetails.audio_context = {
            pre_install_first_sample: input.preInstallAudioSample,
            post_install_first_sample: postInstallAudioSample,
            verified: audioPatched
        };
        if (audioPatched) {
            appliedPatches.push("audio_context");
        }
        else {
            missingRequiredPatches.push("audio_context");
        }
    }
    if (requiredPatches.includes("battery")) {
        const isolatedWorldBatteryPatched = await probeBatteryApi();
        const mainWorldBatteryPatched = mainWorldVerification?.has_get_battery === true;
        const batteryPatched = isolatedWorldBatteryPatched || mainWorldBatteryPatched;
        probeDetails.battery = {
            verified: batteryPatched,
            isolated_world_verified: isolatedWorldBatteryPatched,
            main_world_verified: mainWorldBatteryPatched,
            reported_applied: reportedAppliedPatches.includes("battery")
        };
        if (batteryPatched) {
            appliedPatches.push("battery");
        }
        else {
            missingRequiredPatches.push("battery");
        }
    }
    if (requiredPatches.includes("navigator_plugins")) {
        const pluginsPatched = probeNavigatorPlugins();
        probeDetails.navigator_plugins = { verified: pluginsPatched };
        if (pluginsPatched) {
            appliedPatches.push("navigator_plugins");
        }
        else {
            missingRequiredPatches.push("navigator_plugins");
        }
    }
    if (requiredPatches.includes("navigator_mime_types")) {
        const mimeTypesPatched = probeNavigatorMimeTypes();
        probeDetails.navigator_mime_types = { verified: mimeTypesPatched };
        if (mimeTypesPatched) {
            appliedPatches.push("navigator_mime_types");
        }
        else {
            missingRequiredPatches.push("navigator_mime_types");
        }
    }
    for (const patchName of requiredPatches) {
        if (!appliedPatches.includes(patchName) && !missingRequiredPatches.includes(patchName)) {
            missingRequiredPatches.push(patchName);
        }
    }
    return {
        ...(input.installResult ?? {}),
        installed: missingRequiredPatches.length === 0,
        required_patches: requiredPatches,
        applied_patches: appliedPatches,
        missing_required_patches: missingRequiredPatches,
        verification: {
            channel: "isolated_world_probes",
            probes: probeDetails
        }
    };
};
const installFingerprintRuntimeWithVerification = async (fingerprintRuntime) => {
    const requiredPatches = resolveRequiredFingerprintPatches(fingerprintRuntime);
    const preInstallAudioSample = requiredPatches.includes("audio_context")
        ? await probeAudioFirstSample()
        : null;
    const installResult = await installFingerprintRuntimeViaMainWorld(fingerprintRuntime);
    return await verifyFingerprintInstallResult({
        fingerprintRuntime,
        installResult: asRecord(installResult),
        preInstallAudioSample
    });
};
return { buildFailedFingerprintInjectionContext, hasInstalledFingerprintInjection, installFingerprintRuntimeWithVerification, resolveFingerprintContextForContract, resolveFingerprintContextFromMessage, resolveMissingRequiredFingerprintPatches, summarizeFingerprintRuntimeContext };
})();
const __webenvoy_module_content_script_handler = (() => {
const { executeXhsSearch } = __webenvoy_module_xhs_search;
const { executeXhsDetail } = __webenvoy_module_xhs_detail;
const { executeXhsUserHome } = __webenvoy_module_xhs_user_home;
const { performEditorInputValidation } = __webenvoy_module_xhs_editor_input;
const { buildXhsMediaUploadDiscoveryResult } = __webenvoy_module_xhs_media_upload_discovery;
const {
  performXhsControlledLiveWriteWithApprovedSourceMedia,
  buildXhsControlledLiveWriteUploadBlockedResult
} = __webenvoy_module_xhs_controlled_live_write;
const {
  SEARCH_ENDPOINT,
  createPageContextNamespace,
  createSearchRequestShape,
  serializeSearchRequestShape
} = __webenvoy_module_xhs_search_types;
const { ensureFingerprintRuntimeContext } = __webenvoy_module_fingerprint_profile;
const {
  buildFailedFingerprintInjectionContext,
  hasInstalledFingerprintInjection,
  installFingerprintRuntimeWithVerification,
  resolveFingerprintContextForContract,
  resolveFingerprintContextFromMessage,
  resolveMissingRequiredFingerprintPatches,
  summarizeFingerprintRuntimeContext
} = __webenvoy_module_content_script_fingerprint;
const {
  ExtensionContractError,
  validateNormalizedMediaUploadDiscoveryInput,
  validateXhsCommandInputForExtension
} = __webenvoy_module_xhs_command_contract;
const { containsCookie, hasXhsAccountSafetyOverlaySignal } = __webenvoy_module_xhs_search_telemetry;
const {
  encodeMainWorldPayload,
  configureCapturedRequestContextProvenanceViaMainWorld,
  installFingerprintRuntimeViaMainWorld,
  installMainWorldEventChannelSecret,
  MAIN_WORLD_EVENT_BOOTSTRAP,
  readCapturedRequestContextViaMainWorld,
  readPageStateViaMainWorld,
  requestXhsSearchJsonViaMainWorld,
  resetMainWorldEventChannelForContract,
  resolveMainWorldEventNamesForSecret
} = __webenvoy_module_content_script_main_world;
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const hasOwn = (record, key) => record !== null && record !== undefined && Object.prototype.hasOwnProperty.call(record, key);
const LIVE_EXECUTION_MODES = new Set(["live_read_limited", "live_read_high_risk", "live_write"]);
const XHS_PAGE_COMMANDS = new Set([
    "xhs.search",
    "xhs.editor_input.validate",
    "xhs.editor_text.write",
    "xhs.creator_publish.admit",
    "xhs.creator_publish.controlled_live_write",
    "xhs.media_upload.discover",
    "xhs.detail",
    "xhs.user_home"
]);
const DOWNLOAD_COMMANDS = new Set(["download.trigger"]);
const XHS_READ_DOMAIN = "www.xiaohongshu.com";
const CONTENT_SCRIPT_DIAGNOSTIC_BUILD_MARKER = "issue650-closeout-deadline-v1";
const createCurrentPageContextNamespace = (href) => {
    const normalized = href.trim();
    if (normalized.length === 0) {
        return "about:blank";
    }
    try {
        const parsed = new URL(normalized, "https://www.xiaohongshu.com/");
        const pathname = parsed.pathname.length > 0 ? parsed.pathname : "/";
        const queryIdentity = parsed.search.length > 0 ? `${pathname}${parsed.search}` : pathname;
        const documentTimeOrigin = typeof globalThis.performance?.timeOrigin === "number" &&
            Number.isFinite(globalThis.performance.timeOrigin)
            ? Math.trunc(globalThis.performance.timeOrigin)
            : null;
        return documentTimeOrigin === null
            ? `${parsed.origin}${queryIdentity}`
            : `${parsed.origin}${queryIdentity}#doc=${documentTimeOrigin}`;
    }
    catch {
        return normalized;
    }
};
const asString = (value) => typeof value === "string" && value.length > 0 ? value : null;
const asStringArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
const L2_ALLOWED_ACTIONS = new Set([
    "navigate",
    "locate",
    "reveal_only_click",
    "extract",
    "wait_settled"
]);
const L2_REVEAL_ONLY_CLICK_KINDS = new Set([
    "expand_or_collapse",
    "switch_content_tab",
    "open_detail_view",
    "load_more_or_paginate"
]);
const normalizeL2AbilitySegment = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "page";
const contractRefForL2Ability = (abilityId, kind) => `cad::${abilityId}::${kind}::v1`;
const textOfElement = (element) => {
    const htmlElement = element;
    return (htmlElement.innerText ?? htmlElement.textContent ?? "").trim().replace(/\s+/g, " ");
};
const isElementVisibleForL2 = (element) => {
    if (typeof HTMLElement !== "undefined" && !(element instanceof HTMLElement)) {
        return false;
    }
    const text = textOfElement(element);
    if (text.length === 0) {
        return false;
    }
    const rect = element.getBoundingClientRect?.();
    return !rect || rect.width > 0 || rect.height > 0;
};
const collectL2TextItems = (selector, limit) => {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return [];
    }
    return Array.from(document.querySelectorAll(selector))
        .filter(isElementVisibleForL2)
        .slice(0, limit)
        .map((element, index) => ({
        ref: `${selector}:${index + 1}`,
        text: textOfElement(element).slice(0, 240)
    }));
};
const collectL2PageStructure = () => ({
    headings: collectL2TextItems("h1,h2,h3,[role='heading']", 12),
    links: collectL2TextItems("a[href]", 20),
    buttons: collectL2TextItems("button,[role='button']", 20)
});
const buildL2CandidateShellSeed = (input) => {
    const inputRef = contractRefForL2Ability(input.abilityId, "input");
    const outputRef = contractRefForL2Ability(input.abilityId, "output");
    const errorRef = contractRefForL2Ability(input.abilityId, "error");
    const parsedUrl = new URL(input.targetUrl);
    return {
        ability_id: input.abilityId,
        display_name: input.displayName,
        ability_kind: "read",
        entrypoint: "l2.first_usable",
        platform_scope: {
            platform_family: "generic_web",
            site_pattern: parsedUrl.hostname
        },
        execution_layer_support: ["L2"],
        input_contract_ref: inputRef,
        output_contract_ref: outputRef,
        error_contract_ref: errorRef,
        capture_origin: "l2_first_usable_sample",
        capture_run_id: input.runId,
        capture_profile: input.profile,
        capture_artifact_refs: [`l2-first-usable://${input.runId}`],
        captured_at: input.capturedAt,
        candidate_status: "draft_candidate",
        contract_registry_seed: {
            ability_id: input.abilityId,
            entries: [
                {
                    contract_ref: inputRef,
                    contract_kind: "input",
                    contract_body: {
                        type: "object",
                        required: ["target_url", "goal_kind", "risk_gate_context", "allowed_actions"]
                    }
                },
                {
                    contract_ref: outputRef,
                    contract_kind: "output",
                    contract_body: {
                        type: "object",
                        required: ["page_url", "title", "text_excerpt", "structure"]
                    }
                },
                {
                    contract_ref: errorRef,
                    contract_kind: "error",
                    contract_body: {
                        type: "object",
                        required: ["failure_class"]
                    }
                }
            ]
        }
    };
};
const hasReadyFingerprintRuntime = (fingerprintRuntime) => {
    const injection = asRecord(fingerprintRuntime?.injection);
    const execution = asRecord(fingerprintRuntime?.execution);
    return (injection?.installed === true &&
        asStringArray(injection.missing_required_patches).length === 0 &&
        execution?.live_allowed === true &&
        execution.live_decision === "allowed");
};
const capturedRequestContextProvenanceConfirmed = (value, expected) => {
    const record = asRecord(value);
    return (record?.configured === true &&
        record.profile_ref === expected.profile_ref &&
        record.session_id === expected.session_id &&
        (expected.target_tab_id === null || record.target_tab_id === expected.target_tab_id) &&
        record.run_id === expected.run_id &&
        record.action_ref === expected.action_ref &&
        record.page_url === expected.page_url);
};
const resolveTrustedActiveFallbackRuntimeAttestation = (input) => {
    const attestation = asRecord(input.raw.runtime_attestation);
    if (!attestation) {
        return null;
    }
    if (attestation.source !== "official_chrome_runtime_readiness" ||
        attestation.runtime_readiness !== "ready" ||
        attestation.profile_ref !== input.profile ||
        attestation.run_id !== input.runId ||
        attestation.session_id !== input.sessionId) {
        return null;
    }
    return attestation;
};
const resolveActiveApiFetchFallbackGateOptions = (input) => {
    const raw = asRecord(input.rawOptions.active_api_fetch_fallback);
    if (!raw) {
        return null;
    }
    const { fingerprint_validation_state: _fingerprintValidationState, execution_surface: _executionSurface, headless: _headless, runtime_attestation: _runtimeAttestation, fingerprint_attestation: _fingerprintAttestation, ...callerGate } = raw;
    const runtimeAttestation = resolveTrustedActiveFallbackRuntimeAttestation({
        raw,
        profile: input.profile,
        runId: input.runId,
        sessionId: input.sessionId
    });
    const fingerprintReady = hasReadyFingerprintRuntime(input.fingerprintRuntime);
    const missingRequiredPatches = asStringArray(asRecord(input.fingerprintRuntime?.injection)?.missing_required_patches);
    return {
        ...callerGate,
        ...(fingerprintReady ? { fingerprint_validation_state: "ready" } : {}),
        ...(runtimeAttestation
            ? {
                execution_surface: asString(runtimeAttestation.execution_surface) ?? "unknown",
                ...(typeof runtimeAttestation.headless === "boolean"
                    ? { headless: runtimeAttestation.headless }
                    : {}),
                runtime_attestation: runtimeAttestation
            }
            : {}),
        fingerprint_attestation: {
            source: "content_script_fingerprint_runtime",
            validation_state: fingerprintReady ? "ready" : "not_ready",
            profile_ref: asString(input.fingerprintRuntime?.profile),
            missing_required_patches: missingRequiredPatches
        }
    };
};
const toCliInvalidArgsResult = (input) => ({
    kind: "result",
    id: input.id,
    ok: false,
    error: {
        code: input.error.code,
        message: input.error.message
    },
    payload: {
        ...(input.error.details ? { details: input.error.details } : {}),
        ...(input.fingerprintRuntime ? { fingerprint_runtime: input.fingerprintRuntime } : {})
    }
});
const resolveRequestedExecutionMode = (message) => {
    const topLevelMode = asString(asRecord(message.commandParams)?.requested_execution_mode);
    if (topLevelMode) {
        return topLevelMode;
    }
    const options = asRecord(message.commandParams.options);
    return asString(options?.requested_execution_mode);
};
const extractFetchBody = async (response) => {
    const text = await response.text();
    if (text.length === 0) {
        return null;
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return {
            message: text
        };
    }
};
const requestXhsSignatureViaExtension = async (uri, body) => {
    const runtime = globalThis.chrome?.runtime;
    const sendMessage = runtime?.sendMessage;
    if (!sendMessage) {
        throw new Error("extension runtime.sendMessage is unavailable");
    }
    const request = {
        kind: "xhs-sign-request",
        uri,
        body
    };
    const response = await new Promise((resolve, reject) => {
        try {
            const maybePromise = sendMessage(request, (message) => {
                resolve(message ?? { ok: false, error: { message: "xhs-sign response missing" } });
            });
            if (maybePromise && typeof maybePromise.then === "function") {
                void maybePromise
                    .then((message) => {
                    if (message) {
                        resolve(message);
                    }
                })
                    .catch((error) => {
                    reject(error);
                });
            }
        }
        catch (error) {
            reject(error);
        }
    });
    if (!response.ok || !response.result) {
        throw new Error(typeof response.error?.message === "string" ? response.error.message : "xhs-sign failed");
    }
    return response.result;
};
const requestXhsSearchDebuggerActionViaExtension = async (input) => {
    const runtime = globalThis.chrome?.runtime;
    const sendMessage = runtime?.sendMessage;
    if (!sendMessage) {
        return {
            ok: false,
            error: {
                code: "ERR_XHS_SEARCH_DEBUGGER_UNAVAILABLE",
                message: "extension runtime.sendMessage is unavailable"
            }
        };
    }
    const request = {
        kind: "xhs-search-debugger-action",
        query: input.query,
        run_id: input.runId,
        action_ref: input.actionRef,
        ...(typeof input.timeoutMs === "number" ? { timeout_ms: input.timeoutMs } : {}),
        ...(input.actionMode ? { action_mode: input.actionMode } : {})
    };
    try {
        const response = await new Promise((resolve, reject) => {
            let settled = false;
            const timeoutMs = typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
                ? Math.floor(input.timeoutMs)
                : 12_000;
            const resolveOnce = (message) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(message);
            };
            const rejectOnce = (error) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                reject(error);
            };
            const timer = setTimeout(() => {
                resolveOnce({
                    ok: false,
                    error: {
                        code: "ERR_XHS_SEARCH_DEBUGGER_TIMEOUT",
                        message: `xhs search debugger action timed out after ${timeoutMs}ms`
                    }
                });
            }, timeoutMs);
            try {
                const maybePromise = sendMessage(request, (message) => {
                    const lastError = globalThis.chrome?.runtime?.lastError;
                    if (lastError?.message) {
                        resolveOnce({
                            ok: false,
                            error: {
                                code: "ERR_XHS_SEARCH_DEBUGGER_FAILED",
                                message: lastError.message
                            }
                        });
                        return;
                    }
                    resolveOnce(message ?? {
                        ok: false,
                        error: { code: "ERR_XHS_SEARCH_DEBUGGER_FAILED", message: "response missing" }
                    });
                });
                if (maybePromise && typeof maybePromise.then === "function") {
                    void maybePromise
                        .then((message) => {
                        if (message) {
                            resolveOnce(message);
                        }
                    })
                        .catch((error) => {
                        rejectOnce(error);
                    });
                }
            }
            catch (error) {
                rejectOnce(error);
            }
        });
        return response.ok && response.result
            ? { ok: true, result: response.result }
            : { ok: false, error: response.error };
    }
    catch (error) {
        return {
            ok: false,
            error: {
                code: "ERR_XHS_SEARCH_DEBUGGER_FAILED",
                message: error instanceof Error ? error.message : String(error)
            }
        };
    }
};
const buildRuntimeBootstrapAckPayload = (input) => ({
    method: "runtime.bootstrap.ack",
    result: {
        version: input.version,
        run_id: input.runId,
        runtime_context_id: input.runtimeContextId,
        profile: input.profile,
        status: input.attested ? "ready" : "pending"
    },
    runtime_bootstrap_attested: input.attested,
    ...(input.runtimeWithInjection ? { fingerprint_runtime: input.runtimeWithInjection } : {})
});
const ACCOUNT_SAFETY_OVERLAY_SELECTORS = [
    ".login-modal",
    ".login-container",
    ".login-wrapper",
    ".reds-login-container",
    ".captcha-container",
    ".verify-container",
    ".security-verify",
    ".risk-page",
    ".risk-modal",
    '[class*="login"]',
    '[class*="captcha"]',
    '[class*="verify"]',
    '[class*="security"]',
    '[class*="risk"]',
    '[id*="login"]',
    '[id*="captcha"]',
    '[id*="verify"]',
    '[id*="security"]',
    '[id*="risk"]',
    '[role="dialog"]',
    '[aria-modal="true"]'
];
const GENERIC_OVERLAY_SELECTORS = new Set(['[role="dialog"]', '[aria-modal="true"]']);
const isVisibleElement = (element) => {
    const candidate = element;
    if (typeof candidate.getBoundingClientRect !== "function") {
        return false;
    }
    if (typeof window.getComputedStyle !== "function") {
        return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
    }
    const rect = candidate.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
};
const readAccountSafetyOverlay = () => {
    if (typeof document.querySelectorAll !== "function") {
        return null;
    }
    for (const element of Array.from(document.querySelectorAll(ACCOUNT_SAFETY_OVERLAY_SELECTORS.join(",")))) {
        if (!isVisibleElement(element)) {
            continue;
        }
        const text = (element.innerText || element.textContent || "").trim();
        if (!text || !hasXhsAccountSafetyOverlaySignal(text)) {
            continue;
        }
        const selector = ACCOUNT_SAFETY_OVERLAY_SELECTORS.find((candidate) => element.matches(candidate)) ?? null;
        if (!selector || GENERIC_OVERLAY_SELECTORS.has(selector)) {
            continue;
        }
        return {
            source: "dom_overlay",
            selector,
            text: text.slice(0, 2000)
        };
    }
    return null;
};
const toAbsoluteXhsHref = (href) => {
    if (!href || href.trim().length === 0) {
        return null;
    }
    try {
        return new URL(href, window.location.origin).toString();
    }
    catch {
        return href;
    }
};
const hasSearchCardLikeJson = (value, seen = new Set()) => {
    const record = asRecord(value);
    if (record) {
        if (seen.has(record)) {
            return false;
        }
        seen.add(record);
        const href = asString(record.detail_url) ??
            asString(record.detailUrl) ??
            asString(record.note_url) ??
            asString(record.noteUrl) ??
            asString(record.href) ??
            asString(record.url) ??
            asString(record.link);
        if (href) {
            const absoluteHref = toAbsoluteXhsHref(href);
            try {
                const url = absoluteHref ? new URL(absoluteHref) : null;
                if (url?.hostname === XHS_READ_DOMAIN &&
                    (url.pathname.startsWith("/explore/") || url.pathname.startsWith("/discovery/item/"))) {
                    return true;
                }
            }
            catch {
                // continue recursive scan
            }
        }
        if (asRecord(record.note_card) &&
            (asString(record.xsec_token) || asString(asRecord(record.note_card)?.xsec_token))) {
            return true;
        }
        return Object.values(record).some((entry) => hasSearchCardLikeJson(entry, seen));
    }
    return Array.isArray(value) ? value.some((entry) => hasSearchCardLikeJson(entry, seen)) : false;
};
const readJsonScriptSearchState = () => {
    if (typeof document.querySelectorAll !== "function") {
        return null;
    }
    const selectors = ['script[type="application/json"]', "script#__NEXT_DATA__", "script:not([src])"];
    for (const selector of selectors) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
            const text = (element.textContent ?? "").trim();
            if (!text || (!text.includes("xsec") && !text.includes("/explore/"))) {
                continue;
            }
            try {
                const parsed = JSON.parse(text);
                if (!hasSearchCardLikeJson(parsed)) {
                    continue;
                }
                return {
                    extraction_layer: "script_json",
                    extraction_locator: selector,
                    cards: parsed
                };
            }
            catch {
                continue;
            }
        }
    }
    return null;
};
const readSearchDomCards = () => {
    if (typeof document.querySelectorAll !== "function") {
        return [];
    }
    const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"], a[href*="/discovery/item/"]'));
    return anchors
        .map((anchor) => {
        const root = anchor.closest('[class*="note"], [class*="card"], article, section, li') ??
            anchor.parentElement ??
            anchor;
        const userAnchor = root.querySelector('a[href*="/user/profile/"]');
        const titleElement = root.querySelector('[class*="title"], [class*="desc"]') ?? anchor.querySelector("[title]");
        const title = titleElement?.innerText?.trim() ||
            (titleElement?.textContent ?? "").trim() ||
            (anchor.getAttribute("title") ?? "").trim() ||
            (anchor.textContent ?? "").trim() ||
            null;
        return {
            title,
            detail_url: toAbsoluteXhsHref(anchor.getAttribute("href")),
            user_home_url: toAbsoluteXhsHref(userAnchor?.getAttribute("href") ?? null)
        };
    })
        .filter((card) => typeof card.detail_url === "string" && card.detail_url.length > 0)
        .slice(0, 30);
};
const readXhsSearchDomState = () => {
    const scriptState = readJsonScriptSearchState();
    if (scriptState) {
        return scriptState;
    }
    const cards = readSearchDomCards();
    return cards.length > 0
        ? {
            extraction_layer: "dom_selector",
            extraction_locator: 'a[href*="/explore/"], a[href*="/discovery/item/"]',
            cards
        }
        : null;
};
const normalizeSearchQueryText = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.normalize("NFKC").trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
};
const isCurrentSearchPageForQuery = (href, query) => {
    const expectedQuery = normalizeSearchQueryText(query);
    if (!expectedQuery) {
        return false;
    }
    try {
        const url = new URL(href);
        return (url.hostname === XHS_READ_DOMAIN &&
            url.pathname.includes("/search_result") &&
            normalizeSearchQueryText(url.searchParams.get("keyword")) === expectedQuery);
    }
    catch {
        return false;
    }
};
const createSameQuerySearchPerturbation = (query, currentValue) => {
    const normalizedQuery = normalizeSearchQueryText(query);
    const candidates = [
        query.length > 1 ? `${query} ` : null,
        `${query}x`,
        query.slice(0, Math.max(0, query.length - 1))
    ];
    return (candidates.find((candidate) => candidate !== null &&
        candidate !== currentValue &&
        candidate !== query &&
        normalizeSearchQueryText(candidate) !== null &&
        (candidate.endsWith(" ") || normalizeSearchQueryText(candidate) !== normalizedQuery)) ?? `${query}x`);
};
const waitForXhsSearchPassiveActionTurn = async () => {
    await new Promise((resolve) => {
        setTimeout(resolve, 180);
    });
};
const XHS_SEARCH_INPUT_SELECTOR = 'input[type="search"], input[class*="search"], input[placeholder*="搜索"], input[placeholder*="search" i], input:not([type="hidden"])';
const XHS_SEARCH_BUTTON_SELECTOR = 'button[type="submit"], button[class*="search" i], [role="button"][class*="search" i], [aria-label*="搜索"], [aria-label*="search" i], [title*="搜索"], [title*="search" i], [class*="search-icon" i], [class*="searchIcon" i], [class*="search-btn" i]';
const isElementUsableForXhsSearch = (element) => {
    if (!element) {
        return false;
    }
    const record = element;
    if (record.hidden === true || record.disabled === true) {
        return false;
    }
    if (typeof record.getAttribute === "function") {
        const ariaHidden = record.getAttribute("aria-hidden");
        if (ariaHidden === "true") {
            return false;
        }
    }
    if (typeof record.type === "string" && record.type.toLowerCase() === "hidden") {
        return false;
    }
    if (typeof record.getClientRects === "function") {
        const rects = record.getClientRects();
        if (rects.length === 0) {
            return false;
        }
    }
    return true;
};
const queryFirstUsableXhsElement = (selector) => {
    const queryAll = typeof document.querySelectorAll === "function"
        ? Array.from(document.querySelectorAll(selector))
        : [];
    const candidates = queryAll.length > 0
        ? queryAll
        : typeof document.querySelector === "function"
            ? [document.querySelector(selector)]
            : [];
    return candidates.find((candidate) => isElementUsableForXhsSearch(candidate)) ?? null;
};
const readXhsElementSearchText = (element) => {
    const htmlElement = element;
    return [
        htmlElement.id,
        typeof htmlElement.className === "string" ? htmlElement.className : "",
        htmlElement.getAttribute?.("aria-label"),
        htmlElement.getAttribute?.("title"),
        htmlElement.getAttribute?.("data-testid"),
        htmlElement.textContent
    ]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join(" ")
        .toLowerCase();
};
const looksLikeXhsSearchSubmitControl = (element) => {
    const tagName = typeof element.tagName === "string" ? element.tagName.toLowerCase() : "";
    if (tagName === "input" || tagName === "textarea") {
        return false;
    }
    const elementText = readXhsElementSearchText(element);
    return (tagName === "button" ||
        (tagName.length === 0 && typeof element.click === "function") ||
        element.getAttribute?.("role") === "button" ||
        elementText.includes("search") ||
        elementText.includes("搜索"));
};
const resolveClickableXhsSearchControl = (element) => {
    if (!element) {
        return null;
    }
    const candidates = [
        element,
        element.closest?.("button"),
        element.closest?.('[role="button"]'),
        element.closest?.('[class*="search" i]'),
        element.closest?.("[aria-label]"),
        element.closest?.("[title]")
    ];
    for (const candidate of candidates) {
        const clickableCandidate = candidate;
        if (clickableCandidate &&
            isElementUsableForXhsSearch(clickableCandidate) &&
            looksLikeXhsSearchSubmitControl(clickableCandidate) &&
            typeof clickableCandidate.click === "function") {
            return clickableCandidate;
        }
    }
    return null;
};
const performXhsSearchPassiveAction = async (input) => {
    const queryMatched = isCurrentSearchPageForQuery(window.location.href, input.query);
    const resolveSearchControls = () => {
        const resolvedSearchInput = queryFirstUsableXhsElement(XHS_SEARCH_INPUT_SELECTOR);
        const resolvedSearchForm = resolvedSearchInput?.closest("form");
        const scopedSearchRoot = resolvedSearchInput?.closest('[class*="search" i], [role="search"], header, nav') ??
            resolvedSearchForm ??
            resolvedSearchInput?.parentElement ??
            null;
        const formSearchButton = resolvedSearchForm?.querySelector(XHS_SEARCH_BUTTON_SELECTOR) ?? null;
        const scopedSearchButton = scopedSearchRoot?.querySelector(XHS_SEARCH_BUTTON_SELECTOR) ?? null;
        const resolvedSearchButton = resolveClickableXhsSearchControl(formSearchButton) ??
            resolveClickableXhsSearchControl(scopedSearchButton) ??
            resolveClickableXhsSearchControl(queryFirstUsableXhsElement(XHS_SEARCH_BUTTON_SELECTOR));
        return {
            searchInput: resolvedSearchInput,
            searchForm: resolvedSearchForm,
            searchButton: resolvedSearchButton
        };
    };
    const initialSearchControls = resolveSearchControls();
    if (initialSearchControls.searchInput) {
        let searchInput = initialSearchControls.searchInput;
        let searchForm = initialSearchControls.searchForm;
        let searchButton = initialSearchControls.searchButton;
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        const setSearchInputValue = (target, value) => {
            if (valueSetter) {
                valueSetter.call(target, value);
            }
            else {
                target.value = value;
            }
        };
        const dispatchTextChange = (target, value) => {
            target.dispatchEvent(new InputEvent("beforeinput", {
                bubbles: true,
                cancelable: true,
                data: value,
                inputType: "insertReplacementText"
            }));
            target.dispatchEvent(new InputEvent("input", {
                bubbles: true,
                data: value,
                inputType: "insertReplacementText"
            }));
            target.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const replaceSearchInputText = (target, value) => {
            target.focus();
            const execCommand = document.execCommand?.bind(document);
            if (typeof execCommand === "function") {
                try {
                    target.select?.();
                    target.setSelectionRange?.(0, target.value.length);
                    if (execCommand("insertText", false, value) === true) {
                        dispatchTextChange(target, value);
                        return;
                    }
                }
                catch {
                    // Fall back to the native value setter path below.
                }
            }
            setSearchInputValue(target, value);
            dispatchTextChange(target, value);
        };
        const triggerSubmit = (target, form, button, options) => {
            const preventNativeNavigation = (event) => {
                event.preventDefault();
            };
            const isNativeSubmitControlBoundToForm = (candidate, targetForm) => {
                const tagName = typeof candidate.tagName === "string" ? candidate.tagName.toLowerCase() : "";
                if (tagName !== "button" && tagName !== "input") {
                    return false;
                }
                const type = candidate.getAttribute?.("type")?.trim().toLowerCase();
                if (type && type !== "submit") {
                    return false;
                }
                const candidateForm = candidate.form ??
                    candidate.closest?.("form") ??
                    null;
                return candidateForm === targetForm;
            };
            const preventKeyboardDefault = (event) => {
                if (event.key === "Enter" || event.code === "Enter") {
                    event.preventDefault();
                }
            };
            const createEnterKeyboardEvent = (type) => {
                const event = new KeyboardEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    key: "Enter",
                    code: "Enter",
                    location: 0,
                    repeat: false,
                    isComposing: false
                });
                const legacyFields = {
                    keyCode: 13,
                    which: 13,
                    charCode: type === "keypress" ? 13 : 0
                };
                for (const [field, value] of Object.entries(legacyFields)) {
                    try {
                        Object.defineProperty(event, field, {
                            configurable: true,
                            enumerable: true,
                            get: () => value
                        });
                    }
                    catch {
                        // Some browser implementations expose non-configurable legacy fields.
                    }
                }
                return event;
            };
            const dispatchEnterFallback = () => {
                target.dispatchEvent(createEnterKeyboardEvent("keydown"));
                target.dispatchEvent(createEnterKeyboardEvent("keypress"));
                target.dispatchEvent(createEnterKeyboardEvent("keyup"));
            };
            let submitObserved = false;
            const observeSubmit = (event) => {
                submitObserved = true;
                if (options?.preventNativeNavigation === true) {
                    preventNativeNavigation(event);
                }
            };
            if (form &&
                (options?.preventNativeNavigation === true || options?.preferButtonClick === true)) {
                form.addEventListener("submit", observeSubmit, { capture: true, once: true });
            }
            if (options?.preventKeyboardDefault === true &&
                typeof target.addEventListener === "function") {
                target.addEventListener("keydown", preventKeyboardDefault, { capture: true, once: true });
                target.addEventListener("keypress", preventKeyboardDefault, { capture: true, once: true });
            }
            if (options?.dispatchKeyboardEvents !== false) {
                dispatchEnterFallback();
            }
            try {
                if (options?.preferButtonClick === true && button && typeof button.click === "function") {
                    button.click();
                    if (form &&
                        !submitObserved &&
                        !isNativeSubmitControlBoundToForm(button, form) &&
                        typeof form.requestSubmit === "function") {
                        form.requestSubmit();
                        return "button_click_form_request_submit_fallback";
                    }
                    return "button_click";
                }
                if (form && typeof form.requestSubmit === "function") {
                    form.requestSubmit();
                    return "form_request_submit";
                }
                if (button && typeof button.click === "function") {
                    button.click();
                    return "button_click";
                }
                if (form) {
                    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                    return "submit_event";
                }
                return "enter_key";
            }
            finally {
                if (options?.preventKeyboardDefault === true &&
                    typeof target.removeEventListener === "function") {
                    target.removeEventListener("keydown", preventKeyboardDefault, { capture: true });
                    target.removeEventListener("keypress", preventKeyboardDefault, { capture: true });
                }
                if (form &&
                    (options?.preventNativeNavigation === true || options?.preferButtonClick === true)) {
                    form.removeEventListener("submit", observeSubmit, { capture: true });
                }
            }
        };
        const currentInputValue = searchInput.value;
        const sameQueryInputMatched = queryMatched &&
            normalizeSearchQueryText(currentInputValue) === normalizeSearchQueryText(input.query);
        let sameQueryPerturbed = false;
        let sameQueryPreflightSubmitted = false;
        let sameQueryPreflightSubmitTriggered = null;
        let sameQueryPreflightMode = null;
        let sameQueryPreflightStateChangeObserved = null;
        let sameQueryPreflightStateChangeSource = null;
        let sameQueryPreflightStateChangeAttempts = 0;
        let sameQuerySearchInputRefreshed = null;
        let sameQuerySearchInputRefreshAttempts = 0;
        let sameQuerySearchInputRefreshSource = null;
        let preSubmitValueChanged = false;
        let inputSettleWaits = 0;
        const refreshSearchControls = () => {
            const refreshed = resolveSearchControls();
            searchInput = refreshed.searchInput;
            searchForm = refreshed.searchForm;
            searchButton = refreshed.searchButton;
            return Boolean(searchInput);
        };
        const restoreConnectedSearchControls = (fallbackInput) => {
            if (fallbackInput.isConnected !== true || !isElementUsableForXhsSearch(fallbackInput)) {
                return false;
            }
            const fallbackForm = fallbackInput.closest("form");
            searchInput = fallbackInput;
            searchForm = fallbackForm;
            const fallbackFormButton = fallbackForm?.querySelector(XHS_SEARCH_BUTTON_SELECTOR) ?? null;
            searchButton = (isElementUsableForXhsSearch(fallbackFormButton)
                ? fallbackFormButton
                : queryFirstUsableXhsElement(XHS_SEARCH_BUTTON_SELECTOR));
            return true;
        };
        const waitForSearchControlsAfterPreflight = async (fallbackInput) => {
            const maxRefreshAttempts = 16;
            for (let attempt = 0; attempt <= maxRefreshAttempts; attempt += 1) {
                sameQuerySearchInputRefreshAttempts = attempt + 1;
                if (refreshSearchControls()) {
                    sameQuerySearchInputRefreshSource = "selector";
                    return true;
                }
                if (restoreConnectedSearchControls(fallbackInput)) {
                    sameQuerySearchInputRefreshSource = "connected_fallback";
                    return true;
                }
                if (attempt < maxRefreshAttempts) {
                    await waitForXhsSearchPassiveActionTurn();
                    inputSettleWaits += 1;
                }
            }
            sameQuerySearchInputRefreshSource = "missing";
            return false;
        };
        const waitForPreflightStateChange = async (initialInput, perturbedValue, submittedAt) => {
            const initialHref = window.location.href;
            const preflightShape = createSearchRequestShape({ keyword: perturbedValue });
            const preflightShapeKey = preflightShape
                ? serializeSearchRequestShape(preflightShape)
                : null;
            const maxStateAttempts = 8;
            for (let attempt = 0; attempt <= maxStateAttempts; attempt += 1) {
                sameQueryPreflightStateChangeAttempts = attempt + 1;
                if (window.location.href !== initialHref ||
                    isCurrentSearchPageForQuery(window.location.href, perturbedValue)) {
                    sameQueryPreflightStateChangeSource = "url";
                    return true;
                }
                const refreshed = resolveSearchControls();
                if (refreshed.searchInput && refreshed.searchInput !== initialInput) {
                    sameQueryPreflightStateChangeSource = "search_controls_replaced";
                    return true;
                }
                if (initialInput.isConnected === false) {
                    sameQueryPreflightStateChangeSource = "search_input_detached";
                    return true;
                }
                if (preflightShapeKey) {
                    const pageContextNamespace = createPageContextNamespace(window.location.href);
                    const lookup = await readCapturedRequestContextViaMainWorld({
                        method: "POST",
                        path: SEARCH_ENDPOINT,
                        page_context_namespace: pageContextNamespace,
                        shape_key: preflightShapeKey,
                        min_observed_at: submittedAt
                    }).catch(() => null);
                    if (lookup?.admitted_template ||
                        lookup?.rejected_observation ||
                        lookup?.incompatible_observation ||
                        lookup?.available_shape_keys.includes(preflightShapeKey)) {
                        sameQueryPreflightStateChangeSource = "passive_request_context";
                        return true;
                    }
                }
                if (attempt < maxStateAttempts) {
                    await waitForXhsSearchPassiveActionTurn();
                    inputSettleWaits += 1;
                }
            }
            sameQueryPreflightStateChangeSource = "missing";
            return false;
        };
        searchInput.focus();
        if (sameQueryInputMatched && input.debuggerActionAllowed === true) {
            sameQueryPreflightMode = "debugger_input_submit";
            sameQuerySearchInputRefreshed = true;
            sameQuerySearchInputRefreshSource = "same_query_existing_input";
            await waitForXhsSearchPassiveActionTurn();
            inputSettleWaits += 1;
            const debuggerAction = input.debuggerActionAllowed === true
                ? await requestXhsSearchDebuggerActionViaExtension({
                    query: input.query,
                    runId: input.runId,
                    actionRef: input.actionRef,
                    timeoutMs: input.timeoutMs,
                    actionMode: "input_submit"
                })
                : {
                    ok: false,
                    error: {
                        code: "ERR_XHS_SEARCH_DEBUGGER_NOT_REQUESTED",
                        message: "debugger action is only enabled for closeout evidence capture"
                    }
                };
            return {
                evidence_class: "humanized_action",
                action_kind: "keyboard_input",
                action_ref: input.actionRef,
                run_id: input.runId,
                page_url: input.pageUrl,
                query: input.query,
                query_matched: queryMatched,
                search_input_found: true,
                same_query_input_matched: sameQueryInputMatched,
                same_query_perturbed: sameQueryPerturbed,
                same_query_preflight_submitted: sameQueryPreflightSubmitted,
                same_query_preflight_submit_triggered: sameQueryPreflightSubmitTriggered,
                same_query_preflight_mode: sameQueryPreflightMode,
                same_query_preflight_state_change_observed: sameQueryPreflightStateChangeObserved,
                same_query_preflight_state_change_source: sameQueryPreflightStateChangeSource,
                same_query_preflight_state_change_attempts: sameQueryPreflightStateChangeAttempts,
                same_query_search_input_refreshed: sameQuerySearchInputRefreshed,
                same_query_search_input_refresh_attempts: sameQuerySearchInputRefreshAttempts,
                same_query_search_input_refresh_source: sameQuerySearchInputRefreshSource,
                pre_submit_value_changed: preSubmitValueChanged,
                input_settle_waits: inputSettleWaits,
                search_form_found: Boolean(searchForm),
                search_button_found: Boolean(searchButton),
                submit_triggered: null,
                debugger_action: debuggerAction.ok && debuggerAction.result
                    ? debuggerAction.result
                    : {
                        attempted: input.debuggerActionAllowed === true,
                        ok: false,
                        error: debuggerAction.error ?? null
                    },
                trigger_surface: "xhs.search_result"
            };
        }
        if (sameQueryInputMatched) {
            const preflightSearchInput = searchInput;
            const perturbedValue = createSameQuerySearchPerturbation(input.query, currentInputValue);
            replaceSearchInputText(searchInput, perturbedValue);
            sameQueryPerturbed = true;
            preSubmitValueChanged = searchInput.value !== currentInputValue;
            await waitForXhsSearchPassiveActionTurn();
            inputSettleWaits += 1;
            let preflightSubmittedAt = null;
            if (searchForm) {
                sameQueryPreflightMode = "guarded_submit";
                preflightSubmittedAt = Date.now();
                sameQueryPreflightSubmitTriggered = triggerSubmit(searchInput, searchForm, searchButton, {
                    preventNativeNavigation: true,
                    preventKeyboardDefault: true,
                    preferButtonClick: Boolean(searchButton)
                });
                sameQueryPreflightSubmitted = true;
                await waitForXhsSearchPassiveActionTurn();
                inputSettleWaits += 1;
            }
            else if (searchButton) {
                sameQueryPreflightMode = "button_click";
                preflightSubmittedAt = Date.now();
                sameQueryPreflightSubmitTriggered = triggerSubmit(searchInput, null, searchButton, {
                    preventKeyboardDefault: true
                });
                sameQueryPreflightSubmitted = true;
                await waitForXhsSearchPassiveActionTurn();
                inputSettleWaits += 1;
            }
            else {
                sameQueryPreflightMode = "state_only_no_submit_surface";
            }
            sameQueryPreflightStateChangeObserved =
                preflightSubmittedAt === null
                    ? false
                    : await waitForPreflightStateChange(preflightSearchInput, perturbedValue, preflightSubmittedAt);
            sameQuerySearchInputRefreshed = await waitForSearchControlsAfterPreflight(preflightSearchInput);
            if (!searchInput) {
                const pageUrlAfterPreflight = window.location.href;
                const domFallbackAllowed = true;
                return {
                    evidence_class: "humanized_action",
                    action_kind: "keyboard_input",
                    action_ref: input.actionRef,
                    run_id: input.runId,
                    page_url: input.pageUrl,
                    query: input.query,
                    query_matched: queryMatched,
                    search_input_found: false,
                    initial_search_input_found: true,
                    same_query_input_matched: sameQueryInputMatched,
                    same_query_perturbed: sameQueryPerturbed,
                    same_query_preflight_submitted: sameQueryPreflightSubmitted,
                    same_query_preflight_submit_triggered: sameQueryPreflightSubmitTriggered,
                    same_query_preflight_mode: sameQueryPreflightMode,
                    same_query_preflight_state_change_observed: sameQueryPreflightStateChangeObserved,
                    same_query_preflight_state_change_source: sameQueryPreflightStateChangeSource,
                    same_query_preflight_state_change_attempts: sameQueryPreflightStateChangeAttempts,
                    same_query_search_input_refreshed: sameQuerySearchInputRefreshed,
                    same_query_search_input_refresh_attempts: sameQuerySearchInputRefreshAttempts,
                    same_query_search_input_refresh_source: sameQuerySearchInputRefreshSource,
                    page_url_after_preflight: pageUrlAfterPreflight,
                    dom_fallback_allowed: domFallbackAllowed,
                    original_query_restored: false,
                    pre_submit_value_changed: preSubmitValueChanged,
                    input_settle_waits: inputSettleWaits,
                    search_form_found: false,
                    search_button_found: false,
                    submit_triggered: null,
                    final_submit_skipped: true,
                    final_submit_blocked: true,
                    final_submit_blocker: "search_input_refresh_missing",
                    skipped_reason: "search_input_refresh_missing",
                    trigger_surface: "xhs.search_result"
                };
            }
            searchInput.focus();
        }
        replaceSearchInputText(searchInput, input.query);
        if (sameQueryInputMatched) {
            await waitForXhsSearchPassiveActionTurn();
            inputSettleWaits += 1;
        }
        const debuggerAction = input.debuggerActionAllowed === true
            ? await requestXhsSearchDebuggerActionViaExtension({
                query: input.query,
                runId: input.runId,
                actionRef: input.actionRef,
                timeoutMs: input.timeoutMs,
                actionMode: "input_submit"
            })
            : {
                ok: false,
                error: {
                    code: "ERR_XHS_SEARCH_DEBUGGER_NOT_REQUESTED",
                    message: "debugger action is only enabled for closeout evidence capture"
                }
            };
        if (debuggerAction.ok && debuggerAction.result) {
            return {
                evidence_class: "humanized_action",
                action_kind: "keyboard_input",
                action_ref: input.actionRef,
                run_id: input.runId,
                page_url: input.pageUrl,
                query: input.query,
                query_matched: queryMatched,
                search_input_found: true,
                same_query_input_matched: sameQueryInputMatched,
                same_query_perturbed: sameQueryPerturbed,
                same_query_preflight_submitted: sameQueryPreflightSubmitted,
                same_query_preflight_submit_triggered: sameQueryPreflightSubmitTriggered,
                same_query_preflight_mode: sameQueryPreflightMode,
                same_query_preflight_state_change_observed: sameQueryPreflightStateChangeObserved,
                same_query_preflight_state_change_source: sameQueryPreflightStateChangeSource,
                same_query_preflight_state_change_attempts: sameQueryPreflightStateChangeAttempts,
                same_query_search_input_refreshed: sameQuerySearchInputRefreshed,
                same_query_search_input_refresh_attempts: sameQuerySearchInputRefreshAttempts,
                same_query_search_input_refresh_source: sameQuerySearchInputRefreshSource,
                pre_submit_value_changed: preSubmitValueChanged,
                input_settle_waits: inputSettleWaits,
                search_form_found: Boolean(searchForm),
                search_button_found: Boolean(searchButton),
                submit_triggered: debuggerAction.result.submit_triggered ?? "chrome_debugger",
                trigger_surface: "xhs.search_result",
                debugger_action: debuggerAction.result
            };
        }
        const submitTriggered = triggerSubmit(searchInput, searchForm, searchButton, {
            preventNativeNavigation: Boolean(searchForm),
            preventKeyboardDefault: Boolean(searchForm),
            preferButtonClick: Boolean(searchButton)
        });
        return {
            evidence_class: "humanized_action",
            action_kind: "keyboard_input",
            action_ref: input.actionRef,
            run_id: input.runId,
            page_url: input.pageUrl,
            query: input.query,
            query_matched: queryMatched,
            search_input_found: true,
            same_query_input_matched: sameQueryInputMatched,
            same_query_perturbed: sameQueryPerturbed,
            same_query_preflight_submitted: sameQueryPreflightSubmitted,
            same_query_preflight_submit_triggered: sameQueryPreflightSubmitTriggered,
            same_query_preflight_mode: sameQueryPreflightMode,
            same_query_preflight_state_change_observed: sameQueryPreflightStateChangeObserved,
            same_query_preflight_state_change_source: sameQueryPreflightStateChangeSource,
            same_query_preflight_state_change_attempts: sameQueryPreflightStateChangeAttempts,
            same_query_search_input_refreshed: sameQuerySearchInputRefreshed,
            same_query_search_input_refresh_attempts: sameQuerySearchInputRefreshAttempts,
            same_query_search_input_refresh_source: sameQuerySearchInputRefreshSource,
            pre_submit_value_changed: preSubmitValueChanged,
            input_settle_waits: inputSettleWaits,
            search_form_found: Boolean(searchForm),
            search_button_found: Boolean(searchButton),
            submit_triggered: submitTriggered,
            debugger_action: {
                attempted: true,
                ok: false,
                error: debuggerAction.error ?? null
            },
            trigger_surface: "xhs.search_result"
        };
    }
    if (queryMatched) {
        const debuggerAction = input.debuggerActionAllowed === true
            ? await requestXhsSearchDebuggerActionViaExtension({
                query: input.query,
                runId: input.runId,
                actionRef: input.actionRef,
                timeoutMs: input.timeoutMs,
                actionMode: "page_reload"
            })
            : {
                ok: false,
                error: {
                    code: "ERR_XHS_SEARCH_DEBUGGER_NOT_REQUESTED",
                    message: "debugger action is only enabled for closeout evidence capture"
                }
            };
        if (debuggerAction.ok && debuggerAction.result) {
            return {
                evidence_class: "humanized_action",
                action_kind: "keyboard_input",
                action_ref: input.actionRef,
                run_id: input.runId,
                page_url: input.pageUrl,
                query: input.query,
                query_matched: queryMatched,
                search_input_found: false,
                submit_triggered: debuggerAction.result.submit_triggered ?? "chrome_debugger",
                trigger_surface: "xhs.search_result",
                debugger_action: debuggerAction.result
            };
        }
        const target = document.scrollingElement ?? document.documentElement;
        const beforeScrollY = window.scrollY;
        const deltaY = 240;
        target.dispatchEvent(new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY
        }));
        window.scrollBy({
            top: deltaY,
            left: 0,
            behavior: "auto"
        });
        target.dispatchEvent(new Event("scroll", { bubbles: true }));
        return {
            evidence_class: "humanized_action",
            action_kind: "scroll",
            action_ref: input.actionRef,
            run_id: input.runId,
            page_url: input.pageUrl,
            query: input.query,
            query_matched: true,
            before_scroll_y: beforeScrollY,
            after_scroll_y: window.scrollY,
            debugger_action: {
                attempted: true,
                ok: false,
                error: debuggerAction.error ?? null
            },
            trigger_surface: "xhs.search_result"
        };
    }
    return {
        evidence_class: "humanized_action",
        action_kind: "keyboard_input",
        action_ref: input.actionRef,
        run_id: input.runId,
        page_url: input.pageUrl,
        query: input.query,
        query_matched: false,
        search_input_found: false,
        skipped_reason: "search_input_missing"
    };
};
const createBrowserEnvironment = () => ({
    now: () => Date.now(),
    randomId: () => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `id-${Date.now()}`,
    getLocationHref: () => window.location.href,
    getDocumentTitle: () => document.title,
    getReadyState: () => document.readyState,
    getCookie: () => document.cookie,
    getBodyText: () => (document.body?.innerText ?? "").slice(0, 5000),
    getAccountSafetyOverlay: () => readAccountSafetyOverlay(),
    getPageStateRoot: () => window.__INITIAL_STATE__,
    readPageStateRoot: async () => await readPageStateViaMainWorld(),
    readSearchDomState: async () => readXhsSearchDomState(),
    performSearchPassiveAction: async (input) => await performXhsSearchPassiveAction(input),
    readCapturedRequestContext: async (input) => await readCapturedRequestContextViaMainWorld(input),
    configureCapturedRequestContextProvenance: async (input) => await configureCapturedRequestContextProvenanceViaMainWorld(input),
    sleep: async (ms) => {
        await new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    },
    callSignature: async (uri, payload) => await requestXhsSignatureViaExtension(uri, payload),
    fetchJson: async (input) => {
        if (input.pageContextRequest === true) {
            return await requestXhsSearchJsonViaMainWorld({
                url: input.url,
                method: input.method,
                headers: input.headers,
                ...(typeof input.body === "string" ? { body: input.body } : {}),
                timeoutMs: input.timeoutMs,
                ...(typeof input.referrer === "string" ? { referrer: input.referrer } : {}),
                ...(typeof input.referrerPolicy === "string"
                    ? { referrerPolicy: input.referrerPolicy }
                    : {})
            });
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            controller.abort();
        }, input.timeoutMs);
        try {
            const response = await fetch(input.url, {
                method: input.method,
                headers: input.headers,
                body: input.body,
                credentials: "include",
                ...(typeof input.referrer === "string" ? { referrer: input.referrer } : {}),
                ...(typeof input.referrerPolicy === "string"
                    ? { referrerPolicy: input.referrerPolicy }
                    : {}),
                signal: controller.signal
            });
            return {
                status: response.status,
                body: await extractFetchBody(response)
            };
        }
        finally {
            clearTimeout(timer);
        }
    },
    performEditorInputValidation: async (input) => await performEditorInputValidation(input),
    performMediaUploadDiscovery: async (input) => buildXhsMediaUploadDiscoveryResult(input),
    performControlledLiveWrite: async (input) => await performXhsControlledLiveWriteWithApprovedSourceMedia(input)
});
const resolveTargetDomainFromHref = (href) => {
    try {
        return new URL(href).hostname || null;
    }
    catch {
        return null;
    }
};
const resolveTargetPageFromHref = (href, command) => {
    try {
        const url = new URL(href);
        const isSearchResultDetailPath = /^\/search_result\/[^/?#]+/u.test(url.pathname);
        if (command === "xhs.detail" &&
            url.hostname === "www.xiaohongshu.com" &&
            (url.pathname.startsWith("/explore/") || isSearchResultDetailPath)) {
            return "explore_detail_tab";
        }
        if (url.hostname === "www.xiaohongshu.com" && url.pathname.startsWith("/search_result")) {
            return "search_result_tab";
        }
        if (command === "xhs.user_home" &&
            url.hostname === "www.xiaohongshu.com" &&
            url.pathname.startsWith("/user/profile/")) {
            return "profile_tab";
        }
        if (url.hostname === "creator.xiaohongshu.com" && url.pathname.startsWith("/publish")) {
            return "creator_publish_tab";
        }
        return null;
    }
    catch {
        return null;
    }
};
const resolveContentCommandDeadlineMs = (messageTimeoutMs, options) => {
    if (typeof messageTimeoutMs !== "number" ||
        !Number.isFinite(messageTimeoutMs) ||
        messageTimeoutMs <= 10_000) {
        return null;
    }
    const normalizedMessageTimeout = Math.floor(messageTimeoutMs);
    const optionTimeout = typeof options.timeout_ms === "number" &&
        Number.isFinite(options.timeout_ms) &&
        options.timeout_ms > 0
        ? Math.floor(options.timeout_ms)
        : normalizedMessageTimeout;
    const closeoutCaptureRequested = options.closeout_evidence_evaluation === true || options.closeout_audit_required === true;
    const controlledLiveWriteRequested = options.controlled_live_write === true &&
        options.requested_execution_mode === "live_write";
    const nativeSafetyWindowMs = Math.max(1, normalizedMessageTimeout - 5_000);
    const maxCommandDeadlineMs = controlledLiveWriteRequested
        ? Math.max(55_000, Math.min(230_000, nativeSafetyWindowMs))
        : closeoutCaptureRequested
            ? Math.max(20_000, Math.min(55_000, nativeSafetyWindowMs))
            : 20_000;
    return Math.max(1, Math.min(normalizedMessageTimeout, optionTimeout, maxCommandDeadlineMs));
};
const resolveContentCommandDeadlineMsForContract = resolveContentCommandDeadlineMs;
const maybeWithContentCommandDeadline = async (promise, input) => input.timeoutMs === null
    ? await promise
    : await withContentCommandDeadline(promise, {
        timeoutMs: input.timeoutMs,
        abilityId: input.abilityId,
        command: input.command
    });
const withContentCommandDeadline = async (promise, input) => await new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
        if (settled) {
            return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(result);
    };
    const timer = setTimeout(() => {
        finish({
            ok: false,
            error: {
                code: "ERR_EXECUTION_FAILED",
                message: `${input.command} content script execution timed out before native deadline`
            },
            payload: {
                details: {
                    ability_id: input.abilityId,
                    stage: "execution",
                    reason: "CONTENT_SCRIPT_EXECUTION_TIMEOUT",
                    timeout_ms: input.timeoutMs
                },
                diagnosis: {
                    category: "runtime_unavailable",
                    stage: "runtime",
                    component: "content-script",
                    failure_site: {
                        stage: "runtime",
                        component: "content-script",
                        target: input.command,
                        summary: `${input.command} content script execution timed out before native deadline`
                    },
                    evidence: [`content_command_timeout_ms=${input.timeoutMs}`]
                }
            }
        });
    }, input.timeoutMs);
    promise.then(finish).catch((error) => {
        finish({
            ok: false,
            error: {
                code: "ERR_EXECUTION_FAILED",
                message: error instanceof Error ? error.message : String(error)
            },
            payload: {
                details: {
                    ability_id: input.abilityId,
                    stage: "execution",
                    reason: "CONTENT_SCRIPT_EXECUTION_FAILED"
                }
            }
        });
    });
});
class ContentScriptHandler {
    #listeners = new Set();
    #completedResultIds = new Set();
    #reachable = true;
    #xhsEnv;
    constructor(options) {
        this.#xhsEnv = options?.xhsEnv ?? createBrowserEnvironment();
    }
    onResult(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
    setReachable(reachable) {
        this.#reachable = reachable;
    }
    onBackgroundMessage(message) {
        if (!this.#reachable) {
            return false;
        }
        this.#completedResultIds.delete(message.id);
        if (message.commandParams.simulate_no_response === true) {
            return true;
        }
        if (message.command === "runtime.ping") {
            void this.#handleRuntimePing(message);
            return true;
        }
        if (message.command === "runtime.bootstrap") {
            void this.#handleRuntimeBootstrap(message);
            return true;
        }
        if (message.command === "l2.first_usable") {
            void this.#handleL2FirstUsableCommand(message);
            return true;
        }
        if (DOWNLOAD_COMMANDS.has(message.command)) {
            void this.#handleDownloadTriggerCommand(message);
            return true;
        }
        if (XHS_PAGE_COMMANDS.has(message.command)) {
            this.#handleXhsReadCommandWithDeadline(message);
            return true;
        }
        const result = this.#handleForward(message);
        for (const listener of this.#listeners) {
            listener(result);
        }
        return true;
    }
    async #handleDownloadTriggerCommand(message) {
        const request = parseDownloadTriggerRequestForExtension(message.commandParams.download_ability_request) ??
            parseDownloadTriggerRequestForExtension(message.commandParams.input);
        const triggerMode = message.commandParams.trigger_mode === "dispatch_click" ? "dispatch_click" : "resolve_only";
        if (!request) {
            this.#emit({
                kind: "result",
                id: message.id,
                ok: true,
                payload: {
                    download_browser_result: {
                        success: false,
                        failure_reason: "SOURCE_UNAVAILABLE",
                        trigger_audit: {
                            run_id: message.runId,
                            command: message.command,
                            reason: "DOWNLOAD_ABILITY_REQUEST_INVALID"
                        }
                    }
                }
            });
            return;
        }
        this.#emit({
            kind: "result",
            id: message.id,
            ok: true,
            payload: {
                download_browser_result: executeDownloadTriggerInPage({
                    request,
                    runId: message.runId,
                    triggerMode: triggerMode
                })
            }
        });
    }
    async #handleL2FirstUsableCommand(message) {
        const request = asRecord(message.commandParams.l2_first_usable_request) ??
            asRecord(message.commandParams);
        const riskGateContext = asRecord(request?.risk_gate_context);
        const targetUrl = asString(request?.target_url);
        const goalKind = asString(request?.goal_kind);
        const safetyClass = asString(request?.interaction_safety_class);
        const allowedActions = Array.isArray(request?.allowed_actions)
            ? request.allowed_actions.filter((item) => typeof item === "string")
            : [];
        const runId = asString(riskGateContext?.run_id) ?? message.runId;
        const profile = asString(riskGateContext?.profile) ?? message.profile ?? "profile/default";
        const targetDomain = asString(riskGateContext?.target_domain);
        const riskState = asString(riskGateContext?.risk_state);
        const emitResult = (result) => {
            this.#emit({
                kind: "result",
                id: message.id,
                ok: true,
                payload: {
                    l2_first_usable_result: result
                }
            });
        };
        if (riskState === "paused") {
            emitResult({
                success: false,
                failure_class: "risk_gate_blocked"
            });
            return;
        }
        const invalidRequest = !request ||
            !targetUrl ||
            goalKind !== "read" ||
            safetyClass !== "pure_read" ||
            !allowedActions.includes("extract") ||
            allowedActions.some((action) => !L2_ALLOWED_ACTIONS.has(action));
        if (invalidRequest) {
            emitResult({
                success: false,
                failure_class: "requires_l1_fallback",
                l1_fallback_payload: {
                    fallback_goal: "read",
                    fallback_reason: "target_not_located",
                    recommended_strategy: "visual_reacquire"
                }
            });
            return;
        }
        const simulateResult = asString(message.commandParams.simulate_result);
        if (simulateResult === "insufficient_semantic_structure" ||
            simulateResult === "target_not_located" ||
            simulateResult === "state_not_settled") {
            emitResult({
                success: false,
                failure_class: "requires_l1_fallback",
                l1_fallback_payload: {
                    fallback_goal: "read",
                    fallback_reason: simulateResult,
                    recommended_strategy: simulateResult === "target_not_located"
                        ? "visual_reacquire"
                        : simulateResult === "state_not_settled"
                            ? "visual_state_check"
                            : "visual_state_check"
                }
            });
            return;
        }
        let parsedTargetUrl;
        try {
            parsedTargetUrl = new URL(targetUrl);
        }
        catch {
            emitResult({
                success: false,
                failure_class: "requires_l1_fallback",
                l1_fallback_payload: {
                    fallback_goal: "read",
                    fallback_reason: "target_not_located",
                    recommended_strategy: "visual_reacquire"
                }
            });
            return;
        }
        if (!targetDomain || parsedTargetUrl.hostname !== targetDomain) {
            emitResult({
                success: false,
                failure_class: "requires_l1_fallback",
                l1_fallback_payload: {
                    fallback_goal: "read",
                    fallback_reason: "target_not_located",
                    recommended_strategy: "visual_reacquire"
                }
            });
            return;
        }
        const href = typeof location !== "undefined" ? location.href : targetUrl;
        let parsedCurrentUrl;
        try {
            parsedCurrentUrl = new URL(href);
        }
        catch {
            emitResult({
                success: false,
                failure_class: "requires_l1_fallback",
                l1_fallback_payload: {
                    fallback_goal: "read",
                    fallback_reason: "target_not_located",
                    recommended_strategy: "visual_reacquire"
                }
            });
            return;
        }
        if (parsedCurrentUrl.hostname !== targetDomain) {
            emitResult({
                success: false,
                failure_class: "requires_l1_fallback",
                l1_fallback_payload: {
                    fallback_goal: "read",
                    fallback_reason: "target_not_located",
                    recommended_strategy: "visual_reacquire"
                }
            });
            return;
        }
        const title = typeof document !== "undefined" ? document.title : "";
        const bodyText = typeof document !== "undefined" && document.body
            ? (document.body.innerText ?? document.body.textContent ?? "").trim().replace(/\s+/g, " ")
            : "";
        const structure = collectL2PageStructure();
        const structureCount = (Array.isArray(structure.headings) ? structure.headings.length : 0) +
            (Array.isArray(structure.links) ? structure.links.length : 0) +
            (Array.isArray(structure.buttons) ? structure.buttons.length : 0);
        if (bodyText.length === 0 && structureCount === 0) {
            emitResult({
                success: false,
                failure_class: "requires_l1_fallback",
                l1_fallback_payload: {
                    fallback_goal: "read",
                    fallback_reason: "insufficient_semantic_structure",
                    recommended_strategy: "visual_state_check"
                }
            });
            return;
        }
        const capturedAt = new Date().toISOString();
        const abilityId = `generic.${normalizeL2AbilitySegment(parsedTargetUrl.hostname)}.${normalizeL2AbilitySegment(parsedTargetUrl.pathname)}.read.v1`;
        const resultSummary = {
            page_url: href,
            target_url: targetUrl,
            title,
            text_excerpt: bodyText.slice(0, 1200),
            structure
        };
        emitResult({
            success: true,
            result_summary: resultSummary,
            first_usable_trace: [
                {
                    step_id: "step-1",
                    action: "locate",
                    target_hint: parsedTargetUrl.hostname,
                    result: "page_structure_located"
                },
                {
                    step_id: "step-2",
                    action: "extract",
                    target_hint: "document",
                    result: "structured_read_completed"
                }
            ],
            interaction_trace: [
                {
                    action: "locate",
                    target_ref: "document",
                    settled: true,
                    interaction_semantics: "neutral"
                },
                {
                    action: "extract",
                    target_ref: "document",
                    settled: true,
                    interaction_semantics: "neutral"
                }
            ],
            capture_hints: {
                source: "content_script_dom_extract",
                page_url: href,
                target_domain: parsedTargetUrl.hostname,
                allowed_actions: allowedActions,
                reveal_only_click_kinds: [...L2_REVEAL_ONLY_CLICK_KINDS]
            },
            candidate_shell_seed: buildL2CandidateShellSeed({
                abilityId,
                displayName: `Generic read ${parsedTargetUrl.hostname}`,
                targetUrl,
                runId,
                profile,
                capturedAt
            })
        });
    }
    #emitUnexpectedXhsReadFailure(message, error) {
        const fingerprintRuntime = resolveFingerprintContextFromMessage(message);
        if (error instanceof ExtensionContractError && error.code === "ERR_CLI_INVALID_ARGS") {
            this.#emit(toCliInvalidArgsResult({
                id: message.id,
                error,
                fingerprintRuntime: fingerprintRuntime
            }));
            return;
        }
        this.#emit({
            kind: "result",
            id: message.id,
            ok: false,
            error: {
                code: "ERR_EXECUTION_FAILED",
                message: error instanceof Error ? error.message : String(error)
            },
            payload: fingerprintRuntime
                ? {
                    fingerprint_runtime: fingerprintRuntime
                }
                : {}
        });
    }
    #handleXhsReadCommandWithDeadline(message) {
        const options = asRecord(message.commandParams.options) ?? {};
        const timeoutMs = resolveContentCommandDeadlineMs(message.timeoutMs, options);
        let timer = null;
        if (timeoutMs !== null) {
            timer = setTimeout(() => {
                this.#emit({
                    kind: "result",
                    id: message.id,
                    ok: false,
                    error: {
                        code: "ERR_EXECUTION_FAILED",
                        message: `${message.command} content script execution timed out before native deadline`
                    },
                    payload: {
                        details: {
                            ability_id: asString(asRecord(message.commandParams.ability)?.id) ?? "unknown",
                            stage: "execution",
                            reason: "CONTENT_SCRIPT_EXECUTION_TIMEOUT",
                            timeout_ms: timeoutMs
                        },
                        diagnosis: {
                            category: "runtime_unavailable",
                            stage: "runtime",
                            component: "content-script",
                            failure_site: {
                                stage: "runtime",
                                component: "content-script",
                                target: message.command,
                                summary: `${message.command} content script execution timed out before native deadline`
                            },
                            evidence: [`content_command_timeout_ms=${timeoutMs}`]
                        }
                    }
                });
            }, timeoutMs);
        }
        void this.#handleXhsReadCommand(message)
            .catch((error) => {
            this.#emitUnexpectedXhsReadFailure(message, error);
        })
            .finally(() => {
            if (timer !== null) {
                clearTimeout(timer);
            }
        });
    }
    async #installFingerprintIfPresent(message) {
        const fingerprintRuntime = resolveFingerprintContextFromMessage(message);
        if (!fingerprintRuntime) {
            return null;
        }
        if (hasInstalledFingerprintInjection(fingerprintRuntime)) {
            return fingerprintRuntime;
        }
        try {
            const verifiedInjection = await installFingerprintRuntimeWithVerification(fingerprintRuntime);
            return {
                ...fingerprintRuntime,
                injection: verifiedInjection
            };
        }
        catch (error) {
            const requiredPatches = asStringArray(asRecord(fingerprintRuntime.fingerprint_patch_manifest)?.required_patches);
            return {
                ...fingerprintRuntime,
                injection: {
                    installed: false,
                    required_patches: requiredPatches,
                    missing_required_patches: requiredPatches,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
    async #handleRuntimePing(message) {
        const fingerprintRuntime = await this.#installFingerprintIfPresent(message);
        this.#emit({
            kind: "result",
            id: message.id,
            ok: true,
            payload: {
                message: "pong",
                run_id: message.runId,
                profile: message.profile,
                cwd: message.cwd,
                content_script_diagnostics: {
                    source: "content_script_handler",
                    build_marker: CONTENT_SCRIPT_DIAGNOSTIC_BUILD_MARKER,
                    supports_xhs_search_debugger_action_mode: true,
                    current_url: this.#safeXhsEnvValue(() => this.#xhsEnv.getLocationHref(), "unknown"),
                    document_ready_state: this.#safeXhsEnvValue(() => this.#xhsEnv.getReadyState(), "unknown")
                },
                ...(fingerprintRuntime ? { fingerprint_runtime: fingerprintRuntime } : {})
            }
        });
    }
    async #handleRuntimeBootstrap(message) {
        const commandParams = asRecord(message.commandParams) ?? {};
        const version = asString(commandParams.version);
        const runId = asString(commandParams.run_id);
        const runtimeContextId = asString(commandParams.runtime_context_id);
        const profile = asString(commandParams.profile);
        const mainWorldSecret = asString(commandParams.main_world_secret);
        const fingerprintRuntime = resolveFingerprintContextFromMessage(message);
        if (version !== "v1" ||
            !runId ||
            !runtimeContextId ||
            !profile ||
            !mainWorldSecret ||
            !fingerprintRuntime) {
            this.#emit({
                kind: "result",
                id: message.id,
                ok: false,
                error: {
                    code: "ERR_RUNTIME_READY_SIGNAL_CONFLICT",
                    message: "invalid runtime bootstrap envelope"
                }
            });
            return;
        }
        if (fingerprintRuntime.profile !== profile) {
            this.#emit({
                kind: "result",
                id: message.id,
                ok: false,
                error: {
                    code: "ERR_RUNTIME_BOOTSTRAP_IDENTITY_MISMATCH",
                    message: "runtime bootstrap profile 与 fingerprint runtime 不一致"
                }
            });
            return;
        }
        const channelInstalled = installMainWorldEventChannelSecret(mainWorldSecret);
        const runtimeWithInjection = channelInstalled
            ? await this.#installFingerprintIfPresent({
                ...message,
                fingerprintContext: fingerprintRuntime
            })
            : buildFailedFingerprintInjectionContext(fingerprintRuntime, "main world event channel unavailable");
        const injection = asRecord(runtimeWithInjection?.injection);
        const attested = injection?.installed === true;
        const ackPayload = buildRuntimeBootstrapAckPayload({
            version,
            runId,
            runtimeContextId,
            profile,
            attested,
            runtimeWithInjection
        });
        if (!attested) {
            this.#emit({
                kind: "result",
                id: message.id,
                ok: false,
                error: {
                    code: "ERR_RUNTIME_BOOTSTRAP_NOT_DELIVERED",
                    message: typeof injection?.error === "string"
                        ? injection.error
                        : "runtime bootstrap 尚未获得执行面确认"
                },
                payload: ackPayload
            });
            return;
        }
        this.#emit({
            kind: "result",
            id: message.id,
            ok: true,
            payload: ackPayload
        });
    }
    #handleForward(message) {
        if (message.command !== "runtime.ping") {
            return {
                kind: "result",
                id: message.id,
                ok: false,
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: `unsupported command: ${message.command}`
                }
            };
        }
        return {
            kind: "result",
            id: message.id,
            ok: true,
            payload: {
                message: "pong",
                run_id: message.runId,
                profile: message.profile,
                cwd: message.cwd
            }
        };
    }
    #safeXhsEnvValue(resolver, fallback) {
        try {
            return resolver();
        }
        catch {
            return fallback;
        }
    }
    async #handleXhsReadCommand(message) {
        const commandParams = asRecord(message.commandParams) ?? {};
        const mainWorldSecret = asString(commandParams.main_world_secret);
        if (mainWorldSecret) {
            installMainWorldEventChannelSecret(mainWorldSecret);
        }
        const messageFingerprintContext = resolveFingerprintContextFromMessage(message);
        const fingerprintRuntime = await this.#installFingerprintIfPresent(message);
        const requestedExecutionMode = resolveRequestedExecutionMode(message);
        const missingRequiredPatches = fingerprintRuntime !== null ? resolveMissingRequiredFingerprintPatches(fingerprintRuntime) : [];
        if (requestedExecutionMode !== null &&
            LIVE_EXECUTION_MODES.has(requestedExecutionMode) &&
            missingRequiredPatches.length > 0) {
            this.#emit({
                kind: "result",
                id: message.id,
                ok: false,
                error: {
                    code: "ERR_EXECUTION_FAILED",
                    message: "fingerprint required patches missing for live execution"
                },
                payload: {
                    details: {
                        stage: "execution",
                        reason: "FINGERPRINT_REQUIRED_PATCH_MISSING",
                        requested_execution_mode: requestedExecutionMode,
                        missing_required_patches: missingRequiredPatches
                    },
                    ...(fingerprintRuntime ? { fingerprint_runtime: fingerprintRuntime } : {}),
                    fingerprint_forward_diagnostics: {
                        direct_message_context: summarizeFingerprintRuntimeContext(ensureFingerprintRuntimeContext(message.fingerprintContext ?? null)),
                        resolved_message_context: summarizeFingerprintRuntimeContext(messageFingerprintContext),
                        installed_runtime_context: summarizeFingerprintRuntimeContext(fingerprintRuntime)
                    }
                }
            });
            return;
        }
        const ability = asRecord(commandParams.ability);
        const input = asRecord(commandParams.input);
        const options = asRecord(commandParams.options) ?? {};
        const locationHref = this.#xhsEnv.getLocationHref();
        const actualTargetDomain = resolveTargetDomainFromHref(locationHref);
        const actualTargetPage = resolveTargetPageFromHref(locationHref, message.command) ??
            (actualTargetDomain === XHS_READ_DOMAIN &&
                message.command === "xhs.search" &&
                locationHref.includes("/search_result")
                ? "search_result_tab"
                : null);
        const observedTargetSiteLoggedIn = actualTargetDomain === XHS_READ_DOMAIN && containsCookie(this.#xhsEnv.getCookie(), "a1");
        const observedAnonymousIsolationVerified = actualTargetDomain === XHS_READ_DOMAIN && observedTargetSiteLoggedIn === false;
        const sessionId = String(message.params.session_id ?? "nm-session-001");
        const activeApiFetchFallback = resolveActiveApiFetchFallbackGateOptions({
            rawOptions: options,
            fingerprintRuntime,
            profile: message.profile,
            runId: message.runId,
            sessionId
        });
        if (!ability || !input) {
            this.#emit({
                kind: "result",
                id: message.id,
                ok: false,
                error: {
                    code: "ERR_EXECUTION_FAILED",
                    message: `${message.command} payload missing ability or input`
                },
                payload: {
                    details: {
                        stage: "execution",
                        reason: "ABILITY_PAYLOAD_MISSING"
                    },
                    ...(fingerprintRuntime ? { fingerprint_runtime: fingerprintRuntime } : {})
                }
            });
            return;
        }
        try {
            if (message.command === "xhs.editor_text.write" && options.editor_text_write !== true) {
                throw new ExtensionContractError("ERR_CLI_INVALID_ARGS", "能力输入不合法", {
                    ability_id: String(ability.id ?? "unknown"),
                    stage: "input_validation",
                    reason: "EDITOR_TEXT_WRITE_MARKER_REQUIRED"
                });
            }
            const normalizedInput = validateXhsCommandInputForExtension({
                command: message.command,
                abilityId: String(ability.id ?? "unknown"),
                abilityAction: typeof ability.action === "string" ? ability.action : "read",
                payload: input,
                options
            });
            const commonInput = {
                abilityId: String(ability.id ?? "unknown"),
                abilityLayer: String(ability.layer ?? "L3"),
                abilityAction: String(ability.action ?? "read"),
                options: {
                    ...(typeof options.timeout_ms === "number"
                        ? { timeout_ms: options.timeout_ms }
                        : { timeout_ms: message.timeoutMs }),
                    ...(typeof options.simulate_result === "string"
                        ? { simulate_result: options.simulate_result }
                        : {}),
                    ...(typeof options.x_s_common === "string" ? { x_s_common: options.x_s_common } : {}),
                    ...(typeof options.target_domain === "string"
                        ? { target_domain: options.target_domain }
                        : {}),
                    ...(typeof options.target_tab_id === "number"
                        ? { target_tab_id: options.target_tab_id }
                        : {}),
                    ...(typeof options.target_page === "string"
                        ? { target_page: options.target_page }
                        : {}),
                    ...(typeof message.tabId === "number" ? { actual_target_tab_id: message.tabId } : {}),
                    ...(actualTargetDomain ? { actual_target_domain: actualTargetDomain } : {}),
                    ...(actualTargetPage ? { actual_target_page: actualTargetPage } : {}),
                    ...(typeof ability.action === "string" ? { ability_action: ability.action } : {}),
                    ...(typeof options.action_type === "string"
                        ? { action_type: options.action_type }
                        : {}),
                    ...(typeof options.issue_scope === "string"
                        ? { issue_scope: options.issue_scope }
                        : {}),
                    ...(requestedExecutionMode !== null
                        ? { requested_execution_mode: requestedExecutionMode }
                        : {}),
                    ...(typeof options.risk_state === "string" ? { risk_state: options.risk_state } : {}),
                    ...(asRecord(options.upstream_authorization_request)
                        ? {
                            upstream_authorization_request: asRecord(options.upstream_authorization_request) ?? {}
                        }
                        : {}),
                    ...(typeof options.__legacy_requested_execution_mode === "string"
                        ? { __legacy_requested_execution_mode: options.__legacy_requested_execution_mode }
                        : {}),
                    ...(options.limited_read_rollout_ready_true === true
                        ? { limited_read_rollout_ready_true: true }
                        : {}),
                    ...(options.closeout_audit_required === true ? { closeout_audit_required: true } : {}),
                    ...(options.closeout_evidence_evaluation === true
                        ? { closeout_evidence_evaluation: true }
                        : {}),
                    ...(typeof options.__runtime_latest_head_sha === "string"
                        ? { __runtime_latest_head_sha: options.__runtime_latest_head_sha }
                        : {}),
                    ...(typeof options.__runtime_profile_ref === "string"
                        ? { __runtime_profile_ref: options.__runtime_profile_ref }
                        : {}),
                    ...(asRecord(options.explicit_request_context_artifact)
                        ? {
                            explicit_request_context_artifact: asRecord(options.explicit_request_context_artifact) ?? {}
                        }
                        : {}),
                    ...(options.xhs_recovery_probe === true ? { xhs_recovery_probe: true } : {}),
                    ...(typeof options.validation_action === "string"
                        ? { validation_action: options.validation_action }
                        : {}),
                    ...(typeof options.validation_text === "string"
                        ? { validation_text: options.validation_text }
                        : {}),
                    ...(options.editor_text_write === true ? { editor_text_write: true } : {}),
                    ...(typeof options.discovery_action === "string"
                        ? { discovery_action: options.discovery_action }
                        : {}),
                    ...(options.controlled_live_write === true ? { controlled_live_write: true } : {}),
                    ...(options.confirm_live_write === true ? { confirm_live_write: true } : {}),
                    ...(typeof options.publish_visibility_scope === "string"
                        ? { publish_visibility_scope: options.publish_visibility_scope }
                        : {}),
                    ...(typeof options.cleanup_policy_ref === "string"
                        ? { cleanup_policy_ref: options.cleanup_policy_ref }
                        : {}),
                    ...(activeApiFetchFallback
                        ? { active_api_fetch_fallback: activeApiFetchFallback }
                        : {}),
                    ...(asRecord(options.editor_focus_attestation)
                        ? {
                            editor_focus_attestation: asRecord(options.editor_focus_attestation) ?? {}
                        }
                        : {}),
                    ...(asRecord(options.approval_record)
                        ? { approval_record: asRecord(options.approval_record) ?? {} }
                        : {}),
                    ...(asRecord(options.audit_record)
                        ? { audit_record: asRecord(options.audit_record) ?? {} }
                        : {}),
                    ...(asRecord(options.admission_context)
                        ? { admission_context: asRecord(options.admission_context) ?? {} }
                        : {}),
                    ...(asRecord(options.profile_readiness)
                        ? { profile_readiness: asRecord(options.profile_readiness) ?? {} }
                        : {}),
                    ...(asRecord(options.account_readiness)
                        ? { account_readiness: asRecord(options.account_readiness) ?? {} }
                        : {}),
                    ...(asRecord(options.xhs_driver_provider_requirements)
                        ? { xhs_driver_provider_requirements: asRecord(options.xhs_driver_provider_requirements) ?? {} }
                        : {}),
                    ...(Array.isArray(options.provider_requirement_refs)
                        ? {
                            provider_requirement_refs: options.provider_requirement_refs.filter((ref) => typeof ref === "string")
                        }
                        : {}),
                    ...(typeof options.runtime_binding_ref === "string"
                        ? { runtime_binding_ref: options.runtime_binding_ref }
                        : {}),
                    ...(typeof options.target_binding_snapshot_ref === "string"
                        ? { target_binding_snapshot_ref: options.target_binding_snapshot_ref }
                        : {}),
                    ...(asRecord(options.xhs_runtime_binding)
                        ? { xhs_runtime_binding: asRecord(options.xhs_runtime_binding) ?? {} }
                        : {}),
                    ...(asRecord(options.target_binding_snapshot)
                        ? { target_binding_snapshot: asRecord(options.target_binding_snapshot) ?? {} }
                        : {}),
                    ...(Array.isArray(options.target_binding_transition_evidence)
                        ? {
                            target_binding_transition_evidence: options.target_binding_transition_evidence.filter((item) => asRecord(item) !== null)
                        }
                        : {}),
                    ...(Array.isArray(options.downstream_slice_refs)
                        ? {
                            downstream_slice_refs: options.downstream_slice_refs.filter((ref) => typeof ref === "string")
                        }
                        : {}),
                    ...(options.risk_evidence_required === true ? { risk_evidence_required: true } : {}),
                    ...(hasOwn(options, "risk_evidence_gate_result")
                        ? { risk_evidence_gate_result: options.risk_evidence_gate_result }
                        : {}),
                    ...(options.behavior_baseline_hint_required === true
                        ? { behavior_baseline_hint_required: true }
                        : {}),
                    ...(hasOwn(options, "behavior_baseline_hint")
                        ? { behavior_baseline_hint: options.behavior_baseline_hint }
                        : {}),
                    ...(hasOwn(options, "non_proofs_observed")
                        ? { non_proofs_observed: options.non_proofs_observed }
                        : {}),
                    ...(options.platform_behavior_assessment_required === true
                        ? { platform_behavior_assessment_required: true }
                        : {}),
                    ...(hasOwn(options, "platform_behavior_assessment")
                        ? { platform_behavior_assessment: options.platform_behavior_assessment }
                        : {}),
                    ...(hasOwn(options, "platform_behavior_assessment_context")
                        ? {
                            platform_behavior_assessment_context: options.platform_behavior_assessment_context
                        }
                        : {}),
                    ...(hasOwn(options, "expected_platform_behavior_scope")
                        ? { expected_platform_behavior_scope: options.expected_platform_behavior_scope }
                        : {}),
                    ...(typeof options.platform_behavior_as_of === "string"
                        ? { platform_behavior_as_of: options.platform_behavior_as_of }
                        : {}),
                    ...(typeof options.platform_behavior_freshness_window_ms === "number"
                        ? {
                            platform_behavior_freshness_window_ms: options.platform_behavior_freshness_window_ms
                        }
                        : {}),
                    ...(Array.isArray(options.non_proofs)
                        ? {
                            non_proofs: options.non_proofs.filter((proof) => typeof proof === "string")
                        }
                        : {}),
                    ...(typeof options.page_runtime_readiness_ref === "string"
                        ? { page_runtime_readiness_ref: options.page_runtime_readiness_ref }
                        : {}),
                    ...(asRecord(options.xhs_page_runtime_readiness)
                        ? { xhs_page_runtime_readiness: asRecord(options.xhs_page_runtime_readiness) ?? {} }
                        : {}),
                    ...(asRecord(options.account_safety_gate_result)
                        ? { account_safety_gate_result: asRecord(options.account_safety_gate_result) ?? {} }
                        : {}),
                    ...(typeof options.page_runtime_readiness_decision === "string"
                        ? { page_runtime_readiness_decision: options.page_runtime_readiness_decision }
                        : {}),
                    ...(Array.isArray(options.page_runtime_readiness_blocking_reasons)
                        ? {
                            page_runtime_readiness_blocking_reasons: options.page_runtime_readiness_blocking_reasons.filter((reason) => typeof reason === "string")
                        }
                        : {}),
                    ...(Array.isArray(options.admission_gate_reasons)
                        ? {
                            admission_gate_reasons: options.admission_gate_reasons.filter((reason) => typeof reason === "string")
                        }
                        : {}),
                    ...(asRecord(options.approval) ? { approval: asRecord(options.approval) ?? {} } : {}),
                    ...(actualTargetDomain === XHS_READ_DOMAIN
                        ? {
                            target_site_logged_in: observedTargetSiteLoggedIn,
                            __anonymous_isolation_verified: observedAnonymousIsolationVerified
                        }
                        : {})
                },
                executionContext: {
                    runId: message.runId,
                    sessionId,
                    profile: message.profile ?? "unknown",
                    requestId: message.id,
                    commandRequestId: asString(commandParams.request_id) ?? undefined,
                    gateInvocationId: asString(commandParams.gate_invocation_id) ?? undefined
                }
            };
            let result;
            const contentCommandDeadlineMs = resolveContentCommandDeadlineMs(message.timeoutMs, options);
            const configureReadRequestContextProvenance = async () => {
                if (typeof this.#xhsEnv.configureCapturedRequestContextProvenance !== "function") {
                    return true;
                }
                const expected = {
                    page_context_namespace: createCurrentPageContextNamespace(locationHref),
                    profile_ref: commonInput.executionContext.profile,
                    session_id: commonInput.executionContext.sessionId,
                    target_tab_id: typeof message.tabId === "number" ? message.tabId : null,
                    run_id: commonInput.executionContext.runId,
                    action_ref: commonInput.abilityAction,
                    page_url: locationHref
                };
                if (commonInput.options.closeout_audit_required !== true &&
                    commonInput.options.closeout_evidence_evaluation !== true) {
                    const result = await this.#xhsEnv.configureCapturedRequestContextProvenance(expected).catch(() => null);
                    return capturedRequestContextProvenanceConfirmed(result, expected);
                }
                const timeoutMs = Math.max(1, Math.min(contentCommandDeadlineMs ?? 2_000, 2_000));
                let timeout = null;
                const result = await Promise.race([
                    this.#xhsEnv.configureCapturedRequestContextProvenance(expected).catch(() => null),
                    new Promise((resolve) => {
                        timeout = setTimeout(() => resolve(null), timeoutMs);
                    })
                ]);
                if (timeout) {
                    clearTimeout(timeout);
                }
                return capturedRequestContextProvenanceConfirmed(result, expected);
            };
            if (message.command === "xhs.search" ||
                message.command === "xhs.editor_input.validate" ||
                message.command === "xhs.editor_text.write" ||
                message.command === "xhs.creator_publish.admit" ||
                message.command === "xhs.creator_publish.controlled_live_write" ||
                message.command === "xhs.media_upload.discover") {
                const requestContextProvenanceConfirmed = await configureReadRequestContextProvenance();
                const searchInput = normalizedInput;
                const mediaUploadInput = message.command === "xhs.media_upload.discover"
                    ? validateNormalizedMediaUploadDiscoveryInput(normalizedInput, String(ability.id ?? "unknown"))
                    : null;
                const controlledLiveWriteInput = message.command === "xhs.creator_publish.controlled_live_write"
                    ? normalizedInput
                    : null;
                result = await maybeWithContentCommandDeadline(executeXhsSearch({
                    ...commonInput,
                    params: {
                        query: searchInput.query,
                        ...(message.command === "xhs.creator_publish.admit"
                            ? { target_page: "creator_publish_tab" }
                            : {}),
                        ...(message.command === "xhs.media_upload.discover"
                            ? { target_page: "creator_publish_tab" }
                            : {}),
                        ...(message.command === "xhs.creator_publish.controlled_live_write"
                            ? { target_page: "creator_publish_tab" }
                            : {}),
                        ...(controlledLiveWriteInput
                            ? {
                                live_write_attempt_id: controlledLiveWriteInput.live_write_attempt_id,
                                source_media_ref: controlledLiveWriteInput.source_media_ref,
                                source_media_digest: controlledLiveWriteInput.source_media_digest,
                                source_media_kind: controlledLiveWriteInput.source_media_kind,
                                ...(controlledLiveWriteInput.accepted_upload_artifact_identity
                                    ? {
                                        accepted_upload_artifact_identity: controlledLiveWriteInput.accepted_upload_artifact_identity
                                    }
                                    : {}),
                                ...(controlledLiveWriteInput.background_upload_capture_continuation === true
                                    ? { background_upload_capture_continuation: true }
                                    : {})
                            }
                            : {}),
                        ...(mediaUploadInput?.source_media_ref
                            ? { source_media_ref: mediaUploadInput.source_media_ref }
                            : {}),
                        ...(mediaUploadInput?.source_media_digest
                            ? { source_media_digest: mediaUploadInput.source_media_digest }
                            : {}),
                        ...(mediaUploadInput?.source_media_kind
                            ? { source_media_kind: mediaUploadInput.source_media_kind }
                            : {}),
                        ...(typeof searchInput.limit === "number" ? { limit: searchInput.limit } : {}),
                        ...(typeof searchInput.page === "number" ? { page: searchInput.page } : {}),
                        ...(typeof searchInput.search_id === "string"
                            ? { search_id: searchInput.search_id }
                            : {}),
                        ...(typeof searchInput.sort === "string" ? { sort: searchInput.sort } : {}),
                        ...(typeof searchInput.note_type === "string" || typeof searchInput.note_type === "number"
                            ? { note_type: searchInput.note_type }
                            : {})
                    },
                    options: {
                        ...commonInput.options,
                        __request_context_provenance_confirmed: requestContextProvenanceConfirmed
                    }
                }, this.#xhsEnv), {
                    timeoutMs: contentCommandDeadlineMs,
                    abilityId: commonInput.abilityId,
                    command: message.command
                });
            }
            else if (message.command === "xhs.detail") {
                void (await configureReadRequestContextProvenance());
                result = await maybeWithContentCommandDeadline(executeXhsDetail({
                    ...commonInput,
                    params: {
                        note_id: normalizedInput.note_id
                    }
                }, this.#xhsEnv), {
                    timeoutMs: contentCommandDeadlineMs,
                    abilityId: commonInput.abilityId,
                    command: message.command
                });
            }
            else {
                void (await configureReadRequestContextProvenance());
                result = await maybeWithContentCommandDeadline(executeXhsUserHome({
                    ...commonInput,
                    params: {
                        user_id: normalizedInput.user_id
                    }
                }, this.#xhsEnv), {
                    timeoutMs: contentCommandDeadlineMs,
                    abilityId: commonInput.abilityId,
                    command: message.command
                });
            }
            this.#emit(this.#toContentMessage(message.id, result, fingerprintRuntime));
        }
        catch (error) {
            if (error instanceof ExtensionContractError && error.code === "ERR_CLI_INVALID_ARGS") {
                this.#emit(toCliInvalidArgsResult({
                    id: message.id,
                    error,
                    fingerprintRuntime
                }));
                return;
            }
            this.#emit({
                kind: "result",
                id: message.id,
                ok: false,
                error: {
                    code: "ERR_EXECUTION_FAILED",
                    message: error instanceof Error ? error.message : String(error)
                },
                payload: fingerprintRuntime ? { fingerprint_runtime: fingerprintRuntime } : {}
            });
        }
    }
    #toContentMessage(id, result, fingerprintRuntime) {
        if (!result.ok) {
            return {
                kind: "result",
                id,
                ok: false,
                error: result.error,
                payload: {
                    ...(result.payload ?? {}),
                    ...(fingerprintRuntime ? { fingerprint_runtime: fingerprintRuntime } : {})
                }
            };
        }
        return {
            kind: "result",
            id,
            ok: true,
            payload: {
                ...(result.payload ?? {}),
                ...(fingerprintRuntime ? { fingerprint_runtime: fingerprintRuntime } : {})
            }
        };
    }
    #emit(message) {
        if (message.kind === "result" && typeof message.id === "string") {
            if (this.#completedResultIds.has(message.id)) {
                return;
            }
            this.#completedResultIds.add(message.id);
        }
        for (const listener of this.#listeners) {
            listener(message);
        }
    }
}
return { ContentScriptHandler, ExtensionContractError, encodeMainWorldPayload, configureCapturedRequestContextProvenanceViaMainWorld, installFingerprintRuntimeViaMainWorld, installMainWorldEventChannelSecret, readCapturedRequestContextViaMainWorld, readPageStateViaMainWorld, resolveFingerprintContextForContract, validateXhsCommandInputForExtension, resolveMainWorldEventNamesForSecret };
})();
const __webenvoy_module_content_script = (() => {
const {
  ContentScriptHandler,
  installFingerprintRuntimeViaMainWorld,
  installMainWorldEventChannelSecret
} = __webenvoy_module_content_script_handler;
const { ensureFingerprintRuntimeContext } = __webenvoy_module_fingerprint_profile;
const FINGERPRINT_CONTEXT_CACHE_KEY = "__webenvoy_fingerprint_context__";
const FINGERPRINT_BOOTSTRAP_PAYLOAD_KEY = "__webenvoy_fingerprint_bootstrap_payload__";
const EXTENSION_BOOTSTRAP_FILENAME = "__webenvoy_fingerprint_bootstrap.json";
const STARTUP_TRUST_SOURCE = "extension_bootstrap_context";
const MAIN_WORLD_SECRET_NAMESPACE = "webenvoy.main_world.secret.v1";
const CONTENT_SCRIPT_BOOTSTRAP_STATE_KEY = "__webenvoy_content_script_bootstrap_state__";
const STAGED_STARTUP_TRUST_RUN_ID = undefined;
const STAGED_STARTUP_TRUST_SESSION_ID = undefined;
const STAGED_STARTUP_TRUST_FINGERPRINT_RUNTIME = undefined;
const normalizeForwardMessage = (request) => ({
    kind: "forward",
    id: request.id,
    runId: typeof request.runId === "string" ? request.runId : request.id,
    tabId: typeof request.tabId === "number" && Number.isInteger(request.tabId) ? request.tabId : null,
    profile: typeof request.profile === "string" ? request.profile : null,
    cwd: typeof request.cwd === "string" ? request.cwd : "",
    timeoutMs: typeof request.timeoutMs === "number" && Number.isFinite(request.timeoutMs) && request.timeoutMs > 0
        ? Math.floor(request.timeoutMs)
        : 30_000,
    command: typeof request.command === "string" ? request.command : "",
    params: typeof request.params === "object" && request.params !== null
        ? request.params
        : {},
    commandParams: typeof request.commandParams === "object" && request.commandParams !== null
        ? request.commandParams
        : {},
    fingerprintContext: ensureFingerprintRuntimeContext(request.fingerprintContext ??
        (typeof request.commandParams === "object" &&
            request.commandParams !== null &&
            "fingerprint_context" in request.commandParams
            ? request.commandParams.fingerprint_context
            : null))
});
const readBootstrapFingerprintContext = () => globalThis[FINGERPRINT_BOOTSTRAP_PAYLOAD_KEY] ?? null;
const asRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
const asNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const asStringArray = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
const hashMainWorldSecret = (value) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `mwsec_${(hash >>> 0).toString(36)}`;
};
const stableSerializeForSecret = (value, seen = new WeakSet()) => {
    if (value === null) {
        return "null";
    }
    if (typeof value === "string") {
        return JSON.stringify(value);
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? String(value) : '"NaN"';
    }
    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerializeForSecret(item, seen)).join(",")}]`;
    }
    if (typeof value !== "object") {
        return JSON.stringify(String(value));
    }
    if (seen.has(value)) {
        return '"[Circular]"';
    }
    seen.add(value);
    const record = value;
    const keys = Object.keys(record).sort();
    const body = keys
        .map((key) => `${JSON.stringify(key)}:${stableSerializeForSecret(record[key], seen)}`)
        .join(",");
    seen.delete(value);
    return `{${body}}`;
};
const resolveExplicitMainWorldSecret = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    return asNonEmptyString(record.main_world_secret ??
        record.mainWorldSecret ??
        record.main_world_bridge_secret ??
        record.mainWorldBridgeSecret);
};
const deriveMainWorldSecretFromBootstrapPayload = (value) => {
    const explicit = resolveExplicitMainWorldSecret(value);
    if (explicit) {
        return explicit;
    }
    if (value === null || value === undefined) {
        return null;
    }
    const serialized = stableSerializeForSecret(value);
    if (serialized.length === 0) {
        return null;
    }
    return hashMainWorldSecret(`${MAIN_WORLD_SECRET_NAMESPACE}|${serialized}`);
};
const resolveBootstrapFingerprintContext = (value) => {
    const mainWorldSecret = deriveMainWorldSecretFromBootstrapPayload(value);
    const record = asRecord(value);
    const stagedRunId = asNonEmptyString(STAGED_STARTUP_TRUST_RUN_ID);
    const stagedSessionId = asNonEmptyString(STAGED_STARTUP_TRUST_SESSION_ID);
    const stagedFingerprintRuntime = ensureFingerprintRuntimeContext(STAGED_STARTUP_TRUST_FINGERPRINT_RUNTIME);
    const runId = asNonEmptyString(record?.run_id ?? record?.runId) ?? stagedRunId;
    const runtimeContextId = asNonEmptyString(record?.runtime_context_id ?? record?.runtimeContextId);
    const sessionId = asNonEmptyString(record?.session_id ?? record?.sessionId) ?? stagedSessionId;
    const direct = ensureFingerprintRuntimeContext(value);
    if (direct) {
        return {
            fingerprintRuntime: direct,
            runId,
            runtimeContextId,
            sessionId,
            mainWorldSecret
        };
    }
    if (!record) {
        return {
            fingerprintRuntime: stagedFingerprintRuntime,
            runId,
            runtimeContextId,
            sessionId,
            mainWorldSecret: null
        };
    }
    return {
        fingerprintRuntime: ensureFingerprintRuntimeContext(record.fingerprint_runtime ?? null) ?? stagedFingerprintRuntime,
        runId,
        runtimeContextId,
        sessionId,
        mainWorldSecret
    };
};
const sanitizeScopePart = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "_");
const resolveRunToken = (normalized, runId) => {
    if (typeof runId === "string" && runId.trim().length > 0) {
        return sanitizeScopePart(runId.trim());
    }
    const record = asRecord(normalized);
    const directRunId = record?.runId ?? record?.run_id;
    if (typeof directRunId === "string" && directRunId.trim().length > 0) {
        return sanitizeScopePart(directRunId.trim());
    }
    return "run_unknown";
};
const buildExecutionScopeToken = (normalized) => {
    const execution = asRecord(asRecord(normalized)?.execution ?? null);
    if (!execution) {
        return "execution_unknown";
    }
    const liveDecision = typeof execution.live_decision === "string" ? execution.live_decision : "unknown";
    const allowedModes = Array.isArray(execution.allowed_execution_modes)
        ? execution.allowed_execution_modes
            .filter((mode) => typeof mode === "string")
            .sort()
            .join(",")
        : "";
    const reasonCodes = Array.isArray(execution.reason_codes)
        ? execution.reason_codes
            .filter((code) => typeof code === "string")
            .sort()
            .join(",")
        : "";
    const token = `${liveDecision}|${allowedModes}|${reasonCodes}`;
    return sanitizeScopePart(token.length > 0 ? token : "execution_unknown");
};
const buildScopedCacheKey = (normalized, runId) => {
    const profile = sanitizeScopePart(normalized.profile);
    const runToken = resolveRunToken(normalized, runId);
    const executionToken = buildExecutionScopeToken(normalized);
    return `${FINGERPRINT_CONTEXT_CACHE_KEY}:${profile}:${runToken}:${executionToken}`;
};
const getExtensionStorageArea = () => {
    const chromeApi = globalThis.chrome;
    const storage = chromeApi?.storage;
    if (!storage) {
        return null;
    }
    const area = storage.session ?? storage.local ?? null;
    if (!area || typeof area.get !== "function" || typeof area.set !== "function") {
        return null;
    }
    return area;
};
const persistExtensionFingerprintContext = (normalized, runId) => {
    // Keep fingerprint runtime context in extension-private storage only.
    // Never mirror it to page-readable sessionStorage/localStorage.
    const storageArea = getExtensionStorageArea();
    if (!storageArea || typeof storageArea.set !== "function") {
        return;
    }
    const scopedKey = buildScopedCacheKey(normalized, runId);
    try {
        const maybePromise = storageArea.set({
            [scopedKey]: normalized
        });
        if (maybePromise && typeof maybePromise.catch === "function") {
            void maybePromise.catch(() => undefined);
        }
    }
    catch {
        // ignore cache failures
    }
};
const loadBootstrapFingerprintContextFromExtension = async (runtime) => {
    const bootstrapUrl = typeof runtime.getURL === "function" ? runtime.getURL(EXTENSION_BOOTSTRAP_FILENAME) : null;
    if (!bootstrapUrl || typeof fetch !== "function") {
        return {
            fingerprintRuntime: null,
            runId: null,
            runtimeContextId: null,
            sessionId: null,
            mainWorldSecret: null
        };
    }
    try {
        const response = await fetch(bootstrapUrl);
        if (!response.ok) {
            return {
                fingerprintRuntime: null,
                runId: null,
                runtimeContextId: null,
                sessionId: null,
                mainWorldSecret: null
            };
        }
        const envelope = asRecord(await response.json());
        const resolved = resolveBootstrapFingerprintContext(envelope?.extension_bootstrap ?? envelope ?? null);
        return {
            fingerprintRuntime: resolved.fingerprintRuntime,
            runId: resolved.runId ?? asNonEmptyString(envelope?.run_id ?? envelope?.runId),
            runtimeContextId: resolved.runtimeContextId ??
                asNonEmptyString(envelope?.runtime_context_id ?? envelope?.runtimeContextId),
            sessionId: resolved.sessionId ?? asNonEmptyString(envelope?.session_id ?? envelope?.sessionId),
            mainWorldSecret: resolved.mainWorldSecret
        };
    }
    catch {
        return {
            fingerprintRuntime: null,
            runId: null,
            runtimeContextId: null,
            sessionId: null,
            mainWorldSecret: null
        };
    }
};
const installStartupFingerprintPatch = (fingerprintRuntime) => {
    void installFingerprintRuntimeViaMainWorld(fingerprintRuntime).catch(() => {
        // ignore install failures; startup trust must not rely on main-world response
    });
};
const emitStartupFingerprintTrust = (runtime, input) => {
    if (!input.runId || !input.runtimeContextId || !input.sessionId) {
        return;
    }
    runtime.sendMessage?.({
        kind: "result",
        id: `startup-fingerprint-trust:${input.runId}`,
        ok: true,
        payload: {
            startup_fingerprint_trust: {
                run_id: input.runId,
                runtime_context_id: input.runtimeContextId,
                profile: input.fingerprintRuntime.profile,
                session_id: input.sessionId,
                fingerprint_runtime: input.fingerprintRuntime,
                trust_source: STARTUP_TRUST_SOURCE,
                bootstrap_attested: true,
                main_world_result_used_for_trust: false
            }
        }
    });
};
const relayContentResultToBackground = (runtime, message, options) => {
    const sendMessage = runtime.sendMessage;
    if (!sendMessage) {
        return;
    }
    const relayFailure = (reason, error) => {
        if (options?.allowFallback === false) {
            return;
        }
        const relayErrorMessage = error instanceof Error ? error.message : String(error);
        relayContentResultToBackground(runtime, {
            kind: "result",
            id: message.id,
            ok: false,
            error: {
                code: "ERR_TRANSPORT_FORWARD_FAILED",
                message: "content script result relay failed"
            },
            payload: {
                details: {
                    stage: "relay",
                    reason,
                    relay_error: relayErrorMessage
                }
            }
        }, {
            allowFallback: false
        });
    };
    let normalizedMessage;
    try {
        normalizedMessage = JSON.parse(JSON.stringify(message));
    }
    catch (error) {
        relayFailure("CONTENT_RESULT_SERIALIZATION_FAILED", error);
        return;
    }
    try {
        const maybePromise = sendMessage(normalizedMessage);
        if (maybePromise && typeof maybePromise.catch === "function") {
            void maybePromise.catch((error) => {
                relayFailure("CONTENT_RESULT_RELAY_FAILED", error);
            });
        }
    }
    catch (error) {
        relayFailure("CONTENT_RESULT_RELAY_FAILED", error);
    }
};
const resolveBootstrapState = (runtime) => {
    const existingState = runtime[CONTENT_SCRIPT_BOOTSTRAP_STATE_KEY];
    if (existingState) {
        return existingState;
    }
    const state = {
        generation: 0,
        handler: null,
        detachResultRelay: null,
        messageListener: null
    };
    runtime[CONTENT_SCRIPT_BOOTSTRAP_STATE_KEY] = state;
    return state;
};
const bootstrapContentScript = (runtime) => {
    if (!runtime.onMessage?.addListener || !runtime.sendMessage) {
        return false;
    }
    const state = resolveBootstrapState(runtime);
    state.generation += 1;
    const generation = state.generation;
    state.detachResultRelay?.();
    if (state.handler) {
        state.handler.setReachable(false);
    }
    if (state.messageListener && runtime.onMessage.removeListener) {
        runtime.onMessage.removeListener(state.messageListener);
    }
    const handler = new ContentScriptHandler();
    state.handler = handler;
    state.detachResultRelay = null;
    state.messageListener = null;
    const bootstrapPayload = readBootstrapFingerprintContext();
    const bootstrapInput = resolveBootstrapFingerprintContext(bootstrapPayload);
    installMainWorldEventChannelSecret(bootstrapInput.mainWorldSecret);
    const bootstrapContext = bootstrapInput.fingerprintRuntime;
    if (bootstrapContext) {
        persistExtensionFingerprintContext(bootstrapContext, bootstrapInput.runId);
        installStartupFingerprintPatch(bootstrapContext);
        emitStartupFingerprintTrust(runtime, {
            runId: bootstrapInput.runId,
            runtimeContextId: bootstrapInput.runtimeContextId,
            sessionId: bootstrapInput.sessionId,
            fingerprintRuntime: bootstrapContext
        });
        if (!bootstrapInput.runId || !bootstrapInput.runtimeContextId || !bootstrapInput.sessionId) {
            void loadBootstrapFingerprintContextFromExtension(runtime).then((resolvedBootstrap) => {
                if (state.generation !== generation || state.handler !== handler) {
                    return;
                }
                if (!resolvedBootstrap.runId ||
                    !resolvedBootstrap.runtimeContextId ||
                    !resolvedBootstrap.sessionId) {
                    return;
                }
                emitStartupFingerprintTrust(runtime, {
                    runId: resolvedBootstrap.runId,
                    runtimeContextId: resolvedBootstrap.runtimeContextId,
                    sessionId: resolvedBootstrap.sessionId,
                    fingerprintRuntime: bootstrapContext
                });
            });
        }
    }
    else {
        void loadBootstrapFingerprintContextFromExtension(runtime).then((resolvedBootstrap) => {
            if (state.generation !== generation || state.handler !== handler) {
                return;
            }
            installMainWorldEventChannelSecret(resolvedBootstrap.mainWorldSecret);
            if (!resolvedBootstrap.fingerprintRuntime) {
                runtime.sendMessage?.({
                    kind: "result",
                    id: "startup-background-wake",
                    ok: true,
                    payload: {
                        startup_background_wake: {
                            source: "content_script_bootstrap"
                        }
                    }
                });
                return;
            }
            persistExtensionFingerprintContext(resolvedBootstrap.fingerprintRuntime, resolvedBootstrap.runId);
            installStartupFingerprintPatch(resolvedBootstrap.fingerprintRuntime);
            emitStartupFingerprintTrust(runtime, {
                runId: resolvedBootstrap.runId,
                runtimeContextId: resolvedBootstrap.runtimeContextId,
                sessionId: resolvedBootstrap.sessionId,
                fingerprintRuntime: resolvedBootstrap.fingerprintRuntime
            });
        });
    }
    state.detachResultRelay = handler.onResult((message) => {
        if (state.generation !== generation || state.handler !== handler) {
            return;
        }
        relayContentResultToBackground(runtime, message);
    });
    const messageListener = (message, _sender, sendResponse) => {
        if (state.generation !== generation || state.handler !== handler) {
            return;
        }
        const request = message;
        if (!request || request.kind !== "forward" || typeof request.id !== "string") {
            return;
        }
        const normalized = normalizeForwardMessage(request);
        if (normalized.fingerprintContext) {
            persistExtensionFingerprintContext(normalized.fingerprintContext, normalized.runId);
        }
        let detachResponseRelay = null;
        if (sendResponse) {
            detachResponseRelay = handler.onResult((result) => {
                if (result.id !== normalized.id) {
                    return;
                }
                detachResponseRelay?.();
                detachResponseRelay = null;
                try {
                    sendResponse(JSON.parse(JSON.stringify(result)));
                }
                catch {
                    sendResponse({
                        kind: "result",
                        id: normalized.id,
                        ok: false,
                        error: {
                            code: "ERR_TRANSPORT_FORWARD_FAILED",
                            message: "content script result response serialization failed"
                        },
                        payload: {
                            details: {
                                stage: "relay",
                                reason: "CONTENT_RESULT_RESPONSE_SERIALIZATION_FAILED"
                            }
                        }
                    });
                }
            });
        }
        const accepted = handler.onBackgroundMessage(normalized);
        if (!accepted) {
            detachResponseRelay?.();
            detachResponseRelay = null;
            const unreachableResponse = {
                kind: "result",
                id: request.id,
                ok: false,
                error: {
                    code: "ERR_TRANSPORT_FORWARD_FAILED",
                    message: "content script unreachable"
                }
            };
            runtime.sendMessage?.({
                ...unreachableResponse
            });
            sendResponse?.(unreachableResponse);
            return sendResponse ? true : undefined;
        }
        return sendResponse ? true : undefined;
    };
    runtime.onMessage.addListener(messageListener);
    state.messageListener = messageListener;
    return true;
};
const globalChrome = globalThis.chrome;
const runtime = globalChrome?.runtime;
const isLikelyContentScriptEnv = typeof window !== "undefined" && typeof document !== "undefined";
if (isLikelyContentScriptEnv && runtime) {
    bootstrapContentScript(runtime);
}
return { bootstrapContentScript };
})();
globalThis.__webenvoy_content_script_bundle_modules = {
  __webenvoy_module_xhs_search,
  __webenvoy_module_xhs_detail,
  __webenvoy_module_xhs_user_home,
  __webenvoy_module_xhs_search_gate,
  __webenvoy_module_xhs_controlled_live_write,
  __webenvoy_module_layer2_humanized_events,
  __webenvoy_module_content_script_handler
};
})();
