# FR-0067 实施计划

## 实施目标

冻结 `#1177 Extension / Native Bridge Gate` 的 formal spec suite，定义 `write_admit` 进入 `write_prepare` / `live_write_commit` admission 前必须具备的 extension smoke、native bridge readiness、evidence refs、freshness、scope matching、redaction 与 fail-closed behavior。

本 PR 只是 formal contract/spec carrier。合入后只冻结 `FR-0067` suite 与 #1177 sync-map；不启用 `live_write_commit`，不实现 XHS publish，不执行 browser / extension / native messaging / account / live / write action，也不修复、重跑或重开 #835。

## 分阶段拆分

### 阶段 1：extension/native bridge gate scope 冻结

- 产出：`spec.md`
- 重点：冻结 owner、目标、非目标、scope binding、state enum、extension smoke、native bridge readiness、fail-closed 规则、GWT 和异常场景。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/extension-native-bridge-gate.md`、`data-model.md`
- 重点：冻结 bridge scope、state record、evidence refs、evaluation input/result、blocking reasons 和 logical entities，不引入 runtime persistence。

### 阶段 3：risk / research / handoff

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 FR-0038 provider doctor、FR-0045 extension identity、FR-0046 Native Messaging health、FR-0047 service worker freshness、FR-0062 taxonomy、FR-0066 account safety 输入，以及 #1179/#1180/#1211 downstream handoff。

### 阶段 4：PR 与验证准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1177 映射、parser-ready PR metadata、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0067 suite 与单条 sync-map mapping，closing semantics 为 `Fixes #1177` because issue #1177 close semantics are `fr-complete`.

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0067-extension-native-bridge-gate/**`
  - `.github/spec-issue-sync-map.yml` 中 #1177 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不实现 #1175、#1176、#1179、#1180、#1211，不触碰 #835 recovery。
- 不定义 Syvert normalized result，不解除 default `live_write_commit` lock，不声明 operator unlock accepted、provider requirement pass、account safety clear、runtime target binding pass、anti-detection gate pass 或 live evidence accepted。
- 不执行 browser/profile/extension/Native Messaging/account/live/external-visible/write actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、closing semantics 与 hosted checks：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0067-extension-native-bridge-gate/spec.md`
- `bash scripts/check-pr-purity.sh docs/1177-extension-native-bridge-gate main`
- `git diff --check origin/main...HEAD`
- same-class closing scan for `#1177` auto-closing patterns and unintended references to #1175/#1176/#1179/#1180/#1211/#835 recovery
- same-class scope audit for provider doctor refs, extension smoke refs, Native Messaging bridge refs, account safety refs, operator unlock refs, default lock refs, provider requirement refs, live evidence claims and browser/account/live/write action claims
- hosted GitHub checks after Draft PR push

语义自检：

- 对照 issue #1177，确认 scope 只覆盖 Extension / Native Bridge Gate formal contract。
- 对照 FR-0038，确认 doctor checked 不等于 runtime/live ready。
- 对照 FR-0045 / FR-0047，确认 extension smoke 消费 extension identity/source binding 与 service worker freshness，但不替代 native bridge readiness。
- 对照 FR-0046，确认 native bridge readiness 消费 Native Messaging health 且 recoverable/non-pass/stub/fake/historical evidence fail closed。
- 对照 FR-0062，确认本 gate 只贡献 live-write capability taxonomy 的一个 required lane。
- 对照 FR-0066，确认 account safety remains separate and required downstream lane。

## TDD 范围

当前 PR 只冻结 formal extension/native bridge gate contract，不进入实现代码 TDD。

后续 implementation / parser / release gate issue 应优先补以下测试：

- Missing bridge state rejects `write_prepare`.
- Extension smoke missing rejects `write_prepare`.
- Native bridge readiness missing rejects `write_prepare`.
- Recoverable Native Messaging state does not pass before fresh recovery evidence.
- Scope mismatch rejects bridge ready.
- Head mismatch rejects bridge ready.
- Redaction invalid rejects bridge ready.
- Doctor pass does not imply extension/native bridge ready.
- #835 closed state cannot satisfy current bridge readiness.
- Stub/fake host, runtime ping, bootstrap ack, service worker wake signal or control-plane-only signal cannot satisfy bridge readiness.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0067 suite 的普通本仓库文档整理。
- #1179 / #1180 / #1211 的只读 planning 可以并行准备，但不能声称 extension/native bridge gate 已实现或当前 scope ready。

串行 / 依赖：

- FR-0067 consumes merged FR-0038 provider health / doctor contract.
- FR-0067 consumes merged FR-0045 / FR-0046 / FR-0047 official Chrome extension/native messaging/service-worker health definitions.
- FR-0067 consumes merged FR-0062 taxonomy and must not unlock `live_write_commit`.
- FR-0067 remains separate from FR-0066 account safety; downstream owners must consume both where applicable.
- #1179 provider requirements must consume FR-0067 bridge gate result before allowing `write_prepare`-adjacent provider requirement disposition.
- #1180 default lock must consume FR-0067 bridge gate result before any exact-scope default lock release.
- #1211 Live Write Gate Matrix must consume FR-0067 status and blocking reasons before release-gate closeout.
- Any future live write implementation must still satisfy FR-0031 / FR-0032 / applicable live evidence gates after spec review 通过.

## 进入实现前条件

- FR-0067 spec review 通过。
- Reviewer 确认 extension/native bridge state 是 explicit scoped result，不可由 #835 closed state、doctor pass、descriptor refs、runtime ping、bootstrap ack、service worker wake signal、stub/fake host 或 hosted checks 推断。
- Reviewer 确认 contract input can express `write_admit`, and `write_admit` remains classification/admission-only rather than `write_prepare` or `live_write_commit` readiness.
- Reviewer 确认 `write_prepare` and `live_write_commit` admission require scoped bridge `state=ready` in addition to other gate lanes。
- Reviewer 确认 extension smoke and native bridge readiness are both required。
- Reviewer 确认 unknown / blocked / stale / redaction_invalid / requires_recovery fail closed。
- Reviewer 确认 bridge ready only clears extension/native bridge lane and does not release #1180 default lock, satisfy #1178 operator unlock, satisfy FR-0066 account safety, or accept live evidence。
- Reviewer 确认 PR metadata 使用 `Fixes #1177` only because #1177 close semantics are `fr-complete`，并且不关闭 #1175/#1176/#1179/#1180/#1211/#835。
- Reviewer 确认本 suite 未混入 runtime/source code、browser/extension/native messaging/account/live/write actions、Syvert normalized result、provider adapter implementation 或 issue closeout。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0067-extension-native-bridge-gate/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1177 的映射。由于本 PR 不实现 runtime 行为，不需要 profile cleanup、account cleanup、artifact cleanup、external rollback 或 live evidence invalidation。
