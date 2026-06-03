# Issue Model

本文件定义 Loom `v0.3.0` 当前稳定的执行型 issue 模型。

本文件当前承接：

- `#175`

## 1. 文档定位

本文件只回答四件事：

- Loom 当前如何区分不同类型的 issue
- 哪些 issue 可以进入宿主执行控制面
- parent / child issue 在 closeout 中各自承担什么角色
- `absorbed` 这类结论如何被消费

事项成熟度状态由 [state-machine.md](./state-machine.md) 承接。
成熟度与关闭总原则由 [maturity-and-closing.md](./maturity-and-closing.md) 承接。
宿主对象命名由 [host-object-taxonomy.md](./host-object-taxonomy.md) 承接。
host issue 与 `Work Item`、host branch、`git worktree`、PR、merge commit 的绑定证明见 [../harness/host-issue-binding.md](../harness/host-issue-binding.md)。

## 2. 稳定 issue 类型

Loom 当前固定三类 issue：

- `spec / planning issue`
  - 用于冻结目标、范围、方案、拆分或阶段判断
  - 不是默认执行对象
- `execution-bound issue`
  - 用于承接当前真实实施缺口的宿主 issue
  - 它可以映射到当前 `Work Item`，但不是 Loom 的执行主入口
- `validation / closeout issue`
  - 用于承接验证、对账、收口或主干真相同步
  - 只在实现主体已基本完成、但仍存在独立收口工作时使用

这三类是 Loom 对 issue 的稳定语义分类，不要求宿主平台直接提供同名字段。

## 3. parent / child 语义

在 issue tree 中：

- parent issue
  - 默认是范围、阶段或收口容器
  - 不默认等于当前 `Work Item`
- child issue
  - 默认承接可独立推进的真实执行缺口
  - 是否激活取决于是否已经进入当前轮次实施

稳定约束：

- 不得把历史规划 parent 长期冒充当前 `Work Item` 对应的宿主 issue
- 不得把尚未进入实施的 child issue 提前写成进行中
- 当 parent 只承担汇总与收口时，应让真正实施落在 child issue

### 3.1 deferred roadmap issue

`deferred roadmap issue` 是 GitHub truth 中的路线图保留语义。

当 issue 以 `closed + deferred-roadmap` 出现在 roadmap tree 中时，它表示 roadmap reservation，不是 `closed_out`，也不是 completed delivery。

稳定约束：

- open Phase 可以持有 closed deferred FR / Work Item children
- deferred child 在激活前不得被 closeout 或 completed delivery 消费
- deferred child 不要求 PR、merge commit、review 或 closeout basis
- 激活必须显式转换：reopen / reactivate，或重新绑定为 active execution issue
- duplicate/retry artifacts 必须指向 canonical issue，不能进入 Roadmap Inventory

deferred roadmap 只允许表达未来范围已进入 host truth。它不得把未激活的 child issue 伪装成已经完成的执行结果。

检查输出应区分 `deferred_roadmap` 与 `completed_delivery`，避免把路线图保留语义消费成完成交付语义。

## 4. 激活规则

### 4.1 issue 级激活

issue 级激活表示：

- 该 issue 已被选为当前轮次要推进的宿主控制面对象
- 它应在宿主控制面上体现为进行中或等价语义
- 后续证据、PR、review 或 closeout 应围绕该 issue 建立一致关系

issue 未被激活时，可以继续存在于 tree 中，但默认保持 `Todo` 或等价未开始语义。

### 4.2 `work-item --activate`

`work-item --activate` 表示：

- Loom 执行现场把某个 `Work Item` 切换为当前 locator truth
- 当前轮次恢复、停点与执行入口开始指向该 `Work Item`

它不等于：

- 自动激活对应 issue
- 自动改变宿主 project / issue 状态
- 自动宣称事项成熟度已进入下一阶段

换句话说：

- issue 级激活是宿主控制面语义
- `work-item --activate` 是 Loom 唯一执行入口语义

两者通常相关，但必须明确区分，不得互相偷换。

## 5. 关闭与收口角色

issue closeout 仍以 [state-machine.md](./state-machine.md) 的 `closed_out` 为前提。

在 issue tree 中：

- child issue
  - 关闭取决于该 child 自身缺口是否已进入主干并完成收口
- parent issue
  - 关闭取决于其应消费的 child closeout 是否已经完成，且 parent 自身不再保留真实剩余缺口

因此：

- parent 可以作为收口容器消费多个 child 的 closeout 结果
- child 不应因为 parent 仍 open 就被阻止关闭
- parent 也不应因为某个 child 曾经被规划过就长期保持失真 open

## 6. `absorbed` 的边界

`absorbed` 不是成熟度状态。

它只表示：

- 某个原始 issue 所代表的缺口，已被其他已收敛的执行结果覆盖或吸收

Loom 当前只稳定约束两点：

- `absorbed` 可以被 parent closeout 消费
- `absorbed` 也可以被 child issue closeout 消费

本文件不定义：

- `absorbed` 需要哪些 host 证明细节
- 由哪一类宿主证据组合才能判定 `absorbed`

这些证明细节属于具体仓库 closeout 实践，不属于 Loom 当前治理合同。

## 7. 一句话结论

Loom 的 issue 模型目标不是把所有 issue 都变成执行入口，而是稳定区分规划、执行、验证/收口三类语义，并让宿主 issue 与 `Work Item` 各守边界。
