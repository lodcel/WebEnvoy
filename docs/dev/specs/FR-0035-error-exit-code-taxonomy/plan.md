# FR-0035 实施计划

## 实施目标

本轮只冻结 #1133 的错误与退出码 taxonomy formal suite，覆盖 validation、risk gate denied、provider unavailable、runtime failure、closeout failure、schema/evidence failure 与 FR-0034 Command Envelope v2 的对齐关系。

本轮不实现 CLI、runtime、provider、closeout 或 evidence 生成行为。

## 分阶段拆分

### 阶段 1：formal suite scaffold

- 产出：`spec.md`、`plan.md`、`TODO.md`。
- 重点：冻结 #1133 scope、目标、非目标、GWT、异常边界和验收标准。

### 阶段 2：taxonomy contract

- 产出：`contracts/error-exit-code-taxonomy.md`。
- 重点：冻结 error family、canonical error code、FR-0034 category、exit code class、v2 additive fields 和 v1 compatibility。

### 阶段 3：data model / research / risks

- 产出：`data-model.md`、`research.md`、`risks.md`。
- 重点：说明本 FR 是非持久 stdout/exit model，记录 FR-0001/FR-0004/FR-0034 输入证据，分类兼容、integration、evidence 与 closeout 风险。

### 阶段 4：spec review PR

- 产出：PR、parser-friendly metadata、docs/spec checks、guardian/review、GitHub checks。
- 重点：证明本 PR 只冻结 #1133，不夹带 #1134/#1135/#1136，不修改运行时代码，不触发 Syvert/shared integration gate。

### 阶段 5：后续 implementation handoff

- 产出：由后续实现事项承接。
- 重点：按本 FR 编写 mapping tests、formatter tests、exit code tests 和 compatibility gate，不在本 FR PR 中提前实现。

## 实现约束

- 本 PR 只允许修改：
  - `docs/dev/specs/FR-0035-error-exit-code-taxonomy/**`
  - `.github/spec-issue-sync-map.yml` 中 #1133 对应映射
- 不改 `src/`、`shared/`、`extension/`、`bin/`、runtime、CLI formatter 或 tests。
- 不改 #1134/#1135/#1136 对应 spec 或 issue scope。
- 不改 `vision.md`、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、`docs/dev/review/guardian-review-addendum.md`、`.github/PULL_REQUEST_TEMPLATE.md`。
- 不改变默认 CLI output、stderr 边界或现有退出码 `0` 到 `6`。
- 不引入 Syvert normalized result、Provider adapter contract 或 integration-gated shared contract。
- 不执行真实浏览器、live read/write、account-touching 或 external-visible 操作。

## 测试与验证策略

规约阶段验证：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `git diff --check`
- PR body metadata parser / open-pr helper 可消费
- 纯度检查：变更仅限 FR-0035 suite 与 #1133 spec map
- guardian / review 无阻断
- GitHub checks 全绿

不需要执行：

- live evidence rerun
- runtime.status / runtime.audit
- browser profile validation
- account safety validation
- CLI behavior tests

原因：本 PR 不声称完成 live/runtime/account/CLI 行为，也不修改运行时代码。

## TDD 范围

- 本规约 PR 不改代码，因此不新增 runtime tests。
- 后续实现必须先覆盖：
  - error family 到 exit code class 的 mapping tests
  - `errors[0]` primary selection tests
  - v1 error conversion tests
  - provider unavailable vs runtime failure boundary tests
  - closeout failure vs schema/evidence failure boundary tests
  - risk gate denied 不落入 warning 或 execution failed 的 tests

## 并行 / 串行关系

串行：

- FR-0034 必须先于本 FR；当前 #1131 已合入 main。
- 本 FR spec review 必须先于任何依赖 #1133 taxonomy 的 implementation closeout。
- #1136 compatibility gate 必须在 taxonomy implementation 和其他 command envelope migration 事项完成后收口。

可并行：

- #1134 和 #1135 可以在不重定义 #1133 taxonomy 的前提下并行准备。
- 命令级 payload spec 可以与本 FR 后续 implementation 并行，但不得重编号退出码或重定义 error family。

禁止并行混线：

- 本 PR 不承载 #1134 operational/diagnosis migration。
- 本 PR 不承载 #1135 evidence/warning/error list output governance。
- 本 PR 不承载 #1136 final compatibility gate。

## 进入实现前条件

- 本 FR spec PR 通过 spec review / guardian / GitHub checks 并合入 main，或主调度明确允许实现分支基于当前 PR head 准备但不合并。
- reviewer 确认本 taxonomy 不改变 current v1 default output。
- reviewer 确认新增退出码 `7` 到 `9` 只作为后续实现加法使用。
- reviewer 确认本 taxonomy 不包含 Syvert normalized result、Provider adapter payload 或 live evidence PR metadata 替代语义。
- implementation PR 明确关联具体实现 issue，不复用 #1133 spec PR 扩 scope。
