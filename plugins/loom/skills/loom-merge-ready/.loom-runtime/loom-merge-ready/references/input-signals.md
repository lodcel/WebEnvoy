# Loom Merge Ready Input Signals

当任务满足以下任一信号时，进入 `loom-merge-ready`：

- merge-ready
- 最终放行前预检
- 确认当前事项是否可合并
- 确认 `GitHub controlled merge` 前置是否齐全

最小输入：

- 目标仓库
- 当前事项编号，或允许从事实链定位活跃事项
- suite path decision：full path 的 reviewed suite/evidence/consistency locators，或
  minimal path 的 `not_applicable` rationale、consumer boundary、recheck condition
- PR locator、head SHA、reviewed head 与 validation freshness 证据
