# FR-0052 实施计划

## 实施目标

把 `#1149 CloakBrowser Capability Matrix` 冻结成一个窄 formal suite：只定义 `cloakbrowser.direct`、`cloakbrowser.persistent` 与 `cloakbrowser.cloakserve` 的 capability matrix，消费 `FR-0049`、`FR-0050`、`FR-0051`、`FR-0035` 和相邻 health / evidence contract 输入，并为 #1152/#1153 以及后续 health、launch evidence、fixtures issue 提供 `capability_matrix_ref`。

本 PR 只冻结 `FR-0052` suite 与 #1149 sync-map mapping，使用 `Refs #1149` / refs-only 语义；runtime attestation、limitation gate、launch evidence、fixtures、live evidence 和 runtime implementation 由后续 issue 承接，不在本 PR 声明 #1149 自动关闭或 live/browser complete。

## 分阶段拆分

### 阶段 1：matrix 边界冻结

- 产出：`spec.md`、`contracts/cloakbrowser-capability-matrix.md`
- 重点：明确 #1149 只拥有 capability matrix，不重写 #1146/#1147/#1148 descriptor shape，不定义 health schema、limitation gate 或 runtime evidence。

### 阶段 2：capability rows 落成

- 产出：`data-model.md`
- 重点：为 direct / persistent / cloakserve 每个 capability 写明 support level、minimum support state、evidence policy requirements、variant inputs、limitation、verification source 与 evidence ref strategy。

### 阶段 3：fail-closed 与 downstream owner 收口

- 产出：`risks.md`、`TODO.md`
- 重点：确认 unsupported / partial / declared rows 按 `FR-0035` fail closed，并把 #1152/#1153/#1150/#1151/#1154/#1155/#1156/#1157 保持为 downstream owner。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0052 suite 与 sync map，不混入 runtime、health implementation、limitation gate、launch evidence、fixtures、scripts、workflows 或 live/browser actions。

## 实现约束

- 不修改 runtime、extension、native host、provider adapter、Playwright、provider selection、doctor、CLI、fixtures、tests、scripts、workflows、githooks、`AGENTS.md` 或 `code_review.md`。
- 不修改 `FR-0049` direct descriptor、`FR-0050` persistent descriptor 或 `FR-0051` cloakserve descriptor。
- 不定义 health result schema，不替代 `FR-0038`。
- 不定义 #1152 limitation gate result，不推进 #1153 runtime/evidence convergence。
- 不定义 launch evidence、redaction payload、fresh live evidence、runtime attestation 或 fixture payload。
- 不触发 live/browser/runtime/Syvert/XHS。
- 不触碰五个 live-evidence governance 冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `bash scripts/spec-issue-sync-map.sh validate`
  - `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0052-cloakbrowser-capability-matrix/spec.md`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh work/1149-cloakbrowser-capability-matrix main`
- diff 检查：
  - `git diff --check origin/main...HEAD`
  - `git diff --stat origin/main...HEAD`
  - `git diff --name-only origin/main...HEAD`
- 语义自检：
  - 对照 issue #1149 和 parent #1114，确认只覆盖 capability matrix。
  - 对照 FR-0049/FR-0050/FR-0051，确认只消费 descriptor identity、mode、engine、transport、profile/extension/native refs、final args / fingerprint boundary 与 limitations。
  - 对照 FR-0035，确认 support state、minimum support state、evidence policy requirements、verification source、evidence strategy 与 fail-closed 口径一致。
  - 对照 FR-0053/FR-0054/FR-0057/FR-0058/FR-0059/FR-0060，确认只引用 evidence / health input strategy，不声明其结果已通过。

## TDD 范围

- 当前只冻结 formal capability matrix contract，不进入实现代码 TDD。
- 后续 implementation 或 parser issue 应优先补以下测试：
  - matrix parser 拒绝缺少 support level、minimum support state、evidence policy requirements、variant inputs、limitation、verification source 或 evidence ref strategy 的 row。
  - direct matrix 对 Native Messaging capability 输出 unsupported。
  - persistent matrix 不把 profile / extension / Native Messaging descriptor refs 解释为 health pass 或 runtime ready。
  - cloakserve matrix 对 extension bridge / Native Messaging 输出 unsupported，并对 experimental read/write/download 输出 declared plus limitation gate requirement。
  - business admission 不接受 `declared` 或低于目标 minimum support state 的 row。
  - evidence consumer 不把 future evidence ref slot 解释为 evidence passed。

## 并行 / 串行关系

- 可并行：
  - 不触碰 FR-0052 suite 的普通本仓库文档整理。
  - 不消费 CloakBrowser capability matrix 的 runtime bugfix。
- 串行 / 依赖：
  - 本 work item 依赖 closed #1146 / FR-0049、closed #1147 / FR-0050、closed #1148 / FR-0051，以及 FR-0035。
  - #1152 必须消费本 matrix 和 descriptor limitations，不能从 descriptor existence 推导 limitation gate pass。
  - #1153 必须消费本 matrix thresholds，不能从 matrix static support 推导 runtime/live readiness。
  - Health / launch / fixture owners must consume descriptor + matrix + scoped evidence refs before producing runtime or fixture outputs.

## 进入实现前条件

- FR-0052 spec review 通过。
- reviewer 确认本 PR 使用 `Refs #1149` / refs-only，且 GitHub `closingIssuesReferences=[]`。
- reviewer 确认每个 capability row 均包含 support level、minimum support state、evidence policy requirements、variant inputs、limitation、verification source 与 evidence ref strategy。
- reviewer 确认 unsupported / partial / declared rows 按 `FR-0035` fail closed。
- reviewer 确认本 suite 没有定义 descriptor shape、health schema、limitation gate output、launch evidence、fixtures、runtime implementation 或 live evidence。
