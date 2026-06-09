# FR-0050 Research

## 研究范围

本 research 只为 `#1147 cloakbrowser.persistent Descriptor` 的 formal descriptor 输入提供证据约束。它不验证真实 CloakBrowser runtime，不执行 browser / account / live action，不暴露 private patch schema，也不把第三方 provider 行为写成已通过事实。

## 研究问题

1. `cloakbrowser.persistent` 是否需要被建模为 managed persistent profile，而不是 direct launch 或 one-shot profile？
2. extension workflow 应该以哪些 descriptor refs 进入后续 capability matrix / health consumer？
3. provider broker / attach model 应如何进入 contract，而不让 WebEnvoy core 拥有 CloakBrowser lifecycle？
4. private managed capability / private patch 假设如何表达，才能支持 fail-closed admission 又不泄漏 private schema？
5. 哪些假设必须保留为后续 health / runtime / evidence owner 的未验证输入？

## 证据输入

- Issue #1147 live scope：只要求描述 persistent CloakBrowser profile、extension workflow capabilities 与 health requirements；明确不进入 Syvert、CloakBrowser-as-core、browser patching、default live_write 或 #835 recovery。
- Issue #1147 scheduler parallel-entry comment：本 PR 形态为独立 docs/spec/descriptor PR，只定义 `cloakbrowser.persistent` profile / extension workflow capability 与限制，不夹带 health gate、XHS 或 Syvert 范围。
- `FR-0033 Browser Provider Contract`：provider identity、provider mode、browser engine、automation transport、capability declaration、verification level 与 limitation 是可消费基础 contract；`declared_only` 和 unknown limitation 必须 fail-closed。
- `FR-0036 Provider Registry`：`cloakbrowser_managed` 只能登记 managed browser provider 类别，不暴露 CloakBrowser private patch schema，不把 CloakBrowser 设为 WebEnvoy core。
- `FR-0038 Provider Health / Doctor Contract`：binary、version、extension load、native messaging、display mode、profile persistence 与 capability readiness 是 health / doctor carrier；doctor pass 不等于 runtime ready 或 live evidence ready。
- Sibling issue #1146：direct descriptor 只描述 direct launch capabilities、extension path handling 与 final args evidence limits；persistent profile / extension workflow health inputs不属于 direct scope。
- Sibling issue #1148：cloakserve descriptor 单独承接 cloakserve-specific lifecycle / broker surface；本 FR 不能把 cloakserve lifecycle 写入 persistent descriptor。

## 结论

### Managed persistent profile

`cloakbrowser.persistent` 应作为 `provider_mode=external_managed`、`attach_model=provider_brokered` 的 managed browser provider descriptor，而不是 WebEnvoy core direct launch descriptor。

Descriptor 必须声明：

- persistent profile 由 CloakBrowser provider / adapter 管理。
- WebEnvoy 只消费 opaque / redacted profile refs。
- profile persistence、profile binding、profile lock 与 login state reuse 是 required inputs，不是 ready facts。

Fail-closed 影响：

- 缺少 `provider_workspace_ref`、`profile_locator_ref` 或 `selected_profile_identity_ref` 时，后续 consumer 必须拒绝 persistent admission。
- profile locator、workspace 或 identity ref 不得使用 raw sensitive path、cookie、token、account credential、license secret 或 broker credential。

### Extension workflow

Extension workflow 应以 static refs 进入 descriptor，而不是定义 business capability matrix 或 runtime command envelope。

Descriptor 必须声明：

- `extension_identity_ref`
- `extension_installation_ref`
- `extension_runtime_ref`
- `workflow_capability_refs`
- `native_bridge_ref`
- `artifact_passthrough_ref`

Fail-closed 影响：

- 缺少 extension identity / installation / runtime / native bridge refs 时，后续 capability matrix 或 health consumer 必须 fail-closed。
- `workflow_capability_refs` 只能指向 #1149 或 provider contract consumer；不能在 FR-0050 中声明 read/write/download/diagnose support rows。

### Provider broker / attach model

`provider_brokered` 是 persistent descriptor 的必要边界：CloakBrowser 或 provider adapter 持有 browser lifecycle，WebEnvoy 只连接到 brokered execution surface。

Fail-closed 影响：

- provider broker ref 缺失、unknown 或 redaction invalid 时，runtime admission 必须 fail-closed。
- broker ref 存在不等于 WebEnvoy 已 attach 到 browser context，不等于 target tab ready。

### Private capability / private patch

CloakBrowser 的 private managed capability 只能作为 opaque limitation 或 health input 表达。

允许表达：

- `persistent_provider_private_patch_required`
- `provider_private_patch_presence_ref`

禁止表达：

- stealth patch field
- browser patch parameter
- driver internal state
- provider secret
- license token
- account operation strategy

Fail-closed 影响：

- 若后续 health owner 无法证明 private managed route 与 declared limitation 一致，应阻断 persistent provider admission。
- private capability presence 不能提升为 `doctor_checked` 以上的 verification level；runtime / live evidence 仍由后续 owner 承接。

## 未决假设

- CloakBrowser provider 的实际 binary/source locator、broker locator、profile namespace 与 extension installation locator 尚未由本 FR 验证。
- Native messaging host identity、manifest、allowed origins 与 bridge reachability 尚未定义；它们只能作为 FR-0038 health input。
- Extension workflow 的 business action support、execution layer、verification threshold 由 #1149 定义。
- Fixture payload、parser behavior、provider registry row、runtime launch envelope、doctor report payload 与 live evidence artifact 均不由本 FR 定义。

## 正式契约影响

- `research.md` 只支撑 descriptor reference slots 和 fail-closed boundary，不作为 runtime readiness evidence。
- `contracts/cloakbrowser-persistent-descriptor.md` 必须提供最小可消费示例，让 downstream parser / fixture / capability matrix / health consumer 能看到 concrete field shape。
- 示例必须保留所有 required limitation refs；不得为了缩小样本而删除 `persistent_requires_*` 或 `persistent_no_*` boundary。
