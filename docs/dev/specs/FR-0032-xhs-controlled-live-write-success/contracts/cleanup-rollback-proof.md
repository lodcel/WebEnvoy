# FR-0032 Contract: Cleanup Rollback Proof

## Ownership

This contract defines cleanup, rollback and residual evidence after controlled live write reaches publish or any partial write state.

## CleanupRollbackProofV1

```ts
type CleanupRollbackProofV1 = {
  schema_version: "fr-0032.cleanup_rollback_proof.v1";
  cleanup_result_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  publish_result_identity: PublishResultIdentityV1 | null;
  cleanup_policy_ref: string;
  cleanup_action:
    | "delete_published_result"
    | "hide_published_result"
    | "remove_draft"
    | "abandon_unpublished_upload"
    | "no_safe_cleanup_action";
  cleanup_outcome:
    | "deleted"
    | "hidden"
    | "draft_removed"
    | "rollback_not_supported"
    | "cleanup_blocked"
    | "cleanup_failed"
    | "not_needed";
  proof_locator: string | null;
  platform_message: string | null;
  attempted_at: string;
  completed_at: string | null;
  residual_record: ResidualRecordV1 | null;
};
```

## Cleanup Policy Requirements

Before a true write action, the implementation must record:

- cleanup policy reference
- allowed cleanup actions
- stop conditions where cleanup would increase account risk
- manual follow-up owner for residual content

## Outcome Rules

- `deleted`, `hidden`, `draft_removed` and `not_needed` can close cleanup without residual content.
- `rollback_not_supported`, `cleanup_blocked` and `cleanup_failed` require `residual_record` when any external visibility may remain.
- `no_safe_cleanup_action` is allowed only when cleanup would increase account or platform risk; it must create a stop signal and residual record if content may remain.

## ResidualRecordV1

```ts
type ResidualRecordV1 = {
  residual_record_id: string;
  live_write_attempt_id: string;
  publish_result_id: string | null;
  visibility_scope: PublishVisibilityScopeV1;
  external_visibility_may_remain: boolean;
  residual_locator: string | null;
  reason:
    | "cleanup_failed"
    | "cleanup_blocked"
    | "rollback_not_supported"
    | "unsafe_to_cleanup"
    | "identity_missing_after_publish";
  required_followup: string;
  recorded_at: string;
};
```

## Failure Codes

```ts
type CleanupFailureCodeV1 =
  | "CLEANUP_ACTION_NOT_AVAILABLE"
  | "CLEANUP_BLOCKED_BY_ACCOUNT_RISK"
  | "CLEANUP_PLATFORM_FAILURE"
  | "CLEANUP_RESULT_UNKNOWN"
  | "RESIDUAL_RECORD_REQUIRED";
```

Cleanup failure must not be hidden in a success comment. It must be represented in `CleanupRollbackProofV1`, `ResidualRecordV1` or `LiveWriteStopSignalV1`.
