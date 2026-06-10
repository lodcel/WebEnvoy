# Operator Unlock Contract

## Contract owner

- Owner: `#1178` / `FR-0064`
- Contract id: `operator-unlock.v1`
- Scope: explicit operator unlock requirements, audit evidence refs, scope matching and fail-closed evaluation for `live_write_commit`

This contract only defines the operator unlock lane. It does not define runtime implementation, publish behavior, provider selection, default lock release, account safety storage, live evidence record shape or release closeout.

## Operator unlock record

```ts
interface OperatorUnlockRecordV1 {
  schema_version: "operator-unlock.v1";
  unlock_id: string;
  canonical_issue_ref: "#1178";
  capability_level: "live_write_commit";
  workflow_ref: string;
  provider_requirement_ref: string;
  default_commit_lock_ref: string;
  target_domain: string;
  target_page: string;
  profile_ref: string;
  browser_channel: "Google Chrome stable" | "Google Chrome" | string;
  execution_surface: "real_browser";
  operator_ref: string;
  operator_action: "unlock_live_write_commit";
  operator_intent: string;
  acknowledged_risks: OperatorUnlockRiskAcknowledgementV1[];
  head_sha: string;
  unlock_reason_ref: string;
  evidence_refs: OperatorUnlockEvidenceRefsV1;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}
```

Rules:

- `capability_level` must be exactly `live_write_commit`.
- `workflow_ref`, `provider_requirement_ref`, `default_commit_lock_ref`, `target_domain`, `target_page`, `profile_ref`, `operator_ref`, `head_sha`, `unlock_reason_ref`, `created_at` and `expires_at` must be non-empty.
- `execution_surface=real_browser` is required for scope binding, but does not prove live evidence passed.
- `revoked_at !== null` invalidates the record.
- `expires_at` must be later than evaluation time.

## Risk acknowledgements

```ts
type OperatorUnlockRiskAcknowledgementV1 =
  | "external_visible_write"
  | "account_safety_required"
  | "cleanup_or_residual_required"
  | "default_commit_lock_release_required"
  | "latest_head_live_evidence_required";
```

Rules:

- All five acknowledgements are required before an operator unlock can be accepted.
- Additional downstream acknowledgements may be required, but missing required values must fail closed.

## Evidence refs

```ts
interface OperatorUnlockEvidenceRefsV1 {
  unlock_request_ref: string;
  operator_identity_ref: string;
  scope_snapshot_ref: string;
  risk_ack_ref: string;
  default_lock_disposition_ref: string;
  provider_requirement_disposition_ref: string;
  account_safety_ref: string;
  runtime_target_binding_ref: string;
  anti_detection_gate_ref: string;
  live_evidence_gate_ref: string;
}
```

Rules:

- Refs are locators only. They must not inline secrets, account identifiers, cookies, tokens, private profile paths, page content, media content or live artifact payloads.
- Every ref must match the exact unlock scope or point to an evaluator result that includes exact scope.
- Stub/fake host evidence, runtime ping, runtime bootstrap ack, control-plane-only signal, same-head historical artifact and #835 closed state are invalid.

## Evaluation input

```ts
interface OperatorUnlockEvaluationInputV1 {
  schema_version: "operator-unlock.v1";
  requested_capability_level: "live_write_commit";
  requested_workflow_ref: string;
  requested_provider_requirement_ref: string;
  requested_default_commit_lock_ref: string;
  requested_target_domain: string;
  requested_target_page: string;
  requested_profile_ref: string;
  requested_browser_channel: string;
  requested_execution_surface: "real_browser";
  requested_head_sha: string;
  operator_unlock_record: OperatorUnlockRecordV1 | null;
  evaluated_at: string;
}
```

Rules:

