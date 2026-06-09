# FR-0060 CloakBrowser Docker / Xvfb Doctor

Canonical Issue: #1157

## 背景

`#1157` 属于 `#1114 CloakBrowser Provider` 的 M10 health / admission lane。上游 `FR-0038 Provider Health / Doctor Contract` 已冻结 provider doctor report 的共享对象，`FR-0049` / `FR-0050` / `FR-0051` 已分别冻结 CloakBrowser direct、persistent、cloakserve descriptor 输入，`FR-0058` / `FR-0059` 已冻结 final args 与 fingerprint seed 的证据边界。

当前仍缺一个窄的 Docker / Xvfb 环境 doctor contract：当 CloakBrowser 在 container 或 Xvfb 执行面中运行时，后续实现需要能区分 binary 是否存在、X server 是否可连接、`DISPLAY` 是否一致、headed / headless launch 是否满足 provider policy、字体是否可用，以及 diagnostic output 是否足够定位环境阻断。若没有单独冻结边界，review 和 consumer 容易把“环境 admission 通过”误写成 provider capability support、runtime ready、目标 tab ready 或 fresh live browser success。

本 FR 只冻结 Docker / Xvfb doctor 的 formal spec suite。它不实现 doctor command、Docker image、Xvfb launch、runtime launch、capability matrix、provider adapter、fixtures、workflow、browser patching、XHS、Syvert 或任何 live browser action。

`#1157` 的 issue scope 是 “Distinguish binary, X server, DISPLAY, headed launch, headless launch and font readiness in Docker/Xvfb environments”。因此本 PR 是 formal spec review carrier，合入后只冻结 `FR-0060` suite 与 #1157 sync-map；PR metadata 必须使用 `Refs #1157`，不得自动关闭 #1157。

## 目标

1. 冻结 `cloakbrowser_docker_xvfb_doctor` 的环境/admission doctor 对象边界。
2. 冻结 binary、X server、`DISPLAY`、headed/headless launch、font readiness 与 diagnostic output 的检查语义。
3. 冻结 Docker / Xvfb 环境 doctor 如何消费 `FR-0038.provider_doctor_report`，以及哪些结果只能推进到 environment/admission checked。
4. 明确 Docker / Xvfb doctor 不是 provider capability matrix、runtime attestation、target tab readiness、anti-detection pass 或 live evidence success。
5. 为后续 health doctor implementation、admission gate、capability matrix 与 evidence owner 提供可消费的 fail-closed 输入。

## 非目标

- 不实现 `webenvoy provider doctor`、Docker doctor command、Xvfb probe、runtime launch、provider adapter、CLI、fixtures、tests 或 artifact writer。
- 不创建或修改 Docker image、Dockerfile、entrypoint、workflow、CI、script、Xvfb launch behavior、Playwright launcher 或 browser patch behavior。
- 不定义 capability matrix support rows、verification thresholds、action coverage 或 provider default selection；这些属于后续 capability / selection owner。
- 不定义 real browser live evidence、target tab evidence、page interaction evidence、account safety record 或 closeout evidence。
- 不修改 `FR-0038` 的共享 doctor report shape；本 FR 只定义 CloakBrowser Docker / Xvfb specific environment doctor payload 与 required checks。
- 不触碰 XHS、Syvert normalized result、official Chrome runtime behavior、CloakBrowser private patch schema、license guard、fingerprint seed implementation 或 final args implementation。

## 功能需求

### 1. Contract 定位与 ownership

系统必须冻结一个稳定的 `cloakbrowser_docker_xvfb_doctor` 对象。

约束：

- ownership 属于 `#1157` / `FR-0060`，这是 CloakBrowser provider-specific environment admission doctor surface。
- 该对象只表达 Docker / Xvfb 执行环境是否满足进入后续 provider runtime admission 的本地前置。
- 该对象必须能被 `FR-0038.provider_doctor_report` 引用或嵌入为 provider-specific diagnostics，但不得替代 `FR-0038` 的共享 report shape。
- 该对象不得被解释为：
  - provider capability matrix row
  - runtime status
  - launch evidence record
  - live evidence record
  - target tab readiness
  - account safety pass
  - anti-detection validation record
  - Docker image implementation contract
  - Xvfb lifecycle controller
