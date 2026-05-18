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
- Machine-readable repo interface: `.loom/companion/repo-interface.json`
- Read-only interop contract: `.loom/companion/interop.json`

## First Adoption Boundary

This first phase uses the `deep-existing-repo` attach path. Loom should read
WebEnvoy's repo-specific rules and later replace selected execution engines,
but this phase must not generate Loom-owned recovery/status carriers or rewrite
WebEnvoy's root governance rules.
