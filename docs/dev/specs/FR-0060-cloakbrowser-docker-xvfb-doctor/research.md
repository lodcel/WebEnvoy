# FR-0060 Research Notes

## 证据输入

本 FR 只基于仓库内已冻结的 formal inputs 与 #1157 issue scope 起草：

- `#1157 Docker / Xvfb Doctor`
- `FR-0038 Provider Health / Doctor Contract`
- `FR-0049 cloakbrowser.direct Descriptor`
- `FR-0050 cloakbrowser.persistent Descriptor`
- `FR-0051 cloakbrowser.cloakserve Descriptor`
- `FR-0058 CloakBrowser Final Args Evidence`
- `FR-0059 CloakBrowser Fingerprint Seed Evidence Policy`

未执行 external Docker、Xvfb、browser、profile、account、live page 或 provider adapter probe。

## 判断

Docker / Xvfb doctor 应当被建模为 environment/admission doctor，而不是 capability 或 runtime proof。

原因：

- Binary、X server、DISPLAY 与 font readiness 都只能证明本地环境前置。
- Headed route 是否可进入 launch attempt，与 browser process 是否启动、args 是否 honored、target tab 是否存在是不同 gate。
- Font readiness 对 headed rendering 有诊断价值，但不能证明真实页面渲染正确或 anti-detection 通过。
- Diagnostic output 的价值是定位 blocker 和支撑 fail-closed，不是替代 live evidence。

## 触发补齐文件的理由

- `contracts/`：本 FR 定义 provider-specific machine-consumable doctor object，属于稳定共享诊断 surface。
- `data-model.md`：本 FR 引入 environment admission lifecycle、check aggregation 和 redaction consumption model。
- `research.md`：Docker / Xvfb 与 headed/headless 边界容易被误作 runtime/live proof，需要冻结证据判断来源。
- `risks.md`：该 scope 涉及 diagnostic output、env/path redaction、headless/headed policy 与后续 gate bypass 风险。

## 当前未决项

无需要外部 probe 才能冻结的 formal scope 未决项。

后续 implementation issue 仍需独立决定：

- 具体 probe command。
- Xvfb spawn / lifecycle / cleanup policy。
- Docker image / entrypoint / package installation。
- Font package baseline。
- Artifact writer 与 stdout schema。
- Parser / validator tests。
