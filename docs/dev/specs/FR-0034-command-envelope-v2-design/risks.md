# FR-0034 Risks

## 风险 1：破坏 current CLI consumers

- 表现：后续实现直接把默认 stdout 从 v1 改为 v2，现有 consumer 解析 `status`、`summary` 或 `error` 失败。
- 缓解：本 FR 明确默认 v1 输出不变；v2 只能通过显式模式、preview 或后续 migration gate 引入。
- 回滚：恢复 v1 formatter 为默认输出，v2 只保留在显式输出路径。

## 风险 2：把 WebEnvoy 输出误提升为 Syvert normalized result

- 表现：`data` 被写成 Syvert business mapping 或 project state，导致 WebEnvoy core 依赖上层业务语义。
- 缓解：本 FR 明确 `data` 是 WebEnvoy command result，不冻结 Syvert normalized schema。
- 回滚：移除上层 normalized 字段，改由 Syvert 自身边界消费 v2 后映射。

## 风险 3：`summary` 到 `data` 迁移丢语义

- 表现：v1 `summary` 中混合业务结果和诊断字段，后续实现整块搬进 `data` 或整块塞进 `operational`。
- 缓解：本 FR 要求业务结果进入 `data`，兼容镜像进入 `operational.compat`，诊断进入 `operational` / `errors[*].diagnosis`。
- 回滚：保留 v1 summary 原样输出，并修正 v2 mapper。

## 风险 4：warning 掩盖阻断错误

- 表现：证据缺失、账号风险或 runtime blocker 被写成 warning，`ok=true` 被误报。
- 缓解：阻断条件必须进入 `errors`，且 `ok=false`；warning 只承载非阻断告警。
- 回滚：把对应 warning 升级为 error，并补充 category / diagnosis。

## 风险 5：evidence 引用被误当 live evidence gate

- 表现：generic `evidence` ref 被用来替代 PR `live_evidence_record` 或具体 FR closeout evidence。
- 缓解：本 FR 明确 `evidence` 只是 command envelope 内的 evidence refs，不替代 live evidence 专项门禁。
- 回滚：在对应 PR / issue 中恢复 latest-head fresh evidence metadata，并把 envelope evidence 降为辅助引用。

## 风险 6：敏感信息泄露

- 表现：raw platform payload、Cookie、Token、完整请求体或响应体进入 `data`、`operational`、`evidence.summary`、`warnings` 或 `errors`。
- 缓解：继承 FR-0004 脱敏、净化和截断规则；敏感内容必须先脱敏再截断。
- 回滚：移除泄露字段，补充 limit disclosure 和 sanitizer tests。

## 风险 7：多错误列表导致主因不稳定

- 表现：`errors` 数组排序变化导致 consumer 对主错误的判断漂移。
- 缓解：`errors[0]` 固定为主错误，related errors 只能作为补充。
- 回滚：恢复稳定排序与 primary error selection。
