# FR-0052 CloakBrowser Capability Matrix

Canonical Issue: #1149

## 背景

`#1149` 属于 `#1114 CloakBrowser Provider` 的 cross-variant capability matrix work item。前置 descriptor 输入已经由 `FR-0049 cloakbrowser.direct Descriptor`、`FR-0050 cloakbrowser.persistent Descriptor` 和 `FR-0051 cloakbrowser.cloakserve Descriptor` 冻结；相邻 evidence / health 输入由 `FR-0053`、`FR-0054`、`FR-0057`、`FR-0058`、`FR-0059`、`FR-0060` 提供可消费边界。

因此本 FR 只冻结 CloakBrowser 三个 provider variant 的 capability matrix：`cloakbrowser.direct`、`cloakbrowser.persistent`、`cloakbrowser.cloakserve`。每个 capability row 必须写明 support level、supported actions、execution layers、profile / extension / Native Messaging / final args / fingerprint seed evidence 输入、verification threshold、limitation refs、evidence ref strategy 与 downstream owner。

本 PR 是 formal spec review carrier。它不实现 runtime code、provider adapter、doctor command、launch behavior、limitation gate、fixtures、browser patching、XHS、Syvert 或任何 live/browser action；也不声明 runtime-ready、target-tab-ready、anti-detection pass 或 live evidence attested。

## 目标

1. 冻结 `cloakbrowser.direct`、`cloakbrowser.persistent`、`cloakbrowser.cloakserve` 的 capability matrix。
2. 比较三种 variant 在 profile、extension、Native Messaging、final args 与 fingerprint seed evidence 上的支持差异。
3. 为每个 capability row 明确 support level、verification threshold、limitation refs、evidence ref strategy 与 fail-closed policy。
4. 消费 `FR-0035 Provider Capability Verification Model`，确保 unsupported / partial / blocked 输入按 fail-closed 处理。
5. 为 #1152 limitation gate、#1153 runtime/evidence convergence 以及后续 health / launch evidence / fixture owner 提供 `capability_matrix_ref` 输入。

## 非目标

- 不定义或修改 CloakBrowser descriptor shape；`FR-0049`、`FR-0050`、`FR-0051` 分别拥有 direct、persistent、cloakserve descriptor。
- 不定义 provider health / doctor result schema；health / doctor inputs 只能作为 future or accepted evidence ref strategy。
- 不定义 launch evidence record、runtime attestation record、redaction payload、fixture payload 或 fresh live evidence。
- 不实现 provider registry parser、selection、doctor、runtime launch、Native Messaging bridge、Playwright、CLI、fixtures、tests、scripts 或 workflows。
- 不推进 #1152 limitation gate 或 #1153 runtime/evidence convergence；本 FR 可为它们提供 matrix input，但不完成它们的 gates。
- 不把 descriptor 存在、health pass、runtime ping、bootstrap ack、stub/fake host 成功、historical artifact 或 same-head historical artifact 写成当前 capability allow 证据。
- 不公开 CloakBrowser private patch schema、raw fingerprint seed、raw local path、credential、account identifier、page content 或 provider broker secret。

## 功能需求

### 1. Matrix 定位与 ownership

系统必须冻结一个稳定的 `cloakbrowser_capability_matrix`。

约束：

- matrix owner 固定为 `#1149` / `FR-0052`。
- matrix 输入只能来自 `FR-0049`、`FR-0050`、`FR-0051`、`FR-0035` 以及相邻 scoped health / evidence contracts。
- matrix 输出只表达 CloakBrowser provider variants 对 WebEnvoy capability 的静态支持等级、限制、验证阈值和证据引用策略。
- matrix 不得被解释为 provider registry row、doctor result schema、runtime status、launch evidence、limitation gate result、live evidence record、fixture 或 Syvert mapping。
- 后续 selection / health / limitation / launch / fixture owner 必须消费 matrix，不得反向修改 matrix owner 或 descriptor owner。

### 2. Capability row 最小内容

