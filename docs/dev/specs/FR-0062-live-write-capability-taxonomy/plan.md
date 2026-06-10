# FR-0062 实施计划

## 实施目标

冻结 `#1174 Live-Write Capability Taxonomy` 的 formal spec suite，定义 `read_only`、`write_admit`、`write_prepare`、`live_write_commit` 四层 live-write capability taxonomy、gate vocabulary、downstream ownership 与 fail-closed 语义。

本 PR 只是 formal taxonomy/spec carrier。合入后只冻结 `FR-0062` suite 与 #1174 sync-map；不改变 #1174 issue 状态，不启用 `live_write_commit`，不实现 XHS publish，不执行 browser / account / live action，也不修复或重开 #835。

## 分阶段拆分

### 阶段 1：taxonomy scope 冻结

- 产出：`spec.md`
- 重点：冻结四层 capability level、非目标、#835 baseline disposition、GWT 和异常场景。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/live-write-capability-taxonomy.md`、`data-model.md`
- 重点：冻结 gate input / output、blocking reasons、owner map 和 logical entities，不引入 runtime persistence。

### 阶段 3：risk / research / handoff

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录上游 formal baseline、downstream owner 分工、#1178/#1179/#1180/#1211 消费方式，以及 default commit lock / operator unlock / account safety / live evidence misclaim 风险。

### 阶段 4：PR 与验证准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1174 映射、parser-ready PR metadata、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0062 suite 与单条 sync-map mapping，closing semantics 为 `Refs #1174`。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0062-live-write-capability-taxonomy/**`
  - `.github/spec-issue-sync-map.yml` 中 #1174 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不实现 #1178、#1179、#1180、#1211，不触碰 #1158 XHS driver contract branch。
- 不定义 Syvert normalized result，不实现 default `live_write_commit`，不声明 operator unlock、provider requirement pass、account safety clear 或 live evidence accepted。
- 不执行 browser/profile/account/live/external-visible actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、closing semantics 与 hosted checks：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0062-live-write-capability-taxonomy/spec.md`
- `bash scripts/check-pr-purity.sh docs/1174-live-write-capability-taxonomy main`
- `git diff --check origin/main...HEAD`
- same-class closing scan for `#1174` auto-closing patterns
- same-class scope audit for taxonomy terms, operator unlock references, provider requirement references, account safety refs, default commit lock refs, #835 baseline refs, live evidence claims and browser/account/live action claims
- hosted GitHub checks after Draft PR push

语义自检：

- 对照 issue #1174，确认 scope 只覆盖 taxonomy / vocabulary / downstream ownership。
- 对照 #1178，确认 operator unlock is downstream and not satisfied here.
- 对照 #1179，确认 provider requirements consume `write_admit` / `write_prepare` vocabulary but do not enable commit here.
- 对照 #1180，确认 `live_write_commit` remains locked by default.
- 对照 #1211，确认 release gate consumes taxonomy but cannot add implementation scope here.
- 对照 FR-0031 / FR-0032，确认 #835 closed baseline is historical background only.

## TDD 范围

当前 PR 只冻结 formal taxonomy，不进入实现代码 TDD。

后续 implementation / parser / release gate issue 应优先补以下测试：

- Unknown capability level fails closed.
- `write_admit` cannot satisfy `write_prepare` or `live_write_commit`.
- `write_prepare` cannot satisfy `live_write_commit`.
- Missing operator unlock rejects `live_write_commit`.
- Active default commit lock rejects `live_write_commit`.
- Provider requirement pass alone cannot unlock commit.
- Stub/fake host, runtime ping, bootstrap ack or historical #835 artifact cannot satisfy live commit evidence.
- Release gate matrix consumes #1174 vocabulary and refuses aliases.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0062 suite 的普通本仓库文档整理。
- #1178 / #1179 / #1180 / #1211 的只读 planning 可以并行准备，但不能声称 taxonomy 已合入前的 final gate pass。

串行 / 依赖：

- #1178 Operator Unlock、#1179 xhs.creator_publish.admit Provider Requirements、#1180 live_write_commit Default Lock 和 #1211 Live Write Gate Matrix 必须消费本 taxonomy 或 scheduler 指定的 frozen version。
- #1179 provider requirements can proceed only after capability names and blocking reasons are frozen.
- #1180 default lock semantics must not be weakened by #1179 or #1211.
- Any future live write implementation must still satisfy FR-0031 / FR-0032 / applicable live evidence gates after spec review 通过.

## 进入实现前条件

- FR-0062 spec review 通过。
- reviewer 确认四层 capability levels 无别名、无重叠、无默认 commit unlock。
- reviewer 确认 #1178 / #1179 / #1180 / #1211 ownership 清晰，且本 PR 不关闭 downstream items。
- reviewer 确认 #835 closed baseline 没有被当作当前 live evidence。
- reviewer 确认 PR metadata 使用 `Refs #1174` / refs-only，且 GitHub `closingIssuesReferences=[]`。
- reviewer 确认本 suite 未混入 runtime/source code、browser/account/live actions、Syvert normalized result、provider adapter implementation 或 issue closeout。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0062-live-write-capability-taxonomy/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1174 的映射。由于本 PR 不实现 runtime 行为，不需要 profile cleanup、account cleanup、artifact cleanup、external rollback 或 live evidence invalidation。
