# Twitter OAuth 2.0 403 Forbidden 快速检查清单

## ⚠️ 关键检查项（必须全部正确）

### 1. ✅ User Authentication Settings 配置

在 Twitter Developer Portal 中：

1. 进入你的应用
2. 点击 **"Settings"** → **"User authentication settings"**
3. 确保以下设置：

```
✅ App permissions: "Read" (必须是 Read，不是 Read and write)
✅ Type of App: "Web App"
✅ Callback URI / Redirect URL: http://localhost:3000/api/auth/callback/twitter
✅ Website URL: 你的网站地址（例如：http://localhost:3000）
```

**重要**：
- ❌ 不要选择 "Read and write" 权限
- ❌ 不要选择 "Native App" 类型
- ✅ 回调 URL 必须完全匹配（包括协议、域名、端口、路径）

### 2. ✅ 应用状态检查

1. 在 Twitter Developer Portal 中查看应用状态
2. 确保应用：
   - ✅ 状态为 **"Active"**
   - ❌ 没有被暂停
   - ❌ 没有警告或错误提示

### 3. ✅ 等待配置生效

- 新创建或修改配置后，等待 **2-5 分钟** 让配置生效
- 然后清除浏览器缓存和 Cookie 后重试

### 4. ✅ 检查日志输出

重启服务器后，尝试登录，查看控制台日志：

**应该看到的日志**：
```
[Twitter Provider] Token request started
[Twitter Provider] Token response status: 200 OK
[Twitter Provider] Token response received
[Twitter Provider] Has access_token: true
[Twitter Provider] Userinfo request started
[Twitter Provider] Userinfo response status: 200 OK
```

**如果看到 403**：
- 检查上面的配置项
- 查看详细的错误信息

## 🔍 常见问题

### 问题 1: "App permissions" 设置错误
- **错误**：设置为 "Read and write"
- **正确**：必须设置为 "Read"

### 问题 2: "Type of App" 设置错误
- **错误**：设置为 "Native App" 或其他
- **正确**：必须设置为 "Web App"

### 问题 3: 回调 URL 不匹配
- **错误**：`http://localhost:3000/api/auth/callback/twitter/`（末尾有斜杠）
- **正确**：`http://localhost:3000/api/auth/callback/twitter`（无末尾斜杠）

### 问题 4: 配置未生效
- **解决**：等待 2-5 分钟后重试

## 📝 验证步骤

1. ✅ 检查 Twitter Developer Portal 配置（按照上面的清单）
2. ✅ 等待 2-5 分钟
3. ✅ 清除浏览器缓存和 Cookie
4. ✅ 重启开发服务器
5. ✅ 查看新的详细日志
6. ✅ 如果仍然 403，检查日志中的详细错误信息

## 🆘 如果仍然失败

如果按照以上步骤操作后仍然返回 403，请提供：
1. Twitter Developer Portal 中 "User authentication settings" 的截图
2. 完整的控制台日志（包括所有 [Twitter Provider] 开头的日志）
3. 错误响应的完整内容

