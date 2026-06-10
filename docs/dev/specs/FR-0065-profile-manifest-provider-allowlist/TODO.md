# FR-0065 TODO

## Review 阶段

- [ ] 确认 `FR-0065` 只定义 Profile Manifest Provider Allowlist formal contract。
- [ ] 确认 profile manifest 必须声明 allowed providers before live-write admission。
- [ ] 确认 allowed provider entries consume FR-0033 provider vocabulary and FR-0062 capability levels。
- [ ] 确认 secret refs 使用 `secret_handle`、redacted locator 或等价 opaque ref，不包含 raw secret、raw account identifier 或 raw private profile path。
- [ ] 确认 accepted manifest result only clears profile manifest allowlist lane。
- [ ] 确认 provider requirements、operator unlock、default lock、account safety、runtime target binding、anti-detection gate and live evidence remain downstream gates。
- [ ] 确认 #835 CLOSED 只作为 historical baseline / related controlled-success owner，不作为当前 manifest evidence 或 live evidence。
- [ ] 确认本 suite 没有 runtime/source code、tests、fixtures、scripts、workflows、browser/account/live/write action、Syvert normalized result、provider adapter implementation 或 issue closeout。
- [ ] 确认 PR metadata 使用 `Fixes #1175` only because #1175 is `fr-complete`，且未误关 #1176/#1177/#1179/#1180/#1211/#835。

## 实现前待办

- [ ] Future runtime owner implements parser/storage/evaluator for `profile-manifest-provider-allowlist.v1`.
- [ ] Future provider requirements owner consumes accepted manifest result and required secret refs before provider requirement pass.
- [ ] Future default lock owner consumes manifest status as one prerequisite but keeps default commit lock active until separately released.
- [ ] Future release gate matrix consumes manifest blockers and distinguishes them from provider requirement, operator unlock and live evidence blockers.
- [ ] Future implementation rejects raw secret, raw profile path, invalid redaction, expired manifest and revoked manifest.
