# FR-0035 Risks

Canonical Issue: #1133

## Risk: Existing exit code compatibility

If this FR renumbers FR-0001 exit codes, current shell consumers can misclassify failures.

Mitigation:

- Preserve `0` to `6`.
- Add only `7` to `9`.
- Require later implementation tests for exit code compatibility.

Rollback:

- Revert taxonomy implementation to FR-0001 mappings while keeping v1 stdout error shape intact.

## Risk: Over-broad runtime failure bucket

If all errors fall back to `ERR_EXECUTION_FAILED`, consumers cannot distinguish risk denial, provider readiness, closeout failure or evidence contract failure.

Mitigation:

- Freeze six primary families.
- Require primary error family to determine process exit code.
- Add explicit boundary rules and GWT scenarios.

Rollback:

- Keep broad v1 fallback for compatibility, but preserve v2 taxonomy fields for diagnosis.

## Risk: Integration scope creep

Because future adapters may consume WebEnvoy output, taxonomy could be mistaken for Syvert normalized result or provider shared contract.

Mitigation:

- Declare WebEnvoy-local ownership.
- Keep `contract_surface=none` and `merge_gate=local_only` for this PR.
- Explicitly exclude Syvert normalized result and provider adapter payloads.

Rollback:

- If future integration work needs shared taxonomy, create a separate integration-gated FR instead of expanding #1133.

## Risk: Evidence and closeout confusion

Schema/evidence failure and closeout failure can be conflated, causing closeout issues to close without valid evidence or block on the wrong owner.

Mitigation:

- Define schema/evidence failure as object/contract invalidity.
- Define closeout failure as evaluator/gate rejection after evidence consumption.
- Preserve PR live evidence metadata rules as separate from Command Envelope v2 `evidence`.

Rollback:

- Move ambiguous command-specific cases into related errors while keeping primary error tied to the earliest blocking owner.

## Risk: Retry loops

Incorrect `retryable=true` on risk, closeout or schema failures can cause repeated probing.

Mitigation:

- Default these families to non-retryable.
- Make runtime retryability diagnosis-dependent.
- Require future implementation tests.

Rollback:

- Clamp retryable to `false` for all non-provider failures until command-level diagnostics are trustworthy.
