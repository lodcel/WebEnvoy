# FR-0005 TODO

## 已完成前置

- [x] FR-0005 规约 Draft PR 已创建并合入主干
- [x] spec review 已完成，FR-0005 已进入 Spike 复核阶段
- [x] `contracts/`、`risks.md`、`data-model.md` 已补齐

## 浏览器内复核进度（本轮）

- [x] 把参考实现与仓库内调研收敛为正式 `research.md`
- [x] 在 `research.md` 新增“浏览器内第一手复核证据”层，并与仓库内历史证据分离
- [x] 写入浏览器内前提：Claw profile 隔离 clone + Chrome remote debugging `9222` 手动启动
- [x] 写入 `_webmsxyw` 页面/加载时机分流证据：`/explore`、detail 页可用；`search_result` 某变体与 profile 页早期样本出现过不可用
- [x] 写入 `/explore` 的 Cookie 直接可读证据（`a1/webId/gid/xsecappid`）
- [x] 写入单次搜索交互成功 XHR 样本与观测到的头族
- [x] 写入 detail / profile 页 `__INITIAL_STATE__` 页面级读证据
- [x] 按 `search/detail/user_home` 分开记录：成功证据、失败/候选证据、`required_headers` 已观测与候选
- [x] 写入手动 fetch 失败样本：`500(create invoker failed)`、`300015(Browser environment abnormal)`、`461 + 300011(Account abnormal)`
- [x] 更新错误分类并补充 `browser_env_abnormal`、`account_abnormal`、`gateway_invoker_failed`
- [x] 本地运行并记录 `docs-guard` / `spec-guard`

## 当前阻断与暂停状态

