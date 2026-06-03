# Skills Distribution And Adapter Contract

## 定位

本文定义 Loom Phase #496 之后在 `skills/` 层的最小分发与适配合同。

它回答的不是某个宿主如何实现交互，而是 Loom 对外发布时，以下四层 repo-local 交付面在 `skills` 维度上如何成立：

- `repo-local plugin`
- repo-local `loom CLI`
- `scenario skills`
- `single-skill standard-skill packages`

本文默认前提：

- `SKILLS` 是入口层，不是事实真相源
- `src/skills/` 是可编辑 skills 源真相
- 根 `skills/` 是由 `src/skills/` 生成、提交到仓库、供宿主直接发现的安装表面
- 治理规则、执行机制、模板约束在安装态由 full-repo `skills/shared/references/` 或 single-skill package-local `.loom-runtime/` 暴露稳定读面；repo-local 源码真相维护在 `Loom source methodology docs/` 与 `Loom source adoption docs/`
- 默认分发模型是完整仓库安装加宿主原生或 adapter skill discovery
- Codex、Claude Code、OpenCode、Gemini、Cursor 的一致体验定义见 `plugins/loom/skills/shared/references/adoption/host-adapter-matrix.md`
- 宿主可以不同，但 Loom 对入口层的最小能力边界应保持稳定
- 当前版本判断是 `major but still pre-1`

## 读者边界

Loom 当前把 `skills` 公开面分成三层：

- 用户首层公开面
  - 根 `README.md` 的完整仓库安装、宿主发现与快速开始
  - `skills/README.md` 的入口层总览
  - `skills/loom-init/SKILL.md` 的 root entry 首屏
- 单 skill 正式交付面
  - `single-skill standard-skill package` 的命名对象、边界与最小运行切片
- 宿主 / adapter 首层公开面
  - 本文
  - `@mc-and-his-agents/loom-installer`
  - `registry.json`
  - `install-layout.json`
  - `upgrade-contract.json`
  - `shared/scripts/assets/references`

换句话说：

- 用户先回答“完整 Loom 怎么开始用”
- 单 skill 消费方再回答“某个标准 skill 如何单独正式交付”
- 宿主 / adapter 最后回答“怎么发现、安装、升级、识别运行态并暴露失败”

本文属于第三层，也会明确第二层的最小边界。

## 一、四层交付面在 `skills` 维度上的分工

### 1. `repo-local plugin`

- adapter-managed 安装对象，不是 Codex 默认安装对象
- 负责把 `loom-init` 与其余 scenario skills 暴露给宿主
- 对用户承诺完整 Loom 的入口面，而不是单个 skill 的局部能力

### 2. repo-local `loom CLI`

- 次级执行面
- 负责统一 `loom ...` 的自动化、验证、调试与宿主编排语义
- 给 plugin 安装物和单 skill package 提供共同执行语义
- 不升格成用户第一入口，也不取代 root / scene contract

### 3. `scenario skills`

- 用户执行面
- 回答“当前该进入哪个动作”
- 保持 `loom-init` 的唯一 root entry 身份与 8 个 scenario skills 的稳定分工

### 4. `single-skill standard-skill packages`

- 单 skill 的正式交付物
- 每个 package 只承接一个标准 skill 的场景合同、最小 launcher / shim 与所需私有 runtime / resources
- 不承诺整包 Loom 默认能力
- 不伪装成 repo-local `loom` plugin 的完整安装成功

## 二、公开接口

Loom 当前对 `skills` 的稳定公开接口分成三组。

### 用户公开面

- `loom-init` 作为唯一 root entry 的入口身份
- 显式进入某个 scenario skill，或在未显式指定时由 `loom-init` 做场景路由
- 8 个 scenario skills 的稳定分工

### 单 skill package 公开面

- 单个标准 skill 的稳定标识
- 该 skill 的最小输入 / 输出合同
- 该 skill 需要的 launcher / shim 与私有 runtime / resources
- 该 package 明确不承诺的范围

### 宿主 / adapter 公开面

- `bootstrap/root contract` 的最小职责
- npm / `npx` installer surface
- 安装合同
- 发现合同
- 运行态识别合同
- 升级合同
- adapter 职责边界
- 版本识别与失败可见性

宿主可以用不同机制实现第三组接口，但不应改写它们的语义，也不应把第二组接口误写成“完整 Loom 安装”。

## 三、分发对象

根 `skills/` 的分发对象，是可被宿主装配和调用的生成后入口合同，而不是可编辑源真相，也不是一整套宿主产品体验。

