# FR-0053 CloakBrowser Direct Launch Health

Canonical Issue: #1150

## 背景

`#1150` 属于 `#1114 CloakBrowser Provider` 的 M10 health lane。上游 `FR-0038 Provider Health / Doctor Contract` 已冻结 provider doctor report 的通用健康检查对象，`FR-0049 cloakbrowser.direct Descriptor` 已冻结 direct variant 的 provider identity、headful engine、hybrid transport、ephemeral profile、extension path locator 与 non-proof 边界，`FR-0058` 与 `FR-0059` 分别冻结 final args evidence 与 fingerprint seed evidence policy。

当前缺口是：后续 direct CloakBrowser adapter / admission owner 需要一个更窄的 direct launch health contract，来回答版本证据、transport readiness、启动参数、二进制、环境探测、可选 extension 状态是否达到进入下一阶段 runtime admission 的最低条件。没有该 contract 时，consumer 容易把 “binary 可找到”“args 已记录”“transport endpoint 看起来可连” 混同为 runtime ready、capability allowed 或 live evidence success。

本 FR 只冻结 CloakBrowser direct launch health 的 formal suite。它不实现 runtime code、doctor command、launch behavior、capability matrix、limitation gate、native messaging bridge、browser patching、Syvert、XHS 或任何 live evidence execution。

本 PR 是 formal spec review carrier，PR metadata 必须使用 `Refs #1150`。本 suite 合入后只提供 #1150 的 PR-ready formal input，不自动关闭 #1150，也不表示 direct CloakBrowser provider 已可用于业务执行。

## 目标

1. 冻结 `cloakbrowser_direct_launch_health_report` 的对象边界与 ownership。
2. 冻结 direct launch health 对 `FR-0038.provider_doctor_report`、`FR-0049.cloakbrowser.direct`、`FR-0058.final_args_evidence` 与 `FR-0059.fingerprint_seed_policy` 的消费关系。
3. 冻结 binary、version、launch args、environment、transport 与 optional extension health checks 的最小字段、evidence refs、redaction 与 fail-closed 规则。
4. 明确 direct launch health 只能表达 health/admission evidence，不等于 browser honored args、runtime readiness、capability allow、target tab ready、anti-detection pass 或 live evidence success。
5. 为后续 implementation、doctor/admission command、provider selection、capability matrix 与 launch evidence owner 提供稳定输入。

## 非目标

- 不实现 `webenvoy provider doctor`、direct launch command、runtime status、browser launch、adapter invocation、Playwright/CDP attach、extension load、artifact writer、fixtures 或 tests。
- 不定义 `cloakbrowser.persistent`、`cloakbrowser.cloakserve`、persistent profile health、Native Messaging bridge、service worker freshness、profile lock、account safety 或 broker health。
- 不定义 CloakBrowser capability matrix support rows、action coverage、verification thresholds 或 limitation gate。
- 不修改 `FR-0038`、`FR-0049`、`FR-0058`、`FR-0059` 的既有字段 shape。
- 不把 direct launch health pass 提升为 runtime attestation、live evidence attestation、capability allow、business read/write/download success 或 issue closeout evidence。
- 不暴露 full local path、raw argv、environment dump、Cookie、token、proxy credential、fingerprint seed value、private patch payload、account identifier 或 page content。
- 不触碰 official Chrome runtime behavior、Syvert normalized result、XHS business semantics、browser patching policy、scripts、workflows、githooks、`AGENTS.md` 或 `code_review.md`。

## 功能需求

### 1. Contract 定位与 ownership

系统必须冻结一个稳定的 `cloakbrowser_direct_launch_health_report` 对象。

约束：

- ownership 属于 `#1150` / `FR-0053` direct CloakBrowser health/admission evidence surface。
- 该对象是 `FR-0038.provider_doctor_report` 的 CloakBrowser direct 特化消费面，不替代通用 doctor report。
- 该对象只表达一次 direct launch health/admission 评估的机器可读结果。
- 该对象不得被解释为 runtime status、launch envelope、capability matrix row、limitation gate result、live evidence record、anti-detection validation record、fixture、provider private patch manifest 或 Syvert mapping。
- 后续 consumer 必须保持本 FR 的 fail-closed、redaction 与 non-proof 语义，不得通过 provider-private 字段把 health 结论升级为 runtime/live proof。

### 2. Report identity

`cloakbrowser_direct_launch_health_report.identity` 必须至少冻结：

- `direct_launch_health_report_id`
- `direct_launch_health_version`
- `provider_id`
- `variant_kind`
- `provider_contract_ref`
- `descriptor_ref`
- `doctor_contract_ref`
- `generated_at`
- `scope`
- `run_ref`
- `artifact_identity`

约束：

