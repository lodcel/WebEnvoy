# FR-0058 CloakBrowser Final Args Evidence

Canonical Issue: #1155

## 背景

`#1155` 属于 `#1114 CloakBrowser Provider` 的 M10 evidence lane，目标是在后续 health、capability、launch evidence 与 limitation owners 继续实现前，先冻结 CloakBrowser variants 可共享的 final args evidence 边界。

上游 contract 已经分别冻结了相关前置：

- `FR-0037 Launch Envelope Extraction` 冻结 launch-time 输入与 evidence requirements。
- `FR-0040 Provider Evidence Kernel` 冻结 `provider_evidence_record.launch_arguments` 的共享证据 carrier。
- `FR-0041 Evidence Redaction Policy` 冻结 secret、private path、account-affine locator 与 artifact disclosure 的 redaction 规则。
- `FR-0049` / `FR-0050` / `FR-0051` 已分别声明 CloakBrowser direct、persistent、cloakserve descriptor 对 final args evidence 的消费边界，但尚未冻结 shared final args evidence object 本体。

当前缺口是：CloakBrowser variants 的 final args 可能来自 build-time launch assembly，也可能来自 provider attach / broker / diagnostic reconstruction。若没有单独冻结 evidence contract，后续 consumer 会把“记录了哪些 args”混同为“浏览器实际 honor 了哪些 args”“runtime ready”“health pass”甚至“fresh live evidence”。这会直接污染 provider readiness、capability allow、closeout evidence 与 redaction 边界。

本 FR 只冻结 CloakBrowser Final Args Evidence 的 formal contract。它不实现 runtime、launch code、health doctor、capability matrix、limitation gate、native messaging bridge、official Chrome service worker、browser patching、Syvert、XHS、fixture 或任何 live action。

`#1155` 的 issue scope 是 “Record build-time or reconstructed launch args evidence for CloakBrowser variants according to wrapper limitations”。因此本 suite 合入后只冻结 final args evidence formal suite，并为后续 consumer 提供输入；PR metadata 必须使用 `Refs #1155`，不得自动关闭 issue。

## 目标

1. 冻结 `cloakbrowser_final_args_evidence` 的共享对象边界与 ownership。
2. 冻结 build-time assembled args 与 reconstructed args 的 provenance、collection mode、attestation boundary 与 artifact identity。
3. 冻结哪些 args/evidence 可以记录、哪些必须 redacted、哪些只能以 locator/hash/presence 形式表达。
4. 冻结 final args evidence 的 fail-closed 与 non-proof semantics，明确它不能单独证明 runtime readiness、health pass、browser honored args 或 live evidence。
5. 为 direct、persistent、cloakserve descriptor，以及后续 health/capability/launch evidence owners 提供可消费的 shared evidence surface。

## 非目标

- 不实现 browser launch、provider adapter、provider broker、attach flow、doctor、health command、capability matrix、limitation gate、CLI、fixtures、tests 或 artifact writer。
- 不修改 `FR-0037`、`FR-0040`、`FR-0041`、`FR-0049`、`FR-0050`、`FR-0051` 的既有字段语义，只在本 FR 内消费它们。
- 不定义 profile lock、extension identity、native messaging readiness、service worker freshness、target tab readiness、anti-detection baseline 或 live evidence record。
- 不把 final args evidence 提升为 browser honored args proof、runtime attestation、doctor pass、capability allow、real-browser closeout 或 latest-head live evidence。
- 不暴露 full argv、raw local path、Cookie、token、proxy credential、fingerprint seed value、private patch payload、account identifier 或 page content。
- 不触碰 Syvert normalized result、XHS business semantics、CloakBrowser-as-core、official Chrome runtime behavior 或 browser patching policy。

## 功能需求

### 1. Contract 定位与 ownership

系统必须冻结一个稳定的 `cloakbrowser_final_args_evidence` 对象。

约束：