- 后续 consumer 必须保持 environment/admission doctor 的 non-proof 语义，不得通过私有字段把本对象升级为 runtime/live success。

### 2. Doctor identity

`cloakbrowser_docker_xvfb_doctor.identity` 必须至少冻结：

- `docker_xvfb_doctor_id`
- `docker_xvfb_doctor_version`
- `provider_id`
- `variant_kind`
- `run_id`
- `environment_kind`
- `generated_at`
- `provider_doctor_report_ref`
- `artifact_identity`

约束：

- `docker_xvfb_doctor_version` 当前冻结为 `v1`。
- `provider_id` 只能使用 `cloakbrowser.direct`、`cloakbrowser.persistent` 或 `cloakbrowser.cloakserve`。
- `variant_kind` 只能使用 `direct`、`persistent`、`cloakserve`，且必须与 `provider_id` 匹配。
- `environment_kind` 至少支持 `docker_xvfb`、`docker_headless_only`、`host_x11`、`unknown`。
- `provider_doctor_report_ref` 必须指向同一 run 或同一 admission attempt 的 `FR-0038.provider_doctor_report`，不得引用旧 head 或 unrelated run 作为当前 admission 输入。
- `generated_at` 只表达 doctor 生成时间，不是 browser launch success、runtime attestation 或 live evidence collection time。
- `artifact_identity` 必须是 redacted artifact / run-scoped ref / checksum，不得使用 private absolute path、container secret 或 host mount secret。

### 3. Environment inputs

`cloakbrowser_docker_xvfb_doctor.environment_inputs` 必须至少冻结：

- `container_ref`
- `binary_source_ref`
- `x_server_ref`
- `display_ref`
- `launch_mode_request`
- `font_catalog_ref`
- `diagnostic_command_refs`

约束：

- `container_ref` 只能是 redacted container/run locator、image digest ref 或 environment class ref，不得包含 registry credential、token、host secret 或 raw mount map。
- `binary_source_ref` 必须能映射到 `FR-0038.input_contract_ref.expected_binary_source` 或 provider-specific adapter binary input。
- `x_server_ref` 只表达 X server endpoint locator、socket/display ownership 或 diagnostic ref，不定义 Xvfb spawn command。
- `display_ref` 只表达 `DISPLAY` expected / observed locator，不得包含 raw secret env dump。
- `launch_mode_request` 至少支持 `headed_required`、`headless_requested`、`headless_forbidden`、`diagnostic_only`。
- `font_catalog_ref` 只表达 font readiness diagnostic artifact，不要求列出完整 host font file paths。
- `diagnostic_command_refs` 只允许引用 sanitized command output artifacts，不得内联完整 env、argv、secret、cookie、license token 或 provider credential。

### 4. Required check categories

`cloakbrowser_docker_xvfb_doctor.checks[*].category` 必须至少支持：

- `binary`
- `x_server`
- `display`
- `headed_launch_admission`
- `headless_policy`
- `font_readiness`
- `diagnostic_output`

约束：

- `binary` 检查表达 CloakBrowser executable / provider launcher / adapter binary 是否存在、可执行、来源可解释。
- `x_server` 检查表达 Docker / Xvfb 环境中 X server endpoint 是否存在、可连接、与 expected environment class 匹配。
- `display` 检查表达 `DISPLAY` 是否设置、格式可解析、与 X server ref 一致。
- `headed_launch_admission` 检查表达 headed route 的本地环境前置是否满足；它不得证明 browser process 已启动或页面可交互。
- `headless_policy` 检查表达 requested launch mode 与 descriptor / provider policy 是否冲突；对 CloakBrowser variants，headless 不得满足 real-browser 或 live evidence gate。
- `font_readiness` 检查表达最小 font catalog / fontconfig readiness；它不得证明页面渲染正确、视觉验证通过或 anti-detection pass。
- `diagnostic_output` 检查表达 diagnostic artifact 是否足够 machine-readable、redacted 且可追溯；它不得作为 runtime success 的替代证据。

### 5. Check result 与 diagnostics

每条 `cloakbrowser_docker_xvfb_doctor.checks[*]` 必须至少包含：

- `check_id`
- `category`
- `status`
- `severity`
- `blocking`
- `summary`
- `diagnostics`
- `evidence_refs`

