# Repo Companion Contract

本文冻结 Loom 面向既有仓库的 `repo companion` 主合同。

术语约束：

- 正式术语统一使用 `repo companion`
- 历史材料中的 `companion docs` 只作为迁移/回溯表述保留，不再作为当前正式合同名

## 1. 目标与边界

`repo companion` 用于既有仓库的增量 adoption。

它只承接以下对象：

- repo-specific 规则入口
- repo-specific requirements 的机读声明
- specialized gates 的机读声明
- 仓库级 adoption / workflow 挂接入口

与之并行但单独分离的 companion-owned 读面：

- retained host action result / repo-native carrier / shadow parity 的只读入口
  - 由 [repo-interop-contract.md](./repo-interop-contract.md) 承接

它不承接以下 authored truth：

- work item
- recovery 进度
- review 结论
- current stop / next step / blockers / validation summary
- closeout 已完成状态

这些 authored truth 继续由现有 `harness/`、`governance/`、review record、recovery carrier 与 closeout 合同承接。

## 2. Ownership Boundary

- Loom core
  - 持有通用 governance truth、checkpoint 语义、review layering、host-action 与 closeout 合同
- repo companion
  - 持有 repo-specific requirements、specialized gates、repo-level workflow 挂接与 locator
- host adapter / host platform
  - 持有 branch / PR / worktree / CI / ruleset / project 等 retained host actions 的底层实现

稳定约束：

- `repo companion` 不得把 repo-specific 规则伪装成 Loom core 默认规则
- `repo companion` 不得改写 retained host actions 的 ownership
- GitHub native dependency 与 host binding inspector 属于 host/control-plane mirror；`repo-interface.json` 最多声明 repo-authored dependency truth locator，不承载 native edge 或 inspector result 作为 authored truth
- retained host actions 继续以 [host-action-contract.md](../harness/host-action-contract.md) 与 [closeout-gate.md](../harness/closeout-gate.md) 为唯一主落点

## 3. `.loom/companion/manifest.json`

`.loom/companion/manifest.json` 是 `repo companion` 的 locator-only manifest。

当前稳定 schema：

```json
{
  "schema_version": "loom-repo-companion-manifest/v1",
  "companion_entry": ".loom/companion/README.md",
  "repo_interface": ".loom/companion/repo-interface.json"
}
```

字段约束：

- `schema_version` 固定为 `loom-repo-companion-manifest/v1`
- `companion_entry` 必须指向可读的 `repo companion` 主文档
- `repo_interface` 必须指向可读的 `.loom/companion/repo-interface.json`

禁止事项：

- 增加实时 authored state
- 增加 review summary / current stop / blockers / validation summary
- 增加 closeout result 或任何“已经完成”的运行态声明
- 把 manifest 扩成第二套状态面

换句话说，manifest 只负责定位 companion 入口与机读接口，不负责承载运行态真相。

## 4. `.loom/companion/repo-interface.json`

`.loom/companion/repo-interface.json` 是 companion-owned 的最小机读合同，供 `governance_surface` 与 `loom_flow` 消费。

当前兼容读取两个 schema：

- `loom-repo-interface/v1`
- `loom-repo-interface/v2`

其中：

- `v1` 继续保持可读，作为下游兼容口径
- `v2` 是当前正式扩展口径，用于承接 typed `specialized_gates`、repo-specific metadata contract、context schema 与 dynamic tool locator

### 4.1 `v1` 兼容合同

```json
{
  "schema_version": "loom-repo-interface/v1",
  "companion_entry": ".loom/companion/README.md",
  "repo_specific_requirements": {
    "review": [],
    "merge_ready": [],
    "closeout": []
  },
  "specialized_gates": []
}
```

`v1` 字段约束：

- `schema_version` 固定为 `loom-repo-interface/v1`
- `companion_entry` 必须指向可读的 companion 主文档
- `repo_specific_requirements` 必须同时声明 `review`、`merge_ready`、`closeout` 三个 surface
- `specialized_gates` 必须存在，可为空数组

### 4.2 `v2` 扩展合同

