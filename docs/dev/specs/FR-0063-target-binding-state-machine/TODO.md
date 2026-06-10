# FR-0063 TODO

## Spec review checklist

- [ ] Confirm FR-0063 path and sync map use canonical issue #1161.
- [ ] Confirm all required states are present: `unbound`, `candidate_found`, `url_matched`, `dom_ready`, `runtime_state_detected`, `extension_bridge_confirmed`, `bound`, `stale`, `lost`.
- [ ] Confirm allowed transitions require ordered evidence and do not allow direct promotion to `bound`.
- [ ] Confirm `bound` is only target binding pass input and does not prove page ready, runtime ready, signed continuity, read success, live evidence, provider capability or write enablement.
- [ ] Confirm `dom_ready` and `runtime_state_detected` remain #1162 diagnostic inputs, not #1162 pass states.
- [ ] Confirm `bound` and transition evidence remain #1171 unsigned inputs, not signed continuity proof.
- [ ] Confirm stale, lost, invalid transition, missing evidence, owner mismatch, redaction invalid and historical evidence fail closed.
- [ ] Confirm FR-0061 runtime binding is consumed but not rewritten.
- [ ] Confirm FR-0062 live-write taxonomy stays locked by default and target binding does not enable `live_write_commit`.
- [ ] Confirm PR closing semantics use `Refs #1161`; formal spec review PR must not auto-close #1161.
- [ ] Confirm live evidence remains `N/A` and no runtime / account / external-visible action is claimed.

## Post-review implementation candidates

- [ ] Add target binding state machine parser / validator in a later implementation owner.
- [ ] Add target candidate discovery only after the relevant runtime/read-path issue authorizes it.
- [ ] Add #1162 page/runtime ready consumer tests under #1162.
- [ ] Add #1171 signed continuity chain and signature tests under #1171.
- [ ] Add stale/lost handling tests for navigation, tab close, bridge mismatch and source owner mismatch.
- [ ] Add redaction guard for snapshot and transition evidence under an evidence owner.
- [ ] Add read path implementation only in its own scoped issue after required contracts are reviewed.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] Single `FR-0063 -> #1161` sync-map mapping only.
- [ ] No runtime/source implementation.
- [ ] No tests or fixtures.
- [ ] No scripts, workflows or githooks.
- [ ] No Syvert normalized result.
- [ ] No live-write enablement.
- [ ] No CloakBrowser-as-core or browser patching.
- [ ] No default `live_write_commit`.
- [ ] No #835 recovery.
- [ ] No browser/profile/account/live interaction.
- [ ] Scheduler owns guardian / formal review / merge gate.