对 Loom 而言，`skills/` 至少承担以下发布面：

- `bootstrap/root contract`
  - 提供进入 Loom 的最小入口，定义初始化时必须识别的输入、必须给出的判断、以及必须产出的后续落点
- scenario skills
  - 初始化、执行、审查、交接、退出、merge-ready 等场景入口层能力
- single-skill package contract
  - 明确单个标准 skill 如何单独交付、携带哪些最小资源、不能伪装哪些默认能力
- 引用关系
  - 明确每个入口依赖哪些 Loom 内核能力，而不是把规则复制进 skill 文本
- 版本化升级面
  - 允许宿主识别当前入口合同版本，并决定是否需要刷新本地安装物
- 运行态识别面
  - 允许宿主区分 `repo-local-demo`、`installed-runtime`、`upgrade-rehearsal`，并在当前入口不可运行时暴露 fail-closed 原因
- shared runtime / resources
  - 允许宿主直接安装 skill-local `scripts/` 与 package-local `.loom-runtime/`，而不是把 repo-local `tools/` 当成入口成功

因此，`skills/` 的“发布”不等于发布一批提示词文件；它发布的是可被宿主发现、安装、升级和调用的入口合同集合。

生成关系固定如下：

- `src/skills/` 承接可编辑 source truth
- 根 `skills/` 承接已提交 generated install surface
- `skills/<skill-id>` 同时承接 host discovery package 与 self-contained single-skill package
- `skills/<skill-id>/.loom-runtime/` 承接该 package 的最小运行闭包
- `skills/<skill-id>/loom-package.json` 承接 package 级机器可读版本与边界 metadata

## 四、`bootstrap/root contract` 与深知识库的关系

`bootstrap/root contract` 是宿主进入 Loom 的根入口，但它不承担 Loom 全部知识。

其职责应收敛为：

- 识别当前任务或仓库是否需要进入 Loom 运行模型
- 判断应装配哪些入口能力与首批落点
- 把后续工作导向 full-repo `skills/shared/references/` 或 package-local `.loom-runtime/` 中稳定暴露的治理 / 执行 / 模板 / 采用读面，以及具体 skill 引用
- 暴露稳定的最小输入合同与输出合同

深知识库的职责应保留在被引用的规范、规则、模板与参考材料中。两者关系如下：

- `bootstrap/root contract` 负责“进入哪里”
- 深知识库负责“进入后依据什么做判断”
- `bootstrap/root contract` 可以编排与引用，但不应内联复制大段规则真相
- 当深知识发生升级时，应优先更新被引用落点，而不是让多个 skill 各自复制一份解释

如果某项知识必须长期维护、需要跨 skill 共享、或会影响治理与执行真相，它不应沉积在 root skill 本体中，而应进入 repo-local 内核区域并镜像到安装态所需的 `src/skills/shared/references/`，再生成到根 `skills/` 和 package-local `.loom-runtime/`。

## 五、单 skill package 的最小合同

`single-skill standard-skill package` 至少应满足：

- package 能稳定声明它交付的是哪个标准 skill
- package 能暴露该 skill 的最小输入、输出与引用关系
- package 能定位其 launcher / shim、skill-local `scripts/` 与所需私有 runtime / resources
- package 必须包含 `loom-package.json` 与 package-local `.loom-runtime/`
- package 能明确说明它不承诺整包 Loom 默认能力
- package 若缺失所需 shared runtime / resources、合同漂移或运行态冲突，必须 fail-closed

单 skill package 不应：

- 宣称自己等同于 repo-local `loom` plugin
- 把其余 scenario skills 的可用性伪装成默认能力
- 复制一份脱离仓库版本控制的 Loom 治理真相
- 把 repo-local `loom CLI` 的存在误写成“自动获得完整 Loom”

## 六、宿主适配器职责边界

宿主适配器的职责，是把 Loom 的入口合同映射到具体宿主的发现、安装、调用与升级机制。

宿主适配器应负责：

- 让宿主能够发现可安装的 Loom plugin、scenario skills 或单 skill package
- 将宿主的调用入口映射到 Loom 定义的 skill 合同
- 提供必要的引用解析、资源定位与版本识别
- 在升级时替换或刷新宿主侧安装物，但不擅自改写 Loom 内核语义
- 暴露宿主运行所需的最小兼容信息，例如入口名、版本、依赖引用位置
- 在安装或升级失败时，暴露可读取失败结果，而不是把“未知状态”伪装成安装成功