每个 matrix row 必须至少包含：

- `provider_id`
- `capability_id`
- `capability_kind`
- `supported_actions`
- `supported_execution_layers`
- `required_runtime_requirements`
- `support_level`
- `verification_threshold`
- `variant_inputs`
- `limitations`
- `verification_sources`
- `evidence_ref_strategy`
- `fail_closed_policy`
- `downstream_owner`

约束：

- `provider_id` 只能是 `cloakbrowser.direct`、`cloakbrowser.persistent` 或 `cloakbrowser.cloakserve`。
- `support_level` 必须使用 `FR-0035.support_state` 语义。本 formal matrix PR 的最高可证明等级不得高于 `statically_verified`；健康或 doctor contract 只能作为 future / accepted ref strategy，不能被本 PR标记为已通过。
- `verification_threshold` 必须表达 consumer 要求该 capability 进入业务 admission 前最低需要的 support state。
- `verification_sources` 当前只能使用 `provider_declaration`、`static_contract_check`、`manual_review_attestation`；`provider_health_check`、`runtime_attestation`、`runtime_observation` 与 `live_evidence_gate` 只能作为 future source requirement 或 downstream ref。
- `variant_inputs` 必须同时覆盖 profile、extension、Native Messaging、final args 与 fingerprint seed evidence disposition。
- `evidence_ref_strategy` 只能指向证据载体策略，不内联日志、profile path、secret、page content、raw argv、raw seed 或 live artifact。
- `limitations` 非空且命中当前最低要求时，必须按 `FR-0035` 写出 deny/defer 或 blocked/deny 结论。

### 3. Capability ids

本 matrix 当前冻结以下 CloakBrowser capability ids：

- `browser-runtime.launch`
- `page-automation.read`
- `page-automation.write`
- `page-automation.download`
- `provider.diagnose`
- `extension-runtime.bridge`
- `native-bridge.messaging`
- `artifact-passthrough.launch-evidence`
- `artifact-passthrough.final-args-evidence`
- `fingerprint.seed-reproducibility`

约束：

- 这些 ids 是 #1149 matrix rows，不是 descriptor shape。
- `provider.diagnose` 不是业务能力面；它只能供后续 doctor / evidence inspection 消费。
- `artifact-passthrough.launch-evidence` 和 `artifact-passthrough.final-args-evidence` 只表达后续 evidence owner 可引用的 pass-through capability，不定义 evidence record shape。
- `fingerprint.seed-reproducibility` 只表达 `FR-0059` policy input，不能证明 fingerprint seed 已应用、anti-detection pass 或 live evidence。
- 若 consumer 请求不在此集合内的 capability，必须按 `FR-0035` 生成 unsupported / deny 或 blocked / deny，不得伪造相邻 capability declaration。

### 4. Variant comparison matrix

#### 4.1 `cloakbrowser.direct`

