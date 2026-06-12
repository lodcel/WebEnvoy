# FR-0071 Research Notes

## 研究问题

1. #1199 的实际交付边界是什么？
2. WebEnvoy-owned mapping hint manifest 如何帮助 Syvert consumer，同时不冻结 Syvert normalized result？
3. #1199 是否需要 active integration gate？

## 输入事实

### Issue facts

- #1199 `Syvert Mapping Hint Manifest` 当前 OPEN。
- Labels 包含 `roadmap:item`、`kind:fr`、`area:syvert-integration`、`risk:high`、`integration:local-only`。
- Issue body scope 是 “Define WebEnvoy-owned mapping hint manifest for Syvert consumers without importing Syvert.”
- Issue boundary 明确不得扩展到 Syvert normalized result、CloakBrowser-as-core、browser patching、default live_write commit 或 unrelated #835 recovery。
- Parent 为 #1120 Optional Syvert Integration。
- Downstream blockers 包括 #1200/#1201/#1203/#1204/#1205。

### Repo formal inputs

- `docs/dev/architecture/system-design/boundary.md` 已冻结：
  - WebEnvoy core 不承担 Syvert normalized result。
  - Syvert 是 optional consuming layer。
  - 仅“未来 Syvert 可能消费”不得触发 integration gate。
  - 改 shared input/output、错误语义、raw/normalized/diagnostics/observability、ids、跨仓执行模式或联合验收时才升级 integration gate。
- `FR-0061 XHS Driver Contract` 已冻结 `raw` / `operational` / `evidence` 三分法，并明确 raw 不是 Syvert normalized result。
- `FR-0063 Target Binding State Machine` 已冻结 target binding non-proof boundary，并排除 Syvert normalized result。
- `FR-0069 Provider-Owned Stealth Boundary` 和 `FR-0070 WebEnvoy-Owned Risk Evidence Boundary` 已冻结 provider / risk evidence 的 owner 和 non-proof 语义。
- `.github/PULL_REQUEST_TEMPLATE.md` 和 `docs/dev/AGENTS.md` 要求 local-only PR 不因未来 Syvert 消费而绑定 integration_ref。

## 结论 1：#1199 owns hints, not Syvert mapping

#1199 的最小正式落点应是 manifest language：WebEnvoy 可以告诉下游哪些 refs、route、raw payload、operational state、evidence refs 或 blockers 可能帮助 mapping。但 normalized result、resource taxonomy、error taxonomy 和 product workflow 必须由 Syvert-owned or downstream-owned contract 定义。

Design consequence:

- Manifest 包含 `mapping_gaps` 和 `consumer_actions`，但不包含 `normalized`。
- Gap 的 `webenvoy_default_allowed=false`。
- Forbidden fields 直接覆盖 Syvert-owned normalized/taxonomy/workflow 字段。

## 结论 2：local-only 仍然成立

当前 FR 不改变 WebEnvoy runtime output、shared cross-repo input/output、error semantics、ids、diagnostics/observability、provider adapter 或 joint acceptance。它只冻结本仓库 formal docs / contract language，且 issue 已标记 `integration:local-only`。

Design consequence:

- PR `integration_check` 使用 `integration_applicable=no`、`integration_ref=none`、`merge_gate=local_only`。
- 只有后续 PR 开始冻结 Syvert-owned schema、wrapper、shared output 或 joint acceptance 时，才需要 integration decision。

## 结论 3：hint source must stay bound and redacted

如果 hint 没有 source binding、freshness、scope 或 redaction state，downstream consumer 可能把历史 artifact 或敏感 raw payload 当成 current mapping input。

Design consequence:

- 每个 hint item 都带 `source_binding`。
- stale、scope mismatch、redaction invalid 和 missing source ref 均是 fail-closed blocker。
- Contract examples 使用 synthetic refs。

## Future extension triggers

Open a new formal spec or scheduler decision if future work needs to:

- Add CLI stdout / JSON-RPC output fields for this manifest.
- Persist manifest to SQLite or evidence artifacts.
- Define Syvert normalized result、resource taxonomy、error taxonomy or workflow.
- Add provider adapter or runtime output implementation.
- Declare active integration_ref、joint acceptance or shared cross-repo contract.
- Use browser/account/live evidence as #1199 completion proof.
