# Repo Interop Contract

本文冻结 Loom 面向成熟既有仓库的 `repo interop` 主合同。

它承接的是 companion-owned 的只读消费面，而不是新的宿主执行层。

## 1. 目标与边界

`.loom/companion/interop.json` 用于声明三类只读入口：

- retained host action result 的读取入口
- repo-native carrier / evidence / truth 的读取入口
- `shadow mode` parity compare 的读取入口

它不承接：

- branch / PR / worktree / merge 的执行命令
- repo runtime state、review summary、validation status
- spec review / implementation review instruction locator
- host action result 的 authored 真相副本
- dynamic tool availability locator
- approval / sandbox policy read locator
- 新的 blocking merge gate

换句话说，`interop.json` 只告诉 Loom “去哪里读”，不告诉 Loom “如何替宿主执行”。

review instruction locator 属于 [repo-companion-contract.md](./repo-companion-contract.md) 的 `review_instruction_locators`，因为它定位的是 repo-owned review rule 入口，不是 retained host action result、repo-native carrier 或 shadow parity evidence。

dynamic tool availability locator 属于 [repo-companion-contract.md](./repo-companion-contract.md) 的 `dynamic_tool_locators`，因为它定位的是工具声明入口，不是 retained host action result。
approval / sandbox policy read locator 属于 [repo-companion-contract.md](./repo-companion-contract.md) 的 `policy_locators`，因为它定位的是 policy 声明入口，不是权限请求结果、sandbox mutation 或 retained host action result。

`interop.json` 中声明的入口在 fact-chain 中只能被消费为 host/control-plane mirror、retained result、repo-native carrier locator 或 locator provenance。它不得成为新的 Loom-authored truth，也不得覆盖 `Work Item`、恢复主入口、review record、merge checkpoint 或 closeout basis。

## 2. `.loom/companion/interop.json`

当前稳定 schema：

```json
{
  "schema_version": "loom-repo-interop/v1",
  "host_adapters": [],
  "repo_native_carriers": [],
  "shadow_surfaces": {
    "admission": {
      "summary": "Compare admission parity between Loom and the repo-native result.",
      "loom_locator": ".loom/shadow/admission-loom.json",
      "repo_locator": ".loom/shadow/admission-repo.json"
    },
    "review": {
      "summary": "Compare review parity between Loom and the repo-native result.",
      "loom_locator": ".loom/shadow/review-loom.json",
      "repo_locator": ".loom/shadow/review-repo.json"
    },
    "merge_ready": {
      "summary": "Compare merge-ready parity between Loom and the repo-native result.",
      "loom_locator": ".loom/shadow/merge-ready-loom.json",
      "repo_locator": ".loom/shadow/merge-ready-repo.json"
    },
    "closeout": {
      "summary": "Compare closeout parity between Loom and the repo-native result.",
      "loom_locator": ".loom/shadow/closeout-loom.json",
      "repo_locator": ".loom/shadow/closeout-repo.json"
    }
  }
}
```

顶层字段约束：

- `schema_version` 固定为 `loom-repo-interop/v1`
- `host_adapters` 必须存在，可为空数组
- `repo_native_carriers` 必须存在，可为空数组
- `shadow_surfaces` 必须同时声明 `admission`、`review`、`merge_ready`、`closeout`

## 3. `host_adapters`

`host_adapters[*]` 固定字段：

- `id`
- `summary`
- `surfaces`
- `locator`
- `owner`
- `requirement`
- `fallback_to`

其中：

- `surfaces` 必须是非空数组
- `surfaces[*]` 只允许 `admission | pre_review | review | build | merge_ready | closeout`
- `locator` 只描述 Loom 如何读取 retained host action 的结果，不描述如何执行动作本身
- `owner` 只允许 `repo | repo-companion | host | host-adapter | platform | external-tool`
- `requirement` 只允许 `required | optional | advisory`
- `fallback_to` 只描述声明不可消费时回到哪个 Loom surface 或人工路径
- 读取结果必须作为 retained result 消费，并保留原始 locator、绑定对象与 fresh/stale 判断
- locator 绝对路径、越界或非法路径对所有 requirement 都必须 fail closed
- `required` locator 缺失或指向不可读路径必须 fail closed
- `optional` / `advisory` locator 缺失或指向不可读路径只能进入 `missing_optional` 或 profile-local advisory evidence，不得污染 core pass/fail
- `host_adapters` 不定义 attempt-time advertised / unavailable / unsupported / failed 结果，也不调用宿主动作

