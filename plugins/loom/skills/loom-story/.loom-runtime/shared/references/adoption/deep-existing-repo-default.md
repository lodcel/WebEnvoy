# Deep Existing Repo Default

本文件定义 Loom 面向成熟既有治理重仓的默认接入策略。

它不替代 [lightweight-retrofit-default.md](./lightweight-retrofit-default.md)，而是作为 `complex-existing` 下的保守 attach path，服务已经拥有稳定根规则、统一验证入口与沉重 repo-specific gates 的仓库。

## 1. 适用场景

当目标仓库同时满足以下条件时，默认采用本策略：

- 属于既有仓库，且 `loom-init` 判断仍为 `complex-existing`
- 已有清晰的根级边界文档，例如 `AGENTS.md`、`WORKFLOW.md` 或等价根规则
- 已有统一的仓库级验证入口
- 已出现 `merge_review_semantic_overload`
- 当前复杂度主要来自 review / guardian 负载、repo-specific gates、retained host actions 或 repo-native carriers，而不是 Loom 缺少 recovery/status carriers

## 2. 默认目标

第一轮接入的目标不是把成熟治理栈重写成 Loom 自己的 recovery / status 体系，而是让 Loom 先稳定挂到既有入口与读面上。

默认先解决：

- 让 `loom-init` 对这类仓库不再误走 `full-bootstrap`
- 让 Loom 有稳定的 `recognize-and-attach` 入口
- 让 repo companion 成为 Loom 读取 repo-specific rules 的正式入口
- 让 root rules、retained host actions 与 repo-native carriers 明确保留在原 ownership

## 3. 默认装配

本策略默认优先装配：

- `.loom/bootstrap/*` attach metadata
- `.loom/README.md`
- `.loom/companion/README.md`
- companion-owned 的最小 repo-specific read surfaces
- repo-local `.loom/bin/*` 读取与验证入口

## 4. 默认接入方式

本策略固定采用 `recognize-and-attach`：

- 保留原有 root rules
- 保留 retained host actions 的宿主 ownership
- 保留 repo-native carriers
- 只追加 Loom-owned attach metadata 与 companion 入口
- 在 `repo-interface.json` 的 `review_instruction_locators` 中声明 spec review 与 implementation review 的 repo-owned instruction locator
- 按 [zero-friction-adoption-contract.md](./zero-friction-adoption-contract.md) 生成或更新 companion / interop locator，并用 verify 证明边界没有漂移

换句话说，Loom 这一步接管的是入口与读面，不是宿主动作底层实现。

成熟既有仓库不得让 Loom 猜测 `spec_review.md`、`code_review.md` 或任何 repo-specific review instruction 文件名。缺失、不可读或越界的 review instruction locator 必须在进入正式 review 前 fail closed。

## 5. 默认不装配

第一轮默认不装配：

- `.loom/work-items/*`
- `.loom/progress/*`
- `.loom/status/current.md`
- `.loom/reviews/*`
- `.loom/specs/*`
- Loom-owned recovery/status carriers 的 bootstrap placeholder
- 对 branch / PR / worktree / merge / ruleset 的底层宿主重写

若上述 Loom-authored carriers 已存在、被 `init-result` / manifest 声明为 generated，或出现在 attach-only planned writes 中，verify 必须 fail closed。执行者只能迁移到宿主 truth locator、删除 competing carrier，或显式升级 intent 到 `execution-control`。

## 6. 升级信号

以下任一条件出现时，不应继续停留在 attach-only 默认路径：

- 当前仓库需要 Loom-owned recovery carrier 承接多轮执行停点
- repo-native carriers 无法稳定承接 recovery / review / closeout 真相
- companion 之外还需要 Loom-owned status surface 承接统一读面
- repo-local attach 入口已经稳定，但下一轮需要 typed machine contract、interop 或 shadow parity

## 7. Attach-only 之后的 external runtime 路径

成熟既有仓库第一轮可以继续提交 vendored `.loom/bin`，因为它提供可审计 runtime provenance。

只有在以下条件满足后，才应考虑 de-vendor：

- `.loom/companion` 与 `interop.json` 已稳定
- `runtime-state`、`governance-profile status`、`runtime-parity validate`、`shadow-parity` 都能读取同一治理载体
- external runtime locator 已按 [external-runtime-companion-contract.md](./external-runtime-companion-contract.md) 版本化声明
- rollback 能回到 vendored `.loom/bin` 或重新 bootstrap

de-vendor 不得删除 repo-owned residue，也不得替代 guardian、integration contract、release / sprint 等仓库私有规则。

## 8. Attach-only 之后的 authority migration

当成熟既有仓库需要从 attach-only 进入 Loom-governed execution 时，必须按 [complex-existing-authority-migration-playbook.md](./complex-existing-authority-migration-playbook.md) 分阶段迁移 authority。

该迁移不得跳过 review engine replacement 与 review record authority 的边界，也不得让 Loom verdict 和 host verdict 同时作为独立 merge blocker。
