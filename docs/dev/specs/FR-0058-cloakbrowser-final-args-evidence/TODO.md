# FR-0058 TODO

## Spec review checklist

- [ ] Confirm FR-0058 path and sync map use canonical issue #1155.
- [ ] Confirm final args evidence is a shared CloakBrowser evidence contract, not runtime status, doctor result, capability matrix, limitation gate result or live evidence record.
- [ ] Confirm `provider_id` / `variant_kind` only admit `cloakbrowser.direct` / `cloakbrowser.persistent` / `cloakbrowser.cloakserve`.
- [ ] Confirm build-time assembled and reconstructed evidence both declare provenance, reconstruction status, attestation boundary and freshness scope.
- [ ] Confirm allowed recorded facts are limited to arg keys, redacted values, locators, hashes, sanitized basenames or opaque refs.
- [ ] Confirm full local paths, raw argv token stream, environment dump, cookies, tokens, proxy credentials, fingerprint seed values, private patch payload, account identifiers and page content are forbidden disclosure.
- [ ] Confirm final args evidence explicitly does not prove browser honored args, runtime readiness, health pass, capability allowed, anti-detection pass, target tab readiness or live evidence attested.
- [ ] Confirm direct variant does not upgrade final args evidence into persistent profile / stable extension identity / native messaging readiness proof.
- [ ] Confirm persistent variant does not upgrade final args evidence into profile lock / login state reuse / extension workflow ready / broker attach success proof.
- [ ] Confirm cloakserve variant does not upgrade final args evidence into extension bridge ready / Native Messaging support / headed route / endpoint security proof.
- [ ] Confirm `historical_background`, `unknown`, `reconstructed_partial` or `redaction_invalid` states fail closed when required by downstream consumers.
- [ ] Confirm downstream consumers are limited to descriptor refs, provider evidence kernel launch arguments and later health/capability/evidence owners.
- [ ] Confirm PR closing semantics use `Refs #1155`; formal spec review must not auto-close #1155.

## Post-review implementation candidates

- [ ] Add parser coverage for `cloakbrowser_final_args_evidence` identity / provenance / semantic conclusion enums.
- [ ] Add redaction validation coverage for path-like args, secrets, env dumps and raw argv token streams.
- [ ] Add consumer tests proving final args evidence cannot satisfy runtime ready / live evidence gates.
- [ ] Add variant-specific fixtures only after a later owner is assigned and fixture scope is explicitly authorized.

## Current PR scope

- [ ] Formal final args evidence suite only.
- [ ] Single `FR-0058 -> #1155` sync-map mapping only.
- [ ] No runtime implementation.
- [ ] No live evidence.
- [ ] No browser/profile/account interaction.
- [ ] No health doctor / capability matrix / limitation gate behavior.
- [ ] Scheduler owns guardian/formal review/merge gate.
- [ ] No `research.md`; current scope has no unresolved external unknown requiring separate research carrier.