宿主适配器不应负责：

- 重新定义 Loom 的治理规则
- 把宿主交互习惯提升为 Loom 默认工作流
- 将宿主特有状态面充当 Loom 的事实真相源
- 在 adapter 内复制并长期维护一份脱离仓库版本控制的 Loom 规则
- 把单 skill package 说成“默认完整安装”

换言之，适配器负责“接上宿主”，不负责“替代 Loom 内核”。

## 七、最小安装、发现与升级合同

Loom 对宿主只要求最小合同，不要求统一实现形态。

最小安装合同至少应满足：

- 宿主能够安装一个或多个 Loom 入口对象
- 安装物能够声明自身标识、类型与版本
- 安装物能够定位其 root 入口或单 skill 入口与被引用资源
- 安装物能够在 `skills/` 安装根内部定位 skill-local `scripts/` 与 package-local `.loom-runtime/`
- 宿主能够把 installed runtime、repo-local demo 与 upgrade rehearsal 区分为稳定可读状态
- 若 shared runtime / resources 缺失、合同漂移或运行态冲突，宿主必须 fail-closed，而不是继续报告“可运行”

最小发现合同至少应满足：

- 宿主能够列出当前可用的 Loom 入口
- 宿主能够识别哪个入口是 `bootstrap/root contract`
- 宿主能够区分完整 Loom install surface 与单 skill package
- 宿主能够区分已安装版本与可升级版本

最小升级合同至少应满足：

- 升级是显式的可识别动作，而不是静默漂移
- 升级后宿主能够确认入口合同版本已变化
- 若升级涉及引用关系变化，宿主能够重新解析引用而不是继续使用旧缓存
- 升级失败时，不应伪装为已完成升级

Loom 当前仓库内以机读工件承接这组最小合同：

- `VERSION`
- `skills/registry.json`
- `skills/install-layout.json`
- `skills/route-matrix.md`
- `skills/loom-init/contract.json`
- `skills/<scenario>/contract.json`
- `skills/<skill-id>/loom-package.json`
- `skills/upgrade-contract.json`
- `plugins/loom/skills/shared/references/adoption/version-authority-map.md`

Loom 在此层不规定包管理器、注册中心、目录布局或分发协议；这些属于宿主实现，而不是 Loom 内核。

最小兼容信息至少应能回答：

- 当前入口标识是什么
- 当前入口属于 plugin install、scenario skill 还是单 skill package
- 当前入口合同版本是什么
- 当前引用关系从哪里解析
- 当前 shared runtime / assets / references 是否齐备
- 当前 runtime_state 是什么
- 若当前不能继续运行，fail-closed 原因是什么
- 当前宿主是否识别为可升级状态

## 八、Node installer 接入面

Loom 为历史宿主适配保留一个 deprecated Node installer artifact：

- npm package：`@mc-and-his-agents/loom-installer`
- Deprecated legacy command surface：
  - `npx @mc-and-his-agents/loom-installer add plugin`
  - `npx @mc-and-his-agents/loom-installer add skill <skill-id>`

Node installer 的职责边界：

- 只为历史 adapter-managed 安装、single-skill 安装与验证保留
- 不作为 Codex 默认安装入口
- 不作为当前 Loom CLI、推荐安装入口或 active release line
- 不替代 `src/skills/shared/scripts/*`、package-local `.loom-runtime/` 与各场景 skill 的 Python runtime
- 不把单 skill 安装伪装成完整 Loom 安装
- 对安装失败维持 fail-closed
- main 分支是 validation truth source
- PR 和 main validation 只做门禁，不发布 npm
- Loom 仓库主 release 与 installer npm 包版本线独立维护
- 最后一个 active installer baseline 是 `@mc-and-his-agents/loom-installer` `0.1.119` / `loom-installer-v0.1.119`

Node installer legacy package payload 来源：

- plugin payload：发布时由 `plugins/loom/.codex-plugin/` manifest 与生成后的根 `skills/` 表面构建
- single-skill payload：发布时由生成后的根 `skills/<skill-id>` package 构建

Node installer 的最小 preflight 必须覆盖：

- 目标目录存在且可写
- package 内 payload 完整且校验不漂移
- `python3 >= 3.10`，并对 `3.11+` 给出推荐
- `add skill <skill-id>` 只能接受已登记 skill id
- Claude plugin 安装必须确认 `claude` CLI 可用

Node installer 的最小 verify 输出必须覆盖：

