# FR-0055 实施计划

## 实施目标

把 `#1152 Cloakserve Limitation Gate` 冻结成一个窄 formal suite：只定义 `cloakbrowser.cloakserve` limitation / admission gate，消费 `FR-0051` descriptor limitation refs、`FR-0052` capability matrix rows 与 `FR-0035` fail-closed 语义，确保 extension runtime、Native Messaging 与 WebEnvoy relay bridge workflow 默认 blocked / deny。

本 PR 只冻结 `FR-0055` suite 与 #1152 sync-map mapping，使用 `Refs #1152` / refs-only 语义；runtime/evidence convergence、extension capability gate consumption、launch evidence、fixtures、live evidence 和 runtime implementation 由 #1153 或后续 issue 承接，不在本 PR 声明 #1152 自动关闭或 live/browser complete。

## 分阶段拆分

### 阶段 1：limitation gate 边界冻结

- 产出：`spec.md`、`contracts/cloakserve-limitation-gate.md`
- 重点：明确 #1152 只拥有 cloakserve limitation / admission gate，不重写 FR-0051 descriptor、FR-0052 matrix，不定义 #1153 runtime/evidence output。

### 阶段 2：gate input / output 落成

- 产出：`data-model.md`
- 重点：定义 gate input、requested workflow、default fail-closed policy、hard block output 与 scoped experimental issue requirement。

### 阶段 3：风险与 downstream owner 收口

- 产出：`risks.md`、`research.md`、`TODO.md`
- 重点：确认 extension/native messaging 默认阻断、experimental issue 只允许 downstream evaluation、runtime/live evidence 不被声明。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0055 suite 与 sync map，不混入 runtime、#1153、scripts、workflows、browser/live actions 或 closeout。

## 实现约束

- 不修改 runtime、extension、native host、provider adapter、Playwright、provider selection、doctor、CLI、fixtures、tests、scripts、workflows、githooks、`AGENTS.md` 或 `code_review.md`。
- 不修改 `FR-0051` cloakserve descriptor 或 `FR-0052` capability matrix。
- 不推进 #1153 runtime/evidence convergence、extension capability gate、launch evidence、fixtures 或 live evidence。
- 不触发 browser/runtime/live/Syvert/XHS actions。
- 不触碰 #1145 closeout blocker、#1153 implementation、repo Loom carriers 或五个 live-evidence governance 冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `bash scripts/spec-issue-sync-map.sh validate`
  - `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0055-cloakserve-limitation-gate/spec.md`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh work/1152-cloakserve-limitation-gate main`
- diff 检查：
  - `git diff --check origin/main...HEAD`
  - `git diff --stat origin/main...HEAD`
  - `git diff --name-only origin/main...HEAD`
- 语义自检：
  - 对照 issue #1152 和 parent #1114，确认只覆盖 cloakserve limitation / admission gate。
  - 对照 FR-0051，确认消费 descriptor limitation refs，不改写 descriptor shape。
  - 对照 FR-0052，确认消费 cloakserve matrix rows，不改写 capability matrix。
  - 对照 FR-0035，确认 blocked/deny、unsupported、declared-only fail closed 口径一致。
  - 对照 #1153，确认本 suite 只提供 input，不完成 runtime/evidence convergence。

## TDD 范围

- 当前只冻结 formal limitation gate contract，不进入实现代码 TDD。
- 后续 implementation 或 parser issue 应优先补以下测试：
  - gate parser rejects cloakserve extension bridge without scoped experimental issue.
  - gate parser rejects cloakserve Native Messaging without scoped experimental issue.
  - business read/write/download rejects `declared` cloakserve rows when runtime/evidence refs are missing.
  - scoped experimental issue only changes hard block to downstream evaluation, not allow.
  - runtime ping, bootstrap ack, doctor success, stale artifact or historical artifact cannot satisfy limitation gate.
  - unknown workflow or unknown limitation token produces blocked/deny.

## 并行 / 串行关系

- 可并行：
  - 不触碰 FR-0055 suite 的普通本仓库文档整理。
  - 不消费 CloakBrowser limitation gate 的 runtime bugfix。
- 串行 / 依赖：
  - 本 work item 依赖 closed #1148 / FR-0051 与 closed #1149 / FR-0052，以及 FR-0035。
  - #1153 必须消费本 limitation gate output before claiming runtime/evidence convergence or extension capability gate.
  - #1154/#1155/#1156/#1157 可提供 scoped evidence inputs，但不得把它们单独写成 cloakserve business allow。
  - Future runtime/live owners must consume limitation gate refs and accepted evidence before producing allow semantics.

## 进入实现前条件

- FR-0055 spec review 通过。
- reviewer 确认本 PR 使用 `Refs #1152` / refs-only，且 GitHub `closingIssuesReferences=[]`。
- reviewer 确认 extension runtime、Native Messaging 与 WebEnvoy relay bridge 对 cloakserve 默认 hard blocked / deny。
- reviewer 确认 scoped experimental issue 只能允许 downstream evaluation，不能直接产生 allow。
- reviewer 确认本 suite 没有 runtime/source code、provider adapter behavior、#1153 output、browser/live evidence、scripts、workflows 或 issue closeout。
