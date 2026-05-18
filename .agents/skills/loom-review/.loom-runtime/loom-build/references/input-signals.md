# Loom Build Input Signals

当任务满足以下任一信号时，进入 `loom-build`：

- 实现当前 Work Item
- 执行 build / implementation round
- 使用 subagent-driven execution mode
- 集成 subagent 输出
- 检查 unintegrated subagent output
- 检查 repeated blocker signal

最小输入：

- 目标仓库
- 当前事项编号，或允许从事实链定位活跃事项
- Work Item、spec、plan、recovery baseline、validation baseline、workspace 和 ownership constraints
- 若使用 subagent-driven mode，必须提供 delegation/build evidence locator
