# FR-0008 TODO

## 已完成前置

- [x] 明确 `#146` 的定位是“侦察输入”，而不是 Phase 1 阶段出站项
- [x] 明确 `#208` 是“最小页面交互动作正式验证”的独立 blocker
- [x] 确认本 FR 使用独立 worktree / 独立分支推进
- [x] 起草 FR-0008 的 `spec.md`、`plan.md`、`TODO.md`
- [x] 补齐 `contracts/`、`research.md`、`risks.md`

## 当前规约收口

- [x] 在 `spec.md` 明确 `#146 -> #208` 的 handoff 边界
- [x] 在 `spec.md` 明确 fallback viability 与 implementation readiness 必须分开记录
- [x] 在 `plan.md` 明确本 FR 不承载 Phase 1 正式出站责任
- [x] 在 `contracts/` 定义写链路侦察的结构化输出对象

## 待继续的浏览器内复核

- [x] 通过 `#752` / PR `#775` 收敛 `editor_input` 独立命名入口，并保留 `xhs.search` 兼容路径
- [x] 通过 `#753` / PR `#776` 落地 creator publish target binding 与 admission 入口
- [x] 通过 `#754` / PR `#777` 落地受控文本写入链路，不触发提交或发布
- [x] 通过 `#755` / PR `#778` 落地媒体上传路径 discovery / dry-run / recon；该路径只输出上传入口与文件选择边界，不上传、不提交、不发布
- [x] 通过 `#756` closeout comment 与 `#779` 明确 live upload evidence 当前被 readiness/admission 阻断；阻断归属为 runtime/profile/identity/target binding 与 `FR-0012` / `FR-0013` / `FR-0014` anti-detection baseline
- [ ] `#779` 恢复前，不继续执行受控上传 live evidence，不把历史样本、fallback 或 dry-run/recon discovery 写成 live upload success

## 当前阻断与暂停条件

- [x] `#756` 已停在 readiness/admission checkpoint；未执行真实上传、文件选择器、DataTransfer 注入、提交、发布或账号接触
- [x] `#779` 已承接 `xhs_001` / 等价 XHS managed profile、official Chrome extension identity、managed creator publish target tab、`FR-0012` / `FR-0013` / `FR-0014` baseline 的恢复条件
- [ ] 若后续 live 侦察触发账号异常、验证码或明显风控升级，立即暂停并冻结当前证据
- [ ] 若页面入口存在多版本分流，先冻结分流条件，再决定是否继续加样本
- [ ] 若 `#208` 或后续事项试图消费未冻结结论，先回到对应 FR / blocker 完成 evidence 收口

## 后续衔接

- [x] 在 `#752` - `#755` 中把 FR-0008 的候选输入拆成可复核的实现切片与 dry-run/recon 证据
- [x] 在 `#756` 中把 live upload evidence 的失败检查点拆给 `#779`，避免在 closeout issue 内继续 probing
- [ ] `#757` 收口时必须明确：FR-0008 write/upload spike 已完成非 live 证据闭环，但 live upload evidence 仍由 `#779` 阻断，不能作为 parent 成功证据
- [ ] `#212` 只能在消费 `#752` - `#757`、`#779`、相关 PR / merge commit / Project 状态后关闭或保持 open；不得只因 #752-#755 已合并就关闭
- [ ] `#779` 恢复后，如主路径达到 `admission_ready`，再单独建立“小红书最小写能力 / 发布链路”实现 FR 或重启受控 live closeout
