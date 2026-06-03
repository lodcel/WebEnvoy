# Repo-Local Gate Starter

Canonical contract: `plugins/loom/skills/shared/references/harness/repo-local-gate-starter.md`.

Installed summary:

- Loom exposes local starter aliases for `verify`, `status`, `merge-ready`, `closeout-check`, and `reconciliation-audit`.
- These aliases point at existing `.loom/bin/loom_*` runtime entries.
- They are always `authority: local`, `enforcement: advisory`, and `host_enforcement: false`.
- Host-enforced controls must be proven separately by GitHub/CI/ruleset reads.
