# FR-0032 Data Model

FR-0032 首批规约不要求立即新增 SQLite schema，但必须先冻结可持久化、可回放、可审计的数据实体。后续实现可以将这些实体映射到 SQLite、artifact JSON 或 evaluator 输出；字段语义不得退化为 issue 自由文本。

## live_write_attempt

表示一次受控 live write 尝试的根记录。

字段：

- `live_write_attempt_id`: 唯一尝试 ID。
- `canonical_issue_ref`: 固定关联 `#835`。
- `implementation_issue_ref`: 例如 `#845`、`#846` 或 `#847`。
- `latest_head_sha`: 当前尝试使用的 latest head。
- `run_id`: 当前 live write run id。
- `profile_ref`: canonical profile reference。
- `target_domain`: 固定 `creator.xiaohongshu.com`。
- `target_page`: 固定 `creator_publish_tab`。
- `target_tab_id`: 当前 managed creator target tab。
- `execution_surface`: 固定 `real_browser`。
- `requested_execution_mode`: 固定 `live_write`。
- `probe_bundle_ref`: 固定 `probe-bundle/xhs-creator-live-write-admission-v1`。
- `entry_gate_state`: `pending | go | no_go | stale`。
- `attempt_state`: `initialized | upload_started | uploaded | submitted | published | cleanup_started | closed | stopped | failed`。
- `publish_visibility_scope`: `private_or_self_visible | limited_test_visibility | public_visible | unknown`。
- `cleanup_policy_ref`: cleanup policy reference。
- `created_at` / `updated_at` / `closed_at`。

约束：

- `entry_gate_state=go` 之前不得进入 upload。
- `publish_visibility_scope=unknown` 不得进入 planned live publish。
- `attempt_state=published` 必须有 `publish_result_identity`。
- `attempt_state=closed` 必须有 `cleanup_result`，或有 stop signal 解释为什么无法 cleanup。

生命周期：

`initialized -> upload_started -> uploaded -> submitted -> published -> cleanup_started -> closed`

任一步可转入 `stopped` 或 `failed`，但转入后不得继续后续写动作；如需重试，必须创建新的 `live_write_attempt` 并引用前次 stop signal。

## upload_artifact_identity

表示被上传或尝试上传的媒体/内容 artifact。

字段：

- `upload_artifact_id`: 唯一 artifact ID。
- `live_write_attempt_id`: 父 attempt。
- `source_media_ref`: 可审计媒体引用。
- `source_media_digest`: 媒体摘要。
- `source_media_kind`: `image | video | mixed`。
- `platform_staging_ref`: 平台暂存引用，若可见。
- `page_preview_locator`: editor 中预览定位。
- `accepted_by_platform`: boolean。
- `visible_in_editor`: boolean。
- `upload_started_at` / `upload_completed_at`。
- `failure_code`: `null | upload_platform_rejected | upload_timeout | upload_identity_missing | blocked_by_risk`。

约束：

- `accepted_by_platform=true` 与 `visible_in_editor=true` 才能作为 upload success。
- 该实体不得泄漏不必要的敏感本地路径；本地路径只能通过受控 ref 或 digest 证明。
- 该实体不能单独证明 FR-0032 success。

## publish_result_identity

表示发布完成后可定位的结果身份。

字段：

- `publish_result_id`: 唯一 result identity ID。
- `live_write_attempt_id`: 父 attempt。
- `upload_artifact_id`: 源 artifact。
- `submit_action_ref`: 提交动作引用。
- `result_kind`: `note_id | published_url | creator_result_page | platform_publish_record`。
- `note_id`: 平台 note id，若存在。
- `published_url`: 已发布 URL，若存在。
- `creator_result_url`: 创作者后台结果页 URL，若存在。
- `platform_record_ref`: 平台发布记录引用，若存在。
- `publish_visibility_scope`: 发布可见性。
- `success_signal_source`: `platform_response | creator_result_page | current_page_state | followup_page_verification`。
- `success_signal_locator`: 成功信号定位。
- `verification_state`: `verified | identity_missing | ambiguous | blocked`。
- `captured_at`。

