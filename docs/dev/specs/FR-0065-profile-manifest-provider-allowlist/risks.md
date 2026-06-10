# FR-0065 Risks

## 1. Manifest allow 被误读为 provider requirement pass

- 风险：downstream 把 accepted profile manifest 当成 #1179 provider requirements 已通过。
- 影响：provider capability、runtime readiness 或 risk constraints 未验证就进入后续 gate。
- 缓解：spec / contract / plan 均声明 manifest 只清除 allowlist blocker；#1179 或等价 downstream owner still provides provider requirement disposition.
- 回滚：修正 downstream PR metadata / gate result，恢复 `provider_requirement_ref_missing` 或 broader provider requirement blocker。

## 2. Manifest allow 被误读为 commit unlock

- 风险：manifest 允许 provider 后，下游直接把 `live_write_commit` 视为可用。
- 影响：绕过 operator unlock、default lock、account safety、runtime target binding、anti-detection gate 或 live evidence。
- 缓解：FR-0065 consumes FR-0062 and FR-0064; accepted manifest only clears profile manifest lane.
- 回滚：restore #1180 lock status to active and block commit until all downstream gates provide accepted current evidence.

## 3. Raw secret 或 private path 泄露

- 风险：profile manifest、example、artifact 或 PR metadata 写入 cookie、token、proxy password、fingerprint seed、raw account id 或 private profile path。
- 影响：账号、安全和隐私泄露。
- 缓解：secret refs must use `secret_handle` or redacted locator; `raw_secret_present` is always blocking.
- 回滚：redact and replace leaked refs; invalidate affected evidence until policy-compliant refs exist.

## 4. Provider scope 过宽

- 风险：manifest 使用 broad wildcard target、workflow 或 capability，让 provider 被用于未授权 profile/write scope。
- 影响：live-write admission risk surface 扩大。
- 缓解：workflow, target domain, target page and capability must match exact request; mismatch fails closed.
- 回滚：narrow manifest entries and rerun evaluator before downstream gate consumption.

## 5. Stale manifest 被复用

- 风险：head、profile、provider contract、secret refs 或 target scope 变化后继续复用旧 manifest。
- 影响：旧授权覆盖新运行时事实。
- 缓解：manifest carries `head_sha`, expiry and revocation; drift returns `manifest_head_mismatch`, `manifest_expired` or `manifest_revoked`.
- 回滚：invalidate stale manifest and require a fresh scoped manifest instance.

## 6. #835 historical baseline 被复用

- 风险：#835 CLOSED、旧 live artifact、runtime ping 或 bootstrap ack 被写成 current profile manifest evidence。
- 影响：latest-head live evidence and manifest semantics are bypassed.
- 缓解：FR-0065 treats #835 as historical context only; current manifest and secret refs are required.
- 回滚：remove invalid evidence refs and require current scoped manifest evidence.

## 7. Formal spec PR 声称 live success

- 风险：本 PR 或后续 spec-only PR 在 PR body 中声明 real browser/live/write success。
- 影响：触发 FR-0016 live evidence gate while lacking current latest-head evidence.
- 缓解：PR metadata must use `gate_applicability.in_scope=false`, `live_evidence_record=N/A`, and no live/browser/account action claims.
- 回滚：修正 PR body and rerun metadata readback before any review/gate.
