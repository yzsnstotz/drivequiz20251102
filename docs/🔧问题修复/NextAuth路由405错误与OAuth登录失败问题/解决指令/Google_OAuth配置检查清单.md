# Google OAuth 配置检查清单

**问题**: 可以跳转到 Google，但输入账号密码后显示"登录失败，OAuth配置错误，请检查环境变量设置"

**错误类型**: NextAuth "Configuration" 错误

---

## 📌 检查步骤

### 1. 检查环境变量（.env.local）

确保以下环境变量已正确配置：

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=EDc1FLfOShSpObQdpL7wfAGJFF1c3R2usXoznl//bgE=
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**验证方法**：
```bash
# 在项目根目录执行
grep -E "GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|NEXTAUTH_URL|NEXTAUTH_SECRET" .env.local
```

**注意事项**：
- 环境变量值前后不能有空格
- 环境变量值不能有引号（除非值本身包含引号）
- 确保 `.env.local` 文件在项目根目录

---

### 2. 检查 Google Cloud Console 配置

#### 2.1 登录 Google Cloud Console

1. 访问：https://console.cloud.google.com/
2. 选择正确的项目
3. 进入 "APIs & Services" → "Credentials"

#### 2.2 检查 OAuth 2.0 Client ID

1. 找到你的 OAuth 2.0 Client ID（应该与 `GOOGLE_CLIENT_ID` 一致）
2. 点击编辑

#### 2.3 检查 Authorized JavaScript origins

**必须包含**：
```
http://localhost:3000
```

**注意事项**：
- 不能使用 IP 地址（如 `http://192.168.100.18:3000`）
- 必须使用 `http://localhost:3000`（开发环境）
- 生产环境需要添加对应的生产域名

#### 2.4 检查 Authorized redirect URIs

**必须包含**：
```
http://localhost:3000/api/auth/callback/google
```

**注意事项**：
- 回调地址必须与 `NEXTAUTH_URL + /api/auth/callback/google` 完全一致
- 不能有多余的斜杠或路径
- 必须使用 `http://localhost:3000`（开发环境），不能使用 IP 地址

#### 2.5 检查 Client Secret

1. 确保 Client Secret 与 `.env.local` 中的 `GOOGLE_CLIENT_SECRET` 一致
2. 如果 Client Secret 已重置，需要更新 `.env.local`

---

### 3. 检查服务器日志

重启开发服务器后，检查控制台输出：

**正常输出应该包含**：
```
[NextAuth] ✅ 环境变量检查通过
[NextAuth] NEXTAUTH_URL: http://localhost:3000
[NextAuth] Google Client ID: your-google-client-id...
[NextAuth] Google Callback URL: http://localhost:3000/api/auth/callback/google
```

**如果看到警告**：
```
[NextAuth] ⚠️ 缺少必要的环境变量: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

说明环境变量未正确加载，需要：
1. 检查 `.env.local` 文件是否存在
2. 检查环境变量名称是否正确
3. 重启开发服务器

---

### 4. 测试 OAuth 流程

#### 4.1 测试授权跳转

1. 访问 `http://localhost:3000/login`
2. 点击 "使用 Google 登录" → "跳转授权"
3. 应该跳转到 Google 授权页面

#### 4.2 测试回调

1. 在 Google 授权页面输入账号密码
2. 授权后应该回调到 `http://localhost:3000/api/auth/callback/google`
3. 如果回调失败，检查：
   - Google Cloud Console 中的回调地址是否正确
   - 浏览器控制台是否有错误信息
   - 服务器日志是否有错误信息

---

## 📌 常见问题

### 问题 1: "Configuration" 错误

**原因**：
- `GOOGLE_CLIENT_ID` 或 `GOOGLE_CLIENT_SECRET` 为空或错误
- Google Cloud Console 中的回调地址不匹配

**解决方法**：
1. 检查 `.env.local` 中的环境变量
2. 检查 Google Cloud Console 中的回调地址
3. 确保回调地址与 `NEXTAUTH_URL + /api/auth/callback/google` 完全一致

### 问题 2: 回调地址不匹配

**原因**：
- Google Cloud Console 中的回调地址与 NextAuth 期望的不一致

**解决方法**：
1. 在 Google Cloud Console 中添加回调地址：`http://localhost:3000/api/auth/callback/google`
2. 确保 `NEXTAUTH_URL` 设置为 `http://localhost:3000`
3. 重启开发服务器

### 问题 3: 环境变量未加载

**原因**：
- `.env.local` 文件不存在或位置不正确
- 环境变量名称错误
- 开发服务器未重启

**解决方法**：
1. 确保 `.env.local` 文件在项目根目录
2. 检查环境变量名称是否正确（区分大小写）
3. 重启开发服务器

---

## 📌 验证清单

- [ ] `.env.local` 文件存在且包含所有必要的环境变量
- [ ] `GOOGLE_CLIENT_ID` 与 Google Cloud Console 中的 Client ID 一致
- [ ] `GOOGLE_CLIENT_SECRET` 与 Google Cloud Console 中的 Client Secret 一致
- [ ] `NEXTAUTH_URL` 设置为 `http://localhost:3000`
- [ ] Google Cloud Console 中的 "Authorized JavaScript origins" 包含 `http://localhost:3000`
- [ ] Google Cloud Console 中的 "Authorized redirect URIs" 包含 `http://localhost:3000/api/auth/callback/google`
- [ ] 开发服务器已重启
- [ ] 服务器日志显示环境变量检查通过
- [ ] 可以正常跳转到 Google 授权页面
- [ ] 授权后可以正常回调并登录成功

---

## 📌 下一步

如果按照以上步骤检查后问题仍然存在，请：

1. **收集错误信息**：
   - 浏览器控制台的完整错误信息
   - 服务器日志的完整输出
   - Google Cloud Console 的配置截图

2. **检查 NextAuth 版本**：
   ```bash
   npm list next-auth
   ```
   确保版本为 `5.0.0-beta.30`

3. **检查路由文件**：
   确保 `src/app/api/auth/[...nextauth]/route.ts` 使用正确的导出方式：
   ```typescript
   const { handlers } = NextAuth(authOptions);
   export const { GET, POST } = handlers;
   ```

---

**最后更新**: 2025-11-26 14:04:20

