# FR-0069 Provider-Owned Stealth Boundary

Canonical Issue: #1182

## 背景

`#1182 Provider-Owned Stealth Boundary` 属于 `#1118 Runtime Risk / Behavior Baseline`。`#1118` 的阶段目标是把旧的 Layer 1-4 反检测规划重新拆成两条清晰责任线：

- provider-owned stealth capabilities：由外部浏览器 provider 承担浏览器补丁、指纹伪装、stealth 参数、私有 patch 与底层执行面能力。
- WebEnvoy-owned risk/evidence gates：由 WebEnvoy 承担风险证据、门禁输入、closeout/audit 与 read/write gate 消费规则。

上游 `FR-0033 Browser Provider Contract` 已冻结 provider identity、mode、engine、transport、capability、verification 与 limitations，且明确 provider private patch 不得提升为 WebEnvoy core contract。`FR-0040 Provider Evidence Kernel` 已冻结 provider evidence refs、redaction、freshness 与 fail-closed 消费方式。`FR-0041 Evidence Redaction Policy` 与 `FR-0059 CloakBrowser Fingerprint Seed Evidence Policy` 已进一步要求 fingerprint seed、private patch payload 与 fingerprint internals 不进入公开或核心契约。

当前缺口是：后续 `#1183 WebEnvoy-Owned Risk Evidence Boundary` 与 `#1188 Risk Hint Consumer Gate` 需要一个稳定前置，先回答“哪些 stealth / fingerprint / browser patch 责任不由 WebEnvoy core 承担”。否则后续风险证据与 gate 实现容易把 provider 私有 stealth 成功、doctor 通过或声明存在误当成 WebEnvoy 风险门禁通过，或者反向要求 WebEnvoy 实现浏览器补丁。

本 FR 只冻结 provider-owned stealth boundary 的 formal contract。它不实现 provider adapter、browser patching、fingerprint generation、risk gate、runtime selection、read/write gate、live evidence 或 account safety 行为。

本 suite 是 #1182 的 formal boundary/spec carrier。当前 PR 必须使用 `Refs #1182`，等待 scheduler-owned spec review / gate；不得执行 issue closeout、guardian、formal review、controlled merge 或真实 browser/account/live/write action。

## 目标

1. 冻结 `provider_owned_stealth_boundary` 的 owner、scope、responsibility domains 与 disclosure boundary。
2. 明确 browser binary patch、fingerprint patch、stealth parameter generation、provider private patch validation、worker/kernel-level fingerprint mitigation 等责任属于外部 provider 或 provider adapter，而不是 WebEnvoy core。
3. 明确 WebEnvoy core 只消费 provider capability declaration、limitations、redacted evidence refs、readiness/health disposition 与 fail-closed blocking reasons，不消费 provider private patch body。
4. 明确 provider-owned stealth 不等于 WebEnvoy-owned risk evidence；provider declaration、doctor pass、private patch presence 或 fingerprint seed ref 不能替代 #1183/#1188 的风险证据与 gate 消费。
5. 为 #1183 / #1188 保留明确 handoff：#1183 定义 WebEnvoy-owned risk evidence/gates/closeout ownership，#1188 消费 runtime risk hints 到 read/write gates；二者不得重定义 provider-owned stealth。

## 非目标

- 不实现 runtime code、provider selection、provider adapter、browser launch、browser patch、fingerprint generation、stealth parameter generation、doctor、health check、risk gate、parser、tests、fixtures、scripts、workflows、guardian、formal review、controlled merge 或 issue closeout。
- 不定义 CloakBrowser private patch schema、browser patch payload、stealth parameter raw values、driver internal state、fingerprint internals、worker fingerprint patch details、kernel/browser engine diff 或 provider proprietary diagnostics。
- 不修改 `FR-0033`、`FR-0040`、`FR-0041`、`FR-0049`、`FR-0059`、`FR-0062`、`FR-0066`、`FR-0067`、`FR-0068` 的 field shape。
- 不定义 #1183 的 WebEnvoy-owned risk evidence object、risk score、risk hint schema、gate input semantics、closeout/audit record 或 account-risk policy。
- 不定义 #1188 的 read/write gate consumer behavior、risk hint enforcement matrix、runtime block/allow decision 或 command output changes。
- 不定义 Syvert normalized result、Syvert provider adapter、cross-repo shared output、JSON-RPC surface、XHS driver contract 或 live_write commit unlock。
- 不执行 real browser、profile、extension、Native Messaging、account、live read/write、external-visible、network or page interaction actions。

