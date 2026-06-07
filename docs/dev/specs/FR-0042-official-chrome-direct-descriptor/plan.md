# FR-0042 实施计划

## 实施目标

把 `#1137 official-chrome.direct Descriptor` 冻结成一个窄 formal suite：只定义 official Chrome common descriptor shape 与 `official-chrome.direct` direct-launch variant，供 #1138/#1139 及后续 health/evidence/fixture issue 消费。

`#1137` 是 `work-item-complete`：合入本 suite 后满足 common descriptor shape + direct variant 的关闭条件；persistent delta、capability matrix、health schema、launch evidence、fixtures 与 runtime implementation 由后续 issue 承接。

## 分阶段拆分

### 阶段 1：common descriptor shape 冻结

- 产出：`spec.md`、`contracts/official-chrome-descriptor.md`
- 重点：冻结 identity、mode、engine、transport、profile semantics、capability refs、limitation refs、evidence slots。

### 阶段 2：direct variant 边界落成

- 产出：`data-model.md`
- 重点：固定 `official-chrome.direct` 的 direct launch provider id、headful Google Chrome stable、Playwright/CDP launch transport 与 ephemeral profile semantics。

### 阶段 3：后续 owner 与禁止范围收口

- 产出：`risks.md`、`TODO.md`
- 重点：确认 persistent-specific delta、capability matrix、health schema、launch evidence、fresh live evidence、fixtures 与 runtime implementation 全部保持 out of scope。

### 阶段 4：PR 与验证准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0042 suite 与 sync map，不混入 runtime、fixtures、health、capability matrix 或 launch evidence。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider selection、doctor、CLI、fixtures 或测试代码。
- 不定义 `official-chrome.persistent` 的 extension/native messaging/profile/service worker delta。
- 不定义 capability matrix semantics，不声明 direct variant 的 action/layer support matrix。
- 不定义 health result schema，不替代 `FR-0038`。
- 不定义 launch evidence、fresh live evidence、runtime attestation 或 fixture payload。
- 不修改 `FR-0033` / `FR-0036` 已冻结基础契约。
- 不触碰五个 live-evidence governance 冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
  - `bash scripts/spec-issue-sync-map.sh validate`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/m3-1137-official-chrome-direct-descriptor main`
- diff 检查：
  - `git diff --check`
  - `git diff --stat origin/main...HEAD`
  - `git diff --name-only origin/main...HEAD`
- 语义自检：
  - 对照 issue #1137 和 parent #1113，确认 common shape 与 direct variant 已覆盖。
  - 对照 FR-0033/FR-0036，确认本 suite 只消费基础 provider contract / registry shape。
  - 对照 scope 禁止项，确认没有 persistent delta、capability matrix、health schema、launch evidence、fresh live evidence 或 fixtures。

## TDD 范围

- 当前只冻结 formal descriptor contract，不进入实现代码 TDD。
- 后续 implementation 或 parser issue 应优先补以下测试：
  - descriptor parser 拒绝未知 `variant_kind`。
  - descriptor parser 拒绝 `official-chrome.direct` 中出现 persistent-only 字段。
  - registry consumer 不把 descriptor 存在误判为 runtime ready。
  - capability matrix consumer 只能读取 descriptor refs，不从 descriptor 推断 supported actions。
  - evidence consumer 不把 empty evidence slots 解释为 evidence passed。

## 并行 / 串行关系

- 可并行：
  - 不触碰 FR-0042 suite 的普通本仓库文档整理。
  - 不消费 official Chrome descriptor 的 runtime bugfix。
- 串行 / 依赖：
  - 本 work item 依赖 closed #1123 / FR-0033 和 closed #1125 / FR-0036。
  - #1138 必须等待本 common shape 稳定后，只补 persistent-specific delta。
  - #1139 必须消费本 descriptor refs 与 FR-0035，不能提前在 #1137 定义 matrix。
  - M3 health issues 必须消费 FR-0038，不能从本 descriptor 推导 health schema。
  - launch evidence 与 fixtures 必须等待各自 owner issue。

## 进入实现前条件

- FR-0042 spec review 通过。
- reviewer 确认 #1137 的关闭语义是 common descriptor shape + direct variant complete，不是 runtime behavior complete。
- reviewer 确认 `official-chrome.direct` 不承诺 persistent profile、extension binding、native messaging 或 login state reuse。
- reviewer 确认 capability refs、limitation refs 与 evidence slots 没有被写成 matrix、health schema、launch evidence 或 fixture。
- reviewer 确认后续 #1138/#1139/#1140-#1144 的 owner 边界清楚。