- `direct_launch_health_version` 当前冻结为 `v1`。
- `provider_id` 必须为 `cloakbrowser.direct`。
- `variant_kind` 必须为 `direct`。
- `provider_contract_ref` 必须能追溯到 `FR-0033.browser_provider_contract.v1`。
- `descriptor_ref` 必须能追溯到 `FR-0049.cloakbrowser.direct.v1`。
- `doctor_contract_ref` 必须能追溯到 `FR-0038.provider_doctor_report.v1`。
- `generated_at` 只表达 health report 生成时间，不是 runtime attestation 或 live evidence 采集时间。
- `scope` 至少支持 `static_probe`、`local_launch_admission`、`transport_preflight`、`extension_optional_check`。
- `run_ref` 与 `artifact_identity` 必须是 run-scoped opaque ref、redacted artifact locator 或 checksum ref；不得使用 private absolute path、browser process id、tab id、profile name或 account id 代替。

### 3. Input refs

`cloakbrowser_direct_launch_health_report.input_refs` 必须至少冻结：

- `expected_binary_source`
- `expected_version_policy`
- `expected_launch_args_evidence_ref`
- `expected_environment_probe_policy`
- `expected_transport_policy`
- `optional_extension_policy`
- `fingerprint_seed_policy_ref`

约束：

- `expected_binary_source` 必须消费 `FR-0038.ProviderDoctorExpectedBinarySource`，并保持 `source_kind=browser_executable|provider_launcher|adapter_binary` 与 `expected_access=exists|executable|launchable` 的 fail-closed 语义。
- `expected_version_policy` 只能表达 provider-managed browser / adapter version evidence 的要求；不得把版本匹配解释为 provider eligible 或 runtime ready。
- `expected_launch_args_evidence_ref` 必须消费 `FR-0058.cloakbrowser_final_args_evidence`；缺失、历史、unknown、redaction invalid 或 reconstruction unknown 时，命中 required health gate 必须 fail-closed。
- `expected_environment_probe_policy` 只能要求 redacted environment facts，例如 display/headful availability、provider launcher environment、sandbox constraints、workspace artifact reachability；不得记录 raw environment dump。
- `expected_transport_policy` 只能表达 direct variant 的 `hybrid` transport preflight，例如 provider launch control surface、CDP/Playwright attach preconditions、diagnostic artifact passthrough 是否具备最小证据；不得证明 target tab ready 或 page automation success。
- `optional_extension_policy` 只适用于 direct descriptor 声明的 optional `dev_unpacked_extension` locator；缺失时只能降级为 `not_applicable|warn`，除非目标 admission 明确要求 extension presence。
- `fingerprint_seed_policy_ref` 必须指向 `FR-0059`；health report 不得内联 raw seed、seed hash value 或 provider-private fingerprint internals。

### 4. Health check categories

`cloakbrowser_direct_launch_health_report.checks[*].category` 必须至少支持：

- `binary_probe`
- `version_probe`
- `launch_args_probe`
- `environment_probe`
- `transport_probe`
- `optional_extension_probe`
- `admission_summary`

约束：

- `binary_probe` 表达 CloakBrowser direct executable / provider launcher / adapter binary locator 是否存在、可访问、来源可解释。
- `version_probe` 表达 provider-managed browser / adapter version evidence 是否满足 expected policy。
- `launch_args_probe` 表达 final args evidence 是否存在、current-run、redacted、可追溯；不证明 browser honored args。
- `environment_probe` 表达 headful/display、workspace artifact、launcher environment 与 policy 是否匹配；不记录 raw env dump。
- `transport_probe` 表达 hybrid transport preflight 是否具备 health/admission 证据；不证明 runtime bootstrap、target tab、page automation 或 live action。
- `optional_extension_probe` 表达 direct launch optional extension locator / materialization / observable state 的 health 结论；不证明 stable extension id、service worker freshness 或 Native Messaging allowed origins。
- `admission_summary` 聚合 direct launch health 是否可进入后续 runtime gate；不得把该 summary 当作 capability allow。

### 5. Check result

每条 `checks[*]` 必须至少包含：

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
- `admission_blocking`
- `provider_blocking`

约束：

- `status=unknown` 命中 required direct launch health gate 时必须 fail-closed。
- `severity=fatal` 必须对应 `blocking=provider_blocking`，除非该检查明确为 `not_applicable`。
- `status=fail` 不得对应 `blocking=none`，除非该失败只影响未要求的 optional extension check。
- `diagnostics` 必须机器可读，至少表达 stable code、observed、expected、remediation hint 与 non-proof flags；不得只写自由文本。
- `evidence_refs` 是判定输入；`summary` 仅供人读。

### 6. Evidence refs 与 redaction

`checks[*].evidence_refs[*]` 必须至少表达：

