# FR-0048 Research

## 研究目标

本 research 只冻结 #1145 license / binary guard 的输入依据与边界判断，供 spec review 判断本 FR 是否足够支撑后续 #1212 License / Binary Packaging Audit。

本文件不做第三方法律结论，不复制 CloakBrowser license text，不验证 vendor account，不下载或检查 CloakBrowser binary。

## 输入依据

### #1145 live issue

Issue #1145 声明：

- Scope：Prevent bundled redistribution of CloakBrowser binary; record operator-installed binary, license acknowledgement and binary source evidence.
- Depends on：none.
- Boundary：不得扩展到 Syvert normalized result、CloakBrowser-as-core、browser patching、default live_write commit 或 unrelated #835 recovery work。
- Parallel lane comment：本 issue 可作为 M10 CloakBrowser lane 先行入口；建议 PR 形态是独立 docs/spec/license-guard PR，不夹带 descriptor、health、XHS、Syvert 或 official-chrome 改动。

结论：本 FR 应独立冻结 license / binary redistribution guard，而不是等待 descriptor / health / runtime 实现。

### #1212 live issue

Issue #1212 声明：

- Scope：Release gate ensuring no bundled CloakBrowser binary and correct license/binary source evidence.
- Depends on：CloakBrowser License Guard.
- Boundary：closeout issue 只验证自己的 release gate，不引入 implementation scope。

结论：#1212 应消费本 FR 的 no bundled binary、license acknowledgement、binary source evidence 与 redaction fail-closed 规则；#1212 不应重新定义 ownership model。

### FR-0033 Browser Provider Contract

FR-0033 已冻结：

- CloakBrowser / managed browser provider 可以作为 provider family / private provider limitation 被表达。
- CloakBrowser 私有 patch、driver state、stealth 参数或 browser patch schema 不进入 WebEnvoy core contract。
- Provider private patch requirement 只能作为 limitation，不得展开为 core schema。

结论：本 FR 只能引用 CloakBrowser managed provider / private limitation，不得定义 provider adapter、patch schema 或 runtime behavior。

### FR-0040 Provider Evidence Kernel

FR-0040 已冻结：

- provider evidence refs、freshness、provenance、artifact identity、blocking reason 与 closeout plan 的基础语义。
- binary / version / profile / launch / native messaging 等 evidence 应通过 refs 和 redaction policy 表达，不应内联 secret 或 raw private path。

结论：本 FR 的 binary source evidence 应消费 FR-0040 evidence ref / freshness / artifact identity，不新增 runtime evidence kernel。

### FR-0041 Evidence Redaction Policy

FR-0041 已冻结：

- binary locator、profile locator、private absolute path 默认至少为 `sensitive`。
- token、Cookie、auth header、license-like credential、download credential、provider private payload 默认按 secret 处理。
- PR body、stdout summary、fixture、public artifact 与 spec sample 不得出现 raw private path 或 secret。

结论：本 FR 的 operator binary locator、binary source ref、license acknowledgement ref 和 vendor account / download material 必须使用 redacted locator、opaque handle、hash locator 或 secret handle。

## 方案判断

### 1. 为什么选择 operator-installed binary

WebEnvoy 的仓库和 release artifact 不应承担 CloakBrowser binary 的下载、托管、镜像、缓存、vendor、repack 或再分发职责。operator-installed binary 模型把安装、授权、升级、保管和卸载责任留在 operator 环境中，并允许 WebEnvoy 通过 redacted locator / evidence ref 消费该事实。

### 2. 为什么 acknowledgement 不等于 redistribution permission

License acknowledgement 只证明 operator 对目标用途的许可责任已有确认。它不改变 WebEnvoy repository / release artifact 的 redistribution policy，也不授予 WebEnvoy 保存 binary payload 的权限。

### 3. 为什么 #1212 只能消费不能重定义

#1212 是 closeout / audit issue。若 closeout 中发现本 FR 未覆盖的新 license 或 packaging 风险，应停在 blocker 或拆出 formal spec 修订，而不是在 closeout PR 中临场放宽 guard。

## 未决事项

- 本 FR 不判断 CloakBrowser vendor license 的具体法律条款；法律 / vendor account 事实必须由 operator acknowledgement、legal review ref 或 vendor account ref 承载。
- 本 FR 不定义 CloakBrowser provider descriptor、doctor、selection、runtime adapter 或 binary discovery implementation。
- 本 FR 不定义 #1212 repository / release artifact scanner 的具体实现；只定义它必须消费的 guard evidence 与阻断口径。
