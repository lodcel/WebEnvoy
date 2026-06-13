# FR-0072 实施计划

## 实施目标

冻结 `#1205 Integration Check Metadata` 的 formal spec suite，定义 PR `integration_check` metadata 的 required fields、枚举、local-only 默认、integration-gated trigger、字段关系矩阵、PR 生命周期义务和 fail-closed 校验口径。

本 PR 是 formal spec review carrier。合入后只冻结 `FR-0072` suite 与 #1205 sync-map；不实现 Syvert normalized result、provider adapter、joint acceptance runtime、CLI / JSON-RPC output、runtime/live evidence、browser/account action、guardian、formal review、controlled merge 或 issue closeout。

## 分阶段拆分

### 阶段 1：metadata 语义冻结

- 产出：`spec.md`
- 重点：冻结 owner、目标、非目标、字段集合、枚举、local-only 默认、integration-gated trigger、field relationship matrix、PR lifecycle obligations、GWT 与验收标准。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/integration-check-metadata.md`、`data-model.md`
- 重点：冻结 `IntegrationCheckMetadataV1` logical contract、字段枚举、valid local-only / integration-gated examples、invalid combinations、parser expectations、logical entities 与 metadata disposition；说明这是 PR metadata contract，不引入 runtime / persistence / CLI schema。

### 阶段 3：research / risks / review checklist

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 issue #1205、boundary freeze、FR-0071、PR template、docs/dev/AGENTS、guardian addendum 与 merge-gate parser/test 输入事实；明确本 FR 不承接 #1203/#1204 wrapper、Syvert normalized mapping、provider adapter、joint acceptance implementation 或 M14+。

### 阶段 4：sync map 与 PR metadata 准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1205 映射、parser-ready PR metadata、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0072 suite 与单条 sync-map mapping，除非 same-class audit 发现必须同步的 metadata parser/template/docs/test drift。PR metadata 使用 `Refs #1205`，等待 scheduler-owned spec review/gate。

## 实现约束

- 默认只允许修改：
  - `docs/dev/specs/FR-0072-integration-check-metadata/**`
  - `.github/spec-issue-sync-map.yml` 中 #1205 对应映射
- 只有在 same-class audit 发现现有模板、docs、parser tests 与本 FR 的 required field / enum / relationship matrix 直接冲突时，才允许最小同步修改：
  - `.github/PULL_REQUEST_TEMPLATE.md`
  - `docs/dev/AGENTS.md`
  - `docs/dev/review/guardian-review-addendum.md`
  - `.github/ISSUE_TEMPLATE/*.yml`
  - `scripts/**`
  - `tests/**`
- 不修改 runtime/source code、fixtures、workflows、githooks、repo Loom carriers 或 unrelated spec suites。
- 不实现 Syvert normalized result、Syvert taxonomy、Syvert wrapper、provider adapter、shared runtime I/O schema、joint acceptance implementation、integration project automation、live evidence gate、browser/account/live/write behavior。
- 不把 #1199 / FR-0071 的 local-only mapping hint manifest 升级为 active integration gate。
- 不执行 browser/profile/extension/Native Messaging/account/live/external-visible/read/write actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、metadata relationship audit 与 targeted parser/template tests：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `SPEC_GUARD_BASE_REF=origin/main bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0072-integration-check-metadata/spec.md`
- `bash scripts/check-pr-purity.sh docs/1205-integration-check-metadata main`
- `git diff --check origin/main...HEAD`
- same-class closing scan，确认只使用 `Refs #1205`，不使用 auto-closing keyword。
- same-class scope audit，确认没有 Syvert normalized result、provider adapter、joint acceptance implementation、runtime/live evidence、browser/account/live/write action、M14+ scheduling、guardian/formal review/controlled merge/issue closeout。
- same-class metadata audit，确认 `.github/PULL_REQUEST_TEMPLATE.md`、`docs/dev/AGENTS.md`、`docs/dev/review/guardian-review-addendum.md`、issue templates、guardian merge-gate tests 对 required fields / enums / relationship matrix 无直接冲突。
- 如果修改 `scripts/**` 或 `tests/**`，运行对应 targeted tests；预期至少包括 `bash tests/pr-guardian.merge-guard.test.sh`。
- Hosted GitHub checks after Draft PR push。

语义自检：

- 对照 `docs/dev/architecture/system-design/boundary.md`，确认 local-only 与 integration-gated trigger 保持一致。
- 对照 `FR-0071`，确认 mapping hint manifest 仍是 WebEnvoy-owned local-only handoff metadata，不被 #1205 自动升级为 active integration gate。
- 对照 #1205 body，确认只定义 PR integration metadata 声明条件，不进入 Syvert normalized result、CloakBrowser-as-core、browser patching、default live_write commit 或 unrelated #835 recovery。
- 对照 `.github/PULL_REQUEST_TEMPLATE.md` 和 guardian merge-gate tests，确认 required fields 和 fail-closed relationship matrix 可被现有 metadata parser 消费。

## TDD 范围

当前 PR 只冻结 formal metadata contract，默认不进入 implementation TDD。

如果 same-class audit 发现现有 parser/test 缺少必须覆盖的 fail-closed relationship，则补最小测试，优先覆盖：

- Missing `integration_check` block fails closed.
- Missing required field fails closed.
- `shared_contract_changed=yes` requires `integration_applicable=yes` and `merge_gate=integration_check_required`.
- `external_dependency != none` requires integration gate.
- `joint_acceptance_needed=yes` requires integration gate and concrete `integration_ref`.
- `integration_applicable=yes` requires concrete `integration_ref`, non-`none` `integration_touchpoint`, non-`none` `contract_surface`, and `integration_status_checked_before_merge=yes`.
- Integration governance rule changes require `contract_surface=integration_governance` when integration-gated.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0072 suite 的普通本仓库文档整理。
- #1203/#1204 可以做 wrapper-owned prep，但不得把 wrapper schema 或 Syvert normalized mapping 写入本 FR。
- Provider / runtime / live evidence issues 可以独立推进自身 formal suites，但如改变 shared contract 或 joint acceptance，必须消费本 FR 的 metadata gate。

串行 / 依赖：

- FR-0072 consumes merged WebEnvoy / Syvert / Provider boundary freeze。
- FR-0072 consumes merged `FR-0071 Syvert Mapping Hint Manifest` as a local-only handoff input and non-trigger example。
- Future Syvert wrapper、provider adapter、shared output、joint acceptance、integration project automation or merge-gate behavior changes must either comply with FR-0072 or explicitly supersede it through a later formal governance PR。

## 进入实现前条件

- FR-0072 spec review 通过。
- Reviewer 确认 required field set、enum、local-only default、integration-gated trigger、relationship matrix and lifecycle obligations are frozen。
- Reviewer 确认 #1205 未实现 Syvert normalized result、provider adapter、joint acceptance runtime、runtime/live evidence 或 M14+。
- Reviewer 确认 existing PR template / docs / merge-gate parser tests have no direct drift, or drift is fixed / reported with owner。
- Reviewer 确认 PR metadata uses `Refs #1205` and does not close #1205 before scheduler-owned gate / issue closeout。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0072-integration-check-metadata/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1205 的映射。由于本 PR 不实现 runtime 行为，不需要 profile cleanup、account cleanup、artifact cleanup、secret rotation、external rollback、integration project mutation 或 live evidence invalidation。
