# AGENTS.md — 项目上下文管理中心

本文件用于集中管理本项目的背景、约定、工作流与决策记录。完成重要功能后请及时更新，保持团队对齐与可溯源。

## 1) 项目速览
- 名称: sshf-compliance-analyzer（五险一金尽职调查系统）
- 框架: Next.js 15 + React 18 + TypeScript + TailwindCSS + Radix UI
- 目标: 导入与查询员工五险一金相关数据，按宽/窄口径计算与对比，支持 Excel 导出
- 数据: Supabase Postgres（RLS 受控，服务端必要时用 Service Role）
- 主要功能:
  - 数据导入（Excel）
  - 多期间（如 2023H1/2024H1）按宽/窄口径查询
  - 结果配对与明细展开
  - 导出多 Sheet 的对比报表（xlsx）

## 2) 关键模块/目录
- 页面
  - `src/app/page.tsx`：主页（能力入口）
  - `src/app/query/page.tsx`：查询与导出主页面
- API 路由
  - `src/app/api/calculations/query/route.ts`：查询接口（跨多张结果表）
  - `src/app/api/calculations/export/route.ts`：导出接口（生成 xlsx）
- 库与类型
  - `src/lib/supabase.ts`：Supabase 客户端封装（普通/管理员）
  - `src/lib/types.ts`：核心类型，含 `CalculationResultNew` 等
  - `src/lib/queryUtils.ts`：配对/排序/分页/格式化等工具
- 组件
  - `src/components/QueryPanel.tsx`、`QueryResultsTable.tsx`、`StatisticsBar.tsx`、`CalculationDetail.tsx`

## 3) 启动/构建/测试命令
- 开发: `npm run dev`（默认端口 3006，配置见 package.json）
- 构建: `npm run build`
- 生产: `npm run start -p 3006`
- 质量: `npm run lint`、`npm run format`
- 单测: `npm run test`、`npm run test:watch`
- E2E: `npm run test:e2e`、`npm run test:e2e:ui`

提示: 当前生产构建可能被 ESLint 规则阻断（如 no-console、react/no-unescaped-entities 等）。临时方案可在 `next.config.js` 配置 `eslint.ignoreDuringBuilds = true`，或逐项修复。

## 4) 环境变量
参考 `.env.example` 填写本地 `.env.local`（勿提交仓库）：
- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目 URL（前端可读）
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：匿名 Key（前端可读）
- `SUPABASE_SERVICE_ROLE_KEY`：服务端 Service Role（仅服务端使用）
- 可选：`NEXT_PUBLIC_DEBUG`、`NEXT_PUBLIC_APP_NAME`、`NEXT_PUBLIC_APP_VERSION`、上传/批量尺寸等

注意: `src/lib/supabase.ts` 在缺失 URL/ANON_KEY 时会抛错，导致应用直接失败。

## 5) 数据与表命名
- 多张计算结果表（统一结构）：`calculate_result_<year>_h<half>_{wide|narrow}`
  - 例如：`calculate_result_2023_h1_wide`、`calculate_result_2024_h1_narrow`
- 类型 `CalculationResultNew` 字段（节选）
  - `employee_id`、`calculation_month`（Date）
  - 若干保险基数/应缴/理论总计字段

## 6) 决策记录（重要变更）
- 2025-09-04（导出接口稳定性）
  - 导出路由 `export/route.ts` 强制 Node.js 运行时：`export const runtime = 'nodejs'`；并使用 RFC5987 在 `Content-Disposition` 中提供 ASCII 回退名 + UTF-8 文件名，解决中文文件名导致的 ByteString 报错（500）。
  - 导出路由 body 解析增加容错与诊断日志，便于排查请求体格式问题。
- 2025-09-04（前端日期稳定性）
  - `query/page.tsx` 在拿到响应后，将 `calculation_month`、`created_at` 从字符串恢复为 `Date`。
  - `queryUtils.generateKey()` 支持 `Date|string`，统一转换为 `Date` 再格式化 `YYYY-MM`，避免 `toISOString is not a function`。

## 7) 待办与优先级
- 高优先级
  - 修复生产构建的 ESLint 报错（或临时在构建时忽略规则）
  - 前端下载逻辑优先解析 `filename*`，回退 `filename`（显示中文文件名）
- 中优先级
  - 查询面板：增加更多筛选项与导出条件
  - 统一 UI 文案与 i18n（中文乱码历史文本修整）
  - API/前端完善错误处理与用户提示
