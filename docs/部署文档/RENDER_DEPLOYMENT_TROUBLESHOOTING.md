# 🔧 Render 部署问题诊断指南

## 错误信息
```
Service Root Directory "/opt/render/project/src/apps/ai-service" is missing.
builder.sh: line 51: cd: /opt/render/project/src/apps/ai-service: No such file or directory
```

## 问题分析

根据错误信息，Render 尝试访问 `/opt/render/project/src/apps/ai-service`，但目录不存在。

### 路径说明
- Render 默认将 Git 仓库克隆到 `/opt/render/project/src/` 目录
- `render.yaml` 中的 `rootDir: apps/ai-service` 是相对于仓库根目录的路径
- 实际访问路径为：`/opt/render/project/src/` + `apps/ai-service` = `/opt/render/project/src/apps/ai-service`

### 可能的原因

1. **Git 仓库中缺少 `apps/ai-service` 目录**
   - 目录未被提交到 Git
   - 目录被 `.gitignore` 排除（已验证，未被排除）

2. **Render Dashboard 中的手动配置覆盖了 render.yaml**
   - 在 Dashboard 中手动创建服务时设置了错误的 Root Directory
   - 服务配置中的 Root Directory 与 `render.yaml` 不一致

3. **克隆的分支或版本不对**
   - Render 克隆了错误的分支
   - 该分支中不包含 `apps/ai-service` 目录

4. **render.yaml 配置问题**
   - `rootDir` 路径配置错误

## ✅ 修复方案

### 方案 1: 验证 Git 仓库中的目录存在（推荐）

1. **检查 Git 仓库中是否包含 `apps/ai-service` 目录**
   ```bash
   git ls-files apps/ai-service/
   ```
   
2. **如果目录存在但未被追踪，添加到 Git**
   ```bash
   git add apps/ai-service/
   git commit -m "fix(render): ensure ai-service directory is tracked"
   git push
   ```

3. **验证目录结构**
   ```bash
   git ls-tree -r HEAD --name-only | grep apps/ai-service
   ```

### 方案 2: 检查 Render Dashboard 配置

1. **登录 Render Dashboard**
2. **找到 `zalem-ai-service` 服务**
3. **进入 Settings 页面**
4. **检查 "Service Root Directory" 配置**
   - 应该为空（使用 render.yaml 中的配置）
   - 或者设置为 `apps/ai-service`（相对于仓库根目录）
   - **不要设置为 `src/apps/ai-service` 或其他路径**

5. **如果配置错误，修改为：**
   - 清空该字段（让 Render 使用 render.yaml 中的配置）
   - 或者设置为 `apps/ai-service`

### 方案 3: 验证 render.yaml 配置

当前 `render.yaml` 配置：
```yaml
services:
  - type: web
    name: zalem-ai-service
    rootDir: apps/ai-service  # ✅ 正确配置
```

确保：
- ✅ `rootDir` 使用相对于仓库根目录的路径
- ✅ 不使用绝对路径
- ✅ 不使用 `./` 前缀（虽然可能也支持）

### 方案 4: 重新创建服务（如果以上都无效）

1. **删除现有的 Render 服务**
2. **确保 Git 仓库中包含 `apps/ai-service` 目录**
3. **推送最新的代码和 render.yaml**
4. **在 Render Dashboard 中使用 "New Blueprint" 重新部署**
   - Render 会自动读取 `render.yaml` 并创建服务
   - 确保选择正确的 Git 仓库和分支

## 🔍 诊断步骤

### 步骤 1: 验证本地目录存在
```bash
ls -la apps/ai-service/
```

### 步骤 2: 验证 Git 追踪
```bash
git status apps/ai-service/
git ls-files apps/ai-service/
```

### 步骤 3: 检查 render.yaml
```bash
cat render.yaml | grep rootDir
```

### 步骤 4: 验证远程仓库
```bash
# 切换到正确的分支
git checkout <branch-name>

# 验证远程仓库中是否有该目录
git ls-tree -r origin/<branch-name> --name-only | grep apps/ai-service
```

## 📝 快速修复清单

- [ ] 验证 `apps/ai-service/` 目录存在于 Git 仓库中
- [ ] 检查 Render Dashboard 中的 "Service Root Directory" 配置
- [ ] 确认 `render.yaml` 中的 `rootDir: apps/ai-service` 配置正确
- [ ] 确认 Render 连接的是正确的 Git 仓库和分支
- [ ] 重新部署服务或删除并重新创建

## 🚀 重新部署后验证

部署成功后，验证服务是否正常：

```bash
# 健康检查
curl https://<your-render-service-url>/healthz

# 应该返回 200 OK
```

## 📚 相关文档

- Render Blueprint 文档: https://render.com/docs/blueprint-spec
- Render 部署问题排查: https://render.com/docs/troubleshooting

