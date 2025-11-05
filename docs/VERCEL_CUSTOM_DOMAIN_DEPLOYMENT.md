# Vercel 自定义域名部署指南

## 目标
将 Vercel 生产环境部署到 `www.zalem.app/ai` 下

## 步骤

### 1. 配置 Next.js basePath

✅ **已完成**：`next.config.js` 已配置 `basePath: '/ai'`

这会让所有路由自动添加 `/ai` 前缀：
- `/` → `/ai/`
- `/admin` → `/ai/admin`
- `/api/ai/ask` → `/ai/api/ai/ask`

### 2. 在 Vercel 中添加自定义域名

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** → **Domains**
4. 点击 **Add Domain**
5. 输入域名：`www.zalem.app`
6. 点击 **Add**

### 3. 配置 DNS 记录

在你的域名提供商（如 Cloudflare、GoDaddy 等）配置以下 DNS 记录：

#### 选项 A：使用 CNAME（推荐）

```
类型: CNAME
名称: www
值: cname.vercel-dns.com
TTL: 3600 (或自动)
```

#### 选项 B：使用 A 记录

如果 CNAME 不可用，使用 A 记录：

```
类型: A
名称: www
值: 76.76.21.21 (Vercel 的 IP)
TTL: 3600
```

**注意**：Vercel 的 IP 地址可能会变化，建议使用 CNAME。

### 4. 验证 DNS 配置

在 Vercel Dashboard 中：
1. 等待 DNS 验证（通常几分钟到几小时）
2. 检查域名状态，应该显示 **Valid Configuration**

### 5. 配置环境变量（可选）

如果需要动态控制 basePath，可以在 Vercel 中设置环境变量：

```
NEXT_PUBLIC_BASE_PATH=/ai
```

**注意**：当前配置已经默认使用 `/ai`，所以这个环境变量是可选的。

### 6. 部署验证

部署完成后，访问以下 URL 验证：

- 主页：`https://www.zalem.app/ai`
- Admin 页面：`https://www.zalem.app/ai/admin`
- API 路由：`https://www.zalem.app/ai/api/admin/ping`

### 7. 重要注意事项

#### ✅ 自动处理的部分

Next.js 的 `basePath` 会自动处理：
- 所有路由（`/` → `/ai/`）
- 所有 API 路由（`/api/*` → `/ai/api/*`）
- 静态资源（`/_next/static/*` → `/ai/_next/static/*`）
- `Link` 组件的路径
- `useRouter()` 的路径

#### ⚠️ 需要检查的部分

以下代码使用了 `window.location.origin`，应该会自动适配：

```typescript
// 这些代码会自动使用正确的 origin
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin; // ✅ 自动包含 /ai
  }
  return process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
}
```

#### 🔧 如果遇到问题

1. **路径 404 错误**
   - 检查 `next.config.js` 中的 `basePath` 是否正确
   - 清除浏览器缓存
   - 检查 Vercel 部署日志

2. **API 路由不工作**
   - 确保 API 路由使用相对路径（如 `/api/ai/ask`）
   - 不要使用绝对路径（如 `https://www.zalem.app/api/ai/ask`）

3. **静态资源加载失败**
   - Next.js 会自动处理，但确保 `basePath` 配置正确

4. **环境变量问题**
   - 检查 Vercel 环境变量设置
   - 确保 `NEXT_PUBLIC_*` 变量在构建时可用

### 8. 回滚方案

如果需要回滚到根路径部署：

1. 修改 `next.config.js`：
   ```javascript
   basePath: '', // 或删除这行
   ```

2. 或者在 Vercel 环境变量中设置：
   ```
   NEXT_PUBLIC_BASE_PATH=
   ```

3. 重新部署

### 9. 测试清单

部署后，测试以下功能：

- [ ] 主页可以访问：`https://www.zalem.app/ai`
- [ ] Admin 登录页面：`https://www.zalem.app/ai/admin/login`
- [ ] API 路由正常：`https://www.zalem.app/ai/api/admin/ping`
- [ ] 静态资源加载正常（CSS、JS、图片）
- [ ] 内部链接正常工作
- [ ] 浏览器刷新不会 404

### 10. 相关文档

- [Next.js basePath 文档](https://nextjs.org/docs/app/api-reference/next-config-js/basePath)
- [Vercel 自定义域名文档](https://vercel.com/docs/concepts/projects/domains)
- [DNS 配置指南](https://vercel.com/docs/concepts/projects/domains/add-a-domain)

