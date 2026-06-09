# FR-0059 实施计划

## 实施目标

冻结 `#1156 Fingerprint Seed Evidence Policy` 的 formal spec suite，定义 caller-supplied seed reproducibility、默认 redaction、hash recording 条件，以及 raw seed / private patch / fingerprint internals 的 fail-closed 披露边界，供后续 CloakBrowser evidence、health 与 capability owners 消费。

本 PR 是 formal spec review carrier。合入后只冻结 `FR-0059` suite 与 #1156 sync-map；不自动关闭 #1156，不进入 runtime implementation、health behavior、capability matrix、launch evidence 或 live evidence closeout。

## 分阶段拆分

### 阶段 1：formal scope 冻结

- 产出：`spec.md`
- 重点：冻结 policy ownership、reproducibility prerequisite、default redaction、hash policy、forbidden disclosure 与 fail-closed rules。

### 阶段 2：contract / data model 落成

- 产出：`contracts/cloakbrowser-fingerprint-seed-policy.md`、`data-model.md`
- 重点：把 `seed_origin`、`reproducibility_status`、`seed_ref`、`seed_hash_ref`、`seed_hash_scope` 和 downstream consumption boundary 变成稳定共享对象语义。

### 阶段 3：research / risks / review checklist

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：确认本 FR 只消费 `FR-0040` / `FR-0041` / `FR-0049` 既有 contract，不暴露 provider-private schema，并记录 public disclosure / linkability / policy drift 风险。

### 阶段 4：sync map 与 PR 准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1156 映射、parser-ready PR metadata、验证记录
- 重点：确保 PR 只包含 `FR-0059` suite 与单条 sync-map 映射，closing semantics 为 `Refs #1156`。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0059-cloakbrowser-fingerprint-seed-policy/**`
  - `.github/spec-issue-sync-map.yml` 中 #1156 对应映射
- 不修改 runtime、launch、fingerprint generation、browser patching、doctor、health implementation、capability matrix、fixtures、tests、scripts、GitHub workflows、githooks、`AGENTS.md` 或 `code_review.md`。
- 不修改 `FR-0040`、`FR-0041`、`FR-0049`、`FR-0050`、`FR-0051` 的字段 shape。
- 不触碰 #1149/#1150/#1151/#1152/#1153/#1154/#1155/#1157 的 formal suites。
- 不执行 live/browser/profile/account/external-visible 动作。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity 与 hosted checks：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0059-cloakbrowser-fingerprint-seed-policy/spec.md`
- `bash scripts/check-pr-purity.sh docs/1156-cloakbrowser-fingerprint-seed-policy main`
- `git diff --check origin/main...HEAD`
- closing semantics same-class search
- PR push 后等待 hosted GitHub checks

语义自检：

- 对照 issue #1156，确认 scope 只覆盖 fingerprint seed evidence policy。
- 对照 `FR-0041`，确认 raw seed 默认 `secret`，本 FR 只加窄 CloakBrowser-specific reproducibility / hash policy。
- 对照 `FR-0040`，确认本 FR 不改 evidence kernel shape。
- 对照 `FR-0049`，确认本 FR 只收紧 `fingerprint_seed_boundary` 的可消费 policy，不改 direct descriptor shape。
- 对照 forbidden scope，确认未进入 runtime behavior、health doctor、capability matrix、launch code 或 private patch schema。

## TDD 范围

当前 PR 不进入实现代码 TDD。

后续 implementation / consumer issue 应优先补：

- `seed_origin` classification validation tests
- reproducibility claim fail-closed tests
- raw seed leak detection tests
- seed hash scope / disclosure boundary tests
- downstream consumer tests，确认 health / capability 不读取 raw seed
- fixture / sample synthetic redaction tests

## 并行 / 串行关系

可并行：

- 不触碰 `FR-0059` suite 的普通文档整理或其他 CloakBrowser formal suite 只读审阅。
- 下游 owner 的只读 planning，可提前准备 evidence/health/capability consumption notes，但不得改写本 policy。

串行 / 依赖：

- 本 work item 依赖 `FR-0040 Provider Evidence Kernel`、`FR-0041 Evidence Redaction Policy` 与 `FR-0049 cloakbrowser.direct Descriptor`。
- 后续 CloakBrowser evidence、health 与 capability owners 必须消费本 policy，不能在自身 FR 中重定义 raw seed / hash disclosure 规则。
- 任何降低 redaction、允许公开 hash value 或接受 provider-generated reproducibility 的实现，都必须另开 formal spec review。

## 进入实现前条件

- FR-0059 spec review 通过。
- reviewer 确认 caller-supplied seed 是 reproducibility claim 的唯一前提。
- reviewer 确认 hash 只作为 policy-approved comparison / provenance input，不替代 raw seed proof。
- reviewer 确认 raw seed、private patch、fingerprint internals 永不进入 core contract 或 public surfaces。
- reviewer 确认本 suite 未混入 runtime、health behavior、capability matrix、launch evidence、fixtures 或 private schema。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0059-cloakbrowser-fingerprint-seed-policy/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1156 的映射。由于本 PR 不实现 runtime 行为，不需要 profile 清理、secret rotation、artifact cleanup 或 external rollback。
