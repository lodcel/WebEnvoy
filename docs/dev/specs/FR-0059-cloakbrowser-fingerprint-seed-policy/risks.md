# FR-0059 risks

## 风险等级

High。

理由：本 FR 冻结的是 caller-supplied seed reproducibility 与 hash evidence policy。虽然不改 runtime 代码，但它会直接影响后续 evidence、health、capability owners 如何处理 secret、linkability 与 fail-closed gate。

## 主要风险

### 1. Raw seed 或可逆 seed preview 泄露

风险：后续 evidence、health、fixture、PR body 或调试 artifact 直接保存 raw seed、truncated seed、base64 seed 或 masked-but-reversible seed。

缓解：

- spec 明确 raw seed 及其可逆变体一律视为 forbidden disclosure。
- 只能使用 `secret_handle`、opaque ref 或 `<redacted:fingerprint_seed>`。
- 出现泄露时必须标记 `invalid` 并 fail-closed。

### 2. Hash 被误当作可公开值或 raw seed 替代物

风险：实现为了方便 diff 或 review，把 `seed_hash_value` 直接写进 PR body / stdout summary，或把 hash presence 当成 raw seed proof。

缓解：

- spec 区分 `seed_hash_ref` 与 `seed_hash_value`。
- public surfaces 只允许 `seed_hash_ref` 或 `seed_hash_present`。
- `seed_hash_value` 默认至少为 `sensitive`，不允许 public disclosure。

### 3. Provider-generated / mixed seed 被误报为 reproducible

风险：后续 consumer 为了减少 blocker，把 provider-generated 或 mixed seed 也记成 reproducible，削弱 caller-controlled reproducibility 的正式语义。

缓解：

- spec 明确 `caller_supplied` 是唯一允许的 reproducibility origin。
- `provider_generated|mixed|unknown` 命中 required gate 必须 fail-closed。
- TODO 中加入 same-class review checklist，防止 review 时被模糊化。

### 4. Private patch / fingerprint internals 污染 core contract

风险：为了证明 seed 生效，downstream owner 顺手把 private patch payload、stealth parameter、driver state 或 fingerprint internals snapshot 写进 evidence 或 health schema。

缓解：

- spec 明确这些内容永远不进入 WebEnvoy core contract。
- 只允许 provider-private ref、opaque evidence ref 或 blocker conclusion。
- research 标记 FR-0049 只作为 boundary consumer，不承接 private schema。

### 5. Scope 漂移到 runtime / health / capability matrix

风险：formal policy PR 顺手加入 seed generation、doctor logic、matrix support row 或 launch behavior。

缓解：

- plan 将 runtime、doctor、health behavior、capability matrix、launch code 列为禁止范围。
- purity check 必须只看到 `FR-0059` suite 与单条 sync-map 映射。

## 回滚

如本 suite 被判定边界错误，使用 revert PR 移除 `docs/dev/specs/FR-0059-cloakbrowser-fingerprint-seed-policy/**` 与 `.github/spec-issue-sync-map.yml` 中 #1156 的映射。由于本 PR 不实现 runtime 行为，无需 secret rotation、profile cleanup 或 external rollback。
