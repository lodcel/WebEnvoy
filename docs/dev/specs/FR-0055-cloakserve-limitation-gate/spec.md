# FR-0055 Cloakserve Limitation Gate

Canonical Issue: #1152

## 背景

`#1152` 属于 `#1114 CloakBrowser Provider` 的 M10 limitation / admission lane。上游 `FR-0051 cloakbrowser.cloakserve Descriptor` 已冻结 `cloakbrowser.cloakserve` 的 external managed lifecycle、experimental distribution、default extension disabled、Native Messaging unsupported、profile binding unknown、headless policy unknown、CDP endpoint security not attested 与 no latest-head live evidence 等 limitation refs。`FR-0052 CloakBrowser Capability Matrix` 已把 cloakserve business rows 固定为 at most `declared`，并要求 #1152 limitation gate 在任何 business admission 前消费这些 limitation refs。

因此本 FR 只冻结 `cloakserve_limitation_gate`：当 extension runtime、Native Messaging、WebEnvoy relay bridge、business read/write/download、runtime launch、artifact pass-through 或 diagnostics workflow 尝试使用 `cloakbrowser.cloakserve` 时，gate 必须默认 fail closed。只有明确绑定到 scoped experimental issue、且该 issue 声明允许的 capability、evidence owner、runtime attestation、head/live evidence 边界与 rollback，才可从 blocked/deny 进入 defer 或 downstream-specific evaluation。

本 PR 是 formal spec review carrier。它不实现 runtime code、provider adapter behavior、extension/native messaging behavior、browser/live actions、fixtures、scripts、workflows、guardian/formal review、controlled merge 或 issue closeout；也不声明 live evidence、runtime ready、target-tab ready、extension bridge ready 或 Native Messaging ready。

## 目标

1. 冻结 `cloakbrowser.cloakserve` limitation gate 的输入、输出、默认判定和 owner。
2. 消费 `FR-0051` descriptor limitation refs 与 `FR-0052` capability matrix rows，确保 cloakserve 默认 extension / Native Messaging / WebEnvoy bridge workflow fail closed。
3. 冻结 scoped experimental issue 的准入要求，避免 ad hoc opt-in 或 runtime ping 绕过 limitation gate。
4. 为 #1153 runtime/evidence convergence 与后续 health / launch / fixture owner 提供 `limitation_gate_ref` 输入。
5. 明确本 suite 不实现 runtime、provider selection、browser actions、live evidence 或 #1153 extension capability gate。

## 非目标

- 不修改 `FR-0051` cloakserve descriptor 或 `FR-0052` capability matrix。
- 不定义 #1153 runtime/evidence convergence、extension capability gate、runtime attestation record、target tab binding、live evidence record 或 launch evidence record。
- 不实现 provider registry parser、selection、doctor、runtime launch、Playwright/CDP attach、extension install、Native Messaging bridge、CLI、fixtures、tests、scripts 或 workflows。
- 不把 `cloakserve` CDP endpoint existence、runtime ping、bootstrap ack、doctor success、stub/fake host success、historical artifact 或 same-head historical artifact 写成 allow evidence。
- 不定义 CloakBrowser private patch schema、raw fingerprint seed、raw local path、credential、account identifier、page content、CDP auth secret 或 provider broker secret。
- 不推进 Syvert normalized result、XHS business semantics、default live_write、browser patching、#1145 closeout blocker 或 #1153 implementation。

## 功能需求

### 1. Gate 定位与 ownership

系统必须冻结一个稳定的 `cloakserve_limitation_gate`。

约束：

- Gate owner 固定为 `#1152` / `FR-0055`。
- Gate 输入只消费 `FR-0051` descriptor limitation refs、`FR-0052` capability matrix rows、`FR-0035` support state / blocking reason 语义，以及 scoped experimental issue metadata。
- Gate 输出只表达 limitation / admission disposition，不表达 runtime status、provider health result、launch evidence、fixture payload、live evidence record 或 provider implementation detail。
- Gate 不得被解释为 #1153 runtime/evidence convergence 已完成。
- 后续 consumer 必须把本 gate 输出作为 `limitation_gate_ref` 消费；不得反向修改 FR-0051 descriptor 或 FR-0052 matrix。

