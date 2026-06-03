# Worker Backend Contract

本文件定义 Loom v0.7 的 worker backend 边界。

## 1. 默认 backend

Loom v0.7 默认只声明 `local` worker backend。

`local` 表示执行发生在当前宿主环境可读的本地现场中。Loom 可以读取 worker evidence、workspace locator、recovery entry 与 execution ledger，但不拥有 worker daemon、队列、run/stop 生命周期或远端调度器。

## 2. Execution Boundary

`run` 与 `stop` 在 Loom core 中只表达 execution-boundary 的读面或事件语义：

- `run` 表示宿主或 agent 已经产生可消费的执行证据
- `stop` 表示宿主或 agent 已经到达可交接、可 checkpoint 或可 retire 的边界

它们不得被解释为 Loom core 自己启动、停止或回收 worker。

## 3. 未来 backend 扩展点

未来 backend 可以替换调用方式，但不得改变以下真相边界：

- Work Item 仍是目标与 locator 入口
- workspace lifecycle 仍只消费 `workspace_entry`
- recovery entry 仍是动态执行事实主入口
- execution ledger 仍绑定 recovery entry 或等价 locator
- cleanup / retire 不删除非 Loom-owned 内容

backend-specific 字段只能作为 adapter evidence 或 profile-local advisory，不得覆盖 core pass/fail 事实。
