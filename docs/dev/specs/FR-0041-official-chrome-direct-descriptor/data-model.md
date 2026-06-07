# FR-0041 Data Model

## 1. `official_chrome_descriptor`

`official_chrome_descriptor` 是 official Chrome provider descriptor 的正式 carrier。它只冻结 provider-specific descriptor shape，不承担 runtime state、health result、launch evidence、live evidence 或 fixture 职责。

核心字段：

- `descriptor_id`：当前 direct variant 固定为 `official-chrome.direct`。
- `descriptor_version`：当前固定为 `v1`。
- `common_shape_owner`：固定指向 `#1137` / `FR-0041`。
- `variant_kind`：当前本 suite 只落成 `direct`。
- `provider_identity`：映射到 `FR-0033.provider_identity`。
- `provider_mode`：复用 `FR-0033.ProviderMode`。
- `engine`：映射到 `FR-0033.browser_engine`。
- `transport`：映射到 `FR-0033.automation_transport`。
- `profile_semantics`：只表达 direct profile 承诺边界。
- `capability_declaration_refs`：指向 capability contract / verification model / #1139 owner。
- `limitation_refs`：冻结 direct-specific limitation refs。
- `evidence_reference_slots`：声明未来证据引用槽位。

## 2. Identity lifecycle

`official-chrome.direct` 的 identity lifecycle 只覆盖 descriptor 稳定性：

- `provider_id` 在 WebEnvoy provider namespace 下稳定唯一。
- `provider_version=v1` 表示 descriptor carrier 版本，不等于 Google Chrome 版本。
- `contract_version=v1` 与 `FR-0033.browser_provider_contract.v1` 对齐。
- identity 不表达 installed、doctor checked、runtime ready、live evidence attested 或 fixture available。

若后续 direct implementation 需要 runtime status 或 launch evidence，必须通过对应 runtime/evidence owner 引用本 descriptor，而不是在 descriptor 内增加 runtime state 字段。

## 3. Direct profile semantics

Direct variant 的 profile data model 固定为：

- `profile_kind=ephemeral_direct_profile`
- `profile_persistence=not_guaranteed`
- `login_state_reuse=not_promised`
- `profile_locking=not_promised`
- `cleanup_expectation=best_effort_runtime_cleanup`
- `persistent_delta_owner=#1138`

这些字段只表达承诺边界。它们不得被实现层解释为：

- 已创建 profile directory。
- 已完成 profile cleanup。
- 已获得 user login state。
- 已取得 profile lock。
- 已绑定 extension/native messaging。

## 4. Capability refs

`capability_declaration_refs` 是引用集合，不是 matrix。

允许引用：

- `FR-0033.browser_provider_contract.capabilities`
- `FR-0035.provider_capability_verification_model`
- `#1139`

禁止在本数据模型中表达：

- capability support row。
- supported action / unsupported action matrix。
- verification threshold。
- health coverage。
- launch evidence freshness。

## 5. Limitation refs

Direct-specific limitation refs 是字符串级 contract ids：

- `direct_no_persistent_profile_guarantee`
- `direct_no_extension_binding`
- `direct_no_native_messaging`
- `direct_no_login_state_reuse_promise`
- `direct_no_latest_head_live_evidence`

限制：

- limitation ref 不替代 `FR-0033.BrowserProviderLimitation`。
- limitation ref 不定义 fail-closed policy matrix。
- limitation ref 不定义 health schema 或 evidence schema。
- downstream issue 可消费这些 refs，但不能反向修改 common descriptor shape。

## 6. Evidence reference slots

Evidence slots 是 optional references 的固定名称集合：

- `static_descriptor_ref`
- `registry_entry_ref`
- `capability_matrix_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `fixture_ref`

槽位 lifecycle：

- `static_descriptor_ref` 可由本 suite 对应文档路径满足。
- `registry_entry_ref` 等待 registry consumer 或后续实现填充。
- `capability_matrix_ref` 由 #1139 填充。
- `health_result_ref` 由 health issues 填充，并消费 `FR-0038`。
- `launch_evidence_ref` 由 #1143 填充。
- `fixture_ref` 由 #1144 填充。

槽位存在不代表证据已可用，也不要求 #1137 PR 产生 fresh evidence。

## 7. Registry alignment

后续 registry entry 如消费 direct descriptor，必须保持双层边界：

- `contract_snapshot` 继续满足 `FR-0033.browser_provider_contract.v1`。
- provider-specific descriptor 继续由 `official_chrome_descriptor` 承载。

Registry entry 不得新增私有字段来重新定义 direct descriptor shape；direct descriptor 也不得替代 registry row、selection decision 或 runtime readiness。
