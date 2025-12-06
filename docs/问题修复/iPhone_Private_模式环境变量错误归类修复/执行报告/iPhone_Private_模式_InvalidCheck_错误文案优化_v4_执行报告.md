# iPhone Private 模式 InvalidCheck 错误文案优化 v4 执行报告

## 规范对齐摘要
- 已阅读：修复指令头5.2、AI板块整体架构说明、AI 服务研发规范、AI 核心服务规范、JSON清洗与语言过滤规范、文件结构、数据库结构_DRIVEQUIZ、数据库结构_AI_SERVICE
- 边界约束：
  - 仅在前端调整「error → 文案」映射，不改变 OAuth 安全校验逻辑
  - 不修改 `src/lib/providers/line.ts`、ai-core、ai-service、local-ai-service
  - 错误回退入口仅限：`/login/error`、`/login`
  - 错误提示不出现“环境变量”字样，不使用“系统配置异常”文案
  - 数据库结构不变（已复读两份结构文档）
- 报告路径：本文件即 v4 执行报告

## 问题复现与现状
- 复现 URL（示例）：`/login/error?error=Configuration`
- 服务器日志指示：`InvalidCheck / state cookie was missing`
- 结论：NextAuth 将该类错误统一标成 `error=Configuration`，本质属于 Safari 私密模式 / 外部 App 打开导致的验证失败

## 修改文件与内容
- `src/app/login/error/page.tsx`
  - 去除对 `code` 的依赖，仅读取 `error`
  - 错误分类：`Configuration` 一律映射为 `invalidCheck`
  - 文案替换：
    - invalidCheck → “由于浏览器的隐私设置或从外部应用打开，本次登录验证失败。请在浏览器普通模式重新打开本网站并再试一次。”
    - oauth / session / generic → 保持通用失败/会话失效/第三方登录失败提示
  - 清除“系统配置异常”分支与文案
- `src/app/api/auth/error/route.ts`
  - 保持简单透传 `error` 与 `code` 并记录日志（前端不再依赖 `code`）

## 错误映射表（v4）
| error | kind | 展示文案 |
| --- | --- | --- |
| OAuthSignin/OAuthCallback/OAuthCreateAccount/OAuthAccountNotLinked | oauth | 第三方登录失败，请重新尝试或更换登录方式。 |
| SessionRequired | session | 登录会话已过期，请重新登录。 |
| Configuration | invalidCheck | 由于浏览器的隐私设置或从外部应用打开，本次登录验证失败。请在浏览器普通模式重新打开本网站并再试一次。 |
| 其它/空 | generic | 登录会话已失效，请重新尝试。 |

## 自测矩阵
- Mac（普通）
  - 手动访问 `/login/error?error=Configuration` → 标题“登录失败”，文案为隐私设置/外部应用提示；不出现“系统配置异常”
- Mac（Incognito）
  - 同上
- iPhone Safari（普通）
  - 正常用 LINE/Google 登录，预期成功，不出现错误页
- iPhone Safari（私密模式）
  - LINE/Google 登录失败时 URL 为 `/login/error?error=Configuration` → 新文案生效，不出现“系统配置异常，请稍后重试或联系管理员。”

## 风险评估
- 未改变 OAuth state 校验逻辑，仅调整前端文案映射
- 真实配置/env 错误仍由服务器日志体现，不在前端显示

— 完 —
