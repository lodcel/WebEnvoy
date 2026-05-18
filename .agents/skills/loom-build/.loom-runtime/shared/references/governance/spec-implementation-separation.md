# Spec And Implementation Separation

本文件定义 Loom 当前 `spec / contract -> spec review -> implementation PR` 的分离规则。

## 1. 目标

当事项命中 formal spec 准入时，Loom 不允许把规格冻结、实现承诺和实现变更混成一个阶段完成。

必须显式区分：

- `spec / contract`
- `spec review`
- `implementation PR`

## 2. 何时必须进入 formal spec

出现以下任一信号时，默认必须先形成正式 `spec / contract`：

- 共享边界变化
- 共享数据模型变化
- 运行模型或部署模型变化
- 高风险链路改动
- 明确需要 reviewer 先判断“做不做 / 怎么做”，而不是直接判断“改得对不对”

## 3. 默认前置关系

默认前置关系固定如下：

1. 先形成正式 `spec / contract`
2. 再进入 `spec review`
3. 只有 `spec review` 通过后，才允许进入 `implementation PR`
4. `implementation PR review` 只审实现是否符合已批准规格，不补做规格准入

## 4. `spec review` 的责任

`spec review` 回答的是：

- 目标是否成立
- 范围是否收敛
- 关键场景与边界是否足够清楚
- 风险和回滚边界是否已声明
- 是否可以进入实现承诺

它不回答最终代码是否已经达到 merge-ready。

## 5. `implementation PR` 的责任

`implementation PR` 回答的是：

- 当前变更是否仍在已批准规格内
- 当前实现是否满足验证承诺
- 是否引入新的边界扩张
- 是否可以进入 formal review 与 merge-ready

## 6. 回退规则

若 `implementation PR` 出现以下情形，必须回退到 `spec review` 或更早层：

- 范围明显扩大
- 新增共享契约变化
- 风险模型变化
- 已批准 spec 已不足以覆盖当前实现

不允许在 PR 里临时补一段说明，伪装成“规格仍然已批准”。

## 7. 非目标

- 不要求所有事项都走 formal spec
- 不要求所有宿主都使用相同文件名
- 不让 `merge-ready` 或最终 reviewer 承担第一次规格判断
