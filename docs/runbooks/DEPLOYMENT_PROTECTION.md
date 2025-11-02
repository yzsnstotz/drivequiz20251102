# Vercel Deployment Protection / Authentication 旁路与排查

## 一、现象
- 访问接口返回 `401` 且是 HTML，页面标题为 `Authentication Required`。
- curl 显示 `set-cookie: _vercel_sso_nonce=...`。
- 这是 Vercel Authentication（Deployment Protection）在当前环境生效导致的。

## 二、解决方案（任选其一）
### 方案 A：关闭 Authentication（开发期推荐）
项目 Settings → Security → **Vercel Authentication**：
- 将 **Preview**、**Production** 对应的 Environment 勾选去掉（Off）
- 保存

> 注意：不同环境可分别开关。你的预览 URL（随机后缀）通常属于 Preview 环境。

### 方案 B：保留 Authentication，但使用 Bypass Token
Settings → Security → **Protection Bypass for Automation** → Generate Token  
拿到 `<TOKEN>` 后，先访问一次：

```
GET https://<domain>/api/admin/ping?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=<TOKEN>
```

浏览器会种下 bypass cookie；随后同一浏览器会绕过拦截。  
命令行可使用：

```bash
scripts/smoke-admin.sh https://<domain> <ADMIN_TOKEN> --bypass <TOKEN>
```

## 三、常见误区
- 仅访问 `?x-vercel-set-bypass-cookie=true` **不携带** token 无效。
- 关闭 Password Protection 但 **Vercel Authentication 仍开启**，依然会被拦截。
- 组织/Team 层设置或 Project 层设置不同步，确认在 **项目层** Security 中检查 Environment 勾选状态。

## 四、验证
- 运行：

```bash
./scripts/smoke-admin.sh https://<domain> <ADMIN_TOKEN> --bypass <TOKEN>
```

- 返回 JSON：`{ "ok": true, "data": { "service": "admin", ... } }` 即成功。

## 五、前端自动检测
前端 `apiClient.ts` 会自动检测 Vercel Authentication 拦截：
- 如果返回 `text/html` 且包含 `<title>Authentication Required</title>`，会抛出明确的错误提示
- 错误码：`VERCEL_AUTH_BLOCKED`
- 错误消息包含解决方案链接

## 六、脚本工具

### `scripts/smoke-admin.sh`
测试管理员 API 是否可访问，支持 bypass token：

```bash
./scripts/smoke-admin.sh <BASE_URL> <ADMIN_TOKEN> [--bypass <VERCEL_BYPASS_TOKEN>]
```

示例：
```bash
./scripts/smoke-admin.sh https://example.vercel.app admin-token-here --bypass vercel-bypass-token-here
```

### `scripts/vercel-bypass.sh`
单独封装“种 cookie + 校验”的两步：

```bash
./scripts/vercel-bypass.sh <BASE_URL> <VERCEL_BYPASS_TOKEN>
```

示例：
```bash
./scripts/vercel-bypass.sh https://example.vercel.app vercel-bypass-token-here
```

## 相关文档
- [Vercel Deployment Protection 官方文档](https://vercel.com/docs/security/deployment-protection)
- [Vercel Bypass Token 文档](https://vercel.com/docs/security/deployment-protection#bypassing-protection)
