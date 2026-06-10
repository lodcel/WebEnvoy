# FR-0062 Risks

## 1. Taxonomy merge 被误读为 commit unlock

- 风险：FR-0062 合入后，下游把 `live_write_commit` term 存在误读为 default commit allowed。
- 影响：真实外部可见写入可能绕过 operator unlock、account safety 或 live evidence gate。
- 缓解：spec / contract / plan 均声明 `live_write_commit` 默认 locked，并由 #1178 / #1180 / #1211 继续消费。
- 回滚：revert FR-0062 suite 与 sync-map entry；下游 gate 不得消费撤回版本。

## 2. Provider requirement pass 被误用为 live commit evidence

- 风险：#1179 provider requirement alignment 只证明 admission prerequisites，却被写成 publish-ready。
- 影响：provider declaration 或 `xhs.creator_publish.admit` pass 会越权替代 runtime/live evidence。
- 缓解：taxonomy separates `write_admit` from `write_prepare` and `live_write_commit`; provider requirement alone cannot unlock commit.
- 回滚：修正 downstream PR metadata / gate result，并阻断 merge-ready。

## 3. Operator unlock ownership 混入 #1174

- 风险：#1174 PR 顺手定义或满足 operator unlock audit evidence。
- 影响：#1178 owner 被绕过，审计证据和人工责任边界不清。
- 缓解：#1174 only maps operator unlock as downstream owner; no unlock record is created.
- 回滚：删除越权 unlock language，保留 only owner map。

## 4. #835 closed baseline 被复用为当前 live evidence

- 风险：#835 CLOSED or FR-0032 historical baseline is treated as current `live_write_commit` evidence.
- 影响：latest-head fresh evidence gate and cleanup/risk closeout semantics are bypassed.
- 缓解：FR-0062 explicitly marks #835 as historical baseline / controlled-success owner, not current evidence.
- 回滚：remove or correct any PR body / issue comment that presents #835 closed state as live evidence.

## 5. Account safety unknown 被降级为 non-blocking

- 风险：taxonomy consumers treat missing account safety as advisory instead of blocking for commit.
- 影响：账号风险和外部可见写入风险扩大。
- 缓解：`account_safety_unknown` is a frozen blocking reason for `live_write_commit`.
- 回滚：downstream gate must mark result blocked / deny and rerun only after accepted account safety evidence exists.

## 6. Live evidence claim 出现在 formal spec PR

- 风险：本 PR 或后续 spec-only PR 在 PR body 中声明 real browser/live success。
- 影响：触发 FR-0016 gate while lacking current latest-head live evidence.
- 缓解：FR-0062 PR metadata must use `gate_applicability.in_scope=false`, `live_evidence_record=N/A`, and no live/browser/account action claims.
- 回滚：修正 PR body and rerun metadata readback before any review/gate.

## 7. Aliases break downstream machine checks

- 风险：downstream uses `write_ready`, `publish_ready` or `live_write` instead of frozen levels.
- 影响：release gate cannot compare capability levels or enforce default lock.
- 缓解：contract requires unknown terms to fail closed with `unknown_capability_level`.
- 回滚：replace aliases with frozen enum values before downstream implementation or release gate proceeds.
