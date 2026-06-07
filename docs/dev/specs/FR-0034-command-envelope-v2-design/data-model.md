# FR-0034 Data Model

## Scope

FR-0034 does not introduce persistent storage or SQLite tables. Its data model is an in-memory / stdout command result model that future implementation issues may serialize.

The model exists because Command Envelope v2 is a stable machine-readable object with shared fields across commands.

## Core Entities

### CommandEnvelopeV2

Primary command result object.

Fields:

- `ok`: boolean command completion predicate.
- `command`: stable logical command identifier.
- `run_id`: single command invocation id.
- `data`: command business result object.
- `operational`: runtime, compatibility, diagnostic and limit context.
- `evidence`: evidence reference list.
- `warnings`: non-blocking warning list.
- `errors`: structured error list.

Lifecycle:

1. command context is created by CLI.
2. command handler returns business result, diagnostics, evidence refs, warnings and errors.
3. envelope formatter creates v2 object.
4. compatibility formatter may derive v1 output.
5. stdout emits one JSON object.

### OperationalV2

Runtime and diagnostic context for one command.

Fields:

- `compat`: v1 mapping information.
- `observability`: FR-0004 observation data.
- `diagnosis`: primary diagnostic index.
- `timestamps`: command timing fields; `completed_at` is required for v1-convertible output.
- `limits`: redaction, truncation, budget and partial observation disclosure.
- `runtime`: profile, tab, execution surface or browser channel hints where applicable.

Lifecycle:

- created during command execution.
- sanitized before output.
- not used as business result.

### EvidenceRefV2

Reference to evidence produced or consumed by the command.

Fields:

- `kind`
- `ref`
- `status`
- `produced_by_run_id`
- `collected_at`
- `summary`

Lifecycle:

- created when a command has artifact, log, route evidence or diagnostic evidence.
- remains a locator, not an inline artifact body.
- command-specific FRs may define additional evidence object schemas.

### WarningV2

Non-blocking command warning.

Fields:

- `code`
- `message`
- `severity`
- `related_evidence_ref`
- `related_limit_ref`

Lifecycle:

- created for partial observations, fallback paths, compatibility caveats or non-blocking degradation.
- does not affect `ok` unless the same condition is blocking.

### ErrorV2

Structured command error.

Fields:

- `code`
- `message`
- `retryable`
- `category`
- `diagnosis`
- `related_evidence_refs`

Lifecycle:

- created when command primary goal fails or a blocking condition appears.
- first array item is the primary error.
- converted to v1 `error` when compatibility output is required.

## Invariants

- `ok=true` means `errors=[]`.
- `ok=false` means `errors.length >= 1`.
- `data` is always an object.
- `operational` is always an object.
- `operational.timestamps.completed_at` is required whenever a v2 envelope claims v1 compatibility.
- `evidence`, `warnings` and `errors` are always arrays.
- `run_id` is command-level only.
- sensitive raw content is never a model field.
- v2 can be converted to v1 success/error shape without removing v1 required fields.

## Non-Persistent Boundary

FR-0034 does not add:

- SQLite tables.
- run history persistence.
- evidence artifact storage.
- profile metadata fields.
- browser state fields.

If later implementation persists v2 envelopes or evidence references, that persistence must be covered by a separate implementation or data-model FR.
