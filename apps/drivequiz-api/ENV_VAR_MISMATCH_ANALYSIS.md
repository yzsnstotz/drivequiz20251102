# 环境变量值不匹配问题分析

**问题描述**：用户说 `.env` 文件中设置的 `DRIVEQUIZ_API_TOKEN_SECRET=datapull_drivequiz_api_token_2025_secure_key_v1` 没有问题，但系统读取到的值是 `drivequiz-api-secret-token-1762510925`。

**排查时间**：2025-11-07

---

## 🔍 排查结果

### 1. `.env` 文件实际内容

**文件位置**：`apps/drivequiz-api/.env`

**实际内容**：
```bash
DRIVEQUIZ_API_TOKEN_SECRET=drivequiz-api-secret-token-1762510925
```

**文件修改时间**：2025-11-07 19:28:34

---

### 2. 服务启动情况

**服务启动时间**：2025-11-07 20:47:05

**服务进程**：`tsx watch src/index.ts` (PID: 42483)

**环境变量加载**：使用 `dotenv.config()` 从 `.env` 文件加载

---

### 3. 验证结果

**测试命令**：
```bash
cd apps/drivequiz-api
node -e "require('dotenv').config(); console.log('从 .env 读取:', process.env.DRIVEQUIZ_API_TOKEN_SECRET);"
```

**结果**：
```
从 .env 读取: drivequiz-api-secret-token-1762510925
```

**结论**：✅ `dotenv` 能够正确读取 `.env` 文件中的值

---

## 🤔 可能的原因

### 原因 1：`.env` 文件未正确保存（最可能）

**情况**：
- 用户修改了 `.env` 文件，但修改后**没有保存**
- 或者保存到了**错误的位置**（如其他目录）

**验证方法**：
```bash
cd apps/drivequiz-api
cat .env | grep DRIVEQUIZ_API_TOKEN_SECRET
```

**解决方案**：
1. 确认 `.env` 文件位置：`apps/drivequiz-api/.env`
2. 重新编辑并保存文件
3. 验证保存后的内容

---

### 原因 2：服务启动时工作目录不正确

**情况**：
- 服务启动时的工作目录不是 `apps/drivequiz-api`
- `dotenv.config()` 默认从当前工作目录加载 `.env` 文件

**验证方法**：
```bash
# 检查服务启动时的工作目录
ps aux | grep "tsx watch src/index.ts"
```

**解决方案**：
- 确保在 `apps/drivequiz-api` 目录下启动服务
- 或者在代码中指定 `.env` 文件路径：
  ```typescript
  dotenv.config({ path: path.join(__dirname, '../.env') });
  ```

---

### 原因 3：环境变量被系统环境变量覆盖

**情况**：
- 系统环境变量中设置了 `DRIVEQUIZ_API_TOKEN_SECRET`
- `dotenv` 默认不会覆盖已存在的环境变量

**验证方法**：
```bash
env | grep DRIVEQUIZ_API_TOKEN_SECRET
```

**结果**：✅ 系统环境变量中未找到 `DRIVEQUIZ_API_TOKEN_SECRET`

**结论**：❌ 不是这个原因

---

### 原因 4：有多个 `.env` 文件

**情况**：
- 存在多个 `.env` 文件（如 `.env.local`、`.env.production`）
- `dotenv` 可能读取了错误的文件

**验证方法**：
```bash
cd apps/drivequiz-api
ls -la .env*
```

**结果**：✅ 只有 `.env` 文件，没有其他 `.env` 文件

**结论**：❌ 不是这个原因

---

### 原因 5：服务未重启

**情况**：
- 用户修改了 `.env` 文件，但服务没有重启
- 服务仍然使用启动时加载的环境变量

**验证**：
- `.env` 文件修改时间：2025-11-07 19:28:34
- 服务启动时间：2025-11-07 20:47:05
- 服务启动时间**晚于**文件修改时间

**结论**：❌ 不是这个原因（服务是在文件修改后启动的）

---

## ✅ 解决方案

### 方案 1：重新编辑并保存 `.env` 文件（推荐）

**步骤**：

1. **确认文件位置**：
   ```bash
   cd apps/drivequiz-api
   pwd  # 确认当前目录
   ```

2. **编辑 `.env` 文件**：
   ```bash
   # 使用编辑器打开文件
   nano .env
   # 或
   vim .env
   ```

