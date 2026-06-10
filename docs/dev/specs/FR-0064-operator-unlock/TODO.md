# FR-0064 TODO

## Review 阶段

- [ ] 确认 `FR-0064` 只定义 Operator Unlock formal contract。
- [ ] 确认 operator unlock 必须来自 explicit `operator_unlock_record`。
- [ ] 确认 PR approval、issue state、label、guardian approve、hosted checks pass 或 spec merge 都不能替代 operator unlock。
- [ ] 确认 unlock scope 精确匹配 profile、target、workflow、provider requirement、default lock ref、browser channel、execution surface 和 head。
- [ ] 确认 expired / revoked / stale / scope mismatch / head mismatch unlock fail closed。
- [ ] 确认 accepted unlock only clears operator lane and does not release #1180 default commit lock。
- [ ] 确认 #835 CLOSED 只作为历史 baseline / related controlled-success owner，不作为当前 unlock evidence 或 live evidence。
- [ ] 确认本 suite 没有 runtime/source code、tests、fixtures、scripts、workflows、browser/account/live/write action、Syvert normalized result、provider adapter implementation 或 issue closeout。
- [ ] 确认 PR metadata 使用 `Refs #1178` / refs-only，并且 GitHub `closingIssuesReferences=[]`。

## 实现前待办

- [ ] #1180 consumes accepted operator unlock status but keeps default commit lock active until separately released.
- [ ] #1211 consumes operator unlock status, audit refs and fail-closed reasons in the release gate matrix.
- [ ] Future parser rejects implicit unlock sources and unknown operator actions.
- [ ] Future runtime owner records current scoped `operator_unlock_record` before any `live_write_commit` request.
- [ ] Future live-write implementation supplies current provider requirement, default lock release, account safety, runtime target binding, anti-detection gate and live evidence refs in addition to operator unlock.
