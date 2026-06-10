# FR-0061 实施计划

## 实施目标

冻结 `#1158 XHS Driver Contract` 的 formal spec suite，定义 WebEnvoy XHS driver 输出为 `raw`、`operational`、`evidence`，并冻结 runtime binding、provider requirement ownership、downstream slicing inputs 与 evidence/output 边界。

本 PR 是 formal spec review carrier。合入后只冻结 `FR-0061` suite 与 #1158 sync-map；不自动关闭 #1158，不进入 XHS read implementation、Syvert normalization、live-write、JSON-RPC、browser/profile/account/live evidence 或 provider runtime implementation。

## 分阶段拆分

### 阶段 1：formal scope 冻结

- 产出：`spec.md`
- 重点：冻结 ownership、output envelope、runtime binding、provider requirement ownership、downstream slicing inputs、Syvert boundary、GWT 验收场景与 fail-closed rules。

### 阶段 2：contract / data model 落成

- 产出：`contracts/xhs-driver-contract.md`、`data-model.md`
- 重点：把 machine-consumable schema、forbidden fields、redaction boundary、consumer boundary 与 lifecycle 固定为后续分片输入。

### 阶段 3：research / risks / TODO

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录 formal 输入、local-only integration 判断、live evidence N/A 判断，以及 Syvert/provider/live-write/JSON-RPC scope creep 风险。

### 阶段 4：sync map 与 PR 准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1158 映射、parser-ready PR metadata、验证记录
- 重点：确保 PR 只包含 `FR-0061` suite 与单条 sync-map 映射，closing semantics 为 `Refs #1158`。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0061-xhs-driver-contract/**`
  - `.github/spec-issue-sync-map.yml` 中 #1158 对应映射
- 不修改 runtime/source code、tests、fixtures、scripts、workflows、githooks、`AGENTS.md`、`docs/dev/AGENTS.md`、`code_review.md`、repo Loom carriers 或 unrelated spec suites。
- 不修改 `FR-0024`、`FR-0025`、`FR-0030`、`FR-0033`、`FR-0035`、`FR-0040`、`FR-0041` 的字段 shape。
- 不实现 #1159/#1160/#1161/#1163/#1164/#1165，不触碰 #1174+ live-write lane。
- 不定义 Syvert normalized result、Syvert resource taxonomy、Syvert error taxonomy 或 Syvert workflow。
- 不执行 browser/profile/account/live/external-visible 动作。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；scheduler owns gate。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、metadata readback 与 hosted checks：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0061-xhs-driver-contract/spec.md`
- `bash scripts/check-pr-purity.sh docs/1158-xhs-driver-contract main`
- `git diff --check origin/main...HEAD`
- closing semantics same-class scan，确认只使用 `Refs #1158`，GitHub `closingIssuesReferences=[]`
- same-class scope audit，确认 raw/operational/evidence、provider requirement ownership、Syvert boundary、JSON-RPC/live-write/runtime implementation claims 与 live evidence claims 均符合本 FR
- PR push 后等待 hosted GitHub checks

语义自检：

- 对照 issue #1158，确认 scope 只覆盖 XHS Driver Contract formal suite。
- 对照 `FR-0024` / `FR-0025` / `FR-0030`，确认 request-shape、command surface 与 route evidence 只被引用，不被重写。
- 对照 `FR-0033` / `FR-0035` / `FR-0040` / `FR-0041`，确认 provider requirement 与 evidence 只消费上游 ownership。
- 对照 `FR-0016`，确认本 PR 不声明 fresh live evidence。
- 对照 forbidden scope，确认未进入 Syvert normalized result、read implementation、live-write、JSON-RPC、browser/profile/account/live actions。

## TDD 范围

当前 PR 不进入实现代码 TDD。

后续 implementation / consumer issue 应优先补：

- XHS driver output envelope parser / schema validation tests。
- `raw` / `operational` / `evidence` required section tests。
- Forbidden field tests，覆盖 `normalized`、Syvert taxonomy、`live_write_commit`、`jsonrpc_method`。
- Runtime binding stale / unknown fail-closed tests。
- Provider requirement consumer tests，确认 XHS driver 不能自证 provider capability。
- Evidence redaction tests，确认 raw payload refs 不泄露 Cookie、token、account、profile 或 private path。
- Downstream slicing tests，确认 slice 只能消费声明的 output sections。

## 并行 / 串行关系

可并行：

- 不触碰 `FR-0061` suite 的其他 XHS driver downstream issue 只读 planning。
- 后续 #1159/#1160/#1161/#1163/#1164/#1165 可以准备消费 notes，但不得在本 PR 中实现。

串行 / 依赖：

- 本 work item 依赖已冻结的 XHS request-shape / command surface / route evidence，以及 provider / evidence / redaction baselines。
- 后续 XHS read path implementation 必须先消费本 suite，不能在实现期重新定义 output envelope 或 Syvert boundary。
- Syvert normalized result、resource taxonomy、error taxonomy 必须由 Syvert-owned contract 定义，不能在 WebEnvoy #1158 中补写。
- Live-write、JSON-RPC、browser/account/live behavior 必须等待独立 issue / formal owner。

## 进入实现前条件

- FR-0061 spec review 通过。
- reviewer 确认 XHS driver output 只包含 `raw`、`operational`、`evidence` 三个 section。
- reviewer 确认 runtime binding 不证明 runtime ready、target tab ready 或 live evidence。
- reviewer 确认 provider requirement ownership 只消费 provider/capability/evidence/redaction owners，不重写其字段 shape。
- reviewer 确认 Syvert normalized result、Syvert resource/error taxonomy、read implementation、live-write、JSON-RPC 和 browser/account/live actions 均被排除。
- reviewer 确认 PR closing semantics 使用 `Refs #1158`，且 sync-map 只新增单条映射。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0061-xhs-driver-contract/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1158 的映射。由于本 PR 不实现 runtime 行为，不需要数据迁移、profile cleanup、browser cleanup、secret rotation、artifact cleanup 或 external rollback。
