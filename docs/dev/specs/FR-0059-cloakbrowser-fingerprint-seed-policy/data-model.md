# FR-0059 data model

## 定位

本 FR 不引入新的持久化表、runtime row、launch payload、doctor payload 或 capability matrix object。这里的 data model 只冻结 CloakBrowser fingerprint seed evidence policy 的共享对象语义，供后续 evidence、health、capability consumers 使用。

## 核心对象

### `cloakbrowser_fingerprint_seed_evidence_policy`

职责：

- 定义 reproducibility claim 的必要前提。
- 定义 seed origin classification。
- 定义 raw seed 默认 redaction 与 hash recording 边界。
- 定义 downstream fail-closed consumption 规则。

非职责：

- 不表达 fingerprint generator implementation。
- 不表达 private patch schema、driver internals 或 fingerprint internals structure。
- 不表达 runtime readiness、doctor pass、capability support 或 live evidence gate。

生命周期：

1. `frozen`：本 suite 合入后成为 formal policy。
2. `consumed`：后续 CloakBrowser evidence、health、capability owners 通过 contract ref 使用。
3. `revised`：若要降低 redaction 或放宽 reproducibility rule，必须独立 formal review。

### `fingerprint_seed_origin`

```ts
type FingerprintSeedOrigin =
  | "caller_supplied"
  | "provider_generated"
  | "mixed"
  | "unknown";
```

语义：

- `caller_supplied`：唯一允许支撑 reproducibility claim 的 origin。
- `provider_generated`：provider 自行决定或派生；不能宣称 caller-controlled reproducibility。
- `mixed`：caller input 与 provider-private logic 混合；默认 fail-closed。
- `unknown`：无法证明来源；required consumption 默认 fail-closed。

### `fingerprint_seed_reproducibility_status`

```ts
type FingerprintSeedReproducibilityStatus =
  | "reproducible"
  | "not_reproducible"
  | "blocked"
  | "unknown";
```

约束：

- `reproducible` 只允许在 `seed_origin=caller_supplied` 且 required refs 齐备时出现。
- `blocked` 用于 mixed / missing proof / policy violation。
- `unknown` 命中 required health/capability/evidence gate 时必须 fail-closed。

### `fingerprint_seed_reference`

职责：

- 以 redacted secret reference 表达 caller-supplied seed 的存在与 provenance。

约束：

- 只能是 `secret_handle`、opaque locator 或 `<redacted:fingerprint_seed>`。
- 不得保存 raw seed、seed preview、可逆 masked seed、base64 seed 或 path-derived seed dump。

### `fingerprint_seed_hash_record`

职责：

- 在 policy-approved 条件下提供 equality / provenance 输入。

最小字段语义：

- `seed_hash_ref`
- `seed_hash_scope`
- `seed_hash_status`
- `artifact_identity`
- `policy_ref`

约束：

- `seed_hash_scope` 只能来自 allowlisted internal scopes。
- `seed_hash_status` 至少区分 `recorded|not_recorded|blocked|unknown`。
- `seed_hash_ref` 可进入 public summary；`seed_hash_value` 不可。
- hash 不能混入 private patch payload、driver internals、browser state 或 account-affine secret。

### `forbidden_seed_disclosure`

职责：

- 枚举绝不允许进入 reusable contract 或 public surface 的 seed-related payload。

覆盖：

- raw seed
- reversible seed preview
- private patch payload
- stealth parameter raw values
- driver internal state
- fingerprint internals snapshot
- reverse-derivable derived internals

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| `seed_origin` | FR-0059 | runtime launch result、provider health result |
| `reproducibility_status` | FR-0059 | capability support proof、anti-detection pass |
| `seed_ref` | FR-0059 consumes FR-0041 | secret storage implementation |
| `seed_hash_ref` / scope | FR-0059 | raw seed disclosure、runtime attestation |
| forbidden disclosure set | FR-0059 | provider private schema |
| `fingerprint_policy_ref` | FR-0040 / FR-0049 consumed by FR-0059 | seed application proof |

## 兼容策略

- 当前 policy contract version 为 `FR-0059.cloakbrowser_fingerprint_seed_evidence_policy.v1`。
- 同一主版本内允许新增更细的 internal-only hash scope guidance，但不得放宽 raw seed、hash value、private patch 或 fingerprint internals 的 disclosure boundary。
- 降低 redaction、允许 public hash value、允许 provider-generated reproducibility 或允许 mixed mode 直通，必须重新 formal review。
