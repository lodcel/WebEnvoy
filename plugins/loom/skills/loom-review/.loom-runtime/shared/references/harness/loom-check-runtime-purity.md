# loom_check Runtime Purity

本文件定义 `loom_check` 的并发隔离与运行现场纯度合同。

本合同承接 #962 P0-A 批次，并作为 #964、#965、#966、#967、#968 的实现和 review 依据。

## 1. 能力定位

`loom_check` 是 Loom source/distribution 仓库与 bootstrapped consumer 仓库的本地验证入口。

它必须验证当前目标，而不是把当前 shell、Codex App 会话、固定临时路径、Node 构建目录或稳定 fixture 当作共享运行现场。

本合同不定义新的 local / CI profile 分层，不替代 #953 的 source self-check 分层，也不扩大 closeout gate、PR metadata 或 review profile 范围。

## 2. Profile 边界

`loom_check.py --profile auto|source|consumer` 的运行现场边界如下：

- `source` profile 检查 Loom source/distribution 仓库，允许消费 source repo 的 checked-in docs、skills surface、installer package 与 demo fixture。
- `consumer` profile 检查 bootstrapped consumer repo，必须只消费 consumer runtime/adoption surface，不得回退到 Loom source self-check。
- `auto` 只负责选择 `source` 或 `consumer`，不得因为宿主环境变量或 live host proof 改变 profile。

所有 profile 都必须设置唯一 `run_id`，并把运行态写入限定在当前 worktree 或本次运行拥有的唯一临时目录。本次运行创建的 `loom-check-*` 临时目录必须在使用结束后及时清理，不得成为后续检查的隐式输入。

## 3. 并发语义

同一 worktree 内的 full `loom_check` 必须 single-flight。

第二个 full check 启动时可以 fail-fast 或 bounded wait，但输出必须包含当前 lock owner 信息，至少包括：

- `run_id`
- `pid`
- `started_at`
- `command`
- `cwd`

stale lock 必须可恢复，不得永久阻断后续检查。stale 判定可以基于 pid 不存在、超时或 lock payload 不可读后的保守恢复策略。

同仓不同 worktree 可以并发执行。任何 lock 或运行态目录都不得使用仓库级全局路径阻断不同 worktree。

跨仓并发可以并行执行。`loom_check` 不得使用固定 `/tmp` 路径、全机器 lock 或当前 Codex App 会话状态作为默认 blocking 输入。

## 4. 允许写入面

默认 `loom_check` 允许写入：

- 当前 worktree 内明确属于运行态的 lock、cache 或生成 staging 目录
- 本次运行创建并拥有的唯一临时目录
- Node/npm 在隔离 cache、临时 package root 或受 lock 保护目录中的构建输出

默认 `loom_check` 不得重写：

- checked-in stable fixture，例如 `examples/new-project`
- authored governance truth，例如 work item、progress、review、status 或 closeout carrier
- 其他 worktree 或其他仓库的运行态目录
- 固定 `/tmp` 负样本路径

需要刷新 stable fixture 时，必须走显式 generate/sync 入口，并在 PR 中把 fixture drift 作为正常变更审查。

## 5. Node Installer Regression

Node installer regression 覆盖 `npm ci`、`npm test`、`npm pack --dry-run`、`dist`、`payload`、`node_modules` 与 npm cache。

这些写入必须满足以下任一策略：

- 在同一 worktree installer regression lock 内串行执行，默认 lock 路径为 package root 下的 `.installer-regression-lock`
- 在临时 package root 中执行，并把结果作为 drift evidence 消费
- 对 payload build 使用覆盖完整 rebuild 窗口的 lock

npm cache 必须使用本次运行唯一 cache。锁等待失败或超时必须输出 owner 信息，包括 `run_id`、`pid`、`started_at`、`command` 与 `cwd`，并给出等待、确认 stale lock 或切换 worktree 的处理路径。payload drift check 仍必须发现真实 drift，不能因为隔离而跳过 release readiness 的确定性验证。

## 6. 宿主环境纯度

`loom_check` 默认 subprocess 环境必须清理只应由专用 fixture 显式传入的宿主变量，包括：

- `CODEX_*`
- `LOOM_CODEX_APP_REVIEW_*`
- `CODEX_CI`
- `CI` 中会改变 review adapter 或 live proof 默认路径的值

保留 `PATH`、`HOME` 与 `gh` keyring 可读性，但不得全局导出 token。

live GitHub、Codex App proof、dynamic tool live smoke 与 host adapter live drift 只能在显式 opt-in 或专用 synthetic fixture 中进入验证。默认 source self-check 不得因为当前 Codex Desktop thread 环境自动切换 review adapter 或 live host proof。

## 7. 回归要求

#968 至少覆盖以下 P0-A 回归：

- 同一 worktree 双 `loom_check` 启动证明 single-flight 行为
- 同仓不同 worktree 并行不共享 worktree-local mutable outputs
- 跨仓或临时 clone 不受固定 `/tmp` 路径影响
- 默认 subprocess 环境不会继承 Codex App / host proof 污染源
- Node installer regression 不互删 `node_modules`、`dist` 或 `payload`
- 默认 `make loom-check` 不让 `examples/new-project` 因检查本身变脏

重型并发矩阵可以作为显式 opt-in validation，但 P0-A 默认回归必须可在本地和 CI 中稳定消费。

默认轻量入口为 `make loom-check-runtime-regression`，并由 `make loom-check` 消费。该入口只验证 fail-fast owner 诊断、worktree-local lock path、默认环境净化、唯一缺失路径、Node installer lock busy 输出和 demo fixture 不变脏；不得在默认 CI 中启动重型 full-check 并发矩阵。
