# Routing And Checkpoints

本文件定义 Loom 当前的事项分流与 checkpoint 策略。

本文件当前承接：

- `EXT-0007`
- `EXT-0024`
- `EXT-0019`
- `EXT-0022`

## 1. 事项分流

Loom 当前默认把事项分成三条入口：

- 轻量事项
  - 不改变正式契约、上位边界或高风险链路
- 中等事项
  - 需要冻结目标、范围、验证与回滚，但不一定进入完整正式规约
- 正式规约事项
  - 涉及共享边界、共享契约、共享数据模型、高风险链路或核心实现承诺

## 2. 当前默认路径

- 轻量事项
  - 直接进入实现 PR
- 中等事项
  - 先形成简化设计说明，再进入实现
- 正式规约事项
  - 先完成实现前审查，再进入实现

## 3. 不应过早固化分层体系

Loom 当前保留分流思想，但不先把它固化为 profile 体系。

原因是：

- 事项分类必须服务执行
- 不应反过来要求用户先理解复杂分类学
- 初始化 `SKILL` 应负责把用户场景映射到合适入口

## 4. checkpoint 策略

Loom 当前至少应支持三类正式判断点：

- `admission checkpoint`
  - 判断事项是否具备进入实现承诺的条件
- `build checkpoint`
  - 判断当前实现是否仍在已批准轨道上
- `merge checkpoint`
  - 判断当前 head 是否满足进入主干的条件

其中：

- 本文保留三类 checkpoint 的治理与采用语义
- 执行侧的最小承接链路见 [../harness/execution-chain.md](../harness/execution-chain.md)
- `merge checkpoint` 的执行侧输入、结果与回退去向见 [../harness/merge-checkpoint.md](../harness/merge-checkpoint.md)

`admission checkpoint` 在 adoption 语义上表达“进入实现承诺前的正式判断”。
治理内核中的稳定命名与审查分工，见 [../governance/review-model.md](../governance/review-model.md)。

## 5. Loom 当前约束

- 不允许只有 `merge checkpoint` 足够强，而前两者长期虚化
- 不允许 merge 前 review 承担第一次高质量语义判断
- 不允许中等事项长期在“轻量事项”和“正式规约事项”之间无明确入口
- 不允许把三类 checkpoint 的执行侧输入、回写和放行规则继续留给读者自行拼装

## 6. 与 `skills/` 的关系

这些分流和 checkpoint 规则，最终应由初始化 `SKILL` 转化成实际提问、决策与装配逻辑。

agent-assisted adoption 的固定提问字段、source locator、write target 与 verify closure 由 [zero-friction-adoption-contract.md](./zero-friction-adoption-contract.md) 承接；本文不展开执行侧回写或放行细节。

## 7. 与 `harness/` 的关系

`adoption/` 只保留：

- 为什么需要三类 checkpoint
- 哪类事项默认进入哪条路径
- checkpoint 之间的治理不变量

以下执行侧细节不再由本文展开：

- 初始化产物如何进入正式执行
- 每轮开始前必须读取哪些事实
- 每轮结束后必须回写哪些事实
- merge checkpoint 放行前必须可读取哪些验证与状态事实

这些内容统一由 `harness/` 中的稳定合同承接。