```json
{
  "schema_version": "loom-repo-interface/v2",
  "companion_entry": ".loom/companion/README.md",
  "repo_specific_requirements": {
    "review": [],
    "merge_ready": [],
    "closeout": []
  },
  "specialized_gates": [],
  "review_instruction_locators": {
    "spec_review": {
      "locator": ".loom/companion/review-instructions/spec.md",
      "mode": "repo_declared"
    },
    "implementation_review": {
      "locator": ".loom/companion/review-instructions/implementation.md",
      "mode": "repo_declared"
    }
  },
  "metadata_contract": {
    "fields": []
  },
  "context_schema": {
    "fields": []
  },
  "dynamic_tool_locators": [],
  "policy_locators": [],
  "hook_locators": [],
  "advanced_lint_locators": []
}
```

`v2` 在 `v1` 之上新增可选顶层 section：

- `review_instruction_locators`
- `metadata_contract`
- `context_schema`
- `dynamic_tool_locators`
- `policy_locators`
- `hook_locators`
- `advanced_lint_locators`
- `release_targets`
- `host_truth_locators`

稳定约束：

- `metadata_contract` 与 `context_schema` 只在 `v2` 合法
- `review_instruction_locators` 只在 `v2` 合法
- `dynamic_tool_locators` 只在 `v2` 合法
- `policy_locators` 只在 `v2` 合法
- `hook_locators` 只在 `v2` 合法
- `advanced_lint_locators` 只在 `v2` 合法
- `release_targets` 只在 `v2` 合法
- `host_truth_locators` 只在 `v2` 合法，且只能声明宿主事实源 locator，例如 GitHub Issue、GitHub Project、PR review / guardian、PR metadata 与 issue state
- `v2` 不改变 `repo_specific_requirements` 与 `specialized_gates` 的既有纪律
- `v2` 不把 repo runtime state、progress/current stop、review verdict、review summary、validation status、closeout result 或 retained host action result 写入 `repo-interface.json`
- 默认治理 scaffold 与缺失 review instruction 的处理策略见仓库文档 `plugins/loom/skills/shared/references/templates/default-governance-scaffold-policy.md`

### 4.3 通用字段纪律

`repo_specific_requirements` 的每条 requirement 固定字段：

- `id`
- `summary`
- `locator`
- `enforcement`

其中：

- `enforcement` 只允许 `blocking | advisory`
- `locator` 必须指向仓内可读路径

`specialized_gates` 的每条 gate 固定字段：

- `id`
- `summary`
- `locator`
- `gate_type` 可选

其中：

- `gate_type` 只允许 `admission | pre_review | review | build | merge_ready | closeout`
- `gate_type` 只用于说明 gate 所属 Loom surface，不承载 repo-specific 运行态细节

### 4.4 `review_instruction_locators`

`review_instruction_locators` 用于声明仓库已有 review instruction 的机读入口。它回答的是：

- formal spec review 应读取哪份 repo-owned instruction
- implementation review 应读取哪份 repo-owned instruction
- 目标仓库是否显式选择 Loom default review instruction

当前固定 key：

- `spec_review`
- `implementation_review`

每个 locator entry 固定字段：

- `locator`
- `mode`

其中：

- `locator` 必须指向仓内可读路径
- `mode` 只允许 `repo_declared | loom_default`

稳定约束：

- 成熟既有仓库和 deep-existing attach path 必须优先声明 repo-owned locator，不得让 Loom 猜测文件名
- lightweight / new repository 可以显式使用 `loom_default`，但仍必须把选择写进 `repo-interface.json`
- 缺失 `code_review.md` / `spec_review.md` 时，默认 action 是声明 `loom_default`，不是自动创建 repo-owned review instruction 文件
- 不得把 `spec_review.md`、`code_review.md` 或任何 repo-specific review instruction 路径硬编码成 Loom 默认查找路径
- repo-owned instruction 应说明该仓库如何检查 behavior evidence、test evidence 与 fresh verification evidence
- `review_instruction_locators` 只定位 review instruction，不承载 review verdict、review summary、finding disposition、validation status 或 retained host action result
- missing、unreadable 或 unsafe locator 在 mature / deep-existing 仓库中必须 fail closed；轻量仓库必须显式声明 `loom_default` 才能走默认 instruction

