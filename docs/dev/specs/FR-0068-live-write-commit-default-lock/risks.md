# FR-0068 Risks

## 1. Default lock release 被误读为 commit execution

- 风险：下游看到 `release_ready_for_downstream_gate` 后直接执行 `live_write_commit`。
- 影响：绕过 final commit gate、live evidence gate 或 release gate matrix，产生真实外部可见写入。
- 缓解：spec / contract / data model 均声明 release-ready 只是必要输入，必须 downstream re-consumption。
- 回滚：撤回 release-ready 表述，恢复 `locked` / `release_deferred`，并补充 downstream owner blocker。

## 2. #1179 admission pass 被误读为 commit unlock

- 风险：`xhs.creator_publish.admit` 的 provider requirement pass 被用于解除 default lock。
- 影响：把 `write_admit` 越权升级为 `live_write_commit`。
- 缓解：明确 #1179 only supports `write_admit` and preserves `default_live_write_commit_lock=locked`。
- 回滚：删除任何把 #1179 pass 写成 commit-level provider requirement 的措辞。

## 3. Operator unlock overreach

- 风险：accepted operator unlock 被当作 default lock release 或 live evidence accepted。
- 影响：绕过 account safety、runtime target binding、anti-detection、provider requirement 和 live evidence gates。
- 缓解：FR-0068 requires operator unlock plus all other current exact-scope refs; operator unlock only clears operator lane。
- 回滚：把 overbroad operator language 改回 `operator_unlock_ref` as required input only。

## 4. Historical / stale evidence reused

- 风险：#835 closed state、old run、old artifact、same-head historical artifact 或 post-merge evidence 被当作 current release evidence。
- 影响：release decision 不再绑定当前 head/run/profile/target。
- 缓解：blocking reasons include `historical_or_stale_evidence`, `default_lock_head_mismatch`, `default_lock_run_mismatch` and freshness refs。
- 回滚：移除 stale evidence from accepted refs and require fresh rerun by downstream owner。

## 5. Redaction leakage

- 风险：default lock record 或 PR metadata 暴露 raw profile path、account identifier、cookie、token、private URL、page content or live artifact payload。
- 影响：账号、安全和隐私风险扩大。
- 缓解：evidence refs are locators only; `redaction_invalid` blocks release。
- 回滚：rotate/remove exposed artifact, replace with opaque refs, and re-run redaction validation before any release disposition。

## 6. Control-plane signal promoted to live evidence

- 风险：runtime ping、bootstrap ack、service worker wake signal、descriptor ref、doctor pass or stub/fake host handshake 被当作 release proof。
- 影响：锁被控制面存活信号绕过，未证明真实页面写入闭环。
- 缓解：non-proofs and blockers explicitly reject these signals。
- 回滚：classify the signal as rejected evidence and require live evidence gate owner output。

## 7. Scope drift after release-ready

- 风险：release-ready 产生后，head/run/profile/provider/target/operator/evidence scope 变化，但下游继续复用旧 disposition。
- 影响：不再满足 exact-scope safety boundary。
- 缓解：downstream re-consumption must re-check scope, freshness, expiry and revocation。
- 回滚：mark release disposition stale/expired and require new exact-scope evaluation。