- 本 formal contract 的 ownership 属于 `#1155` / `FR-0058`，这是 suite-level / document-level metadata，不是 `cloakbrowser_final_args_evidence` record 内的必填字段。
- 该对象属于 CloakBrowser provider-specific evidence contract surface，可被 direct、persistent、cloakserve variants 共享消费。
- 该对象只表达一次 CloakBrowser launch args input shape 的证据索引、披露边界与非证明性结论。
- 该对象不得被解释为：
  - browser launch implementation
  - runtime status
  - provider doctor result
  - capability matrix row
  - limitation gate result
  - live evidence record
  - anti-detection validation record
  - provider private patch manifest
- 后续 consumer 必须保持本 FR 的 redaction、provenance、non-proof 与 fail-closed 语义，不得通过私有字段把 final args evidence 升级为 readiness/live proof。

### 2. Evidence identity

`cloakbrowser_final_args_evidence.identity` 必须至少冻结：

- `final_args_evidence_id`
- `final_args_evidence_version`
- `provider_id`
- `variant_kind`
- `run_id`
- `capture_stage`
- `capture_mode`
- `created_at`
- `artifact_identity`

约束：

- `final_args_evidence_version` 当前冻结为 `v1`。
- `provider_id` 只能使用 `cloakbrowser.direct`、`cloakbrowser.persistent` 或 `cloakbrowser.cloakserve`。
- `variant_kind` 只能使用 `direct`、`persistent`、`cloakserve`。
- `run_id` 继承既有 command / launch / provider evidence 的 run id 语义；它不是 browser process id、profile id、tab id 或 account id。
- `capture_stage` 至少支持：
  - `launch_assembly`
  - `attach_reconstruction`
  - `diagnostic_reconstruction`
- `capture_mode` 至少支持：
  - `build_time_assembled`
  - `reconstructed_from_provider_signal`
  - `reconstructed_from_artifact`
- `artifact_identity` 必须指向 redacted artifact / locator / checksum / run-scoped ref，不得使用 private absolute path。

### 3. Provenance 与 reconstruction boundary

`cloakbrowser_final_args_evidence.provenance` 必须至少冻结：

- `source_kind`
- `source_ref`
- `source_owner`
- `reconstruction_status`
- `reconstruction_method`
- `attestation_boundary`
- `freshness_scope`

约束：

- `source_kind` 至少支持：
  - `launch_envelope_input`
  - `provider_launch_snapshot`
  - `provider_attach_snapshot`
  - `diagnostic_artifact`
- `source_ref` 只能是 locator / artifact ref / contract ref，不得内联 full argv、env dump 或 provider secret。
- `source_owner` 至少支持：
  - `launch_admission`
  - `provider_adapter`
  - `provider_broker`
  - `diagnostic_owner`
- `reconstruction_status` 至少支持：
  - `authoritative_input_shape`
  - `reconstructed_partial`
  - `reconstructed_complete_unverified`
  - `unknown`
- `reconstruction_method` 至少支持：
  - `assembled_before_launch`
  - `provider_reported`
  - `artifact_replay`
  - `derived_from_logs`
- `attestation_boundary` 只能表达 `input_shape_only`、`provider_report_only`、`diagnostic_only` 等证据强度；不得表达 browser honored、runtime ready 或 live accepted。
- `freshness_scope` 至少支持：
  - `current_run`
  - `historical_background`
  - `unknown`
- `historical_background` 与 `unknown` 不得满足命中 required final args evidence 的 closeout / capability gate。

### 4. Allowed recorded facts

`cloakbrowser_final_args_evidence.args_summary` 必须至少允许记录以下 facts：

- `arg_key`
- `value_shape`
- `disclosure_class`
- `presence_state`
- `locator_ref`
- `path_hash`
- `value_excerpt_ref`
- `source_entry_ref`

约束：

- `arg_key` 只能是 allowlisted switch key 或 canonical arg label，不得写入整个 raw argv token。
- `value_shape` 只表达：
  - `boolean_presence`
  - `redacted_scalar`
  - `locator_only`
  - `path_hash_only`
  - `opaque_ref_only`
- `disclosure_class` 至少支持：
  - `public_key_only`
  - `redacted_value`
  - `sensitive_locator`
  - `secret_forbidden`
- `presence_state` 至少支持：
  - `present`
  - `explicit_absent`
  - `unknown`
