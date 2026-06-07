# FR-0037 research

## 结论

本 FR 不依赖新的第三方实验、外部平台验证或 provider 私有实现研究。Launch Envelope 的输入来自仓库已冻结的正式边界：

- `FR-0033`：Browser Provider Contract，提供 provider identity、mode、capability、verification level 与 limitations 的权威来源。
- `docs/dev/architecture/system-design/account.md`：提供 profile、extension identity、Native Messaging binding、profile lock 与 proxy 黏性绑定边界。
- `docs/dev/architecture/system-design/execution.md`：提供 official Chrome 137+ persistent extension 主路径、browser mode 与 execution safety mode 边界。
- `FR-0016` 与 `FR-0020`：分别持有 live evidence gate 与 anti-detection validation；本 FR 只声明 launch-time requirements，不产出这些证据。

## Unknown 处理

本 suite 中的 `unknown` 不是待研究缺口，而是 machine-readable fail-closed state。后续 consumer 遇到影响目标 capability 的 `unknown` 必须阻断，除非新的 formal FR 冻结更窄的降级规则。

## 后续研究边界

以下内容不属于本 FR 的研究输入，必须由后续事项承接：

- provider registry / selection 的数据结构与选择算法。
- provider health / doctor 的检查项与运行输出。
- provider evidence kernel 的 artifact schema、redaction 与 freshness 消费。
- provider-specific private patch schema 或 managed browser internals。
