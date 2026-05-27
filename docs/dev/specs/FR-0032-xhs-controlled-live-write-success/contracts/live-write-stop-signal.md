# FR-0032 Contract: Live Write Stop Signal

## Ownership

This contract defines the structured stop signal emitted whenever FR-0032 cannot safely continue the live write ladder.

## LiveWriteStopSignalV1

```ts
type LiveWriteStopSignalV1 = {
  schema_version: "fr-0032.live_write_stop_signal.v1";
  stop_signal_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  stopped_at: string;
  stopped_step:
    | "entry_gate"
    | "upload"
    | "submit"
    | "publish"
    | "publish_identity"
    | "cleanup"
    | "closeout";
  blocker_layer:
    | "spec_review"
    | "profile_runtime"
    | "identity_binding"
    | "target_binding"
    | "account_safety"
    | "anti_detection_validation"
    | "upload"
    | "submit"
    | "publish"
    | "published_identity"
    | "cleanup"
    | "risk_policy";
  blocker_code: LiveWriteStopCodeV1;
  severity: "warning" | "blocking";
  later_write_actions_blocked: boolean;
  cleanup_required: boolean;
  cleanup_result_id: string | null;
  residual_record_id: string | null;
  required_recovery_action: string;
  evidence_ref: string;
};
```

## Stop Codes

```ts
type LiveWriteStopCodeV1 =
  | "SPEC_REVIEW_NOT_PASSED"
  | "READMISSION_GO_STALE"
  | "RUNTIME_NOT_READY"
  | "IDENTITY_BINDING_NOT_BOUND"
  | "TARGET_BINDING_NOT_VERIFIED"
  | "ACCOUNT_SAFETY_NOT_CLEAR"
  | "VALIDATION_ROWS_NOT_READY"
  | "PUBLISH_VISIBILITY_NOT_SELECTED"
  | "UPLOAD_ARTIFACT_MISSING"
  | "UPLOAD_PLATFORM_REJECTED"
  | "SUBMIT_PLATFORM_VALIDATION_ERROR"
  | "PUBLISH_BLOCKED"
  | "PUBLISH_RESULT_IDENTITY_MISSING"
  | "CAPTCHA_REQUIRED"
  | "SECURITY_REDIRECT"
  | "BROWSER_ENV_ABNORMAL"
  | "CLEANUP_FAILED"
  | "RESIDUAL_RECORD_REQUIRED";
```

## Stop Semantics

- `severity=blocking` means no later write action may execute in the same attempt.
- Any stop at or after `upload` must evaluate cleanup or residual recording.
- Stop signals must identify the exact step and required recovery action.
- A stop signal can close a failed attempt, but it cannot close #835 as full live write success.

## Recovery Requirements

Before retrying after a stop signal, the next attempt must:

- reference the previous `stop_signal_id`.
- rerun entry gate if runtime, target, account, validation or head state may have changed.
- prove cleanup/residual state for any partial write from the previous attempt.
- avoid reusing stale upload, submit or publish identity as fresh evidence.
