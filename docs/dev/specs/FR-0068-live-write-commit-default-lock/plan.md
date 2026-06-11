# FR-0068 实施计划

## 实施目标

冻结 `#1180 live_write_commit Default Lock` 的 formal spec suite，规定 `live_write_commit` 默认锁定，并定义只有所有 risk gate、operator unlock、provider/runtime/admission/account-safety 条件具备 current exact-scope evidence，且下游明确重消费这些 evidence 时，default lock lane 才可进入 `release_ready_for_downstream_gate`。

本 PR 只是 formal contract/spec carrier。合入后只冻结 `FR-0068` suite 与 #1180 sync-map；不启用 `live_write_commit`，不实现 XHS publish，不执行 browser / extension / native messaging / account / live / write action，也不修复、重跑或重开 #835。

## 分阶段拆分

### 阶段 1：default lock scope 冻结

- 产出：`spec.md`
- 重点：冻结 owner、目标、非目标、scope binding、state enum、release preconditions、non-proofs、fail-closed 规则、GWT 和异常场景。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/live-write-commit-default-lock.md`、`data-model.md`
- 重点：冻结 default lock scope、record、evidence refs、evaluation input/result、blocking reasons、downstream re-consumption 和 logical entities，不引入 runtime persistence。

### 阶段 3：risk / research / handoff

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 FR-0062、FR-0064、FR-0065、FR-0066、FR-0067 与 #1179 背景事实，明确 #1179 `xhs.creator_publish.admit` 只到 admission-only `write_admit`，以及 #1211 / future runtime owner 的消费方式。

### 阶段 4：PR 与验证准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1180 映射、parser-ready PR metadata、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0068 suite 与单条 sync-map mapping；PR metadata 必须使用 `Refs #1180`，不得 auto-close #1180 或执行 issue closeout。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0068-live-write-commit-default-lock/**`
  - `.github/spec-issue-sync-map.yml` 中 #1180 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不实现 #1166-#1173、#835 recovery、#1179 runtime expansion、#1211 release gate matrix、M12 或 M13。
- 不定义 Syvert normalized result，不解除 default `live_write_commit` lock，不声明 provider requirement pass、profile allowlist accepted、account safety clear、extension/native bridge ready、runtime target binding pass、anti-detection gate pass、operator unlock accepted 或 live evidence accepted。
- 不执行 browser/profile/extension/Native Messaging/account/live/external-visible/write actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、non-closing reference semantics 与 hosted checks：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `SPEC_GUARD_BASE_REF=origin/main bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0068-live-write-commit-default-lock/spec.md`
- `bash scripts/check-pr-purity.sh docs/1180-live-write-commit-default-lock main`
- `git diff --check origin/main...HEAD`
- same-class closing scan for `#1180` auto-closing patterns and unintended closure of #1180/#1174/#1175/#1176/#1177/#1178/#1179/#1211/#835
- same-class scope audit for provider requirement refs, profile manifest refs, extension/native bridge refs, account safety refs, operator unlock refs, runtime target binding refs, anti-detection refs, live evidence claims and browser/account/live/write action claims
- hosted GitHub checks after Draft PR push

语义自检：

- 对照 issue #1180，确认 scope 只覆盖 default lock formal contract。
- 对照 FR-0062，确认 `live_write_commit` 默认 locked，且 lower capability 不能 alias upgrade。
- 对照 FR-0064，确认 operator unlock 只清除 operator lane，不解除 default lock。
- 对照 FR-0065，确认 profile manifest allowlist 不替代 provider requirement、default lock、account safety、runtime 或 live evidence。
- 对照 FR-0066，确认 account safety clear 是必要但不充分条件。
- 对照 FR-0067，确认 extension/native bridge ready 是必要但不充分条件。
- 对照 #1179，确认 `xhs.creator_publish.admit` is admission-only `write_admit` context and keeps `default_live_write_commit_lock=locked`。

## TDD 范围

当前 PR 只冻结 formal default lock contract，不进入实现代码 TDD。

后续 implementation / parser / release gate issue 应优先补以下测试：

- Missing default lock record denies `live_write_commit`.
- Default state is `locked`.
- #1179 `xhs.creator_publish.admit` pass does not unlock commit.
- Accepted operator unlock without default lock release still denies commit.
- Missing provider requirement denies release.
- Missing profile manifest allowlist denies release.
- Missing extension/native bridge ready denies release.
- Account safety not clear denies release.
- Missing runtime target binding denies release.
- Missing anti-detection gate denies release.
- Missing or stale live evidence denies release.
- Head/run/profile/target/provider scope mismatch denies release.
- Redaction invalid denies release.
- Stub/fake host, runtime ping, bootstrap ack, hosted checks pass or #835 closed state cannot satisfy release.
- Release-ready result without downstream re-consumption still denies final commit.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0068 suite 的普通本仓库文档整理。
- #1211 的只读 planning 可以并行准备，但不能声称 default lock 已实现或当前 scope release-ready。

串行 / 依赖：

- FR-0068 consumes merged FR-0062 capability taxonomy.
- FR-0068 consumes merged FR-0064 operator unlock contract.
- FR-0068 consumes merged FR-0065 profile manifest provider allowlist.
- FR-0068 consumes merged FR-0066 account safety gate.
- FR-0068 consumes merged FR-0067 extension/native bridge gate.
- FR-0068 consumes #1179 only as admission/background fact for `xhs.creator_publish.admit` as `write_admit`; it does not consume #1179 as a release-ready provider ref.
- #1211 Live Write Gate Matrix must consume FR-0068 lock states and blocking reasons before release-gate closeout.
- Any future live write implementation must still satisfy FR-0031 / FR-0032 / applicable live evidence gates after spec review 通过.

## 进入实现前条件

- FR-0068 spec review 通过。
- Reviewer 确认 `live_write_commit` default state is locked and no merged spec/issue/PR/check can unlock it by itself.
- Reviewer 确认 all release preconditions are necessary, exact-scope, fresh, redacted and downstream-owned.
- Reviewer 确认 #1179 `xhs.creator_publish.admit` stays admission-only `write_admit` context, not release-ready provider evidence or commit unlock.
- Reviewer 确认 operator unlock does not release default lock and default lock does not replace operator unlock.
- Reviewer 确认 account safety, profile manifest, extension/native bridge, runtime target binding, anti-detection and live evidence remain separate required lanes.
- Reviewer 确认 downstream re-consumption is required before any final commit gate.
- Reviewer 确认 PR metadata 使用 `Refs #1180`，不会 auto-close #1180，也不会 close #1174/#1175/#1176/#1177/#1178/#1179/#1211/#835。
- Reviewer 确认本 suite 未混入 runtime/source code、tests、fixtures、scripts、workflows、browser/extension/native messaging/account/live/write action、Syvert normalized result、provider adapter implementation 或 issue closeout。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0068-live-write-commit-default-lock/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1180 的映射。由于本 PR 不实现 runtime 行为，不需要 profile cleanup、account cleanup、artifact cleanup、external rollback 或 live evidence invalidation。
