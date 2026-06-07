# FR-0042 风险与缓解

## 风险 1：common shape 被后续 persistent descriptor 重写

- 表现：#1138 重新定义 identity、mode、engine、transport、profile semantics、capability refs、limitation refs 或 evidence slots。
- 影响：direct/persistent descriptor 分裂，#1139 capability matrix 无法稳定消费。
- 缓解：本 suite 固定 `common_shape_owner=#1137`，并在 GWT 中要求 persistent issue 只能添加 persistent-specific delta。

## 风险 2：direct descriptor 被误读为 runtime ready

- 表现：后续 selection 或 runtime admission 看到 `official-chrome.direct` descriptor 后直接允许运行业务命令。
- 影响：绕过 FR-0033/FR-0036/FR-0035/FR-0038 和 runtime evidence 门禁。
- 缓解：spec 明确 descriptor 不是 runtime status、health result 或 launch evidence；registry alignment 要求继续消费基础 contract、registry、capability、health 或 evidence owner。

## 风险 3：capability matrix 语义提前混入 #1137

- 表现：#1137 中写入 direct variant 支持哪些 action/layer、verification threshold 或 coverage matrix。
- 影响：#1139 owner 被架空，FR-0035 的 verification model 被绕过。
- 缓解：本 suite 只允许 `capability_declaration_refs`，并把 support matrix 明确列为 out of scope。

## 风险 4：persistent-specific delta 被写成 direct limitation

- 表现：direct descriptor 定义 extension id、native host id、persistent profile path、service worker freshness 或 account safety health schema。
- 影响：#1138 与 health issues 的 ownership 混乱。
- 缓解：direct limitation refs 只表达 direct 不承诺这些能力，不定义 persistent 行为或负面 schema。

## 风险 5：evidence slots 被误当作 fresh evidence

- 表现：PR body 或后续 gate 把 `launch_evidence_ref` slot 解释为本 PR 已生成 launch evidence。
- 影响：虚假通过 live evidence / launch evidence gate。
- 缓解：本 suite 明确 slots 只是未来引用位置，#1137 不要求 fresh live evidence，`launch_evidence_ref` 由 #1143 填充。

## 风险 6：direct profile semantics 被误读为登录态可复用

- 表现：后续实现依赖 direct variant 恢复用户长期登录态或跨 run profile。
- 影响：账号、安全、稳定性与关闭语义被错误扩大。
- 缓解：profile semantics 固定为 `ephemeral_direct_profile`、`not_guaranteed`、`not_promised`，并将 persistent delta owner 指向 #1138。

## 风险 7：文档 PR 混入 runtime 或 fixtures

- 表现：本 PR 同时修改 src/tests/fixtures 或产生 launch artifact。
- 影响：PR scope 从 descriptor contract 扩张到实现或证据 gate。
- 缓解：PR 纯度只允许 FR-0042 suite 与 sync map；验证执行 docs guard、spec guard、map validation、diff check 和 purity check。
