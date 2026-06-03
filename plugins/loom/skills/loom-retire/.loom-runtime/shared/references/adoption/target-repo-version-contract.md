# Target Repo Version Contract

本文件定义 Loom 如何读取目标仓库自己的 `release / version` 真相，而不把它与 Loom 自身的 distribution version authority 混淆。

## 1. 目标

Loom 在目标仓库版本管理里只回答四件事：

- 当前目标仓库正在准备或收口哪个 release / version
- 该 release / version 纳入了哪些 `Phase` / `FR` / `Work Item`
- 这些工作分别处于 `merged`、`unmerged`、`unreleased` 或 `unreconciled` 的哪一种状态
- release closeout 还缺哪些 evidence 与 rollback basis

Loom 不接管 release authoring、tag 创建、artifact 发布、GitHub Release 填写或 deployment 系统。

## 2. authored target release object

目标仓库若选择向 Loom 暴露 target release truth，应提供 `loom-target-release/v1` authored object。

该对象至少应表达：

- `release_id`
- `display_name`
- `target_branch`
- `release_goal`
- `status`
- `included_scope`
  - `phase`
  - `fr`
  - `work_item`
- `evidence`
  - `changelog_locator`
  - `release_notes_locator`
  - `migration_notes_locator`
  - `tag_or_artifact_locator`
  - `rollback_basis_locator`
- `authority`
  - `owner`
  - `source_kind`
  - `source_locator`

稳定约束：

- 该对象是 repo-owned 或 host-owned release truth，不是 Loom authored state
- 它可以引用 delivery chain 对象，但不能替代 `Work Item`
- 它不得把 Loom 的 installer / plugin / runtime / schema version 回写成 target release 字段

## 3. derived target release status

Loom 读取 target release truth 后，应派生 `loom-target-release-status/v1`。

该摘要至少应表达：

- 当前 target release 身份与目标
- 纳入范围
- `merged` / `unmerged` / `unreleased` / `unreconciled` 拆分
- release evidence 是否齐备
- rollback readiness
- closeout gaps
- provenance

该摘要是 derived surface，不是 authored truth。

## 4. `repo companion` 挂接方式

目标仓库通过 `.loom/companion/repo-interface.json` `v2.release_targets` 挂接这一能力。默认 adoption 必须省略该 section；没有 release target intent 的仓库应被读取为 `release_targets.availability = absent` 与 `target_release.result = not_applicable`，而不是由 Loom 生成占位 release truth。

最小字段：

- `catalog_locator`
- `current_target_locator`
- `enforcement`
- `status_locator` 可选

其中：

- `catalog_locator` 指向仓库自己的 release target catalog
- `current_target_locator` 指向当前 active target release object
- `status_locator` 若存在，只能是 repo-owned derived status，不替代 Loom 自己的状态面
- `enforcement` 只允许 `blocking | advisory`

Loom 不得为了满足 schema 而生成 `bootstrap-v0.1.0`、空 catalog、示例 current release 或示例 status。声明 `release_targets` 时，locator 指向的对象必须来自目标仓库明确选择的 repo-owned 或 host-owned release/version truth。

## 5. closeout 语义

若仓库声明了 target release truth，closeout 至少要能区分：

- 已 merged 但未进入当前 target release
- 已 released 但控制面尚未 reconciled
- 缺 changelog / release notes / migration notes / tag-artifact evidence
- 缺 rollback basis

这些缺口属于 release closeout gap，不得伪装成普通 issue closeout 已完成。

## 6. 非目标

- 不把 target release object 升格为执行入口
- 不要求每个 `Work Item` 都先绑定 release 才能执行
- 不把 GitHub Release、tag、package registry 或 app store 升格为 Loom core 默认对象
- 不把某个下游仓库的 release 字段名直接冻结成 Loom 全局默认字段
