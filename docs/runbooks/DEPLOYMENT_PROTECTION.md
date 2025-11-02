# Vercel Deployment Protection 故障排查指南

## 问题现象

访问生产环境时出现以下问题：

1. **浏览器返回 403 Forbidden**
2. **显示 Vercel Authentication 页面**（要求输入密码或 SSO 登录）
3. **管理员登录页面 `/admin/login` 无法加载或卡住**
4. **API 路由无法访问**

## 根本原因

Vercel **Deployment Protection**（部署保护）功能拦截了流量，导致请求在到达 Next.js 应用之前就被拦截。

Deployment Protection 包括：
- **Password Protection**：密码保护
- **SSO Protection**：单点登录保护
- **Preview Protection**：预览分支保护

当启用这些保护时，Vercel 会在请求到达应用之前进行身份验证，导致：
- 所有流量（包括 API 路由）都会被拦截
- Next.js 应用无法处理请求
- 浏览器收到 403 或认证页面

## 解决方案

### 方案 A：关闭生产环境 Deployment Protection（推荐）

适用于正式生产环境，允许公开访问。

**操作步骤：**

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目
3. 进入 **Settings** → **Security** → **Deployment Protection**
4. 找到 **Production** 环境的保护设置
5. 关闭以下保护：
   - **Password Protection**：Off
   - **SSO Protection**：Off（或将你的账户加入 Allowlist）

如果团队策略要求开启 SSO：
- 将你的账户加入允许列表（Allowlist）
- 或为生产域名单独关闭保护

**验证步骤：**

```bash
# 测试 API 是否可访问
./scripts/smoke-admin.sh https://<your-vercel-domain> <ADMIN_TOKEN>
```

预期输出：
```json
→ GET https://<domain>/api/admin/ping
{
  "ok": true,
  "data": {
    "service": "admin",
    "ts": "2025-11-02T..."
  }
}
→ GET https://<domain>/api/admin/users?limit=1
{
  "ok": true,
  "data": [...]
}
OK
```

### 方案 B：使用 Bypass Token（临时调试）

适用于自动化测试、CI/CD 或临时访问。

**获取 Bypass Token：**

1. 在 Vercel Dashboard → Settings → Security → Deployment Protection
2. 找到 **Bypass Token** 或 **Preview Bypass Token**
3. 复制 token

**使用方式：**

**方法 1：URL 参数（一次性设置 Cookie）**

访问以下 URL：
```
https://<domain>/<path>?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=<TOKEN>
```

浏览器会设置 Cookie，后续访问无需再带参数。

**方法 2：手动设置 Cookie（自动化脚本）**

在请求前先访问设置 Cookie 的 URL：
```bash
curl "https://<domain>/?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=<TOKEN>"
# 后续请求会使用该 Cookie
curl "https://<domain>/api/admin/ping" -H "Authorization: Bearer $ADMIN_TOKEN"
```

**方法 3：使用 Vercel MCP（如果可用）**

如果已配置 Vercel MCP，可以使用 `get_access_to_vercel_url` 获取 bypass token：
```bash
# 使用 MCP 工具获取 token
vercel-bypass-token=$(vercel-mcp-get-bypass-token)
curl "https://<domain>/?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=$vercel-bypass-token"
```

**验证：**

设置 Cookie 后，运行自测脚本：
```bash
./scripts/smoke-admin.sh https://<domain> <ADMIN_TOKEN>
```

## 预防措施

1. **部署前检查**：在部署到生产环境前，确认 Deployment Protection 已正确配置
2. **文档记录**：在项目文档中记录保护设置状态
3. **测试脚本**：使用 `scripts/smoke-admin.sh` 定期验证 API 可访问性

## 相关文档

- [Vercel Deployment Protection 官方文档](https://vercel.com/docs/security/deployment-protection)
- [Vercel Bypass Token 文档](https://vercel.com/docs/security/deployment-protection#bypassing-protection)

## 故障排查检查清单

- [ ] 检查 Vercel Dashboard → Settings → Security → Deployment Protection
- [ ] 确认 Production 环境保护已关闭（或已配置允许列表）
- [ ] 使用 `curl` 测试 API 是否可访问
- [ ] 检查浏览器控制台是否有 403 错误
- [ ] 验证 `scripts/smoke-admin.sh` 能否成功调用 API
- [ ] 检查 Vercel 部署日志是否有认证相关的错误

