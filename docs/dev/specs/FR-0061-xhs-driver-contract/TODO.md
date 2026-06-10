# FR-0061 TODO

## Spec review checklist

- [ ] Confirm FR-0061 path and sync map use canonical issue #1158.
- [ ] Confirm XHS driver output is frozen as `raw` / `operational` / `evidence`.
- [ ] Confirm no `normalized` section or Syvert normalized result is defined.
- [ ] Confirm no Syvert resource taxonomy or Syvert error taxonomy is defined.
- [ ] Confirm runtime binding is a locator / expected binding boundary, not runtime ready or target tab ready proof.
- [ ] Confirm provider requirements consume `FR-0033` / `FR-0035` / `FR-0040` / `FR-0041` and do not redefine provider ownership.
- [ ] Confirm downstream slicing inputs only prepare #1159/#1160/#1161/#1163/#1164/#1165 and do not implement them.
- [ ] Confirm read-path implementation, live-write enablement, JSON-RPC extension and browser/profile/account/live actions remain out of scope.
- [ ] Confirm raw/evidence refs require redaction and do not expose Cookie, token, account id, private path, profile path or full page content.
- [ ] Confirm PR closing semantics use `Refs #1158`; formal spec review PR must not auto-close #1158.
- [ ] Confirm live evidence remains `N/A` and no runtime / account / external-visible action is claimed.

## Post-review implementation candidates

- [ ] Add XHS driver output envelope parser / validator in a later implementation owner.
- [ ] Add runtime binding resolver only after the relevant runtime/read-path issue authorizes it.
- [ ] Add provider requirement consumer tests under the provider/capability owner.
- [ ] Add raw payload artifact writer and redaction guard under an evidence owner.
- [ ] Add downstream slice implementation for #1159/#1160/#1161/#1163/#1164/#1165 only in their own scopes.
- [ ] Add Syvert normalization / taxonomy mapping only in a Syvert-owned contract.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] Single `FR-0061 -> #1158` sync-map mapping only.
- [ ] No runtime/source implementation.
- [ ] No tests or fixtures.
- [ ] No scripts, workflows or githooks.
- [ ] No Syvert normalized result.
- [ ] No live-write enablement.
- [ ] No JSON-RPC extension.
- [ ] No browser/profile/account/live interaction.
- [ ] Scheduler owns guardian / formal review / merge gate.
