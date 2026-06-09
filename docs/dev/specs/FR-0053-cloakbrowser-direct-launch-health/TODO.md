# FR-0053 TODO

## Spec review checklist

- [ ] Confirm FR-0053 path and sync map use canonical issue #1150.
- [ ] Confirm PR closing semantics use `Refs #1150`; formal spec review must not auto-close #1150.
- [ ] Confirm `cloakbrowser_direct_launch_health_report` is health/admission evidence, not runtime status, launch implementation, capability matrix row, limitation gate result or live evidence record.
- [ ] Confirm the suite consumes `FR-0038.provider_doctor_report` without redefining doctor status, severity, blocking or evidence semantics.
- [ ] Confirm the suite consumes `FR-0049.cloakbrowser.direct` and keeps `provider_id=cloakbrowser.direct`, `variant_kind=direct`, headless forbidden, hybrid transport, ephemeral profile and Native Messaging not applicable.
- [ ] Confirm the suite consumes `FR-0058.cloakbrowser_final_args_evidence` and keeps final args as input-shape evidence only.
- [ ] Confirm the suite consumes `FR-0059.cloakbrowser_fingerprint_seed_evidence_policy` and never exposes raw seed, seed hash value, private patch payload or fingerprint internals.
- [ ] Confirm required checks cover binary, version, launch args, environment, transport, optional extension and admission summary.
- [ ] Confirm `doctor_verification_projection` never exceeds `doctor_checked`, and FR-0038 compatibility maps `admission_summary` to `capability_readiness` rather than a new higher verification level.
- [ ] Confirm `transport_probe` does not prove runtime bootstrap, target tab ready, page automation success or live evidence.
- [ ] Confirm `optional_extension_probe` does not prove stable extension id, service worker freshness, persistent install or Native Messaging readiness.
- [ ] Confirm `direct_launch_health_level=admission_ready` still requires runtime attestation, launch evidence validation, capability matrix selection and live evidence where applicable.
- [ ] Confirm unknown, missing, stale, unavailable or redaction-invalid required evidence fails closed.
- [ ] Confirm forbidden disclosure covers full local paths, raw argv, raw environment dump, cookies, tokens, proxy credentials, fingerprint seed values, seed hash values, private patch payloads, account identifiers and page content.
- [ ] Confirm scope does not enter runtime code, doctor command, launch behavior, capability matrix, limitation gate, native messaging bridge, browser patching, Syvert, XHS or live evidence execution.
- [ ] Confirm scheduler owns guardian/formal review/controlled merge/issue closeout gate.

## Post-review implementation candidates

- [ ] Add parser coverage for `cloakbrowser_direct_launch_health_report` identity / input refs / checks / outcome enums.
- [ ] Add required check mapping tests for direct launch health admission.
- [ ] Add redaction validator tests for binary locators, extension locators, final args refs, env probes and transport refs.
- [ ] Add fail-closed consumer tests for missing / unknown / stale / invalid required evidence.
- [ ] Add tests proving health/admission evidence cannot satisfy runtime ready, target tab ready, capability allowed or live evidence gates.
- [ ] Add synthetic fixture samples only after a later fixture owner is assigned and explicitly authorized.

## Current PR scope

- [ ] Formal direct launch health suite only.
- [ ] Single `FR-0053 -> #1150` sync-map mapping only.
- [ ] No runtime implementation.
- [ ] No doctor command.
- [ ] No browser launch behavior.
- [ ] No capability matrix or limitation gate.
- [ ] No Native Messaging bridge.
- [ ] No Syvert / XHS / browser patching scope.
- [ ] No live evidence execution.
- [ ] Research notes only document contract inputs, deferred unknowns and non-validation boundary.
