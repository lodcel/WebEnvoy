# FR-0058 Risks

## 风险 1：final args evidence 被误当作 readiness / live evidence

- 表现：downstream consumer 把 build-time 或 reconstructed args summary 当作 browser honored args、runtime ready、health pass、capability allow 或 live evidence。
- 影响：会把弱证据误报成可执行/可合并事实，污染 capability、health 与 closeout gate。
- 缓解：spec 强制 `does_not_prove` 枚举，并要求 consumer 在 required readiness/live 结论上继续消费独立 owner。

## 风险 2：redaction boundary 失守导致 secret/path 泄露

- 表现：final args evidence 直接记录 full local path、raw argv token、token、proxy credential、fingerprint seed value 或 private patch payload。
- 影响：污染 PR body、artifact、stdout summary 与 spec sample，带来安全和隐私风险。
- 缓解：spec 将上述内容列为 forbidden disclosure；命中时必须 `redaction_invalid` 或 `secret_leak_detected` 并 fail-closed。

## 风险 3：variant 边界被共享 contract 吞并

- 表现：shared final args evidence 顺手定义 persistent profile / broker attach / extension workflow / cloakserve endpoint security 语义。
- 影响：与 `FR-0049` / `FR-0050` / `FR-0051` ownership 冲突，后续 health/capability owner 无法清晰消费。
- 缓解：spec 单独列出 direct/persistent/cloakserve variant boundary，只允许缩窄证明范围，不允许升级为 readiness proof。

## 风险 4：历史或 partial reconstruction 被误用为 current-run required evidence

- 表现：`historical_background`、`unknown`、`reconstructed_partial` evidence 被拿去满足 current-run gate。
- 影响：closeout、capability allow 或 doctor summary 使用陈旧/不完整证据。
- 缓解：spec 要求这些状态命中 required evidence 时 fail-closed，并在 semantic conclusion 中保留 consumer warning / blocking conditions。
