# FR-0044 official Chrome Capability Matrix

Canonical Issue: #1139

## 背景

`#1139` 属于 M3-C `official-chrome Provider` capability and health 批次。父项 `#1113` 已明确：`#1137` / `FR-0042` 拥有 official Chrome common descriptor shape 与 `official-chrome.direct`，`#1138` / `FR-0043` 只拥有 `official-chrome.persistent` delta，`#1139` 拥有 official Chrome capability matrix 并消费 `FR-0035 Provider Capability Verification Model`。

因此本 FR 只冻结 official Chrome 两个 descriptor variant 的 capability support matrix：每个 capability 必须写明 support level、limitation、verification source 与 evidence ref strategy。它不定义 descriptor shape，不定义 provider health / doctor result schema，不实现 runtime，不要求 live evidence，不推进 #1140/#1141/#1142/#1143/#1144。

## 目标

1. 冻结 `official-chrome.direct` 与 `official-chrome.persistent` 的 capability matrix。
2. 对每个 capability 明确 support level、limitation、verification source 与 evidence ref strategy。
3. 明确 unsupported / partial capability 如何按 `FR-0035` fail-closed。
4. 明确本 matrix 如何消费 `FR-0042` direct descriptor、`FR-0043` persistent descriptor 与 `FR-0035` capability model。
5. 为后续 M3-C health issues、#1143 launch evidence 与 #1144 fixtures 提供 capability_matrix_ref 输入。

## 非目标

- 不定义或修改 `official_chrome_descriptor` common shape、direct variant shape 或 persistent delta shape。
- 不定义 provider health / doctor result schema；#1140/#1141/#1142 必须消费 `FR-0038`。
- 不定义 launch evidence record、runtime attestation record、redaction shape、fixture payload 或 fresh live evidence；#1143/#1144 分别拥有这些范围。
- 不实现 provider registry parser、selection、doctor、runtime launch、extension install、native messaging、Playwright、CLI、fixtures 或测试代码。
- 不推进 Syvert normalized result、CloakBrowser、browser patching、XHS driver、live/browser/runtime action 或 live write。
- 不把 descriptor 存在、health pass、runtime ping、stub/fake host 成功或历史 artifact 写成当前 capability allow 证据。

## 功能需求

### 1. Matrix 定位与 ownership

系统必须冻结一个稳定的 `official_chrome_capability_matrix`。

约束：

- matrix owner 固定为 `#1139` / `FR-0044`。
- matrix 输入只能来自 `FR-0042`、`FR-0043` 与 `FR-0035`。
- matrix 输出只表达 official Chrome provider variant 对 WebEnvoy capability 的静态支持等级、限制、验证来源与证据引用策略。
- matrix 不得被解释为 provider registry row、doctor result schema、runtime status、launch evidence、live evidence record、fixture 或 Syvert mapping。
- 后续 selection / health / launch / fixture owner 必须消费 matrix，不得反向修改 matrix owner 或 descriptor owner。

### 2. Capability row 最小内容

每个 matrix row 必须至少包含：

- `provider_id`
- `capability_id`
- `capability_kind`
- `supported_actions`
- `supported_execution_layers`
- `required_runtime_requirements`
- `support_level`
- `limitations`
- `verification_sources`
- `evidence_ref_strategy`
- `fail_closed_policy`
- `downstream_owner`

约束：

- `provider_id` 只能是 `official-chrome.direct` 或 `official-chrome.persistent`。
- `support_level` 必须使用 `FR-0035.support_state` 语义，当前 matrix PR 的最高可证明等级不得高于 `statically_verified`。
- `verification_sources` 当前只能使用 `provider_declaration`、`static_contract_check`、`manual_review_attestation`；health、runtime、observation 与 live gate source 只能作为后续 ref strategy，不得在本 PR 标为已通过。
- `evidence_ref_strategy` 只能指向证据载体策略，不内联日志、profile path、secret、page content 或 live artifact。
- `limitations` 非空且命中当前最低要求时，必须按 `FR-0035` 写出 fail-closed 结论。

