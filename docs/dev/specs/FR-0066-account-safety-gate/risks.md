# FR-0066 Risks

## 1. #835 CLOSED 被误读为 current account safety clear

- 风险：下游把 #835 closed state 或 FR-0032 historical baseline 当作当前 account safety evidence。
- 影响：旧 head、旧 run 或旧 profile 的安全状态被用于新的 write preparation / commit。
- 缓解：spec / contract / plan 均声明 #835 is historical background only；current scoped state required。
- 回滚：修正 downstream PR metadata / gate result，删除历史证据冒充 current clear 的表述。

## 2. Operator unlock 被误用为 account safety clear

- 风险：accepted operator unlock 被当作账号风险已清除。
- 影响：账号安全 blocker 被操作者授权绕过。
- 缓解：FR-0066 states operator unlock only references account safety; it cannot create it.
- 回滚：gate result returns `account_safety_unknown` or specific safety blocker until current clear exists。

## 3. Provider requirement pass 被误用为 safety clear

- 风险：#1179 provider requirement disposition 被当作 account safety pass。
- 影响：provider capability 与账号安全混写。
- 缓解：provider requirement must consume account safety result; it cannot replace it.
- 回滚：restore provider result to blocked / defer until `account_safety_ref` is accepted。

## 4. Redaction success 被误读为 safety clear

- 风险：evidence redacted 被写成 account safety clear。
- 影响：只证明披露边界合规，没有证明账号风险状态。
- 缓解：contract states redaction is necessary but not sufficient; missing signal scan remains `unknown`.
- 回滚：gate result returns `account_safety_unknown` or `safety_evidence_missing`.

## 5. Redaction 不合规泄露账号或 profile 信息

- 风险：safety evidence refs 内联 account identifier、cookie、token、profile path、page content 或 secret-bearing locator。
- 影响：隐私和账号安全泄露。
- 缓解：consume FR-0041 and #1181; redaction invalid required evidence fail closed.
- 回滚：redact and replace evidence refs before any downstream gate consumes them。

## 6. Stale clear 被复用

- 风险：上一 head / run / profile / target 的 `clear` 被继续复用。
- 影响：当前页面、账号或运行环境已经变更但 gate 仍放行。
- 缓解：scope matching, `checked_at`, `expires_at`, head/run matching and freshness refs are required.
- 回滚：invalidate stale record and rerun account safety evaluation in future implementation scope。

## 7. Live action 被当作 safety probe

- 风险：为确认账号安全而执行真实 account/live/write action。
- 影响：违反本 PR 边界，可能触发外部可见写入或账号风控。
- 缓解：spec forbids browser/account/live/write actions and requires stop on `requires_operator_attention`.
- 回滚：停止该执行路径，拆出 runtime/admission blocker issue with fresh failure evidence。

## 8. Account safety clear 被误读为 sufficient commit allow

- 风险：下游把 account safety lane allow 当作 `live_write_commit` 可以执行。
- 影响：default lock、operator unlock、provider requirement、target binding、anti-detection 或 live evidence 被绕过。
- 缓解：all docs state `clear` is necessary only and does not satisfy other gates.
- 回滚：restore broader gate result to locked / blocked until all required owner results exist。
