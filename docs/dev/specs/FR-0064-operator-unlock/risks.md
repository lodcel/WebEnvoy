# FR-0064 Risks

## 1. Spec merge 被误读为 operator unlock

- 风险：FR-0064 合入后，下游把 contract frozen 误读为某个 live commit scope 已获得 operator unlock。
- 影响：真实外部可见写入可能绕过显式操作者动作、risk acknowledgement 或 audit trail。
- 缓解：spec / contract / plan 均声明本 PR 不创建 unlock record；downstream must provide current `operator_unlock_record`.
- 回滚：修正 downstream PR metadata / gate result，删除任何把 spec 文本当作 unlock evidence 的表述。

## 2. PR approval / guardian approve 被误用为 unlock

- 风险：review approval、guardian verdict 或 hosted checks pass 被当成 operator action。
- 影响：缺少 scope、expiry、revocation 和 risk acknowledgement。
- 缓解：contract requires `operator_action=unlock_live_write_commit` and auditable evidence refs.
- 回滚：gate result must return `operator_unlock_missing` until a valid record exists.

## 3. Scope drift 后继续复用旧 unlock

- 风险：profile、target、workflow、provider ref、default lock ref、browser channel、execution surface 或 head 改变后仍复用旧 unlock。
- 影响：unlock 覆盖范围扩大，可能触发非预期账号或页面写入。
- 缓解：exact scope matching and `unlock_head_mismatch` / `operator_unlock_scope_mismatch` fail closed.
- 回滚：invalidate stale unlock and request a new operator action for the new scope.

## 4. Accepted unlock 被误读为 default lock release

- 风险：下游把 accepted operator unlock 当作 #1180 default commit lock 已释放。
- 影响：`live_write_commit` default lock 被绕过。
- 缓解：FR-0064 only clears operator lane; #1180 owns default lock release.
- 回滚：restore #1180 lock status to active and block commit until #1180 accepted disposition exists.

## 5. Account safety unknown 被 operator acknowledgement 掩盖

- 风险：operator acknowledged risk 被误用为 account safety clear。
- 影响：账号风险扩大。
- 缓解：`account_safety_ref` is required evidence locator; acknowledgement does not prove gate pass.
- 回滚：gate result returns `account_safety_ref_missing` or broader FR-0062 `account_safety_unknown`.

## 6. Historical evidence 被复用

- 风险：#835 CLOSED、旧 live artifact、same-head historical artifact、runtime ping 或 bootstrap ack 被写成 unlock evidence。
- 影响：latest-head evidence and operator audit semantics are bypassed.
- 缓解：contract marks these evidence classes invalid for operator unlock.
- 回滚：remove invalid evidence refs and require current scoped refs.

## 7. Redaction 不合规

- 风险：unlock evidence refs 内联账号、cookie、token、profile path、页面正文或 media payload。
- 影响：隐私和安全泄露。
- 缓解：evidence refs are locators only and must follow FR-0041 redaction policy.
- 回滚：redact and replace evidence refs before any gate consumes them.

## 8. Formal spec PR 声称 live success

- 风险：本 PR 或后续 spec-only PR 在 PR body 中声明 real browser/live/write success。
- 影响：触发 FR-0016 live evidence gate while lacking current latest-head evidence.
- 缓解：FR-0064 PR metadata must use `gate_applicability.in_scope=false`, `live_evidence_record=N/A`, and no live/browser/account action claims.
- 回滚：修正 PR body and rerun metadata readback before any review/gate.
