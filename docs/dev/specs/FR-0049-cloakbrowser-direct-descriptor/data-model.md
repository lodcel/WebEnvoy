# FR-0049 Data Model

## 1. `cloakbrowser_descriptor`

`cloakbrowser_descriptor` 是 CloakBrowser provider descriptor 的 formal carrier。本 FR 只落成 `cloakbrowser.direct` direct variant，不承担 runtime state、health result、launch evidence、live evidence、fixture、private patch manifest 或 Syvert mapping 职责。

核心字段：

- `descriptor_id`: 当前 direct variant 固定为 `cloakbrowser.direct`。
- `descriptor_version`: 当前固定为 `v1`。
- `common_shape_owner`: 固定指向 `#1146` / `FR-0049`。
- `variant_kind`: 当前本 suite 只落成 `direct`。
- `provider_identity`: 映射到 `FR-0033.provider_identity`。
- `provider_mode`: 复用 `FR-0033.ProviderMode`。
- `engine`: 映射到 `FR-0033.browser_engine`。
- `transport`: 映射到 `FR-0033.automation_transport`。
- `profile_semantics`: 只表达 direct profile 承诺边界。
- `extension_path_handling`: 只表达 Launch Envelope extension path locator 消费规则。
- `final_args_evidence`: 只表达未来 redacted final args evidence slot 和披露限制。
- `fingerprint_seed_boundary`: 只表达 provider-managed seed / private patch redaction boundary。
- `capability_declaration_refs`: 指向 provider contract / verification model / #1149 owner。
- `limitation_refs`: 冻结 direct-specific limitation refs。
- `evidence_reference_slots`: 声明未来证据引用槽位。

## 2. Identity lifecycle

`cloakbrowser.direct` 的 identity lifecycle 只覆盖 descriptor 稳定性：

- `provider_id` 在 WebEnvoy provider namespace 下稳定唯一。
- `provider_family=managed_browser_provider` 表达外部 managed browser provider surface，不把 CloakBrowser 升级为 WebEnvoy core。
- `provider_version=v1` 表示 descriptor carrier version，不等于 CloakBrowser binary version。
- `contract_version=v1` 与 `FR-0033.browser_provider_contract.v1` 对齐。
- `distribution_channel=external_adapter` 不证明 adapter 已安装、license 已满足或 provider 可启动。

Identity 不表达 installed、licensed、doctor checked、runtime ready、anti-detection pass、live evidence attested 或 fixture available。

## 3. Direct profile semantics

Direct variant 的 profile data model 固定为：

- `profile_kind=ephemeral_provider_profile`
- `profile_persistence=not_guaranteed`
- `login_state_reuse=not_promised`
- `profile_locking=not_promised`
- `cleanup_expectation=provider_managed_best_effort_cleanup`
- `persistent_delta_owner=#1147`

这些字段只表达承诺边界。它们不得被实现层解释为：

- 已创建 profile directory。
- 已完成 cleanup。
- 已恢复 user login state。
- 已获得 profile lock。
- 已绑定 persistent extension 或 native messaging。
- 已通过 account safety health。

## 4. Extension path data model

`extension_path_handling` 的真相源是 `FR-0037.launch_envelope.runtime_bindings.extension_paths`。

允许的 descriptor-level values：

| 字段 | 当前值 | 含义 |
|---|---|---|
| `extension_input_source` | `FR-0037.launch_envelope.runtime_bindings.extension_paths` | direct launch extension 输入来自 Launch Envelope |
| `extension_binding_mode` | `dev_unpacked_extension` | 只表达 launch-time unpacked extension input，不表达 persistent extension identity |
| `accepted_locator_kinds` | `extension_asset_ref`, `workspace_artifact_ref` | 只接受 redacted locator / artifact ref |
| `path_materialization_owner` | `launch_admission_or_adapter` | materialized path 由后续 launch admission / adapter 持有 |
| `path_redaction_policy` | `redacted_locator_only` | descriptor / PR metadata 不披露完整本机路径 |
| `stable_extension_identity` | `not_promised` | direct descriptor 不证明 extension id 或 service worker freshness |

禁止把以下内容写入 descriptor、PR metadata 或 fixture seed：

- full local sensitive path
- extension private content
- run/session secret
- Cookie / token / proxy credential
- fingerprint seed value
- stable extension id pass result

