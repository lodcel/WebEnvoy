# FR-0041 实施计划

## 实施目标

本轮只冻结 #1129 Evidence Redaction Policy formal suite，覆盖 sensitivity、redaction state、public/private locator、secret handling、provider evidence、launch evidence、health evidence 与 fixture evidence 的默认脱敏规则。

本轮不实现 redaction engine、collector、artifact writer、CLI、browser launch、provider doctor、extension、Native Messaging、Playwright 或任何 runtime/live/account 行为。

## 分阶段拆分

### 阶段 1：formal suite scaffold

- 产出：`spec.md`、`plan.md`、`TODO.md`。
- 重点：冻结 #1129 scope、目标、非目标、GWT、异常边界和验收标准。

### 阶段 2：policy data model / risks / research

- 产出：`contracts/evidence-redaction-policy.md`、`data-model.md`、`risks.md`、`research.md`。
- 重点：说明本 FR 是 policy contract，不是 FR-0040 shape 修改；记录 FR-0040 输入、#1143 consumption 边界、local-only integration 判断和 secret/path/account 泄露风险。

### 阶段 3：spec map update

- 产出：`.github/spec-issue-sync-map.yml` 中 #1129 映射。
- 重点：将 `docs/dev/specs/FR-0041-evidence-redaction-policy/spec.md` 绑定 canonical issue #1129。

### 阶段 4：spec review PR

- 产出：PR、parser-friendly metadata、docs/spec/map/purity/diff checks、GitHub checks。
- 重点：证明本 PR 只冻结 #1129，不夹带 #1143/#1144，不修改 FR-0040 provider evidence record shape，不触发 live evidence gate。

### 阶段 5：后续 consumption handoff

- 产出：由 #1143 或后续 implementation issue 承接。
- 重点：#1143 official Chrome launch evidence 引用本 policy，不重新定义 secret、locator、profile/binary path 或 fixture redaction 语义。

## 实现约束

- 本 PR 只允许修改：
  - `docs/dev/specs/FR-0041-evidence-redaction-policy/**`
  - `.github/spec-issue-sync-map.yml` 中 #1129 对应映射
- 不改 `docs/dev/specs/FR-0040-provider-evidence-kernel/**`。
- 不改 #1143/#1144 对应 issue、spec、runtime 或 evidence implementation。
- 不改 `src/`、`shared/`、`extension/`、`bin/`、runtime、CLI formatter、fixtures generator 或 tests。
- 不改 `vision.md`、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、`.github/PULL_REQUEST_TEMPLATE.md`、`.github/workflows/**` 或 `scripts/**`。
- 不执行真实浏览器、live read/write、account-touching 或 external-visible 操作。
- 不要求 fresh live evidence；本 PR 的 `live_evidence_record` 为 `N/A`。

## 测试与验证策略

规约阶段验证：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0041-evidence-redaction-policy/spec.md`
- `git diff --check origin/main...HEAD`
- PR 纯度检查：变更仅限 FR-0041 suite 与 #1129 spec map
- GitHub hosted checks on latest head

不需要执行：

- live evidence rerun
- runtime.status / runtime.audit
- browser profile validation
- account safety validation
- browser/extension/Native Messaging/Playwright tests

原因：本 PR 不声称完成 live/runtime/account/launch 行为，也不修改运行时代码。

## TDD 范围

本规约 PR 不改代码，因此不新增 runtime tests。

后续 implementation 必须先覆盖：

- sensitivity classification tests。
- redaction state fail-closed tests。
- public/private locator validation tests。
- secret leak detection tests。
- fixture synthetic value enforcement tests。
- provider evidence redaction consumption tests。
- launch evidence profile/binary locator redaction tests。
- PR body/stdout summary disclosure boundary tests。

## 并行 / 串行关系

串行：

- FR-0040 必须先于本 FR；当前 #1128 已关闭，FR-0040 已在 main 提供 provider evidence redaction hooks。
- #1143 official Chrome launch evidence 必须消费本 policy，不得在 #1143 内重新定义 redaction semantics。
- 任何降低 secret/path/account disclosure 约束的实现必须等待本 FR formal review 通过后另开事项。

可并行：

- 不触碰 redaction semantics 的 provider runtime implementation prep 可并行，但不得合并违反本 policy 的 evidence sample。
- Health doctor 或 registry 事项可引用本 policy 的 surface guidance，但不得在自身 PR 中改写 policy。

禁止并行混线：

- 本 PR 不承载 #1143 official Chrome launch evidence。
- 本 PR 不承载 #1144 或任何 runtime/live closeout。
- 本 PR 不承载 FR-0040 record shape 修订。

## 进入实现前条件

- 本 FR spec PR 通过 spec review / guardian / GitHub checks 并合入 main，或 scheduler 明确允许后续分支基于当前 PR head 准备但不合并。
- reviewer 确认本 policy 不修改 FR-0040 provider evidence record shape。
- reviewer 确认 #1143 consumption 只引用本 policy，不重定义 redaction semantics。
- reviewer 确认 PR metadata 中 live evidence 为 `N/A`，且本 PR 未声称 runtime/live/account 闭环。
- 后续 implementation issue 明确它消费的 evidence surfaces、required redaction checks 与 fixture policy。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0041-evidence-redaction-policy/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1129 的映射项。由于本 PR 不实现 runtime 行为，不需要数据迁移、profile 清理、secret rotation 或 external runtime rollback。