`python3 tools/loom_flow.py live-smoke host-adapter-drift --target <repo>` 只在 adopted repo 上读取这组 `host_adapters[*]` 声明及其 locator 指向的 retained result envelope，用来回答：

- 该仓库是否声明了可消费的 retained host action 读面
- locator 是否缺失、不可读、越界或 unsafe
- envelope 是否暴露 `permission_unavailable` 或 `host_adapter_version` 漂移

它仍然属于 `orchestration-live` / profile-local evidence：

- 不执行 host action
- 不写宿主控制面
- 不改写 `interop.json`
- 不把 optional / advisory host adapter drift 升级成 `orchestration-core` blocker
- `required` drift 只在该 live/profile-local 命令内返回 `block`

典型对象包括：

- guardian verdict
- integration contract verdict
- repo settings / ruleset verdict
- repo-native merge readiness verdict

## 4. `repo_native_carriers`

`repo_native_carriers[*]` 固定字段：

- `id`
- `summary`
- `surfaces`
- `locator`
- `owner`
- `requirement`
- `fallback_to`

其中：

- `locator` 可以指向 repo-native truth / evidence 目录、文件或生成结果
- `owner` 只允许 `repo | repo-companion | host | host-adapter | platform | external-tool`
- `requirement` 只允许 `required | optional | advisory`
- `fallback_to` 只描述声明不可消费时回到哪个 Loom surface 或人工路径
- 这些 carrier 继续保留为仓库原生真相，不要求先迁成 Loom carrier
- 若 repo-native carrier 与 Loom authored truth 表达同一事实，Loom 不自动选择 repo-native 值；该差异只能进入 provenance / drift / parity 结果
- repo-native carrier 不会因为被 `interop.json` 声明就自动变成 host/control-plane mirror；除非另有权威合同声明，它只是只读 locator 或 retained result 来源
- locator 绝对路径、越界或非法路径对所有 requirement 都必须 fail closed
- `required` locator 缺失或指向不可读路径必须 fail closed
- `optional` / `advisory` locator 缺失或指向不可读路径只能进入 `missing_optional` 或 profile-local advisory evidence，不得污染 core pass/fail

典型对象包括：

- exec-plan 目录
- governance status 输出
- integration contract 输出
- repo-native evidence ledger

## 5. `shadow_surfaces`

`shadow_surfaces` 当前只承接四个固定比对面：

- `admission`
- `review`
- `merge_ready`
- `closeout`

每个 surface 固定字段：

- `summary`
- `loom_locator`
- `repo_locator`

稳定约束：

- parity compare 结果只允许 `match | mismatch | unreadable`
- 默认 `shadow mode` 在本树内只做 validation / parity，不直接成为 merge gate
- 只有显式 `blocking` 消费模式可以把 `mismatch` / `unreadable` 升级为阻断结果
- `shadow_surfaces` 只描述比对入口，不声明“哪一方自动获胜”
- `loom_locator` 与 `repo_locator` 必须指向 shadow evidence envelope，而不是裸状态值
- `shadow_surfaces` 输出不得被消费为 authored truth；它只证明派生读面或 repo-native carrier 是否同源、可读、可比较

### 5.1 shadow evidence envelope

每个 shadow evidence JSON 必须包含：

- `source_files`
- `source_sha256`
- 一个可比较值字段：`parity_value | result | decision | status | verdict | value`

`source_files` 必须是非空数组，且只允许仓库内相对路径。`source_sha256` 必须以相同 key set 记录这些 source file 的 sha256。

示例：

```json
{
  "result": "pass",
  "source_files": ["native/status/review.json"],
  "source_sha256": {
    "native/status/review.json": "..."
  }
}
```

运行时必须校验：

- source 文件存在且不是目录
- source 路径不得是绝对路径，不得越出仓库
- `source_files` 与 `source_sha256` key set 完全一致
- sha256 必须匹配当前文件内容
- `.loom/shadow/*.json` 中除 `.loom/shadow/shadow-parity.json` 外，只允许被 `shadow_surfaces` 显式声明

任一条件失败时，对应 surface 必须进入 `unreadable`，blocking 模式下升级为 `block`。

若 envelope 可读但 `source_sha256` 对应的源文件已不再匹配当前消费对象，结果必须视为 stale retained result 或 stale carrier evidence，不得作为 fresh verification evidence。

### 5.2 blocking 消费模式

`interop.json` 仍然只描述读取入口。它不得承载 blocking owner、override decision 或 final verdict。

若 strong governance profile 显式启用 blocking 消费，启用点必须在 `interop.json` 之外声明：

