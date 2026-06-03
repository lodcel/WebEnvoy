# Repo-local Agents

This directory contains repository-scoped agent assets that must travel with WebEnvoy.

## Versioned Surfaces

Commit these surfaces when they define the repo contract:

- `.loom/installed-state.json`
- `.loom/companion/**`
- `.loom/bin/**` while the installed-state runtime layer points at it
- `.loom/work-items/**`
- `.loom/progress/**`
- `.loom/reviews/**`

Do not commit these Loom provider or generated surfaces:

- `.loom/specs/**`
- `.loom/status/current.md`
- `plugins/loom/**`
- `.agents/skills/**`
- `skills/**`

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

WebEnvoy uses metadata-only Loom repository adoption. The repository records
adoption metadata and repo-owned Loom governance carriers, while Loom skills and
Codex plugin execution come from the user-level Codex Loom plugin. GitHub
Issues/Projects, WebEnvoy guardian, WebEnvoy review rules, CI, live evidence
gates, and controlled merge remain the authoritative host surfaces.
