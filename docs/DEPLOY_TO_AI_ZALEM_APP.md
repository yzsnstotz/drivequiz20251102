# 部署到 ai.zalem.app 子域名指南

## 🎯 目标

将应用部署到 `ai.zalem.app` 子域名（而不是 `www.zalem.app/ai` 子路径）

## ✅ 前置条件

1. ✅ `next.config.js` 已配置 `basePath: ''`（根路径，适用于子域名部署）
2. ✅ 域名 `zalem.app` 已在 Vercel 项目中配置
3. ✅ 有权限配置 DNS 记录

---

## 📋 部署步骤

### 步骤 1: 在 Vercel 中添加子域名

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** → **Domains**
4. 点击 **Add Domain**
5. 输入域名：`ai.zalem.app`
6. 点击 **Add**

### 步骤 2: 配置 DNS 记录

在你的域名提供商（如 Cloudflare、GoDaddy 等）配置以下 DNS 记录：

#### 选项 A：使用 CNAME（推荐）

在 Vercel Dashboard 中，添加域名时会显示具体的 DNS 记录值，使用该值：

```
类型: CNAME
名称: ai
值: 09ede71e4d815b55.vercel-dns-017.com.  (使用 Vercel 提供的具体值)
TTL: 3600 (或自动)
```

**注意**：Vercel 为每个项目生成的 DNS 记录值可能不同，请使用 Vercel Dashboard 中显示的具体值。

#### 选项 B：使用 A 记录

如果 CNAME 不可用，使用 A 记录：

```
类型: A
名称: ai
值: 76.76.21.21 (Vercel 的 IP)
TTL: 3600
```

**注意**：
- Vercel 的 IP 地址可能会变化，建议使用 CNAME
- 如果使用 A 记录，需要配置多个 IP 地址以提高可用性

### 步骤 3: 验证 DNS 配置

在 Vercel Dashboard 中：
1. 等待 DNS 验证（通常几分钟到几小时）
2. 检查域名状态，应该显示 **Valid Configuration**
3. 如果显示错误，检查 DNS 配置是否正确

**重要提示**：即使 Vercel 显示 "Valid Configuration"，DNS 传播和 SSL 证书生成可能需要额外时间：
- DNS 传播：通常 5-30 分钟，最长可能需要 48 小时
- SSL 证书生成：通常 10-30 分钟
- 建议等待 30 分钟后再测试访问

### 步骤 4: 清理环境变量（重要）

如果之前配置过 `NEXT_PUBLIC_BASE_PATH=/ai`，需要清理：

1. 进入 **Settings** → **Environment Variables**
2. 查找 `NEXT_PUBLIC_BASE_PATH` 变量
3. 如果存在且值为 `/ai`，**删除它**（因为子域名部署不需要 basePath）
4. 或者将其设置为空字符串 `''`

**为什么需要清理？**
- 子域名部署（`ai.zalem.app`）不需要 basePath
- basePath 只用于子路径部署（如 `www.zalem.app/ai`）
- 保留 `/ai` 会导致所有路由变成 `/ai/*`，访问会 404

### 步骤 5: 触发重新部署

1. 在 Vercel Dashboard 中，进入 **Deployments**
2. 点击最新部署旁边的 **...** 菜单
3. 选择 **Redeploy**
4. 或者推送新的代码到 Git 仓库触发自动部署

### 步骤 6: 验证部署

部署完成后，访问以下 URL 验证：

- ✅ 主页：`https://ai.zalem.app`
- ✅ Admin 登录页面：`https://ai.zalem.app/admin/login`
- ✅ API 路由：`https://ai.zalem.app/api/admin/ping`
- ✅ 静态资源：检查 CSS、JS、图片是否正常加载

---

## 🔍 验证清单

部署后，测试以下功能：

- [ ] 主页可以访问：`https://ai.zalem.app`
- [ ] Admin 登录页面：`https://ai.zalem.app/admin/login`
- [ ] API 路由正常：`https://ai.zalem.app/api/admin/ping`
- [ ] 静态资源加载正常（CSS、JS、图片）
- [ ] 内部链接正常工作（不需要 /ai 前缀）
- [ ] 浏览器刷新不会 404
- [ ] AI 助手功能正常：`https://ai.zalem.app`（点击 AI 按钮）

---

## ⚠️ 重要注意事项

### ✅ 子域名 vs 子路径的区别

