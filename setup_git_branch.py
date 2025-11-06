#!/usr/bin/env python3
"""
使用 subprocess 执行 git 命令，初始化仓库并创建 localAiModule 分支
"""
import subprocess
import os
import sys

def run_git_command(cmd, cwd=None):
    """执行 git 命令，忽略 xcrun 错误"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            stderr=subprocess.DEVNULL  # 忽略 stderr 中的 xcrun 错误
        )
        return result.returncode == 0, result.stdout.strip()
    except Exception as e:
        return False, str(e)

def main():
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("正在初始化 git 仓库...")
    success, output = run_git_command("git init", cwd=repo_dir)
    if not success:
        print(f"警告: git init 可能失败: {output}")
    
    # 检查 .git 目录是否存在
    if not os.path.exists(os.path.join(repo_dir, ".git")):
        print("错误: 无法创建 .git 目录")
        print("\n请手动执行以下命令:")
        print("1. 修复 CommandLineTools: sudo xcode-select --reset")
        print("2. 或者重新安装 CommandLineTools")
        sys.exit(1)
    
    print("配置远程仓库...")
    run_git_command("git remote add origin https://github.com/yzsnstotz/drivequiz20251102.git", cwd=repo_dir)
    run_git_command("git remote set-url origin https://github.com/yzsnstotz/drivequiz20251102.git", cwd=repo_dir)
    
    print("配置 git 用户信息...")
    run_git_command('git config user.name "Auto"', cwd=repo_dir)
    run_git_command('git config user.email "auto@example.com"', cwd=repo_dir)
    
    print("添加所有文件到暂存区...")
    success, output = run_git_command("git add .", cwd=repo_dir)
    if not success:
        print(f"警告: git add 可能失败: {output}")
    
    print("创建并切换到 localAiModule 分支...")
    success, output = run_git_command("git checkout -b localAiModule", cwd=repo_dir)
    if not success:
        print(f"警告: git checkout -b 可能失败: {output}")
    
    print("提交所有更改...")
    commit_msg = "Initial commit: Add all cleaned project files to localAiModule branch"
    success, output = run_git_command(f'git commit -m "{commit_msg}"', cwd=repo_dir)
    if not success:
        print(f"警告: git commit 可能失败: {output}")
        print(f"输出: {output}")
    
    print("检查分支状态...")
    success, output = run_git_command("git branch", cwd=repo_dir)
    print(f"当前分支: {output}")
    
    success, output = run_git_command("git log --oneline -1", cwd=repo_dir)
    print(f"最新提交: {output}")
    
    print("\n准备推送到远程仓库...")
    print("如果推送失败，可能需要配置 GitHub 身份验证")
    print("执行命令: git push -u origin localAiModule")
    
    # 尝试推送
    success, output = run_git_command("git push -u origin localAiModule", cwd=repo_dir)
    if success:
        print("✅ 成功推送到远程仓库!")
    else:
        print(f"⚠️  推送可能失败: {output}")
        print("\n请手动执行: git push -u origin localAiModule")
        print("如果提示身份验证，请使用 GitHub Personal Access Token")

if __name__ == "__main__":
    main()