- [x] 触发账号异常（`code=300011`）后已暂停 live XHS 交互，避免继续放大风控
- [x] 明确标记本轮为“部分完成”，非实现就绪
- [x] 2026-04-06 中午已按 WebEnvoy-managed profile 口径复查本地执行现场；当时 `.webenvoy/profiles` 不存在可用于 XHS live 复核的已登录 profile
- [x] 由于 2026-04-06 中午缺少 WebEnvoy-managed XHS 会话，本轮曾按 `No-Go/paused` 收口，不绕过 `#362/#363/#365` 继续 live 扩展
- [x] 2026-04-06 晚间起，不再把作者本机 `.webenvoy/profiles/**` 的恢复状态直接写成正式结论；正式状态只跟随 FR-0005 已收口的 managed-profile 同口径复核结论变化
- [x] 2026-04-10/2026-04-11 已确认此前 `IDENTITY_MANIFEST_MISSING` 属于 worktree/main 路径污染后的中间现场，不再作为最终停点
- [x] 2026-04-11 的 managed-profile official runtime 复核历史事实已在 `research.md` 收口；其中已记录 profile root / identity preflight 不再构成当时的直接阻断
- [x] 仓库内已固化的历史 fresh rerun 样本头 `eca28babebe929821aa20fbb113b2f94d6ce4f49` 已确认：`#445-A` 修复后的 `xhs.search` 不再出现 `executeXhsSearchImpl is not defined`
- [x] 同一轮 fresh rerun 已确认 `xhs_001` 仍满足 managed-profile / official runtime / `real_browser` 启动前提，且 `runtime.start`、`runtime.ping`、internal `runtime.tabs` 均可达
- [x] 仓库内已固化样本中的 `search` 已获得合法 fresh rerun 样本，但只达到 `dry_run` 成功壳；请求 `live_read_high_risk` 时会被 `risk_state=paused` + `ISSUE_ACTION_MATRIX_BLOCKED` 阻断，未形成 API primary success
- [x] FR-0016 新治理口径已收口：repo formal docs 只保留 fixed/historical sample 与稳定 closeout bar，不再在仓库 formal 记录中承接 moving latest-head gate truth；2026-04-11 固定样本头的历史 formal 结论继续保持 `No-Go/paused`
- [x] 2026-04-11 固定样本头的 formal FR 文档收口已完成；当时正式功能停点为：`search/detail/user_home` 仍缺 `route_role=primary + path_kind=api + evidence_status=success + reproduced_multi_round`，其中 `search` 还需补齐 required headers 最小必要集矩阵；该历史停点已被 2026-05-16 的 `#445` closeout 结论取代
- [x] 2026-05-16 已消费 PR `#682` 合入后的 closeout 事实：PR `#682` 已 `MERGED`，head `31b0d7875095f51cbce7fe9c62d7ba39c794c055`，merge commit `545cb0a193dbbb74a42c12ad8f820b3fce886d9b`
- [x] 2026-05-16 已确认 issue `#445` managed-profile live closeout 完成：`run_id=issue445-pr-head-31b0d78-20260516T0735Z`，official profile `xhs_001`，`cwd=/Users/mc/dev/WebEnvoy`，official profile root `/Users/mc/dev/WebEnvoy/.webenvoy/profiles/xhs_001`
- [x] 2026-05-16 已确认 `search/detail/user_home` 均达到 `route_role=primary + path_kind=api + evidence_status=success + reproduced_multi_round`，对应路由为 `POST /api/sns/web/v1/search/notes`、`POST /api/sns/web/v1/feed`、`GET /api/sns/web/v1/user_posted`
- [x] 2026-05-16 已将上述三条 closeout success 回写到 `research.md` 的结构化 endpoint catalog / required request context 条目：`search-closeout-20260516`、`detail-closeout-20260516`、`user-home-closeout-20260516`
- [x] 2026-05-16 已确认 closeout evaluator `PASS`：`latest_head_matches=true`、`run_matches=true`、`artifact_matches=true`、`accepted_round_count=2`、`unique_artifact_count=2`
- [x] 2026-05-16 已确认 closeout gate/audit 字段：`request_admission_result.admission_decision=allowed`、`runtime_target_match=true`、`grant_match=true`、`anonymous_isolation_ok=true`、`execution_audit.request_admission_decision=allowed`、`execution_audit.risk_signals=["NO_ADDITIONAL_RISK_SIGNALS"]`；`execution_audit` 属于顶层 gate/audit payload，不属于 `observability`
- [x] 2026-05-16 已确认 #445 closeout 所需请求上下文矩阵按 browser-owned passive API capture 口径收口；本结论不等同于后续手工 header reconstruction 或字段生命周期细化已完成
- [x] 2026-05-16 已确认 `runtime.stop` 成功，post-stop official profile processes / exact main Chrome count 为 `0`，controlled merge 前 guardian `APPROVE` 且 GitHub checks green
- [x] 2026-05-16 已记录 PR `#683` 早前 docs-only head `6d474a455e9b84970ef0674f20939f7aff278b78` 的 fresh rerun 例外事实：`search/detail/runtime.xhs_capture_user_home_context` 成功，但最终 `xhs.user_home` closeout 被 `EXECUTION_MODE_GATE_BLOCKED` / `TARGET_URL_CONTEXT_MISMATCH` 阻断，不构成新的成功 gate evidence，也不表示当前 PR head 的新成功 gate
- [x] 2026-05-16 已明确 PR `#683` 只作为 `Refs #445` 的 FR-0005 docs/TODO closeout 回写 PR，不使用 `Fixes #445` 承载自动关闭；`#445` 的关闭依据继续来自已合入的 PR `#682` 与其成功 live evidence

## #185 阻断点吸收（本次规约修订）

- [x] 在 `spec.md` 明确 Spike 输出允许 `API primary + page-state fallback` 作为侦察证据并存
- [x] 在 `spec.md` / `plan.md` 明确 fallback 证据不等于实现准入，不得直接放行实现
- [x] 在 `spec.md` / `plan.md` 冻结 page-state fallback 最小内容（路径模板与方法、关键 URL 参数、最小状态探针、成功/失败信号）
- [x] 在 `spec.md` / `plan.md` 明确 page-state fallback 不得扩张为实现承诺（稳定选择器、完整字段覆盖、默认路由）
- [x] 全部新增口径对齐 `research.md` 现有证据，不引入仓库外不可复核引用

