# Repo-local Agents

This directory contains repository-scoped agent assets that must travel with WebEnvoy.

## Versioned Surfaces

Commit these surfaces when they define the repo contract:

- `plugins/loom/.codex-plugin/plugin.json`
- `plugins/loom/skills/**`
- `.loom/installed-state.json`
- `.loom/companion/**`
- `.loom/bin/**` while the installed-state runtime layer points at it

Commit these only after a later phase explicitly makes Loom the authored truth owner:

- `.loom/work-items/**`
- `.loom/specs/**`
- `.loom/reviews/**`
- `.loom/progress/**`
- `.loom/status/current.md`

Do not commit these local or generated surfaces:

- `.agents/tmp/**`
- `.agents/cache/**`
- `.agents/runtime/**`
- `.loom/runtime/**`
- `.loom/tmp/**`
- `.loom/cache/**`
- `.loom/**/attempts/**`
- raw engine logs
- temporary review output
- machine-local state
- files containing host-specific absolute paths

## Current Phase

WebEnvoy uses the Loom downstream Codex plugin layout. GitHub Issues/Projects, WebEnvoy guardian, WebEnvoy review rules, CI, live evidence gates, and controlled merge remain the authoritative host surfaces.
