# Output Contract

使用本文件约束 `loom-init` 的输出。

输出目标不是给出泛建议，而是形成可继续执行的初始化产物模型。

## 必须输出的区块

### 1. 项目判断

必须说明：

- 初始化场景：
  - `新项目`
  - `小型既有仓库`
  - `复杂既有仓库`
- 装配强度：
  - `轻量`
  - `标准`
  - `强化`
- 当前最主要的结构性问题是什么
- 为什么推荐这条路径，而不是另外两条路径

### 2. 推荐装配

至少列出：

- 本轮启用的能力清单
- 每项能力分别映射到哪些 `governance`、`harness`、`templates`、`adoption` 规则
- 这次采用的是最小装配、轻量 retrofit 还是更完整装配
- `Work Item` 是否已被设为唯一执行入口
- `spec gate`、`gate chain`、`status control plane`、`maturity upgrade`、`GitHub controlled merge` 分别由哪些稳定载体承接
- 若命中成熟治理重仓 attach path，必须显式写出 `recommended_adoption.path = deep-existing-repo`
- 接入方式是根级重写还是 `repo companion`（历史表述：`companion docs`）
- 恢复形态是 `checkpoint-lite` 还是标准恢复形态

### 3. 暂不引入

必须显式写出：

- 当前不引入哪些 Loom 能力
- 不引入的原因是什么
- 这些能力未来的升级触发条件是什么

### 4. 首批工件

至少说明：

- 初始能力清单的承载位置
- 首批 `Work Item` 或等价事项清单的承载位置
- 恢复主入口是什么
- progress / checkpoint 载体是什么
- 验证入口是什么
- 状态读取入口是什么
- `status control plane` 的读取入口是什么
- `Runtime Evidence` 区块的落位方式是什么，且至少覆盖：
  - `Run Entry`
  - `Logs Entry`
  - `Diagnostics Entry`
  - `Verification Entry`
  - `Lane Entry`
- 初始 clean state 的定义是什么
- 首个稳定提交或等价回退边界是什么
- 事实链 carrier 如何定位
- 统一事实链读取入口是什么
- gate chain 的读取入口是什么
- `governance_surface` 是什么，并至少稳定给出：
  - `repository_mode`
  - `loom_state`
  - `carrier_summary`
    - `work_item`
    - `recovery`
    - `review`
    - `status_surface`
    - `spec_path`
    - `plan_path`
  - `execution_entry`
  - `validation_entry`
  - `review_merge_surface`
    - `pr_template`
    - `validation_surface`
    - `merge_surface`
  - `github_control_plane`
    - `repository`
    - `default_branch`
    - `branch_protection`
    - `required_checks`
    - `pr_reviews`
  - `repo_interface`
    - `availability`
    - `manifest`
    - `companion_entry`
    - `repo_specific_requirements`
    - `specialized_gates`
    - `summary`
    - `missing_inputs`
  - `summary`
  - `missing_inputs`

若本轮不装配标准恢复或状态面，也必须写清现有载体如何承接这些职责。

若本轮走 `deep-existing-repo`，还必须显式写出：

- attach-only 必备工件是什么
- 哪些 repo-native carriers 继续保留
- 哪些 Loom-owned carriers 本轮不会生成

`init-result` 只允许承接 locator-only 信息，不并行复制实时停点、下一步、阻断项或最近验证摘要。

`Runtime Evidence` 的五个字段必须逐项给出 locator 或 `not_applicable`，不得留空；若使用 `not_applicable`，必须给出可复核原因。

### 4.1 `runtime_state`

初始化输出还必须显式给出当前 Loom 入口自己的 `runtime_state`，至少包含：

- `scene`
  - `repo-local-demo | installed-runtime | upgrade-rehearsal`
- `carrier`
  - `repo-local-wrapper | installed-skills-root | bootstrapped-target-runtime`
- `failure_reason`
  - 当前无法继续运行时的稳定阻断原因数组
- `evidence`
  - 判定依据来自 `install-layout.json`、`upgrade-contract.json`、bootstrap manifest 或当前入口解析结果

这里的 `runtime_state` 只回答 Loom 入口自身处于什么安装/运行场景，不是 `governance_surface.loom_state` 的别名。
`governance_surface.loom_state` 回答的是仓库 Loom 装配程度；`runtime_state` 回答的是当前入口能否被视为 installed runtime 并继续运行。