- `kind`
- `ref`
- `status`
- `collected_at`
- `sensitivity`
- `redaction_state`

`kind` 至少支持：

- `binary_locator_ref`
- `version_output_ref`
- `final_args_evidence_ref`
- `environment_probe_ref`
- `transport_probe_ref`
- `extension_state_ref`
- `health_artifact_ref`

约束：

- `ref` 必须是 redacted locator、artifact id、opaque handle、checksum ref 或 report-local locator。
- `status=unavailable|partial|unknown` 作为 required check 的唯一 evidence 时，该 check 不得为 `pass`。
- `sensitivity=secret` 或 `redaction_state=invalid` 的值不得进入 PR body、stdout summary、spec sample 或 public artifact。
- binary path、extension path、provider launcher path、environment value、CDP endpoint、seed ref 与 provider-private patch ref 默认至少为 `sensitive`；如包含 secret，必须只保留 opaque / redacted ref。

### 7. Outcome 与 next gates

`cloakbrowser_direct_launch_health_report.outcome` 必须至少包含：

- `overall_status`
- `provider_blocked`
- `admission_blocked`
- `doctor_verification_projection`
- `direct_launch_health_level`
- `blocked_checks`
- `warnings`
- `next_required_gates`
- `semantic_conclusion`

`overall_status` 至少支持：

- `pass`
- `warn`
- `fail`
- `unknown`

`direct_launch_health_level` 至少支持：

- `declared_only`
- `static_checked`
- `health_checked`
- `admission_ready`

约束：

- 任一 required `binary_probe|version_probe|launch_args_probe|environment_probe|transport_probe` 为 `fail|unknown` 且 blocking 非 `none` 时，`overall_status` 必须为 `fail|unknown`。
- `optional_extension_probe` 只有在目标 admission 明确要求 extension 时才可阻断；未要求时缺失必须为 `not_applicable|warn`，不得伪装为 extension pass。
- `doctor_verification_projection` 只能使用 `FR-0038.ProviderDoctorOutcome.doctor_verification_level` 的 `declared_only|static_checked|doctor_checked`，不得高于 `doctor_checked`。
- `direct_launch_health_level=admission_ready` 只表示可进入后续 runtime gate；不得被解释为 runtime attested、live evidence attested 或 capability allowed。
- `next_required_gates` 必须继续列出至少 `runtime_attestation`、`launch_evidence_validation`、`capability_matrix_selection`；如涉及真实页面，还必须列出 `live_evidence`。
- `semantic_conclusion.does_not_prove` 必须至少包含 `browser_honored_args`、`runtime_ready`、`capability_allowed`、`target_tab_ready`、`anti_detection_pass`、`live_evidence_attested`。

### 8. Required check mapping

direct launch health consumer 必须按以下映射生成 required checks：

| Required source | Required direct health category |
|---|---|
| `FR-0038.input_contract_ref.expected_binary_source` | `binary_probe` |
| `FR-0049.engine.browser_version_range=provider_managed` | `version_probe` |
| `FR-0049.final_args_evidence` and `FR-0058.cloakbrowser_final_args_evidence` | `launch_args_probe` |
| `FR-0049.engine.headless_policy=forbidden` | `environment_probe` |
| `FR-0049.transport.transport_kind=hybrid` | `transport_probe` |
| `FR-0049.extension_path_handling.stable_extension_identity=not_promised` with extension requested | `optional_extension_probe` |
| requested direct launch admission | `admission_summary` |

约束：

- required check 缺失时，受影响 provider 或 admission 必须 fail-closed。
- `FR-0049.transport.native_messaging_support=none` 必须保持 `not_applicable`，不得在 direct health 中要求 Native Messaging pass。
- 当 direct launch health 需要投影回 `FR-0038.provider_doctor_report` 时，`admission_summary` 必须映射为 `capability_readiness` 检查，且 `minimum_next_verification_level` 只能指向 `runtime_attested|live_evidence_attested|not_applicable` 中的下一阶段 gate，不得把这些 verification level 写入 satisfied requirements。
- final args evidence、fingerprint seed policy、optional extension status 均不得绕过 `FR-0049` 的 direct descriptor limitations。

### 9. Fail-closed rules

以下情况必须 fail-closed：

- required binary / launcher / adapter locator 缺失、unknown、不可解析、不可访问或不满足 expected access。
- version evidence 缺失、unknown、stale 或无法追溯到 provider-managed policy。
- required final args evidence 缺失、historical、unknown、reconstruction unknown、redaction invalid 或包含 forbidden disclosure。
- environment probe 需要 headful/display availability，但证据 unknown、headless 冲突或 raw env dump 泄露。
- transport probe unknown、provider control surface 不可解释、CDP/Playwright attach precondition 缺证，或把 transport preflight 写成 target tab/live success。
- optional extension 被目标 admission 要求但 locator 缺失、materialization unknown、state unavailable 或 raw path/secret 泄露。
- raw local path、raw argv、environment dump、Cookie、token、proxy credential、fingerprint seed value、seed hash value、private patch payload、account identifier 或 page content 出现在 public surface。
- health report 声称满足 `runtime_attested`、`live_evidence_attested`、`capability_allowed`、`anti_detection_pass` 或业务 action success。

