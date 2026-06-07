# FR-0041 risks

## 风险等级

High。

理由：本 FR 冻结 evidence redaction shared policy，影响后续 provider evidence、official Chrome launch evidence、health evidence、fixture evidence、PR metadata、stdout summary 与 review gate 判断。虽然本 PR 不实现 runtime 行为，但 policy 一旦合入会成为后续实现和 review 的正式输入。

## 主要风险

### 1. Secret / account / private path 泄露

风险：后续 evidence、fixture、PR body 或 artifact 直接保存 Cookie、token、proxy credential、fingerprint seed、account identifier、profile path、browser binary path 或 Native Host secret，导致账号和环境暴露。

缓解：

- spec 将 secret、account-affine marker、binary/profile/private locator 分级为 `secret` 或至少 `sensitive`。
- PR body、stdout summary、fixture 和 spec sample 只能使用 synthetic、opaque 或 redacted values。
- secret leak 命中时必须输出 blocker，并将 evidence 判为 `invalid`。

### 2. Scope 污染 FR-0040 record shape

风险：redaction policy 为了完整性顺手新增或修改 `provider_evidence_record` 字段，导致与已关闭 #1128 / FR-0040 冲突。

缓解：

- spec 明确本 FR 只定义 FR-0040 既有 sensitivity / redaction_state / locator 语义，不新增字段。
- plan 将 FR-0040 文件列为禁止修改范围。
- validation 做 PR purity 检查，确认改动只限 FR-0041 suite 与 spec map。

### 3. #1143 重定义 redaction semantics

风险：official Chrome launch evidence 在实现时重新定义 binary/profile locator、secret handling 或 fixture 规则，使 #1129 policy 失去统一性。

缓解：

- spec 明确 #1143 必须消费本 policy，不能重新定义 redaction semantics。
- #1143 若需要例外，必须独立冻结 scope、risk 和 review gate。
- plan 将 #1143 consumption 作为串行关系和进入实现前条件。

### 4. Redaction success 被误当作 runtime/live success

风险：PR 或 closeout 将 redaction pass、doctor pass、bootstrap ack 或 health pass 写成 live evidence accepted。

缓解：

- spec 明确 redaction 只表示披露边界满足，不表示 evidence fresh、runtime-attested 或 live-accepted。
- health evidence pass 不替代 `FR-0016` live evidence record。
- 本 PR metadata 使用 `live_evidence_record=N/A`，不要求 fresh live evidence。

### 5. Fixture 样本污染

风险：为了测试 redaction，fixture 误提交真实 credential、profile path、browser history、storage 或 account identifier。

缓解：

- fixture policy 要求 synthetic、opaque 或 redacted values。
- 后续 implementation 必须覆盖 fixture synthetic value enforcement tests。
- spec sample 禁止真实 account/runtime/path/secret。

### 6. Integration metadata 过度升级或误降级

风险：本 FR 虽会被 #1143 消费，但 issue label 为 `integration:local-only`，若 PR metadata 误报跨仓 gate，会引入不必要外部依赖；若误称 live evidence，则触发错误专项门禁。

缓解：

- research 记录 integration 判断：本 PR 只冻结 WebEnvoy-local redaction policy，不改变 Syvert/shared output。
- PR metadata 使用 local-only integration。
- live evidence record 明确 `N/A`，并声明不执行 runtime/live/account 行为。

## 回滚

如 suite 被判定边界错误，使用 revert PR 移除 `FR-0041-evidence-redaction-policy` suite 与 `.github/spec-issue-sync-map.yml` 中 #1129 映射。由于本 PR 不实现 runtime 行为，无需数据迁移、secret rotation、profile 清理或 external runtime rollback。
