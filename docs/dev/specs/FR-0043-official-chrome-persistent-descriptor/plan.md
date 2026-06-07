# FR-0043 实施计划

## 实施目标

把 `#1138 official-chrome.persistent Descriptor` 冻结成一个窄 formal suite：只定义 `official-chrome.persistent` 的 persistent-specific descriptor delta，消费 `FR-0042` common descriptor shape，并为 #1139、M3-C health、#1143 launch evidence 与 #1144 fixtures 提供静态输入。

`#1138` 是 `work-item-complete`：合入本 suite 后满足 persistent descriptor contract 的关闭条件；capability matrix、health schema、launch evidence、fixtures 与 runtime implementation 由后续 issue 承接。

## 分阶段拆分

### 阶段 1：persistent delta 边界冻结

- 产出：`spec.md`、`contracts/official-chrome-persistent-descriptor-delta.md`
- 重点：确认 `official-chrome.persistent` 只扩展 persistent-specific delta，不重写 `FR-0042` common shape。

### 阶段 2：profile / extension / native messaging refs 落成

- 产出：`data-model.md`
- 重点：冻结 persistent profile reference、profile identity constraints、extension binding refs 与 native messaging readiness refs。

### 阶段 3：禁止范围与后续 owner 收口

- 产出：`risks.md`、`TODO.md`
- 重点：确认 health schema、launch evidence、redaction、capability matrix、runtime implementation、fixtures、live action 均保持 out of scope。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0043 suite 与 sync map，不混入 runtime、fixtures、health、capability matrix 或 launch evidence。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider selection、doctor、CLI、fixtures 或测试代码。
- 不修改 `FR-0042` common shape 或 direct variant。
- 不定义 capability matrix semantics，不声明 persistent variant 的 action/layer support matrix。
- 不定义 health result schema，不替代 `FR-0038`。
- 不定义 launch evidence、redaction shape、fresh live evidence、runtime attestation 或 fixture payload。
- 不修改 `FR-0033` / `FR-0036` 已冻结基础契约。
- 不触碰五个 live-evidence governance 冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `bash scripts/spec-issue-sync-map.sh validate`
  - `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0043-official-chrome-persistent-descriptor/spec.md`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/m3-1138-official-chrome-persistent-descriptor main`
- diff 检查：
  - `git diff --check origin/main...HEAD`
  - `git diff --stat origin/main...HEAD`
  - `git diff --name-only origin/main...HEAD`
- 语义自检：
  - 对照 issue #1138 和 parent #1113，确认只覆盖 persistent-specific delta。
  - 对照 FR-0042，确认 common descriptor shape 未被重写。
  - 对照 FR-0033/FR-0036，确认本 suite 只消费基础 provider contract / registry shape。
  - 对照 scope 禁止项，确认没有 capability matrix、health schema、launch evidence、fresh live evidence、fixtures 或 runtime implementation。

## TDD 范围

- 当前只冻结 formal descriptor contract，不进入实现代码 TDD。
- 后续 implementation 或 parser issue 应优先补以下测试：
  - descriptor parser 接受 `variant_kind=persistent` 且要求 `common_shape_owner=#1137`。
  - descriptor parser 拒绝 `official-chrome.persistent` 缺少 profile / extension / native messaging refs。
  - descriptor parser 拒绝 persistent descriptor 内联 credentials、cookies 或 sensitive absolute paths。
  - registry consumer 不把 descriptor 存在误判为 runtime ready。
  - health/evidence consumer 不从 descriptor refs 推导 health pass 或 launch evidence pass。

## 并行 / 串行关系

- 可并行：
  - 不触碰 FR-0043 suite 的普通本仓库文档整理。
  - 不消费 official Chrome persistent descriptor 的 runtime bugfix。
- 串行 / 依赖：
  - 本 work item 依赖 closed #1137 / FR-0042、closed #1123 / FR-0033、closed #1125 / FR-0036。
  - #1139 必须消费本 descriptor delta 与 FR-0035，不能提前在 #1138 定义 matrix。
  - M3-C health issues 必须消费 FR-0038，不能从本 descriptor 推导 health schema。
  - #1143 必须消费 FR-0040 与 FR-0041，不能从本 descriptor 推导 launch evidence / redaction shape。
  - #1144 必须等待 descriptor、matrix、health 与 launch evidence owner 提供输入。

## 进入实现前条件

- FR-0043 spec review 通过。
- reviewer 确认 #1138 的关闭语义是 persistent descriptor delta complete，不是 runtime behavior complete。
- reviewer 确认 `official-chrome.persistent` 不重写 `FR-0042` common shape 或 direct variant。
- reviewer 确认 profile / extension / native messaging readiness 只以 refs 表达，没有被写成 runtime ready 或 health result。
- reviewer 确认后续 #1139/#1140-#1144 的 owner 边界清楚。