### 3. Capability ids

本 matrix 当前冻结以下 official Chrome capability ids：

- `browser-runtime.launch`
- `page-automation.read`
- `page-automation.write`
- `page-automation.download`
- `provider.diagnose`
- `extension-runtime.bridge`
- `native-bridge.messaging`
- `artifact-passthrough.launch-evidence`

约束：

- 这些 ids 是 #1139 的 matrix rows，不是 `FR-0042` 或 `FR-0043` 的 descriptor shape。
- `diagnose` 不是业务能力面；它只能供后续 health / doctor / evidence inspection 消费。
- `artifact-passthrough.launch-evidence` 只表达后续 #1143 可引用的 evidence pass-through capability，不定义 launch evidence record shape。
- 若 consumer 请求不在此集合内的 capability，必须按 `FR-0035` 生成 unsupported / deny 或 blocked / deny，不得伪造相邻 capability declaration。

### 4. Direct capability matrix

`official-chrome.direct` 必须冻结如下 capability rows：

| capability_id | support_level | limitation | verification source | evidence ref strategy |
|---|---|---|---|---|
| `browser-runtime.launch` | `statically_verified` | headful Google Chrome stable only; no persistent profile guarantee; no latest-head live evidence in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0042`; future launch owner fills `launch_evidence_ref` |
| `page-automation.read` | `statically_verified` | Playwright/CDP page automation declared; browser-internal HTTP rule still applies; no runtime observation in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0042`; future runtime/evidence owner supplies runtime observation or live evidence ref if required |
| `page-automation.write` | `statically_verified` | write is partial until runtime attestation and applicable risk gates exist; no live write evidence in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0042`; future runtime/live owner supplies runtime_observation or live_evidence_gate ref |
| `page-automation.download` | `statically_verified` | download declaration is static only; no artifact proof or filesystem policy evidence in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0042`; future artifact/evidence owner supplies artifact ref |
| `provider.diagnose` | `statically_verified` | diagnostics command surface declared only; health result schema is out of scope | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0042`; #1140/#1141/#1142 own health result refs |
| `extension-runtime.bridge` | `unsupported` | direct descriptor has `extension_binding_support=none` | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0042`; no extension health ref allowed for direct |
| `native-bridge.messaging` | `unsupported` | direct descriptor has `native_messaging_support=none` | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0042`; no native messaging health ref allowed for direct |
| `artifact-passthrough.launch-evidence` | `declared` | evidence slot exists but no launch evidence record or artifact exists in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0042`; #1143 must fill `launch_evidence_ref` before business admission can rely on it |

Direct rows must be interpreted with this required-field expansion; together with the matrix table above, each row fully instantiates `OfficialChromeCapabilityRow`:

| capability_id | capability_kind | supported_actions | supported_execution_layers | required_runtime_requirements | fail_closed_policy | downstream_owner |
|---|---|---|---|---|---|---|
| `browser-runtime.launch` | `runtime` | `launch` | `chrome_process`, `playwright_cdp` | `chrome_binary` | `FR-0035 default`; deny if launch evidence or runtime minimum is required | #1143 |
| `page-automation.read` | `page_automation` | `read` | `playwright_cdp` | `chrome_binary`, `page_context` | `FR-0035 default`; deny if runtime/live evidence minimum is unmet | future runtime/evidence owner |
| `page-automation.write` | `page_automation` | `write` | `playwright_cdp` | `chrome_binary`, `page_context`, `risk_gate` | `FR-0035 default`; deny live/write admission without accepted runtime/live evidence | future runtime/live owner |
| `page-automation.download` | `page_automation` | `download` | `playwright_cdp`, `artifact_passthrough` | `chrome_binary`, `download_policy`, `artifact_policy` | `FR-0035 default`; deny without accepted artifact/download evidence | future artifact/evidence owner |
| `provider.diagnose` | `diagnostics` | `diagnose` | `provider_doctor` | `descriptor_ref` | `FR-0035 default`; diagnostics cannot satisfy business capability minimum | #1140/#1141/#1142 |
| `extension-runtime.bridge` | `extension_runtime` | `bridge` | `none` | `unsupported_by_direct_descriptor` | `FR-0035 default`; always unsupported/deny for direct | none for direct |
| `native-bridge.messaging` | `native_bridge` | `message` | `none` | `unsupported_by_direct_descriptor` | `FR-0035 default`; always unsupported/deny for direct | none for direct |
| `artifact-passthrough.launch-evidence` | `artifact_passthrough` | `pass_through` | `artifact_ref` | `launch_evidence_record` | `FR-0035 default`; declared slot cannot satisfy evidence minimum | #1143 |

