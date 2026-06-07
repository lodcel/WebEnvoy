# FR-0037 risks

## 风险 1：把 Launch Envelope 误写成 provider registry 或 selection 实现

- 表现：spec 中冻结 provider registry row、selection algorithm、installation state 或 provider lifecycle state。
- 影响：越界到 `#1124/#1125/#1130`，导致 spec review 与 implementation review 混写。
- 缓解：本 FR 只冻结 launch-time envelope；registry、selection、doctor 与 adapter implementation 由后续事项消费。
- 回滚：移除 registry / selection / lifecycle 字段，保留 provider reference 与 launch requirements。

## 风险 2：重定义 FR-0033 Browser Provider Contract

- 表现：Launch Envelope 重新声明 provider identity、capabilities、verification evidence 或 limitations。
- 影响：两个 provider contract 来源发生漂移，后续 consumer 无法判定权威。
- 缓解：Launch Envelope 只通过 `provider_contract_ref` 与 `capability_refs` 引用 FR-0033。
- 回滚：删除重复 provider declaration，改为引用 FR-0033 字段。

## 风险 3：把 evidence requirements 当成 evidence kernel

- 表现：把 `launch_envelope.evidence_requirements` 当作已采集 artifact、doctor report 或 live evidence record。
- 影响：绕过 `#1128` 和 `FR-0016`，造成 merge gate 或 runtime gate 误判。
- 缓解：本 FR 明确 requirements 只声明需要什么，不能证明已经采集。
- 回滚：收紧 wording，补充 GWT，确保 evidence output 由 #1128 或对应 gate 产出。

## 风险 4：secret 泄露进入 envelope artifact

- 表现：`proxy_ref`、seed ref、profile ref、extension paths 或 Native Host manifest 内联 credential、Cookie、token、具体 seed 或 run secret。
- 影响：PR artifact、logs 或 runtime diagnostics 泄露敏感数据。
- 缓解：所有敏感来源只允许 redacted locator；extension paths 不承载 run/session secret。
- 回滚：替换内联 secret 为 locator，并补充 redaction policy reference。

## 风险 5：official Chrome 主路径退回 per-run staged extension

- 表现：Launch Envelope 把 `dev_unpacked_extension` 或 per-run staged extension 写成 official Chrome 正式主路径。
- 影响：违反 FR-0015 persistent extension identity 边界。
- 缓解：official Chrome 主路径必须使用 `persistent_profile_extension`；dev unpacked 只能用于开发/诊断。
- 回滚：修正 runtime binding mode，并把安装/分发候选路径移出本 FR。

## 风险 6：headless 与 real-browser evidence 混淆

- 表现：`real_browser_required=true` 时仍允许 `headless=true` 通过 admission。
- 影响：真实浏览器证据和 high-risk live gate 被错误放行。
- 缓解：GWT 和 fail-closed 规则明确 real-browser launch 不允许 headless 漂移。
- 回滚：收紧 browser mode 规则，要求后续 gate 单独冻结例外。

## 风险 7：fingerprint seed policy 被误用为 provider private patch schema

- 表现：把 provider 私有 stealth 参数、patch 内部字段或 driver state 写入 Launch Envelope。
- 影响：WebEnvoy core 被 provider 私有实现绑死。
- 缓解：仅允许 `patch_manifest_ref` locator，不展开私有 schema。
- 回滚：把私有字段降级为 provider-specific artifact ref 或后续 provider-specific FR。

## 风险 8：PR metadata 误判为 local-only

- 表现：本 FR 改变 provider/shared launch contract，却填写 `integration_applicable=no`、`shared_contract_changed=no`、`merge_gate=local_only` 或 `contract_surface=none`。
- 影响：provider/shared-contract gate 无法消费正式契约。
- 缓解：PR metadata 使用 provider/shared-contract gate，锚定 `#1111`；`contract_surface=runtime_modes`，`external_dependency=none`，`joint_acceptance_needed=no`。
- 回滚：修正 PR body integration fields，并重新跑 metadata / guardian 检查。

## 风险 9：`Fixes #1126` 被误读为关闭 downstream implementation

- 表现：reviewer 将 formal spec PR 的 `Fixes #1126` 误判为完成 provider registry、doctor、evidence kernel、launch implementation 或 runtime behavior。
- 影响：`#1126` 的 `fr-complete` truth 无法被 spec review 消费。
- 缓解：本 suite 显式记录 #1126 是 spec-only / contract-freeze FR；downstream issues 保持打开。
- 回滚：若 issue truth 被调整为实现闭环事项，则将 PR closing 改为 `Refs #1126` 并拆出 implementation closeout。

## 风险 10：状态型 launch admission 输入缺少健康矩阵

- 表现：profile lock、登录态、extension identity、Native Messaging 或 runtime bootstrap 只被写成字段要求，没有 healthy / disconnected / recoverable / blocked 判定。
- 影响：后续实现可能把断连、旧 ready 信号、stale lock 或 bootstrap retry 误判为可启动状态。
- 缓解：本 FR 补齐 Launch admission health matrix、恢复路径与最小验证矩阵；`unknown` 和影响 capability 的 disconnected 不得默认为 healthy。
- 回滚：若某类状态不应由 Launch Envelope 持有，将其 health requirement 移出本 FR，并在已存在的正式 runtime/readiness 套件中承接。

## 风险 11：恢复动作改变 envelope 输入

- 表现：为了恢复 profile lock、native messaging 或 bootstrap，后续实现切换 provider/profile/host、重写 extension paths、变更 fingerprint seed 或复用旧 artifact。
- 影响：launch admission 与实际启动事实脱节，evidence kernel 无法证明同一 envelope。
- 缓解：恢复结果必须落入 `healthy_after_recovery`、`still_disconnected`、`blocked_after_recovery` 或 `new_envelope_required`；需要改变输入时必须生成新 envelope。
- 回滚：撤销恢复后的 admission 结论，重新生成 envelope 并重新验证。
