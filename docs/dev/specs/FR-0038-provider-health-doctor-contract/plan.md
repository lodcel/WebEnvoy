# FR-0038 实施计划

## 实施目标

把 `#1127` Provider Health / Doctor Contract 冻结成 formal suite，形成后续 provider doctor command、health report parser、provider registry、selection、capability verification 与 evidence kernel 可直接引用的最小契约输入。

`#1127` 是 `fr-complete` 的 contract-freeze FR：合入本 formal suite 后满足 `#1127` 自身关闭条件；doctor command、runtime health implementation、provider registry、provider selection、capability verification implementation 与 runtime 行为由 downstream 事项承接，不属于 `#1127` closure。

## 分阶段拆分

### 阶段 1：doctor report shape 冻结

- 产出：`spec.md`、`contracts/provider-health-doctor-contract.md`
- 重点：冻结 `provider_doctor_report`、report identity、check category、check result、severity、blocking 与 evidence refs。

### 阶段 2：required checks 与 FR-0033 对齐

- 产出：`data-model.md`
- 重点：把 binary、version、extension load、native messaging、display/headless mode、profile persistence 与 capability-specific readiness 映射到 `FR-0033` declarations / runtime requirements。

### 阶段 3：fail-closed 与边界确认

- 产出：`risks.md`、`TODO.md`
- 重点：确认 doctor pass 最高只到 `doctor_checked`，不替代 runtime attestation、live evidence、profile lock、FR-0015 readiness 或 Syvert mapping。

### 阶段 4：spec review 准备

- 产出：formal spec review PR、验证记录、纯度预检结果
- 重点：确保 PR 只包含 `FR-0038` formal suite 与 spec sync mapping，不混入实现代码、治理五文件或其他 issue 范围。

## 实现约束

- 不修改 runtime、extension、native host、Playwright、provider registry、CLI、doctor command 或外部可见行为。
- 不触碰 `#1124/#1125/#1126/#1128/#1130` 的实现范围。
- 不把 doctor report 写成 runtime status、launch envelope、live evidence record 或 provider registry row。
- 不把 Syvert normalized result、business schema、product workflow 写入 WebEnvoy。
- 不重定义 `FR-0033`、`FR-0015`、`FR-0016`、`FR-0003` 的对象。
- 不修改五个治理冻结目标文件。

## 测试与验证策略

- 文档/规约静态检查：
  - `bash scripts/docs-guard.sh`
  - `bash scripts/spec-guard.sh`
- PR 纯度检查：
  - `bash scripts/check-pr-purity.sh docs/m2-1127-provider-health-doctor main`
- PR metadata parser 消费：
  - PR body 必须使用裸字段格式提供 `integration_check`、`gate_applicability`、`live_evidence_record`、`closeout_control`，确保 merge-ready parser 可消费。
- 语义自检：
  - 对照 `FR-0033`，确认本 FR 只消费 provider contract 与 verification level，不修改其字段或枚举。
  - 对照 `docs/dev/architecture/system-design/boundary.md` 与 `#1111`，确认本 FR 触发 provider/shared-contract gate，但不引入 Syvert external dependency。
  - 对照 `FR-0015` / `FR-0003`，确认 extension/profile readiness 不被 doctor 自证为 runtime ready。
  - 对照 `FR-0016`，确认 doctor evidence refs 不被写成 latest-head live evidence。

## TDD 范围

- 当前只冻结 formal contract，不进入实现代码 TDD。
- 后续实现应优先补以下测试：
  - doctor report parser 对 contract version、closed enum、required checks、unknown status、fatal blocking 的 fail-closed。
  - required check mapping 覆盖 extension binding、native messaging、headless forbidden、profile binding 与 requested capability。
  - doctor pass 最高只能提升到 `doctor_checked`。
  - secret evidence ref 不进入 stdout summary 或 PR metadata。
  - capability-level failure 不误阻断 unrelated optional capability。

## 并行 / 串行关系

- 可并行：
  - 不触碰 `FR-0038` suite 的其他 provider runtime 文档整理。
  - 不依赖 doctor report 的纯实现修复或非共享治理事项。
- 串行 / 依赖：
  - 本 FR 依赖 `FR-0033` 已冻结并合入 main。
  - doctor command、provider health parser、provider registry consumption、selection admission、capability verification implementation 必须等待本 FR spec review 通过。
  - `#1124/#1125/#1126/#1128/#1130` 不应在本 PR 内提前实现或关闭。

## 进入实现前条件

- FR-0038 spec review 通过。
- reviewer 确认 `#1127` 是 spec-only / contract-freeze FR，`Fixes #1127` 不会提前关闭 downstream implementation / consumer。
- reviewer 确认 doctor report shape 足以表达 required health checks 与 capability-specific readiness。
- reviewer 确认 required check、unknown、fatal、secret evidence 与 verification level 的 fail-closed 规则无阻断歧义。
- reviewer 确认本 FR 与 `FR-0033`、M1 boundary、`FR-0015`、`FR-0016`、`FR-0003` 的 ownership 不冲突。
- 后续实现 issue 已明确拆分为 doctor command / report parser / registry consumption / selection admission / evidence kernel 或其他具体 ownership。
