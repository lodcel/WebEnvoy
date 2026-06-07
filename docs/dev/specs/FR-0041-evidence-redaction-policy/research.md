# FR-0041 research

## 输入证据

- #1129 issue body：要求定义 fingerprint seed、proxy credential、Cookie、storage、auth header、account identifier、private absolute path、token、API key、binary/profile locator 与 provider evidence fields 的默认 redaction。
- #1128 / FR-0040：已冻结 `provider_evidence_record` shape，并声明完整 redaction policy 由 #1129 承接。
- #1143 issue relation：official Chrome launch evidence 可消费本 policy，但不得定义 redaction semantics。
- `docs/dev/AGENTS.md`：正式 FR 套件需补齐 GWT、异常/边界、plan 七节与 spec map。
- `vision.md`：WebEnvoy 需要保护账号安全、profile/session 与执行痕迹，不把上层 agent 或外部爬虫作为核心运行时。

## FR-0040 边界核对

FR-0040 已冻结以下相关 hook：

- `sensitivity` enum：`public|internal|sensitive|secret`。
- `redaction_state` enum：`redacted|redaction_required|not_required|policy_missing|invalid`。
- required evidence 遇到 `redaction_required|policy_missing|invalid` 时必须阻断。
- `sensitivity=secret` 不得进入 PR body、stdout summary、unredacted artifact 或 spec sample。

本 FR 的处理：

- 只定义上述 enum 的 policy 语义、locator 规则和 disclosure boundary。
- 不新增、删除或重命名 FR-0040 字段。
- 不修改 FR-0040 suite。

## Integration 判断

#1129 issue labels 包含 `integration:local-only`，且 scope 是 WebEnvoy-local evidence redaction policy。

本 PR 不改变：

- Syvert normalized result。
- shared provider adapter payload。
- raw / normalized / diagnostics / observability 输出 shape。
- task_id / request_id / run_id 语义。
- cross-repo merge gate。

因此 PR metadata 应申报：

- `integration_applicable=no`
- `integration_ref=none`
- `external_dependency=none`
- `merge_gate=local_only`
- `contract_surface=none`
- `joint_acceptance_needed=no`

## Live evidence 判断

本 PR 不声称：

- official runtime 闭环完成。
- 真实页面交互完成。
- 真实 live read/write 完成。
- latest-head live evidence 已采集。

因此：

- 不需要 fresh live evidence。
- `live_evidence_record` 使用 `N/A`。
- 验证只运行 docs/spec/map/purity/diff checks 与 hosted checks。

## #1143 consumption 判断

#1143 official Chrome launch evidence 后续需要表达 browser binary locator、profile locator、extension/native messaging locator、launch config snapshot 与 artifact identity。该 issue 可以引用本 policy 来决定：

- 哪些 locator 可公开。
- 哪些 locator 只能作为 private/redacted locator。
- 哪些 secret 只能作为 secret handle。
- 哪些 redaction state 会导致 required evidence fail-closed。

但 #1143 不应重新定义：

- sensitivity levels。
- redaction state semantics。
- secret handling。
- private path / profile / binary locator public disclosure。
- fixture sample redaction。

## 结论

建立 `FR-0041-evidence-redaction-policy` formal suite 是 #1129 的正确落点。该 suite 应使用 `Fixes #1129`，前提是 PR 只冻结 policy contract、更新 spec map，并通过本地 docs/spec/map/purity 验证和 hosted checks；guardian/formal review/controlled merge 由 scheduler gate_owner 统一调度。
