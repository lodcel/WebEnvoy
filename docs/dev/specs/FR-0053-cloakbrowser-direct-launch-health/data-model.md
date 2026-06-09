# FR-0053 Data Model

## 定位

本 FR 不引入新的持久化表、runtime status row、provider registry row、capability matrix row、limitation gate result 或 live evidence record。这里的 data model 只冻结 CloakBrowser direct launch health/admission evidence 的对象语义，供后续 doctor/admission、provider selection、capability matrix、launch evidence 与 runtime gate 读取。

## 核心对象

### `cloakbrowser_direct_launch_health_report`

职责：

- 表达一次 `cloakbrowser.direct` health/admission 评估结果。
- 聚合 identity、input refs、health checks、evidence refs、outcome 与 next gates。
- 将 `FR-0038.provider_doctor_report` 的通用 doctor 语义约束到 direct CloakBrowser launch 前置。

非职责：

- 不表达 browser process lifecycle、runtime instance status 或 launch implementation。
- 不表达 target tab、page context、live evidence 或 business capability success。
- 不表达 persistent profile、Native Messaging、service worker freshness 或 account safety。
- 不表达 provider private patch manifest、fingerprint internals、raw env、raw argv 或 raw local paths。

生命周期：

1. `declared`：只存在 descriptor / doctor / policy refs。
2. `probed`：binary、version、environment、transport、optional extension 等 checks 产生 redacted evidence refs。
3. `health_checked`：required checks 通过或以 fail-closed 方式阻断。
4. `admission_consumed`：后续 runtime gate 读取 health outcome，决定是否继续 admission。
5. `superseded`：current-run newer report 或 newer contract version 替代旧 report。

本 FR 只冻结生命周期语义，不实现状态推进器。

### `direct_launch_health_identity`

职责：

- 绑定 provider id、variant、contract refs、生成时间、scope、run ref 与 artifact identity。

约束：

- `provider_id=cloakbrowser.direct` 与 `variant_kind=direct` 必须匹配。
- `generated_at` 不是 runtime evidence collection time。
- `run_ref` 与 `artifact_identity` 是 opaque / redacted locator，不得替代 process id、tab id、profile name 或 account id。

### `direct_launch_health_input_refs`

职责：

- 记录 health report 消费的 expected binary、version、launch args、environment、transport、extension 与 fingerprint seed policy 输入。

字段 ownership：

| 字段组 | Ownership / source | 不得替代 |
|---|---|---|
| `expected_binary_source` | FR-0038 | provider registry row、license guard |
| `expected_version_policy` | FR-0053 consumes FR-0049 | provider eligibility、runtime ready |
| `expected_launch_args_evidence_ref` | FR-0058 | browser honored args proof |
| `expected_environment_probe_policy` | FR-0053 | account safety、anti-detection pass |
| `expected_transport_policy` | FR-0053 consumes FR-0049 | target tab ready、page automation success |
| `optional_extension_policy` | FR-0053 consumes FR-0049 | stable extension identity、Native Messaging readiness |
| `fingerprint_seed_policy_ref` | FR-0059 | seed application、private patch schema |

### `direct_launch_health_check`

职责：

- 表达一个 direct launch health check 的机器判定结果。

核心 categories：

- `binary_probe`
- `version_probe`
- `launch_args_probe`
- `environment_probe`
- `transport_probe`
- `optional_extension_probe`
- `admission_summary`

约束：

- `summary` 只供人读。
- `diagnostics` 与 `evidence_refs` 是 gate / consumer 判定输入。
- `status=unknown` 命中 required gate 时必须阻断。
- `optional_extension_probe` 只有在 admission 明确要求 extension 时才从 optional 变 required。

### `direct_launch_health_evidence_ref`

职责：

- 用 redacted / opaque ref 指向 health evidence。

允许 kinds：

- `binary_locator_ref`
- `version_output_ref`
- `final_args_evidence_ref`
- `environment_probe_ref`
- `transport_probe_ref`
- `extension_state_ref`
- `health_artifact_ref`

约束：

- `ref` 必须是 artifact id、redacted locator、opaque handle、checksum ref 或 report-local locator。
- required check 的唯一 evidence 为 unavailable、partial、unknown 或 redaction invalid 时，该 check 不得 pass。
- public surfaces 不得出现 full local path、raw argv、raw env dump、token、seed、private patch payload 或 account identifier。

### `direct_launch_health_outcome`

职责：

- 聚合 provider/admission 是否阻断、health level、blocked checks、warnings、next gates 与 non-proof conclusion。
- 通过 `doctor_verification_projection` 显式保持 `FR-0038` 的 `doctor_checked` 上限。

正向结论：

- `health_admission_evidence`

必须保留的负向结论：

- `browser_honored_args`
- `runtime_ready`
- `capability_allowed`
- `target_tab_ready`
- `anti_detection_pass`
- `live_evidence_attested`

`direct_launch_health_level` lifecycle：

- `declared_only`：只有 descriptor / policy refs。
- `static_checked`：静态 locator / version / policy refs 可解释。
- `health_checked`：required health checks 有 redacted evidence 且未阻断。
- `admission_ready`：可进入后续 runtime gate；仍不是 runtime ready。

`doctor_verification_projection` lifecycle：

- `declared_only`：只具备声明输入。
- `static_checked`：静态 health 输入可解释。
- `doctor_checked`：required doctor / health checks 已按 FR-0038 通过或 fail-closed。

约束：

- `doctor_verification_projection` 不得出现 `runtime_attested` 或 `live_evidence_attested`。
- 当后续 consumer 需要 FR-0038 compatibility 时，`admission_summary` 必须投影为 `capability_readiness`，并把 runtime / live verification 保留在 next gate。

## Required check lifecycle

1. `required_by_descriptor_or_policy`：由 FR-0038 / FR-0049 / FR-0058 / FR-0059 推导 required check。
2. `evidence_collected_or_declared_missing`：health owner 提供 redacted evidence ref，或明确缺失。
3. `redaction_checked`：sensitivity 与 redaction state 可消费。
4. `status_computed`：计算 pass / warn / fail / not_applicable / unknown。
5. `outcome_consumed`：后续 gate 消费 health/admission evidence。

## 兼容策略

- 当前 contract version 为 `v1`。
- 同一主版本内只能新增向后兼容的 optional evidence kind、warning code 或 narrower diagnostics field。
- 修改 closed enum、required check mapping、negative proof semantics、forbidden disclosure 或 fail-closed 条件，必须重新进入 formal spec review。
- 后续 implementation 不得用 provider-private 字段绕过 `does_not_prove`、redaction 或 blocking semantics。
