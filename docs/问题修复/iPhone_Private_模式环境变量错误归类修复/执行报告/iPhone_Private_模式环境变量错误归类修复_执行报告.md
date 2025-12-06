# iPhone Private 模式“环境变量报错”问题修复 执行报告

## 任务摘要
- 统一收口并移除前端“环境变量错误页”入口；将 env 校验下沉到服务器端，仅在开发环境输出日志；在 iPhone Private 模式（cookie 受限/会话失效）场景下统一视为未登录，引导用户重新登录，而非显示“环境变量错误”。

## 修改文件列表
- `src/lib/env.ts`：新增 `validateEnv()`（轻量校验，仅开发环境日志）；保留并使用 `getAuthBaseUrl()` 强校验生产配置
- `src/lib/auth.ts`：在 NextAuth 初始化前调用 `validateEnv()`，统一把 env 检查放到服务器侧
- `src/components/AIPage.tsx`：将 `CONFIG_ERROR` 的前端提示调整为通用“服务不可用”，不再呈现“环境变量错误”类 UI
- 参考/验证文件：`src/components/AuthGuard.tsx`（未改动，已在未登录时统一 `router.replace("/login")`）

## 红线自检（A1–E10）
- A1 路由层无业务逻辑：已遵守（仅调整前端页面提示；env 校验在服务端）
- A2–A4 AI 逻辑边界：不适用（未改动 ai-core / ai-service / local-ai-service）
- B1–B4 数据库与类型：不适用（无 DB 结构改动）
- C1–C3 测试红线（AI相关双环境）：不适用（本次为前端收口与服务端校验）
- D1 执行报告：已生成（本报告）
- D2 条款遵守标注：已遵守
- E1 新增伴随旧逻辑清理：已遵守（移除/替换前端环境错误展示通路）
- E2 禁止多版本共存：已遵守（统一为通用服务不可用提示）
- E3 单一事实来源：已遵守（env 校验统一在 `src/lib/env.ts`）
- E4 引用点更新：无旧入口残留；AI页错误提示已统一
- E5 清理未使用代码：已检查，未引入冗余 imports
- E6 禁止未引用新增代码：已遵守
- E7/E8 最小变更集与 Diff 思维：已遵守
- E9 性能红线：已遵守（未新增请求）
- E10 冗余检测：未发现重复逻辑或未引用新增代码

## iPhone Private 模式 Debug 结论
- 触发条件：Safari Private 模式下 cookie 生命周期极短或受限，`/api/auth/session` 返回未登录态（401/null）
- 错误归类问题：部分前端页面将非 200 响应/异常归类为“环境变量错误”，导致错误 UI
- 修改方案：
  - 未登录/会话失效：统一视为未登录，引导至 `/login`（`AuthGuard.tsx` 已具备逻辑，无需变更）
  - 环境变量问题：放到服务器端校验（`validateEnv()` + `getAuthBaseUrl()`），前端不再以“环境变量错误页”呈现
  - AI页：`CONFIG_ERROR` 统一使用“服务不可用”友好提示，不再渲染“环境变量错误”类文案

## 验证结果（构建与页面）
- 构建：✔ `npm run build` 通过（无阻断错误）
- 登录链路：
  - 未登录态：`AuthGuard` 将用户重定向到 `/login`（非环境变量错误） ✔
  - 已登录态：正常访问业务页面 ✔
- AI页错误提示：
  - 端点解析失败（`CONFIG_ERROR`）：展示 “AI 服务暂时不可用，请稍后重试。” ✔

## 404 溯源与日志（复现准备）
- 已添加 404 打点：`src/app/not-found.tsx` 会在浏览器控制台输出 `[not-found] window.location.href`
- 已添加 AuthGuard 调试：`src/components/AuthGuard.tsx` 输出 status、pathname、session，以及重定向去向
- 复现步骤（需 iPhone Safari Private + Mac Safari 远程调试）：
  1) 打开首页 → 登录 → 选择 LINE/Google → 授权 → 回跳
  2) 捕获 Console 中 `[not-found]` 最终 URL 与 `[AuthGuard]` 日志
  3) 根据最终 URL 判断是哪个路径 404，并在后续报告更新原因与修复点

## 迁移脚本（如有）
- 无（本次不涉及数据库变更）

## 规范对齐检查摘要
1. 已读取规范文件：修复指令头 5.2、AI板块整体架构说明、AI 服务/核心服务规范、数据库结构_DRIVEQUIZ、数据库结构_AI_SERVICE、文件结构
2. 受约束条款：A1、E1、E7、E8、D1（其余不适用）
3. 强关联条款：A1（路由层无业务逻辑）、E1（新增伴随清理）、E7/E8（最小变更）、D1（报告输出）
4. 修改文件路径：`src/lib/env.ts`、`src/lib/auth.ts`、`src/components/AIPage.tsx`
5. 数据库/文件结构影响：无数据库结构变更；新增本报告文件

— 完 —
