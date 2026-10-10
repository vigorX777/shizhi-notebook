# 拾知项目

## 构建与测试

Node.js 24.12+的24.x；`npm ci`、`npm run db:generate`、`npm run setup`、`npm run build`、`npm start`。测试 `npm test` 自动使用独立临时数据库。`npm run doctor`检查配置／官方握手；`npm run verify:live`仅检查正式库，两者不代替桌面验收。Windows安装和迁移按docs/WINDOWS.md，不混用WSL会话。

## 架构

学习入口 learning 与归档服务、复习网页分开。项目 hooks 仅安装在 learning/.codex。Fastify 同源提供网页与 /api/v1；MCP 调用相同服务；数据库与图片分别在 db.ts、attachments.ts 访问；backup.ts 管理版本化迁移包。数据默认存储到Mac用户Application Support／Windows LOCALAPPDATA，不在仓库；shared/runtime.mjs统一路径和进程入口。setup生成learning/.codex本机配置，不进Git；移动路径后重新生成，不复制其他电脑生成文件。

## 项目硬约束

- 不解析 Codex 内部日志，不扫描其他会话；只能用官方事件 ID 与 thread/read。
- 真正的桌面拖图、粘贴截图和多图未验证前，不得宣布 MVP 完成。人工存图或合成消息只可测试，不可作为验收替代。
- 不自动改写 Codex 信任记录或跳过 hooks 信任。只读接口证据不是信任后的自动归档证据。
- 人工字段与自动整理字段分开；自动整理不得覆盖前者。
- 缺图、缺最终讲解、未整理都必须保持未完成。远程链接、fileId 和缩略图不算独立持有原图。
