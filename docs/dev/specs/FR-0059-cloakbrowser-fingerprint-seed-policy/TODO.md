# FR-0059 TODO

## Spec review checklist

- [ ] Confirm FR-0059 path and sync map use canonical issue #1156.
- [ ] Confirm caller-supplied seed is the only allowed prerequisite for reproducibility claims.
- [ ] Confirm `provider_generated|mixed|unknown` seed origins cannot be reported as reproducible.
- [ ] Confirm raw fingerprint seed is always treated as `secret` and never disclosed.
- [ ] Confirm seed hash recording is allowed only for caller-supplied seed and policy-approved scope.
- [ ] Confirm `seed_hash_value` never enters PR body, stdout summary, fixture, spec sample or capability summary.
- [ ] Confirm `seed_hash_ref` and `seed_hash_value` disclosure boundaries remain distinct.
- [ ] Confirm private patch payload, stealth parameter, driver internal state and fingerprint internals stay outside WebEnvoy core contract.
- [ ] Confirm FR-0040 evidence kernel shape is unchanged.
- [ ] Confirm FR-0041 redaction policy is consumed, not redefined.
- [ ] Confirm FR-0049 fingerprint seed boundary remains a consumer of this policy, not a duplicate policy owner.
- [ ] Confirm PR closing semantics use `Refs #1156`; formal spec review PR must not auto-close #1156.
- [ ] Confirm live evidence remains `N/A` and no runtime / account action is claimed.

## Post-review implementation candidates

- [ ] Add seed origin validation in future CloakBrowser evidence owner.
- [ ] Add seed hash scope / disclosure validation in future evidence collector.
- [ ] Add health gate fail-closed logic for missing caller-supplied seed proof.
- [ ] Add capability gate fail-closed logic for `provider_generated|mixed|unknown`.
- [ ] Add fixture / sample guards preventing raw seed and reversible seed preview leaks.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] No runtime implementation.
- [ ] No launch / patch / doctor / health behavior implementation.
- [ ] No capability matrix.
- [ ] No fixtures or tests.
- [ ] Scheduler owns guardian / formal review / merge gate.
