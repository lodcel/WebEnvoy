# FR-0032 Risks

## 1. Spec draft 被误当成 live write success

- 风险：#842/#843 完成后，外部状态把 “FR-0032 suite 已落库” 误写成 #835 live write success。
- 影响：绕过 #844 spec review、#845/#846 实现和 #847 latest-main controlled live closeout。
- 缓解：spec / plan / TODO 均明确 suite 只是 review 输入；#835 仍需 upload -> submit -> publish -> cleanup evidence。
- 回滚：更正 issue comment / Project 状态，恢复 #835 open，阻断 #845/#846/#847 之外的 live write 入口。

## 2. #779 GO 过期仍被复用

- 风险：#779 latest-main GO snapshot 在后续实现前过期，但 #847 直接复用旧 run。
- 影响：runtime、profile、target、account safety 或 validation rows 可能已漂移。
- 缓解：进入 live write 前必须重跑 `runtime.status`、`runtime.audit`、`runtime.closeout_gate`、`xhs.creator_publish.admit` dry-run 和 validation row query。
- 回滚：标记 entry gate stale，停止 upload，重新执行 readmission rerun。

## 3. 真正写入动作在 spec review 前发生

- 风险：为验证 spec 或 closeout 提前触发 upload、submit、publish、file picker、DataTransfer、editor text write。
- 影响：账号安全、公开内容、平台状态被不可逆改变。
- 缓解：#842/#843/#844 阶段严禁 runtime 实现和 live write；后续写动作只允许 #847 在实现与 gate 完成后执行。
- 回滚：立即停止，记录 stop signal、cleanup/rollback proof 与 residual record。

## 4. Upload-only 被误报为完整成功

- 风险：媒体成功出现在 editor 或平台暂存后，被当成 full live write success。
- 影响：submit/publish/result identity/cleanup 缺失，#835 关闭语义失真。
- 缓解：success predicate 必须同时要求 upload artifact、submit evidence、publish result identity、cleanup/rollback proof。
- 回滚：重分类为 `non_success_upload_only`，继续 #846/#847 或拆 blocker。

## 5. Publish result identity 缺失

- 风险：平台 toast 或页面短暂提示显示成功，但没有 note id、published URL、creator result URL 或 platform record。
- 影响：无法证明外部结果、无法 cleanup、无法审计残留。
- 缓解：`publish_result_identity` contract 要求稳定身份；缺失时结果为 `published_identity_missing`。
- 回滚：停止 success closeout，记录 stop signal 和必要 residual record。

## 6. 公开可见范围未冻结

- 风险：未选择 publish visibility scope 就进入 publish，导致内容公开范围超出预期。
- 影响：隐私、品牌、账号安全和外部可见副作用。
- 缓解：entry gate 必须记录 `publish_visibility_scope`；`unknown` 不得进入 planned live publish。
- 回滚：若已发布，执行 cleanup/rollback；无法清理则记录 residual record。

## 7. Cleanup / rollback 失败

- 风险：发布成功后删除、隐藏、撤回或移除草稿失败。
- 影响：外部可见内容残留，#835 不能声称无残留。
- 缓解：cleanup contract 要求 outcome、proof_locator、residual_record；cleanup failure 不得隐藏。
- 回滚：记录 `residual_record`，将 closeout 表述为 success with residual 或 failed cleanup。

## 8. 账号安全信号被弱化

- 风险：验证码、登录墙、账号异常、安全重定向、浏览器环境异常被归类为普通失败继续执行。
- 影响：账号风险升级或不可控写入。
- 缓解：risk_signal severity=blocking 时必须 hard stop，且 later write actions blocked。
- 回滚：停止 runtime，保留 stop signal 与 account safety evidence。

## 9. Evidence 退化为自由文本

- 风险：closeout 只在 issue comment 中描述成功，不产生结构化 evidence。
- 影响：后续 evaluator、reviewer、adapter-consumable flow 无法复核。
- 缓解：四个 contracts 与 data model 是必需项；issue comment 只能汇总，不能替代证据对象。
- 回滚：阻断 #844/#847 closeout，补齐结构化 evidence。

## 10. Adapter / provider scope creep

- 风险：FR-0032 顺手抽取 Syvert adapter、CloakBrowser provider 或共享 provider contract。
- 影响：PR scope 混合，integration gate 与实现边界漂移。
- 缓解：FR-0032 只保持 evidence shape later adapter-consumable，不做 adapter extraction。
- 回滚：拆分 provider / integration work 到独立 issue/FR。

## 11. 不可逆动作缺少 stop policy

- 风险：进入 submit/publish 后没有明确中止、清理、残留记录策略。
- 影响：失败后无法判断是否继续、清理或人工介入。
- 缓解：live-write-stop-signal contract 定义 stopped_step、blocker_layer、cleanup_required、residual_record_id。
- 回滚：将尝试标记 stopped，禁止后续写动作，补 stop signal。

## 12. 本地 profile / target 漂移

- 风险：#779 GO 使用的 profile/tab 与 #847 live closeout 时的 target 不一致。
- 影响：在错误账号、错误页面或 stale tab 上写入。
- 缓解：entry gate 必须重新验证 profile_ref、target_tab_id、target_binding_state 和 runtime trust state。
- 回滚：停止 upload，恢复或重新绑定 managed creator target tab。