### 2. Gate 输入

`cloakserve_limitation_gate_input` 必须至少包含：

- `provider_id`
- `capability_id`
- `requested_workflow`
- `descriptor_ref`
- `capability_matrix_ref`
- `descriptor_limitation_refs`
- `matrix_limitation_disposition`
- `required_runtime_requirements`
- `experimental_issue_ref`
- `evidence_refs`
- `caller_intent`

约束：

- `provider_id` 必须为 `cloakbrowser.cloakserve`；其他 provider 不属于本 gate。
- `descriptor_ref` 必须指向 `FR-0051`。
- `capability_matrix_ref` 必须指向 `FR-0052`。
- `descriptor_limitation_refs` 必须保留 FR-0051 的原始 limitation token，不得映射成自由文本后丢失机器可读语义。
- `matrix_limitation_disposition` 必须来自 FR-0052 cloakserve row materialization。
- `experimental_issue_ref` 缺失时，所有 extension / Native Messaging / WebEnvoy bridge workflow 必须 blocked/deny。
- `evidence_refs` 只能引用证据载体，不得内联敏感日志、完整页面内容、cookie、token、raw argv、raw seed 或 provider-private patch detail。

### 3. Requested workflow 分类

Gate 必须至少识别以下 `requested_workflow`：

- `runtime_launch`
- `page_read`
- `page_write`
- `page_download`
- `provider_diagnose`
- `extension_runtime_bridge`
- `native_messaging_bridge`
- `webenvoy_relay_bridge`
- `launch_evidence_passthrough`
- `final_args_evidence_passthrough`
- `fingerprint_seed_policy`

约束：

- `extension_runtime_bridge`、`native_messaging_bridge` 与 `webenvoy_relay_bridge` 对 cloakserve 默认必须 `blocked/deny`。
- `page_read`、`page_write` 与 `page_download` 必须在 endpoint security、target tab、runtime attestation、profile/headless limitations 与 live/runtime evidence 未满足时 `blocked/deny` 或 `defer`，不得 allow。
- `provider_diagnose` 只能进入 diagnostic evaluation，不得转化为 business capability allow。
- `final_args_evidence_passthrough` 只能证明 final args evidence slot strategy，不证明 extension workflow、headed route、runtime attach 或 live evidence。
- 未知 workflow 必须按 `FR-0035` 输出 `blocked/deny`，blocking reason 包含 `capability_not_declared` 或 `unknown_limitation`。

### 4. Default fail-closed policy

Gate 默认策略固定为：

- `default_decision`: `deny`
- `allow_without_experimental_issue`: `false`
- `allow_extension_bridge_by_default`: `false`
- `allow_native_messaging_by_default`: `false`
- `allow_webenvoy_relay_by_default`: `false`
- `allow_business_declared_only`: `false`
- `allow_runtime_ping_as_evidence`: `false`
- `allow_historical_artifact_as_current_evidence`: `false`
- `unknown_limitation_policy`: `blocked_deny`

约束：

- 任一 descriptor / matrix limitation 命中目标 workflow 且没有 scoped experimental issue 与对应 evidence owner 时，最终 `decision` 必须为 `deny`。
- `FR-0035.blocking_reason` 非空时，最终 `support_state` 必须为 `blocked`。
- `declared` support level 不满足 business read/write/download admission。
- `manual_review_attestation` 只能确认已有 evidence refs 与 policy 一致，不得单独提升为 runtime 或 live support。
- provider-private policy、local operator flag 或 PR body prose 不得放宽本 gate 默认策略。

### 5. Extension / Native Messaging hard block

