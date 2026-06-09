# FR-0054 Plan

## 实施目标

冻结 CloakBrowser persistent profile health 的 formal suite，使后续 health implementation、capability matrix、runtime admission 与 evidence owners 有稳定输入。交付范围只包含文档契约与 sync-map；不实现 doctor、runtime、extension、Native Messaging、fixture、test 或 live evidence。

## 分阶段拆分

### 阶段 1：契约冻结

- 新增 `spec.md`，冻结目标、非目标、功能需求、GWT、异常边界、验收标准与完成定义。
- 新增 `contracts/cloakbrowser-persistent-profile-health.md`，冻结 v1 schema、枚举、normative rules、valid/invalid examples。
- 明确 `does_not_prove` 与 `next_required_gates`，防止 health pass 被误用为 runtime/live/capability proof。

### 阶段 2：数据与风险边界

- 新增 `data-model.md`，说明核心实体、关系、生命周期与 persistent descriptor / provider doctor 的消费关系。
- 新增 `research.md`，记录本 FR 依赖的正式输入与取舍，不把研究结论替代契约。
- 新增 `risks.md`，覆盖 health pass 语义泄漏、敏感证据泄漏、extension/native messaging 过度证明、历史 artifact 污染等风险。

### 阶段 3：PR-ready 元数据与验证

- 新增 `TODO.md`，只表达当前 formal suite 的停点与后续恢复入口。
- 在 `.github/spec-issue-sync-map.yml` 添加 FR-0054 -> #1151 的单条映射，保持既有映射不变。
- 创建 Draft PR，PR body 使用 `Closing: Refs #1151`，并提供 parser-ready `closeout_control`、`integration_check`、`gate_applicability`、`live_evidence_record`。

## 实现约束

- 写路径仅限：
  - `docs/dev/specs/FR-0054-cloakbrowser-persistent-profile-health/**`
  - `.github/spec-issue-sync-map.yml`
- 不触碰 runtime code、doctor command、extension loading behavior、capability matrix、limitation gate、Native Messaging bridge、browser patching、XHS、Syvert 或 live evidence execution。
- 不修改 `.github/workflows/**`、`scripts/**`、`.githooks/**`、`AGENTS.md`、`code_review.md`。
- 不修改 #1149/#1150/#1152/#1153/#1154/#1155/#1156/#1157 的 spec suites 或 sync-map entries，除 rebase 保持既有映射外不得变更。
- 本 PR 是 formal spec review PR，保持 refs-only，不关闭 #1151。
- 高成本 guardian/formal review/controlled merge/issue closeout 归 scheduler，不由 worker 执行。

## 测试与验证策略

本 FR 不包含 runtime 实现，验证聚焦文档结构、sync-map、分支纯度与关闭语义：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0054-cloakbrowser-persistent-profile-health/spec.md`
- `bash scripts/check-pr-purity.sh docs/1151-cloakbrowser-persistent-profile-health main`
- `git diff --check origin/main...HEAD`
- same-class search：确认 diff / PR body 不含 auto-close keyword 关联 #1151 的语义。

## TDD 范围

本 PR 不实现代码，不新增单元测试或 E2E。后续实现 issue 若新增 doctor/health parser 或 artifact validator，应先覆盖：

- profile binding mismatch fail-closed
- stale / historical freshness fail-closed
- extension loaded but command proof absent remains non-proof
- native messaging surface pass but round-trip proof absent remains non-proof
- redaction invalid evidence fail-closed

## 并行 / 串行关系

- 串行前置：`FR-0038` provider doctor contract、`FR-0050` persistent descriptor。
- 可并行参考：`FR-0058` final args evidence、`FR-0059` fingerprint seed policy；它们提供 evidence / redaction 口径，但不阻塞本 FR。
- 下游消费：#1149 capability matrix、后续 persistent health implementation、runtime admission、launch/evidence owners。
- 本 FR 不解除 #1149 的 blockedBy，也不推进 #1152/#1153。

## 进入实现前条件

后续 implementation owner 进入实现前必须满足：

1. 本 formal suite 已通过 spec review 并合入。
2. #1151 的 sync-map 已被 repo 与 issue truth 消费。
3. implementation issue 明确 health checker 的输入来源、artifact writer、redaction policy 与 fail-closed parser。
4. runtime / live / capability proof 仍由各自 owner 独立 gated，不得复用本 health pass 作为替代证明。

## Omission 说明

本 suite 创建 `contracts/`、`data-model.md`、`research.md` 与 `risks.md`，因为该事项涉及共享 health surface、evidence redaction、profile identity、extension/native messaging admission 与 fail-closed 输出边界。没有省略高风险 FR 的必需文件。
