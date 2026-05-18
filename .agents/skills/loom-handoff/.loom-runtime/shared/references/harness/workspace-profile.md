# Workspace Profile

Canonical source: `docs/methodology/harness/workspace-profile.md`.

Installed skills consume this summary to keep the runtime package aware of the
workspace profile surface without creating a second rule definition.

Stable installed-surface facts:

- Supported profile ids are `single-workspace`, `per-item-worktree`, and
  `attach-existing`.
- Profile status is a derived read surface from `Work Item`, fact-chain,
  workspace locate, purity check, and host lifecycle.
- `workspace` remains Loom-owned execution semantics.
- `git worktree`, branch, PR, ruleset, checks, and merge policy remain
  host-owned lifecycle and enforcement surfaces.

Implementations must update the canonical methodology file first, then keep this
installed summary aligned.