当请求命中以下任一 workflow 时，gate 必须 hard block：

- WebEnvoy extension runtime bridge
- WebEnvoy content script relay bridge
- Native Messaging bridge
- extension-bound runtime bootstrap
- extension service worker readiness
- native host round trip

Hard block 的默认输出：

- `support_state=blocked`
- `decision=deny`
- `gate_status=blocked`
- `blocking_reasons` 至少包含：
  - `cloakserve_default_extension_disabled`
  - `cloakserve_no_webenvoy_extension_binding` 或 `cloakserve_no_native_messaging`
  - `no_extension_binding` 或 `no_native_messaging`

约束：

- 即使上游 CloakBrowser 支持 extension loading，本 gate 也不得把该事实解释为 WebEnvoy extension bridge ready。
- 即使 future doctor 输出存在，本 gate 也不得把 doctor success 解释为 Native Messaging ready，除非 scoped experimental issue 明确把该 doctor owner、runtime attestation 和 evidence freshness 纳入准入。
- Hard block 不能被 runtime ping、bootstrap ack、same-head historical artifact、manual review prose 或 local env success 绕过。

### 6. Scoped experimental issue requirement

只有满足以下全部条件，gate 才可把某个 workflow 从 hard block 降为 `defer` 或 downstream-specific evaluation：

- `experimental_issue_ref` 指向具体 open 或 active GitHub issue，不得为 milestone、project、parent issue 或 PR 根链接。
- Issue scope 明确写出 provider id `cloakbrowser.cloakserve`。
- Issue scope 明确写出允许评估的 `capability_id` 和 `requested_workflow`。
- Issue 明确声明 evidence owner、runtime owner、rollback owner 与 review/gate owner。
- Issue 明确声明允许的 evidence type、freshness requirement、head binding、run id / artifact identity requirement。
- Issue 明确声明不允许把 extension / Native Messaging support 推导为 default provider capability。

约束：

- scoped experimental issue 只能解除“是否允许评估”的阻断，不能直接产生 `allow`。
- 解除后仍必须消费 #1153 或后续 runtime/evidence owner 的 accepted output。
- 如果 issue closed、scope mismatch、owner missing、evidence stale、head mismatch 或 requested workflow 不匹配，gate 必须恢复 `blocked/deny`。

### 7. Gate 输出

`cloakserve_limitation_gate_result` 必须至少包含：

- `provider_id`
- `capability_id`
- `requested_workflow`
- `support_state`
- `decision`
- `gate_status`
- `blocking_reasons`
- `limitation_refs_consumed`
- `experimental_issue_ref`
- `evidence_refs_required`
- `evidence_refs_consumed`
- `downstream_owner`
- `verified_at`

约束：

- `support_state` 必须使用 `FR-0035.support_state`。
- `decision` 只能为 `deny` 或 `defer`；本 FR 不定义 `allow` 输出。
- `gate_status` 只能为 `blocked`、`deferred_to_experimental_owner` 或 `not_applicable`。
- `blocking_reasons` 必须机器可读；不得只写自由文本。
- `limitation_refs_consumed` 必须包含命中判定的 FR-0051 / FR-0052 limitation tokens。
- `verified_at` 是 gate decision 判定时间，不是 spec 文件写入时间；formal suite 不生成当前 runtime `verified_at`。

### 8. Downstream owner 边界

- #1153 owns runtime/evidence convergence and extension capability gate consumption; #1152 不完成 #1153。
- #1154 / `FR-0057` owns Native Messaging bridge doctor handoff; cloakserve 默认仍 unsupported / fail closed。
- #1155 / `FR-0058` owns final args evidence; final args evidence 不证明 runtime、extension bridge 或 live success。
- #1156 / `FR-0059` owns fingerprint seed policy; raw seed 和 private patch schema 不得进入 gate output。
- #1157 / `FR-0060` owns Docker / Xvfb doctor input; environment doctor 不证明 capability allowed。
- Future launch/runtime/live owners must consume `limitation_gate_ref` before claiming runtime or live readiness.

