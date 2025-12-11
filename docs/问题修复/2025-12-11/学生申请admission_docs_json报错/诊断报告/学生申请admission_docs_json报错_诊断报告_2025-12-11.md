# 学生申请 admission_docs JSON 写入报错 - 诊断报告（2025-12-11）

## 问题概述
- 现网 `/api/student/verification` 提交学生免费申请时返回 400，`errorCode: DB_ERROR`，`message: invalid input syntax for type json`。
- 前端 payload 已包含 Supabase 返回的文件元信息（fileId/bucket/url/name/size/mimeType），符合最新前端实现。
- 报错发生在写入数据库 `student_verifications.admission_docs` 时，PostgreSQL 认为接收到的 JSON 文本非法。

## 复现请求与响应
- 请求 URL：`POST https://ai.zalem.app/api/student/verification`
- 请求体（示例）：
  ```json
  {
    "fullName": "刘永哲",
    "nationality": "中国",
    "email": "1@1.com",
    "phoneNumber": "123123123",
    "channelSource": "小红书",
    "schoolName": "足利",
    "studyPeriodFrom": "2025-12-04",
    "studyPeriodTo": "2026-01-02",
    "admissionDocs": [
      {
        "fileId": "student_docs/1/1765420991691_b9cafec9-325e-4d59-b2e6-f8062d94f309.jpg",
        "bucket": "student-docs",
        "url": "https://vdtnzjvmvrcdplawwiae.supabase.co/storage/v1/object/public/student-docs/student_docs/1/1765420991691_b9cafec9-325e-4d59-b2e6-f8062d94f309.jpg",
        "name": "微信开放平台网站信息登记表.jpg",
        "size": 298861,
        "mimeType": "image/jpeg"
      }
    ]
  }
  ```
- 响应：
  ```json
  { "ok": false, "errorCode": "DB_ERROR", "message": "invalid input syntax for type json" }
  ```

## 代码侧现状（已查阅）
- `src/app/api/student/verification/route.ts`
  - 入参校验 `admissionDocs`，确保 fileId/bucket/url/name 必填，其余可选。
  - 将 `admissionDocs` 归一化后，映射为纯对象数组 `docsForDb`（剔除 `undefined`），直接传给 service。
  - `catch` 中只要 message 包含 `invalid`/`syntax` 即返回 `DB_ERROR 400`。
- `src/lib/studentVerification.ts`
  - `upsertPendingVerification` 直接将 `payload.admission_docs` 作为值写入 Kysely insert/update，无显式 `JSON.stringify`。
- `src/lib/db.ts`
  - `student_verifications.admission_docs` 类型声明为自定义 `Json | null`（union of primitives/object/array），避免 `any`/`string`。

## 现象研判与可能原因
1) **生产环境未使用最新代码**：若部署版本仍停留在此前字符串化 admission_docs 的版本，会在 PG cast 时触发同样的 `invalid input syntax for type json`。需确认线上 commit 是否已包含 `cf5e9b1` 及之前的 JSON 清洗修复。  
2) **数据库列类型或驱动推断问题**：若 `student_verifications.admission_docs` 列在主库不是 json/jsonb，或类型不匹配（例如 text/其他自定义类型），PG 在尝试将对象参数转换时会报 syntax 错误。当前仓库未找到包含该表的 migration/sql，需到 DB 实际确认列类型。  
3) **参数仍被序列化为非法文本**：尽管代码已使用对象数组，但若某层（ORM/驱动或上游代理）将对象转成 `'[object Object]'` 等非法 JSON，PG 会报相同错误。需要在生产环境添加日志或使用 `to_json`/`jsonb` 显式绑定确认传入值。  
4) **旧数据更新路径**：如果存在 pending 记录更新流程里仍用字符串形式的 admission_docs（历史数据），更新时也可能触发同样错误，需检查 DB 现有数据形态。

## 已采取/已知措施
- 本地代码已：
  - 使用 JSON 类型映射 admission_docs（避免 any/string）。
  - 生成 `docsForDb` 为纯 JSON 对象数组，删除 `undefined`。
  - 本地 `npm run build` 通过，未再出现编译错误。
- 仍未执行：
  - 生产 DB 列类型核对与实际写入值日志。
  - 生产环境 cURL/Proxy 直连验证最新部署版本。

## 下一步建议（不含修复实现）
1) **确认线上版本**：对比 Vercel/部署环境当前运行的 commit，与 `cf5e9b1` 是否一致；如未更新需重新部署。  
2) **核对 DB 架构**：在主库执行 `\d+ student_verifications` 或查询 information_schema，确认 `admission_docs` 类型应为 `jsonb`；若为 text/varchar 需评估迁移或显式 cast 策略。  
3) **记录实际入库参数**：在生产 API 临时增加日志（或通过 PG 日志/代理）打印 `docsForDb`，检查是否存在 `[object Object]` 或空字符串等非法 JSON。  
4) **校验历史数据/更新路径**：抽样当前表数据，确认是否已有非 JSON 形态的旧值导致 update 失败；必要时在更新前清洗/转换。  
5) **复测**：部署/确认后，用上述同一 payload 复测，预期 200/201 且 `admission_docs` 为 JSON 数组。

## 其他备注
- 未触及 ai-core / ai-service / local-ai-service 代码。
- 需继续按照公司规范补齐后续“解决指令”“执行计划”“执行报告”文件夹（本次仅输出诊断报告）。
