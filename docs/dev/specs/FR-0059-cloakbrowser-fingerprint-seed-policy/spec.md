# FR-0059 CloakBrowser Fingerprint Seed Evidence Policy

Canonical Issue: #1156

## 背景

`#1156` 属于 `#1114 CloakBrowser Provider` 的 M10 formal contract lane。上游 `FR-0041 Evidence Redaction Policy` 已冻结 fingerprint seed 默认属于 `secret`，`FR-0040 Provider Evidence Kernel` 已为 `fingerprint_policy_ref`、`sensitivity` 与 `redaction_state` 预留最小 hook，`FR-0049 cloakbrowser.direct Descriptor` 也已把 `fingerprint_seed_boundary` 冻结为 provider-managed redacted boundary。

当前仍缺一个更窄的 CloakBrowser-specific policy：当后续 evidence、health、capability owners 需要回答“这次指纹种子是否可复现、是否可以记录 hash、哪些内容必须永远不暴露”时，不能只依赖全局 redaction policy 的泛化描述。否则 caller-supplied seed reproducibility、hash 允许条件、private patch 与 fingerprint internals 的披露边界会继续留在实现或 review 当场判断，无法稳定 fail-closed 消费。

本 FR 只冻结 CloakBrowser Fingerprint Seed Evidence Policy 的 formal contract。它不实现 fingerprint generation、browser patching、launch code、doctor/health behavior、capability matrix、evidence collector、Native Messaging、service worker、runtime bootstrap 或任何 live/runtime/account 行为。

## 目标

1. 冻结 `caller_supplied_seed_required_for_reproducibility` 的正式语义。
2. 冻结 fingerprint seed evidence 的默认 redaction、允许的 locator 与 disclosure boundary。
3. 冻结允许记录 seed hash 的前提、允许 surfaces 与 fail-closed 条件。
4. 冻结 raw seed、private patch、fingerprint internals 与 derived internals 不得进入 WebEnvoy core contract 的边界。
5. 为后续 evidence、health、capability owners 提供可机器消费的 fail-closed policy 输入。

## 非目标

- 不实现 fingerprint seed 生成、注入、轮换、持久化、launch、patching、doctor、health、capability matrix、selection 或 runtime behavior。
- 不定义 CloakBrowser private patch schema、stealth parameter、driver internal state、browser patch payload、seed derivation algorithm 或 fingerprint internals data structure。
- 不修改 `FR-0040.provider_evidence_record`、`FR-0041.evidence_redaction_policy` 或 `FR-0049.cloakbrowser.direct` 的字段 shape。
- 不定义 official Chrome、XHS、Syvert、service worker、Native Messaging bridge、closeout evidence 或 live evidence gate。
- 不执行 real browser、real profile、account-touching、external-visible、live read/write 或 fresh live evidence rerun。

## 功能需求

### 1. Policy ownership 与 contract 定位

系统必须冻结一个稳定的 `cloakbrowser_fingerprint_seed_evidence_policy` contract。

约束：

- ownership 属于 WebEnvoy CloakBrowser provider governance / evidence policy surface。
- 该 contract 只表达 fingerprint seed reproducibility、redaction、hash recording 与 disclosure boundary。
- 它不得被解释为：
  - runtime launch result
  - provider health result
  - capability matrix row
  - fingerprint generator implementation
  - browser patch manifest
  - CloakBrowser private patch schema
  - live evidence record
- 后续 evidence、health、capability owners 必须消费本 policy；如需例外，必须独立 formal spec review。

### 2. Reproducibility prerequisite

任何 `fingerprint_seed_reproducible` 结论都必须建立在 caller-supplied seed 上。

约束：

- reproducibility claim 至少要求：
  - `seed_origin=caller_supplied`
  - `seed_ref` 存在且按 `FR-0041` 处理为 `secret_handle` 或等价 redacted secret reference
  - `seed_policy_ref` 指向当前 policy contract
  - `provider_variant_ref` 与 `fingerprint_policy_ref` 可被追溯
- `seed_origin=provider_generated|unknown|mixed` 时，不得输出 reproducible claim。
- provider private patch、runtime-derived fingerprint state、browser internal cache 或 launch side effects 不得被当作 caller-supplied seed 的替代证明。
- reproducibility 只表示“同一 caller-supplied seed 可作为后续对比输入”；它不证明 seed 已应用、fingerprint 一致性已通过、anti-detection pass、runtime ready 或 live evidence accepted。

