# Execution Attempt Envelope

`execution_attempt` is runtime evidence for one Loom command attempt. It records the consumed Work Item, workspace binding, command result, failure category, fallback target, and evidence locator.

It is not authored progress. Envelopes must not carry `current_stop`, `next_step`, `blockers`, `latest_validation_summary`, `current_checkpoint`, `current_lane`, `recovery_boundary`, or `closing_condition`; those stay in the fact chain and recovery/status carriers.

## Contract

- `schema_version`: `loom-execution-attempt/v1`.
- `attempt_id`: unique attempt identifier.
- `item_id`: active Work Item id.
- `command`: command surface, such as `flow`.
- `operation`: operation name, such as `resume`, `review`, or `merge-ready`.
- `result`: `pass`, `block`, or `fallback`.
- `created_at`: UTC timestamp.
- `head_sha`: current git HEAD, or `unknown-head`.
- `workspace`: read-only `{entry, path}`.
- `failure`: `{category, execution_classification, execution_summary, missing_inputs, fallback_to}`.
- `evidence`: `{locator, status}`.

Status may display a latest attempt only as fresh when the envelope is valid, item-bound, HEAD-bound, and free of authored progress fields. Missing or stale evidence must be reported as missing or stale instead of becoming execution truth.

`failure.execution_classification` is reserved for runtime evidence such as `stall`, `timeout`, or `retry_exhaustion`. It stays provider-neutral and does not create scheduler ownership.
Retry evidence comes from the persisted attempt chain under `.loom/runtime/attempts/<item-id>/`, not from a separate scheduler state record.
