# Host Action Contract

本文件定义 Loom 当前已冻结的宿主动作合同。

本文件当前承接：

- `#167`

它只收口三件事：

- 哪些现有入口属于 Loom 的宿主动作面
- 每类入口允许返回什么结果，以及 `fallback_to` 指向哪里
- Loom 与宿主平台各自拥有哪部分动作，不新增新的宿主产品或自动化层

它同时冻结 v0.7 的 dynamic tool availability / host action declaration 边界：

- 只声明 locator、owner、requirement、surface、fallback_to 与 fail-closed 强度
- attempt-time advertised / unavailable / unsupported / failed 结果词表由 [dynamic-tool-handshake.md](./dynamic-tool-handshake.md) 承接
- 不让 Loom 接管 host、platform 或 external tool 的 ownership

## 1. 能力定位

Loom 的宿主动作面不是新的 umbrella CLI，也不是宿主平台替身。

它是 Loom 对现有 host-facing actions 的统一合同层，用来把以下能力收成同一组结果语义：

- 宿主对象边界读取
- 宿主 gate / required checks / merge controls 的放行消费
- post-merge 的 drift 审计与控制面对齐

当成熟既有仓库需要把 retained host action result 暴露给 Loom 时：

- 结果 locator 通过 companion-owned `.loom/companion/interop.json` 声明
- Loom 只消费这些结果，不接管动作执行本身
- `python3 tools/loom_flow.py live-smoke host-adapter-drift --target <repo>` 只读取这组 locator 与 retained result envelope，产出 profile-local drift evidence；它不是新的 host-facing action，也不扩展本文件的顶层结果词表

当成熟既有仓库需要声明 dynamic tool availability 时：

- 工具 locator 通过 companion-owned `.loom/companion/repo-interface.json` 的 `dynamic_tool_locators` 声明
- Loom 只校验 locator 是否可消费，不调用工具、不探测运行时可用性、不写入尝试结果

当成熟既有仓库需要声明 approval / sandbox policy 读面时：

- policy locator 通过 companion-owned `.loom/companion/repo-interface.json` 的 `policy_locators` 声明
- host adapter 持有宿主具体 policy 名称、权限请求、sandbox 实现与执行细节
- Loom 只消费抽象 `declared | missing | conflict | unsafe` 结果与 risk summary，不申请权限、不修改 sandbox、不写 host result

具体专题落点仍保持拆分：

- 对象 ownership 边界见 [host-lifecycle-boundary.md](./host-lifecycle-boundary.md)
- merge 前放行细节见 [merge-checkpoint.md](./merge-checkpoint.md)
- 自动检查与 required checks 读面见 [automation-frontload.md](./automation-frontload.md)
- drift taxonomy 见 [reconciliation-audit.md](./reconciliation-audit.md)
- closeout 检查与 sync 顺序见 [closeout-gate.md](./closeout-gate.md)
- approval / sandbox policy 读面见 [policy-read-surface.md](./policy-read-surface.md)
- structured event evidence 见 [structured-event-evidence.md](./structured-event-evidence.md)

## 2. 覆盖范围

当前冻结的宿主动作只包括现有入口：

| 类别 | 稳定入口 | 宿主写入 | 说明 |
| --- | --- | --- | --- |
| boundary read | `python3 tools/loom_flow.py host-lifecycle --target <repo> [--item <id>]` | 否 | 读取 workspace / branch / PR / git worktree 的 ownership boundary |
| merge control read | `python3 tools/loom_flow.py checkpoint merge --target <repo> [--item <id>]` | 否 | 读取 Loom 对 required checks / validation / review / risk rollback 的放行结论 |
| merge control summary | `python3 tools/loom_flow.py flow merge-ready --target <repo> [--item <id>]` | 否 | 汇总进入 host merge 前的统一放行摘要 |
| drift audit | `python3 tools/loom_flow.py reconciliation audit --target <repo> [--issue <n>] [--pr <n>] [--project <n>]` | 否 | 只读 issue / PR / project 控制面并输出 drift findings |
| control-plane sync | `python3 tools/loom_flow.py reconciliation sync --target <repo> [--issue <n>] [--pr <n>] [--project <n>] [--comment-file <path>] [--dry-run]` | 是 | 只修机械可证明的 reconciliation drift |
| closeout check | `python3 tools/loom_flow.py closeout check --target <repo> [--issue <n>] [--pr <n>] [--project <n>]` | 否 | 校验 main、issue、PR、project 与仓内结果是否一致 |
| closeout sync | `python3 tools/loom_flow.py closeout sync --target <repo> [--issue <n>] [--pr <n>] [--project <n>]` | 是 | 在可同步条件下继续做 closeout 控制面对齐 |

以下内容继续明确排除在 Loom 宿主动作面之外：

- branch create / rename / retire
- PR create / update / merge / close
- git worktree create / remove
- CI 产品实现、required checks 配置界面、merge button 与 ruleset 细节

## 3. 统一输出面

宿主动作沿用 Loom 既有 JSON 输出骨架，不新增第二套结果对象：

- `command`
- `operation`（若该入口有子动作）
- `result`
- `summary`
- `missing_inputs`
- `fallback_to`

某些入口会额外带上专题字段，例如：

- `host-lifecycle.objects`
- `reconciliation.findings`
- `closeout.reconciliation`
- `flow merge-ready` / `checkpoint merge` 的放行细节

这些专题字段可以扩展，但不得绕过本文件定义的结果纪律。

## 4. 结果与 `fallback_to` 纪律

