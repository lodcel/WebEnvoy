# FR-0031 数据模型

FR-0031 不新增第二套 anti-detection validation object family。它复用 `FR-0020` 的 request / sample / baseline / record / view truth source，并冻结 creator write admission 需要消费的 scope key 与派生读模型。

## XhsCreatorLiveWriteAdmissionScopeV1

字段：

- `platform`: 固定 `xhs`
- `target_domain`: 固定 `creator.xiaohongshu.com`
- `target_page`: 固定 `creator_publish_tab`
- `browser_channel`: 固定 `Google Chrome stable`
- `execution_surface`: 固定 `real_browser`
- `requested_execution_mode`: 固定 `live_write`
- `profile_ref`: canonical profile namespace
- `probe_bundle_ref`: 固定 `probe-bundle/xhs-creator-live-write-admission-v1`

约束：

- `profile_ref` 不得写死为具体 profile 名。
- `target_domain`、`requested_execution_mode`、`probe_bundle_ref` 任一不匹配都不能作为 creator write admission evidence。

## RuntimePrerequisiteView

派生自 `runtime.status`。

字段：

- `profile_ref`
- `run_id`
- `artifact_identity`
- `profile_root_ref`
- `profile_state`
- `identity_binding_state`
- `identity_preflight_failure_reason`
- `service_worker_freshness_state`
- `runtime_readiness`
- `execution_surface`
- `headless`
- `account_safety_state`

约束：

- `identity_binding_state=bound` 才能通过。
- `EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED` 必须阻断。
- `account_safety_state=clear` 才能通过。
- `run_id` 与 `artifact_identity` 必须能回链到真实浏览器运行证据。

## CreatorTargetBindingView

派生自 `runtime.status.runtimeTakeoverEvidence` 或 `runtime.closeout_gate.closeout_runtime_readiness_preflight.target_binding`。

字段：

- `requested_target_domain`
- `requested_target_page`
- `requested_target_tab_id`
- `profile_ref`
- `run_id`
- `artifact_identity`
- `managed_target_tab_id`
- `managed_target_domain`
- `managed_target_page`
- `target_tab_continuity`
- `observed_run_id`
- `runtime_context_id`

约束：

- requested 与 managed target 必须同域、同页面、同 tab continuity。
- 不能通过上传、提交、发布、文件选择器或 DataTransfer 注入证明。
- target binding evidence 必须能回链到当前 `run_id` 的真实浏览器 artifact。

## CreatorWriteValidationView

派生自 `anti_detection_validation_view`。

scope key：

- `profile_ref`
- `browser_channel=Google Chrome stable`
- `execution_surface=real_browser`
- `effective_execution_mode=live_write`
- `probe_bundle_ref=probe-bundle/xhs-creator-live-write-admission-v1`
- `target_fr_ref`
- `validation_scope`

required rows：

- `FR-0012 / layer1_consistency`
- `FR-0013 / layer2_interaction`
- `FR-0014 / layer3_session_rhythm`

ready 条件：

- `baseline_status=ready`
- `current_result_state=verified`
- `current_drift_state=no_drift`

## CreatorLiveWriteAdmissionDecision

派生读模型，不是新的 writable truth source。

字段：

- `decision`
- `scope`
- `runtime_prerequisite`
- `target_binding`
- `evidence_binding`
- `validation_requirements_satisfied`
- `blocker`
- `checked_at`
- `source_run_id`

约束：

- `GO` 只表示允许进入后续受控上传 live evidence 准备。
- `GO` 不表示上传成功、提交成功或发布成功。
- `NO_GO` 必须携带 blocker layer、code、recovery action。
- `evidence_binding` 缺失或只指向 stub、fake host、`runtime.ping`、`runtime.bootstrap`、控制面存活信号时，必须 `NO_GO`。

## AdmissionEvidenceBinding

派生自 `runtime.status`、`runtime.audit`、`runtime.closeout_gate` 或 non-write readiness probe 的真实浏览器证据引用。

字段：

- `execution_surface=real_browser`
- `run_id`
- `profile_ref`
- `artifact_identity`
- `evidence_source`

约束：

- `artifact_identity` 必须可机器核验，并指向当前 `run_id` 的证据产物。
- `runtime.status`、`runtime.audit`、`runtime.closeout_gate` 若作为证据来源，必须携带或指向该 binding。
- stub、fake host、`runtime.ping`、`runtime.bootstrap` 或仅控制面存活信号不得满足该 binding。
