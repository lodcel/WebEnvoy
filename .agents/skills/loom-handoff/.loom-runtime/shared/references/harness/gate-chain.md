# Gate Chain

本文件冻结 Loom strong governance 默认使用的强前置消费链。

## 1. 目标

`review gate`、`merge gate`、`GitHub controlled merge`、`closeout` 不是并列的独立检查点。
它们必须沿同一条前序链消费上游结论，缺任一前序都要 fail-closed。

## 2. 稳定顺序

默认顺序固定为：

- `Work Item admission`
- `spec gate`（仅 formal spec 路径必需）
- `build gate`
- `review gate`
- `merge gate`
- `GitHub controlled merge`
- `closeout`

## 3. 每层必需消费

### 3.1 `Work Item admission`

必须证明：

- 当前执行入口是合法 `Work Item`
- `Work Item` 身份、范围、执行路径、恢复入口可读取
- host binding 已绑定到同一事项

### 3.2 `spec gate`

formal spec 路径上必须证明：

- 上位 `FR` 已存在
- formal spec 已冻结到可审查版本
- `spec_review` 为 `approved`
- 未出现 `spec_stale`

### 3.3 `build gate`

必须消费：

- `Work Item admission`
- formal spec 路径上的 `spec gate`
- 当前 `head_sha`
- 当前验证摘要
- 当前实现仍在已批准范围内

### 3.4 `review gate`

必须消费：

- `build gate`
- 当前 `head_sha`
- 当前验证摘要
- 单一 review record

### 3.5 `merge gate`

必须消费：

- `review gate`
- host binding 中的 `head_sha` / PR / branch 关系
- 最新验证摘要与运行证据
- 未出现 `review_stale`、`head_drift` 或 `missing_prerequisite_gate`

### 3.6 `GitHub controlled merge`

必须消费：

- `merge gate`
- 宿主 required checks
- branch protection / merge policy
- merge method 是否符合当前 profile

### 3.7 `closeout`

必须消费：

- `GitHub controlled merge` 已成功
- merge commit 与目标主干已可定位
- `reconciliation audit` 结果
- issue / parent / project 收口 basis

## 4. fail-closed 纪律

任一层都必须遵守：

- 不得跳过前序直接放行
- 不得拿后序成功覆盖前序缺失
- 不得把前序缺失伪装成局部 warning

稳定回退方向：

- 缺 `Work Item admission`
  - 回到执行入口 authoring / binding 修复
- 缺 `spec gate`
  - 回到 formal spec / `spec_review`
- 缺 `build gate`
  - 回到范围收敛、验证或恢复回写
- 缺 `review gate`
  - 回到 review 执行层
- 缺 `merge gate`
  - 回到 build / review / validation 收口
- 缺 `GitHub controlled merge`
  - 回到宿主 gate 或 `merge gate`
- 缺 `closeout`
  - 回到 `reconciliation sync` 或 merge basis 修复

## 5. closeout basis 回链要求

进入 `closeout` 时，至少要能回链整条链：

- 当前 `Work Item`
- 上位 `FR`（若存在）
- `spec_review` 记录
- implementation review 记录
- `merge gate` 结论
- PR
- merge commit
- `reconciliation audit` 结果

若任何一环无法回链，结果必须是 `block`，而不是“先 close 再补”。

## 6. 非目标

- 不要求所有仓库都用相同文件名
- 不把每个 gate 的具体实现脚本写死在本文件
- 不允许把 guardian、CI 或 reviewer 任一者单独提升为整条链的唯一代言人