| capability_id | support_level | verification_threshold | limitation | verification source | evidence ref strategy |
|---|---|---|---|---|---|
| `browser-runtime.launch` | `statically_verified` | `runtime_attested` before business admission | provider-managed direct launch; no persistent profile guarantee; final args and fingerprint seed evidence are slots only | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0049`; future `direct_launch_health_ref=FR-0053`; future `final_args_evidence_ref=FR-0058`; future launch/runtime owner fills runtime refs |
| `page-automation.read` | `statically_verified` | `runtime_attested`; `runtime_observed` when page behavior is required | hybrid Playwright/CDP page automation declared; target tab and browser-internal HTTP proof absent in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0049`; future runtime/evidence owner supplies runtime observation or live evidence ref |
| `page-automation.write` | `statically_verified` | `runtime_observed` plus applicable risk/live gate | write is partial until runtime, target tab, risk gates and live evidence exist; no live write evidence in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0049`; future runtime/live owner supplies accepted gate refs |
| `page-automation.download` | `statically_verified` | `runtime_observed` when artifact production is required | download declaration is static only; no artifact proof or filesystem policy evidence in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0049`; future artifact/evidence owner supplies artifact ref |
| `provider.diagnose` | `statically_verified` | `health_checked` for diagnostic admission only | diagnostics surface declared; health schema remains downstream | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0049`; `FR-0053` and `FR-0060` may provide scoped doctor refs |
| `extension-runtime.bridge` | `declared` | `runtime_attested` if requested; otherwise deny/defer | extension paths may be supplied but stable extension identity is not promised; not a persistent bridge | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0049`; future extension evidence owner required before admission |
| `native-bridge.messaging` | `unsupported` | N/A | direct descriptor has `native_messaging_support=none` | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0049`; no Native Messaging health ref allowed for direct unless a later formal owner revises descriptor |
| `artifact-passthrough.launch-evidence` | `declared` | `runtime_observed` or higher when required | evidence slot exists but no launch evidence record exists in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | future launch evidence owner fills `launch_evidence_ref` |
| `artifact-passthrough.final-args-evidence` | `declared` | current-run accepted `FR-0058` when required | final args evidence proves input shape only, not browser honored args | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | future `FR-0058` artifact ref; stale/unknown reconstruction fails closed |
| `fingerprint.seed-reproducibility` | `declared` | accepted `FR-0059` policy ref when reproducibility is required | provider-managed seed does not prove reproducible or applied; raw seed must not be disclosed | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | future `FR-0059` policy/evidence ref; raw seed and seed hash value forbidden |

Direct rows must be interpreted with this required-field expansion:

| capability_id | capability_kind | supported_actions | supported_execution_layers | required_runtime_requirements | fail_closed_policy | downstream_owner |
|---|---|---|---|---|---|
| `browser-runtime.launch` | `runtime` | `launch` | `provider_launcher`, `playwright_cdp`, `provider_hybrid_transport` | `real_browser`, `headless_forbidden`, `provider_doctor_passed`, `runtime_bootstrap_ready` | `FR-0035 default`; deny if runtime attestation, accepted direct health, final args or launch evidence minimum is unmet | #1153 / future launch evidence owner |
| `page-automation.read` | `page_automation` | `read` | `playwright_cdp`, `browser_context` | `real_browser`, `target_tab`, `runtime_bootstrap_ready` | `FR-0035 default`; deny if target tab/runtime/live minimum is unmet | #1153 / future runtime owner |
| `page-automation.write` | `page_automation` | `write` | `playwright_cdp`, `browser_context` | `real_browser`, `target_tab`, `runtime_bootstrap_ready`, `provider_doctor_passed` | `FR-0035 default`; deny live/write admission without accepted runtime/live gate | future runtime/live owner |
| `page-automation.download` | `page_automation` | `download` | `playwright_cdp`, `artifact_passthrough` | `real_browser`, `target_tab`, `runtime_bootstrap_ready` | `FR-0035 default`; deny without accepted artifact/download evidence | future artifact/evidence owner |
| `provider.diagnose` | `diagnostics` | `diagnose` | `provider_doctor`, `diagnostic_artifact` | `provider_doctor_passed` | `FR-0035 default`; diagnostics cannot satisfy business capability minimum | #1150/#1157/future doctor owner |
| `extension-runtime.bridge` | `extension_runtime` | `bridge` | `extension_path_locator` | `extension_binding`, `runtime_bootstrap_ready` | `FR-0035 default`; declared locator cannot satisfy stable bridge minimum | future extension owner |
| `native-bridge.messaging` | `native_bridge` | `message` | `none` | `unsupported_by_direct_descriptor` | `FR-0035 default`; always unsupported/deny for direct | none for direct |
| `artifact-passthrough.launch-evidence` | `artifact_passthrough` | `pass_through` | `artifact_ref` | `launch_evidence_record` | `FR-0035 default`; declared slot cannot satisfy evidence minimum | future launch evidence owner |
| `artifact-passthrough.final-args-evidence` | `artifact_passthrough` | `pass_through` | `artifact_ref` | `final_args_evidence_record` | `FR-0035 default`; deny if final args evidence is missing, stale, unredacted or reconstruction unknown | #1155 |
| `fingerprint.seed-reproducibility` | `fingerprint_policy` | `diagnose`, `gate_input` | `policy_ref`, `artifact_ref` | `fingerprint_seed_policy` | `FR-0035 default`; deny reproducibility if seed origin is not caller-supplied or evidence violates FR-0059 | #1156 |

#### 4.2 `cloakbrowser.persistent`

| capability_id | support_level | verification_threshold | limitation | verification source | evidence ref strategy |
|---|---|---|---|---|---|
| `browser-runtime.launch` | `statically_verified` | `runtime_attested` before business admission | requires persistent profile, extension workflow, Native Messaging and broker attachment; descriptor is not health pass | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0050`; future `persistent_profile_health_ref=FR-0054`; future `native_bridge_doctor_ref=FR-0057`; future launch/runtime owner fills refs |
| `page-automation.read` | `statically_verified` | `runtime_attested`; `runtime_observed` when page behavior is required | hybrid Playwright/CDP plus extension workflow declared; runtime attach and target tab not proven | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0050`; future runtime/evidence owner supplies observation/live ref |
| `page-automation.write` | `statically_verified` | `runtime_observed` plus applicable risk/live gate | partial until runtime attestation, profile lock, account safety, risk gates and live evidence are present | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0050`; future runtime/live owner supplies accepted gate refs |
| `page-automation.download` | `statically_verified` | `runtime_observed` when artifact production is required | artifact passthrough requires runtime/evidence owner and download policy evidence | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0050`; future artifact/evidence owner supplies artifact ref |
| `provider.diagnose` | `statically_verified` | `health_checked` for diagnostic admission only | diagnostic surface declared; health payload remains downstream | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0050`; `FR-0054`, `FR-0057`, `FR-0060` may provide scoped doctor refs |
| `extension-runtime.bridge` | `statically_verified` | `runtime_attested` before bridge admission | required refs exist only as descriptor inputs; extension installation/runtime/service worker readiness not proven | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0050`; future persistent health / service worker refs required |
| `native-bridge.messaging` | `statically_verified` | `runtime_attested` before bridge admission | required refs exist only as descriptor inputs; Native Messaging round trip not proven | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0050`; `FR-0057` handoff and future runtime attestation required |
| `artifact-passthrough.launch-evidence` | `declared` | `runtime_observed` or higher when required | evidence slot exists but no launch evidence record exists in this PR | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | future launch evidence owner fills `launch_evidence_ref` |
| `artifact-passthrough.final-args-evidence` | `declared` | current-run accepted `FR-0058` when required | provider attach snapshot may be reconstructed; it does not prove broker attach success | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | future `FR-0058` artifact ref; stale/unknown reconstruction fails closed |
| `fingerprint.seed-reproducibility` | `declared` | accepted `FR-0059` policy ref when reproducibility is required | private patch and provider-managed seed internals are not WebEnvoy contract fields | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | future `FR-0059` policy/evidence ref; raw seed and seed hash value forbidden |

