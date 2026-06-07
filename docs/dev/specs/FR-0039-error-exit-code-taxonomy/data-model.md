# FR-0039 Data Model

Canonical Issue: #1133

## Scope

This FR does not introduce persistent storage, SQLite tables, migrations, indexes or retention policies.

The data model is a non-persistent command-output taxonomy model used by CLI stdout, process exit status and Command Envelope v2 errors.

## Core Entities

### Error taxonomy entry

Responsibility: map one WebEnvoy-local error family to its canonical error code, FR-0034 category, exit code class and retryable default.

Fields:

- `family`: required stable enum.
- `canonical_code`: required stable `ERR_*` string.
- `category`: required FR-0034 `ErrorV2.category`.
- `exit_code`: required process exit code class.
- `retryable_default`: required boolean or diagnosis-dependent marker.

Lifecycle:

- Frozen by this FR.
- Consumed by later implementation work.
- Extended only through future spec PRs when new stable families or classes are needed.

### ErrorV2WithTaxonomy

Responsibility: add taxonomy identity to FR-0034 `ErrorV2` without breaking v1 conversion.

Fields:

- FR-0034 `ErrorV2` fields.
- `family`: required after taxonomy implementation.
- `exit_code`: required after taxonomy implementation.

Lifecycle:

- Produced per command run.
- Not persisted by this FR.
- Converted to current v1 `error` by using `code`, `message` and `retryable`.

### Exit code class

Responsibility: represent process-level command outcome for shell consumers.

Fields:

- Integer code.
- Stable class name.
- Primary error families.

Lifecycle:

- Process-scoped.
- Determined by `errors[0]` for failed command execution.
- Not stored by this FR.

## Non-Entities

The following are not data entities in this FR:

- Syvert normalized result.
- Provider adapter payload.
- GitHub PR live evidence metadata.
- SQLite run record.
- Account/profile/session state.
- Command-specific `data` payload.

## Compatibility

- Existing v1 stdout error shape remains valid.
- Existing exit codes `0` to `6` retain their current meanings.
- New exit codes `7` to `9` are additive and require later implementation work before runtime use.
