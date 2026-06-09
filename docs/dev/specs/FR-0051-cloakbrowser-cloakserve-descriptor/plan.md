# FR-0051 实施计划

## 实施目标

把 `#1148 cloakbrowser.cloakserve Descriptor` 冻结成一个窄 formal suite：只定义 `cloakbrowser.cloakserve` 的 static descriptor、default extension disabling、extension workflow experimental status、provider contract refs、limitation refs 与 evidence slots，供 #1149 capability matrix 和 #1152 limitation gate 消费。

`#1148` 是 `work-item-complete`：合入本 suite 后满足 cloakserve descriptor/limitation freeze 的关闭条件；capability matrix、limitation gate、health、launch evidence、fixtures 与 runtime implementation 由后续 issue 承接。

## 分阶段拆分

### 阶段 1：cloakserve descriptor 边界冻结

- 产出：`spec.md`、`contracts/cloakbrowser-cloakserve-descriptor.md`
- 重点：冻结 provider identity、external managed mode、CDP transport、provider contract refs 与 out-of-scope boundary。

### 阶段 2：extension / limitation / evidence 边界落成

- 产出：`data-model.md`
- 重点：冻结 default extension disabling、extension workflow experimental-only、limitation refs 与 evidence slots。

### 阶段 3：风险与后续 owner 收口

- 产出：`risks.md`、`TODO.md`、`research.md`
- 重点：确认 #1149/#1152 可消费输入已足够，且 health、runtime、fixtures、browser patching、XHS、Syvert 均保持 out of scope。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0051 suite 与 sync map，不混入 #1146/#1147/#1149/#1152、runtime、fixtures、health、live evidence 或 forbidden paths。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider selection、doctor、CLI、fixtures 或测试代码。
- 不定义 `cloakbrowser.direct` 或 `cloakbrowser.persistent` descriptor。
- 不定义 #1149 capability matrix semantics，不声明 action/layer support matrix。
- 不定义 #1152 limitation gate implementation 或 gate result schema。
- 不定义 health result schema，不替代 `FR-0038`。
- 不定义 launch evidence、redaction shape、fresh live evidence、runtime attestation 或 fixture payload。
- 不修改 `FR-0033` / `FR-0035` / `FR-0036` 已冻结基础契约。
- 不触碰 `.github/workflows`、`scripts`、`.githooks`、`AGENTS.md` 或 `code_review.md`。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `bash scripts/spec-issue-sync-map.sh validate`
  - `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0051-cloakbrowser-cloakserve-descriptor/spec.md`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/1148-cloakbrowser-cloakserve-descriptor main`
- diff 检查：
  - `git diff --check`
  - `git diff --stat origin/main...HEAD`
  - `git diff --name-only origin/main...HEAD`
- 语义自检：
  - 对照 issue #1148 和 parent #1114，确认只覆盖 cloakserve descriptor / limitation。
  - 对照 FR-0033/FR-0035/FR-0036，确认本 suite 只消费基础 provider contract / verification / registry shape。
  - 对照 scope 禁止项，确认没有 runtime behavior、fixtures、health、XHS、Syvert、official Chrome service worker 或 browser patching。

## TDD 范围

- 当前只冻结 formal descriptor contract，不进入实现代码 TDD。
- 后续 implementation 或 parser issue 应优先补以下测试：
  - descriptor parser 接受 `provider_id=cloakbrowser.cloakserve`、`distribution_channel=experimental` 与 `provider_mode=external_managed`。
  - descriptor parser 拒绝缺少 `cloakserve_default_extension_disabled` 的 cloakserve descriptor。
  - capability matrix consumer 不从 `cdp_support=supported` 推导 business allow。
  - limitation gate consumer 对 extension runtime、Native Messaging、profile-bound 和 latest-head evidence capabilities fail-closed。
  - evidence consumer 不把 empty evidence slots 解释为 health pass、launch pass 或 live evidence pass。

## 并行 / 串行关系

- 可并行：
  - #1146 cloakbrowser.direct Descriptor。
  - #1147 cloakbrowser.persistent Descriptor。
  - 不触碰 FR-0051 suite 的普通本仓库文档整理。
- 串行 / 依赖：
  - 本 work item 依赖 closed `FR-0033`、`FR-0035`、`FR-0036` 作为基础 contract / verification / registry 输入。
  - #1149 必须消费 #1146/#1147/#1148 descriptor 输入，不能提前在 #1148 定义 matrix。
  - #1152 必须消费本 limitation refs，不能从 #1148 推导 gate result schema。
  - Health / launch evidence / fixtures 必须等待各自 owner issue。

## 进入实现前条件

- FR-0051 spec review 通过。
- reviewer 确认 #1148 的关闭语义是 cloakserve descriptor/limitation complete，不是 runtime behavior complete。
- reviewer 确认 default extension disabling 与 extension workflow experimental-only 已冻结，且不承诺 WebEnvoy extension bridge / Native Messaging。
- reviewer 确认 #1149/#1152 downstream owner 边界清楚。
- reviewer 确认本 suite 未混入 runtime、fixtures、health、XHS、Syvert、official Chrome service worker、browser patching 或 live evidence。
