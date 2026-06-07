# FR-0033 risks

## 风险 1：把 provider contract 误写成 provider registry 实现

- 表现：在 spec 中冻结 registry row、selection algorithm、installation state 或 runtime instance state。
- 影响：提前越界到 `#1124/#1125/#1130` 实现范围，导致 spec review 与 implementation review 混写。
- 缓解：本 FR 只冻结 declaration contract；registry / doctor / selection 必须由后续事项单独承接。
- 回滚：移除 registry / selection / runtime state 字段，保留 provider declaration 与 fail-closed 规则。

## 风险 2：把 Syvert normalized mapping 混入 WebEnvoy contract

- 表现：字段中出现 Syvert business schema、normalized result、project state 或 product workflow。
- 影响：违反 M1 boundary，错误升级或污染 integration 口径。
- 缓解：本 FR 明确 Syvert 是可选消费者；provider contract 只声明浏览器执行面能力。
- 回滚：删除 Syvert-specific 字段，必要时在 Syvert 或 integration issue 中另行冻结消费层 mapping。

## 风险 3：把 CloakBrowser 或其他 provider 私有 patch 细节提升为 core contract

- 表现：spec 冻结私有 stealth 参数、browser patch manifest、driver internal state。
- 影响：WebEnvoy core 被 provider 私有实现绑死，后续替换或多 provider 支持困难。
- 缓解：只允许 `provider_private_patch_required` limitation / requirement，不展开私有 schema。
- 回滚：把私有字段降级为 limitation 或后续 provider-specific adapter 文档。

## 风险 4：verification level 被误用为 live evidence

- 表现：`doctor_checked` 或 provider 自报被当成 latest-head real-browser live evidence。
- 影响：绕过 `FR-0016` 专项门禁，造成 review 和 merge gate 误判。
- 缓解：verification level 明确分层，`live_evidence_attested` 必须引用适用 live evidence gate 的 run / artifact / metadata。
- 回滚：收紧 verification 描述，补充 `doctor_checked != runtime ready != live evidence ready` 的阻断说明。

## 风险 5：unknown limitation 未 fail-closed

- 表现：字段缺失、unknown limitation 或 unsupported support 字段被默认为允许。
- 影响：后续 provider selection 可能选择无法满足安全前置的执行面。
- 缓解：spec 和 contract 明确 unknown 影响目标 capability 时默认阻断。
- 回滚：补充 GWT 与 contract 规则，确保 unknown 不可静默降级。

## 风险 6：browser channel label 漂移

- 表现：同一 Google Chrome stable 被写成 `stable`、`chrome-stable`、`Google Chrome Stable` 等多个别名。
- 影响：与 `FR-0020`、`FR-0016`、runtime binding 的 evidence scope 对不齐。
- 缓解：本 FR 复用 `Google Chrome stable` canonical label。
- 回滚：替换别名并补充静态检查或后续 parser 测试。

## 风险 7：PR metadata 误判为 local-only

- 表现：FR 冻结 Browser Provider Contract，却填写 `integration_applicable=no`、`shared_contract_changed=no`、`merge_gate=local_only` 或 `contract_surface=none`。
- 影响：provider/shared-contract gate 无法消费正式契约，formal spec review 阻断。
- 缓解：PR metadata 使用 provider/shared-contract gate，锚定 `#1111`，填写 `contract_surface=execution_provider`；同时保持 `external_dependency=none` 与 `joint_acceptance_needed=no`，避免误引入 Syvert 依赖。
- 回滚：修正 PR body integration fields 与 spec acceptance language，并重新跑 metadata / guardian 检查。
