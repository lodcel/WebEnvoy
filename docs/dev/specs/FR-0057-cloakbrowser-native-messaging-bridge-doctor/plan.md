# FR-0057 实施计划

## 实施目标

冻结 `#1154 Native Messaging Bridge Doctor via WebEnvoy` 的 formal suite：定义 CloakBrowser lane 中 Native Messaging bridge doctor 的 WebEnvoy ownership、variant applicability、required checks、failure classes、handoff output、redaction/source integrity 与 fail-closed 语义。

本 PR 是 formal spec review carrier。合入后只冻结 `FR-0057` suite 和 #1154 sync-map；不自动关闭 #1154，不进入 runtime implementation、doctor command、extension/native host behavior、capability matrix、limitation gate 或 live evidence closeout。

## 分阶段拆分

### 阶段 1：formal scope 与 ownership 冻结

- 产出：`spec.md`
- 重点：明确 Native Messaging bridge doctor 属于 WebEnvoy extension/native host/bridge owner，不属于 CloakBrowser-owned capability。

### 阶段 2：contract / data model 落成

- 产出：`contracts/cloakbrowser-native-messaging-bridge-doctor-handoff.md`、`data-model.md`
- 重点：冻结 handoff identity、input refs、applicability、required checks、stateful conclusion、failure classes、evidence refs 与 next gates。

### 阶段 3：research / risks / checklist 收口

- 产出：`research.md`、`risks.md`、`TODO.md`
- 重点：记录与 `FR-0038`、`FR-0046`、`FR-0050`、`FR-0051` 的关系，防止 descriptor refs、stub evidence 或 CloakBrowser private bridge 被误用为 readiness。

### 阶段 4：sync map 与 PR 准备

- 产出：`.github/spec-issue-sync-map.yml` 中 #1154 映射、parser-ready PR metadata、验证记录
- 重点：确保 PR 只包含 `FR-0057` suite 与单条 sync-map 映射，closing semantics 为 `Refs #1154`。

## 实现约束

- 只允许修改：
  - `docs/dev/specs/FR-0057-cloakbrowser-native-messaging-bridge-doctor/**`
  - `.github/spec-issue-sync-map.yml` 中 #1154 对应映射
- 不修改 runtime、doctor command、native host、extension behavior、capability matrix、limitation gate、fixtures、tests、scripts、GitHub workflows、githooks、`AGENTS.md` 或 `code_review.md`。
- 不修改 `FR-0038`、`FR-0046`、`FR-0050`、`FR-0051` 的字段 shape。
- 不触碰 #1149/#1150/#1151/#1152/#1153/#1155/#1156/#1157 formal suites。
- 不执行 live/browser/profile/account/external-visible 动作。
- 不运行 guardian、formal review、controlled merge 或 issue closeout；gate owner 是 scheduler。

## 测试与验证策略

本 PR 的验证范围是 formal suite、sync-map、PR purity、diff 和 hosted checks：

- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh assert-mapped docs/dev/specs/FR-0057-cloakbrowser-native-messaging-bridge-doctor/spec.md`
- `bash scripts/check-pr-purity.sh docs/1154-cloakbrowser-native-messaging-bridge-doctor main`
- `git diff --check origin/main...HEAD`
- same-class closing semantics search
- PR push 后等待 hosted GitHub checks

语义自检：

- 对照 issue #1154，确认 scope 只覆盖 Native Messaging Bridge Doctor via WebEnvoy。
- 对照 `FR-0038`，确认不新增 doctor report schema，只映射 `native_messaging` checks。
- 对照 `FR-0046`，确认 host/manifest/origin/registration/transport/handshake semantics 保持 fail-closed。
- 对照 `FR-0050`，确认 persistent descriptor refs 只是 inputs，不是 bridge ready。
- 对照 `FR-0051`，确认 cloakserve default extension/native messaging unsupported 被保持为 fail-closed。
- same-class 搜索 auto-close 语义，确认本 PR 保持 `Refs #1154`。

## TDD 范围

当前 PR 不进入实现代码 TDD。

后续 implementation / parser / fixture issue 应优先补：

- handoff parser 接受 `bridge_doctor_ready|recoverable|blocked|unknown|not_applicable_fail_closed`，并拒绝 unknown enum。
- ownership validator 拒绝 `doctor_owner=cloakbrowser_provider` 或 provider-private source。
- variant applicability tests，确认 `cloakbrowser.cloakserve` 默认 Native Messaging fail-closed。
- evidence redaction tests，拒绝 raw manifest、full path、token、Cookie、profile path、provider credential 和 private patch payload。
- source integrity tests，拒绝 stub/fake host、historical artifact、stale bridge ack 和 wrong extension origin。
- capability readiness tests，确认 bridge doctor ready 不能满足 `target_tab`、`runtime_bootstrap_ready`、`runtime_attested` 或 `live_evidence_attested`。

## 并行 / 串行关系

可并行：

- 不触碰 `FR-0057` suite 的普通文档整理或其他 CloakBrowser formal suite 只读审阅。
- 后续 capability / limitation / health owner 可以基于本 suite 做只读 planning，但不得回写本 suite。

串行 / 依赖：

- 本 work item 依赖 `FR-0038 Provider Health / Doctor Contract` 与 `FR-0046 Native Messaging Health`。
- Persistent applicability 依赖 `FR-0050 cloakbrowser.persistent Descriptor` 的 extension/native bridge refs。
- Cloakserve fail-closed 边界依赖 `FR-0051 cloakbrowser.cloakserve Descriptor` 的 default extension/native messaging unsupported 语义。
- `#1149/#1152` 不在本 worker scope 内；后续只能读取本 suite 的 ownership/failure/handoff boundary。

## 进入实现前条件

- 本 FR formal spec review 通过。
- #1154 sync-map 已落地并可被 spec sync 校验。
- 后续 implementation owner 明确写入范围、allowed paths、runtime/evidence boundary 与 validation plan。
- 如后续 implementation 触及 real browser、profile、Native Messaging host 或 live evidence，必须重新评估 live evidence 专项门禁与高成本 gate 授权。
