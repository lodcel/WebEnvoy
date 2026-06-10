# FR-0067 Risks

## 1. Doctor pass 被误读为 bridge ready

- 风险：下游把 `provider_doctor_report` 的 `doctor_checked` 当作 extension/native bridge readiness。
- 影响：doctor layer 与 runtime admission 混写，可能绕过 current smoke / bridge evidence。
- 缓解：spec / contract / plan 均声明 doctor pass is input only；current scoped bridge result required。
- 回滚：修正 downstream PR metadata / gate result，恢复为 bridge state missing 或 non-ready。

## 2. Extension smoke 被误用为 Native Messaging ready

- 风险：extension id、service worker freshness 或 smoke preflight 通过后，被当作 Native Messaging bridge ready。
- 影响：native host、allowed origins、socket、bridge handshake 缺失仍进入 write preparation。
- 缓解：FR-0067 requires extension smoke and native bridge readiness independently.
- 回滚：gate result returns `native_bridge_not_ready` until current Native Messaging health and bridge handshake pass。

## 3. Native bridge ack 被误用为 full runtime/live ready

- 风险：bridge handshake ack 被写成 target tab ready、page command success、account safety clear 或 live evidence accepted。
- 影响：绕过 target binding、account safety、anti-detection、live evidence 等 downstream gates。
- 缓解：contract states bridge ack only proves preflight and clears only bridge lane.
- 回滚：restore broader gate result to blocked / defer until all required owner results exist。

## 4. Stub/fake host evidence 被误用

- 风险：本地 fake host、stub 或非 official surface 的 ack 被当作 current native bridge readiness。
- 影响：真实 official Chrome extension-to-native-host path 未验证就进入 admission。
- 缓解：stub/fake source is explicit blocking reason and fail-closed.
- 回滚：remove stub/fake evidence from accepted refs and require official/accepted surface rerun in future implementation scope。

## 5. Stale ready 被复用

- 风险：上一 head / run / profile / extension / native host 的 `ready` 被继续复用。
- 影响：当前扩展、service worker、host registration 或 bridge 已漂移但 gate 仍放行。
- 缓解：scope matching, `checked_at`, `expires_at`, head/run matching and freshness refs are required.
- 回滚：invalidate stale record and rerun bridge evaluation in future implementation scope。

## 6. Redaction 不合规泄露 profile、manifest 或 secret

- 风险：bridge evidence refs 内联 raw profile path、manifest body、socket path、bootstrap secret、token、cookie 或 extension private payload。
- 影响：隐私、账号和本机环境信息泄露。
- 缓解：consume FR-0041; redaction invalid required evidence fail closed.
- 回滚：redact and replace evidence refs before any downstream gate consumes them。

## 7. Recovery 状态被当作 pass

- 风险：`requires_recovery` 或 `degraded_recoverable` 被写成可放行 readiness。
- 影响：bridge 实际仍未 ready 或 recovery 未完成，后续 admission 不稳定。
- 缓解：requires recovery states cannot pass; only fresh post-recovery evidence can produce `ready`.
- 回滚：gate result returns `requires_recovery` or `native_bridge_recovery_failed` until fresh evidence exists。

## 8. Bridge ready 被误读为 sufficient commit allow

- 风险：下游把 extension/native bridge lane allow 当作 `live_write_commit` 可以执行。
- 影响：default lock、operator unlock、provider requirement、account safety、target binding、anti-detection 或 live evidence 被绕过。
- 缓解：all docs state `ready` is necessary only and does not satisfy other gates.
- 回滚：restore broader gate result to locked / blocked until all required owner results exist。

## 9. Formal spec PR 被误写成 live evidence PR

- 风险：PR 描述或 suite 文本把本 formal spec review 当作 latest-head runtime/live evidence。
- 影响：reviewer / guardian 可能误消费非 live artifact，形成错误 merge gate。
- 缓解：PR metadata must use `gate_applicability.review_lane=formal_spec_review_pr` and `live_evidence_record=N/A`.
- 回滚：rewrite PR metadata and suite wording to remove live evidence claims before gate review。