- `mode`
- `host`
- `distribution_layer`
- `installed_paths`
- `version_context`
- `verification`
- `warnings`
- `failed_layer`
- `fail_closed_reason`

当前宿主映射固定如下：

- Codex plugin
  - adapter-managed path, not Codex default
  - upstream `plugins/loom/.codex-plugin/` manifest + generated root `skills/`
  - `.agents/plugins/marketplace.json`
- Codex single-skill
  - repo-scoped `<target>/.agents/skills/<skill-id>/`
  - user-scoped `~/.agents/skills/<skill-id>/` when installed manually outside a repo
- Claude plugin
  - repo-local `.claude/marketplaces/loom-local/`
  - `claude plugin marketplace add`
  - `claude plugin install loom@loom-local`
- Claude single-skill
  - `<target>/.claude/skills/<skill-id>/`
- OpenCode / Gemini / Cursor
  - full repo install plus host adapter discovery as documented in `plugins/loom/skills/shared/references/adoption/host-adapter-matrix.md`
  - static verification is required until an executable host CLI is available in the local gate environment

这些路径与命令属于 adapter surface，不反向提升为 Loom 内核规则。

## 九、不应进入内核的宿主特定细节

以下内容不得直接进入 Loom `skills/` 内核合同：

- 某个宿主专有的命令名、按钮名、面板名或 UI 文案
- 某个宿主当前采用的目录约定、缓存路径或安装路径
- 某个宿主专有的权限模型、会话模型或线程模型细节
- 某个平台的市场发布流程、审核流程或签名流程
- 任何只能在单一宿主成立、且未经抽象的配置键名与环境变量命名

这些内容可以存在于宿主适配器文档、宿主发行包或宿主实现中，但不应反向污染 Loom 的入口层合同。

## 十、入口层最小验证面

对 `skills` 分发与适配合同的验证，至少应覆盖：

- 显式触发是否正确
  - 当调用者明确请求某个 Loom 入口时，宿主是否能路由到正确入口，而不是触发错误 skill 或无声失败
- 隐式触发是否正确
  - `bootstrap/root contract` 是否能基于仓库信号与任务信号，导向正确入口或明确不触发
- 单 skill package 边界是否正确
  - package 是否只暴露其命名 skill 的合同，而不是暗示整包 Loom 默认能力
- 行为是否退化
  - 升级后入口是否仍能给出同类判断、同类引用关系与同类输出合同，而不是静默漂移
- 宿主是否能稳定发现 root 入口
- 安装后引用关系是否仍可解析
- skill-local `scripts/` 是否仍能解析到 `shared/scripts/assets/references`
- 升级后版本变化是否可见
- 宿主适配失败时，是否会被错误宣称为已安装或已升级
  - 失败必须可见，而不是伪装成“入口存在但行为未知”

这类验证属于入口层能力验证，不等同于业务代码测试，也不等同于下游仓库的业务回归测试。

上述最小验证面当前已经形成 Loom 默认承认的稳定 core 接口；宿主完整回归矩阵仍停留在候选层，不进入 Loom 默认 core。

## 十、与 `automation-frontload` 的边界

入口层验证与通用前置检查的关系如下：

- `automation-frontload` 的默认 core 检查
  - 关注结构完整性、规则落点、模板存在性、交叉引用、执行支撑入口与明显越界信号
- `skills` 触发与行为回归验证
  - 当前已形成 Loom 默认承认的最小入口回归面
  - 只要求稳定合同与 fail-closed 语义，不要求每个仓库立即具备完整宿主矩阵

换言之，Loom 可以定义入口层最小验证面，但不要求每个仓库都立即具备完整宿主矩阵。

## 十一、哪些验证不进入 Loom 内核

若未来需要扩展 `skills/` 分发模型，应优先保持以下顺序：

1. 先定义稳定的入口合同
2. 再定义宿主适配边界
3. 最后才讨论宿主优化体验或分发便利性

以下内容不应进入 Loom `skills/` 内核合同：

- 某个宿主的完整测试矩阵
- 某个 CI 产品的流水线配置
- 单一仓库专用测试脚本或录屏回放
- 只能在单一宿主成立的触发 hook 细节

这些内容可以落在宿主 adapter、宿主发行包或下游仓库中，但不应反向成为 Loom 的默认规则。

判断标准不是“某个宿主是否更易用”，而是“Loom 的入口层边界是否仍然清晰、可版本化、可被不同宿主复用”。
