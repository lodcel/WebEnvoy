# Workspace And Purity

本文件定义 Loom 当前最小纯度与范围控制规则。

本文件当前承接：

- `EXT-0029`

## 1. 能力定位

纯度与范围控制用于约束正式执行现场、分支和 PR 不发生职责漂移。

它服务的是执行边界，不替代需求分流或方案判断。

## 2. 最小纯度目标

Loom 当前至少要求以下纯度：

- 分支目标纯度
  - 一个正式分支服务一个主要事项
- PR 范围纯度
  - 一个 PR 只承载同一语义目标下的改动
- 工作现场职责纯度
  - 当前现场不混入无关事项的执行残留

## 3. 范围控制边界

以下情况视为范围越界信号：

- 为完成当前事项，顺手推进无关目标
- 在同一分支或 PR 中并入另一事项的正式改动
- 为规避拆分成本，把多个目标包装成一个执行单元

纯度机制只判断是否越界，不直接判断新增目标本身是否合理。
新增目标是否成立，应回到 work item 或治理分流处理。

## 4. 默认处理

发现纯度异常时，默认动作应是：

- 停止继续叠加改动
- 先拆分、清理或重新分流
- 再进入后续审查或提交流程

## 5. 与自动化前置的关系

纯度和明显范围越界信号应尽量前置暴露。
但是否需要新建事项、拆分 PR 或调整目标，仍属于执行与治理决策，不由纯度脚本单独裁决。

## 6. `purity-check` 最小输出语义

`python3 loom-retire/scripts/loom-retire.py purity-check --target <repo> [--item <id>]` 的输出至少包含：

- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定
  - install layout / shared runtime / shared references 漂移时必须直接 `block`

- `hard_failures`
  - 第一版硬失败项，包含事实链断裂、现场冲突、残留未分流、明显多事项共享现场等
- `report_only`
  - 第一版只报告不阻断项，当前包含 branch purity 与 PR purity
- `scope_assessment`
  - `mode: constrained | unconstrained`
  - `declared_paths`
  - `out_of_scope_changes`

当 `scope_assessment.mode` 为 `constrained` 且出现 `out_of_scope_changes` 时，应视为范围越界阻断信号。

`python3 shared/scripts/loom_flow.py state-check --target <repo> [--item <id>]` 会复用同一纯度结果，并额外检查活跃状态与 checkpoint 完整性。

`python3 shared/scripts/loom_flow.py workspace cleanup|retire --target <repo> [--item <id>]` 同样必须先消费 `runtime-state`；若当前 carrier 不再可执行，不得继续清理或退休现场。

branch / PR purity 的宿主生命周期边界见 [host-lifecycle-boundary.md](./host-lifecycle-boundary.md)。
