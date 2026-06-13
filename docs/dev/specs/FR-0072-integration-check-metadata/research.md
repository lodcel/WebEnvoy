# FR-0072 Research Notes

## 研究问题

1. #1205 的实际交付边界是什么？
2. 现有仓库是否已经有 `integration_check` metadata carrier 和 parser/test 落点？
3. 本 PR 是否需要修改 scripts / templates，还是只需 formal suite + sync-map？

## 输入事实

### Issue facts

- #1205 `Integration Check Metadata` 当前 OPEN。
- Labels 包含 `roadmap:item`、`kind:work-item`、`area:syvert-integration`、`risk:high`、`integration:local-only`。
- Issue body scope: “Define when PRs must declare integration_applicable, integration_touchpoint, shared_contract_changed and joint_acceptance_needed.”
- Depends on WebEnvoy / Syvert / Provider Boundary Freeze。
- Boundary 明确不得扩展到 Syvert normalized result、CloakBrowser-as-core、browser patching、default live_write commit 或 unrelated #835 recovery。

### Repo formal inputs

- `docs/dev/architecture/system-design/boundary.md` 已冻结：
  - WebEnvoy core 默认 local-only。
  - 未来 Syvert 可能消费不触发 integration gate。
  - 改 shared input/output、错误语义、`raw` / `normalized` / `diagnostics` / `observability`、ids、跨仓执行模式或联合验收时才升级 integration gate。
- `FR-0071 Syvert Mapping Hint Manifest` 已冻结 WebEnvoy-owned mapping hints as local-only handoff metadata，不定义 Syvert normalized result、provider adapter 或 active integration gate。
- `docs/dev/AGENTS.md` 和 `.github/PULL_REQUEST_TEMPLATE.md` 已列出 `integration_check` 字段、local-only 默认与 integration-gated trigger。
- `docs/dev/review/guardian-review-addendum.md` 已要求 reviewer / guardian 核对 integration metadata，并对缺失、非法 ref、错误 local-only、错误 `contract_surface` 直接阻断。
- `scripts/pr-guardian.sh` merge gate 与 `tests/pr-guardian.merge-guard.merge-gate.sh` 已覆盖缺失 `integration_check`、字段关系不一致、字段不完整等 fail-closed 行为。

## 结论 1：#1205 owns PR metadata semantics, not runtime integration

#1205 的最小正式落点是 PR metadata contract：何时声明、如何声明、什么组合必须阻断。它不要求实现跨仓 joint acceptance、integration project automation 或 runtime schema。

Design consequence:

- FR-0072 使用 formal suite + logical contract。
- PR body / merge gate parser 仍是 metadata carrier，不改变 CLI / JSON-RPC / runtime output。
- Joint acceptance 在本 FR 中只作为 metadata trigger，不实现验收流程。

## 结论 2：现有校验落点已存在，默认不改高风险脚本

仓库已有 PR template、docs/dev/AGENTS、guardian addendum 和 merge gate tests。当前缺口是正式契约化，而不是从零实现 parser。

Design consequence:

- 本 PR 默认只新增 FR-0072 suite 与 sync-map。
- 只有 same-class audit 发现现有 template/parser/test 与 FR-0072 直接冲突，才做最小同步。
- 高风险 `scripts/**` 改动需要明确理由与 targeted tests。

## 结论 3：local-only 与 integration-gated 必须双向 fail closed

风险不只来自漏报 integration gate，也来自把 local-only WebEnvoy formal docs 错误绑定到 integration project。两类错误都会污染 scheduler gate 和 PR truth。

Design consequence:

- Contract 同时定义 valid local-only metadata 和 valid integration-gated metadata。
- `integration_applicable=no` 与 `shared_contract_changed=yes`、`external_dependency != none`、`joint_acceptance_needed=yes` 等组合直接 fail closed。
- `integration_applicable=yes` 必须有具体 `integration_ref`、非 `none` touchpoint、integration merge gate 和非 `none` surface。

## Future extension triggers

Open a new formal spec, governance PR or scheduler decision if future work needs to:

- Add or remove `integration_check` required fields.
- Change enum values or relationship matrix.
- Implement integration project automation.
- Implement joint acceptance runtime / hosted checks.
- Change provider adapter, shared output, error/id/diagnostics/observability semantics.
- Convert Syvert wrapper / normalized result / taxonomy work into WebEnvoy-owned contract.
- Use live/browser/account evidence as completion proof.
