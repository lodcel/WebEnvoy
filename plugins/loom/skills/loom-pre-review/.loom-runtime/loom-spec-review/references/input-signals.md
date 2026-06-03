# Loom Spec Review Input Signals

当任务满足以下任一信号时，进入 `loom-spec-review`：

- spec review
- formal spec review
- 确认 spec 是否通过
- 审查 formal spec 路径

最小输入：

- 目标仓库
- 当前事项编号，或允许从事实链定位活跃事项
- formal spec 路径或明确的 spec review 意图
- suite path decision：full path 的必需工件 locator，或 minimal path 的
  `not_applicable` rationale、consumer boundary、recheck condition
