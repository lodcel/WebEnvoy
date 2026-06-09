# FR-0048 实施计划

## 实施目标

冻结 `#1145 CloakBrowser License Guard` 的 formal spec suite，定义 CloakBrowser binary 不得随 WebEnvoy 仓库 / release / fixture / artifact 捆绑或再分发，operator-installed binary 是唯一允许 ownership model，并冻结 license acknowledgement 与 binary source evidence 供后续 #1212 License / Binary Packaging Audit 消费。

本 PR 是 formal spec / license guard carrier。PR 合入只冻结 #1145 的 license guard formal suite，为 #1212 release packaging audit 与后续 implementation / closeout 消费提供输入。Formal spec review PR 使用 `Refs #1145`，不自动关闭 #1145，不关闭 #1212 release packaging audit，也不声明 CloakBrowser runtime/provider implementation 完成。

## 分阶段拆分

### 阶段 1：license / binary ownership guard

- 产出：`spec.md`、`contracts/cloakbrowser-license-guard.md`
- 重点：冻结 no bundled redistribution、operator-installed binary、license acknowledgement、binary source evidence 与 fail-closed blocker。

### 阶段 2：evidence / redaction 消费

- 产出：`data-model.md`
- 重点：确认 binary locator、license ref、source ref 与 audit evidence 只消费 FR-0040 / FR-0041，不复制 binary payload、private path、license key 或 vendor account data。

### 阶段 3：#1212 audit handoff

- 产出：`TODO.md`
- 重点：明确 #1212 可消费的 required inputs、阻断场景和不可重定义边界。

### 阶段 4：风险与 review 准备

- 产出：`research.md`、`risks.md`、formal spec review PR、验证记录、PR metadata
- 重点：确认本 suite 没有进入 runtime behavior、descriptor、health、XHS、Syvert、official Chrome、browser patching、scripts/workflows 或 release automation。

## 实现约束

- 不修改 runtime、CLI、provider adapter、descriptor、health doctor、extension、native host、Playwright、scripts、GitHub workflows、githooks 或 release automation。
- 不实现 CloakBrowser binary discovery、download、install、cache、mirror、vendor、package 或 launch 行为。
- 不定义 CloakBrowser private patch schema、stealth 参数、driver 内部状态、账号策略、broker 协议或 binary internal manifest。
- 不把 CloakBrowser 设为 WebEnvoy core、default provider、official Chrome replacement 或 browser patching 主路径。
- 不修改 FR-0033 / FR-0038 / FR-0040 / FR-0041 字段 shape；只消费其既有 provider / evidence / redaction 语义。
- 不执行 live/browser/runtime/Syvert/XHS/account-touching 或 external-visible 动作。

## 测试与验证策略

本 PR 的验证范围是文档、formal spec suite、PR 纯度与 hosted checks：

- `bash scripts/setup-git-hooks.sh`
- `bash scripts/docs-guard.sh`
- `bash scripts/spec-guard.sh`
- `bash scripts/spec-issue-sync-map.sh validate`
- `bash scripts/spec-issue-sync-map.sh resolve docs/dev/specs/FR-0048-cloakbrowser-license-guard/spec.md`
- `git diff --check origin/main...HEAD`
- `bash scripts/check-pr-purity.sh docs/1145-cloakbrowser-license-guard main`
- hosted GitHub checks after PR push

当前 worker 指令的 allowed write paths 不包含 `.github/spec-issue-sync-map.yml`。如果 spec guard 要求新增 FR-0048 映射，本 worker 不越权修改 `.github`，需要 scheduler 授权或由 scheduler/后续 worker补齐映射后再达到 fully PR-ready。

语义自检：

- 对照 #1145 issue，确认 scope 只覆盖 CloakBrowser license / binary redistribution guard。
- 对照 #1212 issue，确认本 suite 只提供 audit-consumable guard，不执行 closeout。
- 对照 FR-0033，确认 CloakBrowser 只作为 managed provider / private limitation，不进入 WebEnvoy core。
- 对照 FR-0040 / FR-0041，确认 binary source evidence 与 locator redaction 只消费既有 policy。
- 对照 `research.md`，确认本 FR 不作第三方法律结论、不复制 license text、不下载或验证 CloakBrowser binary。

## TDD 范围

当前 PR 不进入实现代码 TDD。

后续 implementation / audit 应优先补：

- repository / release artifact scan 对 CloakBrowser binary、installer、archive、encoded payload 的 deny tests。
- PR / artifact disclosure tests，禁止 raw binary path、license key、vendor account id、download credential 或 binary payload。
- license acknowledgement required-status / scope mismatch fail-closed tests。
- binary source evidence missing / unknown / stale / redaction invalid fail-closed tests。
- provider selection 不接受 provider self-declaration 替代 license guard evidence 的 tests。
- #1212 audit 消费 `FR-0048.cloakbrowser_license_guard.v1` 的 closeout tests。

## 并行 / 串行关系

可并行：

- 不触碰 FR-0048 suite 的 official Chrome、XHS、Syvert、generic provider governance、纯文档事项。
- #1212 的只读 audit planning 可以并行准备，但不能完成 closeout，直到本 guard 被合入或 scheduler 明确冻结可消费版本。

串行 / 依赖：

- 本 FR 依赖 FR-0033、FR-0040 与 FR-0041。
- CloakBrowser provider adapter、descriptor、health doctor、provider-specific launcher、release packaging audit 必须等待本 FR spec review 通过或消费 scheduler 明确冻结版本。
- #1212 release audit closeout 必须消费本 guard 的 no bundled binary、license acknowledgement、binary source evidence 与 redaction fail-closed rules。

## 进入实现前条件

- FR-0048 spec review 通过。
- reviewer 确认 no bundled redistribution 与 operator-installed binary model 无歧义。
- reviewer 确认 license acknowledgement 不被误读为 WebEnvoy binary redistribution permission。
- reviewer 确认 binary source evidence 消费 FR-0040 / FR-0041，不泄露 raw path、credential、license key 或 binary payload。
- reviewer 确认 #1212 只能消费本 guard，不重定义 license / binary ownership model。
- 后续 implementation / audit issue 明确 owner、target files、evidence source、redaction policy、release gate 和验证策略。
