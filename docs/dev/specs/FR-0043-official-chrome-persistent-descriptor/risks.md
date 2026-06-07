# FR-0043 风险与缓解

## 风险 1：persistent descriptor 重写 common shape

- 表现：#1138 重新定义 identity、mode、engine、transport、capability refs、limitation refs 或 evidence slots 的 common 字段职责。
- 影响：`official-chrome.direct` 与 `official-chrome.persistent` 不能被 #1139 稳定消费。
- 缓解：本 suite 固定 `common_shape_owner=#1137`，并把本 FR 定义为 persistent-specific delta。

## 风险 2：descriptor refs 被误读为 runtime ready

- 表现：后续 selection 或 launch 看到 profile / extension / native messaging refs 后直接放行业务命令。
- 影响：绕过 FR-0033/FR-0036/FR-0038/FR-0040/FR-0041 与 runtime evidence 门禁。
- 缓解：spec 明确 refs 不是 ready/pass evidence，limitation refs 增加 `persistent_no_descriptor_level_runtime_readiness`。

## 风险 3：health schema 混入 descriptor

- 表现：本 FR 定义 service worker、native bridge、profile lock 或 native host health payload。
- 影响：M3-C health owner 与 FR-0038 被架空。
- 缓解：只保留 readiness refs；health result schema 明确 out of scope。

## 风险 4：launch evidence 或 redaction shape 提前定义

- 表现：本 FR 定义 launch artifact、runtime attestation、redaction policy 或 latest-head evidence record。
- 影响：#1143、FR-0040、FR-0041 的 ownership 混乱，PR gate 可能误消费历史或伪 evidence。
- 缓解：evidence slots 只作为未来引用位置，本 PR 明确 `live_evidence_record: N/A`。

## 风险 5：profile identity 泄露 secret 或敏感本机路径

- 表现：descriptor 内联 cookie、token、账号凭据、完整敏感本机路径或 native host secret。
- 影响：文档契约污染安全边界，后续 fixtures / PR body 可能泄露真实账号或环境。
- 缓解：`PersistentProfileReference.sensitivity=non_secret_locator`，并强制 `must_not_inline_credentials/cookies/sensitive_absolute_path`。

## 风险 6：extension installation 方案被提前冻结

- 表现：本 FR 把 Chrome Web Store、external extension JSON、developer mode unpacked 或其他分发方式写成当前正式方案。
- 影响：安装/分发 owner 被绕过，可能与 FR-0015 official Chrome 主路径冲突。
- 缓解：本 suite 只冻结 extension binding refs，不冻结 installation procedure。

## 风险 7：文档 PR 混入 runtime 或 fixtures

- 表现：本 PR 同时修改 src/tests/fixtures、extension/native host 或产生 runtime artifact。
- 影响：PR scope 从 descriptor contract 扩张到实现或 evidence gate。
- 缓解：PR 纯度只允许 FR-0043 suite 与 sync map；验证执行 docs guard、spec guard、map validation、assert-mapped、diff check 和 purity check。