Persistent rows must be interpreted with this required-field expansion:

| capability_id | capability_kind | supported_actions | supported_execution_layers | required_runtime_requirements | fail_closed_policy | downstream_owner |
|---|---|---|---|---|---|
| `browser-runtime.launch` | `runtime` | `launch` | `provider_broker`, `persistent_profile`, `extension_workflow`, `native_messaging`, `playwright_cdp` | `profile_binding`, `extension_binding`, `native_messaging`, `real_browser`, `headless_forbidden`, `provider_doctor_passed`, `runtime_bootstrap_ready` | `FR-0035 default`; deny if profile/extension/native/broker health or runtime attestation is missing | #1151/#1154/#1153 |
| `page-automation.read` | `page_automation` | `read` | `playwright_cdp`, `extension_bridge`, `browser_context` | `profile_binding`, `extension_binding`, `native_messaging`, `target_tab`, `runtime_bootstrap_ready` | `FR-0035 default`; deny if runtime/live evidence minimum is unmet | #1153 / future runtime owner |
| `page-automation.write` | `page_automation` | `write` | `playwright_cdp`, `extension_bridge`, `browser_context` | `profile_binding`, `extension_binding`, `native_messaging`, `target_tab`, `runtime_bootstrap_ready`, `provider_doctor_passed` | `FR-0035 default`; deny live/write admission without accepted runtime/live gate | future runtime/live owner |
| `page-automation.download` | `page_automation` | `download` | `playwright_cdp`, `extension_bridge`, `artifact_passthrough` | `profile_binding`, `extension_binding`, `native_messaging`, `target_tab`, `runtime_bootstrap_ready` | `FR-0035 default`; deny without accepted artifact/download evidence | future artifact/evidence owner |
| `provider.diagnose` | `diagnostics` | `diagnose` | `provider_doctor`, `diagnostic_artifact` | `profile_binding`, `extension_binding`, `native_messaging`, `provider_doctor_passed` | `FR-0035 default`; diagnostics cannot satisfy business capability minimum | #1151/#1154/#1157/future doctor owner |
| `extension-runtime.bridge` | `extension_runtime` | `bridge` | `extension_bridge` | `profile_binding`, `extension_binding`, `runtime_bootstrap_ready` | `FR-0035 default`; deny until accepted extension/profile health and runtime attestation exist | #1151 / future extension owner |
| `native-bridge.messaging` | `native_bridge` | `message` | `native_messaging` | `profile_binding`, `extension_binding`, `native_messaging`, `runtime_bootstrap_ready` | `FR-0035 default`; deny until accepted Native Messaging handoff and runtime round trip exist | #1154 / future runtime owner |
| `artifact-passthrough.launch-evidence` | `artifact_passthrough` | `pass_through` | `artifact_ref`, `redaction_policy` | `launch_evidence_record`, `redaction_record` | `FR-0035 default`; declared slot cannot satisfy evidence minimum | future launch evidence owner |
| `artifact-passthrough.final-args-evidence` | `artifact_passthrough` | `pass_through` | `artifact_ref` | `final_args_evidence_record` | `FR-0035 default`; deny if final args evidence is missing, stale, unredacted or reconstruction unknown | #1155 |
| `fingerprint.seed-reproducibility` | `fingerprint_policy` | `diagnose`, `gate_input` | `policy_ref`, `artifact_ref` | `fingerprint_seed_policy` | `FR-0035 default`; deny reproducibility if seed origin is not caller-supplied or evidence violates FR-0059 | #1156 |

