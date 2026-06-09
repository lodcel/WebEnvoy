# FR-0060 TODO

## Spec review checklist

- [ ] Confirm FR-0060 path and sync map use canonical issue #1157.
- [ ] Confirm Docker / Xvfb doctor is an environment/admission doctor, not provider capability, runtime status, launch evidence or live evidence.
- [ ] Confirm binary readiness only proves executable / launcher admission input, not browser launched or args honored.
- [ ] Confirm X server and DISPLAY checks are separated and fail closed when inconsistent.
- [ ] Confirm headed launch admission does not prove runtime ready, target tab ready or page interaction success.
- [ ] Confirm headless-only path cannot satisfy CloakBrowser `headless_policy=forbidden` or real-browser route.
- [ ] Confirm font readiness does not prove rendering correctness, screenshot validity, anti-detection pass or live interaction success.
- [ ] Confirm diagnostic output requires redaction, machine-readable fields and artifact identity.
- [ ] Confirm secret, credential, license token, cookie, account identifier, raw env dump and raw private host path are forbidden in public surfaces.
- [ ] Confirm FR-0038 provider doctor report shape is consumed, not rewritten.
- [ ] Confirm FR-0049 / FR-0050 / FR-0051 descriptor semantics are consumed, not rewritten.
- [ ] Confirm PR closing semantics use `Refs #1157`; formal spec review PR must not auto-close #1157.
- [ ] Confirm live evidence remains `N/A` and no runtime / account / external-visible action is claimed.

## Post-review implementation candidates

- [ ] Add Docker / Xvfb doctor parser and enum validation.
- [ ] Add binary, X server and DISPLAY probes under a later implementation owner.
- [ ] Add diagnostic artifact redaction guard for env/path/credential leaks.
- [ ] Add font readiness probe and warning / fail-closed consumer logic.
- [ ] Add tests proving environment doctor pass cannot satisfy runtime/live/capability gates.
- [ ] Add Docker/Xvfb command, image or workflow only after a later scope explicitly authorizes it.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] Single `FR-0060 -> #1157` sync-map mapping only.
- [ ] No runtime implementation.
- [ ] No Docker image/script/workflow.
- [ ] No Xvfb launch behavior.
- [ ] No capability matrix.
- [ ] No fixtures or tests.
- [ ] No live/browser/profile/account interaction.
- [ ] Scheduler owns guardian / formal review / merge gate.
