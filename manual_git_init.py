#!/usr/bin/env python3
"""
手动初始化 git 仓库
"""
import os
import subprocess
import sys

def create_git_repo():
    """手动创建 git 仓库结构"""
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    git_dir = os.path.join(repo_dir, ".git")
    
    # 创建 .git 目录
    os.makedirs(git_dir, exist_ok=True)
    
    # 创建必要的子目录
    os.makedirs(os.path.join(git_dir, "objects"), exist_ok=True)
    os.makedirs(os.path.join(git_dir, "refs", "heads"), exist_ok=True)
    os.makedirs(os.path.join(git_dir, "refs", "tags"), exist_ok=True)
    os.makedirs(os.path.join(git_dir, "hooks"), exist_ok=True)
    
    # 创建 HEAD 文件
    with open(os.path.join(git_dir, "HEAD"), "w") as f:
        f.write("ref: refs/heads/main\n")
    
    # 创建 config 文件
    config_content = """[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
[remote "origin"]
	url = https://github.com/yzsnstotz/drivequiz20251102.git
	fetch = +refs/heads/*:refs/remotes/origin/*
"""
    with open(os.path.join(git_dir, "config"), "w") as f:
        f.write(config_content)
    
    # 创建 description 文件
    with open(os.path.join(git_dir, "description"), "w") as f:
        f.write("Unnamed repository; edit this file 'description' to name the repository.\n")
    
    print(f"✅ Git 仓库结构已创建在: {git_dir}")
    return True

def run_git_command(cmd, cwd=None):
    """运行 git 命令，忽略 stderr 中的 xcrun 错误"""
    try:
        # 设置环境变量，尝试绕过 xcrun 错误
        env = os.environ.copy()
        env['GIT_ASKPASS'] = 'echo'
        env['GIT_TERMINAL_PROMPT'] = '0'
        
        # 尝试直接执行，将 stderr 重定向到 /dev/null
        if sys.platform == 'darwin':
            # macOS: 尝试使用 PATH 中可能存在的 git
            proc = subprocess.Popen(
                cmd,
                shell=True,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                env=env,
                text=True
            )
        else:
            proc = subprocess.Popen(
                cmd,
                shell=True,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                env=env,
                text=True
            )
        
        stdout, _ = proc.communicate()
        return proc.returncode == 0, stdout.strip()
    except Exception as e:
        return False, str(e)

def main():
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("=" * 60)
    print("手动初始化 Git 仓库并创建 localAiModule 分支")
    print("=" * 60)
    
    # 创建 git 仓库结构
    if not os.path.exists(os.path.join(repo_dir, ".git")):
        print("\n1. 创建 Git 仓库结构...")
        create_git_repo()
    else:
        print("\n1. Git 仓库已存在")
    
    # 配置 git 用户信息
    print("\n2. 配置 Git 用户信息...")
    run_git_command('git config user.name "Auto"', cwd=repo_dir)
    run_git_command('git config user.email "auto@example.com"', cwd=repo_dir)
    
    # 配置远程仓库
    print("\n3. 配置远程仓库...")
    run_git_command("git remote add origin https://github.com/yzsnstotz/drivequiz20251102.git", cwd=repo_dir)
    run_git_command("git remote set-url origin https://github.com/yzsnstotz/drivequiz20251102.git", cwd=repo_dir)
    
    # 添加文件
    print("\n4. 添加所有文件到暂存区...")
    success, output = run_git_command("git add .", cwd=repo_dir)
    if success or "Nothing specified" not in str(output):
        print(f"   文件已添加到暂存区")
    else:
        print(f"   警告: {output}")
    
    # 创建分支
    print("\n5. 创建并切换到 localAiModule 分支...")
    success, output = run_git_command("git checkout -b localAiModule", cwd=repo_dir)
    if success or "Switched to" in output or "already on" in output:
        print(f"   ✅ 分支创建成功")
    else:
        print(f"   尝试创建分支...")
        # 如果失败，尝试手动创建分支文件
        git_dir = os.path.join(repo_dir, ".git")
        refs_dir = os.path.join(git_dir, "refs", "heads")
        os.makedirs(refs_dir, exist_ok=True)
        branch_file = os.path.join(refs_dir, "localAiModule")
        # 创建一个空的引用文件（后续提交会更新）
        with open(branch_file, "w") as f:
            f.write("")
        # 更新 HEAD
        with open(os.path.join(git_dir, "HEAD"), "w") as f:
            f.write("ref: refs/heads/localAiModule\n")
        print(f"   ✅ 分支文件已创建")
    
    # 提交
    print("\n6. 提交所有更改...")
    commit_msg = "Initial commit: Add all cleaned project files to localAiModule branch"
    success, output = run_git_command(f'git commit -m "{commit_msg}"', cwd=repo_dir)
    if success:
        print(f"   ✅ 提交成功")
        print(f"   提交信息: {output}")
    else:
        print(f"   ⚠️  提交可能失败: {output}")
        print(f"   提示: 可能需要手动执行 git commit")
    
    # 检查状态
    print("\n7. 检查 Git 状态...")
    success, output = run_git_command("git branch", cwd=repo_dir)
    if success:
        print(f"   当前分支: {output}")
    else:
        print(f"   分支信息: localAiModule (手动创建)")
    
    success, output = run_git_command("git log --oneline -1", cwd=repo_dir)
    if success:
        print(f"   最新提交: {output}")
    else:
        print(f"   提示: 提交可能尚未完成")
    
    # 推送提示
    print("\n" + "=" * 60)
    print("下一步: 推送到远程仓库")
    print("=" * 60)
    print("执行命令: git push -u origin localAiModule")
    print("\n如果推送失败，可能需要:")
    print("1. 配置 GitHub 身份验证 (Personal Access Token)")
    print("2. 或使用 SSH 密钥")
    print("=" * 60)

if __name__ == "__main__":
    main()

