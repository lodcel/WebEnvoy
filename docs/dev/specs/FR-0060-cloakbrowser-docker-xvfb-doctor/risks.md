# FR-0060 Risks

## 风险 1：把 environment doctor pass 误报为 runtime / live success

- 影响：provider selection、capability allow 或 PR closeout 可能提前放行。
- 缓解：`admission_verification_level` 最高只能为 `docker_xvfb_doctor_checked`；`next_required_gates` 必须保留 runtime、launch、target tab、live evidence 与 capability matrix。
- 回滚：若后续 consumer 误用，回滚 consumer 逻辑，不修改本 FR 的 non-proof 语义。

## 风险 2：headless-only 环境绕过 CloakBrowser headed policy

- 影响：真实浏览器路线与 live evidence gate 被污染。
- 缓解：`headless_policy` 对 CloakBrowser `headless_policy=forbidden` fail-closed；`headless_requested` 不得满足 real-browser / live evidence。
- 回滚：撤回错误 consumer 或 PR metadata，不接受 headless artifact 作为 headed proof。

## 风险 3：diagnostic output 泄露环境、路径或凭据

- 影响：PR body、artifact、stdout summary 可能泄露 host path、license、token、cookie、registry credential 或 account identifier。
- 缓解：diagnostic artifact 必须有 `redaction_state`、`sensitivity`、`machine_readable` 与 `contains_required_fields`；redaction invalid 必须 fail-closed。
- 回滚：删除/替换泄露 artifact，必要时执行 secret rotation；后续实现必须补 leak guard。

## 风险 4：font readiness 被误作视觉或反检测证明

- 影响：页面渲染、截图判断或 anti-detection gate 被提前放行。
- 缓解：`font_readiness` 只证明最小 font environment 前置；视觉验证、rendering acceptance 与 anti-detection 必须由各自 owner 证明。
- 回滚：修正 consumer，移除 font readiness 对视觉/live/anti-detection gate 的直接通过语义。

## 风险 5：Docker / Xvfb implementation scope 被塞进 formal spec PR

- 影响：spec review 与 implementation review 混杂，可能绕过高风险脚本 / workflow 门禁。
- 缓解：本 PR 只允许写 FR-0060 suite 与单条 sync-map；不得触碰 scripts、workflow、Docker image、runtime code 或 fixtures。
- 回滚：拆分超范围改动到独立 implementation issue / PR。
