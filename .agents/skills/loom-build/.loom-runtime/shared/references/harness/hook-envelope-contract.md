# Hook Envelope Contract

This file defines Loom's mapped hook envelope contract. It freezes how host
hook output is classified after adapter mapping; it does not introduce hook
execution or host-native hook file generation.

## Goal

`loom-hook-envelope/v1` lets Loom consume hook-related information without
treating Codex, Claude Code, or another host's native hook fields as authored
truth.

The stable output categories are:

- `context_injection`
- `blocking_decision`
- `runtime_evidence`

Adapters must map host-native output into one of these categories before Loom
can consume it.

## Required Shape

Each envelope is a JSON object with:

- `schema_version`: `loom-hook-envelope/v1`
- `hook`: `id`, `lifecycle`, and `locator`
- `input`: `item_locator`, `workspace_locator`, `attempt_locator`, and
  `host_adapter_mapping`
- `output`: `category`, `summary`, and optional mapped `evidence`
- `failure`: optional `classification`, `summary`, and `fallback_to`

Allowed lifecycle values are `before-run`, `after-run`, and `cleanup`.

The `host_adapter_mapping` block identifies the host adapter mapping that
produced the Loom envelope. It must include:

- `host`
- `event`
- `adapter_result`

`adapter_result` must be `supported`, `not_applicable`, `advisory`, or `unsafe`.

## Failure Semantics

Failure classification is limited to:

- `invalid_envelope`
- `missing_required_input`
- `unsupported`
- `not_applicable`
- `permission_unavailable`
- `unsafe`
- `host_mapping_failed`

`fallback_to` can only point to a Loom surface or human repair path. It must not
point to a host-private action such as a Codex or Claude Code native hook.

Allowed fallback values are:

- `admission`
- `pre_review`
- `review`
- `build`
- `merge_ready`
- `closeout`
- `manual_repair`
- `workspace cleanup|retire`

## Truth Boundary

Hook envelopes are mapped runtime evidence or mapped blocking decisions. They
must not carry:

- authored progress
- recovery or status truth
- review verdict
- validation summary
- host action result
- closeout basis

`context_injection` can provide context to a host prompt or tool boundary, but it
must not author progress, status, review, validation, or closeout truth.

`blocking_decision` can block the configured hook path, but it does not replace
review verdicts, merge-ready decisions, or closeout basis.

`runtime_evidence` can be consumed as runtime evidence only after adapter
mapping.

## Live Check

`loom_flow live-smoke hook-envelope --target <repo> --envelope <path>` reads and
validates a repo-relative envelope file. It does not execute hooks.

The live check reports:

- `pass` for valid envelopes
- `warn` for optional or advisory missing/invalid envelopes
- `block` for required missing, invalid, unsafe, or truth-polluting envelopes

The command is profile-local evidence. It must not write authored progress or
modify host-native hook configuration.

## Non-goals

- executing hooks
- generating Codex or Claude Code native hook files
- defining hook safety invariants for #621
- defining hooks extension profile gating for #625
