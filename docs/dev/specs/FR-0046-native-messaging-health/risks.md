# FR-0046 risks

## 风险等级

High。

理由：Native Messaging 是 official Chrome persistent provider 的关键 runtime bridge。虽然本 PR 不实现行为，但其 health definition 会影响后续 provider admission、capability readiness、fixtures and closeout evidence。

## 主要风险

### 1. 新增 health schema 绕过 FR-0038

风险：#1141 为 native messaging 定义第二套 report object、status enum 或 outcome 字段。

影响：后续 doctor parser、provider admission 和 fixtures 无法统一消费 health result。

缓解：本 FR 固定所有 health output 必须是 FR-0038 `ProviderDoctorCheck`，`category="native_messaging"`。

回滚：删除私有 schema，仅保留 FR-0038 mapping。

### 2. Scope 污染 #1140 或 #1142

风险：allowed origins 或 bridge handshake 描述扩展成 persistent extension identity health 或 service worker freshness health。

影响：M3-C health ownership 重叠，scheduler 无法并行消费 #1140/#1141/#1142。

缓解：本 FR 只要求与 adjacent owner conclusion 对齐；不得定义 extension identity pass 或 service worker code freshness。

回滚：移除 #1140/#1142 语义，改成 next gate / dependency reference。

### 3. Stub/fake host evidence 被误判为 official Chrome readiness

风险：实现或 fixtures 使用 stub Native Host、fake host、historical artifact 或 non-official Chrome surface 证明 persistent provider ready。

影响：provider admission 可能在真实 official Chrome runtime 中失败，甚至绕过专项 live evidence gate。

缓解：contract 明确 stub/fake evidence 对 `official-chrome.persistent` must fail closed，diagnostics 使用 `native_messaging.stub_or_fake_host_evidence`。

回滚：收紧 evidence source 判断和 fixture tests。

### 4. Socket / bridge preflight 被误当作 runtime or live success

风险：socket available 或 bridge handshake ack 被写成 runtime bootstrap ready、target tab ready 或真实页面交互成功。

影响：绕过 runtime attestation 和 live evidence gate。

缓解：spec 明确 Native Messaging health 最高只支持 doctor layer；`target_tab`、`runtime_bootstrap_ready`、`runtime_attested`、`live_evidence_attested` 均不由本 FR 满足。

回滚：移除 runtime/live success language，补 GWT。

### 5. Manifest / allowed origins / socket locator 泄露

风险：PR body、stdout、fixture 或 artifact 中出现 raw manifest、private absolute path、socket path、profile path、bootstrap secret、token 或 extension private payload。

影响：泄露本机、账号、extension 或 native host 安全边界。

缓解：consume FR-0041；required evidence redaction invalid must fail closed。

回滚：删除 raw values，改为 redacted locator / artifact id / secret handle。

### 6. Integration metadata 误判

风险：本 FR 冻结 provider health / diagnostics contract surface；若 PR body 或 checklist 仍申报非 integration-gated metadata，会与 provider/shared-contract gate 口径冲突。

影响：merge gate metadata 与正式 FR suite 不一致，formal review 或 merge-ready parser 可能阻断。

缓解：research、TODO 和 PR body 均使用 integration-gated metadata：`integration_applicable=yes`、`integration_ref="#1113"`、`merge_gate=integration_check_required`、`contract_surface=diagnostics_observability`。

回滚：修正 PR metadata 并重新跑 parser/checks。

### 7. `Fixes #1141` 被误解为 runtime complete

风险：formal spec PR 使用 `Fixes #1141` 后被误读为 Native Messaging runtime implementation 或 live readiness 完成。

影响：后续 implementation / fixtures gate 输入不清。

缓解：spec、plan 和 PR body 明确 #1141 closure is health definition complete；runtime behavior, fixtures and live evidence are out of scope。

回滚：若 issue truth 被调整为 runtime implementation issue，则 PR closing 改为 `Refs #1141` 并拆出 spec-only issue。
