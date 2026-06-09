# FR-0051 风险与缓解

## 风险 1：cloakserve descriptor 被误读为 runtime ready

- 表现：后续 selection 或 runtime admission 看到 `cloakbrowser.cloakserve` descriptor 后直接允许运行业务命令。
- 影响：绕过 FR-0033/FR-0035/#1149/#1152/FR-0038/FR-0040/FR-0041 和 runtime evidence 门禁。
- 缓解：本 suite 明确 descriptor 不是 runtime status、health result 或 launch evidence；evidence slots 默认不表示 evidence 可用。

## 风险 2：上游 extension support 被误读为 WebEnvoy extension bridge ready

- 表现：后续 consumer 看到 upstream extension loading 能力后，把 WebEnvoy content script、relay bridge、service worker 或 Native Messaging 视为可用。
- 影响：扩展 runtime 能力被错误放行，绕过 extension identity、install mode、service worker readiness 和 Native Messaging policy。
- 缓解：本 suite 固定 `default_extension_binding=disabled`、`webenvoy_extension_bridge=unsupported_by_default`、`native_messaging_bridge=unsupported` 与 `cloakserve_default_extension_disabled` limitation。

## 风险 3：experimental extension workflow 被提前升级为 supported capability

- 表现：#1148 PR 中声明 extension workflow supported，或 #1149 未经 evidence 就将 extension-related capability 设为 allow。
- 影响：#1152 limitation gate 无法 fail-closed，runtime owner 被迫消费未验证扩展路径。
- 缓解：`extension_paths_input=experimental_reference_only`，并要求未来 owner 独立覆盖 extension identity、install mode、service worker readiness、Native Messaging policy、profile binding 与 evidence freshness。

## 风险 4：CDP endpoint security boundary 被忽略

- 表现：consumer 只检查 `cdp_support=supported`，不验证 endpoint binding、auth、origin guard、network exposure、fingerprint routing 或 process cleanup。
- 影响：远程控制面可能被误当作安全执行面。
- 缓解：加入 `cloakserve_cdp_endpoint_security_not_attested` limitation，并要求 health / limitation / evidence owner 后续补证。

## 风险 5：CloakBrowser 私有 patch 细节进入 WebEnvoy core contract

- 表现：descriptor 内联 fingerprint patch、driver internals、browser flags、seed schema 或 provider private implementation details。
- 影响：WebEnvoy core contract 被外部 provider 私有实现污染，后续维护和 review 边界失效。
- 缓解：只保留 `cloakserve_provider_private_patch_required` limitation，不展开 patch schema。

## 风险 6：#1148 扩 scope 到 #1146/#1147/#1149/#1152

- 表现：本 suite 顺手定义 direct/persistent descriptor、capability matrix rows、limitation gate policy 或 fixture payload。
- 影响：并行 lane ownership 冲突，scheduler 无法独立消费 worker output。
- 缓解：spec/plan/TODO 均明确 #1148 只冻结 cloakserve descriptor / limitation；后续 owner 单独承接。

## 风险 7：文档 PR 混入 runtime 或 forbidden paths

- 表现：本 PR 修改 runtime behavior、src/commands、src/runtime、workflows、scripts、hooks 或治理冻结文件。
- 影响：高风险 contract PR 变成实现 PR，超出 scheduler 授权。
- 缓解：PR 纯度只允许 FR-0051 suite 与 spec sync map；验证执行 docs/spec guard、map validation、diff check 和 purity check。