### 4.5 `dynamic_tool_locators`

`dynamic_tool_locators` 用于声明 repo-specific 或 host-provided dynamic tool 的 declaration-time locator。它回答的是：

- Loom 应去哪里读取工具可用性声明
- 该 locator 的真实 owner 是谁
- 缺失时按 required、optional 还是 advisory 处理
- 缺失时回到哪个 Loom surface 或人工路径

它不回答：

- 工具是否在一次具体尝试中 advertised、unavailable、unsupported 或 failed
- 工具调用结果是什么
- Loom 应如何接管 host/platform/tool 的执行协议
- retained host action result 应写在哪里

`dynamic_tool_locators[*]` 固定字段：

- `id`
- `summary`
- `locator`
- `owner`
- `requirement`
- `surface`
- `fallback_to`

其中：

- `locator` 必须是仓内相对路径；绝对路径、越界或非法路径对所有 requirement 都必须 fail closed
- required locator 缺失或指向不可读路径必须 fail closed
- `owner` 只允许 `repo | repo-companion | host | host-adapter | platform | external-tool`
- `requirement` 只允许 `required | optional | advisory`
- `surface` 只允许 `admission | pre_review | review | build | merge_ready | closeout`；dynamic tool locator 额外允许 `attempt_time` 表示适用于一次执行尝试的通用 handshake availability
- `fallback_to` 只描述声明不可消费时的 Loom 回退面或人工路径，不描述工具调用

稳定约束：

- `required` 缺口进入 blocking `missing_inputs`
- `optional` / `advisory` locator 缺失或指向不可读路径只进入 `missing_optional` 或 profile-local advisory evidence，不得污染 core pass/fail
- locator 指向的 handshake declaration 若存在，只能输出 `advertised | unavailable | unsupported | failed`，并由 `tool_availability` 派生展示
- `python3 tools/loom_flow.py live-smoke dynamic-tool-availability --target <repo>` 只把这组 declaration-time locator 包装成 live smoke / release confidence evidence；它不承载 attempt-time result，不执行业务工具，也不改写 repo companion truth
- `dynamic_tool_locators` 不得承载 attempt-time result、review summary、validation status 或 retained host action result
- retained host action result locator 必须留在 [repo-interop-contract.md](./repo-interop-contract.md) 的 `host_adapters`

### 4.6 `policy_locators`

`policy_locators` 用于声明 approval / sandbox policy 的只读 locator。它回答的是：

- Loom 应去哪里读取 approval 或 sandbox policy 声明
- 该 policy 读面的真实 owner 是谁
- 缺失、冲突或 unsafe 时按 required、optional 还是 advisory 处理
- 缺失或阻断时回到哪个 Loom surface 或人工路径

它不回答：

- 宿主具体 approval policy 名称是什么
- sandbox 如何实现或如何修改
- Loom 是否应该申请权限、提升权限或改变宿主策略
- retained host action result 应写在哪里

`policy_locators[*]` 固定字段：

- `id`
- `summary`
- `policy`
- `locator`
- `owner`
- `requirement`
- `surface`
- `fallback_to`

其中：

- `policy` 只允许 `approval | sandbox`
- `locator` 必须是仓内相对路径；绝对路径、越界或非法路径对所有 requirement 都必须 fail closed
- `owner` 只允许 `repo | repo-companion | host | host-adapter | platform | external-tool`
- `requirement` 只允许 `required | optional | advisory`
- `surface` 只允许 `admission | pre_review | review | build | merge_ready | closeout`；policy locator 额外允许 `attempt_time` 表示适用于一次执行尝试的通用 policy read
- `fallback_to` 只描述声明不可消费时的 Loom 回退面或人工路径，不描述宿主权限动作

稳定约束：

