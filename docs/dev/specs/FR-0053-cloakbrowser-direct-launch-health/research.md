# FR-0053 Research Notes

## 研究结论定位

本文件不记录真实 CloakBrowser binary 探测、真实浏览器启动、真实 extension 状态、真实 profile、账号或 live 页面证据。当前 PR 的研究结论只用于说明 FR-0053 的输入来源、未验证未知项和 deferred owner，避免把 formal spec 起草伪装成 runtime validation。

## 已消费的正式输入

### FR-0038 Provider Health / Doctor Contract

可消费结论：

- provider health / doctor report 必须有 identity、input contract ref、checks、outcome 与 evidence refs。
- required check 缺失、unknown、invalid enum 或 redaction invalid 时必须 fail-closed。
- doctor / health 最多推进到 `doctor_checked`，不能证明 `runtime_attested` 或 `live_evidence_attested`。

FR-0053 采用方式：

- 复用 FR-0038 的 binary、version、evidence refs、blocking 与 non-proof 规则。
- 将 direct CloakBrowser 的 local launch health 特化为 `cloakbrowser_direct_launch_health_report`。

### FR-0049 cloakbrowser.direct Descriptor

可消费结论：

- `provider_id=cloakbrowser.direct`，`variant_kind=direct`。
- direct variant 为 `core_managed` / `chromium` / headless forbidden / hybrid transport。
- `native_messaging_support=none`。
- extension path support 是 optional locator input，不证明 stable extension identity。
- final args evidence slot 只证明 launch input shape，不证明 runtime ready 或 health pass。

FR-0053 采用方式：

- 将 `binary_probe`、`environment_probe`、`transport_probe` 与 `optional_extension_probe` 对齐 direct descriptor。
- 明确 Native Messaging 在 direct health 中为 not applicable。
- 保留 ephemeral profile 与 no login state promise 边界，不把 direct health 扩展到 persistent owner。

### FR-0058 CloakBrowser Final Args Evidence

可消费结论：

- final args evidence 可表达 build-time assembled 或 reconstructed args summary。
- final args evidence 只证明 launch input shape / arg presence / variant input boundary。
- historical、unknown、reconstruction unknown、redaction invalid 不能满足 required current-run evidence。

FR-0053 采用方式：

- `launch_args_probe` 必须消费 FR-0058。
- `launch_args_probe=pass` 仍必须保留 `browser_honored_args` 的 negative proof。

### FR-0059 CloakBrowser Fingerprint Seed Evidence Policy

可消费结论：

- raw fingerprint seed 默认 secret。
- seed hash value 不得进入 PR body、stdout summary、fixture 或 spec sample。
- fingerprint seed reproducibility 不证明 seed applied、runtime ready、anti-detection pass 或 live evidence accepted。

FR-0053 采用方式：

- direct launch health 只允许保存 `fingerprint_seed_policy_ref` 或 opaque / redacted seed evidence refs。
- 不记录 raw seed、seed hash value、private patch payload 或 fingerprint internals。

## 未验证未知项

以下未知项没有在本 PR 中探测，也不得写成已验证事实：

- CloakBrowser binary 是否安装、授权、可执行或 launchable。
- CloakBrowser provider-managed browser / adapter 的真实版本。
- Direct launch final args 是否被真实 browser process honor。
- Provider launch control surface、CDP endpoint 或 Playwright attach 是否真实可用。
- Optional extension 是否真实加载、extension id 是否稳定、service worker 是否 fresh。
- Display/headful 环境是否可用于真实账户或真实页面。
- Fingerprint seed 是否被应用、anti-detection baseline 是否通过。

## Deferred owners

- Runtime implementation / doctor command：后续 implementation issue。
- Capability matrix：`#1149` 或后续 scheduler 指派 owner。
- Persistent profile、extension identity、Native Messaging：`#1147` / `#1151` 及对应 health owner。
- Cloakserve broker / service health：`#1148` / 后续 health owner。
- Final args artifact collector：FR-0058 的后续 evidence implementation owner。
- Fingerprint seed evidence validator：FR-0059 的后续 evidence / health owner。
- License / binary packaging audit：FR-0048 / #1212 相关 owner。

## 结论

FR-0053 不需要在本 PR 中执行外部第三方验证或 live probing。它的 formal scope 是把已冻结的 doctor、descriptor、final args、seed policy 输入收敛为 direct launch health/admission evidence contract，并明确所有未验证 runtime/live/capability 事实继续由后续 gate fail-closed 消费。
