# #1132 Existing CLI Envelope Compatibility 设计说明

## 基本信息

- 关联 Issue：#1132
- 关联 PR：N/A
- 负责人：M2-T3

## 背景

`#1131 Command Envelope v2 Design` 仍处于 open 状态，但仓库已经存在可被 CLI 调用方消费的稳定输出骨架。`#1132` 需要先把当前 CLI 输出面盘点清楚，并定义一层只读兼容桥输入，供后续 envelope v2 设计与实现消费，而不是倒推修改当前 CLI 行为。

本说明仅作为 `#1132` 的 inventory/design note 使用；它可以支撑 `#1132` 本身的完成与关闭，但不冻结 `#1131` 的 v2 contract 字段、字段层级或最终 envelope 形态。

## 目标

- 盘点当前 CLI 成功态与失败态的 canonical 输出骨架
- 明确 `status`、`summary`、`observability`、`error.diagnosis`、`run_id`、`command` 的现状职责
- 定义“future envelope bridge input”的最小映射原则，供 `#1131` 或后续实现项消费

## 非目标

- 不定义 command envelope v2 的最终字段契约
- 不修改现有 CLI 输出行为、字段名或字段层级
- 不把 WebEnvoy CLI 输出重写成 Syvert normalized result
- 不抢跑 `#1133`、`#1134`、`#1135`、`#1136` 的实现或正式契约

## 范围

- 受影响模块 / 文件
  - `src/cli.ts`
  - `src/core/response.ts`
  - `src/runtime/response-shaping.ts`
  - `src/runtime/cli-diagnosis.ts`
  - `src/core/capability-output.ts`
  - 相关 CLI / runtime contract tests
- 受影响命令 / 流程
  - 所有经 `src/cli.ts` 输出 JSONL 的命令
  - 带 `summary` 的成功返回
  - 带 `error.diagnosis` 与 `observability` 的失败返回

## 现状 Inventory

### 1. 当前 CLI 顶层输出骨架

当前 CLI 统一经 `src/core/response.ts` 输出 JSONL。成功态与失败态都保留以下 root 字段：

- `run_id`
- `command`
- `status`
- `timestamp`

其中：

- 成功态固定为 `status="success"`，并带 `summary`
- 失败态固定为 `status="error"`，并带 `error`
- `observability` 由 `src/runtime/response-shaping.ts` 在成功态和失败态统一补齐
- `error.diagnosis` 仅在失败态存在

这意味着当前 CLI 的 canonical root 不是单独的 envelope 对象，而是“根层固定字段 + 按状态分支的 payload”。

### 2. 成功态的现状职责

成功态由 `buildSuccessResponse()` 构造，最低稳定骨架为：

- `run_id`
- `command`
- `status`
- `summary`
- `timestamp`
- `observability`

其中 `summary` 是当前最主要的命令结果承载面，但它不是统一 schema：

- 基础命令可直接放简洁结果摘要
- capability 类命令会通过 `mapCapabilitySummaryForContract()` 约束 `summary.capability_result`
- bridge / runtime 相关命令会把更具体的结果对象保留在 `summary` 内

因此，`summary` 在当前阶段应被视为“命令语义结果面”，而不是未来 envelope 中可直接拆平或泛化的公共根字段集合。

### 3. 失败态的现状职责

失败态由 `buildErrorResponse()` 构造，最低稳定骨架为：

- `run_id`
- `command`
- `status`
- `error`
- `timestamp`
- `observability`

其中 `error` 当前至少承担：

- `code`
- `message`
- `retryable`
- `details`（按需）
- `diagnosis`

`diagnosis` 由 `shapeErrorResponse()` 注入；若命令执行方未显式给出，则由 `diagnosisFromCliError()` 在 CLI 层兜底生成。这说明：

- `error` 仍是 canonical failure container
- `diagnosis` 已经是 failure container 内的稳定子面
- 未来 envelope 不应把 `diagnosis` 从 `error` 中提前抽到新的顶层字段，除非 `#1131` 明确冻结该变化并给出兼容策略

### 4. `observability` 的现状职责