#### 4.3 `cloakbrowser.cloakserve`

| capability_id | support_level | verification_threshold | limitation | verification source | evidence ref strategy |
|---|---|---|---|---|---|
| `browser-runtime.launch` | `declared` | `runtime_attested` plus limitation gate before business admission | external lifecycle, experimental distribution, headless policy unknown and profile binding unknown | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0051`; #1152 must resolve limitation gate before selection |
| `page-automation.read` | `declared` | `runtime_attested`; `runtime_observed` when page behavior is required | CDP support declared but endpoint security, target tab and headed route are not attested | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0051`; #1152 and future runtime/evidence owner required |
| `page-automation.write` | `declared` | `runtime_observed` plus applicable risk/live gate | experimental route; live/write must deny until limitation gate and runtime/live evidence exist | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0051`; #1152 and future runtime/live owner required |
| `page-automation.download` | `declared` | `runtime_observed` when artifact production is required | artifact passthrough not proven; endpoint and filesystem policy not attested | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0051`; future artifact/evidence owner required |
| `provider.diagnose` | `declared` | `health_checked` for diagnostic admission only | diagnostic surface may exist but provider lifecycle is external and experimental | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0051`; #1152/future doctor owner required |
| `extension-runtime.bridge` | `unsupported` | N/A | default extension binding disabled; WebEnvoy extension bridge unsupported by default | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0051`; no extension health ref allowed without later opt-in owner |
| `native-bridge.messaging` | `unsupported` | N/A | descriptor has `native_messaging_support=none` | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | `static_descriptor_ref=FR-0051`; no Native Messaging health ref allowed for cloakserve |
| `artifact-passthrough.launch-evidence` | `declared` | `runtime_observed` or higher when required | evidence slot exists but endpoint security and launch evidence are not attested | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | future launch evidence owner plus #1152 limitation gate required |
| `artifact-passthrough.final-args-evidence` | `declared` | accepted reconstructed `FR-0058` when required | reconstructed / diagnostic only; cannot prove extension bridge, headed route or live attach success | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | future `FR-0058` artifact ref; unknown reconstruction fails closed |
| `fingerprint.seed-reproducibility` | `declared` | accepted `FR-0059` policy ref when reproducibility is required | provider-private patch required; raw seed and private patch schema forbidden | `provider_declaration`, `static_contract_check`, `manual_review_attestation` | future `FR-0059` policy/evidence ref; raw seed and private patch fields forbidden |