`status` 至少支持：

- `pass`
- `warn`
- `fail`
- `not_applicable`
- `unknown`

`severity` 至少支持：

- `info`
- `warning`
- `error`
- `fatal`

`blocking` 至少支持：

- `none`
- `environment_blocking`
- `provider_blocking`

`diagnostics` 必须至少支持：

- `code`
- `observed`
- `expected`
- `remediation_hint`
- `next_required_gate`

约束：

- `status=unknown` 命中 required Docker / Xvfb admission 输入时必须 fail-closed。
- `severity=fatal` 必须对应 `blocking=provider_blocking` 或 `environment_blocking`。
- `status=fail` 不得对应 `blocking=none`，除非该检查明确只影响未请求 optional diagnostic。
- `diagnostics.code` 必须稳定、机器可读，不得只写自然语言。
- `next_required_gate` 只能列出后续 gate，例如 `runtime_attestation`、`launch_evidence`、`target_tab_binding`、`live_evidence`、`manual_environment_fix`；不得写成这些 gate 已通过。

### 6. Binary readiness boundary

`binary` 检查必须至少表达：

- `source_kind`
- `locator_ref`
- `expected_access`
- `observed_access`
- `version_probe_status`

约束：

- `source_kind` 必须复用 `FR-0038.ProviderDoctorExpectedBinarySource.source_kind` 或后续正式 provider-specific source kind。
- binary path 原文不得进入 PR body、stdout summary 或 public artifact；只允许 redacted locator、basename、hash 或 report-local ref。
- `observed_access=executable|launchable_probe_ok` 只证明本地 admission 前置，不证明 browser honored args、provider patch 生效、runtime ready 或 live page reachable。
- binary missing、not executable、source unknown 或 locator redaction invalid 时，provider admission 必须 fail-closed。

### 7. X server 与 DISPLAY readiness

`x_server` 与 `display` 检查必须至少表达：

- `expected_display`
- `observed_display`
- `x_server_endpoint_ref`
- `socket_or_endpoint_status`
- `connection_probe_status`
- `display_consistency`

约束：

- `DISPLAY` 缺失、格式不可解析、指向不可连接 endpoint、或与 X server ref 不一致时，headed admission 必须 fail-closed。
- X server probe pass 只证明 display endpoint 可连接，不证明 CloakBrowser 启动成功、窗口已创建、页面渲染正确或 user-visible headed behavior 已验证。
- `docker_headless_only` 环境不能满足 CloakBrowser `headless_policy=forbidden` 或 `real_browser` gate。
- 本 FR 不定义 Xvfb spawn、lifecycle、port allocation、cleanup 或 retry policy。

### 8. Headed / headless launch policy

Docker / Xvfb doctor 必须把 launch mode policy 与 environment readiness 分离：

- `headed_launch_admission` 只表达 headed route 的环境前置。
- `headless_policy` 只表达 requested / observed launch mode 与 provider descriptor policy 是否冲突。
- 后续 launch evidence owner 才能证明 browser process launch attempt、args applied、window/session created 或 attachable target。

约束：

- 对 `cloakbrowser.direct`、`cloakbrowser.persistent`、`cloakbrowser.cloakserve`，若 descriptor 声明 `headless_policy=forbidden`，headless-only path 必须 fail-closed。
- `headless_requested` 不得被写成 real-browser success、live browser success 或 target tab ready。
- `headed_launch_admission=pass` 不得自动满足 `runtime_attested`、`live_evidence_attested`、provider capability support 或 target tab binding。
- 若 consumer 需要 business read/write/download capability，Docker / Xvfb doctor pass 最高只能作为进入后续 runtime / launch evidence gate 的前置。

### 9. Font readiness boundary

`font_readiness` 检查必须至少表达：

- `fontconfig_status`
- `minimum_font_set_status`
- `locale_font_status`
- `rendering_risk`
- `font_artifact_ref`

约束：

- `fontconfig_status=missing|unknown` 或 minimum font set 缺失时，若目标 provider/capability 依赖 headed rendering，必须至少输出 `warn`，严重时 fail-closed。
- font readiness pass 只证明环境具备最小字体前置，不证明页面视觉布局正确、反检测安全、截图可信或 live interaction 成功。
- font file raw paths、host mounts、license or account-affine locator 不得进入 public summary。
- 后续 visual / rendering / anti-detection owner 必须独立验证其自身 gate，不得用 font readiness 替代。

