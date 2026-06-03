# CI Required Checks Bootstrap

Canonical contract: `plugins/loom/skills/shared/references/adoption/ci-required-checks-bootstrap.md`.

Installed summary:

- Stable check names are `py-compile`, `demo-bootstrap`, `repo-local-cli`, and `loom-check`.
- Workflow presence, check runs, required checks, and host enforcement are separate facts.
- A local workflow or local gate starter does not prove host enforcement.
- Host read failures must remain `unverified` or `host_unavailable`.
