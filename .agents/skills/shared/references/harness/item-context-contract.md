# Item Context Contract

本文件定义 Loom 当前最小 `item context` 合同。

它服务统一读取，不新建第二套 authored 真相。

字段归属仍以：

- [work-item-contract.md](./work-item-contract.md)
- [fact-chain-contract.md](./fact-chain-contract.md)
- [status-surface.md](./status-surface.md)

为准。

## 1. 目标

`item context` 负责回答一件事：

当前事项在宿主和 Loom 两侧，分别被怎样识别、定位和放行。

它必须能同时服务：

- `loom-resume`
- `loom-spec-review`
- `loom-review`
- `loom-merge-ready`
- `status control plane`
- GitHub host 读取

## 2. 最小字段

Loom 当前冻结以下最小字段：

- `item_key`
- `item_type`
- `phase`
- `fr`
- `release`
- `sprint`
- `head_sha`
- `status`
- `gate_chain`

## 3. 字段语义

### 3.1 `item_key`

当前正式执行单元的稳定标识。

repo-local 默认来自 `work item.item_id`。
host-backed profile 可以映射到 issue / work item 编号，但语义必须保持一致。

### 3.2 `item_type`

当前对象在漏斗里的层级。

当前最小允许值：

- `phase`
- `fr`
- `work_item`
- `spec`
- `implementation_pr`

进入正式执行时，默认必须收敛为 `work_item`。

### 3.3 `phase`

当前 `Work Item` 所属阶段。

若宿主未声明，允许为 `not_declared`，但不得伪造。

### 3.4 `fr`

当前 `Work Item` 所属 formal planning 对象。

若当前事项走轻量路径、没有独立 `FR`，允许为 `not_declared`。

### 3.5 `release`

当前事项所属版本或等价阶段收口面。

### 3.6 `sprint`

当前事项所属执行批次。

### 3.7 `head_sha`

当前 execution / review / merge-ready 应消费的 Git HEAD。

它是 `review stale`、`head drift`、受控合并和恢复时判断前序结论是否仍可消费的最小锚点。

### 3.8 `status`

当前事项在 Loom 漏斗中的最小状态。

建议最小集合：

- `planning`
- `spec_ready`
- `spec_approved`
- `implementation_ready`
- `in_review`
- `merge_ready`
- `closed`

### 3.9 `gate_chain`

当前事项在强治理控制面中的 gate 位置。

最小子字段：

- `spec_gate`
- `build_gate`
- `review_gate`
- `merge_gate`

## 4. 来源边界

这些字段不得全部 authored 在单一载体中。

默认来源如下：

- `item_key`
  - 从 `work item` 派生
- `item_type`
  - 从交付漏斗与当前执行入口派生
- `phase` / `fr` / `release` / `sprint`
  - 从 host-backed profile、repo companion 或等价治理承接面派生
- `head_sha`
  - 从 git / host control plane 派生
- `status`
  - 从 `spec review`、formal review、checkpoint 与 closeout 结果派生
- `gate_chain`
  - 从 spec review、review record、merge checkpoint 与宿主控制面派生

## 5. repo-local 与 host-backed 对齐

repo-local 与 host-backed 两条路径都必须收敛到同一语义：

- repo-local 可以没有 GitHub `Phase / FR`
- host-backed 可以没有 repo-local `.loom/` carrier

但两者都必须回答：

- 当前事项是什么
- 它处在漏斗哪一段
- 当前 `head_sha` 是什么
- 当前是否已达到 `spec_approved` / `merge_ready`
- 当前 gate chain 走到哪里

## 6. 边界约束

- `item context` 是读取合同，不是新的 authored 工件
- 它不得复制 `next_step`、`blockers`、`latest_validation_summary`
- 它不得替代 `work item`、`recovery entry`、`review record`
- 它必须能被 `status control plane` 和 GitHub host 读面同时消费
