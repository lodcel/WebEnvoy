# FR-0031 冻结 XHS Creator Live Write Admission

Canonical Issue: #819

## 背景

#779 恢复 #756 受控上传 live evidence 时发现一个正式缺口：当前 `FR-0029` 只拥有 `#445` read closeout recovery admission，scope 固定为 `www.xiaohongshu.com` + `live_read_high_risk` + `probe-bundle/xhs-closeout-min-v1`。它明确不覆盖 `creator.xiaohongshu.com`。

#756 需要的是 creator upload 的重新准入判断：`creator.xiaohongshu.com`、`creator_publish_tab`、`requested_execution_mode=live_write`。当前 runtime 在该 scope 下查询 `FR-0012/0013/0014` validation view 会返回缺失，因此 #779 不能把 read closeout baseline 冒充为 creator write baseline。

本 FR 的职责是冻结 XHS creator live write admission 的唯一正式 owner、scope、validation binding、target binding 与最小 non-write readiness 验证路径。它不执行真实上传，不证明 #756 已完成，只定义何时允许 #756 或后续 live closeout 入口重新进入受控上传验证准备。

## 目标

1. 冻结 `#819 / FR-0031` 是 XHS creator live write admission 的 formal owner。
2. 冻结 creator write scope 与 `FR-0029` read closeout scope 的隔离边界。
3. 冻结 creator write admission 进入 `live_write` 前必须满足的 profile/runtime/target/validation 条件。
4. 冻结 `FR-0012/0013/0014/0020` 在 creator write admission 下的最小 binding。
5. 冻结不执行真实上传、提交、发布的 readiness ladder。

## 非目标

- 不执行真实上传、文件选择器、DataTransfer 注入、提交、发布或不可逆写入。
- 不把 `FR-0029` 的 read closeout baseline 复用成 creator write baseline。
- 不改变 `#445` close condition。
- 不恢复 Syvert integration 默认门禁。
- 不把具体 profile 名，例如 `xhs_001`，写成 formal contract 常量。

## 功能需求

### 1. formal owner

系统必须冻结：`#819 / FR-0031` 是 current repo 中唯一负责定义 XHS creator upload live write 重新准入聚合语义的 formal owner。

约束：

- `#756` 继续承接受控上传 live evidence，不拥有 admission predicate 本身。
- `#779` 只承接恢复收口，不发明 creator write admission contract。
- `FR-0029` 继续只拥有 read closeout recovery admission，不得被扩写为 creator write owner。
- `FR-0012/0013/0014/0020` 继续拥有底层 layer / validation object，不直接拥有 creator write admission 聚合语义。

### 2. creator write scope

系统必须冻结 XHS creator write admission scope：

- `platform = xhs`
- `target_domain = creator.xiaohongshu.com`
- `target_page = creator_publish_tab`
- `browser_channel = Google Chrome stable`
- `execution_surface = real_browser`
- `requested_execution_mode = live_write`
- `profile_ref` 复用 `FR-0003 / FR-0020` canonical namespace

约束：

- `www.xiaohongshu.com` read closeout scope 不得替代 creator write scope。
- `live_read_high_risk` validation view 不得替代 `live_write` validation view。
- stub、fake host、low-risk site、BCU evidence、旧 head、旧 artifact 不得充当 creator write admission evidence。

### 3. profile/runtime prerequisites

系统必须在 creator write admission 前证明：

- managed profile 可识别，且 profile/root 归属可复核。
- official Chrome persistent extension identity binding 已通过。
- Service Worker freshness 不再阻断 identity preflight。
- runtime surface 为 `real_browser`，且 `headless=false`。
- account safety 为 `clear`。

约束：

- 正式 worktree 与 profile root 漂移时必须 fail closed。
- `IDENTITY_BINDING_MISSING`、`identity_mismatch`、`EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED` 均不得进入 creator write admission。
- 若恢复 identity 需要用户确认登录/浏览器状态，必须停在 blocker，不得把 live action 当探针。

### 4. creator target binding

系统必须在 creator write admission 前证明 managed creator publish target 可恢复或重新绑定：

- `target_domain=creator.xiaohongshu.com`
- `target_page=creator_publish_tab`
- `target_tab_id` 与当前 managed runtime continuity 一致
- target continuity 来源可回链到 `runtime.status` 或等价 runtime trust state

约束：

- target missing、target mismatch、cross-tab、cross-profile、stale target 均不得进入 creator write admission。
- target binding 证明不得通过点击上传、选择文件、注入文件或提交表单获得。
- 如需打开或聚焦 creator publish tab，只能走 non-write readiness path，并必须先满足 account safety 与 runtime identity gate。

### 5. validation binding

系统必须为 creator write scope 独立绑定以下 validation view：

- `FR-0012 + layer1_consistency`
- `FR-0013 + layer2_interaction`
- `FR-0014 + layer3_session_rhythm`

每条 view 必须同时满足：

