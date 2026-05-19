# Companion Merge-Ready Surface

Use this file to summarize repo-specific merge-ready expectations without taking over host-owned merge controls.

WebEnvoy Phase 5 merge-ready authority:

- Loom merge-ready is the only authoritative final merge readiness verdict.
- WebEnvoy host scripts collect retained GitHub, guardian, metadata, live evidence, and integration signals, then consume the Loom merge-ready result.
- `scripts/merge-pr.sh` and `scripts/pr-guardian.sh` remain host adapters for controlled GitHub merge actions only; they do not independently aggregate final merge readiness.
