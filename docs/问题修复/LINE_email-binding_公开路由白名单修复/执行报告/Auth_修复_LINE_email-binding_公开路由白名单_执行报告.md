# 任务执行报告

## 任务摘要
- 修复 `/login/email-binding` 未登录访问被重定向回 `/login` 的问题。
- 将 `/login/email-binding` 加入公开路由白名单，并宽松允许所有 `/login/*` 路径访客可访问。

## 规范对齐检查摘要
- 阅读：修复指令头 v5.2（现用）、数据库结构、文件结构文档。
- 约束：A1 路由不承载业务；B3 类型一致；E1–E10 冗余治理与最小变更；F1–F5 AI 边界。
- 修改文件：`src/components/AuthGuard.tsx`。
- 数据库影响：无结构变更。

## 阅读的文件
- `src/components/AuthGuard.tsx`：未登录重定向逻辑与公开路由判定。
- `src/app/login/email-binding/page.tsx`：页面呈现与错误展示（已在前任务修复早期跳转）。
- `/Users/leo/Desktop/drivequiz研发规范/数据库结构_DRIVEQUIZ.md`：确认与本次无 DB 变更相关。

## 现状与问题
- 公开路由列表缺少 `/login/email-binding`，导致未登录用户访问该页面被当作受保护路由，进而重定向回 `/login`，出现“闪回”。

## 修改清单
- `src/components/AuthGuard.tsx`：
  - 公开路由列表增加：`/login/email-binding`。
  - 宽松规则：`isLoginPath = pathname === '/login' || pathname.startsWith('/login/')`；
  - `isPublic = isLoginPath || PUBLIC_PATHS.includes(pathname)`。

## 验证结果
- 未登录访问 `/login/email-binding?provider=line&token=...`：页面正常渲染，不再跳回 `/login`。
- token 缺失或校验失败：页面显示错误提示，不重定向，便于问题可见与处理。
- 绑定成功后：按既有流程进入 `/api/auth/signin/line?callbackUrl=/` 完成登录。

## 红线自检（A1–E10）
- A1 路由不承载业务：已遵守。
- B3 类型一致：已遵守。
- E1–E3 冗余治理与 SSOT：公开路由判定集中于 AuthGuard。
- E7/E8 最小补丁：仅增改公开路由判断，不触及其他模块。
- E9 性能红线：未引入额外请求。

## 风险与建议
- 后续如新增登录相关子页面，请统一纳入 `/login/*` 公开规则，减少遗漏导致的误重定向。

## 版本号
- 无需单独更新版本号；若需要统一标记，可与后续改动一并更新。
