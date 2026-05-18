# GitHub Profile

本文件定义 Loom strong governance 默认 `GitHub governance profile`。

GitHub 是默认 host-backed 实现，不是 Loom 唯一可支持宿主。

## 1. 目标

让普通仓库不仅能接入 Loom，还能沿同一条升级路径逐步达到 strong governance。

## 2. 最小对象组

GitHub profile 至少应能表达：

- `Roadmap / 阶段目标`
- 目标仓库 `release / version` 目标面
- `Phase`
- `FR`
- `Work Item`
- `implementation PR`
- implementation review / `merge-ready`
- `controlled merge`
- `closeout / reconciliation` 信号

这些对象可以通过 issue、sub-issue、PR、branch protection、required checks、merge commit、Project 等宿主能力承接。

## 3. 默认映射

当前默认映射如下：

- `Roadmap / 阶段目标`
  - 版本目标、阶段树或等价治理目标面
- 目标仓库 `release / version` 目标面
  - repo-owned 或 host-owned release target object
  - 用于声明当前目标版本、目标分支、release goal、纳入范围与 closeout evidence locator
  - 只作为规划与收口容器，不替代 `Work Item`
- `Phase`
  - 阶段级 issue 或等价规划对象
  - deferred Phase container 必须声明 `Activation Policy` 与 `Roadmap Inventory`
  - `Roadmap Inventory` 必须列出 canonical FR children 与 canonical Work Item children
  - closed deferred children are deferred, not completed
  - duplicate/retry artifacts 必须单独标明，并排除出 canonical inventory
- `FR`
  - formal spec / planning issue
- `Work Item`
  - 唯一默认执行入口 issue
- `implementation PR`
  - 与当前 `Work Item` 绑定的实现 PR
- `controlled merge`
  - branch protection、required checks、merge method、merge commit 的统一消费面
- `closeout / reconciliation`
  - 可继续消费目标仓库 release/version 目标面的 closeout evidence 与 release status gap

## 4. strong governance 默认要求

GitHub host 下的 strong governance 默认要求：

- `Work Item` 是唯一默认执行入口
- 目标仓库 `release / version` 目标面只能映射 delivery chain，不得直接进入 execution
- `FR -> Work Item -> PR -> merge commit` 绑定链可稳定读取
- formal spec 路径必须先过 `spec review`
- implementation review、`merge-ready`、`controlled merge`、`closeout` 强制消费前序 gate
- 统一状态面能直接暴露 stale / drift / gate failure
- closeout 必须消费 `reconciliation audit`
- 若仓库声明了目标 `release / version`，closeout 必须能区分 `merged but unreleased`、`released but unreconciled` 与 release evidence gap
- merge 默认走受控 PR 合入，默认方法为 `squash`

## 5. 三档 profile

### Light

- 只要求 `Work Item -> review -> merge-ready`
- 允许缺 formal spec 路径与强 closeout control plane

### Standard

- 引入 `FR`、formal spec、`spec review`
- 引入统一状态读取面与基本 host binding

### Strong Governance

- 强制 `Work Item` enforcement
- 强制 host binding、gate chain、`controlled merge`
- 强制 closeout / reconciliation 一体化状态面
- 要求有 parity validation 证据

## 6. 与 adoption 的关系

- 默认升级顺序见 [github-profile-upgrade.md](./github-profile-upgrade.md)
- 成熟治理重仓的 attach-only 路径见 [deep-existing-repo-default.md](./deep-existing-repo-default.md)
- agent-assisted 低摩擦接入闭环见 [zero-friction-adoption-contract.md](./zero-friction-adoption-contract.md)

zero-friction adoption 可以帮助仓库进入 light 或 attach-only 起点，但不能跳过 `standard` 直接宣称 `strong`，也不能把 validation-only parity 自动升级为 blocking gate。

## 7. 非 GitHub 宿主

非 GitHub 宿主只要能提供相同语义，也可以实现 Loom。

Loom 冻结的是：

- 对象语义
- 绑定链
- gate chain
- 状态控制面
- closeout 语义

不是 GitHub 的产品细节。
