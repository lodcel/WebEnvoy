# FR-0067 Research

## Issue readback

#1177 scope:

- Require extension smoke and native bridge readiness before live-write admission.
- Depends on Provider Health / Doctor Contract.
- Boundary excludes Syvert normalized result, CloakBrowser-as-core, browser patching, default live_write commit, unrelated #835 recovery, XHS publish implementation and browser/account/live/write actions.
- Labels: `kind:fr`, `area:live-write`, `risk:high`, `integration:local-only`.
- Close semantics: `fr-complete`.

## Consumed baselines

### FR-0038 / #1127 Provider Health / Doctor Contract

Consumed facts:

- Provider doctor report owns required check categories, status, severity, blocking, evidence refs and fail-closed behavior.
- `extension_load` and `native_messaging` are required check categories when provider/capability requirements demand them.
- Doctor pass can move a provider/capability only to `doctor_checked`; it cannot prove runtime ready or live evidence ready.
- `target_tab` and `runtime_bootstrap_ready` remain later gates.

FR-0067 implication:

- Extension/native bridge gate may consume doctor facts, but must not treat doctor pass as bridge ready by itself.
- Bridge readiness remains a distinct gate result with current scope, freshness and evidence refs.

### FR-0045 / #1140 Persistent Extension Identity Health

Consumed facts:

- Persistent extension identity/source binding health maps into FR-0038 `category=extension_load`.
- It verifies stable extension id, manifest/version traceability, profile-scoped installation/source binding and browser channel.
- It explicitly does not prove Native Messaging health, service worker freshness, runtime attestation or live evidence.

FR-0067 implication:

- Extension smoke must consume current pass-compatible extension identity/source binding health.
- Extension identity health is necessary but not sufficient for bridge readiness.

### FR-0046 / #1141 Native Messaging Health

Consumed facts:

- Native Messaging health maps into FR-0038 `category=native_messaging`.
- Required checks include host identity, manifest, allowed origins, host registration, socket availability and bridge handshake.
- `ready` may satisfy doctor-layer Native Messaging requirement only; recoverable, disconnected, blocked, unknown, stale, stub/fake or redaction-invalid evidence cannot satisfy readiness.

FR-0067 implication:

- Native bridge readiness must consume current pass-compatible Native Messaging health.
- Recoverable bridge states remain non-ready until fresh recovery evidence exists.

### FR-0047 / #1142 Service Worker Freshness Health

Consumed facts:

- Service worker freshness/code identity health maps into FR-0038 `category=extension_load`.
- Current observed code digest must match expected bundle identity; stale, missing, unknown or redaction-invalid evidence fail closed.
- Runtime ping, bootstrap ack or native bridge ready evidence does not prove service worker code freshness.

FR-0067 implication:

- Extension smoke must require current service worker freshness/code identity.
- Service worker wake signal alone cannot be bridge readiness.

### FR-0062 / #1174 Live-Write Capability Taxonomy

Consumed facts:

- Capability levels are `read_only`, `write_admit`, `write_prepare`, `live_write_commit`.
- `write_admit` is not `write_prepare`; `write_prepare` is not `live_write_commit`.
- `live_write_commit` is locked by default and requires multiple owner gates.

FR-0067 implication:

- Extension/native bridge gate becomes a necessary lane for moving live-write workflows beyond admission.
- This gate cannot unlock commit or satisfy downstream live evidence.

### FR-0066 / #1176 Account Safety Gate

Consumed facts:

- Account safety is a separate explicit scoped result required before `write_prepare` / `live_write_commit`.
- `clear` is necessary but not sufficient and does not satisfy other gates.

FR-0067 implication:

- Bridge ready and account safety clear remain separate lanes. Neither can imply the other.

## Boundary decisions

1. Extension/native bridge readiness is a gate result, not a runtime implementation in this PR.
2. Extension smoke and Native Messaging bridge readiness are both required; one cannot replace the other.
3. Provider doctor pass is an input, not a final readiness result.
4. Runtime ping, bootstrap ack and service worker wake signal are control-plane signals only.
5. Stub/fake host and historical artifacts remain blocked even if they look successful.
6. Any real browser, extension, Native Messaging, account or live action belongs to future implementation/live owner and requires explicit authorization.

## Downstream consumers

- #1179 must consume `extension_native_bridge_gate_result` before provider requirements can support write preparation.
- #1180 must require current bridge ready before default commit lock release can be considered.
- #1211 must include bridge states and blockers in the live-write gate matrix.
- Runtime/live owner must produce current scoped bridge state before any `write_prepare` or `live_write_commit` request.

## Open implementation questions for later owners

- Exact runtime command or evaluator name that will emit `ExtensionNativeBridgeStateRecordV1`.
- Freshness TTL per workflow, provider and target risk lane.
- Whether `requires_recovery` maps to same-run automatic retry, manual recovery issue or blocked closeout.
- Storage location and artifact identity format for redacted extension/native bridge refs.
- Exact minimum extension smoke payload shape that is safe, non-business and non-write.

These questions do not block the formal contract because the required state shape, fail-closed behavior and downstream ownership are frozen here.
