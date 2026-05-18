# GitHub Delivery Funnel

本文件定义 Loom 当前默认 `GitHub governance profile` 的交付漏斗。

GitHub 是 Loom 当前默认宿主实现，但不是唯一宿主内核。
其他宿主只要能提供等价对象与状态读取面，也可以实现同一条漏斗。

## 1. 默认漏斗

Loom 当前冻结的默认交付路径如下：

- `Roadmap / 阶段目标`
- `GitHub Phase`
- `GitHub FR`
- `GitHub Work Item`
- `spec / contract`
- `spec gate`
- `implementation PR`
- `review gate`
- `merge gate`
- `GitHub controlled merge`

Loom 只冻结这条路径的语义，不冻结 GitHub 之外宿主的具体对象名字。

## 2. 对象分工

### 2.1 `Roadmap / 阶段目标`

负责表达当前阶段为什么存在、阶段边界是什么、什么结果才算本阶段完成。

它不直接进入执行，也不直接承接 PR。

### 2.2 `Phase`

负责把阶段目标映射到一组较稳定的治理范围。

它回答：

- 当前阶段在推进什么大面
- 哪些 `FR` 属于同一阶段
- 阶段边界何时允许收口

Deferred Phase container 可以提前保留未来 roadmap tree，但必须暴露：

- `Activation Policy`
  - 说明何时从 deferred roadmap 转入 active execution
  - 明确 deferred child 激活前不需要 PR、merge 或 closeout evidence
- `Roadmap Inventory`
  - 明确列出 canonical FR children
  - 明确列出 canonical Work Item children
  - 明确说明 closed deferred children are deferred, not completed
  - duplicate/retry artifacts 必须单独列出，并排除出 canonical inventory

### 2.3 `FR`

`FR` 默认承接 formal spec / planning 层。

它回答：

- 为什么值得进入正式承诺
- 共享边界和风险是什么
- 应拆出哪些 `Work Item`

默认情况下：

- `FR` 不直接承接实现 PR
- `FR` 不替代 `Work Item`
- `FR` 不并行 authored 执行中停点或验证摘要

### 2.4 `Work Item`

`Work Item` 是 Loom 默认唯一执行入口。

只有 `Work Item` 可以进入：

- worktree / branch 绑定
- recovery / resume
- implementation PR
- review / merge-ready / closeout

任何未收成 `Work Item` 的对象，都默认仍停留在规划或边界层。

### 2.5 gate chain

GitHub profile 下的正式放行链固定为：

- `spec gate`
- `build gate`
- `review gate`
- `merge gate`

其中：

- `spec gate`
  - 负责 formal spec 路径的通过 / 阻断
- `build gate`
  - 负责实现仍在已批准范围内，且验证基线可继续消费
- `review gate`
  - 负责正式 implementation review 结论进入单一 review record
- `merge gate`
  - 负责进入宿主 merge 前的最终统一放行

### 2.6 `GitHub controlled merge`

进入 `merge gate` 通过后，真正的 merge 仍由 GitHub 控制面执行。

Loom 只消费：

- `head_sha`
- required checks
- review 状态
- branch protection / ruleset
- merge 结果与 main 吸收事实

## 3. 前置关系

默认前置关系固定如下：

- `Roadmap / Phase` 为 `FR` 提供阶段边界
- `FR` 为 `Work Item` 提供正式目标与共享边界
- `Work Item` 若命中 formal spec 准入，必须先有 `spec / contract`
- `spec gate` 通过后，`Work Item` 才能进入 `implementation PR`
- `review gate` 不替代 `spec gate`
- `merge gate` 不承担第一次高质量语义判断
- `GitHub controlled merge` 只能发生在 `merge gate` 通过之后

## 4. Loom 与 GitHub 的边界

Loom 不要求自研 GitHub 控制面。

Loom 只要求 GitHub profile 至少能稳定提供：

- `Roadmap / Phase / FR / Work Item` 的映射关系
- 当前事项的 `head_sha`
- `spec gate / review gate / merge gate` 的最小状态读取
- `GitHub controlled merge` 所需的 required checks / branch protection / ruleset 读面
- parent / sub-issue 关系

这些读取面应被 Loom 消费，而不是在 skill、脚本和 PR 描述里各自发明一套解释。

## 5. 非目标

- 不把 `Phase / FR / Work Item` 三个名字冻结为 Loom 永恒唯一命名
- 不把 GitHub API 细节提升为 Loom core 规则
- 不让 `FR` 或 `PR` 越权替代 `Work Item`
- 不把 Loom 写成 merge 执行者；merge 始终属于宿主控制面
