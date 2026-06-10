# FR-0055 Data Model

`cloakserve_limitation_gate` is an admission disposition model, not a runtime state model.

## Core entity

```text
cloakserve_limitation_gate
  gate_id: cloakserve.limitation-gate.v1
  owner: #1152 / FR-0055
  provider_id: cloakbrowser.cloakserve
  descriptor_ref: FR-0051
  capability_matrix_ref: FR-0052
  verification_model_ref: FR-0035
```

Lifecycle:

1. Consumer requests a cloakserve capability/workflow.
2. Gate collects FR-0051 descriptor limitation refs and FR-0052 matrix limitation disposition.
3. Gate checks scoped experimental issue metadata when present.
4. Gate returns blocked/deny or defer to a downstream owner.
5. Downstream owner may later produce runtime/evidence output, but this suite does not define or store that output.

## Input classification

| field | required | source | constraint |
|---|---|---|---|
| `provider_id` | yes | caller / registry | must be `cloakbrowser.cloakserve` |
| `capability_id` | yes | FR-0052 | must match a known matrix row |
| `requested_workflow` | yes | caller / consumer | unknown workflows fail closed |
| `descriptor_limitation_refs` | yes | FR-0051 | tokens remain machine-readable |
| `matrix_limitation_disposition` | yes | FR-0052 | row-level limitations remain machine-readable |
| `experimental_issue_ref` | no | GitHub issue | concrete issue only; no project/milestone/free text |
| `evidence_refs` | no | downstream owners | references only; no inline secrets or raw artifacts |

## Decision table

| condition | support_state | decision | gate_status |
|---|---|---|---|
| Provider is not `cloakbrowser.cloakserve` | `unsupported` | `deny` | `not_applicable` |
| Extension runtime / relay requested without scoped experimental issue | `blocked` | `deny` | `blocked` |
| Native Messaging requested without scoped experimental issue | `blocked` | `deny` | `blocked` |
| Business read/write/download with declared-only matrix row and no runtime/evidence owner output | `blocked` | `deny` | `blocked` |
| Matching scoped experimental issue exists but runtime/evidence refs are not accepted | `declared` | `defer` | `deferred_to_experimental_owner` |
| Unknown limitation or stale evidence appears in admission | `blocked` | `deny` | `blocked` |

This suite never emits `allow`.

## Experimental issue metadata

A valid experimental issue must provide:

- `provider_id=cloakbrowser.cloakserve`
- exact `capability_id`
- exact `requested_workflow`
- evidence owner
- runtime owner
- rollback owner
- review/gate owner
- allowed evidence types
- freshness / head binding requirement
- run id or artifact identity requirement
- explicit statement that support does not become default provider capability

The issue permits evaluation only. It does not satisfy runtime, live evidence, extension bridge or Native Messaging proof.

## Evidence reference lifecycle

- `static_descriptor_ref=FR-0051` is always a static input, not evidence passed.
- `capability_matrix_ref=FR-0052` is always a static input, not evidence passed.
- `limitation_gate_ref=FR-0055` is the output locator for downstream owners.
- Runtime/live evidence refs are future or downstream refs; absent or stale refs keep business admission blocked.
- Historical refs may be background only; they cannot satisfy current latest-head or runtime-bound requirements.
