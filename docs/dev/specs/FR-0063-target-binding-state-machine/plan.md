# FR-0063 实施计划

## 实施目标

冻结 `#1161 Target Binding State Machine` 的 formal spec suite，定义 XHS target binding 的状态、状态转移、fail-closed 语义、证据边界，以及 #1162/#1171 可消费输入。

本 PR 是 formal spec review carrier。合入后只冻结 `FR-0063` suite 与 #1161 sync-map；不自动关闭 #1161，不进入 read path、page/runtime ready implementation、signed continuity implementation、live-write、browser/profile/account/live evidence、Syvert normalization、CloakBrowser-as-core、browser patching、default `live_write_commit` 或 #835 recovery。

## 分阶段拆分

### 阶段 1：formal scope 冻结

- 产出：`spec.md`
- 重点：冻结 ownership、state definitions、allowed transitions、binding snapshot、transition evidence、fail-closed reasons 与 downstream #1162/#1171 handoff。

### 阶段 2：contract / data model 落成

- 产出：`contracts/target-binding-state-machine.md`、`data-model.md`
- 重点：把 machine-consumable enums、snapshot/result shape、transition evidence、forbidden fields、lifecycle 与 consumer boundary 固定为后续分片输入。

### 阶段 3：research / risks / TODO

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 FR-0061 consumption、local-only integration 判断、live evidence N/A 判断，以及 stale evidence、ready proof、continuity proof、write/live scope creep 与 Syvert boundary 风险。

### 阶段 4：sync map 与 PR 准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1161 映射、parser-ready PR metadata、验证记录
- 重点：确保 PR 只包含 `FR-0063` suite 与单条 sync-map 映射，closing semantics 为 `Refs #1161`。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0063-target-binding-state-machine/**`
  - `.github/spec-issue-sync-map.yml` 中 #1161 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不修改 `FR-0061`、`FR-0062`、provider/evidence/redaction/live evidence contracts 的字段 shape。
- 不实现 #1162/#1171，也不扩大到 #1159/#1160/#1163 或 live-write lane。
- 不定义 Syvert normalized result、Syvert resource taxonomy、Syvert error taxonomy 或 Syvert workflow。
- 不执行 browser/profile/account/live/external-visible 动作。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；scheduler owns gate。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、metadata readback 与 hosted checks：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0063-target-binding-state-machine/spec.md`
- `bash scripts/check-pr-purity.sh docs/1161-target-binding-state-machine main`
- `git diff --check origin/main...HEAD`
- closing semantics same-class scan，确认只使用 `Refs #1161`，GitHub `closingIssuesReferences=[]`
- same-class scope audit，确认 target binding state machine、#1162/#1171 handoff、FR-0061 consumption、FR-0062 write boundary、Syvert boundary 与 live evidence claims 均符合本 FR
- PR push 后等待 hosted GitHub checks

语义自检：

- 对照 issue #1161，确认 scope 只覆盖 Target Binding State Machine formal suite。
- 对照 `FR-0061`，确认 runtime binding 只被消费和细化，不被升级为 runtime ready、target tab ready 或 live evidence。
- 对照 #1162，确认 page ready/runtime ready 仍由下游 owner 定义。
- 对照 #1171，确认 signed continuity 仍由下游 owner 定义。
- 对照 `FR-0062`，确认 `bound` 不启用 write capability 或 default `live_write_commit`。
- 对照 forbidden scope，确认未进入 read implementation、live-write、browser/account/live actions、Syvert normalized result、CloakBrowser-as-core、browser patching 或 #835 recovery。

## TDD 范围

当前 PR 不进入实现代码 TDD。

后续 implementation / consumer issue 应优先补：

- Target binding state machine parser / validator tests。
- Allowed transition and invalid transition tests。
- Stale/lost fail-closed tests for navigation, tab close, source owner mismatch and freshness expiry。
- Required evidence tests for candidate, URL, DOM, runtime state and extension bridge refs。
- Redaction tests，确认 snapshot/transition evidence 不泄露 Cookie、token、account id、profile path、private URL、private path 或 full page content。
- Downstream #1162 consumer tests，确认 non-bound states 不能当作 page/runtime ready pass。
- Downstream #1171 consumer tests，确认 `bound` 不能当作 signed continuity accepted。
- Live-write boundary tests，确认 `bound` 不提升 `live_write_commit`。

## 并行 / 串行关系

可并行：

- 不触碰 `FR-0063` suite 的其他 XHS driver downstream issue 只读 planning。
- #1162/#1171 可以准备消费 notes，但不得在本 PR 中实现。

串行 / 依赖：

- 本 work item 依赖已合入的 `FR-0061 XHS Driver Contract`。
- #1162 必须消费本 suite 的 `target_binding_snapshot` 后再定义 page/runtime ready gate。
- #1171 必须消费本 suite 的 transition evidence 后再定义 signed continuity。
- Read path implementation 必须等待 target binding / page runtime ready / evidence owner 的适用 contract 和 review。
- Live-write、default commit lock、operator unlock 和 #835 recovery 必须等待各自正式 owner。

## 进入实现前条件

- FR-0063 spec review 通过。
- reviewer 确认九个 states 与 allowed transitions 无歧义。
- reviewer 确认 `bound` 只是 target binding pass input，不证明 #1162 page/runtime ready 或 #1171 signed continuity。
- reviewer 确认 stale / lost / invalid transition / missing evidence / redaction invalid 均 fail closed。
- reviewer 确认 #1162/#1171 handoff 是可消费输入，不是实现或 pass 结论。
- reviewer 确认 read implementation、live-write、browser/account/live actions、Syvert normalized result、CloakBrowser-as-core、browser patching、default `live_write_commit` 与 #835 recovery 均被排除。
- reviewer 确认 PR closing semantics 使用 `Refs #1161`，且 sync-map 只新增单条映射。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0063-target-binding-state-machine/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1161 的映射。由于本 PR 不实现 runtime 行为，不需要数据迁移、profile cleanup、browser cleanup、secret rotation、artifact cleanup、live cleanup 或 external rollback。
