# FR-0049 风险与缓解

## 风险 1：CloakBrowser 被误写成 WebEnvoy core

- 表现：descriptor 将 CloakBrowser 设为默认 provider、official Chrome 替代主路径或 WebEnvoy core runtime。
- 影响：破坏 `#1114` 边界，后续 selection / capability matrix 可能绕过 opt-in 与 evidence gates。
- 缓解：本 suite 固定 `provider_family=managed_browser_provider`、`distribution_channel=external_adapter`，并把 `cloakbrowser_as_core` 写入 out-of-scope。

## 风险 2：extension path 泄露本机敏感路径或 secret

- 表现：descriptor、PR metadata 或 future fixture 内联 full local path、run/session secret、token、Cookie、proxy credential 或 extension private content。
- 影响：泄露用户环境信息，污染 future evidence / fixture carrier。
- 缓解：本 suite 固定 extension paths 只能来自 `FR-0037.launch_envelope.runtime_bindings.extension_paths`，且只允许 `redacted_locator_only`。

## 风险 3：final args evidence 被误当作 runtime ready

- 表现：redacted final args snapshot 被解释为 browser honored args、health pass、runtime attestation、anti-detection pass 或 live evidence。
- 影响：#1149 或后续 admission 可能错误放行业务执行。
- 缓解：本 suite 固定 `proves=launch_input_shape_only`，并列出 `does_not_prove` 边界；需要当前 evidence 时必须等待后续 launch evidence owner。

## 风险 4：provider private patch schema 渗入 core contract

- 表现：descriptor 展开 CloakBrowser stealth parameter、fingerprint seed values、driver internal state 或 private patch payload。
- 影响：WebEnvoy core contract 被外部 provider 私有实现污染，后续无法稳定演进。
- 缓解：本 suite 只允许 `provider_private_ref_only` 和 redacted locator，明确 private patch schema out of scope。

## 风险 5：capability matrix 语义提前混入 #1146

- 表现：#1146 中写入 direct variant 支持哪些 action/layer、support level 或 verification threshold。
- 影响：#1149 owner 被架空，FR-0035 verification model 被绕过。
- 缓解：本 suite 只提供 `capability_declaration_refs`，将 matrix owner 固定为 #1149。

## 风险 6：persistent / cloakserve owner 被抢占

- 表现：direct descriptor 中出现 persistent profile lock、Native Messaging readiness、cloakserve broker protocol 或 service health fields。
- 影响：#1147 / #1148 无法独立冻结 variant delta，#1149 消费输入混乱。
- 缓解：本 suite 将 persistent / cloakserve delta 写入 out-of-scope，并在异常场景中将其判定为 scope violation。

## 风险 7：PR 纯度或 sync map 被阻断

- 表现：新增 formal suite 未获得 `.github/spec-issue-sync-map.yml` 修改授权，导致 `spec-guard` 或 sync map validation 无法通过。
- 影响：PR 可能停在 pr-ready blocker，而不是 scheduler gate-ready。
- 缓解：worker 只在授权范围内写入 FR-0049 suite；若 map 修改未授权，回报 scheduler decision / blocker。获授权后只添加 #1146 对应映射，不触碰 workflow、scripts 或其他治理文件。
