# FR-0036 实施计划

## 实施目标

把 `#1125` Provider Registry 冻结成一个窄 formal suite，形成 official Chrome、CloakBrowser managed provider 与 future remote browser provider 的最小登记契约输入，并保持当前 PR 只做 registry contract carrier，不进入 runtime、doctor、selection 或 adapter implementation。

`#1125` 是 `work-item-complete`：合入本 suite 后满足 provider registry shape 的关闭条件；provider doctor、selection、driver integration、CloakBrowser adapter、remote provider broker 与 runtime 行为由后续 issue 承接。

## 分阶段拆分

### 阶段 1：registry shape 冻结

- 产出：`spec.md`、`contracts/provider-registry.md`
- 重点：冻结 `browser_provider_registry`、entry、provider class、status、eligibility、locator 与 constraints。

### 阶段 2：FR-0033 resolver 对齐

- 产出：`data-model.md`
- 重点：确认 registry 只解析并携带 `FR-0033.browser_provider_contract` snapshot，不重写 provider contract 字段。

### 阶段 3：边界与风险收口

- 产出：`risks.md`、`TODO.md`
- 重点：确认本 work item 不承接 `#1124/#1126/#1127/#1128/#1130`，不引入 Syvert normalized result、CloakBrowser-as-core 或外部 live/runtime 行为。

### 阶段 4：review 与 merge-ready 准备

- 产出：parser-friendly PR body、验证记录、纯度预检结果
- 重点：确保 PR 只包含 FR-0036 suite 与 sync map，不混入实现代码或其他 issue 范围。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider driver、provider selection、doctor、CLI 或外部可见行为。
- 不触碰 `#1124/#1126/#1127/#1128/#1130`。
- 不把 CloakBrowser 私有 stealth / patch / driver state 写成 WebEnvoy core contract。
- 不把 Syvert normalized result、business schema、product workflow 写入 WebEnvoy。
- 不重定义 `FR-0033` 的 browser provider contract。
- 不修改五个治理冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh work/1125-provider-registry main`
- diff 检查：
  - `git diff --stat origin/main...HEAD`
  - `git diff --name-only origin/main...HEAD`
- PR metadata parser 消费：
  - PR body 必须提供 `integration_check`、`gate_applicability`、`live_evidence_record`、`closeout_control`。
- 语义自检：
  - 对照 `FR-0033`，确认 registry 只引用 provider contract snapshot。
  - 对照 `boundary.md` 与 `#1111`，确认 provider/shared-contract gate 适用但 external dependency 为 `none`。
  - 对照 issue #1125，确认不实现 runtime behavior，不触碰其他 M2 work item。

## TDD 范围

- 当前只冻结 formal registry contract，不进入实现代码 TDD。
- 后续实现应优先补以下测试：
  - registry parser 拒绝缺失 `contract_snapshot`、重复 `provider_id`、provider_id 与 contract snapshot 不一致。
  - registry parser 对 provider class、status、eligibility、locator kind 使用 closed enum。
  - selection 拒绝 `declared`、`blocked`、`diagnostic_only`、`experimental_only`、`requires_opt_in=true` entry。
  - selection 不把 `default_eligibility=eligible` 误判为 runtime ready。
  - driver 从 registry lookup provider，而不是硬编码 provider family 分支。

## 并行 / 串行关系

- 可并行：
  - 不触碰 FR-0036 suite 的其他本仓库文档整理。
  - 不依赖 provider registry 的普通 runtime bugfix。
- 串行 / 依赖：
  - 本 work item 依赖 `FR-0033` Browser Provider Contract 已合入。
  - provider doctor、selection、driver integration、CloakBrowser adapter、remote provider broker 与 runtime 行为必须等待本 registry spec review 通过。
  - 若后续 issue 改变 shared input/output、diagnostics/observability、runtime mode 或 provider/shared-contract integration 口径，必须沿用或重新评估 integration gate。

## 进入实现前条件

- FR-0036 spec review 通过。
- reviewer 确认 #1125 的关闭语义是 provider registry shape work-item-complete，不是 runtime behavior complete。
- reviewer 确认 registry entry 到 `FR-0033.browser_provider_contract` 的 resolver 规则清楚。
- reviewer 确认 official Chrome、CloakBrowser managed provider 与 remote browser placeholder 的边界没有把私有 provider 或 external runtime 升级为 WebEnvoy core。
- reviewer 确认后续 implementation issue 已清楚拆分为 doctor、selection、driver integration、adapter 或 remote broker，而不是回到本 PR 扩 scope。
