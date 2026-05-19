# WebEnvoy Repo Companion

This companion entry attaches Loom to WebEnvoy's existing governance surface.
It is a locator and orchestration boundary, not a second project truth source.

## Preserved Ownership

- WebEnvoy root rules remain in `AGENTS.md`.
- WebEnvoy development workflow rules remain in `docs/dev/AGENTS.md`.
- Implementation review instructions remain in `code_review.md`.
- Formal spec review instructions remain in `spec_review.md`.
- GitHub Issues and Projects remain the progress and backlog truth.
- WebEnvoy live evidence and integration gates remain repo-owned gates.
- Retained host actions stay host-owned.

## Loom Entry Surfaces

- Review surface: `.loom/companion/review.md`
- Merge-ready surface: `.loom/companion/merge-ready.md`
- Closeout surface: `.loom/companion/closeout.md`
- Checkpoints surface: `.loom/companion/checkpoints.md`
- Handoff/resume recovery entry: `.loom/progress/<issue>.md`
- Active status surface: `.loom/status/current.md`
- Machine-readable repo interface: `.loom/companion/repo-interface.json`
- Read-only interop contract: `.loom/companion/interop.json`

## Recovery Boundary

Loom handoff/resume may author the active recovery entry and derived status
surface for the current work item. Those carriers store execution recovery
state only: checkpoint, stop, blockers, validation summary, authority-record
locators, and next step. They do not create a second backlog, sprint, project
status, issue state, review verdict, spec verdict, merge-ready verdict, or host
merge action.

GitHub Issues and Projects remain the progress and backlog truth. WebEnvoy PR
descriptions remain human-readable evidence summaries, not recovery authority.
FR `TODO.md` files may continue to support local implementation stops but do
not become project-state truth.
