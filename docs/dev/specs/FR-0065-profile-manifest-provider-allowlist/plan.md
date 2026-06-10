# FR-0065 实施计划

## 实施目标

冻结 `#1175 Profile Manifest Provider Allowlist` 的 formal spec suite，定义 live-write admission 前 profile manifest 必须声明的 allowed providers、workflow/capability scope、secret refs、evaluation result、fail-closed blockers 和 downstream handoff。

本 PR 只是 formal contract/spec carrier。合入后只冻结 `FR-0065` suite 与 #1175 sync-map；不启用 `live_write_commit`，不实现 XHS publish，不执行 browser / account / live / write action，也不扩大到 #1176/#1177/#1179/#1180 或 #835 recovery。

## 分阶段拆分

### 阶段 1：profile manifest allowlist scope 冻结

- 产出：`spec.md`
- 重点：冻结 owner、目标、非目标、manifest identity、allowed provider entries、secret refs、fail-closed 规则、GWT 和异常场景。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/profile-manifest-provider-allowlist.md`、`data-model.md`
- 重点：冻结 manifest object、provider entry、secret ref、evidence ref、evaluation input/result、blocking reasons 和 logical entities，不引入 runtime persistence。

### 阶段 3：risk / research / handoff

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 FR-0033、FR-0062、FR-0064、FR-0041/#1181 输入，#1175 issue readback，#1179/#1180/#1211 消费方式，以及 secret leak / manifest stale / commit unlock confusion 风险。

### 阶段 4：PR 与验证准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1175 映射、parser-ready PR metadata、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0065 suite 与单条 sync-map mapping；closing semantics 为 `Fixes #1175`，因为 #1175 是 `fr-complete` spec-freeze issue。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0065-profile-manifest-provider-allowlist/**`
  - `.github/spec-issue-sync-map.yml` 中 #1175 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不实现 #1176、#1177、#1179、#1180、#1211，也不触碰 #835 recovery。
- 不定义 Syvert normalized result，不解除 default `live_write_commit` lock，不声明 provider requirement pass、account safety clear、runtime target binding pass、anti-detection gate pass 或 live evidence accepted。
- 不执行 browser/profile/account/live/external-visible/write actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、closing semantics 与 hosted checks：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0065-profile-manifest-provider-allowlist/spec.md`
- `bash scripts/check-pr-purity.sh docs/1175-profile-manifest-provider-allowlist main`
- `git diff --check origin/main...HEAD`
- same-class scope audit for profile manifest refs, allowed provider refs, secret refs, provider requirements, account safety refs, live evidence claims, #835 baseline refs and browser/account/live/write action claims
- hosted GitHub checks after Draft PR push

语义自检：

- 对照 issue #1175，确认 scope 只覆盖 profile manifest allowed providers 与 secret references。
- 对照 FR-0033，确认 provider identity / mode / verification vocabulary is consumed, not redefined。
- 对照 FR-0062，确认 `live_write_commit` 仍默认 locked，且 accepted manifest does not allow commit。
- 对照 FR-0064，确认 operator unlock 仍是独立 downstream blocker。
- 对照 FR-0041/#1181，确认 secret refs use handles/redacted locators and raw secrets are blocking。
- 对照 #1179/#1180/#1211，确认 downstream gates still own provider requirement pass, default lock and release matrix。
- 对照 #835，确认 closed baseline is historical background only.

## TDD 范围

当前 PR 只冻结 formal profile manifest allowlist contract，不进入实现代码 TDD。

后续 implementation / parser / release gate issue 应优先补以下测试：

- Missing profile manifest rejects `write_admit`.
- Provider not present in profile manifest rejects admission.
- Workflow / target / provider contract mismatch rejects admission.
- Unknown capability level rejects admission.
- Missing required secret ref rejects admission.
- Raw secret, raw profile path or invalid redaction rejects admission.
- Expired or revoked manifest rejects admission.
- Accepted manifest does not satisfy provider requirements, operator unlock, default lock, account safety, target binding, anti-detection or live evidence.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0065 suite 的普通本仓库文档整理。
- #1179 / #1180 / #1211 的只读 planning 可以并行准备，但不能声称 profile manifest contract 已实现为 runtime behavior。

串行 / 依赖：

- FR-0065 consumes merged FR-0033 Browser Provider Contract.
- FR-0065 consumes merged FR-0062 Live-Write Capability Taxonomy.
- FR-0065 consumes merged FR-0064 Operator Unlock as a distinct downstream blocker.
- FR-0065 consumes FR-0041 / #1181 redaction semantics for secret references.
- #1179 Provider Requirements must consume accepted manifest result before treating provider prerequisites as complete.
- #1180 Default Lock and #1211 Live Write Gate Matrix must keep their own evidence requirements after consuming manifest status.

## 进入实现前条件

- FR-0065 spec review 通过。
- reviewer 确认 profile manifest 是 provider allowlist declaration，不是 provider registry、provider requirement pass、operator unlock、default lock release、runtime readiness 或 live evidence。
- reviewer 确认 secret refs are locator-only and raw secrets / private paths fail closed。
- reviewer 确认 accepted manifest only clears profile manifest allowlist lane。
- reviewer 确认 #1179/#1180/#1211 remain downstream owners。
- reviewer 确认 #835 closed baseline 没有被当作当前 manifest evidence 或 live evidence。
- reviewer 确认 PR metadata 使用 `Fixes #1175` only because #1175 close semantics are `fr-complete`，且未混入 runtime/source code、browser/account/live/write actions、Syvert normalized result、provider adapter implementation 或 issue closeout。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0065-profile-manifest-provider-allowlist/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1175 的映射。由于本 PR 不实现 runtime 行为，不需要 profile cleanup、account cleanup、artifact cleanup、external rollback 或 live evidence invalidation。