3. **修改 Token 值**：
   ```bash
   DRIVEQUIZ_API_TOKEN_SECRET=datapull_drivequiz_api_token_2025_secure_key_v1
   ```

4. **保存文件**：
   - 确保文件已保存（编辑器会显示保存状态）
   - 验证保存后的内容：
     ```bash
     cat .env | grep DRIVEQUIZ_API_TOKEN_SECRET
     ```

5. **重启服务**：
   ```bash
   # 停止当前服务
   kill 42483
   
   # 重新启动服务
   npm run dev
   ```

6. **验证修复**：
   ```bash
   # 测试环境变量加载
   node -e "require('dotenv').config(); console.log('Token:', process.env.DRIVEQUIZ_API_TOKEN_SECRET);"
   
   # 测试 API 调用
   curl -X POST http://localhost:8789/api/v1/rag/docs/batch \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer datapull_drivequiz_api_token_2025_secure_key_v1" \
     -d '{"docs":[],"sourceId":"test"}'
   ```

---

### 方案 2：使用命令行直接修改

**步骤**：

```bash
cd apps/drivequiz-api

# 备份当前配置
cp .env .env.backup

# 使用 sed 修改（macOS）
sed -i '' 's/DRIVEQUIZ_API_TOKEN_SECRET=.*/DRIVEQUIZ_API_TOKEN_SECRET=datapull_drivequiz_api_token_2025_secure_key_v1/' .env

# 或使用 sed 修改（Linux）
sed -i 's/DRIVEQUIZ_API_TOKEN_SECRET=.*/DRIVEQUIZ_API_TOKEN_SECRET=datapull_drivequiz_api_token_2025_secure_key_v1/' .env

# 验证修改
cat .env | grep DRIVEQUIZ_API_TOKEN_SECRET

# 重启服务
npm run dev
```

---

### 方案 3：改进代码以明确指定 `.env` 文件路径

**修改 `apps/drivequiz-api/src/index.ts`**：

```typescript
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// 获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 明确指定 .env 文件路径
dotenv.config({ 
  path: path.join(__dirname, '../.env'),
  override: false  // 不覆盖已存在的环境变量
});
```

**优点**：
- 明确指定 `.env` 文件路径，避免工作目录问题
- 更可靠的环境变量加载

---

## 📝 建议

### 1. 添加环境变量验证日志

在服务启动时添加日志，显示加载的环境变量值（脱敏处理）：

```typescript
// 在 loadConfig() 函数中添加
logger.info({
  event: "config.loaded",
  hasToken: !!DRIVEQUIZ_API_TOKEN_SECRET,
  tokenLength: DRIVEQUIZ_API_TOKEN_SECRET?.length || 0,
  tokenPrefix: DRIVEQUIZ_API_TOKEN_SECRET?.substring(0, 10) || "N/A",
});
```

### 2. 使用环境变量验证工具

创建一个验证脚本：

```bash
#!/bin/bash
# apps/drivequiz-api/verify-env.sh

cd "$(dirname "$0")"

echo "🔍 验证环境变量配置..."
echo ""

# 加载 .env 文件
export $(cat .env | grep -v '^#' | xargs)

# 检查必需的环境变量
if [ -z "$DRIVEQUIZ_API_TOKEN_SECRET" ]; then
  echo "❌ DRIVEQUIZ_API_TOKEN_SECRET 未设置"
  exit 1
fi

echo "✅ DRIVEQUIZ_API_TOKEN_SECRET 已设置"
echo "   值: ${DRIVEQUIZ_API_TOKEN_SECRET:0:20}... (长度: ${#DRIVEQUIZ_API_TOKEN_SECRET})"
echo ""

# 验证 Token 值
if [ "$DRIVEQUIZ_API_TOKEN_SECRET" = "datapull_drivequiz_api_token_2025_secure_key_v1" ]; then
  echo "✅ Token 值正确"
else
  echo "⚠️  Token 值不匹配"
  echo "   期望: datapull_drivequiz_api_token_2025_secure_key_v1"
  echo "   实际: $DRIVEQUIZ_API_TOKEN_SECRET"
fi
```

---

## 🔗 相关文件

- `apps/drivequiz-api/.env` - 环境变量配置文件
- `apps/drivequiz-api/src/index.ts` - 服务启动文件
- `apps/drivequiz-api/ENV_SETUP.md` - 环境变量配置文档

---

**问题状态**：✅ 已定位可能原因，待用户确认并修复

