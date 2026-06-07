# FR-0046 实施计划

## 实施目标

把 `#1141 Native Messaging Health` 冻结成 formal suite：只定义 `official-chrome.persistent` 的 Native Messaging host / socket / bridge readiness 如何消费 `FR-0038 Provider Health / Doctor Contract`，并引用 `FR-0040` evidence refs、`FR-0041` redaction policy 与 `FR-0043` persistent descriptor refs。

本 PR 只冻结 #1141 可消费的 Native Messaging health formal spec carrier。由于 #1141 是 `work-item-complete` 事项，且 runtime implementation、fixtures、launch evidence、browser/live validation 和 merge gate 均仍由后续 owner 或 scheduler 承接，本 PR 使用 `Refs #1141`，不得声明关闭 #1141 或 runtime/work item 完成。

## 分阶段拆分

### 阶段 1：Native Messaging health 边界冻结

- 产出：`spec.md`、`contracts/native-messaging-health-contract.md`。
- 重点：冻结 host identity、manifest、allowed origins、registration、socket availability、bridge handshake、stateful health matrix 与 recovery semantics 的 FR-0038 / FR-0040 mapping。

### 阶段 2：data model / risk / research 收口

- 产出：`data-model.md`、`risks.md`、`research.md`。
- 重点：记录本 FR 只消费 FR-0038 / FR-0040，不新增 schema；排除 #1140/#1142/#1139/#1143/#1144 和 runtime/live 范围。

### 阶段 3：sync map 与 PR metadata

- 产出：`.github/spec-issue-sync-map.yml` #1141 mapping、formal spec review PR、parser-friendly PR body。
- 重点：PR body 提供顶层 YAML blocks 与 `## merge_gate_metadata` 重复，`live_evidence_record: N/A`。

### 阶段 4：验证与 scheduler gate wait

- 产出：本地 docs/spec/map/purity/diff checks、hosted checks、scheduler-readable report。
- 重点：worker 不运行 guardian、formal review 或 controlled merge；gate owner 为 scheduler。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0046-native-messaging-health/**`
  - `.github/spec-issue-sync-map.yml` 中 #1141 mapping
- 不修改 runtime、extension、native host、socket/bridge code、CLI、Playwright、fixtures、tests、GitHub workflow 或 scripts。
- 不定义新的 health result schema；必须消费 `FR-0038`。
- 不定义 runtime status schema、socket lifecycle implementation、retry algorithm、process supervisor 或 cleanup implementation；stateful health matrix 只作为 FR-0038 / FR-0040 mapping contract。
- 不定义 persistent extension identity health；#1140 owns it。
- 不定义 service worker freshness health；#1142 owns it。
- 不定义 capability matrix；#1139 owns it。
- 不推进 launch evidence、fixtures、live evidence、Syvert、CloakBrowser、XHS 或 account-touching behavior。
- 不触碰 live-evidence governance 五个冻结目标文件。

## 测试与验证策略

本 PR 是 formal spec review PR，只运行静态与 PR 纯度验证：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0046-native-messaging-health/spec.md`
- `git diff --check origin/main...HEAD`
- `bash scripts/check-pr-purity.sh docs/m3-1141-native-messaging-health main`
- GitHub hosted checks on latest head

不运行：

- guardian / formal semantic review / controlled merge
- browser、extension、Native Messaging、Playwright 或 runtime tests
- live evidence rerun、runtime.status/audit、profile/account validation

原因：本 PR 不实现 runtime 行为，也不声称完成 live/browser/account 闭环。

## TDD 范围

当前只冻结 formal spec，不新增 implementation tests。

后续 implementation issue 应优先补：

- FR-0038 doctor parser 对 required `native_messaging` checks 缺失、unknown、fail、fatal 和 invalid evidence 的 fail-closed tests。
- Native host identity、manifest ref、allowed origins、registration、socket availability 与 bridge handshake fixture tests。
- Stateful matrix tests for `ready`、`recoverable`、`disconnected`、`blocked` 与 `unknown` mapping into FR-0038 / FR-0040-compatible statuses。
- Recovery path tests for same-run retry success/failure、idempotent start/stop、current-run orphan cleanup、unowned orphan rejection、stale ready signal rejection 与 concurrent contention。
- Stub/fake host evidence rejection tests。
- FR-0041 redaction policy enforcement tests for manifest/socket/bridge artifacts。
- Capability readiness tests ensuring `native_messaging` remains unsatisfied when any required provider-level check fails。

## 并行 / 串行关系

可并行：

- #1140 persistent extension identity health 与 #1142 service worker freshness health 可在各自分支并行冻结，但不得互相改写 scope。
- 不触碰 FR-0046 suite 的普通文档整理。

串行 / 依赖：

- 本 FR 依赖 closed #1127 / FR-0038。
- 本 FR 消费 #1138 / FR-0043 persistent descriptor refs。
- Evidence refs 消费 FR-0040；redaction semantics 消费 FR-0041。
- #1144 official Chrome fixtures 必须等待 #1139/#1140/#1141/#1142/#1143 的可消费输入。

## 进入实现前条件

- FR-0046 spec review 通过。
- reviewer 确认本 PR 仅引用 #1141 并冻结 Native Messaging health formal spec carrier，不声明关闭 #1141 或 runtime behavior complete。
- reviewer 确认本 suite 没有新增 health result schema。
- reviewer 确认 stateful health matrix、recovery path semantics 和 minimum validation matrix 足以支撑后续 implementation，但未定义 runtime implementation。
- reviewer 确认本 suite 没有定义 #1140 persistent extension identity health 或 #1142 service worker freshness health。
- reviewer 确认 evidence refs / redaction policy 与 FR-0040 / FR-0041 对齐。
- reviewer 确认 PR metadata、sync map、purity checks 和 hosted checks 均对齐 latest head。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0046-native-messaging-health/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1141 的映射项。由于本 PR 不实现 runtime 行为，不需要数据迁移、profile 清理、secret rotation 或 external runtime rollback。