宿主动作当前冻结以下结果集合：

| 入口 | 允许结果 | `fallback_to` 纪律 |
| --- | --- | --- |
| `host-lifecycle` | `pass` / `block` | 只在事实链无法读取时回到 `admission`；正常边界读取不产生 `fallback` 结果 |
| `checkpoint merge` | `pass` / `block` / `fallback` | `fallback_to` 只能指向 Loom 内部 checkpoint，不得指向宿主控制面动作 |
| `flow merge-ready` | `pass` / `block` / `fallback` | `fallback_to` 只能指向 Loom 内部 checkpoint 摘要，不得把 host merge 伪装成回退目标 |
| `reconciliation audit` | `pass` / `warn` / `fix-needed` / `block` | 非 `pass` 时只允许 `manual-reconciliation` 或 `null`；它负责报 drift，不把 drift 伪装成 `fallback` |
| `reconciliation sync` | `pass` / `block` | `block` 时只允许指向 `manual-reconciliation` 或 `null`；`--dry-run` 也不得把未解决 drift 伪装成通过 |
| `closeout check` | `pass` / `block` | 普通 closeout 缺口指向 `merge`；若 reconciliation 为 `fix-needed` 必须指向 `reconciliation-sync`；若 reconciliation 为 `block` 必须指向 `manual-reconciliation` |
| `closeout sync` | `pass` / `block` | 不得绕过 reconciliation；若同步前置未满足或同步后仍未对齐，指向 `reconciliation-sync` 或 `manual-reconciliation`；其他 closeout 缺口继续指向 `merge` |

补充纪律：

- `fallback` 结果只用于 Loom 内部前序 checkpoint / flow 的回退，不用于 closeout 或 reconciliation
- `warn` 与 `fix-needed` 只作为 `reconciliation audit` 的顶层结果存在
- `fallback_to` 是下一步去向，不等价于把 `result` 改写成 `fallback`
- 宿主动作不得把 branch / PR / worktree 的真实生命周期命令当作 `fallback_to`

## 5. Dynamic Tool 与 Host Action Locator

v0.7 只冻结 declaration-time locator contract。

每个 dynamic tool 或 retained host action locator 必须声明：

- `id`
- `summary`
- `locator`
- `owner`
- `requirement`
- `surface`
- `fallback_to`

字段纪律：

- `owner` 只描述真实拥有者，可为 `repo`、`repo-companion`、`host`、`host-adapter`、`platform` 或 `external-tool`
- `requirement` 只允许 `required | optional | advisory`
- `surface` 只允许 `admission | pre_review | review | build | merge_ready | closeout`
- `fallback_to` 只描述声明不可消费时回到哪个 Loom surface 或人工路径，不描述如何调用工具

消费纪律：

- locator 绝对路径、越界或非法路径对所有 requirement 都必须 fail closed，进入 blocking `missing_inputs`
- `required` locator 缺失或指向不可读路径必须 fail closed，进入对应 surface 的 blocking `missing_inputs`
- `optional` / `advisory` locator 缺失或指向不可读路径只能进入 profile-local `missing_optional` / advisory evidence，不得污染 core pass/fail
- locator 校验不得执行宿主动作、不得调用 dynamic tool、不得写 attempt-time result
- retained host action result locator 留在 `.loom/companion/interop.json`
- dynamic tool availability locator 留在 `.loom/companion/repo-interface.json`
- approval / sandbox policy read locator 留在 `.loom/companion/repo-interface.json`

明确排除：

- 不定义 advertised / unavailable / unsupported / failed 等尝试期结果
- 不在 Loom core 中定义 host/platform 的调用协议
- 不定义宿主 approval policy 名称、sandbox 配置项或权限提升动作
- 不把 optional/advisory 缺口升级成普通 PR blocking gate
- 不把 structured event evidence 提升为 issue、tracker、recovery 或 scheduler 的 authored truth

## 6. Ownership Boundary

Loom 当前承接：

- workspace execution semantics
- required checks / validation / review / risk rollback 的放行消费
- 对宿主对象绑定、drift 与 absorbed 结论的读取和校验
- closeout 前后的控制面对齐判断

宿主平台当前承接：

- branch / PR / git worktree 的真实生命周期动作
- 实际 merge / close / status UI 与策略
- CI 产品实现与 required checks 配置机制

因此，Loom 可以报告、消费、阻断或要求回退，但不会在这里扩展成新的宿主自动化产品。

## 7. 专题文件分工

- [host-lifecycle-boundary.md](./host-lifecycle-boundary.md)
  - 只定义 workspace、branch、PR、git worktree 的 ownership boundary
- [merge-checkpoint.md](./merge-checkpoint.md)
  - 只定义 merge control 的执行侧放行输入、结果与回退承接
- [automation-frontload.md](./automation-frontload.md)
  - 只定义适合前置机械化的 checks surface
- [reconciliation-audit.md](./reconciliation-audit.md)
  - 只定义 drift finding taxonomy 与 audit 结果语义
- [closeout-gate.md](./closeout-gate.md)
  - 只定义 closeout check / sync 的最小链路与 fail-closed 顺序

这些宿主动作在 installed-skills / `.loom/bin` carrier 下，都必须先消费 `runtime-state`。
若 runtime/layout/resources 漂移，入口必须直接 `block`，不得继续读取或写入 GitHub 控制面。

这些文件共同表达一条统一宿主动作链路，但本文件是结果词表、`fallback_to` 与 ownership 收口的唯一主落点。