- Missing `operator_unlock_record` returns `status=missing`, `decision=deny`.
- Any requested field mismatch with the record returns `status=scope_mismatch`, `decision=deny`, except head mismatch may return `unlock_head_mismatch` as the specific blocker.
- Unknown capability levels are outside this contract and must be denied by FR-0062 before this evaluator runs.

## Evaluation result

```ts
interface OperatorUnlockEvaluationResultV1 {
  schema_version: "operator-unlock.v1";
  status:
    | "not_requested"
    | "missing"
    | "present"
    | "expired"
    | "revoked"
    | "scope_mismatch"
    | "evidence_invalid"
    | "operator_invalid"
    | "accepted";
  decision: "allow" | "deny" | "defer";
  blocking_reasons: OperatorUnlockBlockingReasonV1[];
  operator_unlock_ref: string | null;
  evidence_refs_consumed: string[];
  evaluated_at: string;
  downstream_owner:
    | "#1180"
    | "#1211"
    | "runtime_owner"
    | "live_evidence_owner"
    | "none";
}
```

Rules:

- `decision=allow` is valid only when `status=accepted` and `blocking_reasons=[]`.
- `decision=allow` means only that the operator unlock blocker is cleared. It does not release default lock or prove live evidence.
- If `blocking_reasons` is non-empty, `decision` must be `deny` or `defer`.
- Real evaluations must use concrete `evaluated_at`. Formal spec examples may use `N/A` only outside real gate outputs.

## Minimum consumable examples

These examples are redacted contract examples for implementation and test calibration. They are not live evidence, do not identify a real account or profile, and do not unlock `live_write_commit`.

### Accepted record example

```json
{
  "schema_version": "operator-unlock.v1",
  "unlock_id": "unlock-redacted-20260610-001",
  "canonical_issue_ref": "#1178",
  "capability_level": "live_write_commit",
  "workflow_ref": "xhs.creator_publish.commit",
  "provider_requirement_ref": "pr-1257/provider-requirement/redacted-xhs-creator-publish-admit",
  "default_commit_lock_ref": "pr-1257/default-lock/redacted-release-candidate",
  "target_domain": "creator.xiaohongshu.com",
  "target_page": "creator_publish_tab",
  "profile_ref": "profile:redacted-operator-unlock-demo",
  "browser_channel": "Google Chrome stable",
  "execution_surface": "real_browser",
  "operator_ref": "operator:redacted-trusted-reviewer",
  "operator_action": "unlock_live_write_commit",
  "operator_intent": "Unlock only this exact redacted live_write_commit scope for downstream gate evaluation.",
  "acknowledged_risks": [
    "external_visible_write",
    "account_safety_required",
    "cleanup_or_residual_required",
    "default_commit_lock_release_required",
    "latest_head_live_evidence_required"
  ],
  "head_sha": "aef7c1518ce7e21d7b905aa8af67fb6710e288fa",
  "unlock_reason_ref": "pr-1257/operator-unlock/reason/redacted",
  "evidence_refs": {
    "unlock_request_ref": "pr-1257/operator-unlock/request/redacted",
    "operator_identity_ref": "pr-1257/operator-unlock/operator-identity/redacted",
    "scope_snapshot_ref": "pr-1257/operator-unlock/scope-snapshot/redacted",
    "risk_ack_ref": "pr-1257/operator-unlock/risk-ack/redacted",
    "default_lock_disposition_ref": "pr-1257/default-lock/disposition/redacted",
    "provider_requirement_disposition_ref": "pr-1257/provider-requirement/disposition/redacted",
    "account_safety_ref": "pr-1257/account-safety/ref/redacted",
    "runtime_target_binding_ref": "pr-1257/runtime-target-binding/ref/redacted",
    "anti_detection_gate_ref": "pr-1257/anti-detection-gate/ref/redacted",
    "live_evidence_gate_ref": "pr-1257/live-evidence-gate/ref/redacted"
  },
  "created_at": "2026-06-10T07:00:00Z",
  "expires_at": "2026-06-10T08:00:00Z",
  "revoked_at": null
}
```

