# Loom Init Input Signals

`loom-init` 继续使用现有初始化问诊信号作为 root 入参合同。

稳定输入信号见：

- [intake-signals.md](./intake-signals.md)

当任务不是初始化，而是执行中的日常动作时，还必须结合：

- [../../route-matrix.md](../.loom-runtime/route-matrix.md)

root skill 只在两种情况下继续留在 `loom-init`：

- 任务明确是初始化 / retrofit
- 任务信号不足，无法稳定路由到单一场景 skill
