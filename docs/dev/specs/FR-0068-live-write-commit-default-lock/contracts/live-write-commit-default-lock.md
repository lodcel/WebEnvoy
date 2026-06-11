# Live-Write Commit Default Lock Contract

## Contract owner

- Owner: `#1180` / `FR-0068`
- Contract id: `live-write-commit-default-lock.v1`
- Scope: default locked semantics, exact-scope release disposition, required preconditions, non-proofs, evidence freshness, redaction and downstream re-consumption before `live_write_commit`

This contract only defines the default lock lane. It does not define runtime implementation, browser interaction, account operation, provider execution, operator unlock storage, live evidence record shape, publish behavior, cleanup behavior, release gate matrix or issue closeout.

## Lock scope

```ts
interface LiveWriteCommitDefaultLockScopeV1 {
  schema_version: "live-write-commit-default-lock.v1";
  capability_level: "live_write_commit";
  workflow_ref: string;
  provider_requirement_ref: string;
  profile_manifest_allowlist_ref: string;
  extension_native_bridge_ref: string;
  account_safety_ref: string;
  runtime_target_binding_ref: string;
  anti_detection_gate_ref: string;
  operator_unlock_ref: string;
  live_evidence_gate_ref: string;
  target_domain: string;
  target_page: string;
  profile_ref: string;
  browser_channel: string;
  execution_surface: "real_browser";
  head_sha: string;
  run_id: string;
  evaluated_at: string;
}
```

Rules:

- `capability_level` must be `live_write_commit`; lower levels cannot be upgraded by alias.
- Every field participates in exact-scope matching. Drift in workflow, provider, profile, target, runtime, operator, evidence, head or run fails closed.
- `provider_requirement_ref` must point to a commit-scope provider requirement owner. #1179 `xhs.creator_publish.admit` is admission-only and must not appear in release-ready consumed refs.
- `execution_surface=real_browser` is necessary for real commit evaluation, but it is not evidence by itself.
- Formal examples may use redacted refs and `N/A`; real gate outputs must use concrete head/run/time refs.

## Lock state

```ts
type LiveWriteCommitDefaultLockStateV1 =
  | "locked"
  | "release_not_requested"
  | "release_blocked"
  | "release_deferred"
  | "release_ready_for_downstream_gate"
  | "release_revoked"
  | "release_expired"
  | "redaction_invalid";
```

Rules:

- Initial state is `locked`.
- Only `release_ready_for_downstream_gate` can support `decision=allow`.
- `decision=allow` clears only the default lock lane and remains a required input to a downstream commit gate.
- Unknown or missing states fail closed.

## Evidence refs

```ts
interface LiveWriteCommitDefaultLockEvidenceRefV1 {
  kind:
    | "provider_requirement_ref"
    | "profile_manifest_allowlist_ref"
    | "extension_native_bridge_ref"
    | "account_safety_ref"
    | "runtime_target_binding_ref"
    | "anti_detection_gate_ref"
    | "operator_unlock_ref"
    | "live_evidence_gate_ref"
    | "freshness_ref"
    | "redaction_policy_ref";
  ref: string;
  source_owner: string;
  collected_at: string | "N/A";
  head_sha: string | "N/A";
  run_id: string | "N/A";
  freshness_scope:
    | "current_runtime_admission"
    | "current_live_evidence_run"
    | "current_pr_head"
    | "historical_background"
    | "not_applicable";
  redaction_state:
    | "redacted"
    | "redaction_required"
    | "not_required"
    | "policy_missing"
    | "invalid";
}

interface LiveWriteCommitDefaultLockEvidenceRefsV1 {
  provider_requirement_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
  profile_manifest_allowlist_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
  extension_native_bridge_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
  account_safety_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
  runtime_target_binding_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
  anti_detection_gate_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
  operator_unlock_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
  live_evidence_gate_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
  freshness_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
  redaction_policy_ref: LiveWriteCommitDefaultLockEvidenceRefV1;
}
```

Rules:

