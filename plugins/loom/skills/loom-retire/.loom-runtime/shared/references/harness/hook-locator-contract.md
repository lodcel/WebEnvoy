# Hook Locator Contract

This file defines Loom's lifecycle hook locator contract. It freezes declaration
and adapter semantics only; it does not introduce hook execution.

## Goal

Loom hooks let a repository declare where lifecycle hook guidance or scripts live
without copying host-native hook files into Loom core.

The stable lifecycle names are:

- `before-run`
- `after-run`
- `cleanup`

These names are Loom lifecycle semantics, not host event names.

## Locator Rules

Each hook locator must be a repository-relative path.

Invalid locators fail closed for every requirement level:

- absolute paths
- paths containing `..`
- paths that resolve outside the repository root
- non-string or empty locators when the hook is `required`

Missing optional or advisory locators are reported as optional gaps. They must
not pollute core `missing_inputs`.

## Repo Companion Declaration

Adopted repositories declare hook locators through the repo companion
`hook_locators` section.

Each entry uses:

- `id`
- `summary`
- `lifecycle`
- `locator`
- `owner`
- `requirement`
- `fallback_to`

Allowed `lifecycle` values are `before-run`, `after-run`, and `cleanup`.
Allowed `requirement` values are `required`, `optional`, and `advisory`.

`hook_locators` are declaration-time locators. They must not carry runtime
state, execution result, authored progress, review verdict, validation status,
host action result, or closeout basis.

## Host Adapter Mapping

Host adapters may install or generate host-native hook config from Loom
locators, but generated config remains downstream of Loom's locator contract.
It does not become Loom-authored truth.

Codex mapping:

- `before-run`: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`
- `after-run`: `PostToolUse`, `Stop`, `PostCompact`
- `cleanup`: `not_applicable` or Loom explicit `workspace cleanup|retire` extension

Codex cleanup must never be required as a native host hook.

Claude Code mapping:

- `before-run`: `SessionStart`, `UserPromptSubmit`, `PreToolUse`
- `after-run`: `PostToolUse`, `Stop`, `SubagentStop`, `PostCompact`
- `cleanup`: optional `SessionEnd`, constrained by Loom cleanup safety

The adapter result vocabulary is:

- `supported`
- `not_applicable`
- `advisory`
- `unsafe`

## Evidence Boundary

Host-native hook output can only become Loom runtime evidence after adapter
mapping.

Hook output must not write:

- authored progress
- recovery or status truth
- review verdict
- validation summary
- host action result
- closeout basis

Cleanup hooks are always constrained by [workspace-lifecycle.md](./workspace-lifecycle.md):
only Loom-owned residue may be removed, and unmarked content must be preserved.

## Non-goals

- executing hooks
- generating host-native hook files
- copying Codex or Claude Code hook file shapes into Loom core
- replacing `workspace cleanup|retire`
