# Intake Signals

使用本文件组织 `loom-init` 的初始化问诊与场景判断。

## 1. 输入目标

本合同只负责两件事：

- 把目标仓库稳定判到以下三类场景之一：
  - `新项目`
  - `小型既有仓库`
  - `复杂既有仓库`
- 基于场景判断导出默认装配路径，而不是停留在零散提示

本合同服务入口判断，不替代 `governance`、`harness`、`templates` 的规则真相。

## 2. 最小必判字段

初始化前，至少要完成以下字段的判断：

- 仓库类型
  - `新项目`
  - `既有仓库`
- 根级边界文档是否清晰
  - 例如 `AGENTS.md`、同类规则入口或等价边界文档
- 是否已有 CI / 基础测试
- 是否已有统一的仓库级验证入口
- 当前主要缺口属于哪一类：
  - 治理入口 / review 合同 / 条件化 spec-review 路径
  - 恢复 / 状态 / 执行支撑
- 是否有明显长任务恢复痛点
- 是否存在共享契约 / 共享数据模型 / 核心抽象 / 高风险链路
- 是否存在分支混杂、PR 混题、脏现场叠加
- merge 前是否承担第一次高质量语义判断

若以上任一字段未完成判断，不得直接给出初始化路径结论。

## 3. 每项字段的取证来源

默认按以下顺序取证：

1. 目标仓库现状
   - 根级规则文档
   - README、流程文档、模板
   - CI、测试、统一验证入口、PR 习惯、issue / PR 载体
2. Loom 现有规则与 adoption 文档
   - 用于映射信号，不用于替代目标仓库事实
3. 用户补充信息
   - 仅在仓库现状不能稳定推断时再问

取证约束：

- 优先从仓库现状读取
- 缺失时再问用户
- 不允许靠临场经验补脑
- 不能把单次会话中的猜测当成稳定信号

## 4. 场景判定规则

### 4.1 `新项目`

满足以下条件时，判为 `新项目`：

- 仓库尚未形成稳定工程基线
- 当前目标是建立最小起步结构，而不是 retrofit 既有流程

默认装配路径：

- 最小装配
- 不预装重 harness
- 只建立后续可升级入口

### 4.2 `小型既有仓库`

满足以下条件时，判为 `小型既有仓库`：

- 已有清晰根级边界文档
- 已有 CI / 基础测试
- 已有统一的仓库级验证入口
- 当前缺口主要在治理入口、review 合同、条件化 spec-review 路径
- 尚无明显长任务恢复痛点
- 当前没有需要立即进入更重路径的共享边界或高风险核心抽象信号
- 当前主产物本身不是共享 contract、shared skill 或 governance module

默认装配路径：

- 直接采用 [../../shared/references/adoption/lightweight-retrofit-default.md](plugins/loom/skills/loom-init/.loom-runtime/shared/references/adoption/lightweight-retrofit-default.md)
- 默认 `companion docs` 接入
- 默认装配最小治理包、repo companion、bootstrap metadata、review guidance 与 PR 模板
- 默认不装配完整 recovery、`Work Item`、`status control plane`、formal spec suite 与重 harness
- 若需要轻量跨轮承接，默认 `checkpoint-lite`

### 4.3 `复杂既有仓库`

满足以下任一条件时，判为 `复杂既有仓库`：

- 属于既有仓库，但不满足 `小型既有仓库` 的轻量条件
- 无可见 CI / workflow 且无统一验证入口
- 已出现明显长任务恢复痛点
- 已出现共享契约、共享数据模型、运行模型或高风险核心抽象变化
- 仓库主产物本身是共享 contract、shared skill 或 governance module
- 已出现现场混杂、PR 混题、脏现场叠加等明显纯度问题
- merge 前 review 仍在承担第一次高质量语义判断，且已成为结构性瓶颈

默认装配路径：

- 进入更完整装配
- 纳入恢复主入口、执行上下文、`Work Item` 或等价唯一执行入口、`status control plane`、隔离现场与纯度规则
- 对高风险边界事项纳入正式规约套件与前移 checkpoint

若同时满足以下条件，则 `复杂既有仓库` 默认优先走 `deep-existing-repo`：

- 根级边界文档清晰
- 已有统一的仓库级验证入口
- 已出现 `merge_review_semantic_overload`

这条路径的含义是：

- 保留 `repository_mode = complex-existing`
- 保留 root rules、retained host actions 与 repo-native carriers
- 先做 `recognize-and-attach`
- 不在第一轮直接写入 Loom-owned recovery/status carriers

### 4.4 `执行前既有仓库`

满足以下条件时，判为 `pre-execution-existing`：

- 属于既有仓库
- 已有 `AGENTS.md`、`README.md`、`VISION.md`、`docs/**` 等文档事实源
- 尚未形成代码、CI、基础测试或统一验证入口
- 治理载体仍停留在 root docs，尚无稳定 Loom 或 repo-native execution carriers

该分类必须拆开报告：

- 文档事实源成熟度
- 执行面成熟度
- 治理载体成熟度

`pre-execution-existing` 不直接决定生成强度。默认仍走轻量治理接入；只有显式 `adoption_intent = execution-control | strong-governance` 时，才允许进入重执行控制面。

产品或领域文档中的 `CONTRACT_MODEL.md`、`DOMAIN_MODEL.md` 不等同于工程共享 contract、runtime schema 或 shared governance module，不得仅因这些文件名把仓库提升为复杂执行风险。

## 5. 冲突处理规则

当信号之间出现冲突时，按以下规则处理：

- 若同时满足“小型既有仓库已有基线”和“恢复痛点 / 共享边界风险明显”，优先判为 `复杂既有仓库`
- 若缺少统一验证入口，或仓库主产物本身是共享 contract、shared skill 或 governance module，优先判为 `复杂既有仓库`
- 任何共享契约、运行模型或高风险核心抽象变化，优先提升到更重路径
- 任何多轮恢复成本明显升高或出现多个入口并行记录，优先从 `checkpoint-lite` 升级到标准恢复形态
- 只有在缺口主要集中于治理入口、review 合同、条件化 spec-review 路径，且恢复痛点不明显时，才保持轻量路径

## 6. 场景到默认装配映射

- `新项目`
  - 最小装配
  - 重点是建立后续可升级入口
- `小型既有仓库`
  - 轻量 retrofit 默认策略
  - 重点是最小治理闭环与 `companion docs` 接入
- `复杂既有仓库`
  - 更完整装配
  - 重点是恢复、执行支撑、状态读取与高风险事项准入
  - 若同时满足“根规则清晰 + 统一验证入口 + `merge_review_semantic_overload`”，默认优先走 `deep-existing-repo`

## 7. `lightweight retrofit default` 的消费关系

`loom-init` 对小型既有仓库的默认入口不是临场经验，而是直接消费 [../../shared/references/adoption/lightweight-retrofit-default.md](plugins/loom/skills/loom-init/.loom-runtime/shared/references/adoption/lightweight-retrofit-default.md)。

这意味着：

- `companion docs` 接入是默认动作，不是可有可无的建议
- 默认装配项、默认不装配项、`checkpoint-lite` 都必须进入入口层判断逻辑
- 若判断结果偏离该默认策略，必须显式写出偏离原因与升级信号
