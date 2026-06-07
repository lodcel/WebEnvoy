# FR-0036 risks

## 风险 1：registry 被误读为 provider selection 或 runtime ready

- 风险：`default_eligibility=eligible` 或 `registry_status=static_checked` 被后续实现误当成 provider 已可执行业务命令。
- 缓解：spec 和 contract 明确 eligibility 只进入后续候选评估，仍必须校验 `FR-0033` verification、limitations、runtime readiness 与适用 evidence gate。
- 回滚：移除 FR-0036 suite 或在后续修订中收紧 eligibility enum，不影响当前 runtime 行为。

## 风险 2：CloakBrowser 私有能力污染 WebEnvoy core contract

- 风险：为了登记 CloakBrowser，registry 夹带 private patch、stealth 参数或 driver 内部状态。
- 缓解：`cloakbrowser_managed` 只允许作为 managed provider placeholder；private patch 只能以 `provider_private_patch_required` limitation 表达。
- 回滚：删除或阻断对应 placeholder entry，不影响 official Chrome 主路径。

## 风险 3：remote browser placeholder 被当成可连接 broker

- 风险：remote locator 被误认为远端认证、协议或 SLA 已冻结。
- 缓解：`remote_browser` entry 使用 `registry_status=blocked`、`default_eligibility=not_eligible`、`transport_kind=none` 与 `attach_model=not_attachable` 示例。
- 回滚：将 remote provider class 保留但移除 placeholder 示例，后续 broker issue 单独冻结协议。

## 风险 4：driver 继续硬编码 provider 分支

- 风险：后续实现绕开 registry，根据 provider family 或名称在 driver 中写条件分支。
- 缓解：GWT 明确 driver 必须按 `provider_id` lookup registry entry 并消费 `contract_snapshot`。
- 回滚：后续 implementation review 阻断硬编码分支，回到 registry resolver。

## 风险 5：formal spec 与实现混入同一 PR

- 风险：本 PR 在冻结 registry shape 的同时修改 runtime、driver 或 CLI，违反先规约后实现。
- 缓解：当前 PR 只改 FR-0036 suite 与 `.github/spec-issue-sync-map.yml`，并运行 spec-guard、docs-guard 与 purity check。
- 回滚：拆分实现改动到后续 issue-scoped PR。
