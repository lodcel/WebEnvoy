# FR-0052 TODO

## Review 阶段

- [ ] 确认 `FR-0052` 只定义 CloakBrowser capability matrix。
- [ ] 确认 direct / persistent / cloakserve 每个 capability row 均包含 support level、minimum support state、evidence policy requirements、variant inputs、limitation、verification source 与 evidence ref strategy。
- [ ] 确认 matrix 消费 `FR-0049`、`FR-0050`、`FR-0051` 与 `FR-0035`，没有重写 descriptor shape。
- [ ] 确认本 suite 没有 health result schema、limitation gate result、launch evidence record、fixture payload、runtime implementation 或 live evidence。
- [ ] 确认 direct Native Messaging row 为 unsupported。
- [ ] 确认 cloakserve extension bridge and Native Messaging rows 为 unsupported by default。
- [ ] 确认 persistent profile / extension / Native Messaging refs 不被写成 health pass 或 runtime ready。
- [ ] 确认 final args evidence and fingerprint seed evidence are strategies only, not launch proof, runtime proof, anti-detection pass or live evidence.
- [ ] 确认 PR metadata 使用 `Refs #1149` / refs-only，并声明 formal spec review PR、local_only integration、live evidence N/A、gate owner scheduler。

## 实现前待办

- [ ] #1152 消费本 matrix 和 descriptor limitations，冻结 CloakBrowser limitation gate。
- [ ] #1153 消费本 matrix thresholds，冻结 runtime/evidence convergence。
- [ ] Future runtime owner consumes direct / persistent / cloakserve matrix rows before claiming runtime attestation.
- [ ] Future launch evidence owner consumes `artifact-passthrough.launch-evidence` rows and redaction policy before producing launch artifacts.
- [ ] Future fixture owner consumes descriptors, matrix, health and launch evidence inputs before adding CloakBrowser fixtures.
