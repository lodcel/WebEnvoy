# FR-0054 CloakBrowser Persistent Profile Health

Canonical Issue: #1151

## 背景

`#1151` 属于 `#1114 CloakBrowser Provider` 的 M10 health lane，目标是在 persistent CloakBrowser workflow 进入 runtime admission、capability matrix 与后续 implementation 前，冻结 persistent profile 与 extension load health 的 formal contract。

上游 `FR-0038 Provider Health / Doctor Contract` 已冻结 provider doctor report、health check category、evidence refs 与 fail-closed 规则；`FR-0050 cloakbrowser.persistent Descriptor` 已声明 persistent profile、extension workflow、native messaging 与 provider broker attachment 都是 required inputs，但它刻意不定义 health result schema。本 FR 承接二者之间的缺口：定义 `cloakbrowser_persistent_profile_health` 如何表达 profile binding、extension/native messaging surface、state freshness、evidence redaction 与 fail-closed 输出边界。

本 FR 只冻结 formal spec suite。它不实现 runtime code、doctor command、extension loading behavior、capability matrix、limitation gate、Native Messaging bridge、CloakBrowser browser patching、XHS、Syvert 或任何 real-browser / live evidence execution。

`#1151` 的 issue scope 是 “Validate persistent profile and extension load health for CloakBrowser persistent workflows”。因此本 suite 合入后只让 #1151 达到 formal contract PR-ready；PR metadata 必须使用 `Refs #1151`，不得使用 auto-close keyword 关联 #1151。

## 目标

1. 冻结 `cloakbrowser_persistent_profile_health` 的对象边界与 ownership。
2. 冻结 persistent profile binding、profile persistence、profile lock、selected profile identity 与 login-state reuse 的 health signal 语义。
3. 冻结 extension load、extension identity、extension runtime surface 与 Native Messaging surface 的 required health signals。
4. 冻结 state freshness、evidence refs、redaction 与 artifact identity 的最小规则。
5. 冻结 fail-closed 输出边界，明确这些 health signals 不等于 runtime/live success、capability proof、target tab ready 或 account safety pass。

## 非目标

- 不实现 `webenvoy provider doctor`、runtime status、profile scanner、extension probe、Native Messaging probe、CLI、fixtures、tests 或 artifact writer。
- 不修改 CloakBrowser descriptor、provider registry、capability matrix、provider evidence kernel、redaction policy 或 launch envelope 的既有字段 shape。
- 不安装、加载、卸载、修复或迁移 Chrome extension。
- 不定义 extension manifest schema、service worker command envelope、runtime message protocol 或 native host implementation。
- 不证明 real browser attach、target tab binding、page context readiness、business read/write/download capability、live evidence 或 anti-detection effectiveness。
- 不暴露 raw profile path、cookie、token、account identifier、license secret、provider broker credential、Native Messaging secret、extension private state 或 CloakBrowser private patch payload。
- 不推进 `#1149/#1150/#1152/#1153/#1154/#1155/#1156/#1157` 的 spec 或实现范围。

## 功能需求

### 1. Contract 定位与 ownership

系统必须冻结一个稳定的 `cloakbrowser_persistent_profile_health` 对象。

约束：

- 该对象属于 CloakBrowser persistent variant 的 provider-specific health contract surface。
- 该对象消费 `FR-0050.cloakbrowser_persistent_descriptor.health_requirement_inputs` 与 `FR-0038.provider_doctor_report`，不得新增 parallel doctor result object。
- 该对象只表达 persistent profile 与 extension/native messaging health signals 的机器可读结果。
- 该对象不得被解释为：
  - runtime status
  - launch evidence
  - capability matrix row
  - limitation gate result
  - live evidence record
  - account safety attestation
  - target tab attestation
  - CloakBrowser private patch manifest
- 后续 consumer 必须保持本 FR 的 fail-closed 与 non-proof 语义，不得通过私有字段把 health pass 升级为 runtime/live/capability proof。

### 2. Health identity

`cloakbrowser_persistent_profile_health.identity` 必须至少冻结：

- `persistent_profile_health_id`
- `health_contract_version`
- `provider_id`
- `variant_kind`
- `provider_descriptor_ref`
- `doctor_report_ref`
- `run_id`
- `generated_at`
- `artifact_identity`

约束：

