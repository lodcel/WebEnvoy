# FR-0057 Risks

## 风险等级

High。

理由：本 FR 虽然不改 runtime 代码，但会影响后续 Native Messaging doctor、capability matrix、limitation gate 和 health admission 如何判定 CloakBrowser variants 的 bridge readiness。错误边界会把弱证据或 provider-private 能力误写为 WebEnvoy runtime ready。

## 主要风险

### 1. Native Messaging 被误归属为 CloakBrowser-owned capability

风险：后续 descriptor / capability matrix 将 CloakBrowser managed browser support、provider broker 或 private extension workflow 写成 Native Messaging capability owner。

影响：绕过 WebEnvoy extension/native host/bridge doctor 的真实验证，污染 doctor report 和 selection gate。

缓解：

- spec 强制 `doctor_owner=webenvoy_native_messaging_bridge_doctor`。
- ownership mismatch 映射为 provider/capability fail-closed。
- TODO 中加入 same-class checklist，审查所有 CloakBrowser-owned Native Messaging claim。

### 2. Descriptor refs 被误当作 readiness

风险：`cloakbrowser.persistent.native_messaging_ref` 或 extension workflow refs 被 downstream 当成 bridge ready。

影响：缺少 host/manifest/origin/registration/transport/handshake evidence 时仍被放行。

缓解：

- spec 明确 descriptor refs 只能决定 preflight applicability。
- `provider_doctor_report_ref` 缺失时不能输出 `bridge_doctor_ready`。
- Capability readiness 必须消费 FR-0038 checks。

### 3. Stub/fake 或历史 evidence 污染 doctor pass

风险：使用 stub host、fake host、历史 artifact、same-head old artifact、stale pipe/socket 或旧 ack 证明 Native Messaging ready。

影响：PR 和后续 gates 会消费非当前、非真实 WebEnvoy bridge evidence。

缓解：

- `stub_or_fake_host_evidence`、`stale_or_historical_evidence`、`source_integrity_failed` 均为 fail-closed failure classes。
- ready state 要求 current / redacted / non-stub evidence。

### 4. cloakserve unsupported 边界被绕过

风险：后续实现发现 cloakserve 可加载扩展或有某种 provider-private bridge 后，直接把它升级为 WebEnvoy Native Messaging support。

影响：违反 `FR-0051` 默认 extension disabled / Native Messaging unsupported 边界，污染 #1149/#1152 输入。

缓解：

- FR-0057 固定 cloakserve 默认 `unsupported_by_descriptor|not_applicable_fail_closed`。
- 要改变该边界必须独立 formal FR revision。

### 5. Secret 或 provider-private payload 泄露

风险：Native Messaging manifest body、allowed origins raw config、bootstrap secret、profile path、account id、broker credential 或 private patch payload 进入 PR body、artifact、stdout summary 或 spec sample。

影响：安全和隐私泄露，并破坏 evidence redaction gate。

缓解：

- input refs / evidence refs 只能使用 redacted locator、opaque handle 或 artifact id。
- `secret_or_private_payload_leak` invalidates evidence and fails closed。

### 6. Doctor pass 被升级为 runtime/live pass

风险：bridge handshake preflight pass 被表述为 runtime bootstrap ready、target tab ready、page command success、account safe 或 live evidence。

影响：绕过 runtime admission、live evidence 专项门禁和 closeout gate。

缓解：

- spec 多处声明 `bridge_doctor_ready` 最高只能支撑 doctor-layer readiness。
- `runtime_gate_required` 作为 next gate boundary，而不是 pass state。
- capability readiness 不得满足 `target_tab`、`runtime_bootstrap_ready`、`runtime_attested` 或 `live_evidence_attested`。

## 回滚

如本 suite 被判定边界错误，使用 revert PR 移除 `docs/dev/specs/FR-0057-cloakbrowser-native-messaging-bridge-doctor/**` 与 `.github/spec-issue-sync-map.yml` 中 #1154 的映射。由于本 PR 不实现 runtime 行为，无需 profile cleanup、native host cleanup、secret rotation 或外部系统回滚。
