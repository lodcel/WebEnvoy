# FR-0068 TODO

## Review 阶段

- [ ] 确认 `FR-0068` 只定义 `live_write_commit` default lock formal contract。
- [ ] 确认 `live_write_commit` 默认 `locked`，且 unknown / missing / stale / scope mismatch / redaction invalid fail closed。
- [ ] 确认 #1179 `xhs.creator_publish.admit` remains admission-only `write_admit` context, does not populate release-ready refs and does not unlock commit。
- [ ] 确认 accepted operator unlock does not release default lock by itself。
- [ ] 确认 profile manifest allowlist、account safety clear、extension/native bridge ready、runtime target binding、anti-detection gate and live evidence are all separate required lanes。
- [ ] 确认 #835 CLOSED、historical artifact、old run、same-head historical artifact、runtime ping、bootstrap ack、service worker wake signal、doctor pass、hosted checks 或 stub/fake host 不能替代 current default lock release evidence。
- [ ] 确认 evidence refs consume redaction expectations and never inline account/profile/secret/path/page/media/live artifact values。
- [ ] 确认 downstream re-consumption is required before any final commit decision。
- [ ] 确认本 suite 没有 runtime/source code、tests、fixtures、scripts、workflows、browser/extension/native messaging/account/live/write action、Syvert normalized result、provider adapter implementation 或 issue closeout。
- [ ] 确认 PR metadata uses `Refs #1180` and does not auto-close #1180/#1174/#1175/#1176/#1177/#1178/#1179/#1211/#835。

## 实现前待办

- [ ] #1211 consumes `live_write_commit_default_lock` states and blocking reasons in the release gate matrix.
- [ ] Future parser rejects missing, stale, expired, revoked, redaction-invalid, stub/fake, control-plane-only or historical release evidence.
- [ ] Future runtime owner emits current scoped `LiveWriteCommitDefaultLockRecordV1` only after all required lanes are current and exact-scope.
- [ ] Future provider requirement owner distinguishes `xhs.creator_publish.admit` `write_admit` from any commit-scope provider requirement.
- [ ] Future live evidence owner supplies latest-head fresh real-browser evidence before any commit release can pass.
- [ ] Future commit gate explicitly reconsumes all evidence refs and records the re-consumption decision.
- [ ] Future live-write implementation preserves fail-closed no-op behavior when default lock remains active.
