# FR-0038 data model

## 定位

本 FR 不引入新的持久化表、迁移、runtime status row 或 doctor command implementation。这里的 data model 只冻结 Provider Health / Doctor Contract 的共享对象语义，供后续 doctor command、provider registry、selection、capability verification 与 evidence kernel 实现引用。

## 核心对象

### `provider_doctor_report`

职责：

- 表达一次 provider health / doctor 评估的机器可读结果。
- 聚合 report identity、输入 provider contract 引用、checks、outcome 与 evidence refs。

非职责：

- 不表达 provider registry row。
- 不表达 runtime instance status。
- 不表达 launch envelope。
- 不表达 live evidence record。
- 不表达 Syvert normalized result。
- 不表达 anti-detection baseline record。

生命周期：

1. `created`：doctor report 由后续实现生成。
2. `validated`：shape、枚举、provider identity、required checks 与脱敏规则通过静态校验。
3. `consumed`：后续 provider admission / selection / evidence kernel 消费 report outcome。
4. `superseded`：新的 doctor report 或 runtime attestation 替代旧 report。

本 FR 只冻结对象语义，不实现生命周期推进器。

### `provider_doctor_check`

职责：

- 表达单项 health check 的结果。
- 绑定 category、status、severity、blocking、capability_id、diagnostics 与 evidence refs。

约束：

- `check_id` 必须在单个 report 内稳定唯一。
- `category` 必须来自 closed enum。
- required check 缺失、unknown 或 fail 时，受影响 provider / capability 必须阻断。
- provider-level check 使用 `capability_id=N/A`；capability readiness check 必须引用具体 capability id。

### `provider_doctor_diagnostics`

职责：

- 为机器消费提供 failure code、observed / expected value、remediation hint 与 capability requirement 对齐信息。

约束：

- `code` 是稳定诊断码，不是自由文本。
- `observed`、`expected` 与 `remediation_hint` 不得包含 secret。
- `satisfied_runtime_requirements` 只能表达 doctor 层可证明的事实，不能包含 runtime / live evidence 级验证。

### `provider_doctor_evidence_ref`

职责：

- 引用 doctor 检查产生或消费的证据 locator。
- 表达 evidence kind、availability、collection time 与 sensitivity。

约束：

- evidence ref 是 locator，不是完整敏感内容。
- `sensitivity=secret` 不得进入公开摘要。
- doctor evidence ref 不等于 `FR-0016.live_evidence_record`。

### `provider_doctor_outcome`

职责：

- 汇总 provider/capability 是否被 doctor 阻断。
- 表达 doctor 层最高 verification level 与后续 gate。

约束：

- `doctor_verification_level` 最高只能到 `doctor_checked`。
- `provider_blocked=true` 时，业务 selection 必须拒绝该 provider。
- `blocked_capabilities` 只阻断对应 capability，除非存在 provider-level blocking check。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| report identity | FR-0038 | provider registry、runtime status |
| health check category/result | FR-0038 | FR-0033 capability declaration |
| capability requirement mapping | FR-0038 消费 FR-0033 | runtime bootstrap、live evidence |
| evidence refs | FR-0038 shape；证据事实由后续 doctor/evidence 实现持有 | FR-0016 live evidence record |
| doctor verification level | FR-0038 | runtime_attested、live_evidence_attested |

## 兼容策略

- 当前 doctor contract version 为 `v1`。
- 同一主版本内只能新增向后兼容的可选字段或新的 non-blocking evidence kind。
- 修改 required category、status/severity/blocking 语义、fail-closed 规则或脱敏要求，必须重新进入 formal spec review。
- 后续 doctor command 或 registry implementation 不得通过私有字段绕过 required check 和 blocking outcome。
