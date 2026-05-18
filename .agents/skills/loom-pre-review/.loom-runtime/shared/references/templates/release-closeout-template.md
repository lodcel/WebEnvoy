# Release Closeout Template

本文件定义目标仓库 `release / version` closeout 的最小模板结构。

它服务 release closeout evidence，不替代 `Work Item`、review record、merge checkpoint 或 closeout gate。

## 1. 最小结构

### Release Summary

- 当前 target release 是什么
- release goal 是什么
- target branch 是什么

### Included Work

- 纳入了哪些 `Phase`
- 纳入了哪些 `FR`
- 纳入了哪些 `Work Item`
- 哪些项仍未 merged / unreleased / unreconciled

### Release Evidence

- changelog locator
- release notes locator
- migration notes locator
- tag / artifact evidence locator

### Rollback Basis

- rollback basis locator
- rollback boundary
- 何时应回退或暂停 release closeout

### Verification Evidence

- 当前 release closeout 依赖哪些验证证据
- 这些证据如何回链到 merge commit / target branch

## 2. 边界规则

- 该模板只承接 release closeout evidence，不承接运行态
- 该模板不 author review verdict、merge verdict 或 closeout result
- 若仓库不要求其中某类 evidence，必须显式写 `not_applicable` 与理由
- target release 模板可以引用 `Phase` / `FR` / `Work Item` / `PR` / `merge commit`，但不能替代它们各自的权威载体
