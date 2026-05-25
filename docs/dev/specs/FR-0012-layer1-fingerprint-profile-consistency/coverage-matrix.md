# FR-0012 Layer 1 指纹覆盖面与验收矩阵

## 目的

本矩阵用于收口 `#732`，冻结完整 Layer 1 指纹与 profile 一致性能力的覆盖面、优先级、验收口径和后续实现归属。它不声明完整 Layer 1 已经实现；`#235` 的关闭仍取决于 `#733`-`#736` 的实现、验证和 closeout。

## 关闭口径

- `#732` 关闭条件：覆盖面、优先级、验收矩阵和后续 work item 归属已冻结。
- `#235` 关闭条件：本矩阵中标为 P0/P1 的能力完成实现与验证，或形成明确 blocker 并同步 issue 归属；P2 项有明确 deferred/blocker 归属；且 `#736` 完成完整验证基线。
- `#265` 关闭条件：`#235` closeout 完成，或重新拆出明确 blocker 并同步 parent/sub-issue/blocking/Project 关系。

## 优先级定义

| 优先级 | 含义 | Phase 2 closeout 口径 |
| --- | --- | --- |
| P0 | 当前 live/readiness 或 profile 安全会直接依赖的最小必需面 | 必须实现、测试并纳入回归 |
| P1 | 影响常见检测站点与真实浏览器一致性的高价值面 | 应实现或给出明确 blocker |
| P2 | 成本高、依赖真实浏览器/平台能力或容易误伤的补强面 | 可 deferred，但必须记录边界和后续归属 |

## 覆盖矩阵

| 覆盖面 | 优先级 | 稳定字段 / 对象 | 当前基线 | 后续归属 | 最小验收 |
| --- | --- | --- | --- | --- | --- |
| UA 与 Chrome version | P0 | `fingerprint_profile_bundle.ua`、`fingerprint_patch_manifest.field_dependencies` | 已有 bundle 构造与启动传递 | `#735` | official Chrome 启动、extension bootstrap、runtime 返回的 UA 口径一致；环境失配 fail-closed |
| profile 环境绑定 | P0 | `fingerprint_profile_bundle.environment`、`fingerprint_consistency_check` | 已有环境 mismatch 阻断与 legacy migration 口径 | `#734` | `os_family/os_version/arch` 不匹配时 live 高风险阻断，且 status/audit 暴露结构化原因码 |
| AudioContext | P0 | `audioNoiseSeed`、`required_patches.audio_context` | P0 main-world patch 已有历史最小闭环 | `#733` | main world 与 extension 注入路径使用 profile 级稳定 seed；缺字段不得 live 放行 |
| Battery API | P0 | `battery.level`、`battery.charging`、`required_patches.battery` | P0 main-world patch 已有历史最小闭环 | `#733` | 暴露值来自 profile bundle，且跨 run 稳定 |
| `navigator.plugins` | P0 | `required_patches.navigator_plugins` | P0 main-world patch 已有历史最小闭环 | `#733` | plugins/mimeTypes 互相可解释，不出现空 plugins 与 PDF mime 冲突 |
| `navigator.mimeTypes` | P0 | `required_patches.navigator_mime_types` | P0 main-world patch 已有历史最小闭环 | `#733` | mimeTypes 与 plugin descriptors 一致，且可被 content/main-world contract 测试覆盖 |
| screen color/pixel depth | P1 | `screen.colorDepth`、`screen.pixelDepth`、`optional_patches.screen_*` | 字段与 optional patch 名称已存在 | `#733` | main world 读数与 profile bundle 一致；不得与 window/screen 尺寸组合明显矛盾 |
| hardware concurrency | P1 | `hardwareConcurrency`、`optional_patches.hardware_concurrency` | 字段与 optional patch 名称已存在 | `#733` | `navigator.hardwareConcurrency` 与 profile bundle 一致，缺字段 fail-closed 或降级 |
| device memory / performance memory | P1 | `deviceMemory`、`optional_patches.device_memory`、`optional_patches.performance_memory` | 字段与 optional patch 名称已存在 | `#733` | `navigator.deviceMemory` 与 `performance.memory` 口径可解释，不跨 run 漂移 |
| timezone / locale | P1 | `timezone`、启动环境/locale 参数 | bundle 字段已有，patch 覆盖不足 | `#735` | browser timezone/locale、UA、profile 环境不互相冲突；缺少可控面时必须记录 unsupported reason |
| permissions API | P1 | `optional_patches.permissions_api` | optional patch 名称已存在；语义未冻结 | `#799` deferred | Phase 2 不声明 permissions API patch 完成；不得用固定 `prompt` / `granted` / `denied` 伪装真实 Chrome 权限行为；后续如实现需先冻结允许列表、状态来源与异常语义 |
| navigator connection | P1 | `optional_patches.navigator_connection` | optional patch 名称已存在 | `#735` | network 暴露面与 profile/启动环境不冲突；不可控时记录 `PATCH_NOT_AVAILABLE` |
| WebGL renderer/vendor | P1 | 待追加字段：`webgl.vendor`、`webgl.renderer` | 未冻结字段 | `#801` deferred | Phase 2 不声明 WebGL renderer/vendor patch 完成；不得在实现 PR 中隐式新增字段；后续如实现需先冻结 bundle 字段、来源与验收 |
| Canvas seed | P1 | `canvasNoiseSeed` | bundle 字段已有，patch 覆盖不足 | `#733` | canvas 噪声 profile 级稳定；不得 run 级随机 |
| fonts | P2 | 待追加字段：`fonts.profile` 或等价稳定枚举 | 未冻结字段 | 后续 blocker/deferred | 不在 Phase 2 中伪装完整覆盖；如实现需先 spec review |
| media devices | P2 | 待追加字段：device label/count policy | 未冻结字段 | 后续 blocker/deferred | 只允许保守空值或真实浏览器一致值；不得生成不可信虚假设备 |
| WebRTC / local network 暴露 | P2 | 启动参数、profile/network policy | 未冻结为 FR-0012 正式对象 | `#735` 或后续 blocker | Phase 2 仅审计与阻断明显失配，不承诺完整网络伪装 |
| worker / service worker 指纹面 | P2 | 待定义跨上下文注入策略 | 明确保留盲区 | `#802` deferred | Phase 2 不声明 worker/service-worker 指纹一致性完成；不能把 main-world patch 误报为 worker 覆盖；后续如实现需先冻结跨 worker 注入策略 |

