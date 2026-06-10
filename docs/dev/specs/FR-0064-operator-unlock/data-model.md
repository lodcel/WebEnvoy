# FR-0064 Data Model

FR-0064 does not introduce SQLite schema, migrations, persisted runtime tables or implementation storage. This document freezes the logical entities that downstream gates may consume when they implement parser, audit or release-gate behavior.

## 1. Operator unlock record

Represents the explicit operator action for one exact `live_write_commit` scope.

Fields:

- `unlock_id`
- `capability_level`
- `workflow_ref`
- `provider_requirement_ref`
- `default_commit_lock_ref`
- `target_domain`
- `target_page`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `operator_ref`
- `operator_action`
- `operator_intent`
- `acknowledged_risks`
- `head_sha`
- `unlock_reason_ref`
- `evidence_refs`
- `created_at`
- `expires_at`
- `revoked_at`

Constraints:

- `capability_level` is always `live_write_commit`.
- `operator_action` is always `unlock_live_write_commit`.
- `expires_at` is required.
- `revoked_at` invalidates the record when non-null.
- All scope fields must match the downstream commit request exactly.

Lifecycle:

1. Downstream implementation requests unlock for a precise scope.
2. Operator explicitly acknowledges required risks.
3. Audit refs are recorded as locators.
4. Downstream gate evaluates the record before any commit request.
5. Record expires, is revoked, or is invalidated by scope/head drift.

## 2. Operator identity reference

Represents the auditable operator identity locator.

Fields:

- `operator_ref`
- `identity_provider_ref`
- `trust_state`
- `checked_at`

Allowed `trust_state`:

- `trusted`
- `untrusted`
- `unknown`

Constraints:

- `trusted` is required before unlock acceptance.
- `unknown` and `untrusted` are blocking.
- Natural language names, chat messages or local-only memory are not valid identity refs.

## 3. Scope snapshot

Represents the exact scope being unlocked.

Fields:

- `workflow_ref`
- `provider_requirement_ref`
- `default_commit_lock_ref`
- `target_domain`
- `target_page`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `head_sha`

Constraints:

- Scope snapshot must be generated before unlock evaluation.
- Any mismatch between snapshot and commit request returns `operator_unlock_scope_mismatch` or `unlock_head_mismatch`.
- Scope snapshot is not live evidence and must not be reported as publish success.

## 4. Risk acknowledgement

Represents operator acknowledgement of external-visible write risk.

Required values:

- `external_visible_write`
- `account_safety_required`
- `cleanup_or_residual_required`
- `default_commit_lock_release_required`
- `latest_head_live_evidence_required`

Constraints:

- Missing any required value returns `risk_ack_missing`.
- Acknowledgement does not prove the corresponding gate passed.
- Acknowledgement must be linked to the same scope snapshot.

## 5. Unlock evaluation result

Represents the machine-consumable outcome.

Fields:

- `status`
- `decision`
- `blocking_reasons`
- `operator_unlock_ref`
- `evidence_refs_consumed`
- `evaluated_at`
- `downstream_owner`

Constraints:

- `decision=allow` requires `status=accepted` and no blockers.
- Non-empty blockers force `deny` or `defer`.
- Accepted unlock only clears operator unlock lane; it cannot release default lock or replace live evidence.

Lifecycle:

1. Evaluator receives a `live_write_commit` request.
2. It loads the current unlock record locator.
3. It validates identity, scope, head, expiry, revocation, risk acknowledgement and evidence refs.
4. It emits result for #1180 / #1211 or runtime owner consumption.

## 6. Downstream handoff record

Represents what this FR gives to later owners.

Fields:

- `owner_issue_ref`
- `owner_role`
- `consumed_unlock_fields`
- `required_output_refs`
- `non_owner_actions`

Current owner records:

- `#1180`: consumes accepted unlock state and still owns default lock release.
- `#1211`: consumes unlock state, audit refs and blockers for release matrix.
- `#1179`: supplies provider requirement disposition ref.
- `FR-0032 / #835`: remains historical controlled-success context and does not supply current unlock evidence.

Constraints:

- Downstream ownership does not complete #1178 issue state by itself.
- This formal spec text is not an unlock record.
- No local progress file becomes the project truth source.
