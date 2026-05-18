# Lightweight Retrofit Default

本文件定义 Loom 面向小型既有仓库的默认 retrofit 策略。

它来自 `mail-listener` 的第一轮真实 adoption 验证，并由 `DevSkills` 的反例验证补强适用边界。

## 1. 适用场景

当目标仓库同时满足以下条件时，默认采用本策略：

- 已有清晰的工程边界文档，例如 `AGENTS.md`
- 已有 CI 与基础测试
- 已有统一的仓库级验证入口，而不是只有零散子模块脚本
- 当前缺的是治理入口、review 合同或条件化 spec 路径
- 当前还没有明显的长任务恢复痛点
- 当前主产物本身不是共享 contract、shared skill 或 governance module

## 2. 默认目标

第一轮 retrofit 的目标不是装完整 Loom，而是先建立最小治理闭环。

默认先解决：

- 改动如何进入实现
- reviewer 如何判断改动
- 哪些边界改动必须先说明再实现

## 3. 默认装配

本策略默认优先装配：

- `WORKFLOW`
- `code_review`
- `spec_review`
- 最小 PR 模板
- 条件化 `spec.md` / `plan.md`

## 4. 默认接入方式

如果目标仓库已经有稳定的根级边界文档，默认采用 `repo companion` 接入，并按 [zero-friction-adoption-contract.md](./zero-friction-adoption-contract.md) 完成 `read -> judge -> write -> verify`：

- 保留原有根规则文档
- 只追加 repo companion、职责映射与必要验证入口
- 在 `repo-interface.json` 中显式声明 `review_instruction_locators`；已有规则用 repo-owned locator，确无规则时才声明 `loom_default`
- 不在第一轮重写整个根级规则体系
- 不把轻量 retrofit 升级成 unattended strong adoption

轻量仓库可以从 Loom default review instruction 起步，但这个选择必须是显式 locator 合同，而不是自动猜测 `spec_review.md`、`code_review.md` 或任何单仓历史路径。

## 5. 默认不装配

第一轮默认不装配：

- 完整 recovery 模型
- work item 合同
- 状态面
- profile 分层
- 重 harness

## 6. checkpoint-lite

如果事项会跨多轮推进，但还不值得引入独立恢复工件，允许先采用 `checkpoint-lite`：

- 在 issue 或 PR 描述中记录当前停点
- 在 issue 或 PR 描述中记录下一步
- 在 issue 或 PR 描述中记录阻断项

这是一种轻量过渡形态，不等于永久替代 recovery 模型。

以下任一条件出现时，不应继续使用本策略或 `checkpoint-lite`：

- 没有统一仓库级验证入口
- 仓库主产物本身是共享 contract、shared skill 或 governance module
- 已出现共享契约、共享数据模型或高风险核心抽象
- 已出现多个运行入口、多个状态入口或明显恢复痛点
