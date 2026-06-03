# Governance Lint Taxonomy

本文件冻结 Loom Governance Lint / Operating Lint 的 taxonomy、阻断语义与证据边界。

Governance lint 是 derived evidence。它只把已经存在的 authored truth、host/control-plane mirror、retained result 与 repo companion locator 读成机械检查结果；它不得成为新的 authored truth，也不得把 repo-specific 规则硬编码进 Loom core。

## 1. 能力定位

Governance lint 用于前置发现可机械判断的治理缺口。

它回答：

- 当前 fact-chain、approval、binding、companion 边界和 evidence freshness 是否可机械消费
- 某个 lint result 对 pre-review、review、merge-ready 或 closeout 是 blocking、advisory、repo-specific 还是 not_applicable
- 结果来自哪个 source、绑定哪个 `HEAD`、范围、reviewed head 或 evidence locator

它不回答：

- 目标是否值得做
- 方案语义是否正确
- repo-specific 架构规则内容是什么
- 宿主 review、CI 或 guardian verdict 是否等同于 Loom approval

## 2. 结果强度

每条 lint result 必须归入以下强度之一：

| 强度 | 语义 | 默认消费方式 |
| --- | --- | --- |
| `blocking` | core 前置合同已经被破坏，当前 surface 不能继续放行 | 阻断 owning surface，并要求回到 `fallback_to` |
| `advisory` | 风险或缺口可见，但不是 core 放行前置 | 进入 status / review / closeout 摘要，不单独阻断 |
| `repo_specific` | 检查来自 repo companion 声明的 repo-owned 规则 | 按 companion 声明的 owning surface 与 enforcement 消费 |
| `not_applicable` | 当前事项不适用，且原因与 fact-chain / companion 声明不冲突 | 展示为已判定不适用，不作为缺失输入 |

`repo_specific` 不是第四类 core taxonomy。它表示结果来源和 ownership 属于目标仓库；只有 repo companion 把该规则声明为当前 surface 的 `blocking` requirement 时，才可在该 surface 阻断。

## 3. Core lint failure taxonomy

Core governance lint 固定以下 failure kind：

| kind | 默认强度 | 典型触发 | 默认回退 |
| --- | --- | --- | --- |
| `fact_chain_broken` | `blocking` | Work Item、recovery、review record、merge / closeout basis 缺失、断链或并行记账 | fact-chain / recovery 修复 |
| `approval_bypass` | `blocking` | raw review evidence、CI 成功、PR body、engine output 或 shadow evidence 被当成 semantic approval | review record / approval gate |
| `companion_boundary_bypass` | `blocking` | repo companion 或 `repo-interface.json` 承载 runtime state、review verdict、validation status、closeout result 或 retained host action result | repo companion / interop 边界修复 |
| `host_binding_drift` | `blocking` | Work Item、branch、PR、`head_sha`、reviewed head、merge commit 或 target branch 无法互相回链 | host binding / status control plane |
| `evidence_stale` | `blocking` | behavior evidence、test evidence、runtime evidence 或 retained result 不再绑定当前 `HEAD`、范围或恢复摘要 | validation / evidence refresh |
| `core_hardcoding_leak` | `blocking` | 下游仓库路径、命名、guardian 规则、CI job 或 repo-specific 架构约束被写成 Loom core 默认规则 | adoption / companion 边界修复 |

这些 kind 可以映射到 [governance-failure-taxonomy.md](./governance-failure-taxonomy.md) 的 `stale` / `drift` / `gate_failure`，但不替代该顶层 gate taxonomy。lint 输出必须同时保留 lint kind 与映射后的 gate failure category。

## 4. Advanced architecture / boundary lint surface

repo companion 可以通过 `advanced_lint_locators` 声明 architecture / boundary lint 的只读入口。该 surface 用于暴露成熟仓库已有的边界检查，不把检查内容提升为 Loom core 默认规则。

`advanced_lint_locators[*]` 固定字段：

- `id`
- `summary`
- `lint_type`
- `locator`
- `owner`
- `requirement`
- `surface`
- `fallback_to`
- `result_envelope_schema`

`lint_type` 只允许：

