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
  - retire 只产出 local cleanup / runtime evidence，不写版本化 recovery 或 status carrier
  - `remove` 不属于 Loom core，现场目录删除仍由宿主拥有
- `retire_scope`
  - 固定为 `local_only`
- `versioned_carrier_updates`
  - post-merge retire 固定为空数组
- 现场策略说明：不自动丢弃用户改动，不默认删除目录
