# FR-0031 风险

## 1. read baseline 被误用为 creator write baseline

- 风险：`FR-0029` 的 `live_read_high_risk` read baseline 被拿来放行 creator upload `live_write`。
- 影响：#779 / #756 可能在未验证 creator write scope 的情况下进入高风险 live action。
- 缓解：creator write scope 使用独立 `effective_execution_mode=live_write` 与 `probe_bundle_ref=probe-bundle/xhs-creator-live-write-admission-v1`。
- 回滚：恢复为 `NO_GO`，并要求 #819 spec review 重新冻结 scope。

## 2. Service Worker freshness stale 被忽略

- 风险：managed profile 的 persistent extension Service Worker 缓存早于 extension build，但 runtime 仍继续进入 admission。
- 影响：extension / native host 行为与当前代码不一致，fresh evidence 失效。
- 缓解：`EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED` 是 hard blocker。
- 回滚：停止 runtime，刷新 managed profile Service Worker cache 后重新执行 `runtime.status`。

## 3. target continuity 被错误恢复

- 风险：错误 tab、旧 tab、跨 profile tab 被当成 creator publish target。
- 影响：后续 live evidence 可能触碰错误页面或账号状态。
- 缓解：target binding 必须包含 requested / managed target 一致性与 runtime trust state。
- 回滚：清除 target binding，重新执行 non-write target readiness。

## 4. non-write readiness 误触发 live write

- 风险：readiness probe 过程中触发文件选择、上传、提交或发布。
- 影响：账号安全、数据写入和外部可见状态受影响。
- 缓解：FR-0031 ladder 明确禁止上传、提交、发布、文件选择器和 DataTransfer 注入。
- 回滚：立即停止 closeout，记录 account safety / cleanup evidence，并拆新 blocker。

## 5. validation object family 分叉

- 风险：为 creator write 单独发明第二套 validation truth source。
- 影响：`FR-0020` validation baseline 失去唯一性，runtime.audit 与 closeout_gate 读模型漂移。
- 缓解：FR-0031 只冻结 scope key 与派生读模型，底层仍使用 `FR-0020` 对象。
- 回滚：删除新增 object family，回到 `anti_detection_validation_view`。

## 6. profile/root 漂移

- 风险：正式 issue worktree 与仓库根目录使用不同 `.webenvoy/profiles`，导致 fresh evidence 无法复核。
- 影响：#779 可能用错误 profile root 证明 readiness。
- 缓解：#820 必须给出 profile/root 归属说明，FR-0031 admission 必须消费 canonical profile_ref。
- 回滚：停止 #779 closeout，统一 profile root 后重新 rerun。
