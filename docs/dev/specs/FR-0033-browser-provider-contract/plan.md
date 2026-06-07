# FR-0033 实施计划

## 实施目标

把 `#1123` Browser Provider Contract 冻结成 formal suite，形成 provider runtime 后续事项可直接引用的最小契约输入，并保持当前 PR 只做 spec review，不进入 runtime/provider registry 实现。

## 分阶段拆分

### 阶段 1：contract shape 冻结

- 产出：`spec.md`、`contracts/browser-provider-contract.md`
- 重点：冻结 `browser_provider_contract`、provider identity、mode、browser engine、automation transport、capability declarations。

### 阶段 2：验证级别与 fail-closed 收口

- 产出：`data-model.md`、`risks.md`
- 重点：冻结 verification level、limitations、unknown / diagnostic-only / private patch 等阻断规则。

### 阶段 3：ownership 与边界确认

- 产出：`TODO.md` 与 PR metadata
- 重点：确认本 FR 不承接 Syvert normalized mapping、CloakBrowser 私有 patch、WebEnvoy Agent brain、provider registry 或外部 runtime 行为。

### 阶段 4：spec review 准备

- 产出：formal spec review PR、验证记录、纯度预检结果
- 重点：确保 PR 只包含 `FR-0033` formal suite 与 spec sync mapping，不混入实现代码、治理五文件或其他 issue 范围。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider registry、CLI 或外部可见行为。
- 不触碰 `#1124/#1125/#1130` 的实现范围。
- 不把 provider 私有 stealth / patch / driver state 写成 WebEnvoy core contract。
- 不把 Syvert normalized result、business schema、product workflow 写入 WebEnvoy。
- 不重定义 `FR-0015`、`FR-0016`、`FR-0020` 的对象。
- 不修改五个治理冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/m2-1123-browser-provider-contract main`
- PR metadata parser 消费：
  - 使用 `bash scripts/open-pr.sh` 创建/更新 PR，或等价地让 PR body 保持模板结构化字段可解析。
- 语义自检：
  - 对照 `docs/dev/architecture/system-design/boundary.md`，确认 local-only 与职责边界一致。
  - 对照 `FR-0015`，确认不重写 runtime bootstrap/readiness。
  - 对照 `FR-0016`，确认不把 provider contract 当 live evidence。
  - 对照 `FR-0020`，确认不把 provider verification 当 anti-detection baseline。

## TDD 范围

- 当前只冻结 formal contract，不进入实现代码 TDD。
- 后续实现应优先补以下测试：
  - provider contract parser 对必填字段、closed enum、unknown limitation 的 fail-closed。
  - provider selection 拒绝 `diagnostic_only`、`transport_kind=none`、`attach_model=not_attachable`。
  - capability requirements 与 provider support 字段不匹配时阻断。
  - verification level 不足时拒绝业务执行。
  - Google Chrome stable channel canonical label 不发生别名漂移。

## 并行 / 串行关系

- 可并行：
  - 不触碰 `FR-0033` suite 的其他 provider runtime 文档整理。
  - 不依赖本 contract 的纯实现修复或非共享治理事项。
- 串行 / 依赖：
  - provider registry、provider selection、runtime doctor、provider adapter implementation 必须等待本 FR spec review 通过。
  - 若后续事项要改变 shared input/output、error semantics、diagnostics/observability、runtime mode 或 provider/shared-contract integration 口径，必须重新评估 integration gate。
  - `#1124/#1125/#1130` 不应在本 PR 内提前实现或关闭。

## 进入实现前条件

- FR-0033 spec review 通过。
- reviewer 确认 `browser_provider_contract` 的字段、枚举、verification level 与 limitations 已足以支撑实现。
- reviewer 确认 `diagnostic_only`、`unknown`、private patch、real-browser evidence 等 fail-closed 规则无阻断歧义。
- reviewer 确认本 FR 与 M1 boundary、`FR-0015`、`FR-0016`、`FR-0020` 的 ownership 不冲突。
- 后续实现 issue 已明确拆分为 registry / doctor / selection / adapter 或其他具体 ownership，而不是把所有 provider runtime 行为塞回本 spec PR。
