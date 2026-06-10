# FR-0056 Data Model

`extension_capability_gate` is an admission disposition model, not a runtime state model.

## Core entity

```text
extension_capability_gate
  gate_id: extension.capability-gate.v1
  owner: #1153 / FR-0056
  provider_ids:
    - cloakbrowser.direct
    - cloakbrowser.persistent
    - cloakbrowser.cloakserve
  capability_matrix_ref: FR-0052
  persistent_health_ref: FR-0054
  cloakserve_limitation_ref: FR-0055
  native_messaging_doctor_ref: FR-0057
  verification_model_ref: FR-0035
```

Lifecycle:

1. Consumer requests a workflow that depends on extension bridge, relay bridge, Native Messaging, or page automation with extension.
2. Gate resolves the `FR-0052` matrix row and requested minimum.
3. Gate consumes variant-specific refs:
   - direct: matrix limitations and unsupported Native Messaging disposition.
   - persistent: `FR-0054` profile / extension / Native Messaging health and, when needed, `FR-0057` bridge doctor.
   - cloakserve: `FR-0055` limitation gate.
4. Gate evaluates runtime / target tab / observation / live refs as required downstream inputs.
5. Gate returns blocked / deny, defer to downstream owner, or future implementation `admission_ready`.

This suite does not store runtime status, browser state, live evidence, page result or issue closeout state.

## Input classification

| field | required | source | constraint |
|---|---|---|---|
| `provider_id` | yes | caller / registry | must be one CloakBrowser variant |
| `capability_id` | yes | `FR-0052` | must match a known matrix row |
| `requested_workflow` | yes | caller / consumer | unknown workflows fail closed |
| `capability_matrix_row_ref` | yes | `FR-0052` | missing / stale row blocks |
| `minimum_support_state` | yes | `FR-0035` / workflow policy | declared/static-only cannot satisfy runtime admission |
| `persistent_profile_health_ref` | conditional | `FR-0054` | required for persistent extension workflow |
| `cloakserve_limitation_gate_ref` | conditional | `FR-0055` | required for cloakserve extension / relay / Native Messaging workflow |
| `native_messaging_bridge_doctor_ref` | conditional | `FR-0057` | required when Native Messaging is a runtime requirement |
| `runtime_attestation_ref` | conditional | downstream runtime owner | required for runtime / page workflows |
| `runtime_observation_ref` | conditional | downstream runtime owner | required for write / download or observed behavior workflows |
| `live_evidence_ref` | conditional | downstream live gate owner | only required when workflow explicitly needs live evidence |

## Variant decision table

| provider | condition | support_state | decision | gate_status |
|---|---|---|---|---|
| direct | extension bridge requested with locator-only inputs | `blocked` | `deny` | `blocked` |
| direct | Native Messaging requested | `blocked` | `deny` | `blocked` |
| persistent | matrix row exists but health missing/stale/non-pass | `blocked` | `deny` | `blocked` |
| persistent | extension health pass-compatible but runtime refs absent | `blocked` | `deny` or `defer` | `deferred_to_runtime_owner` |
| persistent | Native Messaging required and FR-0057 doctor missing/non-ready | `blocked` | `deny` | `blocked` |
| persistent | all gate refs current and downstream runtime refs accepted | future implementation may compute requested state | `allow` | `admission_ready` |
| cloakserve | extension / relay / Native Messaging requested without accepted FR-0055 disposition | `blocked` | `deny` | `blocked` |
| cloakserve | scoped experimental issue permits evaluation but runtime refs absent | `declared` | `defer` | `deferred_to_experimental_owner` |

## Evidence reference lifecycle

- `capability_matrix_ref=FR-0052` is a static input, not evidence passed.
- `persistent_profile_health_ref=FR-0054` can satisfy health-layer prerequisite only when current, redacted and pass-compatible.
- `cloakserve_limitation_gate_ref=FR-0055` can unblock evaluation only according to its own deny/defer semantics.
- `native_messaging_bridge_doctor_ref=FR-0057` can satisfy doctor-layer prerequisite only when WebEnvoy-owned and current; it does not prove runtime ready.
- `runtime_attestation_ref`, `target_tab_binding_ref`, `runtime_observation_ref` and `live_evidence_ref` are downstream refs. Missing refs keep the workflow blocked or deferred.
- Historical refs may be background only. They cannot satisfy current runtime admission, latest-head evidence or current health freshness.

## Non-proof fields

The following are never sufficient by themselves:

- descriptor existence
- extension path or locator
- provider declaration
- health object existence
- doctor report existence
- runtime ping
- bootstrap ack
- local operator note
- stub/fake host success
- historical artifact
- same-head old artifact

They may be referenced as background or static inputs only when the owning FR allows that use.
