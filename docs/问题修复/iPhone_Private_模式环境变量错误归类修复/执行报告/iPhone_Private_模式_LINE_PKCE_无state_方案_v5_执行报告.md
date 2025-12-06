# iPhone Private 模式 · LINE PKCE 无 state 方案 v5 执行报告

## 规范对齐摘要
- 已读取：`docs/🔧指令模版/修复指令头5.2（现用）.md`、`AI板块整体架构说明.md`、`AI 服务研发规范 v1.0.md`、`AI 核心服务规范 v2.0.md`、`JSON清洗与语言过滤规范.md`、`文件结构.md`、`数据库结构_DRIVEQUIZ.md`、`数据库结构_AI_SERVICE.md`
- 约束遵守：A1（路由不承载业务）、B1-B4（无 DB/文件结构变更）、D1-D2（生成完整报告、红线自检）、E1-E10（最小变更集、无冗余）、F1-F5（不修改 AI 模块）
- 修改文件：`src/lib/providers/line.ts`
- 不涉及数据库结构变更；不新增/删除文件结构；不改 `/api/auth/[...nextauth]` 路由与 `/login/error` 文案
- 保持既有 OAuth 回调链路：`/api/auth/[...nextauth]`、`/login`、`/login/error`

## 问题描述
- 现象：在 iPhone Safari Private 模式 + LINE 登录，回到 `https://ai.zalem.app/login/error?error=Configuration`
- 日志特征：`[NextAuth][Error] w: state value could not be parsed ... type: 'InvalidCheck', cause: state cookie was missing`
- 原因：NextAuth 默认 `checks: ["pkce", "state"]`；Safari Private / LINE 内嵌浏览器中 `state` 所需 cookie 丢失；触发 `InvalidCheck` 拒绝登录

## 修改方案
- 目标：仅对 LINE Provider 关闭 `state` 检查，保留 `PKCE`
- 变更：将 LINE Provider 的 `checks` 从 `state`/默认值 调整为仅 `pkce`
- 范围：仅 LINE，其他 Provider（Google/Email/WeChat/Twitter/Facebook）不变

### 代码改动
- 文件：`src/lib/providers/line.ts`
- 位置：`src/lib/providers/line.ts:15`
- 变更：
```diff
-    checks: ["state"],
+    checks: ["pkce"],
```

## 简短安全评估
- 保留 PKCE：仍有效防止授权码拦截与重放
- 去除 state：降低一层 CSRF 防护，仅针对 LINE 生效；当前业务风险可接受，后续在涉及高价值资产操作前应评估是否恢复 state 或引入其他风控（如 nonce、referer 校验、额外交互验证码）

## 文件改动列表
- `src/lib/providers/line.ts`：最小改动，将 `checks` 显式设置为 `["pkce"]`，不改授权 URL/参数、不改 token/userinfo、不新增自定义 cookie/逻辑

## 构建与自测
### 本地构建
- 命令：`npm run build`
- 结果：构建成功（0 错误，若干 ESLint warning 与 React hooks 提示，记录但本次不处理）

### 自测矩阵
| 设备 | 浏览器模式 | Provider | 结果 |
| --- | --- | --- | --- |
| Mac | 非私密模式 | LINE | 预计正常（无 `/login/error`），待线上验证 |
| Mac | 私密/无痕 | LINE | 预计正常（state 不再校验），待线上验证 |
| iPhone Safari | 普通模式 | LINE | 预计正常登录，无 `InvalidCheck`，待线上验证 |
| iPhone Safari | Private 模式 | LINE | 预计不再出现 `InvalidCheck / state cookie was missing`；登录成功或用户取消授权，待线上验证 |

备注：错误页 `/login/error` 已支持 `Configuration → invalidCheck` 分类展示，文案保持现状；上线后如仍有失败，将在报告增补具体 URL 与服务端日志类型。

## 风险与后续建议
- 若未来涉及高价值资产或强 CSRF 防护场景，建议：
  - 评估恢复 `state` 或采用替代机制（nonce、双提交 cookie、同源校验）
  - 针对 LINE 内嵌浏览器与 Safari Private 的 cookie 行为做兼容策略说明

## 红线自检（A1–E10）
- A1 路由不承载业务：已遵守
- A2–A4 架构统一/接口一致：不适用本次改动，保持不变
- B1–B4 数据库/文件结构：已遵守（无变更）
- C1–C3 AI 双环境测试：不适用（非 AI 模块改动）
- D1–D2 执行报告与规范标注：已遵守
- E1–E10 反冗余与最小变更：已遵守（仅一处最小改动，无冗余）

## AI 模块边界自检（F1–F5）
- 未修改 `ai-core` / `ai-service` / `local-ai-service`：YES
- 未新增本地 AI 逻辑、未绕过 ai-core：YES
- 本次任务无需 AI 协同调整建议：YES

## 冗余检测
- 是否存在重复逻辑：NO
- 是否清理所有旧逻辑：YES（移除 state 校验，仅保留 PKCE）
- 是否存在未引用新增代码：NO
- 是否减少不必要请求：YES（无新增请求，维持原链路）

## 参考与现象溯源
- 线上现象：`https://ai.zalem.app/login/error?error=Configuration`（Private 模式登录失败）
- 错误分组：错误页已将 `Configuration` 映射为 `invalidCheck` 并提示“隐私设置或外部应用打开导致验证失败”

## 提交规范
- 建议提交信息：`feat(auth): relax LINE OAuth checks to pkce-only to support Safari Private mode login`
- 提交与哈希：待审核后提交；本报告编制时未执行提交/推送

---

（完）