- `health_contract_version` 当前冻结为 `v1`。
- `provider_id` 固定为 `cloakbrowser.persistent`。
- `variant_kind` 固定为 `persistent`。
- `provider_descriptor_ref` 必须指向 `FR-0050` 的 descriptor contract 或后续等价 descriptor artifact。
- `doctor_report_ref` 必须指向 `FR-0038.provider_doctor_report`，不得内联完整 doctor artifact。
- `run_id` 是 health / doctor 评估运行标识；它不是 browser process id、profile id、tab id、account id 或 live evidence run id。
- `generated_at` 只表达 health record 生成时间；不得被当成 profile state 采集时间、runtime attestation 时间或 live evidence 时间。
- `artifact_identity` 必须是 redacted artifact / checksum / run-scoped locator，不得是 private absolute path。

### 3. Profile binding signals

`profile_binding` health signals 必须至少表达：

- `profile_binding_ref`
- `selected_profile_identity_ref`
- `profile_locator_ref`
- `provider_workspace_ref`
- `identity_match_status`
- `locator_resolution_status`
- `binding_evidence_status`
- `profile_binding_blocking`

约束：

- refs 必须来自 `FR-0050.CloakBrowserPersistentProfileReference` 或其 redacted health input，不得现场发明未绑定 descriptor 的 profile identity。
- `identity_match_status` 至少支持 `match`、`mismatch`、`unknown`。
- `locator_resolution_status` 至少支持 `resolved`、`unresolved`、`not_accessible`、`unknown`。
- `binding_evidence_status` 至少支持 `available`、`partial`、`unavailable`、`invalid_redaction`。
- `profile_binding_blocking` 至少支持 `none`、`capability_blocking`、`provider_blocking`。
- `mismatch`、`unknown`、`unresolved`、`not_accessible`、`unavailable` 或 `invalid_redaction` 命中 required persistent route 时，consumer 必须 fail-closed。
- profile binding pass 不证明 login state exists、account safe、target site session usable、runtime attach ready 或 live success。

### 4. Profile persistence and lock signals

`profile_state` health signals 必须至少表达：

- `profile_persistence_status`
- `profile_lock_status`
- `concurrent_use_status`
- `profile_state_freshness`
- `cleanup_expectation_observed`
- `state_evidence_refs`

约束：

- `profile_persistence_status` 至少支持 `persistent`、`ephemeral`、`missing`、`unknown`。
- `profile_lock_status` 至少支持 `locked_by_current_run`、`locked_by_other`、`stale_lock`、`unlocked`、`unknown`。
- `concurrent_use_status` 至少支持 `clear`、`suspected`、`detected`、`unknown`。
- `profile_state_freshness` 必须使用本 FR 的 freshness model；不得用 `generated_at` 替代采集时间。
- persistent route required 时，`ephemeral`、`missing`、`locked_by_other`、`stale_lock`、`detected` 或 `unknown` 必须 fail-closed，除非后续独立 FR 明确某个 diagnostic-only mode 可降级。
- `cleanup_expectation_observed=preserve_profile_state` 只说明健康检查没有要求清空 profile；不得被解释为 cleanup implementation 已通过。

### 5. Extension load and runtime surface signals

`extension_surface` health signals 必须至少表达：

- `extension_binding_ref`
- `extension_identity_ref`
- `extension_installation_status`
- `extension_load_status`
- `extension_runtime_surface_status`
- `extension_profile_binding_status`
- `service_worker_freshness_ref`
- `extension_evidence_refs`

约束：

- `extension_identity_ref` 与 `extension_binding_ref` 必须来自 `FR-0050.extension_workflow` 或后续正式 extension identity owner。
- `extension_installation_status` 至少支持 `installed`、`missing`、`ambiguous`、`unknown`。
- `extension_load_status` 至少支持 `loaded`、`not_loaded`、`load_error`、`unknown`。
- `extension_runtime_surface_status` 至少支持 `surface_visible`、`surface_missing`、`surface_stale`、`unknown`。
- `extension_profile_binding_status` 至少支持 `bound_to_selected_profile`、`bound_to_other_profile`、`unbound`、`unknown`。
- required persistent route 命中 `missing`、`ambiguous`、`not_loaded`、`load_error`、`surface_missing`、`surface_stale`、`bound_to_other_profile`、`unbound` 或 `unknown` 时必须 fail-closed。
- `service_worker_freshness_ref` 只能指向 service worker freshness owner 或 artifact；本 FR 不定义 service worker freshness contract。
- extension load pass 不证明 extension command worked、page content script injected、target tab ready、Native Messaging round-trip succeeded 或 live evidence accepted。

### 6. Native Messaging surface signals

`native_messaging_surface` health signals 必须至少表达：