`observability` 由 `shapeSuccessResponse()` / `shapeErrorResponse()` 统一注入，当前职责是：

- 承载页面、请求和失败位置等可观察性信息
- 在成功态与失败态均可出现
- 允许“不可用但结构存在”，例如 `coverage=unavailable`、`page_state=null`、`key_requests=[]`

当前测试也明确要求：

- `observability` 是 CLI 输出的一部分
- canonical `execution_audit` 不应泄漏进 `observability`

因此后续 envelope 设计若要引入 `operational` 或 `evidence`，应优先把它们视为对现有 `observability` 的再分层消费，而不是回写当前 CLI 根结构。

### 5. `run_id` / `command` 的现状职责

`run_id` 与 `command` 当前都是 CLI root identity 字段：

- `run_id` 用于运行追踪、bridge/runtime 绑定和错误回传
- `command` 用于指明本次 CLI 调用命令名

二者已经在成功态、失败态和 bridge 相关测试里被持续依赖，应视为 future envelope bridge 的强输入，而不是待定字段。

## Future Envelope Bridge Input

为避免 `#1132` 越权定义 v2，当前只冻结“从 existing CLI shape 提供给 future envelope 的输入视图”，不冻结未来输出长相：

| existing CLI surface | bridge input meaning | notes |
| --- | --- | --- |
| `run_id` | run identity | 视为 future `run_id` 的直接来源 |
| `command` | command identity | 视为 future `command` 的直接来源 |
| `status` | execution outcome discriminator | 当前只确认 `success` / `error`；不提前扩展 `ok` |
| `summary` | command result payload | 保持命令语义结果面，不提前拆平 |
| `error` | failure payload | 保持 canonical failure container |
| `error.diagnosis` | failure diagnosis payload | 仍隶属 `error`，仅作为 future diagnostics/evidence 的输入 |
| `observability` | operational/evidence candidate input | 允许后续细分，但当前不改 root |
| `timestamp` | response emission time | 保持附属元数据，不强行映射到 v2 核心语义 |

## 方案摘要

- 选择用独立 design note 冻结 inventory，而不是直接改 `docs/dev/specs/`
- 只声明“existing CLI -> future envelope bridge input”的映射原则
- 把 `summary`、`error`、`observability` 明确为当前三块主要语义面，避免后续实现把它们误判成同一层级的 v2 顶层字段

这样做的原因：

- `#1131` 仍 open，v2 字段集与层级尚未正式冻结
- 当前仓库已有可运行 CLI 契约，先盘点事实比先设计理想壳更稳
- 后续 `#1134/#1136` 可以直接消费这份 note 做桥接或兼容测试，不必重新猜当前 canonical 输出面

## 影响面与风险

- 可能影响哪些已有行为
  - 无运行时行为影响；本次只新增设计说明
- 为什么仍属于中等事项，而不是正式 FR / 高风险事项
  - 本次不修改正式共享契约，不改变 CLI 行为，不引入跨仓依赖
  - 产物是现状盘点和 bridge input 说明，作用是降低后续正式 FR / 实现项的歧义

## 验证方式

- 本地验证命令
  - `pnpm test -- --run src/runtime/__tests__/response-shaping.test.ts`
  - `pnpm test -- --run src/core/__tests__/capability-output.test.ts`
  - `pnpm test -- --run src/runtime/native-messaging/__tests__/bridge.test.ts`
- 需要观察的关键结果
  - 当前 CLI root shape 仍保持 `run_id/command/status/timestamp`
  - 成功态继续带 `summary + observability`
  - 失败态继续带 `error.diagnosis + observability`

## 回滚方式

- 若后续发现 `#1131` 已冻结为不兼容方向，直接删除或改写本 note
- 因本次不改代码，回滚仅需移除此文档

## 升级信号

出现以下情况时，应停止按中等事项推进并升级为正式 FR：

- `#1131` 明确要求在本仓库冻结新的 shared envelope root 契约
- 需要修改现有 CLI root 字段、状态枚举或 `summary/error/observability` 层级
- 需要把该兼容桥声明成跨仓共享契约，或引入 integration-gated 验收
