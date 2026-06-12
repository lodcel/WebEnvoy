# FR-0071 实施计划

## 实施目标

冻结 `#1199 Syvert Mapping Hint Manifest` 的 formal spec suite，定义 WebEnvoy-owned mapping hint manifest、hint classes、source bindings、mapping gaps、consumer actions、non-proof signals、forbidden fields 与 local-only integration classification。

本 PR 是 formal spec review carrier。合入后只冻结 `FR-0071` suite 与 #1199 sync-map；不实现 Syvert CLI / JSON-RPC wrapper、runtime output、provider adapter、evidence passthrough、integration metadata implementation、browser/account/live actions 或 issue closeout。

## 分阶段拆分

### 阶段 1：manifest 语义冻结

- 产出：`spec.md`
- 重点：冻结 owner、目标、非目标、hint classes、mapping gap semantics、non-proof signals、forbidden fields、GWT 验收场景与 local-only integration 判断。

### 阶段 2：contract 与 logical data model

- 产出：`contracts/syvert-mapping-hint-manifest.md`、`data-model.md`
- 重点：冻结 `SyvertMappingHintManifestV1`、hint item、source binding、mapping gap、consumer action、non-proof 和 blocker enums；说明这些是 logical contract，不引入 runtime output / persistence / JSON-RPC shape。

### 阶段 3：research / risks / review checklist

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 issue #1199、boundary freeze、FR-0061/FR-0063/FR-0069/FR-0070 输入事实；明确本 FR 不承接 #1200/#1201/#1203/#1204/#1205 实现。

### 阶段 4：PR 与验证准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1199 映射、parser-ready PR metadata、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0071 suite 与单条 sync-map mapping；PR metadata 使用 `Refs #1199`，等待 scheduler-owned spec review/gate。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0071-syvert-mapping-hint-manifest/**`
  - `.github/spec-issue-sync-map.yml` 中 #1199 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不修改 `FR-0061`、`FR-0063`、`FR-0069`、`FR-0070` 的 field shape。
- 不实现 Syvert wrapper、JSON-RPC method、CLI command、runtime manifest writer、provider adapter、evidence passthrough、integration metadata implementation、read/write gate、live evidence、account safety 或 closeout behavior。
- 不触碰 #1200/#1201 WebEnvoy envelope/error hints、#1202 evidence passthrough、#1203/#1204 Syvert CLI/JSON-RPC wrappers、#1205 integration metadata implementation、#238 closeout 或 unrelated #835 recovery。
- 不执行 browser/profile/extension/Native Messaging/account/live/external-visible/read/write actions。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner remains scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、non-closing reference semantics 与 hosted checks：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `SPEC_GUARD_BASE_REF=origin/main bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0071-syvert-mapping-hint-manifest/spec.md`
- `bash scripts/check-pr-purity.sh docs/1199-syvert-mapping-hint-manifest main`
- `git diff --check origin/main...HEAD`
- same-class closing scan，确认只使用 `Refs #1199`，不使用 auto-closing keyword。
- same-class scope audit，确认没有 Syvert normalized result、Syvert resource/error taxonomy、provider adapter、CLI/JSON-RPC wrapper、runtime output implementation、evidence passthrough implementation、integration gate、browser/account/live action 或 live-write claim。
- Hosted GitHub checks after Draft PR push。

语义自检：

- 对照 `docs/dev/architecture/system-design/boundary.md`，确认 WebEnvoy core 只提供 hints and refs，不承接 Syvert normalized result。
- 对照 #1199 body 和 labels，确认 `integration:local-only` 与 scope boundary 未被扩大。
- 对照 #1200/#1201/#1203/#1204/#1205，确认本 PR 只提供 handoff inputs，不实现 downstream blockers。
- 对照 `FR-0061` / `FR-0063`，确认 hint source refs 保持 raw / operational / evidence / target binding non-proof 语义。

## TDD 范围

当前 PR 只冻结 formal hint manifest contract，不进入实现代码 TDD。

后续 implementation / parser / wrapper issue 应优先补以下测试：

- Unknown manifest version or hint class fails closed.
- Forbidden fields such as `normalized`、`syvert_resource_type`、`syvert_error_code` are rejected.
- Mapping gap does not synthesize default normalized result.
- Stale / scope-mismatched / redaction-invalid source binding is rejected.
- `integration_mode=local_only` cannot be promoted to active integration gate without separate integration decision.
- Future Syvert wrapper consumes hint refs only after defining Syvert-owned normalization / taxonomy contract.

## 并行 / 串行关系

可并行：

- 不触碰 FR-0071 suite 的普通本仓库文档整理。
- #1200/#1201 可以做 prep-only readback，但 final envelope/error hint implementation must consume or explicitly supersede this FR.
- #1203/#1204 可以在 Syvert-owned or wrapper-owned scope 准备需求，但不得把 wrapper schema 回写为 WebEnvoy core normalized result。

串行 / 依赖：

- FR-0071 consumes merged WebEnvoy / Syvert / Provider Boundary Freeze (`docs/dev/architecture/system-design/boundary.md`)。
- Future WebEnvoy envelope/error hint PRs (#1200/#1201) must not bypass FR-0071 non-proof and forbidden-field rules.
- Future Syvert CLI/JSON-RPC wrapper PRs (#1203/#1204) must define Syvert-owned normalization / taxonomy separately.
- Any future shared contract、provider adapter、joint acceptance、integration metadata implementation or live evidence closeout must use separate issue/PR and applicable formal suite。

## 进入实现前条件

- FR-0071 spec review 通过。
- Reviewer 确认 manifest is WebEnvoy-owned hint metadata only。
- Reviewer 确认 Syvert normalized result、resource taxonomy、error taxonomy、provider adapter、CLI/JSON-RPC wrapper、runtime output implementation、integration metadata implementation 和 live evidence 均被排除。
- Scheduler 确认 downstream #1200/#1201/#1203/#1204/#1205 的 owner / ordering / gate policy。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0071-syvert-mapping-hint-manifest/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1199 的映射。由于本 PR 不实现 runtime 行为，不需要数据迁移、profile cleanup、browser cleanup、secret rotation、artifact cleanup、live cleanup 或 external rollback。
