# FR-0041 Evidence Redaction Policy

Canonical Issue: #1129

## 背景

`#1129` 属于 `#1113 M3 official-chrome Provider` 的 M3-A prerequisite contracts。上游 `FR-0040 Provider Evidence Kernel` 已冻结 `provider_evidence_record` 的 record shape，并只保留 sensitivity / redaction state / redacted locator 等最小 hook。当前缺口是：后续 `#1143 Launch Evidence for official Chrome`、provider evidence、health evidence 和 fixture evidence 需要同一份可复用 redaction policy 来判断哪些信息可以公开、哪些只能作为内部 locator、哪些必须完全禁止落入 artifact / PR body / stdout summary。

本 FR 只冻结 Evidence Redaction Policy 的 formal contract。它不修改 `FR-0040.provider_evidence_record` shape，不实现 evidence collector、redactor、artifact writer、CLI、browser launch、extension、Native Messaging、Playwright 或任何 runtime/live 行为。

`#1129` issue meta 已声明 `Close Semantics: fr-complete`，scope 是 “Define default redaction for fingerprint seed values, proxy credentials, cookies, storage, auth headers, account identifiers, absolute private paths, tokens, API keys, binary/profile locators and provider evidence fields.” 因此本 suite 合入后关闭 #1129 的规约冻结事项，并作为 #1143 official Chrome launch evidence 的 redaction policy 输入。

## 目标

1. 冻结 evidence redaction policy 的 sensitivity、redaction state、public locator、private locator 与 secret handling 语义。
2. 覆盖 fingerprint seed、proxy credential、Cookie、storage、auth header、account identifier、private absolute path、token、API key、binary locator、profile locator 与 provider evidence fields。
3. 冻结 provider evidence、launch evidence、health evidence 与 fixture evidence 的默认 redaction 规则。
4. 明确 PR body、stdout summary、public artifact、internal artifact、fixture 与 spec sample 的允许 / 禁止披露边界。
5. 明确本 policy 与 `FR-0040`、`FR-0037`、`FR-0038`、`FR-0016`、`#1143` 的 ownership，确保 #1143 可消费但不得重新定义 redaction 语义。

## 非目标

- 不定义、修改或扩展 `FR-0040.provider_evidence_record`、`provider_evidence_ref` 或 closeout plan 的字段 shape。
- 不实现 redaction engine、validator、artifact writer、CLI formatter、fixture generator、provider doctor、launch evidence collector 或 runtime evidence collector。
- 不推进 #1143 official Chrome launch evidence、#1144 或任何 runtime/live 行为。
- 不执行真实浏览器、真实账号、真实 profile、external visible、live read/write 或 account-touching 操作。
- 不冻结 Syvert normalized result、provider adapter payload、CloakBrowser-as-core、browser patching 或 default live_write 行为。
- 不要求 fresh live evidence；本 FR 是 policy/spec item，除非后续 PR 明确改变 scope。

## 功能需求

### 1. Policy ownership

Evidence Redaction Policy 属于 WebEnvoy core evidence governance surface。

约束：

- 后续 provider evidence、launch evidence、health evidence、fixture evidence、PR metadata 和 stdout summary 必须消费本 policy。
- #1143 可以引用本 policy 判定 official Chrome launch evidence 的 redaction 结果，但不得重新定义 sensitivity、redaction state、locator 或 secret handling。
- `FR-0040` 仍持有 provider evidence record shape；本 policy 只定义该 shape 中既有 sensitivity / redaction state / locator 字段的取值含义与 fail-closed 行为。
- 若后续 implementation 需要新增 policy metadata，必须在独立 implementation/spec issue 中声明，不得在 #1143 中临场扩大 redaction contract。

### 2. Sensitivity levels

Policy 冻结以下 sensitivity levels：

| Sensitivity | 语义 | 默认公开性 |
|---|---|---|
| `public` | 不包含用户、环境、账号、secret、private path 或可复用 fingerprint 信息 | 可进入 public summary |
| `internal` | 对调试有用但可能暴露本机结构、运行配置或 provider topology | 只能作为 internal locator 或受控 artifact |
| `sensitive` | 可关联账号、profile、环境、会话、风控或 provider private state | 必须脱敏后引用 |
| `secret` | credential、token、Cookie、storage secret、auth header、fingerprint seed、proxy secret 等可直接滥用信息 | 禁止明文落盘、公开或进入样例 |

