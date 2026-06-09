# FR-0057 Data Model

## 定位

本 FR 不引入新的持久化表、runtime status row、doctor result object、capability matrix row 或 live evidence record。这里的 data model 只冻结 CloakBrowser Native Messaging bridge doctor handoff 的共享对象语义，供后续 health implementation、capability matrix、limitation gate 与 evidence owner 读取。

## 核心对象

### `cloakbrowser_native_messaging_bridge_doctor_handoff`

职责：

- 表达 CloakBrowser variant 是否能进入 WebEnvoy Native Messaging bridge doctor preflight。
- 绑定 WebEnvoy bridge doctor ownership、input refs、required checks、stateful conclusion、failure classes 与 evidence refs。
- 为后续 `FR-0038.provider_doctor_report` 提供 native messaging check 的 handoff 输入。

非职责：

- 不表达 Native Messaging host implementation。
- 不表达 extension service worker implementation。
- 不表达 runtime status、target tab readiness、live evidence、capability allow 或 limitation gate pass。
- 不表达 CloakBrowser private patch、provider broker credential、license secret 或 account state。

生命周期：

1. `drafted`: formal suite 冻结 handoff contract。
2. `input_bound`: 后续 implementation owner 绑定 descriptor / extension / native host / registration / transport refs。
3. `doctor_mapped`: 后续 doctor owner 将 handoff 结论映射为 `FR-0038.provider_doctor_report`。
4. `consumed`: capability / limitation / admission owner 只读消费 doctor report 和 handoff refs。
5. `superseded`: formal revision 或 newer current-run evidence 替代旧 handoff / report。

本 FR 只冻结 lifecycle 语义，不实现状态推进器。

### `bridge_doctor_identity`

职责：

- 绑定 canonical issue、provider variant、contract version 和 doctor owner。

约束：

- `doctor_owner` 必须是 WebEnvoy Native Messaging bridge doctor owner。
- `provider_id` 与 `variant_kind` 必须一致。
- identity 存在不证明 Native Messaging ready。

### `bridge_doctor_input_refs`

职责：

- 以 redacted / opaque refs 表达 doctor 所需输入。
- 区分 descriptor refs、extension identity refs、native host refs、allowed origins、registration、transport、profile binding、provider broker 和 redaction policy。

约束：

- refs 不能携带 secret、raw manifest、full path、profile path、account id 或 provider-private payload。
- descriptor refs 是前置输入，不是 pass evidence。
- WebEnvoy extension/native host refs 缺失时不得进入 ready state。

### `bridge_doctor_applicability`

职责：

- 判断 variant 是否可进入 bridge doctor preflight。

状态：

- `applicable`
- `not_applicable_fail_closed`
- `unsupported_by_descriptor`
- `input_incomplete`

约束：

- `cloakbrowser.persistent` 可在输入齐备时 applicable。
- `cloakbrowser.cloakserve` 默认 unsupported / fail-closed。
- `cloakbrowser.direct` 默认 not applicable，除非后续 formal owner 提供 bridge refs。

### `bridge_doctor_required_check`

职责：

- 列出必须映射到 `FR-0038.ProviderDoctorCheck` 的 Native Messaging checks。

约束：

- 所有 required check 使用 `category="native_messaging"`。
- provider-level check 使用 `capability_id="N/A"`。
- requested capability 需要 `native_messaging` 时，必须通过 `capability_readiness` 消费 provider-level checks。

### `bridge_doctor_conclusion`

职责：

- 给后续 consumer 一个 stable stateful conclusion。

状态：

- `bridge_doctor_ready`
- `bridge_doctor_recoverable`
- `bridge_doctor_blocked`
- `bridge_doctor_unknown`
- `not_applicable_fail_closed`

约束：

- ready 只表示 doctor-layer readiness。
- recoverable 未恢复前不能 pass。
- blocked / unknown / not applicable 命中 required Native Messaging 时 fail-closed。

### `bridge_doctor_failure_class`

职责：

- 提供 machine-readable failure taxonomy，便于 doctor diagnostics、PR evidence、handoff 和后续 implementation tests 对齐。

约束：

- failure class 必须映射到 diagnostics code。
- failure class 不得被自由文本替代。
- 新增 class 不得放宽 ownership、source integrity、redaction 或 runtime boundary。

### `bridge_doctor_evidence_ref`

职责：

- 引用 current doctor scope 的 redacted evidence。

约束：

- shape 兼容 `FR-0038` evidence refs。
- required evidence `partial|unavailable` 时相关 check 不得 pass。
- `secret` sensitivity 只能以 redacted locator / secret handle 表达。

## Consumer rules

- Descriptor consumer 不得把 `native_messaging_ref` 解释为 bridge ready。
- Doctor consumer 必须先校验 owner、variant applicability、required checks、evidence redaction 与 source integrity。
- Capability consumer 只能在 all required checks pass 且 no blocking 时满足 `native_messaging` runtime requirement。
- Limitation consumer 必须把 `unsupported_by_descriptor`、`not_applicable_fail_closed`、owner mismatch、stub/fake source 和 stale evidence 作为 deny/block 输入。
- Runtime/live consumer 必须继续要求 runtime attestation、target tab 或 live evidence；不得消费 bridge doctor ready 直接放行。

## Omission rationale

- 不新增 persistent storage model：本 FR 只冻结 contract semantics，后续实现可选择 artifact、report 或 DB row，但必须保持本语义。
- 不新增 doctor report schema：`FR-0038.provider_doctor_report` 是唯一共享 doctor carrier。
- 不新增 live evidence model：真实 live evidence 由 FR-0016 及后续 runtime/live owner 管理。
