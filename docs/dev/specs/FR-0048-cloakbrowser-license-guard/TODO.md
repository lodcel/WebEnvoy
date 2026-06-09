# FR-0048 TODO

## Spec review checklist

- [ ] Confirm FR-0048 path and canonical issue #1145 are correct.
- [ ] Confirm no bundled redistribution is absolute for repository, release artifact, fixture, example and CI artifact surfaces.
- [ ] Confirm `operator_installed_binary` is the only allowed CloakBrowser binary ownership model.
- [ ] Confirm WebEnvoy download / mirror / cache / vendor / repackaging of CloakBrowser binary is forbidden.
- [ ] Confirm license acknowledgement fields cover operator ref, terms ref, method, scope, status and evidence refs.
- [ ] Confirm `acknowledged` is the only status that can satisfy required license acknowledgement.
- [ ] Confirm license acknowledgement does not grant WebEnvoy redistribution permission.
- [ ] Confirm binary source evidence covers source kind, owner, installer, version/checksum refs, freshness, redaction and artifact identity.
- [ ] Confirm research inputs are limited to #1145, #1212, FR-0033, FR-0040 and FR-0041, with no third-party legal conclusion or binary download.
- [ ] Confirm raw private path, binary locator, license key, vendor account id, download credential, Cookie, token and provider private payload cannot enter public surfaces.
- [ ] Confirm FR-0040 provider evidence and FR-0041 redaction policy are consumed without changing their field shape.
- [ ] Confirm FR-0033 CloakBrowser relation remains managed provider / private limitation, not WebEnvoy core or default provider.
- [ ] Confirm #1212 consumes this guard and does not redefine license / binary packaging ownership.
- [ ] Confirm no runtime behavior, descriptor, health, XHS, Syvert, official Chrome, browser patching, scripts, workflows or release automation is included.
- [ ] Confirm PR closing semantics use `Refs #1145`; formal spec review PR must not auto-close #1145, while #1212 remains open.

## Post-review implementation / audit candidates

- [ ] Add repository scan for CloakBrowser executable, installer, archive, native component, encoded payload and fixture copy.
- [ ] Add release artifact scan consuming `FR-0048.cloakbrowser_license_guard.v1`.
- [ ] Add redaction tests preventing raw binary path, license key, vendor account id, credential-bearing URL and binary payload disclosure.
- [ ] Add provider selection guard requiring license acknowledgement and binary source evidence before CloakBrowser execution eligibility.
- [ ] Add provider doctor input guard for operator-installed binary source evidence without implementing binary discovery in this FR.
- [ ] Add #1212 closeout checklist that consumes no bundled binary, license acknowledgement, binary source evidence and redaction policy refs.

## Current PR scope

- [ ] Formal spec suite only.
- [ ] No runtime implementation.
- [ ] No binary discovery, download, install, cache, mirror, vendor or packaging implementation.
- [ ] No live evidence.
- [ ] No browser/profile/account interaction.
- [ ] Scheduler owns guardian/formal review/merge gate.
