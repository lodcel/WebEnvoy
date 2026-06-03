# Governance Maturity Model

本文件定义 Loom governance profile 的成熟度模型。

它回答三个问题：

- 当前仓库处于哪一档治理等级
- 每一档必须具备哪些合同、gate 与状态面
- 从低档升级到高档时，缺口和阻断是什么

## 1. 三档定义

Loom 当前冻结三档成熟度：

- `light`
- `standard`
- `strong`

它们是治理能力档位，不是仓库价值判断。

## 2. `light`

`light` 适用于只需要最小执行入口与基本 review / merge 纪律的仓库。

Fresh adoption 默认最高只能到 `light`。repo-local aliases、workflow 文件或 companion scaffold 不等于宿主强制控制面。

至少必须具备：

- `Work Item` 作为唯一默认执行入口
- 基本 work item / recovery / review locator
- implementation review
- `merge-ready`
- 最小状态读取面

仍可缺失：

- formal spec 路径
- `spec review`
- 统一 closeout / reconciliation 状态面
- 强 host binding 自动校验

## 3. `standard`

`standard` 适用于已经需要 formal spec、前序 gate 与更完整状态面的仓库。

在 `light` 基础上，至少新增：

- `FR -> Work Item` 分层
- formal spec / `spec review`
- `spec gate` enforcement
- 统一 `status control plane`
- 基本 host binding
- closeout / reconciliation 的最小读面

## 4. `strong`

`strong` 适用于需要完整 strong governance parity 的仓库。

在 `standard` 基础上，至少新增：

- 强制 `Work Item` enforcement
- 统一 host binding chain
- `status control plane v2`
- 统一 `stale` / `drift` / `gate_failure` taxonomy
- 强前置 `gate chain`
- `GitHub controlled merge`
- merge 后 `closeout + reconciliation` 一体化
- 已验证的宿主强制控制面：branch protection 或 ruleset、required checks、PR merge path、controlled merge basis、closeout basis
- 可验证的 GitHub profile upgrade 路径
- parity validation 证据

## 5. 升级条件

### 5.1 `light -> standard`

至少同时满足：

- 已明确 `FR` 与 `Work Item` 分层
- formal spec 路径需要被前置 gate 消费
- 仓库已需要统一状态读面，而不是局部脚本拼装

### 5.2 `standard -> strong`

至少同时满足：

- merge 前 review 已出现明显 overload
- 需要统一 host binding、merge control 与 closeout control plane
- 需要用统一 taxonomy 暴露 stale / drift / gate failure
- 需要对 adopted repo 给出可检查的 parity / upgrade judgment
- 宿主 branch protection 或 ruleset、required checks、PR merge path、controlled merge basis、closeout basis 都能被 verified host read 证明

## 6. 阻断条件

以下情况阻断升级到 `strong`：

- `Work Item` 仍不是唯一默认执行入口
- formal spec 路径仍可绕过 `spec review`
- `status control plane` 仍由多个 skill 各自拼装
- merge / closeout 仍缺稳定 binding chain
- 宿主控制面为 `unverified`、`stale` 或 `host_unavailable`
- 只有 local gate starter 或 workflow 文件，但 required checks / branch protection / ruleset 未被宿主强制
- parity 仍只有口头比较，没有版本控制内证据

## 7. 与 adoption / check / status 的关系

- adoption
  - 负责声明推荐路径与升级顺序
- check
  - 负责验证当前档位要求是否满足
- status
  - 负责暴露当前仓库已满足哪些强治理条件

## 8. 一句话结论

成熟度模型的目标不是增加标签，而是让“当前在哪里、还缺什么、怎么升级”都可检查。
