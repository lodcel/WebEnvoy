# FR-0069 Logical Data Model

本 FR 不新增 SQLite 表、迁移、运行时持久化模型或 command output schema。本文件只冻结后续 parser / gate / evidence owner 可引用的 logical entities。

## 实体

### `ProviderOwnedStealthBoundary`

职责：表达某个 provider 的 stealth/fingerprint/browser patch responsibility 是否属于 provider-owned boundary，以及 WebEnvoy 允许消费哪些声明、限制、证据引用和 blocker。

关键字段：

- `boundary_id`: 固定为 `provider_owned_stealth_boundary`。
- `boundary_version`: 当前固定为 `v1`。
- `owner_ref`: `#1182` 或 `FR-0069`。
- `provider_contract_ref`: 指向 `FR-0033.browser_provider_contract` 或后续正式 provider contract。
- `provider_id`: WebEnvoy provider namespace 下的 stable id。
- `provider_mode`: 复用 `FR-0033.ProviderMode`。
- `owned_domains`: provider-owned stealth domain enum。
- `not_owned_by_webenvoy`: WebEnvoy non-owned domain enum。
- `disclosure_boundary`: provider-private default policy 与 allowed/forbidden disclosure set。
- `allowed_webenvoy_consumption`: declaration、limitation、redacted refs、freshness/scope 与 blocking reasons。
- `non_proofs`: 不得替代 risk/live/gate pass 的输入。
- `blocking_reasons`: fail-closed blocker enum。
- `handoff_refs`: #1183/#1188/#1118 owners。

生命周期：

- Created by future provider contract / adapter / evidence owner after consuming this FR.
- Consumed by #1183 risk evidence owner or future provider selection/risk gate owner as boundary input.
- Must be invalidated or treated as stale when provider contract ref、provider id、scope、head/run/profile/target or redaction policy drifts.

### `ProviderStealthConsumptionRef`

职责：表达 WebEnvoy 可以消费的 provider-owned stealth 相关事实引用。

关键字段：

- `ref_kind`
- `ref`
- `sensitivity`
- `redaction_state`

约束：

- `ref_kind` 只能指向 provider contract、identity、mode、owned domain、limitation、verification、redacted evidence、freshness、scope 或 blocking reason。
- `sensitivity=secret` 只能以 redacted ref、secret handle 或等价不透明 locator 形式消费，不得在 public surface 展开。
- `redaction_state` 必须与 `FR-0040` / `FR-0041` 对齐，只允许 `redacted | redaction_required | not_required | policy_missing | invalid`。
- `redaction_state=redaction_required|policy_missing|invalid` 命中 required evidence 时必须 fail-closed。

### `ProviderStealthDisclosureBoundary`

职责：定义 provider-owned stealth 的 allowed public fields 与 forbidden disclosure。

关键字段：

- `default_policy`: 固定为 `provider_private`。
- `allowed_public_fields`
- `forbidden_fields`
- `redaction_policy_refs`

约束：

- Forbidden disclosure 出现时，当前 evidence invalid。
- Allowed public fields 不证明 provider stealth 有效，只能作为 declaration/context。

### `ProviderStealthHandoffRefs`

职责：把 #1182、#1183、#1188 的边界串起来，防止后续事项重复定义或绕过。

关键字段：

- `provider_stealth_owner`: `#1182` / `FR-0069`。
- `webenvoy_risk_evidence_owner`: `#1183`。
- `risk_hint_consumer_owner`: `#1188`。
- `parent_phase_ref`: `#1118`。

约束：

- #1183 可以引用 provider-owned boundary，但不得展开 provider internals。
- #1188 必须消费 #1183 risk hints，不得直接从 provider stealth presence 推导 allow。

## 关系

```text
FR-0033 Browser Provider Contract
        |
        v
ProviderOwnedStealthBoundary (#1182 / FR-0069)
        |
        | redacted refs / limitations / blocking reasons only
        v
WebEnvoy-Owned Risk Evidence Boundary (#1183)
        |
        | risk hints / gate inputs
        v
Risk Hint Consumer Gate (#1188)
```

## 状态与失效条件

本 FR 不冻结 runtime state machine，但后续 consumer 至少必须处理：

- `missing`: boundary 不存在。
- `declared_only`: provider 仅自报。
- `doctor_checked`: provider doctor 覆盖的健康或静态检查已过，但不是 risk pass。
- `redaction_invalid`: evidence 或 ref 暴露 forbidden data。
- `scope_mismatch`: provider/profile/browser/channel/workflow/head/run/target 与请求不一致。
- `stale`: evidence freshness 不满足当前请求。
- `requires_webenvoy_risk_evidence`: 必须交给 #1183。
- `requires_risk_hint_consumer`: 必须交给 #1188。

未分类状态或影响目标 capability 的 missing state 必须 fail-closed。
