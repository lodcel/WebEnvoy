# FR-0031 契约：XHS Creator Live Write Admission

## Ownership

`FR-0031` owns only XHS creator live write admission. It does not own upload success, publish success, file picker behavior, account login, or the underlying validation record family.

## Scope

```ts
type XhsCreatorLiveWriteAdmissionScopeV1 = {
  platform: "xhs";
  target_domain: "creator.xiaohongshu.com";
  target_page: "creator_publish_tab";
  browser_channel: "Google Chrome stable";
  execution_surface: "real_browser";
  requested_execution_mode: "live_write";
  profile_ref: string;
  probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1";
};
```

Constraints:

- `profile_ref` uses the existing `FR-0003 / FR-0020` namespace.
- `www.xiaohongshu.com` and `live_read_high_risk` are not compatible substitutes.
- `probe-bundle/xhs-closeout-min-v1` is not a compatible substitute unless a future spec explicitly expands it to creator write scope.

## Runtime Prerequisite

```ts
type XhsCreatorRuntimePrerequisiteV1 = {
  profile_ref: string;
  profile_root_ref: string;
  identity_binding_state: "bound";
  service_worker_freshness_state: "fresh" | "not_applicable" | "unknown";
  runtime_readiness: "ready";
  execution_surface: "real_browser";
  headless: false;
  account_safety_state: "clear";
};
```

Constraints:

- `service_worker_freshness_state="unknown"` is allowed only when identity preflight is non-blocking.
- `EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED` is always blocking.
- `identity_binding_state` values other than `bound` are blocking.

## Target Binding

```ts
type XhsCreatorTargetBindingV1 = {
  requested_target_domain: "creator.xiaohongshu.com";
  requested_target_page: "creator_publish_tab";
  requested_target_tab_id: number;
  managed_target_tab_id: number;
  managed_target_domain: "creator.xiaohongshu.com";
  managed_target_page: "creator_publish_tab";
  target_tab_continuity: "runtime_trust_state" | "rebound_current_managed_tab";
};
```

Constraints:

- Missing, stale, cross-profile, or cross-tab target binding is blocking.
- Target binding cannot be proven by upload, submit, publish, file picker, or DataTransfer injection.

## Validation Binding

```ts
type XhsCreatorRequiredValidationScopeV1 = {
  target_fr_ref: "FR-0012" | "FR-0013" | "FR-0014";
  validation_scope:
    | "layer1_consistency"
    | "layer2_interaction"
    | "layer3_session_rhythm";
  profile_ref: string;
  browser_channel: "Google Chrome stable";
  execution_surface: "real_browser";
  effective_execution_mode: "live_write";
  probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1";
  baseline_status: "ready";
  current_result_state: "verified";
  current_drift_state: "no_drift";
};
```

Required rows:

- `FR-0012 + layer1_consistency`
- `FR-0013 + layer2_interaction`
- `FR-0014 + layer3_session_rhythm`

## Admission Decision

```ts
type XhsCreatorLiveWriteAdmissionDecisionV1 = {
  decision: "GO" | "NO_GO";
  scope: XhsCreatorLiveWriteAdmissionScopeV1;
  runtime_prerequisite: XhsCreatorRuntimePrerequisiteV1 | null;
  target_binding: XhsCreatorTargetBindingV1 | null;
  validation_requirements_satisfied: boolean;
  blocker:
    | null
    | {
        blocker_layer:
          | "profile_runtime"
          | "identity_binding"
          | "target_binding"
          | "account_safety"
          | "session_rhythm"
          | "anti_detection_validation";
        blocker_code: string;
        required_recovery_action: string;
      };
};
```

`decision="GO"` requires all runtime, target, account, rhythm, and validation conditions to pass. Any missing or stale proof returns `NO_GO`.

## Readiness Ladder

```ts
type XhsCreatorLiveWriteReadinessStepV1 =
  | "static_tests"
  | "runtime_status"
  | "runtime_audit"
  | "runtime_closeout_gate"
  | "dry_run_or_non_write_probe"
  | "creator_target_restore_readiness"
  | "creator_write_admission_decision";
```

Each step must stop on first failure and write blocker evidence. None of these steps may execute upload, submit, publish, file picker, DataTransfer injection, or other irreversible write action.
