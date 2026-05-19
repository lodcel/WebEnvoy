# Companion Review Surface

Use this file to attach repo-specific review requirements while keeping the
repository's existing root rules authoritative as instructions.

## Phase 7 Review Authority Model

- Loom review records are the semantic implementation review authority.
- Loom spec review records are the semantic formal spec review authority.
- WebEnvoy `code_review.md` and `spec_review.md` remain repo-owned instruction
  authorities consumed by those Loom records.
- `scripts/pr-guardian.sh` may render a WebEnvoy-compatible PR review body,
  normalize native review text, and maintain local proof cache for human review
  reuse. Those outputs are compatibility and retained host evidence only.
- `scripts/pr-review-result.schema.json` is a compatibility renderer schema,
  not native review schema authority.

Fail closed when the Loom review or spec review record is missing, stale,
malformed, contradicts the compatibility rendering, or is unavailable.
