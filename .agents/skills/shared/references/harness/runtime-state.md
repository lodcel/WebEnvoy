# Runtime State

本文件定义 Loom installed-skills 的最小运行态识别与 fail-closed 合同。

## 1. 能力定位

`runtime-state` 只回答 Loom 当前入口自己处于什么运行场景、依附什么 carrier、以及为什么可以或不可以继续执行。

它不回答：

- 当前事项进度
- 目标仓库的运行/日志/验证入口
- `governance_surface` 所承接的治理装配状态

## 2. 固定词表

`scene` 固定只允许：

- `repo-local-demo`
- `installed-runtime`
- `upgrade-rehearsal`

`carrier` 固定只允许：

- `repo-local-wrapper`
- `installed-skills-root`
- `bootstrapped-target-runtime`

`entry_family` 固定只允许：

- `loom-init`
- `loom-flow`

## 3. 最小读面

`runtime-state` 至少应暴露：

- `scene`
- `carrier`
- `entry_family`
- `install_root`
- `runtime_root`
- `registry_path`
- `layout_or_manifest_path`
- `source_repo_root`
- `checks`

其中 `checks` 至少固定给出：

- `scene_marker`
- `carrier_layout`
- `registry_contract`
- `shared_runtime`
- `referenced_resources`

每项检查只允许：

- `pass`
- `block`
- `not_applicable`

## 4. 场景与 carrier 关系

- `repo-local-demo`
  - 只能来自 `repo-local-wrapper`
- `installed-runtime`
  - 默认来自 `installed-skills-root`
  - `bootstrapped-target-runtime` 若未显式声明 rehearsal，也归入此场景
- `upgrade-rehearsal`
  - 必须由显式 `LOOM_RUNTIME_SCENE=upgrade-rehearsal` 进入
  - 只允许来自 `installed-skills-root` 或 `bootstrapped-target-runtime`

若 `scene` 与检测到的 `carrier` 冲突，必须直接 `block`。

## 5. Fail-Closed 纪律

以下任一条件都必须 `block`，不得继续伪装成可运行：

- shared runtime 缺失
- shared references / assets 缺失
- `install-layout.json` 缺失或 required paths 不齐
- `registry.json` / `upgrade-contract.json` 漂移
- skill-local executable 不可达
- `.loom/bootstrap/manifest.json` 缺失或与 `.loom/bin` runtime 文件不一致
- 显式 `LOOM_RUNTIME_SCENE` 与检测到的 carrier 冲突

顶层 `fallback_to` 固定只允许：

- `refresh-install`
- `rebootstrap-runtime`
- `manual-runtime-reconciliation`
- `null`

## 6. 与其他读面的边界

- `runtime-state`
  - 回答 Loom 入口自身是否处于稳定安装/运行态
- `runtime-evidence`
  - 回答目标仓库当前事项的运行/日志/诊断/验证入口
- `governance_surface`
  - 回答仓库 Loom 装配态与治理载体/宿主控制面的落位

这三者不得互相伪装成别名。

## 7. Carrier transition invariants

从 vendored `.loom/bin` runtime 迁移到 external runtime 时，`runtime-state` 必须保持 fail-closed：

- bootstrapped target runtime 优先由当前入口路径和 `.loom/bootstrap/manifest.json` 判定
- 外部 `LOOM_SOURCE_REPO_ROOT` 不得抢先改判 bootstrapped target runtime
- `.loom/bootstrap/manifest.json` 中声明的 `.loom/bin/*` artifact 必须继续有 `sha256`
- 若 vendored runtime 被删除，external runtime 必须提供 versioned runtime locator 和 rollback path
- external runtime rehearsal 不得改写 `.loom/companion`、status、work item、review 或 shadow evidence 的 truth

当前默认 carrier 仍是 vendored `.loom/bin`。external runtime 只能作为显式迁移目标，不能通过环境变量隐式启用。

迁移合同见 [external-runtime-companion-contract.md](../adoption/external-runtime-companion-contract.md)。