Cloakserve rows must be interpreted with this required-field expansion:

| capability_id | capability_kind | supported_actions | supported_execution_layers | required_runtime_requirements | fail_closed_policy | downstream_owner |
|---|---|---|---|---|---|
| `browser-runtime.launch` | `runtime` | `launch` | `provider_broker`, `cdp` | `real_browser`, `headless_forbidden`, `runtime_bootstrap_ready` | `FR-0035 default`; deny until #1152 resolves experimental lifecycle/headless/profile limitations and runtime attestation exists | #1152/#1153 |
| `page-automation.read` | `page_automation` | `read` | `cdp`, `browser_context` | `target_tab`, `runtime_bootstrap_ready`, `real_browser` | `FR-0035 default`; deny if endpoint safety, target tab or runtime/live minimum is unmet | #1152/#1153 |
| `page-automation.write` | `page_automation` | `write` | `cdp`, `browser_context` | `target_tab`, `runtime_bootstrap_ready`, `provider_doctor_passed` | `FR-0035 default`; deny live/write admission without limitation gate and accepted runtime/live evidence | #1152/future runtime-live owner |
| `page-automation.download` | `page_automation` | `download` | `cdp`, `artifact_passthrough` | `target_tab`, `runtime_bootstrap_ready` | `FR-0035 default`; deny without limitation gate and accepted artifact/download evidence | #1152/future artifact owner |
| `provider.diagnose` | `diagnostics` | `diagnose` | `provider_doctor`, `diagnostic_artifact` | `provider_doctor_passed` | `FR-0035 default`; diagnostics cannot satisfy business capability minimum | #1152/future doctor owner |
| `extension-runtime.bridge` | `extension_runtime` | `bridge` | `none` | `unsupported_by_cloakserve_descriptor` | `FR-0035 default`; always unsupported/deny for cloakserve default | none for cloakserve default |
| `native-bridge.messaging` | `native_bridge` | `message` | `none` | `unsupported_by_cloakserve_descriptor` | `FR-0035 default`; always unsupported/deny for cloakserve | none for cloakserve |
| `artifact-passthrough.launch-evidence` | `artifact_passthrough` | `pass_through` | `artifact_ref` | `launch_evidence_record` | `FR-0035 default`; declared slot cannot satisfy evidence minimum | #1152/future launch evidence owner |
| `artifact-passthrough.final-args-evidence` | `artifact_passthrough` | `pass_through` | `artifact_ref` | `final_args_evidence_record` | `FR-0035 default`; deny if reconstructed evidence is unknown, stale or unredacted | #1155 |
| `fingerprint.seed-reproducibility` | `fingerprint_policy` | `diagnose`, `gate_input` | `policy_ref`, `artifact_ref` | `fingerprint_seed_policy` | `FR-0035 default`; deny reproducibility if seed origin is not caller-supplied or evidence violates FR-0059 | #1156 |

