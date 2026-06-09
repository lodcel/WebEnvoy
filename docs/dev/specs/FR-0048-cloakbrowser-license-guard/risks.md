# FR-0048 风险与缓解

## 风险 1：CloakBrowser binary 被仓库或 release artifact 再分发

- 风险：实现或 release packaging 为了方便运行，把 CloakBrowser executable、installer、archive、native component、encoded payload 或 fixture copy 放入仓库 / release artifact。
- 缓解：spec 与 contract 将 bundled / redistributed binary 统一定义为 `bundled_binary_detected` 或 `redistribution_payload_detected` blocker，并要求 #1212 把 no bundled binary 作为 required evidence。
- 回滚：删除 binary / payload / artifact，re-run repository and release scan，保留 only redacted locator / evidence ref。

## 风险 2：operator licence responsibility 被误写成 WebEnvoy redistribution permission

- 风险：license acknowledgement 被解释成 WebEnvoy 可以下载、托管、镜像或再分发 CloakBrowser binary。
- 缓解：license acknowledgement 只证明 operator 已确认许可责任；`redistribution_allowed_by_webenvoy=false` 是 v1 强约束。
- 回滚：移除任何再分发暗示，恢复 operator-installed binary model，并在 PR / issue 中补充 blocker disposition。

## 风险 3：binary source evidence 泄露敏感 locator 或 secret

- 风险：PR body、stdout summary、fixture、public artifact 或 spec sample 暴露 raw binary path、license key、vendor account id、credential-bearing download URL、Cookie、token 或 provider private payload。
- 缓解：binary locator 默认至少 `sensitive`，license / credential material 默认 `secret`；FR-0041 redaction gap 命中 required evidence 时 fail-closed。
- 回滚：替换为 opaque handle、hash locator、artifact identity 或 `<redacted:path:cloakbrowser-binary>`，并重新验证 disclosure surfaces。

## 风险 4：provider self-declaration 绕过 license guard

- 风险：CloakBrowser provider 自报 “installed / licensed / ready” 后被 selection、doctor 或 release audit 当成准入证据。
- 缓解：contract 冻结 `provider_self_declaration_only` blocker；provider selection 必须消费 license acknowledgement 与 binary source evidence refs。
- 回滚：把 self-declaration 降级为 background metadata，要求 operator acknowledgement 与 evidence refs 后再进入后续 gate。

## 风险 5：#1212 closeout 重定义本 guard

- 风险：License / Binary Packaging Audit 在 closeout 中临场新增允许 WebEnvoy 再分发 binary 的降级规则，或把 historical evidence 当作 required current closeout。
- 缓解：#1212 只能消费 FR-0048 required inputs；不改变 ownership model、redistribution policy 或 required evidence fail-closed rules。
- 回滚：拆分 #1212 变更，先修订 FR-0048 或新增正式 spec，再重新执行 audit closeout。

## 风险 6：CloakBrowser 私有 patch 细节污染 core contract

- 风险：license guard 为了证明 source 或 version，顺手写入 CloakBrowser private patch schema、stealth 参数、driver state 或 binary internal manifest。
- 缓解：本 FR 只允许 logical provider id、redacted locator、hash / version ref 与 evidence ref；private implementation details 保留在 provider-specific contract 外。
- 回滚：删除 private fields，改为 opaque evidence ref，并确认 FR-0033 provider private limitation 仍然生效。

## 风险 7：spec-only PR 被误读为 issue closeout、runtime 或 audit 完成

- 风险：FR-0048 合入后被误认为 #1145 已进入 issue closeout，或 CloakBrowser provider adapter、runtime readiness、health doctor 或 #1212 release audit 已完成。
- 缓解：plan 与 TODO 明确 formal spec review PR 使用 `Refs #1145`。PR 合入只冻结 license guard formal suite，为 #1212 与后续 implementation / closeout 提供输入；不自动关闭 #1145，不关闭 #1212，不实现 runtime/adapter/health/release automation。
- 回滚：在 PR / issue follow-up 中补充 implementation pending 与 audit pending 说明，保持 #1212 和后续 runtime issues 打开。