| 部署方式 | 域名示例 | basePath | URL 示例 |
|---------|---------|----------|---------|
| 子域名 | `ai.zalem.app` | `''` (空) | `https://ai.zalem.app/` |
| 子路径 | `www.zalem.app/ai` | `'/ai'` | `https://www.zalem.app/ai/` |

**当前配置**：使用子域名部署，basePath 应为空字符串

### ✅ 自动处理的部分

Next.js 会自动处理：
- 所有路由（`/`、`/admin`、`/api/*` 等）
- 静态资源（`/_next/static/*`）
- `Link` 组件的路径
- `useRouter()` 的路径

### ⚠️ 需要检查的代码

确保代码中使用相对路径，而不是绝对路径：

```typescript
// ✅ 正确：使用相对路径
fetch('/api/ai/ask')

// ❌ 错误：使用绝对路径（硬编码）
fetch('https://www.zalem.app/api/ai/ask')
```

---

## 🔧 故障排除

### 问题 1: DNS 验证失败

**症状**：Vercel 显示 "Invalid Configuration"

**解决方案**：
1. 检查 DNS 记录是否正确配置
2. 等待 DNS 传播（可能需要几小时）
3. 使用 `dig ai.zalem.app` 或 `nslookup ai.zalem.app` 检查 DNS 解析

### 问题 1.5: DNS 已配置但无法访问

**症状**：Vercel 显示 "Valid Configuration"，但访问 `https://ai.zalem.app` 失败

**可能原因**：
1. DNS 传播还未完成（最常见）
2. SSL 证书还在生成中
3. 浏览器缓存了旧结果
4. 本地 DNS 缓存

**解决方案**：
1. **等待时间**：
   - DNS 传播：通常 5-30 分钟，最长 48 小时
   - SSL 证书生成：通常 10-30 分钟
   - 建议等待 30-60 分钟后再测试

2. **检查 DNS 解析**：
   ```bash
   # 在终端运行
   dig ai.zalem.app +short
   # 应该返回 Vercel 的 IP 地址（如 76.76.21.21）
   
   # 或者
   nslookup ai.zalem.app
   # 应该能解析到 IP 地址
   ```

3. **清除本地 DNS 缓存**：
   - **macOS**: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
   - **Windows**: `ipconfig /flushdns`
   - **Linux**: `sudo systemd-resolve --flush-caches` 或重启网络服务

4. **清除浏览器缓存**：
   - 使用无痕模式访问
   - 或清除浏览器缓存和 Cookie

5. **检查 Vercel 部署状态**：
   - 在 Vercel Dashboard 中，确认最新部署是 "Ready" 状态
   - 检查是否有部署错误

6. **尝试不同网络**：
   - 使用手机热点
   - 或使用在线工具如 [whatsmydns.net](https://www.whatsmydns.net/#A/ai.zalem.app) 检查全球 DNS 解析

### 问题 2: 路径 404 错误

**症状**：访问 `https://ai.zalem.app/admin` 返回 404

**可能原因**：
1. `NEXT_PUBLIC_BASE_PATH` 环境变量仍设置为 `/ai`
2. 浏览器缓存了旧的路径

**解决方案**：
1. 检查 Vercel 环境变量，删除 `NEXT_PUBLIC_BASE_PATH=/ai`
2. 清除浏览器缓存
3. 重新部署应用

### 问题 3: 静态资源加载失败

**症状**：CSS、JS 文件加载失败

**解决方案**：
1. 检查 `next.config.js` 中 `basePath` 是否为 `''`
2. 清除浏览器缓存
3. 检查 Vercel 部署日志

### 问题 4: API 路由不工作

**症状**：API 请求返回 404 或 CORS 错误

**解决方案**：
1. 确保 API 路由使用相对路径（如 `/api/ai/ask`）
2. 检查 API 路由文件是否正确
3. 查看 Vercel 部署日志中的错误信息

---

## 📝 相关文档

- [Next.js basePath 文档](https://nextjs.org/docs/app/api-reference/next-config-js/basePath)
- [Vercel 自定义域名文档](https://vercel.com/docs/concepts/projects/domains)
- [DNS 配置指南](https://vercel.com/docs/concepts/projects/domains/add-a-domain)

---

## 🎉 部署完成

部署成功后，应用将可通过 `https://ai.zalem.app` 访问。

如果遇到问题，请检查：
1. DNS 配置是否正确
2. Vercel 环境变量是否正确
3. Vercel 部署日志中的错误信息