### 5. Health and evidence input disposition

The matrix must classify downstream inputs without claiming that they passed:

| input class | accepted source owner | current FR-0052 disposition |
|---|---|---|
| profile evidence | `FR-0050`, `FR-0054` | direct has no persistence guarantee; persistent requires profile health before runtime admission; cloakserve profile binding is unknown and must go through #1152 |
| extension evidence | `FR-0049`, `FR-0050`, `FR-0051`, `FR-0054`, future extension owner | direct has locator-only extension input; persistent requires extension workflow health; cloakserve default extension bridge is unsupported |
| Native Messaging evidence | `FR-0050`, `FR-0057`, future runtime owner | direct and cloakserve are unsupported; persistent is statically required but needs doctor/runtime refs |
| final args evidence | `FR-0058` | all variants may declare a ref strategy; current-run accepted and redacted evidence is required when used for admission |
| fingerprint seed evidence | `FR-0059` | reproducibility requires caller-supplied seed policy; provider-generated/mixed/unknown must fail closed for reproducibility |
| Docker / Xvfb environment | `FR-0060` | environment doctor can be a diagnostic/admission input; it never proves runtime ready, capability allowed or live evidence |
| direct launch health | `FR-0053` | direct health can support admission preflight; it never proves runtime ready or capability allowed |

### 6. Support level interpretation

This PR may only establish static matrix support.

约束：

- `statically_verified` means descriptor identity, mode, engine, transport, profile / extension / native refs, limitation conflicts and matrix rows have been reviewed against formal contracts.
- `declared` means the capability is only available as a future evidence slot, provider declaration or experimental route; it is not enough for default business allow.
- `unsupported` means the descriptor explicitly lacks the capability requirement.
- Any row may become `blocked` for a concrete consumer request when required sources or evidence refs are missing or limitations conflict with the requested capability.
- `manual_review_attestation` only confirms consistency of existing descriptor and matrix inputs; it does not promote a row to health, runtime, observation or live evidence state.

### 7. Evidence ref strategy

Matrix rows must use these evidence ref strategies:

- static descriptor evidence: `FR-0049`, `FR-0050`, `FR-0051`
- capability matrix evidence: `docs/dev/specs/FR-0052-cloakbrowser-capability-matrix/spec.md`
- direct launch health: `FR-0053`
- persistent profile health: `FR-0054`
- Native Messaging bridge doctor handoff: `FR-0057`
- final args evidence: `FR-0058`
- fingerprint seed evidence policy: `FR-0059`
- Docker / Xvfb doctor: `FR-0060`
- limitation gate: future #1152 output
- runtime/evidence convergence: future #1153 output

约束：

- Missing future refs must not be backfilled with `N/A` as if passed.
- Historical artifact, old head, runtime ping, bootstrap ack, stub/fake host or descriptor presence must not satisfy runtime/live minimum requirements.
- If a consumer requires fresh live evidence, this matrix can only point to the required future strategy and must deny/defer until the correct latest-head evidence exists.

### 8. Downstream owner boundaries

- #1152 owns CloakBrowser limitation gate and must consume matrix limitation refs, especially cloakserve experimental / headless / profile / extension / native limitations.
- #1153 owns runtime/evidence convergence and must consume matrix thresholds before claiming runtime or live readiness.
- #1150 / `FR-0053` owns direct launch health input.
- #1151 / `FR-0054` owns persistent profile health input.
- #1154 / `FR-0057` owns Native Messaging bridge doctor handoff.
- #1155 / `FR-0058` owns final args evidence contract.
- #1156 / `FR-0059` owns fingerprint seed evidence policy.
- #1157 / `FR-0060` owns Docker / Xvfb doctor input.

This FR does not write downstream output, create fixtures, run browser actions or trigger live/runtime actions.

## GWT 验收场景

### 场景 1：direct Native Messaging 必须 unsupported