约束：

- `secret` 不得进入 PR body、stdout summary、public artifact、fixture、spec sample 或 unredacted artifact。
- `sensitive` 必须通过 redacted locator、hashed locator 或 policy-approved excerpt 表达；不得直接展示原值。
- `internal` 不得误标为 `public` 来规避脱敏；若包含 private absolute path、profile path、binary path 或 account-affine locator，至少为 `sensitive`。
- 无法确定 sensitivity 时必须按更保守等级处理。

### 3. Redaction states

Policy 冻结以下 redaction states，并与 `FR-0040` 既有 enum 对齐：

| Redaction state | 语义 |
|---|---|
| `redacted` | 原值已被 policy-approved locator、hash、placeholder 或摘要替代 |
| `redaction_required` | 当前 evidence 需要脱敏但尚未完成，不得用于 required evidence closeout |
| `not_required` | 根据 policy 可明文表达，通常仅适用于 `public` |
| `policy_missing` | 当前 evidence kind 没有可消费 policy，必须 fail-closed |
| `invalid` | evidence 声称已脱敏但仍包含禁止内容、不可追溯 locator 或不一致 sensitivity |

约束：

- `redaction_required|policy_missing|invalid` 命中 required evidence 时必须阻断。
- `not_required` 只能用于 `public`，或后续 policy 明确允许的低风险 internal metadata。
- `redacted` 不表示 evidence fresh、trusted、runtime-attested 或 live-accepted；它只表示披露边界满足 policy。
- 同一 evidence 在 public summary 与 internal artifact 中可以有不同 locator 表达，但必须指向同一 artifact identity 或 provenance。

### 4. Locator policy

Policy 冻结以下 locator 类型：

| Locator type | 允许内容 | 禁止内容 |
|---|---|---|
| `public_locator` | issue/PR/ref id、contract ref、run id、artifact id、sanitized filename、logical profile id | secret、private absolute path、account id、raw browser path |
| `private_locator` | 仅内部使用的 redacted path token、hashed path、environment-scoped handle | 原始 home path、profile path、binary path、credential |
| `secret_handle` | secret store key、vault handle、opaque credential reference | secret 原值、可反查 token、Cookie、auth header |
| `artifact_locator` | artifact id、relative artifact path、checksum、run-scoped ref | private absolute artifact root、unredacted log excerpt |

约束：

- public locator 不得包含 `/Users/...`、home directory、workspace absolute path、profile absolute path、binary absolute path、account identifier、email、phone、Cookie、token 或 proxy credential。
- private locator 可以用于内部诊断，但必须是 redacted / hashed / opaque，不得把原始 private path 伪装为 locator。
- secret handle 只能证明 secret 存在或被引用，不得提供可恢复 secret。
- binary locator 与 profile locator 默认至少为 `sensitive`；公开表达必须使用 canonical label、logical id、hash 或 opaque handle。

### 5. Secret handling

以下内容默认 `secret`：

- fingerprint seed values 和 fingerprint private patch payload。
- proxy username、password、endpoint credential、authorization material。
- Cookie、LocalStorage / SessionStorage secret、indexed storage secret、auth header、bearer token、API key、refresh token、session token。
- account password、2FA seed、recovery code、account-private identifier。
- Native Messaging bootstrap secret、extension private payload、provider private patch secret。

约束：

- secret 不得明文写入 fixtures、examples、PR metadata、stdout summary、docs、public artifact 或 unredacted artifact。
- secret 只能以 `secret_handle` 或 `redacted` placeholder 出现，例如 `<redacted:proxy_credential>`。
- Secret presence 可以作为 evidence conclusion，但 secret value 本身不能作为 evidence ref。
- 发现 secret leak 时必须输出 `secret_leak_detected` 或等价 blocker，并将相关 evidence 判为 `invalid`。

### 6. Private path and locator handling

以下内容默认至少 `sensitive`：

- private absolute path。
- browser binary path。
- user data dir / profile path。
- extension installation path。
- Native Host manifest absolute path。
- artifact root absolute path。
- workspace absolute path。

允许公开表达：

- canonical browser channel，例如 `Google Chrome stable`。
- logical provider id，例如 `official-chrome-stable`。
- logical profile handle，例如 `profile_ref=opaque_profile_handle`。
- redacted private path token，例如 `<redacted:path:user-data-dir>`.
- artifact identity、checksum、run id 或 PR head sha。

