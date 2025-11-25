# 激活状态定期检查逻辑说明

## 定期检查机制

### 检查频率
- **检查间隔**：每30分钟自动检查一次激活状态
- **首次检查**：页面加载时，如果有本地激活状态，会进行一次异步检查（不影响用户体验）

### 检查逻辑

1. **检查条件**
   - 必须有邮箱和激活状态才能进行检查
   - 如果缺少邮箱，会直接显示激活模态框

2. **检查结果处理**
   - ✅ **激活有效** (`result.ok && result.data?.valid === true`)
     - 更新本地激活状态
     - 保持激活状态，不显示模态框
   
   - ❌ **激活无效** (`result.ok && result.data?.valid === false`)
     - **仅在此时清除激活状态**
     - 清除 `drive-quiz-activated` 和 `drive-quiz-email`
     - 显示激活模态框
   
   - ⚠️ **API错误或网络问题**（其他情况）
     - **保持当前激活状态，不清除**
     - 不显示模态框
     - 记录警告日志

3. **错误处理**
   - 网络错误、超时（10秒）或其他异常
   - **不会清除激活状态**
   - 如果有本地激活状态，继续信任本地状态
   - 记录错误日志

### 重要保障

✅ **定期检查不会因为以下情况而清除激活状态**：
- 网络连接失败
- API服务器错误（500等）
- 请求超时（10秒）
- API返回非明确的无效状态
- 任何异常错误

❌ **只有在以下情况才会清除激活状态**：
- API明确返回 `valid: false`
- 缺少邮箱但有激活状态（旧用户数据清理）

### 路径变化处理

- 当路径变化时（如从首页跳转到学习页面），**不会重新检查激活状态**
- 只检查本地存储的激活状态，如果有就保持激活，如果没有就显示模态框

### 调试日志

检查过程中的关键操作都会记录日志：
- `[ActivationProvider] Activation status validated successfully` - 检查成功
- `[ActivationProvider] Activation invalid from API, clearing activation state` - API返回无效，清除状态
- `[ActivationProvider] API check failed or returned unclear status, keeping current activation state` - API错误，保持状态
- `[ActivationProvider] Keeping activation state due to check error` - 异常错误，保持状态

### 总结

**定期检查的设计目标是：确保激活状态的安全性，同时避免因临时网络问题而误清除用户的激活状态。**

只有在API明确返回激活无效时，才会清除激活状态。其他所有情况（网络错误、超时、API错误等）都会保持当前的激活状态，确保用户不会因为临时问题而被强制重新激活。

