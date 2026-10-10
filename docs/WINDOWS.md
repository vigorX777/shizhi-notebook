# Windows 新电脑：从 GitHub 安装拾知 v1.0.0

本路线使用**原生 Windows 的 Codex、本机 Node 服务和本机浏览器**。GitHub 提供程序与学习规则，学习数据使用独立 ZIP 迁移；不需要另买 AI API Key。建议 Windows 11，使用有 Codex 权限的账户登录官方桌面和 CLI。

官方 Windows 文档确认支持原生 Windows 与 WSL2；两者默认使用不同的 Codex 配置／登录／会话目录。为了能通过 thread/read 读取桌面里刚问的题，本次全部采用原生 Windows，不在 WSL 安装另一套服务。[官方 Windows 文档](https://learn.chatgpt.com/docs/windows/windows-app)

## 1. 准备电脑和 GitHub 访问

1. 安装能显示 Codex、本地项目及任务的官方 Windows 桌面应用。当前官方 Windows 页称为 ChatGPT desktop app；在桌面应用的 Codex 工作界面操作，普通网页 ChatGPT 会话不会触发本项目本地 hooks。按官方页面安装并登录。
2. 安装 Git、Node.js **24.12 或更新的24.x**、GitHub CLI。PowerShell：

   ```powershell
   winget install --id Git.Git -e
   winget install --id OpenJS.NodeJS.LTS -e --version 24.12.0
   winget install --id GitHub.cli -e
   ```

   如果 winget 找不到该 Node 版本，使用 Node.js 官方24.x安装包。不要安装25／26后忽略 engines 警告；v1.0.0的构建／hook运行基线是24.x。安装后关闭并重新打开 PowerShell，以及桌面应用。
3. 用下面命令确认并登录：

   ```powershell
   node --version
   git --version
   gh --version
   gh auth login
   npm.cmd install -g @openai/codex@0.162.0
   codex.cmd --version
   codex.cmd login
   ```

   0.162.0是Mac当前验证的CLI协议基线；桌面使用当前官方版本。登录选择自己的账户，不复制Mac的auth.json、归档凭证或信任记录。

仓库为私有：使用有访问权的GitHub账户。另一位用户的GitHub账户须先由仓库所有者授予访问权；安装说明不会自动邀请其他人，也不要将个人GitHub凭证交给对方。

本指南使用 `npm.cmd`／`codex.cmd` 避开 PowerShell 对 `.ps1` 的执行策略限制。不要为安装修改整台电脑的全局执行策略。GitHub CLI和Git是原生exe，直接运行即可。

## 2. 克隆并固定版本

用固定的本地目录，不放在OneDrive、网盘或临时下载目录。

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\Source" | Out-Null
Set-Location "$env:USERPROFILE\Source"
gh repo clone vigorX777/shizhi-notebook
Set-Location shizhi-notebook
git switch --detach v1.0.0
npm.cmd ci
npm.cmd run db:generate
npm.cmd run setup
npm.cmd run build
npm.cmd start
```

打开 `http://127.0.0.1:47831/`。空库没有科目封面和打卡是正常状态。先确认页面能打开，再保持服务运行或按第4节安装后台服务。

setup会在本机生成 `learning/.codex/config.toml`、`hooks.json`、`shizhi.json`，包含本机Node、仓库、CLI、数据目录和端口。生成配置不进入Git，**不要从Mac拷贝这些文件**。仓库路径有中文和空格可处理；生成Windows hook命令使用明确的PowerShell入口及编码参数，MCP用Node绝对路径调用，不执行npm.cmd。

默认学习数据为 `%LOCALAPPDATA%\ShizhiNotebook\`。服务只监听127.0.0.1，不需开放局域网防火墙规则。

## 3. 一次性连接学习项目

在桌面应用中：

1. 选择Windows native作为代理环境。集成终端选择PowerShell；代理环境和终端环境是不同设置，两者均保持原生Windows。
2. 添加 **仓库里的 learning 子目录** 为单独学习项目。开发根目录用于安装和维护，不用于日常学习归档。
3. 按提示审核并信任本机生成的项目 `.codex` 层和hooks。若桌面无信任入口，在PowerShell中执行：

   ```powershell
   Set-Location "$env:USERPROFILE\Source\shizhi-notebook\learning"
   codex.cmd
   ```

   在CLI内用 `/hooks` 审核 `UserPromptSubmit`、`Stop`、`Interrupt`、`SessionEnd` 的本地归档脚本，完成信任；退出CLI，回桌面新建学习会话。新电脑、配置内容或路径变化时必须重新审核；不使用跳过信任选项。[官方 hooks 信任说明](https://learn.chatgpt.com/docs/hooks)
4. 确认工具列表有 `get_learning_context` 和 `record_learning_items`。学习规则和导师模板已在GitHub，首次正常提问时会读取，不需复制Mac会话。

桌面与CLI必须在同一个Windows用户、同一个Codex环境中。若已有自定义CODEX_HOME，在setup前保持与桌面一致；不要为了安装擅自改成WSL目录或复制旧电脑完整Codex历史。自定义设置会写入本机MCP和归档配置。

## 4. 每天启动：后台服务

先在运行 `npm.cmd start` 的窗口按 Ctrl+C，再回仓库根目录执行：

```powershell
npm.cmd run install:service
npm.cmd run service:status
npm.cmd run doctor
```

Windows安装器创建**当前用户登录启动文件夹内的 ShizhiNotebook.lnk**，并立即启动隐藏的后台Node服务。不注册系统服务，不需要管理员权限，不保存密码。服务可在关闭Codex后继续运行，电脑关机时停止，下一次登录自动启动；不是在Windows登录前就运行的系统服务。

```powershell
npm.cmd run service:stop
npm.cmd run service:start
npm.cmd run service:status
```

停止服务不删除登录启动项。取消自动启动：Win+R打开 `shell:startup`，删除 `ShizhiNotebook.lnk`，再运行service:stop。仓库或Node移动后，停止旧服务，重新setup／build／install:service，并按第3节重新审核变化的hooks。

日志在数据目录 `service.log`、`service-error.log`。service:status检查HTTP健康状态；doctor检查本机配置、Node版本、官方app-server握手、服务版本和统计接口。诊断不会扫描或读取其他聊天，也不显示归档凭证；**全绿也不能代替真实桌面提问验收**。

Windows组织策略可能禁止PowerShell启动或创建登录快捷方式。出现这种情况保留 `npm.cmd start` 的前台服务作为正常使用方式，由设备管理员处理策略；不要自动绕过企业策略。

## 5. 将Mac已有笔记带过去（可选）

1. Mac网页「数据管理」导出完整ZIP，私下通过U盘等方式传到Windows。ZIP含原图、完整讲解、内嵌图解、人工分类／错题／掌握／心得／高亮及学习活动；不含CLI登录、Mac信任记录或归档凭证。
2. Windows服务启动后，网页「数据管理」选择ZIP，确认替换当前笔记库，再检查并恢复。恢复前自动生成Windows当前库的安全备份；不要把日常新增的Windows笔记未经备份就覆盖。
3. 核对笔记数、科目、每条原图、追问、公式、交互控件、人工状态和高亮。归档来源中的旧Mac路径仅保留为来源信息，查看已完整笔记依赖自己的附件ID及内嵌内容。
4. 关闭Codex、暂时移走传入的ZIP／原上传文件、断网后，用本机网页再次查看。只有“归档完整”的记录能证明独立持有全部内容。

历史会话ID不会凭空出现在Windows的Codex里。旧笔记可独立复习，但「重新归档」旧Mac来源需要原会话仍在对应电脑可读，失败会明确显示。新电脑日常学习使用新会话、新来源；不同电脑各有独立库，无自动双向同步。不要手工复制整个Mac数据库／attachments目录来替代可校验的ZIP恢复，也不要把个人ZIP上传到GitHub。

## 6. 在Windows验收一次真实流程

| 操作 | 必须看到的结果 |
|---|---|
| 文字题 | 模板讲解；网页原题、完整讲解和活动记录 |
| 拖入图片 | 用资源管理器把图拖入Codex；网页可打开独立原图 |
| 粘贴截图 | Win+Shift+S截图后Ctrl+V到Codex；原图归档完整 |
| 多图／同图多题 | 各题分别保存、题号正确、原图引用正确 |
| 同题追问／换题 | 前者追加原笔记；后者新建，不覆盖人工记录 |
| 交互讲解 | 在学习项目要求可旋转／切换参数的图；网页交互有效，刷新仍可操作 |
| 复习标记 | 隐藏讲解后标记掌握记一次；重复点击不多计；普通编辑不计 |
| 服务暂停 | 停止后提问保留持久事件；启动后补处理，缺失整理仍清楚显示 |
| 非学习消息 | “谢谢”等不新增笔记或打卡 |
| 关闭Codex／断网 | 已完整笔记、原图、公式、交互图仍可查看 |
| 备份恢复 | 文字、原图、人工记录、图解和统计一致 |

原生聊天内嵌可视化取决于新电脑桌面版本、账户和可用visualize能力；项目不会安装Mac私有skill绝对路径。若新电脑缺该能力，导师仍应生成真实的独立HTML／SVG图解并归档，在笔记网页交互；聊天里只出现产物链接不能算“与Mac相同的内嵌效果”验收通过，应更新官方应用和检查可用能力后重验。脚本、服务和网页测试不能替代这个桌面确认。

## 7. 常见问题

| 现象 | 排查 |
|---|---|
| 无法克隆私有库 | gh auth status、GitHub账户访问权 |
| npm.ps1被策略阻止 | 使用本指南npm.cmd，不改全局策略 |
| 找不到Codex | 重开终端；codex.cmd --version；重跑setup。独立exe可用CODEX_BIN指定绝对路径 |
| 页面打不开／版本旧 | service:status；检查日志／端口；停止旧实例再启动。不要让npm start与后台服务同时抢同一端口 |
| 有讲解但没笔记 | 确认learning项目、服务、工具、/hooks信任；数据管理检查失败原因 |
| thread/read找不到会话 | 检查原生Windows／WSL、同一个Windows用户、Codex Home和CLI版本；旧Mac会话不会随代码迁移 |
| “fileId、缺原图” | 当前桌面正式接口未提供可独立读取的原图；保留未完成状态，升级连接后重新验证，不手工补存冒充自动归档 |
| 图解文件被拒 | 放在learning或当前Codex可视化产物目录，使用本机绝对路径；跨磁盘的无关目录不会被放行 |
| 知识标签与掌握不一致 | 标签是内容分类，掌握由本人手动标记；反复讨论并不自动掌握 |
| 恢复后学习天数为0 | 旧包没有活动时不伪造历史；库存仍保留，后续真实活动才增加天数 |

## 自动检查证据与可启用模板

Mac已执行8项测试和构建，跨平台路径／命令有针对性测试；本轮未接入Windows实机。docs/ci/verify.yml为GitHub macOS／Windows原生runner验证模板，覆盖npm ci、测试、构建、全新setup、官方握手、Windows后台／登录启动项、空库网页和备份恢复，不产生AI请求。当前GitHub凭证缺workflow权限，所以模板未作为活动工作流上传；不能报告Windows CI已通过。仓库所有者补充workflow写权限后将模板复制到.github/workflows/verify.yml，提交推送，确认Windows任务为success，仍需第6节真人桌面验收。

## 8. 新电脑交给Codex的初始化指令

先克隆，再在**仓库根目录的开发会话**粘贴下面内容。不要在learning会话中维护服务代码。

```text
请初始化拾知学习笔记本v1.0.0。先读取AGENTS.md、README.md、docs/WINDOWS.md、docs/RELEASE-1.0.0.md，核对git当前提交和v1.0.0标签。按文档使用原生Windows，不混用WSL；检查Node24.12+的24.x、Git、Codex CLI及登录。运行npm.cmd ci、db:generate、setup、build，启动服务并运行doctor；需要后台使用时运行install:service。
不要复制Mac的生成配置、登录凭证或信任记录，不自动信任hooks，不读内部日志或扫描其他会话，不修改v1.0.0发布代码。把learning作为独立学习项目所需的本机路径告诉我，让我在/hooks审核信任。
初始化后按WINDOWS.md检查真实文字、拖图、粘贴截图、多图、同题追问、交互图和复习；测试数据只进隔离库。已有笔记需要导入时用网页ZIP恢复，先备份当前Windows库。报告已验证、未验证和实际错误；不得仅凭doctor或测试通过宣布桌面自动归档验收完成。
```
