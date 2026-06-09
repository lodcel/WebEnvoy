# FR-0054 Risks

## 风险 1：health pass 被误用为 runtime ready

- 风险：consumer 把 `health_checked` 当成浏览器已 attach、runtime bootstrap 成功或 target tab ready。
- 缓解：spec / contract 强制 `does_not_prove` 包含 runtime、target tab、bootstrap、command、capability 与 live evidence 的 non-proof 条目。
- 回滚：若 review 发现 readiness 泄漏，删除或下调相关字段，只保留 `next_required_gates`。

## 风险 2：extension load 被误用为 command success

- 风险：extension `loaded` 被当成 content script 注入、service worker fresh 或 extension command 可用。
- 缓解：extension surface 只表达 identity / installation / load / runtime surface；service worker freshness 和 command round-trip 指向后续 owner。
- 回滚：移除 command-like wording，保留 `extension_command_success` in `does_not_prove`。

## 风险 3：Native Messaging surface 被误用为 round-trip proof

- 风险：manifest / allowed origin / host locator pass 被当成 Native Messaging 消息闭环成功。
- 缓解：contract 明确 `native_messaging_round_trip_success` 不被证明，runtime bootstrap 必须走后续 gate。
- 回滚：将 Native Messaging 相关字段收窄为 manifest / allowed origin refs，不描述 transport beyond surface。

## 风险 4：历史 artifact 污染 current health

- 风险：旧 run 或 historical artifact 被复用为当前 required health evidence。
- 缓解：每个 signal 必须包含 freshness；historical / stale / unknown / not_collected 命中 required signal 必须 fail-closed。
- 回滚：提高 freshness 约束，禁止 required health 使用 `current_runtime_admission` 以外的任何非 current run scope。

## 风险 5：profile 或 account-affine secret 泄漏

- 风险：profile locator、cookie、token、account id、license secret 或 broker credential 进入 spec sample、PR body 或 public artifact。
- 缓解：refs 必须 redacted / opaque / run-scoped；required evidence sensitivity 违反时直接 invalid。
- 回滚：删除具体 locator sample，仅保留 abstract artifact refs。

## 风险 6：与相邻 CloakBrowser suites 混写

- 风险：本 FR 顺手定义 capability matrix、limitation gate、final args evidence、fingerprint policy、service worker freshness 或 runtime implementation。
- 缓解：非目标和 plan 明确禁止触碰 #1149/#1150/#1152/#1153/#1154/#1155/#1156/#1157；只保留 downstream refs。
- 回滚：将超出范围段落迁出或删除，改由对应 issue owner 冻结。

## 风险 7：profile health 被误写成账号安全证明

- 风险：login-state reuse 或 persistent profile pass 被解释为目标站点账号安全、会话可用或风控通过。
- 缓解：spec 明确 login-state reuse 是 expectation，不证明 account safety 或 target site session usable。
- 回滚：删除 login-state success wording，只保留 persistent profile 的准入状态。
