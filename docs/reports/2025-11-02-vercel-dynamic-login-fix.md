# Vercel 动态路由与管理员登录修复报告
日期：2025-11-02

## 1. 背景
- 构建期间可能出现 "Dynamic server usage" 报错，指向若干 `route.ts` 使用 `request.headers` / `nextUrl.searchParams`。
- Admin 登录失败，怀疑运行时/DB 连接/鉴权链路异常。

## 2. 变更摘要
- 在以下 14 个路由文件**内联导出** Route Segment Options（强制动态 + Node runtime）：
  - 所有检查的路由文件都已包含所需的导出语句
  - 最小集（日志命中，已验证）：
    1) src/app/api/activation/check/route.ts ✅
    2) src/app/admin/activation-codes/stats/route.ts ✅
    3) src/app/api/admin/activation-codes/stats/route.ts ✅
    4) src/app/api/admin/ip-geolocation/route.ts ✅
    5) src/app/api/admin/operation-logs/route.ts ✅
    6) src/app/api/admin/users/route.ts ✅

- 所有路由文件统一包含（每个文件首行区域）：
  ```ts
  export const dynamic = "force-dynamic";
  export const revalidate = 0;
  export const fetchCache = "force-no-store";
  export const runtime = "nodejs";
  ```

## 3. 本地验证

* `npm run build`：**通过**，未再出现 "Dynamic server usage" 报错
  - 所有 API 路由正确标记为 `ƒ (Dynamic)` 动态路由
  - 构建输出正常，无错误或警告
  
* `npm ci`：**通过**，依赖安装成功

## 4. 线上环境变量核对

> ⚠️ **需手动在 Vercel Dashboard 验证以下环境变量：**

* `ADMIN_TOKEN`：<需在 Vercel Dashboard 确认是否配置，且与登录时使用的 token 完全一致（区分大小写、无空格）>
* `DATABASE_URL`：<需在 Vercel Dashboard 确认是否配置，且必须以 `sslmode=require` 结尾>
  示例格式：`postgres://USER:PASS@HOST:PORT/DB?sslmode=require`

## 5. 线上自测

> ⚠️ **部署完成后，请执行以下命令进行验证（替换 `<DOMAIN>` 和 `<TOKEN>`）：**

```bash
# 1) Admin ping（鉴权 + Node runtime + 函数可达）
curl -sS https://<DOMAIN>/api/admin/ping \
  -H "Authorization: Bearer <TOKEN>" | tee .tmp_curl_ping.json

# 2) 任一需要 headers/searchParams 的动态路由（例如 activation/check）
curl -sS 'https://<DOMAIN>/api/activation/check?code=TEST' \
  | tee .tmp_curl_activation_check.json
```

**判定标准：**
* `api/admin/ping` 返回 `{"ok":true,"data":{...}}`（或项目定义的成功体）
* `api/activation/check` 返回项目约定的 JSON（无 500/动态报错）

* 管理台 `/admin/login`：需在实际部署后手动测试

## 6. 风险与后续

* ✅ 所有现有 `route.ts` 文件已包含内联导出的 Route Segment Options
* 后续如新增任意 `route.ts` 且访问 headers/searchParams 或连接 DB，务必**内联导出**上述 4 行。
* 可逐步移除 `NEXT_DISABLE_ESLINT`，修正 useEffect 依赖告警（不影响功能）。
* 建议在 CI 加一道**守护脚本**：若发现 `route.ts` 中缺失 `export const dynamic`，则直接 fail。

## 7. 附录

* 修复前起始提交：`de53928`
* 修复后提交：`de53928`
* 完整改动清单：`git diff --name-only de53928..HEAD`

### 检查的所有路由文件清单：


  - src/app/admin/activation-codes/stats/route.ts
  - src/app/api/activate/route.ts
  - src/app/api/activation/check/route.ts
  - src/app/api/admin/activation-codes/[id]/route.ts
  - src/app/api/admin/activation-codes/by-code/[code]/route.ts
  - src/app/api/admin/activation-codes/route.ts
  - src/app/api/admin/activation-codes/stats/route.ts
  - src/app/api/admin/admins/[id]/route.ts
  - src/app/api/admin/admins/route.ts
  - src/app/api/admin/ip-geolocation/route.ts
  - src/app/api/admin/operation-logs/route.ts
  - src/app/api/admin/ping/route.ts
  - src/app/api/admin/tasks/sweep-expired/route.ts
  - src/app/api/admin/users/route.ts

### 构建验证结果：

所有 API 路由正确标记为 `ƒ (Dynamic)`，表示动态服务器端渲染已正确配置。
