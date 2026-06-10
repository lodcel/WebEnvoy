# FR-0064 实施计划

## 实施目标

冻结 `#1178 Operator Unlock` 的 formal spec suite，定义 `live_write_commit` 的显式 operator unlock 条件、audit evidence refs、scope 精确匹配、fail-closed 默认，以及 #1180 / #1211 可消费的 handoff 输入。

本 PR 只是 formal contract/spec carrier。合入后只冻结 `FR-0064` suite 与 #1178 sync-map；不启用 `live_write_commit`，不实现 XHS publish，不执行 browser / account / live / write action，也不修复或重开 #835。

## 分阶段拆分

### 阶段 1：operator unlock scope 冻结

- 产出：`spec.md`
- 重点：冻结 owner、目标、非目标、unlock scope、explicit operator action、fail-closed 规则、GWT 和异常场景。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/operator-unlock.md`、`data-model.md`
- 重点：冻结 operator unlock record、risk acknowledgement、evidence refs、evaluation input/result、blocking reasons 和 logical entities，不引入 runtime persistence。

### 阶段 3：risk / research / handoff

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 FR-0062 taxonomy 输入、#1178 issue readback、#1180/#1211 消费方式、#835 baseline disposition，以及 implicit unlock / scope drift / stale evidence 风险。

### 阶段 4：PR 与验证准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1178 映射、parser-ready PR metadata、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0064 suite 与单条 sync-map mapping，closing semantics 为 `Refs #1178`。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0064-operator-unlock/**`
  - `.github/spec-issue-sync-map.yml` 中 #1178 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不实现 #1179、#1180、#1211，不触碰 #1158 XHS driver contract branch。
- 不定义 Syvert normalized result，不解除 default `live_write_commit` lock，不声明 provider requirement pass、account safety clear、runtime target binding pass、anti-detection gate pass 或 live evidence accepted。
- 不执行 browser/profile/account/live/external-visible/write actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、closing semantics 与 hosted checks：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0064-operator-unlock/spec.md`
- `bash scripts/check-pr-purity.sh docs/1178-operator-unlock main`
- `git diff --check origin/main...HEAD`
- same-class closing scan for `#1178` auto-closing patterns
- same-class scope audit for operator unlock references, default lock references, provider requirement references, account safety refs, live evidence claims, #835 baseline refs and browser/account/live/write action claims
- hosted GitHub checks after Draft PR push

语义自检：

- 对照 issue #1178，确认 scope 只覆盖 operator unlock requirements and audit evidence。
- 对照 FR-0062，确认 `live_write_commit` 仍默认 locked，且缺 operator unlock returns `operator_unlock_missing`。
- 对照 #1180，确认 accepted operator unlock 不解除 default commit lock。
- 对照 #1211，确认 release gate consumes unlock status but cannot treat spec text as current evidence。
- 对照 FR-0031 / FR-0032，确认 admission / controlled success evidence 未被本 PR 声称完成。
- 对照 #835，确认 closed baseline is historical background only.

## TDD 范围

当前 PR 只冻结 formal operator unlock contract，不进入实现代码 TDD。

后续 implementation / parser / release gate issue 应优先补以下测试：

- Missing operator unlock record rejects `live_write_commit`.
- Expired operator unlock record rejects `live_write_commit`.
- Revoked operator unlock record rejects `live_write_commit`.
- Scope mismatch rejects `live_write_commit`.
- Head mismatch rejects `live_write_commit`.
- Missing risk acknowledgement rejects unlock.
- PR approval, issue state, guardian approval or hosted checks pass cannot substitute unlock record.
- Accepted operator unlock does not release default commit lock.
- Stub/fake host, runtime ping, bootstrap ack, #835 closed state or historical artifacts cannot satisfy unlock evidence.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0064 suite 的普通本仓库文档整理。
- #1180 / #1211 的只读 planning 可以并行准备，但不能声称 operator unlock 已实现或默认 lock 已释放。

串行 / 依赖：

- FR-0064 consumes merged FR-0062 taxonomy.
- #1180 live_write_commit Default Lock must consume the FR-0064 unlock result before any default lock release path.
- #1211 Live Write Gate Matrix must consume the FR-0064 status and blocking reasons before release-gate closeout.
- Any future live write implementation must still satisfy FR-0031 / FR-0032 / applicable live evidence gates after spec review 通过.

## 进入实现前条件

- FR-0064 spec review 通过。
- reviewer 确认 operator unlock 是显式 record，不可由 PR approval、issue state、label、merged spec 或 hosted checks 推断。
- reviewer 确认 unlock scope 精确匹配，且 profile/target/workflow/provider/head drift fail closed。
- reviewer 确认 accepted unlock only clears operator lane and does not release #1180 default lock.
- reviewer 确认 #835 closed baseline 没有被当作当前 unlock evidence 或 live evidence。
- reviewer 确认 PR metadata 使用 `Refs #1178` / refs-only，且 GitHub `closingIssuesReferences=[]`。
- reviewer 确认本 suite 未混入 runtime/source code、browser/account/live/write actions、Syvert normalized result、provider adapter implementation 或 issue closeout。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0064-operator-unlock/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1178 的映射。由于本 PR 不实现 runtime 行为，不需要 profile cleanup、account cleanup、artifact cleanup、external rollback 或 live evidence invalidation。
