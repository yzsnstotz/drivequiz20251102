# Git 分支设置指南

由于系统 CommandLineTools 配置问题，需要手动执行以下步骤来创建 `localAiModule` 分支并推送代码。

## 问题说明

当前系统遇到 `xcrun: error: invalid active developer path` 错误，这导致 git 命令无法正常执行。

## 解决方案

### 方案 1: 修复 CommandLineTools（推荐）

在终端中执行以下命令修复 CommandLineTools：

```bash
sudo xcode-select --reset
```

如果上述命令失败，可以尝试：

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

或者重新安装 CommandLineTools：
```bash
xcode-select --install
```

### 方案 2: 手动执行 Git 命令

修复 CommandLineTools 后，在项目目录中执行以下命令：

```bash
# 1. 进入项目目录
cd /Users/leoventory/desktop/kkdrivequiz

# 2. 初始化 git 仓库
git init

# 3. 配置远程仓库
git remote add origin https://github.com/yzsnstotz/drivequiz20251102.git
# 或者如果已存在，更新远程仓库地址
git remote set-url origin https://github.com/yzsnstotz/drivequiz20251102.git

# 4. 配置 git 用户信息（如果还没有配置）
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 5. 添加所有文件到暂存区
git add .

# 6. 创建并切换到 localAiModule 分支
git checkout -b localAiModule

# 7. 提交所有更改
git commit -m "Initial commit: Add all cleaned project files to localAiModule branch"

# 8. 推送到远程仓库
git push -u origin localAiModule
```

### 方案 3: 使用 GitHub CLI

如果已安装 GitHub CLI (`gh`)，可以使用以下命令：

```bash
gh repo clone yzsnstotz/drivequiz20251102
cd drivequiz20251102
git checkout -b localAiModule
# ... 复制文件到克隆的仓库 ...
git add .
git commit -m "Initial commit: Add all cleaned project files to localAiModule branch"
git push -u origin localAiModule
```

## 身份验证

如果推送时提示需要身份验证，可以使用以下方式：

1. **使用 Personal Access Token (推荐)**
   - 在 GitHub 设置中创建 Personal Access Token
   - 推送时使用 token 作为密码

2. **使用 SSH 密钥**
   - 配置 SSH 密钥后，使用 SSH URL：
   ```bash
   git remote set-url origin git@github.com:yzsnstotz/drivequiz20251102.git
   ```

## 验证

推送成功后，可以在 GitHub 上查看：
- 仓库地址: https://github.com/yzsnstotz/drivequiz20251102
- 分支: localAiModule

