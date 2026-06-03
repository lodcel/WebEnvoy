# Work Item Contract

本文件冻结 Loom 对 `Work Item` 的执行入口合同与 enforcement 纪律。

完整执行顺序见 [execution-chain.md](./execution-chain.md)。
`Work Item` 的 GitHub 默认语义见 [../governance/github-delivery-funnel.md](../governance/github-delivery-funnel.md)。

## 1. 目标

`Work Item` 不只是“当前默认执行入口”，而是 Loom strong governance 下被 enforcement 的唯一默认执行入口。

因此它必须同时解决：

- 谁可以进入正式执行链
- 非法入口如何 fail-closed
- 所有正式 gate 如何回溯到同一事项身份

## 2. 唯一默认执行入口

只有 `Work Item` 可以进入：

- worktree / branch 绑定
- recovery / resume
- implementation review
- `merge-ready`
- `controlled merge`
- `closeout`

以下对象都不是执行入口：

- `Roadmap / Phase`
- `FR`
- User Story
- PR
- merge commit
- release / sprint 索引
- 临时说明文档

这些对象可以提供边界或证据，但不能直接触发正式执行。

## 3. 最小合同

进入正式执行的 `Work Item` 至少必须表达：

- 事项标识
- 目标
- 范围
- 当前执行路径
- 上位 requirement / `FR`
- 上游 User Story locator，若当前事项由 story intake 形成
- Story Business Confirmation locator 或 `not_applicable` rationale，若当前事项由 story intake 形成
- 关联工件
- 工作现场入口
- 恢复主入口
- review 入口
- 验证入口
- 关闭条件

一个 `Work Item` 只承接一个清晰执行目标，不得混装多个无关事项。

## 4. enforcement 规则

### 4.1 允许进入执行的条件

至少同时满足：

- 当前对象已被明确定义为 `Work Item`
- 可读取最小 `item context`
- 能定位恢复主入口或等价动态真相
- host binding 可以回链到同一事项

### 4.2 非法入口

以下都属于非法入口：

- 直接从 `FR` 开始 implementation PR
- 直接从 PR 反推当前事项并进入 resume
- 直接从 merge commit 启动 closeout
- 直接从 release / sprint 索引建立执行现场

### 4.3 fail-closed 结果

非法入口必须返回：

- `gate_failure.missing_prerequisite_gate`
  - 缺合法执行入口
- 或 `gate_failure.binding_failure`
  - 无法证明当前对象属于某个合法 `Work Item`

回退方向只允许指向：

- `Work Item` authoring
- `FR -> Work Item` 拆分
- binding 修复

## 5. formal spec 路径的额外约束

若事项命中 formal spec 路径，还必须满足：

- `FR` 已存在
- formal spec 已绑定到 `FR`
- 若存在 User Story，formal spec 只消费 story locator、Story Business Confirmation locator 与 acceptance scenario 映射；`pending` 或 `revision-requested` 不能进入 formal spec
- 当前 `Work Item` 只通过关联关系消费该 formal spec
- `spec_review` 未通过前不得进入 implementation PR

## 6. 与初始化产物的关系

初始化或 adoption 完成后，最小可用产物应包括：

- 可进入执行的首批 `Work Item`
- 可定位的恢复主入口
- 唯一恢复主入口约定
- 可被 review / merge / closeout 消费的 locator

Loom 不冻结文件名，但要求这些入口从第一轮开始即可被机械读取。

## 7. 事实链约束

- `Work Item` 只承接静态执行真相
- checkpoint、停点、下一步、阻断项属于恢复主入口
- `Work Item` 可以 authored locator，不得 authored review 或 closeout 结论本身
- 统一状态控制面展示的 `item` 字段必须从 `Work Item` 派生

## 8. 非目标

- 不把 `exec-plan` 提升为执行入口本身
- 不让 PR 模板或会话记录代替 `Work Item`
- 不为不同宿主再各自定义一套“谁可以开始执行”的规则