Given `cloakbrowser.direct` descriptor declares `native_messaging_support=none`
When consumer requests `native-bridge.messaging`
Then matrix must return `unsupported`
And admission must deny or blocked/deny according to `FR-0035`

### 场景 2：persistent static support 不等于 runtime ready

Given `cloakbrowser.persistent` descriptor declares profile, extension workflow and Native Messaging refs
When consumer requests a business capability requiring those runtime requirements
Then this matrix may only provide `statically_verified`
And it must require profile / extension / native health plus runtime attestation before allow

### 场景 3：cloakserve experimental route cannot default allow

Given `cloakbrowser.cloakserve` descriptor has experimental distribution, unknown headless policy, unknown profile binding, default extension disabled and no Native Messaging
When consumer requests read/write/download
Then matrix must return at most `declared`
And #1152 limitation gate plus runtime/evidence refs must be required before any business allow

### 场景 4：final args evidence slot is not launch proof

Given a row references `artifact-passthrough.final-args-evidence`
When reviewer evaluates #1149
Then matrix may require a future `FR-0058` ref
And must not claim browser honored args, runtime readiness, health pass or live evidence

### 场景 5：fingerprint seed reproducibility cannot expose secrets

Given a row references `fingerprint.seed-reproducibility`
When reproducibility is required
Then consumer must require `FR-0059` policy evidence showing caller-supplied seed and valid redacted refs
And provider-generated, mixed, unknown or raw seed evidence must fail closed

### 场景 6：health / doctor checks cannot satisfy live evidence

Given direct launch health, persistent profile health, Native Messaging bridge doctor or Docker / Xvfb doctor refs exist
When consumer minimum is `runtime_observed` or `live_evidence_attested`
Then matrix must deny/defer until accepted runtime/live evidence exists
And must not treat doctor outputs as live/browser success

### 场景 7：unknown capability request must fail closed

Given consumer requests `cloakbrowser.some-new-capability`
And this matrix has no matching row
When verification model generates a decision
Then it must preserve the requested capability ref
And must not fabricate an adjacent row
And if already in admission, decision must be `blocked/deny` with `capability_not_declared`

## 异常与边界场景

- matrix row 缺少 support level、verification threshold、variant inputs、limitation、verification source 或 evidence ref strategy 时，视为 FR-0052 不完整。
- row 尝试定义 descriptor shape、health result payload、launch evidence record、limitation gate output、fixture payload 或 runtime implementation detail 时，视为 scope violation。
- row 把 direct Native Messaging 或 cloakserve extension / Native Messaging 写成 supported 时，必须阻断。
- row 把 persistent profile / extension / Native Messaging refs 写成 ready/pass evidence 时，必须阻断。
- row 使用 `runtime_attested`、`runtime_observed` 或 `live_evidence_attested` 但没有对应 accepted evidence ref 时，必须阻断。
- row 内联 cookie、token、profile secret、full local path、raw argv、raw seed、seed hash value、private patch payload、provider broker credential、complete page content 或 native host secret 时，必须阻断。

## 验收标准

1. `FR-0052` 只定义 CloakBrowser capability matrix，并映射 canonical issue `#1149`。
2. 三个 provider variants 均有 capability rows，并比较 profile、extension、Native Messaging、final args 和 fingerprint seed evidence 输入。
3. 每个 capability row 都写明 support level、verification threshold、limitation、verification source 与 evidence ref strategy。
4. matrix 消费 `FR-0049`、`FR-0050`、`FR-0051`、`FR-0035` 和相邻 health/evidence contracts，不改写 descriptor shape 或 health schema。
5. unsupported / partial / declared rows 明确按 `FR-0035` fail closed。
6. suite 未触碰 runtime/code、scripts、workflows、live evidence、browser runtime action、Syvert、XHS、#1152/#1153 implementation 或 issue closeout。
7. PR metadata 使用 `Refs #1149` / refs-only，`closingIssuesReferences=[]`，声明 formal spec review PR、local_only integration、live evidence N/A、gate owner scheduler。