## 功能需求

### 1. Boundary ownership

系统必须冻结一个稳定的 `provider_owned_stealth_boundary` formal boundary。

约束：

- ownership 属于 #1182 / FR-0069。
- 该 boundary 只回答 provider-owned stealth 与 WebEnvoy-owned risk/evidence 的职责分割。
- 该 boundary 不得被解释为：
  - provider registry row
  - provider capability matrix row
  - provider doctor result
  - launch/runtime evidence record
  - anti-detection pass record
  - live evidence record
  - risk hint record
  - read/write gate decision
  - Syvert normalized result
- 后续实现或规约如需要消费 stealth capability，只能消费本 FR 允许的 declaration、limitation、redacted refs 与 blocking conclusion；不得把 provider private payload 内联到 WebEnvoy core。

### 2. Provider-owned responsibility domains

以下 responsibility domains 必须默认归属 provider 或 provider adapter：

- `browser_binary_patch`
- `engine_or_kernel_fingerprint_patch`
- `js_fingerprint_surface_patch`
- `worker_fingerprint_patch`
- `canvas_audio_webgl_font_patch`
- `stealth_parameter_generation`
- `fingerprint_seed_application`
- `provider_private_patch_validation`
- `managed_browser_runtime_cloak`
- `provider_network_stack_shape_when_provider_managed`
- `provider_behavior_masking_when_declared`

约束：

- WebEnvoy core 不实现、复制、反编译、持久化或公开这些 domain 的私有实现细节。
- Provider 可以声明上述 domain 的支持状态、限制、验证级别与 evidence refs。
- WebEnvoy 可以 fail-closed 地拒绝缺失、未知、redaction invalid、stale 或 scope mismatch 的 provider stealth evidence。
- Provider-owned domain presence 不证明目标平台风控已通过，也不证明 account safety、live evidence、runtime target binding 或 downstream gate 已通过。

### 3. WebEnvoy non-ownership boundary

WebEnvoy core 必须显式不承接以下责任：

- 浏览器内核级或二进制 patch 的实现与维护。
- JS/Worker/API 指纹 surface 的 provider-private patch 细节。
- Provider stealth 参数生成、seed derivation、rotation algorithm 或 private patch correctness。
- Provider 私有 driver state、managed browser internals、binary diff、hook list、stealth plugin body、anti-detection bypass recipe。
- 证明 provider stealth 本身“有效绕过目标平台风控”的最终业务结论。

约束：

- WebEnvoy 可以定义需要哪些 evidence refs 或 limitations，但不拥有 provider private implementation。
- WebEnvoy 可以在后续 #1183 中定义风险证据与 gate ownership，但该 ownership 不反向要求 WebEnvoy 实现 browser patch。
- WebEnvoy 可以把 provider stealth 缺失或未知作为 blocker；不能把 provider stealth presence 当作 allow。

### 4. Allowed WebEnvoy consumption

WebEnvoy core 允许消费以下 provider-owned stealth 相关事实：

- `provider_contract_ref`
- `provider_id`
- `provider_mode`
- `stealth_boundary_version`
- `owned_domains`
- `not_owned_by_webenvoy`
- `disclosure_boundary`
- `verification_level`
- `limitation_refs`
- `redacted_evidence_refs`
- `freshness_ref`
- `scope_binding`
- `blocking_reasons`
- `handoff_refs`

约束：

- 以上字段只能表达声明、引用、限制、freshness、scope 与阻断结论。
- `redacted_evidence_refs` 必须遵守 `FR-0040` / `FR-0041`，不得内联 raw seed、private patch payload、fingerprint internals、account data、full private path、token、Cookie 或 page content。
- `verification_level` 必须复用 `FR-0033` 的 verification 语义，且 `doctor_checked` 不等于 risk pass 或 live evidence pass。
- `scope_binding` 只绑定 provider/profile/browser/channel/workflow/head/run 等适用事实，不定义 #1183/#1188 gate decision。

### 5. Disclosure boundary

