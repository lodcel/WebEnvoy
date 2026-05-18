# Automation Frontload

本文件定义 Loom 当前最小自动化前置规则。

本文件当前承接：

- `EXT-0009`
- `EXT-0036`
- `EXT-0041` 的 Loom 内核消费边界

## 1. 能力定位

能稳定机械判断的规则，应尽量前置到脚本、CI 或等价自动化入口。

自动化前置负责降低重复人工判断，不负责替代语义审查。
merge checkpoint 只消费这些结果，不把它们扩写成第一次高质量判断。

## 2. 通用 core 检查矩阵

| 检查类别 | 检查对象 | 失败含义 | 非目标 | 是否阻断 merge checkpoint |
| --- | --- | --- | --- | --- |
| 结构完整性 | 目录、命名、必备分区是否落位 | 当前仓库结构不满足 Loom 最小执行前提 | 不判断结构是否最优 | 是 |
| 规则落点 | 关键规则是否存在唯一主落点 | 读者无法定位规则真相，或出现重复承接 | 不判断规则内容是否已经最优 | 是 |
| 模板存在性 | 正式模板与必要字段是否存在 | 正式事项缺少承载结构，后续无法稳定消费 | 不判断模板示例是否覆盖全部业务场景 | 是 |
| 交叉引用 | 关键文档与入口链接是否可达 | 执行链路在仓库中断裂，读取路径不可达 | 不判断引用后的内容质量 | 是 |
| 纯度/越界信号 | 明显脏现场、无关改动、范围越界信号 | 当前执行材料不适合继续叠加或放行 | 不替代 reviewer 的语义审查 | 视严重度而定 |
| 执行支撑入口存在性 | work item、恢复入口、验证入口、运行入口等是否可定位 | 仓库无法形成最小执行闭环 | 不判断入口实现强度是否已达最佳 | 是 |
| checkpoint 入口存在性 | `admission`、`build`、`merge` 三类 checkpoint 入口是否可调用 | 放行链路不完整，无法按阶段消费事实链 | 不替代 checkpoint 的语义审查 | 是 |
| 运行时证据可读性 | `Runtime Evidence` 五字段是否可读且可区分 `not_applicable` | 验证摘要不可复核，merge 消费不到稳定证据 | 不判断证据内容是否已经最优 | 是 |
| 运行态识别 | 当前入口是否能稳定区分 `repo-local-demo`、`installed-runtime`、`upgrade-rehearsal` | 安装态 / 升级态被伪装成“入口存在且可运行” | 不替代宿主自己的安装实现 | 是 |
| workspace lifecycle 入口存在性 | `create`、`locate`、`cleanup`、`retire` 与 `purity-check` 是否可调用 | 现场治理不可机械执行，恢复与交接风险升高 | 不替代现场治理策略设计 | 是 |
| 基础状态一致性 | checkpoint、下一步、阻断项、验证摘要是否相互对齐 | 当前状态不可读，恢复与放行会消费到冲突事实 | 不判断事项目标本身是否值得做 | 是 |
| 事实链唯一性 | 静态真相、动态真相与派生读面是否各守边界 | 仓库出现并行记账或事实链断裂 | 不替代 reviewer 的方案判断 | 是 |

这里的“执行支撑”包括初始化入口、恢复入口、验证入口、运行入口、checkpoint 入口以及 workspace lifecycle 入口等被正式规则要求的机械支撑。

## 2.1 失败分类与阻断语义

为避免“失败但不可读”，前置检查至少要归类为以下失败类型：

| 失败分类 | 典型触发 | 默认阻断语义 | 回退去向 |
| --- | --- | --- | --- |
| `fact_chain_broken` | 主真相载体缺失、断链、并行记账 | 阻断 | 回到事实链修复 |
| `active_state_conflict` | 当前事项与恢复入口冲突、多活跃事项共享现场 | 阻断 | 回到恢复入口/现场治理 |
| `checkpoint_gap` | checkpoint 入口缺失、阶段输入缺失、结果语义异常 | 阻断 | 回到 admission/build 补齐 |
| `scope_overflow` | 变更明显超出当前事项范围或单目标边界 | 阻断 | 回到范围收敛与分流 |
| `runtime_evidence_gap` | 运行时证据字段缺失或 `present/not_applicable` 冲突 | 阻断 | 回到验证入口补证据 |
| `workspace_residue` | Loom-owned 残留未清理、无关改动未分流 | 视严重度阻断 | 回到 cleanup/purity-check |

非目标保持不变：

