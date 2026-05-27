# FR-0032 Contract: Published Result Identity

## Ownership

This contract defines how FR-0032 identifies the externally visible or platform-accepted result after controlled publish.

## PublishResultIdentityV1

```ts
type PublishResultIdentityV1 = {
  schema_version: "fr-0032.publish_result_identity.v1";
  publish_result_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  target_domain: "creator.xiaohongshu.com";
  target_page: "creator_publish_tab";
  source_upload_artifact_id: string;
  submit_action_ref: string;
  result_kind:
    | "note_id"
    | "published_url"
    | "creator_result_page"
    | "platform_publish_record";
  note_id: string | null;
  published_url: string | null;
  creator_result_url: string | null;
  platform_record_ref: string | null;
  publish_visibility_scope: PublishVisibilityScopeV1;
  success_signal: PublishSuccessSignalV1;
  captured_at: string;
  verification_state: "verified" | "identity_missing" | "ambiguous" | "blocked";
};
```

## Publish Visibility Scope

```ts
type PublishVisibilityScopeV1 =
  | "private_or_self_visible"
  | "limited_test_visibility"
  | "public_visible"
  | "unknown";
```

Constraints:

- `unknown` cannot be used for planned live publish. It is allowed only when reporting a failure or incomplete capture.
- The selected visibility scope must be recorded before upload starts.
- Public visibility increases risk and must be explicitly accepted by the implementation issue before #847 live closeout.

## Publish Success Signal

```ts
type PublishSuccessSignalV1 = {
  signal_source:
    | "platform_response"
    | "creator_result_page"
    | "current_page_state"
    | "followup_page_verification";
  signal_locator: string;
  platform_message: string | null;
  observed_at: string;
};
```

Constraints:

- A generic toast is insufficient unless paired with `note_id`, `published_url`, `creator_result_url` or `platform_record_ref`.
- A current-page state signal must be bound to the same `run_id`, `profile_ref`, `target_tab_id` and source upload artifact.
- Follow-up verification must not broaden scope into unrelated browsing or account operations.

## Identity Completeness Rules

At least one of these fields must be non-null for `verification_state=verified`:

- `note_id`
- `published_url`
- `creator_result_url`
- `platform_record_ref`

If none can be captured, the evaluator must return `verification_state=identity_missing`, and FR-0032 cannot close as success.

## Failure Classifications

```ts
type PublishIdentityFailureCodeV1 =
  | "PUBLISH_SUCCESS_SIGNAL_MISSING"
  | "PUBLISH_RESULT_IDENTITY_MISSING"
  | "PUBLISH_RESULT_AMBIGUOUS"
  | "PUBLISH_VISIBILITY_UNKNOWN"
  | "PUBLISH_BLOCKED_BY_RISK"
  | "PUBLISH_VERIFICATION_STALE";
```

Failure codes must attach to `LiveWriteStopSignalV1` or a non-success closeout result.