Fail-closed constraints:

- Direct rows requiring persistent profile, extension binding or native messaging must be `unsupported` or `blocked/deny` for that target request.
- Direct `read/write/download` rows are not business-allowable from this PR alone if consumer minimum is `runtime_attested`, `runtime_observed` or `live_evidence_attested`.
- Direct `write` must fail closed for live/write admission until applicable runtime observation or live evidence gate is present.

### 5. Persistent capability matrix

`official-chrome.persistent` 必须冻结如下 capability rows：

| capability_id | support_level | limitation | verification source | evidence ref strategy |
|---|---|---|---|---|
| `browser-runtime.launch` | `statically_verified` | requires persistent profile binding, extension binding and native messaging readiness; no descriptor-level runtime readiness | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0043`; #1143 fills `launch_evidence_ref`; health owners fill readiness refs |
| `page-automation.read` | `statically_verified` | declared via hybrid Playwright/CDP + extension bridge route; runtime attestation required before business allow | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0043`; future runtime/evidence owner supplies runtime observation or live evidence ref if required |
| `page-automation.write` | `statically_verified` | partial until runtime attestation, risk gates and applicable live evidence are present | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0043`; future runtime/live owner supplies runtime_observation or live_evidence_gate ref |
| `page-automation.download` | `statically_verified` | artifact passthrough requires launch/evidence owner and download policy evidence; none exists in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0043`; future artifact/evidence owner supplies artifact ref |
| `provider.diagnose` | `statically_verified` | diagnostic surface declared; health schema and result payload remain out of scope | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0043`; #1140/#1141/#1142 own health result refs |
| `extension-runtime.bridge` | `statically_verified` | required refs exist only as descriptor refs; extension installation/runtime/service worker readiness not proven | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0043`; #1140/#1142 health owners fill extension readiness refs |
| `native-bridge.messaging` | `statically_verified` | required refs exist only as descriptor refs; native host registration and bridge readiness not proven | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0043`; #1141 health owner fills native messaging readiness refs |
| `artifact-passthrough.launch-evidence` | `declared` | evidence slot exists but no launch evidence record, redaction record or artifact exists in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0043`; #1143 must fill `launch_evidence_ref` before business admission can rely on it |

Persistent rows must be interpreted with this required-field expansion; together with the matrix table above, each row fully instantiates `OfficialChromeCapabilityRow`:

| capability_id | capability_kind | supported_actions | supported_execution_layers | required_runtime_requirements | fail_closed_policy | downstream_owner |
|---|---|---|---|---|---|---|
| `browser-runtime.launch` | `runtime` | `launch` | `chrome_process`, `persistent_profile`, `playwright_cdp` | `chrome_binary`, `persistent_profile`, `extension_binding`, `native_messaging` | `FR-0035 default`; deny if profile/extension/native readiness or launch evidence is missing | #1140/#1141/#1142/#1143 |
| `page-automation.read` | `page_automation` | `read` | `playwright_cdp`, `extension_bridge` | `chrome_binary`, `persistent_profile`, `page_context`, `extension_binding` | `FR-0035 default`; deny if runtime/live evidence minimum is unmet | future runtime/evidence owner |
| `page-automation.write` | `page_automation` | `write` | `playwright_cdp`, `extension_bridge` | `chrome_binary`, `persistent_profile`, `page_context`, `extension_binding`, `risk_gate` | `FR-0035 default`; deny live/write admission without accepted runtime/live evidence | future runtime/live owner |
| `page-automation.download` | `page_automation` | `download` | `playwright_cdp`, `extension_bridge`, `artifact_passthrough` | `chrome_binary`, `persistent_profile`, `download_policy`, `artifact_policy` | `FR-0035 default`; deny without accepted artifact/download evidence | future artifact/evidence owner |
| `provider.diagnose` | `diagnostics` | `diagnose` | `provider_doctor` | `descriptor_ref`, `persistent_profile_ref`, `extension_ref`, `native_messaging_ref` | `FR-0035 default`; diagnostics cannot satisfy business capability minimum | #1140/#1141/#1142 |
| `extension-runtime.bridge` | `extension_runtime` | `bridge` | `extension_bridge` | `persistent_profile`, `extension_binding`, `service_worker_freshness` | `FR-0035 default`; deny until accepted extension/service-worker health refs exist | #1140/#1142 |
| `native-bridge.messaging` | `native_bridge` | `message` | `native_messaging` | `persistent_profile`, `native_host_registration`, `native_messaging_health` | `FR-0035 default`; deny until accepted native messaging health ref exists | #1141 |
| `artifact-passthrough.launch-evidence` | `artifact_passthrough` | `pass_through` | `artifact_ref`, `redaction_policy` | `launch_evidence_record`, `redaction_record` | `FR-0035 default`; declared slot cannot satisfy evidence minimum | #1143 |

Fail-closed constraints:

- Persistent rows requiring profile, extension or native messaging must fail closed until health/runtime owners provide accepted refs.
- Persistent `read/write/download` rows are not business-allowable from this PR alone if consumer minimum is `runtime_attested`, `runtime_observed` or `live_evidence_attested`.
- Persistent `extension-runtime.bridge` and `native-bridge.messaging` are statically verified requirements, not health pass results.

### 6. Support level interpretation

This PR may only establish static support.

约束：

- `statically_verified` means descriptor identity, mode, engine, transport, profile semantics, refs and limitation conflicts have been reviewed against `FR-0042` / `FR-0043`.
- `declared` means the capability is only available as a future evidence slot or declaration and is not enough for business allow.
- `unsupported` means the descriptor explicitly says the provider variant lacks the capability requirement.
- Any row may become `blocked` for a concrete consumer request when required sources or evidence refs are missing.
- `manual_review_attestation` only confirms consistency of existing descriptor and matrix inputs; it does not promote a row to health, runtime, observation or live evidence state.

### 7. Evidence ref strategy

Matrix rows must use these evidence ref strategies:

- static descriptor evidence: `docs/dev/specs/FR-0042-official-chrome-direct-descriptor/spec.md` or `docs/dev/specs/FR-0043-official-chrome-persistent-descriptor/spec.md`
- capability matrix evidence: `docs/dev/specs/FR-0044-official-chrome-capability-matrix/spec.md`
- health refs: future #1140/#1141/#1142 outputs, consuming `FR-0038`
- launch evidence refs: future #1143 output, consuming `FR-0040` and `FR-0041`
- fixture refs: future #1144 output

约束：

- Missing future refs must not be backfilled with `N/A` as if passed.
- Historical artifact, old head, runtime ping, bootstrap ack, stub/fake host or descriptor presence must not satisfy runtime/live minimum requirements.
- If a consumer requires fresh live evidence, this matrix can only point to the required future strategy and must deny/defer until the correct latest-head evidence exists.

### 8. Downstream owner boundaries

- #1140 owns persistent extension identity / runtime health checks and consumes `FR-0038`.
- #1141 owns native messaging health checks and consumes `FR-0038`.
- #1142 owns service worker freshness health checks and consumes `FR-0038`.
- #1143 owns official Chrome launch evidence and consumes `FR-0040` / `FR-0041`.
- #1144 owns official Chrome provider fixtures after descriptor, matrix, health and launch evidence inputs exist.

