# FR-0034 实施计划

## 实施目标

本轮只冻结 Command Envelope v2 的 formal design 和兼容契约，覆盖 `ok`、`command`、`run_id`、`data`、`operational`、`evidence`、`warnings`、`errors`，并明确不破坏 current v1 CLI consumers。

本轮不实现 runtime / CLI 行为，不改变默认 stdout，不执行 live/runtime/account 验证。

## 分阶段拆分

### 阶段 1：formal suite scaffold

- 产出：`spec.md`、`plan.md`、`TODO.md`。
- 重点：冻结 #1131 scope、目标、非目标、v1 compatibility 和 GWT。

### 阶段 2：command envelope contract

- 产出：`contracts/command-envelope-v2.md`。
- 重点：冻结 v2 type shape、v1 conversion、error/warning/evidence/operational 子结构。

### 阶段 3：data model / research / risks

- 产出：`data-model.md`、`research.md`、`risks.md`。
- 重点：说明 v2 是非持久 stdout model，记录当前 v1 输入证据，分类兼容、敏感信息、integration 和 evidence 风险。

### 阶段 4：spec review PR

- 产出：Draft PR、metadata、docs/spec checks、guardian/review、GitHub checks。
- 重点：证明本 PR 只冻结 design，不夹带 #1133/#1134/#1135/#1136 实现，不修改五个治理冻结目标文件。

### 阶段 5：后续 implementation issues

- 产出：由 #1133 / #1134 / #1135 / #1136 各自承接。
- 重点：按本 FR 契约分块实现和验证，不在 #1131 PR 中提前实现。

## 实现约束

- 本 PR 只允许修改 `docs/dev/specs/FR-0034-command-envelope-v2-design/` 以及 `.github/spec-issue-sync-map.yml` 中 #1131 对应映射。
- 不改 `src/`、`shared/`、`extension/`、`bin/`、runtime、CLI formatter 或 tests。
- 不改 `vision.md`、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、`docs/dev/review/guardian-review-addendum.md`、`.github/PULL_REQUEST_TEMPLATE.md`。
- 不改变默认 CLI output。
- 不引入 Syvert normalized result、Provider adapter contract 或 integration-gated shared contract。
- 不执行真实浏览器、live read/write、account-touching 或 external-visible 操作。

## 测试与验证策略

规约阶段验证：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `git diff --check`
- `npm test -- --runInBand` 或仓库当前等价静态/单测命令，若适用
- PR body metadata parser / open-pr helper 可消费
- guardian / review 无阻断
- GitHub checks 全绿

不需要执行：

- live evidence rerun
- runtime.status / runtime.audit
- browser profile validation
- account safety validation

原因：本 PR 不声称完成 live/runtime/account 闭环，也不修改运行时代码。

## TDD 范围

- 本规约 PR 不改代码，因此不新增 runtime tests。
- #1133 后续必须覆盖 v1 success `summary` 到 v2 `data` 的 mapping tests。
- #1134 后续必须覆盖 `observability` / `error.diagnosis` 到 `operational` / `errors[0].diagnosis` 的 mapping tests。
- #1135 后续必须覆盖 `warnings`、`evidence`、multi-error primary selection、sensitive redaction 和 truncation disclosure tests。
- #1136 后续必须覆盖 v1 default compatibility、explicit v2 mode、stdout single JSON、exit code stability 和 consumer migration gate tests。

## 并行 / 串行关系

串行：

- #1131 spec review 必须先于 #1133 / #1134 / #1135 / #1136 implementation closeout。
- #1136 compatibility gate 必须在 #1133 / #1134 / #1135 的关键映射实现之后收口。

可并行：

- #1133、#1134、#1135 可在 #1131 合入后并行准备，只要 ownership 不重叠。
- 后续 command-specific `data` payload specs 可与 #1134 operational implementation 并行，但不得重定义本 FR 顶层字段。

## 进入实现前条件

- #1131 spec PR 通过 spec review / guardian / GitHub checks 并合入 main，或主调度明确允许后续 implementation branch 基于当前 PR head 准备但不合并。
- reviewer 确认 v2 不改变 v1 default output。
- reviewer 确认 v2 不包含 Syvert normalized result、Provider adapter 或 live evidence gate 替代语义。
- implementation PR 明确关联 #1133 / #1134 / #1135 / #1136 中的具体事项，不复用 #1131 扩 scope。
