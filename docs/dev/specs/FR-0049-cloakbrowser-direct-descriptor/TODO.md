# FR-0049 TODO

## Spec review checklist

- [ ] Confirm FR-0049 path and sync map use canonical issue #1146.
- [ ] Confirm `cloakbrowser.direct` descriptor facts cover identity, mode, engine, transport, profile semantics, extension path handling, final args evidence limits, fingerprint seed boundary, capability refs, limitation refs and evidence slots.
- [ ] Confirm extension paths only consume `FR-0037.launch_envelope.runtime_bindings.extension_paths`.
- [ ] Confirm extension path handling does not disclose full local paths, secrets, tokens, cookies, proxy credentials, fingerprint seeds or extension private content.
- [ ] Confirm final args evidence is redacted future evidence only and does not prove browser honored args, runtime readiness, health pass, anti-detection pass or live evidence.
- [ ] Confirm provider-managed fingerprint seed boundary does not expose private patch schema or seed values.
- [ ] Confirm #1149 owns capability matrix semantics.
- [ ] Confirm #1147 owns persistent profile / extension / native messaging delta.
- [ ] Confirm #1148 owns cloakserve / broker / service delta.
- [ ] Confirm health / doctor result schema is out of scope and must consume FR-0038.
- [ ] Confirm launch evidence / final args evidence artifacts are out of scope and must consume FR-0037 / FR-0040 / FR-0041.
- [ ] Confirm fixtures and runtime implementation are out of scope.
- [ ] Confirm CloakBrowser is not WebEnvoy core, not default provider, not Syvert normalized result owner and not XHS business semantics owner.
- [ ] Confirm PR closing semantics use `Refs #1146`; formal spec review must not auto-close #1146.

## Post-review implementation candidates

- [ ] Add descriptor parser coverage for `cloakbrowser.direct`.
- [ ] Add launch envelope validation coverage for `extension_paths` locator-only handling.
- [ ] Add evidence redaction tests for final args snapshots.
- [ ] Add registry entry fixture only after scheduler confirms fixture owner and #1149 consumption boundary.
- [ ] Add capability matrix rows under #1149 after #1146/#1147/#1148 descriptor inputs are stable.

## Current PR scope

- [ ] Formal descriptor suite only.
- [ ] No runtime implementation.
- [ ] No live evidence.
- [ ] No browser/profile/account interaction.
- [ ] No persistent / cloakserve delta.
- [ ] No capability matrix.
- [ ] Scheduler owns guardian/formal review/merge gate.