- Refs are locators only. They must not inline secrets, account identifiers, cookies, tokens, profile paths, browser paths, private URLs, page content, media content, raw manifests or live artifact payloads.
- Refs must bind owner, collected time, head, run, freshness scope and redaction state so downstream gates can reject stale, wrong-head, wrong-run or under-redacted inputs.
- Required refs with `redaction_required`, `policy_missing`, `invalid`, stale freshness, scope mismatch, partial availability or unknown owner cannot unlock default lock.
- A downstream release gate such as #1211 may emit a later `risk_disposition_ref` only after re-consuming this result and its current exact-scope refs. That downstream risk disposition is not part of the FR-0068 required refs and cannot unlock the default lock by itself.

## Lock record

```ts
interface LiveWriteCommitDefaultLockRecordV1 {
  schema_version: "live-write-commit-default-lock.v1";
  lock_record_id: string;
  canonical_issue_ref: "#1180";
  scope: LiveWriteCommitDefaultLockScopeV1;
  state: LiveWriteCommitDefaultLockStateV1;
  evidence_refs: LiveWriteCommitDefaultLockEvidenceRefsV1;
  checked_at: string;
  expires_at: string;
  revoked_at: string | null;
  redaction_state:
    | "redacted"
    | "redaction_required"
    | "not_required"
    | "policy_missing"
    | "invalid";
  non_proofs: LiveWriteCommitDefaultLockNonProofV1[];
}
```

Rules:

- `checked_at` and `expires_at` are required for real evaluations.
- `revoked_at` invalidates any previously ready release disposition.
- `redaction_state=redaction_required|policy_missing|invalid` blocks release.
- Historical records are background only unless freshness and exact scope are current.

## Evaluation input

```ts
interface LiveWriteCommitDefaultLockInputV1 {
  schema_version: "live-write-commit-default-lock.v1";
  requested_capability_level: "live_write_commit";
  requested_scope: LiveWriteCommitDefaultLockScopeV1;
  lock_record: LiveWriteCommitDefaultLockRecordV1 | null;
  downstream_reconsumption_declared: boolean;
  evaluated_at: string;
}
```

Rules:

- Missing `lock_record` returns `gate_status=locked`, `decision=deny`.
- Scope mismatch returns `gate_status=release_blocked`, `decision=deny`.
- Expired or revoked release disposition returns `release_expired` or `release_revoked`.
- If `downstream_reconsumption_declared=false`, result must deny or defer even if the lock lane has a ready disposition.

## Evaluation result

```ts
interface LiveWriteCommitDefaultLockResultV1 {
  schema_version: "live-write-commit-default-lock.v1";
  gate_status: LiveWriteCommitDefaultLockStateV1;
  decision: "allow" | "deny" | "defer";
  blocking_reasons: LiveWriteCommitDefaultLockBlockingReasonV1[];
  default_lock_ref: string | null;
  evidence_refs_consumed: string[];
  downstream_reconsumption_required: true;
  evaluated_at: string;
  downstream_owner:
    | "#1211"
    | "runtime_owner"
    | "operator_owner"
    | "live_evidence_owner"
    | "release_gate_owner"
    | "none";
}
```

Rules:

- `decision=allow` is valid only when `gate_status=release_ready_for_downstream_gate`, `blocking_reasons=[]`, required evidence refs are current, exact-scope and redacted, and downstream re-consumption is declared.
- `decision=allow` does not execute, schedule or authorize an actual commit by itself.
- Non-empty blockers force `deny` or `defer`.
- Real evaluations must use concrete `evaluated_at`; formal examples may use `N/A` only outside real gate outputs.

## Blocking reasons