Provider-owned stealth boundary 的 disclosure policy 必须固定为 provider-private by default。

允许公开或进入 PR / stdout summary / spec sample 的内容仅限：

- provider id、contract ref、version ref、mode、owned domain enum、limitations、redacted evidence locator、blocking reason、handoff owner。

禁止公开或进入 WebEnvoy core formal contract 的内容包括：

- raw fingerprint seed
- seed substring、seed preview、truncated seed、base64 seed、masked-but-reversible seed
- private patch payload
- private patch manifest body
- stealth parameter raw values
- browser binary diff
- hook implementation body
- driver internal state
- fingerprint internals snapshot
- worker/kernel-level patch details
- account/profile secrets
- page content、private URL、Cookie、token、proxy credential

命中 forbidden disclosure 时，consumer 必须输出 blocker，且不得把该 evidence 用作 provider readiness、risk pass 或 gate allow 的输入。

### 6. Non-proof rules

以下内容不得被解释为 WebEnvoy-owned risk evidence pass、anti-detection pass、live evidence accepted 或 read/write gate allow：

- Provider 声明自己支持 stealth。
- Provider contract、descriptor、capability matrix、registry row 或 limitation row 存在。
- Provider doctor pass、health pass、descriptor pass、runtime ping 或 bootstrap ack。
- Redacted fingerprint seed ref、seed hash ref、final args ref、private patch ref 或 provider private ref 存在。
- Headless policy forbidden、managed browser runtime、CDP/Playwright support 或 OS input support。
- Historical artifact、old run、same-head historical artifact、post-merge补证据或 non-current evidence。
- Stub/fake host、control-plane-only signal 或 dry-run-only output。

约束：

- 这些内容可以作为 provider-owned stealth lane 的声明或输入，但不能单独解除 WebEnvoy risk/evidence blocker。
- 后续 #1183 必须定义 WebEnvoy-owned risk evidence 的 accepted / blocked / unknown 语义。
- 后续 #1188 必须定义 read/write gate 如何消费 #1183 的 risk hints；不得绕过 #1183 直接从 provider-owned stealth presence 推导 allow。

### 7. Handoff to #1183 and #1188

本 FR 必须冻结以下 handoff：

- #1183 owns WebEnvoy-owned risk evidence boundary, gate inputs, closeout/audit ownership and risk evidence fail-closed semantics.
- #1188 owns risk hint consumer gate behavior for read/write gates and closeout evidence.
- #1182 / FR-0069 owns only provider-owned stealth boundary and WebEnvoy non-ownership.

约束：

- #1183 可消费 `provider_owned_stealth_boundary_ref`、owned domain enum、limitations、redacted evidence refs 与 blocking reasons。
- #1183 不得重定义 provider-owned private patch schema 或要求 WebEnvoy 展开 provider internals。
- #1188 不得直接消费 provider private patch payload，也不得把 provider-owned stealth presence 解释为 gate allow。
- 若 #1183/#1188 需要新增 stable machine interface，必须各自在独立 formal suite 中冻结。

### 8. Blocking reasons

本 FR 至少冻结以下 blocking reasons：

- `provider_stealth_boundary_missing`
- `provider_stealth_boundary_unknown`
- `provider_stealth_scope_mismatch`
- `provider_stealth_evidence_missing`
- `provider_stealth_evidence_stale`
- `provider_stealth_evidence_redaction_invalid`
- `provider_private_patch_disclosed`
- `provider_private_patch_required_but_unverified`
- `provider_fingerprint_seed_policy_missing`
- `provider_fingerprint_seed_disclosed`
- `provider_stealth_doctor_only`
- `provider_stealth_declared_only`
- `provider_stealth_non_proof`
- `webenvoy_risk_evidence_required`
- `risk_hint_consumer_required`
- `unsupported_provider_stealth_domain`

约束：

- Unknown blocking reason 或 unknown provider-owned stealth state 在影响目标 capability 时必须 fail-closed。
- `webenvoy_risk_evidence_required` 表示必须交给 #1183，不表示 #1182 已定义该 evidence。
- `risk_hint_consumer_required` 表示必须交给 #1188，不表示 #1182 已定义 consumer gate。

## GWT 验收场景

### 场景 1：provider private patch 不进入 WebEnvoy core