- `architecture_boundary`
- `bounded_context`
- `legacy_access`
- `host_state_access`
- `companion_boundary`

`result_envelope_schema` 固定为 `loom-governance-lint-result/v1`。locator 指向的结果仍按本文件的最小 result envelope 消费，不能 author runtime state、review verdict、validation summary、merge verdict 或 closeout result。

Loom core hardcoding guard 是 `core_hardcoding_leak` 的内建检查面。它只阻止 repo-specific guardian、review path、final verdict、blocking owner 或 override decision 被写成 Loom core 默认；反例 fixture 与禁止性说明可以存在，但必须留在 evidence / fixture / validation 或明确的禁止语义中。

## 5. repo-specific lint 边界

repo-specific lint 只能通过 [repo-companion-contract.md](../adoption/repo-companion-contract.md) 声明 locator、owner、enforcement 与 owning surface。

稳定约束：

- Loom core 不猜测 repo-specific lint 文件名、目录名、CI job 名或 guardian 名称
- repo-specific lint result 只能作为 retained / derived evidence 被状态面和 gate 消费
- required / blocking repo-specific lint 缺失时，阻断的是声明的 owning surface，不新增 Loom core kind
- optional / advisory repo-specific lint 缺失只进入 advisory evidence
- repo-specific lint 不得 authored Work Item、recovery、review verdict、validation summary 或 closeout result

若 repo-specific lint 暴露出 core 边界破坏，例如把 review verdict 写进 companion manifest，应同时产生 core `companion_boundary_bypass`。

## 6. 最小 result envelope

每条 lint result 至少包含：

- `schema_version`
  - 固定为 `loom-governance-lint-result/v1`
- `id`
- `kind`
- `strength`
  - `blocking | advisory | repo_specific | not_applicable`
- `surface`
  - `admission | pre_review | review | build | merge_ready | closeout | status`
- `subject`
- `summary`
- `mapped_failure`
  - `category`
  - `kind`
- `provenance`
  - `source_layer`
  - `source_owner`
  - `source_locator`
  - `source_binding`
  - `freshness`
- `bindings`
  - `item_id`
  - `head_sha`
  - `scope`
  - `reviewed_head_sha`
  - `pr_ref`
- `evidence_freshness`
  - `fresh | stale | missing | unreadable | not_applicable`
- `fallback_to`

`source_layer` 只允许 `authored_truth | host_control_mirror | retained_result | derived_surface`，与 status control plane 的 provenance 词表保持一致。repo companion 来源通过 `source_owner: repo_companion` 与 `.loom/companion` locator 表达，不新增第五类 truth layer。

影响放行的 result 必须绑定当前 `item_id`、当前 `HEAD`、当前范围，以及适用时的 `reviewed_head_sha` / `pr_ref`。缺少这些绑定时，result 自身不可被当作 fresh evidence；若 owning surface 必需该检查，应 fail closed。

## 7. Surface 消费语义

### 7.1 pre-review

pre-review 可以阻断：

- `fact_chain_broken`
- `companion_boundary_bypass`
- `core_hardcoding_leak`
- repo companion 声明为 pre-review blocking 的 repo-specific lint

pre-review 只能 advisory 展示：

- optional / advisory repo-specific lint
- 不影响当前 review 输入完整性的 lint risk

### 7.2 merge-ready

merge-ready 可以阻断：

- `approval_bypass`
- `host_binding_drift`
- `evidence_stale`
- `fact_chain_broken`
- repo companion 声明为 merge-ready blocking 的 repo-specific lint

merge-ready 不得因为 advisory-only lint result 改变结果。advisory 结果必须进入摘要，供 reviewer、controlled merge 或 closeout 消费。

### 7.3 closeout

closeout 可以阻断：

- `fact_chain_broken`
- `host_binding_drift`
- `evidence_stale`
- `companion_boundary_bypass`
- repo companion 声明为 closeout blocking 的 repo-specific lint

## 8. 非目标

- 不实现具体检查器
- 不新增顶层命令
- 不定义 repo-specific 架构规则内容
- 不把 repo-specific lint 结果命名提升为 Loom core taxonomy
- 不把 lint result 写成第二份恢复状态、review 结论或 closeout 结论
