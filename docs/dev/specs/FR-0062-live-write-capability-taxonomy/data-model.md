# FR-0062 Data Model

FR-0062 does not introduce SQLite schema, migrations or persisted runtime tables. This document freezes the logical entities that downstream gates may consume when they implement parser or release-gate behavior.

## 1. Capability level

Represents the taxonomy enum value.

Fields:

- `level`: one of `read_only`, `write_admit`, `write_prepare`, `live_write_commit`.
- `rank`: ordered rank from 0 to 3.
- `external_write_visibility`: `none` for the first three levels, `possible` for `live_write_commit`.
- `default_disposition`: `allow_read_only`, `require_admission`, `require_preparation_gate`, or `locked`.
- `owner_ref`: `#1174` for taxonomy definition; downstream issue refs for gate fulfillment.

Constraints:

- Unknown level is invalid.
- `live_write_commit.default_disposition` is always `locked`.
- Rank comparison is only used to prevent escalation; it does not grant allow decisions.

## 2. Gate request

Represents a downstream request to classify capability level.

Fields:

- `requested_capability_level`
- `maximum_capability_level`
- `minimum_required_level`
- `workflow_ref`
- `target_scope_ref`
- `provider_requirement_ref`
- `operator_unlock_ref`
- `default_commit_lock_ref`
- `account_safety_ref`
- `runtime_target_binding_ref`
- `anti_detection_gate_ref`
- `live_evidence_gate_ref`
- `evidence_refs`

Constraints:

- Write levels require non-empty `workflow_ref` and `target_scope_ref`.
- `write_admit` and higher require a provider requirement ref.
- `live_write_commit` requires all commit refs; missing refs produce blocking reasons.
- Evidence refs are locators and must follow FR-0041 redaction rules if they ever point to artifacts.

Lifecycle:

1. Downstream owner builds the request from its current scope.
2. Taxonomy parser validates level names and required refs.
3. Downstream gate consumes the classification result and adds its own evidence.

## 3. Gate result

Represents the taxonomy classification output.

Fields:

- `requested_capability_level`
- `effective_capability_level`
- `gate_status`
- `decision`
- `blocking_reasons`
- `downstream_owner`
- `evidence_refs_consumed`
- `verified_at`

Constraints:

- Non-empty `blocking_reasons` means `decision` cannot be `allow`.
- `effective_capability_level` cannot exceed `maximum_capability_level`.
- `live_write_commit` with active default lock must return `gate_status=locked`.
- `verified_at=N/A` is only valid in formal samples.

Lifecycle:

1. Formal spec sample may use `verified_at=N/A`.
2. Implementation gate must record concrete time and current evidence refs.
3. Release closeout consumes the current result but cannot treat FR-0062 text as evidence.

## 4. Downstream ownership record

Represents a handoff requirement.

Fields:

- `owner_issue_ref`
- `owner_role`
- `consumed_taxonomy_terms`
- `required_output_refs`
- `non_owner_actions`

Current owner records:

- `#1178`: operator unlock; outputs operator unlock evidence for `live_write_commit`.
- `#1179`: provider requirements; outputs `xhs.creator_publish.admit` requirement disposition.
- `#1180`: default commit lock; outputs lock status and scope.
- `#1211`: release gate matrix; consumes all levels and blocking reasons.

Constraints:

- Downstream ownership does not complete #1174 issue state.
- FR-0062 cannot satisfy downstream output refs by itself.
- #835 is not a downstream owner of this taxonomy; it remains related historical baseline / controlled success owner.