### 3. Seed origin classification

`seed_origin` 至少支持以下取值：

- `caller_supplied`
- `provider_generated`
- `mixed`
- `unknown`

约束：

- `caller_supplied` 是唯一允许支撑 reproducibility claim 的 origin。
- `mixed` 表示 caller input 与 provider-private derivation 混合；此时只能输出 `reproducibility=blocked` 或等价 fail-closed 结论。
- `unknown` 命中 required evidence、health comparison 或 capability gating 时必须 fail-closed。
- seed origin classification 不得暴露 raw seed、private patch payload 或 fingerprint internals。

### 4. Default redaction

fingerprint seed raw value 默认 `secret`，必须消费 `FR-0041`。

约束：

- raw seed 不得进入 PR body、stdout summary、public artifact、internal artifact、fixture、spec sample、descriptor、health summary、capability summary 或 unredacted artifact。
- seed evidence 必须使用 `secret_handle`、opaque ref 或 `<redacted:fingerprint_seed>`。
- seed-related public summary 只允许暴露：
  - `seed_origin`
  - `reproducibility_status`
  - `seed_hash_status`
  - contract refs、run id、artifact id、head sha
- 任何 raw seed 出现在 evidence/health/capability/PR metadata 时，必须判为 `invalid` 并输出 blocker。

### 5. Hash recording policy

允许记录 hash，但仅限 policy-approved 条件。

最小条件：

- `seed_origin=caller_supplied`
- hash 仅针对 caller-supplied seed 本体，不得掺入 private patch payload、driver internals、browser state 或 account-affine secret
- hash algorithm 必须是 one-way approved algorithm 的结果引用；不得记录可逆编码、加密密文原文、truncated raw seed 或 debug echo
- hash recording 必须带有 `seed_hash_scope`
- `seed_hash_ref` 必须可追溯到当前 run / artifact / policy version

约束：

- `seed_hash_scope` 至少支持：
  - `internal_diagnostic`
  - `cross_run_repro_check`
  - `capability_gate_input`
  - `health_gate_input`
- `seed_hash_scope=public_summary` 不允许。
- hash 只能作为 equality / provenance input；不得被解释为 raw seed substitute、provider eligibility、runtime attestation 或 anti-detection pass 证明。
- 如无法证明 hash 只来源于 caller-supplied seed，本条必须 fail-closed。

### 6. Hash disclosure boundary

`seed_hash_ref` 与 `seed_hash_value` 的披露边界必须分离。

约束：

- public surfaces 只能使用 `seed_hash_ref`、artifact identity、run-scoped ref 或 `seed_hash_present=true|false`。
- `seed_hash_value` 默认至少为 `sensitive`，不得进入 PR body、stdout summary、spec sample、fixture 或 capability summary。
- internal artifact 如保留 `seed_hash_value`，必须仍满足 redacted/opaque storage boundary，不得附带 raw seed、private patch payload 或 fingerprint internals。
- 同一 evidence 在 public 与 internal surfaces 中可以用不同 locator，但必须能追溯到同一 artifact identity。

### 7. Forbidden disclosure set

以下内容永远不得进入 WebEnvoy core formal contract、public summary、fixture、spec sample 或 downstream reusable evidence sample：

- raw fingerprint seed
- seed substring、seed preview、truncated seed、base64 seed、masked-but-reversible seed
- private patch payload
- private patch manifest body
- stealth parameter raw values
- driver internal state
- fingerprint internals snapshot
- runtime-derived fingerprint vector 或可反推出 seed 的 derived internals

约束：

- 这些内容只能保持在 provider-private boundary 外，不得被 formal contract 引用为 structured field。
- 如 downstream owner 需要证明其存在，只能使用 `provider_private_ref`、opaque evidence ref 或 blocker conclusion。

### 8. Downstream consumption boundary

后续 consumers 的允许范围固定如下：

- evidence owner：可消费 `seed_origin`、`reproducibility_status`、`seed_ref`、`seed_hash_ref`、`seed_hash_status`
- health owner：可消费 reproducibility 是否满足 required diagnostic precondition，不得读取 raw seed
- capability owner：可消费 fail-closed policy result，不得把 hash presence 写成 capability support proof

约束：

- downstream consumer 不得新增“公开展示 raw seed 以便调试”的 local exception。
- downstream consumer 不得用 hash presence 替代 seed origin proof。
- downstream consumer 不得把 `provider_generated` 或 `mixed` 标成 reproducible。
- downstream consumer 需要 seed comparison 时，必须只使用 policy-approved hash / ref，而不是 raw seed。

