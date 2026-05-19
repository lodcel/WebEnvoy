# Companion Merge-Ready Surface

Use this file to summarize repo-specific merge-ready expectations without taking over host-owned merge controls.

WebEnvoy Phase 5 merge-ready authority:

- Loom merge-ready is the only authoritative final merge readiness verdict.
- WebEnvoy host scripts collect retained GitHub, guardian compatibility,
  metadata, live evidence, and integration signals, then consume the Loom
  merge-ready result.
- `scripts/merge-pr.sh` and `scripts/pr-guardian.sh` remain host adapters for
  controlled GitHub merge actions only; they do not independently aggregate
  final merge readiness.
- Legacy `verdict` / `safe_to_merge` fields may appear only as compatibility
  renderings or rollback-only ingestion. They must match the Loom review/spec
  records and must not become an independent merge blocker beside Loom
  merge-ready.
