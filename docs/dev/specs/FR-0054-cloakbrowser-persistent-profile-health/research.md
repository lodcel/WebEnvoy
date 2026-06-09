# FR-0054 Research

## 正式输入

### FR-0038 Provider Health / Doctor Contract

结论：

- `provider_doctor_report` 是共享 doctor/health carrier。
- health categories 已包含 `extension_load`、`native_messaging`、`profile_persistence` 与 `capability_readiness`。
- doctor pass 最高只能推进到 `doctor_checked`，不得证明 runtime ready 或 live evidence ready。

对 FR-0054 的影响：

- 本 FR 不新增 parallel doctor object，而是定义 CloakBrowser persistent-specific health signal surface。
- `health_verification_level` 最高只能到 `health_checked`。
- required check 缺失、unknown、fail 或 evidence redaction invalid 时必须 fail-closed。

### FR-0050 cloakbrowser.persistent Descriptor

结论：

- `cloakbrowser.persistent` 必须使用 managed persistent profile、extension workflow binding、native messaging 与 provider broker attachment。
- descriptor 只声明 required refs 与 limitation，不定义 health result 或 runtime ready。
- persistent route 不得用 direct launch / official Chrome fallback 替代。

对 FR-0054 的影响：

- profile、extension、native messaging refs 必须从 FR-0050 descriptor inputs 或后续正式 owner 消费。
- profile binding / extension workflow health 是 persistent route 的 required admission signal。
- descriptor existence 不能被误当成 health pass。

### FR-0058 CloakBrowser Final Args Evidence

结论：

- evidence 必须保留 provenance、freshness 与 non-proof 语义。
- reconstructed / historical / unknown evidence 不能满足 current-run required evidence。

对 FR-0054 的影响：

- 本 FR 对 health signal 引入 per-signal freshness，不用 record `generated_at` 替代采集时间。
- historical artifact 只能作背景，不能满足 current required persistent health。

### FR-0059 Fingerprint Seed Evidence Policy

结论：

- seed、private patch 与 provider internals 必须保持 redacted / provider-private boundary。
- policy-approved hash 或 ref 也不能替代 runtime / anti-detection proof。

对 FR-0054 的影响：

- profile / extension / native messaging evidence 不得泄露 fingerprint seed、private patch payload、driver internals 或 account-affine secret。
- health pass 不证明 anti-detection pass 或 account safety。

## 方案取舍

### 取舍 1：使用 FR-0038 doctor carrier，而不是新增独立 doctor result

- 选择：FR-0054 定义 provider-specific health surface，继续引用 `FR-0038.provider_doctor_report`。
- 理由：避免 shared provider health contract 分裂，保持 capability / runtime / selection owner 有统一 fail-closed 入口。
- 代价：后续 implementation 需要把 FR-0038 generic checks 映射到 FR-0054 persistent-specific signals。

### 取舍 2：把 extension load 与 Native Messaging round-trip 分开

- 选择：本 FR 只证明 extension/native messaging surface readiness，不证明 command 或 round-trip success。
- 理由：load / manifest / allowed origin 可作为准入证据，但 command success 依赖 runtime bootstrap、target tab 与 message path。
- 代价：后续 runtime owner 需要额外 gate，不能只靠 health pass 放行。

### 取舍 3：per-signal freshness 而非 record-level freshness

- 选择：每个 required signal 都必须绑定 freshness。
- 理由：profile lock、extension load、Native Messaging manifest 的采集时间和 stale 风险不同，不能由单个 `generated_at` 代表。
- 代价：artifact shape 更细，但能避免旧 evidence 被误用为 current health。

### 取舍 4：不定义 service worker freshness contract

- 选择：只保留 `service_worker_freshness_ref`。
- 理由：service worker freshness 已有独立 health lane 归属；本 FR 只需要引用，不应混写相邻 suite。
- 代价：persistent extension health 的完整 runtime command proof 需要等待下游 owner。

## 未决输入

- 具体 health command 名称、CLI 参数、artifact 存储路径与 parser 实现由后续 implementation issue 冻结。
- profile lock 机制的实现级状态机由 runtime/profile owner 冻结。
- service worker freshness、Native Messaging round-trip 与 target tab binding 由各自后续 owner 冻结。

## Go / No-Go 判断

Go：

- FR-0038 与 FR-0050 已提供足够正式输入。
- 本 FR 可以在不触碰 runtime code 的前提下冻结 persistent health contract。

No-Go 条件：

- 如果 review 要求本 FR 证明 command success、runtime bootstrap、live evidence 或 account safety，应拆给后续 runtime/live/account owner，不在 FR-0054 内扩 scope。