### 4.2 `lifecycle_expectations`

初始化输出还必须给出 `lifecycle_expectations`，用于声明 workspace / worker lifecycle 的最小可执行合同：

- `workspace_entry` 与解析后的 workspace path
- `create`、`locate`、`attach`、`handoff`、`cleanup`、`retire` 的语义边界
- `execution_boundary.run` / `execution_boundary.stop` 只作为读面或事件语义
- `remove.in_core = false`
- 默认 `worker_backend.backend = local` 且 `daemon = false`

该区块只表达 lifecycle 期望，不回写 recovery entry，也不接管 branch、PR、git worktree 或 worker daemon。

### 5. 首批事项

至少拆出：

- 每个事项的：
  - 事项标识
  - 目标
  - 范围
  - 执行路径
  - 关联工件
  - 关闭条件
- 若命中 formal spec 路径，还必须说明 `spec gate` 由谁承接
- 恢复主入口与工作现场入口
- 若事项已进入轻量跨轮承接，必须说明谁负责回写停点、下一步、阻断项与最近验证摘要

## `governance_surface` 的公共约束

`governance_surface` 是 `loom-init`、`loom-adopt` 与 `loom-resume` 共享的稳定公共读面。

它只回答“当前仓库属于哪种执行模式、Loom 装配到什么程度、治理载体和宿主控制面分别位于哪里”，不复制实时 authored 状态。

固定要求：

- 字段命名保持 `governance_surface`
- 字段命名保持：
  - `repository_mode`
  - `loom_state`
  - `carrier_summary`
  - `execution_entry`
  - `validation_entry`
  - `review_merge_surface`
  - `github_control_plane`
  - `repo_interface`
  - `summary`
  - `missing_inputs`
- `carrier_summary` 的 6 个子项固定为：
  - `work_item`
  - `recovery`
  - `review`
  - `status_surface`
  - `spec_path`
  - `plan_path`
- `carrier_summary` 每个子项固定为 `{status, locator, source}`，`status` 只允许 `present | missing | planned`
- `github_control_plane` 缺失时允许用 `unknown`，但不得猜测
- `repo_interface` 只允许承接 `repo companion` 的 locator 和机读 requirements / gates 摘要，不得复制 authored state
- `repo_interface.availability` 只允许：
  - `absent`
  - `companion_docs_only`
  - `incomplete`
  - `present`
- `repo_interface.manifest`、`repo_interface.companion_entry`、`repo_interface.repo_specific_requirements`、`repo_interface.specialized_gates` 固定为 `{status, locator, source}`

禁止事项：

- 把 `governance_surface` 写成第二套事项进度真相
- 改名或拆出并行的治理读面字段
- 在 `governance_surface` 中并行复制实时停点、下一步、阻断项或验证摘要
- 用 `governance_surface` 覆盖 `Work Item`、恢复入口、PR 或规则文档的 authored 事实
- 把 `repo_interface` 变成第二套 review / recovery / closeout authored state

### 6. 验证与收口

至少说明：

- 如何验证初始化输出已经可直接承接执行
- gate chain 的承接关系是什么（固定命名为 `spec gate -> build gate -> review gate -> merge gate`；若不命中 formal spec，则从 `build gate` 开始）
- 什么状态算“说明已清楚”
- 什么状态算“已进入主干并收口”
- 何时 issue 可以关闭

## 初始化产物模型的最低要求

无论场景轻重，初始化输出都必须让后续执行者能直接回答以下问题：

- 当前属于哪条初始化路径
- 当前启用了哪些能力，暂不启用哪些能力
- 首批执行从哪里进入
- 恢复主入口在哪里
- 验证入口在哪里
- 当前 clean state 如何识别
- 首个稳定提交或等价回退边界如何识别
- 相关信息分别落在哪个载体上

若这些问题仍需要靠临场解释补齐，说明输出合同未达标。

对 `deep-existing-repo` 而言，这组问题的答案允许由 attach metadata、repo companion 入口与 repo-native carriers 共同承接；它不要求第一轮就生成 Loom-owned `work-item` / `progress` / `status-surface`。