- locator 指向的 policy declaration 若存在，只能输出 `declared | missing | conflict | unsafe`，并由 `policy_readiness` 派生展示
- required policy `missing` / `conflict` / `unsafe` 在 owning surface 下阻断；optional / advisory policy risk 只作为 review input 或 advisory evidence
- `policy_locators` 不得承载 host approval result、sandbox mutation、review summary、validation status 或 retained host action result
- retained host action result locator 必须留在 [repo-interop-contract.md](./repo-interop-contract.md) 的 `host_adapters`
- policy 读面细节由 [policy-read-surface.md](../harness/policy-read-surface.md) 承接

### 4.7 `hook_locators`

`hook_locators` 用于声明 lifecycle hook locator，而不是执行 hooks 或保存宿主原生 hook 文件。

它回答的是：

- Loom lifecycle hook 声明去哪里读
- 该 hook declaration 的 owner 是谁
- 缺失或 unsafe 时按 required、optional 还是 advisory 处理
- 缺失或阻断时回到哪个 Loom surface 或人工路径

它不回答：

- Codex、Claude Code 或其他宿主的原生 hook 文件长什么样
- hook 是否已经执行
- hook 执行结果是什么
- runtime state、review verdict、validation summary 或 closeout basis 应写在哪里

`hook_locators[*]` 固定字段：

- `id`
- `summary`
- `lifecycle`
- `locator`
- `owner`
- `requirement`
- `fallback_to`
- `safety`

其中：

- `lifecycle` 只允许 `before-run | after-run | cleanup`
- `locator` 必须是仓内相对路径；绝对路径、越界或非法路径对所有 requirement 都必须 fail closed
- required locator 缺失或指向不可读路径必须 fail closed
- optional / advisory locator 缺失或指向不可读路径只能进入 optional / advisory gap，不得污染 core pass/fail
- `owner` 只允许 `repo | repo-companion | host | host-adapter | platform | external-tool`
- `requirement` 只允许 `required | optional | advisory`
- `fallback_to` 只描述声明不可消费时的 Loom 回退面或人工路径，不描述宿主执行动作
- `safety` 固定声明 `path_containment`、`truth_boundary`、`cleanup_scope`、`host_trust` 与 `permission_risk`

稳定约束：

- `hook_locators` 只承接 declaration-time locator，不承接 runtime state、execution result、authored progress、review verdict、validation status、host action result 或 closeout basis
- required hook 缺少 `safety`、`host_trust: untrusted`、`permission_risk: unknown` 或 cleanup scope 越界时必须 fail closed
- host adapter 可以从 `hook_locators` 生成 Codex / Claude Code native hook config，但 generated config 不替代 Loom locator contract
- host-native hook output 只有经过 adapter 映射后才能成为 runtime evidence
- cleanup hook 始终受 [workspace-lifecycle.md](../harness/workspace-lifecycle.md) 约束；Codex cleanup 不能作为 required native hook
- lifecycle 与宿主事件映射见 [hook-locator-contract.md](../harness/hook-locator-contract.md)

### 4.7.1 `advanced_lint_locators`

`advanced_lint_locators` 用于声明 repo-owned architecture / boundary lint 的只读入口。

它回答的是：

- Loom 应去哪里读取 repo-specific architecture / boundary lint result
- 该 lint 的真实 owner 是谁
- 缺失时按 required、optional 还是 advisory 处理
- 结果属于哪个 Loom surface

它不回答：

- Loom core 应采用哪个 repo-specific 架构规则
- guardian、CI 或 review engine 应如何执行
- review、validation、merge-ready 或 closeout 已经得出什么最终结论

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

其中：

- `lint_type` 只允许 `architecture_boundary | bounded_context | legacy_access | host_state_access | companion_boundary`
- `locator` 必须是仓内相对路径；required locator 缺失或不可读必须 fail closed
- `owner` 只允许 `repo | repo-companion | host | host-adapter | platform | external-tool`
- `requirement` 只允许 `required | optional | advisory`
- `surface` 只允许 `admission | pre_review | review | build | merge_ready | closeout`
- `result_envelope_schema` 固定为 `loom-governance-lint-result/v1`

稳定约束：

