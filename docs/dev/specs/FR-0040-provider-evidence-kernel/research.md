# FR-0040 research

## 输入来源

- Issue #1128: Provider Evidence Kernel。
- Parent #1111: Provider Runtime Foundation。
- `FR-0033 Browser Provider Contract`: provider identity、mode、version、capabilities、verification level 与 limitations。
- `FR-0035 Provider Capability Verification Model`: capability verification records、support state、evidence refs 与 fail-closed policy。
- `FR-0036 Provider Registry`: provider registry entry、provider class、locator 与 default eligibility。
- `FR-0037 Launch Envelope Extraction`: provider reference、profile binding、runtime bindings、evidence requirements、health matrix 与 recovery boundaries。
- `docs/dev/architecture/system-design/boundary.md`: WebEnvoy / Syvert / Provider 边界和 integration gate 触发条件。

## 关键判断

### FR 编号

当前 main 已存在 `FR-0039-error-exit-code-taxonomy`，open PR #1224 使用 `FR-0038-provider-health-doctor-contract`。为避免与 open PR 和 main 既有 suite 冲突，本 issue 使用下一个可用编号 `FR-0040-provider-evidence-kernel`。

### integration metadata

Issue #1128 带有 `integration:local-only` label；但本 PR 冻结 provider/shared evidence contract，且 `docs/dev/AGENTS.md` 与 `docs/dev/architecture/system-design/boundary.md` 均要求 provider/shared-contract 事项升级 integration gate。因此 PR metadata 应使用：

- `integration_applicable: yes`
- `integration_touchpoint: check_required`
- `integration_ref: "#1111"`
- `shared_contract_changed: yes`
- `external_dependency: none`
- `merge_gate: integration_check_required`
- `contract_surface: diagnostics_observability`
- `joint_acceptance_needed: no`

判断理由：本 FR 改 WebEnvoy provider/runtime evidence shared surface，不冻结 Syvert normalized result，不依赖 Syvert 侧动作，也不需要联合验收；但它确实改变 provider evidence / diagnostics / observability contract，因此不能申报为 `local_only`。

### 与 #1127 的关系

#1127 Provider Health Doctor 仍在独立 PR #1224 中推进。本 FR 不触碰其文件，不依赖其 suite 已合入，也不定义 doctor schema。`provider_health_ref` 只作为可选 evidence source locator；只有后续 closeout plan 或目标 capability 明确要求 doctor / health evidence 时，缺失才阻断。

### 与 redaction policy 的关系

Issue #1128 scope 要求 evidence refs / redaction。本 FR 只冻结 provider evidence record 内的最低 redaction hooks：`sensitivity`、`redaction_state`、redacted locator 与 secret 不得外泄规则。完整 Evidence Redaction Policy 应由 #1129 或后续 dedicated policy suite 承接，避免在 #1128 中扩大到全局 redaction governance。

## 取舍

- 采用 evidence record + refs 形态，而不是直接保存完整 artifact 内容，以避免把 secret、profile、Cookie、proxy credential 或 provider private patch payload 纳入 formal contract。
- 将 `closeout_plan.allow` 限定为 evidence record 层的 allow，不代表 guardian / GitHub checks / live evidence gate / merge gate 通过，避免证据合同越权。
- 将 `disconnected` 与 `recoverable` 明确排除在 ready 之外，保持与 `FR-0037` health matrix 一致。
- 将 historical evidence 限定为背景，不满足 `current_launch` 或 `current_pr_head` freshness requirement。