### Matching accepted evaluation example

```json
{
  "schema_version": "operator-unlock.v1",
  "requested_capability_level": "live_write_commit",
  "requested_workflow_ref": "xhs.creator_publish.commit",
  "requested_provider_requirement_ref": "pr-1257/provider-requirement/redacted-xhs-creator-publish-admit",
  "requested_default_commit_lock_ref": "pr-1257/default-lock/redacted-release-candidate",
  "requested_target_domain": "creator.xiaohongshu.com",
  "requested_target_page": "creator_publish_tab",
  "requested_profile_ref": "profile:redacted-operator-unlock-demo",
  "requested_browser_channel": "Google Chrome stable",
  "requested_execution_surface": "real_browser",
  "requested_head_sha": "aef7c1518ce7e21d7b905aa8af67fb6710e288fa",
  "operator_unlock_record": {
    "schema_version": "operator-unlock.v1",
    "unlock_id": "unlock-redacted-20260610-001",
    "canonical_issue_ref": "#1178",
    "capability_level": "live_write_commit",
    "workflow_ref": "xhs.creator_publish.commit",
    "provider_requirement_ref": "pr-1257/provider-requirement/redacted-xhs-creator-publish-admit",
    "default_commit_lock_ref": "pr-1257/default-lock/redacted-release-candidate",
    "target_domain": "creator.xiaohongshu.com",
    "target_page": "creator_publish_tab",
    "profile_ref": "profile:redacted-operator-unlock-demo",
    "browser_channel": "Google Chrome stable",
    "execution_surface": "real_browser",
    "operator_ref": "operator:redacted-trusted-reviewer",
    "operator_action": "unlock_live_write_commit",
    "operator_intent": "Unlock only this exact redacted live_write_commit scope for downstream gate evaluation.",
    "acknowledged_risks": [
      "external_visible_write",
      "account_safety_required",
      "cleanup_or_residual_required",
      "default_commit_lock_release_required",
      "latest_head_live_evidence_required"
    ],
    "head_sha": "aef7c1518ce7e21d7b905aa8af67fb6710e288fa",
    "unlock_reason_ref": "pr-1257/operator-unlock/reason/redacted",
    "evidence_refs": {
      "unlock_request_ref": "pr-1257/operator-unlock/request/redacted",
      "operator_identity_ref": "pr-1257/operator-unlock/operator-identity/redacted",
      "scope_snapshot_ref": "pr-1257/operator-unlock/scope-snapshot/redacted",
      "risk_ack_ref": "pr-1257/operator-unlock/risk-ack/redacted",
      "default_lock_disposition_ref": "pr-1257/default-lock/disposition/redacted",
      "provider_requirement_disposition_ref": "pr-1257/provider-requirement/disposition/redacted",
      "account_safety_ref": "pr-1257/account-safety/ref/redacted",
      "runtime_target_binding_ref": "pr-1257/runtime-target-binding/ref/redacted",
      "anti_detection_gate_ref": "pr-1257/anti-detection-gate/ref/redacted",
      "live_evidence_gate_ref": "pr-1257/live-evidence-gate/ref/redacted"
    },
    "created_at": "2026-06-10T07:00:00Z",
    "expires_at": "2026-06-10T08:00:00Z",
    "revoked_at": null
  },
  "evaluated_at": "2026-06-10T07:05:00Z"
}
```

Expected result:

