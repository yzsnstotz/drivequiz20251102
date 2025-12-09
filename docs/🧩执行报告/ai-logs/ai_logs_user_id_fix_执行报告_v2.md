# ai_logs.user_id 统一为 users.id（UUID）执行报告 v2

## 任务摘要
- 修复因过严校验/会话获取不一致导致 ai_logs 全部匿名的问题，保持方案 A：只写 `users.id`（UUID），匿名为 `null`。
- 范围：Next.js 主服务 API（`/api/ai/chat`、`/api/ai/log`）及 userId 解析工具；未改 ai-core / ai-service。

## 修改文件
- `src/app/api/ai/_lib/logUserIdResolver.ts`
- `src/app/api/ai/chat/route.ts`
- `apps/web/app/api/ai/chat/route.ts`
- `src/app/api/ai/log/route.ts`
- `src/lib/version.ts`

## 核心变更点
- 放宽校验并新增回退映射：
  - 首选 `auth()` Session 获取 `session.user.id`，仅做长度>=16判断。
  - 回退 `getUserInfo(req)` 获取 `userid`/`act-*`，若非 UUID，查询 `users.userid -> users.id` 进行映射。
  - 写入 ai_logs 依旧只存 `users.id` 或 `null`，忽略 body/header/USER_ID。
- 路由 `/api/ai/chat` 与 `/api/ai/log` 继续调用统一 resolver，无再使用 body/userInfo 写 userId。
- 版本号更新：`BUILD_TIME = 2025-12-09 15:30:00`。

## 问题原因补充
- 先前 resolver 使用严格 UUID 正则，Session 获取稍有异常即返回 null，导致实际场景几乎全匿名。
- 未对 legacy `userid`/`act-*` 做映射，旧调用路径落入匿名。

## 验证结果（本地）
- 构建：`npm run build` 通过。
- 手工逻辑自查：
  - 已登录：resolver 优先返回 Session `users.id`；若 Session 缺失、存在 `userid/act-*`，会映射为 `users.id`。
  - 未登录：返回 null，匿名行为保持。
- 未执行 `pnpm lint/test/build`（环境未安装 pnpm）；如需请在有 pnpm 的环境补跑：`pnpm install && pnpm lint && pnpm build`。

## 风险与后续建议
- 历史数据仍含混合 user_id，本次仅影响新增写入；后续需数据清洗统一历史。
- 若 DB 中 `userid` 无匹配记录，将返回 null，需关注匿名比例变化以判断数据质量。