- `advanced_lint_locators` 只定位 lint result envelope，不承载 lint verdict 本身之外的运行态
- locator payload 不得承载 `runtime_state`、`review_verdict`、`validation_status`、`merge_result`、`closeout_result`、`guardian_verdict`、`host_action_result` 或 `final_verdict`
- repo-specific architecture rule name 不得被提升为 Loom core taxonomy；Loom core 只消费 result envelope、provenance、freshness 与 surface enforcement

### 4.8 `release_targets`

`release_targets` 用于声明目标仓库自己的 release / version 真相入口。

默认 adoption 不生成或声明 `release_targets`。只有目标仓库已有明确的 release target truth，并且接入决策显式要求暴露这组 repo-owned / host-owned locator 时，才写入本 section。

它回答的是：

- 目标仓库 release target catalog 去哪里读
- 当前正在准备或收口的 target release 去哪里读
- 这组 release truth 缺失时按 blocking 还是 advisory 处理
- 若仓库已产出 repo-owned derived status，可从哪里读取

它不回答：

- Loom 自己的 installer / plugin / runtime version 是什么
- release closeout 已经得出了什么最终结论
- GitHub Release、tag、package manager 或 deployment system 应如何被 Loom 接管
- `Work Item`、review record、merge checkpoint 或 closeout basis 写在哪里

`release_targets` 固定字段：

- `catalog_locator`
- `current_target_locator`
- `enforcement`
- `status_locator` 可选

其中：

- `catalog_locator` 必须指向仓内可读路径，承接 repo-owned target release catalog
- `current_target_locator` 必须指向仓内可读路径，承接当前 active target release object
- `enforcement` 只允许 `blocking | advisory`
- `status_locator` 若存在，必须指向仓内可读路径，只能承接 repo-owned derived release status，不替代 Loom 的派生 status surface

稳定约束：

- `catalog_locator` 与 `current_target_locator` 只允许使用仓内相对路径；绝对路径、越界或不可读路径必须 fail closed
- 缺省状态必须视为 `availability: absent` / `target_release.result: not_applicable`，不得生成 `bootstrap-v0.1.0`、空 release 或示例 release truth
- target release object 必须与 Loom distribution version authority 分离；不得把 installer version、plugin version、runtime version、schema version 或 `VERSION` 回写成 target release truth
- target release object 可以消费 `Phase` / `FR` / `Work Item` / `PR` / `merge commit` locator，但不得让 target release 直接成为执行入口
- `status_locator` 若缺失，Loom 仍应从 authored target release object 与 delivery chain 派生自己的 target release status summary
- `release_targets` 不得承载 release verdict、review summary、validation status、host action result 或 scheduler state

### 4.9 `metadata_contract`

`metadata_contract` 用于声明 repo-specific metadata block 的 locator contract，而不是把这些字段抬升为 Loom core 默认字段或通用 schema。

它回答的是：

- 这组 repo-specific metadata 在什么条件下适用
- 真正的权威承载面位于哪里
- Loom 应按什么阻断强度消费它

它不回答：

- Loom 运行时当前处于什么状态
- review / validation / merge / closeout 已经得出了什么结论
- retained host action 的结果是什么
- 跨仓默认应统一使用哪些字段名

换句话说，`metadata_contract.fields[*]` 是 locator-first 的“这组 repo-local metadata 去哪里读、何时读、按什么强度读”，不是“Loom core 现在认可哪些 metadata 字段名”的总表。

`metadata_contract.fields[*]` 固定字段：

- `id`
- `summary`
- `applicability_locator`
- `authority_locator`
- `enforcement`
- `machine_carrier` 可选

其中：

- `applicability_locator` 指向“何时需要这组 metadata”的 companion 或 repo-local 权威说明
- `authority_locator` 指向 metadata 真正承载的 repo-native carrier、模板或权威入口
- `enforcement` 只允许 `blocking | advisory`
- `machine_carrier` 只声明机器读取合同，不声明 repo-specific 字段语义

当前已被样本证明有价值、但仍保持 repo-specific example 的字段族包括：

