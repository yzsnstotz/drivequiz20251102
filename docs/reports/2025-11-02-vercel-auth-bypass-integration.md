# Vercel Authentication Bypass Integration 修复报告

**日期**: 2025-11-02  
**问题**: API 请求返回 HTML（Vercel Authentication 拦截）而非 JSON  
**状态**: ✅ 已修复

---

## 一、诊断结论

### 问题现象
访问部署在 Vercel 的 API 端点时，返回 `401` 状态码，响应体为 HTML 而非预期的 JSON：
- Content-Type: `text/html`
- 响应体包含：`<title>Authentication Required</title>`
- 这是 **Vercel Authentication（Deployment Protection）** 在环境生效导致的拦截

### 根本原因
Vercel 在请求到达 Next.js 应用之前就进行了身份验证检查：
1. 当 Preview/Production 环境启用了 **Vercel Authentication** 时
2. 未携带有效的 bypass cookie 的请求会被拦截
3. 返回 HTML 认证页面，而不是转发到应用

---

## 二、已改动文件清单

### 1. `scripts/smoke-admin.sh`
- ✅ 新增 `--bypass <TOKEN>` 参数支持
- ✅ 自动在请求前设置 bypass cookie（如果提供了 token）
- ✅ 检测返回是否为 HTML（Vercel Auth 拦截），并给出明确提示
- ✅ 退出码 3 表示仍被 Vercel Auth 拦截

### 2. `scripts/vercel-bypass.sh`（新增）
- ✅ 单独封装“种 cookie + 校验”的两步流程
- ✅ 用于测试 bypass token 是否生效

### 3. `src/lib/apiClient.ts`
- ✅ 在 `request()` 函数中检测 HTML 响应
- ✅ 在 `apiFetch()` 函数中检测 HTML 响应
- ✅ 当检测到 Vercel Auth 拦截时，抛出明确的错误：
  - 错误码：`VERCEL_AUTH_BLOCKED`
  - 错误消息包含解决方案和文档链接

### 4. `docs/runbooks/DEPLOYMENT_PROTECTION.md`（更新）
- ✅ 更新为更清晰的格式和步骤
- ✅ 添加脚本工具说明
- ✅ 添加前端自动检测说明
- ✅ 添加常见误区说明

---

## 三、如何在 Preview/Production 关闭 Authentication

### 步骤
1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目
3. 进入 **Settings** → **Security** → **Vercel Authentication**
4. 找到 **Preview** 和 **Production** 环境的设置
5. 将对应环境的 **Vercel Authentication** 开关关闭（Off）
6. 保存设置

### 注意事项
- 不同环境（Preview、Production）可分别开关
- 预览分支的随机 URL 通常属于 Preview 环境
- 关闭后需要等待几秒钟生效

---

## 四、如何生成并使用 Bypass Token

### 生成 Bypass Token
1. Vercel Dashboard → Settings → Security → **Protection Bypass for Automation**
2. 点击 **Generate Token**
3. 复制生成的 token（只显示一次，请妥善保存）

### 使用方式

#### 方法 1：浏览器手动访问
访问以下 URL（替换 `<domain>` 和 `<TOKEN>`）：
```
https://<domain>/api/admin/ping?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=<TOKEN>
```
浏览器会自动种下 bypass cookie，后续请求会自动携带。

#### 方法 2：使用 `scripts/smoke-admin.sh`
```bash
./scripts/smoke-admin.sh https://<domain> <ADMIN_TOKEN> --bypass <VERCEL_BYPASS_TOKEN>
```

示例：
```bash
./scripts/smoke-admin.sh https://example.vercel.app my-admin-token --bypass vercel_bypass_token_abc123
```

#### 方法 3：使用 `scripts/vercel-bypass.sh`
仅测试 bypass cookie 是否生效：
```bash
./scripts/vercel-bypass.sh https://<domain> <VERCEL_BYPASS_TOKEN>
```

示例：
```bash
./scripts/vercel-bypass.sh https://example.vercel.app vercel_bypass_token_abc123
```

---

## 五、验证截图/命令示例

### 成功案例（未启用 Vercel Auth）
```bash
$ ./scripts/smoke-admin.sh https://example.vercel.app admin-token-here
→ GET https://example.vercel.app/api/admin/ping
✔ Admin ping passed.
```

### 失败案例（被 Vercel Auth 拦截，未使用 bypass）
```bash
$ ./scripts/smoke-admin.sh https://example.vercel.app admin-token-here
→ GET https://example.vercel.app/api/admin/ping
✖ Still seeing Vercel Authentication HTML (status 401).
  → 说明该环境仍开启了 Vercel Authentication，或 bypass token 无效/未生效。
```

### 成功案例（使用 bypass token）
```bash
$ ./scripts/smoke-admin.sh https://example.vercel.app admin-token-here --bypass vercel_bypass_token_abc123
→ Set Vercel bypass cookie...
→ GET https://example.vercel.app/api/admin/ping
✔ Admin ping passed.
```

### curl 命令示例
```bash
# 设置 bypass cookie
curl -c cookies.txt "https://example.vercel.app/api/admin/ping?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=vercel_bypass_token_abc123"

# 使用 cookie 访问 API
curl -b cookies.txt -H "Authorization: Bearer admin-token-here" "https://example.vercel.app/api/admin/ping"
```

预期返回：
```json
{
  "ok": true,
  "data": {
    "service": "admin",
    "ts": "2025-11-02T..."
  }
}
```

---

## 六、前端错误提示示例

当前端 `apiClient.ts` 检测到 Vercel Auth 拦截时，会抛出如下错误：

```javascript
ApiError {
  status: 401,
  errorCode: "VERCEL_AUTH_BLOCKED",
  message: "[VercelAuth] 当前环境启用了 Vercel Authentication，未携带 bypass cookie，已被拦截。 解决方案：1) 在 Vercel 控制台关闭 Preview/Production 的 Authentication； 2) 使用 bypass token 访问一次：?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=<TOKEN>； 详见 docs/runbooks/DEPLOYMENT_PROTECTION.md"
}
```

---

## 七、后续建议

1. **开发环境**：建议关闭 Vercel Authentication，避免开发时的困扰
2. **生产环境**：根据安全需求决定是否启用
3. **自动化测试**：使用 bypass token 配合 CI/CD 脚本
4. **监控**：定期运行 `scripts/smoke-admin.sh` 验证 API 可访问性

---

## 相关文件

- `scripts/smoke-admin.sh` - 增强的管理员 API 测试脚本
- `scripts/vercel-bypass.sh` - Bypass cookie 设置与验证脚本
- `src/lib/apiClient.ts` - 前端 API 客户端（包含 Vercel Auth 检测）
- `docs/runbooks/DEPLOYMENT_PROTECTION.md` - 完整排查指南

---

**修复完成时间**: 2025-11-02  
**提交**: `chore(devops): add vercel bypass scripts; front-end detects VercelAuth HTML; add runbook`

