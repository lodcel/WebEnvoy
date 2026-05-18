# Review Model

本文件定义 Loom 治理内核中的稳定审查模型。

这些规则来自当前已标记为 `core` 的提取条目：

- `EXT-0004`
- `EXT-0014`
- `EXT-0018`

## 1. 文档定位

`governance/review-model.md` 负责回答三件事：

- 谁在什么时点做什么判断
- gate chain 如何分工
- 审查输入最小基线如何确定

事项路径和规格准入见 [principles.md](./principles.md)。
成熟度与关闭语义见 [maturity-and-closing.md](./maturity-and-closing.md)。

## 2. 审查职责分层

Loom 默认把审查职责分成四类角色：

- 作者
  - 正确选择事项路径，补齐所需工件，说明验证与风险
- reviewer
  - 判断方向、边界与实现是否满足当前路径要求
- 自动检查
  - 承担结构完整性、工件存在性、基础一致性与明显越界信号检查
- merge gate
  - 只做主干放行判断，不补做前序阶段语义审查

禁止事项：

- 用 CI 替代语义审查
- 用 merge gate 替代事项方向判断
- 让 reviewer 补做作者应完成的准入澄清

## 3. gate chain 的审查分工

强治理控制面下，正式判断链固定为：

- `spec gate`
- `build gate`
- `review gate`
- `merge gate`

其中 `spec gate` 只在命中 formal spec 路径时出现；其余三层是正式实现链的稳定部分。

### 3.1 `spec gate`

回答：

- formal spec 是否足够清楚并允许进入实现承诺
- 共享边界、风险与回滚边界是否已被 reviewer 接受

默认主责：作者 + spec reviewer。

### 3.2 Admission checkpoint

回答：

- 事项路径是否正确
- 是否触发规格准入
- 是否具备进入实现的条件

默认主责：作者 + reviewer。

### 3.3 Build checkpoint

回答：

- 当前实现是否仍在已确认轨道上
- 是否出现新的边界变化或风险升级
- 是否需要回退到说明层重新收口

默认主责：作者 + reviewer；自动检查提供结构和越界信号。

### 3.4 Review gate

回答：

- 当前 implementation review 是否已经形成单一 review record
- 当前 review 结论是否仍绑定当前 `head_sha` 与验证摘要

默认主责：reviewer；自动检查负责 stale / 结构完整性信号。

### 3.5 Merge checkpoint

回答：

- 当前 head 是否达到进入主干的质量线
- 已承诺范围是否已完成并可验证
- GitHub controlled merge 的前置是否已齐全

默认主责：reviewer + merge gate；不承担第一次语义理解。

## 4. 最小必要上下文

审查输入默认采用最小必要上下文，不做整仓材料默认广播。

最小上下文建议：

- Admission checkpoint
  - 事项目标、边界、路径判定依据、所需准入工件
- Build checkpoint
  - 当前变更、阶段结论、风险变化、必要验证证据
- Review gate
  - `flow review` 输出、单一 review record、`head_sha` 与验证摘要绑定
- 正式 review
  - `flow review` 输出、review record、必要 findings 与 reviewer 结论
- Merge checkpoint
  - 最终变更集、验证结论、风险与回滚信息、未完成事项

## 5. 审查基线来源

审查必须有基线。默认读取顺序：

1. Issue 的目标与边界
2. 规格文档或简化设计说明
3. 当前变更与验证事实

只有当前证据不足时，才补充更长历史材料。

## 6. 回退规则

Build checkpoint 发现以下情形时，默认回退到说明层：

- 新的共享契约变化
- 运行模型或部署方式变化
- 核心边界扩大且当前工件无法覆盖

回退后应先更新准入工件，再继续实现。

## 7. 一句话结论

审查模型的目标是把高价值判断前移并分层，而不是把所有判断挤在 merge 前。