- `integration_check`
- `gate_applicability`
- `live_evidence_record`

稳定约束：

- 这些名字可以作为 repo-specific metadata block example 出现在 companion 合同中
- 它们不得被回写成 Loom core 默认字段名
- Loom 不为它们提供跨仓统一 taxonomy 承诺

### 4.9.1 `machine_carrier`

当 repo-specific PR metadata 会被 review、PR gate、merge-ready 或 closeout 前置动作机器消费时，`metadata_contract.fields[*].machine_carrier` 必须提供稳定 carrier 合同，避免强门禁依赖自由 Markdown 展示层。

当前稳定支持的最小 carrier 是 PR body HTML comment JSON：

```json
{
  "type": "pr_body_html_comment_json",
  "schema_version": "loom-repo-pr-metadata/v1",
  "carrier_id": "repo-pr-body-machine-block",
  "marker": "loom:repo-pr-metadata",
  "surface": "merge_ready",
  "repo_specific_field_set": ["contract_surface"],
  "authority_locator": ".github/PULL_REQUEST_TEMPLATE.md#loom-repo-pr-metadata",
  "applicability_locator": ".loom/companion/README.md#pr-metadata",
  "enforcement": "blocking",
  "preflight": {
    "required_before": ["review", "merge_ready"],
    "failure_mode": "blocking",
    "command_locator": ".loom/companion/pr-metadata-preflight.md"
  },
  "diagnostics": {
    "block_locator": true,
    "parse_error": true,
    "missing_fields": true,
    "expected_format": true,
    "suggested_fix": true
  },
  "migration_mode": "advisory_legacy"
}
```

`machine_carrier` 固定字段：

- `type` 目前只允许 `pr_body_html_comment_json`
- `schema_version` 固定为 `loom-repo-pr-metadata/v1`
- `carrier_id` 是 repo companion 内稳定的 carrier 名称，用于诊断与迁移回链
- `marker` 是 HTML comment marker，例如 `loom:repo-pr-metadata`
- `surface` 是 carrier 服务的 Loom surface，例如 `review` / `merge_ready` / `closeout`
- `repo_specific_field_set` 是 repo-specific 字段名列表，只由目标仓库声明
- `authority_locator` 指向 machine carrier 的权威模板、artifact 或 host/project field declaration
- `applicability_locator` 指向何时需要该 carrier 的 repo-owned 说明
- `enforcement` 只允许 `blocking | advisory`
- `preflight.required_before` 只允许 `review` / `merge_ready`
- `preflight.failure_mode` 只允许 `blocking | advisory`
- `preflight.command_locator` 必须指向仓内可读路径
- `diagnostics.*` 必须显式要求 `block_locator`、`parse_error`、`missing_fields`、`expected_format`、`suggested_fix`
- `migration_mode` 只允许 `advisory_legacy | dual_read | required`，缺省等同 `advisory_legacy`

`type` 当前稳定支持 `pr_body_html_comment_json`，但合同允许 repo companion 在不改写 Loom core taxonomy 的前提下声明以下 carrier 形态：

- HTML comment 内 JSON/YAML
- Loom 管理的 fenced machine block
- 独立 artifact locator
- repo-declared host/project field locator

PR body 中的 machine block 格式固定为：

```markdown
<!-- loom:repo-pr-metadata
{
  "schema_version": "loom-repo-pr-metadata/v1",
  "carrier_id": "repo-pr-body-machine-block",
  "metadata_contract_id": "integration_check",
  "surface": "merge_ready",
  "fields": {
    "contract_surface": "checked"
  },
  "source": {
    "source_range_or_hash": "sha256-or-repo-renderer-hash"
  },
  "parser_version": "repo-parser/v1"
}
-->
```

稳定约束：

