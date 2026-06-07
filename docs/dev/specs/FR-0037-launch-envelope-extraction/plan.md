# FR-0037 实施计划

## 实施目标

把 `#1126` Launch Envelope Extraction 冻结成 formal suite，形成 provider runtime 后续事项可直接引用的 launch-time contract 输入，并保持当前 PR 只做 spec review，不进入 provider registry、doctor、evidence kernel 或 browser launch 实现。

`#1126` 是 `fr-complete` 的 contract-freeze FR：合入本 formal suite 后满足 `#1126` 自身关闭条件；`#1124/#1125/#1127/#1128/#1129/#1130` 是 downstream implementation / consumer，不属于 `#1126` closure。

## 分阶段拆分

### 阶段 1：Launch Envelope shape 冻结

- 产出：`spec.md`、`contracts/launch-envelope.md`
- 重点：冻结 `launch_envelope`、identity、provider reference、profile binding、browser mode、network/regional settings、runtime bindings、fingerprint policy 与 evidence requirements。

### 阶段 2：fail-closed 与 secret redaction 收口

- 产出：`data-model.md`、`risks.md`
- 重点：冻结 provider verification、profile lock、real-browser/headless、extension/native messaging、fingerprint seed、evidence freshness 与 secret locator 的阻断规则。

### 阶段 3：ownership 与边界确认

- 产出：`TODO.md` 与 PR metadata
- 重点：确认本 FR 只消费 `FR-0033`，不实现 registry / doctor / evidence kernel，不引入 Syvert normalized mapping；PR metadata 使用 provider/shared-contract gate，并锚定 `#1111`。

### 阶段 4：spec review 准备

- 产出：formal spec review PR、验证记录、纯度预检结果
- 重点：确保 PR 只包含 `FR-0037` formal suite 与 spec sync mapping，不混入实现代码、治理五文件或其他 issue 范围。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider registry、doctor、evidence kernel、CLI 或外部可见行为。
- 不触碰 `#1124/#1125/#1127/#1128/#1129/#1130` 的实现范围。
- 不把 provider 私有 stealth / patch / driver state 写成 WebEnvoy core contract。
- 不把 Syvert normalized result、business schema、product workflow 写入 WebEnvoy。
- 不重定义 `FR-0033`、`FR-0015`、`FR-0016`、`FR-0020`、`FR-0034` 的对象。
- 不修改五个治理冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/m2-1126-launch-envelope-extraction main`
- 差异检查：
  - `git diff --name-status origin/main...HEAD`
  - 确认只包含 `docs/dev/specs/FR-0037-launch-envelope-extraction/**` 与 `.github/spec-issue-sync-map.yml`
- PR metadata parser 消费：
  - PR body 必须使用裸字段格式提供 `integration_check`、`gate_applicability`、`live_evidence_record`、`closeout_control`，确保 merge-ready parser 可消费。
- 语义自检：
  - 对照 `FR-0033`，确认 Launch Envelope 只引用 provider contract，不重定义 provider capability。
  - 对照 `FR-0015`，确认 official Chrome 主路径仍是 persistent profile extension + runtime bootstrap。
  - 对照 `FR-0016`，确认 Launch Envelope 不伪装为 live evidence。
  - 对照 `FR-0020`，确认 fingerprint policy 不伪装为 anti-detection validation。

## TDD 范围

- 当前只冻结 formal contract，不进入实现代码 TDD。
- 后续实现应优先补以下测试：
  - Launch Envelope parser 对必填字段、closed enum、secret locator 与 unknown limitation 的 fail-closed。
  - provider contract ref、provider id、capability refs 与 minimum verification level 不匹配时阻断。
  - `headed=true && headless=true` 阻断。
  - `real_browser_required=true` 且 headless/provider no-real-browser 时阻断。
  - extension/native messaging/profile binding requirement 缺失或 unknown 时阻断。
  - `freshness_policy=current_launch|current_pr_head` 不被历史 artifact 满足。

## 并行 / 串行关系

- 可并行：
  - 不触碰 `FR-0037` suite 的其他 provider runtime 文档整理。
  - 不依赖 Launch Envelope 的纯实现修复或非共享治理事项。
- 串行 / 依赖：
  - 本 FR 依赖 `FR-0033` Browser Provider Contract 已合入主干。
  - provider evidence kernel `#1128` 必须等待本 FR 的 evidence requirements 和 launch locator 语义冻结后消费。
  - provider registry、provider doctor、evidence redaction、contract fixtures 与 provider adapter implementation 不应在本 PR 内提前实现或关闭。
  - 后续事项若继续改变 shared input/output、runtime mode、provider/shared-contract integration 口径或 evidence requirements，必须沿用或重新评估 integration gate。

## 进入实现前条件

- FR-0037 spec review 通过。
- reviewer 确认 `#1126` 是 spec-only / contract-freeze FR，`Fixes #1126` 不会提前关闭 downstream implementation / consumer。
- reviewer 确认 `launch_envelope` 的字段、枚举、secret redaction、freshness 与 fail-closed 规则足以支撑后续 launch admission。
- reviewer 确认本 FR 与 `FR-0033`、`FR-0015`、`FR-0016`、`FR-0020`、`FR-0034` 的 ownership 不冲突。
- 后续实现 issue 已明确拆分为 registry / doctor / evidence kernel / redaction / fixtures / adapter 或其他具体 ownership，而不是把所有 provider runtime 行为塞回本 spec PR。