约束：

- 原始 private absolute path 不得进入 PR body、public summary、fixture 或 spec sample。
- 若内部 artifact 需要保留可复现 locator，必须使用 private locator，并将 sensitivity 标记为 `sensitive` 或更高。
- binary/profile locator 不能替代 version evidence、provider identity 或 runtime readiness。

### 7. Account identifier and auth material handling

以下内容默认至少 `sensitive`，如可直接登录或重放则为 `secret`：

- email、phone、username、user id、account id、tenant id、workspace id、organization id。
- login state proof 中的 account-affine marker。
- auth header、session id、token、Cookie、storage credential。

约束：

- PR body 与 stdout summary 不得出现 raw account identifier。
- account identifier 如需关联 evidence，只能使用 hashed id、opaque account ref 或 redacted locator。
- login state evidence 只能表达 `ready|login_allowed|not_required|blocked|unknown` 等状态，不得保存账号 secret。

### 8. Provider evidence redaction

Provider evidence 必须消费 `FR-0040` 的既有 evidence refs、sensitivity、redaction state 与 closeout plan。

约束：

- 本 FR 不新增 `provider_evidence_record` 字段。
- selected provider id、contract ref、contract version、provider mode、browser channel 等非私密 contract metadata 可为 `public`。
- launch config snapshot、profile ref、fingerprint policy ref、network regional ref、Native Host manifest ref、allowed origin ref 默认至少为 `sensitive`，必须使用 locator。
- runtime bootstrap payload、proxy credential、fingerprint seed、Cookie、storage、auth header、provider private patch payload 默认为 `secret`。
- `redaction_required|policy_missing|invalid` 命中 FR-0040 required evidence 时，closeout 必须 fail-closed。

### 9. Launch evidence redaction

Launch evidence 默认规则：

- Browser channel、provider id、contract ref、run id、head sha、launch envelope ref 可为 `public`，前提是不包含 private locator。
- Browser binary locator、profile locator、extension locator、Native Host locator、artifact root locator 默认至少为 `sensitive`。
- Full argv、environment、profile path、proxy config、fingerprint seed、extension private payload、Native Host private payload 默认不得公开。
- Official Chrome launch evidence 必须引用本 policy；#1143 不得发明新的 secret / locator / profile path 降级规则。

### 10. Health evidence redaction

Health evidence 默认规则：

- Doctor / health conclusion、status enum、contract ref、provider id 可为 `public`。
- Raw command output、environment dump、manifest path、allowed origin source、extension state snapshot、Native Host config dump 默认至少为 `sensitive`。
- Bootstrap secret、token、Cookie、auth header、profile storage content 默认为 `secret`。
- Health evidence pass 不等于 live evidence accepted；脱敏状态不提升 runtime/live attestation。

### 11. Fixture evidence redaction

Fixture evidence 必须使用 synthetic、opaque 或 redacted values。

约束：

- Fixture 不得包含真实 Cookie、token、API key、account identifier、private absolute path、profile path、browser history、proxy credential 或 fingerprint seed。
- 若 fixture 需要表达 secret presence，必须使用 `<redacted:kind>` 或 `secret_handle=fixture_secret_handle`。
- 若 fixture 需要表达 path，必须使用 relative synthetic path、opaque locator 或 `<redacted:path:kind>`。
- Fixture sample 必须覆盖 redacted、redaction_required、policy_missing、invalid 和 secret leak blocker 的 negative cases。

### 12. PR body, stdout and artifact disclosure

默认 disclosure boundary：

| Surface | 允许 | 禁止 |
|---|---|---|
| PR body | public locator、redacted evidence summary、validation command、head sha、run id | secret、raw private path、raw account id、raw argv/env |
| stdout summary | public metadata、redacted locator、structured blocker | secret、sensitive raw value |
| public artifact | sanitized fixture、redacted evidence object | secret、raw private path、credential |
| internal artifact | redacted/private locator、hashed locator、diagnostic excerpt | secret raw value，除非由后续 secure storage policy 明确允许 |
| spec sample | synthetic values、placeholders | real account/runtime/path/secret |

约束：

- `redacted` artifact 仍必须保留 provenance、artifact identity 与 replay boundary。
- PR metadata 中 `live_evidence_record` 对本 FR 默认 `N/A`；不得用 redaction policy PR 冒充 live evidence。

