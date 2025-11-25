# 修复 CommandLineTools 指南

## 问题诊断

当前问题：
- CommandLineTools 路径：`/Library/Developer/CommandLineTools`
- xcrun 文件缺失：`/Library/Developer/CommandLineTools/usr/bin/xcrun`
- 错误：`xcrun: error: invalid active developer path`

## 解决方法

### 方法 1: 重置 CommandLineTools（推荐）

在终端中执行：

```bash
sudo xcode-select --reset
```

输入管理员密码，等待命令完成。

**验证修复：**
```bash
xcrun --version
git --version
```

应该显示版本号，而不是错误。

### 方法 2: 重新安装 CommandLineTools

如果重置失败，重新安装：

```bash
xcode-select --install
```

这会打开一个系统对话框，点击"安装"按钮。

等待安装完成（可能需要几分钟到十几分钟）。

**验证安装：**
```bash
xcode-select --print-path
xcrun --version
```

### 方法 3: 手动修复路径

如果安装了完整版 Xcode：

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

## 使用自动修复脚本

运行提供的修复脚本：

```bash
cd /Users/leoventory/desktop/kkdrivequiz
./fix_commandlinetools.sh
```

脚本会：
1. 检查当前状态
2. 尝试自动修复（需要管理员密码）
3. 提供手动修复指南

## 修复后的验证

修复成功后，验证以下命令：

```bash
# 1. 检查 xcrun
xcrun --version
# 应该显示版本号

# 2. 检查 git
git --version
# 应该显示: git version 2.x.x

# 3. 检查 xcode-select
xcode-select --print-path
# 应该显示有效路径

# 4. 测试 git 命令
git status
# 应该正常工作，不再显示 xcrun 错误
```

## 常见问题

### Q1: sudo 命令需要密码

这是正常的，需要管理员权限。输入你的 macOS 用户密码（输入时不会显示字符）。

### Q2: xcode-select --reset 失败

尝试：
```bash
# 检查是否有其他问题
xcode-select --print-path

# 如果路径有问题，手动设置
sudo xcode-select --switch /Library/Developer/CommandLineTools
```

### Q3: 安装 CommandLineTools 很慢

这是正常的，文件较大（几GB），需要时间下载和安装。请耐心等待。

### Q4: 修复后仍然有错误

1. 重启终端
2. 检查是否完全安装：
   ```bash
   ls -la /Library/Developer/CommandLineTools/usr/bin/xcrun
   ```
3. 如果文件不存在，重新安装 CommandLineTools

## 修复后执行 Git 操作

修复 CommandLineTools 后，执行：

```bash
cd /Users/leoventory/desktop/kkdrivequiz
./quick_setup.sh
```

或者手动执行：

```bash
git add .
git commit -m "Initial commit"
git push -u origin localAiModule
```

## 总结

**必须执行：**
1. `sudo xcode-select --reset` 或 `xcode-select --install`
2. 验证修复：`xcrun --version` 和 `git --version`
3. 执行 git 操作：`./quick_setup.sh`

修复 CommandLineTools 后，所有 git 命令就可以正常工作了！