- PR body 的 Summary / Validation / Risks / Related Work 仍是人类展示层，不是 repo-specific metadata 的机器真相
- parser 必须优先读取 HTML comment JSON machine block，不得从自由 Markdown 列表、标题或自然语言中推断 required fields
- parser、PR body renderer 或 CLI 输出只能证明 carrier 可读性与诊断结果；它们不得替代 Work Item、review record、merge-ready verdict、closeout truth 或 docs/source truth
- renderer / edit 流程必须优先使用 body-file artifact：写入前校验 rendered body，`gh pr edit --body-file` 写入后再读回 PR body，并用 preflight 比对 rendered/readback machine block 的 locator/hash；shell command substitution 不得作为推荐更新路径
- block 存在但 JSON 不可解析、schema 不匹配、surface 不匹配或 required field 缺失时必须 fail closed，并返回 block locator、parse error、missing fields、expected format 与 suggested fix
- block 缺失时按 `migration_mode` 处理：`required` 阻断；`advisory_legacy` 与 `dual_read` 不让旧 PR 批量失效，但必须在 preflight 输出中暴露 legacy/advisory 状态
- `repo_specific_field_set` 中不得声明 `guardian_verdict`、`ruleset_result`、`host_action_result`、`review_decision`、`validation_status`、`closeout_result` 等 retained host action 或 Loom-authored truth 字段
- `command_locator` 是 preflight 命令或说明的 repo-owned locator；它不能越界、不能指向宿主动作结果，也不能承载当前 run 的 parser verdict

### 4.9.2 明确禁止上移的字段模式

`metadata_contract` 不得承接以下字段模式：

- runtime state
  - 例如 `runtime_state`、`current_lane`、`run_entry`、`logs_entry`、`diagnostics_entry`、`verification_entry`
- authored execution state
  - 例如 `current_stop`、`next_step`、`blockers`、`latest_validation_summary`
- review summary / review verdict
  - 例如 `review_summary`、`review_decision`、`reviewed_validation_summary`
- validation / merge / closeout status
  - 例如 `validation_status`、`merge_verdict`、`closeout_result`
- retained host action result
  - 例如 `guardian_verdict`、`ruleset_result`、`host_action_result`

这些字段模式分别属于：

- `harness/` 与 recovery / status carriers
- review record 与 closeout 合同
- companion-owned `interop.json`

它们不能因为“看起来像 metadata”就被回塞到 `repo-interface.json`。

### 4.9.3 与 `context_schema` 的边界

`metadata_contract` 与 `context_schema` 的分工固定如下：

- `metadata_contract`
  - 声明 repo-local metadata block 的适用条件、权威入口与阻断强度
- `context_schema`
  - 声明 Loom 运行某个 surface 时必须提供哪些 repo-specific 上下文字段

明确禁止事项：

- 不得在 `metadata_contract` 中声明 `issue`、`item_key`、`release`、`sprint`、`guardian_lane` 这类调用上下文字段
- 不得在 `context_schema` 中伪装声明 repo-native metadata block 的 authority locator
- 不得把同一字段同时当作“必传上下文字段”和“repo-local metadata result 字段”写成单一 Loom core 默认概念

### 4.9.4 与 `interop.json` 的边界

`metadata_contract` 不得声明以下 locator：

- retained host action result 的 locator
- repo-native carrier truth 的 locator
- `shadow parity` compare surface 的 locator
- external-runtime locator、runtime version、fallback runtime 或 de-vendor rollback mode

这些入口固定属于 [repo-interop-contract.md](./repo-interop-contract.md)。
external-runtime 迁移路径固定属于 [external-runtime-companion-contract.md](./external-runtime-companion-contract.md)。

明确禁止事项：

- 不得把 guardian / integration / ruleset / merge-native verdict 的结果 locator 写进 `metadata_contract`
- 不得把 `shadow_surfaces` 的 `loom_locator` / `repo_locator` 回塞到 `repo-interface.json`
- 不得把 `blocking ownership`、`override path`、`authority-of-truth` 写成 `metadata_contract` 字段
- 不得把 external-runtime 的 runtime locator 或 rollback switch 写进 `repo-interface.json`

### 4.10 `context_schema`

`context_schema` 用于声明 repo-specific required context fields 与映射规则，不暗含单一 Loom 通用字段模型。

`context_schema.fields[*]` 固定字段：