本 FR 不 writes downstream output, 不创建 fixtures, 不触发 live/browser/runtime actions。

## GWT 验收场景

### 场景 1：direct matrix 不承诺 extension 或 native messaging

Given `official-chrome.direct` descriptor 声明 `extension_binding_support=none` 和 `native_messaging_support=none`
When consumer 请求 `extension-runtime.bridge` 或 `native-bridge.messaging`
Then matrix 必须返回 `unsupported`
And 若该请求进入 admission，必须按 `FR-0035` 输出 deny 或 blocked/deny

### 场景 2：persistent matrix 静态支持不等于 runtime ready

Given `official-chrome.persistent` descriptor 声明 profile、extension 与 native messaging refs
When consumer 请求需要这些 runtime requirements 的业务 capability
Then 本 matrix 最高只能提供 `statically_verified`
And 不得把 descriptor refs 解释为 health pass、runtime attestation 或 launch evidence

### 场景 3：read/write/download 不能从本 PR 直接 allow

Given direct 或 persistent provider row 对 `page-automation.read/write/download` 是 `statically_verified`
When consumer minimum support state 是 `runtime_attested`、`runtime_observed` 或 `live_evidence_attested`
Then verification decision 必须 deny 或 defer
And 已进入 admission 时必须 fail closed

### 场景 4：diagnose 不得升级成业务能力

Given matrix row `provider.diagnose` 是 `statically_verified`
When business command 请求 `read`、`write` 或 `download`
Then consumer 不得使用 `provider.diagnose` 替代目标 capability
And health result schema 仍必须由 #1140/#1141/#1142 消费 `FR-0038`

### 场景 5：launch evidence slot 不等于 launch evidence

Given matrix row `artifact-passthrough.launch-evidence` 是 `declared`
When reviewer 判断 #1139 是否提供 launch evidence
Then 本 PR 只能提供 future evidence ref strategy
And #1143 才能提供 launch evidence record 和 artifact refs

### 场景 6：未知 capability 请求必须 fail closed

Given consumer 请求 `official-chrome.some-new-capability`
And 本 matrix 没有 matching row
When verification model 生成 decision
Then 必须保留 requested capability ref
And 不得伪造相邻 row
And 已进入 admission 时必须 `blocked/deny` with `capability_not_declared`

## 异常与边界场景

- matrix row 缺少 support level、limitation、verification source 或 evidence ref strategy 时，视为 FR-0044 不完整。
- row 尝试定义 descriptor common shape、persistent delta、health result payload、launch evidence record、fixture payload 或 runtime implementation detail 时，视为 scope violation。
- row 把 direct `extension-runtime.bridge` 或 `native-bridge.messaging` 写成 supported 时，必须阻断。
- row 把 persistent extension/native refs 写成 ready/pass evidence 时，必须阻断。
- row 使用 `runtime_attested`、`runtime_observed` 或 `live_evidence_attested` 但没有对应 accepted evidence ref 时，必须阻断。
- row 内联 cookie、token、profile secret、完整页面内容、sensitive local path 或 native host secret 时，必须阻断。

## 验收标准

1. `FR-0044` 只定义 official Chrome capability matrix，并映射 canonical issue `#1139`。
2. 每个 capability row 都写明 support level、limitation、verification source 与 evidence ref strategy。
3. direct 与 persistent matrix 均消费 `FR-0042`、`FR-0043` 与 `FR-0035`，不改写 descriptor shape 或 health schema。
4. unsupported / partial rows 明确按 `FR-0035` fail closed。
5. suite 未触碰 runtime/code、live evidence、browser runtime action、Syvert、CloakBrowser、XHS、#1140/#1141/#1142/#1143/#1144 scope。
6. PR metadata 使用 `Refs #1139` / `refs_only`，且声明 formal spec review PR、integration-gated execution_provider surface、live evidence N/A、gate owner scheduler。