## 5. Final args evidence data model

`final_args_evidence` 是 future evidence slot，不是本 PR 的 evidence record。

允许披露：

- `arg_keys`
- `redacted_values`
- `extension_locator_refs`
- `path_hashes`
- `provider_contract_ref`
- `launch_envelope_ref`

禁止披露：

- `full_local_paths`
- `cookies`
- `tokens`
- `proxy_credentials`
- `fingerprint_seed_values`
- `private_patch_payload`
- `page_content`

语义边界：

- redacted final args snapshot 只能证明 launch input shape。
- redacted final args snapshot 不证明 browser honored args。
- redacted final args snapshot 不证明 runtime ready、health pass、anti-detection pass 或 live evidence attested。
- stale、missing、unknown 或 unredacted final args evidence 在影响目标 capability 时必须 fail-closed。

## 6. Fingerprint seed boundary

Direct descriptor 的 fingerprint seed data model 固定为 provider-managed boundary：

- `seed_policy=provider_managed`
- `seed_ref_policy=redacted_locator_only`
- `patch_manifest_ref_policy=provider_private_ref_only`
- `rotation_policy=provider_managed`
- `disclosure_boundary=no_seed_values_no_private_patch_schema`

这些字段只允许下游知道 seed / patch 由 provider 管理。它们不得被解释为：

- seed 已应用。
- fingerprint consistency 已通过。
- anti-detection baseline 已通过。
- private patch schema 已成为 WebEnvoy core contract。

## 7. Capability refs

`capability_declaration_refs` 是引用集合，不是 matrix。

允许引用：

- `FR-0033.browser_provider_contract.capabilities`
- `FR-0035.provider_capability_verification_model`
- `#1149`

禁止在本数据模型中表达：

- capability support row。
- supported action / unsupported action matrix。
- verification threshold。
- health coverage。
- launch evidence freshness。
- runtime default eligibility。

## 8. Limitation refs

Direct-specific limitation refs 是字符串级 contract ids：

- `direct_no_persistent_profile_guarantee`
- `direct_no_login_state_reuse_promise`
- `direct_extension_paths_are_locator_only`
- `direct_no_stable_extension_identity`
- `direct_no_native_messaging`
- `direct_final_args_evidence_redacted_only`
- `direct_no_descriptor_level_runtime_readiness`
- `direct_no_latest_head_live_evidence`
- `direct_provider_private_patch_not_core_contract`
- `direct_fingerprint_seed_not_disclosed`

限制：

- limitation ref 不替代 `FR-0033.BrowserProviderLimitation`。
- limitation ref 不定义 fail-closed policy matrix。
- limitation ref 不定义 health schema、evidence schema 或 runtime behavior。
- downstream issue 可消费这些 refs，但不能反向修改 direct descriptor facts。

## 9. Evidence slots

Evidence slots 是 optional references 的固定名称集合：

- `static_descriptor_ref`
- `registry_entry_ref`
- `capability_matrix_ref`
- `health_result_ref`
- `launch_evidence_ref`
- `final_args_evidence_ref`
- `fixture_ref`

槽位 lifecycle：

- `static_descriptor_ref` 可由本 suite 对应文档路径满足。
- `registry_entry_ref` 等待 registry consumer 或后续 implementation owner 填充。
- `capability_matrix_ref` 由 #1149 填充。
- `health_result_ref` 由后续 CloakBrowser health owner 填充，并消费 `FR-0038`。
- `launch_evidence_ref` 与 `final_args_evidence_ref` 由后续 launch evidence owner 填充，并消费 `FR-0037`、`FR-0040`、`FR-0041`。
- `fixture_ref` 由后续 fixture owner 填充。

槽位存在不代表证据已可用，也不要求 #1146 PR 产生 fresh evidence。

## 10. Registry alignment

后续 registry entry 如消费 direct descriptor，必须保持双层边界：

- `contract_snapshot` 继续满足 `FR-0033.browser_provider_contract.v1`。
- provider-specific descriptor 继续由 `cloakbrowser_descriptor` 承载。

Registry entry 不得新增私有字段来重新定义 direct descriptor shape；direct descriptor 也不得替代 registry row、selection decision、license guard、provider installation fact 或 runtime readiness。