- `native_messaging_ref`
- `host_manifest_ref`
- `allowed_origin_ref`
- `extension_id_ref`
- `native_host_locator_status`
- `allowed_origin_status`
- `transport_surface_status`
- `native_messaging_evidence_refs`

约束：

- `native_messaging_ref` 必须来自 `FR-0050.health_requirement_inputs.native_messaging_ref` 或后续正式 native messaging owner。
- `native_host_locator_status` 至少支持 `resolved`、`missing`、`not_accessible`、`unknown`。
- `allowed_origin_status` 至少支持 `matches_extension`、`mismatch`、`missing`、`unknown`。
- `transport_surface_status` 至少支持 `surface_available`、`surface_missing`、`surface_error`、`unknown`。
- required persistent route 命中 `missing`、`not_accessible`、`mismatch`、`surface_missing`、`surface_error` 或 `unknown` 时必须 fail-closed。
- Native Messaging surface health 只能证明 manifest / allowed origin / local transport surface 的准入事实；不得证明 runtime bootstrap ack、message round-trip、command success、target tab readiness 或 business capability。

### 7. State freshness model

所有 required health signal 必须绑定 `freshness`：

- `collected_at`
- `freshness_scope`
- `freshness_status`
- `max_age_policy_ref`
- `staleness_reason`

约束：

- `freshness_scope` 至少支持 `current_health_run`、`current_runtime_admission`、`historical_background`、`unknown`。
- `freshness_status` 至少支持 `fresh`、`stale`、`not_collected`、`unknown`。
- required health signal 只能由 `current_health_run` 或后续明确允许的 `current_runtime_admission` 满足。
- `historical_background`、`unknown`、`stale`、`not_collected` 或 `unknown` 命中 required signal 时必须 fail-closed。
- `max_age_policy_ref` 必须是 policy ref 或 report-local policy id；不得只写自由文本。
- freshness 只约束 health signal 新鲜度，不等于 latest-head live evidence rerun。

### 8. Evidence refs and redaction

`evidence_refs[*]` 必须消费 `FR-0038.ProviderDoctorEvidenceRef` 与 `FR-0041` redaction policy，且至少支持：

- `profile_state_ref`
- `profile_lock_ref`
- `extension_state_ref`
- `native_manifest_ref`
- `provider_broker_ref`
- `health_artifact_ref`

约束：

- `ref` 必须是 artifact locator、redacted locator、diagnostic id、checksum 或 run-scoped opaque handle。
- evidence 不得内联 raw profile path、cookie、token、account identifier、license secret、provider broker credential、Native Messaging secret、extension private state 或 private patch payload。
- `sensitivity=secret` 的 evidence 只能以 redacted / opaque locator 表达，不得进入 PR body、stdout summary、spec sample 或 public artifact。
- required health signal 的唯一 evidence 为 `partial`、`unavailable` 或 `invalid_redaction` 时，该 signal 不得为 pass。

### 9. Aggregate outcome

`cloakbrowser_persistent_profile_health.outcome` 必须至少包含：

- `overall_status`
- `provider_blocked`
- `blocked_capabilities`
- `health_verification_level`
- `health_passed_requirements`
- `health_failed_requirements`
- `next_required_gates`
- `does_not_prove`

约束：

- `overall_status` 至少支持 `pass`、`warn`、`fail`、`unknown`。
- `health_verification_level` 只能为 `declared_only`、`doctor_checked` 或 `health_checked`，不得写 `runtime_attested` 或 `live_evidence_attested`。
- 任一 required signal 缺失、fail、unknown、stale 或 redaction-invalid 时，`overall_status` 必须为 `fail|unknown`，并设置 provider 或 capability blocking。
- `health_passed_requirements` 只能列出本 FR 能证明的 local/admission health requirements。
- `next_required_gates` 必须至少支持 `runtime_attestation`、`target_tab_binding`、`capability_matrix`、`live_evidence`、`manual_review`。
- `does_not_prove` 必须至少包含：
  - `runtime_ready`
  - `runtime_bootstrap_success`
  - `target_tab_ready`
  - `extension_command_success`
  - `native_messaging_round_trip_success`
  - `capability_allowed`
  - `account_safety_pass`
  - `anti_detection_pass`
  - `live_evidence_attested`

### 10. Fail-closed rules

consumer 必须按以下情况 fail-closed：

