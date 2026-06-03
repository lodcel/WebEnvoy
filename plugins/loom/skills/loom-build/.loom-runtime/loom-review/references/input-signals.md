# Loom Review Input Signals

当任务满足以下任一信号时，进入 `loom-review`：

- 正式 review
- 语义审查
- 输出审查结论
- 输出 findings 和风险等级
- pre-review 通过后进入审查执行

最小输入：

- 目标仓库
- 当前事项编号，或允许从事实链定位活跃事项
- review 意图与关注面（例如正确性、回归风险、合同一致性）
