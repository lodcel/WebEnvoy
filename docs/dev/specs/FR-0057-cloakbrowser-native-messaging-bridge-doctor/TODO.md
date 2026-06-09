# FR-0057 TODO

## Spec review checklist

- [ ] Confirm FR-0057 path and sync map use canonical issue #1154.
- [ ] Confirm PR closing semantics use `Refs #1154`; formal spec review PR must not auto-close #1154.
- [ ] Confirm Native Messaging bridge doctor owner is WebEnvoy extension/native host/bridge doctor, not CloakBrowser provider.
- [ ] Confirm handoff maps to `FR-0038.provider_doctor_report` and `category="native_messaging"` without defining a parallel health result schema.
- [ ] Confirm persistent descriptor refs are inputs only, not doctor pass or runtime ready.
- [ ] Confirm cloakserve default extension / Native Messaging unsupported remains fail-closed.
- [ ] Confirm direct variant remains not applicable unless a later formal owner provides extension/native bridge refs.
- [ ] Confirm required checks cover owner attribution, descriptor applicability, extension identity, native host identity, manifest, allowed origins, registration, transport, handshake and handoff artifact integrity.
- [ ] Confirm failure classes are machine-readable and include ownership, descriptor, extension, host, manifest, registration, transport, handshake, source integrity, stale evidence and secret leak failures.
- [ ] Confirm `bridge_doctor_ready` does not prove runtime attestation, target tab readiness, live evidence, page command success or account safety.
- [ ] Confirm stub/fake host evidence, historical artifact, same-head old artifact and stale bridge ack fail closed.
- [ ] Confirm raw manifest, full local path, Cookie, token, profile path, account id, broker credential and private patch payload are forbidden disclosure.
- [ ] Confirm live evidence remains `N/A` and no runtime / browser / profile / account action is claimed.

## Post-review implementation candidates

- [ ] Add handoff parser for identity, applicability, conclusion and failure class enums.
- [ ] Add ownership validator rejecting CloakBrowser-owned Native Messaging claims.
- [ ] Add variant applicability tests for persistent / direct / cloakserve.
- [ ] Add source integrity checks for WebEnvoy extension origin, native host id, manifest owner and handshake source.
- [ ] Add redaction validation for manifest, allowed origins, transport locator, command output and handshake artifact.
- [ ] Add capability readiness tests confirming Native Messaging doctor pass cannot satisfy runtime/live requirements.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] Single `FR-0057 -> #1154` sync-map mapping only.
- [ ] No runtime implementation.
- [ ] No doctor command implementation.
- [ ] No native host behavior implementation.
- [ ] No extension behavior implementation.
- [ ] No capability matrix or limitation gate behavior.
- [ ] No browser/profile/account/live evidence execution.
- [ ] Scheduler owns guardian / formal review / merge gate.