- 低优先级
  - CI/CD 与测试完善（Jest/Playwright 集成流水线）
  - 代码健康（移除多余日志、统一风格）

## 7.1) 实施计划 TODO（登录系统 + 公网部署）
依据最新需求：关闭自助注册；无邮件验证；仅用户名+密码登录；两位用户（你与同事）权限一致；导入与查询/导出需要登录；使用自有二级域名绑定；生产环境变量已就绪。

— Phase A · 认证设计与准备
- [ ] 新建认证表 `app_users`（Supabase）：`id(uuid) / username(text, unique) / password_hash(text) / is_active(bool) / created_at`
- [ ] 开启 RLS，仅允许 Service-Role 访问（避免被前端直接读）
- [ ] 在 `.env.example` 增加 `AUTH_SECRET`，用于签发/校验自管会话 JWT
- [ ] 选择哈希库（`bcryptjs`）并约定成本（saltRounds=10）

— Phase B · 后端路由与中间件
- [ ] `POST /api/auth/login`：校验 `username/password`，成功后签发 HttpOnly Cookie（JWT），SameSite=Lax，Secure in prod
- [ ] `POST /api/auth/logout`：清除会话 Cookie
- [ ] `lib/auth/session.ts`：封装 `getSession/requireSession/issueToken`
- [ ] `middleware.ts`：保护以下路径（未登录跳转 `/login`）
  - `/query` 页面
  - `/api/calculations/*`（查询/导出相关）
  - `/api/import-*`（导入相关）
  - 如导入 UI 位于首页 `/`，则考虑整体保护 `/`（或保留首页公开，仅在操作时校验）

— Phase C · 前端页面与 UX
- [ ] `src/app/login/page.tsx`：用户名/密码登录页（错误提示、加载状态）
- [ ] 增加顶栏/入口的登录/登出按钮与登录后跳转逻辑
- [ ] 统一处理 401/403：提示未登录并跳转 `/login`

— Phase D · 账户准备与策略
- [ ] 在 Supabase 控制台创建 2 个用户记录（写入 `username` 与 `password_hash`），关闭自助注册
- [ ] 关闭邮件验证（按需保持 `is_active=true` 即可）

— Phase E · 部署与域名
- [ ] Vercel：连接 GitHub 仓库，配置环境变量（含 `AUTH_SECRET`、Supabase 相关）
- [ ] 临时设置 `eslint.ignoreDuringBuilds=true` 或修复构建期 lint
- [ ] 绑定自有二级域名（新增 CNAME，Vercel 验证通过）
- [ ] 验证登录→导入→查询/导出（≤2000 行，单 H1 范围）全链路

— Phase F · 文档与移交
- [ ] 在 AGENTS.MD 补充鉴权与部署章节的运行手册（用户创建、重置、常见错误）
- [ ] 在 README/主页入口添加“需要登录”的说明与登录入口

## 8) 运行手册（Runbook）
- 启动开发
  - 确认 `.env.local` 已配置 Supabase URL/ANON_KEY
  - 运行 `npm run dev`，访问 `http://localhost:3006`
- 导出失败排查
  - 若 500 且含 ByteString/中文相关报错，确认 `export/route.ts` 的 `Content-Disposition` 采用 RFC5987；前端解析时优先读取 `filename*`
  - 若 400 且为 JSON 解析失败，检查请求体与 `Content-Type: application/json`
- 日期相关错误
  - 若 `toISOString is not a function`，检查数据是否已从字符串恢复为 `Date`
- 构建失败（ESLint）
  - 方案一：逐项修复报错
  - 方案二：`next.config.js` 临时禁用构建时 ESLint 阻断

## 9) 约定与规范
- 提交流程：采用 Conventional Commits（feat/fix/chore/docs/refactor/test 等）
- 分支策略：`master` 为主分支，必要时使用特性分支 `feat/*`、`fix/*`
- 端口约定：开发/生产默认 3006
- 代码风格：TypeScript，避免 any（必要时局部容忍），统一命名与文件结构
- 机密管理：`.env.local` 不入库，生产密钥仅在服务端侧使用

## 10) 链接索引
- 仓库（origin）：https://github.com/canopysgit/wuxianyijin.git
- 参考文档
  - Next.js: https://nextjs.org/docs
  - Supabase JS: https://supabase.com/docs
  - RFC5987（header 文件名编码）: https://datatracker.ietf.org/doc/html/rfc5987

---
更新指引：完成重要功能/修复后，补充“决策记录”“运行手册”“待办”三处，确保新成员可快速上手与复现关键决策。
