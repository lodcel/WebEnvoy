# FR-0067 TODO

## Review 阶段

- [ ] 确认 `FR-0067` 只定义 Extension / Native Bridge Gate formal contract。
- [ ] 确认 `write_prepare` and `live_write_commit` admission require scoped `extension_native_bridge_gate_result.state=ready`。
- [ ] 确认 extension smoke and native bridge readiness are both required。
- [ ] 确认 FR-0038 doctor pass does not imply extension/native bridge readiness。
- [ ] 确认 FR-0045 extension identity/source binding health and FR-0047 service worker freshness are consumed as extension smoke inputs, not as Native Messaging readiness。
- [ ] 确认 FR-0046 Native Messaging health and bridge handshake are required for native bridge readiness。
- [ ] 确认 #835 CLOSED、historical artifact、old run、same-head historical artifact、runtime ping、bootstrap ack、service worker wake signal 或 stub/fake host 不能替代 current bridge readiness。
- [ ] 确认 extension/native bridge readiness does not imply account safety clear, provider requirement pass, operator unlock, default lock release, target binding, anti-detection pass or live evidence accepted。
- [ ] 确认 evidence refs consume FR-0041 redaction expectations and never inline account/profile/manifest/socket/secret/path values。
- [ ] 确认 unknown / blocked / stale / redaction_invalid / requires_recovery fail closed。
- [ ] 确认本 suite 没有 runtime/source code、tests、fixtures、scripts、workflows、browser/extension/native messaging/account/live/write action、Syvert normalized result、provider adapter implementation 或 issue closeout。
- [ ] 确认 PR metadata uses `Fixes #1177` only because #1177 close semantics are `fr-complete`, and does not close #1175/#1176/#1179/#1180/#1211/#835。

## 实现前待办

- [ ] #1179 consumes `extension_native_bridge_gate_result` before provider requirement can support write preparation.
- [ ] #1180 requires current extension/native bridge ready before default commit lock release can be considered.
- [ ] #1211 includes extension/native bridge states and blocking reasons in the live-write gate matrix.
- [ ] Future runtime owner emits current scoped `ExtensionNativeBridgeStateRecordV1`.
- [ ] Future parser rejects stale, missing, redaction-invalid, stub/fake, control-plane-only or historical bridge evidence.
- [ ] Future Native Messaging implementation maps recoverable states to non-ready until fresh post-recovery evidence exists.
- [ ] Future live-write implementation supplies current provider requirement, account safety, default lock, operator unlock, runtime target binding, anti-detection gate and live evidence refs in addition to extension/native bridge readiness.
