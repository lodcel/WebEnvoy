# FR-0035 Research Notes

Canonical Issue: #1133

## Research Questions

1. Which prior formal contracts constrain #1133 taxonomy?
2. Can #1133 remain WebEnvoy-local despite future adapter consumption?
3. Which exit code classes can be added without breaking FR-0001 consumers?

## Inputs Reviewed

- FR-0034 Command Envelope v2 Design.
- FR-0034 `contracts/command-envelope-v2.md`.
- FR-0001 CLI minimum entry and integration contract.
- FR-0004 runtime observability and structured diagnosis contract.
- `docs/dev/architecture/system-design/error-handling.md`.
- GitHub issue #1133 body and labels.

## Conclusions

### FR-0034 is the direct anchor

FR-0034 already freezes `errors[*]` with `code`, `message`, `retryable` and `category`, plus v1 conversion requirements. #1133 should extend that error shape with taxonomy fields instead of creating a competing envelope.

Impact:

- This FR adds `family` and `exit_code` to future v2 errors.
- This FR keeps FR-0034 `category` unchanged.

### FR-0001 exit codes must not be renumbered

FR-0001 freezes:

- `0`: success
- `2`: parameter error
- `3`: unknown command
- `4`: registered but not implemented
- `5`: runtime unavailable
- `6`: execution failed

Impact:

- #1133 preserves `0` to `6`.
- #1133 adds `7` to `9` for risk gate denied, closeout failure and schema/evidence failure.
- Provider unavailable uses exit `5` because it is a more precise class of pre-execution runtime/provider unavailability.

### Local-only metadata is valid

Issue #1133 is labeled `integration:local-only` and does not define Syvert provider/shared-contract output. The taxonomy may be adapter-consumable in future, but this PR does not change cross-repository shared contracts.

Impact:

- PR integration metadata should remain `integration_applicable=no`.
- `contract_surface=none` is valid for this spec PR because it does not alter integration shared surfaces.

## Remaining Questions

- Exact command-level subcodes should be defined by later implementation or command-specific specs.
- Whether v1 stdout should include `family` or `exit_code` is an implementation decision for a later compatibility PR; this FR only requires v2 errors to carry them once implemented.
- The exact parser implementation for PR body metadata is outside this FR.
