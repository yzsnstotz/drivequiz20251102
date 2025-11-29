# AI Ask 路由测试报告

## 执行时间
2025-11-06 12:19

## 测试脚本
`scripts/test-ai-ask-route.sh`

## 测试结果

### 1. 代码注入状态
- ✅ **AI_ENV_BLOCK** 已成功注入到路由文件
- ✅ **pickAiTarget** 函数已添加
- ✅ **respondJSON** 函数已添加（包含指纹头）
- ✅ **AI_PICK_START** 代码块已添加

### 2. 环境配置
- ✅ `apps/web/.env.local` 已配置：
  - `USE_LOCAL_AI=true`
  - `LOCAL_AI_SERVICE_URL=http://127.0.0.1:8788`
  - `LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345`

### 3. 服务启动状态
- ✅ 本地 AI 服务已启动（端口 8788）
- ✅ Web 服务已启动（端口 3000）

### 4. 测试用例结果

#### 测试 4.1：强制 local 模式（?ai=local）
- **状态**：❌ 失败
- **问题**：响应头中未找到 `x-route-fingerprint`
- **可能原因**：
  1. Next.js 在开发模式下可能过滤了自定义响应头
  2. 代码可能还未重新加载
  3. 速率限制导致请求被提前返回（429 错误）

#### 测试 4.4：强制 online 模式（?ai=online）
- **状态**：❌ 失败
- **问题**：响应头中未找到 `x-route-fingerprint`
- **可能原因**：同上

## 代码修改摘要

### 已添加的功能

1. **AI_ENV_BLOCK**（环境变量处理）
   - `readRaw`、`readBool`、`readUrl` 函数
   - `ENV` 对象统一管理环境变量
   - `forceModeFromReq` 函数（支持 URL 参数强制选择）
   - `pickAiTarget` 函数（统一 AI 服务选择逻辑）
   - `respondJSON` 函数（统一响应，包含指纹头）

2. **AI_PICK_START**（AI 服务选择）
   - 使用 `pickAiTarget` 选择 AI 服务
   - 设置调试响应头（`x-ai-service-mode`、`x-ai-service-url`）
   - 统一错误处理

3. **响应头修改**
   - 所有返回路径已改为使用 `respondJSON`
   - 包含指纹头：`x-route-fingerprint`
   - 包含调试头：`x-ai-service-mode`、`x-ai-service-url`

## 问题分析

### 主要问题：响应头未出现

可能的原因：
1. **Next.js 响应头过滤**：Next.js 在开发模式下可能过滤了某些自定义响应头
2. **代码未重新加载**：虽然服务已重启，但代码可能还未完全加载
3. **速率限制**：测试请求触发了速率限制（429），但响应头应该仍然存在

### 建议的解决方案

1. **检查 Next.js 配置**
   - 查看 `next.config.js` 是否有响应头过滤配置
   - 检查是否有 middleware 拦截了响应头

2. **验证代码加载**
   - 检查服务器日志，确认代码已重新加载
   - 尝试完全重启服务

3. **测试不同场景**
   - 清除速率限制计数器
   - 使用不同的用户 ID 测试
   - 测试成功响应（非 429 错误）

## 文件备份

原始文件已备份到：
- `.backup_runbook/route.ts.before-fix-*`

## 下一步行动

1. ✅ 代码修改已完成
2. ⚠️ 需要验证响应头是否正确设置
3. ⚠️ 需要测试成功响应场景（非速率限制）
4. ⚠️ 需要检查 Next.js 配置是否有响应头过滤

## 总结

代码修改已完成，核心功能已实现：
- ✅ 环境变量加载逻辑已标准化
- ✅ AI 服务选择逻辑已统一
- ✅ 调试响应头已添加
- ⚠️ 响应头在测试中未出现，需要进一步调查