```ts
type LiveWriteCommitDefaultLockBlockingReasonV1 =
  | "default_commit_lock_active"
  | "default_lock_release_not_requested"
  | "default_lock_release_missing"
  | "default_lock_release_expired"
  | "default_lock_release_revoked"
  | "default_lock_scope_mismatch"
  | "default_lock_head_mismatch"
  | "default_lock_run_mismatch"
  | "provider_requirement_missing"
  | "provider_requirement_scope_mismatch"
  | "profile_manifest_missing"
  | "profile_manifest_scope_mismatch"
  | "extension_native_bridge_missing"
  | "extension_native_bridge_not_ready"
  | "account_safety_missing"
  | "account_safety_not_clear"
  | "runtime_target_binding_missing"
  | "anti_detection_gate_missing"
  | "operator_unlock_missing"
  | "operator_unlock_not_accepted"
  | "live_evidence_missing"
  | "live_evidence_not_current"
  | "live_evidence_scope_mismatch"
  | "freshness_missing"
  | "freshness_stale"
  | "freshness_scope_mismatch"
  | "redaction_policy_missing"
  | "redaction_policy_invalid"
  | "stub_or_fake_host_evidence"
  | "control_plane_only_signal"
  | "historical_or_stale_evidence"
  | "redaction_invalid"
  | "downstream_reconsumption_required";
```

Rules:

- `default_commit_lock_active` is the default blocker.
- `stub_or_fake_host_evidence`, `control_plane_only_signal` and `historical_or_stale_evidence` cannot satisfy default lock release.
- `redaction_invalid` blocks release for all scopes.
- `downstream_reconsumption_required` remains required until a downstream commit gate explicitly consumes the current exact-scope refs.

## Non-proofs

```ts
type LiveWriteCommitDefaultLockNonProofV1 =
  | "issue_closed_state"
  | "spec_text"
  | "pr_merge"
  | "review_approval"
  | "guardian_approval"
  | "hosted_checks_pass"
  | "xhs_creator_publish_admit_pass"
  | "runtime_ping"
  | "runtime_bootstrap_ack"
  | "service_worker_wake_signal"
  | "descriptor_ref"
  | "doctor_pass"
  | "stub_or_fake_host"
  | "historical_artifact"
  | "control_plane_only_signal";
```

Rules:

- Non-proofs may appear in diagnostics as rejected evidence, but cannot be promoted into evidence refs that unlock commit.
- `xhs_creator_publish_admit_pass` proves at most the admission-only lane defined by #1179; it never releases default lock and never populates release-ready consumed refs.

## Minimum consumable examples

These examples are synthetic and redacted. They are not live evidence, do not identify a real account or profile, and do not unlock `live_write_commit`.

### Locked by default

```json
{
  "schema_version": "live-write-commit-default-lock.v1",
  "gate_status": "locked",
  "decision": "deny",
  "blocking_reasons": ["default_commit_lock_active", "operator_unlock_missing", "live_evidence_missing"],
  "default_lock_ref": null,
  "evidence_refs_consumed": [],
  "downstream_reconsumption_required": true,
  "evaluated_at": "N/A",
  "downstream_owner": "none"
}
```

### Ready only for downstream re-consumption

```json
{
  "schema_version": "live-write-commit-default-lock.v1",
  "gate_status": "release_ready_for_downstream_gate",
  "decision": "allow",
  "blocking_reasons": [],
  "default_lock_ref": "FR-0068.default_lock_release/redacted-current-scope",
  "evidence_refs_consumed": [
    "commit_provider_requirement/redacted-current-scope",
    "FR-0065.profile_manifest/redacted-current-scope",
    "FR-0067.extension_native_bridge/redacted-current-scope",
    "FR-0066.account_safety/redacted-current-scope",
    "runtime_target_binding/redacted-current-scope",
    "anti_detection_gate/redacted-current-scope",
    "FR-0064.operator_unlock/redacted-current-scope",
    "live_evidence_gate/redacted-current-scope",
    "freshness/redacted-current-scope",
    "FR-0041.redaction_policy/redacted-current-scope"
  ],
  "downstream_reconsumption_required": true,
  "evaluated_at": "N/A",
  "downstream_owner": "#1211"
}
```

This ready result is not a commit result. A downstream commit gate must reconsume the refs and can still deny if any ref is stale, revoked, out of scope or under-redacted.
