# FR-0055 Risks

## 风险 1：把 limitation gate 写成 runtime allow

- 触发：gate result 出现 `decision=allow` 或 runtime ready 语义。
- 影响：绕过 #1153 runtime/evidence convergence 与 FR-0035 minimum support state。
- 缓解：FR-0055 只允许 `deny` / `defer`，不定义 allow。
- 回滚：移除 allow 语义，恢复 blocked/defer 输出。

## 风险 2：cloakserve extension support 被误读为 WebEnvoy bridge ready

- 触发：看到 upstream extension loading 能力后放行 WebEnvoy extension/content-script/relay workflow。
- 影响：绕过 FR-0051 default extension disabled 与 #1152 fail-closed scope。
- 缓解：extension runtime bridge 与 WebEnvoy relay bridge 默认 hard block。
- 回滚：恢复 `cloakserve_default_extension_disabled`、`cloakserve_no_webenvoy_extension_binding` 和 `no_extension_binding` blocking reasons。

## 风险 3：Native Messaging doctor 被误用为 cloakserve support

- 触发：future doctor 或 local host success 被当成 cloakserve Native Messaging allow。
- 影响：绕过 FR-0051 `native_messaging_support=none` 与 FR-0052 unsupported row。
- 缓解：Native Messaging 默认 hard block；doctor evidence 只能在 scoped experimental issue 中成为 downstream evaluation input。
- 回滚：恢复 unsupported/blocked disposition，移除 direct allow。

## 风险 4：scoped experimental issue 权限过宽

- 触发：用 parent issue、milestone、project 或 PR 根链接作为 opt-in。
- 影响：模糊授权边界，造成 runtime/live 行为误放行。
- 缓解：experimental issue 必须是具体 GitHub issue，并精确列出 provider/capability/workflow/evidence owner/freshness/rollback。
- 回滚：将 scope mismatch 判为 blocked/deny。

## 风险 5：同 PR 抢占 #1153

- 触发：本 suite 定义 runtime/evidence convergence、target tab binding、extension capability gate 或 live evidence record。
- 影响：#1152 与 #1153 ownership 混写，scheduler gate 无法判定。
- 缓解：spec/plan/TODO 均声明 #1153 为 downstream owner；FR-0055 只提供 limitation gate ref。
- 回滚：移除 #1153 output shape，保留 downstream owner reference。

## 风险 6：scope 扩大到 runtime/live/browser

- 触发：为证明 gate 正确而运行 browser/live/runtime 或修改 source code/scripts/workflows。
- 影响：违反 worker scope，触发真实 Live Evidence 专项门禁或高风险 implementation review。
- 缓解：本 PR 只做 formal suite 和 sync map；不运行 guardian/formal review/controlled merge/issue closeout。
- 回滚：移除 runtime/live 输出，必要时报告 scheduler reclassify。
