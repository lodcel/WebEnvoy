# FR-0053 Risks

## 风险 1：health pass 被误当作 runtime/live success

- 表现：consumer 把 `direct_launch_health_level=admission_ready` 解释为 runtime ready、target tab ready、capability allowed 或 live evidence attested。
- 影响：后续 provider selection、capability gate 或 closeout 可能错误放行真实网页执行。
- 缓解：spec / contract 强制 `does_not_prove` 覆盖 browser honored args、runtime ready、capability allowed、target tab ready、anti-detection pass 与 live evidence attested，并要求 `next_required_gates` 继续列出 runtime / launch evidence / capability / live gate。

## 风险 2：transport readiness 范围过宽

- 表现：`transport_probe` 把 CDP/Playwright precondition 或 provider control surface 误写成 page automation success。
- 影响：direct CloakBrowser provider 被误认为可执行业务 action，绕过 #1149 capability matrix 与 runtime attestation。
- 缓解：FR-0053 将 `transport_probe` 限制为 health/admission preflight，不允许证明 target tab、runtime bootstrap、page automation 或 live evidence。

## 风险 3：optional extension 状态被升级为 persistent extension identity

- 表现：direct launch optional extension locator / state 被解释为 stable extension id、service worker freshness 或 Native Messaging readiness。
- 影响：抢占 persistent owner 范围，污染 direct / persistent variant 边界。
- 缓解：`optional_extension_probe` 默认 optional；只有 admission 明确要求时才可阻断。即使 pass，也不得证明 stable extension identity、persistent install、service worker freshness 或 Native Messaging readiness。

## 风险 4：sensitive path、argv、env 或 seed 泄露

- 表现：health evidence、PR body、stdout summary 或 spec sample 中出现 full local path、raw argv、raw environment dump、token、fingerprint seed value、seed hash value 或 private patch payload。
- 影响：泄露用户环境、secret 或 provider-private 信息，并污染可复用 formal contract。
- 缓解：spec 固定 evidence refs 必须使用 redacted locator、artifact id、opaque handle 或 checksum ref；命中 forbidden disclosure 时必须 fail-closed。

## 风险 5：final args evidence 被误读为 browser honored args

- 表现：`launch_args_probe=pass` 被解释为真实浏览器进程已经 honor 了所有启动参数。
- 影响：后续 launch evidence、limitation gate 或 capability owner 被绕过。
- 缓解：`launch_args_probe` 必须消费 FR-0058，并保留 `browser_honored_args` 的 negative proof；需要 browser honored args 时必须由后续 launch evidence owner 提供。

## 风险 6：direct health 抢占相邻 issue ownership

- 表现：FR-0053 写入 persistent profile、Native Messaging、cloakserve broker、capability matrix、limitation gate、license audit 或 runtime implementation 语义。
- 影响：#1147/#1148/#1149/#1151/#1152/#1153 等后续 owner 无法清晰消费边界。
- 缓解：spec 将这些范围列入非目标和 deferred owners；PR 纯度只允许 FR-0053 suite 与 #1150 sync-map。

## 风险 7：historical health artifact 被误用为 current admission evidence

- 表现：旧 run、旧 head 或 historical background artifact 被用于满足 current-run required health gate。
- 影响：PR / admission / closeout 证据与当前 head 脱节。
- 缓解：spec 要求 historical、unknown、redaction invalid 或 unavailable evidence 命中 required check 时 fail-closed；PR 仅申报 formal spec，不提供 live evidence record。
