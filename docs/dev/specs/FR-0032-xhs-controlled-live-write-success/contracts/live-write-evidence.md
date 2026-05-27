# FR-0032 Contract: Live Write Evidence

## Ownership

This contract defines the evidence envelope for XHS controlled live write attempts. It is the parent evidence object for upload, submit, publish, cleanup, residual and stop records.

It is adapter-consumable in shape, but FR-0032 does not extract a Syvert Adapter and does not introduce a CloakBrowser provider.

## LiveWriteEvidenceV1

```ts
type LiveWriteEvidenceV1 = {
  schema_version: "fr-0032.live_write_evidence.v1";
  live_write_attempt_id: string;
  canonical_issue_ref: "#835";
  execution_phase:
    | "entry_gate"
    | "upload"
    | "submit"
    | "publish"
    | "cleanup"
    | "closed";
  scope: LiveWriteScopeV1;
  entry_gate: LiveWriteEntryGateV1;
  upload_artifact_identity: UploadArtifactIdentityV1 | null;
  submit_evidence: SubmitEvidenceV1 | null;
  publish_result_identity: PublishResultIdentityV1 | null;
  cleanup_result: CleanupRollbackProofV1 | null;
  risk_signals: RiskSignalV1[];
  stop_signal: LiveWriteStopSignalV1 | null;
  residual_record: ResidualRecordV1 | null;
  created_at: string;
  updated_at: string;
};
```

## Scope

```ts
type LiveWriteScopeV1 = {
  platform: "xhs";
  target_domain: "creator.xiaohongshu.com";
  target_page: "creator_publish_tab";
  browser_channel: "Google Chrome stable";
  execution_surface: "real_browser";
  requested_execution_mode: "live_write";
  profile_ref: string;
  target_tab_id: number;
  probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1";
  run_id: string;
  artifact_identity: string;
};
```

Constraints:

- `execution_surface` must be `real_browser`.
- `run_id`, `profile_ref`, `target_tab_id` and `artifact_identity` must identify the current latest-head evidence run.
- Stub, fake host, `runtime.ping`, `runtime.bootstrap` or control-plane-only signals cannot satisfy this scope.

## Entry Gate

```ts
type LiveWriteEntryGateV1 = {
  spec_review_state: "passed";
  latest_head_sha: string;
  readmission_decision: "GO";
  readmission_run_id: string;
  runtime_readiness: "ready";
  identity_binding_state: "bound";
  service_worker_freshness_state: "fresh" | "not_applicable";
  target_binding_state: "verified";
  account_safety_state: "clear";
  validation_rows_state: "ready_verified_no_drift";
  publish_visibility_scope: PublishVisibilityScopeV1;
  cleanup_policy_ref: string;
  checked_at: string;
};
```

Constraints:

- `spec_review_state` is required before any implementation enters true live write.
- `readmission_decision=GO` must be fresh for the current head. If stale, rerun FR-0031 gate commands before upload.
- `publish_visibility_scope` and cleanup policy must be selected before upload.

## Upload Artifact Identity

```ts
type UploadArtifactIdentityV1 = {
  upload_artifact_id: string;
  source_media_ref: string;
  source_media_digest: string;
  source_media_kind: "image" | "video" | "mixed";
  platform_staging_ref: string | null;
  page_preview_locator: string | null;
  accepted_by_platform: boolean;
  visible_in_editor: boolean;
  captured_at: string;
};
```

Constraints:

- `source_media_ref` must be an auditable reference, not an uncontrolled leak of a sensitive local path.
- `accepted_by_platform=true` and `visible_in_editor=true` are required for upload success.
- Upload success is not full live write success.

## Submit Evidence

```ts
type SubmitEvidenceV1 = {
  submit_action_ref: string;
  submit_locator: string;
  submitted_at: string;
  submit_result_state:
    | "accepted"
    | "platform_validation_error"
    | "blocked_by_risk"
    | "unknown";
  platform_message: string | null;
};
```

Constraints:

- `submit_result_state=accepted` is required before publish can be evaluated as success.
- Platform validation error must stop publish unless a later safe retry is explicitly gated.

## Risk Signal

```ts
type RiskSignalV1 = {
  risk_signal_id: string;
  detected_at: string;
  source:
    | "runtime.status"
    | "runtime.audit"
    | "page_observation"
    | "upload"
    | "submit"
    | "publish"
    | "cleanup";
  kind:
    | "account_safety"
    | "captcha_required"
    | "login_required"
    | "security_redirect"
    | "browser_env_abnormal"
    | "rate_limit"
    | "content_policy"
    | "upload_failure"
    | "submit_failure"
    | "publish_identity_missing"
    | "cleanup_failure";
  severity: "info" | "warning" | "blocking";
  details_ref: string;
};
```

Blocking risk signals must create or attach to a `LiveWriteStopSignalV1`.

## Residual Record

```ts
type ResidualRecordV1 = {
  residual_record_id: string;
  publish_result_identity: PublishResultIdentityV1 | null;
  visibility_scope: PublishVisibilityScopeV1;
  reason:
    | "cleanup_failed"
    | "rollback_not_supported"
    | "cleanup_blocked"
    | "manual_followup_required";
  external_visibility_may_remain: boolean;
  required_followup: string;
  recorded_at: string;
};
```

Any publish identity that cannot be deleted, hidden or rolled back must create a residual record.

## Success Predicate

`LiveWriteEvidenceV1` may be evaluated as full controlled live write success only when:

- entry gate is passed and fresh for latest head.
- upload artifact identity is present and accepted.
- submit evidence is present and accepted.
- publish result identity is present and verified.
- cleanup result is present.
- no blocking risk signal remains unresolved.
- if cleanup is not successful, a residual record exists and closeout discloses it.

## Explicit Non-Success States

The following are not full live write success:

- readmission `GO` only
- dry-run or recon only
- upload artifact accepted without submit/publish
- publish toast without result identity
- DOM/state extraction without platform publish identity
- cleanup failure without residual record
