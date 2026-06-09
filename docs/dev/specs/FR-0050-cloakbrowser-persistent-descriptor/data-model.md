# FR-0050 Data Model

## 核心实体

### `cloakbrowser_persistent_descriptor`

- 职责：承载 `cloakbrowser.persistent` 的静态 provider-specific descriptor。
- 生命周期：随 formal spec 版本演进；不是 runtime state。
- 关键字段：`descriptor_id`、`descriptor_version`、`variant_kind`、`provider_identity`、`provider_mode`、`engine`、`transport`、`profile_semantics`、`extension_workflow`、`health_requirement_inputs`、`capability_declaration_refs`、`limitation_refs`、`evidence_reference_slots`。

约束：

- `descriptor_id` 固定为 `cloakbrowser.persistent`。
- `descriptor_version` 固定为 `v1`。
- `variant_kind` 固定为 `persistent`。
- 不包含 health result、runtime readiness、launch evidence、live evidence、fixture payload 或 private patch schema。

### `CloakBrowserPersistentProfileReference`

- 职责：表达后续 health / runtime owner 需要解析的 CloakBrowser persistent profile locator。
- 关键字段：`provider_workspace_ref`、`profile_locator_ref`、`selected_profile_identity_ref`、`locator_sensitivity`、`locator_disclosure`。

约束：

- locator 必须是 redacted、opaque 或 report-local。
- 不得包含 cookie、token、license secret、账号凭据、raw sensitive path 或 provider broker credential。
- 不证明 profile lock、login state、account safety 或 profile ready。

### `CloakBrowserExtensionWorkflow`

- 职责：表达 persistent profile extension workflow 的静态引用槽位。
- 关键字段：`workflow_kind`、`extension_binding_kind`、`extension_identity_ref`、`extension_installation_ref`、`extension_runtime_ref`、`workflow_capability_refs`、`native_bridge_ref`、`artifact_passthrough_ref`。

约束：

- refs 只用于后续 capability matrix / health / runtime owner 消费。
- 不定义 extension install procedure、manifest schema、allowed origins、service worker freshness、runtime message envelope 或 artifact payload。

### `CloakBrowserHealthRequirementInputs`

- 职责：列出 `cloakbrowser.persistent` admission 前必须进入 doctor / health 的 required inputs。
- 关键字段：`expected_binary_source_ref`、`provider_broker_ref`、`profile_binding_ref`、`extension_binding_ref`、`native_messaging_ref`、`display_mode_ref`、`provider_private_patch_presence_ref`、`capability_readiness_ref`。

约束：

- carrier 必须是 `FR-0038.provider_doctor_report` 或后续 runtime / evidence owner。
- input 存在不等于 health pass。
- private patch 只能以 presence ref 表达，不暴露 patch field。

## 关系

- `cloakbrowser_persistent_descriptor.provider_identity` 映射到 `FR-0033.BrowserProviderIdentity`。
- `engine` 映射到 `FR-0033.BrowserEngineDeclaration`。
- `transport` 映射到 `FR-0033.AutomationTransportDeclaration`。
- `capability_declaration_refs` 指向 `FR-0033`、`FR-0035`、`FR-0038` 与 `#1149`。
- `health_requirement_inputs` 由后续 CloakBrowser health issues 消费 `FR-0038` 后落成 check。
- `evidence_reference_slots` 只声明未来槽位，本 FR 只满足 `static_descriptor_ref`。

## 生命周期边界

- spec review 阶段：冻结 descriptor shape 和 reference slots。
- capability matrix 阶段：#1149 消费 descriptor refs，定义 support rows 与 verification thresholds。
- health 阶段：后续 health issues 消费 `FR-0038` 和本 descriptor inputs，定义 required checks。
- runtime 阶段：后续 implementation 消费 matrix / health / evidence，不从 descriptor 直接推导 readiness。
