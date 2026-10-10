# 拾知学习入口

这是专用学习项目。只教学与归档，不改写笔记服务；每次开始教学前读取本目录的《导师模板.md》，按其中规则回答。

## 每轮讲解与归档

1. 从 UserPromptSubmit 上下文取得 threadId / turnId，先调用 MCP `get_learning_context`，确认当前原题、原图附件 ID、同会话已有笔记及知识点。缺少 turnId 时省略该参数，核对返回的 source.question 和图片确实属于本轮，再用 source.turnId 保存；不得传空值、编造 ID。正式接口尚不可读时重试，仍失败明确说明未完成。
2. 按导师模板准备本轮完整 Markdown 回答。调用 `record_learning_items` 保存同一份正文，然后将它作为最终回答展示；不得把归档正文压缩成摘要、去掉公式符号或图解。结束事件会再按最终回答原文同步。保存时当前轮次尚无最终回答会暂时未完成，结束事件后才可变成完整。
3. 单题：一条 item，captureMode="final"，answerHeading=""，explanation 为完整回答。同题追问必须沿用已有 noteId，每轮提交本轮新增讲解，不重写原题；换题／换科目新建笔记，不能仅因同一会话而合并。同一轮多题：每题一个唯一 `## 题目标题`，题内小节使用 `###`；answerHeading 填对应标题文字（不含 ##），explanation 为该题完整小节。每道题一个稳定 itemKey，同图多题共享原图附件并填写 questionNumber。不同独立题号（例如同一材料下的 13、14、15 选择题）分别保存，不能合成题号 13—15 的一条笔记；一题内部连续的小问可作为同一题。
4. question 保留原题意／本轮真实疑问；title、subject、tags 按模板提取，科目不明用“待分类”。图片题引用本轮 get_learning_context 返回的 attachmentIds；追问没有新图时不复制旧图，原笔记会保留已有原图。
5. knowledgePoints 逐条提交本轮实际讨论的知识：label 沿用同一知识点名称，summary 写清概念、成立条件、可复用方法或纠正后的理解；signal 为 discussed／confused／confirmed／corrected；evidence 引用本轮用户表达或作答事实。只有明确表达或正确复述／应用才用 confirmed，不能把“谢谢”、沉默或老师自我判断当作掌握。多轮自动累积并展示沟通依据，不用整篇复述凑增量。
6. “谢谢”、闲聊、纯归档修复提示用 disposition="non_learning" 与空 items。若用户同时明确确认知识或纠正理解，则这是原笔记的学习追问，应记录依据。修复提示引用的上一轮应归档上一轮，不能将提示造为新题。
7. 几何、空间／光照、运动等需要观察关系的内容默认生成真实图解；变化参数或视角能帮助理解时生成交互。读取可用 visualize skill 并按原生内容引用在最终回答中展示，不仅输出代码块或“想象一下”。新电脑没有原生可视化能力时生成真正的独立HTML／SVG并按下述路径归档，在笔记网页展示；明确说明聊天内嵌能力未验证，不能引用另一台电脑的skill路径或把代码块当成交互图。讲解中的可视化遵循导师模板的持久化规则：聊天原生片段用 scripts/export-visual.mjs 导出同一图解的离线版本，visualizations 的 path 填聊天片段、offlinePath 填离线 HTML；正文保留原生 visualize 内容引用。引用本地 PNG/SVG/独立 HTML 产物时，每题 visualizations 提交实际绝对 path 和 label，最终回答用标准 Markdown 链接／图片引用同一路径。服务读取指定产物并内嵌保存完整内容；不得提交临时预览 URL、外部依赖或仅截图缩略图。不把原始用户图片放入 visualizations，原图由官方接口自动收集。
8. 不自动改错题、错因、心得或掌握状态，不覆盖人工修改。不手动复制用户原图或写数据库替代归档。工具失败明确“归档未完成”，不能宣称已完整保存；正文先正常讲解，不让归档故障阻止教学。

服务地址和凭证由 MCP 管理，不输出凭证。hooks 只用官方事件 ID 和 thread/read 收集本学习项目消息，不读取内部日志，不扫描其他会话。
