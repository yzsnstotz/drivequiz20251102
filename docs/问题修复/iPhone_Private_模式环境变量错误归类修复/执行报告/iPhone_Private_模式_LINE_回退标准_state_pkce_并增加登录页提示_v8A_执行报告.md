# iPhone Private 模式 · LINE 回退标准 state+pkce 并增加登录页提示 v8-A 执行报告

## 规范对齐摘要
- 边界：仅修改 `src/lib/providers/line.ts`、`src/app/login/page.tsx`、`src/lib/version.ts`；不改 Provider 其它配置、不改 `/api/auth/[...nextauth]` 路由、不改 AI 模块、不改数据库结构
- 红线遵守：A1（路由不承载业务逻辑）、E1/E7/E8（最小变更集）、D1（生成执行报告）
- 保持既有 OAuth 链路：`/api/auth/[...nextauth]` → `/login` → `/login/error`
- 已阅读：指令头 5.2、AI 架构规范、AI 服务与核心规范、JSON 清洗与语言过滤规范、文件结构、两份数据库结构文档（确认无 DB 变更）

## 问题结论
- Private 模式下第三方登录（尤其 LINE 内置浏览器、Safari Private）存在 cookie/回调限制，无法保证稳定登录
- 产品策略：回退到标准安全配置（`checks: ["pkce", "state"]`）保障非私密环境 100% 正常；在登录页增加提示，明确告知用户在私密模式或 LINE 内置浏览器登录可能失败，建议使用普通浏览器或手机号登录

## 文件改动列表
- `src/lib/providers/line.ts:15`：
```diff
-    checks: ["pkce"],
+    checks: ["pkce", "state"],
```
- `src/app/login/page.tsx:293` 附近（第三方登录按钮区域下方）新增提示文案（跟随语言 `zh/ja/en`）：
  - 中文：在 LINE App 内浏览器或 Safari 的无痕 / 私密模式下，可能无法正常使用第三方账号登录。请在浏览器普通模式重新打开本网站，或改用手机号登录。
  - 日文：LINEアプリ内ブラウザや Safari のプライベートモードでは、外部サービスでのログインが正しく動作しない場合があります。通常モードのブラウザでこのサイトを開くか、電話番号でのログインをお試しください。
  - 英文：Note: Logging in with third-party accounts may not work in the LINE in-app browser or in Safari Private mode. Please open this site in a normal browser window or use phone-number login instead.
- `src/lib/version.ts:13`：`BUILD_TIME = "2025-12-07 01:10:00"`

## 构建与自测
- 构建命令：`npm run build`
- 结果：构建成功，无新增 TS/ESLint error（保留若干既有 warning）

### 自测矩阵（说明）
- Mac / iPhone 普通模式 + LINE 登录：预期正常登录，进入站内
- iPhone Safari Private 模式 + LINE 登录：可能失败，错误页提示“隐私设置 / 外部应用导致验证失败”；登录页底部显示新增提示文案
- 登录页：在 `zh / ja / en` 三种语言下均显示对应提示文案
- 其它 Provider（Google、手机号等）：不受影响

## 风险与后续建议
- 将 Private 模式不兼容作为已知限制；如需强兼容，需要产品与安全重新评估（涉及风控与 UX 变更）

---

（完）
