# FR-0057 Research

## 输入证据

- #1154 issue body：要求通过 WebEnvoy extension/native host/bridge doctor 验证 Native Messaging，并明确不得把它声明为 CloakBrowser-owned capability。
- `FR-0038 Provider Health / Doctor Contract`：已冻结 `provider_doctor_report`、Native Messaging check category、evidence refs、doctor checked 上限与 fail-closed 规则。
- `FR-0046 Native Messaging Health`：已冻结 Native Messaging host identity、manifest、allowed origins、registration、socket / bridge readiness、stateful health matrix、diagnostics codes 与 redaction 规则。
- `FR-0050 cloakbrowser.persistent Descriptor`：已声明 persistent variant 需要 extension workflow 与 Native Messaging refs，但 descriptor refs 不等于 doctor pass。
- `FR-0051 cloakbrowser.cloakserve Descriptor`：已声明 cloakserve default extension disabled、Native Messaging unsupported，后续 capability/limitation 必须 fail-closed。
- `vision.md` / `docs/dev/AGENTS.md`：正式 FR 必须保持 ownership、fail-closed、安全敏感边界和 PR closing semantics 清晰。

## 已知边界核对

### 与 FR-0038 的关系

- FR-0038 定义 doctor report 的通用 carrier。
- FR-0057 只定义 CloakBrowser lane 下 WebEnvoy bridge doctor handoff 如何映射到该 carrier。
- 本 FR 不新增 doctor report category、status、blocking、outcome 或 evidence schema。

### 与 FR-0046 的关系

- FR-0046 是 official Chrome persistent 的 Native Messaging health semantics。
- FR-0057 复用 host / manifest / origin / registration / transport / handshake 的 failure discipline，但把 ownership 缩窄为 WebEnvoy bridge doctor 与 CloakBrowser variant applicability。
- 本 FR 不重写 official Chrome specific provider/channel requirements。

### 与 FR-0050 的关系

- FR-0050 persistent descriptor 提供 `native_messaging_ref`、extension workflow 和 health inputs。
- FR-0057 说明这些 refs 只是 doctor inputs，不能被 downstream 当作 pass。
- Persistent 是本 FR 的主要 applicable CloakBrowser variant。

### 与 FR-0051 的关系

- FR-0051 cloakserve 默认不支持 WebEnvoy extension bridge / Native Messaging。
- FR-0057 将该边界冻结为 `unsupported_by_descriptor` / `not_applicable_fail_closed`。
- 本 FR 不为 cloakserve 创建 opt-in extension workflow 或 bridge support。

## Integration 判断

#1154 issue label 为 `integration:local-only`，且本 FR 不修改 Syvert payload、shared normalized result、run id / request id semantics 或 cross-repo joint acceptance。

因此 PR metadata 应申报：

- `integration_applicable=no`
- `integration_ref=none`
- `shared_contract_changed=no`
- `external_dependency=none`
- `merge_gate=local_only`
- `contract_surface=none`
- `joint_acceptance_needed=no`

虽然本 FR 处于 provider lane，但它只冻结本仓库 CloakBrowser Native Messaging doctor handoff，不触发 owner-level integration gate。

## Live evidence 判断

本 PR 不声称：

- CloakBrowser runtime 已可用。
- Native Messaging host / extension bridge 已真实运行。
- WebEnvoy bridge doctor command 已实现。
- target tab、page command、account safety 或 latest-head fresh live evidence 已通过。

因此：

- `gate_applicability.review_lane=formal_spec_review_pr`
- `gate_applicability.in_scope=false`
- `live_evidence_record=N/A`
- 验证只需要 docs/spec/map/purity/diff checks 与 hosted checks。

## 结论

建立 `FR-0057-cloakbrowser-native-messaging-bridge-doctor` formal suite 是 #1154 的正确落点。它应保持 refs-only 语义，为后续 doctor implementation、capability matrix 与 limitation gate 提供一个更窄、可 fail-closed 的 WebEnvoy-owned bridge doctor handoff，而不是把 Native Messaging 能力归属、stub evidence 或 descriptor refs 留到实现阶段临场判断。