- `profile_ref =` 当前 creator write scope profile
- `browser_channel = Google Chrome stable`
- `execution_surface = real_browser`
- `effective_execution_mode = live_write`
- `probe_bundle_ref = probe-bundle/xhs-creator-live-write-admission-v1`
- `baseline_status = ready`
- `current_result_state = verified`
- `current_drift_state = no_drift`

约束：

- `probe-bundle/xhs-closeout-min-v1` 的 read baseline 不得替代本 bundle。
- 若实现选择沿用 `probe-bundle/xhs-closeout-min-v1` 名称，必须先更新 formal contract 与 tests，证明它已扩展为 creator write scope；在未冻结前不得混用。
- 缺任一 target FR validation view 时，creator write admission 必须 `NO_GO`。

### 6. non-write readiness ladder

系统必须冻结 creator write admission 的最小恢复阶梯：

1. static tests / docs guards
2. `runtime.status`
3. `runtime.audit`
4. `runtime.closeout_gate`
5. dry-run 或 non-write readiness probe
6. creator target restore / rebind readiness check
7. creator write admission decision

约束：

- 任一步失败即停，并回写 blocker evidence。
- 本 FR 不允许执行真实上传、提交、发布或不可逆写入。
- creator write admission decision 只表示“允许进入后续受控上传 live evidence 准备”，不表示 #756 成功。

### 7. closeout gate behavior

`runtime.closeout_gate` 在 creator write scope 下必须保持 fail closed。

允许 `GO` 的条件必须全部满足：

- profile/runtime prerequisites 通过
- creator target binding verified
- account safety clear
- session rhythm 允许 creator write admission
- `FR-0012/0013/0014` creator write validation view 全部 ready

任一条件不满足时，必须返回 `NO_GO`，并给出可操作 blocker：

- `profile_runtime`
- `identity_binding`
- `target_binding`
- `account_safety`
- `session_rhythm`
- `anti_detection_validation`

## 异常与边界场景

### 1. read baseline 已 ready，但 live_write baseline 缺失

Given `runtime.audit` 对 `live_read_high_risk` 返回 `all_required_ready=true`
When creator write gate 请求 `requested_execution_mode=live_write`
Then 系统必须返回 `NO_GO`
And blocker 必须指向 creator write validation baseline 缺失

### 2. profile 可识别，但 Service Worker stale

Given managed profile meta 可识别
And fingerprint runtime 允许 live execution
When identity preflight 返回 `EXTENSION_SERVICE_WORKER_REFRESH_REQUIRED`
Then creator write admission 必须 `NO_GO`
And 不得进入 target restore 或 live write probe

### 3. target missing

Given runtime identity 已通过
But creator publish target binding missing
When closeout gate 请求 `creator_publish_tab`
Then 系统必须返回 `NO_GO`
And required recovery action 必须是恢复或重新绑定 managed creator target tab

### 4. validation ready，但 account safety blocked

Given creator write validation view 全部 ready
But `runtime.status.account_safety.state != clear`
When creator write admission 被请求
Then 系统必须返回 `NO_GO`
And blocker 必须优先暴露 account safety

### 5. 用户登录或账号确认需求

Given non-write readiness probe 需要真实登录态或用户确认浏览器状态
When 无法在当前回合只读确认
Then 系统必须暂停并记录 blocker
And 不得把账号接触 action 当成准入探针

## 验收标准

1. reviewer 能确认 `#819 / FR-0031` 是 creator live write admission 的唯一 formal owner。
2. reviewer 能确认 `FR-0029` read closeout scope 与 creator write scope 已隔离，且 read baseline 不会放行 `live_write`。
3. reviewer 能确认 `FR-0012/0013/0014` validation binding 使用 `effective_execution_mode=live_write` 与 creator write probe bundle。
4. reviewer 能确认 profile/root、identity freshness、account safety、session rhythm 与 creator target binding 都是 creator write admission 的必要条件。
5. reviewer 能确认本 FR 没有执行或放行真实上传、提交、发布、文件选择器或 DataTransfer 注入。

## GWT 验收场景

### 场景 1：read baseline 不能替代 creator write baseline

Given `FR-0029` read closeout validation baseline ready
When `runtime.closeout_gate` 使用 `target_domain=creator.xiaohongshu.com` and `requested_execution_mode=live_write`
Then gate decision is `NO_GO`
And missing refs include `FR-0012`、`FR-0013`、`FR-0014`

### 场景 2：creator write admission ready

Given managed profile identity binding is bound
And creator target binding is verified
And account safety is clear
And session rhythm allows creator write admission
And creator write validation views for `FR-0012/0013/0014` are ready
When `runtime.closeout_gate` checks creator write scope
Then gate decision is `GO`
And the output includes the creator write scope keys

### 场景 3：Service Worker freshness blocks admission

Given managed profile identity preflight reports stale Service Worker cache
When creator write admission is checked
Then gate decision is `NO_GO`
And blocker identifies identity freshness recovery

### 场景 4：non-write ladder stops on target mismatch

Given profile/runtime prerequisites pass
But creator target binding is missing
When readiness recovery runs
Then it stops before live_write
And writes target binding blocker evidence
