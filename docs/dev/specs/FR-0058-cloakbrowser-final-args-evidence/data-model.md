# FR-0058 Data Model

## 定位

本 FR 不引入新的持久化表、runtime status row、doctor result object、capability matrix row 或 live evidence record。这里的 data model 只冻结 CloakBrowser final args evidence 的共享对象语义，供 descriptor、provider evidence kernel、health、capability 与 limitation owner 读取。

## 核心对象

### `cloakbrowser_final_args_evidence`

职责：

- 表达一次 CloakBrowser final args input shape 的证据索引、redaction boundary、provenance 与 non-proof semantics。
- 聚合 identity、provenance、args summary、semantic conclusion 与 downstream blocking conditions。

非职责：

- 不表达 browser launch implementation。
- 不表达 runtime status、doctor result、capability matrix、limitation gate result。
- 不表达 browser honored args proof、target tab ready proof 或 live evidence record。
- 不表达 provider private patch manifest、fingerprint seed payload、account secret 或 page content。

生命周期：

1. `assembled_or_reconstructed`：由 launch assembly 或 provider/diagnostic reconstruction 产生 evidence summary。
2. `redaction_checked`：arg summary、locator、hash、excerpt 通过 redaction 和 disclosure policy 校验。
3. `consumed`：descriptor / provider evidence kernel / health / capability / limitation owner 以 read-only 方式消费。
4. `superseded`：current-run newer artifact 或 latest accepted contract 替代旧 evidence。

本 FR 只冻结对象语义，不实现生命周期推进器。

### `final_args_identity`

职责：

- 绑定 provider variant、run、capture stage、capture mode 与 artifact identity。

约束：

- `provider_id` 与 `variant_kind` 必须一一对应。
- `capture_stage` 和 `capture_mode` 共同说明 evidence 是 authoritative launch input shape 还是 reconstructed summary。
- `artifact_identity` 必须是 locator / checksum / opaque handle，而不是 private absolute path。

### `final_args_provenance`

职责：

- 记录 final args evidence 的来源、owner、reconstruction status、attestation boundary 与 freshness scope。

约束：

- provenance 解释“这份 evidence 从哪里来”，不解释“浏览器是否 honor 了 args”。
- `authoritative_input_shape` 可以证明 launch assembly 输入被记录，但仍不能证明 launch success。
- `reconstructed_complete_unverified` 与 `reconstructed_partial` 都必须保留 consumer warning。
- `historical_background`、`unknown` 不满足 required current-run evidence。

### `final_args_entry_summary`

职责：

- 用最小、可披露的形式表达单个 arg 或 arg class 的记录结果。

允许字段：

- `arg_key`
- `value_shape`
- `disclosure_class`
- `presence_state`
- `locator_ref`
- `path_hash`
- `value_excerpt_ref`
- `source_entry_ref`

约束：

- `arg_key` 是 canonical label，不是 raw token stream。
- `value_shape` 决定值的可表达形式，不能绕过 redaction policy。
- `presence_state=unknown` 时，consumer 不得把未观察到的值当作 absent。
- `path_hash` / `sanitized basename` 只帮助识别同类路径，不等于 path materialization success。

### `final_args_semantic_conclusion`

职责：

- 冻结 evidence 能证明什么、明确不能证明什么，以及哪些状态必须阻断下游 consumer。

最小正向结论：

- `launch_input_shape_recorded`
- `arg_presence_or_locator_recorded`
- `variant_specific_input_boundary_known`

必须保留的负向结论：

- `browser_honored_args`
- `runtime_ready`
- `health_pass`
- `capability_allowed`
- `anti_detection_pass`
- `target_tab_ready`
- `live_evidence_attested`

阻断条件：

- `required_evidence_missing`
- `redaction_invalid`
- `secret_leak_detected`
- `freshness_not_current`
- `reconstruction_unknown`

## Variant boundary

### direct

- 最适合 `build_time_assembled` 和 launch-time snapshot。
- 可以包含 extension locator refs。
- 不提供 persistent profile / stable extension identity / native messaging readiness proof。

### persistent

- 更常见为 attach-side reconstructed summary。
- 可以帮助说明 provider / broker 期望输入，但不证明 profile lock、login state reuse、extension workflow ready。

### cloakserve

- 默认是更弱的 reconstructed / diagnostic surface。
- 即使出现 extension-like arg summary，也不证明 WebEnvoy extension bridge、Native Messaging、headed route 或 endpoint security。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| identity | FR-0058 | provider registry row、runtime status |
| provenance | FR-0058 consumes FR-0037 / provider artifact owners | browser honored args proof、doctor result |
| args summary | FR-0058 consumes FR-0041 | raw argv、env dump、secret payload |
| semantic conclusion | FR-0058 | health pass、capability allow、live evidence gate |
| variant boundary | FR-0058 aligned with FR-0049/50/51 | sibling descriptor ownership |

## 兼容策略

- 当前 contract version 为 `v1`。
- 同一主版本内只能新增向后兼容的可选 arg class、可选 provenance source label 或更细的 consumer warning。
- 修改 closed enum、negative proof semantics、forbidden disclosure、variant boundary 或 fail-closed 条件，必须重新进入 formal spec review。
- 后续 runtime / health / capability implementation 不得通过私有字段绕过 `does_not_prove` 与 blocking conditions。
