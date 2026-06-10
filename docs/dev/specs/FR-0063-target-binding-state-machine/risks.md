# FR-0063 Risks

## 风险 1：`bound` 被误报为 page/runtime ready

- 影响：read implementation、closeout 或 PR metadata 可能跳过 #1162，提前声明页面或 runtime 成功。
- 缓解：spec 和 contract 明确 `bound` 只表示 target binding pass input；page/runtime ready 由 #1162 或 runtime owner 判定。
- 回滚：撤回错误 ready claim 或 PR metadata，重新收集/消费 #1162 evidence。

## 风险 2：`bound` 被误报为 signed continuity

- 影响：下游可能跳过 #1171 的 transition chain、signature、key ownership 或 continuity verification。
- 缓解：snapshot 与 transition evidence 只作为 unsigned input；#1171 owns signed continuity。
- 回滚：移除错误 continuity claim，按 #1171 contract 重建 continuity evidence。

## 风险 3：stale / lost evidence 被复用

- 影响：旧 tab、旧 run、旧 bridge ack、旧 DOM observation 或 same-head historical artifact 可能被当作 current binding。
- 缓解：`stale` 与 `lost` 是显式状态；进入 `bound` 必须 current-run evidence converged。
- 回滚：清理错误 artifact 引用，重新执行正式 owner 授权的 fresh collection。

## 风险 4：formal spec PR 混入 resolver / read implementation

- 影响：spec review 与 implementation review 混杂，可能绕过 runtime/browser/account/live 门禁。
- 缓解：本 PR 只允许写 `FR-0063` suite 与单条 sync-map；不触碰 runtime/source/tests/fixtures/scripts/workflows。
- 回滚：拆分超范围改动到独立 implementation issue / PR。

## 风险 5：live-write 或 #835 scope creep

- 影响：`bound` 可能被误用为 publish/upload/submit/default commit unlock 或 #835 recovery evidence。
- 缓解：spec 消费 `FR-0062`，明确 live-write capability 默认 locked；forbidden fields 包含 `live_write_commit`、`publish_result`。
- 回滚：移除超范围字段，按对应 live-write 或 #835 owner 重新走 formal spec review。

## 风险 6：Syvert boundary 被污染

- 影响：WebEnvoy target binding 可能被误写成 Syvert normalized result、resource taxonomy 或 error taxonomy。
- 缓解：contract forbidden fields 包含 `normalized`、`syvert_resource_type`、`syvert_error_code`；出现即阻断。
- 回滚：移除 Syvert-owned语义，必要时在 Syvert-owned contract 中另行定义。

## 风险 7：evidence / locator 泄露账号或私有数据

- 影响：PR body、artifact、snapshot 或 transition evidence 可能泄露 Cookie、token、account identifier、profile path、private path、private URL 或 full page content。
- 缓解：snapshot 与 transition evidence refs 只能使用 redacted locator、artifact ref、checksum 或 opaque handle；redaction invalid 必须 fail closed。
- 回滚：删除/替换泄露 artifact，必要时执行 secret rotation；后续实现必须补 redaction guard。

## 回滚方式

如本 FR 需要撤回，使用 revert PR 删除 `docs/dev/specs/FR-0063-target-binding-state-machine/**`，并移除 `.github/spec-issue-sync-map.yml` 中 #1161 的映射。由于本 PR 不实现 runtime 行为，不需要 profile cleanup、browser cleanup、secret rotation、database migration、artifact cleanup、live cleanup 或 external rollback。
