# Spec Template

本文件定义 Loom 当前最小 `spec` 模板结构。

`spec` 负责冻结“做什么、边界在哪、怎样算满足”，不负责承接实现进度。

## 1. 最小结构

### Goal

- 这项能力为什么存在
- 它要解决的核心问题是什么

### Scope

- 明确包含什么
- 明确不包含什么

### Key Scenarios

- 关键场景
- 优先使用 `GWT` 或等价结构表达

### Exceptions And Boundaries

- 异常情况
- 边界条件
- 明确不支持的路径

### Acceptance Criteria

- 什么结果算通过
- 哪些验证必须成立

## 2. 不应混入的内容

以下内容不应成为 `spec` 主体：

- 执行中的停点
- 下一步
- blocker 记账
- reviewer finding 列表
- PR 级变更摘要

这些内容分别属于 recovery、review record 或 PR 模板。
