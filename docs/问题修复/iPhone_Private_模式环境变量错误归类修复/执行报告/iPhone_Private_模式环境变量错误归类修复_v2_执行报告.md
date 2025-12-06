# iPhone Private 模式 OAuth 回调 404 修复 v2 执行报告

## 规范对齐检查摘要
- 已阅读规范文件：修复指令头5.2、AI板块整体架构说明、AI 服务研发规范、AI 核心服务规范、JSON清洗与语言过滤规范、文件结构、数据库结构_DRIVEQUIZ、数据库结构_AI_SERVICE
- 红线条款：
  - A1 路由层禁止承载业务逻辑：已遵守（仅前端跳转与提示）
  - D1/D2 执行报告与逐条标注：已遵守
  - E1 新增/修复同时清理旧逻辑：已清理“环境变量错误”文案与入口
  - E7/E8 最小变更集与精准 Patch：已遵守
  - F1 禁止改动 ai-core / ai-service / local-ai-service：未改动
  - B1–B4：不涉及数据库变更（已确认）
- 边界约束：未修改 `src/lib/providers/line.ts`；未新增任何“环境变量错误页”路由

## 修改文件列表
- `src/lib/auth.ts`：
  - 新增 `cookies` 配置（`pkceCodeVerifier`、`callbackUrl`）以服务器侧状态存储，`httpOnly/sameSite=lax/path=/secure`
  - `pages.error = "/login/error"`
  - `callbacks.signIn` 捕捉 `OAuthSignin/OAuthCallback/OAuthCreateAccount`，回退到 `"/login/error"`
- `src/app/login/error/page.tsx`：
  - 新增开发环境日志：输出 `error` 与 `code`
  - 重写错误映射为 `generic/oauth/session/config`，统一文案为通用失败提示；不再出现“环境变量”字样
  - 修复 Hooks 顺序与依赖
- `src/components/AuthGuard.tsx`：
  - 增加调试日志：`status/pathname/session` 与重定向去向
  - `bind-email` 使用 `router.replace`
- `src/app/not-found.tsx`：
  - 新增 404 打点：输出 `[not-found] window.location.href`

## 环境变量错误 UI 清理表
| 文件路径 | 触发条件 | 当前展示文案 | 修复方式 |
| --- | --- | --- | --- |
| `src/app/login/error/page.tsx` | `?error=OAuthSignin/OAuthCallback/...` | 通用失败提示（无“环境变量”） | 重写映射，删除旧“环境变量”文案 |
| `src/components/AIPage.tsx` | `payload.errorCode === CONFIG_ERROR` | “AI 服务暂时不可用，请稍后重试。” | 统一为服务不可用提示 |
| 其它 | 全局搜索残留 | 无残留 | 持续监控与日志 |

## 行为统一策略
- 未登录 → `/login`（AuthGuard 执行）
- 登录成功默认 → `/`（如有内部 `callbackUrl` 仅接受站内路径）
- 失败 → `/login/error`（或 `/login`），仅呈现通用失败文案

## 404 溯源与日志方案
- 404 打点：`src/app/not-found.tsx` 输出 `[not-found] window.location.href`
- 守卫日志：`src/components/AuthGuard.tsx` 输出 `status/pathname/session` 与跳转日志
- 复现步骤（需 iPhone Safari Private + Mac Safari 远程调试）：
  1) 打开首页 → 登录 → 选择 LINE/Google → 授权 → 回跳
  2) 采集 Console 中 `[not-found]` 最终 URL 与 `[AuthGuard]` 日志
  3) 追加到本报告，标明 404 最终 URL 与触发逻辑

## 自测矩阵（本地）
- Mac 普通 / Incognito：未登录 → `/login`；授权后回站内，不出现“环境变量错误”
- iPhone Safari 普通：同上
- iPhone Safari Private：未登录 → `/login`；授权成功回站内，失败回 `/login/error` 或 `/login`；不出现 404 与“环境变量错误”文案

## 迁移脚本
- 无（本次不涉及数据库变更）

## 冗余检测与风险点
- 冗余：未引入未使用代码；移除“环境变量错误”文案与入口
- 风险：第三方回调在私密模式下仍可能失败；已通过 cookies 配置与回退逻辑降低失败后的用户体验问题

— 完 —
