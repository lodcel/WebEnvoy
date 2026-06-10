# Account Safety Gate Contract

## Contract owner

- Owner: `#1176` / `FR-0066`
- Contract id: `account-safety-gate.v1`
- Scope: account safety state, evidence refs, freshness, scope matching and fail-closed evaluation before `write_prepare` or `live_write_commit` admission

This contract only defines the account safety lane. It does not define runtime implementation, browser interaction, provider selection, operator unlock storage, default lock release, live evidence record shape, publish behavior, cleanup behavior or release closeout.

## Account safety scope

```ts
interface AccountSafetyScopeV1 {
  schema_version: "account-safety-gate.v1";
  capability_level: "write_admit" | "write_prepare" | "live_write_commit";
  workflow_ref: string;
  target_domain: string;
  target_page: string;
  profile_ref: string;
  browser_channel: string;
  execution_surface: "real_browser";
  provider_requirement_ref: string | null;
  runtime_target_binding_ref: string | null;
  operator_unlock_ref: string | null;
  head_sha: string;
  run_id: string | null;
  evaluation_context_ref: string;
}
```

Rules:

- `write_prepare` and `live_write_commit` require a scoped account safety result with `state=clear`.
- `write_admit` may request classification, but a classification result cannot be promoted into preparation or commit unless it is current, exact-scope and clear.
- `operator_unlock_ref` is required for `live_write_commit` only. Its presence does not prove account safety.
- `run_id` may be null only for non-runtime formal planning samples; real evaluations must provide either a current `run_id` or a machine-checkable `evaluation_context_ref`.

## Account safety state

```ts
type AccountSafetyStateV1 =
  | "clear"
  | "unknown"
  | "blocked"
  | "stale"
  | "redaction_invalid"
  | "requires_operator_attention";
```

Rules:

- Only `clear` can support `decision=allow`.
- `unknown`, `blocked`, `stale`, `redaction_invalid` and `requires_operator_attention` must block `write_prepare` and `live_write_commit`.
- Unknown enum values must fail closed with `account_safety_unknown`.

## Safety signal class

```ts
type AccountSafetySignalClassV1 =
  | "login_required"
  | "captcha_required"
  | "security_redirect"
  | "account_restricted"
  | "account_verification_required"
  | "rate_limited"
  | "browser_environment_abnormal"
  | "profile_concurrency_conflict"
  | "session_integrity_unknown"
  | "previous_residual_unresolved"
  | "cleanup_or_rollback_pending"
  | "account_identifier_redaction_invalid"
  | "safety_evidence_stale";
```

## Evidence refs

```ts
interface AccountSafetyEvidenceRefsV1 {
  safety_check_ref: string;
  profile_ref: string;
  runtime_status_ref: string;
  target_binding_ref: string;
  signal_scan_ref: string;
  redaction_policy_ref: string;
  freshness_ref: string;
  risk_disposition_ref: string;
  operator_unlock_ref?: string;
  default_commit_lock_ref?: string;
  live_evidence_gate_ref?: string;
}
```

Rules:

- Refs are locators only. They must not inline secrets, account identifiers, cookies, tokens, private profile paths, page content, media content, private URLs or live artifact payloads.
- Refs must follow `FR-0041` redaction semantics and #1181 live-write redaction expectations.
- Required refs with `redaction_required`, `policy_missing`, `invalid`, stale freshness, partial availability or scope mismatch cannot satisfy `clear`.

## Account safety state record

```ts
interface AccountSafetyStateRecordV1 {
  schema_version: "account-safety-gate.v1";
  safety_state_id: string;
  canonical_issue_ref: "#1176";
  scope: AccountSafetyScopeV1;
  state: AccountSafetyStateV1;
  signal_classes: AccountSafetySignalClassV1[];
  evidence_refs: AccountSafetyEvidenceRefsV1;
  checked_at: string;
  expires_at: string;
  redaction_state:
    | "redacted"
    | "redaction_required"
    | "not_required"
    | "policy_missing"
    | "invalid";
}
```

Rules:

- `checked_at` and `expires_at` are required for real evaluations.
- `expires_at` must be later than evaluation time.
- `redaction_state=redaction_required|policy_missing|invalid` blocks `clear`.
- `signal_classes=[]` is required for `state=clear`.

## Evaluation input

```ts
interface AccountSafetyGateInputV1 {
  schema_version: "account-safety-gate.v1";
  requested_capability_level: "write_prepare" | "live_write_commit";
  requested_scope: AccountSafetyScopeV1;
  account_safety_state_record: AccountSafetyStateRecordV1 | null;
  evaluated_at: string;
}
```

Rules:

- Missing `account_safety_state_record` returns `gate_status=unknown`, `decision=deny`.
- Any requested scope mismatch returns `gate_status=blocked`, `decision=deny`.
- Stale `checked_at` / `expires_at` returns `gate_status=stale`, `decision=deny`.

## Evaluation result

```ts
interface AccountSafetyGateResultV1 {
  schema_version: "account-safety-gate.v1";
  gate_status:
    | "not_applicable"
    | "clear"
    | "unknown"
    | "blocked"
    | "stale"
    | "redaction_invalid"
    | "requires_operator_attention";
  decision: "allow" | "deny" | "defer";
  blocking_reasons: AccountSafetyBlockingReasonV1[];
  account_safety_ref: string | null;
  evidence_refs_consumed: string[];
  evaluated_at: string;
  downstream_owner:
    | "#1179"
    | "#1180"
    | "#1211"
    | "runtime_owner"
    | "operator_owner"
    | "live_evidence_owner"
    | "none";
}
```

Rules:

