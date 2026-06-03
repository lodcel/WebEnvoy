# Gate Chain

本文件冻结 Loom strong governance 默认使用的强前置消费链。

## 1. 目标

`review gate`、`merge gate`、`GitHub controlled merge`、`closeout` 不是并列的独立检查点。
它们必须沿同一条前序链消费上游结论，缺任一前序都要 fail-closed。

## 2. 稳定顺序

默认顺序固定为：

- `Work Item admission`
- `spec gate`（仅 formal spec 路径必需）
- `build gate`
- `review gate`
- `merge gate`
- `GitHub controlled merge`
- `closeout`

## 3. 每层必需消费

### 3.1 `Work Item admission`

必须证明：

- 当前执行入口是合法 `Work Item`
- `Work Item` 身份、范围、执行路径、恢复入口可读取
- host binding 已绑定到同一事项

### 3.2 `full suite gate inputs`

当 Work Item 选择 full spec path 时，gate chain 必须把 full suite
artifact locators 作为前序输入消费，而不是在 review 或 merge-ready
临场重新发现这些输入：

- `suite-index.md` path decision、artifact inventory、deferred /
  `not_applicable` table
- `spec.md` scenario / acceptance locators
- `plan.md` validation / test strategy locators
- 条件工件的 locator 或 `not_applicable` rationale
- execution breakdown / task carrier locator（若 #1017 合同声明适用）
- evidence-map locator 与 freshness binding（若 #1018 合同声明适用）
- consistency-analysis locator、classification 与 remediation direction（若 #1018
  合同声明适用）

这些输入只说明 gate 可以消费什么；它们不替代 `Work Item`、recovery、
review record、merge checkpoint 或 closeout truth。

Minimal path 仍是合法路径。Minimal path 可以用 `not_applicable`
rationale 跳过 full path 附加工件，但 rationale 必须同时说明：

- 不适用对象的 locator 或 artifact id
- 不适用原因
- consumer boundary：哪些 gate 可以消费该结论
- recheck condition：哪些 scope、risk、host state 或 evidence 变化会使该结论失效
- 与 `spec.md`、`plan.md`、recovery 和 current scope 不冲突

缺少 rationale、consumer boundary 或 recheck condition 的缺口是 `missing`，
不是 `not_applicable`。`deferred` 也不等于 `not_applicable`；deferred
必须回链后续事项，不能作为当前 gate 默认放行依据。

### 3.3 `spec gate`

formal spec 路径上必须证明：

- 上位 `FR` 已存在
- formal spec 已冻结到可审查版本
- 若 formal spec 消费 User Story，Story Business Confirmation 已 `confirmed` 或明确 `not-applicable`
- `spec_review` 为 `approved`
- 未出现 `spec_stale`
- full path 必需 suite 工件可读取，或 minimal path 的 `not_applicable`
  rationale 可被当前 gate 消费

### 3.4 `build gate`

必须消费：

- `Work Item admission`
- formal spec 路径上的 `spec gate`
- 当前 `head_sha`
- 当前验证摘要
- 当前实现仍在已批准范围内
- full path 的 suite readiness 结论，或 minimal path 的合法
  `not_applicable` rationale

### 3.5 `pre-review`

`pre-review` 是正式 review 前的 fail-closed 预检层。它必须消费：

- `build gate`
- suite path decision
- full suite artifact locators 或 minimal path `not_applicable` rationale
- evidence-map 中 behavior evidence、test evidence、fresh verification
  evidence 的 locator / freshness / scope / `HEAD` 绑定
- consistency-analysis 中 blocking / advisory / stale / missing / conflict /
  `not_applicable` 分类
- task carrier 或 execution breakdown locator（若当前 path 声明适用）
- `suite evidence validate` / `suite carrier validate` 的当前结果，作为
  gate input evidence 消费

以下情况不得进入正式 review：

- full path 必需工件缺失、不可读或没有 provenance
- scenario -> validation、acceptance -> test evidence 映射缺失且没有合法
  `not_applicable`
- evidence-map 显示当前 gate 必需 evidence 为 `missing`、`stale`、`conflict`
  或 unreadable
- consistency-analysis 存在 blocking consistency gap
- task carrier validation 报告 carrier truth conflict、缺 locator、状态非法、
  relationship 非法或 Work Item / breakdown / spec / plan / validation 回链缺失
