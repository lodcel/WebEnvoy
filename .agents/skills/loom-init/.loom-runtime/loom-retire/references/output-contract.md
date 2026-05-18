# Loom Retire Output Contract

输出至少需要给出：

- `runtime_state`
  - 当前 Loom 入口自己的 scene / carrier 判定
  - 若安装态运行时、shared 资源或 bootstrap carrier 漂移，必须直接 `block`
- retire 前置条件说明
- `purity-check` 的结果
- `workspace cleanup` 的结果
- `workspace retire` 的结果
- `lifecycle_expectations`
  - cleanup 只能删除显式 Loom-owned 临时残留
  - retire 只把 recovery entry 的 checkpoint 置为 `retired`
  - `remove` 不属于 Loom core，现场目录删除仍由宿主拥有
- 最终 checkpoint，固定以 `retired` 为终态
- 现场策略说明：不自动丢弃用户改动，不默认删除目录
