# FR-0066 TODO

## Review 阶段

- [ ] 确认 `FR-0066` 只定义 Account Safety Gate formal contract。
- [ ] 确认 `write_prepare` and `live_write_commit` admission require scoped `account_safety_state=clear`。
- [ ] 确认 #835 CLOSED、FR-0032 historical baseline、old run、same-head historical artifact、runtime ping、bootstrap ack 或 stub/fake host 不能替代 current safety clear。
- [ ] 确认 accepted operator unlock does not imply account safety clear。
- [ ] 确认 provider requirement pass does not imply account safety clear。
- [ ] 确认 redaction compliance is necessary but not sufficient for safety clear。
- [ ] 确认 account safety evidence refs consume FR-0041 / #1181 redaction expectations and never inline account/profile/secret/path values。
- [ ] 确认 unknown / blocked / stale / redaction_invalid / requires_operator_attention fail closed。
- [ ] 确认本 suite 没有 runtime/source code、tests、fixtures、scripts、workflows、browser/account/live/write action、Syvert normalized result、provider adapter implementation 或 issue closeout。
- [ ] 确认 PR metadata uses `Fixes #1176` only because #1176 close semantics are `fr-complete`, and does not close #1179/#1180/#1211/#835。

## 实现前待办

- [ ] #1179 consumes `account_safety_gate_result` before provider requirement can support write preparation.
- [ ] #1180 requires current account safety clear before default commit lock release can be considered.
- [ ] #1211 includes account safety states and blocking reasons in the live-write gate matrix.
- [ ] Future runtime owner emits current scoped `AccountSafetyStateRecordV1`.
- [ ] Future parser rejects stale, missing, redaction-invalid, stub/fake, control-plane-only or historical safety evidence.
- [ ] Future live-write implementation supplies current provider requirement, default lock, operator unlock, runtime target binding, anti-detection gate and live evidence refs in addition to account safety.