## 待继续的浏览器内复核

- [x] 用户主页聚合端点是否存在稳定的作品列表 API（`GET /api/sns/web/v1/user_posted` 已在 #445 closeout 中作为 `user_home primary api` 路由 `PASS`）
- [ ] `a1 / webId / gid` 的精确生命周期
- [ ] `x-s-common` 的稳定性是 `session_scoped` 还是 `page_refresh_scoped`
- [ ] `window._webmsxyw` 的页面/版本分流条件与降级策略
- [x] 为 `search/detail/user_home` 各端点补齐 #445 closeout 所需请求上下文矩阵（以 `real_browser` passive API capture 的 browser-owned request context 为准；不把手工 header reconstruction 或字段生命周期升级为 `admission_ready`）
- [ ] 未登录 / 会话过期 / 风控拦截在 WebEnvoy 诊断壳中的最终映射

## 后续衔接

- [x] 2026-04-06 中午已形成本轮 Go/No-Go 历史结论：`No-Go/paused`
- [x] 上述 `No-Go/paused` 继续保留为带日期的历史 closeout；该历史停点已被 2026-05-16 的 `#445` closeout 结论取代
- [x] 2026-04-10 晚间已按最新 managed-profile / official runtime 现场重做 Go/No-Go 判定，结论继续维持 `No-Go/paused`
- [x] 2026-04-11 已在 main 目录完成恢复后再复核，并把 “worktree 路径污染不是最终结论” 写回正式记录
- [x] 2026-04-11 已在 latest head 重新确认：此前的 XHS read bundle 阻断已被 `#445-A` 解除，但 FR-0005 的正式停点尚未解除
- [x] 2026-04-16 已形成一轮 dated blocker refresh 样本；该样本不在 formal FR docs 内被表述成 current-head / latest-head gate evidence
- [x] 上述 blocker refresh 不改写 FR-0005 formal closeout bar；正式解除停点仍以 `primary + api + success + reproduced_multi_round` 与 required headers 最小必要集矩阵收口为准
- [x] 2026-05-16 已完成 #445 closeout 复核并更新正式状态：历史 `No-Go/paused` 章节保留为 dated fact，当前 #445 managed-profile live closeout 已完成
- [x] 在具备合法 approval / gate 前提后，已重新执行 `search` 的 managed-profile `real_browser` live primary API 复核；本次以 browser-owned request context 的 passive API capture 收口，不把手工 required headers reconstruction 全量升级为 admission-ready
- [x] 按 `FR-0025` 已冻结的 current command surface，已完成 `detail/user_home` 在 repo 内可复核的 managed-profile official-runtime replay closeout；`runtime.tabs` 等 internal bridge diagnostics 仍不构成替代
- [x] 已判定 `search/detail/user_home` 达到 `route_role=primary + path_kind=api + evidence_status=success + reproduced_multi_round`
- [x] 已将 PR `#683` docs-only rerun 的 `xhs.user_home` gate 阻断记录为失败事实；该失败不回写为 success gate，不改变 PR `#682` 的 closeout 结论
- [ ] 若后续 L3 实现 FR 需要脱离 browser-owned passive capture 构造请求，再单独补齐手工 header reconstruction、字段生命周期与签名分流策略
- [ ] 完成浏览器内复核后，再决定是否进入后续实现 FR
- [ ] 若存在 fallback-only 场景：先补 API primary 成功证据，或提交“实现范围修订”并通过独立 spec review
- [ ] 创建“小红书 L3 读适配实现 FR”并引用 FR-0005 已复核结论
- [ ] 为端点构造、签名调用、响应解析建立 TDD 测试矩阵
- [ ] 把强依赖字段写入适配规则并补回归验证
- [ ] 将失败场景（会话过期、风控拦截、空结果）纳入实现验收
