# FR-0040 plan

## 实施目标

本 FR 的实施目标是冻结 Provider Evidence Kernel 的 formal contract，使后续 provider runtime 实现可以用同一份 `provider_evidence_record` 表达 selected provider、version evidence、launch arguments、profile reference、extension status、Native Messaging status、evidence refs / redaction 与 closeout plan。

本 PR 只交付 spec / data model / contract / risk / research / TODO / sync map，不实现采集器、CLI、runtime、doctor、browser launch 或 live evidence 行为。

## 分阶段拆分

### 阶段 1：规约冻结

- 新增 `FR-0040-provider-evidence-kernel` formal suite。
- 冻结 `provider_evidence_record.v1` contract shape。
- 更新 `.github/spec-issue-sync-map.yml`，将 suite 映射到 #1128。
- 验证 docs/spec/map/purity/diff checks。

### 阶段 2：实现准备

- 后续 implementation issue 消费本 suite，建立 parser / validator / fixtures。
- 覆盖 required evidence refs、freshness、redaction state、blocking reasons 与 closeout decision 的单测。
- 不在本 FR PR 中实现。

### 阶段 3：runtime / closeout 消费

- 后续 runtime evidence kernel 或 command output contract 将真实 artifact ref 写入 `provider_evidence_record`。
- 后续 closeout / PR gate 根据 applicable issue 的 live evidence gate、guardian 和 GitHub checks 消费 record。
- 不在本 FR PR 中实现。

## 实现约束

- 不实现 runtime evidence kernel、evidence collector、CLI command、provider selection、doctor、browser launch、extension、Native Messaging 或 Playwright 行为。
- 不触碰 #1127 / PR #1224 Provider Health Doctor。
- 不触碰 #1135/#1136 或 Syvert normalized result。
- 不扩大到 CloakBrowser-as-core、browser patching、default live_write commit 或 #835 recovery。
- 不执行 live browser/runtime/account/external visible actions。
- 只修改 `docs/dev/specs/FR-0040-provider-evidence-kernel/**` 与 `.github/spec-issue-sync-map.yml`。

## 测试与验证策略

本 FR PR 的验证只使用静态文档与 spec gate：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0040-provider-evidence-kernel/spec.md`
- `bash scripts/check-pr-purity.sh docs/m2-1128-provider-evidence-kernel main`
- `git diff --check origin/main...HEAD`
- GitHub hosted checks on latest head

不运行 browser、extension、Native Messaging、Playwright、runtime、account 或 live evidence tests。

## TDD 范围

本 PR 是 formal spec freeze，不新增 implementation tests。后续 implementation issue 进入开发前，至少应先补：

- provider evidence record shape parser / validator tests。
- evidence refs id resolution tests。
- freshness downgrade / stale evidence fail-closed tests。
- redaction state and sensitivity fail-closed tests。
- selected provider / contract / launch envelope mismatch tests。
- extension / Native Messaging disconnected / unknown status tests。
- closeout plan decision tests。

## 并行 / 串行关系

- 串行前置：`FR-0033 Browser Provider Contract` 与 `FR-0037 Launch Envelope Extraction` 已在 main 合入后，本 FR 才能冻结。
- 可并行：#1127 Provider Health Doctor 可独立推进；本 FR 只保留可选 `provider_health_ref` source，不消费其未合入文件。
- 可并行：#1129 Evidence Redaction Policy 可在本 FR 之后或并行细化完整 redaction policy；本 FR 只冻结最小 redaction hooks。
- 串行后续：runtime evidence kernel implementation、provider selection runtime consumption、closeout gate consumption 必须等待本 FR spec review 通过后再进入实现。
- 不相关：#1135/#1136、Syvert normalized result、#835 recovery 不进入本 FR 依赖图。

## 进入实现前条件

- 本 FR suite 已通过 spec review 并合入 main。
- #1128 的 issue / PR / sync map 已与 `FR-0040-provider-evidence-kernel/spec.md` 对齐。
- 后续 implementation issue 明确它消费的 evidence scopes、required evidence kinds、freshness 与 redaction policy。
- 若 implementation 触发 runtime/live/account 外部动作，必须先补 readiness/admission 证据和对应 live evidence gate。
- 若 implementation 改变跨仓共享输出、diagnostics / observability、run id 或 provider adapter gate，必须重新核对 integration metadata。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0040-provider-evidence-kernel/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1128 的映射项。由于本 PR 不实现 runtime 行为，不需要数据迁移或运行时回滚。
