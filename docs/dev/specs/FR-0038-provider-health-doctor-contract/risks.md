# FR-0038 risks

## 风险 1：把 doctor contract 误写成 doctor command 实现

- 表现：在 spec 中冻结 CLI syntax、runtime probing procedure、Chrome launch behavior 或 native host 调用流程。
- 影响：提前越界到 downstream implementation，导致 spec review 与 implementation review 混写。
- 缓解：本 FR 只冻结 report shape、check categories 与 fail-closed 消费语义；doctor command 必须由后续事项承接。
- 回滚：移除 CLI/runtime execution 描述，保留 doctor report contract。

## 风险 2：doctor pass 被误用为 runtime ready

- 表现：`provider_doctor_report.outcome.overall_status=pass` 被当成 `runtime_attested`、runtime bootstrap ready 或真实页面闭环成功。
- 影响：绕过 runtime admission 和 live evidence gate，造成 provider selection 误判。
- 缓解：doctor verification level 最高只允许 `doctor_checked`；runtime / live evidence 级事实必须由对应 FR 和后续 gate 持有。
- 回滚：收紧 `doctor_checked != runtime_attested != live_evidence_attested` 的说明与 GWT。

## 风险 3：required health check 漏判

- 表现：provider contract 要求 extension/native/profile/headed mode，但 doctor report 缺失对应检查仍被消费。
- 影响：后续选择无法满足 capability 的 provider，导致执行失败或安全边界漂移。
- 缓解：本 FR 冻结 required check mapping，缺失 required check 必须 fail-closed。
- 回滚：补充 required mapping 和 parser 测试。

## 风险 4：capability-level failure 扩大成 provider-level failure

- 表现：某个 optional capability 失败后，所有 capability 都被阻断。
- 影响：降低 provider 可用性，阻塞 unrelated low-risk consumption。
- 缓解：区分 `capability_blocking` 与 `provider_blocking`；provider-level required check 失败才阻断全 provider。
- 回滚：修正 outcome 聚合规则和 GWT。

## 风险 5：secret 或 profile 敏感信息进入 report / PR

- 表现：Native Messaging manifest secret、profile path 私密片段、token、cookie 或本地敏感配置被写入 report summary、stdout 或 PR body。
- 影响：泄露账号、环境或本机敏感信息。
- 缓解：evidence ref 只允许 locator / redacted ref；`sensitivity=secret` 不得进入公开摘要。
- 回滚：删除敏感原文，替换为 redacted artifact ref，并补脱敏测试。

## 风险 6：Syvert mapping 混入 doctor diagnostics

- 表现：doctor report 字段中出现 Syvert normalized result、business schema、project workflow 或 product state。
- 影响：违反 M1 boundary，污染 WebEnvoy provider/runtime contract。
- 缓解：本 FR 明确 Syvert 是可选消费者；doctor contract 只属于 provider diagnostics shared surface。
- 回滚：删除 Syvert-specific 字段，必要时在 Syvert 或 integration issue 中另行冻结消费层 mapping。

## 风险 7：PR metadata 误判为 local-only

- 表现：本 FR 改 provider health / diagnostics shared contract，却填写 `integration_applicable=no`、`shared_contract_changed=no`、`merge_gate=local_only` 或 `contract_surface=none`。
- 影响：provider/shared-contract gate 无法消费正式契约，formal spec review 阻断。
- 缓解：PR metadata 使用 provider/shared-contract gate，锚定 `#1111`，填写 `contract_surface=diagnostics_observability`；同时保持 `external_dependency=none` 与 `joint_acceptance_needed=no`，避免误引入 Syvert 依赖。
- 回滚：修正 PR body integration fields 与 spec acceptance language，并重新跑 metadata / guardian 检查。

## 风险 8：`Fixes #1127` 被误读为关闭 downstream implementation

- 表现：reviewer 将 formal spec PR 的 `Fixes #1127` 误判为提前关闭 doctor command、provider registry consumption、selection admission 或 runtime health implementation。
- 影响：`#1127` 的 `fr-complete` truth 无法被 spec review 消费，导致错误阻断。
- 缓解：本 suite 显式记录 `#1127` 是 spec-only / contract-freeze FR；`Fixes #1127` 只关闭 Provider Health / Doctor Contract 定义事项，不关闭 `#1124/#1125/#1126/#1128/#1130`。
- 回滚：若 `#1127` issue truth 被调整为实现闭环事项，则将 PR closing 改为 `Refs #1127` 并拆出实现 closeout。