- `locator_ref` 只能引用 redacted locator、artifact locator 或 opaque handle。
- `value_excerpt_ref` 只能引用 policy-approved excerpt，不得包含可复用 secret。
- `source_entry_ref` 用于回溯该 arg summary 来源，不得替代 provenance。

### 5. Redaction 与 forbidden disclosure

系统必须冻结以下 final args disclosure boundary：

允许记录：

- allowlisted arg keys
- redacted scalar values
- redacted extension locator refs
- path hashes
- sanitized basename
- launch envelope ref
- provider contract ref
- variant-local artifact refs

禁止记录：

- full local paths
- raw argv token stream
- environment dump
- cookies
- tokens
- proxy credentials
- fingerprint seed values
- private patch payload
- native messaging bootstrap secret
- account identifier
- page content

约束：

- 任何 path-like value 默认至少为 `sensitive_locator`，公开表达必须转为 redacted locator、hash 或 sanitized basename。
- `secret_forbidden` 命中时不得以 placeholder 之外的任何明文形式落入 spec sample、PR body、stdout summary 或 public artifact。
- `raw argv token stream` 包含完整顺序、未脱敏值或可回放 secret 的情形时，必须视为 forbidden disclosure。
- redaction 规则必须消费 `FR-0041`；本 FR 不重定义 secret taxonomy。

### 6. Shared semantic conclusion

`cloakbrowser_final_args_evidence.semantic_conclusion` 必须至少冻结：

- `proves`
- `does_not_prove`
- `consumer_warnings`
- `blocking_conditions`

约束：

- `proves` 当前只允许：
  - `launch_input_shape_recorded`
  - `arg_presence_or_locator_recorded`
  - `variant_specific_input_boundary_known`
- `does_not_prove` 必须至少包含：
  - `browser_honored_args`
  - `runtime_ready`
  - `health_pass`
  - `capability_allowed`
  - `anti_detection_pass`
  - `target_tab_ready`
  - `live_evidence_attested`
- `consumer_warnings` 必须覆盖 reconstructed / stale / partial / redaction-invalid 等弱证据状态。
- `blocking_conditions` 必须至少覆盖：
  - `required_evidence_missing`
  - `redaction_invalid`
  - `secret_leak_detected`
  - `freshness_not_current`
  - `reconstruction_unknown`

### 7. Variant-specific boundary

shared contract 之上，三个 variants 必须保持以下边界：

- `direct`
  - 允许 `build_time_assembled` 与 `provider_launch_snapshot` source。
  - 可记录 redacted extension locator refs。
  - 不得把 final args evidence 升级为 persistent profile、stable extension identity 或 native messaging readiness proof。
- `persistent`
  - 允许 `reconstructed_from_provider_signal` 与 `provider_attach_snapshot` source。
  - 不得把 final args evidence 升级为 profile lock、login state reuse、extension workflow ready 或 broker attach success proof。
- `cloakserve`
  - 通常只能提供 reconstructed evidence。
  - 不得把 final args evidence 升级为 extension bridge ready、headed route、profile binding ready、CDP endpoint secure 或 live attach success proof。

约束：

- 任何 variant 都不得用 final args evidence 绕过本 variant 在 descriptor / limitation / health owner 中声明的 fail-closed 边界。
- variant-specific delta 只能缩窄可证明范围，不能扩大为 readiness/live proof。

### 8. Downstream consumer contract

后续 consumer 至少必须支持以下消费方式：

- `FR-0049` / `FR-0050` / `FR-0051` descriptor 对应的 `final_args_evidence_ref`
- `FR-0040.provider_evidence_record.launch_arguments`
- 后续 health / capability / limitation / launch evidence owner 的 read-only evidence ref

约束：

- consumer 只能把 final args evidence 当作 launch input shape evidence、redaction compliance evidence 或 limitation input。
- consumer 若需要 runtime readiness、doctor pass、live evidence、browser honored args 或 anti-detection validation，必须继续消费对应 owner，不能只依赖本对象。
- `required_evidence_missing`、`redaction_invalid`、`freshness_not_current`、`reconstruction_unknown` 命中时，consumer 必须 fail-closed。
- final args evidence 可以作为 blocked reason 的一部分，但不能单独输出 allow / pass / ready 结论。