## GWT 验收场景

### 场景 1：direct launch health 冻结 admission evidence 而非 runtime success

Given consumer 读取 `cloakbrowser_direct_launch_health_report`
And required binary、version、launch args、environment 与 transport checks 均通过
When outcome 计算 direct launch health level
Then 最多只能输出 `admission_ready`
And `next_required_gates` 必须继续包含 runtime / launch evidence / capability / live evidence 相关 gate
And 不得输出 runtime ready、capability allowed 或 live evidence success

### 场景 2：final args evidence 只能证明输入形状

Given direct launch health 消费 `FR-0058.cloakbrowser_final_args_evidence`
When final args evidence 为 current-run 且 redaction valid
Then `launch_args_probe` 可以通过
And semantic conclusion 必须保留 `does_not_prove.browser_honored_args`
And 不得因为 args 存在而判定 browser honored args、health pass 之外的 runtime success

### 场景 3：transport preflight 不证明 target tab ready

Given `transport_probe` 发现 provider launch control surface 与 CDP/Playwright attach preconditions 均有 redacted evidence
When consumer 计算 outcome
Then transport readiness 只可满足 health/admission evidence
And `target_tab_ready` 必须继续留给 runtime attestation 或 live evidence owner

### 场景 4：optional extension 未要求时不阻断

Given direct descriptor 声明 extension binding support 为 `supported`
And 当前 admission 未要求 extension presence
When extension locator 缺失或 state unavailable
Then `optional_extension_probe` 必须为 `not_applicable|warn`
And 不得输出 stable extension identity 或 Native Messaging readiness

### 场景 5：required evidence unknown 必须阻断

Given `binary_probe` 或 `transport_probe` 是当前 direct launch admission required check
And evidence status 为 `unknown`
When consumer 计算 outcome
Then outcome 必须为 `fail|unknown`
And `admission_blocked=true`
And blocker 必须指向缺失证据的 category

### 场景 6：敏感路径或 secret 泄露导致 invalid

Given health evidence 中出现 full local path、raw argv、raw environment dump、token、fingerprint seed value 或 private patch payload
When redaction validator 消费该 evidence
Then 对应 check 必须 fail-closed
And health report 不得进入 `admission_ready`

## 异常与边界场景

- CloakBrowser direct binary 已安装但 license guard 缺失时，本 FR 不替代 `FR-0048`；后续 selection / release / execution owner 必须继续消费 license guard。
- `version_probe=pass` 不证明 provider adapter 可启动，只证明版本证据满足当前 health policy。
- `environment_probe` 可证明 headful/display precondition 可解释，但不证明 account safety、anti-detection baseline 或 profile cleanup。
- `optional_extension_probe=pass` 不证明 stable extension id、service worker freshness、persistent installation、Native Messaging allowed origin 或 business action success。
- `fingerprint_seed_policy_ref` 存在不证明 seed 已应用或 anti-detection pass。
- historical health artifact 只能作为 background，不得满足 latest-head 或 current-run required admission evidence。

## 验收标准

1. Formal suite 明确 direct launch health 是 health/admission evidence，不是 runtime/live/capability success。
2. Formal suite 明确 binary、version、launch args、environment、transport 与 optional extension categories 及 fail-closed 行为。
3. Formal suite 明确消费 `FR-0038`、`FR-0049`、`FR-0058`、`FR-0059`，且不修改它们的字段 shape。
4. Formal suite 明确 redaction、sensitivity、forbidden disclosure 与 PR/public surface 边界。
5. Formal suite 明确 `native_messaging_support=none` 在 direct variant 中为 not applicable，不进入 direct health required pass。
6. Formal suite 明确 PR 使用 `Refs #1150`，不以 formal spec PR 自动关闭 issue。

## 完成定义

本 suite 达到 PR-ready 时：

1. `spec.md`、`plan.md`、`TODO.md`、`contracts/`、`data-model.md`、`research.md`、`risks.md` 齐备。
2. `.github/spec-issue-sync-map.yml` 建立 `FR-0053 -> #1150` 单条映射。
3. PR 描述包含 parser-ready `closeout_control`、`integration_check`、`gate_applicability` 与 `live_evidence_record`。
4. 本地 docs/spec/sync-map/purity/diff/closing-semantics 验证通过。
5. Scheduler 拥有 guardian、formal review、controlled merge 与 issue closeout gate。
