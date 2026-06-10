# FR-0066 Data Model

FR-0066 does not introduce SQLite schema, migrations, persisted runtime tables or implementation storage. This document freezes the logical entities that downstream gates may consume when they implement parser, runtime admission or release-gate behavior.

## 1. Account safety scope

Represents the exact workflow, target and profile boundary for an account safety evaluation.

Fields:

- `capability_level`
- `workflow_ref`
- `target_domain`
- `target_page`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `provider_requirement_ref`
- `runtime_target_binding_ref`
- `operator_unlock_ref`
- `head_sha`
- `run_id`
- `evaluation_context_ref`

Constraints:

- `write_prepare` and `live_write_commit` require exact scope match.
- `operator_unlock_ref` is required only for `live_write_commit`.
- Scope snapshot is not account safety proof by itself.
- Scope drift invalidates prior clear results.

Lifecycle:

1. Downstream owner constructs requested scope.
2. Account safety evaluator loads matching state record.
3. Scope fields are compared against requested capability and current head/run.
4. Any mismatch returns a blocking result.

## 2. Account safety state record

Represents one safety classification for one exact scope.

Fields:

- `safety_state_id`
- `canonical_issue_ref`
- `scope`
- `state`
- `signal_classes`
- `evidence_refs`
- `checked_at`
- `expires_at`
- `redaction_state`

Allowed `state`:

- `clear`
- `unknown`
- `blocked`
- `stale`
- `redaction_invalid`
- `requires_operator_attention`

Constraints:

- `state=clear` requires empty signal classes, fresh evidence and valid redaction.
- `checked_at` and `expires_at` are required for real evaluations.
- `redaction_state=redaction_required|policy_missing|invalid` blocks clear.
- Historical records are background only unless freshness and scope are current.

Lifecycle:

1. Runtime or downstream owner collects account safety signals within allowed non-write boundaries.
2. Evidence refs are redacted and bound to current scope.
3. Evaluator emits a state record.
4. Downstream gates consume the state until expiry or scope drift.
5. New head/run/profile/target requires a new evaluation.

## 3. Safety signal

Represents an account-affine risk signal.

Fields:

- `signal_class`
- `source_ref`
- `severity`
- `observed_at`
- `redaction_state`

Allowed `severity`:

- `info`
- `warning`
- `blocking`

Constraints:

- Blocking signals prevent `state=clear`.
- `requires_operator_attention` signals must stop before live/account/write probing.
- Signal source refs are locators; raw page text, raw account identifiers and raw secrets are forbidden.

## 4. Evidence refs

Represents the redacted locators consumed by the account safety gate.

Fields:

- `safety_check_ref`
- `profile_ref`
- `runtime_status_ref`
- `target_binding_ref`
- `signal_scan_ref`
- `redaction_policy_ref`
- `freshness_ref`
- `risk_disposition_ref`
- optional `operator_unlock_ref`
- optional `default_commit_lock_ref`
- optional `live_evidence_gate_ref`

Constraints:

- Refs must consume `FR-0041` and #1181 redaction expectations.
- Refs must not inline account identifiers, cookie, token, profile path, browser path, private URL, page content, media content or secret values.
- Missing, partial, unavailable, stale or redaction-invalid required refs fail closed.

## 5. Account safety gate result

Represents the machine-consumable outcome for downstream admission.

Fields:

- `gate_status`
- `decision`
- `blocking_reasons`
- `account_safety_ref`
- `evidence_refs_consumed`
- `evaluated_at`
- `downstream_owner`

Constraints:

- `decision=allow` requires `gate_status=clear` and no blockers.
- Non-empty blockers force `deny` or `defer`.
- `allow` only clears account safety lane; it does not release default lock, operator unlock, provider requirement, target binding, anti-detection or live evidence gates.

Lifecycle:

1. Evaluator receives a `write_prepare` or `live_write_commit` request.
2. It loads the matching account safety state record.
3. It validates scope, freshness, redaction, signals and evidence refs.
4. It emits result for #1179 / #1180 / #1211 or runtime owner consumption.

## 6. Downstream handoff record

Represents what this FR gives to later owners.

Fields:

- `owner_issue_ref`
- `owner_role`
- `consumed_safety_fields`
- `required_output_refs`
- `non_owner_actions`

Current owner records:

- `#1179`: consumes account safety result for provider requirement disposition.
- `#1180`: requires account safety clear before default lock release can be considered.
- `#1211`: consumes safety status and blockers for gate matrix.
- `#1178`: may reference account safety ref but does not create it.
- `FR-0032 / #835`: remains historical controlled-success context and does not supply current safety evidence.

Constraints:

- Downstream ownership does not complete account safety evaluation by itself.
- This formal spec text is not a safety clear record.
- No local progress file becomes the project truth source.