- 不把 reviewer 的方案判断改写成脚本硬编码结论
- 不把宿主特定流程细节上移为 Loom 默认前置

## 3. `skills` 触发与行为回归的稳定边界

`skills` 入口层的触发正确性与行为退化，已经在 `EXT-0041` 下进入 Loom 的稳定 core 边界，但仍不与通用 core 结构检查混写。

| 检查面 | 最小目标 | 不进入 Loom 内核的内容 |
| --- | --- | --- |
| 显式触发 | 指定 skill 时能命中正确入口或 adapter | 宿主 CI 中的完整端到端脚本矩阵 |
| 隐式触发 | 典型场景能路由到正确入口层能力 | 宿主特定 prompt 路由细节 |
| 行为退化 | 入口层输出仍满足声明的最小职责 | 下游仓库的完整业务回归用例 |
| adapter 失败可见性 | 失败时能暴露可读取错误入口 | 宿主内部监控产品或告警平台 |

Loom 内核现在固定承认这些检查面的最小合同与 fail-closed 语义，但仍不内置宿主特定 CI、测试框架或 adapter 实现。

## 3.1 当前仓库中的最小执行入口

Loom 仓库当前通过以下入口承接最小 core 前置检查：

- `make loom-check`
- `python3 shared/scripts/loom_check.py`
- `python3 loom-init/scripts/loom-init.py verify --target <repo>`
- `python3 loom-init/scripts/loom-init.py runtime-state --target <repo>`
- `python3 loom-init/scripts/loom-init.py fact-chain --target <repo>`
- `python3 shared/scripts/loom_flow.py fact-chain --target <repo> [--item <id>]`
- `python3 shared/scripts/loom_flow.py runtime-state --target <repo> [--item <id>]`
- `python3 shared/scripts/loom_flow.py runtime-evidence --target <repo> [--item <id>]`
- `python3 shared/scripts/loom_flow.py state-check --target <repo> [--item <id>]`
- `python3 loom-pre-review/scripts/loom-pre-review.py flow pre-review --target <repo> [--item <id>]`
- `python3 shared/scripts/loom_flow.py checkpoint <admission|build|merge> --target <repo> [--item <id>]`
- `python3 shared/scripts/loom_flow.py workspace <create|locate|cleanup|retire> --target <repo> --item <id>`
- `python3 loom-retire/scripts/loom-retire.py purity-check --target <repo> [--item <id>]`

当前脚本至少覆盖：

- 结构完整性
- 规则与核心落点存在性
- 模板与入口资产存在性
- Markdown 交叉引用可解析
- `skills` 机读 root 合同的最小一致性
- `skills` 升级协议与 bootstrap CLI 入口的一致性
- demo 事实链 carrier 的唯一性与一致性
- checkpoint 入口存在性与最小结果语义
- 活跃状态冲突与 checkpoint 缺口暴露
- 范围越界与 workspace residue 的 purity 预检
- 运行时证据五字段可读性与 `not_applicable` 判定
- workspace lifecycle / purity-check 入口存在性

GitHub Actions 工作流会复用同一入口，而不是维护第二套命令。

对于控制面 drift，自动化前置必须显式暴露同范围 `reconciliation audit` 结果，不能把 `warn` / `fix-needed` / `block` 静默吞掉后继续走 closeout。
closeout 需要控制面对齐时，顺序必须是先处理 `fix-needed` / `block` drift，再继续 closeout；`warn` 必须保留在输出中，但不默认升级为阻断。

对于 Loom 自身仓库，默认 gate 不应退化成单一 job 的自证通过路径。
最小执行面至少应把以下检查拆成可单独读取的失败面：

- 入口脚本可编译
- demo bootstrap 可重建
- repo-local demo CLI 可真实执行
- `loom_check` 仓库自检可通过

最小接入 demo 则通过以下入口复验：

- `make loom-demo-new-project`

## 4. 不应错误前置的判断

以下判断不应被伪装成全自动结论：

- 目标是否值得做
- 方案是否正确
- 风险是否真正收口
- 当前实现是否解决了正确问题

## 5. 边界约束

Loom 的自动化前置必须区分两类事情：

- 机械判断交给机器
- 语义判断保留给人、reviewer 或其他正式治理角色

不允许：

- 把可自动判断事项长期留给人工重复执行
- 把需要语义判断的事项伪装成硬编码脚本结果
- 把宿主特定的完整回归矩阵误当成 Loom 默认 core 检查面
- 允许 `work item`、恢复入口、状态面并行 authored 同一事实
