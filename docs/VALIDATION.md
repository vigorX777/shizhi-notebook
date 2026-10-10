# 验收状态

2026-10-10。**MVP 尚未完成全部真实桌面验收。** 以本节与 WORKBENCH 的最新证据为准，下面保留具体历史来源与恢复经过。

## 2026-10-10 复习工具更新

统一下拉箭头、掌握状态快捷标记、隐藏讲解时的知识点提示和正文／追问划词高亮已完成。隔离实例验证持久保存、取消高亮、跨内联节点、窄屏以及空库备份恢复通过；真实几何笔记的提示与隐藏作只读检查，未替用户标记掌握。证据与步骤见 REVIEW-TOOLS.md。

## 2026-10-10 真实交互追问通过

原学习会话的真实追问中，代理生成季节／光照与空间角两个原生交互片段并自动保存到原笔记。来源完整，网页的季节切换、影子方向、直射纬度、几何步骤、投影旋转、刷新与隐藏均已独立验证；含真实图解的备份恢复逐字段一致。证据与边界见 REAL-INTERACTIVE-FOLLOWUP.md。这替代“尚无实际学习图解”的旧结论，但不等于MVP其他未测场景全部通过。

## 2026-10-10 最新双图与可视化问题

用户已提交真实双图提问。新增地理／数学笔记及原图自动保存，摘要与正式原图一致，讲解等于最终对应小节；.local/latest-learning-verification.json 保留证据。但该轮没有生成任何图解，地理13／14／15独立题仍合为题组。原生可视化协议、生成触发和离线副本链路已修正，隔离测试通过；真实学习会话输出效果仍需下一轮追问核对。详细根因及验证见 VISUALIZATION-DIAGNOSIS.md。

## 此前已验证

- 官方 app-server initialize + thread/read(includeTurns=true) 可只读读取指定学习会话；不恢复会话、不读取内部日志、不扫描其他聊天。
- 正式库 2 条笔记、3 个来源、5 个事件。已有真实 UserPromptSubmit、MCP 整理和 clipboard 图片原图字节一致证据；首次图片题是事后恢复，另一图片题是自动归档，两者不混为一次验收。
- 当前两条笔记已通过统一服务同步为完整最终回答；正式题详情有 22 处 KaTeX 公式、0 错误、1 张原图，正文与正式来源最终回答完全一致。既有数据更新不是新导师首次自动执行的证据。
- npm test 三组测试与 TypeScript/Vite 构建通过。归档、队列、图片、人工记录、最终原文／多题小节、知识点依据、图解持有、数学转换及备份规则见 tests 与 TEACHING-UPDATE.md。
- 更新前与更新后真实备份都已导入独立空库，逐字段与图片摘要一致。结果：.local/pre-template-backup-verification.json、.local/teaching-update-backup-verification.json。
- 用户允许新建 Egolite 空间 47。隔离 fixture 页面真实浏览器操作验证数学／Markdown、Mermaid、SVG、交互滑块、隐藏讲解、知识点摘要搜索与 390px 几何；.local/rendering-ui-report.json 保存结果，可重复脚本为 scripts/verify-rendering-ui.mjs。这些不是真实桌面输入。

- 2026-10-10：两个真实 clipboard 上传原文件暂移后，笔记接口与原图接口正常，原图字节和摘要一致，随后原文件全部恢复并复核；.local/original-independence-report.json 保留结果。该检查没有关闭 Codex、没有断开系统网络，不扩大为完整第三关通过。

## 仍需验证

- 新导师模板在真实 learning 会话中的输出质量、多轮追加和确认依据；需新建／重载会话使用更新后的工具定义。
- 桌面文字、实际拖图、多图、用户的粘贴手势和同题／换题／换科目／谢谢的整理结果。clipboard 来源已有真实证据，但不能推断其他手势都通过。
- 真实桌面停机、中断和 Stop 补整理时序；fixture 故障测试不能替代。
- 关闭 Codex与系统断网后完整笔记阅读。原文件暂移与真实备份空库恢复已通过，其余独立持有步骤仍未完成。
- 全面视觉验收：Egolite 截图持续超时，原生 Egolite 表面也不可用。语义／几何／交互通过不等于与 ChatGPT 像素一致。