### 10. Diagnostic output 与 redaction

Docker / Xvfb doctor diagnostic output 必须至少冻结：

- `artifact_ref`
- `artifact_kind`
- `collection_stage`
- `redaction_state`
- `sensitivity`
- `machine_readable`
- `contains_required_fields`

约束：

- `artifact_kind` 至少支持 `command_output_ref`、`environment_probe_ref`、`x_server_probe_ref`、`font_probe_ref`、`doctor_artifact_ref`。
- `collection_stage` 至少支持 `pre_launch_admission`、`launch_probe_diagnostic`、`post_failure_diagnostic`。
- `sensitivity` 至少支持 `public`、`internal`、`sensitive`、`secret`。
- `redaction_state` 至少支持 `redacted`、`partial`、`invalid`、`not_applicable`。
- `machine_readable=false` 或 required fields 缺失时，不得作为 required check pass 的唯一依据。
- `redaction_state=invalid`、secret leak、raw env dump、raw absolute host path、credential、license token 或 account identifier 出现在 public surface 时必须 fail-closed。

### 11. Aggregate outcome

`cloakbrowser_docker_xvfb_doctor.outcome` 必须至少包含：

- `overall_status`
- `environment_blocked`
- `provider_blocked`
- `admission_verification_level`
- `blocked_reasons`
- `next_required_gates`

`overall_status` 至少支持：

- `pass`
- `warn`
- `fail`
- `unknown`

`admission_verification_level` 只能支持：

- `declared_only`
- `environment_checked`
- `docker_xvfb_doctor_checked`

约束：

- 任一 required environment check `fail|unknown` 且 blocking 时，`overall_status` 必须为 `fail|unknown`。
- `admission_verification_level` 不得写成 `runtime_attested`、`live_evidence_attested`、`capability_allowed` 或 `anti_detection_passed`。
- `next_required_gates` 必须保留后续 runtime / launch / target tab / live evidence / capability matrix gate。
- `overall_status=pass` 只表示 Docker / Xvfb admission 前置可进入下一 gate，不表示 provider runtime 或业务 capability 成功。

### 12. Fail-closed 规则

以下情况必须 fail-closed：

- required binary check 缺失、unknown、fail 或 locator redaction invalid。
- X server endpoint missing、unreachable、unknown 或与 expected display 不一致。
- `DISPLAY` 缺失、不可解析、unknown 或与 X server ref 不一致。
- CloakBrowser descriptor `headless_policy=forbidden` 时使用 headless-only path 满足 required route。
- required diagnostic artifact 缺失、不可读、不是 machine-readable 或 redaction invalid。
- secret、credential、license token、cookie、account identifier、raw env dump 或 raw private host path 出现在 public surface。
- doctor report 声称 runtime ready、target tab ready、provider capability allowed、anti-detection pass 或 live evidence success。
- font readiness unknown 且 consumer 把其作为 required headed rendering 前置。

### 13. 与相邻 FR 的边界关系

本 FR 必须保持以下关系：

- 与 `FR-0038`：Docker / Xvfb doctor 是 provider-specific environment/admission diagnostics，可被 `provider_doctor_report` 引用；不修改共享 doctor report shape。
- 与 `FR-0049` / `FR-0050` / `FR-0051`：本 FR 消费 CloakBrowser variants 的 headed / headless policy 与 provider identity；不重写 descriptor。
- 与 `FR-0058`：final args evidence 仍由 FR-0058 持有；Docker / Xvfb doctor 不证明 args honored。
- 与 `FR-0059`：fingerprint seed policy 仍由 FR-0059 持有；Docker / Xvfb doctor 不证明 fingerprint seed applied 或 anti-detection pass。
- 与 `FR-0016`：真实 live evidence gate 仍由 FR-0016 持有；Docker / Xvfb doctor 不构成 latest-head live evidence。
- 与 Syvert：本 FR 是 WebEnvoy local CloakBrowser environment doctor，不包含 Syvert normalized result、shared provider adapter 或 joint acceptance scope。