### 13. Fail-closed rules

以下情况必须 fail-closed：

- required evidence 缺少 policy。
- evidence 标记为 `redaction_required` 但被用于 required closeout。
- evidence 标记为 `redacted` 但仍包含 secret、raw private path 或 raw account identifier。
- sensitivity 被低估，例如 secret 被标为 public/internal。
- public locator 不可追溯，或 private locator 实际包含原始 private path。
- fixture、example 或 PR body 出现真实 secret / account / path。

## GWT 验收场景

### 场景 1：secret 不得进入 public summary

Given evidence 包含 proxy credential
When 后续实现生成 PR body 或 stdout summary
Then credential 原值不得出现
And evidence 必须使用 `secret_handle` 或 `<redacted:proxy_credential>`
And sensitivity 必须为 `secret`

### 场景 2：profile path 必须作为 redacted locator

Given launch evidence 需要表达 Chrome profile binding
When evidence 写入 artifact 或 PR metadata
Then profile path 不得是 private absolute path
And locator 必须是 opaque profile ref、hash 或 `<redacted:path:profile>`
And sensitivity 至少为 `sensitive`

### 场景 3：FR-0040 required evidence 遇到 policy_missing 必须阻断

Given `provider_evidence_record.evidence_refs[*].redaction_state=policy_missing`
And 该 evidence kind 是 closeout plan required evidence
When closeout plan 计算 coverage
Then closeout decision 必须 fail-closed
And blocking reason 必须包含 redaction policy 缺口

### 场景 4：#1143 可消费但不得重定义 policy

Given #1143 需要 official Chrome launch evidence
When #1143 描述 browser binary locator、profile locator 或 extension locator
Then #1143 必须引用本 FR 的 locator policy
And 不得新增与本 FR 冲突的 secret handling 或 path disclosure 规则

### 场景 5：fixture 只能使用 synthetic 或 redacted values

Given fixture 需要覆盖 Cookie 或 storage credential
When fixture 被提交到仓库
Then fixture 必须使用 synthetic placeholder 或 secret handle
And 不得包含真实 Cookie、token、LocalStorage、SessionStorage 或 account identifier

### 场景 6：health evidence pass 不等于 live evidence

Given provider health evidence conclusion 是 pass
And evidence 已按本 policy 脱敏
When PR 或 closeout 需要真实 live evidence
Then health pass 不得替代 `FR-0016` live evidence record
And 不得把 redaction success 写成 runtime/live success

## 异常与边界场景

- Evidence 同时包含 public contract metadata 和 sensitive locator 时，必须按字段级 sensitivity 处理，不得整体降级为 public。
- Redacted locator 不可追溯到 artifact identity 时，必须视为 invalid。
- Hash locator 若可通过小字典反推真实账号或路径，必须提升 sensitivity，并避免进入 public surface。
- Browser channel `Google Chrome stable` 可以公开，但 browser binary absolute path 不可公开。
- Extension id 可以公开，但 extension private payload、runtime bootstrap secret 或 profile-local extension path 不可公开。
- Native Host name 可以公开，但 host manifest absolute path、allowed origin raw source 或 bootstrap secret 不可公开。
- Manual review 可以确认脱敏结果，但不能把 secret raw value 写入 review comment。
- 本 FR 的 sample、fixture 或 PR metadata 不得包含真实 profile、secret、account、browser history、Cookie、token、proxy credential、fingerprint seed 或 private absolute path。

## 验收标准

1. Sensitivity、redaction state、public/private locator、secret handle 与 artifact locator 语义已冻结。
2. Fingerprint seed、proxy credential、Cookie、storage、auth header、account identifier、private path、token、API key、binary/profile locator 均有默认规则。
3. Provider evidence、launch evidence、health evidence 与 fixture evidence 均有 redaction 边界。
4. 本 suite 明确只消费 `FR-0040` redaction hooks，不定义或修改 provider evidence record shape。
5. #1143 可以引用本 policy 作为 official Chrome launch evidence 的 redaction 输入，但不得重定义 redaction 语义。
6. GWT 覆盖 secret、profile locator、FR-0040 policy_missing、#1143 consumption、fixture 和 health/live 边界。
7. 套件不实现 runtime、live evidence、browser launch、extension、Native Messaging、Playwright 或账号行为。
