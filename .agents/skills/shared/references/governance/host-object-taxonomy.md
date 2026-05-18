# Host Object Taxonomy

本文件定义 Loom `v0.3.0` 当前稳定的宿主对象 taxonomy 与合同命名。

本文件当前承接：

- `#153`

## 1. 文档定位

本文件回答：

- Loom 当前识别哪些对象类型
- 各类对象在 Loom 中如何命名
- 哪些名称可以直接进入稳定合同

对象的真相分层由 [truth-and-sync-boundary.md](./truth-and-sync-boundary.md) 承接。
对象的生命周期边界由 [../harness/host-lifecycle-boundary.md](../harness/host-lifecycle-boundary.md) 承接。

## 2. 四类对象

Loom 当前固定四类对象：

- execution objects
  - Loom 自己直接消费的执行对象
- host control objects
  - 宿主平台提供的控制面对象
- derived objects
  - Loom 汇总得到的派生对象
- evidence objects
  - Loom 消费但不默认 authored 的证据对象

## 3. Execution Objects

进入 execution objects 的对象：

- `Work Item`
- recovery 主入口
- review record
- `workspace`

命名要求：

- 使用 Loom 语义名，不直接套宿主 UI 名称
- 能区分静态真相、动态真相、审查真相与执行现场

## 4. Host Control Objects

进入 host control objects 的对象：

- issue
- project item
- PR
- branch
- `git worktree`
- branch protection / ruleset / required checks

命名要求：

- 优先使用宿主通用名
- 在合同里明确写成 `host` 对象，而不是误写成 Loom 自己拥有生命周期

例如：

- `execution-bound issue`
  - 指当前与 `Work Item` 对齐的宿主 issue，而不是 `Work Item` 本身
- `host merge`
  - 指宿主平台真正执行的 merge
- `host branch`
  - 指 Git branch，而不是 Loom 现场
- `host PR`
  - 指 GitHub PR，而不是 review record

## 5. Derived Objects

进入 derived objects 的对象：

- status control plane
- merge-ready 摘要
- closeout 摘要
- route / resume / handoff 摘要

命名要求：

- 明确写成 `summary`、`surface`、`snapshot` 或 `result`
- 不得让名称看起来像 authored 主真相

## 6. Evidence Objects

进入 evidence objects 的对象：

- CI run
- check run / workflow run
- guardian 输出
- reviewer 评论
- 日志、trace、诊断信息

命名要求：

- 保留其宿主来源属性
- 不得把 evidence 命名成 record truth

例如：

- `review record`
  - 是真相对象，内部承接正式 review 的 findings / rebuttal / disposition contract
- `review comments`
  - 是证据对象

## 7. 稳定命名规则

Loom 当前固定以下命名规则：

- `workspace`
  - 只表示 Loom 执行现场，不等于 `git worktree`
- `git worktree`
  - 只表示 Git 宿主对象
- issue activation
  - 只表示宿主 issue 已进入当前执行控制面，不等于 `work-item --activate`
- `review record`
  - 只表示正式 review 真相，包含同一载体内的 findings / rebuttal / disposition authored 字段
- `PR`
  - 只表示宿主实现载体
- `merge-ready`
  - 只表示 Loom 的放行前状态，不等于 host merge
- `closeout`
  - 只表示进入主干后的收口阶段，不等于 merge

## 8. 合同命名约束

在稳定合同中：

- 若对象由 Loom authored
  - 使用 Loom 语义名
- 若对象由宿主平台拥有
  - 保留宿主名，并在语义上标明其是 host object
- 若对象只是汇总
  - 名称必须包含 `summary`、`surface`、`snapshot` 或等价词

不允许：

- 用 `workspace` 指代 `git worktree`
- 用 `review` 指代 PR approval、review record、review comments 三种不同对象
- 用 `merge` 同时指 merge-ready、host merge 与 closeout

## 9. 一句话结论

taxonomy 的目标不是造新术语，而是保证 Loom、GitHub、Git、review engine 和执行入口在讨论同一对象时不再混用名字。