## 后续 work item 归属

| Work item | 消费本矩阵的范围 | 不得越界 |
| --- | --- | --- |
| `#733` | main world、isolated world、iframe、worker/service worker 的指纹一致性实现与测试 | 不得把 P2 worker 盲区误报为完成 |
| `#734` | profile-bound bundle 生命周期、持久化、漂移检测、fail-closed 与审计回传 | 不得跨 profile 复用指纹状态 |
| `#735` | official Chrome 启动参数、extension/profile identity、UA/client hints、locale/timezone、WebRTC/network 暴露面一致性审计 | 不改变 FR-0015 runtime 主方案 |
| `#736` | 自动化验证基线、fixtures、可选 real-browser 验证和回归门禁 | 不以历史 minimum slice 替代完整覆盖基线 |

## 验证矩阵

| 验证层 | 必须覆盖 | 可选/延后 |
| --- | --- | --- |
| 单元测试 | bundle 生成/读取/校验、manifest 构造、字段依赖缺失、环境 mismatch reason code | P2 字段新增前的未冻结对象 |
| contract 测试 | extension bootstrap、service worker/content/main-world 传递、runtime status/start/login/stop 返回结构 | 真实检测站点评分 |
| integration/real-browser | official Chrome 启动与 extension 注入路径、profile 绑定 fail-closed | 仅在 readiness/admission 满足后执行检测站点 |
| closeout 证据 | PR、merge commit、GitHub checks、guardian、命令输出、剩余风险 | 历史 minimum slice 只能作为背景，不可单独关闭完整能力 |

## Phase 2 deferred 口径

| 范围 | Issue | Phase 2 结论 | 后续重新进入条件 |
| --- | --- | --- | --- |
| permissions API | `#799` | deferred；Phase 2 不要求实现 `navigator.permissions.query()` wrapper，不把 `optional_patches.permissions_api` 视为完成覆盖 | 先冻结常见 permission name 允许列表、未知 name 处理、`PermissionStatus.state` 来源、真实 query 透传策略、invalid descriptor / unsupported name 异常语义，以及 required/optional install 行为测试 |
| WebGL renderer/vendor | `#801` | deferred；Phase 2 不要求实现 WebGL renderer/vendor patch，不新增未冻结的 `fingerprint_profile_bundle.webgl.*` 字段 | 先冻结 `webgl.vendor` / `webgl.renderer` 字段结构、真实 Chrome/硬件探测或 profile policy 来源、API 不可用时的 unsupported reason，以及 main world / iframe / isolated world 验收夹具 |
| worker / service worker 指纹面 | `#802` | deferred；Phase 2 只要求验证基线显式标记盲区，不要求实现 dedicated worker、shared worker 或 service worker 指纹补丁 | 先冻结跨 worker 注入策略、作用域、权限、回滚方式、unsupported reason 与验证夹具；不得直接复用 main-world patch 作为 worker 覆盖证据 |

## Stop-ship 条件

- profile 缺少 P0 字段却继续高风险 live。
- `fingerprint_patch_manifest.required_patches` 缺少 P0 patch 仍声明 Layer 1 完整能力通过。
- 环境 mismatch 时没有 fail-closed 或结构化 reason code。
- permissions API 被固定 stub 为 `prompt` / `granted` / `denied` 并声明为可信覆盖，或 #799 的 deferred 口径未在 #733/#265 closeout 中披露。
- main world patch 被误报为 worker/service worker 覆盖，或 #802 的 deferred 盲区未在 #733/#265 closeout 中披露。
- 实现 PR 隐式新增 WebGL/fonts/media/WebRTC 等字段而未先冻结契约，或 #801 的 WebGL deferred 口径未在 #733/#265 closeout 中披露。
