# Workspace Model

本文件定义 Loom 当前最小工作现场模型。

本文件当前承接：

- `EXT-0025`
- `EXT-0012`
- `EXT-0037` 的 clean state 部分

## 1. 能力定位

工作现场用于承接正式执行，而不是临时试探。

它负责：

- 为单一正式事项提供隔离现场
- 为恢复动作提供可定位目标
- 为该事项消费的 host branch / `git worktree` / PR 绑定提供执行侧锚点
- 为初始化后的 clean state 提供承载边界

## 2. 最小现场规则

正式执行链路默认使用隔离工作现场，并满足：

- 单现场单事项
- 同一现场只服务一个主要目标
- 恢复动作应能回到同一现场
- 新事项不得默认复用脏现场继续推进

现场标识可以参数化，但必须由稳定输入确定性生成，不能只依赖人工记忆。

## 3. clean state 要求

初始化或现场创建完成后，应处于可继续执行的 clean state。

最小要求：

- 现场与目标事项已明确绑定
- 进入执行所需的初始工件已经落位
- 当前现场不存在未分流的无关正式改动
- 后续恢复不需要重新猜测应进入哪个现场

## 4. 边界约束

Loom 只固化现场隔离、单事项和可恢复定位。
必要时，Loom 会读取 `Work Item` 与 host issue / branch / `git worktree` / PR 的绑定来校验现场是否仍服务同一事项。

Loom 当前不固化：

- 具体目录命名格式
- 是否必须使用 worktree
- 具体命令、脚本或平台命名约定

branch、PR 与 git worktree 的宿主边界见 [host-lifecycle-boundary.md](./host-lifecycle-boundary.md)。
host issue 绑定消费见 [host-issue-binding.md](./host-issue-binding.md)。