## GWT 验收场景

### 场景 1：build-time assembled direct args 只证明输入形状

Given `cloakbrowser.direct` 生成 `capture_mode=build_time_assembled` 的 final args evidence
When reviewer 检查 `semantic_conclusion`
Then `proves` 只能包含 launch input shape / arg presence 类结论
And `does_not_prove` 必须显式包含 `browser_honored_args`、`runtime_ready`、`health_pass` 与 `live_evidence_attested`

### 场景 2：reconstructed persistent args 不能替代 workflow readiness

Given `cloakbrowser.persistent` 只提供 `provider_attach_snapshot` reconstructed final args evidence
When downstream consumer 评估 profile / extension / broker readiness
Then consumer 必须继续等待 health / capability owner 的独立证据
And 不得因 reconstructed final args 存在而放行 profile lock、extension workflow 或 native messaging readiness

### 场景 3：cloakserve final args 不能推出 extension bridge ready

Given `cloakbrowser.cloakserve` 默认 `extension_binding_support=none`
When final args evidence 中出现 extension-like locator 或 reconstructed switch summary
Then 该 evidence 只能说明 provider-side input shape 被记录
And 不得推出 WebEnvoy extension bridge ready、Native Messaging supported 或 service worker fresh

### 场景 4：secret 或 private path 泄露必须 fail-closed

Given final args evidence 包含 full local path、token、proxy credential 或 fingerprint seed value
When reviewer 或后续 parser 检查 redaction state
Then evidence 必须被标记为 `redaction_invalid` 或 `secret_leak_detected`
And 不得用于 required evidence closeout、capability allow 或 readiness summary

### 场景 5：历史或未知来源 evidence 不得满足 required gate

Given final args evidence 的 `freshness_scope=historical_background` 或 `reconstruction_status=unknown`
When target capability 或 closeout plan 要求 current-run final args evidence
Then consumer 必须 fail-closed
And 不得把该 evidence 当作 latest-head、current-launch 或 live evidence substitute

## 异常与边界场景

- direct variant 若只记录 arg key 和 path hash，仍不能证明该 path materialization 成功。
- persistent variant 若 provider 只回传 partial args，必须允许 `reconstructed_partial`，但 consumer 命中 required key 时必须阻断。
- cloakserve variant 若通过 diagnostic log 重建 args，必须标记 `diagnostic_only` attestation boundary，不得误报为 authoritative input shape。
- 若 allowlisted arg key 对应的值可能承载 secret，仍必须按 `redacted_value` 或 `secret_forbidden` 处理，不能因 key 在 allowlist 中而明文输出 value。

## 验收标准

1. 仓库内已落成 `FR-0058` formal suite，并能把 CloakBrowser final args evidence 冻结成独立 shared contract，而不是继续散落在 sibling descriptor 文案中。
2. shared contract 已同时覆盖 build-time assembled 与 reconstructed provenance、redaction boundary、non-proof semantics、variant-specific boundary 与 downstream fail-closed 行为。
3. spec 明确列出允许记录与禁止披露的 final args facts，且禁止项覆盖 full local path、raw argv、token、proxy credential、fingerprint seed、private patch payload、account identifier 与 page content。
4. spec 明确要求 final args evidence 不得单独证明 browser honored args、runtime ready、health pass、capability allowed、anti-detection pass、target tab ready 或 live evidence attested。
5. `.github/spec-issue-sync-map.yml` 已新增 `FR-0058 -> #1155` 的单条 canonical 映射。

## 完成定义

本 FR 完成时，仓库内必须至少存在：

- `spec.md`
- `plan.md`
- `TODO.md`
- `contracts/cloakbrowser-final-args-evidence-contract.md`
- `data-model.md`
- `risks.md`

本 FR 不要求 `research.md`：当前上游正式 contract、CloakBrowser sibling descriptor 与 issue scope 已足够冻结该 evidence 边界，没有新的外部未知项需要单独 research 落库。若后续出现 provider-side raw snapshot schema、attach artifact source 或 redaction policy 外部依赖的新未知项，应另开 issue / suite 承接。
