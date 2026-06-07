# FR-0046 Data Model

## 定位

本 FR 不引入新的持久化表、迁移、runtime status row、Native Messaging schema 或 provider evidence record shape。这里的 data model 只冻结 Native Messaging Health 在 `FR-0038.provider_doctor_report` 内的 check semantics。

## 核心对象

### `native_messaging_health_mapping`

职责：

- 将 `official-chrome.persistent` 的 Native Messaging readiness refs 映射到 FR-0038 `native_messaging` checks。
- 表达 host identity、manifest、allowed origins、registration、socket availability 与 bridge handshake 的 pass/fail/unknown 语义。
- 为后续 doctor implementation、fixtures 和 provider admission 提供稳定判定输入。

非职责：

- 不表达 Native Messaging host manifest schema。
- 不表达 native host process lifecycle。
- 不表达 socket implementation、pipe name、port 或 retry policy。
- 不表达 bridge message envelope。
- 不表达 runtime status、launch evidence、fixture payload 或 live evidence。

生命周期：

1. `declared`：FR-0043 persistent descriptor 声明 Native Messaging readiness refs。
2. `checked`：后续 implementation 生成 FR-0038 doctor checks。
3. `consumed`：provider admission、capability readiness 或 fixture validator 消费 checks。
4. `superseded`：新的 doctor report、runtime attestation 或 live evidence 取代旧 health evidence。

本 FR 只冻结 lifecycle 的 contract 语义，不实现推进器。

### `native_messaging_required_check`

职责：

- 表达一个 required Native Messaging readiness fact。
- 绑定 `check_id`、FR-0038 category/status/blocking、diagnostics code 与 evidence refs。

约束：

- `check_id` 必须来自本 FR contract 的 required set。
- `category` 固定为 `native_messaging`。
- Required check 缺失、not_applicable、unknown、fail、blocking、fatal evidence 或 evidence invalid 时必须 fail-closed。
- Provider-level check 使用 `capability_id=N/A`；capability-specific consumption 由 FR-0038 `capability_readiness` 承接。

### `native_messaging_evidence_locator`

职责：

- 引用 manifest、allowed origins、registration、socket、bridge handshake 或 command output evidence。
- 通过 FR-0038 evidence refs 和 FR-0040 evidence refs 表达 locator。

约束：

- Evidence locator 是 redacted/artifact/logical locator，不是完整 manifest、raw private path、socket path、credential-bearing argv/env 或 secret。
- `sensitivity=secret` 只能以 secret handle 或 redacted locator 表达。
- Required evidence 如果 `partial|unavailable` 或 redaction invalid，相关 check 不得 pass。

### `native_messaging_capability_consumption`

职责：

- 将 provider-level Native Messaging checks 汇总给 requested capability 的 `native_messaging` runtime requirement。

约束：

- `native_messaging` 只在所有 required provider-level checks 均为 `status=pass`、`blocking=none`、无 fatal evidence 且 required evidence current/redacted 时进入 `satisfied_runtime_requirements`。
- `status=not_applicable` 不能满足 `official-chrome.persistent` 的 required/requested `native_messaging`；它只能表达非 required provider 或未请求 capability 的 N/A。
- 任一缺口必须进入 `unsatisfied_runtime_requirements`，并阻断相应 capability。
- 本 FR 不满足 `target_tab`、`runtime_bootstrap_ready`、`runtime_attested` 或 `live_evidence_attested`。

### `native_messaging_stateful_readiness`

职责：

- 将 host/socket/bridge runtime-like signals 归一为 FR-0038 / FR-0040 可消费状态。
- 区分 current `ready`、same-run `recoverable`、`disconnected`、`blocked` 与 `unknown`。
- 为后续 implementation 的 retry、cleanup、contention 和 stale evidence handling 提供 formal constraints。

约束：

- 该对象是 data model 说明，不是新增 health result payload。
- State 必须通过 FR-0038 checks 与 FR-0040 `native_messaging_runtime_status` 表达。
- `recoverable` 不满足 admission；只有 fresh current evidence 可把状态推进为 `ready`。
- Unowned orphan process/socket、concurrent contention、stub/fake source、secret leak 或 redaction invalid 必须保持 non-pass。

### `native_messaging_recovery_path`

职责：

- 规定 same-run retry、idempotent start/stop、current-run orphan cleanup、stale ready signal rejection 与 contention handling 的最小 contract。

约束：

- 不定义 retry count、timeout、socket path、pipe name、process supervisor 或 cleanup implementation。
- Cleanup 只能用于可证明属于 current run 的 host/socket/pipe。
- Historical ready evidence 只能作为 background，不得满足 current readiness。
- Pending 或 failed recovery 必须让 capability requirement 保持 unsatisfied。

## 字段 ownership

| 字段组 | Ownership | 不得替代 |
|---|---|---|
| Health report shape | FR-0038 | 新 Native Messaging health schema |
| Native Messaging required check semantics | FR-0046 | Host implementation、bridge protocol |
| Persistent descriptor refs | FR-0043 consumed by FR-0046 | Health pass、runtime ready |
| Evidence refs | FR-0038 / FR-0040 consumed by FR-0046 | Artifact store、live evidence record |
| Redaction policy | FR-0041 consumed by FR-0046 | Secret store、redaction engine |
| Stateful readiness mapping | FR-0046 consumes FR-0038 / FR-0040 | Runtime status schema、process lifecycle implementation |
| Recovery path semantics | FR-0046 contract only | Retry algorithm、socket lifecycle implementation |
| Persistent extension identity | #1140 | Allowed origins owner replacement |
| Service worker freshness | #1142 | Bridge readiness replacement |
| Capability matrix | #1139 | Health check result |

## 兼容策略

- 当前 Native Messaging Health mapping version is `FR-0046.v1` through the suite path and contract name.
- 同一版本内允许新增更细的 diagnostics code 或 optional non-blocking evidence hint。
- 修改 required check set、blocking semantics、FR-0038 mapping、redaction fail-closed 规则或 runtime/live boundary，必须重新进入 formal spec review。
- 后续 implementation 不得通过 provider-private field 绕过 required Native Messaging checks。