约束：

- `verification_state=verified` 必须至少有 `note_id`、`published_url`、`creator_result_url`、`platform_record_ref` 之一。
- 通用 toast 没有 result identity 时必须是 `identity_missing`。
- `publish_visibility_scope=unknown` 不得作为成功 closeout。

## cleanup_result

表示 cleanup / rollback 的执行结果。

字段：

- `cleanup_result_id`: 唯一 cleanup ID。
- `live_write_attempt_id`: 父 attempt。
- `publish_result_id`: 可为空，表示 upload/submit 阶段 cleanup。
- `cleanup_policy_ref`: cleanup policy reference。
- `cleanup_action`: `delete_published_result | hide_published_result | remove_draft | abandon_unpublished_upload | no_safe_cleanup_action`。
- `cleanup_outcome`: `deleted | hidden | draft_removed | rollback_not_supported | cleanup_blocked | cleanup_failed | not_needed`。
- `proof_locator`: cleanup 证明定位。
- `platform_message`: 平台消息。
- `attempted_at` / `completed_at`。
- `residual_record_id`: cleanup 失败或不可支持时的残留记录。

约束：

- 发布成功后必须记录 cleanup_result。
- `rollback_not_supported`、`cleanup_blocked`、`cleanup_failed` 且可能有外部可见残留时，必须创建 `residual_record`。
- cleanup 失败不得隐藏在 success summary 中。

## risk_signal

表示 live write 过程中观察到的风险信号。

字段：

- `risk_signal_id`: 唯一 signal ID。
- `live_write_attempt_id`: 父 attempt。
- `source`: `runtime.status | runtime.audit | page_observation | upload | submit | publish | cleanup`。
- `kind`: `account_safety | captcha_required | login_required | security_redirect | browser_env_abnormal | rate_limit | content_policy | upload_failure | submit_failure | publish_identity_missing | cleanup_failure`。
- `severity`: `info | warning | blocking`。
- `details_ref`: 证据引用。
- `detected_at`。

约束：

- `severity=blocking` 必须创建或引用 `live_write_stop_signal`。
- 风险信号必须绑定当前 attempt / run / profile / tab。
- 账号安全、验证码、安全重定向、浏览器环境异常必须 hard stop 后续写动作。

## residual_record

表示无法清理、无法回滚或身份不完整时的残留记录。

字段：

- `residual_record_id`: 唯一 residual ID。
- `live_write_attempt_id`: 父 attempt。
- `publish_result_id`: 可为空。
- `visibility_scope`: `private_or_self_visible | limited_test_visibility | public_visible | unknown`。
- `external_visibility_may_remain`: boolean。
- `residual_locator`: 残留定位，若可见。
- `reason`: `cleanup_failed | cleanup_blocked | rollback_not_supported | unsafe_to_cleanup | identity_missing_after_publish`。
- `required_followup`: 必需人工或后续处理。
- `recorded_at`。

约束：

- 任一外部可见内容无法被确认清理时，必须记录。
- `external_visibility_may_remain=true` 时，#835 不得声称无残留。
- residual_record 不阻止记录“publish 曾成功”，但会阻止“无风险完全收口”的表述。

## Derived Closeout View

后续 evaluator 可以从上述实体派生：

- `full_live_write_success_candidate`: upload / submit / publish identity / cleanup evidence 均存在。
- `success_with_residual`: publish identity 存在，但 cleanup 失败或不可支持，且 residual record 已记录。
- `non_success_upload_only`: upload 成功但 submit/publish 未完成。
- `non_success_publish_identity_missing`: publish 信号存在但 result identity 缺失。
- `stopped_by_risk`: blocking risk signal 触发 stop signal。

这些派生状态不得替代底层实体。