## GWT 验收场景

### 场景 1：cloakserve extension workflow 默认阻断

Given selected provider is `cloakbrowser.cloakserve`
And requested workflow is `extension_runtime_bridge`
When no scoped experimental issue is attached
Then gate result must be `support_state=blocked`
And decision must be `deny`
And blocking reasons must include `cloakserve_default_extension_disabled` and `no_extension_binding`

### 场景 2：cloakserve Native Messaging 默认阻断

Given `FR-0051` declares `native_messaging_support=none`
And `FR-0052` marks `native-bridge.messaging` unsupported for cloakserve
When consumer requests Native Messaging bridge
Then gate must return blocked / deny
And no Native Messaging health ref may be treated as sufficient unless a scoped experimental issue and downstream accepted evidence exist

### 场景 3：business read cannot use declared-only cloakserve route

Given `FR-0052` marks cloakserve `page-automation.read` as `declared`
When consumer requests business read
Then #1152 gate must require limitation gate plus runtime/evidence owner output
And must not allow based on descriptor existence, CDP endpoint existence, runtime ping or bootstrap ack

### 场景 4：scoped experimental issue only permits evaluation

Given an experimental issue explicitly permits evaluating `cloakbrowser.cloakserve` `page_read`
When runtime/evidence refs are absent
Then gate may return `deferred_to_experimental_owner`
And must not return allow
And downstream #1153 or future runtime owner must still supply accepted evidence before business admission

### 场景 5：final args evidence is not extension or live proof

Given `FR-0058` final args evidence exists for `cloakbrowser.cloakserve`
When requested workflow is extension bridge or business read/write/download
Then gate must keep required runtime/live/evidence refs unsatisfied
And must not treat final args evidence as headed route, extension bridge, Native Messaging or live evidence proof

### 场景 6：unknown or stale evidence fails closed

Given gate input includes stale evidence, mismatched head SHA, closed experimental issue or unrecognized limitation token
When admission decision is evaluated
Then gate must output blocked / deny
And blocking reasons must include stale or unknown evidence / limitation details

## 异常与边界场景

- `provider_id` 不是 `cloakbrowser.cloakserve` 时，本 gate must return `not_applicable` rather than producing allow.
- `descriptor_ref` 不是 `FR-0051` 或 `capability_matrix_ref` 不是 `FR-0052` 时，gate input invalid; if already in admission, output blocked / deny.
- `experimental_issue_ref` 为 project、milestone、parent issue、PR URL、free text 或 missing 时，不得解除 extension/native hard block。
- Gate result 出现 `decision=allow`、runtime status、health payload、launch evidence record、fixture payload、browser action proof、live evidence record 或 #1153 output shape 时，视为 scope violation。
- Gate result 内联 cookie、token、profile secret、full local path、raw argv、raw seed、seed hash value、private patch payload、provider broker credential、complete page content 或 native host secret 时，必须阻断。

## 验收标准

1. `FR-0055` 只定义 `cloakbrowser.cloakserve` limitation / admission gate，并映射 canonical issue `#1152`。
2. Gate 消费 `FR-0051` descriptor limitations、`FR-0052` matrix rows 与 `FR-0035` fail-closed semantics。
3. Extension runtime、Native Messaging 与 WebEnvoy relay bridge 对 cloakserve 默认 hard blocked / deny。
4. Scoped experimental issue 只能允许 downstream evaluation，不能直接产生 allow。
5. Suite 未触碰 runtime/source code、scripts、workflows、existing unrelated specs、browser/live actions、#1153 implementation 或 issue closeout。
6. PR metadata 使用 `Refs #1152` / refs-only，`closingIssuesReferences=[]`，声明 formal spec/work-item PR、local_only integration、live evidence N/A、gate owner scheduler。
