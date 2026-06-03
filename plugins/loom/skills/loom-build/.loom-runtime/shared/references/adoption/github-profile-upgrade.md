# GitHub Profile Upgrade

本文件定义 GitHub host 下 `light -> standard -> strong` 的升级路径。

## 1. 目标

升级不是“多加几份文档”，而是把 GitHub profile 从可接入推进到可持续消费 strong governance。

## 2. 升级主线

默认升级顺序固定为：

1. `light`
2. `standard`
3. `strong`

不支持跳过 `standard` 直接宣称 `strong`。

## 3. `light -> standard`

### 3.1 应新增的能力

- `FR` 与 `Work Item` 分层
- formal spec / `spec review`
- 基本 host binding
- 统一状态读取面
- closeout / reconciliation 的最小读面

### 3.2 完成判断

至少同时满足：

- `Work Item` 仍是唯一执行入口
- formal spec 路径已不再绕过 `spec review`
- review 与 `merge-ready` 已能消费 `spec_review`
- 状态面已能暴露 item / checkpoint / review / merge-ready

## 4. `standard -> strong`

### 4.1 应新增的能力

- `Work Item` enforcement
- `FR -> Work Item -> PR -> merge commit` 绑定链
- `status control plane v2`
- `stale` / `drift` / `gate_failure` taxonomy
- 强前置 `gate chain`
- `controlled merge`
- closeout / reconciliation 一体化
- parity validation

### 4.2 完成判断

至少同时满足：

- 非 `Work Item` 入口会 fail-closed
- 所有正式 gate 都能回溯到稳定 `Work Item`
- merge 后可以稳定回链整条交付链
- 统一状态面可直接暴露 closeout drift
- 已有版本控制内 parity validation 记录

## 5. residue 判断

以下情况表示仍存在 residue，不能宣称 strong governance 完成：

- 仍需口头说明才能定位当前 gate
- merge / closeout 仍依赖临时脚本猜绑定关系
- stale / drift 仍由不同入口各自解释
- GitHub profile 升级结果无法被后续 gate 稳定消费

## 6. Strong governance parity 目标

GitHub strong governance 的目标不是复制任何下游仓库的文件名，而是达到可验证的 strong governance 能力基准：

- 唯一执行入口
- formal spec 前置 gate
- 强绑定链
- 统一状态面
- 受控合并
- closeout / reconciliation 收口

## 7. 非目标

- 不把任何下游仓库的 repo-local 命名直接抄成 Loom 默认规则
- 不要求所有 adopted repo 一次性切到 `strong`
- 不把 validation-only parity 直接升级成 blocking host policy

## 8. Gate rollout 合同

GitHub profile adoption 的 gate 消费模式固定为三态：

- `advisory`
  - 新接入仓库的默认模式。
  - Loom 可以报告 review、merge-ready、closeout、shadow parity 与 reconciliation 信号，但不得直接成为 blocking authority。
- `blocking`
  - 只能由 strong governance profile 显式启用。
  - 启用前必须满足 strong maturity、adversarial adoption checks、rollback switch 三个前置条件。
  - 不能把新仓库或未完成 hardening 的仓库直接切到 blocking。
- `rollback`
  - 当 runtime、evidence、host binding、review head 或 metadata parsing 出现漂移时，必须能回退到 advisory。
  - rollback 不删除证据，只暂停 blocking 消费，直到重新通过 adversarial adoption checks。

`governance-profile upgrade-plan` 必须输出：

- `gate_rollout.default_mode`
- `gate_rollout.current_mode`
- `gate_rollout.recommended_mode`
- `gate_rollout.target_mode`
- `gate_rollout.blocking_preconditions`
- `gate_rollout.rollback`

默认建议必须保持 `advisory`。只有当所有 blocking 前置条件都有版本控制内证据时，才允许 `recommended_mode` / `target_mode` 进入 `blocking`。`rollback.conditions` 必须结构化覆盖 runtime、evidence、host binding、review head 与 metadata parsing 漂移，且 rollback 只能暂停 blocking 消费并回到 advisory，不删除既有证据。

## 8.1 Maturity detector judgment

GitHub profile maturity detector 的稳定入口是：

```bash
python3 tools/loom_flow.py governance-profile upgrade-plan --target <repo> --host github
```

`maturity.current` 仍只表达已满足的稳定 maturity level：`unadopted | light | standard | strong`。`blocked` 不进入 `current` 枚举，避免把“当前成熟度”和“无法可信判断”混成一个字段。

阻断状态必须通过 `maturity.judgment` 独立表达：

- `schema_version: loom-github-profile-maturity-judgment/v1`
- `judgment: light | standard | strong | blocked`
- `current`
- `blocked`
- `blockers[]`
- `evidence[]`

每个 evidence entry 必须包含：

- `id`
- `status`
- `locator`
- `authority`

当 Work Item / recovery / status / review 等 light 前置 carrier 不可读，或 GitHub API / host enforcement 等关键宿主信号不可读、冲突、过期时，`judgment` 必须为 `blocked`，并给出 `blockers[].source_locator` 与 `fallback_to`。缺证据只能返回 `missing` 或 `blocked`，不得猜测通过。

## 9. Agent-assisted upgrade plan 输出

`governance-profile upgrade-plan` 是 GitHub profile 升级的默认读取入口。它不得只返回缺字段列表；必须把缺口展开成固定的 read / judge / write / verify adoption workflow。

稳定输出至少包含：

- `loom-adoption-decisions/v1`
  - 每个 judgment 固定包含 `id`、`question`、`source_locator`、`reasoning`、`write_targets`、`verification_commands`、`status`
  - `status` 只能表达为 `answered | missing | blocked`
- `loom-guided-adoption-plan/v1`
  - 将每个 judgment 展开为 `read -> judge -> write -> verify` 步骤
  - 不写状态，只给下一步执行所需 locator、write target 与验证命令
- `loom-companion-generation/v1`
  - 预览或记录 `.loom/companion/manifest.json`、`repo-interface.json`、`interop.json` 的生成状态
  - 不生成 repo-native shadow verdict；shadow parity 只能消费 `interop.json` 中声明的只读 locator
  - 默认 dry-run；只有显式 `--apply` 才能写入

升级计划必须覆盖：

- FR / Work Item 分层
- closeout / reconciliation read surface
- repo companion contract
- review instruction locators for spec review and implementation review
- repo interop contract
- GitHub controlled merge
- repo-specific residue
- authority boundary
- guardian / integration contract 作为 repo-native evidence 的读取边界

这些判断只服务于 GitHub profile 采用和升级；不得把任何下游仓库的 repo-native review / guardian 规则、单仓命名或 repo-local gate 细节提升为 Loom core 默认规则。升级计划必须要求 mature / deep-existing 仓库声明 repo-owned review instruction locator，不能猜测 `spec_review.md`、`code_review.md` 或任何 repo-specific review instruction 路径。
