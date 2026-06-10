# FR-0065 Data Model

FR-0065 does not introduce SQLite schema, migrations, persisted runtime tables or implementation storage. This document freezes the logical entities that downstream gates may consume when they implement manifest parsing, admission checks or release-gate behavior.

## 1. Profile manifest provider allowlist

Represents one profile-owned declaration of which providers may participate in live-write admission for an exact profile scope.

Fields:

- `manifest_id`
- `profile_ref`
- `profile_scope_ref`
- `manifest_version`
- `owner_ref`
- `head_sha`
- `allowed_providers`
- `secret_refs`
- `evidence_refs`
- `created_at`
- `expires_at`
- `revoked_at`

Constraints:

- `profile_ref` is a logical / opaque ref, never a raw profile path or account identifier.
- `allowed_providers` is required for `write_admit` and higher.
- `expires_at` is required.
- `revoked_at` invalidates the manifest when non-null.
- Manifest text is not a live evidence record or runtime readiness proof.

Lifecycle:

1. Profile owner produces or updates a manifest for a precise profile scope.
2. Downstream parser validates shape, refs and redaction state.
3. Admission evaluator consumes it before provider requirements or live-write gates.
4. Manifest expires, is revoked, or is invalidated by head/profile/provider/scope drift.

## 2. Allowed provider entry

Represents one provider that the profile manifest allows for a bounded workflow and target scope.

Fields:

- `provider_id`
- `provider_contract_ref`
- `provider_family`
- `provider_mode`
- `allowed_workflow_refs`
- `maximum_capability_level`
- `allowed_target_domains`
- `allowed_target_pages`
- `required_secret_kinds`
- `required_provider_requirement_ref`
- `minimum_verification_level`
- `risk_constraints`
- `evidence_refs`

Constraints:

- Provider fields consume FR-0033 vocabulary.
- Capability level consumes FR-0062 vocabulary.
- `maximum_capability_level` is a manifest bound, not commit authorization.
- `required_provider_requirement_ref` is a downstream locator and does not prove pass.
- Diagnostic-only providers cannot satisfy business write admission.

## 3. Profile manifest secret ref

Represents a redacted locator for a secret required by the profile/provider/workflow scope.

Fields:

- `secret_kind`
- `secret_ref`
- `locator_kind`
- `redaction_state`
- `scope_ref`
- `owner_ref`
- `expires_at`

Allowed `secret_kind`:

- `profile_storage_secret`
- `provider_auth_secret`
- `proxy_credential`
- `fingerprint_seed`
- `native_messaging_secret`
- `extension_private_payload`
- `account_auth_material`

Constraints:

- Raw values are forbidden.
- Secret-bearing kinds require `secret_handle` or redacted/private locator.
- `redaction_required`, `policy_missing` and `invalid` are blocking for required admission.
- Secret ref scope must match profile, provider, workflow and target.

## 4. Manifest evidence refs

Represents locator-only evidence that the manifest and secret refs are governed.

Fields:

- `manifest_source_ref`
- `provider_contract_refs`
- `secret_policy_ref`
- `redaction_policy_ref`
- `owner_attestation_ref`

Constraints:

- Evidence refs are locators only.
- Evidence refs cannot inline account identifiers, secrets, private profile paths, page content or live artifact payloads.
- Redaction evidence follows FR-0041 and #1181.

## 5. Allowlist evaluation input

Represents a downstream request to check whether a profile manifest allows a provider for an admission scope.

Fields:

- `requested_profile_ref`
- `requested_provider_id`
- `requested_provider_contract_ref`
- `requested_workflow_ref`
- `requested_capability_level`
- `requested_target_domain`
- `requested_target_page`
- `requested_required_secret_kinds`
- `requested_provider_requirement_ref`
- `requested_head_sha`
- `profile_manifest_provider_allowlist`
- `evaluated_at`

Constraints:

- `requested_capability_level` must use FR-0062 levels.
- `write_admit` or higher requires provider contract, workflow, target and secret-kind inputs.
- Missing manifest returns `profile_manifest_missing`.

## 6. Allowlist evaluation result

Represents the machine-consumable result.

Fields:

- `status`
- `decision`
- `blocking_reasons`
- `profile_manifest_ref`
- `provider_entry_ref`
- `secret_refs_consumed`
- `evidence_refs_consumed`
- `evaluated_at`
- `downstream_owner`

Constraints:

- `decision=allow` requires `status=accepted` and no blockers.
- Accepted result only clears profile manifest allowlist lane.
- Non-empty blockers force `deny` or `defer`.
- Downstream owners still supply provider requirements, account safety, operator unlock, default lock, target binding, anti-detection and live evidence.

## 7. Downstream handoff record

Represents what this FR gives to later owners.

Fields:

- `owner_issue_ref`
- `owner_role`
- `consumed_manifest_fields`
- `required_output_refs`
- `non_owner_actions`

Current owner records:

- `#1179`: consumes accepted manifest result and required secret refs; still owns provider requirement pass.
- `#1180`: consumes manifest result as one prerequisite; still owns default lock disposition.
- `#1211`: consumes allowlist status and blockers in release matrix.
- `runtime_owner`: implements parser/storage/evaluator if authorized by a later issue.

Constraints:

- Downstream ownership does not complete #1175 issue state by itself.
- This formal spec text is not a profile manifest instance.
- No local progress file becomes the project truth source.
