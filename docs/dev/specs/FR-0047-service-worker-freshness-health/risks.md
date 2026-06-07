# FR-0047 风险与缓解

## 风险 1：误定义新 health schema

- 风险：在 service worker freshness 名义下新增 parallel health result object，绕过 FR-0038 parser / gate。
- 缓解：spec 与 contract 明确唯一输出是 `FR-0038.provider_doctor_report`，check category 固定为 `extension_load`。
- 回滚：revert 本 suite 或删除越界字段，恢复为 FR-0038 check-level delta。

## 风险 2：抢占 #1140 persistent extension identity health

- 风险：把 extension id、installation source、profile installation identity 或 stable identity mismatch 写进本 FR。
- 缓解：本 FR 只比较 expected bundle identity 与 observed service worker code identity；persistent extension identity health 明确归 #1140。
- 回滚：把 persistent identity 语义移出 FR-0047，改为 boundary ref。

## 风险 3：抢占 #1141 native messaging health

- 风险：用 native bridge ready、manifest 或 allowed origins 作为 service worker freshness ready 证明。
- 缓解：spec 明确 runtime.ping、bootstrap ack 或 native bridge ready 不证明 service worker code identity fresh。
- 回滚：删除 native messaging readiness 语义，只保留 boundary mention。

## 风险 4：把历史 artifact 当作当前 freshness

- 风险：历史 service worker evidence 被当作 current runtime admission proof。
- 缓解：FR-0040 freshness 规则被明确消费，`historical_background` 不得满足 current freshness。
- 回滚：收紧 evidence requirement 为 current doctor / current launch / current PR head，由 downstream implementation 再细分。

## 风险 5：敏感 evidence 泄露

- 风险：service worker source、profile path、extension installation path、raw command output 或 secret 进入 PR body、stdout summary 或 fixture。
- 缓解：FR-0041 redaction policy 是 required evidence 前置；redaction gap 命中 required evidence 时 fail-closed。
- 回滚：移除具体 raw examples，改用 synthetic locator / redacted token。

## 风险 6：spec-only PR 被误读为 runtime 完成

- 风险：#1142 合入后被误解为已实现 service worker freshness health。
- 缓解：plan 与 TODO 明确本 PR 是 formal spec carrier，不实现 runtime；PR body使用 formal spec review lane。
- 回滚：在 PR / issue follow-up 中补充 implementation pending 说明。
