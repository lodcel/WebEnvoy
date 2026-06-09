# FR-0050 Risks

## 风险 1：descriptor 被误用为 runtime ready

- 风险：consumer 看到 `cloakbrowser.persistent` descriptor 后，直接把 provider 当作可执行业务命令。
- 缓解：spec、contract 与 limitation refs 明确 `persistent_no_descriptor_level_health_pass`、`persistent_no_descriptor_level_runtime_readiness` 和 `persistent_no_latest_head_live_evidence`。
- 回滚：若 review 发现 readiness 语义泄漏，删除对应措辞，改为 health / runtime owner reference。

## 风险 2：CloakBrowser private patch schema 污染 core contract

- 风险：为了描述 CloakBrowser managed route，把 stealth patch、browser patch 参数或 driver state 写成 WebEnvoy core descriptor。
- 缓解：只允许 `persistent_provider_private_patch_required` limitation 和 `provider_private_patch_presence_ref`，不得展开字段。
- 回滚：移除 private schema 细节，只保留 opaque ref 与 downstream owner。

## 风险 3：与 #1146 direct descriptor 混写

- 风险：persistent descriptor 顺手定义 direct launch args、extension path handling 或 final args evidence limits。
- 缓解：spec 单独列出 direct 差异边界，并把 direct launch / final args evidence 指回 #1146。
- 回滚：删除 direct 行为定义，只保留 sibling boundary reference。

## 风险 4：health result schema 提前落入 descriptor

- 风险：health requirement inputs 被写成 doctor report payload 或 pass/fail schema。
- 缓解：所有 health result carrier 指向 FR-0038；本 FR 只列 required inputs。
- 回滚：将具体 check result 字段迁出本 suite，交给后续 health issue。

## 风险 5：敏感 locator 或 secret 泄漏

- 风险：profile/workspace/extension/broker locator 示例泄漏 raw path、license key、账号凭据、cookie、token 或 provider secret。
- 缓解：data model 强制 redacted / opaque / report-local locator；contract 禁止 secret inline。
- 回滚：删除具体 locator 示例，使用 abstract ref。

## 风险 6：#1149 capability matrix 输入不足

- 风险：descriptor 过窄，#1149 无法判断 persistent variant 需要哪些 static inputs。
- 缓解：显式提供 identity、mode、engine、transport、profile、extension workflow、health requirement inputs、capability refs、limitation refs 与 evidence slots。
- 回滚：只补充 reference slots 和 owner，不补 capability support rows。