### 9. Fail-closed rules

以下情况必须 fail-closed：

- reproducibility claim 缺少 caller-supplied seed proof。
- `seed_origin=provider_generated|mixed|unknown` 仍被标为 reproducible。
- raw seed、private patch payload、fingerprint internals 或 reversibly masked seed 出现在任何 forbidden surface。
- `seed_hash_value` 被公开到 PR body、stdout summary、fixture、spec sample 或 capability summary。
- 无法证明 hash 只来自 caller-supplied seed。
- hash algorithm 或 scope unknown，但 consumer 仍把其用于 required evidence / health / capability gate。
- downstream consumer 用 descriptor presence、doctor pass、launch pass 或 live evidence 替代 reproducibility proof。

## GWT 验收场景

### 场景 1：只有 caller-supplied seed 才能宣称可复现

Given CloakBrowser evidence 需要回答 fingerprint seed 是否可复现
And `seed_origin=caller_supplied`
When consumer 读取 fingerprint seed evidence policy
Then 只有在 `seed_ref`、`seed_policy_ref`、`provider_variant_ref` 与 `fingerprint_policy_ref` 可追溯时，才允许输出 reproducible claim
And 不得因为 provider-generated state 或 private patch existence 自动判定 reproducible

### 场景 2：provider-generated seed 必须阻断 reproducibility

Given `seed_origin=provider_generated`
When health 或 capability gate 试图消费 reproducibility conclusion
Then consumer 必须 fail-closed
And 不得把 provider-generated seed、runtime-derived seed 或 mixed seed 当作 caller-supplied seed

### 场景 3：seed hash 可以记录但不能公开

Given caller-supplied seed 需要跨 run 做 reproducibility 对比
When implementation 记录 policy-approved hash
Then PR body、stdout summary 与 spec sample 只能使用 `seed_hash_ref` 或 `seed_hash_present`
And `seed_hash_value` 不得公开
And hash 不得掺入 private patch payload 或 fingerprint internals

### 场景 4：raw seed 泄露必须直接失效

Given fingerprint evidence artifact 含有 raw seed 或可逆 seed preview
When consumer 执行 policy validation
Then evidence 必须标记为 `invalid`
And 输出 blocker
And downstream gate 不得继续把该 evidence 当作 required input

### 场景 5：private patch 与 fingerprint internals 不得进入 core contract

Given CloakBrowser provider 需要证明 fingerprint policy 生效
When descriptor、health 或 evidence contract 引用 fingerprint seed boundary
Then 只能使用 redacted / opaque / provider-private refs
And 不得展开 private patch payload、stealth parameter、driver internal state 或 fingerprint internals snapshot

## 异常与边界场景

- `seed_origin=mixed` 时，即使 caller 提供了 seed，也必须阻断 reproducibility，直到后续独立 FR 明确 mixed-mode rule。
- `seed_hash_present=true` 不代表 reproducibility 成立；缺少 caller-supplied proof 时仍必须阻断。
- provider private ref 只能证明 provider-private boundary 存在，不证明 patch correctness、runtime ready 或 anti-detection effectiveness。
- 本 FR 不要求 fixed hash algorithm name 暴露到 public summary；如 algorithm disclosure 本身扩大攻击面，允许只保留 approved algorithm class ref。

## 验收标准

1. Formal suite 明确 caller-supplied seed 是 reproducibility claim 的唯一合法前提。
2. Formal suite 明确 raw seed 默认 `secret`，只能以 redacted secret reference 表达。
3. Formal suite 明确 seed hash 只能在 policy-approved 条件下记录，且 `seed_hash_value` 不得进入 public surfaces。
4. Formal suite 明确 private patch、stealth parameter、driver internal state 与 fingerprint internals 不得进入 WebEnvoy core reusable contract。
5. Formal suite 明确 downstream evidence、health 与 capability owners 的 fail-closed consumption boundary。

## 完成定义

本 suite 合入后，`#1156` 的 formal contract 输入达到 PR-ready：

1. `spec.md`、`plan.md`、`TODO.md`、`contracts/`、`data-model.md`、`research.md`、`risks.md` 齐备。
2. `#1156` 与 `FR-0059` 的 sync-map 已建立。
3. PR 保持 refs-only 语义，供 scheduler 运行 formal review / merge gate。
