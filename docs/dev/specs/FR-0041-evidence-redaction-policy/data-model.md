# FR-0041 data model

## 定位

本 FR 不引入新的持久化表、迁移、runtime status row、redaction engine、artifact store 或 CLI implementation。这里的 data model 只冻结 Evidence Redaction Policy 的共享对象语义，供后续 provider evidence、launch evidence、health evidence、fixture evidence、PR metadata 与 stdout summary 消费。

## 核心对象

### `evidence_redaction_policy`

职责：

- 定义 sensitivity、redaction state、locator、secret handling 与 disclosure boundary。
- 为 provider evidence、launch evidence、health evidence 和 fixture evidence 提供统一 policy。
- 规定 required evidence 遇到 redaction gap 时的 fail-closed 语义。

非职责：

- 不表达 `provider_evidence_record` shape。
- 不表达 launch envelope shape。
- 不表达 live evidence record shape。
- 不表达 redaction implementation、artifact storage 或 secret store。
- 不表达 Syvert normalized result。

生命周期：

1. `frozen`：本 FR 合入后成为 formal policy。
2. `consumed`：后续 FR / implementation 以 contract ref 引用 policy。
3. `revised`：若需要变更 sensitivity、secret handling 或 disclosure boundary，必须通过独立 formal spec review。

### `evidence_sensitivity_classification`

职责：

- 将 evidence field 或 locator 归类为 `public|internal|sensitive|secret`。
- 支持字段级分类，而不是只按整个 artifact 粗分类。

约束：

- 不确定时必须选择更保守等级。
- `secret` 不得出现在 public summary、fixture、spec sample 或 unredacted artifact。
- binary/profile locator、private path 和 account-affine locator 默认至少为 `sensitive`。

### `evidence_redaction_state`

职责：

- 表达 evidence 是否已满足 policy-approved redaction。
- 与 `FR-0040` 已冻结的 `redacted|redaction_required|not_required|policy_missing|invalid` enum 对齐。

约束：

- 本 FR 只定义 enum 语义，不新增 FR-0040 字段。
- `redaction_required|policy_missing|invalid` 命中 required evidence 时必须 fail-closed。
- `redacted` 不表示 evidence fresh、trusted、runtime-attested 或 live-accepted。

### `evidence_locator`

职责：

- 以 `public_locator`、`private_locator`、`secret_handle` 或 `artifact_locator` 表达 evidence 引用。
- 避免把原始 secret、private path、account id 或 raw argv/env 写入可见 surface。

约束：

- public locator 只能包含可公开 ref、logical id、artifact id、checksum、run id 或 sanitized filename。
- private locator 必须是 redacted / hashed / opaque，不能包含原始 private absolute path。
- secret handle 不能反查 secret 原值。
- artifact locator 不得暴露 private artifact root。

### `evidence_disclosure_surface`

职责：

- 约束 PR body、stdout summary、public artifact、internal artifact、fixture 和 spec sample 的允许内容。

约束：

- PR body 与 stdout summary 只能使用 public metadata、redacted locator 和 structured blocker。
- Fixture 与 spec sample 必须使用 synthetic、opaque 或 redacted values。
- Internal artifact 可保留 private locator，但不得保存 secret raw value，除非后续 secure storage policy 单独冻结。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| sensitivity levels | FR-0041 | FR-0040 record shape、runtime attestation、live evidence gate |
| redaction state semantics | FR-0041 consumes FR-0040 enum | FR-0040 field shape、closeout implementation |
| locator policy | FR-0041 | artifact store、secret store、profile lifecycle |
| secret handling | FR-0041 | credential manager、account store、runtime bootstrap |
| provider evidence redaction | FR-0041 consumes FR-0040 refs | provider evidence record shape |
| launch evidence redaction | FR-0041 consumed by #1143 | launch collector or official Chrome runtime behavior |
| health evidence redaction | FR-0041 consumes FR-0038 style health conclusions | provider doctor schema |
| fixture redaction | FR-0041 | fixture generator implementation |
| live evidence boundary | FR-0041 references FR-0016 | live evidence record or gate verdict |

## 兼容策略

- 当前 policy contract version 为 `FR-0041.evidence_redaction_policy.v1`。
- 同一主版本内允许新增更具体 evidence kind guidance，但不得降低 secret、account、private path、binary/profile locator 的默认敏感度。
- 降低 sensitivity、允许新的 public surface、改变 fail-closed 规则或允许 raw secret/path/account 进入任何 artifact，必须重新进入 formal spec review。
- 后续 #1143/#1144 或 runtime implementation 不得用本地例外绕过本 policy；如确需例外，必须独立冻结 scope、risk 和 reviewer gate。