- owner
- fallback
- override path
- authority-of-truth
- live evidence

默认命令仍是 validation-only：

```bash
python3 tools/loom_flow.py shadow-parity --target <repo>
```

blocking 模式必须显式开启：

```bash
python3 tools/loom_flow.py shadow-parity --target <repo> --blocking
```

blocking 模式只改变消费结果，不改变 `shadow_surfaces` schema：

- `match` -> `pass`
- `mismatch` -> `block`
- `unreadable` -> `block`

### 5.2 从默认 validation-only 升级前必须满足的证据标准

要讨论是否从 validation-only 升级到更强治理面，必须同时满足以下条件：

1. 至少两个新增的 live adopted repo
   - 不得只重复消费当前下游基线样本表述
2. 每个样本都提供版本化 parity 记录
   - 至少覆盖 `admission`
   - `review`
   - `merge_ready`
   - `closeout`
3. `mismatch` 必须能稳定分型
   - 至少区分：
     - contract drift
     - surface unreadable
     - Loom bug
     - repo-native lag
4. 必须证明更强 gate 的收益
   - 也就是自动升级后能减少真实错误放行
   - 同时不会制造不可接受的误阻断
5. blocking ownership、override path、authority-of-truth 必须落在 `interop.json` 之外的权威合同
   - 例如 host action、closeout gate、review / checkpoint 合同

只要以上任一条件未满足，`shadow parity` 就不得成为默认 blocking gate。

### 5.3 当前明确不做

在本树当前阶段，明确不做以下升级：

- 不把 `mismatch` 默认视为 blocking merge gate
- 不把 `unreadable` 视为 repo-native 失败或 Loom 自动获胜
- 不在 `interop.json` 中声明 blocking owner、override decision 或 final verdict
- 不要求 `shadow parity` 代替 review、merge-ready 或 closeout 的正式 authority-of-truth

## 6. 与其他合同的关系

- `repo-interface.json`
  - 承接 repo-specific rules、requirements、typed gates、metadata/context contract
- `interop.json`
  - 承接 retained host action result、repo-native carrier 与 shadow parity 的只读入口
- [zero-friction-adoption-contract.md](./zero-friction-adoption-contract.md)
  - 承接 agent-assisted adoption 中生成或更新 `interop.json` 的读、判断、回写与验证闭环
- [external-runtime-companion-contract.md](./external-runtime-companion-contract.md)
  - 承接从 vendored `.loom/bin` 到 versioned external Loom runtime 的迁移路径
- [host-action-contract.md](../harness/host-action-contract.md)
  - 承接宿主动作 ownership、结果语义与 fallback discipline

纪律重申：

- 不把 interop 细节塞回 `repo-interface.json`
- 不让 `interop.json` 承载运行态或 authored state
- 不让 `interop.json` 承载 status control plane 的结论或 runtime_state
- 不让 `interop.json` 承载 spec review / implementation review instruction locator；这些 locator 必须通过 `repo-interface.json` 的 `review_instruction_locators` 声明
- 不让 `interop.json` 承载 dynamic tool availability locator；这些 locator 必须通过 `repo-interface.json` 的 `dynamic_tool_locators` 声明
- 不让 `interop.json` 承载 approval / sandbox policy read locator；这些 locator 必须通过 `repo-interface.json` 的 `policy_locators` 声明
- 不让 `interop.json` 承载 external-runtime locator、runtime version、rollback mode 或 runtime provenance
- 不让 Loom 因为读取了 interop contract，就接管宿主底层实现
- 不让 `interop.json` 定义 blocking owner、override path 或 final merge authority
- 不让 zero-friction adoption 把 validation-only shadow parity 自动升级成 blocking gate

## 7. 与 external-runtime / de-vendor migration 的边界

external-runtime 迁移只改变 Loom runtime 的执行来源，不改变 interop 读取的 repo-native truth。

稳定约束：

- `.loom/companion/interop.json` 在 vendored runtime 与 external runtime 下必须保持同一只读 locator 语义
- `host_adapters`、`repo_native_carriers`、`shadow_surfaces` 不得因为 runtime locator 改变而改写 truth
- shadow evidence envelope 的 `source_files` 与 `source_sha256` 必须继续以仓内文件为 authority
- external-runtime locator 必须落在 [external-runtime-companion-contract.md](./external-runtime-companion-contract.md)，不得写入 `interop.json`
- de-vendor 后的失败回滚必须回到 vendored `.loom/bin` 或重新 bootstrap，不得通过篡改 interop 结果伪装通过