Given 一个 managed browser provider 声明需要 private patch 才能满足 stealth
When WebEnvoy 记录 provider-owned stealth boundary
Then 只允许记录 provider contract ref、owned domain enum、redacted evidence ref 与 limitation
And 不得记录 private patch payload、hook body、stealth 参数或 browser binary diff

### 场景 2：provider doctor pass 不等于风险证据通过

Given provider doctor 输出 `doctor_checked`
When 后续 read/write gate 需要判断目标 capability 是否可执行
Then provider doctor pass 只能作为 provider-owned lane 的输入
And 必须继续要求 #1183 定义的 WebEnvoy-owned risk evidence
And 不得直接判定 gate allow

### 场景 3：private stealth evidence 泄露必须阻断

Given redacted evidence ref 中包含 raw fingerprint seed 或 private patch body
When consumer 验证 provider-owned stealth boundary
Then evidence 必须被标记为 invalid
And blocking reason 必须包含 `provider_stealth_evidence_redaction_invalid` 或 `provider_private_patch_disclosed`
And 后续 #1183/#1188 不得消费该 evidence 作为 accepted input

### 场景 4：#1183 可以消费边界但不能重定义 provider internals

Given #1183 需要定义 WebEnvoy-owned risk evidence
When 它消费 FR-0069
Then 它可以引用 provider-owned domains、limitations、blocking reasons 与 redacted refs
And 不得把 provider private patch schema 写成 WebEnvoy-owned risk evidence object

### 场景 5：#1188 不得绕过 #1183

Given read/write gate 需要消费 runtime risk hints
When provider-owned stealth boundary 声明 presence 或 doctor pass
Then #1188 必须消费 #1183 的 WebEnvoy-owned risk evidence / hint semantics
And 不得从 provider stealth presence 直接推导 read/write allow

## 异常与边界场景

- Provider 不声明 stealth boundary：目标 capability 若依赖 stealth，必须 fail-closed；若目标 capability 不依赖 stealth，仍不得把缺失解释为 risk pass。
- Provider 声明 `declared_only`：只能作为 planning / diagnostic 输入，不得满足业务执行默认选择或 read/write gate。
- Provider 声明 `doctor_checked`：只证明 provider doctor 所覆盖的静态/健康检查，不证明 live target anti-detection pass。
- Provider-owned domain 不在本 FR enum 内：后续 consumer 必须 fail-closed 或另开 formal spec review 扩展 enum。
- Redacted refs 存在但 freshness / scope 不匹配：不得消费为当前 head / run / profile / target 的 evidence。
- Future provider 可以保留 proprietary detail；WebEnvoy 只能要求 opaque/ref/fail-closed result，不能要求公开 provider internals。

## 验收标准

- `FR-0069-provider-owned-stealth-boundary` formal suite 已建立，并映射 canonical issue #1182。
- Suite 明确 provider-owned stealth domains、WebEnvoy non-ownership、allowed consumption、disclosure boundary、non-proof rules、blocking reasons 与 #1183/#1188 handoff。
- Suite 未修改 runtime/source code、scripts、workflows、tests、fixtures、provider adapter、XHS driver、JSON-RPC、Syvert normalized result、account safety、live evidence gate 或 browser patch implementation。
- PR metadata 使用 `Refs #1182`，不自动关闭 #1182/#1183/#1188/#1118。
- 本地静态验证通过：docs guard、spec guard、sync map、spec mapping assertion、PR purity、diff check 与 closing semantics scan。

## 依赖与前置条件

- 已合入：`FR-0033 Browser Provider Contract` / #1123。
- 已合入并可被引用：`FR-0040 Provider Evidence Kernel`、`FR-0041 Evidence Redaction Policy`、`FR-0049 CloakBrowser direct Descriptor`、`FR-0059 CloakBrowser Fingerprint Seed Evidence Policy`。
- #1182 issue 当前为 OPEN，且 issue comment 已声明 ready_now=yes、next_pr_shape=formal boundary/spec PR、does_not_wait_for #1142/#1241。
- #1183 依赖本 FR 冻结 provider-owned stealth boundary 后定义 WebEnvoy-owned risk evidence。
- #1188 依赖 #1183 定义 risk hint consumer input 后再定义 read/write gate consumption。
