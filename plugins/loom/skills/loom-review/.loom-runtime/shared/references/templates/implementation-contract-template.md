# Implementation Contract Template

本文件定义 Loom 当前最小实现承诺模板。

它服务 `implementation PR`，不替代 formal spec。

## 1. 最小结构

### Work Item

- 当前实现承接的是哪个 `Work Item`
- 当前执行入口是什么

### Approved Spec

- 当前实现消费哪份已批准 spec
- 当前 `spec review` 的结论入口是什么

### Implementation Scope

- 本次实现明确覆盖什么
- 本次实现明确不覆盖什么

### Validation Plan

- 准备如何验证
- 哪些自动检查或手动验证必须通过

### Risks And Rollback

- 当前已知风险
- 回滚边界和回退条件

### Host Binding

- 当前实现绑定哪个 PR / host object
- 当前 `head_sha` 与 review / merge-ready 如何关联

## 2. 分工边界

- formal spec 负责冻结目标、范围和边界
- implementation contract 负责声明当前实现承诺
- PR 模板负责表达当前变更摘要
- review record 负责表达 reviewer 结论

它们不得混写成同一份“什么都写一点”的文件。
