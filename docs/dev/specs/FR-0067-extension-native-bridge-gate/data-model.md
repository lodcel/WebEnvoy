# FR-0067 Data Model

FR-0067 does not introduce SQLite schema, migrations, persisted runtime tables or implementation storage. This document freezes the logical entities that downstream gates may consume when they implement parser, runtime admission or release-gate behavior.

## 1. Extension/native bridge scope

Represents the exact workflow, provider, profile, extension and native host boundary for a bridge readiness evaluation.

Fields:

- `capability_level`
- `workflow_ref`
- `target_domain`
- `target_page`
- `provider_id`
- `provider_contract_version`
- `profile_ref`
- `browser_channel`
- `execution_surface`
- `extension_identity_ref`
- `native_host_identity_ref`
- `provider_doctor_report_ref`
- `extension_smoke_ref`
- `native_bridge_readiness_ref`
- `head_sha`
- `run_id`
- `evaluation_context_ref`

Constraints:

- `write_prepare` and `live_write_commit` require exact scope match.
- Scope snapshot is not bridge readiness proof by itself.
- Provider, profile, extension, native host, head or run drift invalidates prior ready results.
- `execution_surface=real_browser` is necessary for real evaluations but not sufficient.

Lifecycle:

1. Downstream owner constructs requested scope.
2. Extension/native bridge evaluator loads matching state record.
3. Scope fields are compared against requested capability and current head/run.
4. Any mismatch returns a blocking result.

## 2. Extension/native bridge state record

Represents one readiness classification for one exact scope.

Fields:

- `bridge_state_id`
- `canonical_issue_ref`
- `scope`
- `state`
- `evidence_refs`
- `checked_at`
- `expires_at`
- `redaction_state`
- `extension_smoke_status`
- `native_bridge_status`

Allowed `state`:

- `ready`
- `unknown`
- `blocked`
- `stale`
- `redaction_invalid`
- `requires_recovery`

Constraints:

- `state=ready` requires current extension smoke, current native bridge readiness, fresh evidence and valid redaction.
- `checked_at` and `expires_at` are required for real evaluations.
- `redaction_state=redaction_required|policy_missing|invalid` blocks ready.
- Historical records are background only unless freshness and scope are current.

Lifecycle:

1. Runtime or downstream owner collects allowed non-write extension smoke and bridge preflight signals.
2. Evidence refs are redacted and bound to current scope.
3. Evaluator emits a state record.
4. Downstream gates consume the state until expiry or scope drift.
5. New head/run/provider/profile/extension/native host requires a new evaluation.

## 3. Extension smoke signal

Represents a non-business extension readiness signal.

Fields:

- `extension_smoke_ref`
- `extension_identity_health_ref`
- `service_worker_freshness_ref`
- `extension_context_status`
- `message_preflight_status`
- `observed_at`
- `redaction_state`

Constraints:

- Smoke signal must not execute page writes, uploads, submissions, publishes, account state changes or cleanup.
- `FR-0045` and `FR-0047` health refs must be current and pass-compatible.
- Runtime ping, bootstrap ack, service worker wake signal, descriptor ref or historical artifact cannot satisfy smoke by itself.

## 4. Native bridge signal

Represents Native Messaging bridge preflight readiness.

Fields:

- `native_messaging_health_ref`
- `native_bridge_handshake_ref`
- `native_host_identity_ref`
- `allowed_origins_ref`
- `socket_or_transport_ref`
- `bridge_handshake_status`
- `observed_at`
- `redaction_state`

Constraints:

- `FR-0046` required health checks must be current and pass-compatible.
- Recoverable Native Messaging states do not satisfy readiness until fresh recovery evidence is produced.
- Stub/fake host, wrong extension origin, wrong provider id, non-official execution surface, historical artifact or unowned stale process fails closed.

## 5. Evidence refs

Represents the redacted locators consumed by the bridge gate.

Fields:

- `kind`
- `ref`
- `source_owner`
- `collected_at`
- `head_sha`
- `run_id`
- `freshness_scope`
- `redaction_state`

Grouped refs:

- `provider_doctor_report_ref`
- `extension_identity_health_ref`
- `service_worker_freshness_ref`
- `native_messaging_health_ref`
- `extension_smoke_ref`
- `native_bridge_handshake_ref`
- `profile_ref`
- `redaction_policy_ref`
- `freshness_ref`
- `risk_disposition_ref`
- optional downstream refs such as `operator_unlock_ref`, `default_commit_lock_ref`, `provider_requirement_ref`, `account_safety_ref`, `runtime_target_binding_ref`, `live_evidence_gate_ref`

Constraints:

- Refs must consume `FR-0041` redaction expectations.
- Refs must not inline account identifiers, cookie, token, profile path, browser path, manifest body, socket path, extension source, private payload, private URL, page content, media content or secret values.
- Each ref must bind owner and freshness metadata so consumers can reject unowned, stale, historical, wrong-head or wrong-run evidence.
- Missing, partial, unavailable, stale or redaction-invalid required refs fail closed.

## 6. Gate result

Represents the machine-consumable outcome for downstream admission.

Fields:

- `gate_status`
- `decision`
- `blocking_reasons`
- `extension_native_bridge_ref`
- `evidence_refs_consumed`
- `evaluated_at`
- `downstream_owner`

Constraints:

- `decision=allow` requires `gate_status=ready` and no blockers.
- Non-empty blockers force `deny` or `defer`.
- `allow` only clears extension/native bridge lane; it does not release default lock, operator unlock, provider requirement, account safety, target binding, anti-detection or live evidence gates.

Lifecycle:

1. Evaluator receives a `write_prepare` or `live_write_commit` request.
2. It loads the matching bridge state record.
3. It validates scope, freshness, redaction, extension smoke, native bridge readiness and evidence refs.
4. It emits result for #1179 / #1180 / #1211 or runtime owner consumption.

## 7. Downstream handoff record

Represents what this FR gives to later owners.

Fields:

- `owner_issue_ref`
- `owner_role`
- `consumed_bridge_fields`
- `required_output_refs`
- `non_owner_actions`

Current owner records:

- `#1179`: consumes extension/native bridge gate result for provider requirement disposition.
- `#1180`: requires extension/native bridge ready before default lock release can be considered.
- `#1211`: consumes bridge states and blocking reasons for the live-write gate matrix.
- `#1178`: may reference bridge readiness but does not create it.
- `FR-0032 / #835`: remains historical controlled-success context and does not supply current bridge readiness.

Constraints:

- Downstream ownership does not complete bridge evaluation by itself.
- This formal spec text is not a bridge ready record.
- No local progress file becomes the project truth source.