- required profile binding、profile state、extension surface 或 native messaging surface signal 缺失。
- signal status 为 fail、unknown、stale、not_collected 或 invalid redaction。
- selected profile identity 与 descriptor reference 不匹配。
- profile locator 不可解析、不可访问或指向 ephemeral / wrong profile。
- profile lock 被其他 run 持有、疑似 stale，或 concurrent use 被检测到。
- extension missing、not loaded、load error、runtime surface stale/missing，或绑定到非 selected profile。
- Native Messaging manifest missing、allowed origin mismatch、host locator not accessible 或 transport surface missing/error。
- required evidence refs 缺失、不可用、partial 或 sensitivity 违反 redaction 边界。
- health record 声称满足 `runtime_bootstrap_success`、`target_tab_ready`、`capability_allowed`、`runtime_attested` 或 `live_evidence_attested`。
- health record 使用历史 artifact 或旧 run 作为 required current health evidence。

## GWT 验收场景

### 场景 1：profile health pass 不等于 runtime ready

Given `cloakbrowser_persistent_profile_health` 的 profile binding、persistence 与 lock signals 全部为 pass
When consumer 读取 `outcome.health_verification_level`
Then verification level 最高只能为 `health_checked`
And `next_required_gates` 必须仍包含 `runtime_attestation`
And 不得输出 `runtime_ready` 或 `live_evidence_attested`

### 场景 2：selected profile 不匹配必须阻断

Given descriptor 声明了 selected profile identity ref
And health signal 的 observed profile identity 与 descriptor ref 不匹配
When admission consumer 校验 profile binding
Then provider 或目标 capability 必须 fail-closed
And 不得继续消费 extension load pass 作为替代证明

### 场景 3：extension loaded 不证明 extension command worked

Given extension installation 与 load status 都为 pass
When runtime owner 需要执行 extension command 或 content script action
Then 必须继续经过 runtime / target tab / command gate
And 不得把 extension load health 写成 command success 或 capability proof

### 场景 4：Native Messaging surface 只证明准入面

Given Native Messaging manifest、allowed origin 与 host locator 均可解析
When consumer 评估 runtime bootstrap 是否成功
Then Native Messaging surface health 不能直接满足 `runtime_bootstrap_success`
And 必须保留 message round-trip 或 runtime attestation gate

### 场景 5：历史 artifact 不能满足 current health

Given health record 引用了历史 extension state artifact
And freshness_scope 为 `historical_background`
When required persistent health gate 需要当前 health run
Then consumer 必须 fail-closed
And 输出 staleness blocker

### 场景 6：redaction invalid 直接失效

Given profile evidence ref 泄露 raw profile path、cookie 或 account identifier
When health consumer 校验证据
Then 该 health record 必须标记为 invalid
And 不得进入 provider selection、capability allow 或 PR public summary。

## 异常与边界场景

- `profile_lock_status=unlocked` 不自动通过；若 persistent route 要求执行隔离，consumer 必须继续验证 lock ownership 或进入 fail-closed。
- `extension_runtime_surface_status=surface_visible` 不证明 service worker fresh；freshness 必须由专门 owner 或 artifact ref 支撑。
- provider broker 可见不证明 selected profile 已 attach 到 target context；target context 属于 runtime owner。
- login-state reuse 只表达 persistent profile 的预期价值，不证明目标站点已登录或账号安全。
- health signal pass 可以作为 capability matrix / runtime admission 的输入，但不得单独让 business capability 默认可选。

## 验收标准

1. Formal suite 明确 `cloakbrowser_persistent_profile_health` 的 ownership、identity、profile binding、extension/native messaging surface、freshness、evidence 与 outcome 边界。
2. Formal suite 明确所有 required health signals 的 fail-closed 条件。
3. Formal suite 明确 profile / extension / native messaging health 不等于 runtime ready、live evidence、capability proof 或 account safety pass。
4. Formal suite 使用 refs-only 语义关联 #1151，保持 issue 打开供后续实现与 gate 消费。
5. Formal suite 只修改 FR-0054 路径与 #1151 sync-map entry，不触碰 runtime code 或相邻 CloakBrowser suites。

## 完成定义

本 suite 达到 PR-ready 后：

1. `spec.md`、`plan.md`、`TODO.md`、`contracts/`、`data-model.md`、`research.md`、`risks.md` 齐备。
2. `#1151` 与 `FR-0054` 的 sync-map 已建立。
3. PR body 使用 `Closing: Refs #1151`，并提供 parser-ready metadata。
4. 本地 docs/spec/sync-map/purity/diff validation 通过。
5. worker 停在 `waiting-scheduler-gate`，由 scheduler 拥有 guardian、formal review、merge 与 issue closeout。