## GWT 验收场景

### 场景 1：Docker / Xvfb doctor 只证明环境 admission

Given Docker / Xvfb doctor 的 binary、X server、DISPLAY 与 font readiness checks 全部 pass
When 后续 consumer 更新 provider verification
Then 最高只能进入 `docker_xvfb_doctor_checked`
And 不得写成 `runtime_attested`、`live_evidence_attested` 或 capability allowed

### 场景 2：DISPLAY 与 X server 不一致时阻断 headed admission

Given `expected_display=:99`
And X server probe 指向不同 endpoint 或不可连接
When Docker / Xvfb doctor 聚合 outcome
Then `overall_status` 必须为 `fail`
And `environment_blocked=true`
And 后续 headed launch admission 不得继续放行

### 场景 3：headless-only 环境不能满足 CloakBrowser real-browser route

Given CloakBrowser descriptor 声明 `headless_policy=forbidden`
And Docker doctor 只发现 `docker_headless_only`
When consumer 评估 `headless_policy`
Then 必须 fail-closed
And 不得把 headless launch probe 写成 real-browser success

### 场景 4：font readiness 不等于视觉或反检测通过

Given font readiness check pass
When reviewer 检查 semantic conclusion
Then 该结论只能证明 minimum font environment 前置
And 不得证明页面渲染正确、截图可验、anti-detection pass 或 live interaction success

### 场景 5：diagnostic output 泄露 secret 时失效

Given diagnostic artifact 包含 raw env dump、credential、license token 或 host private path
When Docker / Xvfb doctor redaction validator 消费该 artifact
Then diagnostic output 必须标记为 invalid
And required check 不得 pass
And public PR body 不得包含 secret 原文

### 场景 6：本 FR 不改 capability matrix

Given `cloakbrowser_docker_xvfb_doctor.outcome.overall_status=pass`
When #1149 或后续 capability owner 消费该结果
Then 只能把它作为 environment/admission input
And 不得自动新增 read/write/download capability support row

## 异常与边界场景

- `environment_kind=unknown` 且 consumer 需要 Docker / Xvfb admission：必须阻断。
- binary probe 能执行 `--version` 但 X server 不可连接：binary 可 pass，headed admission 必须 fail。
- X server probe pass 但 `DISPLAY` 缺失：display check 必须 fail，不能靠 endpoint ref 推断。
- headed admission pass 但 launch evidence 缺失：仍需后续 launch/runtime gate。
- diagnostic artifact 只有自由文本且缺少 required fields：不得作为 required pass 的唯一依据。
- font readiness unknown：可以作为 warning 进入 diagnostic-only scope；若被 required headed rendering gate 消费，必须 fail-closed。
- historical artifact 或旧 run Docker doctor report 不得作为当前 PR latest head live evidence。

## 验收标准

1. Formal suite 冻结 Docker / Xvfb doctor 的 identity、environment inputs、checks、diagnostics、diagnostic artifact、outcome 与 fail-closed 规则。
2. Suite 明确 binary、X server、DISPLAY、headed/headless launch、font readiness 与 diagnostic output 的证据边界。
3. Suite 明确 Docker / Xvfb doctor 是 environment/admission doctor，不等于 provider capability、runtime attestation、target tab readiness、anti-detection pass 或 live browser success。
4. Suite 与 `FR-0038`、CloakBrowser descriptor、final args、fingerprint seed 与 live evidence governance 的 ownership 对齐。
5. 当前 PR 只包含 `FR-0060` formal suite 与 `.github/spec-issue-sync-map.yml` 中单条 #1157 映射，closing semantics 使用 `Refs #1157`。

## 完成定义

本 suite 合入后，`#1157` 的 Docker / Xvfb Doctor formal contract 输入达到 PR-ready：

1. `spec.md`、`plan.md`、`TODO.md`、`contracts/`、`data-model.md`、`research.md`、`risks.md` 齐备。
2. `#1157` 与 `FR-0060` 的 sync-map 已建立。
3. PR 保持 refs-only 语义，供 scheduler 运行 formal review / merge gate。
4. 后续 implementation owner 可基于本 suite 实现 doctor command / probes，但本 PR 不实现任何 runtime 行为。
