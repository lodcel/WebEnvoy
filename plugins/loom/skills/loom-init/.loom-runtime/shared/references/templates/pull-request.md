# Pull Request

本文件定义 Loom 当前最小 PR 模板规则。

本文件当前承接：

- `EXT-0008`
- `EXT-0028`

## 1. PR 模板必须服务判断

PR 模板的目标是提供最小必要事实，不是把作者变成填表机器。

## 2. 基础必填块

Loom 的基础 PR 模板至少应包含：

- 本次改动解决什么问题
- 改动范围是什么
- 如何验证
- 有哪些风险或未决项
- 关联事项是什么

## 3. 条件触发块

PR 模板可以有扩展块，但不应默认强加给所有 PR。

默认要求：

- 只有在当前改动确实涉及对应主题时，才启用额外区块
- 扩展块应围绕特定风险、迁移、回滚、数据变更等主题展开

## 4. Loom 当前约束

Loom 支持结构化 PR 模板，但必须满足：

- 基础模板保持短小
- 条件块按需触发
- 模板内容直接服务 review 与 merge 判断
- repo-specific PR metadata 若会被机器门禁消费，必须由 repo companion 声明 stable machine carrier；PR 模板中的人类摘要不得成为唯一机器读取来源

不允许：

- 用超重模板制造机械性噪音
- 把长期规则真相写死在 PR 模板里
- 让自由 Markdown 标题、列表或自然语言替代 declared machine carrier

## 5. PR metadata machine carrier

当目标仓库声明 `metadata_contract.fields[*].machine_carrier` 时，PR 模板可以展示人类可读摘要，但必须保留 repo companion 声明的 machine carrier。

稳定规则：

- machine carrier 由 repo companion 声明 `schema_version`、`carrier_id`、`surface`、`repo_specific_field_set`、`authority_locator`、`applicability_locator`、`enforcement`、`parser_version` 与 `source_range_or_hash`
- renderer 或 `gh pr edit` 后必须能通过 preflight 证明 carrier 未漂移
- Markdown 展示层可以重排；machine carrier、artifact 或 host/project field locator 必须保持可解析
- parser 或 CLI 输出只证明 carrier 可读性，不替代 Work Item、review、merge-ready、closeout 或 docs/source truth

安全更新策略：

- 优先把 PR body 渲染到独立文件，再用 `gh pr edit --body-file <file>` 更新；不要用 shell command substitution 拼接包含反引号、多行 JSON、中文标点或列表缩进的 body。
- 写入前对渲染文件运行 `loom pr metadata-preflight --body-file <rendered> --surface <surface>`。
- 写入后读取 GitHub PR body 到独立文件，再运行 `loom pr metadata-preflight --body-file <rendered> --compare-body-file <readback> --surface <surface>`；该检查必须比较 machine block 的 locator/hash，并在 machine block 漂移时 fail closed。
- `--body-file` / `--compare-body-file` 只是 render/edit preflight evidence，不能替代 Work Item、review、merge-ready、closeout 或 docs/source truth。