Computer Use 明确禁止操作 Codex 应用，不能用其他手段绕过。目标的剩余真实输入须由用户在桌面完成；不能以合成数据宣布整个 MVP 完成。

## 历史来源与故障证据

## 真实截图首次尝试与恢复

已出现学习会话 `01a1214a-cce5-77c0-a8f4-28a1f96891ab` 的正式来源证据。首轮 `01a1214a-d15c-7910-ae9b-f1e6bd6e5336` 含文字和 localImage（Codex clipboard PNG），但学习代理缺少 turnId、以空值调用工具失败，未自动归档。后续轮次实际触发 UserPromptSubmit，工具可用；因此不能继续笼统认定用户完全未完成信任，而应以首轮来源上下文与时序失败处理。

通过已知学习会话的正式 thread/read 读取首轮，使用现有归档服务做事后恢复（服务请求使用 SessionEnd 的同会话收集路径，**并非真实 SessionEnd 触发证据**），未手动复制原图。服务取得完整 PNG 159818 字节，摘要 `02a1f5cf8d117d8aef2ea219d6370b19e8f9375a0ba16392a15c795466a325ec` 与原上传文件一致。阅读原图后用统一保存服务补整理原题和会话原讲解；笔记 ID `f63594b5-b3e7-4ac0-a2d7-48b8d0a1370d`，附件 ID `b99ec346-d88e-4029-8783-d165c6634981`，状态完整。这是恢复成功，不是首次自动链路通过。

修复：UserPromptSubmit 即使 HTTP 收集失败仍输出来源上下文；get_learning_context 缺少轮次时，通过指定学习会话的正式接口解析最新轮次并返回 source.turnId，规则要求核对当前题意后保存。不会扫描其他会话。新增省略轮次的 HTTP 测试通过。MCP schema 变化后需要新建或重新加载学习会话。

真实数据备份 `.local/real-screenshot-backup.zip` 已导入一个全新隔离 SQLite 数据目录，逐字段核对来源、笔记、人工记录、来源关联和图片摘要，结果见 `.local/real-backup-verification.json`。不能据此声称修复后的桌面文字、拖图、粘贴和多图已通过；这些仍需真实重测。

## 新的截图自动归档证据

另一真实学习会话 `01a1214e-e3c1-7301-b6ae-51c2f137a30f`、轮次 `01a1214e-e889-7362-b12a-626b14f653d7` 包含 Codex clipboard 图片；官方会话记录显示代理自行取得附件并调用 record_learning_items，最终回答之后来源状态 complete。笔记 `93803618-7a80-4383-88ca-7dd85867b9dc`、附件 `15c5c9a5-38c9-4480-8b8b-22a2b927d0da`，图片 287372 字节，SHA-256 `15b9cf161084c1a508bb372da17efba6bf6194824ce6ace03968b7f4b0197c49` 与上传原文件一致。此轮的整理与最终收集均自动完成，没有手动补存或事后补整理。

该现场还暴露 UserPromptSubmit 过早快照无 userMessage 的重试问题：已修复空快照时重新正式读取，新增回归测试通过；两个旧失败事件通过网页相同 retry 接口重新处理为 done，当前五个事件全部 done。最新正式摘要见 .local/live-report.json。clipboard 来源支持真实截图路径证据；尚未观察用户具体粘贴手势，不扩大为拖图／多图通过。其余真实验收继续保持未完成。

Computer Use `getApp("Codex")` 被平台明确拒绝：该应用不允许 Computer Use 操作。没有改用 AppleScript、调试端口或其他路径绕过该限制。专用项目添加、hooks 审核信任和真实上传操作交给用户在桌面完成。

官方 hooks 要求审核并信任当前定义；配置变化后需要重新信任： https://learn.chatgpt.com/docs/hooks 。正式消息协议： https://learn.chatgpt.com/docs/app-server 。

Egolite Page.captureScreenshot 与直接 CDP 截图均超时；语义结果验证交互，390px 几何检查没有页面横向溢出，KaTeX 实际渲染一处公式。截图超时不视为视觉验收通过。空间 46 已完成并关闭；新空间 47 经用户授权创建，最新结果见 TEACHING-UPDATE.md。
