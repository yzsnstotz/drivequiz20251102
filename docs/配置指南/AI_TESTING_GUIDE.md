# 🤖 AI 功能测试指南

## ✅ AI 入口已添加

现在您可以在首页看到 AI 功能的入口：

1. **顶部导航栏**：右上角有一个机器人图标（🤖），点击即可打开 AI 助手
2. **首页大卡片**：在功能区域下方，有一个醒目的"AI 智能助手"卡片，点击即可打开

---

## 🔧 环境变量配置

要测试 AI 功能，需要配置以下环境变量（在 `.env.local` 文件中）：

### 必需配置

```bash
# OpenAI API 密钥（必需）
OPENAI_API_KEY=sk-xxx...

# AI 模型（可选，默认 gpt-4o-mini）
AI_MODEL=gpt-4o-mini

# 用户 JWT 密钥（用于验证用户身份，测试时可选）
USER_JWT_SECRET=your-secret-key-here
```

### 快速配置步骤

1. **获取 OpenAI API Key**
   - 访问 [OpenAI Platform](https://platform.openai.com/)
   - 登录后进入 **API Keys** 页面
   - 创建新的 API Key
   - 复制密钥（格式：`sk-...`）

2. **编辑 `.env.local` 文件**
   ```bash
   # 在项目根目录
   nano .env.local
   # 或使用其他编辑器
   ```

3. **添加环境变量**
   ```bash
   # 添加到 .env.local 文件末尾
   OPENAI_API_KEY=sk-你的密钥
   AI_MODEL=gpt-4o-mini
   USER_JWT_SECRET=test-secret-key-123  # 测试时可以使用简单密钥
   ```

4. **重启开发服务器**
   ```bash
   # 停止当前服务器（Ctrl+C）
   # 重新启动
   npm run dev
   ```

---

## 🧪 测试步骤

### 1. 测试界面显示

1. 访问 http://localhost:3000
2. 确认能看到 AI 入口：
   - ✅ 顶部导航栏右侧有机器人图标
   - ✅ 首页有"AI 智能助手"大卡片
3. 点击任意一个入口，应该能打开 AI 聊天界面

### 2. 测试 AI 对话

**好消息**：在开发模式下，如果未配置 `USER_JWT_SECRET`，系统会自动允许跳过认证，方便本地测试！

#### 方式 A：直接测试（推荐，开发模式）

1. **确保在开发模式运行**
   ```bash
   npm run dev  # 默认就是开发模式
   ```

2. **直接测试 AI 对话**
   - 无需配置 `USER_JWT_SECRET`
   - 无需设置 JWT Token
   - 直接打开 AI 助手并发送消息

**注意**：这种方式仅适用于本地开发测试。生产环境需要配置 `USER_JWT_SECRET` 和有效的 JWT Token。

#### 方式 B：配置完整认证（生产环境）

1. **配置 `USER_JWT_SECRET`**
   ```bash
   # 在 .env.local 中添加
   USER_JWT_SECRET=your-secret-key-here
   ```

2. **生成测试 JWT Token**（需要 JWT 库）
   ```javascript
   // 使用 jose 库生成 JWT（需要与服务端密钥匹配）
   import { SignJWT } from 'jose';
   
   const secret = new TextEncoder().encode('your-secret-key-here');
   const token = await new SignJWT({ sub: 'test-user' })
     .setProtectedHeader({ alg: 'HS256' })
     .setIssuedAt()
     .setExpirationTime('24h')
     .sign(secret);
   ```

3. **设置 Token 到 localStorage**
   ```javascript
   // 在浏览器控制台运行
   localStorage.setItem('USER_TOKEN', 'your-jwt-token-here');
   ```

### 3. 测试 API 健康检查

访问 API 健康检查端点：
```
http://localhost:3000/api/ai/chat
```

应该返回：
```json
{
  "ok": true,
  "data": {
    "service": "ai-chat",
    "model": "gpt-4o-mini",
    "ts": "2025-11-04T..."
  }
}
```

### 4. 测试完整对话流程

1. 打开 AI 助手界面
2. 在输入框中输入问题，例如："什么是交通标志？"
3. 点击"发送"按钮或按 Enter 键
4. 等待 AI 响应
5. 确认收到回复

---

## 🐛 常见问题排查

### 问题 1: 点击 AI 入口没有反应

**检查**：
1. 打开浏览器开发者工具（F12）
2. 查看 Console 是否有错误
3. 确认 `AIPage` 组件是否正确导入

**解决**：
- 检查 `src/components/AIPage.tsx` 是否存在
- 确认导入路径正确：`import AIPage from "@/components/AIPage";`

### 问题 2: API 返回 401 未授权错误

**原因**：在开发模式下，如果未配置 `USER_JWT_SECRET`，应该自动允许跳过认证。如果仍然报错，可能是：

1. **环境变量读取问题**：重启开发服务器
2. **生产模式运行**：确保使用 `npm run dev` 而不是 `npm run start`

**解决**：
1. 确认正在使用开发模式：`npm run dev`
2. 重启开发服务器：停止后重新运行 `npm run dev`
3. 如果配置了 `USER_JWT_SECRET`，需要设置有效的 JWT Token 到 `localStorage`：
   ```javascript
   localStorage.setItem('USER_TOKEN', 'your-jwt-token');
   ```

### 问题 3: API 返回 500 内部错误

**原因**：可能是 `OPENAI_API_KEY` 未配置或无效

**检查**：
```bash
# 检查环境变量
grep OPENAI_API_KEY .env.local
```

**解决**：
1. 确认 `.env.local` 中有 `OPENAI_API_KEY`
2. 确认 API Key 有效（格式：`sk-...`）
3. 重启开发服务器

### 问题 4: AI 响应超时

**原因**：OpenAI API 调用超时或网络问题

**解决**：
1. 检查网络连接
2. 确认 OpenAI API 服务正常
3. 检查 API Key 是否有足够的配额

### 问题 5: 界面显示空白

**检查**：
1. 浏览器控制台是否有错误
2. 网络请求是否成功

**解决**：
- 清除浏览器缓存
- 重新加载页面
- 检查代码是否有语法错误

---

## 📝 测试检查清单

- [ ] 环境变量已配置（`OPENAI_API_KEY`、`USER_JWT_SECRET`）
- [ ] 开发服务器已重启
- [ ] 首页能看到 AI 入口（顶部图标 + 大卡片）
- [ ] 点击 AI 入口能打开聊天界面
- [ ] API 健康检查返回正常（`/api/ai/chat` GET 请求）
- [ ] 能发送消息
- [ ] 能收到 AI 回复
- [ ] 错误提示正常显示（如果有错误）

---

## 🎯 快速测试脚本

### 测试 API 健康检查

```bash
curl http://localhost:3000/api/ai/chat
```

### 测试 AI 对话（需要 Token）

```bash
# 需要先获取有效的 JWT Token
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "question": "什么是交通标志？",
    "meta": {
      "client": "web",
      "locale": "zh-CN"
    }
  }'
```

---

## 📚 相关文档

- [AI 环境变量配置指南](./AI_ENV_SETUP.md)
- [本地界面测试指南](./LOCAL_UI_TESTING_GUIDE.md)
- [API 接口文档](../驾考AI开发文档/📐 接口与命名规范 v1.0.md)

---

**祝测试顺利！** 🚀

