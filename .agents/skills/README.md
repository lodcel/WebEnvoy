# Repo-local Loom Skills

WebEnvoy vendors these Loom skills so a clean checkout can read and execute the repo-local Loom entrypoints without depending on a global Codex skill install or a local Loom source checkout.

## Contract

- Skills are installed as real directories under `.agents/skills/loom-*`.
- Symlinks are not allowed.
- Each skill keeps its own `SKILL.md`, `contract.json`, `loom-package.json`, launcher script, references, and package-local `.loom-runtime`.
- The vendored snapshot is recorded in `manifest.json`.
- WebEnvoy does not treat these skills as a second project truth source. They are executable entrypoints only.

## Source

- Source repository: `https://github.com/MC-and-his-Agents/Loom`
- Source revision: `0937e186c08f6f0722b87c5ca621ae5d4134f981`
- Snapshot mode: repo-local vendored skills

## Update Procedure

1. Update the Loom source checkout to the desired revision.
2. Copy only `loom-*` skill packages into `.agents/skills/`.
3. Exclude local caches, `__pycache__`, logs, temporary outputs, and machine-local state.
4. Refresh `source_revision` in each `loom-package.json`.
5. Refresh `manifest.json`.
6. Verify there are no symlinks and no host-specific absolute paths.
7. Run WebEnvoy and Loom attach-only validation before opening a PR.

## Rollback

Delete `.agents/skills/loom-*`, `.agents/skills/manifest.json`, and this README to return to the Phase 1 attach-only runtime state.
