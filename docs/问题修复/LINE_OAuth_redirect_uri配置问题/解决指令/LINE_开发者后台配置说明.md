# LINE OAuth 回调地址配置说明

## 问题描述

LINE OAuth 登录时出现错误：
```
400 Bad Request
Invalid redirect_uri value. Check if it is registered in a LINE developers site.
```

## 原因

LINE 开发者后台没有注册正确的回调地址（Callback URL）。

## 解决方案

### 步骤 1：登录 LINE Developers Console

1. 访问 [LINE Developers Console](https://developers.line.biz/console/)
2. 使用您的 LINE 账号登录

### 步骤 2：选择您的 Channel

1. 在控制台中找到您的 LINE Login Channel
2. 点击进入 Channel 设置页面

### 步骤 3：配置 Callback URL

1. 在 Channel 设置页面，找到 **"Callback URL"** 或 **"Redirect URI"** 设置
2. 添加以下回调地址：

#### 开发环境（本地开发）

```
http://localhost:3000/api/auth/callback/line
```

#### 生产环境（部署到 Vercel 后）

```
https://your-domain.com/api/auth/callback/line
```

**注意**：
- 回调地址必须**完全匹配**，包括协议（http/https）、域名、端口和路径
- 不能有多余的斜杠或空格
- 大小写敏感

### 步骤 4：保存配置

1. 点击 **"Save"** 或 **"保存"** 按钮
2. 等待配置生效（通常立即生效，但可能需要几分钟）

### 步骤 5：验证配置

1. 重启开发服务器
2. 尝试使用 LINE 登录
3. 如果仍然出现错误，检查：
   - 回调地址是否完全匹配
   - 是否保存了配置
   - 是否等待了足够的时间让配置生效

## 环境变量配置

确保 `.env.local` 中设置了正确的环境变量：

```bash
# NextAuth 基础配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# LINE OAuth 配置
LINE_CLIENT_ID=your-line-channel-id
LINE_CLIENT_SECRET=your-line-channel-secret
# LINE_REDIRECT_URI 是可选的，如果不设置，NextAuth 会自动使用 NEXTAUTH_URL/api/auth/callback/line
LINE_REDIRECT_URI=http://localhost:3000/api/auth/callback/line
```

## 常见问题

### Q1: 为什么需要注册回调地址？

A: LINE OAuth 需要验证回调地址是否在允许列表中，这是安全措施，防止未授权的重定向。

### Q2: 可以注册多个回调地址吗？

A: 可以。LINE 允许注册多个回调地址，每个地址占一行。

### Q3: 本地开发可以使用 localhost 吗？

A: 可以。LINE 支持 `http://localhost:3000` 作为回调地址。

### Q4: 部署到 Vercel 后需要做什么？

A: 
1. 在 LINE Developers Console 中添加生产环境的回调地址
2. 更新 `.env.local` 或 Vercel 环境变量中的 `NEXTAUTH_URL`
3. 确保 `LINE_REDIRECT_URI`（如果设置了）也更新为生产环境地址

### Q5: 回调地址格式有什么要求？

A:
- 必须以 `http://` 或 `https://` 开头
- 不能包含查询参数（`?` 后面的部分）
- 不能包含锚点（`#` 后面的部分）
- 路径必须完全匹配，包括大小写

## 参考链接

- [LINE Login 文档](https://developers.line.biz/en/docs/line-login/)
- [LINE Developers Console](https://developers.line.biz/console/)

