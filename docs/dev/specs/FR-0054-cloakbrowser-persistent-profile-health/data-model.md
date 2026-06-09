# FR-0054 Data Model

## 核心实体

### `cloakbrowser_persistent_profile_health`

- 职责：承载一次 CloakBrowser persistent profile / extension / native messaging health evaluation 的 provider-specific health result。
- 生命周期：由后续 health implementation 在一次 doctor / admission run 中生成；本 FR 只冻结 formal shape。
- 关键字段：`identity`、`profile_binding`、`profile_state`、`extension_surface`、`native_messaging_surface`、`outcome`。

约束：

- `provider_id` 固定为 `cloakbrowser.persistent`。
- `health_contract_version` 固定为 `v1`。
- 不包含 runtime status、target tab status、command success、capability matrix row、live evidence record 或 private patch schema。

### `PersistentProfileHealthIdentity`

- 职责：绑定 health record 与 provider descriptor、doctor report、run、artifact。
- 关键字段：`persistent_profile_health_id`、`health_contract_version`、`provider_id`、`variant_kind`、`provider_descriptor_ref`、`doctor_report_ref`、`run_id`、`generated_at`、`artifact_identity`。

约束：

- `generated_at` 不得替代每个 signal 的 `collected_at`。
- `artifact_identity` 必须是 redacted / checksum / run-scoped locator，不得是 private absolute path。

### `ProfileBindingSignal`

- 职责：表达 selected profile identity、profile locator 与 provider workspace 是否与 descriptor 输入匹配。
- 关键字段：`profile_binding_ref`、`selected_profile_identity_ref`、`profile_locator_ref`、`provider_workspace_ref`、`identity_match_status`、`locator_resolution_status`、`binding_evidence_status`、`profile_binding_blocking`。

约束：

- 只消费 redacted / opaque / report-local refs。
- 不证明 login state、account safety、target site session 或 runtime attach readiness。

### `ProfileStateSignal`

- 职责：表达 persistent profile 是否具备 required persistence、lock 与并发使用前置。
- 关键字段：`profile_persistence_status`、`profile_lock_status`、`concurrent_use_status`、`runtime_item_health_state`、`controlled_disconnect_ref`、`recovery_path_status`、`cleanup_expectation_observed`、`freshness`、`evidence_refs`。

约束：

- `ephemeral`、`missing`、`locked_by_other`、`stale_lock`、`detected` 或 required unknown 状态必须 fail-closed。
- `runtime_item_health_state=healthy` 只能由 persistent、current-run lock、clear concurrency、fresh evidence 与 valid redaction 共同产生。
- `runtime_item_health_state=disconnected|recoverable|blocked` 命中 required persistent route 时不得进入 `health_passed_requirements`。
- `recovery_path_status` 只表达候选恢复路径或复查需要，不证明恢复已经完成。
- `cleanup_expectation_observed` 只表达健康检查没有要求清空 profile，不定义 cleanup implementation。

### `RuntimeItemHealthStateMatrix`

- 职责：把 profile persistence、lock ownership、concurrency、freshness 与 evidence redaction 映射到 `healthy`、`disconnected`、`recoverable`、`blocked`。
- 生命周期：作为 health validator 的 contract input；不存储 runtime recovery 过程，不执行 remediation。

约束：

- `healthy` 才允许 profile state 进入 passed requirements。
- `disconnected` 表示受控或可审计断开，但仍阻断 runtime admission。
- `recoverable` 表示可尝试恢复或复查，但必须 fail-closed 到新的 fresh health run。
- `blocked` 表示不能安全恢复或证据不足，必须 provider/capability blocking。

### `ExtensionSurfaceSignal`

- 职责：表达 persistent profile 内 extension identity、installation、load、runtime surface 与 selected profile binding。
- 关键字段：`extension_binding_ref`、`extension_identity_ref`、`extension_installation_status`、`extension_load_status`、`extension_runtime_surface_status`、`extension_profile_binding_status`、`service_worker_freshness_ref`。

约束：

- 不定义 extension command envelope、content script injection proof、service worker freshness contract 或 artifact payload。
- extension loaded 不能证明 extension command success。

### `NativeMessagingSurfaceSignal`

- 职责：表达 native host manifest、allowed origin、extension id 与 local transport surface 是否满足准入前置。
- 关键字段：`native_messaging_ref`、`host_manifest_ref`、`allowed_origin_ref`、`extension_id_ref`、`native_host_locator_status`、`allowed_origin_status`、`transport_surface_status`。

约束：

- 不证明 runtime bootstrap ack、message round-trip、command success 或 target tab readiness。
- allowed origin 必须与 extension identity ref 对齐；mismatch 必须 fail-closed。

### `HealthSignalFreshness`

- 职责：绑定每个 required health signal 的采集时间、适用范围与 stale 判断。
- 关键字段：`collected_at`、`freshness_scope`、`freshness_status`、`max_age_policy_ref`、`staleness_reason`。

约束：

- required health signal 只能由 `current_health_run` 或后续明确允许的 `current_runtime_admission` 满足。
- historical / unknown / stale / not_collected 均不得满足 current required health gate。

### `PersistentHealthEvidenceRef`

- 职责：引用 profile、extension、native messaging、broker 或 health artifact 的 redacted evidence。
- 关键字段：`kind`、`ref`、`status`、`collected_at`、`sensitivity`。

约束：

- 不得内联 secret、raw local path、account identifier 或 provider-private payload。
- required signal 的唯一 evidence 为 partial / unavailable / invalid redaction 时，该 signal 不得为 pass。

## 关系

- `provider_descriptor_ref` 指向 `FR-0050.cloakbrowser_persistent_descriptor`。
- `doctor_report_ref` 指向 `FR-0038.provider_doctor_report`。
- profile refs 来自 `FR-0050.CloakBrowserPersistentProfileReference`。
- extension refs 来自 `FR-0050.CloakBrowserExtensionWorkflow` 或后续正式 extension identity owner。
- native messaging refs 来自 `FR-0050.health_requirement_inputs.native_messaging_ref` 或后续正式 native messaging owner。
- evidence refs 消费 `FR-0038.ProviderDoctorEvidenceRef` 与 `FR-0041` redaction policy。

## 生命周期边界

- spec review 阶段：冻结 health object shape、required signal、freshness、evidence 与 fail-closed 语义。
- health implementation 阶段：实现 owner 生成 artifact、采集 health signals、执行 redaction 与 fail-closed parser。
- runtime admission 阶段：runtime owner 消费 `health_checked` 输入，但仍必须验证 target tab、bootstrap、message round-trip 与 command surfaces。
- capability / live 阶段：capability matrix 与 live evidence owner 独立 gated，不从 health pass 直接推导 proof。