- minimal path 用无理由 `not_applicable` 掩盖 full path 缺口

`pre-review` 可以暴露 advisory gap，但必须保留 source locator、freshness
判断和后续消费者边界。正式 review 不应成为第一次系统性发现
spec / plan / evidence gap 的地方。
`pre-review` 的 suite validation payload 只证明 gate 读过哪些 evidence /
carrier 输入；它不替代正式 review 记录或 merge-ready 结果。

### 3.6 `review gate`

必须消费：

- `build gate`
- `pre-review`
- 当前 `head_sha`
- 当前验证摘要
- 单一 review record
- reviewer 已消费的 full suite / evidence-map / consistency-analysis locators
  与 review record backlink
- implementation review 记录 `allow` 前必须重新消费 `suite evidence
  validate` 与 `suite carrier validate`，并在 review record 的
  `consumed_inputs` 中保留 evidence-map 与 task-carrier locators

### 3.7 `merge gate`

必须消费：

- `review gate`
- host binding 中的 `head_sha` / PR / branch 关系
- 最新验证摘要与运行证据
- 未出现 `review_stale`、`head_drift` 或 `missing_prerequisite_gate`
- evidence-map 显示 behavior evidence、test evidence 与 fresh verification
  evidence 覆盖当前 `HEAD`、scope 与 recovery summary
- `suite evidence validate` 没有 stale / missing / conflict evidence
- `suite carrier validate` 没有 carrier truth conflict 或 tracking carrier
  替代 Work Item、review、merge-ready、closeout truth 的信号
- consistency-analysis 无 blocking gap、stale evidence、host state conflict 或
  deferred-as-completed
- review record 对 full suite evidence 的消费仍 fresh

### 3.8 `GitHub controlled merge`

必须消费：

- `merge gate`
- 宿主 required checks
- branch protection / merge policy
- merge method 是否符合当前 profile

### 3.9 `closeout`

必须消费：

- `GitHub controlled merge` 已成功
- retained review / validation / merge-ready evidence 与 PR head 的 backlink
- host required checks / PR checks evidence 的 head 绑定
- merge commit 与目标主干已可定位
- evidence-map 与 merged result / target branch / merge commit 的回链
- consistency-analysis 或 closeout reconciliation 中没有 blocking gap；若有
  advisory gap，必须保留 source locator 与不阻断理由
- `reconciliation audit` 结果
- issue / parent / project 收口 basis

普通 closeout 默认只执行 `closeout-contract` 轻量消费。source self-fixture、bootstrap regression、distribution regression 与 strong profile full gate 只有在 profile 显式 opt-in 时才进入 closeout 本地 gate，不得被伪装成普通 closeout 的默认前置。

## 4. fail-closed 纪律

任一层都必须遵守：

- 不得跳过前序直接放行
- 不得拿后序成功覆盖前序缺失
- 不得把前序缺失伪装成局部 warning

稳定回退方向：

- 缺 `Work Item admission`
  - 回到执行入口 authoring / binding 修复
- 缺 `spec gate`
  - 回到 formal spec / `spec_review`
- 缺 `build gate`
  - 回到范围收敛、验证或恢复回写
- 缺 `review gate`
  - 回到 review 执行层
- 缺 `merge gate`
  - 回到 build / review / validation 收口
- 缺 `GitHub controlled merge`
  - 回到宿主 gate 或 `merge gate`
- 缺 `closeout`
  - 回到 `reconciliation sync` 或 merge basis 修复

## 5. closeout basis 回链要求

进入 `closeout` 时，至少要能回链整条链：

- 当前 `Work Item`
- 上位 `FR`（若存在）
- `spec_review` 记录
- implementation review 记录
- `merge gate` 结论
- suite path decision 与 full suite / minimal path rationale
- evidence-map locator
- consistency-analysis locator 或 closeout reconciliation 等价结论
- PR
- merge commit
- `reconciliation audit` 结果

若任何一环无法回链，结果必须是 `block`，而不是“先 close 再补”。

## 6. 非目标

- 不要求所有仓库都用相同文件名
- 不把每个 gate 的具体实现脚本写死在本文件
- 不允许把 guardian、CI 或 reviewer 任一者单独提升为整条链的唯一代言人