- `id`
- `summary`
- `type`
- `required`
- `mapping_rule_locator`

其中：

- `type` 只允许基础类型：`string | integer | number | boolean`
- `required` 必须是布尔值
- `mapping_rule_locator` 指向仓库如何把宿主上下文映射到该字段的权威说明

### 4.11 纪律重申

无论 `v1` 或 `v2`，以下纪律保持不变：

- `manifest.json` 仍 locator-only
- `repo-interface.json` 仍不承载运行态、review summary、current stop、validation status 或 host action result
- `review_instruction_locators` 只承接 repo-owned review instruction 入口，不得承接 review disposition 或 review result
- `dynamic_tool_locators` 只承接 dynamic tool availability locator，不得承接 attempt-time result 或 host action result
- `policy_locators` 只承接 approval / sandbox policy read locator，不得承接权限请求、sandbox mutation 或 host action result
- `release_targets` 只承接目标仓库 release/version authored truth locator，不得承接 release verdict、closeout result 或 host action result
- `metadata_contract` 仍只是 repo-specific metadata block 的 locator contract，不定义 Loom core 默认 taxonomy
- repo-specific 规则仍通过 companion 合同挂接，不得伪装成 Loom core 默认规则
- host adapter / repo-native carrier / shadow parity 入口继续留在独立的 `interop.json`，不得回塞到 `repo-interface.json`

## 5. 读面语义

`governance_surface.repo_interface` 当前只允许暴露以下四类 availability 状态，并可派生 `tool_availability` 与 `policy_readiness` 子读面：

- `absent`
  - 仓库没有 `repo companion` manifest
- `companion_docs_only`
  - 仓库有旧式 companion docs，但没有稳定机读 manifest
- `incomplete`
  - manifest 或 repo-interface 存在，但 locator / schema / required surface 不完整
- `present`
  - manifest 与 repo-interface 都可读且满足最小合同

稳定约束：

- `companion_docs_only` 不得被伪装成稳定 repo interface
- `incomplete` 必须显式报缺口，不得猜测 requirements
- `present` 只表示接口可读，不表示 repo-specific requirements 已被 Loom core 满足

## 6. 与从属合同的关系

`repo companion` 是仓库级 adoption 主合同。

agent-assisted adoption 的读、判断、回写与验证闭环由 [zero-friction-adoption-contract.md](./zero-friction-adoption-contract.md) 承接。该从属合同只能消费本文件已经冻结的 manifest、`repo-interface.json`、metadata/context 与 ownership 边界，不得把 companion 扩成运行态真相源。

若后续需要 companion-oriented workflow 或 migration 文档：

- 只能作为从属合同
- 只能消费本文件已经冻结的边界
- 不得反向扩张为 Loom 全局 issue-model 或 parent/sub-issue 默认规则

## 7. repo-specific lint 边界

repo-specific lint 规则属于 repo companion 的仓库级声明边界，不属于 Loom core 默认规则。

repo companion 可以声明目标仓库自己的 lint / operating rule 入口，但只能表达：

- lint 规则从哪里读
- 该规则属于哪个 owner
- 缺失或失败时按 blocking、optional 还是 advisory 消费
- 结果由哪个 Loom surface 消费
- 声明不可消费时回到哪个 Loom surface 或人工路径

稳定约束：

- Loom core 不得硬编码 repo-specific lint 名称、路径、CI job、guardian 名称或仓库架构规则
- repo-specific lint result 只能作为 [governance-lint-taxonomy.md](../harness/governance-lint-taxonomy.md) 定义的 derived evidence 被消费
- required repo-specific lint locator 缺失或不可读时，只能在声明的 owning surface 下 fail closed
- optional / advisory repo-specific lint 缺失或不可读只进入 advisory evidence，不污染 core pass/fail
- repo-specific lint 不得承载 Work Item、recovery 进度、review verdict、validation status、merge verdict、closeout result 或 retained host action result
- 若 repo-specific lint 发现 core 边界被破坏，应映射到 core lint failure，例如 `companion_boundary_bypass` 或 `core_hardcoding_leak`