- `decision=allow` is valid only when `gate_status=clear` and `blocking_reasons=[]`.
- `decision=allow` clears only the account safety lane. It does not release default lock, accept operator unlock, prove provider requirement, prove runtime target binding, accept anti-detection gate or accept live evidence.
- If `blocking_reasons` is non-empty, `decision` must be `deny` or `defer`.
- Real evaluations must use concrete `evaluated_at`. Formal spec examples may use `N/A` only outside real gate outputs.

## Blocking reasons

```ts
type AccountSafetyBlockingReasonV1 =
  | "account_safety_state_missing"
  | "account_safety_unknown"
  | "account_safety_blocked"
  | "account_safety_stale"
  | "account_safety_scope_mismatch"
  | "account_safety_head_mismatch"
  | "account_safety_run_mismatch"
  | "login_required"
  | "captcha_required"
  | "security_redirect"
  | "account_restricted"
  | "account_verification_required"
  | "rate_limited"
  | "browser_environment_abnormal"
  | "profile_concurrency_conflict"
  | "session_integrity_unknown"
  | "previous_residual_unresolved"
  | "cleanup_or_rollback_pending"
  | "safety_evidence_missing"
  | "safety_evidence_stale"
  | "safety_evidence_redaction_invalid"
  | "stub_or_fake_host_evidence"
  | "control_plane_only_signal"
  | "historical_or_stale_evidence"
  | "operator_attention_required"
  | "downstream_owner_required";
```

Rules:

- `stub_or_fake_host_evidence`, `control_plane_only_signal` and `historical_or_stale_evidence` cannot satisfy `live_write_commit`.
- `safety_evidence_redaction_invalid` blocks both `write_prepare` and `live_write_commit`.
- `operator_attention_required` must not be auto-cleared by FR-0064 operator unlock.

## Minimum consumable examples

These examples are redacted contract examples for implementation and test calibration. They are not live evidence, do not identify a real account or profile, and do not allow `live_write_commit`.

### Clear state example

```json
{
  "schema_version": "account-safety-gate.v1",
  "safety_state_id": "account-safety-redacted-20260611-001",
  "canonical_issue_ref": "#1176",
  "scope": {
    "schema_version": "account-safety-gate.v1",
    "capability_level": "write_prepare",
    "workflow_ref": "xhs.creator_publish.prepare",
    "target_domain": "creator.xiaohongshu.com",
    "target_page": "creator_publish_tab",
    "profile_ref": "profile:redacted-account-safety-demo",
    "browser_channel": "Google Chrome stable",
    "execution_surface": "real_browser",
    "provider_requirement_ref": "pr-redacted/provider-requirement/xhs-creator-publish-admit",
    "runtime_target_binding_ref": "pr-redacted/target-binding/current",
    "operator_unlock_ref": null,
    "head_sha": "aef7c1518ce7e21d7b905aa8af67fb6710e288fa",
    "run_id": "run-redacted-account-safety",
    "evaluation_context_ref": "artifact-redacted/account-safety/context"
  },
  "state": "clear",
  "signal_classes": [],
  "evidence_refs": {
    "safety_check_ref": "artifact-redacted/account-safety/check",
    "profile_ref": "profile:redacted-account-safety-demo",
    "runtime_status_ref": "artifact-redacted/runtime-status",
    "target_binding_ref": "artifact-redacted/target-binding",
    "signal_scan_ref": "artifact-redacted/account-safety/signals",
    "redaction_policy_ref": "FR-0041",
    "freshness_ref": "artifact-redacted/account-safety/freshness",
    "risk_disposition_ref": "artifact-redacted/account-safety/risk-disposition"
  },
  "checked_at": "2026-06-11T00:00:00Z",
  "expires_at": "2026-06-11T00:30:00Z",
  "redaction_state": "redacted"
}
```

Expected result:

```json
{
  "schema_version": "account-safety-gate.v1",
  "gate_status": "clear",
  "decision": "allow",
  "blocking_reasons": [],
  "account_safety_ref": "account-safety-redacted-20260611-001",
  "evidence_refs_consumed": [
    "artifact-redacted/account-safety/check",
    "profile:redacted-account-safety-demo",
    "artifact-redacted/runtime-status",
    "artifact-redacted/target-binding",
    "artifact-redacted/account-safety/signals",
    "FR-0041",
    "artifact-redacted/account-safety/freshness",
    "artifact-redacted/account-safety/risk-disposition"
  ],
  "evaluated_at": "2026-06-11T00:05:00Z",
  "downstream_owner": "#1179"
}
```

`decision=allow` in this example means only that the account safety lane accepted the redacted state. Provider requirement, default lock, operator unlock, runtime target binding, anti-detection gate and live evidence still need their own accepted results.

### Missing state deny example

```json
{
  "schema_version": "account-safety-gate.v1",
  "gate_status": "unknown",
  "decision": "deny",
  "blocking_reasons": ["account_safety_state_missing"],
  "account_safety_ref": null,
  "evidence_refs_consumed": [],
  "evaluated_at": "2026-06-11T00:05:00Z",
  "downstream_owner": "none"
}
```

### Redaction invalid deny example

```json
{
  "schema_version": "account-safety-gate.v1",
  "gate_status": "redaction_invalid",
  "decision": "deny",
  "blocking_reasons": ["safety_evidence_redaction_invalid"],
  "account_safety_ref": "account-safety-redacted-invalid",
  "evidence_refs_consumed": ["artifact-redacted/account-safety/invalid-redaction"],
  "evaluated_at": "2026-06-11T00:05:00Z",
  "downstream_owner": "runtime_owner"
}
```
