# FR-0066 实施计划

## 实施目标

冻结 `#1176 Account Safety Gate` 的 formal spec suite，定义 `write_prepare` 与 `live_write_commit` admission 前必须具备的 account safety state、evidence refs、freshness、scope matching、redaction 与 fail-closed behavior。

本 PR 只是 formal contract/spec carrier。合入后只冻结 `FR-0066` suite 与 #1176 sync-map；不启用 `live_write_commit`，不实现 XHS publish，不执行 browser / account / live / write action，也不修复、重跑或重开 #835。

## 分阶段拆分

### 阶段 1：account safety gate scope 冻结

- 产出：`spec.md`
- 重点：冻结 owner、目标、非目标、scope binding、state enum、safety signals、fail-closed 规则、GWT 和异常场景。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/account-safety-gate.md`、`data-model.md`
- 重点：冻结 account safety scope、state record、evidence refs、evaluation input/result、blocking reasons 和 logical entities，不引入 runtime persistence。

### 阶段 3：risk / research / handoff

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 FR-0062 taxonomy、FR-0064 operator unlock、FR-0032/#835 baseline、FR-0041/#1181 redaction 输入，以及 #1179/#1180/#1211 downstream handoff。

### 阶段 4：PR 与验证准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1176 映射、parser-ready PR metadata、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0066 suite 与单条 sync-map mapping，closing semantics 为 `Fixes #1176` because issue #1176 close semantics are `fr-complete`.

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0066-account-safety-gate/**`
  - `.github/spec-issue-sync-map.yml` 中 #1176 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不实现 #1179、#1180、#1211，不触碰 #1175/#1177 或 #835 recovery。
- 不定义 Syvert normalized result，不解除 default `live_write_commit` lock，不声明 operator unlock accepted、provider requirement pass、runtime target binding pass、anti-detection gate pass 或 live evidence accepted。
- 不执行 browser/profile/account/live/external-visible/write actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、closing semantics 与 hosted checks：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0066-account-safety-gate/spec.md`
- `bash scripts/check-pr-purity.sh docs/1176-account-safety-gate main`
- `git diff --check origin/main...HEAD`
- same-class closing scan for `#1176` auto-closing patterns and unintended references to #1175/#1177/#1179/#1180/#835 recovery
- same-class scope audit for account safety refs, operator unlock refs, default lock refs, provider requirement refs, live evidence claims and browser/account/live/write action claims
- hosted GitHub checks after Draft PR push

语义自检：

- 对照 issue #1176，确认 scope 只覆盖 Account Safety Gate formal contract。
- 对照 FR-0062，确认 `write_prepare` / `live_write_commit` require account safety and still need other gates。
- 对照 FR-0064，确认 operator unlock cannot imply account safety clear。
- 对照 FR-0041 / #1181，确认 evidence refs are redacted locators only。
- 对照 FR-0032 / #835，确认 #835 closed baseline is historical background only。

## TDD 范围

当前 PR 只冻结 formal account safety gate contract，不进入实现代码 TDD。

后续 implementation / parser / release gate issue 应优先补以下测试：

- Missing account safety state rejects `write_prepare`.
- Unknown account safety state rejects `write_prepare`.
- Stale account safety state rejects `live_write_commit`.
- Scope mismatch rejects safety clear.
- Head mismatch rejects safety clear.
- Redaction invalid rejects safety clear.
- Operator unlock accepted does not imply account safety clear.
- #835 closed state cannot satisfy current safety clear.
- Stub/fake host, runtime ping, bootstrap ack or control-plane-only signal cannot satisfy safety clear.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0066 suite 的普通本仓库文档整理。
- #1179 / #1180 / #1211 的只读 planning 可以并行准备，但不能声称 account safety gate 已实现或当前 scope clear。

串行 / 依赖：

- FR-0066 consumes merged FR-0062 taxonomy.
- FR-0066 consumes merged FR-0064 operator unlock by clarifying that unlock does not imply safety clear.
- #1179 provider requirements must consume FR-0066 safety result before allowing `write_prepare`-adjacent provider requirement disposition.
- #1180 default lock must consume FR-0066 safety result before any exact-scope default lock release.
- #1211 Live Write Gate Matrix must consume FR-0066 status and blocking reasons before release-gate closeout.
- Any future live write implementation must still satisfy FR-0031 / FR-0032 / applicable live evidence gates after spec review 通过.

## 进入实现前条件

- FR-0066 spec review 通过。
- reviewer 确认 account safety state 是 explicit scoped result，不可由 #835 closed state、operator unlock、provider requirement、redaction success、PR approval、issue state、label、guardian approve 或 hosted checks 推断。
- reviewer 确认 `write_prepare` and `live_write_commit` require `state=clear` for exact scope.
- reviewer 确认 stale / unknown / blocked / redaction invalid / requires operator attention fail closed。
- reviewer 确认 account safety clear only clears account safety lane and does not release #1180 default lock or satisfy #1178 operator unlock。
- reviewer 确认 PR metadata 使用 `Fixes #1176` only because #1176 close semantics are `fr-complete`，并且不关闭 #1179/#1180/#1211/#835。
- reviewer 确认本 suite 未混入 runtime/source code、browser/account/live/write actions、Syvert normalized result、provider adapter implementation 或 issue closeout。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0066-account-safety-gate/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1176 的映射。由于本 PR 不实现 runtime 行为，不需要 profile cleanup、account cleanup、artifact cleanup、external rollback 或 live evidence invalidation。
