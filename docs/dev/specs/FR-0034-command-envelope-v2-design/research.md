# FR-0034 Research Notes

## Inputs Reviewed

- #1131 Command Envelope v2 Design
- #1112 Command Envelope Compatibility
- `vision.md`
- `docs/dev/roadmap.md`
- `docs/dev/architecture/system-design.md`
- `docs/dev/architecture/system-design/boundary.md`
- `docs/dev/architecture/system-design/error-handling.md`
- `docs/dev/specs/FR-0001-runtime-cli-entry/spec.md`
- `docs/dev/specs/FR-0004-runtime-observability/spec.md`
- current source references for `status`, `summary`, `observability`, `error.diagnosis`, `run_id`

## Findings

### 1. Current v1 output is already a consumer contract

FR-0001 freezes v1 stdout fields and exit codes. FR-0004 extends v1 with observation and diagnosis while explicitly preserving the FR-0001 outer shell.

Conclusion:

- v2 must be introduced as a compatibility layer or explicit mode.
- current v1 default output cannot be removed or reshaped by this design PR.

### 2. `summary` is overloaded

Current implementation and specs use `summary` as the v1 business result carrier, while some closeout/runtime commands may also place operational-style information in or near summary fields.

Conclusion:

- v2 should split business result into `data`.
- ambiguous v1 summary content can be preserved under `operational.compat.v1_summary` during migration.

### 3. `observability` and `error.diagnosis` are operational, not business data

FR-0004 already defines page state, key requests, failure site, diagnosis evidence, sanitization and clipping. These belong to diagnostics rather than command business result.

Conclusion:

- v2 maps `observability` into `operational.observability`.
- v2 maps `error.diagnosis` into `errors[0].diagnosis`, with optional `operational.diagnosis` indexing.

### 4. Evidence must stay reference-based

Existing live evidence governance and closeout rules require latest-head evidence to be explicitly bound to run ids, artifacts and PR metadata. A generic command envelope cannot replace those gates.

Conclusion:

- v2 `evidence` is an evidence reference list.
- it must not inline sensitive artifacts or pretend to satisfy live evidence PR gates.

### 5. M1 boundary keeps this WebEnvoy-local

The boundary document allows WebEnvoy to expose stable structured results, errors, diagnostics and evidence indexes. It also says Syvert normalized mapping remains outside WebEnvoy core.

Conclusion:

- this FR remains `local_only`.
- no Syvert normalized schema or provider adapter contract is introduced.

### 6. v1 compatibility requires a non-optional completed timestamp

FR-0001 requires `timestamp` in both success and error outputs. If v2 claims loss-minimized conversion back to v1, the v2 contract must provide a stable source for that timestamp.

Conclusion:

- `operational.timestamps.completed_at` is required for every v1-convertible v2 envelope.
- v2 outputs that omit `completed_at` must not be treated as satisfying current v1 compatibility.

## Design Decision

Freeze a v2 envelope that is additive and convertible:

- `ok` replaces `status` only inside v2.
- `data` separates business result from operational context.
- `operational` collects diagnostics, runtime hints, compatibility and limits.
- `evidence` is reference-based.
- `warnings` are non-blocking.
- `errors` are structured and array-based, with `errors[0]` as the primary v1-compatible error.

## Open Items for Later Issues

- #1133: command-specific `data` / v1 `summary` migration.
- #1134: `operational` / `observability` / `diagnosis` implementation details.
- #1135: evidence / warning / error list implementation and tests.
- #1136: compatibility gate, migration tests and closeout.
