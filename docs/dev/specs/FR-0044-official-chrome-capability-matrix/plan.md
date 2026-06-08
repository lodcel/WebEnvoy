# FR-0044 实施计划

## 实施目标

把 `#1139 official Chrome Capability Matrix` 冻结成一个窄 formal suite：只定义 `official-chrome.direct` 与 `official-chrome.persistent` 的 capability matrix，消费 `FR-0042`、`FR-0043` 与 `FR-0035`，并为后续 health、launch evidence 与 fixtures issue 提供 `capability_matrix_ref`。

本 PR 只冻结 `#1139` 的 formal spec carrier，并使用 `Refs #1139` / `refs_only` 关闭语义；health result schema、runtime attestation、launch evidence、fixtures 与 runtime implementation 由后续 issue 承接，不在本 PR 声明 #1139 完整关闭。

## 分阶段拆分

### 阶段 1：matrix 边界冻结

- 产出：`spec.md`、`contracts/official-chrome-capability-matrix.md`
- 重点：明确 #1139 只拥有 capability matrix，不重写 #1137/#1138 descriptor shape，不定义 health schema。

### 阶段 2：capability rows 落成

- 产出：`data-model.md`
- 重点：为 direct / persistent 每个 capability 写明 support level、limitation、verification source 与 evidence ref strategy。

### 阶段 3：fail-closed 与 downstream owner 收口

- 产出：`risks.md`、`TODO.md`
- 重点：确认 unsupported / partial 按 `FR-0035` fail closed，并把 #1140/#1141/#1142/#1143/#1144 保持为 downstream owner。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0044 suite 与 sync map，不混入 runtime、health、launch evidence、fixtures 或 live/browser actions。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider selection、doctor、CLI、fixtures 或测试代码。
- 不修改 `FR-0042` common descriptor shape、direct variant 或 `FR-0043` persistent delta。
- 不定义 health result schema，不替代 `FR-0038`。
- 不定义 launch evidence、redaction shape、fresh live evidence、runtime attestation 或 fixture payload。
- 不推进 #1140/#1141/#1142/#1143/#1144。
- 不触发 live/browser/runtime/Syvert/CloakBrowser/XHS。
- 不触碰五个 live-evidence governance 冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `bash scripts/spec-issue-sync-map.sh validate`
  - `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0044-official-chrome-capability-matrix/spec.md`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/m3-1139-official-chrome-capability-matrix main`
- diff 检查：
  - `git diff --check origin/main...HEAD`
  - `git diff --stat origin/main...HEAD`
  - `git diff --name-only origin/main...HEAD`
- 语义自检：
  - 对照 issue #1139 和 parent #1113，确认只覆盖 capability matrix。
  - 对照 FR-0042/FR-0043，确认只消费 descriptor identity、mode、engine、transport、profile/extension/native refs 与 limitations。
  - 对照 FR-0035，确认 support state、verification source、evidence strategy 与 fail-closed 口径一致。

## TDD 范围

- 当前只冻结 formal capability matrix contract，不进入实现代码 TDD。
- 后续 implementation 或 parser issue 应优先补以下测试：
  - matrix parser 拒绝缺少 support level、limitation、verification source 或 evidence ref strategy 的 row。
  - direct matrix 对 extension/native messaging capability 输出 unsupported。
  - persistent matrix 不把 descriptor refs 解释为 health pass 或 runtime ready。
  - business admission 不接受 `declared` 或低于目标 minimum support state 的 row。
  - evidence consumer 不把 future evidence ref slot 解释为 evidence passed。

## 并行 / 串行关系

- 可并行：
  - 不触碰 FR-0044 suite 的普通本仓库文档整理。
  - 不消费 official Chrome capability matrix 的 runtime bugfix。
- 串行 / 依赖：
  - 本 work item 依赖 closed #1137 / FR-0042、closed #1138 / FR-0043、closed #1124 / FR-0035。
  - #1140/#1141/#1142 必须消费 FR-0038 和本 matrix，不能从本 matrix 推导 health schema。
  - #1143 必须消费 FR-0040 / FR-0041 和本 matrix，不能从本 matrix 推导 launch evidence record。
  - #1144 必须等待 descriptor、matrix、health 与 launch evidence owner 提供输入。

## 进入实现前条件

- FR-0044 spec review 通过。
- reviewer 确认本 PR 使用 `Refs #1139` / `refs_only`，只冻结 capability matrix formal spec carrier，不声明 runtime behavior complete。
- reviewer 确认每个 capability row 均包含 support level、limitation、verification source 与 evidence ref strategy。
- reviewer 确认 unsupported / partial rows 按 `FR-0035` fail closed。
- reviewer 确认本 suite 没有定义 descriptor shape、health schema、launch evidence、fixtures 或 runtime implementation。
