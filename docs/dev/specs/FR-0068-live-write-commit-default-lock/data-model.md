# FR-0068 Data Model

FR-0068 does not introduce SQLite schema, migrations, persisted runtime tables or implementation storage. This document freezes logical entities that downstream gates may consume when they implement parser, runtime admission or release-gate behavior.

## 1. Default lock scope

Represents the exact workflow, provider, profile, target, runtime and evidence boundary for a `live_write_commit` default lock evaluation.

Fields:

- `capability_level`
- `workflow_ref`
- `provider_requirement_ref`
- `profile_manifest_allowlist_ref`
- `extension_native_bridge_ref`
- `account_safety_ref`
- `runtime_target_binding_ref`
- `anti_detection_gate_ref`
- `operator_unlock_ref`
- `live_evidence_gate_ref`
- `target_domain`
- `target_page`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `head_sha`
- `run_id`
- `evaluated_at`

Constraints:

- `capability_level` is always `live_write_commit`.
- Scope snapshot is not unlock proof by itself.
- Workflow, provider, profile, target, runtime, operator, evidence, head or run drift invalidates prior release disposition.
- `execution_surface=real_browser` is necessary for real commit evaluation but not sufficient.

Lifecycle:

1. Downstream owner constructs requested commit scope.
2. Default lock evaluator loads a matching lock record.
3. Scope fields are compared against requested capability and current head/run.
4. Any mismatch returns a blocking result.

## 2. Default lock record

Represents one default lock classification or release disposition for one exact scope.

Fields:

- `lock_record_id`
- `canonical_issue_ref`
- `scope`
- `state`
- `evidence_refs`
- `checked_at`
- `expires_at`
- `revoked_at`
- `redaction_state`
- `non_proofs`

Allowed `state`:

- `locked`
- `release_not_requested`
- `release_blocked`
- `release_deferred`
- `release_ready_for_downstream_gate`
- `release_revoked`
- `release_expired`
- `redaction_invalid`

Constraints:

- Initial state is `locked`.
- `state=release_ready_for_downstream_gate` requires all required refs current, exact-scope, redacted and not revoked/expired.
- `checked_at` and `expires_at` are required for real evaluations.
- `revoked_at` invalidates the record.
- `redaction_state=redaction_required|policy_missing|invalid` blocks release.
- Historical records are background only unless freshness and scope are current.

Lifecycle:

1. Default lock owner receives a release request from a downstream workflow.
2. Required precondition refs are validated for owner, scope, freshness and redaction.
3. Evaluator emits or updates the lock record.
4. Downstream commit gate reconsumes the lock record and all referenced evidence.
5. Expiry, revocation or drift returns the record to non-ready status.

## 3. Required precondition refs

Represents the minimum evidence locators required before default lock release can be considered.

Grouped refs:

- `provider_requirement_ref`
- `profile_manifest_allowlist_ref`
- `extension_native_bridge_ref`
- `account_safety_ref`
- `runtime_target_binding_ref`
- `anti_detection_gate_ref`
- `operator_unlock_ref`
- `live_evidence_gate_ref`
- `freshness_ref`
- `redaction_policy_ref`

Constraints:

- Refs must consume the source owner contracts rather than inline private evidence.
- Refs must not expose account identifiers, cookies, tokens, profile paths, browser paths, private URLs, page content, media content, raw manifests or live artifact payloads.
- Each ref must bind source owner, collected time, head, run, freshness and redaction state.
- Missing, partial, unavailable, stale, wrong-scope or redaction-invalid required refs fail closed.
- #1211 / release gate owner may produce a downstream `risk_disposition_ref` after consuming FR-0068 and its refs. That downstream ref is final-gate evidence, not a required FR-0068 precondition.

## 4. Non-proof record

Represents evidence-like signals that were rejected for default lock release.

Examples:

- issue closed state
- spec text
- PR merge or review approval
- hosted checks pass
- guardian approval
- #835 closed state
- `xhs.creator_publish.admit` pass
- runtime ping
- runtime bootstrap ack
- service worker wake signal
- descriptor ref
- doctor pass
- stub/fake host
- historical artifact
- control-plane-only signal

Constraints:

- Non-proofs can appear in diagnostics as rejected inputs.
- Non-proofs cannot be promoted into release evidence.
- `xhs.creator_publish.admit` remains `write_admit`; it cannot authorize `live_write_commit`.

## 5. Default lock result

Represents the machine-consumable default lock lane outcome.

Fields:

- `gate_status`
- `decision`
- `blocking_reasons`
- `default_lock_ref`
- `evidence_refs_consumed`
- `downstream_reconsumption_required`
- `evaluated_at`
- `downstream_owner`

Constraints:

- `decision=allow` requires `gate_status=release_ready_for_downstream_gate`, no blockers, current refs and downstream re-consumption declaration.
- Non-empty blockers force `deny` or `defer`.
- `allow` only clears default lock lane; it does not execute live write, accept live evidence or pass release gate.

Lifecycle:

1. Evaluator receives a `live_write_commit` request.
2. It validates lock record, required refs, freshness, redaction, scope and downstream re-consumption declaration.
3. It emits result for #1211 / runtime owner / release gate owner consumption.
4. Downstream gate must reconsume current exact-scope refs before any final commit decision.

## 6. Downstream re-consumption record

Represents what the downstream owner must prove after default lock lane is ready.

Fields:

- `consumer_owner`
- `consumed_default_lock_ref`
- `consumed_evidence_refs`
- `scope_match_status`
- `freshness_status`
- `redaction_status`
- `revocation_status`
- `decision`

Constraints:

- Missing re-consumption declaration blocks final commit.
- Re-consumption must happen on current head/run/profile/target/workflow.
- Re-consumption cannot reuse old release disposition after expiry, revocation or drift.

## 7. Rollback / no-op model

Because FR-0068 is formal-spec only:

- Rollback is a revert PR deleting the FR-0068 suite and removing the #1180 sync-map entry.
- No runtime cleanup, profile cleanup, account cleanup, artifact cleanup, external rollback or live evidence invalidation is required.
- Any future implementation must preserve fail-closed no-op behavior when release preconditions are absent.
