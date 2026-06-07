# FR-0045 实施计划

## 实施目标

把 `#1140 Persistent Extension Identity Health` 冻结成 formal suite：只定义 `official-chrome.persistent` 的 persistent extension identity/source binding health check，消费 `FR-0038` Provider Health / Doctor Contract，不新增 health result schema。

`#1140` 是 scoped `work-item-complete`：合入本 suite 后满足 persistent extension identity health check definition 的关闭条件；Native Messaging health、service worker freshness、capability matrix、launch evidence、fixtures 与 runtime implementation 由后续 issue 承接。

## 分阶段拆分

### 阶段 1：check definition 边界冻结

- 产出：`spec.md`、`contracts/persistent-extension-identity-health.md`。
- 重点：确认本 check 只作为 `FR-0038.provider_doctor_report.checks[*].category=extension_load` 被表达。

### 阶段 2：identity / source / profile binding 语义落成

- 产出：`data-model.md`。
- 重点：冻结 expected/observed extension identity、source installation ref、persistent profile binding 与 fail-closed 条件。

### 阶段 3：evidence / redaction / sibling ownership 收口

- 产出：`risks.md`、`TODO.md`。
- 重点：确认 evidence refs 消费 `FR-0040`，redaction 消费 `FR-0041`，并明确 #1141/#1142/#1139/#1143/#1144 不在本 PR。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果。
- 重点：确保 PR 只包含 FR-0045 suite 与 sync map，不混入 runtime、native messaging health、service worker freshness、capability matrix、launch evidence 或 fixtures。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0045-persistent-extension-identity-health/**`
  - `.github/spec-issue-sync-map.yml`
- 不修改 runtime、extension、native host、Playwright、provider selection、doctor、CLI、fixtures 或测试代码。
- 不定义新的 health result schema；必须消费 `FR-0038`。
- 不定义 native messaging health；#1141 承接。
- 不定义 service worker freshness；#1142 承接。
- 不定义 capability matrix；#1139 承接。
- 不定义 launch evidence、redaction shape、fresh live evidence、runtime attestation 或 fixture payload。
- 不执行真实浏览器、runtime、account-touching、Syvert、CloakBrowser、XHS 或 external-visible 操作。
- 不触碰五个 live-evidence governance 冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `bash scripts/spec-issue-sync-map.sh validate`
  - `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0045-persistent-extension-identity-health/spec.md`
- diff 检查：
  - `git diff --check origin/main...HEAD`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/m3-1140-persistent-extension-identity-health main`
- 语义自检：
  - 对照 #1140 和 parent #1113，确认只覆盖 persistent extension identity/source binding health。
  - 对照 FR-0038，确认本 suite 只消费 provider doctor report/check shape。
  - 对照 FR-0040/FR-0041，确认 evidence refs 与 redaction 不被重新定义。
  - 对照 FR-0043，确认只消费 persistent descriptor refs。
  - 对照 scope 禁止项，确认没有 native messaging health、service worker freshness、capability matrix、launch evidence、fixtures 或 runtime implementation。
- Hosted checks：
  - PR latest head 上 GitHub checks 必须 green，guardian/formal review/controlled merge 由 scheduler 执行。

## TDD 范围

- 当前只冻结 formal check definition，不进入实现代码 TDD。
- 后续 implementation 应优先补以下测试：
  - doctor report parser 要求 `official-chrome.persistent` 具备 `extension_load` persistent identity check。
  - extension id mismatch 时 provider-level fail-closed。
  - source/profile binding mismatch 时 provider-level fail-closed。
  - staged extension、ephemeral profile、unrelated profile fallback 被拒绝。
  - service worker freshness、native messaging readiness、runtime ping 不能替代 identity/source binding match。
  - required evidence missing / invalid redaction 时 fail-closed。

## 并行 / 串行关系

- 可并行：
  - #1141 Native Messaging health 可在独立分支消费 FR-0038，但不得修改 FR-0045 ownership。
  - #1142 Service Worker freshness 可在独立分支消费 FR-0038，但不得把 freshness 写入 FR-0045。
  - 不触碰 FR-0045 suite 的普通文档整理。
- 串行 / 依赖：
  - 本 FR 依赖 closed #1127 / FR-0038、closed #1128 / FR-0040、#1129 / FR-0041 redaction policy、closed #1138 / FR-0043 persistent descriptor。
  - #1144 fixtures 必须等待 #1139/#1140/#1141/#1142/#1143 提供输入。
  - 后续 provider admission / doctor implementation 必须等待本 check definition spec review 通过，或 scheduler 明确允许基于当前 PR head 准备但不合并。

## 进入实现前条件

- FR-0045 spec review 通过。
- reviewer 确认 #1140 的关闭语义是 persistent extension identity health check definition complete，不是 runtime behavior complete。
- reviewer 确认本 suite 未新增 health result schema，且 check carrier 为 FR-0038。
- reviewer 确认 Native Messaging health、service worker freshness、capability matrix、launch evidence、fixtures 与 runtime implementation 均未混入本 PR。
- reviewer 确认 evidence refs 与 redaction 消费 FR-0040/FR-0041，没有泄露 secret/path/account 信息。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0045-persistent-extension-identity-health/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1140 的映射项。由于本 PR 不实现 runtime 行为，不需要数据迁移、profile 清理、extension uninstall、secret rotation 或 external runtime rollback。
