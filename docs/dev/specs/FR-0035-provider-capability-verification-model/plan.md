# FR-0035 实施计划

## 实施目标

把 `#1124` Provider Capability Verification Model 冻结成 formal suite，形成 provider runtime 后续事项可直接引用的最小验证模型输入，并保持当前 PR 只做 spec review，不进入 runtime/provider registry、doctor、selection、evidence kernel 或 adapter 实现。

`#1124` 是 `fr-complete` 的 contract-freeze FR：合入本 formal suite 后满足 `#1124` 自身关闭条件；provider registry、doctor、selection、adapter implementation、evidence kernel 与 runtime 行为是 downstream implementation / consumer，不属于 `#1124` closure。

## 分阶段拆分

### 阶段 1：support state 与 source 冻结

- 产出：`spec.md`、`contracts/provider-capability-verification-model.md`
- 重点：冻结 support state、verification source、source aggregation 与最低验证要求。

### 阶段 2：record 与 fail-closed 收口

- 产出：`data-model.md`、`risks.md`
- 重点：冻结 verification record、evidence refs、blocking reasons、freshness / provenance 与 fail-closed 规则。

### 阶段 3：ownership 与边界确认

- 产出：`TODO.md` 与 PR metadata
- 重点：确认本 FR 锚定 `FR-0033`，不承接 Syvert normalized mapping、CloakBrowser 私有 patch、provider registry、doctor、evidence kernel 或外部 runtime 行为；PR metadata 使用 provider/shared-contract gate，并锚定 `#1111`。

### 阶段 4：spec review 准备

- 产出：formal spec review PR、验证记录、纯度预检结果
- 重点：确保 PR 只包含 `FR-0035` formal suite 与 spec sync mapping，不混入实现代码、治理五文件或其他 issue 范围。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider registry、CLI、doctor、evidence kernel 或外部可见行为。
- 不触碰 `#1125/#1126/#1127/#1128/#1130` 的实现范围。
- 不修改 `FR-0033` contract shape；只引用其 provider identity、capabilities、verification level 与 limitations。
- 不把 provider 私有 stealth / patch / driver state 写成 WebEnvoy core contract。
- 不把 Syvert normalized result、business schema、product workflow 写入 WebEnvoy。
- 不重定义 `FR-0015`、`FR-0016`、`FR-0020` 的对象。
- 不修改五个治理冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/FR-0035-provider-capability-verification-model main`
- diff check：
  - `git diff --name-only origin/main...HEAD`
  - 确认只包含 `docs/dev/specs/FR-0035-provider-capability-verification-model/**` 与 `.github/spec-issue-sync-map.yml`
- PR metadata parser 消费：
  - PR body 必须使用裸字段格式提供 `integration_check`、`gate_applicability`、`live_evidence_record`、`closeout_control`，确保 merge-ready parser 可消费。
- 语义自检：
  - 对照 `docs/dev/architecture/system-design/boundary.md` 与 `#1111`，确认本 FR 触发 provider/shared-contract gate，但不引入 Syvert external dependency。
  - 对照 `FR-0033`，确认本 FR 只定义 capability verification model，不修改 Browser Provider Contract shape。
  - 对照 unsupported / deny / defer 路径，确认 required locator 字段不会要求实现者伪造不存在的 declaration、source 或 evidence ref。
  - 对照 `FR-0015`，确认不重写 runtime bootstrap/readiness。
  - 对照 `FR-0016`，确认不把 provider verification record 当 live evidence。
  - 对照 `FR-0020`，确认不把 provider verification 当 anti-detection baseline。

## TDD 范围

- 当前只冻结 formal contract，不进入实现代码 TDD。
- 后续实现应优先补以下测试：
  - capability verification parser 对 support state、verification source、blocking reason 的 closed enum 校验。
  - 只有 `provider_declaration` 时业务 `read/write/download` 不得 allow。
  - static/build/doctor source 不得满足 runtime 或 live evidence minimum requirement。
  - `unknown` limitation、`diagnostic_only`、transport not attachable、missing runtime requirement 必须 fail-closed。
  - stale / invalid evidence ref 不得提升 support state。
  - runtime observation 与 live evidence gate 的状态边界不漂移。
  - undeclared capability 路径必须保留 `requested_capability_ref`，并将 `declared_capability_ref` 表达为 `null` / absent，不得伪造 declaration locator。

## 并行 / 串行关系

- 可并行：
  - 不触碰 `FR-0035` suite 的其他 provider runtime 文档整理。
  - 不依赖本 verification model 的纯本仓库实现修复或非共享治理事项。
- 串行 / 依赖：
  - provider registry、provider selection、runtime doctor、provider evidence kernel、provider adapter implementation 必须等待本 FR spec review 通过后才能把本模型作为正式输入。
  - 本 FR 锚定 `FR-0033` Browser Provider Contract；若后续需要改变 `FR-0033` contract shape，必须另开修订 PR。
  - `#1125/#1126/#1127/#1128/#1130` 不应在本 PR 内提前实现或关闭。

## 进入实现前条件

- FR-0035 spec review 通过。
- reviewer 确认 `#1124` 是 spec-only / contract-freeze FR，`Fixes #1124` 不会提前关闭 downstream implementation / consumer。
- reviewer 确认 support state、verification source、verification record、blocking reason 与 fail-closed 规则已足以支撑实现。
- reviewer 确认本 FR 与 `FR-0033`、M1 boundary、`FR-0015`、`FR-0016`、`FR-0020` 的 ownership 不冲突。
- reviewer 确认 provider registry、doctor、selection、evidence kernel、adapter implementation 已明确为后续 issue ownership，而不是混入本 spec PR。
