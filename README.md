# 拾知 · 学习笔记本 v1.0.0

在专用 Codex 学习项目里提问，通过本机网页查找与复习。React/TypeScript/Vite + Fastify + Prisma/SQLite，讲解支持 Markdown、本地 KaTeX、Mermaid/SVG 与离线交互图解。

**v1.0.0为本次封板基线；原MVP仍有待桌面验收项。** 正式接口只读连接、隔离数据测试和网页验证已有证据；已有真实 clipboard 图片自动归档与原图一致证据；独立题号拆分、真实手势和完整离线等场景仍需验收。见 [验收记录](docs/VALIDATION.md)。

Windows新电脑优先按 [WINDOWS.md](docs/WINDOWS.md) 安装，包含GitHub克隆、后台服务、Codex信任、备份迁移、排障和可直接粘贴给新电脑Codex的初始化指令。版本范围及已知边界见 [封板说明](docs/RELEASE-1.0.0.md)。

## 一次性设置

需要 Node.js 24.12+的24.x（hook 使用原生 TypeScript 读取器）、已安装并登录的 Codex CLI、本机官方Codex桌面。Windows用npm.cmd执行下列命令。

```sh
npm ci
npm run db:generate
npm run setup
npm run build
npm start
```

打开 http://127.0.0.1:47831 。希望服务在关闭 Codex 后继续运行，并随登录启动：结束前台 npm start，再执行 `npm run install:service`。Mac安装当前用户LaunchAgent；Windows创建当前用户登录启动项并启动隐藏后台服务，不监听局域网。

在 Codex 桌面添加 **仓库中的 learning 目录** 为专用学习项目。在该项目中按 Codex 提示审核并信任项目配置与 hooks，再新建学习会话。CLI 官方 `/hooks` 可查看具体 hook 定义；如果桌面未提供信任入口，可在终端 `cd learning && codex`，按项目提示完成信任并用 `/hooks` 审核，返回桌面新建会话验证。不要自动改写信任文件或使用跳过信任的开关。

确认工具列表含 `get_learning_context`、`record_learning_items`。之后正常提问，无需收藏或手动复制。开发仓库和其他项目不会归档。

学习导师按 [导师模板](learning/导师模板.md) 直接讲解，每轮归档最终 Markdown 原文；同题追问和沟通知识点追加到原笔记。模板／工具更新后，请新建或重新加载 learning 学习会话，已有会话的缓存工具定义不会自动刷新。不需要再次修改信任记录。渲染支持、图解持有方式与重复验证见 [教学更新](docs/TEACHING-UPDATE.md)。原生聊天图解及同一片段离线归档的更新见 [交互图解诊断](docs/VISUALIZATION-DIAGNOSIS.md)。

默认首页为科目实体笔记本与学习反馈，笔记库保留独立入口。足迹记录完整归档和复习，旧笔记不伪造历史打卡；开书动画、统计口径与验证见 [首页说明](docs/HOME.md)。

详情支持直接标记已掌握／需复习；隐藏讲解后可展开知识点提示；阅读正文可划词高亮或取消，高亮会持久保存并进入备份。隐藏讲解时标记已掌握／需复习会同步记录本次复习，同会话重复点击只记一次。验证步骤见 [复习与高亮](docs/REVIEW-TOOLS.md)。

## 数据在哪里

Mac默认 `~/Library/Application Support/ShizhiNotebook/`；Windows默认 `%LOCALAPPDATA%\ShizhiNotebook\`，与代码分离且不进入 Git。

- `notebook.db`：笔记、来源、人工记录、归档队列状态、学习活动。
- `attachments/`：按内容摘要保存的原图，业务通过附件 ID 引用。
- `ingress-originals/`：hook 收集的原始副本，保障服务暂停时的原图持有；不自动删除，以免未完成归档丢图。
- `queue/`：持久事件入口。服务重启自动处理。
- `archive-token`：仅本机归档端使用，文件权限 600，备份不包含它。
- `backups/`：恢复前的安全备份。

网页「数据管理」导出 ZIP 包及恢复。恢复会替换当前笔记库，先完整校验并创建安全备份。格式 v1 包含来源、笔记、用户修改、知识点沟通依据、归档与复习活动、独立内嵌图解和全部已收集附件。新增字段有明确默认值，可导入更新前的 v1 备份；不会重新摘要旧讲解。未收集到的图片无法纳入备份，归档状态会保留为未完成。包的压缩大小上限 100 MB、展开后 200 MB。

`SHIZHI_DATA_DIR` 和 `SHIZHI_PORT` 可用于隔离测试；使用自定义值时，服务、MCP 和 hook 必须配置一致。setup将本机的数据目录、端口和CLI入口写入被Git忽略的learning/.codex/shizhi.json和MCP环境。变量优先于本机配置；更改前停止服务并保证服务、MCP和hook一致，不复制另一台电脑的生成配置。

## 运行与检查

```sh
npm test              # 独立临时数据库，不污染正式笔记库
npm run build         # TypeScript 与生产网页构建
npm run probe -- 会话ID # 官方 thread/read，只读检查消息类型
npm run doctor        # 环境与本机服务诊断，不扫描会话或自动设置信任
npm run verify:live   # 保存正式库归档摘要；空库不视为验收通过
```

可重复的桌面与网页验收步骤见 [ACCEPTANCE.md](docs/ACCEPTANCE.md)。

通用后台服务：`npm run service:status`、`service:start`、`service:stop`。Mac也可查看／停止：

```sh
launchctl print gui/$(id -u)/com.shizhi.notebook
launchctl bootout gui/$(id -u) "$HOME/Library/LaunchAgents/com.shizhi.notebook.plist"
```

再次启动可运行 `npm run install:service`。更新仓库后先从网页导出安全备份，停止服务，执行 `npm run setup` 升级数据库，再构建并重启服务。移动仓库或 Node 路径后重新执行 setup 与 install:service，并重新信任变化的 hooks。

## 职责与迁移

- `learning/`：学习入口与整理规则；只在此目录配置官方项目事件。
- `scripts/hook.mjs`、`server/codex.ts`：官方事件与 thread/read 只读收集，不解析 transcript_path，不扫描其他聊天。先落盘事件，尽可能立即持有原图，然后交给持久队列。
- `server/archive.ts`：来源幂等、附件收集、整理与追问关联、完整性判断。缺图或缺讲解不显示已保存；Stop 最多请求一次补整理。
- `server/mcp.ts`：Codex MCP 入口，与网页同用服务保存规则和 `/api/v1`。
- `server/db.ts`、`server/attachments.ts`：数据库及附件访问模块。固定 local 用户，人工修改独立字段。
- `server/backup.ts`：格式 v1 与校验／恢复。换数据库需导入并核对记录与图片，不只是换连接字符串。
- `server/dashboard.ts`：北京时间统计和复习活动事务；来源完整归档活动在archive.ts保存。
- `web/`：科目笔记本首页、统计、笔记库、详情与隐藏讲解复习、学习记录、数据管理。

在线版再实现账号权限、网页提问入口、服务端模型、PostgreSQL 与对象存储。当前不提供云同步或独立 AI API 调用。若 Codex 返回远程图片地址或 fileId 而无法正式取得完整原图，系统明确报未完成，不抓缩略图、不要求手动补存替代归档。