```json
{
  "schema_version": "operator-unlock.v1",
  "status": "accepted",
  "decision": "allow",
  "blocking_reasons": [],
  "operator_unlock_ref": "unlock-redacted-20260610-001",
  "evidence_refs_consumed": [
    "pr-1257/operator-unlock/request/redacted",
    "pr-1257/operator-unlock/operator-identity/redacted",
    "pr-1257/operator-unlock/scope-snapshot/redacted",
    "pr-1257/operator-unlock/risk-ack/redacted",
    "pr-1257/default-lock/disposition/redacted",
    "pr-1257/provider-requirement/disposition/redacted",
    "pr-1257/account-safety/ref/redacted",
    "pr-1257/runtime-target-binding/ref/redacted",
    "pr-1257/anti-detection-gate/ref/redacted",
    "pr-1257/live-evidence-gate/ref/redacted"
  ],
  "evaluated_at": "2026-06-10T07:05:00Z",
  "downstream_owner": "#1180"
}
```

`decision=allow` in this example only means the operator unlock lane accepted the redacted record. #1180 default lock release, #1211 release gate, provider requirement pass, account safety, runtime target binding, anti-detection gate and live evidence must still be evaluated by their owners.

### Missing record deny example

```json
{
  "schema_version": "operator-unlock.v1",
  "requested_capability_level": "live_write_commit",
  "requested_workflow_ref": "xhs.creator_publish.commit",
  "requested_provider_requirement_ref": "pr-1257/provider-requirement/redacted-xhs-creator-publish-admit",
  "requested_default_commit_lock_ref": "pr-1257/default-lock/redacted-release-candidate",
  "requested_target_domain": "creator.xiaohongshu.com",
  "requested_target_page": "creator_publish_tab",
  "requested_profile_ref": "profile:redacted-operator-unlock-demo",
  "requested_browser_channel": "Google Chrome stable",
  "requested_execution_surface": "real_browser",
  "requested_head_sha": "aef7c1518ce7e21d7b905aa8af67fb6710e288fa",
  "operator_unlock_record": null,
  "evaluated_at": "2026-06-10T07:05:00Z"
}
```

Expected result:

```json
{
  "schema_version": "operator-unlock.v1",
  "status": "missing",
  "decision": "deny",
  "blocking_reasons": ["operator_unlock_missing"],
  "operator_unlock_ref": null,
  "evidence_refs_consumed": [],
  "evaluated_at": "2026-06-10T07:05:00Z",
  "downstream_owner": "none"
}
```

## Blocking reasons

Allowed values:

- `operator_unlock_missing`
- `operator_unlock_expired`
- `operator_unlock_revoked`
- `operator_unlock_scope_mismatch`
- `operator_identity_missing`
- `operator_identity_untrusted`
- `operator_action_missing`
- `risk_ack_missing`
- `unlock_evidence_missing`
- `unlock_evidence_stale`
- `unlock_evidence_scope_mismatch`
- `unlock_redaction_invalid`
- `unlock_head_mismatch`
- `default_lock_disposition_missing`
- `provider_requirement_disposition_missing`
- `account_safety_ref_missing`
- `runtime_target_binding_ref_missing`
- `anti_detection_gate_ref_missing`
- `live_evidence_gate_ref_missing`

Rules:

- `operator_unlock_missing`, `operator_unlock_expired`, `operator_unlock_revoked`, `operator_unlock_scope_mismatch`, `operator_identity_untrusted` and `unlock_head_mismatch` are blocking for `live_write_commit`.
- Unknown status, unknown operator action, unknown identity trust state or missing required risk acknowledgement must fail closed.
- This list supplements FR-0062 blocking reasons; it does not remove broader taxonomy blockers.

## Downstream owner map

| Concern | Owning issue | Required disposition |
|---|---|---|
| Operator unlock contract | #1178 | Frozen by this contract |
| Default commit lock release | #1180 | Consumes `operator_unlock_ref`; remains active until separately released |
| Release gate matrix | #1211 | Consumes unlock status, audit refs and fail-closed reasons |
| Provider requirement disposition | #1179 | Supplies provider requirement ref for exact scope |
| Controlled live-write evidence | #835 / FR-0032 context | Supplies future current evidence only when rerun by downstream owner |

Consumers must not report `live_write_commit` as available unless an accepted current operator unlock record and every other downstream gate are valid for the exact scope.
